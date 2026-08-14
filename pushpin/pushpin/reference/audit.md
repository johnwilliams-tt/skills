# Auditing a Figma frame

The check that catches the failure [generate.md](generate.md) is about: work that
looks right in a screenshot and is structurally fake. Run it on a frame this
plugin generated before handing anything over, and on any existing frame when
the question is whether it is on-system.

It is a `use_figma` script rather than a shell command, because everything it
inspects lives in the Figma document.

## What it sorts into

Five buckets:

- **Library** — instances that resolved to remote published components.
- **Proposed** — local components named `Proposed / …` that have a parseable
  note on the page.
- **Unresolved** — placeholders standing in for something the system could not
  supply.
- **Degraded** — which libraries the preflight could not reach, and what was
  substituted for them.
- **Defects** — detached instances, lookalikes, undeclared local components,
  literal fills, resized icons, `Proposed /` components whose note is missing or
  incomplete or whose type and geometry drifted from the component they claim to
  extend, and overlapping annotations.

The run fails on defects only. A populated `proposed`, `unresolved`, or
`degraded` bucket is a result to report, not a failure — this is a `use_figma`
script, so "exit non-zero" means `report.ok === false`: do not hand the frame
over, and do not offer the finalize pass.

`unresolved` does not fail for the same reason `proposed` does not: both are
the honest outcome of a gap in the system, and failing on them would push the
next run back toward hiding the gap. What fails is hiding it. `degraded` is the
same bargain one level up — the gap is in what this account can reach rather than
in what the system publishes, and failing on it would only bring back the
stop-on-anything behaviour it replaced.

## The script

```js
const root = await figma.getNodeByIdAsync('<generated frame id>');

// This runs as its own use_figma call, so the preflight's result is not in
// scope — paste it in the same way the frame id is pasted in. `library` for
// anything that resolved normally.
const mode = { icons: '<library|placeholder>', annotations: '<library|drawn>' };

let page = root;
while (page && page.type !== 'PAGE') page = page.parent;

const notes = new Map();
for (const t of page.findAllWithCriteria({ types: ['TEXT'] })) {
  if (!t.characters.includes('Proposed:')) continue;
  const fields = {};
  for (const line of t.characters.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (fields.Proposed) notes.set(fields.Proposed, fields);
}

// Recording what degraded is what keeps a drawn note or a placeholder icon from
// reading as a generation bug later.
const report = {
  library: 0,
  proposed: [],
  unresolved: [],
  degraded: Object.entries(mode)
    .filter(([, how]) => how !== 'library')
    .map(([what, how]) => `${what} — ${how}, library unreachable`),
  defects: [],
};
const ancestor = (n, test) => {
  for (let p = n.parent; p; p = p.parent) if (test(p)) return true;
  return false;
};
const inInstance = (n) => ancestor(n, (p) => p.type === 'INSTANCE');
const inProposed = (n) => ancestor(n, (p) =>
  (p.type === 'COMPONENT' || p.type === 'COMPONENT_SET') && p.name.startsWith('Proposed / '));

const localMains = new Map();

for (const inst of root.findAllWithCriteria({ types: ['INSTANCE'] })) {
  const main = await inst.getMainComponentAsync();
  if (!main) { report.defects.push(`${inst.name} — detached instance`); continue; }
  // `remote` true means it came from a published library, not this file.
  if (main.remote) { report.library++; continue; }
  const set = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
  if (!set.name.startsWith('Proposed / ')) {
    report.defects.push(`${inst.name} — local component "${set.name}", neither published nor proposed`);
    continue;
  }
  localMains.set(set.name, (localMains.get(set.name) || 0) + 1);
}

for (const [name, instances] of localMains) {
  const fields = notes.get(name.slice('Proposed / '.length));
  if (!fields) { report.defects.push(`${name} — no annotation note`); continue; }
  const missing = ['Extends', 'Derived', 'Tier'].filter((k) => !fields[k]);
  if (fields.Extends === 'none') { if (!fields.Case) missing.push('Case'); }
  else if (!fields.Delta) missing.push('Delta');
  if (fields.Tier && fields.Tier !== 'gap' && fields.Tier !== 'better-experience') {
    missing.push(`Tier (got "${fields.Tier}")`);
  }
  // An extension that says it derived from nothing did not derive.
  if (fields.Extends && fields.Extends !== 'none' && fields.Derived === 'none') {
    missing.push('Derived (extends a component but claims no derivation)');
  }
  if (missing.length) report.defects.push(`${name} — note missing ${missing.join(', ')}`);
  else report.proposed.push({ name, tier: fields.Tier, instances });
}

// Icons: the size is a different component, never a resize. `Caret-Left Icon ·
// Small` that is not 18×18 was scaled, and a scaled icon carries the stroke
// weight of the size it was drawn at.
const ICON_PX = { Tiny: 14, Small: 18, Medium: 28, Large: 32 };
for (const n of root.findAll((x) => / Icon · (Tiny|Small|Medium|Large)$/.test(x.name))) {
  const px = ICON_PX[n.name.split(' · ').pop()];
  if (Math.round(n.width) !== px || Math.round(n.height) !== px) {
    report.defects.push(
      `${n.name} — ${Math.round(n.width)}×${Math.round(n.height)}, should be ${px}×${px}; ` +
        `swap the size variant instead of resizing`,
    );
  }
}

// Declared gaps. Reported, never failed — the rule is that a gap is stated.
for (const n of root.findAll((x) => x.name.startsWith('Placeholder / '))) {
  report.unresolved.push({ name: n.name, width: Math.round(n.width), height: Math.round(n.height) });
}

// Proposals must keep the type ramp and the token geometry of what they extend.
// This is the drift that a rebuilt-from-scratch proposal shows first and that no
// screenshot contradicts.
for (const name of localMains.keys()) {
  const def = page.findOne((n) =>
    (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === name);
  if (!def) continue;
  for (const t of def.findAllWithCriteria({ types: ['TEXT'] })) {
    if (inInstance(t)) continue;               // the library owns nested instances
    if (t.textStyleId === '' || t.textStyleId === figma.mixed) {
      report.defects.push(`${name} / ${t.name} — raw font settings, not a published text style`);
    }
  }
  for (const n of [def, ...def.findAllWithCriteria({ types: ['FRAME'] })]) {
    if (inInstance(n)) continue;
    const bound = n.boundVariables ?? {};
    for (const prop of ['topLeftRadius', 'paddingLeft', 'paddingTop', 'itemSpacing']) {
      if (n[prop] > 0 && !bound[prop]) {
        report.defects.push(`${name} / ${n.name} — ${prop} ${n[prop]} is a literal, not a bound token`);
      }
    }
  }
}

// Lookalikes: shapes styled like components instead of being instances. A drawn
// annotation is exempt: it is a sanctioned stand-in for a library component, and
// a `Pointers · Number` stand-in is a 24px circle by definition.
const DRAWN = /^Annotations \(drawn\) \//;
const inDrawnAnnotation = (n) => DRAWN.test(n.name) || ancestor(n, (p) => DRAWN.test(p.name));

for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE'] })) {
  const r = typeof n.cornerRadius === 'number' ? n.cornerRadius : 0;
  if (!inInstance(n) && !inProposed(n) && !inDrawnAnnotation(n) && r >= 100) {
    report.defects.push(`${n.name} — pill-shaped ${n.type}, not an instance`);
  }
}

// Literal fills that should have been variable bindings.
const unbound = new Set();
for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE', 'TEXT'] })) {
  const fills = n.fills;
  if (!Array.isArray(fills) || inInstance(n)) continue;   // figma.mixed on multi-style text
  for (const f of fills) {
    if (f.type === 'SOLID' && !(f.boundVariables && f.boundVariables.color)) {
      unbound.add(`${n.name} — literal fill, not a variable binding`);
      break;
    }
  }
}
for (const d of unbound) report.defects.push(d);

// Annotations must be readable, which means nothing may cover anything. Only the
// outermost annotation of each nest is compared: anything inside one is laid out
// by an auto-layout parent, cannot collide, and would register as overlapping the
// parent that contains it.
//
// Drawn stand-ins are FRAMEs rather than INSTANCEs, and an earlier version of
// this query filtered on INSTANCE alone — which would have made a fallback note
// invisible to the one check that exists to stop notes stacking up. Match on the
// name and accept either type.
const ANNOTATION = /^(Annotations|Capstones|Sticky Note)/;
const annotations = page.findAll((n) =>
  (n.type === 'INSTANCE' || n.type === 'FRAME') && ANNOTATION.test(n.name));
// Dropping anything with an annotation ancestor covers a drawn note's own
// children — `Annotations (drawn) / …` matches this pattern too — without a
// separate rule for them.
const notesOnPage = annotations.filter((n) =>
  !inInstance(n) && !ancestor(n, (p) => annotations.includes(p)));
const hits = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (let i = 0; i < notesOnPage.length; i++) {
  const a = notesOnPage[i].absoluteBoundingBox;
  if (!a) continue;
  for (let j = i + 1; j < notesOnPage.length; j++) {
    const b = notesOnPage[j].absoluteBoundingBox;
    if (b && hits(a, b)) {
      report.defects.push(`${notesOnPage[i].name} overlaps ${notesOnPage[j].name}`);
    }
  }
  // A pointer belongs on the design; nothing else does. Drawn or instanced, the
  // number dot sits on the element it numbers.
  const box = root.absoluteBoundingBox;
  const isPointer = /^Annotations( \(drawn\))? \/ Pointers/.test(notesOnPage[i].name);
  if (box && hits(a, box) && !isPointer) {
    report.defects.push(`${notesOnPage[i].name} overlaps the design frame`);
  }
}

report.ok = report.defects.length === 0;
return report;
```

## Why each check is there

Nodes inside an instance are skipped by both shape checks: their styling belongs
to the library, and overriding it is already forbidden. Nodes inside a
`Proposed / …` definition are exempt from the lookalike check — drawn shapes are
how a component gets built — but not from the fill check, because a proposal
built on literals cannot converge on a real component later. An
`Annotations (drawn) / …` frame is exempt from the same check for the same kind of
reason, and likewise not from the fill check: a stand-in for a library component
still binds its fills.

Any pill-shaped frame outside those three cases is the exact bug this page exists
to prevent: something that looks like a Pushpin component and isn't one.

**A `Proposed /` component with no note is a defect, and so is a note without a
`Tier` or a `Derived`.** Without that rule the annotation requirement is
satisfiable with an empty sticky — the component exists, something is placed
next to it, and the reviewer still cannot tell what is being proposed or which
of the two arguments they are being asked to accept. The note is the entire
reason local components are allowed at all; a proposal nobody argued for is an
off-system element with better naming.

**The derivation checks are the ones that catch drift.** A proposal built from
scratch passes every structural check in the older version of this audit — it is
a real component, it has a note, nothing about it is a lookalike — and is still
wrong, because its type is raw font settings rather than a text style and its
padding is a round number rather than a bound token. Those two checks are cheap
and they are exactly the difference between "Chip plus a count badge" and
"something Chip-shaped". A proposal that derived properly passes them without
trying, because the detached instance arrives with all of it already correct.

The icon check is the same idea one level down. `Caret-Left Icon · Small` that
measures 32×32 is a Large that someone scaled, and a screenshot cannot tell you
that — the stroke is wrong by an amount nobody notices until the whole screen
looks slightly off.

The fill check has legitimate exceptions — a photograph, a scrim built by hand.
Bind what can be bound, and name the rest in the handoff. Silently ignoring the
bucket defeats it.

## What a real run returns

A mobile screen with a TextInput, two Buttons, and a card:

```
{ library: 5, proposed: [], unresolved: [], degraded: [], defects: [], ok: true }
```

Five instances resolved to remote main components (three placed directly, two
nested inside them), nothing was drawn by hand, every icon is at its own size,
and every fill on the hand-built containers was variable-bound.

The same screen generated by an account that reaches Pushpin and nothing else
returns `ok: true` as well, and says what it cost:

```
{
  library: 5,
  proposed: [],
  unresolved: [{ name: 'Placeholder / icon · Small', width: 18, height: 18 }],
  degraded: [
    'icons — placeholder, library unreachable',
    'annotations — drawn, library unreachable',
  ],
  defects: [],
  ok: true,
}
```

That is a worse screen than the first one and it is a screen. `ok: true` means
nothing structural is wrong with what was built, not that nothing is missing —
the two non-empty buckets are the report, and they are the part to lead with when
handing it over.

## Custom work that is not a proposal

Not everything the kit leaves out is a missing component. One-off layout — a
marketing hero, a section rhythm, an empty state used exactly once — is
composition rather than componentry, and it needs no proposal and no note. Build
it with auto-layout containers and bind every fill, radius, and gap to library
variables. The audit holds it to that and to nothing else.

The test is reuse. If the thing would be instanced again on another screen and
would need variants to do it, it is a component and belongs behind the gate. If
it exists once and always will, it is layout.

Separately, ten Pushpin components are published in Figma with no React
implementation — see [components.md](components.md). That is a handoff problem
rather than a generation one. When a screen leans on one of them, say so
explicitly. The value of "this part has no component in code yet" is high, and
the cost of discovering it late is higher.

# Auditing a Figma frame

The check that catches the failure [generate.md](generate.md) is about: work that
looks right in a screenshot and is structurally fake. Run it on a frame this
plugin generated before handing anything over, and on any existing frame when
the question is whether it is on-system.

It is a `use_figma` script rather than a shell command, because nearly all of
what it inspects lives in the Figma document. Two things do not: the keys
Pushpin publishes and the rules its copy is held against are files rather than
properties of a node, so the run ends in shell commands — argued below rather
than assumed.

## What it sorts into

Seven buckets:

- **Library** — the keys the frame's own instances resolved to. `remote` says an
  instance came from a published library and not which one, so the `use_figma`
  call gathers the keys and a shell command holds them against the catalogs:
  this bucket carries keys until the second step has run and a count after it.
- **Proposed** — local components named `Proposed / …` that have a parseable
  note on the page.
- **Unresolved** — placeholders standing in for something the system could not
  supply.
- **Degraded** — which libraries the preflight could not reach, and what was
  substituted for them.
- **Drift** — spacing values that were off the scale and were snapped onto it,
  read back from the plugin data generation left on each node. One entry per
  property that moved, so a frame that snapped on two sides appears twice.
- **Copy** — the words the frame owns, held against the content design rules.
  The `use_figma` call gathers them and a shell command settles them, so this
  bucket holds strings until the second step has run and findings after it.
- **Defects** — detached instances, lookalikes, undeclared local components,
  instances resolved from a key no Pushpin catalog publishes, literal fills,
  unbound spacing and radius, resized icons, nodes left shimmering, drift that
  no `Token drift` note discloses, drift recorded in a form this cannot read,
  `Proposed /` components whose note is missing or incomplete or whose type and
  geometry drifted from the component they claim to extend, overlapping
  annotations, and copy that breaks a rule the rubric calls critical.

The run fails on defects only. A populated `proposed`, `unresolved`, `degraded`,
`drift`, or `copy` bucket is a result to report, not a failure — this is a
`use_figma` script, so "exit non-zero" means `report.ok === false`: do not hand
the frame over, and do not offer the finalize pass.

`unresolved` does not fail for the same reason `proposed` does not: both are
the honest outcome of a gap in the system, and failing on them would push the
next run back toward hiding the gap. What fails is hiding it. `degraded` is the
same bargain one level up — the gap is in what this account can reach rather than
in what the system publishes, and failing on it would only bring back the
stop-on-anything behaviour it replaced. `drift` is not that bargain: the value
was snapped onto the scale and bound before the audit ever ran, so there is
nothing left to fail on. What can still be wrong is that it went unmentioned.

`copy` is the one bucket that divides by tier rather than by kind, because the
rules it reads already do. A major is a sentence that would read better —
passive voice, title case, a label three words over its limit — and stopping a
handoff over one would be this audit deciding a question the person receiving
the frame is better placed to decide with the words in front of them. A critical
is not that: the forbidden list is short, none of it is a matter of taste, and a
frame this plugin generated wrote those words itself. So a critical goes to
`defects` and the frame does not hand over, and everything else reports.

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
  library: [],
  proposed: [],
  unresolved: [],
  degraded: Object.entries(mode)
    .filter(([, how]) => how !== 'library')
    .map(([what, how]) => `${what} — ${how}, library unreachable`),
  drift: [],
  copy: [],
  defects: [],
};
const ancestor = (n, test) => {
  for (let p = n.parent; p; p = p.parent) if (test(p)) return true;
  return false;
};
// The nearest one rather than any one: a Button inside a Card is governed by
// Button's copy limit, which is the tighter of the two and the one that is
// about the words in front of you.
const enclosingInstance = (n) => {
  for (let p = n.parent; p; p = p.parent) if (p.type === 'INSTANCE') return p;
  return null;
};
const inInstance = (n) => enclosingInstance(n) !== null;
// A slot is published so the caller can fill it, which inverts every other
// instance interior: what sits in one is this run's work, not the library's.
// Stops at the enclosing INSTANCE for the reason `enclosingInstance` takes the
// nearest — a Button placed in a slot still owns its own interior.
const inSlotContent = (n) => {
  for (let p = n.parent; p; p = p.parent) {
    if (p.type === 'SLOT') return true;
    if (p.type === 'INSTANCE') return false;
  }
  return false;
};
const inProposed = (n) => ancestor(n, (p) =>
  (p.type === 'COMPONENT' || p.type === 'COMPONENT_SET') && p.name.startsWith('Proposed / '));

// Every gap, pad, and corner a container can carry. All four corners rather than
// `topLeftRadius` alone, and both sides of each axis, because a value bound on
// one side and literal on the other is the state that reads as bound.
//
// `0` is exempt: there is no zero step on the spacing scale, and zero padding is
// a decision rather than a number someone forgot to bind. `counterAxisSpacing`
// is the distance between wrapped rows and only means anything under
// `layoutWrap === 'WRAP'`; checked on anything else it reports a value no
// binding could apply to.
const SPACING = [
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing',
  'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
];
const literalSpacing = (n, label) => {
  const bound = n.boundVariables ?? {};
  const props = n.layoutWrap === 'WRAP' ? [...SPACING, 'counterAxisSpacing'] : SPACING;
  for (const prop of props) {
    if (n[prop] > 0 && !bound[prop]) {
      report.defects.push(`${label} — ${prop} ${n[prop]} is a literal, not a bound token`);
    }
  }
};

// Generation writes this as it snaps. Reading it back off the node means the
// record survives the parallel fill lanes, which no lane's return value does.
// A list rather than one record, because a node is bound property by property
// and a single object would keep only the last property to move — which would
// under-report the frame that drifted most. Guarded because this script is
// atomic too: an unreadable record is worth a defect, not the loss of every
// other check on the frame. The namespace matches what generate.md writes with;
// plain plugin data is not reachable from this runtime.
const collectDrift = (n) => {
  const snaps = n.getSharedPluginData('pushpin', 'drift');
  if (!snaps) return;
  let records;
  try { records = JSON.parse(snaps); } catch { records = null; }
  if (!Array.isArray(records)) {
    report.defects.push(`${n.name} — drift record is unreadable`);
    return;
  }
  for (const d of records) report.drift.push({ node: n.name, ...d });
};

const localMains = new Map();
const componentOf = new Map();
// Keyed on the key, so four Buttons cost one entry in the deck below.
const placed = new Map();

// The icon catalog is keyed on the glyph and holds a key per size —
// `Caret-Left`, not `Caret-Left Icon · Small` — so the suffix comes off before
// the name goes into a lookup. Everything else is catalogued under the name it
// carries. This is what keeps the settle step below a list of names a catalog
// can answer rather than a list to translate by hand.
const ICON_SIZE = / Icon · (Tiny|Small|Medium|Large)$/;
const catalogName = (name) => name.replace(ICON_SIZE, '');

// One round of awaits for the whole frame rather than one per instance, which on
// a thirty-instance screen is thirty sequential waits inside the script. Zipped
// back against `instanceNodes` by index, so the defects below come out in the
// order a serial loop produced them.
const instanceNodes = root.findAllWithCriteria({ types: ['INSTANCE'] });
const mains = await Promise.all(instanceNodes.map((inst) => inst.getMainComponentAsync()));

for (let i = 0; i < instanceNodes.length; i++) {
  const inst = instanceNodes[i];
  const main = mains[i];
  if (!main) { report.defects.push(`${inst.name} — detached instance`); continue; }
  // A variant's own name is its property list, so the set is what the catalog
  // and the copy map both know it by. Recorded before the remote check rather
  // than after it, because the published components are precisely the ones the
  // copy rules carry a length limit for.
  const set = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
  componentOf.set(inst.id, set.name);
  // `remote` true means it came from a published library, not this file — and
  // not which library, which every published one answers the same way. The key
  // is the part that differs, so it is gathered here and settled below. The
  // set's key rather than the main's: the catalogs record a set under the key
  // `importComponentSetByKeyAsync` takes, and a variant's own key is in none of
  // them.
  //
  // Only what this frame placed is asked about. An instance inside another one
  // is that component's interior, published under names no public catalog
  // carries — `Icon / Left` and `Avatar initials` are parts of Button and
  // Avatar — so asking would report every component that nests anything. Slot
  // content is the exception the fill and spacing checks already carve out,
  // because the caller put it there.
  if (main.remote) {
    if (!inInstance(inst) || inSlotContent(inst)) {
      const prior = placed.get(set.key);
      if (prior) prior.count++;
      else placed.set(set.key, { component: catalogName(set.name), key: set.key, count: 1 });
    }
    continue;
  }
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

// `findAll` does not include the node it is called on, so the frame itself is
// checked here. A whole frame left shimmering is the case where no fill call
// landed at all.
if (root.placeholder === true) {
  report.defects.push(`${root.name} — still shimmering, placeholder was never cleared`);
}

// Three per-node checks over one walk, because every `findAll` is a full
// pre-order traversal of the frame.
const ICON_PX = { Tiny: 14, Small: 18, Medium: 28, Large: 32 };
for (const n of root.findAll(
  (x) => ICON_SIZE.test(x.name) || x.name.startsWith('Placeholder / ') || x.placeholder === true,
)) {
  // Icons: the size is a different component, never a resize. `Caret-Left Icon ·
  // Small` that is not 18×18 was scaled, and a scaled icon carries the stroke
  // weight of the size it was drawn at.
  if (ICON_SIZE.test(n.name)) {
    const px = ICON_PX[n.name.split(' · ').pop()];
    if (Math.round(n.width) !== px || Math.round(n.height) !== px) {
      report.defects.push(
        `${n.name} — ${Math.round(n.width)}×${Math.round(n.height)}, should be ${px}×${px}; ` +
          `swap the size variant instead of resizing`,
      );
    }
  }

  // Declared gaps. Reported, never failed — the rule is that a gap is stated.
  if (n.name.startsWith('Placeholder / ')) {
    report.unresolved.push({ name: n.name, width: Math.round(n.width), height: Math.round(n.height) });
  }

  // The shimmer overlay, which is a different thing from the `Placeholder / …`
  // name above and a defect rather than a declared gap. `=== true` rather than
  // truthiness, so a node that does not carry the property cannot invent one.
  if (n.placeholder === true) {
    report.defects.push(`${n.name} — still shimmering, placeholder was never cleared`);
  }
}

// One indexed pass over the page, keyed by name, replaces a `findOne` per
// proposal. `findOne` returns the first match in pre-order and
// `findAllWithCriteria` walks in that same order, so the first occurrence of a
// name is the node `findOne` would have returned — never overwrite it.
const defs = new Map();
for (const d of page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })) {
  if (!defs.has(d.name)) defs.set(d.name, d);
}

// Proposals must keep the type ramp and the token geometry of what they extend.
// This is what a rebuilt-from-scratch proposal gets wrong first and what no
// screenshot contradicts.
for (const name of localMains.keys()) {
  const def = defs.get(name);
  if (!def) continue;
  for (const t of def.findAllWithCriteria({ types: ['TEXT'] })) {
    if (inInstance(t) && !inSlotContent(t)) continue;   // the library owns nested instances
    if (t.textStyleId === '' || t.textStyleId === figma.mixed) {
      report.defects.push(`${name} / ${t.name} — raw font settings, not a published text style`);
    }
  }
  // The definitions sit on the page rather than inside the frame, so the walk
  // over `root` below does not reach them. Same check, second entry point.
  for (const n of [def, ...def.findAllWithCriteria({ types: ['FRAME'] })]) {
    if (inInstance(n) && !inSlotContent(n)) continue;
    literalSpacing(n, `${name} / ${n.name}`);
  }
}

// Lookalikes: shapes styled like components instead of being instances. A drawn
// annotation is exempt: it is a sanctioned stand-in for a library component, and
// a `Pointers · Number` stand-in is a 24px circle by definition.
const DRAWN = /^Annotations \(drawn\) \//;
const inDrawnAnnotation = (n) => DRAWN.test(n.name) || ancestor(n, (p) => DRAWN.test(p.name));

for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE'] })) {
  const r = typeof n.cornerRadius === 'number' ? n.cornerRadius : 0;
  if ((!inInstance(n) || inSlotContent(n)) && !inProposed(n) && !inDrawnAnnotation(n) && r >= 100) {
    report.defects.push(`${n.name} — pill-shaped ${n.type}, not an instance`);
  }
}

// `findAllWithCriteria` does not include the node it is called on, and the frame
// itself is the container most likely to carry padding — so it is also the one
// most likely to have snapped, and its record would go uncollected by a walk
// that starts at its children.
literalSpacing(root, root.name);
collectDrift(root);

// Literal fills, literal spacing, and recorded drift, over one walk. All three
// skip nodes inside an instance for the same reason: the library owns that
// styling, so flagging it would fail every screen that placed a component. Slot
// content is the exception the same reason carves out — the caller supplies it,
// so it is this run's layout and is held to the standard the rest of the frame
// is. A raw hex or an unbound gap inside a Modal's `children` is not the
// library's to answer for.
const unbound = new Set();
for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE', 'TEXT'] })) {
  if (inInstance(n) && !inSlotContent(n)) continue;

  collectDrift(n);
  literalSpacing(n, n.name);

  const fills = n.fills;
  if (!Array.isArray(fills)) continue;                    // figma.mixed on multi-style text
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
// name and accept either type: the indexed type lookup narrows to both types, the
// name test does the rest, and the pre-order is the same as that of the predicate
// walk this replaces.
//
// `Token drift` is in the pattern because that note is a `Dev Note` renamed off
// the kit's own naming, and a name the pattern misses is a note free to sit on
// the design. Its drawn stand-in is `Annotations (drawn) / Token drift`, which
// the first alternative already covers.
const ANNOTATION = /^(Annotations|Capstones|Sticky Note|Token drift)/;
const annotations = page
  .findAllWithCriteria({ types: ['INSTANCE', 'FRAME'] })
  .filter((n) => ANNOTATION.test(n.name));
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

// A snap that was corrected and disclosed is a result. A snap that was corrected
// silently is a design whose spacing is not the spacing anyone asked for, with
// nothing on the canvas saying so.
//
// Either name discloses it: the instance is `Token drift`, and the drawn
// stand-in carries the `Annotations (drawn) / ` prefix every other stand-in
// carries. Requiring the bare name would have made the fallback undisclosable.
const DRIFT_NOTE = /^(Annotations \(drawn\) \/ )?Token drift$/;
if (report.drift.length && !annotations.some((n) => DRIFT_NOTE.test(n.name))) {
  report.defects.push(
    `${report.drift.length} snapped value${report.drift.length === 1 ? '' : 's'} recorded, ` +
      `no Token drift note on the page`,
  );
}

// Copy is gathered here and judged in Node. The rules are a generated file,
// this runtime has no filesystem, and the only way to decide them inside Figma
// is to keep a second copy of them in this script — the one move provenance.md
// says has never once survived contact with the source it restates. So the walk
// collects the words and what carries them, and "Settling the copy bucket"
// below finishes the run.
//
// Annotations are exempt whichever form they took: a note to a reviewer and a
// pointer number are not the product's words. A `Placeholder / …` stand-in is
// exempt for a nearer reason — its label belongs to the component the run
// already reports as missing under `unresolved`.
const notCopy = (n) =>
  ANNOTATION.test(n.name) ||
  n.name.startsWith('Placeholder / ') ||
  ancestor(n, (p) => ANNOTATION.test(p.name) || p.name.startsWith('Placeholder / '));

// Which words on the frame are the frame's own. A plain text layer inside an
// instance belongs to the library until this frame overrode it: flagging what
// it left alone would fail every screen that placed a component, over copy no
// one here is permitted to edit anyway — the same call the fill and spacing
// checks make one level up. A text property is the other way round. It is a
// slot the component published in order to be filled, so whatever sits in it is
// this screen's copy, and a label still reading the main's placeholder is a
// copy bug rather than the library's. A literal `SLOT` node is the third case
// and the same argument settles it: the component published an opening for
// content it does not supply, so the words that arrive in one are this
// screen's.
const overridden = new Set();
for (const inst of instanceNodes) {
  for (const o of inst.overrides ?? []) {
    if (o.overriddenFields.includes('characters')) overridden.add(o.id);
  }
}

// Keyed on what the engine will be handed rather than on where it came from, so
// two buttons reading `Get estimates` cost one scan and report as one entry
// that says it happened twice. A text property and the layer it fills carry the
// same name, so an instance reached down both paths collapses here instead of
// answering for the same words twice.
const copy = new Map();
const gather = (node, component, text) => {
  if (typeof text !== 'string' || !text.trim()) return;
  const key = `${component}\u0000${node}\u0000${text}`;
  const prior = copy.get(key);
  if (prior) prior.count++;
  else copy.set(key, { node, component, text, count: 1 });
};

for (let i = 0; i < instanceNodes.length; i++) {
  const inst = instanceNodes[i];
  if (!mains[i] || notCopy(inst)) continue;
  // A property name carries a `#` and a unique id, which is Figma's plumbing
  // and not something the rules or a reader want to see. A value bound to a
  // variable arrives as an alias rather than a string, and `gather` takes only
  // strings — there is nothing to check in a reference to text held elsewhere.
  for (const [prop, value] of Object.entries(inst.componentProperties)) {
    if (value.type === 'TEXT') {
      gather(prop.split('#')[0], componentOf.get(inst.id) ?? null, value.value);
    }
  }
}

for (const t of root.findAllWithCriteria({ types: ['TEXT'] })) {
  if (notCopy(t)) continue;
  // Slot content is neither of the two paths this loop was written for: it was
  // appended rather than inherited, so it can never appear in `overrides` and
  // the override test would drop it. It answers to no component either — a slot
  // publishes no limit for what the caller puts in it — so it is gathered the
  // way an unenclosed heading is.
  const inst = inSlotContent(t) ? null : enclosingInstance(t);
  if (inst && !overridden.has(t.id)) continue;
  // No enclosing instance means no length to check and every other rule still
  // applying: a heading is a text node on the type ramp rather than a
  // component, so nothing in the document says which row of the rules it is.
  gather(t.name, inst ? componentOf.get(inst.id) ?? null : null, t.characters);
}

report.copy = [...copy.values()];
report.library = [...placed.values()];

// Two buckets leave here as raw material, so this call does not pretend to
// settle either. Reporting the structural verdict as the verdict would hand
// anything that stopped reading at this return an `ok: true` that no one
// checked the keys or the words for, and the whole point of a copy critical or
// a key from another library failing a run is that it fails the run.
const pending = ['library', 'copy'].filter((b) => report[b].length);
if (pending.length) {
  report.pending = pending;
  return report;
}

report.ok = report.defects.length === 0;
// The verdict is settled by everything above before the picture exists, and the
// picture is taken only once the structure passed — a screenshot sitting beside a
// defect list is an invitation to argue with the list.
if (report.ok) await root.screenshot();
return report;
```

## Settling the library bucket

`remote` is a boolean. It says an instance resolved to a published component and
nothing about which library published it, so a frame built on the kit Pushpin
replaced answers it exactly as a frame built on Pushpin does. That is how a real
run reported `library: 21` on a frame where 12 of the 21 came from the older
library: the check confirmed the instance resolved and never asked to what.

The keys are where the two differ, and the keys Pushpin publishes are already
here — 117 components in `assets/components.figma.json`, 899 icon keys in
`icons.figma.json`, 91 Annotation Kit entries in `annotations.figma.json`. Those
are files, so this bucket splits the way copy does and for the reason argued
below: pasting a thousand keys into the script is the restatement
[provenance.md](provenance.md) keeps the record of, and it would go stale on the
next capture.

`lookup.mjs` reads all three catalogs, so one call takes every name the script
gathered:

```
node scripts/lookup.mjs --json --component --icon --annotation Button,TextInput,ServiceCard,Caret-Right
```

Then settle each entry on its key rather than on its name, because the name is
the part a lookalike gets right:

- An entry whose recorded `key` is among the keys its name came back with is
  Pushpin's. A component or annotation entry carries one `key` and an icon entry
  one per size, and a name that resolves to several entries — `Home` is
  published in two categories — settles on any of them, which is why the test is
  membership rather than a match on the name.
- Anything else is a defect, phrased the way the rest of them are:
  `Button — resolved from a library, key 8f3c… is in no Pushpin catalog`. A
  component published by the library Pushpin replaced lands here, and so does an
  internal part instanced directly; both are answered by instancing the
  catalogued component instead.
- `library` becomes the total of the counts that settled, so the number in the
  report is one something was checked for.

`ok` waits for both buckets; the copy step below settles it.

## Settling the copy bucket

The rules the copy is held to live in `assets/copy.json`, built from the
vendored content design source and never hand-edited. A `use_figma` script
cannot read a file, so there were two ways to check copy on a frame: paste a
distilled ruleset into the script above, or gather the words there and decide
them where the rules already are.

The paste loses. Every hand-maintained restatement of a generated source this
repo has gone looking for has drifted from it — [provenance.md](provenance.md)
keeps the list, and it is the reason `build-css.mjs --check` exists — and a rule
block inside a markdown fence has nothing equivalent holding it in step. A
generated block would fix the drift and buy a new problem: several hundred
banned phrases, forbidden words, preferred terms and length limits pasted into a
call that already asks the caller to paste a frame id, going stale the moment
someone copies the script into a chat. What is actually lost by splitting is
atomicity, and this call gave that up before copy existed — the `mode` object at
the top is a prior call's result carried in by hand. A second step that carries
machine output into a machine is the same shape as the step already there, and
carries no restatement at all.

So the script gathers and `copy.mjs` decides. Write `report.copy` out as a
labelled deck, one line per entry — `[component]` when the text sits in one,
`[node]` when it does not, then the words — and run it in one call:

```
node scripts/copy.mjs --json <<'EOF'
[Button] Get estimates
[Button] See how it works
[TextInput] ZIP code
[Header] Find a pro for any project
EOF
```

The label is how the text reaches its rule: a catalog name resolves through
`copy-map.json` — `TextInput` to placeholder and helper text — and a layer named
`Header` resolves to the header rule directly, which is the only thing on a
frame that says what an unenclosed text node is. Blocks come back in the order
the deck was written, so `blocks[i]` is `copy[i]`, and a layer whose name the
label grammar will not take goes through on its own with `--text`.

Then fold the findings back in:

- A `critical` becomes a defect, phrased the way the rest of them are:
  `Button / Label — "guaranteed" is on the forbidden list`.
- Everything else replaces its entry in `copy`, keeping `node`, `component` and
  `text` and adding the finding's `code` and `message`.
- `ok` is `defects.length === 0`, the rule it has always been.
- A run that passed takes its picture, in a call of its own, because the picture
  still waits for the whole verdict rather than most of it:

```js
const root = await figma.getNodeByIdAsync('<generated frame id>');
await root.screenshot();
```

`notes` in that output names every entry whose length went unmeasured, which is
what a rule that limits its parts separately leaves behind: `Toast` limits a
header and a body, and a text node says which of them it is only when its layer
is named for one. Re-run those with the slot in the label — `[Toast body]` — and
if the frame cannot say, the length is genuinely unknown and belongs in the
handoff rather than in a guess.

## Why each check is there

Nodes inside an instance are skipped by both shape checks: their styling belongs
to the library, and overriding it is already forbidden. Content inside a `SLOT`
is not skipped, because the slot is the library saying it does not own what goes
there. Without that exemption a drawn pill, a raw hex, or an unbound gap passes
clean as long as it sits inside a Modal — which is the one place a frame is
invited to put its own layout inside a component. Nodes inside a
`Proposed / …` definition are exempt from the lookalike check — drawn shapes are
how a component gets built — but not from the fill check, because a proposal
built on literals cannot converge on a real component later. An
`Annotations (drawn) / …` frame is exempt from the same check for the same kind of
reason, and likewise not from the fill check: a stand-in for a library component
still binds its fills.

Any pill-shaped frame outside those three cases is the exact bug this page exists
to prevent: something that looks like a Pushpin component and isn't one.

**An instance that resolved is not an instance that resolved to Pushpin.** Every
library a file has enabled answers `remote` the same way, and a Thumbtack file
has the kit Pushpin replaced enabled beside it — which is how a frame reported
`library: 21` with 12 of the 21 being components nobody should place again. It
read as fully on-system because the count was of instances that resolved, not
of instances that resolved to Pushpin — the drawn-pill defect arriving by the
one route no shape check looks down. The key tells the two apart, which is why
this check ends in a shell command the way copy does.

**A `Proposed /` component with no note is a defect, and so is a note without a
`Tier` or a `Derived`.** Without that rule the annotation requirement is
satisfiable with an empty sticky — the component exists, something is placed
next to it, and the reviewer still cannot tell what is being proposed or which
of the two arguments they are being asked to accept. The note is the entire
reason local components are allowed at all; a proposal nobody argued for is an
off-system element with better naming.

**The derivation checks are the ones that catch a rebuild.** A proposal built
from scratch passes every structural check in the older version of this audit —
it is a real component, it has a note, nothing about it is a lookalike — and is
still wrong, because its type is raw font settings rather than a text style and
its padding is a round number rather than a bound token. Those two checks are
cheap and they are exactly the difference between "Chip plus a count badge" and
"something Chip-shaped". A proposal that derived properly passes them without
trying, because the detached instance arrives with all of it already correct.

The icon check is the same idea one level down. `Caret-Left Icon · Small` that
measures 32×32 is a Large that someone scaled, and a screenshot cannot tell you
that — the stroke is wrong by an amount nobody notices until the whole screen
looks slightly off.

The fill check has legitimate exceptions — a photograph, a scrim built by hand.
Bind what can be bound, and name the rest in the handoff. Silently ignoring the
bucket defeats it.

**Spacing is held to the same standard as fills, everywhere rather than only
inside proposals.** A padding of 24 that happens to equal the token is
indistinguishable from the token in a screenshot and stops equalling it the first
time the scale moves — and one-off layout, which needs no proposal and no note,
is exactly where that goes unnoticed. This is the check that makes "bind every
fill, radius, and gap" a rule rather than an intention.

**Drift is the record of a value that was not on the scale.** Generation snaps to
the nearest step and appends what it moved to a list on the node, so the audit
reads the file rather than trusting what a fill lane remembered — and a frame
that moved on its padding and its gap reports both rather than whichever was
bound last. The snap itself is not a defect: it is already corrected and the
binding is real. The defect is silence. A `Token drift` note is the only place
the person receiving the design learns that the 80 in the brief is a 96 on the
canvas, and a correction nobody was told about is the one way a spacing scale
gets quietly renegotiated.

**A node still carrying its shimmer is a section nothing ever wrote to.** The
skeleton sets `placeholder = true` on every section before any content exists and
each fill clears its own as it finishes. A fill that failed executes nothing at
all, so the section it was handed is left exactly as the skeleton made it: empty,
and still shimmering. Every other check here passes on that frame — the sections
that did land are on-system, and the one that did not raises no error and takes up
no space, so it reviews as finished for the same reason a dropped atom does. This
check is the only thing standing between that and a handoff. `placeholder` is
readable as well as settable, so the signal is the shimmer state itself rather
than something standing in for it. Do not confuse it with the `Placeholder / …`
naming convention: that is a gap someone declared on purpose and it belongs in
`unresolved`, while an uncleared shimmer is a claim of progress that never
happened.

**Copy is checked here because the frame is the last place anyone reads it.** By
review time the words on a screen have been looked at as shapes for long enough
to stop being words — a button reading `Submit Request` is furniture, and every
other check on this page passes on the frame carrying it. What that lets
through is a screen that is on-system in every respect and says something
Thumbtack does not say, and it survives handoff, because the markup is written
from the frame and the string arrives in code as a decision somebody already
made. On the canvas it costs a text edit. After the build it costs a
conversation with the person who designed it.

Copy inside an instance splits where the ownership splits, which is a finer line
than the shape and fill checks draw. Those take the whole interior of an
instance at once, slot content aside: a screen may not restyle a library
component, so a finding there is one nobody is allowed to act on. A label the frame left at the library's default is the same
kind of finding and is skipped for the same reason. The three ways a frame does
set copy are not — a text property is a slot the component published in order to
be filled, an overridden text layer is this frame typing into a component that
publishes no property, which is how `Link` carries its text, and a `SLOT` holds
content the frame built and appended itself. All three are the frame's words,
all three are checked, and everything else on the instance belongs to whoever
published it. Slot content answers to no component limit, so it is measured the
way an unenclosed heading is.

## What a real run returns

A mobile screen with a TextInput, two Buttons, and a card. The `use_figma` call
returns this:

```
{
  library: [
    { component: 'Button', key: 'ebc80753f095633977049c061a28a082816ef9c7', count: 2 },
    { component: 'TextInput', key: '522dbc457c6160fe2d2673326448ee3c16245519', count: 1 },
    { component: 'ServiceCard', key: 'a674487167b8b2f16e5eb55112cc4237068874ab', count: 1 },
  ],
  proposed: [],
  unresolved: [],
  degraded: [],
  drift: [],
  copy: [
    { node: 'Label', component: 'Button', text: 'Get estimates', count: 1 },
    { node: 'Label', component: 'Button', text: 'See how it works', count: 1 },
    { node: 'value', component: 'TextInput', text: 'ZIP code', count: 1 },
    { node: 'Header', component: null, text: 'Find a pro for any project', count: 1 },
  ],
  defects: [],
  pending: ['library', 'copy'],
}
```

There is no `ok` in that return and no picture, which is the point of `pending`:
three keys and four strings have been gathered and nothing has held either
against the file that decides it. They are the two decks in the sections above
and both run clean, so the settled report is the one to hand over:

```
{ library: 4, proposed: [], unresolved: [], degraded: [], drift: [], copy: [], defects: [], ok: true }
```

Four instances the frame placed resolved to keys the catalogs publish — what
sits inside them was not asked, because a component's interior belongs to
whoever published it — nothing was drawn by hand, every icon is at its own size,
every gap and corner asked for a value the scale already had, every fill on the
hand-built containers was variable-bound, and the four strings the frame owns
are inside their limits. A run that passes also returns the frame's picture,
which is where clipped text and overlap show up — the failures structure cannot
rule out.

The same screen generated by an account that reaches Pushpin and nothing else
settles to `ok: true` as well — its copy is the first run's copy and clears the
same way — and says what it cost:

```
{
  library: 4,
  proposed: [],
  unresolved: [{ name: 'Placeholder / icon · Small', width: 18, height: 18 }],
  degraded: [
    'icons — placeholder, library unreachable',
    'annotations — drawn, library unreachable',
  ],
  drift: [{ node: 'Hero', prop: 'itemSpacing', from: 80, to: 96, source: 'intent' }],
  copy: [],
  defects: [],
  ok: true,
}
```

That is a worse screen than the first one and it is a screen. `ok: true` means
nothing structural is wrong with what was built, not that nothing is missing —
the three non-empty buckets are the report, and they are the part to lead with
when handing it over. `drift` passed because the note is on the page — drawn,
in this run, so named `Annotations (drawn) / Token drift`, which discloses the
snap exactly as the instance would. The same run without that note is a defect
and does not hand over. Neither of the two things this run added reached the
deck: the placeholder icon carries no words, and a drawn `Token drift` note is a
note rather than product copy.

A third screen, structurally identical to the first, is where the bucket earns
its place:

```
{
  library: 4,
  proposed: [],
  unresolved: [],
  degraded: [],
  drift: [],
  copy: [
    {
      node: 'Header',
      component: null,
      text: 'Find The Right Pro',
      code: 'M1',
      message: 'title case on "Right", "Pro" — sentence case unless it is a confirmed brand name',
    },
  ],
  defects: ['Button / Label — "guaranteed" is on the forbidden list'],
  ok: false,
}
```

Nothing on that frame is off-system. Every instance resolved, every fill and gap
is bound, and a screenshot of it would look like the first screen. It does not
hand over, because one button promises something Thumbtack does not promise —
and the header, which is a major, is in the report the fix goes out with rather
than in the reason the run failed.

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

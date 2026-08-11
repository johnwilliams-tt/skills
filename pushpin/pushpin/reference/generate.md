# Generating Figma layouts

The goal is a layout built from **real instances of the published Pushpin
components**, bound to **real library variables** — not a drawing that resembles
one.

The distinction is invisible in a screenshot and obvious the moment anyone
touches the file. A drawn pill doesn't respond to a library update, doesn't
expose variant controls, doesn't appear in usage analytics, and hands a
developer a rounded rectangle where they expected `<Button theme="primary">`.
A generated file that looks right and is structurally fake is worse than an
obviously rough one, because nobody knows to check.

## The rule

**Never draw a component. Import and instance the published one — or, when the
kit genuinely falls short, define a real local component and argue for it on the
canvas.**

If `assets/components.figma.json` has an entry, use it. `figma.createFrame()`
with a corner radius is only ever correct for layout containers — never for
something the kit already publishes, and never as a quiet stand-in for something
it doesn't.

This rule used to have no exception: always import, and every local component
was a defect. That is too strict for a design system this young. It produces
awkward compositions of nearly-right components, and it buries the gap in a
layout instead of recording it where the design system owner can see it. **Strict
adherence to a developing system is itself a failure mode**, and the loosening
below is deliberate.

What did not loosen is the ban on lookalikes. A drawn pill that resembles a
Button is still a defect and always will be, because it is a claim about
structure that no screenshot can contradict. The exception below is a way to
declare a gap, not a way to draw one.

### The gate: two checks, in order

**Check one — the published-API gap.** No published component expresses the
interaction without lying about its API or breaking a hard Pushpin rule. A
missing variant, a missing property, a component being used for something its
name denies. Tier: `gap`.

**Check two — the better-experience case.** Something published could be
stretched to cover it, but a new component would be clearly better. Tier:
`better-experience`.

Both are legal. The tier is recorded because the two ask a reviewer to accept
different arguments — "you can't build this" versus "you shouldn't have to build
it this way" — and a reviewer who can't tell which one is being made can't
evaluate either.

Before creating a local component, **name the closest published component and
say why it falls short.** That sentence is the whole gate. If it can't be
written, the answer to check one is that a component does express it, and the
correct move is to import that component.

## Proposing a component

A proposal is a **real local component definition** named `Proposed / <Name>`,
with the variants and properties it would need if it were published. Two things
it is not:

- **A drawn lookalike.** A frame styled to resemble a component is a defect
  whether or not a note is placed beside it. Nothing in this exception makes
  drawing one legal.
- **A composition of published instances.** Three Buttons in a row is three
  Buttons in a row. Wrapping them in a frame and calling it a proposal makes the
  gap harder to find, not easier.

Build it the way the kit is built: bind every fill, radius, and gap to library
variables, use published text and effect styles for type and elevation, and
instance published components for the parts the kit already covers. A proposal
built that way converges on the real component if one ever lands; one built from
literals is just another thing to redo.

Name it exactly `Proposed / <Name>`, with the spaces around the slash — that is
the form the audit matches. `Proposed/FilterChip` and `[proposed] FilterChip`
read as undocumented local components and are reported as defects.

### Rationale on canvas

A proposal nobody argued for is indistinguishable from somebody going
off-system. Every proposal carries its case next to it, placed as **published
Annotation Kit instances** rather than drawn boxes — the same rule as everything
else on this page:

- A `Capstones` instance heading the proposal area.
- One `Annotations` note per proposal, `Multi-line` variant, beside the screen.
- An `Annotations / Pointers` instance aimed at the local instance the note is
  about, so a reviewer can tell which element is under discussion.
- A short summary frame listing every proposal on the screen.

The note body is key-value lines. It reads in the narrow 320px box and the audit
can parse it:

```
Proposed: FilterChip
Extends: Chip
Tier: better-experience
Delta: adds a count badge; Chip offers left/right icons only
```

An extension carries `Extends` and a one-line `Delta`. A net-new component
carries `Extends: none` and a real `Case:` block — the business argument for
adding it to the system, not a restatement of what it looks like.

[annotate.md](annotate.md) holds the annotation vocabulary: what each type is
for, the placement conventions, and what the promotion path into the kit
involves. Read it before placing anything, and read
`assets/annotations.figma.json` for the exact import keys and each property's
`key` field. The Annotation Kit has the same trap as Pushpin — names are exact,
and at least one published variant name is misspelled (`List Elelemt`) — so
never type one from memory.

After a push that introduces proposals, print the same fields as a markdown
summary in chat, so the case can be pasted into Slack or Coda. Nothing is
written to disk.

## Placing a component

Every entry in `assets/components.figma.json` carries the `key` needed to import
it, and its `type` decides which import call to use.

```js
// COMPONENT_SET — the common case. Button, TextInput, Checkbox, etc.
const set = await figma.importComponentSetByKeyAsync('ebc80753f095633977049c061a28a082816ef9c7');
const button = set.defaultVariant.createInstance();

// COMPONENT — no variants.
const comp = await figma.importComponentByKeyAsync('<key>');
const node = comp.createInstance();
```

Then configure it through its properties rather than by restyling it:

```js
button.setProperties({
  theme: 'primary',
  size: 'large',
  Label: 'Book now',
  isFullWidth: 'false',
});
```

Once placed, **do not override the instance's fills, radius, or type.** If it
looks wrong, the variant is wrong — fix the variant. Restyling an instance is
the same failure as drawing one, just harder to spot.

## Property names are exact

They are case-sensitive, space-sensitive, and several contain emoji. These are
not guessable, which is the reason the catalog exists. Button's real properties:

| Property | Type | Values |
|---|---|---|
| `theme` | VARIANT | `primary` `secondary` `tertiary` `subtle` `caution` `alert` `solid` `link` |
| `size` | VARIANT | `xlarge` `small` `medium` `large` `xxlarge` |
| `isFullWidth` | VARIANT | `false` `true` — strings, not booleans |
| `isDisabled` | VARIANT | `false` `true` |
| `isLoading` | VARIANT | `false` `true` |
| `State` | VARIANT | `default` `hover` `pressed` |
| `Platform` | VARIANT | `Native & Mobile` |
| `Label` | TEXT | |
| `👁️ icon (left)` | BOOLEAN | |
| `👁️ iconRight` | BOOLEAN | |
| `Icon Left` / `Icon Right` | INSTANCE_SWAP | |

Two traps live in that table.

**VARIANT properties take bare names; everything else takes a suffixed key.**
`theme` is `theme`, but `Label` is `Label#13326:0`. Passing the bare name for a
TEXT, BOOLEAN, or INSTANCE_SWAP property throws. The catalog stores the exact
string to use in each property's `key` field.

```js
button.setProperties({
  theme: 'primary',            // VARIANT — bare name
  size: 'large',
  isFullWidth: 'true',         // VARIANT boolean — the STRING 'true'
  'Label#13326:0': 'Get estimates',   // TEXT — suffixed key
});
```

**VARIANT booleans are strings** (`'true'` / `'false'`), while BOOLEAN
properties take real booleans. Mixing them throws.

**Not every variant combination exists.** Button exposes 8 × 5 × 2 × 2 × 2 × 3
combinations but publishes only 260 variants. Start from
`set.defaultVariant.createInstance()` and change a few properties, rather than
specifying every axis and hoping the combination was built.

Always read the component's entry in the catalog before setting properties.
Never set a property from memory.

## What you can and cannot bind

Not every token is reachable from another file. The library marks 168 of its 299
variables **hidden from publishing**, and importing one of those throws
`Variable with key "…" not found`.

| | Bindable | How |
|---|---|---|
| Semantic colours | 89 of 109 | `importVariableByKeyAsync` |
| Space, corner radius | all | `importVariableByKeyAsync` |
| Line height, letter spacing, font weight | all | `importVariableByKeyAsync` |
| Scrim, wrap | all | `importVariableByKeyAsync` |
| **Base colour ramps** | none of 90 | — use a semantic token |
| **Font sizes / line heights** | none of 39 | — use a **text style** |
| **Shadows** | none of 4 | — use an **effect style** |
| **Duration, easing, breakpoint, z-index** | none | — not available in Figma |
| **Colour interaction states** (`/hover`, `/pressed`) | none of 20 | — baked into component variants |

This is deliberate rather than an oversight, and it enforces in Figma exactly
what [tokens.md](tokens.md) advises in code: reach for the semantic layer, not
the primitives. The consequence for generation is that **type and elevation come
from published styles, not variables.**

`assets/variable-keys.figma.json` lists both sets, so check there before writing
an import. `assets/styles.figma.json` has the 13 text styles and 6 effect
styles.

## Applying type and elevation

```js
const title2 = await figma.importStyleByKeyAsync('c22f9ef014b478e395a0f659ea00c93e01ee4a10');
const text = figma.createText();
parent.appendChild(text);              // append BEFORE styling
await text.setTextStyleIdAsync(title2.id);
text.characters = 'Find a pro';

const shadow200 = await figma.importStyleByKeyAsync('110e8ce03217f0a7f8e1ee59676b21992f07c61c');
await card.setEffectStyleIdAsync(shadow200.id);
```

Load the font families first — `Thumbtack Rise` in `Regular`, `Medium`, and
`Bold`. The text styles use those named styles even though the token layer
describes weight numerically as 563 / 590 / 660.

## Binding variables

For anything the components don't cover — page backgrounds, custom containers,
spacing between sections — bind to the library variable rather than writing a
literal. Bindable keys are in `assets/variable-keys.figma.json`.

```js
const brand = await figma.variables.importVariableByKeyAsync(
  '5590797dbf024c26c95f50687c2b1c61c78248b3',   // background/brand/strong
);

// Paints: setBoundVariableForPaint returns a NEW paint — capture and reassign.
const paint = figma.variables.setBoundVariableForPaint(
  { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
  'color',
  brand,
);
frame.fills = [paint];

// Numeric properties bind directly.
const space4 = await figma.variables.importVariableByKeyAsync(
  'e4617564161f3df6bca0282e2de5d1c80e1fd7bf',   // space/4
);
frame.setBoundVariable('itemSpacing', space4);

const radius = await figma.variables.importVariableByKeyAsync(
  '8e4635576b1b8eb2f8c78d500761ea8e055f7028',   // corner-radius/sides
);
frame.setBoundVariable('topLeftRadius', radius);
```

A bound fill follows the library through theme switches and token changes. A
literal `#07344a` is correct exactly once — at the moment you type it — and is
the thing that quietly rots.

## Where the work gets written

Agent writes to Figma are **not recoverable with the user's undo stack.** Cmd+Z
is their history, not yours. So nothing here edits existing work in place, and
nothing here guesses a destination.

**A link is required.** Ask for a Figma URL before pushing anything, and accept
whatever form the user has — file, page, frame, or component. Do not start
building in a scratch file and offer to move it afterwards.

**Resolve the link by traversing the tree.** `get_metadata` with no `nodeId`
lists the file's pages; drill down from there. A file-level URL with one obvious
candidate screen is not ambiguous, and asking about it spends a turn on nothing.
Neither is a file- or page-level URL with a frame selected in the desktop app —
`get_metadata` reports the selection, so name it as the likely target and
confirm rather than listing candidates. Ask a follow-up only when traversal
leaves a real choice.

**Duplicate beside the original.** The first pass copies the resolved frame onto
the same page, next to the original, under a dated name of the form
`Booking flow — Pushpin [Aug 10]`. The original is not modified, moved, or
renamed. Same-page placement is deliberate: the point of a first pass is
comparing old and new at a glance.

**Finalize is a second pass, and it is offered.** Once the user says the result
is good, offer to move the accepted work onto its own page named to the file's
conventions — the `↪ R1 explorations [Aug 10]` and `↪ Design crit [mon date]`
pattern. Never do it automatically. A page appearing unannounced is the same
class of surprise as an overwrite.

**Ask where net-new screens go.** When there is nothing to duplicate, the
destination is a question, not a default.

**Shared library files are refused outright.** Never write into the Pushpin
Thumbprint UI Kit (`VVRGrLgkPRU3vs765d5Q3r`), the Annotation Kit
(`Qefv6O2RMPSBtSYBrCGcdI`), or any file that appears as a subscribed library of
the file being worked in. A bad write there reaches everyone subscribed, and the
user cannot undo it. Contributing a component to the kit goes through a Figma
branch and the contribution flow, which this plugin documents in
[annotate.md](annotate.md) and does not perform.

## The access preflight

Keys are not per-user. File keys, library keys, and component keys belong to the
file, the library, and the component, so the committed catalogs resolve
identically for every account in the org. **Access is per-user** — whether this
account can read those files, and whether the library is enabled in the file
being generated into.

`freshness` cannot answer that. It validates keys against whatever credentials
happen to be present, usually the maintainer's or none, so it reports clean while
a teammate's generation dies mid-run inside `importComponentByKeyAsync`. The
Annotation Kit makes that materially more likely: it is a second library, and
most product files do not already subscribe to it.

So before creating any node, resolve one known key from each library.

```js
const probes = [
  ['Pushpin', 'ebc80753f095633977049c061a28a082816ef9c7'],   // Button
  ['Annotation Kit', '<a COMPONENT_SET key from assets/annotations.figma.json>'],
];

const unreachable = [];
for (const [library, key] of probes) {
  try {
    await figma.importComponentSetByKeyAsync(key);
  } catch (e) {
    unreachable.push(`${library} — ${e.message}`);
  }
}
return unreachable;
```

Use `importComponentByKeyAsync` instead if the catalog entry you pick has
`type: "COMPONENT"`.

Stop on failure, and report **which library was unreachable.** The next step is
`whoami`, which Figma documents for exactly this class of access and rate-limit
debugging. The fix is access to the file, or enabling that library in the target
file — not a change to the catalog, and not a re-capture. Running `freshness`
again will keep reporting clean.

Failing here costs nothing. Failing halfway through leaves a partial screen that
reads like a generation bug rather than a permissions one.

## Workflow

1. **Resolve the link** to a concrete frame, by traversal, per the section
   above.
2. **Read the page and offer it.** Walk up to the resolved frame's page, take
   its children, and offer the context naming what is on it —
   [context.md](context.md). Skip the offer when the page holds nothing else.
3. **Run the access preflight.** Before any node is created.
4. **State in one line what will be duplicated and what the copy is named,**
   so the user can stop you before anything is written. This is also where
   every intended departure from the page's patterns is named, in one question
   rather than several during the build.
5. **Duplicate** the resolved frame beside the original, on the same page. The
   original stays untouched from here on.
6. **Read the catalog.** Identify which published components cover the layout.
   Load `assets/components.figma.json`; scope any `search_design_system` call
   with the Pushpin library key from [figma.md](figma.md).
7. **Import each distinct component once,** at the top of the script. Reuse the
   imported main component for every instance.
8. **Build the skeleton** with `figma.createAutoLayout()` containers and
   `placeholder = true` on each section.
9. **Fill sections incrementally,** ten logical operations per `use_figma` call
   at most. Clear each `placeholder` as it completes.
10. **Audit before declaring done** — see below. Do not rely on a screenshot;
    take one after the audit passes, as a visual check on top of the structural
    one.
11. **Annotate every proposal** with its Annotation Kit note and pointer, and
    print the chat summary.
12. **Offer the finalize pass.** Offer it; do not perform it unprompted.

## The audit

This is the check that catches the failure this whole page is about. Run it on
the generated frame before handing anything over. It sorts what it finds into
three buckets:

- **Library** — instances that resolved to remote published components.
- **Proposed** — local components named `Proposed / …` that have a parseable
  note on the page.
- **Defects** — detached instances, lookalikes, undeclared local components,
  literal fills, and `Proposed /` components whose note is missing or
  incomplete.

The run fails on defects only. A populated `proposed` bucket is a result to
report, not a failure — this is a `use_figma` script, so "exit non-zero" means
`report.ok === false`: do not hand the frame over, and do not offer the finalize
pass.

```js
const root = await figma.getNodeByIdAsync('<generated frame id>');

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

const report = { library: 0, proposed: [], defects: [] };
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
  const missing = ['Extends', 'Tier'].filter((k) => !fields[k]);
  if (fields.Extends === 'none') { if (!fields.Case) missing.push('Case'); }
  else if (!fields.Delta) missing.push('Delta');
  if (fields.Tier && fields.Tier !== 'gap' && fields.Tier !== 'better-experience') {
    missing.push(`Tier (got "${fields.Tier}")`);
  }
  if (missing.length) report.defects.push(`${name} — note missing ${missing.join(', ')}`);
  else report.proposed.push({ name, tier: fields.Tier, instances });
}

// Lookalikes: shapes styled like components instead of being instances.
for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE'] })) {
  const r = typeof n.cornerRadius === 'number' ? n.cornerRadius : 0;
  if (!inInstance(n) && !inProposed(n) && r >= 100) {
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

report.ok = report.defects.length === 0;
return report;
```

Nodes inside an instance are skipped by both shape checks: their styling belongs
to the library, and overriding it is already forbidden. Nodes inside a
`Proposed / …` definition are exempt from the lookalike check — drawn shapes are
how a component gets built — but not from the fill check, because a proposal
built on literals cannot converge on a real component later.

Any pill-shaped frame outside those two cases is the exact bug this page exists
to prevent: something that looks like a Pushpin component and isn't one.

**A `Proposed /` component with no note is a defect, and so is a note without a
`Tier`.** Without that rule the annotation requirement is satisfiable with an
empty sticky — the component exists, something is placed next to it, and the
reviewer still cannot tell what is being proposed or which of the two arguments
they are being asked to accept. The note is the entire reason local components
are allowed at all; a proposal nobody argued for is an off-system element with
better naming.

The fill check has legitimate exceptions — a photograph, a scrim built by hand.
Bind what can be bound, and name the rest in the handoff. Silently ignoring the
bucket defeats it.

A real run of this workflow — a mobile screen with a TextInput, two Buttons, and
a card — returns:

```
{ library: 5, proposed: [], defects: [], ok: true }
```

Five instances resolved to remote main components (three placed directly, two
nested inside them), nothing was drawn by hand, and every fill on the hand-built
containers was variable-bound.

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

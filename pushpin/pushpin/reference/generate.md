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

Name it exactly `Proposed / <Name>`, with the spaces around the slash — that is
the form the audit matches. `Proposed/FilterChip` and `[proposed] FilterChip`
read as undocumented local components and are reported as defects.

### Derive it; do not rebuild it

**A proposal that extends a published component starts as that component.**
Instance the closest variant, detach it, and change only what the proposal is
actually about.

```js
const set = await figma.importComponentSetByKeyAsync(closestKey);
const inst = set.defaultVariant.createInstance();
inst.setProperties({ theme: 'secondary', size: 'medium' });   // the closest variant

const frame = inst.detachInstance();   // keeps type, padding, strokes, radius, bindings
// …change only what Delta names…
const proposed = figma.createComponentFromNode(frame);
proposed.name = 'Proposed / FilterChip';
```

The gate above already made you name the closest published component and say why
it falls short. That component is not just the argument — it is the **starting
material**, and skipping this step is where proposals go wrong.

Rebuilt from scratch, a proposal drifts immediately and invisibly. The type
lands as raw font settings instead of a text style, the padding becomes round
numbers instead of the kit's spacing, the border weight and radius are
approximated, and the result looks approximately right in a screenshot while
sharing nothing with the component it claims to extend. Every one of those is a
decision nobody made — they are just what happens when you start from an empty
frame. Detaching hands you all of them already correct, and narrows the work to
the actual proposal.

**Everything the note's `Delta` does not name is identical to the source.** That
is what makes a proposal reviewable: the reviewer reads one line and knows the
rest is the component they already approved. A proposal that differs in six ways
and describes one is not a proposal, it is a redesign with a misleading label.

For a **net-new** component with no closest relative — `Extends: none` — there is
nothing to derive from. Build it the way the kit is built: bind every fill,
radius, and gap to library variables, use published text and effect styles for
type and elevation, and instance published components for the parts the kit
already covers. A proposal built that way converges on the real component if one
ever lands; one built from literals is just another thing to redo. The audit
holds derived and net-new proposals to the same standard on styles and bindings;
only the starting point differs.

### Rationale on canvas

A proposal nobody argued for is indistinguishable from somebody going
off-system. Every proposal carries its case next to it, placed as **published
Annotation Kit instances** rather than drawn boxes — the same rule as everything
else on this page:

- A `Capstones` instance heading the annotated area.
- One `Annotations` note per proposal, in the annotation column beside the
  frame.
- **An instance of the proposed component beside its own note**, so the claim and
  the thing being claimed about are read together instead of from memory.
- An anchor tying the note to the local instance it is about — a pointer for a
  handful of notes, a number for more than three.
- A short summary frame at the top of the column listing every proposal on the
  screen.

**All of it is nested auto-layout, and nothing in it is positioned by hand.**
Notes are 320 to 500 points wide and overlap each other the moment they are
placed relative to what they describe. One frame — the outermost — carries
coordinates; the capstone, the gutter, the column width, and every note's
alignment are set once on a parent and derived from there, so widening a note or
reordering a proposal costs nothing.
[annotate.md](annotate.md#placement) has the nesting, the gutter, the gap, the
ordering, and the numbering rule, and the audit fails on any annotation that
overlaps another or the design.

The note body is key-value lines. It reads in the narrow 320px box and the audit
can parse it:

```
Proposed: FilterChip
Extends: Chip
Derived: Chip / theme=secondary, size=medium
Tier: better-experience
Delta: adds a count badge; Chip offers left/right icons only
```

An extension carries `Extends`, the `Derived` variant it was detached from, and
a one-line `Delta`. A net-new component carries `Extends: none`,
`Derived: none`, and a real `Case:` block — the business argument for adding it
to the system, not a restatement of what it looks like.

`Derived` names the exact variant, because "extends Chip" and "is a modified
`Chip / theme=secondary, size=medium`" are different claims and only the second
one can be checked.

[annotate.md](annotate.md) holds the annotation vocabulary: what each type is
for, the placement conventions, and what the promotion path into the kit
involves. Read it before placing anything, and read
`assets/annotations.figma.json` for the exact import keys and each property's
`key` field. The Annotation Kit has the same trap as Pushpin — names are exact,
and at least one published variant name is misspelled (`List Elelemt`) — so
never type one from memory.

After a push that introduces proposals, print the same fields as a markdown
summary in chat, so the case can be pasted into Slack or Coda. List every
unresolved atom in the same summary: a gap the design system owner can see is
the point of both, and the two questions — "should we build this component?"
and "what should this icon be?" — go to the same person. Nothing is written to
disk.

**Lead with any library the preflight could not reach**, above the proposals and
the unresolved atoms, because it reframes everything under it. A screen full of
`Placeholder / icon` is a different artifact depending on whether the icon set
lacks those glyphs or this account simply cannot see the library, and the reader
cannot tell the two apart from the canvas. Name the library, say what stood in
for it, and say what would restore it:

```markdown
**The Thumbprint UI Kit was out of reach**, so all 6 icons on this screen are
placeholders rather than missing glyphs — Pushpin's icons are published from
that file. Notes are drawn rather than Annotation Kit instances for the same
reason. Both are fixed by access to those files, not by a change to the design.
```

The failure mode this prevents is a reviewer concluding the design system is
missing something it publishes, and a proposal being written for a component that
already exists.

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

## Icons

Icons are the part of the kit most likely to be got wrong, and all three ways of
getting it wrong come from the same place: **the icon set is not published from
the Pushpin file.** It is published from the Thumbprint UI Kit
(`jjhhb3Kp6a7JrtBLCjrf6u`), where it lives deliberately — one set of glyphs
serving both systems rather than a copy in each — and a `search_design_system`
call scoped to Pushpin returns nothing for `caret`. That reads as "Pushpin has no
caret" and it is wrong — there are four, at four sizes each.

`assets/icons.figma.json` is the catalog: 227 icons across ten categories, 899
import keys. Read it the same way you read the component catalog, and never
type an icon name from memory.

```js
const caret = await figma.importComponentByKeyAsync(
  '9f82048ae8b63ce69e24cb84a5d3a514ba20dee7',   // Caret-Left · Small
);
slot.swapComponent(caret);
```

Every icon is a plain `COMPONENT`, not a set, so it is
`importComponentByKeyAsync` and there are no variants to set. The size is not a
property — it is a different component with a different key.

Two catalog quirks worth knowing before a lookup fails. A name that is published
in more than one category is keyed `<name> [<category>]` — there is no plain
`Home`, only `Home [navigation]` and `Home [meta-category]`, because they are
two different drawings. And a few names carry a doubled word, `Trend Icon` and
`Home-Heart Icon`, because that is genuinely how they are published; correcting
the spelling gives you a key that does not resolve.

### The size ramp

| Size | Pixels |
|---|---|
| `Tiny` | 14 |
| `Small` | 18 |
| `Medium` | 28 |
| `Large` | 32 |

**Never resize an icon.** There are exactly four sizes and each one is drawn for
the size it is — a Large scaled to 18px is not a Small, it is a Large with the
wrong stroke weight and the wrong optical corrections, and it is invisible in a
screenshot. If the icon is the wrong size, import the key for the right size.
`resize()`, `rescale()`, and a set `width` on an icon instance are all the same
defect.

### Which size

**Read it off the slot rather than choosing it.** When filling an
`INSTANCE_SWAP`, the component already contains an icon at the size the kit
built it around. Take that one's size and swap to the same size:

```js
const slot = instance.findOne((n) => n.type === 'INSTANCE' && / Icon · /.test(n.name));
const size = /Icon · (Tiny|Small|Medium|Large)$/.exec(slot.name)[1];
```

This is the whole rule for icons inside components, and it is worth preferring
over any table because it cannot go stale. It needs no lookup, it stays correct
when the kit rebuilds a component, and it gets the cases a table would miss —
Button's left slot defaults to `Medium` while its right slot defaults to `Tiny`,
which no reasonable table would have predicted. The catalog records the same
answer statically as `defaultSize` on each `INSTANCE_SWAP` property, for reading
ahead of a run.

One caveat: the recorded default is the *default variant's* answer. A component
with a `size` axis scales its icon along with it, so read the slot on the
instance you actually configured, not on the one you first created.

For a **standalone** icon, with no slot to read:

| Where | Size |
|---|---|
| Inline with `body-3` or `body-4`, dense list rows, chips, badges | `Tiny` |
| Inline with `body-1`/`body-2`, form affordances, most UI controls | `Small` |
| Standalone affordance, list-item leading icon, tab bar | `Medium` |
| Feature or empty-state illustration, marketing callout | `Large` |

When in doubt between two, take the smaller. Pushpin reads soft and quiet, and
an oversized icon is the first thing that breaks that.

### When no icon matches

Five icons do not publish all four sizes, and the set does not cover everything
a design might ask for. Neither case licenses dropping the icon — see
[Unresolved atoms](#unresolved-atoms-are-placed-never-dropped) below. Check
`incomplete` in the catalog before assuming a size exists, and reach for a
nearby size only by placing it deliberately at its own correct dimensions, never
by resizing.

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

## Unresolved atoms are placed, never dropped

When something the design calls for cannot be resolved to a published asset —
an icon the set does not cover, an illustration, a logo, a photograph, an avatar
— **place a marked placeholder and record it.** Do not leave it out.

Omission is the worst available outcome and it is the one that happens by
default, because a missing thing raises no error and takes no space. The frame
looks finished, it reviews as finished, and the gap is found by whoever builds
it. A placeholder is uglier and honest, and honest is the whole job here.

Two failures, and the second is the expensive one:

- **The atom disappears.** A row of five icons ships as four.
- **The atom takes its parent with it.** An icon button whose icon could not be
  resolved ships as no button at all — the control, its action, and its place in
  the layout all vanish because a child was missing. **A missing child never
  removes its parent.** Place the parent, place the placeholder inside it, and
  let the gap be one icon rather than one feature.

The placeholder is a frame named `Placeholder / <kind> · <size>`, sized to what
the real thing would be, with a variable-bound fill:

```
Placeholder / icon · Small          18×18, where a Small icon belongs
Placeholder / illustration · 240    the box the illustration would fill
```

Bind the fill to `background/neutral/low` so it reads as deliberately blank
rather than as a styling accident, and give it the corner radius the real asset
would have. It is layout, not a component, so the ordinary rules apply: no
literal fills, no drawn lookalike of the thing that is missing.

Each one gets a `Sticky Note Status` instance with `Theme: Open Question`,
placed in the annotation column rather than on the frame —
[annotate.md](annotate.md) has the placement, and its drawn stand-in for when the
Annotation Kit is out of reach. That component exists "to provide
information about a design that otherwise might be nested in comments", and an
asset the system cannot supply is exactly such a question.

The audit reports these in an `unresolved` bucket, which does not fail the run,
and the chat handoff lists every one. The point is that the gap is *stated*: a
reviewer who disagrees can say "use the Sparkle icon instead", and nobody
discovers the hole at build time.

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

**A link is required, and it comes before everything.** Not before the first
write — before the first call. No page reads, no catalog work, no access
preflight until there is a URL, because every one of those is work against a
file nobody has named yet. Accept whatever form the user has — file, page,
frame, or component. Do not start building in a scratch file and offer to move
it afterwards.

**Ask for it; never go looking.** A missing link is a question, answered in a
turn. It is not a search: no file hunt, no `search_design_system` to work out
where the work should land, no subagent sent to find the user's project. The
destination is something they have and you do not, and the minutes spent looking
still end in a guess.

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
(`Qefv6O2RMPSBtSYBrCGcdI`), the Thumbprint UI Kit that publishes the icon set
(`jjhhb3Kp6a7JrtBLCjrf6u`), or any file that appears as a subscribed library of
the file being worked in. A bad write there reaches everyone subscribed, and the
user cannot undo it. Contributing a component to the kit goes through a Figma
branch and the contribution flow, which this plugin documents in
[annotate.md](annotate.md) and does not perform.

## The access preflight

Keys are not per-user. File keys, library keys, and component keys belong to the
file, the library, and the component, so the committed catalogs resolve
identically for every account in the org. **Access is per-user** — whether this
account can read the file the component is published from.

`freshness` cannot answer that. It validates keys against whatever credentials
happen to be present, usually the maintainer's or none, so it reports clean while
a teammate's generation dies mid-run inside `importComponentByKeyAsync`. Pushpin
draws components from three separate libraries and a given account rarely reaches
all three: most product files are set up against Pushpin alone, and the icon
library is the least likely of the three to be within reach, because nothing
about Pushpin announces that its icons are published from Thumbprint.

So before creating any node, resolve one known key from each of the three.

```js
const probes = [
  ['pushpin', 'set', 'ebc80753f095633977049c061a28a082816ef9c7'],        // Button
  ['icons', 'component', '9f82048ae8b63ce69e24cb84a5d3a514ba20dee7'],    // Caret-Left · Small
  ['annotations', 'set', 'aa6e465a9c85c4067a897cc46408bd116d1e3e69'],    // Annotations
];

const reach = {};
for (const [library, kind, key] of probes) {
  try {
    await (kind === 'set'
      ? figma.importComponentSetByKeyAsync(key)
      : figma.importComponentByKeyAsync(key));
    reach[library] = true;
  } catch (e) {
    reach[library] = e.message;
  }
}
return reach;
```

Every icon is a plain `COMPONENT` rather than a set, which is why the icon probe
uses `importComponentByKeyAsync`. Use the same call for any catalog entry whose
`type` is `"COMPONENT"`.

### One library stops the run, and it is not all of them

An earlier version of this page stopped on any of the three. That is the wrong
trade in two of the three cases, and it produced the worst possible outcome for
the most common setup: a file reaching Pushpin but not the Annotation Kit could
not generate at all, including a layout with no proposals that would never have
placed a note.

| Unreachable | Consequence |
|---|---|
| **Pushpin** | **Stop.** Nothing can be placed. Every component, variable, and text style this page relies on is published from here, and a screen with none of them is not a degraded screen, it is an empty one. |
| Icons | Continue. Every icon becomes a `Placeholder / icon · <Size>` by the rule in [Unresolved atoms](#unresolved-atoms-are-placed-never-dropped). |
| Annotation Kit | Continue. Notes are drawn instead of instanced — the fallback is in [annotate.md](annotate.md#when-the-annotation-kit-is-out-of-reach). |

Both degraded modes are recorded and reported, and neither fails the audit. That
follows the rule the `unresolved` bucket already sets: a stated gap is an outcome
worth handing over, and what fails is hiding one.

So the preflight decides how the run proceeds rather than whether it proceeds:

```js
if (reach.pushpin !== true) return { stop: `Pushpin unreachable — ${reach.pushpin}` };

const mode = {
  icons: reach.icons === true ? 'library' : 'placeholder',
  annotations: reach.annotations === true ? 'library' : 'drawn',
};
```

Carry `mode` through the run. It decides what step 7 imports, and it is what the
audit and the handoff report at the end.

### Naming the library that was out of reach

Whether it stopped the run or degraded it, **report which library** and carry it
to the handoff. The next step is `whoami`, which Figma documents for exactly this
class of access and rate-limit debugging. The fix is access to the file the
component is published from — not a change to the catalog, and not a re-capture.
Running `freshness` again will keep reporting clean.

Naming the library matters more than naming the key. "You are not reaching the
Thumbprint UI Kit, which is where Pushpin's icons are published" is something a
designer can act on; a raw `Component with key "9f8204…" not found` is not.

The icon library is the one to be loudest about, because the obvious reading of
its absence — "Pushpin has no caret icon" — is wrong, and it sends the next
person to propose a component that already exists.

Failing here costs nothing. Failing halfway through leaves a partial screen that
reads like a generation bug rather than a permissions one.

## Workflow

1. **Resolve the link** to a concrete frame, by traversal, per the section
   above.
2. **Read the page and offer it.** Walk up to the resolved frame's page, take
   its children, and offer the context naming what is on it —
   [context.md](context.md). Skip the offer when the page holds nothing else.
3. **Run the access preflight.** Before any node is created. Stop only if
   Pushpin is unreachable; otherwise carry `mode` forward.
4. **State in one line what will be duplicated and what the copy is named,**
   so the user can stop you before anything is written. This is also where
   every intended departure from the page's patterns is named, in one question
   rather than several during the build. Say here if the preflight degraded
   anything, so the user learns their icons will be placeholders before the
   screen is built rather than after.
5. **Duplicate** the resolved frame beside the original, on the same page. The
   original stays untouched from here on.
6. **Read the catalogs.** Identify which published components cover the layout,
   and which icons it needs. Load `assets/components.figma.json` and
   `assets/icons.figma.json`; scope any `search_design_system` call with the
   right library key from [figma.md](figma.md) — Pushpin for components, the
   Thumbprint UI Kit for icons.
7. **Import each distinct component and icon once,** at the top of the script.
   Reuse the imported main component for every instance. Skip the icon imports
   when `mode.icons` is `placeholder` and the annotation imports when
   `mode.annotations` is `drawn` — importing a key from a library the preflight
   just failed on throws, and the preflight ran so this step would not have to
   guess.
8. **Build the skeleton** with `figma.createAutoLayout()` containers and
   `placeholder = true` on each section.
9. **Fill sections incrementally,** ten logical operations per `use_figma` call
   at most. Clear each `placeholder` as it completes. Nothing the design calls
   for is left out: what cannot be resolved gets a marked placeholder.
10. **Annotate,** into the auto-layout bundle beside the frame: every proposal's
    note, a specimen instance of the proposal next to it, its anchor, and an open
    question for every unresolved atom. This precedes the audit rather than
    following it, because the audit reads these notes — run it first and a
    proposal whose note has not been placed yet is indistinguishable from one that
    has no note at all, which is a defect.
11. **Audit before declaring done** — see below. Do not rely on a screenshot;
    take one after the audit passes, as a visual check on top of the structural
    one. Then print the chat summary, listing proposals, unresolved atoms, and any
    library the preflight could not reach.
12. **Offer the finalize pass.** Offer it; do not perform it unprompted.

## The audit

This is the check that catches the failure this whole page is about. Run it on
the generated frame before handing anything over. It sorts what it finds into
five buckets:

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

A real run of this workflow — a mobile screen with a TextInput, two Buttons, and
a card — returns:

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

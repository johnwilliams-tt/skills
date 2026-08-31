# Annotating a design

Notes on a Thumbtack design are placed as instances from the **Annotation Kit**,
a second published library alongside Pushpin. File `Qefv6O2RMPSBtSYBrCGcdI`,
library key `lk-7faccc61…`. The same rule applies here as everywhere else in
this plugin: import and instance, never draw. A drawn note looks the same in a
screenshot and behaves differently in every other respect — it will not update
with the kit, it is invisible to the audit, and it tells a reviewer that the
file was assembled rather than composed.

**On a build, annotating is the user's call and it is asked once.** The checkpoint
in [generate.md](generate.md#the-checkpoint-is-one-call-with-two-questions) offers
it before anything is written, because a note bundle is a second round of writes
against a second library and a first look at a layout may not want to pay for it.
Everything on this page governs annotation that was asked for; nothing here is a
reason to annotate a build that declined it, and what the notes would have
disclosed goes into the chat summary instead.

**One exception, and it is decided by the preflight rather than by preference.**
When the access preflight in [generate.md](generate.md#the-access-preflight)
reports the Annotation Kit out of reach, notes are drawn — see [When the
Annotation Kit is out of reach](annotate-fallback.md). The
alternative was abandoning the whole run over a library the design may never have
needed, which is a worse answer than an imperfect note. This is not a license to
draw when the kit is available: if the import succeeds, drawing a note is the
defect it always was.

The catalog holds 91 published components across the kit's four pages, each with
its import key and each property's exact `key` field. Ask for one —
`node scripts/lookup.mjs --annotation <name>` — rather than typing a name or a
variant option. Some published names are misspelled, and the misspelling is
load-bearing:
`Annotations` has a variant literally named `List Elelemt`, and three of
`Motion Tokens`' variants end in `[Anrdoid]`. Pass the corrected spelling and
`setProperties` throws.

## Setting the text

**No annotation component exposes its body text as a component property.** The
catalog will show you a `Type` or a `Size` variant and nothing else, and
`setProperties` moves only variants. The text lives in a plain `TEXT` node
inside the instance, so the recipe is always: create the instance, set the
variants, then load the font on that node and assign `characters`.

```js
const set = await figma.importComponentSetByKeyAsync(
  'aa6e465a9c85c4067a897cc46408bd116d1e3e69',
);
const note = set.defaultVariant.createInstance();
note.setProperties({ Type: 'Multi-line' });

const body = note.findOne((n) => n.type === 'TEXT');
const swapped = await loadOrSubstitute(body);
body.characters = 'Proposed: FilterChip\nExtends: Chip\n…';
```

That `findOne` is safe because `note` came from `createInstance()`, which did not
reproduce the unmaterialized-interior blind spot under measurement — that line
run verbatim against a fresh `Annotations` · `Guide` instance finds the text node
on the first call, 2 TEXT nodes in a 4-node subtree. It is emphatically not safe
because `findOne` is reliable: on a subtree this script cloned or detached,
`findOne` returns a partial answer and throws nothing. Copied into either of
those contexts, this line carries the bug that has already been misdiagnosed
three times — the guard for that case is in
[generate.md](generate.md#stale-traversal-on-a-subtree-this-call-created).

**The Annotation Kit is set in Helvetica Neue, and an agent does not have it.**
Pushpin's own Thumbtack Rise is published to the file and loads; Helvetica Neue
is a system font, so it is present on a designer's Mac and absent from the
runtime a script runs in — 1,945 families available and not one of them
Helvetica. `loadFontAsync` on the node's own font therefore throws, and because
the script is atomic it takes the whole annotation pass with it. This is the
first call in the recipe, so nothing downstream of it has ever run.

Substitute rather than fail. The note stays a library instance, the text is
legible, and the only loss is the face it is set in:

```js
async function loadOrSubstitute(t) {
  const want = t.fontName;                       // annotation text is single-style
  try { await figma.loadFontAsync(want); return null; } catch { /* not present */ }
  // Same weight first, then the family's Regular, so a style the kit uses and
  // Rise does not have still lands somewhere legible.
  for (const style of [want.style, 'Regular']) {
    try {
      const alt = { family: 'Thumbtack Rise', style };
      await figma.loadFontAsync(alt);
      t.fontName = alt;
      return `${want.family} ${want.style} → ${alt.family} ${style}`;
    } catch { /* try the next */ }
  }
  throw new Error(`No font for ${want.family} ${want.style}`);
}
```

Thumbtack Rise rather than a neutral like Inter: it is the brand's own face, it
is already loaded for the design the annotation sits beside, and it carries
Bold, Medium and Regular, which is every weight the kit asks for. **Report what
was swapped** — it belongs in the `degraded` bucket beside a library that was
out of reach, for the same reason. A note whose typography quietly stopped
matching the kit is worth one line at handoff.

Which node to reach for depends on whether the layer was named by a designer or
auto-named by Figma from its own content:

| Instance | Text node |
|---|---|
| `Annotations` · `Multi-line` | the one `TEXT` node |
| `Annotations` · `Small` | the one `TEXT` node |
| `Annotations` · `Number` | layer `Number` |
| `Annotations` · `Dev Note` | two nodes: title first, body second |
| `Annotations` · `Guide` | two nodes: heading first, body second |
| `Annotations` · `List Elelemt` | layer `Number`, then the body node |
| `Annotations / Pointers` · `Number` | layer `Number` |
| `Annotations / Pointers` · `Label` | layer `Label` |
| `Capstones` | layer `Large capstone`, at every size |
| `Sticky Note` | layer `Note` |
| `Sticky Note Status` | layer `Label` is the theme; the first `Note` is the body |

`Number`, `Label`, `Note` and `Large capstone` are names a designer set, so they
are stable — `Large capstone` is the layer name on the Small and Medium
capstones too, which reads oddly and is nonetheless correct. Every other node in
that table is auto-named from its own content, which means **its name changes
the moment you write to it.** Find those by type and position, never by name, or
a second pass will fail to find what the first pass renamed.

## What each annotation is for

### Annotations

Seven variants on one `Type` axis, from a 24px dot to a full page of guidance.

| Variant | Size | For |
|---|---|---|
| `Number` | 24×24 | A numbered dot placed on the design, keyed to a numbered note elsewhere |
| `Small` | 163×32 | A single-line label, when a sentence would be too much |
| `Multi-line` | 320×104 | The general-purpose note. A 288px text column, so write in short lines |
| `List Elelemt` | 360×104 | One numbered row — a `Number` and a body, for building a list of your own length |
| `List` | 360×824 | Seven numbered rows already stacked |
| `Dev Note` | 300×128 | A titled note aimed at engineering rather than at design review |
| `Guide` | 500×656 | A heading and a long body, for explaining a pattern rather than a screen |

The `Multi-line` placeholder text tells the designer to detach the note to add a
motion token. The plugin does not do that: a detached instance is a defect by
the audit's own rules, and the reason for the note is to be legible as library
work.

### Annotations / Pointers

"Used to help point out specifics of a design and adding reference points for
documentation purposes." Three axes — `Direction` (Left, Down, Up, Right) ×
`Type` (Number, Label, Bracket) × `Mode` (Dark, Light), 24 variants. A pointer
is what connects a note to the thing it is about; without one, a reviewer has to
guess which element a paragraph refers to. Use `Bracket` when the note covers a
range of elements rather than one.

### Capstones

"Used to define a section of frames for Developer/Eng Handoff." One `Size` axis
— Small (485×112), Medium (1363×205), Large (1470×294). A capstone is a heading
for an area of canvas, so pick the size that matches the width of what it heads
rather than the importance of the content.

It gets used two ways in this plugin, and they are not the same job. One heads an
annotated area from outside it, as [the bundle's first child](#placing-a-capstone)
— one per design, at its published proportions, saying where this piece of work
begins. The other is a **section separator inside a documentation frame**:
several per frame, a member of the frame's own auto-layout rather than a sibling
of it, dividing one long artifact into parts. That second use is what the state
catalog in [flows.md](flows.md) is built from, and it is the only place the
compact override in
[generate.md](generate.md#the-one-exception-is-annotation-furniture) applies —
a separator repeated five times down a frame cannot carry 112 points of heading
each time.

### Sticky Note and Sticky Note Status

`Sticky Note` is the plain one, `Regular` or `Small`. `Sticky Note Status` adds
a `Theme` — To Do, Open Question, Impediment — and a `Completed` axis, and
exists "to provide information about a design that otherwise might be nested in
comments." Its point is that an unresolved question is visible on the canvas
instead of buried in a comment thread nobody reopens. Use it for a question the
design cannot answer, not for a rationale that belongs in a note.

`Completed` is a variant, not a boolean property: its two options are the strings
`'false'` and `'true'`, so `setProperties({ Completed: true })` throws and
`setProperties({ Completed: 'true' })` is what you want.

### Accessibility annotations

Thirteen published components on the Accessibility Annotations page, covering
headings, landmarks, links, buttons, images, form labels and autocomplete
tokens, reading and tab order, skip links, page titles, arrows, and a compliant
marker. They express intent an engineer cannot read off a mock — that this text
is an `h2`, that this region is `<nav>`, that focus moves here next.

Two of them are published under the same name. `A11y / Annotation / Spec` exists
twice, with different keys and different variant axes: one carries interaction
states (`Active`, `Hover`, `Focus`, `Disabled`, …) and the other carries
`Error`, `Keyboard` and `Style` with an `Example` axis. The catalog keys them as
`A11y / Annotation / Spec [1193:410]` and `[1193:431]` for that reason. Look at
the variant options to tell which one you want; the name will not tell you.

#### Read them off the markup, not off the mock

When the frame was pushed to Figma from code in this project, the intent these
annotations exist to record is already written down. Heading levels, landmarks,
label associations, and focus order are in the markup — much of it put there
deliberately, by a hardening pass. Inferring them back out of a picture of that
markup throws away the one authoritative source and guesses at it instead.

So annotate from the source. Each of these is a direct read:

| In the markup | Annotation | Variant |
|---|---|---|
| `<h1>`…`<h6>` | `A11y / Annotation / Headings` | `Heading Level` — `H1` … `H6` |
| `<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<form>`, `role="search"` | `A11y / Annotation / Landmark` | `Type`, and `Named: True` when it carries an accessible name |
| `tabindex`, or a focus order the DOM order does not give | `A11y / Annotation / Order` | `Type: Tab Order` |
| A reading order that departs from source order | `A11y / Annotation / Order` | `Type: Reading Order` |
| `<label for>` or `aria-label` on a field, and its `autocomplete` | `A11y / Annotation / Label` | `Autocomplete` and `Autocomplete type` |
| `<a>` with `target="_blank"` | `A11y / Annotation / Link` | `Link target: Link new window` |
| `<img alt>` | `A11y / Annotation / Image` | `Alt Label: True` |

Three limits, and they are what keep this from adding noise:

- **This is `annotate`, not `generate`.** A generated screen's annotation step
  covers proposals, specimens, and open questions, and it stays that way.
  Accessibility annotations are placed when annotating is what was asked for.
- **Annotate what the markup states, never what it implies.** A `<div>` that
  behaves like navigation is not a `Navigation` landmark; it is a finding to
  raise. An input with no label gets a `Sticky Note Status` open question, not a
  guessed one. Reading intent off the source is only worth more than inferring
  it from the mock if it stays a read.
- **Placement does not change.** These are cards in the same column as every
  other note, in the [bundle](#the-annotated-bundle) below. The arrangement has
  a single origin and is auto-layout all the way to the top, which is what makes
  adding a dozen cards safe: they cannot overlap each other or the design, and
  the audit's overlapping-annotation defect is unaffected.

Volume is still worth a thought. Annotating all six heading levels on a page
that has fourteen headings produces a column nobody reads. Annotate the
structure — the landmarks, the heading spine, the fields, anything whose
intended behaviour the mock does not show — rather than every element that could
carry a marker.

### The rest of the General page

Not annotation vocabulary, but published from the same library and worth knowing
exists rather than rebuilding: `Framing Cards` for the why behind a project,
`Project status` / `Project overview` / `Thumbnail` for file-level metadata,
`Figma file structure` for page naming, `Gesture / …` and `Cursor / …` for
interaction diagrams, `Motion Tokens`, `Line`, `Endpoint`, `Studio Feedback`,
`Team Member`, and `Deprecated` for overlaying work that is no longer in use.

## Placement

Annotations are only useful if they can be read, and the way they stop being
readable is always the same: each one gets positioned relative to the thing it
describes, the things it describes are close together, and the notes — which are
320 to 500 points wide — end up stacked on top of each other and on the design.
A screen with eight notes becomes unreadable at exactly the moment it becomes
worth annotating.

So annotations are not positioned individually. **The annotated area is
auto-layout all the way to the top, and the auto-layout is what prevents the
overlap.** Exactly one node in the whole arrangement has an x and a y — the
outermost frame. Everything below it is placed by its parent. This is the whole
mechanism, and it is not a guideline about being careful.

The distinction matters because a single column is not enough on its own. A
column with hand-computed coordinates still comes apart the moment anything
resizes: the gutter was measured off the design frame's old width, the capstone
was stretched to the old total, and a reviewer who widens one note re-rags the
lot. Every number below is set once, on a parent, and derived by Figma from
there.

### The annotated bundle

Three nested frames. The bundle stacks the capstone over the body; the body sets
the gutter between the design and its notes; the column stacks the cards. Build it
around the duplicated frame — `target` below is that duplicate, and adopting it
into the body is what gives the arrangement a single origin.

```js
const bundle = figma.createFrame();
bundle.name = `${target.name} — annotated`;
bundle.layoutMode = 'VERTICAL';
bundle.primaryAxisSizingMode = 'AUTO';
bundle.counterAxisSizingMode = 'AUTO';
bundle.fills = [];
await bindSpacing(bundle, { itemSpacing: 96 }, 'intent');   // the capstone's air, bound once
bundle.x = target.x;                  // the only coordinates in the arrangement
bundle.y = target.y;

const body = figma.createFrame();
body.name = 'Design and notes';
body.layoutMode = 'HORIZONTAL';
body.primaryAxisSizingMode = 'AUTO';
body.counterAxisSizingMode = 'AUTO';
body.counterAxisAlignItems = 'MIN';   // top-aligned, not centred
body.fills = [];
await bindSpacing(body, { itemSpacing: 96 }, 'intent');     // the gutter, bound once

bundle.appendChild(body);
body.appendChild(target);             // the duplicate, at its own size
body.appendChild(col);                // the column, built below
```

`bindSpacing()` is the helper from [generate.md](generate.md#spacing-goes-through-space),
inlined here as it is in every lane. The gutter and the capstone's air were 80
and 84 — neither is a step on the scale, and [tokens.md](tokens.md#spacing) says
outright there is no 80 — so the helper would snap both to 96 and record a drift
every run. Both are written as 96 instead. This is the plugin's own arrangement
rather than a number read off a file, and the skill's most-copied example was
teaching exactly what the audit exists to catch.

`target` keeps its own width and height: leave `layoutAlign` at `INHERIT` and
`layoutGrow` at 0 and the design is not resized by being adopted. Moving the
bundle moves the design, its notes, and its capstone together, which is the
point — they were never three things a reader wanted to arrange separately.

The snippet's order is not incidental. **Read `target.x` before reparenting it**:
once a node is inside an auto-layout its x and y are its parent's business, so
placing the bundle after the adoption puts the whole arrangement at the origin.

Every measurement this replaces used to be arithmetic against the design
frame's box, and each one was a thing that silently went stale:

| Was computed | Is now set once |
|---|---|
| `col.x = target.x + target.width + 80` | `bindSpacing(body, { itemSpacing: 96 })` |
| `col.y = target.y` | `body.counterAxisAlignItems = 'MIN'` |
| capstone x, plus frame + gutter + column for its width | `capstone.layoutAlign = 'STRETCH'` |
| ~84 points of air under the capstone | `bindSpacing(bundle, { itemSpacing: 96 })` |

- **Gutter 96** between the design's right edge and the column. Wide enough that
  the column reads as commentary rather than as part of the design.
- **Right of the design**, unless the page's own convention is otherwise or the
  right side is occupied — in which case reorder the body's two children and the
  gutter follows. Never above, below, or on top.

### The column

One `FRAME` per annotated design frame, vertical auto-layout, with no
coordinates of its own:

```js
const col = figma.createFrame();
col.name = `${target.name} — notes`;
col.layoutMode = 'VERTICAL';
col.primaryAxisSizingMode = 'AUTO';   // grows with its contents
col.counterAxisSizingMode = 'AUTO';   // as wide as its widest member
col.fills = [];
await bindSpacing(col, { itemSpacing: 24 }, 'intent');   // the gap, bound once
```

- **Gap 24** between items, bound on the column and never set on an item.
- **Every direct child stretches.** `layoutAlign = 'STRETCH'` on each one, so the
  column takes the width of its widest member and every member takes the width of
  the column. Without it the kit's own width differences — 320 for `Multi-line`,
  360 for `List Elelemt`, 500 for `Guide` — leave the column ragged down its right
  edge. A ragged column is most of what reads as needing cleanup even when
  nothing actually overlaps, and it is the part a person cannot fix without
  touching every note.

The column is layout, so bind its fill if it has one and leave it transparent if
it does not. It is not a component and needs no proposal.

Order inside it: the summary frame first when there is one — a short list of
every proposal on the screen, so a reviewer can count them without hunting —
then one card per proposal in the order a reader meets their subjects on the
design, then an open question for each unresolved atom, then the
[`Token drift` note](generate.md#one-dev-note-when-something-drifted) when the
run snapped anything. Drift goes last because it is about the whole frame rather
than about any element on it, and it is a direct child like the rest — a member
of this column is the only place a note is ever put, including on a run that has
nothing else to say and would otherwise have no column at all.

### Filling the cards in parallel

Most annotate passes are three or four notes, and **one call is the right answer
for those.** The whole arrangement is a bundle, a body, a column, and a handful
of instances, which fits in one script comfortably — decomposing three notes into
three lanes spends more on the decomposition than the notes cost to write.

The pass that wants lanes is the large one: an accessibility pass reading a dozen
annotations off the markup, where each card is its own lookup, its own variant
decision, and its own font substitution. That is also where the obvious move
breaks. Several calls each appending their own note to the column look disjoint,
because no two of them touch the same node — but what they share is the column's
child order, and the order is not decoration. Whichever call runs second appends
second, and nothing in either script knows which one that was. What comes out is
a reader hunting for `4`, which is the thing
[numbering](#anchoring-number-dont-point) exists to spare them.

So the annotate pass takes the shape every other write path in this skill takes —
[skeleton then fill](parallel.md#skeleton-then-fill). One call builds the bundle,
the body, the column, and one empty card per note, each named and appended in its
final order; each lane is then handed one card's id and fills that card and
nothing else.

```js
// In the skeleton call, after bundle → body → col are built as above. The
// summary frame first, then one card per proposal, in the order set out above.
const cards = [
  'Proposal summary',
  'Proposal — FilterChip',
  'Proposal — RangeSlider',
].map((name) => {
  const card = figma.createFrame();
  card.name = name;
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'AUTO';
  card.fills = [];
  col.appendChild(card);              // the order, decided once, in one script
  card.layoutAlign = 'STRETCH';
  return { id: card.id, name };
});

return { pageId: figma.currentPage.id, colId: col.id, cards };
```

Two things the skeleton owes its lanes, and neither is safe to leave to one.
**Each card is named on creation, by [the naming rule below](#nothing-overlaps)**
— `Proposal — <Name>`, never `Annotations …`, because the audit finds annotations
by name and would compare a wrapper whose name matched against the note it
contains and overlaps completely by construction. A lane free to name its own
card is a lane that can turn a clean run into a defect. And **`layoutAlign =
'STRETCH'` goes on in the skeleton**, so the column is square down its right edge
before any note lands in it; a lane that forgot the stretch leaves a rag that
nothing in that lane's own output would show.

The members with no card of their own stay direct children of the column and are
appended after the lanes have joined, by the call that writes them: an open
question per unresolved atom, then the
[`Token drift` note](generate.md#one-dev-note-when-something-drifted). Both are
written off a list that is in hand by that point, so neither needs a lane, and
appending them from one script is what keeps the tail of the column in order for
the same reason the skeleton keeps the head of it in order.

Each lane then [sets up its own world](parallel.md#the-lane-contract), reaches its
card by the id it was given, and builds its note, its specimen, and its pointer
inside it. It touches neither the column, nor the body, nor another lane's card —
which is [the invariant](parallel.md#the-invariant), and here it is also the whole
reason the order held.

A card left empty by a lane that failed is worth re-issuing rather than leaving
for the audit, because the audit catches only half of them. An empty
`Proposal — <Name>` card does fail the run: the proposal's instance is on the
design and its note is nowhere on the page, which is a
`Proposed / <Name> — no annotation note` defect. An empty accessibility card
fails nothing at all — no check requires that a landmark or a heading level was
ever annotated — so it hands over as a column one card short of what the
skeleton promised, and raises nothing on the way.
[Re-issue the failed lane](parallel.md#when-a-lane-fails).

### Anchoring: number, don't point

A pointer aimed across 400 points of canvas is the other half of the mess. Past
about three notes they cross each other and stop indicating anything.

**Three or fewer notes on a frame:** `Annotations` · `Multi-line` in the column,
each with an `Annotations / Pointers` instance on the design aimed at its
subject.

**Four or more:** switch to numbers. An `Annotations / Pointers` · `Number`
instance sits on the design at the element, and the matching
`Annotations` · `List Elelemt` row carries the same number in the column. The
pairing is the number, so nothing has to be aimed and nothing can cross. This is
what the `Number` variants are for, and it is the reason the kit publishes a
`List` of seven pre-stacked rows.

Numbers run in reading order down the design — top to bottom, then left to
right — and the column is in the same order. A reader should never have to hunt
for `4`.

### Pointer direction is derived, not chosen

`Direction` describes where the pointer's tail comes from, so it follows from
the geometry and is never a preference. With the column on the right, a note
reaching back to the design is a `Left` pointer:

```js
const direction = noteBox.x > targetBox.x + targetBox.width ? 'Left' : 'Right';
```

A pointer whose direction disagrees with its position reads as aiming at
something else entirely, which is worse than no pointer.

### Placing a capstone

A `Capstones` instance heads an annotated area so it reads as deliberate rather
than as leftovers. It is the bundle's first child, above the body:

```js
bundle.insertChild(0, capstone);
capstone.layoutAlign = 'STRETCH';
```

The Icons page of the Thumbprint UI Kit is the reference for how one is used, and
every convention it demonstrates now falls out of that stretch rather than being
measured:

- **Left-aligned with the block it heads, spanning its width.** The published
  sizes are starting widths, not constraints — the Icons page runs a 112-tall
  capstone out to 3472 wide across the whole inventory. Pick the size by height
  and let `STRETCH` supply the width. A capstone heading the design *and* its
  column spans both because the body is what it stretches to, so widening either
  one keeps the heading correct instead of leaving it short.
- **Above the block with clear air beneath it** — the Icons page leaves about 84
  points, and 96 is the nearest step, which is `bundle.itemSpacing`. Never
  overlapping what it heads, and never inside it; being a sibling above the body
  in a vertical auto-layout makes both impossible rather than merely discouraged.

### Nothing overlaps

The audit checks it — pairwise bounding-box intersection among every annotation,
and between any annotation and the design frame. An intersection is a defect, not
a warning, because an unreadable note is worth exactly as much as an absent one
and costs more to produce.

The two rules that keep it true: everything below the bundle is laid out by a
parent auto-layout, and nothing is ever given coordinates on the design. A
`Pointers` instance is the one annotation meant to land there, and a capstone
heading a section inside a documentation frame is placed by that frame's own
auto-layout — [flows.md](flows.md). Anything else that reaches the design got
there by hand, and that is what the check reports.

**Name a card `Proposal — <Name>` and not `Annotations …`.** The audit finds
annotations by name and compares the outermost one in each nest, so a wrapper
whose name matched would be compared against the note it contains — which it
overlaps completely, by construction. The card is a container, it is not itself an
annotation, and its name should say so.

Nothing is written into the Annotation Kit itself. It is a shared library, and
the plugin refuses to write into shared libraries for the same reason it refuses
to write into the Pushpin kit.


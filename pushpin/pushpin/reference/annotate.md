# Annotating a design

Notes on a Thumbtack design are placed as instances from the **Annotation Kit**,
a second published library alongside Pushpin. File `Qefv6O2RMPSBtSYBrCGcdI`,
library key `lk-7faccc61…`. The same rule applies here as everywhere else in
this plugin: import and instance, never draw. A drawn note looks the same in a
screenshot and behaves differently in every other respect — it will not update
with the kit, it is invisible to the audit, and it tells a reviewer that the
file was assembled rather than composed.

**One exception, and it is decided by the preflight rather than by preference.**
When the access preflight in [generate.md](generate.md#the-access-preflight)
reports the Annotation Kit out of reach, notes are drawn — see [When the
Annotation Kit is out of reach](#when-the-annotation-kit-is-out-of-reach). The
alternative was abandoning the whole run over a library the design may never have
needed, which is a worse answer than an imperfect note. This is not a license to
draw when the kit is available: if the import succeeds, drawing a note is the
defect it always was.

`assets/annotations.figma.json` is the catalog: 91 published components across
the kit's four pages, each with its import key and each property's exact `key`
field. Read a name and a variant option out of it rather than typing one. Some
published names are misspelled in the file, and the misspelling is load-bearing:
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
await figma.loadFontAsync(body.fontName);
body.characters = 'Proposed: FilterChip\nExtends: Chip\n…';
```

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

### The rest of the General page

Not annotation vocabulary, but published from the same library and worth knowing
exists rather than rebuilding: `Framing Cards` for the why behind a project,
`Project status` / `Project overview` / `Thumbnail` for file-level metadata,
`Figma file structure` for page naming, `Gesture / …` and `Cursor / …` for
interaction diagrams, `Motion Tokens`, `Line`, `Endpoint`, `Studio Feedback`,
`Team Member`, and `Deprecated` for overlaying work that is no longer in use.

## The proposed-component note

When the plugin creates a local `Proposed / <Name>` component — the gate for
that is in [generate.md](generate.md) — it states the case on the canvas next to
it. The body is key-value lines: it reads in a 320px box, and the audit parses
it to tell a documented proposal from an undocumented lookalike.

```
Proposed: FilterChip
Extends: Chip
Derived: Chip / theme=secondary, size=medium
Tier: better-experience
Delta: adds a count badge; Chip offers left/right icons only
```

| Field | Required | Content |
|---|---|---|
| `Proposed:` | always | The component name, matching the local component after `Proposed / ` |
| `Extends:` | always | The closest published Pushpin component, or `none` |
| `Derived:` | always | The exact variant the component was detached from, or `none` |
| `Tier:` | always | `gap` or `better-experience` |
| `Delta:` | extensions | One line on what the published component cannot express |
| `Case:` | net-new | The business argument for adding it to the system |

`Derived` records that the proposal was built by detaching a real instance
rather than drawn from scratch — the rule is in
[generate.md](generate.md#derive-it-do-not-rebuild-it). It matters to a reviewer
because it is the difference between "Chip plus a count badge" and "something
Chip-shaped", and the second one quietly loses the type ramp, the padding, and
the border weight on its way to looking similar.

`Tier` records which argument the reviewer is being asked to accept. `gap` means
no published component covers the interaction without lying about its API or
breaking a Pushpin rule. `better-experience` means something could be stretched
to cover it and a new component would be clearly better. Both are legal; they
are not the same claim, and a reviewer who cannot tell them apart cannot weigh
either.

A note missing `Tier` or `Derived`, or a `Proposed /` component with no note at
all, is a defect. The annotation requirement is not satisfied by an empty
sticky.

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
bundle.itemSpacing = 84;              // the capstone's air, applied once
bundle.fills = [];
bundle.x = target.x;                  // the only coordinates in the arrangement
bundle.y = target.y;

const body = figma.createFrame();
body.name = 'Design and notes';
body.layoutMode = 'HORIZONTAL';
body.primaryAxisSizingMode = 'AUTO';
body.counterAxisSizingMode = 'AUTO';
body.counterAxisAlignItems = 'MIN';   // top-aligned, not centred
body.itemSpacing = 80;                // the gutter, applied once
body.fills = [];

bundle.appendChild(body);
body.appendChild(target);             // the duplicate, at its own size
body.appendChild(col);                // the column, built below
```

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
| `col.x = target.x + target.width + 80` | `body.itemSpacing = 80` |
| `col.y = target.y` | `body.counterAxisAlignItems = 'MIN'` |
| capstone x, plus frame + gutter + column for its width | `capstone.layoutAlign = 'STRETCH'` |
| ~84 points of air under the capstone | `bundle.itemSpacing = 84` |

- **Gutter 80** between the design's right edge and the column. Wide enough that
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
col.itemSpacing = 24;                 // the gap, applied once
col.fills = [];
```

- **Gap 24** between items, set on the column and never on an item.
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
design, then an open question for each unresolved atom.

### Each proposal is a card, and the card carries a specimen

`Delta: adds a count badge` is not a readable claim unless the thing with the
count badge is in view. Numbering answers *where on the design*; it does not
answer *what does it look like*, so a note on its own asks the reviewer to hold
the component in their head while reading five lines about it, or to scroll back
and forth to compare. That is the same failure as an overlapping note arriving by
a different route.

So a proposal's note never sits in the column alone. **An instance of the
`Proposed / <Name>` component goes beside it, in one auto-layout with it.**

```js
const card = figma.createFrame();
card.name = `Proposal — ${name}`;     // not `Annotations …`: see Nothing overlaps
card.layoutMode = specimen.width <= 320 ? 'HORIZONTAL' : 'VERTICAL';
card.primaryAxisSizingMode = 'AUTO';
card.counterAxisSizingMode = 'AUTO';
card.counterAxisAlignItems = 'MIN';
card.itemSpacing = 16;
card.fills = [];
card.appendChild(specimen);
card.appendChild(note);
card.layoutAlign = 'STRETCH';         // as every child of the column does
```

- **Beside the note when it fits, above it when it does not.** Derived from the
  specimen's width against the note's 320, not chosen. A 375-wide banner set
  beside a 320 note makes the commentary wider than the design it comments on.
- **An instance of the local component**, from `main.createInstance()` — not a
  copy of the instance already on the design. A copy carries that instance's
  overrides, and what a reviewer is being asked to approve is the component's
  default, because the default is what would land in the library.
- **At its natural size.** Never resized to fit the column. A specimen scaled to
  fit misreports its padding and its type size, which are exactly the details
  [deriving rather than rebuilding](generate.md#derive-it-do-not-rebuild-it)
  exists to preserve — a scaled specimen hides the drift the specimen was added
  to expose.
- **One specimen per variant** when the proposal is a component set, in a nested
  horizontal auto-layout inside the card, so the axis the proposal adds is
  visible rather than asserted in prose.
- **A specimen is not usage.** The audit counts instances inside the design
  frame, and the column is a sibling of the frame rather than a descendant, so a
  specimen never inflates a proposal's instance count. Do not move the column
  inside the design frame to keep them together; the bundle already does that,
  and nesting it there would both corrupt that count and put annotations inside
  the thing they annotate.

The card is also what a person moves. Dragging a proposal to the top of the
column takes its specimen and its note along, and nothing needs re-aligning
afterwards, which is the difference between a layout that survives review and one
that gets cleaned up by hand once and then abandoned.

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
  points, which is `bundle.itemSpacing`. Never overlapping what it heads, and
  never inside it; being a sibling above the body in a vertical auto-layout makes
  both impossible rather than merely discouraged.

### Nothing overlaps

The audit checks it — pairwise bounding-box intersection among every annotation,
and between any annotation and the design frame. An intersection is a defect, not
a warning, because an unreadable note is worth exactly as much as an absent one
and costs more to produce.

The two rules that keep it true: everything below the bundle is laid out by a
parent auto-layout, and nothing but a `Pointers` instance is ever placed on the
design itself.

**Name a card `Proposal — <Name>` and not `Annotations …`.** The audit finds
annotations by name and compares the outermost one in each nest, so a wrapper
whose name matched would be compared against the note it contains — which it
overlaps completely, by construction. The card is a container, it is not itself an
annotation, and its name should say so.

Nothing is written into the Annotation Kit itself. It is a shared library, and
the plugin refuses to write into shared libraries for the same reason it refuses
to write into the Pushpin kit.

## When the Annotation Kit is out of reach

The access preflight in [generate.md](generate.md#the-access-preflight) resolves
one Annotation Kit key before anything is built. When that import fails, the run
does not stop — it draws the notes instead, and says so. Only an unreachable
Pushpin stops a run, because Pushpin is the only one of the three whose absence
leaves nothing to place.

The reasoning is worth stating, because it runs against this page's own rule.
Reaching Pushpin without reaching the Annotation Kit is the ordinary case, not
the exotic one. Refusing to generate in that setup meant a layout built entirely
from published components, proposing nothing and needing no note, still failed —
over a library it would never have opened. A drawn note is worth less than an
instanced one. It is worth far more than no screen.

### What to draw, and what not to

Only the working set this workflow actually places. The kit publishes 91
components and approximating all of them would be a second design system nobody
asked for.

| Instead of | Draw | Sized |
|---|---|---|
| `Annotations` · `Multi-line` | `Annotations (drawn) / Multi-line` | 320 wide, height hugs, 288 text column |
| `Annotations` · `List Elelemt` | `Annotations (drawn) / List Elelemt` | 360 wide, height hugs, a number and a body |
| `Annotations / Pointers` · `Number` | `Annotations (drawn) / Pointers · Number` | 24×24, `cornerRadius/full` |
| `Sticky Note Status` · `Open Question` | `Annotations (drawn) / Sticky Note Status` | 320 wide, height hugs |
| `Capstones` | `Annotations (drawn) / Capstones` | the width of the block it heads, 112 tall |

**Do not approximate the rest.** The accessibility annotations, `Guide`,
`Framing Cards`, the Thumbprint contribution components, and everything else on
the General page carry meaning in their own structure — an `A11y / Annotation /
Spec` says "this is an `h2`" because of which published component it is, and a
drawn box saying `h2` is a different and much weaker claim. If one of those is
what was asked for and the kit is out of reach, say the kit is out of reach.

Directional `Pointers` are also not drawn. A pointer's whole job is to aim, an
approximated arrow aims badly, and the numbering scheme in [Anchoring](#anchoring-number-dont-point)
already removes the need for one. **When notes are drawn, number them regardless
of how few there are** — the three-or-fewer case that allows pointers assumes a
real `Pointers` instance.

### Drawing one

The stand-in mimics the real component: same width, same padding, same corner
radius, so the column reads as it always does and a reviewer is not asked to
decode a new visual language on top of reviewing a design.

```js
const note = figma.createFrame();
note.name = 'Annotations (drawn) / Multi-line';
note.layoutMode = 'VERTICAL';
note.counterAxisSizingMode = 'FIXED';      // 320 wide, like the real one
note.resize(320, 1);
note.primaryAxisSizingMode = 'AUTO';       // height hugs the text
```

Everything after that is the ordinary rules of this plugin, which is the point —
a drawn note is held to the same standard as anything else generated here:

- **Bind the fill.** `background/neutral/default` with a
  `border/neutral/default` stroke. The audit's fill check is scoped to the design
  frame, and a note in the column sits outside it, so nothing will catch a literal
  here for you — which is a reason to be careful with it rather than a licence. A
  drawn `Pointers · Number` does sit on the design and is checked.
- **Bind padding and radius.** `space/4` padding and `cornerRadius/medium`, never
  literal numbers. Same rule as any frame this plugin creates.
- **Use a published text style.** `Text/3` for the body via
  `setTextStyleIdAsync`, from `assets/styles.figma.json`. Raw font settings are
  what a rebuilt-from-scratch proposal shows first, and the same applies here.
- **Keep the body text byte-identical** to what an instanced note would carry.
  The audit finds proposal notes by reading `TEXT` characters for `Proposed:`
  anywhere on the page and never checks what kind of node they sit in, so a drawn
  note satisfies the `Tier` and `Derived` requirement exactly as an instance
  does. Do not reformat it because it is drawn.

Placement does not change at all. Auto-layout lays out frames and instances
identically, so the bundle, the gutter, the gap, the ordering, and the no-overlap
guarantee all hold without modification. A drawn note goes in a
[proposal card](#each-proposal-is-a-card-and-the-card-carries-a-specimen) beside
its specimen exactly as an instanced one does — the specimen is an instance of a
local component and needs no library at all, so it is the one part of an
annotation that never degrades.

### It is reported, not hidden

Drawn notes go in the audit's `degraded` bucket, which does not fail the run, and
the chat handoff names the library that was out of reach. That is the whole
bargain: the notes are honest about being second-best, and the reader is told why
in the one place they are certain to look.

The naming carries it on canvas. `Annotations (drawn) / Multi-line` tells the
next person who opens the file what happened, and it is what the audit matches
on — which is why the prefix is not optional and not `Note` or `Annotation`.

## The promotion path, which this plugin does not walk

A proposal annotated on a product file is not a contribution to Thumbprint. The
Annotation Kit's **Thumbprint page** documents what an actual contribution
involves, and the plugin records it here so the next step is known — it does not
place any of it and does not perform any of it.

The page holds three sections:

- **Tokens** — 43 published swatch components (`Color / Blue`, `Font / Title 1`,
  `Space [Web]`, `Shadow`, `Corner Radius`, `Duration`, and so on) for calling
  out a token on canvas. These document Pushpin's variables; they are not a
  second source of truth for token values. [tokens.md](tokens.md) and
  `assets/tokens.figma.json` are.
- **Thumbprint** — `Contributing`, `Contributing / Pages`,
  `Contributing / Instructions`, and `Contribution / Checklist`.
- **Cheatsheets** — `Branching`.

The flow those components describe:

1. **Branch the library.** From the dropdown next to the library name, create a
   branch named `Component / intent` — the component as the prefix, then the
   reason for the change; the file's own worked example is a tooltip gaining a
   top-border option. Changes on a branch do not affect the main file.
2. **Make a `🤖 Handoff` page** in the branch and insert
   `Contribution / Checklist` on it.
3. **Fill in the checklist's six items**, marking each `Done` as you go:
   *Internal audit* (screenshots of the pattern already in Thumbtack apps and
   sites), *External audit* (the same pattern in other products), *Explorations*
   (at least two or three options, with feedback from Thumbprint platform leads),
   *Figma component* (the component that will actually be added to the library),
   *Specs & spacing*, and *Examples* (mocks of the proposal in product context).
4. **Request review** from the design system lead through the branch review
   modal.

Steps 1 and 3 are the ones that matter for an agent-authored proposal: the audit
and exploration work is human judgment about whether Thumbtack should own this
component, and an on-canvas `Proposed /` note is the raw material for it, not a
substitute.

# Documenting a flow as a state catalog

A flow spec is a **catalog of states, not a sequence of transitions.** Every
unique state appears once, the states are grouped by what the user was trying to
accomplish, and each one carries the two or three facts an engineer needs to
build it.

The distinction decides what the artifact is worth. A transition diagram answers
"how did we get here", which the person building it already has from the ticket,
and it answers "what do I render" only by making them hold two frames in their
head at once. A catalog answers the second question directly and drops the
first — and a state that appears in three transition pairs appears in it once
instead of three times.

**The arrangement is the easy part; reorganizing the content is the work.** It is
also the part that gets skipped, because the source document is already organized
and mirroring it feels like faithfulness. It is not: the source was organized
around how the flow was designed, and the catalog is organized around how it will
be built.

## Lanes are journeys, not features

Group states into broad user-journey lanes. A good lane answers *what is the user
trying to accomplish*, not *which UI element changes*.

The failure is granular lanes that mirror the source's own headings:

> **Wrong** — eight lanes: Opening, Picking, Cap, Empty slot, Search, Chips,
> Reordering, Removing.
>
> **Right** — four lanes: Starting point, Selecting reviews, Browse and filter,
> Managing the list.

The merge signal is concrete rather than a matter of taste: **if two source
groups share a page or modal and the user moves between them without leaving it,
they are one lane.** Search and filter chips are both "Browse and filter".
Picking, capping, and the empty slot are all "Selecting reviews". Eight lanes is
usually the source's table of contents wearing a new name, and it hands over as
eight headings a reader has to re-merge themselves.

Lane names are sentence case, like every other label this plugin writes —
[rules.md](rules.md).

### One row per lane

Every state in a lane goes in one horizontal row. **Wide is fine.** The frame
hugs its content and horizontal scrolling on a documentation frame costs nothing;
six cards at 840 points each is a row past 5,000 points wide and it is correct if
those six states are one journey.

A second row inside a lane is justified only when the states divide into
sub-phases an engineer would build separately — a Checkout lane with a shipping
row and a payment row. **"It is getting wide" is not that reason.** Splitting for
width reintroduces exactly the feature-level sub-grouping the consolidation
above removed, and it does it invisibly, because the result looks tidier than
what it replaced.

## Labels describe the state, not its place in the sequence

A label should tell someone what to render without their reading the state before
or after it. Transition language fails that by construction: "Before selection"
means nothing on its own, and its meaning is stored in a different card.

| Not this | This |
|---|---|
| Before selection | Shortlist visible |
| After selection | Review added |
| Step 5 | Five of six filled |
| Six selected (after) | Cap reached |
| Search active | Search filtering |
| Drag started | Row grabbed |
| Confirm removal | Confirmation dialog |

The right-hand column is doing something the left-hand column cannot: it survives
reordering. Lanes get rearranged during review, and a catalog labelled by
position is wrong the moment one is.

Sentence case, again, and it is the rule most often lost in this doc
specifically — a state label reads like a heading and headings are where title
case creeps back in. Nothing will catch it for you either: `copy.mjs` wants
corroborating evidence before it calls title case, so that a column of business
names does not light up, and a two-word label like `Shortlist Visible` gives it
none and passes clean. This is a rule you hold, and the audit's copy bucket is
not the backstop here that it is for a screen.

## A bullet is a behavioral contract

Two or three bullets per state, each one a fact about what this state shows.
Write from the UI's side, not the flow's:

> **Wrong** — `· User clicks the card to select it`
>
> **Right** — `· Checked card fills the next empty slot`

The wrong one describes the transition that arrived here, which is the thing the
catalog exists not to be organized around; it also belongs to a different card,
since a state reached two ways would need two of them.

Two or three is a ceiling about the reader, not about effort. A state carrying
six bullets is either two states or a design rationale that belongs in a Design
notes section at the bottom of the frame. **No paragraphs.** A caption long
enough to have a second sentence is one nobody scanning a wall of states will
read.

These labels and bullets are the frame's own words, so
[copy.md](copy.md) governs them like any other copy this plugin writes: sentence
case, the product's own terms, active voice. What does not reach them is the
per-component length limit, because no component owns them — the two-or-three
ceiling above is this page's limit and it is the only one that binds here.

## Two ways in

Both paths land on the same arrangement. Which one applies is decided per state,
not per run: most real flows have some states drawn in the file and some that
exist only as a line in a spec.

**Reflow, when the states are already in the file.** The page read in
[context.md](context.md#reading-the-page-off-names-and-boxes) is the raw
material — it already treats a suffixed sibling as a state, so `Results (empty)`
and `03 Payment — error` arrive named as what they are. Two rules on top of it:

- **Duplicate, never reparent.** Moving the originals into the catalog empties
  the user's flow document, and they cannot undo it —
  [generate.md](generate.md#where-the-work-gets-written) is the whole argument,
  and reparenting is the form it takes here.
- **Dedupe.** A state the source shows in three places appears once. This is the
  single thing reflow does that copying the page does not, so a catalog that
  kept the duplicates did not get built.

**Build, when they are not.** Each state is generated through the whole of
[generate.md](generate.md): the [access preflight](generate.md#the-access-preflight)
before any node exists, [one import batch](generate.md#the-imports-go-in-one-batch)
per call, spacing through [`space()`](generate.md#spacing-goes-through-space),
published styles for type, copy composed correct under
[the content rules](generate.md#writing-the-copy), and a marked placeholder for
anything that [cannot be resolved](generate.md#unresolved-atoms-are-placed-never-dropped).
Nothing about a documentation frame loosens any of it. A state card holding a
drawn lookalike is worse here than on a product screen, because the whole point
of the card is to tell an engineer what to build.

Where the frame goes is a question either way. A reflow has no frame to duplicate
— the catalog is net-new even when every state in it already exists — so it takes
the "ask where net-new screens go" branch of
[generate.md](generate.md#where-the-work-gets-written) rather than the duplicate
one.

## The arrangement

```
Shortlist — states [Aug 24]        main frame · vertical · hug both
├─ Capstones · Small               section header · stretched
├─ Browse and filter               lane · vertical · stretched · hug height
│  └─ States                       row · horizontal · top-aligned · hug both
│     ├─ Search filtering          card · vertical · hug both
│     │  ├─ "Search filtering"     Title/7
│     │  ├─ <instance>             the UI, at its own width
│     │  └─ Notes                  vertical · stretched · 2–3 bullets
│     └─ Cap reached               …
└─ Managing the list               …
```

| Frame | Padding | Gap |
|---|---|---|
| Main | 48 | 32 |
| Lane | — | 24 |
| States row | — | 48 |
| State card | — | 12 |
| Notes | — | 4 |

Every one of those goes through [`bindSpacing()`](generate.md#spacing-goes-through-space)
like any other frame this plugin creates; a dash is 0, which that helper leaves
alone and never binds.

**The states row is 48, and the spec that produced this arrangement said 40.**
Forty is not a step on the scale. `space()` would snap it to 48 anyway, on every
row, and each snap would write a drift record and pull a `Token drift` note into
the handoff disclosing a number nobody chose. Writing 48 is the same layout with
nothing to disclose.

**Nothing here has a fixed width.** The card hugs its instance, the row hugs its
cards, and the main frame hugs the widest row. Prescribing a card width is the
one measurement that cannot survive contact with a second flow, whose components
are a different size. The notes column follows the same way: stretch the notes
frame to the card and fill its text to the notes frame, and the bullets take the
instance's width because the instance is what set the card's — measured by
nobody, correct after a variant swap.

The same derivation settles the two widths the source spec measured by hand.
Every direct child of the main frame stretches, so the frame takes the width of
its widest lane and the capstones and narrower lanes take the width of the
frame. A capstone is never short and never has to be told how wide the catalog
is, which is the argument [annotate.md](annotate.md#placing-a-capstone) already
makes for the bundle's own heading.

**Top-aligned rows.** `counterAxisAlignItems = 'MIN'` on the states row. Cards
have different heights because their instances do, and centring them makes the
labels wander down the row and stop reading as a row of labels.

**`clipsContent = false` on the structural frames, never on the UI instances.**
The structural frames are containers, and clipping one crops the drop shadows the
Pushpin components cast past their own bounds. An instance is the opposite case:
a component that clips does so deliberately — a card cropping a photograph — and
turning that off shows a reviewer something the built component will not do.

### Type and colour

| | Style | Colour |
|---|---|---|
| State label | `Title/7` | `heading/neutral/default` |
| Annotation bullet | `Text/2` | `text/neutral/medium` |
| Main frame fill | — | `background/neutral/default` |

Type comes from published styles through `setTextStyleIdAsync`, never from raw
font settings — [generate.md](generate.md#applying-type-and-elevation) — and the
style's own line height is the answer even when a spec asked for another one.
`Text/2` is 14px at 140%, and a spec asking for 14px at 120% is asking for
`Title/7`'s metrics on a Regular weight, which is not a thing the kit publishes.

The fill is bound, not written. A literal `#ffffff` is a defect the audit reports
and it is also wrong half the time: `background/neutral/default` is `#ffffff` in
light and `#1f2022` in dark, so a hand-typed white frame turns into a white frame
full of white text the first time someone flips the file.

**The main frame is the only one with a fill.** The lanes, the states rows, the
cards and the notes frames are containers, and a container arrives opaque white,
so each one is cleared — `fills = []`, as
[annotate.md](annotate.md#the-column) does for the note column. A frame left at
that default is the literal-fill defect above, arrived at by not typing anything.

```js
const [heading, secondary, surface] = await Promise.all([
  figma.variables.importVariableByKeyAsync('5998fc0d137a0bd74ea86e565db08fde0764267b'), // heading/neutral/default
  figma.variables.importVariableByKeyAsync('9dd9e8c8bf9c120b171f6df89265540a54ed14ce'), // text/neutral/medium
  figma.variables.importVariableByKeyAsync('0b43416c94f4574fa65dfd61d401821eb1c6aaec'), // background/neutral/default
]);
```

Those ride in [the call's own import batch](generate.md#the-imports-go-in-one-batch)
with everything else it needs, and a text fill binds through
`setBoundVariableForPaint` like any other paint —
[generate.md](generate.md#binding-variables).

### The section header

`Capstones` at `Size: Small`, stretched, one above each section of the catalog.
It is a component set, so it is the set key and then a variant:

```js
const set = await figma.importComponentSetByKeyAsync('49c39a47554a41882c1798089d1f741cefed5cd0');
const capstone = set.defaultVariant.createInstance();
capstone.setProperties({ Size: 'Small' });
capstone.layoutAlign = 'STRETCH';
```

The published Small is 485×112 — 32 points of padding above and below a 40px
title — and that height is why the compact form exists: three of them down a
catalog and the section headers stand taller than several of the states they
head. Overriding the inner `_base / Capstone` instance to 24 horizontal and 16
vertical, with the title at 24px, roughly halves it, and it reads as a separator
rather than as a title card.

That override is an instance override, which
[generate.md](generate.md#placing-a-component) otherwise forbids outright. **The
carve-out is narrow and it is written where the prohibition lives** —
[the one exception is annotation furniture](generate.md#the-one-exception-is-annotation-furniture).
Two things it does not extend to. The padding goes on the *inner*
`_base / Capstone` instance and not the outer one, and no check will catch that
if it goes on the wrong node — both the fill check and `literalSpacing` skip
everything inside an instance, so this is a rule you hold rather than one the
audit holds for you. And the title's 24px is a raw font size, permitted here and
nowhere else in this plugin; if the exception is ever narrowed, `Title/3` is
where it lands — Bold 22 at 110%, two points off, and nothing in a section header
depends on the two points.

Setting the text is the ordinary annotation recipe: the body lives in a `TEXT`
node rather than in a component property, and the kit's font is not one an agent
has — [annotate.md](annotate.md#setting-the-text).

## One fill call per swim lane

The catalog decomposes like every other write path here —
[skeleton then fill](parallel.md#skeleton-then-fill).

**The skeleton claims the main frame, the capstones, the lane frames, the states
rows, and one empty state card per state — each named, each in its final order.**
The order is the reason. A row of state cards is read left to right, so its child
order *is* the flow, and two calls appending into the same row race for it with
neither script able to tell which one ran first —
[disjoint subtrees are not disjoint effects](parallel.md#the-invariant). Handing
each lane a row of empty cards it fills in place removes the race entirely, and
it is the same move [annotate.md](annotate.md#filling-the-cards-in-parallel)
makes for the notes column.

**Then one call per swim lane,** each holding [the lane contract](parallel.md#the-lane-contract):
its own page switch, its own import batch, its own font load, its own ids pasted
in as literals.

Two budgets meet awkwardly on this path and it is worth knowing which gives.
[About six lanes](parallel.md#the-ladder) is the ceiling on parallelism, and a
catalog with more than six sections groups them rather than opening a seventh
call. The ten-operation ceiling is per *call*, and a swim lane will routinely
exceed it — six states at a label, an instance, and a notes frame apiece is
already past twenty. **So a large lane splits sequentially inside itself, never
into a second call onto the same row.** Two calls writing into one states row is
precisely the collision the skeleton was built to rule out, and reopening it to
save a round trip trades a correctness property for a few seconds.

[Join before annotating or auditing](parallel.md#join-before-annotating-or-auditing),
as everywhere else: a lane still running is indistinguishable from one that
failed.

## When the Annotation Kit is out of reach

The preflight has already decided this, and only the section header is affected —
nothing else in a catalog comes from the kit. It degrades to
`Annotations (drawn) / Capstones` by the row already published on
[annotate-fallback.md](annotate-fallback.md), at the width of the block it heads.
Add nothing to that.

The exception above stops applying at the same moment, and not as a special case:
a drawn capstone is a frame this plugin created, so there is no instance to
override and every ordinary rule — bound fill, bound padding, a published text
style — applies to it unchanged.

## Seven ways it turns back into a flow diagram

Each of these produces a document that still looks like a state catalog:

- **The source's groupings, kept.** Eight lanes named after eight source
  headings. The frame is new and the organization is not, which is the whole of
  what was being asked for.
- **A lane split across rows to manage width.** Two rows now stand for a
  distinction that does not exist, and the next reader will look for one.
- **Labels naming a position.** Step 1, Before, After. Correct until someone
  reorders a lane, and silently wrong after.
- **Before-and-after pairs as the organization.** The same states, again, under
  a catalog's arrangement.
- **A state shown twice.** Two cards that disagree the moment one is updated, and
  nothing to say which is current.
- **A paragraph where a bullet belongs.** Design rationale is not a behavioral
  contract, and a wall of states is scanned rather than read. It goes in Design
  notes at the bottom.
- **Decoration in place of structure.** Colour tags, step-number badges, arrow
  connectors. Left-to-right already carries the reading order, a badge restates
  the position the labels were just rewritten to stop carrying, and a colour
  legend is a second vocabulary a reader has to learn before the first one
  becomes useful.

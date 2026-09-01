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

**The panels of one modal are never separate lanes**, and that is the signal
applied rather than an exception to it. A two-pane modal — a rail that selects and
a pane that shows what was selected — is one surface the user never leaves, so
"browsing the rail" and "filling the fields" are one journey however cleanly the
source separates them. Splitting there is the failure that then propagates: the
region below is derived from the lane, so a lane holding one panel can only ever
produce a card holding one panel.

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

## What a card shows is decided per lane

*How much of the panel goes in each card* — the whole page, the modal, or just
the part that changed — is the question this page is most likely to get asked out
loud instead of answering. **The derivation is not the user's to supply; the cost
of exceeding it is.** The rule below settles what the region *is* from the lane's
own bullets, with nothing to ask, and that half is this page's answer. What it
cannot settle is whether a wider region is worth paying for when the derived one
is cheap and the wider one means building the surface by hand — that is a
tradeoff about the user's time, and
[generate.md](generate.md#the-checkpoint-is-one-call-with-two-questions) states it
at the checkpoint rather than resolving it quietly in favour of cheap.

Asking the derivation during a build is still the thing
[generate.md](generate.md#the-checkpoint-is-one-call-with-two-questions) rules
out at its checkpoint: departures get stated once, before anything is written,
not raised one state at a time — and the checkpoint's own two questions are
where and what to run, not what a card holds. **Its preamble names the lanes and
the region each one shows**, in a line, derived by
the rule below — so a wrong guess costs the user a correction instead of a
question.

**A card shows the smallest region containing every element the lane's bullets
mention, and every card in that lane shows the same region.**

The lane is the unit because the row is what gets read. Cards sit side by side so
a reviewer can see what changed between them, and that only works if both are the
same crop of the same thing. A card holding a whole panel beside one holding a
chip row asks the reader to align two frames themselves before they can spot a
difference — which is the work the row was supposed to do for them.

Both ends of the range fail, for opposite reasons. **The whole screen, six times
across a row,** reduces the difference between two states to a few points of a
very large picture: present, and nobody will find it. **The changed element
alone** fails the other way, since a chip row with no panel around it does not say
where it lives, and an engineer cannot place what they cannot locate. The
smallest *enclosing* region clears both — the panel holding the chips, not the
page holding the panel, and not the chips by themselves.

**Two sibling regions that are one control surface count as one region, and the
answer is the parent that holds both.** The test is whether one region's content
is a function of the other's state: a rail that selects and a pane that shows
what was selected, a filter column and the results it filters, a step list and
the step. Press something in one and the other is what changed — so the smallest
region containing what the bullets mention is the parent, and deriving otherwise
means the bullets were written about one half of a two-half interaction.

The rail alone shows a press with no result. The pane alone shows a result with
no cause, and an engineer reading it cannot tell what produced the state they are
being asked to build. Neither is a smaller version of the right answer; both are
a different artifact that happens to be cheaper.

This is also why [the merge signal](#lanes-are-journeys-not-features) rules the
panels of one modal out as lanes. Coupling is the same fact read at the level of
the region rather than the level of the journey, and a run that got the lanes
right will usually never reach this paragraph.

Different lanes land on different regions, and usually should. A confirmation
lane shows the dialog; a browse-and-filter lane shows the panel the filters live
in. Nothing needs those two to agree, because nobody reads across two rows at
once.

**A state whose change is unreadable at its lane's region is telling you about the
lane, not the region.** Either the lane groups states that are not one journey —
[lanes are journeys](#lanes-are-journeys-not-features) — or that state belongs in
a different one. Zooming the one card that fell short breaks the comparison for
the whole row to rescue a single member of it.

**Unreadable, not invisible**, and the difference is the whole test. A visible
difference an engineer cannot act on passes a visibility check and fails this
one: a rail card where the selected row tints is plainly different from the card
beside it and still does not say what the selection produced. Asking whether
something changed is a question about pixels; asking whether the state can be
built from what is in frame is the question the catalog exists to answer.

None of this is a crop. `clipsContent` stays false on every structural frame —
[the arrangement](#the-arrangement) — so the region is settled by **which
component gets instanced**, never by masking a larger frame down to size.
Instancing the panel and instancing the page then hiding most of it are different
artifacts, and the second hands an engineer a page and a mask where they needed a
panel.

**On the reflow path the source has already decided it.** A state drawn as a full
page gets duplicated as a full page — [two ways in](#two-ways-in) — because
narrowing it to a panel means rebuilding the state rather than moving it, which is
the other path entirely and a far larger job than was asked for. What still binds
is the consistency: a lane whose source mixes a full page with a panel detail
picks one and rebuilds the state that does not match. One card rebuilt is a cost
worth paying where six is not.

### A stated region is a commitment

The region reached the user at the checkpoint and an answer came back. **From that
point it is not a plan this run may revise; it is a thing that was agreed.** When
something found mid-build makes it unaffordable or wrong — a local component that
no longer matches the prototype, a variant the kit does not author, a
whole-surface card that turns out to mean hand-building the surface six times —
the run **stops and returns with the blocker and the choices.** It does not narrow
the region and disclose in the closing summary.

This is the failure the rule is written from. A services catalog was checkpointed
at whole-modal cards; the build then found the file's local modal component
hard-wired a pane-head the prototype had replaced with a combobox, judged hiding
it a forbidden instance override, judged hand-building eight modals too
expensive, and retreated to one panel per lane. Eighteen cards landed at a region
nobody had approved. The retreat was disclosed, accurately, in the last paragraph
of the summary — after the work was done, to a user already looking at the wrong
artifact.

Three things about that are why it is a rule rather than a line in the
[nine ways](#nine-ways-it-turns-back-into-a-flow-diagram) below:

- **The reasoning was sound at every step.** The component really was stale, the
  override really is forbidden, and eight hand-built modals really is expensive.
  A correct chain of local decisions arrived somewhere the user had refused.
- **This page supplied the justification.** The smallest-enclosing-region rule
  reads as a licence for the cheaper artifact, and a run under cost pressure will
  find it. Deriving a region is what that rule is for; defending one the user was
  never asked about again is not.
- **The retreat is to a question, never to the cheaper artifact.** Cost is the
  user's to weigh — [above](#what-a-card-shows-is-decided-per-lane) — and a
  blocker is the moment that weighing became necessary, not the moment it stopped
  being theirs.

A blocker found *before* the checkpoint is not this rule. It is a departure, and
departures are stated in the preamble like any other. A stale local component
belongs there by name: it changes what the catalog can be built from, and it is
discoverable by reading the component before a single card exists.

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

**Every reflow call opens with the traversal guard**, because
duplicating is `clone()` and a state frame is a frame full of instances — the
worst case for
[stale traversal](generate.md#stale-traversal-on-a-subtree-this-call-created)
and the one this path produces by the dozen. A call that duplicates six states
and then reads into one of them to rename a label, measure a region, or check
what it holds is asking the question all four search techniques answer wrongly:
the clone reports 0 or 1 nodes where it has 9 or 24, and reports it without
erroring. One line at the top of the call settles it:

```js
figma.skipInvisibleInstanceChildren = false;
```

A call that only duplicates and never reads back is unaffected, and so is every
later call — a lane reading a state an earlier call cloned gets the whole
subtree with no guard at all. The line costs nothing to write in either case and
the failure it prevents is silent, so write it.

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

Where the frame goes is a question either way, and it is
[the checkpoint's first question](generate.md#the-checkpoint-is-one-call-with-two-questions).
A catalog is net-new even when every state in it already exists, so there is no
frame to duplicate and the "beside the original" answer is not on offer: a
catalog is a new artifact about a flow rather than a second copy of it. What the
user picks between is a clean review page and a page they name.

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

### Several catalogs go in a column

A request covering more than one surface produces one catalog per surface —
[parallel.md](parallel.md#a-batch-of-artifacts) has the orchestration. **The
catalogs stack in a single auto-layout column**, one per row, in the order the
user meets the surfaces, with a gap of 96 and the same 48 of padding a main frame
carries.

The column is auto-layout for the reason nothing else here is positioned by hand:
a catalog hugs its widest lane, so its width is not known until it is filled, and
two catalogs placed at computed coordinates are two guesses about a number
neither one has settled yet. A column asks for no coordinates and cannot overlap.

Ninety-six rather than the main frame's 32 because the reader is crossing between
artifacts rather than between lanes of one, and the section headers inside each
catalog already spend 32-scale gaps. A separation that reads the same as an
internal one turns five catalogs into one long catalog with confusing headings.

Each catalog keeps everything above unchanged — its own capstones, its own hug
sizing, its own regions. Nothing about being one of several loosens a rule, and
the column has no fill, no name of its own beyond the batch's, and no capstone:
the catalogs head themselves.

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
has — [annotate.md](annotate.md#setting-the-text). Reaching that node means
searching an instance created two lines above, which is the shape that goes
wrong on the reflow path and does not go wrong here: the capstone arrived
through `createInstance`, and a fresh instance answers a search completely.
[Stale traversal](generate.md#stale-traversal-on-a-subtree-this-call-created) is
about `clone()` and `detachInstance()`, and neither is on this path.

## One fill call per swim lane

The catalog decomposes like every other write path here —
[skeleton then fill](parallel.md#skeleton-then-fill).

**The skeleton claims the main frame, the capstones, the lane frames and the
states rows, and stops there** — each shimmering, each in its final order. The
cards belong to the lane that fills them and are created inside the row by that
lane.

**Its link goes to the user before the lanes go out** —
[generate.md](generate.md#the-frame-gets-linked-before-it-gets-filled) — and a
catalog is the run that most needs it. It is the longest thing this plugin
writes, a dozen states across several lanes where a screen is one frame, and it
is net-new by construction, so there is no original for it to appear beside.
Where the checkpoint sent it to a review page, the user is not even on the page
it is landing on.

The order still decides this, read one step more carefully than it used to be.
A row of state cards is read left to right, so its child order *is* the flow,
and two calls appending into one row race for that order with neither script
able to tell which ran first —
[disjoint subtrees are not disjoint effects](parallel.md#the-invariant). What
that rules out is two writers, not ordering. A states row has exactly one owning
lane, so the sequence its cards come out in is the sequence that lane wrote them
in, and there is no other call whose position it would have to know —
[one ordered container, one writing lane](parallel.md#one-ordered-container-one-writing-lane).
The notes column in [annotate.md](annotate.md#filling-the-cards-in-parallel) is
the other case and keeps its pre-created cards, because more than one lane feeds
it.

**The budget collision goes with the cards.** A skeleton that had to pre-create
every card for every lane grew with the catalog while the ten-operation ceiling
stayed per call, so a twelve-state catalog put the structure and twelve cards
into one write and neither budget could give. The main frame, the capstones, the
lanes and the rows are a handful of operations however many states the catalog
holds, and each card now costs a lane one operation it was going to spend on
that card anyway.

**Then one call per swim lane,** each holding [the lane contract](parallel.md#the-lane-contract):
its own page switch, its own import batch, its own font load, its own ids pasted
in as literals. Issue them in the catalog's own top-to-bottom order, so the lane
a reader meets first is the one that lands first; the lanes go out in one
message either way, so the ordering costs nothing.

One budget still binds. [About six lanes](parallel.md#the-ladder) is the ceiling
on parallelism, and a catalog with more than six sections groups them rather
than opening a seventh call. The ten-operation ceiling is per *call*, and a swim
lane will routinely exceed it — six states at a label, an instance, and a notes
frame apiece is already past twenty. **So a large lane splits sequentially
inside itself, never into a second call onto the same row.** One owning lane is
what the ordering argument above rests on, and a second call onto the same row
is exactly how a row acquires a second writer.

A lane that split and then failed part way repairs the way
[parallel.md](parallel.md#when-a-lane-fails) has it, on the branch for a lane
that owns what it built: empty the states row and re-run the lane from its first
call. The cards are the lane's own work rather than the skeleton's, so there is
nothing of anyone else's in there to preserve, and the cost is one row.

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

## Dev Mode annotations on a catalog

A catalog can carry notes beyond its bullets, and they are not the ones
[annotate.md](annotate.md) describes. Figma publishes annotations of its own —
the `Y` tool, `node.annotations` in the API — which attach to a node and open in
Dev Mode against the element itself. The Annotation Kit publishes cards that sit
on the canvas beside a design. Both are called annotations, and which one a
catalog wants is settled in
[annotate.md](annotate.md#two-annotation-systems).

**A catalog takes native annotations and no kit notes at all.** The state card
already carries [two or three bullets](#a-bullet-is-a-behavioral-contract) about
what the state shows, so a kit note parked beside that card is a second copy of
the same channel — same subject, same reader, twice the furniture. What a card
cannot do is point at a control. A note on the commit button is read by an
engineer who has selected the commit button, and no arrangement of cards
arranges that.

They also cost the canvas nothing. A native annotation is invisible in design
mode, so the catalog still reads as a catalog, and `node.annotations = []`
takes one back.

### Interaction is the only category

Every annotation carries a category. Figma's presets are Development,
Interaction, Accessibility and Content, and a file usually adds more beside them.
**On a catalog, Interaction is the whole allowlist.**

The three it leaves out are left out for one reason, and the reason is
arithmetic rather than taste. Development, Accessibility and Content are
per-element reads — every heading, every landmark, every label, every token. On
one screen that is a bounded pass, and
[annotate.md](annotate.md#read-them-off-the-markup-not-off-the-mock) governs it.
On a catalog the same pass multiplies by the state count and annotates the same
button once per card that contains it, where the sixth copy is worth nothing the
first was not. That product is the wall of notes that gets a catalog handed back
unread, and no amount of restraint inside an unbounded category fixes it.

An accessibility spec is still worth having. It belongs on one annotated screen,
through [annotate.md](annotate.md), where the markup is the source and each
element is read exactly once.

### No property pins

An annotation pins properties as well as prose — `width`, `fills`, `fontSize`,
`padding`, `itemSpacing`, `cornerRadius` and about twenty more, each rendering as
a chip beneath the note. **A catalog pins none of them.**

A pin restates what the Dev Mode inspector shows the moment the node is selected,
to a reader who has just selected it. It costs a row and carries nothing, and
**the pin count is what turns a measured pass into an unreadable one** — pins
multiply per annotation, while notes multiply per decision. A pass held to six
notes still hands over sixty rows if each one pins ten properties, which is the
shape this rail exists to prevent and the one a note budget alone does not catch.

The carve-out, if it is ever wanted, is a value that is a constraint rather than
a measurement — `maxWidth` on a column that must not grow, `minHeight` on a row
that must not collapse. A constraint is the one thing the inspector cannot show,
because it reports this frame's value and the constraint is about the frames this
one is not. Nothing else qualifies.

### One note per control, in the state that shows the behaviour

A control appearing in six states is annotated once, in the state where the
behaviour is legible — the commit button where rows are staged, not where the
panel is empty — and left bare in the other five.

Annotating each appearance produces six notes a reviewer must compare before
concluding they agree, and six places to correct when the behaviour changes. The
row is what makes one enough: cards sit side by side, so a reader who found the
note has the other five states already in view.

### A control its card already describes gets nothing

The bullets are a behavioural contract, so an annotation earns its place only by
saying what they do not. A plus button whose card already reads *plus becomes a
close button* has been documented; annotating it adds a pin and no fact.

This is the test that does most of the work, and it is why lanes come out uneven.
A lane whose bullets happen to cover its controls gets no annotations at all,
and that is the rule working rather than the pass giving up.

### What the budget lands on

Six controls across a thirteen-state catalog is the observed shape — one or two
per lane, and one lane with none. **Roughly one annotation per two states is the
calibration**, and a pass arriving at one per state has stopped applying the test
above.

### Writing them

Category ids are per file, so resolve by label rather than pasting one in:

```js
const cats = await figma.annotations.getAnnotationCategoriesAsync();
const interaction = cats.find((c) => c.label === 'Interaction');

node.annotations = [{
  labelMarkdown: 'Commits the staged rows and closes the panel. Staging is '
    + 'client-side — nothing is written to the service list until this is pressed.',
  categoryId: interaction.id,
}];
```

**Annotations reach inside instances**, which is what makes per-control targeting
possible at all. A note lands on a `remove action` nested four levels into a modal
instance, and that is the normal case here rather than a trick: a state card holds
one instance, and every control worth annotating is inside it.

### Three ways the write goes wrong

- **Read-back is not the write shape.** Reading `annotations` returns both
  `label` and `labelMarkdown` populated, and the setter refuses an entry carrying
  both — `Only one of label or labelMarkdown should be given`. So a
  filter-and-reassign cannot pass back what it read; it rebuilds each entry it
  keeps.

```js
node.annotations = keep.map((a) => ({
  labelMarkdown: a.labelMarkdown || a.label,
  categoryId: a.categoryId,
}));
```

- **A failed annotation write is not reliably atomic.** The guarantee everywhere
  else in this plugin is that a thrown script changed nothing. A pass that threw
  on the read-back shape above had already cleared notes from two nodes it
  reached first. **Re-audit after a throw** rather than assuming the file is
  where it was, and repair from the audit rather than from the plan.

- **An instance sublayer id does not survive the edit.** `I7376:30302;13256:41171`
  resolved on one call and was gone on the next, because the enclosing instance
  had been re-resolved. Reach a control by traversing from the state card, which
  is a frame this catalog owns and whose id is stable, rather than by pasting a
  path recorded earlier in the run.

## Nine ways it turns back into a flow diagram

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
- **Every card showing the whole screen.** A wall of near-identical pages, each
  with its state difference somewhere inside it. It reads as a catalog and
  answers nothing, because the change has to be found before it can be built.
- **One half of a two-half interaction per card.** A rail of presses whose results
  are in another row, or panes of results with the presses that caused them
  elsewhere. Each row is internally consistent and the flow between them is gone,
  which is a transition diagram with the transitions deleted —
  [coupled regions](#what-a-card-shows-is-decided-per-lane).
- **A paragraph where a bullet belongs.** Design rationale is not a behavioral
  contract, and a wall of states is scanned rather than read. It goes in Design
  notes at the bottom.
- **Decoration in place of structure.** Colour tags, step-number badges, arrow
  connectors. Left-to-right already carries the reading order, a badge restates
  the position the labels were just rewritten to stop carrying, and a colour
  legend is a second vocabulary a reader has to learn before the first one
  becomes useful.

# Proposing a component

Load this only once the gate below has actually opened. Most generation runs
never reach it: the kit publishes 115 components, and the correct answer to
"nothing quite fits" is usually that something does.

**Never draw a component.** The exception this page describes is a way to
declare a gap, not a way to draw one. A drawn pill that resembles a Button is a
defect whether or not a note sits beside it.

## The gate: two checks, in order

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

## What a proposal is

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

## Derive it; do not rebuild it

**A proposal that extends a published component starts as that component.**
Instance the closest variant, detach it, and change only what the proposal is
actually about.

```js
figma.skipInvisibleInstanceChildren = false;   // reads back true at the start of every call

const set = await figma.importComponentSetByKeyAsync(closestKey);
const inst = set.defaultVariant.createInstance();
inst.setProperties({ theme: 'secondary', size: 'medium' });   // the closest variant

const frame = inst.detachInstance();   // keeps type, padding, strokes, radius, bindings
// …change only what Delta names…
const proposed = figma.createComponentFromNode(frame);
proposed.name = 'Proposed / FilterChip';
```

**The first line is not boilerplate, and it belongs above the detach rather than
anywhere after it.** The flag reads back `true` at the start of every `use_figma`
call in this harness, whatever the previous call set it to, so it is a per-script
assignment rather than a setting — and the plugin API typings document the
default as false in Figma and FigJam and true only in Dev Mode, so this is a
divergence rather than something a reader could have predicted. What it costs to
leave alone is the step this section is entirely about. `detachInstance()` with
the flag on hands back a frame whose interior is not materialized, and every
search API then answers a question about that frame confidently and wrongly
instead of throwing: measured on a detached instance,
`findAllWithCriteria({ types: ['FRAME'] })` returned 4 where 9 was correct,
`findAll(() => true)` returned 12 of 25, and `query('FRAME')` returned 4 of 9 —
a 26-node subtree six levels deep, more than half of it invisible to the thing
looking for it. With the flag `false` the blind spot is not reduced but absent:
the same detach reads 43 of 43 nodes on the first call, before anything has
walked it. So one assignment is the whole fix here, and no materialization walk
belongs in this snippet.

The reason to care is that "…change only what Delta names…" is a search. Through
a stale view of the detached frame, the text node or the padding the `Delta` names
is the thing the edit misses, and everything else about the proposal is correct —
which reviews as a proposal that changed nothing, or worse, as one whose note
describes a change that is not on the canvas. Nothing throws, and
[the audit](audit-figma.md) cannot tell that shape apart from a proposal that was
genuinely derived.
[generate.md](generate.md#stale-traversal-on-a-subtree-this-call-created) carries
the full statement of the rule and the reasoning behind it.

The two lines above the detach are safe and want no guard of their own.
`createInstance()` did not reproduce the blind spot under measurement, and
`setProperties` moves variants rather than reading a subtree. Nor is the absence
of an `appendChild` between them an oversight to be repaired: `createInstance()`
parents the new instance to the current page as it creates it — `inst.parent.type`
is already `'PAGE'` — so there is no unparented state here and nothing to adopt it
into.

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
radius, and gap to library variables — gaps and padding through
[`space()`](generate.md#spacing-goes-through-space), radius through all four
corners — use published text and effect styles for type and elevation, and
instance published components for the parts the kit already covers. A proposal
built that way converges on the real component if one ever lands; one built from
literals is just another thing to redo. The audit
holds derived and net-new proposals to the same standard on styles and bindings;
only the starting point differs.

## Rationale on canvas

A proposal nobody argued for is indistinguishable from somebody going
off-system. Every proposal carries its case next to it, placed as **published
Annotation Kit instances** rather than drawn boxes — the same rule as everything
else in generation:

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
reordering a proposal costs nothing. [Placement](annotate.md#placement) has the
nesting, the gutter, the gap, the ordering, and the numbering rule, and the
audit fails on any annotation that overlaps another or the design.

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

[annotate.md](annotate.md) holds the annotation vocabulary — what each type is
for and how to set its text. Read it before placing anything, and take import
keys and property `key` fields from `lookup.mjs --annotation <name>`. The
Annotation Kit has the same trap as Pushpin — names are exact, and at least one
published variant name is misspelled (`List Elelemt`) — so never type one from
memory.

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

## The proposed-component note

When the plugin creates a local `Proposed / <Name>` component — the gate for
that is [above](#the-gate-two-checks-in-order) — it states the case on the
canvas next to it. The body is key-value lines: it reads in a 320px box, and the
audit parses it to tell a documented proposal from an undocumented lookalike.

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
rather than drawn from scratch — the rule is
[above](#derive-it-do-not-rebuild-it). It matters to a reviewer
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

**On a build that declined annotation the note is owed to the chat summary
instead** —
[audit-figma.md](audit-figma.md#when-annotation-was-declined). The same fields
are the same argument wherever they are written, and a proposal nobody argued
for is still the thing this page exists to prevent; what changes is only whether
the canvas or the summary carries it. A note that does exist is held to every
field either way.

## Each proposal is a card, and the card carries a specimen

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
card.fills = [];
await bindSpacing(card, { itemSpacing: 16 }, 'intent');   // bound, like any frame's gap
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
  [deriving rather than rebuilding](#derive-it-do-not-rebuild-it)
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


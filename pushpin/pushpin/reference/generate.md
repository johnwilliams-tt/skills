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

## When the subject is a flow

**Several states of one surface is a single artifact with an arrangement of its
own, and [flows.md](flows.md) settles that arrangement before this page's
workflow starts.** Load it first. It is not an alternative to this page — every
state in a catalog is generated through the whole of what follows here — it is
the half that knows what a flow spec is, where this is the half that knows how to
place a component.

The request that needs it rarely says "catalog". "Send this flow over to Figma",
"spec this for handoff", a link to a document with eight states drawn in it: each
one fits this page's own routing row, and each one wants that one read first. What
comes of skipping it is a page of loose frames, correct component by component,
with the reorganizing that made them worth handing over left undone. It also
leaves questions to ask that the spec had already answered — how much of a
surface a state shows is the one that comes up, and
[flows.md](flows.md#what-a-card-shows-is-decided-per-lane) decides it.

## The rule

**Never draw a component. Import and instance the published one — or, when the
kit genuinely falls short, define a real local component and argue for it on the
canvas.**

If `node scripts/lookup.mjs <name>` returns an entry, use it.
`figma.createFrame()` with a corner radius is only ever correct for layout
containers — never for something the kit already publishes, and never as a quiet
stand-in for something it doesn't.

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

Two cases justify a local component instead of an import: nothing published
expresses the interaction without lying about its API, or something could be
stretched but a new component is clearly the better experience. Either way it is
a real component definition named `Proposed / <Name>`, derived by detaching the
closest published component, with its rationale annotated on canvas.

The gate, the derivation, the note, and its exact fields are in
[propose.md](propose.md). Load it only once the gate has opened — most runs
never reach it.

## When the code already says what it is

Work pushed from a project set up by `init` may name its own components. Code
Connect is not wired for Pushpin — see [figma.md](figma.md) — so without a
declaration this direction has no code-to-component mapping and the choice of
component is inferred from markup. That inference is weakest exactly where it
matters most: Pushpin's ten new components have no React equivalent, so they get
composed from primitives, and a hand-rolled pill is indistinguishable from a
Button by the time it is read.

The convention is written into the project's generated `DESIGN.md`:

```html
<button data-pp-component="Button" data-pp-variant="theme=primary, size=medium">
<div data-pp-proposed="FilterChip" data-pp-extends="Chip" data-pp-tier="better-experience">
```

**A declaration is a hint resolved against the catalog, never a substitute for
it.** Look `data-pp-component` up. On a hit, that entry's `key` is what gets
imported and each `data-pp-variant` pair is checked against the real variant
options. On a miss — an unknown name, a
property the entry does not have, an option outside its list — **discard the
declaration and choose the component the way you would with no declaration at
all**, then say so in the chat summary.

Discarding rather than trusting is the point. A declaration cannot cause an
import the catalog does not already authorize, so the worst a typo can do is
cost back the guess it was meant to remove. A declaration that resolves cannot
make the result worse either: it names a real component, and everything after
the import is unchanged.

`data-pp-proposed` carries the same weight in the other direction. A complete
one — `data-pp-extends`, `data-pp-tier`, and enough to state the delta —
pre-fills the [proposal note](propose.md#the-proposed-component-note)'s fields
from where the decision was actually made, rather than having them invented here
by whoever is furthest from it. An incomplete one is a signal that something was
hand-built, not a licence to skip the gate: [the two checks](#the-gate-two-checks-in-order)
still run, and a proposal still has to be derived rather than drawn.

## Placing a component

Every catalog entry carries the `key` needed to import it, and its `type`
decides which import call to use. Both are the first two lines `lookup.mjs`
prints.

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

### The one exception is annotation furniture

**An Annotation Kit component heading a documentation frame may be overridden.
Nothing else may be, and this does not extend one component further.**

The prohibition above protects claims about product structure. A restyled Button
says an engineer will build this button, and the screenshot cannot contradict it,
which is why the rule is absolute for anything that will be built. A section
header inside a documentation frame makes no such claim: nobody is shipping the
capstone, and its padding is a fact about how a spec reads rather than about the
product it specs. The concrete case is `Capstones` · `Small`, published 485×112
with 64/32 padding around a 40px title — taller, three sections in, than several
of the states it separates. The compact form overrides the
padding on the *inner* `_base / Capstone` instance to 24 and 16, and the title to
24px.

`Proposed / Capstone · Compact` was the alternative and it is worse. A proposal
puts a note and a specimen in front of a reviewer and asks them to approve a
component — and this one would be asking about documentation chrome nobody was
being asked to approve, on a frame whose whole subject is something else. See
[propose.md](propose.md) for what a real proposal costs a reader; a section
header is not worth it.

Two things this exception does not do. The padding belongs on the inner
`_base / Capstone` instance and not the outer one, which is a distinction with no
enforcement behind it: **the audit catches neither placement**, because both
`literalSpacing` and the fill check skip everything inside an instance
— [audit-figma.md](audit-figma.md) — and the override sits inside one either way.
This is a rule held by whoever is writing, not one a check is watching. And the
24px title is a raw font size, which is otherwise never correct here; `Title/3`
is the on-ramp if this ever narrows.

The flow-spec arrangement that uses it — the state catalog, its swim lanes, and
the two ways states get into one — is in [flows.md](flows.md).

## Property names are exact

They are case-sensitive, space-sensitive, and several contain emoji. These are
not guessable, which is why they get looked up rather than typed from memory.
This is the published Button:

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
TEXT, BOOLEAN, or INSTANCE_SWAP property throws — resolve it with `idFor` from
[Property ids come off the imported node](#property-ids-come-off-the-imported-node).

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

Always look the component up before setting properties; never set one from
memory. Look it up in two places, because they answer different questions:
`lookup.mjs` for whether a component exists, what it is called, and what copy
rule governs it, and the imported node for the exact property ids and variant
options to pass.

### The Modals take their content through an INSTANCE_SWAP

The two Modals publish an opening for content they do not supply themselves, and
it is an `INSTANCE_SWAP` property set by its suffixed key like every other
non-VARIANT property. There is no node to find and nothing to append. The value
is the id of a component, so the swap-in has to be imported before it can be
named.

```js
const set = await figma.importComponentSetByKeyAsync('2333a8ce880a7c536463a24850a4096422e59eeb');
const modal = set.defaultVariant.createInstance();
const art = await figma.importComponentByKeyAsync(
  '3a851e0959e74155ad8078d07c329d3668cb6218',   // the illustration template the kit offers for this slot
);

modal.setProperties({
  'title#3656:10': 'Save on your first booking',
  'description#3656:13': 'Book by Friday and we cover the fee.',
  'Artwork#7487:0': art.id,
});
```

| Component | Property | Type | Default |
|---|---|---|---|
| Modal / Promotion | `title#3656:10` | TEXT | `Title` |
| Modal / Promotion | `description#3656:13` | TEXT | `Description` |
| Modal / Promotion | `Artwork#7487:0` | INSTANCE_SWAP | `Modal / Promotion / Illustration template / Large` |
| Modal / Promotion | `grabber?#3754:24` | BOOLEAN | `false` |
| Modal / Promotion | `indicator?#3754:27` | BOOLEAN | `true` |
| Modal / Promotion | `pill?#7535:0` | BOOLEAN | `false` |
| Modal / Promotion | `Breakpoint` | VARIANT | `Large` |
| Modal / Factory / Main | `Content#4276:0` | INSTANCE_SWAP | `Modal / Factory / Main / Content node` |

**The breakpoint sizes the artwork, not the other way round.** `Breakpoint:
Large` gives the illustration 624×312 and `Small` gives it 390×195, so a swap-in
drawn at another size is stretched to whichever one the variant is on rather
than widening the Modal. `Modal / Factory / Main` is a plain `COMPONENT` and its
`Content` slot is 528×92 — `importComponentByKeyAsync`, no variant to set.

**The Modal's footer Button is a nested instance and answers to Button's own
keys.** It is not published as a property of the Modal, so it is reached by
traversal and configured with `setProperties({ 'Label#13326:0': … })` — Button's
key, on Button's instance. Setting it through the Modal throws, because the
Modal publishes nothing by that name.

**Ignore the three `SLOT` rows `lookup.mjs` prints.** `childern#26172:1` and
`artwork#26172:4` on Modal / Promotion, and `children#26172:0` on
Modal / Factory / Main, all come back with a default of `-1:-1`, which is what a
property with nothing behind it looks like. Someone has converted both Modals
from swap-based to slot-based composition inside the Pushpin library file and
that conversion is not published;
`importComponentSetByKeyAsync` and `importComponentByKeyAsync` resolve the
published version, and the published version has no `SLOT` node in it at all —
zero, in both the Pushpin kit and the Thumbprint UI Kit, searched for with
`skipInvisibleInstanceChildren` both on and off. A run that goes looking for
one finds `undefined` and dies on the append.

## Stale traversal on a subtree this call created

**A subtree this call produced with `clone()` or `detachInstance()` answers
searches from a view of itself that was never filled in.** Nothing throws, and
the short answer comes back with nothing on it saying it is short — the call
returns a number that reads like a finding, which is why the same defect has now
been diagnosed three times as three different bugs.

One line at the top of the call is the whole guard:

```js
figma.skipInvisibleInstanceChildren = false;
```

**Set it in every call that clones or detaches, because it does not persist.**
It reads back `true` at the start of every `use_figma` script, which contradicts
the plugin typings — they document `false` outside Dev Mode — so a script that
trusts the documented default is wrong before it starts.

**Do not fix this by searching twice.** `findAll`, `findOne` and `query` return
the unfilled view and fill it as a side effect, so a repeat looks correct;
`findAllWithCriteria` reads an index the subtree never populated and returns the
same wrong number forever. Three of the four recovering on their own is how this
survived being diagnosed three times.

On the path: `clone()` of a container, and `detachInstance()`. Off it:
`createInstance()`, cloning an instance directly, and anything reading a subtree
an *earlier* call created — which is why
[the lane contract](parallel.md#the-lane-contract) carries no guard and must not
gain one. A `createInstance` site is safe because of how the node was made, not
how it is searched, so switching that site to `clone()` loses the protection
without touching a search call.

The flag costs tens to low hundreds of milliseconds inside a call whose round
trip is seconds, and it pays for itself the first time it stops a lane rebuilding
a section. A recursive `.children` walk forces the same materialization but has
to be remembered per site and still omits hidden instance children, so it is the
audit's belt-and-braces rather than the rule here —
[audit-figma.md](audit-figma.md#what-the-walk-can-reach). Measurements behind all
of this are in
[UPSTREAM-figma-materialization.md](../../UPSTREAM-figma-materialization.md).

## Icons

Icons are the part of the kit most likely to be got wrong, and all three ways of
getting it wrong come from the same place: **the icon set is not published from
the Pushpin file.** It is published from the Thumbprint UI Kit
(`jjhhb3Kp6a7JrtBLCjrf6u`), where it lives deliberately — one set of glyphs
serving both systems rather than a copy in each — and a `search_design_system`
call scoped to Pushpin returns nothing for `caret`. That reads as "Pushpin has no
caret" and it is wrong — there are four, at four sizes each.

The catalog holds 227 icons across ten categories and 899 import keys. Ask it
for the one you need — `node scripts/lookup.mjs --icon caret` returns every
match with a key per size — and never type an icon name from memory.

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
figma.skipInvisibleInstanceChildren = false;

const slot = instance.findOne((n) => n.type === 'INSTANCE' && /^Icon \//.test(n.name));
const main = await slot.getMainComponentAsync();
const size = / Icon · (Tiny|Small|Medium|Large)$/.exec(main.name)[1];
```

**Neither of the two lines this replaces could have worked, and neither would
have said so.** The icon slots are invisible instance children: with the flag
left alone, a fresh default-variant Button walks to two nodes and holds no
reachable `INSTANCE` at all, so the `findOne` has nothing to match. With the
flag off the walk reaches five and the slots appear, named `Icon / Left` and
`Icon / Right` — which is the second half of it, because a pattern looking for
` Icon · ` matches neither name and returns `null` under either setting.

**The size is on the main component, not on the node and not in its
measurements.** `Icon / Left` measures 14×14 on the canvas while the component
behind it is `_Arrow-Left Icon · Medium`, a 28px icon, so `slot.width` answers
the question wrongly and confidently. `getMainComponentAsync` is where the size
is written down.

This is still the whole rule for icons inside components, and it is worth
preferring over any table because it cannot go stale. It needs no lookup, it
stays correct when the kit rebuilds a component, and it gets the cases a table
would miss — Button's left slot defaults to `Medium` while its right defaults to
`Tiny`, which no reasonable table would have predicted. The catalog carries
`defaultSize` on 6 of its 14 `INSTANCE_SWAP` properties for reading ahead of a
run; the other 8, Button's two among them, are slots whose size the capture has
no way to resolve, so the read above is the only answer for those.

One caveat, narrower than it used to read: the recorded default is the *default
variant's* answer. Button's does not move — `size=small`, `medium`, and `large`
all answer `Medium` and `Tiny` — and whether any other component's does was not
measured. Reading the slot off the instance you actually configured rather than
the one you first created costs nothing, so read it there.

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
[Unresolved atoms](#unresolved-atoms-are-placed-never-dropped) below.
`lookup.mjs --icon <name>` lists only the sizes that actually publish, so check
it rather than assuming four, and reach for a nearby size only by placing it
deliberately at its own correct dimensions, never by resizing.

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

`lookup.mjs --token <name>` says which of the two a given token is, and prints
its variable key when it binds — check before writing an import.
`lookup.mjs --style <name>` covers the 13 text styles and 6 effect styles.

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
await Promise.all(['Regular', 'Medium', 'Bold'].map(
  (style) => figma.loadFontAsync({ family: 'Thumbtack Rise', style }),
));

const title2 = await figma.importStyleByKeyAsync('c22f9ef014b478e395a0f659ea00c93e01ee4a10');
const text = figma.createText();
parent.appendChild(text);              // append BEFORE styling
await text.setTextStyleIdAsync(title2.id);
text.characters = 'Find a pro';

const shadow100 = await figma.importStyleByKeyAsync('fc2b651ca823646ee3517a41d7ba95a5c1433cbd');
await card.setEffectStyleIdAsync(shadow100.id);
```

The font load comes first and all three weights go in one `Promise.all`. Writing
`characters` against an unloaded weight throws `Cannot write to node with
unloaded font`, and the second load does not depend on the first, so awaiting
them one at a time buys nothing but two more waits. `Thumbtack Rise` in
`Regular`, `Medium`, and `Bold` is the whole set the text styles reach for, even
though the token layer describes weight numerically as 563 / 590 / 660.

## Writing the copy

Copy is composed against Thumbtack's content design rules at the moment
`characters` and `Label` are set, not corrected in a pass afterwards. The
correction is never only a text edit: a button that has to lose two words is a
button whose width was chosen for four, and the row it sits in was balanced
around that width. A screen written legal hands over without a copy pass.
[copy.md](copy.md) has the whole of it; four rules bite right here.

- **Sentence case.** `Submit Request` is a form generator talking; `Send
  request` is a person.
- **A call to action names its action,** in four words, verb plus object.
  `Learn more` and `Get started` fit every button ever drawn, which is exactly
  what is wrong with them. A link gets eight and has to say where it goes.
- **The product's own words** — `pro`, `customer`, `sign in`, `card` — never the
  near-miss.
- **The length limit is part of the component,** and the lookup this lane
  already makes prints it inside the component's own entry, above the property
  table. Nothing has to be asked for twice.

Anything else the rules say is one question away:
`node scripts/lookup.mjs --copy Toast` answers the notification limits, and
`--copy contractor` answers with the word that replaces it.

**A string arriving from somewhere else is the one part of this that is asked
about.** Words carried in from pushed code, or read off the frame being rebuilt,
are somebody's existing decision rather than this lane's, and running them
through `node scripts/copy.mjs` is a pass with a cost — so the checkpoint asks,
and it asks once
[for the whole run](#the-checkpoint-is-one-call-with-two-questions). Picked, the
call rides in step 4's message, before any lane writes a word. Declined, the
strings go across as written and the summary says they were not checked. The four
rules above still bind on every word this lane composes itself, which is most of
them.

The other direction does not ask —
[figma.md](figma.md#copy-is-corrected-on-the-way-in) corrects a frame's words on
the way into markup unconditionally, because there the strings are the whole of
what is being carried across and the code being written is the cheap thing to
change.

Nothing this lane writes gets a score, an alternative, or an annotation arguing
for the wording. Copy is composed correct the way a fill is bound correct, and
the audit's copy bucket is the check on that rather than the place it is
decided.

## Binding variables

For anything the components don't cover — page backgrounds, custom containers,
spacing between sections — bind to the library variable rather than writing a
literal. Bindable keys come from `lookup.mjs --token <name>`.

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
```

A bound fill follows the library through theme switches and token changes. A
literal `#07344a` is correct exactly once — at the moment you type it — and is
the thing that quietly rots.

### Spacing goes through `space()`

Numeric properties bind directly, so nothing stands between a lane and
`frame.itemSpacing = 80` — a number that is not on the scale at all, bound to
nothing, and invisible in a screenshot. Every gap and every padding goes through
one helper instead: it snaps the number to the nearest step, binds that step's
variable, and records the move. Inline it in every lane that creates a frame.

```js
// The library names these by step — `space/4` is the fourth step, 16px — and the
// helper is keyed by pixels, which is the one place the two get confused.
const SPACE = {
  4: '508b4df732de7688c49c238c4ccff6389db6e8c3',
  8: '0575ded655ec9be4b15e83de002a3f52060ac6ea',
  12: 'fc6a3aaf2998c4608670849a3f7612709c2c377c',
  16: 'e4617564161f3df6bca0282e2de5d1c80e1fd7bf',
  20: '5451fcc7b4d3eb1f4aa13eb974161b84a513f209',
  24: 'e6fecbc153fb91da6d648b5b95d494de1efdef51',
  32: 'f406fafa903b932d24dc78f5269350706c9f2131',
  48: 'd08ebc8e5d493307ce5bcb97f30336c3b922cdba',
  64: '0441d0b2b91d1310c587cf05e9d60318f33ee1d3',
  96: 'b0b24b11f3ec2078666e52825463965fe1f1c525',
  128: '432de4ce5ba79eba0f69e8bc6172a6131dba7dfa',
  192: '0827263a347c8fb4e19b02afbfa6574213789817',
  256: 'bde07daf541c6b3b172c5c90de5d6c7a984f0fb5',
};

// `<=` walking ascending steps is what makes a tie take the larger one.
const STEPS = Object.keys(SPACE).map(Number).sort((a, b) => a - b);
const snap = (px) => STEPS.reduce(
  (best, s) => (Math.abs(s - px) <= Math.abs(best - px) ? s : best),
  STEPS[0],
);

// Shared plugin data is namespaced, and the namespace has to be stable across
// every lane and the audit or the record cannot be found again.
const NS = 'pushpin';

const spaceVars = new Map();
const drift = [];

// `source` is where the number came from: 'figma', 'prototype', or 'intent'.
async function space(node, prop, px, source) {
  if (px === 0) { node[prop] = 0; return; }
  const step = snap(px);
  if (!spaceVars.has(step)) {
    spaceVars.set(step, await figma.variables.importVariableByKeyAsync(SPACE[step]));
  }
  node.setBoundVariable(prop, spaceVars.get(step));
  if (step === px) return;
  const record = { prop, from: px, to: step, source };
  // Append rather than overwrite: one node is bound property by property, and a
  // key holding one record would keep only the last of them.
  let recorded;
  try { recorded = JSON.parse(node.getSharedPluginData(NS, 'drift') || '[]'); } catch { recorded = []; }
  if (!Array.isArray(recorded)) recorded = [];
  recorded.push(record);
  node.setSharedPluginData(NS, 'drift', JSON.stringify(recorded));
  drift.push({ node: node.name, ...record });
}
```

Four rules it encodes:

- **`0` is left alone and never bound.** There is no zero token, and zero
  padding is a choice rather than a value someone forgot to set.
- **Below 4 lands on 4, above 256 lands on 256.** Both fall out of the reduce
  rather than being special cases.
- **A tie takes the larger step**: 28 → 32, 40 → 48, 56 → 64, 80 → 96,
  112 → 128, 160 → 192, 224 → 256. Cramped is the more common failure, and a
  layout that rounds down twice in a row reads as a mistake rather than as a
  decision.
- **Every value binds; only a value that moved drifts.** An exact 24 gets the
  same binding as a snapped 22. The drift record is the only thing separating
  them, which is why an exact hit is not worth a special path.

The imports are lazy and cached rather than part of [the batch](#the-imports-go-in-one-batch),
because which steps a layout needs is not known until it is laid out. A lane
pays one wait per distinct step and none for the fifth frame that reuses one.

### Six properties, four corners

Spacing leaks through the side nobody wrote down. Bind `paddingLeft`,
`paddingRight`, `paddingTop`, `paddingBottom`, `itemSpacing`, and —
when `layoutWrap === 'WRAP'` — `counterAxisSpacing`, on every frame this plugin
creates. One call per frame, so a side cannot be skipped by being forgotten:

```js
async function bindSpacing(node, px, source) {
  const props = ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing'];
  if (node.layoutWrap === 'WRAP') props.push('counterAxisSpacing');
  for (const prop of props) await space(node, prop, px[prop] ?? 0, source);
}

const card = figma.createFrame();
card.layoutMode = 'VERTICAL';
await bindSpacing(card, {
  paddingLeft: 24, paddingRight: 24, paddingTop: 32, paddingBottom: 32, itemSpacing: 16,
}, 'intent');
```

An unnamed side is 0, which is Figma's own default and is what the helper sets.
`counterAxisSpacing` only exists under `WRAP`, and binding it on a frame that
does not wrap throws — hence the test rather than a sixth entry in the list.

Radius binds through all four corners:

```js
const radius = await figma.variables.importVariableByKeyAsync(
  '8e4635576b1b8eb2f8c78d500761ea8e055f7028',   // corner-radius/sides
);
for (const corner of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) {
  card.setBoundVariable(corner, radius);
}
```

There is no bindable `cornerRadius`. Writing the shorthand sets four literals,
and binding `topLeftRadius` alone leaves the other three literal while the frame
looks entirely correct. Radius does not snap either: the scale is named — `none`
through `full`, keys under `"Corner Radius"` — so there is no nearest step to
compute, only the right token to pick.

### The drift record lives on the node

Section fills run as one `use_figma` call per lane, and every lane's scope ends
with its own call — whether the lanes went out together, went to subagents, or
ran one after another. So there is no place between them for a drift list to
live. The record goes on the node it happened to, and the lane returns its own
list as well.

```js
node.setSharedPluginData('pushpin', 'drift', JSON.stringify([
  { prop, from, to, source },   // one entry per property that moved on this node
]));
```

**Shared plugin data, not `setPluginData`.** The plain one is not reachable from
here — "only private plugins on web can use it" — and it fails in the way that
costs the most: the method is present, so `typeof node.setPluginData` answers
`'function'` and a guard written to skip it passes, and then the call throws and
takes the whole atomic lane down over one record. The shared variant works, and
its namespace has to match the one the audit reads with.

**The payload is an array, and the write is a read-modify-write.** A frame is
bound one property at a time, so a card whose top padding snapped and whose gap
also snapped writes the key twice — and one key holding one record keeps the
second and loses the first. The audit would then under-report the very thing it
exists to catch, on the frame that drifted most. Reading the existing value back
before appending is what makes what the node carries match what happened to it.

An array rather than a key per property, because a reader hunting
`pushpinDriftPaddingLeft` and five siblings has to know all six names to find
them all, and one parse is cheaper than six reads that mostly come back empty.

`source` is what makes the record actionable at handoff. "This gap moved from 80
to 96" is a fact about the file; "the prototype asked for 80" is something a
person can decide about. Three values: `figma` for a number read off the file
being worked in, `prototype` for one inherited from pushed code, `intent` for
one this run chose.

The audit collects these by walking the tree —
[audit-figma.md](audit-figma.md) — so what it reports is what the file carries
rather than what a lane remembered. The note is written from the returned lists,
which are in hand at that point and save a walk of a tree the audit is about to
walk anyway.

### One Dev Note when something drifted

After the fill lanes and before the audit, the returned lists become a single
`Annotations` · `Dev Note` instance — 300×128, the kit's engineering-facing note
per [annotate.md](annotate.md#annotations) — named and titled `Token drift`. One
note for the run, never one per snap. Its title is the first `TEXT` node and its
body the second, and the body is one row per snap:

```
Source: prototype
Hero · paddingTop 84 → 96
Service list · itemSpacing 40 → 48
```

The source is named once at the top when the run has one, and per row when it
does not.

**It is a direct child of the annotation column, appended last and stretched
like every other member** — [the annotated bundle](annotate.md#the-annotated-bundle).
Nothing about it is positioned: the column's auto-layout is what keeps it clear
of the other notes, and the body's gutter is what keeps it clear of the design,
so the audit's rule that no annotation overlaps another or the design holds
without anything being measured. It needs no card of its own, having no specimen
to sit beside.

**A run whose only annotation is this note still builds the bundle.** That is the
one case where the arrangement does not already exist — no proposals, no
unresolved atoms, nothing else to place — and it is exactly where reaching for
`x` and `y` beside the frame looks reasonable. Coordinates are what the overlap
defect is for. Build the bundle, the body, and the column as
[annotate.md](annotate.md#the-annotated-bundle) has them, with the note as the
column's only member.

When the Annotation Kit is out of reach it is drawn instead, by the rules in
[annotate-fallback.md](annotate-fallback.md), and it takes that page's prefix
like every other stand-in: `Annotations (drawn) / Token drift`. The prefix is
how a reader and the audit tell a drawn shape from an instance, and a note that
dropped it to satisfy a name match would be the one drawn thing on the page
claiming to be library work. The audit's disclosure check accepts either name.
That it was drawn is reported in the `degraded` bucket, as every other drawn note
is.

**When nothing drifted, write no note.** An empty note spends a reviewer's
attention and returns nothing, and it teaches them to skip the next one.

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

**The destination is asked, not defaulted.** It is the first question of
[the checkpoint](#the-checkpoint-is-one-call-with-two-questions), and one of
three answers:

- **Beside the original on this page**, under a dated name of the form
  `Booking flow — Pushpin [Aug 10]`. Same-page placement is what makes a first
  pass comparable: old and new at a glance, in one screenful. This option is
  omitted when there is nothing to duplicate.
- **On a clean review page**, named to the file's conventions — the
  `↪ R1 explorations [Aug 10]` and `↪ Design crit [mon date]` pattern. A busy
  page, or a flow being reviewed before anyone decides whether it lands, is what
  this is for.
- **Somewhere the user names.** Then wait for the link. Nothing is searched for
  here any more than it is above.

**The original is not modified, moved, or renamed by the first pass**, whichever
answer comes back. That is not one of the options, because a write that replaces
work is a write the user cannot take back — and the version they wanted to keep
is the one that was already there.

**Finalize is a second pass, and it is offered.** Once the user says the result
is good, offer the two places accepted work goes, and let them pick:

- **Its own page**, named to the file's conventions, when the work is still
  sitting beside the original. Where the checkpoint already put it on a review
  page, it is already there and there is nothing to offer.
- **The original's place** — the new frame where the old one was, and the old one
  renamed `Booking flow — archived [Aug 10]`.

**Nothing is deleted.** An archived frame is a rename and a move, both visible
and both reversible by hand, which is what makes this the honest form of "replace
the existing flow" — the request the undo argument refuses is overwriting, not
superseding.

Offer it; never perform it. A frame changing places unannounced is the same class
of surprise as an overwrite even when nothing was lost. And do not offer it at
all when [the audit](#the-audit) returned `report.ok === false`: work that did
not pass does not take the original's place.

**Shared library files are refused outright.** Never write into the Pushpin
Thumbprint UI Kit (`VVRGrLgkPRU3vs765d5Q3r`), the Annotation Kit
(`Qefv6O2RMPSBtSYBrCGcdI`), the Thumbprint UI Kit that publishes the icon set
(`jjhhb3Kp6a7JrtBLCjrf6u`), or any file that appears as a subscribed library of
the file being worked in. A bad write there reaches everyone subscribed, and the
user cannot undo it. Contributing a component to the kit goes through a Figma
branch and the contribution flow, which this plugin documents in
[annotate.md](annotate.md) and does not perform.

## The frame gets linked before it gets filled

**The skeleton's return is the first moment the work has an address, and the link
goes out in that turn** — before the fill lanes are issued, not with the summary
that follows them. That the frame is empty at that point is what makes the link
worth sending rather than a reason to hold it: everything after it lands inside
something the user is already looking at.

Nothing later in the run can do it. The lanes go out in one message and the
message does not continue until every call has come back, so
[nothing is reported until everything is](parallel.md#the-ladder) — one silence
of unknown length, then a finished frame. The lanes are landing on the canvas the
whole time; what the link decides is whether anyone is looking at it. It is also
what makes [issuing the lanes in reading order](#filling-the-sections-in-parallel)
worth anything, since a hero landing before a footer is an improvement only for
someone who can see it land.

**Build it from the link the user gave.** Keep the path through the file-name
segment, drop the query, and append the frame id with its colon as a hyphen:

```
https://www.figma.com/design/<fileKey>/<file name>?node-id=12-340
```

The file name is in hand already, which is the reason to take it from there:
`figma.root.name` is another call, and a slug composed from nothing is a guess,
with both spent on a segment Figma ignores once it has the id.

**One link, to the frame.** Not one per lane and not one per section — a lane
writes inside the frame, so the frame's link already reaches its work, and six
links to one place read as six places. A destination the user did not name needs
no extra link either: a review page this run created opens by the frame's own
id, and a link to the page says less than a link to the frame.

The step 7 summary repeats it. The whole of the run's output sits between the
two, and a link scrolled past is a link nobody kept.

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

const settled = await Promise.allSettled(
  probes.map(([, kind, key]) => (kind === 'set'
    ? figma.importComponentSetByKeyAsync(key)
    : figma.importComponentByKeyAsync(key))),
);

const reach = {};
probes.forEach(([library], i) => {
  reach[library] = settled[i].status === 'fulfilled'
    ? true
    : settled[i].reason.message;
});

return { reach };
```

The three probes are three separate libraries and no one of them tells you
anything about the next, so they go out together rather than as three awaits in a
row. `allSettled` rather than `all`: a probe failing is the expected outcome
here, not an error. `all` rejects on the first failure and throws away the other
two answers, which are the whole reason the preflight runs.

Every icon is a plain `COMPONENT` rather than a set, which is why the icon probe
uses `importComponentByKeyAsync`. Use the same call for any catalog entry whose
`type` is `"COMPONENT"`.

**Silent when it passes**, like the session freshness check; only a negative is
worth a sentence.

**Nothing rides back on the Button import beside `reach`.** An earlier version
of this page carried a capability probe there —
`typeof button.value.defaultVariant.createSlot === 'function'` — and travelled
its answer beside `mode` for the rest of the run. It could not have answered
`false`. A bare `typeof` against a property this runtime does not have throws
rather than evaluating to `'undefined'` — probing a `COMPONENT` for a method it
lacks answers
`TypeError: node.resetSlot: no such property 'resetSlot' on COMPONENT node`
rather than the string the comparison was written against. So
the one outcome the probe existed to record would have taken the whole preflight
down with it, losing the three library answers that are the reason it runs at
all — and the promise that a negative gets cross-checked before it is believed
was unreachable, because there was no way to hold a negative.

[rules.md](rules.md) asks for a live probe before any claim that the API cannot
do something, and this is what a live probe has to look like here:

```js
const has = (node, method) => {
  try { return typeof node[method] === 'function'; } catch { return false; }
};
```

A positive still does not promise the call works — for the reason
[the drift record](#the-drift-record-lives-on-the-node) gives about
`setPluginData`, a method can answer `'function'` and still throw.

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
| Annotation Kit | Continue. Notes are drawn instead of instanced — the fallback is in [annotate-fallback.md](annotate-fallback.md). |

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

Carry `mode` through the run. It decides which keys go into the import batch, and
it is what the audit and the handoff report at the end.

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

### Reach is not existence

The probes say the libraries answer; they say nothing about whether the keys this
run will place are still published. Figma returns the same
`Component with key "…" not found` either way, and the remedies differ: an
unreachable library is the user's to fix by getting access, a key that will not
resolve is the maintainer's to fix by re-capturing. Name which one, or the message
sends someone to the wrong hour of debugging.

The preflight creates no nodes, so it is the cheap place to find out. Add the
distinct keys the plan calls for to the same `allSettled`, skipping any library
the reach probes already failed. A key that does not resolve becomes an
[unresolved atom](#unresolved-atoms-are-placed-never-dropped) — placeholder,
sticky, a line in the handoff — planned rather than improvised out of a thrown
call halfway through a screen. Point the remedy at
[maintaining.md](maintaining.md#refreshing-the-capture).

### Property ids come off the imported node

`setProperties` matches the exact id, suffix included — `Label#13326:0`, not
`Label` — so a renumbered suffix throws as hard as a deleted property. Variants
are the exception and take bare names.

Resolve the id from the component you are about to instance, not from the
catalog:

```js
const defs = set.componentPropertyDefinitions ?? {};
const idFor = (name) =>
  Object.keys(defs).find((k) => k === name || k.startsWith(`${name}#`));

button.setProperties({ theme: 'primary', [idFor('Label')]: 'Get estimates' });
```

That costs nothing — the import already happened — and it is immune to the
suffix churn a republish causes. The catalog stays authoritative for what exists,
what it is called, what it costs, and which copy rule governs it.

## The imports go in one batch

A screen needs a dozen imports — a few component sets, the icons, the variables
the containers bind, the text and effect styles — and each one is an independent
`await` against a library. Awaited in a row they are a dozen waits inside one
script, which is most of what the script spends its time on. None of them depends
on the answer to any other, so they go out together, at the top of the script
that uses them.

```js
const wanted = [
  ['Button', figma.importComponentSetByKeyAsync('ebc80753f095633977049c061a28a082816ef9c7')],
  ['Caret-Left · Small', figma.importComponentByKeyAsync('9f82048ae8b63ce69e24cb84a5d3a514ba20dee7')],
  ['background/brand/strong', figma.variables.importVariableByKeyAsync('5590797dbf024c26c95f50687c2b1c61c78248b3')],
  ['title-2', figma.importStyleByKeyAsync('c22f9ef014b478e395a0f659ea00c93e01ee4a10')],
];

const settled = await Promise.allSettled(wanted.map(([, pending]) => pending));

const imported = {};
const missing = [];
wanted.forEach(([name], i) => {
  if (settled[i].status === 'fulfilled') imported[name] = settled[i].value;
  else missing.push(`${name} — ${settled[i].reason.message}`);
});
```

`allSettled` again, and for the same reason as the preflight: the failure has to
name the entry that could not be reached. A rejected `Promise.all` hands back
`Component with key "9f8204…" not found` and nothing else, which is the message
[Naming the library that was out of reach](#naming-the-library-that-was-out-of-reach)
argues a designer cannot act on. `missing` carries the name it was asked for.

Import each distinct key once and reuse the main component for every instance —
one `Button` import serves eleven buttons. And leave out of the batch what the
preflight already ruled out: the icon keys when `mode.icons` is `placeholder`,
the annotation keys when `mode.annotations` is `drawn`, and any key the preflight
found dead. Importing a key from a library the preflight just failed on throws,
and the preflight ran so this step would not have to guess.

Node handles do not survive the end of a `use_figma` call, so this batch
re-imports what the preflight already resolved. That is the price of learning
about a dead key before the skeleton exists rather than halfway through it.

## Filling the sections in parallel

The skeleton call claims its region of canvas once, up front — the duplicated
frame, and the section containers inside it, each shimmering with
`placeholder = true`. Everything after it writes *inside* that region, which is
what makes the sections fillable at the same time: one `use_figma` call per
section, all of them issued as tool calls in a single message.

That is [skeleton then fill](parallel.md#skeleton-then-fill), and it is the shape
every write path in this skill takes. The invariant that makes it safe, the
[contract each lane holds](parallel.md#the-lane-contract), the ladder that
decides whether the lanes are tool calls or subagents, and what to do when one of
them fails are all on [parallel.md](parallel.md). Five things are specific to
filling a screen.

**The skeleton stops at the section containers.** It claims the frame, creates
one shimmering container per section, and creates nothing inside them; every
node a section holds is made by the lane that owns that section. Two lanes
appending into one container is the collision the invariant rules out, but a
section has exactly one writing lane, and a container with one writer has no
second appender to order against —
[one ordered container, one writing lane](parallel.md#one-ordered-container-one-writing-lane).
What that buys is not speed. It is that the largest all-or-nothing write in the
run stops being the first one: a skeleton of thirty nodes that throws on the
twenty-ninth is a from-scratch restart, where a lane that throws costs one
section, and content starts landing while the rest of the screen is still being
written rather than all at once at the end.

**Issue the lanes in the order the screen is read.** The lanes go out in one
message either way, so nothing about this costs a round trip; what it decides is
which section a user watching the canvas sees first. Lead with the section
carrying the most meaning — the hero, the primary action, the content the screen
is about — and let the footer land last.

**Sections are filled in place rather than built off to one side and composed at
the end,** and the sizing rule is the reason. `layoutSizingHorizontal = 'FILL'`
is only valid on a child of an auto-layout frame, so a node is appended into its
section first and sized after — a section built in isolation could not be sized
until assembly, and a lane that failed on the way there would leave an orphan
frame on the canvas rather than leaving nothing behind at all.

**At most about six lanes.** Past that, group sections into one lane rather than
opening more; a run genuinely too large for that budget is the case
[the ladder](parallel.md#the-ladder) sends up a rung, not a reason to open a
seventh call.

**A section needing more than ten logical operations splits sequentially within
its own lane,** never into a second lane. The ten-operation ceiling is per call;
two lanes writing into one section is the collision
[the invariant](parallel.md#the-invariant) exists to rule out.

A lane on this path loads `Thumbtack Rise` itself, since the skeleton's font load
went with its scope, and clears its section's shimmer as its last act:

```js
const page = await figma.getNodeByIdAsync('0:1');       // pageId, from the skeleton
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync('12:340'); // this lane's section

// … this lane's import batch, its font load, then its ten operations …

section.placeholder = false;
return { mutatedNodeIds: [section.id /* , … */], drift };
```

## The checkpoint is one call with two questions

**One `AskQuestion`, one turn**, and it is the only place this path asks the user
anything. It used to be two turns — the page-context offer, then the statement of
what would be built — both waiting on the same answer, and adding a third would
put three turns between a link and a frame.

**The preamble states; the questions ask.** Everything below is said in the
preamble, in a line each, so the user can stop you over any of it without being
asked to choose about it:

- What is on the page — [context.md](context.md). Skip this when the page holds
  nothing else.
- What will be duplicated and what the copy is named, or that the artifact is
  net-new and nothing is being copied.
- Every intended departure from the page's patterns, all of them here rather
  than one at a time during the build.
- Anything the preflight degraded, so the user learns their icons will be
  placeholders before the screen is built rather than after.
- Where the subject is a flow, the lane list and the region each lane shows —
  [flows.md](flows.md#what-a-card-shows-is-decided-per-lane). Stated, never
  asked.
- **What a wider region would cost, where the derived one is narrower than the
  surface its states live in.** One clause, naming the alternative and its price:
  *each card crops to the rail; the whole modal instead means hand-building it
  eight times.* The derivation is not the user's to make and the spend is, so the
  number goes where they can see it and one word comes back. A run that resolved
  this silently in favour of cheap built eighteen cards nobody wanted —
  [flows.md](flows.md#a-stated-region-is-a-commitment).
- **Where the request covers several surfaces, the artifacts** rather than every
  lane in all of them — [below](#a-batch-states-artifacts-not-lanes).

**Question one: where it lands.** Single select, the three answers in
[Where the work gets written](#where-the-work-gets-written) — beside the original,
a clean review page, or a location the user names. Replacing the original is not
among them; it is the finalize offer, after the work has been seen.

**Question two: which paid passes run.** `allow_multiple`, because they are
independent and a user who wants notes but not a copy pass has no way to say so
otherwise:

- **Annotate the result** — every proposal's note, the open questions for
  unresolved atoms, and the `Token drift` disclosure. Step 6. Where the subject
  is a flow this buys the native Dev Mode pass instead of a note bundle —
  [flows.md](flows.md#dev-mode-annotations-on-a-catalog).
- **Correct the copy that came in with the source** — the `copy.mjs` run over
  strings carried in from pushed code or read off a frame being rebuilt.
- **Neither — just build it.**

Both are real work, and both are work on top of a screen that is already
finished and already correct. Annotation is a second bundle of Figma writes
against a second library; the copy run is a script call plus the corrections it
argues for. Defaulting them on spends that on every push, including the ones
where the user wanted to look at a layout.

**What declining annotation costs is said, not hidden.** The notes are where a
proposal is argued and where a snapped value is disclosed, so without them that
disclosure moves into the chat summary at step 7 and the audit stops treating
their absence as a defect — [audit-figma.md](audit-figma.md#when-annotation-was-declined).
The finalize offer then carries annotation with it, so the canvas can catch up
once the design is settled.

**Composing copy correct is not in the question.** It is free, it happens at the
moment `characters` is set, and [§ Writing the copy](#writing-the-copy) is the
argument for why it cannot be a pass afterwards: a button that loses two words is
a button whose row was balanced around the old width. What question two governs
is only the correction of words that arrived from somewhere else.

**The audit is not in the question either.** It is one script call, it is the
check that decides whether the frame hands over at all, and a build nobody
verified is not a cheaper build.

### A batch states artifacts, not lanes

A request covering several surfaces — a page and each of its flows — is still one
checkpoint, and the preamble does not grow with the work.
[parallel.md](parallel.md#a-batch-of-artifacts) has how such a run is decomposed
and issued; this is the shape of the one question in front of it.

**One line per artifact, carrying its region and its lane count.** Not one line
per lane. Five catalogs at five lanes each is twenty-five stated lines, and the
argument for stating rather than asking rests on a wrong guess costing one
correction — at twenty-five it costs the user a careful read of a wall, which is
the same thing as costing nothing:

```
Adding a service — 4 lanes, whole modal
Adding an FAQ — 5 lanes, whole modal
Adding reviews — 6 lanes, whole modal
Page picker — 3 lanes, the picker and its menu
Exit gate — 2 lanes, the dialog
```

**An artifact whose lanes genuinely differ in region names them.** Most do not:
a catalog of one modal is one region for all of its lanes, which is what makes
the summary line honest. Where a catalog really does hold a dialog lane beside a
panel lane — legitimate, per
[flows.md](flows.md#what-a-card-shows-is-decided-per-lane) — that artifact spends
the extra lines rather than hiding a mixture behind one.

**The lane lists are not deferred to a second checkpoint.** Naming the regions
after the first artifact is written is the hole
[a stated region is a commitment](flows.md#a-stated-region-is-a-commitment)
closes, arrived at from the other direction: a region stated once the build is
under way is a region nobody agreed to. Everything in this section is settled
before the first node exists.

## Workflow

1. **Resolve the link and run the access preflight, in one message.** Traversal
   to a concrete frame, per the section above, and the preflight beside it: the
   preflight needs nothing from the traversal, only the file the link names. The
   link still comes first, as ever — nothing in this message can be issued
   without it, and it is never searched for. Both are reads, so the preflight
   still lands before any node exists, which is the point of running it early.
   Stop only if Pushpin is unreachable; otherwise carry `mode` forward.
2. **Read the page.** Walk up to the resolved frame's page and take its children
   — [context.md](context.md). When the link carried a `node-id`, this rides in
   the first message too, since the walk starts from that id and needs nothing
   from the traversal either.
3. **One checkpoint, before anything is written** —
   [above](#the-checkpoint-is-one-call-with-two-questions). One `AskQuestion`
   call, carrying the destination and which of the paid passes to run, under a
   preamble that states everything the user is not being asked. Nothing is
   written until it is answered.
4. **Look up what the layout needs, and claim the canvas, in one message.** Two
   calls, with no dependency between them — three where the checkpoint asked for
   the copy pass.
   - The catalog, asked for everything at once: `node scripts/lookup.mjs
     Button,Card,Toast`, and `--icon` with the glyphs comma-separated. A screen
     needs a dozen entries and each one asked separately is a wasted round trip.
     Scope any `search_design_system` call with the right library key from
     [figma.md](figma.md) — Pushpin for components, the Thumbprint UI Kit for
     icons. When the source is code that declares its own components, resolve
     those declarations here — [above](#when-the-code-already-says-what-it-is).
   - `node scripts/copy.mjs --text` over the strings the source brought with it,
     when that pass was picked. It belongs in this message and not later: a lane
     writes the words it was handed, so a correction arriving after step 5 is a
     correction to a screen whose widths were already chosen around the old ones
     — [§ Writing the copy](#writing-the-copy).
   - One `use_figma` call that duplicates the resolved frame to wherever the
     checkpoint settled — beside the original, onto a review page it creates, or
     into the page the user named — and builds the skeleton inside the copy with
     `figma.createAutoLayout()` containers and `placeholder = true` on each
     section, and returns `{ frameId, pageId, sections: [{ id, name }] }`. The
     original stays untouched from here on. The skeleton is containers rather
     than components, so it needs nothing the lookup or the copy pass is
     fetching — which is why they fit in one message — it stops at the
     containers and creates nothing
     inside them, and the ids it returns are what the fill lanes are handed.
     The duplicate is a `clone()` of a frame holding instances, so a skeleton
     that reads anything back out of it opens with the flag from
     [stale traversal](#stale-traversal-on-a-subtree-this-call-created).
     A batch claims **every** artifact's frame in this one call —
     [parallel.md](parallel.md#a-batch-of-artifacts) — rather than one call per
     artifact, because two calls choosing where a frame goes on a shared page are
     two guesses about the same free space.
   - **Then hand over the frame's link, in this turn and before the lanes go
     out** — [above](#the-frame-gets-linked-before-it-gets-filled). It is built
     from the skeleton's `frameId` and the user's own link, so it costs no call
     and there is nothing to wait for.
5. **Fill the sections in parallel,** one `use_figma` call per section, all of
   them in one message and in the order the screen is read — the hero before the
   footer — [above](#filling-the-sections-in-parallel), and
   [the ladder](parallel.md#the-ladder) for the runs big enough to want
   subagents instead of one message. Each lane batches its own imports, stays
   inside the section it was handed, binds its spacing through
   [`space()`](#spacing-goes-through-space), writes its copy under
   [the content design rules](#writing-the-copy), and clears that section's
   `placeholder` as it finishes. Nothing the design calls for is left out: what
   cannot be resolved gets a marked placeholder.
6. **Annotate, when the checkpoint asked for it,** into the auto-layout bundle
   beside the frame: every proposal's note, a specimen instance of the proposal
   next to it, its anchor, an open question for every unresolved atom, and the
   [`Token drift` note](#one-dev-note-when-something-drifted) when any lane
   returned a snap. This precedes the audit rather than following it, because the
   audit reads these notes — run it first and a proposal whose note has not been
   placed yet is indistinguishable from one that has no note at all, which is a
   defect. When it was declined, the step is skipped whole and the audit is told
   so, so that the same absence is a result rather than that defect.
7. **Join, then audit before declaring done** — see below. Nothing in this step
   or the last one starts until every lane has returned, because an unfilled
   `placeholder` is a defect the audit reports and a lane still running looks
   exactly like one that failed —
   [the join](parallel.md#join-before-annotating-or-auditing). The audit returns
   the frame's picture with the report when it passes, so the verdict is settled
   before there is anything to look at; the picture is a visual check on top of
   the structural one, never a substitute for it. Then print the chat summary,
   listing proposals, unresolved atoms, any spacing that snapped, any library
   the preflight could not reach, and any declaration that did not resolve
   against the catalog — under the frame's link again, since step 4's copy of it
   is now above everything the run wrote.

   **Where step 6 was declined the summary is the only disclosure there is,** so
   it carries what the notes would have said: each proposal with what it extends
   and why, each unresolved atom as an open question, and every snapped value
   with the number that was asked for beside the one on the canvas. A copy pass
   the checkpoint declined is a line here too — the source's words went across as
   written, unchecked.
8. **Offer the finalize pass**, and annotation with it when step 6 was declined.
   Offer both; perform neither unprompted. The finalize offer is where "replace
   the existing flow" is answered —
   [above](#where-the-work-gets-written) — and it is not offered at all when the
   audit did not pass.

## The audit

Run it before declaring the work done. It sorts what it finds into library
instances, proposals, unresolved atoms, degraded libraries, snapped spacing, the
words the frame owns, notes belonging to neighbouring work, and defects, and it
fails on defects only. The script and the eight buckets are in
[audit-figma.md](audit-figma.md).

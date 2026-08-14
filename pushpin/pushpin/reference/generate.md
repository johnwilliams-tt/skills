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

## Property names are exact

They are case-sensitive, space-sensitive, and several contain emoji. These are
not guessable, which is the reason the catalog exists — `node
scripts/lookup.mjs Button` prints exactly this table for any component:

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

Always look the component up before setting properties. Never set one from
memory.

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
const title2 = await figma.importStyleByKeyAsync('c22f9ef014b478e395a0f659ea00c93e01ee4a10');
const text = figma.createText();
parent.appendChild(text);              // append BEFORE styling
await text.setTextStyleIdAsync(title2.id);
text.characters = 'Find a pro';

const shadow100 = await figma.importStyleByKeyAsync('fc2b651ca823646ee3517a41d7ba95a5c1433cbd');
await card.setEffectStyleIdAsync(shadow100.id);
```

Load the font families first — `Thumbtack Rise` in `Regular`, `Medium`, and
`Bold`. The text styles use those named styles even though the token layer
describes weight numerically as 563 / 590 / 660.

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
6. **Look up what the layout needs, in one call.** Identify which published
   components cover it and which icons it calls for, then ask for all of them at
   once — `node scripts/lookup.mjs Button,Card,Toast`, and `--icon` with the
   glyphs comma-separated. A screen needs a dozen entries and each one asked
   separately is a wasted round trip. Scope any
   `search_design_system` call with the right library key from
   [figma.md](figma.md) — Pushpin for components, the Thumbprint UI Kit for
   icons. When the source is code that declares its own components, resolve
   those declarations here — [above](#when-the-code-already-says-what-it-is).
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
    one. Then print the chat summary, listing proposals, unresolved atoms, any
    library the preflight could not reach, and any declaration that did not
    resolve against the catalog.
12. **Offer the finalize pass.** Offer it; do not perform it unprompted.

## The audit

Run it before declaring the work done. It sorts what it finds into library
instances, proposals, unresolved atoms, degraded libraries, and defects, and it
fails on defects only. The script and the five buckets are in
[audit.md](audit.md).

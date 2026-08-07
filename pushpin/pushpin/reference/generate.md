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

**Never draw a component. Always import and instance it.**

If `assets/components.figma.json` has an entry, use it. `figma.createFrame()`
with a corner radius is only ever correct for layout containers — never for
something the kit already publishes.

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
an import. `assets/styles.figma.json` has the 13 text styles and 4 elevation
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

## Workflow

1. **Read the catalog.** Identify which published components cover the layout.
   Load `assets/components.figma.json`; scope any `search_design_system` call
   with the Pushpin library key from [figma.md](figma.md).
2. **Import each distinct component once,** at the top of the script. Reuse the
   imported main component for every instance.
3. **Build the skeleton** with `figma.createAutoLayout()` containers and
   `placeholder = true` on each section.
4. **Fill sections incrementally,** ten logical operations per `use_figma` call
   at most. Clear each `placeholder` as it completes.
5. **Audit before declaring done** — see below. Do not rely on a screenshot.
6. **Screenshot last,** as a visual check on top of the structural one.

## The audit

This is the check that catches the failure this whole page is about. Run it on
the generated frame before handing anything over.

```js
const root = await figma.getNodeByIdAsync('<generated frame id>');

const instances = root.findAllWithCriteria({ types: ['INSTANCE'] });
const report = { fromLibrary: 0, local: 0, detached: [], suspects: [] };

for (const inst of instances) {
  const main = await inst.getMainComponentAsync();
  if (!main) { report.detached.push(inst.name); continue; }
  // `remote` true means it came from a published library, not this file.
  if (main.remote) report.fromLibrary++;
  else { report.local++; report.detached.push(`${inst.name} (local main)`); }
}

// Lookalikes: shapes styled like components instead of being instances.
for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE'] })) {
  const r = typeof n.cornerRadius === 'number' ? n.cornerRadius : 0;
  const insideInstance = (() => {
    for (let p = n.parent; p; p = p.parent) if (p.type === 'INSTANCE') return true;
    return false;
  })();
  if (!insideInstance && r >= 100) {
    report.suspects.push(`${n.name} — pill-shaped ${n.type}, not an instance`);
  }
}

// Literal fills that should have been variable bindings.
const unbound = [];
for (const n of root.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE', 'TEXT'] })) {
  const fills = n.fills;
  if (!Array.isArray(fills)) continue;   // figma.mixed on multi-style text
  for (const f of fills) {
    if (f.type === 'SOLID' && !(f.boundVariables && f.boundVariables.color)) {
      unbound.push(n.name);
      break;
    }
  }
}
report.unboundFills = [...new Set(unbound)];

return report;
```

**A clean result** has `local` and `detached` empty, `suspects` empty, and
`unboundFills` containing only nodes you deliberately left unbound.

Any entry in `suspects` is the exact bug this page exists to prevent: something
that looks like a Pushpin component and isn't one.

A real run of this workflow — a mobile screen with a TextInput, two Buttons, and
a card — returned:

```
{ fromLibrary: 5, local: 0, problems: [], suspects: [], unboundFills: [] }
```

Five instances resolved to remote main components (three placed directly, two
nested inside them), nothing was drawn by hand, and every fill on the
hand-built containers was variable-bound.

## When no component exists

Ten Pushpin components have no React implementation, and some layouts need
things the kit doesn't publish at all. In that case:

- **Say so explicitly** in the handoff rather than shipping a convincing
  lookalike. The value of "this part is custom" is high and the cost of
  discovering it late is higher.
- Build it from tokens — bind every fill, radius, and gap to library variables
  so it converges when a real component lands.
- Name the node so its status is obvious in the layers panel, e.g.
  `[custom] Rating summary`, not `Card`.

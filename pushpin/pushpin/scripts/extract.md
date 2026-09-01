# Re-extracting the captures from Figma

Everything in `assets/` is produced by running these read-only scripts against
the source files and transcribing the results. They are recorded here so the
captures are reproducible rather than one-time acts.

Sections 1–6 and 9 read the Pushpin file, `VVRGrLgkPRU3vs765d5Q3r`. Section 7
reads the Annotation Kit, `Qefv6O2RMPSBtSYBrCGcdI`. Section 8 reads the older
Thumbprint UI Kit, `jjhhb3Kp6a7JrtBLCjrf6u`, which is where the icon set is
published. Pass the right `fileKey` on every call; they are three separate files
and three separate libraries.

To find out **whether** anything changed, use [check.md](check.md) instead — one
capture per vantage point, fed to `diff.mjs`, which classifies what moved. Come
here when you already know you are re-transcribing the whole thing.

Load the `figma-use` skill first — it is a required prerequisite for
`use_figma`.

Variables cannot be enumerated through `search_design_system` (it returns names
and keys but no values) or `get_variable_defs` (it requires a concrete node id).
`use_figma` is the only route to the whole set.

## 1. Survey

Confirms the collections still exist under the same names and that no mode has
been added or renamed. Run this first; if it disagrees with the `$modes` arrays
in `tokens.figma.json`, the scripts below need updating before they are trusted.

```js
const pages = figma.root.children.map(p => ({ id: p.id, name: p.name }));
const collections = await figma.variables.getLocalVariableCollectionsAsync();
return {
  pageCount: pages.length,
  pages,
  collections: collections.map(c => ({
    name: c.name,
    varCount: c.variableIds.length,
    modes: c.modes.map(m => m.name),
  })),
  textStyleCount: (await figma.getLocalTextStylesAsync()).length,
  effectStyleCount: (await figma.getLocalEffectStylesAsync()).length,
};
```

Expected at the time of capture: 91 pages, 22 collections, 34 text styles, 6
effect styles. `Tokens / Base Colors` 90 vars, `Tokens / Semantic Colors` 109
vars across Light and Dark, `Tokens / Font` 39 vars across native and desktop.

## 2. Colors

Emits base ramps as hex and semantic colors as `@alias` references per mode.
Aliases are preserved rather than flattened, because the alias graph is itself
design intent — `background/disabled/low` pointing at `background/neutral/low`
means something a resolved hex would lose.

```js
const toHex = (c) => {
  if (!c) return null;
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  const base = '#' + h(c.r) + h(c.g) + h(c.b);
  return (c.a !== undefined && c.a < 0.999) ? base + h(c.a) : base;
};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const baseCol = cols.find(c => c.name === 'Tokens / Base Colors');
const semCol  = cols.find(c => c.name === 'Tokens / Semantic Colors');

const base = {};
const baseMode = baseCol.modes[0].modeId;
for (const id of baseCol.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) continue;
  const val = v.valuesByMode[baseMode];
  base[v.name] = (val && val.type === 'VARIABLE_ALIAS') ? { alias: val.id } : toHex(val);
}

const semModes = semCol.modes.map(m => ({ id: m.modeId, name: m.name }));
const sem = {};
for (const id of semCol.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) continue;
  const entry = {};
  for (const m of semModes) {
    const val = v.valuesByMode[m.id];
    if (val && val.type === 'VARIABLE_ALIAS') {
      const t = await figma.variables.getVariableByIdAsync(val.id);
      entry[m.name] = t ? '@' + t.name : '@?';
    } else {
      entry[m.name] = toHex(val);
    }
  }
  sem[v.name] = entry;
}
return { base, semantic: sem };
```

## 3. Everything else

```js
const want = [
  'Tokens / Space', 'Tokens / Corner Radius', 'Tokens / Font',
  'Tokens / Font Weight', 'Tokens / Line Height', 'Tokens / Letter Spacing',
  'Tokens / Shadow', 'Tokens / Duration', 'Tokens / Easing',
  'Tokens / Breakpoint', 'Tokens / Scrim', 'Tokens / Wrap', 'Tokens / Z-Index',
];
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const out = {};
for (const c of cols) {
  if (!want.includes(c.name)) continue;
  const modes = c.modes.map(m => ({ id: m.modeId, name: m.name }));
  const vars = {};
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) continue;
    const entry = {};
    for (const m of modes) {
      const val = v.valuesByMode[m.id];
      if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
        const t = await figma.variables.getVariableByIdAsync(val.id);
        entry[m.name] = t ? '@' + t.name : '@?';
      } else if (val && typeof val === 'object') {
        entry[m.name] = JSON.stringify(val);
      } else {
        entry[m.name] = val;
      }
    }
    vars[v.name] = (modes.length === 1) ? entry[modes[0].name] : entry;
  }
  out[c.name] = { modes: modes.map(m => m.name), vars };
}
return out;
```

## 4. Text and effect styles

`assets/styles.figma.json`. The published styles are the API for type and
elevation, because the font-size and shadow variables are hidden from
publishing — a consuming file cannot bind them, so a style key is the only
route. Sections 2 and 3 cannot reach these: styles are not variables and
`getLocalVariableCollectionsAsync` never returns them.

**Take the whole metric object.** `letterSpacing` and `lineHeight` come back as
`{ value, unit }`, and the unit is PERCENT on every one of the 13 public styles.
Reading `.value` alone is what recorded a -2% tracking as -2px and put a blanket
`letter-spacing` on nine title utilities that carry none.

```js
const round = (n) => Math.round(n * 1e4) / 1e4;
const metric = (m) =>
  !m ? null : m.unit === 'AUTO' ? { unit: 'AUTO' } : { value: round(m.value), unit: m.unit };

const textStyles = {};
for (const s of await figma.getLocalTextStylesAsync()) {
  if (s.name.startsWith('EightShapes Spec/')) continue;
  textStyles[s.name] = {
    key: s.key,
    font: s.fontName.family + ' ' + s.fontName.style,
    size: s.fontSize,
    letterSpacing: metric(s.letterSpacing),
    lineHeight: metric(s.lineHeight),
  };
}

const effectStyles = {};
for (const s of await figma.getLocalEffectStylesAsync()) {
  effectStyles[s.name] = { key: s.key };
}

return { textStyles, effectStyles };
```

Three things to carry through rather than tidy away:

- **The 21 `EightShapes Spec/*` styles are dropped**, and the reason is recorded
  in the capture's `$excluded`: they are the design system's own documentation
  tooling in Inter, and must never reach product design. They are the difference
  between the 34 styles §1 counts and the 13 recorded here.
- **`Title/*` and `Text/*` line heights do not agree with `Tokens / Font`.** The
  nine Title steps resolve exactly — 105% of 48 is the 50.4 in
  `tokens.figma.json` — and the four Text steps do not: `Text/1` is 140% of 16,
  or 22.4, against 24 in the variable. That is the kit disagreeing with itself,
  not a capture bug, and both numbers are recorded so the disagreement stays
  visible. The style is the one `build-css.mjs` emits, so a re-capture that
  changes a percentage moves the stylesheet; `verify.mjs` fails until it is
  rebuilt.
- **Weights are named styles here and numbers in the token layer.** `Title/3` is
  `Thumbtack Rise Bold`; `title-3` is weight 590. The style is what renders.

`Tokens / Letter Spacing` deserves a note of its own, because it is where the
unit went missing. Its three variables are bare `FLOAT`s scoped to
`LETTER_SPACING` with the values `1`, `-1`, `-2` and no unit of their own, and
the text styles do not bind them — a style's `boundVariables` covers only
`fontFamily` and `fontSize`. So nothing in §3's output can settle whether those
numbers are pixels or percentages. What settles it is that the styles apply
exactly those three numbers as PERCENT, which is why `$unit` in
`tokens.figma.json` is transcription metadata sourced from here, and why
`build-css.mjs` reads the style's unit rather than trusting the group's.

## 5. Component catalog

`assets/components.figma.json` takes three reads, and the second is the one
that decides what the catalog holds.

**The candidates** come from the MCP tool
`list_file_components_for_code_connect` (a read, despite the name — it takes
only a `fileKey` and publishes nothing). Its own documentation says it returns
only published components. It does not: the dump was 1074 entries at capture and
956 of them are unpublished. Save the raw array.

**The gate** is `getPublishStatusAsync()`, which is the only reading of "is this
published" that a consuming file will agree with. It needs a node, so it needs
`use_figma`, which is why the catalog spent so long guessing from names instead
— and the guess was wrong in both directions. Sweep **every** candidate, not
just the ones whose name looks public: `_Bubble / Text` and `_Stamps` are
published, and four components that read as public were never pushed to the
library.

Node ids resolve across pages without `setCurrentPageAsync`, so this is one flat
loop rather than a per-page fan-out. **300 ids per call** is measured — four
calls covered 1074 with no errors and no truncation, and the ~10-operation
guidance in `figma-use` is about writes, which each mutate the document; these
are two reads per node and cost nothing to batch. Return the statuses as one
string in input order rather than a map, or the response is mostly node ids.

```js
const IDS = ['25246:2695', '24017:20110', /* …one batch of the dump's nodeIds… */];
let s = '';
const errors = {};
for (const id of IDS) {
  try {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) { s += 'M'; continue; }
    const p = await n.getPublishStatusAsync();
    s += p === 'CURRENT' ? 'C' : p === 'CHANGED' ? 'H' : p === 'UNPUBLISHED' ? 'U' : '?';
  } catch (e) { s += 'E'; errors[id] = e.message; }
}
return { count: IDS.length, len: s.length, s, errors };
```

`CURRENT` and `CHANGED` both mean published — `CHANGED` is a published
component the file has edited since, which is a normal state and not a reason to
drop anything. Only `UNPUBLISHED` is out.

**Every candidate must come back with one of those three.** `M`, `?` and `E`
are the script admitting it did not get an answer, so re-run those ids rather
than merging them as anything; the distiller rejects a status it does not
recognise, and rejects a map that covers fewer nodes than the dump holds. That
check is the one thing standing between a batch that failed quietly and a
catalog full of keys that throw at import — membership asks for a published
status rather than testing for `UNPUBLISHED`, so an unanswered node falls out of
the catalog rather than into it, and the count is what makes the fallout
visible instead of silent.

**The published names and properties** come from importing each surviving key,
which doubles as proof that every key in the catalog resolves. Run it against the
scratch file `8Uv6dYO4uKdGCyGSfpz9k0` or any file that subscribes to the kit —
*not* the kit itself, where a component is not a library entry. Importing places
nothing on the canvas. **29 keys per call** is measured — four calls covered all
115 with nothing failing. These are network round trips rather than local reads,
so they do not batch as wide as the status sweep above.

```js
const ROWS = [['ac6c54e89daf08a8753737e739e8258ace3c42ac', 'COMPONENT'], /* [key, type]… */];
const ok = {};
const props = {};
const failed = {};
for (const [key, type] of ROWS) {
  try {
    const n = type === 'COMPONENT_SET'
      ? await figma.importComponentSetByKeyAsync(key)
      : await figma.importComponentByKeyAsync(key);
    ok[key] = n.name;
    // The library's own answer for what this component exposes. Everything the
    // dump says about properties is the file's unpublished state; this is what a
    // consuming file can actually set.
    props[key] = n.componentPropertyDefinitions || {};
  } catch (e) { failed[key] = e.message; }
}
return { tried: ROWS.length, resolved: Object.keys(ok).length, ok, props, failed };
```

**`props` is the reason this pass is not optional any more.** The dump reads the
kit's working file, and the file runs ahead of the library — measured across 115
entries, 6 disagreed with the library about their own properties. `Button` is one
of them: the library publishes `Label#35422:0`, `icon#34740:123` and
`iconRight#35089:121`, and offers `size` as `large small`, where the dump reports
none of those names. A run that took a `size` the dump offered and the library
does not throws, because the published set has no such variant. Since the import
is already happening for the name, the definitions cost nothing extra.

Variant *option* drift is the half that a property-name comparison misses, and it
is the half that bites: a `Bubble / Text` capture taken before 2026-09-01 records
`Theme` as `Received`/`Sent`, and the library now publishes the same axis as
`Recipient`/`Sender`.

`failed` must come back empty. A key that throws here is a key that would throw
mid-generation, and the gate above is what is supposed to have removed it.

The name that comes back is the name the **library** serves, which is not always
the name the file carries: a component renamed after its last publish keeps the
old name in every consuming file. Four are in that state — `_Bubble / Text` is
served as `ChatBubble`, `_Stamps` as `Messenger Elements / Stamps`,
`Bubble / Text` as `Messenger Elements / Bubbles`, `Bubble / Structure` as
`Messenger Elements / Structured Bubble`. The catalog keys entries by the file
name, because that is what §9's visual specs and every `data-pp-component`
declaration already say, and records the served name as `publishedAs`.

Merge the three into one capture file and distil it:

```json
{
  "capturedAt": "2026-08-27",
  "components": [ /* the raw dump, verbatim */ ],
  "publishStatus": { "15267:72862": "CHANGED", "31675:40060": "UNPUBLISHED" },
  "publishedNames": { "1f03fd762ff653f6feb24d0d162bb9109cee3b46": "ChatBubble" },
  "publishedProperties": { "ebc80753…": { "Label#13326:0": { "type": "TEXT" } } }
}
```

`publishedProperties` is the merged `props` from every batch, keyed by assetKey.
Leave it out and the distiller falls back to the dump for that component and lists
it under `source.propertiesFromDump`, so a partial capture says so instead of
looking complete.

**When only the properties have moved, skip the dump.** The two halves of the
catalog go stale at different rates and cost different amounts to check:
properties change on every republish and are what throws a run mid-screen, while
the 1074-entry dump matters only when a component is added, removed or renamed.
Merge the four batches into one file under `.cache/` — gitignored scratch — in
either of two shapes:

```json
{
  "capturedAt": "2026-08-28",
  "properties": {
    "1f03fd7…": { "n": "ChatBubble", "p": { "theme": { "t": "V", "o": ["sent"], "d": "sent" } } },
    "ebc8075…": { "Label#13326:0": { "type": "TEXT", "defaultValue": "Label" } }
  }
}
```

The first entry is the compact form the sweep sends — `t` type (`V`/`T`/`B`/`I`),
`o` variantOptions, `d` defaultValue, `n` published name — which exists because
the response crosses a `use_figma` boundary where payload size is the reason for
batching at all. The second is `componentPropertyDefinitions` saved verbatim,
which is what the snippet above returns and what a file on disk has no reason to
compress. Either is accepted per entry; anything else is refused by name rather
than read as a component with no properties.

`capturedAt` is required. `.cache/` is gitignored, so
`source.propertiesCapturedAt` is the only provenance that outlives the run, and
defaulting it would date the distillation rather than the read.

```bash
node scripts/build-components.mjs --properties-only .cache/published-properties.json
```

It rewrites property ids, variant options and defaults in place, keeps the
INSTANCE_SWAP default names the dump resolved, names every component it changed,
and warns if a captured key matches no catalog entry — which means membership
moved and the full capture is needed after all. It writes nothing at all if the
capture publishes no properties for a component the catalog records some for:
that is a bad capture far more often than a real change, and a real one is
structural and belongs to the full path.

Components the capture does not mention keep what they have, and keep whatever
`source.propertiesFromDump` already said about them — this path can clear that
list for entries it refreshed from the library but cannot add to it, because it
never sees the dump those entries would have come from.

```bash
node scripts/build-components.mjs <path-to-capture.json>
```

The distiller refuses a bare dump rather than falling back to the name rule.
Expect 118 published owners under 115 distinct names: three names —
`Tabs`, `iOS / Sheet` and `view` — are published twice, and `source.nameCollisions`
names the node that lost. `source.nameStatusDisagreement` lists every component
whose `_`/`.` prefix contradicts its publish status; it changes nothing and is
where the next stale key will show up first.

## 6. Variable keys

`assets/variable-keys.figma.json` holds the published key of every token
variable, needed by `importVariableByKeyAsync` when binding properties from
another file. `Variable.key` differs from `Variable.id` — the id is file-local
and useless across files.

```js
const want = ['Tokens / Semantic Colors','Tokens / Base Colors','Tokens / Space',
  'Tokens / Corner Radius','Tokens / Font','Tokens / Font Weight',
  'Tokens / Line Height','Tokens / Letter Spacing','Tokens / Shadow',
  'Tokens / Duration','Tokens / Easing','Tokens / Breakpoint'];
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const out = {};
let total = 0;
for (const c of cols) {
  if (!want.includes(c.name)) continue;
  const m = {};
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) continue;
    m[v.name] = v.key;
    total++;
  }
  out[c.name] = m;
}
return { total, collections: out };
```

`scripts/verify.mjs` fails if a colour token is listed as neither bindable nor
hidden, so the two captures cannot fall out of step.

Record only the keys of variables that are **not** hidden from publishing. A
hidden variable's key cannot be imported from another file, so storing it
invites a runtime failure. Capture the hidden names separately, as
`hiddenFromPublishing`, and let `diff.mjs` watch for anything crossing between
the two lists.

## 7. Annotation Kit

`assets/annotations.figma.json` — `fileKey: Qefv6O2RMPSBtSYBrCGcdI`. There is no
distiller script for this one. The capture below emits entries in the committed
shape, so the transcription is a merge and a sort rather than a restructuring,
and there is no second pipeline to keep in step with the first.

`list_file_components_for_code_connect` is not used here even though it is what
builds the Pushpin catalog. That tool is fine for import keys, but this catalog
exists because the Annotation Kit's property keys are the thing that breaks:
`setProperties` takes the suffixed key for every non-variant property, and a
missing one throws at runtime. `use_figma` reads
`componentPropertyDefinitions` straight off the node, which is the only reading
that is definitionally correct.

**One call per page, issued in parallel** — `use_figma` allows one
`setCurrentPageAsync` per call, and a page's children are not loaded until it is
current. Send all four in one message rather than one at a time — the model
round trips are what cost, not the scripts — and
[parallel.md](../reference/parallel.md) holds that reasoning for every Figma
call path. The four pages and their ids:

| Page | Node id |
|---|---|
| General | `0:1` |
| Accessibility Annotations | `1192:101` |
| Team Roster | `2335:1841` |
| Thumbprint | `1415:790` |

Run this once per page, substituting the id:

```js
const page = await figma.getNodeByIdAsync('0:1');
await figma.setCurrentPageAsync(page);

const entries = {};
for (const n of page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })) {
  // A variant is reached through its set, and asking a variant for its
  // property definitions throws rather than returning the set's.
  if (n.parent && n.parent.type === 'COMPONENT_SET') continue;
  // Same gate as the Pushpin catalog in §5, and for the same reason: a name is
  // a guess at publish status and it is wrong in both directions. An entry
  // whose key cannot be imported is one that throws mid-generation.
  if ((await n.getPublishStatusAsync()) === 'UNPUBLISHED') continue;

  const properties = {};
  for (const [full, d] of Object.entries(n.componentPropertyDefinitions || {})) {
    // Figma keys this object by the full property key. For VARIANT that is the
    // bare name; for everything else it carries the `#id:n` suffix, and the
    // display name is what precedes the `#`.
    const display = d.type === 'VARIANT' ? full : full.slice(0, full.indexOf('#'));
    properties[display] = {
      type: d.type,
      key: full,
      ...(d.variantOptions ? { options: d.variantOptions } : {}),
      ...(d.defaultValue !== undefined && d.type !== 'INSTANCE_SWAP'
        ? { default: d.defaultValue }
        : {}),
    };
  }

  entries[n.name] = {
    key: n.key,
    type: n.type,
    page: page.name,
    nodeId: n.id,
    ...(Object.keys(properties).length ? { properties } : {}),
  };
}
return { page: page.name, kept: Object.keys(entries).length, entries };
```

Then merge the four `entries` objects into `components`, sorted by
`localeCompare`, and rebuild `source` with the file key, the library key,
today's date, the page ids, and the three counts — `capturedTotal` (every
component node found), `unpublishedOmitted`, and `publicKept`.
`capturedTotal` must equal `unpublishedOmitted` plus the number of component
nodes reached, and `publicKept` must equal the number of keys in `components`;
that is what makes the counts checkable rather than decorative.

The 2026-08-28 capture is the first taken through the publish-status gate, and
it settled the question the old name rule left open: the same 91 components come
back, so no component was hidden behind a `_…` name. `unpublishedOmitted: 20`
now records what the gate actually excluded, where `internalOmitted: 20` had
recorded what the name rule guessed.

Two things the merge has to handle:

- **A name is not unique.** `A11y / Annotation / Spec` is published twice, with
  different keys and different variant axes. Key those entries
  `<name> [<nodeId>]` and give each a `name` field with the true Figma name. A
  merge that lets the second overwrite the first silently loses a published
  component and makes `publicKept` disagree with the key count.
- **Names are exact, including the mistakes.** `List Elelemt` and
  `… [Anrdoid]` are real published variant options. Copy them through.

The Annotation Kit publishes no text or effect styles, and its single
`Annotations / Tokens` collection documents Pushpin's variables rather than
adding any, so there is nothing here corresponding to sections 2, 3, 4 or 6.

## 8. Icons

`assets/icons.figma.json` — `fileKey: jjhhb3Kp6a7JrtBLCjrf6u`, page `2:1`.

**Icons are not published from the Pushpin file.** They never were: the Pushpin
kit publishes 115 components under distinct names and not one of them is an icon,
which is why the plugin had no way to place one until this catalog existed. The
set lives on the Icons page of the Thumbprint UI Kit — deliberately, so one set
of glyphs serves both systems — and publishes from that file's library. Capturing
it against `VVRGrLgkPRU3vs765d5Q3r` returns nothing and looks like a kit that
lost its icons.

Two reads, neither sufficient alone:

```
list_file_components_for_code_connect   fileKey jjhhb3Kp6a7JrtBLCjrf6u
get_metadata                            fileKey jjhhb3Kp6a7JrtBLCjrf6u, nodeId 2:1
```

The dump gives every published icon's name and `assetKey` and flattens the page
to a list, losing the grouping entirely. The metadata gives the ten category
frames and which icons sit inside each, and carries no keys. They join on
`nodeId`. Save them and run the distiller:

```bash
node scripts/build-icons.mjs icons-raw.json icons-page.xml
```

Layer names are `<Name> Icon · <Size>` and the ramp is the whole point of the
capture: **Tiny 14, Small 18, Medium 28, Large 32.** An icon is placed by
importing the key for the size that is already correct, so the catalog stores
one key per size and the audit uses the pixel values to catch a resized one.

Four things the distiller handles that a hand-merge would get wrong:

- **A name is not unique.** `Home` is published in both Navigation and Meta
  Category at all four sizes — two real components sharing a name, the same trap
  the Annotation Kit sets with its two `A11y / Annotation / Spec` entries.
  Entries whose base name spans categories are keyed `<name> [<category>]` and
  carry a `name` field with the true name. Collapsing on name alone drops one of
  them and makes `publicKept` disagree with the key count.
- **Not every icon publishes every size.** Five do not, and that is a fact about
  the kit rather than a capture bug — `AI-Writing` has no Large,
  `Messages Filled` and `Messages-Filled` split the ramp between two spellings.
  They are recorded under `incomplete` so the placement rules can send a caller
  to a size that exists instead of resizing a neighbour.
- **Names are exact, including the mistakes.** `Trend Icon Icon · Tiny` and
  `Home-Heart Icon Icon · Small` are really published with the doubled word.
  Copy them through; a corrected spelling is a key that does not resolve.
- **Five icons live off the Icons page** — older copies parked in a workspace,
  plus one `_base /` internal. They are omitted and counted, because a stray
  duplicate resolving under the same base name would shadow the canonical one.

`scripts/verify.mjs` checks that `publicKept` matches the entry count, that
`keyCount` matches the keys actually present, that no size is off the ramp, and
that every incomplete icon is listed as incomplete. Those are what stop a lossy
merge reading as a smaller kit.

## 9. Component visual specs

`assets/component-specs.figma.json` — `fileKey: VVRGrLgkPRU3vs765d5Q3r`, distilled
by `scripts/build-specs.mjs`.

§5's catalog comes from `list_file_components_for_code_connect`, which carries the
property API and **no geometry at all**. It can say Button's `theme` accepts
`secondary`; nothing in it says what `secondary` looks like. That silence is what
a hand-rolled component gets guessed into, and the guess named a border token the
kit does not publish while missing the one it does. This capture is the answer,
and it needs `use_figma` because the geometry only exists on the nodes.

**One call per page, issued in parallel** — same constraint as §7: `use_figma`
allows one `setCurrentPageAsync` per call and a page's children are not loaded
until it is current. 44 pages hold public components, so send them in batches in
one message each and merge, per [parallel.md](../reference/parallel.md).

**Enumerate the pages; do not derive them from component names.** Page names
carry emoji prefixes — the Button page is `📌 Button`, and `❌`, `🚧`, `🎨` and
`✋` also appear — and the kit has 91 pages, most of them decorative separators.
A lookup by bare name finds nothing. Read `figma.root.children` for the current
list and match on the suffix. The 44 as of the last capture, with the component
counts the old name rule produced — the gate below drops four of them, and
`Guidelines` has since published one, so re-derive the counts rather than
trusting this column:

| Page | Node id | Components |
|---|---|---|
| `📌 Button` | `11231:729` | 1 |
| `📌 Dropdown` | `11231:720` | 1 |
| `📌 Text Area` | `13232:23917` | 1 |
| `📌 Text Input` | `11231:727` | 1 |
| Accordion | `15247:1915` | 2 |
| Action Sheet | `13232:23947` | 1 |
| Additional components | `11403:48135` | 44 |
| Alert | `11231:184` | 1 |
| Avatar | `11231:717` | 2 |
| Badge | `19165:17169` | 1 |
| Brand Assets | `3:455` | 6 |
| Button Row | `11231:730` | 2 |
| Calendar | `11231:731` | 1 |
| Callout | `15271:94064` | 1 |
| Carousel | `13232:24485` | 1 |
| Checkbox | `11231:719` | 2 |
| Chip | `11231:718` | 1 |
| Counter | `19165:17203` | 1 |
| Disclosure | `19165:17202` | 1 |
| Fab | `11231:724` | 2 |
| Form Note | `11231:721` | 1 |
| Horizontal Rule | `11231:725` | 1 |
| Icon Button | `13232:26394` | 1 |
| Image | `11231:722` | 1 |
| Input Row | `11231:734` | 1 |
| Label | `13232:26395` | 1 |
| Layouts | `11231:740` | 8 |
| Link | `11231:735` | 2 |
| Loader Dots | `13232:26396` | 1 |
| Modal | `11231:736` | 11 |
| Pill | `11231:723` | 1 |
| Playground | `8080:11511` | 1 |
| Popover | `11231:738` | 1 |
| Progress Meter | `18463:12004` | 1 |
| Radio | `13232:25231` | 2 |
| Segemented Control | `15247:1917` | 1 |
| Service Card | `11231:733` | 1 |
| Slider | `15247:1977` | 1 |
| Star Rating | `11231:726` | 2 |
| Switch | `13232:26401` | 1 |
| Tabs | `18544:18218` | 1 |
| Tip | `21085:202582` | 1 |
| Toast | `11231:728` | 1 |
| Tooltip | `11231:737` | 1 |

`Additional components` holds 42 of the 115 on its own, so split it across
several calls with an `ONLY` list rather than asking for it whole — the response
truncates well before it finishes.

Run this once per page, substituting the id and setting `ONLY` to a list of
component names or `null` for every published component on the page:

```js
const PAGE_ID = '11231:729';
const ONLY = null;
const CAP = 24;

const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);

const r4 = (n) => (typeof n === 'number' ? Math.round(n * 1e4) / 1e4 : null);
const hex = (c, o) => {
  if (!c) return null;
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  let s = '#' + h(c.r) + h(c.g) + h(c.b);
  if (typeof o === 'number' && o < 0.999) s += h(o);
  return s;
};

// A bound variable is recorded as [collection, name, literal] — the collection
// and name verbatim, and the value that actually renders beside them. Nothing
// here maps a Figma collection onto a --pp-* name: several bound variables have
// no Pushpin token at all, and inventing one is the defect this capture exists
// to remove. Resolution is scripts/lib/specs.mjs's job, where the naming rule
// already lives. The literal travels alongside because for a variable outside
// the Pushpin token collections there is no other way to learn it — nothing
// local resolves `Control Sizes/xl` to 52.
const varCache = new Map();
const colCache = new Map();
async function varRef(a) {
  if (!a || a.type !== 'VARIABLE_ALIAS') return null;
  if (varCache.has(a.id)) return varCache.get(a.id);
  const v = await figma.variables.getVariableByIdAsync(a.id);
  let out = null;
  if (v) {
    if (!colCache.has(v.variableCollectionId)) {
      const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      colCache.set(v.variableCollectionId, c ? c.name : null);
    }
    out = [colCache.get(v.variableCollectionId), v.name];
  }
  varCache.set(a.id, out);
  return out;
}

async function dim(node, field, value) {
  const ref = await varRef((node.boundVariables || {})[field]);
  return ref ? [ref[0], ref[1], r4(value)] : r4(value);
}

async function paintOf(paints) {
  if (!paints || paints === figma.mixed || !paints.length) return null;
  const p = paints[0];
  if (p.visible === false) return null;
  if (p.type !== 'SOLID') return p.type;
  const lit = hex(p.color, p.opacity);
  const ref = p.boundVariables && p.boundVariables.color ? await varRef(p.boundVariables.color) : null;
  return ref ? [ref[0], ref[1], lit] : lit;
}

/** Four sides, collapsed to one entry when they agree. */
const same = (a) => {
  const k = a.map((v) => JSON.stringify(v));
  return k.every((v) => v === k[0]) ? a[0] : a;
};

async function spec(node) {
  const s = {};
  const fill = await paintOf(node.fills);
  if (fill !== null) s.fill = fill;
  const stroke = await paintOf(node.strokes);
  if (stroke !== null) {
    s.stroke = stroke;
    s.strokeWeight = same([
      await dim(node, 'strokeTopWeight', node.strokeTopWeight),
      await dim(node, 'strokeRightWeight', node.strokeRightWeight),
      await dim(node, 'strokeBottomWeight', node.strokeBottomWeight),
      await dim(node, 'strokeLeftWeight', node.strokeLeftWeight),
    ]);
  }
  if (typeof node.topLeftRadius === 'number') {
    s.radius = same([
      await dim(node, 'topLeftRadius', node.topLeftRadius),
      await dim(node, 'topRightRadius', node.topRightRadius),
      await dim(node, 'bottomRightRadius', node.bottomRightRadius),
      await dim(node, 'bottomLeftRadius', node.bottomLeftRadius),
    ]);
  }
  s.size = [await dim(node, 'width', node.width), await dim(node, 'height', node.height)];
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    s.mode = node.layoutMode;
    s.sizing = [node.layoutSizingHorizontal, node.layoutSizingVertical];
    s.gap = await dim(node, 'itemSpacing', node.itemSpacing);
    s.padding = same([
      await dim(node, 'paddingTop', node.paddingTop),
      await dim(node, 'paddingRight', node.paddingRight),
      await dim(node, 'paddingBottom', node.paddingBottom),
      await dim(node, 'paddingLeft', node.paddingLeft),
    ]);
  }

  const txt = node.findOne((n) => n.type === 'TEXT');
  if (txt) {
    const t = { layer: txt.name };
    const tf = await paintOf(txt.fills);
    if (tf !== null) t.fill = tf;
    // A published text style is the API for type, but Pushpin's components do
    // not all apply one — Button's Label carries none — so this is null rather
    // than absent, and the size beside it is what actually renders.
    if (txt.textStyleId && txt.textStyleId !== figma.mixed) {
      const st = await figma.getStyleByIdAsync(txt.textStyleId);
      t.style = st ? st.name : null;
    } else {
      t.style = null;
    }
    if (txt.fontSize !== figma.mixed) t.size = r4(txt.fontSize);
    s.text = t;
  }
  return s;
}

// Same gate as §5, and it has to be the same one: a spec for a component the
// catalog does not hold is a spec nothing can reach, and `verify.mjs` fails on
// it. The old `!/^[_.]/.test(n.name)` test recorded four components the library
// never published and skipped two it does.
const owners = [];
for (const n of page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })) {
  if (n.parent && n.parent.type === 'COMPONENT_SET') continue;
  if ((await n.getPublishStatusAsync()) === 'UNPUBLISHED') continue;
  owners.push(n);
}

const out = {};
const skipped = [];
// A page can publish the same name twice, and `out[owner.name] = …` would let
// the second overwrite the first inside this script — before anything reaches
// the merge, where the only surviving evidence is `owners` exceeding the key
// count by one. The Layouts page does exactly this. Naming the loser here is
// what turns "9 owners, 8 keys" into something a reader can act on.
const collisions = [];
for (const owner of owners) {
  if (ONLY && !ONLY.includes(owner.name)) { skipped.push(owner.name); continue; }
  if (out[owner.name]) {
    collisions.push({ name: owner.name, kept: out[owner.name].nodeId, dropped: owner.id });
    continue;
  }

  if (owner.type !== 'COMPONENT_SET') {
    out[owner.name] = {
      type: owner.type, page: page.name, nodeId: owner.id, resting: await spec(owner),
    };
    continue;
  }

  const defs = owner.componentPropertyDefinitions || {};
  const axes = {};
  const defaults = {};
  for (const [k, d] of Object.entries(defs)) {
    if (d.type !== 'VARIANT') continue;
    axes[k] = d.variantOptions || [];
    defaults[k] = d.defaultValue;
  }
  const axisNames = Object.keys(axes);
  const kids = owner.children.filter((c) => c.type === 'COMPONENT');

  // One representative per (axis, option): the real child carrying that option
  // and the most defaults on every other axis, ties broken by child order.
  // Walking real children rather than the axis cross product is the point —
  // Button has 260 children against a 960-combination product — and holding the
  // other axes at their defaults is what makes a recorded variant a statement
  // about that one option rather than about a combination.
  const chosen = new Map();
  const unreachable = [];
  for (const axis of axisNames) {
    for (const option of axes[axis]) {
      let best = null;
      let bestScore = -1;
      for (const c of kids) {
        const vp = c.variantProperties || {};
        if (vp[axis] !== option) continue;
        let score = 0;
        for (const o of axisNames) if (o !== axis && vp[o] === defaults[o]) score++;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (!best) { unreachable.push(`${axis}=${option}`); continue; }
      if (!chosen.has(best.id)) chosen.set(best.id, { node: best, for: [] });
      chosen.get(best.id).for.push(`${axis}=${option}`);
    }
  }

  const picked = [...chosen.values()].slice(0, CAP);
  const variants = [];
  for (const { node, for: forWhat } of picked) {
    const vp = node.variantProperties || {};
    const props = {};
    for (const k of axisNames) if (vp[k] !== defaults[k]) props[k] = vp[k];
    variants.push({ for: forWhat, props, ...(await spec(node)) });
  }

  const entry = {
    type: owner.type, page: page.name, nodeId: owner.id,
    axes, defaults,
    children: kids.length,
    crossProduct: axisNames.reduce((a, k) => a * axes[k].length, 1),
    recorded: variants.length,
  };
  if (variants.length < kids.length) {
    entry.reduced = {
      children: kids.length,
      recorded: variants.length,
      cappedAt: chosen.size > CAP ? CAP : null,
    };
  }
  if (unreachable.length) entry.unreachable = unreachable;
  entry.variants = variants;
  out[owner.name] = entry;
}

return { page: page.name, pageId: page.id, owners: owners.length, recorded: Object.keys(out).length, skipped, collisions, components: out };
```

Save each batch as `{ group, lanes, components }` — `lanes` being one
`{ lane, pageId, figmaPage, status, expected, recorded, collisions, note }` per
call, so a lane that came back empty is distinguishable from a page with nothing
on it, and a name the page published twice is distinguishable from a name it
never published — and distil them all together:

```bash
node scripts/build-specs.mjs specs-1.json specs-2.json …
```

The distiller sorts, merges, and writes the coverage block. It is independent of
the order the files are given in, deliberately: nothing about which lane
finished first should be able to change the asset.

Without a flag that write is total: pages you did not read this time lose their
specs. When a republish touches a handful of pages, read those pages and merge
them into what is already committed:

```bash
node scripts/build-specs.mjs --merge specs-1.json specs-2.json …
```

A merge replaces a page it read whole and keeps every other page. It carries
forward only entries the catalog still holds, because `verify.mjs` fails on a
spec with no catalog record and a merge must not carry that failure forward.
Provenance moves from one `extractedAt` for the file to a `source.pageCaptures`
map of page to date, so a page read six weeks ago cannot pass as fresh — and a
page read under an `ONLY` list keeps its earlier date, since it is no fresher
than the part nobody re-read. The run says which pages those were.

Five things to know about the result:

- **The reduction is recorded, and `verify.mjs` holds it to the record.** 452
  variants are kept out of 1073 real children. Each set stores `children`,
  `crossProduct`, `recorded` and a `reduced` block, and every axis option must
  be covered by a recorded variant or listed in `unreachable`. An unrecorded
  reduction reads as a complete answer, which is the failure this whole asset
  exists to remove. The cap is 24 per set and nothing reached it — Button's
  seven axes offer 21 options between them.
- **A bound variable with no Pushpin token is recorded as itself.** Button's
  height binds `Control Sizes/xl` and its stroke weights bind `Border/inputs`,
  both from `Figma / Semantic Dimensions`, and neither is in
  `tokens.figma.json`. `Checkbox` binds `Background/Primary/medium [default]`,
  which *is* in `Tokens / Semantic Colors` and still absent from the capture, so
  the collection name alone does not settle it. `lib/specs.mjs` checks
  membership and prints the Figma path where there is no `--pp-*` name.
- **Colour literals are one mode.** The kit's component pages render in Light,
  so `background/brand/strong` comes back `#07344a` and not the Dark `#36ccfa`.
  `source.colorMode` states which, and `verify.mjs` checks every semantic-colour
  literal against that mode. Five `Alert` variants render `heading/neutral/default`
  as `#450a0a`, which is neither mode — recorded under
  `coverage.coloursMatchingNeitherMode`, not reconciled.
- **A name published twice keeps the catalog's node.** The kit has two `Tabs`
  sets, on `Additional components` and on `Tabs`. §5's catalog keys by name too,
  so it holds one of them and names the loser in `source.nameCollisions`. Unlike
  §7, the loser is not kept here under a `<name> [<nodeId>]` key: the catalog
  cannot name it, so no `data-pp-component` declaration could ever reach the
  spec. It is recorded in `coverage.nameCollisions` with both pages and both
  node ids instead.
- **`coverage.withSpec` is measured against the catalog, not against the kit.**
  Both key by name, so a name published twice counts once in each and can never
  appear in `withoutSpec`. `113 of 115` therefore means names the catalog
  holds. The `Layouts` page publishes nine owners under eight names, and the
  ninth spec is missing from this capture for that reason — read
  `coverage.nameCollisions` and `coverage.captureNotes` before treating the
  count as completeness. The two in `withoutSpec`, `_Bubble / Text` and
  `_Stamps`, are the components the publish-status gate added to the catalog
  after this capture ran; they get specs the next time §9 is run.

## Transcription notes

- **Round the float noise.** Figma returns line heights as
  `50.400001525878906`. `tokens.figma.json` stores `50.4`. This is the only
  value massaging permitted, and only for IEEE-754 artifacts — never to "fix" a
  value that looks wrong.
- **Keep names verbatim** for every collection except `Tokens / Font`, whose
  flat `<step>/<property>` paths are regrouped into one object per step. That
  regrouping absorbs the kit's `title-8/line-heigh` typo — worth reporting
  upstream, but not worth propagating into a custom property name. No other
  collection is restructured.
- **Scrim** comes back as a serialized RGBA object; convert to `rgba()`.
- After transcribing, run `node scripts/build-css.mjs`, then
  `node scripts/manifest.mjs` to rehash, then `node scripts/verify.mjs`. Commit
  the JSON, the CSS, and the manifest together — they describe one capture at
  one moment, and splitting them makes provenance unreadable.

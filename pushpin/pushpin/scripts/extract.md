# Re-extracting the captures from Figma

Everything in `assets/` is produced by running these read-only scripts against
the source files and transcribing the results. They are recorded here so the
captures are reproducible rather than one-time acts.

Sections 1–5 read the Pushpin file, `VVRGrLgkPRU3vs765d5Q3r`. Section 6 reads
the Annotation Kit, `Qefv6O2RMPSBtSYBrCGcdI`. Section 7 reads the older
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

## 4. Component catalog

`assets/components.figma.json` comes from the MCP tool
`list_file_components_for_code_connect` (a read, despite the name — it takes
only a `fileKey` and publishes nothing). Pipe its raw output through the
distiller:

```bash
node scripts/build-components.mjs <path-to-raw-dump.json>
```

The raw dump was 1071 entries at capture; 951 are internal parts named `_…` or
`.…` that exist to build the public components and are dropped.

## 5. Variable keys

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

## 6. Annotation Kit

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
current. The four pages and their ids:

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
  // Internal parts, same rule as the Pushpin catalog: never placed directly.
  if (n.name.startsWith('_') || n.name.startsWith('.')) continue;

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
component node found), `internalOmitted`, and `publicKept`. `publicKept` must
equal the number of keys in `components`; that is what makes the count checkable
rather than decorative.

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
adding any, so there is nothing here corresponding to sections 2, 3 or 5.

## 7. Icons

`assets/icons.figma.json` — `fileKey: jjhhb3Kp6a7JrtBLCjrf6u`, page `2:1`.

**Icons are not published from the Pushpin file.** They never were: the Pushpin
kit's component dump holds 117 public entries and not one of them is an icon,
which is why the plugin had no way to place one until this catalog existed. The
set lives on the Icons page of the older Thumbprint UI Kit and publishes from
that file's library. Capturing it against `VVRGrLgkPRU3vs765d5Q3r` returns
nothing and looks like a kit that lost its icons.

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

# Re-extracting tokens from Figma

`assets/tokens.figma.json` is produced by running these read-only scripts
against the Pushpin file and transcribing the results. They are recorded here so
the capture is reproducible rather than a one-time act.

To find out **whether** anything changed, use [check.md](check.md) instead — one
capture per vantage point, fed to `diff.mjs`, which classifies what moved. Come
here when you already know you are re-transcribing the whole thing.

Load the `figma-use` skill first — it is a required prerequisite for `use_figma`
— and pass `fileKey: VVRGrLgkPRU3vs765d5Q3r` on every call.

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

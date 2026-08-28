# Checking the kit for changes

Seven read-only captures across three files. Sections 1–3 and 5 feed
`scripts/diff.mjs`; sections 4 and 6 cover the Annotation Kit and the component
visual specs, neither of which `diff.mjs` reads — each is compared by
overwriting its own asset and reading `git diff`. Run them, save each result to
a file, and diff. Nothing here writes to Figma.

Load the `figma-use` skill first — it is a required prerequisite for
`use_figma`.

## 0. Cheaper first

The captures below are manual and slow. Before taking them, run:

```bash
node scripts/freshness.mjs
```

It reports all four captures' ages with no token at all, and with `FIGMA_TOKEN`
set it also confirms that every component and style key in the Pushpin catalog,
every component key in the Annotation Kit catalog, and every one of the 899 icon
keys still resolves. `GITHUB_TOKEN` answers the fourth source, the content
design rules, where the question is whether the blob they were parsed from has
moved rather than whether a key resolves — and a blob that has is re-pulled with
`node scripts/pull-copy.mjs && node scripts/build-copy.mjs`, not with anything
below. A clean run on a recent capture is good enough for most questions, and it
costs one command instead of several plugin round-trips. Take the full captures
when it exits non-zero on one of the Figma layers, when you intend to update
`assets/` anyway, or when you need to know exactly *what* moved rather than
*that* something did.

Note that `freshness.mjs` reads the published state over REST. It cannot see
unpublished editor state, which is the whole reason the kit capture below
exists.

## Why two vantage points

`use_figma` inside the kit reads **editor state**, which includes edits that
have not been published. A consuming file sees only what was published. The two
answer different questions and the refresh needs both:

| | Kit file | Consuming file |
|---|---|---|
| Values, aliases, modes | yes | no |
| `hiddenFromPublishing` flag | yes | no |
| What consumers can actually import | **no** | yes |

Querying the kit for publish state returns nothing useful — a file is never
listed as a library available to itself, so `getAvailableLibraryVariableCollectionsAsync`
comes back empty and every collection looks unpublished. That is a property of
the API, not a finding about the kit.

When the two disagree, the kit has unpublished work in progress. `diff.mjs`
reports that rather than guessing which is right.

## 1. Kit capture

`fileKey: VVRGrLgkPRU3vs765d5Q3r`. Save the result as `kit.json`.

Deliberately faithful rather than tidy: values are returned as Figma reports
them, floats and all. Normalising is `diff.mjs`'s job, using the same rules as
the committed capture, so the two are comparable without the Figma-side script
having to reproduce transcription conventions.

Faithful includes units. Anywhere Figma returns a `{ value, unit }` object —
`letterSpacing` and `lineHeight` on a text style — take the whole object.
Reading `.value` and dropping the unit is how the committed capture came to
record -2 as pixels when the kit means percent.

```js
const toHex = (c) => {
  if (!c) return null;
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  const base = '#' + h(c.r) + h(c.g) + h(c.b);
  return (c.a !== undefined && c.a < 0.999) ? base + h(c.a) : base;
};

const cols = await figma.variables.getLocalVariableCollectionsAsync();
const collections = {};
const hidden = {};
const keys = {};

for (const c of cols) {
  if (!c.name.startsWith('Tokens / ')) continue;
  const modes = c.modes.map((m) => ({ id: m.modeId, name: m.name }));
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
      } else if (val && typeof val === 'object' && 'r' in val) {
        entry[m.name] = toHex(val);
      } else if (val && typeof val === 'object') {
        entry[m.name] = JSON.stringify(val);
      } else {
        entry[m.name] = val;
      }
    }
    vars[v.name] = entry;
    (keys[c.name] = keys[c.name] || {})[v.name] = v.key;
    if (v.hiddenFromPublishing) (hidden[c.name] = hidden[c.name] || []).push(v.name);
  }
  collections[c.name] = { modes: modes.map((m) => m.name), vars };
}

const ts = await figma.getLocalTextStylesAsync();
const textStyles = {};
for (const s of ts) {
  textStyles[s.name] = {
    key: s.key,
    font: s.fontName.family + ' / ' + s.fontName.style,
    size: s.fontSize,
    // Both metrics travel as Figma's `{ value, unit }` object. Reading `.value`
    // alone once turned -2 PERCENT into -2px in the committed capture, and no
    // check downstream could tell the difference.
    letterSpacing: s.letterSpacing,
    lineHeight: s.lineHeight,
    hidden: !!s.hiddenFromPublishing,
  };
}

const es = await figma.getLocalEffectStylesAsync();
const effectStyles = {};
for (const s of es) effectStyles[s.name] = { key: s.key, hidden: !!s.hiddenFromPublishing };

return {
  capturedAt: new Date().toISOString().slice(0, 10),
  survey: {
    pages: figma.root.children.length,
    collections: cols.length,
    textStyles: ts.length,
    effectStyles: es.length,
  },
  collections,
  hidden,
  keys,
  textStyles,
  effectStyles,
};
```

## 2. Published capture

Run against **any file that subscribes to the kit** — not the kit itself. A
scratch file is fine. Save the result as `published.json`.

```js
const cols = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
const pushpin = cols.filter((c) => c.libraryName === 'Pushpin Thumbprint UI Kit');
const published = {};
let total = 0;
for (const c of pushpin) {
  const m = {};
  try {
    for (const v of await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key)) {
      m[v.name] = v.key;
      total++;
    }
  } catch (e) {
    m.__error = e.message;
  }
  published[c.name] = m;
}
return { capturedAt: new Date().toISOString().slice(0, 10), total, published };
```

If a collection you expect is missing from `getAvailableLibraryVariableCollectionsAsync`
entirely, the library was unpublished or the file lost its subscription. That is
a bigger event than a token change and worth stopping on.

## 3. Component capture

Three reads, and the second is what decides membership. The dump alone cannot
answer whether a component is published, and guessing from the name is the
defect this capture exists to avoid.

- From the MCP tool `list_file_components_for_code_connect` with
  `fileKey: VVRGrLgkPRU3vs765d5Q3r` — a read despite the name. Keep the raw
  array.
- `getPublishStatusAsync()` for every `nodeId` in that array, via the batched
  `use_figma` sweep in [extract.md §5](extract.md). 300 ids per call.
- The import pass in [extract.md §5](extract.md), which returns
  `publishedProperties` and `publishedNames` on one round trip. 29 keys per call.

Save them together as `components.json` in the shape §5 documents —
`{ components, publishStatus, publishedProperties, publishedNames }`.

**Every `nodeId` in the dump needs a status.** The distiller counts them and
refuses a capture that is short, because a sweep lane that failed silently looks
exactly like a lane that reported nothing, and the components it skipped would
otherwise arrive in the catalog with keys that throw at import.

**Take the import pass.** `publishedNames` on its own is the optional half —
`diff.mjs` compares `publishedAs` when it is present and says nothing when it is
not — but it rides on the same calls as `publishedProperties`, which is the half
that decides whether a generation run survives `setProperties`. Without it
`diff.mjs` compares no properties at all and prints a note saying so, which is
the quietest way for this capture to look complete and not be.

`diff.mjs` distils the result with the same code that built the committed
catalog, and refuses a bare array rather than falling back to the name rule.

## 4. Annotation Kit capture

`fileKey: Qefv6O2RMPSBtSYBrCGcdI`. Run the four per-page scripts from
[extract.md §7](extract.md), one call per page in parallel, and merge them the
same way. All four go out in one message and the merge waits on every one of
them — see [parallel.md](../reference/parallel.md), since a lane whose result
never came back reads exactly like a page the capture never visited.

This capture is its own comparison. Because that script emits entries in the
committed shape, the check is to write the merged result over
`assets/annotations.figma.json` and read `git diff`. Nothing new has to be built
and nothing can fall out of step with the committed catalog, which is the whole
reason there is no distiller and no `diff.mjs` flag for this file.

`node scripts/manifest.mjs --check` is the tripwire: it exits non-zero the
moment the catalog's content hash moves, so a refresh cannot be committed
half-done.

What to look for in that diff, in descending order of how much it will hurt:

| Change | Why it matters |
|---|---|
| A removed component, or a changed `key` | `importComponentByKeyAsync` throws — generation dies mid-run |
| A changed property `key` | `setProperties` throws on the old key, which is exactly the failure this catalog exists to prevent |
| A changed or removed variant option | `setProperties` throws on a value that no longer exists |
| A new component | Nothing breaks; the catalog is just describing less than the library holds |

An added or renamed page shows up as a changed `page` field and a changed
`source.pages`. That is worth stopping on rather than accepting: the per-page
scripts are keyed to page ids, so a page the capture does not visit is a set of
components silently missing from the catalog.

## 5. Icon capture

`fileKey: jjhhb3Kp6a7JrtBLCjrf6u` — the **Thumbprint UI Kit**, not the Pushpin
file. Icons are published from there by design rather than pending a move, which
is why they need their own capture against their own file.

Two reads, because neither alone distils:

- `list_file_components_for_code_connect` with that `fileKey`. Save the raw
  array as `icons-raw.json`. It carries the names and the `assetKey`s and
  nothing about how the page is organised.
- `get_metadata` with that `fileKey` and `nodeId: 2:1`. Save it as
  `icons-page.xml`. It carries the ten category frames and which icons sit in
  each, and no keys.

They join on `nodeId`, and `diff.mjs` distils them with the same code that built
the committed catalog.

## 6. Component spec capture

`fileKey: VVRGrLgkPRU3vs765d5Q3r`. Run the per-page script from
[extract.md §9](extract.md) against the 44 pages that hold published components,
batched in parallel — see [parallel.md](../reference/parallel.md) — and distil
the batches together with `node scripts/build-specs.mjs`.

Like §4, this capture is its own comparison: the distiller writes the committed
shape, so the check is to let it overwrite
`assets/component-specs.figma.json` and read `git diff`. `diff.mjs` has no flag
for it, for the same reason — there is no second pipeline that could fall out of
step with the first.

`node scripts/verify.mjs` is the tripwire here rather than `manifest.mjs
--check` alone. It re-derives the reduction from the variants beside it, so a
refresh that dropped variants without updating the `reduced` block fails, and it
re-resolves every semantic-colour literal against `source.colorMode`, so a page
recaptured in the wrong mode fails too.

What to look for in that diff, in descending order of how much it will hurt:

| Change | Why it matters |
|---|---|
| A variant that changed fill, stroke or radius | The generated `DESIGN.md` spec bullets and `check.mjs --variant` fidelity are both now wrong in every consuming project |
| A binding that moved from a `Tokens / …` collection to one outside it | The spec loses its `--pp-*` name and starts printing a bare number; usually means a token was retired |
| A new axis option | `lookup --variant` answers "not recorded" until the page is recaptured |
| A new `coverage.coloursMatchingNeitherMode` entry | A component is overriding a token it claims to use — worth reporting upstream |
| A rising `withoutSpec` count | The catalog grew and the capture did not follow |

## 7. Diff

```bash
node scripts/diff.mjs --kit kit.json --published published.json \
                      --components components.json \
                      --icons icons-raw.json --icons-page icons-page.xml
```

Every argument is optional, so a quick token-only check is just `--kit`. The
command exits non-zero if anything breaking turned up. It reads the Pushpin and
icon captures; the Annotation Kit is covered by section 4 and by the
`annotations` layer in `freshness.mjs`, and the visual specs by section 6.

`--icons` needs `--icons-page` alongside it. Without the page metadata every
icon distils as `uncategorised`, which would report as 227 category changes
rather than as the missing input it is, so the script refuses instead.

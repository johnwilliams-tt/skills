#!/usr/bin/env node
/**
 * Round-trip check: resolve every semantic color in pushpin.css through its
 * var() chain and compare the result against independently resolving the same
 * token's alias chain in tokens.figma.json.
 *
 * build-css.mjs --check proves the CSS matches a fresh build. This proves the
 * build itself is faithful — that no alias resolves to the wrong hex.
 *
 * Usage: node scripts/verify.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, '..', 'assets', 'tokens.figma.json'), 'utf8'));
const css = readFileSync(join(here, '..', 'assets', 'pushpin.css'), 'utf8');

/** Resolve a token's alias chain in the Figma JSON down to a literal hex. */
function figmaHex(path, mode, seen = new Set()) {
  if (seen.has(path)) throw new Error(`alias cycle at ${path}`);
  seen.add(path);
  if (path in t.baseColors) return t.baseColors[path];
  const entry = t.semanticColors[path];
  if (!entry) throw new Error(`unknown token ${path}`);
  const v = entry[mode];
  return v.startsWith('@') ? figmaHex(v.slice(1), mode, seen) : v;
}

/** Parse a CSS block's custom property declarations into a map. */
function declsIn(block) {
  const map = new Map();
  for (const m of block.matchAll(/(--pp-[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}'));
const darkStart = css.indexOf('[data-pp-theme="dark"] {');
const darkBlock = css.slice(darkStart, css.indexOf('\n}', darkStart));

const light = declsIn(rootBlock);
const dark = new Map([...light, ...declsIn(darkBlock)]);

/** Resolve a var() chain in the CSS to a literal. */
function cssHex(name, table, seen = new Set()) {
  if (seen.has(name)) throw new Error(`var cycle at ${name}`);
  seen.add(name);
  const raw = table.get(name);
  if (raw === undefined) throw new Error(`missing ${name} in CSS`);
  const m = raw.match(/^var\((--pp-[\w-]+)\)$/);
  return m ? cssHex(m[1], table, seen) : raw;
}

const seg = (p) => p.replace(/\//g, '-');
const problems = [];
let checked = 0;

for (const path of Object.keys(t.semanticColors)) {
  if (path.startsWith('$')) continue;
  for (const mode of ['Light', 'Dark']) {
    const expected = figmaHex(path, mode);
    const actual = cssHex(`--pp-${seg(path)}`, mode === 'Light' ? light : dark);
    checked++;
    if (expected.toLowerCase() !== actual.toLowerCase()) {
      problems.push(`${path} [${mode}]: css=${actual} figma=${expected}`);
    }
  }
}

for (const [path, hex] of Object.entries(t.baseColors)) {
  if (path.startsWith('$')) continue;
  const actual = cssHex(`--pp-color-${seg(path)}`, light);
  checked++;
  if (hex.toLowerCase() !== actual.toLowerCase()) {
    problems.push(`base ${path}: css=${actual} figma=${hex}`);
  }
}

// Every colour token must be accounted for in the Figma keys file as either
// bindable or deliberately hidden from publishing. An unaccounted token means
// the two captures have drifted, and a generation script would fail at runtime
// on an import that silently doesn't exist.
const keys = JSON.parse(readFileSync(join(here, '..', 'assets', 'variable-keys.figma.json'), 'utf8'));
const accounted = (collection, name) =>
  Boolean(keys.bindable[collection]?.[name]) ||
  (keys.hiddenFromPublishing[collection] ?? []).includes(name);

for (const [collection, source] of [
  ['Semantic Colors', t.semanticColors],
  ['Base Colors', t.baseColors],
]) {
  for (const name of Object.keys(source)) {
    if (name.startsWith('$')) continue;
    checked++;
    if (!accounted(collection, name)) {
      problems.push(`${name}: not listed as bindable or hidden under ${collection}`);
    }
  }
}

// A token must never appear in both lists — that would make "can I bind this?"
// unanswerable.
for (const collection of Object.keys(keys.bindable)) {
  for (const name of Object.keys(keys.bindable[collection])) {
    checked++;
    if ((keys.hiddenFromPublishing[collection] ?? []).includes(name)) {
      problems.push(`${name}: listed as both bindable and hidden under ${collection}`);
    }
  }
}

const bindableTotal = Object.values(keys.bindable).reduce((n, c) => n + Object.keys(c).length, 0);
const hiddenTotal = Object.entries(keys.hiddenFromPublishing)
  .filter(([k]) => !k.startsWith('$'))
  .reduce((n, [, v]) => n + v.length, 0);
checked += 2;
if (bindableTotal !== keys.source.bindableCount) {
  problems.push(`bindable count is ${bindableTotal}, header claims ${keys.source.bindableCount}`);
}
if (hiddenTotal !== keys.source.hiddenCount) {
  problems.push(`hidden count is ${hiddenTotal}, header claims ${keys.source.hiddenCount}`);
}

// The spacing keys are embedded in reference/generate.md so a generation lane
// can inline the snap-and-bind helper without a lookup first. That makes them a
// second copy of the capture, and it is the one copy that fails silently: every
// key is 40 hex characters, a wrong one is a perfectly valid key for a different
// step, and the frame it binds looks deliberate at the wrong size.
const generate = readFileSync(join(here, '..', 'reference', 'generate.md'), 'utf8');
const spaceBlock = generate.match(/const SPACE = \{([^}]*)\}/);
checked++;
if (!spaceBlock) {
  problems.push('reference/generate.md: no `const SPACE = { … }` block to check');
} else {
  // Keyed by pixels in the doc, by step in the capture — which is the mapping
  // the check exists to hold, since `space/4` is the fourth step and 16px.
  const quoted = new Map();
  for (const m of spaceBlock[1].matchAll(/(\d+):\s*'([0-9a-f]{40})'/g)) {
    quoted.set(Number(m[1]), m[2]);
  }
  const steps = Object.entries(t.space).filter(([step]) => !step.startsWith('$'));
  checked++;
  if (quoted.size !== steps.length) {
    problems.push(
      `reference/generate.md quotes ${quoted.size} spacing keys, the scale has ${steps.length}`,
    );
  }
  for (const [step, px] of steps) {
    checked++;
    const expected = keys.bindable.Space[step];
    if (!quoted.has(px)) {
      problems.push(`reference/generate.md: no key quoted for ${px}px (space/${step})`);
    } else if (quoted.get(px) !== expected) {
      problems.push(
        `reference/generate.md: ${px}px (space/${step}) quotes ${quoted.get(px)}, ` +
          `variable-keys.figma.json has ${expected}`,
      );
    }
  }
}

// Radius keys are quoted by name, so the comment beside each one is enough to
// check it against. The count is asserted because the match is what finds them:
// reworded the comment and this check would pass by inspecting nothing.
const radiusQuoted = [...generate.matchAll(/'([0-9a-f]{40})',\s*\/\/ corner-radius\/([a-z]+)/g)];
checked++;
if (!radiusQuoted.length) {
  problems.push('reference/generate.md: no `// corner-radius/<name>` key to check');
}
for (const [, key, name] of radiusQuoted) {
  checked++;
  const expected = keys.bindable['Corner Radius'][name];
  if (expected !== key) {
    problems.push(
      `reference/generate.md: corner-radius/${name} quotes ${key}, ` +
        `variable-keys.figma.json has ${expected ?? 'no such token'}`,
    );
  }
}

// The icon catalog states three counts in its header and they are the only
// thing standing between it and a silently lossy merge — two icons published
// under one name, or a size dropped, would otherwise look like a smaller kit
// rather than a broken capture. Same reasoning as the bindable/hidden totals
// above: a number nothing checks is decoration.
const iconCatalog = JSON.parse(readFileSync(join(here, '..', 'assets', 'icons.figma.json'), 'utf8'));
const iconEntries = Object.entries(iconCatalog.icons);
const iconKeyTotal = iconEntries.reduce((n, [, e]) => n + Object.keys(e.keys).length, 0);
const iconSizes = Object.keys(iconCatalog.sizes);

checked += 2;
if (iconEntries.length !== iconCatalog.source.publicKept) {
  problems.push(
    `icon catalog holds ${iconEntries.length} entries, header claims ` +
      `${iconCatalog.source.publicKept}`,
  );
}
if (iconKeyTotal !== iconCatalog.source.keyCount) {
  problems.push(`icon keys total ${iconKeyTotal}, header claims ${iconCatalog.source.keyCount}`);
}

for (const [name, entry] of iconEntries) {
  checked++;
  const sizes = Object.keys(entry.keys);
  if (!sizes.length) {
    problems.push(`icon ${name}: no keys at any size`);
    continue;
  }
  const unknown = sizes.filter((s) => !iconSizes.includes(s));
  if (unknown.length) {
    problems.push(`icon ${name}: size ${unknown.join(', ')} is not on the ramp`);
  }
  // An icon that does not publish every size is legal and recorded, but it has
  // to be recorded — the placement rules send a caller to a size that exists,
  // and they read `incomplete` to know which ones don't.
  if (sizes.length !== iconSizes.length && !iconCatalog.incomplete[name]) {
    problems.push(`icon ${name}: publishes ${sizes.length} of ${iconSizes.length} sizes, ` +
      `but is not listed under incomplete`);
  }
}

// The join in copy-map.json is the one part of the copy chain no upstream can
// supply, and the only one that rots without anything failing. build-copy.mjs
// asserts it while building, but that runs when the rules change — a kit
// refresh that renames a component happens on the other clock entirely, and it
// leaves copy.json pointing at a name nobody publishes any more, silently
// un-limiting the component. This is what looks in between.
const copyMap = JSON.parse(
  readFileSync(join(here, '..', 'assets', 'copy-map.json'), 'utf8'),
).map;
const catalog = JSON.parse(
  readFileSync(join(here, '..', 'assets', 'components.figma.json'), 'utf8'),
).components;

for (const [row, entry] of Object.entries(copyMap)) {
  const mapped = entry.pushpin ?? [];
  checked++;
  // A gap is legitimate — a header is a type ramp step, not a component — but
  // an unexplained one is indistinguishable from a mapping someone forgot.
  if (!mapped.length && !entry.note) {
    problems.push(`copy-map.json: ${row} maps to nothing and says nothing about why`);
  }
  for (const name of mapped) {
    checked++;
    if (!(name in catalog)) {
      problems.push(`copy-map.json: ${row} maps to "${name}", which is not in the component catalog`);
    }
  }
}

// Every capture must still hash to what the manifest recorded. This is the only
// check that catches a hand-edited capture: build-css.mjs --check proves the CSS
// matches the JSON, but a JSON edited to match a wrong assumption would pass it.
const manifest = JSON.parse(readFileSync(join(here, '..', 'assets', 'manifest.json'), 'utf8'));
for (const [file, expected] of Object.entries(manifest.hashes)) {
  checked++;
  const actual = hashAsset(join(here, '..', 'assets', file));
  if (actual !== expected) {
    problems.push(
      `${file}: content hash ${actual} but manifest records ${expected}. ` +
        `Either the file was hand-edited, or the manifest needs regenerating.`,
    );
  }
}

if (problems.length) {
  console.error(`${problems.length} of ${checked} checks failed:\n`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
// The two totals count variables, not the token entries in tokens.figma.json —
// the type ramp is one entry per step and three variables. The sentence says
// "color token" for that reason: 131 + 168 not summing to 273 would otherwise
// read as an arithmetic bug.
console.log(
  `All ${checked} checks pass — colors resolve to their Figma values, and every color token is ` +
    `accounted for in the ${bindableTotal + hiddenTotal} captured variable keys ` +
    `(${bindableTotal} bindable, ${hiddenTotal} hidden from publishing).`,
);

// Every check above compares the repo against itself, so all of them pass on a
// capture that went stale months ago. That makes the sentence just printed the
// most likely source of false confidence in the whole toolchain, which is why
// the capture date is stated right underneath it rather than left to be found.
const ageDays = Math.max(
  0,
  Math.floor((Date.now() - Date.parse(`${manifest.capturedAt}T00:00:00Z`)) / 86_400_000),
);
console.log(
  `Captured ${manifest.capturedAt}, ${ageDays} day${ageDays === 1 ? '' : 's'} ago. Nothing here ` +
    `asks Figma whether that is still current — run scripts/freshness.mjs for that.`,
);

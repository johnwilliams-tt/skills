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
console.log(
  `All ${checked} checks pass — colors resolve to their Figma values, and every token is ` +
    `accounted for as bindable (${bindableTotal}) or hidden from publishing (${hiddenTotal}).`,
);

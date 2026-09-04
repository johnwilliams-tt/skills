/**
 * What the pull-*.mjs scripts share besides the REST client: argument reading,
 * the manifest, the committed asset they compare against under `--check`, and
 * the value transcription rules the plugin-API captures in scripts/extract.md
 * apply, so that a REST capture rounds and hex-encodes the way the committed
 * catalogs do rather than the way JavaScript happens to.
 *
 * `--check` means the same thing in every pull script: take the capture, hold
 * it against the committed asset, write nothing, and exit 1 if the kit has
 * moved. `compareEntries` is that comparison — a map of name to entry on each
 * side, and the names that were added, removed or changed between them.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ASSETS = join(here, '..', '..', 'assets');

export const manifest = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));

export const loadCommitted = (file) => JSON.parse(readFileSync(join(ASSETS, file), 'utf8'));

export const today = () => new Date().toISOString().slice(0, 10);

/** `--name value` from argv, or the default when the flag is absent. */
export function option(argv, name, dflt = undefined) {
  const i = argv.indexOf(name);
  if (i === -1) return dflt;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) {
    console.error(`${name} needs a value`);
    process.exit(1);
  }
  return v;
}

export const flag = (argv, name) => argv.includes(name);

export function writeJson(path, doc) {
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}

/**
 * The only value massaging the captures permit: IEEE-754 noise rounded away,
 * so 50.400001525878906 is 50.4. Never applied to a value that merely looks
 * wrong — see scripts/extract.md § Transcription notes.
 */
export const r4 = (n) => (typeof n === 'number' ? Math.round(n * 1e4) / 1e4 : null);

/**
 * A REST colour as the plugin capture writes it: `#rrggbb`, with `aa` appended
 * only when the paint is translucent. The plugin reads alpha off the paint's
 * `opacity`; REST carries an alpha channel on the colour as well, so both are
 * honoured and multiplied, which is a no-op when either is 1.
 */
export function hex(color, opacity) {
  if (!color) return null;
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  let s = '#' + h(color.r) + h(color.g) + h(color.b);
  const alpha = (typeof opacity === 'number' ? opacity : 1) * (typeof color.a === 'number' ? color.a : 1);
  if (alpha < 0.999) s += h(alpha);
  return s;
}

/** Four sides, collapsed to one entry when they agree — the capture's `same`. */
export function same(a) {
  const k = a.map((v) => JSON.stringify(v));
  return k.every((v) => v === k[0]) ? a[0] : a;
}

/**
 * Names added, removed and changed between two maps of name to entry. `strip`
 * names fields that do not count as movement — capture dates, or fields the
 * REST capture carries from the committed asset rather than reading afresh.
 */
export function compareEntries(before, after, strip = []) {
  const clean = (e) => {
    if (!e || typeof e !== 'object') return e;
    const out = { ...e };
    for (const f of strip) delete out[f];
    return out;
  };
  const added = Object.keys(after).filter((k) => !(k in before)).sort();
  const removed = Object.keys(before).filter((k) => !(k in after)).sort();
  const changed = Object.keys(after)
    .filter((k) => k in before && JSON.stringify(clean(before[k])) !== JSON.stringify(clean(after[k])))
    .sort();
  return { added, removed, changed, moved: added.length + removed.length + changed.length > 0 };
}

/** Print a comparison and exit with its verdict. */
export function reportCheck(what, cmp, remedy) {
  if (!cmp.moved) {
    console.log(`${what}: unchanged against the committed asset.`);
    process.exit(0);
  }
  console.error(`${what} has moved against the committed asset.`);
  for (const n of cmp.added) console.error(`  added    ${n}`);
  for (const n of cmp.removed) console.error(`  removed  ${n}`);
  for (const n of cmp.changed) console.error(`  changed  ${n}`);
  console.error(`\n${remedy}`);
  process.exit(1);
}

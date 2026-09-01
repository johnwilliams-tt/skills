#!/usr/bin/env node
/**
 * Re-captures the component catalogs for one project, from that project's own
 * Figma access.
 *
 * The plugin ships a capture and a project reads it. Between the two sits a
 * library that republishes on its own schedule, and the gap is not academic:
 * Button lost four themes, dropped from five sizes to two, and reissued its
 * `Label` and icon property keys, so every `setProperties` call written against
 * the shipped catalog throws. Until now the only repair was a maintainer taking
 * a fresh capture and shipping a release, which is the right answer for
 * everyone and no answer at all for the person blocked today.
 *
 * This is that person's path. It distils a capture they took themselves —
 * through their own Figma MCP, against the same kit — into `.pushpin/assets/`,
 * where the consumer scripts read it in preference to the plugin's copy. The
 * capture itself is not automatable from here and is not attempted: reading a
 * component's properties and geometry means executing inside the Figma editor,
 * which needs an agent driving `use_figma`. What is automated is everything
 * either side of that — where the result goes, what provenance it carries, and
 * when it stops being trusted.
 *
 * reference/refresh.md is the procedure; this is the mechanism.
 *
 * Usage:
 *   node scripts/refresh.mjs                          # what this project reads, and whether it is behind
 *   node scripts/refresh.mjs --components <capture.json>
 *   node scripts/refresh.mjs --specs <lane.json> [<lane.json>...]
 *   node scripts/refresh.mjs --clear                  # drop the overlay, back to the shipped catalog
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OVERLAYABLE,
  OVERLAY_MANIFEST,
  OVERLAY_REL,
  captureDate,
  findOverlay,
  projectRoot,
  supersededBy,
} from './lib/overlay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const PLUGIN = JSON.parse(readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valuesAfter = (f) => {
  const i = argv.indexOf(f);
  if (i === -1) return [];
  const out = [];
  for (let n = i + 1; n < argv.length && !argv[n].startsWith('--'); n++) out.push(argv[n]);
  return out;
};

/** The capture date a distilled file carries, whichever directory it is in. */
function dateOf(path) {
  try {
    return captureDate(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
}

/** The capture date the plugin's own copy of an asset carries. */
const shippedDate = (file) => dateOf(join(ASSETS, file));

const root = projectRoot();
if (!root) {
  console.error(
    'No pushpin.config.json above the working directory, so there is no project to refresh.\n\n' +
      'Run this from a project that has been set up. To set one up:\n' +
      `  node ${join(here, 'init.mjs')} . --write`,
  );
  process.exit(1);
}

const dir = join(root, OVERLAY_REL);
const rel = (p) => relative(root, p) || '.';

// ------------------------------------------------------------------- writing

/**
 * Records what is in the overlay after a write.
 *
 * Rewritten from what is on disk rather than appended to, so a file removed by
 * hand cannot stay declared, and `capturedAt` is the oldest date across the
 * declared files rather than the newest. A project that refreshed its specs in
 * September and its catalog in August is only as current as August, and taking
 * the newest would let one fresh file vouch for a stale one.
 */
function writeManifest(note) {
  const files = OVERLAYABLE.filter((f) => existsSync(join(dir, f))).sort();
  const dates = files.map((f) => dateOf(join(dir, f))).filter(Boolean);
  const body = {
    $comment:
      "This project's own re-capture of the Pushpin component catalogs, read in " +
      'preference to the plugin\'s copy. Written by scripts/refresh.mjs; see ' +
      'reference/refresh.md. Delete this file to go back to the shipped catalog.',
    capturedAt: dates.length ? dates.sort()[0] : null,
    pluginVersion: PLUGIN.version,
    files,
    ...(note ? { note } : {}),
  };
  writeFileSync(join(dir, OVERLAY_MANIFEST), JSON.stringify(body, null, 2) + '\n');
  return body;
}

/** Distil a capture straight into the overlay, and record it. */
function build(script, args, produced, note) {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, produced);
  try {
    execFileSync('node', [join(here, script), ...args, '--out', out], { stdio: 'inherit' });
  } catch {
    // The distiller has already said why on stderr, and every one of its
    // refusals is a bad capture rather than a bad invocation. Adding a second
    // sentence here would only bury it.
    process.exit(1);
  }
  const manifest = writeManifest(note);
  console.log(
    `\nWrote ${rel(out)} — this project now reads its own ${produced} ` +
      `(captured ${dateOf(out) ?? 'undated'}) instead of the plugin's ` +
      `(${shippedDate(produced) ?? 'undated'}).`,
  );
  console.log(
    `Overlay now carries ${manifest.files.length} of ${OVERLAYABLE.length} catalogs: ` +
      `${manifest.files.join(', ')}.`,
  );
  console.log(`\nCommit ${rel(dir)} to give everyone on the project the same catalog.`);
}

if (has('--clear')) {
  if (!existsSync(dir)) {
    console.log(`No overlay at ${rel(dir)} — this project already reads the plugin's catalog.`);
    process.exit(0);
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(
    `Removed ${rel(dir)}. This project is back on the catalog the plugin ships ` +
      `(captured ${shippedDate('components.figma.json') ?? 'undated'}).`,
  );
  process.exit(0);
}

if (has('--components')) {
  const [capture] = valuesAfter('--components');
  if (!capture) {
    console.error('usage: node scripts/refresh.mjs --components <capture.json>');
    process.exit(1);
  }
  if (!existsSync(capture)) {
    console.error(`${capture} does not exist.`);
    process.exit(1);
  }
  // The two capture shapes take different arguments, and asking the caller to
  // know which they took is asking them to have read a maintainer doc. A
  // properties capture is the common one here — it is the cheap read, and the
  // one that answers a component whose keys moved — and it carries a
  // `properties` map where the full capture carries `components`.
  let shape;
  try {
    shape = JSON.parse(readFileSync(capture, 'utf8'));
  } catch (e) {
    console.error(`${capture} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  const propertiesOnly = shape.properties && !shape.components;
  build(
    'build-components.mjs',
    propertiesOnly ? ['--properties-only', capture] : [capture],
    'components.figma.json',
    valuesAfter('--note')[0],
  );
  process.exit(0);
}

if (has('--specs')) {
  const lanes = valuesAfter('--specs');
  if (!lanes.length) {
    console.error('usage: node scripts/refresh.mjs --specs <lane.json> [<lane.json>...]');
    process.exit(1);
  }
  // Always a merge. A consumer re-captures the pages they are blocked on, never
  // all 45, and the plain form writes the whole asset from the lanes it was
  // given — which would leave this project holding specs for four components
  // and none for the other 109.
  build('build-specs.mjs', ['--merge', ...lanes], 'component-specs.figma.json', valuesAfter('--note')[0]);
  process.exit(0);
}

// -------------------------------------------------------------------- status

const overlay = findOverlay();

console.log(`Project   ${root}`);
console.log(`Plugin    ${PLUGIN.version} — ${here}`);
console.log('');

if (!overlay) {
  console.log('This project reads the catalogs the plugin ships:');
  for (const f of OVERLAYABLE) console.log(`  ${f.padEnd(28)} captured ${shippedDate(f) ?? 'undated'}`);
  console.log(
    '\nTo re-capture one for this project, take the reads in reference/refresh.md ' +
      'through your own Figma MCP, then feed the result back:\n' +
      '  node scripts/refresh.mjs --components <capture.json>\n' +
      '  node scripts/refresh.mjs --specs <lane.json> [<lane.json>...]',
  );
  process.exit(0);
}

if (overlay.broken) {
  console.log(
    `${rel(join(dir, OVERLAY_MANIFEST))} could not be parsed, so the overlay is being ignored ` +
      `and this project is reading the plugin's catalogs.\n\n` +
      `Re-run the refresh, or remove it:\n  node scripts/refresh.mjs --clear`,
  );
  process.exit(1);
}

console.log(`Overlay   ${rel(dir)} — captured ${overlay.capturedAt ?? 'undated'}, written by ${overlay.pluginVersion ?? 'an unknown version'}`);
if (overlay.note) console.log(`          ${overlay.note}`);
console.log('');

let stale = 0;
for (const f of OVERLAYABLE) {
  const own = overlay.files.includes(f);
  const shipped = shippedDate(f);
  if (!own) {
    console.log(`  ${'plugin'.padEnd(7)} ${f.padEnd(28)} captured ${shipped ?? 'undated'}`);
    continue;
  }
  const mine = dateOf(join(dir, f));
  const superseded = supersededBy({ capturedAt: mine }, shipped);
  if (superseded) stale++;
  console.log(
    `  ${(superseded ? 'STALE' : 'yours').padEnd(7)} ${f.padEnd(28)} captured ${mine ?? 'undated'}` +
      (superseded ? `  — the plugin now ships ${shipped}` : ''),
  );
}

// A declared file that is no longer on disk falls back to the plugin silently,
// which is the right behaviour and the wrong thing to leave unsaid.
const missing = overlay.declared.filter((f) => !overlay.files.includes(f));
if (missing.length) {
  console.log(`\n  ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} declared but not on disk, so ${missing.length === 1 ? 'it is' : 'they are'} being read from the plugin.`);
}

if (stale) {
  console.log(
    `\nThe plugin has shipped a newer capture than ${stale === 1 ? 'one of these' : `${stale} of these`}. ` +
      `Its capture is the shared one and has been through diff and verify, so prefer it:\n` +
      `  node scripts/refresh.mjs --clear`,
  );
  process.exit(1);
}

console.log('\nEvery overlaid catalog is at least as current as the plugin\'s.');

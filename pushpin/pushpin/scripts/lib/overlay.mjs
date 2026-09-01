/**
 * A project's own re-capture of the component catalogs, read in place of the
 * plugin's.
 *
 * The plugin ships one capture, taken by a maintainer, and it goes stale the
 * moment the kit republishes — Button lost four themes and reissued its property
 * keys between two capture dates, and every project on the shipped catalog kept
 * generating against options that no longer exist. Waiting for a plugin release
 * is the right answer for the shared case and the wrong one for the person who
 * is blocked today and has the Figma MCP open in front of them.
 *
 * So a project may hold its own capture under `.pushpin/assets/`, and the
 * consumer scripts read it first. Three properties make that safe to ship:
 *
 * - **It is scoped to the catalogs.** `OVERLAYABLE` is the whole list, and it is
 *   deliberately short. Tokens are excluded because `pushpin.css`, `DESIGN.md`
 *   and `design.json` are generated from them and hashed into the project pin —
 *   an overlaid token would be a value `lookup` reports and the stylesheet does
 *   not have. Copy is excluded because its source is a GitHub blob, not Figma.
 * - **It announces itself.** Nothing here is silent: `freshness` carries a layer
 *   for it and `lookup` prints a line above its answer. A catalog that disagrees
 *   with the plugin's and says nothing is the failure this whole file risks, so
 *   the reporting is not optional decoration.
 * - **It is provenanced and it expires.** `overlay.json` records what was
 *   captured, when, and against which plugin version. When the plugin ships a
 *   catalog newer than the overlay, the overlay is superseded and says so
 *   rather than quietly outranking a fresher shipped capture.
 *
 * The plugin's own tree never reads an overlay, the same rule `pin.mjs` applies
 * for the same reason: the plugin is not a consumer of itself, and a maintainer
 * running `build-design.mjs` must not pick up somebody's project capture.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(here, '..', '..', '..');

export const OVERLAY_REL = join('.pushpin', 'assets');
export const OVERLAY_MANIFEST = 'overlay.json';

/**
 * The assets a project may re-capture for itself.
 *
 * Every one is a Figma catalog that a generation run reads by key and can die
 * on. Nothing generated, nothing hashed into the pin, nothing sourced anywhere
 * but the three Figma files.
 */
export const OVERLAYABLE = [
  'components.figma.json',
  'component-specs.figma.json',
  'icons.figma.json',
  'annotations.figma.json',
];

const within = (root, p) => p === root || p.startsWith(root + sep);

/**
 * How current a distilled catalog is, from its own provenance.
 *
 * The latest of the dates it carries, not `extractedAt` alone. The component
 * catalog is captured in two halves that move independently — `extractedAt`
 * belongs to the 1074-entry dump and only moves when membership changes, while
 * `propertiesCapturedAt` moves on every republish — so a properties refresh
 * advances the file without advancing `extractedAt`. Reading the older of the
 * two would date a capture taken today as weeks old and report it as superseded
 * by the very catalog it was taken to replace.
 */
export function captureDate(doc) {
  const dates = [doc?.source?.extractedAt, doc?.source?.propertiesCapturedAt].filter(Boolean);
  return dates.length ? dates.sort().pop() : null;
}

/** The nearest ancestor holding `pushpin.config.json`, or null. */
export function projectRoot(from = process.cwd()) {
  let dir = resolve(from);
  // A plugin script invoked from inside the plugin's own checkout is a
  // maintainer running a build, never a consumer reading a catalog.
  if (within(PLUGIN_ROOT, dir)) return null;
  for (;;) {
    if (existsSync(join(dir, 'pushpin.config.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * The overlay in effect, or null.
 *
 * `PUSHPIN_OVERLAY_DIR` names one directly, which is what the tests use and what
 * lets a capture be reviewed before it is adopted. `PUSHPIN_NO_OVERLAY` turns
 * the whole mechanism off, so a confusing answer can always be re-asked against
 * the shipped catalog without deleting anything.
 */
export function findOverlay(from = process.cwd()) {
  if (process.env.PUSHPIN_NO_OVERLAY) return null;

  const forced = process.env.PUSHPIN_OVERLAY_DIR;
  const root = forced ? null : projectRoot(from);
  const dir = forced ? resolve(forced) : root && join(root, OVERLAY_REL);
  if (!dir || !existsSync(join(dir, OVERLAY_MANIFEST))) return null;

  let meta;
  try {
    meta = JSON.parse(readFileSync(join(dir, OVERLAY_MANIFEST), 'utf8'));
  } catch {
    // An unparseable manifest disables the overlay rather than failing the
    // command. The catalogs beside it may be fine, but nothing here can say
    // where they came from, and an unprovenanced catalog is the one thing this
    // file exists to prevent.
    return { dir, root, broken: true, files: [], capturedAt: null };
  }

  // Only files that are both declared and present. A declared file that was
  // deleted must fall back to the plugin rather than throw, and a stray file
  // nobody declared must not be picked up.
  const present = new Set(
    existsSync(dir) ? readdirSync(dir).filter((f) => OVERLAYABLE.includes(f)) : [],
  );
  const files = (Array.isArray(meta.files) ? meta.files : [])
    .filter((f) => present.has(f))
    .sort();

  return {
    dir,
    root,
    broken: false,
    files,
    capturedAt: meta.capturedAt ?? null,
    pluginVersion: meta.pluginVersion ?? null,
    note: meta.note ?? null,
    declared: Array.isArray(meta.files) ? meta.files : [],
  };
}

/**
 * Whether the plugin has since shipped a catalog newer than the overlay's.
 *
 * `shippedAt` is the capture date the plugin's own copy of that asset carries.
 * Equal dates are not superseded: a project that re-captured on the same day the
 * plugin did is holding the same kit state, and reporting that as stale would
 * cry wolf on the one day the overlay is most likely to be right.
 */
export function supersededBy(overlay, shippedAt) {
  if (!overlay?.capturedAt || !shippedAt) return false;
  return shippedAt > overlay.capturedAt;
}

/** The overlay's path for `file`, when it carries one. */
export function overlayPath(overlay, file) {
  if (!overlay || overlay.broken || !overlay.files.includes(file)) return null;
  return join(overlay.dir, file);
}

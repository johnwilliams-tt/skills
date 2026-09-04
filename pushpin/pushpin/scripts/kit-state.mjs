#!/usr/bin/env node
/**
 * Records what the scheduled Figma check found, so an offline session can read
 * it.
 *
 * The scheduled workflow is the only thing that asks Figma whether the shipped
 * catalog is still what the library serves, and its answer used to end in a
 * GitHub artifact nobody opens. Meanwhile a consuming project's session start
 * never calls Figma by design — no token, and no network beyond one cached
 * fetch of this repository — so it compares the project against the plugin and
 * reports `ok` while the plugin itself is weeks behind. Both halves are working
 * as intended and the person gets told nothing.
 *
 * This is the carrier between them. CI writes the verdict here, the file is
 * committed, and it travels to every install through the ordinary plugin update
 * — and, ahead of that update, through `lib/remote-state.mjs`, which reads the
 * committed copy off `main`. `freshness.mjs` then reads it with no token.
 *
 * Two properties keep it honest:
 *
 * - **It is not a capture and is not hashed.** `manifest.mjs` tracks the
 *   captures by an explicit list and this file is deliberately absent from it,
 *   so a CI verdict landing cannot move a hash that `init` wrote into somebody's
 *   `pushpin.config.json` and report every project as behind.
 * - **It expires against the captures it describes.** `against` records the
 *   capture dates the verdict was formed about. A maintainer refresh moves those
 *   dates, and the verdict stops applying the moment they move — otherwise the
 *   refresh that fixed the problem would keep reporting it until the next
 *   scheduled run.
 *
 * `moved` carries what the check found by name, key and page, per layer, so the
 * release pipeline can take the changed components forward as the argument to a
 * scoped re-capture rather than rediscovering them. `pluginVersion` records
 * which release the verdict was formed on.
 *
 * Usage:
 *   node scripts/kit-state.mjs --from <freshness.json>   # write it
 *   node scripts/kit-state.mjs --show                    # print what is recorded
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
export const STATE_FILE = join(ASSETS, 'kit-state.json');

const load = (f) => JSON.parse(readFileSync(join(ASSETS, f), 'utf8'));

/** The layers `moved` is keyed by: the ones whose re-capture is per named entry. */
export const MOVED_LAYERS = ['components', 'icons', 'annotations'];

/**
 * The capture dates a verdict is about.
 *
 * Any one of them moving is a re-capture the recorded verdict predates. Shared
 * with `freshness.mjs`, so the two cannot disagree about what "still applies"
 * means.
 *
 * `properties` and `specs` are here because the two halves of the component
 * capture move independently and the cheap half moves far more often. A
 * properties-only refresh leaves `extractedAt` alone — that date belongs to the
 * 1074-entry dump, which only matters when a component is added, removed or
 * renamed — so keying expiry on it alone would let a verdict outlive the very
 * refresh that answered it. That is not hypothetical: the refresh that caught up
 * to the republished Button moved `propertiesCapturedAt` and nothing else.
 */
export function captureDates() {
  const manifest = load('manifest.json');
  const catalog = load('components.figma.json');
  const specs = load('component-specs.figma.json');
  return {
    tokens: manifest.capturedAt ?? null,
    components: catalog.source?.extractedAt ?? null,
    properties: catalog.source?.propertiesCapturedAt ?? null,
    specs: specs.source?.extractedAt ?? null,
    annotations: manifest.annotationKit?.capturedAt ?? null,
    icons: manifest.iconLibrary?.capturedAt ?? null,
  };
}

/**
 * The recorded verdict, or null when there is none or it no longer applies.
 *
 * `candidate` is a verdict from somewhere other than the shipped file — the
 * repository's current copy, fetched by `lib/remote-state.mjs` — held to the
 * same expiry. A verdict formed against captures this install does not carry
 * describes some other release's catalog, and is null here for the same reason
 * a stale shipped one is.
 */
export function readKitState(candidate) {
  let state = candidate;
  if (state === undefined) {
    if (!existsSync(STATE_FILE)) return null;
    try {
      state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    } catch {
      return null;
    }
  }
  if (!state || typeof state !== 'object' || !state.verdict) return null;
  const now = captureDates();
  const against = state.against ?? {};
  // Any date moving retires the verdict. Not just the components date: a token
  // re-capture is a refresh too, and a verdict that survived one would be
  // describing a kit state somebody has already gone and fixed.
  const applies = Object.keys(now).every((k) => now[k] === against[k]);
  return applies ? state : null;
}

/**
 * `moved` as freshness reported it, reduced to the shape that is persisted: the
 * three layers, each with `unpublished` and `changed`, every entry carrying
 * `name`, `key` and `page`, and `changed` entries `updatedAt` as well.
 *
 * Normalised rather than copied so the file has one shape whatever the report
 * held — a report from a run that could not reach a layer has an empty list
 * there, not a missing key.
 */
function movedFrom(report) {
  const entry = ({ name, key, page }) => ({ name, key, page: page ?? null });
  const moved = {};
  for (const name of MOVED_LAYERS) {
    const m = report.moved?.[name] ?? {};
    moved[name] = {
      unpublished: (m.unpublished ?? []).map(entry),
      changed: (m.changed ?? []).map((c) => ({ ...entry(c), updatedAt: c.updatedAt ?? null })),
    };
  }
  return moved;
}

/**
 * The file as it is compared, with the two fields that move without anything
 * having changed set aside.
 *
 * `observedAt` is the date of the run. `changed[].updatedAt` is the date the kit
 * last edited a component that is already listed: a designer re-saving a Button
 * the verdict has flagged since Tuesday moves the date and nothing else, and a
 * file that changed on that would commit every hour the kit was touched, which is
 * the churn the comparison exists to prevent. Names, keys and pages stay in,
 * because a new name in the list is a new finding.
 */
function comparable(state) {
  const moved = {};
  for (const [name, m] of Object.entries(state.moved ?? {})) {
    moved[name] = {
      unpublished: m.unpublished ?? [],
      changed: (m.changed ?? []).map(({ updatedAt, ...rest }) => rest),
    };
  }
  return JSON.stringify({ ...state, observedAt: null, moved });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--show')) {
    const state = readKitState();
    if (!state) {
      console.log(
        existsSync(STATE_FILE)
          ? 'A verdict is recorded but the captures have moved since, so it no longer applies.'
          : 'No verdict recorded yet.',
      );
      process.exit(0);
    }
    console.log(JSON.stringify(state, null, 2));
    process.exit(0);
  }

  const i = argv.indexOf('--from');
  if (i === -1 || !argv[i + 1]) {
    console.error('usage: node scripts/kit-state.mjs --from <freshness.json>');
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(argv[i + 1], 'utf8'));
  const excused = new Set(report.excused ?? []);
  // A report from a run that could not ask Figma carries the previous verdict
  // as a `kit state` layer of its own. Recording that would be a verdict about
  // a verdict, so it is never one of the layers written here.
  const failed = (report.layers ?? []).filter(
    (l) =>
      l.status !== 'pass' && l.status !== 'skipped' && !excused.has(l.name) && l.name !== 'kit state',
  );

  const plugin = JSON.parse(
    readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  const body = {
    $comment:
      'What the scheduled Figma check last found about the captures in this directory. ' +
      'Written by scripts/kit-state.mjs from a freshness --json report, read by ' +
      'scripts/freshness.mjs when no token is available. Not a capture: deliberately ' +
      'absent from manifest.json, because a verdict changing must not report every ' +
      'project as holding an older build.',
    verdict: failed.length ? 'moved' : 'current',
    pluginVersion: plugin.version ?? null,
    against: captureDates(),
    layers: failed.map((l) => l.name),
    moved: movedFrom(report),
    findings: report.findings ?? [],
    brief: report.brief ?? [],
  };

  // `observedAt` and the per-component edit dates are carried outside the
  // comparison, so a run that finds the same thing as yesterday leaves the file
  // byte-identical and produces no commit. An hourly commit whose only change is
  // a date is churn that trains people to stop reading the history. When the
  // file does change, the edit dates written are the current ones.
  let previous = null;
  try {
    previous = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null;
  } catch {
    previous = null;
  }
  const same = previous && comparable(previous) === comparable(body);

  if (same) {
    console.log(`kit-state.json is unchanged — still "${body.verdict}", first seen ${previous.observedAt}.`);
    process.exit(0);
  }

  const serialised =
    JSON.stringify({ ...body, observedAt: new Date().toISOString().slice(0, 10) }, null, 2) + '\n';
  writeFileSync(STATE_FILE, serialised);
  console.log(
    `Wrote kit-state.json — "${body.verdict}"` +
      (failed.length ? `, ${failed.length} layer(s): ${body.layers.join(', ')}` : '') +
      '.',
  );
}

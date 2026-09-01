#!/usr/bin/env node
/**
 * Records what the scheduled Figma check found, so an offline session can read
 * it.
 *
 * The daily workflow is the only thing that asks Figma whether the shipped
 * catalog is still what the library serves, and its answer used to end in a
 * GitHub artifact nobody opens. Meanwhile a consuming project's session start is
 * `--offline --session` by design — no token, no network — so it compares the
 * project against the plugin and reports `ok` while the plugin itself is weeks
 * behind. Both halves are working as intended and the person gets told nothing.
 *
 * This is the carrier between them. CI writes the verdict here, the file is
 * committed, and it travels to every install through the ordinary plugin update.
 * `freshness.mjs` then reads it with no token and no network at all.
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

/** The recorded verdict, or null when there is none or it no longer applies. */
export function readKitState() {
  if (!existsSync(STATE_FILE)) return null;
  let state;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
  const now = captureDates();
  const against = state.against ?? {};
  // Any date moving retires the verdict. Not just the components date: a token
  // re-capture is a refresh too, and a verdict that survived one would be
  // describing a kit state somebody has already gone and fixed.
  const applies = Object.keys(now).every((k) => now[k] === against[k]);
  return applies ? state : null;
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
  const failed = (report.layers ?? []).filter(
    (l) => l.status !== 'pass' && l.status !== 'skipped' && !excused.has(l.name),
  );

  const body = {
    $comment:
      'What the scheduled Figma check last found about the captures in this directory. ' +
      'Written by scripts/kit-state.mjs from a freshness --json report, read by ' +
      'scripts/freshness.mjs when no token is available. Not a capture: deliberately ' +
      'absent from manifest.json, because a verdict changing must not report every ' +
      'project as holding an older build.',
    verdict: failed.length ? 'moved' : 'current',
    against: captureDates(),
    layers: failed.map((l) => l.name),
    findings: report.findings ?? [],
    brief: report.brief ?? [],
  };

  // `observedAt` is carried outside the comparison below, so a run that finds
  // the same thing as yesterday leaves the file byte-identical and produces no
  // commit. A daily commit whose only change is a date is churn that trains
  // people to stop reading the history.
  const previous = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null;
  const same =
    previous &&
    JSON.stringify({ ...previous, observedAt: null }) === JSON.stringify({ ...body, observedAt: null });

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

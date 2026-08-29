#!/usr/bin/env node
/**
 * Generates assets/copy.json from the verbatim capture and the hand-authored
 * component join.
 *
 * The same contract build-css.mjs holds for the stylesheet: the transform is
 * deterministic, `--check` fails when the committed JSON does not match a fresh
 * parse, and nothing downstream reads the upstream format. Every consumer —
 * lib/copy.mjs, check.mjs, lookup.mjs, the Figma audit — reads copy.json, so a
 * source swap is a descriptor edit and one adapter and stops there.
 *
 * Two things this refuses to do. It will not run against a capture that is not
 * the blob its descriptor names: the git blob sha is recomputed from the bytes
 * on disk, so a hand-edit of copy.source.md is a build failure rather than a
 * quiet rewriting of the rules. And it will not emit a join it cannot stand
 * behind: every component row in the upstream table has to appear in
 * copy-map.json, every mapped name has to exist in the component catalog, and a
 * row with no counterpart has to say so in a note.
 *
 * Usage: node scripts/build-copy.mjs [--check]
 *   --check  exit non-zero if the committed JSON differs from a fresh parse
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from './lib/copy-sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const OUT = join(ASSETS, 'copy.json');

const read = (f) => readFileSync(join(ASSETS, f), 'utf8');
const json = (f) => JSON.parse(read(f));

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// ------------------------------------------------------------- the capture

const capture = readFileSync(join(ASSETS, 'copy.source.md'));
const source = json('copy.source.json');

/** Git's own object hash, so the descriptor's sha can be checked offline. */
const blobSha = createHash('sha1')
  .update(`blob ${capture.length}\0`)
  .update(capture)
  .digest('hex');

if (blobSha !== source.sha) {
  fail(
    `copy.source.md is not the blob copy.source.json names.\n` +
      `  descriptor  ${source.sha}\n` +
      `  on disk     ${blobSha}\n\n` +
      'The capture is verbatim by definition. Re-run: node scripts/pull-copy.mjs',
  );
}

let parsed;
try {
  parsed = parse(capture.toString('utf8'), source);
} catch (e) {
  fail(`Cannot read the capture as "${source.kind}": ${e.message}`);
}

// ---------------------------------------------------------------- the join

const { map } = json('copy-map.json');
const catalog = json('components.figma.json').components;

const rows = Object.keys(parsed.limits);
const missing = rows.filter((r) => !(r in map));
const stale = Object.keys(map).filter((r) => !rows.includes(r));

if (missing.length || stale.length) {
  fail(
    'copy-map.json does not line up with the component table in the capture.\n' +
      (missing.length ? `  no entry for: ${missing.join(', ')}\n` : '') +
      (stale.length ? `  no such row:  ${stale.join(', ')}\n` : '') +
      '\nEvery row needs an entry. A row with no real counterpart takes an empty\n' +
      'list and a note saying why.',
  );
}

const limits = {};
const components = {};
const unknown = [];
const unexplained = [];

for (const row of rows) {
  const { pushpin = [], note = null } = map[row];
  if (!pushpin.length && !note) unexplained.push(row);
  for (const name of pushpin) {
    if (!(name in catalog)) unknown.push(`${row} → ${name}`);
    (components[name] ??= []).push(row);
  }
  limits[row] = { ...parsed.limits[row], pushpin, note };
}

if (unknown.length) {
  fail(
    'copy-map.json names components that are not in the catalog:\n' +
      unknown.map((u) => `  ${u}`).join('\n') +
      '\n\nNames are case-sensitive. Find the real one with:\n' +
      '  node scripts/lookup.mjs --list --component <fragment>',
  );
}
if (unexplained.length) {
  fail(
    `Unmapped with no reason given: ${unexplained.join(', ')}.\n` +
      'A gap is fine and a silent one is not — say in `note` why nothing matches.',
  );
}

// ------------------------------------------------------------------- emit

const copy = {
  $comment:
    'Thumbtack content design rules, parsed from assets/copy.source.md and joined to the ' +
    'component catalog through assets/copy-map.json. GENERATED FILE. Do not edit by hand; ' +
    'rebuild with node scripts/build-copy.mjs. The upstream is a review skill that answers ' +
    'with a rewrite block wrapped in delimiters; that response format is not carried here. ' +
    'The severity codes and the score ladder under it are, and they are what ' +
    'scripts/lib/copy.mjs acts on.',
  source: {
    kind: source.kind,
    repo: source.repo,
    path: source.path,
    ref: source.ref,
    sha: source.sha,
    extractedAt: source.extractedAt,
    url: source.url,
  },
  codes: parsed.codes,
  score: parsed.score,
  forbidden: parsed.forbidden,
  bannedPhrases: parsed.bannedPhrases,
  genericCtas: parsed.genericCtas,
  genericLinks: parsed.genericLinks,
  passive: parsed.passive,
  terms: parsed.terms,
  brandTitleCase: parsed.brandTitleCase,
  transforms: parsed.transforms,
  guidance: parsed.guidance,
  examples: parsed.examples,
  limits,
  components,
  style: parsed.style,
  tone: parsed.tone,
  email: parsed.email,
  valueProps: parsed.valueProps,
  states: parsed.states,
  legalTriggers: parsed.legalTriggers,
  reviewOrder: parsed.reviewOrder,
  rules: parsed.rules,
};

const serialised = JSON.stringify(copy, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let committed;
  try {
    committed = read('copy.json');
  } catch {
    fail('copy.json is missing. Run: node scripts/build-copy.mjs');
  }
  if (committed !== serialised) {
    fail('copy.json is stale — run: node scripts/build-copy.mjs');
  }
  console.log('copy.json is up to date.');
} else {
  writeFileSync(OUT, serialised);
  const mapped = Object.keys(components).length;
  console.log(
    `Wrote ${OUT} — ${Object.keys(copy.codes).length} severity codes, ` +
      `${copy.forbidden.length} forbidden words, ${copy.bannedPhrases.length} banned phrases, ` +
      `${copy.terms.length} preferred terms, ${rows.length} component limits ` +
      `covering ${mapped} catalog component(s).`,
  );
}

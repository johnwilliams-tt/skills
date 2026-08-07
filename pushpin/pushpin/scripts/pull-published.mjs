#!/usr/bin/env node
/**
 * Fetches the kit's published variables over REST and writes the same
 * `published.json` that scripts/check.md produces by hand.
 *
 * Optional, and not a replacement for the plugin path. What it buys is
 * certainty: the REST endpoint returns what is *published*, so there is no
 * ambiguity about whether a capture picked up someone's unpublished edits. It
 * also carries `updatedAt` per collection, which answers "has the kit shipped
 * anything since our capture" in one call.
 *
 * Enterprise only — the endpoint requires the file_variables:read scope, which
 * Figma grants to full members of Enterprise orgs and nobody else. A 403 here
 * is a plan or scope problem, not a bug; fall back to scripts/check.md.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_... node scripts/pull-published.mjs [--out published.json]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const manifest = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));

const argv = process.argv.slice(2);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'published.json';

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error(
    'FIGMA_TOKEN is not set.\n\n' +
      'Create a personal access token at figma.com > Settings > Security, with the\n' +
      'file_variables:read scope, then:\n\n' +
      '  FIGMA_TOKEN=figd_... node scripts/pull-published.mjs',
  );
  process.exit(1);
}

const fileKey = manifest.figma.fileKey;
const url = `https://api.figma.com/v1/files/${fileKey}/variables/published`;

const res = await fetch(url, { headers: { 'X-Figma-Token': token } });

if (res.status === 403) {
  const body = await res.text();
  console.error(
    `403 from Figma. The variables API is Enterprise-only and needs the\n` +
      `file_variables:read scope.\n\n${body}\n\n` +
      `Use the plugin capture in scripts/check.md instead — it reads variables\n` +
      `regardless of plan, because it runs inside the editor rather than over REST.`,
  );
  process.exit(1);
}
if (!res.ok) {
  console.error(`${res.status} from Figma: ${await res.text()}`);
  process.exit(1);
}

const { meta } = await res.json();
const collections = meta.variableCollections ?? {};
const variables = meta.variables ?? {};

const published = {};
let total = 0;
for (const v of Object.values(variables)) {
  const collection = collections[v.variableCollectionId];
  if (!collection) continue;
  (published[collection.name] = published[collection.name] || {})[v.name] = v.key;
  total++;
}

const updated = Object.values(collections)
  .filter((c) => c.updatedAt)
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

writeFileSync(
  out,
  JSON.stringify(
    {
      $comment: `Published variables from ${manifest.figma.fileName}, via the REST API.`,
      capturedAt: new Date().toISOString().slice(0, 10),
      source: 'rest',
      total,
      lastPublished: updated[0]?.updatedAt ?? null,
      published,
    },
    null,
    2,
  ) + '\n',
);

console.log(
  `Wrote ${out} — ${total} published variables across ${Object.keys(published).length} collections.`,
);

if (updated.length) {
  const newest = updated[0];
  console.log(`Most recent publish: ${newest.name} at ${newest.updatedAt}`);
  const capture = manifest.capturedAt;
  if (newest.updatedAt.slice(0, 10) > capture) {
    console.log(
      `\nThe kit has published since the committed capture (${capture}).\n` +
        `Collections touched since then:`,
    );
    for (const c of updated.filter((c) => c.updatedAt.slice(0, 10) > capture)) {
      console.log(`  ${c.name} — ${c.updatedAt}`);
    }
    console.log(`\nRun the kit capture from scripts/check.md, then diff.`);
  } else {
    console.log(`Nothing published since the committed capture (${capture}).`);
  }
}

console.log(`\nNext: node scripts/diff.mjs --published ${out}`);

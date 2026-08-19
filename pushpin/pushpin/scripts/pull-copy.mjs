#!/usr/bin/env node
/**
 * Captures the content design rules from the upstream named in
 * lib/copy-sources.mjs, verbatim.
 *
 * Same discipline as the token chain in reference/provenance.md: the bytes
 * GitHub returned are what gets committed, including anything that looks like
 * a mistake, so a real mistake upstream shows up here as a real mistake rather
 * than as an untraceable difference. Nothing in this script interprets the
 * file — that is build-copy.mjs's job, one step later.
 *
 * The capture cannot carry its own provenance without ceasing to be verbatim,
 * so it lands as two files: copy.source.md is the bytes, copy.source.json is
 * the descriptor that says which blob they are. build-copy.mjs recomputes the
 * blob sha from the bytes and refuses to run if the two disagree, which is what
 * makes a hand-edit of the capture a build failure rather than a silent
 * rewriting of the rules.
 *
 * Usage:
 *   node scripts/pull-copy.mjs
 *   node scripts/pull-copy.mjs --check
 *
 * --check asks whether upstream has moved since the committed capture and
 * exits 1 if it has, writing nothing. GITHUB_TOKEN is optional and only raises
 * the rate limit; the repo is public.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCE } from './lib/copy-sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const CAPTURE = join(ASSETS, 'copy.source.md');
const DESCRIPTOR = join(ASSETS, 'copy.source.json');

const check = process.argv.includes('--check');

const api = `https://api.github.com/repos/${SOURCE.repo}/contents/${SOURCE.path}?ref=${SOURCE.ref}`;
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'pushpin-pull-copy',
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(api, { headers });
if (!res.ok) {
  console.error(
    `${res.status} from GitHub for ${SOURCE.repo}/${SOURCE.path}: ${await res.text()}\n\n` +
      'A 403 with no token is the unauthenticated rate limit — set GITHUB_TOKEN and retry.\n' +
      'A 404 means the descriptor in scripts/lib/copy-sources.mjs no longer names a real file.',
  );
  process.exit(1);
}

const meta = await res.json();
const body = Buffer.from(meta.content, meta.encoding === 'base64' ? 'base64' : 'utf8');

if (check) {
  let committed;
  try {
    committed = JSON.parse(readFileSync(DESCRIPTOR, 'utf8'));
  } catch {
    console.error('No committed capture. Run: node scripts/pull-copy.mjs');
    process.exit(1);
  }
  if (committed.sha === meta.sha) {
    console.log(`Up to date with ${SOURCE.repo}@${SOURCE.ref} (${meta.sha.slice(0, 12)}).`);
    process.exit(0);
  }
  console.error(
    `${SOURCE.path} has moved upstream.\n` +
      `  committed  ${committed.sha}  captured ${committed.extractedAt}\n` +
      `  upstream   ${meta.sha}\n\n` +
      'Run: node scripts/pull-copy.mjs && node scripts/build-copy.mjs',
  );
  process.exit(1);
}

writeFileSync(CAPTURE, body);
writeFileSync(
  DESCRIPTOR,
  JSON.stringify(
    {
      $comment:
        'Which blob assets/copy.source.md is. Written by scripts/pull-copy.mjs; ' +
        'verified against the capture by scripts/build-copy.mjs.',
      kind: SOURCE.kind,
      repo: SOURCE.repo,
      path: SOURCE.path,
      ref: SOURCE.ref,
      sha: meta.sha,
      extractedAt: new Date().toISOString().slice(0, 10),
      url: `https://github.com/${SOURCE.repo}/blob/${SOURCE.ref}/${SOURCE.path}`,
    },
    null,
    2,
  ) + '\n',
);

console.log(
  `Wrote copy.source.md (${body.length} bytes, blob ${meta.sha.slice(0, 12)}) ` +
    `from ${SOURCE.repo}@${SOURCE.ref}.`,
);
console.log('Next: node scripts/build-copy.mjs');

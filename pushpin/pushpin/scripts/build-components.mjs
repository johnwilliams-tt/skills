#!/usr/bin/env node
/**
 * Distills the raw `list_file_components_for_code_connect` dump into
 * assets/components.figma.json — the catalog used to place real library
 * instances instead of lookalike frames.
 *
 * The raw dump is ~554KB / 1071 entries, of which ~951 are internal parts
 * (names prefixed `_` or `.`) that exist to build the public components and
 * should never be placed directly. Only the public surface is kept.
 *
 * Usage: node scripts/build-components.mjs <path-to-raw-dump.json>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets', 'components.figma.json');

export const isInternal = (n) => n.startsWith('_') || n.startsWith('.');

/**
 * Keep only what is needed to place and configure an instance.
 *
 * `key` is retained deliberately. setProperties() takes bare names for VARIANT
 * properties but the suffixed key for everything else — `Label#13326:0`, not
 * `Label` — and passing the bare name throws.
 */
function slimProperty(p) {
  const out = { type: p.type, key: p.key };
  if (p.variantOptions) out.options = p.variantOptions;
  if (p.defaultValue !== undefined && p.type !== 'INSTANCE_SWAP') {
    out.default = p.defaultValue;
  }
  return out;
}

/**
 * Reduce a raw dump to the public catalog. Exported so diff.mjs can distill a
 * fresh dump the same way and compare like with like.
 */
export function distillComponents(all) {
  const components = {};
  for (const c of all) {
    if (isInternal(c.name)) continue;
    const props = {};
    for (const [name, p] of Object.entries(c.properties ?? {})) {
      props[name] = slimProperty(p);
    }
    components[c.name] = {
      key: c.assetKey,
      type: c.type,
      page: c.pageName,
      nodeId: c.nodeId,
      instanceCount: c.instanceCount,
      ...(Object.keys(props).length ? { properties: props } : {}),
      ...(c.childInstanceTags?.length ? { children: c.childInstanceTags } : {}),
    };
  }
  return Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // Imported for distillComponents; skip the CLI below.
} else {
  main();
}

function main() {
const rawPath = process.argv[2];
if (!rawPath) {
  console.error('usage: node scripts/build-components.mjs <path-to-raw-dump.json>');
  process.exit(1);
}

const all = JSON.parse(readFileSync(rawPath, 'utf8'));
const sorted = distillComponents(all);

const doc = {
  $comment:
    'Published components of the Pushpin Thumbprint UI Kit. `key` is the assetKey to pass to figma.importComponentByKeyAsync. Generated — see scripts/build-components.mjs.',
  source: {
    fileKey: 'VVRGrLgkPRU3vs765d5Q3r',
    fileName: 'Pushpin Thumbprint UI Kit',
    extractedAt: new Date().toISOString().slice(0, 10),
    publishedTotal: all.length,
    internalOmitted: all.filter((c) => isInternal(c.name)).length,
    publicKept: Object.keys(sorted).length,
  },
  components: sorted,
};

writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — ${doc.source.publicKept} public components ` +
    `(${doc.source.internalOmitted} internal omitted of ${doc.source.publishedTotal}).`,
);
}

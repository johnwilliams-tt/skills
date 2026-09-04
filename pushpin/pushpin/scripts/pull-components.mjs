#!/usr/bin/env node
/**
 * Captures the component catalog's input over REST, in the shape
 * scripts/build-components.mjs distils — `{ components, publishStatus,
 * publishedNames, publishedProperties }`, see scripts/extract.md § 5 — so CI
 * can re-capture without the Figma desktop app.
 *
 * Three reads stand in for the three the plugin capture takes:
 *
 *   membership   `/files/:key/components` and `/component_sets`. Both list only
 *                what the library publishes, which is the question
 *                `getPublishStatusAsync()` existed to answer, so every entry
 *                here is `CURRENT`. `/components` enumerates variants under
 *                their own keys; those are dropped in favour of their set.
 *   names        the same listings carry the name the library serves, which is
 *                `publishedNames`; the node carries the name the file holds,
 *                which is what the catalog keys on. Where they differ the
 *                distiller writes `publishedAs`, exactly as before.
 *   properties   `/files/:key/nodes?ids=` for `componentPropertyDefinitions`
 *                on every set and set-less component, batched under the URL cap.
 *                The 900 published icons pass the membership gate like anything
 *                else and the distiller routes them to `iconsOmitted` by name,
 *                so their nodes are not fetched.
 *
 * What REST cannot see, and how the output says so:
 *
 * - Properties are **editor state**. The plugin path imports each key into a
 *   consuming file and reads the definition the library serves; REST reads the
 *   kit file, unpublished edits included. The capture carries
 *   `provenance.properties: "rest-editor-state"` and the distiller writes it
 *   into `source.properties`, so a catalog built this way is labelled as one
 *   whose property ids may run ahead of what a consumer can set. Minutes after
 *   a publish, which is when CI runs, the two readings agree.
 * - Unpublished components are invisible. `capturedTotal` becomes the
 *   published count, `unpublishedOmitted` is 0, and `nameStatusDisagreement`
 *   can only report the "reads as internal and is published" direction.
 * - `instanceCount` and `children` come from the Code Connect dump and have no
 *   REST equivalent. They are carried from the committed catalog by key, and
 *   `provenance.carried` names them; a component new to the kit has neither.
 * - An INSTANCE_SWAP default is a node id. The plugin dump resolves it to a
 *   name because the dump lists unpublished parts too; here the targets are
 *   fetched by id and appended to `components` as `UNPUBLISHED`, which gives
 *   the distiller the same thing to resolve against.
 * - REST's ComponentPropertyType enumerates BOOLEAN, INSTANCE_SWAP, TEXT and
 *   VARIANT. Whatever it returns is passed through, so a SLOT property survives
 *   if the API carries it and is absent if the API drops it; the committed
 *   catalog holds three.
 *
 * Which of two same-named entries the catalog keeps depends on capture order,
 * and REST does not promise one. Candidates are sorted, and within a name the
 * node the committed catalog already names is placed last so that it wins, as
 * the distiller keeps the last one it sees. A re-capture therefore never flips
 * a collision unless the kept twin has gone.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_... node scripts/pull-components.mjs [--out components.json]
 *   FIGMA_TOKEN=figd_... node scripts/pull-components.mjs --check
 *
 * Then: node scripts/build-components.mjs components.json
 *
 * --check distils the capture in memory, compares every entry with the
 * committed catalog, writes nothing, and exits 1 if anything moved.
 */

import { distillComponents } from './build-components.mjs';
import { explain, getNodes, publishedOwners, requireToken } from './lib/figma-rest.mjs';
import {
  compareEntries,
  flag,
  loadCommitted,
  manifest,
  option,
  reportCheck,
  today,
  writeJson,
} from './lib/pull.mjs';

const argv = process.argv.slice(2);
const out = option(argv, '--out', 'components.json');
const check = flag(argv, '--check');
requireToken('pull-components.mjs');

const fileKey = manifest.figma.fileKey;
const committed = loadCommitted('components.figma.json');
const committedByKey = new Map(
  Object.entries(committed.components).map(([name, e]) => [e.key, { name, ...e }]),
);
const committedNode = new Map(
  Object.entries(committed.components).map(([name, e]) => [name, e.nodeId]),
);

/** A node id as the plugin API and REST both write it. */
const isNodeId = (v) => typeof v === 'string' && /^(I?\d+:\d+)(;\d+:\d+)*$/.test(v);

/**
 * `componentPropertyDefinitions` as the Code Connect dump lists them — keyed by
 * display name, with the full `#id` key beside — so the distiller's dump-side
 * reading works unchanged. The same definitions go out verbatim as
 * `publishedProperties`, where the distiller reads ids, options and defaults.
 */
function dumpProperties(defs) {
  const out = {};
  for (const [full, d] of Object.entries(defs ?? {})) {
    const display = d.type === 'VARIANT' || !full.includes('#') ? full : full.slice(0, full.indexOf('#'));
    out[display] = {
      type: d.type,
      key: full,
      ...(d.variantOptions ? { variantOptions: d.variantOptions } : {}),
      ...(d.defaultValue !== undefined ? { defaultValue: d.defaultValue } : {}),
      ...(d.preferredValues?.length ? { preferredValues: d.preferredValues } : {}),
    };
  }
  return out;
}

/**
 * `_Arrow-Left Icon · Medium` → true. The distiller routes every published
 * owner named this way to icons.figma.json without reading its properties, so
 * fetching 900 icon nodes to learn they define none is eight round trips for
 * nothing; the listing's name is what the distiller reads.
 */
const isIcon = (name) => /Icon · (Tiny|Small|Medium|Large)$/.test(name ?? '');

async function capture() {
  const { owners } = await publishedOwners(fileKey);

  const { nodes } = await getNodes(
    fileKey,
    owners.filter((o) => !isIcon(o.name)).map((o) => o.nodeId),
    { depth: 1 },
  );

  const components = [];
  const publishStatus = {};
  const publishedNames = {};
  const publishedProperties = {};
  const gone = [];
  const swapTargets = new Set();

  for (const o of owners) {
    const doc = nodes[o.nodeId]?.document;
    if (!doc && !isIcon(o.name)) gone.push(`${o.name} (${o.nodeId})`);
    const defs = doc?.componentPropertyDefinitions ?? {};
    for (const d of Object.values(defs)) {
      if (d.type === 'INSTANCE_SWAP' && isNodeId(d.defaultValue)) swapTargets.add(d.defaultValue);
    }
    const carried = committedByKey.get(o.key);
    components.push({
      name: doc?.name ?? o.name,
      assetKey: o.key,
      nodeId: o.nodeId,
      type: doc?.type ?? o.type,
      pageName: o.pageName,
      pageId: o.pageId,
      ...(carried?.instanceCount !== undefined ? { instanceCount: carried.instanceCount } : {}),
      ...(carried?.children ? { childInstanceTags: carried.children } : {}),
      properties: dumpProperties(defs),
    });
    publishStatus[o.nodeId] = 'CURRENT';
    publishedNames[o.key] = o.name;
    publishedProperties[o.key] = defs;
  }

  // The parts a swap slot defaults to, fetched by id so the distiller can name
  // them. Anything not in the published listing is unpublished by definition.
  const known = new Set(owners.map((o) => o.nodeId));
  const targets = [...swapTargets].filter((id) => !known.has(id));
  let unresolvedTargets = 0;
  if (targets.length) {
    const { nodes: parts } = await getNodes(fileKey, targets, { depth: 1 });
    for (const id of targets) {
      const doc = parts[id]?.document;
      if (!doc) {
        unresolvedTargets++;
        continue;
      }
      components.push({ name: doc.name, assetKey: null, nodeId: id, type: doc.type });
      publishStatus[id] = 'UNPUBLISHED';
    }
  }

  // Sorted for a stable file, with the committed winner of each name last.
  const keeps = (c) => (committedNode.get(c.name) === c.nodeId ? 1 : 0);
  components.sort(
    (a, b) => a.name.localeCompare(b.name) || keeps(a) - keeps(b) || a.nodeId.localeCompare(b.nodeId),
  );

  return {
    $comment:
      `Component capture of ${manifest.figma.fileName} over the Figma REST API. Membership is ` +
      'the published listing, so every owner is CURRENT; properties are the file\u2019s editor ' +
      'state. Written by scripts/pull-components.mjs; distil with scripts/build-components.mjs.',
    capturedAt: today(),
    fileKey,
    provenance: {
      properties: 'rest-editor-state',
      carried: ['instanceCount', 'children'],
    },
    components,
    publishStatus,
    publishedNames,
    publishedProperties,
    notes: { gone, swapTargets: targets.length, unresolvedSwapTargets: unresolvedTargets },
  };
}

let cap;
try {
  cap = await capture();
} catch (e) {
  console.error(explain(e, fileKey));
  process.exit(1);
}

const published = Object.values(cap.publishStatus).filter((s) => s === 'CURRENT').length;

if (check) {
  const fresh = distillComponents(cap).components;
  const cmp = compareEntries(committed.components, fresh, ['instanceCount', 'children']);
  reportCheck(
    `components (${published} published)`,
    cmp,
    `Run: node scripts/pull-components.mjs && node scripts/build-components.mjs ${out}`,
  );
}

writeJson(out, cap);
console.log(
  `Wrote ${out} — ${published} published owners, ${cap.components.length - published} swap ` +
    `targets appended as unpublished, properties for ${Object.keys(cap.publishedProperties).length} keys.`,
);
for (const g of cap.notes.gone.slice(0, 10)) {
  console.log(`  warning  published but no longer in the file: ${g}`);
}
if (cap.notes.gone.length > 10) console.log(`  … and ${cap.notes.gone.length - 10} more`);
if (cap.notes.unresolvedSwapTargets) {
  console.log(
    `  ${cap.notes.unresolvedSwapTargets} swap default(s) point outside the file and stay unnamed.`,
  );
}
console.log(`Next: node scripts/build-components.mjs ${out}`);

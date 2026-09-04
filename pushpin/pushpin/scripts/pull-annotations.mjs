#!/usr/bin/env node
/**
 * Captures assets/annotations.figma.json over REST, in the committed shape.
 * There is no distiller for the Annotation Kit — scripts/extract.md § 7 emits
 * entries in the final shape and the merge is a sort — so this script writes
 * the asset directly, the way the four per-page plugin calls did.
 *
 * Reads:
 *
 *   membership   `/files/:key/components` and `/component_sets`, the published
 *                listing. Variants are dropped in favour of their set; what
 *                remains is the gate `getPublishStatusAsync()` answered.
 *   pages        `/files/:key?depth=1` for the page list, in document order.
 *   nodes        `/files/:key/nodes?ids=<every page>` at full depth. Walking
 *                the pages rather than fetching only the published node ids is
 *                what keeps `capturedTotal` and `unpublishedOmitted` honest:
 *                every COMPONENT and COMPONENT_SET the file holds is counted,
 *                and the published listing decides which are kept. The kit's
 *                own component pull cannot afford the same walk across 91 pages
 *                and reports the published count instead; this file has four.
 *
 * Property definitions come off the node — `componentPropertyDefinitions`, the
 * reading § 7 calls definitionally correct, because `setProperties` takes the
 * suffixed key and a missing suffix throws. Over REST that is editor state
 * rather than the published definition; the two agree once the file has been
 * published, which is the moment CI reads it.
 *
 * The committed asset's `$comment`, `$note` and `$duplicateNames` are copied
 * from the committed file. They document the shape and are not read from Figma
 * by either path.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_... node scripts/pull-annotations.mjs [--out annotations.figma.json]
 *   FIGMA_TOKEN=figd_... node scripts/pull-annotations.mjs --check
 *
 * --check compares the capture with the committed asset, writes nothing, and
 * exits 1 if any component moved.
 */

import { explain, getNodes, pagesOf, publishedOwners, requireToken } from './lib/figma-rest.mjs';
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
const out = option(argv, '--out', 'annotations.figma.json');
const check = flag(argv, '--check');
requireToken('pull-annotations.mjs');

const kit = manifest.annotationKit;
const committed = loadCommitted('annotations.figma.json');

/**
 * `componentPropertyDefinitions` in the committed shape. Figma keys the object
 * by the full property key — the bare name for VARIANT, `name#id:n` for the
 * rest — and the display name is what precedes the `#`. An INSTANCE_SWAP
 * default is a node id that names nothing to a reader, so it is left out, as
 * § 7 leaves it out.
 */
function properties(defs) {
  const out = {};
  for (const [full, d] of Object.entries(defs ?? {})) {
    const display = d.type === 'VARIANT' || !full.includes('#') ? full : full.slice(0, full.indexOf('#'));
    out[display] = {
      type: d.type,
      key: full,
      ...(d.variantOptions ? { options: d.variantOptions } : {}),
      ...(d.defaultValue !== undefined && d.type !== 'INSTANCE_SWAP' ? { default: d.defaultValue } : {}),
    };
  }
  return out;
}

/** Every COMPONENT and COMPONENT_SET under a page, variants excluded, in document order. */
function owners(node, acc = [], parent = null) {
  if (node.type === 'COMPONENT' && parent?.type === 'COMPONENT_SET') return acc;
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') acc.push(node);
  for (const child of node.children ?? []) owners(child, acc, node);
  return acc;
}

async function capture() {
  const [{ byNode }, pages] = await Promise.all([publishedOwners(kit.fileKey), pagesOf(kit.fileKey)]);
  const { nodes } = await getNodes(kit.fileKey, pages.map((p) => p.id));

  const found = [];
  let capturedTotal = 0;
  for (const page of pages) {
    const doc = nodes[page.id]?.document;
    if (!doc) throw new Error(`page "${page.name}" (${page.id}) came back empty from /nodes`);
    for (const n of owners(doc)) {
      capturedTotal++;
      const pub = byNode.get(n.id);
      if (!pub) continue;
      const props = properties(n.componentPropertyDefinitions);
      found.push({
        name: n.name,
        entry: {
          key: pub.key,
          type: n.type,
          page: page.name,
          nodeId: n.id,
          ...(Object.keys(props).length ? { properties: props } : {}),
        },
      });
    }
  }

  // A published name is not unique here — `A11y / Annotation / Spec` twice —
  // so every entry sharing a name is keyed `<name> [<nodeId>]` and carries the
  // true name, as the committed asset does.
  const seen = new Map();
  for (const f of found) seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
  const components = {};
  for (const { name, entry } of found) {
    if (seen.get(name) > 1) {
      components[`${name} [${entry.nodeId}]`] = { name, ...entry };
    } else {
      components[name] = entry;
    }
  }
  const sorted = Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b)));

  return {
    $comment: committed.$comment,
    $note: committed.$note,
    $duplicateNames: committed.$duplicateNames,
    source: {
      fileKey: kit.fileKey,
      fileName: kit.fileName,
      libraryKey: kit.libraryKey,
      extractedAt: today(),
      pages: Object.fromEntries(pages.map((p) => [p.name, p.id])),
      capturedTotal,
      unpublishedOmitted: capturedTotal - found.length,
      publicKept: Object.keys(sorted).length,
    },
    components: sorted,
  };
}

let doc;
try {
  doc = await capture();
} catch (e) {
  console.error(explain(e, kit.fileKey));
  process.exit(1);
}

if (check) {
  reportCheck(
    `annotations (${doc.source.publicKept} published)`,
    compareEntries(committed.components, doc.components),
    `Run: node scripts/pull-annotations.mjs --out assets/annotations.figma.json && node scripts/manifest.mjs`,
  );
}

writeJson(out, doc);
console.log(
  `Wrote ${out} — ${doc.source.publicKept} published components across ` +
    `${Object.keys(doc.source.pages).length} pages (${doc.source.unpublishedOmitted} unpublished ` +
    `omitted of ${doc.source.capturedTotal}).`,
);

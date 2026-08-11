#!/usr/bin/env node
/**
 * Distills the Thumbprint UI Kit's icon page into assets/icons.figma.json —
 * the catalog used to place a real icon instance at the right size instead of
 * omitting the icon or scaling one from the wrong size ramp.
 *
 * Icons are the one part of Pushpin that is not published from the Pushpin
 * file. They live on page `2:1` of the Thumbprint UI Kit
 * (`jjhhb3Kp6a7JrtBLCjrf6u`) and are published from its library — deliberately,
 * so one set of glyphs serves both systems — which is why they never appeared in
 * components.figma.json and why nothing in the plugin could place one.
 *
 * Two inputs, because neither alone is enough:
 *
 *   the component dump   `list_file_components_for_code_connect` — names and
 *                        the assetKey needed by importComponentByKeyAsync, but
 *                        it flattens the page to a list and loses the category
 *                        grouping entirely.
 *   the page metadata    `get_metadata` on node 2:1 — the category frames and
 *                        which icons sit inside each, but no keys.
 *
 * They join on nodeId. See scripts/extract.md section 7.
 *
 * Usage: node scripts/build-icons.mjs <raw-dump.json> <page-metadata.xml>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets', 'icons.figma.json');

export const FILE_KEY = 'jjhhb3Kp6a7JrtBLCjrf6u';
export const FILE_NAME = 'Thumbprint UI Kit';
export const LIBRARY_KEY =
  'lk-6d54e39c09e05fd3a5164fcc5a88cf6a2dbedd3ad29d20c2ce66ee39c57c81234d16c5746301ace3ae6af7d5bcf49b7389800cb4f7b9521f2fb70de1af7c2dd6';
export const PAGE = { name: 'Icons', id: '2:1' };

/**
 * The whole size ramp, and the reason this catalog records dimensions at all.
 * An icon is placed by swapping to the variant that is already the right size;
 * resizing one is the defect these numbers let the audit catch.
 */
export const SIZES = { Tiny: 14, Small: 18, Medium: 28, Large: 32 };

/** `Bookmark Filled Icon · Large` → `{ base: 'Bookmark Filled', size: 'Large' }` */
export function parseIconName(name) {
  const m = /^(.+) Icon · (Tiny|Small|Medium|Large)$/.exec(name);
  return m ? { base: m[1], size: m[2] } : null;
}

/** `Notification Alerts Icons` → `notification-alerts` */
const toCategory = (frameName) =>
  frameName
    .replace(/ Icons$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

/**
 * Map every icon nodeId to the category frame that contains it.
 *
 * The metadata is an XML tree of `<frame>` wrappers around self-closing
 * `<symbol>` elements. Only the outermost `… Icons` frame names a category —
 * the frames nested inside it are size groups (`Large`, `Medium`, …) and would
 * overwrite the category with a size if the innermost match won.
 */
export function categoriesFromMetadata(xml) {
  const byNodeId = new Map();
  const stack = [];

  const tag = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(xml))) {
    const [, closing, type, attrs, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const name = /name="([^"]*)"/.exec(attrs)?.[1] ?? '';
    if (type === 'symbol') {
      const id = /id="([^"]*)"/.exec(attrs)?.[1];
      const category = stack.find((f) => / Icons$/.test(f));
      if (id && category) byNodeId.set(id, toCategory(category));
      continue;
    }
    if (!selfClosing) stack.push(name);
  }
  return byNodeId;
}

/**
 * Reduce a raw dump plus page metadata to the committed catalog. Exported so
 * diff.mjs can distill a fresh capture the same way and compare like with like.
 *
 * Grouping is by name *and* category, not name alone. `Home` is published in
 * both Navigation and Meta Category at all four sizes — two real components
 * that happen to share a name, the same trap the Annotation Kit sets with its
 * two `A11y / Annotation / Spec` entries. Collapsing on name would drop one of
 * them silently and make `publicKept` disagree with the key count.
 */
export function distillIcons(all, xml) {
  const categories = categoriesFromMetadata(xml);
  const groups = new Map();
  const duplicates = {};
  let capturedTotal = 0;
  let offPageOmitted = 0;
  let uncategorised = 0;

  for (const c of all) {
    const parsed = parseIconName(c.name);
    if (!parsed) continue;
    capturedTotal++;
    // A handful of icons are published from other pages — older copies parked
    // in a workspace. The canonical inventory is the Icons page, and a stray
    // duplicate resolving under the same base name would shadow it.
    if (c.pageId !== PAGE.id) {
      offPageOmitted++;
      continue;
    }
    const category = categories.get(c.nodeId) ?? 'uncategorised';
    if (category === 'uncategorised') uncategorised++;

    const id = `${parsed.base}\u0000${category}`;
    const entry = groups.get(id) ?? { base: parsed.base, category, keys: {} };
    groups.set(id, entry);

    if (entry.keys[parsed.size]) {
      // Same name, same category, same size, different node — one key has to
      // win. Record it rather than letting the count quietly not add up.
      (duplicates[c.name] ??= []).push(c.nodeId);
      continue;
    }
    entry.keys[parsed.size] = c.assetKey;
  }

  // A base name that appears in one category keeps its plain name; one that
  // spans several is suffixed, so every published icon is reachable and the
  // ambiguity is visible at the point of lookup.
  const spread = new Map();
  for (const e of groups.values()) spread.set(e.base, (spread.get(e.base) || 0) + 1);

  const icons = {};
  for (const e of groups.values()) {
    const name = spread.get(e.base) > 1 ? `${e.base} [${e.category}]` : e.base;
    icons[name] = {
      ...(name === e.base ? {} : { name: e.base }),
      category: e.category,
      // Size order follows the ramp rather than the alphabet, so a reader
      // scanning the catalog sees Tiny → Large and not Large → Tiny → …
      keys: Object.fromEntries(
        Object.keys(SIZES)
          .filter((s) => e.keys[s])
          .map((s) => [s, e.keys[s]]),
      ),
    };
  }

  const sorted = Object.fromEntries(
    Object.entries(icons).sort(([a], [b]) => a.localeCompare(b)),
  );

  return { icons: sorted, duplicates, capturedTotal, offPageOmitted, uncategorised };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

function main() {
  const [rawPath, metaPath] = process.argv.slice(2);
  if (!rawPath || !metaPath) {
    console.error('usage: node scripts/build-icons.mjs <raw-dump.json> <page-metadata.xml>');
    process.exit(1);
  }

  const all = JSON.parse(readFileSync(rawPath, 'utf8'));
  const xml = readFileSync(metaPath, 'utf8');
  const { icons, duplicates, capturedTotal, offPageOmitted, uncategorised } = distillIcons(
    all,
    xml,
  );

  // A size missing from an icon is a real fact about the kit, not a capture
  // bug: the placement rules have to send the caller to a size that exists
  // rather than resizing a neighbouring one.
  const partial = Object.entries(icons).filter(
    ([, e]) => Object.keys(e.keys).length !== Object.keys(SIZES).length,
  );

  const categoryCounts = {};
  for (const e of Object.values(icons)) {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  }

  const doc = {
    $comment:
      'Published icon components of the Thumbprint UI Kit. `keys` holds the assetKey to pass ' +
      'to figma.importComponentByKeyAsync, one per size. Icons are NOT published from the ' +
      'Pushpin file — this is a third source library. Generated — see scripts/build-icons.mjs.',
    source: {
      fileKey: FILE_KEY,
      fileName: FILE_NAME,
      libraryKey: LIBRARY_KEY,
      page: PAGE.name,
      pageId: PAGE.id,
      extractedAt: new Date().toISOString().slice(0, 10),
      capturedTotal,
      offPageOmitted,
      duplicateOmitted: Object.values(duplicates).reduce((n, v) => n + v.length, 0),
      publicKept: Object.keys(icons).length,
      keyCount: Object.values(icons).reduce((n, e) => n + Object.keys(e.keys).length, 0),
    },
    sizes: SIZES,
    categories: Object.fromEntries(
      Object.entries(categoryCounts).sort(([a], [b]) => a.localeCompare(b)),
    ),
    // Two facts about the kit that the placement rules have to respect, kept
    // where a reader trips over them rather than in a comment somewhere.
    incomplete: Object.fromEntries(partial.map(([n, e]) => [n, Object.keys(e.keys)])),
    duplicates,
    icons,
  };

  writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  const dupes = Object.keys(duplicates).length;
  console.log(
    `Wrote ${OUT} — ${doc.source.publicKept} icons across ` +
      `${Object.keys(categoryCounts).length} categories, ${doc.source.keyCount} keys ` +
      `(${offPageOmitted} off-page omitted of ${capturedTotal}).` +
      (partial.length ? ` ${partial.length} do not publish all four sizes.` : '') +
      (dupes ? ` ${dupes} name collided within a category; first key kept.` : '') +
      (uncategorised ? ` ${uncategorised} could not be matched to a category frame.` : ''),
  );
}

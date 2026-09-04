#!/usr/bin/env node
/**
 * Captures the two inputs scripts/build-icons.mjs joins, over REST:
 *
 *   icons-raw.json    the published icon components — every `/files/:key/
 *                     components` entry named `<Glyph> Icon · <Size>` — in the
 *                     fields the distiller reads off the Code Connect dump:
 *                     `name`, `assetKey`, `nodeId`, `pageId`, `pageName`.
 *   icons-page.json   the icons page's node tree from `/files/:key/nodes`,
 *                     which is the category grouping `get_metadata` drew as XML.
 *                     build-icons.mjs reads either; see `categoriesFromTree`.
 *
 * The page id is read off the dump rather than written down, as extract.md § 8
 * requires: the page the icon entries share is the icons page, and a constant
 * here would survive one file reorganisation and then capture the wrong frames.
 * The distiller carries its own `PAGE.id` for the off-page rule, and a
 * disagreement between the two is printed rather than resolved.
 *
 * `--depth` bounds the page fetch. Category frame, size frame, component is
 * three levels; one more takes in a component's direct children in case a
 * category nests a row frame, and stops well short of the glyph vectors. The
 * category walk handles any nesting, so a deeper fetch costs bytes and nothing
 * else.
 *
 * What REST cannot see: unpublished icons. The dump lists every component in
 * the file, so `offPageOmitted` counted two unpublished `_base / …` copies and
 * `capturedTotal` counted them too; here both reflect the published set only.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_... node scripts/pull-icons.mjs [--out icons] [--depth 4]
 *   FIGMA_TOKEN=figd_... node scripts/pull-icons.mjs --check
 *
 * Then: node scripts/build-icons.mjs icons/icons-raw.json icons/icons-page.json
 *
 * --check distils in memory, compares every icon with the committed catalog,
 * writes nothing, and exits 1 if anything moved.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { PAGE, distillIcons, parseIconName } from './build-icons.mjs';
import { explain, figmaGet, getNodes, requireToken } from './lib/figma-rest.mjs';
import {
  compareEntries,
  flag,
  loadCommitted,
  manifest,
  option,
  reportCheck,
  writeJson,
} from './lib/pull.mjs';

const argv = process.argv.slice(2);
const out = option(argv, '--out', 'icons');
const depth = Number(option(argv, '--depth', '4'));
const check = flag(argv, '--check');
requireToken('pull-icons.mjs');

const fileKey = manifest.iconLibrary.fileKey;

async function capture() {
  const res = await figmaGet(`/files/${fileKey}/components`);
  const all = res?.meta?.components;
  if (!Array.isArray(all)) throw new Error(`unexpected response shape from /files/${fileKey}/components`);

  const raw = all
    .filter((m) => parseIconName(m.name))
    .map((m) => ({
      name: m.name,
      assetKey: m.key,
      nodeId: m.node_id,
      type: 'COMPONENT',
      pageId: m.containing_frame?.pageId ?? null,
      pageName: m.containing_frame?.pageName ?? null,
    }));
  if (!raw.length) throw new Error('the published listing holds no `… Icon · <Size>` components');

  // The page most icon entries sit on. Anything elsewhere is the off-page
  // duplicate the distiller counts.
  const tally = new Map();
  for (const r of raw) tally.set(r.pageId, (tally.get(r.pageId) ?? 0) + 1);
  const [pageId] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];

  const { nodes } = await getNodes(fileKey, [pageId], { depth });
  const page = nodes[pageId]?.document;
  if (!page) throw new Error(`icons page ${pageId} came back empty from /nodes`);

  return { raw, page, pageId };
}

let cap;
try {
  cap = await capture();
} catch (e) {
  console.error(explain(e, fileKey));
  process.exit(1);
}

if (cap.pageId !== PAGE.id) {
  console.log(
    `  warning  the icons sit on page ${cap.pageId} ("${cap.page.name}") but build-icons.mjs ` +
      `expects ${PAGE.id}; update PAGE there or every icon distils as off-page.`,
  );
}

if (check) {
  const committed = loadCommitted('icons.figma.json');
  const fresh = distillIcons(cap.raw, cap.page).icons;
  reportCheck(
    `icons (${cap.raw.length} published)`,
    compareEntries(committed.icons, fresh),
    `Run: node scripts/pull-icons.mjs && node scripts/build-icons.mjs ${out}/icons-raw.json ${out}/icons-page.json`,
  );
}

mkdirSync(out, { recursive: true });
writeJson(join(out, 'icons-raw.json'), cap.raw);
writeJson(join(out, 'icons-page.json'), cap.page);
console.log(
  `Wrote ${out}/icons-raw.json (${cap.raw.length} published icons) and ${out}/icons-page.json ` +
    `(page "${cap.page.name}", ${cap.pageId}).`,
);
console.log(`Next: node scripts/build-icons.mjs ${out}/icons-raw.json ${out}/icons-page.json`);

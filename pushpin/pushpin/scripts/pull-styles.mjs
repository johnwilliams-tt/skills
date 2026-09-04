#!/usr/bin/env node
/**
 * Captures assets/styles.figma.json over REST, in the committed shape. No
 * distiller builds that file — scripts/extract.md § 4 reads the local text and
 * effect styles with the plugin API and the result is committed as read — so
 * this script writes the asset directly.
 *
 * Reads:
 *
 *   `/files/:key/styles`        every published style with its key, node id and
 *                               type. Only TEXT and EFFECT are kept.
 *   `/files/:key/nodes?ids=`    the text styles' own nodes, whose `style` block
 *                               is the TypeStyle the metrics are read from. An
 *                               effect style contributes only its key, as in the
 *                               committed asset, so its node is not fetched.
 *
 * Translation from REST's TypeStyle to the `{ value, unit }` metrics the
 * plugin capture records, which build-css.mjs reads the unit of:
 *
 *   font           `fontFamily + ' ' + fontStyle`, the plugin's
 *                  `fontName.family + ' ' + fontName.style`.
 *   lineHeight     REST states the unit the designer chose in `lineHeightUnit`:
 *                  `FONT_SIZE_%` is `{ value: lineHeightPercentFontSize, unit:
 *                  "PERCENT" }`, `PIXELS` is `{ value: lineHeightPx, unit:
 *                  "PIXELS" }`, `INTRINSIC_%` is `{ unit: "AUTO" }`. Figma omits
 *                  `lineHeightPercentFontSize` when it is 100, so absent means
 *                  100.
 *   letterSpacing  REST gives pixels and no unit. A style set to -2% of 48px
 *                  arrives as -0.96 and is indistinguishable from one set to
 *                  -0.96px. The unit is taken from the committed asset's entry
 *                  for the same style name: PERCENT converts back through the
 *                  font size, PIXELS is kept as given. A style the committed
 *                  asset does not hold is recorded in PIXELS — what REST said —
 *                  and named in the output so a maintainer confirms the unit
 *                  in the editor; every one of the 13 published styles today
 *                  is PERCENT.
 *
 * The `EightShapes Spec/*` styles are dropped for the reason § 4 gives: they
 * are the design system's documentation tooling and must not reach product
 * design. `$comment` and `$note` are copied from the committed asset; they
 * document the shape rather than read Figma. `source.verifiedBy` is rewritten,
 * because the committed sentence records an import pass this script does not
 * perform.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_... node scripts/pull-styles.mjs [--out styles.figma.json]
 *   FIGMA_TOKEN=figd_... node scripts/pull-styles.mjs --check
 *
 * --check compares the capture with the committed asset, writes nothing, and
 * exits 1 if any style moved.
 */

import { explain, figmaGet, getNodes, requireToken } from './lib/figma-rest.mjs';
import {
  compareEntries,
  flag,
  loadCommitted,
  manifest,
  option,
  r4,
  reportCheck,
  today,
  writeJson,
} from './lib/pull.mjs';

const argv = process.argv.slice(2);
const out = option(argv, '--out', 'styles.figma.json');
const check = flag(argv, '--check');
requireToken('pull-styles.mjs');

const fileKey = manifest.figma.fileKey;
const committed = loadCommitted('styles.figma.json');

const EXCLUDED = /^EightShapes Spec\//;

function lineHeight(style) {
  switch (style.lineHeightUnit) {
    case 'INTRINSIC_%':
      return { unit: 'AUTO' };
    case 'PIXELS':
      return { value: r4(style.lineHeightPx), unit: 'PIXELS' };
    case 'FONT_SIZE_%':
      return { value: r4(style.lineHeightPercentFontSize ?? 100), unit: 'PERCENT' };
    default:
      throw new Error(`unrecognised lineHeightUnit ${JSON.stringify(style.lineHeightUnit)}`);
  }
}

function letterSpacing(name, style, unresolved) {
  const px = style.letterSpacing ?? 0;
  const prior = committed.textStyles?.[name]?.letterSpacing;
  if (prior?.unit === 'PERCENT') {
    return { value: r4((px / style.fontSize) * 100), unit: 'PERCENT' };
  }
  if (!prior) unresolved.push(name);
  return { value: r4(px), unit: 'PIXELS' };
}

function fontName(name, style) {
  if (!style.fontFamily) throw new Error(`text style "${name}" carries no fontFamily`);
  const face = style.fontStyle ?? style.fontPostScriptName?.split('-').slice(1).join(' ');
  if (!face) throw new Error(`text style "${name}" carries neither fontStyle nor fontPostScriptName`);
  return `${style.fontFamily} ${face}`;
}

async function capture() {
  const res = await figmaGet(`/files/${fileKey}/styles`);
  const all = res?.meta?.styles;
  if (!Array.isArray(all)) throw new Error(`unexpected response shape from /files/${fileKey}/styles`);

  const text = all.filter((s) => s.style_type === 'TEXT' && !EXCLUDED.test(s.name));
  const effect = all.filter((s) => s.style_type === 'EFFECT' && !EXCLUDED.test(s.name));
  const excluded = all.filter((s) => s.style_type === 'TEXT' && EXCLUDED.test(s.name)).length;

  const { nodes } = await getNodes(fileKey, text.map((s) => s.node_id), { depth: 1 });

  const unresolved = [];
  const textStyles = {};
  for (const s of text) {
    const doc = nodes[s.node_id]?.document;
    if (!doc?.style) throw new Error(`text style "${s.name}" (${s.node_id}) has no readable node`);
    textStyles[s.name] = {
      key: s.key,
      font: fontName(s.name, doc.style),
      size: r4(doc.style.fontSize),
      letterSpacing: letterSpacing(s.name, doc.style, unresolved),
      lineHeight: lineHeight(doc.style),
    };
  }
  const effectStyles = {};
  for (const s of effect) effectStyles[s.name] = { key: s.key };

  return {
    doc: {
      $comment: committed.$comment,
      source: {
        fileKey,
        extractedAt: today(),
        verifiedBy:
          `Keys and metrics read over the Figma REST API on ${today()}, from /files/:key/styles and ` +
          'the text styles\u2019 nodes. Not import-verified; scripts/check.md section 1 is the pass ' +
          'that applies them in a consuming file.',
      },
      $note: committed.$note,
      textStyles,
      effectStyles,
      ...(excluded
        ? {
            $excluded:
              `The file also defines ${excluded} 'EightShapes Spec/*' text styles in Inter. Those ` +
              "belong to the design system's own documentation tooling and must never be used in " +
              'product design.',
          }
        : {}),
    },
    excluded,
    unresolved,
  };
}

let result;
try {
  result = await capture();
} catch (e) {
  console.error(explain(e, fileKey));
  process.exit(1);
}
const { doc, excluded, unresolved } = result;

/** Effect style names collide with nothing, but a shared map needs them told apart. */
const prefix = (effects) =>
  Object.fromEntries(Object.entries(effects ?? {}).map(([n, e]) => [`effect ${n}`, e]));

if (check) {
  const before = { ...committed.textStyles, ...prefix(committed.effectStyles) };
  const after = { ...doc.textStyles, ...prefix(doc.effectStyles) };
  reportCheck(
    `styles (${Object.keys(doc.textStyles).length} text, ${Object.keys(doc.effectStyles).length} effect)`,
    compareEntries(before, after),
    'Run: node scripts/pull-styles.mjs --out assets/styles.figma.json && node scripts/build-css.mjs && node scripts/manifest.mjs',
  );
}

writeJson(out, doc);
console.log(
  `Wrote ${out} — ${Object.keys(doc.textStyles).length} text and ` +
    `${Object.keys(doc.effectStyles).length} effect styles (${excluded} EightShapes Spec styles excluded).`,
);
for (const n of unresolved) {
  console.log(
    `  warning  "${n}" is new; its letterSpacing is recorded in PIXELS because REST carries no ` +
      'unit. Confirm the unit in the editor and correct it if the style is set in percent.',
  );
}
console.log('Next: node scripts/build-css.mjs');

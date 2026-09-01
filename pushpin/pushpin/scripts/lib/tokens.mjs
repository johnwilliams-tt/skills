/**
 * Shared reading of the token capture.
 *
 * Three consumers need the same facts about `tokens.figma.json` — the CSS
 * generator's naming rule, the impeccable bridge's resolved ramps, and the
 * lookup and check scripts — and a fourth answer to "what is this token called
 * in CSS?" would be a fourth chance to disagree with `build-css.mjs`. The
 * group table below is that rule in one place.
 *
 * `build-css.mjs` deliberately still owns its own emitter: it is the generator
 * of record, and a bug here must not be able to rewrite the stylesheet.
 * `verify.mjs` compares the two by resolving every var() chain in the built
 * CSS, so a drift between this table and the generator fails there.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findOverlay, overlayPath } from './overlay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ASSETS = join(here, '..', '..', 'assets');

/** Capture objects carry `$comment`-style metadata alongside real entries. */
export const real = (o) => Object.entries(o ?? {}).filter(([k]) => !k.startsWith('$'));

/** Figma variable paths become custom property names by swapping the slash. */
export const seg = (path) => String(path).replace(/\//g, '-');

/**
 * Resolved once per process. The overlay is a property of where the command was
 * run, which cannot change mid-run, and re-reading `.pushpin/assets/` on every
 * one of `lookup`'s six catalog loads would stat the same directory six times.
 */
let overlay;
export const activeOverlay = () => (overlay === undefined ? (overlay = findOverlay()) : overlay);

/**
 * A capture, from the project's own re-capture where it has one and from the
 * plugin otherwise. See lib/overlay.mjs for why only the catalogs are eligible
 * and why nothing here is allowed to be silent about it.
 */
export const loadAsset = (file) => {
  const own = overlayPath(activeOverlay(), file);
  return JSON.parse(readFileSync(own ?? join(ASSETS, file), 'utf8'));
};

/** The plugin's own copy, whatever the project holds. */
export const loadShippedAsset = (file) =>
  JSON.parse(readFileSync(join(ASSETS, file), 'utf8'));

/**
 * Every token group, its custom property name, and whether it can be bound as
 * a Figma variable.
 *
 * Three vocabularies meet here and none of them is the others. `key` is what
 * `tokens.figma.json` stores the group under. `bindable` and `hidden` are the
 * collection names in `variable-keys.figma.json` — "Corner Radius" there is
 * `cornerRadius` here. `collection` is the variable collection's own name in
 * Figma, which is what a capture reports and what `diff.mjs` and the component
 * spec resolver both have to translate. Mapping all three once is what lets a
 * caller ask "can I bind this?" or "what is this bound variable called in CSS?"
 * without knowing any of them.
 */
export const TOKEN_GROUPS = [
  { key: 'baseColors', label: 'base color', css: (k) => `--pp-color-${seg(k)}`, collection: 'Tokens / Base Colors', hidden: 'Base Colors' },
  { key: 'semanticColors', label: 'semantic color', css: (k) => `--pp-${seg(k)}`, collection: 'Tokens / Semantic Colors', bindable: 'Semantic Colors', hidden: 'Semantic Colors' },
  { key: 'space', label: 'space', css: (k) => `--pp-space-${seg(k)}`, collection: 'Tokens / Space', bindable: 'Space', unit: 'px' },
  { key: 'cornerRadius', label: 'radius', css: (k) => `--pp-radius-${seg(k)}`, collection: 'Tokens / Corner Radius', bindable: 'Corner Radius', unit: 'px' },
  { key: 'fontWeight', label: 'font weight', css: (k) => `--pp-font-weight-${seg(k)}`, collection: 'Tokens / Font Weight', bindable: 'Font Weight' },
  { key: 'font', label: 'type step', css: (k) => `--pp-font-size-${seg(k)}`, collection: 'Tokens / Font', hidden: 'Font' },
  { key: 'lineHeight', label: 'line height', css: (k) => `--pp-leading-${seg(k)}`, collection: 'Tokens / Line Height', bindable: 'Line Height' },
  { key: 'letterSpacing', label: 'letter spacing', css: (k) => `--pp-tracking-${seg(k)}`, collection: 'Tokens / Letter Spacing', bindable: 'Letter Spacing', unit: 'percent' },
  { key: 'shadow', label: 'elevation', css: (k) => `--pp-shadow-${seg(k)}`, collection: 'Tokens / Shadow', hidden: 'Shadow' },
  { key: 'duration', label: 'duration', css: (k) => `--pp-duration-${seg(k)}`, collection: 'Tokens / Duration', hidden: 'Duration', unit: 'ms' },
  { key: 'easing', label: 'easing', css: (k) => `--pp-${seg(k)}`, collection: 'Tokens / Easing', hidden: 'Easing' },
  { key: 'breakpoint', label: 'breakpoint', css: (k) => `--pp-breakpoint-${seg(k)}`, collection: 'Tokens / Breakpoint', hidden: 'Breakpoint', unit: 'px' },
  { key: 'scrim', label: 'scrim', css: (k) => `--pp-scrim-${seg(k)}`, collection: 'Tokens / Scrim', bindable: 'Scrim' },
  { key: 'wrap', label: 'wrap', css: (k) => `--pp-wrap-${seg(k)}`, collection: 'Tokens / Wrap', bindable: 'Wrap', unit: 'px' },
  { key: 'zIndex', label: 'z-index', css: (k) => `--pp-z-${seg(k)}`, collection: 'Tokens / Z-Index', hidden: 'Z-Index' },
];

/**
 * A group's `$unit` as it reads in prose. `percent` prints `%` because that is
 * what the kit means; the stylesheet emits `em`, which is `build-css.mjs`'s
 * decision about how a proportional value survives the breakpoint rescale.
 */
export const UNIT_LABEL = { px: 'px', ms: 'ms', percent: '%' };

/**
 * A Figma text-style metric — `{ value, unit }`, or `AUTO` with no value. The
 * unit is carried rather than dropped because a percentage and a pixel amount
 * of tracking are different design decisions at every size but one.
 */
export const metric = (m) => {
  if (!m || typeof m !== 'object') return null;
  if (m.unit === 'AUTO') return 'auto';
  return `${m.value}${m.unit === 'PERCENT' ? '%' : 'px'}`;
};

/**
 * Type step to published text style — `hero`→`Title/Hero`, `title-N`→`Title/N`,
 * `body-N`→`Text/N`. Thirteen steps, thirteen styles, 1:1.
 */
function textStyleFor(step) {
  if (step === 'hero') return 'Title/Hero';
  const m = /^(title|body)-(\d+)$/.exec(step);
  return m ? `${m[1] === 'title' ? 'Title' : 'Text'}/${m[2]}` : null;
}

/**
 * A type step's line height per font mode, in pixels, shaped like the capture's
 * own `lineHeight` so it can stand in for it.
 *
 * The kit answers this twice and the answers disagree: `Tokens / Font` carries a
 * pixel line height per step, the published style carries a percentage, and the
 * two resolve to the same number on the nine title steps but not on the four
 * body ones. `build-css.mjs` emits the style's, since that is what renders on a
 * node in Figma, so anything here that reported the variable would be quoting a
 * leading the stylesheet does not set.
 */
export function leading(tokens, styles, step) {
  const styleName = textStyleFor(step);
  const style = styleName && styles?.textStyles?.[styleName];
  const lh = style?.lineHeight;
  if (!lh || typeof lh.value !== 'number' || lh.unit !== 'PERCENT') {
    throw new Error(
      `type step "${step}" has no published text style setting a percentage line height, ` +
        `so its leading cannot be resolved the way the stylesheet resolves it`,
    );
  }
  const out = {};
  for (const [mode, size] of Object.entries(tokens.font?.[step]?.size ?? {})) {
    if (typeof size === 'number') out[mode] = Number(((size * lh.value) / 100).toFixed(4));
  }
  return out;
}

/** Resolve a semantic token's `@alias` chain down to a literal hex. */
export function resolveHex(tokens, path, mode, seen = new Set()) {
  if (seen.has(path)) return null;
  seen.add(path);
  if (path in tokens.baseColors) return tokens.baseColors[path];
  const v = tokens.semanticColors[path]?.[mode];
  if (typeof v !== 'string') return null;
  return v.startsWith('@') ? resolveHex(tokens, v.slice(1), mode, seen) : v;
}

/**
 * Radii, with two adjustments the impeccable detector needs.
 *
 * `full: 50%` is dropped — a percentage has no pixel value and the detector
 * skips it anyway. `sides: 9999` is emitted as `9999px` and *also* aliased to
 * `full`, because the detector only sets its pill flag on a token literally
 * named full/pill/round. Pushpin makes every button and input a pill, so
 * without the alias the most common radius in the system reads as a violation.
 */
export function radii(tokens) {
  const out = {};
  for (const [name, value] of real(tokens.cornerRadius)) {
    if (typeof value !== 'number') continue;
    out[name] = `${value}px`;
  }
  if (out.sides) out.full = out.sides;
  return out;
}

/**
 * The type ramp, both breakpoints. `scale` is the impeccable format's name for
 * an enumerated ramp, and enumerating it is what lets the detector flag a
 * `font-size: 15px` that is not on it.
 */
export function fontScale(tokens) {
  const out = {};
  for (const [step, spec] of real(tokens.font)) {
    for (const [mode, px] of Object.entries(spec.size ?? {})) {
      if (typeof px === 'number') out[`${step}-${mode}`] = `${px}px`;
    }
  }
  return out;
}

/** The space scale as a pixel map. */
export function spacing(tokens) {
  const out = {};
  for (const [step, px] of real(tokens.space)) {
    if (typeof px === 'number') out[step] = `${px}px`;
  }
  return out;
}

/**
 * Variant axes only, and only the ones with a choice in them. They are what a
 * `data-pp-variant` declaration names, and a single-option axis like Button's
 * `Platform: Native & Mobile` names nothing a caller can decide.
 */
export function variantAxes(entry) {
  return real(entry?.properties ?? {})
    .filter(([, spec]) => spec.type === 'VARIANT' && Array.isArray(spec.options) && spec.options.length > 1)
    .map(([name, spec]) => [name, spec.options]);
}

export const FONT_FAMILY = 'Thumbtack Rise';

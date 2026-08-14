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

const here = dirname(fileURLToPath(import.meta.url));
export const ASSETS = join(here, '..', '..', 'assets');

/** Capture objects carry `$comment`-style metadata alongside real entries. */
export const real = (o) => Object.entries(o ?? {}).filter(([k]) => !k.startsWith('$'));

/** Figma variable paths become custom property names by swapping the slash. */
export const seg = (path) => String(path).replace(/\//g, '-');

export const loadAsset = (file) => JSON.parse(readFileSync(join(ASSETS, file), 'utf8'));

/**
 * Every token group, its custom property name, and whether it can be bound as
 * a Figma variable.
 *
 * `bindable` and `hidden` are the collection names used by
 * `variable-keys.figma.json`, which is a different vocabulary from the capture's
 * own group keys — "Corner Radius" there is `cornerRadius` here. Mapping them
 * once is what lets a lookup answer "can I bind this?" without the caller
 * knowing either vocabulary.
 */
export const TOKEN_GROUPS = [
  { key: 'baseColors', label: 'base color', css: (k) => `--pp-color-${seg(k)}`, hidden: 'Base Colors' },
  { key: 'semanticColors', label: 'semantic color', css: (k) => `--pp-${seg(k)}`, bindable: 'Semantic Colors', hidden: 'Semantic Colors' },
  { key: 'space', label: 'space', css: (k) => `--pp-space-${seg(k)}`, bindable: 'Space', unit: 'px' },
  { key: 'cornerRadius', label: 'radius', css: (k) => `--pp-radius-${seg(k)}`, bindable: 'Corner Radius', unit: 'px' },
  { key: 'fontWeight', label: 'font weight', css: (k) => `--pp-font-weight-${seg(k)}`, bindable: 'Font Weight' },
  { key: 'font', label: 'type step', css: (k) => `--pp-font-size-${seg(k)}`, hidden: 'Font' },
  { key: 'lineHeight', label: 'line height', css: (k) => `--pp-leading-${seg(k)}`, bindable: 'Line Height' },
  { key: 'letterSpacing', label: 'letter spacing', css: (k) => `--pp-tracking-${seg(k)}`, bindable: 'Letter Spacing', unit: 'px' },
  { key: 'shadow', label: 'elevation', css: (k) => `--pp-shadow-${seg(k)}`, hidden: 'Shadow' },
  { key: 'duration', label: 'duration', css: (k) => `--pp-duration-${seg(k)}`, hidden: 'Duration', unit: 'ms' },
  { key: 'easing', label: 'easing', css: (k) => `--pp-${seg(k)}`, hidden: 'Easing' },
  { key: 'breakpoint', label: 'breakpoint', css: (k) => `--pp-breakpoint-${seg(k)}`, hidden: 'Breakpoint', unit: 'px' },
  { key: 'scrim', label: 'scrim', css: (k) => `--pp-scrim-${seg(k)}`, bindable: 'Scrim' },
  { key: 'wrap', label: 'wrap', css: (k) => `--pp-wrap-${seg(k)}`, bindable: 'Wrap', unit: 'px' },
  { key: 'zIndex', label: 'z-index', css: (k) => `--pp-z-${seg(k)}`, hidden: 'Z-Index' },
];

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

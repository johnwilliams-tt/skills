#!/usr/bin/env node
/**
 * Generates pushpin.css from tokens.figma.json and styles.figma.json.
 *
 * Custom property names mirror the Figma variable paths exactly, with `/`
 * replaced by `-`. `background/brand/strong` in Figma is
 * `--pp-background-brand-strong` here, so any value in a build can be traced
 * back to a variable in the kit by name alone.
 *
 * The token capture supplies every custom property. The style capture supplies
 * the two the variables cannot be read for. Tracking is a property of the
 * published text styles and lives nowhere else, so it is per type step rather
 * than per token group. Line height lives in both places and they disagree on
 * the four body steps; the style wins, because it is what renders on a node in
 * Figma.
 *
 * Usage: node scripts/build-css.mjs [--check]
 *   --check  exit non-zero if the committed CSS differs from a fresh build
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'assets', 'tokens.figma.json');
const STYLE_SRC = join(here, '..', 'assets', 'styles.figma.json');
const OUT = join(here, '..', 'assets', 'pushpin.css');

/**
 * Figma models native and desktop as a platform axis. CSS has no such axis, so
 * the type scale is emitted mobile-first with desktop applied above this
 * breakpoint. This is the generator's only interpretive decision.
 */
const TYPE_BREAKPOINT = 'medium';

const t = JSON.parse(readFileSync(SRC, 'utf8'));
const styles = JSON.parse(readFileSync(STYLE_SRC, 'utf8'));
const seg = (path) => path.replace(/\//g, '-');
const isMeta = (k) => k.startsWith('$');
const entries = (o) => Object.entries(o).filter(([k]) => !isMeta(k));

/** Resolve an `@path` alias to a var() reference, or pass a literal through. */
function value(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('@')) return raw;
  const path = raw.slice(1);
  if (path in t.baseColors) return `var(--pp-color-${seg(path)})`;
  if (path in t.semanticColors) return `var(--pp-${seg(path)})`;
  if (path in t.fontWeight) return `var(--pp-font-weight-${seg(path)})`;
  throw new Error(`Unresolved alias: ${raw}`);
}

/**
 * A group's `$unit`, rendered as CSS. `percent` becomes `em` rather than `%`:
 * `%` is not a letter-spacing unit at all, and the ramp rescales at the 700px
 * breakpoint (hero 48→64), so only a proportional unit survives that.
 */
const UNIT_CSS = {
  px: (n) => `${n}px`,
  ms: (n) => `${n}ms`,
  percent: (n) => `${Number((n / 100).toFixed(4))}em`,
};

/**
 * Format a number in the unit its group declares. A group that carries a unit
 * and does not name one stops the build instead of defaulting to px — assuming
 * px on `letterSpacing` is what emitted -1px where the kit means -1%.
 */
function scalar(group, groupName, raw) {
  if (typeof raw !== 'number') return raw;
  const unit = group.$unit;
  if (!unit) {
    throw new Error(`${groupName}: no $unit, so "${raw}" cannot be emitted without guessing one`);
  }
  const fmt = UNIT_CSS[unit];
  if (!fmt) {
    throw new Error(
      `${groupName}: $unit "${unit}" is not one of ${Object.keys(UNIT_CSS).join(', ')}`,
    );
  }
  return fmt(raw);
}

/**
 * The type ramp is the one group the emitter units itself. The capture regroups
 * the flat `Tokens / Font` collection into one object per step, so there is no
 * group-level `$unit` to read, and both the sizes it holds and the line heights
 * resolved from the published styles are pixels.
 */
const px = (n) => (typeof n === 'number' ? `${n}px` : n);

/**
 * Type step to published text style — `hero`→`Title/Hero`, `title-N`→`Title/N`,
 * `body-N`→`Text/N`. Thirteen steps, thirteen styles, 1:1.
 */
function styleFor(step) {
  if (step === 'hero') return 'Title/Hero';
  const m = /^(title|body)-(\d+)$/.exec(step);
  return m ? `${m[1] === 'title' ? 'Title' : 'Text'}/${m[2]}` : null;
}

/** Figma's unit names for a text-style metric, in the capture's `$unit` terms. */
const FIGMA_UNIT = { PIXELS: 'px', PERCENT: 'percent' };

/**
 * The tracking token a type step's text style calls for, or null where the
 * style carries none. Every branch throws rather than falling back, because the
 * behaviour this replaces was a blanket `tracking-tight` across all nine title
 * steps: right for `title-3` and wrong for the other eight, with nothing in the
 * repo able to tell.
 */
function trackingToken(step) {
  const styleName = styleFor(step);
  const style = styleName && styles.textStyles[styleName];
  if (!style) {
    throw new Error(`Type step "${step}" maps to no text style, so its tracking is unknown`);
  }
  const ls = style.letterSpacing;
  if (!ls || typeof ls.value !== 'number' || !ls.unit) {
    throw new Error(`Text style "${styleName}": letterSpacing must be captured as { value, unit }`);
  }
  if (FIGMA_UNIT[ls.unit] !== t.letterSpacing.$unit) {
    throw new Error(
      `Text style "${styleName}" tracks in ${ls.unit}, but the letterSpacing tokens ` +
        `are ${t.letterSpacing.$unit}`,
    );
  }
  if (ls.value === 0) return null;
  const token = entries(t.letterSpacing).find(([, v]) => v === ls.value);
  if (!token) {
    throw new Error(
      `Text style "${styleName}" tracks ${ls.value}, which no letterSpacing token matches`,
    );
  }
  return token[0];
}

/**
 * The line height a type step's text style sets, in pixels, at one font mode.
 *
 * The kit holds two answers and they disagree: the `Tokens / Font` collection
 * carries a pixel line height per step, and the published style carries a
 * percentage. They resolve to the same number on the nine title steps and not
 * on the four body ones — `Text/1` is 140% of 16, or 22.4, where the variable
 * says 24. The style is what a designer sees on a node, so it is what the
 * stylesheet emits; the variable stays in the capture as captured.
 *
 * Percent is the only unit accepted. A pixel or AUTO line height is a different
 * model of the ramp — it would not rescale with the size at the breakpoint the
 * way `hero` 48→64 does — and reinterpreting one as a proportion is the kind of
 * guess that emitted -1px of tracking for a kit that means -1%.
 */
function leadingPx(step, mode) {
  const styleName = styleFor(step);
  const style = styleName && styles.textStyles[styleName];
  if (!style) {
    throw new Error(`Type step "${step}" maps to no text style, so its line height is unknown`);
  }
  const lh = style.lineHeight;
  if (!lh || typeof lh.value !== 'number' || !lh.unit) {
    throw new Error(`Text style "${styleName}": lineHeight must be captured as { value, unit }`);
  }
  if (FIGMA_UNIT[lh.unit] !== 'percent') {
    throw new Error(
      `Text style "${styleName}" sets line height in ${lh.unit}, and only a proportion can be ` +
        `resolved against a size that changes at the breakpoint`,
    );
  }
  const size = t.font[step]?.size?.[mode];
  if (typeof size !== 'number') {
    throw new Error(`Type step "${step}" has no ${mode} size to resolve its line height against`);
  }
  return Number(((size * lh.value) / 100).toFixed(4));
}

const lines = [];
const p = (s = '') => lines.push(s);
const block = (title) => {
  p();
  p(`  /* ${'─'.repeat(2)} ${title} ${'─'.repeat(Math.max(2, 66 - title.length))} */`);
};

p('/*');
p(' * Pushpin Design System — design tokens');
p(' *');
p(' * GENERATED FILE. Do not edit by hand.');
p(' * Source: Pushpin Thumbprint UI Kit, Figma file ' + t.source.fileKey);
p(' * Rebuild: node scripts/build-css.mjs');
p(' *');
p(' * Custom property names mirror Figma variable paths: the Figma variable');
p(' * `background/brand/strong` is `--pp-background-brand-strong` here.');
p(' */');
p();
p(':root {');

block('Base colors');
for (const [name, hex] of entries(t.baseColors)) p(`  --pp-color-${seg(name)}: ${hex};`);

block('Semantic colors (Light)');
for (const [name, modes] of entries(t.semanticColors)) p(`  --pp-${seg(name)}: ${value(modes.Light)};`);

block('Spacing');
for (const [k, v] of entries(t.space)) p(`  --pp-space-${k}: ${scalar(t.space, 'space', v)};`);

block('Corner radius');
for (const [k, v] of entries(t.cornerRadius)) {
  p(`  --pp-radius-${seg(k)}: ${scalar(t.cornerRadius, 'cornerRadius', v)};`);
}

block('Font family');
p('  --pp-font-family: "Thumbtack Rise", ui-sans-serif, system-ui, -apple-system,');
p('    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;');

block('Font weight');
for (const [k, v] of entries(t.fontWeight)) p(`  --pp-font-weight-${seg(k)}: ${v};`);

block(`Type scale (${t.font.$modes[0]} — see @media below for ${t.font.$modes[1]})`);
for (const [name, def] of entries(t.font)) {
  const m = t.font.$modes[0];
  p(`  --pp-font-size-${seg(name)}: ${px(def.size[m])};`);
  p(`  --pp-line-height-${seg(name)}: ${px(leadingPx(name, m))};`);
  p(`  --pp-font-weight-${seg(name)}: ${value(def.weight)};`);
}

block('Line height ratios');
for (const [k, v] of entries(t.lineHeight)) p(`  --pp-leading-${seg(k)}: ${v};`);

block('Letter spacing');
for (const [k, v] of entries(t.letterSpacing)) {
  p(`  --pp-tracking-${seg(k)}: ${scalar(t.letterSpacing, 'letterSpacing', v)};`);
}

block('Elevation');
for (const [k, v] of entries(t.shadow)) p(`  --pp-shadow-${k}: ${v};`);

block('Motion');
for (const [k, v] of entries(t.duration)) {
  p(`  --pp-duration-${k}: ${scalar(t.duration, 'duration', v)};`);
}
for (const [k, v] of entries(t.easing)) p(`  --pp-${seg(k)}: ${v};`);

block('Breakpoints');
for (const [k, v] of entries(t.breakpoint)) {
  p(`  --pp-breakpoint-${seg(k)}: ${scalar(t.breakpoint, 'breakpoint', v)};`);
}

block('Scrim, wrap, z-index');
for (const [k, v] of entries(t.scrim)) p(`  --pp-scrim-${seg(k)}: ${v};`);
for (const [k, v] of entries(t.wrap)) p(`  --pp-wrap-${seg(k)}: ${scalar(t.wrap, 'wrap', v)};`);
for (const [k, v] of entries(t.zIndex)) p(`  --pp-z-${seg(k)}: ${v};`);

p('}');

// Dark mode. Emitted twice: once for an explicit opt-in attribute, once for the
// OS preference, so a project can drive either without redefining tokens.
const darkDecls = entries(t.semanticColors).map(
  ([name, modes]) => `  --pp-${seg(name)}: ${value(modes.Dark)};`,
);
p();
p('/* Dark mode — the Figma "Dark" mode of Tokens / Semantic Colors. */');
p('[data-pp-theme="dark"] {');
darkDecls.forEach((d) => p(d));
p('}');
p();
p('@media (prefers-color-scheme: dark) {');
p('  :root:not([data-pp-theme="light"]) {');
darkDecls.forEach((d) => p(`  ${d}`));
p('  }');
p('}');

p();
p(`/* Desktop type scale — Figma's "${t.font.$modes[1]}" font mode. */`);
p(`@media (min-width: ${scalar(t.breakpoint, 'breakpoint', t.breakpoint[TYPE_BREAKPOINT])}) {`);
p('  :root {');
// A step is restated only where it moves. Both properties are tested rather
// than just the size, because leading is resolved from the style rather than
// read beside the size now: they move together while every style sets one
// percentage for both modes, and a step whose leading moved on its own would
// otherwise keep its mobile value above the breakpoint, silently.
for (const [name, def] of entries(t.font)) {
  const [native, desktop] = t.font.$modes;
  const size = px(def.size[desktop]);
  const leading = px(leadingPx(name, desktop));
  if (size === px(def.size[native]) && leading === px(leadingPx(name, native))) continue;
  p(`    --pp-font-size-${seg(name)}: ${size};`);
  p(`    --pp-line-height-${seg(name)}: ${leading};`);
}
p('  }');
p('}');

p();
p('/* Type ramp utilities. Class names match the Figma type scale. */');
for (const [name] of entries(t.font)) {
  p(`.pp-${seg(name)} {`);
  p(`  font-family: var(--pp-font-family);`);
  p(`  font-size: var(--pp-font-size-${seg(name)});`);
  p(`  line-height: var(--pp-line-height-${seg(name)});`);
  p(`  font-weight: var(--pp-font-weight-${seg(name)});`);
  const tracking = trackingToken(name);
  if (tracking) p(`  letter-spacing: var(--pp-tracking-${seg(tracking)});`);
  p('}');
}

const css = lines.join('\n') + '\n';

if (process.argv.includes('--check')) {
  const existing = readFileSync(OUT, 'utf8');
  if (existing !== css) {
    console.error('pushpin.css is stale — run: node scripts/build-css.mjs');
    process.exit(1);
  }
  console.log('pushpin.css is up to date.');
} else {
  writeFileSync(OUT, css);
  const count = css.match(/^\s*--pp-/gm)?.length ?? 0;
  console.log(`Wrote ${OUT} (${count} custom property declarations)`);
}

#!/usr/bin/env node
/**
 * Generates pushpin.css from tokens.figma.json.
 *
 * Custom property names mirror the Figma variable paths exactly, with `/`
 * replaced by `-`. `background/brand/strong` in Figma is
 * `--pp-background-brand-strong` here, so any value in a build can be traced
 * back to a variable in the kit by name alone.
 *
 * Usage: node scripts/build-css.mjs [--check]
 *   --check  exit non-zero if the committed CSS differs from a fresh build
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'assets', 'tokens.figma.json');
const OUT = join(here, '..', 'assets', 'pushpin.css');

/**
 * Figma models native and desktop as a platform axis. CSS has no such axis, so
 * the type scale is emitted mobile-first with desktop applied above this
 * breakpoint. This is the generator's only interpretive decision.
 */
const TYPE_BREAKPOINT = 'medium';

const t = JSON.parse(readFileSync(SRC, 'utf8'));
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

const px = (n) => (typeof n === 'number' ? `${n}px` : n);
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
for (const [k, v] of entries(t.space)) p(`  --pp-space-${k}: ${px(v)};`);

block('Corner radius');
for (const [k, v] of entries(t.cornerRadius)) p(`  --pp-radius-${seg(k)}: ${px(v)};`);

block('Font family');
p('  --pp-font-family: "Thumbtack Rise", ui-sans-serif, system-ui, -apple-system,');
p('    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;');

block('Font weight');
for (const [k, v] of entries(t.fontWeight)) p(`  --pp-font-weight-${seg(k)}: ${v};`);

block(`Type scale (${t.font.$modes[0]} — see @media below for ${t.font.$modes[1]})`);
for (const [name, def] of entries(t.font)) {
  const m = t.font.$modes[0];
  p(`  --pp-font-size-${seg(name)}: ${px(def.size[m])};`);
  p(`  --pp-line-height-${seg(name)}: ${px(def.lineHeight[m])};`);
  p(`  --pp-font-weight-${seg(name)}: ${value(def.weight)};`);
}

block('Line height ratios');
for (const [k, v] of entries(t.lineHeight)) p(`  --pp-leading-${seg(k)}: ${v};`);

block('Letter spacing');
for (const [k, v] of entries(t.letterSpacing)) p(`  --pp-tracking-${seg(k)}: ${px(v)};`);

block('Elevation');
for (const [k, v] of entries(t.shadow)) p(`  --pp-shadow-${k}: ${v};`);

block('Motion');
for (const [k, v] of entries(t.duration)) p(`  --pp-duration-${k}: ${v}ms;`);
for (const [k, v] of entries(t.easing)) p(`  --pp-${seg(k)}: ${v};`);

block('Breakpoints');
for (const [k, v] of entries(t.breakpoint)) p(`  --pp-breakpoint-${seg(k)}: ${px(v)};`);

block('Scrim, wrap, z-index');
for (const [k, v] of entries(t.scrim)) p(`  --pp-scrim-${seg(k)}: ${v};`);
for (const [k, v] of entries(t.wrap)) p(`  --pp-wrap-${seg(k)}: ${px(v)};`);
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
p(`@media (min-width: ${px(t.breakpoint[TYPE_BREAKPOINT])}) {`);
p('  :root {');
for (const [name, def] of entries(t.font)) {
  const m = t.font.$modes[1];
  if (def.size[m] !== def.size[t.font.$modes[0]]) {
    p(`    --pp-font-size-${seg(name)}: ${px(def.size[m])};`);
    p(`    --pp-line-height-${seg(name)}: ${px(def.lineHeight[m])};`);
  }
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
  if (name.startsWith('title') || name === 'hero') {
    p(`  letter-spacing: var(--pp-tracking-tight);`);
  }
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

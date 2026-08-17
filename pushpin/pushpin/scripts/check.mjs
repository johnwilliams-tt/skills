#!/usr/bin/env node
/**
 * Reports what is off-system in a file or directory. Advisory: it prints
 * findings and changes nothing.
 *
 * Two classes, matching reference/tokens.md § Checking code:
 *
 * - **Token findings** — a value that bypassed a token. Where an impeccable hook
 *   is actually installed, its detector already reports these live from the same
 *   ramps in the generated DESIGN.md, so `--component-only` turns them off rather
 *   than saying everything twice. That is the uncommon case — impeccable's hook
 *   installer only acts on projects holding a provider folder of its own — so
 *   this half is usually ours to report, and `impeccableIsLive` reads the
 *   manifests rather than assuming either way.
 * - **Component identity** — markup that reads as a published component while
 *   declaring nothing, and declarations that name nothing real. This is the
 *   half no token allowlist can express, and the half impeccable structurally
 *   cannot do: it knows the ramps, it does not know the component catalog.
 *
 * Usage: node scripts/check.mjs <paths...> [--json] [--brief] [--component-only]
 *
 * Exits 1 when anything is found, so it can gate a commit. The hook that runs
 * it on every edit ignores the exit code and relays `--brief`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { TOKEN_GROUPS, loadAsset, real, resolveHex } from './lib/tokens.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const asJson = has('--json');
const brief = has('--brief');
const paths = argv.filter((a) => !a.startsWith('--'));

if (has('--help') || has('-h') || !paths.length) {
  console.log(
    'usage: node scripts/check.mjs <paths...> [--json] [--brief] [--component-only]\n\n' +
      'Reports off-system values and undeclared component lookalikes. Changes nothing.\n\n' +
      '  --component-only  skip the token findings. Default in a project where\n' +
      "                    impeccable's detector is already reporting them live.\n" +
      '  --brief           the short form the edit hook relays; silent when clean.\n' +
      '  --json            findings as structured data.',
  );
  process.exit(paths.length ? 0 : 1);
}

// ------------------------------------------------------------------ the kit

const tokens = loadAsset('tokens.figma.json');
const catalog = loadAsset('components.figma.json').components;

const SPACE = new Set(real(tokens.space).map(([, px]) => px));
const FONT_SIZES = new Set(real(tokens.font).flatMap(([, s]) => Object.values(s.size ?? {})));
const WEIGHTS = new Set(real(tokens.fontWeight).map(([, w]) => w));
const RADII = new Set(real(tokens.cornerRadius).map(([, v]) => v).filter((v) => typeof v === 'number'));
const PILL = tokens.cornerRadius.sides;

/** Every brand-strong-ish fill, so a lookalike can be recognised by its colour. */
const BRAND_HEXES = new Set(
  ['background/brand/strong', 'background/brand/default', 'background/brand/low']
    .flatMap((p) => ['Light', 'Dark'].map((m) => resolveHex(tokens, p, m)))
    .filter(Boolean)
    .map((h) => h.toLowerCase()),
);

const COMPONENT_NAMES = Object.keys(catalog).filter((k) => !k.startsWith('$'));

// ------------------------------------------------------------------- context

/**
 * Whether impeccable is already reporting the token half live.
 *
 * Repeating a finding the user is seeing anyway is how a check gets ignored,
 * so this defaults to component-only exactly where the overlap is real:
 * `init` wrote the sidecar and an impeccable hook is installed to read it.
 */
function impeccableIsLive(root) {
  if (!existsSync(join(root, '.impeccable', 'design.json'))) return false;
  const manifests = [
    join(root, '.cursor', 'hooks.json'),
    join(root, '.claude', 'settings.local.json'),
    join(root, '.claude', 'settings.json'),
  ];
  return manifests.some(
    (m) => existsSync(m) && /impeccable/i.test(readFileSync(m, 'utf8')),
  );
}

/** A project on Thumbprint's React components declares nothing and needs nothing. */
function usesThumbprint(root) {
  const pkg = join(root, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    const p = JSON.parse(readFileSync(pkg, 'utf8'));
    return Object.keys({ ...p.dependencies, ...p.devDependencies }).some((d) =>
      d.includes('thumbprint'),
    );
  } catch {
    return false;
  }
}

const ROOT = process.cwd();
const IMPECCABLE_LIVE = impeccableIsLive(ROOT);
const COMPONENT_ONLY = has('--component-only') || IMPECCABLE_LIVE;
const SKIP_IDENTITY = usesThumbprint(ROOT);

// ------------------------------------------------------------------- walking

const EXT = new Set([
  '.css', '.scss', '.sass', '.less',
  '.js', '.jsx', '.ts', '.tsx',
  '.html', '.vue', '.svelte', '.astro',
]);
const SKIP_DIR = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', 'vendor', '.svelte-kit', '.turbo', '.cache',
]);

function collect(p, into) {
  const s = statSync(p);
  if (s.isDirectory()) {
    if (SKIP_DIR.has(basename(p))) return;
    for (const e of readdirSync(p)) collect(join(p, e), into);
    return;
  }
  if (EXT.has(extname(p))) into.push(p);
}

const files = [];
for (const p of paths) {
  const abs = resolve(p);
  if (!existsSync(abs)) {
    console.error(`No such path: ${p}`);
    process.exit(1);
  }
  collect(abs, files);
}

// ------------------------------------------------------------------ scanning

const findings = [];
const add = (file, line, rule, message) =>
  findings.push({ file, line, rule, message });

/**
 * Blank out comments and the contents of url() so a hex in either does not read
 * as a value someone chose. Positions are preserved so line numbers stay true.
 */
function mask(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
    .replace(/url\([^)]*\)/g, (m) => ' '.repeat(m.length));
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** The generated stylesheet is the token definitions; every hex in it is the point. */
const isGenerated = (file, src) =>
  basename(file) === 'pushpin.css' || src.startsWith('/*\n * Pushpin Design System');

const CONTROL = /\b(button|btn|input|textarea|select|chip|pill|tag|search|combobox|switch|toggle)\b/i;

function checkTokens(file, src) {
  const s = mask(src);

  // Raw colour. A hex is flagged whether or not it matches a ramp: matching one
  // means the token exists and was bypassed, which is the more interesting bug.
  for (const m of s.matchAll(/(?<![=]["'`])#([0-9a-fA-F]{3,8})\b/g)) {
    if (![3, 4, 6, 8].includes(m[1].length)) continue;
    add(file, lineOf(s, m.index), 'raw-color', `\`#${m[1]}\` is a literal; use a --pp-* token`);
  }
  for (const m of s.matchAll(/\b(?:rgba?|hsla?)\(\s*[\d.]+/g)) {
    add(file, lineOf(s, m.index), 'raw-color', `\`${m[0].trim()}…\` is a literal; use a --pp-* token`);
  }

  // Pure black on text.
  for (const m of s.matchAll(/(?:^|[^-\w])color\s*:\s*(#000{1,2}|#000000|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi)) {
    add(file, lineOf(s, m.index), 'pure-black-text',
      `body text is --pp-text-neutral-default (#1f2022), never pure black`);
  }

  // Spacing off the 13-step scale.
  for (const m of s.matchAll(/\b(padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*([^;{}\n]+)/gi)) {
    const decl = m[2];
    if (decl.includes('var(')) continue;
    for (const v of decl.matchAll(/(-?\d*\.?\d+)px/g)) {
      const px = Math.abs(Number(v[1]));
      if (px === 0 || SPACE.has(px)) continue;
      add(file, lineOf(s, m.index), 'off-scale-spacing',
        `${m[1]} ${v[0]} is not a --pp-space-* step`);
    }
  }

  // Type off the ramp.
  for (const m of s.matchAll(/\bfont-size\s*:\s*([^;{}\n]+)/gi)) {
    if (m[1].includes('var(')) continue;
    const v = m[1].match(/(\d*\.?\d+)px/);
    if (v && !FONT_SIZES.has(Number(v[1]))) {
      add(file, lineOf(s, m.index), 'off-ramp-type', `font-size ${v[0]} is not a ramp step`);
    }
  }
  for (const m of s.matchAll(/\bfont-weight\s*:\s*([^;{}\n]+)/gi)) {
    if (m[1].includes('var(')) continue;
    const v = m[1].match(/\b(\d{3})\b/);
    if (v && !WEIGHTS.has(Number(v[1]))) {
      add(file, lineOf(s, m.index), 'off-ramp-weight',
        `weight ${v[1]} is outside 400 / 563 / 590 / 660 / 700`);
    }
  }
  for (const m of s.matchAll(/\bfont-family\s*:\s*([^;{}\n]+)/gi)) {
    if (m[1].includes('var(') || /Thumbtack Rise/i.test(m[1])) continue;
    add(file, lineOf(s, m.index), 'off-family',
      `not Thumbtack Rise; use var(--pp-font-family)`);
  }

  // Square corners on a control. Only where a radius was actually declared —
  // a missing one may be inherited or composed, and guessing there is noise.
  for (const m of s.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const [, selector, body] = m;
    if (!CONTROL.test(selector)) continue;
    const r = body.match(/border-radius\s*:\s*([^;}\n]+)/i);
    if (!r || /--pp-radius-sides/.test(r[1])) continue;
    const px = r[1].match(/(\d*\.?\d+)px/);
    if (px && Number(px[1]) >= PILL) continue;
    if (/\b(50|100)%|9999/.test(r[1])) continue;
    add(file, lineOf(s, m.index + m[0].indexOf(r[0])), 'square-control',
      `${selector.trim().split('\n').pop().trim()} sets border-radius: ${r[1].trim()} — controls are --pp-radius-sides`);
  }
}

// -------------------------------------------------------- component identity

/** Levenshtein, capped, for suggesting the name that was probably meant. */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const nearest = (name) => {
  const [best] = COMPONENT_NAMES.map((n) => [n, distance(name.toLowerCase(), n.toLowerCase())])
    .filter(([, d]) => d <= 3)
    .sort((a, b) => a[1] - b[1]);
  return best?.[0];
};

/** An opening tag with its attributes, which is all either identity check needs. */
const TAGS = /<([a-zA-Z][\w.-]*)((?:\s+[^<>]*?)?)\/?>/g;

function checkIdentity(file, src) {
  const s = mask(src);

  for (const m of s.matchAll(TAGS)) {
    const [whole, tag, attrs = ''] = m;
    const line = lineOf(s, m.index);
    const declared = /data-pp-component\s*=/.test(attrs);
    const proposed = /data-pp-proposed\s*=/.test(attrs);

    // A declaration that names nothing real. The push discards these silently;
    // this is where it gets said out loud.
    const name = attrs.match(/data-pp-component\s*=\s*["'{]?\s*["']?([^"'}\s>]+)/);
    if (name) {
      const entry = catalog[name[1]];
      if (!entry) {
        const near = nearest(name[1]);
        add(file, line, 'unknown-component',
          `data-pp-component="${name[1]}" is not in the catalog${near ? ` — did you mean "${near}"?` : ''}`);
      } else {
        const variants = attrs.match(/data-pp-variant\s*=\s*["'{]?\s*["']([^"']+)/);
        if (variants) checkVariants(file, line, name[1], entry, variants[1]);
      }
    }

    if (SKIP_IDENTITY || declared || proposed) continue;

    // An undeclared lookalike. Two signals are required rather than one: a
    // single rounded div is a rounded div, and flagging every one of those is
    // how a check earns being turned off.
    const signals = lookalikeSignals(tag, attrs);
    if (signals.length >= 2) {
      add(file, line, 'undeclared-lookalike',
        `<${tag}> reads as a published component (${signals.join(', ')}) but declares neither ` +
          `data-pp-component nor data-pp-proposed`);
    }
    void whole;
  }
}

function lookalikeSignals(tag, attrs) {
  const out = [];
  const pill = /rounded-full|border-radius\s*:\s*9999|borderRadius\s*:\s*['"]?9999|--pp-radius-sides/i.test(attrs);
  const brandFill =
    [...attrs.matchAll(/#([0-9a-fA-F]{3,8})\b/g)].some((h) => BRAND_HEXES.has(`#${h[1].toLowerCase()}`)) ||
    /--pp-background-brand-strong/.test(attrs);
  const clickable = /\bonClick|role\s*=\s*["']?button|\bhref\s*=/.test(attrs) || /^(button|a)$/i.test(tag);
  const inputish = /^(input|textarea)$/i.test(tag) || /role\s*=\s*["']?(textbox|combobox|searchbox)/.test(attrs);
  const bordered = /\bborder(?!-radius)/i.test(attrs);

  if (pill) out.push('pill radius');
  if (brandFill) out.push('brand-strong fill');
  if (clickable) out.push('clickable');
  if (inputish) out.push('input semantics');
  if (inputish && bordered) out.push('bordered');
  return out;
}

function checkVariants(file, line, name, entry, spec) {
  for (const pair of spec.split(',')) {
    const [k, v] = pair.split('=').map((x) => x?.trim());
    if (!k || v === undefined) continue;
    const prop = entry.properties?.[k];
    if (!prop) {
      add(file, line, 'unknown-variant', `${name} has no property "${k}"`);
      continue;
    }
    if (Array.isArray(prop.options) && !prop.options.includes(v)) {
      add(file, line, 'unknown-variant',
        `${name}.${k} has no option "${v}" — one of ${prop.options.join(' | ')}`);
    }
  }
}

// --------------------------------------------------------------------- run

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (isGenerated(file, src)) continue;
  const r = relative(ROOT, file);
  const rel = !r || r.startsWith('..') ? file : r;
  if (!COMPONENT_ONLY) checkTokens(rel, src);
  checkIdentity(rel, src);
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// ------------------------------------------------------------------ report

if (asJson) {
  console.log(JSON.stringify({ findings, files: files.length, componentOnly: COMPONENT_ONLY }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

if (!findings.length) {
  if (!brief) console.log(`Nothing off-system in ${files.length} file(s).`);
  process.exit(0);
}

if (brief) {
  // The hook relays this verbatim, so it is short and it leads with the count.
  const shown = findings.slice(0, 8);
  console.log(`Pushpin: ${findings.length} off-system finding(s).`);
  for (const f of shown) console.log(`  ${f.file}:${f.line}  ${f.message}`);
  if (findings.length > shown.length) {
    console.log(`  …and ${findings.length - shown.length} more — node scripts/check.mjs <path>`);
  }
  process.exit(1);
}

let current = null;
for (const f of findings) {
  if (f.file !== current) {
    console.log(`\n${f.file}`);
    current = f.file;
  }
  console.log(`  ${String(f.line).padStart(4)}  ${f.rule.padEnd(20)} ${f.message}`);
}

const byRule = findings.reduce((a, f) => ((a[f.rule] = (a[f.rule] ?? 0) + 1), a), {});
console.log(
  `\n${findings.length} finding(s) across ${files.length} file(s): ` +
    Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(', '),
);
if (IMPECCABLE_LIVE) {
  console.log("Token findings skipped — impeccable's detector is reporting those live.");
} else if (COMPONENT_ONLY) {
  console.log('Token findings skipped — --component-only.');
}
process.exit(1);

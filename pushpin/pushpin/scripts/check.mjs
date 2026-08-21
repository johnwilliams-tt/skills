#!/usr/bin/env node
/**
 * Reports what is off-system in a file or directory. Advisory: it prints
 * findings and changes nothing.
 *
 * Three classes, matching reference/audit.md § A repo or a file of code:
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
 * - **Copy findings** — text that breaks the content design rules, from the
 *   engine in lib/copy.mjs and only the codes it can decide without a human.
 *   Scoped to markup text and the props holding words a person reads, never to
 *   identifiers, imports or URLs: a copy check that fires on a variable name is
 *   one people switch off, so it says nothing about any region it did not fully
 *   understand. `--no-copy` turns it off. `--component-only` does not, because
 *   that flag exists to stop repeating what impeccable is already saying live
 *   and impeccable says nothing about copy — suppressing it there would drop
 *   findings nothing else in the project reports.
 *
 * Everything printed here is worth fixing, so no severity column appears. The
 * one tier louder than the rest is the copy rubric's `critical`, and that is
 * the only one said out loud, inline in the message it belongs to.
 *
 * Usage: node scripts/check.mjs <paths...> [--json] [--brief] [--component-only] [--no-copy]
 *
 * Exits 1 when anything is found, so it can gate a commit. The hook that runs
 * it on every edit ignores the exit code and relays `--brief`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import {
  binding,
  isBinding,
  loadSpecs,
  parseSelector,
  restingVariant,
  unknownPairs,
  variantForAll,
} from './lib/specs.mjs';
import { TOKEN_GROUPS, loadAsset, real, resolveHex } from './lib/tokens.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const asJson = has('--json');
const brief = has('--brief');
const paths = argv.filter((a) => !a.startsWith('--'));
const wantsHelp = has('--help') || has('-h');

if (wantsHelp || !paths.length) {
  console.log(
    'usage: node scripts/check.mjs <paths...> [--json] [--brief] [--component-only] [--no-copy]\n\n' +
      'Reports off-system values, undeclared component lookalikes and off-guideline\n' +
      'copy. Changes nothing.\n\n' +
      '  --component-only  skip the token findings. Default in a project where\n' +
      "                    impeccable's detector is already reporting them live.\n" +
      '                    Copy findings survive it; nothing else reports those.\n' +
      '  --no-copy         skip the copy findings.\n' +
      '  --brief           the short form the edit hook relays; silent when clean.\n' +
      '  --json            findings as structured data.',
  );
  process.exit(wantsHelp ? 0 : 1);
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
const COPY_ON = !has('--no-copy');
const SKIP_IDENTITY = usesThumbprint(ROOT);

/** Loaded with the class, so --no-copy also costs nothing to parse copy.json. */
const { scan } = COPY_ON ? await import('./lib/copy.mjs') : { scan: null };

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

/**
 * `copy` is a finding from the engine, whose rubric code and tier ride along.
 * The other two classes have neither, so carrying the code is also how the
 * report tells a copy finding apart from the rest.
 */
const add = (file, line, rule, message, copy = null) =>
  findings.push({ file, line, rule, message, ...(copy && { code: copy.code, severity: copy.severity }) });

const isCopyFinding = (f) => Boolean(f.code);
const isCritical = (f) => f.severity === 'critical';

/** Criticals are the only tier named, and named where the message is read. */
const say = (f) => (isCritical(f) ? `critical: ${f.message}` : f.message);

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

/** The attributes worth reading out of a tag, compiled once rather than per tag. */
const ATTR = new Map(
  ['data-pp-component', 'label', 'title', 'placeholder', 'aria-label', 'alt'].map((n) => [
    n,
    new RegExp(`(?:^|[\\s{])${n}\\s*=\\s*\\{?\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  ]),
);

/**
 * A quoted attribute value with its offset inside `attrs`, or null.
 *
 * Quoted literals only: a value the file computes at runtime is not a name or a
 * string this can read. Taken whole rather than up to the first space, because
 * catalog names carry both ("Icon Button", "Modal / Confirmation").
 */
function attrValue(attrs, name) {
  const m = ATTR.get(name).exec(attrs);
  if (!m) return null;
  const value = m[1] ?? m[2];
  return { value, at: m.index + m[0].length - value.length - 1 };
}

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
    const name = attrValue(attrs, 'data-pp-component')?.value;
    if (name) {
      const entry = catalog[name];
      if (!entry) {
        const near = nearest(name);
        add(file, line, 'unknown-component',
          `data-pp-component="${name}" is not in the catalog${near ? ` — did you mean "${near}"?` : ''}`);
      } else {
        const variants = attrs.match(/data-pp-variant\s*=\s*["'{]?\s*["']([^"']+)/);
        if (variants) checkVariants(file, line, name, entry, variants[1], attrs);
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

function checkVariants(file, line, name, entry, spec, attrs) {
  let valid = true;
  for (const pair of spec.split(',')) {
    const [k, v] = pair.split('=').map((x) => x?.trim());
    if (!k || v === undefined) continue;
    const prop = entry.properties?.[k];
    if (!prop) {
      add(file, line, 'unknown-variant', `${name} has no property "${k}"`);
      valid = false;
      continue;
    }
    if (Array.isArray(prop.options) && !prop.options.includes(v)) {
      add(file, line, 'unknown-variant',
        `${name}.${k} has no option "${v}" — one of ${prop.options.join(' | ')}`);
      valid = false;
    }
  }
  // A selector that names something unpublished has already been reported, and
  // measuring a declaration against a variant that does not exist would report
  // the same mistake a second time in a more confusing form.
  if (valid) checkFidelity(file, line, name, spec, attrs);
}

// -------------------------------------------------------- declared fidelity

/**
 * Whether a declared variant looks like the variant it declares.
 *
 * `data-pp-variant="theme=secondary"` has until now been checked only for
 * naming something real. A tag can say `theme=secondary` and paint itself any
 * colour at all, which is precisely what happened: a hand-rolled secondary
 * button carried a border the kit does not publish and missed the one it does,
 * and every check in the repo passed.
 *
 * Only the declarations this can actually resolve are compared — an inline
 * `style`, a `style={{…}}` prop on the declaring tag, and a class rule found in
 * the scanned files. Everything else is silence, the same discipline the copy
 * check holds: a fidelity check that guesses at a computed class name is one
 * people switch off, and then it reports nothing at all.
 */
const specs = loadSpecs();

/**
 * Class rules gathered from every scanned stylesheet, as `[classes, decls]`.
 *
 * Only unconditional, purely-class selectors are kept. A descendant or
 * pseudo-class selector applies under conditions this cannot evaluate, and a
 * rule inside `@media` is usually a deliberate override at another breakpoint,
 * so measuring the kit against either would report a difference that is not a
 * defect.
 */
const CLASS_RULES = [];

const CLASS_ONLY = /^(?:\.[-\w]+)+$/;

/** Every `{…}` block with its prelude and the at-rules it sits inside. */
function eachBlock(s, fn) {
  const stack = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') {
      stack.push(s.slice(start, i).trim());
      start = i + 1;
    } else if (s[i] === '}') {
      const prelude = stack.pop();
      if (prelude !== undefined) fn(stack, prelude, s.slice(start, i));
      start = i + 1;
    }
  }
}

function indexStylesheet(src) {
  eachBlock(mask(src), (ancestors, prelude, body) => {
    if (prelude.startsWith('@') || body.includes('{')) return;
    if (ancestors.some((a) => a.startsWith('@'))) return;
    const decls = parseDecls(body);
    if (!decls.size) return;
    for (const sel of prelude.split(',')) {
      const one = sel.trim();
      if (!CLASS_ONLY.test(one)) continue;
      CLASS_RULES.push([new Set(one.split('.').filter(Boolean)), decls]);
    }
  });
}

/** `a: b; c: d` as a map, last declaration winning as the cascade does. */
function parseDecls(body) {
  const out = new Map();
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at < 1) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    if (/^[-a-z]+$/.test(prop) && value) out.set(prop, value);
  }
  return out;
}

const KEBAB = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * A `style={{…}}` prop. React writes a bare number as pixels, so a `height: 40`
 * there means the same thing as `height: 40px` in a stylesheet.
 */
function parseStyleObject(text) {
  const out = new Map();
  for (const m of text.matchAll(/([A-Za-z][\w]*|'[^']+'|"[^"]+")\s*:\s*('[^']*'|"[^"]*"|[-\d.]+)/g)) {
    const key = KEBAB(m[1].replace(/['"]/g, ''));
    const raw = m[2];
    out.set(key, /^['"]/.test(raw) ? raw.slice(1, -1) : `${raw}px`);
  }
  return out;
}

/** Every declaration reachable for one tag, in cascade order. */
function declarationsFor(attrs) {
  const out = new Map();
  const classes = attrs.match(/\bclass(?:Name)?\s*=\s*["']([^"']*)["']/);
  if (classes) {
    const on = new Set(classes[1].split(/\s+/).filter(Boolean));
    for (const [need, decls] of CLASS_RULES) {
      if ([...need].every((c) => on.has(c))) for (const [k, v] of decls) out.set(k, v);
    }
  }
  const inline = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/);
  if (inline) for (const [k, v] of parseDecls(inline[1])) out.set(k, v);
  const obj = attrs.match(/\bstyle\s*=\s*\{\{([\s\S]*?)\}\}/);
  if (obj) for (const [k, v] of parseStyleObject(obj[1])) out.set(k, v);
  return out;
}

/**
 * CSS properties that can be measured against a captured field, and how.
 *
 * Width is absent on purpose: a Pushpin control hugs its label, so the width
 * recorded for a variant is the width of the word inside it and comparing
 * against it would flag every button with a different label. Height is here
 * only when the kit fixed it, for the same reason.
 */
const FIDELITY = [
  ['background-color', 'fill', 'color'],
  ['background', 'fill', 'color'],
  ['border-color', 'stroke', 'color'],
  ['border-width', 'strokeWeight', 'length'],
  ['border-radius', 'radius', 'length'],
  ['gap', 'gap', 'length'],
  ['padding', 'padding', 'length'],
  ['height', 'height', 'length'],
  ['color', 'text.fill', 'color'],
  ['font-size', 'text.size', 'length'],
];

/** `#abc` and `#aabbccff` are the same colour as `#aabbcc`. */
function normHex(v) {
  const m = String(v).trim().toLowerCase().match(/^#([0-9a-f]{3,8})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length === 8 && h.endsWith('ff')) h = h.slice(0, 6);
  return h.length === 6 || h.length === 8 ? `#${h}` : null;
}

/** The captured value for a field, or null where there is nothing to compare. */
function wantOf(variant, field) {
  let v = field === 'height' ? variant.size?.[1] : null;
  if (field === 'height' && variant.sizing && variant.sizing[1] !== 'FIXED') return null;
  if (field.startsWith('text.')) v = variant.text?.[field.slice(5)];
  else if (field !== 'height') v = variant[field];
  if (v === null || v === undefined) return null;
  // Four sides that disagree are four declarations, not one, and the shorthand
  // this would be compared against may be writing any subset of them.
  if (!isBinding(v) && Array.isArray(v)) return null;
  const b = binding(tokens, v);
  return b ? { css: b.css, literal: b.literal } : { css: null, literal: v };
}

/**
 * True, false, or null for "cannot tell" — and null is by far the most common,
 * which is the point.
 */
function agrees(decl, want, kind) {
  const v = String(decl).trim().toLowerCase();
  const ref = v.match(/var\(\s*(--[\w-]+)/);
  // A token reference is compared by name, because the name is the decision.
  // Where the kit binds a variable Pushpin does not publish there is no name to
  // compare against and no basis for calling the consumer wrong.
  if (ref) return want.css ? ref[1] === want.css : null;
  if (want.literal === null || want.literal === undefined) return null;
  if (kind === 'color') {
    const got = normHex(v);
    const expected = normHex(want.literal);
    return got && expected ? got === expected : null;
  }
  if (typeof want.literal !== 'number') return null;
  const px = v.match(/^(-?\d*\.?\d+)(?:px)?$/);
  // A rem or a percentage depends on a root size or a parent this cannot see.
  if (!px) return null;
  return Math.abs(Number(px[1]) - want.literal) < 0.5;
}

/** How the kit's value reads in a message. */
const kitValue = (want, kind) =>
  want.css
    ? `var(${want.css})${want.literal === null ? '' : ` (${want.literal}${kind === 'length' ? 'px' : ''})`}`
    : `${want.literal}${kind === 'length' && typeof want.literal === 'number' ? 'px' : ''}`;

function checkFidelity(file, line, name, selector, attrs) {
  if (!specs || !attrs) return;
  const set = specs.components?.[name];
  if (!set) return;

  const pairs = parseSelector(selector);
  if (unknownPairs(set, pairs).length) return;
  const variant = pairs.length ? variantForAll(set, pairs) : restingVariant(set);
  if (!variant) return;

  const declared = declarationsFor(attrs);
  if (!declared.size) return;

  for (const [prop, field, kind] of FIDELITY) {
    const decl = declared.get(prop);
    if (decl === undefined) continue;
    const want = wantOf(variant, field);
    if (!want) continue;
    if (agrees(decl, want, kind) !== false) continue;
    add(file, line, 'variant-drift',
      `${name} ${selector} declares ${prop}: ${decl.trim()} — the kit's is ${kitValue(want, kind)}`);
  }
}

// --------------------------------------------------------------------- copy

/** Only the files that can hold markup; a stylesheet has no text nodes. */
const MARKUP_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.vue', '.svelte', '.astro']);

/** Props that hold words a person reads. Children are the walk below. */
const TEXT_PROPS = ['label', 'title', 'placeholder', 'aria-label', 'alt'];

/** Elements whose contents are code rather than copy. */
const OPAQUE = new Set(['script', 'style', 'code', 'pre']);

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * A tag, with attribute values that carry their own quotes or braces — an
 * arrow function inside one holds a `>` that would otherwise end the tag three
 * characters in. Three levels of nesting covers real JSX; anything deeper is
 * not recognised as a tag at all, and the guard below is what keeps that from
 * turning into a finding.
 */
const brace = (depth) => (depth ? `\\{(?:[^{}]|${brace(depth - 1)})*\\}` : '\\{[^{}]*\\}');
const MARKUP = new RegExp(`<(/?)([a-zA-Z][\\w.:-]*)((?:'[^']*'|"[^"]*"|${brace(2)}|[^<>'"{])*)>`, 'g');
const EXPRESSION = new RegExp(brace(2), 'g');

/**
 * Text that is a URL, an identifier, or a region holding something this did not
 * parse. A leftover `<` or `{` means an unrecognised tag or expression is in
 * there, and the honest answer about a region we do not understand is nothing.
 */
const NOT_COPY = /[<{}]|^(?:https?:|mailto:|tel:|[./#])|^\S*[._/\\]\S*$|^[A-Z0-9_]+$|^\S*[a-z][A-Z]\S*$/;

const isCopy = (text) => /[A-Za-z]{2}/.test(text) && !NOT_COPY.test(text.trim());

/**
 * Copy in a file's markup.
 *
 * Text is held until its element closes, so an opening tag that never closes —
 * a TypeScript generic, `Array<Item>` — takes the code that follows it down
 * with it instead of being read as the paragraph it is not.
 *
 * The length code needs a component, and it is applied only where the text's
 * immediate parent declares one. A declaration on a wrapper says which
 * component the region is, not which slot inside it any one line fills, and
 * measuring a heading against a modal's body limit is the kind of finding that
 * costs more than it buys.
 */
function checkCopy(file, src) {
  const s = mask(src).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const stack = [];
  let cursor = 0;

  for (const m of s.matchAll(MARKUP)) {
    const [whole, closing, tag, attrs = ''] = m;
    const open = stack[stack.length - 1];
    if (open && !open.opaque && cursor < m.index) {
      open.text.push({ body: s.slice(cursor, m.index), at: cursor });
    }
    cursor = m.index + whole.length;

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag !== tag) continue;
        const [el] = stack.splice(i);
        for (const t of el.text) scanCopy(file, s, t.body, t.at, el.component);
        break;
      }
      continue;
    }

    const opaque = Boolean(open?.opaque) || OPAQUE.has(tag.toLowerCase());
    const component = attrValue(attrs, 'data-pp-component')?.value ?? null;
    const attrsAt = m.index + 1 + tag.length;
    if (!opaque) {
      for (const prop of TEXT_PROPS) {
        const v = attrValue(attrs, prop);
        if (v) scanCopy(file, s, v.value, attrsAt + v.at, component);
      }
    }

    if (/\/\s*$/.test(attrs) || VOID.has(tag.toLowerCase())) continue;
    stack.push({ tag, component, opaque, text: [] });
  }
}

/**
 * One run of text against the engine. Interpolations are blanked rather than
 * guessed at — what `{name}` renders is unknown here, and undercounting a
 * length is the side of that to be wrong on.
 */
function scanCopy(file, src, text, at, component) {
  const body = text.replace(EXPRESSION, (m) => m.replace(/[^\n]/g, ' '));
  if (!isCopy(body)) return;
  const found = scan(body, { component });
  if (!found.length) return;
  const base = lineOf(src, at);
  for (const f of found) add(file, base + f.line - 1, f.rule, f.message, f);
}

// --------------------------------------------------------------------- run

/** Where a class rule can live: a stylesheet, or a single-file component's `<style>`. */
const STYLE_EXT = new Set(['.css', '.scss', '.sass', '.less']);
const EMBEDS_STYLE = new Set(['.vue', '.svelte', '.astro']);

/**
 * Every source is read and every stylesheet indexed before anything is
 * reported. The class named on a tag in one file is defined in another, and a
 * fidelity check that only saw the files already walked would answer differently
 * depending on the order the directory happened to list them in.
 */
const sources = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (isGenerated(file, src)) continue;
  const r = relative(ROOT, file);
  sources.push([file, !r || r.startsWith('..') ? file : r, src]);

  const ext = extname(file);
  if (STYLE_EXT.has(ext)) indexStylesheet(src);
  else if (EMBEDS_STYLE.has(ext)) {
    for (const m of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) indexStylesheet(m[1]);
  }
}

for (const [file, rel, src] of sources) {
  if (!COMPONENT_ONLY) checkTokens(rel, src);
  checkIdentity(rel, src);
  if (COPY_ON && MARKUP_EXT.has(extname(file))) checkCopy(rel, src);
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// ------------------------------------------------------------------ report

const criticals = findings.filter(isCritical).length;

if (asJson) {
  console.log(
    JSON.stringify(
      { findings, files: files.length, componentOnly: COMPONENT_ONLY, copy: COPY_ON },
      null,
      2,
    ),
  );
  process.exit(findings.length ? 1 : 0);
}

if (!findings.length) {
  if (!brief) console.log(`Nothing off-system in ${files.length} file(s).`);
  process.exit(0);
}

if (brief) {
  // The hook relays this verbatim, so it is short and it leads with the count.
  // Criticals are picked before the list is cut, then put back in file order.
  const shown = [...findings]
    .sort((a, b) => Number(isCritical(b)) - Number(isCritical(a)))
    .slice(0, 8)
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  console.log(
    `Pushpin: ${findings.length} off-system finding(s)${criticals ? `, ${criticals} critical` : ''}.`,
  );
  for (const f of shown) console.log(`  ${f.file}:${f.line}  ${say(f)}`);
  if (findings.length > shown.length) {
    console.log(`  …and ${findings.length - shown.length} more — node scripts/check.mjs <path>`);
  }
  // Which doc answers what fired. The hook takes this line for its sign-off
  // and drops it, so it is last and it is the only line shaped like this.
  console.log(
    'Docs: ' +
      [
        findings.some((f) => !isCopyFinding(f)) && 'reference/rules.md',
        findings.some(isCopyFinding) && 'reference/copy.md',
      ]
        .filter(Boolean)
        .join(', '),
  );
  process.exit(1);
}

let current = null;
for (const f of findings) {
  if (f.file !== current) {
    console.log(`\n${f.file}`);
    current = f.file;
  }
  console.log(`  ${String(f.line).padStart(4)}  ${f.rule.padEnd(20)} ${say(f)}`);
}

const byRule = findings.reduce((a, f) => ((a[f.rule] = (a[f.rule] ?? 0) + 1), a), {});
console.log(
  `\n${findings.length} finding(s) across ${files.length} file(s): ` +
    Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(', ') +
    (criticals ? ` — ${criticals} critical` : ''),
);
if (IMPECCABLE_LIVE) {
  console.log("Token findings skipped — impeccable's detector is reporting those live.");
} else if (COMPONENT_ONLY) {
  console.log('Token findings skipped — --component-only.');
}
if (!COPY_ON) console.log('Copy findings skipped — --no-copy.');
process.exit(1);

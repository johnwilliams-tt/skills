#!/usr/bin/env node
/**
 * Answers one question about the catalogs without reading them.
 *
 * The five files in `assets/` total about 230 KB, and reading one to find out
 * that Button's text property is `Label#13326:0` costs roughly a hundred times
 * what the answer is worth. Every entry is small — the median component is 380
 * bytes — so the expensive part was never the fact, it was the file it lives
 * in.
 *
 * Names are case-sensitive and not guessable, which is the other half of why
 * this exists: `Button`, `Icon Button`, and `Brand / App / Download Buttons`
 * are three different entries, and a near-miss is answered with the real names
 * rather than nothing.
 *
 * Usage:
 *   node scripts/lookup.mjs Button              # every catalog
 *   node scripts/lookup.mjs --component Button  # narrow to one
 *   node scripts/lookup.mjs Button,Card,Checkbox   # several, one call
 *   node scripts/lookup.mjs --icon caret
 *   node scripts/lookup.mjs --token radius
 *   node scripts/lookup.mjs --style title
 *   node scripts/lookup.mjs --annotation pointer
 *   node scripts/lookup.mjs --list --component  # names only, no detail
 *   node scripts/lookup.mjs --json Button
 *
 * An exact name match prints that entry alone. Otherwise every substring match
 * is printed, capped per kind unless `--all` is passed.
 *
 * Composing a layout needs a dozen of these, so terms are comma-separated and
 * answered in one run. Spaces cannot separate them — `Icon Button` is one name —
 * and no name in any catalog contains a comma.
 *
 * Exit 0 when something matched, 1 when nothing did.
 */

import {
  TOKEN_GROUPS,
  loadAsset,
  real,
  resolveHex,
} from './lib/tokens.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);

// A custom property name is the most natural thing to paste when the question
// came from reading CSS, and it begins with two dashes. Anything `--pp-`
// prefixed is a query term rather than an unknown flag.
const isQueryTerm = (a) => !a.startsWith('--') || a.startsWith('--pp-');

const KINDS = ['component', 'icon', 'token', 'style', 'annotation'];
const asJson = has('--json');
const listOnly = has('--list');
const showAll = has('--all');
const CAP = showAll ? Infinity : 12;

const wanted = KINDS.filter((k) => has(`--${k}`));
const kinds = wanted.length ? wanted : KINDS;
const query = argv.filter(isQueryTerm).join(' ').trim();

if (has('--help') || has('-h') || (!query && !listOnly)) {
  console.log(
    'usage: node scripts/lookup.mjs [--component|--icon|--token|--style|--annotation]\n' +
      '                              [--list] [--all] [--json] <query>[,<query>...]\n\n' +
      'Prints only the catalog entries matching <query>, so a property name or an\n' +
      'import key can be had without reading a 97 KB file. Searches every catalog\n' +
      'unless narrowed. An exact name match wins outright; otherwise every substring\n' +
      'match is shown, capped at 12 per kind unless --all.\n\n' +
      'Separate several names with commas to get them in one run:\n' +
      '  lookup.mjs Button,Card,Checkbox\n' +
      'Spaces belong to a single name, so "Icon Button" needs no quoting.\n\n' +
      '  --list   names only, no detail. With no query, lists everything of that kind.\n' +
      '  --json   the raw catalog entries, for scripts. Keyed by term when several.',
  );
  process.exit(0);
}

/**
 * Several names in one run, comma-separated. No name in any catalog contains a
 * comma, while plenty contain spaces — which is why the arguments are joined on
 * spaces first, so `Icon Button` keeps working unquoted, and split on commas
 * second. One process already loads all six catalogs, so each extra term costs
 * a scan over names rather than another round trip.
 */
const terms = query
  ? query
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  : [''];

/** Levenshtein, capped — only used to suggest names after a miss. */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Substring first, then an exact hit promoted to the front. Callers get the
 * whole match list plus whether the first one was exact, because an exact hit
 * is the case worth printing alone.
 */
function search(names, term) {
  const lower = term.toLowerCase();
  if (!term) return { matches: names, exact: false };
  const exact = names.find((n) => n.toLowerCase() === lower);
  const matches = names.filter((n) => n.toLowerCase().includes(lower));
  if (exact) return { matches: [exact], exact: true };
  return { matches, exact: false };
}

function suggest(names, term) {
  const lower = term.toLowerCase();
  if (!term) return [];
  // Deduped because the candidate pool collects every name once per term
  // searched, and the same suggestion listed three times reads as a bug.
  return [...new Set(names)]
    .map((n) => [n, distance(lower, n.toLowerCase())])
    .filter(([, d]) => d <= 3)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([n]) => n);
}

// ------------------------------------------------------------------ catalogs

const components = loadAsset('components.figma.json');
const icons = loadAsset('icons.figma.json');
const tokens = loadAsset('tokens.figma.json');
const styles = loadAsset('styles.figma.json');
const annotations = loadAsset('annotations.figma.json');
const varKeys = loadAsset('variable-keys.figma.json');

const out = [];
const jsonOut = {};
const p = (s = '') => out.push(s);

/** A component or annotation entry, with its properties spelled out. */
function renderComponent(name, e) {
  const bits = [e.type === 'COMPONENT_SET' ? 'component set' : 'component'];
  if (e.page) bits.push(`page "${e.page}"`);
  if (e.instanceCount) bits.push(`${e.instanceCount} instances`);
  p(`${name} — ${bits.join(' · ')}`);
  p(`  import key   ${e.key}`);
  if (e.nodeId) p(`  node id      ${e.nodeId}`);

  const props = real(e.properties);
  if (!props.length) {
    p('  no properties');
    return;
  }
  const pad = Math.max(...props.map(([n]) => n.length));
  const tpad = Math.max(...props.map(([, s]) => String(s.type).length));
  for (const [pname, spec] of props) {
    const detail =
      spec.type === 'VARIANT'
        ? (spec.options ?? []).join(' | ')
        : spec.key && spec.key !== pname
          ? spec.key
          : '';
    const dflt = spec.default === undefined ? '' : `  → ${JSON.stringify(spec.default)}`;
    const size = spec.defaultSize ? `  (default size ${spec.defaultSize})` : '';
    p(`  ${pname.padEnd(pad)}  ${String(spec.type).padEnd(tpad)}  ${detail}${dflt}${size}`);
  }
}

function renderIcon(name, e) {
  p(`${name} — icon${e.category ? ` · category ${e.category}` : ''}`);
  const sizes = Object.entries(e.keys ?? {});
  const pad = Math.max(...sizes.map(([s]) => s.length), 1);
  for (const [size, key] of sizes) p(`  ${size.padEnd(pad)}  ${key}`);
  if (!sizes.length) p('  no published sizes');
}

/** Which Figma variable collection a token group belongs to, if any. */
function bindingFor(group, name) {
  if (group.bindable) {
    const key = varKeys.bindable?.[group.bindable]?.[name];
    if (key) return `bindable · variable key ${key}`;
  }
  if (group.hidden && (varKeys.hiddenFromPublishing?.[group.hidden] ?? []).includes(name)) {
    return 'hidden from publishing — cannot be bound from another file';
  }
  return null;
}

function renderToken(group, name, value) {
  const unit = (v) => (group.unit && typeof v === 'number' ? `${v}${group.unit}` : String(v));

  if (group.key === 'semanticColors') {
    const light = resolveHex(tokens, name, 'Light');
    const dark = resolveHex(tokens, name, 'Dark');
    const alias = typeof value?.Light === 'string' && value.Light.startsWith('@') ? `  (${value.Light})` : '';
    p(`${group.css(name)} — ${group.label} · Light ${light ?? '?'} / Dark ${dark ?? '?'}${alias}`);
  } else if (group.key === 'font') {
    const n = value.size?.native;
    const d = value.size?.desktop;
    const size = d === n ? `${n}px` : `${n}px mobile / ${d}px from 700px`;
    const weight = String(value.weight ?? '').replace(/^@/, '');
    p(`${name} — ${group.label} · ${size} · line-height ${value.lineHeight?.native}px · weight ${weight}`);
    p(`  --pp-font-size-${name}, --pp-line-height-${name}, --pp-font-weight-${name}, or the .pp-${name} utility`);
  } else {
    p(`${group.css(name)} — ${group.label} · ${unit(value)}`);
  }

  const binding = bindingFor(group, name);
  if (binding) p(`  ${binding}`);
}

function renderStyle(kind, name, e) {
  const bits = [];
  if (e.font) bits.push(e.font);
  if (e.size) bits.push(`${e.size}px`);
  if (e.letterSpacing !== undefined) bits.push(`tracking ${e.letterSpacing}`);
  p(`${name} — ${kind}${bits.length ? ` · ${bits.join(' ')}` : ''}`);
  p(`  import key   ${e.key}`);
}

/** One kind's section: heading, capped matches, and the overflow count. */
function section(label, matches, total, render) {
  if (!matches.length) return 0;
  const shown = matches.slice(0, CAP);
  p(`── ${label} — ${matches.length} of ${total}`);
  p('');
  if (listOnly) {
    for (const [name] of shown) p(`  ${name}`);
  } else {
    shown.forEach(([name, entry], i) => {
      if (i) p('');
      render(name, entry);
    });
  }
  if (matches.length > shown.length) {
    p('');
    p(`  …and ${matches.length - shown.length} more. Narrow the query, or pass --all.`);
  }
  p('');
  return matches.length;
}

// -------------------------------------------------------------------- search

let found = 0;
const missPool = [];
const missed = [];
const perTerm = {};

for (const term of terms) {
  const lower = term.toLowerCase();
  const bucket = {};
  const before = found;
  const mark = out.length;

  // Only worth labelling when there is more than one answer to tell apart.
  if (terms.length > 1) {
    p(`══ ${term}`);
    p('');
  }

  if (kinds.includes('component')) {
    const all = real(components.components);
    const names = all.map(([n]) => n);
    const { matches } = search(names, term);
    missPool.push(...names);
    const rows = matches.map((n) => [n, components.components[n]]);
    bucket.components = Object.fromEntries(rows);
    found += section('components', rows, all.length, renderComponent);
  }

  if (kinds.includes('icon')) {
    const all = real(icons.icons);
    const names = all.map(([n]) => n);
    const { matches } = search(names, term);
    missPool.push(...names);
    const rows = matches.map((n) => [n, icons.icons[n]]);
    bucket.icons = Object.fromEntries(rows);
    found += section('icons', rows, all.length, renderIcon);
  }

  if (kinds.includes('token')) {
    const rows = [];
    let total = 0;
    for (const group of TOKEN_GROUPS) {
      const all = real(tokens[group.key]);
      total += all.length;
      const names = all.map(([n]) => n);
      missPool.push(...names.map((n) => group.css(n)));
      // A token is findable by its Figma path or by its custom property name,
      // because half the callers are reading CSS and half are reading Figma.
      for (const [name, value] of all) {
        const css = group.css(name);
        if (
          !term ||
          name.toLowerCase().includes(lower) ||
          css.toLowerCase().includes(lower) ||
          group.label.includes(lower)
        ) {
          rows.push([name, { group, value }]);
        }
      }
    }
    const exact = rows.find(
      ([n, { group }]) => n.toLowerCase() === lower || group.css(n).toLowerCase() === lower,
    );
    const final = exact ? [exact] : rows;
    bucket.tokens = Object.fromEntries(final.map(([n, { group, value }]) => [group.css(n), value]));
    found += section('tokens', final, total, (name, { group, value }) =>
      renderToken(group, name, value),
    );
  }

  if (kinds.includes('style')) {
    const text = real(styles.textStyles);
    const effect = real(styles.effectStyles);
    const names = [...text, ...effect].map(([n]) => n);
    missPool.push(...names);
    const rows = [
      ...text
        .filter(([n]) => !term || n.toLowerCase().includes(lower))
        .map(([n, e]) => [n, { kind: 'text style', e }]),
      ...effect
        .filter(([n]) => !term || n.toLowerCase().includes(lower))
        .map(([n, e]) => [n, { kind: 'effect style', e }]),
    ];
    const exact = rows.find(([n]) => n.toLowerCase() === lower);
    const final = exact ? [exact] : rows;
    bucket.styles = Object.fromEntries(final.map(([n, { e }]) => [n, e]));
    found += section('styles', final, names.length, (name, { kind, e }) =>
      renderStyle(kind, name, e),
    );
  }

  if (kinds.includes('annotation')) {
    const all = real(annotations.components);
    const names = all.map(([n]) => n);
    const { matches } = search(names, term);
    missPool.push(...names);
    const rows = matches.map((n) => [n, annotations.components[n]]);
    bucket.annotations = Object.fromEntries(rows);
    found += section('annotation kit', rows, all.length, renderComponent);
  }

  // A term that matched nothing leaves no heading behind, or the output would
  // carry a label with nothing under it.
  if (found === before) {
    out.length = mark;
    missed.push(term);
  }
  perTerm[term] = bucket;
}

// One term keeps the flat shape it always had; several key by term, because a
// caller asking for three names needs to know which answer is which.
Object.assign(jsonOut, terms.length > 1 ? perTerm : (perTerm[terms[0]] ?? {}));

// -------------------------------------------------------------------- report

if (asJson) {
  console.log(JSON.stringify(jsonOut, null, 2));
  process.exit(found ? 0 : 1);
}

const where = `the ${kinds.join(', ')} catalog${kinds.length === 1 ? '' : 's'}`;
const quoted = (list) => list.map((t) => `"${t}"`).join(' or ');

/** What to try after a miss, for one term. */
function advise(term) {
  const near = suggest(missPool, term);
  if (near.length) {
    console.error('\nDid you mean:');
    for (const n of near) console.error(`  ${n}`);
  } else {
    console.error('\nNames are case-sensitive and often qualified — "Accordion / Item", not "Accordion".');
    console.error('Try a shorter fragment, or --list to see what exists.');
  }
}

// A term that matched nothing is reported even when its neighbours matched.
// Swallowing it is how a batch quietly answers two of the three things asked.
if (found) {
  console.log(out.join('\n').trimEnd());
  if (missed.length) {
    console.error(`\nNothing in ${where} matches ${quoted(missed)}.`);
    for (const term of missed) advise(term);
  }
  process.exit(0);
}

console.error(`Nothing in ${where} matches ${quoted(terms)}.`);
for (const term of terms) advise(term);
process.exit(1);

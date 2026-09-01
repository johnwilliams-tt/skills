#!/usr/bin/env node
/**
 * Answers one question about the catalogs without reading them.
 *
 * The six files in `assets/` total about 255 KB, and reading one to find out
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
 * `copy` is the one kind that answers from the content design rules rather than
 * the kit. It is here rather than in a script of its own because a component
 * lookup can then carry the limit governing its text: "how long can this button
 * be" is the next question after "what is its label property called", and
 * answering both at once is the whole point of the file.
 *
 * `--variant` answers the question the property API cannot. A component entry
 * says `Theme` accepts `secondary`; it has never said what `secondary` looks
 * like, and that silence is what a spec gets guessed into. The flag prints the
 * captured spec when one exists and, when none does, names the read that
 * returns it — because the failure mode being removed here is not a wrong
 * answer, it is no answer at all.
 *
 * Usage:
 *   node scripts/lookup.mjs Button              # every catalog
 *   node scripts/lookup.mjs --component Button  # narrow to one
 *   node scripts/lookup.mjs Button,Card,Checkbox   # several, one call
 *   node scripts/lookup.mjs Button --variant "theme=secondary"
 *   node scripts/lookup.mjs --icon caret
 *   node scripts/lookup.mjs --token radius
 *   node scripts/lookup.mjs --style title
 *   node scripts/lookup.mjs --annotation pointer
 *   node scripts/lookup.mjs --copy pro
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

import { COPY, genericsFor, limitFor } from './lib/copy.mjs';
import {
  SPECS_FILE,
  THE_READ,
  cssPhrase,
  isBinding,
  loadSpecs,
  parseSelector,
  restingVariant,
  unknownPairs,
  variantFor,
  variantForAll,
} from './lib/specs.mjs';
import {
  TOKEN_GROUPS,
  UNIT_LABEL,
  activeOverlay,
  leading,
  loadAsset,
  metric,
  real,
  resolveHex,
} from './lib/tokens.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);

// A custom property name is the most natural thing to paste when the question
// came from reading CSS, and it begins with two dashes. Anything `--pp-`
// prefixed is a query term rather than an unknown flag.
const isQueryTerm = (a) => !a.startsWith('--') || a.startsWith('--pp-');

/**
 * `--variant` is the only flag here that takes a value, and its value has to
 * leave the argument list before the query terms are collected or
 * `theme=secondary` gets searched for as a component name.
 *
 * A bare `--variant` is not the same as no `--variant`: it asks for the resting
 * appearance, so it returns an empty string where an absent flag returns null.
 */
function takeValue(name) {
  const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i === -1) return null;
  if (argv[i].length > name.length) return argv.splice(i, 1)[0].slice(name.length + 1);
  const next = argv[i + 1];
  const value = next !== undefined && isQueryTerm(next) ? next : '';
  argv.splice(i, value === '' ? 1 : 2);
  return value;
}

const variantSel = takeValue('--variant');

const KINDS = ['component', 'icon', 'token', 'style', 'annotation', 'copy'];
const asJson = has('--json');
const listOnly = has('--list');
const showAll = has('--all');
const CAP = showAll ? Infinity : 12;

const wanted = KINDS.filter((k) => has(`--${k}`));
// A variant selector is a question about a component, so it narrows on its own.
// Searching the icon catalog for "Button" while answering "what does
// theme=secondary look like" is noise around the answer.
const kinds = variantSel !== null ? ['component'] : wanted.length ? wanted : KINDS;
const query = argv.filter(isQueryTerm).join(' ').trim();

if (has('--help') || has('-h') || (!query && !listOnly)) {
  console.log(
    'usage: node scripts/lookup.mjs [--component|--icon|--token|--style|--annotation|--copy]\n' +
      '                              [--variant "axis=option, ..."]\n' +
      '                              [--list] [--all] [--json] <query>[,<query>...]\n\n' +
      'Prints only the catalog entries matching <query>, so a property name or an\n' +
      'import key can be had without reading a 97 KB file. Searches every catalog\n' +
      'unless narrowed. An exact name match wins outright; otherwise every substring\n' +
      'match is shown, capped at 12 per kind unless --all.\n\n' +
      'Separate several names with commas to get them in one run:\n' +
      '  lookup.mjs Button,Card,Checkbox\n' +
      'Spaces belong to a single name, so "Icon Button" needs no quoting.\n\n' +
      '  --copy   the content design rules — preferred terms, length limits, banned\n' +
      '           phrases, generic CTAs. A mapped component carries its limit in its\n' +
      '           own entry, so --component Button already answers the length.\n' +
      '  --variant  what an option looks like — fill, border, radius, height, padding —\n' +
      '           as --pp-* names. A component entry says Theme accepts "secondary";\n' +
      '           this says what secondary is. Narrows to components. Bare --variant\n' +
      '           gives the resting appearance. Where nothing was captured it says so\n' +
      '           and names the read that returns it, rather than answering nothing.\n' +
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
// Only read when asked for: the spec capture is the largest of the assets and
// every other kind of lookup answers without it.
const specs = variantSel === null ? null : loadSpecs();

/**
 * Everything the copy rules can be asked about, one row per name.
 *
 * Merged rather than one row per list, because several lists name the same
 * string — "Click here" is forbidden outright, a generic CTA and a generic link
 * — and three rows saying so separately is three chances to read only the
 * mildest of them. The lists are walked worst first for the same reason, so the
 * critical is what a merged row leads with.
 *
 * Aliases are what make the rules reachable by the names people actually hold.
 * `--copy Button` finds the row the upstream calls "Button / CTA", and
 * `--copy contractor` finds the term that replaces it, because nobody looks up
 * a word they already know to avoid.
 */
function copySurface() {
  const rows = new Map();
  const at = (name) => {
    const key = name.toLowerCase();
    if (!rows.has(key)) {
      rows.set(key, { name, what: [], roles: [], detail: [], aliases: [], data: {} });
    }
    return rows.get(key);
  };

  for (const [row, spec] of Object.entries(COPY.limits)) {
    const e = at(row);
    e.what.push(`copy limit · ${spec.raw}`);
    e.roles.push('limit');
    if (spec.format) e.detail.push(['format', spec.format]);
    if (spec.pushpin.length) {
      e.detail.push(['components', spec.pushpin.join(', ')]);
      e.aliases.push(...spec.pushpin);
    }
    if (spec.note) e.detail.push(['note', spec.note]);
    e.data.limit = spec;
  }

  for (const term of COPY.terms) {
    const e = at(term.prefer);
    e.what.push('preferred term');
    e.roles.push('term');
    if (term.insteadOf.length) {
      e.detail.push(['instead of', term.insteadOf.join(', ')]);
      e.aliases.push(...term.insteadOf);
    }
    if (term.usage) e.detail.push(['use for', term.usage]);
    e.data.term = term;
  }

  for (const word of COPY.forbidden) {
    const e = at(word);
    e.what.push('forbidden word (C3)');
    e.roles.push('forbidden');
    e.data.forbidden = true;
  }

  for (const banned of COPY.bannedPhrases) {
    const e = at(banned.phrase);
    e.what.push('banned phrase (M4)');
    e.roles.push('banned-phrase');
    e.detail.push([banned.literal ? 'use' : 'fix', banned.fix]);
    e.data.bannedPhrase = banned;
  }

  for (const cta of COPY.genericCtas) {
    const e = at(cta);
    e.what.push('generic CTA (M3)');
    e.roles.push('generic-cta');
    e.detail.push(['as a CTA', COPY.style.ctas[0]]);
    e.data.genericCta = true;
  }

  for (const link of COPY.genericLinks) {
    const e = at(link);
    e.what.push('generic link (M3)');
    e.roles.push('generic-link');
    e.detail.push(['as a link', COPY.style.links[0]]);
    e.data.genericLink = true;
  }

  return [...rows.values()];
}

const copyRows = copySurface();

const out = [];
const jsonOut = {};
const p = (s = '') => out.push(s);

/**
 * A component or annotation entry, with its properties spelled out.
 *
 * `copy` is off for the Annotation Kit: its components document Pushpin rather
 * than ship in a product, so a length limit on one would be a rule about the
 * annotation instead of about the thing annotated.
 */
function renderComponent(name, e, { copy = false } = {}) {
  const bits = [e.type === 'COMPONENT_SET' ? 'component set' : 'component'];
  if (e.page) bits.push(`page "${e.page}"`);
  if (e.instanceCount) bits.push(`${e.instanceCount} instances`);
  p(`${name} — ${bits.join(' · ')}`);
  // The library can serve an older name than the file carries, and the served
  // name is the one a designer says and the one search_design_system returns.
  if (e.publishedAs) p(`  published as ${e.publishedAs}`);
  p(`  import key   ${e.key}`);
  if (e.nodeId) p(`  node id      ${e.nodeId}`);

  const limit = copy ? limitFor(name) : null;
  if (limit) {
    p(`  copy limit   ${limit.name} — ${[limit.raw, limit.format].filter(Boolean).join(' · ')}`);
    // A component can fall under two rows — Form Note is a field error and it
    // is helper text — and the second is a real constraint rather than a
    // footnote, so it is named even though the first one binds.
    const also = genericsFor(name).slice(1);
    if (also.length) p(`  also under   ${also.join(', ')}`);
  }

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

// --------------------------------------------------------------- visual spec

/** Spec fields in reading order — the frame outward-in, then its text. */
const SPEC_FIELDS = [
  ['fill', 'fill', ''],
  ['stroke', 'border', ''],
  ['strokeWeight', 'border width', 'px'],
  ['radius', 'radius', 'px'],
  ['width', 'width', 'px'],
  ['height', 'height', 'px'],
  ['padding', 'padding', 'px'],
  ['gap', 'gap', 'px'],
  ['sizing', 'sizing', ''],
];

/**
 * One recorded value as text.
 *
 * A bound variable and a collapsed four-side array are both arrays in the
 * capture, so the binding test comes first: `["Tokens / Corner Radius",
 * "sides", 9999]` is one radius, and `[8, 16, 8, 16]` is four.
 */
function cell(v, unit) {
  if (v === null || v === undefined) return null;
  if (!isBinding(v) && Array.isArray(v)) return v.map((x) => cell(x, unit)).join(' / ');
  return cssPhrase(tokens, v, unit);
}

function specValue(field, v) {
  if (v === null || v === undefined) return null;
  const unit = SPEC_FIELDS.find(([f]) => f === field)?.[2] ?? '';
  // Sizing is Figma's own two enum words rather than a run of equal sides.
  if (field === 'sizing' && Array.isArray(v)) return `${v[0]} horizontally, ${v[1]} vertically`;
  return cell(v, unit);
}

/** The rows for one recorded variant, label and value. */
function specRows(v) {
  // Width and height are two separate decisions bound to two separate
  // variables, and each can carry its own note about having no Pushpin token,
  // so they get a row each rather than one `w × h` line.
  const shaped = { ...v, width: v.size?.[0], height: v.size?.[1] };
  const rows = [];
  for (const [field, label] of SPEC_FIELDS) {
    const shown = specValue(field, shaped[field]);
    if (shown !== null) rows.push([label, shown]);
  }
  if (v.text) {
    const bits = [];
    const fill = specValue('fill', v.text.fill);
    if (fill) bits.push(fill);
    if (v.text.size) bits.push(`${v.text.size}px`);
    // A published text style is the type API, and Pushpin's components do not
    // all apply one — Button's Label carries none — so the absence is stated
    // rather than left blank, or a reader assumes a style and looks for it.
    bits.push(v.text.style ? `text style "${v.text.style}"` : 'no published text style');
    rows.push([`text "${v.text.layer}"`, bits.join(' · ')]);
  }
  return rows;
}

function printRows(rows, indent = '    ') {
  if (!rows.length) {
    p(`${indent}nothing recorded`);
    return;
  }
  const pad = Math.max(...rows.map(([l]) => l.length));
  for (const [label, value] of rows) p(`${indent}${label.padEnd(pad)}  ${value}`);
}

/**
 * Where to go when the capture cannot answer.
 *
 * The two catalogs disagree about page names and the difference is not
 * cosmetic: `components.figma.json` records Button on page `Button`, because
 * the Code Connect dump it is built from reports a bare name, while the live
 * page is `📌 Button`. A reader sent to a page that does not exist by that name
 * is being sent nowhere, so the spec capture's verbatim name wins where there
 * is one, and where there is not, the mismatch is stated.
 */
function nameTheRead(name, entry) {
  p(`  Read it from the kit — ${THE_READ}.`);
  const captured = specs?.components?.[name]?.page;
  if (captured) p(`  Page "${captured}".`);
  else if (entry?.page) {
    p(`  Page: the catalog records "${entry.page}"; kit pages carry an emoji prefix, so match on the suffix.`);
  }
}

/**
 * The visual spec for a selector, or an honest account of why there is none.
 *
 * Every miss here names the read that returns the answer. The defect this flag
 * exists to remove was not a wrong spec printed by a tool, it was a tool that
 * said nothing at all about appearance while sounding complete, so a silent
 * miss would leave the invitation to guess exactly where it was found.
 */
function renderVariantSpec(name, entry, selector) {
  const pairs = parseSelector(selector);
  const label = pairs.length ? pairs.map(([a, o]) => `${a}=${o}`).join(', ') : 'resting appearance';
  p('');
  p(`  visual spec · ${label}`);

  if (!specs) {
    p(`  No spec captured: assets/${SPECS_FILE} is not in this build.`);
    nameTheRead(name, entry);
    return;
  }
  const set = specs.components?.[name];
  if (!set) {
    p(`  No spec captured for "${name}". The capture covers ${Object.keys(specs.components ?? {}).length} components.`);
    nameTheRead(name, entry);
    return;
  }

  const unknown = unknownPairs(set, pairs);
  if (unknown.length) {
    for (const [axis, option, what] of unknown) {
      if (what === 'axis') p(`  "${name}" publishes no axis "${axis}".`);
      else p(`  "${axis}" has no option "${option}".`);
    }
    const axes = Object.entries(set.axes ?? {});
    if (axes.length) {
      p('  Published axes:');
      printRows(axes.map(([a, o]) => [a, o.join(' | ')]));
    } else {
      p(`  "${name}" is a single component with no variant axes.`);
    }
    return;
  }

  const variant = pairs.length ? variantForAll(set, pairs) : restingVariant(set);
  if (!variant) {
    // A combination nobody recorded is not composable out of the single-option
    // records: those are two different children, and reading a fill off one and
    // a height off the other describes a third that may not exist.
    p('  No spec was captured for that combination.');
    printRows(
      pairs.map(([axis, option]) => [
        `${axis}=${option}`,
        variantFor(set, axis, option) ? 'recorded on its own' : 'not recorded',
      ]),
    );
    if (pairs.length > 1) p('  Ask for one option at a time, or read the combination from the kit.');
    nameTheRead(name, entry);
    return;
  }

  const held = Object.entries(variant.props ?? {});
  p(
    held.length
      ? `  Recorded on the child with ${held.map(([k, v]) => `${k}=${v}`).join(', ')} and every other axis at its default.`
      : '  Recorded on the child with every axis at its default.',
  );
  printRows(specRows(variant));

  if (set.reduced) {
    p(
      `  ${set.reduced.recorded} of ${set.reduced.children} real variants recorded` +
        `${set.reduced.cappedAt ? `, capped at ${set.reduced.cappedAt}` : ''} — one per axis option.`,
    );
  }
}

/**
 * The same answer for `--json`, misses included.
 *
 * A miss is an object saying why and naming the read, never an omitted key: a
 * caller that gets nothing back cannot tell "no spec captured" from "this
 * component has no border", and that is the confusion the flag exists to end.
 */
function specJson(name, pairs) {
  const read = THE_READ;
  if (!specs) return { captured: false, why: `assets/${SPECS_FILE} is not in this build`, read };
  const set = specs.components?.[name];
  if (!set) return { captured: false, why: 'component not in the spec capture', read };

  const unknown = unknownPairs(set, pairs);
  if (unknown.length) {
    return {
      captured: false,
      why: 'selector names something the set does not publish',
      unknown: unknown.map(([axis, option, what]) => ({ axis, option, what })),
      axes: set.axes ?? {},
    };
  }
  const variant = pairs.length ? variantForAll(set, pairs) : restingVariant(set);
  if (!variant) {
    return {
      captured: false,
      why: 'no single recorded variant carries that combination',
      recordedSeparately: Object.fromEntries(
        pairs.map(([a, o]) => [`${a}=${o}`, Boolean(variantFor(set, a, o))]),
      ),
      read,
    };
  }
  return { captured: true, page: set.page, axes: set.axes, reduced: set.reduced ?? null, variant };
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
  const unit = (v) =>
    group.unit && typeof v === 'number' ? `${v}${UNIT_LABEL[group.unit] ?? group.unit}` : String(v);

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
    // Resolved from the published style rather than read from the variable
    // beside the size, because that is what `--pp-line-height-*` carries.
    const lh = leading(tokens, styles, name);
    const line = lh.desktop === lh.native ? `${lh.native}px` : `${lh.native}px / ${lh.desktop}px`;
    p(`${name} — ${group.label} · ${size} · line-height ${line} · weight ${weight}`);
    p(`  --pp-font-size-${name}, --pp-line-height-${name}, --pp-font-weight-${name}, or the .pp-${name} utility`);
  } else {
    p(`${group.css(name)} — ${group.label} · ${unit(value)}`);
  }

  const binding = bindingFor(group, name);
  if (binding) p(`  ${binding}`);
}

function renderCopy(name, e) {
  p(`${name} — ${e.what.join(' · ')}`);
  const pad = Math.max(...e.detail.map(([label]) => label.length), 1);
  for (const [label, detail] of e.detail) p(`  ${label.padEnd(pad)}  ${detail}`);
}

function renderStyle(kind, name, e) {
  const bits = [];
  if (e.font) bits.push(e.font);
  if (e.size) bits.push(`${e.size}px`);
  if (metric(e.lineHeight)) bits.push(`line-height ${metric(e.lineHeight)}`);
  if (metric(e.letterSpacing)) bits.push(`tracking ${metric(e.letterSpacing)}`);
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
    // A component filed under its file name may be served to the library under
    // another — `_Bubble / Text` is `ChatBubble`. Searching only the catalog key
    // makes the served name, which is the one a designer says, unfindable.
    const servedBy = new Map();
    for (const [n, e] of all) if (e.publishedAs) servedBy.set(e.publishedAs, n);
    const names = all.map(([n]) => n);
    const { matches } = search([...names, ...servedBy.keys()], term);
    missPool.push(...names, ...servedBy.keys());
    const seen = new Set();
    const resolved = matches
      .map((n) => servedBy.get(n) ?? n)
      .filter((n) => !seen.has(n) && seen.add(n));
    const rows = resolved.map((n) => [n, components.components[n]]);
    bucket.components = Object.fromEntries(rows);
    if (variantSel !== null) {
      bucket.specs = Object.fromEntries(
        rows.map(([n]) => [n, specJson(n, parseSelector(variantSel))]),
      );
    }
    found += section('components', rows, all.length, (n, e) => {
      renderComponent(n, e, { copy: true });
      if (variantSel !== null) renderVariantSpec(n, e, variantSel);
    });
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

  if (kinds.includes('copy')) {
    missPool.push(...copyRows.map((e) => e.name));
    const hits = (e, test) => test(e.name) || e.aliases.some(test);
    const matches = term
      ? copyRows.filter((e) => hits(e, (n) => n.toLowerCase().includes(lower)))
      : copyRows;
    const exact = matches.find((e) => hits(e, (n) => n.toLowerCase() === lower));
    const final = (exact ? [exact] : matches).map((e) => [e.name, e]);
    bucket.copy = Object.fromEntries(final.map(([n, e]) => [n, { roles: e.roles, ...e.data }]));
    found += section('copy rules', final, copyRows.length, renderCopy);
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

/**
 * An overlaid catalog is the one thing here that can make a correct answer
 * disagree with the plugin's, and the disagreement is invisible in the answer
 * itself. Saying so once, above the entry, is the price of reading it at all.
 */
const inEffect = activeOverlay();
const overlayNote = inEffect && !inEffect.broken && inEffect.files.length
  ? `Read from this project's own capture of ${inEffect.files.join(', ')} ` +
    `(${inEffect.capturedAt ?? 'undated'}), not the plugin's. ` +
    `node scripts/refresh.mjs for where it came from.`
  : null;

if (asJson) {
  if (overlayNote) {
    jsonOut.$overlay = {
      dir: inEffect.dir,
      capturedAt: inEffect.capturedAt,
      files: inEffect.files,
    };
  }
  console.log(JSON.stringify(jsonOut, null, 2));
  process.exit(found ? 0 : 1);
}

if (overlayNote) console.log(`${overlayNote}\n`);

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

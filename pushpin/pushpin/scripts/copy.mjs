#!/usr/bin/env node
/**
 * Checks a specific piece of writing against Thumbtack's content design rules.
 *
 * The narrow half of a pair. check.mjs sweeps whole files — tokens, component
 * identity and copy together — and the edit hook runs it on every edit. This is
 * the one someone points at a single piece of writing on purpose, and the only
 * entry point that takes copy which is not in a file yet: pasted off a Figma
 * frame, typed into a ticket, piped in from somewhere else.
 *
 * Length is the one rule that cannot be decided from the words alone, so the
 * input has to say what the words are. Labelled blocks are how the upstream
 * rubric asks for copy and how a designer will paste it, so they are the
 * primary form here rather than a convenience: [Header] and [CTA button] are
 * parsed, resolved against the rules' own rows, and each block scanned under
 * its own limit. --component says the same thing for a single unlabelled blob.
 *
 * Findings are grouped by severity because that is the decision being made —
 * a critical is do-not-ship, a major is fix-before-handoff. Nothing here scores
 * the copy or offers a rewrite. The rules state the fix where there is one;
 * choosing the words stays a person's job.
 *
 * Usage:
 *   node scripts/copy.mjs --text "Submit Request"
 *   node scripts/copy.mjs --text "Send request" --component Button
 *   node scripts/copy.mjs --text "[Header] Your pro is on the way"
 *   node scripts/copy.mjs drafts/onboarding-email.md --json
 *   pbpaste | node scripts/copy.mjs
 *
 * Exits 1 when anything was found and 0 when clean, the contract check.mjs
 * holds, so either can gate the same thing.
 */

import { readFileSync } from 'node:fs';

import { COPY, limitFor, scan } from './lib/copy.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const value = (n) => (has(n) ? argv[argv.indexOf(n) + 1] : null);

const consumed = new Set();
for (const flag of ['--text', '--component', '--part']) {
  const i = argv.indexOf(flag);
  if (i >= 0) consumed.add(i + 1);
}
const paths = argv.filter((a, i) => !a.startsWith('--') && !consumed.has(i));

const text = has('--text') ? (value('--text') ?? '') : null;
const component = value('--component');
const part = value('--part');
const asJson = has('--json');
const wantsHelp = has('--help') || has('-h');

if (wantsHelp || (text === null && !paths.length && process.stdin.isTTY)) {
  console.log(
    'usage: node scripts/copy.mjs [--text "..." | <paths...>] [--component <name>]\n' +
      '                            [--part header|body|cta] [--json]\n\n' +
      'Reports copy that breaks the content design rules in assets/copy.json.\n' +
      'Changes nothing, scores nothing, rewrites nothing. Reads stdin when given\n' +
      'neither --text nor a path.\n\n' +
      'Copy labelled the way the rubric asks for it is split on its labels and\n' +
      'each block checked under its own rule:\n\n' +
      '  [Header] Your pro is on the way\n' +
      '  [Body text] Dana will text you when she is close.\n' +
      '  [CTA button] View details\n\n' +
      'A rule that limits its parts separately takes the part in the label too:\n' +
      '[Modal header], [Notification body], [Error message body].\n\n' +
      '  --component  the rule for text carrying no label — a rules row\n' +
      '               ("Body text") or a catalog name ("Icon Button"). This is\n' +
      '               what turns the length check on; without it length is\n' +
      '               unknowable and every other rule still runs.\n' +
      '  --part       header | body | cta, the same thing for a label that did\n' +
      '               not say and for --component.\n' +
      '  --json       findings as structured data.\n\n' +
      'Exit 1 when anything was found, 0 when clean.',
  );
  process.exit(wantsHelp ? 0 : 1);
}

// ------------------------------------------------------------------- labels

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter(Boolean));

/**
 * Every spelling of a rule the data itself offers, mapped to the row it means.
 *
 * A row named "Button / CTA" or "Placeholder / helper text" is one rule under
 * two names, and a label will use one of them, so both halves are registered.
 * Catalog names come in whole — "Modal / Default" is one name, not two — and a
 * component listed under more than one row answers with the first, the order
 * copy-map.json states and the one limitFor already resolves.
 */
const ROWS = new Map();
const offer = (name, row) => {
  const k = norm(name);
  if (!ROWS.has(k)) ROWS.set(k, row);
  else if (ROWS.get(k) !== row) ROWS.set(k, null);
};
for (const row of Object.keys(COPY.limits)) {
  offer(row, row);
  for (const half of row.split(' / ')) offer(half, row);
}
for (const [name, rows] of Object.entries(COPY.components)) offer(name, rows[0]);

/**
 * The row a label or a --component names.
 *
 * Exact first, then the same words in any arrangement, then a label that is a
 * shorter way of saying exactly one row — "[Body]" can only be body text,
 * "[Text]" could be two things and is left unresolved rather than guessed at.
 */
function resolve(name) {
  if (!name) return { row: null, among: [] };

  const exact = ROWS.get(norm(name));
  if (exact) return { row: exact, among: [] };

  const want = tokens(name);
  if (!want.size) return { row: null, among: [] };

  const same = new Set();
  const within = new Set();
  for (const [candidate, row] of ROWS) {
    if (!row) continue;
    const have = tokens(candidate);
    if (![...want].every((t) => have.has(t))) continue;
    within.add(row);
    if (want.size === have.size) same.add(row);
  }

  const hits = same.size ? same : within;
  if (hits.size === 1) return { row: [...hits][0], among: [] };
  return { row: null, among: [...hits].sort() };
}

/**
 * The same, for a label, which may also name a slot inside a rule.
 *
 * "[Modal header]" is the only way a paste can reach a limit that splits into
 * parts, since Modal on its own limits three things and says nothing about
 * which of them the block is. Whole-label matches win first, so "[Body text]"
 * stays body text rather than being read as a body slot.
 */
function resolveLabel(label) {
  const whole = resolve(label);
  if (whole.row) return { ...whole, part: null };

  const m = label.match(/^(.+?)[\s/-]+(header|body|cta)$/i);
  const outer = m ? resolve(m[1]) : { row: null };
  const slot = m?.[2].toLowerCase();
  if (outer.row && limitFor(null, outer.row)?.parts?.[slot]) return { ...outer, part: slot };

  return { ...whole, part: null };
}

/**
 * A label line: a bracketed name at the head of a line, and the text after it.
 *
 * Restricted to something that reads as a name so the markdown a copy deck is
 * written in stays copy — `[the docs](/docs)` and `[1]: https://…` are a link
 * and a footnote, not a designer telling us what a block is.
 */
const LABEL = /^\s*\[([A-Za-z][A-Za-z0-9 /&'’-]{0,58})\]\s*(.*)$/;

function split(source, body) {
  const out = [];
  const rows = body.split('\n');
  let open = { source, label: null, line: 1, column: 1, index: 0, lines: [] };
  const close = () => {
    if (open.lines.some((l) => l.trim())) out.push({ ...open, text: open.lines.join('\n') });
  };

  let at = 0;
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i].match(LABEL);
    if (m && !/^[(:]/.test(m[2])) {
      close();
      const column = rows[i].length - m[2].length + 1;
      open = { source, label: m[1].trim(), line: i + 1, column, index: at + column - 1, lines: [m[2]] };
    } else {
      open.lines.push(rows[i]);
    }
    at += rows[i].length + 1;
  }
  close();
  return out;
}

// -------------------------------------------------------------------- input

const hinted = resolve(component);
if (component && !hinted.row) {
  console.error(
    `No copy limit is mapped to "${component}".\n` +
      (hinted.among.length
        ? `It could be ${hinted.among.join(' or ')} — name one exactly.`
        : `Rows with a limit: ${Object.keys(COPY.limits).join(', ')}\n` +
          'Catalog components reach one through assets/copy-map.json; the rest are\n' +
          'unmapped on purpose and the note on the row says why.'),
  );
  process.exit(1);
}

const stdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

let input;
if (text !== null) input = [{ source: null, body: text }];
else if (paths.length) {
  input = paths.map((p) => {
    try {
      return { source: p, body: readFileSync(p, 'utf8') };
    } catch {
      console.error(`Cannot read ${p}`);
      process.exit(1);
    }
  });
} else input = [{ source: null, body: await stdin() }];

// ------------------------------------------------------------------ scanning

const notes = new Set();
const blocks = [];

for (const { source, body } of input) {
  for (const block of split(source, body)) {
    const hint = block.label ? resolveLabel(block.label) : { ...hinted, part: null };
    const slot = hint.part ?? part;
    const limit = hint.row ? limitFor(null, hint.row) : null;
    const named = block.label ? `[${block.label}]` : source || 'the text';

    // Silence about an unchecked length is the one failure a reader cannot see,
    // so every way of arriving at it says so once.
    if (block.label && !hint.row) {
      notes.add(
        hint.among.length
          ? `${named} could be ${hint.among.join(' or ')}; name one exactly for a length check.`
          : `${named} matches no rule with a limit, so everything but length was checked.`,
      );
    } else if (limit && slot && !limit.parts?.[slot]) {
      notes.add(
        `${limit.name} has no "${slot}" to measure, so length went unchecked` +
          (limit.parts ? ` — it splits into ${Object.keys(limit.parts).join(', ')}.` : '.'),
      );
    } else if (limit && !limit.limit && limit.parts && !slot) {
      notes.add(
        `${limit.name} limits ${Object.keys(limit.parts).join(', ')} separately and ${named} names ` +
          `none of them, so length went unchecked. Say which — [${limit.name} header] — or pass --part.`,
      );
    }

    // Positions belong to the input the caller handed over, not to the block it
    // was cut into, and only a block's first line can begin mid-line.
    const findings = scan(block.text, { generic: hint.row ?? undefined, part: slot ?? undefined }).map(
      (f) => ({
        ...f,
        index: f.index + block.index,
        line: f.line + block.line - 1,
        column: f.line === 1 ? f.column + block.column - 1 : f.column,
      }),
    );

    blocks.push({
      source,
      label: block.label,
      // Without the row's catalog mapping, which is provenance for the join
      // rather than anything a caller checking copy acts on.
      limit: limit && {
        name: limit.name,
        raw: limit.raw,
        format: limit.format,
        limit: limit.limit,
        parts: limit.parts,
      },
      line: block.line,
      findings,
    });
  }
}

const findings = blocks.flatMap((b) => b.findings.map((f) => ({ ...f, block: b })));
const counts = findings.reduce(
  (a, f) => ((a[f.severity] += 1), a),
  { critical: 0, major: 0, minor: 0 },
);

// ------------------------------------------------------------------- report

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: !findings.length,
        counts: { ...counts, total: findings.length },
        blocks,
        notes: [...notes],
      },
      null,
      2,
    ),
  );
  process.exit(findings.length ? 1 : 0);
}

const advise = () => notes.forEach((n) => console.log(n));

if (!findings.length) {
  const labelled = blocks.filter((b) => b.label).length;
  const against = labelled
    ? ` in ${labelled} labelled block${labelled === 1 ? '' : 's'}`
    : blocks[0]?.limit
      ? ` against ${blocks[0].limit.name}`
      : '';
  console.log(`Nothing off-guideline${against}.`);
  advise();
  process.exit(0);
}

/** What a tier means to the person reading it, so the code needs no decoding. */
const TIERS = [
  ['critical', 'Critical — do not ship'],
  ['major', 'Major — fix before handoff'],
  ['minor', 'Minor — worth a pass'],
];

const where = (b) => [b.source, b.label && `[${b.label}]`].filter(Boolean).join(' ');
const order = new Map(blocks.map((b, i) => [b, i]));

const rows = new Map(
  findings.map((f) => [f, [where(f.block), `${f.line}:${f.column}`, f.code, f.rule, f.message]]),
);
// Widths are taken across the whole report rather than per tier, so the
// columns hold their line down it, and a column that is empty everywhere —
// unlabelled text has nothing to say in the first — is dropped rather than
// padded into looking like a missing value.
const columns = [0, 1, 2, 3].filter((i) => [...rows.values()].some((r) => r[i]));
const pad = columns.map((i) => Math.max(...[...rows.values()].map((r) => r[i].length)));

for (const [tier, heading] of TIERS) {
  const tiered = findings
    .filter((f) => f.severity === tier)
    .sort((a, b) => order.get(a.block) - order.get(b.block) || a.line - b.line || a.column - b.column);
  if (!tiered.length) continue;

  console.log(`\n${heading}`);
  for (const f of tiered) {
    const r = rows.get(f);
    console.log(`  ${columns.map((c, i) => r[c].padEnd(pad[i])).join('  ')}  ${r[4]}`);
  }
}

console.log(
  `\n${findings.length} finding${findings.length === 1 ? '' : 's'}: ` +
    TIERS.filter(([t]) => counts[t]).map(([t]) => `${counts[t]} ${t}`).join(', '),
);
advise();
process.exit(1);

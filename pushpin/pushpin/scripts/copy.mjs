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
 * a critical is do-not-ship, a major is fix-before-handoff.
 *
 * `--report` is the other shape the same findings take: the upstream's score
 * and one row per string, current beside suggested. It exists because a copy
 * check that has to be assembled by hand — grep the strings, label them, run
 * them, write the findings up as prose — costs an hour and reads like an essay,
 * and what the person asking wanted was a number and a table. The suggestions in
 * it are only ever the substitutions the rules state; a cell needing a decision
 * about what the copy means is left empty for a person to fill.
 *
 * Usage:
 *   node scripts/copy.mjs --text "Submit Request"
 *   node scripts/copy.mjs --text "Send request" --component Button
 *   node scripts/copy.mjs --text "[Header] Your pro is on the way"
 *   node scripts/copy.mjs --report areas.html areas.js
 *   node scripts/copy.mjs drafts/onboarding-email.md --json
 *   pbpaste | node scripts/copy.mjs
 *
 * Exits 1 when anything was found and 0 when clean, the contract check.mjs
 * holds, so either can gate the same thing.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { COPY, limitFor, rewrite, scan, scoreOf } from './lib/copy.mjs';
import { MARKUP_EXT, lineOf, maskMarkup, strings } from './lib/copy-strings.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const value = (n) => (has(n) ? argv[argv.indexOf(n) + 1] : null);

const consumed = new Set();
for (const flag of ['--text', '--component', '--part', '--apply']) {
  const i = argv.indexOf(flag);
  if (i >= 0) consumed.add(i + 1);
}
const paths = argv.filter((a, i) => !a.startsWith('--') && !consumed.has(i));

const text = has('--text') ? (value('--text') ?? '') : null;
const component = value('--component');
const part = value('--part');
const asJson = has('--json');
const asReport = has('--report');
const applying = has('--apply') ? (value('--apply') ?? '') : null;
const wantsHelp = has('--help') || has('-h');

/**
 * The rows named by --apply.
 *
 * Two spellings, because the two callers write differently. `1,3` is what a
 * person types. The JSON object is what an agent relaying a picked list writes,
 * and it is the only one that can carry replacement wording, since wording
 * contains commas and a comma-separated list of it cannot be parsed back.
 *
 * @returns {Map<number, string|null>|null} null on a spelling error, the message
 *   already printed. A null value means "the suggestion in the table".
 */
function parseApply(spec) {
  const out = new Map();
  const trimmed = spec.trim();
  if (!trimmed) {
    console.error('--apply needs the row numbers to apply: --apply 1,3');
    return null;
  }

  if (trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      console.error(`--apply was given something that starts like JSON and is not: ${e.message}`);
      return null;
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (!/^\d+$/.test(k)) {
        console.error(`--apply keys are row numbers from the table; "${k}" is not one.`);
        return null;
      }
      if (v !== null && typeof v !== 'string') {
        console.error(`--apply values are replacement text, or null for the suggestion. Row ${k} is neither.`);
        return null;
      }
      out.set(Number(k), v);
    }
  } else {
    for (const part of trimmed.split(',')) {
      const n = part.trim();
      if (!/^\d+$/.test(n)) {
        console.error(`--apply takes row numbers from the table; "${n}" is not one.`);
        return null;
      }
      out.set(Number(n), null);
    }
  }

  if (!out.size) {
    console.error('--apply named no rows.');
    return null;
  }
  return out;
}

if (wantsHelp || (text === null && !paths.length && process.stdin.isTTY)) {
  console.log(
    'usage: node scripts/copy.mjs [--text "..." | <paths...>] [--component <name>]\n' +
      '                            [--part header|body|cta] [--report] [--json]\n' +
      '                            [--apply <rows>]\n\n' +
      'Reports copy that breaks the content design rules in assets/copy.json.\n' +
      'Changes nothing unless --apply names a row. Reads stdin when given\n' +
      'neither --text nor a path.\n\n' +
      'A path to markup or a script is walked for the strings a person reads —\n' +
      'text nodes, the label/title/placeholder/aria-label/alt attributes, and the\n' +
      'same names assigned in script. Anything else is read as a copy deck.\n\n' +
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
      '  --report     the score and a current-beside-suggested table, as markdown.\n' +
      '               Its rows are numbered, and the numbers are what --apply\n' +
      '               takes.\n' +
      '  --apply      write chosen rows back to their files, over the same paths\n' +
      '               the report ran on. `--apply 1,3` takes the suggestion in\n' +
      '               those rows. `--apply \'{"2":"Your wording"}\' writes\n' +
      '               something else, and null in place of the wording means the\n' +
      '               suggestion. A suggestion is applied word by word, so an\n' +
      '               interpolated value in the string survives it.\n' +
      '  --json       findings as structured data.\n\n' +
      'Exit 1 when anything was found, 0 when clean or applied.',
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

const SKIP_DIR = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', 'vendor', '.svelte-kit', '.turbo', '.cache',
]);

/** What a directory is worth opening for. A file named outright is read whatever it is. */
const DECK_EXT = new Set(['.md', '.mdx', '.txt']);

/** Every file under a path, so a directory can be handed over whole. */
function walk(p, into, named = true) {
  let s;
  try {
    s = statSync(p);
  } catch {
    console.error(`Cannot read ${p}`);
    process.exit(1);
  }
  if (!s.isDirectory()) {
    const ext = extname(p);
    if (named || MARKUP_EXT.has(ext) || DECK_EXT.has(ext)) into.push(p);
    return;
  }
  for (const e of readdirSync(p)) {
    if (SKIP_DIR.has(e)) continue;
    walk(join(p, e), into, false);
  }
}

const read = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    console.error(`Cannot read ${p}`);
    process.exit(1);
  }
};

let input;
if (text !== null) input = [{ source: null, body: text }];
else if (paths.length) {
  const files = [];
  for (const p of paths) walk(p, files);
  // Markup and script hold their copy inside code, so reading one as a copy deck
  // would scan its identifiers as prose. Everything else — a draft, a deck, a
  // paste saved to a file — is words already, and its labels are the input form.
  input = files.map((p) => ({ source: p, body: read(p), code: MARKUP_EXT.has(extname(p)) }));
} else input = [{ source: null, body: await stdin() }];

// ------------------------------------------------------------------ scanning

const notes = new Set();
const blocks = [];

/**
 * The row that governs a string found in code, where nothing labelled it.
 *
 * A declared component answers it outright. Failing that, the attribute a string
 * arrived through is a weaker but real signal: a placeholder is the placeholder
 * row whatever element carries it, and that is a length limit the walk could not
 * otherwise reach. An accessible name is deliberately not a row — `aria-label`
 * and `alt` are read aloud rather than laid out, so no width governs them and
 * every rule but length still applies.
 */
const ROW_FOR_PROP = { placeholder: 'Placeholder / helper text' };

/** Strings in a source file, as the blocks the pipeline below already handles. */
function fromCode(source, body) {
  const src = maskMarkup(body);
  return strings(src).map(({ text, raw, at, component, prop, authored }) => ({
    source,
    label: null,
    component,
    prop,
    authored,
    row: component ? null : (ROW_FOR_PROP[prop] ?? null),
    line: lineOf(src, at),
    column: 1,
    index: at,
    text,
    // A string whose interpolations were blanked cannot be replaced whole
    // without deleting them, and --apply refuses rather than doing that.
    holes: raw !== text,
  }));
}

/**
 * Strings a marker attributed to somebody outside Thumbtack, counted by author.
 *
 * They are dropped before the scan rather than scanned and filtered afterwards,
 * because a finding that exists is a finding that can be reported, scored or
 * applied by mistake, and the whole point of the marker is that a pro's own
 * words are not ours to correct. Counted so the exemption is visible: a marker
 * on the wrong element silently empties the report, and a line saying how many
 * strings it swallowed is how anyone notices.
 */
const exempt = new Map();

for (const { source, body, code } of input) {
  for (const block of code ? fromCode(source, body) : split(source, body)) {
    block.code = Boolean(code);
    if (block.authored) {
      exempt.set(block.authored, (exempt.get(block.authored) ?? 0) + 1);
      continue;
    }
    const hint = block.label
      ? resolveLabel(block.label)
      : block.component || block.row
        ? { row: block.row, among: [], part: null }
        : { ...hinted, part: null };
    const slot = hint.part ?? part;
    const limit = limitFor(block.component ?? null, hint.row ?? null);
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

    const found = scan(block.text, {
      component: block.component ?? undefined,
      generic: hint.row ?? undefined,
      part: slot ?? undefined,
    });

    // Taken here, while the offsets still belong to the block's own text. After
    // the rebase below they point into the file, and splicing the fix in at one
    // of those would land it past the end of the string it belongs to.
    const { suggested, left, edits } = rewrite(block.text, found);

    // Positions belong to the input the caller handed over, not to the block it
    // was cut into, and only a block's first line can begin mid-line.
    const findings = found.map(
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
      text: block.text,
      code: block.code,
      authored: block.authored ?? null,
      holes: Boolean(block.holes),
      index: block.index,
      prop: block.prop ?? null,
      component: block.component ?? null,
      suggested,
      left,
      edits,
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

// Walking a file finds strings nothing in the file says the width of, and most
// of them are that, so this is counted once rather than repeated per string.
// Silence about a rule that did not run is the failure a reader cannot see.
const walked = blocks.filter((b) => b.code);
const unmeasured = walked.filter((b) => !b.limit).length;
if (unmeasured) {
  notes.add(
    `${unmeasured} of ${walked.length} strings in code carry no component, so length went unchecked ` +
      'on them. A `data-pp-component` on the element that holds one, or --component for a single ' +
      'string, is what names the row.',
  );
}

if (exempt.size) {
  const by = [...exempt].map(([who, n]) => `${n} marked ${who}`).join(', ');
  notes.add(
    `${by} — not checked and not scored. The content rules are Thumbtack's voice, and copy a pro or ` +
      'a customer wrote is theirs. Remove the `data-pp-content` to check a region anyway, or set it ' +
      'to "app" on the part of it that is ours.',
  );
}

// ------------------------------------------------------------------- report

const score = scoreOf(findings);
const advise = () => notes.forEach((n) => console.log(n));

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: !findings.length,
        score,
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

// --------------------------------------------------------- rows, for both lanes

// A blanked interpolation leaves the run of spaces it stood in; in a table that
// reads as a typo rather than as a hole, so runs collapse for display.
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const place = (b) =>
  [b.source && `${b.source}:${b.line}`, b.label && `[${b.label}]`, b.prop, b.component]
    .filter(Boolean)
    .join(' ') || 'the text';

/**
 * The rows of the report, numbered.
 *
 * `--apply` names a row by its number, so the order has to be the one the reader
 * saw. It is derived rather than stored for that reason: both lanes compute it
 * from the same blocks in the same pass, and a number that meant one row in the
 * table and another in the apply would edit a string nobody chose.
 */
const SEVERITY_RANK = { critical: 0, major: 1, minor: 2 };
const worst = (b) => Math.min(...b.findings.map((f) => SEVERITY_RANK[f.severity] ?? 3));
const hit = blocks
  .filter((b) => b.findings.length)
  .sort((a, b) => worst(a) - worst(b) || blocks.indexOf(a) - blocks.indexOf(b));

// ------------------------------------------------------------------- --apply
// Before the report, so that passing both applies rather than printing the
// table and exiting on it.
if (applying !== null) applyRows();

// ------------------------------------------------------------------ --report

/**
 * The score, then one row per string that broke something.
 *
 * Markdown because the answer is going straight to a person: the caller relays
 * this table rather than reformatting it, and a reformatting step is where the
 * findings turn back into paragraphs. Rows are per string rather than per
 * finding because a string is the thing somebody edits — two findings on one
 * label are one decision, and splitting them into two rows invites half a fix.
 */
if (asReport) {
  console.log(`Score ${score.score}/${score.of} — ${score.because}`);
  for (const a of score.awarding) {
    console.log(
      `${score.ceiling}/${score.of} is as high as a scan goes; ${a.score} is ${a.code}, which is a person's call.`,
    );
  }

  if (hit.length) {
    console.log('\n| # | Where | Current | Suggested | Why |');
    console.log('|---|---|---|---|---|');
    hit.forEach((b, i) => {
      const why = b.findings.map((f) => `${f.code} ${f.message}`).join('; ');
      console.log(
        `| ${i + 1} | ${cell(place(b))} | ${cell(b.text)} | ${b.suggested ? cell(b.suggested) : ''} | ${cell(why)} |`,
      );
    });
  }

  const clean = blocks.length - hit.length;
  console.log(
    `\n${blocks.length} string${blocks.length === 1 ? '' : 's'} checked, ${clean} clean. ` +
      (findings.length
        ? `${findings.length} finding${findings.length === 1 ? '' : 's'}: ` +
          Object.entries(counts).filter(([, n]) => n).map(([t, n]) => `${n} ${t}`).join(', ') +
          '.'
        : 'Nothing off-guideline.'),
  );

  // A Suggested cell that is blank, or that still carries something Why flagged,
  // is a decision rather than an oversight — and a reader who takes a partial
  // rewrite for a finished one ships the half of it nobody wrote.
  const open = [...new Set(hit.flatMap((b) => b.left))].sort();
  if (open.length) {
    console.log(
      'Suggested only makes the substitutions the rules state. Where it is blank, or still carries ' +
        `something Why names, the words are yours: ${open.join(', ')}.`,
    );
  }
  if (hit.length && hit.some((b) => b.source)) {
    console.log(
      'To apply a row, pass its number: --apply 1,3 for the suggestions above, or\n' +
        '--apply \'{"2":"Your own wording"}\' to write something else into one.',
    );
  }
  advise();
  process.exit(findings.length ? 1 : 0);
}

// ------------------------------------------------------------------- --apply

/**
 * Writes chosen rows back to their files.
 *
 * This exists so that picking a fix is one call rather than a hand-edit per row.
 * Two things made a hand-edit the wrong mechanism. The same string is usually in
 * more than one place — a modal title lives in its own page and again in the host
 * that embeds it — so a find-and-replace either refuses for being ambiguous or
 * changes both when the reader chose one. And a string assembled in code holds
 * interpolations, so replacing it whole deletes them.
 *
 * A row taking the script's own suggestion is applied span by span, which leaves
 * everything the rules had no finding about exactly as it was, interpolations
 * included. A row taking wording of your own replaces the string, and is refused
 * where the string has a hole in it, because there is no way to know which part
 * of the new words the hole belonged in.
 */
function applyRows() {
  const wanted = parseApply(applying);
  if (!wanted) process.exit(1);

  const picked = new Map();
  for (const [n, replacement] of wanted) {
    const b = hit[n - 1];
    if (!b) {
      console.error(
        `There is no row ${n}. The report listed ${hit.length}. Re-run --report: a file that changed ` +
          'since renumbers them.',
      );
      process.exit(1);
    }
    if (!b.source) {
      console.error(`Row ${n} is text passed in, not a file, so there is nothing to write to.`);
      process.exit(1);
    }
    // Unreachable while an authored string never becomes a row, and kept because
    // this is the line that actually writes to a file: the guard belongs where
    // the damage would be, not only where the rows are built.
    if (b.authored) {
      console.error(`Row ${n} is copy marked ${b.authored}, which this does not rewrite.`);
      process.exit(1);
    }
    if (replacement !== null && b.holes) {
      console.error(
        `Row ${n} is built in code and holds a value filled in at runtime, so its wording cannot be ` +
          'replaced wholesale. Edit that line directly, or take the suggestion, which changes only ' +
          'the words the rules named.',
      );
      process.exit(1);
    }
    if (replacement === null && !b.edits.length) {
      console.error(
        `Row ${n} has no suggestion to apply — the rules name what is wrong and not what to say ` +
          `instead. Pass the words: --apply '{"${n}":"…"}'.`,
      );
      process.exit(1);
    }
    picked.set(n, { block: b, replacement });
  }

  // Grouped by file and applied back to front, so an earlier edit cannot shift
  // the offset of a later one.
  const byFile = new Map();
  for (const [n, { block, replacement }] of picked) {
    const spans =
      replacement === null
        ? block.edits.map((e) => ({ at: block.index + e.index, length: e.length, from: e.from, to: e.to }))
        : [{ at: block.index, length: block.text.length, from: block.text, to: replacement }];
    if (!byFile.has(block.source)) byFile.set(block.source, []);
    byFile.get(block.source).push(...spans.map((s) => ({ ...s, n })));
  }

  const done = [];
  for (const [file, spans] of byFile) {
    let body = read(file);
    for (const s of spans.sort((a, b) => b.at - a.at)) {
      // The offsets came from a masked read of this same file in this same run,
      // so a mismatch means the file moved under us rather than a bad offset.
      if (body.slice(s.at, s.at + s.length) !== s.from) {
        console.error(
          `${file} does not hold "${s.from}" where the scan found it. Nothing was written. Re-run ` +
            '--report and pick again.',
        );
        process.exit(1);
      }
      body = body.slice(0, s.at) + s.to + body.slice(s.at + s.length);
    }
    writeFileSync(file, body);
    done.push([file, spans.length]);
  }

  for (const [n, { block, replacement }] of [...picked].sort((a, b) => a[0] - b[0])) {
    const after = replacement === null ? block.suggested : replacement;
    console.log(`${n}. ${place(block)}\n   ${cell(block.text)}\n   ${cell(after)}`);
  }
  console.log(
    `\nApplied ${picked.size} row${picked.size === 1 ? '' : 's'} across ` +
      `${done.length} file${done.length === 1 ? '' : 's'}.`,
  );
  process.exit(0);
}

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

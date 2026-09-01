#!/usr/bin/env node
/**
 * Brings one project current after the design system moved under it.
 *
 * The detection this runs on has existed for a while and never ran. `check.mjs`
 * holds a declared tag against the captured variant it names — fill, border,
 * radius, padding, height, colour, font size — and reports a `variant-drift`
 * where the two disagree, and an `unknown-variant` where the declaration names
 * an option the kit no longer publishes. Nothing triggered that sweep after a
 * republish, and a finding was not addressable enough to write, so the report
 * was the end of it.
 *
 * This is the verb that triggers it and the writer that acts on it. Two classes
 * of answer come out, and the split is the whole design:
 *
 * - **Mechanical.** The kit's value is knowable and the replacement is
 *   unambiguous — a fill that moved to another token, a radius, a padding, a
 *   border width. `--write` replaces it in the file the value actually sits in.
 * - **Judgement.** A variant was deleted. `theme=subtle` and `size=xlarge` are
 *   gone from Button, and whether a `subtle` button becomes `secondary` or
 *   `tertiary` is a design decision this script has no standing to make. Those
 *   come out as numbered rows, and `--resolve` writes the answers back.
 *
 * Default mode reports and writes nothing, because `freshness.mjs` hands this
 * command over as a `fix:` line at session start and a session start that
 * rewrites project source unasked is not a repair.
 *
 * Usage:
 *   node scripts/update.mjs                          # report what moved and what would change
 *   node scripts/update.mjs --write                  # apply the mechanical fixes, number the rest
 *   node scripts/update.mjs --resolve '{"1":"secondary"}'
 *   node scripts/update.mjs src/areas.html --write    # narrow the sweep
 *
 * Exits 1 while anything is still outstanding, 0 when there is nothing to do,
 * which is the contract `check.mjs` and `copy.mjs` already hold.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashText } from './canonical.mjs';
import { attrValue, lineOf, mask } from './lib/copy-strings.mjs';
import {
  OVERLAY_REL,
  captureDate,
  findOverlay,
  overlayPath,
  projectRoot,
} from './lib/overlay.mjs';
import { loadAsset } from './lib/tokens.mjs';
import { catalogPins, inspectPin } from './pin.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const PLUGIN_ROOT = resolve(here, '..', '..');
const PLUGIN = JSON.parse(
  readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
);
const MANIFEST = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const value = (n) => (has(n) ? argv[argv.indexOf(n) + 1] : null);

/** Flags whose value follows them, so it is not read as a path to sweep. */
const consumed = new Set();
for (const flag of ['--resolve']) {
  const i = argv.indexOf(flag);
  if (i >= 0) consumed.add(i + 1);
}
const given = argv.filter((a, i) => !a.startsWith('--') && !consumed.has(i));

const WRITE = has('--write');
const RESOLVING = has('--resolve') ? (value('--resolve') ?? '') : null;
const NO_INIT = has('--no-init');
const asJson = has('--json');

if (has('--help') || has('-h')) {
  console.log(
    "usage: node scripts/update.mjs [paths...] [--write | --resolve '{\"1\":\"option\"}']\n" +
      '                              [--no-init] [--json]\n\n' +
      'Sweeps a project for components the kit has restyled or stopped publishing,\n' +
      'applies the fixes whose replacement is unambiguous, and puts the rest to you\n' +
      'as numbered questions. Reports and writes nothing without --write.\n\n' +
      '  --write    replace the drifted values in the files they sit in, record the\n' +
      '             plugin\'s catalog dates in pushpin.config.json, and number the\n' +
      '             declarations naming a variant the kit no longer publishes.\n' +
      '  --resolve  write picked answers back, by row number from the last --write:\n' +
      "             --resolve '{\"1\":\"secondary\",\"2\":\"large\"}'.\n" +
      '  --no-init  leave pushpin.config.json alone under --write.\n' +
      '  --json     what moved, what was written, and the open questions.\n\n' +
      'Run it from the project. Exits 1 while anything is outstanding.',
  );
  process.exit(0);
}

if (WRITE && RESOLVING !== null) {
  console.error(
    '--write and --resolve are two ends of the same exchange, not one call. --write numbers the ' +
      'questions; --resolve answers the numbers it printed.',
  );
  process.exit(1);
}

// -------------------------------------------------------------- the project

const within = (root, p) => p === root || p.startsWith(root + sep);
const root = projectRoot();

if (!root) {
  if (within(PLUGIN_ROOT, resolve(process.cwd()))) {
    console.error(
      'This is the Pushpin plugin\'s own checkout, which consumes nothing and declares nothing.\n' +
        'The kit moving here is a capture and a release: see reference/maintaining.md.',
    );
    process.exit(1);
  }
  console.error(
    'No pushpin.config.json above the working directory, so there is no project to update.\n\n' +
      'Run this from a project that has been set up. To set one up:\n' +
      `  node ${join(here, 'init.mjs')} . --write`,
  );
  process.exit(1);
}

const rel = (p) => relative(root, p) || '.';
const abs = (p) => (p.startsWith(sep) ? p : join(root, p));

const config = JSON.parse(readFileSync(join(root, 'pushpin.config.json'), 'utf8'));
const overlay = findOverlay(root);

/**
 * The pin, read before anything writes.
 *
 * `init --write --force` rewrites the recorded catalog dates and looks at
 * nothing the project is built out of, so a run that repaired the pin first
 * would destroy the one signal that said a sweep was warranted. Every reason
 * this run reports is the reason as it was found.
 */
const pin = inspectPin(root, { manifest: MANIFEST, pluginVersion: PLUGIN.version });

/**
 * Which catalog a component question is being asked against, and when it was
 * captured.
 *
 * Two things can move a catalog out from under a pin and only one of them is
 * visible to `pin.mjs`. A plugin release moves the shipped capture, which the
 * `catalog` reason reports. A project taking its own re-capture through
 * `refresh.mjs` writes into `.pushpin/assets/` and touches
 * `pushpin.config.json` not at all — so the project reads a newer catalog than
 * the one it is pinned to, and nothing in the pin can say so. Comparing the
 * recorded date against the catalog actually in force covers both, and names
 * which of the two moved.
 */
const CATALOGS = [
  ['componentsCapturedAt', 'components.figma.json', 'component catalog'],
  ['specsCapturedAt', 'component-specs.figma.json', 'component specs'],
];

const shipped = catalogPins();

function catalogMoves() {
  const out = [];
  for (const [field, file, label] of CATALOGS) {
    const recorded = config[field] ?? null;
    const own = overlayPath(overlay, file);
    let date = shipped[field] ?? null;
    let from = 'the plugin';
    if (own) {
      try {
        date = captureDate(JSON.parse(readFileSync(own, 'utf8')));
        from = `${rel(join(root, OVERLAY_REL))}, this project's own re-capture`;
      } catch {
        // A broken overlay file is already reported by `freshness`, and reading
        // the shipped date instead is what the consumer scripts do anyway.
      }
    }
    // No recorded date means the project predates the fields, which says
    // nothing about whether the catalog moved.
    if (!recorded || !date || recorded === date) continue;
    out.push({ field, label, from, recorded, date });
  }
  return out;
}

const moved = catalogMoves();

// ------------------------------------------------------------------ the sweep

const targets = given.length ? given.map((p) => resolve(p)) : [root];
for (const t of targets) {
  if (!existsSync(t)) {
    console.error(`No such path: ${t}`);
    process.exit(1);
  }
}

/**
 * `check.mjs` is the only rule of record here.
 *
 * Run as a child rather than imported: it reports on the working directory it
 * was started in, and the catalog it holds a declaration against is the
 * project's own where an overlay exists. `--component-only --no-copy` narrows it
 * to the half this command can act on — a raw hex in a file nothing declares is
 * a real finding and not one a catalog move produced.
 */
function sweep() {
  const args = [join(here, 'check.mjs'), ...targets, '--json', '--component-only', '--no-copy'];
  const opts = { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  let out;
  try {
    out = execFileSync('node', args, opts);
  } catch (e) {
    // Exit 1 is how the check reports findings, so its stdout is the answer.
    out = e.stdout;
    if (!out) {
      console.error(`The sweep could not run: ${e.stderr || e.message}`);
      process.exit(1);
    }
  }
  try {
    return JSON.parse(out);
  } catch (e) {
    console.error(`The sweep printed something that is not JSON: ${e.message}`);
    process.exit(1);
  }
}

const catalog = loadAsset('components.figma.json').components;

// ------------------------------------------------------- addressing a finding

const TAGS = /<([a-zA-Z][\w.-]*)((?:\s+[^<>]*?)?)\/?>/g;
/** The same reading of a declaration `check.mjs` uses, so the two cannot disagree. */
const VARIANT = /data-pp-variant\s*=\s*["'{]?\s*["']([^"']+)/;

const sources = new Map();
const source = (file) => {
  if (!sources.has(file)) sources.set(file, readFileSync(abs(file), 'utf8'));
  return sources.get(file);
};

/**
 * `axis=option` pairs with the span each option occupies in the file.
 *
 * Offsets are taken through the same masked read the check walks, where a
 * comment is spaces and positions survive. The span is confirmed against the
 * file before it is used, on the same reasoning `check.mjs` confirms its own:
 * an offset that does not read back is a guess, and this one is a guess about
 * where to write.
 */
function optionSpans(src, spec, base) {
  const out = [];
  let from = 0;
  for (const part of spec.split(',')) {
    const at = from;
    from += part.length + 1;
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const axis = part.slice(0, eq).trim();
    const raw = part.slice(eq + 1);
    const option = raw.trim();
    if (!axis || !option) continue;
    const start = base + at + eq + 1 + (raw.length - raw.trimStart().length);
    if (src.slice(start, start + option.length) !== option) continue;
    out.push({ axis, option, start, end: start + option.length });
  }
  return out;
}

/** Every declared tag in a file, with where its attributes and variant spec sit. */
function declarations(file) {
  const src = source(file);
  const masked = mask(src);
  const out = [];
  for (const m of masked.matchAll(TAGS)) {
    const attrs = m[2] ?? '';
    const name = attrValue(attrs, 'data-pp-component')?.value;
    if (!name) continue;
    const base = m.index + 1 + m[1].length;
    const spec = VARIANT.exec(attrs);
    out.push({
      file,
      component: name,
      line: lineOf(masked, m.index),
      start: m.index,
      end: m.index + m[0].length,
      spans: spec
        ? optionSpans(src, spec[1], base + spec.index + spec[0].length - spec[1].length)
        : [],
    });
  }
  return out;
}

/**
 * The judgement calls, derived from the declarations the check flagged.
 *
 * `unknown-variant` says a declaration names an option the kit does not publish
 * and names the file and line it said it on; what it does not carry is where
 * inside that line the option sits, and that is what a write needs. So the rule
 * stays the check's and the address is taken here, from the same declaration,
 * against the same catalog. A property the kit dropped whole has no menu to
 * offer and is left to the hand list.
 */
function questionsFrom(findings) {
  const lines = new Map();
  for (const f of findings) {
    if (f.rule !== 'unknown-variant') continue;
    if (!lines.has(f.file)) lines.set(f.file, new Set());
    lines.get(f.file).add(f.line);
  }

  const out = [];
  const hand = [];
  for (const [file, at] of lines) {
    for (const decl of declarations(file)) {
      if (!at.has(decl.line)) continue;
      const properties = catalog[decl.component]?.properties ?? {};
      for (const span of decl.spans) {
        const prop = properties[span.axis];
        if (!prop) {
          hand.push({
            file,
            line: decl.line,
            why: `${decl.component} has no property "${span.axis}" any more, so there is no option to pick`,
          });
          continue;
        }
        if (!Array.isArray(prop.options) || prop.options.includes(span.option)) continue;
        out.push({
          file,
          line: decl.line,
          component: decl.component,
          property: span.axis,
          option: span.option,
          options: prop.options,
          start: span.start,
          end: span.end,
        });
      }
    }
  }

  // Numbered rows are answered in another process, so the order has to be a
  // property of the project rather than of the walk that found them.
  out.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.property.localeCompare(b.property) ||
      a.option.localeCompare(b.option),
  );
  return { questions: out, hand };
}

/** What a question is, independent of where it happened to be numbered. */
const identity = (q) => `${q.file}:${q.line} ${q.component} ${q.property}=${q.option}`;

/**
 * Whether a drift's value sits inside the tag that declared it.
 *
 * An inline `style` and a `style={{…}}` prop belong to one element. A class rule
 * belongs to every element carrying the class, which is a different edit with
 * the same span, so the two cannot be reported as the same thing.
 */
function inDeclaringTag(finding) {
  const { fix } = finding;
  if (fix.file !== finding.file) return false;
  return declarations(finding.file).some(
    (d) => d.line === finding.line && fix.start >= d.start && fix.end <= d.end,
  );
}

/** The selector a value sits under, for a value that is not inside a tag. */
function ruleAround(src, at) {
  const open = src.lastIndexOf('{', at);
  if (open === -1) return null;
  const before = src.slice(0, open);
  const from = Math.max(
    before.lastIndexOf('}'),
    before.lastIndexOf('{'),
    before.lastIndexOf(';'),
    before.lastIndexOf('>'),
  );
  return src.slice(from + 1, open).trim() || null;
}

// ------------------------------------------------------------------- writing

/**
 * Spans written back to their files, back to front.
 *
 * Descending order per file because several drifts commonly land in one
 * stylesheet, and an earlier edit shifts every offset after it. `from` is
 * confirmed first: the sweep and the write are two runs of two different
 * processes, and an offset taken in the first is the one thing that cannot be
 * re-derived once something has moved it.
 */
function writeSpans(spans) {
  const byFile = new Map();
  for (const s of spans) {
    if (!byFile.has(s.file)) byFile.set(s.file, []);
    byFile.get(s.file).push(s);
  }
  const written = [];
  for (const [file, group] of byFile) {
    let body = readFileSync(abs(file), 'utf8');
    for (const s of [...group].sort((a, b) => b.start - a.start)) {
      if (body.slice(s.start, s.end) !== s.from) {
        console.error(
          `${file} no longer holds "${s.from}" where the sweep found it, so nothing was ` +
            'written to it. Re-run the sweep and act on what it says now.',
        );
        process.exit(1);
      }
      body = body.slice(0, s.start) + s.to + body.slice(s.end);
    }
    writeFileSync(abs(file), body);
    // Re-read on the next question, since every recorded offset in it has moved.
    sources.delete(file);
    written.push([file, group.length]);
  }
  return written;
}

// -------------------------------------------------------------- the questions

/**
 * The rows `--write` printed, so `--resolve` in another process can be held to
 * them.
 *
 * A row number is only worth anything if it still names what the reader saw, and
 * between the two calls a person can edit a file, take a re-capture, or run the
 * sweep again with different paths. So the identities are recorded beside a hash
 * of every file a row would write to, and `--resolve` re-derives the questions
 * from the project as it stands and refuses unless both agree. Answering the
 * wrong site is the one failure a numbered questionnaire can produce that the
 * reader cannot see.
 */
const LEDGER_REL = join('.pushpin', 'update.json');

function saveLedger(questions) {
  const path = join(root, LEDGER_REL);
  if (!questions.length) {
    // A ledger nobody can answer is a ledger that will be answered wrongly.
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        $comment:
          'The numbered judgement calls from the last `update.mjs --write`, so `--resolve` ' +
          'can prove a row still names what was printed. Derived state — delete it and ' +
          're-run --write. See reference/update.md.',
        pluginVersion: PLUGIN.version,
        rows: questions.map((q, i) => ({
          n: i + 1,
          identity: identity(q),
          file: q.file,
          fileHash: hashText(readFileSync(abs(q.file), 'utf8')),
          component: q.component,
          property: q.property,
          option: q.option,
        })),
      },
      null,
      2,
    ) + '\n',
  );
}

/** `{"1":"secondary"}` — the form copy.mjs's `--apply` takes for the same reason. */
function parseAnswers(spec) {
  const trimmed = spec.trim();
  if (!trimmed) {
    console.error('--resolve needs the answers: --resolve \'{"1":"secondary"}\'');
    return null;
  }
  if (!trimmed.startsWith('{')) {
    console.error(
      'A row number on its own is not an answer here — the whole point of a numbered row is ' +
        'that the substitute is a decision. Pass it: --resolve \'{"1":"secondary"}\'.',
    );
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    console.error(`--resolve was given something that starts like JSON and is not: ${e.message}`);
    return null;
  }
  const out = new Map();
  for (const [k, v] of Object.entries(parsed)) {
    if (!/^\d+$/.test(k)) {
      console.error(`--resolve keys are row numbers from the last --write; "${k}" is not one.`);
      return null;
    }
    if (typeof v !== 'string' || !v.trim()) {
      console.error(
        `--resolve values are the option to write instead. Row ${k} carries none, and there is ` +
          'no suggestion to fall back on.',
      );
      return null;
    }
    out.set(Number(k), v.trim());
  }
  if (!out.size) {
    console.error('--resolve named no rows.');
    return null;
  }
  return out;
}

// ------------------------------------------------------------------- reading

const found = sweep();
const findings = found.findings ?? [];

const drifts = findings.filter((f) => f.rule === 'variant-drift' && f.fix);
const mechanical = drifts.filter((f) => f.fix.start !== null);
const unplaced = drifts.filter((f) => f.fix.start === null);
const { questions, hand } = questionsFrom(findings);
const unknownComponents = findings.filter((f) => f.rule === 'unknown-component');
const lookalikes = findings.filter((f) => f.rule === 'undeclared-lookalike');

/**
 * One value, however many declarations are held against it.
 *
 * A class rule is reported once per element that reads it, and those are one
 * edit rather than several: writing the same span twice would replace the value
 * the first write just put there. The declaring tags all survive on the entry,
 * because how many of them a single value is answering for is the blast radius.
 */
const values = new Map();
for (const f of mechanical) {
  const { fix } = f;
  const key = `${fix.file}:${fix.start}:${fix.end}`;
  if (!values.has(key)) {
    const inTag = inDeclaringTag(f);
    values.set(key, {
      file: fix.file,
      start: fix.start,
      end: fix.end,
      from: fix.current,
      to: fix.want,
      where: `${fix.file}:${lineOf(source(fix.file), fix.start)}`,
      what: `${fix.property}: ${fix.current} → ${fix.want}`,
      selector: inTag ? null : ruleAround(source(fix.file), fix.start),
      shared: !inTag,
      declaredAt: [],
    });
  }
  values.get(key).declaredAt.push(`${f.file}:${f.line}`);
}

// A class rule's span is right and its reach is wider than the finding that
// named it: it repaints every element carrying the class, including any this
// sweep never saw. Said out loud rather than discovered afterwards.
for (const v of values.values()) {
  v.scope = v.shared
    ? `${v.selector ? `${v.selector} ` : ''}is a rule, so this repaints every element carrying it` +
      (v.declaredAt.length > 1 ? `, ${v.declaredAt.length} of them declared here` : '')
    : null;
}

const described = [...values.values()];

// --------------------------------------------------------------------- report

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const command = `node "${join(here, 'update.mjs')}"`;

const outstanding = () =>
  mechanical.length + unplaced.length + questions.length + hand.length + unknownComponents.length;

function reportMoved() {
  if (!moved.length && !pin) return;
  const lines = moved.map(
    (m) => `${m.label}: pinned to ${m.recorded}, ${m.from} now carries ${m.date}`,
  );
  // The pin's other reasons are init's business and are named rather than
  // acted on, so a reader is not told a sweep answered a stylesheet.
  const others = (pin?.details ?? []).filter(
    (d) => !CATALOGS.some(([, , label]) => d.startsWith(`${label}:`)),
  );
  if (!lines.length && !others.length) return;
  console.log('What moved');
  for (const l of lines) console.log(`  ${l}`);
  for (const o of others) console.log(`  ${o}`);
  // An overlay is provenanced in `.pushpin/assets/overlay.json` and nowhere in
  // the pin, so this line has nothing to be retired against and comes back
  // every run until the plugin ships a capture at least as new. Better said
  // than mistaken for a repair that did not take.
  if (moved.some((m) => m.from !== 'the plugin')) {
    console.log(
      `  pushpin.config.json records the plugin's capture dates and has no field for one this\n` +
        `  project took itself, so that line stands until the plugin ships one at least as new.`,
    );
  }
  console.log('');
}

function reportOpen() {
  if (questions.length) {
    console.log(
      `Judgement — ${plural(questions.length, 'declaration')} naming a variant the kit no longer publishes`,
    );
    questions.forEach((q, i) => {
      console.log(
        `  ${WRITE ? `${i + 1}. ` : ''}${q.file}:${q.line}  ${q.component} ${q.property}=${q.option}` +
          ` — one of ${q.options.join(' | ')}`,
      );
    });
    console.log('');
  }

  const byHand = [
    ...unplaced.map((f) => ({ where: f.fix.file, why: `${f.message} — ${f.fix.why}` })),
    ...hand.map((h) => ({ where: `${h.file}:${h.line}`, why: h.why })),
    ...unknownComponents.map((f) => ({ where: `${f.file}:${f.line}`, why: f.message })),
  ];
  if (byHand.length) {
    console.log(`By hand — ${plural(byHand.length, 'finding')} nothing here can address`);
    for (const b of byHand) console.log(`  ${b.where}  ${b.why}`);
    console.log('');
  }

  if (lookalikes.length) {
    // Undeclared markup is outside every part of this: it declares no component,
    // so no captured variant is attached to it and no sweep can hold it against
    // one. A count rather than a claim of coverage.
    console.log(
      `${plural(lookalikes.length, 'undeclared lookalike')} — markup that reads as a published ` +
        `component and declares nothing, so this sweep cannot hold ${lookalikes.length === 1 ? 'it' : 'them'} ` +
        `against anything. node "${join(here, 'check.mjs')}" <path> lists them.\n`,
    );
  }
}

// ---------------------------------------------------------------- --resolve

if (RESOLVING !== null) {
  const answers = parseAnswers(RESOLVING);
  if (!answers) process.exit(1);

  const ledgerPath = join(root, LEDGER_REL);
  if (!existsSync(ledgerPath)) {
    console.error(
      `No ${LEDGER_REL} in this project, so there are no numbered rows to answer.\n` +
        `Number them first:\n  ${command} --write`,
    );
    process.exit(1);
  }
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch (e) {
    console.error(
      `${LEDGER_REL} could not be parsed (${e.message}), so no row number in it can be trusted.\n` +
        `Number them again:\n  ${command} --write`,
    );
    process.exit(1);
  }

  const rows = Array.isArray(ledger.rows) ? ledger.rows : [];
  const now = questions.map(identity);
  const then = rows.map((r) => r.identity);
  const sameRows = now.length === then.length && now.every((id, i) => id === then[i]);

  // Two separate ways for a number to have stopped meaning what it meant, and
  // both are refusals rather than best efforts. A row list that no longer
  // matches means the project's questions changed; a file whose hash moved
  // means the file did, which is what invalidates the span inside it.
  if (!sameRows) {
    console.error(
      `The questions in this project are no longer the ones ${LEDGER_REL} numbered, so row 1 ` +
        `there is not row 1 here. Nothing was written.\n\n` +
        `  numbered: ${then.length}\n  now:      ${now.length}\n\n` +
        `Re-number them and pick again:\n  ${command} --write`,
    );
    process.exit(1);
  }
  const edited = rows.filter((r) => {
    if (!existsSync(abs(r.file))) return true;
    return hashText(readFileSync(abs(r.file), 'utf8')) !== r.fileHash;
  });
  if (edited.length) {
    console.error(
      `${[...new Set(edited.map((r) => r.file))].join(', ')} changed after the rows were ` +
        `numbered, so an offset taken then may point anywhere now. Nothing was written.\n\n` +
        `Re-number them and pick again:\n  ${command} --write`,
    );
    process.exit(1);
  }

  const spans = [];
  const applied = [];
  for (const [n, picked] of [...answers].sort((a, b) => a[0] - b[0])) {
    const q = questions[n - 1];
    if (!q) {
      console.error(
        `There is no row ${n}. The last --write numbered ${questions.length}. Nothing was written.`,
      );
      process.exit(1);
    }
    if (!q.options.includes(picked)) {
      console.error(
        `Row ${n} is ${q.component}.${q.property}, and the kit does not publish "${picked}" — ` +
          `one of ${q.options.join(' | ')}. Nothing was written.`,
      );
      process.exit(1);
    }
    spans.push({ file: q.file, start: q.start, end: q.end, from: q.option, to: picked });
    applied.push({ n, ...q, picked });
  }

  const written = writeSpans(spans);
  // The remaining rows are renumbered by the answers just applied, so the
  // ledger goes rather than being edited down: a stale number that still
  // resolves is worse than one that refuses.
  rmSync(join(root, LEDGER_REL), { force: true });

  if (asJson) {
    console.log(JSON.stringify({ root, applied, files: written.map(([f]) => f) }, null, 2));
    process.exit(0);
  }

  for (const a of applied) {
    console.log(`${a.n}. ${a.file}:${a.line}  ${a.component} ${a.property}=${a.option} → ${a.picked}`);
  }
  console.log(
    `\nWrote ${plural(applied.length, 'answer')} across ${plural(written.length, 'file')}.`,
  );
  const left = questions.length - applied.length;
  if (left) {
    console.log(
      `${plural(left, 'question')} left unanswered, and the numbering is spent — re-run ` +
        `${command} --write for the rest.`,
    );
  }
  process.exit(0);
}

// ------------------------------------------------------------- report / --write

if (asJson && !WRITE) {
  console.log(
    JSON.stringify(
      {
        root,
        moved,
        pin: pin && { status: pin.status, reasons: pin.reasons, details: pin.details },
        files: found.files,
        mechanical: described,
        questions,
        hand,
        unknownComponents,
        undeclared: lookalikes.length,
      },
      null,
      2,
    ),
  );
  process.exit(outstanding() ? 1 : 0);
}

if (!WRITE) {
  console.log(`Project   ${root}`);
  console.log(`Plugin    ${PLUGIN.version} — ${here}`);
  console.log('');
  reportMoved();

  if (!outstanding()) {
    console.log(
      `Swept ${plural(found.files, 'file')}. Every declared component matches the catalog it names.\n`,
    );
    // Undeclared markup is the one thing left to say here, and it is a count
    // rather than a finding: nothing in this run can act on it.
    reportOpen();
    process.exit(0);
  }

  console.log(`Swept ${plural(found.files, 'file')}.\n`);

  if (described.length) {
    console.log(`Mechanical — ${plural(described.length, 'value')} whose replacement is not a decision`);
    for (const d of described) {
      console.log(`  ${d.where}  ${d.what}`);
      console.log(
        `    declared at ${d.declaredAt.join(', ')}${d.scope ? `; ${d.scope}` : ''}`,
      );
    }
    console.log('');
  }
  reportOpen();

  const offer = [
    described.length && `apply the ${described.length === 1 ? 'fix' : 'fixes'} above`,
    questions.length && 'number the questions',
  ]
    .filter(Boolean)
    .join(' and ');
  console.log(
    offer
      ? `Nothing was written. To ${offer}:\n  ${command} --write`
      : 'Nothing was written, and nothing above is this script\'s to write — every one of them is a hand fix.',
  );
  process.exit(1);
}

// --------------------------------------------------------------------- --write

const written = described.length ? writeSpans(described) : [];

/**
 * The pin, brought current after the sweep and never before it.
 *
 * `init --write --force` answers the pin's mechanical half — an older
 * stylesheet, an older build of the generated files, the recorded catalog dates
 * — and answers the catalog reason by rewriting the dates rather than by
 * looking at anything. Run first it would erase the reason to sweep; run here
 * it records that the sweep happened against these catalogs.
 *
 * Withheld where the pin says something was hand-edited, because `--force`
 * replaces those files and a repair that deletes somebody's work is not one.
 */
const AUTHORED = ['edited', 'generated-edited'];
const authored = (pin?.reasons ?? []).filter((r) => AUTHORED.includes(r));

/**
 * `--no-share` because the one file init writes that a team commits is
 * `.claude/settings.json`, and a repair nobody asked for has no business
 * editing it. The rest replay what this project already chose: a `--force`
 * rewrite computes the hook and the preview from the stack it detects, so a
 * project that declined either would have it installed by the run that was
 * only meant to bring its pin current.
 */
const initArgs = [
  join(here, 'init.mjs'),
  root,
  '--write',
  '--force',
  '--no-share',
  ...(config.checkHook === false ? ['--no-hook'] : []),
  ...(config.preview === false ? ['--no-preview'] : []),
  ...(config.preview?.autostart && config.preview.port
    ? ['--preview-port', String(config.preview.port)]
    : []),
];
const initCmd = `node ${initArgs.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
let pinNote = null;

if (pin && pin.status !== 'ok' && !NO_INIT) {
  if (authored.length) {
    pinNote =
      `The pin is behind, and this project has hand-edited files that --force would replace, ` +
      `so it was left alone. Read the lines above, then decide:\n  ${initCmd}`;
  } else {
    try {
      execFileSync('node', initArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      pinNote = 'pushpin.config.json now records the catalogs this sweep ran against.';
    } catch (e) {
      // The first line of it: init says why on stderr, and a stack trace
      // relayed into this report buries the sentence and the command below it.
      const why = String(e.stderr || e.message).trim().split('\n')[0];
      pinNote = `The pin could not be brought current — ${why}\nRun it yourself:\n  ${initCmd}`;
    }
  }
}

saveLedger(questions);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        root,
        moved,
        wrote: written.map(([file, count]) => ({ file, spans: count })),
        mechanical: described,
        questions: questions.map((q, i) => ({ n: i + 1, ...q })),
        hand,
        unknownComponents,
        undeclared: lookalikes.length,
        pin: pinNote,
        resolve: `${command} --resolve '{"1":"<option>"}'`,
      },
      null,
      2,
    ),
  );
  process.exit(questions.length + hand.length + unplaced.length + unknownComponents.length ? 1 : 0);
}

console.log(`Project   ${root}`);
console.log(`Plugin    ${PLUGIN.version} — ${here}`);
console.log('');
reportMoved();

if (described.length) {
  console.log('Wrote');
  for (const d of described) {
    console.log(`  ${d.where}  ${d.what}`);
    if (d.scope) console.log(`    ${d.scope}`);
  }
  console.log(
    `\nApplied ${plural(described.length, 'value')} across ${plural(written.length, 'file')}, ` +
      `answering ${plural(mechanical.length, 'drifted declaration')}.\n`,
  );
} else {
  console.log(`Swept ${plural(found.files, 'file')}. Nothing mechanical to write.\n`);
}

reportOpen();

if (pinNote) console.log(`${pinNote}\n`);

if (questions.length) {
  console.log(
    `Pick an option per row and pass them back in one call:\n` +
      `  ${command} --resolve '${JSON.stringify(
        Object.fromEntries(questions.map((q, i) => [String(i + 1), q.options[0]])),
      )}'\n` +
      `The numbers hold only while the project does — ${LEDGER_REL} records what they meant, and ` +
      `a --resolve against a project that has changed since refuses rather than writing to the ` +
      `wrong site.`,
  );
}

process.exit(questions.length + hand.length + unplaced.length + unknownComponents.length ? 1 : 0);

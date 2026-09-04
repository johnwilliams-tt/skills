#!/usr/bin/env node
/**
 * Turns freshly distilled assets into a release: the tail of
 * reference/maintaining.md's refresh procedure as one command, so CI and a
 * maintainer run the same steps in the same order and neither can skip one.
 *
 * What it does, in order: refuses to run anywhere but the plugin's own checkout
 * with a tree that is clean outside pushpin/; runs build-css, build-design,
 * build-copy --check, manifest and verify, stopping on the first failure with
 * that tool's own output; writes the CHANGELOG.md entry for the new version
 * from what moved; bumps the version through version.mjs; rebuilds the two
 * generated files that embed the version; and makes one commit of the assets,
 * the changelog and the version files. It never pushes — the workflow does.
 *
 * Why the entry is generated rather than typed. The changelog is the one place
 * a consumer reads what a capture moved, and a release cut by a cron job has
 * nobody to type it. Two sources feed it. `--diff` takes the output of
 * diff.mjs (`--json` or the printed report), which knows values — a hex that
 * moved, a variant option that appeared — and which is taken before the
 * distillers overwrite the catalogs it compares against. Without it, or for the
 * catalogs diff.mjs does not compare (specs, annotations, the copy source), the
 * entry comes from `git diff HEAD` of the captures themselves: which capture
 * dates moved and which entry names appeared, disappeared or changed. That is
 * less than diff.mjs knows and it is never wrong, which is the bar for a
 * sentence nobody proofreads.
 *
 * Why two build passes. DESIGN.md and design.json name the plugin version, so
 * a build taken before the bump ships the previous number and
 * `build-design --check` goes red on the next run — which is exactly what a
 * hand-run bump did. The first pass validates the distilled assets before
 * anything is written; the second rebuilds the version-bearing files and
 * rehashes them after the bump.
 *
 * Why breaking needs a flag. maintaining.md step 4 rules that a removed
 * component, a retired token or a variable that became hidden is a decision
 * with the design system owner, and diff.mjs exits non-zero on exactly those.
 * A diff carrying a Breaking item therefore stops here unless a person passes
 * `--allow-breaking`, so the unattended path cannot release one by accident.
 *
 * Usage:
 *   node scripts/release.mjs <patch|minor|major|x.y.z> [--dry-run]
 *                            [--diff <diff.json|diff.txt>] [--changelog-note "..."]
 *                            [--allow-breaking]
 *
 *   --dry-run          run the guards and the first build pass, print the entry,
 *                      the version and the commit it would make; write none of it
 *   --diff FILE        output of `diff.mjs --json` (or its printed report), taken
 *                      against the committed catalogs before they were replaced
 *   --changelog-note   a paragraph placed at the top of the entry, for context
 *                      the diff cannot know (why the capture was taken)
 *   --allow-breaking   release an entry that carries Breaking items
 *
 * Exit codes: 0 released (or, under --dry-run, would have), 2 nothing to
 * release, 1 anything else.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(here, '..');
const PLUGIN_ROOT = resolve(SKILL_ROOT, '..');
const REPO_ROOT = resolve(PLUGIN_ROOT, '..');
const ASSETS = join(SKILL_ROOT, 'assets');

const PLUGIN_JSON = join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
const CURSOR_JSON = join(PLUGIN_ROOT, '.cursor-plugin', 'plugin.json');
const SKILL_MD = join(SKILL_ROOT, 'SKILL.md');
const CHANGELOG = join(PLUGIN_ROOT, 'CHANGELOG.md');
const MARKETPLACES = [
  join(REPO_ROOT, '.claude-plugin', 'marketplace.json'),
  join(REPO_ROOT, '.cursor-plugin', 'marketplace.json'),
];

/**
 * The files this script writes. They have to be clean when it starts, because
 * the commit takes them whole: a hand edit sitting in SKILL.md would ride into
 * "Release x.y.z", and a plugin.json already bumped by hand would be bumped
 * again. The marketplace entries are here because version.mjs rewrites them
 * when their description drifts, and a release should carry that repair rather
 * than leave it uncommitted.
 */
const OWNED = [CHANGELOG, PLUGIN_JSON, CURSOR_JSON, SKILL_MD, ...MARKETPLACES];

const SEMVER = /^\d+\.\d+\.\d+$/;
const within = (root, p) => p === root || p.startsWith(root + sep);
const rel = (p) => relative(REPO_ROOT, p).split(sep).join('/');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

const fail = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

// ------------------------------------------------------------------ arguments

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const value = (n) => (has(n) ? argv[argv.indexOf(n) + 1] : null);

const consumed = new Set();
for (const flag of ['--diff', '--changelog-note']) {
  const i = argv.indexOf(flag);
  if (i >= 0) consumed.add(i + 1);
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !consumed.has(i));

const DRY = has('--dry-run');
const ALLOW_BREAKING = has('--allow-breaking');
const DIFF_PATH = value('--diff');
const NOTE = value('--changelog-note');

const usage =
  'usage: node scripts/release.mjs <patch|minor|major|x.y.z> [--dry-run] [--diff FILE]\n' +
  '                                [--changelog-note "..."] [--allow-breaking]';

if (has('--help') || has('-h')) {
  console.log(usage);
  process.exit(0);
}
if (positional.length !== 1) fail(usage);
const BUMP = positional[0];
if (!['patch', 'minor', 'major'].includes(BUMP) && !SEMVER.test(BUMP)) {
  fail(`"${BUMP}" is not patch, minor, major or a semver.\n${usage}`);
}
if (DIFF_PATH && !existsSync(DIFF_PATH)) fail(`--diff ${DIFF_PATH}: no such file`);

// ------------------------------------------------------------------------ git

function git(args, { allowFailure = false } = {}) {
  const r = spawnSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' });
  if (r.status !== 0 && !allowFailure) {
    fail(`git ${args.join(' ')} failed:\n${r.stderr.trim()}`);
  }
  return r;
}

/** Working-tree paths git reports as changed, relative to the repo root. */
function dirtyPaths() {
  const out = git(['status', '--porcelain=v1', '--untracked-files=all', '-z']).stdout;
  const paths = [];
  const fields = out.split('\0');
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f) continue;
    paths.push(f.slice(3));
    // A rename is two fields: `R  new` followed by the old path.
    if (f[0] === 'R' || f[0] === 'C') paths.push(fields[++i]);
  }
  return paths;
}

// --------------------------------------------------------------------- guards

/**
 * This has to be the plugin's own source checkout. A plugin-cache install has
 * the same layout and the same scripts, and running the builds there would
 * rewrite files the host deletes on the next update; a consumer's project is
 * the one place this must never commit. Path identity with the running file,
 * never a name — the same rule init.mjs and update.mjs apply.
 */
function requireOwnCheckout() {
  const manifest = existsSync(PLUGIN_JSON) ? readJson(PLUGIN_JSON) : null;
  if (!manifest || manifest.name !== 'pushpin') {
    fail(`${PLUGIN_JSON} is not the pushpin plugin manifest, so this is not the plugin's checkout.`);
  }
  const marketplace = MARKETPLACES[0];
  const listed =
    existsSync(marketplace) && readJson(marketplace).plugins?.some((p) => p.name === 'pushpin');
  const top = git(['rev-parse', '--show-toplevel'], { allowFailure: true });
  const toplevel = top.status === 0 ? realpathSync(top.stdout.trim()) : null;
  if (!listed || toplevel !== realpathSync(REPO_ROOT)) {
    fail(
      `${PLUGIN_ROOT} is not the plugin's own git checkout — this looks like an installed copy.\n` +
        'A release is cut from the source repository: see reference/maintaining.md.',
    );
  }
  const cwd = realpathSync(process.cwd());
  if (!within(realpathSync(REPO_ROOT), cwd)) {
    fail(
      `Run this from inside ${REPO_ROOT}, not from ${cwd}.\n` +
        'The working directory is a consumer project or somewhere unrelated, and a release\n' +
        'commit is only ever cut from the checkout that holds the assets.',
    );
  }
}

/**
 * Only pushpin/ may be dirty, and the files this script writes may not be. The
 * commit adds explicit paths so nothing else could land in it, but a tree with
 * unrelated work in flight is a sign the release is being cut from the wrong
 * state, and a partly-written release is impossible to tell from a finished one.
 */
function requireCleanOutsidePlugin() {
  const dirty = dirtyPaths();
  const outside = dirty.filter((p) => !p.startsWith(`${rel(PLUGIN_ROOT)}/`));
  if (outside.length) {
    fail(
      `The working tree has changes outside ${rel(PLUGIN_ROOT)}/:\n` +
        outside.map((p) => `  ${p}`).join('\n') +
        '\n\nA release commit is only ever the assets, the generated files, the manifest, the\n' +
        'changelog and the version files. Commit or stash the rest first.',
    );
  }
  const owned = OWNED.map(rel).filter((p) => dirty.includes(p));
  if (owned.length) {
    fail(
      'These files are written by the release and have uncommitted changes:\n' +
        owned.map((p) => `  ${p}`).join('\n') +
        '\n\nThe commit would take them whole. Commit or stash those edits first.',
    );
  }
}

// ------------------------------------------------------------- what moved

/**
 * Each capture, and how to read the parts of it a changelog entry can state
 * truthfully without knowing Figma: the dates it was taken and the names of
 * its entries. `groups` returns named maps of entry -> value; `dates` returns
 * labelled date strings. Both are compared against the committed copy.
 */
const real = (o) => Object.entries(o ?? {}).filter(([k]) => !k.startsWith('$'));
const named = (o) => Object.fromEntries(real(o));

const CATALOGS = {
  'tokens.figma.json': {
    dates: (j) => ({ captured: j.source?.extractedAt }),
    groups: (j) =>
      Object.fromEntries(
        Object.entries(j)
          .filter(([k, v]) => !k.startsWith('$') && k !== 'source' && v && typeof v === 'object')
          .map(([k, v]) => [k, named(v)]),
      ),
    covers: (line, j) =>
      Object.keys(j)
        .filter((k) => !k.startsWith('$') && k !== 'source')
        .some((k) => line.startsWith(`${k}:`) || line.startsWith(`${k}/`)) ||
      line.startsWith('collection "'),
  },
  'variable-keys.figma.json': {
    dates: (j) => ({ captured: j.source?.extractedAt, verified: j.source?.verifiedAt }),
    groups: (j) => ({
      ...Object.fromEntries(real(j.bindable).map(([c, e]) => [`bindable · ${c}`, named(e)])),
      ...Object.fromEntries(
        real(j.hiddenFromPublishing).map(([c, names]) => [
          `hidden · ${c}`,
          Object.fromEntries((names ?? []).map((n) => [n, true])),
        ]),
      ),
    }),
    covers: (line, j) =>
      real(j.bindable).some(([c]) => line.startsWith(`${c}/`)) ||
      /published (library|key)|now published and bindable/.test(line),
  },
  'styles.figma.json': {
    dates: (j) => ({ captured: j.source?.extractedAt }),
    groups: (j) => ({ textStyles: named(j.textStyles), effectStyles: named(j.effectStyles) }),
    covers: (line) => /^(textStyles|effectStyles)[:/]/.test(line),
  },
  'components.figma.json': {
    dates: (j) => ({
      captured: j.source?.extractedAt,
      properties: j.source?.propertiesCapturedAt,
    }),
    groups: (j) => ({ components: named(j.components) }),
    covers: (line) => /^components[:/]/.test(line),
  },
  'component-specs.figma.json': {
    dates: (j) => ({
      captured: j.source?.extractedAt,
      ...Object.fromEntries(
        Object.entries(j.source?.pageCaptures ?? {}).map(([page, d]) => [`page ${page}`, d]),
      ),
    }),
    groups: (j) => ({ specs: named(j.components) }),
    covers: () => false,
  },
  'annotations.figma.json': {
    dates: (j) => ({ captured: j.source?.extractedAt }),
    groups: (j) => ({ annotations: named(j.components) }),
    covers: () => false,
  },
  'icons.figma.json': {
    dates: (j) => ({ captured: j.source?.extractedAt }),
    groups: (j) => ({ icons: named(j.icons) }),
    covers: (line) => /^icons[:/]/.test(line),
  },
  'copy.source.json': {
    dates: (j) => ({ pulled: j.extractedAt, sha: j.sha }),
    groups: () => ({}),
    covers: () => false,
  },
};

/** The committed copy of an asset, or null when HEAD has none. */
function committed(file) {
  const r = git(['show', `HEAD:${rel(join(ASSETS, file))}`], { allowFailure: true });
  return r.status === 0 ? JSON.parse(r.stdout) : null;
}

const listNames = (names, cap = 12) =>
  names.slice(0, cap).join(', ') + (names.length > cap ? `, +${names.length - cap} more` : '');

/**
 * What moved in each capture since HEAD, as changelog lines. Removed names are
 * Breaking because every catalog entry is something a consumer imports by key
 * or addresses by name; added names are Added; anything else that differs
 * inside an entry is Changed, counted and named but not described, because the
 * shape of an entry is not the same across catalogs and a wrong description is
 * worse than a short one.
 */
function movedSinceHead() {
  const moved = [];
  for (const [file, reader] of Object.entries(CATALOGS)) {
    const path = join(ASSETS, file);
    if (!existsSync(path)) continue;
    const now = readJson(path);
    const was = committed(file);
    const dates = [];
    const lines = { breaking: [], changed: [], added: [] };

    for (const [label, d] of Object.entries(reader.dates(now))) {
      const before = was ? reader.dates(was)[label] : undefined;
      if (d && d !== before) dates.push({ label, before: before ?? null, after: d });
    }

    const groupsNow = reader.groups(now);
    const groupsWas = was ? reader.groups(was) : {};
    for (const group of new Set([...Object.keys(groupsWas), ...Object.keys(groupsNow)])) {
      const a = groupsWas[group] ?? {};
      const b = groupsNow[group] ?? {};
      const removed = Object.keys(a).filter((n) => !(n in b));
      const added = Object.keys(b).filter((n) => !(n in a));
      const changed = Object.keys(b).filter(
        (n) => n in a && JSON.stringify(a[n]) !== JSON.stringify(b[n]),
      );
      const at = `${file} · ${group}`;
      for (const n of removed) lines.breaking.push(`${at}: "${n}" is no longer in the capture`);
      for (const n of added) lines.added.push(`${at}: "${n}" is new`);
      if (changed.length) {
        lines.changed.push(
          `${at}: ${changed.length} entr${changed.length === 1 ? 'y' : 'ies'} changed — ` +
            listNames(changed),
        );
      }
    }

    const sourceChanged = JSON.stringify(was) !== JSON.stringify(now);
    if (sourceChanged) moved.push({ file, now, dates, lines });
  }
  return moved;
}

// ------------------------------------------------------------ the diff input

/**
 * diff.mjs output, either shape. The JSON is `{ breaking, changed, added,
 * notes }`. The printed report has a heading per non-empty list followed by
 * two-space-indented items, and "No changes." when there are none. Anything
 * else is refused rather than read as an empty diff, because an empty diff
 * means "release with a sparse entry" and a misread file must not.
 */
function readDiff(path) {
  const text = readFileSync(path, 'utf8');
  if (text.trimStart().startsWith('{')) {
    const j = JSON.parse(text);
    for (const k of ['breaking', 'changed', 'added']) {
      if (!Array.isArray(j[k])) fail(`--diff ${path}: JSON has no "${k}" list`);
    }
    return { breaking: j.breaking, changed: j.changed, added: j.added };
  }
  const out = { breaking: [], changed: [], added: [] };
  const HEADINGS = { BREAKING: 'breaking', CHANGED: 'changed', ADDED: 'added' };
  let current = null;
  let recognised = /^No changes\./m.test(text);
  for (const line of text.split('\n')) {
    const h = /^(BREAKING|CHANGED|ADDED) — .*\(\d+\)$/.exec(line);
    if (h) {
      current = HEADINGS[h[1]];
      recognised = true;
      continue;
    }
    if (/^\S/.test(line) || !line.trim()) {
      current = null;
      continue;
    }
    if (current) out[current].push(line.trim());
  }
  if (!recognised) fail(`--diff ${path}: not diff.mjs output (no section headings, no "No changes.")`);
  return out;
}

// ------------------------------------------------------------------ the entry

const today = () => new Date().toISOString().slice(0, 10);

/** Prose wrapped at the column the rest of the changelog is written to. */
function wrap(text, { first = '', rest = '' } = {}, width = 80) {
  const lines = [];
  let line = first;
  let bare = true;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!bare && line.length + 1 + word.length > width) {
      lines.push(line);
      line = rest + word;
    } else {
      line = bare ? line + word : `${line} ${word}`;
    }
    bare = false;
  }
  lines.push(line);
  return lines.join('\n');
}

/**
 * One entry in the CHANGELOG.md house style: heading, a paragraph or two of
 * prose, then the three diff.mjs categories as bold labels over bullet lists,
 * empty ones omitted. The prose states which captures moved and when, because
 * that is the fact every project pin compares against.
 */
function composeEntry(version, moved, diff) {
  const breaking = [];
  const changed = [];
  const added = [];

  if (diff) {
    breaking.push(...diff.breaking);
    changed.push(...diff.changed);
    added.push(...diff.added);
  }
  const diffLines = diff ? [...diff.breaking, ...diff.changed, ...diff.added] : [];

  for (const m of moved) {
    // With a diff in hand, the git view of a catalog diff.mjs compared would
    // restate its items in a vaguer form; it is used only for the catalogs the
    // diff never looked at.
    const reader = CATALOGS[m.file];
    if (diff && diffLines.some((l) => reader.covers(l, m.now))) continue;
    breaking.push(...m.lines.breaking);
    changed.push(...m.lines.changed);
    added.push(...m.lines.added);
  }

  const recaptured = moved
    .filter((m) => m.dates.length)
    .map((m) => {
      const pages = m.dates.filter((d) => d.label.startsWith('page '));
      const rest = m.dates.filter((d) => !d.label.startsWith('page '));
      const parts = rest.map((d) => `${d.label} ${d.before ?? 'none'} → ${d.after}`);
      if (pages.length) {
        const byDate = new Map();
        for (const p of pages) {
          const list = byDate.get(p.after) ?? [];
          list.push(p.label.slice(5));
          byDate.set(p.after, list);
        }
        for (const [date, names] of byDate) {
          parts.push(`pages ${listNames(names)} re-read ${date}`);
        }
      }
      return `\`${m.file}\` (${parts.join('; ')})`;
    });
  const unchangedButMoved = moved.filter(
    (m) => !m.dates.length && !m.lines.breaking.length && !m.lines.changed.length && !m.lines.added.length,
  );

  const paragraphs = [];
  if (NOTE) paragraphs.push(NOTE.trim());
  if (recaptured.length) paragraphs.push(`Re-captured: ${recaptured.join(', ')}.`);
  if (unchangedButMoved.length) {
    paragraphs.push(
      `${unchangedButMoved.map((m) => `\`${m.file}\``).join(', ')} changed without a new ` +
        'capture date or a moved entry — a header or note edit.',
    );
  }
  const total = breaking.length + changed.length + added.length;
  if (!total && recaptured.length) {
    paragraphs.push('Every entry is unchanged; only the capture dates moved.');
  }

  const section = (title, items) =>
    items.length
      ? `**${title}**\n\n${items.map((i) => wrap(i, { first: '- ', rest: '  ' })).join('\n')}\n\n`
      : '';

  const body =
    `## ${version} — ${today()}\n\n` +
    paragraphs.map((p) => `${wrap(p)}\n\n`).join('') +
    section('Breaking', breaking) +
    section('Changed', changed) +
    section('Added', added);

  const counts = [
    [breaking.length, 'breaking'],
    [changed.length, 'changed'],
    [added.length, 'added'],
  ]
    .filter(([n]) => n)
    .map(([n, w]) => `${n} ${w}`);
  const files = moved.map((m) => m.file.replace(/\.(figma|source)\.json$/, ''));
  const summary =
    (counts.length ? counts.join(', ') : 'capture dates moved') +
    (files.length ? ` in ${listNames(files, 6)}` : '');

  return { body: body.trimEnd() + '\n', summary, breaking };
}

/** The new entry goes above the first existing one, under the file's preamble. */
function insertEntry(entry) {
  const text = readFileSync(CHANGELOG, 'utf8');
  const at = text.search(/^## /m);
  if (at === -1) fail(`${rel(CHANGELOG)} has no "## " entry to insert above.`);
  writeFileSync(CHANGELOG, `${text.slice(0, at)}${entry}\n${text.slice(at)}`);
}

// ------------------------------------------------------------------- running

const script = (name) => join(here, name);

/** A build tool, with its own stdout and stderr; the first failure ends the run. */
function run(name, ...args) {
  console.log(`\n$ node scripts/${name}${args.length ? ` ${args.join(' ')}` : ''}`);
  const r = spawnSync(process.execPath, [script(name), ...args], {
    cwd: SKILL_ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    fail(`\n${name}${args.length ? ` ${args.join(' ')}` : ''} exited ${r.status ?? r.signal}. Nothing was released.`);
  }
}

function currentVersion() {
  const v = readJson(PLUGIN_JSON).version;
  if (!SEMVER.test(v ?? '')) fail(`${rel(PLUGIN_JSON)} has an unparseable version: ${v}`);
  return v;
}

function nextVersion(current) {
  if (SEMVER.test(BUMP)) return BUMP;
  const [major, minor, patch] = current.split('.').map(Number);
  if (BUMP === 'major') return `${major + 1}.0.0`;
  if (BUMP === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The identity flags git needs when the environment has none; CI sets its own. */
function identity() {
  const name = git(['config', 'user.name'], { allowFailure: true }).stdout.trim();
  const email = git(['config', 'user.email'], { allowFailure: true }).stdout.trim();
  if (name && email) return [];
  return ['-c', 'user.name=pushpin release.mjs', '-c', 'user.email=noreply@github.com'];
}

requireOwnCheckout();
requireCleanOutsidePlugin();

const from = currentVersion();
const to = nextVersion(from);
if (to === from) fail(`${to} is already the version in ${rel(PLUGIN_JSON)}.`);
const changelog = readFileSync(CHANGELOG, 'utf8');
if (new RegExp(`^## ${to.replace(/\./g, '\\.')} `, 'm').test(changelog)) {
  fail(`${rel(CHANGELOG)} already has an entry for ${to}.`);
}

const moved = movedSinceHead();
if (!moved.length) {
  const derived = dirtyPaths().filter((p) => p.startsWith(`${rel(ASSETS)}/`));
  fail(
    'Nothing to release: every capture under assets/ matches HEAD.' +
      (derived.length
        ? '\nThese files differ from HEAD, but no capture date or entry moved — a generated file\n' +
          'or a formatting change — so they are not a release:\n' +
          derived.map((p) => `  ${p}`).join('\n')
        : ''),
    2,
  );
}

const diff = DIFF_PATH ? readDiff(DIFF_PATH) : null;
const entry = composeEntry(to, moved, diff);

// Decided before the builds so a refused release writes nothing at all.
if (entry.breaking.length && !ALLOW_BREAKING) {
  fail(
    `The entry for ${to} carries ${entry.breaking.length} Breaking item(s):\n` +
      entry.breaking.map((b) => `  ${b}`).join('\n') +
      '\n\nA breaking change is a decision with the design system owner (reference/maintaining.md\n' +
      'step 4), not a release. Once decided, pass --allow-breaking.',
  );
}

console.log(`Releasing ${from} → ${to}${DRY ? ' (dry run)' : ''}`);
run('build-css.mjs');
run('build-design.mjs');
run('build-copy.mjs', '--check');
run('manifest.mjs');
run('verify.mjs');

const toCommit = [ASSETS, ...OWNED].filter(existsSync).map(rel);
const title = `Release ${to}: ${entry.summary}`;

console.log(`\nChangelog entry:\n\n${entry.body}`);

if (DRY) {
  console.log('Dry run. Would have:');
  console.log(`  written the entry above to ${rel(CHANGELOG)}`);
  console.log(`  run version.mjs ${to}, then rebuilt DESIGN.md, design.json and manifest.json`);
  console.log(`  committed as "${title}":`);
  for (const p of toCommit) console.log(`    ${p}`);
  process.exit(0);
}

insertEntry(entry.body);
run('version.mjs', to);
run('build-design.mjs');
run('manifest.mjs');
run('verify.mjs');
run('version.mjs', '--check');

git(['add', '-A', '--', ...toCommit]);
const staged = git(['diff', '--cached', '--name-only']).stdout.trim().split('\n').filter(Boolean);
const stray = staged.filter((p) => !toCommit.some((c) => p === c || p.startsWith(`${c}/`)));
if (stray.length) {
  fail(`Staged paths outside the release set, which should be impossible:\n  ${stray.join('\n  ')}`);
}

const message = entry.body.replace(/^## .*\n\n/, '').trimEnd();
git([...identity(), 'commit', '--quiet', '-m', title, '-m', message]);
const sha = git(['rev-parse', '--short', 'HEAD']).stdout.trim();

console.log(`\nCommitted ${sha} "${title}"`);
for (const p of staged) console.log(`  ${p}`);
console.log('\nNot pushed. Push it, or let the workflow.');

#!/usr/bin/env node
/**
 * Makes pushpin/.claude-plugin/plugin.json the one place the version and the
 * catalog description are written, and pushes both everywhere else they appear.
 *
 * The version lived in four files and the description in five, which is four
 * and five chances to publish a release nobody receives. Claude Code keys its
 * plugin cache on the version string and skips the update when it matches, so a
 * manifest left at the old number is indistinguishable from no release at all —
 * and the docs warn that a `version` in plugin.json silently masks one in the
 * marketplace entry, so the two disagreeing is worse than either being wrong.
 * The marketplace entries no longer carry a version for that reason.
 *
 * SKILL.md's `description` is deliberately not synced. It is the sentence the
 * model reads to decide whether to load the skill, and it names trigger
 * conditions rather than describing the product. The plugin description is
 * catalog copy for a human browsing `/plugin`. They are different jobs.
 *
 * Usage:
 *   node scripts/version.mjs            # report the version and where it landed
 *   node scripts/version.mjs --check    # exit 1 if any copy has drifted
 *   node scripts/version.mjs patch      # bump, then propagate
 *   node scripts/version.mjs minor
 *   node scripts/version.mjs major
 *   node scripts/version.mjs 1.2.3      # set an exact version
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(here, '..');
const PLUGIN_ROOT = join(SKILL_ROOT, '..');
const REPO_ROOT = join(PLUGIN_ROOT, '..');

const SOURCE = join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
const CURSOR_PLUGIN = join(PLUGIN_ROOT, '.cursor-plugin', 'plugin.json');
const SKILL = join(SKILL_ROOT, 'SKILL.md');
const CLAUDE_MARKET = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
const CURSOR_MARKET = join(REPO_ROOT, '.cursor-plugin', 'marketplace.json');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const writeJson = (f, o) => writeFileSync(f, `${JSON.stringify(o, null, 2)}\n`);
const show = (f) => relative(REPO_ROOT, f);

/** The plugin's own entry in a marketplace file, by name. */
const entryOf = (market, name) => market.plugins?.find((p) => p.name === name);

function bump(version, how) {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`${show(SOURCE)} has an unparseable version: ${version}`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (how === 'major') return `${major + 1}.0.0`;
  if (how === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Every place a value is mirrored, as a read/write pair. Returning the writer
 * rather than performing the write lets --check and the real run share one
 * description of where things live, so they cannot disagree about it.
 */
function mirrors(version, description, name) {
  const cursorPlugin = readJson(CURSOR_PLUGIN);
  const claudeMarket = readJson(CLAUDE_MARKET);
  const cursorMarket = readJson(CURSOR_MARKET);
  const claudeEntry = entryOf(claudeMarket, name);
  const cursorEntry = entryOf(cursorMarket, name);

  if (!claudeEntry) throw new Error(`${show(CLAUDE_MARKET)} has no "${name}" entry`);
  if (!cursorEntry) throw new Error(`${show(CURSOR_MARKET)} has no "${name}" entry`);

  const skill = readFileSync(SKILL, 'utf8');
  const skillVersion = /^version:[ \t]*(.+)$/m.exec(skill);
  if (!skillVersion) throw new Error(`${show(SKILL)} has no version in its frontmatter`);

  return [
    {
      what: `${show(CURSOR_PLUGIN)} version`,
      is: cursorPlugin.version,
      want: version,
      set: () => writeJson(CURSOR_PLUGIN, { ...cursorPlugin, version }),
    },
    {
      what: `${show(CURSOR_PLUGIN)} description`,
      is: cursorPlugin.description,
      want: description,
      set: () => writeJson(CURSOR_PLUGIN, { ...cursorPlugin, version, description }),
    },
    {
      what: `${show(SKILL)} version`,
      is: skillVersion[1].trim(),
      want: version,
      set: () =>
        writeFileSync(SKILL, skill.replace(/^version:[ \t]*.+$/m, `version: ${version}`)),
    },
    {
      what: `${show(CLAUDE_MARKET)} description`,
      is: claudeEntry.description,
      want: description,
      set: () => {
        claudeEntry.description = description;
        // A version here would be shadowed by plugin.json without warning.
        delete claudeEntry.version;
        writeJson(CLAUDE_MARKET, claudeMarket);
      },
    },
    {
      what: `${show(CLAUDE_MARKET)} version`,
      is: 'version' in claudeEntry ? claudeEntry.version : null,
      want: null,
      set: () => {
        delete claudeEntry.version;
        writeJson(CLAUDE_MARKET, claudeMarket);
      },
    },
    {
      what: `${show(CURSOR_MARKET)} description`,
      is: cursorEntry.description,
      want: description,
      set: () => {
        cursorEntry.description = description;
        writeJson(CURSOR_MARKET, cursorMarket);
      },
    },
  ];
}

const arg = process.argv[2];
const source = readJson(SOURCE);
const name = source.name;

let version = source.version;
if (!version) throw new Error(`${show(SOURCE)} has no version`);

if (arg && arg !== '--check') {
  if (!['major', 'minor', 'patch'].includes(arg) && !SEMVER.test(arg)) {
    console.error(`Unknown argument "${arg}". Expected major, minor, patch, or a semver.`);
    process.exit(2);
  }
  version = SEMVER.test(arg) ? arg : bump(version, arg);
  writeJson(SOURCE, { ...source, version });
}

const drifted = mirrors(version, source.description, name).filter((m) => m.is !== m.want);

if (arg === '--check') {
  if (source.version !== version || drifted.length) {
    console.error(`${name} ${version} — ${drifted.length} copy/copies out of sync:`);
    for (const d of drifted) {
      console.error(`  ${d.what}: ${d.is === null ? '(absent)' : d.is}`);
    }
    console.error('\nRun: node scripts/version.mjs');
    process.exit(1);
  }
  console.log(`${name} ${version} — every copy agrees.`);
  process.exit(0);
}

for (const d of drifted) d.set();

console.log(`${name} ${version}`);
if (drifted.length) {
  for (const d of drifted) console.log(`  updated ${d.what}`);
} else {
  console.log('  every copy already agreed.');
}

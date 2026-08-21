#!/usr/bin/env node
/**
 * What is true around a project rather than inside it: which harness is
 * running, what the user's global Claude Code settings say, and whether the
 * neighbors a design session leans on are actually there.
 *
 * Why it exists: none of this is answerable from a project's own files, and
 * every one of them reads as "Pushpin is broken" from the inside when it is
 * wrong — impeccable absent, so the product record every design command reads
 * is never written; a permission prompt in front of every edit; a marketplace
 * frozen at the capture it was installed with; Figma's desktop app closed,
 * which is where every write into a Figma file actually executes. Each answer
 * is one line and one remedy in `setup.mjs --ready`, and a machine where none
 * of them is wrong prints nothing at all.
 *
 * Everything here reads except `enableAutoUpdate`, and that is why this module
 * also has a command line. `setup.mjs` is pre-approved to run without a
 * permission prompt — lib/permissions.mjs grants that on the grounds that its
 * only write is a backup copy — so a write into the user's global settings has
 * no business being reachable from it. It is named in a `fix:` line instead,
 * and asks once, like any other command.
 *
 * Usage:
 *   node scripts/lib/environment.mjs --enable-auto-update
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The harnesses this plugin runs under, and the only values `--harness` takes. */
export const HARNESSES = ['claude', 'cursor'];

/**
 * Claude Code announces itself in the environment and Cursor does not, so
 * Cursor is the answer left over rather than one that is detected.
 *
 * Two checks turn on this and both are Claude Code's own settings, so a wrong
 * guess costs a line that does not apply rather than a broken run — and
 * `--harness` is there for the case where it does guess wrong.
 */
export function detectHarness() {
  return process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT ? 'claude' : 'cursor';
}

/** Claude Code's user-level settings, where the marketplace entry lives. */
export const GLOBAL_SETTINGS = join(homedir(), '.claude', 'settings.json');

/**
 * The marketplace this plugin is published from, duplicated from `init.mjs` for
 * the reason it is a constant there: an installed plugin does not carry the
 * marketplace file, so there is nothing to read the name off. init.mjs holds
 * the check that fails a rename.
 */
export const MARKETPLACE = 'johnwilliams-skills';

/** The oldest Node the scripts here are written against, as README states it. */
export const MIN_NODE = 18;

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * What the user's global settings say about auto-update for this marketplace.
 *
 * `unset` is the only answer worth acting on, and it is not a preference:
 * Claude Code enables auto-update by itself only for Anthropic's own
 * marketplaces, so an absent key resolves to false and freezes the install at
 * whatever capture it was made with. An explicit `false` is somebody's choice
 * and is left alone. No entry at all means the plugin arrived another way —
 * a skills directory, a dev checkout — and there is nothing here to set.
 *
 * @returns {'on' | 'off' | 'unset' | 'none' | 'unreadable'}
 */
export function globalAutoUpdate() {
  if (!existsSync(GLOBAL_SETTINGS)) return 'none';
  const settings = readJson(GLOBAL_SETTINGS);
  if (!settings) return 'unreadable';
  const entry = settings.extraKnownMarketplaces?.[MARKETPLACE];
  if (!entry) return 'none';
  if (entry.autoUpdate === undefined) return 'unset';
  return entry.autoUpdate ? 'on' : 'off';
}

/**
 * Sets `autoUpdate: true` on the marketplace entry, and only from `unset`.
 *
 * Every other state is a decision or an absence, and re-deciding either on
 * someone's behalf is what makes a repair untrustworthy. The rest of the entry
 * is spread through untouched — `installLocation` is legal there and is not
 * ours to drop, the same care `init.mjs` takes with the project copy.
 *
 * @returns {boolean} whether anything was written
 */
export function enableAutoUpdate() {
  if (globalAutoUpdate() !== 'unset') return false;
  const settings = readJson(GLOBAL_SETTINGS);
  const entry = settings.extraKnownMarketplaces[MARKETPLACE];
  settings.extraKnownMarketplaces[MARKETPLACE] = { ...entry, autoUpdate: true };
  writeFileSync(GLOBAL_SETTINGS, JSON.stringify(settings, null, 2) + '\n');
  return true;
}

/**
 * The permission mode this session starts in, from the first settings file that
 * names one.
 *
 * Project-local first, because that is the precedence Claude Code applies and
 * the question is what this session will do, not what the machine usually does.
 * Null means no file says, which is Claude Code's default: ask every time.
 */
export function permissionMode(dir) {
  const files = [
    join(dir, '.claude', 'settings.local.json'),
    join(dir, '.claude', 'settings.json'),
    GLOBAL_SETTINGS,
  ];
  for (const file of files) {
    const mode = readJson(file)?.permissions?.defaultMode;
    if (typeof mode === 'string') return mode;
  }
  return null;
}

/**
 * The modes that do not stop for a file edit. `plan` is deliberately not one of
 * them: it stops for everything, on purpose.
 */
const EDITS_ACCEPTED = new Set(['acceptEdits', 'bypassPermissions']);

export const acceptsEdits = (mode) => EDITS_ACCEPTED.has(mode);

/**
 * Whether Figma's desktop app is running, which is where a write into a Figma
 * file actually executes.
 *
 * `unknown` is a third answer rather than a rounded-down `stopped`. `pgrep`
 * exits 1 when nothing matched and something else when it could not look — a
 * sandbox with no access to the process list exits 3 — and telling someone to
 * open an application they already have open is worse than saying nothing.
 *
 * @returns {'running' | 'stopped' | 'unknown'}
 */
export function figmaDesktop() {
  try {
    execFileSync('pgrep', ['-x', 'Figma'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return 'running';
  } catch (e) {
    return e.status === 1 ? 'stopped' : 'unknown';
  }
}

/**
 * Where impeccable is installed, and — separately — whether this project holds
 * one of the provider folders its own hook installer looks for.
 *
 * The two are not the same question, and conflating them is what makes the
 * setup advice wrong. `hook-admin.mjs` skips every manifest target unless a
 * folder like `.cursor/skills/impeccable` exists *in the project*, so with the
 * usual user-global install `/impeccable hooks on` finds nothing to do and
 * installs nothing. Saying "impeccable is installed" while its per-edit hook
 * cannot be is how someone ends up hunting a gap that is working as designed.
 */
export function findImpeccable(dir) {
  const providerRels = [
    join('.cursor', 'skills', 'impeccable'),
    join('.claude', 'skills', 'impeccable'),
    join('.agents', 'skills', 'impeccable'),
    join('.github', 'skills', 'impeccable'),
  ];
  const local = providerRels.filter((rel) => existsSync(join(dir, rel)));
  const home = providerRels.map((rel) => join(homedir(), rel)).filter((p) => existsSync(p));

  return {
    installed: Boolean(local.length || home.length),
    // A project-local copy is the only kind its hook installer can act on.
    providerLocal: local.length ? local[0] : null,
    path: local.length ? join(dir, local[0]) : (home[0] ?? null),
  };
}

/**
 * Whether `dir` is inside a git repository.
 *
 * Two things ride on it: whether an overwrite has a way back that is not a
 * backup, and whether `.gitignore` advice names a file the project could
 * actually have. Printing that advice into a folder with no repository is an
 * instruction to create something for nothing.
 */
export function isGitRepo(dir) {
  try {
    execFileSync('git', ['-C', dir, 'rev-parse', '--git-dir'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * The two places macOS looks for an installed font. Matched on the name rather
 * than on one filename: the variable font installs as `ThumbtackRiseVF.ttf`,
 * and a static install is one file per weight.
 */
const FONT_DIRS = [join(homedir(), 'Library', 'Fonts'), '/Library/Fonts'];

export function riseFontInstalled() {
  return FONT_DIRS.some((dir) => {
    try {
      return readdirSync(dir).some((f) => /thumbtack ?rise/i.test(f));
    } catch {
      return false;
    }
  });
}

// ----------------------------------------------------------------- as a command

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--enable-auto-update')) {
    console.error('usage: node scripts/lib/environment.mjs --enable-auto-update');
    process.exit(1);
  }
  console.log(
    enableAutoUpdate()
      ? `Auto-update is on for the ${MARKETPLACE} marketplace.`
      : `Nothing to do — the ${MARKETPLACE} marketplace already says what it wants.`,
  );
}

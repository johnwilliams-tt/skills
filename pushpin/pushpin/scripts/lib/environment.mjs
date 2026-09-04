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
import { join, resolve, sep } from 'node:path';
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

// ------------------------------------------------------- the Figma MCP channel

/**
 * Where each harness keeps the configuration that puts a Figma MCP server in
 * front of a session. The plugin caches are laid out the same way under both —
 * `cache/<marketplace>/<plugin>/<version>/.mcp.json` — which is where the
 * official Figma plugin puts its server on either harness.
 */
const PLUGIN_CACHE = {
  claude: join(homedir(), '.claude', 'plugins', 'cache'),
  cursor: join(homedir(), '.cursor', 'plugins', 'cache'),
};

/** Every `.mcp.json` a plugin install carries, three levels down or nothing. */
function pluginMcpFiles(cacheDir) {
  const dirs = (p) => {
    try {
      return readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join(p, e.name));
    } catch {
      return [];
    }
  };
  return dirs(cacheDir)
    .flatMap(dirs)
    .flatMap(dirs)
    .map((p) => join(p, '.mcp.json'))
    .filter((p) => existsSync(p));
}

const namesFigma = (servers) =>
  Object.entries(servers ?? {}).some(
    ([name, server]) => /figma/i.test(name) || /figma/i.test(JSON.stringify(server ?? '')),
  );

/**
 * One configuration file's answer, as `yes`, `no`, `none`, or `unreadable`.
 *
 * A file that will not parse is read for the word rather than given up on.
 * Cursor writes `mcp.json` with comments in it, which is legal there and fatal
 * to `JSON.parse`, so an unparseable file is routine rather than broken — and
 * the one answer it must never produce is `no`.
 */
function mcpFileNamesFigma(path, dir) {
  if (!existsSync(path)) return 'none';
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return 'unreadable';
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return /figma/i.test(text) ? 'yes' : 'unreadable';
  }
  const sections = [data?.mcpServers, dir ? data?.projects?.[dir]?.mcpServers : null];
  return sections.some(namesFigma) ? 'yes' : 'no';
}

/**
 * Whether this harness has a Figma MCP server configured at all.
 *
 * Configuration is the only half of the question a file can answer. Whether the
 * server is actually connected lives in the harness client and is written down
 * nowhere, so this reports presence and the access preflight in
 * reference/generate.md proves reachability. Asking Figma's endpoint instead
 * would answer a third question — whether the service is up — and a green from
 * that reads as a working session, which is worse than no check at all.
 *
 * `unknown` is a third answer for the reason `figmaDesktop()` has one: telling
 * someone to install a plugin they already have costs more than saying nothing,
 * so a file that could not be read never rounds down to `absent`.
 *
 * @returns {'configured' | 'absent' | 'unknown'}
 */
export function figmaMcp(harness = detectHarness(), dir = process.cwd()) {
  const project = resolve(dir);
  const sources =
    harness === 'claude'
      ? [
          ...pluginMcpFiles(PLUGIN_CACHE.claude),
          join(homedir(), '.claude.json'),
          join(project, '.mcp.json'),
        ]
      : [
          ...pluginMcpFiles(PLUGIN_CACHE.cursor),
          join(homedir(), '.cursor', 'mcp.json'),
          join(project, '.cursor', 'mcp.json'),
        ];

  const answers = sources.map((path) => mcpFileNamesFigma(path, project));
  if (answers.includes('yes')) return 'configured';
  if (answers.includes('unreadable')) return 'unknown';
  // A file that said no is evidence. No file at all is not — a machine where
  // none of these paths exists has not been checked, only looked at.
  return answers.includes('no') ? 'absent' : 'unknown';
}

/**
 * What to say when the channel is missing, and separately when it is configured
 * but not answering. They are the same symptom and share no remedy, which is
 * why they are two strings rather than one with a branch inside it.
 *
 * They live here so `--ready`, the session line, and reference/generate.md
 * cannot drift into telling one user three different things.
 *
 * `FIGMA_MCP_DISCONNECTED` has no caller in this repo, and cannot: a dropped
 * connection is invisible to the filesystem, so only the agent following the
 * access preflight is ever in a position to say it. It is exported anyway
 * because its pair is, and because the doc that does quote it cannot import —
 * `scripts/verify.mjs` reads both back out of generate.md and fails on a
 * mismatch, which is the consumer that keeps the hand-copied quotation honest.
 *
 * Each one names a surface the user can see rather than the mechanism behind
 * it, which is the register `permissionMode`'s remedy already sets. On Cursor
 * that surface is Customize in the sidebar for both halves: it is where the
 * Figma plugin is installed and where a server that has lost its OAuth session
 * is re-authenticated, so a user sent there finds the right control either way.
 * Settings has a Tools & MCPs pane too, but it is not where an install starts.
 *
 * Cursor's absent sentence deliberately does not say "the Figma plugin is not
 * installed". A plugin is how Figma ships there, and it is what the remedy
 * names, but `figmaMcp()` also reads a hand-written `mcp.json` — and telling
 * somebody who configured one by hand that they are missing a plugin describes
 * their machine wrongly on the way to the right advice.
 */
export const FIGMA_MCP_ABSENT = {
  claude:
    'The Figma plugin is not installed, and it is what lets me read and write your Figma ' +
    'files. Run /plugin, install Figma, then ask me again.',
  cursor:
    'There is no Figma connection set up here, and it is what lets me read and write your ' +
    'Figma files. Open Customize in the sidebar, install the Figma plugin, then ask me again.',
};

export const FIGMA_MCP_DISCONNECTED = {
  claude:
    'Claude Code has lost its connection to Figma, so nothing can be written to your file. ' +
    'Type /mcp, reconnect Figma, then ask me again.',
  cursor:
    'Cursor has lost its connection to Figma, so nothing can be written to your file. Open ' +
    'Customize in the sidebar, click Figma where it says Needs authentication, then ask me ' +
    'again.',
};

// -------------------------------------------------------------- which install

/** Claude Code's record of every plugin install and where each one landed. */
export const INSTALLED_PLUGINS = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');

/** The key `installed_plugins.json` files this plugin under. */
const PLUGIN_KEY = `pushpin@${MARKETPLACE}`;

/**
 * This file's own plugin root, which is the install actually being run —
 * resolved from the module rather than from an assumed path, because the whole
 * question is which of several copies on disk this code came out of.
 */
const PLUGIN_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const versionParts = (v) => String(v ?? '').split('.').map((n) => Number(n) || 0);

/** Negative when `a` is the older release, positive when newer, 0 when equal. */
export const compareVersions = (a, b) => {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
};

const under = (root, p) => p === root || p.startsWith(root + sep);

/**
 * Which copy of this plugin a session in `dir` runs, and whether a newer one is
 * installed beside it.
 *
 * A project-scoped install wins over the user-level one in Claude Code and
 * nothing announces that it has, so a folder can sit two releases behind while
 * every check inside it reports health — the shape of failure this plugin keeps
 * rediscovering. The version is read off the running tree's own manifest rather
 * than off the record, because the record says what was installed and the
 * manifest says what loaded.
 *
 * Compared against the newest *user-level* install only. That is the copy
 * `/plugin` updates, so it is the only one the remedy can name, and a project
 * behind some other project's copy has no instruction worth printing.
 *
 * Cursor keys its cache by commit sha and keeps no equivalent manifest, so
 * there is nothing to compare there and the answer is `unknown` rather than a
 * fault invented out of an absence.
 *
 * @returns {{state: 'ok' | 'behind' | 'unknown', running: string | null,
 *   newest: string | null, pinnedBy: string | null}}
 */
export function pluginInstalls(dir = process.cwd(), harness = detectHarness()) {
  const unknown = { state: 'unknown', running: null, newest: null, pinnedBy: null };
  if (harness !== 'claude') return unknown;

  const entries = readJson(INSTALLED_PLUGINS)?.plugins?.[PLUGIN_KEY];
  if (!Array.isArray(entries) || !entries.length) return unknown;

  const newestUser = entries
    .filter((e) => e.scope === 'user' && e.version)
    .sort((a, b) => compareVersions(b.version, a.version))[0];
  if (!newestUser) return unknown;

  // The install being run, then — for a script invoked from outside any of them
  // — the one a session in `dir` would load instead. Both are the same question
  // asked from two places, and the second is what lets `--ready <dir>` answer
  // for a project the caller is not sitting inside.
  const own = entries.find((e) => e.installPath && under(e.installPath, PLUGIN_ROOT));
  const scoped = entries.find((e) => e.scope === 'project' && e.projectPath === resolve(dir));
  const active = own ?? scoped;
  if (!active) return unknown;

  const running = own ? readJson(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'))?.version : null;
  const version = running ?? active.version;
  if (!version) return unknown;

  return {
    state: compareVersions(version, newestUser.version) < 0 ? 'behind' : 'ok',
    running: version,
    newest: newestUser.version,
    pinnedBy: active.scope === 'project' ? (active.projectPath ?? null) : null,
  };
}

/** The stale-install sentence, kept here for the reason the Figma ones are. */
export const stalePluginRemedy = ({ running, newest }) =>
  `This project is running Pushpin ${running}, but ${newest} is installed at the user ` +
  `level — a project-scoped copy is pinned here. Run /plugin in this project and update ` +
  `Pushpin.`;

/**
 * The sentence for a release that has landed upstream and not here, keyed by
 * harness the way `FIGMA_MCP_ABSENT` is and for the same reason: the surface
 * that updates a plugin is a slash command on one and a sidebar pane on the
 * other, and a remedy that names the wrong one is an instruction the reader
 * cannot follow.
 *
 * This is the sentence `freshness.mjs --session` speaks when the repository's
 * `plugin.json` is ahead of the running copy, and `stalePluginRemedy` is what it
 * falls back to when the repository could not be reached — `pluginInstalls()`
 * compares local copies only and answers on Claude Code only, so it is the
 * weaker signal and is never spoken beside this one.
 *
 * `newest` is a release, not merely a newer commit: the repository's manifest
 * is bumped by the release step and by nothing else.
 */
export const pluginUpdateRemedy = {
  claude: ({ running, newest }) =>
    `Pushpin ${newest} has been released and this session is running ${running}, so what ` +
    `it knows about the kit is behind. Run /plugin and update Pushpin.`,
  cursor: ({ running, newest }) =>
    `Pushpin ${newest} has been released and this session is running ${running}, so what ` +
    `it knows about the kit is behind. Open Customize in the sidebar and update the Pushpin ` +
    `plugin.`,
};

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

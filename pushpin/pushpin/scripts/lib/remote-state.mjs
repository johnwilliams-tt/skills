#!/usr/bin/env node
/**
 * What the plugin's repository says right now, for a session that is running an
 * installed copy of it.
 *
 * An install knows its own version and ships its own `kit-state.json`, and both
 * are exactly as old as the install. The question a session start wants
 * answered — has a newer release landed, and what did the last scheduled check
 * find — lives on `main`, and the repository is public, so `raw.githubusercontent.com`
 * answers it anonymously. Two files, fetched in parallel, and nothing else.
 *
 * Three constraints shape the module, and every one of them is about the fact
 * that this runs at the start of every session in every consuming project:
 *
 * - **It is bounded.** `FETCH_TIMEOUT_MS` is the most a session start can spend
 *   waiting, and a cache under `CACHE_MAX_AGE_MS` is served without asking at
 *   all. GitHub's raw endpoint is not a rate-limited API, but a check that
 *   costs a second on every prompt is a check somebody removes.
 * - **It is silent.** No network, a 404, a proxy that answers HTML, a read-only
 *   project directory: every one of those returns the cache or null and prints
 *   nothing. The caller decides what silence means, and `freshness.mjs` decides
 *   it means the offline fallback.
 * - **It needs a project.** The cache lives under the project's `.pushpin/`,
 *   which is where every other machine-local file this plugin writes already
 *   goes, and the plugin's own tree is not a project — a maintainer's checkout
 *   is the thing the remote would be compared against. No project root means
 *   no fetch and no cache, and the same null as a failure.
 *
 * Usage:
 *   node scripts/lib/remote-state.mjs --fetch [dir]   # fetch now, ignoring the cache age
 *   node scripts/lib/remote-state.mjs --show  [dir]   # what the cache holds, no network
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectRoot } from './overlay.mjs';

/** Where the fetched files and their `meta.json` land, relative to the project root. */
export const REMOTE_REL = join('.pushpin', 'remote');

/** The branch releases are cut from, which is the only one a consumer should hear about. */
export const REMOTE_BASE = 'https://raw.githubusercontent.com/johnwilliams-tt/skills/main/pushpin';

export const FETCH_TIMEOUT_MS = 1500;
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The two files, by the name they are cached under and the path they are served
 * from. `kit-state.json` is the verdict the scheduled check commits; the plugin
 * manifest carries the version a release bumped.
 */
const FILES = {
  plugin: { cached: 'plugin.json', remote: '.claude-plugin/plugin.json' },
  kitState: { cached: 'kit-state.json', remote: 'pushpin/assets/kit-state.json' },
};
const META = 'meta.json';

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** The cache as a result, or null when there is none worth serving. */
function fromCache(dir) {
  const meta = readJson(join(dir, META));
  const plugin = readJson(join(dir, FILES.plugin.cached));
  const kitState = readJson(join(dir, FILES.kitState.cached));
  if (!meta?.fetchedAt || (!plugin && !kitState)) return null;
  return { plugin, kitState, fetchedAt: meta.fetchedAt, source: 'cache' };
}

async function fetchJson(path, signal) {
  const res = await fetch(`${REMOTE_BASE}/${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'pushpin-remote-state' },
    signal,
  });
  if (!res.ok) throw new Error(`${res.status} for ${path}`);
  return res.json();
}

/**
 * The repository's current `plugin.json` and `kit-state.json`, from the network
 * when the cache is old enough to be worth replacing and from the cache
 * otherwise.
 *
 * `network: false` reads the cache and nothing else, which is what `--offline`
 * means. `refresh: true` ignores the cache age, for the command line and for
 * nobody else: a session start that always fetched would be spending the
 * timeout on every prompt.
 *
 * Both files are written together or not at all. A pair where one half is
 * today's and the other yesterday's would let a version line and a kit-state
 * line describe two different moments of the repository, and neither reader
 * could tell.
 *
 * @param {{from?: string, network?: boolean, refresh?: boolean}} [options]
 * @returns {Promise<{plugin: object | null, kitState: object | null,
 *   fetchedAt: string, source: 'network' | 'cache'} | null>}
 */
export async function remoteState({ from = process.cwd(), network = true, refresh = false } = {}) {
  let root;
  try {
    root = projectRoot(from);
  } catch {
    return null;
  }
  if (!root) return null;
  const dir = join(root, REMOTE_REL);

  const cached = fromCache(dir);
  if (!network) return cached;
  if (cached && !refresh) {
    const age = Date.now() - Date.parse(cached.fetchedAt);
    if (Number.isFinite(age) && age >= 0 && age < CACHE_MAX_AGE_MS) return cached;
  }

  let plugin;
  let kitState;
  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    [plugin, kitState] = await Promise.all([
      fetchJson(FILES.plugin.remote, signal),
      fetchJson(FILES.kitState.remote, signal),
    ]);
  } catch {
    return cached;
  }
  if (!plugin || typeof plugin !== 'object' || !kitState || typeof kitState !== 'object') {
    return cached;
  }

  const fetchedAt = new Date().toISOString();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, FILES.plugin.cached), JSON.stringify(plugin, null, 2) + '\n');
    writeFileSync(join(dir, FILES.kitState.cached), JSON.stringify(kitState, null, 2) + '\n');
    writeFileSync(join(dir, META), JSON.stringify({ fetchedAt, base: REMOTE_BASE }, null, 2) + '\n');
  } catch {
    // A directory that cannot be written still got its answer; the next session
    // pays the fetch again, which is the bounded cost this module accepts.
  }
  return { plugin, kitState, fetchedAt, source: 'network' };
}

// ----------------------------------------------------------------- as a command

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const fetchNow = argv.includes('--fetch');
  const show = argv.includes('--show');
  const dir = argv.find((a) => !a.startsWith('--'));
  if (fetchNow === show) {
    console.error('usage: node scripts/lib/remote-state.mjs (--fetch | --show) [dir]');
    process.exit(1);
  }
  const from = dir ? resolve(dir) : process.cwd();
  if (!projectRoot(from)) {
    console.log(
      `No pushpin.config.json above ${from}, so there is nowhere to cache and nothing is fetched.`,
    );
    process.exit(0);
  }
  const result = await remoteState({ from, network: fetchNow, refresh: fetchNow });
  if (!result) {
    console.log(
      fetchNow
        ? `Could not reach ${REMOTE_BASE} within ${FETCH_TIMEOUT_MS}ms and there is no cache.`
        : `Nothing cached under ${join(projectRoot(from), REMOTE_REL)}.`,
    );
    process.exit(0);
  }
  console.log(JSON.stringify(result, null, 2));
}

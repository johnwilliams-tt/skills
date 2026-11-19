/**
 * Reading a project's edit-hook manifests, shared by `init.mjs` — which installs
 * and repairs them — and `pin.mjs`, which reports when one has gone stale.
 *
 * One module because the two must not disagree about what counts as an installed
 * hook. A check that says a project is fine while init says it needs repairing
 * is worse than either answer alone.
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The filename is the marker, so a command is recognizable as ours whether it
 * names the plugin's own copy or the project shim that stands in for it. Both
 * are called `pushpin-check.mjs` deliberately.
 *
 * The write guard and the preview run through the same shim with a flag rather
 * than as separate files, so one marker still finds every hook of ours and a
 * project holds one thing to keep current instead of three.
 */
export const HOOK_MARKER = 'pushpin-check.mjs';

/** Tells the shim which delegate to run, and a manifest entry which job it does. */
export const GUARD_FLAG = '--guard';

/**
 * Brings the preview up. Unlike the other two this is never installed in a
 * manifest — the edit check ensures the preview itself, so an edit does not
 * need a second hook — and exists so a session can ask for the preview without
 * knowing where the plugin is installed.
 */
export const PREVIEW_FLAG = '--preview';

/** Where the shim lives inside a project. */
export const SHIM_REL = join('.pushpin', 'pushpin-check.mjs');

/**
 * Every manifest a hook of ours can sit in. The shared Claude Code settings
 * file is where init puts the hook so a teammate who opens the repo gets it;
 * the local one is where `--no-share` puts it, and where projects set up
 * before that still carry it.
 */
export const MANIFESTS = [
  { rel: join('.cursor', 'hooks.json'), harness: 'Cursor' },
  { rel: join('.claude', 'settings.json'), harness: 'Claude Code' },
  { rel: join('.claude', 'settings.local.json'), harness: 'Claude Code' },
];

/**
 * The commands init writes. Neither names a path on this machine, so both
 * manifests can be committed: Cursor runs a project hook from the project root,
 * and Claude Code sets `CLAUDE_PROJECT_DIR` for every hook it runs.
 */
const SHIM_POSIX = SHIM_REL.split('\\').join('/');
export const CURSOR_HOOK_CMD = `node ${SHIM_POSIX}`;
export const CURSOR_GUARD_CMD = `node ${SHIM_POSIX} ${GUARD_FLAG}`;
export const CLAUDE_HOOK_CMD = `node "$CLAUDE_PROJECT_DIR/${SHIM_POSIX}"`;

/** Every string anywhere in a manifest that runs our hook. Shape-agnostic. */
export function hookCommands(node, found = []) {
  if (typeof node === 'string') {
    if (node.includes(HOOK_MARKER)) found.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) hookCommands(v, found);
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) hookCommands(v, found);
  }
  return found;
}

/**
 * The script path out of a hook command, resolved against the project. An
 * absolute path is what projects set up earlier carry; a project-dir variable
 * or a path relative to the project root is what init writes now, and both
 * resolve to the project only when `dir` is given.
 */
export function commandTarget(command, dir = null) {
  const quoted = command.match(/"([^"]*pushpin-check\.mjs)"/);
  const bare = command.match(/(\S*pushpin-check\.mjs)/);
  const raw = quoted ? quoted[1] : bare ? bare[1] : null;
  if (!raw || !dir) return raw;
  const expanded = raw.replace(/\$\{?(CLAUDE_PROJECT_DIR|CURSOR_PROJECT_DIR)\}?/g, dir);
  return resolve(dir, expanded);
}

/** Drop every entry that runs our hook, so an install is also a repair. */
export const withoutHook = (list) =>
  (Array.isArray(list) ? list : []).filter((e) => hookCommands(e).length === 0);

/**
 * Two paths naming the same file. Resolved through symlinks, because a project
 * under `/tmp` on macOS is recorded as `/tmp/...` and reached as `/private/tmp/...`,
 * and comparing the strings would call a healthy shim a stale plugin path.
 */
const samePath = (a, b) => {
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return resolve(p);
    }
  };
  return real(a) === real(b);
};

/**
 * Why a hook of ours that runs is still the wrong one, or null.
 *
 * Cursor runs an `afterFileEdit` hook and drops what it prints, so a check
 * installed there has never reached the agent. An absolute path works only on
 * the machine that wrote it, so a committed manifest carrying one is a missing
 * hook for everybody else. A Claude Code matcher without `Bash` misses every
 * file written from the shell.
 */
function staleReason(harness, event, entry, command) {
  if (harness === 'Cursor' && event === 'afterFileEdit') {
    return 'runs on afterFileEdit, which Cursor does not report back to the agent';
  }
  if (/"\/|^node \//.test(command)) {
    return 'names an absolute path, so it runs only on the machine that wrote it';
  }
  if (harness === 'Claude Code' && !command.includes(GUARD_FLAG) && !/\bBash\b/.test(entry?.matcher ?? '')) {
    return 'does not run after shell commands';
  }
  return null;
}

/**
 * What a project's manifests currently say. `kind` distinguishes the shim, which
 * survives a plugin update, from a command naming the plugin directly, which
 * does not: those directories are named after a version, and Cursor deletes the
 * old one when it updates.
 *
 * @param {string} dir
 * @returns {{ rel: string, harness: string, event: string, command: string,
 *             target: string | null, exists: boolean, kind: 'shim' | 'plugin',
 *             role: 'check' | 'guard', stale: string | null }[]}
 */
export function inspectHooks(dir) {
  const out = [];
  const shimAbs = join(dir, SHIM_REL);

  for (const { rel, harness } of MANIFESTS) {
    const abs = join(dir, rel);
    if (!existsSync(abs)) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      continue;
    }
    const events = parsed?.hooks && typeof parsed.hooks === 'object' ? parsed.hooks : {};
    for (const [event, list] of Object.entries(events)) {
      for (const entry of Array.isArray(list) ? list : []) {
        for (const command of hookCommands(entry)) {
          const target = commandTarget(command, dir);
          out.push({
            rel,
            harness,
            event,
            command,
            target,
            exists: Boolean(target && existsSync(target)),
            kind: target && samePath(target, shimAbs) ? 'shim' : 'plugin',
            role: command.includes(GUARD_FLAG) ? 'guard' : 'check',
            stale: staleReason(harness, event, entry, command),
          });
        }
      }
    }
  }
  return out;
}

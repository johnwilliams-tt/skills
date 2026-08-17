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
 * The write guard runs through the same shim with `--guard` rather than as a
 * second file, so one marker still finds every hook of ours and a project holds
 * one thing to keep current instead of two.
 */
export const HOOK_MARKER = 'pushpin-check.mjs';

/** Tells the shim which delegate to run, and a manifest entry which job it does. */
export const GUARD_FLAG = '--guard';

/** Where the shim lives inside a project. */
export const SHIM_REL = join('.pushpin', 'pushpin-check.mjs');

/** Both harnesses' machine-local manifests, with the event each one uses. */
export const MANIFESTS = [
  { rel: join('.cursor', 'hooks.json'), harness: 'Cursor' },
  { rel: join('.claude', 'settings.local.json'), harness: 'Claude Code' },
];

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
 * The script path out of `node "/path/to/pushpin-check.mjs"`. Quoted is what we
 * write; the unquoted form is accepted so a hand-edited manifest still reads.
 */
export function commandTarget(command) {
  const quoted = command.match(/"([^"]*pushpin-check\.mjs)"/);
  if (quoted) return quoted[1];
  const bare = command.match(/(\S*pushpin-check\.mjs)/);
  return bare ? bare[1] : null;
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
 * What a project's manifests currently say. `kind` distinguishes the shim, which
 * survives a plugin update, from a command naming the plugin directly, which
 * does not: those directories are named after a version, and Cursor deletes the
 * old one when it updates.
 *
 * @param {string} dir
 * @returns {{ rel: string, harness: string, command: string, target: string | null,
 *             exists: boolean, kind: 'shim' | 'plugin', role: 'check' | 'guard' }[]}
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
    for (const command of hookCommands(parsed)) {
      const target = commandTarget(command);
      out.push({
        rel,
        harness,
        command,
        target,
        exists: Boolean(target && existsSync(target)),
        kind: target && samePath(target, shimAbs) ? 'shim' : 'plugin',
        role: command.includes(GUARD_FLAG) ? 'guard' : 'check',
      });
    }
  }
  return out;
}

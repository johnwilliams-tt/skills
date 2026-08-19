/**
 * What a project's browser preview is, and whether it is up.
 *
 * Shared by `preview.mjs`, which is the server; `hooks/pushpin-preview.mjs`,
 * which starts it; `init.mjs`, which decides and records it; and `setup.mjs`,
 * which reports it. One module for the same reason `hooks.mjs` is one: a check
 * that says the preview is fine while the hook is starting a second copy is
 * worse than either answer alone.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { request } from 'node:http';
import { join, resolve } from 'node:path';

/** Where a preview lands unless the project says otherwise. */
export const DEFAULT_PORT = 8123;

/**
 * The path the server answers about itself, and the only route it serves that is
 * not a file.
 *
 * This is how a caller tells our preview from anything else holding the port —
 * a copy serving a different project, another tool's dev server, something
 * unrelated — without a pidfile that can go stale and without ever killing a
 * process it did not start.
 */
export const IDENTITY_PATH = '/__pushpin';

/** Machine-local, and listed in the gitignore advice `init` prints. */
export const PID_REL = join('.pushpin', 'preview.pid');
export const LOG_REL = join('.pushpin', 'preview.log');
export const LOCK_REL = join('.pushpin', 'preview.lock');

export const previewUrl = (port) => `http://localhost:${port}/`;

/**
 * The `preview` block from `pushpin.config.json`, or null when the project has
 * none — which is every project set up before this existed, and every one that
 * declined it.
 *
 * @param {string} dir
 * @returns {{ port: number | null, root: string, autostart: boolean, command: string | null } | null}
 */
export function readPreview(dir) {
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(join(dir, 'pushpin.config.json'), 'utf8'));
  } catch {
    return null;
  }
  const p = cfg?.preview;
  if (!p || typeof p !== 'object') return null;
  return {
    port: Number.isInteger(p.port) ? p.port : null,
    root: typeof p.root === 'string' ? p.root : '.',
    autostart: p.autostart === true,
    command: typeof p.command === 'string' ? p.command : null,
  };
}

/**
 * What is on the port right now.
 *
 * - `dead` — nothing is listening, or nothing answered in time.
 * - `ours` — a Pushpin preview. `root` says which directory it is serving,
 *   which is the part that matters: a preview from another project holding the
 *   port would otherwise show the wrong prototype at the right URL.
 * - `foreign` — something is listening and it is not ours. Never killed.
 *
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<{ state: 'dead' | 'ours' | 'foreign', root?: string, pid?: number }>}
 */
export function probe(port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const settle = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    let done = false;

    const req = request(
      { host: '127.0.0.1', port, path: IDENTITY_PATH, method: 'GET', timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (body?.pushpin === 'preview') {
              settle({ state: 'ours', root: body.root, pid: body.pid });
              return;
            }
          } catch {
            // Answered, but not with our identity. Something else's server.
          }
          settle({ state: 'foreign' });
        });
        res.on('error', () => settle({ state: 'foreign' }));
      },
    );

    // A refused connection is the common case and means free. Anything else
    // that errors is treated the same way, because the only action either
    // answer leads to — try to bind — fails safely when something is there.
    req.on('error', () => settle({ state: 'dead' }));
    req.on('timeout', () => {
      req.destroy();
      // Listening but not answering. Whatever it is, it is not a preview we
      // could use, and it is not ours to kill.
      settle({ state: 'foreign' });
    });
    req.end();
  });
}

/**
 * Whether a running preview is serving the directory this project expects.
 *
 * Resolved through symlinks, for the reason `hooks.mjs` resolves its own paths:
 * a project under `/tmp` on macOS is recorded as `/tmp/...` and reported by a
 * process that reached it as `/private/tmp/...`. Comparing the strings would
 * call a healthy preview somebody else's and send the user off to move a port
 * that was never in conflict.
 */
export function servesRoot(reportedRoot, expectedRoot) {
  if (!reportedRoot) return false;
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return resolve(p);
    }
  };
  return real(reportedRoot) === real(expectedRoot);
}

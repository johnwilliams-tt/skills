#!/usr/bin/env node
/**
 * Keeps the browser preview reachable.
 *
 * A prototype server started as an agent's shell job dies with that job — when
 * the turn is interrupted, when the terminal is torn down, when someone hits
 * stop. Nothing notices, so the next edit lands against a page that cannot be
 * reloaded, and the usual repair is to start a second copy on the same port and
 * race the first. This runs on every edit, checks whether the preview is
 * answering, and starts it detached when it is not.
 *
 * Contract, shared with the hook that calls it: **never break a turn.** Every
 * failure path returns silence. It reports what it did; it does not block, and
 * it never kills a process it did not start.
 *
 * Called two ways: imported by `pushpin-check.mjs`, which runs on every edit,
 * and directly through `.pushpin/pushpin-check.mjs --preview` for a session that
 * wants the preview up without editing anything first.
 */

import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCK_REL, LOG_REL, PID_REL, previewUrl, probe, readPreview, servesRoot } from '../lib/preview.mjs';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'preview.mjs');

/** Past this the log is started fresh. A prototype server logs every request. */
const LOG_LIMIT = 1_000_000;

/** How long a lock is believed. Above the readiness wait, so a live spawn holds it. */
const LOCK_STALE_MS = 20_000;

/** How long to wait for a just-started server before reporting what happened. */
const READY_MS = 1_500;
const READY_STEP_MS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * An exclusive lock, or null if someone else holds a fresh one.
 *
 * Two edits landing together would otherwise both probe a dead port and both
 * spawn; one of them loses the bind and exits, which is survivable but writes a
 * confusing error into a log the user reads when something is already wrong.
 */
function takeLock(abs) {
  try {
    closeSync(openSync(abs, 'wx'));
    writeFileSync(abs, String(process.pid));
    return true;
  } catch {
    try {
      if (Date.now() - statSync(abs).mtimeMs > LOCK_STALE_MS) {
        // The holder died before releasing. Nothing else will clear this.
        rmSync(abs, { force: true });
        closeSync(openSync(abs, 'wx'));
        writeFileSync(abs, String(process.pid));
        return true;
      }
    } catch {
      // Lost the race to whoever else noticed it was stale. They will spawn.
    }
    return false;
  }
}

/** The log fd for a spawned server, or 'ignore' when the log cannot be opened. */
function logTarget(dir) {
  const abs = join(dir, LOG_REL);
  try {
    mkdirSync(dirname(abs), { recursive: true });
    const big = existsSync(abs) && statSync(abs).size > LOG_LIMIT;
    return openSync(abs, big ? 'w' : 'a');
  } catch {
    return 'ignore';
  }
}

/**
 * Start the server so it outlives this process, the hook that called it, and
 * the turn.
 *
 * `detached` makes the child a session leader, which is what actually matters:
 * reparented to init and in its own process group, nothing that cleans up after
 * the hook can reach it.
 */
function start(dir, root, port) {
  const out = logTarget(dir);
  const child = spawn(process.execPath, [SERVER, '--root', root, '--port', String(port)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  try {
    writeFileSync(join(dir, PID_REL), String(child.pid));
  } catch {
    // The pidfile is a convenience for a human reading the directory. The
    // identity endpoint is what anything else asks.
  }
  return child.pid;
}

/**
 * Bring the preview up if it is down, and say what happened.
 *
 * @param {string} dir the project root
 * @returns {Promise<string | null>} a line to relay, or null for silence
 */
export async function ensurePreview(dir) {
  const pv = readPreview(dir);
  // No preview block: a project set up before this existed, or one that
  // declined it. Nothing to say on either count.
  if (!pv || !pv.port) return null;

  const state = await probe(pv.port);
  const root = resolve(dir, pv.root);
  const url = previewUrl(pv.port);

  if (state.state === 'ours') {
    if (servesRoot(state.root, root)) return null;
    // The right URL showing the wrong project is worse than nothing showing at
    // all, because it looks like the edit did not take.
    return (
      `Port ${pv.port} is held by a Pushpin preview of a different directory (${state.root}), so ${url} ` +
      `is not this project. Give this one its own port: \`pushpin init --write --preview-port <n>\`.`
    );
  }

  if (state.state === 'foreign') {
    return (
      `Something that is not the Pushpin preview is listening on port ${pv.port}, so ${url} is not ` +
      `this project. It has been left alone. Give the preview its own port: ` +
      `\`pushpin init --write --preview-port <n>\`.`
    );
  }

  // Down. Whether Pushpin is the thing that may start it is the project's call,
  // recorded at init: a framework's own dev server is not ours to run.
  if (!pv.autostart) {
    return pv.command
      ? `The preview at ${url} is not running. Pushpin does not start this project's dev server — \`${pv.command}\` does.`
      : `The preview at ${url} is not running.`;
  }

  if (!existsSync(root)) return null;

  const lock = join(dir, LOCK_REL);
  try {
    mkdirSync(dirname(lock), { recursive: true });
  } catch {
    return null;
  }
  // Another edit is already starting it. Its hook will report.
  if (!takeLock(lock)) return null;

  try {
    start(dir, root, pv.port);
    for (let waited = 0; waited < READY_MS; waited += READY_STEP_MS) {
      await sleep(READY_STEP_MS);
      const now = await probe(pv.port, 300);
      if (now.state === 'ours') return `The preview had stopped. It is running again at ${url}.`;
    }
    return `The preview had stopped and did not come back up on port ${pv.port}. See ${LOG_REL}.`;
  } catch {
    return null;
  } finally {
    try {
      rmSync(lock, { force: true });
    } catch {
      // A lock left behind goes stale on its own.
    }
  }
}

/** Whether this file was run rather than imported. */
const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invoked) {
  // Reached through the project shim, which pipes the harness event in. The
  // event is read so the pipe is drained, and the project comes from it when it
  // says so.
  const chunks = [];
  if (!process.stdin.isTTY) for await (const c of process.stdin) chunks.push(c);
  let event = {};
  try {
    event = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    event = {};
  }
  const dir =
    event?.cwd ||
    (Array.isArray(event?.workspace_roots) && event.workspace_roots[0]) ||
    process.env.CURSOR_PROJECT_DIR ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd();

  let line = null;
  try {
    line = await ensurePreview(dir);
  } catch {
    line = null;
  }
  if (line) {
    const cursor = typeof event?.conversation_id === 'string' && event.conversation_id;
    process.stdout.write(
      cursor
        ? JSON.stringify({ additional_context: line })
        : JSON.stringify({
            hookSpecificOutput: {
              hookEventName: event?.hook_event_name || 'PostToolUse',
              additionalContext: line,
            },
          }),
    );
  }
  process.exit(0);
}

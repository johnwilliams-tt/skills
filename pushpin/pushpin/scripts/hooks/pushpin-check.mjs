#!/usr/bin/env node
/**
 * Edit hook — runs `check.mjs --brief` on the file that was just written and
 * hands the findings back to the model as context.
 *
 * This is what makes SKILL.md's short rule list safe. A rule the model has to
 * still be holding in context is a rule that decays over a long session; a rule
 * a script re-states on the edit that broke it does not.
 *
 * Contract: **never break a turn.** Every failure path exits 0 with no output,
 * because a design-system reminder is not worth interrupting work over. It
 * reports; it does not block.
 *
 * Installed per project by `init.mjs`, into `.cursor/hooks.json` and
 * `.claude/settings.local.json`. Not invoked directly.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), '..', 'check.mjs');

const WATCHED = new Set([
  '.css', '.scss', '.sass', '.less',
  '.js', '.jsx', '.ts', '.tsx',
  '.html', '.vue', '.svelte', '.astro',
]);

/** Exit quietly. The only exit this script has. */
const done = (payload) => {
  if (payload) process.stdout.write(payload);
  process.exit(0);
};

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Cursor and Claude Code disagree on both the event shape and the reply
 * envelope. `conversation_id` is the discriminator, the same one impeccable
 * uses, so the two stay consistent about which harness they think they are in.
 */
const isCursor = (e) => typeof e?.conversation_id === 'string' && e.conversation_id;

const reply = (text, event) =>
  isCursor(event)
    ? JSON.stringify({ additional_context: text })
    : JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event?.hook_event_name || 'PostToolUse',
          additionalContext: text,
        },
      });

function editedFile(event) {
  const ti = event?.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
  return ti.file_path || ti.path || event?.file_path || null;
}

function projectDir(event) {
  return (
    event?.cwd ||
    (Array.isArray(event?.workspace_roots) && event.workspace_roots[0]) ||
    process.env.CURSOR_PROJECT_DIR ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd()
  );
}

async function main() {
  // A check that edits nothing cannot re-enter, but the guard costs nothing and
  // makes that guarantee independent of what check.mjs grows into later.
  if (process.env.PUSHPIN_HOOK_DEPTH) done();
  process.env.PUSHPIN_HOOK_DEPTH = '1';

  if (!existsSync(CHECK)) done();

  let event;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    done();
  }

  const file = editedFile(event);
  if (!file || !WATCHED.has(extname(file))) done();

  const cwd = projectDir(event);
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  if (!existsSync(abs)) done();

  let out = '';
  try {
    out = execFileSync(process.execPath, [CHECK, abs, '--brief'], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    // check.mjs exits 1 when it finds something, which is the interesting case
    // rather than an error. Anything without stdout is a real failure, and a
    // real failure here is silence.
    out = err?.stdout ?? '';
  }

  out = String(out).trim();
  if (!out) done();

  done(reply(`${out}\n\nFix these before moving on. Rules: reference/rules.md.`, event));
}

main().catch(() => done());

#!/usr/bin/env node
/**
 * Write guard — refuses a write that would replace one of Pushpin's two
 * generated files with something that is not Pushpin.
 *
 * `DESIGN.md` and `.impeccable/design.json` are read as this project's design
 * system. `/impeccable document` regenerates both from scratch with an invented
 * visual world, and impeccable's own staleness finding recommends it by name,
 * so the suggestion arrives with authority and the damage is silent: every
 * check downstream keeps passing, against the wrong system.
 *
 * This is the only Pushpin hook that blocks, and it is a deliberate exception
 * to the contract the others keep. It is affordable because the files carry
 * nothing a human wrote — the remedy is `pushpin init --write --force`, which
 * reproduces them exactly — so refusing costs a regeneration and never work.
 *
 * It is also the weakest of the three layers, not the load-bearing one. Cursor
 * is the only harness wired for it, and hooks fail open. The recorded hashes
 * are what actually guarantee an overwrite is noticed: `pushpin-check.mjs`
 * reports one on the edit, and `pin.mjs` reports one at session start, on every
 * harness. This just gets there first where it can.
 *
 * Deny is narrow on purpose. Anything it cannot judge confidently is allowed:
 * a different path, an unreadable event, a missing destination, content that
 * still carries the marker, or `PUSHPIN_ALLOW_GENERATED_WRITE` in the
 * environment.
 *
 * Installed per project by `init.mjs`, reached through `.pushpin/pushpin-check.mjs
 * --guard`. Not invoked directly.
 */

import { carriesMarker, generatedKind } from '../lib/generated.mjs';

/** Exit quietly. The only exit this script has. */
const done = (payload) => {
  if (payload) process.stdout.write(JSON.stringify(payload));
  process.exit(0);
};

const allow = () => done(null);

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function toolInput(event) {
  return event?.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
}

function destination(event) {
  const ti = toolInput(event);
  return ti.file_path || ti.path || ti.target_file || event?.file_path || null;
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

/**
 * The content a write would land. Tools disagree on the field, and an edit that
 * only carries a replacement fragment tells us nothing about the whole file —
 * a fragment that happens to exclude the frontmatter is not evidence the
 * frontmatter is going away. Only a whole-file write is judged.
 */
function proposedWhole(event) {
  const ti = toolInput(event);
  const whole = ti.content ?? ti.contents ?? ti.new_string ?? null;
  if (typeof whole !== 'string') return null;
  // Edit tools send the replacement alongside what it replaces; that is a
  // fragment, not a file.
  if (typeof ti.old_string === 'string' && ti.old_string.length) return null;
  return whole;
}

const REASON =
  'Pushpin generates this file, and the write would replace it with a different design ' +
  'system. DESIGN.md and .impeccable/design.json carry Pushpin\'s tokens and the rules a ' +
  'token allowlist cannot express; anything that reads them — impeccable\'s detector ' +
  'included — would start checking against an invented system instead, and every check ' +
  'would keep passing.\n\n' +
  'If the file is stale, regenerate it: `pushpin init --write --force`. That reproduces ' +
  'both files exactly, so nothing is lost by refusing this. Do not run `/impeccable ' +
  'document` on a Pushpin project.';

async function main() {
  if (process.env.PUSHPIN_ALLOW_GENERATED_WRITE) allow();

  let event;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    allow();
  }

  const file = destination(event);
  if (!file) allow();

  if (!generatedKind(projectDir(event), file)) allow();

  const content = proposedWhole(event);
  if (content === null) allow();
  if (carriesMarker(content)) allow();

  done({ permission: 'deny', user_message: REASON, agent_message: REASON });
}

main().catch(() => allow());

/**
 * The permission rules that let this plugin's own project scripts run without
 * asking, shared by `init.mjs` — which writes them — and `setup.mjs`, which
 * reports whether they are still the rules this plugin needs.
 *
 * One module for the same reason `hooks.mjs` is one: a check that says a project
 * is fine while init says it needs repairing is worse than either answer alone.
 *
 * Why the rules exist. Claude Code prompts for every shell command outside its
 * built-in read-only set, and `node` is not in that set, so each `lookup.mjs`
 * call asks — a dozen times while one layout is built. `acceptEdits` does not
 * help: it covers file edits and a fixed list of filesystem commands, nothing
 * else. Pre-approving these five by full path removes the prompts in every mode,
 * which is narrower than asking someone to lower their guard for every tool in
 * every session.
 *
 * Why only these six. Each one is a command an agent runs mid-task in a project
 * that consumes Pushpin — which is why the maintainer's tools beside them are
 * not here, read-only though several are. `init.mjs` is deliberately absent: it
 * is the script that can replace a stylesheet, and the prompt in front of a
 * `--force` is worth keeping.
 *
 * Two of the six write, and both write only inside `.pushpin/`, to files no
 * person authored and nothing else produces: `setup.mjs` copies into
 * `.pushpin/backups/`, and `refresh.mjs` writes the catalogs it just distilled
 * into `.pushpin/assets/` and removes that same directory under `--clear`. The
 * prompt is worth keeping where a command can destroy work; neither of these
 * can. `refresh.mjs` in particular is invoked in the middle of a re-capture the
 * user asked for, several times in a row, so a prompt per lane would land in
 * the one place it is pure friction.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Claude Code's machine-local settings file, where these rules belong. */
export const SETTINGS_REL = join('.claude', 'settings.local.json');

export const ALLOWED_SCRIPTS = [
  'check.mjs',
  'copy.mjs',
  'freshness.mjs',
  'lookup.mjs',
  'refresh.mjs',
  'setup.mjs',
];

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A rule per script, naming it by full path.
 *
 * Full paths rather than `Bash(node *)`: a wildcard there would approve
 * arbitrary code execution, which is not a plugin's to grant on someone's
 * behalf. These name five files this plugin ships and nothing else.
 *
 * A trailing ` *` also matches end-of-string, so one rule covers both the bare
 * invocation and any arguments. A path holding a space cannot be typed
 * unquoted, so there the quoted form is what the command will actually carry.
 */
export function allowRules() {
  return ALLOWED_SCRIPTS.flatMap((name) => {
    const abs = join(SCRIPTS, name);
    return abs.includes(' ') ? [`Bash(node "${abs}" *)`, `Bash(node ${abs} *)`] : [`Bash(node ${abs} *)`];
  });
}

/**
 * Which of this plugin's rules a project is missing.
 *
 * Asked rather than trusted, because the paths carry a version directory: a
 * plugin update leaves the recorded rules naming a build that is gone, and the
 * new one unapproved. That costs only the prompts coming back — a rule matching
 * nothing grants nothing — but it is silent, and a machine-local artifact that
 * silently stops working is the failure this project's checks exist to catch.
 *
 * A rule left behind by the previous build is not reported. It grants nothing,
 * and a second install of this plugin — a dev checkout beside the published one
 * — is a legitimate reason for a project to carry rules for both.
 *
 * @param {string} dir
 * @returns {string[]} the rules that are not there
 */
export function missingAllowRules(dir) {
  const abs = join(dir, SETTINGS_REL);
  let allow = [];
  if (existsSync(abs)) {
    try {
      allow = JSON.parse(readFileSync(abs, 'utf8')).permissions?.allow ?? [];
    } catch {
      allow = [];
    }
  }
  return allowRules().filter((r) => !allow.includes(r));
}

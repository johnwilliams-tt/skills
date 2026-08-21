#!/usr/bin/env node
/**
 * Sets a project up to use Pushpin.
 *
 * Installs the token stylesheet, records the Figma keys so the bridge works
 * without re-deriving them, installs the edit hook that runs `check.mjs`,
 * records where the browser preview lives, leaves a note for agents working in
 * the repo later, and offers the plugin to anyone else who opens the repo.
 * Prints a plan and changes nothing unless --write is passed.
 *
 * Usage:
 *   node scripts/init.mjs <project-dir> [--write] [--force] [--css-path <p>]
 *                                       [--no-share] [--no-hook]
 *                                       [--no-preview] [--preview-port <n>]
 *                                       [--advice]
 *
 * What a --write prints when it is done is what someone still has to do, and
 * that is all: three lines, each asked of the project or the machine first and
 * printed only when it is true there. `--advice` adds back the explanation of
 * what was written, which is documentation rather than a next step, and lives in
 * reference/init.md.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isGitRepo, riseFontInstalled } from './lib/environment.mjs';
import { DESIGN_REL, SIDECAR_REL } from './lib/generated.mjs';
import { GUARD_FLAG, hookCommands, PREVIEW_FLAG, SHIM_REL, withoutHook } from './lib/hooks.mjs';
import { ALLOWED_SCRIPTS, allowRules, SETTINGS_REL } from './lib/permissions.mjs';
import { DEFAULT_PORT, previewUrl } from './lib/preview.mjs';
import { describeStack, detectStack, importSpecifier } from './lib/project.mjs';
import { stylesheetReference } from './lib/stylesheet.mjs';
import { inspectPin } from './pin.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
/** Flags whose value follows them, so it is not mistaken for the target directory. */
const VALUE_FLAGS = new Set(['--css-path', '--preview-port']);
const target = resolve(argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1])) ?? '.');

const WRITE = flag('--write');
const FORCE = flag('--force');
const SHARE = !flag('--no-share');
const HOOK = !flag('--no-hook');
const PREVIEW = !flag('--no-preview');
const PREVIEW_PORT_GIVEN = flag('--preview-port');
const PREVIEW_PORT = Number(opt('--preview-port', DEFAULT_PORT));
const ADVICE = flag('--advice');

if (!existsSync(target)) {
  console.error(`No such directory: ${target}`);
  process.exit(1);
}

if (!Number.isInteger(PREVIEW_PORT) || PREVIEW_PORT < 1 || PREVIEW_PORT > 65535) {
  console.error(`--preview-port needs a port number, got: ${opt('--preview-port', '')}`);
  process.exit(1);
}

const TOKENS = JSON.parse(readFileSync(join(ASSETS, 'tokens.figma.json'), 'utf8'));
const SOURCE = TOKENS.source;
const KEYS = JSON.parse(readFileSync(join(ASSETS, 'variable-keys.figma.json'), 'utf8'));
const MANIFEST = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));
const PLUGIN = JSON.parse(
  readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'),
);

// Where a collaborator who opens the project will be offered this plugin from.
// The marketplace file lives at the repo root, one level above the plugin, so
// an installed copy doesn't carry it — hence the constant. In a dev checkout
// it is reachable and authoritative, so a rename fails here rather than
// sending every project a marketplace name that no longer resolves.
const MARKETPLACE = 'johnwilliams-skills';
// A clone URL, not `owner/repo`. Claude Code probes for a working GitHub SSH
// setup and clones the short form over SSH when it finds one, falling back to
// HTTPS only after that clone fails — and each git attempt carries a 120-second
// timeout, so a key that authenticates to GitHub but cannot reach this repo can
// burn the whole timeout before the fallback starts. The full URL is taken as
// HTTPS outright, and resolves to the same marketplace name, so PLUGIN_REF is
// unaffected.
const REPO_URL = `${PLUGIN.repository.replace(/\.git$/, '')}.git`;
const PLUGIN_REF = `${PLUGIN.name}@${MARKETPLACE}`;
// Which directories the marketplace clone holds: the manifest, and the plugin it
// points at. Without this the clone takes the whole repo — the other plugin
// directories, `.cursor-plugin`, `.githooks` — none of which a project consuming
// Pushpin has any use for. Cone-mode sparse checkout, so these are directory
// prefixes rather than globs, and `.claude-plugin` is required because that is
// where the CLI looks for marketplace.json when no explicit path is declared.
const SPARSE_PATHS = ['.claude-plugin', PLUGIN.name];

const marketplacePath = join(here, '..', '..', '..', '.claude-plugin', 'marketplace.json');
if (existsSync(marketplacePath)) {
  const { name, plugins } = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  if (name !== MARKETPLACE) {
    console.error(
      `Marketplace is named "${name}" but init.mjs writes "${MARKETPLACE}".\n` +
        'Update MARKETPLACE in scripts/init.mjs, or projects will be pointed at a name that does not resolve.',
    );
    process.exit(1);
  }
  // SPARSE_PATHS names this plugin by its directory in the repo, and the manifest
  // is the only thing that says what that directory is. They coincide today. If
  // they stop, the sparse clone resolves to a marketplace whose one plugin is not
  // in the checkout — an install that fails after the clone succeeds — so a
  // rename fails here instead, on the same reasoning as the name check above.
  const dir = plugins?.find((p) => p.name === PLUGIN.name)?.source;
  const top = typeof dir === 'string' ? dir.replace(/^\.\//, '').split('/')[0] : null;
  if (top && !SPARSE_PATHS.includes(top)) {
    console.error(
      `The marketplace declares ${PLUGIN.name} at "${dir}" but init.mjs clones ` +
        `${SPARSE_PATHS.map((p) => `"${p}"`).join(' and ')}.\n` +
        'Add that directory to SPARSE_PATHS in scripts/init.mjs, or every project set up from ' +
        'here gets a marketplace clone with no plugin in it.',
    );
    process.exit(1);
  }
}

// The plugin is not a project that consumes itself. Initializing it would drop
// a second copy of the stylesheet beside the original in assets/, pin the
// source of truth to its own capture, and offer the plugin to the repo that
// publishes it.
//
// Detection is path identity with this running file, never a name: PLUGIN_ROOT
// comes from import.meta.url, so a target inside it is literally the tree these
// assets are being read from. The repo root above it is refused only when it
// carries our marketplace file, verified just above. A project that happens to
// be laid out like the plugin, or that vendors a copy of it, is unaffected.
const SKILL_DIR = resolve(here, '..');
const PLUGIN_ROOT = resolve(here, '..', '..');
const within = (root, p) => p === root || p.startsWith(root + sep);

const ownTree = within(PLUGIN_ROOT, target)
  ? "the Pushpin plugin's own source tree"
  : existsSync(marketplacePath) && target === resolve(PLUGIN_ROOT, '..')
    ? `the ${MARKETPLACE} repository, which ships this plugin`
    : null;

if (ownTree) {
  const assetsRel = (relative(target, join(SKILL_DIR, 'assets')) || '.') + sep;
  console.error(
    `Refusing to initialize ${target}.\n` +
      `That is ${ownTree}, not a project that consumes Pushpin. init writes a copy of the ` +
      'stylesheet, a pushpin.config.json pinned to a capture, an AGENTS.md section, and an ' +
      'offer of the plugin — and the originals all of that is copied from are here in ' +
      `${assetsRel}, so the result would be the source of truth pinned to itself.\n` +
      'Point it at the project that should use Pushpin: node scripts/init.mjs <project-dir>',
  );
  process.exit(1);
}

const env = detectStack(target);
const cssPath = opt('--css-path', join(env.stylesDir, 'pushpin.css'));

/**
 * Where this project's prototype is looked at, and whether Pushpin may start
 * it.
 *
 * A project with a dev server of its own keeps it: running someone's `next dev`
 * detached, out of sight of the terminal they expect it in, is not a design
 * system's business, and those servers already watch and reload. The port is
 * still recorded so the preview can say when nothing is answering there.
 *
 * A flat prototype has no such server, which is why every one of them ends up
 * with a hand-written one that dies with the shell that started it. That is the
 * case Pushpin serves.
 *
 * An explicit `--preview-port` says the static preview is wanted regardless,
 * which is also the remedy offered when something else already holds the port.
 */
const preview = !PREVIEW
  ? false
  : env.devCommand && !PREVIEW_PORT_GIVEN
    ? { port: env.devPort, command: env.devCommand, autostart: false }
    : { port: PREVIEW_PORT, root: '.', autostart: true };

const plan = [];
const skipped = [];

// If the project was set up before, say whether it is behind rather than just
// declining to overwrite. A silently outdated stylesheet is the failure this
// whole plugin exists to prevent. Same comparison freshness.mjs uses on
// session start, so the two cannot disagree about whether the pin is current.
const stale = inspectPin(target, { manifest: MANIFEST, pluginVersion: PLUGIN.version })?.details ?? [];

function planFile(rel, describe, writeFn) {
  const abs = join(target, rel);
  if (existsSync(abs) && !FORCE) {
    skipped.push(`${rel} — already exists (use --force to replace)`);
    return;
  }
  plan.push({ rel, describe, abs, writeFn });
}

planFile(cssPath, 'the Pushpin token stylesheet, 300 custom properties', (abs) => {
  mkdirSync(dirname(abs), { recursive: true });
  copyFileSync(join(ASSETS, 'pushpin.css'), abs);
});

// Design-system drift is now usually introduced in the browser and pushed to
// Figma afterwards, which means the Figma audit catches it a step too late.
// These two files project Pushpin's tokens into the format `impeccable`'s
// detector reads, turning its design-system-* rules into live Pushpin checks
// with no change to impeccable itself. See impeccable-bridge.mjs.
//
// Copied rather than rendered, like the stylesheet: nothing in either is
// project-specific, so both are built and committed by build-design.mjs and
// carry a manifest hash. That hash is what the project records — the identity of
// the plugin's copy, which is what lets a project holding an older build be told
// apart from one whose file has been edited.
const designHash = MANIFEST.hashes['DESIGN.md'];
const sidecarHash = MANIFEST.hashes['design.json'];

planFile('pushpin.config.json', 'Figma keys and the capture this project is pinned to', (abs) => {
  writeFileSync(
    abs,
    JSON.stringify(
      {
        $comment:
          'Written by the pushpin skill. Lets the Figma bridge work without re-deriving keys. ' +
          '`capturedAt` and `pluginVersion` record which snapshot of the kit this stylesheet ' +
          'came from — compare them against the plugin to find out if it is behind. ' +
          '`designHash` and `sidecarHash` are what the plugin build of the two generated ' +
          'files hashes to, which is what lets an overwrite of either be noticed. ' +
          '`preview` is where the prototype is served and whether Pushpin may start it.',
        designSystem: 'pushpin',
        pluginVersion: PLUGIN.version,
        capturedAt: MANIFEST.capturedAt,
        css: './' + cssPath.split('\\').join('/'),
        cssHash: MANIFEST.hashes['pushpin.css'],
        designHash,
        sidecarHash,
        // Whether the hook was wanted, not whether it is installed — the
        // manifests answer that themselves, and a recorded claim about them can
        // go stale. This distinguishes a project that declined the hook with
        // --no-hook, which no manifest can express, from one that lost it.
        checkHook: HOOK,
        // Where the prototype is served and who may start it. `false` is a
        // deliberate --no-preview, and absent means a project set up before the
        // preview existed — which is why the two are not the same value.
        preview,
        // The install that ran init, and the shim's first choice when locating
        // the plugin. A hint rather than a dependency: it is checked for
        // existence, and the host caches are searched when it is gone.
        pluginPath: SKILL_DIR,
        figma: {
          fileKey: SOURCE.fileKey,
          fileName: SOURCE.fileName,
          libraryKey: KEYS.source.libraryKey,
        },
      },
      null,
      2,
    ) + '\n',
  );
});

// Planned in this order deliberately: the detector compares mtimes and warns
// when the markdown is newer than the sidecar, so the sidecar goes last.
planFile(DESIGN_REL, "Pushpin's tokens as design-system checks for the browser phase", (abs) =>
  copyFileSync(join(ASSETS, 'DESIGN.md'), abs),
);

planFile(SIDECAR_REL, 'the complete token ramps behind those checks', (abs) => {
  mkdirSync(dirname(abs), { recursive: true });
  copyFileSync(join(ASSETS, 'design.json'), abs);
});

// Declaring the marketplace in the project's own settings is what lets someone
// who has never touched the CLI pick this up: Claude Code prompts them to
// install it when they trust the folder. Merge rather than replace — this file
// is shared and usually already holds unrelated project settings.
function planSettings() {
  const rel = join('.claude', 'settings.json');
  const abs = join(target, rel);

  let existing = null;
  if (existsSync(abs)) {
    try {
      existing = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      skipped.push(`${rel} — could not be parsed, leaving it alone`);
      return;
    }
  }

  const base = existing ?? {};
  const marketplaces = base.extraKnownMarketplaces ?? {};
  const enabled = base.enabledPlugins ?? {};
  const current = marketplaces[MARKETPLACE];

  // `sparsePaths` belongs inside `source`; `autoUpdate` is a sibling of it, one
  // level up. That is the shape the CLI's own schema declares and the shape it
  // writes back when someone toggles auto-update, so the two levels are not
  // interchangeable — read together they are one declaration, but a settings file
  // is validated key by key.
  const source = { source: 'git', url: REPO_URL, sparsePaths: SPARSE_PATHS };

  // Off by default here: the CLI enables auto-update on its own only for
  // Anthropic's own marketplaces, and every other one — this included — resolves
  // to false when the key is absent. Absent is therefore a frozen install, not a
  // choice, and a frozen install is how a project's tokens quietly stop matching
  // the Figma kit. An explicit `false` is the choice, and is left alone even under
  // --force: re-enabling background updates for a whole team is not a repair.
  const autoUpdate = current?.autoUpdate ?? true;

  const sourceCurrent = JSON.stringify(current?.source) === JSON.stringify(source);
  const declared = sourceCurrent && current?.autoUpdate !== undefined;
  if (declared && enabled[PLUGIN_REF] === true && !FORCE) {
    skipped.push(`${rel} — already offers Pushpin to anyone who opens this repo`);
    return;
  }

  const next = {
    ...base,
    extraKnownMarketplaces: {
      ...marketplaces,
      // Spread first so anything else already on the entry survives —
      // `installLocation` is legal here and is not ours to drop.
      [MARKETPLACE]: { ...current, source, autoUpdate },
    },
    enabledPlugins: { ...enabled, [PLUGIN_REF]: true },
  };

  // Named one at a time rather than as "update the declaration", because the three
  // arrive on different runs: a project from before the clone URL needs all three,
  // one written between then and now needs the last two, and saying it repointed a
  // URL it never changed is how a plan stops being worth reading.
  const gains = !current
    ? []
    : [
        current.source?.url === REPO_URL ? null : 'a clone URL, so the install cannot stall on SSH',
        JSON.stringify(current.source?.sparsePaths) === JSON.stringify(SPARSE_PATHS)
          ? null
          : 'a sparse checkout, so the clone holds this plugin instead of the whole repo',
        current.autoUpdate === undefined
          ? 'auto-update, which is off by default for a marketplace that is not Anthropic-owned'
          : null,
      ].filter(Boolean);

  plan.push({
    rel,
    describe: !existing
      ? `offer ${PLUGIN_REF} to anyone who opens this repo, no CLI needed`
      : gains.length
        ? `give the ${MARKETPLACE} declaration ${gains.join('; ')}`
        : `add ${PLUGIN_REF} to the plugins this repo offers`,
    abs,
    writeFn: (a) => {
      mkdirSync(dirname(a), { recursive: true });
      writeFileSync(a, JSON.stringify(next, null, 2) + '\n');
    },
  });
}

if (SHARE) planSettings();

// The edit hook. `check.mjs` re-states a broken rule on the edit that broke it,
// which is what lets SKILL.md carry five rules instead of eleven — a rule the
// model has to still be holding is a rule that decays over a long session.
//
// Both manifests are merged rather than replaced, and both are machine-local by
// nature: the command carries an absolute path, which is correct for whoever ran
// `init` and meaningless to anyone else. A teammate without the plugin gets a
// shim that finds nothing and exits 0 in silence, or a path that does not
// resolve, which both harnesses fail open on. Either way the worst case is a
// hook that does nothing.
//
// What they name is the project's own shim, not this plugin. The plugin lives in
// a directory named after its version, and Cursor keeps exactly one, deleting the
// old one when it updates itself — so a manifest naming the plugin directly stops
// resolving on the next update, silently, because hooks fail open. The shim does
// not move, and resolves the installed plugin at run time instead.
const HOOK_CMD = `node "${join(target, SHIM_REL)}"`;
const HOOK_TIMEOUT = 15;
const SHIM_SRC = join(here, 'hooks', 'project-shim.mjs');

// The write guard, through the same shim. It refuses a write that would replace
// DESIGN.md or .impeccable/design.json with something that is not Pushpin —
// `/impeccable document`, most often, which impeccable's own staleness finding
// recommends by name. Cursor only: it is the harness with a pre-write event, and
// the guard is the weakest of the three layers anyway. The recorded hashes are
// what guarantee an overwrite is noticed on every harness; this just gets there
// before the write instead of after it.
const GUARD_CMD = `node "${join(target, SHIM_REL)}" ${GUARD_FLAG}`;
const GUARD_TIMEOUT = 10;

const ALLOW_RULES = allowRules();

/**
 * The shim carries no user content, so it is refreshed whenever it differs from
 * this plugin's copy rather than waiting for --force. That is what lets a project
 * predating the shim, or holding an older one, heal on a plain --write.
 */
function planShim() {
  const abs = join(target, SHIM_REL);
  const want = readFileSync(SHIM_SRC, 'utf8');
  if (existsSync(abs) && readFileSync(abs, 'utf8') === want) {
    skipped.push(`${SHIM_REL} — already current`);
    return;
  }
  plan.push({
    rel: SHIM_REL,
    describe: 'locates the installed plugin at run time, so a plugin update cannot break the hook',
    abs,
    writeFn: (a) => {
      mkdirSync(dirname(a), { recursive: true });
      writeFileSync(a, want);
    },
  });
}

function planHookManifest(rel, expected, fresh, merge) {
  const abs = join(target, rel);
  let existing = null;
  if (existsSync(abs)) {
    try {
      existing = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      skipped.push(`${rel} — could not be parsed, leaving it alone`);
      return;
    }
  }

  // Only a manifest already carrying exactly the hooks this manifest should
  // have is left alone. Anything else is repaired without --force: a command
  // pointing at a deleted plugin directory is not a decision to preserve, and
  // treating it as one is how the check ends up silently disabled. Comparing
  // against a set rather than a single command is what lets a manifest hold two
  // of our hooks without either reading as drift.
  const commands = hookCommands(existing ?? {});
  const want = new Set(expected);
  const current = commands.length === want.size && commands.every((c) => want.has(c));
  if (current && !FORCE) {
    skipped.push(`${rel} — already runs the Pushpin hooks it should`);
    return;
  }
  const next = merge(existing ?? {});
  plan.push({
    rel,
    describe:
      commands.length && !current
        ? 'bring the Pushpin hooks here up to date — repoint anything stale at the project shim, add anything missing'
        : fresh,
    abs,
    writeFn: (a) => {
      mkdirSync(dirname(a), { recursive: true });
      writeFileSync(a, JSON.stringify(next, null, 2) + '\n');
    },
  });
}

// Prior entries of ours are dropped before the current one is added, which is
// what makes installing and repairing the same operation and keeps a re-run from
// stacking up duplicate hooks. Anything not ours is untouched.
function planHooks() {
  planShim();

  planHookManifest(
    join('.cursor', 'hooks.json'),
    [HOOK_CMD, GUARD_CMD],
    'run the Pushpin check after each edit, and refuse writes that would replace the generated files',
    (base) => ({
      ...base,
      version: base.version ?? 1,
      hooks: {
        ...(base.hooks ?? {}),
        afterFileEdit: [
          ...withoutHook(base.hooks?.afterFileEdit),
          { command: HOOK_CMD, timeout: HOOK_TIMEOUT },
        ],
        // Merged like the rest: impeccable installs its own detector here, and
        // preserving foreign entries is what lets both run.
        preToolUse: [
          ...withoutHook(base.hooks?.preToolUse),
          { command: GUARD_CMD, timeout: GUARD_TIMEOUT },
        ],
      },
    }),
  );
}

/**
 * Claude Code's machine-local settings file, not the shared one. Both things it
 * carries are absolute paths on this machine — the hook command, and the allow
 * rules from `lib/permissions.mjs` — and committing either would hand every
 * teammate a path that does not exist. It is also the file Claude Code writes
 * itself when someone answers "yes, don't ask again", so the rules land where
 * that answer would have put them.
 *
 * The allow rules go here rather than in the shared `.claude/settings.json` for
 * a second reason: allow rules in project settings grant capability, so Claude
 * Code holds them until the workspace trust dialog is accepted, and that file is
 * the one init tells people to commit.
 *
 * One planner for both halves because they land in the same file. Two plan
 * entries writing the same path would each compute their merge from disk, and
 * the second would drop the first.
 *
 * No write guard in this half. Claude Code's is a post-write event, so a deny
 * would arrive after the file was already replaced; the same edit reports the
 * overwrite through the check instead, and the recorded hashes catch it at
 * session start.
 */
function planClaudeLocal() {
  const rel = SETTINGS_REL;
  const abs = join(target, rel);

  let existing = null;
  if (existsSync(abs)) {
    try {
      existing = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      skipped.push(`${rel} — could not be parsed, leaving it alone`);
      return;
    }
  }

  const base = existing ?? {};

  // With --no-hook there is nothing to install and nothing to repair, so the
  // hooks already here are left exactly as found and only the rules are merged.
  const commands = hookCommands(base);
  const hookCurrent = !HOOK || (commands.length === 1 && commands[0] === HOOK_CMD);

  const allow = base.permissions?.allow ?? [];
  const missing = ALLOW_RULES.filter((r) => !allow.includes(r));

  if (hookCurrent && !missing.length && !FORCE) {
    skipped.push(`${rel} — already runs the Pushpin check and allows its read-only scripts`);
    return;
  }

  let next = base;
  if (HOOK) {
    next = {
      ...next,
      hooks: {
        ...(next.hooks ?? {}),
        PostToolUse: [
          ...withoutHook(next.hooks?.PostToolUse),
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [{ type: 'command', command: HOOK_CMD, timeout: HOOK_TIMEOUT }],
          },
        ],
      },
    };
  }

  // Appended, never replaced: a rule someone else added is theirs, and this
  // file is where Claude Code keeps every approval the user has ever granted.
  next = {
    ...next,
    permissions: { ...(next.permissions ?? {}), allow: [...allow, ...missing] },
  };

  const describe =
    [
      HOOK && !hookCurrent
        ? commands.length
          ? 'repoint the Pushpin check at the project shim'
          : 'run the Pushpin check after each edit, reporting off-system values, undeclared lookalikes, and off-guideline copy in place'
        : null,
      missing.length
        ? `let Pushpin's ${ALLOWED_SCRIPTS.length} read-only scripts run without a permission prompt`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'refresh the Pushpin hook and allow rules';

  plan.push({
    rel,
    describe,
    abs,
    writeFn: (a) => {
      mkdirSync(dirname(a), { recursive: true });
      writeFileSync(a, JSON.stringify(next, null, 2) + '\n');
    },
  });
}

if (HOOK) planHooks();

// Not gated on the hook. Declining the per-edit check is not a decision to keep
// being asked whether a catalog lookup may run.
planClaudeLocal();

// A short, durable note so an agent opening this repo later knows the system is
// in use and where the authority lives — the original point of packaging this.
//
// The precedence line belongs here rather than only in SKILL.md because the
// skills it constrains — impeccable, frontend-design, ui-ux-pro-max — can be
// loaded into a session this skill never enters. AGENTS.md is read either way.
/**
 * What an agent opening this repo later needs to know about the preview.
 *
 * Naming the URL is the point. Without it the reasonable move on finding a
 * dead page is to start a server — on a port of its own choosing, or on this
 * one, racing the copy already there — which is how a project ends up with
 * three of them and a browser tab pointed at whichever won.
 */
function previewNote() {
  if (!preview) return '';
  if (preview.autostart) {
    return (
      `- The prototype is served at ${previewUrl(preview.port)}, started and restarted for you\n` +
      `  on edit, detached, with caching off. Do not start a second server for this project,\n` +
      `  and do not kill whatever holds the port. To bring it up without editing anything:\n` +
      `  \`node ${SHIM_REL} ${PREVIEW_FLAG}\`.\n`
    );
  }
  return (
    `- This project is served by its own dev server (\`${preview.command}\`), which Pushpin\n` +
    `  does not start or stop.\n`
  );
}

const NOTE = `## Design system

This project uses **Pushpin**, Thumbtack's design system.

- Pushpin is this project's tokens, components, icon set, and words, so it
  outranks any other design skill's craft floor, ambition, or category
  defaults. Those skills choose among Pushpin-legal options, never around them.
- Tokens: \`${cssPath}\` — use \`--pp-*\` custom properties, never raw hex or px.
- Prefer semantic tokens (\`--pp-background-brand-strong\`) over base ramps
  (\`--pp-color-blue-950\`). Reaching for a base ramp means no semantic token fit,
  which is worth questioning.
- Buttons, inputs, and chips are pill-shaped: \`--pp-radius-sides\`.
- \`DESIGN.md\` and \`.impeccable/design.json\` are generated from those tokens, so
  a hardcoded color, font, radius, or font size is flagged as drift while you
  work. Both are machine-written — fix the code, not the check.
- **Never overwrite either file.** \`/impeccable document\` and any new-work flow
  that writes a design brief must leave both alone; they carry Pushpin, and a
  regenerated one carries an invented visual world instead.
- If \`design-md-drift\` or a staleness check flags them, re-run
  \`pushpin init --write --force\`. Never \`document\`. That command reproduces
  both files exactly, so refusing costs nothing.
- This is enforced, not just asked. Their hashes are recorded in
  \`pushpin.config.json\`: an overwrite is reported on the edit that caused it and
  again at session start, and on Cursor a write that would strip the generated
  marker is refused outright.
- Hand-rolled markup standing in for a published component names it:
  \`data-pp-component="Button" data-pp-variant="theme=primary"\`. Markup standing in
  for nothing published says \`data-pp-proposed\`. This is what tells a Figma push
  which component to instance instead of guessing. See \`DESIGN.md\` § Components.
- An edit hook reports off-system values, undeclared component lookalikes, and
  off-guideline copy in the file you just wrote. To ask for the same report
  yourself, or to check a file the hook did not see:
  \`node <pushpin>/scripts/check.mjs <path>\`.
- Copy follows Thumbtack's content design rules, and nothing turns them on. To
  hold words against them before they reach a file:
  \`node <pushpin>/scripts/copy.mjs --text "Send request" --component Button\`.
${previewNote()}- Component and token names are case-sensitive and not guessable — look one up
  with \`node <pushpin>/scripts/lookup.mjs <name>\` rather than typing it from
  memory.
- Figma source of truth: \`${SOURCE.fileName}\` (\`${SOURCE.fileKey}\`).
- Full guidance lives in the \`pushpin\` skill. Load it before design work.
`;

const agentsPath = join(target, 'AGENTS.md');
if (existsSync(agentsPath)) {
  const body = readFileSync(agentsPath, 'utf8');
  if (body.includes('## Design system')) {
    skipped.push('AGENTS.md — already has a "Design system" section');
  } else {
    plan.push({
      rel: 'AGENTS.md',
      describe: 'append a Design system section',
      abs: agentsPath,
      writeFn: (abs) => writeFileSync(abs, body.trimEnd() + '\n\n' + NOTE),
    });
  }
} else {
  planFile('AGENTS.md', 'note that this project uses Pushpin', (abs) =>
    writeFileSync(abs, NOTE),
  );
}

console.log(`Target: ${target}`);
console.log(`Detected: ${describeStack(env)}\n`);

if (plan.length === 0 && skipped.length) {
  console.log('Nothing to do.');
} else {
  console.log(WRITE ? 'Writing:' : 'Would write (pass --write to apply):');
  for (const p of plan) console.log(`  ${p.rel}\n    ${p.describe}`);
}
if (skipped.length) {
  console.log('\nSkipped:');
  for (const s of skipped) console.log(`  ${s}`);
}
if (stale.length) {
  console.log('\nThis project is behind:');
  for (const s of stale) console.log(`  ${s}`);
  // The remedy only belongs here when this run is not about to apply it: a
  // write with something to write reports its real outcome below instead. A
  // --write that plans nothing still needs it, which is the case a plain
  // `if (!WRITE)` would drop.
  if (!WRITE || !plan.length) {
    console.log('\n  Re-run with --write --force to bring it up to date.');
  }
}

if (WRITE && plan.length) {
  for (const p of plan) p.writeFn(p.abs);
  console.log(`\nDone — ${plan.length} file(s) written.`);

  // Re-asked rather than inferred: the findings above describe the project as it
  // was found, and only the same comparison run again can say whether the writes
  // actually resolved them.
  if (stale.length) {
    const after = inspectPin(target, { manifest: MANIFEST, pluginVersion: PLUGIN.version });
    const remaining = after?.details ?? [];
    if (remaining.length) {
      console.log('\nStill behind:');
      for (const s of remaining) console.log(`  ${s}`);
      console.log('\n  Re-run with --write --force to bring it up to date.');
    } else {
      console.log('  This project is no longer behind.');
    }
  }

  // What is left for a person to do, and nothing that only explains a file that
  // was just written. Those explanations all live in reference/init.md, and
  // sixty lines of them after a successful setup is how the lines actually
  // asking for something get missed. They print on --advice.
  const next = [];

  // Asked of the project rather than stated every time. Nothing renders until
  // something loads the stylesheet, which is what earns the line on a fresh
  // project — and on the re-run of one whose app root has named it all along it
  // is a line that has to be read to be discarded. An answer of `unknown` says
  // nothing at all; see lib/stylesheet.mjs for what it declines to claim.
  if (stylesheetReference(target, cssPath) === 'unreferenced') {
    const cssRel = relative(target, join(target, cssPath)).split('\\').join('/');
    // A module graph loads a stylesheet with an `import`; a page loads it with a
    // `<link>`. Most projects here are static prototypes with no module to
    // import into, where the import is not merely useless — pasted into a
    // `<script>` it takes the page down with it. So the link is also what an
    // unrecognized stack gets: it is the form that costs nothing to try in a
    // project that turns out to have a bundler after all.
    const [where, snippet] =
      env.react || env.bundler
        ? ['import it once at your app root', `import '${importSpecifier(cssRel)}';`]
        : ['link it from the <head> of your page', `<link rel="stylesheet" href="${cssRel}">`];
    next.push(`Nothing in this project loads ${cssRel} — ${where}:\n       ${snippet}`);
  }

  // Asked of the machine rather than stated unconditionally: the font is not
  // bundled either way, but telling someone to install one they already have is
  // a line they have to read to discard.
  if (!riseFontInstalled()) {
    next.push(
      `Thumbtack Rise is not installed on this machine — install it, or point\n` +
        `     --pp-font-family at something else.`,
    );
  }

  // Only inside a repository. The advice names files that only a repository can
  // ignore, and printing it into a folder that has none is an instruction to
  // create something for nothing.
  const ignore = [
    ...(preview && preview.autostart ? ['.pushpin/preview.log', '.pushpin/preview.pid'] : []),
    ...(plan.some((p) => p.rel === SETTINGS_REL) ? [SETTINGS_REL] : []),
  ];
  if (ignore.length && isGitRepo(target)) {
    next.push(
      ignore.length === 1
        ? `Add ${ignore[0]} to .gitignore — it belongs to this machine, not to the repo.`
        : `Add ${ignore.join(', ')}\n` +
          `     to .gitignore — they belong to this machine, not to the repo.`,
    );
  }

  // A header over nothing is the process narrating itself, which is the whole
  // reason this block is conditional.
  if (next.length) {
    console.log('\nNext:');
    next.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));
  }

  if (ADVICE) {
    if (env.thumbprint) {
      console.log(`\nThumbprint detected — load its v2 token stylesheet, not v1.`);
      console.log(`  Pushpin IS Thumbprint v2's semantic layer; --tp-* and --pp-* name the`);
      console.log(`  same tokens. Do not add per-component CSS overrides to force the look.`);
    } else {
      console.log(`\nBuild with the custom properties; see the skill's reference/tokens.md.`);
    }

    if (preview && preview.autostart) {
      console.log(`\nPreview: ${previewUrl(preview.port)}`);
      console.log(`  Started for you on the next edit, and restarted whenever it has stopped —`);
      console.log(`  detached, so it survives the turn that started it. Caching is off, so a`);
      console.log(`  reload cannot answer from the file you just changed.`);
    } else if (preview && preview.command) {
      console.log(`\nPreview: this project has its own dev server — \`${preview.command}\`.`);
      console.log(`  Pushpin does not start it. It says so when nothing answers${preview.port ? ` on port ${preview.port}` : ''},`);
      console.log(`  and \`--preview-port <n>\` puts Pushpin's own static preview alongside it.`);
    }

    if (plan.some((p) => p.rel === SETTINGS_REL)) {
      console.log(
        `\nGranted: Pushpin's ${ALLOWED_SCRIPTS.length} read-only scripts (${ALLOWED_SCRIPTS.join(', ')}) now run`,
      );
      console.log(`  without a permission prompt, because they are asked for constantly and only`);
      console.log(`  ever read. Named by full path in .claude/settings.local.json, which is this`);
      console.log(`  machine's and not a teammate's.`);
      console.log(`  Nothing else was granted — init still asks before it writes.`);
    }

    if (plan.some((p) => p.rel === 'DESIGN.md')) {
      console.log(`\nDESIGN.md and .impeccable/design.json turn the tokens into live checks:`);
      console.log(`  a raw hex, font, radius, or font size that is not Pushpin is reported as`);
      console.log(`  drift while you work, rather than at the Figma push. DESIGN.md also carries`);
      console.log(`  the rules a token allowlist cannot express, which is what impeccable reads`);
      console.log(`  as the brief. Both are generated — re-run init after updating the plugin,`);
      console.log(`  and never hand-edit them.`);
      console.log(`\n  Available, and not ours to write:`);
      console.log(`    /impeccable init   PRODUCT.md only. Pushpin does not write product truth.`);
      console.log(`\n  Do not run /impeccable document — it replaces both files with an invented`);
      console.log(`  design system. That is now refused on Cursor and reported everywhere; if a`);
      console.log(`  staleness check flags them, re-run init --write --force.`);
      console.log(`\n  To check what is actually set up rather than what was advised:`);
      console.log(`    node scripts/setup.mjs ${target} --verify`);
    }

    if (plan.some((p) => p.rel.endsWith('settings.json'))) {
      console.log(`\nCommit .claude/settings.json to share Pushpin with the team.`);
      console.log(`  Anyone who opens this repo is prompted to install it when they trust the`);
      console.log(`  folder — no terminal needed. The plugin stays unloaded until they accept,`);
      console.log(`  so tell them to say yes.`);
      console.log(`  It asks for auto-update too, which is off by default for this marketplace,`);
      console.log(`  so nobody ends up holding a capture that has quietly stopped matching the`);
      console.log(`  kit. Turning it off lands in this same shared file, so that is a team call.`);
    }
  }
} else if (!WRITE && plan.length) {
  console.log('\nRe-run with --write to apply.');
}

#!/usr/bin/env node
/**
 * The parts of `/pushpin setup` that a script can do: reading the machine the
 * session is running on, reading the project before anything is written, and
 * checking what is actually true afterwards.
 *
 * `init.mjs` remains the only thing that writes Pushpin's artifacts. This reads.
 * The middle of setup — the one question a project can still leave open — is a
 * conversation, and lives in reference/setup.md.
 *
 * Why it exists at all: `init` prints good advice, and advice is where the
 * onboarding was failing. It told people to run two more commands and could not
 * tell whether they had, so a project could sit half-configured with every
 * individual check reporting health. `--assess` decides which questions are
 * genuinely open so none are asked twice, and `--verify` reports the end state
 * rather than restating the instructions.
 *
 * Every mode reports what needs doing and nothing else. A row that passed is
 * not news, and eleven of them in front of a designer who wants to know whether
 * anything is broken is how the answer gets lost — `--all` is there for the
 * maintainer who wants the whole picture, and `--json` is unchanged.
 *
 * Usage:
 *   node scripts/setup.mjs <project-dir>            # same as --assess
 *   node scripts/setup.mjs <project-dir> --assess   # only what still has to be asked
 *   node scripts/setup.mjs <project-dir> --ready    # what the machine is missing
 *   node scripts/setup.mjs <project-dir> --verify   # what is not true yet
 *   node scripts/setup.mjs <project-dir> --backup   # copy aside what --force would replace
 *   node scripts/setup.mjs <project-dir> --all      # every row, not only the faults
 *   node scripts/setup.mjs <project-dir> --json     # machine-readable, any mode
 *
 * `--ready` takes the two prefixes freshness.mjs established: `fix: <command>`
 * for something the agent settles itself, `say: <sentence>` for something that
 * needs the user's hands. It exits 0 whatever it finds, for the reason
 * `--session` does — a readiness check that reads as a failed command is the
 * noise this form exists to remove. `--harness <claude|cursor>` overrides
 * detection; all it decides is whether Claude Code's own two checks run.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';
import {
  acceptsEdits,
  detectHarness,
  figmaDesktop,
  findImpeccable,
  globalAutoUpdate,
  HARNESSES,
  isGitRepo,
  MARKETPLACE,
  MIN_NODE,
  permissionMode,
} from './lib/environment.mjs';
import { GENERATED, generatedState } from './lib/generated.mjs';
import { inspectHooks } from './lib/hooks.mjs';
import { ALLOWED_SCRIPTS, missingAllowRules, SETTINGS_REL } from './lib/permissions.mjs';
import { DEFAULT_PORT, previewUrl, probe, readPreview, servesRoot } from './lib/preview.mjs';
import { describeStack, detectStack } from './lib/project.mjs';
import { inspectPin } from './pin.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const PLUGIN_ROOT = resolve(here, '..', '..');

const MANIFEST = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));
const PLUGIN = JSON.parse(
  readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
);

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
/** Flags whose value follows them, so it is not mistaken for the target directory. */
const VALUE_FLAGS = new Set(['--harness']);
const target = resolve(
  argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1])) ?? '.',
);

const VERIFY = flag('--verify');
const READY = flag('--ready');
const BACKUP = flag('--backup');
const JSON_OUT = flag('--json');
const ALL = flag('--all');

const HARNESS = opt('--harness', detectHarness());
if (!HARNESSES.includes(HARNESS)) {
  console.error(`--harness takes ${HARNESSES.join(' or ')}, got: ${opt('--harness', '')}`);
  process.exit(1);
}

if (!existsSync(target)) {
  console.error(`No such directory: ${target}`);
  process.exit(1);
}

const within = (root, p) => p === root || p.startsWith(root + sep);
if (within(PLUGIN_ROOT, target)) {
  console.error(
    `Refusing to set up ${target}. That is the Pushpin plugin's own tree, not a ` +
      'project that consumes it. Point this at the project instead.',
  );
  process.exit(1);
}

function readJson(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const env = detectStack(target);
const cssRel = join(env.stylesDir, 'pushpin.css');
const config = readJson(join(target, 'pushpin.config.json'));

// ------------------------------------------------------------------ neighbors

const impeccable = findImpeccable(target);
const productMd = existsSync(join(target, 'PRODUCT.md'));

// ----------------------------------------------------------------- git safety

/**
 * Whether there is a way back from an overwrite that does not involve a backup.
 *
 * `init --force` replaces files a person may have written, and the assumption
 * that git is underneath is worth checking rather than making: a designer's
 * prototype folder frequently is not a repository at all, and that is exactly
 * where an unrecoverable overwrite lands.
 */
function gitSafety(paths) {
  const git = (args) => {
    try {
      return execFileSync('git', ['-C', target, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };

  if (!isGitRepo(target)) {
    return { repo: false, dirty: [], safe: false, note: 'no git repository — a backup is the only way back' };
  }
  if (!paths.length) return { repo: true, dirty: [], safe: true, note: 'git repository' };

  const status = git(['status', '--porcelain', '--', ...paths]);
  if (status === null) {
    return { repo: true, dirty: [], safe: false, note: 'git repository, but its status could not be read' };
  }
  const dirty = status
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim());

  return dirty.length
    ? {
        repo: true,
        dirty,
        safe: false,
        note: `git repository, but ${dirty.length} of those file${dirty.length === 1 ? ' is' : 's are'} uncommitted, so git cannot restore ${dirty.length === 1 ? 'it' : 'them'}`,
      }
    : { repo: true, dirty: [], safe: true, note: 'git repository, all committed — git is the way back' };
}

// ----------------------------------------------------------------- readiness

/** The one thing here that writes, named in a `fix:` line rather than run from here. */
const ENVIRONMENT = join(here, 'lib', 'environment.mjs');

/**
 * The machine the session is running on, as faults only.
 *
 * Everything a project can answer about itself is `--assess`'s job. This is the
 * rest of it — the neighbors, the harness settings, the applications — and it
 * is asked first because none of it is settled by setting a project up, and all
 * of it reads as Pushpin being broken when it is wrong.
 *
 * A clean machine prints nothing at all. That is the whole contract: an empty
 * run means there was nothing to say, not that nothing was checked.
 */
function ready() {
  const checks = [];
  const check = (id, state, detail, line) => checks.push({ id, state, detail, line });

  // Claude Code's two settings checks do not run on Cursor. Cursor has neither
  // setting, and a nudge about a preference the harness does not have is worse
  // than silence — it sends someone looking for a screen that is not there.
  const claude = HARNESS === 'claude';

  const major = Number(process.versions.node.split('.')[0]);
  check(
    'node',
    major >= MIN_NODE ? 'ok' : 'say',
    process.version,
    `This is Node ${process.versions.node}, and every script here needs ${MIN_NODE} or newer — ` +
      `installing the current release from nodejs.org is the first thing I'd do.`,
  );

  check(
    'impeccable',
    impeccable.installed ? 'ok' : 'say',
    impeccable.installed ? `installed at ${impeccable.path}` : 'not installed',
    `impeccable is not installed. It runs the interview that writes PRODUCT.md, the product ` +
      `record every design command here reads, and its per-edit detector catches slop beside ` +
      `Pushpin's own check — npx impeccable install, then /impeccable init.`,
  );

  // Auto-update, and only from a marketplace entry that has never said. See
  // lib/environment.mjs for why absent is a frozen install rather than a
  // preference, and why the other three answers are left alone.
  const autoUpdate = claude ? globalAutoUpdate() : null;
  check(
    'auto-update',
    !claude || autoUpdate === 'none' || autoUpdate === 'unreadable'
      ? 'skipped'
      : autoUpdate === 'unset'
        ? 'fix'
        : 'ok',
    !claude
      ? 'Claude Code only'
      : {
          on: 'on',
          off: 'off, which is a choice and is left alone',
          unset: `never set, so the ${MARKETPLACE} install is frozen at the capture it was made with`,
          none: `no ${MARKETPLACE} entry — this plugin arrived another way`,
          unreadable: 'the global settings file could not be parsed',
        }[autoUpdate],
    `node "${ENVIRONMENT}" --enable-auto-update`,
  );

  // Read, never written. It is the user's guard, and lowering it for them is
  // not a repair — which is why this is the one Claude Code check that stays a
  // sentence even though a script could settle it.
  const mode = claude ? permissionMode(target) : null;
  check(
    'permission mode',
    !claude ? 'skipped' : acceptsEdits(mode) ? 'ok' : 'say',
    !claude ? 'Claude Code only' : (mode ?? 'unset — the default, which asks every time'),
    `Claude Code will stop on every command until you switch to Auto — Shift+Tab until the ` +
      `status bar says Auto. Accepting edits is not enough; that still asks about commands.`,
  );

  const figma = figmaDesktop();
  check(
    'figma desktop',
    figma === 'running' ? 'ok' : figma === 'stopped' ? 'say' : 'skipped',
    { running: 'running', stopped: 'not running', unknown: 'could not read the process list' }[
      figma
    ],
    `Figma's desktop app is not running, and every write into a Figma file executes inside ` +
      `it — opening it before we push anything there saves a failed run.`,
  );

  return {
    mode: 'ready',
    target,
    harness: HARNESS,
    checks,
    fix: checks.filter((c) => c.state === 'fix').map((c) => c.line),
    say: checks.filter((c) => c.state === 'say').map((c) => c.line),
  };
}

function printReady(r) {
  if (ALL) {
    console.log(`Target: ${r.target}`);
    console.log(`Harness: ${r.harness}\n`);
    const markPad = Math.max(...r.checks.map((c) => c.state.length));
    const idPad = Math.max(...r.checks.map((c) => c.id.length));
    for (const c of r.checks) {
      const mark = c.state === 'skipped' ? '--' : c.state;
      console.log(`  ${mark.padEnd(markPad)}  ${c.id.padEnd(idPad)}  ${c.detail}`);
    }
    if (r.fix.length || r.say.length) console.log('');
  }
  for (const f of r.fix) console.log(`fix: ${f}`);
  for (const s of r.say) console.log(`say: ${s}`);
}

// -------------------------------------------------------------------- assess

/** Everything `init --force` would replace, as project-relative paths. */
function existingArtifacts() {
  const candidates = [
    config?.css ? config.css.replace(/^\.\//, '') : cssRel,
    'pushpin.config.json',
    ...GENERATED.map((g) => g.rel),
  ];
  return candidates.filter((rel) => existsSync(join(target, rel)));
}

/**
 * The preview this project has, or the one init would give it.
 *
 * `declined` and `absent` are different answers: the first is a --no-preview
 * that is respected, the second is a project set up before the preview existed.
 */
function plannedPreview() {
  if (config?.preview === false) return { state: 'declined' };
  const recorded = readPreview(target);
  if (recorded) {
    return {
      state: 'recorded',
      ...recorded,
      url: recorded.port ? previewUrl(recorded.port) : null,
    };
  }
  if (config) return { state: 'absent' };
  // Never set up. Same decision init.mjs makes, so the two cannot disagree
  // about what setup is about to do.
  return env.devCommand
    ? { state: 'planned', port: env.devPort, command: env.devCommand, autostart: false, url: env.devPort ? previewUrl(env.devPort) : null }
    : { state: 'planned', port: DEFAULT_PORT, root: '.', autostart: true, command: null, url: previewUrl(DEFAULT_PORT) };
}

function assess() {
  const existing = existingArtifacts();
  const git = gitSafety(existing);
  const pin = inspectPin(target, { manifest: MANIFEST, pluginVersion: PLUGIN.version });

  // Only questions the project has not already answered. A question with one
  // real answer is not a question, and asking it is how a short setup starts
  // feeling like a form — so an overwrite, the one thing here that cannot be
  // undone, is all that is ever asked.
  const ask = [];
  if (existing.length) {
    ask.push({
      id: 'overwrite',
      why: `${existing.length} Pushpin file${existing.length === 1 ? '' : 's'} already ${existing.length === 1 ? 'exists' : 'exist'} — ${git.note}`,
    });
  }

  return {
    mode: 'assess',
    target,
    stack: describeStack(env),
    thumbprint: env.thumbprint,
    state: config ? 'initialized' : 'fresh',
    pin: pin ? { status: pin.status, details: pin.details } : null,
    css: { rel: config?.css?.replace(/^\.\//, '') ?? cssRel, guessed: env.stylesDirGuessed },
    // What the preview will be, whether it is already recorded or is about to
    // be read off the project. Reported for the same reason the stylesheet
    // destination is: it is decided without asking, so it is shown rather than
    // discovered afterwards.
    preview: plannedPreview(),
    existing,
    git,
    impeccable: { ...impeccable, productMd },
    ask,
  };
}

/**
 * The open questions, and on the default path nothing else.
 *
 * Everything else assess knows — the stack, the destination, the preview, which
 * files are already here — is a decision the project makes for itself, and a
 * decision nobody has to make is not worth a line. The `Ask:` header went with
 * them: printing "nothing to ask" is the process narrating itself, and it is
 * what put "the project answers everything itself" in front of a user who had
 * asked to set a folder up.
 */
function printAssess(a) {
  if (!ALL) {
    const idPad = a.ask.length ? Math.max(...a.ask.map((q) => q.id.length)) : 0;
    for (const q of a.ask) console.log(`  ${q.id.padEnd(idPad)}  ${q.why}`);
    return;
  }

  console.log(`Target: ${a.target}`);
  console.log(`Detected: ${a.stack}`);
  console.log(
    `State: ${a.state === 'fresh' ? 'no pushpin.config.json — this project has never been set up' : `already set up${a.pin?.status === 'stale' ? ', and behind' : ''}`}`,
  );
  if (a.pin?.details?.length) for (const d of a.pin.details) console.log(`  ${d}`);

  console.log(
    `\nStylesheet: ${a.css.rel}${a.css.guessed ? ' (guessed — nothing here says where a stylesheet goes)' : ''}`,
  );

  const p = a.preview;
  console.log(
    `Preview: ${
      p.state === 'declined'
        ? 'declined with --no-preview'
        : p.state === 'absent'
          ? 'not recorded — this project was set up before the preview existed'
          : p.autostart
            ? `${p.url}, served by Pushpin`
            : `\`${p.command}\`, this project's own — Pushpin does not start it`
    }`,
  );

  if (a.existing.length) {
    console.log(`\nAlready present, and replaced only with --force:`);
    for (const rel of a.existing) console.log(`  ${rel}`);
    console.log(`  ${a.git.note}`);
  }

  console.log(
    `\nimpeccable: ${a.impeccable.installed ? `installed at ${a.impeccable.path}` : 'not installed'}`,
  );
  console.log(`PRODUCT.md: ${a.impeccable.productMd ? 'present' : 'absent'}`);

  console.log(`\nAsk:`);
  if (!a.ask.length) console.log('  nothing — the project answers every open question itself');
  const idPad = a.ask.length ? Math.max(...a.ask.map((q) => q.id.length)) : 0;
  for (const q of a.ask) console.log(`  ${q.id.padEnd(idPad)}  ${q.why}`);
}

// -------------------------------------------------------------------- verify

const OK = 'ok';
const MISSING = 'missing';
const NOTE = '--';

async function verify() {
  const rows = [];
  const advice = [];
  const row = (mark, name, detail) => rows.push({ mark, name, detail });

  if (!config) {
    return {
      mode: 'verify',
      target,
      rows: [{ mark: MISSING, name: 'config', detail: 'no pushpin.config.json — nothing is set up yet' }],
      advice: ['Run setup, or `node scripts/init.mjs <dir> --write`, to set this project up.'],
      ready: false,
    };
  }

  const pin = inspectPin(target, { manifest: MANIFEST, pluginVersion: PLUGIN.version });

  // Tokens and the pin. inspectPin already owns this comparison; repeating its
  // logic here is how the two would come to disagree.
  const cssRelActual = config.css?.replace(/^\.\//, '') ?? cssRel;
  row(
    existsSync(join(target, cssRelActual)) ? OK : MISSING,
    'tokens',
    existsSync(join(target, cssRelActual)) ? cssRelActual : `${cssRelActual} is not there`,
  );
  // The generated files get a row each below, so they are filtered out of the
  // pin's own line rather than reported twice in different words.
  const ownRow = GENERATED.map((g) => `${g.label}:`);
  const pinDetails = (pin?.details ?? []).filter((d) => !ownRow.some((p) => d.startsWith(p)));
  row(
    pinDetails.length ? MISSING : OK,
    'pin',
    pinDetails.length
      ? pinDetails.join('; ')
      : `plugin ${config.pluginVersion}, capture ${config.capturedAt}`,
  );

  // The two generated files, by the same states pin.mjs reports.
  for (const g of GENERATED) {
    const asset = g.kind === 'design' ? 'DESIGN.md' : 'design.json';
    const recorded = g.kind === 'design' ? config.designHash : config.sidecarHash;
    const state = generatedState(target, g.rel, recorded, hashAsset);
    // Untouched since it was written, and still an older build than the plugin
    // carries. `generatedState` cannot see this — it compares the file against
    // what was recorded, and both agree — so it is the same comparison pin.mjs
    // makes, and without it a project enforcing a superseded capture reports
    // itself intact.
    const stale = state === 'current' && recorded !== MANIFEST.hashes[asset];
    const detail = {
      absent: `${g.label} is not there`,
      unrecorded: `${g.label} — present, but no hash was recorded, so an overwrite would not be noticed`,
      current: stale
        ? `${g.label} is an older build of the tokens, so the checks behind it are enforcing an older capture`
        : `${g.label}, generated and unmodified`,
      edited: `${g.label} has changed since it was written`,
      replaced: `${g.label} no longer carries Pushpin — it has been replaced`,
    }[state];
    row(
      state === 'current' && !stale ? OK : state === 'unrecorded' ? NOTE : MISSING,
      `${g.kind}`,
      detail,
    );
    if (state === 'replaced' || state === 'edited' || state === 'absent') {
      advice.push(`\`node scripts/init.mjs ${target} --write --force\` restores ${g.label}. Never \`/impeccable document\`.`);
    }
    if (stale) {
      advice.push(
        `\`node scripts/init.mjs ${target} --write --force\` brings ${g.label} up to the capture this plugin carries.`,
      );
    }
    if (state === 'unrecorded') {
      advice.push(
        `\`node scripts/init.mjs ${target} --write --force\` records a hash for ${g.label}, which is what lets an overwrite be noticed.`,
      );
    }
  }

  // Hooks, read from the manifests rather than from anything recorded.
  const hooks = inspectHooks(target);
  const live = (role) => hooks.filter((h) => h.role === role && h.exists);
  const broken = hooks.filter((h) => !h.exists);

  if (config.checkHook === false) {
    row(NOTE, 'edit check', 'declined with --no-hook, and respected');
  } else {
    const checks = live('check');
    row(
      checks.length ? OK : MISSING,
      'edit check',
      checks.length
        ? `runs on edit — ${checks.map((h) => h.rel).join(', ')}`
        : 'no manifest runs it, so nothing is checking your edits',
    );
    const guards = live('guard');
    row(
      guards.length ? OK : NOTE,
      'write guard',
      guards.length
        ? `refuses overwrites of the generated files — ${guards.map((h) => h.rel).join(', ')}`
        : 'not installed — Cursor only, and the edit check reports an overwrite either way',
    );
    if (!checks.length) {
      advice.push(`\`node scripts/init.mjs ${target} --write\` installs the edit check.`);
    }
  }
  for (const h of broken) {
    row(MISSING, 'hook target', `${h.rel} names something that is not there — ${h.target}`);
    advice.push(`\`node scripts/init.mjs ${target} --write\` repairs the hook in ${h.rel}.`);
  }

  // The allow rules name this plugin by full path, so a plugin update leaves
  // them naming a build that is gone and the prompts come back. Nothing else
  // notices: a rule that matches nothing grants nothing, and grants nothing
  // quietly.
  const missingRules = missingAllowRules(target);
  row(
    missingRules.length ? NOTE : OK,
    'prompts',
    missingRules.length
      ? 'not pre-approved here, so a catalog lookup asks permission every time it runs'
      : `Pushpin's ${ALLOWED_SCRIPTS.length} project scripts run without asking — ${SETTINGS_REL}`,
  );
  if (missingRules.length) {
    advice.push(
      `\`node scripts/init.mjs ${target} --write\` pre-approves Pushpin's project scripts, so a catalog lookup stops asking.`,
    );
  }

  // The preview, asked of the port rather than of the config. What is recorded
  // says where to look; only the answer on the port says whether looking there
  // shows this project.
  const pv = readPreview(target);
  if (config.preview === false) {
    row(NOTE, 'preview', 'declined with --no-preview, and respected');
  } else if (!pv) {
    row(NOTE, 'preview', 'not recorded, so nothing keeps the prototype server up');
    advice.push(
      `\`node scripts/init.mjs ${target} --write --force\` records the preview, which is what restarts the prototype server after it stops.`,
    );
  } else if (!pv.port) {
    row(NOTE, 'preview', `served by \`${pv.command}\` on a port Pushpin cannot guess, so it says nothing about it`);
  } else if (!pv.autostart) {
    // Their dev server does not answer our identity route, so anything
    // listening at all is the good answer here.
    const state = (await probe(pv.port)).state;
    row(
      state === 'dead' ? NOTE : OK,
      'preview',
      state === 'dead'
        ? `\`${pv.command}\` is not running on port ${pv.port}. Pushpin does not start it`
        : `\`${pv.command}\` is answering on ${previewUrl(pv.port)}`,
    );
  } else {
    const state = await probe(pv.port);
    const expected = resolve(target, pv.root);
    if (state.state === 'ours' && servesRoot(state.root, expected)) {
      row(OK, 'preview', `serving at ${previewUrl(pv.port)}`);
    } else if (state.state === 'dead') {
      row(NOTE, 'preview', `not running — the next edit starts it at ${previewUrl(pv.port)}`);
    } else {
      row(
        MISSING,
        'preview',
        state.state === 'ours'
          ? `port ${pv.port} is serving ${state.root}, not this project`
          : `port ${pv.port} is held by something that is not the Pushpin preview`,
      );
      advice.push(
        `\`node scripts/init.mjs ${target} --write --force --preview-port <n>\` moves the preview to a free port. Nothing holding the current one is killed.`,
      );
    }
  }

  const agents = join(target, 'AGENTS.md');
  const hasNote = existsSync(agents) && readFileSync(agents, 'utf8').includes('## Design system');
  row(hasNote ? OK : MISSING, 'AGENTS.md', hasNote ? 'carries the Design system section' : 'has no Design system section');

  // Impeccable. Reported as its own thing, and honestly: the per-edit detector
  // not being installed is the expected outcome of a user-global install, not a
  // fault, and calling it one sends people looking for a bug.
  //
  // A note rather than a fault for the same reason. Setup does not run the
  // interview, so its absence is a project that has not asked for one — and
  // marking it missing would leave every prototype folder reporting itself
  // unfinished, and exiting non-zero, over a file Pushpin must not write.
  row(
    productMd ? OK : NOTE,
    'PRODUCT.md',
    productMd
      ? 'present'
      : impeccable.installed
        ? 'absent — `/impeccable init` writes it, and Pushpin must not'
        : 'absent, and impeccable is not installed',
  );
  if (!productMd && impeccable.installed) {
    advice.push('`/impeccable init` writes PRODUCT.md. Pushpin does not write product truth.');
  }

  if (!impeccable.installed) {
    row(NOTE, 'impeccable', 'not installed — the generated files are still correct, and are read when it is');
  } else if (impeccable.providerLocal) {
    row(NOTE, 'impeccable', `provider folder at ${impeccable.providerLocal}, so \`/impeccable hooks on\` can install its per-edit detector`);
  } else {
    row(
      NOTE,
      'impeccable',
      'installed globally, so its per-edit detector cannot install here — Pushpin\'s own check covers token drift',
    );
  }

  const unique = [...new Set(advice)];
  return {
    mode: 'verify',
    target,
    rows,
    advice: unique,
    ready: rows.every((r) => r.mark !== MISSING),
    // Nothing left that would make the project stronger. Kept apart from
    // `ready` so the closing line cannot promise protection a project set up
    // before the hashes existed does not actually have.
    complete: rows.every((r) => r.mark !== MISSING) && unique.length === 0,
  };
}

/**
 * What is not true yet, and what to do about it.
 *
 * A row that passed is not news. Eleven of them in front of someone who asked
 * whether anything is broken is how the one line that matters gets lost, and
 * the three closing summaries were a paragraph spent on the same question.
 *
 * The distinction those summaries protected — set up and working, but not
 * protected — is real, and it survives in the advice: a hash that was never
 * recorded and a generated file that is an older build both leave a project
 * working and both have a remedy, so both print their remedy and nothing else.
 */
function printVerify(v) {
  if (!ALL) {
    for (const r of v.rows) {
      if (r.mark === MISSING) console.log(`  ${r.name}: ${r.detail}`);
    }
    for (const a of v.advice) console.log(`  ${a}`);
    if (v.complete) console.log('  This project is set up, and there is nothing left to fix.');
    return;
  }

  console.log(`Target: ${v.target}\n`);
  const markPad = Math.max(...v.rows.map((r) => r.mark.length));
  const namePad = Math.max(...v.rows.map((r) => r.name.length));
  for (const r of v.rows) {
    console.log(`  ${r.mark.padEnd(markPad)}  ${r.name.padEnd(namePad)}  ${r.detail}`);
  }
  if (v.advice.length) {
    console.log('');
    for (const a of v.advice) console.log(`  ${a}`);
  }
  console.log(
    v.complete
      ? '\nThis project is set up. Pushpin governs its tokens, components, and words, an edit check reports what drifts from them as you work, and the generated files are protected.'
      : v.ready
        ? '\nThis project is set up and working. Nothing is broken; the lines above are what would make it stronger.'
        : '\nThis project is not finished — the lines marked missing above say what is left.',
  );
}

// -------------------------------------------------------------------- backup

/**
 * Copies aside everything `--force` would replace, inside `.pushpin/` where the
 * rest of our machinery already lives, so the way back is discoverable without
 * knowing to look in a temp directory.
 */
function backup() {
  const existing = existingArtifacts();
  if (!existing.length) return { mode: 'backup', wrote: [], dir: null };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rel = join('.pushpin', 'backups', stamp);

  const wrote = [];
  for (const artifact of existing) {
    const dest = join(target, rel, artifact);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(target, artifact), dest);
    wrote.push(artifact);
  }
  return { mode: 'backup', wrote, dir: rel };
}

function printBackup(b) {
  if (!b.wrote.length) {
    console.log('Nothing to back up — none of the files init would replace are there yet.');
    return;
  }
  console.log(`Backed up ${b.wrote.length} file(s) to ${b.dir}:`);
  for (const w of b.wrote) console.log(`  ${w}`);
}

// -------------------------------------------------------------------- dispatch

let result;
if (BACKUP) {
  result = backup();
  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else printBackup(result);
} else if (READY) {
  result = ready();
  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else printReady(result);
  // Exit 0 whatever it found, for the reason freshness.mjs's --session does:
  // this runs at the front of a setup nobody asked to have interrupted, and a
  // readiness report that reads as a failed command is the noise it removes.
} else if (VERIFY) {
  result = await verify();
  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else printVerify(result);
  process.exit(result.ready ? 0 : 1);
} else {
  result = assess();
  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else printAssess(result);
}

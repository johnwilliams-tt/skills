#!/usr/bin/env node
/**
 * The two halves of `/pushpin setup` that a script can do: reading the project
 * before anything is written, and checking what is actually true afterwards.
 *
 * `init.mjs` remains the only thing that writes Pushpin's artifacts. This reads.
 * The middle of setup — the questions, and the handoff to impeccable for
 * PRODUCT.md — is a conversation, and lives in reference/setup.md.
 *
 * Why it exists at all: `init` prints good advice, and advice is where the
 * onboarding was failing. It told people to run two more commands and could not
 * tell whether they had, so a project could sit half-configured with every
 * individual check reporting health. `--assess` decides which questions are
 * genuinely open so none are asked twice, and `--verify` reports the end state
 * rather than restating the instructions.
 *
 * Usage:
 *   node scripts/setup.mjs <project-dir>            # same as --assess
 *   node scripts/setup.mjs <project-dir> --assess   # what is here, and what to ask
 *   node scripts/setup.mjs <project-dir> --verify   # what is true now
 *   node scripts/setup.mjs <project-dir> --backup   # copy aside what --force would replace
 *   node scripts/setup.mjs <project-dir> --json     # machine-readable, either mode
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';
import { GENERATED, generatedState } from './lib/generated.mjs';
import { inspectHooks } from './lib/hooks.mjs';
import { ALLOWED_SCRIPTS, missingAllowRules, SETTINGS_REL } from './lib/permissions.mjs';
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
const target = resolve(argv.find((a) => !a.startsWith('--')) ?? '.');

const VERIFY = flag('--verify');
const BACKUP = flag('--backup');
const JSON_OUT = flag('--json');

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

/**
 * Where impeccable is installed, and — separately — whether this project holds
 * one of the provider folders its own hook installer looks for.
 *
 * The two are not the same question, and conflating them is what makes the
 * setup advice wrong. `hook-admin.mjs` skips every manifest target unless a
 * folder like `.cursor/skills/impeccable` exists *in the project*, so with the
 * usual user-global install `/impeccable hooks on` finds nothing to do and
 * installs nothing. Saying "impeccable is installed" while its per-edit hook
 * cannot be is how someone ends up hunting a gap that is working as designed.
 */
function findImpeccable() {
  const providerRels = [
    join('.cursor', 'skills', 'impeccable'),
    join('.claude', 'skills', 'impeccable'),
    join('.agents', 'skills', 'impeccable'),
    join('.github', 'skills', 'impeccable'),
  ];
  const local = providerRels.filter((rel) => existsSync(join(target, rel)));
  const home = providerRels.map((rel) => join(homedir(), rel)).filter((p) => existsSync(p));

  return {
    installed: Boolean(local.length || home.length),
    // A project-local copy is the only kind its hook installer can act on.
    providerLocal: local.length ? local[0] : null,
    path: local.length ? join(target, local[0]) : (home[0] ?? null),
  };
}

const impeccable = findImpeccable();
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

  if (git(['rev-parse', '--git-dir']) === null) {
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

function assess() {
  const existing = existingArtifacts();
  const git = gitSafety(existing);
  const pin = inspectPin(target, { manifest: MANIFEST, pluginVersion: PLUGIN.version });

  // Only questions the project has not already answered. A question with one
  // real answer is not a question, and asking it is how a short setup starts
  // feeling like a form.
  const ask = [];
  ask.push({
    id: 'scope',
    why: 'decides whether this gets the team-sharing entry and a PRODUCT.md interview',
  });
  if (existing.length) {
    ask.push({
      id: 'overwrite',
      why: `${existing.length} Pushpin file${existing.length === 1 ? '' : 's'} already ${existing.length === 1 ? 'exists' : 'exist'} — ${git.note}`,
    });
  }
  if (env.stylesDirGuessed && !config?.css) {
    ask.push({ id: 'stylesheet', why: 'no known styles directory, so the destination is a guess' });
  }

  return {
    mode: 'assess',
    target,
    stack: describeStack(env),
    thumbprint: env.thumbprint,
    state: config ? 'initialized' : 'fresh',
    pin: pin ? { status: pin.status, details: pin.details } : null,
    css: { rel: config?.css?.replace(/^\.\//, '') ?? cssRel, guessed: env.stylesDirGuessed },
    existing,
    git,
    impeccable: { ...impeccable, productMd },
    ask,
  };
}

function printAssess(a) {
  console.log(`Target: ${a.target}`);
  console.log(`Detected: ${a.stack}`);
  console.log(
    `State: ${a.state === 'fresh' ? 'no pushpin.config.json — this project has never been set up' : `already set up${a.pin?.status === 'stale' ? ', and behind' : ''}`}`,
  );
  if (a.pin?.details?.length) for (const d of a.pin.details) console.log(`  ${d}`);

  console.log(`\nStylesheet: ${a.css.rel}${a.css.guessed ? ' (guessed — no known styles directory)' : ''}`);

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
  for (const q of a.ask) console.log(`  ${q.id.padEnd(11)} ${q.why}`);
}

// -------------------------------------------------------------------- verify

const OK = 'ok';
const MISSING = 'missing';
const NOTE = '--';

function verify() {
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
    const recorded = g.kind === 'design' ? config.designHash : config.sidecarHash;
    const state = generatedState(target, g.rel, recorded, hashAsset);
    const detail = {
      absent: `${g.label} is not there`,
      unrecorded: `${g.label} — present, but no hash was recorded, so an overwrite would not be noticed`,
      current: `${g.label}, generated and unmodified`,
      edited: `${g.label} has changed since it was written`,
      replaced: `${g.label} no longer carries Pushpin — it has been replaced`,
    }[state];
    row(state === 'current' ? OK : state === 'unrecorded' ? NOTE : MISSING, `${g.kind}`, detail);
    if (state === 'replaced' || state === 'edited' || state === 'absent') {
      advice.push(`\`node scripts/init.mjs ${target} --write --force\` restores ${g.label}. Never \`/impeccable document\`.`);
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
      : `Pushpin's ${ALLOWED_SCRIPTS.length} read-only scripts run without asking — ${SETTINGS_REL}`,
  );
  if (missingRules.length) {
    advice.push(
      `\`node scripts/init.mjs ${target} --write\` pre-approves Pushpin's read-only scripts, so a catalog lookup stops asking.`,
    );
  }

  const agents = join(target, 'AGENTS.md');
  const hasNote = existsSync(agents) && readFileSync(agents, 'utf8').includes('## Design system');
  row(hasNote ? OK : MISSING, 'AGENTS.md', hasNote ? 'carries the Design system section' : 'has no Design system section');

  // Impeccable. Reported as its own thing, and honestly: the per-edit detector
  // not being installed is the expected outcome of a user-global install, not a
  // fault, and calling it one sends people looking for a bug.
  row(
    productMd ? OK : MISSING,
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

function printVerify(v) {
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
      ? '\nThis project is set up. Pushpin governs its tokens, an edit check reports off-system values as you work, and the generated files are protected.'
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
} else if (VERIFY) {
  result = verify();
  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else printVerify(result);
  process.exit(result.ready ? 0 : 1);
} else {
  result = assess();
  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else printAssess(result);
}

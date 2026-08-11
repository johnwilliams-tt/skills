#!/usr/bin/env node
/**
 * Sets a project up to use Pushpin.
 *
 * Installs the token stylesheet, records the Figma keys so the bridge works
 * without re-deriving them, leaves a note for agents working in the repo
 * later, and offers the plugin to anyone else who opens the repo. Prints a
 * plan and changes nothing unless --write is passed.
 *
 * Usage:
 *   node scripts/init.mjs <project-dir> [--write] [--force] [--css-path <p>]
 *                                       [--no-share]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';
import { renderDesignJson, renderDesignMd } from './impeccable-bridge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const target = resolve(argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--css-path') ?? '.');

const WRITE = flag('--write');
const FORCE = flag('--force');
const SHARE = !flag('--no-share');

if (!existsSync(target)) {
  console.error(`No such directory: ${target}`);
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
const REPO = PLUGIN.repository.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
const PLUGIN_REF = `${PLUGIN.name}@${MARKETPLACE}`;

const marketplacePath = join(here, '..', '..', '..', '.claude-plugin', 'marketplace.json');
if (existsSync(marketplacePath)) {
  const { name } = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  if (name !== MARKETPLACE) {
    console.error(
      `Marketplace is named "${name}" but init.mjs writes "${MARKETPLACE}".\n` +
        'Update MARKETPLACE in scripts/init.mjs, or projects will be pointed at a name that does not resolve.',
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

/** Guess where stylesheets live, so the CSS lands somewhere idiomatic. */
function detect() {
  const pkgPath = join(target, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null;
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const has = (n) => Object.keys(deps).some((d) => d === n || d.startsWith(n + '/'));

  const dirs = ['src/styles', 'app/styles', 'styles', 'src/app', 'app', 'src', 'assets'];
  const stylesDir = dirs.find((d) => existsSync(join(target, d))) ?? 'styles';

  return {
    name: pkg?.name ?? null,
    react: has('react'),
    next: has('next'),
    tailwind: has('tailwindcss'),
    thumbprint: Object.keys(deps).some((d) => d.includes('thumbprint')),
    stylesDir,
  };
}

const env = detect();
const cssPath = opt('--css-path', join(env.stylesDir, 'pushpin.css'));

const plan = [];
const skipped = [];
const stale = [];

// If the project was set up before, say whether it is behind rather than just
// declining to overwrite. A silently outdated stylesheet is the failure this
// whole plugin exists to prevent.
const existingConfigPath = join(target, 'pushpin.config.json');
if (existsSync(existingConfigPath)) {
  try {
    const prev = JSON.parse(readFileSync(existingConfigPath, 'utf8'));
    if (prev.capturedAt && prev.capturedAt !== MANIFEST.capturedAt) {
      stale.push(
        `capture: project pinned to ${prev.capturedAt}, plugin now carries ${MANIFEST.capturedAt}`,
      );
    }
    if (prev.pluginVersion && prev.pluginVersion !== PLUGIN.version) {
      stale.push(`plugin: project written by ${prev.pluginVersion}, now ${PLUGIN.version}`);
    }
    const prevCss = prev.css && join(target, prev.css);
    if (prev.cssHash && prevCss && existsSync(prevCss)) {
      const actual = hashAsset(prevCss);
      if (actual !== prev.cssHash) {
        stale.push(`${prev.css}: has been edited since install (hash no longer matches)`);
      } else if (prev.cssHash !== MANIFEST.hashes['pushpin.css']) {
        stale.push(`${prev.css}: is an older build of the tokens`);
      }
    }
  } catch {
    stale.push('pushpin.config.json could not be parsed');
  }
}

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

planFile('pushpin.config.json', 'Figma keys and the capture this project is pinned to', (abs) => {
  writeFileSync(
    abs,
    JSON.stringify(
      {
        $comment:
          'Written by the pushpin skill. Lets the Figma bridge work without re-deriving keys. ' +
          '`capturedAt` and `pluginVersion` record which snapshot of the kit this stylesheet ' +
          'came from — compare them against the plugin to find out if it is behind.',
        designSystem: 'pushpin',
        pluginVersion: PLUGIN.version,
        capturedAt: MANIFEST.capturedAt,
        css: './' + cssPath.split('\\').join('/'),
        cssHash: MANIFEST.hashes['pushpin.css'],
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

// Design-system drift is now usually introduced in the browser and pushed to
// Figma afterwards, which means the Figma audit catches it a step too late.
// These two files project Pushpin's tokens into the format `impeccable`'s
// detector reads, turning its design-system-* rules into live Pushpin checks
// with no change to impeccable itself. See impeccable-bridge.mjs.
//
// Written in this order deliberately: the detector compares mtimes and warns
// when the markdown is newer than the sidecar, so the sidecar goes last.
const bridgeMeta = { pluginVersion: PLUGIN.version, capturedAt: MANIFEST.capturedAt };

planFile('DESIGN.md', "Pushpin's tokens as design-system checks for the browser phase", (abs) =>
  writeFileSync(abs, renderDesignMd(TOKENS, bridgeMeta)),
);

planFile(join('.impeccable', 'design.json'), 'the complete token ramps behind those checks', (abs) => {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(renderDesignJson(TOKENS, bridgeMeta), null, 2) + '\n');
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
  const source = { source: 'github', repo: REPO };

  const pointsHere = JSON.stringify(marketplaces[MARKETPLACE]?.source) === JSON.stringify(source);
  if (pointsHere && enabled[PLUGIN_REF] === true && !FORCE) {
    skipped.push(`${rel} — already offers Pushpin to anyone who opens this repo`);
    return;
  }

  const next = {
    ...base,
    extraKnownMarketplaces: { ...marketplaces, [MARKETPLACE]: { source } },
    enabledPlugins: { ...enabled, [PLUGIN_REF]: true },
  };

  plan.push({
    rel,
    describe: existing
      ? `add ${PLUGIN_REF} to the plugins this repo offers`
      : `offer ${PLUGIN_REF} to anyone who opens this repo, no CLI needed`,
    abs,
    writeFn: (a) => {
      mkdirSync(dirname(a), { recursive: true });
      writeFileSync(a, JSON.stringify(next, null, 2) + '\n');
    },
  });
}

if (SHARE) planSettings();

// A short, durable note so an agent opening this repo later knows the system is
// in use and where the authority lives — the original point of packaging this.
//
// The precedence line belongs here rather than only in SKILL.md because the
// skills it constrains — impeccable, frontend-design, ui-ux-pro-max — can be
// loaded into a session this skill never enters. AGENTS.md is read either way.
const NOTE = `## Design system

This project uses **Pushpin**, Thumbtack's design system.

- Pushpin is this project's tokens, components, and icon set, so it outranks
  any other design skill's craft floor, ambition, or category defaults. Those
  skills choose among Pushpin-legal options, never around them.
- Tokens: \`${cssPath}\` — use \`--pp-*\` custom properties, never raw hex or px.
- Prefer semantic tokens (\`--pp-background-brand-strong\`) over base ramps
  (\`--pp-color-blue-950\`). Reaching for a base ramp means no semantic token fit,
  which is worth questioning.
- Buttons, inputs, and chips are pill-shaped: \`--pp-radius-sides\`.
- \`DESIGN.md\` and \`.impeccable/design.json\` are generated from those tokens, so
  a hardcoded color, font, radius, or font size is flagged as drift while you
  work. Both are machine-written — fix the code, not the check.
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
console.log(
  `Detected: ${[
    env.name && `package "${env.name}"`,
    env.next && 'Next.js',
    !env.next && env.react && 'React',
    env.tailwind && 'Tailwind',
    env.thumbprint && 'Thumbprint',
  ]
    .filter(Boolean)
    .join(', ') || 'no package.json'}\n`,
);

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
  console.log('\n  Re-run with --write --force to bring it up to date.');
}

if (WRITE && plan.length) {
  for (const p of plan) p.writeFn(p.abs);
  console.log(`\nDone — ${plan.length} file(s) written.`);

  console.log('\nNext:');
  console.log(`  1. Import the stylesheet once at your app root:`);
  console.log(`       import '${'./' + relative(target, join(target, cssPath)).split('\\').join('/')}';`);
  if (env.thumbprint) {
    console.log(`  2. Thumbprint detected — load its v2 token stylesheet, not v1.`);
    console.log(`     Pushpin IS Thumbprint v2's semantic layer; --tp-* and --pp-* name the`);
    console.log(`     same tokens. Do not add per-component CSS overrides to force the look.`);
  } else {
    console.log(`  2. Build with the custom properties; see the skill's reference/tokens.md.`);
  }
  console.log(`  3. Thumbtack Rise is not bundled here — install it or set --pp-font-family.`);

  if (plan.some((p) => p.rel === 'DESIGN.md')) {
    console.log(`\nDESIGN.md and .impeccable/design.json turn the tokens into live checks:`);
    console.log(`  a raw hex, font, radius, or font size that is not Pushpin is reported as`);
    console.log(`  drift while you work, rather than at the Figma push. Both are generated —`);
    console.log(`  re-run init after updating the plugin, and never hand-edit them.`);
  }

  if (plan.some((p) => p.rel.endsWith('settings.json'))) {
    console.log(`\nCommit .claude/settings.json to share Pushpin with the team.`);
    console.log(`  Anyone who opens this repo is prompted to install it when they trust the`);
    console.log(`  folder — no terminal needed. The plugin stays unloaded until they accept,`);
    console.log(`  so tell them to say yes.`);
  }
} else if (!WRITE && plan.length) {
  console.log('\nRe-run with --write to apply.');
}

#!/usr/bin/env node
/**
 * Sets a project up to use Pushpin.
 *
 * Installs the token stylesheet, records the Figma keys so the bridge works
 * without re-deriving them, and leaves a note for agents working in the repo
 * later. Prints a plan and changes nothing unless --write is passed.
 *
 * Usage:
 *   node scripts/init.mjs <project-dir> [--write] [--force] [--css-path <p>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const target = resolve(argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--css-path') ?? '.');

const WRITE = flag('--write');
const FORCE = flag('--force');

if (!existsSync(target)) {
  console.error(`No such directory: ${target}`);
  process.exit(1);
}

const SOURCE = JSON.parse(readFileSync(join(ASSETS, 'tokens.figma.json'), 'utf8')).source;
const KEYS = JSON.parse(readFileSync(join(ASSETS, 'variable-keys.figma.json'), 'utf8'));
const MANIFEST = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));
const PLUGIN = JSON.parse(
  readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'),
);

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

planFile(cssPath, '300 Pushpin design tokens', (abs) => {
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

// A short, durable note so an agent opening this repo later knows the system is
// in use and where the authority lives — the original point of packaging this.
const NOTE = `## Design system

This project uses **Pushpin**, Thumbtack's design system.

- Tokens: \`${cssPath}\` — use \`--pp-*\` custom properties, never raw hex or px.
- Prefer semantic tokens (\`--pp-background-brand-strong\`) over base ramps
  (\`--pp-color-blue-950\`). Reaching for a base ramp means no semantic token fit,
  which is worth questioning.
- Buttons, inputs, and chips are pill-shaped: \`--pp-radius-sides\`.
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
} else if (!WRITE && plan.length) {
  console.log('\nRe-run with --write to apply.');
}

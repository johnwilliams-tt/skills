#!/usr/bin/env node
/**
 * Generates assets/DESIGN.md and assets/design.json — Pushpin's tokens in the
 * format impeccable's detector reads. See impeccable-bridge.mjs for what the two
 * files are and why the shape of each is load-bearing.
 *
 * The same contract build-css.mjs holds for the stylesheet. Nothing in either
 * file is project-specific, so they are assets rather than per-project renders:
 * `init` copies them the way it copies the stylesheet, and building them here is
 * what puts them under the manifest hashes and `--check`. Rendered at init time
 * instead, they could disagree with the tokens they claim to project and nothing
 * in the repo would notice.
 *
 * Usage: node scripts/build-design.mjs [--check]
 *   --check  exit non-zero if either committed file differs from a fresh build
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDesignJson, renderDesignMd } from './impeccable-bridge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');

const json = (f) => JSON.parse(readFileSync(join(ASSETS, f), 'utf8'));

const tokens = json('tokens.figma.json');
const manifest = json('manifest.json');
const components = json('components.figma.json');
const specs = json('component-specs.figma.json');
const plugin = JSON.parse(
  readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'),
);

// The render inputs from the places init.mjs read them, so a built asset cannot
// say something init would not have said.
const meta = {
  pluginVersion: plugin.version,
  capturedAt: manifest.capturedAt,
  components: components.components,
  specs: specs.components,
};

const design = renderDesignMd(tokens, meta);

// The capture date stands in for a build clock. `generatedAt` has to be
// something this build can read twice and get the same answer from, or `--check`
// fails on the timestamp alone and proves nothing; the capture is the only date
// these files are a projection of, and no consumer reads the field.
const sidecar = renderDesignJson(tokens, { ...meta, generatedAt: manifest.capturedAt });
const sidecarBody = JSON.stringify(sidecar, null, 2) + '\n';

const OUTPUTS = [
  {
    name: 'DESIGN.md',
    path: join(ASSETS, 'DESIGN.md'),
    body: design,
    summary: `${design.split('\n').length - 1} lines`,
  },
  {
    name: 'design.json',
    path: join(ASSETS, 'design.json'),
    body: sidecarBody,
    summary: `${Object.keys(sidecar.extensions.colorMeta).length} colour ramps`,
  },
];

const committed = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

if (process.argv.includes('--check')) {
  const stale = OUTPUTS.filter((o) => committed(o.path) !== o.body);
  if (stale.length) {
    console.error(
      `${stale.map((o) => o.name).join(' and ')} ${stale.length > 1 ? 'are' : 'is'} stale — ` +
        'run: node scripts/build-design.mjs',
    );
    process.exit(1);
  }
  console.log('DESIGN.md and design.json are up to date.');
} else {
  for (const o of OUTPUTS) {
    writeFileSync(o.path, o.body);
    console.log(`Wrote ${o.path} (${o.summary})`);
  }
}

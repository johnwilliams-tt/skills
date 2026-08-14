/**
 * Whether a project's Pushpin pin still matches the plugin that wrote it.
 *
 * `init.mjs` records `pluginVersion`, `capturedAt`, and `cssHash` in
 * `pushpin.config.json` so a later session can tell the project is behind
 * without re-running init. This is that comparison, in one place, so the
 * session-start check and init's own "this project is behind" list cannot
 * disagree.
 *
 * Returns null when there is nothing to check: no config, or `dir` is inside
 * the plugin's own tree (the plugin is not a consumer of itself).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(here, '..', '..');
const within = (root, p) => p === root || p.startsWith(root + sep);

/**
 * @param {string} dir
 * @param {{ manifest: { capturedAt: string, hashes: Record<string, string> }, pluginVersion: string }} opts
 * @returns {null | {
 *   status: 'ok' | 'stale' | 'unreadable',
 *   details: string[],
 *   brief: string | null,
 *   pluginVersion?: string,
 *   capturedAt?: string,
 * }}
 */
export function inspectPin(dir, { manifest, pluginVersion }) {
  const target = resolve(dir);
  if (within(PLUGIN_ROOT, target)) return null;

  const configPath = join(target, 'pushpin.config.json');
  if (!existsSync(configPath)) return null;

  try {
    const prev = JSON.parse(readFileSync(configPath, 'utf8'));
    const details = [];
    const reasons = [];

    if (prev.capturedAt && prev.capturedAt !== manifest.capturedAt) {
      details.push(
        `capture: project pinned to ${prev.capturedAt}, plugin now carries ${manifest.capturedAt}`,
      );
      reasons.push('capture');
    }
    if (prev.pluginVersion && prev.pluginVersion !== pluginVersion) {
      details.push(`plugin: project written by ${prev.pluginVersion}, now ${pluginVersion}`);
      reasons.push('plugin');
    }
    const prevCss = prev.css && join(target, prev.css);
    if (prev.cssHash && prevCss && existsSync(prevCss)) {
      const actual = hashAsset(prevCss);
      if (actual !== prev.cssHash) {
        details.push(`${prev.css}: has been edited since install (hash no longer matches)`);
        reasons.push('edited');
      } else if (prev.cssHash !== manifest.hashes['pushpin.css']) {
        details.push(`${prev.css}: is an older build of the tokens`);
        reasons.push('css');
      }
    }

    // A project set up before the edit hook existed has no `checkHook` key at
    // all, which is a different thing from one that declined it with
    // `--no-hook`. Only the first is worth mentioning, and only once: the
    // re-run that installs it also writes the key.
    if (prev.checkHook === undefined) {
      details.push('check hook: not installed — this project predates it');
      reasons.push('hook');
    }

    if (details.length === 0) {
      return {
        status: 'ok',
        details,
        brief: null,
        pluginVersion: prev.pluginVersion,
        capturedAt: prev.capturedAt,
      };
    }

    const brief = reasons.includes('plugin')
      ? `This project's Pushpin files were written by ${prev.pluginVersion} and the plugin is now ${pluginVersion} — re-running init with --write --force is the first thing I'd do.`
      : reasons.includes('edited')
        ? `This project's stylesheet has been edited since it was installed — re-running init with --write --force is the first thing I'd do.`
        : reasons.length === 1 && reasons[0] === 'hook'
          ? `This project was set up before Pushpin's edit check existed — running init with --write adds it, and off-system values get reported as you work.`
          : `This project's Pushpin files were pinned to an older kit than the plugin now carries — re-running init with --write --force is the first thing I'd do.`;

    return {
      status: 'stale',
      details,
      brief,
      pluginVersion: prev.pluginVersion,
      capturedAt: prev.capturedAt,
    };
  } catch {
    return {
      status: 'unreadable',
      details: ['pushpin.config.json could not be parsed'],
      brief: `This project's pushpin.config.json could not be parsed — re-running init with --write --force is the first thing I'd do.`,
    };
  }
}

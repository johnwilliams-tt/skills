/**
 * Whether a project's Pushpin pin still matches the plugin that wrote it.
 *
 * `init.mjs` records `pluginVersion`, `capturedAt`, and `cssHash` in
 * `pushpin.config.json` so a later session can tell the project is behind
 * without re-running init. This is that comparison, in one place, so the
 * session-start check and init's own "this project is behind" list cannot
 * disagree.
 *
 * The edit hook is checked against the manifests themselves rather than against
 * anything recorded, because the command they carry names a path that can stop
 * resolving without either file changing.
 *
 * Returns null when there is nothing to check: no config, or `dir` is inside
 * the plugin's own tree (the plugin is not a consumer of itself).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';
import { GENERATED, generatedState } from './lib/generated.mjs';
import { inspectHooks } from './lib/hooks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(here, '..', '..');
const within = (root, p) => p === root || p.startsWith(root + sep);

/**
 * The findings a plain `init --write` settles on its own, which is the line the
 * session-start check draws between a repair it makes in silence and a sentence
 * it hands over.
 *
 * All four are the hook: a shim and two manifests, written and repaired without
 * `--force`, carrying nothing anyone authored and nothing recorded anywhere
 * else. Every other reason ends in replacing a file that is already there,
 * which is the user's call.
 *
 * A missing generated file is deliberately not here, though `--write` would
 * write it. `pushpin.config.json` records what those files hash to and is
 * itself only rewritten under `--force`, so restoring one on a plain `--write`
 * leaves the old hash in place — and the sidecar stamps itself with the time it
 * was generated, so the restored file would report as hand-edited from the next
 * session onward. A silent repair that trades one finding for a permanent one
 * is worse than the sentence.
 */
const REPAIRABLE = new Set(['hook', 'hook-missing', 'hook-broken', 'hook-legacy']);

/**
 * @param {string} dir
 * @param {{ manifest: { capturedAt: string, hashes: Record<string, string> }, pluginVersion: string }} opts
 * @returns {null | {
 *   status: 'ok' | 'stale' | 'unreadable',
 *   details: string[],
 *   brief: string | null,
 *   repairable: boolean,
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

    // The two generated files. Both are read as the design system, and
    // `/impeccable document` replaces them with an invented one — so an
    // overwrite has to be noticed, and this is the check that notices it on any
    // harness rather than only where a hook happens to be installed. A missing
    // recorded hash means the project predates them, which is silence.
    for (const g of GENERATED) {
      const recorded = g.kind === 'design' ? prev.designHash : prev.sidecarHash;
      const state = generatedState(target, g.rel, recorded, hashAsset);
      if (state === 'absent') {
        details.push(`${g.label}: is gone — the design system it carries is not being read`);
        reasons.push('generated-absent');
      } else if (state === 'replaced') {
        details.push(`${g.label}: no longer carries Pushpin — it has been replaced`);
        reasons.push('generated-replaced');
      } else if (state === 'edited') {
        details.push(`${g.label}: has been edited since it was written (hash no longer matches)`);
        reasons.push('generated-edited');
      }
    }

    // Whether the hook is installed is answered by the manifests, not by
    // `checkHook`: the key records what was wanted, and a recorded claim about
    // files that another tool also edits can go stale. `checkHook === false` is
    // the one thing the manifests cannot express — a deliberate `--no-hook` — and
    // it is respected in silence.
    if (prev.checkHook !== false) {
      const hooks = inspectHooks(target);
      const broken = hooks.filter((h) => !h.exists);
      const legacy = hooks.filter((h) => h.exists && h.kind === 'plugin');

      if (!hooks.length) {
        // No key at all means the project predates the hook, which is a
        // different thing from having lost one that was installed.
        if (prev.checkHook === undefined) {
          details.push('check hook: not installed — this project predates it');
          reasons.push('hook');
        } else {
          details.push('check hook: recorded as installed, but neither manifest runs it');
          reasons.push('hook-missing');
        }
      } else if (broken.length) {
        for (const h of broken) {
          details.push(`${h.rel}: runs a check that is no longer there — ${h.target}`);
        }
        reasons.push('hook-broken');
      } else if (legacy.length) {
        for (const h of legacy) {
          details.push(`${h.rel}: names a plugin version directly, so the next update will break it`);
        }
        reasons.push('hook-legacy');
      }
    }

    if (details.length === 0) {
      return {
        status: 'ok',
        details,
        brief: null,
        repairable: false,
        pluginVersion: prev.pluginVersion,
        capturedAt: prev.capturedAt,
      };
    }

    // Ordered by how wrong the project currently is, not by how the findings were
    // gathered. A hook pointing at a deleted directory is failing silently right
    // now, which outranks a stylesheet that is merely a version behind.
    const REMEDY = "re-running init with --write --force is the first thing I'd do";
    const briefs = [
      // A design brief that is no longer Pushpin outranks every other finding:
      // the rest describe checks that have stopped working, while this one is
      // actively handing a different design system to everything that reads it.
      [
        'generated-replaced',
        `This project's generated Pushpin design files have been replaced with a different design system, so anything reading them is building against the wrong one — ${REMEDY}, and never /impeccable document.`,
      ],
      [
        'generated-absent',
        `This project's generated Pushpin design files are gone, so tools that read them will invent a design system in their place — ${REMEDY}.`,
      ],
      [
        'hook-broken',
        `This project's Pushpin edit check points at a plugin version that no longer exists, so nothing has been checking your edits — ${REMEDY}.`,
      ],
      [
        'hook-legacy',
        `This project's Pushpin edit check names a plugin version directly, so it will stop working the next time the plugin updates — ${REMEDY}.`,
      ],
      [
        'hook-missing',
        `This project's Pushpin edit check is recorded as installed but no longer runs — ${REMEDY}.`,
      ],
      [
        'plugin',
        `This project's Pushpin files were written by ${prev.pluginVersion} and the plugin is now ${pluginVersion} — ${REMEDY}.`,
      ],
      [
        'generated-edited',
        `This project's generated Pushpin design files have been hand-edited, which only makes the design-system checks disagree with the design system — ${REMEDY}.`,
      ],
      [
        'edited',
        `This project's stylesheet has been edited since it was installed — ${REMEDY}.`,
      ],
    ];

    const matched = briefs.find(([r]) => reasons.includes(r));
    const brief = matched
      ? matched[1]
      : reasons.length === 1 && reasons[0] === 'hook'
        ? `This project was set up before Pushpin's edit check existed — running init with --write adds it, and your edits get held against the tokens, the component catalog, and the copy rules as you work.`
        : `This project's Pushpin files were pinned to an older kit than the plugin now carries — ${REMEDY}.`;

    return {
      status: 'stale',
      details,
      brief,
      repairable: reasons.every((r) => REPAIRABLE.has(r)),
      pluginVersion: prev.pluginVersion,
      capturedAt: prev.capturedAt,
    };
  } catch {
    return {
      status: 'unreadable',
      details: ['pushpin.config.json could not be parsed'],
      brief: `This project's pushpin.config.json could not be parsed — re-running init with --write --force is the first thing I'd do.`,
      repairable: false,
    };
  }
}

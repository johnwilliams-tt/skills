#!/usr/bin/env node
/**
 * Compares a fresh capture of the Pushpin kit against the committed assets and
 * classifies what moved by consequence.
 *
 * The point is not to list differences — it is to separate the ones that break
 * a consumer from the ones that merely restyle it. A token that changed hex
 * needs a CSS rebuild. A token that became hidden from publishing makes
 * importVariableByKeyAsync throw at runtime, and no amount of rebuilding fixes
 * that. Those must not read the same.
 *
 * Captures come from scripts/check.md. Every input is optional, so a quick
 * token-only check is just --kit.
 *
 * Usage:
 *   node scripts/diff.mjs --kit kit.json [--published published.json]
 *                         [--components components-raw.json]
 *                         [--icons icons-raw.json --icons-page icons-page.xml]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { distillComponents } from './build-components.mjs';
import { distillIcons } from './build-icons.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);

const kitPath = opt('--kit');
const publishedPath = opt('--published');
const componentsPath = opt('--components');
const iconsPath = opt('--icons');
const iconsPagePath = opt('--icons-page');

if (!kitPath && !publishedPath && !componentsPath && !iconsPath) {
  console.error(
    'usage: node scripts/diff.mjs --kit kit.json [--published published.json] [--components components-raw.json]\n' +
      '                            [--icons icons-raw.json --icons-page icons-page.xml]\n' +
      '\nCaptures come from scripts/check.md.',
  );
  process.exit(1);
}

// The icon capture needs both halves to distil: the dump carries the keys and
// the page metadata carries the categories, and a category silently becoming
// "uncategorised" would read as a kit change rather than a missing input.
if (iconsPath && !iconsPagePath) {
  console.error('--icons also needs --icons-page. See scripts/check.md.');
  process.exit(1);
}

const tokens = load(join(ASSETS, 'tokens.figma.json'));
const keys = load(join(ASSETS, 'variable-keys.figma.json'));
const styles = load(join(ASSETS, 'styles.figma.json'));
const catalog = load(join(ASSETS, 'components.figma.json'));
const iconCatalog = load(join(ASSETS, 'icons.figma.json'));

const breaking = [];
const changed = [];
const added = [];
const notes = [];

/** Figma collection name to the key it is stored under in tokens.figma.json. */
const COLLECTION = {
  'Tokens / Base Colors': 'baseColors',
  'Tokens / Semantic Colors': 'semanticColors',
  'Tokens / Space': 'space',
  'Tokens / Corner Radius': 'cornerRadius',
  'Tokens / Font Weight': 'fontWeight',
  'Tokens / Font': 'font',
  'Tokens / Line Height': 'lineHeight',
  'Tokens / Letter Spacing': 'letterSpacing',
  'Tokens / Shadow': 'shadow',
  'Tokens / Duration': 'duration',
  'Tokens / Easing': 'easing',
  'Tokens / Breakpoint': 'breakpoint',
  'Tokens / Scrim': 'scrim',
  'Tokens / Wrap': 'wrap',
  'Tokens / Z-Index': 'zIndex',
};

/**
 * Collections whose committed values are hand-converted to CSS syntax during
 * transcription — Figma returns a serialised object, the capture stores
 * `rgba(...)`. Names and keys still compare cleanly; values cannot, so they are
 * reported for manual review rather than silently passed.
 */
const VALUE_OPAQUE = new Set(['shadow', 'easing', 'scrim']);

const real = (o) => Object.keys(o).filter((k) => !k.startsWith('$'));
const short = (c) => c.replace('Tokens / ', '');
const round = (v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v);

/** Figma stores the type ramp flat; the capture regroups it one object per step. */
const FONT_PROP = { size: 'size', lineHeight: 'line-height', weight: 'weight' };
function expandFont(font) {
  const out = new Map();
  for (const step of real(font)) {
    for (const [prop, suffix] of Object.entries(FONT_PROP)) {
      const v = font[step][prop];
      if (v === undefined) continue;
      // The kit ships a typo, `title-8/line-heigh`, absorbed by the regrouping.
      const name =
        step === 'title-8' && prop === 'lineHeight' ? 'title-8/line-heigh' : `${step}/${suffix}`;
      out.set(name, v);
    }
  }
  return out;
}

// ---------------------------------------------------------------- kit capture

if (kitPath) {
  const kit = load(kitPath);

  for (const [figmaName, storedAs] of Object.entries(COLLECTION)) {
    const fresh = kit.collections?.[figmaName];
    const committed = tokens[storedAs];

    if (!fresh) {
      breaking.push(`collection "${figmaName}" is gone from the kit`);
      continue;
    }
    if (!committed) {
      added.push(`collection "${figmaName}" is new`);
      continue;
    }

    const freshNames = Object.keys(fresh.vars);
    const committedMap =
      storedAs === 'font'
        ? expandFont(committed)
        : new Map(real(committed).map((n) => [n, committed[n]]));

    for (const name of freshNames) {
      if (!committedMap.has(name)) added.push(`${storedAs}: new token "${name}"`);
    }
    for (const name of committedMap.keys()) {
      if (!freshNames.includes(name)) {
        breaking.push(
          `${storedAs}: token "${name}" was removed — pushpin.css still emits it and consumers may reference it`,
        );
      }
    }

    if (VALUE_OPAQUE.has(storedAs)) {
      notes.push(
        `${storedAs}: values not compared (stored as CSS syntax, Figma returns raw objects) — review by hand if names changed`,
      );
      continue;
    }

    for (const name of freshNames) {
      if (!committedMap.has(name)) continue;
      const before = committedMap.get(name);
      const after = fresh.vars[name];
      const modes = fresh.modes;

      // Single-mode collections collapse to a bare value in the capture, as
      // does a font weight that is identical across modes. Comparing that one
      // value against every mode also catches the kit gaining a per-mode
      // difference the committed shape has no way to express.
      if (modes.length === 1 || typeof before !== 'object' || before === null) {
        const b = round(before);
        for (const m of modes) {
          if (round(after[m]) !== b) {
            const where = modes.length > 1 ? ` [${m}]` : '';
            changed.push(`${storedAs}/${name}${where}: ${b} -> ${round(after[m])}`);
          }
        }
        continue;
      }

      for (const m of modes) {
        if (!(m in before)) {
          added.push(`${storedAs}/${name}: new mode "${m}"`);
          continue;
        }
        if (round(before[m]) !== round(after[m])) {
          changed.push(`${storedAs}/${name} [${m}]: ${before[m]} -> ${after[m]}`);
        }
      }
    }
  }

  // Publish visibility and keys. This is where the silent breakage lives.
  for (const figmaName of Object.keys(COLLECTION)) {
    const c = short(figmaName);
    const freshKeys = kit.keys?.[figmaName] ?? {};
    const freshHidden = new Set(kit.hidden?.[figmaName] ?? []);
    const wasBindable = keys.bindable[c] ?? {};
    const wasHidden = new Set(keys.hiddenFromPublishing[c] ?? []);

    for (const [name, key] of Object.entries(wasBindable)) {
      if (!(name in freshKeys)) continue; // removal already reported above
      if (freshHidden.has(name)) {
        breaking.push(
          `${c}/${name}: was bindable, is now hidden from publishing — importVariableByKeyAsync will throw`,
        );
      } else if (freshKeys[name] !== key) {
        breaking.push(`${c}/${name}: variable key changed ${key} -> ${freshKeys[name]}`);
      }
    }
    for (const name of wasHidden) {
      if (name in freshKeys && !freshHidden.has(name)) {
        added.push(`${c}/${name}: now published and bindable`);
      }
    }
  }

  // Styles are the only route to type and elevation, so a lost key is breaking.
  for (const [group, committedGroup] of [
    ['textStyles', styles.textStyles],
    ['effectStyles', styles.effectStyles],
  ]) {
    const fresh = kit[group] ?? {};
    for (const [name, entry] of Object.entries(committedGroup)) {
      const f = fresh[name];
      if (!f) {
        breaking.push(`${group}: "${name}" no longer exists in the kit`);
        continue;
      }
      if (f.key !== entry.key) {
        breaking.push(`${group}: "${name}" key changed ${entry.key} -> ${f.key}`);
      }
      if (f.hidden) {
        breaking.push(`${group}: "${name}" is now hidden from publishing`);
      }
      if (entry.size !== undefined && f.size !== undefined && round(entry.size) !== round(f.size)) {
        changed.push(`${group}/${name}: size ${entry.size} -> ${f.size}`);
      }
      if (entry.font && f.font && entry.font.replace(/\s+/g, ' ') !== f.font.replace(' / ', ' ')) {
        changed.push(`${group}/${name}: font "${entry.font}" -> "${f.font}"`);
      }
    }
    for (const name of Object.keys(fresh)) {
      if (name.startsWith('EightShapes Spec/')) continue;
      if (!(name in committedGroup)) added.push(`${group}: new style "${name}"`);
    }
  }

  if (kit.survey) {
    const m = load(join(ASSETS, 'manifest.json'));
    notes.push(
      `kit survey: ${kit.survey.pages} pages, ${kit.survey.collections} collections, ` +
        `${kit.survey.textStyles} text and ${kit.survey.effectStyles} effect styles ` +
        `(capture recorded ${m.shape.textStyles} public text styles of that total)`,
    );
  }
}

// ---------------------------------------------------------- published capture

if (publishedPath) {
  const pub = load(publishedPath);
  const publishedAll = new Map();
  for (const [collection, entries] of Object.entries(pub.published ?? {})) {
    if (entries.__error) {
      notes.push(`published: could not read "${collection}" — ${entries.__error}`);
      continue;
    }
    for (const [name, key] of Object.entries(entries)) {
      publishedAll.set(`${short(collection)}/${name}`, key);
    }
  }

  for (const [c, entries] of Object.entries(keys.bindable)) {
    for (const [name, key] of Object.entries(entries)) {
      const path = `${c}/${name}`;
      if (!publishedAll.has(path)) {
        breaking.push(`${path}: listed as bindable but is not in the published library`);
      } else if (publishedAll.get(path) !== key) {
        breaking.push(
          `${path}: published key ${publishedAll.get(path)} differs from committed ${key}`,
        );
      }
    }
  }

  // Kit-vs-published disagreement means someone has unpublished work in flight.
  if (kitPath) {
    const kit = load(kitPath);
    const unpublished = [];
    for (const [figmaName, entries] of Object.entries(kit.keys ?? {})) {
      const hidden = new Set(kit.hidden?.[figmaName] ?? []);
      for (const name of Object.keys(entries)) {
        if (hidden.has(name)) continue;
        if (!publishedAll.has(`${short(figmaName)}/${name}`)) {
          unpublished.push(`${short(figmaName)}/${name}`);
        }
      }
    }
    if (unpublished.length) {
      notes.push(
        `${unpublished.length} variable(s) are visible in the kit but not yet published — ` +
          `the kit has unpublished changes. Do not capture until they ship: ` +
          unpublished.slice(0, 5).join(', ') +
          (unpublished.length > 5 ? `, +${unpublished.length - 5} more` : ''),
      );
    }
  }
}

// --------------------------------------------------------- component capture

if (componentsPath) {
  const fresh = distillComponents(load(componentsPath));
  const before = catalog.components;

  for (const name of Object.keys(fresh)) {
    if (!(name in before)) added.push(`components: new component "${name}"`);
  }

  for (const [name, was] of Object.entries(before)) {
    const now = fresh[name];
    if (!now) {
      breaking.push(`components: "${name}" was removed or unpublished`);
      continue;
    }
    if (now.key !== was.key) {
      breaking.push(`components/${name}: key changed ${was.key} -> ${now.key}`);
    }
    if (now.type !== was.type) {
      breaking.push(`components/${name}: type changed ${was.type} -> ${now.type}`);
    }

    const wasProps = was.properties ?? {};
    const nowProps = now.properties ?? {};
    for (const [prop, wp] of Object.entries(wasProps)) {
      const np = nowProps[prop];
      if (!np) {
        breaking.push(`components/${name}: property "${prop}" was removed`);
        continue;
      }
      // Property keys embed node ids. A rebuilt component changes them and
      // every setProperties call written against the old key throws.
      if (np.key !== wp.key) {
        breaking.push(`components/${name}: property key "${wp.key}" -> "${np.key}"`);
      }
      const wo = wp.options ?? [];
      const no = np.options ?? [];
      for (const o of wo) {
        if (!no.includes(o)) {
          breaking.push(`components/${name}.${prop}: variant option "${o}" was removed`);
        }
      }
      for (const o of no) {
        if (!wo.includes(o)) added.push(`components/${name}.${prop}: new variant option "${o}"`);
      }
    }
    for (const prop of Object.keys(nowProps)) {
      if (!(prop in wasProps)) added.push(`components/${name}: new property "${prop}"`);
    }
  }
}

// -------------------------------------------------------------- icon capture

if (iconsPath) {
  const { icons: fresh } = distillIcons(load(iconsPath), readFileSync(iconsPagePath, 'utf8'));
  const before = iconCatalog.icons;

  for (const name of Object.keys(fresh)) {
    if (!(name in before)) added.push(`icons: new icon "${name}"`);
  }

  for (const [name, was] of Object.entries(before)) {
    const now = fresh[name];
    if (!now) {
      breaking.push(`icons: "${name}" was removed or unpublished`);
      continue;
    }
    // A category move renames the entry only when the name is ambiguous, so on
    // its own it is a note — but it does change how the icon is looked up.
    if (now.category !== was.category) {
      changed.push(`icons/${name}: category ${was.category} -> ${now.category}`);
    }
    for (const [size, key] of Object.entries(was.keys)) {
      if (!now.keys[size]) {
        breaking.push(
          `icons/${name}: the ${size} size was removed — importComponentByKeyAsync will throw`,
        );
      } else if (now.keys[size] !== key) {
        breaking.push(`icons/${name} · ${size}: key changed ${key} -> ${now.keys[size]}`);
      }
    }
    for (const size of Object.keys(now.keys)) {
      if (!was.keys[size]) added.push(`icons/${name}: now publishes a ${size} size`);
    }
  }
}

// ------------------------------------------------------------------- report

const section = (title, items) => {
  if (!items.length) return;
  console.log(`\n${title} (${items.length})`);
  for (const i of items) console.log(`  ${i}`);
};

const total = breaking.length + changed.length + added.length;

if (!total) {
  console.log('No changes. The committed capture matches the kit.');
  for (const n of notes) console.log(`\nnote: ${n}`);
  process.exit(0);
}

section('BREAKING — consumers will fail, do not just regenerate', breaking);
section('CHANGED — values moved, regenerate the CSS', changed);
section('ADDED — new, safe to adopt', added);
for (const n of notes) console.log(`\nnote: ${n}`);

console.log(
  `\n${total} difference(s): ${breaking.length} breaking, ${changed.length} changed, ${added.length} added.`,
);

if (breaking.length) {
  console.log(
    '\nBreaking changes need a decision before the capture is updated. Regenerating\n' +
      'the CSS will not fix them — a removed token is still removed, and a variable\n' +
      'that became hidden still cannot be imported. Check what depends on each one.',
  );
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Round-trip check: resolve every semantic color in pushpin.css through its
 * var() chain and compare the result against independently resolving the same
 * token's alias chain in tokens.figma.json.
 *
 * build-css.mjs --check proves the CSS matches a fresh build. This proves the
 * build itself is faithful — that no alias resolves to the wrong hex.
 *
 * Usage: node scripts/verify.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashAsset } from './canonical.mjs';
import { CORE_COMPONENTS } from './impeccable-bridge.mjs';
import { TOKEN_GROUPS, resolveHex, seg as segment } from './lib/tokens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, '..', 'assets', 'tokens.figma.json'), 'utf8'));
const css = readFileSync(join(here, '..', 'assets', 'pushpin.css'), 'utf8');
const styles = JSON.parse(readFileSync(join(here, '..', 'assets', 'styles.figma.json'), 'utf8'));

/** Resolve a token's alias chain in the Figma JSON down to a literal hex. */
function figmaHex(path, mode, seen = new Set()) {
  if (seen.has(path)) throw new Error(`alias cycle at ${path}`);
  seen.add(path);
  if (path in t.baseColors) return t.baseColors[path];
  const entry = t.semanticColors[path];
  if (!entry) throw new Error(`unknown token ${path}`);
  const v = entry[mode];
  return v.startsWith('@') ? figmaHex(v.slice(1), mode, seen) : v;
}

/** Parse a CSS block's custom property declarations into a map. */
function declsIn(block) {
  const map = new Map();
  for (const m of block.matchAll(/(--pp-[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}'));
const darkStart = css.indexOf('[data-pp-theme="dark"] {');
const darkBlock = css.slice(darkStart, css.indexOf('\n}', darkStart));

const light = declsIn(rootBlock);
const dark = new Map([...light, ...declsIn(darkBlock)]);

/** Resolve a var() chain in the CSS to a literal. */
function cssHex(name, table, seen = new Set()) {
  if (seen.has(name)) throw new Error(`var cycle at ${name}`);
  seen.add(name);
  const raw = table.get(name);
  if (raw === undefined) throw new Error(`missing ${name} in CSS`);
  const m = raw.match(/^var\((--pp-[\w-]+)\)$/);
  return m ? cssHex(m[1], table, seen) : raw;
}

const seg = (p) => p.replace(/\//g, '-');
const problems = [];
let checked = 0;

for (const path of Object.keys(t.semanticColors)) {
  if (path.startsWith('$')) continue;
  for (const mode of ['Light', 'Dark']) {
    const expected = figmaHex(path, mode);
    const actual = cssHex(`--pp-${seg(path)}`, mode === 'Light' ? light : dark);
    checked++;
    if (expected.toLowerCase() !== actual.toLowerCase()) {
      problems.push(`${path} [${mode}]: css=${actual} figma=${expected}`);
    }
  }
}

for (const [path, hex] of Object.entries(t.baseColors)) {
  if (path.startsWith('$')) continue;
  const actual = cssHex(`--pp-color-${seg(path)}`, light);
  checked++;
  if (hex.toLowerCase() !== actual.toLowerCase()) {
    problems.push(`base ${path}: css=${actual} figma=${hex}`);
  }
}

// Every colour token must be accounted for in the Figma keys file as either
// bindable or deliberately hidden from publishing. An unaccounted token means
// the two captures have drifted, and a generation script would fail at runtime
// on an import that silently doesn't exist.
const keys = JSON.parse(readFileSync(join(here, '..', 'assets', 'variable-keys.figma.json'), 'utf8'));
const accounted = (collection, name) =>
  Boolean(keys.bindable[collection]?.[name]) ||
  (keys.hiddenFromPublishing[collection] ?? []).includes(name);

for (const [collection, source] of [
  ['Semantic Colors', t.semanticColors],
  ['Base Colors', t.baseColors],
]) {
  for (const name of Object.keys(source)) {
    if (name.startsWith('$')) continue;
    checked++;
    if (!accounted(collection, name)) {
      problems.push(`${name}: not listed as bindable or hidden under ${collection}`);
    }
  }
}

// A token must never appear in both lists — that would make "can I bind this?"
// unanswerable.
for (const collection of Object.keys(keys.bindable)) {
  for (const name of Object.keys(keys.bindable[collection])) {
    checked++;
    if ((keys.hiddenFromPublishing[collection] ?? []).includes(name)) {
      problems.push(`${name}: listed as both bindable and hidden under ${collection}`);
    }
  }
}

const bindableTotal = Object.values(keys.bindable).reduce((n, c) => n + Object.keys(c).length, 0);
const hiddenTotal = Object.entries(keys.hiddenFromPublishing)
  .filter(([k]) => !k.startsWith('$'))
  .reduce((n, [, v]) => n + v.length, 0);
checked += 2;
if (bindableTotal !== keys.source.bindableCount) {
  problems.push(`bindable count is ${bindableTotal}, header claims ${keys.source.bindableCount}`);
}
if (hiddenTotal !== keys.source.hiddenCount) {
  problems.push(`hidden count is ${hiddenTotal}, header claims ${keys.source.hiddenCount}`);
}

// The spacing keys are embedded in reference/generate.md so a generation lane
// can inline the snap-and-bind helper without a lookup first. That makes them a
// second copy of the capture, and it is the one copy that fails silently: every
// key is 40 hex characters, a wrong one is a perfectly valid key for a different
// step, and the frame it binds looks deliberate at the wrong size.
const generate = readFileSync(join(here, '..', 'reference', 'generate.md'), 'utf8');
const spaceBlock = generate.match(/const SPACE = \{([^}]*)\}/);
checked++;
if (!spaceBlock) {
  problems.push('reference/generate.md: no `const SPACE = { … }` block to check');
} else {
  // Keyed by pixels in the doc, by step in the capture — which is the mapping
  // the check exists to hold, since `space/4` is the fourth step and 16px.
  const quoted = new Map();
  for (const m of spaceBlock[1].matchAll(/(\d+):\s*'([0-9a-f]{40})'/g)) {
    quoted.set(Number(m[1]), m[2]);
  }
  const steps = Object.entries(t.space).filter(([step]) => !step.startsWith('$'));
  checked++;
  if (quoted.size !== steps.length) {
    problems.push(
      `reference/generate.md quotes ${quoted.size} spacing keys, the scale has ${steps.length}`,
    );
  }
  for (const [step, px] of steps) {
    checked++;
    const expected = keys.bindable.Space[step];
    if (!quoted.has(px)) {
      problems.push(`reference/generate.md: no key quoted for ${px}px (space/${step})`);
    } else if (quoted.get(px) !== expected) {
      problems.push(
        `reference/generate.md: ${px}px (space/${step}) quotes ${quoted.get(px)}, ` +
          `variable-keys.figma.json has ${expected}`,
      );
    }
  }
}

// Radius keys are quoted by name, so the comment beside each one is enough to
// check it against. The count is asserted because the match is what finds them:
// reworded the comment and this check would pass by inspecting nothing.
const radiusQuoted = [...generate.matchAll(/'([0-9a-f]{40})',\s*\/\/ corner-radius\/([a-z]+)/g)];
checked++;
if (!radiusQuoted.length) {
  problems.push('reference/generate.md: no `// corner-radius/<name>` key to check');
}
for (const [, key, name] of radiusQuoted) {
  checked++;
  const expected = keys.bindable['Corner Radius'][name];
  if (expected !== key) {
    problems.push(
      `reference/generate.md: corner-radius/${name} quotes ${key}, ` +
        `variable-keys.figma.json has ${expected ?? 'no such token'}`,
    );
  }
}

// The icon catalog states three counts in its header and they are the only
// thing standing between it and a silently lossy merge — two icons published
// under one name, or a size dropped, would otherwise look like a smaller kit
// rather than a broken capture. Same reasoning as the bindable/hidden totals
// above: a number nothing checks is decoration.
const iconCatalog = JSON.parse(readFileSync(join(here, '..', 'assets', 'icons.figma.json'), 'utf8'));
const iconEntries = Object.entries(iconCatalog.icons);
const iconKeyTotal = iconEntries.reduce((n, [, e]) => n + Object.keys(e.keys).length, 0);
const iconSizes = Object.keys(iconCatalog.sizes);

checked += 2;
if (iconEntries.length !== iconCatalog.source.publicKept) {
  problems.push(
    `icon catalog holds ${iconEntries.length} entries, header claims ` +
      `${iconCatalog.source.publicKept}`,
  );
}
if (iconKeyTotal !== iconCatalog.source.keyCount) {
  problems.push(`icon keys total ${iconKeyTotal}, header claims ${iconCatalog.source.keyCount}`);
}

for (const [name, entry] of iconEntries) {
  checked++;
  const sizes = Object.keys(entry.keys);
  if (!sizes.length) {
    problems.push(`icon ${name}: no keys at any size`);
    continue;
  }
  const unknown = sizes.filter((s) => !iconSizes.includes(s));
  if (unknown.length) {
    problems.push(`icon ${name}: size ${unknown.join(', ')} is not on the ramp`);
  }
  // An icon that does not publish every size is legal and recorded, but it has
  // to be recorded — the placement rules send a caller to a size that exists,
  // and they read `incomplete` to know which ones don't.
  if (sizes.length !== iconSizes.length && !iconCatalog.incomplete[name]) {
    problems.push(`icon ${name}: publishes ${sizes.length} of ${iconSizes.length} sizes, ` +
      `but is not listed under incomplete`);
  }
}

// The join in copy-map.json is the one part of the copy chain no upstream can
// supply, and the only one that rots without anything failing. build-copy.mjs
// asserts it while building, but that runs when the rules change — a kit
// refresh that renames a component happens on the other clock entirely, and it
// leaves copy.json pointing at a name nobody publishes any more, silently
// un-limiting the component. This is what looks in between.
const copyMap = JSON.parse(
  readFileSync(join(here, '..', 'assets', 'copy-map.json'), 'utf8'),
).map;
const catalog = JSON.parse(
  readFileSync(join(here, '..', 'assets', 'components.figma.json'), 'utf8'),
).components;

for (const [row, entry] of Object.entries(copyMap)) {
  const mapped = entry.pushpin ?? [];
  checked++;
  // A gap is legitimate — a header is a type ramp step, not a component — but
  // an unexplained one is indistinguishable from a mapping someone forgot.
  if (!mapped.length && !entry.note) {
    problems.push(`copy-map.json: ${row} maps to nothing and says nothing about why`);
  }
  for (const name of mapped) {
    checked++;
    if (!(name in catalog)) {
      problems.push(`copy-map.json: ${row} maps to "${name}", which is not in the component catalog`);
    }
  }
}

// A unit-bearing group carries its unit twice: `$unit` in the capture, which
// build-css.mjs emits from, and `unit` in the TOKEN_GROUPS table, which
// lookup.mjs prints from. Two copies of the same fact drift, and the drift is
// silent in the direction that matters — a lookup reporting -1px for a value the
// stylesheet correctly emits as -0.01em reads as authoritative.
const UNITS_IN_TABLE = new Map(TOKEN_GROUPS.filter((g) => g.unit).map((g) => [g.key, g.unit]));
const UNITS_IN_CAPTURE = new Map(
  Object.entries(t)
    .filter(([name, body]) => !name.startsWith('$') && body && typeof body === 'object' && body.$unit)
    .map(([name, body]) => [name, body.$unit]),
);

for (const [key, unit] of UNITS_IN_TABLE) {
  checked++;
  const captured = UNITS_IN_CAPTURE.get(key);
  if (captured === undefined) {
    problems.push(`${key}: lib/tokens.mjs declares unit "${unit}", the capture declares no $unit`);
  } else if (captured !== unit) {
    problems.push(`${key}: capture $unit "${captured}" but lib/tokens.mjs says "${unit}"`);
  }
}
for (const [key, unit] of UNITS_IN_CAPTURE) {
  checked++;
  if (!UNITS_IN_TABLE.has(key)) {
    problems.push(
      `${key}: capture declares $unit "${unit}" but lib/tokens.mjs carries no unit for it, ` +
        `so a lookup prints the number bare`,
    );
  }
}

// The type ramp's tracking, generator against capture, resolved from the other
// end: what the stylesheet actually says against what the published styles
// actually carry. Tracking is the one type property the variables do not hold —
// it lives on the text styles — so nothing above this can see it.
//
// The step-to-style pairing is a name rule, `title-3` to `Title/3`, and a rename
// would re-pair the whole ramp without changing a single value. So the pairing
// is checked against a fact both sides carry independently, the font size,
// rather than assumed from the names that produced it.
const styleFor = (step) => {
  if (step === 'hero') return 'Title/Hero';
  const m = /^(title|body)-(\d+)$/.exec(step);
  return m ? `${m[1] === 'title' ? 'Title' : 'Text'}/${m[2]}` : null;
};
const FIGMA_UNIT = { PIXELS: 'px', PERCENT: 'percent' };

const utilities = new Map();
for (const m of css.matchAll(/^\.pp-([\w-]+) \{\n([\s\S]*?)\n\}/gm)) {
  const ls = m[2].match(/letter-spacing:\s*var\((--pp-tracking-[\w-]+)\)/);
  utilities.set(m[1], ls ? ls[1] : null);
}

const trackingTokens = Object.entries(t.letterSpacing).filter(([k]) => !k.startsWith('$'));
const wantedBy = new Map(trackingTokens.map(([name]) => [`--pp-tracking-${segment(name)}`, 0]));
const nativeMode = t.font.$modes[0];

for (const [step, spec] of Object.entries(t.font)) {
  if (step.startsWith('$')) continue;
  const styleName = styleFor(step);
  const style = styleName && styles.textStyles[styleName];
  checked++;
  if (!style) {
    problems.push(`type step "${step}" pairs with no published text style, so its tracking is unknown`);
    continue;
  }
  checked++;
  if (style.size !== spec.size?.[nativeMode]) {
    problems.push(
      `type step "${step}" is paired with text style "${styleName}", but the step is ` +
        `${spec.size?.[nativeMode]}px and the style is ${style.size}px — the pairing rule and ` +
        `the kit disagree, so every tracking value below is being read off the wrong style`,
    );
  }

  const ls = style.letterSpacing;
  checked++;
  if (!ls || typeof ls.value !== 'number' || !ls.unit) {
    problems.push(`text style "${styleName}": letterSpacing is not captured as { value, unit }`);
    continue;
  }
  checked++;
  if (FIGMA_UNIT[ls.unit] !== t.letterSpacing.$unit) {
    problems.push(
      `text style "${styleName}" tracks in ${ls.unit}, but the letterSpacing tokens are ` +
        `${t.letterSpacing.$unit}`,
    );
  }

  let expected = null;
  if (ls.value !== 0) {
    const token = trackingTokens.find(([, v]) => v === ls.value);
    if (!token) {
      checked++;
      problems.push(
        `text style "${styleName}" tracks ${ls.value}, which no letterSpacing token matches`,
      );
      continue;
    }
    expected = `--pp-tracking-${segment(token[0])}`;
    wantedBy.set(expected, wantedBy.get(expected) + 1);
  }

  checked++;
  if (!utilities.has(step)) {
    problems.push(`.pp-${step}: no such utility in the stylesheet`);
  } else if (utilities.get(step) !== expected) {
    problems.push(
      `.pp-${step}: emits ${utilities.get(step) ?? 'no letter-spacing'} but "${styleName}" ` +
        `tracks ${ls.value}${ls.unit === 'PERCENT' ? '%' : 'px'}, which calls for ` +
        `${expected ?? 'none'}`,
    );
  }
}

// A tracking token nothing emits is legal only because no style calls for it —
// `loose` is published at +1% and no Pushpin text style uses it. Counting both
// sides is what tells that apart from the defect this replaced, where a blanket
// rule emitted `tight` on nine steps and left `extra-tight` and `loose` dead
// while three styles were asking for `extra-tight`.
for (const [token, wanted] of wantedBy) {
  checked++;
  const emitted = [...utilities.values()].filter((v) => v === token).length;
  if (emitted !== wanted) {
    problems.push(
      `${token}: ${emitted} utilit${emitted === 1 ? 'y' : 'ies'} emit it, but ${wanted} type ` +
        `step${wanted === 1 ? '' : 's'} call${wanted === 1 ? 's' : ''} for it`,
    );
  }
}

// `renderComponentSection`'s `if (!entry) continue` means a renamed component
// makes DESIGN.md emit 27 sections instead of 28 and say nothing about the one
// it dropped — the same silence as a tracking token nobody references. Curation
// of the list stays with a human; only the silence is removed.
for (const name of CORE_COMPONENTS) {
  checked++;
  if (!(name in catalog)) {
    problems.push(
      `impeccable-bridge.mjs: CORE_COMPONENTS names "${name}", which is not in the component ` +
        `catalog — DESIGN.md would skip it silently`,
    );
  }
}

// ------------------------------------------- component specs against the kit

// The spec capture is a reduction — 456 variants recorded out of 1079 real
// children — and a reduction nobody can see is the failure this asset exists to
// remove. Each set therefore records what it dropped, and these checks are what
// make the record binding: a `reduced` block that disagrees with the variants
// beside it, or an axis option nothing was recorded for and nothing declared
// unreachable, is a gap that would otherwise read as a complete answer.
const specs = JSON.parse(
  readFileSync(join(here, '..', 'assets', 'component-specs.figma.json'), 'utf8'),
);
const specEntries = Object.entries(specs.components);
const knownOffMode = new Set(specs.coverage.coloursMatchingNeitherMode ?? []);
const knownRestless = new Set(specs.coverage.withoutRestingVariant ?? []);

checked++;
if (specEntries.length !== specs.source.componentsRecorded) {
  problems.push(
    `component-specs: source records ${specs.source.componentsRecorded} components, the file holds ${specEntries.length}`,
  );
}

for (const [name, entry] of specEntries) {
  checked++;
  if (!(name in catalog)) {
    problems.push(`component-specs: "${name}" has a spec but is not in the component catalog`);
  }
  if (entry.type !== 'COMPONENT_SET') continue;

  const variants = entry.variants ?? [];
  checked++;
  if (entry.recorded !== variants.length) {
    problems.push(
      `component-specs: ${name} records ${entry.recorded} variants but carries ${variants.length}`,
    );
  }
  if (entry.reduced) {
    checked++;
    if (entry.reduced.recorded !== variants.length || entry.reduced.children !== entry.children) {
      problems.push(
        `component-specs: ${name} reduction says ${entry.reduced.recorded} of ${entry.reduced.children}, ` +
          `the entry carries ${variants.length} of ${entry.children}`,
      );
    }
  } else {
    checked++;
    if (variants.length < entry.children) {
      problems.push(
        `component-specs: ${name} recorded ${variants.length} of ${entry.children} children and declares no reduction`,
      );
    }
  }

  // Every option is represented, or the capture said why it could not be. A set
  // whose cross product outruns its real children has combinations nobody built,
  // and `unreachable` is where that gets stated instead of quietly missing.
  const covered = new Set(variants.flatMap((v) => v.for ?? []));
  const unreachable = new Set(entry.unreachable ?? []);
  for (const [axis, options] of Object.entries(entry.axes ?? {})) {
    for (const option of options) {
      checked++;
      const pair = `${axis}=${option}`;
      if (!covered.has(pair) && !unreachable.has(pair)) {
        problems.push(`component-specs: ${name} ${pair} has no recorded variant and is not declared unreachable`);
      }
    }
  }
  for (const v of variants) {
    for (const pair of v.for ?? []) {
      checked++;
      const at = pair.indexOf('=');
      const [axis, option] = [pair.slice(0, at), pair.slice(at + 1)];
      if (!(entry.axes?.[axis] ?? []).includes(option)) {
        problems.push(`component-specs: ${name} records a variant for "${pair}", which the set does not publish`);
      }
    }
  }

  // The resting appearance is what a per-option line is a difference from, so a
  // set without one cannot be described by the generated spec bullets at all.
  checked++;
  const hasResting = variants.some((v) => Object.keys(v.props ?? {}).length === 0);
  if (!hasResting && !knownRestless.has(name)) {
    problems.push(`component-specs: ${name} recorded no all-defaults variant and coverage does not say so`);
  }
}

// A captured colour literal is what one mode renders, not a mode-independent
// fact, and the capture states which mode in `source.colorMode`. Anything that
// resolves to neither mode is a component overriding a token it claims to use —
// a real finding, recorded in coverage rather than reconciled here.
for (const [name, entry] of specEntries) {
  for (const v of [entry.resting, ...(entry.variants ?? [])].filter(Boolean)) {
    for (const value of [v.fill, v.stroke, v.text?.fill]) {
      if (!Array.isArray(value) || value[0] !== 'Tokens / Semantic Colors') continue;
      if (typeof value[2] !== 'string') continue;
      checked++;
      // `resolveHex` rather than `figmaHex`: a binding into the semantic colour
      // collection can name a variable the token capture does not hold — the kit
      // has `Background/Primary/medium [default]` — and that absence is the
      // finding, not a reason to abort the run.
      const want = resolveHex(t, value[1], specs.source.colorMode)?.toLowerCase();
      const got = value[2].toLowerCase().slice(0, 7);
      if (want === got) continue;
      const where = `${name}${v.for ? ` ${v.for[0]}` : ''} ${value[1]} rendered ${got}`;
      if (![...knownOffMode].some((k) => k.startsWith(where))) {
        problems.push(
          `component-specs: ${where}, but ${value[1]} is ${want ?? 'not in the token capture'} in ` +
            `${specs.source.colorMode} mode, and coverage does not record the difference`,
        );
      }
    }
  }
}

// Every capture must still hash to what the manifest recorded. This is the only
// check that catches a hand-edited capture: build-css.mjs --check proves the CSS
// matches the JSON, but a JSON edited to match a wrong assumption would pass it.
const manifest = JSON.parse(readFileSync(join(here, '..', 'assets', 'manifest.json'), 'utf8'));
for (const [file, expected] of Object.entries(manifest.hashes)) {
  checked++;
  const actual = hashAsset(join(here, '..', 'assets', file));
  if (actual !== expected) {
    problems.push(
      `${file}: content hash ${actual} but manifest records ${expected}. ` +
        `Either the file was hand-edited, or the manifest needs regenerating.`,
    );
  }
}

if (problems.length) {
  console.error(`${problems.length} of ${checked} checks failed:\n`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
// The two totals count variables, not the token entries in tokens.figma.json —
// the type ramp is one entry per step and three variables. The sentence says
// "color token" for that reason: 131 + 168 not summing to 273 would otherwise
// read as an arithmetic bug.
console.log(
  `All ${checked} checks pass — colors resolve to their Figma values, and every color token is ` +
    `accounted for in the ${bindableTotal + hiddenTotal} captured variable keys ` +
    `(${bindableTotal} bindable, ${hiddenTotal} hidden from publishing).`,
);

// Every check above compares the repo against itself, so all of them pass on a
// capture that went stale months ago. That makes the sentence just printed the
// most likely source of false confidence in the whole toolchain, which is why
// the capture date is stated right underneath it rather than left to be found.
const ageDays = Math.max(
  0,
  Math.floor((Date.now() - Date.parse(`${manifest.capturedAt}T00:00:00Z`)) / 86_400_000),
);
console.log(
  `Captured ${manifest.capturedAt}, ${ageDays} day${ageDays === 1 ? '' : 's'} ago. Nothing here ` +
    `asks Figma whether that is still current — run scripts/freshness.mjs for that.`,
);

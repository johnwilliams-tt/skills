/**
 * Renders Pushpin's tokens as a `DESIGN.md` and an `.impeccable/design.json`
 * sidecar, so the `impeccable` skill's detector enforces Pushpin during the
 * browser phase.
 *
 * Why this exists at all: work now routinely starts in the browser and is
 * pushed to Figma afterwards, so drift introduced in CSS arrives in Figma
 * already baked in. Everything else in this plugin guards the Figma end, which
 * is the wrong end to catch a hardcoded `#0d6cb4` that should have been
 * `--pp-background-brand-default`.
 *
 * `impeccable` has no way to register a rule and no concept of a component
 * library, but it already ships `design-system-color`, `design-system-font`,
 * `design-system-radius`, and `design-system-font-size`, all of which read an
 * allowlist from exactly these two files. Feeding it is a great deal cheaper
 * than changing it, and it works with any other tool that adopts the format.
 *
 * The split between the two files is the format's, not ours. `DESIGN.md`
 * frontmatter is parsed by a YAML subset with no list support, so it carries
 * the readable core; the JSON sidecar carries the exhaustive ramps. Both are
 * read, and the union is the allowlist.
 */

/** Entries in a capture object, minus the `$comment`-style metadata. */
const real = (o) => Object.entries(o ?? {}).filter(([k]) => !k.startsWith('$'));

/** Resolve a semantic token's `@alias` chain down to a literal hex. */
function resolveHex(tokens, path, mode, seen = new Set()) {
  if (seen.has(path)) return null;
  seen.add(path);
  if (path in tokens.baseColors) return tokens.baseColors[path];
  const v = tokens.semanticColors[path]?.[mode];
  if (typeof v !== 'string') return null;
  return v.startsWith('@') ? resolveHex(tokens, v.slice(1), mode, seen) : v;
}

/**
 * The handful of semantic tokens worth showing a human in the frontmatter.
 * The allowlist is complete either way — every token is in the sidecar — so
 * this list is chosen for readability rather than coverage, and a token that
 * disappears from the kit is skipped rather than crashing the render.
 */
const FEATURED = {
  'background-default': 'background/neutral/default',
  'background-low': 'background/neutral/low',
  'background-brand': 'background/brand/default',
  'background-brand-strong': 'background/brand/strong',
  'text-default': 'text/neutral/default',
  'text-secondary': 'text/neutral/medium',
  'text-brand': 'text/brand/default',
  'border-default': 'border/neutral/default',
  'text-critical': 'text/critical/default',
  'text-success': 'text/success/default',
};

/**
 * Radii, with two adjustments the detector needs.
 *
 * `full: 50%` is dropped — a percentage has no pixel value and the detector
 * skips it anyway. `sides: 9999` is emitted as `9999px` and *also* aliased to
 * `full`, because the detector only sets its pill flag on a token literally
 * named full/pill/round. Pushpin makes every button and input a pill, so
 * without the alias the most common radius in the system reads as a violation.
 */
function radii(tokens) {
  const out = {};
  for (const [name, value] of real(tokens.cornerRadius)) {
    if (typeof value !== 'number') continue;
    out[name] = `${value}px`;
  }
  if (out.sides) out.full = out.sides;
  return out;
}

/**
 * The type ramp, both breakpoints. `scale` is the format's name for an
 * enumerated ramp, and enumerating it is what lets the detector flag a
 * `font-size: 15px` that is not on it.
 */
function fontScale(tokens) {
  const out = {};
  for (const [step, spec] of real(tokens.font)) {
    for (const [mode, px] of Object.entries(spec.size ?? {})) {
      if (typeof px === 'number') out[`${step}-${mode}`] = `${px}px`;
    }
  }
  return out;
}

const FONT_FAMILY = 'Thumbtack Rise';

export function renderDesignMd(tokens, { pluginVersion, capturedAt }) {
  const colors = [];
  for (const [label, path] of Object.entries(FEATURED)) {
    const hex = resolveHex(tokens, path, 'Light');
    if (hex) colors.push(`  ${label}: "${hex}"`);
  }

  const scale = Object.entries(fontScale(tokens))
    .map(([k, v]) => `    ${k}: "${v}"`)
    .join('\n');

  const rounded = Object.entries(radii(tokens))
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join('\n');

  return `---
colors:
${colors.join('\n')}
typography:
  body:
    fontFamily: "${FONT_FAMILY}"
  scale:
${scale}
rounded:
${rounded}
---

# Design system

This project uses **Pushpin**, Thumbtack's design system. This file is
generated — it is a machine-readable projection of Pushpin's tokens, written by
the \`pushpin\` plugin (v${pluginVersion}) from the ${capturedAt} capture of the
Figma kit. Editing it by hand does not change the design system; it only makes
the checks disagree with it. Re-run \`init\` to regenerate.

Its job is to let \`impeccable\` and any other tool that reads this format catch
Pushpin drift in the browser, before a design is pushed to Figma. The frontmatter
above is the readable core; \`.impeccable/design.json\` beside it carries the
complete ramps.

## What the checks enforce

| Check | Means |
|---|---|
| colors | Every color resolves to a Pushpin token. A raw hex that is not one is drift. |
| fonts | ${FONT_FAMILY}, and nothing else. |
| radius | One of the corner-radius tokens. Buttons, inputs, and chips are pills. |
| font sizes | A step on the type ramp, at one of its two breakpoints. |

## What they do not

These are token checks. They cannot tell you that you rebuilt Button instead of
using it, that an icon is the wrong size, or that a proposal drifted from what
it extends — the design system is much larger than its tokens. Load the
\`pushpin\` skill for the rest, and use its Figma audit before handing work over.

Prefer semantic tokens (\`--pp-background-brand-strong\`) over base ramps
(\`--pp-color-blue-950\`). Both pass the color check, because both are Pushpin,
but reaching for a base ramp means no semantic token fit — which is worth
questioning rather than a thing to do quietly.
`;
}

export function renderDesignJson(tokens, { pluginVersion, capturedAt }) {
  const colorMeta = {};

  // Every semantic token, with both themes. `canonical` is the light value and
  // `tonalRamp` carries the pair, because the detector allows anything listed
  // in either — and a dark-mode-only colour is not drift.
  for (const [path] of real(tokens.semanticColors)) {
    const light = resolveHex(tokens, path, 'Light');
    const dark = resolveHex(tokens, path, 'Dark');
    if (!light && !dark) continue;
    const ramp = [...new Set([light, dark].filter(Boolean))];
    colorMeta[path] = { canonical: light ?? dark, tonalRamp: ramp };
  }

  // The base ramps as well. They are legal Pushpin and the plugin's own docs
  // allow reaching for them, so flagging one would be wrong — but they are
  // grouped under their family so the sidecar still reads as a set of ramps
  // rather than 90 loose colours.
  const families = {};
  for (const [name, hex] of real(tokens.baseColors)) {
    const family = name.includes('/') ? name.slice(0, name.indexOf('/')) : name;
    (families[family] ??= []).push(hex);
  }
  for (const [family, ramp] of Object.entries(families)) {
    colorMeta[`base/${family}`] = { canonical: ramp[0], tonalRamp: ramp };
  }

  const roundedMeta = {};
  for (const [name, value] of Object.entries(radii(tokens))) {
    roundedMeta[name] = { canonical: value };
  }

  return {
    $comment:
      'Generated by the pushpin plugin from its Figma capture — do not hand-edit. ' +
      'Read alongside DESIGN.md by impeccable and any other tool using this format; ' +
      'this file carries the complete ramps that the DESIGN.md frontmatter cannot ' +
      'express. Regenerate with the plugin\'s init script.',
    source: { designSystem: 'pushpin', pluginVersion, capturedAt },
    extensions: { colorMeta, roundedMeta },
  };
}

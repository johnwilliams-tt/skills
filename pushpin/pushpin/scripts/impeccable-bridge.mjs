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
 *
 * Two things about the markdown body are load-bearing rather than decorative,
 * and both come from impeccable's `design-parser.mjs`:
 *
 * - It recognizes six canonical H2 headings and ignores every other one. A
 *   body of well-written prose under headings it does not know parses to
 *   nothing, `design-md-coverage` fires, and the agent building screens gets
 *   no normative guidance at the exact moment impeccable's own rule says the
 *   brief wins. The section names and bullet shapes below are what that parser
 *   reads; they are not a style choice.
 * - The bullet grammars are exact. A colour is `**Name** (#hex): purpose`, a
 *   shadow is `**Name** (`value`): purpose`, a type step is
 *   `**Name** (specs): purpose`, a component property is `**Key:** value`.
 *   Deviating parses as nothing, silently.
 */

import {
  FONT_FAMILY,
  fontScale,
  radii,
  real,
  resolveHex,
  spacing,
  variantAxes,
} from './lib/tokens.mjs';

/**
 * The handful of semantic tokens worth showing a human in the frontmatter.
 * The allowlist is complete either way — every token is in the sidecar — so
 * this list is chosen for readability rather than coverage, and a token that
 * disappears from the kit is skipped rather than crashing the render.
 */
const FEATURED = {
  'background-default': 'background/neutral/default',
  'background-low': 'background/neutral/low',
  'background-brand': 'background/brand/medium',
  'background-brand-strong': 'background/brand/strong',
  'text-default': 'text/neutral/default',
  'text-secondary': 'text/neutral/medium',
  'text-brand': 'text/brand/strong',
  'text-on-brand-strong': 'text/on-brand/strong',
  'border-default': 'border/neutral/default',
  'text-alert': 'text/alert/strong',
  'text-success': 'text/success/strong',
};

/**
 * Colour groups for the prose section, as `### Heading` → featured keys.
 *
 * Grouped rather than flat because the parser promotes a subsection whose
 * every bullet starts with primary/secondary/tertiary/neutral/accent into one
 * group per bullet, which turns a tidy list into a scatter of single-colour
 * groups. None of these names trip that.
 */
const COLOR_GROUPS = [
  ['Brand', ['background-brand-strong', 'text-on-brand-strong', 'background-brand', 'text-brand']],
  ['Text', ['text-default', 'text-secondary']],
  ['Surfaces', ['background-default', 'background-low']],
  ['Borders', ['border-default']],
  ['Feedback', ['text-alert', 'text-success']],
];

/** What each featured colour is for. Purpose, not a restatement of the name. */
const COLOR_PURPOSE = {
  'background-brand-strong': 'the signature surface — the most important action on a screen, and nothing else',
  'text-on-brand-strong': 'the only label colour that belongs on brand-strong',
  'background-brand': 'brand presence at reading scale — banners, selected states, quiet emphasis',
  'text-brand': 'brand-coloured text and links',
  'text-default': 'body text and headings. Never pure black',
  'text-secondary': 'supporting text, captions, and metadata',
  'background-default': 'the page',
  'background-low': 'a surface that sits back from the page — cards, wells, rows',
  'border-default': 'dividers and the resting border on inputs and cards',
  'text-alert': 'destructive and error text',
  'text-success': 'confirmation and success text',
};

/** What each ramp step is for. Keyed on the token name, skipped when absent. */
const TYPE_PURPOSE = {
  hero: 'one per page at most, and only when the page is a landing surface',
  'title-1': 'page title',
  'title-2': 'major section',
  'title-3': 'subsection',
  'title-4': 'card and panel headings',
  'title-5': 'dense headings inside a component',
  'title-6': 'the smallest heading that still reads as one',
  'title-7': 'labels and eyebrows, sentence case — there is no all-caps overline',
  'title-8': 'the smallest label in the system',
  'body-1': 'default body copy',
  'body-2': 'supporting copy and dense UI',
  'body-3': 'captions, metadata, and legal',
  'body-4': 'the floor — use it deliberately, not to fit more in',
};

/** What each elevation step is for. */
const SHADOW_PURPOSE = {
  100: 'a card resting on the page',
  200: 'a raised surface — hovered cards, sticky headers',
  300: 'a popover, dropdown, or tooltip',
  400: 'a modal or sheet, the top of the stack',
};

/**
 * The components a browser build actually composes, in the order a form-heavy
 * screen tends to need them. Curated rather than the whole catalog: the kit
 * publishes 117 entries, most of which are device mocks, brand marks, and
 * page furniture that no one hand-rolls. Names are resolved against the
 * capture, so an entry the kit drops is skipped rather than invented.
 */
const CORE_COMPONENTS = [
  'Button',
  'Icon Button',
  'Link',
  'TextInput',
  'Text Area',
  'Dropdown',
  'Checkbox',
  'Radio',
  'Switch',
  'Slider',
  'Label',
  'Form Note',
  'Chip',
  'Pill',
  'Badge',
  'Avatar',
  'Alert',
  'Callout',
  'Tip',
  'Toast',
  'Tooltip',
  'Accordion / Item',
  'Tabs',
  'Segmented Control',
  'Progress Meter',
  'Star Rating',
  'Loader Dots',
  'Horizontal Rule',
];

function renderComponentSection(components) {
  if (!components) return null;

  const blocks = [];
  for (const name of CORE_COMPONENTS) {
    const entry = components[name];
    if (!entry) continue;

    const bullets = [
      `- **Source:** published ${entry.type === 'COMPONENT_SET' ? 'component set' : 'component'} in the Pushpin kit. Instance it; never rebuild it.`,
      `- **Declare in code:** \`data-pp-component="${name}"\``,
    ];
    for (const [axis, options] of variantAxes(entry)) {
      bullets.push(`- **${axis}:** ${options.join(', ')}`);
    }

    blocks.push(`### ${name}\n\n${bullets.join('\n')}`);
  }

  if (!blocks.length) return null;
  return blocks.join('\n\n');
}

export function renderDesignMd(tokens, { pluginVersion, capturedAt, components } = {}) {
  const featured = {};
  for (const [label, path] of Object.entries(FEATURED)) {
    const hex = resolveHex(tokens, path, 'Light');
    if (hex) featured[label] = hex;
  }

  const colors = Object.entries(featured)
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join('\n');

  const scale = Object.entries(fontScale(tokens))
    .map(([k, v]) => `    ${k}: "${v}"`)
    .join('\n');

  const space = Object.entries(spacing(tokens))
    .map(([k, v]) => `  "${k}": "${v}"`)
    .join('\n');

  const rounded = Object.entries(radii(tokens))
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join('\n');

  // `### Group` + `- **Name** (#hex): purpose`, which is the parser's Case 1.
  const colorGroups = COLOR_GROUPS.map(([heading, keys]) => {
    const bullets = keys
      .filter((k) => featured[k])
      .map((k) => {
        const label = k.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
        return `- **${label}** (${featured[k]}): ${COLOR_PURPOSE[k] ?? 'a Pushpin semantic token'}`;
      });
    return bullets.length ? `### ${heading}\n\n${bullets.join('\n')}` : null;
  })
    .filter(Boolean)
    .join('\n\n');

  const weights = real(tokens.fontWeight)
    .map(([name, value]) => `${name} ${value}`)
    .join(', ');

  // `- **Name** (specs): purpose`. Specs cannot contain parentheses — the
  // parser's capture group stops at the first one.
  const hierarchy = real(tokens.font)
    .map(([step, spec]) => {
      const native = spec.size?.native;
      const desktop = spec.size?.desktop;
      if (typeof native !== 'number') return null;
      const size = desktop === native ? `${native}px` : `${native}px mobile / ${desktop}px from 700px`;
      const weight = String(spec.weight ?? '').replace(/^@/, '');
      const specs = [size, weight && `weight ${weight}`].filter(Boolean).join(', ');
      return `- **${step}** (${specs}): ${TYPE_PURPOSE[step] ?? 'a step on the Pushpin ramp'}`;
    })
    .filter(Boolean)
    .join('\n');

  // `- **Name** (`value`): purpose`. The value keeps its rgba() parens; the
  // parser's lazy match stops at the first `):` sequence, which is the one
  // closing the bullet rather than the one closing rgba.
  const shadows = real(tokens.shadow)
    .map(([step, value]) => `- **shadow-${step}** (\`${value}\`): ${SHADOW_PURPOSE[step] ?? 'an elevation step'}`)
    .join('\n');

  // The three page breakpoints. The `split-view-*` pair is for a pane inside a
  // layout rather than a viewport, and listing it here reads as five places to
  // reach for when there are three.
  const breakpoints = ['small', 'medium', 'large']
    .filter((name) => typeof tokens.breakpoint?.[name] === 'number')
    .map((name) => `\`${name}\` ${tokens.breakpoint[name]}px`)
    .join(', ');

  const componentSection = renderComponentSection(components);

  return `---
# @generated by the pushpin plugin — do not edit.
# Regenerate with \`pushpin init --write --force\`. Hand edits are lost and, until
# they are, make the design-system checks disagree with the design system.
colors:
${colors}
typography:
  display:
    fontFamily: "${FONT_FAMILY}"
  body:
    fontFamily: "${FONT_FAMILY}"
  scale:
${scale}
spacing:
${space}
rounded:
${rounded}
---

# Design system: Pushpin

## Overview

This project uses **Pushpin**, Thumbtack's design system — the successor to
Thumbprint. Rounder, softer, pill-first, built on a near-navy brand blue.

Pushpin is a binding brand commitment rather than a starting point. It is this
project's tokens, component library, icon set, and words, which makes it
project truth: no other design authority overrides it, and a screen's copy is
governed as closely as its colour. Craft floors, ambition, and category
defaults from any other source choose among Pushpin-legal options, never around
them. What Pushpin leaves open — layout, hierarchy, moments of motion — is
genuinely open, and deferring those to Pushpin is as much a mistake as
overriding it.

The Figma kit is the source of truth, and this file is a generated projection of
it — written by the \`pushpin\` plugin, v${pluginVersion}, from the
${capturedAt} capture. Where any other description of Pushpin disagrees with
these values, the tokens win and the disagreement is a bug to fix. Editing this
file by hand does not change the design system; it only makes the checks
disagree with it.

**Key Characteristics:**

- Pill-first geometry. Interactive elements are fully rounded.
- One near-navy brand blue, used sparingly and at full strength.
- A single variable typeface across the whole ramp.
- Mobile is the primary surface; the ramp scales up at 700px.
- Restraint in elevation and motion — four shadows, six durations.

## Colors

Every colour is a token. Reach for semantic tokens
(\`--pp-background-brand-strong\`) over base ramps (\`--pp-color-blue-950\`); both
are legal Pushpin, but reaching for a base ramp means no semantic token fit,
which is worth questioning rather than doing quietly. The values below are the
light mode; dark mode is the same tokens resolving differently, so a colour that
is correct here is correct there.

**The Signature Pair Rule.** \`--pp-background-brand-strong\` carries
\`--pp-text-on-brand-strong\` as its label, and that pair marks the single most
important action on a screen. Using it for every action does not make a screen
more branded, it makes the pair mean nothing.

${colorGroups}

## Typography

**Display Font:** ${FONT_FAMILY}

**Body Font:** ${FONT_FAMILY}

**Character:** One variable family across the entire ramp. Sentence case for
headings, buttons, labels, and badges — nine brand names take title case,
Thumbtack Guarantee and Top Pro among them, and nothing else does. There is no
display size above \`hero\` and no all-caps overline; a comp that appears to
need one is off-system rather than a reason to invent a token.

Weights are variable-font values rather than the usual 400/700 pair —
${weights}.
Titles use the middle three, which is a large part of why Pushpin reads softer
than Thumbprint.

### Hierarchy

${hierarchy}

## Layout

Space comes from a 13-step scale, \`--pp-space-1\` through \`--pp-space-13\`,
starting at 4px and doubling loosely. A gap that is not on the scale is drift
even when it looks right.

Mobile is the primary surface: design the small screen first and let it scale
up. Breakpoints are ${breakpoints}.

## Elevation & Depth

Four steps, and they are a stacking order rather than a palette of moods. Pick
the one that matches how far the surface actually sits from the page.

${shadows}

## Shapes

Pill-first is the most recognisable thing about Pushpin, and it is not a
preference.

- **Interactive elements** — buttons, inputs, chips, search bars — use
  \`--pp-radius-sides\`. Fully rounded, at every size.
- **Containers** — cards, sheets, modals — use \`--pp-radius-large\` (12px) or
  \`--pp-radius-xlarge\` (16px).
- **Square corners never appear on an interactive element.**

## Components
${componentSection ? `
The kit publishes real components, and the catalog in the \`pushpin\` plugin
carries their import keys and exact property names. Build from them. A pill
shaped like a button but drawn by hand is a lookalike, and it is still a
lookalike when it reaches Figma — where the audit fails it.

**Declare what you build.** Code Connect is not wired for Pushpin, so when this
project is pushed to Figma nothing tells the push which published component a
given block of markup was meant to be, and it has to guess. Naming it removes
the guess:

\`\`\`html
<button data-pp-component="Button" data-pp-variant="theme=primary, size=medium">
\`\`\`

Use the exact names and options below — they come from the kit. A declaration
that does not resolve against the catalog is ignored at push time, so a typo
costs the guess back rather than breaking the build. React projects already on
Thumbprint components need none of this: \`<Button theme="primary">\` already
says what it is.

When nothing published fits, say that instead, and say what it extends:

\`\`\`html
<div data-pp-proposed="FilterChip" data-pp-extends="Chip" data-pp-tier="better-experience">
\`\`\`

${componentSection}` : `
The kit publishes real components with exact property names and import keys.
Build from them rather than drawing lookalikes. The catalog ships with the
\`pushpin\` plugin; load the skill for it.`}

## Do's and Don'ts

### Do

- Do use \`--pp-*\` custom properties for every colour, size, radius, and space.
- Do prefer semantic tokens over base ramps, and notice when you reach for one.
- Do keep \`--pp-background-brand-strong\` for the single most important action.
- Do design the mobile layout first.
- Do use the icon set — 227 icons at four sizes, each size its own component.
- Do declare component identity in markup so the Figma push does not guess.
- Do name the action in a call to action, in four words: \`Send request\`, not
  \`Learn more\`.
- Do use the product's own words — \`pro\` and not \`contractor\`, \`customer\` and
  not \`user\`, \`sign in\` and not \`log in\`.
- Do raise a gap with the design system owner when nothing in the kit fits.

### Don't

- Don't introduce a colour, radius, or font size that is not a token.
- Don't use pure black for text; body text is \`--pp-text-neutral-default\`.
- Don't put square corners on an interactive element.
- Don't use emoji in product UI. The icon set covers it.
- Don't resize an icon; each size is its own component.
- Don't set an all-caps overline or a display size above \`hero\`.
- Don't drop the actor: \`Dana confirmed your booking\`, not \`Your booking has
  been confirmed\`.
- Don't promise on the product's behalf — \`guaranteed\`, \`perfect match\`.
- Don't rebuild a component the kit already publishes.

---

These checks cover tokens and the copy rules a pattern can decide, which is the
part a stylesheet and a string can be measured against. They cannot tell you
that you rebuilt Button instead of using it, that an icon is the wrong size,
that a proposal drifted from what it extends, or that a line breaking no rule
still does not sound like Thumbtack — the design system is much larger than what
can be measured. Load the \`pushpin\` skill for the rest, and run its Figma audit
before handing work over.
`;
}

/**
 * The hard rules, mirroring the prose. Duplicated rather than derived because
 * the two are read by different consumers — the panel renders these, the agent
 * reads the prose — and a rule that exists in only one of them is a rule half
 * the pipeline does not know about.
 */
const NARRATIVE = {
  dos: [
    'Use --pp-* custom properties for every colour, size, radius, and space.',
    'Prefer semantic tokens over base ramps, and notice when you reach for one.',
    'Keep --pp-background-brand-strong for the single most important action.',
    'Design the mobile layout first.',
    'Use the icon set — 227 icons at four sizes, each size its own component.',
    'Declare component identity in markup so the Figma push does not guess.',
    'Name the action in a call to action, in four words: "Send request", not "Learn more".',
    'Use the product\'s own words — "pro" and not "contractor", "customer" and not "user", '
      + '"sign in" and not "log in".',
    'Raise a gap with the design system owner when nothing in the kit fits.',
  ],
  donts: [
    'Introduce a colour, radius, or font size that is not a token.',
    'Use pure black for text; body text is --pp-text-neutral-default.',
    'Put square corners on an interactive element.',
    'Use emoji in product UI.',
    'Resize an icon; each size is its own component.',
    'Set an all-caps overline or a display size above hero.',
    'Drop the actor: "Dana confirmed your booking", not "Your booking has been confirmed".',
    'Promise on the product\'s behalf — "guaranteed", "perfect match".',
    'Rebuild a component the kit already publishes.',
  ],
  rules: [
    {
      name: 'The Signature Pair Rule',
      body: '--pp-background-brand-strong carries --pp-text-on-brand-strong as its label, and that '
        + 'pair marks the single most important action on a screen. Using it everywhere does not make '
        + 'a screen more branded, it makes the pair mean nothing.',
    },
    {
      name: 'The Pill-First Rule',
      body: 'Buttons, inputs, chips, and search bars use --pp-radius-sides at every size. Cards and '
        + 'other containers use --pp-radius-large or --pp-radius-xlarge. Square corners never appear '
        + 'on an interactive element.',
    },
    {
      name: 'The Declaration Rule',
      body: 'Hand-rolled markup that stands in for a published component names it with '
        + 'data-pp-component, and markup that stands in for nothing published says so with '
        + 'data-pp-proposed. Code Connect is not wired for Pushpin, so a declaration is the only '
        + 'thing that tells the Figma push what a block of markup was meant to be.',
    },
  ],
};

export function renderDesignJson(tokens, { pluginVersion, capturedAt } = {}) {
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

  const shadows = {};
  for (const [step, value] of real(tokens.shadow)) {
    shadows[`shadow-${step}`] = { value, purpose: SHADOW_PURPOSE[step] ?? null };
  }

  const motion = { durations: {}, easings: {} };
  for (const [step, ms] of real(tokens.duration)) {
    if (typeof ms === 'number') motion.durations[`duration-${step}`] = `${ms}ms`;
  }
  for (const [name, curve] of real(tokens.easing)) motion.easings[name] = curve;

  const breakpoints = {};
  for (const [name, px] of real(tokens.breakpoint)) {
    if (typeof px === 'number') breakpoints[name] = `${px}px`;
  }

  const typographyMeta = {};
  for (const [step, spec] of real(tokens.font)) {
    typographyMeta[step] = {
      size: spec.size ?? null,
      lineHeight: spec.lineHeight ?? null,
      weight: String(spec.weight ?? '').replace(/^@/, '') || null,
      purpose: TYPE_PURPOSE[step] ?? null,
    };
  }

  return {
    // Read by impeccable's boot check. Without it the sidecar reads as a
    // pre-v2 file, which routes to `document` — and `document` overwrites both
    // generated files with an invented visual world, deleting the bridge.
    schemaVersion: 2,
    title: 'Design System: Pushpin',
    generatedAt: new Date().toISOString(),
    $comment:
      'Generated by the pushpin plugin from its Figma capture — do not hand-edit. ' +
      'Read alongside DESIGN.md by impeccable and any other tool using this format; ' +
      'this file carries the complete ramps that the DESIGN.md frontmatter cannot ' +
      'express. Regenerate with the plugin\'s init script.',
    source: { designSystem: 'pushpin', pluginVersion, capturedAt },
    extensions: {
      colorMeta,
      roundedMeta,
      spacing: spacing(tokens),
      shadows,
      motion,
      breakpoints,
      typographyMeta,
      narrative: NARRATIVE,
    },
  };
}

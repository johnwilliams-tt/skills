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
  binding,
  isBinding,
  literalOf,
  restingVariant,
  variantFor,
} from './lib/specs.mjs';
import {
  FONT_FAMILY,
  fontScale,
  leading,
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
 * publishes 115 entries, most of which are device mocks, brand marks, and
 * page furniture that no one hand-rolls. Names are resolved against the
 * capture, so an entry the kit drops is skipped rather than invented.
 */
export const CORE_COMPONENTS = [
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

// ------------------------------------------------------------- visual specs

/**
 * What a component actually looks like, one line per appearance-bearing option
 * that an earlier component has not already stated verbatim.
 *
 * The axis list above says `theme` accepts `secondary` and stops there, and
 * that is the whole gap: an agent reading this file knew the option existed and
 * had to invent what it looked like. The invention named a border token the kit
 * does not publish while missing the one it does.
 *
 * One line per option rather than per combination. Button's seven axes cross to
 * 960 combinations and 260 real children; nobody asks what the 137th looks
 * like, and dumping them would nearly triple a file every project loads as
 * context. The capture already reduces to one record per option, each taken
 * with the other axes at their defaults, so a line here is a statement about
 * one option and nothing else.
 *
 * A colour prints as its `--pp-*` name because the name is the decision and the
 * hex is downstream of it. A length prints as the number, because that is what
 * gets written — except a radius, where `--pp-radius-sides` is the pill rule
 * every control follows and naming it is the point.
 */
// A label's colour and its size are two separate decisions and two separate
// axes move them: `theme` recolours the label, `size` resizes it. Held as one
// phrase, a size change would reprint the colour and imply the option changed
// that too.
const SPEC_ORDER = ['fill', 'border', 'radius', 'height', 'padding', 'gap', 'label', 'type'];

function specPhrases(tokens, variant) {
  const out = new Map();
  const name = (v) => {
    const b = binding(tokens, v);
    if (b?.css) return b.css;
    if (b) return `${b.literal ?? '?'} (Figma \`${b.name}\`)`;
    return typeof v === 'string' ? v : `${v}px`;
  };
  const px = (v) => {
    const lit = literalOf(v);
    return typeof lit === 'number' ? `${lit}px` : null;
  };
  // Four sides that agree collapse in the capture, so an array here is a run of
  // genuinely different sides and `12/24px` is the shortest honest rendering.
  const sides = (v) => {
    if (v === null || v === undefined) return null;
    if (isBinding(v) || !Array.isArray(v)) return px(v);
    const parts = v.map(px);
    if (parts.some((p) => p === null)) return null;
    const [t, r, b, l] = parts.map((p) => p.replace('px', ''));
    const shape = t === b && r === l ? [t, r] : [t, r, b, l];
    return `${shape.join('/')}px`;
  };

  if (variant.fill !== undefined) out.set('fill', `fill ${name(variant.fill)}`);
  if (variant.stroke !== undefined) {
    const w = px(variant.strokeWeight);
    out.set('border', `border ${name(variant.stroke)}${w ? ` ${w}` : ''}`);
  }
  if (variant.radius !== undefined) {
    const r = isBinding(variant.radius) ? name(variant.radius) : sides(variant.radius);
    if (r) out.set('radius', `radius ${r}`);
  }
  // Height only where the kit fixed it. A hugging control's height is the
  // height of the word inside it, and stating that as a spec invites someone to
  // pin it there.
  if (variant.sizing?.[1] === 'FIXED') {
    const h = px(variant.size?.[1]);
    if (h) out.set('height', `height ${h}`);
  }
  const pad = sides(variant.padding);
  if (pad && pad !== '0px') out.set('padding', `padding ${pad}`);
  const gap = px(variant.gap);
  if (gap && gap !== '0px') out.set('gap', `gap ${gap}`);
  if (variant.text?.fill !== undefined) out.set('label', `label ${name(variant.text.fill)}`);
  if (variant.text?.size) out.set('type', `type ${variant.text.size}px`);
  return out;
}

const sentence = (phrases, keys) =>
  keys.filter((k) => phrases.has(k)).map((k) => phrases.get(k)).join(', ');

/**
 * The resting appearance, and each option that departs from it.
 *
 * A per-option line is a difference rather than a full spec: `theme=secondary`
 * is only meaningful against what `theme=primary` already looks like, and
 * repeating the eight unchanged properties on every line would cost the budget
 * the per-option decision was meant to save. An option whose variant is
 * identical to the resting one gets no line at all — there is nothing to say
 * about it, and saying it anyway is how a file this long stops being read.
 *
 * Returned split rather than joined so `renderComponentSection` can compare one
 * component's options against another's.
 */
function specBullets(tokens, name, specs) {
  const options = new Map();
  const entry = specs?.[name];
  if (!entry) return { resting: null, options };

  const resting = restingVariant(entry);
  if (!resting) return { resting: null, options };
  const base = specPhrases(tokens, resting);
  const restingLine = sentence(base, SPEC_ORDER);
  if (!restingLine) return { resting: null, options };

  for (const [axis, opts] of Object.entries(entry.axes ?? {})) {
    for (const option of opts) {
      if (option === entry.defaults?.[axis]) continue;
      const variant = variantFor(entry, axis, option);
      if (!variant) continue;
      const phrases = specPhrases(tokens, variant);
      const changed = SPEC_ORDER.filter((k) => phrases.get(k) !== base.get(k) && phrases.has(k));
      // A property the option removes rather than changes — a theme that drops
      // its border — is a real difference and the only honest way to say it.
      const dropped = SPEC_ORDER.filter((k) => base.has(k) && !phrases.has(k));
      if (!changed.length && !dropped.length) continue;
      const said = [sentence(phrases, changed), dropped.length ? `no ${dropped.join(', no ')}` : '']
        .filter(Boolean)
        .join(', ');
      options.set(`${axis}=${option}`, said);
    }
  }
  return { resting: restingLine, options };
}

/**
 * How many options have to coincide before naming another component beats
 * restating them.
 *
 * A reference costs a line here and a jump back there, so it has to buy more
 * than it spends. Five lines is comfortably past that: the shortest option line
 * in the file is around forty characters, and a reference naming five options
 * runs to about a hundred and thirty. Below the floor the honest thing is to
 * repeat — `Radio` and `Checkbox` share two lines, and sending a reader up the
 * page for two would cost them more than reading them here.
 */
const SHARED_OPTION_FLOOR = 5;

/**
 * The already-rendered component whose option lines this one most repeats.
 *
 * An option line is a difference from its own component's resting appearance,
 * so two components stating the same difference are saying the same thing even
 * where their resting appearances diverge — which is exactly the `Icon Button`
 * case: square where `Button` is padded, and identical on every theme, size
 * step and state that does not touch padding. Naming `Button` and listing the
 * options it covers keeps all of that and drops the restatement.
 *
 * Matching is on the rendered line, byte for byte, against what the earlier
 * component actually printed rather than against everything it could have
 * printed. A component that was itself reduced no longer carries the lines it
 * handed off, and pointing at a line that is not on the page is worse than the
 * duplication.
 *
 * Deliberately general: no component is named here, so a kit that stops
 * publishing one, renames it, or grows a third near-twin gets the right answer
 * without an edit. Ties go to the earliest component rendered, which `printed`
 * gives for free through insertion order.
 */
function sharedOptions(printed, options) {
  let best = null;
  for (const [name, theirs] of printed) {
    const keys = [...options.keys()].filter((k) => theirs.get(k) === options.get(k));
    if (keys.length < SHARED_OPTION_FLOOR) continue;
    if (!best || keys.length > best.keys.length) best = { name, keys };
  }
  return best;
}

function renderComponentSection(tokens, components, specs) {
  if (!components) return null;

  const blocks = [];
  // Name to the option lines that component actually printed, in render order.
  const printed = new Map();

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

    const spec = specBullets(tokens, name, specs);
    // The resting line always prints. It is this component's own baseline, and
    // it is what any referenced option line is read against.
    if (spec.resting) bullets.push(`- **Resting:** ${spec.resting}`);

    const mine = new Map(spec.options);
    const shared = sharedOptions(printed, spec.options);
    if (shared) {
      for (const key of shared.keys) mine.delete(key);
      bullets.push(
        `- **Same as ${shared.name}:** ${shared.keys.join(', ')} — ` +
          `each as ${shared.name}'s line above, against this Resting.`,
      );
    }
    for (const [key, said] of mine) bullets.push(`- **${key}:** ${said}`);
    printed.set(name, mine);

    blocks.push(`### ${name}\n\n${bullets.join('\n')}`);
  }

  if (!blocks.length) return null;
  return blocks.join('\n\n');
}

export function renderDesignMd(tokens, { pluginVersion, capturedAt, components, specs } = {}) {
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

  const componentSection = renderComponentSection(tokens, components, specs);

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

export function renderDesignJson(tokens, { pluginVersion, capturedAt, generatedAt, styles } = {}) {
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

  // Leading comes from the published text style, not from `spec.lineHeight`
  // beside the size: the two disagree on the body steps, and a sidecar quoting
  // a leading `pushpin.css` does not emit would have the detector flag correct
  // code.
  const typographyMeta = {};
  for (const [step, spec] of real(tokens.font)) {
    typographyMeta[step] = {
      size: spec.size ?? null,
      lineHeight: leading(tokens, styles, step),
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
    // The caller's, not a clock's. This file is a committed asset, and a render
    // that stamps itself with the current time can never be checked against the
    // copy on disk. Nothing reads the field — impeccable's parser and detector
    // only require `schemaVersion` — so what it carries is the build's to choose.
    generatedAt,
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

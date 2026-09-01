/**
 * Reading `assets/component-specs.figma.json` — what a published component
 * actually looks like, per variant option.
 *
 * `components.figma.json` holds the property API and no geometry, so until this
 * capture existed nothing local could answer "what does `theme=secondary` look
 * like". The answer was guessed instead, and the guess named a border token the
 * kit does not publish while missing the one it does.
 *
 * Two things about the capture's shape are load-bearing.
 *
 * **A bound variable is `[collection, name, literal]` and resolution happens
 * here, not in the capture.** Several of a component's bindings have no `--pp-*`
 * counterpart at all: Button's height binds `Control Sizes/xl` from
 * `Figma / Semantic Dimensions`, and its stroke weight binds `Border/inputs`
 * from the same place. Neither collection is captured in `tokens.figma.json`.
 * Worse, a collection name is not sufficient on its own — `Controls/Stroke/Width`
 * sits inside `Tokens / Semantic Colors` and is still absent from the capture.
 * So `binding` checks membership rather than trusting the collection, and a
 * variable that resolves to nothing is reported as itself with its collection
 * named. Inventing a token name here would reproduce the exact defect the
 * capture exists to remove.
 *
 * **A recorded variant is one option held against the set's defaults.** The
 * capture walks a set's real children — Button has 260 against a 960-combination
 * cross product — and keeps, for each axis option, the child carrying that
 * option with every other axis at its default. So a recorded variant is a
 * statement about one option rather than about a combination, which is what
 * lets a spec line name an option without conflating it with its neighbours.
 * A combination nobody recorded is answered by saying so, never by composing
 * one out of two single-option records.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { overlayPath } from './overlay.mjs';
import { ASSETS, TOKEN_GROUPS, activeOverlay, loadAsset } from './tokens.mjs';

/**
 * Collection name to candidate groups, under every name a capture can report.
 *
 * The kit calls a collection `Tokens / Corner Radius`; a file consuming the
 * published library calls the same collection `Corner Radius`, which is the
 * name `variable-keys.figma.json` records. Both appear in the capture — 82
 * bindings say the long form and 26 say the short one — because a component
 * bound to the local variable and one bound to the library-published variable
 * report different vantage points on the same thing. Accepting only the long
 * form would print `9999 (Figma \`sides\`)` for Chip's radius while
 * `--pp-radius-sides` sits right there, which is the same defect as inventing a
 * token, only pointed the other way.
 *
 * All three names already live in `TOKEN_GROUPS` — `collection`, `bindable` and
 * `hidden` — so this adds no fourth vocabulary to keep in step.
 */
const BY_COLLECTION = new Map();
for (const g of TOKEN_GROUPS) {
  for (const alias of [g.collection, g.bindable, g.hidden]) {
    if (!alias) continue;
    if (!BY_COLLECTION.has(alias)) BY_COLLECTION.set(alias, []);
    BY_COLLECTION.get(alias).push(g);
  }
}

/** The read that returns a spec the capture does not hold. */
export const THE_READ =
  "one use_figma call against the component's page in the Pushpin kit, " +
  'per scripts/extract.md § Component visual specs';

/**
 * A capture value is a `[collection, name, literal]` triple where a Figma
 * variable is bound, and a bare number or hex where none is. The first element
 * being a string is what tells them apart: every literal position in the
 * capture holds a number or a `#hex`, never a collection name.
 */
export const isBinding = (v) => Array.isArray(v) && typeof v[0] === 'string';

export const SPECS_FILE = 'component-specs.figma.json';

/**
 * The capture, or null when it is not on disk.
 *
 * Absent is a real state rather than a crash: the capture is a separate refresh
 * from the property API and a maintainer can land one without the other. Every
 * caller here answers an absent capture the same way a missing component is
 * answered — by naming the read — so a hard failure would only turn a useful
 * answer into a stack trace.
 */
export const loadSpecs = () =>
  overlayPath(activeOverlay(), SPECS_FILE) || existsSync(join(ASSETS, SPECS_FILE))
    ? loadAsset(SPECS_FILE)
    : null;

/**
 * A bound variable resolved against the token capture. `css` is null when the
 * variable has no Pushpin token, which is a fact about the kit rather than a
 * failure — `collection` and `name` still say exactly what it is.
 */
export function binding(tokens, v) {
  if (!isBinding(v)) return null;
  const [collection, name, literal] = v;
  // Membership decides, not the collection name. `Semantic Colors` is both a
  // bindable and a hidden collection, and `Controls/Stroke/Width` sits inside
  // `Tokens / Semantic Colors` in Figma while being absent from the token
  // capture entirely — so a group that claims the collection but does not hold
  // the name is the wrong group, or there is no token at all.
  const group = (BY_COLLECTION.get(collection) ?? []).find((g) => name in (tokens[g.key] ?? {}));
  return {
    collection,
    name,
    literal: literal ?? null,
    css: group ? group.css(name) : null,
    group: group ? group.key : null,
  };
}

/** The Figma variable path, or null for a literal. */
export const pathOf = (v) => (isBinding(v) ? v[1] : null);

/** What actually renders: the literal beside a binding, or the bare value. */
export const literalOf = (v) => (isBinding(v) ? (v[2] ?? null) : v);

/**
 * One property as a phrase, for a human reading a spec.
 *
 * A resolved token prints its Figma path, because that is the name the kit, the
 * catalog and the `--pp-*` custom property all share, and the custom property
 * is mechanical from it. An unresolved variable prints its path and its
 * collection, so nobody reaches for a `--pp-` name that does not exist. A
 * literal prints as itself.
 */
export function phrase(tokens, v, unit = '') {
  if (v === null || v === undefined) return null;
  const b = binding(tokens, v);
  if (!b) return typeof v === 'number' ? `${v}${unit}` : String(v);
  if (b.css) return `\`${b.name}\``;
  const shown = b.literal === null ? '' : ` ${b.literal}${typeof b.literal === 'number' ? unit : ''}`;
  return `\`${b.name}\`${shown} (${b.collection}, no Pushpin token)`;
}

/**
 * The same property as a `--pp-*` name where it has one.
 *
 * Where it has none the value leads and the variable follows in parentheses,
 * because what a reader needs first is the number to write and second the
 * reason there is no token to write instead.
 */
export function cssPhrase(tokens, v, unit = '') {
  if (v === null || v === undefined) return null;
  const b = binding(tokens, v);
  if (!b) return typeof v === 'number' ? `${v}${unit}` : String(v);
  if (b.css) return `var(${b.css})`;
  const shown = b.literal === null ? '?' : `${b.literal}${typeof b.literal === 'number' ? unit : ''}`;
  return `${shown} (Figma \`${b.name}\`, no Pushpin token)`;
}

/**
 * The variant recorded for one `axis=option` pair, or null.
 *
 * A pair is matched against the entry's own `for` list rather than against the
 * variant's properties, because that list is what the capture selected the
 * variant to represent. One variant commonly represents several pairs — the
 * default child is the representative for every axis at its default.
 */
export function variantFor(entry, axis, option) {
  const want = `${axis}=${option}`;
  return (entry?.variants ?? []).find((v) => v.for.includes(want)) ?? null;
}

/** The variant standing for every axis at its default: the resting appearance. */
export function restingVariant(entry) {
  if (!entry) return null;
  if (entry.resting) return entry.resting;
  return (entry.variants ?? []).find((v) => Object.keys(v.props).length === 0) ?? null;
}

/**
 * The variant recorded for a whole selector, when one was.
 *
 * Every requested pair has to land on the same recorded variant, since two
 * single-option records describe two different children and reading a fill off
 * one and a height off the other invents a third.
 */
export function variantForAll(entry, pairs) {
  if (!entry || !pairs.length) return null;
  const wanted = pairs.map(([axis, option]) => `${axis}=${option}`);
  return (
    (entry.variants ?? []).find((v) => wanted.every((w) => v.for.includes(w))) ?? null
  );
}

/** Which requested pairs name an axis or option the set does not publish. */
export function unknownPairs(entry, pairs) {
  const out = [];
  for (const [axis, option] of pairs) {
    const options = entry?.axes?.[axis];
    if (!options) out.push([axis, option, 'axis']);
    else if (!options.includes(option)) out.push([axis, option, 'option']);
  }
  return out;
}

/** `"theme=secondary, size=large"` as pairs, ignoring anything malformed. */
export function parseSelector(spec) {
  const out = [];
  for (const part of String(spec).split(',')) {
    const [axis, option] = part.split('=').map((x) => x?.trim());
    if (axis && option !== undefined && option !== '') out.push([axis, option]);
  }
  return out;
}

/**
 * The properties on which an option's variant differs from the resting one.
 *
 * This is what makes a per-option spec line honest and short at once. The
 * capture holds each option against the set's defaults, so a difference between
 * the two records is attributable to that option and a match is not worth a
 * line. Comparison is on the whole recorded value, binding and literal
 * together: a fill that moved from one token to another with the same hex has
 * still changed, and a token that kept its name while its value moved has too.
 */
export function deltaFrom(resting, variant, fields) {
  const out = [];
  for (const field of fields) {
    const a = resting?.[field];
    const b = variant?.[field];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    out.push(field);
  }
  return out;
}

/** The text descendant's fill, which is where a label's colour lives. */
export const labelFill = (variant) => variant?.text?.fill ?? null;

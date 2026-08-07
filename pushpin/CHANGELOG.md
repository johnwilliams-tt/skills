# Changelog

Every entry records a capture of the Pushpin Thumbprint UI Kit and what moved
since the last one. Produced by `/pushpin refresh`; see
[pushpin/scripts/check.md](pushpin/scripts/check.md).

Changes are grouped the way `diff.mjs` classifies them:

- **Breaking** — a consumer fails. A removed token, a variable that became
  hidden from publishing, a changed component property key.
- **Changed** — values moved. Regenerate the CSS; nothing errors.
- **Added** — new tokens, components, or styles.

## Unreleased

Nothing yet.

## 0.1.0 — 2026-08-06

First capture of the kit.

**Added**

- 273 tokens across 15 collections, generated to 300 CSS custom properties in
  light and dark with a responsive type ramp.
- Catalog of 117 published components with variant options and import keys.
- 13 text styles and 6 effect styles.
- 131 bindable variable keys, and the 168 hidden from publishing recorded
  explicitly so a generation script fails loudly rather than at runtime.

**Notes from the first capture**

- The kit hides its base ramps, font sizes, shadows, and motion tokens from
  publishing. That is deliberate: consumers reach the semantic layer and use
  published styles for type and elevation. It is also why `variable-keys.figma.json`
  splits bindable from hidden rather than listing keys for everything.
- The kit ships a typo, `title-8/line-heigh`, absorbed by the type regrouping
  rather than propagated into a custom property name. Worth reporting upstream.
- Component property keys embed node ids (`Label#13326:0`). They are stable
  until a component is rebuilt, at which point every `setProperties` call
  written against the old key throws — which is why `diff.mjs` treats a changed
  property key as breaking.

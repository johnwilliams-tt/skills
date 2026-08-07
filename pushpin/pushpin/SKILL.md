---
name: pushpin
description: Thumbtack's Pushpin design system — tokens, type ramp, components, icons, and the Figma bridge, sourced from the Pushpin Thumbprint UI Kit. Use whenever building, restyling, reviewing, or mocking up any Thumbtack interface (web, iOS, Android, marketing, prototype), whenever a design references Pushpin or Thumbprint, and whenever translating between a Thumbtack Figma file and code in either direction.
version: 0.1.0
argument-hint: "[init|generate|audit|tokens|components|figma|check] [target]"
allowed-tools:
  - Bash(${CLAUDE_SKILL_DIR}/scripts/*)
---

Pushpin is Thumbtack's current design system — the successor to Thumbprint.
Rounder, softer, pill-first, built on a near-navy brand blue.

**The Figma file is the source of truth.** Everything in `assets/` is generated
from the Pushpin Thumbprint UI Kit (`VVRGrLgkPRU3vs765d5Q3r`). Where any other
description of Pushpin disagrees with these tokens — a doc, an exported bundle,
a hardcoded hex in an existing repo — the tokens win, and the disagreement is a
bug to fix rather than a variant to preserve. See
[reference/provenance.md](reference/provenance.md).

## Using it in a project

Link the generated stylesheet, then build with the custom properties:

```html
<link rel="stylesheet" href="pushpin.css">
```

`assets/pushpin.css` defines 300 custom properties across colors (light and
dark), spacing, radius, the type ramp, elevation, motion, and breakpoints, plus
`.pp-*` type utilities. Nothing else is required — it has no dependencies and no
build step.

For a React project already on Thumbprint components, the tokens are the same
semantic set Thumbprint v2 emits as `--tp-*`; see
[reference/components.md](reference/components.md) before adding overrides.

## Naming

Custom property names mirror Figma variable paths with `/` replaced by `-`. The
Figma variable `background/brand/strong` is `--pp-background-brand-strong`. This
is a hard rule of the generator, so any value in a build traces back to a
variable in the kit by name alone, and a missing token is a real gap rather than
a naming mismatch.

Reach for semantic tokens (`--pp-background-brand-strong`,
`--pp-text-neutral-default`, `--pp-border-neutral-default`). Base ramps
(`--pp-color-blue-600`) are an escape hatch — using one means no semantic token
covered the case, which is worth noticing.

## Hard rules

- **Pill-first.** Buttons, inputs, chips, and search bars use
  `--pp-radius-sides`. Cards use `--pp-radius-large` (12px) or
  `--pp-radius-xlarge` (16px). No square corners on interactive elements.
- **The signature contrast.** The primary action is
  `--pp-background-brand-strong` (near-navy `#07344a`) with
  `--pp-text-on-brand-strong` (cyan `#7cdcfd`) as its label. Use it for the most
  important action on a screen, and don't dilute it by using it everywhere.
- **Body text is `--pp-text-neutral-default`** (`#1f2022`), never pure black.
- **Sentence case** for headings, buttons, labels, and badges.
- **Mobile is the primary surface.** The type ramp ships mobile-first and scales
  up at 700px; design the small screen first.
- **No emoji in product UI.** Use the icon set.
- **Don't introduce new colors.** Every value in the kit is a token.
- **When generating Figma, never draw a component.** Import the published
  component by key and instance it. A drawn pill that looks like a button is a
  defect, not a shortcut — see [reference/generate.md](reference/generate.md).

## Type

The ramp is `hero`, `title-1` … `title-8`, `body-1` … `body-4`, in Thumbtack
Rise. Use the `.pp-*` utilities or the underlying
`--pp-font-size-*` / `--pp-line-height-*` / `--pp-font-weight-*` triples.

Weights are variable-font values, not the usual 400/700 pair: `regular` 400,
`medium-regular` 563, `medium` 590, `medium-bold` 660, `bold` 700. Titles use
the middle three, which is a large part of why Pushpin reads softer than
Thumbprint.

There is no display size above `hero`, and no all-caps overline style. If a
comp appears to need one, it is off-system — raise it rather than inventing a
token.

## Reference

Load these as the task requires rather than up front.

| Doc | When |
|---|---|
| [reference/generate.md](reference/generate.md) | **Building a layout in Figma.** How to place real component instances and bind real variables, and how to audit that you did |
| [reference/tokens.md](reference/tokens.md) | Choosing a token; need the full vocabulary or the dark-mode story |
| [reference/components.md](reference/components.md) | Building UI in code; mapping Figma components to Thumbprint React |
| [reference/figma.md](reference/figma.md) | Reading a design out of Figma; file keys and library keys |
| [reference/provenance.md](reference/provenance.md) | Something disagrees with these tokens, or the kit changed |

Three generated catalogs back this up, and they exist because none of it is
guessable:

- `assets/components.figma.json` — all 117 published components, their exact
  variant options, and the key to import each one.
- `assets/variable-keys.figma.json` — which variables can be bound from another
  file (131) and which are hidden from publishing (168).
- `assets/styles.figma.json` — the 13 text styles and 4 elevation styles, which
  are the only way to apply Pushpin type and shadow in Figma.

Read the catalog rather than working from memory. Button's toggles are named
`👁️ icon (left)` and `👁️ iconRight`, its text property is `Label#13326:0`
rather than `Label`, and its font sizes cannot be bound as variables at all.

## Commands

`/pushpin generate` — build a layout in Figma from real published components and
library variables, then audit it for lookalikes.

`/pushpin audit` — run the structural audit from `reference/generate.md` against
an existing Figma frame: detached instances, locally-drawn lookalikes, and fills
that should have been variable bindings.

`/pushpin tokens` — answer a token question from `reference/tokens.md`.

`/pushpin components` — map a design or component to Thumbprint React.

`/pushpin figma` — read a design out of Figma into code.

`/pushpin check` — audit a file or directory for off-system values: raw hex that
matches a base ramp, square corners on interactive elements, non-token spacing,
pure-black text.

`/pushpin init` — set a project up. Installs the token stylesheet somewhere
idiomatic for the stack it detects, writes `pushpin.config.json` with the Figma
keys so the bridge works without re-deriving them, and adds a short `AGENTS.md`
section so an agent opening the repo later knows the system is in use.

```bash
node scripts/init.mjs <project-dir>          # print a plan, change nothing
node scripts/init.mjs <project-dir> --write  # apply it
```

It never overwrites without `--force`, and it is safe to re-run. If it detects
Thumbprint it says so and warns against per-component CSS overrides, which is
the specific failure that made Pushpin hard to reuse in the first place.

`/pushpin refresh` — check whether the kit has moved since the capture, and
update if it has. Run it when someone mentions a Pushpin release, when a design
looks off against the tokens, or periodically.

1. Take the captures in [scripts/check.md](scripts/check.md). The kit capture
   alone is enough for a quick look; add the published and component captures
   before actually updating anything.
2. `node scripts/diff.mjs --kit kit.json --published published.json --components components-raw.json`
3. **No output** — nothing to do. Stop.
4. **Breaking** — stop and report. Name what depends on each item. Regenerating
   will not help: a removed token stays removed and a newly hidden variable
   still cannot be imported. Decide with the design system owner whether to
   follow the kit or pin to the old capture.
5. **Changed or added only** — update the affected files in `assets/`, then:

```bash
node scripts/build-css.mjs      # regenerate the stylesheet
node scripts/manifest.mjs       # rehash and re-count
node scripts/verify.mjs         # 645 checks including the new hashes
```

6. Add an entry to `../CHANGELOG.md`, bump `version` in both plugin manifests,
   and commit the JSON, the CSS, and the manifest together. They are one fact
   about one moment; splitting them across commits makes provenance unreadable.

Never hand-edit a capture to make a diff go away. `verify.mjs` hashes every
asset against the manifest and will catch it.

## Regenerating

`assets/pushpin.css` is generated — never hand-edit it. Neither is any file in
`assets/`; they are captures of Figma, not opinions about it.

```bash
node scripts/build-css.mjs          # regenerate from tokens.figma.json
node scripts/build-css.mjs --check  # fail if the committed CSS is stale
node scripts/manifest.mjs           # rehash and re-count the captures
node scripts/manifest.mjs --check   # fail if the manifest is stale
node scripts/verify.mjs             # resolve every var() chain, verify hashes
```

Three different failures, three different checks. `build-css --check` catches a
CSS file that no longer matches its source JSON. `verify.mjs` catches a build
that transformed the JSON wrongly, and — via the manifest hashes — a JSON that
was edited by hand. `diff.mjs` catches the JSON no longer matching Figma.

Re-extracting from Figma is a `use_figma` call. Use
[scripts/check.md](scripts/check.md) to see what moved, and
[scripts/extract.md](scripts/extract.md) for the full re-capture.

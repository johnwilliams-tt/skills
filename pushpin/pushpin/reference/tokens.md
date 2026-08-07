# Tokens

Every name below is a Figma variable path with `/` replaced by `-`. The
authoritative list is `assets/tokens.figma.json`; `assets/pushpin.css` is the
rendered form. This page is for choosing between them.

## How to choose

Work down this list and stop at the first hit:

1. A **semantic** token that names the role — `--pp-background-brand-strong`,
   `--pp-text-neutral-medium`, `--pp-border-alert-default`.
2. A **scale** token for a non-color property — `--pp-space-4`,
   `--pp-radius-xlarge`, `--pp-duration-3`.
3. A **base ramp** color — `--pp-color-blue-600`. Reaching here means no
   semantic token covered the case. That is usually a signal the design is off
   system, or that the kit has a genuine gap; either is worth surfacing rather
   than absorbing silently.

Never a raw value. Every number and hex in Pushpin is a token.

In Figma the library **enforces** this ladder rather than just advising it: all
90 base ramp variables are hidden from publishing, so a consuming file cannot
bind to one even deliberately. In CSS the base ramps are present and reachable,
so the discipline is yours to keep. See [generate.md](generate.md) for what is
and isn't bindable.

## Color

### Base ramps

Nine families, each `50` → `950`: `gray`, `blue`, `green`, `indigo`, `purple`,
`red`, `yellow`, plus `system/white`, `system/black`, and an `alpha` ramp.

```
--pp-color-gray-50 … --pp-color-gray-950
--pp-color-blue-50 … --pp-color-blue-950
--pp-color-system-white   --pp-color-system-black
--pp-color-alpha-50 … --pp-color-alpha-950
```

Two of these are easy to get wrong. **Blue is not a normal ramp** — `blue-600`
(`#009fd9`) is the historic Thumbtack blue, but Pushpin's brand surface is
`blue-950` (`#07344a`), at the far dark end, with `blue-300` (`#7cdcfd`) as its
label. And **alpha is gray-950 at opacity** (`#1f2022` + α), not black. Using
`rgba(0,0,0,α)` produces a colder shadow than the system's.

### Semantic families

Each family reads `<role>/<intent>/<emphasis>` and may carry an interaction
suffix (`/hover`, `/pressed`, `/active`, `/disabled`).

| Role | Intents | Emphases |
|---|---|---|
| `background` | `neutral` `brand` `info` `success` `warning` `alert` `caution` `disabled` `ratings` | `low` `medium` `strong` `heavy` `inverse` `default` |
| `border` | `neutral` `alert` `disabled` `ratings` | `default` `medium` `strong` `low` `inverse` |
| `text` | `neutral` `brand` `on-brand` `info` `success` `warning` `alert` | `default` `medium` `strong` `inverse` |
| `heading` | `neutral` | `default` `medium` `low` `inverse` |
| `link` | `neutral` `brand` `on-brand` `alert` | `default` `low` `strong` `inverse` |
| `icon` | `neutral` `brand` `on-brand` `info` `success` `warning` `alert` | `default` `low` `medium` `strong` `inverse` |
| `data` | `info` | `low` `medium` `strong` |

`heading` is separate from `text` and `icon` is separate from both. They
coincide in light mode and diverge in dark, so using `--pp-text-neutral-default`
on an icon looks correct until someone switches themes.

### The signature pair

```css
background: var(--pp-background-brand-strong);  /* #07344a */
color:      var(--pp-text-on-brand-strong);     /* #7cdcfd */
```

Hover goes to `--pp-background-brand-strong-hover`, which in light mode is
`gray-950` — it darkens toward black rather than continuing up the blue ramp.
That is deliberate and is one of the details that makes a hand-rolled imitation
look wrong.

### Dark mode

All 109 semantic colors define both modes. `pushpin.css` emits dark twice: under
`[data-pp-theme="dark"]` for an explicit toggle, and under
`prefers-color-scheme` for projects that follow the OS. Setting
`data-pp-theme="light"` opts out of the OS query.

Dark is not a mechanical inversion. `background/brand/strong` moves from
`blue-950` to `blue-400`, so the primary button becomes a *bright* blue on dark
rather than staying navy. Anything hardcoded to `#07344a` breaks here — which is
the cheapest way to find hardcoded values.

## Spacing

Thirteen steps, 4px base, super-linear after step 7:

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 48 | 64 | 96 | 128 | 192 | 256 |

There is no 40 and no 80. A comp that appears to need one is either using 32 or
48, or is off system.

## Radius

| Token | px | Use |
|---|---|---|
| `--pp-radius-none` | 0 | |
| `--pp-radius-xsmall` | 4 | |
| `--pp-radius-small` | 6 | |
| `--pp-radius-medium` | 8 | |
| `--pp-radius-large` | 12 | Cards |
| `--pp-radius-xlarge` | 16 | Cards, option rows |
| `--pp-radius-xxlarge` | 24 | Text areas, sheets |
| `--pp-radius-sides` | 9999 | Buttons, inputs, chips, search |
| `--pp-radius-full` | 50% | Avatars, circular |

`sides` is the pill. It is the system's most recognizable trait — when in doubt
on an interactive element, it is `sides`.

## Type

Sizes, line heights, and weights come as a triple per step. Prefer the `.pp-*`
utility class, which applies all three plus tracking.

| Step | Mobile | Desktop | Weight |
|---|---|---|---|
| `hero` | 48 / 50.4 | 64 / 67.2 | 563 |
| `title-1` | 36 / 37.8 | 48 / 50.4 | 563 |
| `title-2` | 28 / 30.8 | 36 / 39.6 | 563 |
| `title-3` | 22 / 24.2 | 24 / 26.4 | 590 |
| `title-4` | 20 / 24 | — | 660 |
| `title-5` | 18 / 21.6 | — | 660 |
| `title-6` | 16 / 19.2 | — | 660 |
| `title-7` | 14 / 16.8 | — | 660 |
| `title-8` | 12 / 14.4 | — | 660 |
| `body-1` | 16 / 24 | — | 400 |
| `body-2` | 14 / 20 | — | 400 |
| `body-3` | 12 / 18 | — | 400 |
| `body-4` | 10 / 18 | — | 400 |

Only `hero` and `title-1` … `title-3` change between mobile and desktop; the
rest are fixed. In Figma these are the `native` and `desktop` modes of
`Tokens / Font`, a platform axis. CSS has no platform axis, so the generator
maps them to a 700px viewport breakpoint — the single interpretive decision in
the build, marked in `build-css.mjs`.

Weights are variable-font values: 400 `regular`, 563 `medium-regular`, 590
`medium`, 660 `medium-bold`, 700 `bold`. Titles use 563–660, never 700.
Substituting a normal bold is the most common way a Pushpin imitation reads
wrong.

When building in **Figma** rather than code, none of these size variables are
bindable — the type ramp is published as 13 text styles (`Title/Hero`,
`Title/1`–`Title/8`, `Text/1`–`Text/4`) listed in `assets/styles.figma.json`.
Those styles use named font weights (Medium, Bold, Regular) rather than the
numeric 563 / 590 / 660, and the styles are what actually renders.

Standalone ratios also exist for custom blocks: `--pp-leading-flat` (1),
`--pp-leading-heading-1|2|3` (1.05 / 1.1 / 1.2), `--pp-leading-text-1…4`
(1.2 / 1.4 / 1.6 / 1.9). Tracking: `--pp-tracking-tight` (−1px),
`--pp-tracking-extra-tight` (−2px), `--pp-tracking-loose` (+1px).

## Elevation

`--pp-shadow-100` through `--pp-shadow-400`. Cards typically `200`, raised
surfaces `400`.

Note the name collision: `--pp-shadow-1` is a *color* (the semantic
`shadow/1` variable), while `--pp-shadow-100` is a complete `box-shadow`. Both
names come from Figma and are kept as-is for traceability.

## Motion

Durations `--pp-duration-1` … `--pp-duration-6` = 75, 150, 200, 250, 300, 350ms.
Easings `--pp-ease-in`, `--pp-ease-out`, `--pp-ease-in-out`.

Entrances use `ease-out`, state changes `ease-in-out`. Short interactions sit at
`duration-2`/`3`; sheets and modals at `5`/`6`.

## Layout

Breakpoints `--pp-breakpoint-small` 481, `-medium` 700, `-large` 1025, plus
`-split-view-small` 769 and `-split-view-medium` 1060.

`--pp-wrap-max-width` 946 and `--pp-wrap-no-pad-width` 1010 are the content
measure. Scrims: `--pp-scrim-light-80`, `--pp-scrim-dark-80`. Modal stacking:
`--pp-z-modal` 200.

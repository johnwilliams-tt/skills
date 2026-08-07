# Provenance

## The chain

```
Pushpin Thumbprint UI Kit (Figma, VVRGrLgkPRU3vs765d5Q3r)
  └─ scripts/extract.md          read the variable collections via use_figma
      └─ assets/tokens.figma.json    verbatim capture, committed
          └─ scripts/build-css.mjs       deterministic transform
              └─ assets/pushpin.css          generated, never hand-edited
```

Two properties matter. The capture is **verbatim** — `tokens.figma.json` holds
what Figma returned, including values that look like mistakes, so that a real
mistake in the kit shows up as a real mistake here rather than being quietly
corrected into an untraceable difference. And the transform is
**deterministic** — `build-css.mjs --check` fails if the committed CSS doesn't
match a fresh build, so the two cannot drift apart unnoticed.

Names survive the whole chain. Figma's `background/brand/strong` becomes
`--pp-background-brand-strong` and nothing else, so a value in a rendered page
can be traced back to a variable in the kit without a lookup table.

## What is not authoritative

**Any hand-written restatement of Pushpin.** These exist and they are useful for
orientation, but they are downstream, and every one checked so far has drifted:

- `styles/pushpin.scss` in `tt-website-demo` — 253 lines of `!important`
  attribute selectors matching CSS-Module hashes, with hex values inline. It
  predates these tokens and duplicates them by hand.
- `generate-pushpin-component/SKILL.md` in the prototyping playground — correct
  in spirit, but its token table is a subset and its type scale is desktop-only.
- The **Claude Design "Pushpin Design System" export** — see below.

**Thumbprint v1 tokens** (`$tp-color__blue`, `$tp-space__3`). Legacy. Pushpin
corresponds to Thumbprint's **v2** semantic set, which the vendored
`thumbprint-tokens` package generates from the same Coda tables that feed the
Figma kit. `--tp-background-brand-strong` and `--pp-background-brand-strong`
name the same token.

## The Claude Design export, specifically

A "Pushpin Design System" bundle exported from Claude Design describes itself as
"reconstructed from the Pushpin Thumbprint UI Kit Figma file." It is a
reasonable orientation document and its icon set and font are genuinely useful.
Its **token values are not reliable**, and it should not be used as a source.

Checked against the Figma variables:

| Area | Export | Figma |
|---|---|---|
| Color ramps | 65 of 77 values correct | — |
| `blue-400` | `#38ccfa` | `#36ccfa` |
| `blue-500` | `#0cb5eb` | `#0cb6eb` |
| `green-100` | `#d5f5e3` | `#d6f5e3` |
| `indigo-100` | `#e1e1fe` | `#e1edfe` |
| `indigo-500` | `#6881cc` | `#6881ec` |
| `purple-50` | `#f6f4fa` | `#f6f4fe` |
| `purple-400` | `#b698ed` | `#ab98ed` |
| `purple-500` | `#9d6ee4` | `#906ee4` |
| `purple-700` | `#663796` | `#6637b6` |
| `purple-800` | `#6d32a5` | `#5d32a5` |
| `purple-900` | `#4d2b67` | `#4d2b87` |
| `red-50` | `#fdf2f2` | `#fef2f2` |
| Alpha ramp | `rgba(0,0,0,α)` — pure black | `#1f2022` at α — gray-950 |
| Spacing | 12 steps, diverges from step 8 (40/48/64/80/96) | 13 steps (48/64/96/128/192/256) |
| Radius | `xs/sm/md/lg/xl/2xl/pill`; `sm`=8, invents `2xl`=32 | `xsmall/small/medium/large/xlarge/xxlarge/sides/full`; `small`=6, `medium`=8, no 32, has `full`=50% |
| Type ramp | `display-1` 106px, `display-2` 70px, `h1`–`h6`, `overline` 11px caps | `hero`, `title-1`–`title-8`, `body-1`–`body-4`. No display sizes, no overline |
| Responsive type | none — one fixed scale | `native` and `desktop` modes on every size |
| Font weights | 300 / 400 / 500 / 700 / 800 | 400 / 563 / 590 / 660 / 700 |
| Easing | `cubic-bezier(0.2,0.7,0.2,1)`, `(0.4,0,0.2,1)` | `(0,0,0.40,1)`, `(0.45,0,0.40,1)`, plus `ease-in` |
| Duration | fast 120 / base 200 / slow 320 | 75 / 150 / 200 / 250 / 300 / 350 |
| Dark mode | "not yet defined" | fully defined — 109 semantic colors × Light and Dark |
| Elevation | 100–400 correct; adds `header`/`footer`/`focus` | 100–400 only |
| Missing entirely | — | breakpoints, scrim, wrap, z-index, line-height ratios, letter-spacing |

The pattern is worth naming: the export is most accurate where the system is
most conventional (grays, the brand blue, elevation) and least accurate where
Pushpin is most distinctive (the weight scale, the radius names, the responsive
type ramp, dark mode). Those are exactly the parts a project needs to get right
to look like Pushpin rather than like a generic rounded theme.

Its **non-token assets remain useful**: the ~60-icon set, the Thumbtack Rise
`woff2`, the logo lockups, and the voice-and-tone guidance, none of which are
expressible as Figma variables.

## When the kit changes

1. Re-run the extraction in [../scripts/extract.md](../scripts/extract.md).
2. Diff `tokens.figma.json`. A changed value is a design decision; a changed
   *name* is a breaking change for every consumer and worth a note.
3. `node scripts/build-css.mjs`.
4. Commit the JSON and the CSS together. They are one unit.

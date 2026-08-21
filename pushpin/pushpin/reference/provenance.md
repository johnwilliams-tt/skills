# Provenance

Two sources, and they do not overlap. **The Figma kit is truth for tokens,
components, icons, and styles; the content design source is truth for copy.**
Each arrives by a chain of the same shape — a verbatim capture, a deterministic
transform, and a `--check` that fails the moment the generated file stops
matching a fresh build of the capture.

## The token chain

```
Pushpin Thumbprint UI Kit (Figma, VVRGrLgkPRU3vs765d5Q3r)
  └─ scripts/extract.md          read the variables and published styles via use_figma
      ├─ assets/tokens.figma.json    verbatim capture, committed
      └─ assets/styles.figma.json    verbatim capture, committed
          └─ scripts/build-css.mjs       deterministic transform
              └─ assets/pushpin.css          generated, never hand-edited
```

The style capture is in the chain because one property is not a variable at all.
Tracking is set per text style, so what a `.pp-title-3` should carry is a fact
about `Title/3` rather than about any token group, and only `styles.figma.json`
holds it.

Two properties matter. The capture is **verbatim** — `tokens.figma.json` holds
what Figma returned, including values that look like mistakes, so that a real
mistake in the kit shows up as a real mistake here rather than being quietly
corrected into an untraceable difference. And the transform is
**deterministic** — `build-css.mjs --check` fails if the committed CSS doesn't
match a fresh build, so the two cannot drift apart unnoticed.

Names survive the whole chain. Figma's `background/brand/strong` becomes
`--pp-background-brand-strong` and nothing else, so a value in a rendered page
can be traced back to a variable in the kit without a lookup table.

## The copy chain

```
content-design-assistant.md (jallard-code/content-design-assistant, GitHub)
  └─ scripts/pull-copy.mjs       fetch the blob, record repo, path, ref, and sha
      └─ assets/copy.source.md       verbatim capture, committed
          └─ scripts/build-copy.mjs      deterministic parse through an adapter
              └─ assets/copy.json            generated, never hand-edited
                  ├─ assets/copy-map.json    hand-authored join to the catalog
                  └─ scripts/lib/copy.mjs    one engine, every consumer
```

The same two properties, held the same way. `copy.source.md` is the bytes GitHub
returned; the provenance rides alongside in `copy.source.json` rather than
inside the capture, because a capture that annotates itself is no longer
verbatim. `build-copy.mjs` recomputes the blob sha from the bytes and refuses to
run when the two disagree, so a hand-edit of the capture is a build failure
rather than a quiet rewriting of the rules, and `build-copy.mjs --check` fails
when the committed JSON does not match a fresh parse.

**`jallard-code/content-design-assistant` is Jody Allard's, and it carries no
license.** The rules are Thumbtack's; the file holding them is one person's
work, vendored here with the repo named as its source and credited as such.
Nothing about that is left implicit — the descriptor records the repo, the path,
the ref, and the blob sha, and `freshness` asks GitHub whether that blob has
moved.

**It is named in one place, so it can be replaced.**
`scripts/lib/copy-sources.mjs` exports `SOURCE` and a parser keyed by its
`kind`. Moving the rules — into the Thumbprint guide pages, or wherever Content
Design would rather own them — is a descriptor edit plus one adapter emitting
the same schema. Every consumer reads `copy.json` and never learns which format
it came from.

**`assets/copy-map.json` is the one part no upstream can supply**: the join from
the generic component names in the rules to real entries in
`assets/components.figma.json`. It is hand-authored, it survives a swap, and a
row with no counterpart is recorded as an empty list and a note saying why,
because a stated gap is honest and an invented mapping is a defect. `verify.mjs`
asserts every mapped name still exists in the catalog, so a kit refresh that
renames a component fails loudly instead of silently un-limiting it.

What the rules mean for the work is in [copy.md](copy.md).

## What is not authoritative

**Any hand-written restatement of Pushpin.** These exist and they are useful for
orientation, but they are downstream, and every one checked so far has drifted:

- `styles/pushpin.scss` in `tt-website-demo` — 253 lines of `!important`
  attribute selectors matching CSS-Module hashes, with hex values inline. It
  predates these tokens and duplicates them by hand.
- `generate-pushpin-component/SKILL.md` in the prototyping playground — correct
  in spirit, but its token table is a subset and its type scale is desktop-only.
- The **Claude Design "Pushpin Design System" export** — see below.

**The vendored Figma Plugin API typings.** `figma-use/SKILL.md` calls
`plugin-api-standalone.d.ts` the definitive source of truth for the API surface.
It is a snapshot, it ships in a plugin cache that is overwritten on update, and
it drifts like every other restatement here. Across 11,329 lines it has zero
mentions of `createSlot`, `SlotNode`, or `SLOT`, while its sibling
`component-patterns.md` documents the slot API in full. It is not broadly stale
— `createAutoLayout`, `node.query`, `placeholder`, and `screenshot` are all in
it — it lags only at the newest edge, which is exactly where recall is weakest
too. That is what makes it worth naming: the typings and memory go wrong on the
same cases, so checking one against the other confirms nothing. The live API is
truth and it is one probe away; the source ordering is in [rules.md](rules.md).

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
`woff2`, and the logo lockups, none of which are expressible as Figma variables.
Its voice-and-tone guidance is not among them: that ground has an authoritative
source of its own, and a hand-written restatement sitting beside one is exactly
the failure the rest of this page is about.

## When the kit changes

1. Re-run the extraction in [../scripts/extract.md](../scripts/extract.md).
2. Diff `tokens.figma.json`. A changed value is a design decision; a changed
   *name* is a breaking change for every consumer and worth a note.
3. `node scripts/build-css.mjs`.
4. Commit the JSON and the CSS together. They are one unit.

## When the copy source changes

`freshness` carries its own layer for it, deliberately outside the capture-age
verdict the Figma files share: a markdown file going stale in a GitHub repo is
no reason to tell anyone to re-capture the kit.

```bash
node scripts/pull-copy.mjs --check    # has the blob moved upstream?
node scripts/pull-copy.mjs && node scripts/build-copy.mjs
node scripts/manifest.mjs             # rehash the capture, copy.json, and the map
node scripts/verify.mjs               # every check, including the copy-map join
```

Read the diff on `copy.source.md` before rebuilding. A changed limit or a new
banned phrase is a decision Content Design made and the rebuild carries it
through. A *renamed row* is the breaking one: it leaves `copy-map.json` joining
to a name that no longer exists, and that is a hand edit rather than a
regeneration.

Commit the capture, the descriptor, the built JSON, and the manifest together,
for the same reason the token chain does.

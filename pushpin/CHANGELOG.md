# Changelog

Most entries record a capture of the Pushpin Thumbprint UI Kit and what moved
since the last one. Those are produced by `/pushpin refresh`; see
[pushpin/scripts/check.md](pushpin/scripts/check.md). The rest record the plugin
itself changing.

Changes are grouped the way `diff.mjs` classifies them:

- **Breaking** — a consumer fails. A removed token, a variable that became
  hidden from publishing, a changed component property key, a command that no
  longer resolves.
- **Changed** — values moved. Regenerate the CSS; nothing errors.
- **Added** — new tokens, components, or styles.

An entry about the plugin rather than the capture adds **Fixed** for a bug in
the toolchain, which `diff.mjs` has no category for.

## Unreleased

Nothing yet.

## 0.4.1 — 2026-08-11

A release nobody receives is indistinguishable from no release. Claude Code
keys its plugin cache on the version string and skips the update when it
matches, and the version was written by hand in four files with the description
in five. The documented trap is narrower still: a `version` in `plugin.json`
silently shadows one in the marketplace entry, so the two disagreeing is worse
than either being stale on its own. The proof it was already happening is in
this repo — 0.4.0 shipped 227 icons, and three of the four descriptions never
mentioned them.

**Fixed**

- **One place to write the version.** `pushpin/.claude-plugin/plugin.json` is
  the authority. `scripts/version.mjs` bumps it and propagates to the Cursor
  manifest, the `SKILL.md` frontmatter, and both marketplace entries;
  `--check` fails when a copy has drifted. `SKILL.md`'s `description` is
  deliberately left alone — it names the conditions under which the model
  should load the skill, which is a different job from catalog copy.
- **The version is gone from the marketplace entries,** which is what the
  shadowing rule asks for. `plugin.json` was always the one being read.
- **`.githooks/pre-commit` bumps the patch** when a commit touches the plugin
  under a version that is already upstream. It compares against the tracked
  branch rather than counting commits, so a deliberate `version.mjs minor`
  before a breaking change stands and the rest of the push cycle rides on it.
  Install with `git config core.hooksPath .githooks`.

**Changed**

- **The install instructions offer a sparse checkout.** This repository holds
  several plugins and git operations are capped at 120 seconds, so
  `--sparse .claude-plugin pushpin` is the cheaper path on a slow connection.

## 0.4.0 — 2026-08-11

Four fidelity failures observed in real use, three of which turned out to be the
same missing capture. Icons were never extracted, because they are not published
from the Pushpin file at all — they live in the older Thumbprint UI Kit. With no
catalog and no size ramp on record, omitting an icon was the only move the rules
left open, and "large icon scaled to look small" was the only way to get a size.

**Added**

- **`assets/icons.figma.json` — the icon set, finally captured.** 227 icons
  across ten categories, 899 import keys, from
  `jjhhb3Kp6a7JrtBLCjrf6u` page `2:1`. This is a **third source library**: the
  plugin previously knew about Pushpin and the Annotation Kit only. Built by the
  new `scripts/build-icons.mjs`, which joins the component dump (names and
  `assetKey`s) against page metadata (the category frames) on `nodeId`.
- **Icon placement rules in `reference/generate.md`.** The size ramp is Tiny 14,
  Small 18, Medium 28, Large 32 and nothing else. An icon is never resized —
  each size is a separate component with its own key, and a scaled one carries
  the stroke weight of the size it was drawn at. Inside a component, the size is
  *read off the slot* rather than chosen, which needs no lookup table and cannot
  go stale when the kit changes.
- **Unresolved atoms are placed, never dropped.** When an icon, illustration,
  avatar, or logo cannot resolve to a published asset, a marked
  `Placeholder / <kind> · <size>` goes in its place with an `Open Question`
  sticky, and the audit reports it in a new non-failing `unresolved` bucket.
  Critically, **a missing child never removes its parent** — an icon button with
  an unresolvable icon still ships as an icon button, which is the cascade that
  made whole controls disappear.
- **Proposals derive from the component they extend.** The proposal gate already
  made you name the closest published component; that component is now the
  starting material. Instance it, `detachInstance()`, change only what the
  `Delta` names, then `createComponentFromNode()`. Rebuilt from scratch, a
  proposal loses the text styles, the padding, the border weight, and the radius
  immediately and invisibly — every one of those a decision nobody made.
- **A `Derived:` field on the proposed-component note,** naming the exact
  variant. "Extends Chip" and "is a modified `Chip / theme=secondary`" are
  different claims and only the second can be checked.
- **A deterministic annotation layout in `reference/annotate.md`,** replacing
  four bullets that gave sizes but no algorithm. Notes go in one auto-layout
  column beside the frame at a fixed gutter and gap — the auto-layout *is* the
  collision avoidance, since nothing in the column is positioned individually.
  Past three notes, anchoring switches from pointers to numbers, and pointer
  direction is derived from geometry rather than chosen. Capstones follow the
  Icons page's own usage: left-aligned with the block they head and stretched to
  span it.
- **Four new audit checks,** all mechanical: an icon whose dimensions are off
  its ramp step, a `TEXT` node inside a `Proposed /` component with raw font
  settings instead of a published text style, unbound radius/padding/spacing
  inside one, and any pairwise overlap among annotation instances or between an
  annotation and the design.
- **`init` writes `DESIGN.md` and `.impeccable/design.json`,** generated from
  the token capture. Browser-first work means drift is introduced in CSS and
  arrives in Figma already baked in, where the audit notices it a step too late.
  These two files are the allowlist `impeccable`'s `design-system-*` rules read,
  so a hardcoded color, font, radius, or font size reports as Pushpin drift
  while you work — with no change to `impeccable`, which has no way to register
  a rule. Verified against its detector: every Pushpin token passes and
  off-system values are flagged.
- **A third access-preflight probe.** The icon library is the least likely of
  the three to be enabled in a product file, and an unreachable one reads as
  "Pushpin has no caret icon", which is wrong and sends the next person to
  propose a component that already exists.
- **An `icons` freshness layer,** checking all 899 keys against the live file.
  Its late-edit sweep is scoped to keys the catalog depends on, since that file
  publishes 170 components beyond the icon page.

**Changed**

- `build-components.mjs` no longer discards `preferredValues` on an
  `INSTANCE_SWAP` property. Pushpin declares none today, so this is defensive —
  but a slot arriving as a key and nothing else is how an icon slot ended up
  empty.
- An `INSTANCE_SWAP` default is now resolved from a bare node id to the name of
  what the kit puts in that slot, and its size recorded as `defaultSize`. Five
  components gained it. `Button` turns out to default to a `Medium` icon on the
  left and a `Tiny` on the right, which no size table would have predicted and
  is the reason the rule reads the slot instead.
- `components.figma.json` re-captured. Nothing moved beyond the two new fields.
- `manifest.json` gains an `iconLibrary` block and icon counts; `verify.mjs`
  gains internal-consistency checks on the icon catalog, so a lossy merge reads
  as a broken capture rather than a smaller kit.
- `diff.mjs` gains `--icons` / `--icons-page`, and refuses `--icons` alone —
  without the page metadata every icon distils as `uncategorised`, which would
  report as 227 category changes rather than the missing input it is.

## 0.3.0 — 2026-08-11

Nothing in `assets/` moved. One new rule about where design work gets its
bearings, and no change to what it is allowed to build.

**Added**

- **Work is grounded in the page the link resolved to.** A resolved link names
  a page, and its sibling frames are the same flow, the same product, and often
  the same screen in its other states — evidence about layout, density, copy
  voice, and naming that no general prior supplies. The page is read
  automatically, because an offer has to name what is on the page to be
  answerable; whether that context shapes the work is the user's call, and the
  answer holds for that page for the session. Rule in `pushpin/SKILL.md`,
  mechanics in `pushpin/reference/context.md`.
- **Other pages are named, not read.** The file's page names stay free — the
  finalize pass already needs them — but another page's contents are reached
  only when the user asks for them or links into one. Pages hold superseded
  versions and parked ideas, and rebuilding a shelved idea as if it were
  current is the failure this closes.
- **Page context is advisory, and departing from it is asked about.** It never
  overrides a token, a published component, or the icon set, so a page built
  entirely of raw hex licenses nothing. But going against a pattern the page
  plainly holds to is the user's decision, put as one question before anything
  is written rather than several during the build.
- **The rule binds by definition rather than by list.** It applies to any skill
  supplying craft floors, ambition, or category defaults — the three named
  under `Precedence` are the current instances, not the extent of it, so a
  skill that arrives later inherits the rule with no edit here.
- **The current Figma selection is used to resolve a link.** `get_metadata`
  reports what is selected in the desktop app, so a file- or page-level URL
  with a frame selected is no longer treated as ambiguous. It is a hint that
  gets confirmed, and it never substitutes for the link a write requires.

## 0.2.0 — 2026-08-10

The first entry that records the plugin changing rather than the kit. Nothing in
`assets/` moved except the Annotation Kit catalog, which is new.

**Breaking**

- **`tokens` and `components` are no longer commands.** `/pushpin tokens` and
  `/pushpin components` no longer resolve. Neither did anything but load a
  reference doc, and `SKILL.md` now carries a routing table that reaches the same
  docs from plain speech — "what's our card radius" loads `reference/tokens.md`,
  "which Thumbprint component is this" loads `reference/components.md`. The
  ground is still covered; the two names are gone. Seven commands remain:
  `generate`, `audit`, `figma`, `check`, `init`, `freshness`, `refresh`.

**Added**

- **A component can now be proposed rather than only instanced.** The old rule
  had no exception: always import the published component, and every local one
  was a defect. That is too strict for a system this young — it produces awkward
  compositions of nearly-right components and buries the gap in a layout instead
  of recording it where the design system owner can see it. An agent may now
  define a real local component named `Proposed / <Name>` in the working file, in
  two cases: nothing published expresses the interaction without lying about its
  API (`Tier: gap`), or something could be stretched and a new component would
  clearly be better (`Tier: better-experience`). The tier is recorded because the
  two ask a reviewer to accept different arguments. What did not loosen is the
  ban on lookalikes: a drawn pill that resembles a Button is still a defect.
  Rules in `pushpin/reference/generate.md`.
- **Every proposal argues its case on the canvas,** as published Annotation Kit
  instances rather than drawn boxes — a note, a pointer at the instance it
  describes, a capstone, and a summary frame — and the plugin prints the same
  fields as a markdown summary in chat after a push. A `Proposed /` component
  with no parseable note is a defect, because a proposal nobody argued for is an
  off-system element with better naming.
- **The Annotation Kit is a second source library** (`Qefv6O2RMPSBtSYBrCGcdI`),
  captured to `pushpin/assets/annotations.figma.json` — every published component
  with every property's exact `key`. Its names are load-bearing and several are
  misspelled in the file (`Annotations` publishes a variant named `List Elelemt`),
  so nothing here is typeable from memory. `pushpin/reference/annotate.md` covers
  what each annotation is for, how to set text on instances that expose none as a
  property, and the Thumbprint contribution flow the plugin documents but does
  not walk. `manifest.mjs` hashes the catalog and records an `annotationKit`
  block, `freshness.mjs` gained an `annotations` layer, and `scripts/extract.md`
  and `scripts/check.md` gained its capture and its diff.
- **Where a design gets written is now a rule, not a judgement call.** A Figma
  link is required before anything is pushed, and is resolved by traversing the
  tree from whatever granularity was pasted. The first pass duplicates the
  resolved frame beside the original on the same page, so the two can be compared
  at a glance; moving the accepted work onto its own page is offered afterwards
  rather than done. Placement is asked about for net-new screens. Writes into the
  Pushpin kit, the Annotation Kit, or any subscribed library are refused. Agent
  writes do not enter the user's undo stack, which is why none of this is left to
  judgement.
- **An access preflight** resolves one key per library before any node is
  created. Keys belong to the file and resolve identically for everyone; access
  does not, and a maintainer's own file subscriptions hide the failure that
  breaks a teammate halfway through a generation run.
- **A precedence section in `SKILL.md`,** declaring Pushpin project truth because
  it is the project's own tokens, components, and icon set: `impeccable`,
  `frontend-design`, and `ui-ux-pro-max` choose among Pushpin-legal options,
  never around them. `init.mjs` writes the same claim into its `AGENTS.md` note,
  because those skills can load into a session this one never enters.
- **A freshness-first session instruction.** The first time Pushpin is picked up
  in a session, `freshness.mjs` runs and the capture's age is reported before
  anything consequential — generating a layout, quoting an exact hex, stating a
  component's variant options.
- `scripts/freshness.mjs` — answers whether the committed captures still match
  Figma, which no existing check could. It reports in layers and degrades rather
  than failing when a layer is out of reach: capture age needs no token and no
  network, component and style import keys need a `file_read` token on any plan,
  and variables need Enterprise. Exits non-zero when something moved.
- `pull-published.mjs --check` — the same publish comparison without writing
  `published.json`, so CI can ask the question without leaving an artifact in the
  working tree.
- `.cursor-plugin/marketplace.json` at the repo root, so Cursor installs the
  plugin from a team marketplace instead of only a symlink off disk.

**Changed**

- **The audit sorts what it finds into three buckets** — Library, Proposed,
  Defects — and fails on defects only. A populated Proposed bucket is a result to
  report, not a failure; that is the whole point of allowing proposals.
- `verify.mjs` now prints the capture date under its pass message. Every one of
  its checks compares the repo against itself, so "all checks pass" was the most
  likely source of false confidence in the toolchain.
- `README.md` is written for designers now: install, what to ask for, and what
  happens when the plugin writes to Figma. The maintainer material moved to the
  end.

**Fixed**

- `init.mjs` would happily set up the plugin's own source tree. Pointed at this
  repo, at the plugin root, or at the skill directory, it wrote
  `pushpin.config.json`, a second copy of the stylesheet, an `AGENTS.md` section,
  and `.claude/settings.json` into the source of truth — pinning the capture to
  itself, which records nothing. It now refuses, names which of the three the
  target is, and points at `<project-dir>` instead. The signal is the running
  script's own location rather than a directory name, so a real project laid out
  like the plugin, or one that vendors a copy of it, still initializes normally.
- `freshness.mjs` validated committed component keys against
  `/files/:key/components` alone. A component set publishes under its own key in
  `/component_sets`, so every set in both catalogs read as unpublished — 96 of
  Pushpin's 117 entries and 70 of the Annotation Kit's 91. It now checks the
  union of both endpoints. Caught before release; the layer would otherwise have
  raised a false alarm across almost the whole catalog on its first real run.

**Notes**

- The key-existence check is the point of the network layers. Counts drifting is
  a note; a key that no longer resolves is a runtime failure, because
  `importComponentByKeyAsync` throws on an unpublished key and takes a generation
  script down mid-run.
- 273 tokens is not the same count as 131 bindable plus 168 hidden, and neither
  is 300. The kit holds 299 variables; `tokens.figma.json` records the type ramp
  as 13 grouped steps rather than the 39 variables behind it, which is where the
  26 go. `pushpin.css` then defines one custom property per variable plus
  `--pp-font-family`, which no variable backs, for 300. The plugin descriptions
  claimed "300 design tokens" and now carry no number at all — four hand-edited
  copies of a count nothing checks is a claim that goes stale quietly.

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

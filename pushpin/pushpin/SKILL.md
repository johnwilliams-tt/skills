---
name: pushpin
description: Thumbtack's Pushpin design system — tokens, type ramp, components, icons, and the Figma bridge. Use when building, restyling, reviewing, or mocking up Thumbtack interfaces (web, mobile, marketing, prototype), when a design references Pushpin or Thumbprint, and when translating Figma to code or back.
version: 0.5.0
argument-hint: "[generate|audit|figma|check · init|freshness · refresh] [target]"
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

## Start here

The capture has a date, and it is not a live feed. Every local check compares
`assets/` against itself, so all of them pass on a snapshot that went stale
months ago.

So the first time Pushpin is picked up in a session, run
`node scripts/freshness.mjs` and report the capture's age before anything
consequential — generating a Figma layout, quoting an exact hex, stating a
component's variant options. It needs no token and no network to answer that,
and with `FIGMA_TOKEN` set it also asks Figma whether the import keys still
resolve. If the capture is more than 30 days old, say so unprompted rather than
presenting it as current.

If the script cannot run — no `node` on the machine, most often — do not skip the
obligation and do not stop. Read `capturedAt` from `assets/manifest.json`
directly, report the age from that, and say that the key-resolution layers are
unavailable until `node` is installed. The point of this rule is that nobody is
told a stale capture is current, and a plain file read satisfies that.

That is the whole obligation, and it is stated once. Nothing further down
repeats it.

## Precedence

Pushpin **is** this project's tokens, component library, and icon set. That
makes it project truth, and project truth is absolute: no other design
authority overrides it.

`impeccable`, `frontend-design`, and `ui-ux-pro-max` sit below it. Their craft
floors, ambition, and category defaults **choose among Pushpin-legal options,
never around them.** A more distinctive radius, a bolder palette, a second type
family, a livelier motion default — each is a legitimate recommendation, and
none of them outranks a token, a published component, or the icon set. Where
one of those skills would genuinely improve something Pushpin has already
settled, that is a conversation with the design system owner, not a local
exception shipped quietly. Extending the system has exactly one legal route: a
`Proposed / …` component, argued on canvas.

What Pushpin leaves open is genuinely open, and those skills decide it. The
tokens do not choose a layout, a hierarchy, a piece of copy, or a moment of
motion, and deferring those to Pushpin is as much a mistake as overriding it.

## Grounding in the page

Precedence settles whose judgment wins. This settles what that judgment is
looking at.

A resolved link names a page, and that page is the context for the work.
Sibling frames are the same flow, the same product, and often the same screen
in its other states — evidence about layout, density, copy voice, and naming
that no general prior can supply. Any skill supplying craft floors, ambition, or
category defaults works inside that page, and so does this one: the rule binds
whoever is holding the pen.

**Read the page, then offer to use it.** One read-only call returns the page's
frames — names, types, and boxes — and it runs without asking, because an offer
has to name what is on the page to be answerable. The yes governs whether the
page shapes the work, not whether the call happens, and it holds for that page
for the rest of the session.

**Other pages are named, not read.** Page names come free, and the finalize
pass already needs them. Contents do not: another page holds superseded versions
and parked ideas, and drifting into one is how a shelved idea gets rebuilt as a
new one. Read another page when the user asks for it or links into it, and give
that reason when declining.

**What the page offers is advisory.** It never overrides a token, a published
component, or the icon set — a page built entirely of raw hex licenses nothing —
and it settles no question on its own. What it does is furnish the best evidence
available about what Pushpin leaves open, which makes departing from a pattern
the page plainly holds to the user's call rather than the agent's. Name every
intended departure in one question before anything is built; three interruptions
mid-build is how a useful checkpoint becomes noise.

[reference/context.md](reference/context.md) has the calls, the phrasing, and
how much to read once the offer is accepted.

## Commands

Seven, and after `init` none of them need typing — the routing table covers the
same ground from plain speech.

| Command | What it does | Reference |
|---|---|---|
| `generate` | Build a layout in Figma from published components and library variables, then audit it for lookalikes | [reference/generate.md](reference/generate.md) |
| `audit` | Run the structural audit against an existing Figma frame: detached instances, drawn lookalikes, fills that should be variable bindings | [reference/generate.md](reference/generate.md) |
| `figma` | Read a design out of Figma into code | [reference/figma.md](reference/figma.md) |
| `check` | Audit a file or directory for off-system values: raw hex matching a base ramp, square corners on interactive elements, non-token spacing, pure-black text | [reference/tokens.md](reference/tokens.md) |
| `init` | Set a project up — stylesheet, Figma keys, browser-phase token checks, an `AGENTS.md` note, and the plugin offer | [below](#setting-a-project-up) |
| `freshness` | Ask how far the capture may have drifted, without capturing anything | [below](#freshness-layers) |
| `refresh` | Check whether the kit has moved since the capture, and update if it has | [below](#refreshing-the-capture) |

`tokens` and `components` are not commands. A token question or a
Figma-to-React mapping question is answered by loading its reference doc, and
routing does that without being asked.

## Routing

| The request sounds like | Capability | Load |
|---|---|---|
| "mock up a booking screen", "add a step to this flow", "make a Figma of this page" | `generate` | [reference/generate.md](reference/generate.md) |
| "does this match Pushpin", "review this frame", is this Figma work on-system | `audit` | [reference/generate.md](reference/generate.md) |
| a figma.com link where code is the goal — "build this screen", "what does this design use" | `figma` | [reference/figma.md](reference/figma.md) |
| "what's our card radius", "which token for a disabled label", anything about dark mode | token question | [reference/tokens.md](reference/tokens.md) |
| "which Thumbprint component is this", building the same UI in React | mapping question | [reference/components.md](reference/components.md) |
| "leave notes on this", documenting a proposed component or an accessibility spec | annotate | [reference/annotate.md](reference/annotate.md) |
| "what else is on this page", "is there more context here", a link that lands next to work already done | grounding | [reference/context.md](reference/context.md) |
| raw hex, square corners, or off-token spacing in a repo | `check` | [reference/tokens.md](reference/tokens.md) |
| "this hex disagrees with the token", "an export says otherwise" | provenance | [reference/provenance.md](reference/provenance.md) |
| "set this repo up for Pushpin", a project with no `pushpin.config.json` | `init` | [below](#setting-a-project-up) |
| "can I trust this", "when was this captured" | `freshness` | [below](#freshness-layers) |
| "Pushpin shipped a release", "the kit moved", `freshness` exited non-zero | `refresh` | [below](#refreshing-the-capture) |

- **Bare `/pushpin`** — a real request meaning "what should I do here?" Answer
  it with a friendly status line and a recommendation, following
  [reference/start.md](reference/start.md).
- **A clear signal** — take it and load the doc in its row. Ask once when two
  rows genuinely fit; when one is plainly stronger, pick it instead of asking.
- **No signal** — ordinary design work under the hard rules below. Once a
  project is initialized, plain speech is the whole interface and nothing here
  needs to be invoked by name.

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
- **No emoji in product UI.** Use the icon set — 227 icons at four sizes, in
  `assets/icons.figma.json`. Never resize one; each size is its own component.
- **Don't introduce new colors.** Every value in the kit is a token.
- **In Figma, instance published components — or propose one. Never imitate.**
  Import the published component by key and instance it. Two cases justify a new
  local component instead: nothing published expresses the interaction without
  lying about its API, or something could be stretched but a new component is
  clearly the better experience. Either way it is a real component definition
  named `Proposed / <Name>`, **derived by detaching the closest published
  component** rather than rebuilt, with its rationale annotated on canvas. A
  drawn pill that looks like a button is still a defect, and strict adherence to
  a young system is its own failure mode. The gate, the derivation, the naming,
  and the annotation are in [reference/generate.md](reference/generate.md).
- **Nothing the design calls for is silently left out.** An asset the system
  cannot supply gets a marked placeholder and an open question, never an
  omission — and a child that could not be resolved never takes its parent with
  it.
- **A library out of reach degrades the run rather than ending it.** Only
  Pushpin itself is load-bearing enough to stop one. Unreachable icons become
  placeholders and unreachable Annotation Kit means notes are drawn instead of
  instanced — both reported, never quietly substituted. Abandoning a screen over
  a library the design never needed is the worse answer.

## Where designs get written

Agent writes to Figma do not enter the user's undo stack, so nothing is edited
in place and no destination is guessed.

- **A link is required** before anything is pushed. Any URL form is accepted —
  file, page, frame, or component — and resolved by traversing the tree. Ask a
  follow-up only if the target is still ambiguous after that.
- **The first pass duplicates.** The resolved frame is copied beside the
  original on the same page with a dated name, and the original is never
  modified. Side by side is the point: old and new compared at a glance.
- **Net-new placement is asked about.** With nothing to duplicate, ask where the
  frame should go rather than choosing.
- **The finalize move is offered, not automatic.** Once the work is accepted,
  offer to move it onto its own page named to the file's conventions.
- **Shared library files are refused** — the Pushpin kit
  (`VVRGrLgkPRU3vs765d5Q3r`), the Annotation Kit (`Qefv6O2RMPSBtSYBrCGcdI`), the
  Thumbprint UI Kit that publishes the icons (`jjhhb3Kp6a7JrtBLCjrf6u`), and any
  file that appears as a subscribed library. Contributing a component to the kit
  goes through a Figma branch and the contribution flow, which this plugin
  documents and does not perform.

[reference/generate.md](reference/generate.md) carries the full order of
operations, including the access preflight that runs before any node is created.

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
| [reference/start.md](reference/start.md) | A bare `/pushpin` with no argument: what to say about freshness, where to start given what is actually present, and the follow-up |
| [reference/generate.md](reference/generate.md) | **Building a layout in Figma.** Where the work gets written, how to place real component instances and bind real variables, when a `Proposed /` component is legal, and how to audit what you built |
| [reference/annotate.md](reference/annotate.md) | Leaving notes on a canvas: arguing a proposed component, or writing an accessibility spec, using published Annotation Kit instances — the nested auto-layout that keeps notes readable beside a specimen of what they describe, and the drawn fallback for when that library is out of reach |
| [reference/context.md](reference/context.md) | **Grounding in the page.** Which calls read a page and in what order, how to phrase the offer, how much to read once it is accepted, and how the gate on other pages is declined |
| [reference/tokens.md](reference/tokens.md) | Choosing a token; need the full vocabulary or the dark-mode story |
| [reference/components.md](reference/components.md) | Building UI in code; mapping Figma components to Thumbprint React |
| [reference/figma.md](reference/figma.md) | Reading a design out of Figma; file keys and library keys |
| [reference/provenance.md](reference/provenance.md) | Something disagrees with these tokens, or the kit changed |

Five generated catalogs back this up, and they exist because none of it is
guessable:

- `assets/components.figma.json` — all 117 published components, their exact
  variant options, and the key to import each one.
- `assets/icons.figma.json` — 227 icons at up to four sizes each, 899 import
  keys. **Icons are published from the Thumbprint UI Kit, not from Pushpin,** and
  deliberately so — one set of glyphs serves both systems. Searching the Pushpin
  library for a caret returns nothing and reads as "no such icon". See
  [reference/generate.md](reference/generate.md).
- `assets/variable-keys.figma.json` — which of the kit's 299 variables can be
  bound from another file (131) and which are hidden from publishing (168).
- `assets/styles.figma.json` — the 13 text styles and 6 effect styles, which are
  the only way to apply Pushpin type and shadow in Figma.
- `assets/annotations.figma.json` — the 91 published Annotation Kit components,
  with each property's exact key. See
  [reference/annotate.md](reference/annotate.md).

Read the catalog rather than working from memory. Button's toggles are named
`👁️ icon (left)` and `👁️ iconRight`, its text property is `Label#13326:0`
rather than `Label`, and its font sizes cannot be bound as variables at all.

## Setting a project up

`init` installs the token stylesheet somewhere idiomatic for the stack it
detects, writes `pushpin.config.json` with the Figma keys so the bridge works
without re-deriving them, adds a short `AGENTS.md` section so an agent opening
the repo later knows the system is in use and outranks its own defaults, and
declares this marketplace in `.claude/settings.json` so the next person to open
the repo is offered the plugin.

```bash
node scripts/init.mjs <project-dir>             # print a plan, change nothing
node scripts/init.mjs <project-dir> --write     # apply it
node scripts/init.mjs <project-dir> --no-share  # skip .claude/settings.json
```

It also writes a `DESIGN.md` and an `.impeccable/design.json` sidecar generated
from the token capture. Together they are the token allowlist that `impeccable`
and other tools reading that format check against, which makes a hardcoded
color, font, radius, or font size report as Pushpin drift **in the browser** —
before the design reaches Figma, where the audit would otherwise be the first
thing to notice. Both files are machine-written and re-generated by `init`; they
are not the place to record a decision.

That is the whole of the integration. `impeccable` has no way to register a rule
and no concept of a component library, so nothing here teaches it about
components, icons, or proposals — the Figma audit still owns all of that. Tokens
are simply the part that can be checked from a stylesheet, and the part most
often got wrong there.

It never overwrites without `--force`, and it is safe to re-run. If it detects
Thumbprint it says so and warns against per-component CSS overrides, which is
the specific failure that made Pushpin hard to reuse in the first place.

The `.claude/settings.json` entry is the distribution path for people who do not
use the CLI. Commit it, and a teammate who opens the repo is prompted to install
Pushpin when they trust the folder — no terminal, no marketplace to find. The
plugin does not load until they accept that prompt, so say so when handing the
repo over. `init` merges into the file rather than replacing it, and leaves it
alone entirely if it cannot be parsed.

## Freshness layers

`freshness` answers in layers and degrades rather than failing when a layer is
out of reach, so it is worth running even with nothing configured.

```bash
node scripts/freshness.mjs                       # capture age; no token, no network
FIGMA_TOKEN=figd_... node scripts/freshness.mjs  # also checks every import key
node scripts/freshness.mjs --max-age 14          # stricter age budget
node scripts/freshness.mjs --offline             # never touch the network
node scripts/freshness.mjs --json                # machine-readable
node scripts/freshness.mjs --strict              # an unreachable layer fails
```

The age layer is the one that matters day to day: it answers "can I trust this?"
with no token, no plan, and no setup. The key layers need a `file_read` token and
answer the sharper question — whether the component and style keys in the Pushpin
catalog, and the Annotation Kit's own component keys, still exist. They matter
because `importComponentByKeyAsync` throws at runtime on
a key that has been unpublished, so a generation script written against a stale
catalog fails halfway through rather than at review. Variables need Enterprise
and are skipped politely without it.

Exit 1 means something moved; follow it with `refresh`.

Freshness answers for the catalog, not for the person running it. Keys belong to
the file and resolve identically for everyone, but access does not — that is what
the generation path's preflight checks.

## Refreshing the capture

Run it when someone mentions a Pushpin release, when a design looks off against
the tokens, or when `freshness` exits non-zero.

0. `node scripts/freshness.mjs` first. If it reports a recent capture and every
   reachable layer passes, there is probably nothing to do — the captures below
   are much more work than the check.
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
node scripts/verify.mjs         # every check including the new hashes
```

6. Add an entry to `../CHANGELOG.md` and bump `version` everywhere it is
   stated — this file's frontmatter, `../.claude-plugin/plugin.json`,
   `../.cursor-plugin/plugin.json`, and the `pushpin` entry in the repo root's
   `.claude-plugin/marketplace.json`. `init.mjs` writes the plugin version into
   every project's `pushpin.config.json`, which is how a project finds out it is
   behind, so a missed bump makes that check silently useless.
7. Commit the JSON, the CSS, and the manifest together. They are one fact about
   one moment; splitting them across commits makes provenance unreadable.

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
node scripts/freshness.mjs          # ask whether Figma has moved underneath it
```

Four different failures, four different checks. `build-css --check` catches a
CSS file that no longer matches its source JSON. `verify.mjs` catches a build
that transformed the JSON wrongly, and — via the manifest hashes — a JSON that
was edited by hand. `freshness.mjs` catches the capture aging out or an import
key disappearing. `diff.mjs` catches, in detail, the JSON no longer matching
Figma.

The first two cannot fail on a stale capture, because they only compare the repo
against itself. That is the gap the last two exist to close, and it is why
`verify.mjs` prints the capture date underneath its pass message.

Re-extracting from Figma is a `use_figma` call. Use
[scripts/check.md](scripts/check.md) to see what moved, and
[scripts/extract.md](scripts/extract.md) for the full re-capture.

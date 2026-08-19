---
name: pushpin
description: Thumbtack's Pushpin design system — tokens, type ramp, components, icons, and the Figma bridge. Use when building, restyling, reviewing, or mocking up Thumbtack interfaces (web, mobile, marketing, prototype), when a design references Pushpin or Thumbprint, and when translating Figma to code or back.
version: 0.10.0
argument-hint: "[generate|audit|figma|check|copy · setup|init|freshness · refresh] [target]"
allowed-tools:
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/check.mjs *)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/copy.mjs *)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/freshness.mjs *)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs *)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/setup.mjs *)
  - Bash(node .pushpin/pushpin-check.mjs *)
---

Pushpin is Thumbtack's current design system — the successor to Thumbprint.
Rounder, softer, pill-first, built on a near-navy brand blue.

**The Figma file is the source of truth.** The tokens, components, styles, and
icons in `assets/` are generated from the Pushpin Thumbprint UI Kit
(`VVRGrLgkPRU3vs765d5Q3r`). Where any other description of Pushpin disagrees
with these tokens — a doc, an exported bundle, a hardcoded hex in an existing
repo — the tokens win, and the disagreement is a bug to fix rather than a
variant to preserve. Copy has a source of its own, captured under the same
discipline. See [reference/provenance.md](reference/provenance.md).

## Start here

Every `node` command in this skill and its reference docs runs a script inside
the skill's own directory, with the working directory left where the user is —
never `cd` into the skill. `${CLAUDE_SKILL_DIR}` is that directory: Claude Code
expands it before you read this, Cursor does not. Where a path still carries an
unexpanded placeholder, or is written relative like `scripts/lookup.mjs`,
substitute the directory you loaded this SKILL.md from.

The first time Pushpin is picked up in a session, before anything consequential:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/freshness.mjs --offline --brief
```

Relay stdout verbatim. Empty output is the expected case — say nothing and
carry on. The script already decided whether a refresh or a re-init would
change what gets built.

If `node` is missing, do not skip the obligation and do not stop. Read
`capturedAt` from `assets/manifest.json`. If the project has a
`pushpin.config.json`, compare `pluginVersion`, `capturedAt`, and `cssHash` to
the plugin's manifest and `.claude-plugin/plugin.json`. Recent and matching
means silence. Old or behind means one sentence in the user's voice, and only
then add that the key checks stay unavailable until Node is installed — for a
designer that is the `.pkg` from nodejs.org, not a terminal session.

That is the whole obligation, and it is stated once. Nothing further down
repeats it. Asking for `/pushpin freshness` still prints the full layer table —
see [reference/maintaining.md](reference/maintaining.md).

## Precedence

Pushpin **is** this project's tokens, component library, and icon set. That
makes it project truth, and project truth is absolute: no other design
authority overrides it.

`impeccable`, `frontend-design`, and `ui-ux-pro-max` sit below it. Their craft
floors, ambition, and category defaults **choose among Pushpin-legal options,
never around them** — none of them outranks a token, a published component, or
the icon set, and extending the system has one legal route: a `Proposed / …`
component, argued on canvas.

**The words are Pushpin's too.** Thumbtack's content design rules are vendored
here beside the tokens, and they govern copy on every surface for the whole
session, with nothing to invoke — [reference/copy.md](reference/copy.md).

What Pushpin leaves open is genuinely open, and those skills decide it. The
tokens do not choose a layout, a hierarchy, or a moment of motion, and deferring
those to Pushpin is as much a mistake as overriding it.

## Which surface

Pushpin governs design on two surfaces — a Figma canvas and a running project —
and almost every phrasing of "make me one of these" fits both. **Settle which
one before routing.** Three things settle it, and nothing else does:

- A figma.com URL anywhere in the conversation, or the request naming Figma, a
  frame, or the canvas — **Figma**.
- An attached or open code file, or a repo holding `pushpin.config.json`, with
  the request phrased about code — **this project, in code and the browser**.
- A token or component question — **neither**, just answer it.

Short of those, ask, in a single `AskQuestion` call before any other tool call:
mock it up in Figma, build it here and check it in the browser, or answer from
the tokens. Add the open-ended option, because the read of the request that got
you here can be wrong too.

**Nothing is searched for**, and **Figma with no link stops and waits.** The
destination is something the user has and you do not, so a search spends minutes
arriving at a guess where a question spends one click arriving at a fact. Do not
create a file, start in a scratch one, or build and offer to move it — see
[Where designs get written](#where-designs-get-written) and
[reference/context.md](reference/context.md).

## Routing

Nine commands, and after `setup` none of them need typing — the left column
covers the same ground from plain speech. Load one doc, not the table.

| The request sounds like | Load |
|---|---|
| "make me a booking screen", "add a step to this flow" — no surface named | ask first, [above](#which-surface) |
| **`generate`** — "mock this up in Figma", or a link to build against | [generate.md](reference/generate.md) |
| **`audit`** — "does this match Pushpin", "review this frame" | [audit.md](reference/audit.md) |
| **`figma`** — a figma.com link where code is the goal, "build this screen" | [figma.md](reference/figma.md) |
| **`check`** — raw hex, square corners, off-token spacing, an undeclared lookalike, or off-guideline copy in a repo | [tokens.md](reference/tokens.md) |
| **`copy`** — text pasted in, a draft file, or the words on a frame | [copy.md](reference/copy.md) |
| **`setup`** — "set this repo up", "start a project", no `pushpin.config.json`. Once per project | [setup.md](reference/setup.md) |
| **`init`** — re-run, repair, or update a project already set up | [init.md](reference/init.md) |
| **`freshness`** — "can I trust this", "when was this captured" | [maintaining.md](reference/maintaining.md) |
| **`refresh`** — "Pushpin shipped a release", the kit moved, `freshness` exited non-zero | [maintaining.md](reference/maintaining.md) |
| "what's our card radius", "which token for a disabled label", dark mode | [tokens.md](reference/tokens.md) |
| "which Thumbprint component is this", building the same UI in React | [components.md](reference/components.md) |
| "does this sound like us", "check this copy", a label that reads wrong | [copy.md](reference/copy.md) |
| nothing published fits — proposing a new component | [propose.md](reference/propose.md) |
| "leave notes on this", an accessibility spec | [annotate.md](reference/annotate.md) |
| an Annotation Kit import failed | [annotate-fallback.md](reference/annotate-fallback.md) |
| "what else is on this page", a link landing beside work already done | [context.md](reference/context.md) |
| "this hex disagrees with the token", "an export says otherwise" | [provenance.md](reference/provenance.md) |
| **about to write UI**, on either surface | [rules.md](reference/rules.md) |
| bare `/pushpin` — a real request meaning "what should I do here?" | [start.md](reference/start.md) |

- **A clear signal** — take it and load the doc in its row. Ask once when two
  rows genuinely fit; when one is plainly stronger, pick it instead of asking.
- **No signal** — ordinary design work under the hard rules below, on whichever
  surface [Which surface](#which-surface) settled. No signal is not a licence to
  pick one. Once a project is set up, plain speech is the whole interface and
  nothing here needs to be invoked by name.

## Using it in a project

Link the generated stylesheet, then build with the custom properties:

```html
<link rel="stylesheet" href="pushpin.css">
```

`assets/pushpin.css` defines 300 custom properties across colors (light and
dark), spacing, radius, the type ramp, elevation, motion, and breakpoints, plus
`.pp-*` type utilities. No dependencies and no build step.

**A project that has been set up serves itself.** `init` records a preview port,
and the edit hook restarts the server whenever an edit finds it stopped —
detached, so it survives the turn, with caching off so a reload cannot answer
from the file that was just changed. Do not start a second server, and do not
kill whatever holds the port. `node .pushpin/pushpin-check.mjs --preview` brings
it up without editing anything. A project with a dev server of its own keeps it;
Pushpin only reports when nothing is answering. See
[reference/init.md](reference/init.md) § The preview.

**Names mirror Figma variable paths with `/` replaced by `-`** — the variable
`background/brand/strong` is `--pp-background-brand-strong`. That is a hard rule
of the generator, so any value in a build traces back to the kit by name alone,
and a missing token is a real gap rather than a naming mismatch. The full
vocabulary, the type ramp, and the dark-mode story are in
[reference/tokens.md](reference/tokens.md).

For a React project already on Thumbprint components, these are the same
semantic tokens Thumbprint v2 emits as `--tp-*`; see
[reference/components.md](reference/components.md) before adding overrides.

## Hard rules

The five broken most often. **Load [reference/rules.md](reference/rules.md)
before writing UI** — it has the rest, including what to do when the kit falls
short and when a library is out of reach.

- **Pill-first.** Buttons, inputs, chips, and search bars use
  `--pp-radius-sides`. No square corners on interactive elements.
- **The signature contrast.** `--pp-background-brand-strong` (near-navy
  `#07344a`) with `--pp-text-on-brand-strong` (cyan `#7cdcfd`) as its label,
  for the single most important action on a screen and nothing else.
- **Body text is `--pp-text-neutral-default`** (`#1f2022`), never pure black.
- **Don't introduce new colors.** Every value in the kit is a token.
- **Never imitate a published component.** In Figma, instance it or propose one
  — [reference/propose.md](reference/propose.md). In code, declare what
  hand-rolled markup stands in for.

## Where designs get written

Agent writes to Figma do not enter the user's undo stack, so nothing is edited
in place and no destination is guessed.

**A link is required** before anything is pushed. **Shared library files are
refused** — the Pushpin kit (`VVRGrLgkPRU3vs765d5Q3r`), the Annotation Kit
(`Qefv6O2RMPSBtSYBrCGcdI`), the Thumbprint UI Kit that publishes the icons
(`jjhhb3Kp6a7JrtBLCjrf6u`), and any subscribed library.

[reference/generate.md](reference/generate.md) has the rest: duplicate beside
the original, offer finalize, ask where net-new goes, and the access preflight.

## Looking something up

Property names, variant options, and import keys are not guessable, and the
catalogs that hold them are large. **Ask for the one entry; never read the
file.**

```bash
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs Button          # component: every property, its exact key, the import key
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs Button,Card,Toast   # several at once — commas, one call
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs --icon caret    # icon: one import key per size
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs --token radius  # token: custom property, value, and whether it binds
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs --style title-1 # the text and effect style keys
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs --annotation a11y
node ${CLAUDE_SKILL_DIR}/scripts/lookup.mjs --copy pro      # copy rule: a length limit, a preferred term, a banned phrase
```

**A layout needs a dozen of these — comma-separate them and ask once.** Terms are
split on commas, not spaces, so `Icon Button` stays one name and needs no quoting.
Each term gets its own section, and one that matches nothing says so instead of
being dropped.

It searches every catalog unless narrowed, takes a Figma name or a `--pp-*`
custom property, and answers a near-miss with the real names — which matters,
because `Button`, `Icon Button`, and `Brand / App / Download Buttons` are three
different entries.

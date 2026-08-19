# Pushpin Design System

Thumbtack's Pushpin design system as a plugin for Claude Code and Cursor: the
tokens, the type ramp, every published Figma component, the icon set, and
scripts that move a design between Figma and code.

## Prerequisites

- **Node 18+.** macOS ships no version of it. Download the macOS installer from
  [nodejs.org](https://nodejs.org), open the `.pkg`, enter your Mac password.
- **Claude Code (a terminal or the Claude desktop app) or Cursor.**
- **Figma's MCP server, connected to that agent.**
- **The Pushpin Thumbprint UI Kit and the Annotation Kit, both enabled in the
  Figma file you're working in.** Most product files don't subscribe to the
  Annotation Kit.
- **The Thumbtack Rise font.** Without it, generated text renders in a fallback.

## Install

### Claude Code

Run this in a terminal, or in the Claude Code tab of the Claude desktop app:

```bash
claude plugin marketplace add https://github.com/johnwilliams-tt/skills.git --sparse .claude-plugin pushpin && claude plugin install pushpin@johnwilliams-skills
```

Check it landed:

```bash
claude plugin list
```

It should show `pushpin@johnwilliams-skills`. `pushpin@skills-dir` means the
plugin was copied in as a folder and will never update.

Turn auto-update on: add `"autoUpdate": true` to the `johnwilliams-skills` entry
in `~/.claude/settings.json`. It is off by default, and an install that never
updates drifts away from the Figma kit. A project set up by `/pushpin setup`
already has it on. Without it, update by hand, then restart:

```bash
claude plugin update pushpin@johnwilliams-skills
```

Opening a project a teammate already set up prompts you to install Pushpin.
Accept it.

If the command won't run, paste this at any Claude Code agent:

```
Install the Pushpin plugin from the marketplace at
https://github.com/johnwilliams-tt/skills — add that repo as a plugin
marketplace, then install the plugin `pushpin@johnwilliams-skills` from it. Do
not clone the repo or copy files into ~/.claude/skills. When you're done, run
`claude plugin list` and show me the output.
```

### Cursor

1. Open **Dashboard → Plugins**, and under **Team Marketplaces** choose **Add
   Marketplace**, then **Import from Repo**.
2. Give it `https://github.com/johnwilliams-tt/skills`.
3. Install Pushpin from **Customize** in the sidebar.

If your team already imported the repository, go straight to step 3. Adding a
team marketplace needs a Teams or Enterprise plan, and on Enterprise only an
administrator can add one.

**Enable Auto Refresh**, so new captures reach the team without anyone
reinstalling. It needs the Cursor GitHub App on the repository.

To load it off disk instead:

```bash
git clone https://github.com/johnwilliams-tt/skills.git
ln -s "$PWD/skills/pushpin" ~/.cursor/plugins/local/pushpin
```

Then restart Cursor, or run **Developer: Reload Window**.

## Set up a project

Run `/pushpin setup` in the project. It asks only what it can't detect — on a
fresh folder, nothing — and writes the token stylesheet, `pushpin.config.json`,
`DESIGN.md`, an `AGENTS.md` section, and an edit hook.

Commit `.claude/settings.json`. It offers Pushpin to anyone who opens the
project, and the plugin stays unloaded until they accept.

From then on, the edit hook flags raw hex, off-scale spacing, square controls,
and markup posing as a published component as you write. It reports and never
blocks.

Run `/pushpin init` to re-run, repair, or update a project already set up.

## Use it

Ask in plain speech — "mock up a booking screen", "does this frame match
Pushpin", "build this design" with a Figma link, "check this repo". The commands
are shortcuts for the same routes:

| Command | |
|---|---|
| `/pushpin setup` | Set a project up, start to finish |
| `/pushpin init` | Re-run, repair, or update a project already set up |
| `/pushpin generate` | Build a screen in Figma from published components |
| `/pushpin audit` | Review a Figma frame for detached instances and drawn lookalikes |
| `/pushpin figma` | Turn a Figma design into code, mapped to tokens |
| `/pushpin check` | Find off-system values in code |
| `/pushpin freshness` | Report how old the capture is |
| `/pushpin refresh` | Update the capture when the kit moves |

## Scripts

Run from `pushpin/` in a checkout of this repo. `<dir>` is the project you're
pointing them at.

```bash
node pushpin/scripts/lookup.mjs Button        # one catalog entry: properties, keys, import key
node pushpin/scripts/lookup.mjs --icon caret  # one import key per icon size
node pushpin/scripts/check.mjs <dir>          # off-system values in code
node pushpin/scripts/freshness.mjs            # capture age, layer by layer
node pushpin/scripts/setup.mjs <dir> --verify # what a project actually has
node pushpin/scripts/init.mjs <dir> --write   # set up, repair, or update a project
node pushpin/scripts/preview.mjs --root <dir> # serve a prototype with caching off
```

A project that has been set up does not need that last one: the edit hook starts
the preview and restarts it whenever it has stopped. Run
`node .pushpin/pushpin-check.mjs --preview` inside the project to bring it up
without editing a file first.

## Project layout

| Path | |
|---|---|
| `pushpin/SKILL.md` | Entry point the agent loads, and the routing table |
| `pushpin/reference/` | The docs each route loads |
| `pushpin/scripts/` | CLI scripts, the edit hook, and the capture toolchain |
| `pushpin/assets/` | Generated capture: 300 custom properties, 117 components, 227 icons |

## Reference docs

| Doc | What's in it |
|---|---|
| [`reference/rules.md`](pushpin/reference/rules.md) | The complete hard rules, and how to decide a case they don't name. |
| [`reference/generate.md`](pushpin/reference/generate.md) | Building Figma layouts from real instances: placing, binding, icons, and where work gets written. |
| [`reference/audit.md`](pushpin/reference/audit.md) | Checking a frame is what it looks like — detached instances, drawn lookalikes, literal fills, resized icons. |
| [`reference/propose.md`](pushpin/reference/propose.md) | When the kit falls short: the gate, deriving rather than rebuilding, and the note that argues the case. |
| [`reference/annotate.md`](pushpin/reference/annotate.md) | Annotation types, the note format, and the auto-layout that keeps notes readable. |
| [`reference/annotate-fallback.md`](pushpin/reference/annotate-fallback.md) | What to draw when an Annotation Kit import fails, and how it is reported. |
| [`reference/context.md`](pushpin/reference/context.md) | Grounding work in the page a link resolved to. |
| [`reference/tokens.md`](pushpin/reference/tokens.md) | The token vocabulary, choosing between tokens, and what `check` reports. |
| [`reference/components.md`](pushpin/reference/components.md) | Kit inventory, the Thumbprint React map, and the class-name fallback for designs with no Code Connect. |
| [`reference/figma.md`](pushpin/reference/figma.md) | File keys, library keys, workflow directions, and the state of Code Connect. |
| [`reference/provenance.md`](pushpin/reference/provenance.md) | What is authoritative and what isn't. |
| [`reference/setup.md`](pushpin/reference/setup.md) | Guided first-time setup: what to ask, what to run, what to verify. |
| [`reference/init.md`](pushpin/reference/init.md) | The mechanical half, the hooks, and how the generated files are protected. |
| [`reference/maintaining.md`](pushpin/reference/maintaining.md) | Freshness layers, refreshing the capture, regenerating assets. |

## Gotchas

- **Never run `/impeccable document` on a project set up with Pushpin.** It
  replaces `DESIGN.md` and `.impeccable/design.json` with an invented design
  system. Restore them with `init --write --force`, which reproduces them
  exactly.
- **Component, property, and variant names are case-sensitive and not
  guessable.** `Button`, `Icon Button`, and `Brand / App / Download Buttons` are
  three different entries. Use `lookup.mjs` rather than reading the catalogs.
- **`/pushpin setup` pre-approves its own read-only scripts**, so Claude Code
  stops asking before every catalog lookup. Keep `.claude/settings.local.json`
  out of git — it names paths on one machine — and run `/pushpin init` after a
  plugin update.
- **Nothing in `pushpin/assets/` is hand-written.** It is captured from the
  Figma kit. Refresh it per
  [`reference/maintaining.md`](pushpin/reference/maintaining.md); every refresh
  lands in [`CHANGELOG.md`](CHANGELOG.md).

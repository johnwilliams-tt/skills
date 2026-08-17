# Pushpin Design System

Thumbtack's Pushpin design system as a plugin for Claude Code and Cursor: the
tokens, the type ramp, every published Figma component, the icon set, and
scripts that move a design between Figma and code.

## Prerequisites

- **Node 18+.** macOS ships no version of it. Download the macOS installer from
  [nodejs.org](https://nodejs.org), open the `.pkg`, enter your Mac password.
  Homebrew, `nvm`, `fnm`, and `mise` work too. The plugin has no dependencies
  and builds nothing.
- **Claude Code or Cursor.**
- **Figma's MCP server, connected to that agent.** Every Figma read and write
  goes through it.
- **Two Figma libraries, enabled in the file you're working in** — the Pushpin
  Thumbprint UI Kit and the Annotation Kit. Most product files don't subscribe
  to the Annotation Kit; the plugin checks both before it builds anything.
- **The Thumbtack Rise font.** Without it, generated text renders in a fallback.

## Install

### Claude Code

```
/plugin marketplace add johnwilliams-tt/skills
/plugin install pushpin@johnwilliams-skills
```

That clones every plugin in the repo. To take only Pushpin:

```bash
claude plugin marketplace add johnwilliams-tt/skills --sparse .claude-plugin pushpin
claude plugin install pushpin@johnwilliams-skills
```

Either way, updates install themselves at startup.

### Cursor

If your team already imported this repository as a marketplace, install Pushpin
from **Customize** in the sidebar. To import it yourself:

1. Open **Dashboard → Plugins**, and under **Team Marketplaces** choose **Add
   Marketplace**, then **Import from Repo**.
2. Give it `https://github.com/johnwilliams-tt/skills`.
3. Install Pushpin from **Customize**.

**Enable Auto Refresh** sends new captures to the team without anyone
reinstalling. Team marketplaces need a Teams or Enterprise plan, on Enterprise
only an administrator can add one, and Auto Refresh needs the Cursor GitHub App
on the repository.

To load it off disk instead:

```bash
git clone https://github.com/johnwilliams-tt/skills.git
ln -s "$PWD/skills/pushpin" ~/.cursor/plugins/local/pushpin
```

Then restart Cursor, or run **Developer: Reload Window**.

## Set up a project

Run `/pushpin setup` in the project. It reads the project, asks only what it
can't detect, and writes the token stylesheet, `pushpin.config.json`,
`DESIGN.md`, `.impeccable/design.json`, an `AGENTS.md` section, and an edit
hook. It then hands off to `impeccable` for `PRODUCT.md`:

```
/impeccable init        # PRODUCT.md only — Pushpin does not write product truth
```

For a re-run, a repair, or an update, run `init` directly. It prints a plan and
changes nothing until you pass `--write`:

```bash
node pushpin/scripts/init.mjs ~/Projects/some-app
node pushpin/scripts/init.mjs ~/Projects/some-app --write
```

Files that already exist are left alone unless you add `--force`. `--no-hook`
skips the edit hook, which flags raw hex, off-scale spacing, square controls,
and markup posing as a published component; it reports and never blocks. The
exception is a Cursor write guard that blocks replacement of `DESIGN.md` and
`.impeccable/design.json`.

To see what a project actually has:

```bash
node pushpin/scripts/setup.mjs ~/Projects/some-app --verify
```

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

Run from a checkout of this repo.

```bash
node pushpin/scripts/lookup.mjs Button        # one catalog entry: properties, keys, import key
node pushpin/scripts/lookup.mjs --icon caret  # one import key per icon size
node pushpin/scripts/check.mjs src/           # off-system values in code
node pushpin/scripts/freshness.mjs            # capture age, layer by layer
node pushpin/scripts/setup.mjs <dir> --verify # what a project actually has
node pushpin/scripts/init.mjs <dir> --write   # set up, repair, or update a project
```

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
- **`init` refuses to run against this repo.** Point it at the project that
  consumes Pushpin.
- **Nothing in `pushpin/assets/` is hand-written.** It is captured from the
  Figma kit per [`scripts/extract.md`](pushpin/scripts/extract.md) and
  transformed deterministically. Refresh it per
  [`reference/maintaining.md`](pushpin/reference/maintaining.md); every refresh
  lands in [`CHANGELOG.md`](CHANGELOG.md).

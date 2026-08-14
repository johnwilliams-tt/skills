# pushpin

**Describe a screen, get it built in Figma out of real Pushpin components — not
rectangles that look like them.**

Thumbtack's Pushpin design system, packaged as a skill your agent can pick up. It
knows the tokens, the type ramp, every published component, and how to move a
design between Figma and code in either direction. The point is to make Pushpin
the **cheapest thing to reach for**, so using the right token is less work than
inventing a value.

## What it does

| Ask for | What happens |
|---|---|
| "Mock up a booking screen" | Builds it in Figma from real published components, then audits its own output for lookalikes. |
| "Does this frame match Pushpin?" | Reads a frame you already have and reports what only looks like Pushpin — detached instances, drawn buttons, fills that should be variable bindings. |
| "Build this design" + a Figma link | Reads the design out of Figma and turns it into code, mapped to tokens rather than raw hex. |
| "Check this repo" | Scans code for off-system values: raw hex matching a base ramp, square corners on interactive elements, spacing off the scale, pure-black text. |

Plain speech is the whole interface. There are [seven commands](#commands) if you
prefer typing them, but nothing requires you to.

## Before you start

All one-time. The two Figma items are the ones people miss, and both surface at
the moment you first try to generate something.

- **An agent that supports plugins** — Claude Code or Cursor.
- **Figma's MCP server, connected to that agent.** Every Figma read and write
  goes through it, so without it the Figma commands cannot run at all. This is
  the most common reason a first attempt fails.
- **Access to two Figma libraries,** both enabled in the file you're working in:
  the Pushpin Thumbprint UI Kit and the Annotation Kit. Most product files don't
  subscribe to the Annotation Kit yet. The plugin checks both before it creates
  anything, so a missing one is a clear message rather than a half-built screen.
- **The Thumbtack Rise font installed locally,** or generated text renders in a
  fallback. Neither the font nor the icon set is vendored here, so `init` does
  not install them.
- **Node.js** (`brew install node`) — once per session, not just at setup. Before
  anything consequential, the skill checks how old its Figma capture is. A
  current capture produces no line; a stale one does.

## Install

### Claude Code

```
/plugin marketplace add johnwilliams-tt/skills
/plugin install pushpin@johnwilliams-skills
```

This repository holds several plugins, so that clones all of them. From the
terminal you can take only what Pushpin needs, which matters on a slow
connection because every git operation is capped at 120 seconds:

```bash
claude plugin marketplace add johnwilliams-tt/skills --sparse .claude-plugin pushpin
claude plugin install pushpin@johnwilliams-skills
```

Updates arrive on their own either way — Claude Code refreshes the marketplace
in the background at startup and installs a new version when the number moves.

### Cursor

If your team has already imported this repository as a marketplace, install
Pushpin from **Customize** in the sidebar and you're done.

To import it yourself, the repo root carries a `.cursor-plugin/marketplace.json`:

1. Open **Dashboard → Plugins**, and under **Team Marketplaces** choose **Add
   Marketplace**, then **Import from Repo**.
2. Give it `https://github.com/johnwilliams-tt/skills`.
3. Install Pushpin from **Customize**.

Turning on **Enable Auto Refresh** means a new capture reaches the team without
anyone reinstalling. Team marketplaces need a Teams or Enterprise plan, on
Enterprise only an administrator can add one, and Auto Refresh needs the Cursor
GitHub App on the repository.

No marketplace, or working on an unpublished checkout? Load the plugin off disk —
the plugin directory ships its own `.cursor-plugin/plugin.json`:

```bash
git clone https://github.com/johnwilliams-tt/skills.git
ln -s "$PWD/skills/pushpin" ~/.cursor/plugins/local/pushpin
```

Then restart Cursor, or run **Developer: Reload Window**.

## Commands

Shortcuts for the four capabilities above, plus three for setup and upkeep. After
`init` none of them need typing — "does this match Pushpin" routes to `audit` on
its own.

| Command | |
|---|---|
| `/pushpin generate` | Build a screen in Figma |
| `/pushpin audit` | Review a Figma frame you already have |
| `/pushpin figma` | Turn a Figma design into code |
| `/pushpin check` | Find off-system values in code |
| `/pushpin init` | Set a project up |
| `/pushpin freshness` | Ask how old the capture is |
| `/pushpin refresh` | Update the capture when the kit moves |

`init` is once per project. It prints a plan and changes nothing until you pass
`--write`:

```bash
node pushpin/scripts/init.mjs ~/Projects/some-app
node pushpin/scripts/init.mjs ~/Projects/some-app --write
```

Re-running on a project already set up reports whether that project has fallen
behind. Later agent sessions do not re-run it; they pin-check on pickup and
speak only when it is behind.

`init` also installs an edit hook that runs `check.mjs` on each file you write,
reporting raw hex, off-scale spacing, a control that is not a pill, and markup
that reads as a published component while declaring nothing. It reports and
never blocks. Skip it with `--no-hook`.

Two scripts are useful on their own:

```bash
node pushpin/scripts/lookup.mjs Button        # one catalog entry, not the 97 KB file
node pushpin/scripts/check.mjs src/           # what is off-system here
```

`lookup.mjs` exists because component names, property names, and variant options
are case-sensitive and not guessable — `Button`, `Icon Button`, and
`Brand / App / Download Buttons` are three different entries — and reading a
whole catalog to find one of them costs about a hundred times what the answer is
worth.

### Onboarding, in order

`init` also writes a `DESIGN.md` and an `.impeccable/design.json` that project
Pushpin into the format the `impeccable` skill reads, so drift is caught in the
browser rather than at the Figma push. Assuming impeccable is installed, run
these three once per project and in this order:

```bash
node pushpin/scripts/init.mjs ~/Projects/some-app --write
# then, in the project:
/impeccable init        # PRODUCT.md only — Pushpin does not write product truth
/impeccable hooks on    # what makes the detector run per edit
```

Impeccable last is what keeps the two hooks from saying the same thing twice:
where Pushpin's check finds impeccable already reporting token findings live, it
drops its own and keeps only the component ones, which impeccable cannot make.

Both generated files are machine-written. `/impeccable document` would replace
them with an invented design system, so `AGENTS.md` tells agents not to, and the
fix for a staleness flag on either is `pushpin init --write --force`.

## Reference docs

| Doc | What's in it |
|---|---|
| [`reference/rules.md`](pushpin/reference/rules.md) | The complete hard rules, and the reasoning that makes each one decidable in a case it does not name. |
| [`reference/generate.md`](pushpin/reference/generate.md) | Building Figma layouts from real instances: placing, binding, icons, and where the work gets written. |
| [`reference/audit.md`](pushpin/reference/audit.md) | Checking a frame is what it looks like — detached instances, drawn lookalikes, literal fills, resized icons. |
| [`reference/propose.md`](pushpin/reference/propose.md) | When the kit genuinely falls short: the gate, deriving rather than rebuilding, and the note that argues the case. |
| [`reference/annotate.md`](pushpin/reference/annotate.md) | Annotation types, the note format, and the auto-layout that keeps notes readable. |
| [`reference/annotate-fallback.md`](pushpin/reference/annotate-fallback.md) | Only when an Annotation Kit import has failed: what to draw instead, and how it is reported. |
| [`reference/context.md`](pushpin/reference/context.md) | Grounding work in the page a link resolved to: which calls read a page, how the offer is phrased, and why other pages stay closed. |
| [`reference/tokens.md`](pushpin/reference/tokens.md) | The token vocabulary, how to choose between tokens, and what `check` reports. |
| [`reference/components.md`](pushpin/reference/components.md) | Kit inventory, the Thumbprint React map, and the class-name fallback for designs with no Code Connect. |
| [`reference/figma.md`](pushpin/reference/figma.md) | File keys, library keys, workflow directions, and the state of Code Connect. |
| [`reference/provenance.md`](pushpin/reference/provenance.md) | What is authoritative, what isn't, and why. |
| [`reference/init.md`](pushpin/reference/init.md) | Setting a project up. Once per project; later sessions only pin-check. |
| [`reference/maintaining.md`](pushpin/reference/maintaining.md) | Freshness layers, refreshing the capture, regenerating assets. |

## For maintainers

Nothing in `assets/` is written by hand — it is captured from the Figma kit per
[`scripts/extract.md`](pushpin/scripts/extract.md) and transformed
deterministically, which is why a value in a rendered page traces back to the kit
by name alone. [`reference/provenance.md`](pushpin/reference/provenance.md) argues
why that matters, and [`reference/maintaining.md`](pushpin/reference/maintaining.md)
documents the checks, the freshness layers, and how to refresh a capture. Every
refresh lands in [`CHANGELOG.md`](CHANGELOG.md).

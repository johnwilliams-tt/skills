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
  anything consequential, the skill checks how old its Figma capture is and tells
  you, and that check is a script.

## Install

### Claude Code

```
/plugin marketplace add johnwilliams-tt/skills
/plugin install pushpin@johnwilliams-skills
```

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

`init` prints a plan and changes nothing until you pass `--write`:

```bash
node pushpin/scripts/init.mjs ~/Projects/some-app
node pushpin/scripts/init.mjs ~/Projects/some-app --write
```

It is safe to re-run, and re-running on a project already set up reports whether
that project has fallen behind.

## Reference docs

| Doc | What's in it |
|---|---|
| [`reference/generate.md`](pushpin/reference/generate.md) | Building Figma layouts from real instances, and auditing that you did. |
| [`reference/annotate.md`](pushpin/reference/annotate.md) | Annotation types, the note format, and where notes go on the canvas. |
| [`reference/tokens.md`](pushpin/reference/tokens.md) | The token vocabulary and how to choose between tokens. |
| [`reference/components.md`](pushpin/reference/components.md) | Kit inventory, the Thumbprint React map, and the class-name fallback for designs with no Code Connect. |
| [`reference/figma.md`](pushpin/reference/figma.md) | File keys, library keys, workflow directions, and the state of Code Connect. |
| [`reference/provenance.md`](pushpin/reference/provenance.md) | What is authoritative, what isn't, and why. |

## For maintainers

Nothing in `assets/` is written by hand — it is captured from the Figma kit per
[`scripts/extract.md`](pushpin/scripts/extract.md) and transformed
deterministically, which is why a value in a rendered page traces back to the kit
by name alone. [`reference/provenance.md`](pushpin/reference/provenance.md) argues
why that matters, and [`pushpin/SKILL.md`](pushpin/SKILL.md) documents the checks,
the freshness layers, and how to refresh a capture. Every refresh lands in
[`CHANGELOG.md`](CHANGELOG.md).

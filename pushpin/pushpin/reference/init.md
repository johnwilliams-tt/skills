# Setting a project up

**For a project's first time, use [setup.md](setup.md).** `/pushpin setup` asks
what it cannot detect, runs this, and then checks what is actually true. `init`
is the mechanical half of that, and the right call on its own for a re-run, a
repair, or an update after the plugin moves.

**It repairs the plumbing and reconciles nothing.** The stylesheet, the
generated files and the pin are all it looks at; the components the project
actually declares are held against the catalog by
[update.md](update.md), which is the other half of an update after the plugin
moves and the one a `catalog` finding hands over.

`init` is once per project, not once per agent. The marker is
`pushpin.config.json`. A later session does not re-run this; it pin-checks on
pickup via `freshness.mjs --session`, repairs a missing or misdirected
edit hook with a plain `--write` and says nothing about it, and speaks only when
the pin is behind in a way that needs a file replaced — and then as a plain
yes/no, never as this command:
[start.md](start.md#a-say-that-names-a-command).

It installs the token stylesheet somewhere idiomatic for the stack it detects,
writes `pushpin.config.json` with the Figma keys so the bridge works without
re-deriving them, installs the edit hook that runs `check.mjs`, records where
the browser preview lives, pre-approves the scripts that only read so they stop
asking, adds a short `AGENTS.md` section so an agent opening the repo later
knows the system is in use and outranks its own defaults, and declares this
marketplace in `.claude/settings.json`, with auto-update on, so the next person
to open the repo is offered the plugin and nobody ends up pinned to a capture
that has stopped matching the kit.

```bash
node scripts/init.mjs <project-dir>                    # print a plan, change nothing
node scripts/init.mjs <project-dir> --write            # apply it
node scripts/init.mjs <project-dir> --force            # replace files that already exist
node scripts/init.mjs <project-dir> --css-path <p>     # put the stylesheet somewhere else
node scripts/init.mjs <project-dir> --no-share         # skip .claude/settings.json
node scripts/init.mjs <project-dir> --no-hook          # skip the edit hook
node scripts/init.mjs <project-dir> --no-preview       # skip the browser preview
node scripts/init.mjs <project-dir> --preview-port 8200  # serve the static preview on this port
node scripts/init.mjs <project-dir> --advice           # explain what was written
```

## The edit hook

`check.mjs` runs on every edit to a stylesheet or component file and reports
what is off-system in the file that was just written — a raw hex, a control
that is not a pill, markup that reads as a published component while declaring
nothing, a button that says `Learn more`. It reports and never blocks; every
failure path exits 0.

This is what lets `SKILL.md` carry five hard rules instead of eleven. A rule the
model has to still be holding in context is a rule that decays over a long
session; a rule a script re-states on the edit that broke it does not.

Two manifests, merged rather than replaced:

| Harness | File | Event | Hook |
|---|---|---|---|
| Cursor | `.cursor/hooks.json` | `afterFileEdit` | edit check |
| Cursor | `.cursor/hooks.json` | `preToolUse` | write guard |
| Claude Code | `.claude/settings.local.json` | `PostToolUse` on `Edit\|Write\|MultiEdit` | edit check |

What they name is `.pushpin/pushpin-check.mjs` in the project, not this plugin.
The plugin lives in a directory named after its version — a commit hash under
Cursor, a semver under Claude Code — and Cursor keeps exactly one, deleting the
old one when it updates itself. A manifest naming the plugin directly therefore
stops resolving on the next update, and because hooks fail open, the check goes
silent rather than failing. The shim does not move, and locates the installed
plugin at run time: `PUSHPIN_SKILL_DIR` if set, then the `pluginPath` recorded in
`pushpin.config.json`, then a search of both hosts' plugin caches, newest first.
The guard reaches the plugin through the same shim, called with `--guard`, so a
project keeps one file current instead of two and one filename still identifies
every hook of ours.

Both manifests are still machine-local, because the path into the project is
absolute: correct for whoever ran `init`, meaningless to anyone else. A teammate
without the plugin gets a shim that finds nothing and exits 0 in silence, so the
worst case is a hook that does nothing.

**Add `.claude/settings.local.json` to the project's `.gitignore` yourself.**
Nothing does it for you. Claude Code labels that settings scope "project,
gitignored", which reads like a guarantee but only describes what the scope is
for; it never writes the entry, and neither does `init`. The file holds the allow
rules as well as the hook, and those name this plugin's install by full path, so a
committed copy points every teammate at a directory on somebody else's disk.
Nothing breaks loudly when that happens — a rule matching nothing grants nothing,
and a hook path that does not resolve fails open — which is why it is worth doing
deliberately instead of discovering later.

Installing and repairing are one operation. Prior entries of ours are dropped
before the current one is added, so a re-run cannot stack duplicates, and a
manifest naming anything other than the current shim is repointed **without
`--force`** — a command aimed at a deleted directory is not a decision worth
preserving.

`pushpin.config.json` records whether the hook was *wanted*, not whether it is
installed: the manifests answer that themselves, and a recorded claim about files
another tool also edits can go stale. `checkHook: false` is the one thing they
cannot express — a deliberate `--no-hook` — and it is respected in silence.
Everything else is read from the manifests, so a session-start check can tell a
project that predates the hook from one whose hook has quietly stopped working.

## The preview

A prototype server started as an agent's shell job dies with that job — when the
turn is interrupted, when the terminal is torn down, when someone hits stop.
Nothing notices, so the next edit lands against a page that cannot be reloaded,
and the reasonable repair is to start a second copy on the same port and race
the first. The failure is cheap to cause and expensive to read: the page looks
broken in a way that resembles the edit not working.

So the same hook that reports off-system values also asks whether the preview is
answering, and starts it when it is not. It rides along inside the edit check
rather than as a second manifest entry, which means a project that already
installed the hook gets this without re-running anything.

What it starts is `scripts/preview.mjs`: a static server on loopback with
`Cache-Control: no-store` on every response. That header is the point of
shipping a server at all. `python3 -m http.server` sends `Last-Modified` and no
`Cache-Control`, which leaves the browser free to guess a freshness lifetime
from the file's age and answer a reload from its own copy of a file that has
since changed — so the page runs an old build while the source on screen says
otherwise, and the next fix is aimed at the wrong thing.

`preview` in `pushpin.config.json` records the decision:

| The project | What is recorded | What happens |
|---|---|---|
| A flat prototype, no `dev` script | `{ port, root, autostart: true }` | Pushpin serves it and restarts it |
| Its own dev server — `next dev`, `vite`, any `dev` script | `{ port, command, autostart: false }` | Pushpin says when nothing answers, and starts nothing |
| `--no-preview` | `false` | Nothing, in silence |
| Set up before this existed | the key is absent | Nothing, until `init --write --force` records it |

**A framework's dev server is not Pushpin's to run.** Those already watch and
reload, and starting someone's `next dev` detached, out of sight of the terminal
they expect it in, is not a design system's business. `--preview-port` overrides
the detection where the static preview is wanted anyway.

Detached is what makes it survive: the server is spawned in its own session and
reparented, so nothing that cleans up after the hook, the turn, or the terminal
can reach it. Two edits landing together take a lock in `.pushpin/`, so a burst
starts one server rather than a race.

**Nothing holding the port is ever killed.** A port answering something that is
not this project's preview — another tool, or a preview of a different directory
— is reported with the remedy (`--preview-port`) and left alone. Killing a
process the plugin did not start is not a recovery anyone asked for.

Add `.pushpin/preview.log`, `.pushpin/preview.pid` and `.pushpin/remote/` to
`.gitignore`; they are this machine's — the last is the session check's cached
copy of the plugin repository's `plugin.json` and `kit-state.json`. To bring the
preview up without editing anything:

```bash
node .pushpin/pushpin-check.mjs --preview
```

That is the project shim again, with a third role beside the check and the
guard, so a project still keeps one file current rather than three.

## The permission prompts

Claude Code asks before every shell command outside its own built-in read-only
set, and `node` is not in that set — so `lookup.mjs` asked once per call, a dozen
times while one layout was built, and setup asked for a run of approvals in the
first five minutes. **`Accept edits` does not help.** It auto-approves file edits
and a fixed list of filesystem commands; every other shell command still prompts.
A designer reading that as a sign something is wrong is reading it correctly.

`init` writes an allow rule per project script into
`.claude/settings.local.json`:

| Script | What it does |
|---|---|
| `check.mjs` | reports what is off-system in a file |
| `copy.mjs` | checks copy against the content rules — a label, a draft, or `--report` over files for a score and a numbered table, whose rows `--apply` writes back once picked |
| `freshness.mjs` | compares the captures against Figma |
| `lookup.mjs` | answers one catalog entry |
| `setup.mjs` | reads the project, and with `--ready` the machine around it — Node's version, impeccable, Figma's desktop app, Claude Code's own settings; its only write is `--backup` copying aside |
| `refresh.mjs` | distils a capture this project took into `.pushpin/assets/`, and clears it |
| `update.mjs` | sweeps the declared components against the catalog; **writes project source** under `--write` and `--resolve` |

**`update.mjs` is a real widening and is listed as one.** Every other rule on
that list either only reads or writes inside `.pushpin/`, to files no person
authored. This one edits the project's own markup and stylesheets, and calls
`init --force` after the sweep — the very command left off the list. It is here
because the report is the form that gets run: it is handed over as a `fix:` line
at session start, its default mode writes nothing, and a prompt in front of a
read-only report is a prompt in front of the only form that cannot change
anything. What guards the writing halves is the command's shape rather than the
prompt — see [update.md](update.md).

**`init.mjs` is deliberately not on that list.** It is the script that can
replace a stylesheet, and one prompt in front of a `--force` is worth keeping.
Neither is any wildcard: `Bash(node *)` would approve arbitrary code execution,
and quietly widening what a person's agent may run is not a design system
plugin's to grant. Each rule names one file this plugin ships, by full path.

Rules rather than a permission mode, for the same reason. A mode is a global
choice someone makes for all their work in a session; these are a narrow,
durable grant for this plugin's own commands, and they hold in every mode —
including `Manual`. Nobody has to lower their guard to stop being asked whether
a catalog lookup may run.

The file is the machine-local one for the same reason the hook is: the rules
carry an absolute path. It is also where Claude Code itself saves an approval
when you answer *yes, don't ask again*, so they land where that answer would have
put them. Allow rules in the shared `.claude/settings.json` would be worse on
both counts — they grant capability, so Claude Code holds them until the
workspace trust dialog is accepted, and that file is the one meant to be
committed.

Those paths carry a version directory, so a plugin update leaves them naming a
build that is gone. Nothing breaks — a rule matching nothing grants nothing — but
the prompts come back silently, so `setup.mjs --verify` asks for a plain
`--write`, which rewrites them.

## The generated files

It also writes a `DESIGN.md` and an `.impeccable/design.json` sidecar generated
from the token capture. Together they are the token allowlist in the format
`impeccable` reads, so any tool reading that format checks against Pushpin's
ramps rather than inventing its own. What reports a hardcoded color, font,
radius, or font size **in the browser** — before the design reaches Figma, where
the audit would otherwise be the first thing to notice — is `check.mjs`, off
`assets/`, on the edit that wrote it; it hands that half over only where it finds
an impeccable hook actually installed. Both files are machine-written and
re-generated by `init`; they are not the place to record a decision.

Tokens are still the only part `impeccable` can mechanically check — it has no
way to register a rule and no concept of a component library, so the Figma audit
still owns components, icons, and proposals. But the prose sections now carry
the rules it cannot check, and the copy rules among them are measured anyway —
`check.mjs` reports off-guideline words on the edit that wrote them, so those
land live rather than waiting for the audit. `impeccable` reads `DESIGN.md` as
the brief and its own doctrine says the brief wins, so a generated Overview,
Colors, Typography, Layout, Elevation, Shapes, Components, and Do's and Don'ts
is how Pushpin governs the decisions no allowlist can express.

### Neither is allowed to be replaced

`impeccable init` leaves an existing `DESIGN.md` alone. `/impeccable document`
does not: it regenerates both files from scratch and replaces Pushpin with an
invented visual world, and every check downstream keeps passing against the
wrong system. This is not a hypothetical misuse — impeccable's own
`design-md-drift` finding recommends `document` by name when the visual source
directories have moved on, so the suggestion arrives with authority.

Three things now stop it, in order of how much they can be relied on:

1. **The recorded hashes.** `init` writes `designHash` and `sidecarHash` into
   `pushpin.config.json`, so a replaced or hand-edited file is reported by the
   edit hook on the edit that caused it, and by the pin check at session start.
   This is the layer that carries the weight: it works on every harness, adds no
   new hook, and catches a write however it arrived.
2. **The write guard**, on Cursor's `preToolUse`, which refuses a whole-file
   write that would strip the generated marker. The only layer that prevents
   rather than reports, and the weakest — one harness, and hooks fail open.
3. **The `AGENTS.md` note and the `@generated` marker**, which is what an agent
   reads before it tries.

Nothing is lost by refusing, which is what makes a block affordable here: both
files are machine-written, and `pushpin init --write --force` reproduces them
exactly. When a staleness check flags either one, that is the fix. Never
`document`.

## The order it goes in

One command, once per project, and `/pushpin setup` runs it for you:
`/pushpin init --write` — tokens, the two generated files, `AGENTS.md`, and the
Pushpin hooks.

`/impeccable init` is a separate command, offered by setup after the writes when
`PRODUCT.md` is missing. It writes **`PRODUCT.md` only.** Pushpin
must not generate that file: it is product truth, not design truth, and
`impeccable` boot emits `NO_PRODUCT_MD` and routes into its own interview to get
it right. Three of the questions that interview asks are already answered by
this being a Pushpin project, and answering them from scratch is how a prototype
acquires a framework and a build step. [impeccable.md](impeccable.md) holds
those answers, and they apply however `/impeccable init` is arrived at.

### Why `/impeccable hooks on` is not part of this

It used to be listed here as "what actually makes the detector run per edit."
That is wrong for most installs, and worth stating plainly because the gap it
leaves behind looks like a bug.

`hook-admin.mjs` skips every manifest target unless the project holds a provider
folder for it — `.cursor/skills/impeccable`, `.claude/skills/impeccable`, and so
on. With the usual user-global install there is no such folder, so the command
finds nothing to act on and installs nothing. Running it is harmless and
achieves nothing.

**Pushpin does not wire it up, and the absence costs almost nothing.**
`check.mjs` reports the token half itself — the raw hex, the square control, the
off-ramp font — and steps aside only when it finds an impeccable hook already
installed, which it detects from the manifests rather than assuming. So the
token coverage is there either way, and what an installed impeccable hook would
add is its non-token rules plus a block in place of a report. That is not worth
Pushpin writing a hook into a path another skill owns.

The deduplication still works where the hook does exist: `check.mjs` looks for
`.impeccable/design.json` alongside an installed impeccable hook, and where it
finds both it drops the token half of its own report. The token half and nothing
else, because dropping a finding is only ever deferring to something that is
also reporting it. The undeclared lookalike and the declaration that names
nothing real are findings impeccable structurally cannot make — it knows the
token ramps and not the component catalog — and copy is ground it has no notion
of at all. Suppressing either would spare nobody a repeat; it would delete the
only report anyone was going to get. The decision is made per run, not at
install time, so the order the two are installed in does not matter.

## Re-running it

It never overwrites content you could have authored without `--force`, and it is
safe to re-run. The exceptions are the hook shim, the hook manifests, the allow
rules, and the marketplace declaration, which are machine-written and
self-healing: all are brought back to the current form on a plain `--write`,
because a broken hook is not a decision to preserve, and neither is a rule aimed
at a plugin directory that is gone or a marketplace entry that clones the wrong
thing. Rules someone else added are appended around, never replaced, and so is
everything else in either settings file.

Re-running on a project already set up reports whether that project has fallen
behind — the same comparison session start uses — and after a `--write` it
re-checks and reports what actually resolved rather than restating the advice.
`--advice` is where that explanation of what was written lives, and on a project
holding Thumbprint it is what carries the warning against per-component CSS
overrides, which is the specific failure that made Pushpin hard to reuse in the
first place.

## The marketplace declaration

The `.claude/settings.json` entry is the distribution path for people who do not
use the CLI. Commit it, and a teammate who opens the repo is prompted to install
Pushpin when they trust the folder — no terminal, no marketplace to find. The
plugin does not load until they accept that prompt, so say so when handing the
repo over. `init` merges into the file rather than replacing it, and leaves it
alone entirely if it cannot be parsed.

What it writes is one `extraKnownMarketplaces` entry and one `enabledPlugins`
entry:

```json
{
  "extraKnownMarketplaces": {
    "johnwilliams-skills": {
      "source": {
        "source": "git",
        "url": "https://github.com/johnwilliams-tt/skills.git",
        "sparsePaths": [".claude-plugin", "pushpin"]
      },
      "autoUpdate": true
    }
  },
  "enabledPlugins": { "pushpin@johnwilliams-skills": true }
}
```

The two nesting levels are not interchangeable: `sparsePaths` describes how to
fetch the source and belongs inside it, while `autoUpdate` is a property of the
marketplace itself and sits beside it. Each of the three is load-bearing.

**A clone URL rather than `owner/repo`.** Claude Code probes for a working GitHub
SSH setup and clones the short form over SSH when it finds one, falling back to
HTTPS only after that clone fails. Each git attempt carries a 120-second timeout,
so a key that authenticates to GitHub but cannot reach this repo can burn the
whole timeout before the fallback starts. A full HTTPS URL is taken as given, and
names the same marketplace either way.

**`sparsePaths`.** A cone-mode sparse checkout, so the marketplace clone holds
the manifest and this plugin and nothing else. Without it the clone takes the
whole repository, including the other plugins published from it, none of which a
project consuming Pushpin has any use for. `.claude-plugin` has to be in the list
because that is where the CLI looks for `marketplace.json` when no explicit path
is declared.

**`autoUpdate`.** Claude Code enables auto-update on its own only for
Anthropic's own marketplaces; every other one, this included, resolves to `false`
when the key is absent. So omitting it does not mean "decide later" — it means
the install is pinned to whatever commit it was first cloned at, indefinitely and
silently. That is the expensive default here, because a pinned Pushpin is a
stylesheet that drifts away from the Figma kit while every check downstream keeps
passing, which is the failure the whole plugin exists to catch. Writing it is a
real trade and worth naming as one: the plugin can change under a team without
anyone asking for it. It is written because a design system that has quietly
stopped matching the design system is the worse of the two.

An `autoUpdate` already set to `false` is left exactly as found, including under
`--force`. That one is a decision rather than a gap — re-enabling background
updates for a whole team is not a repair — so only an absent key is filled in.
That is also what lets a project that opted out re-run `init` without the setting
flipping back and the run reporting a change every time.

## Why it all lives in the repo

There is no user-global cache. The stylesheet, `AGENTS.md`, `DESIGN.md`, and
`.claude/settings.json` have to live in the repo so a later agent — including
one that never loads Pushpin — still follows the tokens.

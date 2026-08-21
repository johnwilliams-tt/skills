# Setting a project up, start to finish

`setup` is the front door. It is one command for the whole job — tokens, the
generated files, the edit check, and the write guard — so nobody has to know
that three commands exist or which order they go in.

`init` is still the thing that writes Pushpin's artifacts, and it is still the
right call on its own for a re-run, a repair, or an update after the plugin
moves. `setup` is for the first time, and for anyone who would rather answer a
question than read a flag list.

Why it exists: `init` ended by printing two more commands to run and had no way
to tell whether they were ever run. That is how a project ends up half
configured with every individual check reporting health — the failure this
plugin keeps rediscovering, most recently as a hook that silently stopped
running. Setup asks, acts, and then checks what is actually true.

## The order

```bash
node scripts/freshness.mjs --offline --session   # 1. the session check, never narrated
node scripts/setup.mjs <project-dir> --ready     # 2. the environment; silent when it is fine
node scripts/setup.mjs <project-dir>             # 3. read the project
node scripts/setup.mjs <project-dir> --backup    # 4. only if the answer calls for it
node scripts/init.mjs  <project-dir> --write     # 5. write, with the flags it implies
node scripts/setup.mjs <project-dir> --verify    # 6. what is still broken
```

The two readiness checks no script can perform go beside step 2, and the handoff
interview follows step 6. Every step that only reads prints faults and nothing
else, so most of them print nothing at all. The two that write report what they
wrote, and what becomes of that is the next section. `--all` is the way back to
the whole picture, every row in any mode, and `--json` carries the same in a
machine-readable form; both are for a maintainer reading the script, not for the
person being set up.

## What setup says, and what it never says

Script stdout is collapsed in both harnesses, so a quiet script is not a quiet
setup. The agent is what stands between the two, and the wall of text a designer
actually reads is prose written up from output nobody asked to see.

Setup says each fault as one line carrying its fix, in the order the steps
raised them, and then the interview question. On a project that needs nothing,
that is one sentence and a question.

**A stylesheet nothing loads is one of those faults.** `init --write` copies the
tokens in, and until a page, another stylesheet, a module, or a build config
names the file, all 300 custom properties are inert and the project renders
unstyled. `init` raises it only after reading the project and finding nothing
that names the file, so it arrives as a fault with a fix and is relayed like any
other — and its silence means the wiring is there or could not be established,
never that nobody looked. It is not the closing offer the list below rules out:
that offers something optional, and this is the one action without which the
setup changed nothing on screen.

Never appears:

- A list of the files that were written, or a table of what the project now
  has. Doing it was the command's job; reporting it back is not news.
- An explanation of what `DESIGN.md`, the edit check, or the preview does. That
  is [init.md](init.md), read when somebody asks.
- The preview port, unless it moved.
- The capture date, its age, or any confirmation that something passed.
- `.gitignore` advice in a folder that holds no git repository.
- A restatement of a `fix:` line that was already run. Announcing a silent
  repair is how it stops being silent.
- A note that there was nothing to ask, nothing to fix, or nothing to
  overwrite. Process narration is not a finding.
- A closing offer of optional next steps. The interview question is the next
  step.
- `/impeccable init`'s own wrap-up. The interview happens; its summary is not
  relayed, because it reads product truth back at the person who just supplied
  it.

## 1. Readiness, and the two things a script cannot check

`--ready` reports the environment rather than the project: whether `impeccable`
is installed, whether the marketplace updates itself, whether Claude Code is
going to prompt on every edit, whether the Figma desktop app is running, and
whether the Node it is itself running under is new enough for the rest of the
scripts. A missing `node` is not on that list and cannot be: this is a Node
script, so nothing would have run, and `lookup` and `audit` failing is the only
report there is. Everything it prints is a fault with a remedy, so a working
environment prints nothing and there is nothing to relay.

Its lines carry the same two prefixes `freshness.mjs` uses — `fix:` is run
without discussion, `say:` is one sentence held and spent on the user. That
convention is stated once, in [SKILL.md § Start here](../SKILL.md#start-here),
and it is not restated here. Harness detection decides which lines are relevant
at all; `--harness claude` or `--harness cursor` overrides it when the detection
is wrong.

**One `fix:` line writes outside the project, and it is the one the user sees.**
Auto-update is turned on by `node scripts/lib/environment.mjs
--enable-auto-update`, which is deliberately not a `setup.mjs` flag:
[lib/permissions.mjs](../scripts/lib/permissions.mjs) pre-approves `setup.mjs`
to run with no prompt on the stated grounds that its only write is an additive
backup copy, and a promptless write into `~/.claude/settings.json` would make
that comment false the day it shipped. Nothing pre-approves the command that
does write, so the harness asks before it runs, and that prompt is the consent.
Run it and add nothing to it — the prompt is the whole of what the user sees,
and narrating a repair they have already approved is the noise this page exists
to remove.

Two more checks matter more than any of those, and no script can perform either.

**Figma MCP.** The tools being absent from the catalog is the first answer and
it costs no call. Otherwise one `whoami`. **Silent when it passes** — the rule
[generate.md](generate.md) § The access preflight already sets, because a
working connection is not news. When it fails, the remedy is harness-specific
and naming the wrong one wastes the turn: on Cursor it is the Figma plugin, on
Claude Code the Figma MCP server or connector. `--ready` has already settled
which of the two this is. This one runs here rather than later because the probe
is cheap and the remedy is not — it ends in the user installing something, and
that is a worse thing to discover mid-generation.

**The three libraries.** Do not invent a second check for this.
[generate.md](generate.md) § The access preflight resolves one known key from
each of Pushpin, the icon library, and the Annotation Kit in a single
`use_figma` call, and rules what happens when one is out of reach. That is also
the call that proves the Figma desktop app is connected, since `use_figma` runs
inside it.

It runs only once a link exists, which means on the from-scratch path it does
not run during setup at all. Setup's job is to know it is still owed: the link
comes out of the handoff interview, and the preflight is the first thing after
it.

## 2. Read the project first

`--assess` reads the stack, where the stylesheet would land, which Pushpin files
are already there, whether git could undo an overwrite, and whether `impeccable`
is installed. It prints only what needs a decision or a fix, which on a
directory holding no Pushpin files is nothing.

**Ask exactly what it raises, and nothing else.** A question with one real
answer is not a question, and asking it is how a short setup starts feeling like
a form. When it raises nothing, go straight to the writes without saying that
there was nothing to ask.

## 3. The one question before the writes

- **`overwrite` — Pushpin files are already here.** Offer, in this order: back
  them up and replace, replace without a backup, or leave them and write only
  what is missing. Recommend the backup whenever `--assess` reported no git
  repository or uncommitted changes, and say why in those words — a designer's
  prototype folder frequently is not a repository, and that is exactly where an
  unrecoverable overwrite lands.

Replace adds `--force` to the `init` call, preceded by `setup.mjs --backup` when
they asked for one. Nothing else in setup turns on an answer.

Every project gets the `.claude/settings.json` entry, a scratch folder included.
It is what offers the plugin to a teammate who never opens a terminal, and it
carries `autoUpdate`, which is what keeps a folder's tokens from freezing
against a capture that has stopped matching the kit. `init --no-share` still
skips it for anyone who asks for that; setup does not choose it.

The stylesheet destination is read off the project — a recognized styles
directory, or beside a page at the root when there is no such directory — so
there is nothing to ask there either. Neither is the preview: a project with a
`dev` script keeps its own server and Pushpin only reports on it, and one
without gets Pushpin's. Both are decided by reading, so neither is a question
and neither is worth a line of output.

## 4. PRODUCT.md, which is not ours to write

Setup does not conduct that interview. `/impeccable init` writes `PRODUCT.md` on
request, for whoever wants it, and its absence is reported rather than filled
in.

**Pushpin must not generate `PRODUCT.md`.** It is product truth, not design
truth. Pushpin knows the tokens and nothing about who the product is for, and a
plausible invented answer there is worse than an empty file, because everything
downstream treats it as given. The interview exists to get it right.

**Offer `impeccable` when it is absent.** An earlier version of this page said
not to, on the grounds that the generated files are correct without it — which
is true and beside the point. What is missing without it is the product record
every design command reads and the slop check on each edit, and a designer who
was never told either exists does not go looking for them. `--ready` raises it
in one sentence; `npx impeccable install` and then `/impeccable init` is the
whole path. Offer it once and drop it if the answer is no, saying in that case
that the generated files are still correct and still read by anything using that
format.

Before `/impeccable init` is invoked here, read [impeccable.md](impeccable.md).
Three of the questions it asks are already answered by this being a Pushpin
project, and answering them from scratch is how a two-day prototype acquires a
framework and a build step.

## 5. Verify, do not advise

`--verify` prints the faults, then the remedies for the ones that have them,
exits non-zero if anything is missing, and says one line when there is nothing
to fix. Relay the faults and the remedies; say nothing about what passed. Three
rows carry no remedy — a missing stylesheet, a pin that is behind, an
`AGENTS.md` with no Design system section — and re-running `init` settles all
three, with `--force` where the file it has to replace is still there. A row
confirming that a file is where setup just put it is not news to the person who
just ran setup.

Two states look like health, and neither gets softened into one. A project set
up before the generated-file hashes existed is genuinely working and genuinely
unprotected, and it is not even a fault: the row is marked `--`, the command
that records a hash prints on its own, and the exit code stays 0 on that
account. `generated-stale` is a `missing` row and does fail the exit code, but
the project reads no worse from the inside — the generated files are intact and
enforcing an older capture, so every check downstream passes against the wrong
system. Each is one sentence and the command that fixes it. Telling someone
their files are guarded when they are not is the specific failure this command
was built after, and it survives the quieting as a line rather than a paragraph.

The preview is asked of the port rather than read out of the config, so what it
reports is what a browser would actually find there. A preview that is simply
not running yet is not a fault and not a line — the next edit starts it. A port
answering something else is a fault, because the URL the user has open is
showing them another project, and the remedy is `--preview-port`, never killing
whatever holds it. See [init.md](init.md) § The preview.

## The handoff interview

Setup closes by starting the work, in at most two turns. It is the one place
setup asks anything the project could not answer for itself, aside from the
overwrite.

One `AskQuestion` call carrying two questions. Whether the work starts from a
Figma design or from scratch, and whether to prototype in the browser first or
go straight to Figma. The browser option carries its reason in the option label
rather than in a paragraph underneath it: faster, better for ironing out the
flow, and it pushes into Figma afterwards.

**If Figma is the starting point, ask for the frame link and wait.** Nothing is
searched for — "Figma with no link stops and waits" in
[SKILL.md](../SKILL.md#which-surface) already governs this. The destination is
something the user has and you do not, so a hunt spends minutes arriving at a
guess where a question spends one click arriving at a fact.

Then load the route and nothing besides it: [generate.md](generate.md) for a
Figma-first build, where the access preflight is the first thing that happens;
the project and its preview for a browser-first one; [figma.md](figma.md) when a
settled design is being read out into code.

This is the same question as [Which surface](../SKILL.md#which-surface) and
[start.md](start.md#the-question) § The question, and a user who answers it here
is not asked it again on the way into the route.

## What to say about impeccable's per-edit detector

`--verify` carries a row for it and prints it only under `--all`, because it is
not a fault — and the honest answer surprises people: with the usual user-global
`impeccable` install, `/impeccable hooks on` installs nothing here.
Its installer skips every manifest target unless the project holds a provider
folder such as `.cursor/skills/impeccable`, so there is nothing for it to act on.

**This is not a gap to fix, and Pushpin does not wire it.** `check.mjs` already
reports the token half — the raw hex, the square control, the off-ramp font —
whenever impeccable's hook is absent, and it steps aside on that half alone when
it finds one installed. The undeclared lookalike and the off-guideline line are
reported either way, because nothing else in the project reports them. What the
impeccable hook would add is its non-token rules and a block in place of a
report, at the cost of Pushpin writing a hook into a path another skill owns.
Say the detector is not installed, say Pushpin's check covers the tokens as well
as the components and the words, and move on.

## The rule that survives setup

Never `/impeccable document` on a Pushpin project. It regenerates `DESIGN.md`
and `.impeccable/design.json` from scratch with an invented visual world and
deletes the bridge. Both files are machine-written, so `pushpin init --write
--force` restores them exactly and nothing is lost by refusing.

Three things now enforce this rather than one: a write guard refuses the edit on
Cursor, the edit check reports it on the edit that caused it, and the recorded
hashes surface it at session start on any harness. See
[init.md](init.md) § The generated files.

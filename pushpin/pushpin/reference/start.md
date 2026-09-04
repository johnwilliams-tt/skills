# A bare invoke

`/pushpin` with nothing after it is a real request. It means "what should I do
here?" Answer it with two or three things worth doing and a question. Run
nothing else, and act on nothing until the user picks.

## Freshness, only when it matters

`node scripts/freshness.mjs --session` still runs before the picks,
the way Start here requires, and it is still never narrated.

- Empty: **nothing.** Open on the picks. The kit being current is the expected
  case, and a greeting that leads with it spends its best line on non-news.
- `fix:` — run it and open on the picks anyway. A repair that needed no
  decision is not one of them. When the fix was `update.mjs` and its report
  found something, that is the first question below, asked before the picks.
- `say:` — its question first, worded as the table below has it, and the action
  runs on yes before the picks open. On no, the same thing goes to the top of
  the picks in plain speech ("bring this project's Pushpin files current",
  "take a fresh copy of the changed components") and is not asked again.

Either way the layer table, skip counts, and `FIGMA_TOKEN` instructions stay
out of it — `--session` already omitted them. If `node` is unavailable there is
no check and nothing to say about there being none; open on the picks.

### A `say:` that names a command

The sentence the check prints is for you; it names the remedy so you know which
row this is. What the user hears is the middle column, in your own words for
the project in front of you, closed with a yes/no through the harness's question
tool. On yes, run the right column, then say what changed in the same register.
No flag, path or script name reaches the user in either direction; where a
sentence says which file was edited, name the file and nothing else.

| The line | What the user hears | On yes |
|---|---|---|
| `Pushpin <new> has been released and this session is running <old>` — or `…installed at the user level` | A newer Pushpin is out than the one this session is running, so what it knows about the kit may be behind: a component may have been restyled or a token moved. Updating the plugin is one step in [Claude Code: the `/plugin` menu · Cursor: Customize in the sidebar], and this project picks the change up next session. Update it now? | The one step the harness needs, as the sentence names it — this is the one action you cannot take for them. Then nothing more this session; the next one reports what moved. |
| `…re-running init with --write --force is the first thing I'd do` | Pushpin has moved on since this project's files were set up — or, where the sentence says so, the token stylesheet or the generated design files were edited after Pushpin wrote them, or the pin file cannot be read. Bringing it current replaces the four files Pushpin generates — the token stylesheet, `DESIGN.md`, the design-token sidecar, and the pin that records which Pushpin they came from — with the plugin's current build. Nothing you wrote is touched. **Where a file was edited, say so and that the edits go with it**, and offer to copy them aside first. Bring it current? | `init.mjs <root> --write --force --no-share`, replaying what `pushpin.config.json` records — `--css-path` from `css`, `--no-hook` for `checkHook: false`, `--no-preview` for `preview: false`, `--preview-port` where the preview autostarts. Report which files were replaced. |
| `fix: … update.mjs` ran and its report listed anything under Mechanical or Judgement | The kit changed some of the components this project uses since it was last brought current: so many values moved — a fill, a radius, a border — and so many of the variants it uses are no longer in the kit. Updating rewrites just those values, in the project's own files, then asks about each variant that is gone. Where a value sits in a class rule, say that every element using the class changes with it. Update the project? | `update.mjs --write`, on the same paths as the report. Say how many values changed across how many files, then ask the rows it numbered — [update.md](update.md#the-questionnaire) — and pass the answers back with `--resolve` yourself. A report where every declared component matches asks nothing and says nothing. |
| A numbered Judgement row | The component, where it sits, and the option it uses that the kit no longer offers, then "which should it become?" — the kit's own options, verbatim, plus leaving it as it is. One question per row. | `--resolve` once for every answer, by row number. The numbers and the call are yours; the user never sees either. |
| `…clearing the overlay with refresh.mjs --clear is the first thing I'd do` | This project has been reading its own copy of part of the Pushpin component catalog, taken when the plugin's was behind. The plugin now ships a newer one that has been checked and is what every other project reads. Switching back deletes the project's private copy and nothing else; what was built against it stays, and the update check says if any of it now disagrees. Switch back? | `refresh.mjs --clear`, then `update.mjs` and the row above if it finds anything. |
| `…own Pushpin catalog capture cannot be read … /pushpin refresh re-captures it, or refresh.mjs --clear removes it` | This project's private copy of the Pushpin catalog cannot be read, so the plugin's is being used instead. It can be removed — the project loses nothing it is actually reading — or taken again from Figma, which needs the Figma connection and a few minutes. Remove it, take it again, or leave it? | Remove: `refresh.mjs --clear`. Take again: [refresh.md](refresh.md). |
| `…no longer published…` or `…changed in the kit after the capture…`, however it ends — `refreshing is the first thing I'd do` on a verdict recorded before the wording moved, `updating the Pushpin plugin … /pushpin refresh re-captures for this project alone` since — and the age line ending `/pushpin refresh re-captures it for this project alone` | The kit itself has moved since the copy this Pushpin carries — name the components the sentence names — so something built from them may not match. A plugin update carries the fix when one lands; until then this project can take its own copy of the changed components from Figma, which needs the Figma connection and a few minutes. Take a copy now, or wait for the update? | Take: [refresh.md](refresh.md), you driving the reads. Wait: nothing. Where the release line above printed too, ask that one first — the update is the fix and the copy is the stopgap. |

Everything else a `say:` carries is information with nothing to run — the age
of a capture, the copy rules having moved upstream, a token that moved with no
release out yet, the Figma connection being absent. Spend it once, as printed.

### After a plugin update

The sequence a project goes through when a release lands, in the order it is
observed, each step asked as the table above words it:

1. Before the update: one `say:` naming the release. The user takes the
   harness's update step; nothing else changes until they do.
2. First session on the new plugin, when the release re-captured a catalog:
   `fix: node <plugin>/scripts/update.mjs` alone. The version finding is not
   spoken beside it, because `update --write` ends in the re-pin that settles
   it. A release that moved only the plugin prints the `say:` for
   `init --write --force` instead.
3. `update.mjs` reports; on yes, `--write` applies the mechanical values and
   numbers the rest; the rows are asked one by one and `--resolve` answers them
   once, by you — [update.md](update.md). The pin then records the new version
   and catalog dates, and the next session start is empty.
4. A project holding its own re-capture hears `say:` that it is superseded; on
   yes, `refresh.mjs --clear` — [refresh.md](refresh.md#when-it-expires).

## What never appears

- The capture date, its age, or a reassurance that the kit is current. When
  there is nothing to refresh there is nothing to say.
- Check counts, asset hashes, or whether the stylesheet still matches its source
  JSON. `verify.mjs` is a maintainer's tool and is not run here.
- Which copy of the plugin is loaded — the install path, the marketplace name,
  a folder versus a marketplace install. The version line
  (`Pushpin v<version> loaded.`) is the exception.
- Any suggestion that the invocation does not map to an action.
- The name of any other skill. Pushpin ships standalone and cannot assume a
  sibling is installed.

## Pushpin governs; it does not build

Pushpin's job is to make whatever does the building reference the system
correctly — a browser prototype, a Figma push, a React screen. So the menu never
offers to scaffold a prototype, design an app, or screenshot one. That is the
user's build tool's work. Pushpin supplies the stylesheet, the rules, and the
audit afterwards.

Serving a flat prototype is the exception, and a narrow one. A project with a
dev server of its own keeps it — Pushpin records the port and says when nothing
answers there, and starts nothing. A project with no such server gets one from
Pushpin, on the recorded port, restarted on the edit that finds it stopped. That
is not building: nothing is scaffolded and no decision about the prototype is
made. It is keeping the browser reachable, and the browser is where `check.mjs`
and the token allowlist do their work and where the push back to Figma starts.
See [init.md](init.md) § The preview.

This is also why `setup` leads for a code project that has none of it yet. It is
not a file-copying chore: it records Pushpin as this project's truth, so a tool
that opens the repo later — in a session Pushpin never enters — follows the
tokens rather than its own defaults.

## Where I'd start

Read the signals already in front of you and lead with two or three picks, each
one a line on what to do and a line on why it is worth doing now.

| What is present | Lead with |
|---|---|
| A Figma link in the conversation | `generate` if the link is where new work should land; `audit` if the frame already exists and the question is whether it is on-system; `figma` if the design is settled and the goal is reading it out into code |
| A code project with no `pushpin.config.json` | `setup` on its own — the surface it leads to is what setup's own closing question settles |
| The plugin's own source tree — `assets/` and the skill itself are in it | never `setup` or `init`, since the plugin is not a project that consumes itself; `refresh` if the capture is aging, otherwise ask what to design |
| A code project already set up | `audit` over the files being worked on, or answer the token question directly |
| Words rather than code — text pasted in, a draft file, or a copy deck | `audit`, pointed at it; it reports and changes nothing |
| A project set up before the preview existed — `setup --verify` says it is not recorded | bringing this project's Pushpin files current, which is what starts keeping the prototype server up — asked as the init row above words it |
| This project's pin is behind | bringing this project's Pushpin files current, above everything else except an aged capture — the init row above |
| Neither a link nor a code project | `generate` — a Figma link is the only thing it needs — and a token or component question, which needs nothing set up at all: what the card radius is, which token a disabled label takes |
| A capture over 30 days old | `refresh`, above everything else |

Phrase each pick the way the user would say it rather than as a command to type
— "mock up the booking screen in Figma", "check what I just built against
Pushpin", "does this button label sound like us." Once a project is set up,
plain speech is the whole interface, and the menu should read that way from the
start.

Two or three picks, no more. The fuller list is the Routing table in
[../SKILL.md](../SKILL.md), plus the token and component questions that are not
commands; point at it as the fallback instead of repeating it here.

## The question

Close with a single `AskQuestion` call rather than an open prompt, so choosing
is one click. Its options are the picks in the order they were just made,
followed by two constants:

- **Build it here and check it in the browser.** Your build tool builds it;
  Pushpin supplies the tokens it has to build against, keeps the preview
  reachable, and `audit` catches what drifted.
- **Something else.** An open-ended option, since the picks are inferences and
  can all be wrong.

These are the same three surfaces as
[Which surface](../SKILL.md#which-surface) — Figma, this project, or a straight
answer from the tokens — worded the same way, so a user who lands here and a
user who lands there are answering one question rather than two.
[setup.md](setup.md#the-handoff-interview) § The handoff interview asks it a
third time by another name, at the end of setup, and it asks last.

**So a pick of `setup` names setup and stops there.** Setup opens on the version
and its own questions, which makes a surface named alongside that pick a surface
asked for again a sentence later. Which of the three sites does the asking is
ruled in [Which surface](../SKILL.md#which-surface), along with what happens to
an answer that arrived before setup did.

Nothing runs before the answer. When it comes back, load the reference doc for
that row of the Routing table and carry on.

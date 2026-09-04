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
- `say:` — its question first, as the table below words it, and the action
  runs on yes before the picks open. On no, the same thing goes to the top of
  the picks in plain speech ("bring this project's Pushpin files up to date")
  and is not asked again. A `say:` that is a statement rather than a question
  is held for where it bears; it is not the opening line.

Either way the layer table, skip counts, and `FIGMA_TOKEN` instructions stay
out of it — `--session` already omitted them. If `node` is unavailable there is
no check and nothing to say about there being none; open on the picks.

### What the user hears

These rows are the whole vocabulary of a housekeeping reply —
[../SKILL.md § What the user reads](../SKILL.md#what-the-user-reads). The
`say:` line the check prints is for you; it tells you which row this is. Say
the row verbatim, filling only the brackets, and stop. A question goes through
the harness's question tool; the right-hand column runs on yes and appears
nowhere the user reads. Nothing is added to a row — not what was run, not why,
not what a file is called.

**Questions**

| The line | Ask | On yes |
|---|---|---|
| `…re-running init with --write --force is the first thing I'd do`, where the sentence says the files were *written by* an older version, are *an older build*, or were *pinned to an older kit* | This project's Pushpin files were made with an older version of Pushpin. Bringing them up to date replaces only the files Pushpin generated, nothing you wrote — go ahead? | `init.mjs <root> --write --force --no-share`, replaying what `pushpin.config.json` records — `--css-path` from `css`, `--no-hook` for `checkHook: false`, `--no-preview` for `preview: false`, `--preview-port` where the preview autostarts. Then the outcome row. |
| The same line, where the sentence says a file was *edited*, *replaced*, or is *gone* | [Your Pushpin stylesheet / Your project's design brief] has been changed since Pushpin wrote it, so Pushpin's checks no longer match the design system. Restoring it replaces those changes — go ahead, or should I copy the changed file aside first? | Copy aside: `setup.mjs <root> --backup`, then init as above. Go ahead: init as above. Then the outcome row. |
| `…pushpin.config.json could not be parsed …` | This project's Pushpin settings can't be read. Rewriting them touches nothing you wrote — go ahead? | init as above. Then the outcome row. |
| `fix: … update.mjs` ran and its report listed anything under Mechanical or Judgement | Pushpin's components have changed since this project was last updated, and [N] values in [M] of your files need to follow. Update them? | `update.mjs --write`, on the same paths as the report; then one question per numbered row — [update.md](update.md#the-questionnaire) — and `--resolve` once with every answer, yourself. Then the outcome row. |
| A numbered Judgement row | The [component] on [where it sits] uses a [option] that Pushpin no longer offers — which should it become? Options: the kit's own list for that property, verbatim, plus leaving it as it is. | `--resolve`, by row number. The numbers and the call are yours. |
| `…clearing the overlay with refresh.mjs --clear is the first thing I'd do` | This project has been using its own copy of part of Pushpin, and the plugin now carries a newer one. Switch back to the plugin's? | `refresh.mjs --clear`, then `update.mjs` and its row if it finds anything. |
| `…own Pushpin catalog capture cannot be read …` | This project's own copy of part of Pushpin can't be read, so the plugin's is being used instead. Remove the unreadable copy? | `refresh.mjs --clear`. Taking a fresh copy is [refresh.md](refresh.md), and is offered only if the user asks for one. |

**Outcomes** — one row, and the reply is over.

| Situation | Say |
|---|---|
| `Pushpin <new> has been released and this session is running <old>`, or `…installed at the user level` | A newer Pushpin is out. Update it from [Cursor: Customize in the sidebar · Claude Code: the `/plugin` menu], then ask me again and I'll bring this project up to date. |
| Plugin current; the project was brought up to date; the stylesheet came back byte-identical; `update.mjs` wrote nothing | Pushpin is already on the latest version. I brought this project up to date with it — your styles didn't change and nothing in your files needed editing. |
| The same, and the stylesheet changed | Pushpin is already on the latest version. I brought this project up to date with it — your styles picked up the new values, and nothing else in your files needed editing. |
| First session on a newly updated plugin; the project was brought up to date | Pushpin is now on the latest version and this project is up to date with it. [Your styles didn't change / Your styles picked up the new values], and nothing in your files needed editing. |
| `update.mjs --write` wrote values, every row answered | I brought this project up to date with Pushpin — [N] values in [M] of your files changed to match, and the rest is unchanged. |
| Plugin current, project current, nothing ran or everything was a silent `fix:` | Pushpin is on the latest version and this project is up to date with it. |
| The user said no to a question | Nothing more about it. |
| "Can I trust this", `/pushpin freshness` — every layer that ran is `ok` | Pushpin's copy of the design system is current. |
| The kit has moved since the plugin's snapshot — a line ending `the next plugin update will carry …` | As printed. It is already written for the user. |
| The same, on a verdict recorded before the wording moved: `…no longer published…` or `…changed in the kit after the capture…`, ending `refreshing is the first thing I'd do` or `updating the Pushpin plugin …` | The Pushpin team has changed some components since this version; the next plugin update will carry those. |
| `The Figma plugin is not installed…`, `There is no Figma connection set up here…`, the Node or Figma-desktop line | As printed. It is already written for the user. |
| A finding outside Pushpin's scope — another tool's report, a project file that is not Pushpin's, a check row that skipped | Nothing. |

The kit-moved sentence is spent once, and only where it bears — a Figma write,
a question about a component, or "can I trust this". It is not part of an
update or setup reply, it never carries the component names, and it never
offers a re-capture; a project blocked on one component reaches
[refresh.md](refresh.md) through its own routing row when the user says so.
Where the newer-plugin row also fired, that row alone is said.

### After a plugin update

The sequence a project goes through when a release lands, in the order it is
observed. Each step is one row of the tables above and nothing besides; the
mechanism here is for you.

1. Before the update: one `say:` naming the release — the newer-plugin row.
   Nothing else changes until the user takes the harness's step.
2. First session on the new plugin, when the release re-captured a catalog:
   `fix: node <plugin>/scripts/update.mjs` alone. The version finding is not
   spoken beside it, because `update --write` ends in the re-pin that settles
   it. A release that moved only the plugin prints the init `say:` instead —
   the init question.
3. `update.mjs` reports; anything under Mechanical or Judgement is the update
   question; on yes, `--write` applies the mechanical values and numbers the
   rest; the rows are asked one by one and `--resolve` answers them once, by
   you — [update.md](update.md). The pin then records the new version and
   catalog dates, and the next session start is empty.
4. A project holding its own re-capture hears `say:` that it is superseded —
   the switch-back question; on yes, `refresh.mjs --clear` —
   [refresh.md](refresh.md#when-it-expires).
5. One outcome row closes it.

## What never appears

The list in [../SKILL.md § What the user reads](../SKILL.md#what-the-user-reads),
and here in particular:

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
| A project set up before the preview existed — `setup --verify` says it is not recorded | bringing this project's Pushpin files up to date, which is what starts keeping the prototype server up — asked as the init question above words it |
| This project's pin is behind | bringing this project's Pushpin files up to date, above everything else except an aged capture — the init question above |
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

# A bare invoke

`/pushpin` with nothing after it is a real request. It means "what should I do
here?" Answer it with two or three things worth doing and a question. Run
nothing else, and act on nothing until the user picks.

## Freshness, only when it matters

`node scripts/freshness.mjs --offline --session` still runs before the picks,
the way Start here requires, and it is still never narrated.

- Empty: **nothing.** Open on the picks. The kit being current is the expected
  case, and a greeting that leads with it spends its best line on non-news.
- `fix:` — run it and open on the picks anyway. A repair that needed no
  decision is not one of them.
- `say:` about the kit: that sentence first, then `refresh` at the top of the
  picks.
- `say:` about this project's files being behind: that sentence first, then
  re-running `init` with `--write --force` at the top of the picks.

Either way the layer table, skip counts, and `FIGMA_TOKEN` instructions stay
out of it — `--session` already omitted them. If `node` is unavailable there is
no check and nothing to say about there being none; open on the picks.

## What never appears

- The capture date, its age, or a reassurance that the kit is current. When
  there is nothing to refresh there is nothing to say.
- Check counts, asset hashes, or whether the stylesheet still matches its source
  JSON. `verify.mjs` is a maintainer's tool and is not run here.
- Which copy of the plugin is loaded.
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
| A code project with no `pushpin.config.json` | `setup`, then `generate` |
| The plugin's own source tree — `assets/` and the skill itself are in it | never `setup` or `init`, since the plugin is not a project that consumes itself; `refresh` if the capture is aging, otherwise ask what to design |
| A code project already set up | `audit` over the files being worked on, or answer the token question directly |
| Words rather than code — text pasted in, a draft file, or a copy deck | `audit`, pointed at it; it reports and changes nothing |
| A project set up before the preview existed — `setup --verify` says it is not recorded | re-running `init` with `--write --force`, which is what starts keeping the prototype server up |
| This project's pin is behind | re-run `init` with `--write --force`, above everything else except an aged capture |
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

Nothing runs before the answer. When it comes back, load the reference doc for
that row of the Routing table and carry on.

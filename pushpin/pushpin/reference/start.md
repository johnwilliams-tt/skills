# A bare invoke

`/pushpin` with nothing after it is a real request. It means "what should I do
here?" Answer it with two or three things worth doing and a question. Run
nothing else, and act on nothing until the user picks.

## Freshness, only when it matters

`node scripts/freshness.mjs --offline --brief` still runs before the picks, the
way Start here requires. Relay stdout verbatim.

- Empty: **nothing.** Open on the picks. The kit being current is the expected
  case, and a greeting that leads with it spends its best line on non-news.
- A sentence about the kit: that sentence first, then `refresh` at the top of
  the picks.
- A sentence about this project's files being behind: that sentence first, then
  re-running `init` with `--write --force` at the top of the picks.

Either way the layer table, skip counts, and `FIGMA_TOKEN` instructions stay
out of it — `--brief` already omitted them. If `node` is unavailable, take the
age and the pin from the files the way Start here already describes, and apply
the same rule.

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
offers to scaffold, serve, or screenshot a prototype. That is the user's build
tool's work. Pushpin supplies the stylesheet, the rules, and the audit
afterwards.

This is also why `init` leads for a code project that has none of it yet. It is
not a file-copying chore: it records Pushpin as this project's truth, so a tool
that opens the repo later — in a session Pushpin never enters — follows the
tokens rather than its own defaults.

## Where I'd start

Read the signals already in front of you and lead with two or three picks, each
one a line on what to do and a line on why it is worth doing now.

| What is present | Lead with |
|---|---|
| A Figma link in the conversation | `generate` if the link is where new work should land; `audit` if the frame already exists and the question is whether it is on-system; `figma` if the design is settled and the goal is reading it out into code |
| A code project with no `pushpin.config.json` | `init`, then `generate` |
| The plugin's own source tree — `assets/` and the skill itself are in it | never `init`, since the plugin is not a project that consumes itself; `refresh` if the capture is aging, otherwise ask what to design |
| A code project already initialized | `check` over the files being worked on, or answer the token question directly |
| This project's pin is behind | re-run `init` with `--write --force`, above everything else except an aged capture |
| Neither a link nor a code project | `generate` — a Figma link is the only thing it needs — and a token or component question, which needs nothing set up at all: what the card radius is, which token a disabled label takes |
| A capture over 30 days old | `refresh`, above everything else |

Phrase each pick the way the user would say it rather than as a command to type
— "mock up the booking screen in Figma", "check this directory for off-token
values." Once a project is initialized, plain speech is the whole interface, and
the menu should read that way from the start.

Two or three picks, no more. The fuller list is the Commands table in
[../SKILL.md](../SKILL.md), plus the token and component questions that are not
commands; point at it as the fallback instead of repeating it here.

## The question

Close with a single `AskQuestion` call rather than an open prompt, so choosing
is one click. Its options are the picks in the order they were just made,
followed by two constants:

- **Build it here and check it in the browser.** Your build tool builds it;
  Pushpin supplies the tokens it has to build against, and `check` catches what
  drifted.
- **Something else.** An open-ended option, since the picks are inferences and
  can all be wrong.

These are the same three surfaces as
[Which surface](../SKILL.md#which-surface) — Figma, this project, or a straight
answer from the tokens — worded the same way, so a user who lands here and a
user who lands there are answering one question rather than two.

Nothing runs before the answer. When it comes back, load the reference doc for
that row of the Routing table and carry on.

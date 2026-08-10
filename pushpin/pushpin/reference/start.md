# A bare invoke

`/pushpin` with nothing after it is a real request. It means "what should I do
here?" Answer it with one line on freshness, two or three things worth doing,
and a question. Run nothing else, and act on nothing until the user picks.

## The freshness line

Run `node scripts/freshness.mjs` and compress its answer into one sentence about
the kit. The Annotation Kit's separate date, the layers it skipped, and the
instructions for setting `FIGMA_TOKEN` are detail that does not belong in a
greeting.

- Current: **Pushpin is up to date — the kit was captured 4 days ago.**
- Over 30 days: **The Pushpin capture is 47 days old, so parts of it may have
  moved since — refreshing is the first thing I'd do.**

If `node` is unavailable, take the age from `capturedAt` the way Start here
already describes, and say the same sentence.

## What never appears

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

- **A prototype in the browser.** Your build tool builds it; Pushpin supplies
  the tokens it has to build against, and `check` catches what drifted.
- **Something else.** An open-ended option, since the picks are inferences and
  can all be wrong.

Nothing runs before the answer. When it comes back, load the reference doc for
that row of the Routing table and carry on.

# Auditing

One command, three things it can be handed: a repo or a file of code, a piece of
writing, or a Figma frame. The question is the same each time — is this Pushpin,
or does it only look like Pushpin — and the answer comes from somewhere
different each time, because a token bound to a Figma node and a token in a
stylesheet are not the same object and nothing reads both.

## Which target

Three targets, one section each below: a repo or a file of code, words with no
design around them, and a Figma frame.

**Figma or code is the question routing has already answered**, and the signals
that answer it are not restated here: they live in
[SKILL.md § Which surface](../SKILL.md#which-surface), and a second copy would be
a second place for them to drift. The surface question does not change because
the answer happens to be an audit rather than a generation.

**Words are this section's own signal**, and § Which surface does not carry it,
because words on their own are not a design surface — there is no canvas and no
repo to settle between. Text pasted into the conversation, a draft file, a copy
deck: what marks the third target is that absence, and it needs no rule to read.
Words that do have a design around them are already the copy class of whichever
of the other two targets holds them, so this one is reached only when there is
nothing else to audit.

With nothing attached at all, ask — one `AskQuestion` call, before any other
tool call. Auditing whatever repo the working directory happens to sit in is a
guess, and what it costs is a page of findings about code nobody asked about.

**Two of the three report and the third one gates.** Code and words are
advisory: they print findings and change nothing, and what to do about a finding
belongs to whoever is holding the file. The Figma path is the one that stops
something — a frame that comes back `report.ok === false` does not hand over and
is not offered the finalize pass. That is not the Figma rules being stricter
than the others. It is that a file still being edited has a next edit, and a
frame someone is about to build from does not.

## A repo or a file of code

`check.mjs` reads it and sorts what it finds into three classes.

**Values that are not tokens.**

| Finding | What it looks like |
|---|---|
| Raw color | A hex, `rgb()`, or `hsl()` literal — flag it whether or not it matches a ramp. Matching a ramp means the token exists and was bypassed. |
| Pure black text | `#000`, `black`, `rgb(0,0,0)` on text. Body text is `--pp-text-neutral-default`. |
| Square corners on a control | A button, input, chip, or search bar without `--pp-radius-sides`. |
| Off-scale spacing | A padding, margin, or gap in px that is not one of the 13 `--pp-space-*` steps. |
| Off-ramp type | A `font-size` that is not a ramp step, or a family that is not Thumbtack Rise. |
| Off-ramp weight | A weight outside 400 / 563 / 590 / 660 / 700. |

If the project has been through `init`, most of these are already reported live
by impeccable's detector, which reads the same tokens out of the generated
`DESIGN.md`. `check.mjs` still earns its place on a repo that was never
initialized, in a review, and for the two classes below, which no token
allowlist can express.

**Component identity.** Only in hand-rolled markup — a React project on
Thumbprint components declares nothing and needs nothing. See
[components.md](components.md#declaring-what-hand-rolled-markup-is).

- **An undeclared lookalike.** An element that reads as a published component —
  pill radius over a brand-strong fill, an input's border and padding, a chip's
  geometry — carrying no `data-pp-component` and no `data-pp-proposed`. This is
  the browser-side twin of the Figma audit's lookalike defect, and finding it
  here is the cheap version: at push time the same element is a guess, and after
  push it is a defect in someone's handoff.
- **A declaration that names nothing real.** A `data-pp-component` absent from
  the catalog, or a `data-pp-variant` naming a property or option that entry
  does not have. The push discards these rather than trusting them, which is
  safe and silent — this is where it gets said out loud.

**Copy.** The words in the markup, held against the content design rules — a
banned phrase, a passive line that hides who acted, `contractor` for `pro`, a
declared component over its length limit. `--no-copy` opts out, and
`--component-only` does not: what it reads, what it never reads, and why the two
flags differ are [below](#copy-in-code).

`node scripts/check.mjs <path>` reports all three, and resolves every
declaration against the catalog for you. Where you need to see an entry
yourself, ask for it: `node scripts/lookup.mjs <name>`. Component names,
property names, and variant options are case-sensitive and not guessable.

### Copy in code

This is the third class, and the hook `init` installs runs it on every edit.

It reads JSX and HTML text nodes and the `label`, `title`, `placeholder`,
`aria-label`, `alt`, and children props — never an identifier, an import, a
class name, or a URL, and nothing at all in a region it could not fully parse. A
copy check that fires on a variable name is one people switch off, and then none
of the findings land.

`--no-copy` turns it off. `--component-only` does not, because that flag exists
to stop repeating what impeccable's detector already reports live, and impeccable
has nothing to say about copy — suppressing it there would drop the findings
nothing else in the project reports.

`--brief` is what the edit hook relays. It leads with the count and the critical
count, hoists criticals into the lines it shows before truncating, and ends with
the doc for each class that fired:

```
Pushpin: 6 off-system finding(s).
  src/Hero.jsx:5  banned phrase "Please be advised" — cut entirely
  src/Hero.jsx:5  "has been confirmed" is passive — say who does what
  src/Hero.jsx:5  "contractor" — Thumbtack says "pro"
  src/Hero.jsx:6  "Get started" is a generic call to action — name the action
  src/Hero.jsx:6  Button / CTA is 6 words; the limit is 4
  src/Hero.jsx:7  "Learn more" is a generic call to action — name the action
Docs: reference/copy.md
```

That last line is why a copy finding sends someone to [copy.md](copy.md) rather
than to the token rules — and rather than here, which would hand them the CLI
when what they want is the row they broke. The `over-length` finding in it is
there because the button carried `data-pp-component="Button"`; the declaration
is the only thing in markup that says which row governs a string. Without one,
every other rule still runs.

## Words with no design around them

```bash
node scripts/copy.mjs --text "Send request" --component Button
node scripts/copy.mjs drafts/onboarding-email.md
pbpaste | node scripts/copy.mjs
```

It changes nothing, and it exits 1 when anything was found and 0 when clean, so
it can gate the same things `check.mjs` gates. `--json` gives the findings as
data, `--help` prints the surface.

**Labelled blocks are the primary form, not a convenience.** Length is the one
rule that cannot be decided from the words alone, and a label is how the rules
themselves ask for copy and how a designer will paste it. Each block is resolved
to its own row and scanned under its own limit:

```bash
node scripts/copy.mjs --text '[Header] Your pro is on the way
[Body text] Dana will text you when she is close. In order to reach her, use the inbox.
[CTA button] Learn more'
```

```
Major — fix before handoff
  [Body text]   2:51  M4  banned-phrase  banned phrase "In order to" — use "To"
  [CTA button]  3:14  M3  generic-cta    "Learn more" is a generic call to action — name the action

2 findings: 2 major
```

`[CTA button]`, `[Button]` and `[CTA]` all reach the same row, and a limit that
splits into parts takes the part in the label — `[Modal header]`,
`[Notification body]`. A label that genuinely could be two rows is left
unresolved rather than guessed at, and says so:

```
[Text] could be Body text or Placeholder / helper text; name one exactly for a length check.
```

A markdown link, a footnote, and a task list item are not labels, so a copy deck
written in markdown stays copy. `--component` does for an unlabelled blob what a
label does for a block, and `--part` names the slot for either.

**Every route to an unchecked length says so once, after the findings.** That is
the one failure a reader cannot see in the output, because silence about a rule
that did not run looks exactly like the rule passing.

## A Figma frame

[audit-figma.md](audit-figma.md) carries the whole procedure, and it is a
`use_figma` script rather than a shell command because everything it inspects
lives in the Figma document. Seven buckets, failing on defects only. The failure
it exists to catch is work that looks right in a screenshot and is structurally
fake — which is exactly why a screenshot cannot stand in for running it.

Copy is the one part of that run that comes back out to a shell command. The
rules a frame's words are held against are a file rather than a property of a
node, so the `use_figma` call gathers the strings and `copy.mjs` decides them,
which is how the Figma path ends in the same engine the two paths above start
from. [Settling the copy bucket](audit-figma.md#settling-the-copy-bucket) has
the mechanism, where ownership splits inside an instance, and why a critical
goes to `defects` while everything else reports.

# Auditing

One command, three things it can be handed: a repo or a file of code, a piece of
writing, or a Figma frame. The question is the same each time — is this Pushpin,
or does it only look like Pushpin — and the answer comes from somewhere
different each time, because a token bound to a Figma node and a token in a
stylesheet are not the same object and nothing reads both.

## Which target

Three targets, and a section each below: a repo or a file of code, words with no
design around them, and a Figma frame.

**A request naming copy narrows the first one rather than adding a fourth.**
"Check the copy on this modal", "does this sound like us", "review these labels" —
that is a file of code with one of its three classes asked for, and it has a
section of its own because the answer has a shape: a score and a table, from
[one command](#a-copy-check). Words with no design around them are the target
below only when there is no file to point at.

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

**Nothing else in the project is reporting these.** Impeccable's per-edit
detector would — it reads the same ramps out of the generated `DESIGN.md` — but
its hook installer skips every project that does not hold a provider folder such
as `.cursor/skills/impeccable`, which the usual user-global install never
creates, so an initialized project usually has no detector running at all. Where
one is installed, `check.mjs` reads that off the hook manifests and drops this
class rather than saying it twice.
[init.md](init.md#why-impeccable-hooks-on-is-not-part-of-this) has why Pushpin
does not wire one up.

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

**A clean run means the files agree with whatever the tokens say, not that the
tokens are right.** All three classes resolve against `assets/` — values against
the generated tokens, declarations against the catalog — and nothing here reads
the kit, so a screen whose type is visibly wrong runs clean as long as its CSS
names the token carrying the wrong value. Reporting it as on-system on the
strength of a zero exit is how a token defect survives a review. The question
this command cannot answer is whether the capture still matches Figma, and
[maintaining.md](maintaining.md#refreshing-the-capture) is where it is asked.

### Copy in code

This is the third class, and the hook `init` installs runs it on every edit.

It reads what [§ What it reads](#what-it-reads) describes, off the same walk —
text nodes, the five text attributes, and the same names assigned in script —
never an identifier, an import, a class name, or a URL, and nothing at all in a
region it could not fully parse. A copy check that fires on a variable name is
one people switch off, and then none of the findings land.

**Asked about copy, reach for `--report` instead.** This class is the sweep's
share of it, phrased for an edit hook relaying one line. The report lane answers
the question somebody asked out loud.

`--no-copy` turns it off. `--component-only` does not: it drops the token class
alone, which is the one class an installed impeccable detector would also be
reporting, and impeccable has nothing to say about copy — suppressing it there
would drop the findings nothing else in the project reports.

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

## A copy check

**"Check the copy" is one command, and its output is the answer.** Not a lane
that gathers strings by hand, reads the rules and writes an essay about them:

```bash
node scripts/copy.mjs --report areas.html areas.js styles/areas.css
node scripts/copy.mjs --report src/            # a directory walks
```

It prints a score and a markdown table — `Where`, `Current`, `Suggested`, `Why`,
one row per string that broke something. **Relay that table as it printed.**
Reformatting it is where a report turns back into paragraphs, and the columns are
already the shape of the question: which string, what it says, what it should say
instead.

Then two things, and nothing else:

- **Fill the blank `Suggested` cells, and correct the partial ones.** The script
  only makes substitutions the rules state — a banned phrase with a literal
  replacement, a wrong term, a title-cased word sentence case lowercases. A
  generic CTA, a passive line and an over-length string all need a decision about
  what the copy is trying to say, and the closing line of the report names which
  codes were left. Those cells are the judgment being asked for.
- **Add a row for anything the engine cannot see.** Seven of the sixteen rubric
  codes are mechanical and [copy.md](copy.md#where-the-mechanical-part-ends) has
  what the other nine are. A screen using three nouns for one thing, a title that
  breaks the pattern of its siblings, an accessible name that does not contain its
  visible label: real findings, none of them a pattern, all of them a row in the
  same table with `—` for a code.

**Then offer the rows, and write nothing until one is picked.** One `AskQuestion`,
`allow_multiple`, one option per row in the table, each labelled with the change it
makes — `1. Manage Your Service Areas → Manage your service areas`. Plus an option
that takes none of them. Fill the blank cells first, so every option is a concrete
change rather than an invitation to think about one.

**No screenshots, no harness run, no sweep of the rest of the repo, and no edit
that was not picked.** Someone who asks what is wrong with their copy has not asked
you to rewrite their repo. The offer is one question at the end of an answer that
was already complete; the failure to avoid is the ten minutes spent arriving
somewhere they could reach in a line of their own.

Then apply what came back, by number, in one call:

```bash
node scripts/copy.mjs src/ --apply 1,4                    # as suggested
node scripts/copy.mjs src/ --apply '{"3":"Save areas"}'    # other words in a row
```

Same paths, in the same turn — `--apply` re-reads the files to find the rows, so
the numbers mean what the reader saw only while the files are as the report found
them. It refuses a row it cannot place rather than writing to a guess.

**Do not hand-edit a row instead.** A suggestion is spliced span by span, so an
interpolated value in the string survives it, and a row is one occurrence at one
offset where the same string in two files is two rows. A `StrReplace` on the string
is the one that either refuses as ambiguous or changes the copy nobody picked.

Over ten rows, do not offer eleven options. Offer one that takes every mechanical
suggestion at once, and an option each for the rows whose wording is a judgment.

Exit 1 when anything was found and 0 when clean, so it gates what `check.mjs`
gates. `--json` gives the same data with the score and the suggestions on it.

### What it reads

Markup, and script. Text nodes, the `label`, `title`, `placeholder`,
`aria-label` and `alt` attributes, and — the part that used to need a grep — the
same names handed to an element in code: `setAttribute('aria-label', …)`,
`.placeholder =`, `.textContent =`. In a hand-rolled prototype that is where the
placeholder, the accessible name and the live-region announcement actually live,
and a report that skipped them called a file clean on the strength of not having
looked.

Never an identifier, an import, a class name, a URL, or a region it could not
fully parse. A bare `const EMPTY = '…'` is not read either: the copy in it reaches
a reader through the markup that interpolates it, and that is where the walk finds
it, under whatever component the markup declares.

**Length is the one rule a walk cannot settle by itself.** It needs the row, and
only a `data-pp-component` on the element holding the text supplies one — a
`placeholder` attribute is the exception, since that row governs it whatever
element carries it. The report says how many strings went unmeasured rather than
leaving the silence to be read as a pass.

**Not the app layer, not checked.** A region marked `data-pp-content="pro"` is a
pro's own words, and neither the report nor `--apply` touches it — the rules are
Thumbtack's voice and a pro's headline is not written in it. The count of what a
marker exempted is printed, so a marker on the wrong element does not quietly
empty a report. [copy.md](copy.md#the-app-layer-and-a-pros-words) has the marker,
the values that hand a region back, and the comment form for a string a script
assigns.

**Asked to fix a pro's copy anyway, say what the check does and does not cover.**
The words are theirs and the rubric was not written for them; grammar and spelling
are a different job from the one this does, and the score would be meaningless.

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
`use_figma` script rather than a shell command because nearly everything it
inspects lives in the Figma document. Eight buckets, failing on defects only.
The failure it exists to catch is work that looks right in a screenshot and is
structurally fake — which is exactly why a screenshot cannot stand in for
running it.

Two parts of that run come back out to a shell command, because a `use_figma`
script cannot read a file. The keys its instances resolved to are one, and
`remote` is why: it says an instance resolved to a published component and not
to whose, so
[Settling the library bucket](audit-figma.md#settling-the-library-bucket) holds
the keys against the catalogs and a component from the library Pushpin replaced
is reported rather than counted as on-system. The copy is the other. The rules a
frame's words are held against are a file rather than a property of a node, so
the `use_figma` call gathers the strings and `copy.mjs` decides them, which is
how the Figma path ends in the same engine the two paths above start from.
[Settling the copy bucket](audit-figma.md#settling-the-copy-bucket) has the
mechanism, where ownership splits inside an instance, and why a critical goes to
`defects` while everything else reports.

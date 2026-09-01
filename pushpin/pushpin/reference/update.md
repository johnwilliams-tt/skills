# Bringing a project current after the kit moves

One verb for "the design system moved, bring me current". It sweeps the
components this project declares, writes the values whose replacement is not a
decision, and puts the rest to the user as numbered questions.

**Consumer projects only.** In the plugin's own checkout the kit moving is a
capture and a release — [maintaining.md](maintaining.md) — and `update.mjs`
refuses there rather than sweeping the assets it ships.

    10|## When this is the right lane

- Session start printed `fix: node <plugin>/scripts/update.mjs`. That is the
  `catalog` finding: the component catalogs the project is pinned to have moved,
  so a component it declares may have been restyled or lost a variant it uses.
- The user says Pushpin moved, a release landed, or a button "looks wrong since
  the update".
- A [refresh](refresh.md) just landed, so this project reads a catalog nobody has
  held its markup against yet.

    20|**It is not [init.md](init.md).** init replaces the stylesheet and the generated
files and rewrites the pin, having looked at nothing the project is built out
of — which is why a `catalog` finding hands over this command instead. Run init
first and the finding is retired without a single declared component having been
compared to the catalog that moved.

## The three forms

```bash
node ${CLAUDE_SKILL_DIR}/scripts/update.mjs                     # report, write nothing
    30|node ${CLAUDE_SKILL_DIR}/scripts/update.mjs --write             # apply the mechanical fixes, number the rest
node ${CLAUDE_SKILL_DIR}/scripts/update.mjs --resolve '{"1":"secondary"}'
```

Run it from the project; it finds the root by `pushpin.config.json`. A path
narrows the sweep, and the same paths have to be given to `--resolve` as to
`--write`. `--no-init` leaves `pushpin.config.json` alone, `--json` is the same
answer as data, and it exits 1 while anything is outstanding.

**Default mode writes nothing**, which is what makes it safe as a session-start
    40|`fix:` line. Do not announce running it, and do not relay a report that says
every declared component matches.

## Mechanical, and judgement

| | What it is | What happens |
|---|---|---|
| **Mechanical** | The kit's value is knowable and the replacement is unambiguous: a fill that moved to another token, a radius, a padding, a border width | `--write` replaces it in the file the value actually sits in |
| **Judgement** | A variant was deleted. `theme=subtle` and `size=xlarge` are gone from Button, and whether a `subtle` button becomes `secondary` or `tertiary` is a design decision | a numbered row, answered with `--resolve` |

    50|Three write targets, and the report names all three because they are not the
same edit: an inline `style="…"`, a `style={{…}}` prop, and a class rule in a
scanned stylesheet. **A class rule says so on its own line**, because the span is
right and its reach is wider than the finding that named it — it repaints every
element carrying the class, including any this sweep never saw.

Every value is confirmed against the file before it is replaced. A span that no
longer reads back is a file that moved between the sweep and the write, so
nothing is written to it and the run says which file.

    60|## The questionnaire

`--write` numbers the judgement calls and stops there. Ask them:

- **One question per numbered row**, in a single `AskQuestion` call where the
  harness takes more than one, and the options are the kit's own list for that
  property, verbatim as the row prints them. Add an option that leaves the row
  alone, because "none of these" is a real answer and the alternative is a
  substitute nobody chose.
- Never pick for the user. A deleted variant is the one finding in this whole
    70|  chain that has no mechanically right answer; that is why it is a row rather
  than a fix.
- Pass every answer back in **one** call:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/update.mjs --resolve '{"1":"secondary","3":"large"}'
```

An option the kit does not publish is refused with the list that is published. A
row number on its own is refused too: there is no suggestion behind it to fall
back on.
    80|
### Why the numbers refuse

`--write` and `--resolve` are two runs of two processes, and between them a
person can edit a file, take a re-capture, or sweep different paths. So `--write`
records the rows in `.pushpin/update.json` — what each one was, and a hash of
every file a row would write to — and `--resolve` re-derives the questions from
the project as it stands and refuses unless both agree. A number that has
stopped meaning what it meant is the one failure a questionnaire can produce
that the reader cannot see.
    90|
When that happens, re-run `--write` and ask again; a refusal writes nothing. The
ledger is spent by a successful `--resolve` and deleted, so the rows left over
are re-numbered by the next `--write` rather than answered against a stale list.
It is derived state — `.pushpin/` is machine-local apart from `assets/`, so
gitignore it.

## What it does to the pin

Under `--write`, and **after** the sweep, it runs
`init --write --force --no-share` so `pushpin.config.json` records the catalogs
   100|the sweep actually ran against. The order is the point: `--force` rewrites the
recorded dates without comparing anything, so a run that repaired the pin first
would destroy the signal that said to sweep.

Two things guard it. Whatever this project chose is replayed — `--no-hook`,
`--no-preview`, a recorded preview port — so a run meant to bring the pin
current cannot install a hook the project declined. And where the pin says a
file was **hand-edited**, the init step is withheld and the command printed
instead, because `--force` replaces those files and a repair that deletes
somebody's work is not one. `--no-init` skips it outright.

   110|## A project reading its own catalog

`refresh.mjs` writes a re-capture into `.pushpin/assets/` and touches
`pushpin.config.json` not at all, so a project that re-captured for itself reads
a newer catalog than the one it is pinned to and no `catalog` finding fires.
`update` compares the recorded date against the catalog **actually in force**
rather than against the plugin's, so that move is reported too, and the line says
which of the two moved.

That line does not retire. An overlay is provenanced in
   120|`.pushpin/assets/overlay.json` and nowhere in the pin, so it stands until the
plugin ships a capture at least as new — at which point the overlay is
superseded and [refresh.md § When it expires](refresh.md#when-it-expires) is the
lane.

## What it does not cover

**Undeclared markup.** A button carrying no `data-pp-component` names no
component, so no captured variant is attached to it and no sweep can hold it
against one. The run reports a count and says as much rather than implying
   130|coverage; `check.mjs` lists them under `undeclared-lookalike`, and declaring
hand-rolled markup is a hard rule for exactly this reason —
[rules.md](rules.md).

**A drift with no range.** Where the file does not read the same across a value
— a comment or a `url()` sitting inside the span — the finding keeps its value
and loses its offsets, and it is listed as a hand fix with the reason. Reporting
costs nothing there; writing to a guessed offset costs the file.

**A property the kit dropped whole.** `Button` losing an axis leaves nothing to
   140|pick from, so it is a hand fix rather than a row.

## The rest of the chain

- [refresh.md](refresh.md) — re-capture the catalogs for this project, when the
  plugin's copy is what is wrong
- [init.md](init.md) — the mechanical half: stylesheet, generated files, pin
- [maintaining.md](maintaining.md) — the plugin's own checkout, and the release
- [audit.md](audit.md) — the whole report rather than the components that moved

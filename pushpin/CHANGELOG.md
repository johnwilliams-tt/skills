# Changelog

Most entries record a capture of the Pushpin Thumbprint UI Kit and what moved
since the last one. Those are produced by `/pushpin refresh`; see
[pushpin/scripts/check.md](pushpin/scripts/check.md). The rest record the plugin
itself changing.

Changes are grouped the way `diff.mjs` classifies them:

- **Breaking** — a consumer fails. A removed token, a variable that became
  hidden from publishing, a changed component property key, a command that no
  longer resolves.
- **Changed** — values moved. Regenerate the CSS; nothing errors.
- **Added** — new tokens, components, or styles.

An entry about the plugin rather than the capture adds **Fixed** for a bug in
the toolchain, which `diff.mjs` has no category for.

## 0.18.0 — 2026-09-01

Button was republished in the Pushpin Thumbprint UI Kit and the capture caught
up. The republish is not a restyle — it is a smaller, differently-keyed
component, and every key that moved is a key some caller was already passing.
Eight other components moved in the same read, because a properties refresh
covers the catalog rather than the one component that prompted it.

**Breaking**

- **Button lost four of its eight themes and three of its five sizes.**
  `theme` is now `primary`, `secondary`, `tertiary`, `link`, `caution`, `alert`
  — `subtle` and `solid` are gone. `size` is now `large` and `small`, and the
  default moved from `xlarge` to `large`; `xlarge`, `medium` and `xxlarge` no
  longer resolve. The `Platform` axis, which only ever offered `Native & Mobile`,
  was dropped. [`reference/components.md`](pushpin/reference/components.md)
  carried a Thumbprint mapping onto `solid` and no longer does, with the two
  removed themes named so a translation that needs one fails loudly instead of
  landing on a variant that no longer exists.
- **Button's property keys were reissued.** `Label` is `Label#35422:0`, not
  `Label#13326:0`. The two icon slots are now `icon#34740:123` and
  `iconRight#35089:121`, replacing `Icon Left#22316:0` and
  `Icon Right#22316:261`; their visibility toggles are `👁️ Icon (left)#34731:2`
  and `👁️ iconRight#35089:0`. A `setProperties` call written against the old
  keys throws rather than silently doing nothing, which is the good case, but it
  throws at every call site at once.
- **Icon Button folded `isDisabled` and `isLoading` into `State`.** Those two
  boolean axes are gone; `State` gained `loading` and `disabled` beside
  `default`, `hover` and `pressed`. It took the same `theme`, `size` and
  `Platform` cuts as Button.
- **`Bubble / Text` renamed both its themes.** `Received` and `Sent` are now
  `Recipient` and `Sender`, and the default moved with them.
- **`Messenger Elements / Composer` replaced its `State` axis.** `Disabled` is
  gone; `State4`, `State5` and `Filled` are new, which reads as work in progress
  in the kit rather than a settled API — recorded as found.
- **Two modal slots changed type.** `Modal / Factory / Main` swapped
  `Content#4276:0` (`INSTANCE_SWAP`) for `children#26172:0` (`SLOT`), and
  `Modal / Promotion` swapped `Artwork#7487:0` for `childern#26172:1` and
  `artwork#26172:4`. The misspelling is the kit's and is recorded verbatim; a
  capture that corrects a name produces a key that does not work.

**Changed**

- Button gained a `State` axis (`default`, `hover`, `pressed`) and an
  `isLoading` boolean, and `Link` gained `State` (`Default`, `Hover`).
- `Bubble / Structure` gained a `Customer phone card` theme and dropped its
  `showPointer` boolean. `Bubble / Text`'s `👁 Time stamp` and `TextInput`'s
  `innerLeft` now default to off.
- Visual specs were recaptured for the `Button`, `Icon Button`, `Link` and
  `Additional components` pages. Only Button and Icon Button actually moved; the
  rest read back identical, which is the answer worth having.
  [`reference/generate.md`](pushpin/reference/generate.md) and
  [`scripts/extract.md`](pushpin/scripts/extract.md) had worked examples built on
  the old Button keys and themes, and now carry the current ones.

**Added**

- **`build-specs.mjs --merge` folds a few recaptured pages into the committed
  specs.** The distiller only ever wrote the whole asset, so answering "Button
  moved" meant re-reading all 45 pages — 118 owners across a file that truncates
  a page read well before it finishes — or hand-editing a capture, which
  `verify.mjs` is built to catch. A merge replaces a page it read whole, keeps
  every page it did not read, and drops a carried entry the catalog no longer
  holds rather than carrying a `verify.mjs` failure forward. Provenance moves
  from one `extractedAt` for the file to a `source.pageCaptures` map of page to
  date, so a page last read six weeks ago cannot pass as fresh on the strength of
  a page read today. A page read under an `ONLY` list — which `Additional
  components` and its 41 owners must be — keeps its earlier date and is named in
  the run output, because it is no fresher than the part nobody re-read.

## 0.17.0 — 2026-09-01

A services catalog was checkpointed at whole-modal cards and handed over with
eighteen cards showing one panel each. Nothing in the run was reckless. Mid-build
it found the file's local modal component hard-wired a pane-head the prototype had
replaced with a combobox, judged hiding it a forbidden instance override, judged
hand-building eight modals too expensive, narrowed every card to a single panel,
and disclosed the retreat accurately — in the last paragraph of a summary written
after the work was done, to a user already looking at the wrong artifact.

Three separate holes let a sound chain of local decisions arrive somewhere the
user had refused: nothing said a stated region survives contact with a blocker,
nothing put the cost of a wider region in front of the person paying for it, and
`flows.md`'s smallest-enclosing-region rule reads as a licence for the cheaper
artifact to a run under cost pressure.

**Changed**

- **A stated region is a commitment.** Once the checkpoint's preamble has named
  the region and an answer has come back, a blocker found mid-build stops the run
  and returns with the blocker and the choices. It does not narrow the region and
  disclose in the summary. A blocker found *before* the checkpoint is a departure
  and belongs in the preamble like any other — a stale local component by name,
  since reading the component costs nothing and happens before any card exists.
- **The checkpoint states what a wider region would cost.** Where the derived
  region is narrower than the surface its states live in, the preamble names the
  alternative and its price in one clause. Deriving the region is not the user's
  to do; the spend is, and a run that resolved it quietly in favour of cheap is
  what this release is about.
- **Coupled regions resolve to their parent.** Two sibling regions where one's
  content is a function of the other's state — a rail and the pane it drives, a
  filter column and its results, a step list and the step — are one region, and
  the answer is the parent holding both. The rail alone shows a press with no
  result; the pane alone shows a result with no cause.
- **The panels of one modal are never separate lanes**, stated in the merge signal
  rather than left to be derived from it. The region is derived from the lane, so
  a lane holding one panel can only ever produce a card holding one panel.
- **The region valve tests intelligibility, not visibility.** A state whose change
  is *unreadable* at its lane's region is the signal, replacing *invisible*. A
  tinted row in a rail is plainly different from the card beside it and still does
  not say what the selection produced, so the old test passed exactly the artifact
  it existed to catch.
- **The audit's note-overlap check is scoped to the artifact being audited.** The
  walk stays page-wide because the stale index leaves nowhere narrower to walk
  from, so the comparison is scoped where the walk cannot be: the nearest ancestor
  named `<frame> — annotated`, or the frame itself where there is none. Two notes
  belonging to two artifacts, each laid out correctly, no longer fail a run.

**Added**

- **A batch path for a request covering several surfaces.** One artifact per
  surface, enumerated before anything is written; one skeleton call claiming every
  artifact's frame in sequence, because five calls choosing where a frame goes on
  one page are five guesses about the same free space; then one subagent per
  artifact, with the six-lane ceiling applying per artifact rather than to the
  batch. The catalogs stack in an auto-layout column at a gap of 96 — no
  coordinates, so nothing can overlap.
- **One checkpoint for the whole batch, one line per artifact.** The line carries
  the region and the lane count. Five catalogs at five lanes each is twenty-five
  stated lines, and the argument for stating rather than asking rests on a wrong
  guess costing one correction — at twenty-five it costs a careful read of a wall,
  which is the same as costing nothing. An artifact whose lanes genuinely differ in
  region spends the extra lines rather than hiding a mixture behind one.
- **A blocked artifact is set aside and the rest of the batch finishes**, with one
  return at the join naming every blocked artifact and what it needs. They share
  nothing with the blocked one, so stopping them buys the user nothing. What must
  not happen is finishing the blocked artifact anyway: its frame stays as the
  skeleton left it, shimmering, which the audit reports as a defect — the right
  outcome, since half a catalog at a region nobody approved is worse than an empty
  frame with a question against it.
- **A `neighbours` bucket in the Figma audit**, the eighth, reporting notes that
  belong to other work on the page and land on this artifact. It reports rather
  than fails: the note is real and a reviewer will hit it, but nothing in this run
  put it there or can move it, and failing over it hands the user a passing build
  only once they tidy something they never asked about. Both exemptions the
  artifact's own notes get are dropped — a pointer is meant to land on *its*
  design, and a note laid out inside a neighbour cannot cover the neighbour and can
  still cover this one.
- **A ninth way a catalog turns back into a flow diagram**: one half of a two-half
  interaction per card. Each row is internally consistent and the flow between them
  is gone, which is a transition diagram with the transitions deleted.

## 0.16.0 — 2026-09-01

The frame exists a long time before anyone is told where it is. The skeleton
call creates it and hands back its id, the fill lanes then go out in one message,
and that message does not continue until every one of them has come back — so
the user gets one silence of unknown length and then a finished frame, with the
canvas they could have been watching the whole time never named.

A flow catalog is the worst case and the most common one. It is a dozen states
across several lanes where a screen is one frame, it is net-new by construction,
so there is no original for it to appear beside, and where the checkpoint sent it
to a review page the user is not even on the page it is landing on.

**Added**

- **The frame's link is handed over as soon as the skeleton returns**, in that
  turn and before the fill lanes are issued. Built from the returned `frameId`
  and the user's own link — the path through the file-name segment, the query
  dropped, `node-id` appended with the colon as a hyphen — so it costs no call
  and waits for nothing. The step 7 summary repeats it, since by then the whole
  of the run's output sits between the reader and step 4's copy.
- **One link, to the frame.** A lane writes inside it, so the frame's link
  already reaches every lane's work, and a link per lane is six links to one
  place. A review page this run created needs none of its own either: the frame's
  id opens the page.
- **It answers the length complaint from the batched rung.** The silence was in
  the chat rather than on the canvas — lanes land as they land whichever rung
  issued them — so a run whose length is the objection no longer has a reason to
  climb to subagents that speed alone would not have given it. That rung is for
  lanes with thinking to do, which is what it was for.

## 0.15.0 — 2026-08-31

Pushing a flow into Figma was preceded by the same hand-written instruction every
time: replace this in Figma, but do not replace it — put a new version somewhere
on the page. The plugin already worked that way, and never said so. A default
nobody is told about is a default nobody can rely on, so the user restates it in
the prompt and pays for the restatement on every push.

The same run then spent two passes nobody asked for. Annotation is a second round
of writes against a second library, and correcting the strings that came in with
the source is a script call plus the corrections it argues for — both worth their
cost on a handoff, both wasted on a first look at a layout.

**Changed**

- **The checkpoint is one `AskQuestion` with two questions.** Where the work
  lands — beside the original, a clean review page, or a page the user names —
  and, as a multi-select, which of annotation and the incoming-copy pass to run.
  It stays one turn, which is what it cost before: the page-context offer and the
  statement of what would be built were already folded together, and the
  departures, the lane list and each lane's region, and anything the preflight
  degraded are all still stated in the preamble rather than asked about. The
  destination answer is what accepts them.
- **Finalize can replace the original, and replacing does not delete.** The
  offer after the work is accepted is its own page, or the original's place with
  the original renamed `— archived [date]`. A move and a rename are both visible
  and both undoable by hand, which is the form of "replace this flow" the undo
  argument permits — what it refuses is overwriting, not superseding. Still
  offered, never performed, and not offered at all when the audit did not pass.
- **Annotation and the incoming-copy pass are opt-in on the push path.**
  Composing copy correct as it is written is not, and never was: a button that
  loses two words is a button whose row was balanced around the old width, so it
  cannot be a pass afterwards. The other direction does not ask either —
  correcting a frame's words on the way into markup is where the code is still
  the cheap thing to change.
- **Declining annotation does not manufacture defects.** The audit is told
  whether step 6 ran. Without it, a `Proposed /` component with no note reports
  into `proposed`, recorded drift with no `Token drift` note is the `drift`
  bucket and nothing more, and `degraded` stops naming a library the run never
  reached for. The disclosure moves rather than lapses: step 7's summary carries
  every proposal, every unresolved atom and every snapped value beside the number
  that was asked for, and the finalize offer carries annotation with it so the
  canvas can catch up. A note that does exist is still held to every field.

## 0.14.0 — 2026-08-28

A copy check asked for in one sentence took eight minutes and answered in
several pages of prose. Three things caused that, and all three were the
plugin's, not the model's.

The strings were not reachable. `check.mjs` read markup and five attributes, so
every placeholder, accessible name and announcement a script hands to an element
was invisible to it — which in a hand-rolled prototype is most of the copy on the
screen. Answering anyway meant grepping the files by hand, labelling 23 strings,
and running them back through `copy.mjs` in four separate calls. Two real
findings were being missed silently the whole time: a passive line and
`contractors` for `pro`, both assigned through `textContent`.

There was no shape to answer in. The lane's own doc said there is no score and no
rewrite block, so the only model for a report was paragraphs, and the two docs
read to find that out are 380 lines between them.

And the lane did not stop. `audit.md` said code and words are advisory, then said
nothing about editing, so the run ended by applying fixes, rewriting the README,
screenshotting the result and re-running a 30-check browser harness — none of it
asked for.

The same check now runs in one command and answers in a table. On the project
that produced the eight-minute run: 120 strings, 44ms.

**Added**

- **`copy.mjs --report`.** A score out of 5 and a markdown table — `Where`,
  `Current`, `Suggested`, `Why` — one row per string that broke a rule. Takes
  files or a directory. `--json` carries the score and the suggestions too.
- **The score is the upstream's own ladder**, parsed out of the capture into
  `copy.json` like every other rule rather than invented here or hardcoded in the
  engine, so a rung Content Design moves moves with a rebuild. An unrecognised
  rung is a build failure. 4/5 is the mechanical ceiling and the report says so,
  because the rung above it is P1 and no pattern decides that.
- **Suggestions, where the rules state one.** A banned phrase with a literal
  replacement, a term Thumbtack prefers, a title-cased word sentence case
  lowercases — with the capitalisation and plural of the word being replaced, so
  `Contractors` comes back `Pros`. The four codes that need a decision about
  meaning are left blank and named, rather than filled with something plausible
  that nobody chose.
- **Copy assigned in script is read.** `setAttribute('aria-label', …)`,
  `.placeholder =`, `.textContent =`, `.title =`, `.ariaLabel =`. A bare
  `const EMPTY = '…'` is still not read: that copy reaches a reader through the
  markup that interpolates it, and treating every string constant as copy is how
  a check starts firing on identifiers.
- **A `placeholder` attribute resolves its own length row**, which is a limit the
  walk could not previously reach without a `data-pp-component`.
- **The rows are numbered, and `--apply` writes the picked ones back.** The report
  is still the answer and still changes nothing; the fixes are then offered as a
  list to choose from, and what comes back is applied by number —
  `--apply 1,4` for the suggestions, `--apply '{"3":"Save areas"}'` for other
  wording. Applying by number rather than by hand is what makes an interpolation
  survive a fix: a suggestion is spliced span by span, so
  `` `Contractors near you. ${count} within ${miles} miles.` `` keeps both values
  and changes one word. It is also the only way to fix one occurrence of a string
  that appears in four files, where a replace on the text either refuses as
  ambiguous or changes all four. Refused, with the reason, on a row that does not
  exist, a row with no suggestion to take, a string not in a file, and wording of
  your own over a string holding a runtime value.
- **`data-pp-content` marks copy that is not Thumbtack's to write.** A pro's
  headline, their service description, a review a customer left. The rules are
  Thumbtack's voice, so a region marked `data-pp-content="pro"` is left out of the
  report, the score and any fix. It covers everything under it, because pro content
  arrives as a block, and `data-pp-content="app"` on a child hands that part back,
  because the app layer reaches inside one. For a string a script assigns, a
  `// pushpin-content: pro` comment covers its line and the next.

  Unmarked, a pro's `Bay Area's Finest Plumbing — Serving You Since 1998` came back
  as six title case findings and a suggestion to lowercase their business name, and
  the score those findings dragged down was the app layer's. Most pro content never
  needed this — it arrives as a value, and a value is not a literal — but the copy
  typed into a prototype as a stand-in for a pro's is exactly what a mock is full
  of. The report prints how many strings a marker exempted and who it attributed
  them to, so a marker on the wrong element cannot quietly empty a report.

**Changed**

- **`copy.mjs <path>` on markup or a script now walks it for strings** instead of
  reading the whole file as a copy deck. Pointing it at a `.js` file used to scan
  the code as prose. A `.md`, `.txt` or anything else is still read as a deck, and
  its labels are still the input form.
- **One string extractor, in `lib/copy-strings.mjs`**, shared by `check.mjs` and
  `copy.mjs` for the reason `lib/copy.mjs` is one engine: the edit hook and a
  deliberate audit must not disagree about what a file says.
- **`audit.md` has a copy lane with an output contract** — relay the table, fill
  the blank cells, add rows for what the engine cannot see, offer the rows as a
  pick-list, and apply only what comes back. No screenshots, no harness run, no
  sweep of the rest of the repo, no edit nobody picked. `SKILL.md` carries the
  command so neither reference doc has to be read to run it.
- **`copy.md` no longer says the rules apply to everything on the screen.** They
  apply to the app layer. The page carries the marker, the values that hand a
  region back, and why a pro's own words are not ours to correct.

**Fixed**

- **Sentence counting broke on abbreviations and initials.** `e.g. Atlanta, GA`
  counted as three sentences and was reported as over the placeholder's two, and
  `J. Alvarez` split a sentence in half. A terminator now ends a sentence only
  where what follows could open one, and known abbreviations do not end one at
  all. This affects every sentence-based limit: body text, modal body,
  placeholder, confirmation, error message.
- **The published-variables check sent you to a file that could not answer it.**
  `getAvailableLibraryVariableCollectionsAsync` reports the libraries a file has
  switched on rather than the ones it can read, and it answers a file with none
  switched on with `[]` — the same answer it gives when the library has been
  unpublished, which is the one outcome §2 says to stop on. The check that catches
  a re-keyed token was therefore unrunnable, and the reason read as the emergency
  instead of as a setting. §2 now names a file that has them enabled and says how
  the two failures differ. The scratch file the component pass uses is right for
  that pass — `importComponentByKeyAsync` resolves from the key alone — so a file
  that serves §3 can still return nothing here.
- **`diff.mjs --published` compares in one direction.** It walks the committed
  keys and asks whether each is still published, so a variable *added* to a
  published collection is invisible to it, which is the ordinary way
  `variable-keys.figma.json` falls behind. §2 now asks for the reverse comparison,
  and carries the import pass that proves the keys still resolve — the thing a
  name-and-key comparison cannot tell you.
- **`variable-keys.figma.json` kept its verification as a sentence.** The only
  evidence that its 131 bindable keys resolve was prose dated 2026-08-06, which
  nothing reads and nothing ages. `verifiedAt`, `verifiedIn` and `verifiedCount`
  now hold it and the sentence is written from them. That matters more here than
  elsewhere: `freshness.mjs` checks variables over REST, which is Enterprise-only
  and skips with a 403 on every other plan, so on those plans this field is the
  only record that the keys were checked at all.

**Changed (capture)**

- Re-verified against the kit on 2026-08-29: all 131 bindable keys import, and the
  published set matches the committed one in both directions — no token added,
  removed, renamed or re-keyed since 2026-08-06.

## 0.13.5 — 2026-08-28

Annotation Kit re-capture, taken because the freshness run reported a component
edited 2026-08-24 against a 2026-08-10 capture. That finding was real. All four
pages were re-read and the counts close exactly as before — 111 component nodes
found, 20 unpublished, 91 kept — so nothing was added, removed or renamed, and
one variant option moved.

This is also the first Annotation Kit capture taken through the publish-status
gate rather than the `_…` name rule. The same 91 components come back, which
settles the question the old rule left open: nothing was hidden behind a name.

**Breaking**

- **`Team Member` lost the `Katie Hansen` option and gained `Team member37`.**
  `setProperties({ 'Team member': 'Katie Hansen' })` now throws; the option is
  `Kallen Michaels`. The roster went from 36 names to 37. Nothing in the skill
  quoted the old option, so this only affects a board holding an instance set to
  it.

**Changed**

- **`annotations.figma.json` records `unpublishedOmitted` where it recorded
  `internalOmitted`.** Same count, honest provenance: 20 is now what
  `getPublishStatusAsync()` excluded rather than what the name rule guessed.

## 0.13.4 — 2026-08-28

The scheduled freshness run reported that a component in the kit changed on
2026-08-26, after "the capture (2026-08-06)". The components catalog was
captured 2026-08-27, a day after that edit. The date in the finding belonged to
a different capture.

An import pass over all 115 committed keys, read from a subscribing file rather
than the kit, confirms it: every key resolves, every published name matches the
catalog, and `build-components.mjs --properties-only` rewrote 0 of 115 entries.
The catalog was already current.

**Fixed**

- **`freshness.mjs` dated the components layer by the tokens capture.**
  `manifest.capturedAt` is `tokens.figma.json`'s `extractedAt`, and the
  components catalog carries its own. The two are captured separately and were
  three weeks apart, so every component edit made between them read as drift the
  catalog already had. The layer now compares against
  `components.figma.json`'s `source.extractedAt`.
- **The `updated_at` sweep was narrowed to catalog keys for components and
  annotations.** Only the icons layer passed `ours`, so the other two swept every
  published component in their file — including the 3 the kit publishes that the
  catalog drops as name collisions — and an edit to one of those reported as
  drift in something Pushpin does not track.

## 0.13.3 — 2026-08-28

The catalog's properties came from the kit's working file, and that file runs
ahead of the library. Measured across all 115 entries, 6 disagreed with what the
library serves. `Button` is one of them, which is on nearly every screen: the
library publishes `Label#13326:0`, `Icon Left#22316:0` and `Icon Right#22316:261`
and offers `size` as `xlarge small medium large xxlarge`, while the catalog
reported neither icon slot, no `Label` at all, and `size` as `default small`. A
run that took `size: 'default'` from the catalog throws, because no such variant is
published.

Nothing had noticed because every check compared the repo against itself.
`getPublishStatusAsync()` cannot separate the two either — all 115 report
`CHANGED`, including the 109 that agree perfectly, so publish status carries no
information here.

**Breaking**

- **`components.figma.json` now carries the library's property ids, and 10 entries
  changed.** `Button`, `Icon Button`, `Link`, `Bubble / Text`, `Bubble / Structure`,
  `_Bubble / Text`, `_Stamps`, `Messenger Elements / Composer`,
  `Modal / Factory / Main` and `Modal / Promotion`. The other 105 are
  byte-identical, which is the check that nothing else moved. Anything holding a
  copied-out property id for those 10 needs to re-read it — `Button`'s
  `icon#34740:123` and `👁️ Icon#34731:2` never existed in the library, and its
  published slots are `Icon Left#22316:0` and `Icon Right#22316:261`.
- **`Button.size` no longer offers `default`.** The published options are
  `xlarge small medium large xxlarge`, and `size: 'default'` throws. `theme` gains
  `subtle` and `solid`. `State` loses `disabled` and `loading`, which are now the
  separate `isDisabled` and `isLoading` variants.
- **`Bubble / Text.Theme` is `Received`/`Sent`, not `Recipient`/`Sender`.** The
  file's names never worked against the library. `_Bubble / Text` — served as
  `ChatBubble` — gains `tailPosition` and `orientation`, so two thirds of what it
  can do was previously invisible.

**Fixed**

- **The capture now takes property ids, variant options and defaults from the
  library instead of the file.** [extract.md §5](pushpin/scripts/extract.md)
  already imported every key to read its published name; the definitions ride back
  on that same round trip, so this costs no extra Figma calls. The INSTANCE_SWAP
  default stays with the file's reading, which is the one field the library cannot
  supply: published definitions give a component key, while the dump gives a node
  id that resolves to `_Arrow-Left Icon · Tiny` and the `Tiny` that sizes an icon
  slot.
- **A capture taken without the import pass now says so.** It falls back to the
  file's properties and lists every affected component under
  `source.propertiesFromDump`, and `diff.mjs` reports that it skipped the property
  comparison rather than reporting no drift. Silence there is what let this sit.
- **`diff.mjs` no longer compares properties it cannot compare like with like.**
  The committed catalog now holds the library's ids; a capture without
  `publishedProperties` distils the file's, so comparing them would have reported
  `Button`'s `Label` as removed and its real ids as changed on every run, for six
  components.
- **Variant option drift is the half a property-name check misses.**
  `Bubble / Text` publishes `Theme` as `Received`/`Sent` while the file calls the
  same axis `Recipient`/`Sender`, so `setProperties({ Theme: 'Recipient' })` throws
  today. `_Bubble / Text` is the mirror image: 4 variants in the file against 24
  published, so the catalog was hiding two thirds of what `ChatBubble` can do.
- The deprecated `file_read` scope is gone from `freshness.mjs` and
  `maintaining.md`. `library_content:read` is what the key layers need, and it is
  the narrowest scope that covers them.
- **A capture that cannot account for the whole dump is now refused.** Membership
  asks for `CURRENT` or `CHANGED` rather than testing for `UNPUBLISHED`, so a node
  the sweep never reported falls out of the catalog instead of into it, and
  `loadCapture` counts the status map against the dump and names what it missed.
  The sweep goes out 300 ids at a time over 1074 components; a lane that failed
  quietly was indistinguishable from a lane that reported nothing, and would have
  put keys that throw at import back in the catalog by the same route the name
  rule did. `M`, `?` and `E` are refused too — they are the sweep saying it has no
  answer, and only the three values `getPublishStatusAsync()` returns are accepted.
- **`--properties-only` reads both capture shapes and can no longer empty a
  properties block.** The compact form the sweep sends and
  `componentPropertyDefinitions` saved verbatim are now told apart per entry.
  Reading the second as the first yielded no definitions at all and deleted the
  properties the run was asked to refresh, reporting it as a change — and
  [extract.md §5](pushpin/scripts/extract.md)'s own snippet produces the second.
  A capture publishing nothing for a component the catalog records properties for
  now writes nothing at all, because that is a bad capture far more often than a
  real change and a real one is structural.
- **`--properties-only` requires `capturedAt`.** It was defaulting to the run
  date, which dated the distillation and called it the capture. `.cache/` is
  gitignored, so `source.propertiesCapturedAt` is the only provenance that
  outlives the run.
- **`--properties-only` can clear `source.propertiesFromDump` but not add to
  it.** It never sees the dump, so recomputing the list relabelled the 14
  components that publish no properties as holding unpublished work.
- **A non-VARIANT property definition with no `#id` suffix is refused** rather
  than sliced against the absent `#`, which dropped its last character and
  shipped the result as a property name.
- **`check.md` §3 told you to skip the import pass** while
  [maintaining.md](pushpin/reference/maintaining.md) told you not to. The pass
  carries `publishedProperties` as well as `publishedNames`, and only the names
  are optional. Its `diff.mjs` invocation also still named the pre-gate
  `components-raw.json`.

**Changed**

- **`--properties-only` refreshes properties without re-pulling the dump.**
  `node scripts/build-components.mjs --properties-only <capture>` rewrites ids,
  variant options and defaults against the committed catalog. The two halves go
  stale at different rates and cost different amounts to check: properties move on
  every republish and are what throws a run mid-screen, while the 1074-entry dump
  matters only when a component is added, removed or renamed. It warns when a
  captured key matches no catalog entry, which is how it says the full capture is
  needed after all.
- **`generate.md`'s Button table and the catalog now agree, and that is checked
  rather than assumed.** The table was measured against the live library while the
  catalog said something else; they were reconciled by fixing the catalog, not the
  table.
- **`defaultSize` is absent on 8 of the 14 `INSTANCE_SWAP` properties**, Button's
  two among them, because a published slot reports its default as a component key
  the capture cannot resolve to a name. Nothing regressed — those 8 are slots the
  catalog never knew existed — but the icon rule was overstating what it could be
  read ahead of a run, so the read off the configured instance is now the only
  answer offered for them.
- **`--allow-skip` makes `--strict` usable below Enterprise.** The variables layer
  needs `file_variables:read`, which Figma grants only to full members of
  Enterprise orgs, so `--strict` alone failed every run on a gap the operator
  cannot close — and a check that always fails is a check that gets muted.
  `--strict --allow-skip variables` still fails on an expired token, a lost file
  grant, or a rate limit. An unknown layer name is fatal rather than ignored,
  because a typo would quietly restore the false confidence the flag exists to
  prevent.
- **A scheduled check now asks Figma rather than waiting for someone to
  remember.** [`.github/workflows/pushpin-freshness.yml`](../.github/workflows/pushpin-freshness.yml)
  runs daily and on demand, with the token as a repository secret. Consumers of
  the plugin never need one; session start is `--offline --session`.
- **Geometry deliberately keeps coming from the file.** The library can publish
  something broken: all five published `Tabs` `Theme=Even` variants measure 565×2
  where the file has 565×41, a 40px row of links over a 1px rule, and the five
  `Theme=Split` variants match to the pixel on both sides. Sourcing geometry from
  the library would have written that 2px into `DESIGN.md`, `lookup --variant` and
  `check.mjs`'s fidelity findings. Published state settles what a call must match;
  it does not settle what a component should look like.
- **The materialization measurements moved out of `generate.md` and into the
  upstream report.** Reference files load into every designer's session, so a
  paragraph is a recurring cost paid 40 times over while the rule it justifies is
  five lines. `generate.md` grew 9.4KB across this release rather than 15.5KB, and
  what remains of the growth is the slot rewrite, the key preflight and the
  chunked skeleton rather than prose. The evidence is still written down, in
  [UPSTREAM-figma-materialization.md](UPSTREAM-figma-materialization.md), which
  nothing loads at generation time.
- **The write path resolves a property id with `idFor` off the component it is
  about to instance.** No extra round trip, no extra tokens, and immune to the
  suffix churn a republish causes — so a catalog that goes stale between refreshes
  degrades into a naming question rather than a thrown call.

## 0.13.2 — 2026-08-27

Three times now a Figma write has failed, been diagnosed, and been fixed, and
three times it came back wearing a different face. Once it was a page that had
not been loaded. Once it was a conclusion that `findAllWithCriteria` never
descends into instances — false, and disprovable in one call: 2,413 text nodes on
one page agree exactly across criteria, predicate, and a manual walk. Once it was
a fresh clone. All three are one bug, which is why fixing each of them
individually never held.

A subtree this call produced with `clone()` or `detachInstance()` answers searches
from a view of itself that was never filled in. Nothing throws. The short answer
comes back with nothing on it saying it is short, so it reads as a finding, and
the failure surfaces somewhere else entirely — a `slot` that is `undefined`, a
`Parent not found`, an audit that passes clean. Measured on a cloned frame
containing an instance: `findAllWithCriteria({ types: ['FRAME'] })` returns 0
where 9 is correct, `findAll(() => true)` returns 1 of 24, `query('FRAME')`
returns 0 of 9, and a `findOne` for a `TEXT` node simply does not find one.

**Fixed**

- **`figma.skipInvisibleInstanceChildren = false` is now the rule, stated once in
  [generate.md](pushpin/reference/generate.md) and referenced from everywhere
  else that clones or detaches.** One assignment removes the blind spot rather
  than reducing it: the cloned frame above then reads all 44 of its nodes on the
  first call, before anything has walked it. It has to be set per call, because
  the flag reads back `true` at the start of every script whatever the last one
  set — which is itself a divergence from the plugin typings, where the default
  is documented as false outside Dev Mode. The recursive `materialize()` walk that
  earlier analysis proposed is kept only as a footnote: it costs about as much as
  one traversal, has to be remembered at every creation site, and with the flag
  left alone it still leaves a run reading 455 of 1,205 nodes.
- **The scope is narrower than the earlier diagnosis claimed, and saying so is
  the point.** `createInstance()` never reproduced this across eight conditions,
  including a depth-8 subtree with 11 nested instances, so the sites built on it
  take no guard and the docs say why rather than adding one defensively. Cloning
  an *instance* is safe; cloning a frame that *contains* one is not. Cross-call is
  always clean, which is what keeps the lane contract free of a guard it would
  otherwise have acquired forever.
- **Re-running a failed search looked like a fix and was not.** `findAll`,
  `findOne`, and `query` return the unfilled view and fill it as a side effect, so
  a second call looks correct and buries the cause; `findAllWithCriteria` reads an
  index the subtree never populated and never corrects itself. Three of four APIs
  quietly healing is precisely how this survived being diagnosed three times.
- **The audit could pass clean on a file it had only partly read.**
  [audit-figma.md](pushpin/reference/audit-figma.md) now sets the flag and asserts
  against stale traversal before it walks, so a partial read fails loudly instead
  of reporting no findings. Its coverage claim was overstated for the same reason
  and now carries the measured number.
- **A lane that failed halfway could not be recovered by re-issuing it.**
  [parallel.md](pushpin/reference/parallel.md) claimed `use_figma` atomicity made
  re-running safe. Atomicity is per call, so a multi-call lane leaves partial work
  and a re-run duplicates it. The recovery is now bounded and reads from the
  canvas: empty the section's children and re-run it.
- **The documented way to fill a Modal could never have worked.** The slot recipe
  in `generate.md` was written against `SLOT` properties that exist in the
  library's working file and in no published component — importing both
  slot-bearing Modals returns zero `SLOT` nodes and no `SLOT` property between
  them. Modals take their content through an `INSTANCE_SWAP`, which is what the
  section now documents. The audit keeps its slot handling, with a note that it is
  currently inert and should not be simplified away.
- **The access preflight's capability probe could not fail.** A bare `typeof` on a
  missing property throws in the `use_figma` sandbox rather than returning
  `undefined`, so the negative branch and the cross-check it documented were both
  unreachable. Also in `generate.md`: the icon-size read matched the wrong layer
  name and took the size off a node that does not carry it — `Icon / Left`
  measures 14×14 while the component behind it is a 28px icon.
- **`build-components.mjs` said the kit declares no `preferredValues`.** All 14
  published `INSTANCE_SWAP` properties declare them, two of them the entire icon
  ramp at 120 and 194 legal values. The catalog ships none, because the raw dump
  the build reads does not carry the field — so every swap slot in the kit is the
  empty-icon failure that comment was written to prevent. The comment now records
  what is actually true; the capture change it implies is not in this release.
- **The catalog is now the list of published components it always claimed to
  be.** It was the file's components minus those whose name starts with `_` or
  `.`, and a leading underscore is a convention, not a publish state. It was
  wrong in both directions. Four entries held keys that no import could resolve,
  because those components live in the file and were never pushed to the library
  — `Bubble / Media`, `Messager / Media modal`,
  `Messager Elements / Composer / Image`, and
  `Core / Safari (Big Sur) / Toolbar / Toolbar Item`, the last being scaffolding
  misnamed relative to the 17 `_Browser / …` siblings it belongs with, which no
  name rule could ever have caught. A generation run asking for any of them threw
  mid-write. In the other direction the rule dropped two components the library
  does publish: `_Bubble / Text`, published as `ChatBubble`, and `_Stamps`,
  published as `Messenger Elements / Stamps`. The capture now calls
  `getPublishStatusAsync()` on every candidate — 1,074 nodes in four batched
  `use_figma` calls of 300 ids each, none of them truncating or erroring, since
  the ten-operation guidance in `figma-use` is about writes and these are two
  reads a node — and the build keeps a component if and only if the library says
  it is published. 117 entries became 115. The name test survives only as a
  cross-check: `source.nameStatusDisagreement` names all ten components whose
  name and publish state disagree, which is the signal that would have surfaced
  this without a failed generation run. Four entries whose published name differs
  from the name the file carries now record it as `publishedAs`, because a
  component renamed after its last publish keeps the old name in every consuming
  file — the library serves `Bubble / Text` as `Messenger Elements / Bubbles`.
  `component-specs.figma.json` loses the four specs that described components
  nothing could place, and `build-specs.mjs` now drops a spec the catalog does
  not hold rather than recording one. All 115 keys were swept through
  `importComponentSetByKeyAsync` and `importComponentByKeyAsync` after the
  rebuild; all 115 resolve.
- **`lookup.mjs` could not find a component by the name the library serves it
  under.** `publishedAs` made the catalog honest about the four renames and left
  the search matching catalog keys only, so `lookup.mjs ChatBubble` answered
  "nothing matches" for a component the kit publishes under exactly that name —
  the name `search_design_system` returns and the one a designer says out loud.
  Both names now resolve to the one entry, and the entry prints what the library
  serves it as. The counts in `figma.md`, `propose.md`, `audit-figma.md`, and
  `maintaining.md` followed the catalog down to 115.

**Changed**

- **The skeleton no longer builds everything before anything appears.** It claims
  the frame and the section containers and stops; each lane creates its own cards.
  Work lands in reading order as it completes rather than arriving in one dump at
  the end, and a lane that throws now costs one section instead of the whole run.
- The recap line's version reads `Pushpin v<version> loaded.` for the agent to
  substitute, rather than a number hand-edited on every release.

## 0.13.1 — 2026-08-25

The state catalog shipped last release and then went unread. A request phrased as
a push — "send this flow over to Figma" — fits the `generate` routing row word for
word, and [flows.md](pushpin/reference/flows.md) was reachable from exactly one
cross-reference, buried three hundred lines into `generate.md` inside the capstone
exception. So the arrangement got skipped, and with it the one question a card's
subject turns on, which the plugin then asked the user out loud instead: how much
of the panel should each state card show.

**Added**

- **How much of a surface a state card shows is now a rule.** A card holds the
  smallest region containing every element its lane's bullets mention, and every
  card in that lane holds the same region — the lane being the unit because the
  row is what gets read, and a comparison between two cards only works when both
  are the same crop of the same thing. Both ends of the range had to be ruled out
  for their own reasons: six full screens across a row reduce the difference
  between two states to a few points of a very large picture, and the changed
  element on its own does not say where it lives. The region is settled by which
  component gets instanced rather than by masking, since `clipsContent` is already
  false on every structural frame in a catalog. Two consequences worth naming.
  Lanes are free to differ from each other, because nobody reads two rows at
  once. And on the reflow path the source has already decided it — a state drawn
  as a full page is duplicated as one, because narrowing it means rebuilding it —
  so what binds there is the consistency rather than the extent, and a lane mixing
  a full page with a panel detail rebuilds the single state that does not match.
- **A state whose change is invisible at its lane's region is a fact about the
  lane.** Either it is grouped with states it does not share a journey with, or it
  belongs in a different lane. Zooming the one card that fell short breaks the
  row's comparison for every other member of it, which is why it reads as the
  obvious fix and is not one. The whole-screen card joins the list of ways a
  catalog turns back into a flow diagram, now eight.

**Fixed**

- **A flow reaches `flows.md` before `generate.md` builds anything.**
  `generate.md` hands off in its own first section rather than from a buried
  cross-reference: several states of one surface is a single artifact whose
  arrangement is settled elsewhere, and this page is the half that knows how to
  place a component, not the half that knows what a flow spec is. The routing
  table says which of the two competing rows wins and that this one row loads two
  docs. And `generate.md`'s checkpoint now states the lanes and each lane's region
  in its one line — stated, never asked, which is the rule that page already held
  for every other departure and the one that was breached here.

## 0.13.0 — 2026-08-24

Setting a project up printed everything it had checked. Eleven `--verify` rows
whether or not any of them was a problem, an `--assess` block that closed on
`Ask: nothing — the project answers every open question itself`, and about sixty
lines of unconditional guidance after `init`'s writes — all of it in front of a
designer whose question was whether anything was broken and what to do next.
Meanwhile nothing in the flow checked the things that actually stop one: no Figma
MCP, the Figma desktop app closed, `impeccable` absent, a permission prompt in
front of every file edit, a marketplace install frozen at the capture it was
made with.

**Added**

- **`setup.mjs --ready`, and a new
  [`scripts/lib/environment.mjs`](pushpin/scripts/lib/environment.mjs)
  underneath it.** What is true around a project rather than inside it: which
  harness this is, whether `impeccable` is installed, whether the marketplace
  updates itself, whether Claude Code will prompt on every edit, whether Figma's
  desktop app is running, and whether `node` is new enough for `lookup` and
  `audit` at all. Everything it prints is a fault with a remedy, in the two
  prefixes `freshness.mjs` established — `fix:` for a command the agent runs,
  `say:` for the one sentence that needs the user — so a machine where nothing
  is wrong prints nothing, and it exits 0 whatever it found, for the reason
  `--session` does. Claude Code's two settings checks do not run on Cursor,
  which has neither setting; `--harness claude|cursor` overrides the detection
  when the environment lies about itself. The auto-update write is the one thing
  here that is not a read, and it is a command of its own —
  `node scripts/lib/environment.mjs --enable-auto-update`, named in the `fix:`
  line rather than reachable as a `setup.mjs` flag. That is not tidiness:
  [`lib/permissions.mjs`](pushpin/scripts/lib/permissions.mjs) pre-approves
  `setup.mjs` to run with no permission prompt on the stated grounds that its
  only write is an additive backup copy, and a promptless write into
  `~/.claude/settings.json` would have made that comment false the day it
  shipped. Nothing pre-approves the command that writes, so the harness asks,
  and that prompt is the consent. An `autoUpdate` already set to `false` is left
  exactly as found — the same rule `init` follows for the project copy, because
  re-deciding somebody's opt-out is not a repair — and a marketplace entry that
  is absent entirely means the plugin arrived another way, so nothing is said.
- **The handoff interview closes setup instead of a status report.** One
  `AskQuestion` call carrying two questions — whether the work starts from a
  Figma design or from scratch, and whether to prototype in the browser first or
  go straight to Figma — and then the route, and nothing else.
  [`reference/setup.md`](pushpin/reference/setup.md) has it, along with the two
  readiness checks no script can perform: the Figma MCP, answered by the tools
  being absent from the catalog or else by one `whoami`, and the three libraries,
  which reuse [`reference/generate.md`](pushpin/reference/generate.md) § The
  access preflight rather than inventing a second check for the same thing.
- **[`reference/impeccable.md`](pushpin/reference/impeccable.md), the
  pre-answers for `/impeccable init`.** Three of the questions that interview
  asks are already settled by this being a Pushpin project: the stack is static
  HTML/CSS, the platform is `web`, and the artifact is a design prototype bound
  for a Figma frame ready for engineering handoff — never a production surface,
  which is not a string in impeccable at all but a framing the agent invents at
  interview time, and is wrong in both directions at once. The answers live on
  Pushpin's side rather than as a patch to that skill, because an update to it
  cannot undo what it never held. The three product-truth questions are still
  asked, and are still not ours to answer.
- **[`reference/flows.md`](pushpin/reference/flows.md), a flow laid out as a
  state catalog.** Nothing here covered a deliverable that is the flow rather
  than a screen, and with no rule for it a handoff spec comes out as one frame
  per screen in the order they were drawn, labels in Title Case, and no
  statement of what moves a user from one to the next — which a reviewer can
  follow and an engineer cannot build from. The doc's own content is the
  reorganization: swim lanes consolidated by journey stage rather than by
  screen, one row per lane, state-descriptive labels in sentence case
  ("Shortlist visible", "Cap reached"), and each state's annotation carrying the
  behavioral contract instead of a description of the picture. Everything
  mechanical is a link rather than a restatement —
  [`reference/generate.md`](pushpin/reference/generate.md) for the access
  preflight, the single import batch, `space()`, and published styles;
  [`reference/parallel.md`](pushpin/reference/parallel.md) for the
  skeleton-then-fill invariant, the lane budget, and the ten-operation ceiling;
  [`reference/annotate-fallback.md`](pushpin/reference/annotate-fallback.md) for
  the drawn `Capstones` row when the Annotation Kit is out of reach. Two ways
  in, because the request means either one: **reflow**, where the states are
  already on the page and [`reference/context.md`](pushpin/reference/context.md)
  reads them off the name suffixes, and they are duplicated rather than
  reparented, since moving the originals edits the user's own document outside
  their undo stack; and **build**, where no states exist and each is generated
  through the whole of `generate.md`. Type comes from published styles and fills
  from bound tokens, as everywhere else, and every gap in the arrangement is on
  the spacing scale, so `space()` snaps nothing and no row carries a drift note.
  Reached from plain speech — "document this flow", "spec this for eng handoff"
  — and not an eighth command, on the same grounds as `annotate` and `propose`.
  `generate.md`'s instance-override prohibition gains one narrowly scoped
  exception for the compact capstone that heads a section: the rule protects
  claims about product structure, a restyled Button being a claim about what an
  engineer will build, and documentation chrome makes no such claim.

**Changed**

- **The close of setup is no longer a three-bullet recap.** It was faithfully
  relaying three script faults a designer does not need at that moment: the
  preview port, a `<link rel="stylesheet">` instruction, and `PRODUCT.md` as a
  status line. Setup now opens on the version that actually loaded —
  `Pushpin v0.12.1 loaded.`, from the `SKILL.md` frontmatter — then, on Claude
  Code only, an Auto `AskQuestion` before any shell command, including
  `freshness` and `--ready`. Accepting edits is not enough; that still asks
  about commands. After the writes, a missing `PRODUCT.md` is the next action,
  not a bulletin: one `AskQuestion` whose prompt is the why
  ("Impeccable provides advanced design tools that extend what the AI model can
  do."), then Install-and-init or Run-init against Skip. A project that already
  has the file goes from the version (and Auto, on Claude) to the handoff
  interview. The port, the CSS link, and `PRODUCT.md`-as-status join Never
  appears. `init --write` no longer prints the unreferenced-stylesheet `Next:`
  line; Rise and `.gitignore` stay. `--ready`'s permission-mode `say:` now
  names Auto, matching the opening question, and setup does not relay it —
  it already asked. `--verify` can still mark a held port `missing` for a later
  diagnostic; first setup does not recap it and does not run `--preview-port`.
- **Every step of setup reports faults and nothing else.** `printVerify` prints
  the `missing` rows with their remedies, `printAssess` prints the open
  questions, and `init --write` prints what a person still has to do: the Rise
  font only when the machine does not have it, and `.gitignore` only inside a
  git repository. The `Ask:` header went with the rest — printing "nothing to
  ask" is the process narrating itself, and it is what put "the project answers
  everything itself" in front of a user who had asked to set a folder up.
  Nothing is deleted: `--all` restores the row-per-check output in both
  `--assess` and `--verify`, byte for byte apart from the fault below, and
  carries the meaning it already has in `lookup.mjs`; `--advice` restores
  `init`'s explanation of what it wrote; `--json` is untouched. Quieting the
  scripts is not enough on its own, because script stdout is collapsed in both
  harnesses and the wall of text a designer reads is prose written up from
  output nobody asked to see, so `reference/setup.md` gains an output contract
  and a list of what never appears — modeled on
  [`reference/start.md`](pushpin/reference/start.md) § What never appears,
  which was written after the same failure.
- **`impeccable` is offered after the writes when `PRODUCT.md` is missing.**
  The previous rule said not to, and not even to mention it, on the grounds that
  the generated files are correct without it — true, and beside the point. What
  is missing without it is the product record every design command reads and the
  slop check on each edit, and a designer who was never told either exists does
  not go looking for them. The offer is the AskQuestion above, not `--ready`'s
  `say:` printed mid-setup.
- **The surface question is asked in one place.**
  [`SKILL.md`](pushpin/SKILL.md) § Which surface, `reference/start.md` § The
  question, and the handoff interview were three sites asking a version of "Figma
  or the browser", which on a project with no `pushpin.config.json` meant a user
  answered it, ran a setup that opens on the version and its own questions, and
  was asked again a sentence later. The interview asks last and inherits an
  answer that arrived before it.

**Fixed**

- **A project holding an older build of the tokens reported itself protected.**
  `pin.mjs` gained a `generated-stale` finding in 0.11.0 and `setup.mjs
  --verify` did not: it compared each generated file against the hash recorded
  when it was written, both agreed, and the row read `DESIGN.md, generated and
  unmodified`. So a project whose `DESIGN.md` and `.impeccable/design.json` were
  intact but built from a superseded capture closed with "This project is set up.
  Pushpin governs its tokens, components, and words, an edit check reports what
  drifts from them as you work, and the generated files are protected", and
  exited 0 — while every check behind those files enforced the older system. The
  recorded hash is now compared against `MANIFEST.hashes` as well, which is the
  comparison `pin.mjs` already makes, so the file is a fault with
  `init --write --force` as its remedy. Telling someone their files are guarded
  when they are not is the specific failure `--verify` was built after, and it
  survives the quieting as a line rather than a paragraph.
- **The audit reported a flow spec as defective on every section header, and the
  defect was the check.**
  [`reference/audit-figma.md`](pushpin/reference/audit-figma.md) flags any node
  named `Annotations`, `Capstones`, `Sticky Note`, or `Token drift` whose
  bounding box intersects the audited frame, and reports it as `overlaps the
  design frame`. That held while every annotation the plugin places is a sibling
  of the design, because then intersecting the frame and covering the design are
  one fact — so the check tested containment, named it overlap, and nothing
  distinguished the two. A documentation frame heads its own sections with
  capstones inside itself, which makes them two facts and a clean frame fail. The
  check now exempts a node the frame's own auto-layout placed — an unbroken chain
  of auto-layout parents up to the audited root, which cannot cover anything,
  since being laid out is what moved everything else out of its way. The note it
  exists to catch is one dropped on a design by coordinates, and that needs a
  break in the chain: an ancestor with no `layoutMode`, or a member with
  `layoutPositioning === 'ABSOLUTE'`. The second test is what keeps the exemption
  from being a hole, since an auto-layout frame can still carry an absolutely
  positioned child, and that child is exactly the note in question. The pairwise
  comparison between annotations is untouched.

## 0.11.0 — 2026-08-21

**Breaking**

- **`check` and `copy` are no longer commands.** `/pushpin check` and
  `/pushpin copy` no longer resolve. `audit` is the one name now, and it
  dispatches on what it was handed — a repo or a file of code, words with no
  design around them, or a Figma frame. Merging did not fuse three procedures,
  because copy was never a third one: `check.mjs` already reported it as a third
  finding class beside tokens and component identity, and the Figma audit already
  carried a `copy` bucket that it settles by handing the frame's strings to the
  same engine. What the standalone command uniquely reached was words with no
  design around them — a pasted paragraph, a draft file, a copy deck — which is a
  third target rather than a third procedure, and it spent a row in the routing
  table drawing a line the scripts had never drawn. `audit` survived rather than
  `check` because `check` already meant five things in this repo: the freshness
  probe, `scripts/check.mjs`, the edit hook that probe repairs,
  `scripts/check.md`, and any single rule inside any of them. `audit` meant one
  thing in every one of the twenty-odd files that use the word, so retiring the
  ambiguous name and keeping the unambiguous one costs two typed commands and
  gives a word back. The scripts are untouched — `check.mjs` and `copy.mjs` keep
  their filenames, flags, and exit contracts, and `--brief` is still what the
  edit hook relays — so nothing that shells out to them notices. What moved is
  the docs: [`reference/audit.md`](pushpin/reference/audit.md) is the routing doc
  now, picking the target and carrying the code and words paths, the Figma
  procedure it used to hold is unchanged in
  [`reference/audit-figma.md`](pushpin/reference/audit-figma.md), and
  [`reference/tokens.md`](pushpin/reference/tokens.md) and
  [`reference/copy.md`](pushpin/reference/copy.md) have handed over their CLI
  sections to become what they were always cited as — the token vocabulary and
  the content rules, with no command surface of their own. Plain speech is
  unaffected, which is most of why this is cheap: "check this repo" and "does
  this sound like us" were routed by the table rather than by the command name
  already, and they land on the same doc now that the name is gone.

**Added**

- **The catalog said `theme` accepts `secondary` and nothing said what
  `secondary` looks like.** `components.figma.json` comes from a Code Connect
  dump that carries the property API and no geometry at all, so a hand-rolled
  stand-in for a published component was built from one rendering of one state.
  A secondary button written that way was wrong on five counts, and the gap was
  papered over with the claim that Pushpin publishes no brand border token —
  `border/neutral/default` exists and always has.
  [`reference/rules.md`](pushpin/reference/rules.md) § Degrading now covers a
  claimed gap in the kit the way it already covered a claimed gap in the Plugin
  API: verify it against the kit before acting on it.
  `assets/component-specs.figma.json` is a new capture answering it: 44 pages
  read for 117 components, 456 variants recorded out of 1079 real children, one
  representative per axis option with every other axis held at its default, so a
  record is a statement about that option rather than about a combination.
  Reachable three ways. **`lookup.mjs <name> --variant "theme=secondary"`**
  prints the captured fill, border, radius, height, padding, gap and label as
  `--pp-*` names, and where nothing was captured it says so and names the read
  that returns it rather than leaving the silence that invited the guess.
  **`DESIGN.md` gains one spec line per appearance-bearing option** beside the
  variant axes it already listed — a `Resting:` line and a delta line per option
  that departs from it, 111 lines across the 28 components it describes, inside
  the existing `## Components` heading and bullet grammar so impeccable's parser
  consumes them. Where a component's option lines repeat an earlier component's
  verbatim, a single `Same as X:` line names them instead: an option line is a
  difference from its own resting appearance, so two components stating the same
  difference are saying the same thing even where their resting appearances
  diverge. `Icon Button` restated ten of `Button`'s lines and now cites them.
  And **`check.mjs` reports `variant-drift`**: a tag declaring
  `data-pp-variant="theme=secondary"` is now measured against that variant, not
  merely checked for naming something real, over the declarations it can
  actually resolve — an inline `style`, a `style={{…}}` prop, and a class rule
  found in the scanned files. It is silent everywhere else, the same discipline
  the copy check holds. A bound variable with no Pushpin token prints as its
  Figma path rather than being mapped to an invented name; the capture is
  shallow, so a state that only recolours an inner element shows no difference,
  and `--variant` says which questions it cannot answer.
- **Nothing in the repo had ever asked the kit whether the captures were right.**
  Every existing check compared the repo against itself, which is why a
  consistent misreading agreed with itself for four releases. `styles.figma.json`
  now records `letterSpacing` and `lineHeight` as Figma returns them,
  `{ value, unit }`, and `lineHeight` was not captured at all before;
  [`scripts/extract.md`](pushpin/scripts/extract.md) gains the text-style
  section it never had, so the file `$comment` sends readers to finally has a
  documented re-extraction path. `diff.mjs` compares both metrics and separates
  a moved value, which restyles, from a moved unit, which stops the build.
  `verify.mjs` goes from 923 checks to 3096: every unit-bearing group's `$unit`
  agrees with the table `lookup` prints from, every `.pp-*` utility's emitted
  `letter-spacing` resolves to the value the published style carries, every
  tracking token is referenced by as many utilities as call for it, every
  `CORE_COMPONENTS` name still resolves against the catalog — a renamed one used
  to make `DESIGN.md` emit 27 sections and say nothing — and every spec set's
  recorded reduction is re-derived from the variants beside it, since an
  unrecorded reduction reads as a complete answer.
  [`reference/maintaining.md`](pushpin/reference/maintaining.md) gains the two
  refresh steps nothing connected before: review `CORE_COMPONENTS` when the diff
  reports a new component, and recapture a changed component's visual spec, which
  the `--components` diff cannot see.
- **The browser preview is Pushpin's to keep up.** A prototype server started as
  an agent's shell job dies with that job — an interrupted turn, a torn-down
  terminal, someone hitting stop — and nothing notices, so the next edit lands
  against a page that cannot be reloaded and the reasonable repair is a second
  server racing the first on the same port. `init` now records a `preview` block
  in `pushpin.config.json`, and the edit hook asks whether the port is answering
  and starts `scripts/preview.mjs` when it is not: detached into its own session,
  so it outlives the turn, and serving `Cache-Control: no-store` on every
  response. That header is why a server is shipped at all rather than a command
  suggested — `python3 -m http.server` sends no `Cache-Control`, so the browser
  guesses a freshness lifetime from the file's age and answers a reload from a
  copy of the file that has since changed, which reads as the edit not working.
  A project with a `dev` script of its own keeps it: the port is recorded, the
  absence of an answer is reported, and nothing is started, because running
  someone's `next dev` detached and out of sight of the terminal they expect it
  in is not a design system's business. Nothing holding a port is ever killed —
  a port answering something else, including a preview of a different directory,
  is reported with `--preview-port` as the remedy and left alone. The preview
  rides inside the existing edit check rather than as a fourth manifest entry, so
  a project that already installed the hook gets it without re-running anything,
  and `.pushpin/pushpin-check.mjs --preview` brings it up without editing
  something first. This narrows the standing rule that Pushpin governs but does
  not build, and the narrowing is deliberate: the browser is where `check.mjs`
  and the token allowlist do their work and where the push back to Figma starts,
  so keeping it reachable is governing rather than building. `--no-preview`
  declines it, and a project set up before this existed records nothing until
  `init --write --force`, which `setup --verify` now says.
- **The words are Pushpin's now, on the same terms as the tokens.** A screen could
  bind every colour, instance every component, pass the audit clean, and still say
  "Please be advised that your request has been submitted" — the system had an
  opinion about the button and none about what it said, so copy fell to whichever
  skill happened to be in the room. Thumbtack's content design rules are vendored
  here on the chain the tokens already use: `pull-copy.mjs` captures
  [jallard-code/content-design-assistant](https://github.com/jallard-code/content-design-assistant)
  byte for byte into `assets/copy.source.md`, `build-copy.mjs --check` rebuilds
  `assets/copy.json` from it deterministically and fails when the committed file
  disagrees, and an adapter registry keyed by source kind means moving to the
  Thumbprint content design pages later is one `SOURCE` edit and one parser rather
  than a re-write. `assets/copy-map.json` is the one hand-authored file in
  `assets/`, joining the rules' own row names to real catalog components, and
  `verify.mjs` fails when a kit refresh renames one out from under it — the
  alternative being a component that silently stops having a length limit. Copy is
  governed three ways and they are deliberately different: written correct as a
  frame or a file is composed, the way a token is bound rather than a hex picked
  and fixed later; corrected on the way in from a Figma frame, with the change
  disclosed in a line, because a silently rewritten label is the same failure as
  silently snapped spacing; and reported on demand by `/pushpin audit`, over
  pasted text, a file, stdin, or a frame's harvested words. The engine decides
  seven of the rubric's sixteen codes and leaves the other nine as judgment, and
  there is no 1-5 score and no rewrite block anywhere — the upstream has both,
  and a score invites arguing with the number instead of fixing the line.
  `check.mjs` reports copy as a third finding class beside tokens and component
  identity, which `--no-copy` declines and `--component-only` does not, since
  that flag exists to defer to impeccable's live detector and impeccable has
  nothing to say about words. On a frame the audit gathers the copy and
  `copy.mjs` decides it, so no ruleset is ever restated in a script that cannot
  read a file; a critical becomes a defect and fails the run, and a frame
  carrying unsettled copy withholds both its verdict and its screenshot rather
  than reporting `ok` on words nobody read. `freshness.mjs` gives the rules their
  own layer on `GITHUB_TOKEN`, apart from the Figma captures, because a stale
  markdown file must not tell someone to re-capture the kit. Where the mechanical
  part stops is written down rather than implied: title case needs a capital a
  proper noun cannot explain, since most nouns on a Thumbtack screen are the name
  of a pro or a business, so it reads `Edit Profile` in a declared Button and lets
  it pass pasted bare; length reaches eight components from markup, because the
  six with separate header and body allowances cannot say which slot a text node
  fills; and passive voice catches the fragments the rules name and the
  unambiguous "been" plus participle, no wider. The rules and the engine's reach
  are in [reference/copy.md](pushpin/reference/copy.md), the runs that report
  them in [reference/audit.md](pushpin/reference/audit.md), provenance in
  [reference/provenance.md](pushpin/reference/provenance.md).
- **Every write path said "in parallel" and one of them said why.**
  [`reference/generate.md`](pushpin/reference/generate.md) carried the invariant
  that makes several `use_figma` calls safe together — lanes write to disjoint
  subtrees, so no lane scans the canvas, positions a top-level node, or touches a
  node outside the subtree it was handed — and nothing else did: the annotate
  pass, the re-issue path, `extract.md`'s four per-page captures, and `figma.md`'s
  screenshot-beside-assembly each carried the instruction with none of the
  reasoning attached, which is how a lane ends up finding a node by name across
  the page and colliding with work that was already on it.
  [`reference/parallel.md`](pushpin/reference/parallel.md) is the one home for it
  now — the invariant, skeleton-then-fill as the general shape, the lane contract,
  the join, and the recovery path — and every page that splits a write links to it
  rather than re-arguing it. The ladder it states is a decision rule rather than a
  preference, because the premise the docs were carrying was wrong about where the
  speed comes from: batching several tool calls into one message is universal —
  both Cursor and Claude Code emit them — and it is the rung that collects the
  whole win, since N calls in one message removes N-1 model round trips and does
  not depend on Figma executing the scripts concurrently; fully serialized on that
  side, the saving is intact. Subagents are a further rung, and they pay only for
  a decomposition larger than one message of lanes carries well — past about six
  lanes, a multi-screen run, or lanes that each have their own catalog lookups and
  copy decisions to make rather than one prepared script — because a subagent
  costs a prompt, a context, and a join, and spending all three on four lanes of
  already-written script is slower than the message it replaced. Sequential is the
  floor, produces the same file, and is where all of it goes the moment a lane
  would have to reach outside its own subtree. What the page is most careful about
  is what that top rung could quietly erode: a lane never resolves a destination,
  never searches for a file, and never asks the user anything, since
  [`reference/context.md`](pushpin/reference/context.md) already bans sending a
  subagent looking and this must not read as the loophole in it; the checkpoint
  does not move, because a lane is one of N and either the user is asked N times
  or the fastest lane answers on everyone's behalf; and nothing reads what the
  lanes wrote until every one has returned — the audit reports a node still
  carrying `placeholder === true` as a defect, so auditing against a lane that has
  not finished invents a failure whose only fix is to have waited, and annotating
  early fails more quietly still, since the `Token drift` note is written from the
  lanes' returned drift lists and comes out short exactly the rows the audit will
  go on to report. Disjoint subtrees is also not the same as disjoint effects, and
  [`reference/annotate.md`](pushpin/reference/annotate.md) is where that bites:
  several lanes each appending their own note into the column touch none of each
  other's nodes and still collide, because what they share is the column's child
  order and whichever call ran second appends second. So the annotate pass takes
  the same shape — one call builds the bundle, the body, the column, and one empty
  named card per note in its final order, then each lane fills the one card it was
  handed — while three or four notes stay one call, the pass this is written for
  being the accessibility one with a dozen. `generate.md` keeps only what is
  specific to filling a screen: sections filled in place because
  `layoutSizingHorizontal = 'FILL'` is valid only on an auto-layout child, the
  six-lane budget, and the ten-operation ceiling per call — and its workflow holds
  both the annotate and the audit steps until every lane has returned.

**Changed**

- **`DESIGN.md` and its sidecar are built assets now, not rendered per project.**
  `init` rendered both from the bridge at install time, so nothing in the repo
  could tell whether the bridge rendered the right thing — the same shape as the
  tracking defect above, one layer over. Neither file has ever been
  project-specific: two projects on the same plugin version held byte-identical
  copies. `build-design.mjs` builds them into `assets/`, `--check` fails when the
  committed pair no longer matches a fresh build, the manifest hashes both, and
  `init` copies them the way it has always copied `pushpin.css`. What changes for
  a project is that the hash it records now identifies a plugin build rather than
  its own render, which is what lets **a project holding an older build be told
  apart from one whose file has been edited** — the first was previously
  unreportable and read as current forever. Both now say so at session start, and
  the remedy is `init --write --force`. The sidecar's `generatedAt` is the
  build's timestamp rather than the clock, since a file that stamps itself cannot
  be checked against the copy on disk; nothing reads the field, in impeccable or
  here. `build-design.mjs` is a maintainer's tool and deliberately not in
  `ALLOWED_SCRIPTS`.
- **Session start says nothing now.** The pickup check ran with `--offline
  --brief` and its sentence was relayed verbatim, so a designer who asked for a
  booking screen was met first with a note about a capture date — accurate,
  unasked for, and spending the line that should have been about the work.
  `--session` replaces it as the session-start form, and stdout is the whole
  message: empty in the ordinary case, `fix:` and a command for a finding a
  plain `init --write` settles, `say:` and a sentence only for one that needs a
  file replaced or a re-capture nobody in the session can take. The split is
  drawn in `pin.mjs`, where the reasons already live, and it is deliberately
  narrow — the edit hook, missing or broken or naming a plugin version directly,
  is the whole repairable set. A missing `DESIGN.md` is not in it even though
  `--write` would restore the file: `pushpin.config.json` records what that file
  hashes to and is itself only rewritten under `--force`, and the sidecar stamps
  itself with the time it was generated, so the silent repair would trade one
  finding for a permanent one. The repair carries `--no-share`, because a fix
  nobody asked for has no business editing `.claude/settings.json`, the one file
  `init` writes that a team commits. `--session` exits 0 whatever it found,
  since a session start that reads as a failed command is the same noise
  arriving by another route. `--brief` is unchanged for anything still calling
  it, and `/pushpin freshness` still prints the full layer table, because there
  it is the thing being asked for.
- **The plugin is presented as "Pushpin Design System".** The identifier is
  untouched: `name` stays `pushpin`, so `/pushpin`, `pushpin@johnwilliams-skills`,
  the `enabledPlugins` entry `init` writes into `.claude/settings.json`, and every
  install already out there keep resolving. Only `displayName` changed, in both
  plugin manifests and both marketplace entries, along with the README's title.
  `version.mjs` now mirrors `displayName` the way it already mirrors the version
  and the description, so the catalog name is written once — in
  `pushpin/.claude-plugin/plugin.json` — and `--check` fails when a copy drifts.
- **Generating a screen was twelve steps, and most of what they cost was round
  trips rather than work.** It is eight. What collapsed is everything that was
  awaited in a row without needing the answer to the call before it: the
  preflight's three library probes, a screen's component, icon, variable, and
  style imports, the three weights of `Thumbtack Rise`, and the sibling
  screenshots that ground a run in the page it was pointed at. The preflight and
  the import batch use `Promise.allSettled` rather than `Promise.all`
  deliberately — a rejected `all` hands back the first failure and throws away
  the other answers, and naming which library was out of reach is the entire
  reason the preflight runs. The largest of these is that the sections of a
  screen are now filled by several `use_figma` calls issued in one message
  instead of one after another. The skeleton call claims its region of canvas
  once, up front, and hands each lane the id of the section it owns, so lanes
  write only inside disjoint subtrees; `use_figma` is atomic, so a lane that
  fails executes nothing, leaves its section untouched and still shimmering, and
  is recovered by re-issuing that one call. That safety rests on the API's
  guarantees and on lanes never reaching outside their section, which
  [`reference/parallel.md`](pushpin/reference/parallel.md) states as an
  invariant. It has not been exercised against a live file yet.
- **The audit fails a node that is still shimmering.** The skeleton marks every
  section `placeholder = true` and each fill clears its own, so a fill that
  never landed leaves a section that raises no error, takes up no space, and
  passes every other check on the page — it reviews as finished for the same
  reason a dropped atom does. Parallel fills make that the failure mode worth
  guarding, and it is now a defect rather than a handoff. The audit's own
  traversal is cheaper by an amount that changes nothing it reports: one round
  of `getMainComponentAsync` for the whole frame instead of one per instance,
  three per-node checks folded into a single walk of it, indexed type lookups
  where predicate walks were doing the same narrowing, and one indexed pass over
  the page in place of a `findOne` per proposal. The script also takes the
  frame's picture itself once the report passes, so the verdict is settled
  before there is anything to look at.
- **A marketplace declared as `owner/repo` is cloned over SSH first.** Verified
  by running it: Claude Code probes for a working GitHub SSH setup and uses it
  when it finds one, falling back to HTTPS only after that clone has failed. So
  the person who pays for the short form is not the designer with no key — that
  probe fails and the CLI goes straight to HTTPS — but the one whose key
  authenticates to GitHub and cannot reach this repo, who waits out a git
  timeout before the fallback starts. A full HTTPS clone URL is taken as given
  and resolves to the same marketplace name, so nothing downstream of
  `johnwilliams-skills` changes; the README and `init.mjs` both write that form
  now. `init` also declares `sparsePaths`, so the settings route clones the
  manifest and this plugin rather than every plugin published from the repo, and
  it refuses to run at all if the marketplace manifest ever moves Pushpin to a
  directory that is not in that list — a sparse clone whose one plugin is missing
  fails only after the clone has succeeded, which is the worst place to find out.
- **Setting a project up asked for permission over and over.** Claude Code
  prompts before every Bash command outside its own built-in read-only set,
  `node` is not in that set, and `Accept edits` does not cover it — so a single
  layout, which wants a dozen catalog lookups, costs a dozen approvals, and
  setup opens with a run of them, which reads to a designer as a plugin asking
  for far more than it needs. `init` now writes an allow rule per read-only
  script into `.claude/settings.local.json` — `check.mjs`, `freshness.mjs`,
  `lookup.mjs`, and `setup.mjs`, each named by full path. `init.mjs` is
  deliberately not among them: it is the script that can replace a stylesheet,
  and the prompt in front of a `--force` is worth keeping. Nor is any wildcard,
  since `Bash(node *)` would approve arbitrary code execution, which is not a
  design system plugin's to grant on someone's behalf. Rules rather than a
  permission mode, for the same reason — they hold in `Manual` too, and nobody
  has to widen what their agent may run for a whole session to stop being asked
  whether a lookup may read a catalog. They are appended around whatever is
  already in that file, and written whether or not the edit hook was declined,
  since declining the per-edit check is not a decision to keep being prompted.
  The paths carry a version directory, so a plugin update leaves them naming a
  build that is gone: that costs only the prompts coming back, but it costs it
  silently, so `setup.mjs --verify` grew a `prompts` row and a plain
  `init --write` rewrites them.
- **Binding spacing to tokens was prescribed everywhere and demonstrated
  nowhere, and the examples taught the opposite.** The only `setBoundVariable`
  sample on the generation page covered `itemSpacing` and `topLeftRadius` in
  isolation, the audit enforced binding only inside `Proposed /` definitions, and
  `paddingRight`, `paddingBottom`, and `counterAxisSpacing` appeared nowhere in
  the repo — so spacing leaked through the sides nobody had written down, on
  exactly the one-off layout that needs no proposal and gets no second look.
  The most-copied examples were worse than silent: the annotation bundle's
  gutter was 80 and its capstone's air 84, and
  [`reference/tokens.md`](pushpin/reference/tokens.md) says outright there is no
  80 on the scale. Every gap and padding now goes through one `space()` helper
  that snaps to the nearest of the thirteen steps, imports that step's variable,
  and binds it — all four paddings and the gap on every frame, plus
  `counterAxisSpacing` when the frame wraps, and radius through all four corners,
  since binding `topLeftRadius` alone leaves three literals under a frame that
  looks entirely correct. Ties round up, so 80 lands on 96 rather than
  64: cramped is the more common failure, and a layout that rounds down twice in
  a row reads as a mistake rather than as a decision. `0` is left alone and never
  bound, because there is no zero token and zero padding is a choice. The audit
  holds every hand-built frame to this rather than only the proposals, matching
  how the literal-fill check already worked. The thirteen keys are embedded in
  the doc so a fill lane can inline the helper without a lookup first, which
  makes them a second copy of the capture and the one copy that fails silently —
  a wrong key is a perfectly valid key for a different step, and the frame it
  binds looks deliberate at the wrong size — so `verify.mjs` now checks them, and
  the radius keys beside them, against `variable-keys.figma.json`.
- **A value that snapped is recorded on the node and disclosed on the canvas.**
  Correcting an off-scale number silently would be its own failure: the design
  ships with spacing nobody asked for and nothing on the page says so, which is
  how a scale gets renegotiated by accident. Each snap appends
  `{ prop, from, to, source }` to a list in the node's plugin data — a list
  rather than a single record, because a frame is bound one property at a time
  and one key holding one object keeps only the last property to move, which
  would leave the audit under-reporting the frame that drifted most. `source`
  names where the original number came from, the Figma file or pushed prototype
  code or the run's own intent, because "this gap moved from 80 to 96" is a fact
  about the file and "the prototype asked for 80" is something a person can
  decide about. After the fill lanes, one `Dev Note` titled `Token drift` lists
  every snap; it is a direct child of the annotation column, so the auto-layout
  that already keeps notes off the design keeps this one off too, and a run that
  drifted with nothing else to annotate builds the column anyway rather than
  reaching for coordinates. Drawn, when the Annotation Kit is out of reach, it
  carries the `Annotations (drawn) / ` prefix like every other stand-in, and the
  audit accepts either name as disclosure. Nothing drifted, no note — an empty
  note spends a reviewer's attention and teaches them to skip the next one. The
  audit gained a `drift` bucket, which reports and does not fail because the
  value was snapped and bound before it ever ran, and a defect for drift recorded
  with no `Token drift` note on the page, which is the whole point. The record
  goes in **shared** plugin data under the `pushpin` namespace: `setPluginData`
  is rejected by this host runtime as private-plugin-only, and it fails in the
  costliest way available, since the method is present — `typeof` answers
  `'function'` — so a guard written to skip it passes and the call then throws,
  taking a whole atomic lane down over one record. Verified against a live file:
  every gap and padding bound, `84` landed on `96` and `40` on `48`, three snaps
  on one frame produced three records that a later call read back off the node,
  and a deliberately unbound frame raised four defects including
  `counterAxisSpacing` under `WRAP`.
- **Setup asked three questions and two of them had one real answer.** `scope` —
  prototype or real project — was always asked, because nothing in a directory
  reveals it, and it decided whether the project got the `.claude/settings.json`
  entry and a `PRODUCT.md` interview. Neither turned out to be worth a question.
  That entry carries `autoUpdate`, which is what keeps a folder's tokens from
  freezing against a capture that has stopped matching the kit, and a scratch
  folder needs that as much as a shared repository does; every project gets it
  now, and `init --no-share` still skips it for anyone who asks for that. The
  `stylesheet` question fired whenever no known styles directory was
  recognized — which describes a flat prototype, a page linking a stylesheet
  beside it, the exact layout `SKILL.md` documents — so it spent a turn inventing
  a `styles/` folder to hold one file. The destination is read off the project
  instead: a recognized styles directory, or the root when an HTML file is there,
  with the fallback reaching only a directory that says nothing at all. What is
  left is `overwrite`, asked only when Pushpin files are already present, because
  it is the one thing here that cannot be undone. On a fresh folder, setup now
  asks nothing.
- **Annotation text could never have been written by an agent.** The kit is set
  in Helvetica Neue, which is a system font rather than one published to the
  file, so it is present on a designer's Mac and absent from the runtime a
  script runs in — 1,945 families reachable and not one of them Helvetica.
  `loadFontAsync` on the node's own font is the first call in the recipe and it
  throws, and the script is atomic, so nothing downstream of it has ever run.
  The text now falls back to Thumbtack Rise at the same weight, then to its
  Regular: the brand's own face, already loaded for the design the note sits
  beside, carrying every weight the kit asks for. The swap is reported in
  `degraded`, beside a library that was out of reach, because a note whose
  typography quietly stopped matching the kit is worth one line at handoff.
  Pushpin's own type is unaffected — Thumbtack Rise is published to the file,
  and a `Title/2` style imports, applies, and renders.

**Fixed**

- **Every title utility carried the same tracking, and the number was read in
  the wrong unit.** `build-css.mjs` applied `--pp-tracking-tight` to `.pp-hero`
  and `.pp-title-1` through `.pp-title-8` by a rule of its own — the kit was
  never asked — and the tokens it applied were emitted as pixels because
  `tokens.figma.json` recorded `$unit: "px"` for a `Tokens / Letter Spacing`
  collection whose three variables are bare floats carrying no unit at all. The
  published text styles carry the unit, and it is PERCENT, so `-1` meant −1% and
  shipped as −1px: right by accident at 100px type and eight times too tight on
  `.pp-title-8` at 12. Tracking is now read per step from the style the step
  pairs with, and the unit is emitted as `em` rather than `px` or `%` — `%` is
  not a letter-spacing unit, and the ramp rescales at the 700px breakpoint, so
  only a proportional unit survives it. **`.pp-hero`, `.pp-title-1` and
  `.pp-title-2` are `-0.02em`, `.pp-title-3` is `-0.01em`, and `.pp-title-4`
  through `.pp-title-8` and all four body steps emit no `letter-spacing` at
  all** — eight of the nine title utilities changed, five of them by losing the
  declaration. `--pp-tracking-extra-tight` and `--pp-tracking-loose` were dead
  tokens under the old rule and three styles were asking for the first of them.
  The build now stops rather than guesses: a token group carrying a unit and
  naming none, a unit the emitter does not know, a type step pairing with no
  published style, and a style tracking a value no token matches are four
  distinct errors, so a rename in the kit cannot silently drop tracking the way
  a blanket rule silently added it. **Existing projects are told at session
  start** — the pin records what the stylesheet hashed to, the plugin now
  carries a different build, and the freshness check surfaces it as
  `re-running init with --write --force is the first thing I'd do`. Do that; the
  stylesheet is generated and must not be hand-edited. Vocabulary and the
  per-step table are in
  [`reference/tokens.md`](pushpin/reference/tokens.md), and the style capture is
  now named in the chain in
  [`reference/provenance.md`](pushpin/reference/provenance.md), because tracking
  is a fact about `Title/3` rather than about any token group.
- **The four body utilities set a leading no Figma node renders.** Every
  `--pp-line-height-*` came from the `Tokens / Font` variable collection, which
  carries a pixel line height per step; the kit also sets one on each published
  text style, as a percentage. On the nine title steps the two agree —
  `Title/Hero` is 105% of 48, which is the 50.4 the variable holds. On the four
  body steps they do not: `Text/1` is 140% of 16, or 22.4, against 24 in the
  variable, and `Text/4` is 14 against 18. The capture recorded that
  disagreement in a note and the generator had quietly picked the side a
  designer never sees, which is the same asymmetry as the tracking defect above.
  **`.pp-body-1` is now 22.4px, `.pp-body-2` 19.6px, `.pp-body-3` 16.8px and
  `.pp-body-4` 14px** — body leading moves in every project on this release, by
  up to 4px on `body-4`, and the remedy is `pushpin init --write --force`; the
  stylesheet is generated and must not be hand-edited. The nine title steps emit
  exactly what they emitted before, at both breakpoints, because the percentage
  applies to whichever size is in force: `hero` is 50.4px and 67.2px above 700px
  as it was. `verify.mjs` is what keeps it there, 3096 checks to 3149 — every
  emitted line height against its style's percentage of the step's size at both
  breakpoints, every `.pp-*` against the token it is supposed to point at, and a
  style whose line height is not a percentage stops the build rather than being
  reinterpreted as one. `design.json` and `lookup.mjs` report the resolved value
  too, since a brief quoting a leading the stylesheet does not set is the same
  defect one layer over. The kit still disagrees with itself and both numbers
  are still recorded; what is no longer open is which one Pushpin ships.
- **The frame audit counted any published component as Pushpin's.** `remote` is
  a boolean: it says an instance resolved to a library and not to which one, and
  a Thumbtack file has the kit Pushpin replaced enabled beside it. That is how a
  real run reported `library: 21` on a frame where 12 of the 21 came from the
  older library — fully on-system by the count, and a dozen components nobody
  should place again by inspection. The audit now gathers the set keys its
  instances resolved to and settles them against the catalogs the way it already
  settles copy: remote and in a Pushpin catalog is `library`, remote and unknown
  is a defect naming the key. Only what the frame itself placed is asked about,
  since a component's interior belongs to whoever published it. `library` leaves
  the `use_figma` call as a list of keys and comes back a count, `pending` is now
  a list because two buckets wait on a shell command rather than one, and a run
  cannot report `ok` until both have run. See
  [Settling the library bucket](pushpin/reference/audit-figma.md#settling-the-library-bucket).
- **`copy.mjs` was pre-approved in the skill and unapproved in the project.**
  `SKILL.md`'s `allowed-tools` has cleared it since the copy engine shipped, but
  `ALLOWED_SCRIPTS` in `scripts/lib/permissions.mjs` — the list `init` writes
  into `.claude/settings.local.json` — named four scripts and not this one. So
  the two files agreed about `check.mjs` and disagreed about the only script that
  reads words on their own: in a project set up by `init`, auditing code cost no
  prompt and auditing a draft cost one every time, which reads as a plugin asking
  for more than it needs at exactly the moment it is asking for less. It is the
  fifth rule now, on the same terms as the other four. The bar the module states
  for itself was under-determined and is the reason the omission looked
  defensible — "each one reads and reports" is true of `diff.mjs`, `verify.mjs`,
  and `manifest.mjs` sitting beside them, none of which belong in a consumer's
  settings file — so it now names the criterion that actually decides membership:
  read-only, and run mid-task by an agent in a project that consumes Pushpin.
  Existing projects pick the rule up on the next `init --write`, and
  `setup --verify` already reports missing rules rather than leaving them to be
  noticed when the prompts come back.
- **`check.mjs` read a declared component name only as far as its first space.**
  `data-pp-component="Modal / Confirmation"` parsed as `Modal`, which is not a
  component, so declaring one of the multi-word names correctly reported it as an
  unknown component — the check punished the annotation it exists to reward. Values
  are now read as quoted strings, which also stops a `{expr}` value being taken for
  a literal name.
- **`check.mjs --help` exited 1.** It printed the usage anyone asked for and then
  reported failure, because the explicit request and the no-paths error shared one
  exit expression, so `check.mjs --help && …` never reached the second command.
- **The generated brief told another skill that copy was open ground.** `DESIGN.md`
  is what `impeccable` reads, and its doctrine is that the brief wins, so the
  sentence listing copy among what "Pushpin leaves open" did not merely omit the
  new rules — it licensed a different skill to own them. It now names the words as
  part of what Pushpin is, and the `Do` and `Don't` lists carry the rules a reader
  who never runs our scripts still has to follow.
- **The one prerequisite that stops a new user was listed last, and installed
  with a command that assumes another prerequisite.** macOS ships neither Node
  nor Homebrew, on any version, so `brew install node` was three undocumented
  steps away from running: Xcode Command Line Tools, the Homebrew install script,
  and a `shellenv` line in `~/.zprofile` without which the next command reports
  `brew: command not found`. Node now leads "Before you start" and is installed by
  downloading the `.pkg` from nodejs.org — a double-click and a Mac password, no
  terminal at any point, and not blocked on a managed Mac. Homebrew and the
  version managers stay as an aside for people who already have them, alongside
  the Node 18 floor that global `fetch` in `freshness.mjs` and
  `pull-published.mjs` sets. `SKILL.md` names the same installer in the one place
  the agent reports `node` missing, since telling a designer a binary is absent
  without saying where to get it is the same gap one layer down.
- **The install began with a command that does not exist where the people it is
  written for are.** `/plugin` is a terminal-session command; in the Claude Code
  tab of the Claude desktop app it answers `/plugin is not available in this
  environment`. The `claude plugin` form that works in both was already
  on the page, but it was introduced as the way to avoid cloning every plugin in
  the repo — a bandwidth footnote — so nobody who had just hit that wall would
  read it as the way out. The section now leads with the case that costs nothing,
  a teammate having already run `/pushpin setup`, so opening the project offers
  the plugin; then one chained `claude plugin` command that works in a terminal
  and in the desktop app; then the `/plugin` pair, marked terminal-only; then a
  `~/.claude/settings.json` merge for installing without running a command at
  all. Below those is a plain-language fallback to paste at any agent, which ends
  by having the agent run `claude plugin list` and show the output — because the
  way this goes wrong is an agent being helpful and copying the repo into
  `~/.claude/skills` instead, and the one thing that tells you it happened is
  `claude plugin list` answering `pushpin@skills-dir`: a folder that will never
  update, wearing the name of an install.
- **"Updates install themselves at startup" was untrue of every install made
  from these instructions.** Claude Code turns auto-update on by itself only for
  Anthropic's own marketplaces; every other one, `johnwilliams-skills` included,
  resolves to `false` when the key is absent. Confirmed from the CLI's own
  resolver rather than its documentation. An absent `autoUpdate` was therefore
  never "decide later" — it was a permanent pin to whatever commit the
  marketplace was first cloned at, which is exactly how a project's tokens stop
  matching the Figma kit while every check downstream keeps passing. The key is
  written now: by `init` into each project's `.claude/settings.json`, and by hand
  in the README's settings-file route, which reaches it without `/plugin`. It is
  a real trade and the docs say so, since a plugin can now change under a team
  without anyone asking for it. An `autoUpdate` already set to `false` is left
  exactly as found, including under `--force`: that one is a team's decision
  about a shared committed file rather than a gap to repair, and leaving it is
  also what lets a project that opted out re-run `init` without the setting
  flipping back and the plan reporting a change forever.
- **The skill's own pre-approval had never matched a single command.**
  `SKILL.md` declared `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/*)`. A
  Bash rule matches the command string, and every invocation this skill
  documents begins with `node ` — so the pattern could not fire, and the prompts
  it existed to remove were being paid in full by everyone. Counted rather than
  assumed: the four rules that replace it, one per read-only script and each
  beginning `Bash(node `, cover all seven `node` invocations `SKILL.md`
  documents. The old rule covered none of them.
- **`${CLAUDE_SKILL_DIR}` is a Claude Code expansion, and Cursor does not do
  it.** The variable appears nowhere in Cursor's bundle and is unset in the shell
  it spawns, so writing every path in the absolute form would have fixed one
  harness at the cost of the other. One paragraph in `SKILL.md` now tells the
  agent to substitute the directory it loaded that file from wherever a path
  still carries an unexpanded placeholder or is written relative — which also
  repairs the bare `scripts/lookup.mjs` form used throughout the reference docs,
  broken on both harnesses, since the working directory is the user's project
  and is supposed to stay there.
- **`reference/init.md` said `.claude/settings.local.json` "is gitignored".
  Nothing makes that true.** Claude Code labels the settings scope "project,
  gitignored", which reads like a guarantee but only describes what the scope is
  for; it never writes the entry, and neither does `init`. That file now holds
  the allow rules as well as the hook command, and both name this machine's
  directories by absolute path, so a committed copy hands every teammate paths
  from someone else's disk. Nothing announces it — a hook that does not resolve
  fails open, a rule that matches nothing grants nothing — so the entire cost of
  the wrong belief was paid in silence. The doc says to add the entry yourself,
  and `init` says the same after a run that touched the file.
- **`setup.mjs --verify` failed a project over a file Pushpin must not write.**
  An absent `PRODUCT.md` was a `missing` row, and one missing row is what makes
  `--verify` exit non-zero. That was defensible while setup conducted the
  `impeccable` interview as a step; it is not now that `/impeccable init` writes
  the file on request instead. Every prototype folder was reporting itself
  unfinished over product truth that is not Pushpin's to generate, which is the
  sort of red row that teaches people to stop reading the output. It is a note:
  reported, so the option stays visible, and not counted against the project.
- **Pushpin asserted a Plugin API limit from a file that was wrong about it, and
  shipped the lesser structure rather than disclosing it.**
  `figma-use/SKILL.md` calls `plugin-api-standalone.d.ts` the definitive source
  of truth for the API surface, and across 11,329 lines it has zero mentions of
  `createSlot`, `SlotNode`, or `SLOT` while its sibling `component-patterns.md`
  documents the slot API in full. The typings lag only at the newest edge, which
  is exactly where recall is weakest, so the file an agent reaches for and the
  memory it checks against went wrong on the same case and confirmed each other:
  what came out was a component built without slots and a claim the API could
  not do it. `rules.md` now requires that a claim the API cannot do something be
  verified before it is made or acted on — a live probe, then the `figma-use`
  prose references, then the typings, then memory — and treats a design that got
  simpler because of a believed limit as a disclosure, the same as snapped
  spacing or a corrected label; being wrong about the API is only how it
  happens. The access preflight settles it rather than leaving it to be asked,
  returning `{ reach, api }` and riding on the Button import it already makes,
  since the resolved set's `defaultVariant` is a `ComponentNode` — no call
  added, nothing mutated, and the answer crosses back as a boolean because a
  node handle cannot. It is silent when it passes, like the session freshness
  check, and asymmetric: a positive forbids the "cannot be done" claim without
  promising the call works, for the reason the page already gives about
  `setPluginData` answering `'function'` and then throwing.
  [`reference/generate.md`](pushpin/reference/generate.md) also documents
  filling a slot, which nothing in `reference/` covered while the kit published
  three: `setProperties` cannot reach one, so content is appended to the slot
  node, narrowed by name because `Modal / Promotion` publishes two and both
  traps live on it — `childern` is misspelled upstream, and `artwork` (SLOT)
  sits beside `Artwork` (INSTANCE_SWAP). The audit was exempting all of it.
  Four gates skipped nodes inside an instance because the library owns that
  styling, which a slot inverts — the caller supplies the content — so an
  `inSlotContent` helper carves out the exception for the lookalike sweep, the
  fill/spacing/drift walk, and the two gates over `Proposed / …` definitions,
  stopping at the first enclosing `INSTANCE` so a Button placed in a slot still
  governs its own interior. The copy walk had the same hole by another route: it
  gates on the enclosing instance plus an `overridden` set, and slot content can
  never be in `overrides` because it was appended rather than inherited, so
  every word inside a slot was being dropped from the copy audit entirely. Slot
  text is gathered with no component now, the way an unenclosed heading is,
  since a slot publishes no length limit for what the caller puts in it. The
  typings join [`reference/provenance.md`](pushpin/reference/provenance.md)'s
  "What is not authoritative".

## 0.9.0 — 2026-08-14

Setting a project up was four commands in a particular order, one of which does
nothing on most installs, and it ended by printing advice nobody could verify
had been taken. The people this is built for are designers, and the failure was
not that the steps were hard — it is that a project could sit half configured
with every individual check reporting health.

The other half of this release is the rule `AGENTS.md` has always stated and
nothing enforced: `/impeccable document` replaces `DESIGN.md` and
`.impeccable/design.json` with an invented design system, and every check
downstream keeps passing against the wrong one. That rule was a sentence in a
file, competing with impeccable's own staleness finding, which recommends
`document` by name.

**Added**

- **`/pushpin setup`, the front door.** One command for the whole job. It reads
  the project first and asks only what the project cannot answer itself —
  whether this is a prototype or a real one, what to do about files that are
  already there, and where the stylesheet goes when no styles directory is
  recognizable. Then it runs `init`, hands off to `impeccable` for `PRODUCT.md`
  rather than inventing product truth, and finishes by reporting what is
  actually true instead of what to do next. `init` is unchanged and remains the
  right call for a re-run, a repair, or an update.
- **A backup that does not assume git.** `setup.mjs --backup` copies aside
  everything `--force` would replace, into `.pushpin/backups/`. Offered whenever
  there is no repository or the files are uncommitted, which is the common case
  for the prototype folders this gets pointed at and exactly where an
  overwrite is unrecoverable.
- **The generated files are protected in three layers.** `init` records
  `designHash` and `sidecarHash`, so an overwrite is reported by the edit hook on
  the edit that caused it and by the pin check at session start, on every
  harness. A write guard on Cursor's `preToolUse` refuses a whole-file write that
  would strip the generated marker before it lands. Nothing is lost by refusing:
  both files are machine-written and `init --write --force` reproduces them
  exactly, which is what makes a block affordable in a plugin whose other hooks
  never block. The hashes are the layer that carries the weight; the guard is one
  harness and hooks fail open.
- **The guard runs through the existing shim**, called with `--guard`, rather
  than as a second file. One filename still identifies every hook of ours, so
  `inspectHooks` and the repair path needed no new concept, and a project keeps
  one thing current instead of two.

**Fixed**

- **`/impeccable hooks on` is no longer presented as step three.** It was
  documented as "what actually makes the detector run per edit," and for a
  user-global impeccable it installs nothing: its installer skips every manifest
  target unless the project holds a provider folder such as
  `.cursor/skills/impeccable`. Verified against a real initialized project, which
  had no impeccable hook and no `.impeccable/config.json` despite having been set
  up exactly as instructed. Pushpin does not wire it up — `check.mjs` already
  reports the token half whenever impeccable's hook is absent, and steps aside
  only when it finds one — so `setup --verify` states the true end state and the
  docs no longer describe a gap that is working as designed.
- **A re-run cannot report a manifest with two of our hooks as drift.** The
  comparison was against a single expected command; it is against the expected
  set per manifest now.

## 0.8.0 — 2026-08-14

0.7.0 put five of Pushpin's eleven hard rules into a script that runs on every
edit, on the argument that a rule re-stated when it breaks beats a rule the model
has to keep holding. That only holds while the script actually runs — and it
stopped running, silently, the first time the plugin updated itself.

`init` recorded an absolute path to the plugin in each project's hook manifest.
Cursor keys its plugin cache by commit hash and keeps exactly one, deleting the
old directory on update, so the recorded path stopped resolving. Hooks fail open
by design, which is right for a check that must never break a turn and wrong as
the only signal that the check is gone: the command threw, both harnesses
swallowed it, and nothing said so. Three separate things then reported the
project as healthy. Cursor updates itself, so no one had to do anything to
trigger it.

**Fixed**

- **The edit check survives a plugin update.** `init` now writes
  `.pushpin/pushpin-check.mjs` into the project and points both hook manifests at
  that instead of the plugin. The shim locates the installed plugin at run time —
  `PUSHPIN_SKILL_DIR`, then the `pluginPath` now recorded in
  `pushpin.config.json`, then both hosts' plugin caches, newest first — and keeps
  the hook contract exactly: stdin in, stdout back, always exit 0, nothing
  printed on any failure path.
- **A broken hook is now visible.** The pin check reads the manifests and stats
  what they name, so a command aimed at a deleted plugin directory is reported at
  session start rather than passing as current. A hook that still names a plugin
  version is reported too, as something that will break on the next update.
- **`pushpin.config.json` no longer claims the hook is installed.** `checkHook`
  recorded what was asked for and was written only under `--force`, so a project
  could be told it had no hook forever, or that it had one after the target was
  deleted. The manifests are self-verifying and now answer that question;
  `checkHook` keeps only the job they cannot do, recording a deliberate
  `--no-hook`.
- **`init --write` repairs a broken hook without `--force`.** It previously
  matched the filename alone and reported an unresolvable hook as "already runs
  the Pushpin check on edit". Installing and repairing are one operation now, and
  prior entries are replaced rather than appended, so a re-run cannot stack
  duplicates.
- **`init` reports what it did rather than what to do next.** A successful
  `--write --force` ended by advising `--write --force`. It now re-checks after
  writing and says whether the project is still behind.

**Added**

- **`lookup.mjs` answers several names in one call.** `lookup.mjs
  Button,Card,Checkbox` returns a section per term. Composing a layout needs a
  dozen lookups and each one was a separate round trip. Terms split on commas,
  not spaces, so `Icon Button` stays one name; a term that matches nothing says
  so instead of being dropped, and `--json` keys by term when there are several.

## 0.7.0 — 2026-08-14

A Figma generation session paid roughly 40,700 tokens of preamble before any
work happened: `SKILL.md`, then a 12,000-token `reference/generate.md`, then a
whole-catalog read to find one component's property names. Almost none of it was
the answer to the question being asked. This release cuts that to about 9,700 —
and makes the cut to `SKILL.md` safe by moving the rules it dropped into a
script that runs on every edit.

**Added**

- **`scripts/lookup.mjs` answers one question about the catalogs without reading
  them.** `node scripts/lookup.mjs Button` returns Button's import key, every
  property, its exact suffixed `key`, and all eight `theme` options in about
  1,500 bytes, against a 97 KB catalog. Components, icons, tokens, styles, and
  Annotation Kit entries, narrowed with `--icon` / `--token` / `--style` /
  `--annotation`, or searched together. Takes a Figma name or a `--pp-*` custom
  property, and answers a near-miss with the real names — which matters, because
  `Button`, `Icon Button`, and `Brand / App / Download Buttons` are three
  different entries and none of them is guessable.
- **`scripts/check.mjs` reports what is off-system in code.** Raw color, pure
  black text, off-scale spacing, off-ramp type and weight, a non-Rise family, a
  control that is not a pill — plus the two findings no token allowlist can
  express: markup that reads as a published component while declaring neither
  `data-pp-component` nor `data-pp-proposed`, and a declaration resolving to
  nothing real. Advisory; it changes nothing.
- **An edit hook, installed per project by `init`.** `check.mjs` runs on the
  file that was just written and hands its findings back as context. It reports
  and never blocks — every failure path exits 0. `.cursor/hooks.json` and
  `.claude/settings.local.json`, merged rather than replaced, and skippable with
  `init --no-hook`.
- **`reference/rules.md`** — the complete hard rules, with the reasoning that
  makes each decidable in a case it does not name.
- **`reference/audit.md`, `reference/propose.md`, and
  `reference/annotate-fallback.md`**, split out of the two oversized docs along
  the seams where separate commands were paying for each other.

**Changed**

- **`SKILL.md` is 38% smaller** — 16,147 bytes to 9,934. The Commands, Routing,
  and Reference tables were the same mapping written three times and are now
  one. The hard rules keep the five broken most often inline and the rest moved
  to `reference/rules.md`. Naming and Type were duplicating `reference/tokens.md`
  and now point at it. This is the file every session pays for, org-wide.
- **`reference/generate.md` is 43% smaller** — 12,238 tokens to 6,933. `audit`
  and `generate` are separate commands that each paid for the other's content;
  the audit and the proposal gate now load only when they are the work.
  `reference/annotate.md` splits the same way, down 39%.
- **Every instruction to read a catalog is now an instruction to look one up.**
  53 of them, across `SKILL.md` and five reference docs. The capture docs
  (`scripts/extract.md`, `scripts/check.md`) still name the files, because they
  are about writing them.
- **`scripts/lib/tokens.mjs`** holds the token helpers `impeccable-bridge.mjs`
  had unexported — the group-to-custom-property rule, alias resolution, and the
  ramps — so `lookup.mjs` and `check.mjs` cannot disagree with the bridge about
  what a token is called. `DESIGN.md` and the sidecar are byte-identical across
  the change.
- **`pushpin.config.json` records whether the edit hook was installed**, so a
  later session can tell a project that declined it from one set up before it
  existed. Only the second is mentioned, once.

## 0.6.0 — 2026-08-14

The bridge to `impeccable` fed four token rules and was on a weekly timer to
delete itself. Fixing that turned into the wider question it was standing in
for: browser work is pushed to Figma afterwards, and everything the browser
phase knew about the design was being thrown away at that boundary and guessed
at again.

**Fixed**

- **The sidecar no longer invites its own destruction.**
  `.impeccable/design.json` carries `schemaVersion: 2`, a `title`, and
  `generatedAt`. Without the version, impeccable's boot check read it as a
  pre-v2 file, raised `design-sidecar-schema-outdated`, and offered `document`
  to fix it — and `document` overwrites both generated files with an invented
  visual world. This fired at every session boot, throttled weekly.
- **Four featured colors were silently missing from the `DESIGN.md`
  frontmatter.** `background-brand`, `text-brand`, `text-critical`, and
  `text-success` named token paths the kit does not have, so they resolved to
  null and were skipped. They now name real paths, and the readable core is 11
  colors rather than 6.

**Changed**

- **`DESIGN.md` is written in the sections impeccable actually parses.**
  Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components,
  and Do's and Don'ts, generated from the capture and the hard rules. The
  previous headings matched none of the six canonical ones, so `colors`,
  `typography`, and `components` all parsed as null: `design-md-coverage` fired,
  the live panel rendered generic approximations, and the agent got no normative
  guidance at the moment impeccable's own rule says the brief wins.
- **The sidecar carries the rest of the capture** — shadows, motion, breakpoints,
  per-step typography, and the do/don't narrative — and the frontmatter carries
  the 13-step space scale. None are read by the detector; they are what any tool
  reading this format renders instead of guessing.
- **Both generated files are marked and defended.** An `@generated` comment in
  the frontmatter keeps live mode from writing variants into `DESIGN.md`, and
  the `AGENTS.md` note now says outright that `document` must not touch either
  file and that a staleness flag means `init --write --force`.

**Added**

- **A component-identity convention for hand-rolled markup.**
  `data-pp-component`, `data-pp-variant`, and `data-pp-proposed`, documented in
  the generated `DESIGN.md` with the real names and variant options from the
  catalog. Code Connect is not wired for Pushpin and cannot be published
  unilaterally, so the code→Figma direction has had no component mapping and has
  been inferring one from markup — weakest for the ten Pushpin components with
  no React equivalent, which get composed from primitives. A declaration is a
  hint resolved against `assets/components.figma.json`: on a miss it is
  discarded and the inference runs as before, so a typo costs back the guess it
  removed and nothing else.
- **`check` reports two things a token allowlist cannot express** — an element
  that reads as a published component while declaring nothing, and a declaration
  naming a component, property, or option that is not in the catalog. Scoped to
  hand-rolled markup; `<Button theme="primary">` already says what it is.
  `tokens.md` now documents what `check` looks for, which it never did.
- **Accessibility annotations are read off the markup a frame was pushed from,**
  rather than inferred from the mock. Heading levels, landmarks, tab and reading
  order, label and autocomplete associations, link targets, and alt text are all
  in the source already. `annotate` only — `generate`'s annotation step is
  unchanged — and placement is untouched, since the bundle is auto-layout to a
  single origin and added cards cannot overlap.
- **The onboarding order is written down** in the README, `reference/init.md`,
  and `init`'s closing output: `pushpin init --write`, then `/impeccable init`
  for `PRODUCT.md` only, then `/impeccable hooks on`. Pushpin does not generate
  `PRODUCT.md`; that is product truth and impeccable interviews for it.

## 0.5.4 — 2026-08-12

The skill's first-load cost was the whole of `SKILL.md` plus a freshness table
the agent was then told to throw away, and `init` was easy to mistake for
something every new agent had to run.

**Changed**

- **Session start is `--offline --brief`.** Empty stdout when the capture is
  current and the project pin matches. One sentence when a refresh or a re-init
  would change what gets built. Asking for `/pushpin freshness` still prints the
  full layer table, because then it is the thing being asked for.
- **A project pin is checked on pickup, not re-initialized.**
  `pushpin.config.json` is the marker. If it exists, `pluginVersion`,
  `capturedAt`, and `cssHash` are compared to the plugin — the same comparison
  `init` already used when re-run. Behind means one sentence and a re-run of
  `init` with `--write --force`. No config is not a finding; that offer stays
  on the bare-invoke menu for a code project that has none of it yet.
- **`SKILL.md` is a router.** Maintainer procedure lives in
  `reference/maintaining.md`, project setup in `reference/init.md`. Catalog
  blurbs and restated generate/context sections no longer load on every pickup.

## 0.5.3 — 2026-08-11

Two places where the plugin talked at the user instead of to them. Freshness
opened every session with a measurement nobody had asked for, and a design
request with no link sent the agent looking for a destination rather than asking
for one.

**Changed**

- **The freshness check is silent when there is nothing to refresh.** Every
  session used to open on some version of "capture is 5 days old (within
  budget)" — a measurement, in the plugin's own vocabulary, answering a question
  the user had not asked. Worse, it was reassurance on a schedule, and a green
  line every session is exactly what teaches someone to skim past the one that
  is not green. The check still runs first, before a layout is generated or a
  hex is quoted; a clean result now produces no line at all, and a stale one
  produces a sentence about what may have moved and what to do about it. Asking
  for `/pushpin freshness` still prints the full layer table, because then it is
  the thing being asked for.
- **"Budget" is gone from the output.** The age layer reports the date it was
  captured on the way through, and the day count only when that count is the
  problem.
- **Which surface the work happens on is settled before anything is routed.**
  Pushpin governs two of them — a Figma canvas and a running project — and
  almost every phrasing of "make me one of these" fits both. Three things settle
  it: a link or the word Figma, a code file or an initialized repo, or the
  request simply being a token question. Short of those it is one `AskQuestion`
  before any other tool call, worded the same as the bare-invoke menu's, so both
  entry points ask one question rather than two.

**Fixed**

- **A design request no longer means a Figma request.** The first row of the
  routing table sent "mock up a booking screen" and "add a step to this flow"
  straight to `generate`, which only writes to Figma, though neither phrasing
  mentions it. The counterweight — "a link is required" — lives in
  `reference/generate.md`, which is read only after that decision, so the agent
  arrived believing it was in Figma and merely short an address. What followed
  was a search: reads, and in one session two subagents, spent working out a
  destination the user could have pasted in a single turn, and could not have
  wanted in the first place if they meant to build in the browser. Destinations
  are now asked for and never looked for, and the link is required before the
  first call rather than before the first write.

## 0.5.0 — 2026-08-11

The access preflight was stopping a run when any of the three libraries was out
of reach, and two thirds of that was the wrong trade. Reaching Pushpin without
reaching the Annotation Kit is the ordinary setup, not the exotic one — so the
common case was a layout built entirely from published components, proposing
nothing and needing no note, refusing to generate over a library it would never
have opened. The kit's own page said as much and stopped anyway.

Annotations had a second problem with nothing to do with reachability: they
arrived messy enough to need hand-cleaning every time. Two structural causes.
The column's members were whatever width the kit publishes — 320 for
`Multi-line`, 360 for `List Elelemt`, 500 for `Guide` — so it was ragged down its
right edge by construction. And the gutter, the capstone's width, and the
column's top were all arithmetic against the design frame's box, which goes stale
the moment anything resizes. Neither is fixable by being careful, which is why
being careful had not fixed it.

**Added**

- **A specimen beside every proposal's note.** `Delta: adds a count badge` is not
  a readable claim unless the thing with the count badge is in view, and
  numbering only ever answered *where on the design*. Each proposal is now a card
  holding an instance of its `Proposed / <Name>` component next to its note —
  beside it when it fits in the note's width, above it when it does not. The
  instance comes from the component rather than being copied off the design, so a
  reviewer sees the default that would land in the library rather than one
  screen's overrides, and it is never resized: a scaled specimen misreports the
  padding and type size that deriving a proposal exists to preserve. Specimens
  live outside the design frame, so they do not inflate a proposal's instance
  count.
- **The annotated area is nested auto-layout with one set of coordinates.** A
  bundle frame stacks the capstone over a body; the body sets the gutter between
  the design and its notes; the column stacks the cards, each stretched to the
  column's width. Four hand-computed values became four properties set once on a
  parent — the gutter is `itemSpacing`, the column's top is
  `counterAxisAlignItems`, the capstone's width is `layoutAlign = 'STRETCH'`, and
  the air beneath it is the bundle's spacing. Moving the bundle moves the design,
  its notes, and its heading together, and widening a note or reordering a
  proposal costs nothing.

- **Only Pushpin can stop a run now.** The preflight returns a `mode` rather than
  a verdict: unreachable icons become `Placeholder / icon` by the rule that
  already existed for an icon the set does not cover, and an unreachable
  Annotation Kit means notes are drawn. Pushpin stays fatal because a screen with
  none of its components, variables, or text styles is not a degraded screen, it
  is an empty one.
- **A drawn annotation fallback,** in
  [`reference/annotate.md`](pushpin/reference/annotate.md). It mimics the real
  component — same width, padding, and radius — so the column reads as it always
  does, and it is held to every other rule on the page: bound fills, bound
  padding and radius, a published `Text/3` for the body. The body text stays
  byte-identical to what an instance would carry, which is what keeps the
  `Tier` and `Derived` requirement working, since the audit finds proposal notes
  by reading `TEXT` characters and never checks what kind of node they sit in.
- **A `degraded` bucket in the audit,** naming which library was out of reach and
  what stood in for it. It does not fail the run, for the same reason
  `unresolved` does not: the gap is stated rather than hidden, and failing on it
  would only bring back the behaviour it replaced.
- **The handoff leads with the unreachable library.** A screen full of
  `Placeholder / icon` is a different artifact depending on whether the set lacks
  those glyphs or the account cannot see the library, and the canvas cannot tell
  you which. Getting this wrong sends the next person to propose a component that
  already exists.

**Fixed**

- **The audit could not see a drawn note.** The overlap check filtered on
  `n.type === 'INSTANCE'`, so a fallback note — a `FRAME` — would have been
  invisible to the one check that exists to stop notes stacking into an
  unreadable pile. It now matches on the name and accepts either type. The
  lookalike check gained the matching exemption, so a 24px circular
  `Pointers · Number` stand-in cannot trip the pill-shape rule, and the
  on-design exemption now recognises a drawn pointer as a pointer.
- **The Annotation Kit probe was not a key.** Two of the three probes carried a
  real key and the third carried `<a COMPONENT_SET key from
  assets/annotations.figma.json>`, an instruction to go find one. A concrete key
  was already sitting in `annotate.md`.
- **The audit ran before the notes it reads.** The workflow put the audit at step
  10 and annotation at step 11, and the audit fails a `Proposed /` component whose
  note is missing — so a run that followed the steps in order reported every
  proposal as undocumented, and the annotation overlap check, the one thing
  standing between a reader and a pile of stacked notes, ran on a page with no
  annotations on it. The two steps are swapped.
- **A nested note no longer overlaps its own wrapper.** The overlap check compared
  every annotation it could find by name, which was sound while notes were direct
  children of the column and wrong the moment one sat inside a card. It now
  compares the outermost annotation of each nest, which also subsumes the separate
  rule that skipped a drawn note's children.
- **Thumbprint is not a leftover.** Six places described the file the icons are
  published from as the "older" or "predecessor" kit, which reads as a migration
  Pushpin has yet to finish. The icons live there deliberately, so one set of
  glyphs serves both systems, and the wording implied a gap that could be closed
  by proposing an icon.

**Changed**

- **The preflight no longer claims a library must be enabled in the target
  file.** Key-based import needs the component published and the account able to
  reach it; file-level library enablement is not the gate, so advising a designer
  to toggle it sent them somewhere that fixes nothing.

## 0.4.1 — 2026-08-11

A release nobody receives is indistinguishable from no release. Claude Code
keys its plugin cache on the version string and skips the update when it
matches, and the version was written by hand in four files with the description
in five. The documented trap is narrower still: a `version` in `plugin.json`
silently shadows one in the marketplace entry, so the two disagreeing is worse
than either being stale on its own. The proof it was already happening is in
this repo — 0.4.0 shipped 227 icons, and three of the four descriptions never
mentioned them.

**Fixed**

- **One place to write the version.** `pushpin/.claude-plugin/plugin.json` is
  the authority. `scripts/version.mjs` bumps it and propagates to the Cursor
  manifest, the `SKILL.md` frontmatter, and both marketplace entries;
  `--check` fails when a copy has drifted. `SKILL.md`'s `description` is
  deliberately left alone — it names the conditions under which the model
  should load the skill, which is a different job from catalog copy.
- **The version is gone from the marketplace entries,** which is what the
  shadowing rule asks for. `plugin.json` was always the one being read.
- **`.githooks/pre-commit` bumps the patch** when a commit touches the plugin
  under a version that is already upstream. It compares against the tracked
  branch rather than counting commits, so a deliberate `version.mjs minor`
  before a breaking change stands and the rest of the push cycle rides on it.
  Install with `git config core.hooksPath .githooks`.

**Changed**

- **The install instructions offer a sparse checkout.** This repository holds
  several plugins and git operations are capped at 120 seconds, so
  `--sparse .claude-plugin pushpin` is the cheaper path on a slow connection.

## 0.4.0 — 2026-08-11

Four fidelity failures observed in real use, three of which turned out to be the
same missing capture. Icons were never extracted, because they are not published
from the Pushpin file at all — they live in the older Thumbprint UI Kit. With no
catalog and no size ramp on record, omitting an icon was the only move the rules
left open, and "large icon scaled to look small" was the only way to get a size.

**Added**

- **`assets/icons.figma.json` — the icon set, finally captured.** 227 icons
  across ten categories, 899 import keys, from
  `jjhhb3Kp6a7JrtBLCjrf6u` page `2:1`. This is a **third source library**: the
  plugin previously knew about Pushpin and the Annotation Kit only. Built by the
  new `scripts/build-icons.mjs`, which joins the component dump (names and
  `assetKey`s) against page metadata (the category frames) on `nodeId`.
- **Icon placement rules in `reference/generate.md`.** The size ramp is Tiny 14,
  Small 18, Medium 28, Large 32 and nothing else. An icon is never resized —
  each size is a separate component with its own key, and a scaled one carries
  the stroke weight of the size it was drawn at. Inside a component, the size is
  *read off the slot* rather than chosen, which needs no lookup table and cannot
  go stale when the kit changes.
- **Unresolved atoms are placed, never dropped.** When an icon, illustration,
  avatar, or logo cannot resolve to a published asset, a marked
  `Placeholder / <kind> · <size>` goes in its place with an `Open Question`
  sticky, and the audit reports it in a new non-failing `unresolved` bucket.
  Critically, **a missing child never removes its parent** — an icon button with
  an unresolvable icon still ships as an icon button, which is the cascade that
  made whole controls disappear.
- **Proposals derive from the component they extend.** The proposal gate already
  made you name the closest published component; that component is now the
  starting material. Instance it, `detachInstance()`, change only what the
  `Delta` names, then `createComponentFromNode()`. Rebuilt from scratch, a
  proposal loses the text styles, the padding, the border weight, and the radius
  immediately and invisibly — every one of those a decision nobody made.
- **A `Derived:` field on the proposed-component note,** naming the exact
  variant. "Extends Chip" and "is a modified `Chip / theme=secondary`" are
  different claims and only the second can be checked.
- **A deterministic annotation layout in `reference/annotate.md`,** replacing
  four bullets that gave sizes but no algorithm. Notes go in one auto-layout
  column beside the frame at a fixed gutter and gap — the auto-layout *is* the
  collision avoidance, since nothing in the column is positioned individually.
  Past three notes, anchoring switches from pointers to numbers, and pointer
  direction is derived from geometry rather than chosen. Capstones follow the
  Icons page's own usage: left-aligned with the block they head and stretched to
  span it.
- **Four new audit checks,** all mechanical: an icon whose dimensions are off
  its ramp step, a `TEXT` node inside a `Proposed /` component with raw font
  settings instead of a published text style, unbound radius/padding/spacing
  inside one, and any pairwise overlap among annotation instances or between an
  annotation and the design.
- **`init` writes `DESIGN.md` and `.impeccable/design.json`,** generated from
  the token capture. Browser-first work means drift is introduced in CSS and
  arrives in Figma already baked in, where the audit notices it a step too late.
  These two files are the allowlist `impeccable`'s `design-system-*` rules read,
  so a hardcoded color, font, radius, or font size reports as Pushpin drift
  while you work — with no change to `impeccable`, which has no way to register
  a rule. Verified against its detector: every Pushpin token passes and
  off-system values are flagged.
- **A third access-preflight probe.** The icon library is the least likely of
  the three to be enabled in a product file, and an unreachable one reads as
  "Pushpin has no caret icon", which is wrong and sends the next person to
  propose a component that already exists.
- **An `icons` freshness layer,** checking all 899 keys against the live file.
  Its late-edit sweep is scoped to keys the catalog depends on, since that file
  publishes 170 components beyond the icon page.

**Changed**

- `build-components.mjs` no longer discards `preferredValues` on an
  `INSTANCE_SWAP` property. Pushpin declares none today, so this is defensive —
  but a slot arriving as a key and nothing else is how an icon slot ended up
  empty.
- An `INSTANCE_SWAP` default is now resolved from a bare node id to the name of
  what the kit puts in that slot, and its size recorded as `defaultSize`. Five
  components gained it. `Button` turns out to default to a `Medium` icon on the
  left and a `Tiny` on the right, which no size table would have predicted and
  is the reason the rule reads the slot instead.
- `components.figma.json` re-captured. Nothing moved beyond the two new fields.
- `manifest.json` gains an `iconLibrary` block and icon counts; `verify.mjs`
  gains internal-consistency checks on the icon catalog, so a lossy merge reads
  as a broken capture rather than a smaller kit.
- `diff.mjs` gains `--icons` / `--icons-page`, and refuses `--icons` alone —
  without the page metadata every icon distils as `uncategorised`, which would
  report as 227 category changes rather than the missing input it is.

## 0.3.0 — 2026-08-11

Nothing in `assets/` moved. One new rule about where design work gets its
bearings, and no change to what it is allowed to build.

**Added**

- **Work is grounded in the page the link resolved to.** A resolved link names
  a page, and its sibling frames are the same flow, the same product, and often
  the same screen in its other states — evidence about layout, density, copy
  voice, and naming that no general prior supplies. The page is read
  automatically, because an offer has to name what is on the page to be
  answerable; whether that context shapes the work is the user's call, and the
  answer holds for that page for the session. Rule in `pushpin/SKILL.md`,
  mechanics in `pushpin/reference/context.md`.
- **Other pages are named, not read.** The file's page names stay free — the
  finalize pass already needs them — but another page's contents are reached
  only when the user asks for them or links into one. Pages hold superseded
  versions and parked ideas, and rebuilding a shelved idea as if it were
  current is the failure this closes.
- **Page context is advisory, and departing from it is asked about.** It never
  overrides a token, a published component, or the icon set, so a page built
  entirely of raw hex licenses nothing. But going against a pattern the page
  plainly holds to is the user's decision, put as one question before anything
  is written rather than several during the build.
- **The rule binds by definition rather than by list.** It applies to any skill
  supplying craft floors, ambition, or category defaults — the three named
  under `Precedence` are the current instances, not the extent of it, so a
  skill that arrives later inherits the rule with no edit here.
- **The current Figma selection is used to resolve a link.** `get_metadata`
  reports what is selected in the desktop app, so a file- or page-level URL
  with a frame selected is no longer treated as ambiguous. It is a hint that
  gets confirmed, and it never substitutes for the link a write requires.

## 0.2.0 — 2026-08-10

The first entry that records the plugin changing rather than the kit. Nothing in
`assets/` moved except the Annotation Kit catalog, which is new.

**Breaking**

- **`tokens` and `components` are no longer commands.** `/pushpin tokens` and
  `/pushpin components` no longer resolve. Neither did anything but load a
  reference doc, and `SKILL.md` now carries a routing table that reaches the same
  docs from plain speech — "what's our card radius" loads `reference/tokens.md`,
  "which Thumbprint component is this" loads `reference/components.md`. The
  ground is still covered; the two names are gone. Seven commands remain:
  `generate`, `audit`, `figma`, `check`, `init`, `freshness`, `refresh`.

**Added**

- **A component can now be proposed rather than only instanced.** The old rule
  had no exception: always import the published component, and every local one
  was a defect. That is too strict for a system this young — it produces awkward
  compositions of nearly-right components and buries the gap in a layout instead
  of recording it where the design system owner can see it. An agent may now
  define a real local component named `Proposed / <Name>` in the working file, in
  two cases: nothing published expresses the interaction without lying about its
  API (`Tier: gap`), or something could be stretched and a new component would
  clearly be better (`Tier: better-experience`). The tier is recorded because the
  two ask a reviewer to accept different arguments. What did not loosen is the
  ban on lookalikes: a drawn pill that resembles a Button is still a defect.
  Rules in `pushpin/reference/generate.md`.
- **Every proposal argues its case on the canvas,** as published Annotation Kit
  instances rather than drawn boxes — a note, a pointer at the instance it
  describes, a capstone, and a summary frame — and the plugin prints the same
  fields as a markdown summary in chat after a push. A `Proposed /` component
  with no parseable note is a defect, because a proposal nobody argued for is an
  off-system element with better naming.
- **The Annotation Kit is a second source library** (`Qefv6O2RMPSBtSYBrCGcdI`),
  captured to `pushpin/assets/annotations.figma.json` — every published component
  with every property's exact `key`. Its names are load-bearing and several are
  misspelled in the file (`Annotations` publishes a variant named `List Elelemt`),
  so nothing here is typeable from memory. `pushpin/reference/annotate.md` covers
  what each annotation is for, how to set text on instances that expose none as a
  property, and the Thumbprint contribution flow the plugin documents but does
  not walk. `manifest.mjs` hashes the catalog and records an `annotationKit`
  block, `freshness.mjs` gained an `annotations` layer, and `scripts/extract.md`
  and `scripts/check.md` gained its capture and its diff.
- **Where a design gets written is now a rule, not a judgement call.** A Figma
  link is required before anything is pushed, and is resolved by traversing the
  tree from whatever granularity was pasted. The first pass duplicates the
  resolved frame beside the original on the same page, so the two can be compared
  at a glance; moving the accepted work onto its own page is offered afterwards
  rather than done. Placement is asked about for net-new screens. Writes into the
  Pushpin kit, the Annotation Kit, or any subscribed library are refused. Agent
  writes do not enter the user's undo stack, which is why none of this is left to
  judgement.
- **An access preflight** resolves one key per library before any node is
  created. Keys belong to the file and resolve identically for everyone; access
  does not, and a maintainer's own file subscriptions hide the failure that
  breaks a teammate halfway through a generation run.
- **A precedence section in `SKILL.md`,** declaring Pushpin project truth because
  it is the project's own tokens, components, and icon set: `impeccable`,
  `frontend-design`, and `ui-ux-pro-max` choose among Pushpin-legal options,
  never around them. `init.mjs` writes the same claim into its `AGENTS.md` note,
  because those skills can load into a session this one never enters.
- **A freshness-first session instruction.** The first time Pushpin is picked up
  in a session, `freshness.mjs` runs and the capture's age is reported before
  anything consequential — generating a layout, quoting an exact hex, stating a
  component's variant options.
- `scripts/freshness.mjs` — answers whether the committed captures still match
  Figma, which no existing check could. It reports in layers and degrades rather
  than failing when a layer is out of reach: capture age needs no token and no
  network, component and style import keys need a `file_read` token on any plan,
  and variables need Enterprise. Exits non-zero when something moved.
- `pull-published.mjs --check` — the same publish comparison without writing
  `published.json`, so CI can ask the question without leaving an artifact in the
  working tree.
- `.cursor-plugin/marketplace.json` at the repo root, so Cursor installs the
  plugin from a team marketplace instead of only a symlink off disk.

**Changed**

- **The audit sorts what it finds into three buckets** — Library, Proposed,
  Defects — and fails on defects only. A populated Proposed bucket is a result to
  report, not a failure; that is the whole point of allowing proposals.
- `verify.mjs` now prints the capture date under its pass message. Every one of
  its checks compares the repo against itself, so "all checks pass" was the most
  likely source of false confidence in the toolchain.
- `README.md` is written for designers now: install, what to ask for, and what
  happens when the plugin writes to Figma. The maintainer material moved to the
  end.

**Fixed**

- `init.mjs` would happily set up the plugin's own source tree. Pointed at this
  repo, at the plugin root, or at the skill directory, it wrote
  `pushpin.config.json`, a second copy of the stylesheet, an `AGENTS.md` section,
  and `.claude/settings.json` into the source of truth — pinning the capture to
  itself, which records nothing. It now refuses, names which of the three the
  target is, and points at `<project-dir>` instead. The signal is the running
  script's own location rather than a directory name, so a real project laid out
  like the plugin, or one that vendors a copy of it, still initializes normally.
- `freshness.mjs` validated committed component keys against
  `/files/:key/components` alone. A component set publishes under its own key in
  `/component_sets`, so every set in both catalogs read as unpublished — 96 of
  Pushpin's 117 entries and 70 of the Annotation Kit's 91. It now checks the
  union of both endpoints. Caught before release; the layer would otherwise have
  raised a false alarm across almost the whole catalog on its first real run.

**Notes**

- The key-existence check is the point of the network layers. Counts drifting is
  a note; a key that no longer resolves is a runtime failure, because
  `importComponentByKeyAsync` throws on an unpublished key and takes a generation
  script down mid-run.
- 273 tokens is not the same count as 131 bindable plus 168 hidden, and neither
  is 300. The kit holds 299 variables; `tokens.figma.json` records the type ramp
  as 13 grouped steps rather than the 39 variables behind it, which is where the
  26 go. `pushpin.css` then defines one custom property per variable plus
  `--pp-font-family`, which no variable backs, for 300. The plugin descriptions
  claimed "300 design tokens" and now carry no number at all — four hand-edited
  copies of a count nothing checks is a claim that goes stale quietly.

## 0.1.0 — 2026-08-06

First capture of the kit.

**Added**

- 273 tokens across 15 collections, generated to 300 CSS custom properties in
  light and dark with a responsive type ramp.
- Catalog of 117 published components with variant options and import keys.
- 13 text styles and 6 effect styles.
- 131 bindable variable keys, and the 168 hidden from publishing recorded
  explicitly so a generation script fails loudly rather than at runtime.

**Notes from the first capture**

- The kit hides its base ramps, font sizes, shadows, and motion tokens from
  publishing. That is deliberate: consumers reach the semantic layer and use
  published styles for type and elevation. It is also why `variable-keys.figma.json`
  splits bindable from hidden rather than listing keys for everything.
- The kit ships a typo, `title-8/line-heigh`, absorbed by the type regrouping
  rather than propagated into a custom property name. Worth reporting upstream.
- Component property keys embed node ids (`Label#13326:0`). They are stable
  until a component is rebuilt, at which point every `setProperties` call
  written against the old key throws — which is why `diff.mjs` treats a changed
  property key as breaking.

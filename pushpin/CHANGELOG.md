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

## Unreleased

**Added**

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
  silently snapped spacing; and reported on demand by `/pushpin copy`, over pasted
  text, a file, stdin, or a frame's harvested words. The engine decides seven of
  the rubric's sixteen codes and leaves the other nine as judgment, and there is no
  1-5 score and no rewrite block anywhere — the upstream has both, and a score
  invites arguing with the number instead of fixing the line. `check.mjs` reports
  copy as a third finding class beside tokens and component identity, which
  `--no-copy` declines and `--component-only` does not, since that flag exists to
  defer to impeccable's live detector and impeccable has nothing to say about
  words. On a frame the audit gathers the copy and `copy.mjs` decides it, so no
  ruleset is ever restated in a script that cannot read a file; a critical becomes
  a defect and fails the run, and a frame carrying unsettled copy withholds both
  its verdict and its screenshot rather than reporting `ok` on words nobody read.
  `freshness.mjs` gives the rules their own layer on `GITHUB_TOKEN`, apart from the
  Figma captures, because a stale markdown file must not tell someone to
  re-capture the kit. Where the mechanical part stops is written down rather than
  implied: title case needs a capital a proper noun cannot explain, since most
  nouns on a Thumbtack screen are the name of a pro or a business, so it reads
  `Edit Profile` in a declared Button and lets it pass pasted bare; length reaches
  eight components from markup, because the six with separate header and body
  allowances cannot say which slot a text node fills; and passive voice catches the
  fragments the rules name and the unambiguous "been" plus participle, no wider.
  Full surface in [reference/copy.md](pushpin/reference/copy.md), provenance in
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

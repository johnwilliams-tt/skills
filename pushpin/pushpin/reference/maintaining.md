# Maintaining the capture

How to ask whether a source has moved, and what to do when it has, for the
capture this plugin ships to everybody. Session start is `--session` and is
covered in [../SKILL.md](../SKILL.md).

**A project blocked on one stale component wants [refresh.md](refresh.md)
instead.** It repairs that project from its own Figma access and commits the
result beside the project, where this page rebuilds the shipped capture and ends
in a release. Nothing here can be run from a consuming project anyway: every
build script writes relative to its own directory, which under a plugin cache
install is a version-named directory the host deletes on the next update.

## Freshness layers

`freshness` answers in layers and degrades rather than failing when a layer is
out of reach, so it is worth running even with nothing configured.

```bash
node scripts/freshness.mjs                       # capture age; no token, no network
FIGMA_TOKEN=figd_... node scripts/freshness.mjs  # also checks every import key
GITHUB_TOKEN=ghp_... node scripts/freshness.mjs  # also asks whether the copy source moved
node scripts/freshness.mjs --max-age 14          # stricter age limit
node scripts/freshness.mjs --offline             # never touch the network
node scripts/freshness.mjs --json                # machine-readable
node scripts/freshness.mjs --strict              # an unreachable layer fails
node scripts/freshness.mjs --strict --allow-skip variables   # …unless the plan forbids it
node scripts/freshness.mjs --brief               # silent when current, one sentence when not
node scripts/freshness.mjs --session             # session start: silent when current
node scripts/freshness.mjs --offline --session   # the same with no network at all
```

`--brief` and `--session` both print nothing when the capture is current and the
project pin matches. `--brief` otherwise prints the sentence to relay.
`--session` prints a line the agent acts on instead: `fix:` and a command when
the finding is one a plain `init --write` settles — today that is the edit hook,
missing, broken, or naming a plugin version directly — or one the `update` sweep
answers, which is a moved component catalog; and `say:` and a sentence when it
is neither, which is the only case reaching the user. It exits 0 either way,
because a session start that reads as a failed command is the noise the form
exists to remove. `--json` still prints JSON under both.

`--session` never calls Figma or GitHub's API, whatever tokens the shell holds;
the token layers and the copy source skip exactly as under `--offline`. Its one
network call is `lib/remote-state.mjs` reading this repository's `plugin.json`
and `kit-state.json` off `raw.githubusercontent.com`, bounded to 1.5 seconds and
cached for a day under the project's `.pushpin/remote/`. A repository version
ahead of the running copy is one `say:` line naming the harness's update surface;
the repository's kit-state verdict is read in place of the shipped one when its
`against` dates match this install's captures. `--offline --session` reads that
cache and fetches nothing. Neither runs inside this checkout: there is no
`pushpin.config.json` above it, so there is nowhere to cache. Asking for
`/pushpin freshness` prints the full layer table, because then it is the thing
being asked for.

If the current working directory holds a `pushpin.config.json`, a project-pin
layer compares `pluginVersion`, `capturedAt`, and `cssHash` to this plugin. No
config is not a finding — `init` is offered from [start.md](start.md) for a code
project that has none of it yet. The plugin's own tree is skipped.

The age layer is the one that matters day to day: it answers "can I trust this?"
with no token, no plan, and no setup. The key layers need a token carrying
`library_content:read` and answer the sharper question — whether the component
and style keys in the Pushpin catalog, and the Annotation Kit's own component
keys, still exist. They matter because `importComponentByKeyAsync` throws at
runtime on a key that has been unpublished, so a generation script written
against a stale catalog fails halfway through rather than at review. Variables
are the exception: they need `file_variables:read`, which Figma grants only to
full members of Enterprise orgs, so that layer skips politely on any lesser plan.

**`library_content:read` is the whole requirement for the key layers, and the
narrowest scope that covers them.** It reads the components, component sets, and
styles a file publishes, which is exactly what the three key layers compare
against. `library_assets:read` and `team_library_content:read` sound adjacent and
are not: they serve individual-asset and team-level endpoints nothing here calls.
Figma removed the old `file_read` scope in favour of these granular ones, so a
token minted against instructions naming it will not authorize anything.

The copy source layer asks a different host a different question — whether
GitHub still serves the blob the content design rules were parsed from — so it
turns on `GITHUB_TOKEN` and runs whether or not `FIGMA_TOKEN` is set. Without it
the layer falls back to the age of its own capture. The repo is public and would
answer anonymously, but the anonymous allowance is sixty calls an hour against
the whole machine, and a check that can run at every session start would spend
it as an unexplained 403 in somebody else's build.

Exit 1 means something moved. A Figma layer means `refresh`, below; the copy
source means a re-pull instead —
[provenance.md](provenance.md#when-the-copy-source-changes).

`--strict` also exits 1 when a layer could not be checked at all, which is the
mode worth running unattended: without it a run where every Figma layer skipped
still prints a reassuring summary, and that is precisely how four unpublished
components sat in the catalog until a generation run threw on one. `--allow-skip`
takes the names of layers permitted to skip, so a non-Enterprise org runs
`--strict --allow-skip variables` and still fails on an expired token, a lost
file grant, or a rate limit — the gaps that are somebody's to close. An unknown
layer name is fatal rather than ignored, because a typo would quietly restore the
false confidence the flag exists to prevent.

## The scheduled check

[`.github/workflows/pushpin-release.yml`](../../../.github/workflows/pushpin-release.yml)
runs the same command hourly and on demand, and acts on the answer: nothing
moved stops there; movement is re-captured over REST with the `pull-*.mjs`
scripts and released through `release.mjs` when the diff is clean; a Breaking
diff goes to a branch and a PR labelled `pushpin-breaking` for the decision in
step 4 below; a moved style, a tokens capture past `--max-age`, or a spec page
whose bound variables REST cannot name opens one issue labelled `pushpin-tokens`
for the captures only the plugin can take. The token lives there as the
`FIGMA_TOKEN` repository secret, which is the only copy that needs to exist:
consumers of the plugin never hold one, and a maintainer only needs a local token
to take a capture.

The spec pages stop needing a human once `assets/variable-ids.figma.json` is
committed — the `ids` block of [check.md § 1](../scripts/check.md), saved once.
Variable ids are stable across publishes, so with it `pull-specs.mjs` names every
binding on this plan and the workflow re-reads a changed page on its own; re-save
it when sections 1 and 2 are re-taken, since a new variable is a new id.

It exists because every part of this page assumes someone remembers to run a
check, and the library publishes more often than anyone remembers anything. A
failed run uploads its `--json` report as an artifact, so the finding is readable
without spending another pass over the icon layer's 899 keys.

**It also commits the verdict**, as `assets/kit-state.json`, which is how the
finding reaches anyone who is not reading CI. Consumers never hold a token and
session start never calls Figma, so before this the one check that talks to
Figma was also the one nobody saw: a project would be told its pin was current
while the capture behind it had been wrong for a fortnight. `freshness.mjs` reads
the recorded verdict whenever no live layer ran, and ignores it entirely when one
did — a recording is yesterday's answer to the question a token answers now. It
reaches an install two ways: shipped inside the plugin, and ahead of the next
update through `lib/remote-state.mjs`, which reads the committed copy off `main`
at session start.

Two things keep it from becoming noise. It is **not** in `manifest.mjs`'s
`TRACKED` list, deliberately: a verdict is not a capture, and hashing one would
make every CI update report every project as holding an older build. And it
**expires against the captures it describes** — `against` records the six
capture dates it was formed from, and any of them moving retires it, so the
refresh below cannot be nagged about until the next scheduled run. A project
that has taken its own re-capture ([refresh.md](refresh.md)) dated on or after
the verdict is not nagged either: the layer passes for the catalogs the overlay
covers.

Beside the verdict the file carries `moved` — every unpublished and every
changed entry by name, key and page, per layer — and `pluginVersion`, the
release the check ran on. `kit-state.mjs` rewrites the file only when the names
and keys change; a listed component being edited again moves only its
`updatedAt`, which is not a new finding and does not earn a commit.

```bash
node scripts/kit-state.mjs --show   # what is recorded, or that it no longer applies
```

Freshness answers for the catalog, not for the person running it. Keys belong to
the file and resolve identically for everyone, but access does not — that is what
the generation path's preflight checks.

## Refreshing the capture

Run it when someone mentions a Pushpin release, when a design looks off against
the tokens, or when `freshness` exits non-zero.

0. `node scripts/freshness.mjs` first. If it reports a recent capture and every
   reachable layer passes, there is probably nothing to do — the captures below
   are much more work than the check.
1. Take the captures in [../scripts/check.md](../scripts/check.md). The kit capture
   alone is enough for a quick look; add the published and component captures
   before actually updating anything. **Do not skip the component capture's import
   pass.** It is what supplies `publishedProperties`, and without it the property
   ids and variant options come from the kit's working file, which runs ahead of
   what the library serves — `diff.mjs` will say it skipped the comparison rather
   than pass it silently.
2. `node scripts/diff.mjs --kit kit.json --published published.json --components components.json`
3. **No output** — nothing to do. Stop.
4. **Breaking** — stop and report. Name what depends on each item. Regenerating
   will not help: a removed token stays removed and a newly hidden variable
   still cannot be imported. Decide with the design system owner whether to
   follow the kit or pin to the old capture.
5. **Changed or added only** — keep the diff (`diff.mjs ... --json > diff.json`;
   it is the source of the changelog entry in step 8) and update the affected
   files in `assets/`. The rebuild, the hashes and every check run in step 8;
   the individual commands are under [Regenerating](#regenerating) for a look
   in between.

6. **If the diff reported `components: new component "X"`, decide whether X
   belongs in `CORE_COMPONENTS`.** That list in
   [`../scripts/impeccable-bridge.mjs`](../scripts/impeccable-bridge.mjs) is what
   `DESIGN.md` describes to every project, and it is curated rather than derived
   — the kit publishes 115 entries and most are device mocks, brand marks, and
   page furniture nobody hand-rolls. Nothing connects the diff's report to the
   list, so a newly published component that a project *would* hand-roll never
   reaches `DESIGN.md` on its own. The judgement stays here with a person; the
   step exists so the question gets asked. `verify.mjs` covers the other
   direction and fails when a name on the list stops resolving.

7. **If any component changed, recapture its visual spec.** The property API and
   the geometry come from two different reads, so a component whose fill or
   radius moved shows nothing in the `--components` diff. Take
   [check.md §6](../scripts/check.md) for the affected pages, redistil with
   `node scripts/build-specs.mjs --merge` — without `--merge` the write is total
   and every page you did not read loses its specs — and rebuild. Those specs are what
   `DESIGN.md`, `lookup --variant` and `check.mjs`'s fidelity findings all read,
   so a stale one is wrong in three places at once.

8. Release:

```bash
node scripts/release.mjs patch --diff diff.json   # or minor, major, an exact semver
```

   It runs `build-css`, `build-design`, `build-copy --check`, `manifest` and
   `verify` in that order and stops at the first that fails; writes the
   [`../../CHANGELOG.md`](../../CHANGELOG.md) entry from the diff, and from
   `git diff` of the capture dates and entry names for the catalogs `diff.mjs`
   does not compare; bumps the version; rebuilds `DESIGN.md` and `design.json`,
   which name it; and makes one commit. It refuses to run anywhere but this
   checkout or with changes outside `pushpin/`, exits 2 when no capture moved,
   and never pushes. `--dry-run` prints the entry and the commit it would make;
   `--changelog-note "..."` adds a paragraph the diff cannot know, such as why
   the capture was taken. Edit the entry afterwards if more context is owed.

   `build-design.mjs` runs on every release rather than only when a component
   changes, because `DESIGN.md` projects the tokens as well: a colour that
   moved reaches every project through that file too.

   The version goes through `version.mjs`. `../../.claude-plugin/plugin.json`
   is the one place a version is written; the script propagates it to the
   Cursor manifest and [../SKILL.md](../SKILL.md)'s frontmatter, and keeps it
   out of both marketplace entries, where a `version` silently shadows the one
   in `plugin.json`. `node scripts/version.mjs --check` fails when a copy has
   drifted. `init.mjs` writes the plugin version into every project's
   `pushpin.config.json`, which is how a project finds out it is behind, so a
   missed bump makes that check silently useless.

   The commit holds the JSON, the CSS, `DESIGN.md`, `design.json`, the manifest
   and the version files together. They are one fact about one moment;
   splitting them across commits makes provenance unreadable.
9. **A released component change is a sweep in every project that declares
   one.** The two catalog dates go into every pin, so a project on the older
   capture raises a `catalog` finding at its next session start and is handed
   `update` — which is where a restyled fill gets written and a deleted variant
   gets asked about. Nothing here reaches into a project, so the release is not
   the end of the change: [update.md](update.md).

A CI-driven release runs the same `release.mjs` after its own capture and
distil steps, and pushes what it committed. What it cannot do is step 4: a diff
that reports Breaking still goes through a person, and `release.mjs` refuses
such an entry unless `--allow-breaking` is passed once the decision is made.

Never hand-edit a capture to make a diff go away. `verify.mjs` hashes every
asset against the manifest and will catch it.

## Regenerating

`assets/pushpin.css` is generated — never hand-edit it, and never hand-edit what
it was generated from. Nothing in `assets/` is an opinion about the system; the
one hand-authored file there is `copy-map.json`, which joins the copy rules to
the component catalog rather than stating one.

```bash
node scripts/build-css.mjs             # regenerate from tokens.figma.json
node scripts/build-css.mjs --check     # fail if the committed CSS is stale
node scripts/build-design.mjs          # regenerate DESIGN.md and design.json
node scripts/build-design.mjs --check  # fail if either committed file is stale
node scripts/build-copy.mjs            # regenerate from copy.source.md and copy-map.json
node scripts/build-copy.mjs --check    # fail if the committed copy.json is stale
node scripts/build-specs.mjs <lanes>   # redistil the visual specs from a whole-kit capture
node scripts/build-specs.mjs --merge <lanes>  # fold a few recaptured pages into the committed specs
node scripts/manifest.mjs              # rehash and re-count the captures
node scripts/manifest.mjs --check      # fail if the manifest is stale
node scripts/verify.mjs                # resolve every var() chain, verify hashes
node scripts/release.mjs patch --dry-run   # the builds and checks a release runs, and the entry it would write
node scripts/freshness.mjs             # ask whether the sources have moved underneath it
node scripts/kit-state.mjs --show      # what the last scheduled check found
```

Six different failures, six different checks. `build-css --check` catches a CSS
file that no longer matches its source JSON, `build-design --check` a `DESIGN.md`
or `design.json` that no longer matches the tokens and specs they project, and
`build-copy --check` a `copy.json` that no longer matches a fresh parse of the
capture. `verify.mjs` catches a build that transformed its source wrongly, a
spec capture whose recorded reduction disagrees with the variants beside it, and
— via the manifest hashes — any capture that was edited by hand.
`freshness.mjs` catches a capture aging out, an import key disappearing, or the
rules blob moving upstream. `diff.mjs` catches, in detail, the JSON no longer
matching Figma.

Everything but the last two only compares the repo against itself, so none of it
can fail on a stale capture. That is the gap those two exist to close, and it is
why `verify.mjs` prints the capture date underneath its pass message.

Re-extracting from Figma is a `use_figma` call. Use
[../scripts/check.md](../scripts/check.md) to see what moved, and
[../scripts/extract.md](../scripts/extract.md) for the full re-capture.

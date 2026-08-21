# Maintaining the capture

How to ask whether a source has moved, and what to do when it has. Consumers of
Pushpin do not need this; session start is `--offline --session` and is covered
in [../SKILL.md](../SKILL.md).

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
node scripts/freshness.mjs --brief               # silent when current, one sentence when not
node scripts/freshness.mjs --offline --session   # session start: silent when current
```

`--brief` and `--session` both print nothing when the capture is current and the
project pin matches. `--brief` otherwise prints the sentence to relay.
`--session` prints a line the agent acts on instead: `fix:` and a command when
the finding is one a plain `init --write` settles — today that is the edit hook,
missing, broken, or naming a plugin version directly — and `say:` and a sentence
when it is not, which is the only case reaching the user. It exits 0 either way,
because a session start that reads as a failed command is the noise the form
exists to remove. `--json` still prints JSON under both. Asking for
`/pushpin freshness` prints the full layer table, because then it is the thing
being asked for.

If the current working directory holds a `pushpin.config.json`, a project-pin
layer compares `pluginVersion`, `capturedAt`, and `cssHash` to this plugin. No
config is not a finding — `init` is offered from [start.md](start.md) for a code
project that has none of it yet. The plugin's own tree is skipped.

The age layer is the one that matters day to day: it answers "can I trust this?"
with no token, no plan, and no setup. The key layers need a `file_read` token and
answer the sharper question — whether the component and style keys in the Pushpin
catalog, and the Annotation Kit's own component keys, still exist. They matter
because `importComponentByKeyAsync` throws at runtime on
a key that has been unpublished, so a generation script written against a stale
catalog fails halfway through rather than at review. Variables need Enterprise
and are skipped politely without it.

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
   before actually updating anything.
2. `node scripts/diff.mjs --kit kit.json --published published.json --components components-raw.json`
3. **No output** — nothing to do. Stop.
4. **Breaking** — stop and report. Name what depends on each item. Regenerating
   will not help: a removed token stays removed and a newly hidden variable
   still cannot be imported. Decide with the design system owner whether to
   follow the kit or pin to the old capture.
5. **Changed or added only** — update the affected files in `assets/`, then:

```bash
node scripts/build-css.mjs      # regenerate the stylesheet
node scripts/build-design.mjs   # regenerate DESIGN.md and design.json
node scripts/manifest.mjs       # rehash and re-count
node scripts/verify.mjs         # every check including the new hashes
```

`build-design.mjs` runs here rather than only when a component changes, because
`DESIGN.md` projects the tokens as well: a colour that moved reaches every
project through that file too.

6. **If the diff reported `components: new component "X"`, decide whether X
   belongs in `CORE_COMPONENTS`.** That list in
   [`../scripts/impeccable-bridge.mjs`](../scripts/impeccable-bridge.mjs) is what
   `DESIGN.md` describes to every project, and it is curated rather than derived
   — the kit publishes 117 entries and most are device mocks, brand marks, and
   page furniture nobody hand-rolls. Nothing connects the diff's report to the
   list, so a newly published component that a project *would* hand-roll never
   reaches `DESIGN.md` on its own. The judgement stays here with a person; the
   step exists so the question gets asked. `verify.mjs` covers the other
   direction and fails when a name on the list stops resolving.

7. **If any component changed, recapture its visual spec.** The property API and
   the geometry come from two different reads, so a component whose fill or
   radius moved shows nothing in the `--components` diff. Take
   [check.md §6](../scripts/check.md) for the affected pages, redistil with
   `node scripts/build-specs.mjs`, and rebuild — those specs are what
   `DESIGN.md`, `lookup --variant` and `check.mjs`'s fidelity findings all read,
   so a stale one is wrong in three places at once.

8. Add an entry to [`../../CHANGELOG.md`](../../CHANGELOG.md), then bump the
   version with `node scripts/version.mjs patch` — or `minor`, `major`, or an
   exact semver. `../../.claude-plugin/plugin.json` is the one place a version is
   written by hand; the script propagates it to the Cursor manifest and
   [../SKILL.md](../SKILL.md)'s frontmatter, and keeps it out of both marketplace
   entries, where a `version` silently shadows the one in `plugin.json`.
   `node scripts/version.mjs --check` fails when a copy has drifted.
   `init.mjs` writes the plugin version into every project's
   `pushpin.config.json`, which is how a project finds out it is behind, so a
   missed bump makes that check silently useless.
9. Commit the JSON, the CSS, `DESIGN.md`, `design.json`, and the manifest
   together. They are one fact about one moment; splitting them across commits
   makes provenance unreadable.

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
node scripts/build-specs.mjs <lanes>   # redistil the visual specs from a fresh capture
node scripts/manifest.mjs              # rehash and re-count the captures
node scripts/manifest.mjs --check      # fail if the manifest is stale
node scripts/verify.mjs                # resolve every var() chain, verify hashes
node scripts/freshness.mjs             # ask whether the sources have moved underneath it
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

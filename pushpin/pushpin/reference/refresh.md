# Re-capturing the components for one project

For a project that is blocked on a component the plugin's catalog describes
wrongly. It needs the Figma MCP connected to the account, and nothing else.

**This is not [maintaining.md](maintaining.md).** That one refreshes what the
plugin ships, for everybody, and ends in a release. This one refreshes what
*this project* reads, today, and ends in a directory the project can commit. The
two answer different questions and the wrong one is expensive: a maintainer
refresh is seven captures and a diff, and it cannot be run at all without a
writable plugin checkout.

## When this is the right lane

`setProperties` throwing on a variant option, `lookup` reporting a theme the kit
no longer offers, an import key that resolves to nothing, a spec whose fill or
radius disagrees with the canvas. In every case the shape is the same: the kit
republished a component and the shipped catalog predates it.

Run this first, from the project:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/refresh.mjs
```

It prints what this project reads and where each catalog came from. With
`FIGMA_TOKEN` set, `freshness.mjs` is the sharper question — it names the
components that changed after the capture, which is the list this procedure
takes as its argument.

**Prefer waiting for a release where waiting is possible.** The plugin's capture
is diffed, verified, and shared; an overlay is none of those and is one
project's. This exists for the case where that is not a real option.

## What can be overlaid, and what cannot

Four catalogs, and the boundary is not arbitrary:

| Asset | Overlayable | Why |
|---|---|---|
| `components.figma.json` | yes | property keys and variant options — what `setProperties` throws on |
| `component-specs.figma.json` | yes | fills, radii, sizes — what a hand-rolled lookalike gets checked against |
| `icons.figma.json` | yes | one entry, up to four import keys |
| `annotations.figma.json` | yes | the Annotation Kit's own property keys |
| tokens, styles, variable keys | **no** | `pushpin.css`, `DESIGN.md` and `design.json` are generated from them and hashed into the project pin. An overlaid token is a value `lookup` reports and the stylesheet does not have. A token change is a plugin release. |
| copy | **no** | its source is a GitHub blob, not Figma — [provenance.md](provenance.md#when-the-copy-source-changes) |

## The procedure

Load the `figma-use` skill first; it is a required prerequisite for `use_figma`.

### A component's properties changed

This is the common case and the cheap one. Take the import pass from
[../scripts/extract.md §5](../scripts/extract.md) against a file that subscribes
to the kit — **not the kit itself**, where a component is not a library entry —
and save the merged result under `.pushpin/` as a properties capture. Then:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/refresh.mjs --components <capture.json>
```

`build-components.mjs` accepts the `--properties-only` shape as well as a full
capture, and refuses a bare dump rather than guessing membership from names.

**Take the import pass, not the file dump.** The kit's working file runs ahead
of what the library serves, and the dump reports the file. That gap is exactly
what this procedure is repairing.

### A component's geometry changed

Take the per-page script from
[../scripts/extract.md §9](../scripts/extract.md) for the pages holding the
components you need, one `use_figma` call per page, issued in parallel — see
[parallel.md](parallel.md). Then:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/refresh.mjs --specs <lane.json> [<lane.json>...]
```

**This is always a merge**, and `refresh.mjs` passes `--merge` for you. You are
re-capturing the two pages you are blocked on, not all 45, and the plain form
would leave this project holding specs for two components and none for the other
111.

## What you end up with

`.pushpin/assets/`, holding the catalogs you re-captured and an `overlay.json`
recording when, from what, and against which plugin version. The consumer
scripts read it in preference to the plugin's copy, and none of them do so
quietly:

- `lookup` prints a line above its answer naming the catalogs it read.
- `freshness` carries an `overlay` layer, and session start says so.
- `refresh.mjs` with no arguments prints the whole picture.

**Commit it.** It is a fact about the kit, not about your machine, and everyone
on the project should be reading the same catalog. The rest of `.pushpin/` is
machine-local — `preview.pid`, `preview.log`, `backups/`, `update.json` — so
gitignore those rather than the directory.

**Then hold the project against it.** A re-capture repairs what this project
reads and changes nothing it has already built, so the markup that was written
against the old catalog is still there — declaring a theme that has been deleted,
painting a fill that has moved. Nothing in `pushpin.config.json` records a
capture you took yourself, so no pin finding will raise it either:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/update.mjs
```

That sweep is [update.md](update.md). It reports first and writes nothing until
`--write`.

## When it expires

An overlay outranks the plugin, which is right the day it is taken and wrong
once the plugin catches up. So it expires: when the plugin ships a catalog
captured later than yours, `freshness` fails its overlay layer, `refresh.mjs`
marks the file `STALE`, and session start asks for it to be cleared.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/refresh.mjs --clear
```

Nothing is lost — the shipped catalog has been through `diff.mjs` and
`verify.mjs`, which an overlay never was.

`PUSHPIN_NO_OVERLAY=1` answers one command from the shipped catalog without
removing anything, which is how to tell an overlay problem from a plugin one.

## Send it upstream

An overlay repairs one project and leaves every other project broken. When you
take one, say so — the capture you already have is most of a maintainer refresh,
and [maintaining.md](maintaining.md) is what turns it into a release.

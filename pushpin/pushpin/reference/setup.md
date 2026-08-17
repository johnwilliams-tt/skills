# Setting a project up, start to finish

`setup` is the front door. It is one command for the whole job — tokens, the
generated files, the edit check, and the write guard — so nobody has to know
that three commands exist or which order they go in.

`init` is still the thing that writes Pushpin's artifacts, and it is still the
right call on its own for a re-run, a repair, or an update after the plugin
moves. `setup` is for the first time, and for anyone who would rather answer a
question than read a flag list.

Why it exists: `init` ended by printing two more commands to run and had no way
to tell whether they were ever run. That is how a project ends up half
configured with every individual check reporting health — the failure this
plugin keeps rediscovering, most recently as a hook that silently stopped
running. Setup asks, acts, and then checks what is actually true.

## The order

```bash
node scripts/setup.mjs <project-dir>            # 1. read the project
node scripts/setup.mjs <project-dir> --backup   # 2. only if the answer calls for it
node scripts/init.mjs  <project-dir> --write    # 3. write, with the flags it implies
node scripts/setup.mjs <project-dir> --verify   # 4. report what is true
```

## 1. Read the project first

`--assess` prints the stack, where the stylesheet would land, which files are
already there, whether git could undo an overwrite, whether `impeccable` is
installed, and — last — an `Ask:` block.

**Ask exactly the questions in that block, and no others.** It lists only what
the project cannot answer for itself, which on a directory holding no Pushpin
files is nothing at all. A question with one real answer is not a question, and
asking it is how a short setup starts feeling like a form.

## 2. The one question

- **`overwrite` — Pushpin files are already here.** Offer, in this order: back
  them up and replace, replace without a backup, or leave them and write only
  what is missing. Recommend the backup whenever `--assess` reported no git
  repository or uncommitted changes, and say why in those words — a designer's
  prototype folder frequently is not a repository, and that is exactly where an
  unrecoverable overwrite lands.

Replace adds `--force` to the `init` call, preceded by `setup.mjs --backup` when
they asked for one. Nothing else in setup turns on an answer.

Every project gets the `.claude/settings.json` entry, a scratch folder included.
It is what offers the plugin to a teammate who never opens a terminal, and it
carries `autoUpdate`, which is what keeps a folder's tokens from freezing
against a capture that has stopped matching the kit. `init --no-share` still
skips it for anyone who asks for that; setup does not choose it.

The stylesheet destination is read off the project — a recognized styles
directory, or beside a page at the root when there is no such directory — so
there is nothing to ask there either.

## 3. PRODUCT.md, which is not ours to write

Setup does not conduct that interview. `/impeccable init` writes `PRODUCT.md` on
request, for whoever wants it, and `--verify` reports whether the file is there —
which is how the option stays visible without setup spending a turn on it.

**Pushpin must not generate `PRODUCT.md`.** It is product truth, not design
truth. Pushpin knows the tokens and nothing about who the product is for, and a
plausible invented answer there is worse than an empty file, because everything
downstream treats it as given. The interview exists to get it right.

If `impeccable` is not installed, say what that costs in one sentence — the
generated files are still correct and still read by anything using that format —
and finish. Do not install it, and do not offer to.

## 4. Verify, do not advise

`--verify` prints a line per fact and exits non-zero if anything is missing.
Relay it as it stands. Three summaries are possible and they mean different
things: everything done, working but improvable, and unfinished. Do not upgrade
the middle one — a project set up before the generated-file hashes existed is
genuinely working and genuinely unprotected, and telling someone their files are
guarded when they are not is the specific failure this command was built after.

## What to say about impeccable's per-edit detector

`--verify` reports it, and the honest answer surprises people: with the usual
user-global `impeccable` install, `/impeccable hooks on` installs nothing here.
Its installer skips every manifest target unless the project holds a provider
folder such as `.cursor/skills/impeccable`, so there is nothing for it to act on.

**This is not a gap to fix, and Pushpin does not wire it.** `check.mjs` already
reports the token half — the raw hex, the square control, the off-ramp font —
whenever impeccable's hook is absent, and it steps aside only when it finds one
installed. What the impeccable hook would add is its non-token rules and a block
in place of a report, at the cost of Pushpin writing a hook into a path another
skill owns. Say the detector is not installed, say Pushpin's check covers the
tokens, and move on.

## The rule that survives setup

Never `/impeccable document` on a Pushpin project. It regenerates `DESIGN.md`
and `.impeccable/design.json` from scratch with an invented visual world and
deletes the bridge. Both files are machine-written, so `pushpin init --write
--force` restores them exactly and nothing is lost by refusing.

Three things now enforce this rather than one: a write guard refuses the edit on
Cursor, the edit check reports it on the edit that caused it, and the recorded
hashes surface it at session start on any harness. See
[init.md](init.md) § The generated files.

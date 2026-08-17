# Setting a project up, start to finish

`setup` is the front door. It is one command for the whole job — tokens, the
generated files, the edit check, the write guard, and the product context
`impeccable` owns — so nobody has to know that three commands exist or which
order they go in.

`init` is still the thing that writes Pushpin's artifacts, and it is still the
right call on its own for a re-run, a repair, or an update after the plugin
moves. `setup` is for the first time, and for anyone who would rather answer
three questions than read a flag list.

Why it exists: `init` ended by printing two more commands to run and had no way
to tell whether they were ever run. That is how a project ends up half
configured with every individual check reporting health — the failure this
plugin keeps rediscovering, most recently as a hook that silently stopped
running. Setup asks, acts, and then checks what is actually true.

## The order

```bash
node scripts/setup.mjs <project-dir>            # 1. read the project
node scripts/setup.mjs <project-dir> --backup   # 2. only if the answers call for it
node scripts/init.mjs  <project-dir> --write    # 3. write, with the flags the answers imply
                                                # 4. /impeccable init, for PRODUCT.md
node scripts/setup.mjs <project-dir> --verify   # 5. report what is true
```

## 1. Read the project first

`--assess` prints the stack, where the stylesheet would land, which files are
already there, whether git could undo an overwrite, whether `impeccable` is
installed, and — last — an `Ask:` block.

**Ask exactly the questions in that block, and no others.** It lists only what
the project cannot answer for itself. A question with one real answer is not a
question, and asking where the stylesheet goes when the project has a `styles/`
directory is how a short setup starts feeling like a form.

## 2. One round of questions

All of them in a single `AskQuestion` call. Never one at a time.

- **`scope` — is this a prototype or a real project?** The only question always
  asked, because nothing in a directory reveals the answer and it decides two
  others. A prototype gets tokens, the checks, and `AGENTS.md`; it skips the
  `.claude/settings.json` team-sharing entry and the `PRODUCT.md` interview,
  which are ceremony on a folder that exists to answer one question. A real
  project gets everything.

- **`overwrite` — Pushpin files are already here.** Offer, in this order: back
  them up and replace, replace without a backup, or leave them and write only
  what is missing. Recommend the backup whenever `--assess` reported no git
  repository or uncommitted changes, and say why in those words — a designer's
  prototype folder frequently is not a repository, and that is exactly where an
  unrecoverable overwrite lands.

- **`stylesheet` — where should the tokens go?** Only when no known styles
  directory was recognized. Offer the guess first.

Then map the answers onto one `init` call:

- prototype adds `--no-share`
- replace adds `--force`, preceded by `setup.mjs --backup` when they asked for one
- a chosen path adds `--css-path <path>`

## 3. PRODUCT.md, which is not ours to write

For a real project, go straight into `impeccable`'s own `init` — load its
`reference/init.md` and conduct that interview in the same turn. Do not stop and
tell the user to run `/impeccable init` themselves; continuity is the entire
point of this command, and a handoff the user has to perform is the thing setup
replaces.

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

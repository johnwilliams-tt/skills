# Upstream report: `figma-use` traversal docs teach a silently-wrong search on freshly created subtrees

**Target:** Cursor Figma plugin, bundled `figma-use` skill
**Plugin content hash observed:** `7f6562c4900fafb46e5e8fd3cc8ced954779bab3`
**Filed from:** Thumbtack Pushpin design-system skill (`pushpin` v0.13.2), which copied the defective pattern verbatim
**Severity:** high — the failure mode is a wrong answer with no error, and the docs' own "correct" example teaches the failing form

All line numbers below refer to files under:

```
~/.cursor/plugins/cache/cursor-public/figma/7f6562c4900fafb46e5e8fd3cc8ced954779bab3/skills/figma-use/
```

That directory is derived and content-addressed. Editing it locally does not survive a plugin update, and any local edit is silently discarded the next time the hash changes. That is why this is a report rather than a patch.

---

## 1. Summary

An instance's interior is materialized lazily in Figma. The search APIs only ever see already-materialized nodes, and they never trigger materialization. On a subtree that was **created, cloned, or detached during the current script**, they therefore return confidently wrong results — an empty array, or a partial set — instead of throwing. Only an explicit recursive read of `.children` forces materialization.

The invariant, stated positively:

> A subtree created, cloned, or detached during the current `use_figma` script has an unmaterialized interior. Every search API lies about it until something reads `.children` recursively. A subtree that was already in the file when the script started does not have this problem.

Two later measurements qualify that sentence without dissolving it: the effect is gated on `figma.skipInvisibleInstanceChildren`, which this harness reports as `true`, and `createInstance()` on its own did not reproduce it. §2 and §2a carry the numbers. The documentation defect below stands either way, because the receiver the docs illustrate is the one readers go on to reuse on detached and cloned subtrees, which do reproduce.

Two properties make this unusually bad as a documentation defect:

1. **`findAll` with a predicate fails identically to `findAllWithCriteria`.** (Measured; see §2.) So the reflexive fix — "the criteria API is too clever, fall back to the general-purpose `findAll`" — looks like a fix while staying exactly as broken. The current docs actively steer readers into that fallback (gotchas.md:415, gotchas.md:457).
2. **The docs' `CORRECT` example uses an `instance` receiver** (gotchas.md:461-469, and a second copy at component-patterns.md:196-213), in a narrative about populating a slot on an instance you just created two lines earlier — so the pattern a reader takes away is "search whatever this script just produced", which is the receiver class that does fail. On the `createInstance()` receiver as literally written, it did not reproduce; §2a is explicit about that and about why the block still needs fixing.

Net effect: a reader who follows the traversal guidance exactly, on the kind of receiver the guidance illustrates, gets `undefined` and no error — and gets it on the receivers the guidance itself steers them toward, since the smallest known ancestor of freshly detached or cloned work is the freshly detached or cloned node.

## 2. Reproduction

**The whole effect is gated on `figma.skipInvisibleInstanceChildren`, which reads back `true` at the start of every `use_figma` call in this harness.** With the flag `false`, none of the shapes below reproduce at all. That measurement was taken after the first draft of this report and it narrows the bug considerably; §2a records what does and does not reproduce, and §5 now recommends the flag rather than the helper.

Minimal shape that does reproduce, in one `use_figma` call, with the flag left at its harness value:

```js
const frame = instance.detachInstance();

// Every one of these under-reports, with no error thrown — measured on a
// 26-node subtree six levels deep:
frame.findAllWithCriteria({ types: ['FRAME'] }).length;   // 4, correct answer 9
frame.findAll(() => true).length;                        // 12, correct answer 25
frame.query('FRAME').length;                             // 4, correct answer 9

// A recursive .children read repairs all three:
const materialize = (n) => { const kids = n.children; if (kids) for (const k of kids) materialize(k); };
materialize(frame);
```

The second reproducing shape is `clone()` — but of a **container holding an instance**, not of the instance. `hostFrame.clone()` where `hostFrame` contains an instance reported 0 `FRAME`s where 9 was correct. `instance.clone()` reported 9 of 9. The container is what carries the effect.

The downstream symptom is not the failed search — it is `slot.appendChild(content)` on `undefined`, one or more lines later, which throws something that reads like a handle problem rather than a traversal problem.

**What is measured vs. inferred.** Measured in the Pushpin work: with the flag at its harness value of `true`, `findAllWithCriteria`, `findAll(predicate)` and `query()` all under-report on a subtree produced by `detachInstance()` within the same script, and by `clone()` of a frame containing an instance; a recursive `.children` walk repairs all of them. With the flag set `false` at the top of the script, none of them under-report and no walk is needed. `detachInstance()` across calls is clean. **Not measured:** the traversal cost of the flag in this harness; the mechanism behind the order-dependent partial counts in §2a; why cloning an instance is safe while cloning its container is not; whether a subtree *cloned* in call *N* is materialized when read in call *N+1*. Those are in §6, flagged for you to verify, not asserted here.

### 2a. What does not reproduce, and what self-heals

Two measured results that narrow the bug's scope, and one that makes it harder to observe than it looks.

**`createInstance()` never reproduced it.** Eight conditions: depths to 8, up to 11 nested instances, with and without `setProperties`, from an imported component set and from a local main component. Every search API answered correctly on the first call in all eight. Worth noting for the record: the "unappended instance" condition is unreachable, because `createInstance()` auto-parents to the current page — `instance.parent.type === 'PAGE'` immediately on creation — so there is no unparented instance to test.

This bears directly on §3c. The example at component-patterns.md:196-208 is `card.createInstance()` followed by a search, and on this evidence **that example is arguably not a live reproduction.** We are not claiming it fails. What we are claiming is narrower and still worth fixing: it is the recipe readers copy, and readers copy it onto receivers that were detached or cloned, where it does fail. The same holds for the `CORRECT` block at gotchas.md:461-469.

**Three of the four search APIs partially self-heal, in an order-dependent way.** `findAll`, `findOne` and `query` return the pre-materialization view on the first call and materialize as a side effect of walking, so an identical second call is often correct. `findAllWithCriteria` reads an index the subtree never populated and never self-corrects. Interleaving probes over one subtree returned 1, 9 and 24 for what should have been a single number. That is the property that let this survive three separate misdiagnoses: a reader who adds a log line, or retries, sees the correct answer and concludes the problem was elsewhere.

## 3. Defective passages, with line numbers

### 3a. `references/gotchas.md:413-471` — "Prefer indexed lookups over `findAll` / `findOne` full-tree scans"

The rule as a whole carries no staleness caveat at any point in its 59 lines. Specific lines:

| Line | Text | Problem |
|---|---|---|
| 415 | "Reserve `findOne` / `findAll(predicate)` for cases the criteria API can't express" | Frames `findAll` as the general-purpose escape hatch. It has the same blind spot. This sentence is what makes the wrong fix look right. |
| 417 | "`findAll` and `findOne` **walk the entire subtree** node-by-node and run a JS predicate on each one." | False in the unmaterialized case, and it is the load-bearing false claim. A reader who believes it has no reason to suspect traversal when a node is missing, and will go looking at names, IDs, or handles instead. |
| 423 | table row recommending `page.query('TEXT[name=Title]')` | Promotes a third search surface that does share the blind spot — measured, §6a — with no caveat saying so. |
| 457 | "`findAll(() => true)` is shorter, **equivalently fast**… " | Presented as an equivalent alternative on the speed axis only. On a fresh subtree it is equivalently *wrong*, which the caveat does not say. |
| **461-469** | the `WRONG` / `CORRECT` pair | **The primary defect.** The `CORRECT` block is the failing pattern, on an `instance` receiver, in a slot-population context — see §2a on why this specific receiver did not itself reproduce and why the block is still the thing to fix. Reproduced below. |
| 471 | "Name-only lookups … remain the right tool when you only have a name." | Third endorsement of predicate search with no caveat. |

The `CORRECT` block as it currently stands (gotchas.md:461-469):

```js
// WRONG — predicate walks every node
const slot = instance.findOne(n => n.type === 'SLOT' && n.name === 'Content')

// CORRECT — type-indexed criteria + name filter
const slot = instance
  .findAllWithCriteria({ types: ['SLOT'] })
  .find(n => n.name === 'Content')
```

Both halves fail whenever the receiver was detached or cloned in this script, which is the receiver a reader arrives at by following this block's own advice to scope to the smallest known ancestor. On a `createInstance()` receiver specifically, neither half reproduced under measurement (§2a) — so the sharper statement of the defect is that the block teaches the reader that the difference between the two forms is performance, when the difference that actually matters on a fresh subtree is that both are blind and neither says so.

Also: the Contents entries at gotchas.md:14-15 summarize both traversal rules purely in performance terms, so a reader skimming the table of contents gets no hint either.

### 3b. `references/gotchas.md:473-501` — "Scope traversal to the smallest known ancestor"

- **475**: "Every `findAll` / `findOne` / `findAllWithCriteria` walks the entire subtree of the receiver." Same false claim as line 417, stated more absolutely and applied to all three APIs at once. This is the sentence most likely to be quoted back as authority.
- **483, 492-495, 501**: the rule pushes readers toward the *smallest* receiver — a specific frame the script may well have just created. The guidance is right on performance and, taken alone, maximizes exposure to this bug, because the smallest known ancestor of freshly created work is freshly created.

### 3c. `references/component-patterns.md:192-213` — second copy, plus a wrong attribution

- **194**: "In a component instance, slot nodes are accessible by `findOne()`." Unconditionally true only for pre-existing instances.
- **196-208**: same pattern, again with `const instance = card.createInstance()` two lines above the search. Stated honestly: on measurement this exact shape did **not** reproduce (§2a), so we are not reporting it as a live failure. It is reported because it is the reference recipe, and the recipe is what gets copied onto the receivers that do fail.
- **194 and 210-212**: "In narrow cases the original node handle can be invalidated by the append, so if a post-append edit throws `"Internal Figma Error: Parent not found"`, re-find the sublayer through the slot's `children`."

That last item is the most consequential single line in this report. The prescribed workaround is correct — re-reading `.children` is exactly what materializes the subtree — but **the attributed cause is wrong**. It says the append invalidated the handle. What actually happened is that `.children` materialized what the search could not see. A correct fix with a wrong explanation is worse than no fix, because it terminates the investigation: the reader stops at "handles can go stale after append", generalizes that, and never learns the real invariant. This is one of the three misdiagnoses in §4, and it propagated verbatim into Pushpin (`pushpin/reference/generate.md:246-249`).

### 3d. `SKILL.md:41` and `SKILL.md:314` — atomicity

Rule 14 (SKILL.md:41) and §7's opening (SKILL.md:314), duplicated at `references/validation-and-recovery.md:58`:

> "`use_figma` is atomic — failed scripts do not execute. If a script errors, no changes are made to the file."

We have no evidence this is inaccurate for a single call, and we are not claiming it is. The point is narrower and worth adding to the docs: **atomicity does not help with this bug, and interacts badly with it.** A silently wrong traversal does not throw. It produces a *successful* script with wrong output — the wrong node populated, or a slot left empty — so there is no rollback, no error message, and nothing for the recovery procedure in §7 to fire on. The reader's mental model after rule 14 is "either it worked or nothing happened," and that model is exactly wrong here.

The one accurate handle on it in the current docs is SKILL.md:336-342 ("When the script succeeds but the result looks wrong"), which is good advice that never connects to traversal.

Related: the error-recovery row at **SKILL.md:334** attributes `"The node with id X does not exist"` to `detachInstance()` ID invalidation, and prescribes "re-discover nodes by traversal from a stable (non-instance) parent frame." Same shape of problem as §3c — a plausible cause for a symptom this bug also produces, sending the reader down a handle-invalidation path. Worth a cross-reference to the new gotcha once it exists. The same pairing appears at gotchas.md:977-993 (`detachInstance()` invalidates ancestor node IDs), whose `CORRECT` example at gotchas.md:990 searches a subtree immediately after a detach. That is the shape §2 reproduces, so **the example is unsound as written** within a single call; across calls it is clean (§6c).

### 3e. `figma.skipInvisibleInstanceChildren` is absent from the entire skill

Grepping the skill for `skipInvisibleInstanceChildren` returns hits only in the dumped typings (`references/plugin-api-standalone.d.ts:98, 111, 116, 5904`) and the generated index (`references/plugin-api-standalone.index.md:22`). No prose reference — SKILL.md, gotchas.md, and component-patterns.md never mention it.

Documented semantics, verified against the typings at `references/plugin-api-standalone.d.ts:87-116`:

- **d.ts:88-89** — when enabled, "causes all node properties and methods to skip over invisible nodes (and their descendants) inside instances."
- **d.ts:91** — "Note: Defaults to **true in Figma Dev Mode and false in Figma and FigJam**."
- **d.ts:102** — "`children` **and** methods such as `findAll` will exclude these nodes." Both, explicitly.
- **d.ts:103-105** — `getNodeByIdAsync` returns null, `getNodeById` returns null, and reading a property on an already-held handle for such a node throws.
- **d.ts:116** — it is a writable `boolean`.

Why this matters for the fix: because `.children` is *also* filtered when the flag is true (d.ts:102), the recursive-walk workaround inherits the same blind spot for hidden instance descendants unless the flag is set `false` first. A reader who adopts `materialize()` on a hidden-content component and still comes up empty has no way to find that out from this skill.

**The divergence, now measured:** the typings say the default is `false` in Figma design files and `true` only in Dev Mode, and `use_figma` reports `true` — at the start of every call, not once per session. That is a harness-specific divergence from the skill's own documented default, in a design file, with no prose anywhere in the skill that would tell a reader about it. It is worth documenting on its own merits, independent of everything else in this report. Numbers in §6b.

## 4. Blast radius

- **Every reader of the traversal rule.** The rule is one of the skill's most cited (Contents gotchas.md:14-15; cross-referenced from gotchas.md:423, gotchas.md:432, SKILL.md's efficient-APIs section). Its worked example is on the kind of receiver a reader is then most likely to reuse in a context that does break.
- **Two independent copies inside the skill** (gotchas.md:461-469 and component-patterns.md:196-208), so fixing one leaves the other.
- **Downstream skills copy it verbatim.** Thumbtack's Pushpin skill lifted the pattern into its component-slot documentation (`pushpin/reference/generate.md:228-233`) and the wrong "Parent not found" attribution alongside it (`pushpin/reference/generate.md:246-249`). It has since produced at least three production failures in Figma generation runs, **each misdiagnosed differently**:
  1. as "reading a page that had not been loaded" (fix: add `setCurrentPageAsync` — did not help, because the page was already current);
  2. as the false general claim that `findAllWithCriteria` never descends into instances (fix: switch to `findAll` with a predicate — did not help, because both share the blind spot; this is the failure mode gotchas.md:415 and gotchas.md:457 lead you to);
  3. as handle invalidation by `appendChild` (fix: re-find via `.children` — *did* help, for the wrong reason, which is what let the bug survive to be rediscovered; the attribution came straight from component-patterns.md:194).

  Three misdiagnoses over three incidents, on the same line, is the strongest available evidence that the current text does not merely omit the caveat but actively misdirects.
- **Failure signature is a wrong result, not an error.** Combined with the atomicity framing in §3d, a run can complete "successfully" with empty slots and no diagnostic.

## 5. Proposed patch

The intent is to **preserve the performance guidance, not reverse it.** `findAllWithCriteria` remains the right call. It just needs a subtree it can actually see.

### 5a. The primary fix is the flag, not the helper

```js
figma.skipInvisibleInstanceChildren = false;   // once, at the top of the script
```

Measured: with the flag `false`, the blind spot is **absent rather than mitigated**. A cloned host frame reported 10 of 10 `FRAME`s and 44 of 44 nodes on the first call, before and after a walk; a detached frame reported 10 of 10 and 43 of 43. There is nothing left for a materialization walk to repair.

This is a better fix than the helper on three counts. It is one assignment rather than a recursive function every caller has to remember to invoke on the right receiver. It is unconditional, so it does not require the reader to correctly classify their receiver as fresh or pre-existing — the classification this bug's three misdiagnoses each got wrong. And it repairs `findAllWithCriteria`, which is the one API that never self-heals (§2a), rather than relying on a side effect of reading `.children`.

Two things the flag has to be documented alongside. It **must be set per script**: it reads back `true` at the start of every `use_figma` call in this harness regardless of what the previous call assigned, so it is not a session setting. And it makes traversal slower — d.ts:113-114 puts the speedup from `true` at "several times" for `findAll`/`findOne` and "hundreds of times" for `findAllWithCriteria` on large documents with invisible instance children. **We did not measure that cost in this harness**, so the honest guidance is that correctness outranks speed for read-heavy passes and that generation subtrees are small enough for the question not to arise, without a number attached.

### 5a-bis. Keep the helper as the fallback

```js
const materialize = (n) => { const kids = n.children; if (kids) for (const k of kids) materialize(k); };
```

Called once, after clone or detach and before any search on that subtree. It remains worth documenting for readers who cannot afford the flag's traversal cost, and it is what the assertion in §5e verifies. It is strictly the weaker fix: it is per-receiver, it depends on the reader identifying the receiver correctly, and while the flag is `true` it inherits the flag's own blind spot for hidden instance descendants (§3e), so it does not subsume the flag in either direction.

### 5b. `gotchas.md:459-469` — replace the block

Replacement text:

> **When the predicate combines type + name (or another non-indexed attribute), use criteria for the type and a `.filter`/`.find` for the rest** — the criteria stage already narrows the candidate set to the matching type using the index.
>
> **First, make the subtree visible to the search.** An instance's interior is materialized lazily. No search API triggers materialization, and none of them error when they miss — on a subtree this script detached, or cloned from a container holding an instance, they return an empty or partial result. `findAll` with a predicate is **not** a workaround, and neither is `query`; all four APIs share the blind spot. Setting `figma.skipInvisibleInstanceChildren = false` removes it outright; a recursive read of `.children` repairs it per receiver.
>
> ```js
> // WRONG — searching a subtree detached in this script; returns undefined, throws nothing
> const frame = instance.detachInstance()
> const slot = frame.findAllWithCriteria({ types: ['SLOT'] }).find(n => n.name === 'Content')
>
> // ALSO WRONG — the predicate and selector forms have the same blind spot
> const slot = frame.findOne(n => n.type === 'SLOT' && n.name === 'Content')
> const slot = frame.query('SLOT[name=Content]')[0]
>
> // CORRECT — one assignment at the top of the script, then indexed lookups as normal
> figma.skipInvisibleInstanceChildren = false
> const frame = instance.detachInstance()
> const slot = frame.findAllWithCriteria({ types: ['SLOT'] }).find(n => n.name === 'Content')
> ```
>
> A subtree that was already in the file when the script started does not need this, and neither does one from `createInstance()` alone. If the search finds nothing on a node this script did not detach or clone, the cause is elsewhere.

### 5c. `gotchas.md:417` and `gotchas.md:475` — qualify the false claim

At 417, replace "`findAll` and `findOne` walk the entire subtree node-by-node" with:

> `findAll` and `findOne` walk the entire **materialized** subtree node-by-node and run a JS predicate on each one. (See [Materialize freshly created subtrees before searching](#materialize-freshly-created-subtrees-before-searching) — no search API sees unmaterialized instance interiors.)

At 475, replace "Every `findAll` / `findOne` / `findAllWithCriteria` walks the entire subtree of the receiver" with the same qualification, and add one line to the rule at 483:

> Scoping to the smallest ancestor also means your receiver is more likely to be something this script just detached or cloned — set `figma.skipInvisibleInstanceChildren = false`, or materialize the receiver first.

### 5d. `gotchas.md:457` — extend the caveat

Append to the `findAll(() => true)` caveat: "…and note that it is equivalently *blind* as well: like every search API, it does not see unmaterialized instance interiors."

### 5e. New standalone gotcha, inserted after `gotchas.md:471`

Titled **"Materialize freshly created subtrees before searching."** Contents: the invariant from §1, the flag as the primary fix and the helper as the fallback (§5a), the triggering operations as measured — `detachInstance()`, and `clone()` of a container holding an instance, with `createInstance()` recorded as not reproducing (§2a) so the rule is not overstated — the explicit note that neither `findAll` nor `query` is a fallback, the `skipInvisibleInstanceChildren` interaction from §3e, and the assertion pattern below for read-heavy passes.

```js
figma.skipInvisibleInstanceChildren = false;   // hidden instance descendants are excluded from .children too
const before = root.findAllWithCriteria({ types: ['FRAME'] }).length;
materialize(root);
if (root.findAllWithCriteria({ types: ['FRAME'] }).length !== before) throw new Error('stale traversal');
```

State the cost honestly where it lands: `false` makes traversal slower (d.ts:113-114 puts the speedup from `true` at "several times" for `findAll`/`findOne` and "hundreds of times" for `findAllWithCriteria` on large documents with invisible instance children). Correctness outranks speed for audits; speed usually wins for generation, where the subtrees are small.

Add a Contents entry at gotchas.md:14-15 so the caveat is discoverable from the table of contents, not only from the traversal rule.

### 5f. `component-patterns.md:194` and `196-213` — fix the recipe and the attribution

Replace 194 with:

> In a component instance, slot nodes are found the same way as any other node — but if this script detached the instance, or cloned a container holding one, the search will not see its interior (see [gotchas.md → Materialize freshly created subtrees before searching](gotchas.md#materialize-freshly-created-subtrees-before-searching)). No search API triggers materialization, and none of them error when they miss.

The example at 196-208 needs a pointer to that gotcha rather than a rewrite: `card.createInstance()` followed by a search did not reproduce under measurement (§2a), so inserting `materialize(instance)` into it would document a fix for a failure this shape does not have. What the example does need is the caveat, because it is the recipe readers carry to receivers that do fail.

Replace 194's trailing clause and the comment at 210-212. The current text says the append invalidated the handle; the accurate version is:

> If a search on a subtree this script detached or cloned returns nothing, or a post-append edit throws `"Internal Figma Error: Parent not found"`, the usual cause is an unmaterialized interior rather than an invalidated handle. Reading `slot.children` fixes it because reading `.children` is what materializes the subtree — set `figma.skipInvisibleInstanceChildren = false` at the top of the script, or walk `.children` deliberately, rather than treating a re-read as a retry.

### 5g. `SKILL.md:41` / `SKILL.md:314` — add the non-throwing case

Append to rule 14 and to §7's opening:

> Atomicity only covers scripts that **error**. A search that silently misses does not error — it returns an empty result and the script succeeds with wrong output. There is nothing to roll back and nothing for this procedure to fire on. See §"When the script succeeds but the result looks wrong" (SKILL.md:336) and gotchas.md → Materialize freshly created subtrees before searching.

Mirror in `references/validation-and-recovery.md:58`.

### 5h. `SKILL.md:122-181` — `node.query()` caveat

`query()` does share the blind spot — measured, §6a. So: add one line under **Scope** at SKILL.md:161 pointing at the new gotcha, and qualify the `BEFORE`/`AFTER` equivalence at SKILL.md:126-131, which as written claims `query` replaces `findAll` and carries the blind spot along with it. Also update the table row at gotchas.md:423, which recommends `query` as the fix for exactly the type-plus-name case in the broken example.

## 6. Needs verification by the plugin authors — not claims

Mostly open questions rather than findings. Two — 6a and 6b — have since been measured and are recorded as closed, because the answers change the patch and this is where a reader will look for them.

### 6a. Does `node.query()` share the blind spot? — measured, yes

`query('FRAME')` on a detached frame returned 4 where 9 was correct, and 9 after a recursive `.children` walk. It is blind, and it self-heals on a repeat call the way `findAll` and `findOne` do (§2a) rather than the way `findAllWithCriteria` does not.

So the consequence is the one this section flagged as the worse of the two: SKILL.md §5 is promoting a third search API with the same trap. gotchas.md:423 offers `page.query('TEXT[name=Title]')` as the replacement for the type-plus-name predicate in the broken example, and SKILL.md:126-131 frames `query` as a drop-in for `findAll` — on a fresh subtree it is a drop-in for `findAll`'s blindness as well.

What remains yours to answer is the mechanism, which decides how the caveat should be worded. `query()` is a plugin extension rather than a Figma API (`references/plugin-api-standalone.d.ts:11229-11296`, under "Additional APIs (available via use_figma)"), and its selector surface — combinators, pseudo-classes, dot-path attribute traversal (SKILL.md:134-144) — is not expressible in `findAllWithCriteria` criteria, so it presumably has both an indexed fast path and a JS-side walk. If the blindness depends on which path a given selector takes, the caveat needs to say so rather than being stated flatly.

### 6b. `figma.skipInvisibleInstanceChildren` in the `use_figma` harness — now measured, closed

Both halves of this question have been answered since the first draft. They are recorded here rather than deleted, because the answers are the report's most actionable finding and this is where a reader looking for them will come.

**The harness value is `true`, per call.** The flag reads back `true` at the start of every `use_figma` call, whatever the preceding call assigned to it. It does not persist across calls within a session. The typings document the default as `false` in Figma and FigJam and `true` only in Dev Mode (d.ts:91), so **this harness diverges from its own documented default in design files** — which is exactly the divergence §3e predicted would matter, and it belongs in the skill prose whether or not anything else in this report is acted on. A reader who trusts d.ts:91 will write a script whose traversal silently omits hidden instance descendants and will have no way to find that out from the skill.

**Setting it `false` restores both `.children` and the search APIs, within the same script, for traversals started after the assignment.** With the flag set at the top of the call, a cloned host frame read 10 of 10 `FRAME`s and 44 of 44 nodes on the first search, identically before and after a recursive `.children` walk; a detached frame read 10 of 10 and 43 of 43 the same way. Set it before the first read rather than between two reads, or an assertion of the §5e shape fires on the flag change itself rather than on staleness.

Still open here, and the reason §5a's cost note carries no number: **the traversal cost of `false` in this harness was not measured.** d.ts:113-114 gives orders of magnitude for the Figma API generally; nothing was timed under `use_figma`.

### 6c. Is a subtree cloned in call *N* materialized when read in call *N+1*?

Still unmeasured for `clone()`, and it decides how far the caveat has to reach. If cross-call clones are still unmaterialized, `materialize()` is needed at the top of every consumer call, not just in the call that created the node. If they are materialized (e.g. by whatever the harness does between calls, or by `setCurrentPageAsync`), the caveat can be scoped to within-call subtrees, which is a much smaller rule to teach.

**The detach half is measured and clean.** Detach in call *N*, read in call *N+1*: every count before a walk equalled every count after it. So gotchas.md:977-993 is sound in the cross-call case. It is still worth a caveat in the within-call case, which is what the `CORRECT` example at gotchas.md:990 actually shows — `stableFrame.findOne(...)` immediately after `nestedChild.detachInstance()`, in one script, which is the shape that reproduces in §2.

Two more mechanism questions the measurements raised and did not settle: **why the partial counts are order-dependent** (interleaved probes over one subtree returned 1, 9 and 24 for what should be one number, §2a), and **why `instance.clone()` is safe while `containerHoldingTheInstance.clone()` is blind.** Both are internal to your implementation. The second one in particular decides whether the rule readers should be taught is about clones or about containers, and right now we can only report the observation.

### 6d. Is there an officially supported way to force materialization?

`materialize()` works but is a side-effect-driven idiom — it relies on reading `.children` for its effect rather than its value, which is exactly the kind of thing a future optimization could break. If the plugin exposes or could expose an explicit materialization call, or if `findAllWithCriteria` could be made to materialize (or to throw rather than return an empty result on an unmaterialized receiver), that is a better fix than a documented workaround. A throw would have saved three separate misdiagnoses here.

### 6e. Is the atomicity claim still exactly true?

Not disputed and not measured against the current build. Asked only because §3d hangs a documentation change on it: if atomicity is per-call and unconditional, the added sentence in §5g is the whole fix. If there are exceptions (partial application on certain error classes, or async operations that have already committed), §7 needs more than a sentence.

## 7. Where this came from

Thumbtack's Pushpin skill (`pushpin` v0.13.2) generates Figma layouts from real library component instances. Its slot-filling documentation at `pushpin/reference/generate.md:228-233` is a verbatim copy of gotchas.md:465-469, and its `Parent not found` note at `pushpin/reference/generate.md:246-249` is a paraphrase of component-patterns.md:194. Both are being corrected on our side in the same change that produced this report. We are reporting rather than patching the cache because the plugin directory is derived and content-addressed at `7f6562c4900fafb46e5e8fd3cc8ced954779bab3` — a local edit there is lost on the next plugin update, and downstream skills would keep copying the original.

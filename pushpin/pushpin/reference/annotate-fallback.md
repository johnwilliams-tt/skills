# When the Annotation Kit is out of reach

Load this only when an Annotation Kit import has actually failed. The kit is
reachable in the ordinary case, and drawing a note when it is available is the
defect it always was.

A library out of reach degrades the run rather than ending it: notes get drawn
instead of instanced, and the substitution is reported rather than hidden.


The access preflight in [generate.md](generate.md#the-access-preflight) resolves
one Annotation Kit key before anything is built. When that import fails, the run
does not stop — it draws the notes instead, and says so. Only an unreachable
Pushpin stops a run, because Pushpin is the only one of the three whose absence
leaves nothing to place.

The reasoning is worth stating, because it runs against this page's own rule.
Reaching Pushpin without reaching the Annotation Kit is the ordinary case, not
the exotic one. Refusing to generate in that setup meant a layout built entirely
from published components, proposing nothing and needing no note, still failed —
over a library it would never have opened. A drawn note is worth less than an
instanced one. It is worth far more than no screen.

## What to draw, and what not to

Only the working set this workflow actually places. The kit publishes 91
components and approximating all of them would be a second design system nobody
asked for.

| Instead of | Draw | Sized |
|---|---|---|
| `Annotations` · `Multi-line` | `Annotations (drawn) / Multi-line` | 320 wide, height hugs, 288 text column |
| `Annotations` · `List Elelemt` | `Annotations (drawn) / List Elelemt` | 360 wide, height hugs, a number and a body |
| `Annotations / Pointers` · `Number` | `Annotations (drawn) / Pointers · Number` | 24×24, `cornerRadius/full` |
| `Sticky Note Status` · `Open Question` | `Annotations (drawn) / Sticky Note Status` | 320 wide, height hugs |
| `Capstones` | `Annotations (drawn) / Capstones` | the width of the block it heads, 112 tall |

**Do not approximate the rest.** The accessibility annotations, `Guide`,
`Framing Cards`, the Thumbprint contribution components, and everything else on
the General page carry meaning in their own structure — an `A11y / Annotation /
Spec` says "this is an `h2`" because of which published component it is, and a
drawn box saying `h2` is a different and much weaker claim. If one of those is
what was asked for and the kit is out of reach, say the kit is out of reach.

Directional `Pointers` are also not drawn. A pointer's whole job is to aim, an
approximated arrow aims badly, and the numbering scheme in [Anchoring](annotate.md#anchoring-number-dont-point)
already removes the need for one. **When notes are drawn, number them regardless
of how few there are** — the three-or-fewer case that allows pointers assumes a
real `Pointers` instance.

## Drawing one

The stand-in mimics the real component: same width, same padding, same corner
radius, so the column reads as it always does and a reviewer is not asked to
decode a new visual language on top of reviewing a design.

```js
const note = figma.createFrame();
note.name = 'Annotations (drawn) / Multi-line';
note.layoutMode = 'VERTICAL';
note.counterAxisSizingMode = 'FIXED';      // 320 wide, like the real one
note.resize(320, 1);
note.primaryAxisSizingMode = 'AUTO';       // height hugs the text
```

Everything after that is the ordinary rules of this plugin, which is the point —
a drawn note is held to the same standard as anything else generated here:

- **Bind the fill.** `background/neutral/default` with a
  `border/neutral/default` stroke. The audit's fill check is scoped to the design
  frame, and a note in the column sits outside it, so nothing will catch a literal
  here for you — which is a reason to be careful with it rather than a licence. A
  drawn `Pointers · Number` does sit on the design and is checked.
- **Bind padding and radius.** `space/4` padding and `cornerRadius/medium`, never
  literal numbers. Same rule as any frame this plugin creates.
- **Use a published text style.** `Text/3` for the body via
  `setTextStyleIdAsync`, its key from `lookup.mjs --style Text/3`. Raw font
  settings are what a rebuilt-from-scratch proposal shows first, and the same
  applies here.
- **Keep the body text byte-identical** to what an instanced note would carry.
  The audit finds proposal notes by reading `TEXT` characters for `Proposed:`
  anywhere on the page and never checks what kind of node they sit in, so a drawn
  note satisfies the `Tier` and `Derived` requirement exactly as an instance
  does. Do not reformat it because it is drawn.

Placement does not change at all. Auto-layout lays out frames and instances
identically, so the bundle, the gutter, the gap, the ordering, and the no-overlap
guarantee all hold without modification. A drawn note goes in a
[proposal card](propose.md#each-proposal-is-a-card-and-the-card-carries-a-specimen) beside
its specimen exactly as an instanced one does — the specimen is an instance of a
local component and needs no library at all, so it is the one part of an
annotation that never degrades.

## It is reported, not hidden

Drawn notes go in the audit's `degraded` bucket, which does not fail the run, and
the chat handoff names the library that was out of reach. That is the whole
bargain: the notes are honest about being second-best, and the reader is told why
in the one place they are certain to look.

The naming carries it on canvas. `Annotations (drawn) / Multi-line` tells the
next person who opens the file what happened, and it is what the audit matches
on — which is why the prefix is not optional and not `Note` or `Annotation`.


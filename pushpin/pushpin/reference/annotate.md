# Annotating a design

Notes on a Thumbtack design are placed as instances from the **Annotation Kit**,
a second published library alongside Pushpin. File `Qefv6O2RMPSBtSYBrCGcdI`,
library key `lk-7faccc61…`. The same rule applies here as everywhere else in
this plugin: import and instance, never draw. A drawn note looks the same in a
screenshot and behaves differently in every other respect — it will not update
with the kit, it is invisible to the audit, and it tells a reviewer that the
file was assembled rather than composed.

`assets/annotations.figma.json` is the catalog: 91 published components across
the kit's four pages, each with its import key and each property's exact `key`
field. Read a name and a variant option out of it rather than typing one. Some
published names are misspelled in the file, and the misspelling is load-bearing:
`Annotations` has a variant literally named `List Elelemt`, and three of
`Motion Tokens`' variants end in `[Anrdoid]`. Pass the corrected spelling and
`setProperties` throws.

## Setting the text

**No annotation component exposes its body text as a component property.** The
catalog will show you a `Type` or a `Size` variant and nothing else, and
`setProperties` moves only variants. The text lives in a plain `TEXT` node
inside the instance, so the recipe is always: create the instance, set the
variants, then load the font on that node and assign `characters`.

```js
const set = await figma.importComponentSetByKeyAsync(
  'aa6e465a9c85c4067a897cc46408bd116d1e3e69',
);
const note = set.defaultVariant.createInstance();
note.setProperties({ Type: 'Multi-line' });

const body = note.findOne((n) => n.type === 'TEXT');
await figma.loadFontAsync(body.fontName);
body.characters = 'Proposed: FilterChip\nExtends: Chip\n…';
```

Which node to reach for depends on whether the layer was named by a designer or
auto-named by Figma from its own content:

| Instance | Text node |
|---|---|
| `Annotations` · `Multi-line` | the one `TEXT` node |
| `Annotations` · `Small` | the one `TEXT` node |
| `Annotations` · `Number` | layer `Number` |
| `Annotations` · `Dev Note` | two nodes: title first, body second |
| `Annotations` · `Guide` | two nodes: heading first, body second |
| `Annotations` · `List Elelemt` | layer `Number`, then the body node |
| `Annotations / Pointers` · `Number` | layer `Number` |
| `Annotations / Pointers` · `Label` | layer `Label` |
| `Capstones` | layer `Large capstone`, at every size |
| `Sticky Note` | layer `Note` |
| `Sticky Note Status` | layer `Label` is the theme; the first `Note` is the body |

`Number`, `Label`, `Note` and `Large capstone` are names a designer set, so they
are stable — `Large capstone` is the layer name on the Small and Medium
capstones too, which reads oddly and is nonetheless correct. Every other node in
that table is auto-named from its own content, which means **its name changes
the moment you write to it.** Find those by type and position, never by name, or
a second pass will fail to find what the first pass renamed.

## What each annotation is for

### Annotations

Seven variants on one `Type` axis, from a 24px dot to a full page of guidance.

| Variant | Size | For |
|---|---|---|
| `Number` | 24×24 | A numbered dot placed on the design, keyed to a numbered note elsewhere |
| `Small` | 163×32 | A single-line label, when a sentence would be too much |
| `Multi-line` | 320×104 | The general-purpose note. A 288px text column, so write in short lines |
| `List Elelemt` | 360×104 | One numbered row — a `Number` and a body, for building a list of your own length |
| `List` | 360×824 | Seven numbered rows already stacked |
| `Dev Note` | 300×128 | A titled note aimed at engineering rather than at design review |
| `Guide` | 500×656 | A heading and a long body, for explaining a pattern rather than a screen |

The `Multi-line` placeholder text tells the designer to detach the note to add a
motion token. The plugin does not do that: a detached instance is a defect by
the audit's own rules, and the reason for the note is to be legible as library
work.

### Annotations / Pointers

"Used to help point out specifics of a design and adding reference points for
documentation purposes." Three axes — `Direction` (Left, Down, Up, Right) ×
`Type` (Number, Label, Bracket) × `Mode` (Dark, Light), 24 variants. A pointer
is what connects a note to the thing it is about; without one, a reviewer has to
guess which element a paragraph refers to. Use `Bracket` when the note covers a
range of elements rather than one.

### Capstones

"Used to define a section of frames for Developer/Eng Handoff." One `Size` axis
— Small (485×112), Medium (1363×205), Large (1470×294). A capstone is a heading
for an area of canvas, so pick the size that matches the width of what it heads
rather than the importance of the content.

### Sticky Note and Sticky Note Status

`Sticky Note` is the plain one, `Regular` or `Small`. `Sticky Note Status` adds
a `Theme` — To Do, Open Question, Impediment — and a `Completed` axis, and
exists "to provide information about a design that otherwise might be nested in
comments." Its point is that an unresolved question is visible on the canvas
instead of buried in a comment thread nobody reopens. Use it for a question the
design cannot answer, not for a rationale that belongs in a note.

`Completed` is a variant, not a boolean property: its two options are the strings
`'false'` and `'true'`, so `setProperties({ Completed: true })` throws and
`setProperties({ Completed: 'true' })` is what you want.

### Accessibility annotations

Thirteen published components on the Accessibility Annotations page, covering
headings, landmarks, links, buttons, images, form labels and autocomplete
tokens, reading and tab order, skip links, page titles, arrows, and a compliant
marker. They express intent an engineer cannot read off a mock — that this text
is an `h2`, that this region is `<nav>`, that focus moves here next.

Two of them are published under the same name. `A11y / Annotation / Spec` exists
twice, with different keys and different variant axes: one carries interaction
states (`Active`, `Hover`, `Focus`, `Disabled`, …) and the other carries
`Error`, `Keyboard` and `Style` with an `Example` axis. The catalog keys them as
`A11y / Annotation / Spec [1193:410]` and `[1193:431]` for that reason. Look at
the variant options to tell which one you want; the name will not tell you.

### The rest of the General page

Not annotation vocabulary, but published from the same library and worth knowing
exists rather than rebuilding: `Framing Cards` for the why behind a project,
`Project status` / `Project overview` / `Thumbnail` for file-level metadata,
`Figma file structure` for page naming, `Gesture / …` and `Cursor / …` for
interaction diagrams, `Motion Tokens`, `Line`, `Endpoint`, `Studio Feedback`,
`Team Member`, and `Deprecated` for overlaying work that is no longer in use.

## The proposed-component note

When the plugin creates a local `Proposed / <Name>` component — the gate for
that is in [generate.md](generate.md) — it states the case on the canvas next to
it. The body is key-value lines: it reads in a 320px box, and the audit parses
it to tell a documented proposal from an undocumented lookalike.

```
Proposed: FilterChip
Extends: Chip
Tier: better-experience
Delta: adds a count badge; Chip offers left/right icons only
```

| Field | Required | Content |
|---|---|---|
| `Proposed:` | always | The component name, matching the local component after `Proposed / ` |
| `Extends:` | always | The closest published Pushpin component, or `none` |
| `Tier:` | always | `gap` or `better-experience` |
| `Delta:` | extensions | One line on what the published component cannot express |
| `Case:` | net-new | The business argument for adding it to the system |

`Tier` records which argument the reviewer is being asked to accept. `gap` means
no published component covers the interaction without lying about its API or
breaking a Pushpin rule. `better-experience` means something could be stretched
to cover it and a new component would be clearly better. Both are legal; they
are not the same claim, and a reviewer who cannot tell them apart cannot weigh
either.

A note missing `Tier`, or a `Proposed /` component with no note at all, is a
defect. The annotation requirement is not satisfied by an empty sticky.

## Placement

Beside the screen, never on top of it:

- A `Capstones` instance heading the proposal area, so the area reads as
  deliberate rather than as leftovers.
- One `Annotations` note per proposal, `Multi-line` variant.
- An `Annotations / Pointers` instance aimed at the local instance the note is
  about — the instance on the screen, not the component definition.
- A short summary frame listing every proposal on the screen, so a reviewer can
  count them without hunting.

Nothing is written into the Annotation Kit itself. It is a shared library, and
the plugin refuses to write into shared libraries for the same reason it refuses
to write into the Pushpin kit.

## The promotion path, which this plugin does not walk

A proposal annotated on a product file is not a contribution to Thumbprint. The
Annotation Kit's **Thumbprint page** documents what an actual contribution
involves, and the plugin records it here so the next step is known — it does not
place any of it and does not perform any of it.

The page holds three sections:

- **Tokens** — 43 published swatch components (`Color / Blue`, `Font / Title 1`,
  `Space [Web]`, `Shadow`, `Corner Radius`, `Duration`, and so on) for calling
  out a token on canvas. These document Pushpin's variables; they are not a
  second source of truth for token values. [tokens.md](tokens.md) and
  `assets/tokens.figma.json` are.
- **Thumbprint** — `Contributing`, `Contributing / Pages`,
  `Contributing / Instructions`, and `Contribution / Checklist`.
- **Cheatsheets** — `Branching`.

The flow those components describe:

1. **Branch the library.** From the dropdown next to the library name, create a
   branch named `Component / intent` — the component as the prefix, then the
   reason for the change; the file's own worked example is a tooltip gaining a
   top-border option. Changes on a branch do not affect the main file.
2. **Make a `🤖 Handoff` page** in the branch and insert
   `Contribution / Checklist` on it.
3. **Fill in the checklist's six items**, marking each `Done` as you go:
   *Internal audit* (screenshots of the pattern already in Thumbtack apps and
   sites), *External audit* (the same pattern in other products), *Explorations*
   (at least two or three options, with feedback from Thumbprint platform leads),
   *Figma component* (the component that will actually be added to the library),
   *Specs & spacing*, and *Examples* (mocks of the proposal in product context).
4. **Request review** from the design system lead through the branch review
   modal.

Steps 1 and 3 are the ones that matter for an agent-authored proposal: the audit
and exploration work is human judgment about whether Thumbtack should own this
component, and an on-canvas `Proposed /` note is the raw material for it, not a
substitute.

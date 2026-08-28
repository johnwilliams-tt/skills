# The Figma bridge

## Files

| File | Key | What it is |
|---|---|---|
| Pushpin Thumbprint UI Kit | `VVRGrLgkPRU3vs765d5Q3r` | **Canonical.** Tokens, components, styles. Source for most of `assets/`. |
| Thumbprint UI Kit | `jjhhb3Kp6a7JrtBLCjrf6u` | **Canonical for icons.** The icon set is published from here by design. Also where Code Connect points. |
| Annotation Kit | `Qefv6O2RMPSBtSYBrCGcdI` | Notes, pointers, capstones. See [annotate.md](annotate.md). |

**Icons come from the second file, not the first, and that is deliberate.** The
icon set stayed in Thumbprint on purpose rather than being copied forward, so
there is one set of glyphs for both systems and no second copy to drift. It is
not a migration Pushpin has yet to finish, and it is not a gap — do not expect it
to move, and do not propose an icon on the grounds that Pushpin lacks one.

What it does mean is that the Pushpin kit publishes 115 public components and not
one of them is an icon. Searching the Pushpin library for a caret returns nothing,
which reads as "no such icon" and is really "wrong library". Ask the catalog
instead — `node scripts/lookup.mjs --icon caret` — and see
[generate.md](generate.md) for the placement rules.

Library keys, for scoping `search_design_system` with `includeLibraryKeys`:

```
Pushpin       lk-003ce4846b4638268325b33ad167ece0cd390787a2782f1949cee2e38ca2e7719472f0968d45b4c2f0db9b35ec1820babadcf97a9f40fdd6cc84ba22f7b10a80
Icons         lk-6d54e39c09e05fd3a5164fcc5a88cf6a2dbedd3ad29d20c2ce66ee39c57c81234d16c5746301ace3ae6af7d5bcf49b7389800cb4f7b9521f2fb70de1af7c2dd6
Annotations   lk-7faccc611b9ec03ccd81012447b2a1a34ffe027b513f5f94a328a5498c10f76052ba27c537a70120b6b9bd592bd8c09c3fc9abc03281c9fab80b1513aa2f03b1
```

The Pushpin file subscribes to eight team libraries, including the older
Thumbprint UI Kit, Thumbprint Global, Thumbprint Native, and an Illustration
Library. A `search_design_system` call without `includeLibraryKeys` searches all
of them and will happily return a pre-Pushpin component. Scope the search — to
Pushpin for components, and to the icon library for icons.

**Every Figma MCP read needs a `fileKey`.** `search_design_system` and
`get_variable_defs` both reject calls without one, and `get_variable_defs`
additionally needs a concrete `nodeId`. To enumerate variables wholesale, use
`use_figma` instead — see [../scripts/extract.md](../scripts/extract.md).

## Figma → code

1. Load the `figma-design-to-code` skill. It is a required prerequisite for
   `get_design_context`.
2. Read the page the linked frame sits on and offer it —
   [context.md](context.md). In this direction the thing worth surfacing is
   states: a sibling named `Results (empty)` or `03 Payment — error` is the
   same screen in another state, and a component built from the linked frame
   alone falls over on the second one. Name those siblings in the offer.
3. Call `get_design_context` with the `fileKey` and `nodeId` from the URL
   (converting `-` to `:` in the node id).
4. Check for Code Connect hints in the response. Read the caveat below before
   trusting their absence.
5. Map what comes back to tokens, not to raw values. A returned `#07344a` is
   `--pp-background-brand-strong`; a returned `16px` gap is `--pp-space-4`. The
   response is a reference to adapt, not code to paste.
6. **Where the frame uses a published component, read its spec before writing a
   stand-in.** `get_design_context` describes the frame, not the component the
   instance came from, so a hand-rolled version is built from one rendering of
   one state and nothing says what the other states look like:

   ```bash
   node scripts/lookup.mjs Button --variant "theme=secondary"
   ```

   That prints the captured fill, border, radius, height, padding and label as
   `--pp-*` names. It is worth the call even when the returned frame looks
   obvious: the border on Pushpin's secondary button is `--pp-border-neutral-default`
   at 1.5px, and the version that got written from the design alone invented a
   token the kit does not publish and missed that one. Where nothing was
   captured, `--variant` names the read that returns it rather than leaving the
   silence that invited the guess.
7. Icons resolve to the icon set, not to `<img>` of an exported PNG. A layer
   named `Caret-Left Icon · Small` is `@thumbtack/thumbprint-icons`'
   `NavigationCaretLeftSmall` — the category comes from
   `lookup.mjs --icon Caret-Left`, and the size suffix carries through.
8. Run the frame's words through the copy engine before writing them into
   markup, fix what it finds, and disclose the change — below.

### Copy is corrected on the way in

A string on a frame arrives in code as a decision somebody already made, which
is why it is the one thing in this direction that gets copied across rather than
translated. Every other value is mapped: a `#07344a` becomes a token, a `16px`
gap becomes `--pp-space-4`, an exported PNG becomes an icon from the set. The
words go through untouched unless something reads them, and a button saying
`Submit Request` is off-guideline in the design, off-guideline in the markup,
and expensive to change in either once the build exists.

So the text nodes go through the engine before the markup does, not after:

```bash
node scripts/copy.mjs --text '[Button] Submit Request
[Body text] Your request has been confirmed by the contractor.
[TextInput] ZIP code'
```

```
Major — fix before handoff
  [Button]     1:10  M3  generic-cta    "Submit" is a generic call to action — name the action
  [Button]     1:17  M1  title-case     title case on "Request" — sentence case unless it is a confirmed brand name
  [Body text]  2:26  M2  passive-voice  "has been confirmed" is passive — say who does what
  [Body text]  2:52  M8  wrong-term     "contractor" — Thumbtack says "pro"
```

The label is how each string reaches its rule. A catalog name resolves through
the copy map — `TextInput` to placeholder and helper text — and a row name like
`Header` resolves directly, which is what an unenclosed text node otherwise has
no way of saying. Anything whose length could not be measured is named after the
findings rather than passed over in silence. [copy.md](copy.md) has the command
in full.

**Fix what it finds in the markup you write, and say what changed.** One entry
per string that moved, in the chat summary:

```
Copy corrected on the way in:
  Button — "Submit Request" → "Send request" (generic CTA, title case)
  Body — "…confirmed by the contractor." → "Dana confirmed your request." (passive, wrong term)
```

That disclosure is the whole reason the designer can fine-tune the result. A
silent rewrite is a copy change nobody was told about, landing in the one place
they will not think to re-read, and this plugin already refuses the same move
for snapped spacing — which gets a `Token drift` note — and for a library it
could not reach.

**The frame itself is not edited.** Nothing in this direction writes to Figma.
The correction lives in the markup and the disclosure is what lets the design
catch up.

## Code → Figma

1. Load the `figma-use` skill before any `use_figma` call, and
   `figma-generate-design` when building a full screen.
2. Call `search_design_system` **first**, scoped to the Pushpin library key, and
   build from real components. Never draw a button as a rectangle when the kit
   publishes one.
3. Bind fills and spacing to the kit's variables rather than setting literal
   values, so the result stays live against the library.
4. For a web page being captured for the first time, run `generate_figma_design`
   and `use_figma` in parallel — the screenshot for fidelity, the component
   assembly for correctness — then reconcile and delete the screenshot. Issue
   both in one message; [parallel.md](parallel.md) sets how far a write may be
   split and what a lane may not touch, since a lane that reaches outside its
   own subtree collides with the work already on the page.

## Code Connect: the gap

Code Connect is what makes both directions use real components instead of
guessing. It is currently **not wired for Pushpin**.

What exists today: 24 `.figma.tsx` files in
`~/Thumbtack/prototyping-playground/lib/packages/thumbprint-react`, with a
`figma.config.json` whose `projectId` is `thumbprint-ui-kit`. Every mapping in
them points at the **old** Thumbprint file (`jjhhb3Kp6a7JrtBLCjrf6u`), not the
Pushpin file. Components covered: Alert, AlertBanner, Avatar, Button, ButtonRow,
Calendar, Checkbox, Chip, Dropdown, FormNote, HorizontalRule, Image, InputRow,
Label, Link, LoaderDots, Pill, Popover, Radio, ServiceCard, StarRating, TextArea,
TextInput, Tooltip.

Three consequences:

- A design in the Pushpin file returns **no** Code Connect hints, so
  `get_design_context` hands back anonymous CSS and class-name soup instead of
  component names. The fallback is the class-name mapping table in
  [components.md](components.md).
- Writing back to Figma has no code→component mapping to work from.
- Those files were **stripped during vendoring** into `tt-website-demo`, so the
  one project doing the most Pushpin work has no bridge at all.

Whether the existing mappings were ever published (`figma connect publish`) is
unconfirmed — a `get_code_connect_map` probe against the old file returned empty,
but the call timed out, so the result is not conclusive. Verify before assuming
the work is missing rather than merely unpublished.

### Do not publish mappings unilaterally

Closing the gap is mechanically simple — repoint the mappings at Pushpin node
IDs and publish. **Don't.** Not without the design system owner's agreement.

Published Code Connect attaches to the shared library, so it changes what every
designer and engineer sees in Dev Mode. Unlike everything else in this plugin,
it is a write to a resource other people depend on, and a wrong snippet carries
Figma's authority at the exact moment someone is trusting it — at handoff.

Three specific ways it goes wrong here:

- **Import paths are unverified.** The only Thumbprint usage visible from this
  plugin is a *vendored* copy that deliberately avoids the npm packages. What
  production imports is unknown. A snippet that names the wrong module is worse
  than no snippet.
- **Pushpin's new components have no React implementation.** Accordion, Badge,
  Callout, Counter, Disclosure, Progress Meter, Segmented Control, Slider, Tabs,
  Tip. Mapping them means inventing an API for something that doesn't exist.
- **Work is already underway.** The Pushpin file has `MCP / Code Connect PoC`
  and `Pushpin Migration` pages. Assume an owner and a plan; ask before adding.

Reads are safe and worth doing: `get_code_connect_suggestions`,
`get_context_for_code_connect`, and `get_code_connect_map` change nothing.
`send_code_connect_mappings` and `add_code_connect_map` publish — treat both as
requiring explicit sign-off.

Until then the class-name table in [components.md](components.md) covers reading
Pushpin designs, and the token layer — the large majority of the value — does
not depend on Code Connect at all.

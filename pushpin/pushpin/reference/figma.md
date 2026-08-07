# The Figma bridge

## Files

| File | Key | What it is |
|---|---|---|
| Pushpin Thumbprint UI Kit | `VVRGrLgkPRU3vs765d5Q3r` | **Canonical.** Tokens, components, icons. Source for `assets/`. |
| Thumbprint UI Kit | `jjhhb3Kp6a7JrtBLCjrf6u` | Predecessor. Still where Code Connect points. |

Pushpin's published library key, for scoping `search_design_system` with
`includeLibraryKeys`:

```
lk-003ce4846b4638268325b33ad167ece0cd390787a2782f1949cee2e38ca2e7719472f0968d45b4c2f0db9b35ec1820babadcf97a9f40fdd6cc84ba22f7b10a80
```

The Pushpin file subscribes to eight team libraries, including the older
Thumbprint UI Kit, Thumbprint Global, Thumbprint Native, and an Illustration
Library. A `search_design_system` call without `includeLibraryKeys` searches all
of them and will happily return a pre-Pushpin component. Scope the search.

**Every Figma MCP read needs a `fileKey`.** `search_design_system` and
`get_variable_defs` both reject calls without one, and `get_variable_defs`
additionally needs a concrete `nodeId`. To enumerate variables wholesale, use
`use_figma` instead — see [../scripts/extract.md](../scripts/extract.md).

## Figma → code

1. Load the `figma-design-to-code` skill. It is a required prerequisite for
   `get_design_context`.
2. Call `get_design_context` with the `fileKey` and `nodeId` from the URL
   (converting `-` to `:` in the node id).
3. Check for Code Connect hints in the response. Read the caveat below before
   trusting their absence.
4. Map what comes back to tokens, not to raw values. A returned `#07344a` is
   `--pp-background-brand-strong`; a returned `16px` gap is `--pp-space-4`. The
   response is a reference to adapt, not code to paste.
5. Icons resolve to the icon set, not to `<img>` of an exported PNG.

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
   assembly for correctness — then reconcile and delete the screenshot.

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

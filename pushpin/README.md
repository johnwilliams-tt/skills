# pushpin

Thumbtack's **Pushpin** design system, packaged so a project can pick it up
without relearning it. Install once, and every project knows the tokens, the
type ramp, the component map, the icon set, and how to move designs between
Figma and code in either direction.

The point is not to document Pushpin. It is to make Pushpin the **cheapest
thing to reach for** — so that using the right token is less work than
inventing a value, and drift stops being the default outcome.

## The Figma file is the source of truth

Everything in `pushpin/assets/` is generated from the Pushpin Thumbprint UI Kit
(`VVRGrLgkPRU3vs765d5Q3r`):

```
Figma variable collections
  └─ scripts/extract.md        read via use_figma
      └─ assets/tokens.figma.json   verbatim capture, committed
          └─ scripts/build-css.mjs      deterministic transform
              └─ assets/pushpin.css         300 tokens, 526 declarations

scripts/check.md -> scripts/diff.mjs   detects the kit moving underneath it
```

Three failures are possible along that chain, and each has its own check.

`build-css.mjs --check` fails if the committed CSS doesn't match a fresh build,
so the generated file cannot drift from the capture. `verify.mjs` independently
resolves 308 color values out of the CSS — 109 semantic tokens in both light and
dark, plus all 90 base ramps — following each alias chain to a literal and
comparing it against Figma, so the transform itself cannot be subtly wrong. It
also confirms every token is accounted for as either bindable or hidden from
publishing, and hashes every asset against `manifest.json` so a capture edited
by hand is caught. 645 checks in total.

The third failure is the capture no longer matching Figma, which no local check
can see. That is what `/pushpin refresh` is for, below.

Custom property names mirror Figma variable paths. The variable
`background/brand/strong` is `--pp-background-brand-strong` — so any value in a
rendered page traces back to a variable in the kit by name alone, with no
lookup table in between.

This matters more than it sounds. Every hand-written restatement of Pushpin
checked so far has drifted from the kit, including an official-looking export
that got 65 of 77 color values right and quietly changed the other twelve. The
generated chain exists so that class of bug can't recur. The details are in
[`pushpin/reference/provenance.md`](pushpin/reference/provenance.md).

## What ships

| | |
|---|---|
| `assets/pushpin.css` | 300 custom properties (526 declarations once dark mode and the responsive ramp are counted) — color (light + dark), spacing, radius, responsive type ramp, elevation, motion, breakpoints — plus `.pp-*` type utilities. No dependencies, no build step. |
| `assets/tokens.figma.json` | The verbatim Figma capture the CSS is generated from. |
| `assets/components.figma.json` | All 117 published components with exact variant options and the key to import each one. |
| `assets/variable-keys.figma.json` | Which variables are bindable from another file (131) and which are hidden from publishing (168). |
| `assets/styles.figma.json` | The 13 text styles and 4 elevation styles — the only way to apply Pushpin type and shadow in Figma. |
| `reference/generate.md` | Building Figma layouts from real instances, and auditing that you did. |
| `reference/tokens.md` | The token vocabulary and how to choose between tokens. |
| `reference/components.md` | Kit inventory, the Thumbprint React map, and the class-name fallback for designs with no Code Connect. |
| `reference/figma.md` | File keys, library keys, workflow directions, and the state of Code Connect. |
| `reference/provenance.md` | What is authoritative, what isn't, and why. |
| `scripts/build-css.mjs` | Regenerates the CSS. `--check` for CI. |
| `assets/manifest.json` | Hash and shape of every capture, so a hand-edit is detectable. |
| `scripts/verify.mjs` | 645 checks — resolves every color var() chain against the Figma capture, confirms every token is accounted for as bindable or hidden, and hashes each asset against the manifest. |
| `scripts/build-components.mjs` | Distills the raw component dump into the catalog. |
| `scripts/init.mjs` | Sets a project up. Plans first, writes only with `--write`. |
| `scripts/check.md` | The `use_figma` captures used to detect that the kit moved. |
| `scripts/diff.mjs` | Classifies what moved as breaking, changed, or added. |
| `scripts/extract.md` | The `use_figma` scripts that refresh the capture in full. |

## Generating Figma layouts

The failure mode this guards against is a layout that **looks** like Pushpin but
is structurally fake — a drawn rounded rectangle where a `Button` instance
should be. It's invisible in a screenshot and obvious to the first person who
opens the file, which is the worst possible ordering.

So the plugin ships the two catalogs that make the real path the easy one: the
component keys to import and instance, and the variable keys to bind. Neither is
guessable — Button has 8 themes × 5 sizes and its icon toggles are named
`👁️ icon (left)` and `👁️ iconRight`.

`reference/generate.md` carries the workflow and a structural audit that reports
detached instances, pill-shaped frames that aren't instances, and literal fills
that should have been bindings. Run it before handing anything over; a
screenshot cannot tell you any of this.

**This path is verified.** A mobile screen — TextInput, two Buttons, a card —
was generated into a real file and audited clean: 5 instances resolved to remote
library components, 0 local, 0 lookalikes, 0 unbound fills.

That exercise also corrected the plugin twice, which is the argument for having
done it. The component catalog was initially missing the property `key` field,
without which `setProperties` throws on any non-variant property. And the keys
file listed 168 variables that cannot actually be imported — the library hides
its base ramps, font sizes, shadows, and motion tokens from publishing, so type
and elevation have to come from published styles instead. Both were invisible
until something real was built.

## Install

Add the marketplace, then install:

```
/plugin marketplace add johnwilliams-tt/skills
/plugin install pushpin@johnwilliams-skills
```

## Use

The skill is model-invokable — it activates on Thumbtack interface work without
being asked. Invoke it directly when you want a specific job:

| Command | |
|---|---|
| `/pushpin init` | Set a project up — stylesheet, Figma keys, agent note |
| `/pushpin tokens` | Answer a token question |
| `/pushpin components` | Map a design or component to Thumbprint React |
| `/pushpin figma` | Move a design between Figma and code |
| `/pushpin check` | Audit for off-system values |
| `/pushpin refresh` | Check whether the kit has moved, and update if it has |

`init` prints a plan and changes nothing until you pass `--write`:

```bash
node pushpin/scripts/init.mjs ~/Projects/some-app
node pushpin/scripts/init.mjs ~/Projects/some-app --write
```

It picks a stylesheet location that suits the stack it finds, never overwrites
without `--force`, and is safe to re-run. Re-running it on a project already set
up reports whether that project has fallen behind — an older capture, an older
plugin version, or a stylesheet someone edited by hand.

## Staying current

A capture is a snapshot, and the dangerous failure is silent: a token gets a new
hex and every project keeps shipping the old one. `/pushpin refresh` closes that
gap. Take the captures in
[`pushpin/scripts/check.md`](pushpin/scripts/check.md), then:

```bash
node pushpin/scripts/diff.mjs --kit kit.json --published published.json \
                              --components components-raw.json
```

The diff sorts what moved by consequence rather than listing it flat, because
the two are not the same problem:

- **Breaking** — a removed token, a variable that became hidden from publishing,
  a changed component property key. Consumers fail, and regenerating the CSS
  does not help. Exits non-zero.
- **Changed** — values moved. Rebuild and ship.
- **Added** — new tokens, components, styles. Safe to adopt.

Two vantage points are needed because they answer different questions. The kit
file has values, aliases, and publish flags but reflects **editor state**,
including unpublished edits. A consuming file sees only what was actually
published. When they disagree, someone has work in flight, and the diff says so
rather than capturing it by accident.

Each entry lands in [`CHANGELOG.md`](CHANGELOG.md), so a consumer can see what
moved and when.

Since Thumbtack is on Figma Enterprise, `scripts/pull-published.mjs` is
available as a shortcut: one authenticated call returns the published variables
with no editor-state ambiguity, and reports whether anything shipped since the
committed capture. It needs a `FIGMA_TOKEN` with `file_variables:read`, and it
supplements the plugin path rather than replacing it.

## Known gaps

- **Code Connect does not cover the Pushpin file,** and closing that gap is
  deliberately left open. The 24 existing mappings point at the predecessor
  Thumbprint kit, so `get_design_context` on a Pushpin design returns anonymous
  CSS instead of component names. Publishing mappings would fix that, but it
  writes to a shared library and changes what every engineer sees at handoff —
  with unverified import paths and ten Pushpin components that have no React
  implementation. That needs the design system owner's sign-off, not a unilateral
  push. The fallback map in `reference/components.md` covers reading meanwhile,
  and the token layer doesn't depend on it. See `reference/figma.md`.
- **Icons and the Thumbtack Rise font are not yet vendored here,** so `init`
  does not install them. They exist in the Claude Design export, whose non-token
  assets are sound even though its token values are not. The font is already
  installed locally, which is why the Figma generation path renders correctly.
- **Motion, breakpoint, and elevation tokens exist in CSS but not in Figma.**
  The library hides them from publishing, so a generated layout can carry a
  shadow via an effect style but cannot bind a duration or a breakpoint.
- **Pushpin's new components** (Accordion, Badge, Callout, Counter, Disclosure,
  Progress Meter, Segmented Control, Slider, Tabs, Tip) have no React
  equivalent. Compose from primitives and tokens.

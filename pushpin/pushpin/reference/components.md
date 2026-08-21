# Components

## What the kit publishes

From the Pushpin file's component pages. Names are the Figma page names.

**Carried from Thumbprint** — Action Sheet, Alert, Avatar, Button, Button Row,
Calendar, Carousel, Checkbox, Chip, Dropdown, Fab, Form Note, Horizontal Rule,
Icon Button, Image, Input Row, Label, Link, Loader Dots, Modal, Pill, Popover,
Radio, Service Card, Star Rating, Switch, Text Area, Text Input, Toast, Tooltip.

**New in Pushpin** — Accordion, Badge, Callout, Counter, Disclosure, Progress
Meter, Segmented Control, Slider, Tabs, Tip. In progress: Banner, Card, Combobox,
Pro details.

**Retired** — Alert Banner and Date Picker are marked ❌ in the file. Don't
introduce them into new work.

The new components have **no React equivalent** in `@thumbtack/thumbprint-react`.
Building one means composing it from primitives and tokens. Do that with
`--pp-*` tokens throughout so it converges with the real component when it ships.

## React

For a project on Thumbprint React, the component layer is Thumbprint and the
token layer is Pushpin. The components read the v2 semantic custom properties,
which are the same tokens this plugin ships — so a correctly configured project
needs **no per-component overrides** to look like Pushpin.

| Figma | React |
|---|---|
| Button / CTA | `<Button theme="primary">` |
| Ghost button | `<Button theme="secondary">` |
| Text link | `<TextButton>` |
| User photo | `<UserAvatar imageUrl={…}>` |
| Business photo | `<EntityAvatar imageUrl={…}>` |
| Text field | `<TextInput>` |
| Multi-line field | `<TextArea>` |
| Select | `<Dropdown>` |
| Checkbox | `<Checkbox>` |
| Radio | `<Radio>` |
| Toggle | `<Switch>` |
| Label | `<Label>` |
| Helper text | `<FormNote>` |
| Star rating | `<StarRating>` |
| Loading | `<LoaderDots>` |
| Divider | `<HorizontalRule>` |
| Tag / badge | `<Pill>` |
| Selectable chip | `<FilterChip>` |

### If you are reaching for an override

Stop and check which layer is actually wrong. A project that needs
`!important` to get pill buttons has a token wiring problem, not a component
problem — the v2 stylesheet almost certainly isn't loaded, or v1 tokens are
winning the cascade. Overriding by selector appears to fix it and then breaks
silently on the next upgrade, because the selectors match generated CSS-Module
hashes that change with the build. There is a 253-line example of this failure
mode in `tt-website-demo/styles/pushpin.scss`; don't add a second.

## Declaring what hand-rolled markup is

A React project on Thumbprint carries component identity already: `<Button
theme="primary">` says what it is, and nothing below applies to it.

Hand-rolled markup does not, and that matters at the push to Figma, where Code
Connect is missing and the component has to be inferred from the markup — see
[figma.md](figma.md). The ten components new in Pushpin have no React
implementation, so they are exactly the ones that get composed from primitives
and then guessed at.

Name them instead, using the exact catalog name and real variant options:

```html
<button data-pp-component="Button" data-pp-variant="theme=primary, size=medium">
```

When nothing published fits, say that, and say what it extends and why:

```html
<div data-pp-proposed="FilterChip" data-pp-extends="Chip" data-pp-tier="better-experience">
```

A project set up by `init` has the legal names and options listed in its
generated `DESIGN.md`, and `node scripts/lookup.mjs <name>` has them for
everything else. The declaration is a hint: one that does not resolve against
the catalog is discarded at push time rather than
trusted, so a typo costs the guess back and nothing more. `audit` reports both a
declaration that names nothing real and an element that reads as a published
component while declaring nothing at all.

## Reading a design with no Code Connect

Until Code Connect covers the Pushpin file (see [figma.md](figma.md)),
`get_design_context` returns CSS-Module class names rather than component names.
They follow `[Component]_[variant]__[hash]` and can be mapped back:

| Prefix | Component | Variants |
|---|---|---|
| `UIAction_` | `<Button>` / `<TextButton>` | `_themedButtonThemePrimary__`→`theme="primary"`, `…Secondary__`→`"secondary"`, `…Tertiary__`→`"tertiary"`, `…Caution__`→`"caution"`, `…Solid__`→`"solid"`, `_themedButtonWidthFull__`→`width="full"`, `_flexWrapperSizeSmall__`→`size="small"`, `_plainTheme*__`→`<TextButton theme="*">` |
| `Alert_` | `<BannerAlert>` / `<InPageAlert>` | `_good__`, `_bad__`, `_warning__`→`theme="…"`; `_banner__`→ use `BannerAlert` |
| `Avatar_` | `<UserAvatar>` / `<EntityAvatar>` | `_rootXsmall__` … `_rootXlarge__`→`size="…"` |
| `Pill_` | `<Pill>` | `_pillGreen__`, `_pillRed__`, `_pillIndigo__`, `_pillBlue__`, `_pillYellow__`, `_pillPurple__`→`color="…"` |
| `TextInput_` | `<TextInput>` | `_rootUiStateError__`→`hasError`, `…Disabled__`→`isDisabled`, `…Readonly__`→`isReadOnly`, `_inputSizeSmall__`→`size="small"` |
| `Dropdown_` | `<Dropdown>` | `_selectStateError__`→`hasError`, `…Disabled__`→`isDisabled`, `_selectSizeSmall__`→`size="small"`, `_rootWidthFull__`→`isFullWidth` |
| `LoaderDots_` | `<LoaderDots>` | `_dotThemeBrand__`, `…Inverse__`, `…Muted__`→`theme="…"`; `_dotSize*__`→`size="…"` |
| `StarRating_` | `<StarRating>` | `_small__`, `_medium__`, `_large__`→`size="…"` |
| `HorizontalRule_` | `<HorizontalRule>` | `_dotted__`, `_dashed__`→`lineStyle="…"` |
| `Tooltip_` | `<Tooltip>` | `_tooltipDark__` (default), `_tooltipLight__`→`theme="…"` |
| `Fab_` | `<TextFab>` / `<IconFab>` | `_primary__`, `_secondary__`→`theme="…"` |
| `FormNote_` | `<FormNote>` | `_rootError__`→`hasError` |
| `Label_` | `<Label>` | `_textUiStateDisabled__`→`isDisabled`, `…Error__`→`hasError` |

## Elements follow the design, not the interaction

Tappable is not the same as `<button>`. Wrapping a card in one changes its
semantics, its keyboard behavior, and how a screen reader announces it.

| Design element | Use | Not |
|---|---|---|
| Card, list row, nav tile | `<div onClick>` + `cursor: pointer` | `<button>` |
| Bottom nav tab | `<div onClick>` + active state | `<button>` |
| Explicit CTA / submit | `<Button>` or `<button>` | `<div>` |
| Text link | `<TextButton>` or `<a>` | `<button>` |

# The hard rules

Load this before writing UI on either surface. `SKILL.md` carries the five that
are violated most often; this is the whole set, with the reasoning that makes
each one decidable in a case it does not name.

In a project that has been through `init`, most of the token rules below are
also checked mechanically — `node scripts/check.mjs <path>` reports them, and
the hook `init` installs runs it on every edit. The rules that no allowlist can
express are the ones at the bottom, and those are still yours to hold.

## Geometry

- **Pill-first.** Buttons, inputs, chips, and search bars use
  `--pp-radius-sides`. Cards use `--pp-radius-large` (12px) or
  `--pp-radius-xlarge` (16px). No square corners on interactive elements, at any
  size. This is the most recognisable thing about Pushpin and it is not a
  preference.

## Color

- **The signature contrast.** The primary action is
  `--pp-background-brand-strong` (near-navy `#07344a`) with
  `--pp-text-on-brand-strong` (cyan `#7cdcfd`) as its label. Use it for the most
  important action on a screen. Using it for every action does not make a screen
  more branded, it makes the pair mean nothing.
- **Body text is `--pp-text-neutral-default`** (`#1f2022`), never pure black.
- **Don't introduce new colors.** Every value in the kit is a token. Reach for
  semantic tokens over base ramps; reaching for a base ramp means no semantic
  token fit, which is worth noticing rather than doing quietly.

## Type and copy

- **Sentence case** for headings, buttons, labels, and badges.
- **Mobile is the primary surface.** The type ramp ships mobile-first and scales
  up at 700px; design the small screen first.
- **No display size above `hero`, and no all-caps overline.** A comp that
  appears to need one is off-system — raise it rather than inventing a token.

## Icons

- **No emoji in product UI.** Use the icon set — 227 icons at four sizes, found
  with `node scripts/lookup.mjs --icon <name>`.
- **Never resize an icon.** Each size is its own component, drawn at that size.
  A Large scaled to 16 has the wrong stroke weight, and no screenshot will tell
  you.

## Components

- **In Figma, instance published components — or propose one. Never imitate.**
  Import the published component by key and instance it. A drawn pill that looks
  like a button is a defect, and it stays one no matter what is written beside
  it.

  Two cases justify a local component: nothing published expresses the
  interaction without lying about its API, or something could be stretched but a
  new component is clearly the better experience. Strict adherence to a young
  system is its own failure mode, which is why the second case exists. The gate,
  the derivation, the naming, and the annotation are in
  [propose.md](propose.md).

- **In code, say what hand-rolled markup stands in for.** `data-pp-component`
  when it stands in for something published, `data-pp-proposed` when it stands
  in for nothing. Code Connect is not wired for Pushpin, so a declaration is the
  only thing that tells a Figma push what a block of markup was meant to be. See
  [components.md](components.md).

## Degrading rather than failing

- **Nothing the design calls for is silently left out.** An asset the system
  cannot supply gets a marked placeholder and an open question, never an
  omission — and a child that could not be resolved never takes its parent with
  it.
- **A library out of reach degrades the run rather than ending it.** Only
  Pushpin itself is load-bearing enough to stop one. Unreachable icons become
  placeholders and an unreachable Annotation Kit means notes are drawn instead
  of instanced — both reported, never quietly substituted. Abandoning a screen
  over a library the design never needed is the worse answer.

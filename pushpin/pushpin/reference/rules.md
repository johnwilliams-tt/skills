# The hard rules

Load this before writing UI on either surface. `SKILL.md` carries the five that
are violated most often; this is the whole set, with the reasoning that makes
each one decidable in a case it does not name.

In a project that has been through `init`, most of the token and copy rules
below are also checked mechanically — `node scripts/check.mjs <path>` reports
them, and the hook `init` installs runs it on every edit. What no allowlist can
express is still yours to hold.

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

- **Sentence case** for headings, buttons, labels, and badges. Nine confirmed
  brand names are the only exception.
- **Mobile is the primary surface.** The type ramp ships mobile-first and scales
  up at 700px; design the small screen first.
- **No display size above `hero`, and no all-caps overline.** A comp that
  appears to need one is off-system — raise it rather than inventing a token.
- **A call to action names its action** — four words, verb plus object; a link
  gets eight and has to describe its destination. `Submit` and `Learn more` name
  nothing.
- **Use the product's own words.** `pro` and not `contractor`, `customer` and
  not `user`, `sign in` and not `log in`.
- **Active voice, and a failure that names the way out.** An error reporting
  what broke and stopping there leaves the reader where they were stuck, and
  blaming them for being there is forbidden outright.
- **Length belongs to the component,** so it is a design constraint rather than
  a preference about brevity. `node scripts/lookup.mjs Button` prints the limit
  above the property table.

The rest of the content design rules, what the engine decides mechanically and
what it leaves to you, and how to ask for a single row are in
[copy.md](copy.md).

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
  Pushpin itself is load-bearing enough to stop one, because everything the
  screen is built from is published there. An unreachable Annotation Kit means
  notes are drawn instead of instanced — reported, never quietly substituted.
  Abandoning a screen over a library the design never needed is the worse answer.
- **A claim that the Plugin API cannot do something is verified before it is
  made or acted on.** Ask the live API first — a probe on a node already in hand
  — then the `figma-use` prose references, then `plugin-api-standalone.d.ts`,
  then memory. The typings lag the API at its newest edge and memory lags both,
  so the two sources nearest to hand are the two most likely to agree with each
  other and be wrong together.
- **A claim that the system publishes no token or component for something is
  verified the same way.** Ask the catalogs — `node scripts/lookup.mjs <name>`
  answers in one call — then the reference docs, then memory. "Pushpin publishes
  no brand border token" is the sentence that preceded a hand-rolled button, and
  `border/neutral/default` and `link/brand/default` were both published and
  always had been. A gap that is real is a proposal; a gap that is assumed is an
  off-system element with a reason attached.
- **A design that gets simpler because of a believed API limit is a
  disclosure,** the same as snapped spacing or a corrected label. Being wrong
  about the API is only how it happens; silently shipping the lesser structure
  is the defect.

# Grounding in the page

A resolved link names a page, and that page is the context for the work. Sibling
frames are the same flow — evidence about layout, density, copy voice, and
naming that no general prior can supply. The rule binds whoever is holding the
pen, including any skill supplying craft floors or category defaults.

Three things govern it, and the rest of this page is how they get carried out:

- **Read the page, then offer to use it.** One read-only call returns the page's
  frames — names, types, and boxes — and it runs without asking, because an
  offer has to name what is on the page to be answerable. The yes governs
  whether the page shapes the work, not whether the call happens, and it holds
  for that page for the rest of the session.
- **Other pages are named, not read.** Another page holds superseded versions
  and parked ideas, and drifting into one is how a shelved idea gets rebuilt as
  a new one. Read one when the user asks for it or links into it.
- **What the page offers is advisory.** It never overrides a token, a published
  component, or the icon set — a page built entirely of raw hex licenses nothing
  — and it settles no question on its own. Name every intended departure in one
  question before anything is built.

## Finding the page

**Nothing is searched for.** No hunting for a Figma file, no
`search_design_system` to work out where the work should land, no subagent sent
looking. The destination is something the user has and you do not, so a search
spends minutes arriving at a guess where a question spends one click arriving at
a fact. What follows is how a page is reached from a link the user gave, not how
one is found.

A Figma frame URL carries a `node-id` for the frame and nothing about the page
it sits on, and `get_metadata` returns a subtree rather than a path, so the page
has to be walked to. One `use_figma` call does it, using the same loop the audit
in [generate.md](generate.md) already runs:

```js
const node = await figma.getNodeByIdAsync('1:2');

let page = node;
while (page && page.type !== 'PAGE') page = page.parent;

return {
  page: { id: page.id, name: page.name },
  siblings: page.children.map((n) => ({
    id: n.id, name: n.name, type: n.type,
    x: n.x, y: n.y, w: n.width, h: n.height,
  })),
};
```

Load the `figma-use` skill first, as every `use_figma` call requires.

When the page is already known — the link was page-level, or the file's page
list made it obvious — skip the script. `get_metadata` takes a page id directly
and returns the same ground in XML, with no prerequisite skill:

```
get_metadata(fileKey, nodeId: '0:1')
```

Called with no `nodeId` at all it returns the file's top-level pages, guid and
name. That call is how page *names* are known without reading any page's
contents, and it is what the finalize pass in [generate.md](generate.md) uses to
match the file's naming conventions.

## Reading the page off names and boxes

Names, types, and geometry carry more than they look like they do:

- **Widths name the surface.** 390 is a phone, 1440 a desktop. The linked
  frame's width settles which end of the type ramp applies before anyone asks.
- **A shared y band is a flow.** Frames at regular x intervals across one row
  read left to right and are almost always sequential. A cluster somewhere else
  on the canvas is a different topic, not the next step.
- **Suffixes are states.** `03 Payment — error`, `Results (empty)`,
  `Upload / loading`. A sibling whose name is the linked frame's plus a
  qualifier is the same screen in another state, and it is the single most
  useful thing on the page.
- **Numeric prefixes are an ordering the file already agreed on.** If siblings
  are `01`–`04`, a new step is named to match.
- **Some of it is stale, on this page too.** `v2`, `old`, `parked`, `archive`,
  a bracketed date months back. Same-page does not mean current, and the offer
  should say which frames look superseded rather than quietly averaging them
  into the pattern.

## The current selection

`get_metadata` prepends a `Currently selected nodes:` block, guid and name, when
the user has something selected in the Figma desktop app.

Use it to resolve, never to authorize. A file-level or page-level link plus a
selected frame is not genuinely ambiguous, so name the selection as the likely
target and confirm in the same breath as whatever else is being stated — rather
than asking which of eleven frames was meant. What it does not do is stand in
for a link: writes still require one, per
[generate.md](generate.md#where-the-work-gets-written). A selection can also be
minutes old and about something else entirely, so it is a hint that gets
confirmed, not a fact.

## Making the offer

Name what is actually on the page. The offer exists so the user can answer it
without opening Figma, which a generic "should I look around?" does not allow.

> This frame is on **Checkout**, with seven others: `01 Cart`, `02 Address`,
> `03 Payment`, `03 Payment — error`, `04 Confirm`, and two marked
> `Parked: express checkout` that look shelved. Ground the new step in the
> numbered flow, or build from the linked frame alone?

Reading a design into code, the useful thing to surface is states rather than
conventions:

> Alongside the frame you linked, the page has `Results (empty)`,
> `Results — error`, and `Results / loading`. Want the component built for all
> four, or just the one?

Skip the offer entirely when there is nothing to offer — the page holds the
linked frame alone, or the linked frame plus annotation furniture. Asking about
an empty page spends a turn on nothing.

The answer holds for that page for the rest of the session. A second request
against the same page does not get asked again; a different page does.

## How much to read once it is accepted

The page dump, plus `get_screenshot` on the two or three siblings that actually
bear on the work — the adjacent steps, the other states. Not the whole page. Those
screenshots go out as one call per sibling in a single message; no one of them
tells you anything about the next, so asking them in turn spends a round trip
apiece for one answer.

`get_design_context` is the expensive call and it is reserved for a frame the
work will mirror structurally. It is also the one to be careful with, because
what it returns is styling, and a neighbour's styling is not a source: tokens
and components both come from `lookup.mjs`. Read a sibling to learn how the
screen is composed, not what colour anything is.

## Declining another page

Say why, and say what it would take.

> `Explorations` and `Archive [Jun]` are also in this file. I have not read
> either — pages like those tend to hold superseded versions and parked ideas,
> and rebuilding one as if it were current is the failure worth avoiding. If
> one of them is the reference, link into it and I will.

That is the whole gate. The user asking for it, or linking into it, opens it.

## The departure question

A page pattern is something the comparable siblings mostly share. One frame
doing a thing is not a pattern, and treating it as one turns this into an
interrogation. If it would take an argument to establish that a pattern exists,
it does not.

Every intended departure is stated once before anything is written, in the
preamble of [the checkpoint](generate.md#the-checkpoint-is-one-call-with-two-questions).
Each one carries its reason — a list of differences with no reasoning is not
answerable either.

It is stated rather than asked as its own question, and the answer to the
checkpoint's destination question is what accepts it. That is the same bargain
this has always been: one turn, one answer, meaning go ahead as described or do
not. A departure the user will not have costs them a correction rather than a
second round trip, and the alternative was a checkpoint asking three things.

> Before I build: the page puts the primary action in a sticky bar and numbers
> each step in the header. I am planning neither. The action sits inline because
> this step's content is short enough not to scroll, and there is no counter
> because this screen is entered out of sequence. Proceed, or match the page?

A no means match the page. That is the point of asking, and Pushpin has no
opinion either way — sticky and inline are both built from the same Button.

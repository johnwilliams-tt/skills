# What is already answered before `/impeccable init`

`impeccable` writes `PRODUCT.md`, and Pushpin must not. That rule is in
[setup.md](setup.md), unchanged, and this page does not relitigate it. This page
is about the other half of the same interview: the questions init asks that a
Pushpin project has already answered. It asks them because on most projects they
are genuinely open. Here they are not, and a designer answering them from
scratch is how a two-day prototype acquires a framework, a build step, and a
deploy target nobody wanted.

The answers live here, on Pushpin's side, rather than as a patch to that skill's
own reference. An update to it cannot undo what it never held.

## Installing it

`npx impeccable install`, which needs Node 22.12 or newer, then `/impeccable
init` in the agent chat rather than the terminal — the interview is the point,
and it happens with the agent. `npx impeccable update` moves it forward later.

## The stack is static HTML/CSS

On a project with no framework or scaffold yet, which is most of them here, init
asks this one in as many words: whether the user wants plain static HTML/CSS, a
specific framework, or a recommendation, plus any deploy target that constrains
the answer. It records the outcome under `## Stack`.

**Answer it before it is asked, with `static HTML/CSS`.** `assets/pushpin.css`
is 300 custom properties with no dependencies and no build step, Pushpin's
preview is a static server with caching off, and `check.mjs` reads the file that
was just written. A framework buys nothing that any of that needs, and costs the
one thing a prototype is for — seeing the edit before you have looked away from
the browser.

Record the literal answer, not `delegated`. `delegated` is init's marker for a
choice that was offered and handed back, and it tells every later command the
question is still live — which is an invitation to reopen it three sessions in,
halfway through a flow.

## The platform is `web`

Recorded as a bare value under `## Platform`, and it is `web` unless the user
says otherwise. Mobile web is still `web`: a phone-shaped frame is a breakpoint,
not a platform. `ios`, `android`, and `adaptive` each load a native reference
that changes what every later command builds against, so that is a thing to be
wrong about deliberately rather than by inference from a narrow layout.

## Not a production surface

That phrase is not a string anywhere in impeccable. It is a framing the agent
invents at interview time, which is why what is written here is a ban on the
framing rather than an edit to a list of options.

It is wrong in both directions at once. Designers working through Pushpin are
not shipping the final code, so calling the artifact production sets a bar it was
never built to clear and invites a stack chosen to clear it. It is not a sketch
either — it becomes a Figma frame an engineer builds from, and that is the whole
reason the token discipline is not negotiable in a file nobody will ever deploy.

**Say what it is: a design prototype bound for a Figma frame that is ready for
engineering handoff.** Every question about scope, rigour, and what "done" means
answers itself from that sentence.

## The three product-truth questions are still asked

Who the primary user is and what job they are doing in what situation. What the
product makes possible, and the mechanism or position that makes it
meaningfully different. What durable facts, assets, evidence, and constraints
future work has to preserve.

**Those are asked, and they are not pre-answered here.** They are the reason
init exists. Pushpin knows the tokens and nothing about who the product is for,
and a plausible invented answer is worse than an empty file because everything
downstream treats it as given. Do not infer them from the repository, do not
offer to fill them in later, and do not skip the round because the pre-answers
above made the interview look shorter than it is.

## What comes back from it

Init closes by summarizing what it captured and recommending a next action.
Neither gets relayed. The summary reads product truth back at the person who
supplied it two turns ago, and the recommendation is not the step setup is on —
the next step is the handoff interview in [setup.md](setup.md). Carry on from
there.

One suggestion is refused outright rather than declined politely. `/impeccable
document` never runs on a Pushpin project, however it is arrived at — as a
closing recommendation here, or later as the named remedy for impeccable's own
drift finding, which is where it usually comes from and where it carries the
most authority. It replaces Pushpin with an invented visual world and every
check downstream keeps passing against it. [setup.md](setup.md) § The rule that
survives setup and [init.md](init.md) § The generated files both give the full
reason and what to run instead.

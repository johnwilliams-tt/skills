# Copy

Thumbtack's content design rules are vendored here the way the tokens are: a
verbatim capture of an upstream, a deterministic build, and one generated file
every consumer reads. [provenance.md](provenance.md) holds that chain. This page
is what the rules mean for the work.

**They apply by default and there is nothing to invoke.** Nobody opts into the
token scale before writing a color, and copy is the same kind of authority. A
screen can be on-system in every other respect — every instance resolved, every
gap bound, every icon at its own size — and still say something Thumbtack does
not say. That screen has not passed.

## Three ways copy is governed

They differ in when the rules land, and in what is left over afterwards.

**Writing it.** Copy is composed as the frame or the markup is composed, correct
the first time, the way a token is bound rather than a hex picked and corrected
later — [generate.md](generate.md#writing-the-copy). No score, no alternatives,
no annotation defending the choice.

**Receiving it.** Text arriving through the Figma bridge goes through the engine
before any markup is written, what breaks a rule is fixed in the markup that
gets written, and the change is disclosed in one line —
[figma.md](figma.md#copy-is-corrected-on-the-way-in). The disclosure is not a
courtesy. This plugin already refuses a silent correction for snapped spacing
and a silent substitution for an unreachable library, and copy rewritten with
nobody told is the same failure carrying somebody's words. The designer is the
one who can fine-tune the result, and they can only do that if they know it
moved.

**Being asked about it.** `audit`, pointed at pasted text, a file, or a frame —
[audit.md](audit.md). This one reports and changes nothing.

**There is no score and no rewrite block.** The upstream is a review skill: it
rates content 1-5 and answers with a rewritten version, and neither survives the
vendoring, because no lane here hands anyone a verdict. The number is the worse
of the two to have kept — it invites arguing with the number instead of fixing
the line — and the severity codes underneath it already carry the decision.
`critical` is do not ship, `major` is fix before handoff, `minor` is worth a
pass.

## The rules broken most often

- **Sentence case.** `Submit Request` is a form generator talking; `Send
  request` is a person. Nine confirmed brand names take title case — Thumbtack
  Guarantee, Money-Back Guarantee, Thumbtack Plus, Thumbtack Plus Guarantee, Top
  Pro, Instant Book, Thumbtack On Demand, Thumbtack Pay, Thumbtack Help — and
  everything else is a first word and its proper nouns.
- **A call to action names its action.** `Submit`, `Learn more`, `Get started`,
  `Proceed`. The failure is not that they are dull: it is that they are
  interchangeable, so a person scanning a screen learns nothing from any of them
  and has to read the paragraph above to find out what the button does. Four
  words, verb plus object. A link gets eight and has to describe where it goes,
  which is why `Here` and `See more` fail the same test twice over.
- **The terms are not synonyms.** `pro` and not `contractor`, `customer` and not
  `user`, `sign in` and not `log in`, `card` and not `payment method`. These are
  the words the product uses about itself, and a screen reaching for the
  near-miss reads as written by somebody describing Thumbtack from outside it.
- **Say who does what.** `Your booking has been confirmed` drops the one fact
  the reader wants, which is who confirmed it. `Dana confirmed your booking`
  costs the same space.
- **A failure names the way out of itself.** An error that reports what broke
  and stops there leaves the reader stuck on the screen they are already stuck
  on. Blame is worse and is forbidden outright: `You did not`, `You failed to`.
- **A promise is a claim someone will hold the company to.** `guaranteed`,
  `perfect match`, `we know exactly`, `you won't believe`. The forbidden list is
  short and none of it is a matter of taste, which is why a critical is the one
  finding that stops a frame handing over.
- **Length belongs to the component.** Four words on a button is not a
  preference about brevity, it is the width the component was drawn for, and
  copy that overflows it is a design defect that arrives looking like a content
  one.

That is the short list. The whole of it — 53 rows of length limits, preferred
terms, banned phrases, forbidden words, generic calls to action and generic link
text — lives in `assets/copy.json`, which is generated from the capture and
never hand-edited. **Ask for the row; never read the file.**

## Asking a rule

```bash
node scripts/lookup.mjs --copy pro            # the preferred term and what it replaces
node scripts/lookup.mjs --copy Toast          # the limit governing a component
node scripts/lookup.mjs --copy "click here"   # every list a phrase appears on
```

A phrase can be on several lists at once, and the answer says so rather than
picking one:

```
── copy rules — 1 of 53

click here — forbidden word (C3) · generic CTA (M3) · generic link (M3)
  as a CTA   Max 4 words, [verb] + [object], sentence case
  as a link  Max 8 words, must describe the destination specifically, sentence case
```

**Aliases are what make the rules reachable by the names people hold.**
`--copy Toast` answers the row the rules call `Notification`, and
`--copy contractor` answers the `pro` row — nobody looks up a word they already
know to avoid.

A plain component lookup carries the limit in its own entry, so the length
question is answered by the call that was going to be made anyway:

```
Button — component set · page "Button" · 1628 instances
  import key   ebc80753f095633977049c061a28a082816ef9c7
  node id      15239:14108
  copy limit   Button / CTA — 4 words · [verb] + [object], sentence case
```

A component under two rows gets an `also under` line beside the one that binds.
Form Note is a field error and it is helper text, and the second is a real
constraint rather than a footnote.

## What a length check can reach

Length checking from markup reaches eight components: Button, Icon Button, Link,
Themed Link, Loader Dots, TextInput, Text Area, and Modal / Confirmation. Each
has a limit on the whole of its text.

`Alert`, `Form Note`, `Modal / Default`, `Modal / Promotion`, `Toast`, and the
push notification have parts-only limits — a header allowance separate from a
body allowance — and markup cannot say which slot a given text node fills.
Declaring one of those yields no length finding, and the run says so:

```
Notification limits header, body separately and [Toast] names none of them, so length went unchecked. Say which — [Notification header] — or pass --part.
```

**Labelled input reaches those slots; markup does not.** `[Toast header]` or
`--component Toast --part header` measures what a `data-pp-component="Toast"`
declaration cannot.

Four rows have no Figma component at all: Header, Subheader, Body text, and
Empty state. The first three are roles on the type ramp rather than published
components, and an empty state is composed from an illustration, a heading, and
a button. **Their limits still apply** — a pasted `[Header]` over ten words is
reported like any other. The mapping records the absence rather than inventing a
component to hang the row on.

## Where the mechanical part ends

The engine decides seven of the rubric's sixteen codes. The other nine are
judgment, and they are left as judgment on purpose: whether a claim is
misleading, whether the most important thing leads the sentence, whether it
reads like a person wrote it. Guessing at one of those would make every other
finding less worth trusting.

One of the seven is narrower than it looks, and the narrowness is worth knowing
before reading a clean run as a clean draft. **Passive voice** catches the
fragments the rules name outright and the unambiguous "been" plus participle.
Anything wider needs to know what part of speech a word is, and a wrong finding
on "we are excited" costs more than the ones it would buy, so a passive sentence
built another way goes straight past.

**Title case** is narrow for a different reason: most of the proper nouns on a
Thumbtack screen are the name of a pro or a business, so a capital on its own
proves nothing. It counts only under a word the rules themselves write lowercase,
or on an article or pronoun no name would capitalise. A title-cased line built
entirely from words the rules never quote therefore goes past — `View Details`
and `Add Photos` come back clean. Naming the component narrows that gap without
closing it, because a row asking for `[verb] + [object]` has settled what the
first word is: `Edit Profile` is clean pasted on its own and a finding in a
declared Button. The gap runs the other way for a name carrying a preposition or
a pronoun in the middle, where `At Your Service Plumbing` is reported and should
not be.

The voice transforms split the same way. Eleven of the fourteen trade one phrase
for another, and every one of them stops the line, though not all under the same
code: eight sit on the banned-phrase list, `Has been confirmed` is one of the
named passive fragments, `The user` trips the term rule — which answers
`customer` where the transform says `you` — and `In the event that`, which no
other list reaches, is held as a banned phrase in its own right. The other three
are categories rather than phrases — corporate hedging into direct language, a
long wind-up into leading with the most important thing — and they sit in the
data as guidance no pattern can carry.

Those are the parts still read for by hand. The engine's job is not to replace
that; it is to make sure nothing mechanically decidable was left to attention.

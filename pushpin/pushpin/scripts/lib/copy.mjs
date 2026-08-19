/**
 * The copy rule engine — mechanical findings against the vendored content
 * design rules in assets/copy.json.
 *
 * One implementation because there are several callers and they must not
 * disagree: check.mjs reports on code as it is edited, scripts/copy.mjs runs
 * over text that is not in a file yet, and the Figma audit walks the text nodes
 * on a frame. A second opinion about whether "Submit" is a generic CTA would be
 * a second chance to be wrong.
 *
 * Patterns are compiled once, at module load, into one alternation per rule.
 * The edit hook runs its caller on a 10-second budget while also awaiting a
 * preview probe, so a regex built per finding is a real cost rather than a
 * theoretical one.
 *
 * What the engine will not do is judge. The rubric has codes for buried
 * information (M5), corporate tone (M6) and awkward phrasing (N1); nothing here
 * can decide those, and guessing would make every other finding less worth
 * trusting. MECHANICAL is the honest subset, and a caller can narrow it
 * further.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** The whole rule set, for callers that answer questions rather than scan. */
export const COPY = JSON.parse(readFileSync(join(here, '..', '..', 'assets', 'copy.json'), 'utf8'));

/** The codes the engine can decide without a human. */
export const MECHANICAL = Object.freeze(['C3', 'M1', 'M2', 'M3', 'M4', 'M7', 'M8']);

for (const code of MECHANICAL) {
  if (!COPY.codes[code]) {
    throw new Error(`copy.json has no ${code}. The upstream rubric has changed shape.`);
  }
}

export const severityOf = (code) => COPY.codes[code]?.tier ?? null;

const RANK = { critical: 3, major: 2, minor: 1, excellence: 0 };

// ---------------------------------------------------------------- patterns

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One alternation per rule. Longest first, so a phrase wins over an entry that
 * is a prefix of it, and lookarounds rather than \b because several entries end
 * in punctuation — "try again later!" has no word boundary after the bang.
 */
function phrases(items, { plural = false } = {}) {
  const body = [...items]
    .sort((a, b) => b.length - a.length)
    .map((p) => escape(p) + (plural ? 's?' : ''))
    .join('|');
  return new RegExp(`(?<![\\w-])(?:${body})(?![\\w-])`, 'gi');
}

const FORBIDDEN = phrases(COPY.forbidden);
const CTA = phrases(COPY.genericCtas);
const LINK_TEXT = phrases(COPY.genericLinks);
const BRAND = phrases(COPY.brandTitleCase);
const PASSIVE = phrases(COPY.passive);

/**
 * The one passive construction worth recognising structurally. "Been" plus a
 * participle is unambiguously passive; everything wider needs to know what part
 * of speech a word is, and a wrong M2 on "we are excited" costs more than the
 * findings it would buy.
 */
const BEEN = /(?<![\w-])(?:has|have|had|is|are|was|were)\s+been\s+[a-z]+(?:ed|en)(?![\w-])/gi;

const WRONG_TERM = new Map();
for (const term of COPY.terms) {
  for (const wrong of term.insteadOf) WRONG_TERM.set(wrong.toLowerCase(), term);
}
const TERMS = phrases([...WRONG_TERM.keys()], { plural: true });

/** Every rule that already speaks for itself, for asking whether one more does. */
const STATED = [FORBIDDEN, phrases(COPY.bannedPhrases.map((b) => b.phrase)), PASSIVE, BEEN, TERMS];
const spokenFor = (phrase) => STATED.some((re) => phrase.match(re) !== null);

/**
 * What M4 matches: the banned list, and the voice transforms nothing else says.
 *
 * The upstream states most of its transforms twice — as a transform and again
 * as a banned phrase, a passive construction or a wrong term — and states "In
 * the event that" once, which left it written down and enforced nowhere. Asking
 * each transform whether another rule already reaches it keeps that one and
 * drops the rest, and answers the same question for the twelfth transform
 * without being told about it.
 */
const BANNED_ENTRIES = [
  ...COPY.bannedPhrases,
  ...COPY.transforms
    .filter((t) => t.from && !spokenFor(t.from))
    .map((t) => ({ phrase: t.from, fix: t.literal ? t.to : t.raw, literal: t.literal })),
];
const BANNED = phrases(BANNED_ENTRIES.map((b) => b.phrase));
const BANNED_BY = new Map(BANNED_ENTRIES.map((b) => [b.phrase.toLowerCase(), b]));

/** Words a title-cased line leaves lowercase anyway, so they prove nothing. */
const MINOR_WORDS = new Set(
  'a an and as at but by for from in nor of on or per the to vs with'.split(' '),
);

/**
 * First and second person, every form a product surface uses.
 *
 * Written here for the same reason MINOR_WORDS is: the closed classes of
 * English are grammar, not something Thumbtack decided, and the code that
 * reasons about capitals is where they belong. Reading them out of the voice
 * rules instead would make the set an artifact of which four the upstream
 * happened to put in quotation marks.
 */
const PRONOUNS = new Set(
  'i me my mine myself we us our ours ourselves you your yours yourself yourselves'.split(' '),
);

/** One word, for the rules that weigh capitals rather than match a phrase. */
const WORD = /[A-Za-z][A-Za-z'’-]*/g;

/** Every word a brand name is built from, whatever else that word also means. */
const BRAND_WORDS = new Set(
  COPY.brandTitleCase.flatMap((name) => name.toLowerCase().match(WORD) ?? []),
);

/**
 * Words the rules' own copy writes in lowercase.
 *
 * A capital says nothing on its own — a good share of the nouns on a Thumbtack
 * screen are the name of a pro or a business — so it is worth something only
 * when the word under it is one the rules have been seen writing lowercase.
 * Taken from the rules rather than a dictionary, because a dictionary cannot
 * say which words this brand treats as names: "pro" is an ordinary noun that
 * Thumbtack capitalises in "Top Pro", so it proves nothing and comes out, along
 * with every other word a brand name is spelled with.
 */
const LOWERCASE_WORDS = new Set();
for (const quoted of [
  ...COPY.forbidden,
  ...COPY.bannedPhrases.flatMap((b) => [b.phrase, b.literal ? b.fix : null]),
  ...COPY.transforms.flatMap((t) => [t.from, t.to]),
  ...COPY.genericCtas,
  ...COPY.genericLinks,
  ...COPY.passive,
  ...COPY.terms.flatMap((t) => [t.prefer, ...t.insteadOf, t.usage]),
  // The rewrite, never the draft it replaced: the pair "the settings page" →
  // "**Settings**" is the rules stating that one of them is a UI element name.
  ...COPY.examples.map((e) => e.after),
]) {
  for (const w of String(quoted ?? '').match(WORD) ?? []) {
    if (w !== w.toLowerCase()) continue;
    if (BRAND_WORDS.has(w) || BRAND_WORDS.has(w.replace(/s$/, ''))) continue;
    LOWERCASE_WORDS.add(w);
  }
}

const writtenLowercase = (word) => {
  const w = word.toLowerCase();
  return LOWERCASE_WORDS.has(w) || LOWERCASE_WORDS.has(w.replace(/s$/, ''));
};

/**
 * The words a line of Thumbtack copy opens with.
 *
 * Every complete line the rules quote, which is the CTA labels and the rewrite
 * side of the examples — not the replacement fragments under bannedPhrases,
 * which are substitutions into the middle of a sentence and say nothing about
 * how a line starts.
 */
const OPENERS = new Set();
for (const label of [...COPY.genericCtas, ...COPY.genericLinks]) {
  OPENERS.add(label.match(WORD)[0].toLowerCase());
}
for (const rewrite of COPY.examples.map((e) => e.after)) {
  for (const m of rewrite.matchAll(/(?:^|[.!?]\s+)([A-Za-z][A-Za-z'’-]*)/g)) {
    OPENERS.add(m[1].toLowerCase());
  }
}

/**
 * The rows whose stated format makes the first word a verb.
 *
 * A slot that says "[verb] + [object]" has settled by declaration what OPENERS
 * can only recognise, and a caller holding one is telling us the line is an
 * instruction. It says nothing about the object, which is why this only lifts
 * the opener test and not the rest: "Message Dana" is a button label.
 *
 * Link is deliberately not among them. Its format asks the text to describe
 * where the link goes, and the name of a pro describes their profile exactly,
 * so link text is somewhere a name belongs.
 */
const VERB_SLOTS = new Set(
  Object.entries(COPY.limits)
    .filter(([, row]) => /\[verb\]/.test(row.format ?? ''))
    .map(([name]) => name),
);

// -------------------------------------------------------------- measuring

const strip = (s) => s.replace(/\*\*/g, '');
const words = (s) => strip(s).trim().split(/\s+/).filter(Boolean);
const lines = (s) => s.split('\n').filter((l) => l.trim());

/** Sentences, kept with their offsets so a long one can be pointed at. */
function sentences(s) {
  const out = [];
  for (const m of s.matchAll(/[^.!?]+[.!?]*/g)) {
    if (m[0].trim()) out.push({ text: m[0].trim(), index: m.index + (m[0].length - m[0].trimStart().length) });
  }
  return out;
}

/**
 * Which limit governs a component.
 *
 * `component` is a name from the Figma catalog; `generic` is a row of the
 * upstream's own table, which is what a caller holding a Figma text node
 * labelled "[Header]" has instead. A component listed under more than one row —
 * Form Note is both a field error and helper text — answers with the first,
 * which is the order copy-map.json states.
 */
export function limitFor(component, generic = null) {
  const name = generic ?? genericsFor(component)[0] ?? null;
  if (!name || !COPY.limits[name]) return null;
  return { name, ...COPY.limits[name] };
}

/** Every upstream row a catalog component falls under, most specific first. */
export function genericsFor(component) {
  if (!component) return [];
  if (COPY.components[component]) return COPY.components[component];
  return COPY.limits[component] ? [component] : [];
}

// ------------------------------------------------------------------- scan

/**
 * Findings in `text`.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.component]  a catalog component name, which turns M7 on
 * @param {string} [options.generic]    an upstream row name, when the caller knows it
 * @param {string} [options.part]       header | body | cta, for limits that name slots
 * @param {string[]} [options.codes]    a subset of MECHANICAL
 * @returns {Array<{code, severity, rule, message, match, index, line, column, fix}>}
 *   `match` is the offending span, or null for a length finding, which is a
 *   property of the whole text rather than of one place in it.
 */
export function scan(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const codes = new Set(options.codes ?? MECHANICAL);
  const limit = limitFor(options.component, options.generic);
  const spans = new Map();
  const whole = [];

  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const place = (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: index - starts[lo] + 1 };
  };

  const add = (code, rule, index, match, message, fix = null) => {
    const finding = {
      code,
      severity: COPY.codes[code].tier,
      rule,
      message,
      match,
      index,
      ...place(index),
      fix,
    };
    if (match === null) {
      whole.push(finding);
      return;
    }
    // Two rules can be right about the same span — "click here" is both
    // forbidden and a generic CTA — and reporting it twice makes the more
    // serious of the two easier to miss.
    const k = `${index}:${match.length}`;
    const prior = spans.get(k);
    if (!prior || RANK[finding.severity] > RANK[prior.severity]) spans.set(k, finding);
  };

  if (codes.has('C3')) {
    for (const m of text.matchAll(FORBIDDEN)) {
      add('C3', 'forbidden-word', m.index, m[0], `"${m[0]}" is on the forbidden list`);
    }
  }

  if (codes.has('M4')) {
    for (const m of text.matchAll(BANNED)) {
      const entry = BANNED_BY.get(m[0].toLowerCase());
      const advice = !entry?.fix ? 'rewrite it' : entry.literal ? `use "${entry.fix}"` : entry.fix;
      add('M4', 'banned-phrase', m.index, m[0], `banned phrase "${m[0]}" — ${advice}`, entry?.fix ?? null);
    }
  }

  if (codes.has('M8')) {
    for (const m of text.matchAll(TERMS)) {
      const key = m[0].toLowerCase();
      const term = WRONG_TERM.get(key) ?? WRONG_TERM.get(key.replace(/s$/, ''));
      if (term) {
        add('M8', 'wrong-term', m.index, m[0], `"${m[0]}" — Thumbtack says "${term.prefer}"`, term.prefer);
      }
    }
  }

  if (codes.has('M2')) {
    for (const re of [PASSIVE, BEEN]) {
      for (const m of text.matchAll(re)) {
        add('M2', 'passive-voice', m.index, m[0], `"${m[0]}" is passive — say who does what`);
      }
    }
  }

  if (codes.has('M3') || codes.has('M1')) {
    // A CTA surface is scanned whatever it looks like; anywhere else, only a
    // line that reads as a label, or "learn more about pros" in the middle of a
    // paragraph becomes a button finding.
    const ctaSurface = limit?.name === 'Button / CTA' || limit?.name === 'Link';
    const generic = limit?.name === 'Link' ? LINK_TEXT : CTA;

    // What the caller knows about the slot, which is more than the words can
    // say: a row stating [verb] + [object], or a modal naming its cta.
    const declaredVerb =
      VERB_SLOTS.has(limit?.name) || (options.part === 'cta' && Boolean(limit?.parts?.cta));

    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const line = text.slice(start, i + 1 < starts.length ? starts[i + 1] - 1 : text.length);
      if (!line.trim()) continue;

      if (codes.has('M3') && (ctaSurface || isLabel(line))) {
        for (const m of line.matchAll(generic)) {
          add('M3', 'generic-cta', start + m.index, m[0], `"${m[0]}" is a generic call to action — name the action`);
        }
      }

      if (codes.has('M1')) {
        const offenders = titleCased(line, declaredVerb);
        if (offenders.length) {
          const named = offenders.map((o) => `"${o.word}"`).join(', ');
          add(
            'M1',
            'title-case',
            start + offenders[0].index,
            offenders[0].word,
            `title case on ${named} — sentence case unless it is a confirmed brand name`,
          );
        }
      }
    }
  }

  if (codes.has('M7') && limit) {
    const spec = options.part ? limit.parts?.[options.part] : limit.limit;
    const label = [limit.name, options.part].filter(Boolean).join(' ');
    for (const f of overLength(text, spec, label)) {
      add('M7', 'over-length', f.index, f.match, f.message);
    }
  }

  return [...spans.values(), ...whole].sort(
    (a, b) => a.index - b.index || a.code.localeCompare(b.code),
  );
}

/** A line that could be a button, a heading or a link rather than prose. */
function isLabel(line) {
  const t = line.trim();
  return t.length > 0 && !/[.!?]$/.test(t) && words(t).length <= 8;
}

/**
 * Non-brand words carrying a capital in a line that reads as title case.
 *
 * The shape of the line is necessary and is not enough on its own. Most of the
 * words capitalised rather than one of them says the line could be a style, and
 * nothing more: "Submit Request", "Track Dana" and "Best Cleaning Service" are
 * one shape, and two of the three are names. Names are most of what a frame
 * holds — the audit reads every text node on a search screen, which is a column
 * of businesses — so the line also has to carry a capital a name cannot
 * account for.
 *
 * A capital on a closed-class word is that on its own: title case capitalises
 * the minor words a sentence leaves alone, and first and second person are the
 * same kind of evidence, since a name is not addressing anyone. A shopfront
 * that does — "At Your Service Plumbing", "All About You Cleaning" — is the
 * standing hole in that, and it is narrow enough to be worth the rest.
 *
 * A capital on an ordinary word is not, because ordinary words are what a
 * business is named after and the rules quote "area", "home" and "service"
 * lowercase like any others. It counts on a line that opens the way the rules'
 * own copy opens, which is the difference left between "Submit Request" and
 * "Best Cleaning Service": one is an instruction and the other is a noun
 * phrase, and the verb is at the front where it can be checked.
 *
 * A caller that knows the slot can answer the opening instead of the opener
 * list — a row stating [verb] + [object] has said the first word is a verb. It
 * has said nothing about the object, and the object of half the buttons on this
 * platform is somebody's name, so a declared slot pays for the front by reading
 * the back in full: every capital in it has to be a word the rules write
 * lowercase, where an undeclared line needs one. "Edit Profile" on a button is
 * a finding; "Message Dana" and "Call Bay Area Movers" on the same button are
 * not.
 *
 * What that gives up is an instruction on an undeclared surface opening on a
 * verb the rules never quote — "Edit Profile" pasted with no slot — a declared
 * one whose object is half accounted for, like "Cancel My Booking", and any
 * violation built from words the rules never quote at all. A missed finding is
 * caught in review; a wrong one teaches the reader to skip the rule.
 */
function titleCased(line, declaredVerb = false) {
  const masked = line.replace(BRAND, (m) => ' '.repeat(m.length));
  const tokens = [...masked.matchAll(WORD)];
  const content = tokens.filter((t) => !MINOR_WORDS.has(t[0].toLowerCase()));
  if (content.length < 2) return [];

  const inside = [];
  for (let i = 1; i < tokens.length; i++) {
    // A capital after a full stop is a sentence starting, not a style.
    const between = masked.slice(tokens[i - 1].index + tokens[i - 1][0].length, tokens[i].index);
    if (/[.!?\n]/.test(between)) continue;
    inside.push(tokens[i]);
  }

  const candidates = inside.filter((t) => !MINOR_WORDS.has(t[0].toLowerCase()));
  if (!candidates.length) return [];

  // One letter is a capital — the article in the middle of "Book A Pro" is the
  // whole of that finding — but two in a row is an acronym rather than a style.
  const isCapital = (t) => /^[A-Z](?![A-Z])/.test(t[0]);
  const capitalised = candidates.filter(isCapital);
  if (!capitalised.length || capitalised.length / candidates.length < 0.6) return [];

  const closedClass = (t) => {
    const w = t[0].toLowerCase();
    return MINOR_WORDS.has(w) || PRONOUNS.has(w);
  };
  const accounted = capitalised.filter((t) => writtenLowercase(t[0]));
  const proven =
    inside.some((t) => isCapital(t) && closedClass(t)) ||
    (OPENERS.has(tokens[0][0].toLowerCase()) && accounted.length > 0) ||
    (declaredVerb && accounted.length === capitalised.length);
  if (!proven) return [];

  return capitalised.map((t) => ({ word: t[0], index: t.index }));
}

/** Every way `text` breaks `spec`, phrased so the number is the first thing read. */
function overLength(text, spec, label) {
  if (!spec) return [];
  const out = [];
  const say = (message, index = 0, match = null) => out.push({ message, index, match });

  const w = words(text);
  if (spec.maxWords !== undefined && w.length > spec.maxWords) {
    say(`${label} is ${w.length} words; the limit is ${spec.maxWords}`);
  }
  if (spec.minWords !== undefined && w.length < spec.minWords) {
    say(`${label} is ${w.length} word${w.length === 1 ? '' : 's'}; ${spec.minWords}–${spec.maxWords} is the range`);
  }

  const chars = strip(text).trim().length;
  if (spec.maxChars !== undefined && chars > spec.maxChars) {
    say(`${label} is ${chars} characters; the limit is ${spec.maxChars}`);
  }

  const s = sentences(text);
  if (spec.maxSentences !== undefined && s.length > spec.maxSentences) {
    say(`${label} is ${s.length} sentences; the limit is ${spec.maxSentences}`);
  }
  if (spec.minSentences !== undefined && s.length < spec.minSentences) {
    say(`${label} is ${s.length} sentence${s.length === 1 ? '' : 's'}; ${spec.minSentences}–${spec.maxSentences} is the range`);
  }
  if (spec.maxWordsPerSentence !== undefined) {
    for (const one of s) {
      const n = words(one.text).length;
      if (n > spec.maxWordsPerSentence) {
        say(`a sentence runs ${n} words; the limit is ${spec.maxWordsPerSentence}`, one.index, one.text);
      }
    }
  }

  const l = lines(text);
  if (spec.maxLines !== undefined && l.length > spec.maxLines) {
    say(`${label} is ${l.length} lines; the limit is ${spec.maxLines}`);
  }
  return out;
}

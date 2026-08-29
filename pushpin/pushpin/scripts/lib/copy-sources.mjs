/**
 * Where the copy rules come from, and how each upstream shape is read.
 *
 * The rules are Thumbtack's, but the file holding them is not ours: today they
 * live in a Claude skill in Jody Allard's repo, and Content Design may well
 * move them into the Thumbprint guide pages later. So the upstream is named
 * once — `SOURCE` — and read through a parser keyed by `kind`. A swap is a
 * descriptor edit plus one adapter that emits the same schema; every consumer
 * reads assets/copy.json and never learns which format it came from.
 *
 * An adapter takes the verbatim capture and returns the rule data. It does not
 * produce the `source` block or the component join — build-copy.mjs adds both,
 * because neither can be read out of any upstream. Anything an adapter cannot
 * express honestly it leaves out rather than approximating: the engine acts on
 * these without a human in the loop, so an invented rule is worse than a
 * missing one.
 *
 * The parser refuses a section it does not recognise. Upstream is a document
 * someone edits by hand, and a new section that parses to nothing is a rule
 * that quietly stopped applying.
 */

/** The upstream in force. Swapping it is an edit here plus one adapter. */
export const SOURCE = {
  kind: 'skill-md',
  repo: 'jallard-code/content-design-assistant',
  path: 'content-design-assistant.md',
  ref: 'main',
};

/**
 * Read and deliberately not carried.
 *
 * The upstream is a review skill, and its response format is a rewrite block
 * wrapped in `---REWRITE---` delimiters with a scored audit either side of it.
 * The delimiters and the two-score shape do not come across: Pushpin's report
 * lane names one score for the copy in front of it and puts its suggestions in
 * a table rather than a block a reader has to diff by eye.
 *
 * The score ladder underneath that format does come across, because it is a
 * rule rather than a presentation choice — see `scoreLadder`.
 */
const DROPPED = new Set(['HOW TO RESPOND']);

/** Headings carry a parenthetical or a subtitle; the first phrase is the key. */
const key = (heading) => heading.split(/\s+[—(]/)[0].trim();

const sections = (text, marker) => {
  const out = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith(marker + ' ')) {
      current = { heading: line.slice(marker.length + 1).trim(), lines: [] };
      out.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  // Sections are separated by a horizontal rule, which belongs to neither of
  // the two it sits between.
  return out.map((s) => ({
    heading: s.heading,
    body: s.lines.join('\n').trim().replace(/\n-{3,}$/, '').trim(),
  }));
};

const bullets = (body) =>
  body
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());

const quoted = (s) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

/** Merge two spellings of the same list, keeping the first one seen. */
function union(...lists) {
  const out = [];
  const seen = new Set();
  for (const item of lists.flat()) {
    const k = item.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

const tableRows = (body) =>
  body
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .slice(2);

// ------------------------------------------------------------ length parsing

/**
 * One clause of a Max length cell. Ranges give a minimum as well as a maximum,
 * because "2–6 words" on a loader means a one-word loader is wrong too.
 */
function measure(clause) {
  const per = clause.match(/^(\d+)\s+words?\s+max\s+per\s+sentence$/i);
  if (per) return { maxWordsPerSentence: Number(per[1]) };

  const m = clause.match(/^(?:≤|max\s+)?(\d+)(?:\s*[–-]\s*(\d+))?\s*(word|char|sentence|line)s?\b/i);
  if (!m) return null;
  const unit = { word: 'Words', char: 'Chars', sentence: 'Sentences', line: 'Lines' }[
    m[3].toLowerCase()
  ];
  const out = {};
  if (m[2]) out[`min${unit}`] = Number(m[1]);
  out[`max${unit}`] = Number(m[2] ?? m[1]);
  return out;
}

/**
 * A Max length cell, which is either one measure for the component's own text
 * or a set of measures naming slots inside it ("Header ≤8 words, body ≤3
 * sentences"). Both shapes are emitted so a consumer can tell them apart
 * without re-reading the prose: `limit` governs the whole, `parts` governs by
 * slot, and exactly one of the two is non-null.
 *
 * `raw` is kept because no field set holds everything the cell says — "1–3
 * sentences per paragraph" scopes its count to a paragraph, and the numbers
 * alone lose that.
 */
function lengths(raw) {
  const limit = {};
  const parts = {};
  for (const clause of raw.split(/,\s*/)) {
    const slot = clause.match(/^(Header|body|CTA)\s+(.+)$/);
    const parsed = measure(slot ? slot[2] : clause);
    if (!parsed) throw new Error(`Unreadable length clause "${clause}" in "${raw}"`);
    Object.assign(slot ? (parts[slot[1].toLowerCase()] ??= {}) : limit, parsed);
  }
  return {
    raw,
    limit: Object.keys(limit).length ? limit : null,
    parts: Object.keys(parts).length ? parts : null,
  };
}

// --------------------------------------------------------------- skill-md

/**
 * One transform bullet, or null when the left side is a category rather than a
 * phrase — "Passive voice → active voice" names no text to look for. `to` is
 * the quoted replacement where there is one and `raw` is the whole right side,
 * which is the only field that holds "cut entirely" or the caveat on "you".
 */
function transform(bullet) {
  const [left, ...rest] = bullet.split('→');
  const right = rest.join('→').trim();
  const from = quoted(left)[0];
  if (!from) return null;
  const to = quoted(right)[0] ?? null;
  return { from, to, literal: to !== null, raw: right };
}

function scoring(body) {
  const codes = {};
  let tier = null;
  for (const line of body.split('\n')) {
    if (line.startsWith('**')) {
      const label = line.match(/^\*\*(CRITICAL|MAJOR|MINOR|EXCELLENCE)\b/);
      tier = label ? label[1].toLowerCase() : null;
      continue;
    }
    const m = tier && line.match(/^- ([CMNP]\d+): (.+)$/);
    if (m) codes[m[1]] = { tier, description: m[2].trim() };
  }
  if (!Object.keys(codes).length) throw new Error('No severity codes found in SCORING');
  return codes;
}

/**
 * The rungs of the 1-5 ladder, as conditions rather than as English.
 *
 * Carried where the response format around it is not, because the two are
 * different kinds of thing. A rewrite block is how the upstream chose to answer;
 * a critical costing every point on the scale is a judgment about severity, the
 * same judgment the codes themselves encode, and re-deciding it here would put
 * Pushpin's number and Content Design's number at odds over the same copy.
 *
 * Every rung has to parse. Hardcoding the ladder in the engine would let an
 * upstream edit to it pass silently, which is the failure this whole adapter
 * exists to prevent — so an unrecognised rung is a build failure, and the
 * engine reads what comes out of here rather than a copy of it.
 */
function scoreLadder(body) {
  const line = body.split('\n');
  const at = line.findIndex((l) => /^\*\*Score formula:?\*\*/i.test(l.trim()));
  if (at < 0) throw new Error('No score formula in SCORING');

  const ladder = [];
  for (const raw of line.slice(at + 1)) {
    const text = raw.trim();
    if (!text) continue;
    if (!text.startsWith('- ')) break;

    const [, condition, score] = text.match(/^-\s*(.+?)\s*=\s*(\d)\s*$/) ?? [];
    if (!condition) throw new Error(`Cannot read a score rung: ${text}`);

    // Ranges are written with an en dash upstream; tiers are named in the
    // plural. Both are the document's habits rather than anything meaningful.
    const c = condition.toLowerCase().replace(/[–—]/g, '-');
    const tier = c.match(/\b(critical|major|minor)s?\b/)?.[1] ?? null;
    const span = c.match(/(\d+)\s*-\s*(\d+)/);
    const from = c.match(/(\d+)\s*\+/);
    const code = condition.match(/\b([CMNP]\d+)\b/)?.[1] ?? null;

    let when;
    if (code) when = { code };
    else if (/\bno issues\b/.test(c)) when = { clean: true };
    else if (tier && span) when = { tier, min: Number(span[1]), max: Number(span[2]) };
    else if (tier && from) when = { tier, min: Number(from[1]) };
    else if (tier && /\bonly\b/.test(c)) when = { tier, only: true };
    else if (tier && /\bany\b/.test(c)) when = { tier, min: 1 };
    else throw new Error(`Cannot read a score rung: ${text}`);

    ladder.push({ raw: condition, score: Number(score), when });
  }

  if (!ladder.length) throw new Error('The score formula in SCORING has no rungs');
  return ladder;
}

function styleRules(body) {
  const out = {
    style: { maxSentenceWords: null, readingLevel: null, capitalization: [], ctas: [], links: [], voice: [] },
    tone: { levels: [], rules: [] },
    brandTitleCase: [],
    genericCtas: [],
    genericLinks: [],
    terms: [],
    forbidden: [],
  };

  for (const { heading, body: sub } of sections(body, '###')) {
    const lines = bullets(sub);
    switch (key(heading)) {
      case 'Capitalization': {
        out.style.capitalization = lines;
        const brands = lines.find((l) => l.startsWith('Confirmed brand names'));
        out.brandTitleCase = brands ? list(brands.split(':')[1]) : [];
        break;
      }
      case 'CTAs and buttons':
        out.style.ctas = lines;
        out.genericCtas = quoted(lines.find((l) => l.startsWith('Never use')) ?? '');
        break;
      case 'Links':
        out.style.links = lines;
        out.genericLinks = quoted(lines.find((l) => l.startsWith('Never use')) ?? '');
        break;
      case 'Voice and language': {
        out.style.voice = lines;
        const sentence = sub.match(/sentences max (\d+) words/i);
        const reading = sub.match(/(\d+)\w{2}-grade reading level/i);
        out.style.maxSentenceWords = sentence ? Number(sentence[1]) : null;
        out.style.readingLevel = reading ? Number(reading[1]) : null;
        break;
      }
      case 'Preferred terms':
        for (const line of lines) {
          const not = line.match(/^"([^"]+)"\s+not\s+(.+)$/);
          if (not) {
            out.terms.push({ prefer: not[1], insteadOf: quoted(not[2]), usage: null });
            continue;
          }
          const use = line.match(/^"([^"]+)"\s+for\s+(.+)$/);
          if (use) out.terms.push({ prefer: use[1], insteadOf: [], usage: use[2] });
        }
        break;
      case 'Forbidden words and phrases':
        // One comma-separated line rather than a bullet list, and some entries
        // carry their own punctuation ("try again later!") or an internal
        // conjunction ("ladies and gentlemen"), so the split is on commas alone
        // and the items are taken as written.
        out.forbidden = list(sub.split('\n').find((l) => l.trim()) ?? '');
        break;
      case 'Tone':
        for (const line of lines) {
          const level = line.match(/^(Low|Medium|High)\s+\(([^)]+)\):\s*(.+)$/);
          if (level) out.tone.levels.push({ level: level[1], character: level[2], surfaces: list(level[3]) });
          else out.tone.rules.push(line);
        }
        break;
      default:
        throw new Error(`Unrecognised style subsection: ${heading}`);
    }
  }
  return out;
}

function emailRules(body) {
  const [head, order = ''] = body.split('**Email and GTM review order:**');
  const structure = head.match(/^Structure:\s*(.+)$/m);
  const rules = bullets(head);

  const limits = {};
  for (const rule of rules) {
    const slot = rule.match(/^(Subject|Preheader|Header|Body|Primary CTA|Secondary CTA):\s*(.+)$/);
    if (!slot) continue;
    const spec = {};
    const chars = slot[2].match(/(?:max\s+|≤)(\d+)\s*chars/i);
    const words = slot[2].match(/(?:max\s+|≤)(\d+)\s*words/i);
    if (chars) spec.maxChars = Number(chars[1]);
    if (words) spec.maxWords = Number(words[1]);
    if (Object.keys(spec).length) limits[slot[1].toLowerCase().replace(/\s+/g, '-')] = spec;
  }

  const reviewOrder = [];
  for (const line of order.split('\n')) {
    const step = line.match(/^\d+\.\s+(.+)$/);
    if (step) reviewOrder.push({ step: step[1].trim(), detail: [] });
    else if (line.trim().startsWith('- ') && reviewOrder.length) {
      reviewOrder.at(-1).detail.push(line.trim().slice(2).trim());
    }
  }

  return {
    structure: structure ? structure[1].split('→').map((s) => s.trim()) : [],
    limits,
    rules,
    reviewOrder,
  };
}

function valueProps(body) {
  const pillars = [];
  for (const line of body.split('\n')) {
    const head = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s+—\s+(.+)$/);
    if (head) {
      pillars.push({ name: head[1], proofPoints: list(head[2]), useAt: null, emotions: [] });
      continue;
    }
    const detail = line.trim().match(/^-\s+(Use at|Emotions):\s*(.+)$/);
    if (!detail || !pillars.length) continue;
    if (detail[1] === 'Use at') pillars.at(-1).useAt = detail[2].trim();
    else pillars.at(-1).emotions = list(detail[2]);
  }
  const ground = body.split('\n').find((l) => l.startsWith('Ground claims'));
  return { pillars, evidence: ground ? quoted(ground) : [] };
}

/**
 * Jody's markdown, section by section.
 *
 * Two things are worth knowing about the result. The rubric's own examples are
 * the only source for several rules — M2's passive fragments and M3's generic
 * CTAs are named nowhere else in the document — so those lists are the ones the
 * document gives rather than the ones English allows. And `guidance` holds the
 * voice transforms whose left side is a category rather than a phrase; they are
 * real rules that no pattern can carry, and dropping them would misrepresent
 * the source as more mechanical than it is.
 */
function parseSkillMd(text) {
  const out = {
    codes: {},
    forbidden: [],
    bannedPhrases: [],
    genericCtas: [],
    genericLinks: [],
    passive: [],
    terms: [],
    brandTitleCase: [],
    transforms: [],
    guidance: [],
    examples: [],
    limits: {},
    score: [],
    rules: [],
    legalTriggers: [],
    style: {},
    tone: {},
    email: {},
    valueProps: {},
    states: [],
    reviewOrder: [],
  };

  let m4 = [];
  const seen = new Set();

  for (const { heading, body } of sections(text, '##')) {
    const name = key(heading);
    if (DROPPED.has(name)) continue;
    seen.add(name);

    switch (name) {
      case 'SCORING':
        out.codes = scoring(body);
        out.score = scoreLadder(body);
        m4 = quoted(out.codes.M4?.description ?? '');
        out.passive = quoted(out.codes.M2?.description ?? '');
        out.genericCtas = quoted(out.codes.M3?.description ?? '');
        break;

      case 'REWRITE QUALITY BAR':
        // Only the before/after table survives. The prose around it instructs a
        // reviewer how hard to rewrite, and there is no reviewer here.
        out.examples = tableRows(body).map(([before, after]) => ({
          before: before.replace(/^"|"$/g, ''),
          after: after.replace(/^"|"$/g, ''),
        }));
        break;

      case 'THUMBTACK VOICE TRANSFORMS':
        for (const bullet of bullets(body)) {
          const t = transform(bullet);
          if (t) out.transforms.push(t);
          else out.guidance.push(bullet);
        }
        break;

      case 'MANDATORY RULES':
        for (const { heading: h, body: b } of sections(body, '###')) {
          const rule = h.match(/^Rule (\d+):\s*(.+)$/);
          if (!rule) throw new Error(`Unrecognised mandatory rule heading: ${h}`);
          out.rules.push({ id: `Rule ${rule[1]}`, title: rule[2].trim(), body: b });
          if (b.includes('| Component |')) {
            for (const [component, length, format] of tableRows(b)) {
              out.limits[component] = {
                ...lengths(length),
                format: format === '—' ? null : format,
              };
            }
          }
          if (/legal review/i.test(h)) out.legalTriggers = bullets(b);
        }
        break;

      case 'STYLE RULES': {
        const style = styleRules(body);
        // M3 names the generic CTAs in passing and the style section lists them
        // properly. The style spelling wins and M3 only contributes anything it
        // has that the list does not.
        style.genericCtas = union(style.genericCtas, out.genericCtas);
        Object.assign(out, style);
        break;
      }

      case 'EMAIL RULES':
        out.email = emailRules(body);
        break;

      case 'BRAND VALUE PROPOSITIONS':
        out.valueProps = valueProps(body);
        break;

      case 'SYSTEM STATES':
        out.states = bullets(body).map((b) => {
          const m = b.match(/^([^:]+):\s*(.+)$/);
          if (!m) throw new Error(`Unrecognised system state: ${b}`);
          return { name: m[1].trim(), pattern: m[2].trim() };
        });
        break;

      case 'CONTENT REVIEW ORDER':
        out.reviewOrder = body
          .split('\n')
          .map((l) => l.match(/^\d+\.\s+(.+)$/))
          .filter(Boolean)
          .map((m) => m[1].trim());
        break;

      default:
        throw new Error(
          `Unrecognised section "${heading}". The upstream has changed shape; ` +
            `teach the skill-md adapter about it or add it to DROPPED with a reason.`,
        );
    }
  }

  // The banned phrases are named in M4 and their replacements in the transform
  // table, and the two spell them differently — "Please be advised" against
  // "Please be advised that". The shorter form is the pattern, because the
  // longer one is one word away from not matching.
  const fixes = new Map(out.transforms.map((t) => [t.from.toLowerCase(), t]));
  out.bannedPhrases = m4.map((phrase) => {
    const lower = phrase.toLowerCase();
    const hit =
      fixes.get(lower) ??
      out.transforms.find((t) => t.from.toLowerCase().startsWith(lower));
    return { phrase, fix: hit ? (hit.to ?? hit.raw) : null, literal: hit?.literal ?? false };
  });

  for (const required of ['SCORING', 'MANDATORY RULES', 'STYLE RULES']) {
    if (!seen.has(required)) throw new Error(`Upstream is missing its ${required} section`);
  }
  return out;
}

export const ADAPTERS = {
  'skill-md': parseSkillMd,
  // 'thumbprint-tsx': parseGuide,  if Content Design takes the rules over
};

/** Read a capture through the adapter its descriptor names. */
export function parse(text, source) {
  const adapter = ADAPTERS[source.kind];
  if (!adapter) {
    throw new Error(
      `No adapter for source kind "${source.kind}". Known kinds: ${Object.keys(ADAPTERS).join(', ')}`,
    );
  }
  return adapter(text);
}

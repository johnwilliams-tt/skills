/**
 * The words in a source file, and nothing else in it.
 *
 * One implementation for the same reason lib/copy.mjs is one: check.mjs reports
 * copy as a file is edited and scripts/copy.mjs reports it on purpose, and two
 * walkers would mean the edit hook and the audit disagreeing about what a file
 * even says. This finds the strings; the engine decides them.
 *
 * What it will not read is the point. An identifier, an import, a class name, a
 * URL, or anything inside a region it could not fully parse stays out — a copy
 * check that fires on a variable name is one people switch off, and then none of
 * the findings land. Interpolations are blanked rather than guessed at, because
 * undercounting a length is the side of that to be wrong on.
 */

/** Only the files that can hold markup; a stylesheet has no text nodes. */
export const MARKUP_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.vue', '.svelte', '.astro']);

/** Attributes that hold words a person reads. Children are the walk below. */
export const TEXT_PROPS = ['label', 'title', 'placeholder', 'aria-label', 'alt'];

/**
 * The marker that says a region's words were written by somebody outside
 * Thumbtack, and the values of it that hand a region back.
 *
 * `data-pp-content="pro"` on an element covers everything under it. The content
 * rules are Thumbtack's voice, and a pro's own description of their own business
 * is not written in it and is not ours to correct — a pro who wrote "Bay Area's
 * Finest Plumbing — Serving You Since 1998" broke the title case rule, the
 * superlative rule and the length limit, and every one of those findings is
 * wrong. Worse, the score they drag down is the app layer's score, so an
 * unmarked pro region makes the number mean nothing.
 *
 * It inherits, because pro content arrives as a block: a profile, a website, a
 * quote. And it reverses, because the app layer reaches back inside one — the
 * Edit button over a pro's headline is Thumbtack's word and is checked, under
 * `data-pp-content="app"`.
 */
export const CONTENT_ATTR = 'data-pp-content';
const APP_LAYER = new Set(['app', 'thumbtack', 'pushpin', 'ours']);
const authorOf = (value) => (value && !APP_LAYER.has(value.toLowerCase().trim()) ? value.trim() : null);

/** Elements whose contents are code rather than copy. */
const OPAQUE = new Set(['script', 'style', 'code', 'pre']);

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * A tag, with attribute values that carry their own quotes or braces — an arrow
 * function inside one holds a `>` that would otherwise end the tag three
 * characters in. Three levels of nesting covers real JSX; anything deeper is not
 * recognised as a tag at all, and NOT_COPY is what keeps that from turning into
 * a finding.
 */
const brace = (depth) => (depth ? `\\{(?:[^{}]|${brace(depth - 1)})*\\}` : '\\{[^{}]*\\}');
const MARKUP = new RegExp(`<(/?)([a-zA-Z][\\w.:-]*)((?:'[^']*'|"[^"]*"|${brace(2)}|[^<>'"{])*)>`, 'g');

/** A JSX expression or a template placeholder; the `$` belongs to the hole. */
const EXPRESSION = new RegExp(`\\$?${brace(2)}`, 'g');

/**
 * Copy a script hands to the DOM instead of writing in markup.
 *
 * The markup walk below reads a template literal that holds tags, so the copy
 * inside `` `<li>Nearby</li>` `` is already covered. What it cannot see is a
 * string handed to an element through a property or a setter, and that is where
 * a placeholder, an accessible name and a live-region announcement actually live
 * in a hand-rolled prototype — the strings nobody can read off the markup and
 * everybody has to grep for. A report that silently skipped them would call a
 * file clean on the strength of not having looked.
 *
 * Restricted to a known sink on the left and a literal on the right. A bare
 * `const EMPTY = '…'` is deliberately not a sink: the copy in it reaches a
 * reader through the markup that interpolates it, where the walk finds it under
 * whatever component that markup declares, and treating every string constant as
 * copy is how the check starts firing on identifiers.
 */
const SINKS = [...TEXT_PROPS, 'textContent', 'innerText', 'ariaLabel'];

/** `.placeholder = '…'`, `.textContent = \`…\``, and the property spellings of both. */
const ASSIGNED = new RegExp(
  `\\.(${SINKS.filter((s) => !s.includes('-')).join('|')})\\s*=\\s*(?!=)(['"\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2`,
  'g',
);

/** `setAttribute('aria-label', '…')`, where the slot is named rather than spelled. */
const SET_ATTRIBUTE = new RegExp(
  `setAttribute\\(\\s*['"](${TEXT_PROPS.join('|')})['"]\\s*,\\s*(['"\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2`,
  'gi',
);

/** `ariaLabel` is the property spelling of an attribute the rest name with a dash. */
const slotOf = (name) => (/^arialabel$/i.test(name) ? 'aria-label' : name);

/**
 * The same marker for a string a script assigns, where there is no tag to put an
 * attribute on.
 *
 * `// pushpin-content: pro` covers the line it is on and the line after it, the
 * scope an eslint-disable-next-line has, and the only scope that can be read
 * without parsing the block structure around it. Most pro content in script is
 * already safe without this — it arrives as a value, `bio.textContent =
 * profile.tagline`, and a value is not a literal and is never extracted. What
 * needs the marker is the seeded copy in a prototype, where a pro's words are
 * typed into the mock as a literal.
 *
 * `mask` preserves this one comment so the walk can still see it; every other
 * comment is blanked before the walk begins.
 */
export const CONTENT_PRAGMA = /\/\/\s*pushpin-content:\s*([A-Za-z][\w-]*)/g;

/** Line numbers a pragma covers, mapped to the author it names. */
function pragmas(src) {
  const out = new Map();
  for (const m of src.matchAll(CONTENT_PRAGMA)) {
    const author = authorOf(m[1]);
    const line = lineOf(src, m.index);
    // The line after it too, so the marker can sit above the assignment it is
    // about rather than being crowded onto the end of it.
    for (const l of [line, line + 1]) {
      if (author) out.set(l, author);
      else out.delete(l);
    }
  }
  return out;
}

/**
 * Text that is a URL, an identifier, or a region holding something this did not
 * parse. A leftover `<` or `{` means an unrecognised tag or expression is in
 * there, and the honest answer about a region we do not understand is nothing.
 */
const NOT_COPY = /[<{}]|^(?:https?:|mailto:|tel:|[./#])|^\S*[._/\\]\S*$|^[A-Z0-9_]+$|^\S*[a-z][A-Z]\S*$/;

export const isCopy = (text) => /[A-Za-z]{2}/.test(text) && !NOT_COPY.test(text.trim());

/** Interpolations blanked, so a length is undercounted rather than invented. */
const flatten = (text) => text.replace(EXPRESSION, (m) => m.replace(/[^\n]/g, ' '));

/**
 * Every string in `src` a person will read.
 *
 * `src` must already be comment-masked by the caller, which is also what makes
 * the offsets line up with the file the caller is reporting positions in.
 *
 * The length code needs a component, and `component` is set only where the
 * text's immediate parent declares one. A declaration on a wrapper says which
 * component the region is, not which slot inside it any one line fills, and
 * measuring a heading against a modal's body limit is the kind of finding that
 * costs more than it buys.
 *
 * @returns {Array<{text, raw, at, component, prop, authored}>} `prop` names the
 *   attribute or sink a string came through, and is null for an element's own
 *   text. `raw` is the same span with its interpolations still in it, which is
 *   what tells a caller that replacing the whole string would delete one.
 *   `authored` names whoever outside Thumbtack wrote the string, and is null for
 *   the app layer — the strings a caller should actually be checking.
 */
export function strings(src) {
  const out = [];
  const take = (raw, at, component = null, prop = null, authored = null) => {
    const body = flatten(raw);
    if (isCopy(body)) out.push({ text: body, raw, at, component, prop, authored });
  };

  const marked = pragmas(src);
  const stack = [];
  let cursor = 0;

  // Text is held until its element closes, so an opening tag that never closes —
  // a TypeScript generic, `Array<Item>` — takes the code that follows it down
  // with it instead of being read as the paragraph it is not.
  for (const m of src.matchAll(MARKUP)) {
    const [whole, closing, tag, attrs = ''] = m;
    const open = stack[stack.length - 1];
    if (open && !open.opaque && cursor < m.index) {
      open.text.push({ body: src.slice(cursor, m.index), at: cursor });
    }
    cursor = m.index + whole.length;

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag !== tag) continue;
        const [el] = stack.splice(i);
        for (const t of el.text) take(t.body, t.at, el.component, null, el.authored);
        break;
      }
      continue;
    }

    const opaque = Boolean(open?.opaque) || OPAQUE.has(tag.toLowerCase());
    const component = attrValue(attrs, 'data-pp-component')?.value ?? null;
    // Declared on this tag or inherited from the region it sits in, and a
    // declaration naming the app layer ends an inherited one.
    const declared = attrValue(attrs, CONTENT_ATTR);
    const authored = declared ? authorOf(declared.value) : (open?.authored ?? null);
    const attrsAt = m.index + 1 + tag.length;
    if (!opaque) {
      for (const prop of TEXT_PROPS) {
        const v = attrValue(attrs, prop);
        if (v) take(v.value, attrsAt + v.at, component, prop, authored);
      }
    }

    if (/\/\s*$/.test(attrs) || VOID.has(tag.toLowerCase())) continue;
    stack.push({ tag, component, opaque, authored, text: [] });
  }

  // A sink carries no component — the element it is reached through is a
  // variable, not a tag with a declaration on it — so length goes unchecked
  // here unless the caller names a row for the string.
  for (const re of [ASSIGNED, SET_ATTRIBUTE]) {
    for (const m of src.matchAll(re)) {
      const value = m[3];
      const at = m.index + m[0].length - value.length - 1;
      take(value, at, null, slotOf(m[1]), marked.get(lineOf(src, m.index)) ?? null);
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

/** The attributes worth reading out of a tag, compiled once rather than per tag. */
const ATTR = new Map(
  ['data-pp-component', CONTENT_ATTR, ...TEXT_PROPS].map((n) => [
    n,
    new RegExp(`(?:^|[\\s{])${n}\\s*=\\s*\\{?\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  ]),
);

/**
 * A quoted attribute value with its offset inside `attrs`, or null.
 *
 * Quoted literals only: a value the file computes at runtime is not a name or a
 * string this can read. Taken whole rather than up to the first space, because
 * catalog names carry both ("Icon Button", "Modal / Confirmation").
 */
export function attrValue(attrs, name) {
  const m = ATTR.get(name).exec(attrs);
  if (!m) return null;
  const value = m[1] ?? m[2];
  return { value, at: m.index + m[0].length - value.length - 1 };
}

/**
 * Comments and the contents of url() blanked, so a hex in either does not read
 * as a value someone chose. Positions are preserved so line numbers stay true.
 *
 * The one exception is a `pushpin-content:` marker, which is kept because it is
 * addressed to this walk: blanking it would mean the only way to exempt a pro's
 * words from the content rules was an attribute, and a string a script assigns
 * has no tag to carry one. It holds no value any other check reads.
 */
export function mask(src) {
  const keep = (m, p = '') =>
    /^\s*\/\/\s*pushpin-content:/.test(m.slice(p.length)) ? m : p + ' '.repeat(m.length - p.length);
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => keep(m, p))
    .replace(/url\([^)]*\)/g, (m) => ' '.repeat(m.length));
}

/** The same, plus HTML comments, for a walk that should not read a commented tag. */
export const maskMarkup = (src) =>
  mask(src).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

export const lineOf = (src, index) => src.slice(0, index).split('\n').length;

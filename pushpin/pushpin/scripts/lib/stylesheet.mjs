/**
 * Whether anything in a project names the token stylesheet.
 *
 * Why it exists: `init` copies the stylesheet in, and until a page, another
 * stylesheet, a module, or a build config names the file, all 300 custom
 * properties are inert and the project renders unstyled. That is the one
 * remaining action after a write, and stating it unconditionally spent it on
 * every re-run of a project whose app root had named the file for months —
 * which is how the line stopped being read.
 *
 * What it deliberately does not claim: that no reference exists. It claims that
 * no file it read names the stylesheet. A bundler pulling the file in by glob, a
 * framework loading a directory by convention, a reference in a file type not
 * read here, a symlinked tree it declined to follow — none of those are ruled
 * out, and none of them can be. So anything short of a complete read answers
 * `unknown`, and the caller says nothing on that answer: a false "nothing loads
 * it" is a nag in a report whose whole purpose is to have none.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

/**
 * The file types that can load a stylesheet: markup, another stylesheet, a
 * module, a build config. Markdown is not among them — `AGENTS.md` carries the
 * stylesheet's path because `init` wrote it there, and documenting a file is not
 * loading it.
 */
const READ_EXT = new Set([
  '.html', '.htm', '.xhtml', '.ejs', '.hbs', '.njk', '.liquid', '.twig', '.erb', '.php',
  '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json',
]);

/** Dependencies, history, build output, and our own state: none of it is wiring. */
const PRUNE = new Set([
  'node_modules', '.git', '.pushpin',
  'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.cache', '.parcel-cache',
  '.turbo', '.vercel', '.netlify',
]);

/**
 * Files `init` writes the stylesheet's own path into. `pushpin.config.json`
 * records the destination it wrote to, and counting it would let every
 * initialized project prove itself wired by our own write.
 */
const OURS = new Set(['pushpin.config.json']);

/**
 * A ceiling on how much of a project is read before the answer is abandoned.
 * Reached only in a tree far larger than a prototype, where a full read is not
 * worth a setup's time — and an abandoned read is `unknown`, never a verdict.
 */
const MAX_FILES = 4000;

/**
 * @param {string} target project root
 * @param {string} cssRel where the stylesheet was written, relative to it
 * @returns {'referenced' | 'unreferenced' | 'unknown'}
 */
export function stylesheetReference(target, cssRel) {
  const root = resolve(target);
  // The filename rather than the path, which is what covers every form the
  // reference actually takes: `<link href>`, a CSS `@import`, a JS `import`, a
  // config naming it. Each writes its own relative path to the same file.
  const needle = basename(cssRel).toLowerCase();
  const self = resolve(root, cssRel);

  // Whether some part of the tree went unread. Kept apart from the search so a
  // hit still answers `referenced`: what matters is only that "nothing names
  // it" is never returned about a project that was not fully read.
  let unread = false;
  let files = 0;
  const stack = [root];

  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      unread = true;
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      // Pruned by name before anything else about it is asked, so that a
      // symlinked `node_modules` costs the answer nothing: territory nobody
      // wanted read is not territory that went unread.
      if (PRUNE.has(entry.name)) continue;
      // A link is not followed, because one can point back up its own tree and
      // loop. Whether it leads to a file or a directory is not worth a stat —
      // either way what is behind it was not read.
      if (entry.isSymbolicLink()) {
        unread = true;
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      // Nothing that carries the name because Pushpin put it there gets a vote,
      // the stylesheet included: a build that ever names the file in its own
      // header would otherwise answer `referenced` for every project there is.
      if (abs === self || OURS.has(entry.name)) continue;
      if (!READ_EXT.has(extname(entry.name).toLowerCase())) continue;
      if (files++ >= MAX_FILES) return 'unknown';
      let body;
      try {
        body = readFileSync(abs, 'utf8');
      } catch {
        unread = true;
        continue;
      }
      if (body.toLowerCase().includes(needle)) return 'referenced';
    }
  }

  return unread ? 'unknown' : 'unreferenced';
}

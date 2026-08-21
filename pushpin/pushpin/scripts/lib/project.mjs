/**
 * What can be read off a project without asking: its stack, where a stylesheet
 * would go, and whether it already has a dev server of its own.
 *
 * Shared by `init.mjs`, which acts on it, and `setup.mjs`, which reports it
 * before anything is written. Two copies of this would drift into telling the
 * user one destination and writing to another.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ordered by how specific the convention is, so a project with both `src/styles`
 * and `src` gets the one that was chosen on purpose.
 */
const STYLE_DIRS = ['src/styles', 'app/styles', 'styles', 'src/app', 'app', 'src', 'assets'];

/** The fallback when nothing in the project says where a stylesheet goes. */
const STYLE_FALLBACK = 'styles';

/**
 * What gives a project a module graph. Only in one of these does a stylesheet
 * reach the page through an `import`; everywhere else the page names the file
 * itself, and an author handed an import has nowhere to put it that would not
 * break the page. A package.json on its own does not answer this — a prototype
 * with a `serve` script has one and has no module.
 */
const BUNDLERS = [
  'next',
  'vite',
  'webpack',
  'parcel',
  'react-scripts',
  '@remix-run/dev',
  'astro',
  'nuxt',
  '@sveltejs/kit',
  '@rsbuild/core',
];

/**
 * Where a framework's entry module sits, longest first so a project carrying
 * both `src` and `src/app` gets the inner one.
 */
const ENTRY_DIRS = ['src/app', 'app', 'src'];

/** Whether a page at the root would be the thing linking the stylesheet. */
function hasRootHtml(target) {
  try {
    return readdirSync(target).some((f) => f.endsWith('.html'));
  } catch {
    return false;
  }
}

/** How this project runs a script, taken from whichever lockfile is present. */
function runner(target) {
  if (existsSync(join(target, 'pnpm-lock.yaml'))) return 'pnpm dev';
  if (existsSync(join(target, 'yarn.lock'))) return 'yarn dev';
  if (existsSync(join(target, 'bun.lockb'))) return 'bun run dev';
  return 'npm run dev';
}

/**
 * The port a framework's dev server takes by default. Guessed from the
 * dependency rather than parsed out of the script, because the script is where
 * a port is overridden and a wrong guess there would be stated as fact. An
 * unknown port is recorded as null, which leaves the preview silent about a
 * server it cannot find — the honest answer.
 */
function devPort(has) {
  if (has('next')) return 3000;
  if (has('vite')) return 5173;
  if (has('@remix-run/dev')) return 3000;
  if (has('react-scripts')) return 3000;
  return null;
}

export function detectStack(target) {
  const pkgPath = join(target, 'package.json');
  let pkg = null;
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      // An unparseable package.json tells us nothing, which is what no
      // package.json tells us. Not worth a separate answer.
    }
  }
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const has = (n) => Object.keys(deps).some((d) => d === n || d.startsWith(n + '/'));

  const found = STYLE_DIRS.find((d) => existsSync(join(target, d)));
  // A flat prototype is a page linking a stylesheet beside it —
  // `<link rel="stylesheet" href="pushpin.css">`, the usage SKILL.md documents —
  // so an HTML file at the root answers this as definitely as a styles
  // directory does. Inventing a `styles/` folder to hold one file would
  // contradict that example in the one case it comes up.
  const flat = !found && hasRootHtml(target);

  // A project that already has a way to serve itself keeps it. Pushpin's own
  // preview is for the flat prototype that has none, where the alternative is
  // an agent re-deriving a static server per project.
  const hasDevScript = typeof pkg?.scripts?.dev === 'string' && pkg.scripts.dev.trim().length > 0;

  return {
    name: pkg?.name ?? null,
    react: has('react'),
    next: has('next'),
    bundler: BUNDLERS.some(has),
    tailwind: has('tailwindcss'),
    thumbprint: Object.keys(deps).some((d) => d.includes('thumbprint')),
    devCommand: hasDevScript ? runner(target) : null,
    devPort: hasDevScript ? devPort(has) : null,
    stylesDir: found ?? (flat ? '' : STYLE_FALLBACK),
    // Whether the destination was read off the project or fallen back to. Only
    // reported, never asked about: an empty directory is the only case that
    // reaches the fallback, and there every answer is equally correct.
    stylesDirGuessed: !found && !flat,
  };
}

/**
 * How the stylesheet is named from the module that imports it, which is not the
 * string a `<link href>` carries: an import resolves against the importing file
 * rather than against the page, and a specifier that does not begin with a dot
 * is read as a package. The importing file is the entry at the top of the
 * source tree, so a path measured from the project root is wrong by that
 * directory.
 *
 * @param {string} cssRel stylesheet path relative to the project root
 */
export function importSpecifier(cssRel) {
  const path = cssRel.split('\\').join('/');
  const entry = ENTRY_DIRS.find((d) => path.startsWith(d + '/'));
  const fromEntry = entry ? path.slice(entry.length + 1) : path;
  return fromEntry.startsWith('.') ? fromEntry : './' + fromEntry;
}

/** The one-line stack summary both commands print. */
export function describeStack(env) {
  return (
    [
      env.name && `package "${env.name}"`,
      env.next && 'Next.js',
      !env.next && env.react && 'React',
      env.tailwind && 'Tailwind',
      env.thumbprint && 'Thumbprint',
    ]
      .filter(Boolean)
      .join(', ') || 'no package.json'
  );
}

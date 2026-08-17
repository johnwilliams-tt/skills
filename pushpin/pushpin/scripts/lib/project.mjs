/**
 * What can be read off a project without asking: its stack, and where a
 * stylesheet would go.
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

/** Whether a page at the root would be the thing linking the stylesheet. */
function hasRootHtml(target) {
  try {
    return readdirSync(target).some((f) => f.endsWith('.html'));
  } catch {
    return false;
  }
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

  return {
    name: pkg?.name ?? null,
    react: has('react'),
    next: has('next'),
    tailwind: has('tailwindcss'),
    thumbprint: Object.keys(deps).some((d) => d.includes('thumbprint')),
    stylesDir: found ?? (flat ? '' : STYLE_FALLBACK),
    // Whether the destination was read off the project or fallen back to. Only
    // reported, never asked about: an empty directory is the only case that
    // reaches the fallback, and there every answer is equally correct.
    stylesDirGuessed: !found && !flat,
  };
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

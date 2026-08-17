/**
 * What can be read off a project without asking: its stack, and where a
 * stylesheet would go.
 *
 * Shared by `init.mjs`, which acts on it, and `setup.mjs`, which reports it
 * before anything is written. Two copies of this would drift into telling the
 * user one destination and writing to another.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ordered by how specific the convention is, so a project with both `src/styles`
 * and `src` gets the one that was chosen on purpose.
 */
const STYLE_DIRS = ['src/styles', 'app/styles', 'styles', 'src/app', 'app', 'src', 'assets'];

/** The fallback when no known layout matches. */
const STYLE_FALLBACK = 'styles';

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

  return {
    name: pkg?.name ?? null,
    react: has('react'),
    next: has('next'),
    tailwind: has('tailwindcss'),
    thumbprint: Object.keys(deps).some((d) => d.includes('thumbprint')),
    stylesDir: found ?? STYLE_FALLBACK,
    // Whether the directory was recognized or guessed. The caller asks the user
    // where the stylesheet goes only in the second case; asking in the first
    // spends a question on an answer the project already gave.
    stylesDirGuessed: !found,
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

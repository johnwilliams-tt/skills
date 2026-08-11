#!/usr/bin/env node
/**
 * Answers the one question the local checks cannot: are the committed captures
 * still what Figma is serving?
 *
 * `build-css.mjs --check` proves the CSS matches the JSON. `verify.mjs` proves
 * the transform is faithful and nothing was hand-edited. Both pass happily on a
 * capture that went stale months ago, because both compare the repo against
 * itself. This compares it against the world.
 *
 * It answers in layers, strongest evidence first, and degrades instead of
 * failing when a layer is out of reach:
 *
 *   capture age    always, no token, no network — how old the captures are
 *   components     FIGMA_TOKEN, any plan       — do our 117 import keys still exist
 *   styles         FIGMA_TOKEN, any plan       — do our text and effect style keys
 *   variables      FIGMA_TOKEN, Enterprise     — has the kit published since
 *   annotations    FIGMA_TOKEN, any plan       — do our 91 Annotation Kit keys still exist
 *   icons          FIGMA_TOKEN, any plan       — do our 899 icon keys still exist
 *
 * The age layer matters most in practice. A designer asking "can I trust this?"
 * gets a real answer with no token, no plan, and no setup — which is the
 * difference between a check people run and a check people mean to run.
 *
 * A missing key is the serious finding. `importComponentByKeyAsync` and
 * `importVariableByKeyAsync` throw at runtime on a key that no longer exists,
 * so a generation script written against this catalog fails mid-run rather than
 * at review. That is why key existence is checked directly rather than inferred
 * from counts.
 *
 * Three files are checked, because the plugin depends on three. An unpublished
 * Annotation Kit key throws in exactly the same place as an unpublished Pushpin
 * one, and the annotation is placed at the end of a generation run, so the
 * failure lands after the expensive part. The Annotation Kit publishes no text
 * or effect styles and its variables are not used, so it gets a component layer
 * and nothing else.
 *
 * The third file is the Thumbprint UI Kit, which is where the icon set is
 * published — not the Pushpin file, despite icons being part of Pushpin, and by
 * design rather than by omission. Icons are placed early and everywhere, so a
 * dead icon key takes a run down near the start; it also gets a component layer
 * and nothing else.
 *
 * Nothing here writes a file. For the capture itself, see pull-published.mjs
 * and scripts/check.md.
 *
 * Usage:
 *   node scripts/freshness.mjs                      # capture age only
 *   FIGMA_TOKEN=figd_... node scripts/freshness.mjs # every layer it can reach
 *   node scripts/freshness.mjs --max-age 14         # stricter age limit
 *   node scripts/freshness.mjs --offline            # never touch the network
 *   node scripts/freshness.mjs --strict             # an unreachable layer fails
 *   node scripts/freshness.mjs --json               # machine-readable
 *
 * Exit 0 when nothing is known to have moved, 1 when something has.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const load = (f) => JSON.parse(readFileSync(join(ASSETS, f), 'utf8'));

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n, fallback) => (has(n) ? argv[argv.indexOf(n) + 1] : fallback);

const manifest = load('manifest.json');
const catalog = load('components.figma.json');
const annotationCatalog = load('annotations.figma.json');
const iconCatalog = load('icons.figma.json');
const styleCatalog = load('styles.figma.json');

/**
 * Icons are one catalog entry with up to four import keys, so the unit that can
 * fail is the key rather than the entry. Flattened to `<name> · <size>` pairs
 * so a finding names the exact variant that stopped resolving.
 */
const iconKeyPairs = Object.entries(iconCatalog.icons ?? {}).flatMap(([name, e]) =>
  Object.entries(e.keys).map(([size, key]) => [`${name} · ${size}`, key]),
);

/** Catalog objects carry `$comment`-style metadata alongside real entries. */
const real = (o) => Object.entries(o ?? {}).filter(([k]) => !k.startsWith('$'));
const plural = (n) => (n === 1 ? '' : 's');

// Counted from the catalogs rather than written down, so the help text cannot
// promise a number the run does not actually check.
const styleKeyCount =
  real(styleCatalog.textStyles).length + real(styleCatalog.effectStyles).length;

if (has('--help') || has('-h')) {
  console.log(
    'usage: node scripts/freshness.mjs [--max-age days] [--offline] [--strict] [--json]\n\n' +
      'Reports how far the committed captures may have drifted from Figma.\n' +
      'Set FIGMA_TOKEN to check the import keys against the three live files: ' +
      `${real(catalog.components).length} components and ${styleKeyCount} styles in ` +
      `${manifest.figma.fileName}, ${real(annotationCatalog.components).length} ` +
      `components in ${manifest.annotationKit.fileName}, and ${iconKeyPairs.length} ` +
      `icon keys in ${manifest.iconLibrary.fileName}.`,
  );
  process.exit(0);
}

const DEFAULT_MAX_AGE = 30;
const maxAge = Number(opt('--max-age', DEFAULT_MAX_AGE));
if (!Number.isFinite(maxAge) || maxAge < 0) {
  console.error(`--max-age needs a non-negative number of days, got ${opt('--max-age')}`);
  process.exit(1);
}

const asJson = has('--json');
const strict = has('--strict');
const offline = has('--offline');

// ---------------------------------------------------------------- capture age

const ageOf = (date, where) => {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    console.error(`manifest.json has an unparseable ${where}: ${date}`);
    process.exit(1);
  }
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
};

const phraseFor = (days) =>
  days === 0 ? 'captured today' : days === 1 ? 'captured yesterday' : `${days} days old`;

// The three files are captured independently, so they age independently. The
// age limit is tested against the oldest of them: a current Annotation Kit says
// nothing about a Pushpin capture that has been sitting for two months.
const captures = [
  {
    fileName: manifest.figma.fileName,
    capturedAt: manifest.capturedAt,
    ageDays: ageOf(manifest.capturedAt, 'capturedAt'),
  },
  {
    fileName: manifest.annotationKit.fileName,
    capturedAt: manifest.annotationKit.capturedAt,
    ageDays: ageOf(manifest.annotationKit.capturedAt, 'annotationKit.capturedAt'),
  },
  {
    fileName: manifest.iconLibrary.fileName,
    capturedAt: manifest.iconLibrary.capturedAt,
    ageDays: ageOf(manifest.iconLibrary.capturedAt, 'iconLibrary.capturedAt'),
  },
];

const capturedAt = manifest.capturedAt;
const oldest = captures.reduce((a, b) => (b.ageDays > a.ageDays ? b : a));
const ageDays = oldest.ageDays;
const ageStale = ageDays > maxAge;
const agePhrase = phraseFor(ageDays);

const report = {
  capturedAt,
  ageDays,
  maxAge,
  captures,
  figma: manifest.figma,
  annotationKit: manifest.annotationKit,
  layers: [],
  findings: [],
  notes: [],
};

/**
 * `mark` is the one-word verdict shown in the left column. It defaults from the
 * status, but the age layer overrides it: an old capture is stale, not moved —
 * nothing is known to have changed there, only that nobody has looked.
 */
const layer = (name, status, detail, mark) =>
  report.layers.push({
    name,
    status,
    detail,
    mark: mark ?? { pass: 'ok', fail: 'moved', skipped: '--' }[status],
  });

layer(
  'capture age',
  ageStale ? 'fail' : 'pass',
  ageStale
    ? `${oldest.fileName} ${agePhrase} — past the ${maxAge}-day refresh point`
    : `${oldest.fileName} last captured ${oldest.capturedAt}, ${agePhrase}`,
  ageStale ? 'stale' : 'ok',
);
if (ageStale) {
  report.findings.push(
    `The ${oldest.fileName} capture has not been taken in ${ageDays} days. Nothing is known ` +
      `to have changed — only that it has been long enough that nobody has checked, so ` +
      `re-capture it before trusting a value out of it.`,
  );
}

// -------------------------------------------------------------- live evidence

const token = process.env.FIGMA_TOKEN;
const fileKey = manifest.figma.fileKey;
const annotationFileKey = manifest.annotationKit.fileKey;
const iconFileKey = manifest.iconLibrary.fileKey;

/** One REST call, with the failure modes we care about kept distinguishable. */
async function figmaGet(path) {
  try {
    const res = await fetch(`https://api.figma.com/v1${path}`, {
      headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, body: (await res.text()).slice(0, 300) };
    }
    return { ok: true, json: await res.json() };
  } catch (e) {
    return { ok: false, status: 0, body: e.message };
  }
}

/**
 * Why a layer could not run, phrased so the reader knows whether to act. The
 * file key is passed in rather than read from the module scope: with two
 * sources, a 404 that names the wrong file sends the reader to the wrong
 * permissions dialog.
 */
function unreachable(name, r, where = fileKey) {
  if (r.status === 401) {
    return layer(name, 'skipped', '401 — the token is invalid or expired');
  }
  if (r.status === 403) {
    return layer(name, 'skipped', '403 — the token lacks the scope for this endpoint');
  }
  if (r.status === 404) {
    return layer(name, 'skipped', `404 — no access to ${where}, or the file moved`);
  }
  if (r.status === 429) return layer(name, 'skipped', '429 — rate limited by Figma, try again');
  if (r.status === 0) return layer(name, 'skipped', `could not reach Figma: ${r.body}`);
  return layer(name, 'skipped', `${r.status} from Figma: ${r.body}`);
}

/**
 * Compare our committed import keys against the keys the file publishes now.
 * Shared by components and styles because the question is identical.
 */
function compareKeys(name, committed, liveKeys, expectedTotal, liveTotal) {
  const missing = committed.filter(([, key]) => !liveKeys.has(key));
  if (missing.length) {
    layer(name, 'fail', `${missing.length} of ${committed.length} keys no longer published`);
    const noun = missing.length === 1 ? name.replace(/s$/, '') : name;
    report.findings.push(
      `${missing.length} ${noun} in the catalog ${missing.length === 1 ? 'is' : 'are'} no ` +
        `longer published. Importing by key throws at runtime:\n` +
        missing
          .slice(0, 10)
          .map(([n]) => `    ${n}`)
          .join('\n') +
        (missing.length > 10 ? `\n    ...and ${missing.length - 10} more` : ''),
    );
    return;
  }
  layer(name, 'pass', `all ${committed.length} keys still published`);
  if (expectedTotal != null && liveTotal !== expectedTotal) {
    const delta = liveTotal - expectedTotal;
    report.notes.push(
      `The file publishes ${liveTotal} ${name} where the capture recorded ${expectedTotal} ` +
        `(${delta > 0 ? '+' : ''}${delta}). Every key the catalog depends on still resolves, ` +
        `so nothing is broken — but the kit has ${delta > 0 ? 'gained' : 'lost'} work the ` +
        `catalog does not describe.`,
    );
  }
}

/** Turn a passing layer red when a later signal contradicts it. */
function escalate(name, detail) {
  const l = report.layers.find((x) => x.name === name);
  if (l && l.status === 'pass') Object.assign(l, { status: 'fail', mark: 'moved', detail });
}

const NETWORK_LAYERS = ['components', 'styles', 'variables', 'annotations', 'icons'];

if (offline) {
  for (const name of NETWORK_LAYERS) layer(name, 'skipped', '--offline');
} else if (!token) {
  const why = 'FIGMA_TOKEN is not set';
  for (const name of NETWORK_LAYERS) layer(name, 'skipped', why);
  report.notes.push(
    'Only the capture dates were checked. For the stronger answer — whether our import ' +
      'keys still exist in the kit, the Annotation Kit, and the icon library — create a ' +
      'personal access token at figma.com > Settings > Security with the file_read scope, ' +
      'then re-run with FIGMA_TOKEN set.',
  );
} else {
  /**
   * Published component keys for one file, from both component endpoints.
   *
   * A component set publishes under its own key in `/component_sets`, while
   * `/components` lists the individual variants. Catalog entries of type
   * COMPONENT_SET carry the set's key, so checking `/components` alone would
   * report every set as unpublished — 96 of Pushpin's 117 entries and 70 of the
   * Annotation Kit's 91.
   *
   * `componentCount` stays the `/components` figure on its own, because that is
   * what the capture's `publishedTotal` was counted against.
   *
   * `ours` narrows the `updated_at` sweep to keys the catalog actually depends
   * on. It matters for the icon library: that file publishes 170 components
   * beyond the icon page, and any edit to one of them would otherwise read as
   * "an icon changed after the capture" and send the reader re-capturing for
   * nothing.
   */
  async function publishedComponents(key, forLayer, ours) {
    const [compRes, setRes] = await Promise.all([
      figmaGet(`/files/${key}/components`),
      figmaGet(`/files/${key}/component_sets`),
    ]);
    if (!compRes.ok) {
      unreachable(forLayer, compRes, key);
      return null;
    }
    if (!setRes.ok) {
      unreachable(forLayer, setRes, key);
      return null;
    }
    const live = compRes.json?.meta?.components;
    const liveSets = setRes.json?.meta?.component_sets;
    if (!Array.isArray(live) || !Array.isArray(liveSets)) {
      layer(forLayer, 'skipped', 'unexpected response shape from Figma');
      report.notes.push(
        `The component endpoints for ${key} returned no meta.components or ` +
          `meta.component_sets array.`,
      );
      return null;
    }
    const both = [...live, ...liveSets];
    return {
      keys: new Set(both.map((c) => c.key)),
      componentCount: live.length,
      newest: both
        .filter((c) => !ours || ours.has(c.key))
        .map((c) => c.updated_at)
        .filter(Boolean)
        .sort()
        .pop(),
    };
  }

  /**
   * A component that changed after the capture is a real risk even when its key
   * survives, because variant options and property keys move underneath a
   * stable key and a changed property key breaks setProperties.
   */
  function flagLateEdits(forLayer, newest, since, what) {
    if (!newest || newest.slice(0, 10) <= since) return;
    const on = newest.slice(0, 10);
    escalate(forLayer, `keys intact, but a component changed ${on}`);
    report.findings.push(
      `A component in ${what} was updated ${on}, after the capture (${since}). Every ` +
        `import key still resolves, but variant options and property keys may have ` +
        `moved, and a changed property key breaks setProperties.`,
    );
  }

  // Components. Any plan, file_read scope. The catalog keeps 117 public entries
  // out of a much larger published set, so the count is a note and the key
  // existence is the check.
  const live = await publishedComponents(fileKey, 'components');
  if (live) {
    compareKeys(
      'components',
      real(catalog.components).map(([n, c]) => [n, c.key]),
      live.keys,
      catalog.source?.publishedTotal,
      live.componentCount,
    );
    flagLateEdits('components', live.newest, capturedAt, 'the kit');
  }

  // Styles. Same plan requirements. These keys are the only way to apply
  // Pushpin type and elevation in Figma, so a missing one is as bad as a
  // missing component.
  const styleRes = await figmaGet(`/files/${fileKey}/styles`);
  if (!styleRes.ok) {
    unreachable('styles', styleRes);
  } else {
    const live = styleRes.json?.meta?.styles;
    if (!Array.isArray(live)) {
      layer('styles', 'skipped', 'unexpected response shape from Figma');
    } else {
      const committed = [
        ...real(styleCatalog.textStyles).map(([n, v]) => [`text style ${n}`, v.key]),
        ...real(styleCatalog.effectStyles).map(([n, v]) => [`effect style ${n}`, v.key]),
      ].filter(([, key]) => key);
      compareKeys('styles', committed, new Set(live.map((x) => x.key)), null, live.length);
    }
  }

  // Variables. Enterprise only — a 403 here is a plan boundary, not a problem
  // with the capture, so it stays a skip.
  const varRes = await figmaGet(`/files/${fileKey}/variables/published`);
  if (!varRes.ok) {
    unreachable('variables', varRes);
    if (varRes.status === 403) {
      report.notes.push(
        'The variables endpoint is Enterprise-only. Everything else still ran; use the ' +
          'plugin capture in scripts/check.md to check variables on any plan.',
      );
    }
  } else {
    const collections = Object.values(varRes.json?.meta?.variableCollections ?? {});
    const moved = collections
      .filter((c) => c.updatedAt && c.updatedAt.slice(0, 10) > capturedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (moved.length) {
      layer(
        'variables',
        'fail',
        `${moved.length} collection${plural(moved.length)} published since the capture`,
      );
      report.findings.push(
        `${moved.length} variable collection${plural(moved.length)} published since ` +
          `${capturedAt}:\n` +
          moved.map((c) => `    ${c.name} — ${c.updatedAt.slice(0, 10)}`).join('\n'),
      );
    } else {
      layer('variables', 'pass', `nothing published since ${capturedAt}`);
    }
  }

  // Annotation Kit components. Same endpoints, second file. No style or
  // variable layer here: the file publishes no text or effect styles, and its
  // one variable collection is documentation for Pushpin's tokens rather than
  // something the plugin binds to.
  //
  // No count comparison either. The Annotation Kit capture counts nodes on the
  // canvas, not published assets, so `capturedTotal` and the endpoint total are
  // not the same quantity and a delta between them would mean nothing.
  const liveAnnotations = await publishedComponents(annotationFileKey, 'annotations');
  if (liveAnnotations) {
    compareKeys(
      'annotations',
      real(annotationCatalog.components).map(([n, c]) => [n, c.key]),
      liveAnnotations.keys,
      null,
      liveAnnotations.componentCount,
    );
    flagLateEdits(
      'annotations',
      liveAnnotations.newest,
      manifest.annotationKit.capturedAt,
      'the Annotation Kit',
    );
  }

  // Icons. Third file, same endpoints. Every icon is a plain COMPONENT rather
  // than a set, so `/components` alone would do — but publishedComponents also
  // gives the `updated_at` sweep, and an icon redrawn after the capture is
  // worth knowing about even when its key survives.
  //
  // No count comparison. The icon page is one page of a much larger file, so
  // the file's published total and this catalog's 227 entries are not the same
  // quantity and a delta between them would mean nothing.
  const liveIcons = await publishedComponents(
    iconFileKey,
    'icons',
    new Set(iconKeyPairs.map(([, k]) => k)),
  );
  if (liveIcons) {
    compareKeys('icons', iconKeyPairs, liveIcons.keys, null, liveIcons.componentCount);
    flagLateEdits('icons', liveIcons.newest, manifest.iconLibrary.capturedAt, 'the icon library');
  }

  // A token that reaches nothing is worse than no token, because the run still
  // ends in a reassuring sentence. Say plainly that it proved nothing.
  const networkLayers = report.layers.filter((l) => l.name !== 'capture age');
  if (networkLayers.every((l) => l.status === 'skipped')) {
    report.notes.push(
      'FIGMA_TOKEN was set but no layer could use it, so this run proved nothing beyond ' +
        'the capture dates. Check the token is current and carries the file_read scope.',
    );
  }
}

// --------------------------------------------------------------------- report

const skipped = report.layers.filter((l) => l.status === 'skipped');
const failed = report.layers.filter((l) => l.status === 'fail');
const checked = report.layers.filter((l) => l.status !== 'skipped');

// A finding is the unit of "something needs doing", so it governs the exit code
// rather than the layer tally. The two agree today; making findings
// authoritative means a future signal that fits no single layer cannot slip out
// as a green run with a warning nobody reads.
report.stale = failed.length > 0 || report.findings.length > 0;
report.exitCode = report.stale || (strict && skipped.length) ? 1 : 0;

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}

const namePad = Math.max(...report.layers.map((l) => l.name.length));
const markPad = Math.max(...report.layers.map((l) => l.mark.length));
for (const c of captures) {
  console.log(`${c.fileName} — captured ${c.capturedAt}, ${phraseFor(c.ageDays)}`);
}
console.log('');
for (const l of report.layers) {
  console.log(`  ${l.mark.padEnd(markPad)}  ${l.name.padEnd(namePad)}  ${l.detail}`);
}

for (const line of [...report.findings, ...report.notes]) console.log(`\n  ${line}`);
console.log('');

if (report.stale) {
  console.log(`Run the captures in scripts/check.md, then: node scripts/diff.mjs --kit kit.json`);
  process.exit(1);
}
if (strict && skipped.length) {
  console.error(
    `--strict: ${skipped.length} of ${report.layers.length} layers could not be checked.`,
  );
  process.exit(1);
}
console.log(
  checked.length === report.layers.length
    ? `Every layer checked. Nothing has moved since ${oldest.capturedAt}.`
    : `Nothing moved in the ${checked.length} layer${checked.length === 1 ? '' : 's'} that could ` +
        `be checked. ${skipped.length} skipped.`,
);

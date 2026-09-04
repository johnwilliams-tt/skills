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
 *   project pin    if cwd has pushpin.config.json — is this project behind
 *   components     FIGMA_TOKEN, any plan       — do our 115 import keys still exist
 *   styles         FIGMA_TOKEN, any plan       — do our text and effect style keys
 *   variables      FIGMA_TOKEN, Enterprise     — has the kit published since
 *   annotations    FIGMA_TOKEN, any plan       — do our 91 Annotation Kit keys still exist
 *   icons          FIGMA_TOKEN, any plan       — do our 899 icon keys still exist
 *   copy source    always for age, GITHUB_TOKEN for more — has the rules blob moved
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
 * Two files are checked, because the plugin depends on two. An unpublished
 * Annotation Kit key throws in exactly the same place as an unpublished Pushpin
 * one, and the annotation is placed at the end of a generation run, so the
 * failure lands after the expensive part. The Annotation Kit publishes no text
 * or effect styles and its variables are not used, so it gets a component layer
 * and nothing else.
 *
 * Icons get a layer of their own despite being published from the Pushpin
 * library, and so from the same file the components layer already asks about.
 * They are a separate catalog keyed by glyph and captured on its own clock, so
 * the keys the components layer checks are not the keys an icon run imports, and
 * a layer that passed would say nothing about them. Icons are placed early and
 * everywhere, so a dead icon key takes a run down near the start.
 *
 * The third source is not Figma at all. The content design rules are a blob in
 * a GitHub repo, pinned by sha, so the question there is whether the blob moved
 * rather than whether a key still resolves — and the answer costs a GitHub call
 * on GITHUB_TOKEN, not a Figma one. Without the token it reports the age of its
 * own capture, which is the evidence the age layer offers for the Figma files
 * when their layers cannot run.
 *
 * Nothing here writes a file. For the captures themselves, see
 * pull-published.mjs, pull-copy.mjs, and scripts/check.md.
 *
 * Usage:
 *   node scripts/freshness.mjs                      # capture age only
 *   FIGMA_TOKEN=figd_... node scripts/freshness.mjs # every layer it can reach
 *   node scripts/freshness.mjs --max-age 14         # stricter age limit
 *   node scripts/freshness.mjs --offline            # never touch the network
 *   node scripts/freshness.mjs --strict             # an unreachable layer fails
 *   node scripts/freshness.mjs --strict --allow-skip variables   # …except by plan
 *   node scripts/freshness.mjs --json               # machine-readable
 *   node scripts/freshness.mjs --brief              # silent on success; one sentence when not
 *   node scripts/freshness.mjs --session            # session start: age, project pin, environment
 *   node scripts/freshness.mjs --offline --session  # the same with no network at all
 *
 * `--brief` prints nothing when nothing would change what gets built, and
 * otherwise only the sentence to relay — no dates, layer names, or skip counts.
 *
 * `--session` is the session-start form, and stdout is the whole message: empty
 * when there is nothing to do, `fix: <command>` for a finding the agent settles
 * itself without replacing anything, `say: <sentence>` for one it cannot. It
 * exits 0 either way, because a session start that reads as a failed command is
 * the noise this form exists to remove. `--json` still prints JSON under both.
 *
 * `--session` never calls Figma or GitHub's API: the token layers and the copy
 * source skip exactly as they do under `--offline`, whatever tokens the
 * environment holds. Its one network call is lib/remote-state.mjs reading the
 * repository's `plugin.json` and `kit-state.json` off raw.githubusercontent.com,
 * bounded to 1.5s and cached for a day under the project's `.pushpin/remote/`,
 * which is what lets a session hear that a release landed before the plugin has
 * been updated. `--offline --session` reads that cache and fetches nothing.
 *
 * If the current working directory holds a `pushpin.config.json`, a project-pin
 * layer compares that pin to this plugin. No config is not a finding; init is
 * offered elsewhere. The plugin's own tree is skipped — it is not a consumer.
 *
 * Exit 0 when nothing is known to have moved, 1 when something has — except
 * under `--session`, which always exits 0.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compareVersions,
  detectHarness,
  FIGMA_MCP_ABSENT,
  figmaMcp,
  pluginInstalls,
  pluginUpdateRemedy,
  stalePluginRemedy,
} from './lib/environment.mjs';
import {
  OVERLAY_MANIFEST,
  OVERLAY_REL,
  captureDate,
  findOverlay,
  overlayPath,
  supersededBy,
} from './lib/overlay.mjs';
import { remoteState } from './lib/remote-state.mjs';
import { MOVED_LAYERS, readKitState } from './kit-state.mjs';
import { cssPathArgs, inspectPin } from './pin.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'assets');
const load = (f) => JSON.parse(readFileSync(join(ASSETS, f), 'utf8'));

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n, fallback) => (has(n) ? argv[argv.indexOf(n) + 1] : fallback);

const overlay = findOverlay(process.cwd());

/**
 * The catalog this project will actually import from.
 *
 * The key layers ask Figma whether our keys still resolve, and "our" has to mean
 * the project's. A project holding a fresh overlay would otherwise be told about
 * six unpublished components it no longer references — a finding it cannot act
 * on and did not earn. `load` stays the plugin's copy, which is what the overlay
 * is compared against.
 */
const loadCatalog = (f) => {
  const own = overlayPath(overlay, f);
  return own ? JSON.parse(readFileSync(own, 'utf8')) : load(f);
};

const manifest = load('manifest.json');
const catalog = loadCatalog('components.figma.json');
const annotationCatalog = loadCatalog('annotations.figma.json');
const iconCatalog = loadCatalog('icons.figma.json');
const styleCatalog = load('styles.figma.json');

/**
 * Icons are one catalog entry with up to four import keys, so the unit that can
 * fail is the key rather than the entry. Flattened to `<name> · <size>` rows
 * so a finding names the exact variant that stopped resolving. The page is the
 * catalog's one page, recorded on the file rather than per entry.
 */
const iconKeyPairs = Object.entries(iconCatalog.icons ?? {}).flatMap(([name, e]) =>
  Object.entries(e.keys).map(([size, key]) => [
    `${name} · ${size}`,
    key,
    iconCatalog.source?.page ?? null,
  ]),
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
    'usage: node scripts/freshness.mjs [--max-age days] [--offline] [--strict] ' +
      '[--allow-skip a,b] [--json] [--brief] [--session]\n\n' +
      'Reports how far the committed captures may have drifted from Figma.\n' +
      'Set FIGMA_TOKEN to check the import keys against the two live files: ' +
      `${real(catalog.components).length} components, ${styleKeyCount} styles and ` +
      `${iconKeyPairs.length} icon keys in ${manifest.figma.fileName}, and ` +
      `${real(annotationCatalog.components).length} components in ` +
      `${manifest.annotationKit.fileName}.\n` +
      `Set GITHUB_TOKEN to ask whether ${manifest.copySource.repo} still serves the blob the ` +
      'content design rules were parsed from; without it that layer reports the age.\n' +
      '--strict fails when a layer could not be checked, so an unreachable layer stops ' +
      'reading as success. --allow-skip excuses named layers from that, which is what a ' +
      'non-Enterprise plan needs: the variables layer requires file_variables:read and is ' +
      'unreachable by plan rather than by neglect, so --strict --allow-skip variables still ' +
      'fails on an expired token or a lost file grant without failing on the plan.\n' +
      '--brief prints nothing when the capture is current and the project pin matches; ' +
      'otherwise one sentence to relay. --session says the same thing as a line the agent ' +
      'acts on: a fix: command to run, or a say: sentence for the user. It is the session ' +
      'start form: it never calls Figma, and its one network call reads the plugin ' +
      "repository's plugin.json and kit-state.json off GitHub, cached for a day under the " +
      "project's .pushpin/remote/. --offline --session reads that cache and fetches nothing.",
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
const brief = has('--brief');
const session = has('--session');

/**
 * Layers `--strict` will tolerate skipping.
 *
 * `--strict` exists so an unreachable layer stops reading as success, which is
 * the shape of failure that let five of seven layers skip silently for months.
 * But one layer is unreachable by plan rather than by neglect: the variables
 * endpoint needs `file_variables:read`, which Figma grants to full members of
 * Enterprise orgs and nobody else, so on any lesser plan `--strict` fails every
 * run on a gap the operator cannot close. A check that always fails gets muted,
 * which costs more than it buys.
 *
 * Naming the layer is the point. `--strict --allow-skip variables` still fails
 * on an expired token, a lost file grant, or a rate limit, because those are
 * layers nobody excused.
 */
const allowSkip = new Set(
  (opt('--allow-skip', '') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

// A typo here would silently defeat the flag and restore the exact
// false-confidence this option exists to prevent, so an unknown name is fatal
// rather than ignored.
const LAYER_NAMES = new Set([
  'capture age',
  'project pin',
  'components',
  'styles',
  'variables',
  'annotations',
  'icons',
  'copy source',
]);
for (const name of allowSkip) {
  if (!LAYER_NAMES.has(name)) {
    console.error(
      `--allow-skip: no layer named "${name}". Known layers: ${[...LAYER_NAMES].join(', ')}.`,
    );
    process.exit(1);
  }
}

const PLUGIN = JSON.parse(
  readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'),
);

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const prettyDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};

// Where a layer's keys live, for the sentence a finding hands the user. Four of
// the five name the same library, which is the truth rather than a table that
// wants collapsing: only the Annotation Kit is somewhere else, and the layers
// are split by what they catalog rather than by which library they read.
const LIBRARY = {
  components: 'the Pushpin kit',
  styles: 'the Pushpin kit',
  annotations: 'the Annotation Kit',
  icons: 'the Pushpin kit',
  variables: 'the Pushpin kit',
};

/**
 * How a live finding ends when it is relayed to a consumer.
 *
 * These sentences travel: `kit-state.mjs` persists them and every install reads
 * them back at session start, so the reader is a designer in a project, not the
 * maintainer whose token produced them. "Refreshing" meant something to the
 * maintainer and nothing to that reader, who cannot refresh the shipped capture
 * and should not try. What they can do is update the plugin, which is where the
 * re-capture lands, and — for the catalogs alone, when no release has landed
 * yet — take the project-local re-capture reference/refresh.md describes.
 * Tokens are not overlayable, so the variables sentence ends without that
 * second half.
 */
const BEHIND_REMEDY =
  "Pushpin's shipped capture is behind the kit, so updating the Pushpin plugin is the " +
  "first thing I'd do; if no update has landed yet, /pushpin refresh re-captures for " +
  'this project alone.';
const BEHIND_REMEDY_TOKENS =
  "Pushpin's shipped capture is behind the kit, so updating the Pushpin plugin is the " +
  "first thing I'd do.";
// The age and copy-source sentences end differently because nothing is known
// to have moved there, so no re-capture is owed yet; they name what would carry
// one rather than asking for it. The same reader: a consumer cannot re-pull.
const AGE_REMEDY =
  'nothing is known to have, and a Pushpin plugin update is what carries a newer ' +
  'capture when one lands';

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

// Three captures over two files — the icon page is swept separately from the
// rest of the Pushpin file — and each one ages on its own clock. The age limit
// is tested against the oldest of them: a current Annotation Kit says nothing
// about a Pushpin capture that has been sitting for two months.
//
// `label` is what the reader sees, and it is not `fileName`, because two of
// these carry the same one. Printing it twice with two dates beside it reads as
// a bug in the report rather than as two captures of one file.
const captures = [
  {
    fileName: manifest.figma.fileName,
    label: manifest.figma.fileName,
    capturedAt: manifest.capturedAt,
    ageDays: ageOf(manifest.capturedAt, 'capturedAt'),
  },
  {
    fileName: manifest.annotationKit.fileName,
    label: manifest.annotationKit.fileName,
    capturedAt: manifest.annotationKit.capturedAt,
    ageDays: ageOf(manifest.annotationKit.capturedAt, 'annotationKit.capturedAt'),
  },
  {
    fileName: manifest.iconLibrary.fileName,
    label: `${manifest.iconLibrary.fileName} icon page`,
    capturedAt: manifest.iconLibrary.capturedAt,
    ageDays: ageOf(manifest.iconLibrary.capturedAt, 'iconLibrary.capturedAt'),
  },
];

/**
 * The content design capture ages on its own clock and is deliberately not a
 * fourth member of `captures`.
 *
 * That array collapses to a single verdict over its oldest member, and the
 * sentence it hands the agent names a Figma file and tells the reader a token
 * or component may have moved. A rules file pulled from GitHub inheriting that
 * sentence would send someone to re-capture the kit to fix a blob — a wrong
 * instruction rather than a merely noisy one. It gets its own layer, its own
 * verdict, and its own sentence below.
 */
const copySource = manifest.copySource;
const copyAgeDays = ageOf(copySource.capturedAt, 'copySource.capturedAt');
const copyStale = copyAgeDays > maxAge;

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
  copySource: { ...copySource, ageDays: copyAgeDays },
  layers: [],
  findings: [],
  notes: [],
  brief: [],
  fix: [],
  project: null,
  /**
   * What the live layers found, by name, key and page, for the run that has to
   * act on it rather than read it. A finding names the first ten; this carries
   * every one, with the page each sits on, because a scoped re-capture is per
   * page and per component and the pipeline that takes one should not have to
   * ask Figma the same question twice. Only the layers whose re-capture is per
   * named entry: a style or variable finding is a whole-file capture, and there
   * is nothing to carry forward but the fact of it.
   */
  moved: Object.fromEntries(MOVED_LAYERS.map((n) => [n, { unpublished: [], changed: [] }])),
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
    ? `${oldest.label} ${agePhrase} — past the ${maxAge}-day refresh point`
    : `${oldest.label} last captured ${oldest.capturedAt}, ${agePhrase}`,
  ageStale ? 'stale' : 'ok',
);
if (ageStale) {
  report.findings.push(
    `The ${oldest.label} capture has not been taken in ${ageDays} days. Nothing is known ` +
      `to have changed — only that it has been long enough that nobody has checked, so ` +
      `re-capture it before trusting a value out of it.`,
  );
  // Keyed on the label rather than the file, because the icon page shares the
  // kit's file and not its sentence: the tokens are what "a token may have
  // moved" is about, and the icon capture is a separate sweep. Only the other
  // two are overlayable, so only they offer the project-local re-capture.
  report.brief.push(
    oldest.label === manifest.figma.fileName
      ? `Pushpin's copy of the Figma kit was pulled on ${prettyDate(oldest.capturedAt)}, so a token or component may have moved since — ${AGE_REMEDY}.`
      : `The ${oldest.label} was last pulled on ${prettyDate(oldest.capturedAt)}, so a component may have moved since — ${AGE_REMEDY}; /pushpin refresh re-captures it for this project alone.`,
  );
}

const pin = inspectPin(process.cwd(), { manifest, pluginVersion: PLUGIN.version });
report.project = pin;
if (pin) {
  if (pin.status === 'ok') {
    layer(
      'project pin',
      'pass',
      `plugin ${PLUGIN.version}, capture ${manifest.capturedAt}`,
    );
  } else {
    layer('project pin', 'fail', pin.details.join('; '), 'behind');
    report.findings.push(...pin.details);
    if (pin.brief) report.brief.push(pin.brief);
  }
}

/**
 * A project reading its own catalogs instead of the plugin's.
 *
 * Reported for the same reason `lookup` prints a line above its answer: an
 * overlay makes this project's idea of Button legitimately different from every
 * other project's, and a difference nobody is told about is the one that gets
 * debugged as a bug in the plugin. The layer passes — an overlay is a
 * deliberate act, not a finding — and fails only where the plugin has since
 * shipped something newer, which is the point at which holding it stops being
 * a repair and starts being a pin to a capture nobody diffed.
 */
report.overlay = overlay;
if (overlay?.broken) {
  layer('overlay', 'fail', `${join(overlay.dir, OVERLAY_MANIFEST)} could not be parsed`, 'broken');
  report.findings.push(
    `This project has a ${OVERLAY_REL} directory whose ${OVERLAY_MANIFEST} could not be parsed, ` +
      `so it is being ignored and the plugin's catalogs are being read instead.`,
  );
  report.brief.push(
    `This project's own Pushpin catalog capture cannot be read, so the plugin's is being read ` +
      `instead — /pushpin refresh re-captures it, or refresh.mjs --clear removes it.`,
  );
} else if (overlay?.files.length) {
  const superseded = overlay.files.filter((f) => {
    try {
      return supersededBy(overlay, captureDate(load(f)));
    } catch {
      return false;
    }
  });
  if (superseded.length) {
    layer('overlay', 'fail', `${superseded.join(', ')} superseded by the plugin`, 'superseded');
    report.findings.push(
      `This project reads its own capture of ${superseded.join(', ')} (${overlay.capturedAt}), ` +
        `and the plugin now ships a newer one. The shipped capture has been through diff and ` +
        `verify and is the one everyone else is on.`,
    );
    report.brief.push(
      `This project is pinned to its own Pushpin catalog capture and the plugin has since shipped a newer one — clearing the overlay with refresh.mjs --clear is the first thing I'd do.`,
    );
  } else {
    layer('overlay', 'pass', `${overlay.files.length} catalog(s) from this project, ${overlay.capturedAt}`);
  }
}

/**
 * The command that settles a repairable pin finding, so `--session` can hand
 * over the repair rather than the sentence describing it. `--no-share` because
 * the one file init writes that a team commits is `.claude/settings.json`, and
 * a repair nobody asked for has no business editing it. `--css-path` because a
 * plain `--write` still plans the stylesheet, at the path init derives, and
 * writes it there when that path is empty.
 */
function repairCommand() {
  let config = null;
  try {
    config = JSON.parse(readFileSync(join(process.cwd(), 'pushpin.config.json'), 'utf8'));
  } catch {
    // A repairable pin was read from this file a moment ago; a read that fails
    // now leaves the command as it was, and init reports on its own.
  }
  const args = ['--write', '--no-share', ...cssPathArgs(config)].map((a) =>
    a.includes(' ') ? `"${a}"` : a,
  );
  return `node "${join(here, 'init.mjs')}" "${process.cwd()}" ${args.join(' ')}`;
}

const repair = pin?.repairable ? repairCommand() : null;
if (repair) report.fix.push(repair);

/**
 * The pin finding init cannot settle, handed over the same way.
 *
 * A catalog that moved changes what the project's own markup is held against,
 * and there is nothing in `pushpin.config.json` to repair — rewriting the dates
 * would retire the finding without a declared component having been compared to
 * anything. `update` is the sweep that answers it, and it reports before it
 * writes, so handing it over costs the session a report rather than an edit.
 *
 * Never both this and `repair`: `catalog` is outside the repairable set, so a
 * pin carrying it is not repairable.
 */
const sweep = pin?.reasons?.includes('catalog')
  ? `node "${join(here, 'update.mjs')}"`
  : null;
if (sweep) report.fix.push(sweep);

// --------------------------------------------------------------- the environment

/**
 * Two signals that are not capture drift, said here because session start is
 * the only moment either one is free.
 *
 * They are findings rather than layers on purpose. The table answers whether
 * the committed captures still match what Figma serves, and neither of these
 * is about a capture — a missing Figma channel means nothing can be read out
 * of Figma at all, and a project pinned to an old copy of the plugin is running
 * different code, not an older capture. `report.findings` is already where a
 * signal that fits no single layer belongs.
 *
 * Only under `--session`, because every other form of this command reports
 * capture drift and its exit code is read by builds: a machine with no Figma
 * plugin installed has nothing wrong with its captures and should not start
 * failing.
 *
 * The version question is asked of the repository first and of the local
 * install records second, and only one of them is spoken. The repository's
 * `plugin.json` is what a release bumps, so a version ahead of `PLUGIN.version`
 * there is a release this session has not picked up, on either harness and
 * whatever the install layout. `pluginInstalls()` compares copies already on
 * this machine, answers on Claude Code only, and cannot see a release nobody
 * has installed yet — so it speaks only when the repository could not be
 * reached, where it is still the best answer available. A newer copy already
 * installed at the user level is also a newer release upstream, so the two
 * never disagree about whether to speak; they differ only in what the remedy
 * can name.
 *
 * `remote` is also what the kit-state layer below reads first, and it is null
 * inside the plugin's own tree and in any directory with no `pushpin.config.json`
 * above it: a checkout is not a consumer, and a folder that never opted in has
 * nowhere to cache.
 */
let remote = null;
if (session) {
  const harness = detectHarness();

  if (figmaMcp(harness, process.cwd()) === 'absent') {
    report.findings.push(FIGMA_MCP_ABSENT[harness]);
    report.brief.push(FIGMA_MCP_ABSENT[harness]);
  }

  remote = await remoteState({ from: process.cwd(), network: !offline });
  report.remote = remote
    ? {
        source: remote.source,
        fetchedAt: remote.fetchedAt,
        pluginVersion: remote.plugin?.version ?? null,
        kitState: remote.kitState
          ? { verdict: remote.kitState.verdict, observedAt: remote.kitState.observedAt }
          : null,
      }
    : null;
  const released = remote?.plugin?.version;
  if (released) {
    if (compareVersions(released, PLUGIN.version) > 0) {
      const line = pluginUpdateRemedy[harness]({ running: PLUGIN.version, newest: released });
      report.findings.push(line);
      report.brief.push(line);
    }
  } else {
    const installs = pluginInstalls(process.cwd(), harness);
    if (installs.state === 'behind') {
      report.findings.push(stalePluginRemedy(installs));
      report.brief.push(stalePluginRemedy(installs));
    }
  }
}

// -------------------------------------------------------------- live evidence

const token = process.env.FIGMA_TOKEN;
const fileKey = manifest.figma.fileKey;
const annotationFileKey = manifest.annotationKit.fileKey;
// The same key as `fileKey` today, and read from the manifest anyway rather
// than aliased to it. The question this layer asks is whether the icon
// catalog's own keys still resolve, so the file to ask is the one that catalog
// records having been captured from, and the manifest is where that is written
// down. Aliasing would move the icon layer silently the next time either one
// changes.
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
 * file key is passed in rather than read from the module scope: the Annotation
 * Kit is a second file and is granted separately, so a 404 that names the wrong
 * one sends the reader to the wrong permissions dialog.
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
 *
 * `counted` names what the two totals are totals *of*, which is not always the
 * layer: the component layer's totals are component sets, because that is the
 * only component figure the REST API and the capture both mean the same thing
 * by.
 *
 * `committed` rows are `[name, key, page]`, the page optional. It rides along
 * only to be written into `report.moved`; the comparison is on the key.
 */
function compareKeys(name, committed, liveKeys, expectedTotal, liveTotal, counted = name) {
  const missing = committed.filter(([, key]) => !liveKeys.has(key));
  if (missing.length) {
    layer(name, 'fail', `${missing.length} of ${committed.length} keys no longer published`);
    const one = missing.length === 1;
    const noun = one ? name.replace(/s$/, '') : name;
    report.findings.push(
      `${missing.length} ${noun} in the catalog ${one ? 'is' : 'are'} no ` +
        `longer published. Importing by key throws at runtime:\n` +
        missing
          .slice(0, 10)
          .map(([n]) => `    ${n}`)
          .join('\n') +
        (missing.length > 10 ? `\n    ...and ${missing.length - 10} more` : ''),
    );
    report.brief.push(
      `${one ? `A ${noun}` : `${missing.length} ${noun}`} in ${LIBRARY[name] ?? 'the kit'} ` +
        `${one ? 'is' : 'are'} no longer published, so a generation run against ` +
        `${one ? 'it' : 'them'} dies partway rather than at review. ${BEHIND_REMEDY}`,
    );
    if (report.moved[name]) {
      report.moved[name].unpublished = missing.map(([n, key, page]) => ({
        name: n,
        key,
        page: page ?? null,
      }));
    }
    return;
  }
  layer(name, 'pass', `all ${committed.length} keys still published`);
  if (expectedTotal != null && liveTotal !== expectedTotal) {
    const delta = liveTotal - expectedTotal;
    report.notes.push(
      `The file publishes ${liveTotal} ${counted} where the capture recorded ${expectedTotal} ` +
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

// The layers FIGMA_TOKEN gates, which is not the same set as the layers that
// touch the network. The copy source is checked over the network too, against
// GitHub and on a different credential, so it stays out of this list: in it, an
// absent FIGMA_TOKEN would skip a layer that never wanted one, and the "the
// token reached nothing" note at the bottom would count a layer the token was
// never offered to.
const NETWORK_LAYERS = ['components', 'styles', 'variables', 'annotations', 'icons'];

/**
 * The overlay file that answers each kit-state layer, for the project that has
 * already re-captured what the verdict is about.
 *
 * Only the layers an overlay can hold. `capture age`, `styles`, `variables` and
 * `copy source` are not overlayable and stay whatever the verdict says.
 */
const OVERLAY_FOR_LAYER = {
  components: 'components.figma.json',
  icons: 'icons.figma.json',
  annotations: 'annotations.figma.json',
};

/**
 * Whether this project's own capture of a layer is at least as new as the
 * verdict about it. A verdict observed on Tuesday about a catalog this project
 * re-captured on Tuesday or later is describing a state the project has already
 * left, and repeating it every session is the nag reference/refresh.md exists
 * to end.
 */
function coveredByOverlay(layerName, observedAt) {
  const file = OVERLAY_FOR_LAYER[layerName];
  const own = file && overlayPath(overlay, file);
  if (!own || !observedAt) return false;
  try {
    const date = captureDate(JSON.parse(readFileSync(own, 'utf8')));
    return Boolean(date) && date >= observedAt;
  } catch {
    return false;
  }
}

/**
 * What the scheduled check last found, for the run that cannot ask Figma
 * itself.
 *
 * Only when no live layer ran. A recorded verdict is yesterday's answer to the
 * question the token answers now, so where both exist the live one wins outright
 * and reporting the recording beside it would double every finding.
 *
 * `readKitState` returns null once any capture date has moved past the one the
 * verdict was formed against, which is what stops a refresh being nagged about
 * until the next scheduled run. The repository's copy is offered first, since
 * it is the later observation, and the shipped copy is the fallback; each is
 * held to the same expiry, so a repository verdict formed about a release this
 * install has not picked up is ignored rather than misapplied. Where both
 * apply, the later observation wins.
 *
 * The verdict's sentences are pushed only where this run has not already said
 * them. The scheduled run computes the capture age from the same manifest, so
 * a stale-age sentence it recorded is word for word the one the age layer above
 * has just produced, and a session that said it twice would be quoting itself.
 *
 * The layers this project has since re-captured for itself drop out, and when
 * none remain the layer passes. The sentences are not split the same way — the
 * verdict records them flat — so a verdict about two layers of which the
 * project has overlaid one keeps its sentences and names the remainder in the
 * detail. That case has not arisen; the one-layer verdict is the one that
 * nagged.
 */
function reportRecordedState(candidate) {
  const applicable = [candidate ? readKitState(candidate) : null, readKitState()]
    .filter(Boolean)
    .sort((a, b) => String(b.observedAt ?? '').localeCompare(String(a.observedAt ?? '')));
  const state = applicable[0];
  if (!state) return;
  if (state.verdict !== 'moved') {
    layer('kit state', 'pass', `checked against Figma ${state.observedAt}, nothing had moved`);
    return;
  }
  const covered = (state.layers ?? []).filter((l) => coveredByOverlay(l, state.observedAt));
  const remaining = (state.layers ?? []).filter((l) => !covered.includes(l));
  if (!remaining.length) {
    layer(
      'kit state',
      'pass',
      `${covered.join(', ')} moved as of ${state.observedAt}; this project's own capture is ` +
        `at least as new`,
    );
    return;
  }
  layer(
    'kit state',
    'fail',
    `${remaining.join(', ')} — as of ${state.observedAt}` +
      (covered.length ? ` (${covered.join(', ')} covered by this project's own capture)` : ''),
    'moved',
  );
  for (const f of state.findings ?? []) if (!report.findings.includes(f)) report.findings.push(f);
  for (const b of state.brief ?? []) if (!report.brief.includes(b)) report.brief.push(b);
}

// `--session` skips the token layers whether or not a token is in the
// environment. Session start runs before anything the user asked for, in every
// project, and five Figma calls there would be paid on every prompt by whoever
// happens to hold a token in their shell — the cost the scheduled check exists
// to take once for everyone.
if (offline || session) {
  const why = offline ? '--offline' : '--session';
  for (const name of NETWORK_LAYERS) layer(name, 'skipped', why);
  reportRecordedState(remote?.kitState);
} else if (!token) {
  const why = 'FIGMA_TOKEN is not set';
  for (const name of NETWORK_LAYERS) layer(name, 'skipped', why);
  reportRecordedState();
  report.notes.push(
    'No Figma layer ran. For the stronger answer — whether our component, style ' +
      'and icon keys still exist in the kit, and our annotation keys in the Annotation ' +
      'Kit — create a personal access token at figma.com > Settings > Security with the ' +
      'library_content:read scope, ' +
      'then re-run with FIGMA_TOKEN set.',
  );
} else {
  /**
   * Published component keys for one file, from both component endpoints.
   *
   * A component set publishes under its own key in `/component_sets`, while
   * `/components` lists the individual variants. Catalog entries of type
   * COMPONENT_SET carry the set's key, so checking `/components` alone would
   * report every set as unpublished — 97 of Pushpin's 115 entries and 70 of the
   * Annotation Kit's 91.
   *
   * `setCount` is the figure worth comparing against the capture. The catalog's
   * `publishedSets` counts the component sets `getPublishStatusAsync()` called
   * published, and `/component_sets` lists exactly those — one entry per set,
   * like for like. `/components` cannot be compared to anything the catalog
   * holds, because it enumerates variants: 98 published sets appear there as
   * their hundreds of children.
   *
   * `ours` narrows the `updated_at` sweep to keys the catalog actually depends
   * on, and the two Pushpin layers make it load-bearing rather than tidy: the
   * kit publishes its components and its 900 icons from one library, so an
   * unnarrowed sweep would report every icon edit as component drift and every
   * component edit as icon drift. It also drops the work neither catalog keeps —
   * the kit publishes 118 components the component catalog reduces to 115 —
   * which would otherwise send the reader re-capturing for nothing.
   *
   * `edited` carries the name and key beside the date for those same entries.
   * The names are already in this payload, and reducing them to a single date
   * is what made a run say "a component changed" and leave the reader to find
   * out which — the answer a re-capture has to start from. The key is what
   * joins each one back to its catalog entry, and so to its page.
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
    const mine = both.filter((c) => (!ours || ours.has(c.key)) && c.updated_at);
    return {
      keys: new Set(both.map((c) => c.key)),
      setCount: liveSets.length,
      edited: mine.map((c) => ({ name: c.name, key: c.key, updatedAt: c.updated_at })),
    };
  }

  /**
   * A catalog's entries by import key, for joining a live payload back to the
   * name the catalog uses and the page it was captured from. `page` is passed
   * for a catalog that records one page for the whole file rather than one per
   * entry, which is what the icon catalog does.
   */
  const indexByKey = (entries, page) =>
    new Map(entries.map(([name, e]) => [e.key, { name, page: page ?? e.page ?? null }]));

  /**
   * A component that changed after the capture is a real risk even when its key
   * survives, because variant options and property keys move underneath a
   * stable key and a changed property key breaks setProperties.
   *
   * The names are the point. A re-capture is per page and per component, so
   * "something changed" leaves the reader to rediscover what this call already
   * knew — and the pages those names sit on are exactly the argument the spec
   * capture takes. `report.moved` gets every one, under the catalog's name for
   * it rather than the kit's current one, because the catalog's name is the one
   * a consumer's markup declares and the spec catalog is keyed by.
   */
  const NAME_CAP = 12;
  function flagLateEdits(forLayer, edited, since, what, index = new Map()) {
    const changed = (edited ?? [])
      .filter((c) => c.updatedAt.slice(0, 10) > since)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!changed.length) return;

    const on = changed[0].updatedAt.slice(0, 10);
    const names = changed.map((c) => c.name);
    const shown = names.slice(0, NAME_CAP);
    const rest = names.length - shown.length;
    const count = `${names.length} component${names.length === 1 ? '' : 's'}`;

    escalate(forLayer, `keys intact, but ${count} changed since ${since}`);
    report.findings.push(
      `${count} in ${what} changed after the capture (${since}), most recently on ${on}. ` +
        `Every import key still resolves, but variant options and property keys may have ` +
        `moved, and a changed property key breaks setProperties:\n` +
        shown.map((n) => `   ${n}`).join('\n') +
        (rest ? `\n   …and ${rest} more` : ''),
    );
    report.brief.push(
      `${shown.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''} ` +
        `changed in ${what} after Pushpin's capture, so a generation run against ` +
        `${names.length === 1 ? 'it' : 'them'} may die partway rather than at review. ${BEHIND_REMEDY}`,
    );
    if (report.moved[forLayer]) {
      report.moved[forLayer].changed = changed.map((c) => ({
        name: index.get(c.key)?.name ?? c.name,
        key: c.key,
        page: index.get(c.key)?.page ?? null,
        updatedAt: c.updatedAt,
      }));
    }
  }

  // Components. Any plan, library_content:read scope. The catalog holds one entry per
  // published name, which is fewer entries than the file publishes components,
  // so the count is a note and the key existence is the check.
  const live = await publishedComponents(
    fileKey,
    'components',
    new Set(real(catalog.components).map(([, c]) => c.key)),
  );
  if (live) {
    compareKeys(
      'components',
      real(catalog.components).map(([n, c]) => [n, c.key, c.page ?? null]),
      live.keys,
      catalog.source?.publishedSets,
      live.setCount,
      'component sets',
    );
    // The components catalog is captured separately from the tokens, and
    // `manifest.capturedAt` is the tokens' date. Dating this layer by it reports
    // every component edit made between the two captures as drift the catalog
    // does not have.
    flagLateEdits(
      'components',
      live.edited,
      catalog.source?.extractedAt ?? capturedAt,
      'the kit',
      indexByKey(real(catalog.components)),
    );
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
      report.brief.push(
        `A token in the Pushpin kit has moved since Pushpin's capture, so a value quoted ` +
          `from it may be wrong. ${BEHIND_REMEDY_TOKENS}`,
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
  const liveAnnotations = await publishedComponents(
    annotationFileKey,
    'annotations',
    new Set(real(annotationCatalog.components).map(([, c]) => c.key)),
  );
  if (liveAnnotations) {
    compareKeys(
      'annotations',
      real(annotationCatalog.components).map(([n, c]) => [n, c.key, c.page ?? null]),
      liveAnnotations.keys,
      null,
      liveAnnotations.componentCount,
    );
    flagLateEdits(
      'annotations',
      liveAnnotations.edited,
      manifest.annotationKit.capturedAt,
      'the Annotation Kit',
      indexByKey(real(annotationCatalog.components)),
    );
  }

  // Icons. Same file as the components layer, same endpoints, and a second call
  // rather than a reuse of the first: `ours` narrowed that one to the component
  // catalog's keys, which is the whole point of it, so the icon keys were never
  // in it. Every icon is a plain COMPONENT rather than a set, so `/components`
  // alone would do — but publishedComponents also gives the `updated_at` sweep,
  // and an icon redrawn after the capture is worth knowing about even when its
  // key survives.
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
    flagLateEdits(
      'icons',
      liveIcons.edited,
      manifest.iconLibrary.capturedAt,
      'the icon set',
      new Map(iconKeyPairs.map(([name, key, page]) => [key, { name, page }])),
    );
  }

  // A token that reaches nothing is worse than no token, because the run still
  // ends in a reassuring sentence. Say plainly that it proved nothing.
  const networkLayers = report.layers.filter((l) => NETWORK_LAYERS.includes(l.name));
  if (networkLayers.every((l) => l.status === 'skipped')) {
    report.notes.push(
      'FIGMA_TOKEN was set but no layer could use it, so this run proved nothing beyond ' +
        'the capture dates. Check the token is current and carries the ' +
          'library_content:read scope.',
    );
  }
}

// ---------------------------------------------------------------- copy source

const githubToken = process.env.GITHUB_TOKEN;

/**
 * The blob sha GitHub serves for the source path now.
 *
 * The repo is public and this would answer unauthenticated, but it is gated on
 * GITHUB_TOKEN anyway. The anonymous rate limit is sixty an hour against the
 * whole IP, and a check that can run at every session start is the wrong thing
 * to spend it on — it would surface much later as an unexplained 403 in
 * somebody else's build.
 */
async function upstreamBlob() {
  const url =
    `https://api.github.com/repos/${copySource.repo}/contents/` +
    `${copySource.path}?ref=${copySource.ref}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'pushpin-freshness',
        Authorization: `Bearer ${githubToken}`,
      },
    });
    if (!res.ok) return { ok: false, why: `${res.status} from GitHub` };
    const meta = await res.json();
    if (!meta?.sha) return { ok: false, why: 'GitHub returned no sha' };
    return { ok: true, sha: meta.sha };
  } catch (e) {
    return { ok: false, why: `could not reach GitHub: ${e.message}` };
  }
}

// Under `--session` the network budget is the one cached fetch remote-state
// made, so this GitHub call is skipped alongside the Figma ones.
const blob = offline
  ? { ok: false, why: '--offline' }
  : session
    ? { ok: false, why: '--session' }
    : !githubToken
      ? { ok: false, why: 'GITHUB_TOKEN is not set' }
      : await upstreamBlob();

// A matching sha is strictly stronger than the age it replaces: an untouched
// blob is an untouched blob whatever month it was captured in.
if (blob.ok && blob.sha !== copySource.sha) {
  layer(
    'copy source',
    'fail',
    `upstream is ${blob.sha.slice(0, 12)}, the capture is ${copySource.sha.slice(0, 12)}`,
  );
  report.findings.push(
    `${copySource.repo}/${copySource.path} has moved since the capture on ` +
      `${copySource.capturedAt}:\n` +
      `    committed  ${copySource.sha}\n` +
      `    upstream   ${blob.sha}\n` +
      `    Re-run: node scripts/pull-copy.mjs && node scripts/build-copy.mjs`,
  );
  report.brief.push(
    `The content design rules moved upstream after Pushpin's copy of them was pulled on ${prettyDate(copySource.capturedAt)}, so a copy rule I apply may be out of date — a Pushpin plugin update is what carries the re-pull when one lands.`,
  );
} else if (blob.ok) {
  layer('copy source', 'pass', `blob ${blob.sha.slice(0, 12)} unchanged upstream`);
} else {
  layer(
    'copy source',
    copyStale ? 'fail' : 'pass',
    copyStale
      ? `${copySource.repo} ${phraseFor(copyAgeDays)} — past the ${maxAge}-day refresh point`
      : `${copySource.repo} last captured ${copySource.capturedAt}, ` +
          `${phraseFor(copyAgeDays)} — age only, ${blob.why}`,
    copyStale ? 'stale' : 'ok',
  );
  if (copyStale) {
    report.findings.push(
      `The content design rules have not been pulled in ${copyAgeDays} days. Nothing is ` +
        `known to have changed — only that nobody has asked GitHub — so re-pull them ` +
        `before trusting a rule quoted out of them.`,
    );
    report.brief.push(
      `Pushpin's copy of the content design rules was pulled on ${prettyDate(copySource.capturedAt)}, so a rule may have changed since — ${AGE_REMEDY}.`,
    );
  }
}

// --------------------------------------------------------------------- report

const skipped = report.layers.filter((l) => l.status === 'skipped');
const failed = report.layers.filter((l) => l.status === 'fail');
const checked = report.layers.filter((l) => l.status !== 'skipped');

// Excused layers still report as skipped everywhere else, because they were
// skipped; the only thing --allow-skip changes is whether that fails the run.
const unexcused = skipped.filter((l) => !allowSkip.has(l.name));

// Named in the report so a consumer can render a pass as a pass. Without this a
// run that succeeded still reads "1 of 7 layers did not pass", which is the
// species of misleading summary this file exists to stamp out.
report.excused = skipped.filter((l) => allowSkip.has(l.name)).map((l) => l.name);

// A finding is the unit of "something needs doing", so it governs the exit code
// rather than the layer tally. The two agree today; making findings
// authoritative means a future signal that fits no single layer cannot slip out
// as a green run with a warning nobody reads.
report.stale = failed.length > 0 || report.findings.length > 0;
report.exitCode = report.stale || (strict && unexcused.length) ? 1 : 0;

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}

if (session) {
  // A finding the fix settles is not also spoken. Saying "this project's edit
  // check is missing" and then repairing it in the same breath is two lines
  // where the right number is none.
  //
  // `repair` settles the pin's whole sentence by construction, since every
  // reason behind it is repairable. `sweep` settles it only when the sentence
  // is the catalog one — which it is whenever `catalog` outranks the other
  // reasons present, the version bump beside every release included, and the
  // sentence would otherwise tell the user to run the command the fix: line is
  // already running. A pin whose sentence speaks for a higher-ranked reason
  // keeps it: that finding is one update does not touch.
  const settled = repair || (sweep && pin.briefReason === 'catalog');
  const say = settled ? report.brief.filter((b) => b !== pin.brief) : report.brief;
  for (const f of report.fix) console.log(`fix: ${f}`);
  for (const s of say) console.log(`say: ${s}`);
  process.exit(0);
}

if (brief) {
  if (report.brief.length) console.log(report.brief.join('\n'));
  process.exit(report.exitCode);
}

const namePad = Math.max(...report.layers.map((l) => l.name.length));
const markPad = Math.max(...report.layers.map((l) => l.mark.length));
for (const c of captures) {
  console.log(`${c.label} — captured ${c.capturedAt}, ${phraseFor(c.ageDays)}`);
}
console.log(
  `${copySource.repo} — captured ${copySource.capturedAt}, ${phraseFor(copyAgeDays)}`,
);
console.log('');
for (const l of report.layers) {
  console.log(`  ${l.mark.padEnd(markPad)}  ${l.name.padEnd(namePad)}  ${l.detail}`);
}

for (const line of [...report.findings, ...report.notes]) console.log(`\n  ${line}`);
console.log('');

if (report.stale) {
  // Two chains end here, and the closing instruction has to name the right one.
  // Sending someone to re-capture Figma because a markdown file on GitHub moved
  // is worse than saying nothing.
  const copyOnly = failed.length > 0 && failed.every((l) => l.name === 'copy source');
  console.log(
    copyOnly
      ? `Re-capture the rules: node scripts/pull-copy.mjs && node scripts/build-copy.mjs`
      : `Run the captures in scripts/check.md, then: node scripts/diff.mjs --kit kit.json`,
  );
  process.exit(1);
}
if (strict && unexcused.length) {
  const excused = skipped.length - unexcused.length;
  console.error(
    `--strict: ${unexcused.length} of ${report.layers.length} layers could not be checked` +
      `${excused ? ` (${excused} excused by --allow-skip)` : ''}: ` +
      `${unexcused.map((l) => l.name).join(', ')}.`,
  );
  process.exit(1);
}
console.log(
  checked.length === report.layers.length
    ? `Every layer checked. Nothing has moved since ${oldest.capturedAt}.`
    : `Nothing moved in the ${checked.length} layer${checked.length === 1 ? '' : 's'} that could ` +
        `be checked. ${skipped.length} skipped.`,
);

#!/usr/bin/env node
/**
 * Distills the per-page visual-spec capture into
 * assets/component-specs.figma.json — what a published component actually looks
 * like, per variant option.
 *
 * `components.figma.json` is built from the Code Connect dump, which carries the
 * property API and no geometry at all. It can say Button's `theme` accepts
 * `secondary`; it has never been able to say what `secondary` looks like. That
 * silence is what a spec gets guessed into, and the guess named a border token
 * the kit does not publish while missing the one it does. This is a separate
 * capture because it has a separate source: one `use_figma` read per page,
 * fanned out per reference/parallel.md, rather than one dump for the file.
 *
 * Input is one or more lane files, each `{ group, lanes, components }` as
 * produced by the read in scripts/extract.md § Component visual specs. Several
 * lanes are merged rather than one file being required, because the read is a
 * fan-out across 44 pages and holding it in one response truncates.
 *
 * Usage: node scripts/build-specs.mjs <lane.json> [<lane.json>...]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPECS_FILE } from './lib/specs.mjs';
import { loadAsset, real, resolveHex } from './lib/tokens.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** See build-components.mjs — the same reason, for the same consumer path. */
const outFlag = process.argv.indexOf('--out');
const OUT =
  outFlag === -1
    ? join(here, '..', 'assets', 'component-specs.figma.json')
    : resolve(process.argv[outFlag + 1]);

/**
 * Per-set cap, and the number is not arbitrary. Button carries 260 real variant
 * children against a 960-combination cross product, and its axes offer 21
 * options between them. A cap sized to options rather than to children is what
 * keeps the capture proportional to what can be asked of it: nobody asks what
 * the 137th combination looks like, and one record per option answers every
 * question a `data-pp-variant` declaration can pose.
 */
export const CAP = 24;

/**
 * Merge the lanes, and account for what each one did.
 *
 * Two pages really can publish the same name — the kit has a `Tabs` on
 * `Additional components` and another on `Tabs`, six children against ten — and
 * the catalog keys by name too, so it holds one of each pair and names the
 * loser in `source.nameCollisions`. Resolving by lane order here would make
 * which one survives depend on the order the files were globbed in, so the
 * catalog's own node id decides and the loser is recorded by name, page and
 * node id. The silent overwrite is the failure this capture exists to stop, and
 * doing it again while capturing the evidence for it would be a poor joke.
 */
/**
 * Did this lane leave anything on its page unread?
 *
 * Answered from the owner count where the lane reports one, because that is the
 * reading a truncated or `ONLY`-filtered response cannot fake: `recorded` is
 * what came back and `expected` is what the page holds. `skipped` is the
 * fallback and is deliberately tolerant of both a list of names and a bare
 * count — a lane that shortened it to a number is the same statement, and
 * reading `.length` off the number would silently report the page as whole.
 */
function isPartial(lane) {
  const recorded = (lane.recorded ?? []).length;
  if (typeof lane.expected === 'number') return recorded < lane.expected;
  if (Array.isArray(lane.skipped)) return lane.skipped.length > 0;
  if (typeof lane.skipped === 'number') return lane.skipped > 0;
  return false;
}

export function distillSpecs(files, catalog) {
  const components = {};
  const pages = new Map();
  const collisions = [];
  const notes = [];

  for (const file of files) {
    for (const lane of file.lanes ?? []) {
      const held = pages.get(lane.pageId ?? lane.figmaPage);
      pages.set(lane.pageId ?? lane.figmaPage, {
        page: lane.figmaPage,
        status: lane.status,
        recorded: (lane.recorded ?? []).length,
        expected: lane.expected ?? null,
        // A lane run with an `ONLY` list reads part of a page, and `Additional
        // components` has to be read that way — 41 owners truncate the response.
        // A merge may only evict a page it saw whole, so a lane that left an
        // owner unread marks the page partial, and it stays partial until some
        // lane in the same run covers the whole thing.
        partial: (held ? held.partial : true) && isPartial(lane),
      });
      if (lane.note) notes.push(`${lane.figmaPage}: ${lane.note}`);
      if (lane.status !== 'ok') notes.push(`${lane.figmaPage}: status ${lane.status}`);
      // A collision the capture script hit inside one page, which the merge
      // below cannot see: the loser never left the plugin. Carried through
      // verbatim so a spec missing for that reason is a recorded fact rather
      // than an owner count nobody compared against a key count.
      for (const c of lane.collisions ?? []) {
        collisions.push(
          `"${c.name}" is published twice on "${lane.figmaPage}" — kept ${c.kept}, ` +
            `dropped ${c.dropped}; the capture script reached only one of them`,
        );
      }
    }
    for (const [name, entry] of Object.entries(file.components ?? {})) {
      // A spec for something the catalog does not hold is a spec for something
      // that cannot be placed. The capture used to select owners by name, and
      // recorded four components the library never published; the catalog now
      // gates on publish status, so this is where a capture taken before that
      // change — or one that reached an unpublished owner anyway — stops.
      if (!(name in catalog)) {
        notes.push(`${name}: recorded by the capture but not in the component catalog; dropped`);
        continue;
      }
      const held = components[name];
      if (!held) {
        components[name] = entry;
        continue;
      }
      const canonical = catalog[name]?.nodeId;
      const keep = canonical === entry.nodeId ? entry : held;
      const drop = keep === entry ? held : entry;
      collisions.push(
        `"${name}" is published twice — kept ${keep.nodeId} on "${keep.page}"` +
          `${canonical === keep.nodeId ? ' (the one the catalog names)' : ' (neither matches the catalog)'}` +
          `, dropped ${drop.nodeId} on "${drop.page}"`,
      );
      components[name] = keep;
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(components)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, entry]) => [name, order(entry)]),
  );
  // Sorted so the asset is a function of the capture and not of the order the
  // lane files happened to be listed in — the same reason the merge above does
  // not let file order decide a collision.
  return {
    components: sorted,
    pages: [...pages.values()],
    collisions: collisions.sort(),
    notes: notes.sort(),
  };
}

/** A stable key order, so a re-capture diffs against the last one line by line. */
function order(entry) {
  const out = {};
  for (const k of ['type', 'page', 'nodeId', 'axes', 'defaults', 'children', 'crossProduct', 'recorded', 'reduced', 'unreachable']) {
    if (entry[k] !== undefined) out[k] = entry[k];
  }
  if (entry.resting) out.resting = entry.resting;
  if (entry.variants) out.variants = entry.variants;
  return out;
}

/**
 * A component set with no all-defaults child recorded.
 *
 * Every consumer needs the resting appearance: a per-option line in DESIGN.md
 * is a difference from it, and a bare `--variant` asks for it directly. The
 * capture picks representatives one axis option at a time, so the all-defaults
 * child is reached through whichever axis lists its default first — and a set
 * whose options overflow the cap before that happens loses it. Naming those
 * here is what makes the gap a re-read rather than a wrong answer downstream.
 */
export function withoutResting(components) {
  return Object.entries(components)
    .filter(([, e]) => e.type === 'COMPONENT_SET')
    .filter(([, e]) => !(e.variants ?? []).some((v) => Object.keys(v.props ?? {}).length === 0))
    .map(([name]) => name);
}

/**
 * Which mode the recorded colour literals are in, and whether any disagree.
 *
 * The kit's component pages render in one mode and the capture records what it
 * sees, so `background/brand/strong` comes back `#07344a` — the Light value —
 * and not the token's Dark `#36ccfa`. A reader who takes a captured hex for a
 * mode-independent fact writes a light-mode colour into a dark-mode theme, so
 * the mode is stated rather than left to be inferred, and any literal that
 * matches neither mode is named.
 */
export function colorModeCheck(components) {
  const tokens = loadAsset('tokens.figma.json');
  const counts = { Light: 0, Dark: 0 };
  const off = [];

  const look = (where, v) => {
    if (!Array.isArray(v) || typeof v[0] !== 'string') return;
    if (v[0] !== 'Tokens / Semantic Colors' || typeof v[2] !== 'string') return;
    const seen = v[2].toLowerCase().slice(0, 7);
    const light = resolveHex(tokens, v[1], 'Light')?.toLowerCase();
    const dark = resolveHex(tokens, v[1], 'Dark')?.toLowerCase();
    if (seen === light) counts.Light++;
    else if (seen === dark) counts.Dark++;
    else off.push(`${where} ${v[1]} rendered ${seen}, Light ${light ?? '?'} / Dark ${dark ?? '?'}`);
  };

  for (const [name, entry] of Object.entries(components)) {
    for (const v of [entry.resting, ...(entry.variants ?? [])].filter(Boolean)) {
      const where = `${name}${v.for ? ` ${v.for[0]}` : ''}`;
      look(where, v.fill);
      look(where, v.stroke);
      look(where, v.text?.fill);
    }
  }
  const mode = counts.Light >= counts.Dark ? 'Light' : 'Dark';
  return { mode, counts, off };
}

/**
 * Fold a partial re-capture into the committed asset.
 *
 * The full read is 44 pages and roughly 400KB, which is why a component whose
 * geometry moved used to leave the whole file stale: refreshing one page meant
 * retaking all of them, because this script writes what the lanes hold and
 * nothing else. Merging keeps the pages nobody recaptured and states, per page,
 * when each was last read — so a partial refresh is legible as partial rather
 * than dated wholesale by the day it was folded in.
 *
 * A page is replaced entirely, not patched: every base entry sitting on a
 * recaptured page is dropped before the fresh ones go in, so a component that
 * left the page leaves the asset with it. Entries are also evicted by name,
 * which is what carries a page rename — `📌 Button` became `Button` and the
 * base entry would otherwise survive beside its own replacement.
 */
function mergeWithCommitted(fresh, freshPages, catalogEntries) {
  const base = loadAsset(SPECS_FILE);
  const wholePages = new Set(freshPages.filter((p) => !p.partial).map((p) => p.page));
  const capturedPages = new Set(freshPages.map((p) => p.page));
  const merged = {};
  const carried = [];

  for (const [name, entry] of Object.entries(base.components)) {
    if (name in fresh) continue;
    if (wholePages.has(entry.page)) continue;
    // A base entry can outlive its own catalog record — the catalog is refreshed
    // on a different cadence — and verify.mjs fails on a spec with no catalog
    // entry. Dropping it here keeps a merge from carrying a failure forward.
    if (!(name in catalogEntries)) continue;
    merged[name] = entry;
    carried.push(name);
  }
  Object.assign(merged, fresh);

  const sorted = Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)),
  );
  const today = new Date().toISOString().slice(0, 10);
  const pageCaptures = { ...(base.source.pageCaptures ?? {}) };
  // A base with no per-page record predates this path; every page it holds was
  // read on the date it carries, and saying so is what makes the first merge
  // honest about the 43 pages it did not touch.
  if (!base.source.pageCaptures) {
    for (const entry of Object.values(base.components)) {
      pageCaptures[entry.page] = base.source.extractedAt;
    }
  }
  // Only a page read whole gets today's date. A page read under an `ONLY` list
  // is no fresher than the part nobody re-read, and dating it today would hide
  // exactly the staleness this record exists to show.
  for (const page of wholePages) pageCaptures[page] = today;
  for (const name of Object.keys(sorted)) pageCaptures[sorted[name].page] ??= today;

  const partial = [...capturedPages].filter((p) => !wholePages.has(p));
  return { components: sorted, pageCaptures, carried, partial };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

function main() {
  const argv = process.argv.slice(2);
  const merge = argv.includes('--merge');
  const out = argv.indexOf('--out');
  const paths = (out === -1 ? argv : [...argv.slice(0, out), ...argv.slice(out + 2)]).filter(
    (a) => a !== '--merge',
  );
  if (!paths.length) {
    console.error(
      'usage: node scripts/build-specs.mjs <lane.json> [<lane.json>...]\n' +
        '       node scripts/build-specs.mjs --merge <lane.json> [<lane.json>...]',
    );
    process.exit(1);
  }

  const files = paths.map((p) => JSON.parse(readFileSync(p, 'utf8')));
  const catalogEntries = loadAsset('components.figma.json').components;
  const distilled = distillSpecs(files, catalogEntries);
  const { pages, collisions, notes } = distilled;
  let components = distilled.components;
  let pageCaptures = null;
  let carried = [];
  let partialPages = [];
  if (merge) {
    const m = mergeWithCommitted(components, pages, catalogEntries);
    components = m.components;
    pageCaptures = m.pageCaptures;
    carried = m.carried;
    partialPages = m.partial;
  }

  const entries = Object.values(components);
  const sets = entries.filter((e) => e.type === 'COMPONENT_SET');
  const variants = sets.reduce((n, e) => n + (e.variants?.length ?? 0), 0);
  const children = sets.reduce((n, e) => n + (e.children ?? 0), 0);
  const capped = sets.filter((e) => e.reduced?.cappedAt).length;

  // Which of the published catalog got a spec, and which did not. The catalog
  // is the list a `data-pp-component` declaration is checked against, so a name
  // in it with no spec is exactly where a reader falls back to guessing.
  const catalog = real(catalogEntries).map(([n]) => n);
  const missing = catalog.filter((n) => !(n in components));
  const noResting = withoutResting(components);
  const offMode = colorModeCheck(components);

  const doc = {
    $comment:
      'Per-variant visual specs for published Pushpin components — fill, stroke, radius, ' +
      'size, padding and the first text descendant, as they render in the kit. A bound ' +
      'variable is recorded as [collection, name, literal]: the collection and name ' +
      'verbatim from Figma, and the value that renders beside them. Several bindings have ' +
      'no --pp-* counterpart and inventing one is the defect this capture exists to remove, ' +
      'so resolution happens in scripts/lib/specs.mjs against tokens.figma.json. Generated — ' +
      'see scripts/build-specs.mjs, and scripts/extract.md § Component visual specs for the read.',
    source: {
      fileKey: 'VVRGrLgkPRU3vs765d5Q3r',
      fileName: 'Pushpin Thumbprint UI Kit',
      extractedAt: new Date().toISOString().slice(0, 10),
      pagesRead: pageCaptures ? Object.keys(pageCaptures).length : pages.length,
      componentsRecorded: entries.length,
      componentSets: sets.length,
      capPerSet: CAP,
      realVariantChildren: children,
      variantsRecorded: variants,
      setsAtCap: capped,
      colorMode: offMode.mode,
      // `extractedAt` dates the distillation, which on a merged asset says
      // nothing about the pages the run did not read. This is the per-page
      // truth, and the oldest date in it is the real age of the capture.
      ...(pageCaptures ? { pageCaptures } : {}),
    },
    coverage: {
      // Measured against components.figma.json, which is itself keyed by name
      // and holds one entry per name — so "113 of 115" means names the catalog
      // holds, not components the kit publishes. A name published twice counts
      // once in both and cannot appear in `withoutSpec` at all.
      // `nameCollisions` and `captureNotes` are where that gap is legible;
      // `withSpec` alone would read as completeness it does not have.
      measuredAgainst: 'components.figma.json',
      catalogComponents: catalog.length,
      withSpec: catalog.length - missing.length,
      withoutSpec: missing,
      ...(noResting.length ? { withoutRestingVariant: noResting } : {}),
      ...(collisions.length ? { nameCollisions: collisions } : {}),
      ...(offMode.off.length ? { coloursMatchingNeitherMode: offMode.off } : {}),
      ...(notes.length ? { captureNotes: notes } : {}),
    },
    components,
  };

  writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  console.log(
    `Wrote ${OUT} — ${entries.length} components across ` +
      `${pageCaptures ? Object.keys(pageCaptures).length : pages.length} pages, ` +
      `${variants} variants recorded of ${children} real children, ${capped} sets at the cap of ${CAP}.`,
  );
  if (merge) {
    const oldest = Object.values(pageCaptures).sort()[0];
    console.log(
      `  merged ${pages.length} recaptured page(s) into the committed asset; ` +
        `${carried.length} component(s) carried through, oldest page read ${oldest}.`,
    );
    for (const page of partialPages) {
      console.log(
        `  "${page}" was read under an ONLY list — only the components it named were ` +
          `replaced, and the page keeps its earlier capture date.`,
      );
    }
  }
  console.log(
    `  colours read in ${offMode.mode} mode (${offMode.counts.Light} Light, ${offMode.counts.Dark} Dark` +
      `${offMode.off.length ? `, ${offMode.off.length} matching neither` : ''}).`,
  );
  if (missing.length) console.log(`  ${missing.length} catalog components have no spec.`);
  if (noResting.length) console.log(`  no resting variant recorded for: ${noResting.join(', ')}`);
  for (const c of collisions) console.log(`  ${c}`);
}

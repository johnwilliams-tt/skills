#!/usr/bin/env node
/**
 * Distills the component capture into assets/components.figma.json — the
 * catalog used to place real library instances instead of lookalike frames.
 *
 * Membership is decided by `getPublishStatusAsync()`, read per node in the kit
 * and carried in the capture's `publishStatus` map. Everything the library
 * publishes is kept and everything it does not is dropped, whatever the thing
 * is called. Outside the icons, that distils to 118 published owners under 115
 * distinct names.
 *
 * The icons are the one exception, and they are a large one. The kit publishes
 * the whole icon set — some 900 components named `<Glyph> Icon · <size>` — and
 * those belong to assets/icons.figma.json, which keys them by glyph with a key
 * per size. That is the shape a caller placing an icon needs, and 900 flat
 * entries sitting beside 115 components is not. Publish status cannot tell an
 * icon from a button, so the name shape does — `sizeOf` already recognises it —
 * and what was excluded is counted into `source.iconsOmitted`. Counted rather
 * than dropped in silence, because `publicKept` against `publishedTotal` is a
 * subtraction a reader checks, and 900 unaccounted absences read as a capture
 * that died halfway.
 *
 * The rule this replaced tested the name — `_…` and `.…` meant internal — and
 * was wrong in both directions at once. It kept four components that live in
 * the file and were never pushed to the library, so their `key` threw at
 * import; it dropped `_Bubble / Text`, which the library publishes as
 * `ChatBubble`, and `_Stamps`, published as `Messenger Elements / Stamps`. The
 * name survives only as `nameStatusDisagreement` below, where it reports rather
 * than decides.
 *
 * Usage: node scripts/build-components.mjs <path-to-capture.json>
 *        node scripts/build-components.mjs --properties-only <published-properties.json>
 *
 * `--properties-only` refreshes property ids, variant options and defaults in
 * place, against the committed catalog, without a new dump. It exists because the
 * two halves of the catalog go stale at very different rates and cost very
 * different amounts to check: properties change whenever the library republishes
 * and are the half that throws a generation run mid-screen, while the dump is
 * 1074 entries and is needed only when a component is added, removed or renamed.
 * The full path stays the source of truth for membership; this one is for the
 * common case.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * `--out` is what lets a consuming project distil its own re-capture without a
 * writable plugin checkout. Under a plugin cache install the default path is
 * inside a version-named directory the host deletes on the next update, so a
 * project that re-captured in place would lose it silently — see
 * lib/overlay.mjs.
 */
const outFlag = process.argv.indexOf('--out');
const OUT =
  outFlag === -1
    ? join(here, '..', 'assets', 'components.figma.json')
    : resolve(process.argv[outFlag + 1]);

/** argv with `--out <path>` removed, so the positional arguments keep their places. */
const ARGS =
  outFlag === -1
    ? process.argv.slice(2)
    : [...process.argv.slice(2, outFlag), ...process.argv.slice(outFlag + 2)];

/**
 * The catalog `--properties-only` patches.
 *
 * That path rewrites an existing catalog rather than building one, so it needs
 * an input as well as an output, and the two are the same file only when a
 * maintainer runs it in place. A project writing its first overlay has no file
 * at `--out` yet and must start from the plugin's copy; a project refreshing an
 * overlay it already has must start from that, or the second run would silently
 * discard the first.
 */
const SHIPPED = join(here, '..', 'assets', 'components.figma.json');
const BASE = existsSync(OUT) ? OUT : SHIPPED;

/**
 * The old gate, kept as a cross-check and nothing else.
 *
 * Naming convention and publish status are two independent facts, and each of
 * the four unresolvable keys and the two missing components was a place they
 * disagreed. Recording the disagreements is what makes the next one visible:
 * `Core / Safari (Big Sur) / Toolbar / Toolbar Item` reads as public and sits
 * among 17 `_Browser / …` siblings, and nothing but this comparison would say
 * so. It gates nothing: `publishStatus` decides whether an entry is published
 * and `sizeOf` decides which of the two catalogs holds it, and neither of them
 * reads a prefix.
 */
const looksInternal = (n) => n.startsWith('_') || n.startsWith('.');

/** The three values `getPublishStatusAsync()` returns. */
const STATUSES = new Set(['CURRENT', 'CHANGED', 'UNPUBLISHED']);

/**
 * `CHANGED` is a published component the file has edited since, which is a
 * normal state and not a reason to drop anything. Membership asks for one of the
 * two published values rather than testing for `UNPUBLISHED`, so a node the
 * sweep never reported falls out of the catalog instead of into it.
 */
const isPublished = (status) => status === 'CURRENT' || status === 'CHANGED';

/**
 * `_Arrow-Left Icon · Medium` → `Medium`, and undefined for anything that is
 * not a ramp step of the icon set.
 *
 * Used twice, and the second use gates membership: an entry with a size is an
 * icon and belongs to the icon catalog. The anchored suffix is what keeps that
 * safe. `Icon Button` and `Brand / Logomark` are component sets with `Icon` in
 * the name and no ` · <size>` after it, so neither matches, and no published
 * component outside the icon ramp ends in one of these four words.
 */
const sizeOf = (name) => /Icon · (Tiny|Small|Medium|Large)$/.exec(name ?? '')?.[1];

/**
 * Keep only what is needed to place and configure an instance.
 *
 * This reads the file's own view of a property. Where the capture carries
 * published definitions, `propertiesFromPublished` overwrites everything here
 * except the INSTANCE_SWAP default, so this is the fallback path and the source
 * of the one field the library cannot supply.
 *
 * An INSTANCE_SWAP default is a bare node id, which is why it used to be
 * dropped. Resolved against the rest of the dump it becomes the name of what
 * the kit itself puts in that slot — `_Arrow-Left Icon · Medium` — and that
 * name carries the size. `defaultSize` is the ramp step the component was built
 * around, and the reason a caret in an icon button no longer has to be guessed.
 * The published definition gives this as a component key, which names nothing,
 * so the resolved name survives the overwrite.
 */
function slimProperty(p, byNode) {
  const out = { type: p.type, key: p.key };
  if (p.variantOptions) out.options = p.variantOptions;
  if (p.preferredValues?.length) out.preferredValues = p.preferredValues;

  if (p.type === 'INSTANCE_SWAP') {
    // Half of these point outside the file — the slot's default is a component
    // from another library, which this dump cannot name. Record what resolves.
    const target = byNode.get(p.defaultValue);
    if (target) {
      out.default = target.name;
      const size = sizeOf(target.name);
      if (size) out.defaultSize = size;
    }
    return out;
  }

  if (p.defaultValue !== undefined) out.default = p.defaultValue;
  return out;
}

/**
 * Read a capture file and fail loudly on the pre-gate shape.
 *
 * The capture used to be the bare `list_file_components_for_code_connect`
 * array. That array cannot answer the membership question — it carries no
 * publish status, which is the whole reason the name proxy existed — so a bare
 * array is a capture taken against the old procedure, not a capture missing an
 * optional extra.
 *
 * The completeness check below is the one that earns its keep. The status sweep
 * goes out 300 ids at a time over 1074 components, and a lane whose result never
 * came back is indistinguishable, in the merged file, from a lane that reported
 * nothing — so a partial capture would otherwise distil quietly, and every
 * component it forgot to ask about would arrive in the catalog with a `key` that
 * throws at import. That is the defect publish status was introduced to remove,
 * reachable through the capture instead of through the name rule.
 */
export function loadCapture(path) {
  const capture = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(capture)) {
    throw new Error(
      `${path} is a bare component dump. The capture now needs publish status ` +
        `alongside it — see scripts/extract.md section 5.`,
    );
  }
  if (!Array.isArray(capture.components)) {
    throw new Error(`${path} has no components array — see scripts/extract.md section 5.`);
  }
  const status = capture.publishStatus;
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    throw new Error(
      `${path} has no publishStatus map. It decides membership, so a capture ` +
        `without one cannot be distilled — see scripts/extract.md section 5.`,
    );
  }

  const unknown = [...new Set(Object.values(status).filter((v) => !STATUSES.has(v)))];
  if (unknown.length) {
    throw new Error(
      `${path}: publishStatus holds ${unknown.map((v) => JSON.stringify(v)).join(', ')}, ` +
        `which getPublishStatusAsync() does not return. Expected ${[...STATUSES].join(', ')}.`,
    );
  }

  const unasked = capture.components.filter((c) => !(c.nodeId in status));
  if (unasked.length) {
    const sample = unasked
      .slice(0, 3)
      .map((c) => `${c.name} (${c.nodeId})`)
      .join(', ');
    throw new Error(
      `${path}: publishStatus covers ${Object.keys(status).length} node(s) but the dump has ` +
        `${capture.components.length}; ${unasked.length} were never asked about, starting with ` +
        `${sample}. A batch that failed silently looks exactly like this. Re-run the sweep in ` +
        `scripts/extract.md section 5 until every nodeId has a status.`,
    );
  }
  return capture;
}

/**
 * Reduce a capture to the published catalog. Exported so diff.mjs can distil a
 * fresh capture the same way and compare like with like.
 *
 * `publishedNames` maps an assetKey to the name the *library* serves, which is
 * not always the name the file carries: a component renamed after its last
 * publish keeps the old name in every consuming file until someone republishes
 * it. Four are in that state. Entries stay keyed by the file name, because that
 * is what the visual-spec capture and every `data-pp-component` declaration
 * already say; the published name rides along as `publishedAs` so a designer
 * hunting `ChatBubble` in the assets panel can find which entry it is.
 */
/**
 * Rebuild one component's properties from what the library publishes.
 *
 * The dump reads the library's working file, so its properties are the file's
 * unpublished state. Measured across 115 entries, 6 disagreed with the library
 * about their own properties — `Button` among them, which is on nearly every
 * screen, and whose published `Label`, `Icon Left` and `Icon Right` the dump does
 * not mention at all. A generation run written against the dump's ids throws in
 * `setProperties` after the instance is already on the canvas.
 *
 * `defs` is `componentPropertyDefinitions` off the imported component, which the
 * capture already has in hand: extract.md §5 imports every key to read its
 * published name, and these ride back on that same round trip.
 *
 * The dump still wins on one field. A published INSTANCE_SWAP reports its default
 * as a component key, which names nothing a reader recognises, while the dump
 * reports a node id that resolves inside the capture to `_Arrow-Left Icon · Tiny`
 * and the `Tiny` that sizes an icon slot. So swap defaults are carried across from
 * the dump by display name, and everything that decides whether a call succeeds —
 * the suffixed id, the legal variant options, the defaults — comes from the
 * library.
 *
 * preferredValues is deliberately dropped even though published definitions do
 * carry it. `Pill::icon` alone offers 194 legal values and `Icon Button::Icon`
 * offers 120; carrying them would add thousands of lines to a file that loads
 * into a designer's session. `assets/icons.figma.json` already answers "what
 * icons exist" without putting the whole ramp inside every swap slot.
 */
function propertiesFromPublished(defs, dumpProps) {
  const out = {};
  for (const [full, d] of Object.entries(defs)) {
    // `setProperties` takes bare names for VARIANT and the suffixed id for
    // everything else, so a non-VARIANT definition without one is unusable.
    // Slicing to the absent `#` would have quietly dropped its last character
    // and shipped the result as a property name.
    if (d.type !== 'VARIANT' && !full.includes('#')) {
      throw new Error(
        `property "${full}" is typed ${d.type} but carries no "#id" suffix, so it cannot ` +
          `be passed to setProperties. The capture is malformed.`,
      );
    }
    const display = d.type === 'VARIANT' ? full : full.slice(0, full.indexOf('#'));
    const prop = { type: d.type, key: full };
    if (d.variantOptions) prop.options = d.variantOptions;

    if (d.type === 'INSTANCE_SWAP') {
      const fromDump = dumpProps[display];
      if (fromDump?.default) prop.default = fromDump.default;
      if (fromDump?.defaultSize) prop.defaultSize = fromDump.defaultSize;
    } else if (d.defaultValue !== undefined) {
      prop.default = d.defaultValue;
    }
    out[display] = prop;
  }
  return out;
}

export function distillComponents({
  components: all,
  publishStatus,
  publishedNames = {},
  publishedProperties = {},
}) {
  // Built over the whole capture, unpublished parts included: an INSTANCE_SWAP
  // default almost always points at an internal `_…` part, which is exactly the
  // entry the catalog drops.
  const byNode = new Map(all.map((c) => [c.nodeId, c]));
  const published = all.filter((c) => isPublished(publishStatus[c.nodeId]));

  // The icon set publishes from this same library and is cataloged by glyph in
  // assets/icons.figma.json. Split out before the loop below rather than after
  // it, because the two catalogs disagree about what a duplicate is: `Home` is
  // published in both Navigation and Meta Category at all four sizes, so
  // `Home Icon · Tiny` is two published nodes under one name here and two
  // legitimate entries there. Filtering later would fill `nameCollisions` with
  // pairs that are not collisions anywhere a reader can act on them.
  const icons = published.filter((c) => sizeOf(c.name));
  const owners = published.filter((c) => !sizeOf(c.name));

  const components = {};
  // A name is not unique — the kit publishes two `Tabs`, two `iOS / Sheet` and
  // two `view` — and keying by name means one of each is unreachable. Which one
  // survives is worth stating, because "118 published, 115 entries" is
  // otherwise a subtraction nobody can check.
  const nameCollisions = [];
  for (const c of owners) {
    // The dump's own reading first, because it is what resolves an INSTANCE_SWAP
    // default to a name, then the library's reading over the top of it where the
    // capture has one.
    const dumpProps = {};
    for (const [name, p] of Object.entries(c.properties ?? {})) {
      dumpProps[name] = slimProperty(p, byNode);
    }
    const defs = publishedProperties[c.assetKey];
    const props = defs ? propertiesFromPublished(defs, dumpProps) : dumpProps;
    const held = components[c.name];
    if (held) {
      nameCollisions.push(
        `"${c.name}" is published twice — kept ${c.nodeId} on "${c.pageName}", ` +
          `dropped ${held.nodeId} on "${held.page}"`,
      );
    }
    const servedAs = publishedNames[c.assetKey];
    components[c.name] = {
      key: c.assetKey,
      type: c.type,
      page: c.pageName,
      nodeId: c.nodeId,
      ...(servedAs && servedAs !== c.name ? { publishedAs: servedAs } : {}),
      instanceCount: c.instanceCount,
      ...(Object.keys(props).length ? { properties: props } : {}),
      ...(c.childInstanceTags?.length ? { children: c.childInstanceTags } : {}),
    };
  }

  // Over the whole capture, icons included, unlike everything above it. This
  // reports on the file's naming rather than on the catalog's contents, and a
  // published `_…` icon is the same mistake wherever the glyph ends up.
  const nameStatusDisagreement = all
    .filter((c) => looksInternal(c.name) === isPublished(publishStatus[c.nodeId]))
    .map((c) =>
      looksInternal(c.name)
        ? `"${c.name}" reads as internal and is published`
        : `"${c.name}" reads as public and is not published`,
    )
    .sort();

  // Silence here would mean shipping the file's unpublished property ids and
  // calling them the library's, which is the defect this field exists to make
  // visible rather than plausible.
  const propertiesFromDump = owners
    .filter((c) => Object.keys(c.properties ?? {}).length && !publishedProperties[c.assetKey])
    .map((c) => c.name)
    .sort();

  return {
    components: Object.fromEntries(
      Object.entries(components).sort(([a], [b]) => a.localeCompare(b)),
    ),
    capturedTotal: all.length,
    publishedTotal: published.length,
    // Icons included on purpose, unlike every other count here. freshness.mjs
    // holds this against `/component_sets` for the whole file, so narrowing it
    // to the catalog's own entries would report the icon sets the endpoint
    // returns as work the kit had gained.
    publishedSets: published.filter((c) => c.type === 'COMPONENT_SET').length,
    unpublishedOmitted: all.length - published.length,
    iconsOmitted: icons.length,
    nameCollisions: nameCollisions.sort(),
    nameStatusDisagreement,
    propertiesFromDump,
  };
}

if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // Imported for distillComponents; skip the CLI below.
} else {
  try {
    main();
  } catch (e) {
    // Every throw on these paths is a rejected capture, and the message names
    // the section to re-capture from. A stack trace would bury it.
    console.error(e.message);
    process.exit(1);
  }
}

/**
 * Normalise a capture's `properties` map into what `propertiesFromPublished` reads.
 *
 * Two shapes arrive here and both are legitimate. The sweep crosses a `use_figma`
 * boundary 29 keys at a time and sends a compact form — `{n, p:{t,o,d}}` rather
 * than the full definition — because keeping that payload small is the whole
 * point of the batching. A capture saved straight off
 * `componentPropertyDefinitions` carries the full form instead, and a file on
 * disk has no payload budget to protect.
 *
 * Reading the shape rather than assuming it is what makes the difference safe.
 * Assuming the compact form yields no definitions at all for a full-form file,
 * and this path used to spend that emptiness deleting the properties it was
 * asked to refresh.
 */
function normalisePublished(properties, path) {
  const TYPE = { V: 'VARIANT', T: 'TEXT', B: 'BOOLEAN', I: 'INSTANCE_SWAP' };
  const out = {};
  for (const [key, entry] of Object.entries(properties)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${path}: properties["${key}"] is not an object.`);
    }

    if (entry.p && typeof entry.p === 'object') {
      const defs = {};
      for (const [full, p] of Object.entries(entry.p)) {
        defs[full] = {
          type: TYPE[p.t] ?? p.t,
          ...(p.o ? { variantOptions: p.o } : {}),
          ...(p.d !== undefined ? { defaultValue: p.d } : {}),
        };
      }
      out[key] = defs;
      continue;
    }

    // Compact, and the component publishes nothing to set.
    if ('n' in entry || 'p' in entry) {
      out[key] = {};
      continue;
    }

    const defs = Object.values(entry);
    if (defs.every((d) => d && typeof d.type === 'string')) {
      out[key] = entry;
      continue;
    }

    throw new Error(
      `${path}: properties["${key}"] is neither the compact capture form ` +
        `({ n, p: { "size": { t: "V" } } }) nor componentPropertyDefinitions ` +
        `({ "Label#13326:0": { type: "TEXT" } }). See scripts/extract.md section 5.`,
    );
  }
  return out;
}

function propertiesOnly(path) {
  const capture = JSON.parse(readFileSync(path, 'utf8'));
  if (!capture.properties) {
    throw new Error(`${path} has no properties map — see scripts/extract.md section 5.`);
  }
  // `.cache/` is gitignored, so once this run finishes the only surviving record
  // of when the library was read is the date this copies into the catalog.
  // Defaulting it to today would date the distillation and call it the capture.
  if (!capture.capturedAt) {
    throw new Error(
      `${path} has no capturedAt. It becomes source.propertiesCapturedAt, which is the ` +
        `whole provenance of this path — see scripts/extract.md section 5.`,
    );
  }
  const published = normalisePublished(capture.properties, path);
  const doc = JSON.parse(readFileSync(BASE, 'utf8'));

  const rewritten = [];
  const unknown = [];
  const skipped = [];
  const emptied = [];
  const refreshed = new Set();

  for (const [name, entry] of Object.entries(doc.components)) {
    const defs = published[entry.key];
    if (!defs) {
      skipped.push(name);
      continue;
    }
    const before = JSON.stringify(entry.properties ?? {});
    const next = propertiesFromPublished(defs, entry.properties ?? {});
    // A component the catalog says has properties, whose published definitions
    // are empty, is a bad capture far more often than a real change — and the
    // real change is structural, so it belongs to the full path either way.
    if (!Object.keys(next).length && before !== '{}') {
      emptied.push(name);
      continue;
    }
    refreshed.add(name);
    if (Object.keys(next).length) entry.properties = next;
    else delete entry.properties;
    if (JSON.stringify(entry.properties ?? {}) !== before) rewritten.push(name);
  }

  if (emptied.length) {
    throw new Error(
      `${path} publishes no properties for ${emptied.length} component(s) the catalog ` +
        `records some for: ${emptied.join(', ')}. Nothing was written. If the library really ` +
        `dropped them, take the full capture — this path cannot tell that apart from a ` +
        `capture that missed them.`,
    );
  }

  const known = new Set(Object.values(doc.components).map((c) => c.key));
  for (const key of Object.keys(published)) {
    if (!known.has(key)) unknown.push(key);
  }

  doc.source.propertiesCapturedAt = capture.capturedAt;

  // This path knows which entries it took from the library and nothing about
  // where the rest came from, so it can only clear names, never add them: an
  // entry the capture skipped keeps whatever provenance the full run recorded.
  // Recomputing the list here would relabel 14 property-less components as
  // holding unpublished work, which is the opposite of what the field means.
  const stillFromDump = (doc.source.propertiesFromDump ?? []).filter((n) => !refreshed.has(n));
  if (stillFromDump.length) doc.source.propertiesFromDump = stillFromDump;
  else delete doc.source.propertiesFromDump;

  writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');

  console.log(
    `Wrote ${OUT} — refreshed properties for ${refreshed.size} of ` +
      `${Object.keys(doc.components).length} components; ${rewritten.length} changed.`,
  );
  for (const name of rewritten) console.log(`  changed  ${name}`);
  // A key with no catalog entry means the dump is stale too, which this path
  // cannot fix: it never looks at membership.
  for (const key of unknown) {
    console.log(`  warning  captured key ${key} matches no catalog entry — run the full capture`);
  }
  if (skipped.length) {
    console.log(
      `  ${skipped.length} component(s) were not in this capture and keep their recorded ` +
        `properties: ${skipped.join(', ')}`,
    );
  }
  if (stillFromDump.length) {
    console.log(
      `  ${stillFromDump.length} component(s) still carry the file's properties rather than the ` +
        `library's: ${stillFromDump.join(', ')}`,
    );
  }
}

function main() {
if (ARGS[0] === '--properties-only') {
  const path = ARGS[1];
  if (!path) {
    console.error('usage: node scripts/build-components.mjs --properties-only <published-properties.json>');
    process.exit(1);
  }
  propertiesOnly(path);
  return;
}

const capturePath = ARGS[0];
if (!capturePath) {
  console.error(
    'usage: node scripts/build-components.mjs <path-to-capture.json>\n' +
      '       node scripts/build-components.mjs --properties-only <published-properties.json>',
  );
  process.exit(1);
}

const capture = loadCapture(capturePath);
const distilled = distillComponents(capture);
const sorted = distilled.components;

const doc = {
  $comment:
    'Every component and component set the Pushpin Thumbprint UI Kit publishes to its library, except the icon set. Membership is decided by getPublishStatusAsync() per node, not by the name, so an entry here is one whose `key` resolves. The kit publishes its icons from the same library, and they are cataloged by glyph in icons.figma.json instead of one entry per size here; `source.iconsOmitted` counts how many were routed there. `key` is the assetKey to pass to figma.importComponentByKeyAsync — importComponentSetByKeyAsync for a COMPONENT_SET. `publishedAs` appears where the library still serves an older name than the file carries. Generated — see scripts/build-components.mjs.',
  source: {
    fileKey: 'VVRGrLgkPRU3vs765d5Q3r',
    fileName: 'Pushpin Thumbprint UI Kit',
    extractedAt: new Date().toISOString().slice(0, 10),
    capturedTotal: distilled.capturedTotal,
    publishedTotal: distilled.publishedTotal,
    publishedSets: distilled.publishedSets,
    unpublishedOmitted: distilled.unpublishedOmitted,
    // Published icons, kept out of `components` and cataloged in
    // icons.figma.json. Stated here rather than only there because this is
    // where a reader is already checking `publicKept` against
    // `publishedTotal`, and that subtraction does not close without it.
    iconsOmitted: distilled.iconsOmitted,
    publicKept: Object.keys(sorted).length,
    ...(distilled.nameCollisions.length ? { nameCollisions: distilled.nameCollisions } : {}),
    // Where the naming convention and the library disagree. Every entry here is
    // a component someone should either rename or publish; none of them change
    // what the catalog holds.
    ...(distilled.nameStatusDisagreement.length
      ? { nameStatusDisagreement: distilled.nameStatusDisagreement }
      : {}),
    // Components whose properties came from the file rather than the library,
    // because the capture carried no published definitions for them. Their
    // property ids and variant options may be unpublished work.
    ...(distilled.propertiesFromDump.length
      ? { propertiesFromDump: distilled.propertiesFromDump }
      : {}),
    // Where the capture read from, when it was not the plugin path this file
    // documents. pull-components.mjs writes `properties: "rest-editor-state"`
    // because REST reads the file rather than the published definition, and
    // `carried` for the fields REST has no source for. A plugin capture has no
    // provenance block and the catalog it builds is unchanged.
    ...(capture.provenance ?? {}),
  },
  components: sorted,
};

writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — ${doc.source.publicKept} published components under distinct names ` +
    `(${doc.source.publishedTotal} published of ${doc.source.capturedTotal} captured; ` +
    `${doc.source.unpublishedOmitted} unpublished omitted, ` +
    `${doc.source.iconsOmitted} icons in icons.figma.json).`,
);
if (distilled.nameCollisions.length) {
  console.log(`  ${distilled.nameCollisions.length} name(s) published twice; one entry each.`);
}
if (distilled.nameStatusDisagreement.length) {
  console.log(
    `  ${distilled.nameStatusDisagreement.length} component(s) whose name disagrees with their publish status.`,
  );
}
if (distilled.propertiesFromDump.length) {
  console.log(
    `  ${distilled.propertiesFromDump.length} component(s) took properties from the file, not the ` +
      `library — add publishedProperties to the capture (extract.md section 5).`,
  );
}
}

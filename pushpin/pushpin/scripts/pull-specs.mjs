#!/usr/bin/env node
/**
 * Captures component visual specs over REST, one lane file per page, in the
 * `{ group, lanes, components }` shape scripts/build-specs.mjs merges — the
 * output the per-page plugin script in scripts/extract.md § 9 produces, read
 * from `GET /files/:key/nodes?ids=<page>` instead of from inside the editor.
 *
 * Pages are named, not numbered: `--pages "Button,Text Input"` matches a page
 * by its name with any emoji prefix stripped, because the kit's pages are
 * `📌 Button` today and were `Button` last month, and `--all` takes every page
 * the committed component catalog places a component on. Names are resolved
 * against the live page list from `/files/:key?depth=1`.
 *
 * REST node JSON and plugin-API node objects describe the same node in
 * different words. Every translation this script makes, and why:
 *
 *   publish gate       `getPublishStatusAsync() !== 'UNPUBLISHED'` becomes
 *                      membership in `/components` + `/component_sets`, which
 *                      list only published owners. Variants are excluded as
 *                      they are in the plugin walk (`parent.type ===
 *                      'COMPONENT_SET'`).
 *   findAllWithCriteria a depth-first walk of `children`, document order. The
 *                      first TEXT descendant (`findOne`) is the same walk
 *                      stopping at the first hit.
 *   variantProperties  not a REST field. A variant's name is
 *                      `axis=option, axis=option`, which is how the plugin
 *                      derives them too; parsed on `, ` and `=`.
 *   width / height     `absoluteBoundingBox.width/height`. REST's `size` is
 *                      only present under `geometry=paths`, which would ship
 *                      every vector path; the bounding box equals it for the
 *                      unrotated frames components are. Bound through
 *                      `boundVariables.size.x` and `.y`.
 *   fills / strokes    `paints[0]`, skipped when `visible === false`, non-SOLID
 *                      recorded as its type. Colour is `#rrggbb` plus `aa` when
 *                      translucent; REST puts alpha on `opacity` and on
 *                      `color.a`, both honoured. The binding is
 *                      `paint.boundVariables.color`, or the node's
 *                      `boundVariables.fills[i]` for older files.
 *   strokeTopWeight …  `individualStrokeWeights.{top,right,bottom,left}` when
 *                      present, else `strokeWeight` on every side; bound through
 *                      `boundVariables.individualStrokeWeights.*`.
 *   topLeftRadius …    `rectangleCornerRadii` [tl, tr, br, bl] when present,
 *                      else `cornerRadius` on every corner, default 0 — REST
 *                      omits defaults. Bound through `boundVariables.topLeftRadius`
 *                      or `boundVariables.rectangleCornerRadii.RECTANGLE_*`.
 *   layout             `layoutMode` absent means NONE. `layoutSizingHorizontal/
 *                      Vertical` are read directly; when a file predates them,
 *                      `primaryAxisSizingMode`/`counterAxisSizingMode` give
 *                      FIXED or AUTO→HUG. `itemSpacing` and `padding*` default 0.
 *   text style         `styles.text` is a style id; the response's `styles` map
 *                      names it. No entry means no style, recorded as null.
 *   fontSize           `style.fontSize` on the TEXT node.
 *   bound variables    the hard one. A binding is `[collection, name, literal]`
 *                      and REST gives only `{ type: "VARIABLE_ALIAS", id }`.
 *                      Names resolve, in order, from `/files/:key/variables/local`
 *                      when the token's plan allows it (Enterprise), from an id
 *                      map — assets/variable-ids.figma.json when it exists, the
 *                      `ids` block scripts/check.md § 1 captures, or the file
 *                      `--variables` names, in that file's per-collection shape
 *                      `{ "Tokens / Space": { "VariableID:1:2": "2" } }` or flat
 *                      `{ "VariableID:1:2": ["Tokens / Space", "2"] }` — and
 *                      for library-bound ids of the form `VariableID:<key>/…`
 *                      from the committed variable-keys.figma.json. A binding
 *                      none of those name is an error, because a spec that
 *                      silently drops its token attribution is the defect this
 *                      capture exists to remove; `--allow-unresolved` records
 *                      the literal alone and notes the loss on the lane.
 *
 * Variant selection, the cap, `reduced` and `unreachable` follow § 9's script
 * line for line; that logic is not a translation and is not restated here.
 * One choice is: when a page publishes a name twice, the plugin keeps
 * whichever it walked first, and REST promises no order, so the node the
 * component catalog names is kept and the other recorded as the collision.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_... node scripts/pull-specs.mjs --pages "Button,Text Input" [--out specs]
 *   FIGMA_TOKEN=figd_... node scripts/pull-specs.mjs --all [--variables ids.json] [--allow-unresolved]
 *   FIGMA_TOKEN=figd_... node scripts/pull-specs.mjs --pages Button --check
 *
 * Then: node scripts/build-specs.mjs --merge specs/*.json
 *
 * --check distils the lanes in memory, compares each recorded component with
 * the committed specs, writes nothing, and exits 1 if anything moved.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CAP, distillSpecs } from './build-specs.mjs';
import {
  FigmaError,
  explain,
  figmaGet,
  getNodes,
  pagesOf,
  publishedOwners,
  requireToken,
} from './lib/figma-rest.mjs';
import {
  ASSETS,
  compareEntries,
  flag,
  hex,
  loadCommitted,
  manifest,
  option,
  r4,
  reportCheck,
  same,
  today,
  writeJson,
} from './lib/pull.mjs';

const argv = process.argv.slice(2);
const out = option(argv, '--out', 'specs');
const pagesArg = option(argv, '--pages');
const all = flag(argv, '--all');
// The committed map is the default so that the workflow, which passes nothing,
// starts naming bindings the day a maintainer commits it.
const COMMITTED_IDS = join(ASSETS, 'variable-ids.figma.json');
const variablesFile = option(argv, '--variables', existsSync(COMMITTED_IDS) ? COMMITTED_IDS : undefined);
const allowUnresolved = flag(argv, '--allow-unresolved');
const check = flag(argv, '--check');
requireToken('pull-specs.mjs');

if (!pagesArg && !all) {
  console.error(
    'usage: node scripts/pull-specs.mjs --pages "Button,Text Input" [--out specs]\n' +
      '       node scripts/pull-specs.mjs --all [--variables ids.json] [--allow-unresolved]',
  );
  process.exit(1);
}

const fileKey = manifest.figma.fileKey;
const catalog = loadCommitted('components.figma.json').components;
const catalogNode = new Map(Object.entries(catalog).map(([n, e]) => [n, e.nodeId]));

/** `📌 Button` and `Button` name the same page. */
const bare = (name) => String(name).replace(/^[^\p{L}\p{N}]+/u, '').trim();

// ------------------------------------------------------------ variable names

/**
 * Bound-variable ids to `[collection, name]`, from whichever sources answer.
 * `VariableID:<key>/<id>` is how a subscribed library variable is identified,
 * and the key is what variable-keys.figma.json records per name.
 */
async function variableResolver() {
  const map = new Map();
  const notes = [];

  try {
    const res = await figmaGet(`/files/${fileKey}/variables/local`);
    const collections = res?.meta?.variableCollections ?? {};
    for (const v of Object.values(res?.meta?.variables ?? {})) {
      const c = collections[v.variableCollectionId];
      if (c) map.set(v.id, [c.name, v.name]);
    }
    notes.push(`variables/local: ${map.size} names`);
  } catch (e) {
    if (!(e instanceof FigmaError)) throw e;
    notes.push(`variables/local: ${e.status} (${e.status === 403 ? 'Enterprise-only' : e.body})`);
  }

  if (variablesFile) {
    const ids = JSON.parse(readFileSync(variablesFile, 'utf8'));
    let n = 0;
    const add = (id, collection, name) => {
      if (map.has(id)) return;
      map.set(id, [collection, name]);
      n++;
    };
    // Per collection as check.md § 1 writes it, or flat id -> [collection, name].
    for (const [k, v] of Object.entries(ids)) {
      if (k.startsWith('$') || k === 'source') continue;
      if (Array.isArray(v)) {
        if (v.length >= 2) add(k, v[0], v[1]);
      } else if (v && typeof v === 'object') {
        for (const [id, name] of Object.entries(v)) add(id, k, name);
      }
    }
    notes.push(`${variablesFile}: ${n} names`);
  }

  const byKey = new Map();
  const keys = loadCommitted('variable-keys.figma.json');
  for (const [collection, vars] of Object.entries(keys.bindable ?? {})) {
    if (collection.startsWith('$')) continue;
    for (const [name, key] of Object.entries(vars)) byKey.set(key, [collection, name]);
  }

  const unresolved = new Set();
  const resolve = (alias) => {
    if (!alias || alias.type !== 'VARIABLE_ALIAS' || !alias.id) return null;
    const hit = map.get(alias.id);
    if (hit) return hit;
    const remote = /^VariableID:([0-9a-f]{40})\//.exec(alias.id);
    if (remote && byKey.has(remote[1])) return byKey.get(remote[1]);
    unresolved.add(alias.id);
    return null;
  };
  return { resolve, unresolved, notes };
}

// ------------------------------------------------------------ node reading

function spec(node, ctx) {
  const bv = node.boundVariables ?? {};
  const dim = (alias, value) => {
    const ref = ctx.resolve(alias);
    return ref ? [ref[0], ref[1], r4(value)] : r4(value);
  };
  const paintOf = (paints, nodeAliases) => {
    if (!Array.isArray(paints) || !paints.length) return null;
    const p = paints[0];
    if (p.visible === false) return null;
    if (p.type !== 'SOLID') return p.type;
    const lit = hex(p.color, p.opacity);
    const ref = ctx.resolve(p.boundVariables?.color ?? nodeAliases?.[0]);
    return ref ? [ref[0], ref[1], lit] : lit;
  };

  const s = {};
  const fill = paintOf(node.fills, bv.fills);
  if (fill !== null) s.fill = fill;
  const stroke = paintOf(node.strokes, bv.strokes);
  if (stroke !== null) {
    s.stroke = stroke;
    const w = node.individualStrokeWeights;
    const sw = bv.individualStrokeWeights ?? {};
    const weight = node.strokeWeight ?? 0;
    s.strokeWeight = same([
      dim(sw.top, w ? w.top : weight),
      dim(sw.right, w ? w.right : weight),
      dim(sw.bottom, w ? w.bottom : weight),
      dim(sw.left, w ? w.left : weight),
    ]);
  }

  const rc = bv.rectangleCornerRadii ?? {};
  const corners = node.rectangleCornerRadii ?? Array(4).fill(node.cornerRadius ?? 0);
  s.radius = same([
    dim(bv.topLeftRadius ?? rc.RECTANGLE_TOP_LEFT_CORNER_RADIUS, corners[0]),
    dim(bv.topRightRadius ?? rc.RECTANGLE_TOP_RIGHT_CORNER_RADIUS, corners[1]),
    dim(bv.bottomRightRadius ?? rc.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS, corners[2]),
    dim(bv.bottomLeftRadius ?? rc.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS, corners[3]),
  ]);

  const box = node.size ? { width: node.size.x, height: node.size.y } : node.absoluteBoundingBox ?? {};
  s.size = [dim(bv.size?.x, box.width), dim(bv.size?.y, box.height)];

  if (node.layoutMode && node.layoutMode !== 'NONE') {
    s.mode = node.layoutMode;
    const axis = (mode) => (mode === 'AUTO' ? 'HUG' : 'FIXED');
    const horizontal =
      node.layoutSizingHorizontal ??
      axis(node.layoutMode === 'HORIZONTAL' ? node.primaryAxisSizingMode : node.counterAxisSizingMode);
    const vertical =
      node.layoutSizingVertical ??
      axis(node.layoutMode === 'VERTICAL' ? node.primaryAxisSizingMode : node.counterAxisSizingMode);
    s.sizing = [horizontal, vertical];
    s.gap = dim(bv.itemSpacing, node.itemSpacing ?? 0);
    s.padding = same([
      dim(bv.paddingTop, node.paddingTop ?? 0),
      dim(bv.paddingRight, node.paddingRight ?? 0),
      dim(bv.paddingBottom, node.paddingBottom ?? 0),
      dim(bv.paddingLeft, node.paddingLeft ?? 0),
    ]);
  }

  const txt = firstText(node);
  if (txt) {
    const t = { layer: txt.name };
    const tf = paintOf(txt.fills, txt.boundVariables?.fills);
    if (tf !== null) t.fill = tf;
    const styleId = txt.styles?.text;
    t.style = styleId ? (ctx.styles[styleId]?.name ?? null) : null;
    if (typeof txt.style?.fontSize === 'number') t.size = r4(txt.style.fontSize);
    s.text = t;
  }
  return s;
}

function firstText(node) {
  for (const child of node.children ?? []) {
    if (child.type === 'TEXT') return child;
    const hit = firstText(child);
    if (hit) return hit;
  }
  return null;
}

/** `theme=primary, size=large` → `{ theme: 'primary', size: 'large' }`. */
function variantProperties(name) {
  const out = {};
  for (const part of String(name).split(',')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function findOwners(node, acc = [], parent = null) {
  if (node.type === 'COMPONENT' && parent?.type === 'COMPONENT_SET') return acc;
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') acc.push(node);
  for (const child of node.children ?? []) findOwners(child, acc, node);
  return acc;
}

// ------------------------------------------------------------ one page

function readPage(page, doc, published, ctx) {
  const owners = findOwners(doc).filter((n) => published.has(n.id));
  const out = {};
  const collisions = [];

  for (const owner of owners) {
    const held = out[owner.name];
    if (held) {
      // The catalog's node wins whichever the API listed first.
      if (catalogNode.get(owner.name) === owner.id) {
        collisions.push({ name: owner.name, kept: owner.id, dropped: held.nodeId });
        delete out[owner.name];
      } else {
        collisions.push({ name: owner.name, kept: held.nodeId, dropped: owner.id });
        continue;
      }
    }

    if (owner.type !== 'COMPONENT_SET') {
      out[owner.name] = { type: owner.type, page: page.name, nodeId: owner.id, resting: spec(owner, ctx) };
      continue;
    }

    const defs = owner.componentPropertyDefinitions ?? {};
    const axes = {};
    const defaults = {};
    for (const [k, d] of Object.entries(defs)) {
      if (d.type !== 'VARIANT') continue;
      axes[k] = d.variantOptions ?? [];
      defaults[k] = d.defaultValue;
    }
    const axisNames = Object.keys(axes);
    const kids = (owner.children ?? []).filter((c) => c.type === 'COMPONENT');

    const chosen = new Map();
    const unreachable = [];
    for (const axis of axisNames) {
      for (const optionValue of axes[axis]) {
        let best = null;
        let bestScore = -1;
        for (const c of kids) {
          const vp = variantProperties(c.name);
          if (vp[axis] !== optionValue) continue;
          let score = 0;
          for (const o of axisNames) if (o !== axis && vp[o] === defaults[o]) score++;
          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }
        if (!best) {
          unreachable.push(`${axis}=${optionValue}`);
          continue;
        }
        if (!chosen.has(best.id)) chosen.set(best.id, { node: best, for: [] });
        chosen.get(best.id).for.push(`${axis}=${optionValue}`);
      }
    }

    const picked = [...chosen.values()].slice(0, CAP);
    const variants = [];
    for (const { node, for: forWhat } of picked) {
      const vp = variantProperties(node.name);
      const props = {};
      for (const k of axisNames) if (vp[k] !== defaults[k]) props[k] = vp[k];
      variants.push({ for: forWhat, props, ...spec(node, ctx) });
    }

    const entry = {
      type: owner.type,
      page: page.name,
      nodeId: owner.id,
      axes,
      defaults,
      children: kids.length,
      crossProduct: axisNames.reduce((a, k) => a * axes[k].length, 1),
      recorded: variants.length,
    };
    if (variants.length < kids.length) {
      entry.reduced = {
        children: kids.length,
        recorded: variants.length,
        cappedAt: chosen.size > CAP ? CAP : null,
      };
    }
    if (unreachable.length) entry.unreachable = unreachable;
    entry.variants = variants;
    out[owner.name] = entry;
  }

  return { owners: owners.length, collisions, components: out };
}

// ------------------------------------------------------------ main

async function capture() {
  const [{ byNode }, pages, vars] = await Promise.all([
    publishedOwners(fileKey),
    pagesOf(fileKey),
    variableResolver(),
  ]);
  const published = new Set(byNode.keys());

  const wanted = all
    ? [...new Set(Object.values(catalog).map((e) => bare(e.page)))]
    : pagesArg.split(',').map((s) => bare(s)).filter(Boolean);
  const byBare = new Map(pages.map((p) => [bare(p.name), p]));
  const targets = [];
  const missing = [];
  for (const w of wanted) {
    const p = byBare.get(w);
    if (p) targets.push(p);
    else missing.push(w);
  }
  if (missing.length) {
    throw new Error(
      `no page named ${missing.map((m) => `"${m}"`).join(', ')} in the file. Pages: ` +
        pages.map((p) => `"${p.name}"`).join(', '),
    );
  }

  const { nodes, styles } = await pageNodes(targets.map((p) => p.id));
  const ctx = { resolve: vars.resolve, styles };

  const lanes = [];
  for (const [i, page] of targets.entries()) {
    const doc = nodes[page.id]?.document;
    if (!doc) throw new Error(`page "${page.name}" (${page.id}) came back empty from /nodes`);
    const before = vars.unresolved.size;
    const read = readPage(page, doc, published, ctx);
    const lost = vars.unresolved.size - before;
    lanes.push({
      page,
      file: {
        group: `rest ${today()}`,
        lanes: [
          {
            lane: i + 1,
            pageId: page.id,
            figmaPage: page.name,
            status: 'ok',
            expected: read.owners - read.collisions.length,
            recorded: Object.keys(read.components),
            skipped: [],
            collisions: read.collisions,
            ...(lost
              ? { note: `${lost} bound variable(s) could not be named over REST and are recorded as literals` }
              : {}),
          },
        ],
        components: read.components,
      },
    });
  }
  return { lanes, unresolved: [...vars.unresolved], notes: vars.notes };
}

/** The pages' trees, with the `styles` maps of every batch merged for the name lookup. */
async function pageNodes(ids) {
  const { nodes } = await getNodes(fileKey, ids);
  const styles = {};
  for (const entry of Object.values(nodes)) Object.assign(styles, entry?.styles ?? {});
  return { nodes, styles };
}

let cap;
try {
  cap = await capture();
} catch (e) {
  console.error(explain(e, fileKey));
  process.exit(1);
}

for (const n of cap.notes) console.log(`  ${n}`);
if (cap.unresolved.length && !allowUnresolved) {
  console.error(
    `${cap.unresolved.length} bound variable id(s) could not be named, starting with ` +
      `${cap.unresolved.slice(0, 3).join(', ')}.\n\n` +
      'The variables endpoint is Enterprise-only, so on any other plan the names come from\n' +
      'an id map: commit the `ids` block of scripts/check.md section 1 as\n' +
      'assets/variable-ids.figma.json (read by default), or pass one with --variables, or\n' +
      'pass --allow-unresolved to record the literals alone and note the loss on each lane.',
  );
  process.exit(1);
}

const slug = (name) => bare(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

if (check) {
  const committed = loadCommitted('component-specs.figma.json').components;
  const fresh = distillSpecs(cap.lanes.map((l) => l.file), catalog).components;
  const pagesRead = new Set(cap.lanes.map((l) => l.page.name));
  const before = Object.fromEntries(
    Object.entries(committed).filter(([, e]) => pagesRead.has(e.page) || pagesRead.has(bare(e.page))),
  );
  reportCheck(
    `specs on ${cap.lanes.length} page(s)`,
    compareEntries(before, fresh),
    `Run: node scripts/pull-specs.mjs --pages "${cap.lanes.map((l) => bare(l.page.name)).join(',')}" ` +
      `&& node scripts/build-specs.mjs --merge ${out}/*.json`,
  );
}

mkdirSync(out, { recursive: true });
const written = [];
for (const { page, file } of cap.lanes) {
  const path = join(out, `${slug(page.name)}.json`);
  writeJson(path, file);
  written.push(path);
  const lane = file.lanes[0];
  console.log(`Wrote ${path} — ${lane.recorded.length} of ${lane.expected} owners on "${page.name}".`);
  for (const c of lane.collisions) {
    console.log(`  "${c.name}" published twice on this page — kept ${c.kept}, dropped ${c.dropped}`);
  }
  if (lane.note) console.log(`  ${lane.note}`);
}
console.log(`Next: node scripts/build-specs.mjs --merge ${written.join(' ')}`);

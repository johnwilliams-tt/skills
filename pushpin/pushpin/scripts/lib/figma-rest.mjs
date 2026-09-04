/**
 * The Figma REST client the pull-*.mjs scripts share.
 *
 * One place for the three things every REST capture has to get right and none
 * of them should get right separately: the token header, the 429 handling, and
 * the batching of `ids` on `/nodes`. freshness.mjs keeps its own three-line
 * `figmaGet` because it wants failures as values rather than throws — it reports
 * a layer as skipped and moves on — while a pull script has nothing useful to
 * do after a failed read except say so and exit.
 *
 * Rate limits. Figma answers 429 with a `Retry-After` in seconds; the client
 * sleeps for that, or for an exponential backoff when the header is missing,
 * and tries again up to RETRIES times before giving up. 5xx is retried the same
 * way, since a file the size of the kit occasionally times out on the first
 * `/nodes` read of a heavy page and succeeds on the second.
 *
 * Batching. `/nodes?ids=` takes a comma-separated list in the query string and
 * the URL has a length cap the API does not document; empirically a few
 * thousand characters is safe and more is a 414 or a silent 400. Callers pass
 * every id they want and `getNodes` splits them to stay under IDS_CHARS,
 * merging the `nodes` maps back into one. A node the file does not hold comes
 * back as `null`, which is what the API does for a missing id in a batch.
 *
 * Fixtures. FIGMA_REST_FIXTURE_DIR points the client at a directory of saved
 * responses instead of the network, so a pull script and its distiller can be
 * proved to reproduce a committed catalog without a token and without Figma.
 * The layout mirrors the paths:
 *
 *   <dir>/<fileKey>/file.json             GET /v1/files/:key            (query ignored)
 *   <dir>/<fileKey>/components.json       GET /v1/files/:key/components
 *   <dir>/<fileKey>/component_sets.json   GET /v1/files/:key/component_sets
 *   <dir>/<fileKey>/styles.json           GET /v1/files/:key/styles
 *   <dir>/<fileKey>/variables-local.json  GET /v1/files/:key/variables/local
 *   <dir>/<fileKey>/nodes.json            GET /v1/files/:key/nodes      (filtered to ?ids)
 *
 * `nodes.json` holds one `nodes` map for the whole file and the client returns
 * the slice a request asked for; `depth` is not applied, so a fixture holds
 * whatever depth the scripts under test need. A `<name>.error.json` beside any
 * of these, shaped `{ "status": 403, "body": "..." }`, makes that endpoint fail
 * the way Figma would, which is how the Enterprise gate on variables is
 * exercised without an Enterprise seat. A path with no fixture is a 404 naming
 * the file the client looked for.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const API = 'https://api.figma.com/v1';

const RETRIES = 5;
const IDS_CHARS = 1800;

export class FigmaError extends Error {
  constructor(status, body, path) {
    super(`${status} from Figma for ${path}: ${body}`);
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

/**
 * FIGMA_TOKEN, or exit 1 with the same message shape pull-published.mjs prints.
 *
 * The scopes named in the message are the ones the read needs: `/components`,
 * `/component_sets` and `/styles` sit behind library_content:read, `/files` and
 * `/nodes` behind file_content:read. Personal access tokens created without
 * them come back 403, and a 403 that says "scope" sends the reader to the right
 * dialog where a bare 403 does not.
 */
export function requireToken(script, scopes = 'file_content:read and library_content:read') {
  const token = process.env.FIGMA_TOKEN;
  if (token) return token;
  console.error(
    'FIGMA_TOKEN is not set.\n\n' +
      'Create a personal access token at figma.com > Settings > Security, with the\n' +
      `${scopes} scopes, then:\n\n` +
      `  FIGMA_TOKEN=figd_... node scripts/${script}`,
  );
  process.exit(1);
}

export const fixtureDir = () => process.env.FIGMA_REST_FIXTURE_DIR || null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fixturePath(path) {
  const m = /^\/files\/([^/?]+)(?:\/(.*))?$/.exec(path);
  if (!m) return null;
  const [, key, rest] = m;
  const name = !rest ? 'file' : rest.replace(/\//g, '-');
  return join(fixtureDir(), key, `${name}.json`);
}

function serveFixture(path, query) {
  const file = fixturePath(path);
  if (!file) throw new FigmaError(404, `no fixture route for ${path}`, path);
  const errorFile = file.replace(/\.json$/, '.error.json');
  if (existsSync(errorFile)) {
    const { status, body } = JSON.parse(readFileSync(errorFile, 'utf8'));
    throw new FigmaError(status, body, path);
  }
  if (!existsSync(file)) throw new FigmaError(404, `no fixture at ${file}`, path);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  if (!path.endsWith('/nodes')) return json;
  const ids = String(query.ids ?? '').split(',').filter(Boolean);
  const nodes = {};
  for (const id of ids) nodes[id] = json.nodes?.[id] ?? null;
  return { ...json, nodes };
}

/**
 * One GET against the API, parsed. Throws FigmaError on anything that is not a
 * 200 after the retries are spent.
 */
export async function figmaGet(path, query = {}) {
  if (fixtureDir()) return serveFixture(path, query);

  const token = process.env.FIGMA_TOKEN;
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let attempt = 0;
  for (;;) {
    const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
    if (res.ok) return res.json();
    const body = (await res.text()).slice(0, 300);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRIES) throw new FigmaError(res.status, body, path);
    const after = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt;
    console.error(`  ${res.status} from Figma, retrying in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    attempt++;
  }
}

/**
 * `GET /files/:key/nodes` for every id, batched under the URL cap and merged.
 * Returns `{ nodes, name, lastModified, version }`, `nodes` keyed by id with
 * `null` for ids the file does not hold.
 */
export async function getNodes(fileKey, ids, { depth, geometry } = {}) {
  const unique = [...new Set(ids)];
  const batches = [];
  let batch = [];
  let chars = 0;
  for (const id of unique) {
    if (batch.length && chars + id.length + 1 > IDS_CHARS) {
      batches.push(batch);
      batch = [];
      chars = 0;
    }
    batch.push(id);
    chars += id.length + 1;
  }
  if (batch.length) batches.push(batch);

  const out = { nodes: {}, name: null, lastModified: null, version: null };
  for (const b of batches) {
    const res = await figmaGet(`/files/${fileKey}/nodes`, { ids: b.join(','), depth, geometry });
    out.name ??= res.name ?? null;
    out.lastModified ??= res.lastModified ?? null;
    out.version ??= res.version ?? null;
    for (const id of b) out.nodes[id] = res.nodes?.[id] ?? null;
  }
  return out;
}

/**
 * Both component listings for a file, as the published membership the plugin
 * captures had to ask `getPublishStatusAsync()` for.
 *
 * `/components` enumerates variants — every child of a published set appears
 * under its own key with `containing_frame.containingComponentSet` naming the
 * set — so the owners a catalog keys on are the sets plus the components that
 * sit in no set. The older `containingStateGroup` field says the same thing
 * and is read as a fallback.
 *
 * Returns `{ owners, byNode, variants }`: `owners` in listing order with
 * `{ key, nodeId, type, name, pageId, pageName }`, `byNode` the same keyed by
 * node id, and `variants` the entries that were dropped for living in a set.
 */
export async function publishedOwners(fileKey) {
  const [comps, sets] = await Promise.all([
    figmaGet(`/files/${fileKey}/components`),
    figmaGet(`/files/${fileKey}/component_sets`),
  ]);
  const components = comps?.meta?.components;
  const componentSets = sets?.meta?.component_sets;
  if (!Array.isArray(components) || !Array.isArray(componentSets)) {
    throw new Error(`unexpected response shape from /files/${fileKey}/components or /component_sets`);
  }
  const entry = (m, type) => ({
    key: m.key,
    nodeId: m.node_id,
    type,
    name: m.name,
    pageId: m.containing_frame?.pageId ?? null,
    pageName: m.containing_frame?.pageName ?? null,
    updatedAt: m.updated_at ?? null,
  });
  const owners = componentSets.map((m) => entry(m, 'COMPONENT_SET'));
  const variants = [];
  for (const m of components) {
    const set = m.containing_frame?.containingComponentSet ?? m.containing_frame?.containingStateGroup;
    if (set) variants.push(entry(m, 'COMPONENT'));
    else owners.push(entry(m, 'COMPONENT'));
  }
  return { owners, byNode: new Map(owners.map((o) => [o.nodeId, o])), variants };
}

/** The pages of a file, in document order, as `{ id, name }`. */
export async function pagesOf(fileKey) {
  const file = await figmaGet(`/files/${fileKey}`, { depth: 1 });
  const children = file?.document?.children;
  if (!Array.isArray(children)) throw new Error(`unexpected response shape from /files/${fileKey}`);
  return children.filter((c) => c.type === 'CANVAS').map((c) => ({ id: c.id, name: c.name }));
}

/**
 * What a failed read means, phrased for the reader. Mirrors `unreachable` in
 * freshness.mjs; the file key is named because the Annotation Kit is granted
 * separately from the kit and a 404 on the wrong one is the wrong dialog.
 */
export function explain(err, fileKey) {
  if (!(err instanceof FigmaError)) return err.message;
  switch (err.status) {
    case 401:
      return '401 from Figma — the token is invalid or expired.';
    case 403:
      return `403 from Figma — the token lacks the scope for ${err.path}.\n${err.body}`;
    case 404:
      return `404 from Figma — no access to ${fileKey}, or the file moved.\n${err.body}`;
    case 429:
      return '429 from Figma — rate limited after every retry; wait a minute and re-run.';
    default:
      return err.message;
  }
}

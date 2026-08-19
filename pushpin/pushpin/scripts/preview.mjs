#!/usr/bin/env node
/**
 * The static server behind a browser prototype. Loopback only, no caching, and
 * it identifies itself.
 *
 * Usage: node scripts/preview.mjs [--root <dir>] [--port <n>]
 *
 * Why this exists rather than `python3 -m http.server`. That one sends
 * `Last-Modified` and no `Cache-Control`, which leaves the browser free to apply
 * heuristic freshness — it guesses a lifetime from the file's age and serves
 * `app.js` from disk without revalidating. On a prototype edited every few
 * minutes that guess is always wrong, and the failure is silent and expensive:
 * the page runs an old build while the source on screen says otherwise, so a
 * fixed bug looks unfixed and the next fix is aimed at the wrong thing.
 *
 * Started by `hooks/pushpin-preview.mjs`, detached, so it outlives the turn that
 * started it. It can also be run directly to serve a directory.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

import { DEFAULT_PORT, IDENTITY_PATH } from './lib/preview.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);

if (flag('--help') || flag('-h')) {
  console.log(
    'usage: node scripts/preview.mjs [--root <dir>] [--port <n>]\n\n' +
      'Serves a directory over loopback with caching turned off, so the browser\n' +
      'cannot answer a reload from a copy of the file you just edited.\n\n' +
      '  --root  the directory to serve. Default: the working directory.\n' +
      `  --port  the port to bind. Default: ${DEFAULT_PORT}.`,
  );
  process.exit(0);
}

const ROOT = resolve(opt('--root', process.cwd()));
const PORT = Number(opt('--port', DEFAULT_PORT));

if (!existsSync(ROOT)) {
  console.error(`No such directory: ${ROOT}`);
  process.exit(1);
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Not a port: ${opt('--port', '')}`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/**
 * Logging that cannot take the server down with it.
 *
 * This process outlives the terminal that started it. Once nothing is reading
 * the other end, a write raises — and because logging happens while a response
 * is being composed, an unguarded one would throw inside the request handler
 * before anything was sent. The port would stay open and answer nothing, which
 * reads as a hung page rather than a dead server: the expensive way to fail. A
 * lost log line is the cheap one.
 */
const log = (line) => {
  try {
    process.stdout.write(`${line}\n`);
  } catch {
    // Nothing is listening. Carry on serving.
  }
};
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

/**
 * The file a request resolves to, or null if it escapes the root.
 *
 * Traversal is checked after normalizing rather than by pattern, so an encoded
 * `..` is caught by the same test as a plain one.
 */
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const abs = normalize(join(ROOT, decoded));
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;

  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return null;
  }
  if (stat.isDirectory()) {
    const index = join(abs, 'index.html');
    try {
      return statSync(index).isFile() ? { abs: index, stat: statSync(index) } : null;
    } catch {
      return null;
    }
  }
  return { abs, stat };
}

const server = createServer((req, res) => {
  // Every response, including the errors. A cached 404 from a file that exists
  // now is the same silent staleness in a different costume.
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Expires', '0');

  const url = req.url ?? '/';

  if (url.split('?')[0] === IDENTITY_PATH) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ pushpin: 'preview', root: ROOT, port: PORT, pid: process.pid }));
    return;
  }

  const file = resolveFile(url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
    log(`404 ${url}`);
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(file.abs).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': file.stat.size,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(file.abs);
  // A read that fails mid-response cannot be turned into a status code — the
  // headers are already out — so the connection is dropped instead, which the
  // browser reports as a failed request rather than a truncated file.
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  console.error(String(err?.message ?? err));
  process.exit(1);
});

// Loopback only. A prototype is unreleased design work, and binding it to every
// interface publishes it to the network the laptop happens to be on.
server.listen(PORT, '127.0.0.1', () => {
  log(`serving ${ROOT} on http://localhost:${PORT}/ (no-store)`);
});

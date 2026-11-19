#!/usr/bin/env node
/**
 * Where Thumbtack Rise comes from, and putting it where a browser and Figma
 * look for it.
 *
 * The plugin never carries the font. Its repository is public and the face is
 * licensed from &Walsh with all rights reserved, so a copy committed here is a
 * copy published. What it carries instead is a pointer into Thumbtack's own
 * private repositories, read with the person's GitHub login through `gh`, so
 * the access check is GitHub's and nothing secret is stored anywhere.
 *
 * Each source is pinned by its git blob sha rather than by its path. The blob
 * endpoint answers for the sha wherever the file sits in that repository, so a
 * rename or a move there does not break the read, and the bytes are hashed on
 * arrival so a different file can never be written under this name.
 *
 * Two files because there are two consumers. A browser takes the variable
 * WOFF2 beside the stylesheet, which `pushpin.css` loads with `@font-face`.
 * macOS cannot install a WOFF2, and Figma's desktop app reads only installed
 * fonts, so the machine gets the same variable face as a TTF. The only WOFF2
 * copies live in prototype repositories, which is why its source is the one
 * most likely to move; the TTF ships with the iOS app.
 *
 * Without GitHub access, the Brand Asset Library's Drive folder is the way in.
 * Drive will not serve a file to a script that is not signed in, so the person
 * downloads it in a browser and `installSystemFont()` picks it up from
 * ~/Downloads. That folder holds the static OTFs and no variable face, so it
 * installs the machine and never the project. `writeWebFont()` looks in
 * ~/Downloads too, for the pinned WOFF2 itself, so placing that one file
 * anywhere Thumbtack can download it is what gets the project its font without
 * GitHub.
 *
 * Usage:
 *   node scripts/lib/font.mjs --install   # install Rise on this machine
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { riseFontInstalled } from './environment.mjs';

export const WEB_FONT = {
  repo: 'thumbtack/company-context-layer',
  path: 'public/pushpin/fonts/ThumbtackRiseVF__1_.woff2',
  sha: 'a9a2386c9213cfde62c245ec18fb434a1f7318a4',
};

export const DESKTOP_FONT = {
  repo: 'thumbtack/ios',
  path: 'ThumbprintUI/ThumbprintPrivateResources/Resources/Fonts/ThumbtackRise.ttf',
  sha: 'e96f32eca712c2093e4e92c3e101bea13f059670',
};

/** Where the web font lands, relative to the stylesheet that loads it. */
export const WEB_FONT_REL = join('fonts', 'ThumbtackRiseVF.woff2');

/**
 * The `wght` axis of the pinned face. `@font-face` has to declare it, or a
 * browser treats the file as one weight and synthesizes every other one.
 */
export const WEIGHT_RANGE = [291, 836];

export const BRAND_ASSET_LIBRARY =
  'https://drive.google.com/drive/folders/1IpQmx6aW4fPFQgLISRW0svw8k9uqzvf7';

const FONT_DIR = join(homedir(), 'Library', 'Fonts');
const DESKTOP_NAME = 'ThumbtackRiseVF.ttf';
const DOWNLOADS = join(homedir(), 'Downloads');

/** The sha git names a blob by, so a download is checked against the pin itself. */
export const blobSha = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/**
 * One pinned file from GitHub, as `{ bytes }` or `{ reason }`.
 *
 * The reasons are written for the person, because they are relayed: the one
 * thing anyone can do about a failed read is install `gh`, sign in, or ask
 * for access, and the sentence has to say which.
 */
export function fetchFont(source) {
  let out;
  try {
    out = execFileSync('gh', ['api', `repos/${source.repo}/git/blobs/${source.sha}`, '--jq', '.content'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (e) {
    if (e.code === 'ENOENT') return { reason: 'the GitHub CLI is not installed' };
    const err = String(e.stderr ?? '');
    if (/auth login|not logged|authentication/i.test(err)) {
      return { reason: 'the GitHub CLI is not signed in' };
    }
    if (/not found|404|SAML|SSO/i.test(err)) {
      return { reason: `this GitHub account cannot read ${source.repo}` };
    }
    return { reason: `GitHub did not answer (${err.trim().split('\n')[0] || e.message})` };
  }
  const bytes = Buffer.from(out.replace(/\s/g, ''), 'base64');
  if (blobSha(bytes) !== source.sha) {
    return { reason: `${source.repo} returned a file that is not the pinned font` };
  }
  return { bytes };
}

/** Whether a file is the pinned web font: `absent`, `current`, or `other`. */
export function webFontState(abs) {
  if (!existsSync(abs)) return 'absent';
  return blobSha(readFileSync(abs)) === WEB_FONT.sha ? 'current' : 'other';
}

/**
 * Puts the web font at `abs`, returning null on success or the reason it
 * failed. GitHub first; then a copy in ~/Downloads, taken only when it hashes
 * to the pin, so anyone who can download the file in a browser gets the real
 * face without GitHub access.
 */
export function writeWebFont(abs) {
  const got = fetchFont(WEB_FONT);
  let bytes = got.bytes;
  if (!bytes) {
    const found = downloadedFonts(isWebFontFile);
    try {
      const match = found.files.map((f) => readFileSync(f)).find((b) => blobSha(b) === WEB_FONT.sha);
      if (match) bytes = match;
    } finally {
      found.cleanup();
    }
  }
  if (!bytes) return got.reason;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
  return null;
}

const isRiseFile = (name) => /^thumbtack ?rise.*\.(otf|ttf)$/i.test(name);
const isWebFontFile = (name) => /^thumbtack ?rise.*\.woff2$/i.test(name);

/**
 * Rise font files the person downloaded from Drive. Downloading a whole Drive
 * folder produces a zip, which Safari unpacks into a folder and Chrome does
 * not, so both a folder one level down and a zip are looked inside.
 */
function downloadedFonts(isWanted = isRiseFile) {
  let entries;
  try {
    entries = readdirSync(DOWNLOADS, { withFileTypes: true });
  } catch {
    return { files: [], cleanup: () => {} };
  }
  const files = [];
  const temps = [];
  for (const e of entries) {
    const abs = join(DOWNLOADS, e.name);
    if (e.isFile() && isWanted(e.name)) files.push(abs);
    else if (e.isDirectory() && /rise/i.test(e.name)) {
      try {
        for (const f of readdirSync(abs)) {
          if (isWanted(f) && statSync(join(abs, f)).isFile()) files.push(join(abs, f));
        }
      } catch {}
    } else if (e.isFile() && /rise.*\.zip$/i.test(e.name)) {
      const out = mkdtempSync(join(tmpdir(), 'pushpin-rise-'));
      temps.push(out);
      try {
        execFileSync('unzip', ['-o', '-j', '-q', abs, '-d', out], { stdio: 'ignore' });
        for (const f of readdirSync(out)) if (isWanted(f)) files.push(join(out, f));
      } catch {}
    }
  }
  // One copy per file name, however many places it was found in.
  const unique = [...new Map(files.map((f) => [basename(f).toLowerCase(), f])).values()];
  return { files: unique, cleanup: () => temps.forEach((t) => rmSync(t, { recursive: true, force: true })) };
}

/**
 * Installs Rise into ~/Library/Fonts: the pinned TTF from GitHub, or failing
 * that whatever the person downloaded from the Brand Asset Library.
 *
 * @returns {{ state: 'present' | 'installed' | 'missing' | 'unsupported',
 *   from?: 'github' | 'downloads', files?: string[], reason?: string }}
 */
export function installSystemFont() {
  if (platform() !== 'darwin') return { state: 'unsupported' };
  if (riseFontInstalled()) return { state: 'present' };

  const got = fetchFont(DESKTOP_FONT);
  if (got.bytes) {
    mkdirSync(FONT_DIR, { recursive: true });
    const dest = join(FONT_DIR, DESKTOP_NAME);
    writeFileSync(dest, got.bytes);
    return { state: 'installed', from: 'github', files: [dest] };
  }

  const found = downloadedFonts();
  try {
    if (found.files.length) {
      mkdirSync(FONT_DIR, { recursive: true });
      const files = found.files.map((f) => {
        const dest = join(FONT_DIR, basename(f));
        copyFileSync(f, dest);
        return dest;
      });
      return { state: 'installed', from: 'downloads', files };
    }
  } finally {
    found.cleanup();
  }
  return { state: 'missing', reason: got.reason };
}

/** What to tell someone GitHub could not serve, with the one place left to get it. */
export const driveRemedy = (reason) =>
  `Thumbtack Rise could not be downloaded from GitHub because ${reason}. Download the ` +
  `Thumbtack Rise fonts from the Brand Asset Library into your Downloads folder — ` +
  `${BRAND_ASSET_LIBRARY} — then ask me to install the font again.`;

// ----------------------------------------------------------------- as a command

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--install')) {
    console.error('usage: node scripts/lib/font.mjs --install');
    process.exit(1);
  }
  const r = installSystemFont();
  if (r.state === 'present') console.log('Thumbtack Rise is already installed on this machine.');
  else if (r.state === 'unsupported') console.log('Installing fonts is macOS only; nothing was written.');
  else if (r.state === 'installed') {
    console.log(`Installed Thumbtack Rise: ${r.files.join(', ')}`);
    console.log('Restart Figma if it is open, so it sees the font.');
  } else console.log(`say: ${driveRemedy(r.reason)}`);
}

/**
 * Content hashing shared by manifest.mjs and verify.mjs.
 *
 * JSON is hashed in a canonical form — keys sorted, whitespace dropped — so
 * reformatting a capture is not reported as a content change. Only a real
 * change to a value, name, or key moves the hash.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v);
}

export function hashAsset(path) {
  const raw = readFileSync(path, 'utf8');
  const body = path.endsWith('.json') ? canonical(JSON.parse(raw)) : raw;
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

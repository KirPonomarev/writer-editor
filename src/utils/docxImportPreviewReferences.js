'use strict';

const { randomBytes } = require('node:crypto');

// Main-owned, disposable snapshots. A reference grants no mutation authority:
// the command adapter still validates the resolved report/plan and admission.
function createDocxImportPreviewReferences({
  now = Date.now,
  maxEntries = 64,
  maxSnapshotBytes = 4 * 1024 * 1024,
  maxTotalBytes = 16 * 1024 * 1024,
  ttlMs = 10 * 60 * 1000,
} = {}) {
  for (const limit of [maxEntries, maxSnapshotBytes, maxTotalBytes, ttlMs]) {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new TypeError('DOCX_REFERENCE_LIMIT_INVALID');
  }
  const entries = new Map();
  let totalBytes = 0;
  const remove = (key) => {
    const entry = entries.get(key);
    if (entry) totalBytes -= entry.bytes;
    entries.delete(key);
  };
  const prune = () => {
    const time = now();
    for (const [key, entry] of entries) if (time >= entry.expiresAt) remove(key);
  };
  const validContext = (context) => typeof context === 'string' && context.length > 0 && context.length <= 8192;
  return Object.freeze({
    remember(kind, value, context) {
      if (!['content', 'plan'].includes(kind) || !validContext(context)) return '';
      if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
      let json;
      try { json = JSON.stringify(value); } catch { return ''; }
      if (typeof json !== 'string') return '';
      const bytes = Buffer.byteLength(json);
      if (bytes > maxSnapshotBytes || bytes > maxTotalBytes) return '';
      prune();
      while (entries.size >= maxEntries || totalBytes + bytes > maxTotalBytes) {
        remove(entries.keys().next().value);
      }
      const reference = randomBytes(32).toString('hex');
      entries.set(reference, { kind, context, json, bytes, expiresAt: now() + ttlMs });
      totalBytes += bytes;
      return reference;
    },
    resolve(kind, reference, context) {
      if (typeof reference !== 'string' || !/^[a-f0-9]{64}$/u.test(reference) || !validContext(context)) return null;
      prune();
      const entry = entries.get(reference);
      if (!entry || entry.kind !== kind || entry.context !== context) return null;
      return JSON.parse(entry.json);
    },
    clear() { entries.clear(); totalBytes = 0; },
  });
}

module.exports = { createDocxImportPreviewReferences };

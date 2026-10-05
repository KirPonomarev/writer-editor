'use strict';
// Main-only storage encoding. This module confers no round or write authority.
const { createHash } = require('node:crypto');
const { deflateRawSync, inflateRawSync } = require('node:zlib');
const { TextDecoder } = require('node:util');
const ENCODED_MAX_BYTES = 16 * 1024 * 1024;
const DECODED_MAX_BYTES = 64 * 1024 * 1024;
const LEGACY_RECOVERY_MAX_BYTES = 32 * 1024 * 1024;
const SCHEMA = 'yalken.rtk.word.product-review-docx-export.authority-store.v4';
const LEGACY_SCHEMA = 'yalken.rtk.word.product-review-docx-export.authority-store.v2';
const fail = code => { throw Object.assign(Error(code), { code }); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function checkStructure(value) {
  const stack = [[value, 0]], seen = new Set(); let nodes = 0;
  while (stack.length) {
    const [item, depth] = stack.pop();
    if (++nodes > 1000000 || depth > 64) fail('RTK_ROUND_STORE_STRUCTURE_BUDGET');
    if (item && typeof item === 'object') {
      if (seen.has(item)) fail('RTK_ROUND_STORE_STRUCTURE_INVALID');
      seen.add(item);
      if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) fail('RTK_ROUND_STORE_STRUCTURE_INVALID');
      const keys = Array.isArray(item) ? null : Object.keys(item);
      const length = keys ? keys.length : item.length;
      if (nodes + stack.length + length > 1000000) fail('RTK_ROUND_STORE_STRUCTURE_BUDGET');
      for (let i = 0; i < length; i++) stack.push([item[keys ? keys[i] : i], depth + 1]);
    } else if (!['string', 'boolean', 'number'].includes(typeof item) && item !== null) fail('RTK_ROUND_STORE_STRUCTURE_INVALID');
    else if (typeof item === 'number' && !Number.isFinite(item)) fail('RTK_ROUND_STORE_STRUCTURE_INVALID');
  }
  if (!value || value.schemaVersion !== LEGACY_SCHEMA) fail('RTK_ROUND_STORE_VERSION_UNSUPPORTED');
  if (!value.roundsById || Array.isArray(value.roundsById) || typeof value.roundsById !== 'object'
    || Object.keys(value.roundsById).length > 128) fail('RTK_ROUND_STORE_ROUND_BUDGET');
  return value;
}
// Scan nesting before JSON.parse allocates a deeply nested graph. Full node and
// semantic validation follows; strings cannot manufacture nesting.
function parse(text) {
  let depth = 0, quoted = false, escaped = false, nodes = 0;
  const count = () => { if (++nodes > 1000000) fail('RTK_ROUND_STORE_STRUCTURE_BUDGET'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') {
        quoted = false;
        let next = i + 1; while (next < text.length && /\s/.test(text[next])) next++;
        if (text[next] !== ':') count(); // Object keys are not graph values.
      }
    } else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') { count(); if (++depth > 65) fail('RTK_ROUND_STORE_STRUCTURE_BUDGET'); }
    else if (c === '}' || c === ']') depth--;
    else if (c === 't' || c === 'f' || c === 'n') { count(); i += c === 'f' ? 4 : 3; }
    else if (c === '-' || (c >= '0' && c <= '9')) {
      count(); while (i + 1 < text.length && /[0-9eE+.\-]/.test(text[i + 1])) i++;
    }
  }
  try { return JSON.parse(text); } catch { fail('RTK_ROUND_STORE_INVALID'); }
}
function encode(record) {
  checkStructure(record);
  const bytes = Buffer.from(JSON.stringify(record), 'utf8');
  if (bytes.length > DECODED_MAX_BYTES) fail('RTK_ROUND_STORE_DECODED_BUDGET');
  const payload = deflateRawSync(bytes).toString('base64');
  const text = JSON.stringify({ schemaVersion: SCHEMA, encoding: 'deflate-raw-base64',
    decodedByteLength: bytes.length, decodedSha256: digest(bytes), payload }) + '\n';
  if (Buffer.byteLength(text) > ENCODED_MAX_BYTES) fail('RTK_ROUND_STORE_ENCODED_BUDGET');
  return text;
}
function decode(text, { allowLegacyRecovery = false } = {}) {
  if (typeof text !== 'string') fail('RTK_ROUND_STORE_INVALID');
  const byteLength = Buffer.byteLength(text);
  if (byteLength > (allowLegacyRecovery ? LEGACY_RECOVERY_MAX_BYTES : ENCODED_MAX_BYTES)) fail('RTK_ROUND_STORE_ENCODED_BUDGET');
  const envelope = parse(text);
  if (envelope?.schemaVersion === LEGACY_SCHEMA) return checkStructure(envelope);
  // The larger read allowance applies only to a fully validated legacy record.
  if (byteLength > ENCODED_MAX_BYTES) fail('RTK_ROUND_STORE_ENCODED_BUDGET');
  if (envelope?.schemaVersion !== SCHEMA) fail('RTK_ROUND_STORE_VERSION_UNSUPPORTED');
  const keys = ['schemaVersion', 'encoding', 'decodedByteLength', 'decodedSha256', 'payload'];
  if (Object.keys(envelope).length !== keys.length || keys.some(key => !Object.hasOwn(envelope, key))
    || envelope.encoding !== 'deflate-raw-base64' || !Number.isSafeInteger(envelope.decodedByteLength)
    || envelope.decodedByteLength < 1 || !/^[0-9a-f]{64}$/.test(envelope.decodedSha256)
    || typeof envelope.payload !== 'string' || (envelope.payload.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(envelope.payload))) fail('RTK_ROUND_STORE_ENVELOPE_INVALID');
  if (envelope.decodedByteLength > DECODED_MAX_BYTES) fail('RTK_ROUND_STORE_DECODED_BUDGET');
  const compressed = Buffer.from(envelope.payload, 'base64');
  if (compressed.toString('base64') !== envelope.payload) fail('RTK_ROUND_STORE_ENVELOPE_INVALID');
  let result;
  try { result = inflateRawSync(compressed, { maxOutputLength: envelope.decodedByteLength, info: true }); }
  catch { fail('RTK_ROUND_STORE_COMPRESSION_INVALID'); }
  if (result.engine.bytesWritten !== compressed.length) fail('RTK_ROUND_STORE_COMPRESSION_INVALID');
  const bytes = result.buffer;
  if (bytes.length !== envelope.decodedByteLength || digest(bytes) !== envelope.decodedSha256) fail('RTK_ROUND_STORE_INTEGRITY_INVALID');
  let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('RTK_ROUND_STORE_INVALID'); }
  return checkStructure(parse(decoded));
}
module.exports = Object.freeze({ encode, decode, SCHEMA, LEGACY_SCHEMA, ENCODED_MAX_BYTES, DECODED_MAX_BYTES, LEGACY_RECOVERY_MAX_BYTES });

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const codec = require('../../src/core/word-review-authority-codec-v1.cjs');
const record = () => ({ schemaVersion: codec.LEGACY_SCHEMA, roundsById: { first: { body: 'Роман '.repeat(100) } }, lastRoundId: 'first', authorityStoreDigest: 'unchanged' });
function encodedRaw(bytes) {
  return JSON.stringify({ schemaVersion: codec.SCHEMA, encoding: 'deflate-raw-base64', decodedByteLength: bytes.length,
    decodedSha256: crypto.createHash('sha256').update(bytes).digest('hex'), payload: zlib.deflateRawSync(bytes).toString('base64') });
}
test('authority codec preserves complete legacy graph and digest without mutating it', () => {
  const before = record(), original = JSON.stringify(before), encoded = codec.encode(before);
  assert.equal(JSON.stringify(before), original); assert.equal(JSON.parse(encoded).schemaVersion, codec.SCHEMA);
  assert.deepEqual(codec.decode(encoded), before); assert.deepEqual(codec.decode(original), before);
});
for (const [name, mutate, code] of [
  ['version', e => e.schemaVersion += '.future', 'VERSION_UNSUPPORTED'],
  ['unknown field', e => e.authority = true, 'ENVELOPE_INVALID'],
  ['encoding', e => e.encoding = 'gzip', 'ENVELOPE_INVALID'],
  ['declared overlimit', e => e.decodedByteLength = codec.DECODED_MAX_BYTES + 1, 'DECODED_BUDGET'],
  ['wrong length', e => e.decodedByteLength++, 'INTEGRITY_INVALID'],
  ['wrong hash', e => e.decodedSha256 = '0'.repeat(64), 'INTEGRITY_INVALID'],
  ['base64', e => e.payload += '!', 'ENVELOPE_INVALID'],
  ['truncated', e => e.payload = Buffer.from(e.payload, 'base64').subarray(0, -2).toString('base64'), 'COMPRESSION_INVALID'],
  ['trailing', e => e.payload = Buffer.concat([Buffer.from(e.payload, 'base64'), Buffer.from('unconsumed')]).toString('base64'), 'COMPRESSION_INVALID'],
  ['bomb', e => e.decodedByteLength = 10, 'COMPRESSION_INVALID'],
]) test('authority codec rejects ' + name, () => {
  const e = JSON.parse(codec.encode(record())); mutate(e);
  assert.throws(() => codec.decode(JSON.stringify(e)), new RegExp('RTK_ROUND_STORE_' + code));
});
test('authority codec bounds legacy recovery separately; encoded allowance never expands', () => {
  const r = record(); r.padding = 'x'.repeat(codec.ENCODED_MAX_BYTES);
  const raw = JSON.stringify(r);
  assert.throws(() => codec.decode(raw), /ENCODED_BUDGET/);
  assert.deepEqual(codec.decode(raw, { allowLegacyRecovery: true }), r);
  assert.throws(() => codec.decode(' '.repeat(codec.LEGACY_RECOVERY_MAX_BYTES + 1), { allowLegacyRecovery: true }), /ENCODED_BUDGET/);
  const e = JSON.parse(codec.encode(record())); e.payload = 'A'.repeat(codec.ENCODED_MAX_BYTES);
  assert.throws(() => codec.decode(JSON.stringify(e), { allowLegacyRecovery: true }), /ENCODED_BUDGET/);
});
test('authority codec rejects decoded overflow, deep graphs, excessive nodes and rounds before encode', () => {
  const big = record(); big.padding = 'x'.repeat(codec.DECODED_MAX_BYTES);
  assert.throws(() => codec.encode(big), /DECODED_BUDGET/);
  const deep = record(); let next = deep; for (let i = 0; i < 65; i++) next = next.child = {};
  assert.throws(() => codec.encode(deep), /STRUCTURE_BUDGET/);
  assert.throws(() => codec.decode(encodedRaw(Buffer.from(JSON.stringify(deep)))), /STRUCTURE_BUDGET/);
  const nodes = record(); nodes.values = Array(1000000).fill(0);
  assert.throws(() => codec.encode(nodes), /STRUCTURE_BUDGET/);
  assert.throws(() => codec.decode(encodedRaw(Buffer.from(JSON.stringify(nodes)))), /STRUCTURE_BUDGET/);
  const rounds = record(); rounds.roundsById = Object.fromEntries(Array.from({ length: 129 }, (_, i) => [i, {}]));
  assert.throws(() => codec.encode(rounds), /ROUND_BUDGET/);
});
test('authority codec rejects incompressible over-budget output and malformed UTF8', () => {
  const r = record(); r.padding = crypto.randomBytes(14 * 1024 * 1024).toString('base64');
  assert.throws(() => codec.encode(r), /ENCODED_BUDGET/);
  assert.throws(() => codec.decode(encodedRaw(Buffer.from([0xff]))), /STORE_INVALID/);
});

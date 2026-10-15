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

function denseRound(id) {
  return { roundId: id, projectRoot: '/owned/project', keyRef: 'keyref:' + id,
    lifecycleState: 'PUBLISHED_ACTIVE', recordVersion: 2,
    paragraphs: Array.from({ length: 8391 }, (_, i) => ({
      properties: Array.from({ length: 40 }, (_, j) => i + j),
      text: `paragraph-${i}:` + 'Ялкен роман '.repeat(160),
    })) };
}
test('indexed authority retains five complete dense capsules beyond the old aggregate structural budget', () => {
  const first = denseRound('one'), store = { ...record(), schemaVersion: codec.INDEX_SCHEMA, roundsById: {}, lastRoundId: '' };
  const contentDigest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  for (let i = 0; i < 5; i++) {
    const id = 'dense-' + i, round = { ...first, roundId: id, keyRef: 'keyref:' + id };
    store.roundsById[id] = codec.packRound(round); store.lastRoundId = id;
  }
  const reopened = codec.decode(codec.encode(store));
  assert.equal(Object.keys(reopened.roundsById).length, 5);
  for (const [id, round] of Object.entries(reopened.roundsById)) {
    const complete = codec.unpackRound(round);
    assert.equal(contentDigest({ ...complete, lifecycleState: undefined, recordVersion: undefined }),
      contentDigest({ ...first, roundId: id, keyRef: 'keyref:' + id, lifecycleState: undefined, recordVersion: undefined }));
    assert.equal(complete.lifecycleState, 'PUBLISHED_ACTIVE'); assert.equal(complete.recordVersion, 2);
    assert.equal(complete.paragraphs.length, 8391);
  }
  // Legacy aggregate bounds remain real: three distinct rich objects still
  // fail. Indexing changes representation, never disables that safeguard.
  const legacy = record(); legacy.roundsById = Object.fromEntries(Array.from({ length: 3 }, (_, i) => [i, structuredClone(first)]));
  assert.throws(() => codec.encode(legacy), /STRUCTURE_BUDGET/);
});

function smallIndexed() {
  const round = { roundId: 'one', projectRoot: '/owned/project', keyRef: 'keyref:one', lifecycleState: 'PUBLISHED_ACTIVE', recordVersion: 2,
    baseline: { text: 'Complete immutable source', empty: '', tabs: '\t', emoji: '🙂' } };
  return { schemaVersion: codec.INDEX_SCHEMA, lastRoundId: 'one', roundsById: { one: codec.packRound(round) } };
}
for (const [name, mutate, code] of [
  ['hot round id', r => r.roundId = 'foreign', 'PAYLOAD_BINDING'],
  ['hot project', r => r.projectRoot = '/foreign/project', 'PAYLOAD_BINDING'],
  ['hot key', r => r.keyRef = 'foreign', 'PAYLOAD_BINDING'],
  ['unknown hot field', r => r.hmacSecret = 'must-never-persist', 'PAYLOAD_INVALID'],
  ['bad state type', r => r.lifecycleState = null, 'PAYLOAD_INVALID'],
  ['bad version', r => r.recordVersion = 0, 'PAYLOAD_INVALID'],
  ['unknown payload format', r => r.roundPayloadSchema += '.future', 'PAYLOAD_BINDING'],
  ['corrupt retained body', r => { const e = JSON.parse(r.payload); e.decodedSha256 = '0'.repeat(64); r.payload = JSON.stringify(e); }, 'INTEGRITY_INVALID'],
  ['oversized retained body', r => { const e = JSON.parse(r.payload); e.decodedByteLength = codec.DECODED_MAX_BYTES + 1; r.payload = JSON.stringify(e); }, 'DECODED_BUDGET'],
  ['recursive indexed payload', r => r.payload = codec.encode(smallIndexed()), 'PAYLOAD_RECURSIVE'],
  ['unencoded legacy body', r => r.payload = JSON.stringify(record()), 'PAYLOAD_RECURSIVE'],
  ['cold mutable lifecycle', r => { const body = codec.decode(r.payload); body.roundsById.one.lifecycleState = 'PUBLISHED_ACTIVE'; r.payload = codec.encode(body); }, 'PAYLOAD_BINDING'],
  ['self-consistent wrong body binding', r => { const body = codec.decode(r.payload); body.roundsById.one.projectRoot = '/other'; r.payload = codec.encode(body); }, 'PAYLOAD_BINDING'],
]) test('indexed authority rejects ' + name + ' even with a self-consistent outer envelope', () => {
  const s = smallIndexed(); mutate(s.roundsById.one);
  const raw = encodedRaw(Buffer.from(JSON.stringify(s)));
  assert.throws(() => codec.decode(raw), new RegExp('RTK_ROUND_STORE_' + code));
  assert.throws(() => codec.encode(s), new RegExp('RTK_ROUND_STORE_' + code));
});
test('indexed authority preserves unchanged cold bytes across terminal lifecycle updates', () => {
  const s = smallIndexed(), first = structuredClone(s.roundsById.one);
  s.roundsById.one.lifecycleState = 'EXPIRED'; s.roundsById.one.recordVersion++;
  s.roundsById.one.updatedAt = '2026-10-15T00:00:00Z'; s.roundsById.one.terminalReceipt = { state: 'EXPIRED', digest: 'complete' };
  const after = codec.decode(codec.encode(s)).roundsById.one;
  assert.equal(after.payload, first.payload);
  const full = codec.unpackRound(after); assert.deepEqual(full.baseline, codec.unpackRound(first).baseline);
  assert.equal(full.lifecycleState, 'EXPIRED'); assert.equal(full.recordVersion, 3);
  assert.equal(full.updatedAt, s.roundsById.one.updatedAt); assert.deepEqual(full.terminalReceipt, s.roundsById.one.terminalReceipt);
  const legacy = { ...s, schemaVersion: codec.LEGACY_SCHEMA };
  assert.throws(() => codec.encode(legacy), /PAYLOAD_RECURSIVE/);
  const oversizedRawIndex = JSON.stringify({ ...s, padding: 'x'.repeat(codec.ENCODED_MAX_BYTES) });
  assert.throws(() => codec.decode(oversizedRawIndex, { allowLegacyRecovery: true }), /ENCODED_BUDGET/);
});
for (const kind of ['bytes', 'values']) test('indexed authority bounds cumulative cold verification ' + kind, () => {
  const s = smallIndexed(); s.roundsById = {};
  for (let i = 0; i < (kind === 'bytes' ? 5 : 7); i++) {
    const id = 'total-' + i, round = { roundId: id, projectRoot: '/owned', keyRef: id, lifecycleState: 'PUBLISHED_ACTIVE', recordVersion: 2,
      ...(kind === 'bytes' ? { padding: 'x'.repeat(54 * 1024 * 1024) } : { values: Array(600000).fill(0) }) };
    s.roundsById[id] = codec.packRound(round); s.lastRoundId = id;
  }
  const code = kind === 'bytes' ? /DECODED_BUDGET/ : /STRUCTURE_BUDGET/;
  assert.throws(() => codec.encode(s), code);
  assert.throws(() => codec.decode(encodedRaw(Buffer.from(JSON.stringify(s)))), code);
});

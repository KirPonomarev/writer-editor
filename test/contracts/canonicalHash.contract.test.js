const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', 'reviewIrKernel.mjs')).href);
}

test('canonical hash is stable across object key order', async () => {
  const { canonicalHash, canonicalJson } = await loadKernel();
  const left = { b: 2, a: { d: 4, c: 3 }, list: [{ z: 'last', y: 'first' }] };
  const right = { list: [{ y: 'first', z: 'last' }], a: { c: 3, d: 4 }, b: 2 };

  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(canonicalHash(left), canonicalHash(right));
});

test('canonical hash records newline and unicode policy in hashed input', async () => {
  const { canonicalHash, createSourceViewState, normalizeText } = await loadKernel();
  const nfc = createSourceViewState({
    revisionToken: 'r-1',
    viewMode: 'inline',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
  });
  const none = createSourceViewState({
    revisionToken: 'r-1',
    viewMode: 'inline',
    newlinePolicy: 'LF',
    unicodePolicy: 'NONE',
  });

  assert.equal(normalizeText('a\r\nb', { unicodePolicy: 'NFC' }), 'a\nb');
  assert.notEqual(canonicalHash(nfc), canonicalHash(none));
});

test('canonical json rejects nondeterministic values', async () => {
  const { canonicalJson } = await loadKernel();
  const cyclic = {};
  cyclic.self = cyclic;

  assert.throws(() => canonicalJson({ value: Number.NaN }), /non-finite/u);
  assert.throws(() => canonicalJson({ value: undefined }), /undefined/u);
  assert.throws(() => canonicalJson({ fn() {} }), /function/u);
  assert.throws(() => canonicalJson(cyclic), /cyclic/u);
});

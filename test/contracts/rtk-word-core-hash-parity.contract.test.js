'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const hashing = require('../../src/core/browser-safe-hash.cjs');
const core = path.resolve(__dirname, '../../src/core');
const native = input => crypto.createHash('sha256').update(input).digest('hex');
const names = ['word-comment-authoring-v1.cjs', 'word-comment-anchor-save-v1.cjs',
  'word-comment-return-delta-v1.cjs', 'word-manuscript-notes-v1.cjs'];

// Same domain code with the independent former Node crypto implementation.
// No fixture-derived digest can serve as the oracle for its own hash.
function nativeOracleModules() {
  const cache = new Map();
  const load = name => {
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(core, name), source = fs.readFileSync(filename, 'utf8');
    const module = { exports: {} }; cache.set(name, module);
    const local = createRequire(filename);
    const requireOracle = spec => spec === './browser-safe-hash.cjs' ? { sha256UpdateCompatible: native }
      : names.includes(path.basename(spec)) ? load(path.basename(spec)) : local(spec);
    vm.runInThisContext(`(function(require,module,exports,__dirname,__filename){${source}\n})`, { filename })
      (requireOracle, module, module.exports, core, filename);
    return module.exports;
  };
  return Object.fromEntries(names.map(name => [name, load(name)]));
}

test('Shared pure CJS and unchanged ESM API preserve known SHA256 and UTF8/canonical hashes', async () => {
  const esm = await import('../../src/core/browser-safe-hash.mjs');
  assert.deepEqual(Object.keys(esm).sort(), ['canonicalSerialize', 'hashCanonicalValue', 'sha256Hex']);
  assert.equal(esm.sha256Hex, hashing.sha256Hex);
  assert.equal(hashing.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hashing.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hashing.sha256Hex('a'.repeat(1000000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  for (const text of ['', 'Ялкен Word 世界 😀 e\u0301', 'a\0b\r\n\t', '\ud800', '\udc00', '\ud800a\udc00',
    ...[55,56,63,64,65,127,128,129].map(length => 'x'.repeat(length)), 'x'.repeat(8 * 1024 * 1024)]) {
    assert.equal(hashing.sha256Hex(text), native(text));
    assert.equal(hashing.sha256UpdateCompatible(text), native(text));
  }
  for (const input of [undefined, null, false, 3, Symbol('symbol'), { toString: () => 'coerced' }])
    assert.equal(esm.sha256Hex(input), native(String(input)), 'existing ESM coercion remains unchanged');
  const value = { z: [null, false, Infinity, '😀'], a: { y: 2, x: 'e\u0301' } };
  assert.equal(esm.canonicalSerialize(value), '{"a":{"x":"é","y":2},"z":[null,false,null,"😀"]}');
  assert.equal(esm.hashCanonicalValue(value), native(esm.canonicalSerialize(value)));
});

test('Former Node.update public byteview API hashes exact raw slice and rejects unsupported types', () => {
  const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
  const buffer = Buffer.from([0,255,128,240,159,152,128,1,2,3,4,5,6,7,8,9]);
  const memory = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const views = [buffer, buffer.subarray(2, 11), new Uint8Array(memory), new Uint8Array(memory, 3, 7),
    new Uint8ClampedArray(memory, 4, 5), new Int8Array(memory, 2, 6), new Uint16Array(memory, 2, 3),
    new Int16Array(memory, 2, 3), new Uint32Array(memory, 4, 2), new Int32Array(memory, 4, 2),
    new Float32Array(memory, 4, 2), new Float64Array(memory, 0, 2), new BigInt64Array(memory, 0, 2),
    new BigUint64Array(memory, 0, 2), new DataView(memory, 1, 7), new DataView(memory, 16, 0)];
  for (const input of views) {
    const before = Buffer.from(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
    assert.equal(hashing.sha256UpdateCompatible(input), native(input));
    assert.equal(notes.sha(input), native(input));
    assert.deepEqual(Buffer.from(new Uint8Array(input.buffer, input.byteOffset, input.byteLength)), before);
  }
  for (const input of [undefined, null, 42, true, {}, [], memory, new String('abc'), Symbol('not-bytes')]) {
    assert.throws(() => native(input), { code: 'ERR_INVALID_ARG_TYPE' });
    assert.throws(() => hashing.sha256UpdateCompatible(input), { name: 'TypeError', code: 'ERR_INVALID_ARG_TYPE' });
    assert.throws(() => notes.sha(input), { name: 'TypeError', code: 'ERR_INVALID_ARG_TYPE' });
  }
});

test('Four Core domain modules preserve complete comment, anchor, return and note outputs against Node crypto', async () => {
  const oracle = nativeOracleModules(), authorName = names[0], saveName = names[1], returnName = names[2], notesName = names[3];
  const models = Object.fromEntries(names.map(name => [name, require(path.join(core, name))]));
  const sceneId = 'roman/scene.txt', projectId = 'hash-parity', text = 'Before anchor 世界 👩🏽‍💻 e\u0301';
  const input = { beforeText: null, projectId, sceneId, sceneSha256: native(text), paragraphs: [text], now: '2026-09-30T00:00:00Z',
    input: { requestId: 'unicode-root', action: 'create', projectId, sceneId, subjectId: 'subject',
      expectedStateSha256: '', expectedSceneSha256: native(text), body: 'Точная\nсноска 🧭',
      anchor: { paragraphIndex: 0, startUtf16: 7, selectedText: 'anchor' } } };
  const authored = models[authorName].planCommentAuthoring(input);
  assert.deepEqual(authored, oracle[authorName].planCommentAuthoring(input));
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const content = value => envelope.composeObservablePayload({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] } });
  const saveInput = { beforeText: authored.afterText, projectId, sceneId, beforeContent: content(text), afterContent: content('Prefix ' + text) };
  assert.deepEqual(models[saveName].planCommentAnchorSave(saveInput), oracle[saveName].planCommentAnchorSave(saveInput));
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich 😀 世界', marks: [{ type: 'bold' }] }] }] };
  const noteInput = { kind: 'footnote', body, sceneId, offsetUtf16: 7, sceneContent: text };
  assert.deepEqual(models[notesName].bindManuscriptPayload(noteInput), oracle[notesName].bindManuscriptPayload(noteInput));
  const imported = { candidates: [{ kind: 'footnote', body, paragraphIndex: 0, offsetUtf16: 7 }], sceneContent: text,
    projectId, sceneId, importOperationId: 'unicode-note-import', beforeText: null, createdAt: '2026-09-30T00:00:00Z' };
  assert.deepEqual(models[notesName].materializeImportedNotes(imported), oracle[notesName].materializeImportedNotes(imported));
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId, projectRoot: '/synthetic', nonTextReturnState: authored.state,
    scenes: [{ sceneId, scenePath: '/synthetic/' + sceneId, order: 0, text,
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  const bytes = buildDocxReviewPacketBuffer(source), analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes },
    { cryptoPort: { sha256Text: native, sha256Json: value => 'sha256:' + native(hashing.canonicalSerialize(value)), byteLength: value => Buffer.byteLength(value) } });
  assert.equal(analysis.ok, true, JSON.stringify(analysis));
  const returnInput = { beforeText: authored.afterText, projectId, roundId: 'hash-parity-round', artifactSha256: native(bytes),
    baseline: source.commentExport, exportMap: source.localAuthorityCapsule.exportMap,
    returnedThreads: analysis.reviewIr.commentThreads, returnedParagraphs: analysis.reviewIr.formattingParagraphs };
  assert.deepEqual(models[returnName].planCommentReturnDelta(returnInput), oracle[returnName].planCommentReturnDelta(returnInput));
  const changedReturn = { ...returnInput, returnedThreads: structuredClone(returnInput.returnedThreads) };
  changedReturn.returnedThreads[0].body = 'Changed Unicode 世界 😀';
  const changed = models[returnName].planCommentReturnDelta(changedReturn);
  assert.deepEqual(changed, oracle[returnName].planCommentReturnDelta(changedReturn));
  assert.equal(changed.unchanged, undefined);
  assert.match(changed.afterText, /Changed Unicode 世界 😀/);
});

test('Pure implementation retains UTF8 fallback and bundles for browser without Node effects', async () => {
  const fallback = { module: { exports: {} }, TextEncoder: undefined };
  vm.runInNewContext(fs.readFileSync(path.join(core, 'browser-safe-hash.cjs'), 'utf8'), fallback);
  for (const text of ['ASCII', 'Ялкен 世界 😀', '\ud800x\udc00', 'e\u0301']) assert.equal(fallback.module.exports.sha256Hex(text), native(text));
  const esbuild = require('esbuild');
  const built = await esbuild.build({ stdin: { contents: "import {sha256Hex,hashCanonicalValue} from './browser-safe-hash.mjs';globalThis.hashResult=[sha256Hex('Ялкен 😀'),hashCanonicalValue({b:2,a:1})];", resolveDir: core },
    bundle: true, platform: 'browser', format: 'iife', write: false, logLevel: 'silent' });
  const browser = { TextEncoder };
  vm.runInNewContext(built.outputFiles[0].text, browser);
  assert.deepEqual(Array.from(browser.hashResult), [native('Ялкен 😀'), native('{"a":1,"b":2}')]);
});

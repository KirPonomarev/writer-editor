'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const builder = require('../../src/export/docx/docxReviewPacketBuilder');
const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
function slice(start, end) {
  const a = main.indexOf(start), b = main.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a);
  return main.slice(a, b);
}
async function harness(raw, changes = {}) {
  const envelope = await import(pathToFileURL(path.join(ROOT, 'src/renderer/documentContentEnvelope.mjs')));
  const bridge = await import(pathToFileURL(path.join(ROOT, 'src/io/revisionBridge/index.mjs')));
  let keyImports = 0;
  const context = vm.createContext({
    Buffer, crypto, path, Date,
    isDirty: false, autoSaveInProgress: false, currentFilePath: '/synthetic/roman/scene.txt',
    fs: { readFile: async () => raw },
    isAllowedFilePath: () => true,
    getDocumentContextFromPath: () => ({ kind: 'scene' }),
    DOCX_REVIEW_PREVIEW_SESSION_ALLOWED_CONTEXT_KINDS: new Set(['scene']),
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectId: 'project-test', projectRoot: '/synthetic', manifestPath: '/synthetic/manifest.json' }),
    getProjectRelativeFilePath: () => 'roman/scene.txt',
    docxReviewPreviewSessionDetailString: value => typeof value === 'string' ? value : '',
    loadDocumentContentEnvelopeModule: async () => envelope,
    loadRevisionBridgeModule: async () => bridge,
    computeHash: hash,
    cloneJsonSafe: plain,
    isPlainObjectValue: value => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    buildDocxReviewPacketBufferCore: builder.buildDocxReviewPacketBuffer,
    REVIEW_DOCX_TYPOGRAPHY_DEFAULTS: builder.REVIEW_DOCX_TYPOGRAPHY_DEFAULTS,
    deriveWordBookmarkNameV1Cjs: builder.deriveWordBookmarkNameV1,
    buildFormatIrParagraphs,
    importDocxReviewRoundKey: async ({ roundId }) => { keyImports++; return { keyRef: 'opaque-key', keyIdHex: 'a'.repeat(32), roundIdHex: roundId.slice(6) }; },
    activeReviewDocxExportAuthorityStore: null,
    REVIEW_DOCX_RETURN_AUTHORITY_STORE_SCHEMA: 'yalken.rtk.word.product-review-docx-export.authority-store.v2',
    ...changes,
  });
  const constants = slice('const REVIEW_DOCX_PACKET_PROFILE_ID =', 'function makeTypedReviewDocxExportError');
  const source = slice('function stableRtkReviewTransportJson(', 'function normalizeRtkSignedSha256(')
    + constants + slice('function base64UrlEncodeReviewDocxPacketText(', 'async function readFullManuscriptDocxReviewPacketExportSource(');
  vm.runInContext(source, context);
  return { run: () => context.readDocxReviewPacketExportSource(), keys: () => keyImports, context, envelope };
}
function doc(paragraphs) {
  return { type: 'doc', content: paragraphs.map(text => ({ type: 'paragraph', attrs: { textAlign: null }, ...(text ? { content: [{ type: 'text', text }] } : {}) })) };
}
test('C2 reexport uses rich paragraphs while signing the exact saved envelope bytes', async () => {
  const envelope = await import(pathToFileURL(path.join(ROOT, 'src/renderer/documentContentEnvelope.mjs')));
  const paragraphs = ['  Привет Café 🧑‍💻  ', '', '', 'שלום 中文', 'final  '];
  const rich = doc(paragraphs);
  rich.content[0].content[0].marks = [{ type: 'bold' }];
  const raw = envelope.composeObservablePayload({ doc: rich });
  const h = await harness(raw);
  const source = await h.run();
  assert.deepEqual(plain(source.blocks.map(b => b.text)), paragraphs);
  assert.equal(source.exportCapsule.rawSha256, 'sha256:' + hash(raw));
  assert.equal(source.exportCapsule.sceneRevision, 'sha256:' + hash(raw));
  assert.equal(source.exportCapsule.blockCount, paragraphs.length);
  assert.equal(h.keys(), 1);
  const xml = builder.buildDocxReviewPacketBuffer(source).toString('utf8');
  assert.ok(xml.includes('Привет Café 🧑‍💻'));
  assert.ok(xml.includes('<w:b/>'));
  assert.ok(!xml.includes('[doc-v2 length='));
  const expectedTypography = { schemaVersion: 'yalken.review-docx.typography-defaults.v1', fontSize: '12pt' };
  assert.deepEqual(plain(source.pendingAuthorityStore.roundsById[source.exportCapsule.roundId].exportMap.exportTypography), expectedTypography);
  // Typography authority remains in the main-owned round record, never the returned advisory map.
  assert.equal(source.advisoryManifest.coreManifest.exportMap.exportTypography, undefined);
  const mapped = source.advisoryManifest.coreManifest.exportMap.scenes[0].blocks;
  assert.equal(mapped.length, paragraphs.length);
  assert.deepEqual(plain(mapped.map(b => b.formatIr)), plain(source.blocks.map(b => b.formatIr)));
});
test('Plain scene leading and trailing spaces and empty paragraphs remain unchanged', async () => {
  const raw = '\n  leading  \n\ntrailing  \n';
  const source = await (await harness(raw)).run();
  assert.deepEqual(plain(source.blocks.map(b => b.text)), raw.split('\n'));
  assert.equal(source.sceneText, raw);
  assert.equal(source.exportCapsule.rawSha256, 'sha256:' + hash(raw));
});
test('Malformed envelope fails before authority allocation', async () => {
  const envelope = await import(pathToFileURL(path.join(ROOT, 'src/renderer/documentContentEnvelope.mjs')));
  const conflict = envelope.composeObservablePayload({ doc: doc(['visible']) }) + '\nconflicting text';
  for (const raw of ['[doc-v2 length=20]\n{}', '[doc-v2 length=1]\n{', conflict]) {
    const h = await harness(raw);
    await assert.rejects(h.run(), /REVIEW_DOCX_EXPORT_DOCUMENT_ENVELOPE_INVALID/);
    assert.equal(h.keys(), 0);
  }
});
test('Unsupported rich structure fails before export authority', async () => {
  const h = await harness('ignored', { loadDocumentContentEnvelopeModule: async () => ({ parseObservablePayload: () => ({ text: 'hidden', doc: { type: 'doc', content: [{ type: 'unsupported', content: [{ type: 'text', text: 'hidden' }] }] } }) }) });
  await assert.rejects(h.run(), /FULL_MANUSCRIPT_FORMAT_IR_DOCUMENT_STRUCTURE_UNSUPPORTED/);
  assert.equal(h.keys(), 0);
});
test('Dirty editor still blocks source reads and authority allocation', async () => {
  const h = await harness('saved', { isDirty: true });
  await assert.rejects(h.run(), /REVIEW_DOCX_EXPORT_DIRTY_EDITOR_BLOCKED/);
  assert.equal(h.keys(), 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { extractParts } = require('../fixtures/r24-wp703-docx-profile-fixtures.js');
const { buildZip } = require('../fixtures/r24-wp701-parser-quarantine-fixtures.js');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const admission = require('../fixtures/docx-import-real-authority.cjs');
const ROOT = path.resolve(__dirname, '../..');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SAMPLE = 'google-c4-native-review-returned.docx';
const input = () => fs.readFileSync(path.join(ROOT, 'test/fixtures/revision-bridge', SAMPLE));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rewrite = (bytes, mutate) => {
  const parts = extractParts(bytes);mutate(parts);
  return buildZip([...parts].map(([name, data]) => ({ name, data })));
};
const changeMain = (bytes, fn) => rewrite(bytes, p => p.set('word/document.xml', fn(p.get('word/document.xml').toString())));
async function read(bytes = input(), profile = true) {
  const io = await import('../../src/io/revisionBridge/index.mjs');
  const preview = io.buildDocxContentPreviewFromZipBytes(profile ? { bytes, manuscriptProfile: 'YALKEN_MANUSCRIPT_V1' } : bytes);
  return { preview, plan: io.buildDocxNovelImportPreviewPlanFromContentPreview(preview) };
}
function oracle(bytes) {
  const parts = extractParts(bytes), parser = new DOMParser({ onError: (level, m) => { throw Error(level + ':' + m); } });
  const dom = parser.parseFromString(parts.get('word/document.xml').toString(), 'application/xml');
  const own = (p, n) => Array.from(p.childNodes).filter(x => x.nodeType === 1 && x.namespaceURI === W && (!n || x.localName === n));
  const body = own(dom.documentElement, 'body')[0];
  const text = (node, mode) => {
    if (node.nodeType !== 1) return '';
    if (node.namespaceURI !== W) throw Error('FOREIGN_ORACLE_NODE');
    if (mode === 'current' && node.localName === 'del' || mode === 'original' && node.localName === 'ins') return '';
    if (['t', 'delText'].includes(node.localName)) return node.textContent;
    if (node.localName === 'tab') return '\t';
    if (['br', 'cr'].includes(node.localName)) return '\n';
    return own(node).map(x => text(x, mode)).join('');
  };
  const rows = own(body, 'p');
  const comments = parser.parseFromString(parts.get('word/comments.xml').toString(), 'application/xml');
  return { current: rows.map(p => text(p, 'current')).join('\n'), original: rows.map(p => text(p, 'original')).join('\n'),
    union: rows.map(p => text(p, 'union')).join('\n'), bodies: own(comments.documentElement, 'comment').map(c => own(c, 'p').map(p => text(p, 'current')).join('\n')) };
}
const identity = () => ({ projectId: crypto.randomUUID(), projectName: 'Small Google manuscript', operationId: 'google-small', createdAtUtc: '2026-10-17T00:00:00.000Z' });

test('original small Google DOCX retains full independent text, revisions and insertion discussion in a new project', async t => {
  const bytes = input(), before = sha(bytes), expected = oracle(bytes);
  assert.equal(before, 'f1bb75df191e945aeb2be29eccc4eaf71448195322eac2b31cc5f0ecf1689515');
  const { preview, plan } = await read(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview.diagnostics));assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(preview.sourceArtifactSha256, before);
  const { prepareDocxNewProject } = await import('../../src/core/docx-new-project-v1.mjs');
  const id = identity(), model = prepareDocxNewProject({ plan, ...id });
  assert.equal(model.summary.revisionCount, 2);assert.equal(model.summary.commentCount, 1);
  const scene = model.files.find(f => f.role === 'scene'), doc = envelope.parseObservablePayload(scene.content).doc;
  const projection = pending.projection(doc), ledger = pending.readLedger(doc);
  assert.equal(projection.current, expected.current);assert.equal(projection.original, expected.original);
  assert.equal(ledger.revisions[0].nativeId, '0');assert.equal(ledger.revisions[1].nativeId, '0');
  assert.equal(ledger.revisions[0].groupId, ledger.revisions[1].groupId);
  const state = JSON.parse(model.files.find(f => f.role === 'comments').content), thread = state.threads[0];
  assert.equal(thread.messages[0].body, expected.bodies[0]);
  assert.equal(thread.anchor.sceneParagraphIndex, 0);assert.equal(thread.anchor.startUtf16, 31);
  assert.equal(thread.anchor.selectedText, 'sentinel omeg');
  assert.equal(expected.current.split('\n')[0].slice(thread.anchor.startUtf16,thread.anchor.startUtf16+thread.anchor.selectedText.length),'sentinel omeg');
  for (const choice of ['accepted', 'rejected']) {
    const decision = pending.decide(doc, { revisionId: ledger.revisions[0].id, action: choice === 'accepted' ? 'accept' : 'reject' });
    assert.equal(pending.projection(decision.doc).current, choice === 'accepted' ? expected.current : expected.original);
  }
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-google-small-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const { createDocxNewProject } = await import('../../src/product/docxNewProjectCreateV1.mjs');
  admission.rememberDocxImportPreviewPlanAdmission(plan);
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(parent, '.authority'), useLeaseHeartbeatWorker: false });
  const created = await createDocxNewProject({ plan, identity: id, parentDirectoryPath: parent, ownership: {}, transactionAuthority: authority, assertPublication: async () => {} });
  assert.equal(created.created, true);
  for (const file of model.files) assert.equal(fs.readFileSync(path.join(created.projectRoot, file.relativePath), 'utf8'), file.content);
  assert.equal(fs.readFileSync(created.manifestPath, 'utf8'), model.manifestText);
  assert.equal(sha(input()), before);
});

test('strict profile does not inherit manuscript normalization', async () => {
  const { preview, plan } = await read(input(), false);
  assert.equal(preview.ok, false);assert.equal(plan.ok, false);
  assert.equal(preview.reason, 'PENDING_REVISIONS_USER_BOOKMARK_UNSUPPORTED');
});

module.exports = { rewrite, changeMain, oracle };

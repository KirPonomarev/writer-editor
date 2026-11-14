const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadFlowModeModule() {
  const root = process.cwd();
  return import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'flowMode.mjs')).href);
}

async function loadEnvelopeModule() {
  const root = process.cwd();
  return import(pathToFileURL(path.join(root, 'src', 'renderer', 'documentContentEnvelope.mjs')).href);
}

test('M7 flow mode compose is deterministic and keeps scene markers', async () => {
  const flow = await loadFlowModeModule();
  const envelope = await loadEnvelopeModule();
  const scenes = [
    { title: 'One', content: envelope.composeObservablePayload({ doc: envelope.buildParagraphDocumentFromText('Alpha') }) },
    { title: 'Two', content: envelope.composeObservablePayload({ doc: envelope.buildParagraphDocumentFromText('Beta\nGamma\n') }) },
  ];
  const out = flow.composeFlowDocument(scenes);

  assert.equal(
    out,
    '---[ SCENE 1: One ]---\nAlpha\n\n---[ SCENE 2: Two ]---\nBeta\nGamma\n',
  );
  assert.equal(flow.composeFlowDocument(scenes), out);
});

test('M7 flow mode save payload validates scene markers and mapping', async () => {
  const flow = await loadFlowModeModule();
  const envelope = await loadEnvelopeModule();
  const text = [
    '---[ SCENE 1: One ]---',
    'Alpha',
    '',
    '---[ SCENE 2: Two ]---',
    'Beta',
    '',
  ].join('\n');
  const refs = [
    { path: '/tmp/a.txt', title: 'One', kind: 'scene', content: '' },
    { path: '/tmp/b.txt', title: 'Two', kind: 'scene', content: '' },
  ];
  const payload = flow.buildFlowSavePayload(text, refs);
  assert.equal(payload.ok, true);
  assert.equal(payload.scenes[0].path, '/tmp/a.txt');
  assert.equal(payload.scenes[1].path, '/tmp/b.txt');
  assert.equal(envelope.parseObservablePayload(payload.scenes[0].content).text, 'Alpha');
  assert.equal(envelope.parseObservablePayload(payload.scenes[1].content).text, 'Beta');

  const mismatch = flow.buildFlowSavePayload('---[ SCENE 1: One ]---\nOnly one', refs);
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error.code, 'M7_FLOW_MARKER_COUNT_MISMATCH');
});

test('M7 flow mode save payload blocks lossy rich content refs', async () => {
  const flow = await loadFlowModeModule();
  const envelope = await loadEnvelopeModule();
  const refs = [
    {
      path: '/tmp/a.txt',
      title: 'One',
      kind: 'scene',
      content: envelope.composeObservablePayload({
        doc: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Alpha', marks: [{ type: 'bold' }] }],
            },
          ],
        },
      }),
    },
  ];

  const payload = flow.buildFlowSavePayload('---[ SCENE 1: One ]---\nAlpha\n', refs);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'M7_FLOW_SCENE_RICH_CONTENT_UNSUPPORTED');
  assert.equal(payload.error.reason, 'flow_scene_rich_content_unsupported');
});

test('M7 flow mode save payload preserves unchanged structured rich docs', async () => {
  const flow = await loadFlowModeModule();
  const envelope = await loadEnvelopeModule();
  const structuredDoc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Alpha' },
          { type: 'hardBreak' },
          { type: 'text', text: 'Beta' },
        ],
      },
    ],
  };
  const refs = [
    {
      path: '/tmp/a.txt',
      title: 'One',
      kind: 'scene',
      content: envelope.composeObservablePayload({ doc: structuredDoc }),
    },
  ];

  const payload = flow.buildFlowSavePayload('---[ SCENE 1: One ]---\nAlpha\nBeta\n', refs);
  assert.equal(payload.ok, true);
  const parsed = envelope.parseObservablePayload(payload.scenes[0].content);
  assert.deepEqual(parsed.doc, envelope.canonicalizeDocumentJson(structuredDoc));
});

test('M7 flow mode boundary helpers move caret between scenes only at boundaries', async () => {
  const flow = await loadFlowModeModule();
  const text = [
    '---[ SCENE 1: One ]---',
    'A',
    '',
    '---[ SCENE 2: Two ]---',
    'B',
    '',
  ].join('\n');

  const next = flow.nextSceneCaretAtBoundary(text, text.indexOf('---[ SCENE 2: Two ]---') - 1);
  assert.ok(Number.isInteger(next));
  assert.equal(text.slice(next, next + 1), 'B');

  const prev = flow.previousSceneCaretAtBoundary(text, text.indexOf('B'));
  assert.ok(Number.isInteger(prev));
  const secondSceneMarker = text.indexOf('---[ SCENE 2: Two ]---');
  assert.equal(prev < secondSceneMarker, true);
  assert.equal(prev > text.indexOf('A'), true);
});

test('M7 flow mode status message is deterministic for open/save actions', async () => {
  const flow = await loadFlowModeModule();
  assert.equal(
    flow.buildFlowModeStatus('open', 3),
    'Flow mode opened (3) · Shift+S save · ArrowUp/ArrowDown jump scenes',
  );
  assert.equal(
    flow.buildFlowModeStatus('save', 2),
    'Flow mode saved (2) · Shift+S save · ArrowUp/ArrowDown jump scenes',
  );
  assert.equal(
    flow.buildFlowModeStatus('open', -1),
    'Flow mode opened (0) · Shift+S save · ArrowUp/ArrowDown jump scenes',
  );
});

test('M8 kickoff status helper appends deterministic kickoff hint only when enabled', async () => {
  const flow = await loadFlowModeModule();
  const base = flow.buildFlowModeStatus('open', 2);
  const kickoff = flow.buildFlowModeKickoffStatus('open', 2, { m8Kickoff: true });
  const disabled = flow.buildFlowModeKickoffStatus('open', 2, { m8Kickoff: false });

  assert.equal(base, 'Flow mode opened (2) · Shift+S save · ArrowUp/ArrowDown jump scenes');
  assert.equal(kickoff, `${base} · M8 kickoff`);
  assert.equal(disabled, base);
});


test('M7 modern Flow accepts only plain editor defaults without losing author data', async (t) => {
  const flow = await loadFlowModeModule();
  const envelope = await loadEnvelopeModule();
  const { createHash } = require('node:crypto');
  const ordinaryText = 'N96_BETA_BEGIN\nBeta source 👩🏽‍💻 İ Σσς العربية 漢字\nN96_BETA_END\nN96_SAVE_ONE 😀 é العربية 漢字 END_ONE';
  const defaults = (doc) => {
    doc.attrs = { wordPendingRevisions: null, wordUserBookmarks: null };
    for (const paragraph of doc.content) paragraph.attrs = { textAlign: null };
  };
  const cases = [
    { name: 'doc pending null only', decorate: (doc) => { doc.attrs = { wordPendingRevisions: null }; } },
    { name: 'doc bookmarks null only', decorate: (doc) => { doc.attrs = { wordUserBookmarks: null }; } },
    { name: 'paragraph alignment null only', decorate: (doc) => { for (const paragraph of doc.content) paragraph.attrs = { textAlign: null }; } },
    { name: 'actual ordinary editor defaults', decorate: defaults },
    { name: 'empty paragraph and mixed Unicode', text: 'Alpha 😀 é\n\nİ Σσς العربية 漢字', decorate: defaults },
    { name: 'unchanged visible ordinary editor text', unchanged: true, decorate: defaults },
  ];
  for (const row of cases) await t.test(row.name, () => {
    const oldText = row.text || ordinaryText;
    const nextText = row.unchanged ? oldText : oldText + '\nN96_SAVE_TWO 🧭 İ Σσς العربية 漢字 END_TWO';
    const doc = envelope.buildParagraphDocumentFromText(oldText);
    row.decorate(doc);
    const docBefore = JSON.stringify(doc);
    const serializedBefore = envelope.serializeDocumentJson(doc);
    const meta = { synopsis: 'Keep synopsis 😀\nSecond line', status: 'черновик', tags: { pov: 'Beta', line: 'خط', place: '漢字' } };
    const cards = [{ title: 'Keep card', text: 'Keep 🤝\nSecond line', tags: 'local' }];
    const content = envelope.composeObservablePayload({ doc, metaEnabled: true, meta, cards });
    assert.equal(envelope.parseObservablePayload(content).issue, null);
    assert.equal(envelope.analyzeDocumentPlainTextRoundTrip(doc).safe, false, 'global analysis remains strict');
    const refs = [{
      path: 'roman/Imported/02_Beta.txt', sceneId: 'roman/Imported/02_Beta.txt',
      nodeId: 'tree-node-2412286ddf330a3e916a0f1af8c9700f',
      baselineHash: createHash('sha256').update(content).digest('hex'),
      title: 'Beta', kind: 'scene', content,
    }];
    const refsBefore = JSON.stringify(refs);
    const projection = flow.composeFlowReadProjection(refs);
    assert.equal(projection.ok, true);
    assert.equal(projection.scenes[0].sceneId, refs[0].sceneId);
    const payload = flow.buildFlowProjectionSavePayload('Beta\n\n' + nextText + '\n', refs);
    assert.equal(payload.ok, true, JSON.stringify(payload.error));
    assert.equal(payload.scenes.length, 1);
    const scene = payload.scenes[0];
    for (const key of ['path', 'sceneId', 'nodeId', 'baselineHash', 'title', 'kind']) assert.equal(scene[key], refs[0][key]);
    const saved = envelope.parseObservablePayload(scene.content);
    assert.equal(saved.issue, null);
    assert.equal(saved.text, nextText);
    assert.deepEqual(saved.meta, meta);
    assert.deepEqual(saved.cards, cards);
    assert.equal(saved.hasMetaBlock, true);
    assert.equal(saved.hasCardsBlock, true);
    assert.equal(JSON.stringify(refs), refsBefore);
    assert.equal(JSON.stringify(doc), docBefore);
    assert.equal(envelope.serializeDocumentJson(doc), serializedBefore, 'global serialization remains unchanged');
    assert.equal(envelope.analyzeDocumentPlainTextRoundTrip(doc).safe, false, 'only the private Flow comparison may omit defaults');
  });
});

test('M7 modern Flow still refuses explicit rich or unrecognized attributes beside editor defaults', async (t) => {
  const flow = await loadFlowModeModule();
  const envelope = await loadEnvelopeModule();
  const { createHash } = require('node:crypto');
  const cases = [
    { name: 'unknown doc null', decorate: (doc) => { doc.attrs.unknownSemantic = null; } },
    { name: 'unknown paragraph null', decorate: (doc) => { doc.content[0].attrs.unknownSemantic = null; } },
    { name: 'paragraph default misplaced on doc', decorate: (doc) => { doc.attrs.textAlign = null; } },
    { name: 'pending default misplaced on paragraph', decorate: (doc) => { doc.content[0].attrs.wordPendingRevisions = null; } },
    { name: 'bookmark default misplaced on paragraph', decorate: (doc) => { doc.content[0].attrs.wordUserBookmarks = null; } },
    { name: 'explicit left alignment', decorate: (doc) => { doc.content[0].attrs.textAlign = 'left'; } },
    { name: 'explicit centered alignment', decorate: (doc) => { doc.content[0].attrs.textAlign = 'center'; } },
    { name: 'empty string is not null', decorate: (doc) => { doc.content[0].attrs.textAlign = ''; } },
    { name: 'false is not null', decorate: (doc) => { doc.content[0].attrs.textAlign = false; } },
    { name: 'valid non-null canonical bookmark state', decorate: (doc) => { doc.attrs.wordUserBookmarks = { schemaVersion: 'yalken.word-user-bookmarks.v1', revision: 1, bookmarks: [] }; } },
    { name: 'bold mark', decorate: (doc) => { doc.content[0].content[0].marks = [{ type: 'bold' }]; } },
    { name: 'changed heading structure', decorate: (doc) => { doc.content[0] = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Alpha' }] }; } },
    { name: 'changed hard-break structure', decorate: (doc) => { doc.content[0].content = [{ type: 'text', text: 'Alpha' }, { type: 'hardBreak' }, { type: 'text', text: 'Beta' }]; } },
    { name: 'paragraph default misplaced on text', decorate: (doc) => { doc.content[0].content[0].attrs = { textAlign: null }; } },
  ];
  for (const row of cases) await t.test(row.name, () => {
    const doc = envelope.buildParagraphDocumentFromText('Alpha');
    doc.attrs = { wordPendingRevisions: null, wordUserBookmarks: null };
    doc.content[0].attrs = { textAlign: null };
    row.decorate(doc);
    const before = JSON.stringify(doc);
    const content = envelope.composeObservablePayload({ doc });
    const parsed = envelope.parseObservablePayload(content);
    assert.equal(parsed.issue, null, 'fixture is a valid document, not a decoder failure');
    const refs = [{
      path: 'roman/Imported/02_Beta.txt', sceneId: 'roman/Imported/02_Beta.txt',
      nodeId: 'tree-node-2412286ddf330a3e916a0f1af8c9700f',
      baselineHash: createHash('sha256').update(content).digest('hex'),
      title: 'Beta', kind: 'scene', content,
    }];
    const refsBefore = JSON.stringify(refs);
    const payload = flow.buildFlowProjectionSavePayload('Beta\n\n' + parsed.text + '\nChanged 🧭\n', refs);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'M7_FLOW_SCENE_RICH_CONTENT_UNSUPPORTED');
    assert.equal(payload.error.reason, 'flow_scene_rich_content_unsupported');
    assert.equal(JSON.stringify(refs), refsBefore);
    assert.equal(JSON.stringify(doc), before);
  });
});

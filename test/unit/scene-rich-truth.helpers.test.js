const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadEnvelopeModule() {
  const root = process.cwd();
  return import(pathToFileURL(path.join(root, 'src', 'renderer', 'documentContentEnvelope.mjs')).href);
}

test('scene rich truth: legacy payload remains readable and keeps meta plus cards', async () => {
  const envelope = await loadEnvelopeModule();
  const raw = [
    '[meta]',
    'status: черновик',
    'tags: POV=alpha; линия=beta; место=gamma',
    'synopsis: One line',
    '[/meta]',
    '',
    'Scene body',
    '',
    '[cards]',
    '[card]',
    'title: Card',
    'text: Alpha',
    'tags: tag',
    '[/card]',
    '[/cards]',
  ].join('\n');

  const parsed = envelope.parseObservablePayload(raw);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.text, 'Scene body');
  assert.equal(parsed.meta.synopsis, 'One line');
  assert.deepEqual(parsed.meta.tags, { pov: 'alpha', line: 'beta', place: 'gamma' });
  assert.deepEqual(parsed.cards, [{ title: 'Card', text: 'Alpha', tags: 'tag' }]);
  assert.equal(parsed.issue, null);
});

test('scene rich truth: canonical doc payload roundtrips deterministically', async () => {
  const envelope = await loadEnvelopeModule();
  const doc = {
    content: [
      { content: [{ text: 'Alpha', type: 'text' }], type: 'paragraph' },
      { type: 'paragraph' },
    ],
    type: 'doc',
  };

  const first = envelope.composeObservablePayload({
    doc,
    metaEnabled: true,
    meta: { synopsis: 'S', status: 'черновик', tags: { pov: '', line: '', place: '' } },
  });
  const second = envelope.composeObservablePayload({
    doc: { type: 'doc', content: doc.content },
    metaEnabled: true,
    meta: { status: 'черновик', synopsis: 'S', tags: { line: '', place: '', pov: '' } },
  });

  assert.equal(first, second);

  const parsed = envelope.parseObservablePayload(first);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.text, 'Alpha');
  assert.deepEqual(parsed.doc, envelope.canonicalizeDocumentJson(doc));
  assert.equal(parsed.issue, null);
});

test('scene rich truth: legacy save path upgrades text to doc v2 envelope', async () => {
  const envelope = await loadEnvelopeModule();
  const result = envelope.composeDocumentContentFromBase({
    baseContent: 'Legacy body',
    nextVisibleText: 'Next body',
  });

  assert.equal(result.ok, true);
  const parsed = envelope.parseObservablePayload(result.content);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.text, 'Next body');
  assert.deepEqual(parsed.doc, envelope.buildParagraphDocumentFromText('Next body'));
});

test('scene rich truth: flow save blocks lossy rich doc downgrade', async () => {
  const envelope = await loadEnvelopeModule();
  const unsafeBase = envelope.composeObservablePayload({
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Bold',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    },
  });

  const result = envelope.composeDocumentContentFromBase({
    baseContent: unsafeBase,
    nextVisibleText: 'Bold',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_SCENE_RICH_CONTENT_UNSUPPORTED');
  assert.equal(result.error.reason, 'flow_scene_rich_content_unsupported');
});

test('scene rich truth: flow save preserves unchanged structured rich doc content', async () => {
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
  const baseContent = envelope.composeObservablePayload({
    doc: structuredDoc,
    metaEnabled: true,
    meta: { synopsis: 'S', status: 'черновик', tags: { pov: '', line: '', place: '' } },
  });

  const result = envelope.composeDocumentContentFromBase({
    baseContent,
    nextVisibleText: 'Alpha\nBeta',
  });

  assert.equal(result.ok, true);
  const parsed = envelope.parseObservablePayload(result.content);
  assert.deepEqual(parsed.doc, envelope.canonicalizeDocumentJson(structuredDoc));
  assert.equal(parsed.text, 'Alpha\nBeta');
});

test('scene rich truth: flow save blocks edits for structured rich docs that cannot roundtrip through plain text safely', async () => {
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
  const baseContent = envelope.composeObservablePayload({ doc: structuredDoc });

  const result = envelope.composeDocumentContentFromBase({
    baseContent,
    nextVisibleText: 'Alpha\nBeta\nGamma',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_SCENE_RICH_CONTENT_UNSUPPORTED');
  assert.equal(result.error.reason, 'flow_scene_rich_content_unsupported');
  assert.equal(result.error.details.requiresStructuredDocPreservation, true);
});

test('scene rich truth: malformed doc block surfaces deterministic parse issue', async () => {
  const envelope = await loadEnvelopeModule();
  const parsed = envelope.parseObservablePayload('[doc-v2 length=10]\n{"bad":1');

  assert.equal(parsed.version, 1);
  assert.equal(parsed.text, '');
  assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
  assert.equal(parsed.issue.reason, 'DOC_BLOCK_TRUNCATED');
});

test('scene rich truth: plain text marker collision does not activate doc-v2 parser', async () => {
  const envelope = await loadEnvelopeModule();
  const parsed = envelope.parseObservablePayload('Alpha [doc-v2 length=12] Beta');

  assert.equal(parsed.version, 1);
  assert.equal(parsed.text, 'Alpha [doc-v2 length=12] Beta');
  assert.equal(parsed.doc, null);
  assert.equal(parsed.issue, null);
});

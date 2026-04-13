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

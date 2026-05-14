const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadTransform() {
  const modPath = pathToFileURL(path.join(process.cwd(), 'src', 'export', 'markdown', 'v1', 'index.mjs')).href;
  return import(modPath);
}

function fixture(name) {
  return fs.readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'sector-m', 'm2', name), 'utf8');
}

test('M2 roundtrip is deterministic and stable', async () => {
  const { parseMarkdownV1, serializeMarkdownV1 } = await loadTransform();
  const source = fixture('simple.md');
  const expected = fixture('simple.expected.md');

  const scene = parseMarkdownV1(source);
  const md1 = serializeMarkdownV1(scene);
  assert.equal(md1, expected);

  const md2 = serializeMarkdownV1(parseMarkdownV1(md1));
  assert.equal(md2, md1);
});

test('M2 list canonicalization and loss-report proof', async () => {
  const { parseMarkdownV1, serializeMarkdownV1 } = await loadTransform();
  const listSource = fixture('lists.md');
  const listScene = parseMarkdownV1(listSource);
  const listMd = serializeMarkdownV1(listScene);
  assert.match(listMd, /^1\. first\n2\. second\n3\. third/m);

  const lossSource = fixture('lossy.md');
  const expected = JSON.parse(fixture('loss.expected.json'));
  const lossScene = parseMarkdownV1(lossSource);
  assert.equal(lossScene.lossReport.count, expected.roundtripLossCount);
  assert.ok(lossScene.lossReport.items.every((item) => typeof item.kind === 'string' && item.kind.length > 0));
});

test('M2 markdown export detailed API is deterministic and keeps legacy markdown output', async () => {
  const {
    parseMarkdownV1,
    serializeMarkdownV1,
    serializeMarkdownV1WithLossReport,
  } = await loadTransform();
  const source = fixture('simple.md');
  const scene = parseMarkdownV1(source);

  const legacy = serializeMarkdownV1(scene);
  const detailed1 = serializeMarkdownV1WithLossReport(scene);
  const detailed2 = serializeMarkdownV1WithLossReport(scene);

  assert.equal(legacy, detailed1.markdown);
  assert.deepEqual(detailed1, detailed2);
  assert.equal(detailed1.lossReport.count, 0);
});

test('M2 negative: unsupported surface is downgraded with machine-checkable reason codes', async () => {
  const {
    MARKDOWN_EXPORT_LOSS_REASON_CODES,
    serializeMarkdownV1,
    serializeMarkdownV1WithLossReport,
  } = await loadTransform();

  const scene = {
    kind: 'scene.v1',
    blocks: [
      { type: 'paragraph', text: 'safe paragraph' },
      { type: 'unknownWidget', text: 'fallback text from unsupported widget' },
      null,
    ],
  };

  const legacy = serializeMarkdownV1(scene);
  assert.match(legacy, /safe paragraph/);
  assert.match(legacy, /fallback text from unsupported widget/);

  const detailed = serializeMarkdownV1WithLossReport(scene);
  assert.match(detailed.markdown, /safe paragraph/);
  assert.match(detailed.markdown, /fallback text from unsupported widget/);
  assert.ok(detailed.lossReport.count >= 2);
  assert.ok(
    detailed.lossReport.items.some(
      (item) => item.reasonCode === MARKDOWN_EXPORT_LOSS_REASON_CODES.UNKNOWN_BLOCK_TYPE_DOWNGRADED,
    ),
  );
  assert.ok(
    detailed.lossReport.items.some(
      (item) => item.reasonCode === MARKDOWN_EXPORT_LOSS_REASON_CODES.INVALID_BLOCK_SHAPE_DOWNGRADED,
    ),
  );
});

test('M2 plain text export is deterministic and reports downgraded structure', async () => {
  const {
    MARKDOWN_EXPORT_LOSS_REASON_CODES,
    serializePlainTextV1,
    serializePlainTextV1WithLossReport,
  } = await loadTransform();

  const scene = {
    kind: 'scene.v1',
    blocks: [
      { type: 'heading', level: 2, text: 'Title' },
      { type: 'list', ordered: false, items: [{ text: 'alpha' }, { text: 'beta' }] },
      { type: 'codeFence', language: 'js', code: 'const a = 1;' },
    ],
  };

  const textLegacy = serializePlainTextV1(scene);
  const detailed1 = serializePlainTextV1WithLossReport(scene);
  const detailed2 = serializePlainTextV1WithLossReport(scene);

  assert.equal(textLegacy, detailed1.text);
  assert.equal(detailed1.text, 'Title\n\nalpha\nbeta\n\nconst a = 1;\n');
  assert.deepEqual(detailed1, detailed2);
  assert.ok(
    detailed1.lossReport.items.some(
      (item) => item.reasonCode === MARKDOWN_EXPORT_LOSS_REASON_CODES.TEXT_BLOCK_FORMAT_DOWNGRADED,
    ),
  );
});

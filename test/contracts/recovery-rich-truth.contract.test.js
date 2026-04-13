const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadEnvelopeModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'renderer', 'documentContentEnvelope.mjs')).href);
}

test('recovery rich truth contract: canonical doc payload is deterministic and single-source', async () => {
  const envelope = await loadEnvelopeModule();
  const doc = envelope.buildParagraphDocumentFromText('Alpha\nBeta');

  const first = envelope.composeObservablePayload({ doc, metaEnabled: false, cards: [] });
  const second = envelope.composeObservablePayload({ doc, metaEnabled: false, cards: [] });
  const parsed = envelope.parseObservablePayload(first);

  assert.equal(first, second);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.text, 'Alpha\nBeta');
  assert.equal(parsed.issue, null);
  assert.equal(first.includes('\n\nAlpha\nBeta\n\n'), false);
});

test('recovery rich truth contract: malformed doc payload produces deterministic issue envelope', async () => {
  const envelope = await loadEnvelopeModule();
  const parsed = envelope.parseObservablePayload('[doc-v2 length=20]\n{"type":"doc"}');

  assert.equal(parsed.version, 1);
  assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
  assert.equal(parsed.issue.reason, 'DOC_BLOCK_TRUNCATED');
  assert.equal(typeof parsed.issue.userMessage, 'string');
  assert.ok(parsed.issue.userMessage.length > 0);
});

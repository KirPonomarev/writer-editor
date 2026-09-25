const test = require('node:test');
const assert = require('node:assert/strict');

test('Word media editor: inline atom preserves canonical attributes and exposes native alt without any path-based load', async () => {
  const { Node, getSchema } = require('@tiptap/core');
  const { DocumentMedia, mediaImageDom } = await import('../../src/renderer/tiptap/documentMedia.mjs');
  const schema = getSchema([Node.create({ name: 'doc', topNode: true, content: 'paragraph+' }), Node.create({ name: 'paragraph', content: 'inline*' }), Node.create({ name: 'text', group: 'inline' }), DocumentMedia]);
  const attrs = { assetId: 'hash-bound-by-main', assetPath: 'assets/media/owned.png', sha256: 'main-owned', mimeType: 'image/png', width: 2, height: 1, alt: 'Красный & alt', displayName: 'same.png', dataBase64: 'iVBORw==' };
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] };
  const node = schema.nodeFromJSON(doc); node.check();
  assert.deepEqual(JSON.parse(JSON.stringify(node.toJSON())), doc);
  assert.equal(schema.nodes.image.spec.inline, true);
  const html = mediaImageDom(attrs);
  assert.equal(html[0], 'img'); assert.equal(html[1].alt, attrs.alt);
  assert.equal(html[1].src, 'data:image/png;base64,iVBORw==');
  assert.equal(Object.values(html[1]).includes(attrs.assetPath), false);
  assert.deepEqual(DocumentMedia.config.parseHTML(), []);
});

test('Word media editor: malicious URI, wrong media type and excessive dimensions never reach img src', async () => {
  const { mediaImageDom } = await import('../../src/renderer/tiptap/documentMedia.mjs');
  const attrs = { mimeType: 'image/png', width: 2, height: 1, dataBase64: 'iVBORw==' };
  for (const change of [{ dataBase64: 'https://example.test/image' }, { mimeType: 'image/svg+xml' }, { width: 100000 }, { dataBase64: 'file:///private/data' }]) {
    const html = mediaImageDom({ ...attrs, ...change });
    assert.equal(html[0], 'span'); assert.equal(html[1].src, undefined);
  }
});

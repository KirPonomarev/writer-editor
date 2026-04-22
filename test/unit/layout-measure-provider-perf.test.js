const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

test('layout measure provider perf: repeated pagination reuses node measurements without changing page map truth', async () => {
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const flow = {
    nodes: [
      {
        id: 'node-1',
        semanticKind: 'paragraph',
        styleKey: 'semantic.paragraph',
        text: 'Repeated measurement payload for deterministic wrapping',
      },
      {
        id: 'node-2',
        semanticKind: 'paragraph',
        styleKey: 'semantic.paragraph',
        text: 'Repeated measurement payload for deterministic wrapping',
      },
    ],
  };
  const profile = {
    pageWidth: 210,
    pageHeight: 297,
    bodyWidth: 12,
    bodyHeight: 4,
  };
  const provider = measureMod.createLayoutMeasureProvider({
    bodyWidth: profile.bodyWidth,
    bodyHeight: profile.bodyHeight,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });

  const first = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    measureProvider: provider,
  });
  assert.deepEqual(provider.getCacheStats(), {
    textHits: 1,
    textMisses: 1,
    textEntryCount: 1,
  });

  const second = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    measureProvider: provider,
  });
  assert.deepEqual(provider.getCacheStats(), {
    textHits: 3,
    textMisses: 1,
    textEntryCount: 1,
  });

  const freshProvider = measureMod.createLayoutMeasureProvider({
    bodyWidth: profile.bodyWidth,
    bodyHeight: profile.bodyHeight,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });
  const expected = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    measureProvider: freshProvider,
  });

  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
});

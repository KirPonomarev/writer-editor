const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

test('layout measure provider perf: repeated mixed-node measurement reuses cache without changing page map truth', async () => {
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const flow = {
    nodes: [
      {
        id: 'node-heading',
        semanticKind: 'sceneHeading',
        styleKey: 'semantic.sceneHeading',
        text: 'Chapter One',
      },
      {
        id: 'node-1',
        semanticKind: 'paragraph',
        styleKey: 'semantic.paragraph',
        text: 'Repeated measurement payload for deterministic wrapping',
      },
      {
        id: 'node-break',
        semanticKind: 'pageBreak',
        styleKey: 'semantic.pageBreak',
        text: '',
        isPageBreak: true,
      },
      {
        id: 'node-2',
        semanticKind: 'paragraph',
        styleKey: 'semantic.paragraph',
        text: 'Repeated measurement payload for deterministic wrapping',
      },
      {
        id: 'node-list',
        semanticKind: 'listItem',
        styleKey: 'semantic.listItem',
        text: 'List item keeps the proof on mixed node kinds',
      },
      {
        id: 'node-heading-2',
        semanticKind: 'sceneHeading',
        styleKey: 'semantic.sceneHeading',
        text: 'Chapter Two',
      },
      {
        id: 'node-overflow',
        semanticKind: 'paragraph',
        styleKey: 'semantic.paragraph',
        text: 'Overflow target text that stays deterministic across runs',
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

  const measuredFlow = provider.measureFlow(flow);
  const repeatedMeasuredFlow = provider.measureFlow(flow);
  assert.deepEqual(repeatedMeasuredFlow, measuredFlow);
  assert.equal(measuredFlow.measurements.some((measurement) => measurement.forcedBreak), true);
  assert.deepEqual(provider.getCacheStats(), {
    textHits: 7,
    textMisses: 5,
    textEntryCount: 5,
  });

  const first = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    measurements: measuredFlow.measurements,
    measureProvider: provider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });
  assert.equal(first.pageBreaks.some((item) => item.reason === 'chapterStart'), true);
  assert.equal(first.pageBreaks.some((item) => item.nodeId === 'node-break'), true);

  const second = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    measurements: measuredFlow.measurements,
    measureProvider: provider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });
  assert.deepEqual(provider.getCacheStats(), {
    textHits: 7,
    textMisses: 5,
    textEntryCount: 5,
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
    measurements: freshProvider.measureFlow(flow).measurements,
    measureProvider: freshProvider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });

  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);

  assert.throws(
    () => pageMapMod.paginateLayoutFlow({
      flow,
      profile: {
        ...profile,
        bodyHeight: 1,
      },
      measurements: measuredFlow.measurements,
      measureProvider: provider,
      rules: {
        strictOverflow: true,
      },
    }),
    /E_PAGE_MAP_OVERFLOW_STRICT/u,
  );
});

test('layout measure provider perf: text measurement cache stays bounded and remains reusable after eviction pressure', async () => {
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');

  const provider = measureMod.createLayoutMeasureProvider({
    bodyWidth: 20,
    bodyHeight: 10,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });

  const firstText = 'seed-text-kept-for-eviction-check';
  const firstMeasurement = provider.measureText(firstText);

  for (let index = 0; index < 2050; index += 1) {
    provider.measureText(`unique-measurement-${index}`);
  }

  const afterPressure = provider.getCacheStats();
  assert.equal(afterPressure.textEntryCount, 2048);
  assert.equal(afterPressure.textMisses, 2051);

  const repeatedTailMeasurement = provider.measureText('unique-measurement-2049');
  const afterTailHit = provider.getCacheStats();
  assert.equal(afterTailHit.textHits, 1);
  assert.equal(afterTailHit.textMisses, 2051);
  assert.deepEqual(repeatedTailMeasurement, {
    width: 20,
    height: 2,
    lineCount: 2,
    charCount: 23,
  });

  const remeasuredFirst = provider.measureText(firstText);
  const afterEvictedReinsert = provider.getCacheStats();
  assert.equal(afterEvictedReinsert.textEntryCount, 2048);
  assert.equal(afterEvictedReinsert.textHits, 1);
  assert.equal(afterEvictedReinsert.textMisses, 2052);
  assert.deepEqual(remeasuredFirst, firstMeasurement);
});

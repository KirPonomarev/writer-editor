const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

test('book layout derived stage03a contract: mixed node kinds, provided measurements, explicit page breaks, and strict overflow stay deterministic', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-stage03a',
    blocks: [
      { kind: 'sceneHeading', text: 'Chapter One', chapterStart: true, startOffset: 0, endOffset: 11 },
      { kind: 'paragraph', text: 'Alpha beta gamma delta epsilon zeta eta', startOffset: 12, endOffset: 50 },
      { kind: 'listItem', text: 'Bullet one', startOffset: 51, endOffset: 61 },
      { kind: 'pageBreak', text: semanticMapping.PAGE_BREAK_TOKEN_V1, startOffset: 62, endOffset: 77 },
      { kind: 'codeBlock', text: 'const token = "stage03a";', startOffset: 78, endOffset: 103 },
      { kind: 'paragraph', text: 'Omega tail text', startOffset: 104, endOffset: 119 },
      { kind: 'sceneHeading', text: 'Chapter Two', chapterStart: true, startOffset: 120, endOffset: 131 },
    ],
  });
  const styleMap = styleMapMod.createStyleMap();
  const flow = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
      chapterStartRule: 'next-page',
    },
  });

  assert.equal(flow.nodes.some((node) => node.semanticKind === 'sceneHeading'), true);
  assert.equal(flow.nodes.some((node) => node.semanticKind === 'listItem'), true);
  assert.equal(flow.nodes.some((node) => node.semanticKind === 'codeBlock'), true);
  assert.equal(flow.nodes.some((node) => node.isPageBreak), true);

  const measureProvider = measureMod.createLayoutMeasureProvider({
    bodyWidth: 14,
    bodyHeight: 3,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });
  const measuredFlow = measureProvider.measureFlow(flow);
  assert.equal(measuredFlow.measurements.some((measurement) => measurement.forcedBreak), true);

  const profile = {
    pageWidth: 210,
    pageHeight: 297,
    bodyWidth: 14,
    bodyHeight: 3,
  };
  const first = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    styleMap,
    measurements: measuredFlow.measurements,
    measureProvider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });
  const second = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    styleMap,
    measurements: measuredFlow.measurements,
    measureProvider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });

  assert.deepEqual(first, second);
  assert.equal(first.pages.length >= 2, true);
  assert.equal(first.pageBreaks.some((item) => item.reason === 'chapterStart'), true);
  assert.equal(first.pageBreaks.some((item) => item.nodeId === 'semantic:scene-stage03a:0003:pageBreak'), true);

  const overflow = pageMapMod.paginateLayoutFlow({
    flow,
    profile: {
      ...profile,
      bodyHeight: 1,
    },
    styleMap,
    measurements: measuredFlow.measurements,
    measureProvider,
  });
  assert.equal(overflow.pages.some((page) => page.overflow), true);
  assert.equal(overflow.meta.overflowCount >= 1, true);

  assert.throws(
    () => pageMapMod.paginateLayoutFlow({
      flow,
      profile: {
        ...profile,
        bodyHeight: 1,
      },
      styleMap,
      measurements: measuredFlow.measurements,
      measureProvider,
      rules: {
        strictOverflow: true,
      },
    }),
    /E_PAGE_MAP_OVERFLOW_STRICT/u,
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

test('layout preview foundation: deterministic flow, page map, anchor map, and invalidation key', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');
  const anchorMapMod = await loadModule('src/derived/anchorMap.mjs');
  const invalidationMod = await loadModule('src/derived/layoutInvalidation.mjs');
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const pageLayoutMetrics = await loadModule('src/core/pageLayoutMetrics.mjs');

  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-stage03a',
    blocks: [
      { kind: 'sceneHeading', text: 'Chapter One', chapterStart: true, startOffset: 0, endOffset: 11 },
      { kind: 'paragraph', text: 'Alpha beta gamma delta epsilon zeta eta', startOffset: 12, endOffset: 50 },
      { kind: 'pageBreak', text: semanticMapping.PAGE_BREAK_TOKEN_V1, startOffset: 51, endOffset: 66 },
      { kind: 'paragraph', text: 'Interlude text', startOffset: 67, endOffset: 80 },
      { kind: 'sceneHeading', text: 'Chapter Two', chapterStart: true, startOffset: 81, endOffset: 92 },
      { kind: 'paragraph', text: 'Omega', startOffset: 93, endOffset: 98 },
    ],
  });
  const styleMap = styleMapMod.createStyleMap();
  const flowA = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
      chapterStartRule: 'next-page',
    },
  });
  const flowB = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
      chapterStartRule: 'next-page',
    },
  });

  assert.deepEqual(flowA.nodes, flowB.nodes);
  assert.equal(flowA.meta.flowHash, flowB.meta.flowHash);
  assert.equal(flowA.nodes.some((node) => node.isPageBreak), true);
  assert.equal(flowA.nodes.some((node) => node.chapterStart), true);

  const profile = bookProfile.createDefaultBookProfile({
    profileId: 'stage03a-preview-profile',
    formatId: 'A4',
  });
  const metrics = pageLayoutMetrics.resolvePageLayoutMetrics(profile, { zoom: 1 });
  assert.equal(metrics.ok, true);

  const measureProvider = measureMod.createLayoutMeasureProvider({
    bodyWidth: 16,
    bodyHeight: 3,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });
  const measuredFlow = measureProvider.measureFlow(flowA);
  const pageMap = pageMapMod.paginateLayoutFlow({
    flow: flowA,
    profile: {
      pageWidth: metrics.value.pageWidthMm,
      pageHeight: metrics.value.pageHeightMm,
      bodyWidth: 16,
      bodyHeight: 3,
    },
    styleMap,
    measurements: measuredFlow.measurements,
    measureProvider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });

  assert.equal(pageMap.pages.length >= 2, true);
  assert.equal(pageMap.pageBreaks.some((item) => item.reason === 'chapterStart'), true);
  const explicitBreakNode = flowA.nodes.find((node) => node.isPageBreak);
  assert.equal(pageMap.pageBreaks.some((item) => item.nodeId === explicitBreakNode.id), true);

  const anchorMap = anchorMapMod.buildAnchorMap({
    flow: flowA,
    pageMap,
    ranges: [{ startOffset: 0, endOffset: 5 }],
  });
  assert.equal(anchorMap.anchors.length, flowA.nodes.length);
  assert.equal(anchorMap.ranges[0].startAnchorId.startsWith('anchor:'), true);

  const keyA = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-hash',
    flowHash: flowA.meta.flowHash,
    styleHash: 'style-hash',
    changeScope: ['flow', 'profile'],
  });
  const keyB = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-hash',
    flowHash: flowA.meta.flowHash,
    styleHash: 'style-hash',
    changeScope: ['profile', 'flow'],
  });
  const keyC = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-hash',
    flowHash: `${flowA.meta.flowHash}-changed`,
    styleHash: 'style-hash',
    changeScope: ['profile', 'flow'],
  });

  assert.equal(keyA.invalidationKey, keyB.invalidationKey);
  assert.notEqual(keyA.invalidationKey, keyC.invalidationKey);
});

test('layout preview foundation: raw DOM source attempts fail close', async () => {
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');

  assert.throws(
    () => flowMod.buildNormalizedLayoutFlow({
      semanticMap: {
        entries: [
          {
            id: 'entry-raw-dom',
            ordinal: 0,
            kind: 'paragraph',
            text: 'Alpha',
            sourceType: 'raw-dom',
          },
        ],
      },
      styleMap: styleMapMod.createStyleMap(),
    }),
    /E_NORMALIZED_LAYOUT_FLOW_RAW_DOM_SOURCE_FORBIDDEN/u,
  );
});

test('layout preview foundation: non-canonical explicit break tokens fail close', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');

  assert.throws(
    () => semanticMapping.mapSemanticEntries({
      sourceId: 'scene-break-invalid',
      blocks: [{ kind: 'pageBreak', text: '[[PAGEBREAK]]' }],
    }),
    /E_SEMANTIC_MAPPING_PAGE_BREAK_TOKEN_REQUIRED/u,
  );

  assert.throws(
    () => flowMod.buildNormalizedLayoutFlow({
      semanticMap: {
        entries: [
          {
            id: 'entry-break-invalid',
            ordinal: 0,
            kind: 'pageBreak',
            text: '[[PAGEBREAK]]',
            token: '[[PAGEBREAK]]',
          },
        ],
      },
      styleMap: styleMapMod.createStyleMap(),
      rules: {
        pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
        strictPageBreakToken: true,
      },
    }),
    /E_NORMALIZED_LAYOUT_FLOW_PAGE_BREAK_TOKEN_REQUIRED/u,
  );
});

test('layout preview foundation: strict overflow fails close', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-overflow',
    text: 'alpha beta gamma delta epsilon zeta eta theta',
  });
  const styleMap = styleMapMod.createStyleMap();
  const flow = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      chapterStartRule: 'continuous',
    },
  });

  assert.throws(
    () => pageMapMod.paginateLayoutFlow({
      flow,
      profile: {
        pageWidth: 10,
        pageHeight: 2,
        bodyWidth: 10,
        bodyHeight: 1,
      },
      rules: {
        strictOverflow: true,
      },
    }),
    /E_PAGE_MAP_OVERFLOW_STRICT/u,
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

function snapshotJson(value) {
  return JSON.stringify(value);
}

test('layout preview render: normalized flow and derived render artifacts stay deterministic and read-only', async () => {
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
    sourceId: 'stage03b-render',
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
  const beforeSemanticMap = snapshotJson(semanticMap);
  const beforeStyleMap = snapshotJson(styleMap);

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
  assert.equal(snapshotJson(semanticMap), beforeSemanticMap);
  assert.equal(snapshotJson(styleMap), beforeStyleMap);

  const profile = bookProfile.createDefaultBookProfile({
    profileId: 'stage03b-render-profile',
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
  const pageMapNext = pageMapMod.paginateLayoutFlow({
    flow: flowA,
    profile: {
      pageWidth: metrics.value.pageWidthMm,
      pageHeight: metrics.value.pageHeightMm,
      bodyWidth: 16,
      bodyHeight: 3,
    },
    styleMap,
    measureProvider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });
  const pageMapContinuous = pageMapMod.paginateLayoutFlow({
    flow: flowA,
    profile: {
      pageWidth: metrics.value.pageWidthMm,
      pageHeight: metrics.value.pageHeightMm,
      bodyWidth: 16,
      bodyHeight: 3,
    },
    styleMap,
    measureProvider,
    rules: {
      chapterStartRule: 'continuous',
    },
  });

  assert.equal(pageMapNext.pages.length > 1, true);
  assert.equal(pageMapNext.pageBreaks.some((item) => item.reason === 'chapterStart'), true);
  assert.notEqual(pageMapNext.pages.length, pageMapContinuous.pages.length);

  const anchorMapA = anchorMapMod.buildAnchorMap({
    flow: flowA,
    pageMap: pageMapNext,
    ranges: [
      { startOffset: 0, endOffset: 5 },
      { startOffset: 15, endOffset: 25 },
    ],
  });
  const anchorMapB = anchorMapMod.buildAnchorMap({
    flow: flowA,
    pageMap: pageMapNext,
    ranges: [
      { startOffset: 0, endOffset: 5 },
      { startOffset: 15, endOffset: 25 },
    ],
  });

  assert.equal(anchorMapA.anchors.length, flowA.nodes.length);
  assert.equal(anchorMapA.ranges[0].startAnchorId.startsWith('anchor:'), true);
  assert.deepEqual(anchorMapA, anchorMapB);

  const base = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: flowA.meta.flowHash,
    styleHash: 'style-h1',
    changeScope: { sceneIds: ['scene-1', 'scene-2'], toggle: 'frame' },
  });
  const repeat = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: flowA.meta.flowHash,
    styleHash: 'style-h1',
    changeScope: { toggle: 'frame', sceneIds: ['scene-2', 'scene-1'] },
  });
  const profileChanged = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h2',
    flowHash: flowA.meta.flowHash,
    styleHash: 'style-h1',
    changeScope: { sceneIds: ['scene-1', 'scene-2'], toggle: 'frame' },
  });
  const flowChanged = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: `${flowA.meta.flowHash}-changed`,
    styleHash: 'style-h1',
    changeScope: { sceneIds: ['scene-1', 'scene-2'], toggle: 'frame' },
  });
  const styleChanged = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: flowA.meta.flowHash,
    styleHash: 'style-h2',
    changeScope: { sceneIds: ['scene-1', 'scene-2'], toggle: 'frame' },
  });

  assert.equal(base.invalidationKey, repeat.invalidationKey);
  assert.notEqual(base.invalidationKey, profileChanged.invalidationKey);
  assert.notEqual(base.invalidationKey, flowChanged.invalidationKey);
  assert.notEqual(base.invalidationKey, styleChanged.invalidationKey);
});

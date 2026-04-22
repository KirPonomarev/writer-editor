const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(filePath) {
  return import(pathToFileURL(path.join(process.cwd(), filePath)).href);
}

test('stage03a layout foundation keeps explicit page breaks and stable semantic ordering', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');

  const mapping = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-01',
    text: ['Opening line', semanticMapping.PAGE_BREAK_TOKEN_V1, 'Second page line'].join('\n'),
  });

  assert.equal(mapping.schemaVersion, 'derived.semanticMapping.v1');
  assert.equal(mapping.entries.length, 3);
  assert.equal(mapping.entries[1].kind, 'pageBreak');
  assert.equal(mapping.entries[1].text, semanticMapping.PAGE_BREAK_TOKEN_V1);

  const repeated = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-01',
    text: ['Opening line', semanticMapping.PAGE_BREAK_TOKEN_V1, 'Second page line'].join('\n'),
  });
  assert.deepEqual(repeated.entries, mapping.entries);
});

test('stage03a layout foundation builds normalized flow and paginates without DOM dependence', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-02',
    blocks: [
      { kind: 'paragraph', text: 'Alpha beta gamma delta' },
      { kind: 'pageBreak', text: semanticMapping.PAGE_BREAK_TOKEN_V1 },
      { kind: 'paragraph', text: 'Omega' },
    ],
  });
  const styleMap = styleMapMod.createStyleMap();
  const flow = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
    },
  });

  assert.equal(flow.schemaVersion, 'derived.normalizedLayoutFlow.v1');
  assert.equal(flow.nodes.length, 3);
  assert.equal(flow.nodes[1].isPageBreak, true);
  assert.equal(flow.nodes[1].token, semanticMapping.PAGE_BREAK_TOKEN_V1);

  const measureProvider = measureMod.createLayoutMeasureProvider({
    bodyWidth: 8,
    bodyHeight: 1,
    charWidth: 1,
    lineHeight: 1,
  });
  const measurements = measureProvider.measureFlow(flow);
  const pageMap = pageMapMod.paginateLayoutFlow({
    flow,
    profile: {
      pageWidth: 8,
      pageHeight: 1,
      bodyWidth: 8,
      bodyHeight: 1,
    },
    styleMap,
    measurements: measurements.measurements,
    measureProvider,
  });

  assert.equal(pageMap.schemaVersion, 'derived.pageMap.v1');
  assert.equal(pageMap.pageBreaks.length, 1);
  assert.equal(pageMap.pages.length >= 2, true);
  assert.equal(pageMap.pages[0].nodeIds.includes(flow.nodes[0].id), true);
  assert.equal(pageMap.pages.at(-1).nodeIds.includes(flow.nodes[2].id), true);
});

test('stage03a layout foundation maps selection anchors and invalidation keys deterministically', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');
  const anchorMapMod = await loadModule('src/derived/anchorMap.mjs');
  const invalidationMod = await loadModule('src/derived/layoutInvalidation.mjs');

  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-03',
    text: ['First paragraph', semanticMapping.PAGE_BREAK_TOKEN_V1, 'Second paragraph'].join('\n'),
  });
  const styleMap = styleMapMod.createStyleMap();
  const flow = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
    },
  });
  const pageMap = pageMapMod.paginateLayoutFlow({
    flow,
    profile: {
      pageWidth: 20,
      pageHeight: 10,
      bodyWidth: 20,
      bodyHeight: 10,
    },
    styleMap,
    measurements: [
      { nodeId: flow.nodes[0].id, height: 1 },
      { nodeId: flow.nodes[1].id, height: 0 },
      { nodeId: flow.nodes[2].id, height: 1 },
    ],
  });

  const anchorMap = anchorMapMod.buildAnchorMap({
    flow,
    pageMap,
    ranges: [{ startOffset: 0, endOffset: 5 }],
  });
  assert.equal(anchorMap.schemaVersion, 'derived.anchorMap.v1');
  assert.equal(anchorMap.anchors.length, 3);
  assert.equal(anchorMap.ranges[0].startAnchorId.startsWith('anchor:'), true);

  const keyA = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-hash',
    flowHash: 'flow-hash',
    styleHash: 'style-hash',
    changeScope: ['profile', 'flow'],
  });
  const keyB = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-hash',
    flowHash: 'flow-hash',
    styleHash: 'style-hash',
    changeScope: ['flow', 'profile'],
  });

  assert.equal(keyA.schemaVersion, 'derived.layoutInvalidation.v1');
  assert.equal(keyA.invalidationKey, keyB.invalidationKey);
  assert.equal(
    invalidationMod.buildLayoutInvalidationKey({
      profileHash: 'profile-hash-2',
      flowHash: 'flow-hash',
      styleHash: 'style-hash',
      changeScope: ['profile', 'flow'],
    }).invalidationKey !== keyA.invalidationKey,
    true,
  );
});

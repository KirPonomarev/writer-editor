const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(ROOT, relativePath)).href;
  return import(fileUrl);
}

function collectKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const key of Object.keys(value)) {
    output.add(key);
    collectKeys(value[key], output);
  }
  return output;
}

test('sector-m layout preview readonly: derived modules have no storage or editable-preview side effects', () => {
  const modulePaths = [
    'src/derived/semanticMapping.mjs',
    'src/derived/styleMap.mjs',
    'src/derived/normalizedLayoutFlow.mjs',
    'src/derived/layoutMeasureProvider.mjs',
    'src/derived/pageMapService.mjs',
    'src/derived/anchorMap.mjs',
    'src/derived/layoutInvalidation.mjs',
  ];
  const forbiddenTokens = [
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'writeFileAtomic',
    'electronAPI',
    'ipcRenderer',
    'contenteditable',
    'contentEditable',
    'document.execCommand',
    'setAttribute(\'contenteditable\'',
    'removeAttribute(\'contenteditable\'',
  ];

  for (const modulePath of modulePaths) {
    const source = read(modulePath);
    for (const token of forbiddenTokens) {
      assert.equal(source.includes(token), false, `${modulePath} leaked forbidden token ${token}`);
    }
  }
});

test('sector-m layout preview readonly: invalidation key stays stable for identical hashes and shifts on hash changes', async () => {
  const invalidationMod = await loadModule('src/derived/layoutInvalidation.mjs');

  const base = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: 'flow-h1',
    styleHash: 'style-h1',
    changeScope: { scenes: ['scene-1', 'scene-2'], toggle: 'frame' },
  });
  const repeat = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: 'flow-h1',
    styleHash: 'style-h1',
    changeScope: { toggle: 'frame', scenes: ['scene-2', 'scene-1'] },
  });
  const profileChanged = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h2',
    flowHash: 'flow-h1',
    styleHash: 'style-h1',
    changeScope: { scenes: ['scene-1', 'scene-2'], toggle: 'frame' },
  });
  const flowChanged = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: 'flow-h2',
    styleHash: 'style-h1',
    changeScope: { scenes: ['scene-1', 'scene-2'], toggle: 'frame' },
  });
  const styleChanged = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-h1',
    flowHash: 'flow-h1',
    styleHash: 'style-h2',
    changeScope: { scenes: ['scene-1', 'scene-2'], toggle: 'frame' },
  });

  assert.equal(base.invalidationKey, repeat.invalidationKey);
  assert.notEqual(base.invalidationKey, profileChanged.invalidationKey);
  assert.notEqual(base.invalidationKey, flowChanged.invalidationKey);
  assert.notEqual(base.invalidationKey, styleChanged.invalidationKey);
});

test('sector-m layout preview readonly: derived artifacts do not expose canonical storage keys', async () => {
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');
  const anchorMapMod = await loadModule('src/derived/anchorMap.mjs');
  const invalidationMod = await loadModule('src/derived/layoutInvalidation.mjs');

  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: 'scene-storage-boundary',
    text: ['Alpha', semanticMapping.PAGE_BREAK_TOKEN_V1, 'Beta'].join('\n'),
  });
  const styleMap = styleMapMod.createStyleMap();
  const flow = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
    },
  });
  const measureProvider = measureMod.createLayoutMeasureProvider({
    bodyWidth: 12,
    bodyHeight: 3,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });
  const pageMap = pageMapMod.paginateLayoutFlow({
    flow,
    profile: {
      pageWidth: 30,
      pageHeight: 10,
      bodyWidth: 12,
      bodyHeight: 3,
    },
    styleMap,
    measureProvider,
    rules: {
      chapterStartRule: 'next-page',
    },
  });
  const anchorMap = anchorMapMod.buildAnchorMap({
    flow,
    pageMap,
    ranges: [{ startOffset: 0, endOffset: 4 }],
  });
  const invalidation = invalidationMod.buildLayoutInvalidationKey({
    profileHash: 'profile-storage-check',
    flowHash: flow.meta.flowHash,
    styleHash: 'style-storage-check',
    changeScope: ['scene-storage-boundary'],
  });

  const keySet = collectKeys({
    semanticMap,
    styleMap: {
      schemaVersion: styleMap.schemaVersion,
      defaultStyleKey: styleMap.defaultStyleKey,
      styles: styleMap.styles,
    },
    flow,
    pageMap,
    anchorMap,
    invalidation,
  });

  const forbiddenCanonicalKeys = [
    'projectManifest',
    'projectId',
    'scenes',
    'assets',
    'backups',
    'atomicWrite',
    'recovery',
    'doc',
    'cards',
    'metaEnabled',
    'editable',
    'contenteditable',
  ];
  for (const forbiddenKey of forbiddenCanonicalKeys) {
    assert.equal(keySet.has(forbiddenKey), false, `derived artifact leaked canonical key ${forbiddenKey}`);
  }
});

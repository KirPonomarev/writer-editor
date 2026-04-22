const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

function collectKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, output);
    }
    return output;
  }
  if (!value || typeof value !== 'object') {
    return output;
  }
  for (const key of Object.keys(value)) {
    output.add(key);
    collectKeys(value[key], output);
  }
  return output;
}

test('layout preview runtime: snapshot is derived, deterministic, and storage-clean', async () => {
  const mod = await loadModule('src/renderer/layoutPreview.mjs');

  const state = mod.createLayoutPreviewState();
  assert.equal(state.enabled, false);
  assert.equal(state.frameMode, true);

  const snapshotA = mod.buildLayoutPreviewSnapshot({
    text: [
      'Chapter One',
      '',
      'Alpha beta gamma delta epsilon',
      '[[PAGE_BREAK]]',
      'Chapter Two',
      '',
      'Omega omega omega omega omega',
    ].join('\n'),
    profile: {
      formatId: 'A4',
      chapterStartRule: 'next-page',
      allowExplicitPageBreaks: true,
    },
    metrics: {
      pageWidthMm: 210,
      pageHeightMm: 297,
      pageWidthPx: 1197,
      pageHeightPx: 1693,
      contentWidthPx: 907,
      contentHeightPx: 1403,
    },
    selectionRange: { start: 0, end: 12 },
    sourceId: 'runtime-preview-test',
  });

  const snapshotB = mod.buildLayoutPreviewSnapshot({
    text: [
      'Chapter One',
      '',
      'Alpha beta gamma delta epsilon',
      '[[PAGE_BREAK]]',
      'Chapter Two',
      '',
      'Omega omega omega omega omega',
    ].join('\n'),
    profile: {
      formatId: 'A4',
      chapterStartRule: 'next-page',
      allowExplicitPageBreaks: true,
    },
    metrics: {
      pageWidthMm: 210,
      pageHeightMm: 297,
      pageWidthPx: 1197,
      pageHeightPx: 1693,
      contentWidthPx: 907,
      contentHeightPx: 1403,
    },
    selectionRange: { start: 0, end: 12 },
    sourceId: 'runtime-preview-test',
  });

  assert.equal(snapshotA.schemaVersion, 'renderer.layoutPreview.v1');
  assert.equal(snapshotA.profile.formatId, 'A4');
  assert.equal(snapshotA.pageMap.pages.length >= 2, true);
  assert.equal(snapshotA.pageMap.pageBreaks.length >= 1, true);
  assert.equal(typeof snapshotA.flow.meta.flowHash, 'string');
  assert.equal(typeof snapshotA.invalidation.invalidationKey, 'string');
  assert.equal(snapshotA.invalidation.invalidationKey, snapshotB.invalidation.invalidationKey);
  assert.equal(snapshotA.anchorMap.anchors.length, snapshotA.flow.nodes.length);

  const keySet = collectKeys(snapshotA);
  const forbiddenCanonicalKeys = [
    'projectManifest',
    'assets',
    'backups',
    'atomicWrite',
    'recovery',
    'storage',
    'doc',
  ];
  for (const forbiddenKey of forbiddenCanonicalKeys) {
    assert.equal(keySet.has(forbiddenKey), false, `snapshot leaked canonical key ${forbiddenKey}`);
  }
});

test('layout preview runtime: module has no storage or editable-page side effects', () => {
  const source = read('src/renderer/layoutPreview.mjs');
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
  ];
  for (const token of forbiddenTokens) {
    assert.equal(source.includes(token), false, `layoutPreview leaked forbidden token ${token}`);
  }
});

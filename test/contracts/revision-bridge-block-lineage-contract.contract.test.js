const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-block-lineage-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validBlock(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.block.v1',
    blockId: 'block-1',
    lineageId: 'lineage-1',
    versionHash: 'version-1',
    kind: 'paragraph',
    order: 0,
    text: 'One paragraph.',
    attrs: {},
    source: {},
    ...overrides,
  };
}

function validLineage(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.block-lineage.v1',
    blocks: [
      validBlock({ blockId: 'block-1', order: 0 }),
      validBlock({ blockId: 'block-2', order: 1 }),
    ],
    ...overrides,
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

test('RB-09 exports exact block constants and public functions', async () => {
  const bridge = await loadBridge();
  const expectedExports = [
    'REVISION_BRIDGE_BLOCK_SCHEMA',
    'REVISION_BRIDGE_BLOCK_LINEAGE_SCHEMA',
    'REVISION_BRIDGE_BLOCK_KINDS',
    'isRevisionBlockKind',
    'normalizeRevisionBlockText',
    'createRevisionBlockOrder',
    'createRevisionBlockVersionHash',
    'createRevisionBlockLineageId',
    'createRevisionBlockInstanceId',
    'createRevisionBlock',
    'validateRevisionBlock',
    'validateRevisionBlockLineage',
    'deriveRevisionBlocksFromPlainSceneText',
  ];

  assert.equal(bridge.REVISION_BRIDGE_BLOCK_SCHEMA, 'revision-bridge.block.v1');
  assert.equal(bridge.REVISION_BRIDGE_BLOCK_LINEAGE_SCHEMA, 'revision-bridge.block-lineage.v1');
  for (const exportName of expectedExports) {
    assert.notEqual(bridge[exportName], undefined, `${exportName} must be exported`);
  }
});

test('RB-09 block kinds are exact and frozen', async () => {
  const bridge = await loadBridge();

  assert.deepEqual(bridge.REVISION_BRIDGE_BLOCK_KINDS, [
    'paragraph',
    'heading',
    'quote',
    'listItem',
    'separator',
    'tablePlaceholder',
    'unsupportedObjectPlaceholder',
  ]);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_BLOCK_KINDS), true);
  assert.equal(bridge.isRevisionBlockKind('paragraph'), true);
  assert.equal(bridge.isRevisionBlockKind('unsupportedObjectPlaceholder'), true);
  assert.equal(bridge.isRevisionBlockKind('unknown'), false);
  assert.equal(bridge.isRevisionBlockKind(''), false);
});

test('RB-09 text normalization makes CRLF and LF equivalent', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.normalizeRevisionBlockText('  Alpha\r\nBeta\rGamma  '),
    'Alpha\nBeta\nGamma',
  );
  assert.equal(
    bridge.normalizeRevisionBlockText('Alpha\r\nBeta'),
    bridge.normalizeRevisionBlockText('Alpha\nBeta'),
  );
});

test('RB-09 block order accepts only non-negative safe integers', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.createRevisionBlockOrder(0), 0);
  assert.equal(bridge.createRevisionBlockOrder(17), 17);
  assert.equal(bridge.createRevisionBlockOrder(-1), null);
  assert.equal(bridge.createRevisionBlockOrder(1.25), null);
  assert.equal(bridge.createRevisionBlockOrder(Number.NaN), null);
  assert.equal(bridge.createRevisionBlockOrder(Number.MAX_SAFE_INTEGER + 1), null);
});

test('RB-09 version hash is deterministic and tracks text and kind', async () => {
  const bridge = await loadBridge();
  const base = { kind: 'paragraph', text: 'Alpha', attrs: { level: 1 } };

  assert.equal(
    bridge.createRevisionBlockVersionHash(base),
    bridge.createRevisionBlockVersionHash(deepClone(base)),
  );
  assert.notEqual(
    bridge.createRevisionBlockVersionHash(base),
    bridge.createRevisionBlockVersionHash({ ...base, text: 'Beta' }),
  );
  assert.notEqual(
    bridge.createRevisionBlockVersionHash(base),
    bridge.createRevisionBlockVersionHash({ ...base, kind: 'heading' }),
  );
});

test('RB-09 lineage id is stable for explicit lineage seed when text changes', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.createRevisionBlockLineageId({ lineageSeed: 'stable-seed', text: 'Alpha' }),
    bridge.createRevisionBlockLineageId({ lineageSeed: 'stable-seed', text: 'Beta' }),
  );
});

test('RB-09 block id changes when order changes', async () => {
  const bridge = await loadBridge();

  assert.notEqual(
    bridge.createRevisionBlockInstanceId({
      sceneId: 'scene-1',
      lineageSeed: 'lineage-1',
      kind: 'paragraph',
      order: 0,
      text: 'Alpha',
    }),
    bridge.createRevisionBlockInstanceId({
      sceneId: 'scene-1',
      lineageSeed: 'lineage-1',
      kind: 'paragraph',
      order: 1,
      text: 'Alpha',
    }),
  );
});

test('RB-09 plain text derivation returns empty array for empty or whitespace input', async () => {
  const bridge = await loadBridge();

  assert.deepEqual(bridge.deriveRevisionBlocksFromPlainSceneText({ text: '' }), []);
  assert.deepEqual(bridge.deriveRevisionBlocksFromPlainSceneText({ text: ' \n\t\n ' }), []);
});

test('RB-09 plain text derivation returns one paragraph block for one paragraph', async () => {
  const bridge = await loadBridge();
  const blocks = bridge.deriveRevisionBlocksFromPlainSceneText({
    sceneId: 'scene-1',
    text: '  One paragraph.\r\nStill same paragraph.  ',
  });

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].schemaVersion, 'revision-bridge.block.v1');
  assert.equal(blocks[0].kind, 'paragraph');
  assert.equal(blocks[0].order, 0);
  assert.equal(blocks[0].text, 'One paragraph.\nStill same paragraph.');
});

test('RB-09 plain text derivation returns ordered paragraph blocks split by blank lines', async () => {
  const bridge = await loadBridge();
  const blocks = bridge.deriveRevisionBlocksFromPlainSceneText({
    sceneId: 'scene-1',
    text: 'First paragraph.\n\nSecond paragraph.\n \nThird paragraph.',
  });

  assert.deepEqual(blocks.map((block) => block.order), [0, 1, 2]);
  assert.deepEqual(blocks.map((block) => block.text), [
    'First paragraph.',
    'Second paragraph.',
    'Third paragraph.',
  ]);
  assert.deepEqual([...new Set(blocks.map((block) => block.kind))], ['paragraph']);
});

test('RB-09 validates block lineage and rejects malformed schema, blocks, edges, and cycles', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.validateRevisionBlockLineage(validLineage()).ok, true);
  assert.equal(bridge.validateRevisionBlockLineage({ blocks: [] }).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage({
    schemaVersion: 'revision-bridge.block-lineage.v9',
    blocks: [],
  }).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage(validLineage({
    blocks: [
      validBlock({ blockId: 'dup', order: 0 }),
      validBlock({ blockId: 'dup', order: 1 }),
    ],
  })).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage(validLineage({
    lineageEdges: [{ fromBlockId: 'block-1', toBlockId: 'missing' }],
  })).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage(validLineage({
    lineageEdges: [{ fromBlockId: 'block-1', toBlockId: 'block-1' }],
  })).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage(validLineage({
    lineageEdges: [
      { fromBlockId: 'block-1', toBlockId: 'block-2' },
      { fromBlockId: 'block-2', toBlockId: 'block-1' },
    ],
  })).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage(validLineage({
    blocks: [validBlock({ order: -1 })],
  })).ok, false);
  assert.equal(bridge.validateRevisionBlockLineage(validLineage({
    blocks: [validBlock({ kind: 'mystery' })],
  })).ok, false);
});

test('RB-09 block and lineage functions do not mutate inputs', async () => {
  const bridge = await loadBridge();
  const blockInput = {
    sceneId: 'scene-1',
    lineageSeed: 'seed-1',
    kind: 'paragraph',
    order: 0,
    text: ' Alpha ',
    attrs: { marker: 'a' },
    source: { kind: 'fixture' },
  };
  const lineageInput = validLineage({
    lineageEdges: [{ fromBlockId: 'block-1', toBlockId: 'block-2' }],
  });
  const deriveInput = { sceneId: 'scene-1', text: 'First\n\nSecond' };
  const beforeBlock = deepClone(blockInput);
  const beforeLineage = deepClone(lineageInput);
  const beforeDerive = deepClone(deriveInput);

  bridge.createRevisionBlock(blockInput);
  bridge.validateRevisionBlockLineage(lineageInput);
  bridge.deriveRevisionBlocksFromPlainSceneText(deriveInput);

  assert.deepEqual(blockInput, beforeBlock);
  assert.deepEqual(lineageInput, beforeLineage);
  assert.deepEqual(deriveInput, beforeDerive);
});

test('RB-09 implementation section has no forbidden side effect or parser tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_09_BLOCK_LINEAGE_CONTRACTS_START');
  const end = source.indexOf('// RB_09_BLOCK_LINEAGE_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
    'import',
    'require',
    'fs',
    'child_process',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'electron',
    'ipcMain',
    'ipcRenderer',
    'DOMParser',
    'XMLParser',
    'xmldom',
    'sax',
    'fast-xml-parser',
    'JSZip',
    'yauzl',
    'admzip',
    'unzip',
    'inflate',
    'deflate',
    'readFile',
    'writeFile',
    'crypto',
    'Date.now',
    'new Date',
    'Math.random',
    'setTimeout',
    'setInterval',
    'reviewPacket',
    'previewInput',
    'applyPlan',
    'canApply',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-09 section`);
  }
});

test('RB-09 changed files stay allowlisted and package manifests are untouched', () => {
  const statusText = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const changedFiles = changedFilesFromGitStatus(statusText);
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const RB19_TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const C04_MODULE_PATH = 'src/io/revisionBridge/exactTextMinSafeWrite.mjs';
const C04_TEST_PATH = 'test/contracts/revision-bridge-exact-text-min-safe-write.contract.test.js';
const C05_TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const C08_TEST_PATH = 'test/contracts/revision-bridge-structural-manual-review.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const ALLOWLIST = [
  MODULE_PATH,
  TEST_PATH,
  P0_TEST_PATH,
  RB10_TEST_PATH,
  RB11_TEST_PATH,
  RB19_TEST_PATH,
  C04_MODULE_PATH,
  C04_TEST_PATH,
  C05_TEST_PATH,
  C08_TEST_PATH,
  GOVERNANCE_APPROVALS_PATH,
];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function reasonCodes(result) {
  return result.reasons.map((reason) => reason.code);
}

function validBlock(overrides = {}) {
  return {
    sceneId: 'scene-1',
    blockId: 'stable-block-1',
    lineageId: 'stable-lineage-1',
    versionHash: 'rbvh_base',
    kind: 'paragraph',
    order: 0,
    text: 'Alpha beta.',
    ...overrides,
  };
}

test('C06 exports minimal block id preview schema, reasons, and builder', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_MINIMAL_BLOCK_ID_PREVIEW_SCHEMA,
    'revision-bridge.minimal-block-id-preview.v1',
  );
  assert.equal(Array.isArray(bridge.REVISION_BRIDGE_MINIMAL_BLOCK_ID_PREVIEW_REASON_CODES), true);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_MINIMAL_BLOCK_ID_PREVIEW_REASON_CODES), true);
  assert.equal(typeof bridge.buildMinimalBlockIdPreview, 'function');
});

test('C06 stable explicit block id returns preview evidence only and zero auto apply', async () => {
  const bridge = await loadBridge();
  const input = {
    projectId: 'project-1',
    sceneId: 'scene-1',
    baselineHash: 'baseline-1',
    blocks: [validBlock()],
  };
  const before = deepClone(input);

  const result = bridge.buildMinimalBlockIdPreview(input);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'preview');
  assert.equal(result.code, 'REVISION_BRIDGE_MINIMAL_BLOCK_ID_PREVIEW_READY');
  assert.equal(result.previewOnly, true);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.autoApplyCount, 0);
  assert.deepEqual(result.autoApplyCandidates, []);
  assert.deepEqual(result.automation, { candidateCount: 0, candidates: [] });
  assert.equal(result.previewBlocks.length, 1);
  assert.equal(result.previewBlocks[0].sceneId, 'scene-1');
  assert.equal(result.previewBlocks[0].existingBlockIdAdvisory, 'stable-block-1');
  assert.equal(result.previewBlocks[0].lineageIdAdvisory, 'stable-lineage-1');
  assert.equal(typeof result.previewBlocks[0].previewBlockHandle, 'string');
  assert.equal(result.previewBlocks[0].previewBlockHandle.startsWith('rbpbh_'), true);
  assert.equal(typeof result.previewBlocks[0].previewVersionHash, 'string');
  assert.equal(result.previewBlocks[0].previewVersionHash.startsWith('rbvh_'), true);
  assert.deepEqual(input, before);
});

test('C06 missing block id creates temporary preview handle without persisted identity', async () => {
  const bridge = await loadBridge();
  const input = {
    sceneId: 'scene-1',
    blocks: [validBlock({ blockId: '', id: 'legacy-id-only', lineageId: '', order: 0 })],
  };
  const before = deepClone(input);

  const result = bridge.buildMinimalBlockIdPreview(input);
  const codes = reasonCodes(result);

  assert.deepEqual(input, before);
  assert.equal(result.status, 'manualOnly');
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_MISSING_ID_MANUAL_ONLY'), true);
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_ORDINAL_ONLY_MANUAL_ONLY'), true);
  assert.equal(result.previewBlocks[0].existingBlockIdAdvisory, '');
  assert.equal(result.previewBlocks[0].lineageIdAdvisory, '');
  assert.equal(result.previewBlocks[0].previewBlockHandle.startsWith('rbpbh_'), true);
  assert.equal(result.canAutoApply, false);
  assert.deepEqual(result.autoApplyCandidates, []);
});

test('C06 identical paragraphs do not collapse', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [
      validBlock({ blockId: 'stable-a', lineageId: 'lineage-a', order: 0, text: 'Same paragraph.' }),
      validBlock({ blockId: 'stable-b', lineageId: 'lineage-b', order: 1, text: 'Same paragraph.' }),
    ],
  });

  assert.equal(result.previewBlocks.length, 2);
  assert.equal(new Set(result.previewBlocks.map((entry) => entry.previewBlockHandle)).size, 2);
  assert.equal(result.autoApplyCount, 0);
  assert.equal(reasonCodes(result).includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_DUPLICATE_TEXT_MANUAL_ONLY'), true);
});

test('C06 identical paragraphs across scenes stay preview and do not emit duplicate text manual only', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    projectId: 'project-1',
    blocks: [
      validBlock({ sceneId: 'scene-1', blockId: 'stable-a', lineageId: 'lineage-a', order: 0, text: 'Same paragraph.' }),
      validBlock({ sceneId: 'scene-2', blockId: 'stable-b', lineageId: 'lineage-b', order: 0, text: 'Same paragraph.' }),
    ],
  });

  assert.equal(result.status, 'preview');
  assert.equal(result.autoApplyCount, 0);
  assert.equal(reasonCodes(result).includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_DUPLICATE_TEXT_MANUAL_ONLY'), false);
  assert.equal(result.previewBlocks.length, 2);
  assert.equal(new Set(result.previewBlocks.map((entry) => entry.sceneId)).size, 2);
});

test('C06 identical headings do not auto apply', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [
      validBlock({ blockId: 'heading-a', lineageId: 'heading-lineage-a', kind: 'heading', order: 0, text: 'Chapter One' }),
      validBlock({ blockId: 'heading-b', lineageId: 'heading-lineage-b', kind: 'heading', order: 1, text: 'Chapter One' }),
    ],
  });

  assert.equal(result.status, 'manualOnly');
  assert.equal(result.autoApplyCount, 0);
  assert.deepEqual(result.autoApplyCandidates, []);
  assert.equal(reasonCodes(result).includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_HEADING_ONLY_MANUAL_ONLY'), true);
  assert.equal(reasonCodes(result).includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_DUPLICATE_TEXT_MANUAL_ONLY'), true);
});

test('C06 duplicate text, heading only, and ordinal only block ids are manual only', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [
      validBlock({ blockId: 'stable-a', lineageId: 'lineage-a', order: 0, text: 'Repeated text.' }),
      validBlock({ blockId: 'stable-b', lineageId: 'lineage-b', order: 1, text: 'Repeated text.' }),
      validBlock({ blockId: 'paragraph-2', lineageId: '', kind: 'heading', order: 2, text: 'Chapter One' }),
    ],
  });
  const codes = reasonCodes(result);

  assert.equal(result.status, 'manualOnly');
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_DUPLICATE_TEXT_MANUAL_ONLY'), true);
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_HEADING_ONLY_MANUAL_ONLY'), true);
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_ORDINAL_ONLY_MANUAL_ONLY'), true);
  assert.equal(result.autoApplyCount, 0);
});

test('C06 previewVersionHash changes with text and lineage advisory is distinct', async () => {
  const bridge = await loadBridge();

  const alpha = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [validBlock({
      blockId: 'stable-a',
      lineageId: '',
      lineageSeed: 'lineage-seed-a',
      text: 'Alpha text.',
    })],
  });
  const beta = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [validBlock({
      blockId: 'stable-a',
      lineageId: '',
      lineageSeed: 'lineage-seed-a',
      text: 'Beta text.',
    })],
  });

  assert.notEqual(alpha.previewBlocks[0].previewVersionHash, beta.previewBlocks[0].previewVersionHash);
  assert.equal(alpha.previewBlocks[0].lineageIdAdvisory, '');
  assert.notEqual(alpha.previewBlocks[0].previewBlockHandle, alpha.previewBlocks[0].previewVersionHash);
});

test('C06 text-derived and unstable block ids remain advisory only', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [
      validBlock({
        blockId: 'alpha-beta',
        lineageId: 'lineage-a',
        idStability: 'textDerived',
        order: 0,
        text: 'Alpha beta',
      }),
    ],
  });
  const codes = reasonCodes(result);

  assert.equal(result.status, 'manualOnly');
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_TEXT_DERIVED_ID_MANUAL_ONLY'), true);
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_UNSTABLE_ID_MANUAL_ONLY'), true);
  assert.equal(result.previewBlocks[0].existingBlockIdAdvisory, '');
  assert.equal(result.previewBlocks[0].existingBlockIdAdvisory.includes('Alpha'), false);
  assert.equal(result.canAutoApply, false);
});

test('C06 changed version hash is freshness evidence only and blocks auto apply', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [
      validBlock({
        previousVersionHash: 'rbvh_old',
        text: 'Changed text.',
      }),
    ],
  });
  const codes = reasonCodes(result);

  assert.equal(result.status, 'manualOnly');
  assert.equal(codes.includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_VERSION_CHANGED_MANUAL_ONLY'), true);
  assert.equal(result.reasons.some((reason) => (
    reason.previousVersionHash === 'rbvh_old'
    && reason.previewVersionHash.startsWith('rbvh_')
  )), true);
  assert.equal(result.canAutoApply, false);
  assert.deepEqual(result.autoApplyCandidates, []);
});

test('C06 structural move split merge copy never becomes apply eligibility', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [validBlock()],
    structuralChanges: [
      { kind: 'moveBlock' },
      { operation: 'split' },
      { changeKind: 'mergeScene' },
      { type: 'copyBlock' },
    ],
  });
  const codes = reasonCodes(result);

  assert.equal(result.status, 'manualOnly');
  assert.equal(codes.filter((code) => (
    code === 'REVISION_BRIDGE_MINIMAL_BLOCK_ID_STRUCTURAL_MANUAL_ONLY'
  )).length, 4);
  assert.equal(result.canAutoApply, false);
  assert.deepEqual(result.autoApplyCandidates, []);
});

test('C06 nested structural changes remain manual only', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview({
    sceneId: 'scene-1',
    blocks: [validBlock()],
    revisionSession: {
      reviewGraph: {
        structuralChanges: [{ kind: 'moveScene' }],
      },
    },
  });

  assert.equal(result.status, 'manualOnly');
  assert.equal(reasonCodes(result).includes('REVISION_BRIDGE_MINIMAL_BLOCK_ID_STRUCTURAL_MANUAL_ONLY'), true);
  assert.equal(result.canAutoApply, false);
});

test('C06 preview is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = {
    sceneId: 'scene-1',
    blocks: [
      validBlock({ blockId: 'stable-a', lineageId: 'lineage-a', order: 0, text: 'Alpha.' }),
      validBlock({ blockId: '', lineageId: '', order: 1, text: 'Beta.' }),
    ],
  };
  const before = deepClone(input);
  const first = bridge.buildMinimalBlockIdPreview(input);
  const second = bridge.buildMinimalBlockIdPreview(input);

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});

test('C06 invalid input returns diagnostics without throwing or side effects', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildMinimalBlockIdPreview(null);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'manualOnly');
  assert.equal(result.previewOnly, true);
  assert.equal(result.reason, 'REVISION_BRIDGE_MINIMAL_BLOCK_ID_INPUT_INVALID');
  assert.deepEqual(result.previewBlocks, []);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.autoApplyCount, 0);
});

test('C06 implementation section has no file, parser, runtime, storage, UI, or write tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_06_MINIMAL_BLOCK_ID_R2_START');
  const end = source.indexOf('// CONTOUR_06_MINIMAL_BLOCK_ID_R2_END');
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
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'dispatchEvent',
    'querySelector',
    'appendChild',
    'removeChild',
    'Date.now',
    'new Date',
    'Math.random',
    'setTimeout',
    'setInterval',
    'applyOps',
    'canApply',
    'safeWrite',
    'atomic',
    'backup',
    'recovery',
    'receipt',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in C06 section`);
  }
});

test('C06 changed files stay allowlisted and dependency manifests are untouched', () => {
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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-revision-session-registry-record.contract.test.js';
const STATE_PATH = 'docs/OPS/STATUS/RB_V21_AUTOCYCLE_STATE_V1.json';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, STATE_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validParsedSurfacePlacement(overrides = {}) {
  return {
    placementId: 'placement-1',
    threadId: 'thread-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    anchor: {
      kind: 'text',
      value: 'block-1',
    },
    range: {
      from: 0,
      to: 5,
    },
    quote: 'Alpha',
    prefix: '',
    suffix: ' ',
    confidence: 1,
    policy: 'exact',
    createdAt: '2026-04-27T12:00:00.000Z',
    ...overrides,
  };
}

function validParsedSurface() {
  return {
    commentThreads: [
      {
        threadId: 'thread-1',
        authorId: 'editor-1',
        status: 'open',
        createdAt: '2026-04-27T11:59:00.000Z',
        updatedAt: '2026-04-27T12:01:00.000Z',
        tags: [],
        messages: [
          {
            messageId: 'message-1',
            authorId: 'editor-1',
            body: 'Check this phrase.',
            createdAt: '2026-04-27T12:00:00.000Z',
          },
        ],
      },
    ],
    commentPlacements: [validParsedSurfacePlacement()],
    textChanges: [],
    structuralChanges: [],
    diagnosticItems: [],
    decisionStates: [],
  };
}

function validInput(overrides = {}) {
  return {
    projectId: 'project-1',
    revisionSessionId: 'revision-session-1',
    exportId: 'export-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: validParsedSurface(),
    context: {
      blockMap: {
        'block-1': {
          lineageId: 'lineage-1',
          text: 'Alpha beta gamma.',
        },
      },
    },
    ...overrides,
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

test('RB-31 exports revision session registry record schema and builder', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_REVISION_SESSION_REGISTRY_RECORD_SCHEMA,
    'revision-bridge.revision-session-registry-record.v1',
  );
  assert.equal(typeof bridge.buildRevisionSessionRegistryRecord, 'function');
});

test('RB-31 builds recorded registry record from ready import seam preview', async () => {
  const bridge = await loadBridge();
  const preview = bridge.previewRevisionSessionImportSeam(validInput());
  const result = bridge.buildRevisionSessionRegistryRecord({
    importPreview: preview,
    createdAt: '2026-04-27T12:05:00.000Z',
    updatedAt: '2026-04-27T12:05:30.000Z',
  });

  assert.equal(result.schemaVersion, 'revision-bridge.revision-session-registry-record.v1');
  assert.equal(result.type, 'revisionBridge.revisionSession.registryRecord');
  assert.equal(result.status, 'recorded');
  assert.equal(result.code, 'REVISION_BRIDGE_REVIEWGRAPH_VALID');
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.revisionSessionId, 'revision-session-1');
  assert.equal(result.exportId, 'export-1');
  assert.equal(result.baselineHash, 'baseline-hash-1');
  assert.equal(result.importPreviewStatus, 'ready');
  assert.equal(result.sessionState, 'Imported');
  assert.equal(result.storagePolicy, 'registryOnly');
  assert.equal(result.canMutateManuscript, false);
  assert.equal(result.candidateSessionAvailable, true);
  assert.equal(result.importReasonCount, 0);
  assert.deepEqual(result.reviewGraphCounts, {
    commentThreads: 0,
    commentPlacements: 0,
    textChanges: 0,
    structuralChanges: 0,
    diagnosticItems: 0,
    decisionStates: 0,
  });
  assert.equal(result.createdAt, '2026-04-27T12:05:00.000Z');
  assert.equal(result.updatedAt, '2026-04-27T12:05:30.000Z');
  assert.deepEqual(result.reasons, []);
});

test('RB-31 keeps registry record in diagnosed state for blocked import preview', async () => {
  const bridge = await loadBridge();
  const preview = bridge.previewRevisionSessionImportSeam(validInput({
    parsedSurface: {
      ...validParsedSurface(),
      commentPlacements: [
        validParsedSurfacePlacement({
          quote: 'Missing quote',
        }),
      ],
    },
  }));
  const result = bridge.buildRevisionSessionRegistryRecord({ importPreview: preview });

  assert.equal(result.status, 'recorded');
  assert.equal(result.importPreviewStatus, 'blocked');
  assert.equal(result.sessionState, 'Diagnosed');
  assert.equal(result.candidateSessionAvailable, false);
  assert.equal(result.importReasonCount > 0, true);
});

test('RB-31 rejects malformed registry inputs with explicit reasons', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildRevisionSessionRegistryRecord({
    importPreview: {
      schemaVersion: 'revision-bridge.revision-session-import-seam-preview.v1',
      status: 'ready',
      canMutateManuscript: true,
    },
  });

  assert.equal(result.status, 'invalid');
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID');
  assert.equal(result.reasons.some((item) => item.field === 'importPreview.projectId'), true);
  assert.equal(result.reasons.some((item) => item.field === 'importPreview.canMutateManuscript'), true);
});

test('RB-31 builder is deterministic and does not mutate caller input', async () => {
  const bridge = await loadBridge();
  const input = {
    importPreview: bridge.previewRevisionSessionImportSeam(validInput()),
  };
  const before = deepClone(input);
  const first = bridge.buildRevisionSessionRegistryRecord(input);
  const second = bridge.buildRevisionSessionRegistryRecord(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-31 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_31_REVISION_SESSION_REGISTRY_RECORD_CONTRACTS_START');
  const end = source.indexOf('// RB_31_REVISION_SESSION_REGISTRY_RECORD_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
    'require',
    'fs',
    'child_process',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'electron',
    'ipcMain',
    'ipcRenderer',
    'Date.now',
    'Math.random',
    'setTimeout',
    'setInterval',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-31 section`);
  }
});

test('RB-31 changed files stay allowlisted and package manifests are untouched', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => filePath === 'package.json' || filePath === 'package-lock.json');

  assert.equal(changedFiles.includes(MODULE_PATH), true);
  assert.equal(changedFiles.includes(TEST_PATH), true);
  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});

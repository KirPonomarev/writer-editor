const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-revision-session-import-seam.contract.test.js';
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
    createdAt: '2026-04-26T08:01:00.000Z',
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
        createdAt: '2026-04-26T08:00:00.000Z',
        updatedAt: '2026-04-26T08:02:00.000Z',
        tags: [],
        messages: [
          {
            messageId: 'message-1',
            authorId: 'editor-1',
            body: 'Check this phrase.',
            createdAt: '2026-04-26T08:00:00.000Z',
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

test('RB-19 exports import seam preview schema and function', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_SCHEMA,
    'revision-bridge.revision-session-import-seam-preview.v1',
  );
  assert.equal(typeof bridge.previewRevisionSessionImportSeam, 'function');
});

test('RB-19 returns ready when adapter, placement admission, and skeleton admission are all green', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionSessionImportSeam(validInput());

  assert.equal(result.schemaVersion, 'revision-bridge.revision-session-import-seam-preview.v1');
  assert.equal(result.type, 'revisionBridge.revisionSession.importSeamPreview');
  assert.equal(result.status, 'ready');
  assert.equal(result.code, 'REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_READY');
  assert.equal(result.reason, 'REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_READY');
  assert.equal(result.canCreateRevisionSession, true);
  assert.equal(result.canMutateManuscript, false);
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.revisionSessionId, 'revision-session-1');
  assert.equal(result.exportId, 'export-1');
  assert.equal(result.baselineHash, 'baseline-hash-1');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.parsedReviewSurfaceAdapter.ok, true);
  assert.equal(result.placementBatchDiagnostics.status, 'evaluated');
  assert.equal(result.placementAdmissionPreview.status, 'admit');
  assert.equal(result.skeletonAdmissionPreview.status, 'admit');
  assert.equal(result.candidateSession.sessionId, 'revision-session-1');
  assert.equal(result.candidateSession.projectId, 'project-1');
  assert.equal(result.candidateSession.baselineHash, 'baseline-hash-1');
});

test('RB-19 returns blocked when placement evidence cannot be admitted', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionSessionImportSeam(validInput({
    parsedSurface: {
      ...validParsedSurface(),
      commentPlacements: [
        validParsedSurfacePlacement({
          placementId: 'placement-mismatch',
          quote: 'Missing quote',
        }),
      ],
    },
  }));

  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_BLOCKED');
  assert.equal(result.canCreateRevisionSession, false);
  assert.equal(result.canMutateManuscript, false);
  assert.equal(result.candidateSession, null);
  assert.equal(result.placementAdmissionPreview.status, 'block');
  assert.equal(result.skeletonAdmissionPreview.status, 'block');
  assert.equal(result.reasons.length > 0, true);
});

test('RB-19 returns diagnostics for missing required input fields', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionSessionImportSeam({
    projectId: 'project-1',
    revisionSessionId: 'revision-session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: validParsedSurface(),
  });

  const reasonFields = result.reasons.map((reason) => reason.field);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS');
  assert.equal(result.canCreateRevisionSession, false);
  assert.equal(result.canMutateManuscript, false);
  assert.equal(result.parsedReviewSurfaceAdapter, null);
  assert.equal(result.placementBatchDiagnostics, null);
  assert.equal(result.placementAdmissionPreview, null);
  assert.equal(result.skeletonAdmissionPreview, null);
  assert.equal(reasonFields.includes('exportId'), true);
});

test('RB-19 is deterministic and does not mutate caller input', async () => {
  const bridge = await loadBridge();
  const input = validInput();
  const before = deepClone(input);

  const first = bridge.previewRevisionSessionImportSeam(input);
  const second = bridge.previewRevisionSessionImportSeam(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-19 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_19_REVISION_SESSION_IMPORT_SEAM_PREVIEW_CONTRACTS_START');
  const end = source.indexOf('// RB_19_REVISION_SESSION_IMPORT_SEAM_PREVIEW_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-19 section`);
  }
});

test('RB-19 changed files stay allowlisted and package manifests are untouched', () => {
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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-structural-manual-review.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB19_TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const C05_TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const C06_TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const ALLOWLIST = [
  MODULE_PATH,
  TEST_PATH,
  P0_TEST_PATH,
  RB19_TEST_PATH,
  C05_TEST_PATH,
  C06_TEST_PATH,
  RB10_TEST_PATH,
  RB11_TEST_PATH,
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

function reviewSession(overrides = {}) {
  return {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    status: 'open',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
    },
    ...overrides,
  };
}

function structuralChange(overrides = {}) {
  return {
    structuralChangeId: 'structural-1',
    kind: 'moveBlock',
    targetScope: { type: 'scene', id: 'scene-1' },
    summary: 'Move block one below block two.',
    ...overrides,
  };
}

test('C08 exports structural manual review schema catalog and builder', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_PREVIEW_SCHEMA,
    'revision-bridge.structural-manual-review-preview.v1',
  );
  assert.equal(typeof bridge.buildStructuralManualReviewPreview, 'function');
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_REASON_CODES), true);
});

test('C08 move split and merge become manual-only preview items with zero auto apply', async () => {
  const bridge = await loadBridge();
  const input = {
    revisionSession: reviewSession({
      reviewGraph: {
        commentThreads: [],
        commentPlacements: [],
        textChanges: [],
        structuralChanges: [
          structuralChange({ structuralChangeId: 'move-1', kind: 'moveBlock', summary: 'Move block.' }),
          structuralChange({ structuralChangeId: 'split-1', kind: 'splitScene', summary: 'Split scene.' }),
          structuralChange({ structuralChangeId: 'merge-1', kind: 'mergeBlock', summary: 'Merge blocks.' }),
        ],
        diagnosticItems: [],
        decisionStates: [],
      },
    }),
  };
  const before = deepClone(input);

  const result = bridge.buildStructuralManualReviewPreview(input);

  assert.deepEqual(input, before);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'preview');
  assert.equal(result.code, 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_PREVIEW_READY');
  assert.equal(result.canAutoApply, false);
  assert.equal(result.autoApplyCount, 0);
  assert.deepEqual(result.autoApplyCandidates, []);
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map((item) => item.structuralKindGroup), ['move', 'split', 'merge']);
  assert.deepEqual(result.items.map((item) => item.manualOnlyReason), [
    'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY',
    'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_SPLIT_MANUAL_ONLY',
    'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MERGE_MANUAL_ONLY',
  ]);
  assert.equal(result.items.every((item) => item.classification === 'manualOnly'), true);
  assert.equal(result.items.every((item) => item.canAutoApply === false), true);
  assert.deepEqual(result.unsupportedObservations, []);
});

test('C08 duplicate candidates and mixed text plus structure stay manual only', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildStructuralManualReviewPreview({
    revisionSession: reviewSession({
      reviewGraph: {
        commentThreads: [],
        commentPlacements: [],
        textChanges: [
          {
            changeId: 'text-1',
            targetScope: { type: 'scene', id: 'scene-1' },
            match: { kind: 'exact', quote: 'Alpha' },
            replacementText: 'Beta',
          },
        ],
        structuralChanges: [
          structuralChange({
            kind: 'moveScene',
            candidateCount: 2,
          }),
        ],
        diagnosticItems: [],
        decisionStates: [],
      },
    }),
  });

  assert.equal(result.items.length, 1);
  assert.equal(
    result.items[0].reasonCodes.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_DUPLICATE_CANDIDATES'),
    true,
  );
  assert.equal(
    result.items[0].reasonCodes.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MIXED_TEXT_AND_STRUCTURE'),
    true,
  );
});

test('C08 exact-text-only sessions stay outside the structural preview path', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildStructuralManualReviewPreview({
    revisionSession: reviewSession({
      reviewGraph: {
        commentThreads: [],
        commentPlacements: [],
        textChanges: [
          {
            changeId: 'text-only-1',
            targetScope: { type: 'scene', id: 'scene-1' },
            match: { kind: 'exact', quote: 'Alpha' },
            replacementText: 'Beta',
          },
        ],
        structuralChanges: [],
        diagnosticItems: [],
        decisionStates: [],
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'preview');
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.unsupportedObservations, []);
  assert.equal(result.summary.totalStructuralChanges, 0);
  assert.equal(result.autoApplyCount, 0);
});

test('C08 top-level textChanges and structuralChanges still emit mixed text plus structure reason', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildStructuralManualReviewPreview({
    textChanges: [
      {
        changeId: 'text-top-level-1',
        targetScope: { type: 'scene', id: 'scene-1' },
        match: { kind: 'exact', quote: 'Alpha' },
        replacementText: 'Beta',
      },
    ],
    structuralChanges: [
      structuralChange({
        kind: 'moveScene',
        targetScope: { type: 'scene', id: 'scene-1' },
        summary: 'Move scene.',
      }),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
  assert.equal(
    result.items[0].reasonCodes.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MIXED_TEXT_AND_STRUCTURE'),
    true,
  );
});

test('C08 comment risk weak block identity and weak evidence remain manual only', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildStructuralManualReviewPreview({
    revisionSession: reviewSession({
      reviewGraph: {
        commentThreads: [],
        commentPlacements: [],
        textChanges: [],
        structuralChanges: [
          structuralChange({
            kind: 'splitBlock',
            commentRiskSignal: true,
            blockIdInsufficient: true,
            evidenceStrength: 'weak',
          }),
        ],
        diagnosticItems: [],
        decisionStates: [],
      },
    }),
  });

  assert.equal(result.items.length, 1);
  assert.equal(
    result.items[0].reasonCodes.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_COMMENT_ANCHOR_RISK_SIGNAL'),
    true,
  );
  assert.equal(
    result.items[0].reasonCodes.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_BLOCK_ID_INSUFFICIENT'),
    true,
  );
  assert.equal(
    result.items[0].reasonCodes.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_EVIDENCE_TOO_WEAK'),
    true,
  );
});

test('C08 unsupported structural kinds become unsupported observations not apply candidates', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildStructuralManualReviewPreview({
    revisionSession: reviewSession({
      reviewGraph: {
        commentThreads: [],
        commentPlacements: [],
        textChanges: [],
        structuralChanges: [
          structuralChange({
            structuralChangeId: 'copy-1',
            kind: 'copyBlock',
            summary: 'Copy block.',
          }),
        ],
        diagnosticItems: [],
        decisionStates: [],
      },
    }),
  });

  assert.equal(result.items.length, 0);
  assert.equal(result.unsupportedObservations.length, 1);
  assert.equal(result.unsupportedObservations[0].reason, 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_UNSUPPORTED_KIND');
  assert.equal(result.canAutoApply, false);
  assert.equal(result.autoApplyCount, 0);
});

test('C08 non-object input returns diagnostics shape', async () => {
  const bridge = await loadBridge();

  const result = bridge.buildStructuralManualReviewPreview(null);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_PREVIEW_DIAGNOSTICS');
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.unsupportedObservations, []);
});

test('C08 changed files stay inside the exact task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  const disallowed = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  assert.deepEqual(disallowed, []);
});

test('C08 wiring remains kernel only and does not pull UI or filesystem APIs', () => {
  const currentText = fs.readFileSync(MODULE_PATH, 'utf8');

  assert.equal(currentText.includes('buildStructuralManualReviewPreview'), true);
  assert.equal(currentText.includes('revision-bridge.structural-manual-review-preview.v1'), true);
  assert.equal(/\bipcMain\b/u.test(currentText), false);
  assert.equal(/\bipcRenderer\b/u.test(currentText), false);
  assert.equal(/\bfetch\s*\(/u.test(currentText), false);
});

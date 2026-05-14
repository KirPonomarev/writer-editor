const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/exactTextMinSafeWrite.mjs';
const C03_MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const C03_TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const TEST_PATH = 'test/contracts/revision-bridge-exact-text-min-safe-write.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const C05_TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const C06_TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const ALLOWLIST = [
  MODULE_PATH,
  C03_MODULE_PATH,
  C03_TEST_PATH,
  TEST_PATH,
  P0_TEST_PATH,
  RB10_TEST_PATH,
  RB11_TEST_PATH,
  C05_TEST_PATH,
  C06_TEST_PATH,
  GOVERNANCE_APPROVALS_PATH,
];

async function loadC04() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

async function loadC03() {
  return import(pathToFileURL(path.join(process.cwd(), C03_MODULE_PATH)).href);
}

function tmpScene(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-c04-min-safe-write-'));
  const scenePath = path.join(dir, 'scene.md');
  fs.writeFileSync(scenePath, text, 'utf8');
  return { dir, scenePath };
}

function readText(scenePath) {
  return fs.readFileSync(scenePath, 'utf8');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function validProjectSnapshot({
  projectId = 'project-1',
  baselineHash = 'baseline-1',
  sceneId = 'scene-1',
  sceneText = 'Alpha beta gamma.',
} = {}) {
  return {
    projectId,
    baselineHash,
    scenes: [
      {
        sceneId,
        text: sceneText,
      },
    ],
  };
}

function validRevisionSession({
  projectId = 'project-1',
  sessionId = 'session-1',
  baselineHash = 'baseline-1',
  status = 'open',
  quote = 'beta',
  replacementText = 'delta',
  targetScope = { type: 'scene', id: 'scene-1' },
  textChanges,
  structuralChanges = [],
  commentThreads = [],
  commentPlacements = [],
} = {}) {
  return {
    projectId,
    sessionId,
    baselineHash,
    status,
    reviewGraph: {
      commentThreads,
      commentPlacements,
      textChanges: textChanges || [
        {
          changeId: 'change-1',
          targetScope,
          match: { kind: 'exact', quote, prefix: '', suffix: '' },
          replacementText,
          createdAt: '2026-05-14T08:00:00.000Z',
        },
      ],
      structuralChanges,
      diagnosticItems: [],
      decisionStates: [],
    },
  };
}

async function readyInput({ sceneText = 'Alpha beta gamma.', revisionSession, projectSnapshot, scenePath } = {}) {
  const c03 = await loadC03();
  const snapshot = projectSnapshot || validProjectSnapshot({ sceneText });
  const session = revisionSession || validRevisionSession();
  const preview = c03.buildExactTextApplyPlanNoDiskPreview({
    projectSnapshot: snapshot,
    revisionSession: session,
  });
  assert.equal(preview.status, 'ready');
  return {
    projectRoot: path.dirname(scenePath),
    projectSnapshot: snapshot,
    revisionSession: session,
    planPreview: preview,
    scenePath,
    scenePathBySceneId: {
      'scene-1': scenePath,
    },
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertTruthfulRecoveryEvidence(recovery, expectedText, { readable = true } = {}) {
  assert.equal(recovery.snapshotCreated, true);
  assert.equal(typeof recovery.snapshotPath, 'string');
  assert.equal(recovery.snapshotPath.length > 0, true);
  assert.equal(recovery.recoveryAction, 'OPEN_SNAPSHOT_OR_ABORT');
  assert.equal(recovery.snapshotReadable, readable);
  assert.equal(recovery.snapshotHashMatchesInput, readable);
  assert.equal(fs.existsSync(recovery.snapshotPath), readable);
  if (readable) {
    assert.equal(fs.readFileSync(recovery.snapshotPath, 'utf8'), expectedText);
  }
}

function assertTruthfulReceipt(receipt, scenePath, expectedText, originalText = 'Alpha beta gamma.') {
  assert.equal(receipt.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_APPLIED');
  assert.equal(receipt.bytesWritten, Buffer.byteLength(expectedText, 'utf8'));
  assert.equal(receipt.outputHash, sha256Text(expectedText));
  assert.equal(readText(scenePath), expectedText);
  assertTruthfulRecoveryEvidence(receipt.recovery, originalText);
}

test('C04 exact text min safe write applies one replacement and returns receipt with recovery evidence', async () => {
  const c04 = await loadC04();
  const { scenePath } = tmpScene('Alpha beta gamma.');
  const input = await readyInput({ scenePath });

  const result = await c04.applyExactTextMinSafeWrite(input, { now: () => 1700000000000 });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'applied');
  assert.equal(result.applied, true);
  assert.equal(readText(scenePath), 'Alpha delta gamma.');
  assert.equal(result.receipt.schemaVersion, c04.REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_RECEIPT_SCHEMA);
  assert.equal(result.receipt.projectId, 'project-1');
  assert.equal(result.receipt.sessionId, 'session-1');
  assert.equal(result.receipt.sceneId, 'scene-1');
  assert.equal(result.receipt.changeId, 'change-1');
  assert.equal(result.receipt.bytesWritten, Buffer.byteLength('Alpha delta gamma.', 'utf8'));
  assert.equal(result.receipt.transactionId.startsWith('tx_'), true);
  assert.equal(result.receipt.recovery.snapshotCreated, true);
  assert.equal(typeof result.receipt.recovery.snapshotPath, 'string');
  assert.equal(fs.existsSync(result.receipt.recovery.snapshotPath), true);
  assert.equal(result.receipt.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_APPLIED');
  assert.match(result.receipt.inputHash, /^[a-f0-9]{64}$/u);
  assert.match(result.receipt.outputHash, /^[a-f0-9]{64}$/u);
});

test('C04 inherited C03 block matrix performs zero writes', async () => {
  const c04 = await loadC04();
  const cases = [
    [
      'wrong project',
      validProjectSnapshot({ projectId: 'project-a' }),
      validRevisionSession({ projectId: 'project-b' }),
    ],
    [
      'stale',
      validProjectSnapshot({ baselineHash: 'baseline-a' }),
      validRevisionSession({ baselineHash: 'baseline-b' }),
    ],
    [
      'closed',
      validProjectSnapshot(),
      validRevisionSession({ status: 'closed' }),
    ],
    [
      'duplicate',
      validProjectSnapshot({ sceneText: 'Alpha beta beta.' }),
      validRevisionSession(),
    ],
    [
      'no match',
      validProjectSnapshot({ sceneText: 'Alpha omega gamma.' }),
      validRevisionSession(),
    ],
    [
      'structural',
      validProjectSnapshot(),
      validRevisionSession({
        structuralChanges: [{ structuralChangeId: 'structural-1', kind: 'split-scene' }],
      }),
    ],
    [
      'comment-only',
      validProjectSnapshot(),
      validRevisionSession({
        textChanges: [],
        commentThreads: [{ threadId: 'thread-1', messages: [] }],
      }),
    ],
    [
      'reviewItem mismatch',
      validProjectSnapshot(),
      validRevisionSession(),
      {
        changeId: 'other-change',
        targetScope: { type: 'scene', id: 'scene-1' },
        match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
        replacementText: 'delta',
      },
    ],
  ];

  for (const [label, projectSnapshot, revisionSession, reviewItem] of cases) {
    const { scenePath } = tmpScene(projectSnapshot.scenes[0].text);
    const result = await c04.applyExactTextMinSafeWrite({
      projectRoot: path.dirname(scenePath),
      projectSnapshot,
      revisionSession,
      reviewItem,
      planPreview: { plan: { canApply: false, noDisk: true, safeWriteCandidate: false, applyOps: [] } },
      scenePath,
      scenePathBySceneId: {
        'scene-1': scenePath,
      },
    });

    assert.equal(result.status, 'blocked', label);
    assert.equal(result.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_NOT_READY', label);
    assert.equal(readText(scenePath), projectSnapshot.scenes[0].text, label);
  }
});

test('C04 blocks provided plan mismatch and current drift with zero writes', async () => {
  const c04 = await loadC04();
  const { scenePath } = tmpScene('Alpha beta gamma.');
  const input = await readyInput({ scenePath });

  const mismatched = JSON.parse(JSON.stringify(input));
  mismatched.planPreview.plan.applyOps[0].expectedText = 'gamma';
  const mismatchResult = await c04.applyExactTextMinSafeWrite(mismatched);

  assert.equal(mismatchResult.status, 'blocked');
  assert.equal(mismatchResult.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_MISMATCH');
  assert.equal(readText(scenePath), 'Alpha beta gamma.');

  const replacementMismatch = JSON.parse(JSON.stringify(input));
  replacementMismatch.planPreview.plan.applyOps[0].replacementText = 'epsilon';
  const replacementMismatchResult = await c04.applyExactTextMinSafeWrite(replacementMismatch);

  assert.equal(replacementMismatchResult.status, 'blocked');
  assert.equal(replacementMismatchResult.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_MISMATCH');
  assert.equal(readText(scenePath), 'Alpha beta gamma.');

  fs.writeFileSync(scenePath, 'Alpha beta gamma. local edit', 'utf8');
  const driftResult = await c04.applyExactTextMinSafeWrite(input);

  assert.equal(driftResult.status, 'blocked');
  assert.equal(driftResult.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_DRIFT');
  assert.equal(readText(scenePath), 'Alpha beta gamma. local edit');
});

test('C04 preserves whitespace byte-exactly and allows single-space replacement from provided op', async () => {
  const c04 = await loadC04();
  const sceneText = '  Alpha beta  \nOmega\n';
  const { scenePath } = tmpScene(sceneText);
  const input = await readyInput({
    sceneText,
    scenePath,
    revisionSession: validRevisionSession({ replacementText: ' ' }),
  });

  const result = await c04.applyExactTextMinSafeWrite(input, { now: () => 1700000001000 });

  assert.equal(result.status, 'applied');
  assert.equal(readText(scenePath), '  Alpha    \nOmega\n');
  assert.equal(result.receipt.bytesWritten, Buffer.byteLength('  Alpha    \nOmega\n', 'utf8'));
});

test('C04 current duplicate and no match are inherited from rebuilt C03 with zero writes', async () => {
  const c04 = await loadC04();

  for (const [label, sceneText, expectedReason] of [
    ['duplicate', 'Alpha beta beta.', 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_DUPLICATE_MATCH'],
    ['no match', 'Alpha omega gamma.', 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_MATCH'],
  ]) {
    const { scenePath } = tmpScene(sceneText);
    const result = await c04.applyExactTextMinSafeWrite({
      projectRoot: path.dirname(scenePath),
      projectSnapshot: validProjectSnapshot({ sceneText }),
      revisionSession: validRevisionSession(),
      planPreview: { plan: { canApply: false, noDisk: true, safeWriteCandidate: false, applyOps: [] } },
      scenePath,
      scenePathBySceneId: {
        'scene-1': scenePath,
      },
    });

    assert.equal(result.status, 'blocked', label);
    assert.equal(result.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_NOT_READY', label);
    assert.equal(result.reasons[0].rebuiltReasons.some((reason) => reason.code === expectedReason), true, label);
    assert.equal(readText(scenePath), sceneText, label);
  }
});

test('C04 blocks unbound or out-of-project scene paths with zero writes', async () => {
  const c04 = await loadC04();
  const { scenePath } = tmpScene('Alpha beta gamma.');
  const input = await readyInput({ scenePath });

  const unbound = JSON.parse(JSON.stringify(input));
  unbound.scenePathBySceneId = {};
  const unboundResult = await c04.applyExactTextMinSafeWrite(unbound);
  assert.equal(unboundResult.status, 'blocked');
  assert.equal(unboundResult.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_SCENE_PATH_BINDING_MISMATCH');
  assert.equal(readText(scenePath), 'Alpha beta gamma.');

  const outside = JSON.parse(JSON.stringify(input));
  outside.projectRoot = path.join(path.dirname(scenePath), 'other-root');
  const outsideResult = await c04.applyExactTextMinSafeWrite(outside);
  assert.equal(outsideResult.status, 'blocked');
  assert.equal(outsideResult.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_SCENE_PATH_OUTSIDE_PROJECT');
  assert.equal(readText(scenePath), 'Alpha beta gamma.');
});

test('C04 failed beforeRename preserves target and returns no applied receipt with recovery evidence', async () => {
  const c04 = await loadC04();
  const { scenePath } = tmpScene('Alpha beta gamma.');
  const input = await readyInput({ scenePath });

  const result = await c04.applyExactTextMinSafeWrite(input, {
    now: () => 1700000002000,
    beforeRename: () => {
      throw new Error('forced beforeRename failure');
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.applied, false);
  assert.equal(result.receipt, null);
  assert.equal(result.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_WRITE_FAILED');
  assert.equal(readText(scenePath), 'Alpha beta gamma.');
  assert.equal(result.reasons[0].recovery.snapshotCreated, true);
  assert.equal(typeof result.reasons[0].recovery.snapshotPath, 'string');
});

test('C07 failure matrix keeps target, recovery, receipt, and second run truthful', async () => {
  const c04 = await loadC04();
  const beforeText = 'Alpha beta gamma.';
  const afterText = 'Alpha delta gamma.';
  const cases = [
    {
      label: 'BEFORE_WRITE',
      options: {
        now: () => 1700000003000,
        beforeWrite: () => {
          throw new Error('forced BEFORE_WRITE failure');
        },
      },
      firstText: beforeText,
      recoveryReadable: true,
      second: 'applied',
    },
    {
      label: 'BEFORE_RENAME',
      options: {
        now: () => 1700000004000,
        beforeRename: () => {
          throw new Error('forced BEFORE_RENAME failure');
        },
      },
      firstText: beforeText,
      recoveryReadable: true,
      second: 'applied',
    },
    {
      label: 'AFTER_RENAME_BEFORE_RECEIPT',
      options: {
        now: () => 1700000005000,
        afterRenameBeforeReceipt: () => {
          throw new Error('forced AFTER_RENAME_BEFORE_RECEIPT failure');
        },
      },
      firstText: afterText,
      recoveryReadable: true,
      second: 'blocked',
    },
    {
      label: 'BAD_RECEIPT',
      options: {
        now: () => 1700000006000,
        afterReceipt: (receipt) => ({
          ...receipt,
          outputHash: '0'.repeat(64),
        }),
      },
      firstText: afterText,
      recoveryReadable: true,
      second: 'blocked',
      reason: 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_RECEIPT_INVALID',
      receiptFailure: 'receipt outputHash does not match output',
    },
    {
      label: 'BAD_RECOVERY',
      options: {
        now: () => 1700000007000,
        afterRenameBeforeReceipt: ({ recovery }) => {
          fs.unlinkSync(recovery.snapshotPath);
        },
      },
      firstText: afterText,
      recoveryReadable: false,
      second: 'blocked',
      reason: 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_RECOVERY_INVALID',
      receiptFailure: 'receipt recovery snapshot is not readable',
    },
    {
      label: 'BAD_RECOVERY_RECEIPT_PATH',
      options: {
        now: () => 1700000007100,
        afterReceipt: (receipt) => ({
          ...receipt,
          recovery: {
            ...receipt.recovery,
            snapshotPath: `${receipt.recovery.snapshotPath}.missing`,
          },
        }),
      },
      firstText: afterText,
      recoveryReadable: true,
      second: 'blocked',
      reason: 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_RECOVERY_INVALID',
      receiptFailure: 'receipt recovery snapshot is not readable',
    },
  ];

  for (const testCase of cases) {
    const { scenePath } = tmpScene(beforeText);
    const input = await readyInput({ scenePath });

    const first = await c04.applyExactTextMinSafeWrite(input, testCase.options);

    assert.equal(first.status, 'failed', testCase.label);
    assert.equal(first.applied, false, testCase.label);
    assert.equal(first.receipt, null, testCase.label);
    assert.equal(first.reason, testCase.reason || 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_WRITE_FAILED', testCase.label);
    assert.equal(readText(scenePath), testCase.firstText, testCase.label);
    assertTruthfulRecoveryEvidence(first.reasons[0].recovery, beforeText, {
      readable: testCase.recoveryReadable,
    });
    if (testCase.receiptFailure) {
      assert.equal(first.reasons[0].receiptFailures.includes(testCase.receiptFailure), true, testCase.label);
    }

    const second = await c04.applyExactTextMinSafeWrite(input, { now: () => 1700000008000 });

    if (testCase.second === 'applied') {
      assert.equal(second.status, 'applied', `${testCase.label} SECOND_RUN_AFTER_FAILURE`);
      assert.equal(second.applied, true, `${testCase.label} SECOND_RUN_AFTER_FAILURE`);
      assertTruthfulReceipt(second.receipt, scenePath, afterText);
    } else {
      assert.equal(second.status, 'blocked', `${testCase.label} SECOND_RUN_AFTER_FAILURE`);
      assert.equal(second.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_DRIFT', `${testCase.label} SECOND_RUN_AFTER_FAILURE`);
      assert.equal(second.receipt, null, `${testCase.label} SECOND_RUN_AFTER_FAILURE`);
      assert.equal(readText(scenePath), afterText, `${testCase.label} SECOND_RUN_AFTER_FAILURE`);
    }
  }
});

test('C04 has no UI, IPC, runtime, docx, package, or markdown wiring changes', () => {
  const forbiddenChanged = [
    'src/main.js',
    'src/preload.js',
    'package.json',
    'package-lock.json',
  ];

  for (const filePath of forbiddenChanged) {
    const headText = execFileSync('git', ['show', `HEAD:${filePath}`], { encoding: 'utf8' });
    assert.equal(fs.readFileSync(filePath, 'utf8'), headText, `${filePath} changed from HEAD`);
  }

  const moduleText = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.equal(moduleText.includes('main.js'), false);
  assert.equal(moduleText.includes('preload'), false);
  assert.equal(moduleText.includes('docx'), false);
  assert.equal(moduleText.includes('ipcMain'), false);
  assert.equal(moduleText.includes('ipcRenderer'), false);
});

test('C04 changed files stay inside the task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath)), []);
});

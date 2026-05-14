const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const C04_MODULE_PATH = 'src/io/revisionBridge/exactTextMinSafeWrite.mjs';
const C04_TEST_PATH = 'test/contracts/revision-bridge-exact-text-min-safe-write.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const C05_TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const C06_TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const C08_TEST_PATH = 'test/contracts/revision-bridge-structural-manual-review.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const ALLOWLIST = [
  MODULE_PATH,
  TEST_PATH,
  P0_TEST_PATH,
  C04_MODULE_PATH,
  C04_TEST_PATH,
  RB10_TEST_PATH,
  RB11_TEST_PATH,
  C05_TEST_PATH,
  C06_TEST_PATH,
  C08_TEST_PATH,
  GOVERNANCE_APPROVALS_PATH,
];
const WIRING_NEEDLES = [
  'buildExactTextApplyPlanNoDiskPreview',
  'revision-bridge.exact-text-apply-plan-no-disk.v1',
  'exact-text-apply-plan-no-disk',
];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readFilesUnder(dirPath, predicate = () => true) {
  const files = [];
  if (!fs.existsSync(dirPath)) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...readFilesUnder(fullPath, predicate));
      continue;
    }
    if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files.sort();
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function changedFilesOutsideAllowlist(changedFiles) {
  const allowed = new Set(ALLOWLIST);
  return changedFiles.filter((filePath) => !allowed.has(filePath));
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
  textChanges = [
    {
      changeId: 'change-1',
      targetScope: { type: 'scene', id: 'scene-1' },
      match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
      replacementText: 'delta',
      createdAt: '2026-05-14T08:00:00.000Z',
    },
  ],
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
      textChanges,
      structuralChanges,
      diagnosticItems: [],
      decisionStates: [],
    },
  };
}

function validInput(overrides = {}) {
  return {
    projectSnapshot: validProjectSnapshot(),
    revisionSession: validRevisionSession(),
    ...overrides,
  };
}

test('RB-19 exports exact-text apply plan no-disk schema, reason catalog, and builder', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_SCHEMA,
    'revision-bridge.exact-text-apply-plan-no-disk.v1',
  );
  assert.equal(typeof bridge.buildExactTextApplyPlanNoDiskPreview, 'function');
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_REASON_CODES), true);
  assert.equal(
    bridge.REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_REASON_CODES.includes('REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_READY'),
    true,
  );
});

test('RB-19 positive path yields one deterministic exact replacement op', async () => {
  const bridge = await loadBridge();
  const input = validInput();
  const before = deepClone(input);

  const first = bridge.buildExactTextApplyPlanNoDiskPreview(input);
  const second = bridge.buildExactTextApplyPlanNoDiskPreview(deepClone(input));

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.type, 'revisionBridge.exactTextApplyPlanNoDiskPreview');
  assert.equal(first.status, 'ready');
  assert.equal(first.code, 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_READY');
  assert.equal(first.reason, 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_READY');
  assert.deepEqual(first.reasons, []);
  assert.equal(first.plan.schemaVersion, bridge.REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_SCHEMA);
  assert.equal(first.plan.canApply, false);
  assert.equal(first.plan.noDisk, true);
  assert.equal(first.plan.safeWriteCandidate, false);
  assert.equal(first.plan.applyOps.length, 1);
  assert.deepEqual(first.plan.applyOps[0], {
    opId: first.plan.applyOps[0].opId,
    kind: 'replaceExactText',
    sceneId: 'scene-1',
    changeId: 'change-1',
    from: 6,
    to: 10,
    expectedText: 'beta',
    replacementText: 'delta',
  });
  assert.equal(first.plan.preconditions.every((item) => item.satisfied === true), true);
  assert.deepEqual(first.plan.blockedReasons, []);
});

test('RB-19 preserves byte-exact replacement text for the later safe write contour', async () => {
  const bridge = await loadBridge();
  const input = validInput({
    projectSnapshot: validProjectSnapshot({ sceneText: '  Alpha beta  \nOmega\n' }),
    revisionSession: validRevisionSession({
      textChanges: [
        {
          changeId: 'change-space',
          targetScope: { type: 'scene', id: 'scene-1' },
          match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
          replacementText: ' ',
          createdAt: '2026-05-14T08:00:00.000Z',
        },
      ],
    }),
  });

  const result = bridge.buildExactTextApplyPlanNoDiskPreview(input);

  assert.equal(result.status, 'ready');
  assert.equal(result.plan.applyOps.length, 1);
  assert.equal(result.plan.applyOps[0].from, 8);
  assert.equal(result.plan.applyOps[0].to, 12);
  assert.equal(result.plan.applyOps[0].replacementText, ' ');
});

test('RB-19 blocked matrix returns zero apply ops with required reason codes', async () => {
  const bridge = await loadBridge();
  const cases = [
    [
      'wrong project',
      validInput({
        projectSnapshot: validProjectSnapshot({ projectId: 'project-a' }),
        revisionSession: validRevisionSession({ projectId: 'project-b' }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_PROJECT_MISMATCH',
    ],
    [
      'stale base',
      validInput({
        projectSnapshot: validProjectSnapshot({ baselineHash: 'baseline-a' }),
        revisionSession: validRevisionSession({ baselineHash: 'baseline-b' }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_STALE_BASELINE',
    ],
    [
      'closed session',
      validInput({
        revisionSession: validRevisionSession({ status: 'closed' }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_SESSION_CLOSED',
    ],
    [
      'duplicate match',
      validInput({
        projectSnapshot: validProjectSnapshot({ sceneText: 'Alpha beta gamma beta.' }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_DUPLICATE_MATCH',
    ],
    [
      'no match',
      validInput({
        projectSnapshot: validProjectSnapshot({ sceneText: 'Alpha omega gamma.' }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_MATCH',
    ],
    [
      'structural change',
      validInput({
        revisionSession: validRevisionSession({
          structuralChanges: [
            {
              structuralChangeId: 'structural-1',
              kind: 'split-scene',
              targetScope: { type: 'scene', id: 'scene-1' },
              summary: 'split',
            },
          ],
        }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_STRUCTURAL_CHANGE',
    ],
    [
      'comment only',
      validInput({
        revisionSession: validRevisionSession({
          textChanges: [],
          commentThreads: [
            {
              threadId: 'thread-1',
              authorId: 'editor-1',
              status: 'open',
              createdAt: '2026-05-14T08:00:00.000Z',
              updatedAt: '2026-05-14T08:00:00.000Z',
              messages: [
                {
                  messageId: 'm-1',
                  authorId: 'editor-1',
                  body: 'Comment only.',
                  createdAt: '2026-05-14T08:00:00.000Z',
                },
              ],
            },
          ],
        }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_COMMENT_ONLY',
    ],
    [
      'unsupported surface',
      validInput({
        revisionSession: validRevisionSession({
          textChanges: [
            {
              changeId: 'change-1',
              targetScope: { type: 'project', id: 'scene-1' },
              match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
              replacementText: 'delta',
              createdAt: '2026-05-14T08:00:00.000Z',
            },
          ],
        }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_UNSUPPORTED_SURFACE',
    ],
    [
      'explicit review item cannot bypass multiple session text changes',
      validInput({
        reviewItem: {
          changeId: 'change-1',
          targetScope: { type: 'scene', id: 'scene-1' },
          match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
          replacementText: 'delta',
          createdAt: '2026-05-14T08:00:00.000Z',
        },
        revisionSession: validRevisionSession({
          textChanges: [
            {
              changeId: 'change-1',
              targetScope: { type: 'scene', id: 'scene-1' },
              match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
              replacementText: 'delta',
              createdAt: '2026-05-14T08:00:00.000Z',
            },
            {
              changeId: 'change-2',
              targetScope: { type: 'scene', id: 'scene-1' },
              match: { kind: 'exact', quote: 'gamma', prefix: '', suffix: '' },
              replacementText: 'epsilon',
              createdAt: '2026-05-14T08:01:00.000Z',
            },
          ],
        }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_MULTI_TEXT_CHANGE',
    ],
    [
      'explicit review item cannot override the single session text change',
      validInput({
        reviewItem: {
          changeId: 'override-change',
          targetScope: { type: 'scene', id: 'scene-1' },
          match: { kind: 'exact', quote: 'gamma', prefix: '', suffix: '' },
          replacementText: 'epsilon',
          createdAt: '2026-05-14T08:02:00.000Z',
        },
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_REVIEW_ITEM_SESSION_MISMATCH',
    ],
    [
      'explicit review item cannot replace an empty session',
      validInput({
        reviewItem: {
          changeId: 'review-only-change',
          targetScope: { type: 'scene', id: 'scene-1' },
          match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
          replacementText: 'delta',
          createdAt: '2026-05-14T08:03:00.000Z',
        },
        revisionSession: validRevisionSession({
          textChanges: [],
        }),
      }),
      'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_REVIEW_ITEM_SESSION_MISMATCH',
    ],
  ];

  for (const [label, input, expectedCode] of cases) {
    const result = bridge.buildExactTextApplyPlanNoDiskPreview(input);

    assert.equal(result.ok, true, label);
    assert.equal(result.status, 'blocked', label);
    assert.equal(result.code, 'E_REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_BLOCKED', label);
    assert.equal(result.plan.canApply, false, label);
    assert.equal(result.plan.noDisk, true, label);
    assert.equal(result.plan.safeWriteCandidate, false, label);
    assert.deepEqual(result.plan.applyOps, [], label);
    assert.equal(result.reasons.some((reason) => reason.code === expectedCode), true, label);
    assert.equal(result.plan.blockedReasons.some((reason) => reason.code === expectedCode), true, label);
  }
});

test('RB-19 diagnostics fail closed for malformed input', async () => {
  const bridge = await loadBridge();
  const missingSnapshot = bridge.buildExactTextApplyPlanNoDiskPreview({
    revisionSession: validRevisionSession(),
  });
  const nonObject = bridge.buildExactTextApplyPlanNoDiskPreview(null);

  assert.equal(missingSnapshot.ok, false);
  assert.equal(missingSnapshot.status, 'diagnostics');
  assert.equal(missingSnapshot.code, 'E_REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_DIAGNOSTICS');
  assert.equal(missingSnapshot.plan, null);
  assert.equal(missingSnapshot.reasons.some((reason) => reason.field === 'projectSnapshot'), true);

  assert.equal(nonObject.ok, false);
  assert.equal(nonObject.status, 'diagnostics');
  assert.equal(nonObject.code, 'E_REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_DISK_DIAGNOSTICS');
  assert.equal(nonObject.plan, null);
});

test('RB-19 exact-text planner has no runtime, storage, or UI wiring', () => {
  const files = [
    'src/main.js',
    'src/preload.js',
    ...readFilesUnder(path.join(process.cwd(), 'src', 'renderer'), (filePath) => /\.(js|mjs|html|css)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'menu'), (filePath) => /\.(js|mjs|json)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'io', 'markdown'), (filePath) => /\.(js|mjs)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'export', 'docx'), (filePath) => /\.(js|mjs)$/u.test(filePath)),
  ];

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const needle of WIRING_NEEDLES) {
      assert.equal(text.includes(needle), false, `${needle} must not be wired in ${filePath}`);
    }
  }
});

test('RB-19 changed files stay inside the exact task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
});

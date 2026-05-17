const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-reviewgraph-contract.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB03_TEST_PATH = 'test/contracts/revision-bridge-review-packet-preview-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, P0_TEST_PATH, RB03_TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function validThread() {
  return {
    threadId: 'thread-1',
    authorId: 'editor-1',
    status: 'open',
    createdAt: '2026-04-24T08:00:00.000Z',
    updatedAt: '2026-04-24T08:30:00.000Z',
    tags: ['clarity'],
    messages: [
      {
        messageId: 'message-1',
        authorId: 'editor-1',
        body: 'Tighten this sentence.',
        createdAt: '2026-04-24T08:00:00.000Z',
      },
    ],
  };
}

function validPlacement() {
  return {
    placementId: 'placement-1',
    threadId: 'thread-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    anchor: {
      kind: 'text',
      value: 'anchor-1',
    },
    range: {
      from: 10,
      to: 24,
    },
    quote: 'original sentence',
    prefix: 'before',
    suffix: 'after',
    confidence: 1,
    policy: 'exact',
    selector: {
      type: 'text-position',
      start: 10,
      end: 24,
    },
    createdAt: '2026-04-24T08:01:00.000Z',
  };
}

function validTextChange() {
  return {
    changeId: 'text-change-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    match: {
      kind: 'exact',
      quote: 'original sentence',
      prefix: 'before',
      suffix: 'after',
    },
    replacementText: 'revised sentence',
    createdAt: '2026-04-24T08:02:00.000Z',
  };
}

function validStructuralChange() {
  return {
    structuralChangeId: 'structural-change-1',
    kind: 'split-scene',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    summary: 'Consider splitting the scene.',
    createdAt: '2026-04-24T08:03:00.000Z',
  };
}

function validDiagnosticItem() {
  return {
    diagnosticId: 'diagnostic-1',
    severity: 'warning',
    message: 'Manual review required.',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    relatedItemId: 'structural-change-1',
    createdAt: '2026-04-24T08:04:00.000Z',
  };
}

function validDecisionState() {
  return {
    decisionId: 'decision-1',
    itemKind: 'textChange',
    itemId: 'text-change-1',
    status: 'accepted',
    decidedAt: '2026-04-24T08:05:00.000Z',
    reason: 'Editor approved manually.',
  };
}

function validSession() {
  return {
    sessionId: 'session-1',
    projectId: 'project-1',
    baselineHash: 'baseline-hash-1',
    createdAt: '2026-04-24T08:00:00.000Z',
    updatedAt: '2026-04-24T08:05:00.000Z',
    reviewGraph: {
      commentThreads: [validThread()],
      commentPlacements: [validPlacement()],
      textChanges: [validTextChange()],
      structuralChanges: [validStructuralChange()],
      diagnosticItems: [validDiagnosticItem()],
      decisionStates: [validDecisionState()],
    },
  };
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

function changedFilesOutsideAllowlist(changedFiles) {
  const allowedPaths = new Set(ALLOWLIST);
  return changedFiles.filter((filePath) => !allowedPaths.has(filePath));
}

test('revision bridge exports RB-02 schema constants and pure contract functions', async () => {
  const bridge = await loadBridge();
  const expectedExports = [
    'REVISION_BRIDGE_REVISION_SESSION_SCHEMA',
    'REVISION_BRIDGE_COMMENT_THREAD_SCHEMA',
    'REVISION_BRIDGE_COMMENT_PLACEMENT_SCHEMA',
    'REVISION_BRIDGE_TEXT_CHANGE_SCHEMA',
    'REVISION_BRIDGE_STRUCTURAL_CHANGE_SCHEMA',
    'REVISION_BRIDGE_DIAGNOSTIC_ITEM_SCHEMA',
    'REVISION_BRIDGE_DECISION_STATE_SCHEMA',
    'createRevisionSession',
    'normalizeRevisionSession',
    'validateRevisionSession',
    'createCommentThread',
    'normalizeCommentThread',
    'validateCommentThread',
    'createCommentPlacement',
    'normalizeCommentPlacement',
    'validateCommentPlacement',
    'createTextChange',
    'normalizeTextChange',
    'validateTextChange',
    'createStructuralChange',
    'normalizeStructuralChange',
    'validateStructuralChange',
    'createDiagnosticItem',
    'normalizeDiagnosticItem',
    'validateDiagnosticItem',
    'createDecisionState',
    'normalizeDecisionState',
    'validateDecisionState',
  ];

  for (const exportName of expectedExports) {
    assert.notEqual(bridge[exportName], undefined, `${exportName} must be exported`);
  }
});

test('comment threads and placements stay separate by contract', async () => {
  const bridge = await loadBridge();
  const forbiddenThreadFields = [
    'targetScope',
    'anchor',
    'range',
    'quote',
    'prefix',
    'suffix',
    'confidence',
    'policy',
    'placement',
    'placementHint',
    'match',
    'selector',
  ];

  for (const field of forbiddenThreadFields) {
    const result = bridge.validateCommentThread({
      ...validThread(),
      [field]: field === 'confidence' ? 1 : 'placement-payload',
    });
    assert.equal(result.ok, false, `CommentThread must reject ${field}`);
    assert.equal(result.reasons.some((reason) => reason.field === `commentThread.${field}`), true);
  }

  for (const field of ['text', 'body', 'message', 'messageBody', 'messages', 'commentText']) {
    const result = bridge.validateCommentPlacement({
      ...validPlacement(),
      [field]: field === 'messages' ? [{ body: 'duplicate' }] : 'duplicate',
    });
    assert.equal(result.ok, false, `CommentPlacement must reject ${field}`);
    assert.equal(result.reasons.some((reason) => reason.field === `commentPlacement.${field}`), true);
  }

  const thread = bridge.createCommentThread(validThread());
  const placement = bridge.createCommentPlacement(validPlacement());
  assert.equal(Object.prototype.hasOwnProperty.call(thread, 'targetScope'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(thread, 'range'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(placement, 'messages'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(placement, 'body'), false);
});

test('revision session validation rejects malformed collections and entries', async () => {
  const bridge = await loadBridge();
  const nonArraySession = validSession();
  nonArraySession.reviewGraph.commentThreads = {};
  nonArraySession.reviewGraph.textChanges = 'bad';

  const nonArrayResult = bridge.validateRevisionSession(nonArraySession);
  assert.equal(nonArrayResult.ok, false);
  assert.equal(nonArrayResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.commentThreads'
  )), true);
  assert.equal(nonArrayResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.textChanges'
  )), true);

  const malformedEntrySession = validSession();
  malformedEntrySession.reviewGraph.commentPlacements = ['bad-entry'];
  malformedEntrySession.reviewGraph.decisionStates = [null];

  const malformedEntryResult = bridge.validateRevisionSession(malformedEntrySession);
  assert.equal(malformedEntryResult.ok, false);
  assert.equal(malformedEntryResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.commentPlacements.0'
  )), true);
  assert.equal(malformedEntryResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.decisionStates.0'
  )), true);
});

test('revision session validation rejects unknown cross-entity references', async () => {
  const bridge = await loadBridge();
  const unknownThreadSession = validSession();
  unknownThreadSession.reviewGraph.commentPlacements[0].threadId = 'missing-thread';

  const unknownThreadResult = bridge.validateRevisionSession(unknownThreadSession);
  assert.equal(unknownThreadResult.ok, false);
  assert.equal(unknownThreadResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.commentPlacements.0.threadId'
  )), true);

  const invalidKindSession = validSession();
  invalidKindSession.reviewGraph.decisionStates[0].itemKind = 'scene';

  const invalidKindResult = bridge.validateRevisionSession(invalidKindSession);
  assert.equal(invalidKindResult.ok, false);
  assert.equal(invalidKindResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.decisionStates.0.itemKind'
  )), true);

  const unknownItemSession = validSession();
  unknownItemSession.reviewGraph.decisionStates[0].itemId = 'missing-change';

  const unknownItemResult = bridge.validateRevisionSession(unknownItemSession);
  assert.equal(unknownItemResult.ok, false);
  assert.equal(unknownItemResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.decisionStates.0.itemId'
  )), true);
});

test('RB-02 constructors and validators are deterministic and do not mutate inputs', async () => {
  const bridge = await loadBridge();
  const session = validSession();
  const before = deepClone(session);

  const first = bridge.createRevisionSession(session);
  const second = bridge.createRevisionSession(session);
  const validation = bridge.validateRevisionSession(session);

  assert.deepEqual(first, second);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value, first);
  assert.deepEqual(session, before);
  assert.equal(first.createdAt, '2026-04-24T08:00:00.000Z');
  assert.equal(first.reviewGraph.commentThreads[0].createdAt, '2026-04-24T08:00:00.000Z');
  assert.equal(bridge.createRevisionSession({}).createdAt, '');
});

test('TextChange exact match and StructuralChange do not authorize auto apply', async () => {
  const bridge = await loadBridge();
  const textChange = bridge.createTextChange(validTextChange());
  assert.equal(textChange.match.kind, 'exact');
  assert.deepEqual(textChange.apply, {
    mode: 'manual',
    authorized: false,
    canApply: false,
  });

  const structuralChange = bridge.createStructuralChange(validStructuralChange());
  assert.equal(structuralChange.manualOnly, true);
  assert.equal(structuralChange.diagnosticsOnly, true);
  assert.equal(Object.prototype.hasOwnProperty.call(structuralChange, 'autoApply'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(structuralChange, 'canAutoApply'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(structuralChange, 'canApply'), false);

  const result = bridge.validateStructuralChange({
    ...validStructuralChange(),
    autoApply: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reasons.some((reason) => reason.field === 'structuralChange.autoApply'), true);
});

test('RB-02 preserves raw CRLF quote prefix suffix in CommentPlacement parity path', async () => {
  const bridge = await loadBridge();
  const placement = bridge.createCommentPlacement({
    ...validPlacement(),
    quote: '\r\nAlpha\r\n',
    prefix: '\r\n',
    suffix: '\r\n',
  });
  const textChange = bridge.createTextChange({
    ...validTextChange(),
    match: {
      kind: 'exact',
      quote: '\r\nAlpha\r\n',
      prefix: '\r\n',
      suffix: '\r\n',
    },
  });

  assert.equal(placement.quote, '\r\nAlpha\r\n');
  assert.equal(placement.prefix, '\r\n');
  assert.equal(placement.suffix, '\r\n');
  assert.equal(textChange.match.quote, '\r\nAlpha\r\n');
  assert.equal(textChange.match.prefix, '\r\n');
  assert.equal(textChange.match.suffix, '\r\n');
});

test('RB-01 apply safety remains blocked for exact resolved packets', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeApplySafety({
    schemaVersion: 'revision-bridge-p0.packet.v1',
    projectId: 'project-1',
    revisionSessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    decisionSet: {
      decisions: [
        {
          decisionId: 'decision-1',
          status: 'resolved',
          matchKind: 'exact',
          applyMode: 'manual',
        },
      ],
    },
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.canApply, false);
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_P0_APPLY_DISABLED'), true);
});

test('RB-02 kernel has no forbidden side-effect imports or APIs', () => {
  const text = fs.readFileSync(MODULE_PATH, 'utf8');
  const forbiddenPatterns = [
    /\bimport\b/u,
    /\brequire\s*\(/u,
    /\bfs\b/u,
    /\bchild_process\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\belectron\b/u,
    /\bipcMain\b/u,
    /\bipcRenderer\b/u,
    /\bDate\.now\s*\(/u,
    /\bnew\s+Date\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bcrypto\b/u,
    /\bsetTimeout\s*\(/u,
    /\bsetInterval\s*\(/u,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(text), false, `forbidden RB-02 pattern: ${pattern.source}`);
  }
});

test('RB-02 does not change dependency manifests from HEAD', () => {
  for (const filePath of ['package.json', 'package-lock.json']) {
    const headText = execFileSync('git', ['show', `HEAD:${filePath}`], { encoding: 'utf8' });
    const worktreeText = fs.readFileSync(filePath, 'utf8');
    assert.equal(worktreeText, headText, `${filePath} changed from HEAD`);
  }
});

test('RB-02 changed files stay inside the exact task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
});

test('RB-02 changed-file allowlist accepts clean and exact allowed paths only', () => {
  assert.deepEqual(changedFilesOutsideAllowlist([]), []);
  assert.deepEqual(changedFilesOutsideAllowlist([TEST_PATH]), []);
  assert.deepEqual(changedFilesOutsideAllowlist(ALLOWLIST), []);

  assert.deepEqual(
    changedFilesOutsideAllowlist([
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb02b-probe-unique.js',
    ]),
    [
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb02b-probe-unique.js',
    ],
  );
});

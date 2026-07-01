const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
}

function loadReviewSurfaceHelpers() {
  const source = read(['src', 'renderer', 'editor.js']);
  const startMarker = '// REVIEW_SURFACE_PRESENTATION_START';
  const endMarker = '// REVIEW_SURFACE_PRESENTATION_END';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  assert.notEqual(start, -1, 'review surface start marker must exist');
  assert.notEqual(end, -1, 'review surface end marker must exist');
  const snippet = `${source.slice(start, end + endMarker.length)}
this.__reviewSurfaceExports = {
  REVIEW_SURFACE_RECEIPT_SCHEMA,
  REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID,
  REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID,
  reviewSurfaceBuildExactTextApplyPayload,
  reviewSurfaceBuildExactTextApplyBatchPayload,
  reviewSurfaceNormalizeState,
  buildReviewSurfaceViewModel,
  renderReviewSurfaceMarkup,
};
`;
  const sandbox = {};
  vm.runInNewContext(snippet, sandbox, {
    filename: 'review-surface-ui.editor-snippet.js',
  });
  return sandbox.__reviewSurfaceExports;
}

function loadReviewSurfaceClickHarness(bridgeResult) {
  const source = read(['src', 'renderer', 'editor.js']);
  const presentationStart = source.indexOf('// REVIEW_SURFACE_PRESENTATION_START');
  const presentationEnd = source.indexOf('// REVIEW_SURFACE_PRESENTATION_END');
  const runtimeStart = source.indexOf('function setReviewSurfaceExactTextApplyTransientState');
  const runtimeEnd = source.indexOf('function initializeReviewSurface()', runtimeStart);
  assert.notEqual(presentationStart, -1, 'review surface presentation start marker must exist');
  assert.notEqual(presentationEnd, -1, 'review surface presentation end marker must exist');
  assert.ok(presentationEnd > presentationStart, 'review surface presentation markers must be ordered');
  assert.notEqual(runtimeStart, -1, 'review surface apply runtime start must exist');
  assert.ok(runtimeEnd > runtimeStart, 'review surface apply runtime block must be bounded');

  const snippet = `${source.slice(presentationStart, presentationEnd)}
let reviewSurfaceExactTextApplyTransientState = null;
let renderCount = 0;
const bridgeCalls = [];
const stateCalls = [];

class FakeElement extends Element {
  closest() {
    return null;
  }
}
class FakeHTMLElement extends HTMLElement {}
class FakeButton extends HTMLButtonElement {
  constructor(dataset, closestSelector) {
    super();
    this.dataset = dataset;
    this.closestSelector = closestSelector;
    this.disabled = false;
  }
  closest(selector) {
    return selector === this.closestSelector ? this : null;
  }
}

const fakeButton = new FakeButton({ changeId: 'change-1' }, '[data-review-apply-exact-change]');
const fakeBatchButton = new FakeButton(
  { changeIds: 'change-1,change-2' },
  '[data-review-apply-exact-batch]',
);
const reviewSurfaceHost = new FakeHTMLElement();
reviewSurfaceHost.contains = (node) => node === fakeButton || node === fakeBatchButton;
reviewSurfaceHost.addEventListener = () => {};

function renderReviewSurface() {
  renderCount += 1;
}
function setReviewSurfaceState(nextState = {}, options = {}) {
  stateCalls.push({ nextState, options });
  return nextState;
}
async function loadReviewSurfaceFromQuery() {
  stateCalls.push({ query: true });
  return {};
}
async function invokePreloadUiCommandBridge(commandId, payload) {
  bridgeCalls.push({ commandId, payload });
  return __bridgeResult;
}

${source.slice(runtimeStart, runtimeEnd)}

this.__reviewSurfaceClickHarness = {
  fakeButton,
  fakeBatchButton,
  bridgeCalls,
  stateCalls,
  getTransientState: () => reviewSurfaceExactTextApplyTransientState,
  getRenderCount: () => renderCount,
  click: () => handleReviewSurfaceExactTextApplyClick({ target: fakeButton }),
  clickBatch: () => handleReviewSurfaceExactTextApplyClick({ target: fakeBatchButton }),
};
`;
  const sandbox = {
    __bridgeResult: bridgeResult,
    Element: null,
    HTMLElement: null,
    HTMLButtonElement: null,
  };
  vm.runInNewContext(
    `class Element {}
class HTMLElement extends Element {}
class HTMLButtonElement extends HTMLElement {}
this.Element = Element;
this.HTMLElement = HTMLElement;
this.HTMLButtonElement = HTMLButtonElement;
${snippet}`,
    sandbox,
    { filename: 'review-surface-click-harness.editor-snippet.js' },
  );
  return sandbox.__reviewSurfaceClickHarness;
}

function createReviewSurfaceState() {
  return {
    revisionSession: {
      projectId: 'project-1',
      sessionId: 'session-1',
      baselineHash: 'baseline-1',
      status: 'open',
      reviewGraph: {
        textChanges: [
          {
            changeId: 'change-1',
            targetScope: { type: 'scene', id: 'scene-1' },
            match: { kind: 'exact', quote: 'beta' },
            replacementText: 'delta',
          },
        ],
        structuralChanges: [
          {
            structuralChangeId: 'structural-1',
            kind: 'moveBlock',
            summary: 'Move block.',
          },
        ],
        commentThreads: [
          {
            threadId: 'thread-1',
            messages: [{ body: 'Keep this orphan text visible.' }],
          },
        ],
        commentPlacements: [
          {
            placementId: 'placement-1',
            threadId: 'thread-1',
          },
        ],
        diagnosticItems: [],
        decisionStates: [],
      },
    },
    exactTextPlanPreview: {
      status: 'ready',
      plan: {
        projectId: 'project-1',
        sessionId: 'session-1',
        baselineHash: 'baseline-1',
        applyOps: [
          {
            opId: 'rbop-1',
            sceneId: 'scene-1',
            changeId: 'change-1',
            from: 6,
            to: 10,
            expectedText: 'beta',
            replacementText: 'delta',
          },
        ],
      },
      reasons: [],
    },
    structuralManualReviewPreview: {
      items: [
        {
          itemId: 'item-1',
          structuralChangeId: 'structural-1',
          structuralKind: 'moveBlock',
          summary: 'Move block.',
          manualOnlyReason: 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY',
          reasonCodes: ['REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY'],
        },
      ],
      unsupportedObservations: [
        {
          itemId: 'unsupported-1',
          structuralKind: 'copyBlock',
          reason: 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_UNSUPPORTED_KIND',
        },
      ],
      summary: {
        totalStructuralChanges: 1,
      },
    },
    commentSurvivalPreview: {
      totalThreads: 1,
      totalPlacements: 1,
      preservedThreads: [
        {
          threadId: 'thread-1',
          messages: [{ body: 'Keep this orphan text visible.' }],
        },
      ],
      placementResults: [
        {
          placementId: 'placement-1',
          threadId: 'thread-1',
          status: 'unplaced',
          evaluation: {
            reasonCodes: ['REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'],
          },
        },
      ],
      diagnostics: [],
    },
  };
}

function createReadyExactOnlyReviewSurfaceState() {
  const state = createReviewSurfaceState();
  state.revisionSession.reviewGraph.structuralChanges = [];
  state.revisionSession.reviewGraph.commentThreads = [];
  state.revisionSession.reviewGraph.commentPlacements = [];
  state.structuralManualReviewPreview = {
    items: [],
    unsupportedObservations: [],
    summary: {
      totalStructuralChanges: 0,
    },
  };
  state.commentSurvivalPreview = {
    totalThreads: 0,
    totalPlacements: 0,
    preservedThreads: [],
    placementResults: [],
    diagnostics: [],
  };
  return state;
}

function createValidReviewSurfaceReceipt(schemaVersion) {
  return {
    schemaVersion,
    projectId: 'project-1',
    sessionId: 'session-1',
    sceneId: 'scene-1',
    changeId: 'change-1',
    baselineHashBefore: 'baseline-1',
    operationKind: 'replaceExactText',
    writeStatus: 'applied',
    backupId: '1700000000000',
    writtenAt: '2023-11-14T22:13:20.000Z',
    transactionId: 'tx_123',
    inputHash: 'a'.repeat(64),
    outputHash: 'b'.repeat(64),
    bytesWritten: 18,
    reason: 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_APPLIED',
    recovery: {
      snapshotCreated: true,
      snapshotReadable: true,
      snapshotHashMatchesInput: true,
      snapshotPath: 'scene-1.recovery.bak.1700000000000',
      recoveryAction: 'OPEN_SNAPSHOT_OR_ABORT',
    },
  };
}

function createCanonicalAdapterPayload() {
  const reviewPacket = {
    textChanges: [
      {
        changeId: 'change-1',
        targetScope: { type: 'scene', id: 'scene-1' },
        match: { kind: 'exact', quote: 'beta' },
        replacementText: 'delta',
      },
    ],
    structuralChanges: [
      {
        structuralChangeId: 'structural-1',
        kind: 'moveBlock',
        summary: 'Move block.',
        manualOnlyReason: 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY',
        reasonCodes: ['REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY'],
      },
    ],
    commentThreads: [
      {
        threadId: 'thread-1',
        messages: [{ body: 'Keep this orphan text visible.' }],
      },
    ],
    commentPlacements: [
      {
        placementId: 'placement-1',
        threadId: 'thread-1',
        status: 'unplaced',
        evaluation: {
          reasonCodes: ['REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'],
        },
      },
    ],
    diagnosticItems: [],
    decisionStates: [],
  };

  return {
    reviewPacket,
    previewInput: {
      projectId: 'project-1',
      sessionId: 'session-1',
      baselineHash: 'baseline-1',
      reviewPacket,
    },
    revisionBridgePreviewResult: {
      session: {
        projectId: 'project-1',
        sessionId: 'session-1',
        baselineHash: 'baseline-1',
        status: 'preview',
        reviewGraph: reviewPacket,
      },
    },
    structuralManualReviewPreview: {
      items: [
        {
          itemId: 'item-1',
          structuralChangeId: 'structural-1',
          structuralKind: 'moveBlock',
          summary: 'Move block.',
          manualOnlyReason: 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY',
          reasonCodes: ['REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY'],
        },
      ],
      unsupportedObservations: [],
      summary: {
        totalStructuralChanges: 1,
      },
    },
  };
}

test('review surface ui: comments rail keeps bounded review host and removes demo comment cards', () => {
  const html = read(['src', 'renderer', 'index.html']);

  assert.ok(html.includes('data-right-tab="inspector"'));
  assert.ok(html.includes('data-right-tab="comments"'));
  assert.ok(html.includes('data-right-tab="history"'));
  assert.ok(html.includes('data-review-surface-host'));
  assert.equal(html.includes('right-rail-comment-card'), false);
  assert.equal(html.includes('data-comments-placeholder'), false);
});

test('review surface ui: comments tab routes through review command instead of direct bypass', () => {
  const source = read(['src', 'renderer', 'editor.js']);

  assert.ok(source.includes("if (tab === 'comments') {"));
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS);'));
  assert.equal(source.includes('__setYalkenReviewSurfaceState'), false);
  assert.equal(source.includes('__getYalkenReviewSurfaceState'), false);
  assert.equal(source.includes('__YALKEN_REVIEW_SURFACE_STATE__'), false);
  assert.equal(source.includes("if (tab === 'inspector' || tab === 'comments' || tab === 'history') {\n      applyRightTab(tab);"), false);
});

test('review surface ui: canonical adapter payload populates review surface from existing kernel output only', () => {
  const helpers = loadReviewSurfaceHelpers();
  const viewModel = helpers.buildReviewSurfaceViewModel(createCanonicalAdapterPayload());
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.status, 'ready');
  assert.equal(viewModel.importSummary.projectId, 'project-1');
  assert.equal(viewModel.importSummary.sessionId, 'session-1');
  assert.equal(viewModel.importSummary.baselineHash, 'baseline-1');
  assert.equal(viewModel.importSummary.sessionStatus, 'preview');
  assert.equal(viewModel.reviewItems[0].title, 'Текстовая правка change-1');
  assert.equal(viewModel.manualOnlyReasons.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_MOVE_MANUAL_ONLY'), true);
  assert.equal(viewModel.orphanComments[0].body, 'Keep this orphan text visible.');
  assert.equal(viewModel.orphanComments[0].reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'), true);
  assert.equal(viewModel.exactTextPreview.state, 'empty');
  assert.equal(viewModel.receipt, null);
  assert.ok(markup.includes('Keep this orphan text visible.'));
  assert.ok(markup.includes('Только вручную'));
  assert.ok(markup.includes('Текстовая правка change-1'));
  assert.ok(markup.includes('Структура moveBlock'));
  assert.ok(markup.includes('Нет точного текстового предпросмотра.'));
});

test('review surface ui: unsupported observations still render only from explicit preview payload', () => {
  const helpers = loadReviewSurfaceHelpers();
  const viewModel = helpers.buildReviewSurfaceViewModel(createReviewSurfaceState());
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.unsupportedObservations[0].reason, 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_UNSUPPORTED_KIND');
  assert.ok(markup.includes('Только чтение'));
  assert.ok(markup.includes('Безопасная проверка'));
  assert.ok(markup.includes('Запись в проект идет только через подтвержденный путь.'));
});

test('review surface ui: canonical adapter payload preserves unsupported observations from explicit structural preview', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createCanonicalAdapterPayload();
  state.structuralManualReviewPreview = {
    items: [],
    unsupportedObservations: [
      {
        itemId: 'unsupported-1',
        structuralKind: 'copyBlock',
        reason: 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_UNSUPPORTED_KIND',
      },
    ],
    summary: {
      totalStructuralChanges: 1,
    },
  };

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.reviewItems.length > 0 && viewModel.reviewItems[0].title === 'Структура copyBlock', false);
  assert.equal(viewModel.unsupportedObservations[0].reason, 'REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_UNSUPPORTED_KIND');
  assert.ok(markup.includes('Только чтение'));
  assert.ok(markup.includes('REVISION_BRIDGE_STRUCTURAL_MANUAL_REVIEW_UNSUPPORTED_KIND'));
});

test('review surface ui: exact-text preview and receipt render only when supported by existing schema', () => {
  const helpers = loadReviewSurfaceHelpers();
  const validState = createReviewSurfaceState();
  validState.receipt = createValidReviewSurfaceReceipt(helpers.REVIEW_SURFACE_RECEIPT_SCHEMA);

  const validViewModel = helpers.buildReviewSurfaceViewModel(validState);
  const validMarkup = helpers.renderReviewSurfaceMarkup(validViewModel);
  assert.equal(validViewModel.receipt.baselineHashBefore, 'baseline-1');
  assert.equal(validViewModel.receipt.operationKind, 'replaceExactText');
  assert.equal(validViewModel.receipt.writeStatus, 'applied');
  assert.equal(validViewModel.receipt.backupId, '1700000000000');
  assert.equal(validViewModel.receipt.writtenAt, '2023-11-14T22:13:20.000Z');
  assert.equal(validViewModel.exactTextPreview.ops[0].applyState, 'applied');
  assert.ok(validMarkup.includes('data-review-apply-exact-change'));
  assert.ok(validMarkup.includes('disabled aria-disabled="true"'));
  assert.ok(validMarkup.includes('&quot;beta&quot; -&gt; &quot;delta&quot;'));
  assert.ok(validMarkup.includes('baseline-1'));
  assert.ok(validMarkup.includes('replaceExactText'));
  assert.ok(validMarkup.includes('применено'));
  assert.ok(validMarkup.includes('1700000000000'));
  assert.ok(validMarkup.includes('2023-11-14T22:13:20.000Z'));
  assert.ok(validMarkup.includes('tx_123'));

  const blockedState = createReviewSurfaceState();
  blockedState.exactTextPlanPreview = {
    status: 'blocked',
    reasons: [{ code: 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_DUPLICATE_MATCH' }],
    plan: { applyOps: [] },
  };
  blockedState.receipt = {
    schemaVersion: helpers.REVIEW_SURFACE_RECEIPT_SCHEMA,
    projectId: 'project-1',
    sessionId: 'session-1',
    sceneId: 'scene-1',
    changeId: 'change-1',
    baselineHashBefore: 'baseline-1',
    operationKind: 'rewriteEverything',
    writeStatus: 'applied',
    backupId: 'not-a-real-backup-id',
    writtenAt: 'not-iso',
    transactionId: 'tx_invalid',
    inputHash: 'a'.repeat(64),
    outputHash: 'b'.repeat(64),
    recovery: {
      snapshotCreated: true,
      snapshotReadable: true,
      snapshotHashMatchesInput: true,
      snapshotPath: 'scene-1.recovery.bak.1700000000001',
      recoveryAction: 'OPEN_SNAPSHOT_OR_ABORT',
    },
  };
  const blockedViewModel = helpers.buildReviewSurfaceViewModel(blockedState);
  const blockedMarkup = helpers.renderReviewSurfaceMarkup(blockedViewModel);
  assert.equal(blockedViewModel.receipt, null);
  assert.ok(blockedMarkup.includes('Предпросмотр заблокирован'));
  assert.equal(blockedMarkup.includes('data-review-apply-exact-change'), false);
  assert.ok(blockedMarkup.includes('REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_DUPLICATE_MATCH'));
  assert.equal(blockedMarkup.includes('tx_invalid'), false);
});

test('review surface ui: ready exact-text preview exposes one visible apply action without authority payload', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReadyExactOnlyReviewSurfaceState();
  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(helpers.REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID, 'cmd.project.review.applyExactTextChange');
  assert.equal(viewModel.exactTextPreview.state, 'ready');
  assert.equal(viewModel.exactTextPreview.ops.length, 1);
  assert.equal(viewModel.exactTextPreview.ops[0].applyState, 'ready');
  assert.equal(viewModel.exactTextPreview.ops[0].applyLabel, 'Применить');
  assert.equal(viewModel.exactTextPreview.ops[0].applyDisabled, false);
  assert.ok(markup.includes('data-review-apply-exact-change'));
  assert.ok(markup.includes('data-change-id="change-1"'));
  assert.ok(markup.includes('>Применить</button>'));
  assert.equal(markup.includes('disabled aria-disabled="true"'), false);

  assert.equal(
    JSON.stringify(helpers.reviewSurfaceBuildExactTextApplyPayload('request-1', 'change-1')),
    JSON.stringify({ requestId: 'request-1', changeId: 'change-1' }),
  );
  assert.equal(
    JSON.stringify(helpers.reviewSurfaceBuildExactTextApplyPayload('', 'change-1')),
    JSON.stringify({ changeId: 'change-1' }),
  );
});

test('review surface ui: applied exact-text preview disables repeat apply from main receipt evidence', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReadyExactOnlyReviewSurfaceState();
  state.receipt = createValidReviewSurfaceReceipt(helpers.REVIEW_SURFACE_RECEIPT_SCHEMA);

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.exactTextPreview.ops.length, 1);
  assert.equal(viewModel.exactTextPreview.ops[0].applyState, 'applied');
  assert.equal(viewModel.exactTextPreview.ops[0].applyLabel, 'применено');
  assert.equal(viewModel.exactTextPreview.ops[0].applyDisabled, true);
  assert.ok(markup.includes('>применено</button>'));
  assert.ok(markup.includes('disabled aria-disabled="true"'));
});

test('review surface ui: batch applied evidence disables all matching exact ops', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReadyExactOnlyReviewSurfaceState();
  state.exactTextPlanPreview.plan.applyOps.push({
    opId: 'rbop-2',
    sceneId: 'scene-1',
    changeId: 'change-2',
    from: 11,
    to: 15,
    expectedText: 'more',
    replacementText: 'less',
  });
  state.exactTextBatchApplyResult = {
    status: 'applied',
    applied: true,
    changes: [
      { changeId: 'change-1', status: 'applied' },
      { changeId: 'change-2', status: 'applied' },
    ],
  };

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.exactTextPreview.ops.length, 2);
  assert.equal(viewModel.exactTextPreview.ops.every((op) => op.applyState === 'applied'), true);
  assert.equal(viewModel.exactTextPreview.batchAction.applyState, 'applied');
  assert.equal(viewModel.exactTextPreview.batchAction.applyDisabled, true);
  assert.equal((markup.match(/>применено<\/button>/g) || []).length, 3);
});

test('review surface ui: non-single exact preview renders controlled batch action without per-op enablement', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReadyExactOnlyReviewSurfaceState();
  state.exactTextPlanPreview.plan.applyOps.push({
    opId: 'rbop-2',
    sceneId: 'scene-1',
    changeId: 'change-2',
    from: 11,
    to: 15,
    expectedText: 'more',
    replacementText: 'less',
  });

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(helpers.REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID, 'cmd.project.review.applyExactTextChangesBatch');
  assert.equal(viewModel.exactTextPreview.ops.length, 2);
  assert.equal(viewModel.exactTextPreview.ops.every((op) => op.applyState === 'blocked'), true);
  assert.equal(viewModel.exactTextPreview.batchAction.applyState, 'ready');
  assert.equal(viewModel.exactTextPreview.batchAction.applyDisabled, false);
  assert.equal(
    JSON.stringify(viewModel.exactTextPreview.batchAction.changeIds),
    JSON.stringify(['change-1', 'change-2']),
  );
  assert.ok(markup.includes('REVIEW_SURFACE_SINGLE_EXACT_CHANGE_REQUIRED'));
  assert.ok(markup.includes('data-review-apply-exact-batch'));
  assert.ok(markup.includes('data-change-ids="change-1,change-2"'));
  assert.ok(markup.includes('>Применить все</button>'));
  assert.equal((markup.match(/data-review-apply-exact-change/g) || []).length, 2);
  assert.equal((markup.match(/disabled aria-disabled="true"/g) || []).length, 2);
  assert.equal(
    JSON.stringify(helpers.reviewSurfaceBuildExactTextApplyBatchPayload('request-1', ['change-1', 'change-2'])),
    JSON.stringify({ requestId: 'request-1', changeIds: ['change-1', 'change-2'] }),
  );
});

test('review surface ui: exact apply requires a named change id before enabling action', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReadyExactOnlyReviewSurfaceState();
  state.exactTextPlanPreview.plan.applyOps[0].changeId = '';

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.exactTextPreview.ops.length, 1);
  assert.equal(viewModel.exactTextPreview.ops[0].applyState, 'blocked');
  assert.equal(viewModel.exactTextPreview.ops[0].applyDisabled, true);
  assert.ok(markup.includes('REVIEW_SURFACE_EXACT_CHANGE_ID_REQUIRED'));
  assert.ok(markup.includes('disabled aria-disabled="true"'));
});

test('review surface ui: mixed structural review blocks visible exact apply before main write path', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReviewSurfaceState();

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.exactTextPreview.ops.length, 1);
  assert.equal(viewModel.exactTextPreview.ops[0].applyState, 'blocked');
  assert.equal(viewModel.exactTextPreview.ops[0].applyDisabled, true);
  assert.ok(markup.includes('REVIEW_SURFACE_STRUCTURAL_REVIEW_BLOCKS_EXACT_APPLY'));
  assert.ok(markup.includes('disabled aria-disabled="true"'));
});

test('review surface ui: mixed comment review blocks controlled batch action before main write path', () => {
  const helpers = loadReviewSurfaceHelpers();
  const state = createReadyExactOnlyReviewSurfaceState();
  state.revisionSession.reviewGraph.commentThreads = [
    {
      threadId: 'thread-1',
      messages: [{ body: 'Keep comment visible.' }],
    },
  ];
  state.commentSurvivalPreview = {
    totalThreads: 1,
    totalPlacements: 0,
    preservedThreads: [
      {
        threadId: 'thread-1',
        messages: [{ body: 'Keep comment visible.' }],
      },
    ],
    placementResults: [],
    diagnostics: [],
  };
  state.exactTextPlanPreview.plan.applyOps.push({
    opId: 'rbop-2',
    sceneId: 'scene-1',
    changeId: 'change-2',
    from: 11,
    to: 15,
    expectedText: 'more',
    replacementText: 'less',
  });

  const viewModel = helpers.buildReviewSurfaceViewModel(state);
  const markup = helpers.renderReviewSurfaceMarkup(viewModel);

  assert.equal(viewModel.exactTextPreview.batchAction.applyState, 'blocked');
  assert.equal(viewModel.exactTextPreview.batchAction.applyDisabled, true);
  assert.equal(
    viewModel.exactTextPreview.batchAction.applyReason,
    'REVIEW_SURFACE_COMMENT_REVIEW_BLOCKS_EXACT_BATCH_APPLY',
  );
  assert.ok(markup.includes('data-review-apply-exact-batch'));
  assert.ok(markup.includes('REVIEW_SURFACE_COMMENT_REVIEW_BLOCKS_EXACT_BATCH_APPLY'));
  assert.equal((markup.match(/disabled aria-disabled="true"/g) || []).length, 3);
});

test('review surface ui: exact apply click sends intent-only payload and adopts main review surface', async () => {
  const harness = loadReviewSurfaceClickHarness({
    ok: true,
    value: {
      ok: true,
      applied: true,
      reviewSurface: {
        receipt: {
          changeId: 'change-1',
          writeStatus: 'applied',
        },
      },
    },
  });

  await harness.click();

  assert.equal(harness.bridgeCalls.length, 1);
  assert.equal(harness.bridgeCalls[0].commandId, 'cmd.project.review.applyExactTextChange');
  assert.equal(
    JSON.stringify(Object.keys(harness.bridgeCalls[0].payload).sort()),
    JSON.stringify(['changeId', 'requestId']),
  );
  assert.equal(harness.bridgeCalls[0].payload.changeId, 'change-1');
  assert.equal(harness.bridgeCalls[0].payload.requestId.startsWith('review-exact-apply-change-1-'), true);
  assert.equal(harness.getTransientState(), null);
  assert.equal(harness.stateCalls.length, 1);
  assert.equal(harness.stateCalls[0].nextState.receipt.changeId, 'change-1');
  assert.equal(harness.stateCalls[0].nextState.receipt.writeStatus, 'applied');
});

test('review surface ui: batch exact apply click sends intent-only ids and adopts main review surface', async () => {
  const harness = loadReviewSurfaceClickHarness({
    ok: true,
    value: {
      ok: true,
      batch: true,
      applied: true,
      reviewSurface: {
        exactTextAppliedChangeIds: ['change-1', 'change-2'],
        exactTextBatchApplyResult: {
          status: 'applied',
          applied: true,
          changes: [
            { changeId: 'change-1', status: 'applied' },
            { changeId: 'change-2', status: 'applied' },
          ],
        },
      },
    },
  });

  await harness.clickBatch();

  assert.equal(harness.bridgeCalls.length, 1);
  assert.equal(harness.bridgeCalls[0].commandId, 'cmd.project.review.applyExactTextChangesBatch');
  assert.equal(
    JSON.stringify(Object.keys(harness.bridgeCalls[0].payload).sort()),
    JSON.stringify(['changeIds', 'requestId']),
  );
  assert.equal(
    JSON.stringify(harness.bridgeCalls[0].payload.changeIds),
    JSON.stringify(['change-1', 'change-2']),
  );
  assert.equal(harness.bridgeCalls[0].payload.requestId.startsWith('review-exact-batch-apply-change-1-change-2-'), true);
  assert.equal(harness.getTransientState(), null);
  assert.equal(harness.stateCalls.length, 1);
  assert.deepEqual(harness.stateCalls[0].nextState.exactTextAppliedChangeIds, ['change-1', 'change-2']);
  assert.equal(harness.stateCalls[0].nextState.exactTextBatchApplyResult.applied, true);
});

test('review surface ui: disabled applied button does not send repeat apply command', async () => {
  const harness = loadReviewSurfaceClickHarness({
    ok: false,
    value: {
      ok: false,
      error: {
        reason: 'REVIEW_EXACT_TEXT_APPLY_ALREADY_APPLIED',
      },
    },
  });
  harness.fakeButton.disabled = true;

  await harness.click();

  assert.equal(harness.bridgeCalls.length, 0);
  assert.equal(harness.stateCalls.length, 0);
  assert.equal(harness.getTransientState(), null);
});

test('review surface ui: exact apply click failure stays local and does not invent receipt truth', async () => {
  const harness = loadReviewSurfaceClickHarness({
    ok: false,
    reason: 'COMMAND_EXECUTION_FAILED',
    value: {
      ok: false,
      error: {
        reason: 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED',
      },
    },
  });

  await harness.click();

  assert.equal(harness.bridgeCalls.length, 1);
  assert.equal(harness.stateCalls.length, 0);
  assert.equal(harness.getTransientState().state, 'blocked');
  assert.equal(harness.getTransientState().changeId, 'change-1');
  assert.equal(harness.getTransientState().reason, 'REVIEW_EXACT_TEXT_APPLY_DIRTY_EDITOR_BLOCKED');
  assert.equal(harness.getRenderCount() >= 2, true);
});

test('review surface ui: stale no-match exact apply response is blocked instead of transient failed', async () => {
  const harness = loadReviewSurfaceClickHarness({
    ok: false,
    value: {
      ok: false,
      error: {
        reason: 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_MATCH',
      },
    },
  });

  await harness.click();

  assert.equal(harness.bridgeCalls.length, 1);
  assert.equal(harness.stateCalls.length, 0);
  assert.equal(harness.getTransientState().state, 'blocked');
  assert.equal(harness.getTransientState().reason, 'REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_MATCH');
});

test('review surface ui: transient exact apply failure remains failed instead of blocked', async () => {
  const harness = loadReviewSurfaceClickHarness({
    ok: false,
    value: {
      ok: false,
      error: {
        reason: 'REVIEW_SURFACE_TRANSPORT_TIMEOUT',
      },
    },
  });

  await harness.click();

  assert.equal(harness.bridgeCalls.length, 1);
  assert.equal(harness.stateCalls.length, 0);
  assert.equal(harness.getTransientState().state, 'failed');
  assert.equal(harness.getTransientState().reason, 'REVIEW_SURFACE_TRANSPORT_TIMEOUT');
});

test('review surface ui: empty and error states stay deterministic', () => {
  const helpers = loadReviewSurfaceHelpers();
  const first = helpers.buildReviewSurfaceViewModel({});
  const second = helpers.buildReviewSurfaceViewModel({});
  const emptyMarkup = helpers.renderReviewSurfaceMarkup(first);
  const errorMarkup = helpers.renderReviewSurfaceMarkup(helpers.buildReviewSurfaceViewModel({
    ok: false,
    code: 'REVIEW_SURFACE_REJECTED',
    detail: 'Rejected payload.',
  }));

  assert.deepEqual(first, second);
  assert.equal(first.status, 'empty');
  assert.ok(emptyMarkup.includes('Нет импортированных элементов проверки.'));
  assert.ok(emptyMarkup.includes('Нет точного текстового предпросмотра.'));
  assert.ok(errorMarkup.includes('Поверхность проверки недоступна'));
  assert.ok(errorMarkup.includes('Rejected payload.'));
  assert.ok(errorMarkup.includes('REVIEW_SURFACE_REJECTED'));
});

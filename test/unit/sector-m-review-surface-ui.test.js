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
  assert.ok(markup.includes('Только показ'));
  assert.ok(markup.includes('Записи в проект мимо безопасного пути здесь нет.'));
});

test('review surface ui: exact-text preview and receipt render only when supported by existing schema', () => {
  const helpers = loadReviewSurfaceHelpers();
  const validState = createReviewSurfaceState();
  validState.receipt = {
    schemaVersion: helpers.REVIEW_SURFACE_RECEIPT_SCHEMA,
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

  const validViewModel = helpers.buildReviewSurfaceViewModel(validState);
  const validMarkup = helpers.renderReviewSurfaceMarkup(validViewModel);
  assert.equal(validViewModel.receipt.baselineHashBefore, 'baseline-1');
  assert.equal(validViewModel.receipt.operationKind, 'replaceExactText');
  assert.equal(validViewModel.receipt.writeStatus, 'applied');
  assert.equal(validViewModel.receipt.backupId, '1700000000000');
  assert.equal(validViewModel.receipt.writtenAt, '2023-11-14T22:13:20.000Z');
  assert.ok(validMarkup.includes('Только просмотр'));
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
  assert.equal(blockedMarkup.includes('Только просмотр'), false);
  assert.ok(blockedMarkup.includes('REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_DUPLICATE_MATCH'));
  assert.equal(blockedMarkup.includes('tx_invalid'), false);
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

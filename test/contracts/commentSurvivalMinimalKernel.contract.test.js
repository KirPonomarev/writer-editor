const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'commentSurvivalMinimalKernel.mjs';
const TASK_BASENAME = 'STAGE_04_COMMENT_SURVIVAL_MINIMAL_KERNEL_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [
    MODULE_BASENAME,
    'commentSurvivalMinimalKernel.contract.test.js',
    TASK_BASENAME,
  ];
}

function baseSourceViewState() {
  return {
    revisionToken: 'rev-100',
    viewMode: 'GOOGLE_DOC_VIEW',
    normalizationPolicy: 'TEXT_V1',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
    artifactCompletenessClass: 'TEXT_ONLY',
  };
}

function placedThread(id = 'c-1') {
  return {
    threadId: `t-${id}`,
    commentId: id,
    content: `content-${id}`,
    authorHandle: `author-${id}`,
    createdAtUTC: '2026-05-03T10:00:00Z',
    threadMetadataStatus: 'OK',
    placement: {
      placementStatus: 'SUPPORTED',
      selectorKind: 'TEXT_QUOTE',
      selectorEvidence: { exactText: `content-${id}` },
      ambiguityReason: '',
      sourceState: baseSourceViewState(),
      anchorId: `anchor-${id}`,
      provider: 'LOCAL',
    },
  };
}

test('stage04 kernel deterministic compile with planned models and hash bound ledger sourceViewState', async () => {
  const { compileCommentSurvivalMinimalKernel } = await loadModule();
  const input = {
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: baseSourceViewState(),
    commentThreads: [placedThread('c-ok')],
  };
  const first = compileCommentSurvivalMinimalKernel(input);
  const second = compileCommentSurvivalMinimalKernel(input);

  assert.deepEqual(first, second);
  assert.equal(first.outputDecision, 'COMMENT_SURVIVAL_COMPILED');
  assert.equal(first.autoApplyCount, 0);
  assert.equal(first.ledger.ledgerKind, 'CommentEscrowLedger');
  assert.equal(first.ledger.contourId, 'STAGE_04_COMMENT_SURVIVAL_MINIMAL_KERNEL_001');
  assert.equal(first.ledger.commentCount, 1);
  assert.equal(first.ledger.placedCount, 1);
  assert.equal(first.ledger.orphanCount, 0);
  assert.equal(first.ledger.anomalyCount, 0);
  assert.equal(first.ledger.commentRecordHashes.length, 1);
  assert.equal(first.ledger.sourceViewStateHash, first.sourceViewState ? first.ledger.sourceViewStateHash : '');

  const thread = first.commentThreads[0];
  assert.equal(thread.threadId, 't-c-ok');
  assert.equal(thread.commentId, 'c-ok');
  assert.equal(thread.authorHandle, 'author-c-ok');
  assert.equal(thread.createdAtUTC, '2026-05-03T10:00:00Z');
  assert.equal(thread.threadMetadataStatus, 'OK');
  assert.equal(thread.content, 'content-c-ok');
});

test('stage04 kernel orphans placement failures and preserves text metadata placement attempt source state', async () => {
  const {
    compileCommentSurvivalMinimalKernel,
    COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES,
  } = await loadModule();

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: baseSourceViewState(),
    commentThreads: [
      {
        threadId: 't-lost',
        commentId: 'c-lost',
        content: 'lost text must survive',
        authorHandle: 'author-lost',
        createdAtUTC: '2026-05-03T11:11:11Z',
        resolvedDone: true,
        placement: {
          placementStatus: 'LOST',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'lost text must survive' },
          ambiguityReason: '',
          sourceState: baseSourceViewState(),
        },
        replies: [
          {
            commentId: 'c-lost-r1',
            content: 'reply survives as orphan too',
            authorHandle: 'author-reply',
            createdAtUTC: '2026-05-03T11:12:12Z',
            resolvedDone: true,
          },
        ],
      },
      {
        threadId: 't-word',
        commentId: 'c-word',
        content: 'word anchor missing orphan',
        placement: {
          placementStatus: 'SUPPORTED',
          selectorKind: 'WORD',
          selectorEvidence: { exactText: 'word' },
          ambiguityReason: '',
          sourceState: baseSourceViewState(),
          anchorId: '',
        },
      },
      {
        threadId: 't-google',
        commentId: 'c-google',
        content: 'google mismatch',
        placement: {
          placementStatus: 'SUPPORTED',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'google mismatch' },
          ambiguityReason: '',
          sourceState: baseSourceViewState(),
          provider: 'GOOGLE',
          expectedRevisionToken: 'r-2',
          revisionToken: 'r-1',
        },
      },
      {
        threadId: 't-pos-del',
        commentId: 'c-pos-del',
        content: 'position deleted',
        placement: {
          placementStatus: 'POSITION_DELETED',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'position deleted' },
          sourceState: baseSourceViewState(),
        },
      },
      {
        threadId: '',
        commentId: '',
        content: 'missing metadata',
        placement: {
          placementStatus: 'SUPPORTED',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'missing metadata' },
          sourceState: baseSourceViewState(),
        },
      },
    ],
  });

  assert.equal(result.outputDecision, 'COMMENT_SURVIVAL_BLOCKED');
  assert.equal(result.orphanComments.some((item) => item.commentId === 'c-lost'), true);
  assert.equal(result.orphanComments.some((item) => item.commentId === 'c-lost-r1'), true);
  assert.equal(result.orphanComments.some((item) => item.commentId === 'c-word'), true);
  assert.equal(result.orphanComments.some((item) => item.commentId === 'c-google'), true);
  assert.equal(result.orphanComments.some((item) => item.commentId === 'c-pos-del'), true);
  assert.equal(
    result.blockedReasons.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.GOOGLE_REVISION_MISMATCH_ORPHANED),
    true,
  );

  const orphan = result.orphanComments.find((item) => item.commentId === 'c-lost');
  assert.equal(orphan.commentText, 'lost text must survive');
  assert.equal(orphan.content, 'lost text must survive');
  assert.equal(orphan.authorHandle, 'author-lost');
  assert.equal(orphan.createdAtUTC, '2026-05-03T11:11:11Z');
  assert.equal(orphan.resolvedDone, true);
  assert.equal(orphan.originalPlacementAttempt.placementStatus, 'LOST');
  assert.equal(orphan.threadMetadata.authorHandle, 'author-lost');
  assert.equal(orphan.threadMetadata.createdAtUTC, '2026-05-03T11:11:11Z');
  assert.equal(orphan.threadMetadata.resolvedDone, true);
  assert.equal(orphan.sourceViewState.revisionToken, 'rev-100');
  assert.equal(result.ledger.orphanCount >= 5, true);
  assert.equal(result.ledger.anomalyCount >= 1, true);
});

test('stage04 kernel duplicate ids become anomalies without dropping comments', async () => {
  const {
    compileCommentSurvivalMinimalKernel,
    COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES,
  } = await loadModule();

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: baseSourceViewState(),
    commentThreads: [
      placedThread('dup'),
      { ...placedThread('dup2'), commentId: 'dup', threadId: 't-dup-second', content: 'dup second survives' },
    ],
  });

  assert.equal(result.commentThreads.length, 2);
  assert.equal(result.ledger.commentCount, 2);
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.DUPLICATE_COMMENT_ID_LEDGER_ANOMALY,
    ),
    true,
  );
});

test('stage04 kernel duplicate reply id becomes ledger anomaly without dropping reply', async () => {
  const {
    compileCommentSurvivalMinimalKernel,
    COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES,
  } = await loadModule();

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: baseSourceViewState(),
    commentThreads: [
      placedThread('dup-shared'),
      {
        ...placedThread('reply-host'),
        replies: [
          {
            threadId: 't-reply-host',
            commentId: 'dup-shared',
            content: 'reply duplicate id survives',
            authorHandle: 'reply-author',
            createdAtUTC: '2026-05-03T10:10:10Z',
          },
        ],
      },
    ],
  });

  assert.equal(result.ledger.commentCount, 3);
  assert.equal(result.commentThreads.some((item) => item.content === 'reply duplicate id survives'), true);
  assert.equal(result.ledger.anomalyCount > 0, true);
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.DUPLICATE_COMMENT_ID_LEDGER_ANOMALY,
    ),
    true,
  );
});

test('stage04 kernel reply missing metadata becomes anomaly without silent drop when parent placement succeeds', async () => {
  const {
    compileCommentSurvivalMinimalKernel,
    COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES,
  } = await loadModule();

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: baseSourceViewState(),
    commentThreads: [
      {
        ...placedThread('meta-parent'),
        replies: [
          {
            threadId: '',
            commentId: '',
            content: 'reply with missing metadata survives',
          },
        ],
      },
    ],
  });

  assert.equal(result.ledger.commentCount, 2);
  assert.equal(result.commentThreads.some((item) => item.content === 'reply with missing metadata survives'), true);
  assert.equal(result.ledger.anomalyCount > 0, true);
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.THREAD_METADATA_MISSING_ORPHANED,
    ),
    true,
  );
});

test('stage04 kernel preserves raw placement sourceState in orphan original placement attempt', async () => {
  const { compileCommentSurvivalMinimalKernel } = await loadModule();

  const globalSourceViewState = baseSourceViewState();
  const placementSourceState = {
    revisionToken: 'raw-placement-rev',
    viewMode: 'RAW_PLACEMENT_VIEW',
    normalizationPolicy: 'TEXT_V1',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
    artifactCompletenessClass: 'TEXT_ONLY',
  };

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: globalSourceViewState,
    commentThreads: [
      {
        threadId: 't-raw-placement',
        commentId: 'c-raw-placement',
        content: 'raw placement source state survives',
        placement: {
          placementStatus: 'LOST',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'raw placement source state survives' },
          sourceState: placementSourceState,
        },
      },
    ],
  });

  const orphan = result.orphanComments.find((item) => item.commentId === 'c-raw-placement');
  assert.equal(orphan.sourceViewState.revisionToken, 'rev-100');
  assert.equal(orphan.originalPlacementAttempt.sourceState.revisionToken, 'raw-placement-rev');
});

test('stage04 kernel structural and non inline suggestions are manual only with zero auto apply', async () => {
  const {
    compileCommentSurvivalMinimalKernel,
    COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES,
  } = await loadModule();

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    sourceViewState: baseSourceViewState(),
    commentThreads: [
      {
        ...placedThread('g-block'),
        suggestion: { provider: 'GOOGLE', kind: 'BLOCK' },
      },
      {
        ...placedThread('g-move'),
        suggestion: { provider: 'GOOGLE', kind: 'MOVE', pairing: 'BROKEN', structural: true },
      },
    ],
  });

  assert.equal(result.outputDecision, 'COMMENT_SURVIVAL_COMPILED');
  assert.equal(result.autoApplyCount, 0);
  assert.equal(
    result.manualOnlyReasonCodes.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.NON_INLINE_GOOGLE_SUGGESTION_MANUAL_ONLY),
    true,
  );
  assert.equal(
    result.manualOnlyReasonCodes.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.BROKEN_MOVE_PAIRING_MANUAL_ONLY),
    true,
  );
  assert.equal(
    result.manualOnlyReasonCodes.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.STRUCTURAL_MOVE_MANUAL_ONLY),
    true,
  );
});

test('stage04 kernel blocks forbidden claims and forbidden basename changes', async () => {
  const {
    compileCommentSurvivalMinimalKernel,
    COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES,
  } = await loadModule();

  const result = compileCommentSurvivalMinimalKernel({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
    commentThreads: [placedThread('blocked')],
    runtimeApplyRequested: true,
    userProjectMutated: true,
    applyTxnImplemented: true,
    recoveryReady: true,
    releaseGreen: true,
    productReceiptContinuationRequested: true,
    uiChangeRequested: true,
    docxIntegrationRequested: true,
    googleIntegrationRequested: true,
    wordIntegrationRequested: true,
    networkUsed: true,
    dependencyChanged: true,
  });

  assert.equal(result.outputDecision, 'COMMENT_SURVIVAL_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_RUNTIME_APPLY_OR_USER_MUTATION),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_APPLYTXN_RECOVERY_RELEASE_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_PRODUCT_RECEIPT_CHAIN_CONTINUATION),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_UI_DOCX_GOOGLE_WORD_NETWORK_DEPENDENCY_REQUEST),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('stage04 kernel uses deterministic explicit default sourceViewState when missing and binds hash in ledger', async () => {
  const { compileCommentSurvivalMinimalKernel } = await loadModule();

  const first = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    commentThreads: [placedThread('default-svs')],
  });
  const second = compileCommentSurvivalMinimalKernel({
    changedBasenames: allowedChangedBasenames(),
    commentThreads: [placedThread('default-svs')],
  });

  assert.deepEqual(first.sourceViewState, second.sourceViewState);
  assert.equal(first.ledger.sourceViewStateHash, second.ledger.sourceViewStateHash);
  assert.equal(first.sourceViewState.revisionToken, 'LOCAL_SYNTHETIC_REVISION');
  assert.equal(first.sourceViewState.viewMode, 'LOCAL_SYNTHETIC_VIEW');
});

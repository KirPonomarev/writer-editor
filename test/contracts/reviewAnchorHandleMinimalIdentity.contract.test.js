const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewAnchorHandleMinimalIdentity.mjs';
const TASK_BASENAME = 'STAGE05A_REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_IDENTITY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [
    MODULE_BASENAME,
    'reviewAnchorHandleMinimalIdentity.contract.test.js',
    TASK_BASENAME,
  ];
}

function basePacket(overrides = {}) {
  return {
    packetId: 'pkt-001',
    packetToken: 'packet-token-001',
    packetOrdinal: 0,
    source: {
      sourceId: 'scene-001',
      sourcePart: 'body',
      sourceRevisionToken: 'rev-1',
    },
    selector: {
      selectorKind: 'TEXT_QUOTE',
      selectorEvidence: {
        exactText: 'anchor text',
        prefix: 'before',
        suffix: 'after',
      },
    },
    baseline: {
      baselineId: 'baseline-1',
      expectedHash: 'hash-1',
      currentHash: 'hash-1',
      expectedRevisionToken: 'rev-1',
      currentRevisionToken: 'rev-1',
    },
    projectBinding: {
      projectId: 'project-1',
      evidenceHash: 'project-evidence-1',
    },
    thread: {
      threadId: 'thread-1',
      commentId: 'comment-1',
      content: 'comment body',
      authorHandle: 'author-a',
      createdAtUTC: '2026-05-04T00:00:00Z',
      threadMetadataStatus: 'OK',
    },
    placement: {
      placementStatus: 'SUPPORTED',
      candidateCount: 1,
      matchStatus: 'EXACT',
      placementId: 'place-1',
      selectorKind: 'TEXT_QUOTE',
      selectorEvidence: {
        exactText: 'anchor text',
      },
      sourceState: {
        revisionToken: 'rev-1',
        viewMode: 'LOCAL_SYNTHETIC_VIEW',
      },
    },
    structuralChangeKind: 'NONE',
    ...overrides,
  };
}

test('stage05a module stays pure deterministic in-memory compiler', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
    /\bDate\.now\s*\(/u,
    /\bMath\.random\s*\(/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden pure pattern: ${pattern.source}`);
  }
});

test('same input returns same packet-local handle and deterministic canonical hash', async () => {
  const { compileReviewAnchorHandleMinimalIdentity } = await loadModule();
  const input = {
    changedBasenames: allowedChangedBasenames(),
    packets: [basePacket()],
  };

  const first = compileReviewAnchorHandleMinimalIdentity(input);
  const second = compileReviewAnchorHandleMinimalIdentity(input);

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(first.handles.length, 1);
  assert.equal(first.handles[0].handleHash, second.handles[0].handleHash);
});

test('packet source selector baseline evidence hashes bind handle identity', async () => {
  const { compileReviewAnchorHandleMinimalIdentity } = await loadModule();
  const base = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [basePacket()],
  });

  const changedSelector = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        selector: {
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'changed anchor text' },
        },
      }),
    ],
  });
  const changedBaseline = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        baseline: {
          baselineId: 'baseline-1',
          expectedHash: 'hash-1',
          currentHash: 'hash-2',
          expectedRevisionToken: 'rev-1',
          currentRevisionToken: 'rev-2',
        },
      }),
    ],
  });

  assert.notEqual(base.handles[0].selectorEvidenceHash, changedSelector.handles[0].selectorEvidenceHash);
  assert.notEqual(base.handles[0].baselineEvidenceHash, changedBaseline.handles[0].baselineEvidenceHash);
  assert.notEqual(base.handles[0].handleHash, changedSelector.handles[0].handleHash);
  assert.notEqual(base.handles[0].handleHash, changedBaseline.handles[0].handleHash);
});

test('no project write applyop applytxn and no project-truth promotion are enforced as blocked claims', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [basePacket()],
    projectWriteAttempted: true,
    applyOpRequested: true,
    applyTxnRequested: true,
    promoteStableBlockIdentityRequested: true,
    promoteProjectTruthRequested: true,
  });

  assert.equal(result.outputDecision, 'REVIEW_ANCHOR_HANDLE_BLOCKED');
  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.applyTxnPerformed, false);
  assert.equal(result.promotedToStableBlockIdentity, false);
  assert.equal(result.promotedToProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_APPLYOP_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_PROMOTION_TO_STABLE_BLOCK_ID_OR_PROJECT_TRUTH,
    ),
    true,
  );
});

test('missing changedBasenames evidence blocks output and outside allowlist remains blocked', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const missingEvidenceResult = compileReviewAnchorHandleMinimalIdentity({
    packets: [basePacket()],
  });

  assert.equal(missingEvidenceResult.outputDecision, 'REVIEW_ANCHOR_HANDLE_BLOCKED');
  assert.equal(
    missingEvidenceResult.blockedReasons.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );
  assert.equal(missingEvidenceResult.handles.length, 1);

  const outsideAllowlistResult = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
    packets: [basePacket()],
  });
  assert.equal(outsideAllowlistResult.outputDecision, 'REVIEW_ANCHOR_HANDLE_BLOCKED');
  assert.equal(
    outsideAllowlistResult.blockedReasons.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_BASENAME_CHANGE,
    ),
    true,
  );
});

test('missing project binding evidence blocks automation', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        projectBinding: {},
      }),
    ],
  });

  assert.equal(result.handles[0].applyEligible, 0);
  assert.equal(result.handles[0].automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    result.handles[0].manualReasonCodes.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MISSING_PROJECT_BINDING_EVIDENCE_BLOCKS_AUTOMATION,
    ),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MISSING_PROJECT_BINDING_EVIDENCE_BLOCKS_AUTOMATION,
    ),
    true,
  );
});

test('stale baseline is manual-only and forces zero apply eligibility', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        baseline: {
          baselineId: 'baseline-1',
          expectedHash: 'hash-1',
          currentHash: 'hash-stale',
          expectedRevisionToken: 'rev-1',
          currentRevisionToken: 'rev-stale',
        },
      }),
    ],
  });

  assert.equal(result.applyEligibilityCount, 0);
  assert.equal(result.handles[0].applyEligible, 0);
  assert.equal(result.handles[0].automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    result.handles[0].manualReasonCodes.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.STALE_BASELINE_MANUAL_ONLY_ZERO_ELIGIBILITY,
    ),
    true,
  );
});

test('duplicate selector hash and duplicate handle become anomalies without dropping packets', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({ packetId: 'pkt-a' }),
      basePacket({ packetId: 'pkt-a' }),
    ],
  });

  assert.equal(result.handles.length, 2);
  assert.equal(result.reviewBom.packetCount, 2);
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.DUPLICATE_HANDLE_REVIEW_BOM_ANOMALY,
    ),
    true,
  );
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.DUPLICATE_SELECTOR_HASH_REVIEW_BOM_ANOMALY,
    ),
    true,
  );
});

test('multi-match is manual-only and thread placement stay separate models', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        placement: {
          placementStatus: 'SUPPORTED',
          candidateCount: 3,
          matchStatus: 'AMBIGUOUS',
          placementId: '',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'anchor text' },
        },
      }),
    ],
  });

  assert.equal(result.handles[0].applyEligible, 0);
  assert.equal(result.handles[0].automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    result.handles[0].manualReasonCodes.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MULTI_MATCH_MANUAL_ONLY,
    ),
    true,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(result.commentThreads[0], 'placementStatus'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.commentPlacements[0], 'content'), false);
});

test('position-deleted comment becomes orphan packet-local handle with no placement claim manual only', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        placement: {
          placementStatus: 'POSITION_DELETED',
          candidateCount: 0,
          matchStatus: 'NO_MATCH',
          placementId: 'legacy-placement',
          selectorKind: 'TEXT_QUOTE',
          selectorEvidence: { exactText: 'anchor text' },
        },
      }),
    ],
  });

  assert.equal(result.handles[0].orphaned, true);
  assert.equal(result.handles[0].placementRef.localPlacementClaimed, false);
  assert.equal(result.handles[0].applyEligible, 0);
  assert.equal(
    result.handles[0].manualReasonCodes.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.POSITION_DELETED_ORPHAN_MANUAL_ONLY,
    ),
    true,
  );
});

test('missing thread metadata becomes anomaly and packet is not dropped', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        thread: {
          threadId: '',
          commentId: '',
          content: 'metadata missing content must survive',
        },
      }),
    ],
  });

  assert.equal(result.handles.length, 1);
  assert.equal(result.commentThreads.length, 1);
  assert.equal(result.commentThreads[0].content, 'metadata missing content must survive');
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.THREAD_METADATA_MISSING_ANOMALY_NOT_DROP,
    ),
    true,
  );
});

test('thread metadata status OK cannot mask empty ids and still emits anomaly without drop', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        thread: {
          threadId: '',
          commentId: '',
          threadMetadataStatus: 'OK',
          content: 'empty ids with forced ok status',
        },
      }),
    ],
  });

  assert.equal(result.handles.length, 1);
  assert.equal(result.commentThreads.length, 1);
  assert.equal(result.commentThreads[0].threadMetadataStatus, 'MISSING');
  assert.equal(
    result.anomalies.some(
      (item) => item.anomalyCode === REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.THREAD_METADATA_MISSING_ANOMALY_NOT_DROP,
    ),
    true,
  );
});

test('structural move split merge is manual-only', async () => {
  const {
    compileReviewAnchorHandleMinimalIdentity,
    REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES,
  } = await loadModule();

  const result = compileReviewAnchorHandleMinimalIdentity({
    changedBasenames: allowedChangedBasenames(),
    packets: [
      basePacket({
        structuralChangeKind: 'MOVE',
      }),
    ],
  });

  assert.equal(result.handles[0].applyEligible, 0);
  assert.equal(
    result.handles[0].manualReasonCodes.includes(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY,
    ),
    true,
  );
});

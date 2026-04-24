const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-parsed-review-surface-adapter.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];

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

function validParsedSurface() {
  return {
    commentThreads: [validThread()],
    commentPlacements: [validPlacement()],
    textChanges: [validTextChange()],
    structuralChanges: [validStructuralChange()],
    diagnosticItems: [validDiagnosticItem()],
    decisionStates: [validDecisionState()],
  };
}

function validAdapterInput() {
  return {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    createdAt: '2026-04-24T08:00:00.000Z',
    updatedAt: '2026-04-24T08:05:00.000Z',
    parsedSurface: validParsedSurface(),
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

function findForbiddenKeys(value, forbiddenKeys, pathSegments = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, forbiddenKeys, pathSegments.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];

  return Object.keys(value).flatMap((key) => {
    const keyPath = pathSegments.concat(key);
    const nested = findForbiddenKeys(value[key], forbiddenKeys, keyPath);
    return forbiddenKeys.includes(key) ? [keyPath.join('.'), ...nested] : nested;
  });
}

function reasonFields(result) {
  return result.reasons.map((reason) => reason.field);
}

test('RB-04 exports parsed review surface adapter only as the new public API', async () => {
  const bridge = await loadBridge();

  assert.equal(typeof bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput, 'function');
  assert.equal(bridge.PARSED_REVIEW_SURFACE_ADAPTER_READY_CODE, undefined);
  assert.equal(bridge.PARSED_REVIEW_SURFACE_ADAPTER_DIAGNOSTICS_CODE, undefined);
});

test('RB-04 converts parsed review surface to reviewPacket, previewInput, and RB-03 preview result', async () => {
  const bridge = await loadBridge();
  const input = validAdapterInput();

  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput(input);
  const directPreview = bridge.buildRevisionPacketPreview(result.previewInput);

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.parsedReviewSurfaceAdapter');
  assert.equal(result.status, 'preview');
  assert.equal(result.code, 'REVISION_BRIDGE_PARSED_REVIEW_SURFACE_ADAPTER_READY');
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.reviewPacket, input.parsedSurface);
  assert.deepEqual(result.previewInput, {
    projectId: input.projectId,
    sessionId: input.sessionId,
    baselineHash: input.baselineHash,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    reviewPacket: result.reviewPacket,
  });
  assert.deepEqual(result.revisionBridgePreviewResult, directPreview);
  assert.equal(result.revisionBridgePreviewResult.session.reviewGraph.textChanges[0].schemaVersion, (
    bridge.REVISION_BRIDGE_TEXT_CHANGE_SCHEMA
  ));
});

test('RB-04 converts unsupportedItems into exact diagnostic item candidates', async () => {
  const bridge = await loadBridge();
  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      unsupportedItems: [
        {
          unsupportedId: 'unsupported-1',
          severity: 'warning',
          message: 'Unsupported floating comment.',
          targetScope: {
            type: 'scene',
            id: 'scene-1',
          },
          relatedItemId: 'comment-9',
          createdAt: '2026-04-24T08:09:00.000Z',
        },
        {
          unsupportedId: '   ',
          severity: 'error',
          message: 'Unsupported tracked move.',
        },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.reviewPacket.diagnosticItems, [
    {
      diagnosticId: 'unsupported-1',
      severity: 'warning',
      message: 'Unsupported floating comment.',
      targetScope: {
        type: 'scene',
        id: 'scene-1',
      },
      relatedItemId: 'comment-9',
      createdAt: '2026-04-24T08:09:00.000Z',
    },
    {
      diagnosticId: 'unsupported-item-1',
      severity: 'error',
      message: 'Unsupported tracked move.',
      targetScope: undefined,
      relatedItemId: undefined,
      createdAt: undefined,
    },
  ]);
  assert.equal(
    result.revisionBridgePreviewResult.session.reviewGraph.diagnosticItems[0].message,
    'Unsupported floating comment.',
  );
});

test('RB-04 keeps unsupportedItems out of textChanges and structuralChanges', async () => {
  const bridge = await loadBridge();
  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      unsupportedItems: [
        {
          unsupportedId: 'unsupported-1',
          message: 'Unsupported item only.',
        },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.reviewPacket.diagnosticItems.length, 1);
  assert.deepEqual(result.reviewPacket.textChanges, []);
  assert.deepEqual(result.reviewPacket.structuralChanges, []);
  assert.deepEqual(result.revisionBridgePreviewResult.session.reviewGraph.textChanges, []);
  assert.deepEqual(result.revisionBridgePreviewResult.session.reviewGraph.structuralChanges, []);
});

test('RB-04 reports malformed unsupportedItems diagnostics without throwing', async () => {
  const bridge = await loadBridge();

  assert.doesNotThrow(() => bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      unsupportedItems: 'bad',
    },
  }));

  const nonArrayResult = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      unsupportedItems: 'bad',
    },
  });
  assert.equal(nonArrayResult.ok, false);
  assert.equal(reasonFields(nonArrayResult).includes('parsedSurface.unsupportedItems'), true);

  const entryResult = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      unsupportedItems: ['bad-entry'],
    },
  });
  assert.equal(entryResult.ok, false);
  assert.equal(reasonFields(entryResult).includes('parsedSurface.unsupportedItems.0'), true);
});

test('RB-04 defaults missing supported collections to empty arrays', async () => {
  const bridge = await loadBridge();
  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {},
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.reviewPacket, {
    commentThreads: [],
    commentPlacements: [],
    textChanges: [],
    structuralChanges: [],
    diagnosticItems: [],
    decisionStates: [],
  });
});

test('RB-04 reports present non-array collections as diagnostics', async () => {
  const bridge = await loadBridge();
  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      commentThreads: {},
      textChanges: 'bad',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(reasonFields(result).includes('parsedSurface.commentThreads'), true);
  assert.equal(reasonFields(result).includes('parsedSurface.textChanges'), true);
  assert.deepEqual(result.reviewPacket.commentThreads, []);
  assert.deepEqual(result.reviewPacket.textChanges, []);
});

test('RB-04 reports unknown parsedSurface keys', async () => {
  const bridge = await loadBridge();
  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      unknownReviewThing: [],
    },
  });

  assert.equal(result.ok, false);
  assert.equal(reasonFields(result).includes('parsedSurface.unknownReviewThing'), true);
});

test('RB-04 reports alias keys and does not accept them as supported data', async () => {
  const bridge = await loadBridge();

  for (const aliasKey of ['comments', 'changes', 'suggestions', 'docxComments', 'paragraphs', 'revisions']) {
    const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
      projectId: 'project-1',
      sessionId: 'session-1',
      baselineHash: 'baseline-hash-1',
      parsedSurface: {
        [aliasKey]: [validTextChange()],
      },
    });

    assert.equal(result.ok, false, `${aliasKey} must produce diagnostics`);
    assert.equal(reasonFields(result).includes(`parsedSurface.${aliasKey}`), true);
    assert.deepEqual(result.reviewPacket.textChanges, []);
    assert.deepEqual(result.reviewPacket.commentThreads, []);
  }
});

test('RB-04 preserves RB-02 no-approximation diagnostics for incomplete textChanges', async () => {
  const bridge = await loadBridge();
  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    parsedSurface: {
      textChanges: [
        {
          changeId: 'text-change-1',
          replacementText: 'revised sentence',
        },
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.equal(reasonFields(result).includes('revisionSession.reviewGraph.textChanges.0.targetScope'), true);
  assert.equal(reasonFields(result).includes('revisionSession.reviewGraph.textChanges.0.match'), true);
  assert.equal(result.reviewPacket.textChanges[0].changeId, 'text-change-1');
});

test('RB-04 is deterministic and does not mutate caller input', async () => {
  const bridge = await loadBridge();
  const input = validAdapterInput();
  const before = deepClone(input);

  const first = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput(input);
  const second = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.notEqual(first.reviewPacket.commentThreads[0], input.parsedSurface.commentThreads[0]);
});

test('RB-04 final adapter output recursively omits forbidden apply keys', async () => {
  const bridge = await loadBridge();
  const input = validAdapterInput();
  input.parsedSurface.textChanges[0].apply = {
    authorized: true,
    canApply: true,
  };
  input.parsedSurface.structuralChanges[0].applyPlan = {
    authorized: true,
  };

  const result = bridge.adaptParsedReviewSurfaceToReviewPacketPreviewInput(input);

  assert.deepEqual(findForbiddenKeys(result, ['apply', 'applyPlan', 'authorized', 'canApply']), []);
});

test('RB-04 adapter runtime section has no forbidden side-effect APIs', () => {
  const text = fs.readFileSync(MODULE_PATH, 'utf8');
  const adapterStart = text.indexOf('export function adaptParsedReviewSurfaceToReviewPacketPreviewInput');
  const adapterEnd = text.indexOf('function normalizeTargetScope');
  const adapterSection = text.slice(adapterStart, adapterEnd);
  const forbiddenPatterns = [
    /\bimport\b/u,
    /\brequire\s*\(/u,
    /\bfs\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\belectron\b/u,
    /\bipcMain\b/u,
    /\bipcRenderer\b/u,
    /\bdocx\b/u,
    /\bpath\b/u,
    /\bchild_process\b/u,
    /\bDate\.now\s*\(/u,
    /\bnew\s+Date\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bsetTimeout\s*\(/u,
    /\bsetInterval\s*\(/u,
  ];

  assert.notEqual(adapterStart, -1);
  assert.notEqual(adapterEnd, -1);
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(adapterSection), false, `forbidden adapter pattern: ${pattern.source}`);
  }
});

test('RB-04 changed files stay inside the exact task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
});

test('RB-04 changed-file allowlist still rejects outside paths', () => {
  assert.deepEqual(changedFilesOutsideAllowlist([]), []);
  assert.deepEqual(changedFilesOutsideAllowlist([TEST_PATH]), []);
  assert.deepEqual(changedFilesOutsideAllowlist(ALLOWLIST), []);
  assert.deepEqual(
    changedFilesOutsideAllowlist([
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb04-probe-unique.js',
    ]),
    [
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb04-probe-unique.js',
    ],
  );
});

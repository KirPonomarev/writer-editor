'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function makeCryptoPort() {
  return {
    sha256Text(value) {
      return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
    },
    sha256Json(value) {
      return `sha256:${this.sha256Text(stableJson(value))}`;
    },
    hmacSha256Json(value, secret) {
      return `hmac-sha256:${crypto.createHmac('sha256', String(secret || '')).update(stableJson(value), 'utf8').digest('hex')}`;
    },
    byteLength(value) {
      return Buffer.byteLength(String(value || ''), 'utf8');
    },
  };
}

function makeSource(deps = {}) {
  const {
    buildFullManuscriptDocxReviewPacketSource,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewPacketSource.js'));
  return buildFullManuscriptDocxReviewPacketSource({
    projectId: 'project-c5v2',
    projectRoot: '/project',
    manifestPath: '/project/manifest.json',
    scenes: [
      {
        sceneId: 'roman/preface.md',
        scenePath: '/project/roman/preface.md',
        text: 'The artist is the creator of beautiful things.\nA critic translates an impression into another mode.',
        order: 0,
      },
      {
        sceneId: 'roman/chapter-01.md',
        scenePath: '/project/roman/chapter-01.md',
        text: 'The studio was filled with the rich odour of roses.\nLord Henry watched the painter carefully.',
        order: 1,
      },
    ],
  }, {
    roundIdHex: '1234567890abcdef1234567890abcdef',
    keyIdHex: 'abcdef1234567890abcdef1234567890',
    hmacSecret: 'local-secret-for-test-only',
    cryptoPort: makeCryptoPort(),
    ...deps,
  });
}

function returnedAuthority(source, overrides = {}) {
  return {
    scope: 'full-manuscript',
    projectId: 'project-c5v2',
    roundId: source.localAuthorityCapsule.roundId,
    exportId: source.localAuthorityCapsule.exportIdentity,
    fullBookRawSha256: source.exportCapsule.fullBookRawSha256,
    orderedSceneIds: source.exportCapsule.orderedSceneIds,
    ...overrides,
  };
}

function returnIntakeProof(source, operations = [], overrides = {}) {
  const cryptoPort = makeCryptoPort();
  const proof = {
    status: 'authenticated-return-ir-ready',
    authenticated: true,
    returnedArtifactSha256: cryptoPort.sha256Json({ returned: source.localAuthorityCapsule.roundId }),
    coreManifestDigest: source.localAuthorityCapsule.coreManifestDigest,
    yrtk2Verification: {
      code: 'RTK_RETURN_INTAKE_YRTK2_VERIFIED',
      coreManifestDigest: source.localAuthorityCapsule.coreManifestDigest,
      keyIdHex: source.localAuthorityCapsule.yrtk2.keyIdHex,
      roundIdHex: source.localAuthorityCapsule.yrtk2.roundIdHex,
      tokenDigest: source.localAuthorityCapsule.yrtk2.tokenDigest,
    },
    parserProfileDigest: cryptoPort.sha256Json({ parser: 'test-parser-v2' }),
    analysisDigest: cryptoPort.sha256Json({ analysis: operations.map((operation) => operation.id) }),
    reviewIrDigest: cryptoPort.sha256Json({ reviewIr: operations.map((operation) => operation.id) }),
    operationSource: 'parsed-review-ir',
    operationIds: operations.map((operation) => operation.id),
    ...overrides,
  };
  const {
    buildFullManuscriptReturnIntakeProofBindingDigest,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewReturnRouter.js'));
  if (overrides.mainIntakeAuthorityDigest === undefined) {
    proof.mainIntakeAuthorityDigest = buildFullManuscriptReturnIntakeProofBindingDigest({
      proof,
      localAuthority: source.localAuthorityCapsule,
      operations,
    });
  }
  return proof;
}

test('C5V2 full-manuscript authority carrier verifies against local full-book authority', async () => {
  const source = makeSource();
  const {
    buildDocxReviewPacketBuffer,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'docxReviewPacketBuilder.js'));
  const revisionBridge = await import(path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs'));
  const bytes = buildDocxReviewPacketBuffer(source);
  const result = revisionBridge.buildDocxReviewTransportAnalysisFromZipBytes({
    bytes,
    hmacSecret: source.forbiddenSecret,
    expectedAuthority: source.localAuthorityCapsule.expectedAuthority,
  }, { cryptoPort: makeCryptoPort() });

  assert.equal(result.ok, true);
  assert.equal(result.authorityCarrier.status, 'verified-baseline-bound');
  assert.equal(result.exactAuthority.validSignedLocator, true);
  assert.equal(result.exactAuthority.rawSha256Unchanged, true);
  assert.equal(result.authorityCarrier.selectedCarrier.payload.scope, 'full-manuscript');
  assert.equal(
    result.authorityCarrier.selectedCarrier.payload.fullBookRawSha256,
    source.localAuthorityCapsule.expectedAuthority.fullBookRawSha256,
  );
});

test('C5V2 return router lowers eligible full-manuscript tracked replacements to existing atomic multi-scene command', async () => {
  const {
    buildFullManuscriptReviewReturnApplyPlan,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewReturnRouter.js'));
  const source = makeSource();
  const operations = [
    {
      id: 'op-preface-replace',
      family: 'tracked_text_edit',
      sceneId: 'roman/preface.md',
      anchor: {
        sceneId: 'roman/preface.md',
        selectedText: 'beautiful things',
      },
      semanticIntent: {
        kind: 'replace',
        replacementText: 'luminous forms',
      },
    },
    {
      id: 'op-chapter-replace',
      family: 'tracked_text_edit',
      sceneId: 'roman/chapter-01.md',
      anchor: {
        sceneId: 'roman/chapter-01.md',
        selectedText: 'rich odour of roses',
      },
      semanticIntent: {
        kind: 'replace',
        replacementText: 'quiet scent of roses',
      },
    },
    {
      id: 'op-comment-root',
      family: 'root_comment',
      sceneId: 'roman/preface.md',
      anchor: {
        sceneId: 'roman/preface.md',
        selectedText: 'critic translates',
      },
      semanticIntent: {
        kind: 'root-comment',
        threadId: 'thread-preface-01',
        commentId: 'comment-preface-01',
        commentText: 'Please clarify the critical distinction.',
      },
    },
    {
      id: 'op-comment-reply',
      family: 'reply',
      sceneId: 'roman/preface.md',
      anchor: { sceneId: 'roman/preface.md' },
      semanticIntent: {
        kind: 'single-reply-thread',
        parentThreadId: 'thread-preface-01',
        replyText: 'The distinction is now explicit.',
      },
    },
    {
      id: 'op-comment-resolve',
      family: 'comment_state',
      sceneId: 'roman/preface.md',
      anchor: { sceneId: 'roman/preface.md' },
      semanticIntent: { kind: 'resolve', parentThreadId: 'thread-preface-01' },
    },
  ];
  const plan = buildFullManuscriptReviewReturnApplyPlan({
    projectId: 'project-c5v2',
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source),
    operations,
    returnIntakeProof: returnIntakeProof(source, operations),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.commandId, 'cmd.rtk.review.applyMultiSceneNonOverlapTrackedReplacements');
  assert.equal(plan.atomicity.partialCanonicalWriteForbidden, true);
  assert.equal(plan.sceneCommands.length, 2);
  assert.deepEqual(plan.sceneCommands.map((sceneCommand) => sceneCommand.sceneId), [
    'roman/preface.md',
    'roman/chapter-01.md',
  ]);
  assert.equal(plan.sceneCommands[0].input.commandId, 'cmd.rtk.review.applyNonOverlapTrackedReplacements');
  assert.equal(plan.sceneCommands[0].input.writerInput.reviewItems[0].targetScope.id, 'roman/preface.md');
  assert.equal(plan.sceneCommands[0].input.writerInput.reviewItems[0].match.quote, 'beautiful things');
  assert.equal(plan.sceneCommands[0].input.exactAuthority.source, 'authenticated-full-manuscript-export-map-baseline-and-local-ranges');
  assert.equal(plan.sceneCommands[0].input.exactAuthority.uniqueTarget, true);
  assert.equal(plan.sceneCommands[0].input.exactAuthority.nonOverlapping, true);
  assert.equal(plan.sceneCommands[0].input.writerInput.reviewItems[0].match.blockRange.blockLocalStart, 29);
  assert.equal(plan.sceneCommands[0].input.exactAuthorityDigest, plan.sceneCommands[0].input.writerInput.reviewItems[0].match.blockRange.authorityDigest);
  assert.deepEqual(plan.typedOperations, []);
  assert.equal(plan.rootCommentCommands.length, 1);
  assert.equal(plan.rootCommentCommands[0].commandId, 'cmd.rtk.review.applyRootCommentReturn');
  assert.equal(plan.rootCommentCommands[0].commandAuthority.intent, 'rtk.nonTextReturn');
  assert.equal(plan.rootCommentCommands[0].threadId, 'thread-preface-01');
  assert.equal(plan.rootCommentCommands[0].body, 'Please clarify the critical distinction.');
  assert.equal(plan.commentLifecycleCommands.length, 2);
  assert.equal(plan.commentLifecycleCommands[0].commandId, 'cmd.rtk.review.applyCommentLifecycleReturn');
  assert.equal(plan.commentLifecycleCommands[0].action, 'reply');
  assert.equal(plan.commentLifecycleCommands[0].replyBody, 'The distinction is now explicit.');
  assert.equal(plan.commentLifecycleCommands[1].action, 'resolve');
  const revisionBridge = await import(path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs'));
  for (const sceneCommand of plan.sceneCommands) {
    const preview = revisionBridge.buildNonOverlapTrackedReplacementRuntimePreview(sceneCommand.input, {
      cryptoPort: makeCryptoPort(),
    });
    assert.equal(preview.status, 'preview-ready', JSON.stringify(preview, null, 2));
  }
});

test('C5V2 return router rejects wrong scene, missing scene, stale baseline and order tamper before apply planning', () => {
  const {
    buildFullManuscriptReviewReturnApplyPlan,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewReturnRouter.js'));
  const source = makeSource();

  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source, {
      orderedSceneIds: ['roman/chapter-01.md', 'roman/preface.md'],
    }),
    operations: [],
  }).code, 'FULL_MANUSCRIPT_RETURN_SCENE_ORDER_MISMATCH');

  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source, {
      fullBookRawSha256: 'sha256:tampered',
    }),
    operations: [],
  }).code, 'FULL_MANUSCRIPT_RETURN_BASELINE_STALE_OR_TAMPERED');

  const missing = structuredClone(source.localAuthorityCapsule);
  delete missing.scenePathBySceneId['roman/chapter-01.md'];
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    localAuthorityCapsule: missing,
    returnedAuthority: returnedAuthority(source),
    operations: [],
  }).code, 'FULL_MANUSCRIPT_LOCAL_AUTHORITY_SCENE_MISSING');

  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source),
    operations: [
      {
        id: 'op-wrong-scene',
        family: 'tracked_text_edit',
        sceneId: 'roman/chapter-99.md',
        anchor: { sceneId: 'roman/chapter-99.md', selectedText: 'ghost' },
        semanticIntent: { kind: 'replace', replacementText: 'blocked' },
      },
    ],
    returnIntakeProof: returnIntakeProof(source, [{ id: 'op-wrong-scene' }]),
  }).code, 'FULL_MANUSCRIPT_OPERATION_WRONG_SCENE');
});

test('C5V2 exact authority is shared by preview and dispatch and blocks ambiguity overlap stale baseline and forged maps', () => {
  const {
    buildFullManuscriptReviewReturnApplyPlan,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewReturnRouter.js'));
  const source = makeSource();
  const base = {
    projectId: 'project-c5v2',
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source),
  };
  const replacement = (id, quote) => ({
    id,
    family: 'tracked_text_edit',
    sceneId: 'roman/preface.md',
    anchor: { sceneId: 'roman/preface.md', selectedText: quote },
    semanticIntent: { kind: 'replace', replacementText: `replacement-${id}` },
  });

  const duplicateBaseline = structuredClone(source.localAuthorityCapsule);
  duplicateBaseline.baselineFinalTextBySceneId['roman/preface.md'] = 'same quote and same quote';
  duplicateBaseline.exportMap.scenes[0].rawSha256 = `sha256:${crypto.createHash('sha256').update('same quote and same quote').digest('hex')}`;
  const duplicateOperation = replacement('duplicate', 'same quote');
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    localAuthorityCapsule: duplicateBaseline,
    operations: [duplicateOperation],
    returnIntakeProof: returnIntakeProof(source, [duplicateOperation]),
  }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_QUOTE_NOT_UNIQUE');

  const overlapOperations = [replacement('overlap-a', 'beautiful things'), replacement('overlap-b', 'things')];
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    operations: overlapOperations,
    returnIntakeProof: returnIntakeProof(source, overlapOperations),
  }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_RANGES_OVERLAP');

  const stale = structuredClone(source.localAuthorityCapsule);
  stale.baselineFinalTextBySceneId['roman/preface.md'] += ' stale';
  const staleOperation = replacement('stale', 'beautiful things');
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    localAuthorityCapsule: stale,
    operations: [staleOperation],
    returnIntakeProof: returnIntakeProof(source, [staleOperation]),
  }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_BASELINE_STALE');

  const forged = structuredClone(source.localAuthorityCapsule);
  forged.exportMap.scenes[0].sceneId = 'roman/forged.md';
  const forgedOperation = replacement('forged', 'beautiful things');
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    localAuthorityCapsule: forged,
    operations: [forgedOperation],
    returnIntakeProof: returnIntakeProof(source, [forgedOperation]),
  }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_EXPORT_MAP_IDENTITY_INVALID');

  const sharedOperation = replacement('shared', 'beautiful things');
  const positive = buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    operations: [sharedOperation],
    returnIntakeProof: returnIntakeProof(source, [sharedOperation]),
  });
  assert.equal(positive.ok, true);
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    operations: [sharedOperation],
    returnIntakeProof: returnIntakeProof(source, [sharedOperation]),
    admissionExactAuthorityBySceneId: {
      'roman/preface.md': positive.exactAuthorityBySceneId['roman/preface.md'].exactAuthority,
    },
  }).ok, true);
  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    ...base,
    operations: [sharedOperation],
    returnIntakeProof: returnIntakeProof(source, [sharedOperation]),
    admissionExactAuthorityBySceneId: {
      'roman/preface.md': { ...positive.exactAuthorityBySceneId['roman/preface.md'].exactAuthority, uniqueTarget: false },
    },
  }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_PREVIEW_DISPATCH_DISAGREEMENT');
});

test('C5V2 return router rejects handcrafted operations without authenticated return-intake proof', () => {
  const {
    buildFullManuscriptReviewReturnApplyPlan,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewReturnRouter.js'));
  const source = makeSource();
  const operation = {
    id: 'op-handcrafted',
    family: 'tracked_text_edit',
    sceneId: 'roman/preface.md',
    anchor: { sceneId: 'roman/preface.md', selectedText: 'beautiful things' },
    semanticIntent: { kind: 'replace', replacementText: 'luminous forms' },
  };

  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    projectId: 'project-c5v2',
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source),
    operations: [operation],
  }).code, 'FULL_MANUSCRIPT_RETURN_INTAKE_PROOF_REQUIRED');

  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    projectId: 'project-c5v2',
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source),
    operations: [operation],
    returnIntakeProof: returnIntakeProof(source, [operation], {
      mainIntakeAuthorityDigest: 'hmac-sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }),
  }).code, 'FULL_MANUSCRIPT_RETURN_INTAKE_PROOF_BINDING_MISMATCH');

  assert.equal(buildFullManuscriptReviewReturnApplyPlan({
    projectId: 'project-c5v2',
    localAuthorityCapsule: source.localAuthorityCapsule,
    returnedAuthority: returnedAuthority(source),
    operations: [operation],
    returnIntakeProof: returnIntakeProof(source, [operation], {
      operationIds: ['other-operation'],
    }),
  }).code, 'FULL_MANUSCRIPT_RETURN_INTAKE_OPERATION_IDS_MISMATCH');
});

test('clean text router authenticates exact duplicate paragraph owner without inventing tracked revisions', () => {
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const router = require('../../src/export/docx/fullManuscriptDocxReviewReturnRouter.js');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const doc = { type: 'doc', content: [0,1].map(() => ({ type: 'paragraph', content: [{ type: 'text', text: 'Twin target' }] })) };
  const raw = envelope.composeObservablePayload({ doc }), sceneId = 'roman/twin.txt';
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'project-c5v2', projectRoot: '/project',
    manifestPath: '/project/manifest.json', scenes: [{ sceneId, scenePath: '/project/' + sceneId,
      text: 'Twin target\nTwin target', observableContent: raw, doc, order: 0 }] }, {
    roundIdHex: '1'.repeat(32), keyIdHex: '2'.repeat(32), hmacSecret: 'clean-owner-test', cryptoPort: makeCryptoPort() });
  const block = source.localAuthorityCapsule.exportMap.scenes[0].blocks[1];
  const op = { id: 'docx-clean-block-text-twin', family: 'clean_text_edit', sceneId, anchor: { sceneId, selectedText: 'Twin target',
    authenticatedBlock: { schemaVersion: 'yalken.rtk.authenticated-scene-block.v1', sceneId,
      blockId: block.blockId, documentParagraphIndex: block.documentParagraphIndex, sceneParagraphIndex: 1,
      baselineRawSha256: source.localAuthorityCapsule.exportMap.scenes[0].rawSha256,
      blockTextSha256: block.canonicalTextSha256, blockLocalStart: 0, blockLocalEnd: 11 } },
    semanticIntent: { kind: 'replace', replacementText: 'Twin changed' } };
  const input = { localAuthorityCapsule: source.localAuthorityCapsule, returnedAuthority: returnedAuthority(source), operations: [op],
    returnIntakeProof: returnIntakeProof(source, [op], { operationSource: 'authenticated-clean-block-text' }) };
  const result = router.buildFullManuscriptReviewReturnApplyPlan(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.sceneCommands.length, 1);
  const command = result.sceneCommands[0];
  assert.equal(command.kind, 'authenticated-clean-text');
  assert.equal(Object.hasOwn(command.input, 'reviewIr'), false);
  assert.equal(command.input.writerInput.reviewItems[0].match.authenticatedBlock.sceneParagraphIndex, 1);
  assert.equal(result.exactAuthorityBySceneId[sceneId].ranges[0].from, 12);
  for (const [key, value] of [['blockId','foreign'], ['sceneId','foreign'], ['documentParagraphIndex',99],
    ['sceneParagraphIndex',0], ['blockTextSha256','sha256:'+'0'.repeat(64)], ['baselineRawSha256','sha256:'+'0'.repeat(64)]]) {
    const mutant = structuredClone(input); mutant.operations[0].anchor.authenticatedBlock[key] = value;
    mutant.returnIntakeProof = returnIntakeProof(source, mutant.operations, { operationSource: 'authenticated-clean-block-text' });
    assert.equal(router.buildFullManuscriptReviewReturnApplyPlan(mutant).ok, false, key);
  }
  const forged = structuredClone(input); forged.operations[0].semanticIntent.replacementText = 'FORGED';
  assert.equal(router.buildFullManuscriptReviewReturnApplyPlan(forged).code, 'FULL_MANUSCRIPT_RETURN_INTAKE_PROOF_BINDING_MISMATCH');
  const mixed = structuredClone(input); mixed.operations.push({ ...op, id: 'tracked', family: 'tracked_text_edit' });
  mixed.returnIntakeProof = returnIntakeProof(source, mixed.operations, { operationSource: 'authenticated-clean-block-text' });
  assert.equal(router.buildFullManuscriptReviewReturnApplyPlan(mixed).ok, false);
});

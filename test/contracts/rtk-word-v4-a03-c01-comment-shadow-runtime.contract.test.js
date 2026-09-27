const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'reviewTransportCommentShadowSession.mjs');
const COMMAND_KERNEL_PATH = path.join(REPO_ROOT, 'src', 'command', 'commandSurfaceKernel.js');
const COMMAND_ID = 'cmd.rtk.reviewSession.importComments';

function makeProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-a03-c01-'));
}

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

function loadCommandKernel() {
  return require(COMMAND_KERNEL_PATH);
}

function reviewIrFixture(extraThread = {}) {
  return {
    schemaVersion: 'yalken.rtk.review-ir.v2',
    roundId: 'round-a03-c01',
    returnArtifactId: 'return-a03-c01',
    semanticReturnId: 'semantic-a03-c01',
    textRevisions: [],
    moveRevisions: [],
    propertyRevisions: [],
    formattingDeltas: [],
    structureChanges: [],
    opaqueUnsupported: [],
    commentThreads: [
      {
        kind: 'CommentThread',
        threadId: 'rtk-comment-root-1',
        commentId: '1',
        durableId: 'durable-root-1',
        parentThreadId: '',
        replies: [],
        doneResolvedReopenedState: 'active',
        authorPersonIdentity: {
          author: 'Yalken Synthetic Editor',
          initials: 'YSE',
          people: [{ id: 'person-yse', displayName: 'Yalken Synthetic Editor' }],
        },
        date: '2026-07-31T16:45:00.000Z',
        anchorStart: 12,
        anchorEnd: 28,
        quotedAnchorText: 'portable sentence',
        body: 'Root modern comment body RU EN Unicode e\u0301 emoji \u{1f600}',
        bodyExcerpt: 'Root modern comment body RU EN Unicode e\u0301 emoji \u{1f600}',
        orderingKey: 1,
        status: 'ANCHORED',
        placement: {
          outcome: 'ANCHORED',
          anchored: true,
          selectorStack: {
            exactQuote: 'portable sentence',
            prefix: 'before',
            suffix: 'after',
            utf16Position: 12,
          },
        },
        reasonCodes: ['RTK_COMMENT_ANCHORED'],
        sourceXmlProvenance: { part: 'word/comments.xml', tokenIndex: 1 },
        ...extraThread,
      },
      {
        kind: 'CommentThread',
        threadId: 'rtk-comment-root-2',
        commentId: '2',
        durableId: 'durable-root-2',
        parentThreadId: '',
        replies: [],
        authorPersonIdentity: { author: 'Yalken Synthetic Editor', initials: 'YSE', people: [] },
        date: '2026-07-31T16:46:00.000Z',
        quotedAnchorText: '',
        body: 'Orphan but preserved comment body',
        orderingKey: 2,
        status: 'ORPHAN',
        placement: {
          outcome: 'ORPHAN',
          anchored: false,
          selectorStack: { exactQuote: '', prefix: '', suffix: '', utf16Position: null },
        },
        reasonCodes: ['RTK_COMMENT_ORPHAN'],
      },
    ],
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function authenticatedReturnIdentity(overrides = {}) {
  return {
    schemaVersion: 'yalken.rtk.comment-shadow-authenticated-return-binding.v1',
    authenticated: true,
    projectId: 'project-a03-c01',
    sceneId: 'roman/imported/scene-1.txt',
    sceneRevision: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    rawSha256: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    baselineHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    currentBaselineHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    roundId: 'round-a03-c01',
    exportId: 'export-a03-c01',
    exportArtifactId: 'export-artifact-a03-c01',
    returnArtifactId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    semanticReturnId: 'semantic-a03-c01',
    parserProfileDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    analysisDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    ...overrides,
  };
}

function authenticatedPayload(projectRoot, overrides = {}) {
  const identity = authenticatedReturnIdentity(overrides.authenticatedReturnIdentity);
  const reviewIr = reviewIrFixture();
  reviewIr.roundId = identity.roundId;
  reviewIr.returnArtifactId = identity.returnArtifactId;
  reviewIr.semanticReturnId = identity.semanticReturnId;
  return {
    projectRoot,
    roundId: identity.roundId,
    returnArtifactId: identity.returnArtifactId,
    semanticReturnId: identity.semanticReturnId,
    authenticatedReturnIdentity: identity,
    reviewIr,
    ...overrides.payload,
  };
}

test('A03 C01 imports root modern comments through Command Kernel into a shadow session only', async () => {
  const projectRoot = makeProjectRoot();
  const mod = await loadModule();
  const { createCommandSurfaceKernel } = loadCommandKernel();
  const kernel = createCommandSurfaceKernel({
    [COMMAND_ID]: mod.createRtkCommentShadowSessionCommandHandler(),
  });

  const result = await kernel.dispatch(COMMAND_ID, {
    projectRoot,
    roundId: 'round-a03-c01',
    returnArtifactId: 'return-a03-c01',
    semanticReturnId: 'semantic-a03-c01',
    reviewIr: reviewIrFixture(),
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.status, 'committed');
  assert.equal(result.writerCalled, false);
  assert.equal(result.manuscriptApplyAuthority, false);
  assert.equal(result.session.authorityLevel.productRuntimeWired, true);
  assert.equal(result.session.authorityLevel.automaticApplyCertified, false);
  assert.equal(result.session.summary.threadCount, 2);
  assert.equal(result.session.summary.anchored, 1);
  assert.equal(result.session.summary.orphan, 1);
  assert.equal(result.session.threads[0].body.includes('Unicode'), true);
  assert.equal(result.session.threads[0].authorPersonIdentity.initials, 'YSE');
  assert.equal(result.session.threads[0].anchor.quotedAnchorText, 'portable sentence');
  assert.equal(result.session.threads[1].orphanOutcome, true);
  assert.equal(fs.existsSync(result.sessionPath), true);
  assert.equal(fs.existsSync(result.receiptPath), true);
  assert.equal(result.storageEffects.sessionRecordCreated, true);
  assert.equal(result.storageEffects.receiptCreated, true);
  assert.equal(result.storageEffects.manuscriptBytesWritten, 0);

  const receipt = readJson(result.receiptPath);
  assert.equal(receipt.schemaVersion, mod.RTK_COMMENT_SHADOW_SESSION_RECEIPT_V1_SCHEMA);
  assert.equal(receipt.vetoMetrics.manuscriptMutation, 0);
  assert.equal(receipt.vetoMetrics.silentCommentLoss, 0);
  assert.equal(receipt.vetoMetrics.replyPromotion, 0);
  assert.equal(receipt.vetoMetrics.resolveReopenPromotion, 0);
});

test('A03 C01 authenticated return identity binds project scene baseline storage keys and blocks forged mismatches', async () => {
  const projectRoot = makeProjectRoot();
  const mod = await loadModule();
  const first = await mod.importRtkCommentShadowSession(authenticatedPayload(projectRoot));
  const second = await mod.importRtkCommentShadowSession(authenticatedPayload(projectRoot, {
    authenticatedReturnIdentity: {
      sceneId: 'roman/imported/scene-2.txt',
      sceneRevision: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      rawSha256: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      baselineHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      currentBaselineHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
  }));

  assert.equal(first.ok, true, JSON.stringify(first, null, 2));
  assert.equal(second.ok, true, JSON.stringify(second, null, 2));
  assert.equal(first.session.authenticatedReturnIdentity.authenticated, true);
  assert.equal(first.session.authenticatedReturnIdentity.bindingLevel, 'authenticated-product-return');
  assert.equal(first.session.authenticatedReturnIdentity.projectId, 'project-a03-c01');
  assert.equal(first.session.authenticatedReturnIdentity.sceneId, 'roman/imported/scene-1.txt');
  assert.equal(first.receipt.authenticatedReturnIdentityDigest, first.session.authenticatedReturnIdentity.bindingDigest);
  assert.notEqual(first.session.requestKey, second.session.requestKey);
  assert.notEqual(first.session.effectKey, second.session.effectKey);
  assert.equal(first.storageEffects.manuscriptBytesWritten, 0);

  const blockedRoot = makeProjectRoot();
  const blocked = await mod.importRtkCommentShadowSession(authenticatedPayload(blockedRoot, {
    payload: { roundId: 'caller-forged-round' },
  }));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.writerCalled, false);
  assert.equal(blocked.reasons.some((item) => item.code === 'RTK_COMMENT_SHADOW_AUTHORITY_MISMATCH'), true);
  assert.equal(fs.existsSync(path.join(blockedRoot, 'backups', 'revision-bridge-rtk-comment-shadow-sessions')), false);
});

test('A03 C01 authenticated full-manuscript return identity binds full-book comments without inventing scene authority', async () => {
  const projectRoot = makeProjectRoot();
  const mod = await loadModule();
  const fullBookIdentity = authenticatedReturnIdentity({
    scope: 'full-manuscript',
    sceneId: '',
    sceneRevision: '',
    rawSha256: '',
    baselineHash: '',
    currentBaselineHash: '',
    fullBookRawSha256: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    sceneCount: 21,
    orderedSceneIdsDigest: 'sha256:9999999999999999999999999999999999999999999999999999999999999999',
  });
  const reviewIr = reviewIrFixture();
  reviewIr.roundId = fullBookIdentity.roundId;
  reviewIr.returnArtifactId = fullBookIdentity.returnArtifactId;
  reviewIr.semanticReturnId = fullBookIdentity.semanticReturnId;

  const result = await mod.importRtkCommentShadowSession({
    projectRoot,
    roundId: fullBookIdentity.roundId,
    returnArtifactId: fullBookIdentity.returnArtifactId,
    semanticReturnId: fullBookIdentity.semanticReturnId,
    authenticatedReturnIdentity: fullBookIdentity,
    reviewIr,
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.writerCalled, false);
  assert.equal(result.manuscriptApplyAuthority, false);
  assert.equal(result.session.authenticatedReturnIdentity.scope, 'full-manuscript');
  assert.equal(result.session.authenticatedReturnIdentity.sceneId, '');
  assert.equal(result.session.authenticatedReturnIdentity.fullBookRawSha256, fullBookIdentity.fullBookRawSha256);
  assert.equal(result.session.authenticatedReturnIdentity.orderedSceneIdsDigest, fullBookIdentity.orderedSceneIdsDigest);
  assert.equal(result.session.summary.threadCount, 2);
  assert.equal(result.receipt.vetoMetrics.silentCommentLoss, 0);
});

test('A03 C01 repeated import is idempotent and does not rewrite a committed shadow session', async () => {
  const projectRoot = makeProjectRoot();
  const mod = await loadModule();
  const payload = {
    projectRoot,
    roundId: 'round-a03-c01',
    returnArtifactId: 'return-a03-c01',
    semanticReturnId: 'semantic-a03-c01',
    reviewIr: reviewIrFixture(),
  };

  const first = await mod.importRtkCommentShadowSession(payload);
  const firstStat = fs.statSync(first.sessionPath);
  const second = await mod.importRtkCommentShadowSession(payload);
  const secondStat = fs.statSync(second.sessionPath);

  assert.equal(first.status, 'committed');
  assert.equal(second.status, 'replay');
  assert.equal(second.code, 'RTK_ALREADY_ANALYZED');
  assert.equal(second.writerCalled, false);
  assert.equal(second.session.requestKey, first.session.requestKey);
  assert.equal(secondStat.mtimeMs, firstStat.mtimeMs);
});

test('A03 C01 preserves replies as typed limitations while duplicate ids still write no shadow files', async () => {
  const projectRoot = makeProjectRoot();
  const mod = await loadModule();
  const withReply = reviewIrFixture({
    replies: [{
      rawId: 'reply-1',
      body: 'reply must remain limitation',
      author: 'Synthetic Reply Author',
      initials: 'SRA',
    }],
  });
  const replyResult = await mod.importRtkCommentShadowSession({
    projectRoot,
    roundId: 'round-a03-c01',
    semanticReturnId: 'semantic-a03-c01-reply',
    reviewIr: withReply,
  });

  assert.equal(replyResult.ok, true, JSON.stringify(replyResult, null, 2));
  assert.equal(replyResult.writerCalled, false);
  assert.equal(replyResult.manuscriptApplyAuthority, false);
  assert.equal(replyResult.session.summary.replyCountPromoted, 0);
  assert.equal(replyResult.session.summary.unsupportedReplyCount, 1);
  assert.equal(replyResult.session.invariants.modernRepliesPromoted, false);
  assert.equal(replyResult.session.invariants.modernRepliesPreservedAsTypedLimitation, true);
  assert.equal(replyResult.session.threads[0].unsupportedReplies[0].body, 'reply must remain limitation');
  assert.equal(replyResult.session.threads[0].unsupportedReplies[0].authorPersonIdentity.initials, 'SRA');
  assert.equal(replyResult.session.threads[0].unsupportedReplies[0].reasonCodes.includes('RTK_COMMENT_REPLY_TYPED_LIMITATION_PRESERVED'), true);
  assert.equal(replyResult.receipt.vetoMetrics.replyPromotion, 0);
  assert.equal(replyResult.receipt.vetoMetrics.silentCommentLoss, 0);

  const duplicate = reviewIrFixture();
  duplicate.commentThreads[1].commentId = '1';
  const duplicateResult = await mod.importRtkCommentShadowSession({
    projectRoot,
    roundId: 'round-a03-c01',
    semanticReturnId: 'semantic-a03-c01-duplicate',
    reviewIr: duplicate,
  });

  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicateResult.reasons.some((item) => item.code === 'RTK_BLOCKED_DUPLICATE_TOKEN'), true);
});

test('A03 C01 recovers a missing receipt after a crash window without double applying', async () => {
  const projectRoot = makeProjectRoot();
  const mod = await loadModule();
  const payload = {
    projectRoot,
    roundId: 'round-a03-c01',
    semanticReturnId: 'semantic-a03-c01-recovery',
    reviewIr: reviewIrFixture(),
  };

  const crashed = await mod.importRtkCommentShadowSession(payload, {
    simulateCrashAfterReceiptTempWrite: true,
  });
  assert.equal(crashed.ok, false);
  assert.equal(crashed.code, 'RTK_RECOVERY_REQUIRED');
  assert.equal(fs.existsSync(crashed.sessionPath), true);
  assert.equal(fs.existsSync(crashed.receiptPath), false);

  const recovered = await mod.importRtkCommentShadowSession(payload);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status, 'recovered-replay-receipt');
  assert.equal(recovered.writerCalled, false);
  assert.equal(fs.existsSync(recovered.receiptPath), true);
  const receipt = readJson(recovered.receiptPath);
  assert.equal(receipt.status, 'recovered-replay-receipt');
  assert.equal(receipt.recoveredReceipt, true);
  assert.equal(receipt.vetoMetrics.replayFailure, 0);
});

test('A03 C01 command path rejects non-kernel command ids and never calls a manuscript writer', async () => {
  const mod = await loadModule();
  const { createCommandSurfaceKernel } = loadCommandKernel();
  const kernel = createCommandSurfaceKernel({
    [COMMAND_ID]: async () => ({ ok: true, writerCalled: true }),
  });

  const disallowed = await kernel.dispatch('rtk.reviewSession.importComments', {});
  assert.equal(disallowed.ok, false);
  assert.equal(disallowed.error.code, 'E_COMMAND_ID_NOT_ALLOWED');

  const preview = mod.buildRtkCommentShadowSessionPreview({
    roundId: 'round-a03-c01',
    semanticReturnId: 'semantic-a03-c01-preview',
    reviewIr: reviewIrFixture(),
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.session.invariants.canWriteManuscript, false);
  assert.equal(preview.session.invariants.modernRepliesPromoted, false);
  assert.equal(preview.session.summary.unsupportedReplyCount, 0);
});

test('actual main shadow intake replays across preview clocks without losing Word dates or writing canonical state', async (t) => {
  const vm = require('node:vm'), crypto = require('node:crypto');
  const projectRoot = makeProjectRoot();
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const mod = await loadModule();
  const bridge = await import(pathToFileURL(path.join(REPO_ROOT, 'src/io/revisionBridge/index.mjs')).href);
  const payload = authenticatedPayload(projectRoot), identity = payload.authenticatedReturnIdentity;
  const scenePath = path.join(projectRoot, 'scene.txt');
  fs.writeFileSync(scenePath, 'Canonical manuscript must remain unchanged');
  const context = { projectRoot, projectId: identity.projectId, baselineHash: identity.baselineHash,
    currentBaselineHash: identity.currentBaselineHash, targetScope: { type: 'scene', id: identity.sceneId },
    reviewTransportAuthorityCapsule: { scenePathBySceneId: { [identity.sceneId]: scenePath },
      baselineFinalTextBySceneId: { [identity.sceneId]: 'portable sentence' } },
    reviewTransportReturnIntake: { authenticated: true, returnedArtifactSha256: identity.returnArtifactId,
      parserResult: { reviewIr: payload.reviewIr, parserProfileDigest: identity.parserProfileDigest,
        analysisDigest: identity.analysisDigest, authorityCarrier: { selectedCarrier: { payload: identity } } } } };
  const main = fs.readFileSync(path.join(REPO_ROOT, 'src/main.js'), 'utf8');
  const fn = main.match(/function buildDocxReviewPreviewSessionCommentShadowPayload\([^]*?\n}(?=\n|$)/)[0];
  const sandbox = vm.createContext({ isPlainObjectValue: v => !!v && typeof v === 'object' && !Array.isArray(v),
    cloneJsonSafe: v => JSON.parse(JSON.stringify(v)), docxReviewPreviewSessionDetailString: v => typeof v === 'string' ? v.trim() : '',
    computeHash: v => crypto.createHash('sha256').update(v).digest('hex') });
  vm.runInContext(fn, sandbox);
  const candidate = clock => ({ reviewPacket: { commentThreads: payload.reviewIr.commentThreads,
    commentPlacements: payload.reviewIr.commentThreads.map(thread => ({ threadId: thread.threadId,
      sourceCommentId: thread.commentId, createdAt: clock, targetScope: { type: 'scene', id: identity.sceneId },
      quote: thread.quotedAnchorText })) } });
  const firstCandidate = candidate('2026-09-27T01:00:00Z'), candidateBefore = JSON.stringify(firstCandidate);
  const build = value => sandbox.buildDocxReviewPreviewSessionCommentShadowPayload(context, value, 'request', bridge);
  const firstPayload = build(firstCandidate), secondPayload = build(candidate('2026-09-27T02:00:00Z'));
  assert.equal(firstPayload.sceneAuthorityIdentityJoin.ok, true);
  assert.equal(JSON.stringify(firstCandidate), candidateBefore, 'candidate is immutable');
  assert.equal(JSON.stringify(firstPayload.reviewIr), JSON.stringify(secondPayload.reviewIr));
  assert.equal(firstPayload.reviewIr.commentThreads[0].date, payload.reviewIr.commentThreads[0].date);
  const first = await mod.importRtkCommentShadowSession(firstPayload);
  assert.equal(first.ok, true, JSON.stringify(first));
  const before = [first.sessionPath, first.receiptPath, scenePath].map(p => [fs.readFileSync(p, 'utf8'), fs.statSync(p).mtimeMs]);
  const second = await mod.importRtkCommentShadowSession(secondPayload);
  assert.equal(second.code, 'RTK_ALREADY_ANALYZED');
  assert.equal(second.storageEffects.bytesWritten, 0);
  assert.deepEqual([first.sessionPath, first.receiptPath, scenePath].map(p => [fs.readFileSync(p, 'utf8'), fs.statSync(p).mtimeMs]), before);
  // Actual parser-owned placement metadata must never be normalized as a preview clock.
  context.reviewTransportReturnIntake.parserResult.reviewIr = { ...payload.reviewIr,
    commentPlacements: firstCandidate.reviewPacket.commentPlacements };
  assert.equal(build(candidate('2026-09-28T00:00:00Z')).reviewIr.commentPlacements[0].createdAt,
    '2026-09-27T01:00:00Z');
});

test('shadow identity binds complete IR, preserves legacy records, and still rejects record tampering', async t => {
  const crypto = require('node:crypto');
  const { stableJson } = await import(pathToFileURL(path.join(REPO_ROOT, 'src/io/revisionBridge/reviewTransportCore.mjs')).href);
  const digest = value => 'sha256:' + crypto.createHash('sha256').update(stableJson(value)).digest('hex');
  const projectRoot = makeProjectRoot();
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const mod = await loadModule(), payload = authenticatedPayload(projectRoot);
  const preview = mod.buildRtkCommentShadowSessionPreview(payload);
  assert.equal(preview.ok, true);
  const record = preview.session;
  const { schemaVersion, commandId, roundId, returnArtifactId, semanticReturnId, authenticatedReturnIdentity, commentShadowDigest } = record;
  const legacyKey = digest({ schemaVersion, commandId, roundId, returnArtifactId, semanticReturnId, authenticatedReturnIdentity, commentShadowDigest });
  const legacyEffect = digest({ roundId, semanticReturnId, authenticatedReturnIdentity, commentShadowDigest, lane: 'comments-shadow' });
  const legacyRecord = { ...record, requestKey: legacyKey, effectKey: legacyEffect };
  const legacySession = path.join(projectRoot, 'backups/revision-bridge-rtk-comment-shadow-sessions', legacyKey.slice(7) + '.json');
  const legacyReceipt = path.join(projectRoot, 'backups/revision-bridge-rtk-comment-shadow-receipts', legacyKey.slice(7) + '.json');
  for (const p of [legacySession, legacyReceipt]) fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(legacySession, JSON.stringify(legacyRecord));
  fs.writeFileSync(legacyReceipt, JSON.stringify({ requestKey: legacyKey, status: 'committed' }));
  const legacyBefore = [legacySession, legacyReceipt].map(p => [fs.readFileSync(p, 'utf8'), fs.statSync(p).mtimeMs]);
  const first = await mod.importRtkCommentShadowSession(payload);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.notEqual(first.session.requestKey, legacyKey);
  assert.notEqual(first.session.effectKey, legacyEffect);
  assert.deepEqual([legacySession, legacyReceipt].map(p => [fs.readFileSync(p, 'utf8'), fs.statSync(p).mtimeMs]), legacyBefore);
  const changed = JSON.parse(JSON.stringify(payload));
  changed.reviewIr.commentPlacements = [{ threadId: 'rtk-comment-root-1', paragraphIndex: 2 }];
  const next = await mod.importRtkCommentShadowSession(changed);
  assert.equal(next.ok, true);
  assert.notEqual(first.session.requestKey, next.session.requestKey);
  assert.notEqual(first.session.effectKey, next.session.effectKey);
  assert.equal(first.session.commentShadowDigest, next.session.commentShadowDigest, 'unchanged threads do not hide changed IR');
  const corrupt = JSON.parse(fs.readFileSync(first.sessionPath, 'utf8'));
  corrupt.threads[0].body = 'unauthorized disk mutation';
  fs.writeFileSync(first.sessionPath, JSON.stringify(corrupt));
  const corruptBefore = fs.readFileSync(first.sessionPath, 'utf8');
  const blocked = await mod.importRtkCommentShadowSession(payload);
  assert.equal(blocked.code, 'RTK_COMMAND_ENVELOPE_TAMPERED');
  assert.equal(fs.readFileSync(first.sessionPath, 'utf8'), corruptBefore);
  assert.equal(blocked.writerCalled, false);
});

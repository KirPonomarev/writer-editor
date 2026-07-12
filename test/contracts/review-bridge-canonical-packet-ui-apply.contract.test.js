const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const statusPath = 'docs/OPS/STATUS/REVIEW_BRIDGE_CANONICAL_PACKET_UI_APPLY_001_STATUS.json';

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('canonical Review Packet V1 schema keeps transport authority bounded', () => {
  const schema = JSON.parse(readRepoFile('docs/OPS/STATUS/REVIEW_PACKET_V1.schema.json'));

  assert.equal(schema.$id, 'urn:yalken:review-packet:v1');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.packetVersion.const, 'review-packet.v1');
  assert.deepEqual(schema.required, [
    'packetVersion',
    'projectId',
    'sessionId',
    'baselineHash',
    'reviewPacket',
  ]);
  assert.equal(schema.$defs.reviewPacket.additionalProperties, false);
  assert.deepEqual(schema.$defs.reviewPacket.required, [
    'commentThreads',
    'commentPlacements',
    'textChanges',
    'structuralChanges',
    'diagnosticItems',
    'decisionStates',
  ]);
  assert.equal(schema['x-authority'].transportOnly, true);
  assert.equal(schema['x-authority'].rendererWriteAuthority, false);
  assert.equal(schema['x-authority'].projectWriteAuthority, false);
  for (const forbidden of [
    'applyOps',
    'path',
    'plan',
    'projectRoot',
    'projectSnapshot',
    'receipt',
    'recovery',
    'revisionSession',
    'reviewSurface',
    'scenePath',
    'writeEffects',
  ]) {
    assert.equal(schema['x-authority'].forbiddenExternalFields.includes(forbidden), true);
  }
});

test('canonical Review Packet UI Apply status is rebound to merged delivery and stays claim-bounded', () => {
  const status = JSON.parse(readRepoFile(statusPath));

  assert.equal(status.taskId, 'REVIEW_BRIDGE_CANONICAL_PACKET_UI_APPLY_001');
  assert.equal(status.status, 'delivered_merged_verified');
  assert.equal(status.baseSha, '54ef43faae8c41be17765c6b0a0fa8688ebb4f95');
  assert.equal(status.scope.packetVersion, 'review-packet.v1');
  assert.equal(status.scope.rendererIntentOnly, true);
  assert.equal(status.scope.uiRedesign, false);
  assert.equal(status.scope.newDependenciesAdded, false);
  assert.equal(status.implementation.staleAsyncPlanSessionTokenGuard, true);
  assert.equal(status.delivery.status, 'delivered_merged_verified');
  assert.equal(status.delivery.commitSha, '5beb4ff48eb974b028254ce3283a59a649aff4a0');
  assert.equal(status.delivery.pullRequest, 1073);
  assert.equal(status.delivery.mergeSha, '980557a3f52772b2cc3bd1650e45165023659fed');
  assert.equal(status.delivery.mergedAtUtc, '2026-07-12T18:10:25Z');
  assert.equal(status.delivery.postMergeChecks.every((check) => check.status === 'pass'), true);
  assert.equal(status.negativeAcceptance.length, 9);
  assert.equal(status.nonClaims.some((claim) => /Crash reconciliation is not claimed/u.test(claim)), true);
  assert.equal(status.nonClaims.some((claim) => /No structural auto-apply/u.test(claim)), true);
});

test('main rebuilds ready or blocked exact plan from canonical disk truth', () => {
  const source = readRepoFile('src/main.js');

  assert.match(source, /const REVIEW_PACKET_V1_VERSION = 'review-packet\.v1';/u);
  assert.match(source, /packetVersion: REVIEW_PACKET_V1_VERSION/u);
  assert.match(source, /normalizeReviewPacketV1Transport\(parsed\.value\)/u);
  assert.match(source, /const REVIEW_PACKET_V1_REVIEW_GRAPH_KEYS = new Set\(\[/u);
  assert.match(source, /REVIEW_IMPORT_LOCAL_PACKET_REVIEW_PACKET_FIELDS_INVALID/u);
  assert.match(source, /await refreshActiveReviewExactTextUiPlan\(/u);
  assert.match(source, /async function handleWorkspaceReviewSurfaceQuery\(\) \{\s*await refreshActiveReviewExactTextUiPlan\(\);/u);
  assert.match(source, /reviewExactTextUiPlanSessionTokenMatchesCurrent\(expectedToken\)/u);
  assert.match(
    source,
    /const REVIEW_EXACT_TEXT_APPLY_ALLOWED_DOCUMENT_KINDS = new Set\(\[\s*'scene',\s*'chapter-file',\s*'roman-section',\s*\]\);/u,
  );
  assert.equal(
    (source.match(/REVIEW_EXACT_TEXT_APPLY_ALLOWED_DOCUMENT_KINDS\.has\(documentContext\.kind\)/gu) || []).length,
    2,
  );
  assert.equal((source.match(/baselineHash: computeHash\(sceneText\)/gu) || []).length, 2);
  const allowedKeysStart = source.indexOf('const REVIEW_PACKET_V1_ALLOWED_TOP_LEVEL_KEYS');
  const allowedKeysEnd = source.indexOf('const REVIEW_IMPORT_LOCAL_PACKET_ALLOWED_PAYLOAD_KEYS', allowedKeysStart);
  assert.ok(allowedKeysStart > -1 && allowedKeysEnd > allowedKeysStart);
  assert.equal(source.slice(allowedKeysStart, allowedKeysEnd).includes("'reviewSurface'"), false);
});

test('existing Review UI exposes Apply only from a main-owned ready plan', () => {
  const source = readRepoFile('src/renderer/editor.js');
  const start = source.indexOf('function reviewSurfaceBuildExactTextPreview');
  const end = source.indexOf('function buildReviewSurfaceViewModel', start);
  assert.ok(start > -1 && end > start);
  const previewSection = source.slice(start, end);

  assert.match(previewSection, /exactPreview\.status === 'ready'/u);
  assert.match(previewSection, /const applyOpsRaw = reviewSurfaceArray\(exactPreview\.plan\?\.applyOps\)/u);
  assert.match(previewSection, /applyDisabled: applyState !== 'ready'/u);

  const clickStart = source.indexOf('async function handleReviewSurfaceExactTextApplyClick');
  const clickEnd = source.indexOf('function bindReviewSurfaceApplyActions', clickStart);
  assert.ok(clickStart > -1 && clickEnd > clickStart);
  const clickSection = source.slice(clickStart, clickEnd);
  assert.match(clickSection, /reviewSurfaceBuildExactTextApplyPayload\(requestId, changeId\)/u);
  assert.doesNotMatch(clickSection, /applyOps|scenePath|projectRoot|projectSnapshot|receipt/u);
});

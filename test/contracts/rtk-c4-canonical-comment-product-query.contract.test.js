'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

test('C4 canonical comment product query is registered as a main-owned read projection', () => {
  const registry = read('src/shared/workspaceQueryRegistry.cjs');
  const main = read('src/main.js');

  assert.match(registry, /RTK_NON_TEXT_RETURN_STATE:\s*'query\.rtkNonTextReturnState'/u);
  assert.match(registry, /owner:\s*'main',\s*projection:\s*'rtk-non-text-return-state'/u);
  assert.match(main, /RTK_NON_TEXT_RETURN_STATE_QUERY_ID\s*=\s*WORKSPACE_QUERY_IDS\.RTK_NON_TEXT_RETURN_STATE/u);
  assert.match(main, /\[RTK_NON_TEXT_RETURN_STATE_QUERY_ID,\s*handleWorkspaceRtkNonTextReturnStateQuery\]/u);
  assert.match(main, /canonicalCommentProjection\s*=\s*handleWorkspaceRtkNonTextReturnStateQuery\(\)/u);
});

test('C4 canonical comment query exposes product truth fields without becoming an optional packaged query', () => {
  const main = read('src/main.js');
  const profile = read('src/core/writer-local-profile-v1.cjs');

  assert.match(main, /schemaVersion:\s*'yalken\.rtk\.nonTextReturnStateProjection\.v1'/u);
  assert.match(main, /openRootCommentCount:\s*threads\.filter/u);
  assert.match(main, /rootBodySha256:\s*rootMessage\?\.body\s*\?\s*computeHash\(rootMessage\.body\)/u);
  assert.match(main, /blockId:\s*docxReviewPreviewSessionDetailString\(anchor\.blockId\)/u);
  assert.match(main, /paragraphIndex:\s*Number\.isSafeInteger\(anchor\.paragraphIndex\)/u);
  assert.match(main, /selectedTextSha256:\s*docxReviewPreviewSessionDetailString\(anchor\.selectedTextSha256\)/u);
  assert.match(main, /RTK_CANONICAL_COMMENT_REOPENED_FROM_PRODUCT_TRUTH/u);
  assert.doesNotMatch(profile, /'query\.rtkNonTextReturnState'/u);
});

test('C4 activation carries text-change block authority into comment canonical apply', async () => {
  const main = read('src/main.js');
  const { buildAuthenticatedCommentReturnCommands } = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');

  assert.match(main, /textChanges:\s*Array\.isArray\(candidate\?\.reviewPacket\?\.textChanges\)/u);
  assert.match(main, /attachProductTextChangesToDocxCommentShadowPayload/u);
  assert.match(main, /commentShadowPayload:\s*attachProductTextChangesToDocxCommentShadowPayload/u);
  const sceneId = 'scene-c4';
  const input = {
    authenticated: true, projectId: 'project-c4', projectRoot: REPO_ROOT,
    returnArtifactId: 'sha256:' + 'a'.repeat(64),
    localAuthorityCapsule: {
      projectRoot: REPO_ROOT,
      scenePathBySceneId: { [sceneId]: path.join(REPO_ROOT, 'synthetic-unused-scene.txt') },
      baselineFinalTextBySceneId: { [sceneId]: 'sentinel alpha' },
    },
    reviewIr: {
      textChanges: [{
        changeId: 'replacement-c4', targetScope: { type: 'scene', id: sceneId },
        replacementText: 'sentinel omega', paragraphIndex: 0, nativeReplacementGroupId: 'group-c4',
        match: { quote: 'sentinel alpha', blockId: 'block-c4', paragraphIndex: 0 },
      }],
      commentThreads: [{ threadId: 'thread-c4', commentId: '0', sourceCommentId: '0',
        messages: [{ messageId: 'root-c4', body: 'Synthetic anchored comment.' }] }],
      commentPlacements: [{
        threadId: 'thread-c4', sourceCommentId: '0', nativeCommentId: '0',
        targetScope: { type: 'scene', id: sceneId }, quote: 'omegasentinel',
        relatedReplacementGroupId: 'group-c4', relatedReplacementGroupMode: 'CROSS_REPLACEMENT',
        sceneAuthority: { blockId: 'block-c4', paragraphIndex: 0 },
      }],
    },
  };
  const result = buildAuthenticatedCommentReturnCommands(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  const command = result.commands.find(item => item.family === 'root_comment');
  assert.equal(command.payload.selectedText, 'sentinel omega');
  assert.equal(command.payload.rawParserQuote, 'omegasentinel');
  assert.equal(command.payload.anchor.blockId, 'block-c4');
  assert.equal(command.payload.anchor.authoritySource, 'rtk-non-overlap-product-replacement-authority');
  input.reviewIr.commentPlacements[0].relatedReplacementGroupId = 'unrelated-group';
  const refused = buildAuthenticatedCommentReturnCommands(input);
  assert.equal(refused.ok, false);
  assert.equal(refused.commands.length, 0);
});

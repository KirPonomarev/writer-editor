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

test('C4 activation carries text-change block authority into comment canonical apply', () => {
  const main = read('src/main.js');
  const runtime = read('src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');

  assert.match(main, /textChanges:\s*Array\.isArray\(candidate\?\.reviewPacket\?\.textChanges\)/u);
  assert.match(main, /attachProductTextChangesToDocxCommentShadowPayload/u);
  assert.match(main, /commentShadowPayload:\s*attachProductTextChangesToDocxCommentShadowPayload/u);
  assert.match(runtime, /sourceTextChange\s*=\s*textChanges\.find/u);
  assert.match(runtime, /replacementText\s*===\s*selectedText/u);
  assert.match(runtime, /blockId\s*=\s*normalizeString\(placementAuthority\.blockId\s*\|\|\s*placement\.blockId\s*\|\|\s*sourceTextChange\?\.match\?\.blockId\)/u);
  assert.match(runtime, /authoritySource\s*=\s*normalizeString\(placement\.sceneAuthoritySource\)[\s\S]*'rtk-non-overlap-product-replacement-authority'/u);
});

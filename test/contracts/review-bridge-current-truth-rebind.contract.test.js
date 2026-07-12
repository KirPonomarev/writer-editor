const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('review packet export status is rebound to merged mainline truth', () => {
  const status = JSON.parse(
    readRepoFile('docs/OPS/STATUS/REVIEW_BRIDGE_LOCAL_PACKET_EXPORT_001_STATUS.json'),
  );

  assert.equal(status.status, 'delivered_merged_verified');
  assert.equal(status.delivery.status, 'delivered_merged_verified');
  assert.equal(status.delivery.commitSha, 'e8140e856551802e87b21f45772ffef8140c3782');
  assert.equal(status.delivery.pullRequest, 1070);
  assert.equal(status.delivery.mergeSha, 'a4583bb79e72e5c03b4acd1e1340c80af31a85ca');
});

test('active factual docs carry one non-stale closure classification', () => {
  for (const relativePath of ['docs/CONTEXT.md', 'docs/HANDOFF.md']) {
    const content = readRepoFile(relativePath);

    assert.match(content, /PR `1070` at merge SHA `a4583bb79e72e5c03b4acd1e1340c80af31a85ca`/u);
    assert.match(content, /canonical Review Packet import to real Review UI exact apply is implemented but unbound/u);
    assert.match(content, /DOCX Review is evidence only/u);
    assert.match(content, /local Markdown file product flow is partial product flow/u);
    assert.match(content, /project-level cross-scene apply are deferred/u);
    assert.doesNotMatch(content, /Local branch pending-delivery contour `REVIEW_BRIDGE_LOCAL_PACKET_EXPORT_001`/u);
    assert.doesNotMatch(content, /Current branch local pending-delivery contour `REVIEW_BRIDGE_LOCAL_PACKET_EXPORT_001`/u);
  }

  assert.match(readRepoFile('docs/HANDOFF.md'), /_Generated: 2026-07-12_/u);
});

"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {pathToFileURL} = require('node:url');

const ROOT = path.resolve(__dirname, '../..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('Word reader successor requires the exact certified current-head binding', async () => {
  const {validateManuscriptReaderSuccessor: check} =
    await import(pathToFileURL(path.join(ROOT, 'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
  const reader = 'scripts/ops/rtk-interop-word-manuscript-batch.mjs';
  const binding = {path: reader, sha256: '38efdabcb3305a726c4f63e6b47b684d93042b16c2c711c029ca34ff13d93717'};
  const currentHead = 'a'.repeat(40);
  const actualSha256 = digest(await fs.readFile(path.join(ROOT, reader)));
  const certification = {
    status: 'PASS', baseSha: 'a4d186e026af0d532c73d2108e5369252302574b',
    candidateSha: currentHead, cellAcceptanceAuthority: false,
    bindings: [
      {path: reader, sha256: actualSha256},
      {path: 'test/contracts/rtk-interop-word-manuscript-promotion.contract.test.js', sha256: 'b'.repeat(64)},
    ],
  };
  assert.doesNotThrow(() => check({binding, actualSha256, certification, currentHead}));
  const rejected = [
    {binding: {...binding, sha256: '0'.repeat(64)}},
    {binding: {...binding, path: 'scripts/ops/other.mjs'}},
    {actualSha256: '0'.repeat(64)},
    {certification: {...certification, status: 'FAIL'}},
    {certification: {...certification, candidateSha: 'c'.repeat(40)}},
    {certification: {...certification, cellAcceptanceAuthority: true}},
    {certification: {...certification, bindings: certification.bindings.slice(0, 1)}},
  ];
  for (const overrides of rejected)
    assert.throws(() => check({binding, actualSha256, certification, currentHead, ...overrides}),
      /MANUSCRIPT_BATCH_READER_(?:PIN|SUCCESSOR_CERT)/);
});

test('Manuscript promotion admits only the exact inspected C4 successor blobs', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'manuscript-exact-successor-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  git('init');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Yalken Test');
  await fs.writeFile(path.join(root, 'oracle.txt'), 'before\n');
  git('add', '.');
  git('commit', '-m', 'runtime');
  const identity = () => ({head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}')});
  const runtimeIdentity = identity();
  const {validateManuscriptVerifierPromotion: check, MANUSCRIPT_PROMOTION_EXACT_SUCCESSOR_BINDINGS: bindings} =
    await import(pathToFileURL(path.join(ROOT, 'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
  assert.equal(bindings.length, 2);
  for (const binding of bindings) {
    const target = path.join(root, binding.path);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.copyFile(path.join(ROOT, binding.path), target);
    assert.equal(digest(await fs.readFile(target)), binding.sha256);
  }
  const certificationCarrier = 'scripts/ops/r24/corrective/post-audit-certification-set.mjs';
  await fs.mkdir(path.join(root, path.dirname(certificationCarrier)), {recursive: true});
  await fs.copyFile(path.join(ROOT, certificationCarrier), path.join(root, certificationCarrier));
  const promotionContract = 'test/contracts/rtk-interop-word-manuscript-promotion.contract.test.js';
  await fs.mkdir(path.join(root, path.dirname(promotionContract)), {recursive: true});
  await fs.copyFile(path.join(ROOT, promotionContract), path.join(root, promotionContract));
  await fs.writeFile(path.join(root, 'oracle.txt'), 'after\n');
  git('add', '.');
  git('commit', '-m', 'exact successor');
  assert.deepEqual(check({repoRoot: root, runtimeIdentity, verifierIdentity: identity(), allowedPaths: ['oracle.txt']}),
    ['oracle.txt', certificationCarrier, promotionContract, ...bindings.map(binding => binding.path)].sort());
  await fs.appendFile(path.join(root, bindings[1].path), '\n// altered after exact admission\n');
  git('add', '.');
  git('commit', '-m', 'alter pinned product code');
  assert.throws(() => check({repoRoot: root, runtimeIdentity, verifierIdentity: identity(), allowedPaths: ['oracle.txt']}), /PROMOTION_PIN/);
  await fs.writeFile(path.join(root, 'unlisted-product.js'), 'unreviewed\n');
  git('add', '.');
  git('commit', '-m', 'unlisted product change');
  assert.throws(() => check({repoRoot: root, runtimeIdentity, verifierIdentity: identity(), allowedPaths: ['oracle.txt']}), /PROMOTION_SCOPE/);
});

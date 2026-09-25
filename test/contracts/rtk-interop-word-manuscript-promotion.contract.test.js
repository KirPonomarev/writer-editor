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

for(const era of ['C1','REVIEW','HOSTILE','MEDIA','REOPEN','TABLE_FILES','IMPORT_TRANSACTION','IMPORT_LOSS','MEDIA_DISPLAY'])test(era+' Word reader successor admits one complete set and rejects mixed or altered bindings', async () => {
  const cert = await import(pathToFileURL(path.join(ROOT, 'scripts/ops/r24/corrective/post-audit-certification-set.mjs')));
  const expected = era==='C1'?cert.R24_INTEROP_WORD_TABLES_C1_SUCCESSOR:era==='REVIEW'?cert.R24_INTEROP_WORD_TABLES_REVIEW_SUCCESSOR:era==='HOSTILE'?cert.R24_INTEROP_WORD_HOSTILE_SUCCESSOR:era==='MEDIA'?cert.R24_INTEROP_WORD_MEDIA_SUCCESSOR:era==='REOPEN'?cert.R24_INTEROP_WORD_NATIVE_REOPEN_SUCCESSOR:era==='TABLE_FILES'?cert.R24_INTEROP_WORD_TABLE_FILES_SUCCESSOR:era==='IMPORT_TRANSACTION'?cert.R24_INTEROP_WORD_IMPORT_TRANSACTION_SUCCESSOR:era==='IMPORT_LOSS'?cert.R24_INTEROP_WORD_IMPORT_LOSS_SUCCESSOR:cert.R24_INTEROP_WORD_MEDIA_DISPLAY_SUCCESSOR, candidate = 'f'.repeat(40);
  const historicalHead = era==='C1'?'3a5f0b2080e861d779cf5838a2a34c6e7d5e4244':era==='REVIEW'?'3dbe5404aad3b583fdbf929f2b49cf016f819fc6':era==='HOSTILE'?'1c9dae7a3dcdc3fc79e22ea9b53b0c2ca67bcd5d':era==='MEDIA'?'ccc9b4b02db839241405f2667313c8ec5450455e':era==='REOPEN'?'58c408eb9799d65194d0081a8a45c509af8706ac':era==='TABLE_FILES'?'46e050b21b472cb76e2892cc7415b58ebaf0f299':era==='IMPORT_TRANSACTION'?'1c965edc894dcd07a6338f301051b030c1d14d3b':era==='IMPORT_LOSS'?'e1f04e3502af17e0feead89a61f2e6d545132a64':null;
  const bytes = new Map(await Promise.all([...expected.bindings, ...expected.guards].map(async b => [b.path, historicalHead?execFileSync('git',['show',historicalHead+':'+b.path],{cwd:ROOT}):await fs.readFile(path.join(ROOT, b.path))])));
  const git = args => {
    if (args[0] === 'rev-parse') {
      for (const set of [cert.R24_INTEROP_WORD_PROMOTION_SUCCESSOR,cert.R24_INTEROP_WORD_TABLES_C1_SUCCESSOR,cert.R24_INTEROP_WORD_TABLES_REVIEW_SUCCESSOR,cert.R24_INTEROP_WORD_HOSTILE_SUCCESSOR,cert.R24_INTEROP_WORD_MEDIA_SUCCESSOR,cert.R24_INTEROP_WORD_NATIVE_REOPEN_SUCCESSOR,cert.R24_INTEROP_WORD_TABLE_FILES_SUCCESSOR,cert.R24_INTEROP_WORD_IMPORT_TRANSACTION_SUCCESSOR,cert.R24_INTEROP_WORD_IMPORT_LOSS_SUCCESSOR,cert.R24_INTEROP_WORD_MEDIA_DISPLAY_SUCCESSOR]) {
        if (args[1] === set.baseSha + '^{tree}') return set.baseTree;
        if (args[1] === set.successorBaseSha + '^{tree}') return set.successorBaseTree;
      }
      return candidate;
    }
    if (args[0] === 'merge-base') return '';
    if (args[0] === 'show') { const b = bytes.get(args[1].slice(41)); if (!b) throw new Error('missing'); return b; }
    throw new Error(args.join(' '));
  };
  const result = cert.verifyR24InteropWordPromotionSuccessor({ git });
  assert.equal(result.status, 'PASS'); assert.equal(result.cellAcceptanceAuthority, false);
  assert.equal(result.baseSha, cert.R24_INTEROP_WORD_PROMOTION_SUCCESSOR.baseSha);
  assert.equal(result.bindings.length, 2);
  for (const binding of [...expected.bindings, ...expected.guards]) {
    const original = bytes.get(binding.path); bytes.set(binding.path, Buffer.concat([original, Buffer.from('\n')]));
    assert.throws(() => cert.verifyR24InteropWordPromotionSuccessor({ git }), /E_INTEROP_WORD_PROMOTION_PIN/);
    bytes.set(binding.path, original);
  }
  // These eras change Lab admission only; their runtime reader is unchanged.
  if (!['REOPEN','TABLE_FILES','IMPORT_TRANSACTION','IMPORT_LOSS','MEDIA_DISPLAY'].includes(era)) {
  bytes.set(expected.bindings[0].path, execFileSync('git', ['show', expected.successorBaseSha + ':' + expected.bindings[0].path], { cwd: ROOT }));
  assert.throws(() => cert.verifyR24InteropWordPromotionSuccessor({ git }), /E_INTEROP_WORD_PROMOTION_PIN/);
  }
});

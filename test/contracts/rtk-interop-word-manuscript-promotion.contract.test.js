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

test('Manuscript promotion admits only exact inspected C4 and Word proof successor blobs', async t => {
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
  assert.equal(bindings.length, 4);
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
  for (const binding of bindings.slice(2)) {
    const target = path.join(root, binding.path), original = await fs.readFile(target);
    await fs.appendFile(target, '\n# changed after review\n');
    git('add', '.'); git('commit', '-m', 'alter exact proof successor');
    assert.throws(() => check({repoRoot: root, runtimeIdentity, verifierIdentity: identity(), allowedPaths: ['oracle.txt']}), /PROMOTION_PIN/);
    await fs.writeFile(target, original); git('add', '.'); git('commit', '-m', 'restore exact proof successor');
  }
  await fs.appendFile(path.join(root, bindings[1].path), '\n// altered after exact admission\n');
  git('add', '.');
  git('commit', '-m', 'alter pinned product code');
  assert.throws(() => check({repoRoot: root, runtimeIdentity, verifierIdentity: identity(), allowedPaths: ['oracle.txt']}), /PROMOTION_PIN/);
  await fs.writeFile(path.join(root, 'unlisted-product.js'), 'unreviewed\n');
  git('add', '.');
  git('commit', '-m', 'unlisted product change');
  assert.throws(() => check({repoRoot: root, runtimeIdentity, verifierIdentity: identity(), allowedPaths: ['oracle.txt']}), /PROMOTION_SCOPE/);
});

for(const era of ['C1','REVIEW','HOSTILE','MEDIA','REOPEN','TABLE_FILES','IMPORT_TRANSACTION','IMPORT_LOSS','MEDIA_DISPLAY','MEDIA_TEXT','TABLE_PROPERTIES','COMPOSITE_FIDELITY','CURRENT_STRUCTURE','MACOS27','IMPORT_CONTRACT','PROOF_SUCCESSOR','READER_PIN','INLINE_ATOMS','VISIBILITY_RUBY','HTTP_LINKS','ROUND_KEY_DURABILITY','CLEAN_LINK_LABEL','STRUCTURAL_TRANSACTION','AUTHORED_TOPOLOGY','LINK_LABEL_CONTEXT'])test(era+' Word reader successor admits one complete set and rejects mixed or altered bindings', async () => {
  const cert = await import(pathToFileURL(path.join(ROOT, 'scripts/ops/r24/corrective/post-audit-certification-set.mjs')));
  const expected = era==='C1'?cert.R24_INTEROP_WORD_TABLES_C1_SUCCESSOR:era==='REVIEW'?cert.R24_INTEROP_WORD_TABLES_REVIEW_SUCCESSOR:era==='HOSTILE'?cert.R24_INTEROP_WORD_HOSTILE_SUCCESSOR:era==='MEDIA'?cert.R24_INTEROP_WORD_MEDIA_SUCCESSOR:era==='REOPEN'?cert.R24_INTEROP_WORD_NATIVE_REOPEN_SUCCESSOR:era==='TABLE_FILES'?cert.R24_INTEROP_WORD_TABLE_FILES_SUCCESSOR:era==='IMPORT_TRANSACTION'?cert.R24_INTEROP_WORD_IMPORT_TRANSACTION_SUCCESSOR:era==='IMPORT_LOSS'?cert.R24_INTEROP_WORD_IMPORT_LOSS_SUCCESSOR:era==='MEDIA_DISPLAY'?cert.R24_INTEROP_WORD_MEDIA_DISPLAY_SUCCESSOR:era==='MEDIA_TEXT'?cert.R24_INTEROP_WORD_MEDIA_TEXT_SUCCESSOR:era==='TABLE_PROPERTIES'?cert.R24_INTEROP_WORD_TABLE_PROPERTIES_SUCCESSOR:era==='COMPOSITE_FIDELITY'?cert.R24_INTEROP_WORD_COMPOSITE_FIDELITY_SUCCESSOR:era==='CURRENT_STRUCTURE'?cert.R24_INTEROP_WORD_CURRENT_STRUCTURE_SUCCESSOR:era==='MACOS27'?cert.R24_INTEROP_WORD_MACOS27_SUCCESSOR:era==='IMPORT_CONTRACT'?cert.R24_INTEROP_WORD_IMPORT_CONTRACT_SUCCESSOR:era==='PROOF_SUCCESSOR'?cert.R24_INTEROP_WORD_PROOF_SUCCESSOR:era==='READER_PIN'?cert.R24_INTEROP_WORD_READER_PIN_SUCCESSOR:era==='INLINE_ATOMS'?cert.R24_INTEROP_WORD_INLINE_ATOMS_SUCCESSOR:era==='VISIBILITY_RUBY'?cert.R24_INTEROP_WORD_VISIBILITY_RUBY_SUCCESSOR:era==='HTTP_LINKS'?cert.R24_INTEROP_WORD_HTTP_LINKS_SUCCESSOR:era==='ROUND_KEY_DURABILITY'?cert.R24_INTEROP_WORD_ROUND_KEY_DURABILITY_SUCCESSOR:era==='CLEAN_LINK_LABEL'?cert.R24_INTEROP_WORD_CLEAN_LINK_LABEL_SUCCESSOR:era==='STRUCTURAL_TRANSACTION'?cert.R24_INTEROP_WORD_STRUCTURAL_TRANSACTION_SUCCESSOR:era==='AUTHORED_TOPOLOGY'?cert.R24_INTEROP_WORD_AUTHORED_TOPOLOGY_SUCCESSOR:cert.R24_INTEROP_WORD_LINK_LABEL_CONTEXT_SUCCESSOR, candidate = 'f'.repeat(40);
  const historicalHead = era==='C1'?'3a5f0b2080e861d779cf5838a2a34c6e7d5e4244':era==='REVIEW'?'3dbe5404aad3b583fdbf929f2b49cf016f819fc6':era==='HOSTILE'?'1c9dae7a3dcdc3fc79e22ea9b53b0c2ca67bcd5d':era==='MEDIA'?'ccc9b4b02db839241405f2667313c8ec5450455e':era==='REOPEN'?'58c408eb9799d65194d0081a8a45c509af8706ac':era==='TABLE_FILES'?'46e050b21b472cb76e2892cc7415b58ebaf0f299':era==='IMPORT_TRANSACTION'?'1c965edc894dcd07a6338f301051b030c1d14d3b':era==='IMPORT_LOSS'?'e1f04e3502af17e0feead89a61f2e6d545132a64':era==='MEDIA_DISPLAY'?'87dee08ecc5c4f19955089a6501f30a3af04156a':era==='MEDIA_TEXT'?'e53782a9d1fdbae35dcb11d8df5d5f8ca54a0eeb':era==='TABLE_PROPERTIES'?'b6986aea3db5eae54357041f284b0d6f0d63e032':era==='COMPOSITE_FIDELITY'?'10a21a9394f13e058cac248e2d4f4c0f86a9263f':era==='CURRENT_STRUCTURE'?'735a5d24251ff9fcd44ede60a4bc822d4ba815a1':era==='MACOS27'?'de3cc7a3ec7ad3e83a4f9a78376fccff78207a5d':era==='IMPORT_CONTRACT'?'1c74b5af75e1bfb9d9ced3fa7bbe578d7c7059d9':era==='PROOF_SUCCESSOR'?'b84dcd1f64981e1bb4609e037b539b03c9091656':era==='READER_PIN'?'23adf37d73fe58b243750e8bf8e2acf74d3de90e':era==='INLINE_ATOMS'?'14754f850a389118df18ee50a7f8a48cde408455':era==='VISIBILITY_RUBY'?'396938247b5480dc24d4c5d4d01b744a6dc13e82':era==='HTTP_LINKS'?'1dd99f79e52828a1b3915d5fa75d9a8ce4a03790':era==='ROUND_KEY_DURABILITY'?'4a42bad70288e8d91ff6742b1ffa97f0072daecf':era==='CLEAN_LINK_LABEL'?'9437d42566c9122ea8cdc7664491c5e561c0c6c3':era==='STRUCTURAL_TRANSACTION'?'d73927fa3331a90e6c33864e09ab9a6c3062e377':era==='AUTHORED_TOPOLOGY'?'911cb1e7151096396ef0c8a6d1e3408687f18b52':null;
  const bytes = new Map(await Promise.all([...expected.bindings, ...expected.guards].map(async b => [b.path, historicalHead?execFileSync('git',['show',historicalHead+':'+b.path],{cwd:ROOT}):await fs.readFile(path.join(ROOT, b.path))])));
  const git = args => {
    if (args[0] === 'rev-parse') {
      for (const set of [cert.R24_INTEROP_WORD_PROMOTION_SUCCESSOR,cert.R24_INTEROP_WORD_TABLES_C1_SUCCESSOR,cert.R24_INTEROP_WORD_TABLES_REVIEW_SUCCESSOR,cert.R24_INTEROP_WORD_HOSTILE_SUCCESSOR,cert.R24_INTEROP_WORD_MEDIA_SUCCESSOR,cert.R24_INTEROP_WORD_NATIVE_REOPEN_SUCCESSOR,cert.R24_INTEROP_WORD_TABLE_FILES_SUCCESSOR,cert.R24_INTEROP_WORD_IMPORT_TRANSACTION_SUCCESSOR,cert.R24_INTEROP_WORD_IMPORT_LOSS_SUCCESSOR,cert.R24_INTEROP_WORD_MEDIA_DISPLAY_SUCCESSOR,cert.R24_INTEROP_WORD_MEDIA_TEXT_SUCCESSOR,cert.R24_INTEROP_WORD_TABLE_PROPERTIES_SUCCESSOR,cert.R24_INTEROP_WORD_COMPOSITE_FIDELITY_SUCCESSOR,cert.R24_INTEROP_WORD_CURRENT_STRUCTURE_SUCCESSOR,cert.R24_INTEROP_WORD_MACOS27_SUCCESSOR,cert.R24_INTEROP_WORD_IMPORT_CONTRACT_SUCCESSOR,cert.R24_INTEROP_WORD_PROOF_SUCCESSOR,cert.R24_INTEROP_WORD_READER_PIN_SUCCESSOR,cert.R24_INTEROP_WORD_INLINE_ATOMS_SUCCESSOR,cert.R24_INTEROP_WORD_VISIBILITY_RUBY_SUCCESSOR,cert.R24_INTEROP_WORD_HTTP_LINKS_SUCCESSOR,cert.R24_INTEROP_WORD_ROUND_KEY_DURABILITY_SUCCESSOR,cert.R24_INTEROP_WORD_CLEAN_LINK_LABEL_SUCCESSOR,cert.R24_INTEROP_WORD_STRUCTURAL_TRANSACTION_SUCCESSOR,cert.R24_INTEROP_WORD_AUTHORED_TOPOLOGY_SUCCESSOR,cert.R24_INTEROP_WORD_LINK_LABEL_CONTEXT_SUCCESSOR]) {
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
  if (!['REOPEN','TABLE_FILES','IMPORT_TRANSACTION','IMPORT_LOSS','MEDIA_DISPLAY','MEDIA_TEXT','TABLE_PROPERTIES','COMPOSITE_FIDELITY','CURRENT_STRUCTURE','MACOS27','IMPORT_CONTRACT','PROOF_SUCCESSOR','READER_PIN','INLINE_ATOMS','VISIBILITY_RUBY','HTTP_LINKS','ROUND_KEY_DURABILITY','CLEAN_LINK_LABEL','STRUCTURAL_TRANSACTION','AUTHORED_TOPOLOGY','LINK_LABEL_CONTEXT'].includes(era)) {
  bytes.set(expected.bindings[0].path, execFileSync('git', ['show', expected.successorBaseSha + ':' + expected.bindings[0].path], { cwd: ROOT }));
  assert.throws(() => cert.verifyR24InteropWordPromotionSuccessor({ git }), /E_INTEROP_WORD_PROMOTION_PIN/);
  }
});

 test('Current physical Word runtime promotes through the actual PR1996 and PR1997 changed-file chain', async () => {
  const {validateManuscriptVerifierPromotion: check} = await import(pathToFileURL(path.join(ROOT, 'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
  const policy = JSON.parse(await fs.readFile(path.join(ROOT, 'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json'), 'utf8'));
  const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
  const identity = head => ({head, tree: git('rev-parse', head + '^{tree}')});
  const runtime = '735a5d24251ff9fcd44ede60a4bc822d4ba815a1', verifier = '1c74b5af75e1bfb9d9ced3fa7bbe578d7c7059d9';
  const changed = check({runtimeIdentity: identity(runtime), verifierIdentity: identity(verifier), allowedPaths: policy.wordManuscriptBatch.verifierPromotionPaths});
  assert.ok(changed.includes('scripts/ops/rtk-interop-word-tables-readback.py'));
  assert.ok(changed.includes('test/contracts/revision-bridge-docx-import-e2e-command-chain.contract.test.js'));
  assert.equal(git('diff', '--name-only', runtime, verifier, '--', 'src', 'package.json', 'package-lock.json'), '');
 });

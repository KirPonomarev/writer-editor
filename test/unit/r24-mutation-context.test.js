'use strict';
// Finite oracle controls and actual original-file Node child controls.
// Focused controls do not replace any of the 194 mandatory mutation cases.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'scripts/ops/r24');
const api = import(pathToFileURL(path.join(dir, 'mutation-context.mjs')).href);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const child = (plan, args) => api.then(({ mutationPreload }) => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.YALKEN_TEST_EVIDENCE_DIR;
  return spawnSync(process.execPath, ['--import', mutationPreload(plan), '--test', ...args],
    { cwd: dir, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
});
function finite(plan, { fail = false, code = 'ERR_ASSERTION' } = {}) {
  return { status: fail ? 1 : 0, signal: null, stderr: '',
    stdout: 'TAP version 13\n# R24_MUTATION_LOADED=' + JSON.stringify(plan) + '\n'
      + '# Subtest: finite semantic contract\n' + (fail ? 'not ok' : 'ok') + ' 1 - finite semantic contract\n'
      + (fail ? "  ---\n  failureType: 'testCodeFailure'\n  code: '" + code + "'\n  ...\n" : '')
      + '1..1\n# tests 1\n# pass ' + (fail ? '0' : '1') + '\n# fail ' + (fail ? '1' : '0')
      + '\n# cancelled 0\n# skipped 0\n# todo 0\n' };
}
test('R24 mutation plan refuses paths, stale hashes, unchanged or ambiguous replacements', async () => {
  const { createMutationPlan, mutationPreload } = await api;
  for (const file of ['../toolchain.mjs', '/tmp/toolchain.mjs', 'test-mutants.mjs', 'mutation-context.mjs']) {
    assert.throws(() => createMutationPlan({ file, find: 'x', replace: 'y' }), /TARGET_INVALID/);
  }
  const plan = createMutationPlan();
  assert.throws(() => mutationPreload({ ...plan, baseSha256: '0'.repeat(64) }), /SOURCE_DRIFT/);
  assert.throws(() => mutationPreload({ ...plan, mutantSha256: '0'.repeat(64) }), /CONTROL_CHANGED/);
  assert.throws(() => createMutationPlan({ file: 'canonical-json.mjs', find: 'return', replace: 'return ' }), /AMBIGUOUS/);
  assert.throws(() => createMutationPlan({ file: 'canonical-json.mjs', find: 'no such exact anchor', replace: 'x' }), /MISSING/);
});
test('R24 original-context unmodified actual toolchain case stays green with the real hook', async () => {
  const { createMutationPlan, evaluateMutationRun } = await api;
  const plan = createMutationPlan();
  const result = await child(plan, ['--test-name-pattern', '^Q0 integration: live repo satisfies the toolchain contract$',
    path.join(dir, 'tests/q0/integration-q0.test.mjs')]);
  const proof = evaluateMutationRun(result, plan);
  assert.equal(proof.verdict, 'PASS', JSON.stringify(proof) + result.stdout + result.stderr);
  assert.equal(proof.tap.tests, 1);
  assert.ok(proof.loadedCount > 0);
});
test('R24 actual original canonical cohort kills an original semantic mutant without source writes', async () => {
  const { createMutationPlan, evaluateMutationRun } = await api;
  const before = fs.readFileSync(path.join(dir, 'canonical-json.mjs'));
  const control = createMutationPlan();
  const files = [path.join(dir, 'tests/canonical-json.test.mjs')];
  const baseline = evaluateMutationRun(await child(control, files), control);
  assert.equal(baseline.verdict, 'PASS', JSON.stringify(baseline));
  const definitions = await import(pathToFileURL(path.join(dir, 'test-mutants.mjs')).href);
  const original = definitions.MUTANTS.find(row => row.id === 'canon-key-order-nondeterministic');
  assert.ok(original);
  const plan = createMutationPlan(original);
  const raw = await child(plan, files);
  const result = evaluateMutationRun(raw, plan, baseline);
  assert.equal(result.verdict, 'KILLED', JSON.stringify(result) + raw.stdout + raw.stderr);
  assert.ok(result.failedCases.length > 0);
  assert.equal(fs.readFileSync(path.join(dir, 'canonical-json.mjs')).equals(before), true);
});
test('R24 finite semantic assertion fail counts only with exact complete cohort and load identity', async () => {
  const { createMutationPlan, evaluateMutationRun } = await api;
  const plan = createMutationPlan();
  const baseline = evaluateMutationRun(finite(plan), plan);
  assert.equal(baseline.verdict, 'PASS');
  assert.equal(evaluateMutationRun(finite(plan), plan, baseline).verdict, 'SURVIVED');
  const failed = evaluateMutationRun(finite(plan, { fail: true }), plan, baseline);
  assert.equal(failed.verdict, 'KILLED');
  assert.deepEqual(failed.failedCases, ['finite semantic contract']);
});
test('R24 copied-context missing file and loader failure never count as mutant kills', async () => {
  const { createMutationPlan, evaluateMutationRun } = await api;
  const plan = createMutationPlan(), baseline = evaluateMutationRun(finite(plan), plan);
  for (const code of ['E_R24_READ_MISSING', 'ERR_MODULE_NOT_FOUND', 'ERR_TEST_FAILURE', 'ENOENT']) {
    assert.equal(evaluateMutationRun(finite(plan, { fail: true, code }), plan, baseline).verdict, 'INVALID');
  }
});
test('R24 signal spawn error nonzero without assertions and absent marker fail closed', async () => {
  const { createMutationPlan, evaluateMutationRun } = await api;
  const plan = createMutationPlan(), baseline = evaluateMutationRun(finite(plan), plan);
  for (const change of [{ status: null, signal: 'SIGTERM' }, { error: new Error('ENOBUFS') },
    { status: 7 }, { status: 1 }, { stdout: 'loader initialization failed\n' },
    { stdout: finite(plan).stdout.replace(/^# R24_MUTATION_LOADED=.*\n/m, '') }]) {
    assert.equal(evaluateMutationRun({ ...finite(plan), ...change }, plan, baseline).verdict, 'INVALID');
  }
});
test('R24 missing duplicate zero inconsistent skipped and changed-cohort TAP cannot count', async () => {
  const { createMutationPlan, evaluateMutationRun } = await api;
  const plan = createMutationPlan(), baseline = evaluateMutationRun(finite(plan), plan), raw = finite(plan);
  for (const stdout of [
    raw.stdout.replace('# tests 1\n', ''), raw.stdout + '# pass 1\n',
    raw.stdout.replace('# tests 1', '# tests 0').replace('# pass 1', '# pass 0'),
    raw.stdout.replace('# pass 1', '# pass 2'),
    raw.stdout.replace('# pass 1', '# pass 0').replace('# skipped 0', '# skipped 1'),
    raw.stdout.replaceAll('finite semantic contract', 'another contract'),
    raw.stdout.replace('ok 1 -', 'ok 2 -'),
    raw.stdout.replace(plan.baseSha256, '0'.repeat(64)),
  ]) assert.equal(evaluateMutationRun({ ...raw, stdout }, plan, baseline).verdict, 'INVALID');
});
test('R24 full mutation evidence preserves stdout stderr status signal and spawn failure bytes', async () => {
  const { captureMutationEvidence, readMutationEvidence } = await api;
  const result = { stdout: 'TAP exact\nкириллица\\#\n', stderr: 'original causal failure\n',
    status: null, signal: 'SIGTERM', error: Object.assign(new Error('original spawn failure'), { code: 'E_TEST' }) };
  const full = captureMutationEvidence(result);
  const bytes = zlib.gunzipSync(Buffer.from(full.data, 'base64'));
  assert.equal(bytes.length, full.uncompressedUtf8Bytes);
  assert.equal(sha(bytes), full.sha256);
  const decoded = JSON.parse(bytes.toString('utf8'));
  assert.equal(decoded.stdout, result.stdout); assert.equal(decoded.stderr, result.stderr);
  assert.equal(decoded.exitCode, null); assert.equal(decoded.signal, 'SIGTERM');
  assert.deepEqual(decoded.error, { code: 'E_TEST', message: 'original spawn failure' });
  assert.equal(readMutationEvidence(full).bytes.equals(bytes), true);
  for (const invalid of [{ ...full, sha256: '0'.repeat(64) }, { ...full, uncompressedUtf8Bytes: bytes.length + 1 },
    { ...full, data: full.data + '*' }, { ...full, encoding: 'unknown' }]) {
    assert.throws(() => readMutationEvidence(invalid));
  }
});

function mixedDomainRun(plan, { assertion = false, code = null, origin = 'plan-state.mjs' } = {}) {
  const source = pathToFileURL(path.join(dir, origin)).href;
  const block = error => "  ---\n  failureType: 'testCodeFailure'\n  code: '" + error
    + "'\n  stack: |-\n    contract (" + source + ":1:1)\n  ...\n";
  const failed = Number(assertion) + Number(code !== null);
  return { status: failed ? 1 : 0, signal: null, stderr: '',
    stdout: 'TAP version 13\n# R24_MUTATION_LOADED=' + JSON.stringify(plan) + '\n'
      + '# Subtest: finite semantic witness\n' + (assertion ? 'not ok' : 'ok') + ' 1 - finite semantic witness\n'
      + (assertion ? block('ERR_ASSERTION') : '')
      + '# Subtest: finite propagated contract\n' + (code ? 'not ok' : 'ok') + ' 2 - finite propagated contract\n'
      + (code ? block(code) : '')
      + '1..2\n# tests 2\n# pass ' + (2 - failed) + '\n# fail ' + failed
      + '\n# cancelled 0\n# skipped 0\n# todo 0\n' };
}
async function originalPlan(id) {
  const definitions = await import(pathToFileURL(path.join(dir, 'test-mutants.mjs')).href);
  const { createMutationPlan } = await api;
  const mutant = definitions.MUTANTS.find(row => row.id === id);
  assert.ok(mutant);
  return createMutationPlan(mutant);
}
test('R24 duplicate sabotage keeps a genuine assertion witness with the observed secondary CAS refusal', async () => {
  const { evaluateMutationRun } = await api;
  const plan = await originalPlan('ps-duplicate-not-suppressed');
  const baseline = evaluateMutationRun(mixedDomainRun(plan), plan);
  assert.equal(baseline.verdict, 'PASS');
  const run = evaluateMutationRun(mixedDomainRun(plan,
    { assertion: true, code: 'E_CAS_REVISION_CONFLICT' }), plan, baseline);
  assert.equal(run.verdict, 'KILLED', JSON.stringify(run));
  assert.deepEqual(run.assertionCases, ['finite semantic witness']);
  assert.deepEqual(run.dependentDomainFailures, [
    { caseName: 'finite propagated contract', code: 'E_CAS_REVISION_CONFLICT', source: 'plan-state.mjs' },
  ]);
});
test('R24 nonmonotonic lease sabotage keeps assertion witnesses with its observed downstream fence refusal', async () => {
  const { evaluateMutationRun } = await api;
  const plan = await originalPlan('lease-fencing-not-monotonic');
  const baseline = evaluateMutationRun(mixedDomainRun(plan), plan);
  assert.equal(baseline.verdict, 'PASS');
  const run = evaluateMutationRun(mixedDomainRun(plan,
    { assertion: true, code: 'E_FENCE_STALE' }), plan, baseline);
  assert.equal(run.verdict, 'KILLED', JSON.stringify(run));
  assert.deepEqual(run.assertionCases, ['finite semantic witness']);
  assert.deepEqual(run.dependentDomainFailures, [
    { caseName: 'finite propagated contract', code: 'E_FENCE_STALE', source: 'plan-state.mjs' },
  ]);
});
test('R24 secondary domain errors alone or with wrong descriptor source unknown setup or signal remain invalid', async () => {
  const { evaluateMutationRun } = await api;
  const plan = await originalPlan('ps-duplicate-not-suppressed');
  const baseline = evaluateMutationRun(mixedDomainRun(plan), plan);
  for (const change of [
    { assertion: false, code: 'E_CAS_REVISION_CONFLICT' },
    { assertion: true, code: 'E_CAS_REVISION_CONFLICT', origin: 'mission-contract.mjs' },
    { assertion: true, code: 'E_FENCE_STALE' },
    { assertion: true, code: 'E_R24_READ_MISSING' },
    { assertion: true, code: 'ERR_MODULE_NOT_FOUND' },
    { assertion: true, code: 'E_UNKNOWN_CONTRACT' },
  ]) assert.equal(evaluateMutationRun(mixedDomainRun(plan, change), plan, baseline).verdict, 'INVALID');
  const another = await originalPlan('ps-cas-conflict-ignored');
  const otherBaseline = evaluateMutationRun(mixedDomainRun(another), another);
  assert.equal(evaluateMutationRun(mixedDomainRun(another,
    { assertion: true, code: 'E_CAS_REVISION_CONFLICT' }), another, otherBaseline).verdict, 'INVALID');
  const signalled = { ...mixedDomainRun(plan, { assertion: true, code: 'E_CAS_REVISION_CONFLICT' }),
    status: null, signal: 'SIGTERM' };
  assert.equal(evaluateMutationRun(signalled, plan, baseline).verdict, 'INVALID');
});

test('R24 canonical key-order sabotage retains observed digest refusals only beside a genuine assertion', async () => {
  const { evaluateMutationRun } = await api;
  const plan = await originalPlan('canon-key-order-nondeterministic');
  const baseline = evaluateMutationRun(mixedDomainRun(plan), plan);
  assert.equal(baseline.verdict, 'PASS');
  for (const [code, origin] of [
    ['E_TRANSITION_REPLAY_BASELINE_DIGEST', 'plan-state.mjs'],
    ['E_R24_W0_OVERLAY_PLAN_DIGEST', 'effective-state-compiler.mjs'],
    ['E_MISSION_DIGEST_INVALID', 'mission-contract.mjs'],
  ]) {
    const run = evaluateMutationRun(mixedDomainRun(plan, { assertion: true, code, origin }), plan, baseline);
    assert.equal(run.verdict, 'KILLED', JSON.stringify(run));
    assert.deepEqual(run.assertionCases, ['finite semantic witness']);
    assert.deepEqual(run.dependentDomainFailures, [
      { caseName: 'finite propagated contract', code, source: origin },
    ]);
    assert.equal(run.exitCode, 1);
    assert.equal(run.tap.fail, 2);
  }
});
test('R24 canonical propagated digest refusal alone is never a kill witness', async () => {
  const { evaluateMutationRun } = await api;
  const plan = await originalPlan('canon-key-order-nondeterministic');
  const baseline = evaluateMutationRun(mixedDomainRun(plan), plan);
  for (const [code, origin] of [
    ['E_TRANSITION_REPLAY_BASELINE_DIGEST', 'plan-state.mjs'],
    ['E_R24_W0_OVERLAY_PLAN_DIGEST', 'effective-state-compiler.mjs'],
    ['E_MISSION_DIGEST_INVALID', 'mission-contract.mjs'],
  ]) {
    const run = evaluateMutationRun(mixedDomainRun(plan, { code, origin }), plan, baseline);
    assert.equal(run.verdict, 'INVALID', JSON.stringify(run));
    assert.deepEqual(run.assertionCases, []);
    assert.ok(run.failures.includes('E_MUTATION_ASSERTION_WITNESS_MISSING'));
  }
});
test('R24 canonical secondary refusals require the exact descriptor code and original module frame', async () => {
  const { evaluateMutationRun } = await api;
  const plan = await originalPlan('canon-key-order-nondeterministic');
  const baseline = evaluateMutationRun(mixedDomainRun(plan), plan);
  for (const [code, origin] of [
    ['E_TRANSITION_REPLAY_BASELINE_DIGEST', 'lease.mjs'],
    ['E_R24_W0_OVERLAY_PLAN_DIGEST', 'plan-state.mjs'],
    ['E_MISSION_DIGEST_INVALID', 'plan-state.mjs'],
    ['E_UNKNOWN_BINDING', 'mission-contract.mjs'],
    ['ERR_MODULE_NOT_FOUND', 'mission-contract.mjs'],
    ['E_R24_READ_MISSING', 'mission-contract.mjs'],
  ]) assert.equal(evaluateMutationRun(mixedDomainRun(plan, { assertion: true, code, origin }),
    plan, baseline).verdict, 'INVALID');
  for (const wrong of [
    { ...plan, find: plan.find + ' ' },
    { ...plan, replace: plan.replace + ' ' },
    await originalPlan('mc-digest-binding-removed'),
  ]) {
    const control = evaluateMutationRun(mixedDomainRun(wrong), wrong);
    assert.equal(evaluateMutationRun(mixedDomainRun(wrong, { assertion: true,
      code: 'E_MISSION_DIGEST_INVALID', origin: 'mission-contract.mjs' }), wrong, control).verdict, 'INVALID');
  }
  const signal = { ...mixedDomainRun(plan, { assertion: true,
    code: 'E_MISSION_DIGEST_INVALID', origin: 'mission-contract.mjs' }), status: null, signal: 'SIGTERM' };
  assert.equal(evaluateMutationRun(signal, plan, baseline).verdict, 'INVALID');
});


// Finite transport fixtures include deliberate FAIL/INVALID data. Their case
// catalogs are data for a caller-budget control, not actual mutation coverage.
async function finiteCaseCatalogReceipt() {
  const { captureMutationEvidence } = await api;
  const cases = Array.from({ length: 198 }, (_, i) =>
    String(i).padStart(3, '0') + ' finite α#\\ case ' + 'label.'.repeat(38));
  const cohortSha256 = sha(Buffer.from(JSON.stringify(cases)));
  const evidence = captureMutationEvidence({ stdout: 'finite original stdout\nα#\\\n',
    stderr: 'finite original stderr\n', status: 1, signal: null });
  const rows = Array.from({ length: 40 }, (_, i) => ({
    id: 'finite-' + i, killed: false, verdict: 'INVALID',
    tap: { tests: 198, pass: 197, fail: 1, cancelled: 0, skipped: 0, todo: 0 },
    cohortSha256, cases: [...cases], failedCases: ['finite failure'],
    assertionCases: [], dependentDomainFailures: [], loadedCount: 1,
    exitCode: 1, signal: null, failures: ['E_FINITE_TRANSPORT_ONLY'], fullEvidence: evidence,
  }));
  rows[38] = { id: 'finite-38', killed: false, verdict: 'INVALID',
    error: 'finite setup refusal without a case list' };
  rows[39] = { ...rows[39], cases: ['different actual cohort'],
    failures: ['E_MUTATION_COHORT_CHANGED'] };
  return { schemaVersion: 'yalken.r24-mutation-receipt.v1',
    total: 40, killed: 0, survived: rows.map(row => row.id), score: 0, baseline: 'FAIL',
    baselineRun: { verdict: 'INVALID', cases, cohortSha256, fullEvidence: evidence },
    results: rows, notRun: [] };
}
function echoDefaultCaller(text) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.YALKEN_TEST_EVIDENCE_DIR;
  // maxBuffer is intentionally omitted, exactly as in the original WP104 lane caller.
  return spawnSync(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'],
    { input: text, encoding: 'utf8', env });
}
test('lossless case catalog fits the unchanged real default caller and restores every field', async () => {
  const receipt = await finiteCaseCatalogReceipt();
  const original = JSON.stringify(receipt);
  assert.ok(Buffer.byteLength(original) > 1024 * 1024);
  const legacy = echoDefaultCaller(original);
  assert.equal(legacy.error?.code, 'ENOBUFS');
  assert.notEqual(legacy.status, 0);
  const { captureMutationEvidence, compactMutationCaseCatalog, restoreMutationCaseCatalog } = await api;
  console.log('FINITE_CASE_CATALOG_LEGACY_CALLER=' + JSON.stringify({
    coverage: 'FINITE_TRANSPORT_ONLY', originalBytes: Buffer.byteLength(original),
    originalSha256: sha(Buffer.from(original)), pid: legacy.pid,
    completeReturnedProcess: captureMutationEvidence(legacy),
  }));
  assert.equal(typeof compactMutationCaseCatalog, 'function');
  assert.equal(typeof restoreMutationCaseCatalog, 'function');
  const wire = compactMutationCaseCatalog(receipt);
  const encoded = JSON.stringify(wire);
  assert.ok(Buffer.byteLength(encoded) < 1024 * 1024);
  const current = echoDefaultCaller(encoded);
  assert.equal(current.error, undefined);
  assert.equal(current.status, 0);
  assert.equal(current.stdout, encoded);
  const restored = restoreMutationCaseCatalog(JSON.parse(current.stdout));
  assert.deepEqual(restored, receipt);
  assert.equal(JSON.stringify(restored), original);
  assert.deepEqual(restoreMutationCaseCatalog(JSON.parse(original)), receipt);
  assert.deepEqual(wire.results[39].cases, ['different actual cohort']);
  assert.equal(Object.hasOwn(wire.results[38], 'cases'), false);
  assert.equal(JSON.stringify(receipt), original, 'transport cannot mutate the source receipt');
  console.log('FINITE_CASE_CATALOG_CURRENT_CALLER=' + JSON.stringify({
    coverage: 'FINITE_TRANSPORT_ONLY', compactBytes: Buffer.byteLength(encoded),
    compactSha256: sha(Buffer.from(encoded)), restoredSha256: sha(Buffer.from(JSON.stringify(restored))),
    pid: current.pid, completeReturnedProcess: captureMutationEvidence(current),
  }));
});
test('case catalog reader refuses unknown partial corrupt and mismatched references', async () => {
  const { compactMutationCaseCatalog, restoreMutationCaseCatalog } = await api;
  assert.equal(typeof compactMutationCaseCatalog, 'function');
  assert.equal(typeof restoreMutationCaseCatalog, 'function');
  const source = await finiteCaseCatalogReceipt();
  const wire = compactMutationCaseCatalog(source);
  const corruptions = [
    x => { x.caseCatalogEncoding = 'unsupported'; },
    x => { delete x.caseCatalogEncoding; },
    x => { delete x.caseCatalogFullReceiptSha256; },
    x => { x.caseCatalogFullReceiptSha256 = '0'.repeat(64); },
    x => { x.results[0].cases.encoding = 'unsupported'; },
    x => { x.results[0].cases.sha256 = '0'.repeat(64); },
    x => { x.results[0].cases.extra = true; },
    x => { x.baselineRun.cases[0] += 'tampered'; },
    x => { x.results[0].cases = []; },
    x => { delete x.results[0].cases; },
    x => { x.results[0].verdict = 'PASS'; },
    x => { x.baselineRun.cases = ['not the original catalog']; },
  ];
  for (const change of corruptions) {
    const broken = JSON.parse(JSON.stringify(wire));
    change(broken);
    assert.throws(() => restoreMutationCaseCatalog(broken), /E_MUTATION_CASE_CATALOG_/u);
  }
  assert.throws(() => compactMutationCaseCatalog(wire), /E_MUTATION_CASE_CATALOG_/u);
  assert.throws(() => restoreMutationCaseCatalog({ ...source, caseCatalogEncoding: 'unsupported' }),
    /E_MUTATION_CASE_CATALOG_/u);
});

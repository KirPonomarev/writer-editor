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

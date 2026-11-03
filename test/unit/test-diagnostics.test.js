'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const transport = require('../../scripts/test-diagnostics.cjs');
const root = path.resolve(__dirname, '../..');
const payload = { causalReach: 'ACTUAL_CORRECTION_PERSISTENCE', id: 'explicit-fixture',
  response: { ok: false, code: 'ACTUAL_RETAINED_FAILURE' },
  before: { manifestRaw: '{"text":"é 🧭 # \\\\ suffix"}', text: 'line1\nline2' }, after: { unchanged: true } };
const original = JSON.stringify(payload);
const totals = ['TAP version 13', '# Subtest: actual finite case', 'ok 1 - actual finite case',
  '1..1', '# tests 1', '# suites 0', '# pass 1', '# fail 0', '# cancelled 0', '# skipped 0', '# todo 0', ''].join('\n');
const tap = text => '# ' + text.replaceAll('\\', '\\\\').replaceAll('#', '\\#');
function result(overrides = {}) {
  return { status: 0, signal: null, error: null, stdout: totals + tap(transport.packDiagnostic(payload)) + '\n',
    stderr: 'retained stderr\n', ...overrides };
}
function changeEnvelope(change) {
  const outer = JSON.parse(transport.packDiagnostic(payload));
  change(outer);
  return JSON.stringify(outer);
}
test('diagnostics recover every original inline and gzip payload byte including nested JSON Unicode slash and hash', () => {
  for (const text of [original, transport.packDiagnostic(payload)]) {
    const read = transport.readDiagnostic(text);
    assert.equal(read.bytes.toString('utf8'), original);
    assert.deepEqual(read.payload, payload);
  }
});
test('reader remains compatible with existing native Save gzip envelope', () => {
  const bytes = Buffer.from(JSON.stringify({ nativeSaveSystem: 'REAL_FIRST_SAVE_native', before: { text: '#\\' }, after: { ok: false } }));
  const encoded = JSON.stringify({ nativeSaveSystem: 'REAL_FIRST_SAVE_native', fullEvidence: {
    encoding: 'gzip-base64-json-v1', uncompressedUtf8Bytes: bytes.length,
    sha256: transport.sha256(bytes), data: zlib.gzipSync(bytes).toString('base64'),
  } });
  assert.deepEqual(transport.readDiagnostic(encoded).bytes, bytes);
});
test('strict reader refuses unknown missing corrupt length hash base64 encoding and identity', () => {
  const mutations = [
    value => { value.fullEvidence.encoding = 'unknown'; },
    value => { delete value.fullEvidence.data; },
    value => { value.fullEvidence.data += '\n'; },
    value => { value.fullEvidence.data = Buffer.from('not gzip').toString('base64'); },
    value => { value.fullEvidence.uncompressedUtf8Bytes += 1; },
    value => { value.fullEvidence.uncompressedUtf8Bytes -= 1; },
    value => { value.fullEvidence.sha256 = '0'.repeat(64); },
    value => { value.id = 'different-entity'; },
    value => { value.fullEvidence.extraUnknownField = true; },
  ];
  for (const mutate of mutations) assert.throws(() => transport.readDiagnostic(changeEnvelope(mutate)));
  assert.throws(() => transport.readDiagnostic('{"unknown":true}'));
  assert.throws(() => transport.readDiagnostic('{"causalReach":"ACTUAL_CORRECTION_PERSISTENCE","fullEvidence":null}'));
});
test('invalid UTF8 cannot be normalized into accepted JSON diagnostic bytes', () => {
  const bytes = Buffer.from('{"causalReach":"ACTUAL_CORRECTION_PERSISTENCE","text":"x"}');
  bytes[bytes.indexOf(120)] = 255;
  assert.throws(() => transport.readDiagnostic(changeEnvelope(value => {
    value.fullEvidence.uncompressedUtf8Bytes = bytes.length;
    value.fullEvidence.sha256 = transport.sha256(bytes);
    value.fullEvidence.data = zlib.gzipSync(bytes).toString('base64');
  })), /UTF8/u);
});
test('exact Node TAP escape reader preserves original legacy bytes and leaves unrelated diagnostic text intact', () => {
  assert.equal(transport.readTapDiagnostic(tap(original)).bytes.toString(), original);
  assert.equal(transport.readTapDiagnostic('# unrelated {not JSON}'), null);
  assert.equal(transport.readTapDiagnostic('# {"other":"# slash"}'), null);
  const stdout = totals + tap(original) + '\n# unrelated {not JSON}\n';
  const summary = transport.summarizeTap(stdout);
  assert.equal(summary.diagnostics, 1);
  assert.ok(summary.text.includes('# unrelated {not JSON}\n'));
  assert.ok(summary.text.includes('bytes=' + Buffer.byteLength(original)));
  assert.ok(summary.text.includes('sha256=' + transport.sha256(Buffer.from(original))));
  assert.ok(!summary.text.includes('manifestRaw'));
  assert.deepEqual(transport.readTapTotals(summary.text, ''), transport.readTapTotals(stdout, ''));
});
test('full gzip artifact preserves both complete streams status signal error and every diagnostic byte', () => {
  const actual = result(), compressed = transport.packUnitArtifact(actual), decoded = transport.readUnitArtifact(compressed);
  assert.equal(decoded.result.stdout, actual.stdout);
  assert.equal(decoded.result.stderr, actual.stderr);
  assert.equal(decoded.result.status, actual.status);
  assert.equal(decoded.exitCode, 0);
  assert.equal(decoded.diagnostics, 1);
  assert.equal(decoded.result.stdoutBytes, Buffer.byteLength(actual.stdout));
  assert.equal(decoded.result.stdoutSha256, transport.sha256(Buffer.from(actual.stdout)));
  assert.ok(!decoded.consoleStdout.includes('fullEvidence'));
});
test('actual failure signal error and unknown totals never become GREEN despite green-shaped output', () => {
  for (const actual of [result({ status: 7 }), result({ status: null, signal: 'SIGTERM' }),
    result({ status: null, error: { code: 'ENOBUFS', message: 'retained original error' } }),
    result({ stdout: 'UNKNOWN_OUTPUT\n' }), result({ stdout: totals.replace('# tests 1', '# tests 2') }),
    result({ stdout: totals.replace('# pass 1', '# pass 0').replace('# fail 0', '# fail 1') })]) {
    const decoded = transport.readUnitArtifact(transport.packUnitArtifact(actual));
    assert.notEqual(decoded.exitCode, 0);
    if (actual.status === 7) assert.equal(decoded.exitCode, 7);
    assert.equal(decoded.result.stdout, actual.stdout);
  }
});
test('changed source line metadata cannot turn a retained real failure into Green or invalidate unchanged success', () => {
  for (const status of [0, 7]) {
    const old = result({ status, stdout: totals + '# saved location source.test.js:123:7\n' });
    const newer = { ...old, stdout: old.stdout.replace(':123:7', ':987:7') };
    const a = transport.readUnitArtifact(transport.packUnitArtifact(old));
    const b = transport.readUnitArtifact(transport.packUnitArtifact(newer));
    assert.equal(a.exitCode, status); assert.equal(b.exitCode, status);
    assert.notEqual(a.result.stdoutSha256, b.result.stdoutSha256, 'raw metadata bytes remain distinct and preserved');
    assert.deepEqual(a.totals, b.totals);
  }
});
test('artifact corruption absent metadata unsupported schema and stream byte drift fail closed', () => {
  assert.throws(() => transport.readUnitArtifact(Buffer.from('not gzip')));
  const complete = zlib.gunzipSync(transport.packUnitArtifact(result()));
  const end = complete.indexOf(10), header = JSON.parse(complete.subarray(0, end)), streams = complete.subarray(end + 1);
  for (const mutate of [
    value => { value.schema = 'unknown'; }, value => { value.stdoutBytes += 1; },
    value => { value.stdoutSha256 = '0'.repeat(64); }, value => { delete value.status; },
  ]) {
    const changed = { ...header }; mutate(changed);
    const bytes = Buffer.concat([Buffer.from(JSON.stringify(changed) + '\n'), streams]);
    assert.throws(() => transport.readUnitArtifact(zlib.gzipSync(bytes)));
  }
  assert.throws(() => transport.readUnitArtifact(zlib.gzipSync(complete.subarray(0, complete.length - 1))));
});
test('actual caller publishes a complete verified artifact before brief console references and actual CLI reads it', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostic-artifact-control-'));
  const fixture = path.join(scratch, 'actual-diagnostic.test.js');
  const helper = path.join(root, 'scripts/test-diagnostics.cjs');
  fs.writeFileSync(fixture, "const test=require('node:test');const {packDiagnostic}=require(" + JSON.stringify(helper)
    + ");test('actual diagnostic executed', t=>t.diagnostic(packDiagnostic(" + original + ")));\n", { flag: 'wx' });
  const env = { ...process.env, YALKEN_TEST_EVIDENCE_DIR: fs.realpathSync(scratch) };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/run-tests.js'), fixture], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(child.status, 0, child.stdout + '\n' + child.stderr);
  assert.match(child.stdout, /ok 1 - actual diagnostic executed/u);
  assert.match(child.stdout, /# retained diagnostic ACTUAL_CORRECTION_PERSISTENCE/u);
  assert.doesNotMatch(child.stdout, /fullEvidence|manifestRaw/u);
  const line = child.stdout.split('\n').find(value => value.startsWith('UNIT_LANE_FULL_ARTIFACT='));
  assert.ok(line);
  const file = JSON.parse(line.slice('UNIT_LANE_FULL_ARTIFACT='.length));
  assert.equal(path.dirname(file), fs.realpathSync(scratch));
  const compressed = fs.readFileSync(file), decoded = transport.readUnitArtifact(compressed);
  assert.ok(child.stdout.includes('UNIT_LANE_FULL_ARTIFACT_SHA256=' + transport.sha256(compressed)));
  assert.equal(decoded.exitCode, 0); assert.equal(decoded.diagnostics, 1);
  const rawDiagnostic = decoded.result.stdout.split('\n').map(value => transport.readTapDiagnostic(value)).find(Boolean);
  assert.equal(rawDiagnostic.bytes.toString('utf8'), original, 'actual Node TAP reporter and actual caller retain every original payload byte');
  const cli = spawnSync(process.execPath, [helper, file], { cwd: root, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.equal(JSON.parse(cli.stdout).diagnosticPayloadsVerified, 1);
  const failure = path.join(scratch, 'retained-failure.tap.gz');
  fs.writeFileSync(failure, transport.packUnitArtifact(result({ status: 7 })), { flag: 'wx' });
  const failed = spawnSync(process.execPath, [helper, failure], { cwd: root, encoding: 'utf8' });
  assert.equal(failed.status, 7); assert.equal(JSON.parse(failed.stdout).actualStatus, 7);
});

test('outer artifact directory is a caller write capability and is not inherited by its Node test children', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostic-environment-control-'));
  const fixture = path.join(scratch, 'actual-environment.test.js');
  fs.writeFileSync(fixture, "const test=require('node:test'),assert=require('node:assert/strict');test('test child has no outer artifact directory',()=>assert.equal(process.env.YALKEN_TEST_EVIDENCE_DIR,undefined));\n", { flag: 'wx' });
  const env = { ...process.env, YALKEN_TEST_EVIDENCE_DIR: fs.realpathSync(scratch) };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/run-tests.js'), fixture], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(child.status, 0, child.stdout + '\n' + child.stderr);
  assert.match(child.stdout, /ok 1 - test child has no outer artifact directory/u);
  const line = child.stdout.split('\n').find(value => value.startsWith('UNIT_LANE_FULL_ARTIFACT='));
  assert.ok(line, 'the parent caller retains its own verified artifact capability');
  const artifact = JSON.parse(line.slice('UNIT_LANE_FULL_ARTIFACT='.length));
  assert.equal(transport.readUnitArtifact(fs.readFileSync(artifact)).exitCode, 0);
});

test('other JSON diagnostics keep exact opaque TAP bytes in the artifact and only readable hash references in console', () => {
  const opaque = '# ' + JSON.stringify({ otherDiagnostic: { raw: 'retained # \\\\ é 🧭 '.repeat(512) }, semanticAcceptanceAuthority: false });
  const stdout = totals + opaque + '\n# unrelated readable explanation\n';
  const decoded = transport.readUnitArtifact(transport.packUnitArtifact(result({ stdout })));
  assert.equal(decoded.result.stdout, stdout);
  assert.equal(decoded.diagnostics, 0, 'opaque transport is never semantic payload verification credit');
  assert.equal(decoded.opaqueDiagnostics, 1);
  assert.ok(!decoded.consoleStdout.includes('"otherDiagnostic"'), 'full opaque payload belongs to the complete artifact');
  assert.ok(decoded.consoleStdout.includes('tap-json-bytes=' + Buffer.byteLength(opaque.slice(2))));
  assert.ok(decoded.consoleStdout.includes('sha256=' + transport.sha256(Buffer.from(opaque.slice(2)))));
  assert.ok(decoded.consoleStdout.includes('# unrelated readable explanation\n'));
  assert.deepEqual(transport.readTapTotals(decoded.consoleStdout, ''), transport.readTapTotals(stdout, ''));
});


// Complete source-bound producer controls: container integrity never supplies a
// passing verdict when the actual outcomes/plan/footer contradict one another.
const readerCounterexamples = [{"name":"valid_green_control","status":0,"stdout":"TAP version 13\nok 1 - real case\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"},{"name":"valid_red_control","status":1,"stdout":"TAP version 13\nnot ok 1 - real case\n1..1\n# tests 1\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n"},{"name":"contradictory_failed_case_green_totals","status":0,"stdout":"TAP version 13\nnot ok 1 - real case\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"},{"name":"missing_test_outcomes_green_totals","status":0,"stdout":"TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"},{"name":"duplicate_contradictory_summary","status":0,"stdout":"TAP version 13\nnot ok 1 - real case\n1..1\n# tests 1\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"}];
function nativeNestedReaderResult(failed, reporter = 'tap') {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostic-native-nested-'));
  const file = path.join(scratch, 'actual-reader.test.cjs');
  const fixtureSource = "const { describe, test, skip } = require('node:test');\nconst assert = require('node:assert/strict');\ndescribe('actual reader group', () => {\n  test('actual reader flat', () => assert.equal(2, 2));\n  test('actual reader parent', async t => {\n    await t.test('actual reader child one', () => assert.equal(3, 3));\n    await t.test('actual reader child two', () => assert.equal(__VALUE__, 4));\n  });\n  skip('declared optional reader child', () => assert.fail('skipped child must not execute'));\n});\n";
  fs.writeFileSync(file, fixtureSource.replace('__VALUE__', failed ? '0' : '4'), { flag: 'wx' });
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.YALKEN_TEST_EVIDENCE_DIR;
  const actual = spawnSync(process.execPath, ['--test', '--test-reporter=' + reporter, file], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(actual.error, undefined);
  assert.equal(actual.signal, null);
  assert.equal(actual.status, failed ? 1 : 0, actual.stdout + actual.stderr);
  assert.match(actual.stdout, /actual reader child one/u);
  assert.match(actual.stdout, /actual reader child two/u);
  return actual;
}
for (const fixture of readerCounterexamples.slice(2)) {
  test('complete artifact refuses exact contradictory input: ' + fixture.name, () => {
    const actual = { ...fixture, stderr: '', signal: null, error: null };
    const decoded = transport.readUnitArtifact(transport.packUnitArtifact(actual));
    assert.notEqual(decoded.exitCode, 0, 'hash-valid but contradictory/missing TAP cannot supply GREEN');
    assert.equal(decoded.result.stdout, actual.stdout, 'all original malformed bytes stay retained');
    assert.equal(decoded.result.status, actual.status, 'actual process status must never be rewritten');
  });
}
test('complete reader accepts genuine flat and actual nested TAP/spec GREEN including declared skip', () => {
  const fixture = readerCounterexamples[0];
  for (const actual of [
    { ...fixture, stderr: '', signal: null, error: null },
    nativeNestedReaderResult(false), nativeNestedReaderResult(false, 'spec'),
  ]) {
    const decoded = transport.readUnitArtifact(transport.packUnitArtifact(actual));
    assert.equal(decoded.exitCode, 0);
    assert.equal(decoded.totals.valid, true);
    assert.equal(decoded.result.stdout, actual.stdout);
    assert.equal(decoded.result.stderr, actual.stderr);
    if (actual !== fixture && actual.stdout.includes('actual reader group')) {
      assert.equal(decoded.totals.tests, 5);
      assert.equal(decoded.totals.skipped, 1, 'declared skip remains visible and uncovered');
    }
  }
});
test('complete reader preserves real failed flat and actual nested TAP process as RED', () => {
  for (const actual of [
    { ...readerCounterexamples[1], stderr: '', signal: null, error: null },
    nativeNestedReaderResult(true),
  ]) {
    const decoded = transport.readUnitArtifact(transport.packUnitArtifact(actual));
    assert.equal(decoded.exitCode, 1);
    assert.equal(decoded.totals.valid, true, 'real complete failed TAP remains structurally readable');
    assert.equal(decoded.result.status, 1);
    assert.equal(decoded.result.stdout, actual.stdout);
    assert.ok(decoded.totals.fail > 0);
  }
});
test('complete reader verifies and aggregates every native document in concatenated TAP and spec', () => {
  const a = nativeNestedReaderResult(false), b = nativeNestedReaderResult(false, 'spec');
  const actual = { status: 0, signal: null, error: null,
    stdout: a.stdout + b.stdout, stderr: a.stderr + b.stderr };
  const decoded = transport.readUnitArtifact(transport.packUnitArtifact(actual));
  assert.equal(decoded.exitCode, 0);
  assert.equal(decoded.totals.valid, true);
  assert.equal(decoded.totals.tests, 10, 'a later valid footer cannot hide the earlier executed cohort');
  assert.equal(decoded.totals.pass, 8);
  assert.equal(decoded.totals.skipped, 2);
  assert.equal(decoded.result.stdout, actual.stdout);
});


test('complete artifact refuses nested TAP without each immediate parent outcome', () => {
  const forms = [
  {
    "name": "orphan_child_before_root_zero_plan",
    "stdout": "TAP version 13\n    ok 1 - orphan child\n    1..1\n1..0\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
  },
  {
    "name": "orphan_child_after_completed_root",
    "stdout": "TAP version 13\nok 1 - completed root\n    ok 1 - orphan child\n    1..1\n1..1\n# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
  },
  {
    "name": "root_footer_without_parent_outcome",
    "stdout": "TAP version 13\n    ok 1 - orphan child\n    1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
  },
  {
    "name": "grandchild_without_intermediate_parent",
    "stdout": "TAP version 13\n        ok 1 - orphan grandchild\n        1..1\nok 1 - root\n1..1\n# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
  },
  {
    "name": "front_plan_does_not_supply_intermediate_parent",
    "stdout": "TAP version 13\n    1..1\n    ok 1 - completed child\n        ok 1 - orphan grandchild\n        1..1\nok 1 - root\n1..1\n# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
  }
];
  for (const fixture of forms) {
    const actual = { status: 0, signal: null, error: null, stdout: fixture.stdout, stderr: '' };
    const decoded = transport.readUnitArtifact(transport.packUnitArtifact(actual));
    assert.notEqual(decoded.exitCode, 0, fixture.name + ': an unresolved nested child cannot supply GREEN');
    assert.equal(decoded.totals.valid, false, fixture.name + ': root counters cannot replace the missing parent outcome');
    assert.equal(decoded.result.stdout, actual.stdout, 'all original orphan bytes remain exact');
    assert.equal(decoded.result.status, 0, 'the actual process status remains unchanged');
  }
});

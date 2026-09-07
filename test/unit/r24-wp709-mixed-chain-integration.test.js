'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const f = require('../fixtures/r24-wp709-mixed-chain-fixtures.js');

const root = path.resolve(__dirname, '../..');
const cli = path.join(root, 'scripts/ops/r24/mixed-chain-wp709.mjs');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('WP709 local checker reports conditional terminal state and contains no provider write mode', () => {
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'PENDING_EXTERNAL_PHYSICAL');
  assert.equal(receipt.externalPhysicalStatus, 'REQUIRED_NOT_PRECLAIMED');
  assert.equal(receipt.effectExecution, false);
  assert.equal(receipt.productRuntimeNetwork, false);
  assert.equal(receipt.writesFiles, false);
  assert.deepEqual(receipt.supportedModes, ['COMPILE_OBSERVATIONS_TO_STDOUT', 'VERIFY_RECEIPT_READ_ONLY']);
});

test('WP709 local checker compiles and independently replays an injected observation file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wp709-checker-'));
  try {
    const observationPath = path.join(directory, 'observation.json');
    const receiptPath = path.join(directory, 'receipt.json');
    fs.writeFileSync(observationPath, `${JSON.stringify(await f.makeWp709Fixture({ physical: 'pass' }))}\n`, 'utf8');
    const compile = run(['--input', observationPath, '--require-done']);
    assert.equal(compile.status, 0, compile.stderr);
    const receipt = JSON.parse(compile.stdout);
    assert.equal(receipt.stageDone, true);
    assert.equal(receipt.status, 'PASS');
    fs.writeFileSync(receiptPath, compile.stdout, 'utf8');
    const verify = run(['--input', observationPath, '--verify', receiptPath, '--require-done']);
    assert.equal(verify.status, 0, verify.stderr);
    assert.equal(JSON.parse(verify.stdout).status, 'VERIFIED');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('WP709 require-done fails closed for a well-formed conditional observation corpus', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wp709-pending-'));
  try {
    const observationPath = path.join(directory, 'observation.json');
    fs.writeFileSync(observationPath, `${JSON.stringify(await f.makeWp709Fixture({ physical: 'pending' }))}\n`, 'utf8');
    const result = run(['--input', observationPath, '--require-done']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /WP709_EXTERNAL_PHYSICAL_REQUIRED/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('WP709 local checker preserves a six-pass Native blocker and refuses require-done', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wp709-blocked-'));
  try {
    const observationPath = path.join(directory, 'observation.json');
    fs.writeFileSync(observationPath, `${JSON.stringify(await f.makeWp709Fixture({ physical: 'blocked-native' }))}\n`, 'utf8');
    const compiled = run(['--input', observationPath]);
    assert.equal(compiled.status, 0, compiled.stderr);
    const receipt = JSON.parse(compiled.stdout);
    assert.equal(receipt.exactPassCount, 6);
    assert.equal(receipt.googleOfficeCompatQualified, true);
    assert.equal(receipt.status, 'BLOCKED_TYPED');
    assert.equal(receipt.stageDone, false);
    const refused = run(['--input', observationPath, '--require-done']);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /WP709_EXTERNAL_PHYSICAL_REQUIRED/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('WP709 checker rejects malformed, oversized and non-canonical observation carriers', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wp709-hostile-'));
  try {
    const noLf = path.join(directory, 'no-lf.json');
    const oversized = path.join(directory, 'oversized.json');
    fs.writeFileSync(noLf, '{}', 'utf8');
    fs.writeFileSync(oversized, `${' '.repeat(513 * 1024)}\n`, 'utf8');
    assert.match(run(['--input', noLf]).stderr, /WP709_OBSERVATION_CANONICAL_LF_REQUIRED/u);
    assert.match(run(['--input', oversized]).stderr, /WP709_OBSERVATION_BUDGET_INVALID/u);
    assert.match(run(['--network']).stderr, /WP709_CLI_ARGUMENT_INVALID/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

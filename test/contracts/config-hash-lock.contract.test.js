const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/config-hash-lock-state.mjs';
const TOKEN_NAME = 'CONFIG_HASH_LOCK_OK';
const FAIL_CODE = 'E_CONFIG_HASH_CONFLICT';

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runScript(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    encoding: 'utf8',
  });
}

function runRawScript(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
  });
}

function parseJsonStdout(result) {
  let payload = null;
  assert.doesNotThrow(() => {
    payload = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return payload;
}

function computeConfigHash(entries) {
  const payload = entries.map((item) => `${item.path}\u0000${item.sha256}\n`).join('');
  return sha256Hex(payload);
}

test('config hash lock: repository baseline lock is valid', () => {
  const result = runScript();
  assert.equal(result.status, 0, `config-hash-lock-state failed:\n${result.stdout}\n${result.stderr}`);
  const payload = parseJsonStdout(result);
  assert.equal(payload.tokens[TOKEN_NAME], 1);
  assert.match(String(payload.lockedConfigHash || ''), /^[0-9a-f]{64}$/u);
  assert.equal(payload.lockedConfigHash, payload.observedConfigHash);
  assert.equal(payload.failSignal, undefined);
});

test('config hash lock: tampered input emits E_CONFIG_HASH_CONFLICT', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-hash-lock-'));
  const lockPath = path.join(tempDir, 'CONFIG_HASH_LOCK.json');
  const alphaPath = path.join(tempDir, 'alpha.json');
  const betaPath = path.join(tempDir, 'beta.json');
  fs.writeFileSync(alphaPath, '{"value":"alpha"}\n', 'utf8');
  fs.writeFileSync(betaPath, '{"value":"beta"}\n', 'utf8');

  const inputs = ['alpha.json', 'beta.json'];
  const inputHashes = {
    'alpha.json': sha256Hex(fs.readFileSync(alphaPath)),
    'beta.json': sha256Hex(fs.readFileSync(betaPath)),
  };
  const configHash = computeConfigHash(inputs.map((item) => ({ path: item, sha256: inputHashes[item] })));
  fs.writeFileSync(lockPath, `${JSON.stringify({
    version: 'config-hash-lock.v1',
    inputs,
    inputHashes,
    configHash,
  }, null, 2)}\n`, 'utf8');

  fs.appendFileSync(betaPath, '{"tampered":true}\n', 'utf8');

  const result = runScript(['--root', tempDir, '--lock-path', lockPath]);
  fs.rmSync(tempDir, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected non-zero status on tamper');
  const payload = parseJsonStdout(result);
  assert.equal(payload.tokens[TOKEN_NAME], 0);
  assert.equal(payload.failSignal.code, FAIL_CODE);
  assert.equal(payload.failSignal.details.path, 'beta.json');
  assert.match(String(payload.failSignal.details.expected || ''), /^[0-9a-f]{64}$/u);
  assert.match(String(payload.failSignal.details.actual || ''), /^[0-9a-f]{64}$/u);
  assert.notEqual(payload.failSignal.details.expected, payload.failSignal.details.actual);
});

test('config hash lock: print lock emits deterministic proposal without pass token semantics', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-hash-print-'));
  const lockPath = path.join(tempDir, 'CONFIG_HASH_LOCK.json');
  const alphaPath = path.join(tempDir, 'alpha.json');
  const betaPath = path.join(tempDir, 'beta.json');
  fs.writeFileSync(alphaPath, '{"value":"alpha"}\n', 'utf8');
  fs.writeFileSync(betaPath, '{"value":"beta"}\n', 'utf8');

  const inputs = ['alpha.json', 'beta.json'];
  const inputHashes = {
    'alpha.json': sha256Hex(fs.readFileSync(alphaPath)),
    'beta.json': sha256Hex(fs.readFileSync(betaPath)),
  };
  const configHash = computeConfigHash(inputs.map((item) => ({ path: item, sha256: inputHashes[item] })));
  fs.writeFileSync(lockPath, `${JSON.stringify({
    version: 'config-hash-lock.v1',
    inputs,
    inputHashes,
    configHash,
  }, null, 2)}\n`, 'utf8');

  const args = ['--print-lock', '--root', tempDir, '--lock-path', lockPath];
  const first = runRawScript(args);
  const second = runRawScript(args);

  assert.equal(first.status, 0, `first print failed:\n${first.stdout}\n${first.stderr}`);
  assert.equal(second.status, 0, `second print failed:\n${second.stdout}\n${second.stderr}`);
  assert.equal(first.stdout, second.stdout);

  const payload = JSON.parse(first.stdout);
  assert.equal(payload.kind, 'config_hash_lock_proposal');
  assert.equal(payload.token, undefined);
  assert.equal(payload.okTokenEmitted, undefined);
  assert.equal(payload.tokens, undefined);
  assert.equal(payload.lock.configHash, configHash);
  assert.equal(JSON.stringify(payload.lock.inputs), JSON.stringify(inputs));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('config hash lock: write lock requires an explicit target lock path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-hash-write-target-required-'));
  const lockPath = path.join(tempDir, 'CONFIG_HASH_LOCK.json');
  fs.writeFileSync(lockPath, `${JSON.stringify({
    version: 'config-hash-lock.v1',
    inputs: [],
    inputHashes: {},
    configHash: '0'.repeat(64),
  }, null, 2)}\n`, 'utf8');
  const result = runRawScript(['--write-lock', '--lock-path', lockPath]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /CONFIG_HASH_LOCK_WRITE_REQUIRES_EXPLICIT_TARGET_LOCK_PATH=1/);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('config hash lock: production lock write requires allow production flag', () => {
  const result = runRawScript([
    '--write-lock',
    '--lock-path',
    'docs/OPS/LOCKS/CONFIG_HASH_LOCK.json',
    '--target-lock-path',
    'docs/OPS/LOCKS/CONFIG_HASH_LOCK.json',
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /CONFIG_HASH_LOCK_PRODUCTION_WRITE_REQUIRES_ALLOW_FLAG=1/);
});

test('config hash lock: print and write modes are mutually exclusive', () => {
  const result = runRawScript([
    '--print-lock',
    '--write-lock',
    '--lock-path',
    'docs/OPS/LOCKS/CONFIG_HASH_LOCK.json',
    '--target-lock-path',
    path.join(os.tmpdir(), 'config-hash-mode-conflict.json'),
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /CONFIG_HASH_LOCK_MODE_CONFLICT=1/);
});

test('config hash lock: write lock reads source and updates only explicit target path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-hash-write-'));
  const sourceLockPath = path.join(tempDir, 'CONFIG_HASH_LOCK_SOURCE.json');
  const targetLockPath = path.join(tempDir, 'CONFIG_HASH_LOCK_TARGET.json');
  const alphaPath = path.join(tempDir, 'alpha.json');
  const betaPath = path.join(tempDir, 'beta.json');
  fs.writeFileSync(alphaPath, '{"value":"alpha"}\n', 'utf8');
  fs.writeFileSync(betaPath, '{"value":"beta"}\n', 'utf8');

  const inputs = ['alpha.json', 'beta.json'];
  const inputHashes = {
    'alpha.json': sha256Hex(fs.readFileSync(alphaPath)),
    'beta.json': sha256Hex(fs.readFileSync(betaPath)),
  };
  const configHash = computeConfigHash(inputs.map((item) => ({ path: item, sha256: inputHashes[item] })));
  fs.writeFileSync(sourceLockPath, `${JSON.stringify({
    version: 'config-hash-lock.v1',
    inputs,
    inputHashes,
    configHash,
  }, null, 2)}\n`, 'utf8');

  fs.appendFileSync(betaPath, '{"tampered":true}\n', 'utf8');
  const alphaBefore = fs.readFileSync(alphaPath, 'utf8');
  const betaBefore = fs.readFileSync(betaPath, 'utf8');
  const sourceBefore = fs.readFileSync(sourceLockPath, 'utf8');
  const sourceInputsBefore = JSON.stringify(JSON.parse(sourceBefore).inputs);

  const result = runRawScript([
    '--write-lock',
    '--root',
    tempDir,
    '--lock-path',
    sourceLockPath,
    '--target-lock-path',
    targetLockPath,
  ]);
  const validation = runScript(['--root', tempDir, '--lock-path', targetLockPath]);

  assert.equal(result.status, 0, `write failed:\n${result.stdout}\n${result.stderr}`);
  assert.equal(fs.readFileSync(sourceLockPath, 'utf8'), sourceBefore);
  assert.ok(fs.existsSync(targetLockPath));
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(targetLockPath, 'utf8')).inputs), sourceInputsBefore);
  assert.equal(fs.readFileSync(alphaPath, 'utf8'), alphaBefore);
  assert.equal(fs.readFileSync(betaPath, 'utf8'), betaBefore);
  assert.equal(validation.status, 0, `validation failed:\n${validation.stdout}\n${validation.stderr}`);
  assert.deepEqual(
    fs.readdirSync(tempDir).filter((item) => item.endsWith('.tmp')),
    [],
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('config hash lock: default validation does not write a mismatched lock', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-hash-default-'));
  const lockPath = path.join(tempDir, 'CONFIG_HASH_LOCK.json');
  const alphaPath = path.join(tempDir, 'alpha.json');
  const betaPath = path.join(tempDir, 'beta.json');
  fs.writeFileSync(alphaPath, '{"value":"alpha"}\n', 'utf8');
  fs.writeFileSync(betaPath, '{"value":"beta"}\n', 'utf8');

  const inputs = ['alpha.json', 'beta.json'];
  const inputHashes = {
    'alpha.json': sha256Hex(fs.readFileSync(alphaPath)),
    'beta.json': sha256Hex(fs.readFileSync(betaPath)),
  };
  const configHash = computeConfigHash(inputs.map((item) => ({ path: item, sha256: inputHashes[item] })));
  fs.writeFileSync(lockPath, `${JSON.stringify({
    version: 'config-hash-lock.v1',
    inputs,
    inputHashes,
    configHash,
  }, null, 2)}\n`, 'utf8');

  fs.appendFileSync(betaPath, '{"tampered":true}\n', 'utf8');
  const lockBefore = fs.readFileSync(lockPath, 'utf8');
  const result = runScript(['--root', tempDir, '--lock-path', lockPath]);

  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(lockPath, 'utf8'), lockBefore);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

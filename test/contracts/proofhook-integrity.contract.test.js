const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/proofhook-integrity-state.mjs';
const FIXTURE_DIR = path.join(process.cwd(), 'test/fixtures/proofhook-integrity');
const FIXTURE_LOCK_PATH = path.join(FIXTURE_DIR, 'PROOFHOOK_INTEGRITY_LOCK.json');

function runState(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    encoding: 'utf8',
  });
}

function runScript(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
  });
}

function parseJsonOutput(result) {
  let parsed = null;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return parsed;
}

test('proofhook integrity: repository lock matches computed closure hash', () => {
  const result = runState();
  assert.equal(result.status, 0, `expected proofhook integrity pass:\n${result.stdout}\n${result.stderr}`);
  const payload = parseJsonOutput(result);
  assert.equal(payload.PROOFHOOK_INTEGRITY_OK, 1);
  assert.equal(payload.code, '');
  assert.equal(payload.details.closureHashComputed, payload.details.closureHashLocked);
  assert.deepEqual(payload.details.mismatches, []);
});

test('proofhook integrity: fixture lock remains deterministic across runs', () => {
  const args = ['--lock-path', FIXTURE_LOCK_PATH, '--root', FIXTURE_DIR];
  const first = runState(args);
  const second = runState(args);

  assert.equal(first.status, 0, `first run failed:\n${first.stdout}\n${first.stderr}`);
  assert.equal(second.status, 0, `second run failed:\n${second.stdout}\n${second.stderr}`);

  const firstPayload = parseJsonOutput(first);
  const secondPayload = parseJsonOutput(second);

  assert.equal(firstPayload.PROOFHOOK_INTEGRITY_OK, 1);
  assert.equal(secondPayload.PROOFHOOK_INTEGRITY_OK, 1);
  assert.equal(firstPayload.details.closureHashComputed, secondPayload.details.closureHashComputed);
  assert.equal(firstPayload.details.closureHashLocked, secondPayload.details.closureHashLocked);
});

test('proofhook integrity: tampered closure file fails with deterministic signal', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofhook-integrity-'));
  const tmpLockPath = path.join(tmpDir, 'PROOFHOOK_INTEGRITY_LOCK.json');
  const tmpAlphaPath = path.join(tmpDir, 'alpha.txt');
  const tmpBetaPath = path.join(tmpDir, 'beta.txt');

  fs.copyFileSync(path.join(FIXTURE_DIR, 'PROOFHOOK_INTEGRITY_LOCK.json'), tmpLockPath);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'alpha.txt'), tmpAlphaPath);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'beta.txt'), tmpBetaPath);
  fs.writeFileSync(tmpBetaPath, 'proofhook beta fixture tampered v2\n', 'utf8');

  const result = runState(['--lock-path', tmpLockPath, '--root', tmpDir]);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected non-zero status for tampered closure');
  const payload = parseJsonOutput(result);
  assert.equal(payload.PROOFHOOK_INTEGRITY_OK, 0);
  assert.equal(payload.code, 'E_PROOFHOOK_TAMPER_DETECTED');
  assert.notEqual(payload.details.closureHashComputed, payload.details.closureHashLocked);
  assert.ok(Array.isArray(payload.details.mismatches));
  assert.ok(payload.details.mismatches.some((item) => item.path === 'beta.txt'));
});

test('proofhook integrity: print lock emits deterministic proposal without pass token semantics', () => {
  const args = ['--print-lock', '--lock-path', FIXTURE_LOCK_PATH, '--root', FIXTURE_DIR];
  const first = runScript(args);
  const second = runScript(args);

  assert.equal(first.status, 0, `first print failed:\n${first.stdout}\n${first.stderr}`);
  assert.equal(second.status, 0, `second print failed:\n${second.stdout}\n${second.stderr}`);
  assert.equal(first.stdout, second.stdout);

  const payload = JSON.parse(first.stdout);
  assert.equal(payload.kind, 'proofhook_integrity_lock_proposal');
  assert.equal(payload.token, undefined);
  assert.equal(payload.okTokenEmitted, undefined);
  assert.equal(payload.tokens, undefined);
  assert.equal(payload.PROOFHOOK_INTEGRITY_OK, undefined);
  assert.equal(payload.lock.closureHash, 'd1e1feb172547a38904e64f48da891a84b89e10789eff1edf599ab5de83c8cea');
});

test('proofhook integrity: write lock requires an explicit target lock path', () => {
  const result = runScript(['--write-lock', '--lock-path', FIXTURE_LOCK_PATH, '--root', FIXTURE_DIR]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /PROOFHOOK_LOCK_WRITE_REQUIRES_EXPLICIT_TARGET_LOCK_PATH=1/);
});

test('proofhook integrity: production lock write requires allow production flag', () => {
  const result = runScript([
    '--write-lock',
    '--lock-path',
    FIXTURE_LOCK_PATH,
    '--target-lock-path',
    'docs/OPS/PROOFHOOKS/PROOFHOOK_INTEGRITY_LOCK.json',
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /PROOFHOOK_LOCK_PRODUCTION_WRITE_REQUIRES_ALLOW_FLAG=1/);
});

test('proofhook integrity: print and write modes are mutually exclusive', () => {
  const result = runScript([
    '--print-lock',
    '--write-lock',
    '--lock-path',
    FIXTURE_LOCK_PATH,
    '--target-lock-path',
    path.join(os.tmpdir(), 'proofhook-integrity-mode-conflict.json'),
    '--root',
    FIXTURE_DIR,
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /PROOFHOOK_LOCK_MODE_CONFLICT=1/);
});

test('proofhook integrity: write lock reads source and updates only explicit target path', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofhook-integrity-write-'));
  const tmpSourceLockPath = path.join(tmpDir, 'PROOFHOOK_INTEGRITY_LOCK_SOURCE.json');
  const tmpTargetLockPath = path.join(tmpDir, 'PROOFHOOK_INTEGRITY_LOCK_TARGET.json');
  const tmpAlphaPath = path.join(tmpDir, 'alpha.txt');
  const tmpBetaPath = path.join(tmpDir, 'beta.txt');

  fs.copyFileSync(path.join(FIXTURE_DIR, 'PROOFHOOK_INTEGRITY_LOCK.json'), tmpSourceLockPath);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'alpha.txt'), tmpAlphaPath);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'beta.txt'), tmpBetaPath);
  fs.writeFileSync(tmpBetaPath, 'proofhook beta fixture tampered v2\n', 'utf8');
  const alphaBefore = fs.readFileSync(tmpAlphaPath, 'utf8');
  const betaBefore = fs.readFileSync(tmpBetaPath, 'utf8');
  const sourceBefore = fs.readFileSync(tmpSourceLockPath, 'utf8');
  const sourceClosurePathsBefore = JSON.stringify(JSON.parse(sourceBefore).closurePaths);

  const result = runScript([
    '--write-lock',
    '--lock-path',
    tmpSourceLockPath,
    '--target-lock-path',
    tmpTargetLockPath,
    '--root',
    tmpDir,
  ]);
  const validation = runState(['--lock-path', tmpTargetLockPath, '--root', tmpDir]);

  assert.equal(result.status, 0, `write failed:\n${result.stdout}\n${result.stderr}`);
  assert.equal(fs.readFileSync(tmpSourceLockPath, 'utf8'), sourceBefore);
  assert.ok(fs.existsSync(tmpTargetLockPath));
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(tmpTargetLockPath, 'utf8')).closurePaths), sourceClosurePathsBefore);
  assert.equal(fs.readFileSync(tmpAlphaPath, 'utf8'), alphaBefore);
  assert.equal(fs.readFileSync(tmpBetaPath, 'utf8'), betaBefore);
  assert.equal(validation.status, 0, `validation failed:\n${validation.stdout}\n${validation.stderr}`);
  assert.deepEqual(
    fs.readdirSync(tmpDir).filter((item) => item.endsWith('.tmp')),
    [],
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('proofhook integrity: default validation does not write a mismatched lock', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofhook-integrity-default-'));
  const tmpLockPath = path.join(tmpDir, 'PROOFHOOK_INTEGRITY_LOCK.json');
  const tmpAlphaPath = path.join(tmpDir, 'alpha.txt');
  const tmpBetaPath = path.join(tmpDir, 'beta.txt');

  fs.copyFileSync(path.join(FIXTURE_DIR, 'PROOFHOOK_INTEGRITY_LOCK.json'), tmpLockPath);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'alpha.txt'), tmpAlphaPath);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'beta.txt'), tmpBetaPath);
  fs.writeFileSync(tmpBetaPath, 'proofhook beta fixture tampered v2\n', 'utf8');
  const lockBefore = fs.readFileSync(tmpLockPath, 'utf8');

  const result = runState(['--lock-path', tmpLockPath, '--root', tmpDir]);

  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(tmpLockPath, 'utf8'), lockBefore);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function tokens(stdout) {
  const entries = String(stdout || '').split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));
  return new Map(entries.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}

function query(extraEnv = {}, extraArgs = []) {
  return spawnSync(process.execPath, ['scripts/doctor.mjs', '--sector-m-tokens', ...extraArgs], {
    encoding: 'utf8',
    env: { ...process.env, SECTOR_U_FAST_DURATION_MS: '10', ...extraEnv },
  });
}

test('Sector M query completes only its read-only scope and retains required diagnostics', () => {
  const result = query();
  const actual = tokens(result.stdout);
  assert.equal(actual.get('DOCTOR_SCOPE'), 'sector-m-tokens', result.stdout + result.stderr);
  assert.equal(actual.get('DOCTOR_FULL_RUN'), '0');
  assert.equal(actual.get('SECTOR_M_TOKEN_QUERY_COMPLETE'), '1');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(actual.get('SECTOR_M_STATUS_OK'), '1');
  assert.equal(actual.get('M0_PROOF_OK'), '1');
  assert.equal(actual.get('CANON_ENTRYPOINT_SPLIT_BRAIN_DETECTED'), '0');
  assert.doesNotMatch(result.stdout, /^(?:DOCTOR_OK|DOCTOR_INFO|CURRENT_WAVE_[A-Z0-9_]*)(?:=|$)/m);
});

test('Sector M query matches every original dependency token from actual full doctor', () => {
  const full = spawnSync(process.execPath, ['scripts/doctor.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, SECTOR_U_FAST_DURATION_MS: '10' },
  });
  assert.equal(full.status, 0, full.stdout + full.stderr);
  assert.equal(tokens(full.stdout).get('CURRENT_WAVE_GUARD_RAN'), '1');
  const scoped = query();
  assert.equal(scoped.status, 0, scoped.stderr);
  const expected = tokens(full.stdout);
  const actual = tokens(scoped.stdout);
  for (const key of ['DOCTOR_SCOPE', 'DOCTOR_FULL_RUN', 'SECTOR_M_TOKEN_QUERY_COMPLETE']) actual.delete(key);
  assert.ok(actual.has('SECTOR_M_STATUS_OK') && actual.has('M0_PROOF_OK') && actual.has('SECTOR_M_CLOSE_OK'));
  assert.ok(actual.has('CANON_ENTRYPOINT_SPLIT_BRAIN_DETECTED'));
  for (const [key, value] of actual) assert.equal(expected.get(key), value, key);
});

test('Sector M query retains missing, malformed, invalid and phase go-tag diagnostics', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-m-query-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const statusPath = path.join(root, 'status.json');
  const base = JSON.parse(fs.readFileSync('docs/OPS/STATUS/SECTOR_M.json', 'utf8'));
  for (const content of [null, '{', JSON.stringify({ ...base, baselineSha: 'invalid' })]) {
    if (content !== null) fs.writeFileSync(statusPath, content);
    const result = query({ SECTOR_M_STATUS_PATH: statusPath });
    assert.equal(result.status, 0, result.stderr);
    const actual = tokens(result.stdout);
    assert.equal(actual.get('SECTOR_M_TOKEN_QUERY_COMPLETE'), '1');
    assert.equal(actual.get('SECTOR_M_STATUS_OK'), '0');
    assert.equal(actual.get('M0_PROOF_OK'), '0');
    assert.doesNotMatch(result.stdout, /^(?:DOCTOR_OK|DOCTOR_INFO|CURRENT_WAVE_[A-Z0-9_]*)(?:=|$)/m);
  }
  const config = { ...base, status: 'IN_PROGRESS', phase: 'M1', goTag: 'GO:SECTOR_M_M2_DONE' };
  fs.writeFileSync(statusPath, JSON.stringify(config));
  const result = query({ SECTOR_M_STATUS_PATH: statusPath });
  assert.equal(result.status, 0, result.stderr);
  const actual = tokens(result.stdout);
  assert.equal(actual.get('SECTOR_M_PHASE'), config.phase);
  assert.equal(actual.get('SECTOR_M_STATUS_OK'), '1');
  assert.equal(actual.get('M1_GO_TAG_RULE_OK'), '0');
  assert.equal(actual.get('M1_CONTRACT_OK'), '0');
});

test('Sector M query refuses substitution for explicit strict or delivery doctor', () => {
  for (const [env, args] of [[{}, ['--strict']], [{ DOCTOR_MODE: 'delivery' }, []], [{ OPS_EXEC_MODE: 'DELIVERY_EXEC' }, []]]) {
    const result = query(env, args);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /ERR_DOCTOR_SCOPE_NOT_FULL/);
    assert.doesNotMatch(result.stdout, /SECTOR_M_TOKEN_QUERY_COMPLETE=1|DOCTOR_OK|CURRENT_WAVE_GUARD_RAN=1/);
  }
});

test('Sector M query preserves fail-closed baseline validation before diagnostic completion', () => {
  const result = query({ CHECKS_BASELINE_VERSION: 'invalid' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /ERR_DOCTOR_INVALID_SHAPE.*invalid_version_token/);
  assert.doesNotMatch(result.stdout, /SECTOR_M_TOKEN_QUERY_COMPLETE=1|DOCTOR_OK|CURRENT_WAVE_GUARD_RAN=1/);
});

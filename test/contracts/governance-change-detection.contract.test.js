const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.join(process.cwd(), 'scripts/ops/governance-change-detection.mjs');
const APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const LOCAL_APPROVALS_PATH = 'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json';
const C1B_APPROVALS_PATH = 'docs/OPS/R24/CORRECTIVE/C1B_GOVERNANCE_CHANGE_APPROVALS_V1.json';
const INTEROP100_APPROVALS_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json';

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
}

function setupTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-change-detection-'));
  runGit(repoRoot, ['init']);
  runGit(repoRoot, ['checkout', '-b', 'main']);
  runGit(repoRoot, ['config', 'user.name', 'contract-test']);
  runGit(repoRoot, ['config', 'user.email', 'contract-test@example.com']);

  const readmePath = path.join(repoRoot, 'README.md');
  fs.writeFileSync(readmePath, '# tmp\n', 'utf8');
  runGit(repoRoot, ['add', 'README.md']);
  runGit(repoRoot, ['commit', '-m', 'init']);

  runGit(repoRoot, ['checkout', '-b', 'feature/test']);
  return repoRoot;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeApprovalRegistry(repoRoot, approvals) {
  writeApprovalRegistryAt(repoRoot, APPROVALS_PATH, approvals);
}

function writeApprovalRegistryAt(repoRoot, relativePath, approvals) {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const payload = {
    version: 'v1.0',
    approvals,
  };
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runState(repoRoot, env = {}) {
  const result = spawnSync(
    process.execPath,
    [SCRIPT_PATH, '--json', '--repo-root', repoRoot, '--base-ref', 'main'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GOVERNANCE_CHANGE_APPROVALS_PATH: APPROVALS_PATH,
        ...env,
      },
    },
  );

  let payload = null;
  assert.doesNotThrow(() => {
    payload = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);

  return { result, payload };
}

test('governance change detection: no governance changes passes', () => {
  const repoRoot = setupTempRepo();

  const appFile = path.join(repoRoot, 'src', 'app.txt');
  fs.mkdirSync(path.dirname(appFile), { recursive: true });
  fs.writeFileSync(appFile, 'runtime-only\n', 'utf8');
  runGit(repoRoot, ['add', 'src/app.txt']);
  runGit(repoRoot, ['commit', '-m', 'runtime-change']);

  const { result, payload } = runState(repoRoot);
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected pass:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.deepEqual(payload.changed_governance_files, []);
});

test('governance change detection: governance change without approval fails', () => {
  const repoRoot = setupTempRepo();

  const protocolFile = path.join(repoRoot, 'docs/OPS/PROTOCOL/TEST.md');
  fs.mkdirSync(path.dirname(protocolFile), { recursive: true });
  fs.writeFileSync(protocolFile, 'governance update\n', 'utf8');
  runGit(repoRoot, ['add', 'docs/OPS/PROTOCOL/TEST.md']);
  runGit(repoRoot, ['commit', '-m', 'governance-change']);

  const { result, payload } = runState(repoRoot);
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected fail when approval is missing');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.failReason, 'GOVERNANCE_CHANGE_APPROVAL_REQUIRED');
  assert.deepEqual(payload.changed_governance_files, ['docs/OPS/PROTOCOL/TEST.md']);
});

test('governance change detection: STRICT + changed + no registry entry fails', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  const { result, payload } = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected strict failure without approval registry entry');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.failReason, 'GOVERNANCE_CHANGE_APPROVAL_REQUIRED');
});

test('governance change detection: STRICT + changed + sha mismatch fails', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript).replace(/.$/u, '0'),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'strict mismatch fixture',
    },
  ]);

  const { result, payload } = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected strict failure on sha mismatch');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.failReason, 'GOVERNANCE_CHANGE_APPROVAL_REQUIRED');
  assert.equal(payload.approval_registry_valid, 0);
});

test('governance change detection: STRICT + env GOV=1 does not bypass approval', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  const { result, payload } = runState(repoRoot, {
    EFFECTIVE_MODE: 'STRICT',
    GOVERNANCE_CHANGE_APPROVED: '1',
  });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected strict failure even with env override');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.governance_change_approved_env, 0);
});

test('governance change detection: STRICT + exact registry approval passes', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'artifact approval fixture',
    },
  ]);

  const first = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  const second = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(first.result.status, 0, `expected strict approved pass:\n${first.result.stdout}\n${first.result.stderr}`);
  assert.equal(second.result.status, 0, `expected strict deterministic approved pass:\n${second.result.stdout}\n${second.result.stderr}`);
  assert.equal(first.payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.equal(second.payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.deepEqual(first.payload.changed_governance_files, [
    'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json',
    'scripts/ops/custom-state.mjs',
  ]);
  assert.deepEqual(first.payload.changed_governance_files, second.payload.changed_governance_files);
});

test('governance change detection: STRICT accepts exact interop secondary approval registry when it is changed', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  writeApprovalRegistry(repoRoot, []);
  writeApprovalRegistryAt(repoRoot, INTEROP100_APPROVALS_PATH, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact interop secondary registry fixture',
    },
  ]);
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'interop-secondary-approval']);

  const { result, payload } = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected strict secondary approved pass:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.deepEqual(payload.missing_approvals, []);
  assert.deepEqual(payload.changed_governance_files, [
    'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json',
    'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json',
    'scripts/ops/custom-state.mjs',
  ]);
});

test('governance change detection: STRICT accepts exact default secondary approval registry when local primary is changed', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  writeApprovalRegistryAt(repoRoot, LOCAL_APPROVALS_PATH, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact local primary registry fixture',
    },
  ]);
  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact default secondary registry fixture for changed governed artifact',
    },
  ]);
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'default-secondary-local-primary']);

  const { result, payload } = runState(repoRoot, {
    EFFECTIVE_MODE: 'STRICT',
    GOVERNANCE_CHANGE_APPROVALS_PATH: LOCAL_APPROVALS_PATH,
  });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected strict default secondary approved pass:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.deepEqual(payload.missing_approvals, []);
  assert.deepEqual(payload.changed_governance_files, [
    'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json',
    'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json',
    'scripts/ops/custom-state.mjs',
  ]);
});

test('governance change detection: STRICT accepts interop secondary registry when primary registry is stale', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  const staleTarget = path.join(repoRoot, 'src/stale-primary.txt');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  fs.mkdirSync(path.dirname(staleTarget), { recursive: true });
  fs.writeFileSync(staleTarget, 'stale primary 1\n', 'utf8');
  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'src/stale-primary.txt',
      sha256: sha256File(staleTarget),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'primary registry stale before changed secondary takes authority',
    },
  ]);
  fs.writeFileSync(staleTarget, 'stale primary 2\n', 'utf8');
  writeApprovalRegistryAt(repoRoot, INTEROP100_APPROVALS_PATH, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact interop secondary registry fixture with stale primary present',
    },
  ]);
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'interop-secondary-approval-stale-primary']);

  const { result, payload } = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected secondary registry pass despite stale primary:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.equal(payload.approval_registry_valid, 1);
  assert.equal(payload.approval_registry_fail_reason, '');
  assert.deepEqual(payload.missing_approvals, []);
});

test('governance change detection: STRICT accepts exact global secondary approval registry when it is changed', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  writeApprovalRegistryAt(repoRoot, C1B_APPROVALS_PATH, []);
  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact global secondary registry fixture',
    },
  ]);
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'global-secondary-approval']);

  const { result, payload } = runState(repoRoot, {
    EFFECTIVE_MODE: 'STRICT',
    GOVERNANCE_CHANGE_APPROVALS_PATH: C1B_APPROVALS_PATH,
  });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected strict global secondary approved pass:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.deepEqual(payload.missing_approvals, []);
  assert.deepEqual(payload.changed_governance_files, [
    'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json',
    'docs/OPS/R24/CORRECTIVE/C1B_GOVERNANCE_CHANGE_APPROVALS_V1.json',
    'scripts/ops/custom-state.mjs',
  ]);
});

test('governance change detection: STRICT accepts global secondary exact current approvals without using stale unrelated entries', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  const staleTarget = path.join(repoRoot, 'src/stale-unrelated.txt');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  fs.mkdirSync(path.dirname(staleTarget), { recursive: true });
  fs.writeFileSync(staleTarget, 'stale unrelated 1\n', 'utf8');
  writeApprovalRegistryAt(repoRoot, C1B_APPROVALS_PATH, []);
  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'src/stale-unrelated.txt',
      sha256: sha256File(staleTarget),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'stale unrelated global registry fixture',
    },
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact global secondary current diff fixture',
    },
  ]);
  fs.writeFileSync(staleTarget, 'stale unrelated 2\n', 'utf8');
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs', 'src/stale-unrelated.txt']);
  runGit(repoRoot, ['commit', '-m', 'global-secondary-approval-with-stale-unrelated-entry']);

  const { result, payload } = runState(repoRoot, {
    EFFECTIVE_MODE: 'STRICT',
    GOVERNANCE_CHANGE_APPROVALS_PATH: C1B_APPROVALS_PATH,
  });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected global secondary exact approval pass:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.deepEqual(payload.missing_approvals, []);
});

test('governance change detection: STRICT rejects stale default secondary approval registry with local primary', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  writeApprovalRegistryAt(repoRoot, LOCAL_APPROVALS_PATH, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'exact local primary registry fixture',
    },
  ]);
  writeApprovalRegistry(repoRoot, [
    {
      filePath: LOCAL_APPROVALS_PATH,
      sha256: '0'.repeat(64),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'stale default secondary registry fixture',
    },
  ]);
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'default-secondary-stale']);

  const { result, payload } = runState(repoRoot, {
    EFFECTIVE_MODE: 'STRICT',
    GOVERNANCE_CHANGE_APPROVALS_PATH: LOCAL_APPROVALS_PATH,
  });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected strict failure on stale default secondary registry');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.failReason, 'GOVERNANCE_CHANGE_APPROVAL_REQUIRED');
  assert(payload.missing_approvals.some((entry) => entry.filePath === APPROVALS_PATH));
});

test('governance change detection: STRICT rejects interop secondary approval registry with stale bytes', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  writeApprovalRegistry(repoRoot, []);
  writeApprovalRegistryAt(repoRoot, INTEROP100_APPROVALS_PATH, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript).replace(/.$/u, '0'),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'stale interop secondary registry fixture',
    },
  ]);
  runGit(repoRoot, ['add', 'docs/OPS', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'interop-secondary-approval-stale']);

  const { result, payload } = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected strict failure on stale secondary registry');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.failReason, 'GOVERNANCE_CHANGE_APPROVAL_REQUIRED');
  assert(payload.missing_approvals.some((entry) => entry.filePath === 'scripts/ops/custom-state.mjs'));
  assert(payload.missing_approvals.some((entry) => entry.filePath === INTEROP100_APPROVALS_PATH));
});

test('governance change detection: STRICT rejects exact bytes with future approval UTC', () => {
  const repoRoot = setupTempRepo();
  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript),
      approvedBy: 'contract-test',
      approvedAtUtc: '2099-01-01T00:00:00.000Z',
      rationale: 'hostile future UTC fixture',
    },
  ]);

  const { result, payload } = runState(repoRoot, { EFFECTIVE_MODE: 'STRICT' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected strict future-UTC failure');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.approval_registry_valid, 0);
  assert.equal(payload.failReason, 'GOVERNANCE_CHANGE_APPROVAL_REQUIRED');
});

test('governance change detection: env override remains fallback in non-strict when registry is absent', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  const { result, payload } = runState(repoRoot, { GOVERNANCE_CHANGE_APPROVED: '1' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(result.status, 0, `expected env-approved pass:\n${result.stdout}\n${result.stderr}`);
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 1);
  assert.equal(payload.governance_change_approved_env, 1);
  assert.deepEqual(payload.changed_governance_files, ['scripts/ops/custom-state.mjs']);
});

test('governance change detection: non-strict env override cannot bypass registry mismatch', () => {
  const repoRoot = setupTempRepo();

  const opsScript = path.join(repoRoot, 'scripts/ops/custom-state.mjs');
  fs.mkdirSync(path.dirname(opsScript), { recursive: true });
  fs.writeFileSync(opsScript, 'export const v = 1;\n', 'utf8');
  runGit(repoRoot, ['add', 'scripts/ops/custom-state.mjs']);
  runGit(repoRoot, ['commit', '-m', 'ops-script-change']);

  writeApprovalRegistry(repoRoot, [
    {
      filePath: 'scripts/ops/custom-state.mjs',
      sha256: sha256File(opsScript).replace(/.$/u, '0'),
      approvedBy: 'contract-test',
      approvedAtUtc: '2026-02-13T00:00:00.000Z',
      rationale: 'non-strict mismatch fixture',
    },
  ]);

  const { result, payload } = runState(repoRoot, { GOVERNANCE_CHANGE_APPROVED: '1' });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'expected failure when registry exists but mismatches');
  assert.equal(payload.tokens.GOVERNANCE_CHANGE_OK, 0);
  assert.equal(payload.governance_change_approved_env, 1);
  assert.equal(payload.approval_registry_valid, 0);
});

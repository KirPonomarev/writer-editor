const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'release-gate-exit-nonzero-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'RELEASE_GATE_EXIT_NONZERO_v3.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const BINDING_SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'BINDING_SCHEMA_V1.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function runNode(args) {
  return spawnSync(process.execPath, [MODULE_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function collectEffectiveCase() {
  const statusDoc = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  const phaseSwitchDoc = JSON.parse(fs.readFileSync(PHASE_SWITCH_PATH, 'utf8'));
  const bindingDoc = JSON.parse(fs.readFileSync(BINDING_SCHEMA_PATH, 'utf8'));

  const activePhase = String(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE || '').trim();
  const requiredSetPath = path.join(REPO_ROOT, String(statusDoc.requiredSets[activePhase] || '').trim());
  const requiredSetDoc = JSON.parse(fs.readFileSync(requiredSetPath, 'utf8'));
  const tokenId = String(requiredSetDoc.effectiveRequiredTokenIds?.[0] || '').trim();
  assert.ok(tokenId, 'missing effective required token');

  const row = (bindingDoc.records || []).find((entry) => entry && entry.TOKEN_ID === tokenId);
  assert.ok(row, 'missing binding schema row for effective token');
  const failSignalCode = String(row.FAILSIGNAL_CODE || '').trim();
  assert.ok(failSignalCode, 'missing fail signal code in binding schema row');

  return { tokenId, failSignalCode };
}

function createFailMapFixture(cases) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-p0-07-fail-map-'));
  const failMapPath = path.join(tmpDir, 'fail-map.json');
  fs.writeFileSync(failMapPath, `${JSON.stringify({ version: 3, cases }, null, 2)}\n`, 'utf8');
  return { tmpDir, failMapPath };
}

function findAdvisorySignalCode() {
  const registry = JSON.parse(fs.readFileSync(FAILSIGNAL_REGISTRY_PATH, 'utf8'));
  for (const row of registry.failSignals || []) {
    if (!row || !row.code || !row.modeMatrix) continue;
    const mode = String(row.modeMatrix.prCore || '').trim().toLowerCase();
    if (mode === 'advisory') return String(row.code);
  }
  return '';
}

test('release gate nonzero: effective release-required token failure returns nonzero exit', async () => {
  const { tokenId, failSignalCode } = collectEffectiveCase();

  const releaseRun = runNode([
    '--mode', 'release',
    '--force-fail-token-id', tokenId,
    '--force-fail-signal-code', failSignalCode,
    '--status-path', STATUS_PATH,
    '--phase-switch-path', PHASE_SWITCH_PATH,
    '--binding-schema-path', BINDING_SCHEMA_PATH,
  ]);

  assert.notEqual(releaseRun.status, 0);
});

test('release gate nonzero: aggregated failure cannot be suppressed to zero', async () => {
  const { tokenId, failSignalCode } = collectEffectiveCase();
  const fixture = createFailMapFixture([
    { tokenId, failSignalCode, failed: true },
  ]);

  try {
    const run = runNode([
      '--json',
      '--mode', 'release',
      '--fail-map-path', fixture.failMapPath,
      '--status-path', STATUS_PATH,
      '--phase-switch-path', PHASE_SWITCH_PATH,
      '--binding-schema-path', BINDING_SCHEMA_PATH,
      '--suppress-failures',
    ]);

    assert.notEqual(run.status, 0);
    const state = JSON.parse(run.stdout || '{}');
    assert.equal(state.failReason, 'E_DEFAULT_ZERO_EXIT_ON_FAIL');
    assert.equal(state.suppressionPrevented, true);
  } finally {
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});

test('release gate nonzero: release and promotion propagate nonzero exit', async () => {
  const { tokenId, failSignalCode } = collectEffectiveCase();

  const releaseRun = runNode([
    '--mode', 'release',
    '--force-fail-token-id', tokenId,
    '--force-fail-signal-code', failSignalCode,
    '--status-path', STATUS_PATH,
    '--phase-switch-path', PHASE_SWITCH_PATH,
    '--binding-schema-path', BINDING_SCHEMA_PATH,
  ]);
  const promotionRun = runNode([
    '--mode', 'promotion',
    '--force-fail-token-id', tokenId,
    '--force-fail-signal-code', failSignalCode,
    '--status-path', STATUS_PATH,
    '--phase-switch-path', PHASE_SWITCH_PATH,
    '--binding-schema-path', BINDING_SCHEMA_PATH,
  ]);

  assert.notEqual(releaseRun.status, 0);
  assert.notEqual(promotionRun.status, 0);
});

test('release gate nonzero: advisory signals remain non-blocking outside canon mode matrix', async () => {
  const advisorySignalCode = findAdvisorySignalCode();
  assert.ok(advisorySignalCode, 'missing advisory fail signal for probe');

  const run = runNode([
    '--json',
    '--mode', 'pr',
    '--advisory-probe-fail-signal-code', advisorySignalCode,
    '--status-path', STATUS_PATH,
    '--phase-switch-path', PHASE_SWITCH_PATH,
    '--binding-schema-path', BINDING_SCHEMA_PATH,
  ]);

  assert.equal(run.status, 0);
  const state = JSON.parse(run.stdout || '{}');
  assert.equal(state.nonzeroExitRequired, false);
  assert.equal(state.advisoryProbeNonBlockingCount >= 1, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const EVALUATOR_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'canonical-mode-matrix-evaluator.mjs');
const MODE_MATRIX_STATE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'mode-matrix-single-authority-state.mjs');
const COMMAND_NAMESPACE_STATIC_CHECK_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'check-command-namespace-static.mjs');
const EXECUTION_SEQUENCE_CHECK_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'check-execution-sequence.mjs');

let evaluatorModulePromise = null;
let modeMatrixStateModulePromise = null;

function loadEvaluatorModule() {
  if (!evaluatorModulePromise) {
    evaluatorModulePromise = import(pathToFileURL(EVALUATOR_PATH).href);
  }
  return evaluatorModulePromise;
}

function loadModeMatrixStateModule() {
  if (!modeMatrixStateModulePromise) {
    modeMatrixStateModulePromise = import(pathToFileURL(MODE_MATRIX_STATE_PATH).href);
  }
  return modeMatrixStateModulePromise;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseJsonOutput(result) {
  let payload = null;
  assert.doesNotThrow(() => {
    payload = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return payload;
}

function runNode(scriptPath, args = [], cwd = REPO_ROOT) {
  return spawnSync(process.execPath, [scriptPath, '--json', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function makeFixtureLaw(sequence) {
  const lines = sequence.map((token, index) => {
    if (index === 0) return `\`${token}\``;
    return `→ \`${token}\``;
  });
  return [
    '# LAW',
    '',
    '### A1) EXECUTION SEQUENCE (BINDING)',
    ...lines,
    '',
    'Fail candidate: `E_SEQUENCE_ORDER_DRIFT`',
    '',
    '#### A1.1) OPS_INTEGRITY_P0 (DEFINITION, BINDING)',
    '`OPS_INTEGRITY_P0`',
  ].join('\n');
}

function makeExecutionSequenceFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-matrix-single-authority-'));
  const canonRelPath = path.join('docs', 'OPS', 'STATUS', 'EXECUTION_SEQUENCE_CANON_v1.json');
  const lawPathCanonRelPath = path.join('docs', 'OPS', 'STATUS', 'LAW_PATH_CANON.json');
  const lawRelPath = path.join('docs', 'OPS', 'STATUS', 'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.12.md');

  const canonSequence = [
    'CORE_SOT_EXECUTABLE',
    'CAPABILITY_ENFORCEMENT',
    'OPS_INTEGRITY_P0',
    'XPLAT_ARCHITECTURE_CONTRACT',
  ];

  writeJson(path.join(root, canonRelPath), {
    version: 1,
    sequence: canonSequence,
  });
  writeJson(path.join(root, lawPathCanonRelPath), {
    version: 1,
    lawDocPath: lawRelPath.replaceAll(path.sep, '/'),
    lawDocId: 'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT',
    status: 'ACTIVE_CANON',
    notes: 'fixture',
  });
  const lawAbsPath = path.join(root, lawRelPath);
  fs.mkdirSync(path.dirname(lawAbsPath), { recursive: true });
  fs.writeFileSync(lawAbsPath, `${makeFixtureLaw(canonSequence)}\n`, 'utf8');

  return {
    root,
    lawAbsPath,
    canonSequence,
  };
}

test('mode-matrix single authority: evaluator mirrors failSignal registry for pr/release/promotion', async () => {
  const registry = readJson(FAILSIGNAL_REGISTRY_PATH);
  const { evaluateModeMatrixVerdict, CANONICAL_MODE_MATRIX_EVALUATOR_ID } = await loadEvaluatorModule();

  assert.equal(CANONICAL_MODE_MATRIX_EVALUATOR_ID, 'CANONICAL_MODE_MATRIX_EVALUATOR_V1');

  const modePairs = [
    { cliMode: 'pr', key: 'prCore' },
    { cliMode: 'release', key: 'release' },
    { cliMode: 'promotion', key: 'promotion' },
  ];

  const mismatches = [];
  for (const row of registry.failSignals || []) {
    if (!row || typeof row.code !== 'string' || !row.code.trim()) continue;
    for (const modePair of modePairs) {
      const actual = evaluateModeMatrixVerdict({
        repoRoot: REPO_ROOT,
        mode: modePair.cliMode,
        failSignalCode: row.code,
      });
      const expectedDisposition = String((row.modeMatrix || {})[modePair.key] || '').trim();
      if (expectedDisposition !== 'advisory' && expectedDisposition !== 'blocking') continue;
      const expectedShouldBlock = expectedDisposition === 'blocking';
      if (!actual.ok || actual.modeDisposition !== expectedDisposition || actual.shouldBlock !== expectedShouldBlock) {
        mismatches.push({
          failSignalCode: row.code,
          mode: modePair.cliMode,
          expectedDisposition,
          actualDisposition: actual.modeDisposition,
          expectedShouldBlock,
          actualShouldBlock: actual.shouldBlock,
          actualOk: actual.ok,
        });
      }
    }
  }

  assert.deepEqual(mismatches, []);
});

test('mode-matrix single authority: advisory failSignal in pr mode cannot block namespace static check', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-matrix-pr-advisory-'));
  fs.writeFileSync(path.join(tmpDir, 'fixture.mjs'), "export const legacyId = 'cmd.file.save';\n", 'utf8');

  const result = runNode(COMMAND_NAMESPACE_STATIC_CHECK_PATH, ['--mode=pr', '--scan-root', tmpDir]);
  assert.equal(result.status, 0, `pr advisory case must not block:\n${result.stdout}\n${result.stderr}`);
  const payload = parseJsonOutput(result);

  assert.equal(payload.result, 'WARN');
  assert.equal(payload.failSignalCode, 'E_COMMAND_NAMESPACE_UNKNOWN');
  assert.equal(payload.canonicalModeMatrixEvaluatorId, 'CANONICAL_MODE_MATRIX_EVALUATOR_V1');
  assert.equal(payload.modeDecision.modeDisposition, 'advisory');
  assert.equal(payload.modeDecision.shouldBlock, false);
});

test('mode-matrix single authority: sequence drift verdict is repeatable across three identical runs', () => {
  const fixture = makeExecutionSequenceFixtureRepo();
  try {
    const driftedLaw = makeFixtureLaw([
      fixture.canonSequence[1],
      fixture.canonSequence[0],
      fixture.canonSequence[2],
      fixture.canonSequence[3],
    ]);
    fs.writeFileSync(fixture.lawAbsPath, `${driftedLaw}\n`, 'utf8');

    const runs = [];
    for (let i = 0; i < 3; i += 1) {
      const run = runNode(EXECUTION_SEQUENCE_CHECK_PATH, ['--repo-root', fixture.root, '--mode=release']);
      assert.notEqual(run.status, 0, `release must block sequence drift:\n${run.stdout}\n${run.stderr}`);
      runs.push(parseJsonOutput(run));
    }

    const normalizedRuns = runs.map((payload) => ({
      result: payload.result,
      failSignalCode: payload.failSignalCode,
      failReason: payload.failReason,
      evaluatorId: payload.canonicalModeMatrixEvaluatorId,
      modeDecision: payload.modeDecision,
    }));

    assert.deepEqual(normalizedRuns[0], normalizedRuns[1]);
    assert.deepEqual(normalizedRuns[1], normalizedRuns[2]);
    assert.equal(normalizedRuns[0].result, 'FAIL');
    assert.equal(normalizedRuns[0].evaluatorId, 'CANONICAL_MODE_MATRIX_EVALUATOR_V1');
    assert.equal(normalizedRuns[0].modeDecision.modeDisposition, 'blocking');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('mode-matrix single authority: claim blocking flag cannot override canonical mode disposition', async () => {
  const { evaluateModeMatrixSingleAuthorityState } = await loadModeMatrixStateModule();
  const state = evaluateModeMatrixSingleAuthorityState({ repoRoot: REPO_ROOT });

  assert.equal(state.gates.mc_claim_level_blocking_cannot_override_mode_disposition, 'PASS');
  assert.equal(state.claimOverrideViolationCount, 0);
});

test('mode-matrix single authority: phase precedence is applied before new V1 verdicts', async () => {
  const { evaluateModeMatrixSingleAuthorityState } = await loadModeMatrixStateModule();
  const state = evaluateModeMatrixSingleAuthorityState({ repoRoot: REPO_ROOT });

  assert.equal(state.gates.mc_phase_switch_valid, 'PASS');
  assert.equal(state.gates.mc_phase_precedence_applied_before_new_v1_verdicts, 'PASS');
  assert.equal(state.details.phasePrecedenceState.baseRuleOk, true);
  assert.equal(state.details.phasePrecedenceState.samples[0].shouldBlock, false);
  assert.equal(state.details.phasePrecedenceState.samples[1].shouldBlock, false);
  assert.equal(state.details.phasePrecedenceState.samples[2].shouldBlock, true);
});

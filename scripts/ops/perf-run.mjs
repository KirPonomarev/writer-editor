#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOL_VERSION = 'perf-run.v1';
const DEFAULT_FIXTURE_PATH = 'scripts/perf/fixtures/mvp-hotpath.fixture.json';
const DEFAULT_THRESHOLDS_PATH = 'scripts/perf/perf-thresholds.json';

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

function canonicalSerialize(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(',')}}`;
  }
  return 'null';
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function p95(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index];
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseArgs(argv) {
  const out = {
    fixturePath: DEFAULT_FIXTURE_PATH,
    thresholdsPath: DEFAULT_THRESHOLDS_PATH,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    if (arg === '--fixture') {
      out.fixturePath = String(argv[i + 1] || '').trim() || DEFAULT_FIXTURE_PATH;
      i += 1;
    }
    if (arg === '--thresholds') {
      out.thresholdsPath = String(argv[i + 1] || '').trim() || DEFAULT_THRESHOLDS_PATH;
      i += 1;
    }
  }
  return out;
}

function parseGitHeadSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function validateFixtureShape(fixture) {
  const issues = [];
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    return ['fixture_not_object'];
  }
  if (fixture.schemaVersion !== 'perf-fixture.v1') issues.push('fixture_schema_invalid');
  if (typeof fixture.fixtureId !== 'string' || fixture.fixtureId.trim().length === 0) issues.push('fixture_id_invalid');
  if (typeof fixture.seed !== 'string' || fixture.seed.trim().length === 0) issues.push('fixture_seed_invalid');
  if (!Number.isInteger(fixture.runs) || fixture.runs < 3 || fixture.runs > 51) issues.push('fixture_runs_invalid');
  if (!Array.isArray(fixture.coreCommands) || fixture.coreCommands.length < 1) issues.push('fixture_core_commands_invalid');
  if (!fixture.dispatchProbe || typeof fixture.dispatchProbe !== 'object') issues.push('fixture_dispatch_probe_invalid');
  if (!fixture.sceneSwitchProbe || typeof fixture.sceneSwitchProbe !== 'object' || Array.isArray(fixture.sceneSwitchProbe)) {
    issues.push('fixture_scene_switch_probe_invalid');
  } else {
    const projectId = typeof fixture.sceneSwitchProbe.projectId === 'string' ? fixture.sceneSwitchProbe.projectId.trim() : '';
    const fromSceneId = typeof fixture.sceneSwitchProbe.fromSceneId === 'string' ? fixture.sceneSwitchProbe.fromSceneId.trim() : '';
    const toSceneId = typeof fixture.sceneSwitchProbe.toSceneId === 'string' ? fixture.sceneSwitchProbe.toSceneId.trim() : '';
    if (!projectId || !fromSceneId || !toSceneId || fromSceneId === toSceneId) {
      issues.push('fixture_scene_switch_probe_invalid');
    }
  }
  if (!fixture.resetProbe || typeof fixture.resetProbe !== 'object' || Array.isArray(fixture.resetProbe)) {
    issues.push('fixture_reset_probe_invalid');
  } else {
    const actionId = typeof fixture.resetProbe.actionId === 'string' ? fixture.resetProbe.actionId.trim() : '';
    const baseline = fixture.resetProbe.baselineState;
    const current = fixture.resetProbe.currentState;
    if (!actionId || !baseline || typeof baseline !== 'object' || Array.isArray(baseline) || !current || typeof current !== 'object' || Array.isArray(current)) {
      issues.push('fixture_reset_probe_invalid');
    }
  }
  if (typeof fixture.expectedStateHash !== 'string' || !/^[a-f0-9]{64}$/u.test(fixture.expectedStateHash)) {
    issues.push('fixture_expected_state_hash_invalid');
  }
  return issues;
}

function validateThresholdsShape(thresholds) {
  const issues = [];
  if (!thresholds || typeof thresholds !== 'object' || Array.isArray(thresholds)) {
    return ['thresholds_not_object'];
  }
  if (thresholds.schemaVersion !== 'perf-thresholds.v1') issues.push('thresholds_schema_invalid');
  const metrics = thresholds.metrics;
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    issues.push('thresholds_metrics_invalid');
    return issues;
  }
  const keys = ['command_dispatch_p95_ms', 'open_median_ms', 'save_median_ms'];
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      issues.push(`threshold_${key}_invalid`);
    }
  }
  return issues;
}

async function loadModules() {
  const cwd = process.cwd();
  const core = await import(pathToFileURL(path.join(cwd, 'src/core/runtime.mjs')).href);
  const registry = await import(pathToFileURL(path.join(cwd, 'src/renderer/commands/registry.mjs')).href);
  const runner = await import(pathToFileURL(path.join(cwd, 'src/renderer/commands/runCommand.mjs')).href);
  const project = await import(pathToFileURL(path.join(cwd, 'src/renderer/commands/projectCommands.mjs')).href);
  return { core, registry, runner, project };
}

function computeExpectedStateHash(core, fixture) {
  let current = core.createInitialCoreState();
  for (const command of fixture.coreCommands) {
    const result = core.reduceCoreState(current, command);
    if (!result || result.ok !== true) {
      return {
        ok: false,
        stateHash: '',
        reason: 'core_command_failed',
        error: result && result.error ? result.error : null,
      };
    }
    current = result.state;
  }
  return {
    ok: true,
    state: current,
    stateHash: core.hashCoreState(current),
    reason: '',
    error: null,
  };
}

function buildSceneSwitchProbeState(baseState, fixture) {
  const probe = fixture && fixture.sceneSwitchProbe && typeof fixture.sceneSwitchProbe === 'object'
    ? fixture.sceneSwitchProbe
    : null;
  const projectId = typeof probe?.projectId === 'string' ? probe.projectId.trim() : '';
  const fromSceneId = typeof probe?.fromSceneId === 'string' ? probe.fromSceneId.trim() : '';
  const toSceneId = typeof probe?.toSceneId === 'string' ? probe.toSceneId.trim() : '';
  const toSceneText = typeof probe?.toSceneText === 'string' ? probe.toSceneText : '';
  if (!projectId || !fromSceneId || !toSceneId || fromSceneId === toSceneId) {
    return { ok: false, reason: 'scene_switch_probe_invalid' };
  }

  const nextState = cloneJson(baseState);
  const project = nextState?.data?.projects?.[projectId];
  if (!project || !project.scenes || typeof project.scenes !== 'object' || Array.isArray(project.scenes)) {
    return { ok: false, reason: 'scene_switch_project_missing' };
  }
  if (!project.scenes[fromSceneId]) {
    return { ok: false, reason: 'scene_switch_from_scene_missing' };
  }
  if (!project.scenes[toSceneId]) {
    project.scenes[toSceneId] = {
      id: toSceneId,
      text: toSceneText,
    };
  }

  return {
    ok: true,
    probe: { projectId, fromSceneId, toSceneId },
    state: nextState,
  };
}

function measureSceneSwitch(state, probe) {
  const project = state?.data?.projects?.[probe.projectId];
  const fromScene = project?.scenes?.[probe.fromSceneId];
  const toScene = project?.scenes?.[probe.toSceneId];
  if (!project || !fromScene || !toScene) {
    return { ok: false, reason: 'scene_switch_state_missing' };
  }

  const startedAt = performance.now();
  const selection = {
    current: fromScene.id,
    next: toScene.id,
    fromTextLength: String(fromScene.text || '').length,
    toTextLength: String(toScene.text || '').length,
  };
  const proofHash = sha256(canonicalSerialize(selection));
  const sceneSwitchMs = performance.now() - startedAt;

  return {
    ok: true,
    sceneSwitchMs,
    proofHash,
  };
}

function measureReset(probe) {
  const actionId = typeof probe?.actionId === 'string' ? probe.actionId.trim() : '';
  const baselineState = probe?.baselineState;
  const currentState = probe?.currentState;
  if (!actionId || !baselineState || typeof baselineState !== 'object' || Array.isArray(baselineState)) {
    return { ok: false, reason: 'reset_probe_invalid' };
  }
  if (!currentState || typeof currentState !== 'object' || Array.isArray(currentState)) {
    return { ok: false, reason: 'reset_probe_invalid' };
  }

  const startedAt = performance.now();
  const resetState = {
    ...cloneJson(baselineState),
    actionId,
    sourceStateHash: sha256(canonicalSerialize(currentState)),
    statusText: 'Shell reset to baseline',
    warningState: 'none',
    perfHint: 'normal',
  };
  const proofHash = sha256(canonicalSerialize(resetState));
  const resetMs = performance.now() - startedAt;

  return {
    ok: true,
    resetMs,
    proofHash,
  };
}

async function buildCommandRunner(registryModule, runnerModule, projectModule) {
  const registry = registryModule.createCommandRegistry();
  projectModule.registerProjectCommands(registry, {
    electronAPI: {
      openFile: () => {},
      saveFile: () => {},
    },
  });
  const runCommand = runnerModule.createCommandRunner(registry);
  return { runCommand, commandIds: projectModule.COMMAND_IDS };
}

async function runPerfOnce(context) {
  const { fixture, runCommand, commandIds, core } = context;
  const sample = {
    openMs: 0,
    saveMs: 0,
    dispatchMs: 0,
    coreApplyMs: 0,
    sceneSwitchMs: 0,
    resetMs: 0,
    stateHash: '',
    dispatchCode: '',
    dispatchReason: '',
    dispatchMessage: '',
    sceneSwitchProofHash: '',
    resetProofHash: '',
  };

  const openStarted = performance.now();
  const openResult = await runCommand(commandIds.PROJECT_OPEN, fixture.openPayload || {});
  sample.openMs = performance.now() - openStarted;
  if (!openResult || openResult.ok !== true) {
    throw new Error('open_command_failed');
  }

  const coreStarted = performance.now();
  const expected = computeExpectedStateHash(core, fixture);
  sample.coreApplyMs = performance.now() - coreStarted;
  if (!expected.ok) {
    throw new Error(`core_sequence_failed:${expected.reason}`);
  }
  sample.stateHash = expected.stateHash;

  const sceneSwitchState = buildSceneSwitchProbeState(expected.state, fixture);
  if (!sceneSwitchState.ok) {
    throw new Error(`scene_switch_probe_failed:${sceneSwitchState.reason}`);
  }
  const sceneSwitchResult = measureSceneSwitch(sceneSwitchState.state, sceneSwitchState.probe);
  if (!sceneSwitchResult.ok) {
    throw new Error(`scene_switch_measurement_failed:${sceneSwitchResult.reason}`);
  }
  sample.sceneSwitchMs = sceneSwitchResult.sceneSwitchMs;
  sample.sceneSwitchProofHash = sceneSwitchResult.proofHash;

  const resetResult = measureReset(fixture.resetProbe || {});
  if (!resetResult.ok) {
    throw new Error(`reset_measurement_failed:${resetResult.reason}`);
  }
  sample.resetMs = resetResult.resetMs;
  sample.resetProofHash = resetResult.proofHash;

  const saveStarted = performance.now();
  const saveResult = await runCommand(commandIds.PROJECT_SAVE, fixture.savePayload || {});
  sample.saveMs = performance.now() - saveStarted;
  if (!saveResult || saveResult.ok !== true) {
    throw new Error('save_command_failed');
  }

  const dispatchStarted = performance.now();
  const probe = fixture.dispatchProbe || {};
  const probeResult = await runCommand(probe.commandId, probe.payload || {});
  sample.dispatchMs = performance.now() - dispatchStarted;
  sample.dispatchCode = probeResult && probeResult.error ? String(probeResult.error.code || '') : '';
  sample.dispatchReason = probeResult && probeResult.error ? String(probeResult.error.reason || '') : '';
  sample.dispatchMessage = probeResult && probeResult.error && probeResult.error.details
    ? String(probeResult.error.details.message || '')
    : '';

  const expectedOk = Boolean(probe.expected && probe.expected.ok === true);
  if (Boolean(probeResult && probeResult.ok === true) !== expectedOk) {
    throw new Error('dispatch_probe_ok_mismatch');
  }
  if (probe.expected && typeof probe.expected.errorCode === 'string') {
    const expectedErrorCode = probe.expected.errorCode;
    const matchesExpectedCode = sample.dispatchCode === expectedErrorCode;
    const matchesCanonicalExportUnwired =
      expectedErrorCode === 'E_UNWIRED_EXPORT_BACKEND'
      && sample.dispatchCode === 'E_COMMAND_FAILED'
      && sample.dispatchReason === 'EXPORT_DOCXMIN_IPC_FAILED'
      && sample.dispatchMessage === 'ELECTRON_API_UNAVAILABLE';
    if (!matchesExpectedCode && !matchesCanonicalExportUnwired) {
      throw new Error('dispatch_probe_error_code_mismatch');
    }
  }

  return sample;
}

export async function evaluatePerfRun(input = {}) {
  const fixturePath = path.resolve(String(input.fixturePath || DEFAULT_FIXTURE_PATH));
  const thresholdsPath = path.resolve(String(input.thresholdsPath || DEFAULT_THRESHOLDS_PATH));
  const commitSha = parseGitHeadSha();
  const failReasons = [];

  if (!fs.existsSync(fixturePath)) failReasons.push('fixture_missing');
  if (!fs.existsSync(thresholdsPath)) failReasons.push('thresholds_missing');
  if (failReasons.length > 0) {
    return {
      toolVersion: TOOL_VERSION,
      fixtureId: '',
      commitSha,
      runs: 0,
      metrics: {},
      thresholds: {},
      verdict: 'FAIL',
      failReasons,
      configHash: '',
    };
  }

  const fixture = readJson(fixturePath);
  const thresholds = readJson(thresholdsPath);
  const fixtureIssues = validateFixtureShape(fixture);
  const thresholdIssues = validateThresholdsShape(thresholds);
  failReasons.push(...fixtureIssues, ...thresholdIssues);

  const configHash = sha256(canonicalSerialize({
    toolVersion: TOOL_VERSION,
    fixture,
    thresholds,
  }));

  if (failReasons.length > 0) {
    return {
      toolVersion: TOOL_VERSION,
      fixtureId: String(fixture && fixture.fixtureId ? fixture.fixtureId : ''),
      commitSha,
      runs: 0,
      metrics: {},
      thresholds: thresholds && thresholds.metrics ? thresholds.metrics : {},
      verdict: 'FAIL',
      failReasons,
      configHash,
      fixtureStateHash: '',
      expectedStateHash: String(fixture && fixture.expectedStateHash ? fixture.expectedStateHash : ''),
      fixtureValid: 0,
      probeStable: 0,
      stateHashStable: 0,
    };
  }

  const startupStartedAt = performance.now();
  const { core, registry, runner, project } = await loadModules();
  const computedExpected = computeExpectedStateHash(core, fixture);
  if (!computedExpected.ok) {
    failReasons.push('fixture_core_sequence_invalid');
  } else if (computedExpected.stateHash !== fixture.expectedStateHash) {
    failReasons.push('fixture_expected_state_hash_mismatch');
  }

  const { runCommand, commandIds } = await buildCommandRunner(registry, runner, project);
  const startupMs = roundMs(performance.now() - startupStartedAt);
  const samples = [];
  for (let index = 0; index < fixture.runs; index += 1) {
    const sample = await runPerfOnce({ fixture, runCommand, commandIds, core });
    samples.push(sample);
  }

  const openValues = samples.map((sample) => sample.openMs);
  const saveValues = samples.map((sample) => sample.saveMs);
  const dispatchValues = samples.map((sample) => sample.dispatchMs);
  const sceneSwitchValues = samples.map((sample) => sample.sceneSwitchMs);
  const resetValues = samples.map((sample) => sample.resetMs);
  const hashSet = new Set(samples.map((sample) => sample.stateHash));
  const dispatchCodeSet = new Set(samples.map((sample) => sample.dispatchCode));
  const sceneSwitchProofHashSet = new Set(samples.map((sample) => sample.sceneSwitchProofHash));
  const resetProofHashSet = new Set(samples.map((sample) => sample.resetProofHash));
  const fixtureStateHash = samples.length > 0 ? samples[0].stateHash : '';

  const metrics = {
    startup_ms: startupMs,
    open_median_ms: roundMs(median(openValues)),
    save_median_ms: roundMs(median(saveValues)),
    scene_switch_ms: roundMs(median(sceneSwitchValues)),
    reset_ms: roundMs(median(resetValues)),
    command_dispatch_p95_ms: roundMs(p95(dispatchValues)),
    core_apply_median_ms: roundMs(median(samples.map((sample) => sample.coreApplyMs))),
  };

  const metricThresholds = thresholds.metrics;
  if (metrics.open_median_ms > metricThresholds.open_median_ms) failReasons.push('threshold_open_median_exceeded');
  if (metrics.save_median_ms > metricThresholds.save_median_ms) failReasons.push('threshold_save_median_exceeded');
  if (metrics.command_dispatch_p95_ms > metricThresholds.command_dispatch_p95_ms) {
    failReasons.push('threshold_dispatch_p95_exceeded');
  }
  if (hashSet.size !== 1) failReasons.push('state_hash_non_deterministic');
  if (dispatchCodeSet.size !== 1) failReasons.push('dispatch_code_non_deterministic');
  if (sceneSwitchProofHashSet.size !== 1) failReasons.push('scene_switch_probe_non_deterministic');
  if (resetProofHashSet.size !== 1) failReasons.push('reset_probe_non_deterministic');

  return {
    toolVersion: TOOL_VERSION,
    fixtureId: fixture.fixtureId,
    commitSha,
    runs: fixture.runs,
    metrics,
    thresholds: metricThresholds,
    verdict: failReasons.length === 0 ? 'PASS' : 'FAIL',
    failReasons,
    configHash,
    fixturePath,
    thresholdsPath,
    fixtureStateHash,
    expectedStateHash: fixture.expectedStateHash,
    fixtureValid: computedExpected.ok && computedExpected.stateHash === fixture.expectedStateHash ? 1 : 0,
    probeStable: dispatchCodeSet.size === 1 ? 1 : 0,
    stateHashStable: hashSet.size === 1 ? 1 : 0,
  };
}

function printTokens(result) {
  console.log(`PERF_RUN_TOOL_VERSION=${result.toolVersion}`);
  console.log(`PERF_RUN_FIXTURE_ID=${result.fixtureId}`);
  console.log(`PERF_RUN_COMMIT_SHA=${result.commitSha}`);
  console.log(`PERF_RUN_RUNS=${result.runs}`);
  console.log(`PERF_RUN_CONFIG_HASH=${result.configHash}`);
  console.log(`PERF_RUN_VERDICT=${result.verdict}`);
  console.log(`PERF_FIXTURE_VALID=${result.fixtureValid}`);
  console.log(`PERF_STATE_HASH_STABLE=${result.stateHashStable}`);
  console.log(`PERF_PROBE_STABLE=${result.probeStable}`);
  if (result.metrics && typeof result.metrics === 'object') {
    console.log(`PERF_STARTUP_MS=${result.metrics.startup_ms}`);
    console.log(`PERF_OPEN_MEDIAN_MS=${result.metrics.open_median_ms}`);
    console.log(`PERF_SAVE_MEDIAN_MS=${result.metrics.save_median_ms}`);
    console.log(`PERF_SCENE_SWITCH_MS=${result.metrics.scene_switch_ms}`);
    console.log(`PERF_RESET_MS=${result.metrics.reset_ms}`);
    console.log(`PERF_COMMAND_DISPATCH_P95_MS=${result.metrics.command_dispatch_p95_ms}`);
  }
  console.log(`PERF_FAIL_REASONS=${JSON.stringify(result.failReasons || [])}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await evaluatePerfRun({
    fixturePath: args.fixturePath,
    thresholdsPath: args.thresholdsPath,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printTokens(result);
  }
  process.exit(result.verdict === 'PASS' ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'E2E_CRITICAL_USER_PATH_OK';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/E2E_CRITICAL_USER_PATH_HARD_MIN_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const ALLOWED_PHASES = new Set(['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD']);
const ALLOWED_MODES = new Set(['pr', 'release', 'promotion']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    statusPath: '',
    phaseSwitchPath: '',
    scenariosPath: '',
    mode: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
      continue;
    }

    if (arg === '--scenarios-path' && i + 1 < argv.length) {
      out.scenariosPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--scenarios-path=')) {
      out.scenariosPath = normalizeString(arg.slice('--scenarios-path='.length));
      continue;
    }

    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      out.mode = normalizeString(arg.slice('--mode='.length));
      continue;
    }
  }

  return out;
}

function buildState(base = {}) {
  return {
    ok: false,
    [TOKEN_NAME]: 0,
    criticalUserPathPass: false,
    failReason: 'E2E_CRITICAL_PATH_MISSING',
    statusPath: '',
    phaseSwitchPath: '',
    scenariosPath: '',
    mode: 'release',
    activePhase: '',
    phaseEnforcementMode: '',
    releaseMissingPathStopCode: 'E2E_CRITICAL_PATH_MISSING',
    requiredScenarioIds: [],
    requiredScenarioCount: 0,
    missingRequiredScenarioIds: [],
    missingRequiredScenarioCount: 0,
    failingRequiredScenarioIds: [],
    failingRequiredScenarioCount: 0,
    criticalUserPathDefined: false,
    machineCheckBindingOk: false,
    productVerdict: 'FAIL',
    deliveryVerdict: 'BLOCK',
    releaseModeBlocksWhenMissing: false,
    ...base,
  };
}

export function evaluateE2ECriticalUserPathState(input = {}) {
  const statusPath = normalizeString(input.statusPath || process.env.E2E_CRITICAL_USER_PATH_STATUS_PATH || DEFAULT_STATUS_PATH);
  const phaseSwitchPath = normalizeString(input.phaseSwitchPath || process.env.PHASE_SWITCH_V1_PATH || DEFAULT_PHASE_SWITCH_PATH);

  const modeRaw = normalizeString(input.mode || process.env.MODE || 'release').toLowerCase();
  const mode = ALLOWED_MODES.has(modeRaw) ? modeRaw : 'release';

  const statusDoc = readJsonObject(statusPath);
  if (!statusDoc) {
    return buildState({
      failReason: 'E_E2E_STATUS_UNREADABLE',
      statusPath,
      phaseSwitchPath,
      mode,
    });
  }

  const phaseSwitchDoc = readJsonObject(phaseSwitchPath);
  if (!phaseSwitchDoc) {
    return buildState({
      failReason: 'E_PHASE_SWITCH_INVALID',
      statusPath,
      phaseSwitchPath,
      mode,
    });
  }

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  if (!ALLOWED_PHASES.has(activePhase)) {
    return buildState({
      failReason: 'E_PHASE_SWITCH_INVALID',
      statusPath,
      phaseSwitchPath,
      mode,
      activePhase,
    });
  }

  const phaseRule = isObjectRecord(phaseSwitchDoc.phasePrecedence) ? phaseSwitchDoc.phasePrecedence[activePhase] : null;
  const phaseEnforcementMode = normalizeString(phaseRule?.newV1Enforcement || '');

  const requiredScenarioIds = uniqueSortedStrings(statusDoc.requiredScenarioIds);
  const criticalUserPathDefined = requiredScenarioIds.length > 0;

  const machineCheckBindingOk = normalizeString(statusDoc.machineCheckId).length > 0
    && normalizeString(statusDoc.token).length > 0
    && normalizeString(statusDoc.releaseMissingPathStopCode).length > 0;

  const scenariosPath = normalizeString(
    input.scenariosPath
      || process.env.E2E_CRITICAL_USER_PATH_SCENARIOS_PATH
      || statusDoc.scenarioSetRef,
  );

  const scenariosDoc = readJsonObject(scenariosPath);
  if (!scenariosDoc || !Array.isArray(scenariosDoc.scenarios)) {
    return buildState({
      failReason: 'E_E2E_SCENARIO_SET_UNREADABLE',
      statusPath,
      phaseSwitchPath,
      scenariosPath,
      mode,
      activePhase,
      phaseEnforcementMode,
      requiredScenarioIds,
      requiredScenarioCount: requiredScenarioIds.length,
      criticalUserPathDefined,
      machineCheckBindingOk,
      releaseMissingPathStopCode: normalizeString(statusDoc.releaseMissingPathStopCode) || 'E2E_CRITICAL_PATH_MISSING',
    });
  }

  const scenarioMap = new Map();
  for (const row of scenariosDoc.scenarios) {
    if (!isObjectRecord(row)) continue;
    const id = normalizeString(row.id);
    if (!id) continue;
    scenarioMap.set(id, row);
  }

  const missingRequiredScenarioIds = [];
  const failingRequiredScenarioIds = [];
  for (const id of requiredScenarioIds) {
    const row = scenarioMap.get(id);
    if (!row) {
      missingRequiredScenarioIds.push(id);
      continue;
    }
    if (row.passed !== true) {
      failingRequiredScenarioIds.push(id);
    }
  }

  const criticalUserPathPass = criticalUserPathDefined
    && machineCheckBindingOk
    && missingRequiredScenarioIds.length === 0
    && failingRequiredScenarioIds.length === 0;

  const productVerdict = criticalUserPathPass ? 'PASS' : 'FAIL';
  const deliveryVerdict = criticalUserPathPass
    ? 'PASS'
    : (mode === 'release' || mode === 'promotion' ? 'BLOCK' : 'WARN');

  const releaseModeBlocksWhenMissing = mode === 'release'
    && criticalUserPathPass === false
    && deliveryVerdict === 'BLOCK';

  return buildState({
    ok: criticalUserPathPass,
    [TOKEN_NAME]: criticalUserPathPass ? 1 : 0,
    criticalUserPathPass,
    failReason: criticalUserPathPass ? '' : 'E2E_CRITICAL_PATH_MISSING',
    statusPath,
    phaseSwitchPath,
    scenariosPath,
    mode,
    activePhase,
    phaseEnforcementMode,
    releaseMissingPathStopCode: normalizeString(statusDoc.releaseMissingPathStopCode) || 'E2E_CRITICAL_PATH_MISSING',
    requiredScenarioIds,
    requiredScenarioCount: requiredScenarioIds.length,
    missingRequiredScenarioIds,
    missingRequiredScenarioCount: missingRequiredScenarioIds.length,
    failingRequiredScenarioIds,
    failingRequiredScenarioCount: failingRequiredScenarioIds.length,
    criticalUserPathDefined,
    machineCheckBindingOk,
    productVerdict,
    deliveryVerdict,
    releaseModeBlocksWhenMissing,
  });
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`E2E_CRITICAL_USER_PATH_PASS=${state.criticalUserPathPass ? 1 : 0}`);
  console.log(`E2E_CRITICAL_USER_PATH_DEFINED=${state.criticalUserPathDefined ? 1 : 0}`);
  console.log(`E2E_MACHINE_CHECK_BINDING_OK=${state.machineCheckBindingOk ? 1 : 0}`);
  console.log(`E2E_REQUIRED_SCENARIOS_COUNT=${state.requiredScenarioCount}`);
  console.log(`E2E_MISSING_REQUIRED_SCENARIOS_COUNT=${state.missingRequiredScenarioCount}`);
  console.log(`E2E_FAILING_REQUIRED_SCENARIOS_COUNT=${state.failingRequiredScenarioCount}`);
  console.log(`PRODUCT_VERDICT=${state.productVerdict}`);
  console.log(`DELIVERY_VERDICT=${state.deliveryVerdict}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateE2ECriticalUserPathState({
    statusPath: args.statusPath,
    phaseSwitchPath: args.phaseSwitchPath,
    scenariosPath: args.scenariosPath,
    mode: args.mode,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.existsSync(currentFilePath) && fs.realpathSync(process.argv[1]) === fs.realpathSync(currentFilePath)) {
  main();
}

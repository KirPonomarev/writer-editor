#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'CIRCULAR_DEPENDENCY_BREAK_OK';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/CIRCULAR_DEPENDENCY_BREAK_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_DECLARATION_PATH = 'docs/OPS/STATUS/GATE_DEPENDENCY_DECLARATION_V1.json';
const ALLOWED_PHASES = new Set(['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD']);
const ALLOWED_MODES = new Set(['pr', 'release', 'promotion']);
const CHECK_CLASS_VALUES = new Set(['primitive', 'rollup']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    statusPath: '',
    phaseSwitchPath: '',
    declarationPath: '',
    mode: '',
    skipCycleCheck: false,
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

    if (arg === '--declaration-path' && i + 1 < argv.length) {
      out.declarationPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--declaration-path=')) {
      out.declarationPath = normalizeString(arg.slice('--declaration-path='.length));
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

    if (arg === '--skip-cycle-check') {
      out.skipCycleCheck = true;
      continue;
    }
    if (arg.startsWith('--skip-cycle-check=')) {
      out.skipCycleCheck = parseBoolean(arg.slice('--skip-cycle-check='.length));
    }
  }

  return out;
}

function resolvePhaseBehavior(activePhase) {
  if (activePhase === 'PHASE_1_SHADOW') {
    return {
      phase: activePhase,
      enforcement: 'SIGNAL_ONLY',
      shouldBlock: false,
    };
  }
  if (activePhase === 'PHASE_2_WARN') {
    return {
      phase: activePhase,
      enforcement: 'WARN_WITH_TICKETED_REMEDIATION',
      shouldBlock: false,
    };
  }
  return {
    phase: activePhase,
    enforcement: 'HARD_BLOCK',
    shouldBlock: true,
  };
}

function buildState(base = {}) {
  return {
    ok: false,
    [TOKEN_NAME]: 0,
    mode: 'release',
    statusPath: '',
    phaseSwitchPath: '',
    declarationPath: '',
    activePhase: '',
    phaseEnforcementMode: '',
    phaseShouldBlock: false,
    declarationValid: false,
    explicitDependenciesOnly: false,
    graphNodeCount: 0,
    graphEdgeCount: 0,
    cycleDetected: false,
    cycleComponentCount: 0,
    maxCycleComponentSize: 0,
    cycleComponents: [],
    skipCycleCheckRequested: false,
    skipSuppressionAttempted: false,
    skipSuppressionPrevented: false,
    skipBypassViolation: false,
    productVerdict: 'FAIL',
    deliveryVerdict: 'BLOCK',
    stopCode: '',
    failReason: 'E_GATE_GRAPH_DECLARATION_INVALID',
    declarationIssues: [],
    ...base,
  };
}

function detectStronglyConnectedComponents(nodes, adjacency) {
  const indexMap = new Map();
  const lowLinkMap = new Map();
  const stack = [];
  const inStack = new Set();
  const components = [];
  let index = 0;

  function strongConnect(nodeId) {
    indexMap.set(nodeId, index);
    lowLinkMap.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    inStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!indexMap.has(neighbor)) {
        strongConnect(neighbor);
        lowLinkMap.set(nodeId, Math.min(lowLinkMap.get(nodeId), lowLinkMap.get(neighbor)));
      } else if (inStack.has(neighbor)) {
        lowLinkMap.set(nodeId, Math.min(lowLinkMap.get(nodeId), indexMap.get(neighbor)));
      }
    }

    if (lowLinkMap.get(nodeId) === indexMap.get(nodeId)) {
      const component = [];
      let current = '';
      do {
        current = stack.pop();
        inStack.delete(current);
        component.push(current);
      } while (current !== nodeId && stack.length >= 0);
      components.push(component.sort((a, b) => a.localeCompare(b)));
    }
  }

  for (const nodeId of nodes) {
    if (!indexMap.has(nodeId)) strongConnect(nodeId);
  }

  return components;
}

function parseDeclaration(declarationDoc) {
  const issues = [];
  if (!declarationDoc || !Array.isArray(declarationDoc.checks)) {
    return {
      valid: false,
      issues: [{ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'CHECKS_ARRAY_MISSING' }],
      nodeIds: [],
      adjacency: new Map(),
      edgeCount: 0,
      explicitDependenciesOnly: false,
      evidenceEdgeCount: 0,
    };
  }

  const nodeIds = [];
  const seenNodeIds = new Set();
  const normalizedChecks = [];

  for (const row of declarationDoc.checks) {
    if (!isObjectRecord(row)) {
      issues.push({ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'CHECK_ROW_NOT_OBJECT' });
      continue;
    }
    const machineCheckId = normalizeString(row.machineCheckId);
    const checkClass = normalizeString(row.checkClass).toLowerCase();

    if (!machineCheckId) {
      issues.push({ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'CHECK_ID_MISSING' });
      continue;
    }
    if (seenNodeIds.has(machineCheckId)) {
      issues.push({ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'DUPLICATE_CHECK_ID', machineCheckId });
      continue;
    }
    if (!CHECK_CLASS_VALUES.has(checkClass)) {
      issues.push({ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'CHECK_CLASS_INVALID', machineCheckId, checkClass });
      continue;
    }

    seenNodeIds.add(machineCheckId);
    nodeIds.push(machineCheckId);

    const dependsOn = Array.isArray(row.dependsOn)
      ? row.dependsOn.map((value) => normalizeString(value)).filter(Boolean)
      : [];

    const evidenceDependsOn = Array.isArray(row.evidenceDependsOn)
      ? row.evidenceDependsOn.map((value) => normalizeString(value)).filter(Boolean)
      : [];

    if (Array.isArray(row.dependsOn) === false) {
      issues.push({ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'DEPENDS_ON_NOT_ARRAY', machineCheckId });
    }

    normalizedChecks.push({
      machineCheckId,
      checkClass,
      dependsOn,
      evidenceDependsOn,
    });
  }

  const known = new Set(nodeIds);
  const adjacency = new Map();
  for (const nodeId of nodeIds) adjacency.set(nodeId, []);

  let edgeCount = 0;
  let evidenceEdgeCount = 0;
  for (const row of normalizedChecks) {
    for (const dep of row.dependsOn) {
      if (!known.has(dep)) {
        issues.push({
          code: 'E_GATE_GRAPH_DECLARATION_INVALID',
          reason: 'DEPENDENCY_TARGET_MISSING',
          machineCheckId: row.machineCheckId,
          dependsOn: dep,
        });
        continue;
      }
      adjacency.get(row.machineCheckId).push(dep);
      edgeCount += 1;
    }
    evidenceEdgeCount += row.evidenceDependsOn.length;
  }

  for (const [nodeId, deps] of adjacency.entries()) {
    adjacency.set(nodeId, [...new Set(deps)].sort((a, b) => a.localeCompare(b)));
  }

  return {
    valid: issues.length === 0,
    issues,
    nodeIds: [...nodeIds].sort((a, b) => a.localeCompare(b)),
    adjacency,
    edgeCount,
    explicitDependenciesOnly: issues.every((entry) => entry.reason !== 'DEPENDENCY_TARGET_MISSING' && entry.reason !== 'DEPENDS_ON_NOT_ARRAY'),
    evidenceEdgeCount,
  };
}

function resolveDeliveryVerdict({ productVerdict, mode, phaseShouldBlock }) {
  if (productVerdict === 'PASS') return 'PASS';
  if (mode === 'release' || mode === 'promotion') {
    return phaseShouldBlock ? 'BLOCK' : 'WARN';
  }
  return 'WARN';
}

export function evaluateGateGraphCheckV1State(input = {}) {
  const modeRaw = normalizeString(input.mode || process.env.MODE || 'release').toLowerCase();
  const mode = ALLOWED_MODES.has(modeRaw) ? modeRaw : 'release';
  const statusPath = normalizeString(input.statusPath || process.env.CIRCULAR_DEPENDENCY_BREAK_STATUS_PATH || DEFAULT_STATUS_PATH);
  const phaseSwitchPath = normalizeString(input.phaseSwitchPath || process.env.PHASE_SWITCH_V1_PATH || DEFAULT_PHASE_SWITCH_PATH);
  const declarationPath = normalizeString(input.declarationPath || process.env.GATE_DEPENDENCY_DECLARATION_V1_PATH || DEFAULT_DECLARATION_PATH);
  const skipCycleCheckRequested = parseBoolean(input.skipCycleCheck ?? process.env.GATE_GRAPH_SKIP_CYCLE_CHECK);

  const statusDoc = readJsonObject(statusPath);
  if (!statusDoc) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      declarationPath,
      failReason: 'E_GATE_GRAPH_STATUS_UNREADABLE',
      stopCode: 'E_GATE_GRAPH_DECLARATION_INVALID',
      declarationIssues: [{ code: 'E_GATE_GRAPH_DECLARATION_INVALID', reason: 'STATUS_UNREADABLE' }],
    });
  }

  const phaseSwitchDoc = readJsonObject(phaseSwitchPath);
  if (!phaseSwitchDoc) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      declarationPath,
      failReason: 'E_PHASE_SWITCH_INVALID',
      stopCode: 'E_PHASE_SWITCH_INVALID',
      declarationIssues: [{ code: 'E_PHASE_SWITCH_INVALID', reason: 'PHASE_SWITCH_UNREADABLE' }],
    });
  }

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  if (!ALLOWED_PHASES.has(activePhase)) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      declarationPath,
      activePhase,
      failReason: 'E_PHASE_SWITCH_INVALID',
      stopCode: 'E_PHASE_SWITCH_INVALID',
      declarationIssues: [{ code: 'E_PHASE_SWITCH_INVALID', reason: 'ACTIVE_PHASE_INVALID', activePhase }],
    });
  }

  const phaseBehavior = resolvePhaseBehavior(activePhase);

  const declarationDoc = readJsonObject(declarationPath);
  const declarationState = parseDeclaration(declarationDoc);

  const sccs = declarationState.valid
    ? detectStronglyConnectedComponents(declarationState.nodeIds, declarationState.adjacency)
    : [];
  const cycleComponents = sccs.filter((component) => component.length > 1);
  const cycleDetected = cycleComponents.length > 0;
  const maxCycleComponentSize = cycleComponents.reduce((max, component) => Math.max(max, component.length), 0);

  const productVerdict = declarationState.valid && !cycleDetected ? 'PASS' : 'FAIL';
  const deliveryVerdict = resolveDeliveryVerdict({
    productVerdict,
    mode,
    phaseShouldBlock: phaseBehavior.shouldBlock,
  });

  const skipSuppressionAttempted = skipCycleCheckRequested && (mode === 'release' || mode === 'promotion') && cycleDetected;
  const skipSuppressionPrevented = skipSuppressionAttempted && deliveryVerdict !== 'PASS';
  const skipBypassViolation = skipSuppressionAttempted && !skipSuppressionPrevented;

  let stopCode = '';
  let failReason = '';
  if (!declarationState.valid) {
    stopCode = 'E_GATE_GRAPH_DECLARATION_INVALID';
    failReason = 'E_GATE_GRAPH_DECLARATION_INVALID';
  } else if (skipBypassViolation) {
    stopCode = 'E_SKIP_FLAG_BYPASS';
    failReason = 'E_SKIP_FLAG_BYPASS';
  } else if (cycleDetected) {
    stopCode = 'CIRCULAR_GATE_DEPENDENCY';
    failReason = 'CIRCULAR_GATE_DEPENDENCY';
  }

  const ok = declarationState.valid && !cycleDetected && !skipBypassViolation;

  return buildState({
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    mode,
    statusPath,
    phaseSwitchPath,
    declarationPath,
    activePhase,
    phaseEnforcementMode: phaseBehavior.enforcement,
    phaseShouldBlock: phaseBehavior.shouldBlock,
    declarationValid: declarationState.valid,
    explicitDependenciesOnly: declarationState.explicitDependenciesOnly,
    graphNodeCount: declarationState.nodeIds.length,
    graphEdgeCount: declarationState.edgeCount,
    cycleDetected,
    cycleComponentCount: cycleComponents.length,
    maxCycleComponentSize,
    cycleComponents,
    skipCycleCheckRequested,
    skipSuppressionAttempted,
    skipSuppressionPrevented,
    skipBypassViolation,
    productVerdict,
    deliveryVerdict,
    stopCode,
    failReason,
    declarationIssues: declarationState.issues,
    evidenceEdgeCountIgnored: declarationState.evidenceEdgeCount,
  });
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`GATE_GRAPH_DECLARATION_VALID=${state.declarationValid ? 1 : 0}`);
  console.log(`GATE_GRAPH_EXPLICIT_DEPENDENCIES_ONLY=${state.explicitDependenciesOnly ? 1 : 0}`);
  console.log(`GATE_GRAPH_NODE_COUNT=${state.graphNodeCount}`);
  console.log(`GATE_GRAPH_EDGE_COUNT=${state.graphEdgeCount}`);
  console.log(`GATE_GRAPH_CYCLE_DETECTED=${state.cycleDetected ? 1 : 0}`);
  console.log(`GATE_GRAPH_CYCLE_COMPONENT_COUNT=${state.cycleComponentCount}`);
  console.log(`GATE_GRAPH_MAX_CYCLE_COMPONENT_SIZE=${state.maxCycleComponentSize}`);
  console.log(`PRODUCT_VERDICT=${state.productVerdict}`);
  console.log(`DELIVERY_VERDICT=${state.deliveryVerdict}`);
  console.log(`ACTIVE_PHASE=${state.activePhase}`);
  console.log(`PHASE_ENFORCEMENT_MODE=${state.phaseEnforcementMode}`);
  if (!state.ok) {
    console.log(`STOP_CODE=${state.stopCode}`);
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateGateGraphCheckV1State(args);

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.deliveryVerdict === 'BLOCK' ? 1 : 0);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.existsSync(currentFilePath) && fs.realpathSync(process.argv[1]) === fs.realpathSync(currentFilePath)) {
  main();
}

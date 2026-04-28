#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STATUS_REF = 'docs/OPS/STATUS/B2C09_COMMAND_SURFACE_KERNEL_V1.json';
const TOKEN_NAME = 'B2C09_COMMAND_SURFACE_KERNEL_OK';

const EXPECTED_ADMITTED_ROWS = Object.freeze([
  {
    rowId: 'ZERO_BYPASS_SINGLE_ENTRY',
    proofLevel: 'COMMAND_BUS_ROUTE_AND_BYPASS_NEGATIVES',
  },
  {
    rowId: 'COMMAND_NAMESPACE_CANONICAL_RESOLUTION',
    proofLevel: 'CANON_ALIAS_AND_PROMOTION_BOUNDARY',
  },
  {
    rowId: 'TYPED_COMMAND_FAILURE_SHAPE',
    proofLevel: 'DETERMINISTIC_TYPED_FAILURE_NORMALIZATION',
  },
]);

const EXPECTED_ADVISORY_ROWS = Object.freeze([
  {
    rowId: 'COMMAND_SHELL_ORCHESTRATION_SPLIT',
    proofLevel: 'ADVISORY_ONLY_SHELL_AND_TREE_ACTIONS_REMAIN_SEPARATE',
  },
  {
    rowId: 'RELEASE_PERMISSION_RUNTIME_GATING',
    proofLevel: 'ADVISORY_ONLY_RELEASE_AND_PERMISSION_SCOPE_OUT_OF_KERNEL',
  },
]);

const EXPECTED_BOUNDARY_ROWS = Object.freeze([
  {
    rowId: 'ZERO_BYPASS_SINGLE_ENTRY',
    detectorId: 'B2C09_ZERO_BYPASS_SINGLE_ENTRY_PROOF_BINDING_V1',
  },
  {
    rowId: 'COMMAND_NAMESPACE_CANONICAL_RESOLUTION',
    detectorId: 'B2C09_COMMAND_NAMESPACE_CANONICAL_RESOLUTION_PROOF_BINDING_V1',
  },
  {
    rowId: 'TYPED_COMMAND_FAILURE_SHAPE',
    detectorId: 'B2C09_TYPED_COMMAND_FAILURE_SHAPE_PROOF_BINDING_V1',
  },
]);

const EXPECTED_FORBIDDEN_AREAS = Object.freeze([
  'queueing',
  'concurrency',
  'releaseGating',
  'permissionModel',
  'runtimeOrchestration',
  'recoveryProtocol',
  'extraCommandCluster',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonObject(absPath) {
  const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (!isObjectRecord(parsed)) {
    throw new Error(`JSON_OBJECT_EXPECTED:${absPath}`);
  }
  return parsed;
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

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildFailure(code, extra = {}) {
  return {
    ok: false,
    code,
    [TOKEN_NAME]: 0,
    ...extra,
  };
}

function collectKeyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (!isObjectRecord(value)) return [];
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key;
    out.push({ key, location });
    out.push(...collectKeyPaths(child, location));
  }
  return out;
}

function runNodeTest(repoRoot, relativePath) {
  return spawnSync(process.execPath, ['--test', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });
}

function verifyCanonBoundary(repoRoot) {
  const canonText = fs.readFileSync(path.resolve(repoRoot, 'CANON.md'), 'utf8');
  const bibleText = fs.readFileSync(path.resolve(repoRoot, 'docs/BIBLE.md'), 'utf8');
  const xplatText = fs.readFileSync(
    path.resolve(repoRoot, 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md'),
    'utf8',
  );
  if (!canonText.includes('zero-bypass command surface')
    || !bibleText.includes('zero-bypass command surface')
    || !bibleText.includes('command kernel lock')
    || !xplatText.includes('zero-bypass command surface')) {
    throw new Error('COMMAND_CANON_BOUNDARY_DRIFT');
  }
}

async function loadCommandSurfaceState(repoRoot) {
  return import(pathToFileURL(path.resolve(repoRoot, 'scripts/ops/command-surface-state.mjs')).href);
}

async function loadCommandNamespaceCanon(repoRoot) {
  return import(pathToFileURL(path.resolve(repoRoot, 'src/renderer/commands/commandNamespaceCanon.mjs')).href);
}

async function loadCommandKernel(repoRoot) {
  const registryModule = await import(pathToFileURL(
    path.resolve(repoRoot, 'src/renderer/commands/registry.mjs'),
  ).href);
  const runnerModule = await import(pathToFileURL(
    path.resolve(repoRoot, 'src/renderer/commands/runCommand.mjs'),
  ).href);
  return {
    createCommandRegistry: registryModule.createCommandRegistry,
    createCommandRunner: runnerModule.createCommandRunner,
  };
}

function verifyBindingRecords(repoRoot) {
  const bindingDoc = readJsonObject(path.resolve(repoRoot, 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json'));
  const machineDoc = readJsonObject(path.resolve(repoRoot, 'docs/OPS/STATUS/MACHINE_CHECK_REGISTRY_V1.json'));

  const bindingRows = Array.isArray(bindingDoc.records) ? bindingDoc.records : [];
  const machineRows = Array.isArray(machineDoc.records) ? machineDoc.records : [];

  const bindingRow = bindingRows.find((row) => normalizeString(row.TOKEN_ID) === 'COMMAND_SURFACE_ENFORCED_OK');
  const machineRow = machineRows.find((row) => normalizeString(row.MACHINE_CHECK_ID) === 'MC_TOKEN_COMMAND_SURFACE_ENFORCED_BINDING');

  if (!bindingRow
    || normalizeString(bindingRow.MACHINE_CHECK_ID) !== 'MC_TOKEN_COMMAND_SURFACE_ENFORCED_BINDING'
    || normalizeString(bindingRow.FAILSIGNAL_CODE) !== 'E_COMMAND_SURFACE_BYPASS') {
    throw new Error('COMMAND_BINDING_SCHEMA_DRIFT');
  }

  if (!machineRow
    || normalizeString(machineRow.CHECK_NAME) !== 'token binding command surface enforced'
    || normalizeString(machineRow.BINDING_LEVEL) !== 'required'
    || normalizeString(machineRow.MODE_DISPOSITION) !== 'release_blocking') {
    throw new Error('COMMAND_MACHINE_REGISTRY_DRIFT');
  }
}

function verifyRoutingTruth(repoRoot) {
  const guardText = fs.readFileSync(path.resolve(repoRoot, 'src/renderer/commands/commandBusGuard.mjs'), 'utf8');
  const editorText = fs.readFileSync(path.resolve(repoRoot, 'src/renderer/editor.js'), 'utf8');
  const mainText = fs.readFileSync(path.resolve(repoRoot, 'src/main.js'), 'utf8');
  const projectCommandsText = fs.readFileSync(
    path.resolve(repoRoot, 'src/renderer/commands/projectCommands.mjs'),
    'utf8',
  );

  if (!guardText.includes("export const COMMAND_BUS_ROUTE = 'command.bus';")
    || !guardText.includes('resolveCommandId(commandId')
    || !editorText.includes('runCommandThroughBus(runCommand')
    || !editorText.includes('route: COMMAND_BUS_ROUTE')
    || !mainText.includes("ipcMain.handle('ui:command-bridge'")
    || !mainText.includes('sendCanonicalRuntimeCommand(')
    || !projectCommandsText.includes("const COMMAND_BRIDGE_ROUTE = 'command.bus'")) {
    throw new Error('COMMAND_ROUTING_TRUTH_DRIFT');
  }
}

async function verifyZeroBypassSingleEntry(repoRoot) {
  const { evaluateCommandSurfaceState } = await loadCommandSurfaceState(repoRoot);
  const state = evaluateCommandSurfaceState();
  if (state.ok !== true
    || state.COMMAND_SURFACE_ENFORCED_OK !== 1
    || state.COMMAND_SURFACE_SINGLE_ENTRY_OK !== 1
    || state.COMMAND_SURFACE_BYPASS_NEGATIVE_TESTS_OK !== 1) {
    throw new Error('COMMAND_ZERO_BYPASS_STATE_RED');
  }
}

async function verifyNamespaceBoundary(repoRoot) {
  const { resolveCommandId } = await loadCommandNamespaceCanon(repoRoot);
  const canonical = resolveCommandId('cmd.project.save');
  const alias = resolveCommandId('cmd.file.save', {
    mode: 'release',
    today: '2099-01-01',
  });
  const promotion = resolveCommandId('cmd.file.save', {
    mode: 'promotion',
    today: '2099-01-01',
  });
  if (!canonical.ok || canonical.commandId !== 'cmd.project.save') {
    throw new Error('COMMAND_NAMESPACE_CANONICAL_DRIFT');
  }
  if (!alias.ok
    || alias.commandId !== 'cmd.project.save'
    || alias.sunsetExpired !== true
    || !Array.isArray(alias.warnings)
    || alias.warnings.length < 1) {
    throw new Error('COMMAND_NAMESPACE_ALIAS_DRIFT');
  }
  if (promotion.ok !== false
    || normalizeString(promotion.reason) !== 'COMMAND_NAMESPACE_SUNSET_EXPIRED'
    || normalizeString(promotion.details?.failSignalCode) !== 'E_COMMAND_NAMESPACE_DRIFT') {
    throw new Error('COMMAND_NAMESPACE_PROMOTION_DRIFT');
  }
}

async function verifyTypedFailureBoundary(repoRoot) {
  const { createCommandRegistry, createCommandRunner } = await loadCommandKernel(repoRoot);
  const registry = createCommandRegistry();
  const runCommand = createCommandRunner(registry);

  const unknown = await runCommand('cmd.missing');
  if (!sameJson(unknown, {
    ok: false,
    error: {
      code: 'E_COMMAND_NOT_FOUND',
      op: 'cmd.missing',
      reason: 'COMMAND_NOT_REGISTERED',
    },
  })) {
    throw new Error('COMMAND_TYPED_FAILURE_UNKNOWN_DRIFT');
  }

  registry.registerCommand('cmd.throw', async () => {
    throw new Error('SIMULATED_FAIL');
  });
  const thrown = await runCommand('cmd.throw');
  if (!sameJson(thrown, {
    ok: false,
    error: {
      code: 'E_COMMAND_FAILED',
      op: 'cmd.throw',
      reason: 'SIMULATED_FAIL',
    },
  })) {
    throw new Error('COMMAND_TYPED_FAILURE_THROW_DRIFT');
  }

  registry.registerCommand('cmd.typed', async () => {
    throw { code: 'E_IO', op: 'io.write', reason: 'WRITE_FAILED' };
  });
  const typed = await runCommand('cmd.typed');
  if (!sameJson(typed, {
    ok: false,
    error: {
      code: 'E_IO',
      op: 'io.write',
      reason: 'WRITE_FAILED',
    },
  })) {
    throw new Error('COMMAND_TYPED_FAILURE_TYPED_DRIFT');
  }
}

function verifyExistingContracts(repoRoot) {
  const contractPaths = [
    'test/contracts/command-surface-single-entry.contract.test.js',
    'test/contracts/command-surface-bus-only.contract.test.js',
    'test/contracts/command-namespace-canon-and-alias-bridge.contract.test.js',
    'test/contracts/command-namespace-sunset-promotion.contract.test.js',
    'test/unit/sector-u-u1-command-layer.test.js',
    'test/unit/sector-u-u5-runCommand-errors.test.js',
  ];
  for (const contractPath of contractPaths) {
    const run = runNodeTest(repoRoot, contractPath);
    if (run.status !== 0) {
      throw new Error(`COMMAND_CONTRACT_RED:${contractPath}`);
    }
  }
}

export async function evaluateB2C09CommandSurfaceKernel({
  repoRoot = process.cwd(),
  statusRef = STATUS_REF,
} = {}) {
  try {
    const doc = readJsonObject(path.resolve(repoRoot, statusRef));
    if (normalizeString(doc.artifactId) !== 'B2C09_COMMAND_SURFACE_KERNEL_V1'
      || doc.schemaVersion !== 1
      || normalizeString(doc.taskId) !== 'B2C09_COMMAND_SURFACE_KERNEL'
      || normalizeString(doc.status) !== 'PASS') {
      return buildFailure('E_B2C09_STATUS_ARTIFACT_INVALID');
    }

    const boundary = isObjectRecord(doc.boundary) ? doc.boundary : {};
    const proofBinding = isObjectRecord(doc.proofBinding) ? doc.proofBinding : {};
    const admittedRows = Array.isArray(boundary.admittedBoundaryRows) ? boundary.admittedBoundaryRows : [];
    const advisoryRows = Array.isArray(boundary.advisoryBoundaryRows) ? boundary.advisoryBoundaryRows : [];
    const bindingRows = Array.isArray(proofBinding.boundaryRows) ? proofBinding.boundaryRows : [];

    if (normalizeString(boundary.commandSurfaceId) !== 'ZERO_BYPASS_COMMAND_KERNEL'
      || !sameJson(admittedRows, EXPECTED_ADMITTED_ROWS)
      || !sameJson(advisoryRows, EXPECTED_ADVISORY_ROWS)) {
      return buildFailure('E_B2C09_BOUNDARY_SET');
    }

    if (normalizeString(proofBinding.bindingMode) !== 'DETECTOR_IDS_ONLY'
      || !sameJson(bindingRows, EXPECTED_BOUNDARY_ROWS)) {
      return buildFailure('E_B2C09_DETECTOR_BINDING');
    }

    const detectorIds = bindingRows.map((row) => normalizeString(row.detectorId));
    if (new Set(detectorIds).size !== detectorIds.length) {
      return buildFailure('E_B2C09_DETECTOR_BINDING');
    }

    const advisoryBoundary = isObjectRecord(doc.advisoryBoundary) ? doc.advisoryBoundary : {};
    if (normalizeString(advisoryBoundary.zeroBypassPromotion) !== 'ADVISORY_ONLY_OUTSIDE_MACHINE_PROVED_KERNEL_ROWS'
      || normalizeString(advisoryBoundary.shellOrchestrationPromotion)
        !== 'ADVISORY_ONLY_EDITOR_MAIN_AND_RUNTIME_BRIDGE_COOWN_ACTION_CHOREOGRAPHY'
      || normalizeString(advisoryBoundary.releasePermissionPromotion)
        !== 'ADVISORY_ONLY_RELEASE_AND_PERMISSION_BOUNDARY_NOT_ADMITTED_HERE'
      || normalizeString(advisoryBoundary.queueingPromotion) !== 'ADVISORY_ONLY_QUEUEING_IS_SEPARATE_DOMAIN'
      || normalizeString(advisoryBoundary.concurrencyPromotion) !== 'ADVISORY_ONLY_CONCURRENCY_IS_SEPARATE_DOMAIN'
      || !sameJson(advisoryBoundary.forbiddenPromotionAreas, EXPECTED_FORBIDDEN_AREAS)) {
      return buildFailure('E_B2C09_ADVISORY_BOUNDARY');
    }

    const forbiddenKeys = new Set([
      'queueingPolicy',
      'concurrencyPolicy',
      'releaseGating',
      'permissionModel',
      'runtimeOrchestration',
      'recoveryProtocol',
      'extraCommandCluster',
    ]);
    const forbiddenHits = collectKeyPaths(doc)
      .filter((entry) => forbiddenKeys.has(entry.key))
      .map((entry) => entry.location);
    if (forbiddenHits.length > 0) {
      return buildFailure('E_B2C09_FORBIDDEN_SCOPE', { forbiddenHits });
    }

    verifyCanonBoundary(repoRoot);
    verifyBindingRecords(repoRoot);
    verifyRoutingTruth(repoRoot);
    await verifyZeroBypassSingleEntry(repoRoot);
    await verifyNamespaceBoundary(repoRoot);
    await verifyTypedFailureBoundary(repoRoot);
    verifyExistingContracts(repoRoot);

    return {
      ok: true,
      code: '',
      [TOKEN_NAME]: 1,
      commandSurfaceId: boundary.commandSurfaceId,
      admittedBoundaryRowCount: admittedRows.length,
      advisoryBoundaryRowCount: advisoryRows.length,
    };
  } catch (error) {
    return buildFailure(
      normalizeString(error?.message) || 'E_B2C09_RUNTIME_FAILURE',
      {
        details: {
          message: normalizeString(error?.message),
        },
      },
    );
  }
}

function parseArgs(argv) {
  const out = { json: false };
  for (const arg of argv) {
    if (arg === '--json') out.json = true;
  }
  return out;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`B2C09_CODE=${state.code}`);
  console.log(`B2C09_COMMAND_SURFACE_ID=${state.commandSurfaceId || ''}`);
  console.log(`B2C09_ADMITTED_ROWS=${state.admittedBoundaryRowCount || 0}`);
  console.log(`B2C09_ADVISORY_ROWS=${state.advisoryBoundaryRowCount || 0}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = await evaluateB2C09CommandSurfaceKernel();
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  await main();
}

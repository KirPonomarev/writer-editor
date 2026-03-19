#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03UserShellStateFoundationState } from './phase03-user-shell-state-foundation-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_UNEXPECTED';
const CONTRACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_V1.json';
const CORE_RUNTIME_PATH = 'src/core/runtime.mjs';
const MAIN_SOURCE_PATH = 'src/main.js';
const RENDERER_SOURCE_PATH = 'src/renderer/editor.js';
const ACTIVE_CONTRACT_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';
const MANIFEST_SCAN_ROOTS = Object.freeze([
  'src/main.js',
  'src/core',
  'src/utils',
]);

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function scanManifestBindingPresent() {
  for (const relativePath of MANIFEST_SCAN_ROOTS) {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    const stat = fs.statSync(absolutePath);
    if (stat.isFile()) {
      const sourceText = fs.readFileSync(absolutePath, 'utf8');
      if (/\bmanifest\b/i.test(sourceText)) return true;
      continue;
    }

    const queue = [absolutePath];
    while (queue.length > 0) {
      const current = queue.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }
        const sourceText = fs.readFileSync(fullPath, 'utf8');
        if (/\bmanifest\b/i.test(sourceText)) return true;
      }
    }
  }
  return false;
}

function evaluatePhase03StableProjectIdStorageContractState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const userShellFoundationState = evaluatePhase03UserShellStateFoundationState({});
    const packetExists = fs.existsSync(path.resolve(CONTRACT_PACKET_PATH));
    const packet = packetExists ? readJson(CONTRACT_PACKET_PATH) : null;
    const coreRuntimeSource = readText(CORE_RUNTIME_PATH);
    const mainSource = readText(MAIN_SOURCE_PATH);
    const rendererSource = readText(RENDERER_SOURCE_PATH);
    const activeContract = readText(ACTIVE_CONTRACT_PATH);

    const userShellFoundationPass = userShellFoundationState.overallStatus === 'PASS'
      && userShellFoundationState.foundationStatus === 'PASS';
    const packetPass = packet?.status === 'PASS';
    const contractPass = packet?.contractStatus === 'PASS';
    const scopeFlagsValid = packet?.scope?.coreRuntimeProjectIdPresent === true
      && packet?.scope?.projectManifestBindingPresent === true
      && packet?.scope?.workspaceKeyingByProjectIdPresent === true
      && packet?.scope?.cloneImportPolicyPresent === true;
    const pendingContractGapIdsMatch = arraysEqual(packet?.pendingContractGapIds || [], []);
    const blockedPhase03GapIdsMatch = arraysEqual(packet?.blockedPhase03GapIds || [], []);

    const coreProjectIdRuntimePresent = matchesAll(coreRuntimeSource, [
      /const projectId = typeof payload\?\.projectId === 'string' \? payload\.projectId\.trim\(\) : '';/,
      /return fail\(state, 'E_CORE_PROJECT_ID_REQUIRED'/,
      /next\.data\.projects\[projectId\] = \{/,
      /id: projectId,/,
    ]);
    const manifestBindingPresent = scanManifestBindingPresent();
    const settingsProjectIdPresent = matchesAll(mainSource, [
      /const projectBinding = await resolveProjectBindingForFile\(currentFilePath\);/,
      /const projectId = projectBinding\.projectId;/,
      /settings\.projectId = projectId;/,
      /settings\.projectManifestPath = projectBinding\.manifestPath;/,
    ]);
    const workspaceKeyingByProjectIdPresent = matchesAll(rendererSource, [
      /function getActiveDocumentTitleStorageKey\(projectId = currentProjectId\)/,
      /activeDocumentTitle:\$\{normalizedProjectId\}/,
      /function getTreeExpandedStorageKey\(tab, projectId = currentProjectId\)/,
      /treeExpanded:\$\{normalizedProjectId\}:\$\{normalizedTab\}/,
    ]);
    const projectIdResumeBindingPresent = matchesAll(mainSource, [
      /async function findProjectBindingByProjectId\(projectId\)/,
      /settings\.lastProjectId = projectId;/,
      /settings\.lastProjectRelativePath = relativePath;/,
      /return await resolveLastOpenedFilePath\(settings\);/,
    ]);
    const pathBoundRecentResumeRemoved = !/settings\.lastFilePath = currentFilePath;/.test(mainSource)
      && !/return settings\.lastFilePath \|\| null;/.test(mainSource);
    const cloneImportPolicyPresent = /Clone или import создают новый `projectId`/u.test(activeContract)
      || /Clone or import create new `projectId`/u.test(activeContract);

    const checkStatusById = {
      USER_SHELL_FOUNDATION_PASS: asCheck(userShellFoundationPass ? 'GREEN' : 'OPEN_GAP', true, userShellFoundationPass ? 'USER_SHELL_FOUNDATION_PASS' : 'USER_SHELL_FOUNDATION_NOT_PASS'),
      CONTRACT_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'CONTRACT_PACKET_PRESENT' : 'CONTRACT_PACKET_MISSING'),
      CONTRACT_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'CONTRACT_PACKET_PASS' : 'CONTRACT_PACKET_NOT_PASS'),
      CONTRACT_STATUS_PASS: asCheck(contractPass ? 'GREEN' : 'OPEN_GAP', true, contractPass ? 'CONTRACT_STATUS_PASS' : 'CONTRACT_STATUS_NOT_PASS'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      PENDING_CONTRACT_GAP_IDS_MATCH: asCheck(pendingContractGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pendingContractGapIdsMatch ? 'PENDING_CONTRACT_GAP_IDS_MATCH' : 'PENDING_CONTRACT_GAP_IDS_DRIFT'),
      BLOCKED_PHASE03_GAP_IDS_MATCH: asCheck(blockedPhase03GapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, blockedPhase03GapIdsMatch ? 'BLOCKED_PHASE03_GAP_IDS_MATCH' : 'BLOCKED_PHASE03_GAP_IDS_DRIFT'),
      CORE_PROJECT_ID_RUNTIME_PRESENT: asCheck(coreProjectIdRuntimePresent ? 'GREEN' : 'OPEN_GAP', true, coreProjectIdRuntimePresent ? 'CORE_PROJECT_ID_RUNTIME_PRESENT' : 'CORE_PROJECT_ID_RUNTIME_MISSING'),
      PROJECT_MANIFEST_BINDING_PRESENT: asCheck(manifestBindingPresent ? 'GREEN' : 'OPEN_GAP', true, manifestBindingPresent ? 'PROJECT_MANIFEST_BINDING_PRESENT' : 'PROJECT_MANIFEST_BINDING_MISSING'),
      SETTINGS_PROJECT_ID_PRESENT: asCheck(settingsProjectIdPresent ? 'GREEN' : 'OPEN_GAP', true, settingsProjectIdPresent ? 'SETTINGS_PROJECT_ID_PRESENT' : 'SETTINGS_PROJECT_ID_MISSING'),
      WORKSPACE_KEYING_BY_PROJECT_ID_PRESENT: asCheck(workspaceKeyingByProjectIdPresent ? 'GREEN' : 'OPEN_GAP', true, workspaceKeyingByProjectIdPresent ? 'WORKSPACE_KEYING_BY_PROJECT_ID_PRESENT' : 'WORKSPACE_KEYING_BY_PROJECT_ID_MISSING'),
      PROJECT_ID_RESUME_BINDING_PRESENT: asCheck(projectIdResumeBindingPresent ? 'GREEN' : 'OPEN_GAP', true, projectIdResumeBindingPresent ? 'PROJECT_ID_RESUME_BINDING_PRESENT' : 'PROJECT_ID_RESUME_BINDING_MISSING'),
      PATH_BOUND_RECENT_RESUME_REMOVED: asCheck(pathBoundRecentResumeRemoved ? 'GREEN' : 'OPEN_GAP', true, pathBoundRecentResumeRemoved ? 'PATH_BOUND_RECENT_RESUME_REMOVED' : 'PATH_BOUND_RECENT_RESUME_STILL_PRESENT'),
      CLONE_IMPORT_POLICY_PRESENT: asCheck(cloneImportPolicyPresent ? 'GREEN' : 'OPEN_GAP', true, cloneImportPolicyPresent ? 'CLONE_IMPORT_POLICY_PRESENT' : 'CLONE_IMPORT_POLICY_MISSING'),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([id]) => id);

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        contractStatus: contractPass ? 'PASS' : 'UNKNOWN',
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        pendingContractGapIds: packet?.pendingContractGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      contractStatus: packetPass ? 'PASS' : 'UNKNOWN',
      phase03ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      pendingContractGapIds: packet?.pendingContractGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      contractStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_EVALUATION_ERROR'],
      checkStatusById: {},
      pendingContractGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03StableProjectIdStorageContractState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_STATUS=${state.contractStatus}`);
    console.log(`PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03StableProjectIdStorageContractState };

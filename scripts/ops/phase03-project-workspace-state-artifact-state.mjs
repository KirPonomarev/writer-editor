#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03ProjectWorkspaceStateFoundationState } from './phase03-project-workspace-state-foundation-state.mjs';
import { evaluatePhase03StableProjectIdStorageContractState } from './phase03-stable-project-id-storage-contract-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_UNEXPECTED';
const ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_V1.json';
const MAIN_SOURCE_PATH = 'src/main.js';
const RENDERER_SOURCE_PATH = 'src/renderer/editor.js';

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

function evaluatePhase03ProjectWorkspaceStateArtifactState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const foundationState = evaluatePhase03ProjectWorkspaceStateFoundationState({});
    const stableProjectIdState = evaluatePhase03StableProjectIdStorageContractState({});
    const packetExists = fs.existsSync(path.resolve(ARTIFACT_PACKET_PATH));
    const packet = packetExists ? readJson(ARTIFACT_PACKET_PATH) : null;
    const mainSource = readText(MAIN_SOURCE_PATH);
    const rendererSource = readText(RENDERER_SOURCE_PATH);

    const foundationPass = foundationState.overallStatus === 'PASS'
      && foundationState.foundationStatus === 'HOLD';
    const stableProjectIdPass = stableProjectIdState.overallStatus === 'PASS'
      && stableProjectIdState.contractStatus === 'PASS';
    const packetPass = packet?.status === 'PASS';
    const workspacePass = packet?.workspaceStatus === 'PASS';
    const scopeFlagsValid = packet?.scope?.projectScopedButNotDocumentTruth === true
      && packet?.scope?.stableProjectIdKeyingPresent === true
      && packet?.scope?.pathBoundResumePresent === false
      && packet?.scope?.documentTruthMutationPresent === false
      && packet?.scope?.legacyFallbackReadPresent === true;
    const boundWorkspaceSurfaceIdsMatch = arraysEqual(packet?.boundWorkspaceSurfaceIds || [], [
      'ACTIVE_DOCUMENT_TITLE_LOCAL',
      'TREE_EXPANDED_LOCAL',
    ]);
    const pathBoundWorkspaceSurfaceIdsMatch = arraysEqual(packet?.pathBoundWorkspaceSurfaceIds || [], []);
    const remainingBlockedGapIdsMatch = arraysEqual(packet?.remainingBlockedGapIds || [], []);

    const editorPayloadProjectIdPresent = matchesAll(mainSource, [
      /projectId: typeof payload\.projectId === 'string' \? payload\.projectId : ''/,
      /async function attachProjectIdToEditorPayload\(payload\)/,
      /nextPayload\.projectId = projectBinding\.projectId\.trim\(\);/,
      /sendEditorText\(await attachProjectIdToEditorPayload\(\{/,
    ]);
    const activeDocumentTitleProjectScoped = matchesAll(rendererSource, [
      /function getActiveDocumentTitleStorageKey\(projectId = currentProjectId\)/,
      /activeDocumentTitle:\$\{normalizedProjectId\}/,
      /localStorage\.setItem\(getActiveDocumentTitleStorageKey\(currentProjectId\), title\)/,
    ]);
    const treeExpansionProjectScoped = matchesAll(rendererSource, [
      /function getTreeExpandedStorageKey\(tab, projectId = currentProjectId\)/,
      /treeExpanded:\$\{normalizedProjectId\}:\$\{normalizedTab\}/,
      /localStorage\.setItem\(getTreeExpandedStorageKey\(tab, currentProjectId\), JSON\.stringify\(Array\.from\(set\)\)\)/,
      /expandedNodesByTab = new Map\(\);/,
    ]);
    const projectIdResumeBindingPresent = matchesAll(mainSource, [
      /async function findProjectBindingByProjectId\(projectId\)/,
      /settings\.lastProjectId = projectId;/,
      /settings\.lastProjectRelativePath = relativePath;/,
      /return await resolveLastOpenedFilePath\(settings\);/,
    ]);
    const documentTruthUntouched = !/writeFileAtomic\(.*activeDocumentTitle/.test(mainSource)
      && !/writeFileAtomic\(.*treeExpanded/.test(mainSource)
      && !/writeFileAtomic\(.*workspace/i.test(mainSource);

    const checkStatusById = {
      PROJECT_WORKSPACE_FOUNDATION_PASS: asCheck(foundationPass ? 'GREEN' : 'OPEN_GAP', true, foundationPass ? 'PROJECT_WORKSPACE_FOUNDATION_PASS' : 'PROJECT_WORKSPACE_FOUNDATION_NOT_READY'),
      STABLE_PROJECT_ID_CONTRACT_PASS: asCheck(stableProjectIdPass ? 'GREEN' : 'OPEN_GAP', true, stableProjectIdPass ? 'STABLE_PROJECT_ID_CONTRACT_PASS' : 'STABLE_PROJECT_ID_CONTRACT_NOT_READY'),
      ARTIFACT_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'ARTIFACT_PACKET_PRESENT' : 'ARTIFACT_PACKET_MISSING'),
      ARTIFACT_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'ARTIFACT_PACKET_PASS' : 'ARTIFACT_PACKET_NOT_PASS'),
      WORKSPACE_STATUS_PASS: asCheck(workspacePass ? 'GREEN' : 'OPEN_GAP', true, workspacePass ? 'WORKSPACE_STATUS_PASS' : 'WORKSPACE_STATUS_NOT_PASS'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      BOUND_WORKSPACE_SURFACE_IDS_MATCH: asCheck(boundWorkspaceSurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, boundWorkspaceSurfaceIdsMatch ? 'BOUND_WORKSPACE_SURFACE_IDS_MATCH' : 'BOUND_WORKSPACE_SURFACE_IDS_DRIFT'),
      PATH_BOUND_WORKSPACE_SURFACE_IDS_MATCH: asCheck(pathBoundWorkspaceSurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pathBoundWorkspaceSurfaceIdsMatch ? 'PATH_BOUND_WORKSPACE_SURFACE_IDS_MATCH' : 'PATH_BOUND_WORKSPACE_SURFACE_IDS_DRIFT'),
      REMAINING_BLOCKED_GAP_IDS_MATCH: asCheck(remainingBlockedGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, remainingBlockedGapIdsMatch ? 'REMAINING_BLOCKED_GAP_IDS_MATCH' : 'REMAINING_BLOCKED_GAP_IDS_DRIFT'),
      EDITOR_PAYLOAD_PROJECT_ID_PRESENT: asCheck(editorPayloadProjectIdPresent ? 'GREEN' : 'OPEN_GAP', true, editorPayloadProjectIdPresent ? 'EDITOR_PAYLOAD_PROJECT_ID_PRESENT' : 'EDITOR_PAYLOAD_PROJECT_ID_MISSING'),
      ACTIVE_DOCUMENT_TITLE_PROJECT_SCOPED: asCheck(activeDocumentTitleProjectScoped ? 'GREEN' : 'OPEN_GAP', true, activeDocumentTitleProjectScoped ? 'ACTIVE_DOCUMENT_TITLE_PROJECT_SCOPED' : 'ACTIVE_DOCUMENT_TITLE_PROJECT_SCOPING_MISSING'),
      TREE_EXPANSION_PROJECT_SCOPED: asCheck(treeExpansionProjectScoped ? 'GREEN' : 'OPEN_GAP', true, treeExpansionProjectScoped ? 'TREE_EXPANSION_PROJECT_SCOPED' : 'TREE_EXPANSION_PROJECT_SCOPING_MISSING'),
      PROJECT_ID_RESUME_BINDING_PRESENT: asCheck(projectIdResumeBindingPresent ? 'GREEN' : 'OPEN_GAP', true, projectIdResumeBindingPresent ? 'PROJECT_ID_RESUME_BINDING_PRESENT' : 'PROJECT_ID_RESUME_BINDING_MISSING'),
      DOCUMENT_TRUTH_UNTOUCHED: asCheck(documentTruthUntouched ? 'GREEN' : 'OPEN_GAP', true, documentTruthUntouched ? 'DOCUMENT_TRUTH_UNTOUCHED' : 'DOCUMENT_TRUTH_MUTATION_DETECTED'),
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
        workspaceStatus: workspacePass ? 'PASS' : 'UNKNOWN',
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      workspaceStatus: workspacePass ? 'PASS' : 'UNKNOWN',
      phase03ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      workspaceStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03ProjectWorkspaceStateArtifactState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_STATUS=${state.workspaceStatus}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03ProjectWorkspaceStateArtifactState };

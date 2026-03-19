#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03StableProjectIdStorageContractState } from './phase03-stable-project-id-storage-contract-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_UNEXPECTED';
const FOUNDATION_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_V1.json';
const ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_V1.json';
const RENDERER_SOURCE_PATH = 'src/renderer/editor.js';
const MAIN_SOURCE_PATH = 'src/main.js';

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

function evaluatePhase03ProjectWorkspaceStateFoundationState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const stableProjectIdState = evaluatePhase03StableProjectIdStorageContractState({});
    const packetExists = fs.existsSync(path.resolve(FOUNDATION_PACKET_PATH));
    const packet = packetExists ? readJson(FOUNDATION_PACKET_PATH) : null;
    const artifactPacketExists = fs.existsSync(path.resolve(ARTIFACT_PACKET_PATH));
    const artifactPacket = artifactPacketExists ? readJson(ARTIFACT_PACKET_PATH) : null;
    const rendererSource = readText(RENDERER_SOURCE_PATH);
    const mainSource = readText(MAIN_SOURCE_PATH);

    const stableProjectIdReady = stableProjectIdState.overallStatus === 'PASS'
      && (
        stableProjectIdState.contractStatus === 'PASS'
        || stableProjectIdState.contractStatus === 'HOLD'
      );
    const packetPass = packet?.status === 'PASS';
    const foundationHold = packet?.foundationStatus === 'HOLD';
    const scopeFlagsValid = packet?.scope?.projectScopedButNotDocumentTruth === true
      && packet?.scope?.stableProjectIdKeyingPresent === false
      && packet?.scope?.pathBoundResumePresent === true
      && packet?.scope?.documentTruthMutationPresent === false;
    const observedWorkspaceSurfaceIdsMatch = arraysEqual(packet?.observedWorkspaceSurfaceIds || [], [
      'ACTIVE_DOCUMENT_TITLE_LOCAL',
      'TREE_EXPANDED_LOCAL',
      'LAST_FILE_RESUME_SETTINGS',
    ]);
    const pendingFoundationGapIdsMatch = arraysEqual(packet?.pendingFoundationGapIds || [], [
      'PROJECT_WORKSPACE_STATE_ARTIFACT_NOT_BOUND',
    ]);
    const blockedByGapIdsMatch = arraysEqual(packet?.blockedByGapIds || [], [
      'STABLE_PROJECT_ID_STORAGE_CONTRACT_NOT_BOUND',
    ]);

    const artifactPass = artifactPacket?.status === 'PASS' && artifactPacket?.workspaceStatus === 'PASS';
    const activeDocumentTitlePersisted = (
      matchesAll(rendererSource, [
        /localStorage\.setItem\('activeDocumentTitle',\s*title\)/,
        /function showEditorPanelFor\(title\)/,
      ]) || matchesAll(rendererSource, [
        /function getActiveDocumentTitleStorageKey\(projectId = currentProjectId\)/,
        /localStorage\.setItem\(getActiveDocumentTitleStorageKey\(currentProjectId\), title\)/,
        /function showEditorPanelFor\(title\)/,
      ])
    );
    const treeExpansionPersisted = (
      matchesAll(rendererSource, [
        /localStorage\.getItem\(`treeExpanded:\$\{tab\}`\) \|\| '\[\]'/,
        /localStorage\.setItem\(`treeExpanded:\$\{tab\}`,\s*JSON\.stringify\(Array\.from\(set\)\)\)/,
        /function getExpandedSet\(tab\)/,
        /function saveExpandedSet\(tab\)/,
      ]) || matchesAll(rendererSource, [
        /function getTreeExpandedStorageKey\(tab, projectId = currentProjectId\)/,
        /readWorkspaceStorage\(/,
        /localStorage\.setItem\(getTreeExpandedStorageKey\(tab, currentProjectId\), JSON\.stringify\(Array\.from\(set\)\)\)/,
        /function getExpandedSet\(tab\)/,
        /function saveExpandedSet\(tab\)/,
      ])
    );
    const pathBoundLastFileResume = matchesAll(mainSource, [
      /settings\.lastFilePath = currentFilePath;/,
      /return settings\.lastFilePath \|\| null;/,
      /const lastFilePath = await loadLastFile\(\);/,
    ]);
    const foundationHoldOrArtifactSuperseded = artifactPass || (
      !/treeExpanded:\$\{projectId\}/.test(rendererSource)
      && !/settings\.workspace.*projectId/i.test(mainSource)
      && !/activeDocumentTitle:.*projectId/i.test(rendererSource)
    );
    const pathBoundResumeFoundationSatisfied = pathBoundLastFileResume || artifactPass;
    const documentTruthUntouched = !/writeFileAtomic\(.*activeDocumentTitle/.test(mainSource)
      && !/writeFileAtomic\(.*treeExpanded/.test(mainSource)
      && !/writeFileAtomic\(.*workspace/i.test(mainSource);

    const checkStatusById = {
      STABLE_PROJECT_ID_READY: asCheck(stableProjectIdReady ? 'GREEN' : 'OPEN_GAP', true, stableProjectIdReady ? 'STABLE_PROJECT_ID_READY' : 'STABLE_PROJECT_ID_STATE_NOT_READY'),
      FOUNDATION_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'FOUNDATION_PACKET_PRESENT' : 'FOUNDATION_PACKET_MISSING'),
      FOUNDATION_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'FOUNDATION_PACKET_PASS' : 'FOUNDATION_PACKET_NOT_PASS'),
      FOUNDATION_STATUS_HOLD: asCheck(foundationHold ? 'GREEN' : 'OPEN_GAP', true, foundationHold ? 'FOUNDATION_STATUS_HOLD' : 'FOUNDATION_STATUS_FALSE_GREEN'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      OBSERVED_WORKSPACE_SURFACES_MATCH: asCheck(observedWorkspaceSurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, observedWorkspaceSurfaceIdsMatch ? 'OBSERVED_WORKSPACE_SURFACES_MATCH' : 'OBSERVED_WORKSPACE_SURFACES_DRIFT'),
      PENDING_FOUNDATION_GAP_IDS_MATCH: asCheck(pendingFoundationGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pendingFoundationGapIdsMatch ? 'PENDING_FOUNDATION_GAP_IDS_MATCH' : 'PENDING_FOUNDATION_GAP_IDS_DRIFT'),
      BLOCKED_BY_GAP_IDS_MATCH: asCheck(blockedByGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, blockedByGapIdsMatch ? 'BLOCKED_BY_GAP_IDS_MATCH' : 'BLOCKED_BY_GAP_IDS_DRIFT'),
      ACTIVE_DOCUMENT_TITLE_PERSISTED: asCheck(activeDocumentTitlePersisted ? 'GREEN' : 'OPEN_GAP', true, activeDocumentTitlePersisted ? 'ACTIVE_DOCUMENT_TITLE_PERSISTED' : 'ACTIVE_DOCUMENT_TITLE_PERSISTENCE_MISSING'),
      TREE_EXPANSION_PERSISTED: asCheck(treeExpansionPersisted ? 'GREEN' : 'OPEN_GAP', true, treeExpansionPersisted ? 'TREE_EXPANSION_PERSISTED' : 'TREE_EXPANSION_PERSISTENCE_MISSING'),
      PATH_BOUND_LAST_FILE_RESUME: asCheck(pathBoundResumeFoundationSatisfied ? 'GREEN' : 'OPEN_GAP', true, artifactPass ? 'FOUNDATION_ARTIFACT_SUPERSEDED' : (pathBoundResumeFoundationSatisfied ? 'PATH_BOUND_LAST_FILE_RESUME' : 'PATH_BOUND_LAST_FILE_RESUME_MISSING')),
      FOUNDATION_HOLD_OR_ARTIFACT_SUPERSEDED: asCheck(foundationHoldOrArtifactSuperseded ? 'GREEN' : 'OPEN_GAP', true, artifactPass ? 'FOUNDATION_ARTIFACT_SUPERSEDED' : (foundationHoldOrArtifactSuperseded ? 'FOUNDATION_HOLD_PRESERVED' : 'FOUNDATION_FALSE_PROMOTION')),
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
        foundationStatus: foundationHold ? 'HOLD' : 'UNKNOWN',
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        pendingFoundationGapIds: packet?.pendingFoundationGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      foundationStatus: foundationHold ? 'HOLD' : 'UNKNOWN',
      phase03ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      pendingFoundationGapIds: packet?.pendingFoundationGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      foundationStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_EVALUATION_ERROR'],
      checkStatusById: {},
      pendingFoundationGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03ProjectWorkspaceStateFoundationState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_STATUS=${state.foundationStatus}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03ProjectWorkspaceStateFoundationState };

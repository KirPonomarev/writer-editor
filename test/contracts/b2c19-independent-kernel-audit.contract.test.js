const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c19-independent-kernel-audit-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C19_INDEPENDENT_KERNEL_AUDIT_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C19_INDEPENDENT_KERNEL_AUDIT', 'TICKET_01');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b2c19 independent kernel audit: committed status equals executable state and audit stays bounded', async () => {
  const { evaluateB2C19IndependentKernelAuditState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C19IndependentKernelAuditState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.proof.repoBound, true);
  assert.equal(state.proof.auditOnly, true);
  assert.equal(state.proof.discoveredArtifactIndexBuiltOk, true);
  assert.equal(state.proof.b2c01ToB2c18CoveredOrGapRowsOk, true);
  assert.equal(state.proof.legacyNamingGapsNotAutomaticStopOk, true);
  assert.equal(state.proof.noOldContourFixingOk, true);
  assert.equal(state.proof.noB2c20StartOk, true);
  assert.equal(state.proof.noBlock2GreenDecisionOk, true);
  assert.equal(state.proof.noBlock2ExitDecisionOk, true);
  assert.equal(state.proof.findingsClassifiedOk, true);
  assert.equal(state.proof.auditTableHasPassFailRowsOk, true);
  assert.equal(state.proof.commandResultsNoPendingOk, true);
  assert.equal(state.proof.blockingFindingCount, 0);
});

test('b2c19 independent kernel audit: evidence packets align with executable findings', async () => {
  const { evaluateB2C19IndependentKernelAuditState } = await loadModule();
  const state = await evaluateB2C19IndependentKernelAuditState({ repoRoot: REPO_ROOT });
  const discoveredIndex = readJson(path.join(EVIDENCE_DIR, 'discovered-artifact-index.json'));
  const auditTable = readJson(path.join(EVIDENCE_DIR, 'independent-audit-table.json'));
  const layerMix = readJson(path.join(EVIDENCE_DIR, 'layer-mix-findings.json'));
  const missingEvidence = readJson(path.join(EVIDENCE_DIR, 'missing-evidence-findings.json'));
  const classification = readJson(path.join(EVIDENCE_DIR, 'finding-classification.json'));

  assert.equal(discoveredIndex.rows.length, 18);
  assert.deepEqual(discoveredIndex.rows, state.runtime.discoveredArtifactIndex);
  assert.equal(discoveredIndex.hash, state.proof.discoveredArtifactIndexHash);
  assert.deepEqual(auditTable.rows, state.runtime.independentAuditTable);
  assert.equal(auditTable.hash, state.proof.independentAuditTableHash);
  assert.deepEqual(layerMix.findings, state.runtime.layerMixFindings);
  assert.deepEqual(missingEvidence.findings, state.runtime.missingEvidenceFindings);
  assert.deepEqual(classification, state.runtime.findingClassification);
  assert.equal(classification.blocking.length, 0);
  assert.equal(Array.isArray(classification.nonblocking), true);
  assert.equal(Array.isArray(classification.advisory), true);
});

test('b2c19 independent kernel audit: command results, negative cases, and false claims stay explicit', async () => {
  const { evaluateB2C19IndependentKernelAuditState } = await loadModule();
  const state = await evaluateB2C19IndependentKernelAuditState({ repoRoot: REPO_ROOT });
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));

  assert.equal(commandResults.taskId, 'B2C19_INDEPENDENT_KERNEL_AUDIT');
  assert.equal(commandResults.status, 'EXECUTED_AND_RECORDED');
  assert.equal(commandResults.allPassed, true);
  assert.equal(commandResults.commands.length, 9);
  assert.equal(commandResults.commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'), true);
  assert.equal(state.runtime.negativeCases.length, 12);
  assert.equal(state.runtime.negativeCases.every((entry) => entry.ok === true), true);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.productRuntimeChanged, false);
  assert.equal(state.scope.oldContourFixing, false);
  assert.equal(state.scope.b2c20StartClaim, false);
  assert.equal(state.scope.block2GreenDecisionClaim, false);
  assert.equal(state.scope.block2ExitDecisionClaim, false);
  assert.equal(state.scope.block3StartClaim, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.factualDocCutoverClaim, false);
  assert.equal(state.scope.exportCompletenessClaim, false);
});

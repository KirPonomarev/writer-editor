const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_DOCX_DIAGNOSTIC_EVIDENCE_SURFACE_001_STATUS.json',
);

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('Review Bridge DOCX diagnostic evidence surface status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_DOCX_DIAGNOSTIC_EVIDENCE_SURFACE_001');
  assert.equal(status.type, 'review_bridge_docx_diagnostic_evidence_surface');
  assert.equal(status.lifecycleStatus, 'superseded_historical');
  assert.equal(status.supersededBy, 'REVIEW_BRIDGE_DOCX_REVIEW_V1_GATE_C_001_STATUS.json');
  assert.ok(
    ['implemented_verified_pending_delivery', 'delivered_merged_verified'].includes(status.status),
    `unexpected status ${status.status}`,
  );
  assert.equal(status.scope.desktopFirst, true);
  assert.equal(status.scope.offlineFirst, true);
  assert.equal(status.scope.reviewBridgeContour, true);
  assert.equal(status.scope.importExportMvpScopeExpanded, false);
  assert.equal(status.scope.uiRedesign, false);
  assert.equal(status.scope.newDependenciesAdded, false);
  assert.equal(status.scope.projectTruthWrites, false);
  assert.equal(status.scope.manuscriptWrites, false);
  assert.equal(status.scope.storageWrite, false);
  assert.equal(status.scope.receiptOrRecoveryCreated, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);

  assert.equal(status.proofPoints.trackedOnlyDocxDiagnosticSurface, true);
  assert.equal(status.proofPoints.cleanDocxNoCandidatePassive, true);
  assert.equal(status.proofPoints.diagnosticItemsReachReviewSurface, true);
  assert.equal(status.proofPoints.diagnosticItemsRenderReadOnly, true);
  assert.equal(status.proofPoints.textChangesFromDocxTrackedChanges, false);
  assert.equal(status.proofPoints.applyOpsCreated, false);
  assert.equal(status.proofPoints.receiptCreated, false);
  assert.equal(status.proofPoints.recoveryCreated, false);
  assert.equal(status.proofPoints.projectTruthMutated, false);
});

test('Review Bridge DOCX diagnostic evidence surface forbids import and apply claims', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /tracked-change markers/u);
  assert.match(positiveText, /diagnostic-only Review evidence surface/u);
  assert.match(positiveText, /read-only Review items/u);
  assert.doesNotMatch(positiveText, /full DOCX review import|tracked-change apply|exact apply from DOCX/u);

  for (const phrase of [
    'No full DOCX review import is claimed.',
    'No DOCX tracked-change apply is claimed.',
    'No exact apply from DOCX is claimed.',
    'No manuscript write is performed by DOCX diagnostic evidence preview.',
    'No project truth write is performed by DOCX diagnostic evidence preview.',
    'No receipt or recovery evidence is created by DOCX diagnostic evidence preview.',
    'No DOCX import safe-create behavior is changed.',
    'No DOCX export behavior is changed.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /Preflight remains diagnostic-only/u);
  assert.match(layerText, /Preview-session activation owns visible Review surface activation/u);
  assert.match(layerText, /Diagnostic-only Review visibility is not project truth/u);
  assert.match(layerText, /Tracked changes are evidence, not mutation instructions/u);
  assert.match(layerText, /canOpenReviewSession false/u);
  assert.match(layerText, /Apply lane remains separate/u);
});

test('Review Bridge DOCX diagnostic evidence surface is bound to code and tests', () => {
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const mainSource = readText(['src', 'main.js']);
  const rendererSource = readText(['src', 'renderer', 'editor.js']);
  const candidateTest = readText([
    'test',
    'contracts',
    'revision-bridge-docx-review-preview-session.contract.test.js',
  ]);
  const commandTest = readText([
    'test',
    'contracts',
    'revision-bridge-docx-review-preview-session-command-surface.contract.test.js',
  ]);
  const localFileTest = readText([
    'test',
    'contracts',
    'revision-bridge-docx-review-local-file-entry-command-surface.contract.test.js',
  ]);
  const uiTest = readText(['test', 'unit', 'sector-m-review-surface-ui.test.js']);

  assert.match(bridgeSource, /docx-review-diagnostic-evidence/u);
  assert.match(bridgeSource, /diagnostic-only-review-evidence/u);
  assert.match(mainSource, /isDiagnosticEvidenceCandidate/u);
  assert.match(mainSource, /candidate\.canOpenReviewSession !== false/u);
  assert.match(rendererSource, /Диагностика \$\{diagnosticId\}/u);
  assert.match(rendererSource, /Только чтение/u);

  assert.match(candidateTest, /structurally complex tracked changes stay manual-only/u);
  assert.match(commandTest, /complex tracked changes open manual structural review/u);
  assert.match(localFileTest, /complex tracked changes open manual structural review/u);
  assert.match(uiTest, /diagnostic items render as read-only review evidence/u);
});

test('Review Bridge DOCX diagnostic evidence surface is referenced from current docs', () => {
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_DOCX_DIAGNOSTIC_EVIDENCE_SURFACE_001/u);
    assert.match(text, /diagnostic/u);
  }
});

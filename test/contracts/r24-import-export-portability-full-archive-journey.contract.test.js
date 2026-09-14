const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'ops', 'r24-import-export-portability-full-archive-journey.mjs');
const ENTITLEMENT_LAW_PATH = path.join(ROOT, 'src', 'core', 'entitlement-law-v1.cjs');

async function loadEvaluator() {
  return import(pathToFileURL(SCRIPT_PATH).href);
}

function stage(result) {
  return {
    ok: true,
    runtimeKind: 'production-app-runtime-harness',
    timedOut: false,
    exitCode: 0,
    signal: '',
    networkRequests: 0,
    dialogCalls: 0,
    rendererProbe: result,
  };
}

function passInput() {
  return {
    headSha: '7aefe4d8fa020291faa8957ae8c0f5b4a7e6b869',
    sourceTree: '33749ad4929be613aba1c9f6b458614ec6a069db',
    runtime: {
      setup: stage({
        ok: 1,
        projectId: 'project-source',
        createdNodeId: 'tree-node-source',
        sceneId: 'roman/01_r24-full-archive-candidate.txt',
        scenePath: '/tmp/source/roman/01_r24-full-archive-candidate.txt',
        commands: [
          'cmd.project.tree.createNode',
          'cmd.project.document.open',
          'cmd.project.save',
        ],
      }),
      export: stage({
        ok: 1,
        sourceProjectId: 'project-source',
        exportResult: { exported: true, verified: true },
        commands: [
          'cmd.project.document.open',
          'cmd.project.exportFullArchiveV1',
        ],
      }),
      importRestore: stage({
        ok: 1,
        importedProjectId: 'project-source',
        sourceProjectId: 'project-source',
        importedBeforeEditText: 'R24 archive source Alpha beta gamma omega.',
        importResult: { imported: true, mode: 'restore', projectId: 'project-source', sourceProjectId: 'project-source' },
        commands: [
          'cmd.project.importFullArchiveV1',
          'cmd.project.document.open',
        ],
      }),
      apply: stage({
        ok: 1,
        beforeApplyText: 'R24 archive source Alpha beta gamma omega.',
        afterApplyText: 'R24 archive applied Alpha delta gamma omega.',
        saveResult: { ok: true },
        commands: [
          'cmd.project.save',
        ],
      }),
      freshReadback: stage({
        ok: 1,
        freshProcessReopenOk: true,
        text: 'R24 archive applied Alpha delta gamma omega.',
        commands: [],
      }),
    },
    artifacts: {
      tempRootRemoved: true,
      exportedArchive: { exists: true, verified: true, sha256: 'archive-sha' },
      sourceSceneFile: { exists: true, sha256: 'source-sha' },
      importedSceneFile: { exists: true, sha256: 'imported-sha' },
    },
  };
}

test('R24 full archive candidate evaluator accepts only source-runtime candidate proof with zero numerator delta', async () => {
  const { evaluateFullArchiveCandidate } = await loadEvaluator();
  const result = evaluateFullArchiveCandidate(passInput());

  assert.equal(result.pass, true);
  assert.equal(result.status, 'PASS_SOURCE_ELECTRON_FULL_ARCHIVE_CANDIDATE_NO_NUMERATOR_DELTA');
  assert.equal(result.acceptedPortabilityNumeratorDelta, 0);
  assert.equal(result.acceptedPortabilityCreditClaimed, false);
  assert.equal(result.packagedBuildRuntime.status, 'NOT_EXECUTED_BY_THIS_SOURCE_RUNTIME_CANDIDATE');
  assert.equal(result.identityProviderGuiGates.realElectronRuntime, true);
  assert.equal(result.identityProviderGuiGates.rawDialogsBlocked, true);
  assert.equal(result.negativeAssertions.denominatorLedgerMutated, false);
  assert.equal(result.negativeAssertions.proComplexityReviewGateBypassed, false);
  assert.equal(result.fieldMatrix.filter((item) => item.status === 'CANDIDATE_OBSERVED_NOT_ACCEPTED').length, 5);
});

test('R24 full archive candidate evaluator rejects missing fresh process readback', async () => {
  const { evaluateFullArchiveCandidate } = await loadEvaluator();
  const input = passInput();
  input.runtime.freshReadback.rendererProbe.freshProcessReopenOk = false;
  input.runtime.freshReadback.rendererProbe.text = 'R24 archive source Alpha beta gamma omega.';

  const result = evaluateFullArchiveCandidate(input);
  assert.equal(result.pass, false);
  assert.equal(result.status, 'NOT_READY');
  assert.equal(result.oracleSummary.INDEPENDENT_READBACK.status, 'FAIL');
  assert.equal(result.acceptedPortabilityNumeratorDelta, 0);
});

test('R24 full archive candidate runner stays on free archive commands and avoids denominator writes', () => {
  const runnerSource = fs.readFileSync(SCRIPT_PATH, 'utf8');

  assert.match(runnerSource, /runProductionAppRuntimeHarness/u);
  assert.match(runnerSource, /cmd\.project\.exportFullArchiveV1/u);
  assert.match(runnerSource, /cmd\.project\.importFullArchiveV1/u);
  assert.match(runnerSource, /const sourceTempRoot = await fs\.realpath/u);
  assert.match(runnerSource, /const importTempRoot = await fs\.realpath/u);
  assert.match(runnerSource, /acceptedPortabilityNumeratorDelta:\s*0/u);
  assert.match(runnerSource, /acceptedPortabilityCreditClaimed:\s*false/u);
  assert.doesNotMatch(runnerSource, /cmd\.project\.review\.importLocalPacket/u);
  assert.doesNotMatch(runnerSource, /cmd\.project\.review\.applyExactTextChange/u);
  assert.doesNotMatch(runnerSource, /YALKEN_INTEROP_100_EVIDENCE_LEDGER|YALKEN_INTEROP_100_DENOMINATOR/u);
  assert.doesNotMatch(runnerSource, /\bfetch\s*\(/u);
});

test('R24 full archive candidate keeps entitlement policy unchanged', () => {
  const law = require(ENTITLEMENT_LAW_PATH);

  assert.equal(law.decideCommandEntitlement('cmd.project.exportFullArchiveV1', law.getProductEntitlementTier()).available, true);
  assert.equal(law.decideCommandEntitlement('cmd.project.importFullArchiveV1', law.getProductEntitlementTier()).available, true);
  assert.equal(law.decideCommandEntitlement('cmd.project.review.importLocalPacket', law.getProductEntitlementTier()).available, false);
  assert.equal(law.decideCommandEntitlement('cmd.project.review.applyExactTextChange', law.getProductEntitlementTier()).available, false);
});

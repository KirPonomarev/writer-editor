const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const validatorPath = '../../scripts/ops/rtk-interop-100-denominator-v1.mjs';

async function loadValidator() {
  return import(validatorPath);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function withGitDiffFixture(changedPaths, fn) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-promotion-'));
  try {
    git(repoRoot, ['init', '-q']);
    git(repoRoot, ['config', 'user.email', 'interop100@example.invalid']);
    git(repoRoot, ['config', 'user.name', 'Interop 100 Test']);
    fs.writeFileSync(path.join(repoRoot, 'base.txt'), 'base\n');
    git(repoRoot, ['add', 'base.txt']);
    git(repoRoot, ['commit', '-q', '-m', 'base']);
    const baseSha = git(repoRoot, ['rev-parse', 'HEAD']);

    for (const relativePath of changedPaths) {
      const absolutePath = path.join(repoRoot, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${relativePath}\n`);
    }
    git(repoRoot, ['add', '.']);
    git(repoRoot, ['commit', '-q', '-m', 'candidate']);
    const currentSha = git(repoRoot, ['rev-parse', 'HEAD']);

    return fn({ repoRoot, baseSha, currentSha });
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

function bindPassEntryToSourceRevision(ledger, sourceRevision) {
  ledger.entries[0].sourceRevision = sourceRevision;
  ledger.entries[0].exactHeadSha = sourceRevision;
  for (const item of ledger.entries[0].providerEvidence || []) {
    item.exactHeadSha = sourceRevision;
  }
  if (ledger.entries[0].packagedBuildEvidence) {
    ledger.entries[0].packagedBuildEvidence.exactHeadSha = sourceRevision;
  }
}

function expectInvalid(report, codeFragment) {
  assert.equal(report.ok, false);
  assert.ok(
    report.errors.some((error) => error.includes(codeFragment)),
    `expected ${codeFragment} in ${JSON.stringify(report.errors)}`,
  );
}

test('interop 100 denominator keeps the closed 1120-cell baseline with one exact-head C1 text cell', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const report = validator.validateInterop100({ spec, ledger, currentHead: currentHead() });

  assert.equal(report.ok, true);
  assert.equal(report.requiredCells, 1120);
  assert.equal(report.recordedCells, 1);
  assert.equal(report.passedRequiredCells, 1);
  assert.equal(report.percentage, 0.089286);
  assert.equal(report.statusCounts.NOT_EXECUTED, 1119);
  assert.equal(report.claimVerdict, 'NEEDS_MORE_EVIDENCE');
  assert.equal(spec.currentGap.exactHeadPassedNumerator, 1);
  assert.equal(spec.currentGap.percentage, 0.089286);
  assert.equal(ledger.declaredRollup.broadPassClaim, false);
  assert.equal(ledger.entries[0].cellId, 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME');
  assert.notEqual(ledger.entries[0].sourceRevision, currentHead());
  assert.equal(ledger.entries[0].outsideContractLedger.silentDropCount, 0);
  assert.deepEqual(ledger.entries[0].outsideContractLedger.dispositions, [
    'EXPLICIT_LOSS',
    'EXPLICIT_LOSS',
    'EXPLICIT_LOSS',
  ]);
  assert.equal(ledger.entries[0].evidenceReceipt.broadPassClaim, false);
});

test('Google local DOCX native import is route-qualified only through an internal uploaded-file reference', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const routePolicy = spec.providerTransportPolicy.googleLocalDocxToNativeImport;
  const evidence = ledger.routeQualificationEvidence[0];

  assert.equal(routePolicy.directLocalPathImport.supported, false);
  assert.equal(routePolicy.directLocalPathImport.countsAsPass, false);
  assert.equal(routePolicy.directLocalPathImport.typedBlocker, validator.GOOGLE_DOCX_IMPORT_TYPED_BLOCKER);
  assert.deepEqual(routePolicy.requiredSteps, Array.from(validator.GOOGLE_DOCX_IMPORT_TRANSPORT_STEPS));
  assert.equal(routePolicy.routeQualificationCountsAsCellPass, false);

  assert.equal(evidence.countedAsRequiredCellPass, false);
  assert.equal(evidence.directLocalPathImportNegative.status, 'BLOCKED');
  assert.equal(evidence.directLocalPathImportNegative.countsAsPass, false);
  assert.equal(evidence.supportedRoute.internalUploadedFileReferenceObserved, true);
  assert.equal(evidence.supportedRoute.nativeImportConverted, true);
  assert.equal(evidence.supportedRoute.nativeReadbackMarkerObserved, true);
  assert.equal(evidence.cleanup.createdGoogleFilesDeleted, true);
  assert.equal(evidence.cleanup.localRunSubdirectoryRemoved, true);
});

test('safe external hyperlink preview contour evidence is non-cell and leaves rich losses open', async () => {
  const validator = await loadValidator();
  const ledger = validator.readInterop100EvidenceLedger();
  const evidence = ledger.implementationContourEvidence.find((item) => (
    item.id === 'SAFE_EXTERNAL_HYPERLINK_CONTENT_PREVIEW_CONTOUR_20260909'
  ));

  assert.ok(evidence);
  assert.equal(evidence.countedAsRequiredCellPass, false);
  assert.equal(evidence.denominatorImpact.passedRequiredCellsAdded, 0);
  assert.equal(evidence.physicalBeforeFix.yalkenPreviewCode, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
  assert.equal(evidence.physicalBeforeFix.yalkenPreviewReason, 'STAGE02_EXTERNAL_RELATIONSHIP_PRESENT');
  assert.equal(evidence.physicalAfterFix.yalkenContentPreviewCode, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(evidence.physicalAfterFix.yalkenImportPreviewCode, 'DOCX_IMPORT_PREVIEW_READY');
  assert.equal(evidence.physicalAfterFix.writeEffects, false);
  assert.equal(evidence.physicalAfterFix.markerPreserved, true);
  assert.equal(evidence.providerRoute.structuredUploadedFileObjectRequired, true);
  assert.equal(evidence.cleanup.createdGoogleFilesDeleted, true);
  assert.equal(evidence.cleanup.localRunSubdirectoriesRemoved, true);
  assert.equal(evidence.residualLossLedger.some((item) => (
    item.field === 'IDENTIFIERS_ANCHORS'
    && item.code === 'GOOGLE_NATIVE_EXPORT_BOOKMARKS_DROPPED'
    && item.status === 'OPEN_NOT_COUNTED'
  )), true);
});

test('validator rejects attempts to count route qualification, direct local path import, or unsafe Word roots as denominator PASS', async () => {
  const validator = await loadValidator();
  const baseSpec = validator.readInterop100Denominator();
  const baseLedger = validator.readInterop100EvidenceLedger();
  const head = currentHead();

  {
    const spec = clone(baseSpec);
    spec.providerTransportPolicy.googleLocalDocxToNativeImport.directLocalPathImport.countsAsPass = true;
    expectInvalid(validator.validateInterop100({ spec, ledger: clone(baseLedger), currentHead: head }), 'GOOGLE_DIRECT_LOCAL_PATH_IMPORT_MUST_NOT_COUNT');
  }

  {
    const spec = clone(baseSpec);
    spec.wordPhysicalRuntimePolicy.persistentRoot = '/tmp/yalken-word';
    expectInvalid(validator.validateInterop100({ spec, ledger: clone(baseLedger), currentHead: head }), 'WORD_PHYSICAL_RUNTIME_ROOT_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].countedAsRequiredCellPass = true;
    expectInvalid(validator.validateInterop100({ spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_MUST_NOT_COUNT');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].cleanup.createdGoogleFilesDeleted = false;
    expectInvalid(validator.validateInterop100({ spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_CLEANUP_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].supportedRoute.requiredSteps = ['DIRECT_LOCAL_PATH_IMPORT_NEGATIVE'];
    expectInvalid(validator.validateInterop100({ spec: clone(baseSpec), ledger, currentHead: head }), 'SUPPORTED_GOOGLE_IMPORT_ROUTE_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].exactHeadSha = '0000000000000000000000000000000000000000';
    expectInvalid(validator.validateInterop100({ spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_BINDING_HEAD_MISMATCH');
  }

  {
    const ledger = clone(baseLedger);
    ledger.entries[0].sourceRevision = head;
    expectInvalid(validator.validateInterop100({ spec: clone(baseSpec), ledger, currentHead: head }), 'CELL_EXECUTION_SOURCE_HEAD_MISMATCH');
  }

  {
    const spec = clone(baseSpec);
    spec.currentGap.exactHeadPassedNumerator = 2;
    expectInvalid(validator.validateInterop100({ spec, ledger: clone(baseLedger), currentHead: head }), 'CURRENT_GAP_ROLLUP_MISMATCH');
  }
});

test('validator admits only exact interop metadata carriers for descendant evidence promotion', async () => {
  const validator = await loadValidator();
  const baseSpec = validator.readInterop100Denominator();
  const baseLedger = validator.readInterop100EvidenceLedger();
  const allowedPostAuditCarrier = 'test/contracts/r24-post-audit-certification-set.contract.test.mjs';
  const adjacentPostAuditCarrier = 'test/contracts/r24-post-audit-corrections.contract.test.mjs';

  withGitDiffFixture([allowedPostAuditCarrier], ({ repoRoot, baseSha, currentSha }) => {
    const ledger = clone(baseLedger);
    bindPassEntryToSourceRevision(ledger, baseSha);
    const report = validator.validateInterop100({
      spec: clone(baseSpec),
      ledger,
      currentHead: currentSha,
      repoRoot,
    });

    assert.equal(report.ok, true);
    assert.equal(report.passedRequiredCells, 1);
  });

  withGitDiffFixture([allowedPostAuditCarrier, adjacentPostAuditCarrier], ({ repoRoot, baseSha, currentSha }) => {
    const ledger = clone(baseLedger);
    bindPassEntryToSourceRevision(ledger, baseSha);
    const report = validator.validateInterop100({
      spec: clone(baseSpec),
      ledger,
      currentHead: currentSha,
      repoRoot,
    });
    const joinedErrors = report.errors.join('\n');

    expectInvalid(report, `CELL_EXECUTION_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:${adjacentPostAuditCarrier}`);
    assert.match(joinedErrors, new RegExp(`PROVIDER_WORD_DESKTOP_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:${adjacentPostAuditCarrier}`));
    assert.equal(joinedErrors.includes(`OUTSIDE_ALLOWLIST:${allowedPostAuditCarrier}`), false);
  });
});

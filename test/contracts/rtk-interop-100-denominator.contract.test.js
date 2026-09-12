const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const validatorPath = '../../scripts/ops/rtk-interop-100-denominator-v1.mjs';
const ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA = 'yalken.interop100.rootDurableCell001PackageAudit.v1';
const ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY = 'Preserves the physical and independent evidence basis for existing Cell001 only; numerator stays 1/1120.';
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA = 'yalken.interop100.rootDurableCell001PackageMutationAudit.v1';
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY = 'Mutants cover the durable Cell001 snapshot verifier only; they do not increase the portability numerator.';
const ROOT_DURABLE_PACKAGE_MUTATION_IDS = Object.freeze([
  'docx-byte-manifest-unchanged',
  'docx-byte-manifest-coherently-updated',
  'generation-ledger-manifest-coherently-updated',
  'receipt-seal-ledger-manifest-coherently-updated',
  'root-audit-manifest-coherently-updated',
  'manifested-file-replaced-by-symlink',
]);

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

function bindPassEntryToSourceRevision(ledger, envelope, sourceRevision, sourceTree) {
  ledger.entries[0].sourceRevision = sourceRevision;
  ledger.entries[0].exactHeadSha = sourceRevision;
  ledger.entries[0].sourceTree = sourceTree;
  for (const item of ledger.entries[0].providerEvidence || []) {
    item.exactHeadSha = sourceRevision;
  }
  if (ledger.entries[0].packagedBuildEvidence) {
    ledger.entries[0].packagedBuildEvidence.exactHeadSha = sourceRevision;
  }
  envelope.entries[0].sourceRevision = sourceRevision;
  envelope.entries[0].exactHeadSha = sourceRevision;
  envelope.entries[0].sourceTree = sourceTree;
  for (const item of envelope.entries[0].providerEvidence || []) {
    item.exactHeadSha = sourceRevision;
  }
  envelope.entries[0].canonicalPassEntrySha256 = sha256StableJson(ledger.entries[0]);
}

function expectInvalid(report, codeFragment) {
  assert.equal(report.ok, false);
  assert.ok(
    report.errors.some((error) => error.includes(codeFragment)),
    `expected ${codeFragment} in ${JSON.stringify(report.errors)}`,
  );
}

function validateWithEnvelope(validator, input) {
  return validator.validateInterop100({
    envelope: validator.readInterop100EvidenceEnvelope(),
    ...input,
  });
}

function fakeSha256(nibble = '1') {
  return `sha256:${String(nibble).repeat(64).slice(0, 64)}`;
}

function fakeCommit(nibble = '1') {
  return String(nibble).repeat(40).slice(0, 40);
}

function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

function sha256File(filePath) {
  return sha256Text(fs.readFileSync(filePath));
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]));
  }
  return value;
}

function stableJsonString(value) {
  return JSON.stringify(stableJsonValue(value));
}

function sha256StableJson(value) {
  return `sha256:${sha256Text(stableJsonString(value))}`;
}

function writeJsonFixture(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeHermeticExternalPackageAuditReport({ manifestSha256, verifierSha256 }) {
  return {
    checks: Array.from({ length: 100 }, (_, index) => ({
      actual: index === 0 ? ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA : null,
      expected: index === 0 ? ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA : null,
      name: `fixture.check.${String(index + 1).padStart(3, '0')}`,
      pass: true,
    })),
    checksFailed: 0,
    checksPassed: 100,
    claimBoundary: ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY,
    errors: [],
    manifestSha256,
    schemaVersion: ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA,
    status: 'PASS',
    verifierSha256,
  };
}

function makeHermeticExternalPackageMutationReport({ verifierSha256 }) {
  return {
    claimBoundary: ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY,
    killedCount: ROOT_DURABLE_PACKAGE_MUTATION_IDS.length,
    mutantCount: ROOT_DURABLE_PACKAGE_MUTATION_IDS.length,
    rows: ROOT_DURABLE_PACKAGE_MUTATION_IDS.map((id, index) => ({
      exitCode: 1,
      id,
      killed: true,
      stderrTail: [],
      stdoutTail: [JSON.stringify({
        checksFailed: 1,
        checksPassed: 99,
        manifestSha256: fakeSha256(String(index + 1)),
        reportSha256: fakeSha256(String(index + 2)),
        status: 'FAIL',
        verifierSha256,
      })],
    })),
    schemaVersion: ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA,
    status: 'PASS',
    survivors: [],
  };
}

function refreshHermeticExternalPackageEnvelope(repoRoot, envelopeEntry) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'MANIFEST.json'), 'utf8'));
  envelopeEntry.externalRehydrationPackage = {
    ...envelopeEntry.externalRehydrationPackage,
    packageId: path.basename(repoRoot),
    manifestSha256: `sha256:${sha256File(path.join(repoRoot, 'MANIFEST.json'))}`,
    verifierSha256: `sha256:${sha256File(path.join(repoRoot, 'create_and_verify.py'))}`,
    reportSha256: `sha256:${sha256File(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json'))}`,
    ledgerEntryRawSha256: `sha256:${sha256File(path.join(repoRoot, 'ledger-entry.json'))}`,
    mutationAuditorSha256: `sha256:${sha256File(path.join(repoRoot, 'mutation_audit.py'))}`,
    mutationReportSha256: `sha256:${sha256File(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json'))}`,
    fileCount: manifest.fileCount,
  };
}

function expectMutationRejected({ validator, spec, ledger, envelope, currentHeadSha, mutate, codeFragment }) {
  const mutatedLedger = clone(ledger);
  const mutatedEnvelope = clone(envelope);
  mutate(mutatedLedger, mutatedEnvelope);
  expectInvalid(validateWithEnvelope(validator, {
    spec: clone(spec),
    ledger: mutatedLedger,
    envelope: mutatedEnvelope,
    currentHead: currentHeadSha,
  }), codeFragment);
}

function writeHermeticExternalPackage(repoRoot, ledgerEntry, envelopeEntry) {
  const ledgerEntryJson = `${JSON.stringify(stableJsonValue(ledgerEntry), null, 2)}\n`;
  fs.writeFileSync(path.join(repoRoot, 'ledger-entry.json'), ledgerEntryJson);
  fs.writeFileSync(path.join(repoRoot, 'create_and_verify.py'), `#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIT_SCHEMA = '${ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA}'
CLAIM_BOUNDARY = '${ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY}'
MARKER = ROOT / 'CREATE_AND_VERIFY_EXECUTED'
MARKER.write_text('executed', encoding='utf-8')

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

report = json.loads((ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json').read_text(encoding='utf-8'))
errors = []
expected_names = [f'fixture.check.{index:03d}' for index in range(1, 101)]
checks = report.get('checks') if isinstance(report.get('checks'), list) else []
if report.get('schemaVersion') != AUDIT_SCHEMA:
    errors.append('schema')
if report.get('claimBoundary') != CLAIM_BOUNDARY:
    errors.append('claimBoundary')
if report.get('status') != 'PASS':
    errors.append('status')
if report.get('checksPassed') != 100 or report.get('checksFailed') != 0 or report.get('errors') != []:
    errors.append('counts')
if report.get('manifestSha256') != sha256(ROOT / 'MANIFEST.json'):
    errors.append('manifestSha256')
if report.get('verifierSha256') != sha256(Path(__file__).resolve()):
    errors.append('verifierSha256')
if [row.get('name') for row in checks] != expected_names:
    errors.append('checkNames')
for index, row in enumerate(checks):
    if row.get('pass') is not True:
        errors.append(f'checkPass:{index}')
    if index == 0:
        if row.get('actual') != AUDIT_SCHEMA or row.get('expected') != AUDIT_SCHEMA:
            errors.append('check0')
    elif row.get('actual') is not None or row.get('expected') is not None:
        errors.append(f'checkValue:{index}')
summary = {
    'status': 'PASS' if not errors else 'FAIL',
    'checksPassed': 100 - len(errors),
    'checksFailed': len(errors),
    'manifestSha256': sha256(ROOT / 'MANIFEST.json'),
    'verifierSha256': sha256(Path(__file__).resolve()),
    'reportSha256': sha256(ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json'),
}
print(json.dumps(summary, sort_keys=True))
sys.exit(0 if not errors else 1)
`);
  fs.writeFileSync(path.join(repoRoot, 'mutation_audit.py'), `#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MUTATION_SCHEMA = '${ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA}'
CLAIM_BOUNDARY = '${ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY}'
IDS = ${JSON.stringify(ROOT_DURABLE_PACKAGE_MUTATION_IDS)}
MARKER = ROOT / 'MUTATION_AUDIT_EXECUTED'
MARKER.write_text('executed', encoding='utf-8')

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def fake_sha(nibble):
    return 'sha256:' + (str(nibble) * 64)[:64]

report = json.loads((ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json').read_text(encoding='utf-8'))
verifier_sha = sha256(ROOT / 'create_and_verify.py')
errors = []
rows = report.get('rows') if isinstance(report.get('rows'), list) else []
if report.get('schemaVersion') != MUTATION_SCHEMA:
    errors.append('schema')
if report.get('claimBoundary') != CLAIM_BOUNDARY:
    errors.append('claimBoundary')
if report.get('status') != 'PASS' or report.get('mutantCount') != len(IDS) or report.get('killedCount') != len(IDS):
    errors.append('counts')
if report.get('survivors') != []:
    errors.append('survivors')
if [row.get('id') for row in rows] != IDS:
    errors.append('ids')
for index, row in enumerate(rows):
    if row.get('killed') is not True or row.get('exitCode') == 0:
        errors.append(f'rowKilled:{index}')
    tail = row.get('stdoutTail')
    if not isinstance(tail, list) or len(tail) != 1:
        errors.append(f'tailShape:{index}')
        continue
    try:
        summary = json.loads(tail[0])
    except Exception:
        errors.append(f'tailJson:{index}')
        continue
    if summary.get('status') != 'FAIL' or summary.get('checksFailed') != 1 or summary.get('checksPassed') != 99:
        errors.append(f'tailStatus:{index}')
    if summary.get('manifestSha256') != fake_sha(index + 1) or summary.get('reportSha256') != fake_sha(index + 2):
        errors.append(f'tailDigest:{index}')
    if summary.get('verifierSha256') != verifier_sha:
        errors.append(f'tailVerifier:{index}')
summary = {
    'status': 'PASS' if not errors else 'FAIL',
    'mutantCount': len(IDS),
    'killedCount': len(IDS) if not errors else max(0, len(IDS) - len(errors)),
    'reportSha256': sha256(ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json'),
    'scriptSha256': sha256(Path(__file__).resolve()),
}
print(json.dumps(summary, sort_keys=True))
sys.exit(0 if not errors else 1)
`);
  const manifest = {
    schemaVersion: envelopeEntry.externalRehydrationPackage.schemaVersion,
    cellId: ledgerEntry.cellId,
    sourceExecutionHead: ledgerEntry.sourceRevision,
    sourceExecutionTree: ledgerEntry.sourceTree,
    fileCount: 1,
    files: [{
      path: 'ledger-entry.json',
      sha256: sha256Text(ledgerEntryJson),
      size: Buffer.byteLength(ledgerEntryJson),
    }],
  };
  writeJsonFixture(path.join(repoRoot, 'MANIFEST.json'), manifest);
  writeJsonFixture(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json'), makeHermeticExternalPackageAuditReport({
    manifestSha256: sha256File(path.join(repoRoot, 'MANIFEST.json')),
    verifierSha256: sha256File(path.join(repoRoot, 'create_and_verify.py')),
  }));
  writeJsonFixture(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json'), makeHermeticExternalPackageMutationReport({
    verifierSha256: sha256File(path.join(repoRoot, 'create_and_verify.py')),
  }));
  refreshHermeticExternalPackageEnvelope(repoRoot, envelopeEntry);
}

test('interop 100 denominator keeps the closed 1120-cell baseline with one exact-head C1 text cell', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const report = validateWithEnvelope(validator, { spec, ledger, currentHead: currentHead() });

  assert.equal(report.ok, true);
  assert.equal(report.requiredCells, 1120);
  assert.equal(report.recordedCells, 1);
  assert.equal(report.passedRequiredCells, 0);
  assert.equal(report.diagnosticPassedRequiredCells, 1);
  assert.equal(report.percentage, 0);
  assert.equal(report.diagnosticPercentage, 0.089286);
  assert.equal(report.statusCounts.NOT_EXECUTED, 1119);
  assert.equal(report.claimVerdict, 'AUTHORITATIVE_REHYDRATION_REQUIRED');
  assert.equal(spec.currentGap.exactHeadPassedNumerator, 1);
  assert.equal(spec.currentGap.percentage, 0.089286);
  assert.equal(ledger.declaredRollup.broadPassClaim, false);
  assert.equal(ledger.entries[0].cellId, 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME');
  assert.match(ledger.entries[0].sourceRevision, /^[0-9a-f]{40}$/);
  assert.match(ledger.entries[0].sourceTree, /^[0-9a-f]{40}$/);
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
    expectInvalid(validateWithEnvelope(validator, { spec, ledger: clone(baseLedger), currentHead: head }), 'GOOGLE_DIRECT_LOCAL_PATH_IMPORT_MUST_NOT_COUNT');
  }

  {
    const spec = clone(baseSpec);
    spec.wordPhysicalRuntimePolicy.persistentRoot = '/tmp/yalken-word';
    expectInvalid(validateWithEnvelope(validator, { spec, ledger: clone(baseLedger), currentHead: head }), 'WORD_PHYSICAL_RUNTIME_ROOT_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].countedAsRequiredCellPass = true;
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_MUST_NOT_COUNT');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].cleanup.createdGoogleFilesDeleted = false;
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_CLEANUP_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].supportedRoute.requiredSteps = ['DIRECT_LOCAL_PATH_IMPORT_NEGATIVE'];
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'SUPPORTED_GOOGLE_IMPORT_ROUTE_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].exactHeadSha = '0000000000000000000000000000000000000000';
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_BINDING_HEAD_MISMATCH');
  }

  {
    const ledger = clone(baseLedger);
    ledger.entries[0].exactHeadSha = '0000000000000000000000000000000000000000';
    ledger.entries[0].sourceRevision = head;
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'CELL_EXECUTION_SOURCE_HEAD_MISMATCH');
  }

  {
    const spec = clone(baseSpec);
    spec.currentGap.exactHeadPassedNumerator = 2;
    expectInvalid(validateWithEnvelope(validator, { spec, ledger: clone(baseLedger), currentHead: head }), 'CURRENT_GAP_ROLLUP_MISMATCH');
  }
});

test('validator rejects coordinated evidence admission forgeries before any numerator promotion', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const baseline = validateWithEnvelope(validator, {
    spec: clone(spec),
    ledger: clone(ledger),
    envelope: clone(envelope),
    currentHead: head,
  });

  assert.equal(baseline.ok, true);
  assert.equal(baseline.passedRequiredCells, 0);
  assert.equal(baseline.diagnosticPassedRequiredCells, 1);

  const cases = [
    {
      name: 'CELL_ARTIFACT_UNKNOWN_HASH',
      codeFragment: 'EVIDENCE_ENVELOPE_ARTIFACTSHA256_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].artifactSha256 = fakeSha256('1');
        mutatedLedger.entries[0].evidenceReceipt.receiptSha256 = fakeSha256('1');
      },
    },
    {
      name: 'TARGET_REVISION_NON_HASH',
      codeFragment: 'TARGET_REVISION_SHA_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].targetRevision = 'not-a-sha';
      },
    },
    {
      name: 'TARGET_REVISION_LEDGER_ONLY',
      codeFragment: 'TARGET_REVISION_NOT_IN_HOP_GRAPH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].targetRevision = fakeSha256('2');
      },
    },
    {
      name: 'SOURCE_TREE_FORGED',
      codeFragment: 'SOURCE_TREE_BINDING_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].sourceTree = fakeCommit('3');
      },
    },
    {
      name: 'LOSS_LEDGER_FORGED',
      codeFragment: 'HOP_LOSS_LEDGER_ORACLE_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].oracles.LOSS.artifactSha256 = fakeSha256('4');
      },
    },
    {
      name: 'PROVENANCE_FORGED',
      codeFragment: 'HOP_PROVENANCE_ORACLE_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].oracles.PROVENANCE.artifactSha256 = fakeSha256('5');
      },
    },
    {
      name: 'GENERATION_ID_FORGED',
      codeFragment: 'EVIDENCE_RECEIPT_RUN_ID_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].generationId = 'forged-generation-id';
      },
    },
    {
      name: 'FAKE_WORD_BUILD',
      codeFragment: 'PROVIDER_BUILDIDENTITY_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].providerEvidence[0].buildIdentity = 'Microsoft Word 99.999 com.microsoft.Word FAKEFAKE';
      },
    },
    {
      name: 'PROVIDER_REVISION_NON_HASH',
      codeFragment: 'PROVIDER_REVISION_SHA_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].providerEvidence[0].revisionIdentity = 'not-a-provider-sha';
      },
    },
    {
      name: 'CYCLE_ROUND_ID_FORGED',
      codeFragment: 'CYCLE_ROUND_ID_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].cycles[0].roundId = 'round-999';
      },
    },
    {
      name: 'SEMANTIC_ORACLE_ARBITRARY_AUTHORITY',
      codeFragment: 'ORACLE_AUTHORITY_UNBOUND:SEMANTIC',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].oracles.SEMANTIC.authority = 'SAME_EXECUTION_WRITER';
      },
    },
    {
      name: 'MANIFEST_ONLY_TARGET_TAMPER',
      codeFragment: 'EVIDENCE_ENVELOPE_TARGETREVISION_MISMATCH',
      mutate(_mutatedLedger, mutatedEnvelope) {
        mutatedEnvelope.entries[0].targetRevision = fakeSha256('6');
      },
    },
    {
      name: 'LEDGER_AND_MANIFEST_TARGET_TAMPER',
      codeFragment: 'TARGET_REVISION_NOT_IN_HOP_GRAPH',
      mutate(mutatedLedger, mutatedEnvelope) {
        mutatedLedger.entries[0].targetRevision = fakeSha256('7');
        mutatedEnvelope.entries[0].targetRevision = fakeSha256('7');
      },
    },
    {
      name: 'NONRECEIPT_ARTIFACT_GRAPH',
      codeFragment: 'EVIDENCE_RECEIPT_HASH_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].artifactSha256 = fakeSha256('8');
      },
    },
  ];

  for (const item of cases) {
    assert.doesNotThrow(() => {
      expectMutationRejected({
        validator,
        spec,
        ledger,
        envelope,
        currentHeadSha: head,
        mutate: item.mutate,
        codeFragment: item.codeFragment,
      });
    }, item.name);
  }
});

test('strict external package mode rejects unknown package identity without producer execution', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-external-package-'));
  try {
    const externalEnvelope = clone(envelope);
    writeHermeticExternalPackage(packageRoot, ledger.entries[0], externalEnvelope.entries[0]);
    const baseline = validateWithEnvelope(validator, {
      spec: clone(spec),
      ledger: clone(ledger),
      envelope: clone(externalEnvelope),
      currentHead: head,
      requireExternalEvidencePackage: true,
      externalEvidencePackageRoot: packageRoot,
    });
    expectInvalid(baseline, 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH');
    assert.equal(fs.existsSync(path.join(packageRoot, 'CREATE_AND_VERIFY_EXECUTED')), false);
    assert.equal(fs.existsSync(path.join(packageRoot, 'MUTATION_AUDIT_EXECUTED')), false);
  } finally {
    fs.rmSync(packageRoot, { recursive: true, force: true });
  }
});

test('strict external package mode rejects pinned hash mismatch without producer execution', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const packageParent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-external-package-parent-'));
  const packageRoot = path.join(packageParent, 'cell001-source-package-v1');
  fs.mkdirSync(packageRoot);
  try {
    const externalEnvelope = clone(envelope);
    writeHermeticExternalPackage(packageRoot, ledger.entries[0], externalEnvelope.entries[0]);
    const report = validateWithEnvelope(validator, {
      spec: clone(spec),
      ledger: clone(ledger),
      envelope: clone(externalEnvelope),
      currentHead: head,
      requireExternalEvidencePackage: true,
      externalEvidencePackageRoot: packageRoot,
    });
    expectInvalid(report, 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_FILE_MISMATCH:manifestSha256');
    assert.equal(fs.existsSync(path.join(packageRoot, 'CREATE_AND_VERIFY_EXECUTED')), false);
    assert.equal(fs.existsSync(path.join(packageRoot, 'MUTATION_AUDIT_EXECUTED')), false);
  } finally {
    fs.rmSync(packageParent, { recursive: true, force: true });
  }
});

test('strict external package mode rejects semantic package forgery fixtures without producer execution', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const cases = [
    {
      name: 'FAILED_AUDIT_REPORT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_STATUS_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.status = 'FAIL';
        report.checksPassed = 99;
        report.checksFailed = 1;
        report.errors = ['coordinated audit report forgery'];
        report.checks[0].pass = false;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'INFLATED_AUDIT_CLAIM_BOUNDARY',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CLAIM_BOUNDARY_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.claimBoundary = 'Full portability certified.';
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'DUPLICATED_AUDIT_CHECK_NAME',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CHECK_NAMES_DUPLICATE',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.checks[1].name = report.checks[0].name;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'CONTRADICTORY_AUDIT_CHECK_ACTUAL',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.checks[0].actual = fakeCommit('f');
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'INVENTED_AUDIT_CHECK_DENOMINATOR',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.checks = Array.from({ length: 100 }, (_, index) => ({
          actual: false,
          expected: true,
          name: `invented-${index}`,
          pass: true,
        }));
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'FAILED_MUTATION_REPORT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_STATUS_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.status = 'FAIL';
        report.killedCount = 5;
        report.survivors = ['root-audit-manifest-coherently-updated'];
        report.rows[4].killed = false;
        report.rows[4].exitCode = 0;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'INFLATED_MUTATION_CLAIM_BOUNDARY',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_CLAIM_BOUNDARY_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.claimBoundary = 'Mutation audit proves every future package mutation is impossible.';
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'DUPLICATED_MUTATION_ROW_ID',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_IDS_DUPLICATE',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows[1].id = report.rows[0].id;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'UNSUBSTANTIATED_MUTATION_ROW_KILLS',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows = report.rows.map((row) => ({
          ...row,
          stdoutTail: ['{"status":"FAIL"}'],
        }));
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'DELETED_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows[0].stdoutTail = [];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'MALFORMED_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows[0].stdoutTail = ['not-json'];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'FALSE_PASS_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const parsed = JSON.parse(report.rows[0].stdoutTail[0]);
        parsed.status = 'PASS';
        parsed.checksFailed = 0;
        report.rows[0].stdoutTail = [JSON.stringify(parsed)];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'ZERO_FAILURE_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const parsed = JSON.parse(report.rows[0].stdoutTail[0]);
        parsed.checksFailed = 0;
        parsed.checksPassed = 100;
        report.rows[0].stdoutTail = [JSON.stringify(parsed)];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'UNBOUND_VERIFIER_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const parsed = JSON.parse(report.rows[0].stdoutTail[0]);
        parsed.verifierSha256 = fakeSha256('a');
        report.rows[0].stdoutTail = [JSON.stringify(parsed)];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'FABRICATED_VALID_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows = report.rows.map((row) => ({
          ...row,
          exitCode: 1,
          stderrTail: [],
          stdoutTail: [JSON.stringify({
            checksFailed: 1,
            checksPassed: 99,
            manifestSha256: 'a'.repeat(64),
            reportSha256: 'b'.repeat(64),
            status: 'FAIL',
            verifierSha256: externalEnvelope.entries[0].externalRehydrationPackage.verifierSha256,
          })],
        }));
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'REPLACED_VERIFIER_SCRIPT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_VERIFIER_HASH_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        fs.writeFileSync(path.join(packageRoot, 'create_and_verify.py'), 'print("forged no-op verifier")\n');
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
  ];

  for (const item of cases) {
    const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-external-package-'));
    try {
      const externalEnvelope = clone(envelope);
      writeHermeticExternalPackage(packageRoot, ledger.entries[0], externalEnvelope.entries[0]);
      item.mutate(packageRoot, externalEnvelope);
      const report = validateWithEnvelope(validator, {
        spec: clone(spec),
        ledger: clone(ledger),
        envelope: externalEnvelope,
        currentHead: head,
        requireExternalEvidencePackage: true,
        externalEvidencePackageRoot: packageRoot,
      });
      expectInvalid(report, 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH');
      assert.equal(fs.existsSync(path.join(packageRoot, 'CREATE_AND_VERIFY_EXECUTED')), false, item.name);
      assert.equal(fs.existsSync(path.join(packageRoot, 'MUTATION_AUDIT_EXECUTED')), false, item.name);
    } finally {
      fs.rmSync(packageRoot, { recursive: true, force: true });
    }
  }
});

test('validator admits only exact interop metadata carriers for descendant evidence promotion', async () => {
  const validator = await loadValidator();
  const baseSpec = validator.readInterop100Denominator();
  const baseLedger = validator.readInterop100EvidenceLedger();
  const baseEnvelope = validator.readInterop100EvidenceEnvelope();
  const allowedPostAuditCarrier = 'test/contracts/r24-post-audit-certification-set.contract.test.mjs';
  const adjacentPostAuditCarrier = 'test/contracts/r24-post-audit-corrections.contract.test.mjs';

  withGitDiffFixture([allowedPostAuditCarrier], ({ repoRoot, baseSha, currentSha }) => {
    const ledger = clone(baseLedger);
    const envelope = clone(baseEnvelope);
    bindPassEntryToSourceRevision(ledger, envelope, baseSha, git(repoRoot, ['rev-parse', `${baseSha}^{tree}`]));
    const report = validateWithEnvelope(validator, {
      spec: clone(baseSpec),
      envelope,
      ledger,
      currentHead: currentSha,
      repoRoot,
    });

    assert.equal(report.ok, true);
    assert.equal(report.passedRequiredCells, 0);
    assert.equal(report.diagnosticPassedRequiredCells, 1);
  });

  withGitDiffFixture([allowedPostAuditCarrier, adjacentPostAuditCarrier], ({ repoRoot, baseSha, currentSha }) => {
    const ledger = clone(baseLedger);
    const envelope = clone(baseEnvelope);
    bindPassEntryToSourceRevision(ledger, envelope, baseSha, git(repoRoot, ['rev-parse', `${baseSha}^{tree}`]));
    const report = validateWithEnvelope(validator, {
      spec: clone(baseSpec),
      envelope,
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

test('governance approval state rejects approval digest tampering for admission carriers', async () => {
  const { evaluateGovernanceApprovalState } = await import('../../scripts/ops/governance-approval-state.mjs');
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-approval-'));
  try {
    const approvalsPath = 'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json';
    const carrierPath = 'scripts/ops/rtk-interop-100-denominator-v1.mjs';
    fs.mkdirSync(path.join(repoRoot, path.dirname(approvalsPath)), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, path.dirname(carrierPath)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, carrierPath), 'approved bytes\n');
    fs.writeFileSync(path.join(repoRoot, approvalsPath), JSON.stringify({
      version: 'v1.0',
      approvals: [
        {
          approved: true,
          approvedAtUtc: '2026-09-12T00:00:00Z',
          approvedBy: 'owner-directive:R24_INTEROP100_APPROVAL_DIGEST_TAMPER_REGRESSION',
          authority: 'SUPERVISOR_DIRECTIVE_R24_INTEROP100_DENOMINATOR_ADMISSION_HARDENING_V2',
          filePath: carrierPath,
          rationale: 'Regression fixture approval for exact admission carrier bytes.',
          sha256: sha256Text('approved bytes\n'),
        },
      ],
    }, null, 2));

    const valid = evaluateGovernanceApprovalState({ repoRoot, approvalsPath });
    assert.equal(valid.ok, true);

    fs.writeFileSync(path.join(repoRoot, carrierPath), 'tampered bytes\n');
    const tampered = evaluateGovernanceApprovalState({ repoRoot, approvalsPath });
    assert.equal(tampered.ok, false);
    assert.equal(tampered.failDetail, 'APPROVAL_FILE_HASH_MISMATCH_0');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

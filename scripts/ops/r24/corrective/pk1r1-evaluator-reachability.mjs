#!/usr/bin/env node
// Credential-free reachability proof for the PK1 release-security evaluator.
// It mutates in-memory clones of checked-in receipts only. It never reads the
// keychain, invokes signing/notarization, uses the network, or publishes files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PK1_RECEIPT_PATHS,
  evaluateReleaseSecurityPhysical,
} from '../release-security-physical-pk1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const EXPECTED_HEAD = 'efc37eae45fa30965b5a9c28eb4c4fc6b44b4bc0';
const TEAM_ID = 'YALKEN2R24';
const SUBMISSION_ID = '11111111-2222-4333-8444-555555555555';
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function baseInput() {
  return {
    expectedHeadSha: EXPECTED_HEAD,
    packageJson: readJson('package.json'),
    programDag: readJson('docs/OPS/EVIDENCE/YALKEN_SCIENTIFIC_ASSURANCE_PROGRAM_R1/PROGRAM_DAG.json'),
    scientificContracts: readJson('docs/OPS/EVIDENCE/YALKEN_SCIENTIFIC_ASSURANCE_PROGRAM_R1/SCIENTIFIC_CONTRACTS.json'),
    receipts: Object.fromEntries(Object.entries(PK1_RECEIPT_PATHS).map(([key, relative]) => [key, readJson(relative)])),
  };
}

function positiveInput() {
  const input = baseInput();
  for (const key of ['c01', 'c02', 'c03', 'c04']) input.receipts[key].headShaAtReceiptGeneration = EXPECTED_HEAD;
  const c01 = input.receipts.c01;
  const c04 = input.receipts.c04;
  const executableSha256 = c01.physicalArtifactEvidence.artifactSet.executable.sha256;
  c01.status = 'PASS_SIGNED_NOTARIZED_ARTIFACT';
  c01.signing = {
    status: 'PASS_DEVELOPER_ID',
    passClaim: true,
    identityKind: 'DEVELOPER_ID_APPLICATION',
    teamId: TEAM_ID,
    executableSha256,
    verification: { codesignVerifyDeepStrictExitCode: 0 },
  };
  c01.notarization = {
    status: 'PASS_NOTARIZED',
    passClaim: true,
    submissionId: SUBMISSION_ID,
    executableSha256,
    ticketStapled: true,
    staplerValidateExitCode: 0,
    verification: { status: 'Accepted' },
  };
  c01.electronFuses = {
    status: 'PASS_FUSE_POLICY',
    passClaim: true,
    policyVersion: 'YALKEN_ELECTRON_FUSE_POLICY_V1',
    executableSha256,
    checks: {
      runAsNode: false,
      cookieEncryption: true,
      nodeOptions: false,
      nodeCliInspect: false,
      embeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
    },
  };
  c01.hardenedRuntime = {
    status: 'PASS_HARDENED_RUNTIME',
    passClaim: true,
    runtimeOptionVerified: true,
    entitlementsVerified: true,
    executableSha256,
  };
  c04.securityEvidence.packageOfflineSecurity = {
    ...c04.securityEvidence.packageOfflineSecurity,
    signingStatus: 'PASS_DEVELOPER_ID',
    notarizationStatus: 'PASS_NOTARIZED',
    fuseStatus: 'PASS_FUSE_POLICY',
    hardenedRuntimeStatus: 'PASS_HARDENED_RUNTIME',
    signingPass: true,
    notarizationPass: true,
    fusePass: true,
    hardenedRuntimePass: true,
    executableSha256,
  };
  return input;
}

function receiptOf(result) {
  return result.ok ? result.value : result.error.value;
}

function expectRejected(input, expectedError) {
  const result = evaluateReleaseSecurityPhysical(input);
  assert(result.ok === false, `PK1R1_NEGATIVE_NOT_REJECTED:${expectedError}`);
  assert(receiptOf(result).errors.includes(expectedError), `PK1R1_NEGATIVE_ERROR_MISSING:${expectedError}`);
  return expectedError;
}

export function verifyPk1r1EvaluatorReachability() {
  const current = evaluateReleaseSecurityPhysical(baseInput());
  const currentReceipt = receiptOf(current);
  assert(current.ok === true, 'PK1R1_CURRENT_RECEIPTS_INVALID');
  assert(currentReceipt.profileVerdictCandidate === 'NOT_READY', 'PK1R1_CURRENT_VERDICT_DRIFT');
  assert(currentReceipt.releaseReadiness.securityEvidenceReady === false, 'PK1R1_CURRENT_SECURITY_EVIDENCE_OVERCLAIM');
  assert(currentReceipt.releaseReadiness.productionReleaseReady === false, 'PK1R1_CURRENT_RELEASE_OVERCLAIM');

  const positive = evaluateReleaseSecurityPhysical(positiveInput());
  const positiveReceipt = receiptOf(positive);
  assert(positive.ok === true, `PK1R1_POSITIVE_EVIDENCE_REJECTED:${positiveReceipt.errors.join(',')}`);
  assert(positiveReceipt.profileVerdictCandidate === 'PASS', 'PK1R1_POSITIVE_PROFILE_UNREACHABLE');
  assert(positiveReceipt.releaseReadiness.status === 'READY_FOR_AUTHORIZED_PUBLICATION', 'PK1R1_POSITIVE_STATUS_UNREACHABLE');
  assert(positiveReceipt.releaseReadiness.securityEvidenceReady === true, 'PK1R1_SECURITY_EVIDENCE_UNREACHABLE');
  assert(positiveReceipt.releaseReadiness.productionReleaseReady === false, 'PK1R1_PUBLICATION_AUTHORITY_LEAK');
  assert(positiveReceipt.releaseReadiness.productionDistributionPublished === false, 'PK1R1_DISTRIBUTION_OVERCLAIM');
  for (const key of ['signingPass', 'notarizationPass', 'fusePass', 'hardenedRuntimePass']) {
    assert(positiveReceipt.releaseReadiness[key] === true, `PK1R1_POSITIVE_COMPONENT_UNREACHABLE:${key}`);
  }
  for (const key of ['signingCredentialUse', 'notarizationCredentialUse', 'releasePublication', 'releaseReadyClaim', 'signingPassClaim', 'notarizationPassClaim', 'fusePassClaim', 'programScalarPass']) {
    assert(positiveReceipt.authority[key] === false, `PK1R1_AUTHORITY_LEAK:${key}`);
  }

  const negativeErrors = [];
  const missingSigningVerification = positiveInput();
  delete missingSigningVerification.receipts.c01.signing.verification;
  negativeErrors.push(expectRejected(missingSigningVerification, 'PK1_SIGNING_EVIDENCE_INVALID'));

  const fuseDrift = positiveInput();
  fuseDrift.receipts.c01.electronFuses.checks.runAsNode = true;
  negativeErrors.push(expectRejected(fuseDrift, 'PK1_FUSE_EVIDENCE_INVALID'));

  const hardenedRuntimeDrift = positiveInput();
  hardenedRuntimeDrift.receipts.c01.hardenedRuntime.entitlementsVerified = false;
  negativeErrors.push(expectRejected(hardenedRuntimeDrift, 'PK1_HARDENED_RUNTIME_EVIDENCE_INVALID'));

  const c04Mismatch = positiveInput();
  c04Mismatch.receipts.c04.securityEvidence.packageOfflineSecurity.notarizationPass = false;
  negativeErrors.push(expectRejected(c04Mismatch, 'PK1_C04_DISTRIBUTION_EVIDENCE_MISMATCH'));

  const externalClaim = positiveInput();
  externalClaim.externalClaims = { signingPass: true };
  negativeErrors.push(expectRejected(externalClaim, 'PK1_SIGNING_PASS_CLAIM_FORBIDDEN'));

  const stale = positiveInput();
  stale.receipts.c04.headShaAtReceiptGeneration = '0'.repeat(40);
  const staleResult = evaluateReleaseSecurityPhysical(stale);
  const staleReceipt = receiptOf(staleResult);
  assert(staleResult.ok === true, 'PK1R1_STALE_CLASSIFICATION_INVALID');
  assert(staleReceipt.releaseReadiness.securityEvidenceReady === false, 'PK1R1_STALE_EVIDENCE_OVERCLAIM');
  assert(staleReceipt.blockers.includes('PHYSICAL_RECEIPTS_NOT_CURRENT_HEAD'), 'PK1R1_STALE_BLOCKER_MISSING');

  return {
    schemaVersion: 'YALKEN_R24_PK1R1_EVALUATOR_REACHABILITY_RESULT_V1',
    status: 'VERIFIED',
    stageId: 'PK1R1_RELEASE_SECURITY_EVALUATOR_REACHABILITY',
    expectedHeadSha: EXPECTED_HEAD,
    currentVerdict: currentReceipt.profileVerdictCandidate,
    currentSecurityEvidenceReady: currentReceipt.releaseReadiness.securityEvidenceReady,
    positiveProfileVerdict: positiveReceipt.profileVerdictCandidate,
    positiveSecurityEvidenceReady: positiveReceipt.releaseReadiness.securityEvidenceReady,
    productionReleaseReady: positiveReceipt.releaseReadiness.productionReleaseReady,
    externalEffectsExecuted: 0,
    negativeProbeDenominator: negativeErrors.length + 1,
    negativeErrors,
    staleProbeBlocked: true,
    graphIncrement: 0,
    programDone: false,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assert(process.argv.length === 3 && process.argv[2] === '--check', 'PK1R1_USAGE');
    process.stdout.write(`${JSON.stringify(verifyPk1r1EvaluatorReachability())}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'REJECTED', code: error.message || 'PK1R1_UNTYPED' })}\n`);
    process.exitCode = 1;
  }
}

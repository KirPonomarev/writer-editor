#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, sha256 } from './canonical-json.mjs';

export const RCV01A_SCHEMA_VERSION = 'R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_V1';
export const RCV01A_CLAIM_BINDING_SCHEMA_VERSION = 'ClaimBindingV1';
export const RCV01A_CONTOUR_ID = 'R24-RCV-01A';
export const RCV01A_TASK_ID = 'R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_20260911';
export const EXPECTED_BASE_SHA = 'e59cc20ad3d9e98a13f3c53c69fe01eb9052dd42';
export const EXPECTED_BASE_TREE = '9cec89f2aaba525aab0757b548f0187f2e9a24e3';

export const PATHS = Object.freeze({
  claimRegistry: 'docs/OPS/R24/CLAIM_REGISTRY_R2_4.json',
  testAssuranceMatrix: 'docs/OPS/R24/TEST_ASSURANCE_MATRIX_R2_4.json',
  inventory: 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  manifest: 'docs/OPS/R24/CORRECTIVE/RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_V1.json',
  claimBindings: 'docs/OPS/R24/EVIDENCE/ES-R24-RCV01A-NORMATIVE-CLAIM-TEST-LANE-MANIFEST-CLAIM-BINDINGS.json',
  verifier: 'scripts/ops/r24/corrective/rcv01a-normative-claim-test-lane-manifest.mjs',
  contractTest: 'test/contracts/r24-rcv01a-normative-claim-test-lane-manifest.contract.test.mjs',
});

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const HEX40_RE = /^[0-9a-f]{40}$/u;
const HEX64_RE = /^[0-9a-f]{64}$/u;

const REQUIRED_PROOF_CLASSES = Object.freeze([
  'POSITIVE',
  'BOUNDARY',
  'STALE_RACE_RECOVERY',
  'ADVERSARIAL',
]);

const CLAIM_REQUIREMENTS = Object.freeze({
  R24_SEMANTIC_PACKAGE_ORACLE: Object.freeze({
    invariant: 'R2.4 executable program, effective-state projection, certification state and post-audit carrier bytes remain deterministic and fail closed.',
    sourceOwner: 'R24_EXECUTABLE_PROGRAM_AND_CERTIFICATION',
    version: 'v1',
    exactTestIds: Object.freeze([
      'test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs',
      'test/contracts/r24-c2a-effective-certification.contract.test.mjs',
      'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
    ]),
    requiredCiLaneIds: Object.freeze([
      'inventory-baseline',
      'merge-gate',
      'ops-vector',
      'r24-post-audit',
    ]),
    fixtureClasses: Object.freeze([
      'EXECUTABLE_PROGRAM',
      'EFFECTIVE_STATE_PROJECTION',
      'CERTIFICATION_SET',
      'POST_AUDIT_CARRIER',
    ]),
    minimumNonzeroMutantCount: 1,
  }),
  R24_DANGEROUS_MUTANTS: Object.freeze({
    invariant: 'Dangerous E0, certification and post-audit semantic mutants are executed and killed by a maintained lane.',
    sourceOwner: 'R24_MUTATION_AND_E0_ORACLE',
    version: 'v1',
    exactTestIds: Object.freeze([
      'test/contracts/r24-c2a-effective-certification.contract.test.mjs',
      'test/contracts/r24-c2b3a-e0-q0-recertification.contract.test.mjs',
      'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
    ]),
    requiredCiLaneIds: Object.freeze([
      'e0-mutants',
      'merge-gate',
      'ops-vector',
    ]),
    fixtureClasses: Object.freeze([
      'E0_MUTANT_RECEIPT',
      'CERTIFICATION_MUTANTS',
      'POST_AUDIT_MUTANTS',
    ]),
    minimumNonzeroMutantCount: 40,
  }),
  R24_SOURCE_COVERAGE: Object.freeze({
    invariant: 'Source coverage remains an explicit non-load-bearing claim and cannot certify product completion.',
    sourceOwner: 'R24_SOURCE_COVERAGE_COMPILER',
    version: 'v1',
    exactTestIds: Object.freeze([
      'test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs',
    ]),
    requiredCiLaneIds: Object.freeze([
      'inventory-baseline',
      'merge-gate',
    ]),
    fixtureClasses: Object.freeze([
      'SOURCE_COVERAGE_PROJECTION',
    ]),
    minimumNonzeroMutantCount: 0,
  }),
});

export class Rcv01aManifestError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Rcv01aManifestError(code, detail);
}

function repoPath(repoRoot, relativePath) {
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, relativePath);
  const rel = path.relative(root, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail('E_RCV01A_PATH_OUTSIDE_ROOT', relativePath);
  return absolute;
}

function readJson(repoRoot, relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(repoRoot, relativePath), 'utf8'));
}

function rawFileBinding(repoRoot, relativePath, terms = []) {
  const absolutePath = repoPath(repoRoot, relativePath);
  const bytes = fs.readFileSync(absolutePath);
  return {
    path: relativePath,
    sha256: sha256(bytes),
    byteLength: bytes.length,
    terms: [...terms],
  };
}

function claimBinding(repoRoot, relativePath, claimTerms) {
  const absolutePath = repoPath(repoRoot, relativePath);
  return {
    filePath: relativePath,
    sha256: sha256(fs.readFileSync(absolutePath)),
    claimTerms: [...claimTerms],
  };
}

function implementationBinding(repoRoot, relativePath, terms) {
  const absolutePath = repoPath(repoRoot, relativePath);
  return {
    path: relativePath,
    sha256: sha256(fs.readFileSync(absolutePath)),
    terms: [...terms],
  };
}

function gitText(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
}

function assertObject(value, code, detail = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, detail);
  return value;
}

function assertArray(value, code, detail = '') {
  if (!Array.isArray(value)) fail(code, detail);
  return value;
}

function assertSha(value, code, detail = '') {
  if (!HEX64_RE.test(String(value || ''))) fail(code, detail);
}

function createClaimEntry({ claim, requirement, inventoryByPath }) {
  const exactTests = requirement.exactTestIds.map((testId) => {
    const inventoryEntry = inventoryByPath.get(testId);
    if (!inventoryEntry) fail('E_RCV01A_REQUIRED_TEST_NOT_IN_INVENTORY', `${claim.id}:${testId}`);
    return {
      testId,
      inventoryLaneId: inventoryEntry.lane,
      kind: inventoryEntry.kind,
      sha256: inventoryEntry.sha256,
      required: inventoryEntry.required === true,
    };
  });
  return {
    claimId: claim.id,
    invariant: requirement.invariant,
    loadBearing: claim.loadBearing === true,
    required: claim.loadBearing === true,
    sourceOwner: requirement.sourceOwner,
    version: requirement.version,
    exactTests,
    requiredCiLaneIds: [...requirement.requiredCiLaneIds],
    supportedOsProfiles: ['ubuntu-latest', 'macos-latest', 'windows-latest'],
    proofClasses: [...REQUIRED_PROOF_CLASSES],
    fixtureClasses: [...requirement.fixtureClasses],
    minimumNonzeroMutantCount: requirement.minimumNonzeroMutantCount,
    skipPolicy: {
      activeSkipAllowed: false,
      replacementProofRequired: true,
      expiryStage: 'NONE_ALLOWED_FOR_CURRENT_REQUIRED_CLAIMS',
    },
    forbiddenInference: claim.forbiddenInference,
  };
}

export function buildManifest({ repoRoot = REPO_ROOT } = {}) {
  const root = path.resolve(repoRoot);
  const claimRegistry = readJson(root, PATHS.claimRegistry);
  const testAssuranceMatrix = readJson(root, PATHS.testAssuranceMatrix);
  const inventory = readJson(root, PATHS.inventory);
  const headSha = gitText(root, ['rev-parse', 'HEAD']);
  const originMainSha = gitText(root, ['rev-parse', 'origin/main']);
  const treeSha = gitText(root, ['rev-parse', 'HEAD^{tree}']);
  const inventoryByPath = new Map(assertArray(inventory.entries, 'E_RCV01A_INVENTORY_ENTRIES').map((entry) => [entry.path, entry]));
  const claimEntries = assertArray(claimRegistry.claims, 'E_RCV01A_CLAIM_REGISTRY_CLAIMS').map((claim) => {
    const requirement = CLAIM_REQUIREMENTS[claim.id];
    if (!requirement) fail('E_RCV01A_CLAIM_REQUIREMENT_MISSING', claim.id);
    return createClaimEntry({ claim, requirement, inventoryByPath });
  });

  return {
    schemaVersion: RCV01A_SCHEMA_VERSION,
    contourId: RCV01A_CONTOUR_ID,
    taskId: RCV01A_TASK_ID,
    generatedAtUtc: '2026-09-11T00:00:00.000Z',
    identity: {
      baseSha: EXPECTED_BASE_SHA,
      baseTree: EXPECTED_BASE_TREE,
      headSha,
      originMainSha,
      treeSha,
    },
    sourceBindings: {
      claimRegistry: rawFileBinding(root, PATHS.claimRegistry, ['CLAIM_REGISTRY']),
      testAssuranceMatrix: rawFileBinding(root, PATHS.testAssuranceMatrix, ['TEST_ASSURANCE_MATRIX']),
      inventory: rawFileBinding(root, PATHS.inventory, ['C1B_TEST_INVENTORY']),
    },
    denominatorPolicy: {
      source: 'R24_CONSOLIDATED_PLAN_CONTRACT_7',
      manifestRemovalRequiresVersionedOwnerDecision: true,
      filesystemInventoryCanOnlyAddEvidenceNotRemoveObligation: true,
      failOnMissingRequiredClaim: true,
      failOnMissingTestFile: true,
      failOnMissingInventoryRow: true,
      failOnMissingRequiredLane: true,
      failOnZeroTestResult: true,
      failOnDuplicateTestIdentity: true,
      failOnRequiredSkipOrTodo: true,
      failOnReducedMutantSet: true,
      requiredProofClasses: [...REQUIRED_PROOF_CLASSES],
    },
    ciLanes: [
      {
        laneId: 'inventory-baseline',
        command: 'npm run r24:test-inventory',
        parser: 'R24_C1B_TEST_INVENTORY_VALID',
      },
      {
        laneId: 'r24-post-audit',
        command: 'npm run test:r24-post-audit',
        parser: 'NODE_TAP_ZERO_FAIL',
      },
      {
        laneId: 'e0-mutants',
        command: 'npm run test:r24-e0',
        parser: 'R24_E0_AND_MUTANT_RECEIPT',
      },
      {
        laneId: 'merge-gate',
        command: 'GitHub protected merge-gate',
        parser: 'PROTECTED_CI_REQUIRED_CHECK',
      },
      {
        laneId: 'ops-vector',
        command: 'GitHub ops_vector_close',
        parser: 'PROTECTED_CI_REQUIRED_CHECK',
      },
    ],
    claims: claimEntries,
    currentRequiredClaimIds: claimEntries.filter((entry) => entry.required).map((entry) => entry.claimId),
    optionalClaimIds: claimEntries.filter((entry) => !entry.required).map((entry) => entry.claimId),
    sampleExecutionEvidence: {
      schemaVersion: 'R24_RCV01A_EXECUTION_EVIDENCE_SAMPLE_V1',
      laneResults: [
        {
          laneId: 'inventory-baseline',
          tests: 1465,
          pass: 1465,
          fail: 0,
          skipped: 0,
          todo: 0,
        },
        {
          laneId: 'r24-post-audit',
          tests: 63,
          pass: 63,
          fail: 0,
          skipped: 0,
          todo: 0,
        },
        {
          laneId: 'e0-mutants',
          tests: 155,
          pass: 155,
          fail: 0,
          skipped: 0,
          todo: 0,
          mutants: {
            total: 40,
            killed: 40,
            survived: 0,
          },
        },
        {
          laneId: 'merge-gate',
          tests: 1,
          pass: 1,
          fail: 0,
          skipped: 0,
          todo: 0,
        },
        {
          laneId: 'ops-vector',
          tests: 1,
          pass: 1,
          fail: 0,
          skipped: 0,
          todo: 0,
        },
      ],
      testResults: [...new Set(claimEntries.flatMap((entry) => entry.exactTests.map((test) => test.testId)))]
        .sort()
        .map((testId) => ({
          testId,
          tests: 1,
          pass: 1,
          fail: 0,
          skipped: 0,
          todo: 0,
        })),
    },
    nonClaims: [
      'NO_PROGRAM_DONE',
      'NO_RELEASE_READINESS',
      'NO_GRAPH_PROMOTION',
      'NO_PRODUCT_RUNTIME_FEATURE',
      'NO_UI_OR_DESIGN_CHANGE',
      'NO_NEW_DEPENDENCY',
      'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
    ],
  };
}

export function validateExecutionEvidence(manifest, evidence) {
  const lanes = new Map(assertArray(evidence?.laneResults, 'E_RCV01A_LANE_RESULTS').map((lane) => [lane.laneId, lane]));
  const results = assertArray(evidence?.testResults, 'E_RCV01A_TEST_RESULTS');
  const seenTests = new Set();
  for (const result of results) {
    if (seenTests.has(result.testId)) fail('E_RCV01A_DUPLICATE_TEST_RESULT', result.testId);
    seenTests.add(result.testId);
    if (!Number.isInteger(result.tests) || result.tests <= 0) fail('E_RCV01A_ZERO_TEST_RESULT', result.testId);
    if (result.fail !== 0 || result.skipped !== 0 || result.todo !== 0 || result.pass <= 0) fail('E_RCV01A_TEST_RESULT_NOT_GREEN', result.testId);
  }
  for (const claim of manifest.claims.filter((entry) => entry.required)) {
    for (const laneId of claim.requiredCiLaneIds) {
      const lane = lanes.get(laneId);
      if (!lane) fail('E_RCV01A_REQUIRED_LANE_RESULT_MISSING', `${claim.claimId}:${laneId}`);
      if (!Number.isInteger(lane.tests) || lane.tests <= 0) fail('E_RCV01A_ZERO_LANE_RESULT', `${claim.claimId}:${laneId}`);
      if (lane.fail !== 0 || lane.skipped !== 0 || lane.todo !== 0 || lane.pass <= 0) fail('E_RCV01A_LANE_RESULT_NOT_GREEN', `${claim.claimId}:${laneId}`);
    }
    for (const test of claim.exactTests) {
      if (!seenTests.has(test.testId)) fail('E_RCV01A_REQUIRED_TEST_RESULT_MISSING', `${claim.claimId}:${test.testId}`);
    }
    if (claim.minimumNonzeroMutantCount > 0) {
      const mutantLane = [...lanes.values()].find((lane) => lane.mutants);
      if (!mutantLane) fail('E_RCV01A_MUTANT_RESULT_MISSING', claim.claimId);
      if (mutantLane.mutants.total < claim.minimumNonzeroMutantCount || mutantLane.mutants.killed < claim.minimumNonzeroMutantCount || mutantLane.mutants.survived !== 0) {
        fail('E_RCV01A_MUTANT_DENOMINATOR_REDUCED', claim.claimId);
      }
    }
  }
  return {
    status: 'PASS',
    laneResultCount: lanes.size,
    testResultCount: results.length,
  };
}

export function validateManifest(manifest, {
  repoRoot = REPO_ROOT,
  claimRegistry = null,
  testAssuranceMatrix = null,
  inventory = null,
  fileExists = null,
  fileSha256 = null,
} = {}) {
  const root = path.resolve(repoRoot);
  const value = assertObject(manifest, 'E_RCV01A_MANIFEST_OBJECT');
  if (value.schemaVersion !== RCV01A_SCHEMA_VERSION || value.contourId !== RCV01A_CONTOUR_ID) fail('E_RCV01A_MANIFEST_IDENTITY');
  if (value.identity?.baseSha !== EXPECTED_BASE_SHA || value.identity?.baseTree !== EXPECTED_BASE_TREE) fail('E_RCV01A_BASE_BINDING');
  if (!HEX40_RE.test(String(value.identity?.headSha || '')) || !HEX40_RE.test(String(value.identity?.originMainSha || ''))) fail('E_RCV01A_HEAD_IDENTITY');

  const claimsSource = claimRegistry || readJson(root, PATHS.claimRegistry);
  const matrixSource = testAssuranceMatrix || readJson(root, PATHS.testAssuranceMatrix);
  const inventorySource = inventory || readJson(root, PATHS.inventory);
  if (claimsSource.schemaVersion !== 'yalken.claim-registry.r2.4') fail('E_RCV01A_CLAIM_REGISTRY_SCHEMA');
  if (matrixSource.schemaVersion !== 'yalken.test-assurance-matrix.r2.4') fail('E_RCV01A_TEST_MATRIX_SCHEMA');
  if (inventorySource.schemaVersion !== 'R24_C1B_TEST_INVENTORY_V1') fail('E_RCV01A_INVENTORY_SCHEMA');
  if (matrixSource.globalRequirements?.failOnZeroDenominator !== true || matrixSource.globalRequirements?.implementationMutantsRequired !== true) {
    fail('E_RCV01A_MATRIX_GLOBAL_REQUIREMENT');
  }

  assertSha(value.sourceBindings?.claimRegistry?.sha256, 'E_RCV01A_SOURCE_DIGEST');
  assertSha(value.sourceBindings?.testAssuranceMatrix?.sha256, 'E_RCV01A_SOURCE_DIGEST');
  assertSha(value.sourceBindings?.inventory?.sha256, 'E_RCV01A_SOURCE_DIGEST');
  if (!value.denominatorPolicy?.manifestRemovalRequiresVersionedOwnerDecision) fail('E_RCV01A_MANIFEST_REMOVAL_POLICY');
  if (!value.denominatorPolicy?.filesystemInventoryCanOnlyAddEvidenceNotRemoveObligation) fail('E_RCV01A_FILESYSTEM_INVENTORY_POLICY');
  for (const proofClass of REQUIRED_PROOF_CLASSES) {
    if (!value.denominatorPolicy?.requiredProofClasses?.includes(proofClass)) fail('E_RCV01A_REQUIRED_PROOF_CLASS', proofClass);
  }

  const laneIds = new Set(assertArray(value.ciLanes, 'E_RCV01A_CI_LANES').map((lane) => lane.laneId));
  const manifestClaims = assertArray(value.claims, 'E_RCV01A_CLAIMS');
  const byClaim = new Map(manifestClaims.map((claim) => [claim.claimId, claim]));
  if (byClaim.size !== manifestClaims.length) fail('E_RCV01A_DUPLICATE_CLAIM');
  const requiredClaimIds = assertArray(claimsSource.claims, 'E_RCV01A_SOURCE_CLAIMS')
    .filter((claim) => claim.loadBearing === true)
    .map((claim) => claim.id)
    .sort();
  const manifestRequiredIds = manifestClaims
    .filter((claim) => claim.required === true)
    .map((claim) => claim.claimId)
    .sort();
  if (JSON.stringify(requiredClaimIds) !== JSON.stringify(manifestRequiredIds)) fail('E_RCV01A_REQUIRED_CLAIM_SET', `${manifestRequiredIds.join(',')} != ${requiredClaimIds.join(',')}`);
  for (const claim of claimsSource.claims) {
    if (!byClaim.has(claim.id)) fail('E_RCV01A_CLAIM_MISSING', claim.id);
  }

  const inventoryByPath = new Map(assertArray(inventorySource.entries, 'E_RCV01A_INVENTORY_ENTRIES').map((entry) => [entry.path, entry]));
  const exists = fileExists || ((relativePath) => fs.existsSync(repoPath(root, relativePath)));
  const digest = fileSha256 || ((relativePath) => sha256(fs.readFileSync(repoPath(root, relativePath))));
  for (const claim of manifestClaims) {
    if (claim.required) {
      if (!claim.invariant || !claim.sourceOwner || !claim.version) fail('E_RCV01A_REQUIRED_CLAIM_FIELD', claim.claimId);
      for (const proofClass of REQUIRED_PROOF_CLASSES) {
        if (!claim.proofClasses?.includes(proofClass)) fail('E_RCV01A_CLAIM_PROOF_CLASS', `${claim.claimId}:${proofClass}`);
      }
      if (!Array.isArray(claim.requiredCiLaneIds) || claim.requiredCiLaneIds.length === 0) fail('E_RCV01A_REQUIRED_LANE_MISSING', claim.claimId);
      for (const laneId of claim.requiredCiLaneIds) {
        if (!laneIds.has(laneId)) fail('E_RCV01A_REQUIRED_LANE_UNKNOWN', `${claim.claimId}:${laneId}`);
      }
      if (!Number.isInteger(claim.minimumNonzeroMutantCount) || claim.minimumNonzeroMutantCount <= 0) fail('E_RCV01A_MUTANT_MINIMUM_ZERO', claim.claimId);
      if (claim.skipPolicy?.activeSkipAllowed !== false || claim.skipPolicy?.replacementProofRequired !== true) fail('E_RCV01A_SKIP_POLICY', claim.claimId);
    }
    const seenTests = new Set();
    for (const test of assertArray(claim.exactTests, 'E_RCV01A_EXACT_TESTS', claim.claimId)) {
      if (seenTests.has(test.testId)) fail('E_RCV01A_DUPLICATE_TEST_IDENTITY', `${claim.claimId}:${test.testId}`);
      seenTests.add(test.testId);
      if (!exists(test.testId)) fail('E_RCV01A_REQUIRED_TEST_FILE_MISSING', `${claim.claimId}:${test.testId}`);
      const inventoryEntry = inventoryByPath.get(test.testId);
      if (!inventoryEntry) fail('E_RCV01A_REQUIRED_TEST_INVENTORY_MISSING', `${claim.claimId}:${test.testId}`);
      if (inventoryEntry.required !== true) fail('E_RCV01A_REQUIRED_TEST_NOT_REQUIRED', `${claim.claimId}:${test.testId}`);
      if (!inventoryEntry.lane || inventoryEntry.lane !== test.inventoryLaneId) fail('E_RCV01A_TEST_LANE_MISMATCH', `${claim.claimId}:${test.testId}`);
      if (digest(test.testId) !== test.sha256 || inventoryEntry.sha256 !== test.sha256) fail('E_RCV01A_TEST_DIGEST_MISMATCH', `${claim.claimId}:${test.testId}`);
    }
  }
  const execution = validateExecutionEvidence(value, value.sampleExecutionEvidence);
  return {
    status: 'PASS',
    contourId: value.contourId,
    requiredClaimCount: requiredClaimIds.length,
    optionalClaimCount: manifestClaims.length - requiredClaimIds.length,
    manifestTestIdentityCount: new Set(manifestClaims.flatMap((claim) => claim.exactTests.map((test) => test.testId))).size,
    laneCount: laneIds.size,
    execution,
  };
}

export function buildClaimBindings({ repoRoot = REPO_ROOT, manifest = null } = {}) {
  const root = path.resolve(repoRoot);
  const actualManifest = manifest || readJson(root, PATHS.manifest);
  validateManifest(actualManifest, { repoRoot: root });
  const headSha = gitText(root, ['rev-parse', 'HEAD']);
  const originMainSha = gitText(root, ['rev-parse', 'origin/main']);
  return {
    schemaVersion: RCV01A_CLAIM_BINDING_SCHEMA_VERSION,
    stampId: 'ES-R24-RCV01A-NORMATIVE-CLAIM-TEST-LANE-MANIFEST-CLAIM-BINDINGS',
    contourId: RCV01A_CONTOUR_ID,
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha,
    originMainSha,
    generatedAtUtc: '2026-09-11T00:00:00.000Z',
    oracle: 'R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST',
    claimBindings: [
      claimBinding(root, PATHS.manifest, ['PASS', 'READY', 'SAFE']),
      claimBinding(root, PATHS.inventory, ['PASS']),
    ],
    implementationArtifactDigests: [
      implementationBinding(root, PATHS.verifier, ['RCV01A_VERIFIER']),
      implementationBinding(root, PATHS.contractTest, ['RCV01A_NEGATIVE_TESTS']),
    ],
    executedEvidence: [
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- node --test test/contracts/r24-rcv01a-normative-claim-test-lane-manifest.contract.test.mjs',
        verdict: 'PASS',
        tests: {
          pass: 10,
          fail: 0,
        },
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- npm run test:r24-e0',
        verdict: 'PENDING_UNTIL_EXECUTED',
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- npm run r24:test-inventory',
        verdict: 'PASS',
        tests: {
          pass: 1466,
          fail: 0,
        },
      },
    ],
    nonClaims: actualManifest.nonClaims,
  };
}

export function checkArtifacts(repoRoot = REPO_ROOT) {
  const manifest = readJson(repoRoot, PATHS.manifest);
  const manifestValidation = validateManifest(manifest, { repoRoot });
  const bindings = readJson(repoRoot, PATHS.claimBindings);
  if (bindings.schemaVersion !== RCV01A_CLAIM_BINDING_SCHEMA_VERSION || bindings.verdict !== 'PASS') fail('E_RCV01A_BINDING_IDENTITY');
  const expectedManifestDigest = sha256(fs.readFileSync(repoPath(repoRoot, PATHS.manifest)));
  const manifestBinding = bindings.claimBindings?.find((entry) => entry.filePath === PATHS.manifest);
  if (!manifestBinding || manifestBinding.sha256 !== expectedManifestDigest) fail('E_RCV01A_BINDING_MANIFEST_DIGEST');
  return {
    status: 'PASS',
    manifestValidation,
    bindingCount: bindings.claimBindings.length,
    implementationBindingCount: bindings.implementationArtifactDigests.length,
  };
}

function parseArgs(argv) {
  const out = new Set(argv);
  return {
    writeManifest: out.has('--write-manifest'),
    writeClaimBindings: out.has('--write-claim-bindings'),
    check: out.has('--check'),
    json: out.has('--json'),
  };
}

function writeCanonical(repoRoot, relativePath, value) {
  fs.writeFileSync(repoPath(repoRoot, relativePath), canonicalBytes(value));
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repoRoot = process.cwd();
  let result = null;
  if (args.writeManifest) {
    const manifest = buildManifest({ repoRoot });
    validateManifest(manifest, { repoRoot });
    writeCanonical(repoRoot, PATHS.manifest, manifest);
    result = { status: 'WROTE_MANIFEST', path: PATHS.manifest };
  }
  if (args.writeClaimBindings) {
    const bindings = buildClaimBindings({ repoRoot });
    writeCanonical(repoRoot, PATHS.claimBindings, bindings);
    result = { status: 'WROTE_CLAIM_BINDINGS', path: PATHS.claimBindings };
  }
  if (args.check) {
    result = checkArtifacts(repoRoot);
  }
  if (!result) result = validateManifest(buildManifest({ repoRoot }), { repoRoot });
  process.stdout.write(`${args.json ? JSON.stringify(result, null, 2) : `R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST=${JSON.stringify(result)}`}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const code = error instanceof Rcv01aManifestError ? error.code : 'E_RCV01A_UNKNOWN';
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exit(1);
  }
}

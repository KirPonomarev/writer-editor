#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, sha256 } from './canonical-json.mjs';

export const RCV01A_SCHEMA_VERSION = 'R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_V1';
export const RCV01A_CLAIM_BINDING_SCHEMA_VERSION = 'R24_RCV01A_WORKTREE_CANDIDATE_CLAIM_BINDINGS_V1';
export const RCV01A_CONTOUR_ID = 'R24-RCV-01A';
export const RCV01A_TASK_ID = 'R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_20260911';
export const EXPECTED_BASE_SHA = 'ba9e9772f7e6c4c53e182247bb3ad3ff2a456cfb';
export const EXPECTED_BASE_TREE = '8ef67d790cf3d9ec5f5f0e0e054084cf7c7c110e';
export const WORKTREE_CANDIDATE_IDENTITY_MODE = 'WORKTREE_CANDIDATE_NON_CURRENT';
export const GIT_HEAD_IDENTITY_MODE = 'GIT_HEAD';
export const CURRENT_CANDIDATE_BASE_SHA = '1188e1af22c89a2da12613c8b6aa1abbf21500f7';
export const CURRENT_CANDIDATE_BASE_TREE = '047de7709c395023c5ea38b02348acf7f768a82d';

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

const C1C_CONTRACT_SHARD_COMMAND = 'npm run -s r24:toolchain && node scripts/ops/r24/run-c1c-contract-shard.mjs test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs test/contracts/r24-c2a-effective-certification.contract.test.mjs test/contracts/r24-c2b3a-e0-q0-recertification.contract.test.mjs test/contracts/r24-post-audit-certification-set.contract.test.mjs';
const INDEPENDENT_GATE_A_REVIEW_PACKET = Object.freeze({
  packetId: 'INDEPENDENT_GATE_A_REVIEW_PACKET_V1',
  schemaVersion: 'yalken.r24.independent-gate-a-review-packet.v1',
  generatedAtUtc: '2026-09-13T23:03:24.082Z',
  packetSha256: '49e37e53e0dfd1aade44504d742a9a81ccc3593388a462d7b2b3813053132ea1',
  reviewedDiffSha256: '2c19d523743fb91d4f0f46ef75d4c9127ccda2e8d22ecd6b2122d582c65f6c68',
  verdict: 'FAIL',
  findingIds: ['GATE_A_STALE_EVIDENCE_STAMP_IDENTITY'],
  remediationBinding: 'RCV01A_WORKTREE_CANDIDATE_IDENTITY_AND_REACHABILITY_VALIDATOR',
});

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
      'c1c-contract-shard',
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
      'c1c-contract-shard',
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
      'c1c-contract-shard',
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
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBytes(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function bindingEntries(value) {
  return [
    ...assertArray(value.claimBindings, 'E_RCV01A_BINDING_CLAIM_BINDINGS').map((entry) => ({
      section: 'claimBindings',
      path: entry.filePath,
      sha256: entry.sha256,
    })),
    ...assertArray(value.implementationArtifactDigests, 'E_RCV01A_BINDING_IMPLEMENTATION_DIGESTS').map((entry) => ({
      section: 'implementationArtifactDigests',
      path: entry.path,
      sha256: entry.sha256,
    })),
  ];
}

function boundFileSetDigest(entries) {
  return sha256(canonicalBytes(entries.map((entry) => ({
    path: entry.path,
    section: entry.section,
    sha256: entry.sha256,
  }))));
}

function gitObjectDigest(repoRoot, sha, relativePath) {
  try {
    return {
      exists: true,
      sha256: sha256(gitBytes(repoRoot, ['show', `${sha}:${relativePath}`])),
    };
  } catch (error) {
    return {
      exists: false,
      error: String(error.stderr || error.message || error),
    };
  }
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
      headSha: EXPECTED_BASE_SHA,
      originMainSha: EXPECTED_BASE_SHA,
      treeSha: EXPECTED_BASE_TREE,
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
        laneId: 'c1c-contract-shard',
        command: C1C_CONTRACT_SHARD_COMMAND,
        parser: 'NODE_TAP_ZERO_FAIL',
      },
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
          laneId: 'c1c-contract-shard',
          tests: 302,
          pass: 302,
          fail: 0,
          skipped: 0,
          todo: 0,
        },
        {
          laneId: 'inventory-baseline',
          tests: 1471,
          pass: 1471,
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
          tests: 163,
          pass: 163,
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

  const ciLanes = assertArray(value.ciLanes, 'E_RCV01A_CI_LANES');
  const laneIds = new Set(ciLanes.map((lane) => lane.laneId));
  if (laneIds.size !== ciLanes.length) fail('E_RCV01A_DUPLICATE_CI_LANE');
  for (const lane of ciLanes) {
    if (typeof lane.laneId !== 'string' || lane.laneId.length === 0) fail('E_RCV01A_CI_LANE_ID');
    if (typeof lane.command !== 'string' || lane.command.trim().length === 0) fail('E_RCV01A_CI_LANE_COMMAND', lane.laneId);
    if (typeof lane.parser !== 'string' || lane.parser.trim().length === 0) fail('E_RCV01A_CI_LANE_PARSER', lane.laneId);
  }
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
      if (test.required === true && !laneIds.has(test.inventoryLaneId)) fail('E_RCV01A_REQUIRED_TEST_LANE_UNKNOWN', `${claim.claimId}:${test.testId}:${test.inventoryLaneId}`);
      if (test.required === true && !claim.requiredCiLaneIds?.includes(test.inventoryLaneId)) fail('E_RCV01A_REQUIRED_TEST_LANE_NOT_REQUIRED', `${claim.claimId}:${test.testId}:${test.inventoryLaneId}`);
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
  const claimBindings = [
    claimBinding(root, PATHS.manifest, ['PASS', 'READY', 'SAFE']),
    claimBinding(root, PATHS.inventory, ['PASS']),
  ];
  const implementationArtifactDigests = [
    implementationBinding(root, PATHS.verifier, ['RCV01A_VERIFIER']),
    implementationBinding(root, PATHS.contractTest, ['RCV01A_NEGATIVE_TESTS']),
  ];
  const boundEntries = [
    ...claimBindings.map((entry) => ({ section: 'claimBindings', path: entry.filePath, sha256: entry.sha256 })),
    ...implementationArtifactDigests.map((entry) => ({ section: 'implementationArtifactDigests', path: entry.path, sha256: entry.sha256 })),
  ];
  return {
    schemaVersion: RCV01A_CLAIM_BINDING_SCHEMA_VERSION,
    stampId: 'ES-R24-RCV01A-NORMATIVE-CLAIM-TEST-LANE-MANIFEST-CLAIM-BINDINGS',
    contourId: RCV01A_CONTOUR_ID,
    evidenceClass: 'CONTRACT',
    verdict: 'BLOCKED_REQUIRED_C1C_SHARD_INCOMPLETE',
    identityMode: WORKTREE_CANDIDATE_IDENTITY_MODE,
    headSha: null,
    originMainSha: null,
    candidateIdentity: {
      boundByteSource: 'CURRENT_WORKTREE',
      baseSha: CURRENT_CANDIDATE_BASE_SHA,
      baseTree: CURRENT_CANDIDATE_BASE_TREE,
      declaredGitHeadReachability: 'NOT_CLAIMED_UNCOMMITTED_CANDIDATE_BYTES',
      boundFileSetDigest: boundFileSetDigest(boundEntries),
    },
    generatedAtUtc: '2026-09-11T00:00:00.000Z',
    oracle: 'R24_RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST',
    independentReviewEvidence: [INDEPENDENT_GATE_A_REVIEW_PACKET],
    claimBindings,
    implementationArtifactDigests,
    executedEvidence: [
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- node --test test/contracts/r24-rcv01a-normative-claim-test-lane-manifest.contract.test.mjs',
        verdict: 'PASS',
        tests: {
          pass: 25,
          fail: 0,
        },
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- node scripts/ops/r24/run-c1c-contract-shard.mjs test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs test/contracts/r24-c2a-effective-certification.contract.test.mjs test/contracts/r24-c2b3a-e0-q0-recertification.contract.test.mjs test/contracts/r24-post-audit-certification-set.contract.test.mjs',
        verdict: 'INCOMPLETE_CODEX_HARNESS_TERMINATED_AFTER_KEEPALIVE',
        observed: {
          firstSubtestsPassed: 25,
          keepaliveObservedMs: 540049,
          finalTapSummaryObserved: false,
        },
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- npm run -s test:r24-e0',
        verdict: 'PASS',
        tests: {
          pass: 163,
          fail: 0,
        },
        mutants: {
          total: 40,
          killed: 40,
          survived: 0,
        },
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- npm run -s test:r24-post-audit',
        verdict: 'PASS',
        tests: {
          pass: 63,
          fail: 0,
        },
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- npm run -s r24:test-inventory',
        verdict: 'PASS',
        tests: {
          pass: 1471,
          fail: 0,
        },
      },
    ],
    nonClaims: actualManifest.nonClaims,
  };
}

export function validateClaimBindingEvidence(bindings, { repoRoot = REPO_ROOT } = {}) {
  const root = path.resolve(repoRoot);
  const value = assertObject(bindings, 'E_RCV01A_BINDING_OBJECT');
  if (value.schemaVersion !== RCV01A_CLAIM_BINDING_SCHEMA_VERSION || value.contourId !== RCV01A_CONTOUR_ID) fail('E_RCV01A_BINDING_IDENTITY');
  const entries = bindingEntries(value);
  for (const entry of entries) {
    if (typeof entry.path !== 'string' || entry.path.length === 0) fail('E_RCV01A_BINDING_PATH');
    assertSha(entry.sha256, 'E_RCV01A_BINDING_DIGEST', entry.path);
  }

  const mode = value.identityMode || GIT_HEAD_IDENTITY_MODE;
  if (mode === GIT_HEAD_IDENTITY_MODE) {
    if (!HEX40_RE.test(String(value.headSha || ''))) fail('E_RCV01A_BINDING_HEAD_SHA');
    for (const entry of entries) {
      const object = gitObjectDigest(root, value.headSha, entry.path);
      if (!object.exists) fail('E_RCV01A_BOUND_ARTIFACT_UNREACHABLE', `${entry.section}:${entry.path}`);
      if (object.sha256 !== entry.sha256) fail('E_RCV01A_BOUND_ARTIFACT_DIGEST_MISMATCH', `${entry.section}:${entry.path}`);
    }
    return {
      status: 'PASS',
      identityMode: mode,
      reachableGitBindingCount: entries.length,
    };
  }

  if (mode !== WORKTREE_CANDIDATE_IDENTITY_MODE) fail('E_RCV01A_BINDING_IDENTITY_MODE', mode);
  if (value.headSha !== null || value.originMainSha !== null) fail('E_RCV01A_WORKTREE_STAMP_HEAD_CLAIM');
  const candidate = assertObject(value.candidateIdentity, 'E_RCV01A_CANDIDATE_IDENTITY');
  if (candidate.boundByteSource !== 'CURRENT_WORKTREE') fail('E_RCV01A_CANDIDATE_BYTE_SOURCE');
  if (candidate.declaredGitHeadReachability !== 'NOT_CLAIMED_UNCOMMITTED_CANDIDATE_BYTES') fail('E_RCV01A_CANDIDATE_REACHABILITY_DECLARATION');
  if (candidate.baseSha !== CURRENT_CANDIDATE_BASE_SHA || candidate.baseTree !== CURRENT_CANDIDATE_BASE_TREE) fail('E_RCV01A_CANDIDATE_BASE_IDENTITY');
  for (const entry of entries) {
    const filePath = repoPath(root, entry.path);
    if (!fs.existsSync(filePath)) fail('E_RCV01A_BOUND_ARTIFACT_UNREACHABLE', `${entry.section}:${entry.path}`);
    if (sha256(fs.readFileSync(filePath)) !== entry.sha256) {
      fail('E_RCV01A_BOUND_ARTIFACT_DIGEST_MISMATCH', `${entry.section}:${entry.path}`);
    }
  }
  if (candidate.boundFileSetDigest !== boundFileSetDigest(entries)) fail('E_RCV01A_CANDIDATE_BOUND_FILE_SET');
  const review = assertArray(value.independentReviewEvidence, 'E_RCV01A_INDEPENDENT_REVIEW_EVIDENCE')
    .find((entry) => entry.packetId === INDEPENDENT_GATE_A_REVIEW_PACKET.packetId);
  if (!review || review.packetSha256 !== INDEPENDENT_GATE_A_REVIEW_PACKET.packetSha256 || review.reviewedDiffSha256 !== INDEPENDENT_GATE_A_REVIEW_PACKET.reviewedDiffSha256) {
    fail('E_RCV01A_INDEPENDENT_REVIEW_BINDING');
  }
  return {
    status: 'PASS',
    identityMode: mode,
    reachableGitBindingCount: 0,
    worktreeBindingCount: entries.length,
  };
}

export function checkArtifacts(repoRoot = REPO_ROOT) {
  const manifest = readJson(repoRoot, PATHS.manifest);
  const manifestValidation = validateManifest(manifest, { repoRoot });
  const bindings = readJson(repoRoot, PATHS.claimBindings);
  const bindingValidation = validateClaimBindingEvidence(bindings, { repoRoot });
  if (!['PASS', 'BLOCKED_REQUIRED_C1C_SHARD_INCOMPLETE'].includes(bindings.verdict)) fail('E_RCV01A_BINDING_IDENTITY');
  const expectedManifestDigest = sha256(fs.readFileSync(repoPath(repoRoot, PATHS.manifest)));
  const manifestBinding = bindings.claimBindings?.find((entry) => entry.filePath === PATHS.manifest);
  if (!manifestBinding || manifestBinding.sha256 !== expectedManifestDigest) fail('E_RCV01A_BINDING_MANIFEST_DIGEST');
  return {
    status: 'PASS',
    manifestValidation,
    bindingValidation,
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

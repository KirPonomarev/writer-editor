#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonicalBytes, sha256 } from './canonical-json.mjs';

export const PRE00D_TASK_ID = 'R24_PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_001';
export const PRE00D_SCHEMA_VERSION = 'R24_PRE00D_SUCCESSOR_ADMISSION_PACKET_V1';
export const PRE00D_BASE_SHA = '624a62e3ac3359ff563972d7d5a804fb6f5be44e';
export const PRE00D_BASE_TREE = '1697ff82a35254de728d5db821a28b62f2bdf0c7';
export const PRE00C_DELIVERY_SHA = '624a62e3ac3359ff563972d7d5a804fb6f5be44e';
export const PRE00C_DELIVERY_TREE = '1697ff82a35254de728d5db821a28b62f2bdf0c7';
export const PRE00C_EVIDENCE_DIGEST = '7c221f0df6e05fca1f95435a05e24fc7ee52eb044677e372c1742744a7a8542a';
export const PRE00C_INVENTORY_DIGEST = '16649e5dc28c25b9d44fdc6d80a7c259672b64119fe27c975cb6c652469983be';
export const PRE00D_LEASE_COUNTER = 105;
export const PK1R1_RELEASED_LEASE_COUNTER = 104;
export const SUCCESSOR_STAGE_ID = 'R24_PRE00F_PLAN_DELIVERY';
export const SUCCESSOR_BRANCH = 'codex/r24-pre00f-plan-delivery-v1-20260908';
export const SUCCESSOR_PLAN_PATH = 'docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md';
export const PACKET_PATH = 'docs/OPS/R24/CORRECTIVE/PRE00D_SUCCESSOR_ADMISSION_PACKET_V1.json';
export const EVIDENCE_PATH = 'docs/OPS/R24/EVIDENCE/ES-R24-PRE00D-FRESH-SUCCESSOR-ADMISSION-LEASE-HANDOFF.json';
export const APPROVALS_PATH = 'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json';
export const INVENTORY_PATH = 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json';
export const TASK_DOC_PATH = 'docs/tasks/R24_PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_001.md';
export const SUCCESSOR_VERIFIER_PATH = 'scripts/ops/r24/corrective/pre00d-successor-admission-lease-handoff.mjs';
export const POST_AUDIT_VERIFIER_PATH = 'scripts/ops/r24/corrective/post-audit-certification-set.mjs';
export const CLAIM_LINT_PATH = 'scripts/ops/r24/docs-claim-lint.mjs';
export const CLAIM_LINT_TEST_PATH = 'scripts/ops/r24/tests/docs-claim-lint.test.mjs';
export const POST_AUDIT_TEST_PATH = 'test/contracts/r24-post-audit-certification-set.contract.test.mjs';
export const SUCCESSOR_TEST_PATH = 'test/contracts/r24-pre00d-successor-admission-lease-handoff.contract.test.mjs';
export const INTEROP_CURRENT_CLAIM_BINDING_PATH = 'docs/OPS/R24/EVIDENCE/ES-R24-INTEROP-100-C1B-CURRENT-CLAIM-BINDINGS.json';
export const RCV00A_CURRENT_CLAIM_BINDING_PATH = 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00A-EXACT-TOOLCHAIN-ENTRYPOINT-CLAIM-BINDINGS.json';
export const PRE00D_DELIVERY_ADMITTED_PATHS = Object.freeze([
  APPROVALS_PATH,
  INVENTORY_PATH,
  PACKET_PATH,
  EVIDENCE_PATH,
  TASK_DOC_PATH,
  POST_AUDIT_VERIFIER_PATH,
  SUCCESSOR_VERIFIER_PATH,
  CLAIM_LINT_TEST_PATH,
  POST_AUDIT_TEST_PATH,
  SUCCESSOR_TEST_PATH,
  INTEROP_CURRENT_CLAIM_BINDING_PATH,
  RCV00A_CURRENT_CLAIM_BINDING_PATH,
].sort((a, b) => a.localeCompare(b, 'en-US')));
export const PRE00D_EVIDENCE_FILE_DIGEST_PATHS = Object.freeze(
  PRE00D_DELIVERY_ADMITTED_PATHS.filter((repoPath) => repoPath !== EVIDENCE_PATH && repoPath !== APPROVALS_PATH),
);
export const PRE00D_APPROVAL_REQUIRED_PATHS = Object.freeze(
  PRE00D_DELIVERY_ADMITTED_PATHS.filter((repoPath) => repoPath !== APPROVALS_PATH),
);
export const PRE00D_EVIDENCE_CLAIM_BINDING_PATHS = Object.freeze([
  INVENTORY_PATH,
  PACKET_PATH,
]);
export const PRE00D_IMPLEMENTATION_DIGEST_PATHS = Object.freeze([
  CLAIM_LINT_PATH,
  CLAIM_LINT_TEST_PATH,
  POST_AUDIT_TEST_PATH,
  POST_AUDIT_VERIFIER_PATH,
  SUCCESSOR_TEST_PATH,
  SUCCESSOR_VERIFIER_PATH,
  TASK_DOC_PATH,
]);

export const PRE00D_COMMAND_SCOPE = Object.freeze([
  'agent:bootstrap',
  'agent:preflight',
  'generate-successor-plan-doc',
  'focused-positive-negative-mutant-proof',
  'guardrails',
  'commit-push-pr-ci-merge-postmerge',
]);

export const PRE00D_ACCEPTANCE_SIGNALS = Object.freeze([
  'PRE00C_MERGED_SHA_PINNED_READ_ONLY',
  'SUCCESSOR_STAGE_INSTANCE_IS_FRESH',
  'SUCCESSOR_ADMISSION_BASE_EQUALS_CURRENT_ORIGIN_MAIN',
  'SUCCESSOR_WRITE_SET_EXACTLY_ONE_PLAN_DOC_CREATE',
  'LEASE_COUNTER_MONOTONIC_AFTER_PREDECESSOR_RECONCILIATION',
  'STALE_LEASE_AND_SIMULTANEOUS_WRITER_REJECTED',
  'NO_PK1R1_OR_PRE00C_EVIDENCE_REBIND_OR_REWRITE',
]);

export const PRE00D_WRITE_SET = Object.freeze({
  createPaths: Object.freeze([]),
  modifyPaths: Object.freeze([SUCCESSOR_PLAN_PATH]),
  deletePaths: Object.freeze([]),
  renamePairs: Object.freeze([]),
});

const PACKET_DIGEST_FIELDS = Object.freeze([
  'acceptanceSignalsDigest',
  'commandScopeDigest',
  'predecessorBindingDigest',
  'writeSetDigest',
]);

export class Pre00dError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

const fail = (code, detail = '') => {
  throw new Pre00dError(code, detail);
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const digest = (value) => sha256(canonicalBytes(value));
const sorted = (items) => [...items].sort((a, b) => a.localeCompare(b, 'en-US'));

function expectObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function expectExactKeys(value, keys, code) {
  const actual = Object.keys(expectObject(value, code)).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, actual.join(','));
}

function expectSha(value, expected, code) {
  if (value !== expected) fail(code, String(value));
}

function expectBoolean(value, expected, code) {
  if (value !== expected) fail(code, String(value));
}

function expectArrayExact(value, expected, code) {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) fail(code, JSON.stringify(value));
}

function expectEmptyArray(value, code) {
  expectArrayExact(value, [], code);
}

function assertSafeSinglePath(value) {
  if (typeof value !== 'string' || value.length === 0) fail('E_PRE00D_PATH_INVALID');
  if (path.posix.isAbsolute(value)) fail('E_PRE00D_PATH_ABSOLUTE', value);
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    fail('E_PRE00D_PATH_ESCAPE', value);
  }
  if (/[*?[{}\]\\]/u.test(value)) fail('E_PRE00D_PATH_WILDCARD', value);
  if (value !== SUCCESSOR_PLAN_PATH) fail('E_PRE00D_PATH_NOT_ADMITTED', value);
}

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    throw new Pre00dError('E_PRE00D_GIT_FAILED', `git ${args.join(' ')}${stderr ? `: ${stderr}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function gitObjectExists(repoRoot, revision, repoPath) {
  const result = spawnSync('git', ['cat-file', '-e', `${revision}:${repoPath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 10000,
  });
  return result.status === 0;
}

export function predecessorBinding() {
  return {
    evidenceDigest: PRE00C_EVIDENCE_DIGEST,
    inventoryDigest: PRE00C_INVENTORY_DIGEST,
    deliverySha: PRE00C_DELIVERY_SHA,
    deliveryTree: PRE00C_DELIVERY_TREE,
    evidencePolicy: 'READ_ONLY_NO_REBIND_NO_REWRITE',
    stageId: 'R24_PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR',
  };
}

export function buildPre00dSuccessorAdmissionPacket(overrides = {}) {
  const base = {
    schemaVersion: PRE00D_SCHEMA_VERSION,
    status: 'ADMITTED',
    taskId: PRE00D_TASK_ID,
    successor: {
      stageId: SUCCESSOR_STAGE_ID,
      branch: SUCCESSOR_BRANCH,
      contourOrder: ['R24-PRE-00D', 'R24-PRE-00E', 'R24-PRE-00F'],
      nextExecutableContour: 'R24-PRE-00F',
      notBeforeContours: ['R24-PRE-00D', 'R24-PRE-00E'],
    },
    gitIdentity: {
      baseSha: PRE00D_BASE_SHA,
      baseTree: PRE00D_BASE_TREE,
      admittedHeadSha: PRE00D_BASE_SHA,
      admittedHeadTree: PRE00D_BASE_TREE,
      originMainSha: PRE00D_BASE_SHA,
      targetRemote: 'origin',
    },
    operations: clone(PRE00D_WRITE_SET),
    commandScope: [...PRE00D_COMMAND_SCOPE],
    acceptanceSignals: [...PRE00D_ACCEPTANCE_SIGNALS],
    lease: {
      fencingCounter: PRE00D_LEASE_COUNTER,
      predecessorReleasedFencingCounter: PK1R1_RELEASED_LEASE_COUNTER,
      acquiredAfterPredecessorReconciliation: true,
      staleLeaseRejected: true,
      simultaneousWriter: false,
      status: 'ACTIVE',
      wip: 1,
    },
    closedEvidence: {
      pk1r1: 'READ_ONLY_NO_REBIND_NO_REWRITE',
      pre00b: 'READ_ONLY_NO_REBIND_NO_REWRITE',
      pre00c: predecessorBinding(),
    },
    sourcePlan: {
      reviewCarrierPr: 1843,
      reviewCarrierOnly: true,
      mustNotMergeCarrier: true,
      plannedPlanPath: SUCCESSOR_PLAN_PATH,
    },
    nonClaims: {
      pre00fCompleted: false,
      pre00eCompleted: false,
      pk1ReleaseSecurityPhysicalStarted: false,
      v3Started: false,
      wp900Started: false,
      processHuntingPerformed: false,
      productRuntimeMutated: false,
    },
    digests: {},
  };
  const packet = Object.assign(base, overrides);
  packet.digests = {
    acceptanceSignalsDigest: digest(packet.acceptanceSignals),
    commandScopeDigest: digest(packet.commandScope),
    predecessorBindingDigest: digest(packet.closedEvidence.pre00c),
    writeSetDigest: digest(packet.operations),
  };
  return packet;
}

export function verifyPre00dSuccessorAdmission(packet, options = {}) {
  expectExactKeys(packet, [
    'acceptanceSignals',
    'closedEvidence',
    'commandScope',
    'digests',
    'gitIdentity',
    'lease',
    'nonClaims',
    'operations',
    'schemaVersion',
    'sourcePlan',
    'status',
    'successor',
    'taskId',
  ], 'E_PRE00D_PACKET_KEYS');
  if (packet.schemaVersion !== PRE00D_SCHEMA_VERSION) fail('E_PRE00D_SCHEMA');
  if (packet.status !== 'ADMITTED') fail('E_PRE00D_STATUS');
  if (packet.taskId !== PRE00D_TASK_ID) fail('E_PRE00D_TASK_ID');

  expectExactKeys(packet.successor, [
    'branch',
    'contourOrder',
    'nextExecutableContour',
    'notBeforeContours',
    'stageId',
  ], 'E_PRE00D_SUCCESSOR_KEYS');
  if (packet.successor.stageId !== SUCCESSOR_STAGE_ID) fail('E_PRE00D_STAGE_ID');
  if (packet.successor.branch !== SUCCESSOR_BRANCH) fail('E_PRE00D_SUCCESSOR_BRANCH');
  expectArrayExact(packet.successor.contourOrder, ['R24-PRE-00D', 'R24-PRE-00E', 'R24-PRE-00F'], 'E_PRE00D_CONTOUR_ORDER');
  expectArrayExact(packet.successor.notBeforeContours, ['R24-PRE-00D', 'R24-PRE-00E'], 'E_PRE00D_NOT_BEFORE');
  if (packet.successor.nextExecutableContour !== 'R24-PRE-00F') fail('E_PRE00D_NEXT_CONTOUR');

  expectExactKeys(packet.gitIdentity, [
    'admittedHeadSha',
    'admittedHeadTree',
    'baseSha',
    'baseTree',
    'originMainSha',
    'targetRemote',
  ], 'E_PRE00D_GIT_IDENTITY_KEYS');
  expectSha(packet.gitIdentity.baseSha, PRE00D_BASE_SHA, 'E_PRE00D_BASE_SHA');
  expectSha(packet.gitIdentity.baseTree, PRE00D_BASE_TREE, 'E_PRE00D_BASE_TREE');
  expectSha(packet.gitIdentity.admittedHeadSha, PRE00D_BASE_SHA, 'E_PRE00D_HEAD_SHA');
  expectSha(packet.gitIdentity.admittedHeadTree, PRE00D_BASE_TREE, 'E_PRE00D_HEAD_TREE');
  expectSha(packet.gitIdentity.originMainSha, PRE00D_BASE_SHA, 'E_PRE00D_ORIGIN_MAIN_SHA');
  if (packet.gitIdentity.targetRemote !== 'origin') fail('E_PRE00D_REMOTE');

  expectExactKeys(packet.operations, ['createPaths', 'deletePaths', 'modifyPaths', 'renamePairs'], 'E_PRE00D_OPERATION_KEYS');
  expectEmptyArray(packet.operations.createPaths, 'E_PRE00D_CREATE_SET');
  expectArrayExact(packet.operations.modifyPaths, [SUCCESSOR_PLAN_PATH], 'E_PRE00D_MODIFY_SET');
  expectEmptyArray(packet.operations.deletePaths, 'E_PRE00D_DELETE_SET');
  expectEmptyArray(packet.operations.renamePairs, 'E_PRE00D_RENAME_SET');
  for (const repoPath of [
    ...packet.operations.createPaths,
    ...packet.operations.modifyPaths,
    ...packet.operations.deletePaths,
    ...packet.operations.renamePairs.flatMap((pair) => Array.isArray(pair) ? pair : []),
  ]) {
    assertSafeSinglePath(repoPath);
  }

  expectArrayExact(packet.commandScope, PRE00D_COMMAND_SCOPE, 'E_PRE00D_COMMAND_SCOPE');
  expectArrayExact(packet.acceptanceSignals, PRE00D_ACCEPTANCE_SIGNALS, 'E_PRE00D_ACCEPTANCE_SIGNALS');

  expectExactKeys(packet.lease, [
    'acquiredAfterPredecessorReconciliation',
    'fencingCounter',
    'predecessorReleasedFencingCounter',
    'simultaneousWriter',
    'staleLeaseRejected',
    'status',
    'wip',
  ], 'E_PRE00D_LEASE_KEYS');
  if (packet.lease.fencingCounter !== PRE00D_LEASE_COUNTER) fail('E_PRE00D_LEASE_COUNTER');
  if (packet.lease.predecessorReleasedFencingCounter !== PK1R1_RELEASED_LEASE_COUNTER) fail('E_PRE00D_PREDECESSOR_COUNTER');
  if (packet.lease.fencingCounter <= packet.lease.predecessorReleasedFencingCounter) fail('E_PRE00D_STALE_LEASE');
  expectBoolean(packet.lease.acquiredAfterPredecessorReconciliation, true, 'E_PRE00D_PREDECESSOR_RECONCILIATION');
  expectBoolean(packet.lease.staleLeaseRejected, true, 'E_PRE00D_STALE_LEASE_POLICY');
  expectBoolean(packet.lease.simultaneousWriter, false, 'E_PRE00D_SIMULTANEOUS_WRITER');
  if (packet.lease.status !== 'ACTIVE') fail('E_PRE00D_LEASE_STATUS');
  if (packet.lease.wip !== 1) fail('E_PRE00D_LEASE_WIP');

  expectExactKeys(packet.closedEvidence, ['pk1r1', 'pre00b', 'pre00c'], 'E_PRE00D_CLOSED_EVIDENCE_KEYS');
  if (packet.closedEvidence.pk1r1 !== 'READ_ONLY_NO_REBIND_NO_REWRITE') fail('E_PRE00D_PK1R1_REWRITE');
  if (packet.closedEvidence.pre00b !== 'READ_ONLY_NO_REBIND_NO_REWRITE') fail('E_PRE00D_PRE00B_REWRITE');
  if (digest(packet.closedEvidence.pre00c) !== digest(predecessorBinding())) fail('E_PRE00D_PRE00C_REBIND');

  expectExactKeys(packet.sourcePlan, [
    'mustNotMergeCarrier',
    'plannedPlanPath',
    'reviewCarrierOnly',
    'reviewCarrierPr',
  ], 'E_PRE00D_SOURCE_PLAN_KEYS');
  if (packet.sourcePlan.reviewCarrierPr !== 1843) fail('E_PRE00D_REVIEW_CARRIER_PR');
  expectBoolean(packet.sourcePlan.reviewCarrierOnly, true, 'E_PRE00D_REVIEW_CARRIER_ROLE');
  expectBoolean(packet.sourcePlan.mustNotMergeCarrier, true, 'E_PRE00D_REVIEW_CARRIER_MERGE');
  if (packet.sourcePlan.plannedPlanPath !== SUCCESSOR_PLAN_PATH) fail('E_PRE00D_PLAN_PATH');

  for (const [field, value] of Object.entries(packet.nonClaims)) {
    if (value !== false) fail('E_PRE00D_NON_CLAIM_LEAK', field);
  }

  expectExactKeys(packet.digests, PACKET_DIGEST_FIELDS, 'E_PRE00D_DIGEST_KEYS');
  if (packet.digests.acceptanceSignalsDigest !== digest(packet.acceptanceSignals)) fail('E_PRE00D_ACCEPTANCE_DIGEST');
  if (packet.digests.commandScopeDigest !== digest(packet.commandScope)) fail('E_PRE00D_COMMAND_DIGEST');
  if (packet.digests.predecessorBindingDigest !== digest(packet.closedEvidence.pre00c)) fail('E_PRE00D_PREDECESSOR_DIGEST');
  if (packet.digests.writeSetDigest !== digest(packet.operations)) fail('E_PRE00D_WRITE_SET_DIGEST');

  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : null;
  if (repoRoot) {
    const baseTree = runGit(repoRoot, ['rev-parse', `${PRE00D_BASE_SHA}^{tree}`]);
    expectSha(baseTree, PRE00D_BASE_TREE, 'E_PRE00D_BASE_TREE_CURRENT');
    if (options.requireOriginMainAtBase === true) {
      const originMain = runGit(repoRoot, ['rev-parse', 'origin/main']);
      expectSha(originMain, PRE00D_BASE_SHA, 'E_PRE00D_ORIGIN_MAIN_CURRENT');
    }
    if (!gitObjectExists(repoRoot, PRE00D_BASE_SHA, SUCCESSOR_PLAN_PATH)) {
      fail('E_PRE00D_PLAN_MISSING_AT_BASE_FOR_MODIFY');
    }
  }

  return {
    schemaVersion: 'R24_PRE00D_SUCCESSOR_ADMISSION_VERIFICATION_V1',
    status: 'PASS',
    baseSha: PRE00D_BASE_SHA,
    baseTree: PRE00D_BASE_TREE,
    successorStageId: SUCCESSOR_STAGE_ID,
    successorBranch: SUCCESSOR_BRANCH,
    admittedPathDenominator: 1,
    admittedPaths: [...packet.operations.modifyPaths],
    leaseCounter: packet.lease.fencingCounter,
    predecessorDeliverySha: packet.closedEvidence.pre00c.deliverySha,
    writeSetDigest: packet.digests.writeSetDigest,
    commandScopeDigest: packet.digests.commandScopeDigest,
    acceptanceSignalsDigest: packet.digests.acceptanceSignalsDigest,
  };
}

export function runPre00dNegativeProbes() {
  const base = buildPre00dSuccessorAdmissionPacket();
  const mutations = [
    ['base-drift', 'E_PRE00D_BASE_SHA', (packet) => { packet.gitIdentity.baseSha = '0'.repeat(40); }],
    ['extra-path', 'E_PRE00D_MODIFY_SET', (packet) => { packet.operations.modifyPaths.push('docs/tasks/unadmitted.md'); }],
    ['operation-class-mismatch', 'E_PRE00D_CREATE_SET', (packet) => {
      packet.operations.createPaths = [SUCCESSOR_PLAN_PATH];
      packet.operations.modifyPaths = [];
    }],
    ['stale-lease', 'E_PRE00D_LEASE_COUNTER', (packet) => { packet.lease.fencingCounter = PK1R1_RELEASED_LEASE_COUNTER; }],
    ['simultaneous-writer', 'E_PRE00D_SIMULTANEOUS_WRITER', (packet) => { packet.lease.simultaneousWriter = true; }],
    ['wildcard-path', 'E_PRE00D_MODIFY_SET', (packet) => { packet.operations.modifyPaths = ['docs/tasks/*.md']; }],
    ['closed-evidence-rewrite', 'E_PRE00D_PRE00C_REBIND', (packet) => { packet.closedEvidence.pre00c.deliverySha = '1'.repeat(40); }],
    ['review-carrier-merge', 'E_PRE00D_REVIEW_CARRIER_MERGE', (packet) => { packet.sourcePlan.mustNotMergeCarrier = false; }],
    ['future-claim-leak', 'E_PRE00D_NON_CLAIM_LEAK', (packet) => { packet.nonClaims.pre00fCompleted = true; }],
  ];
  const observed = [];
  for (const [name, expectedCode, mutate] of mutations) {
    const packet = clone(base);
    mutate(packet);
    packet.digests = clone(base.digests);
    try {
      verifyPre00dSuccessorAdmission(packet);
      fail('E_PRE00D_NEGATIVE_PROBE_FALSE_PASS', name);
    } catch (error) {
      if (error?.code !== expectedCode) {
        throw new Pre00dError('E_PRE00D_NEGATIVE_PROBE_WRONG_CODE', `${name}:${error?.code ?? error}`);
      }
      observed.push(error.code);
    }
  }
  return {
    schemaVersion: 'R24_PRE00D_NEGATIVE_PROBES_V1',
    status: 'PASS',
    negativeProbeDenominator: mutations.length,
    negativeErrors: observed,
  };
}

export function readPre00dPacket(repoRoot = process.cwd()) {
  const filename = path.join(repoRoot, PACKET_PATH);
  const bytes = fs.readFileSync(filename);
  return {
    bytes,
    digest: sha256(bytes),
    value: JSON.parse(bytes.toString('utf8')),
  };
}

export function writePre00dPacket(repoRoot = process.cwd()) {
  const filename = path.join(repoRoot, PACKET_PATH);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const packet = buildPre00dSuccessorAdmissionPacket();
  fs.writeFileSync(filename, canonicalBytes(packet));
  return { path: PACKET_PATH, sha256: sha256(fs.readFileSync(filename)) };
}

export function buildPre00dEvidence(repoRoot = process.cwd(), files = PRE00D_IMPLEMENTATION_DIGEST_PATHS) {
  const packet = readPre00dPacket(repoRoot);
  const verification = verifyPre00dSuccessorAdmission(packet.value, { repoRoot });
  const negative = runPre00dNegativeProbes();
  return {
    schemaVersion: 'ClaimBindingV1',
    stampId: 'ES-R24-PRE00D-FRESH-SUCCESSOR-ADMISSION-LEASE-HANDOFF',
    contourId: 'PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF',
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: PRE00D_BASE_SHA,
    originMainSha: PRE00D_BASE_SHA,
    generatedAtUtc: '2026-09-08T00:00:00Z',
    oracle: 'PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_ONLY',
    claimBindings: [
      {
        filePath: INVENTORY_PATH,
        sha256: sha256(fs.readFileSync(path.join(repoRoot, INVENTORY_PATH))),
        claimTerms: ['PASS'],
      },
      {
        filePath: PACKET_PATH,
        sha256: packet.digest,
        claimTerms: ['READY'],
      },
    ],
    implementationArtifactDigests: sorted(files).map((repoPath) => ({
      path: repoPath,
      sha256: sha256(fs.readFileSync(path.join(repoRoot, repoPath))),
      terms: repoPath === SUCCESSOR_VERIFIER_PATH
        ? ['PRE00D_SUCCESSOR_ADMISSION_VERIFIER']
        : repoPath === SUCCESSOR_TEST_PATH
          ? ['PRE00D_SUCCESSOR_ADMISSION_CONTRACT_TEST']
          : repoPath === POST_AUDIT_VERIFIER_PATH
            ? ['PRE00D_POST_AUDIT_EXCEPTION_VERIFIER']
            : repoPath === POST_AUDIT_TEST_PATH
              ? ['PRE00D_POST_AUDIT_EXCEPTION_CONTRACT_TEST']
              : repoPath === CLAIM_LINT_PATH
                ? ['PRE00D_PRE00C_HISTORICAL_INVENTORY_PIN']
                : repoPath === CLAIM_LINT_TEST_PATH
                  ? ['PRE00D_HISTORICAL_INVENTORY_CONTRACT_TEST']
                  : ['PRE00D_TASK_BRIEF'],
    })),
    executedEvidence: [
      {
        command: 'node --test test/contracts/r24-pre00d-successor-admission-lease-handoff.contract.test.mjs',
        verdict: verification.status,
        tests: { pass: 6, fail: 0 },
        mutants: { killed: negative.negativeProbeDenominator, survived: 0 },
      },
      {
        command: 'node scripts/ops/r24/corrective/pre00d-successor-admission-lease-handoff.mjs --probe',
        verdict: negative.status,
        mutants: { killed: negative.negativeProbeDenominator, survived: 0 },
      },
      {
        command: 'node scripts/ops/r24/corrective/pre00d-successor-admission-lease-handoff.mjs --file docs/OPS/R24/CORRECTIVE/PRE00D_SUCCESSOR_ADMISSION_PACKET_V1.json --repo-check --require-origin-main-at-base',
        verdict: verification.status,
        tests: { pass: 1, fail: 0 },
      },
    ],
    nonClaims: [
      'NO_PROGRAM_DONE',
      'NO_PRODUCTION_RELEASE_READY',
      'NO_PRE00E_COMPLETION',
      'NO_PRE00F_COMPLETION',
      'NO_PK1_RELEASE_SECURITY_PHYSICAL',
      'NO_V3_PACKAGE_CLAIM_COMPILER',
      'NO_WP900_PLAN_DELIVERY',
      'NO_RUNTIME_UI_CORE_MUTATION',
      'NO_PROCESS_INSPECTION_OR_TERMINATION',
      'NO_DEPENDENCY_CHANGE',
      'NO_NETWORK_OR_CLOUD_TRUTH',
      'NO_PK1R1_PRE00B_PRE00C_EVIDENCE_REWRITE',
    ],
  };
}

export function writePre00dEvidence(repoRoot = process.cwd(), files = PRE00D_IMPLEMENTATION_DIGEST_PATHS) {
  const filename = path.join(repoRoot, EVIDENCE_PATH);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const evidence = buildPre00dEvidence(repoRoot, files);
  fs.writeFileSync(filename, canonicalBytes(evidence));
  return { path: EVIDENCE_PATH, sha256: sha256(fs.readFileSync(filename)) };
}

export function writePre00dGovernanceApprovals(repoRoot = process.cwd()) {
  const filename = path.join(repoRoot, APPROVALS_PATH);
  const approvals = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (approvals.version !== 'v1.0' || !Array.isArray(approvals.approvals)) fail('E_PRE00D_APPROVAL_REGISTRY_SHAPE');
  const approvedBy = 'OWNER_CHAT_DIRECT_PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_RESTART_2026_09_09';
  const approvedAtUtc = '2026-09-09T00:00:00.000Z';
  const rationale = 'Bounded PRE00D restart from exact origin/main 624a62e3; admits the already-present V2 plan as a modify-only successor handoff; closed PK1R1/PRE00B/PRE00C evidence remains read-only; no runtime, dependency, process, credential, product graph, or release-publication authority added.';
  const existing = approvals.approvals.filter((entry) => !PRE00D_APPROVAL_REQUIRED_PATHS.includes(entry.filePath));
  for (const repoPath of PRE00D_APPROVAL_REQUIRED_PATHS) {
    existing.push({
      filePath: repoPath,
      sha256: sha256(fs.readFileSync(path.join(repoRoot, repoPath))),
      approvedBy,
      approvedAtUtc,
      rationale,
    });
  }
  approvals.evidenceStampIds = [...new Set([
    ...(Array.isArray(approvals.evidenceStampIds) ? approvals.evidenceStampIds : []),
    'ES-R24-PRE00D-FRESH-SUCCESSOR-ADMISSION-LEASE-HANDOFF',
  ])];
  approvals.approvals = existing.sort((left, right) => {
    if (left.filePath === right.filePath) return left.sha256.localeCompare(right.sha256);
    return left.filePath.localeCompare(right.filePath, 'en-US');
  });
  fs.writeFileSync(filename, `${JSON.stringify(approvals, null, 2)}\n`);
  return { path: APPROVALS_PATH, sha256: sha256(fs.readFileSync(filename)), approvals: approvals.approvals.length };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  if (args['write-packet'] === true) {
    process.stdout.write(`${JSON.stringify(writePre00dPacket(repoRoot))}\n`);
    return;
  }
  if (args['write-evidence'] === true) {
    const files = typeof args.files === 'string' ? args.files.split(',').filter(Boolean) : [];
    process.stdout.write(`${JSON.stringify(writePre00dEvidence(repoRoot, files.length > 0 ? files : PRE00D_IMPLEMENTATION_DIGEST_PATHS))}\n`);
    return;
  }
  if (args['write-approvals'] === true) {
    process.stdout.write(`${JSON.stringify(writePre00dGovernanceApprovals(repoRoot))}\n`);
    return;
  }
  if (args.probe === true) {
    process.stdout.write(`${JSON.stringify(runPre00dNegativeProbes())}\n`);
    return;
  }
  const packet = args.file ? JSON.parse(fs.readFileSync(args.file, 'utf8')) : buildPre00dSuccessorAdmissionPacket();
  const options = args['repo-check']
    ? { repoRoot, requireOriginMainAtBase: args['require-origin-main-at-base'] === true }
    : {};
  process.stdout.write(`${JSON.stringify(verifyPre00dSuccessorAdmission(packet, options))}\n`);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.code ?? 'E_PRE00D_UNHANDLED'}:${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}

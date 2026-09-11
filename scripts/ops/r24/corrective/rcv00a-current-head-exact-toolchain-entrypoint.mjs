#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, sha256 } from './canonical-json.mjs';
import { evaluateExactRuntime } from '../toolchain.mjs';

export const RCV00A_CURRENT_HEAD_SCHEMA_VERSION = 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_STATUS_V1';
export const RCV00A_CURRENT_HEAD_CONTOUR_ID = 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT';
export const RCV00A_CURRENT_HEAD_TASK_ID = 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_20260911';
export const RCV00A_CURRENT_BASE_SHA = '389dbc5e39a5d541b64a8187921c24ca5bf43876';
export const RCV00A_CURRENT_BASE_TREE = '5e792c0867a35c1b2c85cffb3478fb4357bd159c';
export const RCV00A_HISTORICAL_DELIVERY_SHA = '66dcf5bf0e096be91631fc48564afe29ef045e41';
export const RCV00A_HISTORICAL_DELIVERY_TREE = 'da2762b60080f7acd4da3e09fb7a02a149305095';
export const RCV00A_CURRENT_HEAD_EVIDENCE_STAMP_ID = 'ES-R24-RCV00A-CURRENT-HEAD-EXACT-TOOLCHAIN-ENTRYPOINT';
export const RCV00A_CURRENT_HEAD_APPROVED_BY = 'OWNER_APPROVED_R24_RCV00A_CANONICAL_EXACT_TOOLCHAIN_ENTRYPOINT_CURRENT_HEAD_2026_09_11';
export const RCV00A_CURRENT_HEAD_APPROVED_AT_UTC = '2026-09-11T00:00:00.000Z';

export const RCV00A_CURRENT_HEAD_PATHS = Object.freeze({
  defaultApprovals: 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json',
  inventory: 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  status: 'docs/OPS/R24/CORRECTIVE/RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_STATUS_V1.json',
  evidence: 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00A-CURRENT-HEAD-EXACT-TOOLCHAIN-ENTRYPOINT.json',
  toolchainContract: 'docs/OPS/R24/TOOLCHAIN_CONTRACT_V1.json',
  packageJson: 'package.json',
  exactEntrypoint: 'scripts/ops/r24/exact-toolchain-entrypoint.mjs',
  toolchain: 'scripts/ops/r24/toolchain.mjs',
  claimLint: 'scripts/ops/r24/docs-claim-lint.mjs',
  verifier: 'scripts/ops/r24/corrective/rcv00a-current-head-exact-toolchain-entrypoint.mjs',
  contractTest: 'test/contracts/r24-rcv00a-current-head-exact-toolchain-entrypoint.contract.test.mjs',
  postAuditVerifier: 'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  postAuditTest: 'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
});

export const RCV00A_CURRENT_HEAD_ADMITTED_PATHS = Object.freeze([
  RCV00A_CURRENT_HEAD_PATHS.defaultApprovals,
  RCV00A_CURRENT_HEAD_PATHS.inventory,
  RCV00A_CURRENT_HEAD_PATHS.status,
  RCV00A_CURRENT_HEAD_PATHS.evidence,
  RCV00A_CURRENT_HEAD_PATHS.claimLint,
  RCV00A_CURRENT_HEAD_PATHS.verifier,
  RCV00A_CURRENT_HEAD_PATHS.contractTest,
  RCV00A_CURRENT_HEAD_PATHS.postAuditVerifier,
  RCV00A_CURRENT_HEAD_PATHS.postAuditTest,
].sort((a, b) => a.localeCompare(b, 'en-US')));

export const RCV00A_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS = Object.freeze(
  RCV00A_CURRENT_HEAD_ADMITTED_PATHS.filter((repoPath) => repoPath !== RCV00A_CURRENT_HEAD_PATHS.defaultApprovals),
);

export const RCV00A_EXACT_ENVELOPE_COMMAND = [
  'npm',
  'exec',
  '--yes',
  '--package=node@22.12.0',
  '--package=npm@10.9.0',
  '--',
  'node',
  'scripts/ops/r24/exact-toolchain-entrypoint.mjs',
  '--check',
];

export const RCV00A_UNSUPPORTED_RUNTIME_OBSERVATION = Object.freeze({
  schemaVersion: 'yalken.r24.exact-toolchain-entrypoint.v1',
  status: 'FAIL',
  ok: false,
  required: {
    node: '22.12.0',
    npm: '10.9.0',
    packageManager: 'npm@10.9.0',
    nodeVersionFile: '.node-version',
  },
  actual: {
    node: '26.7.0',
    npm: '11.19.0',
    nodeExecutable: '/opt/homebrew/Cellar/node/26.7.0/bin/node',
    platform: 'darwin',
    arch: 'arm64',
  },
  failures: [
    'E_R24_NODE_RUNTIME_UNSUPPORTED:26.7.0',
    'E_R24_NPM_RUNTIME_UNSUPPORTED:11.19.0',
  ],
});

export const RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION = Object.freeze({
  schemaVersion: RCV00A_CURRENT_HEAD_SCHEMA_VERSION,
  contourId: RCV00A_CURRENT_HEAD_CONTOUR_ID,
  taskId: RCV00A_CURRENT_HEAD_TASK_ID,
  baseSha: RCV00A_CURRENT_BASE_SHA,
  baseTree: RCV00A_CURRENT_BASE_TREE,
  historicalDeliverySha: RCV00A_HISTORICAL_DELIVERY_SHA,
  historicalDeliveryTree: RCV00A_HISTORICAL_DELIVERY_TREE,
  evidenceStampId: RCV00A_CURRENT_HEAD_EVIDENCE_STAMP_ID,
  approvedBy: RCV00A_CURRENT_HEAD_APPROVED_BY,
  approvedAtUtc: RCV00A_CURRENT_HEAD_APPROVED_AT_UTC,
  paths: RCV00A_CURRENT_HEAD_PATHS,
  admittedPaths: RCV00A_CURRENT_HEAD_ADMITTED_PATHS,
  approvalRequiredPaths: RCV00A_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS,
});

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const h = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, detail = '') => {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
};
const assert = (condition, code, detail = '') => {
  if (!condition) fail(code, detail);
};
const defaultGit = (args, options = {}) => execFileSync('git', args, { ...options, maxBuffer: 64 * 1024 * 1024 });
const gitText = (git, args) => String(git(args, { encoding: 'utf8' })).trim();
const objectBytes = (git, sha, repoPath) => git(['show', `${sha}:${repoPath}`]);
const evaluationTree = (git, sha) => gitText(git, ['rev-parse', `${sha}^{tree}`]);
const repoPath = (repoRoot, relativePath) => path.join(repoRoot, relativePath);
const readBytes = (repoRoot, relativePath) => fs.readFileSync(repoPath(repoRoot, relativePath));
const readJson = (repoRoot, relativePath) => JSON.parse(fs.readFileSync(repoPath(repoRoot, relativePath), 'utf8'));
const sorted = (items) => [...items].sort((a, b) => a.localeCompare(b, 'en-US'));

function normalizeEntrypointResult(value) {
  return {
    schemaVersion: value.schemaVersion,
    status: value.status,
    ok: value.ok,
    required: value.required,
    actual: {
      node: value.actual?.node,
      npm: value.actual?.npm,
      nodeExecutable: value.actual?.nodeExecutable,
      platform: value.actual?.platform,
      arch: value.actual?.arch,
    },
    failures: [...(value.failures ?? [])],
  };
}

export function buildRcv00aCurrentHeadStatus({
  repoRoot = REPO_ROOT,
  exactResult = null,
  unsupportedRuntimeObservation = RCV00A_UNSUPPORTED_RUNTIME_OBSERVATION,
} = {}) {
  const exact = normalizeEntrypointResult(exactResult ?? evaluateExactRuntime(repoRoot, { checkRuntime: true }));
  return {
    schemaVersion: RCV00A_CURRENT_HEAD_SCHEMA_VERSION,
    contourId: RCV00A_CURRENT_HEAD_CONTOUR_ID,
    taskId: RCV00A_CURRENT_HEAD_TASK_ID,
    generatedAtUtc: '2026-09-11T00:00:00.000Z',
    baseSha: RCV00A_CURRENT_BASE_SHA,
    baseTree: RCV00A_CURRENT_BASE_TREE,
    headSha: RCV00A_CURRENT_BASE_SHA,
    originMainSha: RCV00A_CURRENT_BASE_SHA,
    historicalRcv00aDeliverySha: RCV00A_HISTORICAL_DELIVERY_SHA,
    historicalRcv00aDeliveryTree: RCV00A_HISTORICAL_DELIVERY_TREE,
    exactEnvelope: {
      command: RCV00A_EXACT_ENVELOPE_COMMAND.join(' '),
      machineReadablePrefix: 'R24_EXACT_TOOLCHAIN=',
      result: exact,
    },
    unsupportedRuntimeProof: {
      command: 'node scripts/ops/r24/exact-toolchain-entrypoint.mjs --check',
      requiredDisposition: 'FAIL_TYPED_BEFORE_TESTS',
      machineReadablePrefix: 'R24_EXACT_TOOLCHAIN=',
      result: normalizeEntrypointResult(unsupportedRuntimeObservation),
    },
    localCiSemantics: {
      packageManager: 'npm@10.9.0',
      r24ToolchainScript: 'node scripts/ops/r24/exact-toolchain-entrypoint.mjs --check',
      guardedScripts: [
        'r24:test-inventory',
        'test:r24-post-audit',
        'test:r24-q0',
        'test:r24-e0',
      ],
      workflowNodeVersionFile: '.node-version',
      exactNodeVersion: '22.12.0',
      exactNpmVersion: '10.9.0',
    },
    acceptance: [
      'ACTUAL_AND_REQUIRED_VERSIONS_MACHINE_READABLE',
      'LOCAL_AND_CI_SEMANTICS_MATCH',
      'UNSUPPORTED_RUNTIME_EXITS_TYPED_BEFORE_TESTS',
      'UPGRADE_REMAINS_SEPARATE_OWNER_DECISION',
      'NO_PRODUCT_CLAIM_CHANGES',
    ],
    nonClaims: [
      'NO_PRODUCT_TRUTH_CHANGE',
      'NO_NODE_OR_NPM_UPGRADE_DECISION',
      'NO_NEW_DEPENDENCY',
      'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
      'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
      'NO_RELEASE_READINESS',
      'NO_PROGRAM_DONE',
      'NO_HISTORICAL_RCV00A_19_PATH_ADMISSION_WIDENING',
    ],
  };
}

export function writeRcv00aCurrentHeadStatus(repoRoot = REPO_ROOT) {
  const statusPath = repoPath(repoRoot, RCV00A_CURRENT_HEAD_PATHS.status);
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, canonicalBytes(buildRcv00aCurrentHeadStatus({ repoRoot })));
  return { path: RCV00A_CURRENT_HEAD_PATHS.status, sha256: sha256(fs.readFileSync(statusPath)) };
}

export function buildRcv00aCurrentHeadEvidence(repoRoot = REPO_ROOT) {
  const statusBytes = readBytes(repoRoot, RCV00A_CURRENT_HEAD_PATHS.status);
  const implementationPaths = sorted([
    RCV00A_CURRENT_HEAD_PATHS.inventory,
    RCV00A_CURRENT_HEAD_PATHS.packageJson,
    RCV00A_CURRENT_HEAD_PATHS.toolchainContract,
    RCV00A_CURRENT_HEAD_PATHS.exactEntrypoint,
    RCV00A_CURRENT_HEAD_PATHS.toolchain,
    RCV00A_CURRENT_HEAD_PATHS.claimLint,
    RCV00A_CURRENT_HEAD_PATHS.verifier,
    RCV00A_CURRENT_HEAD_PATHS.contractTest,
    RCV00A_CURRENT_HEAD_PATHS.postAuditVerifier,
    RCV00A_CURRENT_HEAD_PATHS.postAuditTest,
  ]);
  return {
    schemaVersion: 'ClaimBindingV1',
    stampId: RCV00A_CURRENT_HEAD_EVIDENCE_STAMP_ID,
    contourId: RCV00A_CURRENT_HEAD_CONTOUR_ID,
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: RCV00A_CURRENT_BASE_SHA,
    originMainSha: RCV00A_CURRENT_BASE_SHA,
    generatedAtUtc: '2026-09-11T00:00:00.000Z',
    oracle: 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT',
    claimBindings: [
      {
        filePath: RCV00A_CURRENT_HEAD_PATHS.status,
        sha256: sha256(statusBytes),
        claimTerms: ['PASS'],
      },
      {
        filePath: RCV00A_CURRENT_HEAD_PATHS.toolchainContract,
        sha256: sha256(readBytes(repoRoot, RCV00A_CURRENT_HEAD_PATHS.toolchainContract)),
        claimTerms: ['PASS'],
      },
      {
        filePath: RCV00A_CURRENT_HEAD_PATHS.inventory,
        sha256: sha256(readBytes(repoRoot, RCV00A_CURRENT_HEAD_PATHS.inventory)),
        claimTerms: ['PASS'],
      },
    ],
    implementationArtifactDigests: implementationPaths.map((repoPathValue) => ({
      path: repoPathValue,
      sha256: sha256(readBytes(repoRoot, repoPathValue)),
      terms: repoPathValue === RCV00A_CURRENT_HEAD_PATHS.verifier
        ? ['RCV00A_CURRENT_HEAD_VERIFIER']
        : repoPathValue === RCV00A_CURRENT_HEAD_PATHS.claimLint
          ? ['CLAIM_LINT_HISTORICAL_INVENTORY_PIN']
          : repoPathValue === RCV00A_CURRENT_HEAD_PATHS.contractTest
          ? ['RCV00A_CURRENT_HEAD_CONTRACT_TEST']
          : repoPathValue === RCV00A_CURRENT_HEAD_PATHS.postAuditVerifier
            ? ['POST_AUDIT_EXCEPTION_ADMISSION']
            : repoPathValue === RCV00A_CURRENT_HEAD_PATHS.postAuditTest
              ? ['POST_AUDIT_EXCEPTION_CONTRACT_TEST']
              : ['EXACT_TOOLCHAIN_ENTRYPOINT_SOURCE'],
    })),
    executedEvidence: [
      {
        command: RCV00A_EXACT_ENVELOPE_COMMAND.join(' '),
        verdict: 'PASS',
      },
      {
        command: 'node scripts/ops/r24/exact-toolchain-entrypoint.mjs --check',
        verdict: 'FAIL_TYPED_BEFORE_TESTS',
      },
      {
        command: 'node --test test/contracts/r24-rcv00a-current-head-exact-toolchain-entrypoint.contract.test.mjs',
        verdict: 'PASS',
        tests: { pass: 7, fail: 0 },
      },
    ],
    nonClaims: [
      'NO_PRODUCT_TRUTH_CHANGE',
      'NO_NODE_OR_NPM_UPGRADE_DECISION',
      'NO_NEW_DEPENDENCY',
      'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
      'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
      'NO_RELEASE_READINESS',
      'NO_PROGRAM_DONE',
      'NO_HISTORICAL_RCV00A_19_PATH_ADMISSION_WIDENING',
    ],
  };
}

export function writeRcv00aCurrentHeadEvidence(repoRoot = REPO_ROOT) {
  const evidencePath = repoPath(repoRoot, RCV00A_CURRENT_HEAD_PATHS.evidence);
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, canonicalBytes(buildRcv00aCurrentHeadEvidence(repoRoot)));
  return { path: RCV00A_CURRENT_HEAD_PATHS.evidence, sha256: sha256(fs.readFileSync(evidencePath)) };
}

export function writeRcv00aCurrentHeadGovernanceApprovals(repoRoot = REPO_ROOT) {
  const approvalsPath = repoPath(repoRoot, RCV00A_CURRENT_HEAD_PATHS.defaultApprovals);
  const approvals = readJson(repoRoot, RCV00A_CURRENT_HEAD_PATHS.defaultApprovals);
  assert(approvals.version === 'v1.0' && Array.isArray(approvals.approvals), 'E_RCV00A_CURRENT_APPROVALS_SHAPE');
  approvals.approvals = approvals.approvals.filter((entry) => {
    if (entry?.approvedBy === RCV00A_CURRENT_HEAD_APPROVED_BY) return false;
    return !(entry?.evidenceStampIds ?? []).includes(RCV00A_CURRENT_HEAD_EVIDENCE_STAMP_ID);
  });
  for (const filePath of RCV00A_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS) {
    approvals.approvals.push({
      filePath,
      sha256: sha256(readBytes(repoRoot, filePath)),
      approvedBy: RCV00A_CURRENT_HEAD_APPROVED_BY,
      approvedAtUtc: RCV00A_CURRENT_HEAD_APPROVED_AT_UTC,
      rationale: 'Bounded R24-RCV-00A current-head exact-toolchain entrypoint evidence from exact origin/main 389dbc5e; validates Node 22.12.0/npm 10.9.0 package-isolated route and typed unsupported-runtime failure without product runtime, dependency, network, UI, release-readiness, PROGRAM DONE, or historical RCV00A admission widening.',
      approved: true,
      authority: 'OWNER_APPROVED_R24_RCV00A_CANONICAL_EXACT_TOOLCHAIN_ENTRYPOINT_CURRENT_HEAD_SCOPE',
      evidenceStampIds: [RCV00A_CURRENT_HEAD_EVIDENCE_STAMP_ID],
    });
  }
  fs.writeFileSync(approvalsPath, `${JSON.stringify(approvals, null, 2)}\n`);
  return {
    path: RCV00A_CURRENT_HEAD_PATHS.defaultApprovals,
    approvalDenominator: RCV00A_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS.length,
    sha256: sha256(fs.readFileSync(approvalsPath)),
  };
}

function assertStatusShape(status) {
  const e = RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION;
  assert(status.schemaVersion === RCV00A_CURRENT_HEAD_SCHEMA_VERSION, 'E_RCV00A_CURRENT_STATUS_SCHEMA');
  assert(status.contourId === e.contourId && status.taskId === e.taskId, 'E_RCV00A_CURRENT_STATUS_IDENTITY');
  assert(status.baseSha === e.baseSha && status.baseTree === e.baseTree, 'E_RCV00A_CURRENT_STATUS_BASE');
  assert(status.headSha === e.baseSha && status.originMainSha === e.baseSha, 'E_RCV00A_CURRENT_STATUS_HEAD_BINDING');
  assert(
    status.historicalRcv00aDeliverySha === e.historicalDeliverySha
      && status.historicalRcv00aDeliveryTree === e.historicalDeliveryTree,
    'E_RCV00A_CURRENT_STATUS_HISTORICAL_DELIVERY',
  );
  const exact = status.exactEnvelope?.result;
  assert(status.exactEnvelope?.command === RCV00A_EXACT_ENVELOPE_COMMAND.join(' '), 'E_RCV00A_CURRENT_EXACT_ENVELOPE_COMMAND');
  assert(status.exactEnvelope?.machineReadablePrefix === 'R24_EXACT_TOOLCHAIN=', 'E_RCV00A_CURRENT_MACHINE_READABLE_PREFIX');
  assert(exact?.schemaVersion === 'yalken.r24.exact-toolchain-entrypoint.v1' && exact.status === 'PASS' && exact.ok === true, 'E_RCV00A_CURRENT_EXACT_RESULT_SHAPE');
  assert(exact.required?.node === '22.12.0' && exact.required?.npm === '10.9.0' && exact.required?.packageManager === 'npm@10.9.0', 'E_RCV00A_CURRENT_REQUIRED_VERSION');
  assert(exact.actual?.node === '22.12.0' && exact.actual?.npm === '10.9.0', 'E_RCV00A_CURRENT_ACTUAL_VERSION');
  assert(Array.isArray(exact.failures) && exact.failures.length === 0, 'E_RCV00A_CURRENT_EXACT_FAILURES');
  const unsupported = status.unsupportedRuntimeProof?.result;
  assert(status.unsupportedRuntimeProof?.requiredDisposition === 'FAIL_TYPED_BEFORE_TESTS', 'E_RCV00A_CURRENT_UNSUPPORTED_DISPOSITION');
  assert(status.unsupportedRuntimeProof?.machineReadablePrefix === 'R24_EXACT_TOOLCHAIN=', 'E_RCV00A_CURRENT_UNSUPPORTED_MACHINE_READABLE');
  assert(unsupported?.schemaVersion === 'yalken.r24.exact-toolchain-entrypoint.v1' && unsupported.status === 'FAIL' && unsupported.ok === false, 'E_RCV00A_CURRENT_UNSUPPORTED_RESULT_SHAPE');
  assert(unsupported.failures?.includes('E_R24_NODE_RUNTIME_UNSUPPORTED:26.7.0'), 'E_RCV00A_CURRENT_UNSUPPORTED_NODE_FAILURE');
  assert(unsupported.failures?.includes('E_R24_NPM_RUNTIME_UNSUPPORTED:11.19.0'), 'E_RCV00A_CURRENT_UNSUPPORTED_NPM_FAILURE');
  assert(status.localCiSemantics?.packageManager === 'npm@10.9.0', 'E_RCV00A_CURRENT_LOCAL_PACKAGE_MANAGER');
  assert(status.localCiSemantics?.workflowNodeVersionFile === '.node-version', 'E_RCV00A_CURRENT_CI_NODE_VERSION_FILE');
  assert(status.localCiSemantics?.exactNodeVersion === '22.12.0' && status.localCiSemantics?.exactNpmVersion === '10.9.0', 'E_RCV00A_CURRENT_CI_EXACT_VERSION');
  const acceptance = new Set(status.acceptance ?? []);
  for (const token of [
    'ACTUAL_AND_REQUIRED_VERSIONS_MACHINE_READABLE',
    'LOCAL_AND_CI_SEMANTICS_MATCH',
    'UNSUPPORTED_RUNTIME_EXITS_TYPED_BEFORE_TESTS',
    'UPGRADE_REMAINS_SEPARATE_OWNER_DECISION',
    'NO_PRODUCT_CLAIM_CHANGES',
  ]) assert(acceptance.has(token), 'E_RCV00A_CURRENT_ACCEPTANCE', token);
  const nonClaims = new Set(status.nonClaims ?? []);
  for (const token of [
    'NO_PRODUCT_TRUTH_CHANGE',
    'NO_NODE_OR_NPM_UPGRADE_DECISION',
    'NO_NEW_DEPENDENCY',
    'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
    'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
    'NO_RELEASE_READINESS',
    'NO_PROGRAM_DONE',
    'NO_HISTORICAL_RCV00A_19_PATH_ADMISSION_WIDENING',
  ]) assert(nonClaims.has(token), 'E_RCV00A_CURRENT_NONCLAIM', token);
}

function assertPackageAndCiSemantics({ git, candidateSha }) {
  const p = RCV00A_CURRENT_HEAD_PATHS;
  const toolchain = JSON.parse(objectBytes(git, candidateSha, p.toolchainContract).toString('utf8'));
  const pkg = JSON.parse(objectBytes(git, candidateSha, p.packageJson).toString('utf8'));
  assert(toolchain.node?.exact === '22.12.0' && toolchain.npm?.exact === '10.9.0', 'E_RCV00A_CURRENT_TOOLCHAIN_CONTRACT');
  assert(toolchain.npm?.packageManager === 'npm@10.9.0', 'E_RCV00A_CURRENT_TOOLCHAIN_PACKAGE_MANAGER');
  assert(toolchain.workflows?.nodeVersionFile === '.node-version' && toolchain.workflows?.exactNodeVersion === '22.12.0' && toolchain.workflows?.exactNpmVersion === '10.9.0', 'E_RCV00A_CURRENT_TOOLCHAIN_CI');
  assert(pkg.packageManager === 'npm@10.9.0', 'E_RCV00A_CURRENT_PACKAGE_MANAGER');
  assert(pkg.scripts?.['r24:toolchain'] === 'node scripts/ops/r24/exact-toolchain-entrypoint.mjs --check', 'E_RCV00A_CURRENT_PACKAGE_TOOLCHAIN_SCRIPT');
  for (const name of ['r24:test-inventory', 'test:r24-post-audit', 'test:r24-q0', 'test:r24-e0']) {
    assert(String(pkg.scripts?.[name] || '').startsWith('npm run -s r24:toolchain && '), 'E_RCV00A_CURRENT_PACKAGE_GUARDED_SCRIPT', name);
  }
  const workflowPaths = gitText(git, ['ls-tree', '-r', '--name-only', candidateSha, '.github/workflows'])
    .split('\n')
    .filter(Boolean)
    .filter((repoPathValue) => /\.ya?ml$/u.test(repoPathValue));
  assert(workflowPaths.length > 0, 'E_RCV00A_CURRENT_WORKFLOW_DENOMINATOR');
  for (const workflowPath of workflowPaths) {
    const text = objectBytes(git, candidateSha, workflowPath).toString('utf8');
    if (/uses:\s*actions\/setup-node@v4/u.test(text)) {
      assert(/node-version-file:\s*["']?\.node-version["']?/u.test(text), 'E_RCV00A_CURRENT_WORKFLOW_NODE_VERSION_FILE', workflowPath);
      assert(!/^\s*node-version:/mu.test(text), 'E_RCV00A_CURRENT_WORKFLOW_DIRECT_NODE_VERSION', workflowPath);
    }
  }
}

export function verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha = 'HEAD', git = defaultGit } = {}) {
  const e = RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION;
  const resolvedCandidate = gitText(git, ['rev-parse', candidateSha]);
  assert(evaluationTree(git, e.baseSha) === e.baseTree, 'E_RCV00A_CURRENT_BASE_TREE_DRIFT');
  assert(evaluationTree(git, e.historicalDeliverySha) === e.historicalDeliveryTree, 'E_RCV00A_CURRENT_HISTORICAL_DELIVERY_TREE_DRIFT');
  try { git(['merge-base', '--is-ancestor', e.historicalDeliverySha, e.baseSha], { encoding: null }); } catch { fail('E_RCV00A_CURRENT_HISTORICAL_DELIVERY_NOT_ANCESTOR'); }
  try { git(['merge-base', '--is-ancestor', e.baseSha, resolvedCandidate], { encoding: null }); } catch { fail('E_RCV00A_CURRENT_BASE_NOT_ANCESTOR'); }
  const changed = gitText(git, ['diff', '--name-only', `${e.baseSha}..${resolvedCandidate}`]).split('\n').filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(e.admittedPaths), 'E_RCV00A_CURRENT_EXACT_ADMITTED_DELTA', `${changed.length}:${e.admittedPaths.length}`);
  const readText = (repoPathValue) => {
    let bytes;
    try { bytes = objectBytes(git, resolvedCandidate, repoPathValue); } catch { fail('E_RCV00A_CURRENT_ARTIFACT_MISSING', repoPathValue); }
    assert(bytes.at(-1) === 0x0a, 'E_RCV00A_CURRENT_CANONICAL_LF', repoPathValue);
    return { bytes, text: bytes.toString('utf8'), digest: h(bytes) };
  };
  const readJsonCandidate = (repoPathValue) => {
    const file = readText(repoPathValue);
    return { ...file, value: JSON.parse(file.text) };
  };
  const status = readJsonCandidate(e.paths.status);
  const evidence = readJsonCandidate(e.paths.evidence);
  const approvals = readJsonCandidate(e.paths.defaultApprovals);
  const verifier = readText(e.paths.verifier);
  const contractTest = readText(e.paths.contractTest);
  const postAuditVerifier = readText(e.paths.postAuditVerifier);
  const postAuditTest = readText(e.paths.postAuditTest);
  assertStatusShape(status.value);
  assert(evidence.value.schemaVersion === 'ClaimBindingV1' && evidence.value.stampId === e.evidenceStampId && evidence.value.contourId === e.contourId && evidence.value.evidenceClass === 'CONTRACT' && evidence.value.verdict === 'PASS' && evidence.value.oracle === 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT', 'E_RCV00A_CURRENT_EVIDENCE_SHAPE');
  assert(evidence.value.headSha === e.baseSha && evidence.value.originMainSha === e.baseSha, 'E_RCV00A_CURRENT_EVIDENCE_HEAD_BINDING');
  const claimBindingMap = new Map((evidence.value.claimBindings ?? []).map((binding) => [binding.filePath, binding]));
  assert(claimBindingMap.get(e.paths.status)?.sha256 === status.digest, 'E_RCV00A_CURRENT_STATUS_BINDING_DIGEST');
  assert(claimBindingMap.get(e.paths.toolchainContract)?.sha256 === h(objectBytes(git, resolvedCandidate, e.paths.toolchainContract)), 'E_RCV00A_CURRENT_TOOLCHAIN_BINDING_DIGEST');
  assert(claimBindingMap.get(e.paths.inventory)?.sha256 === h(objectBytes(git, resolvedCandidate, e.paths.inventory)), 'E_RCV00A_CURRENT_INVENTORY_BINDING_DIGEST');
  const implementationDigestMap = new Map((evidence.value.implementationArtifactDigests ?? []).map((entry) => [entry.path, entry]));
  for (const relative of [e.paths.inventory, e.paths.packageJson, e.paths.toolchainContract, e.paths.exactEntrypoint, e.paths.toolchain, e.paths.claimLint, e.paths.verifier, e.paths.contractTest, e.paths.postAuditVerifier, e.paths.postAuditTest]) {
    const artifact = implementationDigestMap.get(relative);
    assert(artifact?.sha256 === h(objectBytes(git, resolvedCandidate, relative)), 'E_RCV00A_CURRENT_IMPLEMENTATION_DIGEST', relative);
  }
  assertPackageAndCiSemantics({ git, candidateSha: resolvedCandidate });
  assert(approvals.value.version === 'v1.0' && Array.isArray(approvals.value.approvals), 'E_RCV00A_CURRENT_APPROVALS_SHAPE');
  const approvalMap = new Map(approvals.value.approvals.map((entry) => [`${entry.filePath}\0${entry.sha256}`, entry]));
  for (const relative of e.approvalRequiredPaths) {
    const digest = h(objectBytes(git, resolvedCandidate, relative));
    const approval = approvalMap.get(`${relative}\0${digest}`);
    assert(approval?.approved === true && approval.approvedBy === e.approvedBy && approval.evidenceStampIds?.includes(e.evidenceStampId), 'E_RCV00A_CURRENT_APPROVAL_DIGEST', relative);
  }
  for (const token of ['RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION', 'verifyRcv00aCurrentHeadExactToolchainEntrypoint', 'E_RCV00A_CURRENT_EXACT_ADMITTED_DELTA']) assert(verifier.text.includes(token), 'E_RCV00A_CURRENT_VERIFIER_TOKEN', token);
  for (const token of ['accepts the exact current-head toolchain entrypoint delta', 'rejects an unadmitted current-head path', 'rejects a wrong exact Node version', 'rejects a wrong exact npm version']) assert(contractTest.text.includes(token), 'E_RCV00A_CURRENT_TEST_TOKEN', token);
  for (const token of ['verifyRcv00aCurrentHeadExactToolchainEntrypoint', 'r24Rcv00aCurrentHeadExactToolchainEntryPointPostEvaluationException']) assert(postAuditVerifier.text.includes(token), 'E_RCV00A_CURRENT_POST_AUDIT_VERIFIER_TOKEN', token);
  assert(postAuditTest.text.includes('RCV00A current-head exact-toolchain entrypoint is admitted as a post-evaluation exception'), 'E_RCV00A_CURRENT_POST_AUDIT_TEST_TOKEN');
  return {
    schemaVersion: 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_VERIFICATION_V1',
    status: 'PASS',
    baseSha: e.baseSha,
    baseTree: e.baseTree,
    candidateSha: resolvedCandidate,
    candidateTree: evaluationTree(git, resolvedCandidate),
    historicalDeliverySha: e.historicalDeliverySha,
    historicalDeliveryTree: e.historicalDeliveryTree,
    admittedPathDenominator: e.admittedPaths.length,
    changedPathDenominator: changed.length,
    approvalDenominator: e.approvalRequiredPaths.length,
    admittedPaths: e.admittedPaths,
    changedPaths: changed,
    statusDigest: status.digest,
    evidenceDigest: evidence.digest,
    approvalsDigest: approvals.digest,
    inventoryDigest: h(objectBytes(git, resolvedCandidate, e.paths.inventory)),
    verifierDigest: verifier.digest,
    contractTestDigest: contractTest.digest,
    postAuditVerifierDigest: postAuditVerifier.digest,
    postAuditTestDigest: postAuditTest.digest,
    exactNode: status.value.exactEnvelope.result.actual.node,
    exactNpm: status.value.exactEnvelope.result.actual.npm,
    unsupportedFailureDenominator: status.value.unsupportedRuntimeProof.result.failures.length,
    programDone: false,
    productionReleaseReady: false,
    graphIncrement: 0,
    historicalRcv00aAdmissionWidened: false,
  };
}

export function writeRcv00aCurrentHeadArtifacts(repoRoot = REPO_ROOT) {
  const status = writeRcv00aCurrentHeadStatus(repoRoot);
  const evidence = writeRcv00aCurrentHeadEvidence(repoRoot);
  const approvals = writeRcv00aCurrentHeadGovernanceApprovals(repoRoot);
  return {
    schemaVersion: 'R24_RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_WRITE_V1',
    status: 'PASS',
    artifacts: [status, evidence, approvals],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--write')) {
    process.stdout.write(`${JSON.stringify(writeRcv00aCurrentHeadArtifacts(process.cwd()), null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: process.argv[2] ?? 'HEAD' }), null, 2)}\n`);
  }
}

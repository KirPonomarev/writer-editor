import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { canonicalBytes } from '../../scripts/ops/r24/corrective/canonical-json.mjs';
import {
  buildRcv00aCurrentHeadEvidence,
  buildRcv00aCurrentHeadStatus,
  RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION,
  RCV00A_UNSUPPORTED_RUNTIME_OBSERVATION,
  verifyRcv00aCurrentHeadExactToolchainEntrypoint,
} from '../../scripts/ops/r24/corrective/rcv00a-current-head-exact-toolchain-entrypoint.mjs';

function fileBytes(repoPath) {
  return fs.readFileSync(repoPath);
}

function objectFromCommit(sha, repoPath) {
  return execFileSync('git', ['show', `${sha}:${repoPath}`], { maxBuffer: 64 * 1024 * 1024 });
}

function statusBytes(mutator = () => {}) {
  const status = buildRcv00aCurrentHeadStatus({
    exactResult: {
      schemaVersion: 'yalken.r24.exact-toolchain-entrypoint.v1',
      status: 'PASS',
      ok: true,
      required: {
        node: '22.12.0',
        npm: '10.9.0',
        packageManager: 'npm@10.9.0',
        nodeVersionFile: '.node-version',
      },
      actual: {
        node: '22.12.0',
        npm: '10.9.0',
        nodeExecutable: '/fixture/node',
        platform: 'darwin',
        arch: 'arm64',
      },
      failures: [],
    },
    unsupportedRuntimeObservation: RCV00A_UNSUPPORTED_RUNTIME_OBSERVATION,
  });
  mutator(status);
  return canonicalBytes(status);
}

function evidenceBytes(statusDigest) {
  const evidence = buildRcv00aCurrentHeadEvidence(process.cwd());
  const binding = evidence.claimBindings.find((entry) => entry.filePath === RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.paths.status);
  binding.sha256 = statusDigest;
  return canonicalBytes(evidence);
}

function currentHeadFixture({
  changedPaths,
  baseTree,
  historicalTree,
  statusFileBytes,
  evidenceFileBytes,
  approvalsFileBytes,
  baseAncestor = true,
  historicalAncestor = true,
} = {}) {
  const e = RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION;
  const candidateSha = '7'.repeat(40);
  const candidateTree = '8'.repeat(40);
  const status = statusFileBytes ?? fileBytes(e.paths.status);
  const evidence = evidenceFileBytes ?? fileBytes(e.paths.evidence);
  const bytesByPath = new Map([
    [e.paths.status, status],
    [e.paths.evidence, evidence],
    [e.paths.defaultApprovals, approvalsFileBytes ?? fileBytes(e.paths.defaultApprovals)],
    [e.paths.inventory, fileBytes(e.paths.inventory)],
    [e.paths.verifier, fileBytes(e.paths.verifier)],
    [e.paths.contractTest, fileBytes(e.paths.contractTest)],
    [e.paths.postAuditVerifier, fileBytes(e.paths.postAuditVerifier)],
    [e.paths.postAuditTest, fileBytes(e.paths.postAuditTest)],
    [e.paths.toolchainContract, fileBytes(e.paths.toolchainContract)],
    [e.paths.packageJson, fileBytes(e.paths.packageJson)],
    [e.paths.exactEntrypoint, fileBytes(e.paths.exactEntrypoint)],
    [e.paths.toolchain, fileBytes(e.paths.toolchain)],
    [e.paths.claimLint, fileBytes(e.paths.claimLint)],
  ]);
  const workflowPaths = String(execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '.github/workflows'], { encoding: 'utf8' }))
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const workflowPath of workflowPaths) bytesByPath.set(workflowPath, objectFromCommit('HEAD', workflowPath));
  return {
    candidateSha,
    git(args, options = {}) {
      let value = '';
      if (args[0] === 'rev-parse' && args[1] === candidateSha) value = candidateSha;
      else if (args[0] === 'rev-parse' && args[1] === `${e.baseSha}^{tree}`) value = baseTree ?? e.baseTree;
      else if (args[0] === 'rev-parse' && args[1] === `${e.historicalDeliverySha}^{tree}`) value = historicalTree ?? e.historicalDeliveryTree;
      else if (args[0] === 'rev-parse' && args[1] === `${candidateSha}^{tree}`) value = candidateTree;
      else if (args[0] === 'merge-base') {
        if (args[2] === e.historicalDeliverySha && args[3] === e.baseSha && !historicalAncestor) throw new Error('NOT_ANCESTOR:HISTORICAL_RCV00A');
        if (args[2] === e.baseSha && args[3] === candidateSha && !baseAncestor) throw new Error('NOT_ANCESTOR:CURRENT_BASE');
        value = '';
      } else if (args[0] === 'diff') value = `${(changedPaths ?? e.admittedPaths).join('\n')}\n`;
      else if (args[0] === 'ls-tree') value = `${workflowPaths.join('\n')}\n`;
      else if (args[0] === 'show') {
        const spec = String(args[1]);
        const repoPath = spec.slice(spec.indexOf(':') + 1);
        const bytes = bytesByPath.get(repoPath);
        if (bytes) return options.encoding === 'utf8' ? bytes.toString('utf8') : Buffer.from(bytes);
        return execFileSync('git', args, options);
      } else return execFileSync('git', args, options);
      return options.encoding === 'utf8' ? `${value}\n` : Buffer.from(`${value}\n`);
    },
  };
}

function createSha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('RCV00A current-head exact-toolchain entrypoint accepts the exact current-head toolchain entrypoint delta', () => {
  const fixture = currentHeadFixture();
  const result = verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git });
  assert.equal(result.status, 'PASS');
  assert.equal(result.baseSha, RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.baseSha);
  assert.equal(result.candidateSha, fixture.candidateSha);
  assert.equal(result.admittedPathDenominator, RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator, RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.admittedPaths.length);
  assert.equal(result.exactNode, '22.12.0');
  assert.equal(result.exactNpm, '10.9.0');
  assert.equal(result.historicalRcv00aAdmissionWidened, false);
});

test('RCV00A current-head exact-toolchain entrypoint rejects an unadmitted current-head path', () => {
  const e = RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION;
  const fixture = currentHeadFixture({ changedPaths: [...e.admittedPaths, 'README.md'].sort() });
  assert.throws(
    () => verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00A_CURRENT_EXACT_ADMITTED_DELTA/,
  );
});

test('RCV00A current-head exact-toolchain entrypoint rejects a stale status head binding', () => {
  const statusFileBytes = statusBytes((status) => {
    status.headSha = '0'.repeat(40);
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00A_CURRENT_STATUS_HEAD_BINDING/,
  );
});

test('RCV00A current-head exact-toolchain entrypoint rejects a wrong exact Node version', () => {
  const statusFileBytes = statusBytes((status) => {
    status.exactEnvelope.result.actual.node = '22.13.0';
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00A_CURRENT_ACTUAL_VERSION/,
  );
});

test('RCV00A current-head exact-toolchain entrypoint rejects a wrong exact npm version', () => {
  const statusFileBytes = statusBytes((status) => {
    status.exactEnvelope.result.actual.npm = '10.10.0';
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00A_CURRENT_ACTUAL_VERSION/,
  );
});

test('RCV00A current-head exact-toolchain entrypoint rejects a non-machine-readable exact result', () => {
  const statusFileBytes = statusBytes((status) => {
    delete status.exactEnvelope.result.schemaVersion;
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00A_CURRENT_EXACT_RESULT_SHAPE/,
  );
});

test('RCV00A current-head exact-toolchain entrypoint rejects missing typed unsupported-runtime npm failure', () => {
  const statusFileBytes = statusBytes((status) => {
    status.unsupportedRuntimeProof.result.failures = ['E_R24_NODE_RUNTIME_UNSUPPORTED:26.7.0'];
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00aCurrentHeadExactToolchainEntrypoint({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00A_CURRENT_UNSUPPORTED_NPM_FAILURE/,
  );
});

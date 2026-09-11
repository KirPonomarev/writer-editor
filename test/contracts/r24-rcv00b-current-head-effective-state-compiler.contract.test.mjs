import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { canonicalBytes } from '../../scripts/ops/r24/corrective/canonical-json.mjs';
import {
  RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION,
  verifyRcv00bCurrentHeadEffectiveStateCompiler,
} from '../../scripts/ops/r24/corrective/rcv00b-current-head-effective-state-compiler.mjs';

function fileBytes(repoPath) {
  return fs.readFileSync(repoPath);
}

function objectFromCommit(sha, repoPath) {
  return execFileSync('git', ['show', `${sha}:${repoPath}`], { maxBuffer: 64 * 1024 * 1024 });
}

function createSha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function statusBytes(mutator = () => {}) {
  const status = JSON.parse(fileBytes(RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.paths.status));
  mutator(status);
  return canonicalBytes(status);
}

function evidenceBytes(statusDigest, mutator = () => {}) {
  const evidence = JSON.parse(fileBytes(RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.paths.evidence));
  const binding = evidence.claimBindings.find(
    (entry) => entry.filePath === RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.paths.status,
  );
  binding.sha256 = statusDigest;
  mutator(evidence);
  return canonicalBytes(evidence);
}

function currentHeadFixture({
  changedPaths,
  successorChangedPaths,
  statusFileBytes,
  evidenceFileBytes,
  approvalsFileBytes,
  baseTree,
  historicalTree,
} = {}) {
  const e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  const candidateSha = '7'.repeat(40);
  const successorSha = '9'.repeat(40);
  const candidateTree = '8'.repeat(40);
  const successorTree = '6'.repeat(40);
  const status = statusFileBytes ?? fileBytes(e.paths.status);
  const evidence = evidenceFileBytes ?? fileBytes(e.paths.evidence);
  const bytesByPath = new Map([
    [e.paths.status, status],
    [e.paths.evidence, evidence],
    [e.paths.defaultApprovals, approvalsFileBytes ?? fileBytes(e.paths.defaultApprovals)],
    [e.paths.inventory, fileBytes(e.paths.inventory)],
    [e.paths.historicalEvidence, fileBytes(e.paths.historicalEvidence)],
    [e.paths.successorRegistry, fileBytes(e.paths.successorRegistry)],
    [e.paths.compiler, fileBytes(e.paths.compiler)],
    [e.paths.executableProgram, fileBytes(e.paths.executableProgram)],
    [e.paths.scheduler, fileBytes(e.paths.scheduler)],
    [e.paths.currentCompilerTest, fileBytes(e.paths.currentCompilerTest)],
    [e.paths.claimLint, fileBytes(e.paths.claimLint)],
    [e.paths.claimLintTest, fileBytes(e.paths.claimLintTest)],
    [e.paths.verifier, fileBytes(e.paths.verifier)],
    [e.paths.historicalContractTest, fileBytes(e.paths.historicalContractTest)],
    [e.paths.contractTest, fileBytes(e.paths.contractTest)],
    [e.paths.postAuditVerifier, fileBytes(e.paths.postAuditVerifier)],
    [e.paths.postAuditTest, fileBytes(e.paths.postAuditTest)],
  ]);
  return {
    candidateSha,
    successorSha,
    git(args, options = {}) {
      let value = '';
      if (args[0] === 'rev-parse' && args[1] === candidateSha) value = candidateSha;
      else if (args[0] === 'rev-parse' && args[1] === successorSha) value = successorSha;
      else if (args[0] === 'rev-parse' && args[1] === `${e.baseSha}^{tree}`) value = baseTree ?? e.baseTree;
      else if (args[0] === 'rev-parse' && args[1] === `${e.historicalDeliverySha}^{tree}`) value = historicalTree ?? e.historicalDeliveryTree;
      else if (args[0] === 'rev-parse' && args[1] === `${candidateSha}^{tree}`) value = candidateTree;
      else if (args[0] === 'rev-parse' && args[1] === `${successorSha}^{tree}`) value = successorTree;
      else if (args[0] === 'merge-base') value = '';
      else if (args[0] === 'diff' && String(args[2] || '').endsWith(`..${candidateSha}`)) value = `${(changedPaths ?? e.admittedPaths).join('\n')}\n`;
      else if (args[0] === 'diff' && String(args[2] || '').endsWith(`..${successorSha}`)) value = `${(successorChangedPaths ?? [...e.admittedPaths, 'README.md'].sort()).join('\n')}\n`;
      else if (args[0] === 'rev-list') value = `${candidateSha}\n${successorSha}\n`;
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

test('RCV00B current-head effective-state compiler accepts the exact current-head effective-state compiler delta', () => {
  const fixture = currentHeadFixture();
  const result = verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.candidateSha, git: fixture.git });
  assert.equal(result.status, 'PASS');
  assert.equal(result.baseSha, RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.baseSha);
  assert.equal(result.candidateSha, fixture.candidateSha);
  assert.equal(result.admittedPathDenominator, RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator, RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths.length);
  assert.equal(result.selectionVerdict, 'NO_ELIGIBLE_NODE');
  assert.equal(result.readySetCount, 0);
  assert.equal(result.programDone, false);
  assert.equal(result.historicalRcv00bAdmissionWidened, false);
});

test('RCV00B current-head effective-state compiler accepts successor heads by selecting the immutable exact candidate', () => {
  const fixture = currentHeadFixture();
  const result = verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.successorSha, git: fixture.git });
  assert.equal(result.status, 'PASS');
  assert.equal(result.candidateSha, fixture.candidateSha);
  assert.equal(result.currentCandidateSha, fixture.successorSha);
  assert.deepEqual(result.changedPaths, RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths);
});

test('RCV00B current-head effective-state compiler rejects an unadmitted current-head path', () => {
  const e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  const fixture = currentHeadFixture({ changedPaths: [...e.admittedPaths, 'README.md'].sort() });
  assert.throws(
    () => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00B_CURRENT_CANDIDATE_NOT_FOUND/,
  );
});

test('RCV00B current-head effective-state compiler rejects a stale status head binding', () => {
  const statusFileBytes = statusBytes((status) => {
    status.headSha = '0'.repeat(40);
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00B_CURRENT_STATUS_HEAD_BINDING/,
  );
});

test('RCV00B current-head effective-state compiler rejects a mutated projection digest', () => {
  const statusFileBytes = statusBytes((status) => {
    status.projection.effectiveStateDigest = '0'.repeat(64);
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00B_CURRENT_EFFECTIVE_DIGEST/,
  );
});

test('RCV00B current-head effective-state compiler rejects a mutated selector verdict', () => {
  const statusFileBytes = statusBytes((status) => {
    status.selection.verdict = 'SELECTED';
    status.selection.selectedId = 'PK1_RELEASE_SECURITY_PHYSICAL';
  });
  const fixture = currentHeadFixture({ statusFileBytes, evidenceFileBytes: evidenceBytes(createSha(statusFileBytes)) });
  assert.throws(
    () => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00B_CURRENT_SELECTION_VERDICT/,
  );
});

test('RCV00B current-head effective-state compiler rejects stale evidence binding', () => {
  const statusFileBytes = statusBytes();
  const fixture = currentHeadFixture({
    statusFileBytes,
    evidenceFileBytes: evidenceBytes(createSha(statusFileBytes), (evidence) => {
      const binding = evidence.claimBindings.find(
        (entry) => entry.filePath === RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.paths.inventory,
      );
      binding.sha256 = '0'.repeat(64);
    }),
  });
  assert.throws(
    () => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: fixture.candidateSha, git: fixture.git }),
    /E_RCV00B_CURRENT_INVENTORY_BINDING_DIGEST/,
  );
});

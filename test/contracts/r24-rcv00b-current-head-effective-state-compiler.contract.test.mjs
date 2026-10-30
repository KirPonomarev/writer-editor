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

// Historical fixture inputs come from one immutable admitted candidate.
// Synthetic candidate IDs below do not qualify the current checkout or product.
const ORIGINAL_RCV00B_CANDIDATE_SHA = 'f6bb2126c19abb04e180c8abb6d206cc39b8a2a2';

function fileBytes(repoPath) {
  return objectFromCommit(ORIGINAL_RCV00B_CANDIDATE_SHA, repoPath);
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


import { resolveRcv00bCurrentHeadEffectiveStateCompilerCandidateSha as boundedC1cResolveRcv00b } from '../../scripts/ops/r24/corrective/rcv00b-current-head-effective-state-compiler.mjs';
const BOUNDED_C1C_RCV00B_HINT = '23e90a79dfe41f0d8bfc296122fa88b27f30d895';

test('bounded C1C RCV00B actual history keeps the complete result without enumeration', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), calls = [];
  const git = (args, options = {}) => { calls.push([...args]); return execFileSync('git', args, { ...options, maxBuffer: 64 * 1024 * 1024 }); };
  const result = verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: head, git });
  assert.equal(result.status, 'PASS');
  assert.equal(result.candidateSha, BOUNDED_C1C_RCV00B_HINT);
  assert.equal(result.currentCandidateSha, head);
  assert.deepEqual(result.changedPaths, RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths);
  assert.equal(result.programDone, false);
  assert.equal(result.historicalRcv00bAdmissionWidened, false);
  assert.equal(calls.some(args => args[0] === 'rev-list'), false, 'verified canonical history must not enumerate the old range');
});

for (const fault of ['requested-identity', 'hint-identity', 'hint-base-ancestry', 'hint-requested-ancestry', 'hint-delta']) {
  test('bounded C1C RCV00B keeps exhaustive fallback for ' + fault, () => {
    const e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
    const requested = 'a'.repeat(40), selected = 'b'.repeat(40), hint = BOUNDED_C1C_RCV00B_HINT, calls = [];
    const git = (args, options = {}) => {
      calls.push([...args]); let value;
      if (args[0] === 'rev-parse' && args[1] === requested + '^{commit}') value = fault === 'requested-identity' ? '0'.repeat(40) : requested;
      else if (args[0] === 'rev-parse' && args[1] === hint + '^{commit}') value = fault === 'hint-identity' ? '0'.repeat(40) : hint;
      else if (args[0] === 'merge-base') {
        if (fault === 'hint-base-ancestry' && args[2] === e.baseSha && args[3] === hint) throw Error('hint lacks base ancestry');
        if (fault === 'hint-requested-ancestry' && args[2] === hint && args[3] === requested) throw Error('hint lacks requested ancestry');
        value = '';
      } else if (args[0] === 'rev-list') value = selected + '\n' + requested;
      else if (args[0] === 'diff' && args[2] === e.baseSha + '..' + selected) value = e.admittedPaths.join('\n');
      else if (args[0] === 'diff' && args[2] === e.baseSha + '..' + hint && fault !== 'hint-delta') value = e.admittedPaths.join('\n');
      else if (args[0] === 'diff') value = [...e.admittedPaths, 'unadmitted.txt'].sort().join('\n');
      else throw Error('unexpected controlled Git request: ' + args.join(':'));
      return options.encoding === 'utf8' ? value + '\n' : Buffer.from(value + '\n');
    };
    assert.equal(boundedC1cResolveRcv00b(git, requested, e), selected);
    assert.equal(calls.some(args => args[0] === 'rev-list'), true);
  });
}

test('bounded C1C RCV00B selected real artifact still rejects wrong status identity', () => {
  const e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  const git = (args, options = {}) => {
    const bytes = execFileSync('git', args, { ...options, maxBuffer: 64 * 1024 * 1024 });
    if (args[0] === 'show' && args[1] === BOUNDED_C1C_RCV00B_HINT + ':' + e.paths.status) {
      const value = JSON.parse(bytes); value.headSha = '0'.repeat(40);
      const changed = Buffer.from(JSON.stringify(value) + '\n');
      return options.encoding === 'utf8' ? changed.toString('utf8') : changed;
    }
    return bytes;
  };
  assert.throws(() => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: BOUNDED_C1C_RCV00B_HINT, git }), /E_RCV00B_CURRENT_STATUS_HEAD_BINDING/);
});

function boundedC1cRcv00bBoundaryHistory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-c1c-RCV00B-selection-'));
  execFileSync('git', ['init', '-q', '--bare', path.join(root, 'history.git')]);
  const objects = path.resolve(execFileSync('git', ['rev-parse', '--git-path', 'objects'], { encoding: 'utf8' }).trim());
  const env = { ...process.env, GIT_ALTERNATE_OBJECT_DIRECTORIES: objects, GIT_INDEX_FILE: path.join(root, 'index'), GIT_AUTHOR_NAME: 'C1C fixture', GIT_AUTHOR_EMAIL: 'fixture@invalid', GIT_COMMITTER_NAME: 'C1C fixture', GIT_COMMITTER_EMAIL: 'fixture@invalid', GIT_AUTHOR_DATE: '2026-10-30T06:00:00Z', GIT_COMMITTER_DATE: '2026-10-30T06:00:00Z' };
  const calls = [], git = (args, options = {}) => { calls.push([...args]); return execFileSync('git', ['--git-dir=' + path.join(root, 'history.git'), ...args], { ...options, env, maxBuffer: 64 * 1024 * 1024 }); };
  const checkpoint = '424fd2087d6141528b0c74a063d1c80ae2edd9bb', tree = String(git(['rev-parse', checkpoint + '^{tree}'])).trim();
  const commit = (value, parent) => String(git(['commit-tree', value, '-p', parent], { input: 'owned synthetic C1C selection control\n' })).trim();
  const normal = commit(tree, checkpoint), e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  const target = e.paths.status, oldBytes = Buffer.from(git(['show', BOUNDED_C1C_RCV00B_HINT + ':' + target]));
  const invalid = JSON.parse(oldBytes); invalid.headSha = '0'.repeat(40);
  const badBytes = Buffer.from(JSON.stringify(invalid) + '\n');
  git(['read-tree', BOUNDED_C1C_RCV00B_HINT]);
  const blob = String(git(['hash-object', '-w', '--stdin'], { input: badBytes })).trim();
  git(['update-index', '--cacheinfo', '100644,' + blob + ',' + target]);
  const badTree = String(git(['write-tree'])).trim(), later = commit(badTree, checkpoint), requested = commit(tree, later);
  return { root, git, calls, normal, later, requested, target, badBytes };
}

test('bounded C1C later exact RCV00B ancestor retains the original artifact refusal', t => {
  const f = boundedC1cRcv00bBoundaryHistory();
  assert.equal(verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: f.normal, git: f.git }).status, 'PASS');
  assert.throws(() => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: f.requested, git: f.git }), /E_RCV00B_CURRENT_STATUS_HEAD_BINDING/);
  assert(f.calls.some(args => args[0] === 'show' && args[1] === f.later + ':' + f.target), 'the later exact candidate must actually be validated');
  t.diagnostic(JSON.stringify({ root: f.root, normal: f.normal, later: f.later, requested: f.requested }));
});

test('bounded C1C descendant fast path RCV00B validates the selected artifact', t => {
  const f = boundedC1cRcv00bBoundaryHistory();
  const normal = verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: f.normal, git: f.git });
  assert.equal(normal.status, 'PASS'); assert.equal(normal.candidateSha, BOUNDED_C1C_RCV00B_HINT);
  f.calls.length = 0;
  const git = (args, options = {}) => {
    const bytes = f.git(args, options);
    return args[0] === 'show' && args[1] === BOUNDED_C1C_RCV00B_HINT + ':' + f.target ? (options.encoding === 'utf8' ? f.badBytes.toString('utf8') : f.badBytes) : bytes;
  };
  assert.throws(() => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: f.normal, git }), /E_RCV00B_CURRENT_STATUS_HEAD_BINDING/);
  assert(f.calls.some(args => args[0] === 'show' && args[1] === BOUNDED_C1C_RCV00B_HINT + ':' + f.target));
  assert.equal(f.calls.some(args => args[0] === 'rev-list'), false, 'this refusal must execute the hint path');
  t.diagnostic(JSON.stringify({ root: f.root, descendant: f.normal }));
});

import path from 'node:path';
import os from 'node:os';

test('bounded C1C mixed ancestry RCV00B retains the later candidate refusal', () => {
  const f = boundedC1cRcv00bBoundaryHistory(), checkpoint = '424fd2087d6141528b0c74a063d1c80ae2edd9bb';
  const before = String(f.git(['rev-parse', checkpoint + '^1'])).trim();
  const badTree = String(f.git(['rev-parse', f.later + '^{tree}'])).trim(), tree = String(f.git(['rev-parse', checkpoint + '^{tree}'])).trim();
  const foreign = String(f.git(['commit-tree', badTree, '-p', before], { input: 'owned foreign-branch control\n' })).trim();
  const merge = String(f.git(['commit-tree', tree, '-p', checkpoint, '-p', foreign], { input: 'owned mixed-ancestry control\n' })).trim();
  const boundary = String(f.git(['log', '--boundary', '--format=%m%H', checkpoint + '..' + merge])).split('\n');
  assert(boundary.includes('-' + before) && boundary.includes('-' + checkpoint));
  f.calls.length = 0;
  assert.throws(() => verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: merge, git: f.git }), /E_RCV00B_CURRENT_STATUS_HEAD_BINDING/);
  assert(f.calls.some(args => args[0] === 'rev-list'));
  assert(f.calls.some(args => args[0] === 'show' && args[1] === foreign + ':' + f.target));
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  EXPECTED_BASE_SHA,
  GIT_HEAD_IDENTITY_MODE,
  PATHS,
  WORKTREE_CANDIDATE_IDENTITY_MODE,
  buildClaimBindings,
  buildManifest,
  checkArtifacts,
  validateClaimBindingEvidence,
  validateExecutionEvidence,
  validateManifest,
} from '../../scripts/ops/r24/corrective/rcv01a-normative-claim-test-lane-manifest.mjs';
import { createMemoizedGit, gitMemoKey, verifyCertificationSet } from '../../scripts/ops/r24/corrective/post-audit-certification-set.mjs';
import { createFixturePublicationCache } from '../fixtures/r24-fixture-publication-cache.mjs';

const REPO_ROOT = process.cwd();
const clone = (value) => structuredClone(value);
const fixture = () => JSON.parse(fs.readFileSync(PATHS.manifest, 'utf8'));
const claimBindingFixture = () => JSON.parse(fs.readFileSync(PATHS.claimBindings, 'utf8'));
const inventory = () => JSON.parse(fs.readFileSync(PATHS.inventory, 'utf8'));
const runnerPath = 'scripts/ops/r24/run-c1c-contract-shard.mjs';
const postAuditCertificationSet = () => {
  const bytes = fs.readFileSync('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CURRENT_CERTIFICATION_SET_V2.json');
  return {
    value: JSON.parse(bytes),
    fileDigest: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
};
const tempTestFile = (source) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-c1c-runner-'));
  const file = path.join(dir, 'fixture.test.mjs');
  fs.writeFileSync(file, source);
  return file;
};
const runShardFixture = (file, env = {}) => {
  const childEnv = { ...process.env, R24_C1C_KEEPALIVE_MS: '0', ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.NODE_TEST_WORKER_ID;
  return spawnSync(process.execPath, [runnerPath, file], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv,
    timeout: 10000,
  });
};
const fixtureFs = (mode) => ({
  mkdirSync: (...args) => fs.mkdirSync(...args),
  openSync: (...args) => fs.openSync(...args),
  writeFileSync: (...args) => {
    if (mode === 'write') throw new Error('injected write failure');
    return fs.writeFileSync(...args);
  },
  fsyncSync: (...args) => {
    if (mode === 'fsync') throw new Error('injected fsync failure');
    return fs.fsyncSync(...args);
  },
  closeSync: (...args) => fs.closeSync(...args),
  renameSync: (...args) => {
    if (mode === 'rename') throw new Error('injected rename failure');
    return fs.renameSync(...args);
  },
  readFileSync: (...args) => fs.readFileSync(...args),
  lstatSync: (...args) => fs.lstatSync(...args),
  existsSync: (...args) => fs.existsSync(...args),
  unlinkSync: (...args) => fs.unlinkSync(...args),
});
const fixtureTempResidue = (file) => fs.readdirSync(path.dirname(file)).filter((name) => name.includes(`${path.basename(file)}.r24-fixture-tmp`));
const onceFailingFixtureFs = (mode) => {
  let failed = false;
  const delegate = fixtureFs('');
  return {
    ...delegate,
    [mode === 'rename' ? 'renameSync' : mode === 'fsync' ? 'fsyncSync' : 'writeFileSync']: (...args) => {
      if (!failed) {
        failed = true;
        throw new Error(`injected ${mode} failure`);
      }
      return delegate[mode === 'rename' ? 'renameSync' : mode === 'fsync' ? 'fsyncSync' : 'writeFileSync'](...args);
    },
  };
};

test('RCV01A artifacts compile the fixed claim-test-lane denominator', () => {
  const result = checkArtifacts(REPO_ROOT);
  assert.equal(result.status, 'PASS');
  assert.equal(result.manifestValidation.requiredClaimCount, 2);
  assert.equal(result.manifestValidation.optionalClaimCount, 1);
  assert.equal(result.manifestValidation.manifestTestIdentityCount, 4);
  assert.equal(result.manifestValidation.laneCount, 6);
});

test('RCV01A generated manifest matches deterministic current sources', () => {
  assert.deepEqual(fixture(), buildManifest({ repoRoot: REPO_ROOT }));
});

test('RCV01A generated claim bindings explicitly identify non-current worktree bytes', () => {
  const bindings = claimBindingFixture();
  assert.deepEqual(bindings, buildClaimBindings({ repoRoot: REPO_ROOT }));
  const result = validateClaimBindingEvidence(bindings, { repoRoot: REPO_ROOT });
  assert.equal(result.status, 'PASS');
  assert.equal(result.identityMode, WORKTREE_CANDIDATE_IDENTITY_MODE);
  assert.equal(bindings.verdict, 'BLOCKED_REQUIRED_C1C_SHARD_INCOMPLETE');
  assert.equal(
    bindings.executedEvidence.find((entry) => entry.command.includes('run-c1c-contract-shard.mjs')).verdict,
    'INCOMPLETE_CODEX_HARNESS_TERMINATED_AFTER_KEEPALIVE',
  );
  assert.equal(bindings.headSha, null);
  assert.equal(bindings.originMainSha, null);
  assert.equal(bindings.candidateIdentity.declaredGitHeadReachability, 'NOT_CLAIMED_UNCOMMITTED_CANDIDATE_BYTES');
  assert.equal(bindings.independentReviewEvidence[0].findingIds[0], 'GATE_A_STALE_EVIDENCE_STAMP_IDENTITY');
});

test('stale git-head claim binding identity cannot bind current candidate bytes', () => {
  const mutant = clone(claimBindingFixture());
  mutant.identityMode = GIT_HEAD_IDENTITY_MODE;
  mutant.headSha = EXPECTED_BASE_SHA;
  mutant.originMainSha = EXPECTED_BASE_SHA;
  delete mutant.candidateIdentity;
  delete mutant.independentReviewEvidence;
  assert.throws(
    () => validateClaimBindingEvidence(mutant, { repoRoot: REPO_ROOT }),
    /E_RCV01A_BOUND_ARTIFACT_UNREACHABLE|E_RCV01A_BOUND_ARTIFACT_DIGEST_MISMATCH/u,
  );
});

test('worktree candidate stamp cannot also claim a reachable git head', () => {
  const mutant = clone(claimBindingFixture());
  mutant.headSha = EXPECTED_BASE_SHA;
  assert.throws(() => validateClaimBindingEvidence(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_WORKTREE_STAMP_HEAD_CLAIM/u);
});

test('post-audit git memo cache keys include executable repo worktree env cwd args path revision and options', () => {
  const shaA = 'a'.repeat(40);
  const shaB = 'b'.repeat(40);
  const identity = (overrides = {}) => ({
    executable: '/usr/bin/git-a',
    defaultCwd: '/repo-a',
    explicitCwd: null,
    effectiveCwd: '/repo-a',
    gitDir: '/repo-a/.git',
    commonDir: '/repo-a/.git',
    worktree: '/repo-a',
    gitEnv: { GIT_DIR: null, GIT_WORK_TREE: null, PATH: '/bin-a' },
    ...overrides,
  });
  const identities = new Map([
    ['/repo-a', identity()],
    ['/repo-b', identity({ effectiveCwd: '/repo-b', gitDir: '/repo-b/.git', commonDir: '/repo-b/.git', worktree: '/repo-b' })],
    ['/repo-worktree-b', identity({ effectiveCwd: '/repo-worktree-b', gitDir: '/repo-a/.git/worktrees/b', worktree: '/repo-worktree-b' })],
    ['/repo-exec-b', identity({ executable: '/opt/git-b/bin/git', effectiveCwd: '/repo-exec-b' })],
    ['/repo-env-b', identity({ effectiveCwd: '/repo-env-b', gitEnv: { GIT_DIR: null, GIT_WORK_TREE: '/alt-worktree', PATH: '/bin-b' } })],
  ]);
  const calls = [];
  const fakeGit = (args, options = {}) => {
    calls.push({ args: [...args], encoding: options.encoding ?? null, cwd: options.cwd ?? '' });
    const value = `${args.join('\0')}|${options.cwd ?? ''}|${options.encoding ?? 'buffer'}`;
    return options.encoding === 'utf8' ? `${value}\n` : Buffer.from(value);
  };
  const memoized = createMemoizedGit(fakeGit, {
    requireImmutable: true,
    identityProvider: (options = {}) => identities.get(options.cwd) ?? identity({ effectiveCwd: options.cwd ?? '/repo-a' }),
  });
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: null, cwd: '/repo-a' }).toString(), `show\0${shaA}:path.txt|/repo-a|buffer`);
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: null, cwd: '/repo-a' }).toString(), `show\0${shaA}:path.txt|/repo-a|buffer`);
  assert.equal(calls.length, 1);
  assert.equal(memoized(['show', `${shaB}:path.txt`], { encoding: null, cwd: '/repo-a' }).toString(), `show\0${shaB}:path.txt|/repo-a|buffer`);
  assert.equal(calls.length, 2);
  assert.equal(memoized(['show', `${shaA}:other.txt`], { encoding: null, cwd: '/repo-a' }).toString(), `show\0${shaA}:other.txt|/repo-a|buffer`);
  assert.equal(calls.length, 3);
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: 'utf8', cwd: '/repo-a' }), `show\0${shaA}:path.txt|/repo-a|utf8\n`);
  assert.equal(calls.length, 4);
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: null, cwd: '/repo-b' }).toString(), `show\0${shaA}:path.txt|/repo-b|buffer`);
  assert.equal(calls.length, 5);
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: null, cwd: '/repo-worktree-b' }).toString(), `show\0${shaA}:path.txt|/repo-worktree-b|buffer`);
  assert.equal(calls.length, 6);
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: null, cwd: '/repo-exec-b' }).toString(), `show\0${shaA}:path.txt|/repo-exec-b|buffer`);
  assert.equal(calls.length, 7);
  assert.equal(memoized(['show', `${shaA}:path.txt`], { encoding: null, cwd: '/repo-env-b' }).toString(), `show\0${shaA}:path.txt|/repo-env-b|buffer`);
  assert.equal(calls.length, 8);
  assert.notEqual(gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity()), gitMemoKey(['show', `${shaB}:path.txt`], { encoding: null }, identity()));
  assert.notEqual(gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity()), gitMemoKey(['show', `${shaA}:other.txt`], { encoding: null }, identity()));
  assert.notEqual(gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity()), gitMemoKey(['show', `${shaA}:path.txt`], { encoding: 'utf8' }, identity()));
  assert.notEqual(gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity()), gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity({ executable: '/opt/git-b/bin/git' })));
  assert.notEqual(gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity()), gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity({ worktree: '/repo-worktree-b' })));
  assert.notEqual(gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity()), gitMemoKey(['show', `${shaA}:path.txt`], { encoding: null }, identity({ gitEnv: { GIT_DIR: null, GIT_WORK_TREE: '/alt-worktree', PATH: '/bin-b' } })));
  assert.equal(memoized.stats.hits, 1);
  assert.equal(memoized.stats.misses, 8);
});

test('post-audit git memo is immutable-only and does not replay transient failures', () => {
  const sha = 'c'.repeat(40);
  const identityProvider = () => ({
    executable: '/usr/bin/git',
    defaultCwd: '/repo',
    explicitCwd: null,
    effectiveCwd: '/repo',
    gitDir: '/repo/.git',
    commonDir: '/repo/.git',
    worktree: '/repo',
    gitEnv: { GIT_DIR: null, GIT_WORK_TREE: null, PATH: '/bin' },
  });
  let calls = 0;
  const flakyGit = (args, options = {}) => {
    calls += 1;
    if (calls === 1) throw new Error('transient git failure');
    const value = `${args.join('\0')}|${options.encoding ?? 'buffer'}`;
    return options.encoding === 'utf8' ? `${value}\n` : Buffer.from(value);
  };
  const memoized = createMemoizedGit(flakyGit, { requireImmutable: true, identityProvider });
  assert.throws(() => memoized(['show', `${sha}:path.txt`], { encoding: null }), /transient git failure/u);
  assert.equal(memoized(['show', `${sha}:path.txt`], { encoding: null }).toString(), `show\0${sha}:path.txt|buffer`);
  assert.equal(memoized(['show', `${sha}:path.txt`], { encoding: null }).toString(), `show\0${sha}:path.txt|buffer`);
  assert.equal(calls, 2);
  assert.equal(memoized.stats.failures, 1);
  assert.equal(memoized.stats.stores, 1);

  memoized(['rev-parse', 'HEAD'], { encoding: 'utf8' });
  memoized(['rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(calls, 4);
  assert.equal(memoized.stats.bypassed, 2);
});

test('test fixture publication cache dedupes equal path bytes and separates different bytes path and identity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-durable-publisher-'));
  try {
    const target = path.join(dir, 'artifact.json');
    const other = path.join(dir, 'other.json');
    const publisher = createFixturePublicationCache({ identity: { fixture: 'A', revision: 'one' } });
    publisher.publish(target, Buffer.from('same\n'));
    publisher.publish(target, Buffer.from('same\n'));
    publisher.publish(target, Buffer.from('changed\n'));
    publisher.publish(other, Buffer.from('same\n'));
    assert.equal(fs.readFileSync(target, 'utf8'), 'changed\n');
    assert.equal(fs.readFileSync(other, 'utf8'), 'same\n');
    assert.deepEqual(publisher.summary(), {
      deduped: 1,
      failures: 0,
      fsyncCalls: 6,
      published: 3,
      readbackCalls: 4,
      renameCalls: 3,
      uniquePathByteHashCount: 3,
      uniquePathCount: 2,
      writeCalls: 3,
    });

    const separateIdentity = createFixturePublicationCache({ identity: { fixture: 'B', revision: 'one' } });
    separateIdentity.publish(target, Buffer.from('changed\n'));
    assert.equal(separateIdentity.summary().published, 1);
    assert.equal(separateIdentity.summary().deduped, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('test fixture publication cache revalidates cached target mode existence and bytes before dedupe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-fixture-revalidate-'));
  try {
    const modeTarget = path.join(dir, 'mode.json');
    const missingTarget = path.join(dir, 'missing.json');
    const tamperedTarget = path.join(dir, 'tampered.json');

    const modePublisher = createFixturePublicationCache({ identity: { fixture: 'mode-drift', phase: 'candidate' }, requiredMode: 0o600 });
    modePublisher.publish(modeTarget, Buffer.from('payload\n'));
    fs.chmodSync(modeTarget, 0o755);
    modePublisher.publish(modeTarget, Buffer.from('payload\n'));
    assert.equal(fs.statSync(modeTarget).mode & 0o777, 0o600);
    assert.equal(modePublisher.summary().published, 2);
    assert.equal(modePublisher.summary().deduped, 0);

    const missingPublisher = createFixturePublicationCache({ identity: { fixture: 'missing-target', phase: 'candidate' } });
    missingPublisher.publish(missingTarget, Buffer.from('payload\n'));
    fs.unlinkSync(missingTarget);
    missingPublisher.publish(missingTarget, Buffer.from('payload\n'));
    assert.equal(fs.readFileSync(missingTarget, 'utf8'), 'payload\n');
    assert.equal(missingPublisher.summary().published, 2);
    assert.equal(missingPublisher.summary().deduped, 0);

    const tamperedPublisher = createFixturePublicationCache({ identity: { fixture: 'tampered-bytes', phase: 'candidate' } });
    tamperedPublisher.publish(tamperedTarget, Buffer.from('payload\n'));
    fs.writeFileSync(tamperedTarget, 'tampered\n');
    tamperedPublisher.publish(tamperedTarget, Buffer.from('payload\n'));
    assert.equal(fs.readFileSync(tamperedTarget, 'utf8'), 'payload\n');
    assert.equal(tamperedPublisher.summary().published, 2);
    assert.equal(tamperedPublisher.summary().deduped, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('test fixture publication cache propagates write fsync and rename failures without partial artifacts', () => {
  for (const mode of ['write', 'fsync', 'rename']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yalken-durable-${mode}-`));
    const target = path.join(dir, 'artifact.json');
    const publisher = createFixturePublicationCache({ fsModule: fixtureFs(mode), identity: { fixture: mode } });
    try {
      assert.throws(() => publisher.publish(target, Buffer.from('payload\n')), new RegExp(`injected ${mode} failure`, 'u'));
      assert.equal(fs.existsSync(target), false, mode);
      assert.deepEqual(fixtureTempResidue(target), [], mode);
      assert.equal(publisher.summary().failures, 1);
      assert.equal(publisher.summary().published, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('test fixture publication cache separates mode ref head worktree env phase lifecycle identities and clears between tests', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-fixture-identity-'));
  try {
    const target = path.join(dir, 'artifact.json');
    const baseIdentity = { env: { GIT_INDEX_FILE: null }, head: 'h1', lifecycle: 'source', mode: '100644', phase: 'source-write', ref: 'refs/heads/a', worktree: dir };
    const base = createFixturePublicationCache({ identity: baseIdentity });
    base.publish(target, Buffer.from('payload\n'));
    base.publish(target, Buffer.from('payload\n'));
    assert.equal(base.summary().deduped, 1);
    for (const changedIdentity of [
      { ...baseIdentity, mode: '100755' },
      { ...baseIdentity, ref: 'refs/heads/b' },
      { ...baseIdentity, head: 'h2' },
      { ...baseIdentity, worktree: `${dir}-other` },
      { ...baseIdentity, env: { GIT_INDEX_FILE: '/tmp/other-index' } },
      { ...baseIdentity, phase: 'candidate-write' },
      { ...baseIdentity, lifecycle: 'candidate' },
    ]) {
      const separated = createFixturePublicationCache({ identity: changedIdentity });
      separated.publish(target, Buffer.from('payload\n'));
      assert.equal(separated.summary().published, 1);
      assert.equal(separated.summary().deduped, 0);
    }
    base.clear();
    base.publish(target, Buffer.from('payload\n'));
    assert.equal(base.summary().published, 1);
    assert.equal(base.summary().deduped, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('test fixture publication cache does not seed after failed write fsync or rename', () => {
  for (const mode of ['write', 'fsync', 'rename']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yalken-fixture-failseed-${mode}-`));
    const target = path.join(dir, 'artifact.json');
    const publisher = createFixturePublicationCache({ fsModule: onceFailingFixtureFs(mode), identity: { fixture: mode, head: 'h1' } });
    try {
      assert.throws(() => publisher.publish(target, Buffer.from('payload\n')), new RegExp(`injected ${mode} failure`, 'u'));
      publisher.publish(target, Buffer.from('payload\n'));
      assert.equal(publisher.summary().published, 1);
      assert.equal(publisher.summary().deduped, 0);
      publisher.publish(target, Buffer.from('payload\n'));
      assert.equal(publisher.summary().deduped, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('c1c shard runner preserves nonzero child failure as FAIL', () => {
  const file = tempTestFile("import assert from 'node:assert/strict';import test from 'node:test';test('fails',()=>assert.equal(1,2));\n");
  const result = runShardFixture(file);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /R24_C1C_CONTRACT_SHARD_EXIT=.*"code":1/u);
});

test('c1c shard runner preserves child signal as FAIL', () => {
  const file = tempTestFile("import test from 'node:test';setInterval(()=>{},1000);test('wait',()=>new Promise(()=>{}));\n");
  const result = runShardFixture(file, { R24_C1C_CHILD_SIGNAL_AFTER_MS: '100', R24_C1C_CHILD_SIGNAL: 'SIGKILL' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /R24_C1C_CONTRACT_SHARD_CHILD_SIGNAL=.*"signal":"SIGKILL"/u);
  assert.match(result.stderr, /R24_C1C_CONTRACT_SHARD_EXIT=.*"signal":"SIGKILL"/u);
});

test('c1c shard runner preserves true hang timeout as FAIL', () => {
  const file = tempTestFile("import test from 'node:test';setInterval(()=>{},1000);test('hang',()=>new Promise(()=>{}));\n");
  const result = runShardFixture(file, { R24_C1C_CHILD_TIMEOUT_MS: '300' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /R24_C1C_CONTRACT_SHARD_TIMEOUT=/u);
  assert.match(result.stderr, /R24_C1C_CONTRACT_SHARD_EXIT=.*"timedOut":true/u);
});

test('required claim removal is rejected independently of filesystem inventory', () => {
  const manifest = fixture();
  const mutant = clone(manifest);
  mutant.claims = mutant.claims.filter((claim) => claim.claimId !== 'R24_DANGEROUS_MUTANTS');
  assert.throws(() => validateManifest(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_REQUIRED_CLAIM_SET/u);
});

test('manifest removal policy cannot be disabled by a manifest edit', () => {
  const mutant = clone(fixture());
  mutant.denominatorPolicy.manifestRemovalRequiresVersionedOwnerDecision = false;
  assert.throws(() => validateManifest(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_MANIFEST_REMOVAL_POLICY/u);
});

test('simultaneous test and inventory-row deletion does not erase the obligation', () => {
  const manifest = fixture();
  const mutantInventory = inventory();
  const removed = manifest.claims.find((claim) => claim.claimId === 'R24_SEMANTIC_PACKAGE_ORACLE').exactTests[0].testId;
  mutantInventory.entries = mutantInventory.entries.filter((entry) => entry.path !== removed);
  assert.throws(
    () => validateManifest(manifest, {
      repoRoot: REPO_ROOT,
      inventory: mutantInventory,
      fileExists: (relativePath) => relativePath !== removed,
      fileSha256: (relativePath) => {
        if (relativePath === removed) return '0'.repeat(64);
        return manifest.claims.flatMap((claim) => claim.exactTests).find((entry) => entry.testId === relativePath)?.sha256 || '1'.repeat(64);
      },
    }),
    /E_RCV01A_REQUIRED_TEST_FILE_MISSING|E_RCV01A_REQUIRED_TEST_INVENTORY_MISSING/u,
  );
});

test('missing required lane fails closed', () => {
  const mutant = clone(fixture());
  mutant.claims.find((claim) => claim.claimId === 'R24_SEMANTIC_PACKAGE_ORACLE').requiredCiLaneIds = [];
  assert.throws(() => validateManifest(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_REQUIRED_LANE_MISSING/u);
});

test('required test inventory lane must be an executable required CI lane', () => {
  const mutant = clone(fixture());
  const semantic = mutant.claims.find((claim) => claim.claimId === 'R24_SEMANTIC_PACKAGE_ORACLE');
  semantic.requiredCiLaneIds = semantic.requiredCiLaneIds.filter((laneId) => laneId !== 'c1c-contract-shard');
  assert.throws(() => validateManifest(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_REQUIRED_TEST_LANE_NOT_REQUIRED/u);

  const missingCommand = clone(fixture());
  missingCommand.ciLanes.find((lane) => lane.laneId === 'c1c-contract-shard').command = '';
  assert.throws(() => validateManifest(missingCommand, { repoRoot: REPO_ROOT }), /E_RCV01A_CI_LANE_COMMAND/u);
});

test('duplicate test identity inside one claim fails closed', () => {
  const mutant = clone(fixture());
  const claim = mutant.claims.find((entry) => entry.claimId === 'R24_SEMANTIC_PACKAGE_ORACLE');
  claim.exactTests.push(clone(claim.exactTests[0]));
  assert.throws(() => validateManifest(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_DUPLICATE_TEST_IDENTITY/u);
});

test('post-audit certification set rejects duplicated stages and reused artifact bindings', () => {
  const file = postAuditCertificationSet();
  const mutant = clone(file.value);
  const repeatedStage = clone(mutant.stages[0]);
  const repeatedBinding = clone(repeatedStage.artifactBindings[0]);
  mutant.stages = [];
  let remainingBindings = 137;
  for (let index = 0; index < 33; index += 1) {
    const bindingCount = index === 32 ? remainingBindings : 4;
    remainingBindings -= bindingCount;
    const stage = clone(repeatedStage);
    stage.artifactBindings = Array.from({ length: bindingCount }, () => clone(repeatedBinding));
    mutant.stages.push(stage);
  }
  assert.throws(
    () => verifyCertificationSet({
      value: mutant,
      fileDigest: file.fileDigest,
      candidateSha: 'HEAD',
      allowAuditCycle2Admission: true,
      allowMainProductWp401Admission: true,
    }),
    /E_CERTIFICATION_STAGE_DUPLICATE|E_CERTIFICATION_BINDING_DUPLICATE/u,
  );
});

test('zero-test result fails closed', () => {
  const manifest = fixture();
  const evidence = clone(manifest.sampleExecutionEvidence);
  evidence.testResults[0].tests = 0;
  assert.throws(() => validateExecutionEvidence(manifest, evidence), /E_RCV01A_ZERO_TEST_RESULT/u);
});

test('duplicate execution result identity fails closed', () => {
  const manifest = fixture();
  const evidence = clone(manifest.sampleExecutionEvidence);
  evidence.testResults.push(clone(evidence.testResults[0]));
  assert.throws(() => validateExecutionEvidence(manifest, evidence), /E_RCV01A_DUPLICATE_TEST_RESULT/u);
});

test('reduced mutant denominator fails closed for load-bearing claims', () => {
  const manifest = fixture();
  const evidence = clone(manifest.sampleExecutionEvidence);
  const mutantLane = evidence.laneResults.find((lane) => lane.mutants);
  mutantLane.mutants.total = 39;
  mutantLane.mutants.killed = 39;
  assert.throws(() => validateExecutionEvidence(manifest, evidence), /E_RCV01A_MUTANT_DENOMINATOR_REDUCED/u);
});

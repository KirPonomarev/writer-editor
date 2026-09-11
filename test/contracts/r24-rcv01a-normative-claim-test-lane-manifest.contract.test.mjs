import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  PATHS,
  buildManifest,
  checkArtifacts,
  validateExecutionEvidence,
  validateManifest,
} from '../../scripts/ops/r24/corrective/rcv01a-normative-claim-test-lane-manifest.mjs';

const REPO_ROOT = process.cwd();
const clone = (value) => structuredClone(value);
const fixture = () => JSON.parse(fs.readFileSync(PATHS.manifest, 'utf8'));
const inventory = () => JSON.parse(fs.readFileSync(PATHS.inventory, 'utf8'));

test('RCV01A artifacts compile the fixed claim-test-lane denominator', () => {
  const result = checkArtifacts(REPO_ROOT);
  assert.equal(result.status, 'PASS');
  assert.equal(result.manifestValidation.requiredClaimCount, 2);
  assert.equal(result.manifestValidation.optionalClaimCount, 1);
  assert.equal(result.manifestValidation.manifestTestIdentityCount, 4);
  assert.equal(result.manifestValidation.laneCount, 5);
});

test('RCV01A generated manifest matches deterministic current sources', () => {
  assert.deepEqual(fixture(), buildManifest({ repoRoot: REPO_ROOT }));
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

test('duplicate test identity inside one claim fails closed', () => {
  const mutant = clone(fixture());
  const claim = mutant.claims.find((entry) => entry.claimId === 'R24_SEMANTIC_PACKAGE_ORACLE');
  claim.exactTests.push(clone(claim.exactTests[0]));
  assert.throws(() => validateManifest(mutant, { repoRoot: REPO_ROOT }), /E_RCV01A_DUPLICATE_TEST_IDENTITY/u);
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

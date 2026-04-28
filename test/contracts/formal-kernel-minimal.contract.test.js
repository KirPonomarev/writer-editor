const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ARTIFACT_PATH = path.join(process.cwd(), 'docs', 'OPS', 'STATUS', 'FORMAL_KERNEL_MINIMAL_V1.json');
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'ops', 'formal-kernel-minimal-state.mjs');

function runState() {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });
}

test('formal kernel minimal artifact has exactly three bounded rows', () => {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.artifactId, 'FORMAL_KERNEL_MINIMAL_V1');
  assert.equal(artifact.authorityClass, 'OWNER_MAP_DIRECTION_UNDER_ACTIVE_CANON');
  assert.equal(artifact.blockingLaw, false);
  assert.ok(Array.isArray(artifact.items));
  assert.equal(artifact.items.length, 3);

  const ids = artifact.items.map((item) => item.invariantId).sort();
  assert.deepEqual(ids, [
    'EXPORT_SOURCE_CANONICAL',
    'RECOVERY_HUMAN_READABLE',
    'TEXT_NO_LOSS',
  ]);
});

test('formal kernel minimal state is green and deterministic', () => {
  const first = runState();
  assert.equal(first.status, 0, `first run failed:\n${first.stdout}\n${first.stderr}`);
  const firstPayload = JSON.parse(String(first.stdout || '{}'));
  assert.equal(firstPayload.toolVersion, 'formal-kernel-minimal-state.v1');
  assert.equal(firstPayload.FORMAL_KERNEL_MINIMAL_OK, 1);
  assert.deepEqual(firstPayload.missingInvariantIds, []);
  assert.deepEqual(firstPayload.unexpectedInvariantIds, []);

  const second = runState();
  assert.equal(second.status, 0, `second run failed:\n${second.stdout}\n${second.stderr}`);
  const secondPayload = JSON.parse(String(second.stdout || '{}'));

  assert.deepEqual(firstPayload, secondPayload);
});

test('formal kernel minimal promotes recovery human readable only through a detector-bound proof', () => {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const recoveryRow = artifact.items.find((item) => item.invariantId === 'RECOVERY_HUMAN_READABLE');
  assert.ok(recoveryRow);
  assert.equal(recoveryRow.bindingClass, 'detector_bound');
  assert.equal(recoveryRow.status, 'BOUND');
  assert.equal(recoveryRow.detectorToken, 'RECOVERY_HUMAN_READABLE_OK');
  assert.equal(recoveryRow.proofHook, 'node scripts/ops/recovery-io-state.mjs --json');
  assert.equal(recoveryRow.positiveContractRef, 'test/contracts/recovery-human-readable.contract.test.js');
});

test('formal kernel minimal promotes text no loss only through a detector-bound rollup proof', () => {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const textRow = artifact.items.find((item) => item.invariantId === 'TEXT_NO_LOSS');
  assert.ok(textRow);
  assert.equal(textRow.bindingClass, 'detector_bound');
  assert.equal(textRow.status, 'BOUND');
  assert.equal(textRow.detectorToken, 'TEXT_NO_LOSS_OK');
  assert.equal(textRow.proofHook, 'node scripts/ops/phase00-no-input-loss-rollup.mjs --json');
  assert.equal(textRow.positiveContractRef, 'test/contracts/phase00-no-input-loss-rollup.contract.test.js');
});

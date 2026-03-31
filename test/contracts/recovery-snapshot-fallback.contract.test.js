const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadIoModule() {
  const root = process.cwd();
  return import(pathToFileURL(path.join(root, 'src', 'io', 'markdown', 'index.mjs')).href);
}

test('recovery snapshot contract: corruption falls back to latest snapshot deterministically', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-snapshot-contract-'));
  const target = path.join(dir, 'scene.md');

  fs.writeFileSync(target, 'snapshot-stable-content\n', 'utf8');
  const snap = await io.createRecoverySnapshot(target, {
    maxSnapshots: 3,
    now: () => 1700000000000,
  });
  assert.equal(snap.snapshotCreated, true);

  fs.writeFileSync(target, Buffer.from([0x41, 0x00, 0x42]));

  const recovered = await io.readMarkdownWithRecovery(target, { maxInputBytes: 1024 * 1024 });
  assert.equal(recovered.recoveredFromSnapshot, true);
  assert.equal(recovered.sourceKind, 'snapshot');
  assert.equal(recovered.recoveryAction, 'OPEN_SNAPSHOT');
  assert.equal(recovered.snapshotPath, snap.snapshotPath);
  assert.equal(recovered.text, 'snapshot-stable-content\n');
  assert.equal(recovered.primaryError.code, 'E_IO_CORRUPT_INPUT');
  assert.equal(recovered.primaryError.reason, 'corrupt_input_null_byte');
});

test('recovery snapshot contract: missing snapshot is typed failure', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-snapshot-missing-contract-'));
  const target = path.join(dir, 'scene.md');

  fs.writeFileSync(target, Buffer.from([0x41, 0x00, 0x42]));

  await assert.rejects(
    io.readMarkdownWithRecovery(target),
    (error) => {
      assert.equal(error.code, 'E_IO_SNAPSHOT_MISSING');
      assert.equal(error.reason, 'snapshot_missing');
      assert.equal(error.details.recoveryAction, 'OPEN_SNAPSHOT');
      return true;
    },
  );
});

test('recovery snapshot contract: corrupted latest snapshot falls back to next valid snapshot deterministically', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-snapshot-rollover-contract-'));
  const target = path.join(dir, 'scene.md');

  fs.writeFileSync(target, 'snapshot-older\n', 'utf8');
  const olderSnapshot = await io.createRecoverySnapshot(target, {
    maxSnapshots: 3,
    now: () => 1700000000000,
  });

  fs.writeFileSync(target, 'snapshot-latest\n', 'utf8');
  const latestSnapshot = await io.createRecoverySnapshot(target, {
    maxSnapshots: 3,
    now: () => 1700000001000,
  });

  fs.writeFileSync(latestSnapshot.snapshotPath, Buffer.from([0x41, 0x00, 0x42]));
  fs.writeFileSync(target, Buffer.from([0x41, 0x00, 0x42]));

  const run1 = await io.readMarkdownWithRecovery(target, { maxInputBytes: 1024 * 1024 });
  const run2 = await io.readMarkdownWithRecovery(target, { maxInputBytes: 1024 * 1024 });

  assert.equal(run1.recoveredFromSnapshot, true);
  assert.equal(run1.snapshotPath, olderSnapshot.snapshotPath);
  assert.equal(run1.snapshotPath, run2.snapshotPath);
  assert.equal(run1.text, 'snapshot-older\n');
  assert.equal(run2.text, 'snapshot-older\n');
});

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

test('donor atomic recovery killpoint: pending intent blocks silent clean open and emits readable recovery pack', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'donor-atomic-killpoint-'));
  const target = path.join(dir, 'scene.md');
  fs.writeFileSync(target, 'stable-before\n', 'utf8');

  await assert.rejects(
    io.writeMarkdownWithTransactionRecovery(target, 'new-content\n', {
      now: () => 1700000000000,
      afterStage: ({ stage }) => {
        if (stage === 'SNAPSHOT_CREATED') {
          throw io.createMarkdownIoError('E_IO_TX_KILLPOINT_TRIGGERED', 'transaction_killpoint_triggered', { stage });
        }
      },
    }),
    (error) => {
      assert.equal(error.code, 'E_IO_TX_KILLPOINT_TRIGGERED');
      assert.equal(error.reason, 'transaction_killpoint_triggered');
      return true;
    },
  );

  assert.equal(fs.readFileSync(target, 'utf8'), 'stable-before\n');

  const pending = await io.readTransactionIntent(target);
  assert.ok(pending);
  assert.equal(pending.state, 'SNAPSHOT_CREATED');

  let recoveryPackPath = '';
  await assert.rejects(
    io.readMarkdownWithTransactionRecovery(target, { now: () => 1700000001000 }),
    (error) => {
      recoveryPackPath = error.details.recoveryPackPath;
      assert.equal(error.code, 'E_IO_STATE_AMBIGUOUS_AFTER_CRASH');
      assert.equal(error.reason, 'ambiguous_state_after_crash');
      assert.equal(error.details.recoveryAction, 'ABORT');
      assert.equal(error.details.intentPath, io.buildTransactionIntentPath(target));
      assert.ok(typeof recoveryPackPath === 'string' && recoveryPackPath.length > 0);
      return true;
    },
  );

  assert.equal(recoveryPackPath.startsWith(dir), false);
  const validation = await io.validateMarkdownRecoveryPack(recoveryPackPath);
  assert.equal(validation.ok, true);
  assert.equal(validation.manifest.recoveryAction, 'ABORT');
  assert.equal(validation.manifest.textHash, io.computeSha256Bytes(Buffer.from('stable-before\n', 'utf8')));

  const drill = await io.restoreMarkdownRecoveryDrill(recoveryPackPath);
  assert.equal(drill.ok, true);
});

test('donor atomic recovery killpoint: committed write does not stay permanently blocked by stale intent', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'donor-atomic-committed-'));
  const target = path.join(dir, 'scene.md');
  fs.writeFileSync(target, 'stable-before\n', 'utf8');

  await assert.rejects(
    io.writeMarkdownWithTransactionRecovery(target, 'stable-after\n', {
      now: () => 1700000001500,
      afterStage: ({ stage }) => {
        if (stage === 'WRITE_COMMITTED') {
          throw io.createMarkdownIoError('E_IO_TX_KILLPOINT_TRIGGERED', 'transaction_killpoint_triggered', { stage });
        }
      },
    }),
    (error) => {
      assert.equal(error.code, 'E_IO_TX_KILLPOINT_TRIGGERED');
      return true;
    },
  );

  const pending = await io.readTransactionIntent(target);
  assert.ok(pending);
  assert.equal(pending.state, 'WRITE_COMMITTED');
  assert.equal(fs.readFileSync(target, 'utf8'), 'stable-after\n');

  const reopened = await io.readMarkdownWithTransactionRecovery(target);
  assert.equal(reopened.text, 'stable-after\n');
  assert.equal(reopened.recoveredFromCommittedIntent, true);
  assert.equal(await io.readTransactionIntent(target), null);
});

test('donor atomic recovery killpoint: successful transaction clears intent and returns committed text', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'donor-atomic-success-'));
  const target = path.join(dir, 'scene.md');
  fs.writeFileSync(target, 'stable-before\n', 'utf8');

  const result = await io.writeMarkdownWithTransactionRecovery(target, 'stable-after\n', {
    now: () => 1700000002000,
  });

  assert.equal(result.transactionId.startsWith('tx_'), true);
  assert.equal(fs.readFileSync(target, 'utf8'), 'stable-after\n');
  assert.equal(await io.readTransactionIntent(target), null);

  const reopened = await io.readMarkdownWithTransactionRecovery(target);
  assert.equal(reopened.text, 'stable-after\n');
  assert.equal(reopened.recoveredFromSnapshot, false);
});

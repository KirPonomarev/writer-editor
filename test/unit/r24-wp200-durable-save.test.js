'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ACK_OUTCOMES } = require('../../src/core/autosave-generation-v1.cjs');
const { SAVE_ACK_KINDS } = require('../../src/core/dirty-admission-v1.cjs');
const { commitProjectTextAndManifest } = require('../../src/core/project-commit-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const {
  SaveReceiptAckError,
  bindSaveReceiptToAck,
  validateSaveReceipt,
} = require('../../src/core/save-receipt-ack-v1.cjs');

const sandbox = () => fs.mkdtempSync(path.join(os.tmpdir(), 'r24-wp200-'));
const sha256hex = (content) => crypto.createHash('sha256').update(content).digest('hex');

test('P2 receipt binds exact captured bytes and generation to a SAVED ack', async () => {
  const dir = sandbox();
  const content = 'Writer draft\nΣσς 👨‍👩‍👧‍👦';
  const receipt = await durableSaveTransaction({
    filePath: path.join(dir, 'scene.txt'),
    content,
    revision: 7,
  });

  const binding = bindSaveReceiptToAck({
    receipt,
    capturedContent: content,
    capturedGeneration: 7,
    latestEditGeneration: 7,
  });

  assert.equal(binding.receipt.receiptKind, 'DURABLE_SAVE_V1');
  assert.equal(binding.receipt.digest, sha256hex(content));
  assert.equal(binding.receipt.bytes, Buffer.byteLength(content, 'utf8'));
  assert.equal(binding.ack.kind, SAVE_ACK_KINDS.SAVED);
  assert.equal(binding.ack.savedGeneration, 7);
});

test('P3 project receipt is accepted only for its exact scene digest and revision', async () => {
  const dir = sandbox();
  const content = 'project scene';
  const receipt = await commitProjectTextAndManifest({
    scenePath: path.join(dir, 'scene.txt'),
    sceneContent: content,
    revision: 3,
    persistManifest: async () => ({ persisted: false }),
  });

  const binding = bindSaveReceiptToAck({
    receipt,
    capturedContent: content,
    capturedGeneration: 3,
    latestEditGeneration: 3,
  });
  assert.equal(binding.receipt.receiptKind, 'PROJECT_COMMIT_V1');
  assert.equal(binding.ack.kind, SAVE_ACK_KINDS.SAVED);
});

test('a valid durable receipt for a stale capture protects the newer generation', async () => {
  const content = 'captured generation';
  const receipt = await durableSaveTransaction({
    filePath: path.join(sandbox(), 'scene.txt'),
    content,
    revision: 4,
  });
  const binding = bindSaveReceiptToAck({
    receipt,
    capturedContent: content,
    capturedGeneration: 4,
    latestEditGeneration: 5,
  });
  assert.equal(binding.ack.kind, SAVE_ACK_KINDS.PROTECTED);
  assert.equal(binding.ack.reason, 'STALE_GENERATION');
  assert.notEqual(binding.ack.reason, ACK_OUTCOMES.CLEAR_DIRTY);
});

test('missing, failed, incomplete, stale, forged and byte-mismatched receipts fail closed', async (t) => {
  const content = 'exact bytes';
  const receipt = await durableSaveTransaction({
    filePath: path.join(sandbox(), 'scene.txt'),
    content,
    revision: 9,
  });
  const cases = [
    ['missing', null, 'E_SAVE_RECEIPT_REQUIRED'],
    ['failed', { ...receipt, success: false }, 'E_SAVE_RECEIPT_SUCCESS_REQUIRED'],
    ['incomplete phases', { ...receipt, phases: receipt.phases.slice(0, -1) }, 'E_SAVE_RECEIPT_PHASE_CHAIN_INVALID'],
    ['wrong revision', { ...receipt, revision: 8 }, 'E_SAVE_RECEIPT_REVISION_MISMATCH'],
    ['forged digest', { ...receipt, digest: '0'.repeat(64) }, 'E_SAVE_RECEIPT_DIGEST_MISMATCH'],
    ['wrong byte count', { ...receipt, bytes: receipt.bytes + 1 }, 'E_SAVE_RECEIPT_BYTES_MISMATCH'],
  ];

  for (const [name, candidate, code] of cases) {
    await t.test(name, () => {
      assert.throws(
        () => validateSaveReceipt({
          receipt: candidate,
          capturedContent: content,
          capturedGeneration: 9,
        }),
        (error) => error instanceof SaveReceiptAckError && error.code === code,
      );
    });
  }
});


// Actual generated-temp acquisition and cleanup; all owned fixtures are retained.
const ownershipFs = require('node:fs/promises');
function tempOwnershipSnapshot(filePath) {
  let stat;
  try { stat = fs.lstatSync(filePath, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return { exists: false }; throw error; }
  const raw = fs.readFileSync(filePath);
  return { exists: true, dev: String(stat.dev), ino: String(stat.ino), uid: String(stat.uid),
    mode: String(stat.mode), nlink: String(stat.nlink), size: String(stat.size),
    mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs),
    rawBase64: raw.toString('base64'), sha256: sha256hex(raw) };
}
function tempOwnershipFixture(t, scenario) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'r24-wp200-temp-owner-'));
  const owner = crypto.randomUUID(), marker = path.join(root, '.owner');
  fs.writeFileSync(marker, JSON.stringify({ owner, scenario }), { flag: 'wx' });
  const physical = fs.lstatSync(root), target = path.join(root, 'autosave.txt');
  fs.writeFileSync(target, Buffer.from('Protected incumbent e\u0301 🧭\n'), { flag: 'wx' });
  const fixture = { root, owner, marker, scenario, dev: physical.dev, ino: physical.ino, uid: physical.uid, target };
  t.diagnostic('R24_WP200_TEMP_OWNERSHIP_ROOT=' + JSON.stringify(fixture));
  return { fixture, before: tempOwnershipSnapshot(target) };
}
function tempOwnershipError(error) {
  return error ? { code: error.code, phase: error.phase, message: error.message } : null;
}
async function observeOccupiedTemporary(t, enforceExclusive) {
  const { fixture, before } = tempOwnershipFixture(t, enforceExclusive ? 'exclusive-open-cleanup' : 'incoming-flags');
  const foreign = Buffer.from('Foreign reserved temporary e\u0301 🧭\n');
  let temp, incomingFlags, openFlags, tempBefore, kernelError = null, error = null, receipt = null, publishCalls = 0;
  try {
    receipt = await durableSaveTransaction({ filePath: fixture.target, content: 'Replacement must be refused', revision: 11,
      fsAdapter: { ...ownershipFs, open: async (filePath, flags) => {
        assert.equal(path.dirname(filePath), fixture.root, 'generated temp stays inside this owned root');
        assert.match(path.basename(filePath), /^autosave\.txt\.p2-\d+-[a-f0-9]{12}\.tmp$/u);
        temp = filePath; incomingFlags = flags;
        fs.writeFileSync(temp, foreign, { flag: 'wx' }); tempBefore = tempOwnershipSnapshot(temp);
        try {
          openFlags = enforceExclusive
            ? fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW : flags;
          return await ownershipFs.open(temp, openFlags);
        } catch (failure) { kernelError = tempOwnershipError(failure); throw failure; }
      }, rename: async (from, to) => { publishCalls += 1; return ownershipFs.rename(from, to); } } });
  } catch (failure) { error = tempOwnershipError(failure); }
  const observed = { fixture, incomingFlags, openFlags, kernelError, error, receipt, publishCalls,
    targetBefore: before, targetAfter: tempOwnershipSnapshot(fixture.target), temp, tempBefore,
    tempAfter: temp ? tempOwnershipSnapshot(temp) : null, markerAfter: fs.readFileSync(fixture.marker, 'utf8') };
  t.diagnostic('R24_WP200_TEMP_OWNERSHIP_OBSERVATION=' + JSON.stringify(observed));
  return observed;
}

test('generated temporary uses incoming exclusive flags without truncating or publishing an occupied file', async (t) => {
  const observed = await observeOccupiedTemporary(t, false);
  assert.equal(observed.incomingFlags, 'wx');
  assert.equal(observed.kernelError?.code, 'EEXIST', 'genuine filesystem collision, not an injected open error');
  assert.equal(observed.error?.code, 'E_SAVE_TEMP_WRITE');
  assert.equal(observed.error?.phase, 'TEMP_WRITE');
  assert.equal(observed.receipt, null, 'a collision cannot produce a successful receipt');
  assert.equal(observed.publishCalls, 0);
  assert.deepEqual(observed.tempAfter, observed.tempBefore, 'foreign raw bytes and physical identity survive');
  assert.deepEqual(observed.targetAfter, observed.targetBefore, 'the incumbent remains physically and byte exact');
  assert.equal(JSON.parse(observed.markerAfter).owner, observed.fixture.owner);
});

test('genuine exclusive no-follow EEXIST never grants cleanup of the occupied temporary', async (t) => {
  const observed = await observeOccupiedTemporary(t, true);
  assert.ok(Number.isInteger(fs.constants.O_NOFOLLOW));
  assert.equal(observed.openFlags, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW);
  assert.equal(observed.kernelError?.code, 'EEXIST');
  assert.equal(observed.error?.code, 'E_SAVE_TEMP_WRITE');
  assert.equal(observed.error?.phase, 'TEMP_WRITE');
  assert.equal(observed.receipt, null);
  assert.equal(observed.publishCalls, 0);
  assert.deepEqual(observed.tempAfter, observed.tempBefore, 'Core must not unlink a file it never acquired');
  assert.deepEqual(observed.targetAfter, observed.targetBefore);
  assert.equal(JSON.parse(observed.markerAfter).owner, observed.fixture.owner);
});

test('an acquired real handle closes before only-owned cleanup after a partial write and ENOSPC', async (t) => {
  const { fixture, before } = tempOwnershipFixture(t, 'owned-handle-write-failure');
  const partial = Buffer.from('Owned e\u0301 🧭');
  let temp, incomingFlags, handle, acquiredFd, partialSnapshot, closeObservation = null;
  let closeCalls = 0, publishCalls = 0, receipt = null, error = null;
  try {
    try {
      receipt = await durableSaveTransaction({ filePath: fixture.target, content: 'Uncommitted complete payload', revision: 12,
        fsAdapter: { ...ownershipFs, open: async (filePath, flags) => {
          assert.equal(path.dirname(filePath), fixture.root);
          assert.match(path.basename(filePath), /^autosave\.txt\.p2-\d+-[a-f0-9]{12}\.tmp$/u);
          temp = filePath; incomingFlags = flags; handle = await ownershipFs.open(temp, flags); acquiredFd = handle.fd;
          return { writeFile: async () => {
            await handle.writeFile(partial); partialSnapshot = tempOwnershipSnapshot(temp);
            throw Object.assign(new Error('controlled ENOSPC after a real owned partial write'), { code: 'ENOSPC' });
          }, sync: () => handle.sync(), close: async () => {
            closeCalls += 1;
            closeObservation = { fdBefore: handle.fd, tempAtClose: tempOwnershipSnapshot(temp) };
            await handle.close(); closeObservation.fdAfter = handle.fd;
          } };
        }, rename: async (from, to) => { publishCalls += 1; return ownershipFs.rename(from, to); } } });
    } catch (failure) { error = tempOwnershipError(failure); }
    const observed = { fixture, incomingFlags, acquiredFd, partialSnapshot, closeCalls, closeObservation,
      fdAfterCore: handle?.fd, temp, tempAfter: temp ? tempOwnershipSnapshot(temp) : null,
      targetBefore: before, targetAfter: tempOwnershipSnapshot(fixture.target), error, receipt, publishCalls,
      markerAfter: fs.readFileSync(fixture.marker, 'utf8') };
    t.diagnostic('R24_WP200_TEMP_OWNERSHIP_OBSERVATION=' + JSON.stringify(observed));
    assert.equal(observed.error?.code, 'E_SAVE_TEMP_WRITE');
    assert.equal(observed.error?.phase, 'TEMP_WRITE');
    assert.match(observed.error?.message || '', /ENOSPC/);
    assert.equal(observed.receipt, null);
    assert.equal(observed.publishCalls, 0);
    assert.ok(Number.isInteger(observed.acquiredFd) && observed.acquiredFd >= 0, 'the real handle was acquired');
    assert.equal(observed.partialSnapshot?.rawBase64, partial.toString('base64'), 'the owned partial write really occurred');
    assert.equal(observed.closeCalls, 1, 'Core itself closes the acquired handle exactly once');
    assert.equal(observed.closeObservation?.fdBefore, observed.acquiredFd);
    assert.deepEqual(observed.closeObservation?.tempAtClose, observed.partialSnapshot, 'the owned path exists when Core closes');
    assert.equal(observed.closeObservation?.fdAfter, -1, 'the genuine FileHandle is closed');
    assert.equal(observed.fdAfterCore, -1);
    assert.deepEqual(observed.tempAfter, { exists: false }, 'only its own prepared temporary is removed');
    assert.deepEqual(observed.targetAfter, observed.targetBefore);
    assert.equal(JSON.parse(observed.markerAfter).owner, observed.fixture.owner);
  } finally {
    // Resource fencing only: this bypasses the observer, after its actual record and assertions.
    if (handle && handle.fd >= 0) await handle.close();
  }
});

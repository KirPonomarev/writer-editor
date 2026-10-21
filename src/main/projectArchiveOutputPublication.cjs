'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertNoFollowComponents } = require('../core/io/path-capability-v1.cjs');
const sameObject = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;
const sameVersion = (a, b) => sameObject(a, b) && ['size','mtimeNs','ctimeNs','nlink'].every(k => a[k] === b[k]);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const failure = (code, state) => Object.assign(new Error(code), { code, reason: code.toLowerCase(), details: { publication: { ...state } } });
async function optionalStat(port, target) {
  try { return await port.lstat(target, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// ArchiveOutputPort: no change to shared DOCX/PDF writers. A published name
// is never removed because a later sync/readback/cancellation failed.
async function publishProjectArchiveOutput({ outPath, buffer, assertCurrent = async () => {}, signal, fsPort = fs }) {
  const bytes = Buffer.from(buffer), expectedDigest = sha(bytes);
  const state = { phase: 'ADMIT', bufferVerified: true, namePublished: false, publicationOutcome: 'NOT_STARTED',
    fileSynced: false, directorySynced: false, readbackVerified: false, physicalPowerLossVerified: false };
  let tempPath, tempIdentity, handle, publishedPath, parentIdentity, directory, outgoingError;
  const guard = async () => {
    if (signal?.aborted) throw failure('E_PROJECT_ARCHIVE_EXPORT_CANCELLED', state);
    await assertCurrent();
    if (directory) {
      assertNoFollowComponents(directory);
      if (!sameObject(parentIdentity, await fsPort.lstat(directory, { bigint: true }))) throw failure('E_PROJECT_ARCHIVE_OUTPUT_PARENT_CHANGED', state);
    }
  };
  const readExact = async (target, expectedIdentity) => {
    const reader = await fsPort.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    try {
      const before = await reader.stat({ bigint: true });
      if (!before.isFile() || !sameObject(before, expectedIdentity) || before.size !== BigInt(bytes.length)) throw failure('E_PROJECT_ARCHIVE_OUTPUT_READBACK_MISMATCH', state);
      const actual = await reader.readFile();
      if (!sameVersion(before, await reader.stat({ bigint: true }))
        || !sameObject(before, await fsPort.lstat(target, { bigint: true }))
        || !actual.equals(bytes) || sha(actual) !== expectedDigest) throw failure('E_PROJECT_ARCHIVE_OUTPUT_READBACK_MISMATCH', state);
    } finally { await reader.close(); }
  };
  try {
    await guard();
    directory = await fsPort.realpath(path.dirname(outPath));
    parentIdentity = await fsPort.lstat(directory, { bigint: true });
    if (!parentIdentity.isDirectory() || parentIdentity.isSymbolicLink()) throw failure('E_PROJECT_ARCHIVE_OUTPUT_PARENT_INVALID', state);
    publishedPath = path.join(directory, path.basename(outPath));
    const previous = await optionalStat(fsPort, publishedPath);
    if (previous && (!previous.isFile() || previous.isSymbolicLink() || previous.nlink !== 1n)) throw failure('E_PROJECT_ARCHIVE_OUTPUT_TARGET_INVALID', state);
    tempPath = path.join(directory, `.${path.basename(outPath)}.archive-${crypto.randomUUID()}.tmp`);
    await guard(); state.phase = 'TEMP_WRITE';
    handle = await fsPort.open(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
    tempIdentity = await handle.stat({ bigint: true });
    await handle.writeFile(bytes);
    state.phase = 'FILE_SYNC'; await handle.sync(); state.fileSynced = true;
    await handle.close(); handle = null;
    state.phase = 'STAGING_READBACK'; await readExact(tempPath, tempIdentity);
    await guard();
    const current = await optionalStat(fsPort, publishedPath);
    if (previous ? !sameVersion(previous, current) : current !== null) throw failure('E_PROJECT_ARCHIVE_OUTPUT_TARGET_CHANGED', state);
    state.phase = 'PUBLICATION'; state.publicationOutcome = 'IN_FLIGHT';
    try {
      // A new file is published with atomic create-only link. Replacement is
      // reserved for the already selected existing output, never an absent one.
      if (previous) await fsPort.rename(tempPath, publishedPath);
      else await fsPort.link(tempPath, publishedPath);
      state.namePublished = true; state.publicationOutcome = 'PUBLISHED';
    } catch (error) {
      const observed = await optionalStat(fsPort, publishedPath).catch(() => null);
      if (sameObject(observed, tempIdentity)) {
        state.namePublished = true; state.publicationOutcome = 'PUBLISHED_RECONCILED';
      } else {
        state.publicationOutcome = ['EEXIST','ENOENT','EACCES','EPERM','ENOTDIR','EXDEV'].includes(error.code) ? 'REFUSED' : 'UNKNOWN';
        throw error;
      }
    }
    // Cancellation after publication cannot undo the observed useful object.
    state.phase = 'DIRECTORY_SYNC';
    const parent = await fsPort.open(directory, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      if (!sameObject(parentIdentity, await parent.stat({ bigint: true }))) throw failure('E_PROJECT_ARCHIVE_OUTPUT_PARENT_CHANGED', state);
      await parent.sync(); state.directorySynced = true;
    } finally { await parent.close(); }
    state.phase = 'FINAL_READBACK'; await readExact(publishedPath, tempIdentity);
    if (!sameObject(parentIdentity, await fsPort.lstat(directory, { bigint: true }))) throw failure('E_PROJECT_ARCHIVE_OUTPUT_PARENT_CHANGED', state);
    state.readbackVerified = true; state.phase = 'VERIFIED';
    Object.assign(state, { lateCancel: signal?.aborted === true, durabilityProfile: 'FILE_FSYNC_PARENT_FSYNC_SAME_OBJECT_FULL_READBACK' });
    return { ok: true, archiveSha256: expectedDigest, bytesWritten: bytes.length, publication: state };
  } catch (error) {
    const code = error.code?.startsWith('E_PROJECT_ARCHIVE_') ? error.code : 'E_PROJECT_ARCHIVE_OUTPUT_FAILED';
    outgoingError = Object.assign(failure(code, state), { cause: error });
    throw outgoingError;
  } finally {
    state.cleanup = 'NO_OWNED_STAGING';
    if (handle) {
      try { await handle.close(); state.handleCloseConfirmed = true; }
      catch { state.handleCloseConfirmed = false; state.cleanup = 'HANDLE_CLOSE_UNCONFIRMED'; }
    }
    if (tempPath && tempIdentity && state.publicationOutcome !== 'UNKNOWN') {
      // Never follow or recursively remove an entry merely because its name
      // resembles staging. Final name is outside this cleanup path.
      try {
        const own = await optionalStat(fsPort, tempPath);
        if (sameObject(own, tempIdentity)) {
          await fsPort.unlink(tempPath); state.cleanup = 'OWNED_STAGING_REMOVED';
        } else if (own) state.cleanup = 'STAGING_OWNERSHIP_UNCONFIRMED';
      } catch { state.cleanup = 'OWNED_STAGING_RETAINED'; }
    }
    if (state.publicationOutcome === 'UNKNOWN') state.cleanup = 'UNKNOWN_PUBLICATION_STAGING_RETAINED';
    if (outgoingError) outgoingError.details.publication = { ...state };
  }
}
module.exports = { publishProjectArchiveOutput };

'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const { constants } = require('node:fs');
const { assertNoFollowComponents } = require('../core/io/path-capability-v1.cjs');
const same = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;
const fail = (code, publication = {}) => Object.assign(new Error(code), { code, reason: code.toLowerCase(),
  details: { publication } });
const identity = stat => ({ dev: String(stat.dev), ino: String(stat.ino) });
async function observe(target) {
  try { return await fs.lstat(target, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function defaultHelperPath({ isPackaged = process.versions.electron && process.type === 'browser'
  ? require('electron').app.isPackaged === true : false, resourcesPath = process.resourcesPath } = {}) {
  return isPackaged
    ? path.join(resourcesPath, 'yalken-native', 'project-archive-fs')
    : path.join(__dirname, '..', '..', 'dist', 'native', 'project-archive-fs');
}
// Only trusted Main/test code constructs this port. No IPC or environment
// payload selects a binary, command, flags or arbitrary process interface.
function createDarwinPublisher({ helperPath = defaultHelperPath(), platform = process.platform } = {}, regularFile = false, capabilityOnly = false) {
  return async ({ tempRoot, targetRoot, parentIdentity, stagingIdentity, assertCurrent = async () => {} }) => {
    if (platform !== 'darwin') throw fail('E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE');
    const parent = path.dirname(targetRoot);
    if (!path.isAbsolute(helperPath) || !path.isAbsolute(parent) || !capabilityOnly && (path.dirname(tempRoot) !== parent
      || path.basename(tempRoot) === path.basename(targetRoot))) throw fail('E_PROJECT_ARCHIVE_DIRECTORY_INPUT_INVALID');
    await assertCurrent(); assertNoFollowComponents(parent); assertNoFollowComponents(helperPath);
    const actualParent = await observe(parent), actualStage = capabilityOnly ? null : await observe(tempRoot), binary = await observe(helperPath);
    if (!same(parentIdentity, actualParent) || !actualParent?.isDirectory() || actualParent.isSymbolicLink()
      || !capabilityOnly && (!same(stagingIdentity, actualStage) || !(regularFile ? actualStage?.isFile() : actualStage?.isDirectory()) || actualStage.isSymbolicLink()
      || regularFile && (actualStage.nlink !== 1n || actualStage.size > 8n * 1024n * 1024n)
      || actualStage.dev !== actualParent.dev)) throw fail('E_PROJECT_ARCHIVE_DIRECTORY_IDENTITY_CHANGED');
    if (!binary?.isFile() || binary.isSymbolicLink() || binary.nlink !== 1n || binary.size > 8n * 1024n * 1024n || (binary.mode & 0o111n) === 0n) {
      throw fail('E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE');
    }
    const helperSha256 = crypto.createHash('sha256').update(await fs.readFile(helperPath)).digest('hex');
    const args = capabilityOnly ? ['--regular-file-capability', parent, String(parentIdentity.dev), String(parentIdentity.ino)]
      : [parent, path.basename(tempRoot), path.basename(targetRoot),
      ...[parentIdentity.dev, parentIdentity.ino, stagingIdentity.dev, stagingIdentity.ino].map(String)];
    if (regularFile && !capabilityOnly) args.unshift('--regular-file');
    let output = '', diagnosticBytes = 0, processError = null;
    const exit = await new Promise(resolve => {
      let child;
      try { child = spawn(helperPath, args, { shell: false, windowsHide: true, stdio: ['ignore','pipe','pipe'],
        env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' } }); }
      catch (error) { processError = error; resolve(null); return; }
      // A timed-out process remains owned until its actual close event.
      const timeout = setTimeout(() => { processError = Error('ARCHIVE_NATIVE_TIMEOUT'); child.kill('SIGKILL'); }, 10000);
      child.stdout.on('data', chunk => {
        if (Buffer.byteLength(output) + chunk.length > 4096) { processError = Error('ARCHIVE_NATIVE_OUTPUT_BOUND'); child.kill('SIGKILL'); }
        else output += chunk.toString('utf8');
      });
      child.stderr.on('data', chunk => { diagnosticBytes += chunk.length;
        if (diagnosticBytes > 4096) { processError = Error('ARCHIVE_NATIVE_DIAGNOSTIC_BOUND'); child.kill('SIGKILL'); } });
      child.once('error', error => { processError = error; });
      child.once('close', code => { clearTimeout(timeout); resolve(code); });
    });
    let result;
    try { result = JSON.parse(output); } catch { result = null; }
    const final = capabilityOnly ? null : await observe(targetRoot).catch(() => null);
    const ownedFinal = Boolean(same(stagingIdentity, final) && (regularFile ? final.isFile() : final.isDirectory()) && !final.isSymbolicLink());
    const validResult = result && Object.keys(result).sort().join(',') === 'directorySynced,errno,namePublished,ok,phase,schemaVersion'
      && result.schemaVersion === 1 && typeof result.ok === 'boolean' && typeof result.namePublished === 'boolean'
      && typeof result.directorySynced === 'boolean' && Number.isInteger(result.errno) && typeof result.phase === 'string';
    const observedPublished = Boolean(validResult && result.namePublished);
    const knownRefusal = validResult && !observedPublished && (['INPUT','PARENT_OPEN','PARENT_IDENTITY','SOURCE_IDENTITY'].includes(result.phase)
      || result.phase === 'PUBLICATION' && [17,2,13,1,20,18].includes(result.errno));
    const receipt = { phase: validResult ? result.phase : 'RECONCILIATION', namePublished: observedPublished || ownedFinal,
      finalIdentityObserved: ownedFinal,
      publicationOutcome: ownedFinal ? 'PUBLISHED' : observedPublished ? 'PUBLISHED_UNVERIFIED' : knownRefusal ? 'REFUSED' : 'UNKNOWN',
      directorySynced: result?.directorySynced === true && ownedFinal,
      parentIdentity: identity(parentIdentity), ...(!capabilityOnly ? { stagingIdentity: identity(stagingIdentity) } : {}),
      helperSha256,
      ...(regularFile ? { nativeErrno: validResult ? result.errno : null, nativeExitCode: exit } : {}),
      physicalPowerLossVerified: false };
    let binaryStable = false, parentStable = false;
    try {
      const binaryAfter = await observe(helperPath);
      binaryStable = same(binary, binaryAfter) && ['size','mtimeNs','ctimeNs','nlink'].every(k => binary[k] === binaryAfter[k])
        && helperSha256 === crypto.createHash('sha256').update(await fs.readFile(helperPath)).digest('hex');
      parentStable = same(parentIdentity, await observe(parent));
    } catch { /* Observed publication remains recorded when observation fails. */ }
    if (capabilityOnly) {
      await assertCurrent(); assertNoFollowComponents(parent);
      if (processError || exit !== 0 || !validResult || result.ok !== true || result.phase !== 'CAPABILITY_AVAILABLE'
        || result.errno !== 0 || result.namePublished || result.directorySynced || !binaryStable || !parentStable
        || !same(parentIdentity, await observe(parent))) throw fail('E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE', receipt);
      return { available: true, readOnly: true, parentIdentity: identity(parentIdentity), helperSha256 };
    }
    if (processError || exit !== 0 || !validResult || result.ok !== true
      || !result.namePublished || !result.directorySynced || !ownedFinal
      || !parentStable || !binaryStable) {
      const code = validResult && [45,78].includes(result.errno) ? 'E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE'
        : result?.errno === 17 ? 'E_PROJECT_ARCHIVE_IMPORT_TARGET_EXISTS' : 'E_PROJECT_ARCHIVE_DIRECTORY_PUBLICATION_FAILED';
      throw fail(code, receipt);
    }
    return receipt;
  };
}
function createProjectArchiveDarwinPublisher(options = {}) { return createDarwinPublisher(options); }

// ExternalArtifactExclusivePublicationPort. The reserved source remains intact;
// only this invocation's synced sibling copy can be consumed by RENAME_EXCL.
function createDarwinExclusiveFilePublisher(options = {}) {
  const publish = createDarwinPublisher(options, true);
  const capability = createDarwinPublisher(options, true, true);
  const publishFile = async ({ sourcePath, targetPath, assertCurrent = async () => {} }) => {
    if ((options.platform || process.platform) !== 'darwin') throw fail('E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE');
    const parent = path.dirname(targetPath);
    if (!path.isAbsolute(sourcePath) || !path.isAbsolute(targetPath) || path.dirname(sourcePath) !== parent
      || sourcePath === targetPath) throw fail('E_STAGE10_FILE_PUBLICATION_INPUT_INVALID');
    await assertCurrent(); assertNoFollowComponents(parent); assertNoFollowComponents(sourcePath);
    const parentIdentity = await observe(parent), sourceIdentity = await observe(sourcePath);
    if (!parentIdentity?.isDirectory() || !sourceIdentity?.isFile() || sourceIdentity.isSymbolicLink()
      || sourceIdentity.dev !== parentIdentity.dev || sourceIdentity.size > 8n * 1024n * 1024n) throw fail('E_STAGE10_FILE_SOURCE_INVALID');
    await publishFile.assertAvailable({ targetPath, assertCurrent });
    const stable = (a, b) => same(a, b) && ['size', 'mtimeNs', 'ctimeNs', 'nlink'].every(k => a[k] === b[k]);
    const readBounded = async (file, expected) => {
      const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat({ bigint: true });
        if (!stat.isFile() || stat.size > 8n * 1024n * 1024n || !stable(expected, stat)) throw fail('E_STAGE10_FILE_SOURCE_CHANGED');
        const buffer = Buffer.alloc(Number(stat.size) + 1); let offset = 0;
        while (offset < buffer.length) {
          const result = await handle.read(buffer, offset, buffer.length - offset, offset);
          if (!result.bytesRead) break;
          offset += result.bytesRead;
        }
        if (offset !== Number(stat.size) || !stable(stat, await handle.stat({ bigint: true }))
          || !stable(stat, await observe(file))) throw fail('E_STAGE10_FILE_SOURCE_CHANGED');
        return buffer.subarray(0, offset);
      } finally { await handle.close(); }
    };
    let source, staged, stagingIdentity, stagePath, bytes, receipt;
    try {
      source = await fs.open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!stable(sourceIdentity, await source.stat({ bigint: true }))) throw fail('E_STAGE10_FILE_SOURCE_CHANGED');
      bytes = Buffer.alloc(Number(sourceIdentity.size) + 1);
      let offset = 0;
      while (offset < bytes.length) {
        const read = await source.read(bytes, offset, bytes.length - offset, offset);
        if (!read.bytesRead) break;
        offset += read.bytesRead;
      }
      if (offset !== Number(sourceIdentity.size) || !stable(sourceIdentity, await source.stat({ bigint: true }))
        || !stable(sourceIdentity, await observe(sourcePath))) throw fail('E_STAGE10_FILE_SOURCE_CHANGED');
      bytes = bytes.subarray(0, offset);
      stagePath = path.join(parent, `.stage10-publish-${crypto.randomUUID()}`);
      staged = await fs.open(stagePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      await staged.writeFile(bytes); await staged.sync();
      stagingIdentity = await staged.stat({ bigint: true });
      await staged.close(); staged = null;
      const assertBound = async () => {
        await assertCurrent(); assertNoFollowComponents(parent); assertNoFollowComponents(sourcePath);
        if (!same(parentIdentity, await observe(parent)) || !stable(sourceIdentity, await observe(sourcePath))
          || !stable(stagingIdentity, await observe(stagePath))
          || !bytes.equals(await readBounded(stagePath, stagingIdentity))) throw fail('E_STAGE10_FILE_SOURCE_CHANGED');
      };
      receipt = await publish({ tempRoot: stagePath, targetRoot: targetPath, parentIdentity, stagingIdentity, assertCurrent: assertBound });
      try {
        // Rename changes ctime on APFS. Bind the newly observed final metadata
        // only after confirming it is the exact staged inode and size.
        const final = await observe(targetPath);
        if (!same(stagingIdentity, final) || final.size !== stagingIdentity.size || final.nlink !== 1n
          || !stable(sourceIdentity, await observe(sourcePath)) || !bytes.equals(await readBounded(targetPath, final))) throw Error('READBACK');
      } catch {
        throw fail('E_STAGE10_FILE_PUBLICATION_READBACK_FAILED', { ...receipt, publicationOutcome: 'PUBLISHED_UNVERIFIED' });
      }
      return receipt;
    } catch (error) {
      // Unknown native outcomes are retained. Known refusal or pre-spawn failure
      // may remove only this still-identical unpublished copy.
      const publication = error.details?.publication;
      if (stagePath && stagingIdentity && (!publication?.publicationOutcome || publication.publicationOutcome === 'REFUSED')) {
        const actual = await observe(stagePath).catch(() => null);
        if (stable(stagingIdentity, actual) && bytes.equals(await readBounded(stagePath, stagingIdentity))) await fs.unlink(stagePath);
      }
      if (error.code === 'E_PROJECT_ARCHIVE_IMPORT_TARGET_EXISTS') error.code = 'EEXIST';
      throw error;
    } finally { await source?.close(); await staged?.close(); }
  };
  publishFile.assertAvailable = async ({ targetPath, assertCurrent = async () => {} }) => {
    if ((options.platform || process.platform) !== 'darwin') throw fail('E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE');
    if (!path.isAbsolute(targetPath)) throw fail('E_STAGE10_FILE_PUBLICATION_INPUT_INVALID');
    const parent = path.dirname(targetPath);
    await assertCurrent(); assertNoFollowComponents(parent);
    return capability({ targetRoot: targetPath, parentIdentity: await observe(parent), assertCurrent });
  };
  return publishFile;
}
module.exports = { createProjectArchiveDarwinPublisher, createDarwinExclusiveFilePublisher, defaultHelperPath };

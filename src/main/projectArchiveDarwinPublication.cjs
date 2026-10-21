'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
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
function createProjectArchiveDarwinPublisher({ helperPath = defaultHelperPath(), platform = process.platform } = {}) {
  return async ({ tempRoot, targetRoot, parentIdentity, stagingIdentity, assertCurrent = async () => {} }) => {
    if (platform !== 'darwin') throw fail('E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE');
    const parent = path.dirname(targetRoot);
    if (!path.isAbsolute(helperPath) || !path.isAbsolute(parent) || path.dirname(tempRoot) !== parent
      || path.basename(tempRoot) === path.basename(targetRoot)) throw fail('E_PROJECT_ARCHIVE_DIRECTORY_INPUT_INVALID');
    await assertCurrent(); assertNoFollowComponents(parent); assertNoFollowComponents(helperPath);
    const actualParent = await observe(parent), actualStage = await observe(tempRoot), binary = await observe(helperPath);
    if (!same(parentIdentity, actualParent) || !actualParent?.isDirectory() || actualParent.isSymbolicLink()
      || !same(stagingIdentity, actualStage) || !actualStage?.isDirectory() || actualStage.isSymbolicLink()
      || actualStage.dev !== actualParent.dev) throw fail('E_PROJECT_ARCHIVE_DIRECTORY_IDENTITY_CHANGED');
    if (!binary?.isFile() || binary.isSymbolicLink() || binary.nlink !== 1n || binary.size > 8n * 1024n * 1024n || (binary.mode & 0o111n) === 0n) {
      throw fail('E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE');
    }
    const helperSha256 = crypto.createHash('sha256').update(await fs.readFile(helperPath)).digest('hex');
    const args = [parent, path.basename(tempRoot), path.basename(targetRoot),
      ...[parentIdentity.dev, parentIdentity.ino, stagingIdentity.dev, stagingIdentity.ino].map(String)];
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
    const final = await observe(targetRoot).catch(() => null);
    const ownedFinal = Boolean(same(stagingIdentity, final) && final.isDirectory() && !final.isSymbolicLink());
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
      parentIdentity: identity(parentIdentity), stagingIdentity: identity(stagingIdentity),
      helperSha256,
      physicalPowerLossVerified: false };
    let binaryStable = false, parentStable = false;
    try {
      const binaryAfter = await observe(helperPath);
      binaryStable = same(binary, binaryAfter) && ['size','mtimeNs','ctimeNs','nlink'].every(k => binary[k] === binaryAfter[k])
        && helperSha256 === crypto.createHash('sha256').update(await fs.readFile(helperPath)).digest('hex');
      parentStable = same(parentIdentity, await observe(parent));
    } catch { /* Observed publication remains recorded when observation fails. */ }
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
module.exports = { createProjectArchiveDarwinPublisher, defaultHelperPath };

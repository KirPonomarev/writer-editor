'use strict';
// Main-process ReviewSecretStorePort adapter. No renderer/project/DOCX writer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 16384;
const SCHEMA = 'yalken.review-secret.local.v1';
const STATES = ['ACTIVE', 'VERIFY_ONLY', 'REVOKED', 'LOST'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function fail(code) { throw new Error(`RTK_SECRET_STORE_${code}`); }
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || Object.keys(entry).sort().join(',') !== 'createdAt,keyIdHex,roundIdHex,secret,state'
    || typeof entry.secret !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.secret)
    || !/^[a-f0-9]{32}$/u.test(entry.roundIdHex) || !STATES.includes(entry.state)
    || entry.keyIdHex !== digest(entry.secret).slice(0,32)
    || typeof entry.createdAt !== 'string' || entry.createdAt.length > 40
    || !Number.isFinite(Date.parse(entry.createdAt))) fail('ENTRY_INVALID');
  return entry;
}
function createReviewSecretStore({ userDataRoot, projectRoot, safeStorage, platform = process.platform }) {
  if (!path.isAbsolute(userDataRoot || '') || !path.isAbsolute(projectRoot || '')) fail('ROOT_INVALID');
  const base = fs.realpathSync(userDataRoot);
  const projectBinding = digest(fs.realpathSync(projectRoot));
  function encryption() {
    if (!safeStorage || safeStorage.isEncryptionAvailable?.() !== true
      || typeof safeStorage.encryptString !== 'function' || typeof safeStorage.decryptString !== 'function'
      || (platform === 'linux' && !['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(safeStorage.getSelectedStorageBackend?.()))) fail('ENCRYPTION_UNAVAILABLE');
  }
  function directory(create) {
    let parent = base;
    for (const name of ['review-round-keys-v1', projectBinding]) {
      const target = path.join(parent,name);
      if (create) { try { fs.mkdirSync(target,{mode:0o700}); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
      let stat;
      try { stat=fs.lstatSync(target); } catch (e) { if (!create && e.code === 'ENOENT') return null; throw e; }
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target
        || (platform !== 'win32' && (stat.mode & 0o077) !== 0)) fail('DIRECTORY_UNSAFE');
      parent=target;
    }
    return parent;
  }
  function fileName(ref, create) {
    if (typeof ref !== 'string' || !/^[a-f0-9]{64}$/u.test(ref)) fail('KEY_REF_INVALID');
    const dir=directory(create); return dir && path.join(dir,`${ref}.key`);
  }
  function read(ref) {
    encryption();
    const file=fileName(ref,false); if (!file) return null;
    let fd;
    try { fd=fs.openSync(file,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)); }
    catch (e) { if (e.code === 'ENOENT') return null; fail('READ_FAILED'); }
    try {
      const stat=fs.fstatSync(fd), link=fs.lstatSync(file);
      if (!stat.isFile() || link.isSymbolicLink() || stat.nlink !== 1 || stat.size <= 0 || stat.size > MAX_BYTES
        || stat.ino !== link.ino || stat.dev !== link.dev || (platform !== 'win32' && (stat.mode & 0o077) !== 0)) fail('FILE_UNSAFE');
      const bytes=Buffer.alloc(stat.size+1); const length=fs.readSync(fd,bytes,0,bytes.length,0);
      if (length !== stat.size) fail('SIZE_CHANGED');
      let record;
      try { record=JSON.parse(safeStorage.decryptString(bytes.subarray(0,length))); } catch { fail('DECRYPT_FAILED'); }
      if (record?.schemaVersion !== SCHEMA || record.projectBinding !== projectBinding || record.keyRef !== ref) fail('IDENTITY_MISMATCH');
      return validateEntry(record.entry);
    } finally { fs.closeSync(fd); }
  }
  function write(ref, input) {
    encryption();
    const entry=validateEntry(input), file=fileName(ref,true), prior=read(ref);
    if (prior && (prior.keyIdHex !== entry.keyIdHex || prior.roundIdHex !== entry.roundIdHex
      || prior.createdAt !== entry.createdAt || STATES.indexOf(entry.state) < STATES.indexOf(prior.state))) fail('STATE_CONFLICT');
    const bytes=safeStorage.encryptString(JSON.stringify({schemaVersion:SCHEMA,projectBinding,keyRef:ref,entry}));
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) fail('CIPHERTEXT_INVALID');
    const parent=path.dirname(file), before=fs.lstatSync(parent);
    const temp=path.join(parent,`.${crypto.randomBytes(16).toString('hex')}.tmp`);
    let fd;
    try {
      fd=fs.openSync(temp,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW||0),0o600);
      fs.writeFileSync(fd,bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd=undefined;
      const after=fs.lstatSync(parent);
      if (after.isSymbolicLink() || before.ino !== after.ino || before.dev !== after.dev || fs.realpathSync(parent) !== parent) fail('DIRECTORY_CHANGED');
      fs.renameSync(temp,file);
      if (platform !== 'win32') { const dir=fs.openSync(parent,fs.constants.O_RDONLY);try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);} }
      const reopened=read(ref);
      if (JSON.stringify(reopened) !== JSON.stringify(entry)) fail('READBACK_FAILED');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try { fs.unlinkSync(temp); } catch(e) { if(e.code !== 'ENOENT') throw e; }
    }
  }
  return Object.freeze({read,write,projectBinding});
}
module.exports={createReviewSecretStore};

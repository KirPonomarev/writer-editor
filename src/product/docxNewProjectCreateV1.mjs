import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { prepareDocxNewProject } from '../core/docx-new-project-v1.mjs';
import { sha256Hex } from '../core/browser-safe-hash.mjs';

const need = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
const same = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;
const absent = async target => { try { await fs.lstat(target); return false; } catch (e) { if (e.code === 'ENOENT') return true; throw e; } };
async function syncDirectory(target) {
  const handle = await fs.open(target, 'r');
  try { await handle.sync(); } catch (e) { if (!['EINVAL', 'EPERM', 'EISDIR'].includes(e.code)) throw e; }
  finally { await handle.close(); }
}

// ProjectPersistencePort.createFromDocx: the manifest is the sole visibility point.
// ownership is a private Main reservation; no renderer payload can supply it.
export async function createDocxNewProject({ plan, identity, parentDirectoryPath, transactionAuthority,
  assertPublication, ownership, initialDirectories = [] }) {
  need(typeof assertPublication === 'function' && ownership && typeof ownership === 'object'
    && transactionAuthority?.withProjectLease && transactionAuthority?.commitManifestText, 'DOCX_NEW_PROJECT_AUTHORITY');
  const model = prepareDocxNewProject({ plan, ...identity });
  need(path.isAbsolute(parentDirectoryPath), 'DOCX_NEW_PROJECT_PARENT');
  need(Array.isArray(initialDirectories) && initialDirectories.length <= 16
    && initialDirectories.every(name => typeof name === 'string' && /^[a-z][a-z0-9-]{0,31}$/u.test(name)), 'DOCX_NEW_PROJECT_DIRECTORIES');
  await assertPublication();
  const parent = await fs.realpath(parentDirectoryPath), parentStat = await fs.lstat(parent);
  need(parentStat.isDirectory() && !parentStat.isSymbolicLink(), 'DOCX_NEW_PROJECT_PARENT');
  const root = path.join(parent, model.directoryName), manifestPath = path.join(root, 'project.craftsman.json');
  const directories = [...new Set([...initialDirectories, ...model.directories])].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  const binding = `${root}\n${model.sourceSha256}\n${model.manifestSha256}`;
  need(!ownership.binding || ownership.binding === binding, 'DOCX_NEW_PROJECT_RESERVATION_CHANGED');
  ownership.binding = binding;
  return transactionAuthority.withProjectLease(model.projectId, lease => lease.publish(async proof => {
    const guard = async (capability = true) => {
      await proof.assertOwned(); if (capability) await assertPublication();
      need(await fs.realpath(parentDirectoryPath) === parent && same(parentStat, await fs.lstat(parent)), 'DOCX_NEW_PROJECT_PARENT_CHANGED');
      if (ownership.root) need(same(ownership.root, await fs.lstat(root))
        && !(await fs.lstat(root)).isSymbolicLink() && await fs.realpath(root) === root, 'DOCX_NEW_PROJECT_ROOT_CHANGED');
      for (const dir of ownership.directories || []) {
        const actual = await fs.lstat(dir.target);
        need(same(dir.stat, actual) && actual.isDirectory() && !actual.isSymbolicLink()
          && await fs.realpath(dir.target) === dir.target, 'DOCX_NEW_PROJECT_DIRECTORY_CHANGED');
      }
    };
    const verifyFile = async (target, expected) => {
      await guard();
      const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const st = await handle.stat();
        need(st.isFile() && st.nlink === 1 && st.size === expected.byteLength, 'DOCX_NEW_PROJECT_FILE_IDENTITY');
        const actual = await handle.readFile('utf8');
        need(actual === expected.content && sha256Hex(actual) === expected.sha256
          && same(st, await fs.lstat(target)) && same(st, await handle.stat()), 'DOCX_NEW_PROJECT_READBACK');
      } finally { await handle.close(); }
    };
    const verifyGraph = async (published) => {
      const expected = new Set([...directories, ...model.files.map(file => file.relativePath), ...(published ? ['project.craftsman.json'] : [])]);
      const visit = async relative => {
        await guard();
        for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
          const child = relative ? relative + '/' + entry.name : entry.name;
          need(expected.delete(child) && !entry.isSymbolicLink(), 'DOCX_NEW_PROJECT_UNEXPECTED_MEMBER');
          const target = path.join(root, child), st = await fs.lstat(target);
          if (directories.includes(child)) {
            need(st.isDirectory() && !st.isSymbolicLink() && await fs.realpath(target) === target, 'DOCX_NEW_PROJECT_DIRECTORY_CHANGED');
            await visit(child);
          } else need(st.isFile() && st.nlink === 1, 'DOCX_NEW_PROJECT_FILE_IDENTITY');
        }
      };
      await visit(''); need(expected.size === 0, 'DOCX_NEW_PROJECT_MISSING_MEMBER');
      for (const file of model.files) await verifyFile(path.join(root, file.relativePath), file);
      if (published) await verifyFile(manifestPath, { content: model.manifestText,
        sha256: model.manifestSha256, byteLength: Buffer.byteLength(model.manifestText) });
      await guard();
    };
    const result = idempotent => ({ ok: true, created: true, projectCreated: true, target: 'new-project',
      projectId: model.projectId, projectName: model.projectName, summary: model.summary, idempotent,
      projectRoot: root, manifestPath, manifest: JSON.parse(model.manifestText) });
    await guard();
    if (ownership.root) {
      need(!(await absent(manifestPath)), 'DOCX_NEW_PROJECT_INCOMPLETE');
      await verifyGraph(true); return result(true);
    }
    ownership.files = []; ownership.directories = [];
    try {
      await guard(); await fs.mkdir(root, { mode: 0o700 }); ownership.root = await fs.lstat(root);
      need(ownership.root.isDirectory() && !ownership.root.isSymbolicLink(), 'DOCX_NEW_PROJECT_ROOT_CHANGED');
      for (const relative of directories) {
        await guard(); const target = path.join(root, relative);
        await fs.mkdir(target, { mode: 0o700 }); ownership.directories.push({ target, stat: await fs.lstat(target) });
      }
      for (const file of model.files) {
        await guard(); const target = path.join(root, file.relativePath);
        const handle = await fs.open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try {
          const stat = await handle.stat(); ownership.files.push({ target, stat, expected: file });
          need(stat.isFile() && stat.nlink === 1, 'DOCX_NEW_PROJECT_FILE_IDENTITY');
          await guard(); await handle.writeFile(file.content, 'utf8'); await handle.sync();
        } finally { await handle.close(); }
        await guard(); await syncDirectory(path.dirname(target)); await verifyFile(target, file);
      }
      await verifyGraph(false);
      for (const relative of [...directories].reverse()) { await guard(); await syncDirectory(path.join(root, relative)); }
      await guard(); await syncDirectory(root); await syncDirectory(parent);
      await guard();
      const publication = await transactionAuthority.commitManifestText({ projectId: model.projectId, lease,
        targetPath: manifestPath, expectedText: null, nextText: model.manifestText, label: 'DOCX fresh project publication' });
      need(publication?.ok && publication.readbackVerified && publication.durablePublication
        && publication.previousHash === '' && publication.nextHash === model.manifestSha256
        && publication.fencingGeneration === lease.fencingGeneration, 'DOCX_NEW_PROJECT_MANIFEST_UNCONFIRMED');
      await verifyGraph(true); await syncDirectory(parent); return result(false);
    } catch (error) {
      // Any present manifest may represent publication. Never remove it or its graph.
      if (ownership.root && await absent(manifestPath)) {
        try {
          await guard(false);
          for (const file of [...ownership.files].reverse()) {
            await guard(false); const actual = await fs.lstat(file.target);
            need(same(file.stat, actual) && actual.isFile() && actual.nlink === 1, 'DOCX_NEW_PROJECT_ROLLBACK_OWNERSHIP');
            need(actual.size === file.expected.byteLength && sha256Hex(await fs.readFile(file.target, 'utf8')) === file.expected.sha256,
              'DOCX_NEW_PROJECT_ROLLBACK_CHANGED_BYTES');
            await fs.unlink(file.target);
          }
          while (ownership.directories.length) {
            const dir = ownership.directories.at(-1);
            await guard(false); need(same(dir.stat, await fs.lstat(dir.target)), 'DOCX_NEW_PROJECT_ROLLBACK_OWNERSHIP');
            await fs.rmdir(dir.target);
            ownership.directories.pop();
          }
          await guard(false); await fs.rmdir(root); ownership.root = null; await syncDirectory(parent);
        } catch (rollbackError) { error.rollbackCode = rollbackError.code || 'DOCX_NEW_PROJECT_ROLLBACK_INCOMPLETE'; }
      }
      throw error;
    }
  }));
}

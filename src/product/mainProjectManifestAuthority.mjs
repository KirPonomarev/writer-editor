import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { createProjectLeaseManager } from './projectLease.mjs';
import { normalizeStage10ProjectId } from './stage10ProjectIdentityKey.mjs';

export const MAIN_PROJECT_MANIFEST_AUTHORITY_SCHEMA = 'yalken.mainProjectManifestAuthority.v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hashText(value) {
  return createHash('sha256').update(Buffer.from(typeof value === 'string' ? value : '', 'utf8')).digest('hex');
}

function typedError(code, reason, details = {}) {
  return {
    code,
    op: 'main.projectManifestAuthority',
    reason,
    details: isPlainObject(details) ? { ...details } : {},
  };
}

async function readTextIfPresent(targetPath) {
  try {
    return { exists: true, text: await fs.readFile(targetPath, 'utf8') };
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, text: '' };
    throw error;
  }
}

async function syncFileAndParent(targetPath) {
  const fileHandle = await fs.open(targetPath, 'r');
  try {
    await fileHandle.sync();
  } finally {
    await fileHandle.close();
  }
  await syncDirectory(path.dirname(targetPath));
}

async function syncDirectory(directoryPath) {
  let directoryHandle;
  try {
    directoryHandle = await fs.open(directoryPath, 'r');
    await directoryHandle.sync();
  } catch (error) {
    if (!['EINVAL', 'EPERM', 'EISDIR'].includes(error?.code)) throw error;
  } finally {
    await directoryHandle?.close().catch(() => undefined);
  }
}

async function createTextExclusively(targetPath, text) {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.manifest-cas.tmp`,
  );
  let handle;
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    handle = await fs.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.link(temporaryPath, targetPath);
    await syncFileAndParent(targetPath);
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporaryPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}

function assertManifestIdentity(projectId, text, label) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw typedError('E_MAIN_PROJECT_MANIFEST_JSON_INVALID', 'PROJECT_MANIFEST_JSON_INVALID', { label });
  }
  if (!isPlainObject(manifest) || normalizeStage10ProjectId(manifest.projectId) !== projectId) {
    throw typedError('E_MAIN_PROJECT_MANIFEST_IDENTITY_MISMATCH', 'PROJECT_MANIFEST_IDENTITY_MISMATCH', { label });
  }
  return manifest;
}

export function createMainProjectManifestAuthority(input = {}) {
  const anchorRoot = normalizeString(input.anchorRoot);
  if (!anchorRoot || !path.isAbsolute(anchorRoot) || anchorRoot === path.parse(anchorRoot).root) {
    throw typedError('E_MAIN_PROJECT_MANIFEST_AUTHORITY_ROOT_INVALID', 'PROJECT_MANIFEST_AUTHORITY_ROOT_INVALID');
  }
  const writeFileAtomic = typeof input.writeFileAtomic === 'function' ? input.writeFileAtomic : null;
  const leaseManager = input.leaseManager || createProjectLeaseManager({
    leaseRoot: anchorRoot,
    ttlMs: input.leaseTtlMs,
    nowMs: input.leaseNowMs,
    nowMonotonicMs: input.leaseNowMonotonicMs,
    useHeartbeatWorker: input.useLeaseHeartbeatWorker,
  });

  // A scene's last commit can legitimately predate another scene's manifest
  // update. Only this publication authority records those durable transitions.
  const transitionRoot = (projectId, targetPath) => path.join(anchorRoot, 'manifest-transitions', hashText(`${projectId}\0${targetPath}`));
  async function recordManifestTransition(projectId, targetPath, previousHash, nextHash) {
    if (!previousHash || previousHash === nextHash) return;
    const dir = path.join(transitionRoot(projectId, targetPath), previousHash);
    const file = path.join(dir, `${nextHash}.json`);
    const text = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId, targetPath, previousHash, nextHash });
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    try { await createTextExclusively(file, text); }
    catch (error) {
      if (error?.code !== 'EEXIST' || (await readTextIfPresent(file)).text !== text) throw error;
    }
    await syncFileAndParent(file);
    for (const parent of [path.dirname(dir), path.dirname(path.dirname(dir)), anchorRoot]) {
      await syncDirectory(parent);
    }
  }

  async function verifyManifestContinuation({ projectId, manifestPath, fromDigest, toDigest }) {
    const no = { ok: false };
    if (normalizeStage10ProjectId(projectId) !== projectId || !path.isAbsolute(manifestPath)
      || !/^[a-f0-9]{64}$/u.test(fromDigest) || !/^[a-f0-9]{64}$/u.test(toDigest)) return no;
    const root = transitionRoot(projectId, manifestPath);
    const pending = [fromDigest], visited = new Set();
    try {
      const anchor = await fs.realpath(anchorRoot), actualRoot = await fs.realpath(root);
      if (actualRoot !== path.join(anchor, 'manifest-transitions', hashText(`${projectId}\0${manifestPath}`))) return no;
      const sameFile = (a, b) => ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'nlink'].every(key => a[key] === b[key]);
      while (pending.length && visited.size < 4096) {
        const previousHash = pending.shift();
        if (visited.has(previousHash)) continue;
        visited.add(previousHash);
        if (previousHash === toDigest) return { ok: true, projectId, manifestPath, fromDigest, toDigest };
        const dir = path.join(root, previousHash);
        let entries;
        try {
          const st = await fs.lstat(dir);
          if (!st.isDirectory() || st.isSymbolicLink()) return no;
          entries = await fs.readdir(dir);
        } catch (error) { if (error?.code === 'ENOENT') continue; throw error; }
        if (entries.length > 256) return no;
        for (const entry of entries) {
          if (!/^[a-f0-9]{64}\.json$/u.test(entry)) return no;
          const file = path.join(dir, entry);
          const handle = await fs.open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK);
          let record;
          try {
            const st = await handle.stat();
            if (!st.isFile() || st.nlink !== 1 || st.size > 4096) return no;
            record = JSON.parse(await handle.readFile('utf8'));
            if (!sameFile(st, await handle.stat()) || !sameFile(st, await fs.lstat(file))
              || await fs.realpath(dir) !== path.join(actualRoot, previousHash)) return no;
          } finally { await handle.close(); }
          const nextHash = entry.slice(0, -5);
          if (record.schemaVersion !== 'yalken.manifest-transition.v1' || record.projectId !== projectId
            || record.targetPath !== manifestPath || record.previousHash !== previousHash || record.nextHash !== nextHash) return no;
          if (!visited.has(nextHash)) pending.push(nextHash);
          if (pending.length > 4096) return no;
        }
      }
    } catch { return no; }
    return no;
  }

  async function replaceText(targetPath, nextText, label) {
    if (!writeFileAtomic) {
      const temporaryPath = path.join(
        path.dirname(targetPath),
        `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.manifest-replace.tmp`,
      );
      let handle;
      try {
        handle = await fs.open(temporaryPath, 'wx', 0o600);
        await handle.writeFile(nextText, 'utf8');
        await handle.sync();
        await handle.close();
        handle = null;
        await fs.rename(temporaryPath, targetPath);
      } finally {
        await handle?.close().catch(() => undefined);
        await fs.unlink(temporaryPath).catch((error) => {
          if (error?.code !== 'ENOENT') throw error;
        });
      }
    } else {
      const result = await writeFileAtomic(targetPath, nextText);
      if (result?.success === false || result?.ok === false) {
        throw typedError('E_MAIN_PROJECT_MANIFEST_WRITE_REJECTED', 'PROJECT_MANIFEST_WRITE_REJECTED', { label });
      }
    }
    await syncFileAndParent(targetPath);
  }

  async function commitManifestText({
    projectId: inputProjectId,
    expectedProjectId: inputExpectedProjectId,
    targetPath: inputTargetPath,
    expectedText,
    nextText,
    lease = null,
    label = 'projectManifest',
  }) {
    const projectId = normalizeStage10ProjectId(inputProjectId);
    const hasExpectedProjectId = inputExpectedProjectId !== undefined && inputExpectedProjectId !== null;
    const expectedProjectId = hasExpectedProjectId
      ? normalizeStage10ProjectId(inputExpectedProjectId)
      : projectId;
    const targetPath = normalizeString(inputTargetPath);
    if (
      !projectId
      || !expectedProjectId
      || !path.isAbsolute(targetPath)
      || targetPath === path.parse(targetPath).root
    ) {
      throw typedError('E_MAIN_PROJECT_MANIFEST_COMMIT_INVALID', 'PROJECT_MANIFEST_COMMIT_INVALID');
    }
    if (expectedText !== null && typeof expectedText !== 'string') {
      throw typedError('E_MAIN_PROJECT_MANIFEST_EXPECTED_BYTES_REQUIRED', 'PROJECT_MANIFEST_EXPECTED_BYTES_REQUIRED');
    }
    if (typeof nextText !== 'string' || !nextText) {
      throw typedError('E_MAIN_PROJECT_MANIFEST_NEXT_BYTES_REQUIRED', 'PROJECT_MANIFEST_NEXT_BYTES_REQUIRED');
    }
    if (typeof expectedText === 'string') assertManifestIdentity(expectedProjectId, expectedText, 'expected');
    assertManifestIdentity(projectId, nextText, 'next');
    const publish = async (activeLease) => activeLease.publish(async (proof) => {
      const before = await readTextIfPresent(targetPath);
      const expectedExists = expectedText !== null;
      if (before.exists !== expectedExists || (expectedExists && before.text !== expectedText)) {
        throw typedError('E_MAIN_PROJECT_MANIFEST_CAS_FAILED', 'PROJECT_MANIFEST_REVISION_CONFLICT', {
          expectedExists,
          actualExists: before.exists,
          expectedHash: expectedExists ? hashText(expectedText) : '',
          actualHash: before.exists ? hashText(before.text) : '',
        });
      }
      await proof.assertOwned();
      try {
        if (expectedExists) await replaceText(targetPath, nextText, label);
        else await createTextExclusively(targetPath, nextText);
      } catch (error) {
        if (error?.code === 'EEXIST') {
          throw typedError('E_MAIN_PROJECT_MANIFEST_CAS_FAILED', 'PROJECT_MANIFEST_UNEXPECTEDLY_EXISTS');
        }
        throw error;
      }
      await proof.assertOwned();
      const readback = await readTextIfPresent(targetPath);
      if (!readback.exists || readback.text !== nextText) {
        throw typedError('E_MAIN_PROJECT_MANIFEST_READBACK_MISMATCH', 'PROJECT_MANIFEST_READBACK_MISMATCH', {
          expectedHash: hashText(nextText),
          actualHash: readback.exists ? hashText(readback.text) : '',
        });
      }
      await recordManifestTransition(projectId, targetPath, expectedText === null ? '' : hashText(expectedText), hashText(nextText));
      return {
        ok: true,
        schemaVersion: MAIN_PROJECT_MANIFEST_AUTHORITY_SCHEMA,
        projectId,
        expectedProjectId,
        previousHash: expectedText === null ? '' : hashText(expectedText),
        nextHash: hashText(nextText),
        fencingGeneration: activeLease.fencingGeneration,
        processInstanceId: activeLease.processInstanceId,
        readbackVerified: true,
        durablePublication: true,
      };
    });
    if (lease) {
      if (normalizeStage10ProjectId(lease.projectId) !== projectId) {
        throw typedError('E_MAIN_PROJECT_MANIFEST_LEASE_PROJECT_MISMATCH', 'PROJECT_MANIFEST_LEASE_PROJECT_MISMATCH');
      }
      return publish(lease);
    }
    return leaseManager.withLease(projectId, publish);
  }

  return Object.freeze({
    schemaVersion: MAIN_PROJECT_MANIFEST_AUTHORITY_SCHEMA,
    leaseManager,
    withProjectLease: (projectId, operation) => leaseManager.withLease(projectId, operation),
    commitManifestText,
    verifyManifestContinuation,
  });
}

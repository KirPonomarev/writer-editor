'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { constants } = require('node:fs');
const archive = require('../../src/export/archive/projectArchiveExportHandler');
const { publishProjectArchiveOutput } = require('../../src/main/projectArchiveOutputPublication.cjs');

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'archive-correctness-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(await fs.realpath(root), 'source'); await fs.mkdir(project);
  await fs.writeFile(path.join(project, 'project.craftsman.json'), JSON.stringify({ projectId: 'coherent', revision: 0 }));
  await fs.writeFile(path.join(project, 'a.txt'), 'A0');
  await fs.writeFile(path.join(project, 'b.txt'), 'B0');
  return { root, project };
}
// The same actual-file perturbation applies to both the old path reader and
// the new no-follow descriptor reader. It is not an injected snapshot result.
async function afterRead(t, target, mutation) {
  const read = fs.readFile, open = fs.open; let ran = false;
  const observe = async (file, bytes) => {
    if (String(file) === target && !ran) { ran = true; await mutation(); }
    return bytes;
  };
  fs.readFile = async (file, ...args) => observe(file, await read(file, ...args));
  fs.open = async (file, ...args) => {
    const handle = await open(file, ...args), original = handle.readFile.bind(handle);
    handle.readFile = async (...readArgs) => observe(file, await original(...readArgs));
    return handle;
  };
  t.after(() => { fs.readFile = read; fs.open = open; });
  return () => ran;
}
test('archive capture refuses the physically nonexistent A0/B1 mixed generation', async t => {
  const { project } = await fixture(t);
  const ran = await afterRead(t, path.join(project, 'a.txt'), async () => {
    await fs.writeFile(path.join(project, 'a.txt'), 'A1');
    await fs.writeFile(path.join(project, 'b.txt'), 'B1');
  });
  await assert.rejects(archive.buildProjectArchiveBuffer(project), /source_changed|snapshot_stale/u);
  assert.equal(ran(), true);
});
test('archive capture refuses a new roster member during content capture', async t => {
  const { project } = await fixture(t);
  const ran = await afterRead(t, path.join(project, 'a.txt'), () => fs.writeFile(path.join(project, 'new.txt'), 'new'));
  await assert.rejects(archive.buildProjectArchiveBuffer(project), /source_changed|snapshot_stale/u);
  assert.equal(ran(), true);
});
test('sealed archive N has no mutable aliases and packages without rereading live N+1', async t => {
  const { project } = await fixture(t);
  const captured = await archive.collectProjectArchiveSourceEntries(project);
  const a = captured.files.find(row => row.relativePath === 'a.txt');
  a.buffer.fill(88); // Public buffer accessor must be a copy, never sealed storage.
  await fs.writeFile(path.join(project, 'a.txt'), 'A1');
  await fs.rm(project, { recursive: true });
  const built = archive.buildProjectArchiveFromSnapshot(captured);
  const payload = archive.readProjectArchivePayload(built.buffer);
  assert.equal(payload.entries.find(row => row.relativePath === 'a.txt').buffer.toString(), 'A0');
});
test('archive capture refuses special objects without silently omitting them', async t => {
  const { project } = await fixture(t);
  await fs.symlink(path.join(project, 'a.txt'), path.join(project, 'linked.txt'));
  await assert.rejects(archive.buildProjectArchiveBuffer(project), /symlink|unsupported/u);
});
function container(paths) {
  const project = Buffer.from('{"projectId":"parse"}');
  const entries = [{ relativePath: 'project.craftsman.json', buffer: project },
    ...paths.map((name, i) => ({ relativePath: name, buffer: Buffer.from('body' + i) }))];
  const manifest = { schemaVersion: archive.ARCHIVE_SCHEMA_VERSION,
    entries: entries.map(row => ({ relativePath: row.relativePath, archivePath: 'project/' + row.relativePath,
      size: row.buffer.length, sha256: crypto.createHash('sha256').update(row.buffer).digest('hex') })) };
  return archive.buildZipArchive([{ archivePath: archive.ARCHIVE_MANIFEST_PATH, buffer: Buffer.from(JSON.stringify(manifest)) },
    ...entries.map(row => ({ archivePath: 'project/' + row.relativePath, buffer: row.buffer }))]);
}
for (const [label, paths] of [
  ['physical duplicate', ['scene.txt', 'scene.txt']],
  ['case alias', ['Scene.txt', 'scene.txt']],
  ['Unicode alias', ['caf\u00e9.txt', 'cafe\u0301.txt']],
  ['directory-prefix alias', ['Dir/a.txt', 'dir/b.txt']],
  ['file-directory conflict', ['scene', 'scene/child.txt']],
]) test('archive reader refuses ' + label + ' before extraction', () => {
  assert.throws(() => archive.readProjectArchivePayload(container(paths)), /duplicate|collision|conflict/u);
});
test('ordinary stored archive retains distinct Unicode bytes and valid names', () => {
  const payload = archive.readProjectArchivePayload(container(['Сцена.txt', '日本語.txt']));
  assert.equal(payload.entryCount, 3);
  assert.equal(payload.entries.find(row => row.relativePath === '日本語.txt').buffer.toString(), 'body1');
});
test('archive reader rejects a central-directory count that hides a later physical member', () => {
  const bytes = container(['first.txt', 'later.txt']);
  const end = bytes.length - 22;
  bytes.writeUInt16LE(bytes.readUInt16LE(end + 10) - 1, end + 10);
  assert.throws(() => archive.readProjectArchivePayload(bytes), /count_mismatch/u);
});
for (const name of ['/absolute.txt', 'project//scene.txt', 'project/../scene.txt', 'C:/scene.txt', 'project/ leading.txt', 'project/trailing.txt ']) {
  test('raw archive path cannot erase invalid spelling: ' + JSON.stringify(name), () => {
    assert.throws(() => archive.normalizeArchivePath(name), /path_invalid/u);
  });
}

test('saved archive output independently reads the final bytes and reports sync milestones', async t => {
  const { root, project } = await fixture(t);
  const built = await archive.buildProjectArchiveBuffer(project), outPath = path.join(root, 'output.zip');
  const result = await publishProjectArchiveOutput({ outPath, buffer: built.buffer });
  assert.equal(result.publication.namePublished, true);
  assert.equal(result.publication.fileSynced, true);
  assert.equal(result.publication.directorySynced, true);
  assert.equal(result.publication.readbackVerified, true);
  assert.equal(result.publication.physicalPowerLossVerified, false);
  assert.deepEqual(await fs.readFile(outPath), built.buffer);
});
test('saved output corruption after actual publication never receives verified success', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip');
  const fsPort = { ...fs, link: async (source, target) => { await fs.link(source, target); await fs.writeFile(target, 'CORRUPT'); } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort }), error => {
    assert.equal(error.details.publication.namePublished, true);
    assert.equal(error.details.publication.readbackVerified, false); return true;
  });
  assert.equal(await fs.readFile(outPath, 'utf8'), 'CORRUPT');
});
test('late cancel preserves the published file and finishes bounded verification', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip'), controller = new AbortController();
  const fsPort = { ...fs, link: async (source, target) => { await fs.link(source, target); controller.abort(); } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort, signal: controller.signal });
  assert.equal(result.publication.lateCancel, true);
  assert.equal(result.publication.readbackVerified, true);
  assert.equal(await fs.readFile(outPath, 'utf8'), 'expected');
});
test('cancel before publication starts performs no write', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip'), controller = new AbortController();
  controller.abort();
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), signal: controller.signal }), /CANCELLED/u);
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
});
test('lost successful publication return is reconciled by exact final inode and bytes', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip');
  const fsPort = { ...fs, link: async (source, target) => { await fs.link(source, target); throw Object.assign(Error('lost response'), { code: 'EIO' }); } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort });
  assert.equal(result.publication.publicationOutcome, 'PUBLISHED_RECONCILED');
  assert.equal(result.publication.readbackVerified, true);
});
for (const phase of ['FILE_SYNC', 'DIRECTORY_SYNC', 'FINAL_READBACK', 'SHORT_WRITE']) {
  test('output fault ' + phase + ' has no false verified result and retains published final', async t => {
    const { root } = await fixture(t), outPath = path.join(root, 'output.zip');
    let published = false;
    const fsPort = { ...fs, link: async (...args) => { await fs.link(...args); published = true; },
      open: async (target, ...args) => {
        const h = await fs.open(target, ...args);
        if (phase === 'FILE_SYNC' && String(target).endsWith('.tmp')) h.sync = async () => { throw Error('injected file sync fault'); };
        if (phase === 'DIRECTORY_SYNC' && String(target) === await fs.realpath(root)) h.sync = async () => { throw Error('injected directory sync fault'); };
        if (phase === 'SHORT_WRITE' && String(target).endsWith('.tmp')) h.writeFile = async bytes => h.write(bytes.subarray(0, 2));
        if (phase === 'FINAL_READBACK' && published && path.basename(String(target)) === 'output.zip') h.readFile = async () => { throw Error('injected readback fault'); };
        return h;
      } };
    await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort }), error => {
      assert.equal(error.details.publication.namePublished, published);
      assert.equal(error.details.publication.readbackVerified, false); return true;
    });
    if (published) assert.equal(await fs.readFile(outPath, 'utf8'), 'expected');
    else await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
  });
}
test('a late foreign output file is preserved by atomic create-only file publication', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip');
  let foreign;
  const fsPort = { ...fs, link: async (source, target) => {
    await fs.writeFile(target, 'foreign', { flag: 'wx' }); foreign = await fs.lstat(target); await fs.link(source, target);
  } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort }));
  assert.equal((await fs.lstat(outPath)).ino, foreign.ino);
  assert.equal(await fs.readFile(outPath, 'utf8'), 'foreign');
});
test('saved output cleanup failure reports retained owned staging while preserving verified final', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip');
  const fsPort = { ...fs, unlink: async () => { throw Error('injected cleanup failure'); } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort });
  assert.equal(result.publication.readbackVerified, true);
  assert.equal(result.publication.cleanup, 'OWNED_STAGING_RETAINED');
  assert.equal(await fs.readFile(outPath, 'utf8'), 'expected');
  assert.equal((await fs.readdir(root)).filter(name => name.includes('.archive-')).length, 1);
});
test('required file close failure cannot produce verified output', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'output.zip');
  let injected = false;
  const fsPort = { ...fs, open: async (...args) => {
    const h = await fs.open(...args), close = h.close.bind(h);
    if (String(args[0]).endsWith('.tmp') && !injected) {
      h.close = async () => { injected = true; await close(); throw Error('injected lost close return'); };
    }
    return h;
  } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('expected'), fsPort }), error => {
    assert.equal(error.details.publication.readbackVerified, false);
    assert.equal(error.details.publication.namePublished, false); return true;
  });
  assert.equal(injected, true);
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
});

const noHardlink = async () => { throw Object.assign(Error('filesystem has no hardlinks'), { code: 'ENOTSUP' }); };
test('allocated staging identity comes from the live owned FD after write and sync', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'allocation.zip');
  const fsPort = { ...fs, open: async (target, ...args) => {
    const h = await fs.open(target, ...args), stat = h.stat.bind(h), write = h.writeFile.bind(h);
    let allocated = false;
    if (String(target).endsWith('.tmp') && args[0] & constants.O_WRONLY) {
      h.stat = async (...a) => { const actual = await stat(...a); return allocated ? actual : Object.assign(actual, { ino: -123n }); };
      h.writeFile = async (...a) => { await write(...a); allocated = true; };
    }
    return h;
  } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('allocated bytes'), fsPort });
  assert.equal(result.publication.atomicPublication, true);
  assert.equal(result.publication.readbackVerified, true);
  assert.equal(await fs.readFile(outPath, 'utf8'), 'allocated bytes');
});
test('hardlink ENOTSUP alone selects explicit non-atomic exclusive-create verified output', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'exclusive.zip');
  let reserved = 0;
  const fsPort = { ...fs, link: noHardlink, rename: async () => { throw Error('replacing fallback forbidden'); },
    open: async (target, flags, ...args) => {
      if (target === outPath && flags & constants.O_WRONLY) {
        assert.ok(flags & constants.O_EXCL); assert.ok(flags & constants.O_CREAT);
        if (constants.O_NOFOLLOW) assert.ok(flags & constants.O_NOFOLLOW);
        reserved++;
      }
      return fs.open(target, flags, ...args);
    } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('complete exact output'), fsPort });
  assert.equal(reserved, 1);
  assert.equal(result.publication.atomicPublication, false);
  assert.equal(result.publication.outputProfile, 'EXCLUSIVE_CREATE');
  assert.equal(result.publication.namePublished, true);
  assert.equal(result.publication.fileSynced, true);
  assert.equal(result.publication.directorySynced, true);
  assert.equal(result.publication.readbackVerified, true);
  assert.equal(result.publication.recoveryRequired, false);
  assert.equal(await fs.readFile(outPath, 'utf8'), 'complete exact output');
});
test('working hardlink retains the atomic profile and never reserves or writes final directly', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'atomic.zip');
  const fsPort = { ...fs, open: async (target, flags, ...args) => {
    assert.ok(target !== outPath || !(flags & constants.O_WRONLY)); return fs.open(target, flags, ...args);
  } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('atomic bytes'), fsPort });
  assert.equal(result.publication.atomicPublication, true);
  assert.equal(result.publication.outputProfile, 'ATOMIC_HARDLINK');
});
test('hardlink permission failure never enters exclusive-create profile', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'no-permission.zip');
  const fsPort = { ...fs, link: async () => { throw Object.assign(Error('denied'), { code: 'EACCES' }); },
    open: async (target, flags, ...args) => {
      assert.ok(target !== outPath || !(flags & constants.O_WRONLY)); return fs.open(target, flags, ...args);
    } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('bytes'), fsPort }));
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
});
test('lost successful hardlink with ENOTSUP is reconciled before considering another profile', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'misleading-errno.zip');
  let reservations = 0;
  const fsPort = { ...fs, link: async (...args) => { await fs.link(...args); return noHardlink(); },
    open: async (target, flags, ...args) => {
      if (target === outPath && flags & constants.O_WRONLY) reservations++;
      return fs.open(target, flags, ...args);
    } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('already published'), fsPort });
  assert.equal(result.publication.namePublished, true);
  assert.equal(result.publication.publicationOutcome, 'PUBLISHED_RECONCILED');
  assert.equal(result.publication.outputProfile, 'ATOMIC_HARDLINK');
  assert.equal(result.publication.atomicPublication, true); assert.equal(result.publication.readbackVerified, true);
  assert.equal(reservations, 0); assert.equal(await fs.readFile(outPath, 'utf8'), 'already published');
});
for (const kind of ['file', 'empty directory', 'nonempty directory', 'symlink']) {
  test('exclusive-create preserves a late foreign ' + kind, async t => {
    const { root } = await fixture(t), outPath = path.join(root, 'foreign.zip'), sentinel = path.join(root, 'sentinel');
    await fs.writeFile(sentinel, 'foreign sentinel');
    let before;
    const fsPort = { ...fs, link: noHardlink, open: async (target, flags, ...args) => {
      if (target === outPath && flags & constants.O_WRONLY) {
        if (kind.includes('directory')) { await fs.mkdir(outPath); if (kind === 'nonempty directory') await fs.writeFile(path.join(outPath, 'sentinel'), 'foreign child'); }
        else if (kind === 'symlink') await fs.symlink(sentinel, outPath);
        else await fs.writeFile(outPath, 'foreign file', { flag: 'wx' });
        before = await fs.lstat(outPath, { bigint: true });
      }
      return fs.open(target, flags, ...args);
    } };
    await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('own bytes'), fsPort }), error => {
      assert.equal(error.details.publication.namePublished, false);
      assert.equal(error.details.publication.publicationOutcome, 'REFUSED'); return true;
    });
    const after = await fs.lstat(outPath, { bigint: true });
    assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'foreign sentinel');
    if (kind === 'file') assert.equal(await fs.readFile(outPath, 'utf8'), 'foreign file');
    if (kind === 'nonempty directory') assert.equal(await fs.readFile(path.join(outPath, 'sentinel'), 'utf8'), 'foreign child');
  });
}
for (const phase of ['FINAL_WRITE', 'FINAL_SYNC', 'FINAL_CLOSE', 'FINAL_READBACK', 'DIRECTORY_SYNC']) {
  test('exclusive-create ' + phase + ' fault keeps observed final and full verified staging', async t => {
    const { root } = await fixture(t), outPath = path.join(root, 'fault.zip'), bytes = Buffer.from('complete recovery bytes');
    let injected = false;
    const fsPort = { ...fs, link: noHardlink, open: async (target, flags, ...args) => {
      const h = await fs.open(target, flags, ...args);
      if (target === outPath && flags & constants.O_WRONLY) {
        if (phase === 'FINAL_WRITE') h.writeFile = async value => { injected = true; await h.write(value.subarray(0, 3)); throw Error('ENOSPC during final write'); };
        if (phase === 'FINAL_SYNC') h.sync = async () => { injected = true; throw Error('final sync failure'); };
        if (phase === 'FINAL_CLOSE') { const close = h.close.bind(h); h.close = async () => { injected = true; await close(); throw Error('lost close result'); }; }
      }
      if (phase === 'FINAL_READBACK' && target === outPath && !(flags & constants.O_WRONLY)) h.readFile = async () => { injected = true; throw Error('final readback failed'); };
      if (phase === 'DIRECTORY_SYNC' && target === await fs.realpath(root)) h.sync = async () => { injected = true; throw Error('parent sync failed'); };
      return h;
    } };
    await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: bytes, fsPort }), error => {
      const p = error.details.publication;
      assert.equal(p.namePublished, true); assert.equal(p.atomicPublication, false);
      assert.equal(p.publicationOutcome, 'PUBLISHED_UNVERIFIED'); assert.equal(p.readbackVerified, false);
      assert.equal(p.recoveryRequired, true); assert.equal(p.recovery.stagingVerified, true);
      return true;
    });
    assert.equal(injected, true);
    const staged = (await fs.readdir(root)).filter(name => name.includes('.archive-'));
    assert.equal(staged.length, 1); assert.deepEqual(await fs.readFile(path.join(root, staged[0])), bytes);
    assert.ok((await fs.lstat(outPath)).isFile());
  });
}
test('exclusive-create completes verification after cancellation immediately following final reservation', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'cancel.zip'), controller = new AbortController();
  const fsPort = { ...fs, link: noHardlink, open: async (target, flags, ...args) => {
    const h = await fs.open(target, flags, ...args);
    if (target === outPath && flags & constants.O_WRONLY) controller.abort(); return h;
  } };
  const result = await publishProjectArchiveOutput({ outPath, buffer: Buffer.from('late cancel bytes'), signal: controller.signal, fsPort });
  assert.equal(result.publication.lateCancel, true); assert.equal(result.publication.readbackVerified, true);
  assert.equal(result.publication.atomicPublication, false); assert.equal(await fs.readFile(outPath, 'utf8'), 'late cancel bytes');
});
test('lost exclusive-open response is UNKNOWN and retains final plus verified staging', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'lost-open.zip');
  const fsPort = { ...fs, link: noHardlink, open: async (target, flags, ...args) => {
    const h = await fs.open(target, flags, ...args);
    if (target === outPath && flags & constants.O_WRONLY) { await h.close(); throw Object.assign(Error('lost open response'), { code: 'EIO' }); }
    return h;
  } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('recoverable bytes'), fsPort }), error => {
    assert.equal(error.details.publication.publicationOutcome, 'UNKNOWN');
    assert.equal(error.details.publication.recoveryRequired, true); return true;
  });
  assert.equal((await fs.stat(outPath)).size, 0);
  const stage = (await fs.readdir(root)).find(name => name.includes('.archive-'));
  assert.equal(await fs.readFile(path.join(root, stage), 'utf8'), 'recoverable bytes');
});
test('unsupported exclusive final open refuses and keeps a verified recovery candidate', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'unsupported.zip');
  const fsPort = { ...fs, link: noHardlink, open: async (target, flags, ...args) => {
    if (target === outPath && flags & constants.O_WRONLY) throw Object.assign(Error('exclusive create unsupported'), { code: 'ENOTSUP' });
    return fs.open(target, flags, ...args);
  } };
  let receipt;
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('retained bytes'), fsPort }), error => {
    receipt = error.details.publication;
    assert.equal(receipt.namePublished, false); assert.equal(receipt.readbackVerified, false);
    assert.equal(receipt.publicationOutcome, 'UNKNOWN'); assert.equal(receipt.recoveryRequired, true);
    assert.equal(receipt.recovery.stagingVerified, true); return true;
  });
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
  assert.equal(await fs.readFile(receipt.recovery.stagingPath, 'utf8'), 'retained bytes');
});
for (const which of ['staging', 'final']) test('allocated live FD never blesses a replaced ' + which + ' pathname', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'swap.zip');
  let swapped, foreign;
  const fsPort = { ...fs, link: noHardlink, open: async (target, flags, ...args) => {
    const h = await fs.open(target, flags, ...args), write = h.writeFile.bind(h);
    if (flags & constants.O_WRONLY && (which === 'final' ? target === outPath : String(target).endsWith('.tmp'))) {
      h.writeFile = async (...a) => {
        await write(...a); swapped = target;
        await fs.rename(target, target + '.original'); await fs.writeFile(target, 'FOREIGN replacement', { flag: 'wx' });
        foreign = await fs.lstat(target, { bigint: true });
      };
    }
    return h;
  } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('complete own bytes'), fsPort }), error => {
    assert.equal(error.code, 'E_PROJECT_ARCHIVE_OUTPUT_IDENTITY_CHANGED');
    assert.equal(error.details.publication.namePublished, which === 'final');
    assert.equal(error.details.publication.readbackVerified, false); return true;
  });
  assert.equal((await fs.lstat(swapped, { bigint: true })).ino, foreign.ino);
  assert.equal(await fs.readFile(swapped, 'utf8'), 'FOREIGN replacement');
  assert.equal(await fs.readFile(swapped + '.original', 'utf8'), 'complete own bytes');
});
test('unsupported hardlink cannot publish into a substituted parent directory', async t => {
  const { root } = await fixture(t), outPath = path.join(await fs.realpath(root), 'parent-swap.zip');
  const originalRoot = await fs.realpath(root), moved = originalRoot + '-owned';
  t.after(() => fs.rm(moved, { recursive: true, force: true }));
  let foreign;
  const fsPort = { ...fs, link: async () => {
    await fs.rename(originalRoot, moved); await fs.mkdir(originalRoot);
    await fs.writeFile(path.join(originalRoot, 'foreign'), 'parent sentinel'); foreign = await fs.lstat(originalRoot, { bigint: true });
    return noHardlink();
  } };
  await assert.rejects(publishProjectArchiveOutput({ outPath, buffer: Buffer.from('own output'), fsPort }), { code: 'E_PROJECT_ARCHIVE_OUTPUT_PARENT_CHANGED' });
  assert.equal((await fs.lstat(originalRoot, { bigint: true })).ino, foreign.ino);
  assert.equal(await fs.readFile(path.join(originalRoot, 'foreign'), 'utf8'), 'parent sentinel');
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
});
test('process kill after exclusive final partial write retains complete readable ZIP staging', { timeout: 10000 }, async t => {
  const { root, project } = await fixture(t), source = await archive.buildProjectArchiveBuffer(project);
  const inputPath = path.join(root, 'input.zip'), outPath = path.join(root, 'killed.zip');
  await fs.writeFile(inputPath, source.buffer);
  const script = `
    const fs=require('node:fs/promises'),path=require('node:path'),{constants}=require('node:fs');
    const {publishProjectArchiveOutput}=require(${JSON.stringify(require.resolve('../../src/main/projectArchiveOutputPublication.cjs'))});
    const [input,outPath]=process.argv.slice(1);let staging;
    (async()=>{
      const buffer=await fs.readFile(input);
      const fsPort={...fs,link:async()=>{throw Object.assign(Error('ENOTSUP'),{code:'ENOTSUP'})},open:async(target,flags,...args)=>{
        const h=await fs.open(target,flags,...args);
        if(String(target).endsWith('.tmp') && flags & constants.O_WRONLY)staging=target;
        if(target===outPath && flags & constants.O_WRONLY)h.writeFile=async bytes=>{
          await h.write(bytes.subarray(0,13));await h.sync();
          process.stdout.write(JSON.stringify({barrier:'ACTUAL_PARTIAL_FINAL_FSYNC',staging})+'\\n');
          await new Promise(()=>{setInterval(()=>{},1000)});
        };
        return h;
      }};
      await publishProjectArchiveOutput({outPath,buffer,fsPort});process.exitCode=3;
    })().catch(e=>{console.error(e);process.exitCode=2});`;
  const child = require('node:child_process').spawn(process.execPath, ['-e', script, inputPath, outPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  const barrier = await new Promise((resolve, reject) => {
    let data = '', diagnostic = '';
    child.stderr.on('data', bytes => { diagnostic += bytes; });
    child.stdout.on('data', bytes => {
      data += bytes;
      if (data.includes('\n')) { try { resolve(JSON.parse(data.split('\n')[0])); } catch (error) { reject(error); } }
    });
    child.once('close', () => reject(Error('child exited before actual write barrier: ' + diagnostic)));
    child.once('error', reject);
  });
  assert.equal(barrier.barrier, 'ACTUAL_PARTIAL_FINAL_FSYNC');
  assert.ok(child.pid > 0); assert.equal(child.kill('SIGKILL'), true);
  assert.deepEqual(await closed, { code: null, signal: 'SIGKILL' });
  assert.deepEqual(await fs.readFile(inputPath), source.buffer);
  assert.deepEqual(await fs.readFile(barrier.staging), source.buffer);
  assert.equal(archive.verifyProjectArchiveBuffer(await fs.readFile(barrier.staging)).ok, true);
  const partial = await fs.readFile(outPath);
  assert.deepEqual(partial, source.buffer.subarray(0, 13));
  assert.throws(() => archive.verifyProjectArchiveBuffer(partial), /zip_/u);
});

// Load the unchanged adapter body with a test-only Core port. No production
// hook, caller policy parameter, cache mutation or substituted filesystem verdict.
function publisherWithContract(contract) {
  const Module = require('node:module'), filename = require.resolve('../../src/main/projectArchiveOutputPublication.cjs');
  const loaded = new Module(filename, module), originalRequire = Module.createRequire(filename);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = name => name === '../core/minimum-interchange-v1.cjs' ? contract : originalRequire(name);
  loaded._compile(require('node:fs').readFileSync(filename, 'utf8'), filename);
  return loaded.exports.publishProjectArchiveOutput;
}
test('adapter consumes current Core selection before any output write effect', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'denied-profile.zip');
  const core = require('../../src/core/minimum-interchange-v1.cjs');
  let selected = 0, writerOpens = 0;
  const publish = publisherWithContract({ ...core, selectProjectArchiveOutputProfile: input => {
    selected++; assert.deepEqual(input, { targetExists: false });
    return { ok: false, code: 'E_PROJECT_ARCHIVE_OUTPUT_PROFILE_INVALID' };
  } });
  const fsPort = { ...fs, open: async (target, flags, ...args) => {
    if (flags & (constants.O_WRONLY | constants.O_CREAT)) writerOpens++;
    return fs.open(target, flags, ...args);
  } };
  await assert.rejects(publish({ outPath, buffer: Buffer.from('payload'), fsPort }), { code: 'E_PROJECT_ARCHIVE_OUTPUT_PROFILE_INVALID' });
  assert.equal(selected, 1); assert.equal(writerOpens, 0);
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
  assert.equal((await fs.readdir(root)).some(name => name.includes('.archive-')), false);
});
test('adapter must obtain Core exclusive profile after real link refusal and before final reservation', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'exclusive-denied.zip');
  const core = require('../../src/core/minimum-interchange-v1.cjs');
  let refusedLink = false, exclusiveSelections = 0, finalReservations = 0;
  const publish = publisherWithContract({ ...core, selectProjectArchiveOutputProfile: input => {
    if (input.hardlinkErrorCode) {
      assert.equal(refusedLink, true); assert.equal(input.hardlinkErrorCode, 'ENOTSUP');
      assert.equal(input.stagingVerified, true); exclusiveSelections++;
      return { ok: false, code: 'E_PROJECT_ARCHIVE_OUTPUT_PROFILE_TRIGGER_INVALID' };
    }
    return core.selectProjectArchiveOutputProfile(input);
  } });
  const fsPort = { ...fs, link: async () => { refusedLink = true; return noHardlink(); },
    open: async (target, flags, ...args) => {
      if (target === outPath && flags & constants.O_WRONLY) finalReservations++;
      return fs.open(target, flags, ...args);
    } };
  await assert.rejects(publish({ outPath, buffer: Buffer.from('payload'), fsPort }), { code: 'E_PROJECT_ARCHIVE_OUTPUT_PROFILE_TRIGGER_INVALID' });
  assert.equal(exclusiveSelections, 1); assert.equal(finalReservations, 0);
  await assert.rejects(fs.lstat(outPath), { code: 'ENOENT' });
});
for (const profile of ['ATOMIC_HARDLINK', 'ATOMIC_REPLACE', 'EXCLUSIVE_CREATE']) test('Core receipt refusal preserves actual published ' + profile + ' output and truthful recovery', async t => {
  const { root } = await fixture(t), outPath = path.join(root, 'receipt-refused.zip'), bytes = Buffer.from('complete exact useful output');
  if (profile === 'ATOMIC_REPLACE') await fs.writeFile(outPath, 'previous selected output');
  const core = require('../../src/core/minimum-interchange-v1.cjs');
  let validated = 0, actualReceipt;
  const publish = publisherWithContract({ ...core, validateProjectArchiveOutputReceipt: (selected, receipt) => {
    validated++; actualReceipt = { ...receipt };
    assert.equal(selected.profileId, profile);
    assert.equal(receipt.readbackVerified, true); assert.equal(receipt.fileSynced, true);
    assert.equal(receipt.directorySynced, true); assert.equal(receipt.finalIdentityVerified, true);
    assert.equal(receipt.writeHandleClosed, true); assert.equal(receipt.stagingVerified, true);
    const invalid = { ...receipt, atomicPublication: !receipt.atomicPublication };
    return core.validateProjectArchiveOutputReceipt(selected, invalid);
  } });
  let failed;
  await assert.rejects(publish({ outPath, buffer: bytes, fsPort: profile === 'EXCLUSIVE_CREATE' ? { ...fs, link: noHardlink } : fs }), error => {
    failed = error.details.publication;
    assert.equal(error.code, 'E_PROJECT_ARCHIVE_OUTPUT_CONTRACT_INVALID');
    assert.equal(failed.namePublished, true); assert.equal(failed.readbackVerified, true);
    assert.equal(failed.contractVerified, false); assert.equal(failed.recoveryRequired, true);
    assert.equal(failed.recovery.stagingVerified, profile !== 'ATOMIC_REPLACE'); return true;
  });
  assert.equal(validated, 1); assert.equal(actualReceipt.atomicPublication, profile !== 'EXCLUSIVE_CREATE');
  assert.deepEqual(await fs.readFile(outPath), bytes);
  if (profile === 'ATOMIC_REPLACE') await assert.rejects(fs.lstat(failed.recovery.stagingPath), { code: 'ENOENT' });
  else assert.deepEqual(await fs.readFile(failed.recovery.stagingPath), bytes);
});

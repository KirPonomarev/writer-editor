'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const archive = require('../../src/export/archive/projectArchiveExportHandler');
const { publishProjectArchiveOutput } = require('../../src/main/projectArchiveOutputPublication.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-correctness-'));
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

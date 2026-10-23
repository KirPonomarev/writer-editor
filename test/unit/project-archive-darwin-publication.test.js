'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createProjectArchiveDarwinPublisher, defaultHelperPath } = require('../../src/main/projectArchiveDarwinPublication.cjs');
const { buildProjectArchiveNative } = require('../../scripts/build-project-archive-native.cjs');
let runtime, helperPath;
before(async () => {
  runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-native-test-'));
  runtime = await fs.realpath(runtime);
  helperPath = path.join(runtime, 'project-archive-fs');
  if (process.platform === 'darwin') buildProjectArchiveNative({ outputPath: helperPath });
});
after(async () => fs.rm(runtime, { recursive: true, force: true }));
async function fixture(t) {
  const parent = await fs.mkdtemp(path.join(runtime, 'parent-'));
  const tempRoot = path.join(parent, '.own-staging'), targetRoot = path.join(parent, 'Project');
  await fs.mkdir(tempRoot); await fs.writeFile(path.join(tempRoot, 'source.txt'), 'complete source');
  return { parent, tempRoot, targetRoot, parentIdentity: await fs.lstat(parent, { bigint: true }),
    stagingIdentity: await fs.lstat(tempRoot, { bigint: true }) };
}
async function unsupported() {
  await assert.rejects(createProjectArchiveDarwinPublisher({ platform: 'unsupported' })({}), { code: 'E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE' });
}
test('directory publication refuses unavailable platform without a replacing fallback', unsupported);
test('fixed helper resolves source Electron and packaged application separately', () => {
  assert.equal(defaultHelperPath({ isPackaged: false }), path.resolve(__dirname, '../../dist/native/project-archive-fs'));
  assert.equal(defaultHelperPath({ isPackaged: true, resourcesPath: '/synthetic/Resources' }), '/synthetic/Resources/yalken-native/project-archive-fs');
});
const scope = process.platform === 'darwin' ? 'actual Darwin filesystem' : 'unsupported platform refusal';
test(scope + ': absent destination publishes the complete exact staged inode', async t => {
  if (process.platform !== 'darwin') return unsupported();
  const input = await fixture(t), receipt = await createProjectArchiveDarwinPublisher({ helperPath })(input);
  assert.equal(receipt.namePublished, true); assert.equal(receipt.directorySynced, true);
  assert.equal(receipt.finalIdentityObserved, true);
  assert.equal((await fs.lstat(input.targetRoot, { bigint: true })).ino, input.stagingIdentity.ino);
  assert.equal(await fs.readFile(path.join(input.targetRoot, 'source.txt'), 'utf8'), 'complete source');
  await assert.rejects(fs.lstat(input.tempRoot), { code: 'ENOENT' });
});
for (const kind of ['empty directory', 'nonempty directory', 'file', 'symlink']) {
  test(scope + ': preserves a late foreign ' + kind, async t => {
    if (process.platform !== 'darwin') return unsupported();
    const input = await fixture(t), sentinel = path.join(input.parent, 'sentinel');
    await fs.writeFile(sentinel, 'foreign content');
    let original;
    input.assertCurrent = async () => {
      if (kind.includes('directory')) {
        await fs.mkdir(input.targetRoot);
        if (kind === 'nonempty directory') await fs.writeFile(path.join(input.targetRoot, 'foreign.txt'), 'foreign content');
      } else if (kind === 'file') await fs.writeFile(input.targetRoot, 'foreign content');
      else await fs.symlink(sentinel, input.targetRoot);
      original = await fs.lstat(input.targetRoot, { bigint: true });
    };
    await assert.rejects(createProjectArchiveDarwinPublisher({ helperPath })(input), error => {
      assert.equal(error.details.publication.namePublished, false);
      assert.equal(error.details.publication.publicationOutcome, 'REFUSED'); return true;
    });
    assert.equal((await fs.lstat(input.targetRoot, { bigint: true })).ino, original.ino);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'foreign content');
    if (kind === 'nonempty directory') assert.equal(await fs.readFile(path.join(input.targetRoot, 'foreign.txt'), 'utf8'), 'foreign content');
    if (kind === 'file') assert.equal(await fs.readFile(input.targetRoot, 'utf8'), 'foreign content');
    assert.equal((await fs.lstat(input.tempRoot, { bigint: true })).ino, input.stagingIdentity.ino);
  });
}
for (const kind of ['parent', 'staging']) {
  test(scope + ': refuses replaced ' + kind + ' identity', async t => {
    if (process.platform !== 'darwin') return unsupported();
    const input = await fixture(t);
    const target = kind === 'parent' ? input.parent : input.tempRoot;
    await fs.rename(target, target + '-original'); await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'foreign.txt'), 'foreign');
    const before = await fs.lstat(target, { bigint: true });
    await assert.rejects(createProjectArchiveDarwinPublisher({ helperPath })(input), { code: 'E_PROJECT_ARCHIVE_DIRECTORY_IDENTITY_CHANGED' });
    assert.equal((await fs.lstat(target, { bigint: true })).ino, before.ino);
    assert.equal(await fs.readFile(path.join(target, 'foreign.txt'), 'utf8'), 'foreign');
  });
}
test(scope + ': missing helper is unavailable and does not publish', async t => {
  if (process.platform !== 'darwin') return unsupported();
  const input = await fixture(t);
  await assert.rejects(createProjectArchiveDarwinPublisher({ helperPath: path.join(runtime, 'missing') })(input), { code: 'E_PROJECT_ARCHIVE_DIRECTORY_PRIMITIVE_UNAVAILABLE' });
  await assert.rejects(fs.lstat(input.targetRoot), { code: 'ENOENT' });
});
test(scope + ': observed native publication survives a failed final identity observation', async t => {
  if (process.platform !== 'darwin') return unsupported();
  const input = await fixture(t), original = fs.lstat;
  fs.lstat = async (target, ...args) => {
    if (target === input.targetRoot) throw Object.assign(Error('injected observation loss'), { code: 'EACCES' });
    return original(target, ...args);
  };
  try {
    await assert.rejects(createProjectArchiveDarwinPublisher({ helperPath })(input), error => {
      assert.equal(error.details.publication.namePublished, true);
      assert.equal(error.details.publication.finalIdentityObserved, false);
      assert.equal(error.details.publication.publicationOutcome, 'PUBLISHED_UNVERIFIED'); return true;
    });
  } finally { fs.lstat = original; }
  assert.equal((await fs.lstat(input.targetRoot, { bigint: true })).ino, input.stagingIdentity.ino);
  assert.equal(await fs.readFile(path.join(input.targetRoot, 'source.txt'), 'utf8'), 'complete source');
});

const { createDarwinExclusiveFilePublisher } = require('../../src/main/projectArchiveDarwinPublication.cjs');
const externalRoot = process.env.YALKEN_MANUAL_MAP_TEST_ARTIFACT_ROOT;
const fileRoots = [{ label: 'APFS', root: () => runtime }, ...(externalRoot ? [{ label: 'external physical volume', root: () => externalRoot }] : [])];
async function fileFixture(t, root) {
  await fs.mkdir(root, { recursive: true });
  const parent = await fs.mkdtemp(path.join(root, 'exclusive-file-'));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const sourcePath = path.join(parent, '.reserved.next'), targetPath = path.join(parent, 'map.json');
  await fs.writeFile(sourcePath, 'Резерв e\u0301 🧭\n');
  return { parent, sourcePath, targetPath, before: await fs.lstat(sourcePath, { bigint: true }), bytes: await fs.readFile(sourcePath) };
}
async function unsupportedFile() {
  await assert.rejects(createDarwinExclusiveFilePublisher({ platform: 'unsupported' })({}), { code: 'E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE' });
  await assert.rejects(createDarwinExclusiveFilePublisher({ platform: 'unsupported' }).assertAvailable({}), { code: 'E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE' });
}
for (const row of fileRoots) {
  test(row.label + ': actual regular-file publisher retains reserved inode and bytes, with no leftover copy', async t => {
    if (process.platform !== 'darwin') return unsupportedFile();
    const input = await fileFixture(t, row.root());
    const receipt = await createDarwinExclusiveFilePublisher({ helperPath })(input);
    assert.equal(receipt.publicationOutcome, 'PUBLISHED'); assert.equal(receipt.directorySynced, true);
    assert.deepEqual(await fs.readFile(input.targetPath), input.bytes);
    const after = await fs.lstat(input.sourcePath, { bigint: true });
    assert.equal(after.dev, input.before.dev); assert.equal(after.ino, input.before.ino);
    assert.deepEqual(await fs.readFile(input.sourcePath), input.bytes);
    assert.equal((await fs.readdir(input.parent)).some(name => name.startsWith('.stage10-publish-')), false);
    t.diagnostic(JSON.stringify({ sourceDev: String(after.dev), sourceIno: String(after.ino), receipt }));
  });
  for (const kind of ['file', 'directory', 'symlink']) test(row.label + ': exclusive file publication preserves late foreign ' + kind, async t => {
    if (process.platform !== 'darwin') return unsupportedFile();
    const input = await fileFixture(t, row.root()); let calls = 0, targetIdentity;
    const sentinel = path.join(input.parent, 'sentinel.txt'); await fs.writeFile(sentinel, 'FOREIGN');
    input.assertCurrent = async () => {
      if (++calls !== 2) return;
      if (kind === 'file') await fs.writeFile(input.targetPath, 'FOREIGN');
      if (kind === 'directory') await fs.mkdir(input.targetPath);
      if (kind === 'symlink') await fs.symlink(sentinel, input.targetPath);
      targetIdentity = await fs.lstat(input.targetPath, { bigint: true });
    };
    await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath })(input), error => {
      assert.equal(error.details.publication.publicationOutcome, 'REFUSED'); return true;
    });
    assert.equal((await fs.lstat(input.targetPath, { bigint: true })).ino, targetIdentity.ino);
    assert.deepEqual(await fs.readFile(input.sourcePath), input.bytes);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'FOREIGN');
    if (kind === 'file') assert.equal(await fs.readFile(input.targetPath, 'utf8'), 'FOREIGN');
  });
  for (const kind of ['parent', 'source']) test(row.label + ': file publication refuses changed ' + kind + ' before native execution', async t => {
    if (process.platform !== 'darwin') return unsupportedFile();
    const input = await fileFixture(t, row.root()); let calls = 0;
    input.assertCurrent = async () => {
      if (++calls !== 2) return;
      if (kind === 'source') {
        await fs.rename(input.sourcePath, input.sourcePath + '.original'); await fs.writeFile(input.sourcePath, 'FOREIGN');
      } else {
        await fs.rename(input.parent, input.parent + '.original'); await fs.mkdir(input.parent);
        t.after(() => fs.rm(input.parent + '.original', { recursive: true, force: true }));
      }
    };
    await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath })(input));
    await assert.rejects(fs.lstat(input.targetPath), { code: 'ENOENT' });
    const original = kind === 'source' ? input.sourcePath + '.original' : path.join(input.parent + '.original', path.basename(input.sourcePath));
    assert.deepEqual(await fs.readFile(original), input.bytes);
    assert.equal((await fs.lstat(original, { bigint: true })).ino, input.before.ino);
  });
}
test('regular-file publisher retains an actual published outcome when final observation fails', async t => {
  if (process.platform !== 'darwin') return unsupportedFile();
  const input = await fileFixture(t, runtime), original = fs.lstat;
  fs.lstat = async (target, ...args) => {
    if (target === input.targetPath) throw Object.assign(Error('observation failure'), { code: 'EACCES' });
    return original(target, ...args);
  };
  try {
    await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath })(input), error => {
      assert.equal(error.details.publication.namePublished, true);
      assert.equal(error.details.publication.publicationOutcome, 'PUBLISHED_UNVERIFIED'); return true;
    });
  } finally { fs.lstat = original; }
  assert.deepEqual(await fs.readFile(input.sourcePath), input.bytes); assert.deepEqual(await fs.readFile(input.targetPath), input.bytes);
});

test('actual APFS regular-file capability query is read-only and binds the parent identity', async t => {
  if (process.platform !== 'darwin') return unsupportedFile();
  const input = await fileFixture(t, runtime); await fs.writeFile(input.targetPath, 'PREVIOUS');
  const before = await fs.lstat(input.targetPath, { bigint: true }), names = await fs.readdir(input.parent);
  const receipt = await createDarwinExclusiveFilePublisher({ helperPath }).assertAvailable(input);
  assert.equal(receipt.available, true); assert.equal(receipt.readOnly, true);
  assert.equal(receipt.parentIdentity.ino, String((await fs.lstat(input.parent, { bigint: true })).ino));
  assert.equal((await fs.lstat(input.targetPath, { bigint: true })).ino, before.ino);
  assert.equal(await fs.readFile(input.targetPath, 'utf8'), 'PREVIOUS'); assert.deepEqual(await fs.readdir(input.parent), names);
});

for (const kind of ['false', 'unknown', 'malformed', 'contradictory']) test('file capability refuses finite helper ' + kind + ' output without publication', async t => {
  if (process.platform !== 'darwin') return unsupportedFile();
  const input = await fileFixture(t, runtime); await fs.writeFile(input.targetPath, 'PREVIOUS');
  const native = { schemaVersion: 1, ok: false, phase: kind === 'unknown' ? 'CAPABILITY_UNKNOWN' : 'CAPABILITY_UNAVAILABLE', errno: 45, namePublished: false, directorySynced: false };
  if (kind === 'contradictory') Object.assign(native, { ok: true, phase: 'CAPABILITY_AVAILABLE', errno: 0, namePublished: true });
  const output = kind === 'malformed' ? '{}' : JSON.stringify(native), finiteHelper = path.join(runtime, 'finite-capability-' + kind);
  await fs.writeFile(finiteHelper, "#!/bin/sh\nprintf '%s\\n' '" + output + "'\n", { mode: 0o700, flag: 'wx' });
  const before = await fs.lstat(input.targetPath, { bigint: true });
  await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath: finiteHelper }).assertAvailable(input), { code: 'E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE' });
  assert.equal((await fs.lstat(input.targetPath, { bigint: true })).ino, before.ino);
  assert.equal(await fs.readFile(input.targetPath, 'utf8'), 'PREVIOUS'); assert.deepEqual(await fs.readFile(input.sourcePath), input.bytes);
  assert.equal((await fs.readdir(input.parent)).some(name => name.startsWith('.stage10-publish-')), false);
});

test('file capability refuses a current lease failure before native query', async t => {
  if (process.platform !== 'darwin') return unsupportedFile();
  const input = await fileFixture(t, runtime); input.assertCurrent = async () => { throw Object.assign(Error('stale lease'), { code: 'E_PROJECT_LEASE_OWNERSHIP_LOST' }); };
  await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath }).assertAvailable(input), { code: 'E_PROJECT_LEASE_OWNERSHIP_LOST' });
  assert.deepEqual(await fs.readFile(input.sourcePath), input.bytes); await assert.rejects(fs.lstat(input.targetPath), { code: 'ENOENT' });
});

test('file capability refuses a replaced parent while preserving both original and foreign names', async t => {
  if (process.platform !== 'darwin') return unsupportedFile();
  const input = await fileFixture(t, runtime); await fs.writeFile(input.targetPath, 'PREVIOUS');
  const before = await fs.lstat(input.targetPath, { bigint: true }); let calls = 0;
  input.assertCurrent = async () => {
    if (++calls !== 2) return;
    await fs.rename(input.parent, input.parent + '.original'); await fs.mkdir(input.parent);
    t.after(() => fs.rm(input.parent + '.original', { recursive: true, force: true }));
    await fs.writeFile(path.join(input.parent, 'FOREIGN'), 'keep');
  };
  await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath }).assertAvailable(input), { code: 'E_PROJECT_ARCHIVE_DIRECTORY_IDENTITY_CHANGED' });
  const originalTarget = path.join(input.parent + '.original', path.basename(input.targetPath));
  assert.equal((await fs.lstat(originalTarget, { bigint: true })).ino, before.ino);
  assert.equal(await fs.readFile(originalTarget, 'utf8'), 'PREVIOUS'); assert.equal(await fs.readFile(path.join(input.parent, 'FOREIGN'), 'utf8'), 'keep');
});

const readonlyCapabilityRoot = process.env.YALKEN_MANUAL_MAP_READONLY_CAPABILITY_ROOT;
if (readonlyCapabilityRoot) test('actual T777 capability refusal preserves the existing target name inode and bytes without rename', async t => {
  if (process.platform !== 'darwin') return unsupportedFile();
  const input = await fileFixture(t, readonlyCapabilityRoot); await fs.writeFile(input.targetPath, 'PREVIOUS');
  const before = await fs.lstat(input.targetPath, { bigint: true }), names = await fs.readdir(input.parent);
  await assert.rejects(createDarwinExclusiveFilePublisher({ helperPath }).assertAvailable(input), error => {
    assert.equal(error.code, 'E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE'); assert.match(error.details.publication.phase, /^CAPABILITY_/u);
    assert.equal(error.details.publication.nativeErrno, 45); t.diagnostic(JSON.stringify(error.details.publication));
    assert.equal(error.details.publication.namePublished, false); return true;
  });
  assert.equal((await fs.lstat(input.targetPath, { bigint: true })).ino, before.ino);
  assert.equal(await fs.readFile(input.targetPath, 'utf8'), 'PREVIOUS'); assert.deepEqual(await fs.readFile(input.sourcePath), input.bytes);
  assert.deepEqual(await fs.readdir(input.parent), names);
  t.diagnostic('READ_ONLY_CAPABILITY_REFUSAL_NOT_POSITIVE_T777_PUBLICATION');
});

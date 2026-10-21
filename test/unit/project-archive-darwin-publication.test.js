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

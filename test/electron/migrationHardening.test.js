const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const fileManager = require('../../src/utils/fileManager');

const CRAFTSMAN = 'craftsman';
const LEGACY = 'WriterEditor';
const MARKER = '.migrated-from-writer-editor';

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'craftsman-migration-'));
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

test('migration retry: target without complete marker is repaired from legacy', async (t) => {
  const root = await makeTempRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const target = path.join(root, CRAFTSMAN);
  const legacy = path.join(root, LEGACY);

  await writeText(path.join(legacy, 'a.txt'), 'a');
  await writeText(path.join(legacy, 'nested', 'b.txt'), 'b');

  await writeText(path.join(target, 'a.txt'), 'a');

  await fileManager.migrateDocumentsFolderForPaths({ documentsPath: root });

  assert.equal(await readText(path.join(target, 'a.txt')), 'a');
  assert.equal(await readText(path.join(target, 'nested', 'b.txt')), 'b');
  assert.equal(await readText(path.join(target, MARKER)), 'migrated from WriterEditor');
});

test('migration marker guard: marker with missing legacy entries triggers repair', async (t) => {
  const root = await makeTempRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const target = path.join(root, CRAFTSMAN);
  const legacy = path.join(root, LEGACY);

  await writeText(path.join(legacy, 'a.txt'), 'a');
  await writeText(path.join(legacy, 'missing.txt'), 'm');

  await writeText(path.join(target, 'a.txt'), 'a');
  await writeText(path.join(target, MARKER), 'migrated from WriterEditor');

  await fileManager.migrateDocumentsFolderForPaths({ documentsPath: root });

  assert.equal(await readText(path.join(target, 'missing.txt')), 'm');
  assert.equal(await readText(path.join(target, MARKER)), 'migrated from WriterEditor');
});

test('migration marker guard: complete target remains unchanged', async (t) => {
  const root = await makeTempRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const target = path.join(root, CRAFTSMAN);
  const legacy = path.join(root, LEGACY);

  await writeText(path.join(legacy, 'a.txt'), 'legacy-a');
  await writeText(path.join(target, 'a.txt'), 'target-a');
  await writeText(path.join(target, MARKER), 'migrated from WriterEditor');

  await fileManager.migrateDocumentsFolderForPaths({ documentsPath: root });

  assert.equal(await readText(path.join(target, 'a.txt')), 'target-a');
});

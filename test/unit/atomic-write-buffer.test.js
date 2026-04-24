const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { writeBufferAtomic } = require('../../src/export/docx/atomicWriteBuffer');

async function listTempArtifacts(directory, baseName) {
  const entries = await fs.readdir(directory);
  return entries.filter((entry) => entry.startsWith(`${baseName}.`) && entry.endsWith('.tmp'));
}

test('writeBufferAtomic writes expected bytes through a temp filesystem success path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-atomic-write-'));
  const outPath = path.join(tempDir, 'export.docx');

  try {
    const documentBuffer = Buffer.from('docx-bytes-success');

    await writeBufferAtomic(outPath, documentBuffer);

    assert.equal(await fs.readFile(outPath, 'utf8'), 'docx-bytes-success');
    assert.deepEqual(await listTempArtifacts(tempDir, 'export.docx'), []);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('writeBufferAtomic replaces an existing destination in the normal success path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-atomic-replace-'));
  const outPath = path.join(tempDir, 'export.docx');

  try {
    await fs.writeFile(outPath, 'before');

    await writeBufferAtomic(outPath, Buffer.from('after'));

    assert.equal(await fs.readFile(outPath, 'utf8'), 'after');
    assert.deepEqual(await listTempArtifacts(tempDir, 'export.docx'), []);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('main export handler wires the extracted helper into the export coordinator', async () => {
  const mainSource = await fs.readFile(path.join(__dirname, '../../src/main.js'), 'utf8');

  assert.match(
    mainSource,
    /const \{ writeBufferAtomic \} = require\('\.\/export\/docx\/atomicWriteBuffer'\);/,
  );
  assert.match(mainSource, /runDocxMinExport\(payloadRaw, \{/);
  assert.match(mainSource, /\n\s+writeBufferAtomic,\n\s+updateStatus,/);
  assert.doesNotMatch(mainSource, /async function writeBufferAtomic\(/);
});

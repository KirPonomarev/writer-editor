const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadIoModule() {
  const root = process.cwd();
  return import(pathToFileURL(path.join(root, 'src', 'io', 'markdown', 'index.mjs')).href);
}

test('recovery human readable: recovery pack writes readable guide content and manifest with restore drill pass', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-human-readable-'));
  const target = path.join(dir, 'scene.md');
  fs.writeFileSync(target, 'Readable recovery baseline\n', 'utf8');

  const pack = await io.createMarkdownRecoveryPack(target, {
    now: () => 1700000003000,
    text: 'Readable recovery baseline\n',
    recoveryAction: 'ABORT',
    sourceKind: 'primary',
  });

  const guideText = fs.readFileSync(pack.guidePath, 'utf8');
  const contentText = fs.readFileSync(pack.contentPath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(pack.manifestPath, 'utf8'));
  const validation = await io.validateMarkdownRecoveryPack(pack.recoveryPackPath);
  const drill = await io.restoreMarkdownRecoveryDrill(pack.recoveryPackPath);

  assert.equal(guideText.includes('Review content.md as the human-readable recovery source.'), true);
  assert.equal(guideText.includes('Restore instructions'), true);
  assert.equal(contentText, 'Readable recovery baseline\n');
  assert.equal(manifest.contentFile, 'content.md');
  assert.equal(manifest.recoveryAction, 'ABORT');
  assert.equal(manifest.textHash, io.computeSha256Bytes(Buffer.from(contentText, 'utf8')));
  assert.equal(validation.ok, true);
  assert.equal(drill.ok, true);
  assert.equal(drill.textHash, manifest.textHash);
  assert.equal(drill.expectedTextHash, manifest.textHash);
});

test('recovery human readable: tampered content fails validation and restore drill is rejected', async () => {
  const io = await loadIoModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-human-readable-tamper-'));
  const target = path.join(dir, 'scene.md');
  fs.writeFileSync(target, 'Stable recovery text\n', 'utf8');

  const pack = await io.createMarkdownRecoveryPack(target, {
    now: () => 1700000004000,
    text: 'Stable recovery text\n',
    recoveryAction: 'OPEN_SNAPSHOT',
    sourceKind: 'snapshot',
  });

  fs.writeFileSync(pack.contentPath, 'Tampered recovery text\n', 'utf8');

  const validation = await io.validateMarkdownRecoveryPack(pack.recoveryPackPath);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('textHash mismatch'), true);

  await assert.rejects(
    io.restoreMarkdownRecoveryDrill(pack.recoveryPackPath),
    (error) => {
      assert.equal(error.code, 'E_IO_RECOVERY_PACK_INVALID');
      assert.equal(error.reason, 'recovery_pack_invalid');
      assert.equal(Array.isArray(error.details.failures), true);
      assert.equal(error.details.failures.includes('textHash mismatch'), true);
      return true;
    },
  );
});

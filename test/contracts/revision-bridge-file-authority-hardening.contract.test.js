const test = require('node:test');
const assert = require('node:assert/strict');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const DOCX_EXPORT_HANDLER_PATH = path.join(
  REPO_ROOT,
  'src',
  'export',
  'docx',
  'docxMinExportHandler.js',
);
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_FILE_AUTHORITY_HARDENING_001_STATUS.json',
);

const {
  inspectExternalReadSource,
  readExternalFileBounded,
  validateExternalWriteTarget,
} = require('../../src/utils/externalFileAuthority');

async function makeWorkspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revision-bridge-file-authority-'));
  const projectRoot = path.join(root, 'project');
  const externalRoot = path.join(root, 'external');
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(externalRoot, { recursive: true });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, projectRoot, externalRoot };
}

async function expectAuthorityReason(operation, reason) {
  await assert.rejects(operation, (error) => {
    assert.equal(error?.code, 'E_EXTERNAL_FILE_AUTHORITY');
    assert.equal(error?.reason, reason);
    return true;
  });
}

test('Phase 03 bounded reader returns only the stable external file bytes', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const sourcePath = path.join(externalRoot, 'import.md');
  await fs.writeFile(sourcePath, '# Stable\n', 'utf8');

  const result = await readExternalFileBounded(sourcePath, {
    projectRoot,
    allowedExtensions: ['.md', '.markdown'],
    maxBytes: 1024,
  });

  assert.equal(result.bytes.toString('utf8'), '# Stable\n');
  assert.equal(result.byteLength, 9);
  assert.equal(result.identity.size, 9);
  assert.equal(path.isAbsolute(result.identity.realPath), true);
});

test('Phase 03 bounded reader rejects oversized input before parsing', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const sourcePath = path.join(externalRoot, 'oversized.docx');
  await fs.writeFile(sourcePath, Buffer.alloc(33, 1));

  await expectAuthorityReason(
    () => readExternalFileBounded(sourcePath, {
      projectRoot,
      allowedExtensions: ['.docx'],
      maxBytes: 32,
    }),
    'EXTERNAL_SOURCE_TOO_LARGE',
  );
});

test('Phase 03 bounded reader detects same-size replacement during read', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const sourcePath = path.join(externalRoot, 'replace.txt');
  const replacementPath = path.join(externalRoot, 'replacement.txt');
  await fs.writeFile(sourcePath, 'before', 'utf8');
  await fs.writeFile(replacementPath, 'after!', 'utf8');

  await expectAuthorityReason(
    () => readExternalFileBounded(sourcePath, {
      projectRoot,
      allowedExtensions: ['.txt'],
      maxBytes: 64,
      afterRead: async () => {
        if (process.platform === 'win32') {
          await fs.writeFile(sourcePath, 'after!', 'utf8');
          return;
        }
        await fs.rename(replacementPath, sourcePath);
      },
    }),
    'EXTERNAL_SOURCE_CHANGED_DURING_READ',
  );
});

test('Phase 03 input authority rejects project internals including project JSON', async (t) => {
  const { projectRoot } = await makeWorkspace(t);
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  await fs.writeFile(manifestPath, '{}\n', 'utf8');

  await expectAuthorityReason(
    () => inspectExternalReadSource(manifestPath, {
      projectRoot,
      allowedExtensions: ['.json'],
      maxBytes: 1024,
    }),
    'EXTERNAL_SOURCE_INSIDE_PROJECT_DENIED',
  );
});

test('Phase 03 input authority rejects symlink sources', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const sourcePath = path.join(externalRoot, 'source.md');
  const linkPath = path.join(externalRoot, 'source-link.md');
  await fs.writeFile(sourcePath, 'text\n', 'utf8');
  try {
    await fs.symlink(sourcePath, linkPath);
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error?.code)) {
      t.skip('symlink creation is not permitted on this Windows runner');
      return;
    }
    throw error;
  }

  await expectAuthorityReason(
    () => readExternalFileBounded(linkPath, {
      projectRoot,
      allowedExtensions: ['.md'],
      maxBytes: 1024,
    }),
    'EXTERNAL_SOURCE_SYMLINK_DENIED',
  );
});

test('Phase 03 target authority denies logical project targets and protected sources', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const scenePath = path.join(projectRoot, 'roman', 'scene.txt');
  const externalSource = path.join(externalRoot, 'source.md');
  await fs.mkdir(path.dirname(scenePath), { recursive: true });
  await fs.writeFile(scenePath, 'scene\n', 'utf8');
  await fs.writeFile(externalSource, 'source\n', 'utf8');

  await expectAuthorityReason(
    () => validateExternalWriteTarget(path.join(projectRoot, 'export.md'), {
      projectRoot,
      allowedExtensions: ['.md'],
    }),
    'EXTERNAL_TARGET_INSIDE_PROJECT_DENIED',
  );
  await expectAuthorityReason(
    () => validateExternalWriteTarget(externalSource, {
      projectRoot,
      sourcePaths: [externalSource],
      allowedExtensions: ['.md'],
    }),
    'EXTERNAL_TARGET_MATCHES_PROTECTED_SOURCE',
  );
});

test('Phase 03 target authority rejects symlink leaf and parent escape', async (t) => {
  const { root, projectRoot, externalRoot } = await makeWorkspace(t);
  const outsideFile = path.join(externalRoot, 'outside.md');
  const leafLink = path.join(externalRoot, 'leaf.md');
  const projectLink = path.join(root, 'project-link');
  await fs.writeFile(outsideFile, 'outside\n', 'utf8');
  try {
    await fs.symlink(outsideFile, leafLink);
    await fs.symlink(projectRoot, projectLink, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error?.code)) {
      t.skip('symlink creation is not permitted on this Windows runner');
      return;
    }
    throw error;
  }

  await expectAuthorityReason(
    () => validateExternalWriteTarget(leafLink, {
      projectRoot,
      allowedExtensions: ['.md'],
    }),
    'EXTERNAL_TARGET_SYMLINK_DENIED',
  );
  await assert.rejects(
    () => validateExternalWriteTarget(path.join(projectLink, 'escape.md'), {
      projectRoot,
      allowedExtensions: ['.md'],
    }),
    (error) => {
      assert.equal(error?.code, 'E_EXTERNAL_FILE_AUTHORITY');
      assert.equal([
        'EXTERNAL_TARGET_INSIDE_PROJECT_DENIED',
        'EXTERNAL_TARGET_PARENT_DIRECTORY_REQUIRED',
      ].includes(error?.reason), true);
      return true;
    },
  );
});

test('Phase 03 target authority allows a normal external Save As target', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const targetPath = path.join(externalRoot, 'export.json');

  const result = await validateExternalWriteTarget(targetPath, {
    projectRoot,
    allowedExtensions: ['.json'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.targetPath, path.resolve(targetPath));
  assert.equal(result.targetExists, false);
});

test('Phase 03 queue-time target replacement is rejected with zero writes', async (t) => {
  const { projectRoot, externalRoot } = await makeWorkspace(t);
  const projectScene = path.join(projectRoot, 'roman', 'scene.md');
  const targetPath = path.join(externalRoot, 'export.md');
  await fs.mkdir(path.dirname(projectScene), { recursive: true });
  await fs.writeFile(projectScene, 'canonical\n', 'utf8');

  await validateExternalWriteTarget(targetPath, {
    projectRoot,
    allowedExtensions: ['.md'],
  });
  try {
    await fs.symlink(projectScene, targetPath);
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error?.code)) {
      t.skip('symlink creation is not permitted on this Windows runner');
      return;
    }
    throw error;
  }

  let writes = 0;
  await assert.rejects(async () => {
    await validateExternalWriteTarget(targetPath, {
      projectRoot,
      allowedExtensions: ['.md'],
    });
    writes += 1;
  }, (error) => {
    assert.equal(error?.code, 'E_EXTERNAL_FILE_AUTHORITY');
    assert.equal(error?.reason, 'EXTERNAL_TARGET_SYMLINK_DENIED');
    return true;
  });
  assert.equal(writes, 0);
  assert.equal(await fs.readFile(projectScene, 'utf8'), 'canonical\n');
});

test('Phase 03 shared authority port is wired across all supported external file contours', () => {
  const mainSource = fsSync.readFileSync(MAIN_PATH, 'utf8');
  const docxExportSource = fsSync.readFileSync(DOCX_EXPORT_HANDLER_PATH, 'utf8');

  assert.match(mainSource, /require\('\.\/utils\/externalFileAuthority'\)/u);
  assert.match(mainSource, /async function readReviewImportLocalPacketText[\s\S]*readExternalFileBounded/u);
  assert.match(mainSource, /async function readDocxReviewPreviewSessionLocalFileBytes[\s\S]*readExternalFileBounded/u);
  assert.match(mainSource, /async function readDocxImportLocalFilePreviewBytes[\s\S]*readExternalFileBounded/u);
  assert.match(mainSource, /async function readTxtImportLocalFilePreviewBytes[\s\S]*readExternalFileBounded/u);
  assert.match(mainSource, /handleMarkdownImportLocalFilePreviewCommandSurface[\s\S]*readExternalFileBounded/u);

  assert.match(mainSource, /handleReviewSurfaceExportLocalPacketCommandSurface[\s\S]*validateExternalWriteTarget/u);
  assert.match(mainSource, /validateTxtExportPhysicalTargetPath[\s\S]*validateExternalWriteTarget/u);
  assert.match(mainSource, /validateDocxExportTarget[\s\S]*validateExternalWriteTarget/u);
  assert.match(mainSource, /handleExportMarkdownV1[\s\S]*validateExternalWriteTarget/u);
  assert.match(docxExportSource, /validateDocxExportTarget\(outPath, payload\)/u);
  assert.match(docxExportSource, /queueDiskOperation\(async \(\) => \{[\s\S]*validateDocxExportTarget\(outPath, payload\)/u);
});

test('Phase 03 status stays implementation-bound without claiming Markdown product completion', () => {
  const status = JSON.parse(fsSync.readFileSync(STATUS_PATH, 'utf8'));

  assert.equal(status.taskId, 'REVIEW_BRIDGE_FILE_AUTHORITY_HARDENING_001');
  assert.equal(status.status, 'implemented_verified_pending_delivery');
  assert.equal(status.baseSha, 'f0b8a11c345298b9a4c0080fbffdde8d8cb8fa13');
  assert.equal(status.scope.sharedExternalFileAuthority, true);
  assert.equal(status.scope.newDependenciesAdded, false);
  assert.equal(status.scope.rendererChanged, false);
  assert.equal(status.readAuthority.boundedAllocation, true);
  assert.equal(status.writeAuthority.validationRepeatedInsideDiskQueue, true);
  assert.equal(status.markdownAuthorityPort.visibleProductBinding, false);
  assert.equal(status.markdownAuthorityPort.canonicalSavedSceneSerialization, false);
  assert.equal(status.delivery.status, 'pending');
  assert.equal(status.nonClaims.some((claim) => claim.includes('Phase 04')), true);
});

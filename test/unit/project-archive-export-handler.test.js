const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  ARCHIVE_SCHEMA_VERSION,
  buildProjectArchiveBuffer,
  runProjectArchiveExport,
  verifyProjectArchiveBuffer,
} = require('../../src/export/archive/projectArchiveExportHandler');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function writeFixtureProject(t) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-project-archive-'));
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));
  const projectRoot = path.join(tempRoot, 'Project Alpha');
  await fs.mkdir(path.join(projectRoot, 'roman', 'Part One'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'assets'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'backups'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'recovery'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    projectId: 'project-alpha',
    projectName: 'Project Alpha',
    proUnknown: {
      preserved: true,
      nested: { graph: ['entity-a', 'timeline-a'] },
    },
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(path.join(projectRoot, 'project.craftsman.json'), manifestText, 'utf8');
  await fs.writeFile(path.join(projectRoot, 'roman', 'Part One', 'Scene 01.txt'), 'scene text', 'utf8');
  await fs.writeFile(path.join(projectRoot, 'notes.json'), '{"notes":[{"id":"n1"}]}\n', 'utf8');
  await fs.writeFile(path.join(projectRoot, 'assets', 'cover.bin'), Buffer.from([0, 1, 2, 3]));
  await fs.writeFile(path.join(projectRoot, 'backups', 'scene.bak'), 'backup text', 'utf8');
  await fs.writeFile(path.join(projectRoot, 'recovery', 'snapshot.txt'), 'readable recovery', 'utf8');
  return { projectRoot, manifestText };
}

test('project archive buffer contains full project manifest, unknown data, and checksums', async (t) => {
  const { projectRoot, manifestText } = await writeFixtureProject(t);

  const archive = await buildProjectArchiveBuffer(projectRoot, {
    createdAtUtc: '2026-07-19T00:00:00.000Z',
  });
  const verified = verifyProjectArchiveBuffer(archive.buffer);

  assert.equal(archive.ok, true);
  assert.equal(verified.ok, true);
  assert.equal(verified.manifest.schemaVersion, ARCHIVE_SCHEMA_VERSION);
  assert.equal(verified.manifest.project.projectId, 'project-alpha');
  assert.equal(verified.manifest.project.manifestSha256, sha256(Buffer.from(manifestText, 'utf8')));
  assert.equal(verified.manifest.source.localOnly, true);
  assert.equal(verified.manifest.source.networkRequired, false);
  assert.equal(verified.manifest.source.sourceProjectMutated, false);

  const archivePaths = verified.manifest.entries.map((entry) => entry.archivePath).sort();
  for (const expectedPath of [
    'project/project.craftsman.json',
    'project/roman/Part One/Scene 01.txt',
    'project/notes.json',
    'project/assets/cover.bin',
    'project/backups/scene.bak',
    'project/recovery/snapshot.txt',
  ]) {
    assert.ok(archivePaths.includes(expectedPath), expectedPath);
  }
});

test('project archive verifier detects corrupted entry payload', async (t) => {
  const { projectRoot } = await writeFixtureProject(t);
  const archive = await buildProjectArchiveBuffer(projectRoot);
  const corrupted = Buffer.from(archive.buffer);
  const needle = Buffer.from('scene text', 'utf8');
  const offset = corrupted.indexOf(needle);
  assert.notEqual(offset, -1);
  corrupted[offset] = corrupted[offset] ^ 0xff;

  assert.throws(
    () => verifyProjectArchiveBuffer(corrupted),
    /zip_crc_mismatch|archive_checksum_mismatch/u,
  );
});

test('project archive export writes verified archive atomically and rejects renderer authority', async (t) => {
  const { projectRoot } = await writeFixtureProject(t);
  const calls = {
    targetChecks: 0,
    writtenPath: '',
    writtenBuffer: null,
    status: '',
  };

  const result = await runProjectArchiveExport(
    {
      confirmed: true,
      requestId: 'archive-test',
      outPath: '/tmp/project.yalken.zip',
      createdAtUtc: '2026-07-19T00:00:00.000Z',
    },
    {
      normalizeProjectArchiveExportPayload(payload) {
        return {
          confirmed: payload.confirmed === true,
          requestId: payload.requestId,
          outPath: payload.outPath,
          createdAtUtc: payload.createdAtUtc,
        };
      },
      makeTypedProjectArchiveExportError(code, reason, details) {
        return { ok: false, error: { code, reason, details } };
      },
      readProjectArchiveExportSource() {
        return {
          projectRoot,
          projectId: 'project-alpha',
          sourcePaths: [path.join(projectRoot, 'project.craftsman.json')],
        };
      },
      resolveProjectArchiveExportPath(payload) {
        return { canceled: false, outPath: payload.outPath };
      },
      validateProjectArchiveExportTarget(outPath, source) {
        calls.targetChecks += 1;
        assert.equal(outPath, '/tmp/project.yalken.zip');
        assert.equal(source.projectRoot, projectRoot);
        return { ok: true, outPath };
      },
      queueDiskOperation(operation, label) {
        assert.equal(label, 'export project archive');
        return operation();
      },
      writeBufferAtomic(outPath, buffer) {
        calls.writtenPath = outPath;
        calls.writtenBuffer = buffer;
      },
      updateStatus(status) {
        calls.status = status;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.exported, true);
  assert.equal(result.verified, true);
  assert.equal(result.sourceProjectMutated, false);
  assert.equal(result.archiveManifest.schemaVersion, ARCHIVE_SCHEMA_VERSION);
  assert.equal(calls.targetChecks, 2);
  assert.equal(calls.writtenPath, '/tmp/project.yalken.zip');
  assert.equal(calls.status, 'Архив проекта экспортирован');
  assert.equal(verifyProjectArchiveBuffer(calls.writtenBuffer).ok, true);

  const rejected = await runProjectArchiveExport(
    {
      confirmed: true,
      projectRoot,
    },
    {
      normalizeProjectArchiveExportPayload() {
        return {
          ok: false,
          code: 'E_PROJECT_ARCHIVE_EXPORT_PAYLOAD_INVALID',
          reason: 'project_archive_export_renderer_authority_denied',
          details: { fields: ['projectRoot'] },
        };
      },
      makeTypedProjectArchiveExportError(code, reason, details) {
        return { ok: false, error: { code, reason, details } };
      },
    },
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.reason, 'project_archive_export_renderer_authority_denied');
  assert.deepEqual(rejected.error.details.fields, ['projectRoot']);
});

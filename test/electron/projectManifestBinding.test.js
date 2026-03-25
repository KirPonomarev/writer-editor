const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');

const { isPathInsideBoundary } = require('../../src/core/io/path-boundary');

const MAIN_SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'main.js'), 'utf8');
const DEFAULT_PROJECT_NAME = 'Роман';
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';
const PROJECT_MANIFEST_SCHEMA_VERSION = 1;

function extractSnippet(startMarker, endMarker) {
  const start = MAIN_SOURCE.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Start marker not found: ${startMarker}`);
  }

  const end = MAIN_SOURCE.indexOf(endMarker, start);
  if (end < 0) {
    throw new Error(`End marker not found: ${endMarker}`);
  }

  return MAIN_SOURCE.slice(start, end).trim();
}

function buildHarness(documentsPath) {
  const writes = [];
  const fileManager = {
    getDocumentsPath: () => documentsPath,
    writeFileAtomic: async (filePath, content) => {
      writes.push({ filePath, content });
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, content, 'utf8');
      return { success: true };
    },
  };

  const context = {
    fs: fsp,
    path,
    crypto,
    fileManager,
    queueDiskOperation: async (operation) => operation(),
    DEFAULT_PROJECT_NAME,
    PROJECT_MANIFEST_FILENAME,
    PROJECT_MANIFEST_SCHEMA_VERSION,
    isPathInsideBoundary,
    fileExists: async (candidate) => {
      try {
        await fsp.access(candidate);
        return true;
      } catch {
        return false;
      }
    },
  };

  vm.createContext(context);
  const snippets = [
    extractSnippet('function sanitizeFilename(', 'const ROMAN_SECTION_FILENAME_SET ='),
    extractSnippet('function getProjectRootPath(', 'function getProjectSectionPath('),
    extractSnippet('function getProjectManifestPath(', 'function buildSectionDefinitions('),
    extractSnippet('function createStableProjectId(', 'function normalizeProjectManifest('),
    extractSnippet('function normalizeProjectManifest(', 'async function readProjectManifest('),
    extractSnippet('async function readProjectManifest(', 'async function ensureProjectManifest('),
    extractSnippet('async function ensureProjectManifest(', 'async function resolveProjectBindingForFile('),
    extractSnippet('async function resolveProjectBindingForFile(', 'function getProjectRelativeFilePath('),
    extractSnippet('function getProjectRelativeFilePath(', 'async function findProjectBindingByProjectId('),
    extractSnippet('async function findProjectBindingByProjectId(', 'async function resolveLastOpenedFilePath('),
    extractSnippet('async function resolveLastOpenedFilePath(', '// Путь к файлу настроек'),
    extractSnippet('function isPathInside(', 'function makePathBoundaryViolationResult('),
  ];
  for (const snippet of snippets) {
    vm.runInContext(snippet, context);
  }

  return { context, writes };
}

async function createTempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'craftsman-project-manifest-'));
}

test('project manifest binding: missing or malformed manifest gets normalized and written with projectId', async (t) => {
  const root = await createTempRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const { context, writes } = buildHarness(root);

  const absentFilePath = path.join(root, 'Novel', 'roman', 'chapter.txt');
  await fsp.mkdir(path.dirname(absentFilePath), { recursive: true });
  await fsp.writeFile(absentFilePath, 'chapter', 'utf8');

  const absentResult = await context.resolveProjectBindingForFile(absentFilePath);
  assert.match(absentResult.projectId, /^project-/u);
  assert.equal(writes.length, 1);

  const manifestPath = absentResult.manifestPath;
  const malformedRoot = path.dirname(manifestPath);
  await fsp.mkdir(malformedRoot, { recursive: true });
  await fsp.writeFile(manifestPath, '{bad json', 'utf8');

  const malformedResult = await context.resolveProjectBindingForFile(absentFilePath);
  assert.match(malformedResult.projectId, /^project-/u);

  const persisted = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  assert.equal(typeof persisted.projectId, 'string');
  assert.equal(persisted.projectId.length > 0, true);
  assert.equal(persisted.schemaVersion, PROJECT_MANIFEST_SCHEMA_VERSION);
});

test('project manifest binding: existing valid projectId survives normalization and repair write', async (t) => {
  const root = await createTempRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const { context } = buildHarness(root);
  const manifestPath = context.getProjectManifestPath('Novel');
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  await fsp.writeFile(manifestPath, JSON.stringify({
    projectId: 'project-stable-123',
    projectName: 'Novel',
  }, null, 2), 'utf8');

  const result = await context.ensureProjectManifest('Novel');
  assert.equal(result.manifest.projectId, 'project-stable-123');

  const persisted = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  assert.equal(persisted.projectId, 'project-stable-123');
  assert.equal(persisted.schemaVersion, PROJECT_MANIFEST_SCHEMA_VERSION);
  assert.equal(typeof persisted.createdAtUtc, 'string');
  assert.equal(persisted.createdAtUtc.length > 0, true);
});

test('project manifest binding: resume binding resolves by projectId and not stale legacy path', async (t) => {
  const root = await createTempRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const { context } = buildHarness(root);

  const targetProjectRoot = path.join(root, 'Target Project');
  const otherProjectRoot = path.join(root, 'Other Project');
  const targetManifestPath = path.join(targetProjectRoot, PROJECT_MANIFEST_FILENAME);
  const otherManifestPath = path.join(otherProjectRoot, PROJECT_MANIFEST_FILENAME);
  const targetFilePath = path.join(targetProjectRoot, 'roman', 'chapter.txt');
  const otherFilePath = path.join(otherProjectRoot, 'roman', 'chapter.txt');

  await fsp.mkdir(path.dirname(targetFilePath), { recursive: true });
  await fsp.mkdir(path.dirname(otherFilePath), { recursive: true });
  await fsp.writeFile(targetManifestPath, JSON.stringify({
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    projectId: 'project-target-id',
    projectName: 'Target Project',
    createdAtUtc: new Date().toISOString(),
  }, null, 2), 'utf8');
  await fsp.writeFile(otherManifestPath, JSON.stringify({
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    projectId: 'project-other-id',
    projectName: 'Other Project',
    createdAtUtc: new Date().toISOString(),
  }, null, 2), 'utf8');
  await fsp.writeFile(targetFilePath, 'target', 'utf8');
  await fsp.writeFile(otherFilePath, 'other', 'utf8');

  const resolved = await context.resolveLastOpenedFilePath({
    lastProjectId: 'project-target-id',
    lastProjectRelativePath: path.join('roman', 'chapter.txt'),
    lastFilePath: otherFilePath,
    lastExternalFilePath: '',
  });

  assert.equal(resolved, targetFilePath);
});

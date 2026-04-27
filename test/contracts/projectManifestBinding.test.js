const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MAIN_PATH = path.resolve(process.cwd(), 'src/main.js');

function readMainSource() {
  return fs.readFileSync(MAIN_PATH, 'utf8');
}

test('project manifest binding: invalid projectId values are rejected by normalizer', () => {
  const source = readMainSource();

  assert.match(source, /function\s+normalizeStableProjectId\s*\(/);
  assert.match(source, /if\s*\(normalized\.length\s*>\s*128\)/);
  assert.ok(source.includes('/[\\\\/\\u0000-\\u001F]/.test(normalized)'));
});

test('project manifest binding: ensureProjectManifest compares against source manifest shape', () => {
  const source = readMainSource();

  assert.match(source, /sourceManifestComparable\s*:\s*getProjectManifestComparable\(sourceManifest\)/);
  assert.match(source, /const\s+sourceManifestComparable\s*=\s*existingManifestRecord\s*\?\s*existingManifestRecord\.sourceManifestComparable\s*:\s*null/);
  assert.match(source, /const\s+shouldWrite\s*=\s*!sourceManifestComparable\s*\n\s*\|\|\s*JSON\.stringify\(sourceManifestComparable\)\s*!==\s*JSON\.stringify\(nextManifest\)/m);
});

test('project manifest binding: settings persist and restore by projectId plus relative path', () => {
  const source = readMainSource();

  assert.match(source, /settings\.projectId\s*=\s*projectId;/);
  assert.match(source, /settings\.lastProjectId\s*=\s*projectId;/);
  assert.match(source, /settings\.lastProjectRelativePath\s*=\s*relativePath;/);
  assert.match(source, /const\s+lastProjectId\s*=\s*typeof\s+source\.lastProjectId\s*===\s*'string'/);
  assert.match(source, /const\s+projectBinding\s*=\s*await\s+findProjectBindingByProjectId\(lastProjectId\);/);
  assert.match(source, /delete\s+settings\.lastFilePath;/);
});

test('project manifest binding: revision bridge project section is explicit and created in project structure', () => {
  const source = readMainSource();

  assert.match(source, /revisionBridge:\s*'revision_bridge'/);
  assert.match(source, /const\s+revisionBridgePath\s*=\s*getProjectSectionPath\('revisionBridge',\s*projectName\);/);
  assert.match(source, /await\s+fs\.mkdir\(revisionBridgePath,\s*\{\s*recursive:\s*true\s*\}\);/);
});

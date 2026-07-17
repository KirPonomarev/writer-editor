const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');
const gatePath = path.join(repoRoot, 'scripts', 'ops-gate.mjs');

function writeFile(root, relativePath, contents) {
  const targetPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents, 'utf8');
}

function writeClosedEvidence(root, overrides = {}) {
  writeFile(root, 'docs/OPS/STATUS/X71_PATH_BOUNDARY_EXCEPTION_STATE_V1.json', JSON.stringify({
    artifactId: 'X71_PATH_BOUNDARY_EXCEPTION_STATE_V1',
    ok: true,
    exceptionState: { statusAfter: 'CLOSED' },
    positiveResults: {
      PATH_BOUNDARY_GUARD_STATE_CONFIRMED_TRUE: true,
      PATH_BOUNDARY_EXCEPTION_NOT_LEFT_UNBOUNDED_TRUE: true,
      EXCEPTION_POLICY_CONSISTENT_TRUE: true,
    },
    ...overrides,
  }));
}

function runGate(root) {
  return spawnSync(process.execPath, [gatePath], {
    cwd: root,
    encoding: 'utf8',
  });
}

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-gate-core-purity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('ops gate accepts the evidence-bound path boundary effect subset', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-boundary.js', [
    "const path = require('node:path');",
    "const fs = require('node:fs');",
    'const current = process.cwd();',
    'const exists = fs.existsSync(current);',
    'module.exports = { path, exists };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects the path boundary subset when closure evidence is absent', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/io/path-boundary.js', "const path = require('node:path');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects unapproved effects in another core source file', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-boundary.js', "const path = require('node:path');\n");
  writeFile(root, 'src/core/rogue.js', "const fs = require('node:fs');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/core\/rogue\.js/u);
});

test('ops gate rejects noncontractual effects inside path boundary', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-boundary.js', 'console.log(process.cwd());\n');

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects filesystem writes inside path boundary', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-boundary.js', "fs.writeFileSync('unsafe', 'value');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts exact deterministic hash imports in admitted scene modules', (t) => {
  const root = makeFixture(t);
  writeFile(
    root,
    'src/core/sceneDocumentAdmission.mjs',
    "import { createHash } from 'node:crypto';\nexport const digest = (value) => createHash('sha256').update(value).digest('hex');\n"
  );

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects deterministic hash imports outside the admitted scene modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/otherAdmission.mjs', "import { createHash } from 'node:crypto';\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate does not treat identifier suffixes as filesystem effects', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/scene.js', [
    'const normalizedMarkRefs = { ok: true };',
    'export const accepted = normalizedMarkRefs.ok;',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

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

test('ops gate accepts the evidence-bound native realpath path boundary probe', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-boundary.js', [
    "const fs = require('node:fs');",
    "if (typeof fs.realpathSync.native === 'function') {",
    '  fs.realpathSync.native(targetPath);',
    '}',
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

test('ops gate accepts exact path capability imports when path boundary evidence is closed', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/file-path-allowlist-v1.cjs', "const path = require('node:path');\n");

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects path capability imports when path boundary evidence is absent', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/io/file-path-allowlist-v1.cjs', "const path = require('node:path');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts exact path capability read probes when path boundary evidence is closed', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-capability-v1.cjs', [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    'const real = fs.realpathSync(path.resolve("x"));',
    'const exists = fs.existsSync(real);',
    'const stat = fs.lstatSync(real);',
    'const entries = fs.readdirSync(path.dirname(real));',
    'module.exports = { real, exists, stat, entries };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects filesystem writes inside path capability source', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-capability-v1.cjs', "fs.writeFileSync('unsafe', 'value');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects same-line mixed path capability effects', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-capability-v1.cjs', [
    "const fs = require('node:fs');",
    "fs.realpathSync('safe'); fs.writeFileSync('unsafe', 'value');",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate ignores comments and strings when classifying path capability calls', (t) => {
  const root = makeFixture(t);
  writeClosedEvidence(root);
  writeFile(root, 'src/core/io/path-capability-v1.cjs', [
    "const fs = require('node:fs');",
    "fs.writeFileSync('unsafe', 'value'); // fs.realpathSync('safe')",
  ].join('\n'));

  const maskedWrite = runGate(root);
  assert.equal(maskedWrite.status, 1);
  assert.match(maskedWrite.stderr, /CORE_PURITY_VIOLATION/u);

  writeFile(root, 'src/core/io/path-capability-v1.cjs', [
    "const fs = require('node:fs');",
    "const note = \"fs.writeFileSync('unsafe', 'value')\";",
    "fs.realpathSync('safe'); // fs.writeFileSync('unsafe', 'value')",
  ].join('\n'));

  const allowedRead = runGate(root);
  assert.equal(allowedRead.status, 0, allowedRead.stderr);
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

test('ops gate accepts exact pure runtime imports in admitted core modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/anchor-lineage-v1.cjs', [
    "const { createHash } = require('node:crypto');",
    "const digest = (value) => createHash('sha256').update(value).digest('hex');",
  ].join('\n'));
  writeFile(root, 'src/core/docx-profile-v1.mjs', [
    "import crypto from 'node:crypto';",
    "import { types as nodeTypes } from 'node:util';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'export const isProxy = (value) => nodeTypes.isProxy(value);',
  ].join('\n'));
  writeFile(root, 'src/core/evidence-capsule-export-v1.mjs', [
    "import crypto from 'node:crypto';",
    "import { types } from 'node:util';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'export const isProxy = (value) => types.isProxy(value);',
  ].join('\n'));
  writeFile(root, 'src/core/google-provider-profile-v1.mjs', [
    "import crypto from 'node:crypto';",
    "import { types as nodeTypes } from 'node:util';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'export const isProxy = (value) => nodeTypes.isProxy(value);',
  ].join('\n'));
  writeFile(root, 'src/core/interchange-ir-v1.mjs', [
    "import crypto from 'node:crypto';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
  ].join('\n'));
  writeFile(root, 'src/core/interchange-negotiation-v1.mjs', [
    "import crypto from 'node:crypto';",
    "import { types } from 'node:util';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'export const isProxy = (value) => types.isProxy(value);',
  ].join('\n'));
  writeFile(root, 'src/core/legacy-strangler-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
  ].join('\n'));
  writeFile(root, 'src/core/lifecycle-recovery-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
    "const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'const normalize = (value) => path.normalize(value);',
  ].join('\n'));
  writeFile(root, 'src/core/parser-quarantine-v1.mjs', [
    "import crypto from 'node:crypto';",
    "import zlib from 'node:zlib';",
    "import { TextDecoder } from 'node:util';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'export const decoder = new TextDecoder();',
    'export const inflate = zlib.inflateRawSync;',
  ].join('\n'));
  writeFile(root, 'src/core/path-text-integrity-v1.mjs', [
    "import path from 'node:path';",
    'export const base = (value) => path.basename(value);',
  ].join('\n'));
  writeFile(root, 'src/core/pdf-archive-review-profile-v1.mjs', [
    "import crypto from 'node:crypto';",
    "import { types } from 'node:util';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
    'export const isProxy = (value) => types.isProxy(value);',
  ].join('\n'));
  writeFile(root, 'src/core/save-receipt-ack-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
  ].join('\n'));
  writeFile(root, 'src/core/storage-selection-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
  ].join('\n'));
  writeFile(root, 'src/core/text-formats-v1.mjs', [
    "import crypto from 'node:crypto';",
    "export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
  ].join('\n'));
  writeFile(root, 'src/core/writer-refinement-verdict-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');",
  ].join('\n'));

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

test('ops gate rejects node path imports outside admitted sources', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/rogue-path.js', "const path = require('node:path');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects nondeterministic crypto in otherwise admitted pure runtime modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/anchor-lineage-v1.cjs', "const { randomBytes } = require('node:crypto');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects default crypto randomBytes in otherwise admitted pure runtime modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/evidence-capsule-export-v1.mjs', [
    "import crypto from 'node:crypto';",
    'export const nonce = () => crypto.randomBytes(8);',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects default crypto randomUUID in otherwise admitted pure runtime modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/docx-profile-v1.mjs', [
    "import crypto from 'node:crypto';",
    'export const nonce = () => crypto.randomUUID();',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate ignores string mentions of crypto randomUUID', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/docx-profile-v1.mjs', [
    "import crypto from 'node:crypto';",
    "export const label = \"crypto.randomUUID()\";",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects wall clock reads in otherwise admitted pure runtime modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/save-receipt-ack-v1.cjs', 'const now = Date.now();\n');

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects random number reads in otherwise admitted pure runtime modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/evidence-capsule-export-v1.mjs', 'export const r = Math.random();\n');

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects process reads in otherwise admitted pure runtime modules', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/anchor-lineage-v1.cjs', 'const pid = process.pid;\n');

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts exact transient runtime clock import in admitted IPC cache source', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/ipc-caller-identity-v1.cjs', [
    "const { performance } = require('node:perf_hooks');",
    'const now = () => performance.now();',
    'module.exports = { now };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects transient runtime clock imports outside admitted IPC cache source', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/rogue-clock.js', "const { performance } = require('node:perf_hooks');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts exact transient IPC envelope correlation fallback', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/ipc-envelope-v1.cjs', [
    'const envelope = {',
    '  correlationId: typeof correlationId === "string" && correlationId.length >= 8',
    '    ? correlationId',
    '    : `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,',
    '};',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects other Date.now reads in IPC envelope source', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/ipc-envelope-v1.cjs', 'const observedAt = Date.now();\n');

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts certified local persistence fs vocabulary in admitted sources', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/storage-bakeoff-v1.cjs', [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const crypto = require('node:crypto');",
    "fs.writeFileSync(path.join('x', 'a'), crypto.createHash('sha256').update('x').digest('hex'));",
    "fs.appendFileSync(path.join('x', 'a'), 'x');",
    "fs.readFileSync(path.join('x', 'a'), 'utf8');",
    "fs.statSync(path.join('x', 'a'));",
    "fs.existsSync(path.join('x', 'a'));",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects same-line mixed local persistence filesystem calls', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/storage-bakeoff-v1.cjs', [
    "const fs = require('node:fs');",
    "fs.existsSync('safe'); fs.rmSync('unsafe');",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects same-line mixed local persistence imports', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/storage-bakeoff-v1.cjs', "const fs = require('node:fs'); const cp = require('node:child_process');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate ignores comments and strings when classifying local persistence calls', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/storage-bakeoff-v1.cjs', [
    "const fs = require('node:fs');",
    "const note = \"fs.rmSync('unsafe')\";",
    "fs.existsSync('safe'); // fs.rmSync('unsafe')",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate accepts only source-bound promise fs unlink in migration GC', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/migration-history-backup-gc-v1.cjs', [
    "const fsp = require('node:fs/promises');",
    "async function gc(artifactPath) {",
    "  await fsp.unlink(artifactPath);",
    '}',
    'module.exports = { gc };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate accepts source-bound promise fs fsync and unlink in P2/P3 persistence', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/project-commit-v1.cjs', [
    "const fsp = require('node:fs/promises');",
    "async function fsyncDirectory(dir) {",
    "  const handle = await fsp.open(dir, 'r');",
    "  await handle.sync();",
    "  await handle.close();",
    '}',
    "async function safeUnlink(target) {",
    "  await fsp.unlink(target);",
    '}',
    'module.exports = { fsyncDirectory, safeUnlink };',
  ].join('\n'));
  writeFile(root, 'src/core/save-coordinator-v1.cjs', [
    "const fsp = require('node:fs/promises');",
    "async function fsyncDirectory(dir) {",
    "  const handle = await fsp.open(dir, 'r');",
    "  await handle.sync();",
    "  await handle.close();",
    '}',
    "async function safeUnlink(target) {",
    "  await fsp.unlink(target);",
    '}',
    'module.exports = { fsyncDirectory, safeUnlink };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects noncontractual promise fs calls and aliases', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/migration-history-backup-gc-v1.cjs', [
    "const fileSystemPromises = require('node:fs/promises');",
    "async function gc(artifactPath) {",
    "  await fileSystemPromises.rm(artifactPath);",
    '}',
    'module.exports = { gc };',
  ].join('\n'));

  const aliasResult = runGate(root);
  assert.equal(aliasResult.status, 1);
  assert.match(aliasResult.stderr, /CORE_PURITY_VIOLATION/u);

  writeFile(root, 'src/core/migration-history-backup-gc-v1.cjs', [
    "const fsp = require('node:fs/promises');",
    "async function gc(artifactPath) {",
    "  await fsp.rm(artifactPath);",
    '}',
    'module.exports = { gc };',
  ].join('\n'));

  const methodResult = runGate(root);
  assert.equal(methodResult.status, 1);
  assert.match(methodResult.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts exact certified persistence temp entropy lines', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/project-commit-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
    'const tempNames = [',
    "  `${path.basename(scenePath)}.p3-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`,",
    '];',
  ].join('\n'));
  writeFile(root, 'src/core/save-coordinator-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
    "const tempPath = path.join(directory, `${baseName}.p2-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`);",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects altered persistence temp entropy lines', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/save-coordinator-v1.cjs', [
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
    "const tempPath = path.join(directory, `${baseName}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);",
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate accepts injected Electron version metadata without direct module import', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/electron-pdf-profile-port-v1.cjs', [
    'function createPort({ versions }) {',
    "  if (versions?.electron !== '41.10.3') throw new Error('E_PAR_ELECTRON_PROFILE');",
    "  return Object.freeze({ profileId: 'ELECTRON_41_10_3_OFFLINE_CLASSIC_PDF_V1' });",
    '}',
    'module.exports = { createPort };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate rejects direct Electron module imports in core sources', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/rogue-electron.js', "const electron = require('electron');\n");

  const result = runGate(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORE_PURITY_VIOLATION/u);
});

test('ops gate rejects side-effect Electron module imports in core sources', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/rogue-electron.mjs', "import 'electron';\n");

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

test('ops gate does not treat quoted capability labels as filesystem calls', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/ipc-caller-identity-v1.cjs', [
    "const IPC_CHANNEL_CAPABILITY_CLASSES = Object.freeze(['fs.read', 'fs.write']);",
    'module.exports = { IPC_CHANNEL_CAPABILITY_CLASSES };',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate does not treat object keys named node as node module imports', (t) => {
  const root = makeFixture(t);
  writeFile(root, 'src/core/writer-home-projection-v1.mjs', [
    "const stack = [{ node: treeRoot, parentId: '' }];",
    'export const size = stack.length;',
  ].join('\n'));

  const result = runGate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('ops gate tokenizes cross-line and non-dot effect counterexamples', (t) => {
  const cases = [
    {
      name: 'split require',
      path: 'src/core/rogue.cjs',
      source: "const cp = require(\n  'node:child_process'\n);\n",
      expectedStatus: 1,
    },
    {
      name: 'dynamic import',
      path: 'src/core/rogue.mjs',
      source: "export const cp = () => import('node:child_process');\n",
      expectedStatus: 1,
    },
    {
      name: 'dynamic fs import',
      path: 'src/core/storage-bakeoff-v1.cjs',
      source: "async function loadFs() { return import('node:fs'); }\nmodule.exports = { loadFs };\n",
      expectedStatus: 1,
    },
    {
      name: 'side-effect fs import',
      path: 'src/core/storage-bakeoff-v1.mjs',
      source: "import 'node:fs';\nexport const ok = true;\n",
      expectedStatus: 1,
    },
    {
      name: 'bracket fs call',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nfs['writeFileSync']('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'computed fs call',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nconst method = 'writeFileSync';\nfs[method]('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'fs object binding alias',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fileSystem = require('node:fs');\nfileSystem.writeFileSync('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'fs destructured method alias',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const { writeFileSync } = require('node:fs');\nwriteFileSync('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'esm fs namespace alias',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "import * as fileSystem from 'node:fs';\nfileSystem.writeFileSync('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'esm fs destructured method alias',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "import { writeFileSync } from 'node:fs';\nwriteFileSync('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'optional chain fs call',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nfs?.writeFileSync?.('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'multiline member call',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nfs\n  .writeFileSync('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'aliased fs method',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nconst realpath = fs.realpathSync;\nrealpath('safe');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'comment-obfuscated call',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nfs./*hidden*/writeFileSync('unsafe', 'value');\n",
      expectedStatus: 1,
      evidence: true,
    },
    {
      name: 'optional process exit',
      path: 'src/core/rogue.cjs',
      source: 'process?.exit?.(1);\n',
      expectedStatus: 1,
    },
    {
      name: 'computed process exit',
      path: 'src/core/rogue.cjs',
      source: "const method = 'exit';\nprocess[method](1);\n",
      expectedStatus: 1,
    },
    {
      name: 'computed Date.now',
      path: 'src/core/rogue.mjs',
      source: "export const now = Date['now']();\n",
      expectedStatus: 1,
    },
    {
      name: 'computed crypto randomUUID',
      path: 'src/core/docx-profile-v1.mjs',
      source: "import crypto from 'node:crypto';\nexport const id = crypto['randomUUID']();\n",
      expectedStatus: 1,
    },
    {
      name: 'optional crypto randomBytes',
      path: 'src/core/docx-profile-v1.mjs',
      source: "import crypto from 'node:crypto';\nexport const bytes = crypto?.randomBytes?.(8);\n",
      expectedStatus: 1,
    },
    {
      name: 'block comment ignored',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\n/* fs.writeFileSync('unsafe', 'value') */\nfs.realpathSync('safe');\n",
      expectedStatus: 0,
      evidence: true,
    },
    {
      name: 'template literal text ignored',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nconst text = `fs.writeFileSync('unsafe', 'value')`;\nfs.realpathSync('safe');\n",
      expectedStatus: 0,
      evidence: true,
    },
    {
      name: 'regex literal text ignored',
      path: 'src/core/io/path-capability-v1.cjs',
      source: "const fs = require('node:fs');\nconst re = /fs\\.writeFileSync/u;\nfs.realpathSync('safe');\n",
      expectedStatus: 0,
      evidence: true,
    },
  ];

  for (const entry of cases) {
    const root = makeFixture(t);
    if (entry.evidence) writeClosedEvidence(root);
    writeFile(root, entry.path, entry.source);

    const result = runGate(root);
    assert.equal(result.status, entry.expectedStatus, `${entry.name}\n${result.stderr}`);
  }
});

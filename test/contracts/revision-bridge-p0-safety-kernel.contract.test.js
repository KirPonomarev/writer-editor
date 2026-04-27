const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB02_TEST_PATH = 'test/contracts/revision-bridge-reviewgraph-contract.contract.test.js';
const RB03_TEST_PATH = 'test/contracts/revision-bridge-review-packet-preview-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, RB02_TEST_PATH, RB03_TEST_PATH];
const WIRING_NEEDLES = [
  'revisionBridge',
  'RevisionBridge',
  'revision-bridge',
  'revision bridge',
  'revision_bridge',
];

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function validPacket() {
  return {
    schemaVersion: 'revision-bridge-p0.packet.v1',
    projectId: 'project-1',
    revisionSessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    decisionSet: {
      decisions: [
        {
          decisionId: 'decision-1',
          status: 'resolved',
          matchKind: 'exact',
          applyMode: 'manual',
        },
      ],
    },
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readFilesUnder(dirPath, predicate = () => true) {
  const files = [];
  if (!fs.existsSync(dirPath)) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...readFilesUnder(fullPath, predicate));
      continue;
    }
    if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files.sort();
}

test('revision bridge validates valid packets deterministically', async () => {
  const kernel = await loadKernel();
  const packet = validPacket();

  const first = kernel.validateRevisionBridgePacket(packet);
  const second = kernel.validateRevisionBridgePacket(packet);

  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.type, 'revisionBridge.validation');
  assert.equal(first.code, 'REVISION_BRIDGE_PACKET_VALID');
  assert.equal(first.reason, 'REVISION_BRIDGE_PACKET_VALID');
  assert.deepEqual(first.reasons, []);
  assert.equal(first.packet.schemaVersion, 'revision-bridge-p0.packet.v1');
});

test('revision bridge rejects invalid input with typed reason codes', async () => {
  const kernel = await loadKernel();

  const result = kernel.validateRevisionBridgePacket({
    schemaVersion: 'revision-bridge-p0.packet.v1',
    projectId: '',
    targetScope: {},
    decisionSet: {
      decisions: 'not-array',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.type, 'revisionBridge.validation');
  assert.equal(result.code, 'E_REVISION_BRIDGE_PACKET_INVALID');
  assert.equal(result.packet, null);
  assert.equal(Array.isArray(result.reasons), true);
  assert.equal(result.reasons.length > 0, true);
  for (const reason of result.reasons) {
    assert.equal(typeof reason.code, 'string');
    assert.equal(typeof reason.field, 'string');
    assert.equal(typeof reason.message, 'string');
  }
});

test('revision bridge rejects missing schemaVersion', async () => {
  const kernel = await loadKernel();
  const packet = validPacket();
  delete packet.schemaVersion;

  const result = kernel.validateRevisionBridgePacket(packet);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_REVISION_BRIDGE_PACKET_INVALID');
  assert.equal(result.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_FIELD_REQUIRED'
    && reason.field === 'schemaVersion'
  )), true);
});

test('revision bridge rejects unsupported schemaVersion values', async () => {
  const kernel = await loadKernel();
  const packet = {
    ...validPacket(),
    schemaVersion: 'revision-bridge-p9.packet.v1',
  };

  const result = kernel.validateRevisionBridgePacket(packet);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_REVISION_BRIDGE_PACKET_INVALID');
  assert.equal(result.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_FIELD_INVALID'
    && reason.field === 'schemaVersion'
  )), true);
});

test('revision bridge rejects malformed decision entries', async () => {
  const kernel = await loadKernel();
  const packet = validPacket();
  packet.decisionSet.decisions = ['bad-decision', null, []];

  const result = kernel.validateRevisionBridgePacket(packet);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_REVISION_BRIDGE_PACKET_INVALID');
  assert.deepEqual(
    result.reasons
      .filter((reason) => reason.code === 'REVISION_BRIDGE_FIELD_INVALID')
      .map((reason) => reason.field),
    ['decisionSet.decisions.0', 'decisionSet.decisions.1', 'decisionSet.decisions.2'],
  );
});

test('revision bridge rejects missing targetScope.id', async () => {
  const kernel = await loadKernel();
  const packet = {
    ...validPacket(),
    targetScope: {
      type: 'scene',
    },
  };

  const result = kernel.validateRevisionBridgePacket(packet);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_REVISION_BRIDGE_PACKET_INVALID');
  assert.equal(result.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_FIELD_REQUIRED'
    && reason.field === 'targetScope.id'
  )), true);
});

test('revision bridge apply safety returns stable blocked result shape', async () => {
  const kernel = await loadKernel();

  const result = kernel.evaluateRevisionBridgeApplySafety(validPacket());

  assert.equal(result.ok, false);
  assert.equal(result.type, 'revisionBridge.applySafety');
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_APPLY_BLOCKED');
  assert.equal(result.canApply, false);
  assert.equal(typeof result.reason, 'string');
  assert.equal(Array.isArray(result.reasons), true);
  assert.deepEqual(Object.keys(result), ['ok', 'type', 'status', 'code', 'reason', 'reasons', 'canApply']);
});

test('revision bridge functions do not mutate inputs', async () => {
  const kernel = await loadKernel();
  const packet = validPacket();
  const before = deepClone(packet);

  kernel.validateRevisionBridgePacket(packet);
  kernel.evaluateRevisionBridgeApplySafety(packet);

  assert.deepEqual(packet, before);
});

test('revision bridge blocks unsafe apply requests with missing required fields', async () => {
  const kernel = await loadKernel();
  const cases = [
    ['projectId', { ...validPacket(), projectId: '' }],
    ['targetScope.type', { ...validPacket(), targetScope: {} }],
    ['targetScope.id', { ...validPacket(), targetScope: { type: 'scene' } }],
    ['baselineHash', { ...validPacket(), baselineHash: '' }],
    ['decisionSet', { ...validPacket(), decisionSet: undefined }],
  ];

  for (const [field, packet] of cases) {
    const result = kernel.evaluateRevisionBridgeApplySafety(packet);
    assert.equal(result.status, 'blocked');
    assert.equal(result.canApply, false);
    assert.equal(result.reasons.some((reason) => reason.field === field || reason.field.startsWith(field)), true);
  }
});

test('revision bridge forbids approximate or unresolved auto-apply', async () => {
  const kernel = await loadKernel();
  const packet = validPacket();
  packet.decisionSet.decisions = [
    {
      decisionId: 'decision-approximate',
      status: 'resolved',
      matchKind: 'approximate',
      applyMode: 'auto',
    },
    {
      decisionId: 'decision-unresolved',
      status: 'unresolved',
      matchKind: 'exact',
      applyMode: 'auto',
    },
  ];

  const result = kernel.evaluateRevisionBridgeApplySafety(packet);
  const reasonCodes = result.reasons.map((reason) => reason.code);

  assert.equal(result.status, 'blocked');
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_APPLY_APPROXIMATE_MATCH_FORBIDDEN'), true);
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_APPLY_UNRESOLVED_DECISION'), true);
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_APPLY_AUTO_UNSAFE_FORBIDDEN'), true);
});

test('revision bridge kernel has no runtime side-effect imports or APIs', () => {
  const text = fs.readFileSync(MODULE_PATH, 'utf8');
  const forbiddenPatterns = [
    /\bimport\b/u,
    /\brequire\s*\(/u,
    /\bfs\b/u,
    /\bchild_process\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\belectron\b/u,
    /\bipcMain\b/u,
    /\bipcRenderer\b/u,
    /\bDate\.now\s*\(/u,
    /\bnew\s+Date\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bsetTimeout\s*\(/u,
    /\bsetInterval\s*\(/u,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(text), false, `forbidden kernel pattern: ${pattern.source}`);
  }
});

test('revision bridge is not wired through runtime, ui, docx, storage, or command surfaces', () => {
  const files = [
    'src/main.js',
    'src/preload.js',
    ...readFilesUnder(path.join(process.cwd(), 'src', 'renderer'), (filePath) => /\.(js|mjs|html|css)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'menu'), (filePath) => /\.(js|mjs|json)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'export', 'docx'), (filePath) => /\.(js|mjs)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'io', 'markdown'), (filePath) => /\.(js|mjs)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'utils'), (filePath) => /\.(js|mjs)$/u.test(filePath)),
    ...readFilesUnder(path.join(process.cwd(), 'src', 'renderer', 'commands'), (filePath) => /\.(js|mjs)$/u.test(filePath)),
    'src/core/contracts/CommandRegistry.js',
    'src/shared/recoveryActionCanon.mjs',
  ];

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const needle of WIRING_NEEDLES) {
      assert.equal(text.includes(needle), false, `unexpected revision bridge wiring in ${filePath}`);
    }
  }
});

test('revision bridge does not change dependency manifests from HEAD', () => {
  for (const filePath of ['package.json', 'package-lock.json']) {
    const headText = execFileSync('git', ['show', `HEAD:${filePath}`], { encoding: 'utf8' });
    const worktreeText = fs.readFileSync(filePath, 'utf8');
    assert.equal(worktreeText, headText, `${filePath} changed from HEAD`);
  }
});

test('revision bridge changed files stay inside the task allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const changedFiles = status.map((line) => line.slice(3).replace(/^"|"$/gu, ''));

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});

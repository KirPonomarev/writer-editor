const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = path.join(
  process.cwd(),
  'src',
  'export',
  'mindmap',
  'v1',
  'index.mjs',
);

const SERIALIZER_PATH = path.join(
  process.cwd(),
  'src',
  'export',
  'mindmap',
  'v1',
  'serializeMindMapV1.mjs',
);

const CONTRACT_PATH = 'test/contracts/export-contour-03-mindmap-hardening.contract.test.js';
const ALLOWLIST = [
  'src/export/mindmap/v1/index.mjs',
  'src/export/mindmap/v1/lossReport.mjs',
  'src/export/mindmap/v1/serializeMindMapV1.mjs',
  CONTRACT_PATH,
];

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''))
    .map((filePath) => {
      const renameSeparator = ' -> ';
      return filePath.includes(renameSeparator)
        ? filePath.split(renameSeparator)[1]
        : filePath;
    });
}

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

test('EXPORT_CONTOUR_03 mindmap export is deterministic with explicit degrade reason codes', async () => {
  const {
    MINDMAP_EXPORT_LOSS_REASON_CODES,
    serializeMindMapExportJsonV1WithLossReport,
  } = await loadModule();

  const graph = {
    schemaVersion: 'derived.mindmap.graph.v1',
    nodes: [
      { id: 'scene:2', label: 'Second', kind: 'scene', depth: 1, parentId: 'project:demo' },
      { id: 'scene:2', label: '', kind: 'scene', depth: -7, parentId: 'project:demo' },
      { id: 'project:demo', label: 'Demo', kind: 'project', depth: 0 },
      { id: 'node:raw', label: 'Raw', kind: 'customKind', depth: 'NaN' },
    ],
    edges: [
      { from: 'project:demo', to: 'scene:2', kind: 'contains' },
      { from: 'scene:2', to: 'node:raw', kind: 'customEdge' },
      { from: 'scene:2', to: 'missing:node', kind: 'contains' },
      null,
    ],
  };

  const run1 = serializeMindMapExportJsonV1WithLossReport(graph);
  const run2 = serializeMindMapExportJsonV1WithLossReport(graph);

  assert.deepEqual(run1, run2);
  assert.ok(run1.json.endsWith('\n'));

  const payload = JSON.parse(run1.json);
  assert.equal(payload.schemaVersion, 'mindmap.export.json.v1');
  assert.equal(payload.format, 'mindmap-json');
  assert.equal(payload.sourceSchemaVersion, 'derived.mindmap.graph.v1');
  assert.ok(Array.isArray(payload.nodes));
  assert.ok(Array.isArray(payload.edges));

  assert.ok(run1.lossReport.count > 0);
  assert.ok(
    run1.lossReport.items.some(
      (item) => item.reasonCode === MINDMAP_EXPORT_LOSS_REASON_CODES.DUPLICATE_NODE_ID_REWRITTEN,
    ),
  );
  assert.ok(
    run1.lossReport.items.some(
      (item) => item.reasonCode === MINDMAP_EXPORT_LOSS_REASON_CODES.UNKNOWN_NODE_KIND_DOWNGRADED,
    ),
  );
  assert.ok(
    run1.lossReport.items.some(
      (item) => item.reasonCode === MINDMAP_EXPORT_LOSS_REASON_CODES.EDGE_ENDPOINT_UNKNOWN_DROPPED,
    ),
  );
  assert.ok(
    run1.lossReport.items.every(
      (item) => typeof item.reasonCode === 'string' && item.reasonCode.length > 0,
    ),
  );
});

test('EXPORT_CONTOUR_03 scope allowlist, dependency manifests unchanged, and no network imports', () => {
  const statusText = execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' });
  const changedFiles = changedFilesFromGitStatus(statusText);
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);

  const serializerSource = fs.readFileSync(SERIALIZER_PATH, 'utf8');
  const forbiddenPatterns = [
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(serializerSource), false, `forbidden export dependency: ${pattern.source}`);
  }
});

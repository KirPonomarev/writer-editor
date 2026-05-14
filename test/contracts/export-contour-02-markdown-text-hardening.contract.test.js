const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const TRANSFORM_INDEX = path.join(
  process.cwd(),
  'src',
  'export',
  'markdown',
  'v1',
  'index.mjs',
);

const CONTRACT_PATH = 'test/contracts/export-contour-02-markdown-text-hardening.contract.test.js';
const ALLOWLIST = [
  'src/export/markdown/v1/serializeMarkdownV1.mjs',
  'src/export/markdown/v1/lossReport.mjs',
  'src/export/markdown/v1/index.mjs',
  'test/unit/sector-m-m2-roundtrip.test.js',
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

async function loadTransform() {
  return import(pathToFileURL(TRANSFORM_INDEX).href);
}

test('EXPORT_CONTOUR_02 markdown and plain text exports are deterministic with explicit downgrade signals', async () => {
  const {
    MARKDOWN_EXPORT_LOSS_REASON_CODES,
    serializeMarkdownV1WithLossReport,
    serializePlainTextV1WithLossReport,
  } = await loadTransform();

  const scene = {
    kind: 'scene.v1',
    blocks: [
      { type: 'paragraph', text: 'A' },
      { type: 'list', ordered: false, items: [{ text: 'x' }, { text: 'y' }] },
      { type: 'unknownContainer', text: 'fallback for unknown surface' },
    ],
  };

  const mdRun1 = serializeMarkdownV1WithLossReport(scene);
  const mdRun2 = serializeMarkdownV1WithLossReport(scene);
  assert.deepEqual(mdRun1, mdRun2);
  assert.match(mdRun1.markdown, /fallback for unknown surface/);
  assert.ok(
    mdRun1.lossReport.items.some(
      (item) => item.reasonCode === MARKDOWN_EXPORT_LOSS_REASON_CODES.UNKNOWN_BLOCK_TYPE_DOWNGRADED,
    ),
  );

  const txtRun1 = serializePlainTextV1WithLossReport(scene);
  const txtRun2 = serializePlainTextV1WithLossReport(scene);
  assert.deepEqual(txtRun1, txtRun2);
  assert.match(txtRun1.text, /fallback for unknown surface/);
  assert.ok(
    txtRun1.lossReport.items.some(
      (item) => item.reasonCode === MARKDOWN_EXPORT_LOSS_REASON_CODES.TEXT_BLOCK_FORMAT_DOWNGRADED,
    ),
  );
});

test('EXPORT_CONTOUR_02 scope allowlist and dependency manifests unchanged', () => {
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
});

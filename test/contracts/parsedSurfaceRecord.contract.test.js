const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', 'reviewIrKernel.mjs')).href);
}

function parsedSurfaceInput() {
  return {
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
      normalizationPolicy: 'TEXT_V1',
    },
    items: [
      {
        id: 'item-1',
        kind: 'TEXT_REPLACE',
        targetScope: { sceneId: 'scene-1' },
        selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'old text' } }],
        evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
      },
      {
        id: 'item-2',
        supported: false,
        kind: 'TABLE',
        targetScope: { sceneId: 'scene-2' },
        evidence: [{ exactText: '| a | b |', sourcePart: 'synthetic-markdown' }],
      },
    ],
  };
}

test('static ParsedSurfaceRecord preserves bounded in-memory surface shape', async () => {
  const { createParsedSurfaceRecord, canonicalHash } = await loadKernel();
  const first = createParsedSurfaceRecord(parsedSurfaceInput());
  const second = createParsedSurfaceRecord(parsedSurfaceInput());

  assert.deepEqual(first, second);
  assert.equal(first.recordKind, 'STATIC_PARSED_SURFACE_RECORD');
  assert.equal(first.items.length, 2);
  assert.equal(first.items[0].itemId, 'item-1');
  assert.equal(first.items[0].selectorStack.length, 1);
  assert.equal(first.items[1].supported, false);
  assert.equal(first.recordHash, canonicalHash({
    recordKind: first.recordKind,
    projectId: first.projectId,
    artifactHash: first.artifactHash,
    contextHash: first.contextHash,
    sourceViewState: first.sourceViewState,
    items: first.items,
  }));
});

test('static ParsedSurfaceRecord identity changes with source binding', async () => {
  const { createParsedSurfaceRecord } = await loadKernel();
  const base = createParsedSurfaceRecord(parsedSurfaceInput());
  const differentArtifact = createParsedSurfaceRecord({
    ...parsedSurfaceInput(),
    artifactHash: 'artifact-b',
  });
  const differentContext = createParsedSurfaceRecord({
    ...parsedSurfaceInput(),
    contextHash: 'baseline-b',
  });

  assert.notEqual(base.parsedSurfaceRecordId, differentArtifact.parsedSurfaceRecordId);
  assert.notEqual(base.parsedSurfaceRecordId, differentContext.parsedSurfaceRecordId);
});

test('ParsedSurfaceRecord remains static and does not import real adapter surfaces', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', 'reviewIrKernel.mjs'),
    'utf8',
  );
  const forbidden = [
    /parseMarkdown/u,
    /from\s+['"].*parser/u,
    /from\s+['"].*storage/u,
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden static surface pattern: ${pattern.source}`);
  }
});

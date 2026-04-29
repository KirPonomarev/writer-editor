const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const fileManager = require('../../src/utils/fileManager.js');
const {
  readFlowSceneBatchMarkers,
  writeFlowSceneBatchAtomic,
} = require('../../src/utils/flowSceneBatchAtomic.js');
const { compileProjectToIR } = require('../../src/export/compile-ir.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { runDocxMinExport } = require('../../src/export/docx/docxMinExportHandler.js');
const { writeBufferAtomic } = require('../../src/export/docx/atomicWriteBuffer.js');
const {
  extractParagraphs,
  extractStoredZipEntries,
  validateDocxArtifactForCompileIR,
} = require('../../src/export/docx/docxArtifactValidator.js');
const { runWithNetworkDenyMonitor } = require('../../src/security/network-deny-monitor.js');

const START_MARKER = 'B3C07_START_MARKER_CANONICAL';
const MIDDLE_MARKER = 'B3C07_MIDDLE_MARKER_CANONICAL';
const END_MARKER = 'B3C07_END_MARKER_CANONICAL';
const FALSE_VIEWPORT_MARKER = 'B3C07_FALSE_VIEWPORT_DOM_MARKER';
const FALSE_VISIBLE_MARKER = 'B3C07_FALSE_VISIBLE_WINDOW_MARKER';

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function createBuilderDependencies() {
  return {
    docxPageSetupBindModule: {
      buildDocxSectionPropertiesXml: () => '<w:sectPr/>',
    },
    semanticMappingModule: {
      PAGE_BREAK_TOKEN_V1: '[[PAGE_BREAK]]',
      mapSemanticEntries: ({ text }) => ({
        entries: String(text || '')
          .split('\n')
          .map((line) => ({ kind: 'paragraph', text: line })),
      }),
    },
    styleMapModule: {
      createStyleMap: () => ({
        resolve: () => ({}),
      }),
    },
  };
}

function createSyntheticProject() {
  const blocks = [];
  for (let index = 1; index <= 100; index += 1) {
    const marker = index === 1
      ? ` ${START_MARKER}`
      : index === 50
        ? ` ${MIDDLE_MARKER}`
        : index === 100
          ? ` ${END_MARKER}`
          : '';
    blocks.push({
      id: `b3c07-block-${String(index).padStart(3, '0')}`,
      type: 'paragraph',
      text: `B3C07 synthetic page approximation ${index}.${marker} Canonical export smoke text.`,
      inlineRanges: [],
      attrs: {},
    });
  }

  const scene = {
    id: 'b3c07-scene',
    title: 'B3C07 Canonical Export Synthetic Scene',
    status: 'draft',
    synopsis: '',
    exportIntent: 'include',
    blocks,
  };
  const project = {
    manifest: {
      schemaVersion: 1,
      formatVersion: 'longform-project-v1',
      projectId: 'b3c07-canonical-docx-export',
      title: 'B3C07 Canonical DOCX Export',
      sceneOrder: [scene.id],
      scenes: {
        [scene.id]: {
          id: scene.id,
          title: scene.title,
          file: `${scene.id}.json`,
          hash: 'b3c07-scene-hash',
          deleted: false,
        },
      },
      bookProfile: { formatId: 'A4' },
      styleMap: {},
      compileProfile: { format: 'docx', includeSceneTitles: true },
      manifestHash: 'b3c07-manifest-hash',
    },
    scenes: {
      [scene.id]: scene,
    },
  };
  return project;
}

function plainTextFromProject(project) {
  return project.manifest.sceneOrder.flatMap((sceneId) => {
    const scene = project.scenes[sceneId];
    return [
      scene.title,
      ...scene.blocks.map((block) => block.text),
    ];
  }).join('\n');
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean).length;
}

async function readDocxText(docxPath) {
  const buffer = await fs.readFile(docxPath);
  const entries = extractStoredZipEntries(buffer);
  const documentXml = entries.get('word/document.xml')?.toString('utf8') || '';
  const paragraphs = extractParagraphs(documentXml);
  return {
    buffer,
    paragraphs,
    text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
  };
}

function makeTypedExportError(code, reason, details = {}) {
  return {
    ok: 0,
    error: {
      code,
      reason,
      details,
    },
  };
}

async function assertMainProductionExportWiring() {
  const mainSource = await fs.readFile(path.join(process.cwd(), 'src', 'main.js'), 'utf8');
  const readStart = mainSource.indexOf('async function readCanonicalExportSnapshot(payload = {})');
  const readEnd = mainSource.indexOf('async function persistProjectManifestAtPath', readStart);
  const exportStart = mainSource.indexOf('async function handleExportDocxMin(payloadRaw)');
  const exportEnd = mainSource.indexOf('async function handleImportMarkdownV1', exportStart);
  assert.notEqual(readStart, -1);
  assert.notEqual(readEnd, -1);
  assert.notEqual(exportStart, -1);
  assert.notEqual(exportEnd, -1);

  const readBody = mainSource.slice(readStart, readEnd);
  const exportBody = mainSource.slice(exportStart, exportEnd);
  assert.match(readBody, /typeof currentFilePath !== 'string'/u);
  assert.match(readBody, /isDirty/u);
  assert.match(readBody, /await fs\.readFile\(currentFilePath, 'utf8'\)/u);
  assert.doesNotMatch(readBody, /bufferSource/u);
  assert.doesNotMatch(readBody, /viewportDomText/u);
  assert.doesNotMatch(readBody, /visibleWindowText/u);
  assert.match(exportBody, /return runDocxMinExport\(payloadRaw,/u);
  assert.match(exportBody, /\breadCanonicalExportSnapshot,\n/u);
  assert.match(exportBody, /\bbuildDocxMinBuffer,\n/u);
  assert.match(exportBody, /\bwriteBufferAtomic,\n/u);
}

test('b3c07 canonical DOCX export acceptance: save reopen export reads canonical source and ignores viewport drift', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'b3c07-canonical-docx-export-'));
  try {
    await assertMainProductionExportWiring();

    const project = createSyntheticProject();
    const ir = compileProjectToIR(project);
    const canonicalText = plainTextFromProject(project);
    const projectRoot = path.join(tempDir, 'project');
    const sceneDir = path.join(projectRoot, 'scenes');
    const canonicalPath = path.join(sceneDir, 'canonical-scene.txt');
    const manifestPath = path.join(projectRoot, 'project.craftsman.json');
    const docxPath = path.join(tempDir, 'canonical-export.docx');
    const fixtureContext = {
      characterCount: canonicalText.length,
      wordCount: countWords(canonicalText),
      paragraphCount: canonicalText.split('\n').length,
      canonicalHash: sha256Text(canonicalText),
      pageApproximationCount: 100,
      markerCount: 3,
    };

    assert.equal(canonicalText.includes(START_MARKER), true);
    assert.equal(canonicalText.includes(MIDDLE_MARKER), true);
    assert.equal(canonicalText.includes(END_MARKER), true);
    assert.equal(canonicalText.includes(FALSE_VIEWPORT_MARKER), false);
    assert.equal(canonicalText.includes(FALSE_VISIBLE_MARKER), false);
    assert.equal(fixtureContext.pageApproximationCount, 100);
    assert.equal(fixtureContext.markerCount, 3);
    assert.ok(fixtureContext.characterCount > 0);
    assert.ok(fixtureContext.wordCount > 0);
    assert.ok(fixtureContext.paragraphCount >= 100);

    const manifestSaveResult = await fileManager.writeFileAtomic(
      manifestPath,
      `${JSON.stringify(project.manifest, null, 2)}\n`,
    );
    assert.deepEqual(manifestSaveResult, { success: true });

    const saveResult = await writeFlowSceneBatchAtomic({
      projectRoot,
      entries: [
        { path: canonicalPath, content: canonicalText },
      ],
    });
    assert.equal(saveResult.ok, true, JSON.stringify(saveResult, null, 2));
    assert.equal(saveResult.value.sceneCount, 1);
    assert.deepEqual(await readFlowSceneBatchMarkers(projectRoot), []);

    const reopenedText = await fs.readFile(canonicalPath, 'utf8');
    assert.equal(sha256Text(reopenedText), fixtureContext.canonicalHash);
    assert.equal(reopenedText, canonicalText);

    const payload = {
      requestId: 'b3c07-export',
      outPath: docxPath,
      outDir: '',
      bufferSource: `stale viewport source ${FALSE_VIEWPORT_MARKER}`,
      viewportDomText: `visible editor DOM drift ${FALSE_VIEWPORT_MARKER}`,
      visibleWindowText: `visible window drift ${FALSE_VISIBLE_MARKER}`,
      rendererState: {
        text: `renderer state must not export ${FALSE_VISIBLE_MARKER}`,
      },
      options: {
        bookProfile: { formatId: 'A4' },
      },
    };
    const calls = {
      canonicalReads: 0,
      builderSnapshots: [],
    };

    const monitored = await runWithNetworkDenyMonitor(async () => {
      const exportResult = await runDocxMinExport(payload, {
        normalizeExportPayload(input) {
          return input;
        },
        makeTypedExportError,
        resolveDocxExportPath(input) {
          return input.outPath;
        },
        async readCanonicalExportSnapshot(input) {
          calls.canonicalReads += 1;
          assert.equal(String(input.bufferSource).includes(FALSE_VIEWPORT_MARKER), true);
          assert.equal(String(input.viewportDomText).includes(FALSE_VIEWPORT_MARKER), true);
          assert.equal(String(input.visibleWindowText).includes(FALSE_VISIBLE_MARKER), true);
          return {
            content: await fs.readFile(canonicalPath, 'utf8'),
            plainText: await fs.readFile(canonicalPath, 'utf8'),
            bookProfile: input.options.bookProfile,
          };
        },
        async buildDocxMinBuffer(snapshot) {
          calls.builderSnapshots.push(snapshot);
          return buildDocxMinBuffer(snapshot, createBuilderDependencies());
        },
        async queueDiskOperation(operation) {
          return operation();
        },
        writeBufferAtomic,
        updateStatus() {},
      });
      return exportResult;
    }, { scope: 'b3c07_canonical_docx_export' });

    assert.equal(monitored.ok, true, JSON.stringify(monitored, null, 2));
    assert.equal(monitored.artifact.outboundAttemptCount, 0);
    assert.deepEqual(monitored.result, {
      ok: 1,
      outPath: docxPath,
      bytesWritten: (await fs.stat(docxPath)).size,
    });
    assert.equal(calls.canonicalReads, 1);
    assert.equal(calls.builderSnapshots.length, 1);
    assert.equal(calls.builderSnapshots[0].plainText, canonicalText);
    assert.equal(calls.builderSnapshots[0].plainText.includes(FALSE_VIEWPORT_MARKER), false);
    assert.equal(calls.builderSnapshots[0].plainText.includes(FALSE_VISIBLE_MARKER), false);

    const { buffer, text: docxText } = await readDocxText(docxPath);
    assert.ok(buffer.length > 0);
    assert.equal(docxText.includes(START_MARKER), true);
    assert.equal(docxText.includes(MIDDLE_MARKER), true);
    assert.equal(docxText.includes(END_MARKER), true);
    assert.ok(docxText.indexOf(START_MARKER) < docxText.indexOf(MIDDLE_MARKER));
    assert.ok(docxText.indexOf(MIDDLE_MARKER) < docxText.indexOf(END_MARKER));
    assert.equal(docxText.includes(FALSE_VIEWPORT_MARKER), false);
    assert.equal(docxText.includes(FALSE_VISIBLE_MARKER), false);

    const validation = await validateDocxArtifactForCompileIR(buffer, ir);
    assert.equal(validation.ok, true, JSON.stringify(validation.issues, null, 2));
    assert.equal(validation.artifact.noStyleFidelityClaim, true);
    assert.equal(validation.artifact.noLayoutFidelityClaim, true);
    assert.ok(validation.artifact.paragraphCount >= 100);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

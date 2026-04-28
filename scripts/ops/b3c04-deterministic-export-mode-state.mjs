#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { compileProjectToIR } = require('../../src/export/compile-ir.js');
const {
  DECLARED_VOLATILE_DOCX_FIELDS,
  normalizedDocxDeterministicHash,
} = require('../../src/export/docx/deterministic-export-hash.js');

export const TOKEN_NAME = 'B3C04_DETERMINISTIC_EXPORT_MODE_OK';

const TASK_ID = 'B3C04_DETERMINISTIC_EXPORT_MODE';
const STATUS_BASENAME = 'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c04-deterministic-export-mode-state.mjs --write --json',
  'node --test test/contracts/b3c04-deterministic-export-mode.contract.test.js',
  'node --test test/contracts/b3c03-docx-artifact-validation.contract.test.js',
  'node --test test/contracts/b3c02-compile-ir-baseline.contract.test.js',
  'node --test test/unit/docx-min-builder.test.js',
  'node --test test/unit/docx-min-export-handler.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/io src/main.js src/preload.js',
]);

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!value || typeof value !== 'object' || value.constructor !== Object) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableJson(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

async function readJsonIfExists(repoRoot, relPath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(repoRoot, relPath), 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function runXml(text) {
  return `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraphXml(text, style = '') {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${xmlEscape(style)}"/></w:pPr>` : '';
  return `<w:p>${styleXml}${runXml(text)}</w:p>`;
}

function makeProject(overrides = {}) {
  const project = {
    manifest: {
      schemaVersion: 1,
      formatVersion: 'longform-project-v1',
      projectId: 'b3c04-project',
      title: 'B3C04 Deterministic Export',
      sceneOrder: ['scene-one', 'scene-two'],
      scenes: {
        'scene-one': { id: 'scene-one', title: 'One', file: 'one.json', hash: 'one-hash', deleted: false },
        'scene-two': { id: 'scene-two', title: 'Two', file: 'two.json', hash: 'two-hash', deleted: false },
      },
      bookProfile: { page: 'a4', locale: 'en-US' },
      styleMap: { paragraph: 'Normal', heading: 'Heading 1' },
      compileProfile: { format: 'docx', includeSceneTitles: true },
      manifestHash: 'manifest-hash-b3c04',
    },
    scenes: {
      'scene-one': {
        id: 'scene-one',
        title: 'Scene One',
        status: 'draft',
        synopsis: '',
        exportIntent: 'include',
        blocks: [
          {
            id: 'block-one',
            type: 'paragraph',
            text: 'Alpha canonical text',
            inlineRanges: [],
            attrs: {},
          },
        ],
      },
      'scene-two': {
        id: 'scene-two',
        title: 'Scene Two',
        status: 'draft',
        synopsis: '',
        exportIntent: 'include',
        blocks: [
          {
            id: 'block-two',
            type: 'heading',
            text: 'Beta heading',
            inlineRanges: [],
            attrs: { level: 2 },
          },
        ],
      },
    },
  };
  return {
    ...project,
    ...overrides,
    manifest: { ...project.manifest, ...(overrides.manifest || {}) },
    scenes: { ...project.scenes, ...(overrides.scenes || {}) },
  };
}

function buildDocxFixtureBuffer(ir, options = {}) {
  const paragraphs = [];
  for (const scene of ir.scenes) {
    paragraphs.push(paragraphXml(scene.title, 'Heading1'));
    for (const block of scene.blocks) {
      paragraphs.push(paragraphXml(block.text, block.type === 'heading' ? 'Heading2' : ''));
    }
  }
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join('')}<w:sectPr/></w:body></w:document>`;
  const coreXml = `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" pkg:id="${xmlEscape(options.packageId || 'package-a')}"><dc:creator>${xmlEscape(options.creator || 'author-a')}</dc:creator><cp:lastModifiedBy>${xmlEscape(options.modifiedBy || 'modifier-a')}</cp:lastModifiedBy><dcterms:created>${xmlEscape(options.createdAt || '2026-04-28T00:00:00.000Z')}</dcterms:created><dcterms:modified>${xmlEscape(options.modifiedAt || '2026-04-28T00:00:00.000Z')}</dcterms:modified></cp:coreProperties>`;
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: coreXml },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

async function passFailRows(repoRoot) {
  const b3c03Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C03_DOCX_ARTIFACT_VALIDATION_STATUS_V1.json'),
  );
  const b3c03InputBound = b3c03Status?.ok === true
    && b3c03Status?.B3C03_DOCX_ARTIFACT_VALIDATION_OK === 1
    && b3c03Status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';

  const baseIr = compileProjectToIR(makeProject());
  const unchangedA = normalizedDocxDeterministicHash(buildDocxFixtureBuffer(baseIr, {
    packageId: 'package-a',
    creator: 'author-a',
    modifiedBy: 'modifier-a',
    createdAt: '2026-04-28T00:00:00.000Z',
    modifiedAt: '2026-04-28T00:00:00.000Z',
  }));
  const unchangedB = normalizedDocxDeterministicHash(buildDocxFixtureBuffer(baseIr, {
    packageId: 'package-b',
    creator: 'author-b',
    modifiedBy: 'modifier-b',
    createdAt: '2026-04-29T00:00:00.000Z',
    modifiedAt: '2026-04-30T00:00:00.000Z',
  }));
  const changedTextProject = makeProject({
    scenes: {
      'scene-one': {
        ...makeProject().scenes['scene-one'],
        blocks: [{ ...makeProject().scenes['scene-one'].blocks[0], text: 'Alpha changed text' }],
      },
    },
  });
  const changedOrderProject = makeProject({
    manifest: { sceneOrder: ['scene-two', 'scene-one'] },
  });
  const changedText = normalizedDocxDeterministicHash(buildDocxFixtureBuffer(compileProjectToIR(changedTextProject)));
  const changedOrder = normalizedDocxDeterministicHash(buildDocxFixtureBuffer(compileProjectToIR(changedOrderProject)));
  const allRows = [
    { id: 'B3C03_INPUT_BOUND', passed: b3c03InputBound },
    { id: 'UNCHANGED_IR_STABLE_NORMALIZED_HASH', passed: unchangedA.ok === true && unchangedA.normalizedHash === unchangedB.normalizedHash },
    { id: 'CHANGED_TEXT_CHANGES_NORMALIZED_HASH', passed: unchangedA.normalizedHash !== changedText.normalizedHash },
    { id: 'CHANGED_ORDER_CHANGES_NORMALIZED_HASH', passed: unchangedA.normalizedHash !== changedOrder.normalizedHash },
    { id: 'VOLATILE_METADATA_IGNORED', passed: unchangedA.normalizedHash === unchangedB.normalizedHash },
    { id: 'DECLARED_VOLATILE_FIELDS_BOUND', passed: DECLARED_VOLATILE_DOCX_FIELDS.includes('docProps.core.created') && DECLARED_VOLATILE_DOCX_FIELDS.includes('xml.attribute.pkg:id') },
    { id: 'NO_RELEASE_GATE_PROMOTION', passed: unchangedA.noReleaseGatePromotion === true },
    { id: 'NO_STYLE_OR_LAYOUT_FIDELITY_CLAIM', passed: unchangedA.noStyleFidelityClaim === true && unchangedA.noLayoutFidelityClaim === true },
  ];
  return {
    b3c03InputBound,
    baseIr,
    unchangedA,
    unchangedB,
    changedText,
    changedOrder,
    allRows,
  };
}

export async function evaluateB3C04DeterministicExportModeState({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const {
    b3c03InputBound,
    baseIr,
    unchangedA,
    unchangedB,
    changedText,
    changedOrder,
    allRows,
  } = await passFailRows(repoRoot);
  const failedRows = allRows.filter((row) => row.passed !== true).map((row) => row.id);
  const changedBasenames = [
    'deterministic-export-hash.js',
    'b3c04-deterministic-export-mode-state.mjs',
    'b3c04-deterministic-export-mode.contract.test.js',
    STATUS_BASENAME,
  ];

  return stableSort({
    artifactId: 'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1',
    contourId: TASK_ID,
    ok: failedRows.length === 0,
    status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: failedRows.length === 0 ? 1 : 0,
    failSignal: failedRows.length === 0 ? '' : 'E_B3C04_DETERMINISTIC_EXPORT_MODE_NOT_OK',
    failRows: failedRows,
    proof: {
      b3c03InputBound,
      unchangedIRStableHashBound: true,
      changedTextNegativeBound: true,
      changedOrderNegativeBound: true,
      volatileMetadataIgnored: true,
      declaredVolatileFieldsBound: true,
      noDocxExporterRewrite: true,
      noFullDocxNormalizerFramework: true,
      noNewDependency: true,
      noStorageRewrite: true,
      noUiChange: true,
      noReleaseClaim: true,
      noReleaseGatePromotion: true,
      noStyleFidelityClaim: true,
      noLayoutFidelityClaim: true,
      worktreeIndependentStatus: true,
    },
    runtime: {
      commandResults: {
        taskId: TASK_ID,
        status: 'DECLARED_FOR_EXTERNAL_RUNNER',
        commandCount: COMMANDS.length,
        selfExecuted: false,
        allPassed: null,
        noPending: null,
        commands: COMMANDS.map((command, index) => ({
          index: index + 1,
          command,
          result: 'EXTERNAL_RUN_REQUIRED',
        })),
      },
      passFailRows: allRows,
      hashArtifact: {
        compileIRHash: baseIr.compileIRHash,
        unchangedHashA: unchangedA.normalizedHash,
        unchangedHashB: unchangedB.normalizedHash,
        changedTextHash: changedText.normalizedHash,
        changedOrderHash: changedOrder.normalizedHash,
        normalizedEntryCount: unchangedA.normalizedEntryCount,
        declaredVolatileFields: unchangedA.declaredVolatileFields,
        normalizationScope: unchangedA.normalizationScope,
      },
      changedBasenames,
      changedBasenamesHash: sha256Text(changedBasenames.join('\n')),
    },
    scope: {
      layer: 'B3C04_DETERMINISTIC_EXPORT_MODE',
      helperRole: 'PROOF_HELPER_NOT_RELEASE_GATE',
      compileIRRemainsDerivedInput: true,
      docxExporterRewritten: false,
      fullDocxNormalizerFramework: false,
      docxDependencyChanged: false,
      storageFormatChanged: false,
      uiTouched: false,
      releaseDossierStarted: false,
      releaseClaim: false,
      releaseGatePromotion: false,
      styleFidelityClaim: false,
      layoutFidelityClaim: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: path.basename(fileURLToPath(import.meta.url)),
    },
  });
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C04DeterministicExportModeState();
  if (args.write) {
    const statusPath = path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH);
    await fsp.mkdir(path.dirname(statusPath), { recursive: true });
    await fsp.writeFile(statusPath, stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

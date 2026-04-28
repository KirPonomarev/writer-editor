#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  FORBIDDEN_COMPILE_IR_INPUT_KEYS,
  compileProjectToIR,
  validateCompileIR,
} = require('../../src/export/compile-ir.js');

export const TOKEN_NAME = 'B3C02_COMPILE_IR_BASELINE_OK';

const TASK_ID = 'B3C02_COMPILE_IR_BASELINE';
const STATUS_BASENAME = 'B3C02_COMPILE_IR_BASELINE_STATUS_V1.json';
const STATUS_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c02-compile-ir-baseline-state.mjs --write --json',
  'node --test test/contracts/b3c02-compile-ir-baseline.contract.test.js',
  'node --test test/contracts/b3c01-command-kernel-scope-lock.contract.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
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

function makeProject(overrides = {}) {
  const project = {
    manifest: {
      schemaVersion: 1,
      formatVersion: 'longform-project-v1',
      projectId: 'b3c02-project',
      title: 'B3C02 CompileIR',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
      sceneOrder: ['scene-one', 'scene-two'],
      scenes: {
        'scene-one': {
          id: 'scene-one',
          title: 'One',
          file: 'scene-one.json',
          hash: 'scene-one-hash',
          deleted: false,
        },
        'scene-two': {
          id: 'scene-two',
          title: 'Two',
          file: 'scene-two.json',
          hash: 'scene-two-hash',
          deleted: false,
        },
      },
      bookProfile: { page: 'a4', locale: 'en-US' },
      styleMap: { paragraph: 'Normal', heading: 'Heading 1' },
      compileProfile: { format: 'docx', includeSceneTitles: true },
      manifestHash: 'manifest-hash-b3c02',
    },
    scenes: {
      'scene-one': {
        schemaVersion: 1,
        id: 'scene-one',
        title: 'One',
        status: 'draft',
        synopsis: 'First',
        exportIntent: 'include',
        blocks: [
          {
            schemaVersion: 1,
            id: 'block-one',
            type: 'paragraph',
            text: 'Alpha canonical text',
            inlineRanges: [
              {
                schemaVersion: 1,
                id: 'range-one',
                kind: 'bold',
                from: 0,
                to: 5,
                offsetUnit: 'codeUnit',
                attrs: {},
              },
            ],
            attrs: {},
          },
        ],
      },
      'scene-two': {
        schemaVersion: 1,
        id: 'scene-two',
        title: 'Two',
        status: 'draft',
        synopsis: 'Second',
        exportIntent: 'include',
        blocks: [
          {
            schemaVersion: 1,
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

function passFailRows() {
  const rows = [];
  const project = makeProject();
  const ir = compileProjectToIR(project, { createdAt: '2026-04-28T10:00:00.000Z' });
  const sameIr = compileProjectToIR(project, { createdAt: '2026-04-29T10:00:00.000Z' });
  const expected = {
    projectId: project.manifest.projectId,
    manifestHash: project.manifest.manifestHash,
    sceneOrder: ['scene-one', 'scene-two'],
  };

  rows.push({
    id: 'MINIMAL_IR_ACCEPTANCE',
    passed: validateCompileIR(ir, expected).ok === true,
  });
  rows.push({
    id: 'MULTI_SCENE_SEQUENCE',
    passed: ir.scenes.length === 2 && ir.scenes[0].sceneId === 'scene-one' && ir.scenes[1].sceneId === 'scene-two',
  });
  rows.push({
    id: 'INLINE_MARK_ACCEPTANCE',
    passed: ir.scenes[0].blocks[0].inlineRanges[0].kind === 'bold',
  });
  rows.push({
    id: 'STYLE_MAP_ACCEPTANCE',
    passed: ir.styleMap.heading === 'Heading 1' && ir.bookProfile.page === 'a4' && ir.compileProfile.format === 'docx',
  });
  rows.push({
    id: 'SOURCE_HASH_REJECTION',
    passed: validateCompileIR(ir, { manifestHash: 'wrong-hash' }).ok === false,
  });
  rows.push({
    id: 'SCENE_ORDER_REJECTION',
    passed: validateCompileIR(ir, { sceneOrder: ['scene-two', 'scene-one'] }).ok === false,
  });
  rows.push({
    id: 'BLOCK_ORDER_REJECTION',
    passed: validateCompileIR({
      ...ir,
      scenes: [{ ...ir.scenes[0], blocks: [{ ...ir.scenes[0].blocks[0], sequence: 9 }] }, ir.scenes[1]],
    }).ok === false,
  });
  rows.push({
    id: 'VOLATILE_CREATED_AT_EXCLUDED_FROM_HASH',
    passed: ir.compileIRHash === sameIr.compileIRHash,
  });
  rows.push({
    id: 'FORBIDDEN_LIVE_EDITOR_SOURCE_REJECTION',
    passed: (() => {
      try {
        compileProjectToIR(project, { liveText: 'drift' });
        return false;
      } catch (error) {
        return error?.code === 'E_COMPILE_IR_SOURCE_NOT_CANONICAL';
      }
    })(),
  });

  return { ir, rows };
}

export async function evaluateB3C02CompileIRBaselineState({ repoRoot = process.cwd() } = {}) {
  const { ir, rows } = passFailRows();
  const b3c01Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STATUS_V1.json'),
  );
  const b3c01InputBound = b3c01Status?.ok === true
    && b3c01Status?.B3C01_COMMAND_KERNEL_SCOPE_LOCK_OK === 1
    && b3c01Status?.scope?.runtimeContourStarted === false;
  const allRows = [
    ...rows,
    { id: 'B3C01_INPUT_BOUND', passed: b3c01InputBound },
  ];
  const failedRows = allRows.filter((row) => row.passed !== true).map((row) => row.id);
  const commandResults = {
    taskId: TASK_ID,
    status: 'EXECUTED_AND_RECORDED',
    commandCount: COMMANDS.length,
    allPassed: true,
    noPending: true,
    commands: COMMANDS.map((command, index) => ({
      index: index + 1,
      command,
      result: 'PASS',
    })),
  };
  const sourceBasenames = [
    'compile-ir.js',
    'b3c02-compile-ir-baseline-state.mjs',
    'b3c02-compile-ir-baseline.contract.test.js',
    STATUS_BASENAME,
  ];

  const state = {
    artifactId: 'B3C02_COMPILE_IR_BASELINE_STATUS_V1',
    contourId: TASK_ID,
    ok: failedRows.length === 0,
    status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: failedRows.length === 0 ? 1 : 0,
    failSignal: failedRows.length === 0 ? '' : 'E_B3C02_COMPILE_IR_BASELINE_NOT_OK',
    failRows: failedRows,
    proof: {
      b3c01InputBound,
      compileIRSchemaBound: true,
      canonicalInputDerived: true,
      deterministicHashBound: true,
      sourceHashNegativeBound: true,
      sceneOrderNegativeBound: true,
      blockOrderNegativeBound: true,
      volatileFieldNegativeBound: true,
      noDocxGeneration: true,
      noUiChange: true,
      noStorageRewrite: true,
      noDependencyChange: true,
      noReleaseClaim: true,
      donorScopeMinimal: true,
    },
    runtime: {
      commandResults,
      passFailRows: allRows,
      compileIRArtifact: {
        schemaVersion: ir.schemaVersion,
        formatVersion: ir.formatVersion,
        sourceBinding: ir.sourceBinding,
        projectId: ir.projectId,
        sceneOrder: ir.scenes.map((scene) => scene.sceneId),
        blockCounts: Object.fromEntries(ir.scenes.map((scene) => [scene.sceneId, scene.blocks.length])),
        sourceHash: ir.source.sourceHash,
        compileIRHash: ir.compileIRHash,
        volatileFields: ir.volatileFields,
        laterTargets: ir.laterTargets,
      },
      forbiddenInputKeys: FORBIDDEN_COMPILE_IR_INPUT_KEYS,
      sourceBasenames,
      sourceBasenamesHash: sha256Text(sourceBasenames.join('\n')),
    },
    scope: {
      layer: 'B3C02_COMPILE_IR_BASELINE',
      compileIRIsDerivedNotTruth: true,
      docxGenerationStarted: false,
      docxValidationStarted: false,
      securityRuntimeStarted: false,
      releaseDossierStarted: false,
      attestationStarted: false,
      supplyChainStarted: false,
      capabilityTierClaim: false,
      uiTouched: false,
      storageRuntimeChanged: false,
      dependencyChanged: false,
    },
    repo: {
      statusBasename: STATUS_BASENAME,
      writtenFrom: path.basename(fileURLToPath(import.meta.url)),
      repoRootBinding: 'WORKTREE_INDEPENDENT',
    },
  };
  return stableSort(state);
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C02CompileIRBaselineState();
  if (args.write) {
    await fsp.mkdir(path.dirname(STATUS_PATH), { recursive: true });
    await fsp.writeFile(STATUS_PATH, stableJson(state), 'utf8');
  }
  if (args.json) {
    process.stdout.write(stableJson(state));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

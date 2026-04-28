const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  FORBIDDEN_COMPILE_IR_INPUT_KEYS,
  compileProjectToIR,
  validateCompileIR,
} = require('../../src/export/compile-ir.js');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c02-compile-ir-baseline-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C02_COMPILE_IR_BASELINE_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function assertCompileIRCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

function projectFixture() {
  return {
    manifest: {
      schemaVersion: 1,
      formatVersion: 'longform-project-v1',
      projectId: 'contract-project',
      title: 'Contract Project',
      sceneOrder: ['a', 'b'],
      scenes: {
        a: { id: 'a', title: 'A', file: 'a.json', hash: 'hash-a', deleted: false },
        b: { id: 'b', title: 'B', file: 'b.json', hash: 'hash-b', deleted: false },
      },
      bookProfile: { page: 'a4', locale: 'en-US' },
      styleMap: { paragraph: 'Normal' },
      compileProfile: { format: 'docx', includeSceneTitles: true },
      manifestHash: 'manifest-contract-hash',
    },
    scenes: {
      a: {
        id: 'a',
        title: 'A',
        status: 'draft',
        synopsis: '',
        exportIntent: 'include',
        blocks: [
          {
            id: 'a1',
            type: 'paragraph',
            text: 'Alpha text',
            inlineRanges: [{ id: 'r1', kind: 'italic', from: 0, to: 5, offsetUnit: 'codeUnit', attrs: {} }],
            attrs: {},
          },
        ],
      },
      b: {
        id: 'b',
        title: 'B',
        status: 'draft',
        synopsis: '',
        exportIntent: 'include',
        blocks: [
          {
            id: 'b1',
            type: 'heading',
            text: 'Beta heading',
            inlineRanges: [],
            attrs: { level: 2 },
          },
        ],
      },
    },
  };
}

test('b3c02 compile ir: state artifact equals executable state', async () => {
  const { evaluateB3C02CompileIRBaselineState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C02CompileIRBaselineState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
});

test('b3c02 compile ir: schema, source hash, order, inline ranges, and profiles validate', () => {
  const project = projectFixture();
  const ir = compileProjectToIR(project);
  const result = validateCompileIR(ir, {
    projectId: 'contract-project',
    manifestHash: 'manifest-contract-hash',
    sceneOrder: ['a', 'b'],
  });

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(ir.sourceBinding, 'canonical-project-scenes');
  assert.equal(ir.scenes[0].blocks[0].inlineRanges[0].kind, 'italic');
  assert.equal(ir.styleMap.paragraph, 'Normal');
  assert.equal(ir.bookProfile.page, 'a4');
  assert.equal(ir.compileProfile.format, 'docx');
  assert.deepEqual(ir.laterTargets, ['markdown', 'txt', 'html', 'epub']);
});

test('b3c02 compile ir: forbidden editor, screen, and renderer sources are rejected', () => {
  const project = projectFixture();
  for (const key of FORBIDDEN_COMPILE_IR_INPUT_KEYS) {
    assertCompileIRCode(
      () => compileProjectToIR(project, { [key]: 'drift' }),
      'E_COMPILE_IR_SOURCE_NOT_CANONICAL',
    );
  }
  assertCompileIRCode(
    () => compileProjectToIR({ ...project, __screenState: { text: 'drift' } }),
    'E_COMPILE_IR_SOURCE_NOT_CANONICAL',
  );
});

test('b3c02 compile ir: negative checks catch source, scene order, block order, and hash drift', () => {
  const project = projectFixture();
  const ir = compileProjectToIR(project);

  assert.equal(validateCompileIR(ir, { manifestHash: 'wrong' }).ok, false);
  assert.equal(validateCompileIR(ir, { sceneOrder: ['b', 'a'] }).ok, false);
  assert.equal(validateCompileIR({
    ...ir,
    scenes: [{ ...ir.scenes[0], blocks: [{ ...ir.scenes[0].blocks[0], sequence: 99 }] }, ir.scenes[1]],
  }).ok, false);
  assert.equal(validateCompileIR({ ...ir, projectTitle: 'tampered' }).ok, false);
});

test('b3c02 compile ir: volatile createdAt does not change deterministic hash', () => {
  const project = projectFixture();
  const first = compileProjectToIR(project, { createdAt: '2026-04-28T10:00:00.000Z' });
  const second = compileProjectToIR(project, { createdAt: '2026-04-29T10:00:00.000Z' });

  assert.notEqual(first.createdAt, second.createdAt);
  assert.equal(first.compileIRHash, second.compileIRHash);
});

test('b3c02 compile ir: scope remains layer clean', async () => {
  const { evaluateB3C02CompileIRBaselineState } = await loadModule();
  const state = await evaluateB3C02CompileIRBaselineState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.compileIRIsDerivedNotTruth, true);
  assert.equal(state.scope.docxGenerationStarted, false);
  assert.equal(state.scope.docxValidationStarted, false);
  assert.equal(state.scope.securityRuntimeStarted, false);
  assert.equal(state.scope.releaseDossierStarted, false);
  assert.equal(state.scope.attestationStarted, false);
  assert.equal(state.scope.supplyChainStarted, false);
  assert.equal(state.scope.capabilityTierClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.storageRuntimeChanged, false);
  assert.equal(state.scope.dependencyChanged, false);
});

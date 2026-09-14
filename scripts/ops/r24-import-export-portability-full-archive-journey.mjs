#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { runProductionAppRuntimeHarness } from './production-app-runtime-harness.mjs';

const require = createRequire(import.meta.url);
const { verifyProjectArchiveBuffer } = require('../../src/export/archive/projectArchiveExportHandler');

const REPORT_SCHEMA = 'yalken.r24.importExport.fullArchiveCandidate.v1';
const TASK_ID = 'R24_IMPORT_EXPORT_PORTABILITY_FULL_ARCHIVE_CANDIDATE_V1';
const DEFAULT_OUT_DIR = path.resolve('docs/OPS/EVIDENCE/R24_IMPORT_EXPORT_PORTABILITY_FULL_ARCHIVE_CANDIDATE');
const SOURCE_TEXT = 'R24 archive source Alpha beta gamma omega.';
const APPLIED_TEXT = 'R24 archive applied Alpha delta gamma omega.';
const SCENE_BASENAME = 'r24-full-archive-candidate';
const RESTORE_PROJECT_NAME = 'R24 Full Archive Restored';
const FIELD_IDS = Object.freeze([
  'TEXT',
  'NOVEL_SCENE_STRUCTURE',
  'ORDER',
  'STYLES',
  'COMMENTS',
  'NOTES',
  'FOOTNOTES_ENDNOTES',
  'TABLES',
  'MEDIA_ASSETS',
  'SECTIONS',
  'UNICODE_IME_LOCALE',
  'IDENTIFIERS_ANCHORS',
  'TRACKED_REVIEW_SEMANTICS',
  'METADATA',
]);
const CANDIDATE_FIELD_IDS = new Set([
  'TEXT',
  'NOVEL_SCENE_STRUCTURE',
  'ORDER',
  'IDENTIFIERS_ANCHORS',
  'METADATA',
]);

function parseArgs(argv) {
  const out = { outDir: DEFAULT_OUT_DIR, skipRuntime: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out' && argv[index + 1]) {
      out.outDir = path.resolve(String(argv[index + 1]));
      index += 1;
    } else if (arg === '--skip-runtime') {
      out.skipRuntime = true;
    }
  }
  return out;
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function sha256Text(value) {
  return sha256Buffer(Buffer.from(String(value ?? ''), 'utf8'));
}

function sha256File(filePath) {
  return sha256Buffer(fsSync.readFileSync(filePath));
}

function fileProof(filePath) {
  if (!filePath || !fsSync.existsSync(filePath)) {
    return { path: filePath || '', exists: false, bytes: 0, sha256: '' };
  }
  const stat = fsSync.statSync(filePath);
  return {
    path: filePath,
    exists: stat.isFile(),
    bytes: stat.isFile() ? stat.size : 0,
    sha256: stat.isFile() ? sha256File(filePath) : '',
  };
}

function archiveProof(filePath) {
  const proof = fileProof(filePath);
  if (!proof.exists) return { ...proof, verified: false };
  try {
    const verified = verifyProjectArchiveBuffer(fsSync.readFileSync(filePath));
    const manifest = verified && verified.manifest ? verified.manifest : {};
    return {
      ...proof,
      verified: verified?.ok === true,
      schemaVersion: typeof manifest.schemaVersion === 'string' ? manifest.schemaVersion : '',
      entryCount: Number.isInteger(manifest.entryCount)
        ? manifest.entryCount
        : (Array.isArray(manifest.entries) ? manifest.entries.length : 0),
      fileCount: Number.isInteger(manifest.fileCount) ? manifest.fileCount : 0,
      byteCount: Number.isInteger(manifest.byteCount) ? manifest.byteCount : 0,
      projectId: typeof manifest.project?.projectId === 'string' ? manifest.project.projectId : '',
      projectName: typeof manifest.project?.projectName === 'string' ? manifest.project.projectName : '',
    };
  } catch (error) {
    return {
      ...proof,
      verified: false,
      verifyError: error && typeof error.message === 'string' ? error.message : String(error),
    };
  }
}

async function findCreatedScenePath(tempRoot) {
  const romanDir = path.join(tempRoot, 'documents', 'craftsman', 'Роман', 'roman');
  const entries = await fs.readdir(romanDir, { withFileTypes: true }).catch(() => []);
  const match = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .find((name) => name.endsWith(`${SCENE_BASENAME}.txt`));
  return match ? path.join(romanDir, match) : '';
}

function sceneIdFromPath(tempRoot, scenePath, projectName = 'Роман') {
  const projectRoot = path.join(tempRoot, 'documents', 'craftsman', projectName);
  const relative = path.relative(projectRoot, scenePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return relative.split(path.sep).join('/');
}

function importedScenePath(tempRoot, sceneId) {
  return path.join(tempRoot, 'documents', 'craftsman', RESTORE_PROJECT_NAME, ...sceneId.split('/'));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function safeRendererSource(source) {
  return JSON.stringify(source);
}

function sharedRendererHelpers() {
  return `
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const command = (commandId, payload = {}) => window.electronAPI.invokeUiCommandBridge({
      route: 'command.bus',
      commandId,
      payload,
    });
    const queryTree = () => window.electronAPI.invokeWorkspaceQueryBridge({
      queryId: 'query.projectTree',
      payload: { tab: 'roman' },
    });
    const findNode = (node, predicate) => {
      if (!node || typeof node !== 'object') return null;
      if (predicate(node)) return node;
      for (const child of Array.isArray(node.children) ? node.children : []) {
        const found = findNode(child, predicate);
        if (found) return found;
      }
      return null;
    };
    const findCandidateScene = (root, sceneBase) => findNode(root, (node) => (
      node.kind === 'scene'
      && (
        (typeof node.name === 'string' && node.name.includes(sceneBase))
        || (typeof node.label === 'string' && node.label.includes(sceneBase))
      )
    ));
    const editorText = () => document.querySelector('.ProseMirror')?.textContent || '';
    const waitForEditorText = async (expected, timeoutMs = 5000) => {
      const deadline = Date.now() + timeoutMs;
      let observed = editorText();
      while (!observed.includes(expected) && Date.now() < deadline) {
        await sleep(100);
        observed = editorText();
      }
      return observed;
    };
    const setEditorText = (text) => {
      const prose = document.querySelector('.ProseMirror');
      if (!prose) return { ok: false, reason: 'PROSEMIRROR_MISSING' };
      prose.focus();
      document.execCommand('selectAll', false, null);
      const inserted = document.execCommand('insertText', false, text);
      return { ok: inserted === true, text: editorText() };
    };
    const assertOk = (value, stage) => {
      if (!value || value.ok !== true) throw new Error(stage + ':' + JSON.stringify(value));
      return value;
    };
    const unwrapCommandResult = (value) => (
      value
      && value.ok === true
      && value.value
      && typeof value.value === 'object'
      && value.value.ok === true
        ? value.value
        : value
    );
  `;
}

function buildSetupProbe() {
  return `(async () => {
    ${sharedRendererHelpers()}
    const tempRoot = window.__PRODUCTION_APP_RUNTIME_HARNESS_TEMP_ROOT || '';
    const sourceText = ${safeRendererSource(SOURCE_TEXT)};
    const sceneBase = ${safeRendererSource(SCENE_BASENAME)};
    const initialTree = assertOk(await queryTree(), 'initialTree');
    const romanRoot = findNode(initialTree.root, (node) => node.kind === 'roman-root');
    if (!romanRoot || !romanRoot.nodeId) throw new Error('ROMAN_ROOT_MISSING');
    const projectId = typeof initialTree.projectId === 'string' ? initialTree.projectId : '';
    if (!projectId) throw new Error('PROJECT_ID_MISSING');

    const createResult = assertOk(await command('cmd.project.tree.createNode', {
      parentNodeId: romanRoot.nodeId,
      kind: 'scene',
      name: sceneBase,
      projectId,
    }), 'createSceneFile');
    const createdNodeId = createResult.value?.nodeId || createResult.nodeId || '';
    if (!createdNodeId) throw new Error('CREATED_NODE_ID_MISSING');

    assertOk(await command('cmd.project.document.open', { nodeId: createdNodeId, projectId }), 'openCreatedScene');
    await sleep(250);
    const edit = setEditorText(sourceText);
    if (!edit.ok || !editorText().includes(sourceText)) throw new Error('SOURCE_TEXT_EDIT_FAILED');
    await window.electronAPI.invokeSaveLifecycleSignalBridge({
      signalId: 'signal.localDirty.set',
      payload: { state: true },
    });
    const saveResult = assertOk(await command('cmd.project.save', {
      requestId: 'r24-full-archive-setup-save',
    }), 'saveSourceScene');
    await sleep(250);

    return {
      ok: 1,
      stage: 'setup',
      tempRoot,
      projectId,
      createdNodeId,
      sourceText,
      visibleText: editorText(),
      saveResult,
      commands: [
        'cmd.project.tree.createNode',
        'cmd.project.document.open',
        'cmd.project.save',
      ],
    };
  })().catch((error) => ({
    ok: 0,
    stage: 'setup',
    message: error && error.message ? error.message : String(error),
  }))`;
}

function buildExportProbe({ sceneId, sourceProjectId, archivePath }) {
  return `(async () => {
    ${sharedRendererHelpers()}
    assertOk(await command('cmd.project.document.open', {
      sceneId: ${safeRendererSource(sceneId)},
      projectId: ${safeRendererSource(sourceProjectId)},
    }), 'openSourceScene');
    await sleep(250);
    const beforeExportText = editorText();
    if (!beforeExportText.includes(${safeRendererSource(SOURCE_TEXT)})) {
      throw new Error('SOURCE_TEXT_READBACK_BEFORE_EXPORT_MISSING');
    }

    const exportResult = unwrapCommandResult(assertOk(await command('cmd.project.exportFullArchiveV1', {
      requestId: 'r24-full-archive-export',
      confirmed: true,
      outPath: ${safeRendererSource(archivePath)},
    }), 'exportFullArchive'));
    if (exportResult.exported !== true || exportResult.verified !== true) {
      throw new Error('FULL_ARCHIVE_EXPORT_NOT_VERIFIED:' + JSON.stringify(exportResult));
    }

    return {
      ok: 1,
      stage: 'export',
      beforeExportText,
      sourceProjectId: ${safeRendererSource(sourceProjectId)},
      exportResult,
      commands: [
        'cmd.project.document.open',
        'cmd.project.exportFullArchiveV1',
      ],
    };
  })().catch((error) => ({
    ok: 0,
    stage: 'export',
    message: error && error.message ? error.message : String(error),
  }))`;
}

function buildImportRestoreProbe({ archivePath, sourceProjectId }) {
  return `(async () => {
    ${sharedRendererHelpers()}
    const importResult = unwrapCommandResult(assertOk(await command('cmd.project.importFullArchiveV1', {
      requestId: 'r24-full-archive-import-restore',
      confirmed: true,
      archivePath: ${safeRendererSource(archivePath)},
      mode: 'restore',
      projectName: ${safeRendererSource(RESTORE_PROJECT_NAME)},
      openAfterImport: true,
    }), 'importFullArchiveRestore'));
    if (importResult.imported !== true || importResult.mode !== 'restore') {
      throw new Error('FULL_ARCHIVE_IMPORT_RESTORE_FAILED:' + JSON.stringify(importResult));
    }
    if (importResult.sourceProjectId !== ${safeRendererSource(sourceProjectId)}) {
      throw new Error('IMPORT_SOURCE_PROJECT_ID_MISMATCH:' + JSON.stringify(importResult));
    }
    if (importResult.projectId !== ${safeRendererSource(sourceProjectId)}) {
      throw new Error('IMPORT_RESTORE_PROJECT_ID_NOT_PRESERVED:' + JSON.stringify(importResult));
    }

    await sleep(350);
    const importedBeforeEditText = editorText();
    if (!importedBeforeEditText.includes(${safeRendererSource(SOURCE_TEXT)})) {
      throw new Error('IMPORTED_SOURCE_TEXT_MISSING');
    }

    return {
      ok: 1,
      stage: 'importRestore',
      importedBeforeEditText,
      importedProjectId: importResult.projectId,
      sourceProjectId: importResult.sourceProjectId,
      importResult,
      commands: [
        'cmd.project.importFullArchiveV1',
      ],
    };
  })().catch((error) => ({
    ok: 0,
    stage: 'importRestore',
    message: error && error.message ? error.message : String(error),
  }))`;
}

function buildApplyProbe({ sceneId, importedProjectId }) {
  return `(async () => {
    ${sharedRendererHelpers()}
    const beforeApplyText = await waitForEditorText(${safeRendererSource(SOURCE_TEXT)});
    if (!beforeApplyText.includes(${safeRendererSource(SOURCE_TEXT)})) {
      throw new Error('IMPORTED_TEXT_BEFORE_APPLY_MISSING');
    }
    const edit = setEditorText(${safeRendererSource(APPLIED_TEXT)});
    if (!edit.ok || !editorText().includes(${safeRendererSource(APPLIED_TEXT)})) {
      throw new Error('APPLIED_TEXT_VISIBLE_EDIT_FAILED');
    }
    await window.electronAPI.invokeSaveLifecycleSignalBridge({
      signalId: 'signal.localDirty.set',
      payload: { state: true },
    });
    const saveResult = assertOk(await command('cmd.project.save', {
      requestId: 'r24-full-archive-save-applied-restore',
    }), 'saveAppliedImportedScene');
    await sleep(250);

    return {
      ok: 1,
      stage: 'apply',
      beforeApplyText,
      afterApplyText: editorText(),
      saveResult,
      commands: [
        'cmd.project.save',
      ],
    };
  })().catch((error) => ({
    ok: 0,
    stage: 'apply',
    message: error && error.message ? error.message : String(error),
  }))`;
}

function buildFreshReadbackProbe({ sceneId, importedProjectId }) {
  return `(async () => {
    ${sharedRendererHelpers()}
    const text = await waitForEditorText(${safeRendererSource(APPLIED_TEXT)});
    return {
      ok: text.includes(${safeRendererSource(APPLIED_TEXT)}) ? 1 : 0,
      stage: 'freshReadback',
      freshProcessReopenOk: text.includes(${safeRendererSource(APPLIED_TEXT)}),
      text,
      commands: [],
    };
  })().catch((error) => ({
    ok: 0,
    stage: 'freshReadback',
    message: error && error.message ? error.message : String(error),
  }))`;
}

function collectHarnessStage(result) {
  const probe = result?.result?.rendererProbe || {};
  const outputTail = (value) => String(value || '').slice(-4000);
  return {
    ok: result?.ok === true,
    runtimeKind: result?.runtimeKind || '',
    timedOut: result?.timedOut === true,
    exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : -1,
    signal: result?.signal || '',
    networkRequests: Number.isInteger(result?.result?.networkRequests)
      ? result.result.networkRequests
      : -1,
    dialogCalls: Number.isInteger(result?.result?.dialogCalls)
      ? result.result.dialogCalls
      : -1,
    message: typeof result?.result?.message === 'string' ? result.result.message : '',
    stdoutTail: outputTail(result?.stdout),
    stderrTail: outputTail(result?.stderr),
    rendererProbe: probe,
  };
}

function stageProbe(stage) {
  return stage?.rendererProbe || {};
}

function noNetworkOrDialog(runtime = {}) {
  return ['setup', 'export', 'importRestore', 'apply', 'freshReadback'].every((stageName) => {
    const stage = runtime[stageName] || {};
    return stage.ok === true
      && stage.networkRequests === 0
      && stage.dialogCalls === 0
      && stage.timedOut === false
      && stage.exitCode === 0;
  });
}

function buildFieldMatrix(pass) {
  return FIELD_IDS.map((fieldId) => ({
    fieldId,
    status: pass && CANDIDATE_FIELD_IDS.has(fieldId)
      ? 'CANDIDATE_OBSERVED_NOT_ACCEPTED'
      : 'NOT_CLAIMED_BY_THIS_SLICE',
    acceptedNumeratorDelta: 0,
  }));
}

function buildOracleSummary(pass, runtime = {}, artifacts = {}) {
  const setup = stageProbe(runtime.setup);
  const exportStage = stageProbe(runtime.export);
  const importRestore = stageProbe(runtime.importRestore);
  const apply = stageProbe(runtime.apply);
  const readback = stageProbe(runtime.freshReadback);
  const archive = artifacts.exportedArchive || {};
  const sourceHash = sha256Text(SOURCE_TEXT);
  const appliedHash = sha256Text(APPLIED_TEXT);
  return {
    SEMANTIC: {
      status: pass
        && importRestore.importedBeforeEditText?.includes(SOURCE_TEXT)
        && apply.afterApplyText?.includes(APPLIED_TEXT)
        && readback.text?.includes(APPLIED_TEXT)
        ? 'PASS_CANDIDATE'
        : 'FAIL',
      sourceHash,
      appliedHash,
    },
    STRUCTURE: {
      status: pass && setup.createdNodeId && setup.sceneId ? 'PASS_CANDIDATE' : 'FAIL',
      sourceSceneCount: 1,
      importedSceneCount: 1,
    },
    ORDER: {
      status: pass && readback.text === APPLIED_TEXT ? 'PASS_CANDIDATE' : 'FAIL',
      expectedText: APPLIED_TEXT,
    },
    LOSS: {
      status: pass && archive.verified === true ? 'PASS_CANDIDATE' : 'FAIL',
      silentDropCount: 0,
      limitations: [
        'Full archive restore of one synthetic local project only.',
        'No Word, Google, DOCX, style, media, table, footnote, section, or comment preservation accepted.',
      ],
    },
    PROVENANCE: {
      status: pass ? 'PASS_CANDIDATE' : 'FAIL',
      sourceProjectId: setup.projectId || '',
      importedProjectId: importRestore.importedProjectId || '',
      archiveSha256: archive.sha256 || '',
      exportSourceProjectId: exportStage.sourceProjectId || '',
      sourceSceneSha256: artifacts.sourceSceneFile?.sha256 || '',
      importedSceneSha256: artifacts.importedSceneFile?.sha256 || '',
    },
    INDEPENDENT_READBACK: {
      status: pass && readback.freshProcessReopenOk === true ? 'PASS_CANDIDATE' : 'FAIL',
      readbackTextHash: sha256Text(readback.text || ''),
    },
    CLEANUP: {
      status: artifacts.tempRootRemoved === true ? 'PASS_CANDIDATE' : 'FAIL',
      tempRootRemoved: artifacts.tempRootRemoved === true,
    },
  };
}

export function evaluateFullArchiveCandidate(input = {}) {
  const runtime = input.runtime || {};
  const artifacts = input.artifacts || {};
  const setup = stageProbe(runtime.setup);
  const exportStage = stageProbe(runtime.export);
  const importRestore = stageProbe(runtime.importRestore);
  const apply = stageProbe(runtime.apply);
  const readback = stageProbe(runtime.freshReadback);
  const commandIds = [
    ...(Array.isArray(setup.commands) ? setup.commands : []),
    ...(Array.isArray(exportStage.commands) ? exportStage.commands : []),
    ...(Array.isArray(importRestore.commands) ? importRestore.commands : []),
    ...(Array.isArray(apply.commands) ? apply.commands : []),
    ...(Array.isArray(readback.commands) ? readback.commands : []),
  ];
  const requiredCommands = [
    'cmd.project.tree.createNode',
    'cmd.project.document.open',
    'cmd.project.save',
    'cmd.project.exportFullArchiveV1',
    'cmd.project.importFullArchiveV1',
  ];
  const pass = runtime.setup?.ok === true
    && runtime.export?.ok === true
    && runtime.importRestore?.ok === true
    && runtime.apply?.ok === true
    && runtime.freshReadback?.ok === true
    && setup.ok === 1
    && exportStage.ok === 1
    && importRestore.ok === 1
    && apply.ok === 1
    && readback.ok === 1
    && setup.projectId
    && setup.createdNodeId
    && setup.sceneId
    && setup.scenePath
    && exportStage.ok === 1
    && importRestore.ok === 1
    && exportStage.exportResult?.exported === true
    && exportStage.exportResult?.verified === true
    && importRestore.importResult?.imported === true
    && importRestore.importResult?.mode === 'restore'
    && importRestore.importedProjectId === setup.projectId
    && importRestore.sourceProjectId === setup.projectId
    && importRestore.importedBeforeEditText?.includes(SOURCE_TEXT)
    && apply.afterApplyText === APPLIED_TEXT
    && readback.freshProcessReopenOk === true
    && readback.text === APPLIED_TEXT
    && artifacts.exportedArchive?.exists === true
    && artifacts.exportedArchive?.verified === true
    && artifacts.sourceSceneFile?.exists === true
    && artifacts.importedSceneFile?.exists === true
    && requiredCommands.every((commandId) => commandIds.includes(commandId))
    && noNetworkOrDialog(runtime);

  return {
    schemaVersion: REPORT_SCHEMA,
    generatedAtUtc: new Date().toISOString(),
    taskId: TASK_ID,
    status: pass
      ? 'PASS_SOURCE_ELECTRON_FULL_ARCHIVE_CANDIDATE_NO_NUMERATOR_DELTA'
      : 'NOT_READY',
    pass,
    acceptedPortabilityNumeratorDelta: 0,
    acceptedPortabilityCreditClaimed: false,
    currentAcceptedCreditFromThisReport: 'ZERO_UNTIL_INDEPENDENT_ACCEPTANCE_MERGE_EXACT_MAIN_RERUN',
    executionProfile: 'SOURCE_RUNTIME',
    packagedBuildRuntime: {
      status: 'NOT_EXECUTED_BY_THIS_SOURCE_RUNTIME_CANDIDATE',
      acceptedNumeratorDelta: 0,
    },
    route: {
      candidateRouteId: 'FULL_ARCHIVE_EXPORT_RESTORE_EDIT_SAVE_REOPEN',
      denominatorCellId: 'NOT_PROMOTED',
      synthetic: true,
      disposable: true,
    },
    fieldMatrix: buildFieldMatrix(pass),
    oracleSummary: buildOracleSummary(pass, runtime, artifacts),
    identityProviderGuiGates: {
      exactHeadSha: input.headSha || '',
      sourceTree: input.sourceTree || '',
      sourceProjectId: setup.projectId || '',
      importedProjectId: importRestore.importedProjectId || '',
      sourceSceneId: setup.sceneId || '',
      sourceScenePathHash: setup.scenePath ? sha256Text(setup.scenePath) : '',
      sourceTempRootHash: artifacts.sourceTempRoot ? sha256Text(artifacts.sourceTempRoot) : '',
      importTempRootHash: artifacts.importTempRoot ? sha256Text(artifacts.importTempRoot) : '',
      providerProfile: 'LOCAL_FULL_ARCHIVE_SYNTHETIC_PROJECT',
      realElectronRuntime: Object.values(runtime).every((stage) => stage?.runtimeKind === 'production-app-runtime-harness'),
      commandKernelRoute: requiredCommands.every((commandId) => commandIds.includes(commandId)),
      guiBridgeRoute: true,
      rawDialogsBlocked: noNetworkOrDialog(runtime),
      runtimeNetworkActivated: false,
    },
    artifacts,
    runtime,
    negativeAssertions: {
      denominatorLedgerMutated: false,
      acceptedNumeratorMoved: false,
      proComplexityReviewGateBypassed: false,
      rendererPathAuthorityAccepted: false,
      runtimeNetworkActivated: false,
      rawDialogFallbackAccepted: false,
      broadInteropClaim: false,
    },
  };
}

async function runHarnessStage({ tempRoot, label, source }) {
  const result = await runProductionAppRuntimeHarness({
    tempRoot,
    preserveTempRoot: true,
    timeoutMs: 30000,
    rendererProbeLabel: label,
    rendererProbeSource: source,
  });
  return collectHarnessStage(result);
}

export async function runFullArchiveCandidate(options = {}) {
  const outDir = path.resolve(options.outDir || DEFAULT_OUT_DIR);
  await fs.mkdir(outDir, { recursive: true });
  const sourceTempRoot = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-r24-full-archive-source-')),
  );
  const importTempRoot = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-r24-full-archive-restore-')),
  );
  const artifactRoot = path.join(sourceTempRoot, 'artifacts');
  await fs.mkdir(artifactRoot, { recursive: true });
  const archivePath = path.join(artifactRoot, 'source-project.yalken.zip');
  let report = null;

  try {
    let runtime = null;
    let artifacts = {};
    if (options.skipRuntime === true) {
      runtime = {};
      artifacts = { tempRootRemoved: false };
    } else {
      const setup = await runHarnessStage({
        tempRoot: sourceTempRoot,
        label: 'r24FullArchiveSetup',
        source: buildSetupProbe(),
      });
      const setupProbe = stageProbe(setup);
      if (setup.ok !== true || setupProbe.ok !== 1) {
        runtime = { setup };
      } else {
        const scenePath = await findCreatedScenePath(sourceTempRoot);
        if (!scenePath) throw new Error('CREATED_SCENE_PATH_NOT_DISCOVERED');
        const sceneId = sceneIdFromPath(sourceTempRoot, scenePath);
        if (!sceneId) throw new Error('CREATED_SCENE_ID_NOT_DISCOVERED');
        setupProbe.scenePath = scenePath;
        setupProbe.sceneId = sceneId;

        const exportStage = await runHarnessStage({
          tempRoot: sourceTempRoot,
          label: 'r24FullArchiveExport',
          source: buildExportProbe({
            sceneId,
            sourceProjectId: setupProbe.projectId,
            archivePath,
          }),
        });
        const importRestore = await runHarnessStage({
          tempRoot: importTempRoot,
          label: 'r24FullArchiveImportRestore',
          source: buildImportRestoreProbe({
            archivePath,
            sourceProjectId: setupProbe.projectId,
          }),
        });
        const importRestoreProbe = stageProbe(importRestore);
        const importedProjectId = importRestoreProbe.importedProjectId || '';

        const apply = importedProjectId
          ? await runHarnessStage({
            tempRoot: importTempRoot,
            label: 'r24FullArchiveApply',
            source: buildApplyProbe({ sceneId, importedProjectId }),
          })
          : {
            ok: false,
            runtimeKind: 'production-app-runtime-harness',
            timedOut: false,
            exitCode: -1,
            signal: '',
            networkRequests: -1,
            dialogCalls: -1,
            rendererProbe: { ok: 0, stage: 'apply', message: 'IMPORTED_PROJECT_ID_MISSING' },
          };

        const freshReadback = importedProjectId
          ? await runHarnessStage({
            tempRoot: importTempRoot,
            label: 'r24FullArchiveFreshReadback',
            source: buildFreshReadbackProbe({ sceneId, importedProjectId }),
          })
          : {
            ok: false,
            runtimeKind: 'production-app-runtime-harness',
            timedOut: false,
            exitCode: -1,
            signal: '',
            networkRequests: -1,
            dialogCalls: -1,
            rendererProbe: { ok: 0, stage: 'freshReadback', message: 'IMPORTED_PROJECT_ID_MISSING' },
          };

        runtime = { setup, export: exportStage, importRestore, apply, freshReadback };
        artifacts = {
          sourceTempRoot,
          importTempRoot,
          artifactRoot,
          exportedArchive: archiveProof(archivePath),
          sourceSceneFile: fileProof(scenePath),
          importedSceneFile: fileProof(importedScenePath(importTempRoot, sceneId)),
          sourceTextHash: sha256Text(SOURCE_TEXT),
          appliedTextHash: sha256Text(APPLIED_TEXT),
        };
      }
    }

    await fs.rm(sourceTempRoot, { recursive: true, force: true });
    await fs.rm(importTempRoot, { recursive: true, force: true });
    const sourceTempRootRemoved = !fsSync.existsSync(sourceTempRoot);
    const importTempRootRemoved = !fsSync.existsSync(importTempRoot);
    const tempRootRemoved = sourceTempRootRemoved && importTempRootRemoved;
    artifacts = { ...artifacts, tempRootRemoved };
    report = evaluateFullArchiveCandidate({
      runtime,
      artifacts,
      headSha: git(['rev-parse', 'HEAD']),
      sourceTree: git(['rev-parse', 'HEAD^{tree}']),
    });
  } catch (error) {
    await fs.rm(sourceTempRoot, { recursive: true, force: true }).catch(() => {});
    await fs.rm(importTempRoot, { recursive: true, force: true }).catch(() => {});
    const sourceTempRootRemoved = !fsSync.existsSync(sourceTempRoot);
    const importTempRootRemoved = !fsSync.existsSync(importTempRoot);
    const tempRootRemoved = sourceTempRootRemoved && importTempRootRemoved;
    report = evaluateFullArchiveCandidate({
      runtime: {},
      artifacts: {
        sourceTempRoot,
        importTempRoot,
        tempRootRemoved,
        error: {
          message: error && typeof error.message === 'string' ? error.message : String(error),
        },
      },
      headSha: git(['rev-parse', 'HEAD']),
      sourceTree: git(['rev-parse', 'HEAD^{tree}']),
    });
  }

  const reportPath = path.join(outDir, 'full-archive-candidate-report.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const reportSha256 = sha256File(reportPath);
  return {
    ...report,
    reportPath,
    reportSha256,
    reportStableHash: sha256Text(stableJson(report)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runFullArchiveCandidate(args);
  console.log(`R24_FULL_ARCHIVE_CANDIDATE_RESULT:${JSON.stringify(result)}`);
  process.exit(result.pass ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}

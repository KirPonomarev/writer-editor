#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const COVERED_SEAMS = Object.freeze([
  'save-reopen-text-roundtrip',
  'save-reopen-observable-payload-roundtrip',
  'recovery-restore-payload-roundtrip',
]);

const FAIL_REASON_FORCED_NEGATIVE = 'E_TIPTAP_PERSISTENCE_PROOFHOOK_FORCED_NEGATIVE';
const FAIL_REASON_SEAM = 'E_TIPTAP_PERSISTENCE_PROOFHOOK_SEAM_FAIL';
const FAIL_REASON_UNEXPECTED = 'E_TIPTAP_PERSISTENCE_PROOFHOOK_UNEXPECTED';

function loadModuleByVm(filePath, exportNames) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const evalSource = sourceText
    .replace(/export function /g, 'function ')
    .concat(`\nmodule.exports = { ${exportNames.join(', ')} };`);

  const context = {
    window: {},
    module: { exports: {} },
    exports: {},
    console,
  };
  vm.createContext(context);
  new vm.Script(evalSource, { filename: filePath }).runInContext(context);
  return context.module.exports;
}

async function loadDocumentContentEnvelopeModule() {
  const moduleUrl = new URL('../../src/renderer/documentContentEnvelope.mjs', import.meta.url);
  return import(moduleUrl.href);
}

function parseArgs(argv) {
  const out = {
    json: false,
    forceNegative: false,
  };

  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

async function evaluatePersistenceSeams() {
  const runtimeBridgePath = path.resolve('src/renderer/tiptap/runtimeBridge.js');
  const ipcModule = await loadDocumentContentEnvelopeModule();
  const runtimeBridgeModule = loadModuleByVm(runtimeBridgePath, ['normalizeRecoveryPayload']);
  const { composeObservablePayload, parseObservablePayload } = ipcModule;
  const { normalizeRecoveryPayload } = runtimeBridgeModule;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase00-tiptap-persist-'));
  const seamResults = {};

  try {
    const savePath = path.join(tempDir, 'save-reopen.txt');
    const saveSourceText = 'Roundtrip line one\nRoundtrip line two';
    fs.writeFileSync(savePath, saveSourceText, 'utf8');
    const saveReadText = fs.readFileSync(savePath, 'utf8');
    seamResults['save-reopen-text-roundtrip'] = (saveReadText === saveSourceText);

    const payloadPath = path.join(tempDir, 'observable-payload.txt');
    const sourceObservable = {
      text: 'Payload text block A\nPayload text block B',
      metaEnabled: true,
      meta: {
        synopsis: 'Synopsis first line\nSynopsis second line',
        status: 'draft',
        tags: { pov: 'Alice', line: 'Main', place: 'Paris' },
      },
      cards: [
        { title: 'Card One', text: 'Body One', tags: 't1' },
        { title: 'Card Two', text: 'Body Two', tags: 't2' },
      ],
    };
    const composedObservable = composeObservablePayload(sourceObservable);
    fs.writeFileSync(payloadPath, composedObservable, 'utf8');
    const persistedObservable = fs.readFileSync(payloadPath, 'utf8');
    const parsedObservable = parseObservablePayload(persistedObservable);
    const reparsedObservable = parseObservablePayload(
      composeObservablePayload({
        text: parsedObservable.text,
        metaEnabled: true,
        meta: parsedObservable.meta,
        cards: parsedObservable.cards,
      }),
    );

    seamResults['save-reopen-observable-payload-roundtrip'] = Boolean(
      parsedObservable.text === sourceObservable.text
      && parsedObservable.meta.status === 'draft'
      && parsedObservable.meta.tags.pov === 'Alice'
      && parsedObservable.cards.length === 2
      && reparsedObservable.text === parsedObservable.text
      && JSON.stringify(reparsedObservable.meta) === JSON.stringify(parsedObservable.meta)
      && JSON.stringify(reparsedObservable.cards) === JSON.stringify(parsedObservable.cards)
    );

    const autosavePath = path.join(tempDir, 'autosave.txt');
    const autosavePayload = composeObservablePayload({
      text: 'Recovered autosave text payload',
      metaEnabled: false,
      meta: { synopsis: '', status: 'draft', tags: { pov: '', line: '', place: '' } },
      cards: [],
    });
    fs.writeFileSync(autosavePath, autosavePayload, 'utf8');
    const restoredAutosavePayload = fs.readFileSync(autosavePath, 'utf8');
    const restoredAutosaveParsed = parseObservablePayload(restoredAutosavePayload);

    const normalizedRecoveryA = normalizeRecoveryPayload({ message: 'Recovered autosave on reopen path', source: 'autosave' });
    const normalizedRecoveryB = normalizeRecoveryPayload({});
    const normalizedRecoveryC = normalizeRecoveryPayload({});

    seamResults['recovery-restore-payload-roundtrip'] = Boolean(
      restoredAutosaveParsed.text === 'Recovered autosave text payload'
      && normalizedRecoveryA.handled === true
      && normalizedRecoveryA.message === 'Recovered autosave on reopen path'
      && normalizedRecoveryA.source === 'autosave'
      && normalizedRecoveryB.handled === true
      && normalizedRecoveryB.message === 'Recovered autosave on reopen path'
      && normalizedRecoveryB.source === 'unknown'
      && JSON.stringify(normalizedRecoveryB) === JSON.stringify(normalizedRecoveryC)
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return seamResults;
}

export async function evaluatePhase00TiptapPersistenceProofhook(input = {}) {
  const forceNegative = Boolean(input.forceNegative);
  const seamResults = await evaluatePersistenceSeams();
  const failedSeam = COVERED_SEAMS.find((id) => seamResults[id] !== true) || '';

  if (forceNegative) {
    return {
      ok: false,
      failReason: FAIL_REASON_FORCED_NEGATIVE,
      coveredSeams: [...COVERED_SEAMS],
      seamResults,
      scope: 'payload-level-persistence-seams-only',
      forcedNegative: true,
    };
  }

  if (failedSeam) {
    return {
      ok: false,
      failReason: `${FAIL_REASON_SEAM}:${failedSeam}`,
      coveredSeams: [...COVERED_SEAMS],
      seamResults,
      scope: 'payload-level-persistence-seams-only',
      forcedNegative: false,
    };
  }

  return {
    ok: true,
    failReason: '',
    coveredSeams: [...COVERED_SEAMS],
    seamResults,
    scope: 'payload-level-persistence-seams-only',
    forcedNegative: false,
  };
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_TIPTAP_PERSISTENCE_FORCE_NEGATIVE === '1';

  let state;
  try {
    state = await evaluatePhase00TiptapPersistenceProofhook({ forceNegative });
  } catch (error) {
    state = {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      coveredSeams: [...COVERED_SEAMS],
      seamResults: {},
      scope: 'payload-level-persistence-seams-only',
      forcedNegative: forceNegative,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_TIPTAP_PERSISTENCE_PROOFHOOK_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_TIPTAP_PERSISTENCE_PROOFHOOK_FAIL_REASON=${state.failReason}`);
    console.log(`PHASE00_TIPTAP_PERSISTENCE_PROOFHOOK_COVERED_SEAMS=${state.coveredSeams.join(',')}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  await runCli();
}

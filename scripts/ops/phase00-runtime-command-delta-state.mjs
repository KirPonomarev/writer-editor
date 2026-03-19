#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE00_RUNTIME_COMMAND_DELTA_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE00_RUNTIME_COMMAND_DELTA_UNEXPECTED';
const FALSE_PASS_GUARD = 'HOLD_WHEN_MISSING_ON_TIPTAP_IDS_IS_NON_EMPTY';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function extractBalancedBlock(sourceText, startToken) {
  const startIndex = sourceText.indexOf(startToken);
  if (startIndex < 0) return '';

  let braceStart = -1;
  const tokenBraceOffset = startToken.lastIndexOf('{');
  if (tokenBraceOffset >= 0) {
    braceStart = startIndex + tokenBraceOffset;
  } else {
    braceStart = sourceText.indexOf('{', startIndex);
  }
  if (braceStart < 0) return '';

  let depth = 0;
  for (let index = braceStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return sourceText.slice(braceStart, index + 1);
      }
    }
  }

  return '';
}

function extractCommandIds(blockText) {
  const ids = new Set();
  const regex = /(?:^|[^.\w])command\s*===\s*'([^']+)'/gm;
  let match = regex.exec(blockText);
  while (match) {
    ids.add(match[1]);
    match = regex.exec(blockText);
  }
  return [...ids].sort();
}

function evaluateDeltaState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);
  const editorSource = fs.readFileSync(path.resolve('src/renderer/editor.js'), 'utf8');
  const runtimeBridgeSource = fs.readFileSync(path.resolve('src/renderer/tiptap/runtimeBridge.js'), 'utf8');

  const legacyBlock = extractBalancedBlock(
    editorSource,
    'window.electronAPI.onRuntimeCommand((payload) => {',
  );
  const tiptapBlock = extractBalancedBlock(
    runtimeBridgeSource,
    'handleRuntimeCommand(payload = {}) {',
  );

  const legacyRuntimeCommandIds = extractCommandIds(legacyBlock);
  const tiptapRuntimeCommandIds = extractCommandIds(tiptapBlock);

  const tiptapSet = new Set(tiptapRuntimeCommandIds);
  const missingOnTiptapIds = legacyRuntimeCommandIds.filter((id) => !tiptapSet.has(id));
  const overallStatus = missingOnTiptapIds.length === 0 ? 'PASS' : 'HOLD';
  const openGapIds = missingOnTiptapIds.length > 0 ? [...missingOnTiptapIds] : [];

  if (forceNegative) {
    return {
      ok: false,
      failReason: FAIL_REASON_FORCED_NEGATIVE,
      overallStatus: 'HOLD',
      legacyRuntimeCommandIds,
      tiptapRuntimeCommandIds,
      missingOnTiptapIds: Array.from(new Set([...missingOnTiptapIds, 'forced-negative-path'])),
      openGapIds: Array.from(new Set([...openGapIds, 'forced-negative-path'])),
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: ['editor.js', 'runtimeBridge.js'],
      forcedNegative: true,
    };
  }

  return {
    ok: true,
    failReason: '',
    overallStatus,
    legacyRuntimeCommandIds,
    tiptapRuntimeCommandIds,
    missingOnTiptapIds,
    openGapIds,
    falsePassGuard: FALSE_PASS_GUARD,
    evidenceSources: ['editor.js', 'runtimeBridge.js'],
    forcedNegative: false,
  };
}

export function evaluatePhase00RuntimeCommandDeltaState(input = {}) {
  try {
    return evaluateDeltaState(input);
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      legacyRuntimeCommandIds: [],
      tiptapRuntimeCommandIds: [],
      missingOnTiptapIds: [],
      openGapIds: ['runtime-command-delta-evaluation-error'],
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: ['editor.js', 'runtimeBridge.js'],
      forcedNegative: Boolean(input.forceNegative),
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_RUNTIME_COMMAND_DELTA_FORCE_NEGATIVE === '1';
  const state = evaluatePhase00RuntimeCommandDeltaState({ forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_RUNTIME_COMMAND_DELTA_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_RUNTIME_COMMAND_DELTA_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE00_RUNTIME_COMMAND_DELTA_MISSING_ON_TIPTAP_IDS=${state.missingOnTiptapIds.join(',')}`);
    console.log(`PHASE00_RUNTIME_COMMAND_DELTA_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

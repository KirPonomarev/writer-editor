#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const INPUT_HANDLER_ANCHOR = "editor.addEventListener('input', () =>";
const DEFAULT_EDITOR_PATH = 'src/renderer/editor.js';
const DEFAULT_MAIN_PATH = 'src/main.js';
const DEFAULT_SAMPLE_ITERATIONS = 200;
const DEFAULT_SAMPLE_WARMUP = 40;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readUtf8IfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function extractBlockFrom(source, anchor) {
  const startIndex = source.indexOf(anchor);
  if (startIndex < 0) {
    throw new Error(`anchor_not_found:${anchor}`);
  }
  const braceStart = source.indexOf('{', startIndex);
  if (braceStart < 0) {
    throw new Error(`block_start_not_found:${anchor}`);
  }

  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
  }
  throw new Error(`block_unclosed:${anchor}`);
}

function parseNumericConst(source, name, fallbackValue) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)\\s*;`, 'u'));
  if (!match) return fallbackValue;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function computeP95(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index];
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function measureInputHandlerBody(inputHandlerBody, iterations, warmupIterations) {
  const scheduleIncrementalInputDomSync = () => {};
  const syncPlainTextBufferFromEditorDom = () => {};
  const scheduleDeferredHotpathRender = () => {};
  const scheduleDeferredPaginationRefresh = () => {};
  const markAsModified = () => {};
  const updateWordCount = () => {};

  let callable;
  try {
    callable = new Function(
      'scheduleIncrementalInputDomSync',
      'syncPlainTextBufferFromEditorDom',
      'scheduleDeferredHotpathRender',
      'scheduleDeferredPaginationRefresh',
      'markAsModified',
      'updateWordCount',
      inputHandlerBody,
    );
  } catch (error) {
    return {
      ok: false,
      failReason: `input_handler_compile_error:${error && error.message ? error.message : 'unknown'}`,
      iterations,
      warmupIterations,
      samplesMs: [],
      p95Ms: 0,
      medianMs: 0,
      maxMs: 0,
      minMs: 0,
    };
  }

  for (let i = 0; i < warmupIterations; i += 1) {
    try {
      callable(
        scheduleIncrementalInputDomSync,
        syncPlainTextBufferFromEditorDom,
        scheduleDeferredHotpathRender,
        scheduleDeferredPaginationRefresh,
        markAsModified,
        updateWordCount,
      );
    } catch (error) {
      return {
        ok: false,
        failReason: `input_handler_runtime_error:${error && error.message ? error.message : 'unknown'}`,
        iterations,
        warmupIterations,
        samplesMs: [],
        p95Ms: 0,
        medianMs: 0,
        maxMs: 0,
        minMs: 0,
      };
    }
  }

  const samplesMs = [];
  for (let i = 0; i < iterations; i += 1) {
    try {
      const started = performance.now();
      callable(
        scheduleIncrementalInputDomSync,
        syncPlainTextBufferFromEditorDom,
        scheduleDeferredHotpathRender,
        scheduleDeferredPaginationRefresh,
        markAsModified,
        updateWordCount,
      );
      const elapsed = performance.now() - started;
      samplesMs.push(elapsed);
    } catch (error) {
      return {
        ok: false,
        failReason: `input_handler_runtime_error:${error && error.message ? error.message : 'unknown'}`,
        iterations,
        warmupIterations,
        samplesMs,
        p95Ms: 0,
        medianMs: 0,
        maxMs: 0,
        minMs: 0,
      };
    }
  }

  const p95Ms = computeP95(samplesMs);
  const medianMs = computeMedian(samplesMs);

  return {
    ok: true,
    failReason: '',
    iterations,
    warmupIterations,
    samplesMs,
    p95Ms,
    medianMs,
    maxMs: Math.max(...samplesMs),
    minMs: Math.min(...samplesMs),
  };
}

function analyzeInputHandler(inputHandlerBody) {
  const requiredPatterns = [
    /scheduleIncrementalInputDomSync\(\);/u,
    /syncPlainTextBufferFromEditorDom\(\);/u,
    /scheduleDeferredHotpathRender\(\{\s*includePagination:\s*false[\s\S]*?\}\);/u,
    /scheduleDeferredPaginationRefresh\(\);/u,
    /markAsModified\(\);/u,
    /updateWordCount\(\);/u,
  ];

  const forbiddenPatterns = [
    /setPlainText\s*\(/u,
    /renderStyledView\s*\(/u,
    /paginateNodes\s*\(/u,
    /editor\.innerHTML\s*=/u,
  ];

  const requiredMissing = requiredPatterns
    .map((pattern) => pattern.source)
    .filter((source) => !(new RegExp(source, 'u')).test(inputHandlerBody));

  const forbiddenHits = forbiddenPatterns
    .map((pattern) => pattern.source)
    .filter((source) => (new RegExp(source, 'u')).test(inputHandlerBody));

  const blockingPatternHits = [];
  const typingLoopForbiddenPatterns = [
    /\bawait\b/u,
    /\bfetch\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\bautosave\b/u,
    /\bbackup\b/u,
    /\bwriteFileAtomic\b/u,
    /\bqueueDiskOperation\b/u,
    /\bipcRenderer\b/u,
  ];

  for (const pattern of typingLoopForbiddenPatterns) {
    if (pattern.test(inputHandlerBody)) {
      blockingPatternHits.push(pattern.source);
    }
  }

  const noFullDocumentRerenderPerKeystroke = requiredMissing.length === 0 && forbiddenHits.length === 0;

  return {
    noFullDocumentRerenderPerKeystroke,
    requiredMissing,
    forbiddenHits,
    typingLoopBlockingPatternHits: blockingPatternHits,
    typingLoopInlineNonBlocking: blockingPatternHits.length === 0,
  };
}

function analyzeAutosaveBackupNonBlocking(mainSource) {
  const hasAutosaveQueued = /queueDiskOperation\([\s\S]*?autosave temporary/u.test(mainSource);
  const hasBackupCurrentQueued = /queueDiskOperation\([\s\S]*?backup current file/u.test(mainSource);
  const hasBackupAutosaveQueued = /queueDiskOperation\([\s\S]*?backup autosave/u.test(mainSource);
  const syncApiPattern = /\b(readFileSync|writeFileSync|appendFileSync|execSync|spawnSync)\b/u;
  const labels = ['autosave temporary', 'backup current file', 'backup autosave'];
  const syncHitsNearCriticalQueues = [];
  for (const label of labels) {
    const index = mainSource.indexOf(label);
    if (index < 0) continue;
    const start = Math.max(0, index - 500);
    const end = Math.min(mainSource.length, index + 500);
    const region = mainSource.slice(start, end);
    if (syncApiPattern.test(region)) {
      syncHitsNearCriticalQueues.push(label);
    }
  }
  const noSyncIoApis = syncHitsNearCriticalQueues.length === 0;

  const ok = hasAutosaveQueued && hasBackupCurrentQueued && hasBackupAutosaveQueued && noSyncIoApis;

  return {
    ok,
    hasAutosaveQueued,
    hasBackupCurrentQueued,
    hasBackupAutosaveQueued,
    noSyncIoApis,
    syncHitsNearCriticalQueues,
  };
}

function analyzeEditorHotpath(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const editorPath = path.resolve(repoRoot, normalizeString(input.editorPath || DEFAULT_EDITOR_PATH));
  const mainPath = path.resolve(repoRoot, normalizeString(input.mainPath || DEFAULT_MAIN_PATH));
  const editorSource = normalizeString(input.editorSourceOverride)
    ? String(input.editorSourceOverride)
    : readUtf8IfExists(editorPath);
  const mainSource = normalizeString(input.mainSourceOverride)
    ? String(input.mainSourceOverride)
    : readUtf8IfExists(mainPath);

  const issues = [];
  if (!editorSource) issues.push('editor_source_missing');
  if (!mainSource) issues.push('main_source_missing');

  let inputHandlerBody = '';
  if (!issues.length) {
    try {
      inputHandlerBody = extractBlockFrom(editorSource, INPUT_HANDLER_ANCHOR);
    } catch (error) {
      issues.push(error && error.message ? error.message : 'input_handler_extract_failed');
    }
  }

  const hotpathConstants = {
    HOTPATH_RENDER_DEBOUNCE_MS: parseNumericConst(editorSource, 'HOTPATH_RENDER_DEBOUNCE_MS', 32),
    HOTPATH_FULL_RENDER_MIN_INTERVAL_MS: parseNumericConst(editorSource, 'HOTPATH_FULL_RENDER_MIN_INTERVAL_MS', 280),
    HOTPATH_PAGINATION_IDLE_DELAY_MS: parseNumericConst(editorSource, 'HOTPATH_PAGINATION_IDLE_DELAY_MS', 220),
  };

  let inputHandlerAnalysis = {
    noFullDocumentRerenderPerKeystroke: false,
    requiredMissing: ['input_handler_missing'],
    forbiddenHits: [],
    typingLoopBlockingPatternHits: [],
    typingLoopInlineNonBlocking: false,
  };

  let sampling = {
    ok: false,
    failReason: 'sampling_not_run',
    iterations: 0,
    warmupIterations: 0,
    samplesMs: [],
    p95Ms: 0,
    medianMs: 0,
    maxMs: 0,
    minMs: 0,
  };

  if (!issues.length) {
    inputHandlerAnalysis = analyzeInputHandler(inputHandlerBody);
    sampling = measureInputHandlerBody(
      inputHandlerBody,
      Number.isInteger(input.sampleIterations) ? input.sampleIterations : DEFAULT_SAMPLE_ITERATIONS,
      Number.isInteger(input.sampleWarmupIterations) ? input.sampleWarmupIterations : DEFAULT_SAMPLE_WARMUP,
    );
  }

  const autosaveBackupNonBlocking = analyzeAutosaveBackupNonBlocking(mainSource);

  const ok = issues.length === 0
    && inputHandlerAnalysis.noFullDocumentRerenderPerKeystroke
    && inputHandlerAnalysis.typingLoopInlineNonBlocking
    && sampling.ok
    && autosaveBackupNonBlocking.ok;

  return {
    ok,
    issues,
    editorPath: path.relative(repoRoot, editorPath).replaceAll(path.sep, '/'),
    mainPath: path.relative(repoRoot, mainPath).replaceAll(path.sep, '/'),
    inputHandlerAnchor: INPUT_HANDLER_ANCHOR,
    hotpathConstants,
    inputHandlerAnalysis,
    sampling,
    autosaveBackupNonBlocking,
  };
}

module.exports = {
  INPUT_HANDLER_ANCHOR,
  analyzeEditorHotpath,
  extractBlockFrom,
};

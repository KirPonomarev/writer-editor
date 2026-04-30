#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TASK_ID = 'CONTOUR_04_WRITE_IMPL';
export const SCHEMA_VERSION = 3;
export const ARTIFACT_ID = 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3';
export const STATUS_BASENAME = 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json';
export const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
export const TOKEN_NAME = 'EDITORIAL_SHEET_STRESS_LANE_STATUS_OK';
export const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WRITE_AUTHORITY_RULE = 'CURRENT_CLEAN_DETACHED_MAINLINE_ONLY';
export const ROW_NODE_MODULES_ROOT_ENV = 'EDITORIAL_SHEET_NODE_MODULES_ROOT';
export const OWNED_BASENAMES = Object.freeze([
  'editorial-sheet-stress-lane-state.mjs',
  'editorial-sheet-stress-lane-status.contract.test.js',
  STATUS_BASENAME,
  'GOVERNANCE_CHANGE_APPROVALS.json',
]);

const STATUS_VALUES = new Set(['PASS', 'FAIL', 'STOP_RESOURCE_LIMIT']);
const SCALE_ROW_TIMEOUT_MS = 8 * 60 * 1000;
const DIAGNOSTIC_ROW_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
export const READINESS_RULE = '5000_READINESS_REQUIRES_TRACKED_5000_PASS';

export const ROW_DEFINITIONS = Object.freeze([
  {
    id: 'TRACKED_SCALE_2000',
    rowClass: 'tracked-scale',
    pageCount: 2000,
    diagnosticOnly: false,
    timeoutMs: SCALE_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/editor-sheet-instrumented-stress-smoke.mjs'],
    summaryPrefix: 'EDITOR_SHEET_INSTRUMENTED_STRESS_SUMMARY:',
    env: { EDITOR_SHEET_STRESS_TARGET_PAGE_COUNT: '2000' },
  },
  {
    id: 'TRACKED_SCALE_3000',
    rowClass: 'tracked-scale',
    pageCount: 3000,
    diagnosticOnly: false,
    timeoutMs: SCALE_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/editor-sheet-instrumented-stress-smoke.mjs'],
    summaryPrefix: 'EDITOR_SHEET_INSTRUMENTED_STRESS_SUMMARY:',
    env: { EDITOR_SHEET_STRESS_TARGET_PAGE_COUNT: '3000' },
  },
  {
    id: 'TRACKED_SCALE_4000',
    rowClass: 'tracked-scale',
    pageCount: 4000,
    diagnosticOnly: false,
    timeoutMs: SCALE_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/editor-sheet-instrumented-stress-smoke.mjs'],
    summaryPrefix: 'EDITOR_SHEET_INSTRUMENTED_STRESS_SUMMARY:',
    env: { EDITOR_SHEET_STRESS_TARGET_PAGE_COUNT: '4000' },
  },
  {
    id: 'TRACKED_SCALE_5000',
    rowClass: 'tracked-scale',
    pageCount: 5000,
    diagnosticOnly: false,
    timeoutMs: SCALE_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/editor-sheet-instrumented-stress-smoke.mjs'],
    summaryPrefix: 'EDITOR_SHEET_INSTRUMENTED_STRESS_SUMMARY:',
    env: { EDITOR_SHEET_STRESS_TARGET_PAGE_COUNT: '5000' },
  },
  {
    id: 'VIEWPORT_CONTINUITY',
    rowClass: 'diagnostic-viewport',
    diagnosticOnly: true,
    timeoutMs: DIAGNOSTIC_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/vertical-sheet-performance-window-smoke.mjs'],
    summaryPrefix: 'VERTICAL_SHEET_PERFORMANCE_WINDOW_SUMMARY:',
    env: {},
  },
  {
    id: 'INPUT_CONTINUITY',
    rowClass: 'diagnostic-input',
    diagnosticOnly: true,
    timeoutMs: DIAGNOSTIC_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/vertical-sheet-input-stability-smoke.mjs'],
    summaryPrefix: 'VERTICAL_SHEET_INPUT_STABILITY_SMOKE_SUMMARY:',
    env: {},
  },
  {
    id: 'GAP_CONTINUITY',
    rowClass: 'diagnostic-gap',
    diagnosticOnly: true,
    timeoutMs: DIAGNOSTIC_ROW_TIMEOUT_MS,
    commandArgs: ['--test', 'test/unit/vertical-sheet-gap-smoke.mjs'],
    summaryPrefix: 'VERTICAL_SHEET_GAP_SMOKE_SUMMARY:',
    env: {},
  },
]);

export const EXPECTED_ROW_IDS = Object.freeze(ROW_DEFINITIONS.map((row) => row.id));
export const TRACKED_SCALE_ROW_IDS = Object.freeze(
  ROW_DEFINITIONS.filter((row) => row.rowClass === 'tracked-scale').map((row) => row.id),
);
export const DIAGNOSTIC_ONLY_ROW_IDS = Object.freeze(
  ROW_DEFINITIONS.filter((row) => row.diagnosticOnly).map((row) => row.id),
);
export const TRACKED_SCALE_PAGE_COUNTS = Object.freeze(
  ROW_DEFINITIONS.filter((row) => row.rowClass === 'tracked-scale').map((row) => row.pageCount),
);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    write: false,
    statusPath: '',
    repoRoot: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = normalizeString(argv[index]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--write') {
      out.write = true;
      continue;
    }
    if (arg === '--status-path' && index + 1 < argv.length) {
      out.statusPath = normalizeString(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
      continue;
    }
    if (arg === '--repo-root' && index + 1 < argv.length) {
      out.repoRoot = normalizeString(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--repo-root=')) {
      out.repoRoot = normalizeString(arg.slice('--repo-root='.length));
    }
  }

  return out;
}

function resolveStatusPath(repoRoot, statusPathArg) {
  if (statusPathArg) {
    return path.isAbsolute(statusPathArg)
      ? statusPathArg
      : path.resolve(repoRoot, statusPathArg);
  }
  return path.join(repoRoot, STATUS_REL_PATH);
}

function readJsonObject(targetPath) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    return null;
  }
}

function getGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? normalizeString(result.stdout) : '';
}

function getGitRef(repoRoot, refName) {
  const result = spawnSync('git', ['rev-parse', refName], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? normalizeString(result.stdout) : '';
}

function getGitStatusPorcelain(repoRoot) {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? String(result.stdout || '') : '';
}

function hasElectronInstall(nodeModulesRoot) {
  if (typeof nodeModulesRoot !== 'string' || !nodeModulesRoot) return false;
  return fs.existsSync(path.join(nodeModulesRoot, 'electron', 'package.json'));
}

function collectWorktreeNodeModulesRoots(repoRoot) {
  const roots = [];
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) return roots;

  for (const line of String(result.stdout || '').split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const worktreePath = normalizeString(line.slice('worktree '.length));
    if (!worktreePath) continue;
    roots.push(path.join(worktreePath, 'node_modules'));
  }
  return roots;
}

function resolveRowNodeModulesRoot(repoRoot) {
  const candidates = [
    normalizeString(process.env[ROW_NODE_MODULES_ROOT_ENV]),
    path.join(repoRoot, 'node_modules'),
    ...collectWorktreeNodeModulesRoots(repoRoot),
  ];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (hasElectronInstall(candidate)) return candidate;
  }
  return '';
}

function getDetachedHeadState(repoRoot) {
  const result = spawnSync('git', ['symbolic-ref', '-q', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return {
    detachedHead: result.status !== 0,
    branchName: result.status === 0 ? normalizeString(result.stdout) : '',
  };
}

export function getRepoState(repoRoot = DEFAULT_REPO_ROOT) {
  const currentHeadSha = getGitHead(repoRoot);
  const originMainHeadSha = getGitRef(repoRoot, 'refs/remotes/origin/main');
  const detachedState = getDetachedHeadState(repoRoot);
  const statusPorcelain = getGitStatusPorcelain(repoRoot);

  return {
    currentHeadSha,
    originMainHeadSha,
    detachedHead: detachedState.detachedHead,
    branchName: detachedState.branchName,
    worktreeClean: statusPorcelain.trim() === '',
    statusPorcelain,
    changedPaths: statusPorcelain
      .split(/\r?\n/u)
      .map((line) => line.slice(3).trim())
      .filter(Boolean),
  };
}

export function evaluateWriteAuthority(repoState) {
  const issues = [];
  const changedBasenames = (Array.isArray(repoState?.changedPaths) ? repoState.changedPaths : [])
    .map((entry) => path.basename(entry));
  const unownedDirtyBasenames = [...new Set(changedBasenames.filter((basename) => !OWNED_BASENAMES.includes(basename)))];

  if (!repoState?.detachedHead) issues.push('HEAD_NOT_DETACHED');
  if (!normalizeString(repoState?.currentHeadSha)) issues.push('CURRENT_HEAD_SHA_MISSING');
  if (!normalizeString(repoState?.originMainHeadSha)) issues.push('ORIGIN_MAIN_HEAD_SHA_MISSING');
  if (
    normalizeString(repoState?.currentHeadSha)
    && normalizeString(repoState?.originMainHeadSha)
    && normalizeString(repoState?.currentHeadSha) !== normalizeString(repoState?.originMainHeadSha)
  ) {
    issues.push('HEAD_NOT_AT_ORIGIN_MAIN');
  }
  if (unownedDirtyBasenames.length > 0) issues.push('UNOWNED_DIRTY_PATHS_PRESENT');

  return {
    ok: issues.length === 0,
    rule: WRITE_AUTHORITY_RULE,
    issues,
    changedBasenames,
    unownedDirtyBasenames,
  };
}

function findSummaryLine(stdout, prefix) {
  const source = String(stdout || '');
  const prefixIndex = source.indexOf(prefix);
  if (prefixIndex < 0) return null;

  const jsonStart = source.indexOf('{', prefixIndex + prefix.length);
  if (jsonStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = jsonStart; index < source.length; index += 1) {
    const ch = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(jsonStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function summarizeScaleRow(summary) {
  const scenarios = Array.isArray(summary?.scenarios) ? summary.scenarios : [];
  const highestScenario = scenarios.reduce((best, row) => {
    const targetPageCount = Number(row?.targetPageCount || 0);
    if (!best || targetPageCount > Number(best?.targetPageCount || 0)) return row;
    return best;
  }, null);
  const typing = highestScenario?.typing && typeof highestScenario.typing === 'object'
    ? highestScenario.typing
    : null;

  return {
    targetPageCount: Number(summary?.targetPageCount || highestScenario?.targetPageCount || 0),
    actualPageCount: Number(highestScenario?.actualPageCount || 0),
    renderedSheetShellCount: Number(highestScenario?.renderedSheetShellCount || 0),
    hiddenPageCount: Number(highestScenario?.hiddenPageCount || 0),
    domNodeCount: Number(highestScenario?.domNodeCount || 0),
    loadMs: Number(highestScenario?.loadMs || 0),
    networkRequests: Number(summary?.networkRequests || 0),
    dialogCalls: Number(summary?.dialogCalls || 0),
    textHashStable: highestScenario?.textHashStable === true,
    typingTypeMs: Number(typing?.typeMs || 0),
    typingUndoRestoredHash: typing?.undoRestoredHash === true,
    typingRedoRestoredTypedHash: typing?.redoRestoredTypedHash === true,
    typingCleanupRestoredHash: typing?.cleanupRestoredHash === true,
  };
}

function summarizeViewportRow(summary) {
  return {
    insertMs100: Number(summary?.insertMs100 || 0),
    fullVisibleSheetRebuildAfterInput: summary?.fullVisibleSheetRebuildAfterInput === true,
    scrollViewportSheetCountImmediate: Number(summary?.scrollViewportSheetCountImmediate || 0),
    scrollViewportSheetCountSync: Number(summary?.scrollViewportSheetCountSync || 0),
    scrollViewportSheetCountSettled: Number(summary?.scrollViewportSheetCountSettled || 0),
    scrollViewportTextRectCountSettled: Number(summary?.scrollViewportTextRectCountSettled || 0),
    scrollRenderedWindowShift: Number(summary?.scrollRenderedWindowShift || 0),
    afterInputVisibleSheetCount: Number(summary?.afterInputVisibleSheetCount || 0),
    afterInputHiddenPageCount: Number(summary?.afterInputHiddenPageCount || 0),
    domNotLinearWithSourcePages: summary?.domNotLinearWithSourcePages === true,
  };
}

function summarizeInputRow(summary) {
  return {
    checkedStateCount: Number(summary?.checkedStateCount || 0),
    visibleSheetCount: Number(summary?.visibleSheetCount || 0),
    viewportVisibleSheetCount: Number(summary?.viewportVisibleSheetCount || 0),
    visibleTextRectCount: Number(summary?.visibleTextRectCount || 0),
    textGapIntersectionCount: Number(summary?.textGapIntersectionCount || 0),
    enterUndoHashRestored: summary?.enterUndoHashRestored === true,
    enterRedoHashRestored: summary?.enterRedoHashRestored === true,
    markerUndoHashRestored: summary?.markerUndoHashRestored === true,
    markerRedoHashRestored: summary?.markerRedoHashRestored === true,
    backspaceRedoTruncatedTargetAfter: Number(summary?.backspaceRedoTruncatedTargetAfter || 0),
    boundaryDistanceFromSheetBottom: Number(summary?.boundaryDistanceFromSheetBottom || 0),
  };
}

function summarizeGapRow(summary) {
  return {
    liveGapMinPx: Number(summary?.liveGapMinPx || 0),
    liveGapMaxPx: Number(summary?.liveGapMaxPx || 0),
    textGapIntersectionCount: Number(summary?.textGapIntersectionCount || 0),
    visibleTextGapIntersectionCount: Number(summary?.visibleTextGapIntersectionCount || 0),
    visibleTextBottomMarginIntersectionCount: Number(summary?.visibleTextBottomMarginIntersectionCount || 0),
    visibleTextClipMaskLossCandidateCount: Number(summary?.visibleTextClipMaskLossCandidateCount || 0),
    proseMirrorCount: Number(summary?.proseMirrorCount || 0),
  };
}

function buildObserved(rowDefinition, summary) {
  if (rowDefinition.rowClass === 'tracked-scale') return summarizeScaleRow(summary);
  if (rowDefinition.id === 'VIEWPORT_CONTINUITY') return summarizeViewportRow(summary);
  if (rowDefinition.id === 'INPUT_CONTINUITY') return summarizeInputRow(summary);
  if (rowDefinition.id === 'GAP_CONTINUITY') return summarizeGapRow(summary);
  return {};
}

function classifyRowResult(spawnResult, summary) {
  if (spawnResult.error && spawnResult.error.code === 'ETIMEDOUT') {
    return { status: 'STOP_RESOURCE_LIMIT', errorClass: 'ROW_TIMEOUT' };
  }
  if (spawnResult.signal) {
    return { status: 'STOP_RESOURCE_LIMIT', errorClass: `ROW_SIGNAL_${spawnResult.signal}` };
  }
  if (spawnResult.status === 0 && summary?.ok === true) {
    return { status: 'PASS', errorClass: '' };
  }
  if (spawnResult.status === 0 && !summary) {
    return { status: 'FAIL', errorClass: 'SUMMARY_NOT_EMITTED' };
  }
  return { status: 'FAIL', errorClass: `EXIT_${String(spawnResult.status ?? 'UNKNOWN')}` };
}

function runRow(repoRoot, rowDefinition) {
  const rowNodeModulesRoot = resolveRowNodeModulesRoot(repoRoot);
  const startedAt = new Date();
  const spawnResult = spawnSync(process.execPath, rowDefinition.commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: rowDefinition.timeoutMs,
    maxBuffer: MAX_BUFFER_BYTES,
    env: {
      ...process.env,
      ...rowDefinition.env,
      ...(rowNodeModulesRoot
        ? {
            [ROW_NODE_MODULES_ROOT_ENV]: rowNodeModulesRoot,
            NODE_PATH: [rowNodeModulesRoot, normalizeString(process.env.NODE_PATH)]
              .filter(Boolean)
              .join(path.delimiter),
          }
        : {}),
      ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
    },
  });
  const finishedAt = new Date();
  const stdout = String(spawnResult.stdout || '');
  const stderr = String(spawnResult.stderr || '');
  const summary = findSummaryLine(stdout, rowDefinition.summaryPrefix);
  const classification = classifyRowResult(spawnResult, summary);

  return {
    id: rowDefinition.id,
    rowClass: rowDefinition.rowClass,
    pageCount: Number(rowDefinition.pageCount || 0) || undefined,
    diagnosticOnly: rowDefinition.diagnosticOnly === true,
    command: `${process.execPath} ${rowDefinition.commandArgs.join(' ')}`,
    status: classification.status,
    startedAtUtc: startedAt.toISOString(),
    finishedAtUtc: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    exitCode: typeof spawnResult.status === 'number' ? spawnResult.status : null,
    errorClass: classification.errorClass,
    observed: summary ? buildObserved(rowDefinition, summary) : {},
    stdoutSummaryHash: summary ? sha256Text(JSON.stringify(summary)) : '',
    stdoutTail: stdout.slice(-400),
    stderrTail: stderr.slice(-400),
  };
}

function buildArtifact(repoRoot, rows, repoState = getRepoState(repoRoot)) {
  const explicitRowIds = ROW_DEFINITIONS.map((row) => row.id);
  const executedRowIds = rows.map((row) => row.id);
  const failedRowIds = rows.filter((row) => row.status !== 'PASS').map((row) => row.id);
  const trackedScaleRows = rows.filter((row) => row.rowClass === 'tracked-scale');
  const provisionalObservedCeiling = trackedScaleRows
    .filter((row) => row.status === 'PASS')
    .reduce((max, row) => Math.max(max, Number(row.pageCount || 0)), 0);
  const unsupportedAboveCurrentProof = TRACKED_SCALE_PAGE_COUNTS
    .filter((pageCount) => pageCount > provisionalObservedCeiling);
  const tracked5000Pass = trackedScaleRows.some((row) => row.pageCount === 5000 && row.status === 'PASS');
  const ok = failedRowIds.length === 0;

  return stableSort({
    schemaVersion: SCHEMA_VERSION,
    artifactId: ARTIFACT_ID,
    taskId: TASK_ID,
    generatedAtUtc: new Date().toISOString(),
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    repo: {
      headSha: repoState.currentHeadSha,
      originMainHeadSha: repoState.originMainHeadSha,
      detachedHead: repoState.detachedHead,
      worktreeClean: repoState.worktreeClean,
      repoRootBinding: 'WORKTREE_LOCAL',
      statusBasename: STATUS_BASENAME,
      writerScriptBasename: path.basename(fileURLToPath(import.meta.url)),
    },
    rowClasses: {
      TRACKED_SCALE: 'tracked-scale',
      DIAGNOSTIC_VIEWPORT: 'diagnostic-viewport',
      DIAGNOSTIC_INPUT: 'diagnostic-input',
      DIAGNOSTIC_GAP: 'diagnostic-gap',
    },
    rows,
    explicitRowIds,
    executedRowIds,
    failedRowIds,
    diagnosticOnlyRowIds: [...DIAGNOSTIC_ONLY_ROW_IDS],
    trackedScaleRowIds: [...TRACKED_SCALE_ROW_IDS],
    trackedScalePageCounts: [...TRACKED_SCALE_PAGE_COUNTS],
    provisionalObservedCeiling,
    unsupportedAboveCurrentProof,
    readiness: {
      editorialSheet5000Ready: ok && tracked5000Pass,
      tracked5000Pass,
      rule: READINESS_RULE,
    },
    rules: {
      writeExecutesExplicitRows: true,
      explicitScaleRowsRequired: true,
      diagnosticRowsDoNotRaiseCeiling: true,
      readinessRequiresTracked5000Pass: true,
      refreshAuthority: WRITE_AUTHORITY_RULE,
    },
  });
}

export function validateEditorialSheetStressLaneStatus(artifact) {
  const issues = [];
  const rows = Array.isArray(artifact?.rows) ? artifact.rows : [];

  if (Number(artifact?.schemaVersion || 0) !== SCHEMA_VERSION) issues.push('SCHEMA_VERSION_INVALID');
  if (normalizeString(artifact?.artifactId) !== ARTIFACT_ID) issues.push('ARTIFACT_ID_INVALID');
  if (normalizeString(artifact?.taskId) !== TASK_ID) issues.push('TASK_ID_INVALID');
  if (!Array.isArray(artifact?.explicitRowIds)) issues.push('EXPLICIT_ROW_IDS_MISSING');
  if (!Array.isArray(artifact?.executedRowIds)) issues.push('EXECUTED_ROW_IDS_MISSING');
  if (!Array.isArray(artifact?.failedRowIds)) issues.push('FAILED_ROW_IDS_MISSING');
  if (!Array.isArray(artifact?.diagnosticOnlyRowIds)) issues.push('DIAGNOSTIC_ONLY_ROW_IDS_MISSING');
  if (!Array.isArray(artifact?.unsupportedAboveCurrentProof)) issues.push('UNSUPPORTED_ABOVE_CURRENT_PROOF_MISSING');
  if (normalizeString(artifact?.readiness?.rule) !== READINESS_RULE) issues.push('READINESS_RULE_INVALID');

  const rowIds = rows.map((row) => normalizeString(row?.id));
  const expectedIdHash = sha256Text(EXPECTED_ROW_IDS.join('\n'));
  const actualIdHash = sha256Text(rowIds.join('\n'));
  if (expectedIdHash !== actualIdHash) issues.push('ROW_SET_MISMATCH');
  if (new Set(rowIds).size !== rowIds.length) issues.push('ROW_IDS_NOT_UNIQUE');

  for (const rowDefinition of ROW_DEFINITIONS) {
    const row = rows.find((entry) => entry?.id === rowDefinition.id);
    if (!row) {
      issues.push(`ROW_MISSING_${rowDefinition.id}`);
      continue;
    }
    if (normalizeString(row.rowClass) !== rowDefinition.rowClass) issues.push(`ROW_CLASS_INVALID_${rowDefinition.id}`);
    if (Boolean(row.diagnosticOnly) !== rowDefinition.diagnosticOnly) issues.push(`ROW_DIAGNOSTIC_FLAG_INVALID_${rowDefinition.id}`);
    if (!STATUS_VALUES.has(normalizeString(row.status))) issues.push(`ROW_STATUS_INVALID_${rowDefinition.id}`);
    if (rowDefinition.rowClass === 'tracked-scale' && Number(row.pageCount || 0) !== rowDefinition.pageCount) {
      issues.push(`ROW_PAGE_COUNT_INVALID_${rowDefinition.id}`);
    }
  }

  const expectedFailedRowIds = rows
    .filter((row) => normalizeString(row?.status) !== 'PASS')
    .map((row) => normalizeString(row?.id));
  const actualFailedRowIds = Array.isArray(artifact?.failedRowIds)
    ? artifact.failedRowIds.map((rowId) => normalizeString(rowId))
    : [];
  if (sha256Text(expectedFailedRowIds.join('\n')) !== sha256Text(actualFailedRowIds.join('\n'))) {
    issues.push('FAILED_ROW_IDS_DO_NOT_MATCH_ROWS');
  }

  const actualExecutedRowIds = Array.isArray(artifact?.executedRowIds)
    ? artifact.executedRowIds.map((rowId) => normalizeString(rowId))
    : [];
  if (sha256Text(EXPECTED_ROW_IDS.join('\n')) !== sha256Text(actualExecutedRowIds.join('\n'))) {
    issues.push('EXECUTED_ROW_IDS_DO_NOT_MATCH_EXPLICIT_ROWS');
  }

  const actualDiagnosticRowIds = Array.isArray(artifact?.diagnosticOnlyRowIds)
    ? artifact.diagnosticOnlyRowIds.map((rowId) => normalizeString(rowId))
    : [];
  if (sha256Text(DIAGNOSTIC_ONLY_ROW_IDS.join('\n')) !== sha256Text(actualDiagnosticRowIds.join('\n'))) {
    issues.push('DIAGNOSTIC_ONLY_ROW_IDS_DO_NOT_MATCH');
  }

  const trackedScaleRows = rows.filter((row) => normalizeString(row?.rowClass) === 'tracked-scale');
  const expectedCeiling = trackedScaleRows
    .filter((row) => normalizeString(row?.status) === 'PASS')
    .reduce((max, row) => Math.max(max, Number(row?.pageCount || 0)), 0);
  if (Number(artifact?.provisionalObservedCeiling || 0) !== expectedCeiling) {
    issues.push('PROVISIONAL_OBSERVED_CEILING_INVALID');
  }

  const expectedUnsupportedAboveCurrentProof = TRACKED_SCALE_PAGE_COUNTS.filter((pageCount) => pageCount > expectedCeiling);
  const actualUnsupportedAboveCurrentProof = Array.isArray(artifact?.unsupportedAboveCurrentProof)
    ? artifact.unsupportedAboveCurrentProof.map((pageCount) => Number(pageCount || 0))
    : [];
  if (
    sha256Text(expectedUnsupportedAboveCurrentProof.join('\n'))
    !== sha256Text(actualUnsupportedAboveCurrentProof.join('\n'))
  ) {
    issues.push('UNSUPPORTED_ABOVE_CURRENT_PROOF_INVALID');
  }

  const tracked5000Pass = trackedScaleRows.some((row) => Number(row?.pageCount || 0) === 5000 && normalizeString(row?.status) === 'PASS');
  if (Boolean(artifact?.readiness?.tracked5000Pass) !== tracked5000Pass) issues.push('READINESS_TRACKED_5000_FLAG_INVALID');
  if (artifact?.readiness?.editorialSheet5000Ready === true && tracked5000Pass !== true) {
    issues.push('FALSE_GREEN_5000_READINESS_WITHOUT_TRACKED_5000_PASS');
  }

  const expectedOk = expectedFailedRowIds.length === 0;
  if (Boolean(artifact?.ok) !== expectedOk) issues.push('OK_FLAG_INVALID');
  if (normalizeString(artifact?.status) !== (expectedOk ? 'PASS' : 'FAIL')) issues.push('STATUS_INVALID');
  if (Number(artifact?.[TOKEN_NAME] || 0) !== (expectedOk ? 1 : 0)) issues.push('TOKEN_INVALID');

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function readEditorialSheetStressLaneStatus(statusPath) {
  return readJsonObject(statusPath);
}

async function writeJsonAtomic(targetPath, value) {
  const dir = path.dirname(targetPath);
  const tmpPath = path.join(
    dir,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tmpPath, stableJson(value), 'utf8');
  await fsp.rename(tmpPath, targetPath);
}

export function evaluateEditorialSheetStressLaneStatus(artifact, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const validation = validateEditorialSheetStressLaneStatus(artifact);
  const repoState = getRepoState(repoRoot);
  const issues = [...validation.issues];

  if (normalizeString(artifact?.status) !== 'PASS') issues.push('ARTIFACT_STATUS_NOT_PASS');
  if (artifact?.ok !== true) issues.push('ARTIFACT_OK_FALSE');
  if (Number(artifact?.[TOKEN_NAME] || 0) !== 1) issues.push('ARTIFACT_TOKEN_NOT_ONE');
  if (Array.isArray(artifact?.failedRowIds) && artifact.failedRowIds.length > 0) issues.push('ARTIFACT_FAILED_ROWS_PRESENT');
  if (normalizeString(artifact?.repo?.headSha) !== normalizeString(repoState.currentHeadSha)) {
    issues.push('ARTIFACT_HEAD_SHA_MISMATCH');
  }

  const dedupedIssues = [...new Set(issues)];
  return {
    ok: dedupedIssues.length === 0,
    status: dedupedIssues.length === 0 ? 'PASS' : 'FAIL',
    issues: dedupedIssues,
    [TOKEN_NAME]: dedupedIssues.length === 0 ? 1 : 0,
    repoState,
  };
}

async function executeWriteMode(repoRoot, statusPath) {
  const repoState = getRepoState(repoRoot);
  const writeAuthority = evaluateWriteAuthority(repoState);
  if (!writeAuthority.ok) {
    return {
      artifact: null,
      evaluation: {
        ok: false,
        status: 'FAIL',
        issues: [...writeAuthority.issues],
        [TOKEN_NAME]: 0,
        repoState,
      },
      writeAuthority,
      wroteArtifact: false,
    };
  }

  const rows = ROW_DEFINITIONS.map((rowDefinition) => runRow(repoRoot, rowDefinition));
  const artifact = buildArtifact(repoRoot, rows, repoState);
  const evaluation = evaluateEditorialSheetStressLaneStatus(artifact, { repoRoot });
  await writeJsonAtomic(statusPath, artifact);
  return {
    artifact,
    evaluation,
    writeAuthority,
    wroteArtifact: true,
  };
}

async function main() {
  const args = parseArgs();
  const repoRoot = path.resolve(args.repoRoot || DEFAULT_REPO_ROOT);
  const statusPath = resolveStatusPath(repoRoot, args.statusPath);

  let artifact = null;
  let evaluation = null;
  let writeAuthority = null;
  let wroteArtifact = false;
  if (args.write) {
    const writeResult = await executeWriteMode(repoRoot, statusPath);
    artifact = writeResult.artifact;
    evaluation = writeResult.evaluation;
    writeAuthority = writeResult.writeAuthority;
    wroteArtifact = writeResult.wroteArtifact;
  } else {
    artifact = readEditorialSheetStressLaneStatus(statusPath);
    if (!artifact) {
      throw new Error(`STATUS_ARTIFACT_NOT_FOUND:${statusPath}`);
    }
    evaluation = evaluateEditorialSheetStressLaneStatus(artifact, { repoRoot });
  }

  if (args.json) {
    process.stdout.write(stableJson({
      artifact,
      evaluation,
      statusPath,
      writeAuthority,
      wroteArtifact,
    }));
    if (!evaluation.ok) process.exitCode = 1;
    return;
  }

  process.stdout.write(`EDITORIAL_SHEET_STRESS_LANE_STATUS=${artifact ? artifact.status : 'FAIL'}\n`);
  process.stdout.write(`${TOKEN_NAME}=${artifact ? Number(artifact[TOKEN_NAME] || 0) : 0}\n`);
  process.stdout.write(`PROVISIONAL_OBSERVED_CEILING=${Number(artifact?.provisionalObservedCeiling || 0)}\n`);
  process.stdout.write(`EDITORIAL_SHEET_5000_READY=${artifact?.readiness?.editorialSheet5000Ready === true ? 1 : 0}\n`);
  process.stdout.write(`FAILED_ROW_IDS=${JSON.stringify(artifact?.failedRowIds || [])}\n`);
  process.stdout.write(`WROTE_ARTIFACT=${wroteArtifact ? 1 : 0}\n`);
  if (!evaluation.ok) {
    process.stdout.write(`VALIDATION_ISSUES=${JSON.stringify(evaluation.issues)}\n`);
    process.exitCode = 1;
  }
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_UNEXPECTED';
const SOURCE_PATH = 'src/renderer/editor.js';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const source = readText(SOURCE_PATH);

    const baselineFallbackPresent = matchesAll(source, [
      /function getSpatialLayoutBaselineForViewport\(viewportWidth = getSpatialLayoutViewportWidth\(\)\)/,
      /savedAtUtc: ''/,
      /source: 'baseline'/,
    ]);
    const invalidLayoutNormalizationPresent = matchesAll(source, [
      /function normalizeSpatialLayoutState\(rawState, viewportWidth = getSpatialLayoutViewportWidth\(\)\)/,
      /if \(!rawState \|\| typeof rawState !== 'object'\) \{/,
      /return \{ \.\.\.fallback \};/,
      /if \(!isValid\) \{/,
      /return \{ \.\.\.fallback \};/,
    ]);
    const missingMonitorRecoveryPresent = matchesAll(source, [
      /const constraints = getSpatialLayoutConstraintsForViewport\(viewportWidth\);/,
      /rightSidebarWidth: constraints\.rightVisible \? rightSidebarWidth : fallback\.rightSidebarWidth/,
      /if \(rightSidebar\) \{/,
      /rightSidebar\.hidden = !rightVisible;/,
      /if \(rightSidebarResizer\) \{/,
      /rightSidebarResizer\.hidden = !rightVisible;/,
    ]);
    const viewportConstraintModesPresent = matchesAll(source, [
      /if \(mode === 'mobile'\) \{/,
      /rightVisible: false/,
      /if \(mode === 'compact'\) \{/,
      /rightVisible: true/,
      /return \{/,
      /mode,/,
    ]);

    const checkStatusById = {
      BASELINE_FALLBACK_PRESENT: asCheck(
        baselineFallbackPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        baselineFallbackPresent ? 'BASELINE_FALLBACK_PRESENT' : 'BASELINE_FALLBACK_MISSING',
      ),
      INVALID_LAYOUT_NORMALIZATION_PRESENT: asCheck(
        invalidLayoutNormalizationPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        invalidLayoutNormalizationPresent ? 'INVALID_LAYOUT_NORMALIZATION_PRESENT' : 'INVALID_LAYOUT_NORMALIZATION_MISSING',
      ),
      MISSING_MONITOR_RECOVERY_PRESENT: asCheck(
        missingMonitorRecoveryPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        missingMonitorRecoveryPresent ? 'MISSING_MONITOR_RECOVERY_PRESENT' : 'MISSING_MONITOR_RECOVERY_MISSING',
      ),
      VIEWPORT_CONSTRAINT_MODES_PRESENT: asCheck(
        viewportConstraintModesPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        viewportConstraintModesPresent ? 'VIEWPORT_CONSTRAINT_MODES_PRESENT' : 'VIEWPORT_CONSTRAINT_MODES_MISSING',
      ),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([id]) => id);

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        phase05ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase05ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase05ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_READINESS_STATUS=${state.phase05ReadinessStatus}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState };

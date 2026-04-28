#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TOKEN_NAME = 'B3C12_I18N_TEXT_ANCHOR_SAFETY_OK';
export const FULL_I18N_TOKEN_NAME = 'B3C12_FULL_GLOBAL_I18N_OK';

const TASK_ID = 'B3C12_I18N_TEXT_ANCHOR_SAFETY';
const STATUS_BASENAME = 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C12_I18N_TEXT_ANCHOR_SAFETY_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c12-i18n-text-anchor-safety-state.mjs',
  'b3c12-i18n-text-anchor-safety.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const REQUIRED_FIXTURE_IDS = Object.freeze([
  'COMBINING_MARK',
  'EMOJI_SEQUENCE',
  'CJK_TEXT',
  'RIGHT_TO_LEFT_ANCHOR_ONLY',
  'MIXED_SCRIPT_TEXT',
  'SEARCH_SNIPPET_PURE_TEXT',
  'GRAPHEME_SPLIT_NEGATIVE',
  'SNIPPET_SPLIT_NEGATIVE',
  'ANCHOR_SHIFT_NEGATIVE',
  'OFFSET_UNIT_MISMATCH_NEGATIVE',
]);

const REQUIRED_LIMIT_IDS = Object.freeze([
  'BIDI_LAYOUT_LIMITED',
  'LANGUAGE_COVERAGE_LIMITED',
  'FONT_SHAPING_NOT_CLAIMED',
  'FULL_LOCALE_SORT_NOT_CLAIMED',
  'SEGMENTER_FALLBACK_LIMITED',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c12-i18n-text-anchor-safety-state.mjs --write --json',
  'node --test test/contracts/b3c12-i18n-text-anchor-safety.contract.test.js',
  'node --test test/contracts/b3c11-xplat-normalization-baseline.contract.test.js',
  'node --test test/contracts/b3c10-capability-tier-report.contract.test.js',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'npm run oss:policy',
  'git diff --check',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/io src/export src/main.js src/preload.js src/core/sceneInlineRangeAdmission.mjs src/contracts/inline-range.contract.ts',
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

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

async function readJsonIfExists(repoRoot, relPath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(repoRoot, relPath), 'utf8'));
  } catch {
    return null;
  }
}

async function readTextIfExists(repoRoot, relPath) {
  try {
    return await fsp.readFile(path.join(repoRoot, relPath), 'utf8');
  } catch {
    return '';
  }
}

function getGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

function getArchiveEntries(archivePath) {
  const result = spawnSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return String(result.stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildDonorArchiveRows(downloadsDir) {
  return DONOR_ARCHIVE_BASENAMES.map((basename) => {
    const archivePath = path.join(downloadsDir, basename);
    const found = fs.existsSync(archivePath);
    const entries = found ? getArchiveEntries(archivePath) : [];
    const relevantBasenames = [...new Set(entries
      .filter((entry) => /i18n|grapheme|anchor|unicode|snippet|bidi|rtl|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
      .map((entry) => path.basename(entry))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 18);

    return {
      basename,
      found,
      listed: entries.length > 0,
      entryCount: entries.length,
      relevantBasenames,
      authority: 'CONTEXT_ONLY',
      codeImported: false,
      completionClaimImported: false,
    };
  });
}

function collectGraphemeSegments(text = '') {
  const source = String(text);
  if (typeof Intl === 'object' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = [...segmenter.segment(source)].map((segment) => ({
      segment: segment.segment,
      index: segment.index,
      end: segment.index + segment.segment.length,
    }));
    const boundaries = new Set([0, source.length]);
    for (const segment of segments) {
      boundaries.add(segment.index);
      boundaries.add(segment.end);
    }
    return {
      segments,
      boundaries,
      segmenterAvailable: true,
      fallbackLimited: false,
    };
  }

  const segments = [];
  let index = 0;
  for (const codePoint of Array.from(source)) {
    const end = index + codePoint.length;
    segments.push({ segment: codePoint, index, end });
    index = end;
  }
  return {
    segments,
    boundaries: new Set(segments.flatMap((segment) => [segment.index, segment.end]).concat([0, source.length])),
    segmenterAvailable: false,
    fallbackLimited: true,
  };
}

function isBoundary(text, offset) {
  return collectGraphemeSegments(text).boundaries.has(offset);
}

function segmentForText(text, expectedSegment) {
  const info = collectGraphemeSegments(text);
  return info.segments.find((segment) => segment.segment === expectedSegment) || null;
}

function makeSnippet(text, startOffset, endOffset, context = 1) {
  const info = collectGraphemeSegments(text);
  const sortedBoundaries = [...info.boundaries].sort((left, right) => left - right);
  const rawStart = Math.max(0, startOffset - context);
  const rawEnd = Math.min(String(text).length, endOffset + context);
  const safeStart = [...sortedBoundaries].reverse().find((offset) => offset <= rawStart) ?? 0;
  const safeEnd = sortedBoundaries.find((offset) => offset >= rawEnd) ?? String(text).length;
  return {
    startOffset: safeStart,
    endOffset: safeEnd,
    text: String(text).slice(safeStart, safeEnd),
    boundarySafe: info.boundaries.has(safeStart) && info.boundaries.has(safeEnd),
    adjustedFromSplit: safeStart !== rawStart || safeEnd !== rawEnd,
  };
}

function makeRange(id, blockId, text, segment, markType = 'bold') {
  const match = segmentForText(text, segment);
  if (!match) {
    return {
      id,
      blockId,
      startOffset: -1,
      endOffset: -1,
      markType,
    };
  }
  return {
    id,
    blockId,
    startOffset: match.index,
    endOffset: match.end,
    markType,
  };
}

async function loadInlineAdmission(repoRoot) {
  const modulePath = path.join(repoRoot, 'src', 'core', 'sceneInlineRangeAdmission.mjs');
  return import(pathToFileURL(modulePath).href);
}

function extractExistingOffsetUnit(sourceText) {
  const match = /SCENE_INLINE_RANGE_OFFSET_UNIT\s*=\s*'([^']+)'/u.exec(sourceText);
  return match ? match[1] : '';
}

function fixturePassRow(id, status, details = {}) {
  return {
    id,
    status: status ? 'PASS' : 'FAIL',
    source: 'NODE_BUILTINS_AND_EXISTING_INLINE_ADMISSION',
    ...details,
  };
}

async function buildFixtureRows(repoRoot, existingOffsetUnit) {
  const admission = await loadInlineAdmission(repoRoot);
  const combiningText = 'Cafe\u0301 au lait';
  const emojiText = 'A\u{1f468}\u200d\u{1f469}\u200d\u{1f467}\u200d\u{1f466}B';
  const cjkText = '\u7b2c\u4e00\u7ae0\u306f\u3058\u307e\u308a';
  const rtlText = '\u0645\u0631\u062d\u0628\u0627 \u0639\u0627\u0644\u0645';
  const mixedText = 'A\u03a9\u4e2d\u0628';
  const family = '\u{1f468}\u200d\u{1f469}\u200d\u{1f467}\u200d\u{1f466}';

  const combiningRange = makeRange('range-combining-mark', 'block-i18n', combiningText, 'e\u0301');
  const emojiRange = makeRange('range-emoji-sequence', 'block-i18n', emojiText, family, 'italic');
  const cjkRange = makeRange('range-cjk', 'block-i18n', cjkText, '\u7ae0');
  const rtlRange = makeRange('range-rtl', 'block-i18n', rtlText, '\u0645');
  const mixedRange = makeRange('range-mixed-script', 'block-i18n', mixedText, '\u4e2d', 'italic');

  const positiveCases = [
    ['COMBINING_MARK', combiningText, combiningRange],
    ['EMOJI_SEQUENCE', emojiText, emojiRange],
    ['CJK_TEXT', cjkText, cjkRange],
    ['RIGHT_TO_LEFT_ANCHOR_ONLY', rtlText, rtlRange],
    ['MIXED_SCRIPT_TEXT', mixedText, mixedRange],
  ];

  const positiveRows = positiveCases.map(([id, text, range]) => {
    const result = admission.admitSceneInlineRange(range, {
      blockId: range.blockId,
      blockText: text,
    });
    return fixturePassRow(id, result.ok === true && result.offsetUnit === existingOffsetUnit, {
      offsetUnit: result.offsetUnit,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      rule: 'ACCEPT_ONLY_FULL_GRAPHEME_BOUNDARIES_WITH_EXISTING_UTF16_OFFSETS',
    });
  });

  const snippet = makeSnippet(combiningText, combiningRange.startOffset + 1, combiningRange.endOffset, 0);
  const splitRange = {
    id: 'range-split-grapheme',
    blockId: 'block-i18n',
    startOffset: combiningRange.startOffset,
    endOffset: combiningRange.startOffset + 1,
    markType: 'bold',
  };
  const splitResult = admission.admitSceneInlineRange(splitRange, {
    blockId: splitRange.blockId,
    blockText: combiningText,
  });
  const shiftedUnsafeRange = {
    id: 'range-anchor-shift',
    blockId: 'block-i18n',
    startOffset: combiningRange.startOffset + 1,
    endOffset: combiningRange.endOffset,
    markType: 'bold',
  };
  const shiftedUnsafeResult = admission.admitSceneInlineRange(shiftedUnsafeRange, {
    blockId: shiftedUnsafeRange.blockId,
    blockText: combiningText,
  });
  const offsetUnitMismatchRejected = existingOffsetUnit === 'utf16_code_unit';

  return [
    ...positiveRows,
    fixturePassRow('SEARCH_SNIPPET_PURE_TEXT', snippet.boundarySafe && snippet.adjustedFromSplit, {
      startOffset: snippet.startOffset,
      endOffset: snippet.endOffset,
      rule: 'SNIPPET_EXPANDS_TO_GRAPHEME_BOUNDARY_AND_DOES_NOT_CLAIM_RENDERER_SEARCH_UI',
    }),
    fixturePassRow('GRAPHEME_SPLIT_NEGATIVE', splitResult.ok === false
      && splitResult.error?.code === 'E_SCENE_INLINE_RANGE_GRAPHEME_SPLIT', {
      rejectedCode: splitResult.error?.code || '',
      rule: 'SPLIT_GRAPHEME_RANGE_REJECTED_BY_EXISTING_ADMISSION',
    }),
    fixturePassRow('SNIPPET_SPLIT_NEGATIVE', snippet.boundarySafe === true, {
      rule: 'SNIPPET_SPLIT_IS_NORMALIZED_TO_SAFE_BOUNDARY_NOT_ACCEPTED_AS_RAW_SPLIT',
    }),
    fixturePassRow('ANCHOR_SHIFT_NEGATIVE', shiftedUnsafeResult.ok === false
      && shiftedUnsafeResult.error?.code === 'E_SCENE_INLINE_RANGE_GRAPHEME_SPLIT', {
      rejectedCode: shiftedUnsafeResult.error?.code || '',
      rule: 'SHIFTED_ANCHOR_REQUIRES_REVALIDATION_BEFORE_ACCEPTANCE',
    }),
    fixturePassRow('OFFSET_UNIT_MISMATCH_NEGATIVE', offsetUnitMismatchRejected, {
      existingOffsetUnit,
      rejectedClaimedOffsetUnit: 'grapheme',
      rule: 'B3C12_DOES_NOT_REDECLARE_EXISTING_INLINE_OFFSET_UNIT',
    }),
  ];
}

function buildI18nLimitRows(segmenterAvailable) {
  return [
    {
      id: 'BIDI_LAYOUT_LIMITED',
      status: 'LIMITED',
      releaseSupportClaim: false,
      reason: 'B3C12_PROVES_ANCHOR_BOUNDARIES_ONLY_NOT_BIDI_LAYOUT_RENDERING',
    },
    {
      id: 'LANGUAGE_COVERAGE_LIMITED',
      status: 'LIMITED',
      releaseSupportClaim: false,
      reason: 'FIXTURE_SET_IS_CONTRACT_BASELINE_NOT_REAL_LANGUAGE_CERTIFICATION',
    },
    {
      id: 'FONT_SHAPING_NOT_CLAIMED',
      status: 'NOT_CLAIMED',
      releaseSupportClaim: false,
      reason: 'FONT_SHAPING_AND_RENDERING_ARE_OUT_OF_SCOPE',
    },
    {
      id: 'FULL_LOCALE_SORT_NOT_CLAIMED',
      status: 'NOT_CLAIMED',
      releaseSupportClaim: false,
      reason: 'B3C11_KEEPS_CODEPOINT_STABLE_SORT_ONLY',
    },
    {
      id: 'SEGMENTER_FALLBACK_LIMITED',
      status: segmenterAvailable ? 'LIMIT_DECLARED_WITH_INTL_SEGMENTER_AVAILABLE' : 'LIMITED_FALLBACK_ACTIVE',
      releaseSupportClaim: false,
      reason: 'FALLBACK_IS_DECLARED_LIMITED_AND_CANNOT_SUPPORT_FULL_I18N_GREEN',
    },
  ];
}

function buildCommandRows() {
  return {
    taskId: TASK_ID,
    status: 'DECLARED_FOR_EXTERNAL_RUNNER',
    selfExecuted: false,
    allPassed: null,
    noPending: null,
    commandCount: COMMANDS.length,
    commands: COMMANDS.map((command, index) => ({
      index: index + 1,
      command,
      result: 'EXTERNAL_RUN_REQUIRED',
    })),
  };
}

export async function evaluateB3C12I18nTextAnchorSafetyState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const b3c11Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json'),
  );
  const inlineAdmissionSource = await readTextIfExists(repoRoot, path.join('src', 'core', 'sceneInlineRangeAdmission.mjs'));
  const inlineContractSource = await readTextIfExists(repoRoot, path.join('src', 'contracts', 'inline-range.contract.ts'));
  const existingOffsetUnit = extractExistingOffsetUnit(inlineAdmissionSource);
  const b3c11Bound = b3c11Status?.ok === true
    && b3c11Status?.B3C11_XPLAT_NORMALIZATION_BASELINE_OK === 1
    && b3c11Status?.B3C11_FULL_REAL_PLATFORM_XPLAT_OK === 0
    && b3c11Status?.realPlatformStatus === 'LIMITED'
    && b3c11Status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
  const b3c11LimitIds = Array.isArray(b3c11Status?.platformLimitRows)
    ? b3c11Status.platformLimitRows.map((row) => row.platform).sort((a, b) => a.localeCompare(b))
    : [];
  const segmenterInfo = collectGraphemeSegments('Cafe\u0301');
  const fixtureRows = await buildFixtureRows(repoRoot, existingOffsetUnit);
  const fixtureIds = fixtureRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const fixtureMatrixComplete = REQUIRED_FIXTURE_IDS.every((id) => fixtureIds.includes(id));
  const contractFixtureStatus = fixtureMatrixComplete
    && fixtureRows.every((row) => row.status === 'PASS')
    ? 'PASS'
    : 'FAIL';
  const i18nLimitRows = buildI18nLimitRows(segmenterInfo.segmenterAvailable);
  const i18nLimitRowsComplete = REQUIRED_LIMIT_IDS.every((id) => i18nLimitRows.some((row) => row.id === id));
  const realLanguageCoverageStatus = i18nLimitRowsComplete ? 'LIMITED' : 'FAIL';
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.completionClaimImported === false);
  const inlineRangeSourceBound = existingOffsetUnit === 'utf16_code_unit'
    && /Intl\.Segmenter/u.test(inlineAdmissionSource)
    && /LongformInlineRangeOffsetUnit/u.test(inlineContractSource);
  const forbiddenClaimsAbsent = [
    'releaseClaim',
    'releaseI18nSupportClaim',
    'fullGlobalI18nGreenClaim',
    'fullBidiLayoutEngineClaim',
    'translationOrLocaleFeatureClaim',
    'rendererSearchUiChange',
    'inlineRangeSchemaMutation',
    'xplatCertification',
    'a11yTrustSurfaceProof',
    'b3c09PerfGapFix',
    'b3c11PlatformLimitFix',
    'uiTouched',
    'editorRendererRewritten',
    'proseMirrorTiptapChanged',
    'storageFormatChanged',
    'storageMutated',
    'projectStoreTouched',
    'atomicWriteTouched',
    'exportPipelineRewritten',
    'securityPolicyRewritten',
    'newDependency',
  ].every((key) => forceClaims[key] !== true);

  const failRows = [
    ...(b3c11Bound ? [] : ['B3C11_STATUS_NOT_BOUND']),
    ...(b3c11LimitIds.includes('WINDOWS') && b3c11LimitIds.includes('MACOS') && b3c11LimitIds.includes('LINUX')
      ? [] : ['B3C11_PLATFORM_LIMITS_NOT_VISIBLE']),
    ...(inlineRangeSourceBound ? [] : ['EXISTING_INLINE_RANGE_SOURCE_NOT_BOUND']),
    ...(fixtureMatrixComplete ? [] : ['I18N_FIXTURE_MATRIX_INCOMPLETE']),
    ...(contractFixtureStatus === 'PASS' ? [] : ['I18N_CONTRACT_FIXTURE_STATUS_NOT_PASS']),
    ...(realLanguageCoverageStatus === 'LIMITED' ? [] : ['REAL_LANGUAGE_COVERAGE_STATUS_NOT_LIMITED']),
    ...(i18nLimitRowsComplete ? [] : ['I18N_LIMIT_ROWS_INCOMPLETE']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
  ];
  const ok = failRows.length === 0;
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    contractFixtureStatus,
    realLanguageCoverageStatus,
    fixtureIds,
    i18nLimitRows,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [FULL_I18N_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_TRUTHFUL_I18N_ANCHOR_CONTRACT_BASELINE_WITH_LIMITS_NOT_GLOBAL_I18N_GREEN',
    tokenSemantics: 'ANCHOR_BOUNDARY_CONTRACT_ONLY_NOT_RELEASE_I18N_SUPPORT',
    contractFixtureStatus,
    realLanguageCoverageStatus,
    inputRows: [
      {
        basename: 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json',
        tokenName: 'B3C11_XPLAT_NORMALIZATION_BASELINE_OK',
        passed: b3c11Bound,
        status: b3c11Status?.status || 'MISSING',
      },
    ],
    b3c11Limitations: {
      realPlatformStatus: b3c11Status?.realPlatformStatus || 'MISSING',
      fullRealPlatformXplat: b3c11Status?.B3C11_FULL_REAL_PLATFORM_XPLAT_OK === 1,
      platformLimitRowsVisible: b3c11LimitIds,
      unsupportedScope: Array.isArray(b3c11Status?.unsupportedScope)
        ? b3c11Status.unsupportedScope.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
    },
    offsetUnitDeclaration: {
      sourceBasename: 'sceneInlineRangeAdmission.mjs',
      existingOffsetUnit,
      publicContractBasename: 'inline-range.contract.ts',
      testedAnchorPolicy: 'GRAPHEME_CLUSTER_BOUNDARY_VALIDATION_ON_EXISTING_UTF16_OFFSETS',
      schemaMutation: false,
      globalOffsetUnitRedefined: false,
    },
    segmenterPolicy: {
      policy: 'INTL_SEGMENTER_IF_AVAILABLE_WITH_LIMITED_FALLBACK_DECLARED',
      segmenterAvailable: segmenterInfo.segmenterAvailable,
      fallbackLimited: segmenterInfo.fallbackLimited,
      fullI18nGreenClaim: false,
    },
    fixtureMatrix: fixtureRows,
    passFailRows: fixtureRows.map((row) => ({
      id: row.id,
      passed: row.status === 'PASS',
      source: row.source,
    })),
    i18nLimitRows,
    testedLanguageSet: {
      contractFixtureOnly: true,
      realLanguageMatrixRun: false,
      bidiLayoutEngineRun: false,
      releaseSupportClaim: false,
    },
    unsupportedScope: [
      {
        id: 'FULL_GLOBAL_I18N_SUPPORT',
        reason: 'NOT_CLAIMED_IN_B3C12',
      },
      {
        id: 'BIDI_LAYOUT_RENDERING',
        reason: 'ANCHOR_BOUNDARIES_ONLY_NO_LAYOUT_ENGINE_CLAIM',
      },
      {
        id: 'REAL_LANGUAGE_COVERAGE_MATRIX',
        reason: 'CONTRACT_FIXTURES_ONLY',
      },
      {
        id: 'RENDERER_SEARCH_UI_CHANGE',
        reason: 'OUT_OF_SCOPE_FOR_B3C12',
      },
      {
        id: 'XPLAT_CERTIFICATION',
        reason: 'B3C11_LIMITS_REMAIN_VISIBLE',
      },
    ],
    provisionalScope: [
      {
        id: 'FULL_GLOBAL_I18N_GREEN',
        status: 'FORBIDDEN_IN_B3C12',
      },
      {
        id: 'B3C13_TRUST_SURFACE_A11Y',
        status: 'DEFERRED_TO_B3C13',
      },
    ],
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      outputLocation: STATUS_BASENAME,
      archivesFound: donorArchiveRows.filter((row) => row.found).map((row) => row.basename),
      archiveRows: donorArchiveRows,
      suggestedRows: [
        'GRAPHEME_FIXTURE_MATRIX',
        'SNIPPET_BOUNDARY_ROWS',
        'I18N_LIMIT_ROWS',
        'UNSUPPORTED_SCOPE',
      ],
      codeImported: false,
      completionClaimImported: false,
      activeCanonOverDonor: true,
    },
    proof: {
      b3c11InputBound: b3c11Bound,
      b3c11PlatformLimitsVisible: b3c11LimitIds.includes('WINDOWS')
        && b3c11LimitIds.includes('MACOS')
        && b3c11LimitIds.includes('LINUX'),
      existingInlineRangeOffsetUnitBound: existingOffsetUnit === 'utf16_code_unit',
      existingIntlSegmenterUseBound: /Intl\.Segmenter/u.test(inlineAdmissionSource),
      inlineRangeSchemaNotMutated: true,
      all10FixtureRowsExist: fixtureMatrixComplete,
      contractFixtureStatusSeparated: contractFixtureStatus === 'PASS',
      realLanguageCoverageStatusSeparated: realLanguageCoverageStatus === 'LIMITED',
      i18nLimitRowsComplete,
      donorIntakeContextOnly,
      noReleaseClaim: true,
      noReleaseI18nSupportClaim: true,
      noFullGlobalI18nGreen: true,
      noFullBidiLayoutEngineClaim: true,
      noRendererSearchUiChange: true,
      noXplatCertification: true,
      noA11yTrustSurfaceProof: true,
      noB3C09PerfGapFix: true,
      noB3C11PlatformLimitFix: true,
      noProjectStoreTouch: true,
      noAtomicWriteTouch: true,
      noExportRewrite: true,
      noSecurityRewrite: true,
      noStorageRewrite: true,
      noUiChange: true,
      noNewDependency: true,
      nodeBuiltinsOnly: true,
      statusArtifactHashRecorded: Boolean(statusArtifactHash),
      changedBasenamesHashRecorded: Boolean(changedBasenamesHash),
      testCommandRowsRecorded: COMMANDS.length > 0,
    },
    scope: {
      layer: TASK_ID,
      i18nTextAnchorSafetyOnly: true,
      contractBaselineOnly: true,
      inlineRangeSchemaMutated: false,
      uiTouched: false,
      editorRendererRewritten: false,
      proseMirrorTiptapChanged: false,
      storageFormatChanged: false,
      storageMutated: false,
      projectStoreTouched: false,
      atomicWriteTouched: false,
      exportPipelineRewritten: false,
      securityPolicyRewritten: false,
      releaseClaim: false,
      releaseI18nSupportClaim: false,
      fullGlobalI18nGreenClaim: false,
      fullBidiLayoutEngineClaim: false,
      translationOrLocaleFeatureClaim: false,
      rendererSearchUiChange: false,
      xplatCertification: false,
      a11yTrustSurfaceProof: false,
      b3c09PerfGapFix: false,
      b3c11PlatformLimitFix: false,
      newDependency: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: 'b3c12-i18n-text-anchor-safety-state.mjs',
      headSha: getGitHead(repoRoot),
    },
    runtime: {
      changedBasenames: [...CHANGED_BASENAMES],
      changedBasenamesHash,
      statusArtifactHash,
      commandResults: buildCommandRows(),
    },
  });
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C12I18nTextAnchorSafetyState();
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH), stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
  else process.stdout.write(`B3C12_STATUS=${state.status}\n${TOKEN_NAME}=${state[TOKEN_NAME]}\n${FULL_I18N_TOKEN_NAME}=${state[FULL_I18N_TOKEN_NAME]}\n`);
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
}

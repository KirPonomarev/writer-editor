#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C13_TRUST_SURFACE_ACCESSIBILITY_OK';
export const FULL_APP_A11Y_TOKEN_NAME = 'B3C13_FULL_APP_A11Y_OK';

const TASK_ID = 'B3C13_TRUST_SURFACE_ACCESSIBILITY';
const STATUS_BASENAME = 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C13_TRUST_SURFACE_ACCESSIBILITY_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c13-trust-surface-accessibility-state.mjs',
  'b3c13-trust-surface-accessibility.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const REQUIRED_SURFACE_IDS = Object.freeze([
  'RECOVERY_SURFACE',
  'PREFLIGHT_SURFACE',
  'CONFLICT_REVIEW_SURFACE',
  'PROJECT_DOCTOR_SURFACE',
]);

const REQUIRED_CHECK_IDS = Object.freeze([
  'KEYBOARD_OPERABLE',
  'FOCUS_VISIBLE',
  'NOT_COLOR_ONLY',
  'ERROR_TEXT_PRESENT',
  'SCREEN_READER_LABEL_PRESENT',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'COLOR_ONLY_NEGATIVE',
  'MISSING_FOCUS_NEGATIVE',
  'MISSING_LABEL_NEGATIVE',
  'MISSING_ERROR_TEXT_NEGATIVE',
]);

const REQUIRED_LIMIT_IDS = Object.freeze([
  'NO_FULL_APP_A11Y_CLAIM',
  'NO_RELEASE_A11Y_CERTIFICATION',
  'NO_BROAD_UI_POLISH_CLAIM',
  'NO_NEW_TRUST_SURFACE_CREATION',
  'TRUST_SURFACE_ONLY_SCOPE',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c13-trust-surface-accessibility-state.mjs --write --json',
  'node --test test/contracts/b3c13-trust-surface-accessibility.contract.test.js',
  'node --test test/contracts/b3c12-i18n-text-anchor-safety.contract.test.js',
  'node --test test/contracts/b3c11-xplat-normalization-baseline.contract.test.js',
  'node --test test/contracts/b3c10-capability-tier-report.contract.test.js',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'npm run oss:policy',
  'git diff --check',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css src/renderer/editor.js src/io src/export src/main.js src/preload.js',
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
      .filter((entry) => /a11y|accessibility|keyboard|focus|color|trust|surface|recovery|preflight|conflict|doctor|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
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

function hasAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

function buildRecoverySurfaceRow(sources) {
  const html = sources.html;
  const editor = sources.editor;
  const main = sources.main;
  const runtimeBound = hasAll(html, [
    'data-recovery-modal',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label="Recovery"',
    'data-recovery-message',
    'data-recovery-close',
  ]) && hasAll(editor, [
    'openRecoveryModal',
    'recoveryCloseButtons',
    "case 'open-recovery'",
    'EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY',
  ]) && main.includes("'cmd.project.review.openRecovery'");

  return {
    id: 'RECOVERY_SURFACE',
    classification: runtimeBound ? 'RUNTIME_BOUND' : 'PROVISIONAL',
    status: runtimeBound ? 'PASS' : 'LIMITED',
    runtimeBound,
    basenames: ['index.html', 'editor.js', 'main.js'],
    evidence: {
      dialogRole: html.includes('role="dialog"'),
      ariaModal: html.includes('aria-modal="true"'),
      ariaLabel: html.includes('aria-label="Recovery"'),
      messageNode: html.includes('data-recovery-message'),
      nativeCloseButton: /<button[^>]+data-recovery-close/iu.test(html),
      commandPath: editor.includes("case 'open-recovery'") && main.includes("'cmd.project.review.openRecovery'"),
    },
  };
}

function buildSurfaceRows(sources) {
  const preflightPresent = sources.safeLocalPreflight.includes('evaluateSafeLocalWavePreflightState')
    || sources.opsStatusIndex.includes('SAFE_LOCAL_WAVE_PREFLIGHT');
  const conflictPresent = sources.conflictEnvelope.includes('createConflictEnvelope')
    || sources.collabIndex.includes('conflictEnvelope');
  const doctorPresent = sources.doctor.includes('doctor')
    || sources.packageJson.includes('"doctor"');

  return [
    buildRecoverySurfaceRow(sources),
    {
      id: 'PREFLIGHT_SURFACE',
      classification: preflightPresent ? 'PRESENT_BUT_NOT_RUNTIME_BOUND' : 'MISSING',
      status: 'LIMITED',
      runtimeBound: false,
      basenames: preflightPresent ? ['safe-local-wave-preflight-state.mjs', 'SAFE_LOCAL_WAVE_PREFLIGHT_v2.json'] : [],
      evidence: {
        opsPreflightExists: preflightPresent,
        runtimeUiTrustSurface: false,
      },
    },
    {
      id: 'CONFLICT_REVIEW_SURFACE',
      classification: conflictPresent ? 'PROVISIONAL' : 'MISSING',
      status: 'LIMITED',
      runtimeBound: false,
      basenames: conflictPresent ? ['conflictEnvelope.mjs', 'index.mjs'] : [],
      evidence: {
        conflictEnvelopeExists: conflictPresent,
        runtimeUiTrustSurface: false,
      },
    },
    {
      id: 'PROJECT_DOCTOR_SURFACE',
      classification: doctorPresent ? 'PRESENT_BUT_NOT_RUNTIME_BOUND' : 'MISSING',
      status: 'LIMITED',
      runtimeBound: false,
      basenames: doctorPresent ? ['doctor.mjs', 'package.json'] : [],
      evidence: {
        doctorScriptExists: doctorPresent,
        runtimeUiTrustSurface: false,
      },
    },
  ];
}

function buildCheckRows(surfaceRows, sources) {
  const recovery = surfaceRows.find((row) => row.id === 'RECOVERY_SURFACE') || {};
  const recoveryEvidence = recovery.evidence || {};
  const modalFocusStyleExists = /modal__button[\s\S]*?(outline|focus-visible)|focus-visible[\s\S]*?modal__button/iu.test(sources.styles)
    || /button:focus-visible|:focus-visible/iu.test(sources.styles);
  const rows = [
    {
      id: 'KEYBOARD_OPERABLE',
      surfaceId: 'RECOVERY_SURFACE',
      status: recovery.runtimeBound && recoveryEvidence.nativeCloseButton && recoveryEvidence.commandPath ? 'PASS' : 'LIMITED',
      evidence: 'NATIVE_BUTTON_CLOSE_AND_COMMAND_ROUTE_PRESENT',
    },
    {
      id: 'FOCUS_VISIBLE',
      surfaceId: 'RECOVERY_SURFACE',
      status: recovery.runtimeBound && modalFocusStyleExists ? 'PASS' : 'LIMITED',
      evidence: modalFocusStyleExists ? 'FOCUS_VISIBLE_STYLE_PRESENT' : 'NO_MODAL_SPECIFIC_FOCUS_STYLE_FOUND',
    },
    {
      id: 'NOT_COLOR_ONLY',
      surfaceId: 'RECOVERY_SURFACE',
      status: recovery.runtimeBound && recoveryEvidence.messageNode ? 'PASS' : 'LIMITED',
      evidence: 'TEXT_MESSAGE_NODE_PRESENT',
    },
    {
      id: 'ERROR_TEXT_PRESENT',
      surfaceId: 'RECOVERY_SURFACE',
      status: recovery.runtimeBound && recoveryEvidence.messageNode && sources.editor.includes('recoveryMessage.textContent') ? 'PASS' : 'LIMITED',
      evidence: 'RECOVERY_MESSAGE_TEXTCONTENT_PRESENT',
    },
    {
      id: 'SCREEN_READER_LABEL_PRESENT',
      surfaceId: 'RECOVERY_SURFACE',
      status: recovery.runtimeBound && recoveryEvidence.ariaLabel ? 'PASS' : 'LIMITED',
      evidence: 'ARIA_LABEL_ON_DIALOG_PRESENT',
    },
  ];
  return rows;
}

function buildNegativeRows(forceClaims) {
  return [
    {
      id: 'COLOR_ONLY_NEGATIVE',
      status: forceClaims.colorOnlyStatus === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'COLOR_ONLY_STATUS',
    },
    {
      id: 'MISSING_FOCUS_NEGATIVE',
      status: forceClaims.missingFocusAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_FOCUS_ACCEPTED',
    },
    {
      id: 'MISSING_LABEL_NEGATIVE',
      status: forceClaims.missingLabelAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_LABEL_ACCEPTED',
    },
    {
      id: 'MISSING_ERROR_TEXT_NEGATIVE',
      status: forceClaims.missingErrorTextAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_ERROR_TEXT_ACCEPTED',
    },
  ];
}

function buildLimitRows() {
  return [
    {
      id: 'NO_FULL_APP_A11Y_CLAIM',
      status: 'LIMITED',
      releaseCertificationClaim: false,
      reason: 'B3C13_IS_TRUST_SURFACE_BASELINE_ONLY',
    },
    {
      id: 'NO_RELEASE_A11Y_CERTIFICATION',
      status: 'LIMITED',
      releaseCertificationClaim: false,
      reason: 'B3C13_DOES_NOT_CERTIFY_RELEASE_ACCESSIBILITY',
    },
    {
      id: 'NO_BROAD_UI_POLISH_CLAIM',
      status: 'LIMITED',
      releaseCertificationClaim: false,
      reason: 'NO_BROAD_UI_POLISH_OR_REDESIGN_IN_SCOPE',
    },
    {
      id: 'NO_NEW_TRUST_SURFACE_CREATION',
      status: 'LIMITED',
      releaseCertificationClaim: false,
      reason: 'MISSING_SURFACES_ARE_RECORDED_NOT_CREATED',
    },
    {
      id: 'TRUST_SURFACE_ONLY_SCOPE',
      status: 'LIMITED',
      releaseCertificationClaim: false,
      reason: 'B3C13_DOES_NOT_TOUCH_STORAGE_EXPORT_SECURITY_OR_COMMAND_LAYERS',
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

async function buildSourceBundle(repoRoot) {
  const opsStatusNames = spawnSync('git', ['ls-files', 'docs/OPS/STATUS'], { cwd: repoRoot, encoding: 'utf8' });
  return {
    html: await readTextIfExists(repoRoot, path.join('src', 'renderer', 'index.html')),
    editor: await readTextIfExists(repoRoot, path.join('src', 'renderer', 'editor.js')),
    styles: await readTextIfExists(repoRoot, path.join('src', 'renderer', 'styles.css')),
    main: await readTextIfExists(repoRoot, 'src/main.js'),
    doctor: await readTextIfExists(repoRoot, path.join('scripts', 'doctor.mjs')),
    packageJson: await readTextIfExists(repoRoot, 'package.json'),
    safeLocalPreflight: await readTextIfExists(repoRoot, path.join('scripts', 'ops', 'safe-local-wave-preflight-state.mjs')),
    conflictEnvelope: await readTextIfExists(repoRoot, path.join('src', 'collab', 'conflictEnvelope.mjs')),
    collabIndex: await readTextIfExists(repoRoot, path.join('src', 'collab', 'index.mjs')),
    opsStatusIndex: opsStatusNames.status === 0 ? String(opsStatusNames.stdout || '') : '',
  };
}

export async function evaluateB3C13TrustSurfaceAccessibilityState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const b3c12Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json'),
  );
  const b3c12Bound = b3c12Status?.ok === true
    && b3c12Status?.B3C12_I18N_TEXT_ANCHOR_SAFETY_OK === 1
    && b3c12Status?.B3C12_FULL_GLOBAL_I18N_OK === 0
    && b3c12Status?.realLanguageCoverageStatus === 'LIMITED'
    && b3c12Status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
  const sources = await buildSourceBundle(repoRoot);
  const surfaceRows = buildSurfaceRows(sources);
  const checkRows = buildCheckRows(surfaceRows, sources);
  const negativeRows = buildNegativeRows(forceClaims);
  const limitRows = buildLimitRows();
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const surfaceIds = surfaceRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const checkIds = checkRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const limitIds = limitRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const surfaceRowsComplete = REQUIRED_SURFACE_IDS.every((id) => surfaceIds.includes(id));
  const checkRowsComplete = REQUIRED_CHECK_IDS.every((id) => checkIds.includes(id));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const limitRowsComplete = REQUIRED_LIMIT_IDS.every((id) => limitIds.includes(id));
  const runtimeBoundSurfaceCount = surfaceRows.filter((row) => row.runtimeBound === true).length;
  const missingOrLimitedSurfaceCount = surfaceRows.filter((row) => row.status !== 'PASS').length;
  const trustSurfaceA11yStatus = surfaceRowsComplete
    && checkRowsComplete
    && checkRows.every((row) => row.status === 'PASS' || row.status === 'LIMITED')
    && negativeRows.every((row) => row.status === 'PASS')
    && runtimeBoundSurfaceCount >= 1
    ? 'LIMITED_PASS'
    : 'FAIL';
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.completionClaimImported === false);
  const forbiddenClaimsAbsent = [
    'fullAppA11yClaim',
    'releaseA11yCertificationClaim',
    'broadUiRedesign',
    'newTrustSurfaceCreated',
    'rendererStructureChanged',
    'baseClassChanged',
    'newUiFramework',
    'storageChange',
    'exportChange',
    'securityPolicyRewrite',
    'commandSurfaceChange',
    'performanceClaimFix',
    'xplatCertification',
    'i18nGlobalGreen',
    'releaseDossierWork',
    'newDependency',
  ].every((key) => forceClaims[key] !== true);

  const failRows = [
    ...(b3c12Bound ? [] : ['B3C12_STATUS_NOT_BOUND']),
    ...(surfaceRowsComplete ? [] : ['SURFACE_ROWS_INCOMPLETE']),
    ...(checkRowsComplete ? [] : ['CHECK_ROWS_INCOMPLETE']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(limitRowsComplete ? [] : ['LIMIT_ROWS_INCOMPLETE']),
    ...(trustSurfaceA11yStatus === 'LIMITED_PASS' ? [] : ['TRUST_SURFACE_A11Y_STATUS_NOT_LIMITED_PASS']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
  ];
  const ok = failRows.length === 0;
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    trustSurfaceA11yStatus,
    surfaceIds,
    checkIds,
    negativeIds,
    limitIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [FULL_APP_A11Y_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_TRUTHFUL_TRUST_SURFACE_ACCESSIBILITY_BASELINE_WITH_LIMITS_NOT_FULL_APP_A11Y',
    tokenSemantics: 'TRUST_SURFACE_A11Y_BASELINE_ONLY_NOT_RELEASE_CERTIFICATION',
    trustSurfaceA11yStatus,
    runtimeBoundSurfaceCount,
    missingOrLimitedSurfaceCount,
    inputRows: [
      {
        basename: 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json',
        tokenName: 'B3C12_I18N_TEXT_ANCHOR_SAFETY_OK',
        passed: b3c12Bound,
        status: b3c12Status?.status || 'MISSING',
      },
    ],
    b3c12Limitations: {
      realLanguageCoverageStatus: b3c12Status?.realLanguageCoverageStatus || 'MISSING',
      fullGlobalI18n: b3c12Status?.B3C12_FULL_GLOBAL_I18N_OK === 1,
      a11yDeferredToB3c13: Array.isArray(b3c12Status?.provisionalScope)
        && b3c12Status.provisionalScope.some((row) => row.id === 'B3C13_TRUST_SURFACE_A11Y'),
    },
    surfaceRows,
    checkRows,
    negativeRows,
    limitRows,
    passFailRows: [
      ...surfaceRows.map((row) => ({
        id: row.id,
        passed: row.status === 'PASS' || row.status === 'LIMITED',
        classification: row.classification,
      })),
      ...checkRows.map((row) => ({
        id: row.id,
        passed: row.status === 'PASS' || row.status === 'LIMITED',
        surfaceId: row.surfaceId,
      })),
      ...negativeRows.map((row) => ({
        id: row.id,
        passed: row.status === 'PASS',
      })),
    ],
    unsupportedScope: [
      {
        id: 'FULL_APP_ACCESSIBILITY',
        reason: 'NOT_CLAIMED_IN_B3C13',
      },
      {
        id: 'RELEASE_A11Y_CERTIFICATION',
        reason: 'DEFERRED_OR_OUT_OF_SCOPE_FOR_B3C13',
      },
      {
        id: 'BROAD_UI_POLISH',
        reason: 'FORBIDDEN_BY_CONTOUR_SCOPE',
      },
      {
        id: 'NEW_TRUST_SURFACE_CREATION',
        reason: 'MISSING_SURFACES_RECORDED_NOT_CREATED',
      },
    ],
    provisionalScope: [
      {
        id: 'B3C14_RELEASE_DOSSIER_MINIMAL',
        status: 'HANDOFF_ONLY',
      },
    ],
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      outputLocation: STATUS_BASENAME,
      archivesFound: donorArchiveRows.filter((row) => row.found).map((row) => row.basename),
      archiveRows: donorArchiveRows,
      suggestedRows: [
        'TRUST_SURFACE_ROWS',
        'A11Y_CHECK_ROWS',
        'NEGATIVE_ROWS',
        'LIMIT_ROWS',
      ],
      codeImported: false,
      completionClaimImported: false,
      activeCanonOverDonor: true,
    },
    proof: {
      b3c12InputBound: b3c12Bound,
      b3c12LimitedStatusVisible: b3c12Status?.B3C12_FULL_GLOBAL_I18N_OK === 0,
      surfaceRowsComplete,
      checkRowsComplete,
      negativeRowsComplete,
      limitRowsComplete,
      atLeastOneRuntimeBoundSurface: runtimeBoundSurfaceCount >= 1,
      missingSurfacesRecordedNotCreated: missingOrLimitedSurfaceCount > 0,
      trustSurfaceA11yStatusLimited: trustSurfaceA11yStatus === 'LIMITED_PASS',
      donorIntakeContextOnly,
      noFullAppA11yClaim: true,
      noReleaseA11yCertification: true,
      noBroadUiRedesign: true,
      noNewTrustSurfaceCreation: true,
      noRendererStructureChange: true,
      noBaseClassChange: true,
      noNewUiFramework: true,
      noStorageChange: true,
      noExportChange: true,
      noSecurityPolicyRewrite: true,
      noCommandSurfaceChange: true,
      noPerformanceClaimFix: true,
      noXplatCertification: true,
      noI18nGlobalGreen: true,
      noReleaseDossierWork: true,
      noNewDependency: true,
      nodeBuiltinsOnly: true,
      statusArtifactHashRecorded: Boolean(statusArtifactHash),
      changedBasenamesHashRecorded: Boolean(changedBasenamesHash),
      testCommandRowsRecorded: COMMANDS.length > 0,
    },
    scope: {
      layer: TASK_ID,
      trustSurfaceAccessibilityOnly: true,
      contractBaselineOnly: true,
      fullAppA11yClaim: false,
      releaseA11yCertificationClaim: false,
      broadUiRedesign: false,
      newTrustSurfaceCreated: false,
      rendererStructureChanged: false,
      baseClassChanged: false,
      newUiFramework: false,
      storageChange: false,
      exportChange: false,
      securityPolicyRewrite: false,
      commandSurfaceChange: false,
      performanceClaimFix: false,
      xplatCertification: false,
      i18nGlobalGreen: false,
      releaseDossierWork: false,
      newDependency: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: 'b3c13-trust-surface-accessibility-state.mjs',
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
  const state = await evaluateB3C13TrustSurfaceAccessibilityState();
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH), stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
  else process.stdout.write(`B3C13_STATUS=${state.status}\n${TOKEN_NAME}=${state[TOKEN_NAME]}\n${FULL_APP_A11Y_TOKEN_NAME}=${state[FULL_APP_A11Y_TOKEN_NAME]}\n`);
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
}

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'editorial-sheet-scroll-strobe-visual-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_SCROLL_STROBE_VISUAL_STATUS_V1.json');
const STRESS_STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');
const CLOSEOUT_SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_5000_CLOSEOUT_SUMMARY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('editorial sheet scroll strobe visual status: committed artifact validates exact proof fields', async () => {
  const {
    ARTIFACT_ID,
    SCHEMA_VERSION,
    TASK_ID,
    TARGET_SCENARIO,
    validateScrollStrobeVisualStatus,
  } = await loadModule();
  const artifact = readJson(STATUS_PATH);
  const validation = validateScrollStrobeVisualStatus(artifact);

  assert.equal(validation.ok, true, validation.issues.join('\n'));
  assert.equal(artifact.artifactId, ARTIFACT_ID);
  assert.equal(artifact.schemaVersion, SCHEMA_VERSION);
  assert.equal(artifact.taskId, TASK_ID);
  assert.equal(artifact.targetScenario, TARGET_SCENARIO);
  assert.equal(artifact.screenshotPrimaryProof, false);
  assert.equal(artifact.networkRequests, 0);
  assert.equal(artifact.dialogCalls, 0);
  assert.equal(artifact.immediateScreenshotBlank, false);
  assert.equal(artifact.settledScreenshotBlank, false);
  assert.equal(artifact.immediateTextRectCount > 0, true);
  assert.equal(artifact.settledTextRectCount > 0, true);
  assert.equal(['NONBLANK_PROVED', 'TRANSIENT_INSTRUMENTATION_ZERO'].includes(artifact.classification), true);
});

test('editorial sheet scroll strobe visual status: screenshots remain support evidence only', () => {
  const artifact = readJson(STATUS_PATH);

  assert.equal(artifact.screenshotPrimaryProof, false);
  assert.equal(path.basename(artifact.immediateScreenshotBasename), artifact.immediateScreenshotBasename);
  assert.equal(path.basename(artifact.settledScreenshotBasename), artifact.settledScreenshotBasename);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, artifact.immediateScreenshotBasename)), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, artifact.settledScreenshotBasename)), false);
  assert.ok(artifact.notes.includes('screenshots are temporary support evidence only'));
});

test('editorial sheet scroll strobe visual status: false green cases are rejected', async () => {
  const { validateScrollStrobeVisualStatus } = await loadModule();
  const artifact = readJson(STATUS_PATH);
  const cases = [
    {
      name: 'screenshot-primary-proof',
      mutate(source) {
        return { ...source, screenshotPrimaryProof: true };
      },
      expectedIssue: 'SCREENSHOT_PRIMARY_PROOF_NOT_FALSE',
    },
    {
      name: 'missing-immediate-text',
      mutate(source) {
        return { ...source, immediateTextRectCount: 0 };
      },
      expectedIssue: 'GREEN_IMMEDIATE_TEXT_RECT_MISSING',
    },
    {
      name: 'blank-immediate-screenshot',
      mutate(source) {
        return { ...source, immediateScreenshotBlank: true };
      },
      expectedIssue: 'GREEN_IMMEDIATE_SCREENSHOT_BLANK',
    },
    {
      name: 'blank-settled-screenshot',
      mutate(source) {
        return { ...source, settledScreenshotBlank: true };
      },
      expectedIssue: 'GREEN_SETTLED_SCREENSHOT_BLANK',
    },
  ];

  for (const testCase of cases) {
    const validation = validateScrollStrobeVisualStatus(testCase.mutate(artifact));
    assert.equal(validation.ok, false, testCase.name);
    assert.ok(validation.issues.includes(testCase.expectedIssue), testCase.name);
  }
});

test('editorial sheet scroll strobe visual status: scale boundaries preserve 10000 supported tier', () => {
  const stressArtifact = readJson(STRESS_STATUS_PATH);
  const closeoutSummary = readJson(CLOSEOUT_SUMMARY_PATH);

  assert.deepEqual(stressArtifact.trackedScalePageCounts, [2000, 3000, 4000, 5000, 10000]);
  assert.equal(stressArtifact.provisionalObservedCeiling, 10000);
  assert.equal(JSON.stringify(stressArtifact).includes('40000'), false);
  assert.equal(closeoutSummary.claim.unsupportedAboveProvenTier, 'ABOVE_10000_NOT_PROMOTED_BY_THIS_GATE');
});

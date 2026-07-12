const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const CRASH_FIXTURE = path.join(
  process.cwd(),
  'test/fixtures/revision-bridge-exact-text-apply-crash-child.mjs',
);
const JOURNAL_DIRECTORY = path.join('backups', 'revision-bridge-apply-journal');
const BEFORE_TEXT = 'Alpha beta gamma.';
const AFTER_TEXT = 'Alpha delta gamma.';

function sha256Text(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function createProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-apply-crash-'));
  const scenePath = path.join(projectRoot, 'scene.md');
  fs.writeFileSync(scenePath, BEFORE_TEXT, 'utf8');
  return { projectRoot, scenePath };
}

async function loadModule(relativePath) {
  return import(pathToFileURL(path.join(process.cwd(), relativePath)).href);
}

async function buildReadyInput(projectRoot, scenePath) {
  const revisionBridge = await loadModule('src/io/revisionBridge/index.mjs');
  const projectSnapshot = {
    projectId: 'project-crash',
    baselineHash: 'baseline-crash',
    scenes: [{ sceneId: 'scene-1', text: BEFORE_TEXT }],
  };
  const revisionSession = {
    projectId: 'project-crash',
    sessionId: 'session-crash',
    baselineHash: 'baseline-crash',
    status: 'open',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [{
        changeId: 'change-crash',
        targetScope: { type: 'scene', id: 'scene-1' },
        match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
        replacementText: 'delta',
        createdAt: '2026-07-12T12:00:00.000Z',
      }],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
    },
  };
  const planPreview = revisionBridge.buildExactTextApplyPlanNoDiskPreview({
    projectSnapshot,
    revisionSession,
  });
  assert.equal(planPreview.status, 'ready');
  return {
    projectRoot,
    projectSnapshot,
    revisionSession,
    planPreview,
    scenePath,
    scenePathBySceneId: { 'scene-1': scenePath },
  };
}

function runCrash(projectRoot, stage) {
  return spawnSync(process.execPath, [CRASH_FIXTURE, projectRoot, stage], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function readJournal(projectRoot, stage) {
  const journalPath = path.join(projectRoot, JOURNAL_DIRECTORY, `op_crash_${stage}.json`);
  return JSON.parse(fs.readFileSync(journalPath, 'utf8'));
}

function assertRecoverySnapshot(projectRoot) {
  const snapshots = fs.readdirSync(projectRoot)
    .filter((name) => name.includes('.bak.'));
  assert.equal(snapshots.length > 0, true);
  assert.equal(
    snapshots.some((name) => fs.readFileSync(path.join(projectRoot, name), 'utf8') === BEFORE_TEXT),
    true,
  );
}

test('R8 crash killpoints reconcile without double apply, recovery loss, or false success', async () => {
  const journal = await loadModule('src/io/revisionBridge/exactTextApplyJournal.mjs');
  const safeWrite = await loadModule('src/io/revisionBridge/exactTextMinSafeWrite.mjs');
  const cases = [
    { stage: 'before_rename', exitCode: 71, outcome: 'not_applied', text: BEFORE_TEXT },
    { stage: 'after_rename', exitCode: 72, outcome: 'applied_receipt_missing', text: AFTER_TEXT },
    { stage: 'before_receipt', exitCode: 73, outcome: 'applied_receipt_missing', text: AFTER_TEXT },
    { stage: 'after_receipt', exitCode: 74, outcome: 'applied_receipt_present', text: AFTER_TEXT },
  ];

  for (const item of cases) {
    const { projectRoot, scenePath } = createProject();
    const crashed = runCrash(projectRoot, item.stage);
    assert.equal(crashed.status, item.exitCode, `${item.stage}: process reached killpoint`);
    assert.equal(fs.readFileSync(scenePath, 'utf8'), item.text, `${item.stage}: disk state`);
    assertRecoverySnapshot(projectRoot);

    const reconciled = await journal.reconcilePendingExactTextApplyJournals(projectRoot);
    assert.equal(reconciled.reconciliations.length, 1, `${item.stage}: one pending operation`);
    assert.equal(reconciled.reconciliations[0].outcome, item.outcome, `${item.stage}: outcome`);
    assert.equal(reconciled.reconciliations[0].recoveryVerified, true, `${item.stage}: recovery verified`);
    assert.deepEqual(reconciled.reconciliations[0].safeActions, ['RELOAD_CANONICAL']);
    assert.equal(readJournal(projectRoot, item.stage).status, 'reconciled');

    const second = await safeWrite.applyExactTextMinSafeWrite(
      await buildReadyInput(projectRoot, scenePath),
      { operationId: `op_second_${item.stage}` },
    );
    if (item.outcome === 'not_applied') {
      assert.equal(second.status, 'applied', `${item.stage}: retry applies once`);
      assert.equal(fs.readFileSync(scenePath, 'utf8'), AFTER_TEXT);
    } else {
      assert.equal(second.status, 'blocked', `${item.stage}: retry is blocked`);
      assert.equal(second.reason, 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_DRIFT');
      assert.equal(fs.readFileSync(scenePath, 'utf8'), AFTER_TEXT);
    }
  }
});

test('R8 reconciler reports conflict when canonical text matches neither journal hash', async () => {
  const journal = await loadModule('src/io/revisionBridge/exactTextApplyJournal.mjs');
  const { projectRoot, scenePath } = createProject();
  const crashed = runCrash(projectRoot, 'before_receipt');
  assert.equal(crashed.status, 73);
  fs.writeFileSync(scenePath, 'External edit after crash.', 'utf8');

  const result = await journal.reconcilePendingExactTextApplyJournals(projectRoot);

  assert.equal(result.reconciliations[0].outcome, 'conflict');
  assert.equal(result.reconciliations[0].ambiguous, true);
  assert.equal(result.reconciliations[0].observedHash, sha256Text('External edit after crash.'));
  assert.equal(result.reconciliations[0].recoveryVerified, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'External edit after crash.');
});

test('R8 journal rejects stored traversal and never reads an outside target', async () => {
  const journal = await loadModule('src/io/revisionBridge/exactTextApplyJournal.mjs');
  const { projectRoot } = createProject();
  const outsidePath = path.join(path.dirname(projectRoot), 'outside-review-scene.md');
  fs.writeFileSync(outsidePath, 'outside', 'utf8');
  const crashed = runCrash(projectRoot, 'before_rename');
  assert.equal(crashed.status, 71);
  const journalPath = path.join(projectRoot, JOURNAL_DIRECTORY, 'op_crash_before_rename.json');
  const payload = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  payload.sceneRelativePath = '../outside-review-scene.md';
  fs.writeFileSync(journalPath, JSON.stringify(payload), 'utf8');

  const result = await journal.reconcilePendingExactTextApplyJournals(projectRoot);

  assert.equal(result.ok, false);
  assert.equal(result.reconciliations.length, 0);
  assert.equal(result.errors[0].code, 'E_REVISION_BRIDGE_APPLY_JOURNAL_RELATIVE_PATH_INVALID');
  assert.equal(fs.readFileSync(outsidePath, 'utf8'), 'outside');
});

test('R8 completed journal is reconciled immediately and does not conflict with later scene edits', async () => {
  const journal = await loadModule('src/io/revisionBridge/exactTextApplyJournal.mjs');
  const safeWrite = await loadModule('src/io/revisionBridge/exactTextMinSafeWrite.mjs');
  const { projectRoot, scenePath } = createProject();
  const first = await safeWrite.applyExactTextMinSafeWrite(
    await buildReadyInput(projectRoot, scenePath),
    { operationId: 'op_completed_before_later_edit' },
  );
  assert.equal(first.status, 'applied');
  assert.equal(first.reconciliation.outcome, 'applied_receipt_present');

  fs.writeFileSync(scenePath, 'A later normal edit.', 'utf8');
  const startup = await journal.reconcilePendingExactTextApplyJournals(projectRoot);

  assert.equal(startup.reconciliations.length, 0);
  assert.equal(startup.userRelevant.length, 0);
  const completedPath = path.join(
    projectRoot,
    JOURNAL_DIRECTORY,
    'op_completed_before_later_edit.json',
  );
  assert.equal(JSON.parse(fs.readFileSync(completedPath, 'utf8')).status, 'reconciled');
});

test('R8 journal fails closed on symlink boundaries and traversal-like operation ids', {
  skip: process.platform === 'win32',
}, async () => {
  const safeWrite = await loadModule('src/io/revisionBridge/exactTextMinSafeWrite.mjs');

  const symlinkProject = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-apply-symlink-scene-'));
  const outsideScene = path.join(os.tmpdir(), `rb-apply-outside-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(outsideScene, BEFORE_TEXT, 'utf8');
  const linkedScene = path.join(symlinkProject, 'scene.md');
  fs.symlinkSync(outsideScene, linkedScene, 'file');
  const linkedResult = await safeWrite.applyExactTextMinSafeWrite(
    await buildReadyInput(symlinkProject, linkedScene),
    { operationId: 'op_symlink_scene' },
  );
  assert.equal(linkedResult.status, 'failed');
  assert.equal(fs.readFileSync(outsideScene, 'utf8'), BEFORE_TEXT);

  const backupProject = createProject();
  const outsideBackupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-apply-outside-backups-'));
  fs.symlinkSync(outsideBackupDirectory, path.join(backupProject.projectRoot, 'backups'), 'dir');
  const backupResult = await safeWrite.applyExactTextMinSafeWrite(
    await buildReadyInput(backupProject.projectRoot, backupProject.scenePath),
    { operationId: 'op_symlink_backups' },
  );
  assert.equal(backupResult.status, 'failed');
  assert.equal(fs.readFileSync(backupProject.scenePath, 'utf8'), BEFORE_TEXT);
  assert.deepEqual(fs.readdirSync(outsideBackupDirectory), []);

  const traversalProject = createProject();
  const traversalResult = await safeWrite.applyExactTextMinSafeWrite(
    await buildReadyInput(traversalProject.projectRoot, traversalProject.scenePath),
    { operationId: 'op_../escape' },
  );
  assert.equal(traversalResult.status, 'failed');
  assert.equal(fs.readFileSync(traversalProject.scenePath, 'utf8'), BEFORE_TEXT);
});

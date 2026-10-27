const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function runP008(args = []) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-p0-08-'));
  const receiptPath = path.join(outDir, 'receipt.json');
  const run = spawnSync(process.execPath, [
    'scripts/ops/yalken-atlas-v5-final-audit-p0-08-stage10-product-wiring.mjs',
    '--out',
    outDir,
    '--receipt',
    receiptPath,
    ...args,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const summary = run.stdout.trim() ? JSON.parse(run.stdout) : {};
  return { run, summary, receiptPath };
}

function readText(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(process.cwd(), relativePath)).href);
}

test('P0 08: Stage 10 local product wiring persists and reopens comments, history, conflicts and exchange through visible commands', () => {
  const { run, summary, receiptPath } = runP008();
  assert.equal(run.status, 0, `P0 08 runner failed:\n${run.stdout}\n${run.stderr}`);
  assert.equal(summary.status, 'PASS_P0_08_STAGE10_PRODUCT_WIRING');
  assert.deepEqual(summary.failures, []);

  const report = JSON.parse(fs.readFileSync(summary.reportPath, 'utf8'));
  assert.equal(report.pass, true);
  assert.deepEqual(report.failures, []);
  assert.equal(report.authority.commandKernelOwnsMutation, true);
  assert.equal(report.authority.designOsSurfaceIntentOnly, true);
  assert.equal(report.authority.networkAdapterRuntimeDependency, false);
  assert.equal(report.authority.shadowAcceptedAsComplete, false);
  assert.equal(report.authority.programDoneClaim, false);

  assert.equal(report.acceptance.visibleUiCommandPath, true);
  assert.equal(report.acceptance.commandKernelCapabilityRevalidated, true);
  assert.equal(report.acceptance.commentsProductPathPersistReopen, true);
  assert.equal(report.acceptance.historyProductPathPersistReopenRecoveryUndo, true);
  assert.equal(report.acceptance.conflictsProductPathPersistManualDecision, true);
  assert.equal(report.acceptance.operationExchangeLocalProductPath, true);
  assert.equal(report.acceptance.negativeDirectBridgeDenied, true);
  assert.equal(report.acceptance.shadowOnlyRejectedAsComplete, true);
  assert.equal(report.acceptance.networkAdapterNotRequired, true);
  assert.equal(report.acceptance.noProgramDoneClaim, true);

  assert.equal(report.commandPath.allCapabilityRevalidated, true);
  assert.equal(report.commandPath.directBridgeDenied, true);
  assert.equal(report.commandPath.directBridgeMutatedState, false);
  assert.ok(report.commandPath.commandIds.includes('project.applyTextEdit'));
  assert.ok(report.commandPath.commandIds.includes('cmd.comments.importStablePacket'));
  assert.ok(report.commandPath.commandIds.includes('cmd.project.history.restoreUndo'));
  assert.ok(report.commandPath.commandIds.includes('cmd.collab.operationExchange.localFixturePreview'));
  assert.equal(report.persistence.recoverySnapshotCount >= 2, true);
  assert.equal(report.productPaths.comments.secondCommentTruth, false);
  assert.equal(report.productPaths.history.storedHistoryTruth, false);
  assert.equal(report.productPaths.conflicts.automaticMerge, false);
  assert.equal(report.productPaths.conflicts.silentProjectRewrite, false);
  assert.equal(report.productPaths.operationExchange.networkAdapterEnabled, false);
  assert.equal(report.productPaths.operationExchange.shadowOnly, false);
  assert.equal(report.negativeAssertions.receiptOnlyAcceptedAsReadiness, false);
  assert.equal(report.negativeAssertions.storageBypassAccepted, false);

  for (const event of report.activationModes) {
    assert.equal(event.activationMode, 'PHYSICAL_POINTER_OR_KEYBOARD');
    assert.equal(event.visibleControl, true);
    assert.equal(event.directBridge, false);
  }

  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.pass, true);
  assert.equal(receipt.programDoneClaim, false);
  assert.equal(receipt.acceptance.operationExchangeLocalProductPath, true);
  assert.equal(receipt.report.sha256, sha256File(summary.reportPath));
});

test('P0 08: shadow-only comments/history/collab artifacts cannot close product wiring', () => {
  const { run, summary, receiptPath } = runP008(['--shadow-only']);
  assert.notEqual(run.status, 0, `shadow-only run must fail acceptance:\n${run.stdout}\n${run.stderr}`);
  assert.equal(summary.status, 'FAIL_P0_08_STAGE10_PRODUCT_WIRING');
  assert.ok(summary.failures.includes('VISIBLE_UI_COMMAND_PATH_NOT_PROVEN'));
  assert.ok(summary.failures.includes('COMMENTS_PRODUCT_PATH_NOT_PERSISTED_REOPENED'));
  assert.ok(summary.failures.includes('SHADOW_ONLY_ACCEPTED_AS_COMPLETE'));

  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.pass, false);
  assert.equal(receipt.programDoneClaim, false);
});

test('P0 08: product path fails closed without storage/reopen port', () => {
  const { run, summary, receiptPath } = runP008(['--disable-storage']);
  assert.notEqual(run.status, 0, `storage-disabled run must fail:\n${run.stdout}\n${run.stderr}`);
  assert.equal(summary.status, 'FAIL_P0_08_STAGE10_PRODUCT_WIRING');
  assert.equal(summary.pass, false);
  assert.ok(summary.failures.includes('E_STAGE10_STORAGE_PORT_REQUIRED'));

  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.pass, false);
  assert.equal(receipt.programDoneClaim, false);
});

test('P0 08: network exchange request remains rejected instead of becoming runtime dependency', () => {
  const { run, summary } = runP008(['--request-network-adapter']);
  assert.notEqual(run.status, 0, `network adapter request must fail local product acceptance:\n${run.stdout}\n${run.stderr}`);
  assert.equal(summary.status, 'FAIL_P0_08_STAGE10_PRODUCT_WIRING');
  assert.ok(summary.failures.includes('NETWORK_ADAPTER_REQUIRED_OR_ACCEPTED'));

  const report = JSON.parse(fs.readFileSync(summary.reportPath, 'utf8'));
  assert.equal(report.authority.networkAdapterRuntimeDependency, false);
  assert.equal(report.negativeAssertions.networkAdapterAccepted, false);
});

test('P0 08: direct command bridge is denied by production adapter before reducer or persistence', async () => {
  const module = await importModule('src/product/stage10ProductWiring.mjs');
  const commits = [];
  const recoverySnapshots = new Map();
  let bundle = null;
  const persistencePort = {
    async readStage10State() {
      return bundle ? JSON.parse(JSON.stringify(bundle)) : null;
    },
    async commitStage10State(projectId, nextBundle) {
      bundle = JSON.parse(JSON.stringify(nextBundle));
      commits.push({ projectId, bundle });
      return {
        ok: true,
        storageWritten: true,
        readbackVerified: true,
        bundle: JSON.parse(JSON.stringify(bundle)),
      };
    },
    async writeRecoverySnapshot(projectId, snapshotId, snapshot) {
      recoverySnapshots.set(`${projectId}:${snapshotId}`, JSON.parse(JSON.stringify(snapshot)));
      return { ok: true, atomicWrite: true, readbackVerified: true };
    },
    async readRecoverySnapshot(projectId, snapshotId) {
      return recoverySnapshots.get(`${projectId}:${snapshotId}`) || null;
    },
  };
  const runtime = await module.createStage10ProductRuntime({
    projectId: 'p0-08-direct-negative',
    persistencePort,
    capabilitySnapshot: { capabilities: { stage10LocalProductWiring: true } },
  });
  const beforeHash = module.buildStage10ProductReadModels(runtime.getSession(), {}, {
    authorityStore: bundle.authorityStore,
    integrityAnchor: bundle.integrityAnchor,
    previousIntegrityAnchor: bundle.previousIntegrityAnchor,
  }).surface.projectId;
  const denied = await runtime.dispatchVisibleCommand(
    'project.create',
    { projectId: 'p0-08-direct-negative', sceneId: 'scene-1' },
    { mode: module.STAGE10_ACTIVATION_MODES.FORBIDDEN_DIRECT_BRIDGE, controlId: 'ipc' },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'E_STAGE10_DIRECT_BRIDGE_DENIED');
  assert.equal(runtime.getSession().commandReceiptAuthorityHeadRef.receiptCount, 0);
  assert.equal(commits.length, 1);
  assert.equal(module.buildStage10ProductReadModels(runtime.getSession(), {}, {
    authorityStore: bundle.authorityStore,
    integrityAnchor: bundle.integrityAnchor,
    previousIntegrityAnchor: bundle.previousIntegrityAnchor,
  }).surface.projectId, beforeHash);
});

test('P0 08: source guard keeps adapter browser-safe and blocks receipt-only DONE shortcuts', () => {
  const adapterSource = readText('src/product/stage10ProductWiring.mjs');
  const runnerSource = readText('scripts/ops/yalken-atlas-v5-final-audit-p0-08-stage10-product-wiring.mjs');

  for (const source of [adapterSource]) {
    assert.doesNotMatch(source, /from\s+['"]node:fs['"]/u);
    assert.doesNotMatch(source, /from\s+['"]node:http['"]/u);
    assert.doesNotMatch(source, /from\s+['"]node:https['"]/u);
    assert.doesNotMatch(source, /\bfetch\s*\(/u);
    assert.doesNotMatch(source, /\blocalStorage\b/u);
    assert.doesNotMatch(source, /\bipcRenderer\b|\bipcMain\b/u);
    assert.doesNotMatch(source, /programDoneClaim:\s*true/u);
    assert.doesNotMatch(source, /shadowAcceptedAsComplete:\s*true/u);
  }

  assert.match(adapterSource, /applyCommandWithEventLog/u);
  assert.match(adapterSource, /reduceCoreState/u);
  assert.match(adapterSource, /buildRevisionHistoryProjectionPacket/u);
  assert.match(adapterSource, /buildStableCommentAnchorPacketFromReviewIr/u);
  assert.match(adapterSource, /buildLocalMultiSessionRecoveryReport/u);
  assert.match(adapterSource, /buildTransportNeutralExchangePacket/u);
  assert.match(adapterSource, /persistencePort\.commitStage10State/u);
  assert.match(runnerSource, /--shadow-only/u);
  assert.match(runnerSource, /DIRECT_BRIDGE_NEGATIVE_NOT_PROVEN/u);
  assert.match(runnerSource, /NETWORK_ADAPTER_REQUIRED_OR_ACCEPTED/u);
});

function continuityHistoryWireEntries(raw, keys) {
  const text = raw.toString('utf8');
  let at = 0;
  const space = () => { while (/\s/u.test(text[at] || '\0')) at += 1; };
  function value() {
    space();
    if (text[at] === '"') {
      at += 1;
      while (at < text.length) {
        if (text[at++] === '\\') at += 1;
        else if (text[at - 1] === '"') return;
      }
      assert.fail('Unterminated persisted JSON string');
    }
    if (text[at] === '{' || text[at] === '[') {
      const close = text[at++] === '{' ? '}' : ']';
      space();
      while (text[at] !== close) {
        value(); space();
        if (text[at] === ':') { at += 1; value(); space(); }
        if (text[at] === ',') { at += 1; space(); }
        else break;
      }
      assert.equal(text[at++], close);
      return;
    }
    const start = at;
    while (at < text.length && !/[\s,\]}]/u.test(text[at])) at += 1;
    assert.ok(at > start, 'Persisted JSON value must be present');
  }
  for (const wanted of keys) {
    space(); assert.equal(text[at++], '{'); space();
    let found = false;
    while (text[at] !== '}') {
      const start = at; value(); const key = JSON.parse(text.slice(start, at));
      space(); assert.equal(text[at++], ':'); space();
      if (key === wanted) { found = true; break; }
      value(); space(); if (text[at] === ',') { at += 1; space(); }
    }
    assert.equal(found, true, `Missing persisted history field ${wanted}`);
  }
  space(); assert.equal(text[at++], '['); space();
  const entries = [];
  while (text[at] !== ']') {
    const start = at; value(); entries.push(Buffer.from(text.slice(start, at)));
    space(); if (text[at] === ',') { at += 1; space(); }
  }
  return entries;
}

test('P0 08 continuity: operation65 retains all earlier activation evidence through real persistence and reopen', async (t) => {
  const wiring = await importModule('src/product/stage10ProductWiring.mjs');
  const { createStage10MainPersistenceAdapter } = await importModule('src/product/stage10MainPersistenceAdapter.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-continuity-ui-history-test-'));
  const rootStat = fs.statSync(root);
  fs.writeFileSync(path.join(root, '.task-owner.json'), JSON.stringify({ taskId: 'YALKEN_ATLAS_CONTINUITY_AUTHOR_INPUT_20261027', role: 'FINITE_CONTRACT_IO_NOT_NATIVE', root, dev: rootStat.dev, ino: rootStat.ino, uid: rootStat.uid }));
  const projectId = 'continuity-history-boundary', sceneId = 'scene-1';
  let interruptAuthorityWrite = false;
  const makePort = () => createStage10MainPersistenceAdapter({
    projectRoot: path.join(root, 'project'), anchorRoot: path.join(root, 'anchors'),
    onKillpoint(name) {
      if (interruptAuthorityWrite && name === 'after-authority-write') {
        interruptAuthorityWrite = false;
        throw new Error('HISTORY_TEST_INTERRUPTED_AUTHORITY');
      }
    },
  });
  let port = makePort();
  const options = () => ({ projectId, persistencePort: port, capabilitySnapshot: { capabilities: { stage10LocalProductWiring: true } } });
  let runtime = await wiring.createStage10ProductRuntime(options());
  const activation = { mode: wiring.STAGE10_ACTIVATION_MODES.DOM_VISIBLE_CONTROL_LISTENER_FALLBACK, controlId: 'continuity-history-visible-intent' };
  const edit = (target, text) => target.dispatchVisibleCommand('project.applyTextEdit', { projectId, sceneId, text }, activation);
  assert.equal((await runtime.dispatchVisibleCommand('project.create', { projectId, sceneId }, activation)).ok, true);
  for (let index = 1; index < 64; index += 1) assert.equal((await edit(runtime, `Author edit ${index}`)).ok, true);
  const paths = port.paths(projectId);
  const raw = () => Object.fromEntries(['session', 'authority', 'anchor', 'anchorRecovery'].map((key) => [key, fs.readFileSync(paths[key])]));
  const beforeRaw = raw(), beforeSession = runtime.getSession();
  const beforeBundle = await port.readStage10State(projectId);
  assert.equal(beforeSession.coreState.data.lastCommandId, 64);
  assert.equal(beforeSession.uiEvents.length, 64);
  assert.equal(beforeSession.eventLog.events.length, 64);
  assert.equal(beforeBundle.authorityStore.receipts.length, 64);
  const beforeWire = {
    events: continuityHistoryWireEntries(beforeRaw.session, ['eventLog', 'events']),
    uiEvents: continuityHistoryWireEntries(beforeRaw.session, ['uiEvents']),
    receipts: continuityHistoryWireEntries(beforeRaw.authority, ['receipts']),
  };
  assert.deepEqual(Object.values(beforeWire).map((entries) => entries.length), [64, 64, 64]);
  await t.test('boundary refusals preserve all64 activations and every committed byte', async () => {
    const direct = await runtime.dispatchVisibleCommand('project.applyTextEdit', { projectId, sceneId, text: 'Denied direct write' }, { mode: wiring.STAGE10_ACTIVATION_MODES.FORBIDDEN_DIRECT_BRIDGE, controlId: 'hidden-ipc' });
    assert.equal(direct.error.code, 'E_STAGE10_DIRECT_BRIDGE_DENIED');
    assert.deepEqual(runtime.getSession(), beforeSession); assert.deepEqual(raw(), beforeRaw);
    const unavailable = await wiring.reopenStage10ProductRuntime({ ...options(), capabilitySnapshot: { capabilities: { stage10LocalProductWiring: false } } });
    assert.equal((await edit(unavailable, 'Denied capability write')).error.code, 'E_STAGE10_CAPABILITY_DENIED');
    assert.deepEqual(unavailable.getSession(), beforeSession); assert.deepEqual(raw(), beforeRaw);
    const invalid = await runtime.dispatchVisibleCommand('project.applyTextEdit', { projectId, sceneId: 'missing-scene', text: 'Invalid Core write' }, activation);
    assert.equal(invalid.error.code, 'E_COLLAB_EVENTLOG_APPLY_COMMAND_FAILED');
    assert.equal(invalid.error.details.innerCode, 'E_CORE_SCENE_NOT_FOUND');
    assert.deepEqual(runtime.getSession(), beforeSession); assert.deepEqual(raw(), beforeRaw);
  });
  await t.test('real partial authority write rolls back64 histories and requires a fresh reopen', async () => {
    interruptAuthorityWrite = true;
    await assert.rejects(() => edit(runtime, 'Interrupted operation65'), /HISTORY_TEST_INTERRUPTED_AUTHORITY/u);
    assert.deepEqual(runtime.getSession(), beforeSession);
    assert.notDeepEqual(fs.readFileSync(paths.authority), beforeRaw.authority, 'Fault must reach an actual authority-file publication');
    assert.deepEqual(fs.readFileSync(paths.session), beforeRaw.session);
    await assert.rejects(() => edit(runtime, 'Forbidden retry before reopen'), (error) => error.code === 'E_STAGE10_RUNTIME_REOPEN_REQUIRED');
    port = makePort();
    const recovered = await port.readStage10State(projectId);
    assert.equal(recovered.recoveryConsumed, true);
    assert.deepEqual(recovered.session, beforeSession);
    runtime = await wiring.reopenStage10ProductRuntime(options());
    assert.deepEqual(runtime.getSession(), beforeSession); assert.deepEqual(raw(), beforeRaw);
  });
  await t.test('operation65 persists and reopens every old encoded activation prefix', async () => {
    const applied = await edit(runtime, 'Author operation65 e\u0301 🧭');
    assert.equal(applied.ok, true); assert.equal(applied.receipt.storageWritten, true);
    const afterRaw = raw(), afterBundle = await port.readStage10State(projectId);
    const reopened = await wiring.reopenStage10ProductRuntime({ ...options(), persistencePort: makePort() });
    assert.deepEqual(reopened.getSession(), runtime.getSession()); assert.deepEqual(raw(), afterRaw);
    assert.equal(reopened.getReadModels().replay.ok, true);
    assert.equal(reopened.getSession().coreState.data.projects[projectId].scenes[sceneId].text, 'Author operation65 e\u0301 🧭');
    const afterWire = {
      events: continuityHistoryWireEntries(afterRaw.session, ['eventLog', 'events']),
      uiEvents: continuityHistoryWireEntries(afterRaw.session, ['uiEvents']),
      receipts: continuityHistoryWireEntries(afterRaw.authority, ['receipts']),
    };
    assert.equal(afterWire.events.length, 65); assert.equal(afterWire.receipts.length, 65);
    assert.deepEqual(afterWire.events.slice(0, 64), beforeWire.events);
    assert.deepEqual(afterWire.receipts.slice(0, 64), beforeWire.receipts);
    assert.equal(afterBundle.authorityStore.currentHead.receiptCount, 65);
    assert.equal(reopened.getSession().coreState.data.lastCommandId, 65);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_RUNTIME_MAIN_ADAPTER_COMMIT_AND_REOPEN65', counts: Object.values(afterWire).map((entries) => entries.length), expected: [65, 65, 65], nativeProof: false, firstOldUiEventHash: crypto.createHash('sha256').update(beforeWire.uiEvents[0]).digest('hex'), firstNewUiEventHash: crypto.createHash('sha256').update(afterWire.uiEvents[0]).digest('hex') }));
    assert.equal(afterWire.uiEvents.length, 65, 'Operation65 must retain all64 earlier persisted UI activations');
    assert.deepEqual(afterWire.uiEvents.slice(0, 64), beforeWire.uiEvents);
    assert.deepEqual(reopened.getSession().uiEvents.slice(0, 64), beforeSession.uiEvents);
    assert.equal(reopened.getSession().uiEvents[64].opId, applied.receipt.operationId);
    assert.equal(reopened.getSession().uiEvents[64].directBridge, false);
  });
});

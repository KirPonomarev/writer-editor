const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();

function hashText(value) {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(ROOT, relativePath)).href);
}

function manifestTextForState(state, projectId, extra = {}) {
  return `${JSON.stringify({
    schemaVersion: 1,
    projectId,
    ...extra,
    manualMaps: state.data.projects[projectId].manualMaps,
  }, null, 2)}\n`;
}

function projectTruthMutation(projectId, previousText, nextText, externalArtifactMutation = null) {
  return {
    schemaVersion: 'yalken.stage10.projectTruthMutation.v1',
    projectId,
    relativePath: 'project.craftsman.json',
    previousText,
    nextText,
    previousHash: hashText(previousText),
    nextHash: hashText(nextText),
    ...(externalArtifactMutation ? { externalArtifactMutation } : {}),
  };
}

function artifactMutation(targetPath, nextText, previousText = null) {
  return {
    schemaVersion: 'yalken.stage10.externalArtifactMutation.v1',
    targetPath,
    format: 'json',
    mediaType: 'application/json',
    nextText,
    nextHash: hashText(nextText),
    previousExists: previousText !== null,
    previousText: previousText === null ? '' : previousText,
    previousHash: previousText === null ? '' : hashText(previousText),
  };
}

async function createHarness(name, projectId, options = {}) {
  const adapterModule = await importModule('src/product/stage10MainPersistenceAdapter.mjs');
  const bootstrapModule = await importModule('src/product/stage10ApplicationBootstrap.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `yalken-atlas-v6-a4-${name}-`));
  const projectRoot = path.join(root, 'project');
  const anchorRoot = options.anchorRoot || path.join(root, 'main-owned-integrity');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(anchorRoot, { recursive: true });
  const makeAdapter = (adapterOptions = {}) => adapterModule.createStage10MainPersistenceAdapter({
    projectRoot,
    anchorRoot,
    ...adapterOptions,
  });
  const adapter = makeAdapter(options.adapterOptions || {});
  const bootstrap = bootstrapModule.createStage10ApplicationBootstrap({ persistencePort: adapter });
  await bootstrap.createProjectRuntime({ projectId, title: projectId });
  return { root, projectRoot, anchorRoot, projectId, adapter, makeAdapter, bootstrap };
}

function directoryDigest(root) {
  if (!fs.existsSync(root)) return hashText('ABSENT');
  const records = [];
  const visit = (current, relative = '') => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        records.push(`D:${entryRelative}`);
        visit(entryPath, entryRelative);
      } else {
        records.push(`F:${entryRelative}:${hashText(fs.readFileSync(entryPath))}`);
      }
    }
  };
  visit(root);
  return hashText(records.join('\n'));
}

function spawnModuleChild(source) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  const waiters = new Set();
  const notify = () => waiters.forEach((waiter) => waiter());
  child.stdout.on('data', (chunk) => { stdout += String(chunk); notify(); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); notify(); });
  const completion = new Promise((resolve) => {
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return {
    child,
    completion,
    waitForOutput(fragment, timeoutMs = 10_000) {
      return new Promise((resolve, reject) => {
        let timer;
        const check = () => {
          if (stdout.includes(fragment)) {
            clearTimeout(timer);
            waiters.delete(check);
            resolve({ stdout, stderr });
          } else if (child.exitCode !== null) {
            clearTimeout(timer);
            waiters.delete(check);
            reject(new Error(`CHILD_EXITED_BEFORE_OUTPUT:${fragment}\n${stdout}\n${stderr}`));
          }
        };
        timer = setTimeout(() => {
          waiters.delete(check);
          child.kill('SIGKILL');
          reject(new Error(`CHILD_OUTPUT_TIMEOUT:${fragment}\n${stdout}\n${stderr}`));
        }, timeoutMs);
        waiters.add(check);
        check();
      });
    },
  };
}

test('Atlas V6 A4: Stage-10 project identity exactly shares the valid Unicode main domain without normalization', async () => {
  const identity = await importModule('src/product/stage10ProjectIdentityKey.mjs');
  const projectIdDomain = require(path.join(ROOT, 'src/product/projectIdDomain.cjs'));
  const anchorRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-unicode-anchors-'));
  const accepted = [
    'Проект-Достоевский',
    '项目-小说',
    '\u00e9',
    'e\u0301',
    'Emoji-🚀',
    '🚀'.repeat(64),
  ];
  const keys = new Set();
  for (let index = 0; index < accepted.length; index += 1) {
    const projectId = accepted[index];
    assert.equal(projectIdDomain.normalizeProjectId(projectId), projectId);
    const encoded = identity.stage10ProjectPathIdentity(projectId);
    assert.equal(encoded.ok, true);
    assert.equal(identity.decodeStage10ProjectPathKey(encoded.canonicalKey), projectId);
    assert.equal(encoded.canonicalKey.split('/').every((segment) => segment.length <= 96), true);
    keys.add(encoded.canonicalKey.toLowerCase());
    const harness = await createHarness(`unicode-${index}`, projectId, { anchorRoot });
    const reopened = await harness.makeAdapter().readStage10State(projectId);
    assert.equal(reopened.session.projectId, projectId);
  }
  assert.equal(keys.size, accepted.length);
  assert.notEqual(
    identity.stage10ProjectPathIdentity('\u00e9').canonicalKey,
    identity.stage10ProjectPathIdentity('e\u0301').canonicalKey,
  );
  assert.equal(identity.stage10ProjectPathIdentity('  项目-小说  ').projectId, '项目-小说');
  for (const rejected of ['a/b', 'a\\b', `a${String.fromCharCode(1)}b`, 'a'.repeat(129), '\ud800']) {
    assert.equal(projectIdDomain.normalizeProjectId(rejected), '');
    assert.equal(identity.stage10ProjectPathIdentity(rejected).ok, false);
  }
  assert.equal(identity.stage10ProjectPathIdentity('alpha:beta').canonicalKey, 'p2~/616c7068613a62657461/project');
});

test('Atlas V6 A4: foreign legacy aliases fail before canonical lineage mutation in both creation orders', async () => {
  const identity = await importModule('src/product/stage10ProjectIdentityKey.mjs');
  const firstAnchorRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-alias-first-'));
  const foreignFirst = await createHarness('alias-foreign-first', 'alpha:beta', { anchorRoot: firstAnchorRoot });
  const foreignPaths = foreignFirst.adapter.paths('alpha:beta');
  const foreignLegacyRoot = path.join(firstAnchorRoot, foreignPaths.legacyProjectKey);
  fs.renameSync(foreignPaths.anchorRoot, foreignLegacyRoot);
  const requestedIdentity = identity.stage10ProjectPathIdentity('alpha_beta');
  const requestedCanonicalRoot = path.join(firstAnchorRoot, requestedIdentity.canonicalKey);
  const beforeForeignFirst = directoryDigest(firstAnchorRoot);
  await assert.rejects(
    () => createHarness('alias-requested-second', 'alpha_beta', { anchorRoot: firstAnchorRoot }),
    (error) => error?.code === 'E_STAGE10_PROJECT_KEY_LEGACY_COLLISION',
  );
  assert.equal(directoryDigest(firstAnchorRoot), beforeForeignFirst);
  assert.equal(fs.existsSync(requestedCanonicalRoot), false);

  const secondAnchorRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-alias-second-'));
  const requestedFirst = await createHarness('alias-requested-first', 'alpha_beta', { anchorRoot: secondAnchorRoot });
  const foreignSecond = await createHarness('alias-foreign-second', 'alpha:beta', { anchorRoot: secondAnchorRoot });
  const foreignSecondPaths = foreignSecond.adapter.paths('alpha:beta');
  fs.renameSync(foreignSecondPaths.anchorRoot, path.join(secondAnchorRoot, foreignSecondPaths.legacyProjectKey));
  const beforeRequestedReopen = directoryDigest(secondAnchorRoot);
  await assert.rejects(
    () => requestedFirst.makeAdapter().readStage10State('alpha_beta'),
    (error) => error?.code === 'E_STAGE10_PROJECT_KEY_LEGACY_COLLISION',
  );
  assert.equal(directoryDigest(secondAnchorRoot), beforeRequestedReopen);

  const duplicateAnchorRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-alias-duplicate-'));
  const duplicate = await createHarness('alias-duplicate', 'legacy:project', { anchorRoot: duplicateAnchorRoot });
  const duplicatePaths = duplicate.adapter.paths('legacy:project');
  fs.cpSync(duplicatePaths.anchorRoot, path.join(duplicateAnchorRoot, duplicatePaths.legacyProjectKey), { recursive: true });
  const beforeDuplicate = directoryDigest(duplicateAnchorRoot);
  await assert.rejects(
    () => duplicate.makeAdapter().readStage10State('legacy:project'),
    (error) => error?.code === 'E_STAGE10_PROJECT_KEY_DUPLICATE_ROOT',
  );
  assert.equal(directoryDigest(duplicateAnchorRoot), beforeDuplicate);
});

test('Atlas V6 A4: a child main-manifest writer wins after stale preparation and Stage-10 returns typed CAS without dropping its field', async () => {
  const projectId = 'atlas-v6-a4-manifest-race';
  const harness = await createHarness('manifest-race', projectId);
  const core = await importModule('src/core/runtime.mjs');
  const manifestPath = path.join(harness.projectRoot, 'project.craftsman.json');
  const initialState = harness.bootstrap.getRuntime().getSession().coreState;
  const initialText = manifestTextForState(initialState, projectId, { authorField: 'original' });
  fs.writeFileSync(manifestPath, initialText, 'utf8');
  const concurrentText = manifestTextForState(initialState, projectId, {
    authorField: 'original',
    concurrentAuthorField: 'child-main-writer-survives',
  });
  const authorityUrl = pathToFileURL(path.join(ROOT, 'src/product/mainProjectManifestAuthority.mjs')).href;
  const childSource = `
    import { createMainProjectManifestAuthority } from ${JSON.stringify(authorityUrl)};
    const authority = createMainProjectManifestAuthority({ anchorRoot: ${JSON.stringify(harness.anchorRoot)} });
    const result = await authority.commitManifestText({
      projectId: ${JSON.stringify(projectId)},
      targetPath: ${JSON.stringify(manifestPath)},
      expectedText: ${JSON.stringify(initialText)},
      nextText: ${JSON.stringify(concurrentText)},
      label: 'a4-child-main-manifest-writer',
    });
    process.stdout.write(JSON.stringify(result));
  `;
  let childExecuted = false;
  await assert.rejects(
    () => harness.bootstrap.dispatchCanonicalProjectCommand(
      core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE,
      { projectId, mapId: 'stale-map', title: 'Must not overwrite' },
      {
        schemaVersion: 'yalken.stage10.canonicalProjectTruthCommand.v1',
        projectId,
        coreState: initialState,
        sourceHash: hashText(initialText),
        sourceRevision: initialState.data.lastCommandId,
        async prepareMutation({ nextCoreState }) {
          const child = spawnSync(process.execPath, ['--input-type=module', '-e', childSource], {
            cwd: ROOT,
            encoding: 'utf8',
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
          });
          assert.equal(child.status, 0, child.stderr);
          childExecuted = true;
          return projectTruthMutation(
            projectId,
            initialText,
            manifestTextForState(nextCoreState, projectId, { authorField: 'original' }),
          );
        },
      },
    ),
    (error) => error?.code === 'E_STAGE10_PROJECT_TRUTH_STALE',
  );
  assert.equal(childExecuted, true);
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).concurrentAuthorField, 'child-main-writer-survives');
  assert.equal(fs.existsSync(harness.adapter.paths(projectId).transaction), false);

  const bootstrapModule = await importModule('src/product/stage10ApplicationBootstrap.mjs');
  const retryBootstrap = bootstrapModule.createStage10ApplicationBootstrap({ persistencePort: harness.makeAdapter() });
  await retryBootstrap.reopenProjectRuntime({ projectId });
  const currentText = fs.readFileSync(manifestPath, 'utf8');
  const retryState = retryBootstrap.getRuntime().getSession().coreState;
  const retried = await retryBootstrap.dispatchCanonicalProjectCommand(
    core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE,
    { projectId, mapId: 'retry-map', title: 'CAS retry' },
    {
      schemaVersion: 'yalken.stage10.canonicalProjectTruthCommand.v1',
      projectId,
      coreState: retryState,
      sourceHash: hashText(currentText),
      sourceRevision: retryState.data.lastCommandId,
      prepareMutation({ nextCoreState }) {
        return projectTruthMutation(
          projectId,
          currentText,
          manifestTextForState(nextCoreState, projectId, {
            authorField: 'original',
            concurrentAuthorField: 'child-main-writer-survives',
          }),
        );
      },
    },
  );
  assert.equal(retried.ok, true);
  const finalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(finalManifest.concurrentAuthorField, 'child-main-writer-survives');
  assert.equal(finalManifest.manualMaps.maps['retry-map'].title, 'CAS retry');
});

test('Atlas V6 A4: child changes to absent and existing artifact targets after preflight are preserved and recovered', async () => {
  const core = await importModule('src/core/runtime.mjs');
  const bootstrapModule = await importModule('src/product/stage10ApplicationBootstrap.mjs');
  for (const previousExists of [false, true]) {
    const projectId = `atlas-v6-a4-artifact-${previousExists ? 'existing' : 'absent'}`;
    const harness = await createHarness(`artifact-${previousExists ? 'existing' : 'absent'}`, projectId);
    const manifestPath = path.join(harness.projectRoot, 'project.craftsman.json');
    let manifestText = manifestTextForState(harness.bootstrap.getRuntime().getSession().coreState, projectId);
    fs.writeFileSync(manifestPath, manifestText, 'utf8');
    const madeMap = await harness.bootstrap.dispatchCanonicalProjectCommand(
      core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE,
      { projectId, mapId: 'artifact-map', title: 'Artifact map' },
      {
        schemaVersion: 'yalken.stage10.canonicalProjectTruthCommand.v1',
        projectId,
        coreState: harness.bootstrap.getRuntime().getSession().coreState,
        sourceHash: hashText(manifestText),
        sourceRevision: 1,
        prepareMutation({ nextCoreState }) {
          return projectTruthMutation(projectId, manifestText, manifestTextForState(nextCoreState, projectId));
        },
      },
    );
    assert.equal(madeMap.ok, true);
    manifestText = fs.readFileSync(manifestPath, 'utf8');
    const targetPath = path.join(harness.root, previousExists ? 'existing.json' : 'absent.json');
    const previousText = previousExists ? '{"source":"OLD"}\n' : null;
    if (previousText !== null) fs.writeFileSync(targetPath, previousText, 'utf8');
    const childText = `{"source":"CHILD-${previousExists ? 'EXISTING' : 'ABSENT'}"}\n`;
    const nextText = '{"source":"EXPORT"}\n';
    let injected = false;
    const faultAdapter = harness.makeAdapter({
      onKillpoint(name) {
        if (!injected && name === 'after-transaction-write') {
          injected = true;
          const child = spawnSync(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(targetPath)}, ${JSON.stringify(childText)}, 'utf8')`], {
            cwd: ROOT,
            encoding: 'utf8',
          });
          assert.equal(child.status, 0, child.stderr);
        }
      },
    });
    const faultBootstrap = bootstrapModule.createStage10ApplicationBootstrap({ persistencePort: faultAdapter });
    await faultBootstrap.reopenProjectRuntime({ projectId });
    const faultState = faultBootstrap.getRuntime().getSession().coreState;
    let conflict = null;
    try {
      const result = await faultBootstrap.dispatchCanonicalProjectCommand(
        core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_JSON,
        {
          projectId,
          mapId: 'artifact-map',
          artifact: {
            schemaVersion: 'manualMap.localArtifactIntent.v1',
            format: 'json',
            sha256: hashText(nextText),
            byteLength: Buffer.byteLength(nextText, 'utf8'),
          },
        },
        {
          schemaVersion: 'yalken.stage10.canonicalProjectTruthCommand.v1',
          projectId,
          coreState: faultState,
          sourceHash: hashText(manifestText),
          sourceRevision: faultState.data.lastCommandId,
          prepareMutation({ nextCoreState }) {
            return projectTruthMutation(
              projectId,
              manifestText,
              manifestTextForState(nextCoreState, projectId),
              artifactMutation(targetPath, nextText, previousText),
            );
          },
        },
      );
      assert.equal(result.ok, false);
      conflict = result.error || result;
    } catch (error) {
      conflict = error;
    }
    assert.match(
      JSON.stringify(conflict),
      /E_STAGE10_EXTERNAL_ARTIFACT_CAS_FAILED|EXTERNAL_ARTIFACT_(?:REVISION_CONFLICT|UNEXPECTEDLY_EXISTS|CONCURRENT_CREATE)/u,
    );
    assert.equal(injected, true);
    assert.equal(fs.readFileSync(targetPath, 'utf8'), childText);
    const recoveryAdapter = harness.makeAdapter();
    const recovered = await recoveryAdapter.readStage10State(projectId);
    assert.equal(recovered.recoveryConsumed, true);
    assert.equal(fs.readFileSync(targetPath, 'utf8'), childText);
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestText);
    assert.equal(fs.existsSync(recoveryAdapter.paths(projectId).transaction), false);
    assert.equal(fs.readdirSync(harness.root).some((name) => name.includes('.stage10-cas.')), false);
  }
});

test('Atlas V6 A4: interrupted artifact reservation restores prior bytes and stale recovery leaves no reservation files', async () => {
  const core = await importModule('src/core/runtime.mjs');
  const bootstrapModule = await importModule('src/product/stage10ApplicationBootstrap.mjs');
  const projectId = 'atlas-v6-a4-artifact-reservation-crash';
  const harness = await createHarness('artifact-reservation-crash', projectId);
  const manifestPath = path.join(harness.projectRoot, 'project.craftsman.json');
  const manifestText = manifestTextForState(harness.bootstrap.getRuntime().getSession().coreState, projectId);
  fs.writeFileSync(manifestPath, manifestText, 'utf8');
  const targetPath = path.join(harness.root, 'reserved-existing.json');
  const previousText = '{"source":"PRIOR"}\n';
  fs.writeFileSync(targetPath, previousText, 'utf8');
  let armed = true;
  const faultAdapter = harness.makeAdapter({
    onKillpoint(name) {
      if (armed && name === 'after-external-artifact-reserve') {
        armed = false;
        throw new Error('A4_INTERRUPT_AFTER_ARTIFACT_RESERVE');
      }
    },
  });
  const faultBootstrap = bootstrapModule.createStage10ApplicationBootstrap({ persistencePort: faultAdapter });
  await faultBootstrap.reopenProjectRuntime({ projectId });
  const state = faultBootstrap.getRuntime().getSession().coreState;
  await assert.rejects(
    () => faultBootstrap.dispatchCanonicalProjectCommand(
      core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE,
      { projectId, mapId: 'reservation-crash', title: 'Reservation crash' },
      {
        schemaVersion: 'yalken.stage10.canonicalProjectTruthCommand.v1',
        projectId,
        coreState: state,
        sourceHash: hashText(manifestText),
        sourceRevision: state.data.lastCommandId,
        prepareMutation({ nextCoreState }) {
          return projectTruthMutation(
            projectId,
            manifestText,
            manifestTextForState(nextCoreState, projectId),
            artifactMutation(targetPath, '{"source":"NEXT"}\n', previousText),
          );
        },
      },
    ),
    /A4_INTERRUPT_AFTER_ARTIFACT_RESERVE/u,
  );
  assert.equal(fs.existsSync(targetPath), false);
  assert.equal(fs.readdirSync(harness.root).some((name) => name.includes('.stage10-cas.')), true);
  const recoveryAdapter = harness.makeAdapter();
  const recovered = await recoveryAdapter.readStage10State(projectId);
  assert.equal(recovered.recoveryConsumed, true);
  assert.equal(fs.readFileSync(targetPath, 'utf8'), previousText);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestText);
  assert.equal(fs.readdirSync(harness.root).some((name) => name.includes('.stage10-cas.')), false);
});

test('Atlas V6 A4: process-instance heartbeat defeats PID reuse, wall-clock jumps, blocked-loop expiry and crash staleness', { timeout: 25_000 }, async () => {
  const leaseModule = await importModule('src/product/projectLease.mjs');
  const originalExecArgv = process.execArgv.slice();
  process.execArgv.push(
    '--stack-trace-limit=10',
    '--secure-heap=0',
    '--tls-cipher-list=TLS_AES_256_GCM_SHA384',
    '--node-snapshot',
    '--trace-event-file-pattern=node_trace.${rotation}.log',
    '--input-type=module',
  );
  try {
    assert.deepEqual(leaseModule.projectLeaseHeartbeatWorkerExecArgv(), []);
  } finally {
    process.execArgv.splice(0, process.execArgv.length, ...originalExecArgv);
  }
  const leaseUrl = pathToFileURL(path.join(ROOT, 'src/product/projectLease.mjs')).href;
  const longTemporaryBase = fs.mkdtempSync(path.join('/tmp', 'yalken-a4-socket-root-'));
  const longTemporaryRoot = path.join(longTemporaryBase, 'x'.repeat(96));
  const boundedSocketRoot = fs.mkdtempSync(path.join('/tmp', 'yalken-atlas-v6-a4-bounded-socket-'));
  fs.mkdirSync(longTemporaryRoot, { recursive: true });
  try {
    const boundedSocketSource = `
      import { createProjectLeaseManager } from ${JSON.stringify(leaseUrl)};
      const manager = createProjectLeaseManager({
        leaseRoot: ${JSON.stringify(boundedSocketRoot)},
        ttlMs: 1000,
      });
      const lease = await manager.acquire('bounded-socket-project');
      await manager.release(lease);
      process.stdout.write('BOUNDED_SOCKET_OK\\n');
    `;
    const boundedSocket = spawnSync(process.execPath, ['--input-type=module', '-e', boundedSocketSource], {
      cwd: ROOT,
      env: { ...process.env, TMPDIR: longTemporaryRoot, FORCE_COLOR: '0', NO_COLOR: '1' },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(boundedSocket.status, 0, boundedSocket.stderr);
    assert.match(boundedSocket.stdout, /BOUNDED_SOCKET_OK/u);
  } finally {
    fs.rmSync(longTemporaryBase, { recursive: true, force: true });
    fs.rmSync(boundedSocketRoot, { recursive: true, force: true });
  }

  let wall = 10_000;
  let monotonic = 20_000;
  const pidReuseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-pid-reuse-'));
  const first = leaseModule.createProjectLeaseManager({
    leaseRoot: pidReuseRoot,
    ttlMs: 1_000,
    nowMs: () => wall,
    nowMonotonicMs: () => monotonic,
    isProcessAlive: () => true,
  });
  const stale = await first.acquire('pid-reuse-project');
  wall += 1_001;
  monotonic += 1_001;
  const second = leaseModule.createProjectLeaseManager({
    leaseRoot: pidReuseRoot,
    ttlMs: 1_000,
    nowMs: () => wall,
    nowMonotonicMs: () => monotonic,
    isProcessAlive: () => true,
  });
  const current = await second.acquire('pid-reuse-project');
  assert.equal(current.recoveredExpiredLease, true);
  await assert.rejects(
    () => first.publish(stale, () => Promise.resolve()),
    (error) => error?.code === 'E_PROJECT_LEASE_OWNERSHIP_LOST',
  );
  await second.release(current);

  const clockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-clock-edge-'));
  wall = 50_000;
  monotonic = 70_000;
  const clockHolder = leaseModule.createProjectLeaseManager({
    leaseRoot: clockRoot,
    ttlMs: 1_000,
    nowMs: () => wall,
    nowMonotonicMs: () => monotonic,
  });
  await clockHolder.acquire('clock-project');
  wall += 10_000_000;
  const clockContender = leaseModule.createProjectLeaseManager({
    leaseRoot: clockRoot,
    ttlMs: 1_000,
    nowMs: () => wall,
    nowMonotonicMs: () => monotonic,
  });
  await assert.rejects(
    () => clockContender.acquire('clock-project'),
    (error) => error?.code === 'E_PROJECT_LEASE_HELD' && error?.details?.ownerAlive === true,
  );
  wall -= 20_000_000;
  monotonic += 1_001;
  const afterClockEdge = await clockContender.acquire('clock-project');
  assert.equal(afterClockEdge.recoveredExpiredLease, true);
  await clockContender.release(afterClockEdge);

  const blockedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-blocked-loop-'));
  const blockedSource = `
    import { createProjectLeaseManager } from ${JSON.stringify(leaseUrl)};
    const manager = createProjectLeaseManager({
      leaseRoot: ${JSON.stringify(blockedRoot)},
      ttlMs: 1000,
      useHeartbeatWorker: false,
    });
    await manager.withLease('blocked-project', async () => {
      process.stdout.write('BLOCKED_HELD\\n');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2600);
      process.stdout.write('BLOCKED_RELEASE\\n');
    });
  `;
  const blocked = spawnModuleChild(blockedSource);
  await blocked.waitForOutput('BLOCKED_HELD');
  await delay(1_300);
  const blockedContender = leaseModule.createProjectLeaseManager({ leaseRoot: blockedRoot, ttlMs: 1_000 });
  await assert.rejects(
    () => blockedContender.acquire('blocked-project'),
    (error) => error?.code === 'E_PROJECT_LEASE_HELD'
      && error?.details?.ownerAlive === true
      && error?.details?.processInstanceAlive === true,
  );
  const blockedResult = await blocked.completion;
  assert.equal(blockedResult.code, 0, blockedResult.stderr);

  const crashRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-atlas-v6-a4-process-crash-'));
  const crashSource = `
    import { createProjectLeaseManager } from ${JSON.stringify(leaseUrl)};
    const manager = createProjectLeaseManager({ leaseRoot: ${JSON.stringify(crashRoot)}, ttlMs: 1000 });
    await manager.withLease('crash-project', async () => {
      process.stdout.write('CRASH_HELD\\n');
      await new Promise(() => {});
    });
  `;
  const crashed = spawnModuleChild(crashSource);
  await crashed.waitForOutput('CRASH_HELD');
  crashed.child.kill('SIGKILL');
  await crashed.completion;
  await delay(1_250);
  const crashRecovery = leaseModule.createProjectLeaseManager({ leaseRoot: crashRoot, ttlMs: 1_000 });
  const recoveredLease = await crashRecovery.acquire('crash-project');
  assert.equal(recoveredLease.recoveredExpiredLease, true);
  await crashRecovery.release(recoveredLease);
});

test('manual-map actual Stage10 regular-file publication retains reserved sources and recovers every artifact interruption', async t => {
  const { createDarwinExclusiveFilePublisher } = require('../../src/main/projectArchiveDarwinPublication.cjs');
  if (process.platform !== 'darwin') {
    await assert.rejects(createDarwinExclusiveFilePublisher({ platform: process.platform })({}), { code: 'E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE' });
    return;
  }
  const core = await importModule('src/core/runtime.mjs'), bootstrapModule = await importModule('src/product/stage10ApplicationBootstrap.mjs');
  const external = process.env.YALKEN_MANUAL_MAP_TEST_ARTIFACT_ROOT;
  for (const volume of ['APFS', ...(external ? ['external'] : [])]) {
    for (const point of ['after-external-artifact-candidate', 'after-external-artifact-reserve', 'after-external-artifact-write', 'after-anchor-write']) {
      await (async () => {
        const projectId = `map-file-${volume}-${point}`, h = await createHarness('file-publication', projectId);
        t.after(() => fs.rmSync(h.root, { recursive: true, force: true }));
        const helperPath = path.join(fs.realpathSync(h.root), 'helper');
        require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative({ outputPath: helperPath });
        const outputRoot = volume === 'APFS' ? fs.realpathSync(h.root) : fs.mkdtempSync(path.join(external, 'stage10-file-'));
        if (volume !== 'APFS') t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));
        const targetPath = path.join(outputRoot, 'map.json'), previousText = '{"state":"PREVIOUS"}\n', nextText = '{"state":"NEXT"}\n';
        fs.writeFileSync(targetPath, previousText);
        const manifestPath = path.join(h.projectRoot, 'project.craftsman.json');
        const previousManifest = manifestTextForState(h.bootstrap.getRuntime().getSession().coreState, projectId, { protected: 'keep' });
        fs.writeFileSync(manifestPath, previousManifest);
        let armed = false, captured = 0;
        const publisher = createDarwinExclusiveFilePublisher({ helperPath });
        const publishFileExclusive = async input => {
          const before = fs.lstatSync(input.sourcePath), bytes = fs.readFileSync(input.sourcePath);
          const result = await publisher(input);
          const after = fs.lstatSync(input.sourcePath);
          assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino);
          assert.deepEqual(fs.readFileSync(input.sourcePath), bytes); captured++;
          return result;
        };
        publishFileExclusive.assertAvailable = publisher.assertAvailable;
        const options = { publishFileExclusive, onKillpoint(name) { if (armed && name === point) { armed = false; throw Error('OWNED_INTERRUPTION:' + point); } } };
        const adapter = h.makeAdapter(options), bootstrap = bootstrapModule.createStage10ApplicationBootstrap({ persistencePort: adapter });
        await bootstrap.reopenProjectRuntime({ projectId });
        let state = bootstrap.getRuntime().getSession().coreState;
        const made = await bootstrap.dispatchCanonicalProjectCommand(core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE,
          { projectId, mapId: 'map', title: 'Map' }, { projectId, coreState: state, sourceHash: hashText(previousManifest), sourceRevision: state.data.lastCommandId,
            prepareMutation: ({ nextCoreState }) => projectTruthMutation(projectId, previousManifest, manifestTextForState(nextCoreState, projectId, { protected: 'keep' })) });
        assert.equal(made.ok, true);
        const manifestText = fs.readFileSync(manifestPath, 'utf8'); state = bootstrap.getRuntime().getSession().coreState;
        armed = true;
        await assert.rejects(bootstrap.dispatchCanonicalProjectCommand(core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_JSON,
          { projectId, mapId: 'map', artifact: { schemaVersion: 'manualMap.localArtifactIntent.v1', format: 'json', sha256: hashText(nextText), byteLength: Buffer.byteLength(nextText) } },
          { projectId, coreState: state, sourceHash: hashText(manifestText), sourceRevision: state.data.lastCommandId,
            prepareMutation: ({ nextCoreState }) => projectTruthMutation(projectId, manifestText,
              manifestTextForState(nextCoreState, projectId, { protected: 'keep' }), artifactMutation(targetPath, nextText, previousText)) }), /OWNED_INTERRUPTION/u);
        const transaction = JSON.parse(fs.readFileSync(adapter.paths(projectId).transaction));
        const reservation = transaction.externalArtifactReservation;
        assert.equal(fs.readFileSync(reservation.candidatePath, 'utf8'), nextText);
        if (point !== 'after-external-artifact-candidate') assert.equal(fs.readFileSync(reservation.backupPath, 'utf8'), previousText);
        const recovery = h.makeAdapter({ publishFileExclusive });
        const recovered = await recovery.readStage10State(projectId); assert.equal(recovered.recoveryConsumed, true);
        const committed = point === 'after-anchor-write';
        assert.equal(fs.readFileSync(targetPath, 'utf8'), committed ? nextText : previousText);
        assert.equal(JSON.parse(fs.readFileSync(manifestPath)).protected, 'keep');
        if (!committed) assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestText);
        assert.equal(fs.existsSync(reservation.candidatePath), false); assert.equal(fs.existsSync(reservation.backupPath), false);
        assert.equal(fs.existsSync(adapter.paths(projectId).transaction), false);
        assert.equal(fs.readdirSync(outputRoot).some(name => name.startsWith('.stage10-publish-')), false);
        if (point === 'after-external-artifact-write' || committed) assert.ok(captured >= 1);
      })();
    }
  }
});

for (const fault of ['missing-method', 'unavailable', 'false', 'unknown', 'malformed', 'stale-lease']) {
  test('manual-map actual adapter refuses unavailable file capability before journal or existing-target relocation: ' + fault + ' [FINITE_READ_ONLY_CAPABILITY_FAULT_NOT_PHYSICAL_VOLUME_PROOF]', async t => {
    const core = await importModule('src/core/runtime.mjs'), bootstrapModule = await importModule('src/product/stage10ApplicationBootstrap.mjs');
    const projectId = 'map-capability-' + fault, h = await createHarness('capability-refusal', projectId);
    t.after(() => fs.rmSync(h.root, { recursive: true, force: true }));
    const targetPath = path.join(fs.realpathSync(h.root), 'map.json'), previousText = '{"state":"PREVIOUS"}\n', nextText = '{"state":"NEXT"}\n';
    fs.writeFileSync(targetPath, previousText); const targetIdentity = fs.lstatSync(targetPath);
    const manifestPath = path.join(h.projectRoot, 'project.craftsman.json');
    const initial = manifestTextForState(h.bootstrap.getRuntime().getSession().coreState, projectId, { protected: 'keep' });
    fs.writeFileSync(manifestPath, initial); let capabilityCalls = 0, publicationCalls = 0;
    const publisher = async () => { publicationCalls++; throw Error('PUBLICATION_MUST_NOT_RUN'); };
    if (fault !== 'missing-method') publisher.assertAvailable = async ({ assertCurrent }) => {
      capabilityCalls++; await assertCurrent();
      if (fault === 'unavailable') throw Object.assign(Error('E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE'), { code: 'E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE',
        details: { publication: { phase: 'CAPABILITY_UNAVAILABLE', errno: 45, namePublished: false } } });
      if (fault === 'stale-lease') {
        const metadataPath = path.join(h.anchorRoot, fs.readdirSync(h.anchorRoot, { recursive: true }).find(name => name.endsWith('/owner.v3.json')));
        const metadata = JSON.parse(fs.readFileSync(metadataPath)); metadata.fencingGeneration++;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata)); return { available: true, readOnly: true };
      }
      return fault === 'false' ? { available: false, readOnly: true } : fault === 'malformed' ? { available: 'true', readOnly: true } : {};
    };
    const adapter = h.makeAdapter({ publishFileExclusive: publisher }), bootstrap = bootstrapModule.createStage10ApplicationBootstrap({ persistencePort: adapter });
    await bootstrap.reopenProjectRuntime({ projectId }); let state = bootstrap.getRuntime().getSession().coreState;
    assert.equal((await bootstrap.dispatchCanonicalProjectCommand(core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE,
      { projectId, mapId: 'map', title: 'Map' }, { projectId, coreState: state, sourceHash: hashText(initial), sourceRevision: state.data.lastCommandId,
        prepareMutation: ({ nextCoreState }) => projectTruthMutation(projectId, initial, manifestTextForState(nextCoreState, projectId, { protected: 'keep' })) })).ok, true);
    const manifestText = fs.readFileSync(manifestPath, 'utf8'), before = directoryDigest(h.projectRoot);
    state = bootstrap.getRuntime().getSession().coreState;
    await assert.rejects(bootstrap.dispatchCanonicalProjectCommand(core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_JSON,
      { projectId, mapId: 'map', artifact: { schemaVersion: 'manualMap.localArtifactIntent.v1', format: 'json', sha256: hashText(nextText), byteLength: Buffer.byteLength(nextText) } },
      { projectId, coreState: state, sourceHash: hashText(manifestText), sourceRevision: state.data.lastCommandId,
        prepareMutation: ({ nextCoreState }) => projectTruthMutation(projectId, manifestText, manifestTextForState(nextCoreState, projectId, { protected: 'keep' }), artifactMutation(targetPath, nextText, previousText)) }),
    error => ['E_STAGE10_FILE_PRIMITIVE_UNAVAILABLE', 'E_PROJECT_LEASE_OWNERSHIP_LOST'].includes(error.code));
    assert.equal(capabilityCalls, fault === 'missing-method' ? 0 : 1); assert.equal(publicationCalls, 0);
    assert.equal(directoryDigest(h.projectRoot), before); assert.equal(fs.readFileSync(targetPath, 'utf8'), previousText);
    assert.equal(fs.lstatSync(targetPath).ino, targetIdentity.ino); assert.equal(fs.existsSync(adapter.paths(projectId).transaction), false);
    assert.equal(fs.readdirSync(fs.realpathSync(h.root)).some(name => name.includes('.stage10-cas.')), false);
  });
}

// These bytes exercise the binary carrier; native PDF parse/render is separate.
function pdfCarrierBytes(length = 29) {
  const bytes = Buffer.alloc(length, 0xff);
  Buffer.from('%PDF-1.7\n', 'latin1').copy(bytes);
  Buffer.from('\n%%EOF\n').copy(bytes, length - 7); return bytes;
}

function pdfArtifactMutation(targetPath, next, previous = null) {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  return { schemaVersion: 'yalken.stage10.externalArtifactMutation.v2', targetPath, format: 'pdf', mediaType: 'application/pdf',
    nextBase64: next.toString('base64'), nextByteLength: next.length, nextHash: hash(next), previousExists: previous !== null,
    previousBase64: previous?.toString('base64') || '', previousByteLength: previous?.length || 0, previousHash: previous === null ? '' : hash(previous) };
}

let pdfFixtureSequence = 0;
async function pdfPersistenceFixture(t, previous = null, options = {}) {
  const core = await importModule('src/core/runtime.mjs'), boot = await importModule('src/product/stage10ApplicationBootstrap.mjs');
  const projectId = 'pdf-carrier-' + ++pdfFixtureSequence, h = await createHarness('pdf-carrier', projectId);
  const rootIdentity = fs.lstatSync(h.root);
  t.after(() => { const now = fs.lstatSync(h.root); assert.equal(now.dev, rootIdentity.dev); assert.equal(now.ino, rootIdentity.ino); fs.rmSync(h.root, { recursive: true }); });
  const targetPath = path.join(fs.realpathSync(h.root), 'map.pdf'), next = pdfCarrierBytes();
  if (previous !== null) fs.writeFileSync(targetPath, previous);
  const manifestPath = path.join(h.projectRoot, 'project.craftsman.json');
  fs.writeFileSync(manifestPath, manifestTextForState(h.bootstrap.getRuntime().getSession().coreState, projectId, { protected: 'keep é 🧭' }));
  let publisher;
  if (options.physical !== false) {
    if (process.platform === 'darwin') {
      const helperPath = path.join(fs.realpathSync(h.root), 'helper');
      require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative({ outputPath: helperPath });
      const native = require('../../src/main/projectArchiveDarwinPublication.cjs').createDarwinExclusiveFilePublisher({ helperPath });
      publisher = async input => {
        const before = fs.lstatSync(input.sourcePath), bytes = fs.readFileSync(input.sourcePath), result = await native(input);
        const after = fs.lstatSync(input.sourcePath); assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino);
        assert.deepEqual(fs.readFileSync(input.sourcePath), bytes); return result;
      };
      publisher.assertAvailable = native.assertAvailable;
    } else {
      // Finite non-Darwin effect, NOT physical Darwin publication/PDF proof.
      publisher = async ({ sourcePath, targetPath, assertCurrent }) => {
        await assertCurrent(); await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
      };
      publisher.assertAvailable = async ({ assertCurrent }) => { await assertCurrent(); return { available: true, readOnly: true }; };
    }
  }
  const adapter = h.makeAdapter({ publishFileExclusive: publisher, onKillpoint: options.onKillpoint });
  const bootstrap = boot.createStage10ApplicationBootstrap({ persistencePort: adapter }); await bootstrap.reopenProjectRuntime({ projectId });
  const command = async (type, payload, external) => {
    const state = bootstrap.getRuntime().getSession().coreState, text = fs.readFileSync(manifestPath, 'utf8');
    return bootstrap.dispatchCanonicalProjectCommand(type, { projectId, mapId: 'map', ...payload },
      { projectId, coreState: state, sourceHash: hashText(text), sourceRevision: state.data.lastCommandId,
        prepareMutation: ({ nextCoreState }) => projectTruthMutation(projectId, text,
          manifestTextForState(nextCoreState, projectId, { protected: 'keep é 🧭' }), external) });
  };
  assert.equal((await command(core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE, { title: 'Map' })).ok, true);
  const dispatch = (external = pdfArtifactMutation(targetPath, next, previous), requestedBytes = next) => command(
    external.format === 'json' ? core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_JSON : core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_IMAGE_PDF,
    { artifact: { schemaVersion: 'manualMap.localArtifactIntent.v1', format: external.format === 'json' ? 'json' : 'pdf',
      mediaType: external.format === 'json' ? 'application/json' : 'application/pdf',
      sha256: hashText(external.format === 'json' ? external.nextText : requestedBytes),
      byteLength: external.format === 'json' ? Buffer.byteLength(external.nextText) : requestedBytes.length } }, external);
  return { ...h, adapter, targetPath, manifestPath, next, previous, publisher, dispatch,
    reopen: () => h.makeAdapter({ publishFileExclusive: publisher }).readStage10State(projectId) };
}

test('manual-map PDF v2 rejects malformed binary carriers before canonical or external writes', async t => {
  const h = await pdfPersistenceFixture(t, Buffer.from([0xff, 0xfe, 0]), { physical: false });
  const original = pdfArtifactMutation(h.targetPath, h.next, h.previous), before = directoryDigest(h.projectRoot);
  const invalid = [
    { bytes: 'forged' }, { previousText: '' }, { targetPath: 'relative.pdf' }, { targetPath: '/' }, { targetPath: '/tmp/a\0.pdf' },
    { format: 'svg' }, { mediaType: 'text/html' }, { previousExists: 1 }, { previousExists: null },
    { nextByteLength: '29' }, { nextByteLength: 0 }, { nextByteLength: 1.5 }, { nextByteLength: 8 * 1024 * 1024 + 1 },
    { nextBase64: original.nextBase64 + '\n' }, { nextBase64: original.nextBase64.replace('/', '_') },
    { nextBase64: '*'.repeat(original.nextBase64.length) }, { nextHash: '0'.repeat(64) },
    { previousByteLength: -1 }, { previousByteLength: 8 * 1024 * 1024 + 1 }, { previousHash: '' },
    { previousExists: false }, { previousBase64: 'Zh==', previousByteLength: 1, previousHash: hashText('f') },
    { nextBase64: Buffer.from('<html>not PDF</html>').toString('base64'), nextByteLength: 20, nextHash: hashText('<html>not PDF</html>') },
  ];
  for (const extra of invalid) {
    // A refused persistence call is not a fresh in-memory command context.
    const current = await pdfPersistenceFixture(t, h.previous, { physical: false }), baseline = directoryDigest(current.projectRoot);
    const carrier = pdfArtifactMutation(current.targetPath, current.next, current.previous);
    await assert.rejects(current.dispatch({ ...carrier, ...extra }), error => {
      assert.equal(error.code, 'E_STAGE10_EXTERNAL_ARTIFACT_MUTATION_INVALID', JSON.stringify(error)); return true;
    }, JSON.stringify(extra));
    assert.equal(directoryDigest(current.projectRoot), baseline); assert.deepEqual(fs.readFileSync(current.targetPath), current.previous);
    assert.equal(fs.existsSync(current.adapter.paths(current.projectId).transaction), false);
  }
  const oversized = 'A'.repeat(4 * Math.ceil(8 * 1024 * 1024 / 3) + 4), from = Buffer.from; let decoded = 0;
  Buffer.from = function(value, ...args) { if (value === oversized && args[0] === 'base64') decoded++; return from(value, ...args); };
  try { await assert.rejects(h.dispatch({ ...original, nextBase64: oversized }), error => error.code === 'E_STAGE10_EXTERNAL_ARTIFACT_MUTATION_INVALID'); }
  finally { Buffer.from = from; }
  assert.equal(decoded, 0); assert.equal(directoryDigest(h.projectRoot), before);
  const absent = await pdfPersistenceFixture(t, null, { physical: false });
  const missing = pdfArtifactMutation(absent.targetPath, absent.next); delete missing.previousExists;
  await assert.rejects(absent.dispatch(missing), error => error.code === 'E_STAGE10_EXTERNAL_ARTIFACT_MUTATION_INVALID');
});

test('manual-map PDF v2 raw publication and four interruption schedules preserve opaque previous bytes', async t => {
  for (const previous of [null, Buffer.alloc(0), Buffer.from([0xff, 0xfe, 0, 0x80])]) {
    const h = await pdfPersistenceFixture(t, previous);
    assert.equal((await h.dispatch()).ok, true); assert.deepEqual(fs.readFileSync(h.targetPath), h.next);
    assert.equal((await h.reopen()).session.projectId, h.projectId);
    assert.equal(JSON.parse(fs.readFileSync(h.manifestPath)).protected, 'keep é 🧭');
    assert.equal(fs.readdirSync(h.root).some(name => name.includes('.stage10-cas.')), false);
  }
  for (const point of ['after-external-artifact-candidate', 'after-external-artifact-reserve', 'after-external-artifact-write', 'after-anchor-write']) {
    let armed = false;
    const h = await pdfPersistenceFixture(t, Buffer.from([0xff, 0xfe, 0, 0x80]), { onKillpoint(name) {
      if (armed && name === point) { armed = false; throw Error('PDF_INTERRUPTION:' + point); }
    } });
    const manifest = fs.readFileSync(h.manifestPath); armed = true;
    await assert.rejects(h.dispatch(), /PDF_INTERRUPTION/u);
    const transaction = JSON.parse(fs.readFileSync(h.adapter.paths(h.projectId).transaction)), reservation = transaction.externalArtifactReservation;
    assert.deepEqual(fs.readFileSync(reservation.candidatePath), h.next);
    if (point !== 'after-external-artifact-candidate') assert.deepEqual(fs.readFileSync(reservation.backupPath), h.previous);
    assert.equal(transaction.projectTruthMutation.externalArtifactMutation.schemaVersion, 'yalken.stage10.externalArtifactMutation.v2');
    assert.equal((await h.reopen()).recoveryConsumed, true);
    assert.deepEqual(fs.readFileSync(h.targetPath), point === 'after-anchor-write' ? h.next : h.previous);
    if (point !== 'after-anchor-write') assert.deepEqual(fs.readFileSync(h.manifestPath), manifest);
    assert.equal(fs.existsSync(reservation.candidatePath), false); assert.equal(fs.existsSync(reservation.backupPath), false);
    assert.equal(fs.existsSync(h.adapter.paths(h.projectId).transaction), false);
  }
  const boundary = await pdfPersistenceFixture(t), bytes = pdfCarrierBytes(8 * 1024 * 1024);
  assert.equal((await boundary.dispatch(pdfArtifactMutation(boundary.targetPath, bytes), bytes)).ok, true);
  assert.deepEqual(fs.readFileSync(boundary.targetPath), bytes);
});

test('manual-map PDF v2 bounded no-follow reads retain changed files and ambiguous reservations', async t => {
  for (const location of ['target', 'candidate', 'backup', 'conflict']) for (const fault of ['oversize', 'symlink', 'changed']) {
    let armed = false;
    const point = location === 'backup' ? 'after-external-artifact-reserve' : location === 'conflict' ? 'after-external-artifact-write' : 'after-external-artifact-candidate';
    const h = await pdfPersistenceFixture(t, Buffer.from([0xff, 0xfe, 0x80]), { onKillpoint(name) {
      if (armed && name === point) { armed = false; throw Error('PDF_READ_FIXTURE'); }
    } });
    let reservation;
    if (location !== 'target') {
      armed = true; await assert.rejects(h.dispatch(), /PDF_READ_FIXTURE/u);
      reservation = JSON.parse(fs.readFileSync(h.adapter.paths(h.projectId).transaction)).externalArtifactReservation;
    }
    const file = location === 'target' ? h.targetPath : reservation[location + 'Path'];
    if (location === 'conflict') fs.writeFileSync(file, Buffer.from([0x81]));
    if (fault === 'oversize') fs.truncateSync(file, 8 * 1024 * 1024 + 1);
    if (fault === 'symlink') { fs.renameSync(file, file + '.original'); fs.symlinkSync(file + '.original', file); }
    const before = fs.readFileSync(file), manifest = fs.readFileSync(h.manifestPath), originalOpen = fs.promises.open; let injected = false;
    if (fault === 'changed') fs.promises.open = async (name, ...args) => {
      const handle = await originalOpen(name, ...args); if (name !== file) return handle;
      const read = handle.read.bind(handle); handle.read = async (...params) => {
        const result = await read(...params); if (!injected) { injected = true; fs.appendFileSync(file, Buffer.from([0x82])); } return result;
      }; return handle;
    };
    try { await assert.rejects(location === 'target' ? h.dispatch() : h.reopen(), error => error.code === 'E_STAGE10_EXTERNAL_ARTIFACT_READ_FAILED'); }
    finally { fs.promises.open = originalOpen; }
    assert.deepEqual(fs.readFileSync(file), fault === 'changed' ? Buffer.concat([before, Buffer.from([0x82])]) : before);
    if (fault === 'changed') assert.equal(injected, true);
    if (location === 'target') assert.deepEqual(fs.readFileSync(h.manifestPath), manifest);
    else {
      assert.equal(fs.existsSync(h.adapter.paths(h.projectId).transaction), true);
      assert.equal(fs.lstatSync(reservation.candidatePath).isFile() || fault === 'symlink' && location === 'candidate', true);
      if (location === 'conflict') assert.deepEqual(fs.readFileSync(h.targetPath), h.next);
    }
  }
});

test('manual-map PDF v2 refuses reservationless legacy recovery while v1 tuple and recovery remain exact', async t => {
  let armed = false;
  const h = await pdfPersistenceFixture(t, Buffer.from([0xff, 0xfe]), { onKillpoint(name) {
    if (armed && name === 'after-external-artifact-candidate') { armed = false; throw Error('PDF_LEGACY_FIXTURE'); }
  } });
  armed = true; await assert.rejects(h.dispatch(), /PDF_LEGACY_FIXTURE/u);
  const transactionPath = h.adapter.paths(h.projectId).transaction, transaction = JSON.parse(fs.readFileSync(transactionPath));
  const before = fs.readFileSync(h.manifestPath), reservation = transaction.externalArtifactReservation;
  for (const version of [2, 3, 4]) {
    const forged = { ...transaction, schemaVersion: 'yalken.stage10.mainPersistenceTransaction.v' + version };
    delete forged.externalArtifactReservation; delete forged.externalArtifactReservationDigest;
    fs.writeFileSync(transactionPath, JSON.stringify(forged));
    await assert.rejects(h.reopen(), error => error.code === 'E_STAGE10_EXTERNAL_ARTIFACT_RESERVATION_INVALID' && error.reason === 'PDF_RESERVATION_REQUIRED');
    assert.deepEqual(fs.readFileSync(h.manifestPath), before); assert.deepEqual(fs.readFileSync(h.targetPath), h.previous);
    assert.deepEqual(fs.readFileSync(reservation.candidatePath), h.next);
  }
  fs.writeFileSync(transactionPath, JSON.stringify(transaction)); assert.equal((await h.reopen()).recoveryConsumed, true);
  let v1Armed = false;
  const old = await pdfPersistenceFixture(t, Buffer.from('{"old":"é 🧭"}\n'), { onKillpoint(name) {
    if (v1Armed && name === 'after-external-artifact-candidate') { v1Armed = false; throw Error('V1_TUPLE_FIXTURE'); }
  } });
  const v1 = artifactMutation(old.targetPath, '{"next":"é 🧭"}\n', old.previous.toString('utf8')); v1Armed = true;
  await assert.rejects(old.dispatch(v1), /V1_TUPLE_FIXTURE/u);
  const journal = JSON.parse(fs.readFileSync(old.adapter.paths(old.projectId).transaction));
  assert.deepEqual(journal.projectTruthMutation.externalArtifactMutation, v1);
  assert.deepEqual(Object.keys(journal.projectTruthMutation.externalArtifactMutation), ['schemaVersion', 'targetPath', 'format', 'mediaType', 'nextText', 'nextHash', 'previousExists', 'previousText', 'previousHash']);
  const hashing = await importModule('src/core/browser-safe-hash.mjs');
  assert.equal(journal.projectTruthMutationDigest, hashing.hashCanonicalValue(journal.projectTruthMutation));
  assert.equal((await old.reopen()).recoveryConsumed, true); assert.deepEqual(fs.readFileSync(old.targetPath), old.previous);
});

test('manual-map PDF v2 non-regular FIFO or directory input refuses without blocking or replacing opaque bytes', async t => {
  const h = await pdfPersistenceFixture(t, Buffer.from([0xff, 0xfe, 0x81]));
  const original = h.targetPath + '.opaque-original'; fs.renameSync(h.targetPath, original);
  const fifo = ['darwin', 'linux'].includes(process.platform);
  if (fifo) { const made = spawnSync('mkfifo', [h.targetPath], { encoding: 'utf8' }); assert.equal(made.status, 0, made.stderr); }
  else fs.mkdirSync(h.targetPath); // Explicit non-regular control, never a skipped case.
  const shape = fs.lstatSync(h.targetPath); assert.equal(fifo ? shape.isFIFO() : shape.isDirectory(), true);
  const canonical = directoryDigest(h.projectRoot); let timer, finished = false, release;
  const pending = h.dispatch().finally(() => { finished = true; });
  try {
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('PDF_NON_REGULAR_READ_BLOCKED')), 10000); });
    await assert.rejects(Promise.race([pending, deadline]), error => error.code === 'E_STAGE10_EXTERNAL_ARTIFACT_READ_FAILED');
  } finally {
    clearTimeout(timer);
    // Release a regressed blocking FIFO open so a failed test cannot hang Node.
    if (!finished && fifo) release = fs.openSync(h.targetPath, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
    try { await pending.catch(() => {}); } finally { if (release !== undefined) fs.closeSync(release); }
  }
  assert.deepEqual(fs.readFileSync(original), h.previous); assert.equal(directoryDigest(h.projectRoot), canonical);
  assert.equal(fs.lstatSync(h.targetPath).ino, shape.ino); assert.equal(fs.existsSync(h.adapter.paths(h.projectId).transaction), false);
});

test('manual-map PDF v2 late foreign targets survive refusal and actual recovery', async t => {
  for (const previous of [null, Buffer.from([0xff, 0xfe, 0x81])]) {
    let armed = false, h; const foreign = Buffer.from([0x80, 0, 0xff, 0xfe]);
    h = await pdfPersistenceFixture(t, previous, { onKillpoint(name) {
      if (armed && name === 'after-transaction-write') { armed = false; fs.writeFileSync(h.targetPath, foreign); }
    } });
    const manifest = fs.readFileSync(h.manifestPath); armed = true;
    await assert.rejects(h.dispatch(), error => error.code === 'E_STAGE10_EXTERNAL_ARTIFACT_CAS_FAILED');
    assert.equal(armed, false); assert.deepEqual(fs.readFileSync(h.targetPath), foreign);
    const journal = JSON.parse(fs.readFileSync(h.adapter.paths(h.projectId).transaction)), reservation = journal.externalArtifactReservation;
    assert.deepEqual(fs.readFileSync(reservation.candidatePath), h.next);
    assert.equal((await h.reopen()).recoveryConsumed, true); assert.deepEqual(fs.readFileSync(h.targetPath), foreign);
    assert.deepEqual(fs.readFileSync(h.manifestPath), manifest);
    assert.equal(fs.existsSync(reservation.candidatePath), false); assert.equal(fs.existsSync(reservation.backupPath), false);
  }
});

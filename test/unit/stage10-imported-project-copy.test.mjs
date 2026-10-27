import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import archivePublication from '../../src/main/projectArchiveDarwinPublication.cjs';
import { hashCanonicalValue } from '../../src/core/browser-safe-hash.mjs';
import { createStage10MainPersistenceAdapter } from '../../src/product/stage10MainPersistenceAdapter.mjs';
import { createStage10ApplicationBootstrap } from '../../src/product/stage10ApplicationBootstrap.mjs';
import { createStage10ProductRuntime, reopenStage10ProductRuntime, STAGE10_ACTIVATION_MODES } from '../../src/product/stage10ProductWiring.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const names = ['product-session.v2.json', 'command-receipt-authority-store.v2.json', 'project-truth.latest.v1.json'];
const relative = name => name === names[2] ? '.stage10-local/recovery/' + name : '.stage10-local/' + name;
const activation = { mode: STAGE10_ACTIVATION_MODES.DOM_VISIBLE_CONTROL_LISTENER_FALLBACK, controlId: 'finite-copy-fixture' };

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'stage10-import-copy-test-'));
  await fs.writeFile(path.join(root, '.task-owner.json'), JSON.stringify({ taskId: 'YALKEN_ARCHIVE_AUTHORED_COPY_IDENTITY_20261027', role: 'FINITE_ADAPTER_TEST_RETAINED', root }));
  t.diagnostic('RETAINED_COPY_FIXTURE ' + root);
  const source = path.join(root, 'source'), copy = path.join(root, 'copy'), anchors = path.join(root, 'anchors');
  const sourceText = options.largeHistory ? 'large '.repeat(786432) : 'Авторский текст Ёж 👩🏽‍🚀';
  await fs.mkdir(source); await fs.writeFile(path.join(source, 'scene.txt'), sourceText);
  const sourceId = 'copy-donor', copyId = 'copy-target', sceneId = 'copy-scene';
  const manifestPath = path.join(source, 'project.craftsman.json');
  await fs.writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, projectId: sourceId, projectName: 'Source', lastCommandId: 0 }));
  const donorPort = createStage10MainPersistenceAdapter({ projectRoot: source, anchorRoot: path.join(root, 'donor-anchors') });
  const donor = await createStage10ProductRuntime({ projectId: sourceId, persistencePort: donorPort });
  for (const [command, payload] of [['project.create', { sceneId }], ['project.applyTextEdit', { sceneId, text: await fs.readFile(path.join(source, 'scene.txt'), 'utf8') }]]) {
    assert.equal((await donor.dispatchVisibleCommand(command, { projectId: sourceId, ...payload }, activation)).ok, true);
  }
  const beforeText = await fs.readFile(manifestPath, 'utf8');
  const recorded = await donor.dispatchVisibleCommand('atlas.entity.create', { projectId: sourceId, entityId: 'copy-entity', name: 'Ёж' }, activation, {
    canonicalProjectTruth: { projectId: sourceId, sourceHash: sha(beforeText), sourceRevision: 0, coreState: donor.getSession().coreState,
      prepareMutation({ nextCoreState }) {
        const nextText = JSON.stringify({ ...JSON.parse(beforeText), atlas: nextCoreState.data.projects[sourceId].atlas, lastCommandId: nextCoreState.data.lastCommandId });
        return { schemaVersion: 'yalken.stage10.projectTruthMutation.v1', projectId: sourceId, relativePath: 'project.craftsman.json', previousText: beforeText, nextText, previousHash: sha(beforeText), nextHash: sha(nextText) };
      } },
  });
  assert.equal(recorded.ok, true, JSON.stringify(recorded.error));
  await fs.cp(source, copy, { recursive: true });
  const manifest = path.join(copy, 'project.craftsman.json');
  await fs.writeFile(manifest, JSON.stringify({ ...JSON.parse(await fs.readFile(manifest)), projectId: copyId, copiedFromProjectId: sourceId }));
  const originals = Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(path.join(source, relative(name)))])));
  const intent = { sourceProjectId: sourceId, projectId: copyId, manifestSha256: sha(await fs.readFile(manifest)),
    files: names.map(name => ({ name, relativePath: relative(name), bytes: originals[name].length, sha256: sha(originals[name]) })) };
  let allowed = true, kill = '';
  const makePort = (extra = {}) => createStage10MainPersistenceAdapter({ projectRoot: copy, anchorRoot: anchors,
    importCopyIntent: intent, revalidateImportCopy: async () => allowed,
    onKillpoint(name) { if (name === kill) { kill = ''; throw Error('INTERRUPTED_' + name); } }, ...extra });
  const ordinary = () => createStage10MainPersistenceAdapter({ projectRoot: copy, anchorRoot: anchors });
  const raw = async () => Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(path.join(copy, relative(name)))])));
  const carrier = async () => {
    const parent = path.join(copy, '.stage10-local/recovery/import-copy-source');
    const dirs = await fs.readdir(parent); assert.equal(dirs.length, 1);
    const target = path.join(parent, dirs[0]), index = JSON.parse(await fs.readFile(path.join(target, 'provenance.v1.json')));
    assert.equal(index.role, 'HISTORICAL_ONLY'); assert.equal(index.sourceProjectId, sourceId); assert.equal(index.projectId, copyId);
    for (const name of names) assert.deepEqual(await fs.readFile(path.join(target, name)), originals[name]);
    assert.deepEqual([index.denominator.events, index.denominator.uiEvents, index.denominator.receipts], [3, 3, 3]);
    return target;
  };
  return { root, source, copy, sourceId, copyId, sceneId, manifest, intent, originals, raw, carrier, makePort, ordinary,
    deny: () => { allowed = false; }, kill: name => { kill = name; } };
}

async function initialize(f, port = f.makePort()) {
  const bootstrap = createStage10ApplicationBootstrap({ persistencePort: port });
  const state = await port.readStage10State(f.copyId);
  const result = !state || state.importCopyNeedsProjectCreate
    ? await bootstrap.createProjectRuntime({ projectId: f.copyId })
    : await bootstrap.reopenProjectRuntime({ projectId: f.copyId });
  assert.equal(result.ok, true); return { bootstrap, port };
}

test('COPY private intent preserves exact donor pair/latest and creates ordinary independently replayable copy state', async t => {
  const f = await fixture(t), sourceBefore = await Promise.all(names.map(name => fs.readFile(path.join(f.source, relative(name)))));
  await assert.rejects(() => f.ordinary().readStage10State(f.copyId), error => error.code === 'E_STAGE10_PERSISTENCE_SPLIT_STATE');
  const { bootstrap, port } = await initialize(f);
  await f.carrier(); assert.equal(bootstrap.getRuntime().getSession().projectId, f.copyId);
  assert.equal(bootstrap.getRuntime().getSession().eventLog.events.length, 1);
  const reopened = await reopenStage10ProductRuntime({ projectId: f.copyId, persistencePort: f.ordinary() });
  assert.deepEqual(reopened.getSession(), bootstrap.getRuntime().getSession());
  const before = await port.readStage10State(f.copyId), manifestBefore = await fs.readFile(f.manifest);
  const denied = await bootstrap.dispatchProjectCommand('atlas.continuityFact.record', { projectId: f.copyId, sceneId: 'absent' });
  assert.equal(denied.ok, false); assert.deepEqual(await port.readStage10State(f.copyId), before);
  assert.deepEqual(await fs.readFile(f.manifest), manifestBefore); await f.carrier();
  assert.deepEqual(await Promise.all(names.map(name => fs.readFile(path.join(f.source, relative(name))))), sourceBefore);
});

test('COPY preserves genuine history above the native 8MiB file bound without delegating historical files to that publisher', async t => {
  const f = await fixture(t, { largeHistory: true }), calls = [];
  assert.ok(f.originals[names[0]].length > 8 * 1024 * 1024 && f.originals[names[0]].length <= 32 * 1024 * 1024);
  if (process.platform === 'darwin') createRequire(import.meta.url)('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative();
  const publish = process.platform === 'darwin' ? archivePublication.createDarwinExclusiveFilePublisher()
    : async request => { await request.assertCurrent(); await fs.copyFile(request.sourcePath, request.targetPath, fs.constants.COPYFILE_EXCL); };
  const port = f.makePort({ async publishFileExclusive(request) { calls.push(path.basename(request.targetPath)); return publish(request); } });
  const { bootstrap } = await initialize(f, port); await f.carrier();
  assert.equal(calls.includes('import-copy-intent.v1.json'), true); assert.equal(calls.includes('provenance.v1.json'), true);
  assert.equal(calls.some(name => names.includes(name)), false, 'Historical raw files use their explicit existing hard-link primitive');
  assert.equal((await bootstrap.dispatchProjectCommand('atlas.entity.create', { projectId: f.copyId, entityId: 'large-copy-owned', name: 'Новый автор' })).ok, true);
  const reopened = await reopenStage10ProductRuntime({ projectId: f.copyId, persistencePort: f.ordinary() });
  assert.deepEqual(reopened.getSession(), bootstrap.getRuntime().getSession()); assert.equal(reopened.getSession().eventLog.events.length, 2);
  await f.carrier();
  t.diagnostic(JSON.stringify({ historicalSessionBytes: f.originals[names[0]].length, activeEvents: 2, publisherCalls: calls }));
});

for (const point of ['before-import-copy-source-link', 'after-import-copy-source-link']) test('COPY hard-link interruption retains exact source and ordinarily recovers: ' + point, async t => {
  const f = await fixture(t), before = await f.raw(); f.kill(point);
  await assert.rejects(() => initialize(f), error => String(error).includes('INTERRUPTED_') || JSON.stringify(error).includes('INTERRUPTED_'));
  assert.deepEqual(await f.raw(), before);
  await initialize(f, f.ordinary()); const carrier = await f.carrier();
  for (const name of names) assert.equal((await fs.lstat(path.join(carrier, name))).nlink, 1);
  assert.deepEqual((await fs.readdir(carrier)).sort(), [...names, 'provenance.v1.json'].sort());
  assert.equal((await reopenStage10ProductRuntime({ projectId: f.copyId, persistencePort: f.ordinary() })).getSession().eventLog.events.length, 1);
});

for (const kind of ['mismatched-temp', 'third-link', 'stale-owner', 'unknown-temp', 'target-collision']) test('COPY bounded staged-link recovery refuses and preserves ' + kind, async t => {
  const f = await fixture(t), before = await f.raw();
  const carrier = path.join(f.copy, '.stage10-local/recovery/import-copy-source', hashCanonicalValue(f.intent.files.slice(0, 2)));
  const staged = path.join(carrier, `.import-copy-source-${f.intent.files[0].sha256}.tmp`), target = path.join(carrier, names[0]);
  f.kill(kind === 'third-link' || kind === 'stale-owner' ? 'after-import-copy-source-link' : 'before-import-copy-source-link');
  await assert.rejects(() => initialize(f));
  let protectedPath = staged, expected = f.originals[names[0]];
  if (kind === 'mismatched-temp') { await fs.rename(staged, path.join(f.root, 'original-staged-bytes')); expected = Buffer.from('FOREIGN_TEMP'); await fs.writeFile(staged, expected); }
  if (kind === 'third-link') { protectedPath = path.join(f.root, 'foreign-third-link'); await fs.link(staged, protectedPath); }
  if (kind === 'unknown-temp') { protectedPath = path.join(carrier, '.import-copy-source-unknown.tmp'); expected = Buffer.from('UNKNOWN_TEMP'); await fs.writeFile(protectedPath, expected); }
  if (kind === 'target-collision') { protectedPath = target; expected = Buffer.from('FOREIGN_EXCLUSIVE_TARGET'); await fs.writeFile(target, expected); }
  const metadata = await fs.lstat(protectedPath);
  const retry = kind === 'stale-owner' ? f.makePort({ onKillpoint(name) { if (name === 'before-import-copy-source-publish') f.deny(); } }) : f.ordinary();
  await assert.rejects(() => initialize(f, retry));
  assert.deepEqual(await f.raw(), before); assert.deepEqual(await fs.readFile(protectedPath), expected);
  const after = await fs.lstat(protectedPath); assert.equal(after.ino, metadata.ino); assert.equal(after.mode, metadata.mode);
  assert.equal(after.nlink, metadata.nlink);
  if (kind === 'third-link' || kind === 'stale-owner') assert.equal((await fs.lstat(target)).ino, (await fs.lstat(staged)).ino);
});

for (const point of ['import-copy-intent-written', ...names.map(name => 'import-copy-source-preserved:' + name),
  'import-copy-provenance-written', 'import-copy-authority-retired', 'import-copy-session-retired',
  'after-transaction-write', 'after-authority-write', 'after-session-write', 'after-anchor-write', 'import-copy-complete']) {
  test('COPY interruption and ordinary same-intent recovery: ' + point, async t => {
    const f = await fixture(t); f.kill(point);
    await assert.rejects(() => initialize(f), error => JSON.stringify(error).includes('INTERRUPTED_') || String(error).includes('INTERRUPTED_'));
    // Cold recovery has no live imported-data intent. Only the exact durable
    // Main-owned intent or normal transaction may authorize completion.
    await initialize(f, f.ordinary()); await f.carrier();
    const reopened = await reopenStage10ProductRuntime({ projectId: f.copyId, persistencePort: f.ordinary() });
    assert.equal(reopened.getSession().projectId, f.copyId);
    assert.equal(reopened.getSession().eventLog.events.length, 1);
  });
}

test('COPY completed same-intent retry is read-only and never appends another project.create', async t => {
  const f = await fixture(t); await initialize(f);
  const before = await f.ordinary().readStage10State(f.copyId);
  await initialize(f); await f.carrier();
  assert.deepEqual(await f.ordinary().readStage10State(f.copyId), before);
});

for (const kind of ['traversal', 'duplicate-file', 'length', 'digest', 'foreign-source', 'schema', 'denominator', 'extra-key', 'duplicate-json-key']) {
  test('COPY cold intent validates structure even with a recomputed self hash: ' + kind, async t => {
    const f = await fixture(t); f.kill('import-copy-intent-written');
    await assert.rejects(() => initialize(f));
    const file = path.join(f.ordinary().paths(f.copyId).anchorRoot, 'import-copy-intent.v1.json');
    const value = JSON.parse(await fs.readFile(file));
    if (kind === 'traversal') value.binding.files[0].relativePath = '../../foreign';
    if (kind === 'duplicate-file') value.binding.files[1] = value.binding.files[0];
    if (kind === 'length') value.binding.files[0].bytes = -1;
    if (kind === 'digest') value.binding.files[0].sha256 = 'NOT_A_DIGEST';
    if (kind === 'foreign-source') value.binding.sourceProjectId = value.sourceProjectId = 'foreign-project';
    if (kind === 'schema') value.schemaVersion = 'untrusted.schema';
    if (kind === 'denominator') value.denominator.events += 1;
    if (kind === 'extra-key') value.untrustedPath = '../../foreign';
    delete value.intentDigest; value.intentDigest = hashCanonicalValue(value);
    let raw = JSON.stringify(value, null, 2) + '\n';
    if (kind === 'duplicate-json-key') raw = raw.replace('"schemaVersion":', '"schemaVersion": "yalken.stage10.importCopyIntent.v1",\n  "schemaVersion":');
    await fs.writeFile(file, raw);
    const before = await f.raw();
    await assert.rejects(() => initialize(f, f.ordinary()), error => error.code === 'E_STAGE10_IMPORT_COPY_INVALID');
    assert.deepEqual(await f.raw(), before);
  });
}

for (const point of ['before-import-copy-intent-publish', 'before-import-copy-carrier-publish',
  'before-import-copy-source-publish', 'before-import-copy-source-freeze', 'before-import-copy-carrier-freeze']) {
  test('COPY revalidates private capability at actual publication: ' + point, async t => {
    const f = await fixture(t); let reached = false;
    const port = f.makePort({ onKillpoint(name) { if (name === point) { reached = true; f.deny(); } } });
    const before = await f.raw();
    await assert.rejects(() => initialize(f, port), error => error.code === 'E_STAGE10_IMPORT_COPY_INVALID');
    assert.equal(reached, true); assert.deepEqual(await f.raw(), before);
    if (point === 'before-import-copy-intent-publish') {
      await assert.rejects(fs.lstat(path.join(port.paths(f.copyId).anchorRoot, 'import-copy-intent.v1.json')), { code: 'ENOENT' });
      await assert.rejects(() => f.ordinary().readStage10State(f.copyId), error => error.code === 'E_STAGE10_PERSISTENCE_SPLIT_STATE');
    }
  });
}

test('COPY lost lease at intent publication preserves foreign lease and cannot mint cold authority', async t => {
  const f = await fixture(t); let foreign, ownerFile;
  const port = f.makePort({ async onKillpoint(name) {
    if (name !== 'before-import-copy-intent-publish') return;
    ownerFile = path.join(port.paths(f.copyId).anchorRoot, 'project-transaction.lease', 'owner.v3.json');
    const record = JSON.parse(await fs.readFile(ownerFile)); record.ownerToken = 'foreign-test-owner'; record.ownerTokenDigest = sha(record.ownerToken);
    foreign = Buffer.from(JSON.stringify(record)); await fs.writeFile(ownerFile, foreign);
  } });
  const before = await f.raw(); await assert.rejects(() => initialize(f, port));
  assert.ok(foreign); assert.deepEqual(await fs.readFile(ownerFile), foreign); assert.deepEqual(await f.raw(), before);
  await assert.rejects(fs.lstat(path.join(port.paths(f.copyId).anchorRoot, 'import-copy-intent.v1.json')), { code: 'ENOENT' });
});

test('COPY no-follow source read cohort rejects an actual swap during FD reading', async t => {
  const f = await fixture(t), target = path.join(f.copy, relative(names[0])), held = path.join(f.root, 'raced-original-session');
  const open = fs.open; let swapped = false;
  fs.open = async function(file, ...args) {
    const handle = await open.call(this, file, ...args);
    if (file === target && typeof args[0] === 'number' && !swapped) {
      const read = handle.read.bind(handle);
      handle.read = async (...input) => {
        const result = await read(...input);
        if (!swapped) { swapped = true; await fs.rename(target, held); await fs.writeFile(target, 'FOREIGN_SESSION'); }
        return result;
      };
    }
    return handle;
  };
  try { await assert.rejects(() => initialize(f), error => error.code === 'E_STAGE10_IMPORT_COPY_INVALID'); }
  finally { fs.open = open; }
  assert.equal(swapped, true); assert.deepEqual(await fs.readFile(held), f.originals[names[0]]);
  assert.equal(await fs.readFile(target, 'utf8'), 'FOREIGN_SESSION');
});

test('COPY retirement holds a source FD cohort and preserves a last-instant foreign replacement', async t => {
  const f = await fixture(t), target = path.join(f.copy, relative(names[1])), held = path.join(f.root, 'raced-original-authority');
  let swapped = false;
  const port = f.makePort({ async onKillpoint(name) {
    if (name === 'before-import-copy-authority-retired' && !swapped) {
      swapped = true; await fs.rename(target, held); await fs.writeFile(target, 'FOREIGN_AUTHORITY');
    }
  } });
  await assert.rejects(() => initialize(f, port), error => error.code === 'E_STAGE10_IMPORT_COPY_INVALID');
  assert.equal(swapped, true); assert.deepEqual(await fs.readFile(held), f.originals[names[1]]);
  assert.equal(await fs.readFile(target, 'utf8'), 'FOREIGN_AUTHORITY');
  assert.deepEqual(await fs.readFile(path.join(f.copy, relative(names[0]))), f.originals[names[0]]); await f.carrier();
});

for (const kind of ['capability', 'foreign-intent']) test('COPY final intent retirement revalidates after the last raw-read await: ' + kind, async t => {
  const f = await fixture(t), ordinary = f.ordinary(), paths = ordinary.paths(f.copyId);
  const target = path.join(paths.anchorRoot, 'import-copy-intent.v1.json'), held = path.join(f.root, 'retained-original-intent');
  const open = fs.open, lstat = fs.lstat; let armed = false, readingIntent = false, reached = false, expected;
  const port = f.makePort({ async onKillpoint(name) {
    if (name === 'after-anchor-write') {
      const session = JSON.parse(await fs.readFile(paths.session));
      armed = !!session.coreState.data.projects[f.copyId];
    }
  } });
  fs.open = async function(file, ...args) {
    const handle = await open.call(this, file, ...args);
    if (file === target && armed) readingIntent = true;
    return handle;
  };
  fs.lstat = async function(file, ...args) {
    const stat = await lstat.call(this, file, ...args);
    if (file === paths.anchorRoot && armed && readingIntent && !reached) {
      reached = true; armed = false;
      expected = await fs.readFile(target);
      if (kind === 'capability') f.deny();
      else { await fs.rename(target, held); expected = Buffer.from('FOREIGN_INTENT_MUST_SURVIVE'); await fs.writeFile(target, expected); }
    }
    return stat;
  };
  let outcome;
  try { outcome = await initialize(f, port).then(() => ({ ok: true }), error => ({ ok: false, error })); }
  finally { fs.open = open; fs.lstat = lstat; }
  assert.equal(reached, true);
  assert.deepEqual(await fs.readFile(target), expected, 'Changed owner or replacement intent must survive final retirement');
  assert.equal(outcome.ok, false); assert.equal(outcome.error.code, 'E_STAGE10_IMPORT_COPY_INVALID');
  if (kind === 'foreign-intent') assert.equal(JSON.parse(await fs.readFile(held)).projectId, f.copyId);
  await f.carrier();
});

for (const kind of ['source', 'carrier']) test('COPY no-follow freeze preserves a late foreign symlink target bytes and mode: ' + kind, async t => {
  const f = await fixture(t), carrier = path.join(f.copy, '.stage10-local/recovery/import-copy-source', hashCanonicalValue(f.intent.files.slice(0, 2)));
  const foreign = path.join(f.root, 'foreign-freeze-target'), held = path.join(f.root, 'retained-freeze-original');
  const target = kind === 'source' ? path.join(carrier, names[0]) : carrier;
  if (kind === 'carrier') { await fs.mkdir(foreign, { mode: 0o700 }); await fs.writeFile(path.join(foreign, 'payload'), 'FOREIGN_BYTES'); }
  else await fs.writeFile(foreign, 'FOREIGN_BYTES', { mode: 0o600 });
  const contentPath = kind === 'carrier' ? path.join(foreign, 'payload') : foreign;
  const before = await f.raw(), bytes = await fs.readFile(contentPath), mode = (await fs.stat(foreign)).mode;
  let reached = false;
  const port = f.makePort({ async onKillpoint(name) {
    if (name === 'before-import-copy-' + kind + '-freeze' && !reached) {
      reached = true; await fs.rename(target, held); await fs.symlink(foreign, target);
    }
  } });
  const outcome = await initialize(f, port).then(() => ({ ok: true }), error => ({ ok: false, error }));
  assert.equal(reached, true); assert.deepEqual(await fs.readFile(contentPath), bytes);
  assert.equal((await fs.stat(foreign)).mode, mode, 'Foreign target mode must remain exact');
  assert.equal(outcome.ok, false); assert.deepEqual(await f.raw(), before);
  assert.equal(await fs.readlink(target), foreign);
  assert.deepEqual(await fs.readFile(kind === 'source' ? held : path.join(held, names[0])), f.originals[names[0]]);
});

test('COPY staging creation rejects a replaced carrier parent at the actual publication boundary', async t => {
  const f = await fixture(t), carrier = path.join(f.copy, '.stage10-local/recovery/import-copy-source', hashCanonicalValue(f.intent.files.slice(0, 2)));
  const held = path.join(f.root, 'retained-stage-parent'); let reached = false, mode;
  const before = await f.raw();
  const port = f.makePort({ async onKillpoint(name) {
    if (name === 'before-import-copy-source-publish-stage' && !reached) {
      reached = true; await fs.rename(carrier, held); await fs.mkdir(carrier, { mode: 0o700 }); mode = (await fs.stat(carrier)).mode;
    }
  } });
  const outcome = await initialize(f, port).then(() => ({ ok: true }), error => ({ ok: false, error }));
  assert.equal(reached, true); assert.deepEqual(await fs.readdir(carrier), [], 'Replacement parent must receive no staging or publication');
  assert.equal((await fs.stat(carrier)).mode, mode); assert.equal(outcome.ok, false); assert.deepEqual(await f.raw(), before);
});

test('COPY final exclusive publication rechecks its held staging source after asynchronous authority validation', async t => {
  const f = await fixture(t), carrier = path.join(f.copy, '.stage10-local/recovery/import-copy-source', hashCanonicalValue(f.intent.files.slice(0, 2)));
  const held = path.join(f.root, 'retained-staged-source'), open = fs.open; let armed = false, staged, swapped = false;
  const before = await f.raw();
  fs.open = async function(file, ...args) {
    const handle = await open.call(this, file, ...args);
    if (armed && path.dirname(String(file)) === carrier && path.basename(String(file)).startsWith('.import-copy-') && typeof args[0] === 'number') staged = file;
    return handle;
  };
  const port = f.makePort({ onKillpoint(name) { if (name === 'before-import-copy-source-publish') armed = true; },
    async revalidateImportCopy() {
      if (staged && !swapped) { swapped = true; await fs.rename(staged, held); await fs.writeFile(staged, 'FOREIGN_STAGED_SOURCE'); }
      return true;
    } });
  let outcome;
  try { outcome = await initialize(f, port).then(() => ({ ok: true }), error => ({ ok: false, error })); }
  finally { fs.open = open; }
  assert.equal(swapped, true); await assert.rejects(fs.lstat(path.join(carrier, names[0])), { code: 'ENOENT' });
  assert.equal(outcome.ok, false); assert.deepEqual(await f.raw(), before); assert.deepEqual(await fs.readFile(held), f.originals[names[0]]);
  assert.equal(await fs.readFile(staged, 'utf8'), 'FOREIGN_STAGED_SOURCE');
});

for (const kind of ['capability', 'manifest-drift', 'foreign-pair', 'session-symlink', 'authority-hardlink', 'carrier-collision']) {
  test('COPY refuses without retiring donor data: ' + kind, async t => {
    const f = await fixture(t);
    if (kind === 'capability') f.deny();
    if (kind === 'manifest-drift') await fs.appendFile(f.manifest, ' ');
    if (kind === 'foreign-pair') f.intent.sourceProjectId = 'foreign-project';
    if (kind === 'session-symlink') {
      const file = path.join(f.copy, relative(names[0])), held = path.join(f.root, 'foreign-session');
      await fs.rename(file, held); await fs.symlink(held, file);
    }
    if (kind === 'authority-hardlink') await fs.link(path.join(f.copy, relative(names[1])), path.join(f.root, 'foreign-authority-link'));
    if (kind === 'carrier-collision') {
      await fs.mkdir(path.join(f.copy, '.stage10-local/recovery/import-copy-source'), { recursive: true });
      await fs.writeFile(path.join(f.copy, '.stage10-local/recovery/import-copy-source', 'foreign'), 'PRESERVE');
    }
    const before = await f.raw();
    await assert.rejects(() => initialize(f), error => error.code === 'E_STAGE10_IMPORT_COPY_INVALID');
    assert.deepEqual(await f.raw(), before);
  });
}

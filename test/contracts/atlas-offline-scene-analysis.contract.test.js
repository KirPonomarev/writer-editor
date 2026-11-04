'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const profiles = require('../../src/core/writer-local-profile-v1.cjs');
const ROOT = path.resolve(__dirname, '../..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const load = file => import(pathToFileURL(path.join(ROOT, file)).href);

// Execute the maintained Main handler, with real Core-built source, the actual
// dossier derivation and actual profile law. Only host I/O/context/engine effects
// are substituted. This is source evidence; actual packaged inference is separate.
async function mainSceneHarness({ language = 'en-US', tag = true, mixed = false } = {}) {
  const runtime = await load('src/core/runtime.mjs');
  const dossier = await load('src/derived/atlas/deriveAtlasCurrentSceneDossier.mjs');
  const projectId = 'offline-analysis-project', sceneId = 'offline-analysis-scene';
  const text = 'Anna told Mira she would return to London. 🧭 Cafe\u0301';
  const commands = [
    { type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId, title: 'Analysis', sceneId } },
    { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId, text } },
  ];
  if (tag) commands.push({ type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { projectId, sceneId, scopeKind: 'scene', languageCode: language } });
  if (mixed) commands.push({ type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { projectId, sceneId, scopeKind: 'range', languageCode: 'ja', startOffset: 0, endOffset: 4 } });
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), commands);
  assert.equal(built.ok, true);
  const state = JSON.parse(JSON.stringify(built.state));
  const project = state.data.projects[projectId];
  project.manifestRevision = 'sha256:' + hash(JSON.stringify(project));
  project.scenes[sceneId].sceneRevision = 'sha256:' + hash(text);
  const before = JSON.stringify(state), calls = [], logs = [];
  let release = null, startedResolve;
  const started = new Promise(resolve => { startedResolve = resolve; });
  const model = { analyze: async (input, options = {}) => {
    calls.push({ input, options }); startedResolve();
    if (release) await release;
    await options.assertCurrent?.();
    return { schemaVersion: 'derived.atlas.localLanguageAnalysis.v1', state: 'experimental',
      projectId, sceneId, sourceRevision: input.sourceRevision, sourceTextHash: hash(text),
      generation: input.generation, languageCode: input.languageCode,
      certified: false, experimental: true, releaseTrust: false,
      tokens: [{ text: 'Anna', lemma: 'Anna', pos: 'PROPN', morph: '', dependency: 'nsubj', headIndex: 1, utf16Start: 0, utf16End: 4 }],
      entities: [{ text: 'Anna', label: 'PERSON', utf16Start: 0, utf16End: 4 }],
      unavailableSignals: ['constrainedCoreference', 'dialogue', 'eventExtraction', 'roles', 'relationProposals'] };
  } };
  const ctx = {
    console, Buffer, AbortController, URL, path, crypto,
    isPlainObjectValue: value => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    normalizeAtlasCurrentScenePayload: value => ({ projectId: value.projectId || '', nodeId: value.nodeId || '', analyzeLanguage: value.analyzeLanguage === true }),
    loadAtlasCurrentSceneDossierModule: async () => dossier,
    resolveProjectTreeNodeIdentity: async (nodeId, requestedProject) => {
      assert.equal(nodeId, sceneId); assert.equal(requestedProject, projectId);
      return { projectId, nodeId: sceneId, projectRoot: '/owned/project', manifestPath: '/owned/project/project.json',
        manifestRaw: JSON.stringify(project), manifest: { atlas: project.atlas } };
    },
    getResolvedTreeDocumentTarget: () => ({ filePath: '/owned/project/scene.json', kind: 'roman-scene' }),
    buildAtlasCurrentSceneCoreState: async () => ({ coreState: state, sceneTitle: 'Saved scene', atlasAuthorReadIssue: '' }),
    ROMAN_CONTEXT_KINDS: new Set(['roman-scene']),
    makeAtlasCurrentSceneFallback: (pid, sid, reason) => ({ projectId: pid, sceneId: sid, state: reason ? 'unavailable' : 'empty', unavailableReason: reason }),
    logDevError: (...args) => logs.push(args),
    mainWindow: { isDestroyed: () => false, webContents: { isDestroyed: () => false } },
    activeStage10ApplicationBootstrap: { getProjectId: () => projectId, getRuntime: () => ({}) },
    getProjectRootPath: () => '/owned/project',
    currentFilePath: '/owned/project/scene.json', currentProjectName: 'Analysis',
    app: { isPackaged: true, getPath: () => '/owned/profile' }, process: { platform: 'darwin', arch: 'arm64' },
    commentAuthoringSessionId: 'owned-author-session', lastSignaledEditGeneration: 7, isDirty: false,
    currentLifecycleSubjectId: () => 'document:' + hash(ctx.currentFilePath),
    getWriterLocalRuntimeProfile: () => profiles.createWriterSceneLanguageTagProfileProjection({ isPackaged: true, platform: 'darwin' }),
    evaluateWriterLocalQueryAccess: profiles.evaluateWriterLocalQueryAccess,
    ATLAS_CURRENT_SCENE_QUERY_ID: 'query.atlasCurrentScene',
    readAtlasAnalyticsSourceRecord: async () => ({ projectId, sourceRevision: ctx.liveSourceRevision }),
    getAtlasLanguageAnalysisPort: () => model,
    sanitizePathFieldsWithinRoot: value => ({ ok: true, payload: value }),
    computeHash: hash, liveSourceRevision: hash('whole-saved-project'),
  };
  const source = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const from = source.indexOf('async function handleWorkspaceAtlasCurrentSceneQuery(');
  const to = source.indexOf('\nfunction makeHistoryCheckpointError(', from);
  assert.ok(from > 0 && to > from, 'actual Main handler source boundaries');
  const context = vm.createContext(ctx);
  vm.runInContext(source.slice(from, to) + '\nthis.actualQuery = handleWorkspaceAtlasCurrentSceneQuery;', context);
  const query = (payload = {}, options = {}) => context.actualQuery({ projectId, nodeId: sceneId, ...payload },
    { signal: new AbortController().signal, jobId: 'atlas-owned-job-1', sourceRevision: ctx.liveSourceRevision, ...options });
  return { query, context, state, before, calls, logs, projectId, sceneId, text, started,
    defer() { let resolve; release = new Promise(done => { resolve = done; }); return resolve; },
    assertNoMutation() { assert.equal(JSON.stringify(state), before); } };
}

test('offline scene: ordinary saved-scene refresh never invokes the language engine', async () => {
  const h = await mainSceneHarness();
  const result = await h.query();
  assert.equal(result.ok, true);
  assert.equal(h.calls.length, 0);
  h.assertNoMutation();
});

test('offline scene: explicit current saved-scene intent reaches the engine and returns honest source-bound signals', async () => {
  const h = await mainSceneHarness();
  const result = await h.query({ analyzeLanguage: true });
  assert.equal(h.calls.length, 1, 'an explicit request must reach the effect port, not silently return only exact-term results');
  assert.equal(result.ok, true);
  const value = result.atlasCurrentScene.languageAnalysis;
  assert.equal(value.state, 'experimental');
  assert.equal(value.certified, false);
  assert.equal(value.releaseTrust, false);
  assert.equal(value.sourceTextHash, hash(h.text));
  assert.equal(value.generation, 'atlas-owned-job-1');
  assert.equal(value.entities[0].text, 'Anna');
  assert.equal(h.calls[0].input.languageCode, 'en');
  assert.equal(h.calls[0].input.text, h.text);
  assert.equal(typeof h.calls[0].options.assertCurrent, 'function');
  h.assertNoMutation();
});

for (const [label, options] of [['no authored language', { tag: false }], ['unsupported authored language', { language: 'ja-JP' }], ['mixed authored range', { mixed: true }]]) {
  test('offline scene: ' + label + ' gives typed unavailability without English fallback or execution', async () => {
    const h = await mainSceneHarness(options);
    const result = await h.query({ analyzeLanguage: true });
    assert.equal(h.calls.length, 0);
    assert.equal(result.ok, true);
    assert.equal(result.atlasCurrentScene.languageAnalysis?.state, 'unavailable');
    assert.match(result.atlasCurrentScene.languageAnalysis.reason, /^E_ATLAS_LANGUAGE_/u);
    h.assertNoMutation();
  });
}

for (const [label, mutate] of [
  ['unsaved text', ctx => { ctx.isDirty = true; }],
  ['different opened scene', ctx => { ctx.currentFilePath = '/owned/project/other.json'; }],
  ['profile revocation', ctx => { ctx.getWriterLocalRuntimeProfile = () => profiles.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' }); }],
]) {
  test('offline scene: ' + label + ' refuses the explicit request before any model effect', async () => {
    const h = await mainSceneHarness(); mutate(h.context);
    const result = await h.query({ analyzeLanguage: true });
    assert.equal(h.calls.length, 0);
    assert.equal(result.ok, false);
    h.assertNoMutation();
  });
}

test('offline scene: renderer model/path/language hints cannot change the saved-source route', async () => {
  const h = await mainSceneHarness();
  const result = await h.query({ analyzeLanguage: true, languageCode: 'en', modelPath: '/foreign/evil', text: 'Different source' });
  assert.equal(result.ok, false);
  assert.equal(h.calls.length, 0);
  h.assertNoMutation();
});

for (const [label, mutate] of [
  ['new authoring generation', ctx => { ctx.lastSignaledEditGeneration += 1; }],
  ['new project source revision', ctx => { ctx.liveSourceRevision = hash('changed-project-source'); }],
  ['replaced Stage10 owner', ctx => { ctx.activeStage10ApplicationBootstrap = { getProjectId: () => 'other-project' }; }],
]) {
  test('offline scene: ' + label + ' during the awaited model job discards every result', async () => {
    const h = await mainSceneHarness(), resume = h.defer();
    const pending = h.query({ analyzeLanguage: true });
    const phase = await Promise.race([h.started.then(() => 'started'), pending.then(() => 'returned-without-engine')]);
    assert.equal(phase, 'started', 'actual Main must first execute the port path');
    mutate(h.context); resume();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.atlasCurrentScene?.languageAnalysis?.entities?.length || 0, 0);
    h.assertNoMutation();
  });
}

const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

function resourceFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-language-port-'));
  const entries = [];
  for (const [relative, text, mode] of [['python/bin/python3.14', 'owned-fixed-interpreter', 0o555], ['site/model.bin', 'owned-fixed-model', 0o444]]) {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text); fs.chmodSync(file, mode);
    entries.push({ path: relative, kind: 'file', byteLength: Buffer.byteLength(text), sha256: hash(text), mode });
  }
  const catalog = { schemaVersion: 'atlas.languageResourceCatalog.v1', platform: 'darwin', arch: 'arm64',
    pythonVersion: '3.14.10', engineVersion: '3.8.18', modelVersions: { en: '3.8.0', ru: '3.8.0' }, entries };
  const worker = '# owned fixed worker protocol fixture; never executed\n';
  fs.writeFileSync(path.join(root, 'worker.py'), worker); fs.chmodSync(path.join(root, 'worker.py'), 0o444);
  const bytes = Buffer.from(JSON.stringify(catalog, null, 2) + '\n'); fs.writeFileSync(path.join(root, 'catalog.json'), bytes);
  return { root, catalog, bytes, worker, expectedCatalogSha256: hash(bytes), expectedWorkerSha256: hash(worker) };
}

function processFixture({ transform = value => value, hold = false, ignoreKill = false, raw = null, exitCode = 0 } = {}) {
  const calls = [], children = [];
  function spawnProcess(executable, argv, options) {
    calls.push({ executable, argv, options });
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.pid = 12345 + children.length; child.exitCode = null; child.kills = []; children.push(child);
    child.finish = code => { if (child.exitCode !== null) return; child.exitCode = code; child.emit('exit', code, null); child.stdout.end(); child.stderr.end(); child.emit('close', code, null); };
    child.kill = signal => { child.kills.push(signal); if (!ignoreKill) queueMicrotask(() => child.finish(null)); return true; };
    let input = '';
    child.stdin.on('data', chunk => { input += chunk.toString(); });
    child.stdin.on('finish', () => queueMicrotask(() => {
      const packet = JSON.parse(input);
      const value = { protocolVersion: 1, nonce: packet.nonce, resourceCatalogSha256: packet.resourceCatalogSha256,
        identity: Object.fromEntries(['projectId', 'sceneId', 'sourceRevision', 'sourceTextHash', 'generation', 'languageCode'].map(key => [key, packet[key]])),
        tokens: [{ text: 'Anna', lemma: 'Anna', pos: 'PROPN', morph: '', dependency: 'ROOT', headIndex: 0, utf16Start: 0, utf16End: 4 }],
        entities: [{ text: 'Anna', label: 'PERSON', utf16Start: 0, utf16End: 4 }], elapsedMs: 1, maxRssBytes: 64000000 };
      child.reply = () => child.stdout.write(raw === null ? JSON.stringify(transform(value)) + '\n' : raw);
      if (!hold) { child.reply(); child.finish(exitCode); }
    }));
    return child;
  }
  return { spawnProcess, calls, children };
}

function portInput(overrides = {}) {
  const text = 'Anna waited. 🧭 Cafe\u0301';
  return { projectId: 'port-project', sceneId: 'port-scene', sourceRevision: 'sha256:' + hash('saved-source-bytes'),
    sourceTextHash: hash(text), generation: 'owned-job-1', languageCode: 'en', text, ...overrides };
}

function portFor(fixture, process, options = {}) {
  const { createAtlasLanguageAnalysisPort } = require('../../src/main/atlasLanguageAnalysisPort.cjs');
  return createAtlasLanguageAnalysisPort({ resourceRoot: fixture.root,
    expectedCatalogSha256: fixture.expectedCatalogSha256, expectedWorkerSha256: fixture.expectedWorkerSha256,
    platform: 'darwin', arch: 'arm64', spawnProcess: process.spawnProcess, ...options });
}

test('offline port: complete verified resources, source identity and a retired actual process are required before experimental publication', async () => {
  const f = resourceFixture(), child = processFixture(), port = portFor(f, child), input = portInput();
  const result = await port.analyze(input);
  assert.equal(result.state, 'experimental'); assert.equal(result.certified, false); assert.equal(result.releaseTrust, false);
  assert.equal(result.entities[0].text, input.text.slice(result.entities[0].utf16Start, result.entities[0].utf16End));
  assert.equal(result.sourceTextHash, input.sourceTextHash); assert.equal(child.children[0].exitCode, 0);
  assert.equal(child.calls.length, 1); assert.equal(child.calls[0].executable, '/usr/bin/sandbox-exec');
  assert.ok(child.calls[0].argv.includes('-I') && child.calls[0].argv.includes('-S') && child.calls[0].argv.includes('-B'));
  assert.equal(child.calls[0].options.shell, false);
  assert.equal(child.calls[0].options.env.PYTHONPATH, undefined); assert.equal(child.calls[0].options.env.DYLD_LIBRARY_PATH, undefined);
  assert.match(child.calls[0].argv.join(' '), /deny network/u);
  assert.match(child.calls[0].argv.join(' '), /deny file-write/u);
  assert.match(child.calls[0].argv.join(' '), /deny file-read/u);
});

for (const [name, input] of [
  ['renderer path authority', () => portInput({ modelPath: '/foreign/model' })],
  ['wrong text hash', () => portInput({ sourceTextHash: hash('foreign text') })],
  ['unsupported language', () => portInput({ languageCode: 'ja' })],
  ['isolated surrogate', () => portInput({ text: 'Anna\ud800', sourceTextHash: hash('Anna\ud800') })],
  ['oversized source', () => portInput({ text: 'x'.repeat(20001), sourceTextHash: hash('x'.repeat(20001)) })],
]) {
  test('offline port: reject ' + name + ' before resource or process effects', async () => {
    const f = resourceFixture(), child = processFixture(), port = portFor(f, child);
    await assert.rejects(port.analyze(input()), error => /^E_ATLAS_LANGUAGE_/u.test(error.code));
    assert.equal(child.calls.length, 0);
  });
}

for (const [name, mutate] of [
  ['catalog resealing', f => fs.appendFileSync(path.join(f.root, 'catalog.json'), ' ')],
  ['same-size changed model bytes', f => { const p = path.join(f.root, 'site/model.bin'); fs.chmodSync(p, 0o644); fs.writeFileSync(p, 'x'.repeat('owned-fixed-model'.length)); fs.chmodSync(p, 0o444); }],
  ['unlisted code', f => fs.writeFileSync(path.join(f.root, 'site/extra.py'), 'raise RuntimeError()')],
  ['model symlink escape', f => { const p = path.join(f.root, 'site/model.bin'); fs.unlinkSync(p); fs.symlinkSync('/dev/null', p); }],
  ['changed worker source', f => { const p = path.join(f.root, 'worker.py'); fs.chmodSync(p, 0o644); fs.writeFileSync(p, '# changed worker'); }],
]) {
  test('offline port: ' + name + ' fails before code execution', async () => {
    const f = resourceFixture(), child = processFixture(); mutate(f);
    await assert.rejects(portFor(f, child).analyze(portInput()), error => /^E_ATLAS_LANGUAGE_RESOURCE/u.test(error.code));
    assert.equal(child.calls.length, 0);
  });
}

for (const [name, transform] of [
  ['wrong nonce', value => ({ ...value, nonce: '0'.repeat(32) })],
  ['wrong source revision', value => ({ ...value, identity: { ...value.identity, sourceRevision: 'sha256:' + '0'.repeat(64) } })],
  ['forged certification field', value => ({ ...value, certified: true })],
  ['quote outside original coordinates', value => ({ ...value, entities: [{ text: 'Other', label: 'PERSON', utf16Start: 0, utf16End: 4 }] })],
  ['split Unicode surrogate', value => ({ ...value, entities: [{ text: '\ud83e', label: 'PERSON', utf16Start: 13, utf16End: 14 }] })],
  ['excess memory observation', value => ({ ...value, maxRssBytes: 1073741825 })],
]) {
  test('offline port: reject ' + name + ' from the retired worker', async () => {
    const f = resourceFixture(), child = processFixture({ transform });
    await assert.rejects(portFor(f, child).analyze(portInput()), error => /^E_ATLAS_LANGUAGE_/u.test(error.code));
    assert.equal(child.children[0].exitCode, 0);
  });
}

test('offline port: valid JSON cannot publish before retirement; cancellation rejects late output and a concurrent worker', async () => {
  const f = resourceFixture(), child = processFixture({ hold: true }), port = portFor(f, child), abort = new AbortController();
  const pending = port.analyze(portInput(), { signal: abort.signal });
  const rejected = assert.rejects(pending, { code: 'E_ATLAS_LANGUAGE_CANCELLED' });
  while (!child.children[0]?.reply) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(port.analyze(portInput()), { code: 'E_ATLAS_LANGUAGE_BUSY' });
  child.children[0].reply(); abort.abort(); await rejected;
  assert.equal(child.calls.length, 1); assert.ok(child.children[0].kills.length > 0);
});

test('offline port: a failed retirement permanently refuses another heavy worker', async () => {
  const f = resourceFixture(), child = processFixture({ hold: true, ignoreKill: true });
  const port = portFor(f, child, { timeoutMs: 10, retirementMs: 10 });
  await assert.rejects(port.analyze(portInput()), { code: 'E_ATLAS_LANGUAGE_RETIREMENT_FAILED' });
  await assert.rejects(port.analyze(portInput()), { code: 'E_ATLAS_LANGUAGE_RETIREMENT_FAILED' });
  assert.equal(child.calls.length, 1);
});

test('offline port: capability/source revocation during verified resource reads is rechecked before spawning', async () => {
  const f = resourceFixture(), child = processFixture(), port = portFor(f, child); let checks = 0;
  await assert.rejects(port.analyze(portInput(), { assertCurrent: () => { if (++checks > 1) throw Object.assign(Error('stale'), { code: 'E_CURRENT_SOURCE_REVOKED' }); } }), { code: 'E_CURRENT_SOURCE_REVOKED' });
  assert.equal(child.calls.length, 0);
});

test('offline port: unsupported platform is a refusal, not a hidden native dependency or English fallback', async () => {
  const f = resourceFixture(), child = processFixture(), port = portFor(f, child, { platform: 'linux' });
  await assert.rejects(port.analyze(portInput()), { code: 'E_ATLAS_LANGUAGE_PLATFORM_UNAVAILABLE' });
  assert.equal(child.calls.length, 0);
});

test('offline Main factory: packaged worker bytes and fixed packaged catalog define the lazy port', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const from = main.indexOf('let atlasLanguageAnalysisPort = null;');
  const to = main.indexOf('async function handleWorkspaceAtlasCurrentSceneQuery(', from);
  let options, count = 0;
  const ctx = vm.createContext({ path, fs: fs.promises, fsSync: fs, __dirname: path.join(ROOT, 'src'),
    computeHash: hash, process: { resourcesPath: '/owned/packaged/resources', env: { YALKEN_ATLAS_LANGUAGE_RESOURCES: '/foreign/resource' } },
    require: name => name.endsWith('atlasLanguageResourcesV1.json') ? require('../../src/main/atlasLanguageResourcesV1.json')
      : { createAtlasLanguageAnalysisPort: value => { options = value; count += 1; return { owned: true }; } } });
  vm.runInContext(main.slice(from, to) + '\nthis.factory = getAtlasLanguageAnalysisPort;', ctx);
  assert.equal(ctx.factory().owned, true); assert.equal(ctx.factory().owned, true); assert.equal(count, 1);
  assert.equal(options.resourceRoot, '/owned/packaged/resources/atlas-language');
  assert.equal(options.expectedCatalogSha256, require('../../src/main/atlasLanguageResourcesV1.json').catalogSha256);
  assert.equal(options.expectedWorkerSha256, hash(fs.readFileSync(path.join(ROOT, 'src/main/atlasLanguageAnalysisWorker.py'))));
});

test('offline port: a rejected concurrent request cannot replace the active retirement awaited by close', async () => {
  const f = resourceFixture(), child = processFixture({ hold: true, ignoreKill: true });
  const port = portFor(f, child), first = port.analyze(portInput());
  const rejected = assert.rejects(first, { code: 'E_ATLAS_LANGUAGE_CANCELLED' });
  while (!child.children[0]?.reply) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(port.analyze(portInput()), { code: 'E_ATLAS_LANGUAGE_BUSY' });
  let settled = false;
  const closing = port.close().then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve)); const prematurelyClosed = settled;
  child.children[0].finish(null); await Promise.all([closing, rejected]);
  assert.equal(prematurelyClosed, false, 'close must await the actual active process');
});

test('offline port: close reports a poisoned unconfirmed retirement', async () => {
  const f = resourceFixture(), child = processFixture({ hold: true, ignoreKill: true });
  const port = portFor(f, child, { timeoutMs: 10, retirementMs: 10 });
  await assert.rejects(port.analyze(portInput()), { code: 'E_ATLAS_LANGUAGE_RETIREMENT_FAILED' });
  await assert.rejects(port.close(), { code: 'E_ATLAS_LANGUAGE_RETIREMENT_FAILED' });
});

test('offline port: published signal projection and nested values are immutable', async () => {
  const f = resourceFixture(), child = processFixture(), result = await portFor(f, child).analyze(portInput());
  for (const value of [result, result.tokens, result.tokens[0], result.entities, result.entities[0], result.metrics, result.unavailableSignals]) {
    assert.equal(Object.isFrozen(value), true);
  }
});

function rendererAnalysisHarness() {
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const text = 'Anna waited. 🧭 Cafe\u0301', textHash = hash(JSON.stringify(text)), calls = [], presentations = [];
  const result = { state: 'experimental', projectId: 'ui-project', sceneId: 'ui-scene', certified: false, releaseTrust: false,
    entities: [{ text: 'Anna', label: 'PERSON', utf16Start: 0, utf16End: 4 }], tokens: [] };
  const response = { ok: true, atlasCurrentScene: { state: 'empty', projectId: 'ui-project', sceneId: 'ui-scene',
    summary: { sceneTextHash: textHash }, languageAnalysis: result } };
  let reply = Promise.resolve(response);
  const ctx = vm.createContext({ window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12' },
    atlasLanguageAnalysisState: { state: 'idle', current: null, result: null, reason: '' },
    atlasCurrentSceneState: { state: 'empty', projectId: 'ui-project', sceneId: 'ui-scene', summary: { sceneTextHash: textHash } },
    localDirty: false, localEditGeneration: 7, lastAckedGeneration: 7, currentRightTab: 'atlas', currentAtlasSurface: 'currentScene',
    currentProjectId: 'ui-project', currentDocumentId: 'ui-scene', currentTreeContentPublicationId: 'ui-publication',
    atlasPublicationEpoch: 4, manualMapDraftOwnership: {}, atlasJourneyDraftRevision: 1, manualMapDraftRevision: 1,
    atlasCommandPublicationSequence: 0, atlasQueryPublicationSequences: new Map(), ATLAS_CURRENT_SCENE_QUERY_ID: 'query.atlasCurrentScene',
    hashCanonicalValue: value => hash(JSON.stringify(value)), composeDocumentContent: () => 'owned synthetic editor content',
    parseDocumentContent: () => ({ text, issue: '' }), getPlainText: () => text + '\n',
    renderAtlasLanguageAnalysis: () => presentations.push(ctx.atlasLanguageAnalysisState),
    invokeWorkspaceQueryBridge: (id, payload) => { calls.push({ id, payload }); return reply; } });
  const guardsFrom = source.indexOf('function captureAtlasPublication('), guardsTo = source.indexOf('\nfunction manualMapNumber(', guardsFrom);
  const requestFrom = source.indexOf('async function requestAtlasLanguageAnalysis('), requestTo = source.indexOf('\nfunction renderAtlasCurrentSceneState(', requestFrom);
  vm.runInContext(source.slice(guardsFrom, guardsTo) + '\n' + source.slice(requestFrom, requestTo) + '\nthis.request = requestAtlasLanguageAnalysis;', ctx);
  return { ctx, calls, presentations, response,
    defer() { let resolve; reply = new Promise(done => { resolve = done; }); return () => resolve(response); } };
}

test('offline renderer: real publication guard and existing query carry only explicit intent, never source/model authority', async () => {
  const h = rendererAnalysisHarness(), original = JSON.stringify(h.response);
  await h.ctx.request();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].id, 'query.atlasCurrentScene');
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].payload)), { projectId: 'ui-project', nodeId: 'ui-scene', analyzeLanguage: true });
  assert.deepEqual(h.presentations.map(state => state.state), ['loading', 'experimental']);
  assert.equal(h.ctx.atlasLanguageAnalysisState.result.entities[0].text, 'Anna');
  assert.equal(JSON.stringify(h.response), original);
});

for (const [name, mutate] of [
  ['unsaved source', ctx => { ctx.localDirty = true; }],
  ['revoked product profile', ctx => { ctx.window.__PRODUCT_PROFILE = 'WRITER_LOCAL'; }],
  ['another Atlas surface', ctx => { ctx.currentAtlasSurface = 'manualMaps'; }],
]) {
  test('offline renderer: ' + name + ' causes zero query effects', async () => {
    const h = rendererAnalysisHarness(); mutate(h.ctx); await h.ctx.request();
    assert.equal(h.calls.length, 0); assert.equal(h.ctx.atlasLanguageAnalysisState.state, 'idle');
  });
}

for (const [name, mutate] of [
  ['new authoring generation', ctx => { ctx.localEditGeneration += 1; }],
  ['changed project', ctx => { ctx.currentProjectId = 'other-project'; }],
  ['new command publication', ctx => { ctx.atlasCommandPublicationSequence += 1; }],
]) {
  test('offline renderer: ' + name + ' while awaiting the query prevents signal publication', async () => {
    const h = rendererAnalysisHarness(), resume = h.defer(), pending = h.ctx.request();
    assert.equal(h.calls.length, 1); mutate(h.ctx); resume(); await pending;
    assert.equal(h.presentations.some(state => state.state === 'experimental'), false);
    assert.equal(h.ctx.atlasLanguageAnalysisState.result, null);
  });
}

async function scheduledAnalysisHarness(phase = '') {
  const h = await mainSceneHarness(), ctx = h.context;
  const { createAtlasAnalyticsScheduler } = require('../../src/derived/atlas/atlasAnalyticsScheduler.cjs');
  let observedResolve, release, handlerDone = false, intercepted = false;
  const observed = new Promise(resolve => { observedResolve = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  ctx.normalizeStableProjectId = value => value;
  ctx.canonicalizeComparableValue = value => value;
  ctx.ATLAS_CONTINUITY_LEDGER_SURFACE_QUERY_ID = 'query.otherPulse';
  ctx.ATLAS_DIAGNOSTICS_STAGE_ACCEPTANCE_QUERY_ID = 'query.otherDiagnostics';
  ctx.atlasAnalyticsScheduler = createAtlasAnalyticsScheduler();
  ctx.readAtlasAnalyticsSourceRecord = async () => {
    if (!intercepted && (phase === 'before-handler' || (phase === 'after-handler' && handlerDone))) {
      intercepted = true; observedResolve(); await hold;
    }
    return { projectId: h.projectId, sourceRevision: ctx.liveSourceRevision, dependencyRevisions: { scene: ctx.liveSourceRevision } };
  };
  const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const from = main.indexOf('async function runScheduledAtlasAnalyticsQuery('), to = main.indexOf('\nfunction normalizeAtlasOverviewPayload(', from);
  vm.runInContext(main.slice(from, to) + '\nthis.scheduledQuery = runScheduledAtlasAnalyticsQuery;', ctx);
  const query = () => ctx.scheduledQuery('query.atlasCurrentScene', { projectId: h.projectId, nodeId: h.sceneId, analyzeLanguage: true },
    async (payload, job) => { const value = await ctx.actualQuery(payload, job); handlerDone = true; return value; });
  return { ...h, query, observed, release };
}

for (const phase of ['before-handler', 'after-handler']) {
  test('offline scheduler: actual Main caller rejects a replaced same-project owner during ' + phase + ' source await', async () => {
    const h = await scheduledAnalysisHarness(phase), pending = h.query(); await h.observed;
    h.context.activeStage10ApplicationBootstrap = { getProjectId: () => h.projectId, getRuntime: () => ({}) };
    h.release(); const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.atlasCurrentScene?.languageAnalysis?.entities?.length || 0, 0);
    if (phase === 'before-handler') assert.equal(h.calls.length, 0);
    h.assertNoMutation();
  });
}

test('offline scheduler: real scheduler forwards its job identity and explicit requests never reuse retained model output', async () => {
  const h = await scheduledAnalysisHarness();
  const first = await h.query(), second = await h.query();
  assert.equal(first.ok, true); assert.equal(second.ok, true); assert.equal(h.calls.length, 2);
  assert.notEqual(first.atlasCurrentScene.languageAnalysis.generation, second.atlasCurrentScene.languageAnalysis.generation);
  assert.equal(h.calls[0].input.sourceRevision, h.state.data.projects[h.projectId].scenes[h.sceneId].sceneRevision);
  h.assertNoMutation();
});

// The preceding frozen controls remain byte-exact; further cases append below.

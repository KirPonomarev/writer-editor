'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ROOT = path.resolve(__dirname, '../..');
const helperPath = path.join(ROOT, 'test/unit/r24-wp307-writer-local-profile-integration.test.js');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const firstCase = helperSource.indexOf('\ntest(');
assert.ok(firstCase > 0);
function existingFunction(name, source = helperSource) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'mu').exec(source);
  assert.ok(match, name);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index, name);
  return source.slice(match.index, end + 2);
}
const navigationHooks = `\nmodule.exports.__navigation = {
  state: () => ({filePath: currentFilePath, dirty: isDirty, generation: lastSignaledEditGeneration}),
  afterBarrier(callback) {const original = confirmDiscardChanges; confirmDiscardChanges = async () => {
    const result = await original(); confirmDiscardChanges = original; if (result) await callback(); return result;
  };}
};\n`;
const TEXT = 'Авторская интерпретация é 🧭. Мира увидела маяк и сохранила знак.';
const originalFixture = existingFunction('fullMacMainFixture');
assert.equal(originalFixture.split("read('src/main.js')").length, 2);
const helperModule = new Module(helperPath, module);
helperModule.filename = helperPath;
helperModule.paths = Module._nodeModulePaths(path.dirname(helperPath));
// Only maintained fixture definitions execute. No old test registration or
// production validation is replaced. Native ports remain finite test doubles.
helperModule._compile(helperSource.slice(0, firstCase)
  + '\nconst navigationHooks=' + JSON.stringify(navigationHooks) + ';\nconst EXACT_ATLAS_TEXT=' + JSON.stringify(TEXT) + ';\n'
  + originalFixture.replace("read('src/main.js')", "read('src/main.js')+navigationHooks") + '\n'
  + ['fullMacRendererCommandPort', 'exactAtlasScene', 'finiteManualMapPdf'].map(name => existingFunction(name)).join('\n')
  + '\nmodule.exports={fullMacMainFixture,fullMacRendererCommandPort,exactAtlasScene};', helperPath);
const {fullMacMainFixture, fullMacRendererCommandPort, exactAtlasScene} = helperModule.exports;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const publications = h => h.sent.filter(([channel]) => channel === 'editor:set-text').length;
function fullRoster(root) {
  const rows = [];
  function visit(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name), s = fs.lstatSync(p);
      assert.equal(s.isSymbolicLink(), false);
      rows.push([path.relative(root, p), s.isDirectory() ? 'directory' : hash(fs.readFileSync(p))]);
      if (s.isDirectory()) visit(p);
    }
  }
  visit(root);
  return rows;
}
function openSnapshot(x) {
  const roster = fullRoster(x.h.root), fenceName = roster.find(([name]) => name.endsWith('/fencing-generation.v1.json'))?.[0];
  assert.ok(fenceName);
  const libraryName = path.join('userData', 'project-library-index.v1.json');
  return {roster, fenceName, libraryName, observedAtMs: Date.now(),
    fence: JSON.parse(fs.readFileSync(path.join(x.h.root, fenceName))),
    library: JSON.parse(fs.readFileSync(path.join(x.h.root, libraryName)))};
}
function assertOrdinaryOpenFootprint(x, before) {
  const after = openSnapshot(x), mutable = new Set([before.fenceName, before.libraryName]);
  assert.deepEqual(after.roster.filter(([name]) => !mutable.has(name)), before.roster.filter(([name]) => !mutable.has(name)),
    'every manuscript, author, history, receipt, recovery, settings and unrelated byte stays exact');
  assert.equal(after.fenceName, before.fenceName);
  assert.match(after.fence.ownerTokenDigest, /^[a-f0-9]{64}$/u);
  assert.notEqual(after.fence.ownerTokenDigest, before.fence.ownerTokenDigest);
  assert.ok(after.fence.issuedAtMs >= before.observedAtMs && after.fence.issuedAtMs <= after.observedAtMs);
  assert.ok(Number.isSafeInteger(after.fence.monotonicIssuedAtMs) && after.fence.monotonicIssuedAtMs >= before.fence.monotonicIssuedAtMs);
  assert.deepEqual(after.fence, {...before.fence, fencingGeneration: before.fence.fencingGeneration + 1,
    ownerTokenDigest: after.fence.ownerTokenDigest, issuedAtMs: after.fence.issuedAtMs, monotonicIssuedAtMs: after.fence.monotonicIssuedAtMs});
  assert.equal(after.library.entries.length, 1);
  const row = after.library.entries[0], old = before.library.entries[0];
  for (const value of [after.library.updatedAtUtc, row.lastOpenedAtUtc, row.lastSeenAtUtc]) {
    assert.ok(Date.parse(value) >= before.observedAtMs && Date.parse(value) <= after.observedAtMs);
  }
  assert.deepEqual(after.library, {...before.library, updatedAtUtc: after.library.updatedAtUtc,
    entries: [{...old, lastOpenedAtUtc: row.lastOpenedAtUtc, lastSeenAtUtc: row.lastSeenAtUtc}]});
}
async function fixture(t) {
  const h = await fullMacMainFixture(t, {packaged: true, rendererLoaded: true});
  const f = await exactAtlasScene(h, 'Meaning origin source'), ui = await fullMacRendererCommandPort(h);
  assert.equal((await h.main.handleUiOpenDocumentCommand({projectId: f.projectId, nodeId: f.sceneId})).ok, true);
  const ideaId = 'meaning-source-idea', meaningId = 'meaning-source-scene', ideaMeaningId = 'meaning-source-via-idea';
  const {hashCanonicalValue} = await import('../../src/core/browser-safe-hash.mjs');
  const originRef = {schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', sceneId: f.sceneId,
    startOffset: 0, endOffset: TEXT.length, sourceHash: hashCanonicalValue(TEXT), targetId: meaningId};
  const intents = [
    ['idea.create', {ideaId, title: 'Авторская Idea é 🧭', summary: 'Explicit source, never inferred'}],
    ['meaning.promote', {meaningId, title: 'Смысл фрагмента', interpretation: 'Авторское прочтение, не автоматический вывод.',
      source: {kind: 'sceneOriginRef', originRef}}],
    ['meaning.promote', {meaningId: ideaMeaningId, title: 'Смысл Idea', interpretation: 'Отдельное авторское прочтение Idea.',
      source: {kind: 'idea', ideaId}}],
  ];
  for (const [commandId, payload] of intents) {
    const applied = await ui(commandId, {projectId: f.projectId, ...payload});
    assert.equal(applied.mainResult.ok, true, JSON.stringify(applied));
    assert.equal(applied.mainResult.value.receipt.status, 'APPLIED');
    assert.equal(applied.mainResult.value.receipt.storageWritten, true);
  }
  const saved = JSON.parse(fs.readFileSync(f.manifestPath));
  assert.deepEqual(saved.meanings.meanings[meaningId].source, {kind: 'sceneOriginRef', originRef});
  assert.deepEqual(saved.meanings.meanings[ideaMeaningId].source, {kind: 'idea', ideaId});
  assert.equal(saved.meanings.meanings[meaningId].interpretation, intents[1][1].interpretation);
  assert.deepEqual(fs.readFileSync(f.scenePath), f.sceneBytes);
  // Establish normal library continuity after the three author mutations.
  // Subsequent navigation may advance only its timestamps and owner fence.
  assert.equal((await h.main.handleUiOpenDocumentCommand({projectId: f.projectId, nodeId: f.sceneId})).ok, true);
  const packet = await h.query('query.projectionInspector', {projectId: f.projectId, meaning: {selectedId: meaningId}});
  assert.equal(packet.ok, true);
  const meaning = packet.projectionInspector.projectionStates.find(x => x.projectionId === 'meaning');
  assert.equal(meaning.state, 'ready');
  assert.equal(meaning.details.selected.id, meaningId);
  const expected = {schemaVersion: 'meaning.sourceNavigation.v1', projectId: f.projectId, meaningId, originRef,
    sceneRevision: 'sha256:' + hash(fs.readFileSync(f.scenePath)), projectionHash: meaning.projectionHash};
  const open = async (value = expected, registered = false, extra = {}) => {
    const payload = {projectId: f.projectId, nodeId: f.sceneId, expectedMeaningSource: value, ...extra};
    return registered ? (await ui('cmd.project.document.open', payload)).mainResult : h.command('cmd.project.document.open', payload);
  };
  return {h, f, ui, expected, open, ideaId, meaningId, ideaMeaningId, originRef, saved};
}

test('Meaning lawful setup uses real packaged Core commands and preserves both explicit source kinds', async t => {
  const x = await fixture(t), before = openSnapshot(x);
  const result = await x.open();
  assert.equal(result.ok, true, JSON.stringify(result));
  assertOrdinaryOpenFootprint(x, before);
  assert.deepEqual(fs.readFileSync(x.f.scenePath), x.f.sceneBytes);
});

test('Meaning legacy ordinary document-open remains available without any source expectation', async t => {
  const x = await fixture(t), before = openSnapshot(x);
  const result = await x.ui('cmd.project.document.open', {projectId: x.f.projectId, nodeId: x.f.sceneId});
  assert.equal(result.mainResult.ok, true);
  assert.equal(Object.hasOwn(result.request.payload, 'expectedMeaningSource'), false);
  assertOrdinaryOpenFootprint(x, before);
});

test('Meaning current registered caller retains the exact source expectation through Kernel Main', async t => {
  const x = await fixture(t), before = openSnapshot(x);
  const response = await x.ui('cmd.project.document.open', {projectId: x.f.projectId, nodeId: x.f.sceneId, expectedMeaningSource: x.expected});
  assert.equal(response.mainResult.ok, true, JSON.stringify(response));
  assert.deepEqual(response.request.payload.expectedMeaningSource, x.expected, 'registration cannot silently drop source enforcement');
  assert.equal(x.h.main.__navigation.state().filePath, x.f.scenePath);
  assertOrdinaryOpenFootprint(x, before);
});

for (const registered of [false, true]) for (const fault of [
  'null', 'array', 'extra-path', 'foreign-project', 'missing-meaning', 'idea-backed-meaning',
  'stale-hash', 'stale-revision', 'stale-projection', 'wrong-range', 'coerced-range', 'wrong-scene',
]) test('Meaning ' + (registered ? 'registered' : 'direct guarded Main') + ' refuses ' + fault + ' before editor or data effects', async t => {
  const x = await fixture(t); let value = structuredClone(x.expected);
  if (fault === 'null') value = null;
  if (fault === 'array') value = [];
  if (fault === 'extra-path') value.path = x.f.scenePath;
  if (fault === 'foreign-project') value.projectId = 'foreign-project';
  if (fault === 'missing-meaning') value.meaningId = 'another-meaning';
  if (fault === 'idea-backed-meaning') value.meaningId = x.ideaMeaningId;
  if (fault === 'stale-hash') value.originRef.sourceHash = '0'.repeat(64);
  if (fault === 'stale-revision') value.sceneRevision = 'sha256:' + '0'.repeat(64);
  if (fault === 'stale-projection') value.projectionHash = '0'.repeat(64);
  if (fault === 'wrong-range') value.originRef.endOffset++;
  if (fault === 'coerced-range') value.originRef.startOffset = '0';
  if (fault === 'wrong-scene') value.originRef.sceneId = 'tree-node-' + '0'.repeat(32);
  const before = fullRoster(x.h.root), state = x.h.main.__navigation.state(), sent = publications(x.h);
  const result = await x.open(value, registered);
  assert.equal(result.ok, false, 'an invalid Meaning source expectation must not be ignored');
  assert.deepEqual(x.h.main.__navigation.state(), state); assert.equal(publications(x.h), sent);
  assert.deepEqual(fullRoster(x.h.root), before);
});

for (const other of ['expectedPlotSource', 'expectedIdeaSource']) for (const registered of [false, true])
  test('Meaning refuses ambiguous own-property ' + other + ' through ' + (registered ? 'registration' : 'Main'), async t => {
    const x = await fixture(t), before = fullRoster(x.h.root), sent = publications(x.h);
    const result = await x.open(x.expected, registered, {[other]: null});
    assert.equal(result.ok, false); assert.equal(result.reason, 'E_DOCUMENT_SOURCE_EXPECTATION_AMBIGUOUS');
    assert.equal(publications(x.h), sent); assert.deepEqual(fullRoster(x.h.root), before);
  });

for (const mutation of ['scene', 'saved-source', 'missing-meaning', 'generation'])
  test('Meaning revalidates ' + mutation + ' after actual no-loss await', async t => {
    const x = await fixture(t); let reached = 0, expectedRoster;
    const state = x.h.main.__navigation.state(), sent = publications(x.h);
    x.h.main.__navigation.afterBarrier(() => {
      reached++;
      if (mutation === 'scene') fs.writeFileSync(x.f.scenePath, fs.readFileSync(x.f.scenePath, 'utf8') + '\nSource changed Ω');
      if (mutation === 'saved-source' || mutation === 'missing-meaning') {
        const m = JSON.parse(fs.readFileSync(x.f.manifestPath));
        if (mutation === 'saved-source') m.meanings.meanings[x.meaningId].source = {kind: 'idea', ideaId: x.ideaId};
        else delete m.meanings.meanings[x.meaningId];
        fs.writeFileSync(x.f.manifestPath, JSON.stringify(m));
      }
      if (mutation === 'generation') x.h.main.__host.invalidateGeneration();
      expectedRoster = fullRoster(x.h.root);
    });
    const result = await x.open();
    assert.equal(reached, 1, 'actual no-loss boundary must execute'); assert.equal(result.ok, false);
    assert.equal(publications(x.h), sent); assert.equal(x.h.main.__navigation.state().filePath, state.filePath);
    assert.deepEqual(fullRoster(x.h.root), expectedRoster);
  });

test('Meaning retains its saved-record guard after real session settings rename until publication', async t => {
  const x = await fixture(t), rename = fs.promises.rename; let reached = 0, expectedRoster;
  const sent = publications(x.h), state = x.h.main.__navigation.state();
  fs.promises.rename = async (...args) => {
    const value = await rename.apply(fs.promises, args);
    if (!reached && String(args[1]).startsWith(x.h.root + path.sep) && path.basename(String(args[1])) === 'settings.json') {
      reached++; const m = JSON.parse(fs.readFileSync(x.f.manifestPath)); delete m.meanings.meanings[x.meaningId];
      fs.writeFileSync(x.f.manifestPath, JSON.stringify(m)); expectedRoster = x.h.roster();
    }
    return value;
  };
  t.after(() => { fs.promises.rename = rename; });
  const result = await x.open(); assert.equal(reached, 1, 'actual settings publication boundary must execute');
  assert.equal(result.ok, false); assert.equal(publications(x.h), sent);
  assert.equal(x.h.main.__navigation.state().filePath, state.filePath); assert.deepEqual(x.h.roster(), expectedRoster);
});

test('Meaning opens its exact source after actual no-loss save of another dirty scene', async t => {
  const x = await fixture(t), tree = await x.h.main.handleWorkspaceProjectTreeQuery({tab: 'roman'});
  const flat = node => [node, ...(node.children || []).flatMap(flat)], ids = new Set(flat(tree.root).map(n => n.nodeId));
  const parent = flat(tree.root).find(n => n !== tree.root && ['folder', 'part', 'chapter-folder'].includes(n.kind)); assert.ok(parent);
  const created = await x.ui('cmd.project.tree.createNode', {projectId: x.f.projectId, parentNodeId: parent.nodeId, kind: 'scene', name: 'Meaning working Ω'});
  assert.equal(created.mainResult.ok, true, JSON.stringify(created));
  const next = await x.h.main.handleWorkspaceProjectTreeQuery({tab: 'roman'});
  const other = flat(next.root).find(n => !ids.has(n.nodeId) && n.kind === 'scene'); assert.ok(other);
  const resolved = await x.h.main.resolveProjectTreeNodeIdentity(other.nodeId, x.f.projectId);
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({projectId: x.f.projectId, nodeId: other.nodeId})).ok, true);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs'), text = 'Несохранённый текст é 🧭 — сохраняется при переходе Meaning.';
  const built = envelope.composeDocumentContentFromBase({baseContent: x.h.editor.content, nextVisibleText: text}); assert.equal(built.ok, true);
  const generation = x.h.editor.generation + 1;
  x.h.editor = {...x.h.editor, content: built.content, plainText: text, generation};
  const signal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', {state: true, generation});
  assert.equal((await x.h.handlers.get('ui:save-lifecycle-signal-bridge')(x.h.event(), signal)).ok, true);
  const meanings = JSON.parse(fs.readFileSync(x.f.manifestPath)).meanings;
  const result = await x.open(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(envelope.parseObservablePayload(fs.readFileSync(resolved.nodePath, 'utf8')).text, text);
  assert.deepEqual(fs.readFileSync(x.f.scenePath), x.f.sceneBytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)).meanings, meanings);
  assert.equal(x.h.main.__navigation.state().dirty, false);
});

async function projectionFixture() {
  const runtime = await import('../../src/core/runtime.mjs'), {hashCanonicalValue} = await import('../../src/core/browser-safe-hash.mjs');
  const projectId = 'meaning-sources-contract', sceneId = 'tree-node-' + '3'.repeat(32), ideaId = 'meaning-source-idea';
  const commands = [
    {type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE, payload: {projectId, sceneId}},
    {type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: {projectId, sceneId, text: TEXT}},
    {type: runtime.CORE_COMMAND_IDS.IDEA_CREATE, payload: {projectId, ideaId, title: 'Saved source Idea é 🧭'}},
  ];
  for (let i = 0; i < 26; i++) {
    const meaningId = 'meaning-' + String(i).padStart(2, '0');
    commands.push({type: runtime.CORE_COMMAND_IDS.MEANING_PROMOTE, payload: {projectId, meaningId, title: meaningId,
      interpretation: 'Author interpretation ' + i, source: i === 0 ? {kind: 'idea', ideaId} : {kind: 'sceneOriginRef', originRef: {
        schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', sceneId, startOffset: 0, endOffset: 4,
        sourceHash: hashCanonicalValue(TEXT), targetId: meaningId}}}});
  }
  const result = runtime.applyCoreSequence(runtime.createInitialCoreState(), commands); assert.equal(result.ok, true, JSON.stringify(result.error));
  // Pure read-model fixture revision, not filesystem/native acceptance.
  result.state.data.projects[projectId].scenes[sceneId].sceneRevision = 'sha256:' + hash(Buffer.from(TEXT));
  const {deriveProjectionInspectorProvider} = await import('../../src/derived/projections/projectionInspectorManifests.mjs');
  const derive = meaning => deriveProjectionInspectorProvider({coreState: result.state, params: {projectId, meaning}, capabilitySnapshot: {}});
  return {state: result.state, projectId, sceneId, ideaId, derive};
}
function meaningDetails(result) {
  assert.equal(result.ok, true); return result.value.projectionStates.find(row => row.projectionId === 'meaning').details;
}

test('Meaning projection keeps each explicit source accessible beyond the first24 without truth writes', async () => {
  const f = await projectionFixture(), before = JSON.stringify(f.state), first = meaningDetails(f.derive({}));
  assert.equal(first.sourceRows.length, 24); assert.equal(first.hasMore, true);
  assert.ok(first.sourceRows.every(row => row.projectId === f.projectId && row.sourceState === 'current'));
  const second = meaningDetails(f.derive({offset: 24})); assert.equal(second.sourceRows.length, 2);
  assert.equal(second.hasMore, false); assert.equal(second.sourceRows.find(row => row.meaningId === 'meaning-00').ideaId, f.ideaId);
  const selected = meaningDetails(f.derive({selectedId: 'meaning-00'})); assert.equal(selected.sourceRows.length, 1);
  assert.equal(selected.sourceRows[0].kind, 'idea'); assert.equal(selected.sourceRows[0].sourceLabel, 'Saved source Idea é 🧭');
  assert.equal(JSON.stringify(f.state), before);
});

test('Meaning missing selection cannot substitute another visible record source', async () => {
  const f = await projectionFixture(), before = JSON.stringify(f.state), detail = meaningDetails(f.derive({selectedId: 'missing-meaning'}));
  assert.equal(detail.selectedState, 'missing'); assert.deepEqual(detail.sourceRows, []);
  assert.equal(JSON.stringify(f.state), before);
});

for (const fault of ['changed-scene', 'missing-scene', 'missing-idea', 'malformed-range'])
  test('Meaning projection reports ' + fault + ' without rewriting author truth', async () => {
    const f = await projectionFixture(), project = f.state.data.projects[f.projectId];
    if (fault === 'changed-scene') project.scenes[f.sceneId].text += ' changed';
    if (fault === 'missing-scene') { delete project.scenes[f.sceneId]; project.sceneOrder = []; }
    if (fault === 'missing-idea') delete project.ideas.ideas[f.ideaId];
    if (fault === 'malformed-range') project.meanings.meanings['meaning-01'].source.originRef.startOffset = '0';
    const before = JSON.stringify(f.state), detail = meaningDetails(f.derive({selectedId: fault === 'missing-idea' ? 'meaning-00' : 'meaning-01'}));
    assert.equal(detail.sourceRows.length, 1); assert.equal(detail.sourceRows[0].sourceState, fault === 'changed-scene' ? 'stale' : 'unavailable');
    assert.equal(JSON.stringify(f.state), before);
  });

test('Meaning source presentation invalidates when source Idea changes even with identical Meaning records', async () => {
  const f = await projectionFixture(), before = f.derive({selectedId: 'meaning-00'});
  f.state.data.projects[f.projectId].ideas.ideas[f.ideaId].title = 'Updated explicit source title Ω';
  const state = JSON.stringify(f.state), after = f.derive({selectedId: 'meaning-00'});
  assert.equal(meaningDetails(after).sourceRows[0].sourceLabel, 'Updated explicit source title Ω');
  assert.notEqual(after.value.meta.providerHash, before.value.meta.providerHash);
  assert.equal(JSON.stringify(f.state), state);
});

const domPath = path.join(ROOT, 'test/contracts/yalken-atlas-v5-r2-c02-safe-semantic-interactions.contract.test.js');
const domSource = fs.readFileSync(domPath, 'utf8'), domModule = new Module(domPath, module);
domModule.filename = domPath; domModule.paths = Module._nodeModulePaths(path.dirname(domPath));
const domConstants = ['SOURCE_CONTINUITY_TEXT', 'SOURCE_CONTINUITY_PREFIX', 'AUTHOR_IDENTITY_V9', 'ENTITY_CORRECTION_V10', 'IDEA_MEANING_PROFILE_V11']
  .map(name => { const value = domSource.match(new RegExp('^const ' + name + ' = [^\\n]+;$', 'm')); assert.ok(value, name); return value[0]; });
domModule._compile(domSource.slice(0, domSource.indexOf('\ntest(')) + '\n' + domConstants.join('\n') + '\n'
  + ['draftDomHarness', 'publicationHarness', 'savedReattachmentRendererHarness', 'authorIdentityDom', 'sourceEntitySelectionDom', 'ideaMeaningAuthorDom', 'plotSourceDom']
    .map(name => existingFunction(name, domSource)).join('\n') + '\nmodule.exports={plotSourceDom};', domPath);
function meaningSourceDom(kind = 'sceneOriginRef') {
  const h = domModule.exports.plotSourceDom(), c = h.c, meaningId = 'saved-meaning-a';
  const originRef = {schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', sceneId: h.row.sceneId,
    startOffset: 2, endOffset: 15, sourceHash: '6'.repeat(64), targetId: meaningId};
  const source = kind === 'idea' ? {kind, ideaId: 'saved-idea-b'} : {kind, originRef};
  const row = {id: meaningId, meaningId, projectId: c.currentProjectId, kind, sourceState: 'current',
    sourceLabel: kind === 'idea' ? 'Saved explicit idea B' : h.row.sceneTitle,
    ...(kind === 'idea' ? {ideaId: source.ideaId} : {sceneId: h.row.sceneId, sceneTitle: h.row.sceneTitle, sceneRevision: h.row.sceneRevision, originRef})};
  const state = structuredClone(h.provider()), meaning = state.projectionStates.find(item => item.projectionId === 'meaning');
  const saved = {id: meaningId, title: 'Авторская интерпретация é 🧭', interpretation: 'Saved author prose', source,
    promotionKind: 'explicitAuthorPromotion', createdByCommandSeq: 8, updatedByCommandSeq: 8};
  meaning.state = 'ready'; Object.assign(meaning.details, {rows: [saved], total: 1, complete: true, selected: saved, selectedState: 'ready', sourceRows: [row]});
  c.getIdeaMeaningAuthorDraft().fields.selectedMeaningId = meaningId;
  h.setProvider(state); c.projectionInspectorState = state; h.render();
  const button = () => h.walk(c.projectionInspectorHost).find(node => node.dataset.meaningSourceOpen === meaningId);
  return {...h, row, state, source, saved, button};
}

test('Meaning finite renderer fixture retains the existing lawful Plot source action [FINITE_DOM]', async () => {
  const h = domModule.exports.plotSourceDom(), button = h.buttons()[0]; assert.ok(button); assert.equal(button.disabled, false);
  await button.emit('click'); assert.equal(h.opened.length, 1);
  assert.equal(h.opened[0].node.nodeId, h.row.sceneId);
});

test('Meaning actual scene source listener carries exact saved identity and refuses stale contexts [FINITE_DOM]', async () => {
  const h = meaningSourceDom(), button = h.button(); assert.ok(button, 'saved Meaning needs a reachable source action');
  assert.equal(button.disabled, false); assert.match(button.attributes['aria-label'], /Авторская интерпретация é 🧭/u);
  await button.emit('click'); assert.equal(h.opened.length, 1);
  assert.equal(h.opened[0].node.nodeId, h.row.sceneId);
  assert.deepEqual(h.opened[0].options.expectedMeaningSource, {schemaVersion: 'meaning.sourceNavigation.v1', projectId: h.row.projectId,
    meaningId: h.row.meaningId, originRef: h.row.originRef, sceneRevision: h.row.sceneRevision, projectionHash: 'c'.repeat(64)});
  for (const fault of ['capability', 'project', 'surface', 'revision', 'detached', 'unavailable']) {
    const x = meaningSourceDom(), old = x.button(); assert.ok(old);
    if (fault === 'capability') x.c.plotCapability = false;
    if (fault === 'project') x.c.currentProjectId = 'foreign-project';
    if (fault === 'surface') x.c.currentAtlasSurface = 'matrix';
    if (fault === 'revision') x.row.sceneRevision = 'sha256:' + '8'.repeat(64);
    if (fault === 'detached') x.render();
    if (fault === 'unavailable') {x.row.sourceState = 'unavailable'; x.render();}
    await old.emit('click'); assert.equal(x.opened.length, 0, fault);
  }
  const late = meaningSourceDom(); let resolve;
  late.c.treeRoot = null; late.c.invokeWorkspaceQueryBridge = () => new Promise(done => { resolve = done; });
  const pending = late.button().emit('click'); await late.settle(); late.c.currentProjectId = 'foreign-project';
  resolve({ok: true, projectId: late.row.projectId, root: {children: [{nodeId: late.row.sceneId, kind: 'scene'}]}});
  await pending; assert.equal(late.opened.length, 0);
});

test('Meaning actual Idea source listener selects only the fresh saved Idea and preserves interpretation drafts [FINITE_DOM]', async () => {
  const h = meaningSourceDom('idea'), entry = h.c.getIdeaMeaningAuthorDraft(), button = h.button();
  assert.ok(button, 'Idea-backed Meaning needs a reachable source action'); assert.equal(button.disabled, false);
  entry.fields.meaningInterpretation = 'Unsaved author interpretation é 🧭';
  await button.emit('click'); await h.settle();
  assert.equal(entry.fields.selectedIdeaId, 'saved-idea-b'); assert.equal(entry.fields.selectedMeaningId, h.saved.id);
  assert.equal(entry.fields.meaningInterpretation, 'Unsaved author interpretation é 🧭');
  assert.equal(h.opened.length, 0, 'an Idea may have many scene origins; source navigation must not choose one'); assert.equal(h.commands.length, 0);
  assert.ok(h.requests.some(request => request.payload?.meaning?.selectedId === h.saved.id), 'fresh saved relationship must be read before selection');
  const changed = meaningSourceDom('idea'), old = changed.button(), next = structuredClone(changed.state);
  const detail = next.projectionStates.find(row => row.projectionId === 'meaning').details;
  detail.rows[0].source.ideaId = 'saved-idea-a'; detail.selected.source.ideaId = 'saved-idea-a';
  detail.sourceRows[0].ideaId = 'saved-idea-a'; changed.setProvider(next);
  await old.emit('click'); await changed.settle();
  assert.equal(changed.c.getIdeaMeaningAuthorDraft().fields.selectedIdeaId, '', 'a changed saved relationship cannot silently select a different Idea');
  assert.equal(changed.commands.length, 0); assert.equal(changed.opened.length, 0);
});

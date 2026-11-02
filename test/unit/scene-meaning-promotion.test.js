'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ROOT = path.resolve(__dirname, '../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const TEXT = 'Начало é 🧭. Автор видит смысл в этом фрагменте. Конец.';
const START = TEXT.indexOf('é'), END = START + 'é 🧭'.length;
const TITLE = 'Авторский смысл é 🧭', INTERPRETATION = 'Моё прочтение сохранённого фрагмента.';
const HASH = sha(JSON.stringify(TEXT));

function definition(source, name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'mu').exec(source);
  assert.ok(match, 'maintained helper definition ' + name);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  return source.slice(match.index, end + 2);
}
function compileDefinitions(relativePath, names, constants = [], prefix = '') {
  const filename = path.join(ROOT, relativePath), source = fs.readFileSync(filename, 'utf8');
  const firstTest = source.indexOf('\ntest('); assert.ok(firstTest > 0);
  const declarations = constants.map(name => {
    const match = source.match(new RegExp('^const ' + name + ' = [^\\n]+;$', 'm'));
    assert.ok(match, name); return match[0];
  });
  const compiled = new Module(filename, module);
  compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  // Reuse only maintained finite fixture definitions. No old test is registered,
  // no assertion removed and no production validation/enforcement substituted.
  compiled._compile(source.slice(0, firstTest) + '\n' + declarations.join('\n') + '\n' + prefix + '\n'
    + names.map(name => definition(source, name)).join('\n')
    + '\nmodule.exports={' + names.join(',') + '};', filename);
  return compiled.exports;
}
const dom = compileDefinitions('test/contracts/yalken-atlas-v5-r2-c02-safe-semantic-interactions.contract.test.js',
  ['draftDomHarness', 'publicationHarness', 'savedReattachmentRendererHarness', 'authorIdentityDom',
    'sourceEntitySelectionDom', 'ideaMeaningAuthorDom'],
  ['SOURCE_CONTINUITY_TEXT', 'SOURCE_CONTINUITY_PREFIX', 'AUTHOR_IDENTITY_V9', 'ENTITY_CORRECTION_V10', 'IDEA_MEANING_PROFILE_V11']);
const mainHelpers = compileDefinitions('test/unit/r24-wp307-writer-local-profile-integration.test.js',
  ['fullMacMainFixture', 'fullMacRendererCommandPort', 'exactAtlasScene', 'finiteManualMapPdf'], [],
  'const EXACT_ATLAS_TEXT=' + JSON.stringify(TEXT) + ';');

function formDom({ projectId = 'project-a', sceneId = 'scene-a', projection, profile = 'WRITER_LOCAL_IDEA_MEANING_AUTHORING_V11' } = {}) {
  const h = dom.ideaMeaningAuthorDom(), c = h.c;
  c.currentProjectId = projectId; c.currentDocumentId = sceneId;
  c.localDirty = false; c.localEditGeneration = c.lastAckedGeneration = 1;
  c.setPlainText(TEXT); c.isTiptapMode = true;
  c.atlasCurrentSceneState = projection || { state: 'empty', projectId, sceneId, sceneTitle: 'Сохранённая сцена',
    summary: { sceneTextHash: HASH, entityCount: 0, mentionCount: 0 }, entities: [], mentions: [] };
  let selection = { start: START, end: END }, selections = 0;
  // Finite EditorSelectionPort coordinates, NOT real ProseMirror/native proof.
  c.getSelectionOffsets = () => { selections++; return { ...selection }; };
  c.window.__PRODUCT_PROFILE = profile;
  if (profile === 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12') {
    // This fixture isolates the existing author form; the whole original R2
    // suite separately covers V12 surface composition and its language form.
    c.atlasJourneyHost.innerHTML = ''; c.atlasJourneyHost.append(c.getIdeaMeaningAuthorForm());
  } else h.render();
  const button = () => h.button('meaning-promote-scene');
  const fields = () => ({ title: h.field('meaningTitle').value, interpretation: h.field('meaningInterpretation').value });
  const fill = async () => { await h.input('meaningTitle', TITLE); await h.input('meaningInterpretation', INTERPRETATION); };
  return { ...h, button, fields, fill, selection: value => { selection = value; }, selectionReads: () => selections };
}
async function clickScene(h) {
  const button = h.button(); assert.ok(button, 'actual explicit saved-scene Meaning action is missing');
  assert.equal(button.disabled, false);
  const count = h.commands.length; await button.emit('click'); await h.settle(); return h.commands[count];
}
function assertPayload(row, { projectId = 'project-a', sceneId = 'scene-a', start = START, end = END } = {}) {
  assert.equal(row.id, 'meaning.promote');
  assert.match(row.payload.meaningId, /^meaning-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
  assert.deepEqual(row.payload, { projectId, meaningId: row.payload.meaningId, title: TITLE, interpretation: INTERPRETATION,
    source: { kind: 'sceneOriginRef', originRef: { schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', sceneId,
      startOffset: start, endOffset: end, sourceHash: HASH, targetId: row.payload.meaningId } }, editorMode: 'tiptap' });
}
function allFiles(root) {
  const rows = [];
  const walk = dir => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name), s = fs.lstatSync(file); assert.equal(s.isSymbolicLink(), false);
      rows.push([path.relative(root, file), s.isDirectory() ? 'directory' : sha(fs.readFileSync(file))]);
      if (s.isDirectory()) walk(file);
    }
  };
  walk(root); return rows;
}
async function mainFixture(t, beforeProject = () => {}) {
  const h = await mainHelpers.fullMacMainFixture(t, { packaged: true, rendererLoaded: true });
  beforeProject(h);
  const f = await mainHelpers.exactAtlasScene(h, 'Scene Meaning authoring');
  assert.equal((await h.main.handleUiOpenDocumentCommand({ projectId: f.projectId, nodeId: f.sceneId })).ok, true);
  const ui = await mainHelpers.fullMacRendererCommandPort(h);
  const queried = await h.query('query.atlasCurrentScene', { projectId: f.projectId, nodeId: f.sceneId });
  assert.equal(queried.ok, true); assert.equal(queried.atlasCurrentScene.state, 'empty', 'no entity or mention required');
  assert.equal(queried.atlasCurrentScene.summary.sceneTextHash, HASH);
  return { h, f, ui, projection: queried.atlasCurrentScene };
}
function directPayload(x) {
  const meaningId = 'meaning-existing-scene-control';
  return { projectId: x.f.projectId, meaningId, title: TITLE, interpretation: INTERPRETATION,
    source: { kind: 'sceneOriginRef', originRef: { schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange',
      sceneId: x.f.sceneId, startOffset: START, endOffset: END, sourceHash: HASH, targetId: meaningId } } };
}
function assertSaved(x, payload) {
  const manifest = JSON.parse(fs.readFileSync(x.f.manifestPath)), meaning = manifest.meanings.meanings[payload.meaningId];
  assert.ok(meaning);
  assert.deepEqual(meaning, { id: payload.meaningId, title: TITLE, interpretation: INTERPRETATION, source: payload.source,
    promotionKind: 'explicitAuthorPromotion', createdByCommandSeq: manifest.lastCommandId, updatedByCommandSeq: manifest.lastCommandId });
  assert.equal(TEXT.slice(meaning.source.originRef.startOffset, meaning.source.originRef.endOffset), 'é 🧭');
  assert.deepEqual(fs.readFileSync(x.f.scenePath), x.f.sceneBytes);
  return manifest;
}

test('Scene Meaning existing registered Main supports explicit nonzero source with no Atlas mentions [FINITE_MAIN]', async t => {
  const x = await mainFixture(t), payload = directPayload(x);
  const result = await x.ui('meaning.promote', payload);
  assert.equal(result.mainResult.ok, true, JSON.stringify(result));
  assert.equal(result.mainResult.value.receipt.status, 'APPLIED');
  assert.equal(result.mainResult.value.receipt.capabilityRevalidated, true);
  assert.equal(result.mainResult.value.receipt.storageWritten, true);
  const saved = assertSaved(x, payload);
  const q = await x.h.query('query.projectionInspector', { projectId: x.f.projectId, meaning: { selectedId: payload.meaningId } });
  assert.equal(q.ok, true);
  const detail = q.projectionInspector.projectionStates.find(row => row.projectionId === 'meaning').details;
  assert.deepEqual(detail.selected.source, payload.source); assert.equal(detail.selected.interpretation, INTERPRETATION);
  assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)), saved, 'projection reads do not change author truth');
});

for (const profile of ['WRITER_LOCAL_IDEA_MEANING_AUTHORING_V11', 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12'])
  test('Scene Meaning actual ' + profile + ' action emits saved fragment independently of Idea [FINITE_DOM]', async () => {
    const h = formDom({ profile }); await h.fill();
    assert.equal(h.field('selectedIdeaId').value, '');
    assert.ok(h.button(), 'actual explicit scene-fragment action required');
    assert.equal(h.button().tagName, 'BUTTON'); assert.equal(h.button().type, 'button');
    assert.match(h.button().textContent, /fragment|фрагмент/iu);
    assert.equal(h.button().dataset.productCommandId, 'meaning.promote');
    const sent = await clickScene(h); assertPayload(sent);
    assert.deepEqual(h.fields(), { title: '', interpretation: '' }); assert.equal(h.working(), TEXT);
  });

test('Scene Meaning actual listener reaches registered Main Kernel persistence without source or author loss [FINITE_DOM_IPC]', async t => {
  const x = await mainFixture(t), h = formDom({ projectId: x.f.projectId, sceneId: x.f.sceneId, projection: x.projection });
  let response, completed; h.c.commandPort = (id, payload) => {
    completed = x.ui(id, payload).then(value => { response = value; return value.result; });
    return completed;
  };
  await h.fill(); const sent = await clickScene(h);
  assertPayload(sent, { projectId: x.f.projectId, sceneId: x.f.sceneId });
  assert.ok(completed, 'actual registered Main command must start');
  await completed; await h.settle();
  assert.equal(response.mainResult.ok, true, JSON.stringify(response));
  assert.equal(response.mainResult.value.receipt.storageWritten, true);
  assertSaved(x, sent.payload); assert.deepEqual(h.fields(), { title: '', interpretation: '' });
  assert.equal(h.working(), TEXT);
});

test('Scene Meaning leaves existing explicit saved-Idea promotion intact [FINITE_DOM]', async () => {
  const h = formDom(); await h.load(); await h.input('selectedIdeaId', 'saved-idea-b'); await h.fill();
  const sent = await h.click('meaning-promote');
  assert.deepEqual(sent.payload.source, { kind: 'idea', ideaId: 'saved-idea-b' }); assert.equal(sent.payload.interpretation, INTERPRETATION);
});

for (const fault of ['dirty', 'unacked', 'loading', 'unavailable', 'foreign-project', 'foreign-scene', 'missing-scene',
  'malformed-hash', 'stale-hash', 'collapsed', 'reversed', 'negative', 'fractional', 'string', 'outside-canonical',
  'split-surrogate', 'parse-issue', 'live-canonical-mismatch', 'hidden-surface', 'hidden-tab', 'detached'])
  test('Scene Meaning refuses ' + fault + ' without command or author text loss [FINITE_DOM]', async () => {
    const h = formDom(); await h.fill(); const c = h.c;
    if (fault === 'dirty') c.localDirty = true;
    if (fault === 'unacked') c.lastAckedGeneration--;
    if (['loading', 'unavailable'].includes(fault)) c.atlasCurrentSceneState.state = fault;
    if (fault === 'foreign-project') c.atlasCurrentSceneState.projectId = 'foreign';
    if (fault === 'foreign-scene') c.atlasCurrentSceneState.sceneId = 'foreign';
    if (fault === 'missing-scene') c.currentDocumentId = '';
    if (fault === 'malformed-hash') c.atlasCurrentSceneState.summary.sceneTextHash = 'not-a-hash';
    if (fault === 'stale-hash') c.atlasCurrentSceneState.summary.sceneTextHash = '0'.repeat(64);
    if (fault === 'collapsed') h.selection({ start: START, end: START });
    if (fault === 'reversed') h.selection({ start: END, end: START });
    if (fault === 'negative') h.selection({ start: -1, end: END });
    if (fault === 'fractional') h.selection({ start: START + 0.5, end: END });
    if (fault === 'string') h.selection({ start: String(START), end: END });
    if (fault === 'outside-canonical') h.selection({ start: START, end: TEXT.length + 1 });
    if (fault === 'split-surrogate') h.selection({ start: TEXT.indexOf('🧭') + 1, end: END });
    if (fault === 'parse-issue') c.parseDocumentContent = () => ({ text: TEXT, issue: { code: 'OWNED_PARSE_FAULT' } });
    if (fault === 'live-canonical-mismatch') c.getPlainText = () => 'changed ' + TEXT;
    if (fault === 'hidden-surface') c.currentAtlasSurface = 'entity';
    if (fault === 'hidden-tab') c.currentRightTab = 'comments';
    const button = h.button(); assert.ok(button, 'actual scene action must exist before exercising refusal');
    if (fault === 'detached') button.remove();
    await button.emit('click'); await h.settle();
    assert.equal(h.commands.length, 0); assert.deepEqual(h.fields(), { title: TITLE, interpretation: INTERPRETATION });
    assert.equal(h.working(), TEXT);
    if (!['hidden-surface', 'hidden-tab', 'detached'].includes(fault))
      assert.match(h.c.getIdeaMeaningAuthorDraft().notice.textContent + ' ' + h.statuses.map(row => row.value).join(' '),
        /сохран|фрагмент|selection|saved|source/iu, 'readable source/refusal guidance');
  });

test('Scene Meaning failure retry retains one ID and changed fragment gets a different identity [FINITE_DOM]', async () => {
  const h = formDom(); await h.fill(); h.c.commandPort = () => ({ ok: false, reason: 'OWNED_PERSISTENCE_REFUSAL' });
  const first = await clickScene(h), retry = await clickScene(h);
  assertPayload(first); assert.equal(retry.payload.meaningId, first.payload.meaningId);
  assert.deepEqual(h.fields(), { title: TITLE, interpretation: INTERPRETATION });
  h.selection({ start: 0, end: END }); const changed = await clickScene(h);
  assert.notEqual(changed.payload.meaningId, first.payload.meaningId);
  assert.equal(changed.payload.source.originRef.targetId, changed.payload.meaningId);
});

test('Scene Meaning doubleclick admits one pending intent and preserves author input [FINITE_DOM]', async () => {
  const h = formDom(); await h.fill(); const gate = h.deferred(); h.c.commandPort = () => gate.promise;
  const button = h.button(); assert.ok(button); await button.emit('click'); await button.emit('click'); await h.settle();
  assert.equal(h.commands.length, 1); assert.equal(button.disabled, true); assert.equal(h.fireUnload().defaultPrevented, true);
  gate.resolve({ ok: false, reason: 'OWNED_REFUSAL' }); await h.settle();
  assert.deepEqual(h.fields(), { title: TITLE, interpretation: INTERPRETATION });
});

for (const fault of ['draft', 'project', 'scene', 'generation', 'publication', 'epoch', 'surface', 'dirty', 'source-hash', 'provider'])
  test('Scene Meaning delayed completion cannot replace newer ' + fault + ' presentation [FINITE_DOM]', async () => {
    const h = formDom(); await h.fill(); const gate = h.deferred(); h.c.commandPort = () => gate.promise;
    const button = h.button(); assert.ok(button); await button.emit('click'); await h.settle(); assert.equal(h.commands.length, 1);
    if (fault === 'draft') await h.input('meaningInterpretation', 'Более новая интерпретация é 🧭');
    if (fault === 'project') h.c.currentProjectId = 'other';
    if (fault === 'scene') h.c.currentDocumentId = 'other';
    if (fault === 'generation') h.c.localEditGeneration++;
    if (fault === 'publication') h.c.currentTreeContentPublicationId += '-new';
    if (fault === 'epoch') h.c.invalidateAtlasPublications();
    if (fault === 'surface') h.c.currentAtlasSurface = 'entity';
    if (fault === 'dirty') h.c.localDirty = true;
    if (fault === 'source-hash') h.c.atlasCurrentSceneState.summary.sceneTextHash = '1'.repeat(64);
    if (fault === 'provider') h.c.getIdeaMeaningAuthorDraft().provider = {};
    const before = h.fields(), queries = h.queries.length, status = 'new current presentation';
    h.statuses.push({ value: status });
    const applied = h.appliedResponse(); applied.value.commandId = applied.value.result.receipt.commandId = 'meaning.promote';
    gate.resolve(applied); await h.settle(); await h.settle();
    assert.deepEqual(h.fields(), before); assert.equal(h.statuses.at(-1).value, status);
    assert.equal(h.queries.length, queries); assert.equal(h.commands.length, 1); assert.equal(h.working(), TEXT);
  });

for (const response of [{ ok: true }, { ok: true, value: { performed: true } },
  { ok: true, value: { performed: true, commandAuthority: 'CommandKernel', commandId: 'meaning.promote',
    result: { ok: true, receipt: { schemaVersion: 'command-kernel.receipt.v1', commandId: 'meaning.promote',
      status: 'APPLIED', capabilityRevalidated: true, storageWritten: false } } } }])
  test('Scene Meaning forged response preserves unsaved interpretation ' + JSON.stringify(response) + ' [FINITE_DOM]', async () => {
    const h = formDom(); await h.fill(); h.c.commandPort = () => response; await clickScene(h);
    assert.deepEqual(h.fields(), { title: TITLE, interpretation: INTERPRETATION });
    assert.equal(h.fireUnload().defaultPrevented, true);
  });

for (const entropy of [undefined, { randomUUID() { throw new Error('OWNED_ENTROPY_FAULT'); } }])
  test('Scene Meaning entropy refusal has no dispatch fallback [FINITE_DOM] ' + (entropy ? 'throwing' : 'absent'), async () => {
    const h = formDom(); await h.fill(); h.c.crypto = entropy; await clickScene(h);
    assert.equal(h.commands.length, 0); assert.deepEqual(h.fields(), { title: TITLE, interpretation: INTERPRETATION });
    assert.ok(h.statuses.some(row => /IDENTITY_UNAVAILABLE/u.test(row.value)));
  });

test('Scene Meaning prose input retains focused control and performs no selection query or canonical source work [FINITE_DOM]', async () => {
  const h = formDom(), input = h.field('meaningInterpretation'); input.focus();
  h.c.composeDocumentContent = () => { throw new Error('HEAVY_SOURCE_WORK_DURING_AUTHOR_TYPING'); };
  const queries = h.queries.length;
  await h.input('meaningInterpretation', INTERPRETATION);
  input.setSelectionRange(2, 5, 'backward'); const writes = input.valueWrites, disconnects = input.disconnects;
  await input.emit('input');
  assert.equal(h.field('meaningInterpretation'), input); assert.equal(h.document.activeElement, input);
  assert.equal(input.valueWrites, writes); assert.equal(input.disconnects, disconnects);
  assert.deepEqual([input.selectionStart, input.selectionEnd, input.selectionDirection], [2, 5, 'backward']);
  assert.equal(h.selectionReads(), 0); assert.equal(h.queries.length, queries); assert.equal(h.commands.length, 0);
});

for (const fault of ['stale-source', 'range', 'capability', 'owner'])
  test('Scene Meaning existing registered Main refuses ' + fault + ' before persistence [FINITE_MAIN]', async t => {
    let armed = () => {};
    const x = await mainFixture(t, h => {
      if (fault === 'stale-source') h.main.__host.afterTruth(() => armed());
    }), payload = directPayload(x);
    if (fault === 'range') payload.source.originRef.endOffset = TEXT.length + 1;
    if (fault === 'capability') x.h.main.__host.denyCapability('cap.meaning.edit');
    if (fault === 'owner') x.h.main.__host.revokeOwner();
    let reached = 0;
    if (fault === 'stale-source') armed = () => {
      reached++; fs.writeFileSync(x.f.scenePath, fs.readFileSync(x.f.scenePath, 'utf8') + '\nChanged source');
    };
    const before = allFiles(x.h.root);
    const result = await x.ui('meaning.promote', payload);
    if (fault === 'stale-source') assert.equal(reached, 1, 'actual captured prepare boundary must execute before judging refusal');
    assert.equal(result.mainResult.ok, false, JSON.stringify(result));
    if (fault === 'stale-source') {
      const after = allFiles(x.h.root);
      assert.deepEqual(after.filter(([name]) => !name.endsWith(path.basename(x.f.scenePath))),
        before.filter(([name]) => !name.endsWith(path.basename(x.f.scenePath))));
      assert.equal(JSON.parse(fs.readFileSync(x.f.manifestPath)).meanings?.meanings?.[payload.meaningId], undefined);
    } else assert.deepEqual(allFiles(x.h.root), before, 'all source, author, receipt, anchor, fence, recovery and history bytes stay exact');
  });

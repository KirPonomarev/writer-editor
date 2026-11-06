'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const COMMAND = 'atlas.association.record';
const PROFILE = 'WRITER_LOCAL_ATLAS_ASSOCIATIONS_V13';
const TEXT = 'Мира доверяет Борису. e\u0301 🧭';
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const bytesHash = value => crypto.createHash('sha256').update(value).digest('hex');
// Independent JSON/crypto oracle, without the product hash/compiler/reducer.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const hash = value => bytesHash(canonical(value));
const digest = value => 'sha256:' + bytesHash(value);
const runtime = () => import(pathToFileURL(path.join(ROOT, 'src/core/runtime.mjs')).href);

async function coreFixture() {
  const core = await runtime(), projectId = 'authored-project', sceneId = 'authored-scene';
  const built = core.applyCoreSequence(core.createInitialCoreState(), [
    { type: 'project.create', payload: { projectId, sceneId, title: 'Protected authoring' } },
    { type: 'project.applyTextEdit', payload: { projectId, sceneId, text: TEXT } },
    { type: 'atlas.entity.create', payload: { projectId, entityId: 'mira', name: 'Мира' } },
    { type: 'atlas.entity.create', payload: { projectId, entityId: 'boris', name: 'Борис' } },
  ]);
  assert.equal(built.ok, true, JSON.stringify(built.error));
  const project = built.state.data.projects[projectId];
  project.manifestRevision = digest('saved-manifest'); project.projectRevisionId = digest('whole-book');
  project.revisionScope = 'WHOLE_PROJECT'; project.sceneOrder = [sceneId];
  project.scenes[sceneId].sceneRevision = digest('saved-scene-bytes');
  project.atlas.futureAuthorField = { unicode: 'e\u0301 🧭', nested: [{ retain: true }] };
  return { core, state: built.state, projectId, sceneId,
    intent(id = 'association-one') { return { operation: 'record', projectId, associationId: id,
      expectedManifestRevision: project.manifestRevision, expectedAssociationHash: '', expectedSceneRevision: project.scenes[sceneId].sceneRevision,
      associationKind: 'доверяет', direction: 'DIRECTED', sourceEntityId: 'mira', targetEntityId: 'boris', scopeKind: 'SCENE',
      source: { sceneId, startOffset: 0, endOffset: 4, sceneTextHash: hash(TEXT) } }; },
    apply(payload, state = built.state) { return core.reduceCoreState(state, { type: COMMAND, payload }); },
  };
}
function applied(f, payload, state = f.state) {
  const before = copy(state), result = f.apply(payload, state);
  assert.deepEqual(state, before, 'Core input remains immutable');
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.state.data.lastCommandId, before.data.lastCommandId + 1);
  return result;
}
function recordOf(f, state, id = 'association-one') { return state.data.projects[f.projectId].atlas.authoredAssociations[id]; }
function assertCoreProtected(f, before, after) {
  const strip = state => { const value = copy(state); delete value.data.projects[f.projectId].atlas.authoredAssociations; delete value.data.lastCommandId; return value; };
  assert.deepEqual(strip(after), strip(before), 'Every unrelated Core field/source/history/unknown field stays literal');
}

test('authored association Core records an explicit typed assertion from actual saved source, without mutating other data', async t => {
  const f = await coreFixture(), before = copy(f.state), payload = f.intent();
  const result = f.apply(payload); t.diagnostic(JSON.stringify({ reach: 'ACTUAL_CORE_REDUCER', commandId: COMMAND, ok: result.ok, error: result.error }));
  assert.deepEqual(f.state, before);
  if (!result.ok) assert.deepEqual(result.state, before, 'Legacy refusal has no mutation');
  assert.equal(result.ok, true, JSON.stringify(result.error));
  const record = recordOf(f, result.state);
  assert.equal(record.schemaVersion, 'atlas.authoredAssociation.v1'); assert.equal(record.id, payload.associationId);
  assert.equal(record.projectId, f.projectId); assert.equal(record.source, 'author'); assert.equal(record.revisions.length, 1);
  const revision = record.revisions[0];
  assert.equal(revision.revision, 1); assert.equal(revision.status, 'active'); assert.equal(revision.commandSeq, before.data.lastCommandId + 1);
  for (const key of ['associationKind', 'direction', 'sourceEntityId', 'targetEntityId', 'scopeKind']) assert.equal(revision[key], payload[key]);
  assert.equal(revision.source.sceneId, f.sceneId); assert.equal(revision.source.quote, 'Мира');
  assert.equal(revision.source.quoteHash, hash('Мира')); assert.equal(revision.source.sceneTextHash, hash(TEXT));
  assert.equal(revision.source.startOffset, 0); assert.equal(revision.source.endOffset, 4);
  assert.equal(revision.source.sceneRevision, payload.expectedSceneRevision); assert.equal(revision.source.manifestRevision, payload.expectedManifestRevision);
  assert.equal(typeof revision.source.anchorId, 'string'); assert.ok(revision.source.anchorId);
  assertCoreProtected(f, before, result.state);
});

test('authored association Core correction and stale-source withdrawal append literal history and survive serialization', async () => {
  const f = await coreFixture(), first = applied(f, f.intent()).state, record = copy(recordOf(f, first));
  const next = { ...f.intent(), expectedAssociationHash: hash(record), associationKind: 'помогает e\u0301 🧭', scopeKind: 'FRAGMENT' };
  const second = applied(f, next, first).state, corrected = recordOf(f, second);
  assert.deepEqual(corrected.revisions.slice(0, 1), record.revisions); assert.equal(corrected.revisions[1].associationKind, next.associationKind);
  assert.equal(corrected.revisions[1].revision, 2); assert.equal(corrected.revisions[1].scopeKind, 'FRAGMENT');
  const stale = copy(second); stale.data.projects[f.projectId].scenes[f.sceneId].text += ' Изменено.';
  stale.data.projects[f.projectId].scenes[f.sceneId].sceneRevision = digest('changed-scene');
  const withdrawn = applied(f, { operation: 'retract', projectId: f.projectId, associationId: record.id,
    expectedManifestRevision: f.intent().expectedManifestRevision, expectedAssociationHash: hash(corrected) }, stale).state;
  const result = recordOf(f, withdrawn); assert.equal(result.revisions.length, 3);
  assert.deepEqual(result.revisions.slice(0, 2), corrected.revisions); assert.equal(result.revisions[2].status, 'retracted');
  assert.deepEqual(result.revisions[2].source, corrected.revisions[1].source);
  assert.deepEqual(recordOf(f, JSON.parse(JSON.stringify(withdrawn))), result); assertCoreProtected(f, stale, withdrawn);
});

const malformed = [
  ['numeric project', p => { p.projectId = 7; }], ['empty project', p => { p.projectId = ''; }],
  ['object id', p => { p.associationId = {}; }], ['prototype id', p => { p.associationId = '__proto__'; }],
  ['unknown key', p => { p.storageAuthority = true; }], ['empty kind', p => { p.associationKind = '  '; }],
  ['oversize kind', p => { p.associationKind = 'x'.repeat(201); }], ['unknown direction', p => { p.direction = 'AUTOMATIC'; }],
  ['unknown scope', p => { p.scopeKind = 'ALL'; }], ['non-string entity', p => { p.targetEntityId = ['boris']; }],
  ['string offset', p => { p.source.startOffset = '0'; }], ['fractional offset', p => { p.source.endOffset = 3.5; }],
  ['unsafe offset', p => { p.source.endOffset = Number.MAX_SAFE_INTEGER + 1; }],
  ['unknown source key', p => { p.source.path = '/foreign/source'; }], ['wrong scene hash', p => { p.source.sceneTextHash = 'abc'; }],
  ['wrong manifest token', p => { p.expectedManifestRevision = 'sha256:BAD'; }], ['missing record CAS', p => { delete p.expectedAssociationHash; }],
];
for (const [label, alter] of malformed) test('authored association Core rejects raw ' + label + ' with complete state preservation', async () => {
  const f = await coreFixture(), before = copy(f.state), payload = f.intent(); alter(payload);
  const result = f.apply(payload); assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_ATLAS_ASSOCIATION_PAYLOAD_INVALID'); assert.deepEqual(result.state, before); assert.deepEqual(f.state, before);
});
const invalidSource = [
  ['self edge', p => { p.targetEntityId = p.sourceEntityId; }, 'ENTITY_UNAVAILABLE'],
  ['foreign entity', p => { p.targetEntityId = 'foreign-entity'; }, 'ENTITY_UNAVAILABLE'],
  ['foreign project', p => { p.projectId = 'foreign-project'; }, 'PROJECT_UNAVAILABLE'],
  ['stale manifest', p => { p.expectedManifestRevision = digest('other-manifest'); }, 'MANIFEST_STALE'],
  ['stale scene revision', p => { p.expectedSceneRevision = digest('other-scene'); }, 'SCENE_STALE'],
  ['stale scene text', p => { p.source.sceneTextHash = 'a'.repeat(64); }, 'SOURCE_STALE'],
  ['missing source scene', p => { p.source.sceneId = 'other-scene'; }, 'SCENE_STALE'],
  ['empty span', p => { p.source.endOffset = 0; }, 'RANGE_INVALID'],
  ['oversize span', p => { p.source.endOffset = TEXT.length + 1; }, 'RANGE_INVALID'],
  ['split combining grapheme', p => { p.source.startOffset = TEXT.indexOf('e'); p.source.endOffset = p.source.startOffset + 1; }, 'RANGE_INVALID'],
  ['split surrogate pair', p => { p.source.startOffset = TEXT.indexOf('🧭') + 1; p.source.endOffset = p.source.startOffset + 1; }, 'RANGE_INVALID'],
];
for (const [label, alter, code] of invalidSource) test('authored association Core refuses ' + label + ' without changing any state', async () => {
  const f = await coreFixture(), before = copy(f.state), payload = f.intent(); alter(payload);
  const result = f.apply(payload); assert.equal(result.ok, false); assert.equal(result.error.code, 'E_ATLAS_ASSOCIATION_' + code);
  assert.deepEqual(result.state, before); assert.deepEqual(f.state, before);
});

test('authored association Core forbids lost record CAS and duplicate assertions while allowing another explicit kind', async () => {
  const f = await coreFixture(), first = applied(f, f.intent()).state, before = copy(first);
  for (const payload of [f.intent(), { ...f.intent(), expectedAssociationHash: 'a'.repeat(64) }]) {
    const result = f.apply(payload, first); assert.equal(result.ok, false); assert.equal(result.error.code, 'E_ATLAS_ASSOCIATION_RECORD_STALE'); assert.deepEqual(result.state, before);
  }
  const duplicate = f.apply(f.intent('different-id'), first); assert.equal(duplicate.ok, false); assert.equal(duplicate.error.code, 'E_ATLAS_ASSOCIATION_DUPLICATE'); assert.deepEqual(duplicate.state, before);
  const other = applied(f, { ...f.intent('different-kind'), associationKind: 'помогает', scopeKind: 'BOOK' }, first).state;
  assert.deepEqual(recordOf(f, other), recordOf(f, first)); assert.equal(Object.keys(other.data.projects[f.projectId].atlas.authoredAssociations).length, 2);
});

test('authored association optional records remain literal through unrelated authoring and COPY changes only owner', async () => {
  const f = await coreFixture(), first = applied(f, f.intent()).state, record = copy(recordOf(f, first));
  const next = f.core.reduceCoreState(first, { type: 'atlas.entity.create', payload: { projectId: f.projectId, entityId: 'vera', name: 'Вера' } });
  assert.equal(next.ok, true); assert.deepEqual(recordOf(f, next.state), record);
  const atlas = next.state.data.projects[f.projectId].atlas, before = copy(atlas), copied = f.core.rebindAtlasContinuityFactsForProjectCopy(atlas, f.projectId, 'copied-project');
  assert.deepEqual(atlas, before); assert.equal(copied.authoredAssociations[record.id].projectId, 'copied-project');
  assert.deepEqual(copied.authoredAssociations[record.id].revisions, record.revisions);
  const expected = copy(before); expected.authoredAssociations[record.id].projectId = 'copied-project'; assert.deepEqual(copied, expected);
});

// Reuse the entire already-maintained inert Electron fixture function only.
// Its actual Main/Kernel/filesystem paths execute; no test declarations or
// historical constructor options are run and no native app is launched.
async function mainFixture(t, beforeProject, observeQueue = false, preserveCopyFixture = false) {
  const source = read('test/unit/r24-wp307-writer-local-profile-integration.test.js');
  const start = source.indexOf('async function fullMacMainFixture('), end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start);
  let fixtureSource = source.slice(start, end + 2);
  if (observeQueue) {
    const marker = '        holdProjectQueue(operation) { return enqueueProductCommandTransaction(currentProjectName || DEFAULT_PROJECT_NAME, operation); },';
    assert.equal(fixtureSource.split(marker).length,2);
    fixtureSource = fixtureSource.replace(marker, marker + '\n        observeAssociationQueue() { let calls = 0; const original = enqueueProductCommandTransaction; enqueueProductCommandTransaction = (...args) => { calls++; return original(...args); }; return () => calls; },');
  }
  if (preserveCopyFixture) {
    const cleanup = "assert.equal(fs.readFileSync(markerPath, 'utf8'), marker); fs.rmSync(root, { recursive: true });";
    assert.equal(fixtureSource.split(cleanup).length,2);
    fixtureSource = fixtureSource.replace(cleanup, "assert.equal(fs.readFileSync(markerPath, 'utf8'), marker); t.diagnostic('OWN_SYNTHETIC_COPY_ROOT_RETAINED ' + root);");
  }
  const build = new Function('require', 'assert', 'fs', 'path', 'crypto', 'ROOT', 'read', 'module', 'finiteManualMapPdf',
    'return (' + fixtureSource + ');')(require, assert, fs, path, crypto, ROOT, read, module,
    () => { throw new Error('This association fixture has no PDF effect'); });
  const h = await build(t, { packaged: true, platform: 'darwin', rendererLoaded: true });
  if (beforeProject) beforeProject(h); // The real project route captures its prepare port during creation.
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Authored relationships' }); assert.equal(made.ok, true, JSON.stringify(made));
  const projectId = made.projectId, tree = await h.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' }); assert.equal(tree.ok, true);
  const flat = node => [node, ...(node.children || []).flatMap(flat)], scene = flat(tree.root).find(row => row.kind === 'scene' || row.kind === 'chapter-file'); assert.ok(scene);
  const resolved = await h.main.resolveProjectTreeNodeIdentity(scene.nodeId, projectId), envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const text = 'Свет в окне погас. e\u0301 🧭', seeded = envelope.composeDocumentContentFromBase({ baseContent: fs.readFileSync(resolved.nodePath, 'utf8'), nextVisibleText: text });
  assert.equal(seeded.ok, true); fs.writeFileSync(resolved.nodePath, seeded.content);
  for (const [entityId, name] of [['mira', 'Мира'], ['boris', 'Борис']]) {
    const result = await h.command('atlas.entity.create', { projectId, entityId, name, entityKind: 'character' }); assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.receipt.storageWritten, true, 'Existing actual Kernel positive control');
  }
  const manifestPath = path.join(h.documents, 'craftsman', 'Authored relationships', 'project.craftsman.json');
  return { h, projectId, sceneId: scene.nodeId, scenePath: resolved.nodePath, manifestPath, text,
    manifest() { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); },
    intent(id = 'association-one') { return { operation: 'record', projectId, associationId: id,
      expectedManifestRevision: digest(fs.readFileSync(manifestPath)), expectedAssociationHash: '', expectedSceneRevision: digest(fs.readFileSync(resolved.nodePath)),
      associationKind: 'доверяет', direction: 'DIRECTED', sourceEntityId: 'mira', targetEntityId: 'boris', scopeKind: 'SCENE',
      source: { sceneId: scene.nodeId, startOffset: 0, endOffset: 16, sceneTextHash: hash(text) } }; },
  };
}
function assertMainApplied(result) {
  assert.equal(result.ok, true, JSON.stringify(result)); const receipt = result.value?.receipt;
  assert.equal(receipt?.schemaVersion, 'command-kernel.receipt.v1'); assert.equal(receipt.commandId, COMMAND);
  assert.equal(receipt.status, 'APPLIED'); assert.equal(receipt.storageWritten, true); assert.equal(receipt.capabilityRevalidated, true);
}

test('authored association real Main/Kernel persists explicit meaning without co-occurrence, reads source and retains correction/withdrawal history [FINITE_IPC_NOT_NATIVE]', async t => {
  const f = await mainFixture(t), before = f.manifest(), roster = f.h.roster(), sceneBytes = fs.readFileSync(f.scenePath), payload = f.intent();
  const result = await f.h.command(COMMAND, { ...payload, editorMode: 'tiptap' });
  t.diagnostic(JSON.stringify({ reach: 'ACTUAL_MAIN_REGISTERED_ENVELOPE', profileId: f.h.main.__profile().profileId, payload, result }));
  if (!result.ok) assert.deepEqual(f.h.roster(), roster, 'Legacy route refusal preserves the entire Documents roster');
  assertMainApplied(result); assert.equal(f.h.main.__profile().profileId, PROFILE);
  const saved = f.manifest(), record = saved.atlas.authoredAssociations[payload.associationId];
  assert.equal(saved.lastCommandId, before.lastCommandId + 1); assert.equal(record.revisions.length, 1);
  assert.equal(record.revisions[0].source.quote, f.text.slice(0, 16)); assert.deepEqual(fs.readFileSync(f.scenePath), sceneBytes);
  const strip = value => { const result = copy(value); delete result.atlas.authoredAssociations; delete result.lastCommandId; return result; };
  assert.deepEqual(strip(saved), strip(before));
  const queried = await f.h.query('query.atlasRelationDossier', { projectId: f.projectId }); assert.equal(queried.ok, true);
  const dossier = queried.atlasRelationDossier, authored = dossier.authoredAssociations;
  assert.equal(dossier.summary.occurrenceCount, 0, 'Authored meaning does not fabricate algorithmic co-occurrence');
  assert.equal(authored.state, 'ready'); assert.equal(authored.rows.length, 1); assert.equal(authored.rows[0].recordHash, hash(record));
  assert.equal(authored.rows[0].sourceState, 'current'); assert.equal(authored.rows[0].latest.associationKind, 'доверяет');
  assert.equal(authored.manifestRevision, digest(fs.readFileSync(f.manifestPath)));
  const second = await f.h.command(COMMAND, { ...f.intent(), expectedAssociationHash: hash(record), associationKind: 'помогает', editorMode: 'tiptap' }); assertMainApplied(second);
  const corrected = f.manifest().atlas.authoredAssociations[record.id]; assert.deepEqual(corrected.revisions.slice(0, 1), record.revisions);
  const withdrawal = await f.h.command(COMMAND, { operation: 'retract', projectId: f.projectId, associationId: record.id,
    expectedManifestRevision: digest(fs.readFileSync(f.manifestPath)), expectedAssociationHash: hash(corrected), editorMode: 'tiptap' }); assertMainApplied(withdrawal);
  const final = f.manifest().atlas.authoredAssociations[record.id]; assert.equal(final.revisions.length, 3); assert.equal(final.revisions[2].status, 'retracted');
  assert.deepEqual(final.revisions.slice(0, 2), corrected.revisions); assert.deepEqual(fs.readFileSync(f.scenePath), sceneBytes);
});

test('authored association actual Main refuses stale manifest/source and raw transport authority without any write [FINITE_IPC_NOT_NATIVE]', async t => {
  const f = await mainFixture(t);
  for (const [label, change] of [['stale manifest', p => { p.expectedManifestRevision = digest('stale'); }],
    ['stale source', p => { p.expectedSceneRevision = digest('stale'); }], ['raw numeric project', p => { p.projectId = 7; }],
    ['transport mode spoof', p => { p.editorMode = 'PRO'; }], ['path authority', p => { p.path = '/foreign'; }]]) {
    const payload = { ...f.intent(), editorMode: 'tiptap' }; change(payload); const before = f.h.roster();
    const result = await f.h.command(COMMAND, payload); t.diagnostic(JSON.stringify({ label, result }));
    assert.equal(result.ok, false); assert.deepEqual(f.h.roster(), before, label);
  }
});

test('authored association actual queued Main capability revocation cannot persist a previously valid intent [FINITE_IPC_NOT_NATIVE]', async t => {
  const f = await mainFixture(t), payload = f.intent(), before = f.h.roster();
  let release, entered; const ready = new Promise(resolve => { entered = resolve; });
  const held = f.h.main.__host.holdProjectQueue(async () => { entered(); await new Promise(resolve => { release = resolve; }); }); await ready;
  const pending = f.h.command(COMMAND, payload); f.h.main.__host.denyCapability('cap.atlas.association.record'); release(); await held;
  const result = await pending; assert.equal(result.ok, false); assert.deepEqual(f.h.roster(), before);
});

function associationNavigationTarget(f, record) {
  return { schemaVersion: 'atlas.authoredAssociationNavigation.v1', projectId: f.projectId, associationId: record.id, recordHash: hash(record),
    manifestRevision: digest(fs.readFileSync(f.manifestPath)), sceneRevision: digest(fs.readFileSync(f.scenePath)), sceneId: f.sceneId };
}

test('authored association exact source navigation publishes only the Core-owned saved span [FINITE_IPC_NOT_NATIVE]', async t => {
  const f = await mainFixture(t); assertMainApplied(await f.h.command(COMMAND, f.intent()));
  const record = f.manifest().atlas.authoredAssociations['association-one'], before = copy(record), bytes = fs.readFileSync(f.scenePath);
  const result = await f.h.command('cmd.project.document.open', { projectId: f.projectId, nodeId: f.sceneId,
    expectedAtlasAssociationSource: associationNavigationTarget(f, record) });
  assert.equal(result.ok, true, JSON.stringify(result));
  const published = f.h.sent.filter(([channel]) => channel === 'editor:set-text').at(-1)?.[1];
  assert.deepEqual(published?.selectionRange, { start: 0, end: 16 }); assert.deepEqual(fs.readFileSync(f.scenePath), bytes);
  assert.deepEqual(f.manifest().atlas.authoredAssociations['association-one'], before);
});

test('authored association raw/stale source expectation refuses before document publication or I/O [FINITE_IPC_NOT_NATIVE]', async t => {
  const f = await mainFixture(t); assertMainApplied(await f.h.command(COMMAND, f.intent()));
  const record = f.manifest().atlas.authoredAssociations['association-one'];
  const cases = [['wrong record hash', p => { p.recordHash = 'a'.repeat(64); }], ['wrong manifest', p => { p.manifestRevision = digest('stale'); }],
    ['wrong scene revision', p => { p.sceneRevision = digest('stale'); }], ['foreign owner', p => { p.projectId = 'foreign'; }],
    ['foreign association', p => { p.associationId = 'foreign'; }], ['unknown schema', p => { p.schemaVersion += '.near'; }],
    ['unknown authority key', p => { p.storageAuthority = true; }], ['raw non-string record', p => { p.recordHash = {}; }]];
  for (const [label, change] of cases) await t.test(label, async child => {
    const target = associationNavigationTarget(f, record); change(target); const before = f.h.roster(), sent = f.h.sent.length;
    const result = await f.h.command('cmd.project.document.open', { projectId: f.projectId, nodeId: f.sceneId, expectedAtlasAssociationSource: target });
    child.diagnostic(JSON.stringify({ label, result, newEditorPublications: f.h.sent.slice(sent).filter(([channel]) => channel === 'editor:set-text').length }));
    assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(f.h.roster(), before);
    assert.equal(f.h.sent.slice(sent).some(([channel]) => channel === 'editor:set-text'), false);
  });
});

test('authored association entity merge retains every revision and distinguishes unavailable semantics from an exact source [FINITE_IPC_NOT_NATIVE]', async t => {
  const f = await mainFixture(t); assertMainApplied(await f.h.command(COMMAND, f.intent()));
  const before = copy(f.manifest().atlas.authoredAssociations);
  const merged = await f.h.command('atlas.entity.merge', { projectId: f.projectId, sourceEntityId: 'mira', targetEntityId: 'boris', operationId: 'association-source-merge' });
  assert.equal(merged.ok, true, JSON.stringify(merged)); assert.deepEqual(f.manifest().atlas.authoredAssociations, before);
  const result = await f.h.query('query.atlasRelationDossier', { projectId: f.projectId });
  const value = result.atlasRelationDossier.authoredAssociations;
  assert.equal(value.state, 'ready'); assert.equal(value.rows[0].sourceState, 'current'); assert.equal(value.rows[0].entityState, 'unavailable');
  assert.equal(value.currentAssociationCount, 0); assert.equal(value.rows[0].recordHash, hash(before['association-one']));
});

for (const [label, revoke] of [['capability', h => h.__host.denyCapability('cap.atlas.association.record')],
  ['profile', h => h.__host.revokeProfile()], ['owner', h => h.__host.revokeOwner()],
  ['session', h => h.__host.invalidateSession()], ['generation', h => h.__host.invalidateGeneration()]]) {
  test('authored association actual after-preparation ' + label + ' revocation refuses before persistence [FINITE_IPC_NOT_NATIVE]', async t => {
    let armed = false, reached = 0;
    const f = await mainFixture(t, h => h.main.__host.afterTruth(() => { if (armed) { reached++; revoke(h.main); } }));
    const before = f.h.roster(); armed = true;
    const result = await f.h.command(COMMAND, f.intent());
    assert.equal(reached, 1, 'Actual canonical preparation must have completed before the fault');
    assert.equal(result.ok, false); assert.deepEqual(f.h.roster(), before); assert.equal(f.manifest().atlas.authoredAssociations, undefined);
  });
}

test('authored association projection compiles each explicit applicability without changing saved author data', async () => {
  const { deriveAtlasAuthoredAssociations } = await import('../../src/derived/atlas/deriveAtlasAuthoredAssociations.mjs');
  for (const scopeKind of ['BOOK', 'SCENE', 'FRAGMENT']) {
    const f = await coreFixture(), state = applied(f, { ...f.intent(), scopeKind }).state, before = copy(state);
    const value = deriveAtlasAuthoredAssociations({ coreState: state, params: { projectId: f.projectId } });
    assert.equal(value.state, 'ready', JSON.stringify(value)); assert.equal(value.currentAssociationCount, 1);
    assert.equal(value.rows[0].latest.scopeKind, scopeKind); assert.equal(value.rows[0].sourceState, 'current');
    assert.equal(value.rows[0].recordHash, hash(recordOf(f, state))); assert.equal(value.sourceUniverseIsNotApplicabilityQuery, true);
    assert.equal(Object.isFrozen(value), true); assert.equal(Object.isFrozen(value.rows[0].latest), true); assert.deepEqual(state, before);
  }
});

test('authored association malformed optional collections and raw accessors cannot erase history or execute normalization', async () => {
  for (const value of [null, [], { broken: { schemaVersion: 'future.v2' } }]) {
    const f = await coreFixture(); f.state.data.projects[f.projectId].atlas.authoredAssociations = value;
    const before = copy(f.state), result = f.apply(f.intent()); assert.equal(result.ok, false);
    assert.equal(result.error.code, 'E_ATLAS_ASSOCIATION_SCHEMA_UNSUPPORTED'); assert.deepEqual(result.state, before);
  }
  const f = await coreFixture(); let reads = 0; const payload = f.intent();
  Object.defineProperty(payload.source, 'startOffset', { enumerable: true, get() { reads++; return 0; } });
  const result = f.apply(payload); assert.equal(result.ok, false); assert.equal(result.error.code, 'E_ATLAS_ASSOCIATION_PAYLOAD_INVALID'); assert.equal(reads, 0);
});

async function associationDomFixture(t, options = {}) {
  const f = await mainFixture(t), vm = require('node:vm');
  const registryModule = await import('../../src/renderer/commands/registry.mjs'), projectModule = await import('../../src/renderer/commands/projectCommands.mjs');
  const runnerModule = await import('../../src/renderer/commands/runCommand.mjs'), busModule = await import('../../src/renderer/commands/commandBusGuard.mjs');
  const registry = registryModule.createCommandRegistry(), transports = [], notices = [], queries = [], document = { activeElement: null };
  let optionEnumerations = 0;
  const query = async (id, payload) => { queries.push({ id, payload: copy(payload) }); return f.h.query(id, payload); };
  projectModule.registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async request => {
    const invoke = () => f.h.command(request.commandId, structuredClone(request.payload));
    const result = options.reply ? await options.reply(request, invoke) : await invoke();
    transports.push({ request: structuredClone(request), result: copy(result) }); return result;
  } } });
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = new Map(); this.parentNode = null;
      this.value = ''; this.disabled = false; this.hidden = false; this._text = ''; this.selectionStart = 0; this.selectionEnd = 0; this.classList = { toggle() {}, add() {}, remove() {}, contains() { return false; } }; }
    get isConnected() { return this.root === true || Boolean(this.parentNode?.isConnected); }
    get parentElement() { return this.parentNode; }
    get childElementCount() { return this.children.length; }
    get firstChild() { return this.children[0] || null; }
    get options() { optionEnumerations++; return this.children.filter(node => node.tagName === 'OPTION'); }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    appendChild(node) { node.remove(); node.parentNode = this; this.children.push(node); return node; }
    insertBefore(node, before) { node.remove(); const i = this.children.indexOf(before); node.parentNode = this; this.children.splice(i < 0 ? this.children.length : i, 0, node); return node; }
    remove() { if (!this.parentNode) return; if (this.contains(document.activeElement)) document.activeElement = null;
      const p = this.parentNode; p.children.splice(p.children.indexOf(this), 1); this.parentNode = null; }
    replaceChildren(...nodes) { [...this.children].forEach(node => node.remove()); this.append(...nodes); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    set innerHTML(value) { assert.equal(value, ''); this.replaceChildren(); this._text = ''; }
    get innerHTML() { return this.textContent; }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(name, listener) { const listeners = this.listeners.get(name) || []; listeners.push(listener); this.listeners.set(name, listeners); }
    async fire(name, details = {}) { const event = { target: this, preventDefault() {}, stopPropagation() {}, ...details };
      for (const listener of this.listeners.get(name) || []) await listener(event); }
    focus() { if (this.isConnected) document.activeElement = this; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    querySelectorAll(selector) { return this.all(node => selector === 'option' ? node.tagName === 'OPTION'
      : selector === 'button' ? node.tagName === 'BUTTON' : selector === 'input, select' ? ['INPUT','SELECT'].includes(node.tagName) : false).filter(node => node !== this); }
    all(predicate) { return [...(predicate(this) ? [this] : []), ...this.children.flatMap(node => node.all(predicate))]; }
  }
  document.createElement = tag => new Element(tag); const host = new Element(); host.root = true;
  const parent = (await f.h.query('query.atlasRelationDossier', { projectId: f.projectId })).atlasRelationDossier;
  const scene = (await f.h.query('query.atlasCurrentScene', { projectId: f.projectId, nodeId: f.sceneId })).atlasCurrentScene;
  const tree = await f.h.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' }); assert.equal(tree.ok, true);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const context = { document, HTMLElement: Element, HTMLButtonElement: Element, HTMLInputElement: Element, HTMLSelectElement: Element, Element,
    window: { __PRODUCT_PROFILE: PROFILE, crypto: { randomUUID: crypto.randomUUID } },
    currentProjectId: f.projectId, currentDocumentId: f.sceneId, currentRightTab: 'atlas', currentAtlasSurface: 'relation',
    localDirty: false, localEditGeneration: 0, lastAckedGeneration: 0, currentTreeContentPublicationId: 'finite-owned-publication',
    atlasPublicationEpoch: 1, manualMapDraftOwnership: {}, manualMapDraftRevision: 0, atlasJourneyDraftRevision: 0,
    atlasCommandPublicationSequence: 0, atlasQueryPublicationSequences: new Map(), atlasAssociationAuthorDrafts: new Map(),
    atlasRelationDossierHost: host, atlasRelationDossierState: parent, atlasCurrentSceneState: scene,
    atlasSelectedRelation: { pairId: '', leftEntityId: '', rightEntityId: '' },
    reviewSurfaceIsPlainObject: value => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    applyAtlasResolvedSurfaceBinding() {}, isNavigatorContextCommandAvailable: () => true,
    treeRoot: tree.root, EXTRA_COMMAND_IDS: projectModule.EXTRA_COMMAND_IDS, activeDocumentRevealRequested: false,
    currentDocumentKind: 'scene', metaEnabled: true, updateMetaVisibility() {}, updateInspectorSnapshot() {}, refreshMetadataInspector() {}, refreshSceneHistory() {}, refreshActiveAtlasSurface() {},
    invalidateAtlasPublications() { context.atlasPublicationEpoch++; },
    getSelectionOffsets: () => ({ start: 0, end: 16 }), composeDocumentContent: () => fs.readFileSync(f.scenePath, 'utf8'),
    parseDocumentContent: value => envelope.parseObservablePayload(value), getPlainText: () => f.text, hashCanonicalValue: hash,
    isTiptapMode: true, COMMAND_BUS_ROUTE: 'command.bus', runCommandThroughBus: busModule.runCommandThroughBus,
    runCommand: runnerModule.createCommandRunner(registry, { capability: { platformId: 'node', editorMode: 'tiptap' } }),
    updateStatusText: text => notices.push(text), mapCommandErrorToUi: error => ({ userMessage: error.reason, severity: 'INFO' }), console,
    appendAtlasReportsRow(parent, title, detail) { const node = new Element(); node.textContent = title + ' ' + (detail || ''); parent.append(node); return node; },
    appendAtlasOverviewSection(parent, title) { const node = new Element('section'); const heading = new Element('h3'); heading.textContent = title; node.append(heading); parent.append(node); return node; },
    appendAtlasOverviewMetric() {}, appendAtlasOverviewRow() {}, renderAtlasWorkspaceState() {},
    async refreshAtlasCurrentScene() { context.atlasCurrentSceneState = (await query('query.atlasCurrentScene', { projectId: f.projectId, nodeId: f.sceneId })).atlasCurrentScene; },
    async refreshAtlasRelationDossier() { const entry = context.getAtlasAssociationDraft();
      context.atlasRelationDossierState = (await query('query.atlasRelationDossier', { projectId: f.projectId,
        authoredOffset: entry.offset || 0, selectedAssociationId: entry.selectedId || entry.intentId || '' })).atlasRelationDossier;
      context.renderAtlasRelationDossierState(); },
  };
  const source = read('src/renderer/editor.js'); vm.createContext(context);
  const names = ['normalizeAtlasRelationDossier','renderAtlasRelationDossierState','captureAtlasPublication','isIdeaMeaningSceneSourceCurrent','getIdeaMeaningSceneOrigin',
    'withEditorModeCommandPayload','dispatchUiCommand','normalizeAtlasAuthoredAssociations','getAtlasAssociationDraft','getAtlasAssociationState',
    'getAtlasAssociationSelectedRow','isAtlasAssociationPresentationCurrent','isAtlasAssociationSourceCurrent','syncAtlasAssociationForm',
    'getAtlasAssociationAuthorForm','captureAtlasAssociationSource','runAtlasAssociationCommand','renderAtlasAuthoredAssociations','openAtlasAssociationSource','guardAtlasAssociationDraftUnload',
    'getEffectiveDocumentId','getEffectiveDocumentKind','findTreeNodeById','openDocumentNode'];
  for (const name of names) {
    const marker = 'function ' + name + '(', start = source.indexOf(marker); if (start < 0) continue;
    const end = source.indexOf('\n}\n', start); assert.ok(end > start, name);
    vm.runInContext(source.slice(source.slice(start - 6, start) === 'async ' ? start - 6 : start, end + 2), context);
  }
  context.renderAtlasRelationDossierState();
  return { f, context, host, document, transports, notices, queries, optionEnumerations: () => optionEnumerations, fields: () => host.all(node => node.dataset.atlasAssociationField),
    action: name => host.all(node => node.dataset.atlasAssociationAction === name)[0],
    async settled() { const deadline = Date.now() + 5000; while (context.getAtlasAssociationDraft().pending?.active) {
      assert.ok(Date.now() < deadline, 'Finite source operation completed'); await new Promise(resolve => setImmediate(resolve)); } },
  };
}

test('authored association actual Relation render exposes a retained labelled form and refuses stale input events [FINITE_DOM_NOT_NATIVE]', async t => {
  const ui = await associationDomFixture(t), fields = ui.fields();
  assert.deepEqual(fields.map(node => node.dataset.atlasAssociationField).sort(), ['associationKind','direction','scopeKind','sourceEntityId','targetEntityId']);
  const kind = fields.find(node => node.dataset.atlasAssociationField === 'associationKind');
  kind.value = 'помогает e\u0301 🧭'; kind.focus(); kind.setSelectionRange(3, 3); await kind.fire('input');
  ui.context.renderAtlasRelationDossierState(); assert.equal(ui.fields().find(node => node.dataset.atlasAssociationField === 'associationKind'), kind);
  assert.equal(ui.document.activeElement, kind, 'Do not detach and refocus a working input'); assert.equal(kind.selectionStart, 3); assert.equal(kind.selectionEnd, 3);
  assert.equal(ui.transports.length, 0, 'No command/persistence per character'); assert.equal(ui.queries.length, 0, 'No read query per character');
  const entry = ui.context.getAtlasAssociationDraft(), before = entry.fields.associationKind;
  ui.context.currentAtlasSurface = 'journey'; kind.value = 'late detached surface event'; await kind.fire('input');
  assert.equal(entry.fields.associationKind, before); assert.equal(ui.transports.length, 0);
});

async function fillAssociationForm(ui, kind = 'помогает e\u0301 🧭', scope = 'SCENE') {
  for (const [key, value] of [['associationKind', kind], ['sourceEntityId', 'mira'], ['targetEntityId', 'boris'], ['scopeKind', scope]]) {
    const field = ui.fields().find(node => node.dataset.atlasAssociationField === key); assert.ok(field); field.value = value;
    await field.fire(field.tagName === 'INPUT' ? 'input' : 'change');
  }
  assert.equal(ui.transports.length, 0); assert.equal(ui.queries.length, 0);
  await ui.action('source').fire('click'); await ui.settled();
  assert.equal(ui.context.getAtlasAssociationDraft().source?.quote, ui.f.text.slice(0,16)); assert.equal(ui.action('record').disabled, false);
}

test('authored association actual renderer port records, corrects, withdraws and retains two independent assertions [FINITE_DOM_NOT_NATIVE]', async t => {
  const ui = await associationDomFixture(t), sceneBefore = fs.readFileSync(ui.f.scenePath), unrelated = copy(ui.f.manifest().atlas);
  await fillAssociationForm(ui); const entry = ui.context.getAtlasAssociationDraft(), kind = entry.fields.associationKind;
  await ui.action('record').fire('click'); assert.equal(ui.transports.length, 1); assertMainApplied(ui.transports[0].result);
  const id = Object.keys(ui.f.manifest().atlas.authoredAssociations)[0], first = copy(ui.f.manifest().atlas.authoredAssociations[id]);
  assert.equal(entry.dirty, false); assert.equal(entry.selectedId, id); assert.match(entry.status, /сохранена/u);
  assert.equal(first.revisions[0].associationKind, kind); assert.equal(first.revisions[0].source.quote, ui.f.text.slice(0,16));
  assert.equal(Object.hasOwn(ui.transports[0].request.payload.source, 'quote'), false, 'Renderer never supplies canonical source bytes');
  const input = ui.fields().find(node => node.dataset.atlasAssociationField === 'associationKind'); input.value = 'защищает'; await input.fire('input');
  await ui.action('source').fire('click'); await ui.action('record').fire('click'); assert.equal(ui.transports.length, 2);
  const corrected = copy(ui.f.manifest().atlas.authoredAssociations[id]); assert.deepEqual(corrected.revisions[0], first.revisions[0]); assert.equal(corrected.revisions.length, 2);
  await ui.action('retract').fire('click'); assert.equal(ui.transports.length, 3); assertMainApplied(ui.transports[2].result);
  const withdrawn = copy(ui.f.manifest().atlas.authoredAssociations[id]); assert.deepEqual(withdrawn.revisions.slice(0,2), corrected.revisions); assert.equal(withdrawn.revisions[2].status, 'retracted');
  await ui.action('discard').fire('click'); assert.equal(entry.dirty, false);
  for (const [key,value] of [['associationKind','наблюдает'],['sourceEntityId','boris'],['targetEntityId','mira'],['scopeKind','FRAGMENT']]) {
    const field = ui.fields().find(node => node.dataset.atlasAssociationField === key);field.value=value; await field.fire(field.tagName === 'INPUT' ? 'input' : 'change'); }
  await ui.action('source').fire('click'); await ui.action('record').fire('click'); assert.equal(ui.transports.length, 4);
  const after = ui.f.manifest(); assert.equal(Object.keys(after.atlas.authoredAssociations).length, 2); assert.deepEqual(after.atlas.authoredAssociations[id], withdrawn);
  const newRow = Object.values(after.atlas.authoredAssociations).find(row => row.id !== id); assert.equal(newRow.revisions[0].scopeKind,'FRAGMENT');
  const { authoredAssociations, ...oldAtlas } = after.atlas; assert.deepEqual(oldAtlas, unrelated); assert.deepEqual(fs.readFileSync(ui.f.scenePath),sceneBefore);
  assert.deepEqual(JSON.parse(JSON.stringify(authoredAssociations)),authoredAssociations,'Ordinary JSON persistence roundtrip, not native cold proof');
  assert.equal((await ui.f.h.query('query.atlasRelationDossier',{ projectId:ui.f.projectId })).atlasRelationDossier.summary.occurrenceCount,0);
});

test('authored association unconfirmed IPC response retains raw Unicode input and source [FINITE_DOM_NOT_NATIVE]', async t => {
  const ui = await associationDomFixture(t,{ reply: async () => ({ok:true,value:{receipt:{schemaVersion:'command-kernel.receipt.v1',commandId:COMMAND,status:'APPLIED',storageWritten:false,capabilityRevalidated:true}}}) });
  await fillAssociationForm(ui); const entry=ui.context.getAtlasAssociationDraft(), fields=copy(entry.fields), source=entry.source, before=ui.f.h.roster();
  await ui.action('record').fire('click'); assert.equal(ui.transports.length,1); assert.equal(entry.dirty,true); assert.deepEqual(copy(entry.fields),fields); assert.equal(entry.source,source);
  assert.match(entry.status,/не подтверждено/u); assert.ok(entry.intentId); assert.deepEqual(ui.f.h.roster(),before);assert.equal(ui.f.manifest().atlas.authoredAssociations,undefined);
});

test('authored association late response after real persistence cannot acknowledge or erase a newer draft [FINITE_DOM_NOT_NATIVE]', async t => {
  let ui;
  ui = await associationDomFixture(t,{ reply: async (request,invoke) => { const result=await invoke();assertMainApplied(result);
    const entry=ui.context.getAtlasAssociationDraft();entry.fields.associationKind='новый ввод';entry.revision++;entry.dirty=true;return result; } });
  await fillAssociationForm(ui); const source=ui.context.getAtlasAssociationDraft().source; await ui.action('record').fire('click');
  const entry=ui.context.getAtlasAssociationDraft();assert.equal(Object.keys(ui.f.manifest().atlas.authoredAssociations).length,1,'Actual backend commit survives presentation change');
  assert.equal(entry.fields.associationKind,'новый ввод');assert.equal(entry.dirty,true);assert.equal(entry.source,source);assert.match(entry.status,/прежнему состоянию/u);assert.equal(entry.pending,null);
});

test('authored association withdrawal must not mark edited fields saved or discard their unload protection [FINITE_DOM_NOT_NATIVE]', async t => {
  const ui=await associationDomFixture(t); await fillAssociationForm(ui);await ui.action('record').fire('click');assert.equal(ui.action('retract').disabled,false);
  const input=ui.fields().find(node=>node.dataset.atlasAssociationField==='associationKind');input.value='несохранённая правка';await input.fire('input');
  assert.equal(ui.action('retract').disabled,true,'Withdraw only the selected saved assertion; preserve unrelated working fields');
  const before=ui.f.h.roster();await ui.action('retract').fire('click');assert.equal(ui.transports.length,1);assert.deepEqual(ui.f.h.roster(),before);
  let prevented=0;ui.context.guardAtlasAssociationDraftUnload({preventDefault(){prevented++;},stopImmediatePropagation(){},returnValue:null});assert.equal(prevented,1);
  assert.equal(ui.context.getAtlasAssociationDraft().dirty,true);assert.equal(ui.context.getAtlasAssociationDraft().fields.associationKind,'несохранённая правка');
});

test('authored association pending source response and detached events cannot target another project [FINITE_DOM_NOT_NATIVE]', async t => {
  const ui=await associationDomFixture(t), entry=ui.context.getAtlasAssociationDraft(), input=ui.fields().find(node=>node.dataset.atlasAssociationField==='associationKind');
  input.value='исходный ввод';await input.fire('input');let release, reached=0;
  ui.context.refreshAtlasCurrentScene=async()=>{reached++;await new Promise(resolve=>{release=resolve;});};
  const pending=ui.action('source').fire('click');assert.equal(reached,1);assert.equal(entry.pending.active,true);assert.equal(input.disabled,true);
  input.value='подмена во время ожидания';await input.fire('input');assert.equal(entry.fields.associationKind,'исходный ввод');
  ui.context.currentProjectId='another-project';release();await pending;assert.equal(entry.source,null);assert.equal(entry.fields.associationKind,'исходный ввод');
  assert.equal(entry.pending,null);assert.equal(entry.dirty,true);assert.equal(ui.transports.length,0);assert.equal(ui.f.manifest().atlas.authoredAssociations,undefined);
});

test('authored association focused participant select retains its options during read refresh [FINITE_DOM_NOT_NATIVE]', async t => {
  const ui=await associationDomFixture(t), select=ui.fields().find(node=>node.dataset.atlasAssociationField==='sourceEntityId');
  select.value='mira';await select.fire('change');select.focus();const options=[...select.options];
  await ui.context.refreshAtlasRelationDossier();assert.equal(ui.document.activeElement,select);assert.deepEqual([...select.options],options);
  const input=ui.fields().find(node=>node.dataset.atlasAssociationField==='associationKind');input.value='пробный ввод';input.focus();await input.fire('input');
  assert.equal(select.value,'mira');assert.ok(select.options.some(option=>option.value==='boris'));assert.equal(ui.transports.length,0);
});

for (const [label,revoke] of [['capability',h=>h.__host.denyCapability('cap.atlas.association.record')],['profile',h=>h.__host.revokeProfile()],
  ['owner',h=>h.__host.revokeOwner()],['session',h=>h.__host.invalidateSession()],['generation',h=>h.__host.invalidateGeneration()],
  ['lifecycle',h=>h.__host.invalidateLifecycle()],['root',h=>h.__host.invalidateProjectRoot()],['entitlement',h=>h.__host.revokeEntitlement(COMMAND)]]) {
  test('authored association observed real queue admission then '+label+' revocation refuses before persistence [FINITE_IPC_NOT_NATIVE]',async t=>{
    const f=await mainFixture(t,undefined,true), count=f.h.main.__host.observeAssociationQueue(), before=f.h.roster();let release,entered;
    const ready=new Promise(resolve=>{entered=resolve;}), held=f.h.main.__host.holdProjectQueue(async()=>{entered();await new Promise(resolve=>{release=resolve;});});await ready;assert.equal(count(),1);
    const pending=f.h.command(COMMAND,f.intent()), deadline=Date.now()+5000;
    while(count()<2){assert.ok(Date.now()<deadline,'Actual product transaction queued behind real held operation');await new Promise(resolve=>setImmediate(resolve));}
    assert.equal(count(),2);revoke(f.h.main);release();await held;const result=await pending;
    assert.equal(result.ok,false,JSON.stringify(result));assert.deepEqual(f.h.roster(),before);assert.equal(f.manifest().atlas.authoredAssociations,undefined);
  });
}

test('authored association real post-preparation source-file change refuses without overwriting the external edit [FINITE_IPC_NOT_NATIVE]',async t=>{
  let armed=false,reached=0,f,afterFault;
  f=await mainFixture(t,h=>h.main.__host.afterTruth(()=>{if(armed){reached++;fs.appendFileSync(f.scenePath,'\nexternal-synthetic-change');afterFault=f.h.roster();}}));
  const before=fs.readFileSync(f.scenePath), payload=f.intent();armed=true;const result=await f.h.command(COMMAND,payload);
  assert.equal(reached,1);assert.equal(result.ok,false);assert.deepEqual(f.h.roster(),afterFault,'Only the deliberately injected source edit remains');
  assert.deepEqual(fs.readFileSync(f.scenePath),Buffer.concat([before,Buffer.from('\nexternal-synthetic-change')]));assert.equal(f.manifest().atlas.authoredAssociations,undefined);
});

test('authored association typing never enumerates the whole participant catalog or queries [FINITE_DOM_NOT_NATIVE]',async t=>{
  const ui=await associationDomFixture(t), input=ui.fields().find(node=>node.dataset.atlasAssociationField==='associationKind');
  for(const [key,value] of [['sourceEntityId','mira'],['targetEntityId','boris']]){const field=ui.fields().find(node=>node.dataset.atlasAssociationField===key);field.value=value;await field.fire('change');}
  const before=ui.optionEnumerations();for(let i=0;i<12;i++){input.value='набирает e\u0301 🧭 '+i;await input.fire('input');}
  assert.equal(ui.optionEnumerations(),before,'Native option catalogs are refreshed only with a changed projection, never per character');assert.equal(ui.queries.length,0);assert.equal(ui.transports.length,0);
});

test('authored association saved-row source button traverses actual renderer open command and Main source oracle [FINITE_DOM_NOT_NATIVE]',async t=>{
  const ui=await associationDomFixture(t);await fillAssociationForm(ui);await ui.action('record').fire('click');const before=ui.f.h.sent.length;
  const button=ui.host.all(node=>node.dataset.atlasAssociationSavedAction==='open')[0];assert.ok(button);assert.equal(button.disabled,false);await button.fire('click');
  assert.equal(ui.transports.length,2);const call=ui.transports[1];assert.equal(call.request.commandId,'cmd.project.document.open');assert.equal(call.result.ok,true,JSON.stringify(call.result));
  const expected=call.request.payload.expectedAtlasAssociationSource;assert.equal(expected.schemaVersion,'atlas.authoredAssociationNavigation.v1');assert.equal(expected.sceneId,ui.f.sceneId);
  assert.equal(expected.recordHash,hash(ui.f.manifest().atlas.authoredAssociations[expected.associationId]));assert.equal(Object.hasOwn(expected,'quote'),false);
  const publications=ui.f.h.sent.slice(before).filter(([channel])=>channel==='editor:set-text');assert.equal(publications.length,1);
  assert.deepEqual(publications[0][1].selectionRange,{start:0,end:16});
});

test('authored association revision and byte limits refuse without trimming prior history or unknown data',async()=>{
  const f=await coreFixture(), state=applied(f,f.intent()).state,record=recordOf(f,state),initial=copy(record.revisions[0]);
  record.revisions=Array.from({length:127},(_,i)=>({...copy(initial),revision:i+1,commandSeq:i+5}));state.data.lastCommandId=131;
  const before=copy(record),payload={...f.intent(),expectedAssociationHash:hash(record)},last=f.apply(payload,state);assert.equal(last.ok,true,JSON.stringify(last.error));
  assert.equal(recordOf(f,last.state).revisions.length,128);assert.deepEqual(recordOf(f,last.state).revisions.slice(0,127),before.revisions);
  const full=copy(last.state),over=f.apply({...payload,expectedAssociationHash:hash(recordOf(f,last.state))},last.state);
  assert.equal(over.ok,false);assert.equal(over.error.code,'E_ATLAS_ASSOCIATION_CAPACITY');assert.deepEqual(over.state,full);
  const big=copy(state);recordOf(f,big).futureUnknownBytes='🧭'.repeat(2*1024*1024);const original=hash(big);
  const bytes=f.apply({...f.intent(),expectedAssociationHash:hash(recordOf(f,big))},big);assert.equal(bytes.ok,false);assert.equal(bytes.error.code,'E_ATLAS_ASSOCIATION_CAPACITY');assert.equal(hash(bytes.state),original);
});

test('authored association ordinary full archive COPY retains all versions and changes only the owner [FINITE_IPC_NOT_NATIVE]',async t=>{
  const f=await mainFixture(t,undefined,false,true);assertMainApplied(await f.h.command(COMMAND,f.intent()));
  assertMainApplied(await f.h.command(COMMAND,{...f.intent(),associationKind:'защищает',expectedAssociationHash:hash(f.manifest().atlas.authoredAssociations['association-one'])}));
  assertMainApplied(await f.h.command(COMMAND,{operation:'retract',projectId:f.projectId,associationId:'association-one',
    expectedManifestRevision:digest(fs.readFileSync(f.manifestPath)),expectedAssociationHash:hash(f.manifest().atlas.authoredAssociations['association-one'])}));
  const before=f.manifest(),source=copy(before.atlas.authoredAssociations);assert.equal(source['association-one'].revisions.length,3);
  const archive=path.join(f.h.root,'associations-copy.craftsman.zip'),exportId='association-copy-export';
  const preview=await f.h.command('cmd.project.exportFullArchiveV1',{requestId:exportId,outPath:archive});assert.equal(preview.ok,true,JSON.stringify(preview));
  const exported=await f.h.command('cmd.project.exportFullArchiveV1',{requestId:exportId,outPath:archive,confirmed:true});assert.equal(exported.ok,true,JSON.stringify(exported));assert.ok(fs.statSync(archive).size>0);
  const request={requestId:'association-copy-import',archivePath:archive,projectName:'Associations copied',mode:'copy',openAfterImport:true};
  const importedPreview=await f.h.main.handleImportProjectArchive(request);assert.equal(importedPreview.ok,true,JSON.stringify(importedPreview));
  let publishArchiveDirectory;
  if(process.platform==='darwin'){
    const helperPath=path.join(f.h.root,'association-copy-publisher');require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative({outputPath:helperPath});
    publishArchiveDirectory=require('../../src/main/projectArchiveDarwinPublication.cjs').createProjectArchiveDarwinPublisher({helperPath});
  }else publishArchiveDirectory=async({tempRoot,targetRoot,assertCurrent})=>{await assertCurrent();await fs.promises.rename(tempRoot,targetRoot);return{namePublished:true,directorySynced:false,publicationOutcome:'TEST_PORT_ONLY'};};
  const imported=await f.h.main.handleImportProjectArchive({...request,confirmed:true},{publishArchiveDirectory});assert.equal(imported.ok,true,JSON.stringify(imported));
  const copyId=imported.projectId;assert.notEqual(copyId,f.projectId);const tree=await f.h.main.handleWorkspaceProjectTreeQuery({tab:'roman'});assert.equal(tree.projectId,copyId);
  const copiedPath=path.join(f.h.documents,'craftsman','Associations copied','project.craftsman.json');const copied=JSON.parse(fs.readFileSync(copiedPath,'utf8'));
  const expected=copy(source);for(const row of Object.values(expected))row.projectId=copyId;assert.deepEqual(copied.atlas.authoredAssociations,expected);assert.deepEqual(f.manifest(),before);
  const value=(await f.h.query('query.atlasRelationDossier',{projectId:copyId})).atlasRelationDossier.authoredAssociations;assert.equal(value.total,1);assert.equal(value.rows[0].sourceState,'current');
  t.diagnostic('ACTUAL_MAIN_COPY_AND_KERNEL_OPEN; directory port '+(process.platform==='darwin'?'production Darwin helper':'generic CI test port')+'; NOT_NATIVE_APP_ACCEPTANCE');
});

test('authored association registered document-open relay cannot discard malformed expected source metadata [FINITE_DOM_NOT_NATIVE]',async t=>{
  const ui=await associationDomFixture(t), command='cmd.project.document.open';
  const control=await ui.context.dispatchUiCommand(command,{projectId:ui.f.projectId,nodeId:ui.f.sceneId});assert.equal(control.ok,true,JSON.stringify(control));
  for(const malformed of [undefined,null,7,{schemaVersion:'foreign.v2'}]){
    const before=ui.f.h.roster(),publications=ui.f.h.sent.filter(([channel])=>channel==='editor:set-text').length;
    const result=await ui.context.dispatchUiCommand(command,{projectId:ui.f.projectId,nodeId:ui.f.sceneId,expectedAtlasAssociationSource:malformed});
    const request=ui.transports.at(-1).request;assert.equal(Object.hasOwn(request.payload,'expectedAtlasAssociationSource'),true);
    assert.deepEqual(request.payload.expectedAtlasAssociationSource,malformed);assert.equal(result.ok,false,JSON.stringify(result));
    assert.deepEqual(ui.f.h.roster(),before);assert.equal(ui.f.h.sent.filter(([channel])=>channel==='editor:set-text').length,publications);
  }
});

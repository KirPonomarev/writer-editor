const test = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const runtime = await import('../../src/core/runtime.mjs');
  const derived = await import('../../src/derived/index.mjs');
  const projectId = 'project-language', sceneId = 'scene-a', secondId = 'scene-b';
  const created = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    { type: 'project.create', payload: { projectId, title: 'Language inheritance', sceneId } },
    { type: 'project.applyTextEdit', payload: { projectId, sceneId, text: 'Anna é 🧭 writes. Анна отвечает.' } },
  ]);
  assert.equal(created.ok, true, JSON.stringify(created.error));
  const state = structuredClone(created.state), project = state.data.projects[projectId];
  project.languageCode = 'en'; project.manifestRevision = 'sha256:' + '1'.repeat(64);
  project.scenes[sceneId].sceneRevision = 'sha256:' + '2'.repeat(64);
  project.scenes[secondId] = { id: secondId, title: 'Second scene', text: 'Second scene stays exact.' };
  project.sceneOrder = [sceneId, secondId];
  const apply = (state, commandId, payload = {}) => {
    const result = runtime.applyCoreSequence(state, [{ type: commandId, payload: { projectId, ...payload } }]);
    assert.equal(result.ok, true, JSON.stringify(result.error)); return result.state;
  };
  const route = state => {
    const result = derived.deriveAtlasMixedLanguageRouter({ coreState: state, params: { projectId },
      capabilitySnapshot: { platformId: 'node', capabilities: { atlasMixedLanguageRouter: true } } });
    assert.equal(result.ok, true, JSON.stringify(result.error)); return result.value;
  };
  const dossier = state => {
    const result = derived.deriveAtlasCurrentSceneDossier({ coreState: state, params: { projectId, sceneId } });
    assert.equal(result.ok, true, JSON.stringify(result.error)); return result.value;
  };
  return { runtime, derived, projectId, sceneId, secondId, state, apply, route, dossier };
}

test('project language: unchanged Core router inherits project choice and preserves scene and fragment overrides', async () => {
  const x = await fixture(); let state = x.state;
  const manuscript = structuredClone(state.data.projects[x.projectId].scenes);
  state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'scene', sceneId: x.sceneId, languageCode: 'de-DE' });
  state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'range', sceneId: x.sceneId,
    startOffset: 0, endOffset: 4, languageCode: 'he' });
  const siblings = structuredClone(state.data.projects[x.projectId].atlas.languageTags);
  for (const languageCode of ['ru-RU', 'fr-FR']) {
    state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode });
    const routes = x.route(state).routes, tags = state.data.projects[x.projectId].atlas.languageTags;
    assert.ok(routes.some(row => row.sceneId === x.sceneId && row.languageCode === 'he'));
    assert.ok(routes.some(row => row.sceneId === x.sceneId && row.languageCode === 'de-de'));
    assert.ok(routes.some(row => row.sceneId === x.secondId && row.languageCode === languageCode.toLowerCase()));
    for (const key of ['scenes', 'blocks', 'ranges']) assert.deepEqual(tags[key], siblings[key]);
    assert.deepEqual(state.data.projects[x.projectId].scenes, manuscript);
  }
  state = x.apply(state, 'atlas.languageTag.clear', { scopeKind: 'project' });
  const cold = JSON.parse(JSON.stringify(state)), routes = x.route(cold).routes;
  assert.equal(cold.data.projects[x.projectId].atlas.languageTags.project, null);
  assert.ok(routes.some(row => row.sceneId === x.secondId && row.languageCode === 'en'));
  assert.ok(routes.some(row => row.sceneId === x.sceneId && row.languageCode === 'de-de'));
  for (const key of ['scenes', 'blocks', 'ranges']) assert.deepEqual(cold.data.projects[x.projectId].atlas.languageTags[key], siblings[key]);
  assert.deepEqual(cold.data.projects[x.projectId].scenes, manuscript);
});

test('project language: clearing an explicit scene choice re-exposes the project default without English fallback', async () => {
  const x = await fixture(); let state = x.apply(x.state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode: 'he' });
  state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'scene', sceneId: x.sceneId, languageCode: 'ru' });
  assert.ok(x.route(state).routes.some(row => row.sceneId === x.sceneId && row.languageCode === 'ru'));
  state = x.apply(state, 'atlas.languageTag.clear', { scopeKind: 'scene', sceneId: x.sceneId });
  const result = x.route(state);
  assert.ok(result.routes.length >= 2);
  for (const row of result.routes) {
    assert.equal(row.languageCode, 'he'); assert.equal(row.policy.englishFallback, false);
    assert.equal(row.policy.analysisMode, 'GLOBAL_EXACT_ONLY');
  }
  assert.equal(result.summary.deepRouteCount, 0); assert.equal(result.summary.englishFallbackCount, 0);
});

test('project language V16: exact successor inherits thirty-five commands and thirteen queries with historical V15 intact', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), options = { isPackaged: true, platform: 'darwin' };
  assert.equal(typeof m.createWriterAtlasProjectLanguageProfileProjection, 'function');
  const old = m.createWriterAtlasRangeLanguageProfileProjection(options), active = m.createWriterAtlasProjectLanguageProfileProjection(options);
  assert.equal(old.profileId, 'WRITER_LOCAL_ATLAS_RANGE_LANGUAGE_V15');
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_PROJECT_LANGUAGE_V16'); assert.equal(active.schemaVersion, 'writer-local-profile.v16');
  assert.deepEqual({ ...active, profileId: old.profileId, schemaVersion: old.schemaVersion }, old);
  assert.equal(active.admittedCommandIds.length, 35); assert.equal(active.admittedQueryIds.length, 13);
  assert.equal(m.isActiveWriterAtlasProjectLanguageProfile(active), true); assert.equal(Object.isFrozen(active), true);
  for (const commandId of active.admittedCommandIds) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId,
    productCommandRecord: { id: commandId, domain: commandId.split('.')[0] } }).allowed, true);
  for (const queryId of active.admittedQueryIds) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, true);
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: true, platform: 'win32' }])
    assert.deepEqual(m.createWriterAtlasProjectLanguageProfileProjection(options), m.createWriterAtlasRangeLanguageProfileProjection(options));
  for (const invalid of [{ ...active, profileId: active.profileId + '.extra' }, { ...active, schemaVersion: active.schemaVersion + '.extra' },
    { ...active, extra: true }, { ...active, active: false }, { ...active, platform: 'linux' },
    { ...active, admittedCommandIds: [...active.admittedCommandIds].reverse() }, { ...active, admittedQueryIds: active.admittedQueryIds.slice(1) }]) {
    assert.equal(m.isActiveWriterAtlasProjectLanguageProfile(invalid), false);
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: invalid, commandId: 'atlas.languageTag.set',
      productCommandRecord: { id: 'atlas.languageTag.set', domain: 'atlas' } }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: invalid, queryId: 'query.atlasCurrentScene' }).allowed, false);
  }
  assert.equal(m.isActiveWriterAtlasRangeLanguageProfile(old), true);
  assert.equal(m.isActiveWriterAtlasProjectLanguageProfile(old), false);
});

test('project language V16: immutable dossier supplies the raw manifest revision and whole saved record hash', async () => {
  const x = await fixture(); const empty = x.dossier(x.state).projectLanguageTag;
  assert.deepEqual(empty, { state: 'empty', reason: '', manifestRevision: 'sha256:' + '1'.repeat(64), tag: null });
  const state = x.apply(x.state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode: 'ru-RU' });
  const { hashCanonicalValue: hash } = await import('../../src/core/browser-safe-hash.mjs');
  const record = state.data.projects[x.projectId].atlas.languageTags.project;
  const before = JSON.stringify(state), detail = x.dossier(state).projectLanguageTag;
  assert.deepEqual(detail, { state: 'ready', reason: '', manifestRevision: 'sha256:' + '1'.repeat(64),
    tag: { id: record.id, languageCode: 'ru-RU', recordHash: hash(record) } });
  assert.equal(JSON.stringify(state), before);
  record.futureAuthorData = { retained: ['é', '🧭'] };
  assert.equal(x.dossier(state).projectLanguageTag.tag.recordHash, hash(record));
});

test('project language V16: derived scene-default readback names inheritance and preserves the explicit scene choice', async () => {
  const x = await fixture(); let state = x.apply(x.state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode: 'ru-RU' });
  const projectDefault = { state: 'ready', reason: '', sourceKind: 'project', languageCode: 'ru-RU' };
  assert.deepEqual(x.dossier(state).sceneLanguageDefault, projectDefault);
  state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'scene', sceneId: x.sceneId, languageCode: 'de-DE' });
  assert.deepEqual(x.dossier(state).sceneLanguageDefault, { state: 'ready', reason: '', sourceKind: 'scene', languageCode: 'de-DE' });
  state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode: 'he' });
  assert.equal(x.dossier(state).sceneLanguageDefault.languageCode, 'de-DE');
  state = x.apply(state, 'atlas.languageTag.clear', { scopeKind: 'scene', sceneId: x.sceneId });
  assert.deepEqual(x.dossier(state).sceneLanguageDefault, { ...projectDefault, languageCode: 'he' });
  state = x.apply(state, 'atlas.languageTag.clear', { scopeKind: 'project' });
  assert.deepEqual(x.dossier(state).sceneLanguageDefault, { state: 'empty', reason: '', sourceKind: 'unset', languageCode: '' });
});

test('project language V16: damaged foreign project metadata and missing revisions are unavailable, never empty', async t => {
  const x = await fixture(), initial = x.apply(x.state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode: 'ru-RU' });
  for (const [name, damage] of [
    ['foreign project', p => { p.atlas.languageTags.project.projectId = 'foreign'; }],
    ['scene masquerading as project', p => { p.atlas.languageTags.project.scopeKind = 'scene'; }],
    ['invalid language', p => { p.atlas.languageTags.project.languageCode = 'en_US'; }],
    ['foreign scene', p => { p.atlas.languageTags.project.sceneId = 'other'; }],
    ['invalid creation sequence', p => { p.atlas.languageTags.project.createdByCommandSeq = -1; }],
    ['missing record checksum', p => { delete p.atlas.languageTags.project.sourceHash; }],
    ['malformed retained note', p => { p.atlas.languageTags.project.note = { text: 'must not be erased' }; }],
    ['bucket array', p => { p.atlas.languageTags = []; }],
    ['invalid project row', p => { p.atlas.languageTags.project = false; }],
    ['missing raw revision', p => { delete p.manifestRevision; }],
  ]) await t.test(name, () => {
    const state = structuredClone(initial); damage(state.data.projects[x.projectId]); const before = JSON.stringify(state);
    assert.equal(x.dossier(state).projectLanguageTag?.state, 'unavailable'); assert.equal(JSON.stringify(state), before);
  });
});

test('project language V16: malformed or ambiguous scene choice cannot silently fall back to the project', async () => {
  const x = await fixture(); let state = x.apply(x.state, 'atlas.languageTag.set', { scopeKind: 'project', languageCode: 'ru-RU' });
  state = x.apply(state, 'atlas.languageTag.set', { scopeKind: 'scene', sceneId: x.sceneId, languageCode: 'de-DE' });
  const [key] = Object.keys(state.data.projects[x.projectId].atlas.languageTags.scenes);
  for (const kind of ['invalid', 'ambiguous']) {
    const changed = structuredClone(state), tags = changed.data.projects[x.projectId].atlas.languageTags;
    if (kind === 'invalid') tags.scenes[key].languageCode = 'en_US';
    else tags.scenes.duplicate = { ...tags.scenes[key], id: 'duplicate' };
    const dto = x.dossier(changed); assert.equal(dto.projectLanguageTag.state, 'ready');
    assert.equal(dto.sceneLanguageDefault.state, 'unavailable'); assert.equal(dto.sceneLanguageDefault.languageCode, '');
  }
});

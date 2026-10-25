const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function buildCurrentSceneFixture() {
  const runtime = await loadModule(path.join('src', 'core', 'runtime.mjs'));
  const projectId = 'atlas-current-scene-project';
  const sceneAId = 'scene-a';
  const sceneBId = 'scene-b';
  const sceneAText = 'Anna marked the Atlas keeper note. Mira watched Anna.';
  const sceneBText = 'Mira archived the bridge note.';
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE,
      payload: { projectId, title: 'Atlas current scene', sceneId: sceneAId },
    },
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
      payload: { projectId, sceneId: sceneAId, text: sceneAText },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE,
      payload: {
        projectId,
        entityId: 'entity-anna',
        name: 'Anna',
        entityKind: 'character',
      },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ALIAS_ADD,
      payload: {
        projectId,
        entityId: 'entity-anna',
        aliasId: 'alias-atlas-keeper',
        value: 'Atlas keeper',
      },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE,
      payload: {
        projectId,
        entityId: 'entity-mira',
        name: 'Mira',
        entityKind: 'character',
      },
    },
  ]);
  assert.equal(built.ok, true);

  const state = JSON.parse(JSON.stringify(built.state));
  state.data.projects[projectId].scenes[sceneBId] = {
    id: sceneBId,
    title: 'Second scene',
    text: sceneBText,
  };

  return { projectId, sceneAId, sceneBId, sceneAText, sceneBText, state };
}

test('E01 C03: current-scene Atlas dossier is a read-only surface projection with evidence focus intents', async () => {
  const { projectId, sceneAId, sceneAText, state } = await buildCurrentSceneFixture();
  const atlas = await loadModule(path.join('src', 'derived', 'atlas', 'deriveAtlasCurrentSceneDossier.mjs'));

  const result = atlas.deriveAtlasCurrentSceneDossier({
    coreState: state,
    params: { projectId, sceneId: sceneAId, sceneTitle: 'Opening scene' },
    capabilitySnapshot: { platformId: 'node', capabilities: { atlasMentionIndex: true } },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.schemaVersion, 'derived.atlas.currentSceneDossier.v1');
  assert.equal(result.value.state, 'ready');
  assert.equal(result.value.projectId, projectId);
  assert.equal(result.value.sceneId, sceneAId);
  assert.equal(result.value.sceneTitle, 'Opening scene');
  assert.equal(result.value.summary.entityCount, 2);
  assert.equal(result.value.summary.mentionCount, 4);
  assert.equal(typeof result.value.summary.sceneTextHash, 'string');
  assert.equal(result.value.summary.sceneTextHash.length, 64);
  assert.equal(result.value.summary.indexHash.length, 64);
  assert.equal(result.value.summary.invalidationKey.length, 64);
  assert.equal(result.meta.invalidationKey.length, 64);
  assert.notEqual(result.value.summary.invalidationKey, result.meta.invalidationKey);

  assert.deepEqual(result.value.surfaceManifest, {
    schemaVersion: 'surface.atlas.currentSceneDossier.v1',
    surfaceId: 'surface.atlas.currentSceneDossier',
    providerId: 'query.atlasCurrentScene',
    host: 'rightRail',
    slotId: 'rightRail.context.atlas',
    contributionKind: 'readOnlyProjection',
    allowedStateClasses: ['PROJECT_STATE', 'DERIVED_STATE', 'TRANSIENT_STATE'],
    commandAuthority: 'none',
    productMutation: false,
    storageAuthority: false,
    fallback: {
      empty: 'ATLAS_DOSSIER_EMPTY',
      unavailable: 'ATLAS_DOSSIER_UNAVAILABLE',
    },
  });

  assert.deepEqual(
    result.value.entities.map((entity) => [entity.entityId, entity.mentionCount]),
    [
      ['entity-anna', 3],
      ['entity-mira', 1],
    ],
  );
  assert.equal(result.value.mentions.every((mention) => mention.sceneId === sceneAId), true);
  assert.deepEqual(
    result.value.mentions.map((mention) => mention.matchedText),
    ['Anna', 'Atlas keeper', 'Mira', 'Anna'],
  );

  const first = result.value.mentions[0];
  assert.equal(first.startOffset, sceneAText.indexOf('Anna'));
  assert.equal(first.endOffset, sceneAText.indexOf('Anna') + 'Anna'.length);
  assert.equal(first.context.quote, 'Anna');
  assert.equal(first.evidenceAnchor.schemaVersion, 'atlas.evidenceAnchor.v1');
  assert.deepEqual(first.focusIntent, {
    kind: 'localTextSelection',
    sceneId: sceneAId,
    startOffset: first.startOffset,
    endOffset: first.endOffset,
  });
});

test('E01 C03: dossier filters mention index to the requested current scene only', async () => {
  const { projectId, sceneBId, state } = await buildCurrentSceneFixture();
  const atlas = await loadModule(path.join('src', 'derived', 'atlas', 'deriveAtlasCurrentSceneDossier.mjs'));

  const result = atlas.deriveAtlasCurrentSceneDossier({
    coreState: state,
    params: { projectId, sceneId: sceneBId, sceneTitle: 'Second scene' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.state, 'ready');
  assert.equal(result.value.sceneId, sceneBId);
  assert.equal(result.value.summary.entityCount, 1);
  assert.equal(result.value.summary.mentionCount, 1);
  assert.deepEqual(
    result.value.mentions.map((mention) => [mention.sceneId, mention.matchedText]),
    [[sceneBId, 'Mira']],
  );
});

test('E01 C03: dossier returns empty and unavailable states without mutating project truth', async () => {
  const { projectId, sceneAId, state } = await buildCurrentSceneFixture();
  const atlas = await loadModule(path.join('src', 'derived', 'atlas', 'deriveAtlasCurrentSceneDossier.mjs'));
  const before = JSON.stringify(state);

  const emptyState = JSON.parse(JSON.stringify(state));
  emptyState.data.projects[projectId].atlas.entities = {};
  const empty = atlas.deriveAtlasCurrentSceneDossier({
    coreState: emptyState,
    params: { projectId, sceneId: sceneAId },
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.value.state, 'empty');
  assert.equal(empty.value.summary.mentionCount, 0);
  assert.equal(empty.value.surfaceManifest.productMutation, false);

  const disabled = atlas.deriveAtlasCurrentSceneDossier({
    coreState: state,
    params: { projectId, sceneId: sceneAId },
    capabilitySnapshot: { platformId: 'node', capabilities: { atlasMentionIndex: false } },
  });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.value.state, 'unavailable');
  assert.equal(disabled.value.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND');

  const missingScene = atlas.deriveAtlasCurrentSceneDossier({
    coreState: state,
    params: { projectId, sceneId: 'missing-scene' },
  });
  assert.equal(missingScene.ok, false);
  assert.equal(missingScene.error.code, 'E_ATLAS_SCENE_NOT_FOUND');
  assert.equal(JSON.stringify(state), before);
});

test('E01 C03: surface wiring uses query bridge and does not bypass command or storage authority', () => {
  const derivedRoot = path.join(process.cwd(), 'src', 'derived', 'atlas');
  const derivedSources = fs.readdirSync(derivedRoot)
    .filter((basename) => basename.endsWith('.mjs'))
    .map((basename) => [basename, fs.readFileSync(path.join(derivedRoot, basename), 'utf8')]);
  const forbiddenDerivedPatterns = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bwriteFile(?:Sync)?\s*\(/u,
    /\bappendFile(?:Sync)?\s*\(/u,
    /\bmkdir(?:Sync)?\s*\(/u,
    /\brename(?:Sync)?\s*\(/u,
    /\bunlink(?:Sync)?\s*\(/u,
    /\brm(?:Sync)?\s*\(/u,
    /\blocalStorage\b/u,
    /\bsessionStorage\b/u,
    /\bindexedDB\b/u,
  ];

  for (const [basename, source] of derivedSources) {
    for (const pattern of forbiddenDerivedPatterns) {
      assert.doesNotMatch(source, pattern, `${basename} matched ${pattern.source}`);
    }
  }

  const mainSource = fs.readFileSync(path.join(process.cwd(), 'src', 'main.js'), 'utf8');
  assert.match(mainSource, /ATLAS_CURRENT_SCENE_QUERY_ID\s*=\s*WORKSPACE_QUERY_IDS\.ATLAS_CURRENT_SCENE/u);
  assert.match(mainSource, /\[ATLAS_CURRENT_SCENE_QUERY_ID,\s*handleWorkspaceAtlasCurrentSceneQuery\]/u);
  assert.match(mainSource, /function handleWorkspaceAtlasCurrentSceneQuery/u);
  assert.match(mainSource, /resolveProjectTreeNodeIdentity/u);
  assert.match(mainSource, /sanitizePayloadWithinProjectRoot/u);
  assert.match(mainSource, /parseObservablePayload/u);
  assert.match(mainSource, /atlasCurrentScene/u);

  const rendererSource = fs.readFileSync(path.join(process.cwd(), 'src', 'renderer', 'editor.js'), 'utf8');
  assert.match(rendererSource, /ATLAS_CURRENT_SCENE_QUERY_ID\s*=\s*WORKSPACE_QUERY_IDS\.ATLAS_CURRENT_SCENE/u);
  assert.match(rendererSource, /RIGHT_RAIL_SURFACE_PROVIDERS[\s\S]*atlas:\s*ATLAS_CURRENT_SCENE_QUERY_ID/u);
  assert.match(rendererSource, /refreshAtlasCurrentScene/u);
  assert.match(rendererSource, /focusAtlasMention/u);
  assert.match(rendererSource, /invokeWorkspaceQueryBridge\(ATLAS_CURRENT_SCENE_QUERY_ID/u);
  assert.match(rendererSource, /setSelectionRange\(start,\s*end\)/u);
  assert.doesNotMatch(rendererSource, /dispatchUiCommand\([^)]*ATLAS_CURRENT_SCENE_QUERY_ID/u);

  const htmlSource = fs.readFileSync(path.join(process.cwd(), 'src', 'renderer', 'index.html'), 'utf8');
  assert.match(htmlSource, /data-right-tab="atlas"/u);
  assert.match(htmlSource, /data-right-panel-atlas/u);
  assert.match(htmlSource, /data-atlas-current-scene-host/u);
  assert.match(htmlSource, /data-atlas-current-scene-provider="query\.atlasCurrentScene"/u);
});


const CONTINUITY_TEXT = 'Начало e\u0301 🧭. Мира увидела маяк. Северная ответила Мире. Мира сохранила знак.';
const CONTINUITY_PREFIX = 'Добавлено. ';
async function continuityFixture({ legacy = false } = {}) {
  const runtime = await loadModule('src/core/runtime.mjs'), derived = await loadModule('src/derived/index.mjs');
  const projectId = 'source-continuity', sceneId = 'scene-continuity', entityId = 'mira', decisionId = 'confirmed-first';
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    { type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId, sceneId, title: 'Continuity' } },
    { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId, text: CONTINUITY_TEXT } },
    { type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE, payload: { projectId, entityId, name: 'Мира', entityKind: 'character' } },
    { type: runtime.CORE_COMMAND_IDS.ATLAS_ALIAS_ADD, payload: { projectId, entityId, aliasId: 'north', value: 'Северная', scope: 'scene', sceneId } },
  ]); assert.equal(built.ok, true);
  const query = state => derived.deriveAtlasCurrentSceneDossier({ coreState: state, params: { projectId, sceneId } });
  const first = query(built.state).value.mentions.find(m => m.startOffset === 14); assert.ok(first);
  const evidenceAnchor = { ...first.evidenceAnchor };
  if (legacy) for (const key of ['projectId', 'sceneId', 'entityId']) delete evidenceAnchor[key];
  const confirmed = runtime.reduceCoreState(built.state, { type: runtime.CORE_COMMAND_IDS.ATLAS_MENTION_CONFIRM,
    payload: { projectId, sceneId, entityId, mentionId: first.mentionId, evidenceAnchor, decisionId } });
  assert.equal(confirmed.ok, true); const originalDecision = JSON.stringify(confirmed.state.data.projects[projectId].atlas.decisions[decisionId]);
  const edit = (state, text) => { const r = runtime.reduceCoreState(state, { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId, sceneId, text } }); assert.equal(r.ok, true); return r.state; };
  return { runtime, derived, projectId, sceneId, entityId, decisionId, state: confirmed.state, first, query, edit, originalDecision };
}
function continuityTrust(projection) {
  assert.equal(projection.ok, true);
  return projection.value.mentions.map(m => [m.matchedText, m.startOffset, m.endOffset, m.trustState]);
}

test('AF1 AF5 exact source witness gates confirmation after append prefix and exact restoration without author writes', async () => {
  const f = await continuityFixture(), original = JSON.stringify(f.state);
  assert.deepEqual(continuityTrust(f.query(f.state)), [
    ['Мира', 14, 18, 'AUTHOR_CONFIRMED'], ['Северная', 33, 41, 'ALGORITHMIC_OBSERVATION'], ['Мира', 57, 61, 'ALGORITHMIC_OBSERVATION']]);
  const appended = f.edit(f.state, CONTINUITY_TEXT + ' Автор дописал абзац.');
  const before = JSON.stringify(appended), old = f.query(f.state).value.mentions[0], observed = f.query(appended).value.mentions[0];
  assert.equal(observed.mentionId, old.mentionId); assert.notDeepEqual(observed.evidenceAnchor, old.evidenceAnchor);
  assert.equal(observed.trustState, 'ALGORITHMIC_OBSERVATION', 'unchanged mentionId cannot certify a changed full source witness');
  assert.equal(observed.decisionId, ''); assert.equal(f.query(appended).value.summary.confirmedMentionCount, 0);
  assert.equal(f.derived.deriveAtlasEvidenceReattachmentInbox({ coreState: appended, params: { projectId: f.projectId } }).value.items[0].status, 'REVIEW_REQUIRED');
  assert.equal(JSON.stringify(appended), before);
  const shifted = f.edit(appended, CONTINUITY_PREFIX + CONTINUITY_TEXT);
  assert.deepEqual(continuityTrust(f.query(shifted)), [
    ['Мира', 25, 29, 'ALGORITHMIC_OBSERVATION'], ['Северная', 44, 52, 'ALGORITHMIC_OBSERVATION'], ['Мира', 68, 72, 'ALGORITHMIC_OBSERVATION']]);
  const restored = f.edit(shifted, CONTINUITY_TEXT), restoredBefore = JSON.stringify(restored);
  assert.equal(f.query(restored).value.mentions[0].trustState, 'AUTHOR_CONFIRMED');
  assert.equal(f.query(restored).value.mentions[0].decisionId, f.decisionId);
  for (const state of [appended, shifted, restored]) assert.equal(JSON.stringify(state.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.originalDecision);
  assert.equal(JSON.stringify(restored), restoredBefore); assert.equal(JSON.stringify(f.state), original);
});

test('AF1 AF5 malformed or foreign original witness never promotes by retained mention ID', async t => {
  const f = await continuityFixture();
  for (const [name, patch] of [
    ['project', d => { d.projectId = 'foreign'; }], ['scene', d => { d.sceneId = 'foreign'; }], ['entity', d => { d.entityId = 'foreign'; }],
    ['anchor-project', d => { d.evidenceAnchor.projectId = 'foreign'; }], ['anchor-scene', d => { d.evidenceAnchor.sceneId = 'foreign'; }],
    ['anchor-entity', d => { d.evidenceAnchor.entityId = 'foreign'; }], ['quote', d => { d.evidenceAnchor.quote = 'Лира'; }],
    ['quoteHash', d => { d.evidenceAnchor.quoteHash = '0'.repeat(64); }], ['sourceHash', d => { d.evidenceAnchor.sceneTextHash = '0'.repeat(64); }],
    ['fractional-range', d => { d.evidenceAnchor.startOffset = 14.5; }], ['range', d => { d.evidenceAnchor.endOffset = 19; }],
  ]) await t.test(name, () => {
    const state = JSON.parse(JSON.stringify(f.state)); patch(state.data.projects[f.projectId].atlas.decisions[f.decisionId]); const before = JSON.stringify(state);
    const projected = f.query(state); assert.equal(projected.ok, true);
    assert.equal(projected.value.mentions[0].trustState, 'ALGORITHMIC_OBSERVATION', name);
    assert.equal(projected.value.mentions[0].decisionId, ''); assert.equal(JSON.stringify(state), before);
  });
});

test('AF1 AF5 legal historical omitted optional anchor identity remains readable without migration', async () => {
  const f = await continuityFixture({ legacy: true }), before = JSON.stringify(f.state);
  assert.equal(f.query(f.state).value.mentions[0].trustState, 'AUTHOR_CONFIRMED');
  const changed = f.edit(f.state, CONTINUITY_TEXT + ' Новый абзац.');
  assert.equal(f.query(changed).value.mentions[0].trustState, 'ALGORITHMIC_OBSERVATION');
  assert.equal(JSON.stringify(f.state), before); assert.equal(JSON.stringify(changed.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.originalDecision);
});

async function continuityReattached() {
  const f = await continuityFixture(), text = CONTINUITY_PREFIX + CONTINUITY_TEXT, moved = f.edit(f.state, text);
  const inbox = f.derived.deriveAtlasEvidenceReattachmentInbox({ coreState: moved, params: { projectId: f.projectId } });
  assert.equal(inbox.ok, true); const item = inbox.value.items[0], candidate = item.candidates.find(c => c.evidenceAnchor.startOffset === 68);
  assert.ok(candidate); assert.equal(item.candidateCount, 2); assert.equal(candidate.evidenceAnchor.quote, 'Мира');
  const reattach = (state, id, target) => {
    const result = f.runtime.reduceCoreState(state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH,
      payload: { projectId: f.projectId, sourceRecordKind: 'decision', sourceRecordId: f.decisionId,
        staleEvidenceAnchor: item.staleEvidenceAnchor, newEvidenceAnchor: target.evidenceAnchor,
        expectedSourceRecordHash: item.sourceRecordHash, reattachmentId: id, reason: 'Explicit selected exact source' } });
    assert.equal(result.ok, true, JSON.stringify(result.error)); return result.state;
  };
  return { ...f, text, moved, item, candidate, reattach, attached: reattach(moved, 'z-earlier', candidate) };
}

test('AF1 AF5 explicit real Core reattachment binds only selected current witness and preserves original raw decision', async () => {
  const f = await continuityReattached(), before = JSON.stringify(f.attached), projected = f.query(f.attached);
  assert.deepEqual(continuityTrust(projected), [
    ['Мира', 25, 29, 'ALGORITHMIC_OBSERVATION'], ['Северная', 44, 52, 'ALGORITHMIC_OBSERVATION'], ['Мира', 68, 72, 'AUTHOR_CONFIRMED']]);
  assert.equal(projected.value.mentions[2].decisionId, f.decisionId);
  assert.notEqual(projected.value.mentions[2].evidenceAnchor.anchorId, f.candidate.evidenceAnchor.anchorId, 'legitimate candidate and term anchor IDs differ');
  assert.notEqual(projected.value.mentions[2].mentionId, f.first.mentionId);
  assert.equal(JSON.stringify(f.attached.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.originalDecision);
  assert.equal(JSON.stringify(f.attached), before);
  const changed = f.edit(f.attached, f.text + ' Позже.'); assert.equal(f.query(changed).value.summary.confirmedMentionCount, 0);
  const restored = f.edit(changed, f.text); assert.equal(f.query(restored).value.mentions[2].trustState, 'AUTHOR_CONFIRMED');
  const firstTarget = f.item.candidates.find(c => c.evidenceAnchor.startOffset === 25); assert.ok(firstTarget);
  const latest = f.reattach(f.attached, 'a-later', firstTarget);
  assert.deepEqual(f.query(latest).value.mentions.map(m => m.trustState), ['AUTHOR_CONFIRMED', 'ALGORITHMIC_OBSERVATION', 'ALGORITHMIC_OBSERVATION']);
  assert.equal(JSON.stringify(latest.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.originalDecision);
});

test('AF1 AF5 stale malformed or ambiguous explicit reattachment metadata cannot promote evidence', async t => {
  const f = await continuityReattached();
  for (const [name, patch] of [
    ['source-hash', r => { r.sourceRecordHash = '0'.repeat(64); }], ['source-id', r => { r.sourceRecordId = 'foreign'; }],
    ['source-kind', r => { r.sourceRecordKind = 'suppression'; }], ['project', r => { r.projectId = 'foreign'; }],
    ['stale-witness', r => { r.staleEvidenceAnchor.quote = 'Лира'; }], ['new-project', r => { r.newEvidenceAnchor.projectId = 'foreign'; }],
    ['new-entity', r => { r.newEvidenceAnchor.entityId = 'foreign'; }], ['new-scene-hash', r => { r.newEvidenceAnchor.sceneTextHash = '0'.repeat(64); }],
    ['sequence', r => { r.createdByCommandSeq = -1; }], ['fractional-sequence', r => { r.createdByCommandSeq = 1.5; }],
    ['operation', r => { r.operationKind = 'automatic'; }],
  ]) await t.test(name, () => {
    const state = JSON.parse(JSON.stringify(f.attached)); patch(state.data.projects[f.projectId].atlas.evidenceReattachments['z-earlier']); const before = JSON.stringify(state);
    const result = f.query(state); assert.equal(result.ok, true); assert.equal(result.value.summary.confirmedMentionCount, 0, name);
    assert.equal(JSON.stringify(state), before);
  });
  const ambiguous = JSON.parse(JSON.stringify(f.attached)), bucket = ambiguous.data.projects[f.projectId].atlas.evidenceReattachments;
  bucket['same-sequence'] = { ...bucket['z-earlier'], id: 'same-sequence', newEvidenceAnchor: f.item.candidates[0].evidenceAnchor };
  const before = JSON.stringify(ambiguous); assert.equal(f.query(ambiguous).value.summary.confirmedMentionCount, 0);
  assert.equal(JSON.stringify(ambiguous), before);
});


test('AF1 AF5 latest explicit source selection supersedes the original witness on original-source restoration', async () => {
  const f = await continuityReattached(), restored = f.edit(f.attached, CONTINUITY_TEXT), before = JSON.stringify(restored);
  assert.equal(f.query(restored).value.summary.confirmedMentionCount, 0, 'latest explicit witness must not fall back to original author anchor');
  assert.equal(JSON.stringify(restored), before);
  assert.equal(JSON.stringify(restored.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.originalDecision);
});


test('AF1 AF5 present nonstring optional witness identity is malformed while historical omission remains legal', async t => {
  const f = await continuityFixture();
  for (const key of ['projectId', 'sceneId', 'entityId']) for (const value of [null, 17, { foreign: true }]) await t.test(key + ':' + JSON.stringify(value), () => {
    const state = JSON.parse(JSON.stringify(f.state)); state.data.projects[f.projectId].atlas.decisions[f.decisionId].evidenceAnchor[key] = value;
    const before = JSON.stringify(state); assert.equal(f.query(state).value.summary.confirmedMentionCount, 0);
    assert.equal(JSON.stringify(state), before);
  });
});

test('AF1 AF5 equally valid original confirmations retain deterministic last decision-ID precedence', async () => {
  const f = await continuityFixture(), decisionId = 'z-confirmed-again';
  const confirmed = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_MENTION_CONFIRM,
    payload: { projectId: f.projectId, sceneId: f.sceneId, entityId: f.entityId, mentionId: f.first.mentionId, evidenceAnchor: f.first.evidenceAnchor, decisionId } });
  assert.equal(confirmed.ok, true); const before = JSON.stringify(confirmed.state), projected = f.query(confirmed.state);
  assert.equal(projected.value.mentions[0].trustState, 'AUTHOR_CONFIRMED'); assert.equal(projected.value.mentions[0].decisionId, decisionId);
  assert.equal(JSON.stringify(confirmed.state), before);
});

async function sceneLanguageDossierFixture() {
  const x = await buildCurrentSceneFixture(), runtime = await loadModule('src/core/runtime.mjs');
  const { hashCanonicalValue: hash } = await loadModule('src/core/browser-safe-hash.mjs');
  const provider = await loadModule('src/derived/atlas/deriveAtlasCurrentSceneDossier.mjs');
  x.state.data.projects[x.projectId].manifestRevision = 'sha256:' + 'a'.repeat(64);
  x.state.data.projects[x.projectId].scenes[x.sceneAId].sceneRevision = 'sha256:' + 'b'.repeat(64);
  const apply = payload => { const result = runtime.applyCoreSequence(x.state, [{ type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { projectId: x.projectId, scopeKind: 'scene', sceneId: x.sceneAId, ...payload } }]);
    assert.equal(result.ok, true, JSON.stringify(result)); x.state = result.state; return result; };
  const read = (state = x.state, params = {}) => provider.deriveAtlasCurrentSceneDossier({ coreState: state,
    params: { projectId: x.projectId, sceneId: x.sceneAId, ...params },
    capabilitySnapshot: { platformId: 'node', capabilities: { atlasMentionIndex: true } } });
  return Object.assign(x, { runtime, hash, apply, read, project: () => x.state.data.projects[x.projectId] });
}

test('scene-language detail reads exact custom saved ID whole unknown-field hash and actual revisions without mutation', async () => {
  const x = await sceneLanguageDossierFixture(); x.apply({ tagId: 'custom-author-scene-tag', languageCode: 'en-US', note: 'Explicit author choice' });
  const raw = x.project().atlas.languageTags.scenes['custom-author-scene-tag']; raw.retainedUnknown = { author: 'é 🧭', policy: [1, 2] };
  const before = JSON.stringify(x.state), result = x.read(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.value.sceneLanguageTag, 'existing dossier lacks the bounded saved-language detail');
  assert.deepEqual(result.value.sceneLanguageTag, { state: 'ready', reason: '', matchingCount: 1,
    manifestRevision: x.project().manifestRevision, sceneRevision: x.project().scenes[x.sceneAId].sceneRevision,
    tag: { id: raw.id, languageCode: raw.languageCode, recordHash: x.hash(raw) } });
  assert.notEqual(result.value.sceneLanguageTag.tag.recordHash, raw.sourceHash);
  assert.equal(result.value.surfaceManifest.commandAuthority, 'none'); assert.equal(result.value.surfaceManifest.storageAuthority, false);
  assert.equal(JSON.stringify(x.state), before); assert.notEqual(result.value.sceneLanguageTag, x.read().value.sceneLanguageTag);
  const changed = structuredClone(x.state); changed.data.projects[x.projectId].atlas.languageTags.scenes[raw.id].retainedUnknown.author += '!';
  const next = x.read(changed); assert.equal(next.ok, true); assert.notEqual(next.meta.invalidationKey, result.meta.invalidationKey);
  assert.notEqual(next.value.sceneLanguageTag.tag.recordHash, result.value.sceneLanguageTag.tag.recordHash);
});

test('scene-language detail is independent of mentions and reports two lawful same-scene IDs honestly', async t => {
  const x = await sceneLanguageDossierFixture(); x.apply({ tagId: 'first-custom', languageCode: 'ru' });
  const one = structuredClone(x.state); one.data.projects[x.projectId].atlas.entities = {};
  const single = x.read(one); assert.equal(single.ok, true); assert.equal(single.value.state, 'empty');
  await t.test('saved tag on a no-mention scene remains available', () => {
    assert.equal(single.value.sceneLanguageTag?.state, 'ready'); assert.equal(single.value.sceneLanguageTag?.tag?.id, 'first-custom');
  });
  x.apply({ tagId: 'second-custom', languageCode: 'de' }); const before = JSON.stringify(x.state), result = x.read();
  assert.equal(result.ok, true); assert.equal(result.value.sceneLanguageTag?.state, 'ambiguous');
  assert.equal(result.value.sceneLanguageTag.matchingCount, 2); assert.equal(result.value.sceneLanguageTag.tag, null);
  assert.equal(JSON.stringify(x.state), before);
});

test('scene-language detail distinguishes verified legacy absence from malformed or future author data', async t => {
  const x = await sceneLanguageDossierFixture();
  for (const missing of ['atlas', 'languageTags', 'scenes']) await t.test('lawful absent ' + missing, () => {
    const state = structuredClone(x.state), p = state.data.projects[x.projectId];
    if (missing === 'atlas') delete p.atlas; else if (missing === 'languageTags') delete p.atlas.languageTags; else delete p.atlas.languageTags.scenes;
    const before = JSON.stringify(state), result = x.read(state); assert.equal(result.ok, true);
    assert.equal(result.value.sceneLanguageTag?.state, 'empty'); assert.equal(result.value.sceneLanguageTag.matchingCount, 0);
    assert.equal(result.value.sceneLanguageTag.tag, null); assert.equal(JSON.stringify(state), before);
  });
  x.apply({ tagId: 'raw-custom', languageCode: 'ru' });
  const mutations = [p => { p.atlas = { schemaVersion: 'atlas.author.v99', entities: {} }; }, p => { p.atlas = []; },
    p => { p.atlas.languageTags = []; }, p => { p.atlas.languageTags.scenes = []; },
    p => { p.atlas.languageTags.scenes['raw-custom'] = null; }, p => { p.atlas.languageTags.scenes['raw-custom'].sceneId = 17; },
    p => { p.atlas.languageTags.scenes['raw-custom'].projectId = 'foreign'; }, p => { p.atlas.languageTags.scenes['raw-custom'].id = 'other-key'; },
    p => { p.atlas.languageTags.scenes['raw-custom'].languageCode = 'x'.repeat(1001); }, p => { delete p.manifestRevision; }];
  for (const [index, mutate] of mutations.entries()) await t.test('unavailable malformed saved source ' + index, () => {
    const state = structuredClone(x.state); mutate(state.data.projects[x.projectId]); const before = JSON.stringify(state), result = x.read(state);
    assert.equal(result.ok, true); assert.equal(result.value.sceneLanguageTag?.state, 'unavailable');
    assert.equal(result.value.sceneLanguageTag.tag, null); assert.ok(result.value.sceneLanguageTag.reason); assert.equal(JSON.stringify(state), before);
  });
  await t.test('trusted Main issue preserves the old empty mention fallback but refuses new absence inference', () => {
    const state = structuredClone(x.state); state.data.projects[x.projectId].atlas = { schemaVersion: 'atlas.author.v1', entities: {}, decisions: {}, savedQueries: {} };
    const before = JSON.stringify(state), result = x.read(state, { atlasAuthorReadIssue: 'ATLAS_AUTHOR_SCHEMA_UNSUPPORTED' });
    assert.equal(result.ok, true); assert.equal(result.value.state, 'empty'); assert.equal(result.value.sceneLanguageTag?.state, 'unavailable');
    assert.equal(JSON.stringify(state), before);
  });
});

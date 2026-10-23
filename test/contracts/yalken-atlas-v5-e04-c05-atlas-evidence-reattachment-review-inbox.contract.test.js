const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function buildReattachmentFixture() {
  const runtime = await loadModule(path.join('src', 'core', 'runtime.mjs'));
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const projectId = 'atlas-reattach-project';
  const sceneId = 'scene-a';
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE,
      payload: { projectId, title: 'Atlas reattach', sceneId },
    },
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
      payload: { projectId, sceneId, text: 'Anna arrived.' },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE,
      payload: { projectId, entityId: 'entity-anna', name: 'Anna', entityKind: 'character' },
    },
  ]);
  assert.equal(built.ok, true);
  const aggregate = derived.deriveAtlasObservationAggregate({ coreState: built.state, params: { projectId, languageCode: 'en' } });
  assert.equal(aggregate.ok, true);
  const anna = aggregate.value.observations[0];
  assert.ok(anna);
  const confirmed = runtime.reduceCoreState(built.state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_MENTION_CONFIRM,
    payload: {
      projectId,
      sceneId,
      entityId: 'entity-anna',
      mentionId: anna.mentionId,
      evidenceAnchor: anna.evidenceAnchor,
      decisionId: 'decision-anna-original',
    },
  });
  assert.equal(confirmed.ok, true);
  const moved = runtime.reduceCoreState(confirmed.state, {
    type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId, sceneId, text: 'Before. Anna arrived.' },
  });
  assert.equal(moved.ok, true);
  return { runtime, derived, projectId, sceneId, confirmedState: confirmed.state, movedState: moved.state };
}

test('E04 C05: stale Atlas evidence appears in a deterministic review inbox without automatic mutation', async () => {
  const { derived, projectId, movedState } = await buildReattachmentFixture();
  const first = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: movedState, params: { projectId } });
  const second = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: JSON.parse(JSON.stringify(movedState)), params: { projectId } });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.schemaVersion, derived.ATLAS_EVIDENCE_REATTACHMENT_INBOX_SCHEMA_VERSION);
  assert.equal(first.value.summary.inboxHash, second.value.summary.inboxHash);
  assert.equal(first.meta.outputHash, second.meta.outputHash);
  assert.equal(first.value.summary.sourceRecordCount, 1);
  assert.equal(first.value.summary.reviewRequiredCount, 1);
  assert.equal(first.value.summary.candidateCount, 1);
  assert.equal(first.value.authority.automaticReattachment, false);

  const item = first.value.items[0];
  assert.equal(item.schemaVersion, derived.ATLAS_EVIDENCE_REATTACHMENT_ITEM_SCHEMA_VERSION);
  assert.equal(item.sourceRecordKind, 'decision');
  assert.equal(item.sourceRecordId, 'decision-anna-original');
  assert.equal(item.status, 'REVIEW_REQUIRED');
  assert.equal(item.currentEvidenceAnchor, null);
  assert.equal(item.staleEvidenceAnchor.startOffset, 0);
  assert.equal(item.staleEvidenceAnchor.quote, 'Anna');

  const candidate = first.value.candidates[0];
  assert.equal(candidate.schemaVersion, derived.ATLAS_EVIDENCE_REATTACHMENT_CANDIDATE_SCHEMA_VERSION);
  assert.equal(candidate.candidateKind, 'sameSceneExactQuote');
  assert.equal(candidate.evidenceAnchor.quote, 'Anna');
  assert.equal(candidate.evidenceAnchor.startOffset, 8);
  assert.equal(movedState.data.projects[projectId].atlas.decisions['decision-anna-original'].evidenceAnchor.startOffset, 0);
  assert.equal(Object.keys(movedState.data.projects[projectId].atlas.evidenceReattachments || {}).length, 0);
});

test('E04 C05: explicit reattachment records a no-loss ledger and clears the pending inbox item', async () => {
  const { runtime, derived, projectId, movedState } = await buildReattachmentFixture();
  const inbox = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: movedState, params: { projectId } });
  assert.equal(inbox.ok, true);
  const item = inbox.value.items[0];
  const candidate = inbox.value.candidates[0];

  const reattached = runtime.reduceCoreState(movedState, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH,
    payload: {
      projectId,
      sourceRecordKind: item.sourceRecordKind,
      sourceRecordId: item.sourceRecordId,
      staleEvidenceAnchor: item.staleEvidenceAnchor,
      newEvidenceAnchor: candidate.evidenceAnchor,
      expectedSourceRecordHash: item.sourceRecordHash,
      reattachmentId: 'reattach-anna-decision',
      reason: 'Author reviewed moved evidence',
    },
  });
  assert.equal(reattached.ok, true);
  const ledger = reattached.state.data.projects[projectId].atlas.evidenceReattachments['reattach-anna-decision'];
  assert.equal(ledger.operationKind, 'evidence.reattach');
  assert.deepEqual(ledger.staleEvidenceAnchor, item.staleEvidenceAnchor);
  assert.deepEqual(ledger.newEvidenceAnchor, candidate.evidenceAnchor);
  assert.equal(reattached.state.data.projects[projectId].atlas.decisions['decision-anna-original'].evidenceAnchor.startOffset, 0);

  const after = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: reattached.state, params: { projectId } });
  assert.equal(after.ok, true);
  assert.equal(after.value.summary.reviewRequiredCount, 0);
  assert.equal(after.value.summary.reattachedCount, 1);
  assert.equal(after.value.summary.candidateCount, 0);
  assert.equal(after.value.items[0].status, 'REATTACHED');
  assert.equal(after.value.items[0].reattachmentId, 'reattach-anna-decision');
  assert.deepEqual(after.value.items[0].currentEvidenceAnchor, candidate.evidenceAnchor);
});

test('E04 C05: reattachment command fails closed on stale source hash or stale new evidence', async () => {
  const { runtime, derived, projectId, sceneId, movedState } = await buildReattachmentFixture();
  const inbox = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: movedState, params: { projectId } });
  const item = inbox.value.items[0];
  const candidate = inbox.value.candidates[0];

  const staleSource = runtime.reduceCoreState(movedState, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH,
    payload: {
      projectId,
      sourceRecordKind: item.sourceRecordKind,
      sourceRecordId: item.sourceRecordId,
      staleEvidenceAnchor: item.staleEvidenceAnchor,
      newEvidenceAnchor: candidate.evidenceAnchor,
      expectedSourceRecordHash: 'not-current-source-record-hash',
    },
  });
  assert.equal(staleSource.ok, false);
  assert.equal(staleSource.error.code, 'E_ATLAS_SOURCE_RECORD_STALE');
  assert.equal(staleSource.stateHash, runtime.hashCoreState(movedState));

  const movedAgain = runtime.reduceCoreState(movedState, {
    type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId, sceneId, text: 'Later Anna arrived.' },
  });
  assert.equal(movedAgain.ok, true);
  const staleNewEvidence = runtime.reduceCoreState(movedAgain.state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH,
    payload: {
      projectId,
      sourceRecordKind: item.sourceRecordKind,
      sourceRecordId: item.sourceRecordId,
      staleEvidenceAnchor: item.staleEvidenceAnchor,
      newEvidenceAnchor: candidate.evidenceAnchor,
    },
  });
  assert.equal(staleNewEvidence.ok, false);
  assert.equal(staleNewEvidence.error.code, 'E_ATLAS_EVIDENCE_STALE');
  assert.equal(staleNewEvidence.stateHash, runtime.hashCoreState(movedAgain.state));
});

test('E04 C05: reattachment command is admitted only through Command Kernel capability revalidation', async () => {
  const { runtime, derived, projectId, movedState } = await buildReattachmentFixture();
  const registryModule = await loadModule(path.join('src', 'renderer', 'commands', 'registry.mjs'));
  const runnerModule = await loadModule(path.join('src', 'renderer', 'commands', 'runCommand.mjs'));
  const capabilityPolicy = await loadModule(path.join('src', 'renderer', 'commands', 'capabilityPolicy.mjs'));
  const localCapability = await loadModule(path.join('src', 'renderer', 'commands', 'localCapabilityProvider.mjs'));
  const inbox = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: movedState, params: { projectId } });
  const item = inbox.value.items[0];
  const candidate = inbox.value.candidates[0];
  const payload = {
    projectId,
    sourceRecordKind: item.sourceRecordKind,
    sourceRecordId: item.sourceRecordId,
    staleEvidenceAnchor: item.staleEvidenceAnchor,
    newEvidenceAnchor: candidate.evidenceAnchor,
  };

  assert.equal(capabilityPolicy.CAPABILITY_BINDING[runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH], 'cap.atlas.evidence.reattach');
  assert.equal(localCapability.resolveCommandEntitlement(runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH, { entitlementTier: 'free' }).available, true);

  const registry = registryModule.createCommandRegistry();
  registry.registerCommand(runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH, (input) => {
    return runtime.reduceCoreState(input.state, {
      type: runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH,
      payload: input.payload,
    });
  });
  const webRunner = runnerModule.createCommandRunner(registry, { capability: { defaultPlatformId: 'web' } });
  const denied = await webRunner(runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH, { state: movedState, payload });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND');

  const nodeRunner = runnerModule.createCommandRunner(registry, { capability: { defaultPlatformId: 'node', entitlementTier: 'free' } });
  const admitted = await nodeRunner(runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH, { state: movedState, payload });
  assert.equal(admitted.ok, true);
});

test('E04 C05: evidence reattachment inbox fails closed and adds no storage, network, UI, or bypass routes', async () => {
  const { derived, movedState } = await buildReattachmentFixture();
  const missingProjectId = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: movedState, params: {} });
  assert.equal(missingProjectId.ok, false);
  assert.equal(missingProjectId.error.code, 'E_ATLAS_PROJECT_ID_REQUIRED');

  const disabled = derived.deriveAtlasEvidenceReattachmentInbox({
    coreState: movedState,
    params: { projectId: 'atlas-reattach-project' },
    capabilitySnapshot: { capabilities: { atlasEvidenceReattachmentInbox: false } },
  });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND');
  assert.equal(disabled.error.details.capabilityId, 'atlas.evidenceReattachmentInbox');

  const sources = [
    path.join(process.cwd(), 'src', 'core', 'runtime.mjs'),
    path.join(process.cwd(), 'src', 'derived', 'atlas', 'deriveAtlasEvidenceReattachmentInbox.mjs'),
  ].map((filePath) => [path.basename(filePath), fs.readFileSync(filePath, 'utf8')]);
  const forbiddenPatterns = [
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
    /\bquerySelector\b/u,
    /\bdispatchEvent\b/u,
  ];
  for (const [basename, source] of sources) {
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(source, pattern, `${basename} matched ${pattern.source}`);
    }
  }
});

// Real reducers and derives; synthetic state is ephemeral and never persisted.
async function repeatReattachmentFixture() {
  const runtime = await loadModule('src/core/runtime.mjs'), derived = await loadModule('src/derived/index.mjs');
  const projectId = 'repeat-reattach', sceneId = 'scene-a', entityId = 'mira', decisionId = 'original';
  const text = 'Начало é 🧭. Мира увидела маяк. Северная ответила Мире. Мира сохранила знак.';
  const must = r => { assert.equal(r.ok, true, JSON.stringify(r.error)); return r.state; };
  const initial = must(runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    { type: 'project.create', payload: { projectId, sceneId, title: 'Repeat' } },
    { type: 'project.applyTextEdit', payload: { projectId, sceneId, text } },
    { type: 'atlas.entity.create', payload: { projectId, entityId, name: 'Мира', entityKind: 'character' } },
  ]));
  const query = state => derived.deriveAtlasCurrentSceneDossier({ coreState: state, params: { projectId, sceneId } });
  const anchor = query(initial).value.mentions.find(m => m.startOffset === 14).evidenceAnchor;
  const original = must(runtime.reduceCoreState(initial, { type: 'atlas.mention.confirm',
    payload: { projectId, sceneId, entityId, mentionId: query(initial).value.mentions[0].mentionId, evidenceAnchor: anchor, decisionId } }));
  const edit = (state, nextText) => must(runtime.reduceCoreState(state, { type: 'project.applyTextEdit', payload: { projectId, sceneId, text: nextText } }));
  const inbox = state => derived.deriveAtlasEvidenceReattachmentInbox({ coreState: state, params: { projectId } });
  const movedText = 'Добавлено. ' + text, moved = edit(original, movedText), item = inbox(moved).value.items[0];
  const payload = (state, id, offset) => {
    const current = query(state).value.mentions.find(m => m.startOffset === offset); assert.ok(current);
    return { projectId, sourceRecordKind: 'decision', sourceRecordId: decisionId, staleEvidenceAnchor: item.staleEvidenceAnchor,
      newEvidenceAnchor: current.evidenceAnchor, expectedSourceRecordHash: item.sourceRecordHash, reattachmentId: id, reason: 'Explicit selected occurrence' };
  };
  const attach = (state, id, offset) => must(runtime.reduceCoreState(state, { type: 'atlas.evidence.reattach', payload: payload(state, id, offset) }));
  const rawOriginal = JSON.stringify(original.data.projects[projectId].atlas.decisions[decisionId]);
  return { runtime, derived, projectId, sceneId, entityId, decisionId, text, movedText, moved, original, item, query, edit, inbox, payload, attach, rawOriginal };
}

test('reattachment inbox becomes review-required again after a second saved source edit and preserves every author byte', async () => {
  const f = await repeatReattachmentFixture(), attached = f.attach(f.moved, 'z-earlier', 68);
  const prior = JSON.stringify(attached.data.projects[f.projectId].atlas.evidenceReattachments);
  assert.equal(f.inbox(attached).value.items[0].status, 'REATTACHED');
  const changed = f.edit(attached, f.movedText + ' Позже.'), before = JSON.stringify(changed);
  const result = f.inbox(changed); assert.equal(result.ok, true);
  assert.equal(f.query(changed).value.summary.confirmedMentionCount, 0);
  assert.equal(result.value.items[0].status, 'REVIEW_REQUIRED'); assert.equal(result.value.items[0].currentEvidenceAnchor, null);
  assert.deepEqual(result.value.items[0].candidates.map(c => [c.evidenceAnchor.startOffset, c.evidenceAnchor.endOffset]), [[25, 29], [68, 72]]);
  assert.equal(result.value.summary.reviewRequiredCount, 1); assert.equal(result.value.summary.reattachedCount, 0);
  assert.equal(JSON.stringify(changed), before); assert.equal(JSON.stringify(changed.data.projects[f.projectId].atlas.evidenceReattachments), prior);
  const second = f.attach(changed, 'a-later', 25), latest = f.inbox(second).value.items[0];
  assert.equal(latest.status, 'REATTACHED'); assert.equal(latest.reattachmentId, 'a-later'); assert.equal(latest.currentEvidenceAnchor.startOffset, 25);
  assert.equal(JSON.stringify(second.data.projects[f.projectId].atlas.evidenceReattachments['z-earlier']), JSON.stringify(attached.data.projects[f.projectId].atlas.evidenceReattachments['z-earlier']));
  assert.equal(JSON.stringify(second.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.rawOriginal);
});

test('inbox selects canonical chronology rather than lexicographic ID and never resurrects superseded original evidence', async () => {
  const f = await repeatReattachmentFixture(), first = f.attach(f.moved, 'z-earlier', 68), latest = f.attach(first, 'a-later', 25);
  const before = JSON.stringify(latest), row = f.inbox(latest).value.items[0];
  assert.equal(row.reattachmentId, 'a-later'); assert.equal(row.currentEvidenceAnchor.startOffset, 25);
  const oldSource = f.edit(latest, f.text), oldBefore = JSON.stringify(oldSource);
  assert.equal(f.inbox(oldSource).value.items[0].status, 'REVIEW_REQUIRED'); assert.equal(f.query(oldSource).value.summary.confirmedMentionCount, 0);
  const restored = f.edit(oldSource, f.movedText); assert.equal(f.inbox(restored).value.items[0].status, 'REATTACHED');
  assert.equal(f.inbox(restored).value.items[0].currentEvidenceAnchor.startOffset, 25);
  assert.equal(JSON.stringify(latest), before); assert.equal(JSON.stringify(oldSource), oldBefore);
});

test('malformed or tied latest reattachment fails closed instead of falling back to older trust', async t => {
  const f = await repeatReattachmentFixture(), first = f.attach(f.moved, 'z-earlier', 68), latest = f.attach(first, 'a-later', 25);
  for (const [name, mutate] of [
    ['rawhash', r => { r.sourceRecordHash = '0'.repeat(64); }], ['foreign-project', r => { r.projectId = 'foreign'; }],
    ['foreign-entity', r => { r.newEvidenceAnchor.entityId = 'foreign'; }], ['malformed-entity', r => { r.newEvidenceAnchor.entityId = 42; }],
    ['old-witness', r => { r.staleEvidenceAnchor.quote = 'Лира'; }], ['noninteger-seq', r => { r.createdByCommandSeq += 0.5; }],
    ['wrong-operation', r => { r.operationKind = 'other'; }], ['automatic', r => { r.automaticReattachment = true; }],
  ]) await t.test(name, () => {
    const state = structuredClone(latest); mutate(state.data.projects[f.projectId].atlas.evidenceReattachments['a-later']);
    const before = JSON.stringify(state), row = f.inbox(state).value.items[0];
    assert.equal(row.status, 'REVIEW_REQUIRED', name); assert.equal(row.currentEvidenceAnchor, null); assert.equal(row.candidateCount, 2);
    assert.equal(JSON.stringify(state), before);
  });
  const tied = structuredClone(latest), ledger = tied.data.projects[f.projectId].atlas.evidenceReattachments;
  ledger.ambiguous = { ...structuredClone(ledger['a-later']), id: 'ambiguous' };
  assert.equal(f.inbox(tied).value.items[0].status, 'REVIEW_REQUIRED');
});

test('reattach rejects contradictory or nonstring raw anchor identities before normalization without changing source state', async t => {
  const f = await repeatReattachmentFixture();
  for (const field of ['staleEvidenceAnchor', 'newEvidenceAnchor']) for (const key of ['projectId', 'entityId'])
    for (const value of ['foreign', 42, null, { foreign: true }]) await t.test(`${field}-${key}-${JSON.stringify(value)}`, () => {
      const payload = f.payload(f.moved, 'must-not-commit', 68); payload[field] = { ...payload[field], [key]: value };
      const before = JSON.stringify(f.moved), result = f.runtime.reduceCoreState(f.moved, { type: 'atlas.evidence.reattach', payload });
      assert.equal(result.ok, false, 'raw identity cannot be laundered into omitted legacy identity');
      assert.deepEqual(result.state, f.moved); assert.equal(JSON.stringify(f.moved), before);
    });
});

test('legal omitted and blank-string new anchor identities remain compatible with original full witness and raw source hash', async () => {
  const f = await repeatReattachmentFixture();
  for (const kind of ['omitted', 'blank']) {
    const payload = f.payload(f.moved, 'legacy-' + kind, 68);
    for (const key of ['projectId', 'entityId']) { if (kind === 'omitted') delete payload.newEvidenceAnchor[key]; else payload.newEvidenceAnchor[key] = ''; }
    const result = f.runtime.reduceCoreState(f.moved, { type: 'atlas.evidence.reattach', payload }); assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(f.query(result.state).value.mentions.find(m => m.startOffset === 68).trustState, 'AUTHOR_CONFIRMED');
    assert.equal(f.inbox(result.state).value.items[0].status, 'REATTACHED');
    assert.equal(JSON.stringify(result.state.data.projects[f.projectId].atlas.decisions[f.decisionId]), f.rawOriginal);
  }
});

test('actual historically omitted or blank original anchor identities remain lossless and reattach against the raw original record hash', async () => {
  const f = await repeatReattachmentFixture(), hash = (await loadModule('src/core/browser-safe-hash.mjs')).hashCanonicalValue;
  for (const kind of ['omitted', 'blank']) {
    const state = structuredClone(f.moved), original = state.data.projects[f.projectId].atlas.decisions[f.decisionId];
    for (const key of ['projectId', 'entityId']) { if (kind === 'omitted') delete original.evidenceAnchor[key]; else original.evidenceAnchor[key] = ''; }
    original.evidenceAnchor.extension = { untouched: 'é 🧭' }; const raw = JSON.stringify(original), before = JSON.stringify(state);
    const payload = { ...f.payload(state, 'historical-' + kind, 68), staleEvidenceAnchor: structuredClone(original.evidenceAnchor), expectedSourceRecordHash: hash(original) };
    const result = f.runtime.reduceCoreState(state, { type: 'atlas.evidence.reattach', payload });
    assert.equal(result.ok, true, kind + ': ' + JSON.stringify(result.error)); assert.equal(JSON.stringify(state), before);
    assert.equal(JSON.stringify(result.state.data.projects[f.projectId].atlas.decisions[f.decisionId]), raw);
    assert.equal(result.state.data.projects[f.projectId].atlas.evidenceReattachments['historical-' + kind].sourceRecordHash, hash(original));
    assert.equal(f.query(result.state).value.mentions.find(m => m.startOffset === 68).trustState, 'AUTHOR_CONFIRMED');
  }
});

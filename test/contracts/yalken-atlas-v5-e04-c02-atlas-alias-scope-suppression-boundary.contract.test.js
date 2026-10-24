const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function buildScopedAliasFixture() {
  const runtime = await loadModule(path.join('src', 'core', 'runtime.mjs'));
  const projectId = 'atlas-scope-project';
  const sceneAId = 'scene-a';
  const sceneBId = 'scene-b';
  const sceneAText = 'The Shadow met Scene-only at the gate.';
  const sceneBText = 'The Shadow ignored Scene-only in the market.';
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE,
      payload: { projectId, title: 'Atlas scope', sceneId: sceneAId },
    },
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
      payload: { projectId, sceneId: sceneAId, text: sceneAText },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE,
      payload: { projectId, entityId: 'entity-shadow', name: 'Nobody says this name', entityKind: 'character' },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ALIAS_ADD,
      payload: { projectId, entityId: 'entity-shadow', aliasId: 'alias-shadow', value: 'The Shadow', scope: 'project' },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE,
      payload: { projectId, entityId: 'entity-scoped', name: 'Hidden scoped name', entityKind: 'place' },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_ALIAS_ADD,
      payload: { projectId, entityId: 'entity-scoped', aliasId: 'alias-scene-only', value: 'Scene-only', scope: 'scene', sceneId: sceneAId },
    },
  ]);
  assert.equal(built.ok, true);

  const state = JSON.parse(JSON.stringify(built.state));
  state.data.projects[projectId].scenes[sceneBId] = {
    id: sceneBId,
    title: 'Second scene',
    text: sceneBText,
  };
  return { runtime, projectId, sceneAId, sceneBId, sceneAText, sceneBText, state };
}

test('E04 C02: scene-scoped aliases match only their declared scene while project aliases remain global', async () => {
  const { projectId, sceneAId, sceneBId, state } = await buildScopedAliasFixture();
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));

  const index = derived.deriveAtlasMentionIndex({ coreState: state, params: { projectId } });
  assert.equal(index.ok, true);
  assert.deepEqual(
    index.value.mentions.map((mention) => [mention.sceneId, mention.entityId, mention.matchedText]),
    [
      [sceneAId, 'entity-shadow', 'The Shadow'],
      [sceneAId, 'entity-scoped', 'Scene-only'],
      [sceneBId, 'entity-shadow', 'The Shadow'],
    ],
  );
  assert.equal(index.value.mentions.some((mention) => mention.sceneId === sceneBId && mention.entityId === 'entity-scoped'), false);

  const aggregate = derived.deriveAtlasObservationAggregate({ coreState: state, params: { projectId, languageCode: 'en' } });
  assert.equal(aggregate.ok, true);
  assert.equal(aggregate.value.summary.observationCount, 3);
  assert.equal(aggregate.value.summary.activeObservationCount, 3);
  assert.equal(aggregate.value.summary.suppressedObservationCount, 0);
  assert.equal(aggregate.value.summary.hiddenFilterApplied, false);
});

test('E04 C02: explicit suppression is author truth and projection readback never hides evidence', async () => {
  const { runtime, projectId, sceneAId, sceneAText, state } = await buildScopedAliasFixture();
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const beforeText = state.data.projects[projectId].scenes[sceneAId].text;
  const beforeAggregate = derived.deriveAtlasObservationAggregate({ coreState: state, params: { projectId, languageCode: 'en' } });
  assert.equal(beforeAggregate.ok, true);
  const target = beforeAggregate.value.observations.find((observation) => observation.entityId === 'entity-scoped');
  assert.ok(target);

  const suppressed = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS,
    payload: {
      projectId,
      sceneId: target.sceneId,
      entityId: target.entityId,
      observationId: target.observationId,
      mentionId: target.mentionId,
      evidenceAnchor: target.evidenceAnchor,
      reason: 'Not a real place in this scene',
    },
  });
  assert.equal(suppressed.ok, true);
  assert.equal(suppressed.state.data.projects[projectId].scenes[sceneAId].text, beforeText);

  const reopened = JSON.parse(JSON.stringify(suppressed.state));
  const suppressions = reopened.data.projects[projectId].atlas.suppressions;
  const suppressionId = Object.keys(suppressions)[0];
  assert.match(suppressionId, /^atlas-suppression:/u);
  assert.deepEqual(suppressions[suppressionId], {
    id: suppressionId,
    suppressionKind: 'observation.suppress',
    projectId,
    sceneId: target.sceneId,
    entityId: target.entityId,
    observationId: target.observationId,
    mentionId: target.mentionId,
    reason: 'Not a real place in this scene',
    evidenceAnchor: target.evidenceAnchor,
    createdByCommandSeq: 7,
  });

  const afterAggregate = derived.deriveAtlasObservationAggregate({ coreState: reopened, params: { projectId, languageCode: 'en' } });
  assert.equal(afterAggregate.ok, true);
  assert.equal(afterAggregate.value.summary.observationCount, beforeAggregate.value.summary.observationCount);
  assert.equal(afterAggregate.value.summary.activeObservationCount, 2);
  assert.equal(afterAggregate.value.summary.suppressedObservationCount, 1);
  assert.equal(afterAggregate.value.summary.hiddenFilterApplied, false);
  const readback = afterAggregate.value.observations.find((observation) => observation.observationId === target.observationId);
  assert.equal(readback.suppressionState, 'SUPPRESSED');
  assert.equal(readback.suppressionId, suppressionId);
  assert.equal(readback.suppressionReason, 'Not a real place in this scene');
  assert.deepEqual(readback.evidenceAnchor, target.evidenceAnchor);
  assert.equal(readback.evidenceAnchor.quote, sceneAText.slice(target.startOffset, target.endOffset));
});

test('E04 C02: suppression command fails closed for invalid evidence without mutation', async () => {
  const { runtime, projectId, state } = await buildScopedAliasFixture();
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const aggregate = derived.deriveAtlasObservationAggregate({ coreState: state, params: { projectId } });
  assert.equal(aggregate.ok, true);
  const target = aggregate.value.observations[0];
  const beforeHash = runtime.hashCoreState(state);

  const badEvidence = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS,
    payload: {
      projectId,
      sceneId: target.sceneId,
      entityId: target.entityId,
      observationId: target.observationId,
      evidenceAnchor: {
        ...target.evidenceAnchor,
        sceneId: 'wrong-scene',
      },
    },
  });
  assert.equal(badEvidence.ok, false);
  assert.equal(badEvidence.error.code, 'E_ATLAS_EVIDENCE_SCENE_MISMATCH');
  assert.equal(badEvidence.stateHash, beforeHash);

  const missingObservation = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS,
    payload: {
      projectId,
      sceneId: target.sceneId,
      entityId: target.entityId,
      evidenceAnchor: target.evidenceAnchor,
    },
  });
  assert.equal(missingObservation.ok, false);
  assert.equal(missingObservation.error.code, 'E_ATLAS_OBSERVATION_ID_REQUIRED');
  assert.equal(missingObservation.stateHash, beforeHash);
});

test('E04 C02: suppression command is admitted only through Command Kernel capability revalidation', async () => {
  const { runtime, projectId, state } = await buildScopedAliasFixture();
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const registryModule = await loadModule(path.join('src', 'renderer', 'commands', 'registry.mjs'));
  const runnerModule = await loadModule(path.join('src', 'renderer', 'commands', 'runCommand.mjs'));
  const capabilityPolicy = await loadModule(path.join('src', 'renderer', 'commands', 'capabilityPolicy.mjs'));
  const localCapability = await loadModule(path.join('src', 'renderer', 'commands', 'localCapabilityProvider.mjs'));
  const aggregate = derived.deriveAtlasObservationAggregate({ coreState: state, params: { projectId } });
  const target = aggregate.value.observations[0];

  assert.equal(capabilityPolicy.CAPABILITY_BINDING[runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS], 'cap.atlas.observation.suppress');
  assert.equal(localCapability.resolveCommandEntitlement(runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS, { entitlementTier: 'free' }).available, true);

  const registry = registryModule.createCommandRegistry();
  registry.registerCommand(runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS, (input) => {
    return runtime.reduceCoreState(input.state, {
      type: runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS,
      payload: input.payload,
    });
  });

  const webRunner = runnerModule.createCommandRunner(registry, {
    capability: { defaultPlatformId: 'web' },
  });
  const denied = await webRunner(runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS, {
    state,
    payload: {
      projectId,
      sceneId: target.sceneId,
      entityId: target.entityId,
      observationId: target.observationId,
      evidenceAnchor: target.evidenceAnchor,
    },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND');

  const nodeRunner = runnerModule.createCommandRunner(registry, {
    capability: { defaultPlatformId: 'node', entitlementTier: 'free' },
  });
  const admitted = await nodeRunner(runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS, {
    state,
    payload: {
      projectId,
      sceneId: target.sceneId,
      entityId: target.entityId,
      observationId: target.observationId,
      evidenceAnchor: target.evidenceAnchor,
    },
  });
  assert.equal(admitted.ok, true);
  assert.equal(Object.keys(admitted.state.data.projects[projectId].atlas.suppressions).length, 1);
});

test('E04 C02: alias scope and suppression boundary adds no storage, network, UI, or bypass routes', () => {
  const sources = [
    path.join(process.cwd(), 'src', 'core', 'runtime.mjs'),
    path.join(process.cwd(), 'src', 'derived', 'atlas', 'deriveAtlasMentionIndex.mjs'),
    path.join(process.cwd(), 'src', 'derived', 'atlas', 'deriveAtlasObservationAggregate.mjs'),
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

// Pure Core/derived causal oracle; physical Main persistence is covered separately.
const EXPLICIT_SUPPRESSION_TEXT = 'Начало é 🧭. Мира увидела маяк. Северная ответила Мире. Мира сохранила знак.';
async function explicitSuppressionFixture() {
  const runtime = await loadModule('src/core/runtime.mjs'), derived = await loadModule('src/derived/index.mjs');
  const { hashCanonicalValue: hash, canonicalSerialize } = await loadModule('src/core/browser-safe-hash.mjs');
  const projectId = 'explicit-suppression-project', sceneId = 'scene-a', entityId = 'mira';
  const must = result => { assert.equal(result.ok, true, JSON.stringify(result.error)); return result.state; };
  const initial = must(runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    { type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId, title: 'Explicit suppression', sceneId } },
    { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId, text: EXPLICIT_SUPPRESSION_TEXT } },
    { type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE, payload: { projectId, entityId, name: 'Мира', entityKind: 'character' } },
  ]));
  const aggregate = state => { const r = derived.deriveAtlasObservationAggregate({ coreState: state, params: { projectId } }); assert.equal(r.ok, true); return r.value; };
  const inbox = state => { const r = derived.deriveAtlasEvidenceReattachmentInbox({ coreState: state, params: { projectId } }); assert.equal(r.ok, true); return r.value; };
  const dossier = state => { const r = derived.deriveAtlasEntityDossier({ coreState: state, params: { projectId, entityId } }); assert.equal(r.ok, true); return r.value; };
  const edit = (state, text) => must(runtime.reduceCoreState(state, { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId, text } }));
  const observations = aggregate(initial).observations; assert.deepEqual(observations.map(o => [o.startOffset, o.endOffset]), [[14, 18], [57, 61]]);
  const payload = (observation = observations[0], suppressionId = 'saved-suppression') => ({ projectId, sceneId, entityId,
    observationId: observation.observationId, mentionId: observation.mentionId, suppressionId, reason: 'Explicit mistaken occurrence',
    evidenceAnchor: { ...structuredClone(observation.evidenceAnchor), futureSuppressionWitness: { unicode: 'é 🧭', array: [1, null, { retain: true }] } } });
  const suppress = (state, p = payload()) => must(runtime.reduceCoreState(state, { type: runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS, payload: p }));
  const saved = suppress(initial), original = structuredClone(saved.data.projects[projectId].atlas.suppressions['saved-suppression']);
  const assertOriginal = state => { const actual = state.data.projects[projectId].atlas.suppressions['saved-suppression'];
    assert.deepEqual(actual, original); assert.equal(hash(actual), hash(original)); assert.equal(canonicalSerialize(actual), canonicalSerialize(original)); };
  const reattachPayload = (state, id, offset) => {
    const item = inbox(state).items.find(i => i.sourceRecordKind === 'suppression' && i.sourceRecordId === original.id); assert.ok(item);
    const candidate = item.candidates.find(c => c.evidenceAnchor.startOffset === offset); assert.ok(candidate, 'real inbox factory supplies explicit target');
    return { projectId, sourceRecordKind: 'suppression', sourceRecordId: original.id, expectedSourceRecordHash: hash(original),
      staleEvidenceAnchor: structuredClone(original.evidenceAnchor), newEvidenceAnchor: structuredClone(candidate.evidenceAnchor), reattachmentId: id, reason: 'Explicit chosen correction' };
  };
  const attach = (state, id, offset) => must(runtime.reduceCoreState(state, { type: runtime.CORE_COMMAND_IDS.ATLAS_EVIDENCE_REATTACH, payload: reattachPayload(state, id, offset) }));
  return { runtime, derived, hash, projectId, sceneId, entityId, initial, observations, payload, suppress, saved, original, assertOriginal, aggregate, inbox, dossier, edit, attach, reattachPayload };
}

test('explicit suppression keeps all evidence and exactly one duplicate inactive with full original witness preserved', async () => {
  const f = await explicitSuppressionFixture(), before = JSON.stringify(f.saved), value = f.aggregate(f.saved);
  assert.equal(value.summary.observationCount, 2); assert.equal(value.summary.activeObservationCount, 1); assert.equal(value.summary.suppressedObservationCount, 1);
  assert.equal(value.summary.hiddenFilterApplied, false); assert.equal(value.observations.find(o => o.startOffset === 14).suppressionState, 'SUPPRESSED');
  assert.equal(value.observations.find(o => o.startOffset === 57).suppressionState, 'ACTIVE');
  const dossier = f.dossier(f.saved); assert.equal(dossier.summary.activeObservationCount, 1); assert.equal(dossier.summary.suppressedObservationCount, 1);
  const source = dossier.evidenceLedger.sourceRecords.find(r => r.sourceRecordKind === 'suppression'); assert.ok(source);
  assert.equal(source.sourceRecordHash, f.hash(f.original)); assert.deepEqual(source.evidenceAnchor, f.original.evidenceAnchor);
  assert.deepEqual(source.evidenceAnchor.futureSuppressionWitness, { unicode: 'é 🧭', array: [1, null, { retain: true }] });
  f.assertOriginal(JSON.parse(JSON.stringify(f.saved))); assert.equal(JSON.stringify(f.saved), before, 'all projection reads are pure');
  assert.equal(f.saved.data.projects[f.projectId].scenes[f.sceneId].text, EXPLICIT_SUPPRESSION_TEXT);
});

test('unchanged mention IDs after unrelated source append cannot preserve stale suppression authority', async () => {
  const f = await explicitSuppressionFixture(), changed = f.edit(f.saved, EXPLICIT_SUPPRESSION_TEXT + ' Позже.');
  const value = f.aggregate(changed); assert.deepEqual(value.observations.map(o => o.mentionId), f.observations.map(o => o.mentionId));
  assert.equal(f.inbox(changed).items[0].status, 'REVIEW_REQUIRED'); assert.equal(value.summary.suppressedObservationCount, 0);
  assert.equal(value.summary.activeObservationCount, 2); assert.equal(value.summary.observationCount, 2);
  const dossier = f.dossier(changed); assert.equal(dossier.summary.reviewRequiredEvidenceCount, 1); assert.equal(dossier.summary.suppressedObservationCount, 0);
  f.assertOriginal(changed);
});

test('inconsistent observation and mention IDs never suppress another duplicate beyond the actual full witness', async () => {
  const f = await explicitSuppressionFixture(), p = f.payload(); p.mentionId = f.observations[1].mentionId; p.observationId = f.observations[1].observationId;
  const state = f.suppress(f.initial, p), value = f.aggregate(state);
  assert.equal(value.summary.suppressedObservationCount, 1, 'IDs cannot grant authority to a second occurrence');
  assert.equal(value.observations.find(o => o.startOffset === 14).suppressionState, 'SUPPRESSED');
  assert.equal(value.observations.find(o => o.startOffset === 57).suppressionState, 'ACTIVE');
  assert.equal(state.data.projects[f.projectId].scenes[f.sceneId].text, EXPLICIT_SUPPRESSION_TEXT);
});

test('saved suppression follows only explicit latest valid reattachment and requires review after every subsequent edit', async () => {
  const f = await explicitSuppressionFixture(), moved = f.edit(f.saved, 'Добавлено. ' + EXPLICIT_SUPPRESSION_TEXT);
  assert.equal(f.aggregate(moved).summary.suppressedObservationCount, 0); assert.equal(f.inbox(moved).items[0].status, 'REVIEW_REQUIRED');
  const attached = f.attach(moved, 'z-first-correction', 68), record = structuredClone(attached.data.projects[f.projectId].atlas.evidenceReattachments['z-first-correction']);
  const value = f.aggregate(attached); assert.equal(value.summary.suppressedObservationCount, 1); assert.equal(value.summary.activeObservationCount, 1);
  assert.equal(value.observations.find(o => o.startOffset === 68).suppressionState, 'SUPPRESSED');
  assert.equal(value.observations.find(o => o.startOffset === 25).suppressionState, 'ACTIVE');
  const dossier = f.dossier(attached); assert.equal(dossier.summary.reattachedEvidenceCount, 1); assert.equal(dossier.summary.suppressedObservationCount, 1);
  const changed = f.edit(attached, 'Добавлено. ' + EXPLICIT_SUPPRESSION_TEXT + ' Позже.');
  assert.equal(f.aggregate(changed).summary.suppressedObservationCount, 0); assert.equal(f.inbox(changed).items[0].status, 'REVIEW_REQUIRED');
  const restored = f.edit(changed, EXPLICIT_SUPPRESSION_TEXT); assert.equal(f.aggregate(restored).summary.suppressedObservationCount, 0, 'old original cannot resurrect after latest correction');
  const second = f.attach(restored, 'a-later-correction', 57), latest = f.aggregate(second);
  assert.equal(latest.summary.suppressedObservationCount, 1); assert.equal(latest.observations.find(o => o.startOffset === 57).suppressionState, 'SUPPRESSED');
  assert.equal(latest.observations.find(o => o.startOffset === 14).suppressionState, 'ACTIVE');
  assert.equal(f.inbox(second).items[0].reattachmentId, 'a-later-correction'); f.assertOriginal(second);
  assert.deepEqual(second.data.projects[f.projectId].atlas.evidenceReattachments['z-first-correction'], record);
  const cold = JSON.parse(JSON.stringify(second)); assert.deepEqual(f.aggregate(cold), latest); f.assertOriginal(cold);
  const finalEdit = f.edit(cold, EXPLICIT_SUPPRESSION_TEXT + ' Снова.'); assert.equal(f.aggregate(finalEdit).summary.suppressedObservationCount, 0);
  assert.equal(f.dossier(finalEdit).summary.reviewRequiredEvidenceCount, 1);
});

test('malformed tied or source-unbound latest suppression witnesses never fall back to older trust', async t => {
  const f = await explicitSuppressionFixture(), moved = f.edit(f.saved, 'Добавлено. ' + EXPLICIT_SUPPRESSION_TEXT), attached = f.attach(moved, 'first', 68);
  for (const [name, mutate] of [
    ['wrong-operation', r => { r.operationKind = 'other'; }], ['wrong-source-hash', r => { r.sourceRecordHash = '0'.repeat(64); }],
    ['foreign-project', r => { r.projectId = 'foreign'; }], ['malformed-entity', r => { r.newEvidenceAnchor.entityId = null; }],
    ['wrong-range', r => { r.newEvidenceAnchor.startOffset = 25; }], ['missing-sequence', r => { delete r.createdByCommandSeq; }],
    ['tie', (_r, ledger) => { ledger.tied = structuredClone(ledger.first); ledger.tied.id = 'tied'; }],
  ]) await t.test(name, () => {
    const state = structuredClone(attached), ledger = state.data.projects[f.projectId].atlas.evidenceReattachments; mutate(ledger.first, ledger);
    assert.equal(f.inbox(state).items[0].status, 'REVIEW_REQUIRED'); assert.equal(f.aggregate(state).summary.suppressedObservationCount, 0);
    const originalSourceRestored = f.edit(state, EXPLICIT_SUPPRESSION_TEXT); assert.equal(f.aggregate(originalSourceRestored).summary.suppressedObservationCount, 0);
    f.assertOriginal(state); f.assertOriginal(originalSourceRestored);
  });
});

test('suppression validates raw evidence identities before normalization and retains lawful omitted or blank legacy identities', async t => {
  const f = await explicitSuppressionFixture();
  for (const key of ['projectId', 'sceneId', 'entityId']) for (const value of ['foreign', null, 42, { forged: true }, ' ' + f.payload().evidenceAnchor[key] + ' '])
    await t.test(`${key}-${JSON.stringify(value)}`, () => {
      const p = f.payload(); p.evidenceAnchor[key] = value; const before = JSON.stringify(f.initial);
      const r = f.runtime.reduceCoreState(f.initial, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_OBSERVATION_SUPPRESS, payload: p });
      assert.equal(r.ok, false, JSON.stringify(r)); assert.equal(r.error.op, 'atlas.observation.suppress'); assert.equal(JSON.stringify(f.initial), before);
    });
  for (const key of ['projectId', 'sceneId', 'entityId']) for (const blank of [false, true]) await t.test(`legacy-${key}-${blank}`, () => {
    const p = f.payload(); if (blank) p.evidenceAnchor[key] = ''; else delete p.evidenceAnchor[key];
    const state = f.suppress(f.initial, p); assert.equal(f.aggregate(state).summary.suppressedObservationCount, 1);
    assert.deepEqual(state.data.projects[f.projectId].atlas.suppressions[p.suppressionId].evidenceAnchor.futureSuppressionWitness, p.evidenceAnchor.futureSuppressionWitness);
  });
});

test('foreign malformed or contradictory saved suppression ownership cannot become active from identifiers alone', async t => {
  const f = await explicitSuppressionFixture();
  for (const [key, value] of [['projectId', 'foreign'], ['projectId', null], ['entityId', 'foreign'], ['sceneId', 'foreign'], ['suppressionKind', 'wrong']])
    await t.test(`${key}-${JSON.stringify(value)}`, () => {
      const state = structuredClone(f.saved); state.data.projects[f.projectId].atlas.suppressions[f.original.id][key] = value;
      const before = JSON.stringify(state); assert.equal(f.aggregate(state).summary.suppressedObservationCount, 0); assert.equal(JSON.stringify(state), before);
    });
});

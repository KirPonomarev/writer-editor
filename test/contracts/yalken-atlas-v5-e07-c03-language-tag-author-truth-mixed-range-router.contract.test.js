const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function buildLanguageTagFixture() {
  const runtime = await loadModule(path.join('src', 'core', 'runtime.mjs'));
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const projectId = 'atlas-language-tag-project';
  const sceneAId = 'scene-a';
  const sceneBId = 'scene-b';
  const created = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE,
      payload: { projectId, title: 'Atlas language tags', sceneId: sceneAId },
    },
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
      payload: {
        projectId,
        sceneId: sceneAId,
        text: 'Anna says hello. Затем Анна отвечает. שלום נשאר כאן.',
      },
    },
  ]);
  assert.equal(created.ok, true);
  const state = JSON.parse(JSON.stringify(created.state));
  state.data.projects[projectId].languageCode = 'en';
  state.data.projects[projectId].scenes[sceneBId] = {
    id: sceneBId,
    title: 'Russian default scene',
    text: 'Анна пишет письмо, then adds an English note.',
  };
  return { runtime, derived, projectId, sceneAId, sceneBId, state };
}

function nodeCapabilitySnapshot() {
  return {
    platformId: 'node',
    capabilities: {
      atlasMixedLanguageRouter: true,
    },
  };
}

test('E07 C03: Atlas language tag commands persist author truth and route mixed ranges without manuscript mutation', async () => {
  const { runtime, derived, projectId, sceneAId, sceneBId, state } = await buildLanguageTagFixture();
  const sceneATextBefore = state.data.projects[projectId].scenes[sceneAId].text;
  const sceneBTextBefore = state.data.projects[projectId].scenes[sceneBId].text;
  const ruStart = sceneATextBefore.indexOf('Затем');
  const ruEnd = sceneATextBefore.indexOf('שלום') - 1;
  const heStart = sceneATextBefore.indexOf('שלום');
  const heEnd = sceneATextBefore.length;

  const tagged = runtime.applyCoreSequence(state, [
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: {
        projectId,
        scopeKind: 'project',
        languageCode: 'en',
        note: 'Project default is English.',
      },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: {
        projectId,
        scopeKind: 'scene',
        sceneId: sceneBId,
        languageCode: 'ru',
      },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: {
        projectId,
        scopeKind: 'range',
        sceneId: sceneAId,
        startOffset: ruStart,
        endOffset: ruEnd,
        languageCode: 'ru',
      },
    },
    {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: {
        projectId,
        scopeKind: 'range',
        sceneId: sceneAId,
        startOffset: heStart,
        endOffset: heEnd,
        languageCode: 'he',
      },
    },
  ]);
  assert.equal(tagged.ok, true);
  const reopened = JSON.parse(JSON.stringify(tagged.state));
  const project = reopened.data.projects[projectId];
  assert.equal(project.scenes[sceneAId].text, sceneATextBefore);
  assert.equal(project.scenes[sceneBId].text, sceneBTextBefore);
  assert.equal(project.atlas.languageTags.project.schemaVersion, derived.ATLAS_LANGUAGE_TAG_SCHEMA_VERSION);
  assert.equal(project.atlas.languageTags.project.languageCode, 'en');
  assert.equal(Object.keys(project.atlas.languageTags.ranges).length, 2);
  assert.match(project.atlas.languageTags.project.sourceHash, /^[0-9a-f]{64}$/u);

  const routed = derived.deriveAtlasMixedLanguageRouter({
    coreState: reopened,
    params: { projectId },
    capabilitySnapshot: nodeCapabilitySnapshot(),
  });
  assert.equal(routed.ok, true);
  assert.equal(routed.value.schemaVersion, derived.ATLAS_MIXED_LANGUAGE_ROUTER_SCHEMA_VERSION);
  assert.deepEqual(routed.value.surfaceManifest.commandIds, ['atlas.languageTag.set', 'atlas.languageTag.clear']);
  assert.equal(routed.value.authority.projectTruthMutation, false);
  assert.equal(routed.value.authority.manuscriptMutation, false);
  assert.equal(routed.value.authority.storageMutation, false);
  assert.equal(routed.value.authority.networkMutation, false);
  assert.equal(routed.value.authority.automaticLanguageDetection, false);
  assert.equal(routed.value.summary.languageTagCount, 4);
  assert.equal(routed.value.summary.englishFallbackCount, 0);
  assert.equal(routed.value.summary.deepRouteCount, 0);
  assert.equal(routed.value.summary.unsupportedExactOnlyRouteCount, 1);
  assert.ok(routed.value.routes.some((route) => route.sceneId === sceneAId && route.languageCode === 'ru' && route.policy.analysisMode === 'BASIC_EXACT_TERM'));
  const hebrewRoute = routed.value.routes.find((route) => route.sceneId === sceneAId && route.languageCode === 'he');
  assert.ok(hebrewRoute);
  assert.equal(hebrewRoute.policy.languagePolicy, derived.ATLAS_OBSERVATION_LANGUAGE_POLICY.UNSUPPORTED_EXACT_ONLY);
  assert.equal(hebrewRoute.policy.analysisMode, 'GLOBAL_EXACT_ONLY');
  assert.equal(hebrewRoute.policy.exactOnly, true);
  assert.equal(hebrewRoute.policy.englishFallback, false);
  assert.equal(hebrewRoute.adapterOffsetDomain, 'UTF16_JS_CODE_UNIT');
  assert.ok(Number.isInteger(hebrewRoute.codePointRange.start));
  assert.ok(Number.isInteger(hebrewRoute.graphemeRange.start));
  assert.ok(routed.value.routes.some((route) => route.sceneId === sceneBId && route.languageCode === 'ru'));
});

test('E07 C03: Atlas language tag commands fail closed for invalid ranges stale hashes and overlapping overrides', async () => {
  const { runtime, projectId, sceneAId, state } = await buildLanguageTagFixture();
  const beforeHash = runtime.hashCoreState(state);
  const text = state.data.projects[projectId].scenes[sceneAId].text;
  const invalid = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: {
      projectId,
      scopeKind: 'range',
      sceneId: sceneAId,
      startOffset: 10,
      endOffset: text.length + 10,
      languageCode: 'ru',
    },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'E_ATLAS_LANGUAGE_TAG_RANGE_INVALID');
  assert.equal(invalid.stateHash, beforeHash);

  const saved = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: {
      projectId,
      scopeKind: 'range',
      sceneId: sceneAId,
      startOffset: 0,
      endOffset: 16,
      languageCode: 'en',
    },
  });
  assert.equal(saved.ok, true);
  const overlap = runtime.reduceCoreState(saved.state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: {
      projectId,
      scopeKind: 'range',
      sceneId: sceneAId,
      startOffset: 8,
      endOffset: 24,
      languageCode: 'ru',
    },
  });
  assert.equal(overlap.ok, false);
  assert.equal(overlap.error.code, 'E_ATLAS_LANGUAGE_TAG_RANGE_OVERLAP');
  assert.equal(overlap.stateHash, runtime.hashCoreState(saved.state));

  const stale = runtime.reduceCoreState(saved.state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_CLEAR,
    payload: {
      projectId,
      scopeKind: 'range',
      sceneId: sceneAId,
      startOffset: 0,
      endOffset: 16,
      expectedTagHash: 'deadbeef',
    },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, 'E_ATLAS_LANGUAGE_TAG_STALE');
  assert.equal(stale.stateHash, runtime.hashCoreState(saved.state));

  const storedTag = Object.values(saved.state.data.projects[projectId].atlas.languageTags.ranges)[0];
  const cleared = runtime.reduceCoreState(saved.state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_CLEAR,
    payload: {
      projectId,
      scopeKind: 'range',
      sceneId: sceneAId,
      startOffset: 0,
      endOffset: 16,
      expectedTagHash: runtime.hashCoreState(storedTag),
    },
  });
  assert.equal(cleared.ok, true);
  assert.equal(Object.keys(cleared.state.data.projects[projectId].atlas.languageTags.ranges).length, 0);
  assert.equal(cleared.state.data.projects[projectId].scenes[sceneAId].text, text);
});

test('R1 C: Atlas language tag command validates BCP47 before mutation and only accepts explicit und', async () => {
  const { runtime, projectId, state } = await buildLanguageTagFixture();
  const beforeHash = runtime.hashCoreState(state);
  for (const languageCode of ['', '   ', null, 'pt_BR', 'en_US']) {
    const invalid = runtime.reduceCoreState(state, {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: {
        projectId,
        scopeKind: 'project',
        languageCode,
      },
    });
    assert.equal(invalid.ok, false, `invalid language tag was accepted: ${String(languageCode)}`);
    assert.equal(invalid.error.code, 'E_ATLAS_LANGUAGE_TAG_BCP47_INVALID');
    assert.equal(invalid.stateHash, beforeHash);
  }

  const canonicalized = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: {
      projectId,
      scopeKind: 'project',
      languageCode: 'EN-us',
    },
  });
  assert.equal(canonicalized.ok, true, JSON.stringify(canonicalized.error));
  assert.equal(canonicalized.state.data.projects[projectId].atlas.languageTags.project.languageCode, 'en-US');

  const und = runtime.reduceCoreState(state, {
    type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: {
      projectId,
      scopeKind: 'project',
      languageCode: 'und',
    },
  });
  assert.equal(und.ok, true, JSON.stringify(und.error));
  assert.equal(und.state.data.projects[projectId].atlas.languageTags.project.languageCode, 'und');
});

test('E07 C03: Atlas language tag commands are admitted only through node capability revalidation', async () => {
  const { runtime, projectId, sceneAId, state } = await buildLanguageTagFixture();
  const registryModule = await loadModule(path.join('src', 'renderer', 'commands', 'registry.mjs'));
  const runnerModule = await loadModule(path.join('src', 'renderer', 'commands', 'runCommand.mjs'));
  const capabilityPolicy = await loadModule(path.join('src', 'renderer', 'commands', 'capabilityPolicy.mjs'));
  const localCapability = await loadModule(path.join('src', 'renderer', 'commands', 'localCapabilityProvider.mjs'));
  const registry = registryModule.createCommandRegistry();
  registry.registerCommand(runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, (input) => {
    return runtime.reduceCoreState(input.state, {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: input.payload,
    });
  });
  registry.registerCommand(runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_CLEAR, (input) => {
    return runtime.reduceCoreState(input.state, {
      type: runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_CLEAR,
      payload: input.payload,
    });
  });

  assert.equal(
    capabilityPolicy.CAPABILITY_BINDING[runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET],
    'cap.atlas.languageTag.edit',
  );
  const runner = runnerModule.createCommandRunner(registry, { capability: { defaultPlatformId: 'node' } });
  const accepted = await runner(runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, {
    state,
    payload: {
      projectId,
      scopeKind: 'scene',
      sceneId: sceneAId,
      languageCode: 'en',
    },
    entitlementTier: localCapability.LOCAL_ENTITLEMENT_TIERS.FREE,
  });
  assert.equal(accepted.ok, true);

  const deniedRunner = runnerModule.createCommandRunner(registry, { capability: { defaultPlatformId: 'web' } });
  const denied = await deniedRunner(runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, {
    state,
    payload: {
      projectId,
      scopeKind: 'scene',
      sceneId: sceneAId,
      languageCode: 'en',
    },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND');
});

test('E07 C03: mixed-language router exports and side-effect boundaries remain pure', async () => {
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  assert.equal(typeof derived.deriveAtlasMixedLanguageRouter, 'function');
  assert.equal(derived.ATLAS_LANGUAGE_TAG_SCOPE_KIND.RANGE, 'range');
  assert.equal(derived.ATLAS_MIXED_LANGUAGE_ROUTER_VIEW_ID, 'derived.atlas.mixedLanguageRouter.v1');

  const sourceFiles = [
    path.join('src', 'derived', 'atlas', 'deriveAtlasMixedLanguageRouter.mjs'),
    path.join('src', 'derived', 'atlas', 'atlasLanguageTagTypes.mjs'),
  ];
  for (const file of sourceFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(source, /\bwriteFile(?:Sync)?\b/u);
    assert.doesNotMatch(source, /\bfetch\s*\(/u);
    assert.doesNotMatch(source, /\bXMLHttpRequest\b/u);
    assert.doesNotMatch(source, /\bipcRenderer\b/u);
    assert.doesNotMatch(source, /\bdispatchUiCommand\b/u);
    assert.doesNotMatch(source, /\bWorker\b/u);
    assert.doesNotMatch(source, /\bchild_process\b/u);
    assert.doesNotMatch(source, /\bimport\s*\(/u);
    assert.doesNotMatch(source, /englishFallback:\s*true/u);
    assert.doesNotMatch(source, /deepSupported:\s*true/u);
  }
});

// V2 is an explicit source-bound author intent. The five original v1 cases
// above remain unchanged and do not stand in for current product/native proof.
async function boundRangeLanguageFixture() {
  const f = await buildLanguageTagFixture();
  const scene = f.state.data.projects[f.projectId].scenes[f.sceneAId];
  scene.sceneRevision = 'sha256:' + f.runtime.hashCoreState({ ownedRawFixture: scene.text });
  const startOffset = scene.text.indexOf('Затем');
  const endOffset = scene.text.indexOf('שלום') - 1;
  return { ...f, text: scene.text, intent: {
    projectId: f.projectId, sceneId: f.sceneAId, scopeKind: 'range', rangeIntentVersion: 2,
    sceneRevision: scene.sceneRevision, sceneTextHash: f.runtime.hashCoreState(scene.text),
    startOffset, endOffset, quoteText: scene.text.slice(startOffset, endOffset), languageCode: 'ru',
  } };
}

function soleRangeLanguageRecord(state, projectId) {
  const rows = Object.values(state.data.projects[projectId].atlas.languageTags.ranges);
  assert.equal(rows.length, 1);
  return rows[0];
}

test('range language V2: a damaged legacy checksum cannot be certified as retained bound history', async () => {
  const f = await boundRangeLanguageFixture(), { rangeIntentVersion, sceneRevision, sceneTextHash, quoteText, ...legacyIntent } = f.intent;
  const legacy = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: legacyIntent });
  assert.equal(legacy.ok, true);
  const row = soleRangeLanguageRecord(legacy.state, f.projectId); row.languageCode = 'en';
  const before = JSON.parse(JSON.stringify(legacy.state));
  const result = f.runtime.reduceCoreState(legacy.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { ...f.intent, tagId: row.id, expectedTagHash: f.runtime.hashCoreState(row) } });
  assert.equal(result.ok, false, 'a whole-record CAS does not repair the old raw checksum');
  assert.deepEqual(result.state, before); assert.deepEqual(legacy.state, before);
});

test('range language V2: bounded dossier pages expose every stored row and every retained decision without mutation', async () => {
  const f = await boundRangeLanguageFixture(); let state = f.state, selected;
  state.data.projects[f.projectId].manifestRevision = 'sha256:' + 'b'.repeat(64);
  for (let index = 0; index < 11; index++) {
    const result = f.runtime.reduceCoreState(state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: { ...f.intent, startOffset: index * 2, endOffset: index * 2 + 1, quoteText: f.text.slice(index * 2, index * 2 + 1) } });
    assert.equal(result.ok, true, JSON.stringify(result.error)); state = result.state;
  }
  for (let index = 0; index < 11; index++) {
    selected = Object.values(state.data.projects[f.projectId].atlas.languageTags.ranges)[0];
    const result = f.runtime.reduceCoreState(state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: { ...f.intent, startOffset: selected.history[0].source.startOffset, endOffset: selected.history[0].source.endOffset,
        quoteText: selected.history[0].source.quoteText, languageCode: index % 2 ? 'ru' : 'en',
        tagId: selected.id, expectedTagHash: f.runtime.hashCoreState(selected) } });
    assert.equal(result.ok, true); state = result.state;
  }
  const before = JSON.parse(JSON.stringify(state)), rows = state.data.projects[f.projectId].atlas.languageTags.ranges;
  const query = page => f.derived.deriveAtlasCurrentSceneDossier({ coreState: state,
    params: { projectId: f.projectId, sceneId: f.sceneAId, rangeLanguage: page },
    capabilitySnapshot: { platformId: 'node', capabilities: { atlasMentionIndex: true } } });
  const first = query({ offset: 0, historyTagId: selected.id, historyOffset: 0 });
  const next = query({ offset: 10, historyTagId: selected.id, historyOffset: 10 });
  assert.equal(first.ok, true); assert.equal(next.ok, true);
  const a = first.value.rangeLanguageTags, b = next.value.rangeLanguageTags;
  assert.equal(a.state, 'ready'); assert.equal(a.totalCount, 11); assert.equal(a.rows.length, 10); assert.equal(b.rows.length, 1);
  assert.deepEqual([...a.rows, ...b.rows].map(row => row.id), Object.keys(rows).sort());
  assert.equal(a.history.totalCount, 12); assert.equal(a.history.entries.length, 10); assert.equal(b.history.entries.length, 2);
  assert.deepEqual([...a.history.entries, ...b.history.entries].map(entry => entry.hash), rows[selected.id].history.map(entry => entry.hash));
  assert.deepEqual(state, before, 'read pagination neither truncates nor rewrites canonical history');
});

test('range language V2: explicit Set retains the original source and a versioned author decision', async () => {
  const f = await boundRangeLanguageFixture();
  const before = JSON.parse(JSON.stringify(f.state));
  const set = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(set.ok, true, JSON.stringify(set.error));
  const record = soleRangeLanguageRecord(set.state, f.projectId);
  assert.equal(record.schemaVersion, 'atlas.languageRangeTag.v2');
  assert.equal(record.history.length, 1);
  assert.equal(record.history[0].operation, 'set');
  assert.equal(record.history[0].languageCode, 'ru');
  assert.equal(record.history[0].source.quoteText, f.intent.quoteText);
  assert.equal(record.history[0].source.sceneRevision, f.intent.sceneRevision);
  assert.equal(record.history[0].source.sceneTextHash, f.intent.sceneTextHash);
  assert.equal(record.history[0].source.adapterOffsetDomain, 'UTF16_JS_CODE_UNIT');
  assert.deepEqual(f.state, before, 'the input state is immutable');
  assert.deepEqual(set.state.data.projects[f.projectId].scenes, before.data.projects[f.projectId].scenes);
  const routed = f.derived.deriveAtlasMixedLanguageRouter({ coreState: set.state,
    params: { projectId: f.projectId }, capabilitySnapshot: nodeCapabilitySnapshot() });
  assert.equal(routed.ok, true);
  assert.ok(routed.value.routes.some(row => row.sourceTagId === record.id && row.languageCode === 'ru'));
});

test('range language V2: a real prefix edit cannot move the old language onto different text', async () => {
  const f = await boundRangeLanguageFixture();
  const set = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(set.ok, true, JSON.stringify(set.error));
  const record = soleRangeLanguageRecord(set.state, f.projectId), frozenRecord = JSON.parse(JSON.stringify(record));
  const changed = f.runtime.reduceCoreState(set.state, { type: f.runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId: f.projectId, sceneId: f.sceneAId, text: 'Сдвиг. ' + f.text } });
  assert.equal(changed.ok, true);
  const routed = f.derived.deriveAtlasMixedLanguageRouter({ coreState: changed.state,
    params: { projectId: f.projectId }, capabilitySnapshot: nodeCapabilitySnapshot() });
  assert.equal(routed.ok, true);
  assert.equal(routed.value.routes.some(row => row.sourceTagId === record.id), false,
    'old absolute offsets never grant a current language claim after source change');
  assert.deepEqual(soleRangeLanguageRecord(changed.state, f.projectId), frozenRecord,
    'derived invalidation must not rewrite the author source or decisions');
});

test('range language V2: explicit retraction after truncation retains the original quote and prior decision', async () => {
  const f = await boundRangeLanguageFixture();
  const set = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(set.ok, true, JSON.stringify(set.error));
  const original = soleRangeLanguageRecord(set.state, f.projectId), originalCopy = JSON.parse(JSON.stringify(original));
  const changed = f.runtime.reduceCoreState(set.state, { type: f.runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId: f.projectId, sceneId: f.sceneAId, text: 'Коротко.' } });
  assert.equal(changed.ok, true);
  const currentScene = changed.state.data.projects[f.projectId].scenes[f.sceneAId];
  const cleared = f.runtime.reduceCoreState(changed.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_CLEAR,
    payload: { projectId: f.projectId, sceneId: f.sceneAId, scopeKind: 'range', rangeIntentVersion: 2,
      sceneRevision: currentScene.sceneRevision, sceneTextHash: f.runtime.hashCoreState(currentScene.text),
      tagId: original.id, expectedTagHash: f.runtime.hashCoreState(original) } });
  assert.equal(cleared.ok, true, JSON.stringify(cleared.error));
  const retained = soleRangeLanguageRecord(cleared.state, f.projectId);
  assert.equal(retained.schemaVersion, 'atlas.languageRangeTag.v2');
  assert.deepEqual(retained.history.slice(0, originalCopy.history.length), originalCopy.history);
  assert.equal(retained.history.at(-1).operation, 'clear');
  assert.equal(retained.history[0].source.quoteText, f.intent.quoteText);
  assert.equal(cleared.state.data.projects[f.projectId].scenes[f.sceneAId].text, 'Коротко.');
  const routed = f.derived.deriveAtlasMixedLanguageRouter({ coreState: cleared.state,
    params: { projectId: f.projectId }, capabilitySnapshot: nodeCapabilitySnapshot() });
  assert.equal(routed.ok, true);
  assert.equal(routed.value.routes.some(row => row.sourceTagId === retained.id), false);
});

test('range language V2: raw version and original-source mismatch refuse before any state mutation', async t => {
  const f = await boundRangeLanguageFixture(), beforeHash = f.runtime.hashCoreState(f.state);
  const variants = [
    ['string version', { rangeIntentVersion: '2' }],
    ['unknown version', { rangeIntentVersion: 3 }],
    ['null version', { rangeIntentVersion: null }],
    ['wrong original quote', { quoteText: 'Другой фрагмент' }],
    ['wrong text hash', { sceneTextHash: 'a'.repeat(64) }],
    ['wrong raw revision', { sceneRevision: 'sha256:' + 'b'.repeat(64) }],
    ['unknown path field', { path: '/foreign/never-authorized' }],
  ];
  for (const [label, delta] of variants) await t.test(label, () => {
    const rejected = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
      payload: { ...f.intent, ...delta } });
    assert.equal(rejected.ok, false, label);
    assert.equal(rejected.stateHash, beforeHash, label);
    assert.deepEqual(rejected.state, f.state, label);
  });
});

test('range language V2: an explicit legacy upgrade preserves the complete original record', async () => {
  const f = await boundRangeLanguageFixture(), { rangeIntentVersion, sceneRevision, sceneTextHash, quoteText, ...legacyIntent } = f.intent;
  const legacy = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: legacyIntent });
  assert.equal(legacy.ok, true);
  const old = soleRangeLanguageRecord(legacy.state, f.projectId), frozen = JSON.parse(JSON.stringify(old));
  const upgraded = f.runtime.reduceCoreState(legacy.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { ...f.intent, tagId: old.id, expectedTagHash: f.runtime.hashCoreState(old) } });
  assert.equal(upgraded.ok, true, JSON.stringify(upgraded.error));
  const record = soleRangeLanguageRecord(upgraded.state, f.projectId);
  assert.equal(record.schemaVersion, 'atlas.languageRangeTag.v2');
  assert.deepEqual(record.history[0].legacyRecord, frozen);
  assert.deepEqual(soleRangeLanguageRecord(legacy.state, f.projectId), frozen);
  assert.equal(upgraded.state.data.projects[f.projectId].scenes[f.sceneAId].text, f.text);
});

test('range language V2: replacement appends a decision and N-1 scene authoring preserves the opaque range', async () => {
  const f = await boundRangeLanguageFixture();
  const first = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(first.ok, true);
  const original = soleRangeLanguageRecord(first.state, f.projectId), snapshot = JSON.parse(JSON.stringify(original));
  const second = f.runtime.reduceCoreState(first.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { ...f.intent, tagId: original.id, expectedTagHash: f.runtime.hashCoreState(original), languageCode: 'EN-us' } });
  assert.equal(second.ok, true, JSON.stringify(second.error));
  const record = soleRangeLanguageRecord(second.state, f.projectId);
  assert.deepEqual(record.history.slice(0, snapshot.history.length), snapshot.history);
  assert.equal(record.history.at(-1).languageCode, 'en-US');
  const reopened = JSON.parse(JSON.stringify(second.state));
  const legacySceneSet = f.runtime.reduceCoreState(reopened, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { projectId: f.projectId, sceneId: f.sceneAId, scopeKind: 'scene', languageCode: 'ru' } });
  assert.equal(legacySceneSet.ok, true);
  assert.deepEqual(soleRangeLanguageRecord(legacySceneSet.state, f.projectId), record,
    'the original v1 scene path preserves every v2 field and decision');
});

test('range language V2: Unicode quote is verbatim and partial graphemes never mutate state', async t => {
  const f = await boundRangeLanguageFixture(), text = 'До 👩‍👩‍👧‍👦 e\u0301\r\nשלום после';
  const changed = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId: f.projectId, sceneId: f.sceneAId, text } });
  assert.equal(changed.ok, true);
  const sceneRevision = changed.state.data.projects[f.projectId].scenes[f.sceneAId].sceneRevision;
  const startOffset = text.indexOf('👩'), endOffset = text.indexOf('שלום');
  const payload = { ...f.intent, sceneRevision, sceneTextHash: f.runtime.hashCoreState(text), startOffset, endOffset,
    quoteText: text.slice(startOffset, endOffset) };
  const set = f.runtime.reduceCoreState(changed.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload });
  assert.equal(set.ok, true, JSON.stringify(set.error));
  assert.equal(soleRangeLanguageRecord(set.state, f.projectId).history[0].source.quoteText, payload.quoteText);
  assert.equal(set.state.data.projects[f.projectId].scenes[f.sceneAId].text, text);
  for (const [label, start, end] of [['emoji surrogate', startOffset + 1, endOffset],
    ['combining suffix', text.indexOf('e\u0301') + 1, endOffset], ['CRLF split', startOffset, text.indexOf('\n')]]) {
    await t.test(label, () => {
      const failed = f.runtime.reduceCoreState(changed.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
        payload: { ...payload, startOffset: start, endOffset: end, quoteText: text.slice(start, end) } });
      assert.equal(failed.ok, false, label);
      assert.equal(failed.stateHash, f.runtime.hashCoreState(changed.state));
    });
  }
});

test('range language V2: corrupt retained history is visible as degraded and is never healed by a write', async () => {
  const f = await boundRangeLanguageFixture();
  const set = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(set.ok, true);
  const damaged = JSON.parse(JSON.stringify(set.state)), record = soleRangeLanguageRecord(damaged, f.projectId);
  record.history[0].source.quoteText = 'X' + record.history[0].source.quoteText.slice(1);
  const before = JSON.parse(JSON.stringify(damaged));
  const routed = f.derived.deriveAtlasMixedLanguageRouter({ coreState: damaged,
    params: { projectId: f.projectId }, capabilitySnapshot: nodeCapabilitySnapshot() });
  assert.equal(routed.ok, true);
  assert.equal(routed.value.state, 'degraded');
  assert.equal(routed.value.routes.some(row => row.sourceTagId === record.id), false);
  assert.ok(routed.value.rangeLanguageBindings.some(row => row.tagId === record.id && row.state === 'invalid'));
  const refused = f.runtime.reduceCoreState(damaged, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { ...f.intent, tagId: record.id, expectedTagHash: f.runtime.hashCoreState(record) } });
  assert.equal(refused.ok, false);
  assert.deepEqual(refused.state, before);
  assert.deepEqual(damaged, before);
});

test('range language V2: explicit COPY changes current ownership and retains original decision owners and quotes', async () => {
  const f = await boundRangeLanguageFixture();
  const set = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(set.ok, true);
  const source = set.state.data.projects[f.projectId].atlas, original = soleRangeLanguageRecord(set.state, f.projectId);
  const before = JSON.parse(JSON.stringify(source)), targetId = 'copied-language-project';
  const copied = f.runtime.rebindAtlasContinuityFactsForProjectCopy(source, f.projectId, targetId);
  const record = copied.languageTags.ranges[original.id];
  assert.equal(record.projectId, targetId);
  assert.equal(record.originProjectId, f.projectId);
  assert.deepEqual(record.history, original.history);
  assert.deepEqual(source, before);
  const state = JSON.parse(JSON.stringify(set.state));
  state.data.projects[targetId] = { ...JSON.parse(JSON.stringify(state.data.projects[f.projectId])), id: targetId, atlas: copied };
  const routed = f.derived.deriveAtlasMixedLanguageRouter({ coreState: state,
    params: { projectId: targetId }, capabilitySnapshot: nodeCapabilitySnapshot() });
  assert.equal(routed.ok, true);
  assert.ok(routed.value.routes.some(row => row.sourceTagId === original.id));
});

test('range language V2: copied new marks remain retractable alongside preserved legacy range metadata', async () => {
  const f = await boundRangeLanguageFixture();
  const legacy = f.runtime.reduceCoreState(f.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET,
    payload: { projectId: f.projectId, sceneId: f.sceneAId, scopeKind: 'range', startOffset: 0, endOffset: 4, languageCode: 'en' } });
  assert.equal(legacy.ok, true);
  const old = Object.values(legacy.state.data.projects[f.projectId].atlas.languageTags.ranges)[0];
  const set = f.runtime.reduceCoreState(legacy.state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_SET, payload: f.intent });
  assert.equal(set.ok, true);
  const source = set.state.data.projects[f.projectId].atlas, sourceCopy = JSON.parse(JSON.stringify(source));
  const targetId = 'copied-mixed-language-project';
  const copied = f.runtime.rebindAtlasContinuityFactsForProjectCopy(source, f.projectId, targetId);
  const v2 = Object.values(copied.languageTags.ranges).find(row => row.schemaVersion === 'atlas.languageRangeTag.v2');
  const state = JSON.parse(JSON.stringify(set.state));
  state.data.projects[targetId] = { ...JSON.parse(JSON.stringify(state.data.projects[f.projectId])), id: targetId, atlas: copied };
  const cleared = f.runtime.reduceCoreState(state, { type: f.runtime.CORE_COMMAND_IDS.ATLAS_LANGUAGE_TAG_CLEAR,
    payload: { projectId: targetId, sceneId: f.sceneAId, scopeKind: 'range', rangeIntentVersion: 2,
      sceneRevision: f.intent.sceneRevision, sceneTextHash: f.intent.sceneTextHash,
      tagId: v2.id, expectedTagHash: f.runtime.hashCoreState(v2) } });
  assert.equal(cleared.ok, true, JSON.stringify(cleared.error));
  const copiedOld = copied.languageTags.ranges[old.id];
  const { projectId: oldOwner, sourceHash: oldHash, ...oldFields } = old;
  const { projectId: newOwner, sourceHash: newHash, ...newFields } = copiedOld;
  assert.equal(oldOwner, f.projectId); assert.equal(newOwner, targetId);
  assert.deepEqual(newFields, oldFields, 'COPY changes only the governed current owner/checksum of the legacy row');
  assert.deepEqual(source, sourceCopy);
});

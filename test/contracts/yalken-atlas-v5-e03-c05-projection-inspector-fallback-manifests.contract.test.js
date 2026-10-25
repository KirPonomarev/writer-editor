const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function buildProjectFixture({ withIdeaAndMeaning = false } = {}) {
  const runtime = await loadModule(path.join('src', 'core', 'runtime.mjs'));
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const projectId = 'projection-inspector-project';
  const sceneId = 'scene-a';
  const text = '# Opening\nMira chooses duty over crown.';
  const baseCommands = [
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE,
      payload: { projectId, title: 'Projection Inspector Fixture', sceneId },
    },
    {
      type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
      payload: { projectId, sceneId, text },
    },
  ];
  const base = runtime.applyCoreSequence(runtime.createInitialCoreState(), baseCommands);
  assert.equal(base.ok, true);
  if (!withIdeaAndMeaning) return { runtime, derived, projectId, sceneId, text, state: base.state };

  const dutyStart = text.indexOf('duty');
  const authored = runtime.applyCoreSequence(base.state, [
    {
      type: runtime.CORE_COMMAND_IDS.IDEA_CREATE,
      payload: { projectId, ideaId: 'idea-duty', title: 'Duty over crown' },
    },
    {
      type: runtime.CORE_COMMAND_IDS.IDEA_ORIGIN_LINK_ADD,
      payload: {
        projectId,
        ideaId: 'idea-duty',
        linkId: 'link-duty',
        originRef: {
          schemaVersion: derived.IDEA_ORIGIN_REF_SCHEMA_VERSION,
          kind: 'sceneTextRange',
          sceneId,
          startOffset: dutyStart,
          endOffset: dutyStart + 'duty'.length,
          sourceHash: derived.hashCanonicalValue(text),
          targetId: 'idea-duty',
        },
      },
    },
    {
      type: runtime.CORE_COMMAND_IDS.MEANING_PROMOTE,
      payload: {
        projectId,
        meaningId: 'meaning-duty',
        title: 'Duty is chosen',
        interpretation: 'The passage explicitly frames duty as a choice.',
        source: { kind: 'idea', ideaId: 'idea-duty' },
      },
    },
  ]);
  assert.equal(authored.ok, true);
  return { runtime, derived, projectId, sceneId, text, state: authored.state };
}

test('E03 C05: projection inspector manifests are bounded, read-only, and deterministic', async () => {
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const manifests = derived.createProjectionInspectorManifests();
  const again = derived.createProjectionInspectorManifests();

  assert.equal(manifests.length, 3);
  assert.deepEqual(manifests.map((item) => item.projectionId), ['idea', 'meaning', 'plot']);
  assert.deepEqual(manifests, again);
  assert.ok(manifests.every((item) => item.schemaVersion === derived.PROJECTION_INSPECTOR_MANIFEST_SCHEMA_VERSION));
  assert.ok(manifests.every((item) => item.readOnly === true));
  assert.ok(manifests.every((item) => item.commandAuthority === 'none'));
  assert.ok(manifests.every((item) => Array.isArray(item.allowedActions) && item.allowedActions.length === 0));
  assert.ok(manifests.every((item) => item.slots.some((slot) => slot.slotKind === 'fallbackState')));
  assert.ok(manifests.every((item) => item.fallback.empty.schemaVersion === derived.PROJECTION_INSPECTOR_FALLBACK_SCHEMA_VERSION));
  assert.ok(manifests.every((item) => item.fallback.unavailable.state === derived.PROJECTION_INSPECTOR_STATE.UNAVAILABLE));
  assert.ok(manifests.every((item) => item.authority.projectTruthMutation === false));
  assert.ok(manifests.every((item) => item.authority.storageMutation === false));
  assert.ok(manifests.every((item) => item.authority.networkMutation === false));
  assert.ok(manifests.every((item) => item.authority.rendererMutation === false));
});

test('E03 C05: inspector provider returns deterministic ready and empty fallback states', async () => {
  const { derived, projectId, state } = await buildProjectFixture({ withIdeaAndMeaning: false });
  const first = derived.deriveProjectionInspectorProvider({
    coreState: state,
    params: { projectId },
    capabilitySnapshot: { platformId: 'node', capabilities: { plotProjection: true, ideaProjection: true, meaningProjection: true } },
  });
  const second = derived.deriveProjectionInspectorProvider({
    coreState: JSON.parse(JSON.stringify(state)),
    params: { projectId },
    capabilitySnapshot: { platformId: 'node', capabilities: { plotProjection: true, ideaProjection: true, meaningProjection: true } },
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.schemaVersion, derived.PROJECTION_INSPECTOR_PROVIDER_SCHEMA_VERSION);
  assert.equal(first.value.meta.providerHash, second.value.meta.providerHash);
  assert.match(first.value.meta.providerHash, /^[0-9a-f]{64}$/u);
  assert.equal(first.value.authority.commandAuthority, 'none');
  assert.equal(first.value.authority.readOnlyProvider, true);
  assert.equal(first.value.authority.projectTruthMutation, false);
  assert.equal(first.value.authority.storageMutation, false);
  assert.equal(first.value.authority.networkMutation, false);
  assert.equal(first.value.summary.manifestCount, 3);
  assert.equal(first.value.summary.readyCount, 1);
  assert.equal(first.value.summary.emptyCount, 2);
  assert.equal(first.value.summary.unavailableCount, 0);

  const plot = first.value.projectionStates.find((item) => item.projectionId === 'plot');
  const idea = first.value.projectionStates.find((item) => item.projectionId === 'idea');
  const meaning = first.value.projectionStates.find((item) => item.projectionId === 'meaning');
  assert.equal(plot.state, derived.PROJECTION_INSPECTOR_STATE.READY);
  assert.equal(plot.fallbackCode, '');
  assert.equal(idea.state, derived.PROJECTION_INSPECTOR_STATE.EMPTY);
  assert.equal(idea.fallbackCode, 'IDEA_PROJECTION_EMPTY');
  assert.equal(meaning.state, derived.PROJECTION_INSPECTOR_STATE.EMPTY);
  assert.equal(meaning.fallbackCode, 'MEANING_PROJECTION_EMPTY');
  assert.ok(first.value.projectionStates.every((item) => /^[0-9a-f]{64}$/u.test(item.manifestHash)));
});

test('E03 C05: inspector provider reports ready authored projections without creating write authority', async () => {
  const { derived, projectId, state } = await buildProjectFixture({ withIdeaAndMeaning: true });
  const provider = derived.deriveProjectionInspectorProvider({
    coreState: state,
    params: { projectId },
    capabilitySnapshot: { platformId: 'node', capabilities: { plotProjection: true, ideaProjection: true, meaningProjection: true } },
  });

  assert.equal(provider.ok, true);
  assert.equal(provider.value.summary.readyCount, 3);
  assert.equal(provider.value.summary.emptyCount, 0);
  assert.equal(provider.value.summary.unavailableCount, 0);
  const idea = provider.value.projectionStates.find((item) => item.projectionId === 'idea');
  const meaning = provider.value.projectionStates.find((item) => item.projectionId === 'meaning');
  assert.equal(idea.itemCount, 1);
  assert.equal(meaning.itemCount, 1);
  assert.match(idea.projectionHash, /^[0-9a-f]{64}$/u);
  assert.match(meaning.projectionHash, /^[0-9a-f]{64}$/u);
  assert.ok(provider.value.manifests.every((manifest) => manifest.allowedActions.length === 0));
});

test('E03 C05: inspector provider fails closed at the provider boundary and maps source failures to unavailable fallback', async () => {
  const { runtime, derived, projectId, state } = await buildProjectFixture({ withIdeaAndMeaning: false });

  const missingProjectId = derived.deriveProjectionInspectorProvider({
    coreState: state,
    params: {},
    capabilitySnapshot: {},
  });
  assert.equal(missingProjectId.ok, false);
  assert.equal(missingProjectId.error.code, 'E_PROJECTION_INSPECTOR_PROJECT_ID_REQUIRED');

  const missingProject = derived.deriveProjectionInspectorProvider({
    coreState: runtime.createInitialCoreState(),
    params: { projectId: 'absent-project' },
    capabilitySnapshot: {},
  });
  assert.equal(missingProject.ok, true);
  assert.equal(missingProject.value.summary.unavailableCount, 3);
  assert.deepEqual(
    missingProject.value.projectionStates.map((item) => item.unavailableReason).sort(),
    ['E_IDEA_PROJECT_NOT_FOUND', 'E_MEANING_PROJECT_NOT_FOUND', 'E_PLOT_PROJECT_NOT_FOUND'],
  );

  const disabledPlot = derived.deriveProjectionInspectorProvider({
    coreState: state,
    params: { projectId },
    capabilitySnapshot: { capabilities: { plotProjection: false } },
  });
  assert.equal(disabledPlot.ok, true);
  const plot = disabledPlot.value.projectionStates.find((item) => item.projectionId === 'plot');
  assert.equal(plot.state, derived.PROJECTION_INSPECTOR_STATE.UNAVAILABLE);
  assert.equal(plot.fallbackCode, 'PLOT_PROJECTION_UNAVAILABLE');
  assert.equal(plot.unavailableReason, 'E_CAPABILITY_DISABLED_FOR_COMMAND');
});

test('E03 C05: inspector provider exports through the derived barrel and adds no storage, network, renderer, or UI bypass', async () => {
  const derived = await loadModule(path.join('src', 'derived', 'index.mjs'));
  const projections = await loadModule(path.join('src', 'derived', 'projections', 'index.mjs'));
  assert.equal(derived.deriveProjectionInspectorProvider, projections.deriveProjectionInspectorProvider);
  assert.equal(derived.createProjectionInspectorManifests, projections.createProjectionInspectorManifests);
  assert.equal(derived.PROJECTION_INSPECTOR_PROVIDER_SCHEMA_VERSION, projections.PROJECTION_INSPECTOR_PROVIDER_SCHEMA_VERSION);

  const sources = [
    path.join(process.cwd(), 'src', 'derived', 'projections', 'projectionInspectorManifests.mjs'),
    path.join(process.cwd(), 'src', 'derived', 'projections', 'projectionInspectorTypes.mjs'),
    path.join(process.cwd(), 'src', 'derived', 'projections', 'index.mjs'),
    path.join(process.cwd(), 'src', 'derived', 'index.mjs'),
  ];
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bwriteFile(?:Sync)?\s*\(/u,
    /\bappendFile(?:Sync)?\s*\(/u,
    /\blocalStorage\b/u,
    /\bsessionStorage\b/u,
    /\bindexedDB\b/u,
    /\baddEventListener\s*\(/u,
    /dispatchUiCommand/u,
  ];

  for (const sourcePath of sources) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${path.basename(sourcePath)} matched ${pattern.source}`);
    }
  }
});
async function authoredInspectorPageFixture() {
  const x = await buildProjectFixture({ withIdeaAndMeaning: true }), commands = [];
  for (let index = 0; index < 29; index++) {
    const id = 'page-idea-' + String(index).padStart(2, '0');
    commands.push({ type: 'idea.create', payload: { projectId: x.projectId, ideaId: id, title: 'Idea ' + index + ' é 🧭', summary: 'Saved summary ' + index } },
      { type: 'meaning.promote', payload: { projectId: x.projectId, meaningId: 'page-meaning-' + index, title: 'Meaning ' + index,
        interpretation: 'Explicit saved interpretation ' + index, source: { kind: 'idea', ideaId: id } } });
  }
  const originRef = x.state.data.projects[x.projectId].ideas.originLinks['link-duty'].originRef;
  for (let index = 0; index < 29; index++) commands.push({ type: 'idea.originLink.add', payload: {
    projectId: x.projectId, ideaId: 'idea-duty', linkId: 'extra-origin-' + index, originRef } });
  const next = x.runtime.applyCoreSequence(x.state, commands); assert.equal(next.ok, true, JSON.stringify(next.error)); x.state = next.state;
  x.query = (params = {}, capabilitySnapshot = { capabilities: { plotProjection: true, ideaProjection: true, meaningProjection: true } }) =>
    x.derived.deriveProjectionInspectorProvider({ coreState: x.state, params: { projectId: x.projectId, ...params }, capabilitySnapshot });
  return x;
}

test('E03 C05 authored details expose actual saved scalars origins and explicit promotions without inspector authority', async () => {
  const x = await buildProjectFixture({ withIdeaAndMeaning: true }), before = structuredClone(x.state);
  const r = x.derived.deriveProjectionInspectorProvider({ coreState: x.state, params: { projectId: x.projectId,
    idea: { offset: 0, search: '', selectedId: 'idea-duty' }, meaning: { offset: 0, search: '', selectedId: 'meaning-duty' } }, capabilitySnapshot: {} });
  assert.equal(r.ok, true, JSON.stringify(r));
  const idea = r.value.projectionStates.find(row => row.projectionId === 'idea'), meaning = r.value.projectionStates.find(row => row.projectionId === 'meaning');
  assert.ok(idea.details, 'declared Idea detail slots must publish actual saved records'); assert.ok(meaning.details);
  const row = idea.details.rows.find(row => row.id === 'idea-duty'); assert.ok(row); assert.equal(row.title, 'Duty over crown');
  assert.equal(row.originLinkCount, 1); assert.equal(Object.hasOwn(row, 'originLinkIds'), false, 'no unbounded nested ID list');
  assert.deepEqual(idea.details.selected, row); assert.equal(idea.details.selectedState, 'ready');
  assert.equal(idea.details.total, 1); assert.equal(idea.details.complete, true); assert.equal(idea.details.hasMore, false);
  assert.deepEqual(idea.details.originLinks[0].originRef, x.state.data.projects[x.projectId].ideas.originLinks['link-duty'].originRef);
  assert.equal(idea.details.originLinks[0].ideaId, 'idea-duty'); assert.equal(idea.details.occurrenceEvidence[0].ideaId, 'idea-duty');
  assert.equal(meaning.details.rows[0].interpretation, 'The passage explicitly frames duty as a choice.');
  assert.deepEqual(meaning.details.selected.source, { kind: 'idea', ideaId: 'idea-duty' });
  assert.equal(meaning.details.promotionEvidence[0].meaningId, 'meaning-duty'); assert.equal(meaning.details.selectedState, 'ready');
  assert.equal(r.value.authority.commandAuthority, 'none'); assert.equal(r.value.authority.readOnlyProvider, true);
  for (const manifest of r.value.manifests) { assert.equal(manifest.readOnly, true); assert.equal(manifest.commandAuthority, 'none'); assert.deepEqual(manifest.allowedActions, []); }
  assert.deepEqual(x.state, before, 'projection cannot mutate author truth or manuscript');
});

test('E03 C05 pages search and selected retrieval remain deterministic bounded and source-hash bound beyond twenty-four', async () => {
  const x = await authoredInspectorPageFixture(), before = structuredClone(x.state), first = x.query(); assert.equal(first.ok, true);
  const state = (r, id) => r.value.projectionStates.find(row => row.projectionId === id), idea = state(first, 'idea');
  assert.ok(idea.details, 'bounded saved details are required'); assert.equal(idea.details.rows.length, 24);
  assert.equal(idea.details.total, 30); assert.equal(idea.details.offset, 0); assert.equal(idea.details.hasMore, true); assert.equal(idea.details.complete, false);
  const ordered = Object.values(x.state.data.projects[x.projectId].ideas.ideas).sort((a, b) => b.createdByCommandSeq - a.createdByCommandSeq || a.id.localeCompare(b.id));
  assert.deepEqual(idea.details.rows.map(row => row.id), ordered.slice(0, 24).map(row => row.id));
  const next = x.query({ idea: { offset: 24, search: '', selectedId: 'idea-duty' }, meaning: { offset: 24, search: '', selectedId: 'meaning-duty' } });
  assert.equal(next.ok, true); const page = state(next, 'idea').details;
  assert.deepEqual(page.rows.map(row => row.id), ordered.slice(24).map(row => row.id)); assert.equal(page.hasMore, false);
  assert.equal(page.selected.id, 'idea-duty'); assert.equal(page.selectedState, 'ready');
  const outside = x.query({ idea: { offset: 0, search: '', selectedId: 'idea-duty' }, meaning: { offset: 0, search: '', selectedId: 'meaning-duty' } });
  assert.equal(outside.ok, true); assert.equal(state(outside, 'idea').details.rows.some(row => row.id === 'idea-duty'), false);
  assert.equal(state(outside, 'idea').details.selected.id, 'idea-duty'); assert.equal(state(outside, 'meaning').details.selected.id, 'meaning-duty');
  const bounded = state(outside, 'idea').details;
  assert.equal(bounded.originLinks.length, 24); assert.equal(bounded.originLinkCount, 30); assert.equal(bounded.originLinksComplete, false);
  assert.equal(bounded.occurrenceEvidence.length, 24); assert.equal(bounded.occurrenceEvidenceCount, 30); assert.equal(bounded.occurrenceEvidenceComplete, false);
  const search = x.query({ idea: { offset: 0, search: 'Saved summary 28', selectedId: 'idea-duty' } }); assert.equal(search.ok, true);
  assert.deepEqual(state(search, 'idea').details.rows.map(row => row.id), ['page-idea-28']);
  assert.equal(state(search, 'idea').details.total, 1); assert.equal(state(search, 'idea').details.complete, true);
  for (const r of [next, outside, search]) {
    assert.equal(state(r, 'idea').projectionHash, idea.projectionHash, 'canonical full projection hash never becomes a page hash');
    assert.notEqual(r.value.meta.providerHash, first.value.meta.providerHash, 'actual view parameters and selected packet invalidate provider');
  }
  assert.deepEqual(x.query({ idea: { offset: 0, search: '', selectedId: 'idea-duty' }, meaning: { offset: 0, search: '', selectedId: 'meaning-duty' } }), outside);
  assert.deepEqual(x.state, before);
});

test('E03 C05 missing foreign unavailable and malformed page requests cannot invent a selected author record', async t => {
  const x = await authoredInspectorPageFixture();
  for (const id of ['not-saved', 'foreign-project:idea-duty']) await t.test('missing selection ' + id, () => {
    const r = x.query({ idea: { selectedId: id }, meaning: { selectedId: id } }); assert.equal(r.ok, true);
    for (const key of ['idea', 'meaning']) { const detail = r.value.projectionStates.find(row => row.projectionId === key).details;
      assert.ok(detail); assert.equal(detail.selected, null); assert.equal(detail.selectedState, 'missing'); }
  });
  const disabled = x.query({ idea: { selectedId: 'idea-duty' } }, { capabilities: { ideaProjection: false } }); assert.equal(disabled.ok, true);
  const unavailable = disabled.value.projectionStates.find(row => row.projectionId === 'idea'); assert.equal(unavailable.state, 'unavailable');
  assert.ok(unavailable.details); assert.deepEqual(unavailable.details.rows, []); assert.equal(unavailable.details.selected, null);
  assert.equal(unavailable.details.selectedState, 'unavailable');
  for (const value of [{ offset: -1 }, { offset: 0.5 }, { offset: '24' }, { search: [] }, { search: 'x'.repeat(100000) }, { selectedId: 17 }]) await t.test('raw option ' + JSON.stringify(value).slice(0, 70), () => {
    const before = JSON.stringify(x.state), r = x.query({ idea: value }); assert.equal(r.ok, false);
    assert.match(r.error.code, /^E_PROJECTION_INSPECTOR_/u); assert.equal(JSON.stringify(x.state), before);
  });
});


test('E03 C05 oversized legal old author records retain full truth and canonical hashes with explicitly clipped scalar previews', async () => {
  const x = await buildProjectFixture({ withIdeaAndMeaning: true }), original = JSON.stringify(x.state);
  const title = 'Длинная идея é 🧭 '.repeat(100).trim(), summary = 'Сохранённая авторская мысль é 🧭 '.repeat(400).trim();
  const interpretation = 'Полное явное толкование é 🧭 '.repeat(400).trim();
  assert.ok(title.length > 1000 && summary.length > 8000 && interpretation.length > 8000);
  const result = x.runtime.applyCoreSequence(x.state, [
    { type: 'idea.create', payload: { projectId: x.projectId, ideaId: 'old-long-idea', title, summary } },
    { type: 'meaning.promote', payload: { projectId: x.projectId, meaningId: 'old-long-meaning', title,
      interpretation, source: { kind: 'idea', ideaId: 'old-long-idea' } } },
  ]);
  assert.equal(result.ok, true, JSON.stringify(result.error)); assert.equal(JSON.stringify(x.state), original, 'legal old commands preserve prior input state');
  const coreState = result.state, before = JSON.stringify(coreState), sourceHash = x.derived.hashCanonicalValue(coreState);
  const provider = x.derived.deriveProjectionInspectorProvider({ coreState, params: { projectId: x.projectId,
    idea: { selectedId: 'old-long-idea' }, meaning: { selectedId: 'old-long-meaning' } }, capabilitySnapshot: {} });
  assert.equal(provider.ok, true, JSON.stringify(provider));
  for (const [projectionId, id, fullProse, field, derive] of [
    ['idea', 'old-long-idea', summary, 'summary', x.derived.deriveIdeaProjection],
    ['meaning', 'old-long-meaning', interpretation, 'interpretation', x.derived.deriveMeaningProjection],
  ]) {
    const state = provider.value.projectionStates.find(row => row.projectionId === projectionId); assert.ok(state.details);
    const row = state.details.rows.find(row => row.id === id); assert.ok(row);
    assert.equal(row.title, title.slice(0, 1000)); assert.ok(row.title.length <= 1000, 'UTF16 title limit');
    assert.equal(row[field], fullProse.slice(0, 8000)); assert.ok(row[field].length <= 8000, 'UTF16 prose limit');
    assert.equal(row.contentTruncated, true); assert.deepEqual(state.details.selected, row);
    const short = state.details.rows.find(row => row.id !== id); assert.ok(short); assert.notEqual(short.contentTruncated, true, 'short author content is not marked truncated');
    const canonical = derive({ coreState, params: { projectId: x.projectId }, capabilitySnapshot: {} }); assert.equal(canonical.ok, true);
    assert.equal(state.projectionHash, canonical.value.meta.projectionHash, 'preview clipping cannot replace the full canonical source hash');
  }
  assert.equal(coreState.data.projects[x.projectId].ideas.ideas['old-long-idea'].summary, summary);
  assert.equal(coreState.data.projects[x.projectId].meanings.meanings['old-long-meaning'].interpretation, interpretation);
  assert.equal(JSON.stringify(coreState), before); assert.equal(x.derived.hashCanonicalValue(coreState), sourceHash);
});

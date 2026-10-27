const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const REPORT_PATH = path.join(
  REPO_ROOT,
  'docs/OPS/EVIDENCE/YALKEN_ATLAS_V5_R3_C02_TEMPORAL_CONTINUITY_SAVED_QUERY_JOURNEYS/r3-c02-temporal-continuity-saved-query-journeys-report.json',
);

async function importJourneyModule() {
  return import(pathToFileURL(path.join(
    REPO_ROOT,
    'scripts/ops/yalken-atlas-v5-r3-c02-temporal-continuity-saved-query-journeys.mjs',
  )).href);
}

function readReport() {
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
}

test('R3 C02: renderer exposes visible temporal, continuity and saved-query command controls', () => {
  const editorSource = fs.readFileSync(path.join(REPO_ROOT, 'src', 'renderer', 'editor.js'), 'utf8');

  for (const commandId of [
    'atlas.calendar.define',
    'atlas.sceneTemporalAnchor.set',
    'atlas.continuityFact.record',
    'atlas.savedQuery.save',
  ]) {
    assert.match(editorSource, new RegExp(`makeAtlasSurfaceCommandButton\\([\\s\\S]{0,260}'${commandId}'`, 'u'), commandId);
  }

  for (const marker of [
    'atlasTemporalAction',
    'define-calendar',
    'set-scene-time',
    'atlasContinuityAction',
    'record-fact',
    'atlasReportsAction',
    'save-query',
  ]) {
    assert.match(editorSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'), marker);
  }

  assert.doesNotMatch(editorSource, /function announceAtlasContinuityCorrectionRoute/u);
  assert.doesNotMatch(editorSource, /Atlas correction route: \$\{commandId\}/u);
});

test('R3 C02: Atlas product core builder no longer silently slices source scenes', () => {
  const mainSource = fs.readFileSync(path.join(REPO_ROOT, 'src', 'main.js'), 'utf8');
  const builderMatch = /async function buildProductCoreStateForCurrentProject\(\) \{([\s\S]*?)\n\}/u.exec(mainSource);
  assert.ok(builderMatch, 'buildProductCoreStateForCurrentProject is present');
  assert.doesNotMatch(builderMatch[1], /collectAtlasOverviewSceneNodes\(roots\)\.slice\(0,\s*500\)/u);
  assert.match(builderMatch[1], /for \(const node of collectAtlasOverviewSceneNodes\(roots\)\)/u);
});

test('R3 C02: physical report proves command persistence, reopen and negative cases', () => {
  const report = readReport();
  assert.equal(report.pass, true);
  assert.equal(report.status, 'PASS_ATLAS_TEMPORAL_CONTINUITY_SAVED_QUERY_UI_JOURNEY');
  assert.equal(report.runtime.continuation.runtimeKind, 'production-electron-visible-input-black-box');
  assert.equal(report.runtime.reopen.runtimeKind, 'production-electron-visible-input-black-box');
  assert.equal(report.runtime.continuation.ok, true);
  assert.equal(report.runtime.reopen.ok, true);
  for (const [key, value] of Object.entries(report.accepted)) {
    assert.equal(value, true, `accepted.${key}`);
  }
  assert.equal(report.negativeAssertions.statusOnlyCorrectionAccepted, false);
  assert.equal(report.negativeAssertions.silentSceneSliceAccepted, false);
  assert.equal(report.negativeAssertions.directIpcAcceptedJourney, false);
});

test('R3 C02: evaluator rejects status-only continuity and silent scene slicing', async () => {
  const module = await importJourneyModule();
  const report = readReport();
  const rejected = module.evaluateTemporalContinuitySavedQueryJourneys({
    ...report.evaluationInput,
    rendererSourceHasStatusOnlyContinuity: true,
    productCoreHasSilentSceneSlice: true,
  });
  assert.equal(rejected.pass, false);
  assert.equal(rejected.accepted.noStatusOnlyContinuityRoute, false);
  assert.equal(rejected.accepted.noSilentSceneSlice, false);
});

// Actual source/Core/finite presentation ports: no native DOM, computed CSS or accessibility claim.
function continuityAuthorActualFunction(source, name) {
  const start = source.indexOf('function ' + name + '('), end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, 'actual function: ' + name);
  return source.slice(source.slice(start - 6, start) === 'async ' ? start - 6 : start, end + 2);
}

async function continuityAuthorFixture() {
  const vm = require('node:vm'), source = fs.readFileSync(path.join(REPO_ROOT, 'src/renderer/editor.js'), 'utf8');
  const runtime = await import(pathToFileURL(path.join(REPO_ROOT, 'src/core/runtime.mjs')).href);
  const projectId = 'author-input-project', sceneId = 'author-input-scene', entityId = 'author-mira', text = 'Мира e\u0301 🧭 обещает вернуться.';
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), [
    { type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId, sceneId, title: 'Author input' } },
    { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId, text } },
    { type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE, payload: { projectId, entityId, name: 'Мира', entityKind: 'character' } },
  ]);
  assert.equal(built.ok, true, JSON.stringify(built.error));
  const evidenceAnchor = { schemaVersion: 'atlas.evidenceAnchor.v1', anchorId: 'author-anchor', projectId, sceneId, entityId,
    startOffset: 0, endOffset: 4, quote: 'Мира', quoteHash: runtime.hashCoreState('Мира'), sceneTextHash: runtime.hashCoreState(text) };
  const projection = { sceneId, mentions: [{ mentionId: 'author-mention', entityId, evidenceAnchor }] };
  const context = { window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12' },
    currentProjectId: projectId, currentDocumentId: sceneId, atlasCurrentSceneState: structuredClone(projection) };
  vm.createContext(context);
  const start = source.indexOf('let atlasContinuityAuthorDraft = {'), end = source.indexOf('\n};', start);
  assert.ok(start > 0 && end > start);
  const names = ['getAtlasJourneyMentions', 'findAtlasJourneyMention', 'getAtlasContinuityFactPayload', 'setAtlasContinuityDraftField'];
  vm.runInContext(source.slice(start, end + 3) + '\n' + names.map(name => continuityAuthorActualFunction(source, name)).join('\n'), context);
  const plain = value => JSON.parse(JSON.stringify(value));
  const initial = plain(vm.runInContext('atlasContinuityAuthorDraft', context));
  for (const [field, value] of [['entityId', entityId], ['mentionId', 'author-mention']]) context.setAtlasContinuityDraftField(field, value);
  const fixture = { runtime, source, vm, context, projectId, sceneId, entityId, initial, state: built.state,
    intent(label, value, note = '') { for (const [key, next] of [['factLabel', label], ['factValue', value], ['note', note]]) context.setAtlasContinuityDraftField(key, next); },
    payload() { return { ...plain(context.getAtlasContinuityFactPayload()), projectId }; },
    apply(payload) { return runtime.reduceCoreState(fixture.state, { type: runtime.CORE_COMMAND_IDS.ATLAS_CONTINUITY_FACT_RECORD, payload }); },
  };
  return fixture;
}

function continuityAuthorFacts(f, state = f.state) { return state.data.projects[f.projectId].atlas.continuityFactLedgers.promise; }

const CONTINUITY_AUTHOR_REQUIRED_CASES = [
  { name: 'empty label', label: '', value: 'Вернуться e\u0301 🧭', code: 'E_ATLAS_CONTINUITY_FACT_LABEL_REQUIRED' },
  { name: 'empty value', label: 'Обещание e\u0301 🧭', value: '', code: 'E_ATLAS_CONTINUITY_FACT_VALUE_REQUIRED' },
  { name: 'both empty', label: '', value: '', code: 'E_ATLAS_CONTINUITY_FACT_LABEL_REQUIRED' },
  { name: 'whitespace label', label: ' \t\n', value: 'Вернуться', code: 'E_ATLAS_CONTINUITY_FACT_LABEL_REQUIRED' },
  { name: 'whitespace value', label: 'Обещание', value: ' \t\n', code: 'E_ATLAS_CONTINUITY_FACT_VALUE_REQUIRED' },
];

test('continuity actual initializer leaves all three author text fields empty [ACTUAL_SOURCE_CORE_FINITE_VM]', async () => {
  const f = await continuityAuthorFixture();
  assert.deepEqual([f.initial.factLabel, f.initial.factValue, f.initial.note], ['', '', '']);
});

for (const row of CONTINUITY_AUTHOR_REQUIRED_CASES) {
  test('continuity direct Core control refuses ' + row.name + ' without state mutation', async t => {
    const f = await continuityAuthorFixture(); f.intent('Контроль', 'Значение');
    const payload = { ...f.payload(), factLabel: row.label, factValue: row.value, note: '' }, before = structuredClone(f.state);
    const result = f.apply(payload); t.diagnostic(JSON.stringify({ reach: 'ACTUAL_DIRECT_CORE', case: row.name, payload, ok: result.ok, error: result.error }));
    assert.equal(result.ok, false); assert.equal(result.error.code, row.code); assert.deepEqual(result.state, before); assert.deepEqual(f.state, before);
  });
  test('continuity actual getter cannot supply demo truth for ' + row.name, async t => {
    const f = await continuityAuthorFixture(); f.intent(row.label, row.value);
    const before = structuredClone(f.state), payload = f.payload(), result = f.apply(payload);
    t.diagnostic(JSON.stringify({ reach: 'ACTUAL_GETTER_TO_ACTUAL_CORE', case: row.name, payload, ok: result.ok, error: result.error,
      storedFacts: continuityAuthorFacts(f, result.state) }));
    assert.deepEqual(f.state, before, 'the actual reducer must not mutate its input');
    assert.equal(result.ok, false, 'empty required author intent must reach the existing Core refusal');
    assert.equal(result.error.code, row.code); assert.deepEqual(result.state, before);
    assert.equal(payload.factLabel, row.label); assert.equal(payload.factValue, row.value);
  });
}

test('continuity actual getter and Core preserve Unicode and an empty optional note', async t => {
  const f = await continuityAuthorFixture(), label = 'Обещание e\u0301 🧭', value = 'Вернуться к маяку — 東京'; f.intent(label, value, '');
  const payload = f.payload(), before = structuredClone(f.state), result = f.apply(payload);
  assert.deepEqual(f.state, before); assert.deepEqual(f.payload(), payload); assert.equal(result.ok, true, JSON.stringify(result.error));
  const records = Object.values(continuityAuthorFacts(f, result.state)); assert.equal(records.length, 1);
  const record = records[0]; t.diagnostic(JSON.stringify({ reach: 'ACTUAL_UNICODE_CORE_READBACK', payload, record }));
  assert.equal(record.factLabel, label); assert.equal(record.factValue, value); assert.equal(record.sceneId, f.sceneId);
  assert.equal(record.subjectEntityId, f.entityId); assert.deepEqual(record.evidenceAnchor, payload.evidenceAnchor);
  assert.equal(payload.note, '', 'optional blank is author intent'); assert.equal(record.note, '');
});

test('continuity nonempty optional note remains exact through actual getter and Core', async () => {
  const f = await continuityAuthorFixture(); f.intent('Маяк e\u0301', 'Вернуться 🧭', 'Авторская заметка 東京');
  const payload = f.payload(), result = f.apply(payload); assert.equal(result.ok, true, JSON.stringify(result.error));
  const record = Object.values(continuityAuthorFacts(f, result.state))[0];
  assert.equal(payload.note, 'Авторская заметка 東京'); assert.equal(record.note, payload.note);
});

async function continuityAuthorStatusFixture({ deferred = false } = {}) {
  const f = await continuityAuthorFixture(), bus = await import(pathToFileURL(path.join(REPO_ROOT, 'src/renderer/commands/commandBusGuard.mjs')).href);
  const calls = [], refreshes = [], pending = [], errors = [], c = f.context;
  Object.assign(c, { statusElement: { textContent: 'initial', style: { visibility: 'hidden' } }, initialDocumentFailureStatus: null,
    heldCommandStatusMessage: false, atlasCommandPublicationSequence: 0, atlasPublicationEpoch: 1,
    currentTreeContentPublicationId: 'publication-1', localEditGeneration: 3, manualMapDraftOwnership: 'owner-1',
    atlasJourneyDraftRevision: 2, manualMapDraftRevision: 4, isTiptapMode: true,
    runCommandThroughBus: bus.runCommandThroughBus, COMMAND_BUS_ROUTE: bus.COMMAND_BUS_ROUTE,
    console: { error: (...args) => errors.push(args), warn: (...args) => errors.push(args) },
    uiErrorMapDoc: JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs/OPS/STATUS/UI_ERROR_MAP.json'), 'utf8')),
    runCommand(id, payload) {
      calls.push({ id, payload: structuredClone(payload) });
      const apply = () => { const result = f.apply(payload); if (result.ok) f.state = result.state; return result; };
      return deferred ? new Promise(resolve => pending.push(() => resolve(apply()))) : Promise.resolve(apply());
    },
    async refreshAtlasCurrentScene(options) { refreshes.push({ kind: 'scene', current: options.isCurrent() }); },
    async refreshAtlasProductSurfaces(options) { refreshes.push({ kind: 'surfaces', current: options.isCurrent() }); },
  });
  const constants = ['UI_ERROR_MAP_SCHEMA_VERSION', 'UI_ERROR_FALLBACK_MESSAGE', 'UI_ERROR_FALLBACK_SEVERITY'].map(name => {
    const match = new RegExp('^const ' + name + ' = .*;$', 'm').exec(f.source); assert.ok(match, name); return match[0];
  });
  const names = ['sanitizeUiErrorMap', 'mapCommandErrorToUi', 'withEditorModeCommandPayload', 'dispatchUiCommand',
    'updateStatusText', 'captureAtlasPublication', 'runAtlasSurfaceProductCommand'];
  f.vm.runInContext(constants.join('\n') + '\n' + names.map(name => continuityAuthorActualFunction(f.source, name)).join('\n')
    + '\nconst uiErrorMap = sanitizeUiErrorMap(uiErrorMapDoc);', c);
  return { f, c, calls, refreshes, pending, errors,
    run(label, value) { f.intent(label, value); return c.runAtlasSurfaceProductCommand('atlas.continuityFact.record', f.payload(), { statusLabel: 'Atlas continuity fact' }); } };
}

test('actual dispatch maps a required-field refusal visibly and wrapper retains its explanation [FINITE_PORTS_NOT_NATIVE]', async t => {
  const h = await continuityAuthorStatusFixture(), result = await h.run(' \t', 'Вернуться');
  assert.equal(result.ok, false); assert.equal(result.error.code, 'E_ATLAS_CONTINUITY_FACT_LABEL_REQUIRED');
  const expected = h.c.mapCommandErrorToUi(result.error).userMessage; assert.notEqual(expected, result.error.reason);
  assert.equal(h.c.statusElement.textContent, expected); assert.equal(h.c.statusElement.style.visibility, 'visible');
  assert.equal(h.c.heldCommandStatusMessage, true); assert.equal(Object.keys(continuityAuthorFacts(h.f)).length, 0);
  const before = structuredClone(h.f.state); h.c.updateStatusText('quiet query count');
  assert.equal(h.c.statusElement.textContent, expected); assert.deepEqual(h.f.state, before); assert.equal(h.calls.length, 1);
  assert.deepEqual(h.refreshes, [{ kind: 'scene', current: true }, { kind: 'surfaces', current: true }]);
  t.diagnostic(JSON.stringify({ reach: 'ACTUAL_DISPATCH_MAPPED_REFUSAL', expected, errors: h.errors, calls: h.calls }));
});

for (const quiet of [false, true]) test('actual current success after mapped refusal ' + (quiet ? 'survives quiet reads' : 'is held visibly') + ' [FINITE_PORTS_NOT_NATIVE]', async t => {
  const h = await continuityAuthorStatusFixture(); assert.equal((await h.run(' \t', 'Вернуться')).ok, false);
  const label = 'Авторский факт e\u0301 🧭', value = 'Вернуться к маяку 東京', result = await h.run(label, value);
  assert.equal(result.ok, true, JSON.stringify(result.error)); assert.equal(h.calls.length, 2);
  const records = Object.values(continuityAuthorFacts(h.f)); assert.equal(records.length, 1);
  assert.equal(records[0].factLabel, label); assert.equal(records[0].factValue, value);
  const before = structuredClone(h.f.state), expected = 'Atlas continuity fact persisted';
  if (quiet) h.c.updateStatusText('quiet projection count');
  t.diagnostic(JSON.stringify({ reach: 'ACTUAL_CURRENT_SUCCESS_STATUS', quiet, status: h.c.statusElement, held: h.c.heldCommandStatusMessage, record: records[0] }));
  assert.deepEqual(h.f.state, before); assert.equal(h.calls.length, 2);
  assert.equal(h.c.statusElement.textContent, expected); assert.equal(h.c.statusElement.style.visibility, 'visible');
  assert.equal(h.c.heldCommandStatusMessage, true);
});

for (const key of ['currentProjectId', 'currentDocumentId', 'atlasPublicationEpoch', 'currentTreeContentPublicationId',
  'localEditGeneration', 'manualMapDraftOwnership', 'atlasJourneyDraftRevision', 'manualMapDraftRevision']) {
  test('actual publication guard suppresses stale command completion after ' + key + ' changes [FINITE_PORTS_NOT_NATIVE]', async () => {
    const h = await continuityAuthorStatusFixture({ deferred: true }), task = h.run('Авторский факт', 'Вернуться');
    assert.equal(h.pending.length, 1); h.c[key] = typeof h.c[key] === 'number' ? h.c[key] + 1 : h.c[key] + '-next';
    h.c.updateStatusText('New context owns status', { visible: true }); const status = structuredClone(h.c.statusElement);
    h.pending[0](); const result = await task; assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.deepEqual(h.c.statusElement, status); assert.deepEqual(h.refreshes, []); assert.equal(h.calls.length, 1);
  });
}

test('actual newer command sequence owns presentation over an older refusal [FINITE_PORTS_NOT_NATIVE]', async () => {
  const h = await continuityAuthorStatusFixture({ deferred: true });
  const older = h.run(' \t', 'Старое'), newer = h.run('Новый авторский факт', 'Вернуться'); assert.equal(h.pending.length, 2);
  h.pending[1](); assert.equal((await newer).ok, true); const status = structuredClone(h.c.statusElement), refreshes = structuredClone(h.refreshes);
  h.pending[0](); assert.equal((await older).ok, false);
  assert.deepEqual(h.c.statusElement, status); assert.deepEqual(h.refreshes, refreshes); assert.equal(h.errors.length, 0); assert.equal(h.calls.length, 2);
});

for (const [buttonLabel, commandId, statusLabel] of [
  ['Define calendar', 'atlas.calendar.define', 'Atlas calendar'],
  ['Set scene time', 'atlas.sceneTemporalAnchor.set', 'Atlas temporal anchor'],
  ['Record fact', 'atlas.continuityFact.record', 'Atlas continuity fact'],
  ['Save query', 'atlas.savedQuery.save', 'Atlas saved query'],
]) test('actual Atlas wrapper holds current ' + buttonLabel + ' success [TYPED_RESULT_PORT_NOT_PRODUCT_PERSISTENCE]', async () => {
  const h = await continuityAuthorStatusFixture(), before = structuredClone(h.f.state), calls = [], payload = { authorText: 'Автор e\u0301 🧭' };
  const callStart = h.f.source.indexOf("makeAtlasSurfaceCommandButton('" + buttonLabel + "', '" + commandId + "'");
  assert.ok(callStart > 0); assert.ok(h.f.source.slice(callStart, h.f.source.indexOf('}));', callStart)).includes("statusLabel: '" + statusLabel + "'"));
  h.c.runCommand = async (id, received) => { calls.push({ id, payload: structuredClone(received) }); return { ok: true, value: { typedResultPort: true } }; };
  const result = await h.c.runAtlasSurfaceProductCommand(commandId, payload, { statusLabel });
  assert.equal(result.ok, true); assert.deepEqual(calls, [{ id: commandId, payload: { ...payload, projectId: h.f.projectId, editorMode: 'tiptap' } }]);
  assert.deepEqual(h.f.state, before); assert.deepEqual(h.refreshes, [{ kind: 'scene', current: true }, { kind: 'surfaces', current: true }]);
  assert.equal(h.c.statusElement.textContent, statusLabel + ' persisted'); assert.equal(h.c.statusElement.style.visibility, 'visible');
  assert.equal(h.c.heldCommandStatusMessage, true);
});

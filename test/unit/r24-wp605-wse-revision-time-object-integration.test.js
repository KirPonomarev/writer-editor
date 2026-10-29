const assert = require('node:assert/strict');
const test = require('node:test');

test('WP605 existing Continuity query publishes honest unknown views without a new runtime store', async () => {
  const { createInitialCoreState } = await import('../../src/core/runtime.mjs');
  const { deriveAtlasContinuityLedgerSurface } = await import('../../src/derived/atlas/deriveAtlasContinuityLedgerSurface.mjs');
  const { normalizeWseRevisionTimeObjectPresentation } = await import('../../src/renderer/atlasWseRevisionTimeObjectPresentationModel.mjs');
  const state = createInitialCoreState();
  state.data.projects.project = { projectId: 'project', scenes: {}, sceneOrder: [], atlas: { entities: {}, continuityFactLedgers: {} } };
  const result = deriveAtlasContinuityLedgerSurface({ coreState: state, params: { projectId: 'project', rowLimit: 16 }, capabilitySnapshot: {} });
  assert.equal(result.ok, true);
  const projection = result.value.wseRevisionTimeObject;
  assert.equal(projection.views.semanticDiff.reason, 'UNKNOWN_NO_BASELINE');
  assert.equal(projection.views.storyClock.reason, 'UNKNOWN_TIME_SOURCE');
  assert.equal(projection.authority.persistence, false);
  for (const viewId of projection.viewOrder) {
    const presentation = normalizeWseRevisionTimeObjectPresentation(projection, viewId);
    assert.equal(presentation.tabs.length, 4);
    assert.equal(presentation.viewId, viewId);
    assert.equal(presentation.readOnly, true);
  }
});

test('WP605 presentation rejects an unknown selected tab and keeps visible denominator honest', async () => {
  const { normalizeWseRevisionTimeObjectPresentation } = await import('../../src/renderer/atlasWseRevisionTimeObjectPresentationModel.mjs');
  const value = normalizeWseRevisionTimeObjectPresentation({ views: { semanticDiff: { rows: [{ id: 'one' }], visibleCount: 99, totalCount: 4, omittedCount: 3 } } }, 'writeProject');
  assert.equal(value.viewId, 'semanticDiff');
  assert.equal(value.view.visibleCount, 1);
  assert.equal(value.view.totalCount, 4);
  assert.equal(value.view.omittedCount, 3);
});

async function wp605SavedFactComparisonFixture() {
  const { createInitialCoreState } = await import('../../src/core/runtime.mjs');
  const { deriveAtlasContinuityFactLedgers } = await import('../../src/derived/atlas/deriveAtlasContinuityFactLedgers.mjs');
  const { fixture } = require('../fixtures/r24-wp603-wse-state-evidence-fixtures.js');
  const f = await fixture(), coreState = createInitialCoreState();
  const ledgers = { location: {}, knowledge: {}, object: {}, promise: {} };
  for (const fact of f.facts) ledgers[fact.ledgerKind][fact.id] = structuredClone(fact);
  coreState.data.projects[f.projectId] = { id: f.projectId, sceneOrder: ['scene-a', 'scene-b'],
    scenes: { 'scene-a': { id: 'scene-a', text: f.sceneA }, 'scene-b': { id: 'scene-b', text: f.sceneB } },
    atlas: { schemaVersion: 'atlas.author.v1', entities: { 'entity-anna': { id: 'entity-anna' }, 'entity-mira': { id: 'entity-mira' }, 'entity-key': { id: 'entity-key' } }, continuityFactLedgers: ledgers } };
  const before = structuredClone(coreState), old = before.data.projects[f.projectId].atlas.continuityFactLedgers;
  delete old.knowledge['knowledge-mira']; old.location['location-anna'].factValue = 'old gate';
  const previous = deriveAtlasContinuityFactLedgers({ coreState: before, params: { projectId: f.projectId }, capabilitySnapshot: {} });
  assert.equal(previous.ok, true);
  return { coreState, projectId: f.projectId, previousSnapshot: { projectId: f.projectId, revisionId: 'actual-derived-previous-facts', facts: previous.value.facts } };
}

test('WP605 Ledger semantic diff consumes a caller-verified previous fact revision and preserves all inputs', async () => {
  const { deriveAtlasContinuityLedgerSurface } = await import('../../src/derived/atlas/deriveAtlasContinuityLedgerSurface.mjs');
  const f = await wp605SavedFactComparisonFixture(), before = structuredClone(f);
  const result = deriveAtlasContinuityLedgerSurface({ coreState: f.coreState,
    params: { projectId: f.projectId, previousSnapshot: f.previousSnapshot }, capabilitySnapshot: {} });
  assert.equal(result.ok, true, JSON.stringify(result.error)); assert.deepEqual(f, before);
  const diff = result.value.wseRevisionTimeObject.views.semanticDiff;
  assert.equal(diff.state, 'ready', 'ordinary Ledger currently discards the verified baseline');
  assert.equal(diff.previousRevision, f.previousSnapshot.revisionId);
  assert.equal(diff.rows.find(row => row.factId === 'knowledge-mira')?.change, 'ADDED');
  const changed = diff.rows.find(row => row.factId === 'location-anna');
  assert.equal(changed?.change, 'CHANGED'); assert.equal(changed.beforeValue, 'old gate'); assert.equal(changed.afterValue, 'gate');
  assert.equal(result.value.wseRevisionTimeObject.authority.persistence, false);
  assert.equal(result.value.wseRevisionTimeObject.views.storyClock.reason, 'UNKNOWN_TIME_SOURCE');
});

for (const kind of ['foreign-project', 'malformed-facts']) test('WP605 Ledger refuses ' + kind + ' baseline without mutation', async () => {
  const { deriveAtlasContinuityLedgerSurface } = await import('../../src/derived/atlas/deriveAtlasContinuityLedgerSurface.mjs');
  const f = await wp605SavedFactComparisonFixture();
  if (kind === 'foreign-project') f.previousSnapshot.projectId = 'foreign-project';
  else f.previousSnapshot.facts = {};
  const before = structuredClone(f), result = deriveAtlasContinuityLedgerSurface({ coreState: f.coreState,
    params: { projectId: f.projectId, previousSnapshot: f.previousSnapshot }, capabilitySnapshot: {} });
  assert.deepEqual(f, before); assert.equal(result.ok, false, 'invalid historical input must not be ignored as an unknown baseline');
});

async function wp605ActualSchedulerFixture() {
  const vm = require('node:vm'), source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../src/main.js'), 'utf8');
  const start = source.indexOf('async function runScheduledAtlasAnalyticsQuery('), end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start);
  const { createAtlasAnalyticsScheduler } = require('../../src/derived/atlas/atlasAnalyticsScheduler.cjs');
  let head = 'a'.repeat(64);
  const runtime = { getCommandReceiptAuthorityHead: () => ({ authorityHeadDigest: head }) };
  const owner = { getRuntime: () => runtime }, window = {};
  const c = { normalizeStableProjectId: value => value, readAtlasAnalyticsSourceRecord: async () => ({ projectId: 'project', sourceRevision: 'same-source', dependencyRevisions: { source: 'same-bytes' } }),
    atlasAnalyticsScheduler: createAtlasAnalyticsScheduler(), ATLAS_CONTINUITY_LEDGER_SURFACE_QUERY_ID: 'query.atlasContinuityLedgerSurface',
    ATLAS_DIAGNOSTICS_STAGE_ACCEPTANCE_QUERY_ID: 'query.atlasDiagnosticsStageAcceptance', mainWindow: window, activeStage10ApplicationBootstrap: owner,
    getProjectRootPath: () => '/owned-test-project', app: { getPath: () => '/owned-test-userdata' }, currentLifecycleSubjectId: () => 'document:one',
    commentAuthoringSessionId: 'session', lastSignaledEditGeneration: 0, readPulseContinuityClaim: async () => ({ stableOpaqueClaim: true }),
    canonicalizeComparableValue: value => value, computeHash: value => require('node:crypto').createHash('sha256').update(value).digest('hex') };
  vm.createContext(c); vm.runInContext(source.slice(start, end + 2), c);
  return { run: handler => c.runScheduledAtlasAnalyticsQuery(c.ATLAS_CONTINUITY_LEDGER_SURFACE_QUERY_ID, { projectId: 'project', explicitOpen: true }, handler),
    changeHead: () => { head = 'b'.repeat(64); } };
}

test('WP605 actual Main scheduling does not reuse a retained result after only history authority changes [FINITE_SCHEDULER_NOT_PRODUCT_HISTORY]', async () => {
  const f = await wp605ActualSchedulerFixture(); let calls = 0;
  const handler = async () => ({ ok: true, modelMarker: ++calls });
  assert.equal((await f.run(handler)).modelMarker, 1);
  assert.equal((await f.run(handler)).modelMarker, 1); assert.equal(calls, 1, 'the real scheduler must actually exercise retained reuse');
  f.changeHead(); const current = await f.run(handler);
  assert.equal(current.ok, true); assert.equal(current.modelMarker, 2, 'same source bytes must not hide a new verified history identity');
  assert.equal(calls, 2);
});

test('WP605 actual Main scheduling drops a history head changed during awaited work [FINITE_SCHEDULER_NOT_PRODUCT_HISTORY]', async () => {
  const f = await wp605ActualSchedulerFixture(); let enter, release;
  const entered = new Promise(resolve => { enter = resolve; }), held = new Promise(resolve => { release = resolve; });
  const pending = f.run(async () => { enter(); await held; return { ok: true, modelMarker: 'old-history' }; });
  await entered; f.changeHead(); release(); const result = await pending;
  assert.equal(result.ok, false, 'a successful compute cannot publish under a different history authority head');
  assert.equal(result.error.code, 'E_ATLAS_ANALYTICS_STALE_RESULT_DISCARDED');
});

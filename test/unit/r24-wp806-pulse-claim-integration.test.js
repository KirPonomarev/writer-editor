'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const claimPromise = import('../../src/core/pulse-claim-v1.mjs');
const presentationPromise = import('../../src/renderer/pulseHistoryPresentationModel.mjs');
const { directoryBytes, seedPulseClaimDirectory } = require('../fixtures/r24-wp806-pulse-claim-fixtures.js');

const directory = t => {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-wp806-integration-'));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
};

test('WP806 reads local history without changing any persisted byte', async t => {
  const root = directory(t);
  await seedPulseClaimDirectory(root);
  const before = directoryBytes(root);
  const { readPulseClaimProjection } = await claimPromise;
  const projection = await readPulseClaimProjection(root);
  const after = directoryBytes(root);
  assert.equal(projection.rows.length, 2);
  assert.deepEqual(Object.keys(after), Object.keys(before));
  for (const [basename, bytes] of Object.entries(before)) assert(after[basename].equals(bytes), basename);
});

test('WP806 reopens the aggregate history in a fresh exact runtime process', async t => {
  const root = directory(t);
  await seedPulseClaimDirectory(root);
  const moduleUrl = pathToFileURL(path.resolve('src/core/pulse-claim-v1.mjs')).href;
  const script = `import {readPulseClaimProjection} from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(await readPulseClaimProjection(process.argv[1])));`;
  const reopened = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script, root], { encoding: 'utf8' }));
  assert.equal(reopened.state, 'degraded');
  assert.equal(reopened.summary.totalRows, 2);
  assert.equal(reopened.rows[0].added.value, 0);
  assert.equal(reopened.rows[0].declaredTasks.status, 'NOT_RECORDED');
});

test('WP806 presentation preserves zero, missing, provenance and denominators', async t => {
  const root = directory(t);
  await seedPulseClaimDirectory(root);
  const { readPulseClaimProjection } = await claimPromise;
  const { normalizePulseHistoryPresentation } = await presentationPromise;
  const presentation = normalizePulseHistoryPresentation(await readPulseClaimProjection(root));
  assert.equal(presentation.statusText, '2 of 2 revisions shown · 5 complete · 0 partial · 2 not recorded');
  const added = presentation.rows[0].metrics.find(row => row.id === 'added');
  const missing = presentation.rows[0].metrics.find(row => row.id === 'sceneEdits');
  assert.deepEqual({ displayValue: added.displayValue, provenance: added.provenance }, { displayValue: '0', provenance: 'LEDGER_AGGREGATE' });
  assert.deepEqual({ displayValue: missing.displayValue, provenance: missing.provenance }, { displayValue: 'Not recorded', provenance: '' });
});

test('WP806 presents opt-out without consuming fabricated history rows', async () => {
  const { normalizePulseHistoryPresentation } = await presentationPromise;
  const presentation = normalizePulseHistoryPresentation({ state: 'optedOut', privacy: { collectionStatus: 'OPTED_OUT', aggregateOnly: true }, rows: [{ sequence: 99 }] });
  assert.equal(presentation.state, 'optedOut');
  assert.equal(presentation.statusText, 'Writing history is off. Local history remains unread.');
  assert.equal(presentation.privacyStatus, 'OPTED_OUT');
});

test('WP806 main bridge owns the fixed Pulse directory and renderer receives no path authority', () => {
  const main = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  const renderer = fs.readFileSync(path.resolve('src/renderer/editor.js'), 'utf8');
  assert.match(main, /readPulseClaimProjection\(path\.join\(app\.getPath\('userData'\), 'pulse'\)\)/u);
  assert.doesNotMatch(main.slice(main.indexOf('async function handleWorkspaceAtlasContinuityLedgerSurfaceQuery'), main.indexOf('async function handleWorkspaceAtlasReportsSavedQueriesQuery')), /safePayload\.(?:path|directory|root)/u);
  assert.match(renderer, /setAttribute\('role', 'list'\)/u);
  assert.match(renderer, /setAttribute\('role', 'listitem'\)/u);
  assert.match(renderer, /appendPulseHistory\(atlasContinuityLedgerHost, state\.pulseClaim\)/u);
});

test('WP806 read-only readers reject a symlink directory before reading history', async t => {
  const root = directory(t);
  const target = path.join(root, 'target');
  const link = path.join(root, 'link');
  await seedPulseClaimDirectory(target);
  fs.symlinkSync(target, link, 'dir');
  const { readPulseClaimProjection } = await claimPromise;
  await assert.rejects(() => readPulseClaimProjection(link), error => error.code === 'E_WP806_PRIVACY_DIRECTORY');
});

test('WP806 actual absent privacy snapshot supplies usable exact consent CAS without creating a directory', async t => {
  const root = path.join(directory(t), 'absent'), { readPulseClaimProjection } = await claimPromise;
  const { readPulsePrivacyStateSnapshot } = await import('../../src/core/pulse-privacy-v1.mjs');
  const actual = readPulsePrivacyStateSnapshot(root), projection = await readPulseClaimProjection(root);
  assert.equal(fs.existsSync(root), false); assert.equal(actual.revision, 0);
  assert.match(actual.stateDigest, /^[a-f0-9]{64}$/u);
  assert.equal(projection.privacy.revision, actual.revision); assert.equal(projection.privacy.stateDigest, actual.stateDigest);
  assert.equal(Object.isFrozen(projection.privacy), true); assert.equal(projection.authority.storageMutation, false);
});

test('WP806 actual durable privacy CAS remains exact through cold read and renderer presentation', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root);
  const { readPulsePrivacyStateSnapshot } = await import('../../src/core/pulse-privacy-v1.mjs');
  const actual = readPulsePrivacyStateSnapshot(root), before = directoryBytes(root);
  const { readPulseClaimProjection } = await claimPromise, { normalizePulseHistoryPresentation } = await presentationPromise;
  const projection = await readPulseClaimProjection(root), model = normalizePulseHistoryPresentation(projection);
  assert.equal(projection.privacy.revision, actual.revision); assert.equal(projection.privacy.stateDigest, actual.stateDigest);
  assert.equal(model.privacyRevision, actual.revision); assert.equal(model.privacyStateDigest, actual.stateDigest);
  const script = `import {readPulseClaimProjection} from ${JSON.stringify(pathToFileURL(path.resolve('src/core/pulse-claim-v1.mjs')).href)};process.stdout.write(JSON.stringify(await readPulseClaimProjection(process.argv[1])));`;
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script, root], { encoding: 'utf8' })), projection);
  assert.deepEqual(directoryBytes(root), before);
});

test('WP806 status-only legacy builders and malformed tokens never invent actionable revision zero', async t => {
  const { normalizePulseHistoryPresentation } = await presentationPromise;
  const sources = [{ state: 'optedOut', privacy: { collectionStatus: 'OPTED_OUT', aggregateOnly: true } },
    { state: 'unavailable', privacy: { collectionStatus: 'OPTED_OUT', revision: 0, stateDigest: 'f'.repeat(64) } },
    { state: 'optedOut', privacy: { collectionStatus: 'OPTED_OUT', revision: '0', stateDigest: 'f'.repeat(64) } },
    { state: 'optedOut', privacy: { collectionStatus: 'OPTED_OUT', revision: 0, stateDigest: '' } }];
  for (const source of sources) {
    const model = normalizePulseHistoryPresentation(source);
    assert.equal(model.privacyRevision, null, 'only an actually validated current snapshot supplies a consent token');
    assert.equal(model.privacyStateDigest, '');
  }
  const root = directory(t); await seedPulseClaimDirectory(root);
  const { buildPulseClaim } = await claimPromise, { buildPulseDescriptiveHistory } = await import('../../src/core/descriptive-history-v1.mjs');
  const { readPulseLedgerSnapshot } = await import('../../src/core/pulse-ledger-v1.mjs'), ledgerSnapshot = await readPulseLedgerSnapshot(root);
  const currentIdentity = { ledgerSequence: ledgerSnapshot.sequence, ledgerHeadDigest: ledgerSnapshot.headDigest, declarationRevisionOrdinal: 0, generation: 22 };
  const historyProjection = buildPulseDescriptiveHistory({ ledgerSnapshot, currentIdentity, declarationSnapshot: {
    schemaVersion: 'yalken.r24.pulseHistoryDeclarations.v1', ledgerSequence: ledgerSnapshot.sequence,
    ledgerHeadDigest: ledgerSnapshot.headDigest, revisionOrdinal: 0, generation: 22, entries: [] } });
  const legacy = buildPulseClaim({ historyProjection, currentIdentity, privacyState: { collectionStatus: 'OPTED_IN' } });
  assert.equal(legacy.rows.length, 2); assert.equal(Object.hasOwn(legacy.privacy, 'revision'), false);
  assert.equal(normalizePulseHistoryPresentation(legacy).privacyRevision, null);
});

test('WP806 explicit opt-out reads privacy only and leaves malformed history completely unread and unrepaired', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root);
  const { openPulsePrivacyController, readPulsePrivacyStateSnapshot, PULSE_PRIVACY_COMMAND_SCHEMA } = await import('../../src/core/pulse-privacy-v1.mjs');
  const controller = await openPulsePrivacyController(root), prior = readPulsePrivacyStateSnapshot(root);
  await controller.optOut({ schemaVersion: PULSE_PRIVACY_COMMAND_SCHEMA, type: 'OPT_OUT', requestId: 'owned-optout-read', expectedPrivacyRevision: prior.revision });
  for (const name of ['pulse-ledger.v1.jsonl', 'pulse-ledger-intents.v1.jsonl', 'pulse-ledger-outbox.v1.jsonl']) fs.writeFileSync(path.join(root, name), '{broken:');
  const before = directoryBytes(root), { readPulseClaimProjection } = await claimPromise, actual = readPulsePrivacyStateSnapshot(root);
  const projection = await readPulseClaimProjection(root);
  assert.deepEqual(directoryBytes(root), before); assert.equal(projection.state, 'optedOut'); assert.deepEqual(projection.rows, []);
  assert.equal(projection.privacy.revision, actual.revision); assert.equal(projection.privacy.stateDigest, actual.stateDigest);
});

for (const channel of ['pulse-privacy-state.v1.json', 'pulse-ledger.v1.jsonl', 'pulse-ledger-intents.v1.jsonl', 'pulse-ledger-outbox.v1.jsonl']) test('WP806 actual read-only malformed ' + channel + ' cannot recover or fabricate fresh consent', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root); fs.appendFileSync(path.join(root, channel), '{broken:');
  const before = directoryBytes(root), { readPulseClaimProjection } = await claimPromise;
  await assert.rejects(() => readPulseClaimProjection(root), error => /^E_WP(?:801|804|806)_/u.test(error.code));
  assert.deepEqual(directoryBytes(root), before, 'no writer/openLedger repair on the read path');
});

async function pulseAuthorCorrectionControl(root, value, requestId) {
  const privacy = await import('../../src/core/pulse-privacy-v1.mjs');
  const controller = await privacy.openPulsePrivacyController(root), current = await controller.explain();
  const { correctionCommand } = require('../fixtures/r24-wp804-pulse-privacy-fixtures.js');
  const result = await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: current.identity.privacyRevision,
    correctionSequence: current.identity.correctionSequence, correctionHeadDigest: current.identity.correctionHeadDigest,
    targetEntryDigest: current.history[0].entryDigest, correctedValue: value, requestId }));
  const explanation = await controller.explain();
  assert.equal(explanation.history[0].effectiveAggregates.find(row => row.metricId === 'WORDS_ADDED_COUNT').effectiveValue, value);
  return { result, explanation };
}

test('Pulse actual claim separates original measured zero from existing Core author correction and cold readback without writes', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root);
  const originalLedger = fs.readFileSync(path.join(root, 'pulse-ledger.v1.jsonl'));
  const control = await pulseAuthorCorrectionControl(root, 7, 'owned-author-seven'), before = directoryBytes(root);
  const { readPulseClaimProjection } = await claimPromise, projection = await readPulseClaimProjection(root);
  assert.equal(projection.rows[0].added.value, 0, 'authored correction never replaces measured truth');
  assert.ok(projection.correctionReview, 'existing Core correction must reach the actual live claim separately');
  assert.deepEqual(projection.correctionReview.identity, control.explanation.identity);
  const metric = projection.correctionReview.rows[0].metrics.find(row => row.metricId === 'WORDS_ADDED_COUNT');
  assert.deepEqual(metric, { metricId: 'WORDS_ADDED_COUNT', originalValue: 0, effectiveValue: 7, correctionSequence: 1 });
  assert.equal(projection.correctionReview.rows[0].entryDigest, control.explanation.history[0].entryDigest);
  assert.equal(Object.isFrozen(projection.correctionReview.rows[0].metrics[0]), true);
  assert.deepEqual(directoryBytes(root), before); assert.deepEqual(fs.readFileSync(path.join(root, 'pulse-ledger.v1.jsonl')), originalLedger);
  const script = `import {readPulseClaimProjection} from ${JSON.stringify(pathToFileURL(path.resolve('src/core/pulse-claim-v1.mjs')).href)};process.stdout.write(JSON.stringify(await readPulseClaimProjection(process.argv[1])));`;
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script, root], { encoding: 'utf8' })), projection);
});

test('Pulse restoring the original measurement appends another correction and presentation keeps both meanings', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root);
  await pulseAuthorCorrectionControl(root, 7, 'owned-first-seven');
  const first = fs.readFileSync(path.join(root, 'pulse-corrections.v1.jsonl'));
  const control = await pulseAuthorCorrectionControl(root, 0, 'owned-restore-zero');
  assert.equal(control.result.correctionSnapshot.sequence, 2);
  assert.deepEqual(fs.readFileSync(path.join(root, 'pulse-corrections.v1.jsonl')).subarray(0, first.length), first);
  const projection = await (await claimPromise).readPulseClaimProjection(root);
  const model = (await presentationPromise).normalizePulseHistoryPresentation(projection);
  assert.equal(model.rows[0].metrics.find(row => row.id === 'added').value, 0);
  assert.ok(Array.isArray(model.rows[0].corrections), 'renderer needs a separate original/author display model');
  const metric = model.rows[0].corrections.find(row => row.metricId === 'WORDS_ADDED_COUNT');
  assert.equal(metric.originalValue, 0); assert.equal(metric.effectiveValue, 0); assert.equal(metric.correctionSequence, 2);
  assert.deepEqual(model.correctionIdentity, control.explanation.identity);
});

test('Pulse malformed correction history is an unavailable read rather than hidden or repaired history', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root);
  await pulseAuthorCorrectionControl(root, 7, 'owned-malformed-control');
  fs.appendFileSync(path.join(root, 'pulse-corrections.v1.jsonl'), '{broken:');
  const before = directoryBytes(root);
  await assert.rejects(() => claimPromise.then(module => module.readPulseClaimProjection(root)), error => /^E_WP804_CORRECTION_/u.test(error.code));
  assert.deepEqual(directoryBytes(root), before);
});

test('Pulse opted-out automatic query never reads malformed retained corrections', async t => {
  const root = directory(t); await seedPulseClaimDirectory(root);
  const privacy = await import('../../src/core/pulse-privacy-v1.mjs'), controller = await privacy.openPulsePrivacyController(root);
  await controller.optOut({ schemaVersion: privacy.PULSE_PRIVACY_COMMAND_SCHEMA, type: 'OPT_OUT', requestId: 'owned-off-correction-query', expectedPrivacyRevision: 1 });
  fs.writeFileSync(path.join(root, 'pulse-corrections.v1.jsonl'), '{broken:');
  const before = directoryBytes(root), projection = await (await claimPromise).readPulseClaimProjection(root);
  assert.equal(projection.state, 'optedOut'); assert.ok(!projection.correctionReview);
  assert.deepEqual(directoryBytes(root), before);
});

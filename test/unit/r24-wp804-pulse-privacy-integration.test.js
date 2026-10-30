'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const modulePromise = import('../../src/core/pulse-privacy-v1.mjs');
const { aggregateReceipt, consentCommand, correctionCommand, disposableDeletePort, disposableExportPort, effectCommand } = require('../fixtures/r24-wp804-pulse-privacy-fixtures.js');

const fixture = () => fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-wp804-integration-'));
const openController = async (...args) => (await modulePromise).openPulsePrivacyController(...args);

test('WP804 survives a fresh process with consent, ledger and corrections intact', async () => {
  const directory = fixture();
  const controller = await openController(directory);
  await controller.optIn(consentCommand('OPT_IN', 0));
  const appended = await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'fresh-process-1', expectedSequence: 0, receipt: aggregateReceipt() });
  await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: 1, targetEntryDigest: appended.entry.entryDigest, correctedValue: 8 }));
  const moduleUrl = pathToFileURL(path.resolve('src/core/pulse-privacy-v1.mjs')).href;
  const source = `import {openPulsePrivacyController} from ${JSON.stringify(moduleUrl)}; const c=await openPulsePrivacyController(process.argv[1]); process.stdout.write(JSON.stringify(await c.explain()));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', source, directory], { encoding: 'utf8' });
  const reopened = JSON.parse(output);
  assert.equal(reopened.privacyState.collectionStatus, 'OPTED_IN');
  assert.equal(reopened.identity.ledgerSequence, 1);
  assert.equal(reopened.identity.correctionSequence, 1);
  assert.equal(reopened.history[0].effectiveAggregates.find(row => row.metricId === 'WORDS_ADDED_COUNT').effectiveValue, 8);
});

test('WP804 binds export to a fresh ledger and correction identity', async () => {
  const calls = [];
  const directory = fixture();
  const controller = await openController(directory, { exportPort: disposableExportPort(calls) });
  await controller.optIn(consentCommand('OPT_IN', 0));
  const first = await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'export-1', expectedSequence: 0, receipt: aggregateReceipt() });
  const stale = await controller.explain();
  await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: 1, targetEntryDigest: first.entry.entryDigest }));
  await assert.rejects(() => controller.exportOnUserRequest(effectCommand('EXPORT', stale)), error => error.code === 'E_WP804_CORRECTION_IDENTITY_STALE');
  assert.equal(calls.length, 0);
});

test('WP804 rejects tampered local privacy state and correction journal before any port effect', async () => {
  const directory = fixture();
  const exportCalls = [];
  let controller = await openController(directory, { exportPort: disposableExportPort(exportCalls) });
  await controller.optIn(consentCommand('OPT_IN', 0));
  const appended = await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'tamper-1', expectedSequence: 0, receipt: aggregateReceipt() });
  const correction = await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: 1, targetEntryDigest: appended.entry.entryDigest }));
  const statePath = path.join(directory, 'pulse-privacy-state.v1.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); state.collectionStatus = 'OPTED_OUT';
  fs.writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  await assert.rejects(() => controller.explain(), error => ['E_WP804_STATE_TAMPER', 'E_WP804_STATE_CANONICAL'].includes(error.code));
  fs.unlinkSync(statePath);
  const correctionsPath = path.join(directory, 'pulse-corrections.v1.jsonl');
  const row = JSON.parse(fs.readFileSync(correctionsPath, 'utf8')); row.previousEntryDigest = 'f'.repeat(64);
  fs.writeFileSync(correctionsPath, `${JSON.stringify(row)}\n`);
  controller = await openController(directory, { exportPort: disposableExportPort(exportCalls) });
  await assert.rejects(() => controller.explain(), error => ['E_WP804_CORRECTION_CHAIN', 'E_WP804_CORRECTION_CANONICAL'].includes(error.code));
  assert.equal(exportCalls.length, 0);
  assert.equal(correction.entry.sequence, 1);
});

test('WP804 disposable end-to-end flow collects, corrects, exports, opts out, deletes and reopens safely', async () => {
  const directory = fixture();
  const exports = [], deletions = [];
  const controller = await openController(directory, {
    exportPort: disposableExportPort(exports),
    deletePort: disposableDeletePort(deletions),
  });
  await controller.optIn(consentCommand('OPT_IN', 0));
  const appended = await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'chain-1', expectedSequence: 0, receipt: aggregateReceipt() });
  await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: 1, targetEntryDigest: appended.entry.entryDigest, correctedValue: 7 }));
  let explanation = await controller.explain();
  await controller.exportOnUserRequest(effectCommand('EXPORT', explanation));
  await controller.optOut(consentCommand('OPT_OUT', 1));
  explanation = await controller.explain();
  await controller.deleteOnUserRequest(effectCommand('DELETE', explanation));
  const reopened = await openController(directory);
  const empty = await reopened.explain();
  assert.equal(exports.length, 1);
  assert.equal(deletions.length, 1);
  assert.equal(empty.privacyState.collectionStatus, 'OPTED_OUT');
  assert.equal(empty.identity.ledgerSequence, 0);
  assert.equal(empty.identity.correctionSequence, 0);
});

test('Pulse pure explanation query equals existing Core truth without creating or rewriting any channel', async () => {
  const directory = fixture(), controller = await openController(directory);
  await controller.optIn(consentCommand('OPT_IN', 0));
  const saved = await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'pure-query-control', expectedSequence: 0, receipt: aggregateReceipt() });
  await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: 1, targetEntryDigest: saved.entry.entryDigest, correctedValue: 0 }));
  const expected = await controller.explain();
  const roster = () => Object.fromEntries(fs.readdirSync(directory).sort().map(name => [name, fs.readFileSync(path.join(directory, name))]));
  const before = roster(), { readPulsePrivacyExplanationSnapshot } = await modulePromise;
  const result = await readPulsePrivacyExplanationSnapshot(directory);
  assert.deepEqual(result.explanation, expected); assert.equal(result.ledgerSnapshot.sequence, 1);
  assert.equal(Object.isFrozen(result.explanation.history[0].effectiveAggregates[0]), true);
  assert.deepEqual(roster(), before);
  const absent = path.join(fixture(), 'not-created');
  await assert.rejects(() => readPulsePrivacyExplanationSnapshot(absent), error => error.code === 'E_WP804_HISTORY_READ_REQUIRES_OPT_IN');
  assert.equal(fs.existsSync(absent), false);
});

test('Pulse pure explanation refuses an over-budget correction file before interpretation without repair', async () => {
  const directory = fixture(), controller = await openController(directory);
  await controller.optIn(consentCommand('OPT_IN', 0));
  const { readPulsePrivacyExplanationSnapshot, PULSE_PRIVACY_MAX_FILE_BYTES } = await modulePromise;
  const target = path.join(directory, 'pulse-corrections.v1.jsonl');
  const bytes = Buffer.alloc(PULSE_PRIVACY_MAX_FILE_BYTES + 1, 0x20); fs.writeFileSync(target, bytes);
  await assert.rejects(() => readPulsePrivacyExplanationSnapshot(directory), error => error.code === 'E_WP804_HISTORY_SOURCE_FILE');
  assert.deepEqual(fs.readFileSync(target), bytes);
});

test('Pulse pure explanation refuses correction bytes changed during its actual read and preserves the concurrent result', async t => {
  const directory = fixture(), controller = await openController(directory);
  await controller.optIn(consentCommand('OPT_IN', 0));
  const saved = await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'pure-read-race', expectedSequence: 0, receipt: aggregateReceipt() });
  await controller.appendCorrection(correctionCommand({ expectedPrivacyRevision: 1, targetEntryDigest: saved.entry.entryDigest }));
  const target = path.join(directory, 'pulse-corrections.v1.jsonl'), original = fs.readFileSync;
  let reached = false, concurrent;
  fs.readFileSync = (file, ...args) => {
    const bytes = original(file, ...args);
    if (file === target && !reached) { reached = true; concurrent = Buffer.concat([bytes, Buffer.from('{owned-concurrent-read-race:')]); fs.writeFileSync(target, concurrent); }
    return bytes;
  };
  t.after(() => { fs.readFileSync = original; });
  await assert.rejects(() => modulePromise.then(module => module.readPulsePrivacyExplanationSnapshot(directory)), error => error.code === 'E_WP804_CORRECTION_SOURCE_STALE');
  assert.equal(reached, true); assert.deepEqual(original(target), concurrent);
});

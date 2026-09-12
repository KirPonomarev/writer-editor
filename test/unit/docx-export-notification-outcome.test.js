const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { runDocxMinExport } = require('../../src/export/docx/docxMinExportHandler');
const { makeCommandBridgeSuccess, makeCommandBridgeFailure } = require('../../src/shared/commandBridgeResponse.cjs');

const WARNING = {
  code: 'W_EXPORT_STATUS_NOTIFICATION_FAILED',
  reason: 'STATUS_NOTIFICATION_FAILED',
};

function setup({ notify = () => {}, writeReject = false, writeAfter = false } = {}) {
  const state = { writes: [], notifications: 0 };
  const payload = { requestId: 'notification-outcome', outPath: 'synthetic-export.docx' };
  const deps = {
    normalizeExportPayload: value => value,
    makeTypedExportError: (code, reason, details) => ({ ok: 0, error: { code, reason, details } }),
    resolveDocxExportPath: () => payload.outPath,
    validateDocxExportTarget: () => ({ ok: true }),
    readCanonicalExportSnapshot: () => ({ content: 'Canonical synthetic source' }),
    buildDocxMinBuffer: () => Buffer.from('synthetic builder bytes'),
    queueDiskOperation: operation => operation(),
    writeBufferAtomic: async (outPath, bytes) => {
      if (writeReject) throw new Error('WRITE_REJECTED_BEFORE_COMMIT');
      state.writes.push({ outPath, bytes: Buffer.from(bytes) });
      if (writeAfter) throw new Error('WRITE_REJECTED_AFTER_SIDE_EFFECT');
    },
    updateStatus: (...args) => {
      state.notifications += 1;
      return notify(...args);
    },
  };
  return { state, run: () => runDocxMinExport(payload, deps) };
}

for (const [name, notify] of [
  ['sync throw', () => { throw new Error('private notification message'); }],
  ['async rejection', async () => { throw new Error('private notification message'); }],
  ['non-Error throw', () => { throw null; }],
]) test(`DOCX notification ${name} preserves completed export with one bounded warning`, async () => {
  const h = setup({ notify });
  const result = await h.run();
  assert.deepEqual(result, {
    ok: 1,
    outPath: 'synthetic-export.docx',
    bytesWritten: Buffer.byteLength('synthetic builder bytes'),
    warnings: [WARNING],
  });
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.notifications, 1);
  assert.equal(JSON.stringify(result).includes('private notification message'), false);
});

for (const [name, notify] of [
  ['never-settling Promise', () => new Promise(() => {})],
  ['never-settling thenable', () => ({ then() {} })],
  ['already-resolved Promise', () => Promise.resolve()],
]) test(`DOCX ${name} notification never holds a committed export open`, async () => {
  const h = setup({ notify });
  const pending = Symbol('pending export');
  const result = await Promise.race([
    h.run(),
    new Promise(resolve => setImmediate(() => resolve(pending))),
  ]);
  assert.notEqual(result, pending);
  assert.equal(result.ok, 1);
  assert.deepEqual(result.warnings, [WARNING]);
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.notifications, 1);
});

test('DOCX deferred notification rejection is observed without changing the returned result', async () => {
  let rejectNotification;
  const notification = new Promise((resolve, reject) => { rejectNotification = reject; });
  const h = setup({ notify: () => notification });
  const pending = Symbol('pending export');
  const result = await Promise.race([h.run(), new Promise(resolve => setImmediate(() => resolve(pending)))]);
  assert.notEqual(result, pending);
  assert.equal(result.ok, 1);
  assert.deepEqual(result.warnings, [WARNING]);
  const serialized = JSON.stringify(result);
  rejectNotification(new Error('private deferred notification message'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.stringify(result), serialized);
  assert.equal(serialized.includes('private'), false);
  assert.equal(h.state.writes.length, 1);
});

test('DOCX successful notification keeps the existing success result shape', async () => {
  const h = setup();
  assert.deepEqual(await h.run(), {
    ok: 1, outPath: 'synthetic-export.docx', bytesWritten: Buffer.byteLength('synthetic builder bytes'),
  });
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.notifications, 1);
});

test('DOCX failed write stays typed and never calls the notification port', async () => {
  const h = setup({ writeReject: true, notify: () => { throw new Error('must not run'); } });
  const result = await h.run();
  assert.equal(result.ok, 0);
  assert.equal(result.error.code, 'E_EXPORT_WRITE_FAILED');
  assert.equal(result.error.reason, 'DOCX_WRITE_FAILED');
  assert.equal(h.state.writes.length, 0);
  assert.equal(h.state.notifications, 0);
});

test('DOCX rejected write port after side effect remains uncertain, never inferred success', async () => {
  const h = setup({ writeAfter: true });
  const result = await h.run();
  assert.equal(result.ok, 0);
  assert.equal(result.error.code, 'E_EXPORT_WRITE_FAILED');
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.notifications, 0);
});

test('DOCX throw-once notification is per invocation; explicit retry is not deduplicated', async () => {
  let calls = 0;
  const h = setup({ notify: () => { if (++calls === 1) throw new Error('one notification failure'); } });
  const first = await h.run();
  const second = await h.run();
  assert.equal(first.ok, 1);
  assert.deepEqual(first.warnings, [WARNING]);
  assert.equal(second.ok, 1);
  assert.equal(Object.hasOwn(second, 'warnings'), false);
  assert.equal(h.state.writes.length, 2);
});

test('DOCX always-failing notification yields one warning on each successful write', async () => {
  const h = setup({ notify: () => { throw new Error('notification failure'); } });
  for (let index = 0; index < 2; index++) {
    const result = await h.run();
    assert.equal(result.ok, 1);
    assert.deepEqual(result.warnings, [WARNING]);
  }
  assert.equal(h.state.writes.length, 2);
});

async function rendererRun(response) {
  const url = file => pathToFileURL(path.join(__dirname, '../../src/renderer/commands', file)).href;
  const { createCommandRegistry } = await import(url('registry.mjs'));
  const { createCommandRunner } = await import(url('runCommand.mjs'));
  const { registerProjectCommands, COMMAND_IDS } = await import(url('projectCommands.mjs'));
  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async () => response } });
  return createCommandRunner(registry)(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, { confirmed: true });
}

test('DOCX bounded notification warning reaches the renderer command caller through serialization', async () => {
  const h = setup({ notify: () => { throw new Error('notification failure'); } });
  const backend = await h.run();
  const bridge = makeCommandBridgeSuccess({ ...backend, ok: true });
  const result = await rendererRun(bridge);
  assert.deepEqual(result, {
    ok: true,
    value: { exported: true, outPath: backend.outPath, bytesWritten: backend.bytesWritten, warnings: [WARNING] },
  });
});

test('DOCX warning projection drops arbitrary fields instead of exposing error details', async () => {
  const result = await rendererRun(makeCommandBridgeSuccess({
    ok: true,
    warnings: [{ ...WARNING, details: { privatePath: 'private' }, message: 'private' }],
  }));
  assert.deepEqual(result.value.warnings, [WARNING]);
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('DOCX warning cannot promote typed failure or stale outer failure to success', async () => {
  const denied = await rendererRun(makeCommandBridgeFailure('DENIED', {
    ok: 0, error: { code: 'TYPED_DENY', reason: 'DENIED' }, warnings: [WARNING],
  }));
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'TYPED_DENY');
  const stale = await rendererRun(makeCommandBridgeFailure('STALE_OUTER', { ok: true, warnings: [WARNING] }));
  assert.equal(stale.ok, false);
});

for (const [name, warnings] of [
  ['unknown', [{ code: 'UNKNOWN', reason: WARNING.reason }]],
  ['wrong reason', [{ code: WARNING.code, reason: 'UNKNOWN' }]],
  ['duplicate', [WARNING, WARNING]],
  ['null', [null]],
]) test(`DOCX renderer never invents a notification warning from ${name} metadata`, async () => {
  const result = await rendererRun(makeCommandBridgeSuccess({ ok: true, warnings }));
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.value, 'warnings'), false);
});

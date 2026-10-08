'use strict';

// R2.4 S1 integration: the envelope law driving a bridge-shaped dispatch and
// the full-denominator source contracts over main.js and preload.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  createEnvelope,
  validateIpcEnvelope,
  withTimeoutBudget,
} = require('../../src/core/ipc-envelope-v1.cjs');

const CHANNELS = ['ui:command-bridge', 'ui:workspace-query-bridge', 'ui:save-lifecycle-signal-bridge'];
const ID_FIELDS = { 'ui:command-bridge': 'commandId', 'ui:workspace-query-bridge': 'queryId', 'ui:save-lifecycle-signal-bridge': 'signalId' };

test('both sides: createEnvelope output validates on the receiving side for all three bridges', () => {
  for (const channel of CHANNELS) {
    const idField = ID_FIELDS[channel];
    const envelope = createEnvelope(channel, `${idField}.test`, { sample: 'payload' });
    const verdict = validateIpcEnvelope(envelope, channel);
    assert.equal(verdict.ok, true, `${channel}: ${JSON.stringify(verdict)}`);
  }
});

test('a bridge-shaped dispatch refuses unframed payloads before interpretation', () => {
  const dispatchLog = [];
  const fakeHandler = (request) => {
    const verdict = validateIpcEnvelope(request, 'ui:command-bridge');
    if (!verdict.ok) return { ok: false, reason: verdict.code };
    dispatchLog.push(request.commandId);
    return { ok: true };
  };
  const legacy = { route: 'command.bus', commandId: 'cmd.project.new', payload: {} };
  assert.equal(fakeHandler(legacy).ok, false);
  assert.equal(dispatchLog.length, 0, 'unframed request never reaches interpretation');
  const framed = createEnvelope('ui:command-bridge', 'cmd.project.new', {});
  assert.equal(fakeHandler(framed).ok, true);
  assert.deepEqual(dispatchLog, ['cmd.project.new']);
});

test('timeout discards a late bridge result even when the invoke eventually resolves', async () => {
  const order = [];
  const invoke = () => new Promise((resolve) => setTimeout(() => {
    order.push('late-resolve');
    resolve({ ok: true });
  }, 50));
  await assert.rejects(
    withTimeoutBudget(invoke, { timeoutMs: 10, correlationId: 'corr-x' }),
    (e) => e.code === 'E_BRIDGE_TIMEOUT',
  );
  order.push('caller-moved-on');
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(order, ['caller-moved-on', 'late-resolve'], 'late result applied after caller moved on is discarded');
});

test('full denominator: every preload send to the three bridges is framed by createEnvelope', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'preload.js'), 'utf8');
  const sends = preload.match(/ipcRenderer\.invoke\((UI_COMMAND_BRIDGE_CHANNEL|WORKSPACE_QUERY_BRIDGE_CHANNEL|SAVE_LIFECYCLE_SIGNAL_BRIDGE_CHANNEL)/g) || [];
  assert.ok(sends.length >= 5, `expected >=5 bridge sends, got ${sends.length}`);
  const framed = preload.match(/ipcRenderer\.invoke\((UI_COMMAND_BRIDGE_CHANNEL|WORKSPACE_QUERY_BRIDGE_CHANNEL|SAVE_LIFECYCLE_SIGNAL_BRIDGE_CHANNEL), envelope/g) || [];
  const framedDirect = preload.match(/ipcRenderer\.invoke\(SAVE_LIFECYCLE_SIGNAL_BRIDGE_CHANNEL, createEnvelope/g) || [];
  assert.equal(sends.length, framed.length + framedDirect.length, `unframed bridge sends: ${sends.length - framed.length - framedDirect.length}`);
  assert.ok(preload.includes("require('./core/ipc-envelope-v1.cjs')"));
});

test('sandboxed runtime preload is self-contained and preserves the envelope contract', async () => {
  const root = path.join(__dirname, '..', '..');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const bundlePath = path.join(root, 'src', 'preload.bundle.cjs');
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  const requireCalls = [];
  const invokes = [];
  let exposed = null;
  const context = {
    Buffer,
    Date,
    Math,
    Promise,
    clearTimeout,
    console,
    module: { exports: {} },
    exports: {},
    require(specifier) {
      requireCalls.push(specifier);
      if (specifier !== 'electron') throw new Error(`SANDBOX_PRELOAD_REQUIRE_FORBIDDEN:${specifier}`);
      return {
        contextBridge: {
          exposeInMainWorld(name, value) {
            assert.equal(name, 'electronAPI');
            exposed = value;
          },
        },
        ipcRenderer: {
          invoke(channel, envelope) {
            invokes.push({ channel, envelope });
            return Promise.resolve({ ok: true });
          },
          on() {},
          send() {},
        },
      };
    },
    setTimeout,
  };
  vm.runInNewContext(bundle, context, { filename: bundlePath });

  assert.deepEqual(requireCalls, ['electron']);
  assert.ok(exposed && typeof exposed.invokeWorkspaceQueryBridge === 'function');
  await exposed.invokeWorkspaceQueryBridge({ queryId: 'query.projectTree', payload: { tab: 'roman' } });
  assert.equal(invokes.length, 1);
  assert.equal(invokes[0].channel, 'ui:workspace-query-bridge');
  assert.equal(validateIpcEnvelope(invokes[0].envelope, invokes[0].channel).ok, true);
  assert.match(main, /preload:\s*path\.join\(__dirname, 'preload\.bundle\.cjs'\)/u);
  assert.match(main, /contextIsolation:\s*true,\s*\n\s*sandbox:\s*true/u);
});

test('full denominator: all three main-side bridge handlers validate the envelope first', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'main.js'), 'utf8');
  for (const channel of CHANNELS) {
    const handlerIdx = main.indexOf(`guardedProtocolHandle('${channel}'`);
    assert.ok(handlerIdx !== -1, channel);
    const validateIdx = main.indexOf(`validateIpcEnvelope(request, '${channel}')`, handlerIdx);
    assert.ok(validateIdx !== -1 && validateIdx - handlerIdx < 400, `envelope validation must head the handler: ${channel}`);
  }
});

test('envelope validation cost stays bounded on adversarial payloads', () => {
  const hostile = framedHostile();
  function framedHostile() {
    const payload = {};
    let cursor = payload;
    for (let i = 0; i < 7; i += 1) {
      cursor.children = [];
      for (let j = 0; j < 30; j += 1) cursor.children.push({ value: `x${j}` });
      cursor = cursor.children[0];
    }
    return createEnvelope('ui:command-bridge', 'cmd.project.new', payload);
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < 200; i += 1) validateIpcEnvelope(hostile, 'ui:command-bridge');
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(elapsedMs < 500, `200 hostile validations took ${elapsedMs.toFixed(1)}ms`);
});

// Execute the complete authored and compiled preload, with only clock/IPC adapters controlled.
const WORD_PREVIEW_COMMAND = 'cmd.project.review.openDocxReviewPreviewSession';
const waitFlush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
function waitFixture(kind) {
  const root = path.join(__dirname, '..', '..'), calls = [], timers = new Map(), scheduled = [];
  let now = 0, next = 0, api, context, core;
  const electron = { contextBridge: { exposeInMainWorld(name, value) {
    assert.equal(name, 'electronAPI'); api = value;
  } }, ipcRenderer: { on() {}, send() {}, invoke(channel, envelope) {
    return new Promise((resolve, reject) => calls.push({ channel, envelope, resolve, reject }));
  } } };
  context = vm.createContext({ Buffer, Date, Math, Promise, console, module: { exports: {} }, exports: {},
    setTimeout(fn, ms) { const id = ++next; timers.set(id, { fn, at: now + ms }); scheduled.push({ id, ms, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(specifier) {
      if (specifier === 'electron') return electron;
      assert.equal(kind, 'source'); assert.equal(specifier, './core/ipc-envelope-v1.cjs');
      if (!core) {
        const module = { exports: {} }, filename = path.join(root, 'src/core/ipc-envelope-v1.cjs');
        vm.runInContext(`(function(module, exports) {\n${fs.readFileSync(filename, 'utf8')}\n})`, context, { filename })(module, module.exports);
        core = module.exports;
      }
      return core;
    },
  });
  const filename = path.join(root, kind === 'source' ? 'src/preload.js' : 'src/preload.bundle.cjs');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const internal = vm.runInContext('invokeUiCommand', context);
  return { api, calls, timers, scheduled,
    command(alias, commandId, payload = {}, hints = {}) {
      return alias === 'internal' ? internal(commandId, payload) : api.invokeUiCommandBridge({ ...hints, commandId, payload });
    },
    async advance(ms) {
      const target = now + ms; await waitFlush();
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        now = due[1].at; timers.delete(due[0]); due[1].fn(); await waitFlush();
      }
      now = target; await waitFlush();
    },
  };
}
function waitObserve(promise) {
  const state = { status: 'pending' };
  promise.then(value => Object.assign(state, { status: 'fulfilled', value }),
    error => Object.assign(state, { status: 'rejected', error: { code: error.code, message: error.message } }));
  return state;
}
function waitRecord(name, rows) {
  const dir = process.env.YALKEN_PRELOAD_WORD_WAIT_EVIDENCE_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`, { flag: 'wx' });
}
const waitSnapshot = state => JSON.parse(JSON.stringify(state));
const waitCalls = fixture => fixture.calls.map(({ channel, envelope }) => ({ channel, envelope }));

test('native Word waiter: delayed Cancel survives the old deadline through both preload paths', async () => {
  const rows = [];
  for (const kind of ['bundle', 'source']) for (const alias of ['bridge', 'internal']) {
    const f = waitFixture(kind), payload = { requestId: `delayed-${kind}-${alias}` };
    const state = waitObserve(f.command(alias, WORD_PREVIEW_COMMAND, payload));
    await f.advance(120000); const atOldDeadline = waitSnapshot(state);
    await f.advance(479999); const beforeDeadline = waitSnapshot(state);
    const reply = { ok: true, commandId: WORD_PREVIEW_COMMAND, requestId: payload.requestId,
      noteProductPath: { status: 'cancelled', code: 'NOTE_RETURN_APPLY_CANCELLED', pendingProductApplyLane: false } };
    f.calls[0].resolve(reply); await waitFlush();
    rows.push({ kind, alias, payload, reply, scheduled: f.scheduled, atOldDeadline, beforeDeadline,
      result: waitSnapshot(state), sameReply: state.value === reply, calls: waitCalls(f), timers: f.timers.size });
  }
  waitRecord('delayed-cancel', rows);
  for (const row of rows) {
    assert.equal(row.atOldDeadline.status, 'pending', `${row.kind}/${row.alias}: native decision may outlive120s`);
    assert.equal(row.beforeDeadline.status, 'pending'); assert.equal(row.sameReply, true);
    assert.deepEqual(row.result.value, row.reply); assert.equal(row.calls.length, 1); assert.equal(row.timers, 0);
    assert.equal(validateIpcEnvelope(row.calls[0].envelope, row.calls[0].channel).ok, true);
  }
});

test('native Word waiter: finite exact deadline rejects and discards both late outcomes without redispatch', async () => {
  const rows = [];
  for (const kind of ['source', 'bundle']) for (const alias of ['bridge', 'internal']) for (const late of ['resolve', 'reject'])
    for (const timeoutMs of [1, 120000, Number.MAX_SAFE_INTEGER]) {
    const f = waitFixture(kind), state = waitObserve(f.command(alias, WORD_PREVIEW_COMMAND, { timeoutMs }, { timeoutMs }));
    await f.advance(599999); const before = waitSnapshot(state);
    await f.advance(1); const expired = waitSnapshot(state);
    f.calls[0][late](late === 'resolve' ? { ok: true, forbiddenLateReply: true } : Error('late failure'));
    await waitFlush(); await f.advance(600000);
    rows.push({ kind, alias, late, timeoutMs, scheduled: f.scheduled, before, expired, after: waitSnapshot(state),
      calls: waitCalls(f), timers: f.timers.size });
  }
  waitRecord('finite-boundary-and-late', rows);
  for (const row of rows) {
    assert.equal(row.scheduled[0].ms, 600000);
    assert.equal(row.before.status, 'pending', `${row.kind}/${row.alias}: exact600s allowance`);
    assert.equal(row.expired.status, 'rejected'); assert.equal(row.expired.error.code, 'E_BRIDGE_TIMEOUT');
    assert.equal(row.expired.error.message, `E_BRIDGE_TIMEOUT: ${row.calls[0].envelope.correlationId}`);
    assert.deepEqual(row.after, row.expired); assert.equal(row.calls.length, 1); assert.equal(row.timers, 0);
  }
});

test('native Word waiter: exact identity only, caller hints cannot change command or query deadlines', async () => {
  const rows = [], otherDocx = ['cmd.project.export.docxMin', 'cmd.project.docx.previewContent',
    'cmd.project.docx.previewImportPlan', 'cmd.project.docx.importSafeCreate', 'cmd.project.docx.previewLocalFile',
    'cmd.project.review.exportDocxReviewPacket', 'cmd.project.review.exportFullManuscriptDocxReviewPacket',
    'cmd.project.review.inspectDocxIntakeGate', 'cmd.project.review.inspectDocxReviewPreflight',
    'cmd.project.review.activateDocxReviewPreviewSession'];
  for (const kind of ['source', 'bundle']) for (const alias of ['bridge', 'internal']) {
    for (const commandId of [...otherDocx, 'cmd.project.save', `${WORD_PREVIEW_COMMAND} `, WORD_PREVIEW_COMMAND.toUpperCase(),
      `${WORD_PREVIEW_COMMAND}.extra`, '', null, 7, { toString() { throw Error('must not coerce identity'); } }]) {
      const f = waitFixture(kind), payload = { timeoutMs: 600000, commandId: WORD_PREVIEW_COMMAND };
      const state = waitObserve(f.command(alias, commandId, payload, { timeoutMs: 600000, route: 'forged' }));
      await f.advance(119999); const before = waitSnapshot(state); await f.advance(1);
      rows.push({ kind, alias, commandId, scheduled: f.scheduled, before, state: waitSnapshot(state), calls: waitCalls(f) });
    }
    for (const send of [f => f.api.invokeWorkspaceQueryBridge({ queryId: WORD_PREVIEW_COMMAND, payload: { timeoutMs: 600000 }, timeoutMs: 600000 }),
      f => f.api.getProjectTree('roman'), f => f.api.getProjectLibrary({ timeoutMs: 600000 })]) {
      const f = waitFixture(kind), state = waitObserve(send(f));
      await f.advance(29999); const before = waitSnapshot(state); await f.advance(1);
      rows.push({ kind, alias: 'query', scheduled: f.scheduled, before, state: waitSnapshot(state), calls: waitCalls(f) });
    }
  }
  waitRecord('closed-policy-defaults', rows);
  for (const row of rows) {
    assert.equal(row.scheduled[0].ms, row.alias === 'query' ? 30000 : 120000);
    assert.equal(row.before.status, 'pending'); assert.equal(row.state.error.code, 'E_BRIDGE_TIMEOUT'); assert.equal(row.calls.length, 1);
    const envelope = row.calls[0].envelope;
    assert.equal(Object.hasOwn(envelope, 'timeoutMs'), false);
    if (row.alias !== 'query') { assert.equal(envelope.route, 'command.bus');
      assert.equal(envelope.commandId, typeof row.commandId === 'string' ? row.commandId : ''); }
  }
});

test('native Word waiter: concurrent correlations, invoke errors and existing signal lifecycle stay independent', async () => {
  const rows = [];
  for (const kind of ['source', 'bundle']) {
    const f = waitFixture(kind), first = waitObserve(f.command('bridge', WORD_PREVIEW_COMMAND, { requestId: 'first' }));
    const second = waitObserve(f.command('internal', WORD_PREVIEW_COMMAND, { requestId: 'second' }));
    const failed = waitObserve(f.command('bridge', WORD_PREVIEW_COMMAND, { requestId: 'failed' }));
    await waitFlush(); const error = Object.assign(Error('actual invoke rejected'), { code: 'E_INVOKE_TEST' });
    const reply = { ok: true, requestId: 'second', activated: false, cancelled: true };
    f.calls[1].resolve(reply); f.calls[2].reject(error); await waitFlush();
    const whileFirstPending = waitSnapshot(first);
    await f.advance(600000); const expired = waitSnapshot(first);
    f.calls[0].resolve({ ok: true, requestId: 'first', late: true }); await waitFlush();
    const signal = waitObserve(f.api.invokeSaveLifecycleSignalBridge({ signalId: 'signal.autoSave.request', payload: {} }));
    await f.advance(600001); const signalPending = waitSnapshot(signal);
    f.calls[3].resolve({ ok: true, signalObserved: true }); await waitFlush();
    rows.push({ kind, reply, first: waitSnapshot(first), expired, second: waitSnapshot(second), failed: waitSnapshot(failed),
      whileFirstPending, signalPending, signal: waitSnapshot(signal), sameReply: second.value === reply,
      calls: waitCalls(f), scheduled: f.scheduled, timers: f.timers.size });
  }
  waitRecord('correlation-error-and-signal', rows);
  for (const row of rows) {
    assert.equal(new Set(row.calls.map(call => call.envelope.correlationId)).size, 4);
    assert.equal(row.whileFirstPending.status, 'pending'); assert.equal(row.sameReply, true);
    assert.deepEqual(row.second.value, row.reply); assert.equal(row.failed.error.code, 'E_INVOKE_TEST');
    assert.equal(row.expired.error.code, 'E_BRIDGE_TIMEOUT'); assert.deepEqual(row.first, row.expired);
    assert.equal(row.signalPending.status, 'pending'); assert.equal(row.signal.value.signalObserved, true);
    assert.equal(row.scheduled.length, 3); assert.equal(row.calls.length, 4); assert.equal(row.timers, 0);
  }
});

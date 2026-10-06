'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { confirmWordReturn } = require('../../src/main/wordReturnConfirmation.cjs');

function fixture(overrides = {}) {
  const windows = [];
  class Contents extends EventEmitter {
    constructor() {
      super(); this.mainFrame = {}; this.url = ''; this.destroyed = false; this.unhandleCalls = 0;
      this.session = { protocol: {
        handle: (scheme, handler) => {
          if (overrides.registrationFailure) throw Error('registration failure');
          this.handledScheme = scheme; this.protocolHandler = handler;
        },
        unhandle: scheme => {
          this.unhandleCalls++; assert.equal(scheme, this.handledScheme);
          assert.equal(this.owner.isDestroyed(), true, 'release private protocol only after destroying owned child');
          if (overrides.cleanupFailure) throw Error('cleanup failure');
        },
      } };
      if (overrides.protocolMissing) this.session = {};
    }
    isDestroyed() { return this.destroyed; }
    getURL() { return this.url; }
    setWindowOpenHandler(handler) { this.openHandler = handler; }
  }
  const parent = new EventEmitter();
  parent.webContents = new Contents();
  parent.destroyed = false;
  parent.isDestroyed = () => parent.destroyed;
  parent.getBounds = () => overrides.parentBounds || { x: 120, y: 100, width: 1000, height: 800 };
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.webContents = new Contents();
      this.webContents.owner = this;
      this.parent = options.parent; this.destroyed = false; this.destroyCalls = 0;
      this.showCalls = 0; this.focusCalls = 0; windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    getParentWindow() { return this.parent; }
    removeMenu() { this.menuRemoved = true; }
    destroy() { this.destroyCalls++; this.destroyed = true; this.emit('closed'); }
    show() { if (overrides.showFailure) throw Error('show failure'); this.showCalls++; }
    focus() { this.focusCalls++; }
    loadURL(url) {
      assert.equal(this.webContents.handledScheme, 'word-return-choice');
      this.loadedUrl = url;
      this.webContents.emit('did-start-navigation', { url, isMainFrame: true, isSameDocument: false });
      this.webContents.url = url;
      this.webContents.emit('did-navigate', {}, url);
      return overrides.loadFailure ? Promise.reject(Error('load failure')) : Promise.resolve();
    }
  }
  const screen = { getDisplayMatching: () => ({ workArea: overrides.area || { x: 0, y: 0, width: 1440, height: 900 } }) };
  const request = { parent, title: 'Исправления из Word', message: 'Применить возврат?', detail: 'Полное изменение' };
  const run = (fields = {}) => confirmWordReturn({ ...request, ...fields }, { BrowserWindow, screen });
  const ready = () => windows[0].webContents.emit('did-finish-load');
  const html = () => decodeURIComponent(windows[0].loadedUrl.split(',').slice(1).join(','));
  const responseUrl = (response = 'apply') => `word-return-choice://confirm?token=${html().match(/name="token" value="([a-f0-9]{64})"/u)[1]}&response=${response}`;
  const navigate = (fields = {}, contents = windows[0].webContents) => {
    const event = { url: responseUrl(), isMainFrame: true, isSameDocument: false,
      frame: contents.mainFrame, initiator: contents.mainFrame, prevented: false,
      preventDefault() { this.prevented = true; }, ...fields };
    contents.emit('will-frame-navigate', event);
    return event;
  };
  return { windows, parent, screen, BrowserWindow, request, run, ready, html, responseUrl, navigate };
}

function decodedText(value) {
  // Independent readback of the text-node character references in static HTML.
  return value.replace(/&(amp|lt|gt|quot|#39|#13);/gu, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#13': '\r' })[name]);
}

test('fixed choice handler accepts trusted Cancel and Apply only and contains no display payload', async () => {
  const f = fixture(), result = f.run({ detail: '<script>payload()</script>' }), html = f.html();
  const script = html.match(/<script>([\s\S]*?)<\/script>/u)[1];
  let submit, token = 'a'.repeat(64);
  const navigations = [];
  const form = {
    addEventListener(name, listener) { assert.equal(name, 'submit'); submit = listener; },
    elements: { namedItem(name) { assert.equal(name, 'token'); return { value: token }; } },
  };
  const context = vm.createContext({ document: { querySelector(selector) { assert.equal(selector, 'form'); return form; } },
    window: { location: { assign(url) { navigations.push(url); } } } });
  vm.runInContext(script, context);
  const send = (value, isTrusted = true) => {
    const event = { isTrusted, submitter: { value }, prevented: false, preventDefault() { this.prevented = true; } };
    submit(event); assert.equal(event.prevented, true);
  };
  send('apply', false); send('cancel', false); send('accept'); send('apply&payload=secret');
  assert.deepEqual(navigations, []);
  send('cancel'); send('apply');
  assert.deepEqual(navigations, [`word-return-choice://confirm?token=${token}&response=cancel`, `word-return-choice://confirm?token=${token}&response=apply`]);
  token = 'wrong'; send('apply'); assert.equal(navigations.length, 2);
  assert.ok(!script.includes('payload()'));
  const other = fixture(), otherResult = other.run({ title: 'Different title', detail: 'Different full content' });
  assert.equal(other.html().match(/<script>([\s\S]*?)<\/script>/u)[1], script);
  f.parent.emit('close'); other.parent.emit('close');
  assert.equal(await result, false); assert.equal(await otherResult, false);
});

test('full 32000-unit multiline preview escapes all text without losing the final character or growing geometry', async () => {
  const f = fixture();
  const prefix = '<script>steal()</script><img src="https://invalid.example/">&\'\r\n';
  const detail = prefix + '\n'.repeat(32000 - prefix.length - 4) + '尾END';
  assert.equal(detail.length, 32000);
  const result = f.run({ title: '<Title>&\'"', message: 'Message <>&\r\n', detail });
  const child = f.windows[0], html = f.html();
  const detailHtml = html.match(/<div id="detail"[^>]*>([\s\S]*?)<\/div>/u)[1];
  assert.equal(decodedText(detailHtml), detail);
  assert.equal(decodedText(html.match(/<h1 id="title">([\s\S]*?)<\/h1>/u)[1]), '<Title>&\'"');
  assert.equal(decodedText(html.match(/<p id="message">([\s\S]*?)<\/p>/u)[1]), 'Message <>&\r\n');
  assert.doesNotMatch(detailHtml, /<script|<img|<iframe|<webview|onclick=/iu);
  assert.equal(child.options.width, 760); assert.equal(child.options.height, 640);
  assert.equal(child.showCalls, 0);
  f.ready(); assert.equal(child.showCalls, 1); assert.equal(child.focusCalls, 1);
  assert.equal(f.navigate({ url: f.responseUrl('cancel') }).prevented, true);
  assert.equal(await result, false); assert.equal(child.destroyCalls, 1);
});

test('sandbox, fixed hashed choice script and CSS, persistent controls and native Cancel autofocus are explicit', async () => {
  const f = fixture(), result = f.run(), child = f.windows[0], html = f.html();
  assert.equal(child.options.parent, f.parent);
  for (const key of ['modal', 'autoHideMenuBar']) assert.equal(child.options[key], true);
  for (const key of ['show', 'resizable', 'maximizable', 'minimizable', 'fullscreenable', 'useContentSize']) assert.equal(child.options[key], false);
  const preferences = child.options.webPreferences;
  for (const key of ['sandbox', 'contextIsolation', 'webSecurity', 'javascript']) assert.equal(preferences[key], true);
  for (const key of ['nodeIntegration', 'nodeIntegrationInSubFrames', 'webviewTag', 'devTools', 'allowRunningInsecureContent', 'navigateOnDragDrop']) assert.equal(preferences[key], false);
  assert.equal(Object.hasOwn(preferences, 'preload'), false);
  assert.ok(!preferences.partition.startsWith('persist:')); assert.equal(child.menuRemoved, true);
  assert.match(html, /default-src 'none'; script-src 'sha256-[A-Za-z0-9+/=]+'/u);
  assert.match(html, /connect-src 'none'/u); assert.match(html, /form-action 'none'/u);
  const script = html.match(/<script>([\s\S]*?)<\/script>/u)[1];
  assert.ok(html.includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`));
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|<script\s+[^>]*src=|on(?:click|submit)=/iu);
  const style = html.match(/<style>([\s\S]*?)<\/style>/u)[1];
  assert.ok(html.includes(`style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'`));
  assert.match(style, /#detail \{[^}]*min-height: 0; overflow: auto;[^}]*overflow-wrap: anywhere/u);
  assert.match(style, /form \{ flex: 0 0 auto/u); assert.match(style, /min-height: 44px/u);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="title" aria-describedby="message"/u);
  assert.match(html, /role="region" aria-label="Перечень изменений" tabindex="0"/u);
  assert.match(html, /<\/div><form action="word-return-choice:\/\/confirm" method="get">/u);
  assert.match(html, /name="response" value="cancel" autofocus>Отмена/u);
  assert.match(html, /name="response" value="apply">Применить/u);
  f.parent.emit('close'); assert.equal(await result, false);
});

test('geometry clamps to the parent display workarea independently of long unbroken tokens', async () => {
  const f = fixture({ area: { x: -500, y: 30, width: 510, height: 410 }, parentBounds: { x: -1200, y: 900, width: 300, height: 300 } });
  const result = f.run({ detail: 'x'.repeat(32000) }), options = f.windows[0].options;
  assert.deepEqual({ x: options.x, y: options.y, width: options.width, height: options.height }, { x: -484, y: 46, width: 478, height: 378 });
  f.parent.emit('closed'); assert.equal(await result, false);
});

for (const area of [null, { x: 0, y: 0, width: 351, height: 600 }, { x: 0, y: 0, width: 600, height: 271 }, { x: NaN, y: 0, width: 600, height: 600 }]) {
  test(`unusable display cancels before window construction: ${JSON.stringify(area)}`, async () => {
    const f = fixture(); f.screen.getDisplayMatching = () => ({ workArea: area });
    assert.equal(await f.run(), false); assert.equal(f.windows.length, 0);
  });
}

test('strict text bounds and own data properties are validated before any window', async () => {
  const f = fixture(); let reads = 0;
  const malformed = [null, {}, { ...f.request, title: '' }, { ...f.request, detail: 'bad\0text' },
    { ...f.request, detail: '\ud800' }, { ...f.request, message: 4 }, Object.create(f.request)];
  const getter = { ...f.request }; Object.defineProperty(getter, 'detail', { get() { reads++; return 'text'; } });
  malformed.push(getter);
  for (const request of malformed) await assert.rejects(confirmWordReturn(request, f), /PREVIEW_INVALID/u);
  for (const [key, length] of [['title', 257], ['message', 1025], ['detail', 32001]]) {
    await assert.rejects(f.run({ [key]: 'x'.repeat(length) }), /PREVIEW_BUDGET/u);
  }
  assert.equal(reads, 0); assert.equal(f.windows.length, 0);
});

test('only loaded owned main-frame nonce-bound explicit Apply confirms once and carries no payload or path', async () => {
  const f = fixture(), result = f.run(); f.ready();
  assert.match(f.responseUrl(), /^word-return-choice:\/\/confirm\?token=[a-f0-9]{64}&response=apply$/u);
  const event = f.navigate(); assert.equal(event.prevented, true); assert.equal(await result, true);
  f.navigate({ url: f.responseUrl('cancel') }); f.navigate();
  assert.equal(await result, true); assert.equal(f.windows[0].destroyCalls, 1);
  assert.equal(f.windows[0].webContents.unhandleCalls, 1);
  for (const name of ['close', 'closed']) assert.equal(f.parent.listenerCount(name), 0);
  for (const name of ['destroyed', 'render-process-gone']) assert.equal(f.parent.webContents.listenerCount(name), 0);
});

test('owned local choice start precedes will-frame but never grants Apply authority', async () => {
  const f = fixture(), result = f.run(); f.ready();
  const contents = f.windows[0].webContents;
  contents.emit('did-start-navigation', { url: f.responseUrl(), isMainFrame: true, isSameDocument: false });
  assert.equal(f.windows[0].destroyCalls, 0);
  assert.equal(f.navigate().prevented, true); assert.equal(await result, true);
});

test('missed local interception falls back to an empty rejecting response and cancellation', async () => {
  const f = fixture(), result = f.run(); f.ready();
  const response = f.windows[0].webContents.protocolHandler({ url: f.responseUrl() });
  assert.equal(response.status, 403); assert.equal(await response.text(), '');
  assert.equal(await result, false); assert.equal(f.windows[0].webContents.unhandleCalls, 1);
});

for (const kind of ['protocolMissing', 'registrationFailure', 'cleanupFailure']) {
  test(`private protocol failure cancels: ${kind}`, async () => {
    const f = fixture({ [kind]: true }), result = f.run();
    if (kind === 'cleanupFailure') { f.ready(); f.navigate(); }
    else assert.equal(f.windows[0].loadedUrl, undefined);
    assert.equal(await result, false); assert.equal(f.windows[0].destroyCalls, 1);
  });
}

for (const kind of ['unexpectedStart', 'specialAboutStart', 'subframeStart', 'sameDocumentStart', 'completedChoice', 'completedReload', 'wrongInitialCompletion']) {
  test(`unintercepted or unexpected navigation cancels: ${kind}`, async () => {
    const f = fixture(), result = f.run(), contents = f.windows[0].webContents;
    if (kind !== 'wrongInitialCompletion') f.ready();
    if (kind.startsWith('completed') || kind === 'wrongInitialCompletion') {
      contents.emit('did-navigate', {}, kind === 'completedReload' ? f.windows[0].loadedUrl : f.responseUrl());
    } else {
      contents.emit('did-start-navigation', { url: kind === 'unexpectedStart' ? 'https://invalid.example/'
        : kind === 'specialAboutStart' ? 'about:blank#forged' : f.responseUrl(),
      isMainFrame: kind !== 'subframeStart', isSameDocument: kind === 'sameDocumentStart' });
    }
    assert.equal(await result, false); assert.equal(f.windows[0].destroyCalls, 1);
  });
}

for (const kind of ['token', 'response', 'wrongHost', 'extraPayload', 'external', 'subframe', 'sameDocument', 'frame', 'initiator', 'nullInitiator', 'beforeLoad', 'source', 'parent', 'parentContents', 'childContents', 'changedMainFrame', 'session']) {
  test(`forged or stale navigation cannot confirm: ${kind}`, async () => {
    const f = fixture(), result = f.run(), child = f.windows[0], contents = child.webContents;
    if (kind !== 'beforeLoad') f.ready();
    const fields = {};
    if (kind === 'token') fields.url = f.responseUrl().replace(/token=[a-f0-9]+/u, 'token=wrong');
    if (kind === 'response') fields.url = f.responseUrl('accept');
    if (kind === 'wrongHost') fields.url = f.responseUrl().replace('://confirm?', '://other?');
    if (kind === 'extraPayload') fields.url = f.responseUrl() + '&path=%2Ftmp%2Fmanuscript';
    if (kind === 'external') fields.url = 'https://invalid.example/';
    if (kind === 'subframe') fields.isMainFrame = false;
    if (kind === 'sameDocument') fields.isSameDocument = true;
    if (kind === 'frame') fields.frame = {};
    if (kind === 'initiator') fields.initiator = {};
    if (kind === 'nullInitiator') fields.initiator = null;
    if (kind === 'source') child.webContents.url = 'about:blank';
    if (kind === 'parent') child.parent = {};
    if (kind === 'parentContents') f.parent.webContents = { isDestroyed: () => false };
    if (kind === 'childContents') child.webContents = { isDestroyed: () => false };
    if (kind === 'changedMainFrame') child.webContents.mainFrame = {};
    if (kind === 'session') child.webContents.session = {};
    assert.equal(f.navigate(fields,contents).prevented, true); assert.equal(await result, false); assert.equal(child.destroyCalls, 1);
  });
}

for (const [target, event] of [['child', 'close'], ['child', 'closed'], ['child', 'unresponsive'],
  ['contents', 'destroyed'], ['contents', 'render-process-gone'], ['contents', 'did-fail-load'], ['contents', 'did-navigate-in-page'],
  ['parent', 'close'], ['parent', 'closed'], ['parentContents', 'destroyed'], ['parentContents', 'render-process-gone']]) {
  test(`lifecycle cancellation: ${target} ${event}`, async () => {
    const f = fixture(), result = f.run(); f.ready();
    ({ child: f.windows[0], contents: f.windows[0].webContents, parent: f.parent, parentContents: f.parent.webContents })[target].emit(event);
    assert.equal(await result, false); assert.equal(f.windows[0].destroyCalls, 1);
  });
}

test('already destroyed parent or missing adapter cancels without constructing a window', async () => {
  for (const kind of ['parent', 'contents', 'adapter']) {
    const f = fixture();
    if (kind === 'parent') f.parent.destroyed = true;
    if (kind === 'contents') f.parent.webContents.destroyed = true;
    assert.equal(await confirmWordReturn(f.request, kind === 'adapter' ? {} : f), false);
    assert.equal(f.windows.length, 0);
  }
});

test('a destroyed parent after load prevents an otherwise valid Apply', async () => {
  const f = fixture(), result = f.run(); f.ready(); f.parent.destroyed = true;
  assert.equal(f.navigate().prevented, true); assert.equal(await result, false);
});

test('load rejection, wrong loaded source and display failure cancel while hidden', async () => {
  const rejected = fixture({ loadFailure: true }), rejectedResult = rejected.run();
  assert.equal(await rejectedResult, false); assert.equal(rejected.windows[0].showCalls, 0);
  const wrong = fixture(), wrongResult = wrong.run(); wrong.windows[0].webContents.url = 'about:blank'; wrong.ready();
  assert.equal(await wrongResult, false); assert.equal(wrong.windows[0].showCalls, 0);
  const fail = fixture({ showFailure: true }), failResult = fail.run(); fail.ready();
  assert.equal(await failResult, false); assert.equal(fail.windows[0].focusCalls, 0);
});

for (const eventName of ['will-redirect', 'will-attach-webview', 'will-navigate']) {
  test(`unexpected navigation or attachment is prevented: ${eventName}`, async () => {
    const f = fixture(), result = f.run(); f.ready();
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    f.windows[0].webContents.emit(eventName, event);
    assert.equal(event.prevented, true); assert.equal(await result, false);
  });
}

test('new windows are denied and Escape cancels; Tab and Enter retain native control behavior', async () => {
  const popup = fixture(), popupResult = popup.run(); popup.ready();
  assert.deepEqual(popup.windows[0].webContents.openHandler({ url: 'https://invalid.example/' }), { action: 'deny' });
  assert.equal(await popupResult, false);
  const f = fixture(), result = f.run(); f.ready();
  for (const key of ['Tab', 'Enter']) {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    f.windows[0].webContents.emit('before-input-event', event, { key, type: 'keyDown' });
    assert.equal(event.prevented, false); assert.equal(f.windows[0].destroyCalls, 0);
  }
  const escape = { prevented: false, preventDefault() { this.prevented = true; } };
  f.windows[0].webContents.emit('before-input-event', escape, { key: 'Escape', type: 'keyDown' });
  assert.equal(escape.prevented, true); assert.equal(await result, false);
});

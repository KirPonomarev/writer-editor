const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = process.cwd();
const CONFIG_V2_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const CONTEXT_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'menu', 'context.default.json');
const NORMALIZER_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-normalizer.js');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getViewMenu(config) {
  return config.menus.find((menu) => menu && menu.id === 'view');
}

function extractFunctionSource(sourceText, functionName) {
  const start = sourceText.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `missing function ${functionName}`);

  let bodyStart = -1;
  let depth = 0;
  for (let index = start; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (char === '{') {
      if (bodyStart === -1) {
        bodyStart = index;
      }
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (bodyStart !== -1 && depth === 0) {
        return sourceText.slice(start, index + 1);
      }
    }
  }

  throw new Error(`unterminated function source for ${functionName}`);
}

test('menu presentation modes: canonical switch surface is authored in view menu at the required location', () => {
  const config = readJson(CONFIG_V2_PATH);
  const viewMenu = getViewMenu(config);
  assert.ok(viewMenu, 'expected view menu in canonical config');

  const itemIds = viewMenu.items.map((item) => item.id);
  assert.deepEqual(
    itemIds.slice(0, 5),
    [
      'view-settings',
      'view-presentation-mode',
      'view-language',
      'view-menu-customization',
      'view-safe-reset',
    ],
    'presentation switch container must leave room for the bounded customization surface before safe reset',
  );

  const switchContainer = viewMenu.items.find((item) => item.id === 'view-presentation-mode');
  assert.ok(switchContainer, 'expected view-presentation-mode container');
  assert.equal(switchContainer.label, 'Presentation Mode');
  assert.deepEqual(
    (switchContainer.items || []).map((item) => ({
      id: item.id,
      command: item.command,
    })),
    [
      {
        id: 'view-presentation-classic',
        command: 'cmd.project.view.setMenuPresentationClassic',
      },
      {
        id: 'view-presentation-compact',
        command: 'cmd.project.view.setMenuPresentationCompact',
      },
    ],
  );
});

test('menu presentation modes: normalization preserves canonical placement and nested switch order', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = readJson(CONFIG_V2_PATH);
  const context = readJson(CONTEXT_PATH);

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays: [],
    context,
    baseSourceRef: CONFIG_V2_PATH,
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));

  const viewMenu = state.normalizedConfig.menus.find((menu) => menu && menu.id === 'view');
  assert.ok(viewMenu, 'expected normalized view menu');

  const normalizedItemIds = viewMenu.items.map((item) => item.id);
  assert.deepEqual(
    normalizedItemIds.slice(0, 5),
    [
      'view-settings',
      'view-presentation-mode',
      'view-language',
      'view-menu-customization',
      'view-safe-reset',
    ],
    'normalized view order must preserve canonical placement of presentation switch container ahead of bounded customization and safe reset',
  );

  const switchContainer = viewMenu.items.find((item) => item.id === 'view-presentation-mode');
  assert.ok(switchContainer, 'expected normalized presentation switch container');
  assert.deepEqual(
    (switchContainer.items || []).map((item) => ({
      id: item.id,
      canonicalCmdId: item.canonicalCmdId,
    })),
    [
      {
        id: 'view-presentation-classic',
        canonicalCmdId: 'cmd.project.view.setMenuPresentationClassic',
      },
      {
        id: 'view-presentation-compact',
        canonicalCmdId: 'cmd.project.view.setMenuPresentationCompact',
      },
    ],
  );
});

test('menu presentation modes: darwin compact projection preserves a visible compact root beside the platform app menu', () => {
  const mainSource = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(
    mainSource,
    /if \(process\.platform === 'darwin'\)\s*\{\s*return \[\s*\{\s*role: 'appMenu'\s*\},\s*compactRoot,\s*\];\s*\}/m,
    'compact projection must insert an explicit appMenu adapter on darwin so the compact root remains visible',
  );
});

test('menu presentation modes: compact projection dedupes duplicate id groups before build', () => {
  const mainSource = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(
    mainSource,
    /function dedupeCompactRootSubmenu\(items\)/,
    'compact projection must define a duplicate-id suppression step for compact root items',
  );
  assert.match(
    mainSource,
    /submenu:\s*dedupeCompactRootSubmenu\(compactRootSubmenu\)/,
    'compact root submenu must pass through dedupeCompactRootSubmenu before Menu.buildFromTemplate',
  );
});

test('menu presentation modes: compact projection hoists the switch container above file actions and removes the duplicate from nested view', () => {
  const mainSource = fs.readFileSync(MAIN_PATH, 'utf8');
  const runtimeSource = [
    extractFunctionSource(mainSource, 'cloneMenuTemplateItem'),
    extractFunctionSource(mainSource, 'mergeCompactDuplicateMenuItem'),
    extractFunctionSource(mainSource, 'dedupeCompactRootSubmenu'),
    extractFunctionSource(mainSource, 'extractCompactRootPinnedItems'),
    extractFunctionSource(mainSource, 'buildCompactMenuTemplate'),
    `
      result = buildCompactMenuTemplate([
        {
          id: 'file',
          label: 'Документ',
          submenu: [
            { id: 'file-open', label: 'Открыть проект…' },
            { id: 'file-save', label: 'Сохранить' },
          ],
        },
        {
          id: 'view',
          label: 'Вид',
          submenu: [
            {
              id: 'view-presentation-mode',
              label: 'Режим меню',
              submenu: [
                { id: 'view-presentation-classic', label: 'Классический' },
                { id: 'view-presentation-compact', label: 'Компактный' },
              ],
            },
            { id: 'view-language', label: 'Язык' },
            { id: 'view-menu-customization', label: 'Настройка меню' },
            { id: 'view-safe-reset', label: 'Безопасный сброс' },
          ],
        },
        {
          id: 'plan',
          label: 'План',
          submenu: [{ id: 'plan-open', label: 'Открыть план' }],
        },
      ]);
    `,
  ].join('\n\n');

  const context = {
    MENU_PRESENTATION_COMPACT_ROOT_ID: 'compact-root',
    process: { platform: 'darwin' },
    result: null,
  };
  vm.createContext(context);
  vm.runInContext(runtimeSource, context);

  const normalizedResult = JSON.parse(JSON.stringify(context.result));
  assert.deepEqual(
    normalizedResult.map((item) => item.role || item.id),
    ['appMenu', 'compact-root'],
    'darwin compact projection must keep appMenu and one visible compact root',
  );

  const compactRoot = normalizedResult[1];
  assert.deepEqual(
    compactRoot.submenu.slice(0, 4).map((item) => item.type || item.id),
    ['view-presentation-mode', 'separator', 'file-open', 'file-save'],
    'compact root must hoist the presentation switch above file actions',
  );

  const nestedView = compactRoot.submenu.find((item) => item && item.id === 'view');
  assert.ok(nestedView, 'expected nested view group to remain available in compact mode');
  assert.deepEqual(
    nestedView.submenu.map((item) => item.id),
    ['view-language', 'view-menu-customization', 'view-safe-reset'],
    'nested view group must keep adjacent view controls and must not duplicate the hoisted presentation switch',
  );
});

function normalQuitMenuContext(platform, mode) {
  const source = fs.readFileSync(MAIN_PATH, 'utf8');
  const context = vm.createContext({
    process: { platform }, currentMenuPresentationMode: mode,
    MENU_PRESENTATION_MODE_COMPACT: 'COMPACT', MENU_PRESENTATION_COMPACT_ROOT_ID: 'compact-root',
  });
  for (const name of ['cloneMenuTemplateItem', 'mergeCompactDuplicateMenuItem',
    'dedupeCompactRootSubmenu', 'extractCompactRootPinnedItems', 'buildCompactMenuTemplate',
    'applyMenuPresentation']) {
    vm.runInContext(extractFunctionSource(source, name), context);
  }
  return context;
}

test('macOS normal Quit: all presentation modes and early fallback retain exactly one appMenu', () => {
  const full = [{ id: 'file', label: 'File', submenu: [{ id: 'save', label: 'Save' }] },
    { id: 'view', label: 'View', submenu: [{ id: 'settings', label: 'Settings' }] }];
  for (const platform of ['darwin', 'win32', 'linux']) {
    for (const mode of ['CLASSIC', 'COMPACT']) {
      for (const template of [full, full.slice(1), [], [{ role: 'appMenu' }, ...full]]) {
        const before = JSON.stringify(template), context = normalQuitMenuContext(platform, mode);
        const result = context.applyMenuPresentation(template);
        const plain = JSON.parse(JSON.stringify(result));
        if (platform === 'darwin') {
          assert.equal(plain.filter(item => item.role === 'appMenu').length, 1, `${platform}/${mode}/${before}`);
          assert.equal(plain[0].role, 'appMenu');
          assert.deepEqual(JSON.parse(JSON.stringify(context.applyMenuPresentation(result))), plain,
            'repeated projection must not duplicate or nest the app menu');
          if (mode === 'CLASSIC') {
            assert.deepEqual(plain.filter(item => item.role !== 'appMenu'), template.filter(item => item.role !== 'appMenu'));
          }
        } else {
          const expected = mode === 'COMPACT' ? context.buildCompactMenuTemplate(template) : template;
          assert.deepEqual(plain, JSON.parse(JSON.stringify(expected)), 'other platforms retain their exact projection');
        }
        assert.equal(JSON.stringify(template), before, 'projection must not mutate its input');
      }
    }
  }
});

test('macOS normal Quit: installed safe fallback uses the same adapter and existing command bus', () => {
  const source = fs.readFileSync(MAIN_PATH, 'utf8');
  for (const platform of ['darwin', 'win32', 'linux']) {
    for (const mode of ['CLASSIC', 'COMPACT']) {
      const context = normalQuitMenuContext(platform, mode), calls = [];
      Object.assign(context, {
        MENU_ACCELERATOR_TOKENS: { platformQuit: 'CmdOrCtrl+Q' }, COMMAND_BUS_ROUTE: 'command.bus',
        dispatchMenuCommand: (...args) => { calls.push(args); return { ok: true }; },
        logDevError: (...args) => { throw new Error(JSON.stringify(args)); },
        Menu: { buildFromTemplate: template => template, setApplicationMenu: menu => { context.installed = menu; } },
      });
      const handlerStart = source.indexOf('function buildCommandClickHandler(');
      const handlerEnd = source.indexOf('function normalizeUiBridgeMenuResult(', handlerStart);
      assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
      vm.runInContext(source.slice(handlerStart, handlerEnd), context);
      for (const name of ['buildSafeFallbackMenuTemplate', 'applySafeFallbackMenu']) {
        vm.runInContext(extractFunctionSource(source, name), context);
      }
      context.applySafeFallbackMenu();
      assert.equal(context.installed.filter(item => item.role === 'appMenu').length, platform === 'darwin' ? 1 : 0);
      const quit = context.installed.find(item => item.id === 'safe-file').submenu[0];
      assert.equal(quit.id, 'safe-quit'); assert.equal(quit.accelerator, 'CmdOrCtrl+Q'); quit.click();
      assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['cmd.app.quit', {}, { route: 'command.bus' }]]);
    }
  }
});

test('macOS normal Quit: actual before-quit and lifecycle barrier preserve no-loss vetoes', async () => {
  const source = fs.readFileSync(MAIN_PATH, 'utf8');
  const lifecycle = require('../../src/core/lifecycle-conflict-v1.cjs');
  const start = source.indexOf("app.on('before-quit', (event) => {");
  const end = source.indexOf("app.on('window-all-closed'", start);
  assert.ok(start >= 0 && end > start);
  const draft = { content: 'unsaved Cyrillic Ж', comment: 'reply draft', private: { card: 'held' } };
  for (const failure of ['none', 'pending-comment', 'save-failed', 'at-risk', 'protected',
    'stale-generation', 'save-subject-switch', 'snapshot-subject-switch', 'pending-outbox', 'persist-failed']) {
    let subject = 'project:p/document:s', prevented = 0, quits = 0, listener;
    const before = JSON.stringify(draft);
    const context = vm.createContext({
      ...lifecycle, isQuitting: false, mainWindow: { getBounds: () => ({ x: 1, y: 2, width: 800, height: 600 }) },
      lastSignaledEditGeneration: 2, lastAcknowledgedEditGeneration: failure === 'stale-generation' ? 1 : 2,
      currentLifecycleSubjectId: () => subject, updateStatus: () => {},
      persistWindowState: async () => { if (failure === 'persist-failed') throw new Error('owned failure'); },
      autoSave: async () => {
        const subjectId = subject;
        if (failure === 'save-subject-switch') subject = 'project:other/document:s';
        const kind = failure === 'at-risk' ? 'AT_RISK' : failure === 'protected' ? 'PROTECTED' : 'SAVED';
        return { ok: failure !== 'save-failed', subjectId,
          ack: { kind, reason: kind === 'SAVED' ? '' : 'WRITE_FAILED', savedGeneration: 2, latestEditGeneration: 2 } };
      },
      requestEditorSnapshot: async () => {
        if (failure === 'snapshot-subject-switch') subject = 'project:other/document:s';
        return { ...draft, commentAuthoringPending: failure === 'pending-comment' };
      },
      app: { on: (event, handler) => { assert.equal(event, 'before-quit'); listener = handler; },
        quit: () => { quits++; listener({ preventDefault: () => { prevented++; } }); } },
    });
    if (failure === 'pending-outbox') {
      context.createDetachedOutboxObservation = input => lifecycle.createFreshOutboxObservation({ ...input,
        inboxOutbox: { replay: () => ({ schemaVersion: 'yalken.transactionalInboxOutbox.v1', outboxDigest: 'a'.repeat(64),
          effects: [{ effectId: 'e', intentId: 'i', status: 'PENDING' }] }),
        pendingEffects: () => [{ effectId: 'e', intentId: 'i', status: 'PENDING' }] } });
    }
    vm.runInContext('async ' + extractFunctionSource(source, 'confirmDiscardChanges'), context);
    vm.runInContext(source.slice(start, end), context);
    listener({ preventDefault: () => { prevented++; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(prevented, 1, failure); assert.equal(quits, failure === 'none' ? 1 : 0, failure);
    assert.equal(context.isQuitting, failure === 'none', failure);
    assert.equal(JSON.stringify(draft), before, 'ordinary Quit must never discard authoring data');
  }
});

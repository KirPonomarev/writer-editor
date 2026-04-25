const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing ${functionName}`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `Missing ${functionName} body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  assert.fail(`Unterminated ${functionName} body`);
}

function extractFunctionSource(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing ${functionName}`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `Missing ${functionName} body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  assert.fail(`Unterminated ${functionName} source`);
}

test('paste focus signal uses a narrow boolean preload bridge', () => {
  const preloadSource = read('src/preload.js');
  const editorSource = read('src/renderer/editor.js');
  const mainSource = read('src/main.js');

  assert.match(preloadSource, /const EDITOR_PASTE_FOCUS_STATE_CHANNEL = ['"]editor:paste-focus-state['"]/);
  assert.match(preloadSource, /notifyEditorPasteFocusState:\s*\(focused\)\s*=>\s*\{/);
  assert.match(preloadSource, /focused:\s*focused\s*===\s*true/);
  assert.match(preloadSource, /ipcRenderer\.send\(EDITOR_PASTE_FOCUS_STATE_CHANNEL/);

  assert.match(editorSource, /function\s+isEditorPasteTargetFocused\s*\(/);
  assert.match(editorSource, /activeElement\.closest\(['"]\.ProseMirror['"]\)/);
  assert.match(editorSource, /proseMirror\.isContentEditable/);
  assert.match(editorSource, /notifyEditorPasteFocusState\(isEditorPasteTargetFocused\(\)\)/);

  assert.match(mainSource, /const EDITOR_PASTE_FOCUS_STATE_CHANNEL = ['"]editor:paste-focus-state['"]/);
  assert.match(mainSource, /function\s+normalizeEditorPasteFocusState\s*\(/);
  assert.match(mainSource, /typeof payload\.focused !== ['"]boolean['"]/);
  assert.match(mainSource, /mainWindow\.on\(['"]blur['"]/);
});

test('main process paste handler has no renderer probe and no unguarded synthetic paste', () => {
  const mainSource = read('src/main.js');
  const handlerBody = extractFunctionBody(mainSource, 'handlePrimaryPasteShortcut');

  assert.equal(mainSource.includes('executeJavaScript'), false);
  assert.equal(mainSource.includes('focusProbeScript'), false);
  assert.doesNotMatch(handlerBody, /document\.activeElement/);
  assert.doesNotMatch(handlerBody, /\.ProseMirror/);
  assert.doesNotMatch(handlerBody, /isContentEditable/);
  assert.match(handlerBody, /isEditorPasteTargetFocused\s*!==\s*true/);
  assert.match(handlerBody, /win\.webContents\.paste\(\)/);
  assert.ok(
    handlerBody.indexOf('isEditorPasteTargetFocused !== true') < handlerBody.indexOf('win.webContents.paste()'),
    'synthetic paste must remain behind the renderer focus signal guard',
  );
  assert.doesNotMatch(handlerBody, /event\.preventDefault\(\)/);
});

test('main process paste handler behavior follows renderer focus signal', () => {
  const mainSource = read('src/main.js');
  const detectorSource = extractFunctionSource(mainSource, 'isPrimaryPasteShortcut');
  const handlerSource = extractFunctionSource(mainSource, 'handlePrimaryPasteShortcut');
  const module = { exports: {} };

  vm.runInNewContext(`
    let isEditorPasteTargetFocused = false;
    ${detectorSource}
    ${handlerSource}
    module.exports = {
      setEditorPasteTargetFocused(value) {
        isEditorPasteTargetFocused = value;
      },
      handlePrimaryPasteShortcut,
    };
  `, {
    module,
    process: { platform: 'linux' },
  });

  const shortcut = {
    type: 'keyDown',
    key: 'v',
    control: true,
    meta: false,
    alt: false,
    shift: false,
    isAutoRepeat: false,
  };
  const makeWindow = () => {
    let pasteCount = 0;
    return {
      get pasteCount() {
        return pasteCount;
      },
      isDestroyed: () => false,
      isFocused: () => true,
      webContents: {
        isDestroyed: () => false,
        paste: () => {
          pasteCount += 1;
        },
      },
    };
  };

  const falseWindow = makeWindow();
  module.exports.setEditorPasteTargetFocused(false);
  assert.equal(module.exports.handlePrimaryPasteShortcut({}, shortcut, falseWindow), true);
  assert.equal(falseWindow.pasteCount, 0);

  const trueWindow = makeWindow();
  module.exports.setEditorPasteTargetFocused(true);
  assert.equal(module.exports.handlePrimaryPasteShortcut({}, shortcut, trueWindow), true);
  assert.equal(trueWindow.pasteCount, 1);

  const nonShortcutWindow = makeWindow();
  module.exports.setEditorPasteTargetFocused(true);
  assert.equal(module.exports.handlePrimaryPasteShortcut({}, { ...shortcut, key: 'x' }, nonShortcutWindow), false);
  assert.equal(nonShortcutWindow.pasteCount, 0);
});

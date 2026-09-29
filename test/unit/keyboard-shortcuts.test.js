const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { test } = require('node:test');

const REQUIRED_ROLES = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'];

test('menu template exposes edit role-items', async () => {
  const mainPath = join(process.cwd(), 'src', 'main.js');
  const content = await readFile(mainPath, 'utf8');
  const missing = REQUIRED_ROLES.filter((role) => {
    const regex = new RegExp(`role\\s*:\\s*['"]${role}['"]`);
    return !regex.test(content);
  });

  assert.ok(
    missing.length === 0,
    `Missing edit menu roles: ${missing.join(', ')}. Keep undo/redo/cut/copy/paste/selectAll present.`
  );
});

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

test('main process keeps primary paste bridge gated by renderer focus signal', async () => {
  const mainPath = join(process.cwd(), 'src', 'main.js');
  const content = await readFile(mainPath, 'utf8');
  const detectorBody = extractFunctionBody(content, 'isPrimaryPasteShortcut');
  const handlerBody = extractFunctionBody(content, 'handlePrimaryPasteShortcut');

  assert.match(content, /function\s+isPrimaryPasteShortcut\s*\(/);
  assert.match(detectorBody, /input\.type\s*!==\s*['"]keyDown['"]/);
  assert.match(detectorBody, /key\s*!==\s*['"]v['"]/);
  assert.match(detectorBody, /input\.isAutoRepeat\s*===\s*true/);
  assert.match(detectorBody, /input\.alt\s*\|\|\s*input\.shift/);
  assert.match(detectorBody, /process\.platform\s*===\s*['"]darwin['"]\s*\?\s*input\.meta\s*:\s*input\.control/);
  assert.match(detectorBody, /process\.platform\s*===\s*['"]darwin['"]\s*\?\s*input\.control\s*:\s*input\.meta/);
  assert.match(content, /function\s+handlePrimaryPasteShortcut\s*\(/);
  assert.match(content, /EDITOR_PASTE_FOCUS_STATE_CHANNEL/);
  assert.match(content, /normalizeEditorPasteFocusState/);
  assert.match(content, /isEditorPasteTargetFocused\s*=\s*focused/);
  assert.match(handlerBody, /isEditorPasteTargetFocused\s*!==\s*true/);
  assert.match(handlerBody, /win\.webContents\.paste\(\)/);
  assert.doesNotMatch(handlerBody, /executeJavaScript/);
  assert.doesNotMatch(handlerBody, /focusProbeScript/);
  assert.doesNotMatch(handlerBody, /document\.activeElement/);
  assert.doesNotMatch(handlerBody, /\.ProseMirror/);
  assert.doesNotMatch(handlerBody, /isContentEditable/);
  assert.doesNotMatch(handlerBody, /event\.preventDefault\(\)/);
});

test('native Mac Cut edits only a live focused authoring target once; other keys and contexts remain untouched', async () => {
  const vm = require('node:vm');
  const content = await readFile(join(process.cwd(), 'src', 'main.js'), 'utf8');
  const body = extractFunctionBody(content, 'handlePrimaryCutShortcut');
  let cut = 0, prevented = 0;
  const context = { process: { platform: 'darwin' }, isEditorPasteTargetFocused: true };
  vm.createContext(context);
  vm.runInContext('function handlePrimaryCutShortcut(event,input,win) {' + body + '}', context);
  const input = { type: 'keyDown', key: 'x', meta: true };
  const event = { preventDefault() { prevented++; } };
  const win = { isDestroyed: () => false, isFocused: () => true,
    webContents: { isDestroyed: () => false, cut() { cut++; } } };
  assert.equal(context.handlePrimaryCutShortcut(event, input, win), true);
  assert.equal(cut, 1); assert.equal(prevented, 1);
  for (const override of [{ type: 'keyUp' }, { key: 'v' }, { meta: false }, { control: true }, { alt: true }, { shift: true }, { isAutoRepeat: true }]) {
    assert.equal(context.handlePrimaryCutShortcut(event, { ...input, ...override }, win), false);
  }
  for (const target of [null, { ...win, isDestroyed: () => true }, { ...win, isFocused: () => false }, { ...win, webContents: { isDestroyed: () => true } }]) {
    assert.equal(context.handlePrimaryCutShortcut(event, input, target), false);
  }
  context.isEditorPasteTargetFocused = false;
  assert.equal(context.handlePrimaryCutShortcut(event, input, win), false);
  context.isEditorPasteTargetFocused = true; context.process.platform = 'linux';
  assert.equal(context.handlePrimaryCutShortcut(event, input, win), false);
  assert.equal(cut, 1); assert.equal(prevented, 1);
});

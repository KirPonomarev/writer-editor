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

test('main process keeps a focus-gated primary paste bridge for ProseMirror', async () => {
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
  assert.match(handlerBody, /win\.webContents\.executeJavaScript\(/);
  assert.match(handlerBody, /\.ProseMirror/);
  assert.match(handlerBody, /document\.activeElement/);
  assert.match(handlerBody, /isContentEditable/);
  assert.match(handlerBody, /win\.webContents\.paste\(\)/);
  assert.doesNotMatch(handlerBody, /event\.preventDefault\(\)/);
});

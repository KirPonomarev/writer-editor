const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pathBoundary = require('../../src/core/io/path-boundary');

function readText(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('joinPathSegmentsWithinRoot rejects parent traversal segments', () => {
  assert.throws(
    () => pathBoundary.joinPathSegmentsWithinRoot('/tmp/workspace', ['../escape.txt'], {
      resolveSymlinks: false,
    }),
    (error) => error && error.failSignal === 'E_PATH_BOUNDARY_VIOLATION' && error.failReason === 'PATH_SEGMENT_FORBIDDEN',
  );
});

test('resolveValidatedPath rejects file scheme input', () => {
  assert.throws(
    () => pathBoundary.resolveValidatedPath('file:///tmp/unsafe.txt', { mode: 'any' }),
    (error) => error && error.failSignal === 'E_PATH_BOUNDARY_VIOLATION' && error.failReason === 'PATH_PREFIX_FORBIDDEN',
  );
});

test('runtime file surfaces use joinPathSegmentsWithinRoot central helper', () => {
  const mainText = readText('src/main.js');
  const backupText = readText('src/utils/backupManager.js');
  const fileManagerText = readText('src/utils/fileManager.js');
  const fsHelpersText = readText('src/utils/fsHelpers.js');
  const menuLockText = readText('src/menu/menu-artifact-lock.js');

  assert.match(mainText, /joinPathSegmentsWithinRoot\(/u);
  assert.match(backupText, /joinPathSegmentsWithinRoot\(/u);
  assert.match(fileManagerText, /joinPathSegmentsWithinRoot\(/u);
  assert.match(fsHelpersText, /joinPathSegmentsWithinRoot\(/u);
  assert.match(menuLockText, /joinPathSegmentsWithinRoot\(/u);
});

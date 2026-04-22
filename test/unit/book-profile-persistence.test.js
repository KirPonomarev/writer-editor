const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function hasBookProfileQueryHook(source) {
  return /query\.[\w.]*bookProfile/i.test(source) || /query\.[\w.]*pageSetup/i.test(source);
}

test('book profile persistence: project manifest source carries canonical bookProfile state', () => {
  const source = read('src/main.js');

  assert.ok(/function\s+getProjectManifestComparable\s*\(/.test(source));
  assert.ok(/function\s+normalizeProjectManifest\s*\(/.test(source));
  assert.ok(
    /bookProfile/.test(source),
    'project manifest contract must mention bookProfile as canonical project-level state',
  );
  assert.ok(
    /normalizeBookProfile|createDefaultBookProfile/.test(source),
    'project manifest normalization must canonicalize bookProfile before write',
  );
  assert.ok(
    /bookProfile\s*:/.test(source),
    'project manifest comparable or normalized record must include bookProfile',
  );
});

test('book profile persistence: reopen path exposes persisted bookProfile or a bounded query hook', () => {
  const mainSource = read('src/main.js');
  const preloadSource = read('src/preload.js');

  const editorPayloadCarriesBookProfile =
    /bookProfile\s*:\s*.*bookProfile/.test(mainSource)
    || mainSource.includes('safePayload.bookProfile')
    || mainSource.includes("mainWindow.webContents.send('editor:set-text', safePayload)")
      && mainSource.includes('bookProfile');
  const boundedQueryHookExists = hasBookProfileQueryHook(mainSource) || hasBookProfileQueryHook(preloadSource);

  assert.ok(
    editorPayloadCarriesBookProfile || boundedQueryHookExists,
    'save-reopen needs either editor:set-text bookProfile payload or a bounded query bridge for project bookProfile',
  );
});

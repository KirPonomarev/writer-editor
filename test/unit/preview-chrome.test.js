const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(ROOT, relativePath)).href;
  return import(fileUrl);
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test('preview chrome: editor zoom remains session-only and uses localStorage, not bookProfile persistence', () => {
  const source = readFile('src/renderer/editor.js');

  const setZoomStart = source.indexOf('function setEditorZoom(value, persist = true)');
  const setZoomEnd = source.indexOf('function changeEditorZoom(delta)');
  assert.ok(setZoomStart > -1 && setZoomEnd > setZoomStart, 'setEditorZoom bounds must exist');
  const setZoomSnippet = source.slice(setZoomStart, setZoomEnd);

  assert.ok(setZoomSnippet.includes('localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, String(editorZoom));'));
  assert.ok(setZoomSnippet.includes('applyPageViewCssVars(metrics);'));
  assert.ok(setZoomSnippet.includes('if (!persist) {'));
  assert.equal(setZoomSnippet.includes('writeToolbarProfileState('), false);
  assert.equal(setZoomSnippet.includes('resolveToolbarProfileStateForProjectSwitch('), false);
  assert.equal(setZoomSnippet.includes('currentProjectId'), false);

  const loadZoomStart = source.indexOf('function loadSavedEditorZoom()');
  const loadZoomEnd = source.indexOf('function setCurrentFontSize(px)');
  assert.ok(loadZoomStart > -1 && loadZoomEnd > loadZoomStart, 'loadSavedEditorZoom bounds must exist');
  const loadZoomSnippet = source.slice(loadZoomStart, loadZoomEnd);

  assert.ok(loadZoomSnippet.includes('localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY)'));
  assert.ok(loadZoomSnippet.includes('setEditorZoom(saved, false);'));
  assert.ok(loadZoomSnippet.includes('setEditorZoom(EDITOR_ZOOM_DEFAULT, false);'));
});

test('preview chrome: blank project switch stays ephemeral and does not write project state', async () => {
  const profileState = await loadModule('src/renderer/toolbar/toolbarProfileState.mjs');
  const storage = createMemoryStorage();

  const resolved = profileState.resolveToolbarProfileStateForProjectSwitch(storage, '');

  assert.equal(resolved.source, 'ephemeral');
  assert.equal(resolved.shouldPersist, false);
  assert.equal(resolved.shouldConsumeLegacySource, false);
  assert.deepEqual(resolved.state, profileState.createCanonicalMinimalToolbarProfileState());
  assert.equal(storage.getItem('toolbarProfiles:'), null);
});

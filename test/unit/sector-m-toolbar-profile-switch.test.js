const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function importRuntimeProjectionModule() {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  return import(modulePath);
}

test('sector-m toolbar profile switch: configurator markup exposes an accessible active profile radiogroup', () => {
  const html = readFile('src/renderer/index.html');

  assert.ok(html.includes('data-toolbar-profile-switch-group'));
  assert.ok(html.includes('data-toolbar-profile-switch="minimal"'));
  assert.ok(html.includes('data-toolbar-profile-switch="master"'));
  assert.ok(html.includes('configurator-panel__section configurator-panel__section--master'));
  assert.ok(html.includes('configurator-panel__section configurator-panel__section--minimal'));
  assert.ok(html.includes('data-configurator-bucket="master"'));
  assert.ok(html.includes('data-configurator-bucket="minimal"'));
  assert.ok(html.includes('role="radiogroup"'));
  assert.ok(html.includes('role="radio"'));
  assert.ok(html.includes('aria-checked="true"'));
  assert.ok(html.includes('aria-checked="false"'));
});

test('sector-m toolbar profile switch: editor wiring targets the active profile and bucket-specific mutations', () => {
  const source = readFile('src/renderer/editor.js');

  assert.ok(source.includes('applyToolbarActiveProfile('));
  assert.ok(source.includes('function getToolbarConfiguratorActiveProfile()'));
  assert.ok(source.includes('function setToolbarConfiguratorActiveProfile(profileName)'));
  assert.ok(source.includes("renderToolbarConfiguratorProfileSwitch();"));
  assert.ok(source.includes("setToolbarConfiguratorActiveProfile(profileSwitchButton.dataset.toolbarProfileSwitch || '');"));
  assert.ok(source.includes("addToolbarConfiguratorItem(libraryButton.dataset.itemId || '', getToolbarConfiguratorActiveProfile());"));
  assert.ok(source.includes("removeToolbarConfiguratorItem(removeButton.dataset.itemId || '', bucketKey);"));
  assert.ok(source.includes("commitToolbarConfiguratorBucketDrop(payload, bucketKey, insertionIndex, hoveredItem instanceof HTMLElement ? hoveredItem : null);"));
  assert.ok(source.includes("const sourceBucketKey = normalizeToolbarConfiguratorProfileName(payload.bucketKey || '');"));
  assert.equal(source.includes('bucket.classList.toggle(\'is-active-profile\', isActiveProfile);'), false);
});

test('sector-m toolbar profile switch: active profile drives section and shared grid visibility inside configurator', () => {
  const source = readFile('src/renderer/editor.js');

  const renderStart = source.indexOf('function renderToolbarConfiguratorBuckets() {');
  const renderEnd = source.indexOf('function addToolbarConfiguratorItem(');
  assert.ok(renderStart > -1 && renderEnd > renderStart, 'renderToolbarConfiguratorBuckets bounds must exist');
  const renderSnippet = source.slice(renderStart, renderEnd);
  const helperStart = source.indexOf('function syncToolbarConfiguratorLibraryGridVisibility(');
  const helperEnd = source.indexOf('function createToolbarConfiguratorBucketItemSelection(');
  assert.ok(helperStart > -1 && helperEnd > helperStart, 'syncToolbarConfiguratorLibraryGridVisibility bounds must exist');
  const helperSnippet = source.slice(helperStart, helperEnd);

  assert.ok(renderSnippet.includes("configuratorMasterSection.hidden = activeProfile !== 'master';"));
  assert.ok(renderSnippet.includes("configuratorMinimalSection.hidden = activeProfile !== 'minimal';"));
  assert.ok(renderSnippet.includes('syncToolbarConfiguratorLibraryGridVisibility(activeProfile);'));
  assert.ok(helperSnippet.includes("configuratorLibraryGrid.hidden = normalizeToolbarConfiguratorProfileName(profileName) !== 'master';"));
  assert.equal(renderSnippet.includes('toolbarProfiles:'), false);
  assert.equal(renderSnippet.includes('writeToolbarConfiguratorStoredState('), false);
});

test('sector-m toolbar profile switch: active profile selection changes visible item ids', async () => {
  const { collectVisibleToolbarItemIdsFromState } = await importRuntimeProjectionModule();

  const minimalIds = collectVisibleToolbarItemIdsFromState({
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.redo', 'toolbar.format.bold'],
    },
  });
  const masterIds = collectVisibleToolbarItemIdsFromState({
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.redo', 'toolbar.format.bold'],
    },
  });

  assert.deepEqual(minimalIds, ['toolbar.history.undo']);
  assert.deepEqual(masterIds, ['toolbar.history.redo', 'toolbar.format.bold']);
});

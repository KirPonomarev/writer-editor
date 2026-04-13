const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('sector-m toolbar profile switch: configurator markup exposes an accessible active profile radiogroup', () => {
  const html = readFile('src/renderer/index.html');

  assert.ok(html.includes('data-toolbar-profile-switch-group'));
  assert.ok(html.includes('data-toolbar-profile-switch="minimal"'));
  assert.ok(html.includes('data-toolbar-profile-switch="master"'));
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
  assert.ok(source.includes("addToolbarConfiguratorItem(payload.itemId, bucketKey);"));
  assert.ok(source.includes('bucket.classList.toggle(\'is-active-profile\', isActiveProfile);'));
  assert.equal(source.includes('configuratorMasterSection.hidden = true;'), false);
  assert.equal(source.includes("configuratorMasterSection.setAttribute('aria-hidden', 'true');"), false);
});

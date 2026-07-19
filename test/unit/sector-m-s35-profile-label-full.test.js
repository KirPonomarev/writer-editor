const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(ROOT, relativePath)).href);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('S35 profile label full: user-facing configurator labels say Polnyy while data keys stay stable', () => {
  const html = read('src/renderer/index.html');

  assert.ok(html.includes('data-toolbar-profile-switch="minimal"'));
  assert.ok(html.includes('data-toolbar-profile-switch="master"'));
  assert.ok(html.includes('>Минимальный<'));
  assert.ok(html.includes('>Полный<'));
  assert.ok(html.includes('>Полный набор<'));
  assert.ok(html.includes('>Минимальный набор<'));
  assert.equal(html.includes('>master<'), false);
  assert.equal(html.includes('>minimal<'), false);
});

test('S35 profile label full: persisted legacy pro profile resolves to master behavior without storing pro', async () => {
  const profileState = await importModule('src/renderer/toolbar/toolbarProfileState.mjs');

  const normalized = profileState.normalizeToolbarProfileState({
    version: 3,
    activeToolbarProfile: 'pro',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      pro: ['toolbar.history.redo', 'toolbar.format.bold'],
    },
  });

  assert.deepEqual(normalized, {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.redo', 'toolbar.format.bold'],
    },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.toolbarProfiles, 'pro'), false);
});

test('S35 profile label full: runtime projection treats active pro as the full master profile', async () => {
  const runtime = await importModule('src/renderer/toolbar/toolbarRuntimeProjection.mjs');

  const visibleIds = runtime.collectVisibleToolbarItemIdsFromState({
    activeToolbarProfile: 'pro',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.redo', 'toolbar.format.bold'],
    },
  });

  assert.deepEqual(visibleIds, ['toolbar.history.redo', 'toolbar.format.bold']);
});

test('S35 profile label full: settings aggregation presents master and pro as Polnyy', async () => {
  const settings = await importModule('src/renderer/settings/settingsAggregator.mjs');

  const master = settings.buildSettingsAggregation({ toolbarProfile: 'master' });
  const pro = settings.buildSettingsAggregation({ toolbarProfile: 'pro' });
  const minimal = settings.buildSettingsAggregation({ toolbarProfile: 'minimal' });

  assert.equal(master.settings.find((entry) => entry.id === 'layout.toolbarProfile')?.value, 'Полный');
  assert.equal(pro.settings.find((entry) => entry.id === 'layout.toolbarProfile')?.value, 'Полный');
  assert.equal(minimal.settings.find((entry) => entry.id === 'layout.toolbarProfile')?.value, 'Минимальный');
});

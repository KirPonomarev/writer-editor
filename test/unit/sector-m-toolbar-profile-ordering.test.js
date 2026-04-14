const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function readRuntimeProjectionSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs'), 'utf8');
}

function importRuntimeProjectionModule() {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  return import(modulePath);
}

test('sector-m toolbar profile ordering: runtime projection module includes bounded reorder support and compatibility wrapper', () => {
  const source = readRuntimeProjectionSource();

  assert.ok(source.includes('floating-toolbar__controls'));
  assert.ok(source.includes('applyToolbarActiveProfile('));
  assert.ok(source.includes('applyToolbarProfileMinimal('));
  assert.ok(source.includes('insertBefore('));
  assert.ok(source.includes('controlsContainer'));
  assert.ok(source.includes('reorderVisibleGroups'));
  assert.ok(source.includes('reorderVisibleItemsWithinGroup'));
  assert.equal(source.includes('cloneNode('), false);
});

test('sector-m toolbar profile ordering: active profile order is preserved and duplicates are removed', async () => {
  const { collectVisibleToolbarItemIdsFromState } = await importRuntimeProjectionModule();

  const visibleIds = collectVisibleToolbarItemIdsFromState({
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: [
        'toolbar.history.redo',
        'toolbar.format.bold',
        'toolbar.format.bold',
        'toolbar.font.family',
        'toolbar.unknown.id',
        'toolbar.format.italic',
      ],
    },
  });

  assert.deepEqual(visibleIds, [
    'toolbar.history.redo',
    'toolbar.format.bold',
    'toolbar.font.family',
    'toolbar.format.italic',
  ]);
});

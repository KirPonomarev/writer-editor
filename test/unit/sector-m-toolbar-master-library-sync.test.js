const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
}

function extractFunctionSource(source, name) {
  const signature = `function ${name}(`;
  const start = source.indexOf(signature);
  assert.ok(start > -1, `${name} must exist`);
  const braceStart = source.indexOf('{', start);
  assert.ok(braceStart > start, `${name} body must exist`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unclosed function body for ${name}`);
}

function instantiateFunctions(functionNames, extraSandbox = {}) {
  const source = readEditorSource();
  const script = `${functionNames.map((name) => extractFunctionSource(source, name)).join('\n\n')}\nmodule.exports = { ${functionNames.join(', ')} };`;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Array,
    Math,
    Object,
    JSON,
    Set,
    ...extraSandbox,
  };
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-toolbar-master-library-sync.editor-snippet.js' });
  return { sandbox, exports: sandbox.module.exports };
}

function toIds(entries) {
  return JSON.parse(JSON.stringify(entries)).map((entry) => entry.id);
}

test('sector-m toolbar master library sync: active master subtracts only master ids from current library candidates and restores on remove', () => {
  const liveEntries = [
    { id: 'toolbar.history.undo', implementationState: 'live' },
    { id: 'toolbar.history.redo', implementationState: 'live' },
    { id: 'toolbar.format.bold', implementationState: 'live' },
  ];
  const catalogById = new Map(liveEntries.map((entry) => [entry.id, entry]));
  const { sandbox, exports } = instantiateFunctions([
    'getToolbarConfiguratorActiveProfile',
    'getToolbarConfiguratorProfileIds',
    'listToolbarConfiguratorLibraryEntries',
    'addToolbarConfiguratorItem',
    'removeToolbarConfiguratorItem',
  ], {
    normalizeToolbarConfiguratorProfileName: (profileName) => profileName === 'master' ? 'master' : 'minimal',
    listLiveToolbarFunctionCatalogEntries: () => liveEntries.map((entry) => ({ ...entry })),
    getToolbarConfiguratorCatalogItem: (itemId) => catalogById.get(itemId) || null,
  });

  sandbox.configuratorBucketState = {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.format.bold'],
      master: ['toolbar.history.undo', 'toolbar.history.redo'],
    },
  };
  sandbox.commitToolbarConfiguratorState = (nextState) => {
    sandbox.configuratorBucketState = nextState;
    return nextState;
  };

  assert.deepEqual(
    toIds(exports.listToolbarConfiguratorLibraryEntries()),
    ['toolbar.format.bold'],
  );

  exports.addToolbarConfiguratorItem('toolbar.format.bold', 'master');
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.configuratorBucketState.toolbarProfiles.master)),
    ['toolbar.history.undo', 'toolbar.history.redo', 'toolbar.format.bold'],
  );
  assert.deepEqual(toIds(exports.listToolbarConfiguratorLibraryEntries()), []);

  exports.removeToolbarConfiguratorItem('toolbar.format.bold', 'master');
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.configuratorBucketState.toolbarProfiles.master)),
    ['toolbar.history.undo', 'toolbar.history.redo'],
  );
  assert.deepEqual(
    toIds(exports.listToolbarConfiguratorLibraryEntries()),
    ['toolbar.format.bold'],
  );
});

test('sector-m toolbar master library sync: profile switch recomputes candidate subtraction per active profile', () => {
  const liveEntries = [
    { id: 'toolbar.history.undo', implementationState: 'live' },
    { id: 'toolbar.history.redo', implementationState: 'live' },
    { id: 'toolbar.format.bold', implementationState: 'live' },
  ];
  const { sandbox, exports } = instantiateFunctions([
    'getToolbarConfiguratorActiveProfile',
    'getToolbarConfiguratorProfileIds',
    'listToolbarConfiguratorLibraryEntries',
  ], {
    normalizeToolbarConfiguratorProfileName: (profileName) => profileName === 'master' ? 'master' : 'minimal',
    listLiveToolbarFunctionCatalogEntries: () => liveEntries.map((entry) => ({ ...entry })),
  });

  sandbox.configuratorBucketState = {
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.redo'],
    },
  };

  assert.deepEqual(
    toIds(exports.listToolbarConfiguratorLibraryEntries()),
    ['toolbar.history.redo', 'toolbar.format.bold'],
  );

  sandbox.configuratorBucketState = {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.redo'],
    },
  };

  assert.deepEqual(
    toIds(exports.listToolbarConfiguratorLibraryEntries()),
    ['toolbar.history.undo', 'toolbar.format.bold'],
  );
});

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
    ...extraSandbox,
  };
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-toolbar-master-mutability.editor-snippet.js' });
  return { sandbox, exports: sandbox.module.exports };
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('sector-m toolbar master mutability: library admission allows restore-after-remove back into master', () => {
  const { sandbox, exports } = instantiateFunctions([
    'addToolbarConfiguratorItem',
    'removeToolbarConfiguratorItem',
  ], {
    normalizeToolbarConfiguratorProfileName: (profileName) => profileName === 'master' ? 'master' : 'minimal',
    getToolbarConfiguratorActiveProfile: () => 'master',
    getToolbarConfiguratorCatalogItem: (itemId) => ({ id: itemId, implementationState: 'live' }),
  });

  sandbox.configuratorBucketState = {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.undo', 'toolbar.history.redo', 'toolbar.format.bold'],
    },
  };
  sandbox.getToolbarConfiguratorProfileIds = (profileName = sandbox.getToolbarConfiguratorActiveProfile()) => {
    const bucketKey = sandbox.normalizeToolbarConfiguratorProfileName(profileName);
    const profileIds = sandbox.configuratorBucketState.toolbarProfiles[bucketKey];
    return Array.isArray(profileIds) ? [...profileIds] : [];
  };
  sandbox.commitToolbarConfiguratorState = (nextState) => {
    sandbox.configuratorBucketState = nextState;
    return nextState;
  };

  exports.removeToolbarConfiguratorItem('toolbar.format.bold', 'master');
  assert.deepEqual(
    toPlain(sandbox.configuratorBucketState.toolbarProfiles.master),
    ['toolbar.history.undo', 'toolbar.history.redo'],
  );

  exports.addToolbarConfiguratorItem('toolbar.format.bold', 'master');
  assert.deepEqual(
    toPlain(sandbox.configuratorBucketState.toolbarProfiles.master),
    ['toolbar.history.undo', 'toolbar.history.redo', 'toolbar.format.bold'],
  );
});

test('sector-m toolbar master mutability: library drag intent and drop commit admit restore into master', () => {
  const { sandbox, exports } = instantiateFunctions([
    'getToolbarConfiguratorBucketDropIntent',
    'commitToolbarConfiguratorBucketDrop',
  ], {
    normalizeToolbarConfiguratorProfileName: (profileName) => profileName === 'master' ? 'master' : 'minimal',
    getToolbarConfiguratorCatalogItem: (itemId) => ({ id: itemId, implementationState: 'live' }),
  });

  sandbox.configuratorBucketState = {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.undo', 'toolbar.history.redo'],
    },
  };
  sandbox.getToolbarConfiguratorProfileIds = (profileName) => {
    const bucketKey = sandbox.normalizeToolbarConfiguratorProfileName(profileName);
    const profileIds = sandbox.configuratorBucketState.toolbarProfiles[bucketKey];
    return Array.isArray(profileIds) ? [...profileIds] : [];
  };
  sandbox.commitToolbarConfiguratorState = (nextState) => {
    sandbox.configuratorBucketState = nextState;
    return nextState;
  };

  const payload = { sourceType: 'library-item', itemId: 'toolbar.format.bold' };
  assert.equal(exports.getToolbarConfiguratorBucketDropIntent(payload, 'master'), 'insert');
  assert.equal(exports.commitToolbarConfiguratorBucketDrop(payload, 'master', 1, null), true);
  assert.deepEqual(
    toPlain(sandbox.configuratorBucketState.toolbarProfiles.master),
    ['toolbar.history.undo', 'toolbar.format.bold', 'toolbar.history.redo'],
  );
});

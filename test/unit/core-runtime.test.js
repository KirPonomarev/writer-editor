const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function loadRuntime() {
  return loadModule(path.join('src', 'core', 'runtime.mjs'));
}

test('browser-safe hash keeps SHA-256 vectors without node crypto imports', async () => {
  const hash = await loadModule(path.join('src', 'core', 'browser-safe-hash.mjs'));

  assert.equal(
    hash.sha256Hex(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  assert.equal(
    hash.sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    hash.sha256Hex('emoji \u{1f600}'),
    'c07e2aa9faa2a31318dc2cbb7c3cd38386e3a9667b9355c5f285f561f4ca1bcd',
  );
});

test('core state hash keeps canonical SHA-256 semantics', async () => {
  const runtime = await loadRuntime();

  assert.equal(
    runtime.hashCoreState(runtime.createInitialCoreState()),
    '17bbb03ed8575017073ce668d34f138c1a05b649bf201f561e7799419c0cdb59',
  );
});

test('renderer bundle stays free of node crypto runtime requirements', () => {
  const bundle = fs.readFileSync(
    path.join(process.cwd(), 'src', 'renderer', 'editor.bundle.js'),
    'utf8',
  );
  const runtimeSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'core', 'runtime.mjs'),
    'utf8',
  );
  const derivedSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'derived', 'deriveView.mjs'),
    'utf8',
  );
  const hashSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'core', 'browser-safe-hash.mjs'),
    'utf8',
  );

  assert.equal(bundle.includes('node:crypto'), false);
  assert.equal(bundle.includes('__require("node:'), false);
  assert.equal(bundle.includes("__require('node:"), false);
  assert.equal(runtimeSource.includes('node:crypto'), false);
  assert.equal(derivedSource.includes('node:crypto'), false);
  assert.equal(hashSource.includes('node:crypto'), false);
});

test('core runtime executes create + text edit mutations through canonical commands', async () => {
  const runtime = await loadRuntime();
  const initial = runtime.createInitialCoreState();

  const createResult = runtime.reduceCoreState(initial, {
    type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE,
    payload: { projectId: 'project-1', title: 'Draft', sceneId: 'scene-a' },
  });
  assert.equal(createResult.ok, true);

  const editResult = runtime.reduceCoreState(createResult.state, {
    type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: { projectId: 'project-1', sceneId: 'scene-a', text: 'Core SoT executable' },
  });

  assert.equal(editResult.ok, true);
  assert.equal(
    editResult.state.data.projects['project-1'].scenes['scene-a'].text,
    'Core SoT executable',
  );
  assert.ok(editResult.state.data.lastCommandId >= 2);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { Arch, DebugLogger } = require('builder-util');
const { getConfig, validateConfiguration } = require('app-builder-lib/out/util/config/config.js');
const { Packager } = require('app-builder-lib/out/packager.js');
const { AsyncEventEmitter } = require('app-builder-lib/out/util/asyncEventEmitter.js');
const ROOT = path.resolve(__dirname, '../..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'scripts/electron-download-config.cjs'), 'utf8');

// Execute the unchanged hook with a VM-owned module boundary. No global fetch,
// installed dependency, process environment or production downloader is patched.
function harness(t, handler, timeout = ms => AbortSignal.timeout(ms)) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-download-config-'));
  const modulePath = path.join(directory, 'get.cjs');
  fs.writeFileSync(modulePath, 'exports.downloadArtifact = options => exports.handler(options);\n');
  const bridge = require(modulePath);
  const calls = [];
  bridge.handler = options => { calls.push(options); return handler(options); };
  const scopedRequire = name => {
    if (name === 'node:module') return { createRequire: () => ({ resolve: () => modulePath }) };
    if (name === 'app-builder-lib/out/util/electronGet.js') return {
      getCacheDirectory: options => { assert.equal(options.allowEnvVarOverride, true); return directory; },
    };
    return require(name);
  };
  scopedRequire.resolve = require.resolve;
  const module = { exports: {} };
  const script = new vm.Script(SOURCE, {
    filename: path.join(ROOT, 'scripts/electron-download-config.cjs'),
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });
  script.runInNewContext({ require: scopedRequire, module, AbortSignal: { timeout } });
  t.after(() => { delete require.cache[modulePath]; fs.rmSync(directory, { recursive: true, force: true }); });
  return { hook: module.exports.beforePack, calls, directory };
}
function context(platform = 'darwin', arch = Arch.arm64, config = {}) {
  return { electronPlatformName: platform, arch, packager: { config, info: { framework: { version: '41.10.6' } } } };
}

test('actual builder loads package extends and preserves offline CLI distribution', async () => {
  const dist = '/checked/offline/electron.zip';
  const config = await getConfig(ROOT, null, { electronDist: dist });
  await validateConfiguration(config, new DebugLogger(false));
  assert.equal(typeof config.beforePack, 'function');
  assert.equal(config.afterPack, 'scripts/after-pack.cjs');
  await config.beforePack(context('not-an-auto-download-target', -1, config));
  assert.equal(config.electronDist, dist);
});

test('explicit string and function distributions take precedence without downloader access', async t => {
  const h = harness(t, () => assert.fail('explicit distribution must not download'));
  for (const explicit of ['/offline.zip', async () => '/offline.zip']) {
    const config = { electronDist: explicit, electronDownload: { strictSSL: false } };
    await h.hook(context('invalid', -1, config));
    assert.equal(config.electronDist, explicit);
  }
  assert.equal(h.calls.length, 0);
});

test('actual target and version are passed with timeout, cache and checksum validation enabled', async t => {
  const deadlines = [];
  const h = harness(t, async options => `/checked/${options.platform}-${options.arch}.zip`, ms => {
    deadlines.push(ms); return AbortSignal.timeout(ms);
  });
  for (const [platform, arch] of [['darwin', Arch.arm64], ['darwin', Arch.x64], ['linux', Arch.x64], ['win32', Arch.ia32], ['mas', Arch.arm64]]) {
    const ctx = context(platform, arch);
    await h.hook(ctx);
    const options = h.calls.at(-1);
    assert.equal(options.platform, platform);
    assert.equal(options.arch, Arch[arch]);
    assert.equal(options.version, '41.10.6');
    assert.equal(options.artifactName, 'electron');
    assert.equal(options.cacheRoot, path.join(h.directory, 'downloads'));
    assert.equal(options.unsafelyDisableChecksums, undefined);
    assert.equal(options.downloadOptions.https, undefined);
    assert.ok(options.downloadOptions.signal instanceof AbortSignal);
    assert.equal(ctx.packager.config.electronDist, `/checked/${platform}-${Arch[arch]}.zip`);
  }
  assert.deepEqual(deadlines, [600000, 600000, 600000, 600000, 600000]);
});

test('a generated ZIP is not mistaken for explicit authority on the next target', async t => {
  const h = harness(t, async options => `/checked/${options.platform}-${options.arch}.zip`);
  const config = {};
  await h.hook(context('darwin', Arch.arm64, config));
  await h.hook(context('darwin', Arch.x64, config));
  assert.equal(config.electronDist, '/checked/darwin-x64.zip');
  assert.deepEqual(h.calls.map(x => x.arch), ['arm64', 'x64']);
  config.electronDist = '/owner/offline.zip';
  await h.hook(context('win32', Arch.x64, config));
  assert.equal(config.electronDist, '/owner/offline.zip');
  assert.equal(h.calls.length, 2);
});

test('unknown targets and custom options fail before downloading or publishing', async t => {
  const h = harness(t, () => assert.fail('invalid options must not download'));
  for (const ctx of [context('unknown'), context('darwin', -1), context('darwin', Arch.universal), context('darwin', Arch.arm64, { electronDownload: { strictSSL: false } })]) {
    await assert.rejects(h.hook(ctx), /ELECTRON_DOWNLOAD_(TARGET|CUSTOM_OPTIONS)_UNSUPPORTED/);
    assert.equal(ctx.packager.config.electronDist, undefined);
  }
  assert.equal(h.calls.length, 0);
});

test('checksum rejection propagates through actual builder event dispatch without publication or fallback', async t => {
  const error = new Error('SHA256 checksum mismatch');
  const h = harness(t, async () => { throw error; });
  const ctx = context();
  const events = new AsyncEventEmitter();
  let nextHook = false;
  events.on('beforePack', h.hook, 'user');
  events.on('beforePack', () => { nextHook = true; }, 'user');
  await assert.rejects(Packager.prototype.emitBeforePack.call({ eventEmitter: events }, ctx), e => e === error);
  assert.equal(ctx.packager.config.electronDist, undefined);
  assert.equal(nextHook, false);
  assert.equal(h.calls.length, 1);
});

test('bounded abort propagates and never publishes a distribution', async t => {
  const keepAlive = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keepAlive));
  const deadlines = [];
  const h = harness(t, options => new Promise((resolve, reject) => {
    if (options.downloadOptions.signal.aborted) reject(options.downloadOptions.signal.reason);
    else options.downloadOptions.signal.addEventListener('abort', () => reject(options.downloadOptions.signal.reason), { once: true });
  }), ms => { deadlines.push(ms); return AbortSignal.timeout(10); });
  const ctx = context();
  await assert.rejects(h.hook(ctx), e => e.name === 'TimeoutError');
  assert.deepEqual(deadlines, [600000]);
  assert.equal(ctx.packager.config.electronDist, undefined);
  assert.equal(h.calls.length, 1);
});


test('concurrent automatic downloads fail closed while serial and explicit distributions remain supported', async t => {
  const h = harness(t, async () => '/checked/serial.zip');
  const concurrent = context('darwin', Arch.arm64, { concurrency: { jobs: 2 } });
  await assert.rejects(h.hook(concurrent), /ELECTRON_DOWNLOAD_CONCURRENCY_UNSUPPORTED: set concurrency.jobs=1/);
  assert.equal(concurrent.packager.config.electronDist, undefined);
  assert.equal(h.calls.length, 0);
  await h.hook(context('darwin', Arch.arm64, { concurrency: { jobs: 1 } }));
  assert.equal(h.calls.length, 1);
  const explicit = context('darwin', Arch.arm64, { concurrency: { jobs: 2 }, electronDist: '/owner/offline.zip' });
  await h.hook(explicit);
  assert.equal(explicit.packager.config.electronDist, '/owner/offline.zip');
  assert.equal(h.calls.length, 1);
});

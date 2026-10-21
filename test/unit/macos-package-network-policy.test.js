const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const afterPack = require('../../scripts/after-pack.cjs');

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')
);

test('macOS package transport policy stays deny-by-default for the offline app', () => {
  assert.equal(packageJson.build?.afterPack, 'scripts/after-pack.cjs');
  const ats = packageJson.build?.mac?.extendInfo?.NSAppTransportSecurity;
  assert.ok(ats);
  assert.equal(ats.NSAllowsArbitraryLoads, false);
  assert.equal(ats.NSAllowsLocalNetworking, false);

  for (const domain of ['localhost', '127.0.0.1']) {
    const exception = ats.NSExceptionDomains?.[domain];
    assert.ok(exception, `missing explicit deny policy for ${domain}`);
    assert.equal(exception.NSIncludesSubdomains, false);
    assert.equal(exception.NSTemporaryExceptionAllowsInsecureHTTPLoads, false);
    assert.equal(exception.NSTemporaryExceptionAllowsInsecureHTTPSLoads, false);
    assert.equal(exception.NSTemporaryExceptionMinimumTLSVersion, '1.3');
    assert.equal(exception.NSTemporaryExceptionRequiresForwardSecrecy, true);
  }
});

test('macOS native archive helper is excluded as source and built into the fixed packaged resource', async t => {
  assert.ok(packageJson.build.files.includes('!src/platform/darwin/**/*.c'));
  assert.match(packageJson.scripts['prebuild:mac'], /build-project-archive-native\.cjs/u);
  assert.match(packageJson.scripts.prestart, /build-project-archive-native\.cjs/u);
  assert.match(packageJson.scripts.predev, /build-project-archive-native\.cjs/u);
  const builder = require('../../scripts/build-project-archive-native.cjs');
  if (process.platform !== 'darwin') {
    assert.deepEqual(builder.buildProjectArchiveNative(), { available: false, reason: 'DARWIN_ONLY' });
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-package-helper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plist = path.join(root, 'Yalken.app', 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.writeFileSync(plist, '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>');
  await afterPack({ electronPlatformName: 'darwin', arch: process.arch === 'arm64' ? 3 : 1,
    appOutDir: root, packager: { appInfo: { productFilename: 'Yalken' } } });
  const binary = path.join(root, 'Yalken.app', 'Contents', 'Resources', 'yalken-native', 'project-archive-fs');
  assert.ok(fs.statSync(binary).isFile());
  assert.ok(fs.statSync(binary).mode & 0o111);
  const result = require('node:child_process').spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).phase, 'INPUT');
});

test('macOS package hook restores ATS denial after electron-builder packaging', (t) => {
  const appOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-after-pack-'));
  t.after(() => fs.rmSync(appOutDir, { recursive: true, force: true }));

  const infoPlist = path.join(appOutDir, 'Yalken.app', 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(infoPlist), { recursive: true });
  fs.writeFileSync(infoPlist, 'fixture');

  const calls = [];
  afterPack.hardenMacTransportSecurity(
    {
      appOutDir,
      packager: { appInfo: { productFilename: 'Yalken' } },
    },
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stderr: '' };
    }
  );

  assert.deepEqual(
    calls.map(({ command, args }) => ({ command, args })),
    [
      {
        command: '/usr/bin/plutil',
        args: [
          '-replace',
          'NSAppTransportSecurity.NSAllowsArbitraryLoads',
          '-bool',
          'NO',
          infoPlist,
        ],
      },
      {
        command: '/usr/bin/plutil',
        args: [
          '-replace',
          'NSAppTransportSecurity.NSAllowsLocalNetworking',
          '-bool',
          'NO',
          infoPlist,
        ],
      },
    ]
  );
  assert.ok(calls.every(({ options }) => options.encoding === 'utf8'));
});

test('macOS package hook rejects unsafe product filenames and command failures', (t) => {
  const appOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-after-pack-'));
  t.after(() => fs.rmSync(appOutDir, { recursive: true, force: true }));

  assert.throws(
    () => afterPack.resolveInfoPlist({
      appOutDir,
      packager: { appInfo: { productFilename: '../Yalken' } },
    }),
    /safe product filename/
  );

  const infoPlist = path.join(appOutDir, 'Yalken.app', 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(infoPlist), { recursive: true });
  fs.writeFileSync(infoPlist, 'fixture');

  assert.throws(
    () => afterPack.hardenMacTransportSecurity(
      {
        appOutDir,
        packager: { appInfo: { productFilename: 'Yalken' } },
      },
      () => ({ status: 1, stderr: 'write failed' })
    ),
    /write failed/
  );
});

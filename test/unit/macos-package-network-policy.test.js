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

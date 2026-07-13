const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PLUTIL_PATH = '/usr/bin/plutil';
const ATS_BOOLEAN_KEYS = [
  'NSAppTransportSecurity.NSAllowsArbitraryLoads',
  'NSAppTransportSecurity.NSAllowsLocalNetworking',
];

function resolveInfoPlist(context) {
  const productFilename = context?.packager?.appInfo?.productFilename;
  if (
    typeof productFilename !== 'string'
    || productFilename.length === 0
    || productFilename === '.'
    || productFilename === '..'
    || path.basename(productFilename) !== productFilename
  ) {
    throw new Error('macOS package hardening requires a safe product filename');
  }

  return path.join(
    context.appOutDir,
    `${productFilename}.app`,
    'Contents',
    'Info.plist'
  );
}

function hardenMacTransportSecurity(context, runCommand = spawnSync) {
  const infoPlist = resolveInfoPlist(context);
  if (!fs.existsSync(infoPlist)) {
    throw new Error(`macOS package Info.plist is missing: ${infoPlist}`);
  }

  for (const key of ATS_BOOLEAN_KEYS) {
    const result = runCommand(
      PLUTIL_PATH,
      ['-replace', key, '-bool', 'NO', infoPlist],
      { encoding: 'utf8' }
    );
    if (result.error || result.status !== 0) {
      const detail = result.error?.message || String(result.stderr || '').trim() || 'unknown error';
      throw new Error(`failed to harden ${key}: ${detail}`);
    }
  }
}

async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  hardenMacTransportSecurity(context);
}

module.exports = afterPack;
module.exports.hardenMacTransportSecurity = hardenMacTransportSecurity;
module.exports.resolveInfoPlist = resolveInfoPlist;

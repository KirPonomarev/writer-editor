'use strict';
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const builderRequire = createRequire(require.resolve('app-builder-lib/package.json'));
const { Arch } = require('builder-util');
const { getCacheDirectory } = require('app-builder-lib/out/util/electronGet.js');
const generatedDistributions = new WeakMap();
module.exports = {
  beforePack: async context => {
    const config = context.packager.config;
    // Preserve CLI/offline distribution authority before any target checks or download.
    const previous = generatedDistributions.get(config);
    if (config.electronDist != null && config.electronDist !== previous) return;
    if (Math.floor(config.concurrency?.jobs || 1) > 1) {
      throw new Error('ELECTRON_DOWNLOAD_CONCURRENCY_UNSUPPORTED: set concurrency.jobs=1 or select an explicit local electronDist');
    }
    const arch = Arch[context.arch];
    if (!['darwin', 'mas', 'linux', 'win32'].includes(context.electronPlatformName) ||
        !['arm64', 'armv7l', 'ia32', 'x64'].includes(arch)) {
      throw new Error('ELECTRON_DOWNLOAD_TARGET_UNSUPPORTED');
    }
    if (config.electronDownload != null) throw new Error('ELECTRON_DOWNLOAD_CUSTOM_OPTIONS_UNSUPPORTED');
    const { downloadArtifact } = await import(pathToFileURL(builderRequire.resolve('@electron/get')).href);
    const zip = await downloadArtifact({
      version: context.packager.info.framework.version,
      platform: context.electronPlatformName,
      arch,
      artifactName: 'electron',
      cacheRoot: path.join(getCacheDirectory({ allowEnvVarOverride: true }), 'downloads'),
      downloadOptions: { signal: AbortSignal.timeout(600000) },
    });
    // Publish only the checksum-validated ZIP; rejected requests leave config unchanged.
    config.electronDist = zip;
    generatedDistributions.set(config, zip);
  },
};

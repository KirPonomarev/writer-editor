import assert from 'node:assert/strict';

import { runProductionAppRuntimeHarnessSelfTest } from './production-app-runtime-harness.mjs';

const result = await runProductionAppRuntimeHarnessSelfTest({
  timeoutMs: 10000,
});

assert.equal(result.timedOut, false);
assert.equal(result.runtimeKind, 'production-app-runtime-harness');
assert.equal(result.exitCode, 0);
assert.equal(result.assertions.productionRuntime, true);
assert.equal(result.assertions.cleanExit, true);
assert.equal(result.assertions.appReady, true);
assert.equal(result.assertions.oneBrowserWindow, true);
assert.equal(result.assertions.loadComplete, true);
assert.equal(result.assertions.noNetwork, true);
assert.equal(result.assertions.noDialogs, true);
assert.equal(result.assertions.apiShapePresent, true);

process.stdout.write('PRODUCTION_APP_RUNTIME_HARNESS_SELFTEST_OK=1\n');

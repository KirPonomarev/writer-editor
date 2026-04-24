import assert from 'node:assert/strict';

import { runElectronRuntimeHarnessSelfTest } from './electron-runtime-harness.mjs';

const result = await runElectronRuntimeHarnessSelfTest({
  timeoutMs: 10000,
});

assert.equal(result.timedOut, false);
assert.equal(result.runtimeKind, 'synthetic-electron-runtime');
assert.equal(result.exitCode, 0);
assert.equal(result.assertions.cleanExit, true);
assert.equal(result.assertions.syntheticRuntime, true);
assert.equal(result.assertions.appReady, true);
assert.equal(result.assertions.singleWindow, true);
assert.equal(result.assertions.noNetwork, true);
assert.equal(result.assertions.pingOk, true);
assert.equal(result.assertions.pongOk, true);
assert.equal(result.assertions.tokenEchoed, true);
assert.equal(result.assertions.preloadExposed, true);

process.stdout.write('ELECTRON_RUNTIME_HARNESS_SELFTEST_OK=1\n');

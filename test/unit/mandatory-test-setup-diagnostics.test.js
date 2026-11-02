'use strict';

// These controls execute the exact maintained caller with finite child ports.
// No returned fixture TAP is actual unit, Main, native or release coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { spawnSync: actualSpawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const runner = path.join(root, 'scripts/run-tests.js');
const source = fs.readFileSync(runner, 'utf8');
const actualRequire = createRequire(runner);
const existingTest = 'test/unit/scene-meaning-promotion.test.js';
const green = [
  'TAP version 13', '# Subtest: finite caller control', 'ok 1 - finite caller control',
  '1..1', '# tests 1', '# suites 0', '# pass 1', '# fail 0',
  '# cancelled 0', '# skipped 0', '# todo 0', '',
].join('\n');

function invoke({ args = [existingTest], unit = {}, platform = process.platform, temporaryPath = os.tmpdir() } = {}) {
  const children = [], hostQueries = [], attemptedWrites = [], output = [], errors = [];
  const stop = Symbol('finite controlled process exit');
  const host = {
    argv: [process.execPath, runner, ...args], execPath: process.execPath,
    platform, version: process.version, versions: process.versions,
    env: { ...process.env, TMPDIR: temporaryPath },
    getuid: process.getuid?.bind(process), getgid: process.getgid?.bind(process),
    cwd: () => root, pid: process.pid, exitCode: 0,
    stdout: { write: value => { output.push(String(value)); return true; } },
    stderr: { write: value => { errors.push(String(value)); return true; } },
    exit(code = 0) { this.exitCode = code; throw stop; },
  };
  const readOnlyFs = Object.create(fs);
  for (const name of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'unlinkSync', 'renameSync']) {
    readOnlyFs[name] = (...values) => {
      attemptedWrites.push({ method: name, firstArgument: String(values[0]) });
      throw new Error('Finite caller control forbids unadmitted filesystem effects');
    };
  }
  const childPort = (command, argv = [], options = {}) => {
    if (path.basename(String(command)) === 'getconf' && argv.length === 1 && argv[0] === 'DARWIN_USER_TEMP_DIR') {
      hostQueries.push({ command, argv });
      return actualSpawnSync(command, argv, { ...options, encoding: 'utf8' });
    }
    const isUnit = argv.includes('--test') && !argv.some(value => String(value).endsWith('ops-synth-negative.test.cjs'));
    children.push({ command: String(command), argv: [...argv], kind: isUnit ? 'UNIT' : 'OTHER' });
    return isUnit
      ? { status: 0, signal: null, stdout: green, stderr: '', ...unit }
      : { status: 0, signal: null, stdout: '', stderr: '' };
  };
  const requirePort = name => name === 'node:child_process'
    ? { ...actualRequire(name), spawnSync: childPort }
    : name === 'node:fs' ? readOnlyFs
      : name === 'node:os' ? { ...os, tmpdir: () => temporaryPath }
        : actualRequire(name);
  const context = {
    require: requirePort, module: { exports: {} }, __filename: runner, __dirname: path.dirname(runner),
    process: host, Buffer, URL, console: {
      log: (...values) => output.push(values.map(String).join(' ')),
      error: (...values) => errors.push(values.map(String).join(' ')),
      warn: (...values) => errors.push(values.map(String).join(' ')),
    },
  };
  try {
    vm.runInNewContext(
      '(function(require,module,exports,__filename,__dirname){\n' + source
      + '\n})(require,module,module.exports,__filename,__dirname);',
      context, { filename: runner, timeout: 3000 },
    );
  } catch (error) {
    if (error !== stop) throw error;
  }
  return { exitCode: host.exitCode, children, hostQueries, attemptedWrites, output: output.join('\n'), errors: errors.join('\n') };
}
function reachedUnit(result) {
  assert.equal(result.children.filter(row => row.kind === 'UNIT').length, 1, 'the exact current caller must reach its real unit child boundary');
}
function refusalBeforeChildren(result) {
  assert.notEqual(result.exitCode, 0, 'invalid setup must remain a readable refusal');
  assert.equal(result.children.length, 0, 'no test or governance child may initialize before known setup refusal');
  assert.equal(result.attemptedWrites.length, 0, 'no filesystem mutation may precede refusal');
  assert.ok(result.errors.trim(), 'refusal must expose a diagnostic');
}

test('mandatory caller retains existing invalid check-mode refusal before child effects', () => {
  refusalBeforeChildren(invoke({ args: ['--mode=not-a-supported-mode'] }));
});
test('mandatory caller genuine host and existing explicit file accept complete GREEN finite TAP', () => {
  assert.equal(fs.existsSync(path.join(root, existingTest)), true);
  const result = invoke(); reachedUnit(result);
  assert.equal(result.exitCode, 0);
  assert.equal(result.attemptedWrites.length, 0);
});
test('mandatory caller actual nonzero child remains FAIL even with complete GREEN-shaped finite output', () => {
  const result = invoke({ unit: { status: 7 } }); reachedUnit(result);
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.children.at(-1).kind, 'UNIT', 'a real failing unit cannot launch later guards');
});
test('mandatory caller signal or spawn error cannot become GREEN', () => {
  for (const unit of [{ status: null, signal: 'SIGTERM' }, { status: null, error: Object.assign(new Error('retained buffer failure'), { code: 'ENOBUFS' }) }]) {
    const result = invoke({ unit }); reachedUnit(result);
    assert.notEqual(result.exitCode, 0);
    assert.equal(result.children.at(-1).kind, 'UNIT');
  }
});
test('mandatory caller zero-executed skipped denominator remains refusal', () => {
  const result = invoke({ unit: { stdout: green.replace('# pass 1', '# pass 0').replace('# skipped 0', '# skipped 1') } });
  reachedUnit(result); assert.notEqual(result.exitCode, 0);
});
test('mandatory caller unknown unit output with process zero refuses before later effects', () => {
  const result = invoke({ args: [], unit: { stdout: 'UNKNOWN_TEST_OUTPUT_FORMAT\n' } });
  reachedUnit(result);
  assert.notEqual(result.exitCode, 0, 'process zero without complete supported TAP cannot create acceptance');
  assert.equal(result.children.at(-1).kind, 'UNIT', 'unknown evidence cannot launch later guards');
});
test('mandatory caller inconsistent TAP totals with process zero remain FAIL', () => {
  const result = invoke({ unit: { stdout: green.replace('# fail 0', '# fail 1') } });
  reachedUnit(result); assert.notEqual(result.exitCode, 0, 'contradictory test and pass plus fail denominators are not GREEN');
});
test('mandatory caller missing explicit test file refuses before child effects', () => {
  const missing = 'test/unit/mandatory-setup-deliberately-absent-fixture.test.js';
  assert.equal(fs.existsSync(path.join(root, missing)), false);
  refusalBeforeChildren(invoke({ args: [missing] }));
});
test('mandatory caller bad Darwin temporary ancestry refuses before expensive child initialization (finite host-fact adapter)', () => {
  const bad = fs.realpathSync(process.platform === 'darwin' ? '/private/tmp' : os.tmpdir());
  assert.equal(bad.startsWith('/private/var/'), false, 'the actual read-only host path is the intended invalid Darwin input');
  // Explicit finite Darwin input on other CI hosts; no native platform parity claim.
  refusalBeforeChildren(invoke({ args: [], platform: 'darwin', temporaryPath: bad }));
});

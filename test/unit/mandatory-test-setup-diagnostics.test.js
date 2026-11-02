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

function finitePackageSetupBeforePrelude(scriptName) {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const original = scriptName === 'test'
    ? 'npm run -s test:ops && node scripts/run-tests.js'
    : 'npm run -s test:ops && npm run -s test:rtk && node scripts/run-tests.js --mode=promotion';
  const expected = scriptName === 'test'
    ? 'npm run -s r24:toolchain && node scripts/run-tests.js --with-ops=test:ops'
    : 'npm run -s r24:toolchain && node scripts/run-tests.js --mode=promotion --with-ops=test:ops,test:rtk';
  // Bind the complete maintained script. Unknown dispatch is a setup error,
  // not a wildcard acceptance or a missing-module mutant kill.
  assert.notEqual(scripts[scriptName], original, 'the actual package entry starts the expensive prelude before its caller can validate known setup');
  assert.equal(scripts[scriptName], expected, 'the reviewed fixed entry preserves every original prelude and uses the existing exact toolchain');
  const args = scriptName === 'test'
    ? ['--with-ops=test:ops']
    : ['--mode=promotion', '--with-ops=test:ops,test:rtk'];
  const bad = fs.realpathSync(process.platform === 'darwin' ? '/private/tmp' : os.tmpdir());
  refusalBeforeChildren(invoke({ args, platform: 'darwin', temporaryPath: bad }));
}
test('package default entry validates known setup before the existing expensive wave (finite source-bound dispatch)', () => {
  finitePackageSetupBeforePrelude('test');
});
test('package promotion entry validates setup before both existing wave and RTK (finite source-bound dispatch)', () => {
  finitePackageSetupBeforePrelude('promotion:check');
});

test('required promotion prelude cannot be downgraded by an appended duplicate caller flag', () => {
  refusalBeforeChildren(invoke({ args: [
    '--mode=promotion', '--with-ops=test:ops,test:rtk', '--with-ops=test:ops', existingTest,
  ] }));
});
test('valid required prelude retains wave then RTK before the ordinary unit child', () => {
  const result = invoke({ args: ['--with-ops=test:ops,test:rtk', existingTest] });
  reachedUnit(result);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.children.filter(row => row.kind === 'OTHER').map(row => row.argv.at(-1)), ['test:ops', 'test:rtk']);
  assert.equal(result.children.at(-1).kind, 'UNIT');
});
test('each actual required-prelude stage preserves nonzero or unavailable exit and halts its fixed sequence', () => {
  const begin = source.indexOf('function runRequiredOpsPrelude(');
  const end = source.indexOf('\nfunction runOpsSynthNegativeTests', begin);
  assert.ok(begin >= 0 && end > begin, 'test extracts the actual existing-caller helper, not a replacement implementation');
  for (const failureAt of [0, 1]) for (const status of [7, null]) {
    const calls = [];
    const execute = vm.runInNewContext('(' + source.slice(begin, end) + ')', {
      path, process: { platform: process.platform, execPath: process.execPath, env: { ComSpec: process.env.ComSpec } },
      console: { error() {} },
      spawnSync(command, argv) {
        calls.push({ command, argv: Array.from(argv) });
        return { status: calls.length - 1 === failureAt ? status : 0 };
      },
    });
    const result = execute(root, ['test:ops', 'test:rtk']);
    assert.equal(result, status === null ? 1 : status);
    assert.equal(calls.length, failureAt + 1);
    assert.deepEqual(calls.map(row => row.argv.at(-1)), ['test:ops', 'test:rtk'].slice(0, failureAt + 1));
  }
});

test('actual nested caller executes its explicit file instead of inheriting the parent private test context', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mandatory-nested-caller-'));
  const childTest = path.join(scratch, 'actual-child.test.js');
  fs.writeFileSync(childTest, "const test = require('node:test'); test('actual nested child executed', () => {});\n", { flag: 'wx' });
  const result = actualSpawnSync(process.execPath, [runner, '--mode=promotion', childTest], {
    cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, 'actual nested caller must execute: ' + result.stdout + '\n' + result.stderr);
  assert.match(result.stdout, /ok 1 - actual nested child executed/u);
  assert.match(result.stdout, /^# tests 1$/mu);
  assert.match(result.stdout, /^# pass 1$/mu);
  assert.match(result.stdout, /^UNIT_LANE_EXECUTED=1$/mu);
  assert.doesNotMatch(result.stdout + result.stderr, /skipping running files/u);
});

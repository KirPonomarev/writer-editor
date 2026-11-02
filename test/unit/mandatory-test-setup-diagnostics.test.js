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
  const packageBytes = fs.readFileSync(path.join(root, 'package.json'));
  const scripts = JSON.parse(packageBytes).scripts;
  const original = scriptName === 'test'
    ? 'npm run -s test:ops && node scripts/run-tests.js'
    : 'npm run -s test:ops && npm run -s test:rtk && node scripts/run-tests.js --mode=promotion';
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json'), 'utf8'));
  const protectedPackage = policy.protectedFiles.find(row => row.path === 'package.json');
  assert.ok(protectedPackage);
  assert.equal(require('node:crypto').createHash('sha256').update(packageBytes).digest('hex'), protectedPackage.sha256,
    'the entire protected package stays exact; early setup is implemented at its actual existing first step');
  assert.equal(scripts[scriptName], original);
  assert.equal(scripts['test:ops'], 'npm run -s ops:current-wave');
  assert.equal(scripts['ops:current-wave'], 'node scripts/guards/ops-current-wave-stop.mjs');
  const bad = fs.realpathSync(process.platform === 'darwin' ? '/private/tmp' : os.tmpdir());
  const wave = invokeCurrentWaveSetup({ temporaryPath: bad, platform: 'darwin' });
  assert.equal(wave.children.length, 0, 'the actual first package step refuses before doctor, so its original && chain cannot initialize RTK or units');
  assert.notEqual(wave.exitCode, 0);
  assert.match(wave.output, /TEST_SETUP_REFUSED/u);
  const args = scriptName === 'test'
    ? ['--with-ops=test:ops']
    : ['--mode=promotion', '--with-ops=test:ops,test:rtk'];
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

test('unsupported filename or positional input refuses before every mandatory prelude and test child', () => {
  const unsupported = 'scripts/ops/ops-synth-negative.test.cjs';
  assert.equal(fs.existsSync(path.join(root, unsupported)), true, 'unsupported format is an existing real file, not a missing-module kill');
  for (const args of [
    ['--with-ops=test:ops', unsupported],
    ['--with-ops=test:ops', 'not-a-supported-lane'],
    ['--with-ops=test:ops', '--not-a-supported-option'],
    ['--with-ops=test:ops', existingTest, unsupported],
  ]) {
    refusalBeforeChildren(invoke({ args, unit: { status: 7 } }));
  }
});

test('supported existing lanes explicit js mjs and default full selection stay available without ambiguous fallback', () => {
  const mjs = 'test/contracts/r24-admission-preparation.contract.test.mjs';
  assert.equal(fs.existsSync(path.join(root, mjs)), true);
  for (const args of [[existingTest], [mjs], ['unit', existingTest], ['electron', existingTest]]) {
    const result = invoke({ args }); reachedUnit(result); assert.equal(result.exitCode, 0);
    assert.ok(result.children.at(-1).argv.includes(path.join(root, args.at(-1))));
  }
  for (const lane of ['fast', 'closeout']) {
    const result = invoke({ args: [lane, '--dry-run'] });
    assert.equal(result.exitCode, 0); assert.equal(result.children.length, 0);
    refusalBeforeChildren(invoke({ args: [lane, existingTest] }));
  }
  // The unchanged serial full-runner contract separately executes default
  // selection through all original guards with its finite child boundary.
});

test('an explicitly empty check mode refuses instead of silently selecting the release default', () => {
  for (const args of [
    ['--with-ops=test:ops', '--mode='],
    ['--with-ops=test:ops', '--mode', '   '],
  ]) refusalBeforeChildren(invoke({ args, unit: { status: 7 } }));
});

function invokeCurrentWaveSetup({ temporaryPath = os.tmpdir(), platform = process.platform } = {}) {
  const wave = fs.readFileSync(path.join(root, 'scripts/guards/ops-current-wave-stop.mjs'), 'utf8');
  const imports = [
    "import { spawnSync } from 'node:child_process';\n",
    "import { validateTestEnvironment } from '../test-environment.cjs';\n",
  ];
  let executable = wave;
  assert.equal(executable.includes(imports[0]), true);
  for (const declaration of imports) executable = executable.replace(declaration, '');
  assert.equal(/^import\s/mu.test(executable), false, 'unknown module import cannot silently become a successful finite control');
  const children = [], output = [], stop = Symbol('finite existing wave exit');
  const host = { execPath: process.execPath, platform, env: { ...process.env, DEV_FAST_LANE: '', OPS_CONTEXT_MODE: 'release' },
    getuid: process.getuid?.bind(process), stdout: { write: value => { output.push(String(value)); return true; } },
    exitCode: undefined, exit(code) { this.exitCode = code; throw stop; } };
  const childPort = (command, argv = [], options = {}) => {
    if (path.basename(String(command)) === 'getconf' && argv.join(' ') === 'DARWIN_USER_TEMP_DIR') {
      return actualSpawnSync(command, argv, { ...options, encoding: 'utf8' });
    }
    children.push({ command, argv: [...argv] });
    return { status: 0, stdout: [
      'CURRENT_WAVE_STOP_CONDITION_OK=1', 'CURRENT_WAVE_STOP_CONDITION_FAIL_REASON=NONE',
      'CURRENT_WAVE_STRICT_DOCTOR_EXIT=0', 'CURRENT_WAVE_BOUNDARY_GUARD_EXIT=0',
      'STRICT_LIE_CLASS_01_VIOLATIONS_COUNT=0', 'STRICT_LIE_CLASS_02_VIOLATIONS_COUNT=0', 'STRICT_LIE_CLASSES_OK=1', '',
    ].join('\n'), stderr: '' };
  };
  let environmentChecks = 0;
  try {
    vm.runInNewContext(executable, {
      process: host, spawnSync: childPort,
      validateTestEnvironment(options) {
        environmentChecks += 1;
        const helper = actualRequire(path.join(root, 'scripts/test-environment.cjs'));
        return helper.validateTestEnvironment({ ...options, fs, path,
          os: { ...os, tmpdir: () => temporaryPath }, hostProcess: host, spawnSync: childPort });
      },
    }, { filename: 'actual-ops-current-wave-stop.mjs finite module-import adapter', timeout: 3000 });
  } catch (error) { if (error !== stop) throw error; }
  return { children, output: output.join(''), exitCode: host.exitCode, environmentChecks };
}
test('actual hard-lane OPS guard rejects known bad Darwin TMP before its expensive doctor child', () => {
  const bad = fs.realpathSync(process.platform === 'darwin' ? '/private/tmp' : os.tmpdir());
  assert.equal(bad.startsWith('/private/var/'), false);
  const result = invokeCurrentWaveSetup({ temporaryPath: bad, platform: 'darwin' });
  assert.equal(result.children.length, 0, 'no expensive doctor may initialize before the known temporary-path refusal');
  assert.notEqual(result.exitCode, 0);
  assert.match(result.output, /TEST_SETUP_REFUSED/u);
});
test('actual hard-lane OPS guard keeps one strict doctor and the existing token result on genuine setup', () => {
  const result = invokeCurrentWaveSetup();
  assert.equal(result.exitCode, 0);
  assert.equal(result.children.length, 1);
  assert.deepEqual(result.children[0].argv, ['scripts/doctor.mjs']);
  assert.match(result.output, /CURRENT_WAVE_STOP_CONDITION_GUARD_OK=1/u);
  assert.match(result.output, /CURRENT_WAVE_STRICT_DOCTOR_EXIT=0/u);
});


// Finite controls execute the maintained immutable-history read-port
// initializer. They do not represent actual WP603, native or release coverage.
async function maintainedWp603ReadPort() {
  const { pathToFileURL } = require('node:url');
  const target = path.join(root, 'scripts/ops/r24/tests/wp603-recovery-post-audit.test.mjs');
  const text = fs.readFileSync(target, 'utf8');
  const declarations = text.match(/^const realGit=.+;$/gmu);
  assert.equal(declarations?.length, 1, 'the exact maintained read-port initializer must be unique');
  const { createMemoizedGit } = await import(pathToFileURL(path.join(root,
    'scripts/ops/r24/corrective/post-audit-certification-set.mjs')).href);
  const calls = [], state = { failures: 0, aliasRevision: 0 };
  const payload = Buffer.from('immutable α carrier\n');
  const context = {
    REPO_ROOT: root, createMemoizedGit,
    execFileSync(command, args, options) {
      calls.push({ command, args: [...args], options: { ...options } });
      assert.equal(command, 'git');
      assert.equal(options.cwd, root);
      assert.equal(options.maxBuffer, 64 * 1024 * 1024);
      if (state.failures > 0) {
        state.failures -= 1;
        throw Object.assign(new Error('finite Git read failure'), { code: 'E_FINITE_GIT_READ' });
      }
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return 'finite-live-revision-' + (++state.aliasRevision) + '\n';
      }
      return options.encoding === 'utf8' ? payload.toString('utf8') : Buffer.from(payload);
    },
  };
  vm.runInNewContext(declarations[0] + '\nglobalThis.readGit = realGit;', context,
    { filename: 'literal maintained WP603 Git read port with finite process adapter', timeout: 3000 });
  return { git: context.readGit, calls, state, payload };
}
test('maintained historical read port avoids duplicate immutable reads and isolates returned Buffers', async () => {
  const { git, calls, payload } = await maintainedWp603ReadPort();
  const args = ['show', 'a'.repeat(40) + ':carrier.json'];
  const first = git(args);
  first[0] ^= 255;
  assert.deepEqual(git(args), payload, 'a consumer cannot poison the next immutable read');
  assert.equal(calls.length, 1, 'the same immutable object must pay for one real Git read');
});
test('maintained historical read port retries failures and keeps mutable aliases live', async () => {
  const { git, calls, state, payload } = await maintainedWp603ReadPort();
  const args = ['show', 'b'.repeat(40) + ':carrier.json'];
  state.failures = 1;
  assert.throws(() => git(args), error => error.code === 'E_FINITE_GIT_READ');
  assert.deepEqual(git(args), payload);
  assert.equal(calls.length, 2, 'a failed read cannot be cached');
  assert.notEqual(git(['rev-parse', 'HEAD']), git(['rev-parse', 'HEAD']));
  assert.equal(calls.length, 4, 'each mutable alias query must reach the adapter');
});
test('maintained historical read port preserves separate encoding and option identities', async () => {
  const { git, calls, payload } = await maintainedWp603ReadPort();
  const args = ['show', 'c'.repeat(40) + ':carrier.json'];
  const bytes = git(args, { encoding: null });
  const text = git(args, { encoding: 'utf8' });
  assert.equal(Buffer.isBuffer(bytes), true);
  assert.equal(typeof text, 'string');
  assert.deepEqual(bytes, payload);
  assert.equal(text, payload.toString('utf8'));
  assert.equal(calls.length, 2, 'byte and UTF8 requests retain their original option identities');
});

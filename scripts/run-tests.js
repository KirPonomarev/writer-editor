const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTapTotals, packUnitArtifact, readUnitArtifact, sha256 } = require(path.join(__dirname, 'test-diagnostics.cjs'));

const FAST_LANE_CONTRACT_TESTS = Object.freeze([
  'test/contracts/menu-config-backcompat.contract.test.js',
  'test/contracts/codex-no-repo-prompts.contract.test.js',
  'test/contracts/command-surface-bus-only.contract.test.js',
  'test/contracts/transition-exit-failsignal-token-wiring.contract.test.js',
]);

const TOOLBAR_CLOSEOUT_TESTS = Object.freeze([
  'test/unit/toolbar-profile-state.foundation.test.js',
  'test/unit/toolbar-runtime-projection.helpers.test.js',
  'test/unit/sector-m-toolbar-profile-switch.test.js',
  'test/unit/sector-m-toolbar-profile-ordering.test.js',
  'test/unit/toolbar-expansion-wave-c1.helpers.test.js',
  'test/contracts/phase03-safe-reset-last-stable-foundation-state.contract.test.js',
  'test/contracts/phase03-safe-reset-last-stable-artifact-state.contract.test.js',
]);

const ATLAS_EVENT_CONTRACT_TESTS = Object.freeze([
  'test/contracts/collab-apply-no-network-wiring.contract.test.js',
  'test/contracts/collab-apply-pipeline-deterministic.contract.test.js',
  'test/contracts/collab-apply-pipeline-typed-errors.contract.test.js',
  'test/contracts/yalken-atlas-v5-e10-c03-operation-replay-command-event-log.contract.test.js',
  'test/contracts/yalken-atlas-v5-p1-domain-event-contract-repair.contract.test.js',
]);

const FAST_LANE_FORBIDDEN_SEGMENTS = Object.freeze([
  'scripts/ops/run-wave.mjs',
  'scripts/guards/ops-current-wave-stop.mjs',
  'ops:current-wave',
  'ops-synth-negative.test.cjs',
  'OPS_SYNTH_OVERRIDE_',
]);

const CHECK_MODE_RELEASE = 'release';
const CHECK_MODE_PROMOTION = 'promotion';

function parseBooleanish(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on';
}

function normalizeCheckMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === CHECK_MODE_PROMOTION) return CHECK_MODE_PROMOTION;
  if (normalized === CHECK_MODE_RELEASE) return CHECK_MODE_RELEASE;
  return '';
}

function parseCli(rawArgs) {
  const out = {
    dryRun: false,
    modeArg: '',
    explicitTests: [],
    checkMode: CHECK_MODE_RELEASE,
    opsPrelude: [],
    error: '',
  };

  const tokens = [];
  let checkModeArg = '';
  let checkModeWasSpecified = false;
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = String(rawArgs[i] || '').trim();
    if (!arg) continue;
    if (arg === '--with-ops=test:ops' || arg === '--with-ops=test:ops,test:rtk') {
      if (out.opsPrelude.length > 0) {
        out.error = 'Duplicate required prelude is not allowed.';
        return out;
      }
      out.opsPrelude = arg === '--with-ops=test:ops' ? ['test:ops'] : ['test:ops', 'test:rtk'];
      continue;
    }
    if (arg.startsWith('--with-ops')) {
      out.error = 'Unsupported required prelude; expected the fixed test:ops or test:ops,test:rtk entry.';
      return out;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      checkModeWasSpecified = true;
      checkModeArg = arg.slice('--mode='.length);
      continue;
    }
    if (arg === '--mode') {
      checkModeWasSpecified = true;
      if (i + 1 >= rawArgs.length) {
        out.error = 'Missing value for --mode (expected release|promotion).';
        return out;
      }
      checkModeArg = String(rawArgs[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--promotionMode' && i + 1 < rawArgs.length) {
      checkModeArg = parseBooleanish(rawArgs[i + 1]) ? CHECK_MODE_PROMOTION : CHECK_MODE_RELEASE;
      i += 1;
      continue;
    }
    if (arg.startsWith('--promotionMode=')) {
      checkModeArg = parseBooleanish(arg.slice('--promotionMode='.length))
        ? CHECK_MODE_PROMOTION
        : CHECK_MODE_RELEASE;
      continue;
    }
    tokens.push(arg);
  }

  const lanes = new Set(['unit', 'electron', 'fast', 'closeout']);
  for (const [index, token] of tokens.entries()) {
    if (/\.test\.(?:js|mjs)$/u.test(token)) {
      out.explicitTests.push(token);
    } else if (index === 0 && lanes.has(token)) {
      out.modeArg = token;
    } else {
      out.error = 'Unsupported test filename or positional argument: ' + token;
      return out;
    }
  }
  if (out.explicitTests.length > 0 && ['fast', 'closeout'].includes(out.modeArg)) {
    out.error = 'Fixed fast or closeout lane cannot be combined with explicit test files.';
    return out;
  }

  if (checkModeArg || checkModeWasSpecified) {
    const normalizedMode = normalizeCheckMode(checkModeArg);
    if (!normalizedMode) {
      out.error = `Invalid --mode value "${checkModeArg}" (expected release|promotion).`;
      return out;
    }
    out.checkMode = normalizedMode;
  }

  return out;
}

function prepareTestInputs(rootDir, cli) {
  const mode = cli.modeArg === 'electron' ? 'electron' : 'unit';
  const selected = cli.explicitTests.length > 0
    ? cli.explicitTests.map(item => path.resolve(rootDir, item)).sort()
    : cli.modeArg === 'fast' ? FAST_LANE_CONTRACT_TESTS.map(item => path.resolve(rootDir, item)).sort()
      : cli.modeArg === 'closeout' ? TOOLBAR_CLOSEOUT_TESTS.map(item => path.resolve(rootDir, item)).sort()
        : listTestFiles(path.join(rootDir, 'test', mode)).sort();
  if (selected.length === 0) throw new Error('No test files selected for ' + mode);
  for (const file of selected) {
    if (!fs.statSync(file).isFile()) throw new Error('Test input is not a regular file: ' + file);
  }
  const evidenceDirectory = String(process.env.YALKEN_TEST_EVIDENCE_DIR || '').trim();
  if (evidenceDirectory) {
    if (!path.isAbsolute(evidenceDirectory) || fs.realpathSync(evidenceDirectory) !== evidenceDirectory
        || !fs.statSync(evidenceDirectory).isDirectory()) throw new Error('Evidence directory must be an existing canonical absolute directory');
    fs.accessSync(evidenceDirectory, fs.constants.W_OK);
  }
  const temporary = fs.realpathSync(os.tmpdir());
  const identity = fs.statSync(temporary);
  if (!identity.isDirectory()) throw new Error('Temporary path is not a directory');
  fs.accessSync(temporary, fs.constants.W_OK);
  const needsDarwinAlias = process.platform === 'darwin'
    && selected.includes(path.join(rootDir, 'test/unit/r24-wp307-writer-local-profile-integration.test.js'));
  if (needsDarwinAlias) {
    if (!temporary.startsWith('/private/var/')) {
      throw new Error('Native Save alias tests require the genuine canonical macOS temporary ancestry before initialization');
    }
    if (typeof process.getuid === 'function' && identity.uid !== process.getuid()) {
      throw new Error('Native Save test temporary root must belong to the current user');
    }
    const actual = spawnSync('/usr/bin/getconf', ['DARWIN_USER_TEMP_DIR'], { encoding: 'utf8' });
    if (actual.error || actual.status !== 0 || !String(actual.stdout || '').trim()) {
      throw new Error('Cannot verify the genuine macOS temporary parent');
    }
    const parent = fs.realpathSync(String(actual.stdout).trim());
    const relative = path.relative(parent, temporary);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
      throw new Error('Native Save test TMP must be inside the genuine OS temporary parent');
    }
  }
  return selected;
}

function testChildEnvironment(overrides = {}) {
  const env = { ...process.env, ...overrides };
  // This is a new test runner, not the parent runner's private reporter child.
  delete env.NODE_TEST_CONTEXT;
  // Artifact publication belongs to this caller, not nested test processes.
  delete env.YALKEN_TEST_EVIDENCE_DIR;
  return env;
}

function runRequiredOpsPrelude(rootDir, scripts) {
  for (const script of scripts) {
    const npmArgs = ['run', '-s', script];
    const npmExecPath = String(process.env.npm_execpath || '').trim();
    let command = 'npm', args = npmArgs;
    if (npmExecPath) {
      if (!path.isAbsolute(npmExecPath) || path.basename(npmExecPath).toLowerCase() !== 'npm-cli.js') {
        console.error('E_NPM_EXEC_PATH_INVALID=1');
        return 1;
      }
      command = process.execPath;
      args = [npmExecPath, ...npmArgs];
    } else if (process.platform === 'win32') {
      const shell = String(process.env.ComSpec || '').trim();
      if (!path.isAbsolute(shell)) {
        console.error('E_WINDOWS_COMMAND_SHELL_INVALID=1');
        return 1;
      }
      command = shell;
      args = ['/d', '/s', '/c', 'npm.cmd', ...npmArgs];
    }
    const result = spawnSync(command, args, { cwd: rootDir, stdio: 'inherit' });
    if (result.error) console.error('OPS_PRELUDE_SPAWN_ERROR=' + String(result.error.code || result.error.message));
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

function runOpsSynthNegativeTests(rootDir) {
  // R2.4 E0: the synthetic doctor negative suite is a committed static file.
  // Self-materializing a test into a fixed predictable /tmp path at run time
  // is quarantined: no run-time write, no fixed path, no self-authored
  // oracle materialization.
  const committedTestPath = path.join(rootDir, 'scripts', 'ops', 'ops-synth-negative.test.cjs');
  if (!fs.existsSync(committedTestPath)) {
    console.error('E_OPS_SYNTH_NEGATIVE_TEST_MISSING=1');
    return 1;
  }
  const result = spawnSync(process.execPath, ['--test', committedTestPath], {
    env: testChildEnvironment(),
    cwd: rootDir,
    stdio: 'inherit'
  });
  return result.status ?? 1;
}

function listTestFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      listTestFiles(fullPath, out);
      continue;
    }

    if (entry.isFile() && /\.test\.(?:js|mjs)$/u.test(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

function buildFastLanePlan(rootDir) {
  const fastTestsAbs = FAST_LANE_CONTRACT_TESTS
    .map((item) => path.resolve(rootDir, item))
    .sort();

  const doctorArgs = ['scripts/doctor.mjs', '--strict'];
  const testArgs = ['--test', ...fastTestsAbs];
  const doctorCommand = [process.execPath, ...doctorArgs].join(' ');
  const testCommand = [process.execPath, ...testArgs].join(' ');
  const commands = [doctorCommand, testCommand];
  const forbiddenHits = [];

  for (const command of commands) {
    for (const forbidden of FAST_LANE_FORBIDDEN_SEGMENTS) {
      if (command.includes(forbidden)) forbiddenHits.push({ command, forbidden });
    }
  }

  return {
    mode: 'fast',
    doctorRunCount: 1,
    testFiles: FAST_LANE_CONTRACT_TESTS.slice(),
    doctorCommand,
    testCommand,
    forbiddenHits,
  };
}

function runFastLane(rootDir, dryRun) {
  const plan = buildFastLanePlan(rootDir);
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return 0;
  }

  if (plan.forbiddenHits.length > 0) {
    console.error(`DEV_FAST_LANE_FORBIDDEN_SEGMENT=${JSON.stringify(plan.forbiddenHits)}`);
    return 1;
  }

  const env = {
    ...process.env,
    DEV_FAST_LANE: '1',
    CHECKS_BASELINE_VERSION: 'v1.3',
    EFFECTIVE_MODE: 'STRICT',
  };

  const doctor = spawnSync(process.execPath, ['scripts/doctor.mjs', '--strict'], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  });
  const doctorExit = doctor.status ?? 1;
  if (doctorExit !== 0) return doctorExit;

  const fastTestsAbs = plan.testFiles
    .map((item) => path.resolve(rootDir, item))
    .sort();
  const tests = spawnSync(process.execPath, ['--test', ...fastTestsAbs], {
    cwd: rootDir,
    stdio: 'inherit',
    env: testChildEnvironment(env),
  });
  return tests.status ?? 1;
}

function readSkippedCount(stdout, stderr) {
  const combined = `${String(stdout || '')}\n${String(stderr || '')}`;
  const matches = [...combined.matchAll(/# skipped (\d+)/g)];
  if (matches.length === 0) return 0;
  const value = Number(matches[matches.length - 1][1]);
  return Number.isInteger(value) ? value : 0;
}

function publishUnitOutput(result) {
  const writeFull = () => {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  };
  const directory = String(process.env.YALKEN_TEST_EVIDENCE_DIR || '').trim();
  if (!directory) {
    writeFull();
    console.log('UNIT_LANE_FULL_ARTIFACT=STDOUT_FULL_TAP');
    return true;
  }
  try {
    const compressed = packUnitArtifact(result);
    const file = path.join(directory, 'unit-' + process.pid + '-' + require('node:crypto').randomUUID() + '.tap.gz');
    fs.writeFileSync(file, compressed, { flag: 'wx', mode: 0o600, flush: true });
    const reread = fs.readFileSync(file);
    if (!reread.equals(compressed)) throw new Error('UNIT_ARTIFACT_READBACK_MISMATCH');
    const decoded = readUnitArtifact(reread);
    process.stdout.write(decoded.consoleStdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.log('UNIT_LANE_FULL_ARTIFACT=' + JSON.stringify(file));
    console.log('UNIT_LANE_FULL_ARTIFACT_SHA256=' + sha256(reread));
    console.log('UNIT_LANE_DIAGNOSTIC_PAYLOADS_VERIFIED=' + decoded.diagnostics);
    console.log('UNIT_LANE_OPAQUE_DIAGNOSTIC_LINES_RETAINED=' + decoded.opaqueDiagnostics);
    return true;
  } catch (error) {
    // Original output is retained even when transport or interpretation fails.
    writeFull();
    console.error('UNIT_LANE_ARTIFACT_REFUSED=' + String(error.message || error));
    return false;
  }
}

function runToolbarCloseoutLane(rootDir, dryRun) {
  const testsAbs = TOOLBAR_CLOSEOUT_TESTS
    .map((item) => path.resolve(rootDir, item))
    .sort();

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({
      mode: 'closeout',
      failOnSkip: true,
      testFiles: TOOLBAR_CLOSEOUT_TESTS.slice(),
      command: [process.execPath, '--test', ...testsAbs].join(' '),
    }, null, 2)}\n`);
    return 0;
  }

  const result = spawnSync(process.execPath, ['--test', ...testsAbs], {
    env: testChildEnvironment(),
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const exitCode = result.status ?? 1;
  const skippedCount = readSkippedCount(result.stdout, result.stderr);
  if (skippedCount > 0) {
    console.error(`TOOLBAR_CLOSEOUT_SKIP_COUNT=${skippedCount}`);
    return 1;
  }

  return exitCode;
}

function runPerfBaselineGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const npmArgs = ['run', '-s', 'perf:baseline:check', '--', `--mode=${checkMode}`];
  const npmExecPath = String(process.env.npm_execpath || '').trim();
  let command = 'npm';
  let commandArgs = npmArgs;

  if (npmExecPath) {
    if (!path.isAbsolute(npmExecPath) || path.basename(npmExecPath).toLowerCase() !== 'npm-cli.js') {
      console.error('E_NPM_EXEC_PATH_INVALID=1');
      return 1;
    }
    command = process.execPath;
    commandArgs = [npmExecPath, ...npmArgs];
  } else if (process.platform === 'win32') {
    const commandShell = String(process.env.ComSpec || '').trim();
    if (!path.isAbsolute(commandShell)) {
      console.error('E_WINDOWS_COMMAND_SHELL_INVALID=1');
      return 1;
    }
    command = commandShell;
    commandArgs = ['/d', '/s', '/c', 'npm.cmd', ...npmArgs];
  }

  const result = spawnSync(
    command,
    commandArgs,
    { cwd: rootDir, stdio: 'inherit' },
  );
  if (result.error) console.error(`E_PERF_BASELINE_SPAWN=${result.error.code || 'UNKNOWN'}`);
  return result.status ?? 1;
}

function runAtlasEventContractGuard(rootDir) {
  const testsAbs = ATLAS_EVENT_CONTRACT_TESTS
    .map((item) => path.resolve(rootDir, item))
    .sort();
  const result = spawnSync(process.execPath, ['--test', ...testsAbs], {
    env: testChildEnvironment(),
    cwd: rootDir,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function runCommandNamespaceGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    ['scripts/ops/check-command-namespace.mjs', `--mode=${checkMode}`],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runCommandNamespaceStaticGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    ['scripts/ops/check-command-namespace-static.mjs', `--mode=${checkMode}`],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runEnabledWhenDslGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    ['scripts/ops/check-enabledwhen-dsl.mjs', `--mode=${checkMode}`],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runMenuConfigNormalizationGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const outPath = path.join(os.tmpdir(), `menu-config.normalized.${process.pid}.json`);
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/menu-config-normalize.mjs',
      '--in',
      'src/menu/menu-config.v2.json',
      '--context',
      'test/fixtures/menu/context.default.json',
      '--out',
      outPath,
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runMenuOverlayStackGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/check-menu-overlay-stack.mjs',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runMenuSnapshotGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/menu-config-normalize.mjs',
      '--snapshot-check',
      '--snapshot-id=menu-default-desktop-minimal-undo-redo-20261025',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runMenuArtifactExportGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/menu-config-normalize.mjs',
      '--export-artifact',
      '--out',
      'docs/OPS/ARTIFACTS/menu/menu.normalized.json',
      '--snapshot-id',
      'menu-default-desktop-minimal-undo-redo-20261025',
      '--lock-artifact',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runMenuArtifactLockGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/check-menu-artifact-lock.mjs',
      '--snapshot-id=menu-default-desktop-minimal-undo-redo-20261025',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runMenuRuntimeEquivalentGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/menu-config-normalize.mjs',
      '--runtime-equivalent-check',
      '--context',
      'test/fixtures/menu/context.default.json',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runLawPathCanonGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/check-law-path-canon.mjs',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runExecutionSequenceGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/check-execution-sequence.mjs',
      `--mode=${checkMode}`,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

function runReleaseCandidateGuard(rootDir, isPromotionMode) {
  const checkMode = isPromotionMode ? 'promotion' : 'release';
  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-rc-evidence-'));
  const result = spawnSync(
    process.execPath,
    [
      'scripts/ops/release-candidate.mjs',
      '--verify',
      `--mode=${checkMode}`,
      '--evidence-root',
      evidenceRoot,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  return result.status ?? 1;
}

const rootDir = path.resolve(__dirname, '..');
const cli = parseCli(process.argv.slice(2));
if (cli.error) {
  console.error(cli.error);
  process.exitCode = 1;
  return;
}

const checkMode = cli.checkMode === CHECK_MODE_PROMOTION ? CHECK_MODE_PROMOTION : CHECK_MODE_RELEASE;
const isPromotionMode = checkMode === CHECK_MODE_PROMOTION;
const dryRun = cli.dryRun;
const modeArg = cli.modeArg;

let testFiles;
try {
  testFiles = prepareTestInputs(rootDir, cli);
} catch (error) {
  console.error('TEST_SETUP_REFUSED=' + String(error.message || error));
  process.exitCode = 1;
  return;
}
const preludeExit = runRequiredOpsPrelude(rootDir, cli.opsPrelude);
if (preludeExit !== 0) {
  process.exitCode = preludeExit;
  return;
}

if (modeArg === 'fast') {
  process.exitCode = runFastLane(rootDir, dryRun);
  return;
}

if (modeArg === 'closeout') {
  process.exitCode = runToolbarCloseoutLane(rootDir, dryRun);
  return;
}

const explicitTests = cli.explicitTests;
const mode = modeArg === 'electron' ? 'electron' : 'unit';
const testDir = path.join(rootDir, 'test', mode);
// The same complete file cohort was validated before any expensive prelude.

if (testFiles.length === 0) {
  console.error(`No test files found in ./test/${mode} (expected **/*.test.js or **/*.test.mjs).`);
  process.exitCode = 1;
} else {
  let exitCode = 0;

  if (explicitTests.length === 0) {
    const opsExit = runOpsSynthNegativeTests(rootDir);
    if (opsExit !== 0) {
      process.exitCode = opsExit;
      return;
    }
  }

  // R2.4 E0 runner truth: capture the TAP stream instead of inheriting so
  // the lane fails closed on a zero executed denominator and reports the
  // exact skip inventory instead of hiding it inside an aggregate exit code.
  // Keep elapsed-time contracts isolated from competing test-file processes.
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...testFiles], {
    env: testChildEnvironment(),
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  exitCode = result.status ?? 1;
  if (!publishUnitOutput(result) && exitCode === 0) exitCode = 1;
  const tapTotals = readTapTotals(result.stdout, result.stderr);
  console.log(`UNIT_LANE_EXECUTED=${tapTotals.executed === null ? 'UNKNOWN' : tapTotals.executed}`);
  console.log(`UNIT_LANE_SKIPPED_DENOMINATOR=${tapTotals.skipped === null ? 'UNKNOWN' : tapTotals.skipped}`);
  if (result.error) console.error('UNIT_LANE_SPAWN_ERROR=' + String(result.error.code || result.error.message));
  if (result.signal) console.error('UNIT_LANE_SIGNAL=' + String(result.signal));
  if (!tapTotals.valid || tapTotals.fail > 0 || tapTotals.cancelled > 0) {
    console.error('UNIT_LANE_EVIDENCE_INVALID=complete consistent TAP totals are required');
    if (exitCode === 0) exitCode = 1;
  }
  if (tapTotals.executed === 0) {
    console.error('E_ZERO_DENOMINATOR_UNIT_LANE=1');
    exitCode = 1;
  }
  if (exitCode === 0 && explicitTests.length === 0) {
    const atlasEventContractsExit = runAtlasEventContractGuard(rootDir);
    if (atlasEventContractsExit !== 0) {
      process.exitCode = atlasEventContractsExit;
      return;
    }
    const perfExit = runPerfBaselineGuard(rootDir, isPromotionMode);
    if (perfExit !== 0) {
      process.exitCode = perfExit;
      return;
    }
    const namespaceExit = runCommandNamespaceGuard(rootDir, isPromotionMode);
    if (namespaceExit !== 0) {
      process.exitCode = namespaceExit;
      return;
    }
    const namespaceStaticExit = runCommandNamespaceStaticGuard(rootDir, isPromotionMode);
    if (namespaceStaticExit !== 0) {
      process.exitCode = namespaceStaticExit;
      return;
    }
    const enabledWhenExit = runEnabledWhenDslGuard(rootDir, isPromotionMode);
    if (enabledWhenExit !== 0) {
      process.exitCode = enabledWhenExit;
      return;
    }
    const menuNormalizationExit = runMenuConfigNormalizationGuard(rootDir, isPromotionMode);
    if (menuNormalizationExit !== 0) {
      process.exitCode = menuNormalizationExit;
      return;
    }
    const menuOverlayStackExit = runMenuOverlayStackGuard(rootDir, isPromotionMode);
    if (menuOverlayStackExit !== 0) {
      process.exitCode = menuOverlayStackExit;
      return;
    }
    const menuSnapshotExit = runMenuSnapshotGuard(rootDir, isPromotionMode);
    if (menuSnapshotExit !== 0) {
      process.exitCode = menuSnapshotExit;
      return;
    }
    const menuArtifactExportExit = runMenuArtifactExportGuard(rootDir, isPromotionMode);
    if (menuArtifactExportExit !== 0) {
      process.exitCode = menuArtifactExportExit;
      return;
    }
    const menuArtifactLockExit = runMenuArtifactLockGuard(rootDir, isPromotionMode);
    if (menuArtifactLockExit !== 0) {
      process.exitCode = menuArtifactLockExit;
      return;
    }
    const menuRuntimeEquivalentExit = runMenuRuntimeEquivalentGuard(rootDir, isPromotionMode);
    if (menuRuntimeEquivalentExit !== 0) {
      process.exitCode = menuRuntimeEquivalentExit;
      return;
    }
    const lawPathCanonExit = runLawPathCanonGuard(rootDir, isPromotionMode);
    if (lawPathCanonExit !== 0) {
      process.exitCode = lawPathCanonExit;
      return;
    }
    const executionSequenceExit = runExecutionSequenceGuard(rootDir, isPromotionMode);
    if (executionSequenceExit !== 0) {
      process.exitCode = executionSequenceExit;
      return;
    }
    const releaseCandidateExit = runReleaseCandidateGuard(rootDir, isPromotionMode);
    if (releaseCandidateExit !== 0) {
      process.exitCode = releaseCandidateExit;
      return;
    }
  }
  process.exitCode = exitCode;
}

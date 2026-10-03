const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

const REPO_ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const RUN_TESTS_PATH = path.join(REPO_ROOT, 'scripts', 'run-tests.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertContainsRegex(text, regex, label) {
  assert.equal(regex.test(text), true, `missing wiring: ${label}`);
}

function captureFullRunner(failureAt = -1) {
  const calls = [], output = [];
  const runtime = { execPath: process.execPath, argv: [process.execPath, RUN_TESTS_PATH],
    env: {}, platform: 'linux', stdout: { write: value => output.push(value) },
    stderr: { write: value => output.push(value) }, exitCode: undefined };
  const loader = name => {
    if (name === 'node:child_process') return { spawnSync(command, args, options) {
      calls.push({ command, args: Array.from(args), options });
      return { status: calls.length - 1 === failureAt ? 7 : 0,
        stdout: '# pass 1\n# fail 0\n# skipped 0\n', stderr: '' };
    } };
    // Guard output locations are planned, not materialized by this harness.
    if (name === 'node:fs') return { ...fs, mkdtempSync: prefix => `${prefix}contract` };
    return require(name);
  };
  const execute = vm.runInNewContext(`(function(require, __dirname, process, console) {\n${fs.readFileSync(RUN_TESTS_PATH, 'utf8')}\n})`);
  execute(loader, path.dirname(RUN_TESTS_PATH), runtime, { log: value => output.push(value), error: value => output.push(value) });
  return { calls, exitCode: runtime.exitCode, output };
}

test('serial full runner retains every unit file and the complete downstream guard order', () => {
  const result = captureFullRunner();
  assert.equal(result.exitCode, 0);
  const files = fs.readdirSync(path.join(REPO_ROOT, 'test/unit'), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.test\.(?:js|mjs)$/u.test(entry.name))
    .map(entry => path.join(entry.parentPath ?? entry.path, entry.name)).sort();
  assert(files.length > 0);
  assert.deepEqual(result.calls[1].args, ['--test', '--test-concurrency=1', ...files]);
  const sequence = result.calls.map(call => {
    if (call.args[0] === '--test') return call.args.includes('--test-concurrency=1') ? 'unit' : path.basename(call.args[1]);
    if (call.args[0] === 'run') return call.args[2];
    return `${path.basename(call.args[0])}:${call.args[1]}`;
  });
  assert.deepEqual(sequence, [
    'ops-synth-negative.test.cjs', 'unit', 'collab-apply-no-network-wiring.contract.test.js',
    'perf:baseline:check', 'check-command-namespace.mjs:--mode=release',
    'check-command-namespace-static.mjs:--mode=release', 'check-enabledwhen-dsl.mjs:--mode=release',
    'menu-config-normalize.mjs:--in', 'check-menu-overlay-stack.mjs:--mode=release',
    'menu-config-normalize.mjs:--snapshot-check', 'menu-config-normalize.mjs:--export-artifact',
    'check-menu-artifact-lock.mjs:--snapshot-id=menu-default-desktop-minimal',
    'menu-config-normalize.mjs:--runtime-equivalent-check', 'check-law-path-canon.mjs:--mode=release',
    'check-execution-sequence.mjs:--mode=release', 'release-candidate.mjs:--verify',
  ]);
});

test('serial full runner propagates failures and never runs guards after a failed stage', () => {
  for (let failedIndex = 0; failedIndex < 16; failedIndex += 1) {
    const result = captureFullRunner(failedIndex);
    assert.equal(result.exitCode, 7, `stage ${failedIndex}`);
    assert.equal(result.calls.length, failedIndex + 1, `stage ${failedIndex}`);
  }
});

test('promotion heavy lane entrypoint: package script exists and is not fast lane', () => {
  const pkg = readJson(PACKAGE_JSON_PATH);
  const promotionCheck = String(pkg && pkg.scripts ? pkg.scripts['promotion:check'] || '' : '');

  assert.ok(promotionCheck.length > 0, 'promotion:check must exist in package.json');
  assert.ok(promotionCheck.includes('scripts/run-tests.js'), 'promotion:check must call scripts/run-tests.js');
  assert.ok(promotionCheck.includes('--mode=promotion'), 'promotion:check must pass --mode=promotion');
  assert.equal(promotionCheck.includes('dev:fast'), false, 'promotion:check must not call dev:fast');
  assert.equal(/\bfast\b/u.test(promotionCheck), false, 'promotion:check must not target fast lane');
});

test('promotion heavy lane entrypoint: run-tests parses strict checkMode and fast lane isolation stays intact', () => {
  const source = fs.readFileSync(RUN_TESTS_PATH, 'utf8');

  assert.ok(source.includes("if (arg.startsWith('--mode='))"), 'run-tests must parse --mode=<value>');
  assert.ok(source.includes("if (arg === '--mode')"), 'run-tests must parse --mode <value>');
  assert.ok(source.includes('checkMode: CHECK_MODE_RELEASE'), 'run-tests must default to release checkMode');
  assert.ok(source.includes('const checkMode = cli.checkMode === CHECK_MODE_PROMOTION ? CHECK_MODE_PROMOTION : CHECK_MODE_RELEASE;'), 'run-tests must clamp checkMode to release|promotion');
  assert.ok(source.includes("if (modeArg === 'fast')"), 'fast branch must remain explicit and isolated');
  assert.ok(source.includes('runFastLane(rootDir, dryRun)'), 'fast branch must use dedicated fast lane runner');
});

test('promotion heavy lane entrypoint: heavy lane propagates --mode=${checkMode} to promotion-aware checks', () => {
  const source = fs.readFileSync(RUN_TESTS_PATH, 'utf8');

  assertContainsRegex(
    source,
    /'perf:baseline:check'[\s\S]*?`--mode=\$\{checkMode\}`/u,
    'perf baseline guard mode wiring',
  );
  assertContainsRegex(
    source,
    /'scripts\/ops\/menu-config-normalize\.mjs'[\s\S]*?'--snapshot-check'[\s\S]*?`--mode=\$\{checkMode\}`/u,
    'menu snapshot check mode wiring',
  );
  assertContainsRegex(
    source,
    /'scripts\/ops\/check-menu-artifact-lock\.mjs'[\s\S]*?`--mode=\$\{checkMode\}`/u,
    'menu artifact lock mode wiring',
  );
  assertContainsRegex(
    source,
    /'scripts\/ops\/menu-config-normalize\.mjs'[\s\S]*?'--runtime-equivalent-check'[\s\S]*?`--mode=\$\{checkMode\}`/u,
    'menu runtime-equivalent mode wiring',
  );
  assertContainsRegex(
    source,
    /'scripts\/ops\/check-command-namespace\.mjs'[\s\S]*?`--mode=\$\{checkMode\}`/u,
    'command namespace mode wiring',
  );
  assertContainsRegex(
    source,
    /'scripts\/ops\/check-command-namespace-static\.mjs'[\s\S]*?`--mode=\$\{checkMode\}`/u,
    'command namespace static mode wiring',
  );
  assertContainsRegex(
    source,
    /'scripts\/ops\/release-candidate\.mjs'[\s\S]*?'--evidence-root'[\s\S]*?evidenceRoot/u,
    'release candidate evidence root isolation wiring',
  );
});

test('promotion heavy lane entrypoint: run-tests accepts --mode=promotion without fast branch', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promotion-mode-smoke-'));
  const tmpTestPath = path.join(tmpDir, 'promotion-mode-smoke.test.js');
  fs.writeFileSync(
    tmpTestPath,
    "const test = require('node:test'); test('smoke', () => {});\n",
    'utf8',
  );

  const result = spawnSync(process.execPath, ['scripts/run-tests.js', '--mode=promotion', tmpTestPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.equal(result.status, 0, `expected promotion mode smoke pass:\n${result.stdout}\n${result.stderr}`);
});

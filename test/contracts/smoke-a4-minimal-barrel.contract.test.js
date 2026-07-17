const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const SMOKE_SOURCE = path.join(ROOT, 'scripts', 'smoke-a4.mjs');
const PRIVATE_CONTRACTS = [
  'dialog-port.contract.ts',
  'filesystem-port.contract.ts',
  'platform-info-port.contract.ts',
];

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function writeFixture(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function commitFixture(root, message) {
  assert.equal(run('git', ['add', '.'], root).status, 0);
  const result = run(
    'git',
    ['-c', 'user.name=Smoke Test', '-c', 'user.email=smoke@example.invalid', 'commit', '-m', message],
    root,
  );
  assert.equal(result.status, 0, result.stderr);
}

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-smoke-a4-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.equal(run('git', ['init', '--quiet'], root).status, 0);
  writeFixture(root, 'scripts/ops-gate.mjs', 'process.exit(0);\n');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(SMOKE_SOURCE, path.join(root, 'scripts', 'smoke-a4.mjs'));
  writeFixture(
    root,
    'src/contracts/index.ts',
    'export type { PublicContract } from "./public.contract";\n',
  );
  writeFixture(root, 'src/contracts/public.contract.ts', 'export type PublicContract = {};\n');
  for (const basename of PRIVATE_CONTRACTS) {
    writeFixture(root, `src/contracts/${basename}`, 'export type PrivateContract = {};\n');
  }
  commitFixture(root, 'fixture baseline');
  return root;
}

test('smoke A4 accepts the three contracts intentionally outside the minimal root barrel', (t) => {
  const root = createFixture(t);
  const result = run(process.execPath, ['scripts/smoke-a4.mjs'], root);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /SMOKE_A4: PASS/);
});

test('smoke A4 still rejects a new contract missing from the root barrel', (t) => {
  const root = createFixture(t);
  writeFixture(root, 'src/contracts/unexported.contract.ts', 'export type Unexported = {};\n');
  commitFixture(root, 'add unexported contract');

  const result = run(process.execPath, ['scripts/smoke-a4.mjs'], root);

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /REASON: MISSING_REEXPORTS/);
  assert.match(result.stdout, /unexported\.contract\.ts/);
});

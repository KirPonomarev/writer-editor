import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertExactToolchain,
  checkToolchain,
  evaluateExactRuntime,
  nodeSatisfies,
  parseNodeRange,
} from '../../toolchain.mjs';

const RANGE = '>=20.19.0 <21.0.0';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..');

test('nodeSatisfies bounds the pinned line exactly', () => {
  assert.equal(nodeSatisfies('v20.19.0', RANGE), true);
  assert.equal(nodeSatisfies('20.19.5', RANGE), true);
  assert.equal(nodeSatisfies('20.20.0', RANGE), true);
  assert.equal(nodeSatisfies('20.18.9', RANGE), false);
  assert.equal(nodeSatisfies('21.0.0', RANGE), false);
  assert.equal(nodeSatisfies('18.20.8', RANGE), false);
  assert.throws(() => parseNodeRange('node20'), (e) => e.code === 'E_TOOLCHAIN_RANGE_SHAPE');
  assert.throws(() => nodeSatisfies('vX', RANGE), (e) => e.code === 'E_TOOLCHAIN_VERSION_SHAPE');
});

const git = (repo, args) => {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

function makeTree({ pkg = {}, workflows = {}, lockfile = { lockfileVersion: 3 }, contract = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-q0-tc-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'fixture',
    packageManager: 'npm@10.8.2',
    engines: { node: RANGE, npm: '>=10.0.0 <11.0.0' },
    ...pkg,
  }));
  if (lockfile) fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lockfile));
  const wfDir = path.join(dir, '.github', 'workflows');
  fs.mkdirSync(wfDir, { recursive: true });
  for (const [name, text] of Object.entries(workflows)) fs.writeFileSync(path.join(wfDir, name), text);
  const contractDoc = contract || {
    schemaVersion: 'yalken.toolchain-contract.v1',
    node: { exact: '20.19.5', enginesRange: RANGE },
    npm: { exact: '10.8.2', packageManager: 'npm@10.8.2', enginesRange: '>=10.0.0 <11.0.0', lockfileVersion: 3, forbiddenLockfiles: ['pnpm-lock.yaml', 'yarn.lock'] },
    workflows: {
      singleNodeVersion: '20.19.x',
      nodeVersionFile: '.node-version',
      exactNodeVersion: '20.19.5',
      exactNpmVersion: '10.8.2',
      allowedActionPins: { 'actions/checkout': 'v4', 'actions/setup-node': 'v4' },
    },
  };
  const cDir = path.join(dir, 'docs', 'OPS', 'R24');
  fs.mkdirSync(cDir, { recursive: true });
  fs.writeFileSync(path.join(cDir, 'TOOLCHAIN_CONTRACT_V1.json'), JSON.stringify(contractDoc));
  fs.writeFileSync(path.join(dir, '.node-version'), `${contractDoc.node.exact}\n`);
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@i.invalid', '-c', 'user.name=t', 'commit', '-qm', 'init']);
  return dir;
}

const wf = ({ nodeVersionFile = '.node-version', directVersion = null } = {}) => `name: t\non: [push]\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          ${directVersion ? `node-version: "${directVersion}"` : `node-version-file: "${nodeVersionFile}"`}\n`;

test('coherent synthetic tree passes', () => {
  const dir = makeTree({ workflows: { 'a.yml': wf() } });
  const result = checkToolchain(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2', enforceExactRuntime: true });
  assert.equal(result.ok, true, JSON.stringify(result.failures));
  assert.deepEqual(result.required, { node: '20.19.5', npm: '10.8.2', packageManager: 'npm@10.8.2', nodeVersionFile: '.node-version' });
  assert.equal(result.actual.node, '20.19.5');
  assert.equal(result.actual.npm, '10.8.2');
});

test('missing engines, unsupported runtime and lockfile drift fail closed', () => {
  const dir = makeTree({ workflows: { 'a.yml': wf() } });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fixture' }));
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@i.invalid', '-c', 'user.name=t', 'commit', '-qm', 'drop-engines']);
  let result = checkToolchain(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.ok(result.failures.includes('E_TOOLCHAIN_ENGINES_MISSING'));
  result = checkToolchain(dir, { currentNodeVersion: 'v18.20.8', currentNpmVersion: '10.8.2' });
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_NODE_UNSUPPORTED')));
  const dir2 = makeTree({ lockfile: { lockfileVersion: 2 }, workflows: { 'a.yml': wf() } });
  result = checkToolchain(dir2, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_LOCKFILE_VERSION')));
});

test('engines range drift from contract fails closed', () => {
  const dir = makeTree({ pkg: { engines: { node: '>=18.0.0', npm: '>=10.0.0 <11.0.0' } }, workflows: { 'a.yml': wf() } });
  const result = checkToolchain(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_ENGINES_DRIFT')));
});

test('workflow matrix incoherence and unregistered actions fail closed', () => {
  const dir = makeTree({ workflows: { 'a.yml': wf({ directVersion: '18' }) } });
  let result = checkToolchain(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_CI_NODE_INCOHERENT:a.yml:18')));
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_CI_NODE_VERSION_FILE:a.yml')));
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_CI_NODE_DIRECT_VERSION:a.yml')));
  const dir2 = makeTree({ workflows: { 'b.yml': 'name: t\non: [push]\njobs:\n  j:\n    steps:\n      - uses: actions/unknown-action@v9\n' } });
  result = checkToolchain(dir2, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.ok(result.failures.some((f) => f.startsWith('E_TOOLCHAIN_ACTION_UNREGISTERED:b.yml:actions/unknown-action@v9')));
});

test('forbidden tracked lockfile fails closed', () => {
  const dir = makeTree({ workflows: { 'a.yml': wf() } });
  fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@i.invalid', '-c', 'user.name=t', 'commit', '-qm', 'add-pnpm']);
  const result = checkToolchain(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.ok(result.failures.includes('E_TOOLCHAIN_FORBIDDEN_LOCKFILE:pnpm-lock.yaml'));
});

test('exact runtime identity fails typed before expensive suites', () => {
  const dir = makeTree({ workflows: { 'a.yml': wf() } });
  const pass = evaluateExactRuntime(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.8.2' });
  assert.equal(pass.status, 'PASS');
  assert.equal(pass.schemaVersion, 'yalken.r24.exact-toolchain-entrypoint.v1');
  const wrongNode = evaluateExactRuntime(dir, { currentNodeVersion: 'v20.19.6', currentNpmVersion: '10.8.2' });
  assert.equal(wrongNode.status, 'FAIL');
  assert.ok(wrongNode.failures.includes('E_R24_NODE_RUNTIME_UNSUPPORTED:20.19.6'));
  const wrongNpm = evaluateExactRuntime(dir, { currentNodeVersion: 'v20.19.5', currentNpmVersion: '10.9.0' });
  assert.ok(wrongNpm.failures.includes('E_R24_NPM_RUNTIME_UNSUPPORTED:10.9.0'));
  assert.throws(() => assertExactToolchain(dir, { currentNodeVersion: 'v26.7.0', currentNpmVersion: '11.19.0' }), (error) => {
    assert.equal(error.code, 'E_R24_EXACT_TOOLCHAIN_UNSUPPORTED');
    assert.match(error.message, /E_R24_NODE_RUNTIME_UNSUPPORTED:26\.7\.0/);
    return true;
  });
});

test('all package R24 local entrypoints carry the cheap exact-toolchain precheck', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json')));
  const missing = Object.entries(pkg.scripts)
    .filter(([name]) => name === 'r24:test-inventory' || name.startsWith('test:r24'))
    .filter(([, command]) => !String(command).startsWith('npm run -s r24:toolchain && '))
    .map(([name]) => name);
  assert.deepEqual(missing, []);
});

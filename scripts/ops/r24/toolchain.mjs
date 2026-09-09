#!/usr/bin/env node
// R2.4 Q0 — supported toolchain law checker.
// Binds the pinned runtime/package/CI profile: engines presence and
// satisfaction, npm-only lockfile policy, single CI Node line across the
// workflow matrix, and pinned action majors. Drift fails closed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { readJsonBounded, R24Error } from './canonical-json.mjs';

export const TOOLCHAIN_CONTRACT_PATH = path.join('docs', 'OPS', 'R24', 'TOOLCHAIN_CONTRACT_V1.json');
export const EXACT_TOOLCHAIN_SCHEMA_VERSION = 'yalken.r24.exact-toolchain-entrypoint.v1';

const VERSION_RE = /^\d+\.\d+\.\d+$/u;

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/u, '');
}

function npmVersion() {
  const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm --version'] : ['--version'];
  return execFileSync(executable, args, { encoding: 'utf8', windowsHide: true }).trim();
}

export function parseNodeRange(range) {
  const match = String(range || '').match(/^>=(\d+)\.(\d+)\.(\d+)\s+<(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new R24Error('E_TOOLCHAIN_RANGE_SHAPE', String(range));
  return {
    min: match.slice(1, 4).map(Number),
    maxExclusive: match.slice(4, 7).map(Number),
  };
}

const cmp3 = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
};

export function nodeSatisfies(version, range) {
  const v = String(version || '').replace(/^v/, '').split('.').map((x) => Number(x));
  if (v.length < 3 || v.some((x) => !Number.isInteger(x))) throw new R24Error('E_TOOLCHAIN_VERSION_SHAPE', String(version));
  const { min, maxExclusive } = parseNodeRange(range);
  return cmp3(v, min) >= 0 && cmp3(v, maxExclusive) < 0;
}

function readContract(rootDir) {
  const contract = readJsonBounded(path.join(rootDir, TOOLCHAIN_CONTRACT_PATH));
  if (contract.schemaVersion !== 'yalken.toolchain-contract.v1') throw new R24Error('E_TOOLCHAIN_CONTRACT_SCHEMA');
  return contract;
}

export function evaluateExactRuntime(rootDir, {
  currentNodeVersion = process.version,
  currentNpmVersion = null,
  checkRuntime = true,
} = {}) {
  const contract = readContract(rootDir);
  const pkg = readJsonBounded(path.join(rootDir, 'package.json'));
  const nodeVersionFile = contract.workflows?.nodeVersionFile || '.node-version';
  const required = {
    node: normalizeVersion(contract.node?.exact),
    npm: normalizeVersion(contract.npm?.exact),
    packageManager: String(contract.npm?.packageManager || ''),
    nodeVersionFile,
  };
  const actual = {
    node: normalizeVersion(currentNodeVersion),
    npm: currentNpmVersion === null ? null : normalizeVersion(currentNpmVersion),
    nodeExecutable: process.execPath,
    platform: process.platform,
    arch: process.arch,
  };
  const failures = [];

  if (!VERSION_RE.test(required.node)) failures.push(`E_R24_TOOLCHAIN_CONTRACT_NODE_EXACT:${String(contract.node?.exact)}`);
  if (!VERSION_RE.test(required.npm)) failures.push(`E_R24_TOOLCHAIN_CONTRACT_NPM_EXACT:${String(contract.npm?.exact)}`);
  if (required.packageManager !== `npm@${required.npm}`) failures.push(`E_R24_TOOLCHAIN_PACKAGE_MANAGER_CONTRACT:${required.packageManager}`);
  if (contract.workflows?.exactNodeVersion !== required.node) failures.push(`E_R24_TOOLCHAIN_CI_NODE_EXACT:${String(contract.workflows?.exactNodeVersion)}`);
  if (contract.workflows?.exactNpmVersion !== required.npm) failures.push(`E_R24_TOOLCHAIN_CI_NPM_EXACT:${String(contract.workflows?.exactNpmVersion)}`);

  const nodePinPath = path.join(rootDir, nodeVersionFile);
  if (!fs.existsSync(nodePinPath)) {
    failures.push(`E_R24_NODE_VERSION_FILE_MISSING:${nodeVersionFile}`);
  } else if (fs.readFileSync(nodePinPath, 'utf8') !== `${required.node}\n`) {
    failures.push(`E_R24_NODE_VERSION_FILE_DRIFT:${nodeVersionFile}`);
  }
  if (pkg.packageManager !== required.packageManager) failures.push(`E_R24_PACKAGE_MANAGER_PIN_DRIFT:${String(pkg.packageManager)}`);

  if (checkRuntime) {
    if (actual.node !== required.node) failures.push(`E_R24_NODE_RUNTIME_UNSUPPORTED:${actual.node}`);
    if (actual.npm === null) {
      try {
        actual.npm = normalizeVersion(npmVersion());
      } catch (error) {
        actual.npm = 'UNAVAILABLE';
        failures.push(`E_R24_NPM_RUNTIME_UNAVAILABLE:${error.message}`);
      }
    }
    if (actual.npm !== required.npm) failures.push(`E_R24_NPM_RUNTIME_UNSUPPORTED:${actual.npm}`);
  }

  return {
    schemaVersion: EXACT_TOOLCHAIN_SCHEMA_VERSION,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    ok: failures.length === 0,
    required,
    actual,
    failures,
  };
}

export function assertExactToolchain(rootDir, options = {}) {
  const result = evaluateExactRuntime(rootDir, { ...options, checkRuntime: true });
  if (!result.ok) {
    const error = new R24Error('E_R24_EXACT_TOOLCHAIN_UNSUPPORTED', JSON.stringify({
      required: result.required,
      actual: result.actual,
      failures: result.failures,
    }));
    error.result = result;
    throw error;
  }
  return result;
}

export function checkToolchain(rootDir, {
  currentNodeVersion = process.version,
  currentNpmVersion = null,
  enforceExactRuntime = false,
} = {}) {
  const failures = [];
  const contract = readContract(rootDir);
  const exact = evaluateExactRuntime(rootDir, {
    currentNodeVersion,
    currentNpmVersion,
    checkRuntime: enforceExactRuntime,
  });
  failures.push(...exact.failures);

  const pkg = readJsonBounded(path.join(rootDir, 'package.json'));
  if (!pkg.engines || typeof pkg.engines !== 'object') {
    failures.push('E_TOOLCHAIN_ENGINES_MISSING');
  } else {
    if (pkg.engines.node !== contract.node.enginesRange) {
      failures.push(`E_TOOLCHAIN_ENGINES_DRIFT:${String(pkg.engines.node)}`);
    }
    if (pkg.engines.npm !== contract.npm.enginesRange) {
      failures.push(`E_TOOLCHAIN_NPM_ENGINES_DRIFT:${String(pkg.engines.npm)}`);
    }
  }
  if (pkg.packageManager !== contract.npm.packageManager) {
    failures.push(`E_TOOLCHAIN_PACKAGE_MANAGER_PIN:${String(pkg.packageManager)}`);
  }
  if (!nodeSatisfies(currentNodeVersion, contract.node.enginesRange)) {
    failures.push(`E_TOOLCHAIN_NODE_UNSUPPORTED:${currentNodeVersion}`);
  }

  const lockfilePath = path.join(rootDir, 'package-lock.json');
  if (!fs.existsSync(lockfilePath)) {
    failures.push('E_TOOLCHAIN_LOCKFILE_MISSING');
  } else {
    const lock = readJsonBounded(lockfilePath, { maxBytes: 16 * 1024 * 1024 });
    if (lock.lockfileVersion !== contract.npm.lockfileVersion) {
      failures.push(`E_TOOLCHAIN_LOCKFILE_VERSION:${String(lock.lockfileVersion)}`);
    }
  }
  const tracked = spawnSync('git', ['-C', rootDir, 'ls-files'], { encoding: 'utf8' });
  if (tracked.status !== 0) throw new R24Error('E_GIT', String(tracked.stderr || '').trim());
  const trackedSet = tracked.stdout.split('\n');
  for (const forbidden of contract.npm.forbiddenLockfiles) {
    if (trackedSet.includes(forbidden)) failures.push(`E_TOOLCHAIN_FORBIDDEN_LOCKFILE:${forbidden}`);
  }

  const workflowDir = path.join(rootDir, '.github', 'workflows');
  const workflowFiles = fs.existsSync(workflowDir)
    ? fs.readdirSync(workflowDir).filter((f) => /\.ya?ml$/.test(f)).sort()
    : [];
  for (const file of workflowFiles) {
    const text = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    if (/uses:\s*actions\/setup-node@v4/u.test(text)) {
      const nodeVersionFile = contract.workflows.nodeVersionFile || '.node-version';
      const escapedNodeVersionFile = nodeVersionFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nodeVersionFileRe = new RegExp(`node-version-file:\\s*["']?${escapedNodeVersionFile}["']?`, 'u');
      if (!nodeVersionFileRe.test(text)) failures.push(`E_TOOLCHAIN_CI_NODE_VERSION_FILE:${file}`);
      if (/^\s*node-version:/mu.test(text)) failures.push(`E_TOOLCHAIN_CI_NODE_DIRECT_VERSION:${file}`);
    }
    const versionMatches = [...text.matchAll(/node-version:\s*["']?([0-9a-z.\-x]+)["']?/g)].map((m) => m[1]);
    for (const version of versionMatches) {
      if (version !== contract.workflows.singleNodeVersion) {
        failures.push(`E_TOOLCHAIN_CI_NODE_INCOHERENT:${file}:${version}`);
      }
    }
    const uses = [...text.matchAll(/uses:\s*([A-Za-z0-9_\-./]+)@([A-Za-z0-9.\-]+)/g)].map((m) => `${m[1]}@${m[2]}`);
    for (const use of uses) {
      const [action, pin] = use.split('@');
      const expected = contract.workflows.allowedActionPins[action];
      if (expected === undefined) failures.push(`E_TOOLCHAIN_ACTION_UNREGISTERED:${file}:${use}`);
      else if (expected !== pin) failures.push(`E_TOOLCHAIN_ACTION_PIN_DRIFT:${file}:${use}`);
    }
  }
  return { ok: failures.length === 0, failures, required: exact.required, actual: exact.actual, workflowCount: workflowFiles.length };
}

export function main(argv = process.argv.slice(2)) {
  const rootDir = path.resolve(argv[0] || process.cwd());
  const result = checkToolchain(rootDir, { enforceExactRuntime: true });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
  return result;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]).endsWith('toolchain.mjs');
if (invokedAsScript) main();

#!/usr/bin/env node
// R2.4 exact-toolchain entrypoint. This is intentionally cheap: it prints the
// actual and required runtime identity, then fails before any expensive suite
// when the local Node/npm pair does not match the canonical R24 contract.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateExactRuntime } from './toolchain.mjs';

function print(result, pretty = false) {
  const payload = pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  process.stdout.write(`R24_EXACT_TOOLCHAIN=${payload}\n`);
}

export function main(argv = process.argv.slice(2)) {
  const sep = argv.indexOf('--');
  const opts = sep === -1 ? argv : argv.slice(0, sep);
  const command = sep === -1 ? [] : argv.slice(sep + 1);
  const pretty = opts.includes('--json');
  const rootDir = path.resolve(process.cwd());
  const result = evaluateExactRuntime(rootDir, { checkRuntime: true });
  print(result, pretty);
  if (!result.ok) {
    process.exitCode = 1;
    return result;
  }
  if (command.length > 0) {
    const child = spawnSync(command[0], command.slice(1), {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (child.error) {
      process.stderr.write(`E_R24_ENTRYPOINT_SPAWN:${child.error.message}\n`);
      process.exitCode = 1;
    } else {
      process.exitCode = typeof child.status === 'number' ? child.status : 1;
    }
  }
  return result;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]).endsWith('exact-toolchain-entrypoint.mjs');
if (invokedAsScript) main();

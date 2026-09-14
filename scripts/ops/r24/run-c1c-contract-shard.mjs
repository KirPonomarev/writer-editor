#!/usr/bin/env node
import { spawn } from 'node:child_process';

const DEFAULT_TESTS = Object.freeze([
  'test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs',
  'test/contracts/r24-c2a-effective-certification.contract.test.mjs',
  'test/contracts/r24-c2b3a-e0-q0-recertification.contract.test.mjs',
  'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
]);

const tests = process.argv.slice(2);
const testFiles = tests.length > 0 ? tests : [...DEFAULT_TESTS];
const startedAt = Date.now();
const keepaliveMs = Number.parseInt(process.env.R24_C1C_KEEPALIVE_MS || '30000', 10);
const childTimeoutMs = Number.parseInt(process.env.R24_C1C_CHILD_TIMEOUT_MS || '0', 10);
const childSignalAfterMs = Number.parseInt(process.env.R24_C1C_CHILD_SIGNAL_AFTER_MS || '0', 10);
const childSignal = process.env.R24_C1C_CHILD_SIGNAL || 'SIGKILL';

const keepalive = Number.isFinite(keepaliveMs) && keepaliveMs > 0 ? setInterval(() => {
  process.stderr.write(`R24_C1C_CONTRACT_SHARD_KEEPALIVE=${JSON.stringify({
    elapsedMs: Date.now() - startedAt,
    testFileCount: testFiles.length,
  })}\n`);
}, keepaliveMs) : null;

const child = spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});
let timedOut = false;
const signalTimer = Number.isFinite(childSignalAfterMs) && childSignalAfterMs > 0 ? setTimeout(() => {
  process.stderr.write(`R24_C1C_CONTRACT_SHARD_CHILD_SIGNAL=${JSON.stringify({
    elapsedMs: Date.now() - startedAt,
    signal: childSignal,
    testFileCount: testFiles.length,
  })}\n`);
  child.kill(childSignal);
}, childSignalAfterMs) : null;
const timeout = Number.isFinite(childTimeoutMs) && childTimeoutMs > 0 ? setTimeout(() => {
  timedOut = true;
  process.stderr.write(`R24_C1C_CONTRACT_SHARD_TIMEOUT=${JSON.stringify({
    elapsedMs: Date.now() - startedAt,
    timeoutMs: childTimeoutMs,
    testFileCount: testFiles.length,
  })}\n`);
  child.kill('SIGTERM');
}, childTimeoutMs) : null;

child.on('exit', (code, signal) => {
  if (keepalive) clearInterval(keepalive);
  if (timeout) clearTimeout(timeout);
  if (signalTimer) clearTimeout(signalTimer);
  if (timedOut) {
    process.stderr.write(`R24_C1C_CONTRACT_SHARD_EXIT=${JSON.stringify({ timedOut: true, signal: signal || null, code: code ?? null })}\n`);
    process.exitCode = 1;
    return;
  }
  if (signal) {
    process.stderr.write(`R24_C1C_CONTRACT_SHARD_EXIT=${JSON.stringify({ signal })}\n`);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`R24_C1C_CONTRACT_SHARD_EXIT=${JSON.stringify({ code: code ?? 1 })}\n`);
  process.exitCode = code ?? 1;
});

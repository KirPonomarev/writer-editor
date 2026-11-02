// Finite R24 test-only mutation port. Original file URLs preserve real repo
// context; source checkout bytes are never replaced or copied.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const keys = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
const files = new Set([
  'mission-contract.mjs', 'plan-state.mjs', 'lease.mjs', 'scheduler.mjs',
  'effective-state-compiler.mjs', 'terminal-receipt.mjs', 'runner-truth.mjs',
  'env-flag-registry.mjs', 'docs-claim-lint.mjs', 'canonical-json.mjs',
  'toolchain.mjs', 'test-readonly-guard.mjs', 'source-binding.mjs',
]);
const fail = code => { throw new Error(code); };
let active;

function materialize(plan) {
  if (!plan || Object.keys(plan).sort().join(',') !== 'baseSha256,file,find,mutantSha256,replace'
      || !files.has(plan.file) || !/^[a-f0-9]{64}$/.test(plan.baseSha256)
      || !/^[a-f0-9]{64}$/.test(plan.mutantSha256)) fail('E_MUTATION_PLAN_INVALID');
  const url = new URL(plan.file, import.meta.url);
  const target = fileURLToPath(url);
  if (fs.realpathSync(target) !== target) fail('E_MUTATION_TARGET_ALIAS');
  const bytes = fs.readFileSync(target);
  if (sha(bytes) !== plan.baseSha256) fail('E_MUTATION_SOURCE_DRIFT');
  let source = bytes.toString('utf8');
  if (!Buffer.from(source).equals(bytes)) fail('E_MUTATION_SOURCE_UTF8');
  if (plan.find === null && plan.replace === null) {
    if (plan.baseSha256 !== plan.mutantSha256) fail('E_MUTATION_CONTROL_CHANGED');
  } else {
    if (typeof plan.find !== 'string' || !plan.find || typeof plan.replace !== 'string'
        || plan.find === plan.replace) fail('E_MUTATION_REPLACEMENT_INVALID');
    const occurrences = source.split(plan.find).length - 1;
    if (occurrences !== 1) fail('E_MUTATION_ANCHOR_' + (occurrences ? 'AMBIGUOUS' : 'MISSING'));
    source = source.replace(plan.find, () => plan.replace);
  }
  if (sha(Buffer.from(source)) !== plan.mutantSha256) fail('E_MUTATION_RESULT_DRIFT');
  return { url: url.href, source };
}

export function createMutationPlan(mutant = null) {
  const file = mutant?.file ?? 'canonical-json.mjs';
  if (!files.has(file)) fail('E_MUTATION_TARGET_INVALID');
  const bytes = fs.readFileSync(new URL(file, import.meta.url));
  const source = bytes.toString('utf8');
  const plan = { file, baseSha256: sha(bytes), find: mutant?.find ?? null,
    replace: mutant?.replace ?? null, mutantSha256: sha(bytes) };
  if (mutant !== null) {
    if (typeof plan.find !== 'string' || !plan.find || typeof plan.replace !== 'string') fail('E_MUTATION_REPLACEMENT_INVALID');
    plan.mutantSha256 = sha(Buffer.from(source.replace(plan.find, () => plan.replace)));
  }
  materialize(plan);
  return Object.freeze(plan);
}

export function mutationPreload(plan) {
  materialize(plan);
  const code = 'import {register} from "node:module";register('
    + JSON.stringify(import.meta.url) + ',{data:' + JSON.stringify(plan) + '});';
  return 'data:text/javascript,' + encodeURIComponent(code);
}

// Node's standard initialize/load hooks are active only in an explicitly
// registered test child. This module grants no filesystem writer or plugin API.
export function initialize(plan) {
  active = { plan: Object.freeze({ ...plan }), ...materialize(plan) };
}
export async function load(url, context, nextLoad) {
  if (!active) fail('E_MUTATION_NOT_INITIALIZED');
  const identity = new URL(url);
  identity.search = ''; identity.hash = '';
  if (identity.href !== active.url) return nextLoad(url, context);
  const current = materialize(active.plan);
  fs.writeSync(2, 'R24_MUTATION_LOADED=' + JSON.stringify(active.plan) + '\n');
  return { format: 'module', source: current.source, shortCircuit: true };
}

export function evaluateMutationRun(result, plan, baseline = null) {
  const stdout = String(result.stdout ?? ''), stderr = String(result.stderr ?? '');
  const failures = [];
  const tap = {};
  for (const key of keys) {
    const matches = [...stdout.matchAll(new RegExp('^# ' + key + ' (\\d+)$', 'gm'))];
    tap[key] = matches.length === 1 ? Number(matches[0][1]) : null;
    if (!Number.isSafeInteger(tap[key])) failures.push('E_MUTATION_TAP_' + key);
  }
  if (tap.tests < 1 || tap.tests !== tap.pass + tap.fail + tap.cancelled + tap.skipped + tap.todo) failures.push('E_MUTATION_DENOMINATOR');
  if (tap.cancelled !== 0 || tap.skipped !== 0 || tap.todo !== 0) failures.push('E_MUTATION_INCOMPLETE');
  if (result.error || result.signal || ![0, 1].includes(result.status)) failures.push('E_MUTATION_PROCESS');
  if ((result.status === 0) !== (tap.fail === 0)) failures.push('E_MUTATION_STATUS_TAP');
  const outcomes = [...stdout.matchAll(/^(ok|not ok) (\d+) - ([^\n]+)$/gm)];
  const names = outcomes.map(row => row[3]);
  if (outcomes.length !== tap.tests || outcomes.some((row, index) => Number(row[2]) !== index + 1)) failures.push('E_MUTATION_CASES_MISSING');
  const cohortSha256 = sha(Buffer.from(JSON.stringify(names)));
  if (baseline && (tap.tests !== baseline.tap.tests || cohortSha256 !== baseline.cohortSha256)) failures.push('E_MUTATION_COHORT_CHANGED');
  const markers = [...(stdout + '\n' + stderr).matchAll(/^(# )?R24_MUTATION_LOADED=(\{[^\n]+\})$/gm)];
  if (markers.length === 0) failures.push('E_MUTATION_NOT_LOADED');
  for (const marker of markers) {
    try {
      const text = marker[1] ? marker[2].replace(/\\([\\#])/g, '$1') : marker[2];
      if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(plan)) failures.push('E_MUTATION_LOAD_IDENTITY');
    } catch { failures.push('E_MUTATION_LOAD_IDENTITY'); }
  }
  const failedCases = [], assertionCases = [], dependentDomainFailures = [];
  for (let i = 0; i < outcomes.length; i += 1) {
    const row = outcomes[i];
    if (row[1] !== 'not ok') continue;
    const block = stdout.slice(row.index, outcomes[i + 1]?.index ?? stdout.length);
    failedCases.push(row[3]);
    const testFailure = /^\s+failureType: 'testCodeFailure'$/m.test(block);
    const code = /^\s+code: '([^']+)'$/m.exec(block)?.[1] ?? null;
    if (testFailure && code === 'ERR_ASSERTION') {
      assertionCases.push(row[3]);
      continue;
    }
    // These two observed semantic sabotages also propagate a typed refusal
    // through unchanged callers. Retain it as data, never as a kill witness.
    // Every other exception, including setup/module/loader failures, invalidates.
    const originalFrame = block.includes(new URL('plan-state.mjs', import.meta.url).href + ':');
    const duplicateSabotage = plan.file === 'plan-state.mjs'
      && plan.find === '    if (prior) {' && plan.replace === '    if (false) {'
      && code === 'E_CAS_REVISION_CONFLICT';
    const fenceSabotage = plan.file === 'lease.mjs' && typeof plan.find === 'string'
      && plan.find.startsWith('draft.fencingCounter += 1;\n      const lease = {')
      && typeof plan.replace === 'string' && plan.replace.startsWith('const lease = {')
      && code === 'E_FENCE_STALE';
    if (testFailure && originalFrame && (duplicateSabotage || fenceSabotage)) {
      dependentDomainFailures.push({ caseName: row[3], code, source: 'plan-state.mjs' });
    } else {
      failures.push('E_MUTATION_NOT_ASSERTION:' + row[3]);
    }
  }
  if (tap.fail > 0 && assertionCases.length === 0) failures.push('E_MUTATION_ASSERTION_WITNESS_MISSING');
  if (failedCases.length !== tap.fail) failures.push('E_MUTATION_FAILURE_COVERAGE');
  if (!baseline && (result.status !== 0 || tap.fail !== 0)) failures.push('E_MUTATION_CONTROL_RED');
  return {
    verdict: failures.length ? 'INVALID' : tap.fail ? 'KILLED' : baseline ? 'SURVIVED' : 'PASS',
    tap, cohortSha256, cases: names, failedCases, assertionCases, dependentDomainFailures, loadedCount: markers.length,
    exitCode: result.status, signal: result.signal ?? null, failures,
  };
}

// One complete compact evidence envelope, no tail truncation. The reader
// checks every useful byte and actual wait status before publication.
export function captureMutationEvidence(result) {
  const value = { stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? ''),
    exitCode: result.status, signal: result.signal ?? null,
    error: result.error ? { code: result.error.code ?? null, message: result.error.message } : null };
  const bytes = Buffer.from(JSON.stringify(value));
  const full = { encoding: 'gzip-base64-json-v1', uncompressedUtf8Bytes: bytes.length,
    sha256: sha(bytes), data: gzipSync(bytes).toString('base64') };
  if (!readMutationEvidence(full).bytes.equals(bytes)) fail('E_MUTATION_CAPTURE_READBACK');
  return full;
}
export function readMutationEvidence(full) {
  if (!full || Object.keys(full).sort().join(',') !== 'data,encoding,sha256,uncompressedUtf8Bytes'
      || full.encoding !== 'gzip-base64-json-v1'
      || !Number.isSafeInteger(full.uncompressedUtf8Bytes) || full.uncompressedUtf8Bytes < 2
      || full.uncompressedUtf8Bytes > 2 * 64 * 1024 * 1024 + 65536
      || !/^[a-f0-9]{64}$/.test(full.sha256) || typeof full.data !== 'string') fail('E_MUTATION_EVIDENCE_SHAPE');
  const packed = Buffer.from(full.data, 'base64');
  if (packed.toString('base64') !== full.data) fail('E_MUTATION_EVIDENCE_BASE64');
  const bytes = gunzipSync(packed, { maxOutputLength: full.uncompressedUtf8Bytes });
  if (bytes.length !== full.uncompressedUtf8Bytes || sha(bytes) !== full.sha256) fail('E_MUTATION_EVIDENCE_DIGEST');
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes)) fail('E_MUTATION_EVIDENCE_UTF8');
  const value = JSON.parse(text);
  if (Object.keys(value).sort().join(',') !== 'error,exitCode,signal,stderr,stdout'
      || typeof value.stdout !== 'string' || typeof value.stderr !== 'string'
      || !(value.exitCode === null || Number.isInteger(value.exitCode))
      || !(value.signal === null || typeof value.signal === 'string')
      || !(value.error === null || (typeof value.error === 'object' && typeof value.error.message === 'string'))) fail('E_MUTATION_EVIDENCE_RESULT');
  return { value, bytes };
}

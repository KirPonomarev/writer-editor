#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'POST_MERGE_VERIFY_ATTESTATION_EMITTED';
const DEFAULT_REQUIRED_TOKEN_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const DEFAULT_EVIDENCE_PATH = 'docs/OPS/LOCKS/ATTESTATION_TRUST_ARTIFACT.lock';

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((item) => stableSortObject(item));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRepoRoot(repoRoot) {
  return path.resolve(normalizeString(repoRoot) || process.cwd());
}

function runGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) return '';
  return normalizeString(result.stdout);
}

function readFileIfExists(absPath) {
  try {
    if (!fs.existsSync(absPath)) return '';
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return '';
  }
}

function computeTokenResultsHash(repoRoot) {
  const abs = path.resolve(repoRoot, DEFAULT_REQUIRED_TOKEN_SET_PATH);
  const content = readFileIfExists(abs);
  return content ? sha256Hex(content) : '';
}

function computeEvidenceHash(repoRoot) {
  const abs = path.resolve(repoRoot, DEFAULT_EVIDENCE_PATH);
  const content = readFileIfExists(abs);
  return content ? sha256Hex(content) : '';
}

export function resolvePostMergeVerifyBindingContext(input = {}) {
  const repoRoot = normalizeRepoRoot(input.repoRoot);
  const headShaBinding = normalizeString(input.headShaBinding || input.headSha) || runGitHead(repoRoot);
  const tokenResultsHashBinding = normalizeString(input.tokenResultsHashBinding || input.tokenResultsHash)
    || computeTokenResultsHash(repoRoot);
  const evidenceHashBinding = normalizeString(input.evidenceHashBinding || input.evidenceHash)
    || computeEvidenceHash(repoRoot);
  const waveInputHashBinding = normalizeString(input.waveInputHashBinding || input.waveInputHash)
    || sha256Hex(stableStringify({
      bindingSchema: 'WS04_ATTESTATION_BINDING_V1',
      headShaBinding,
      tokenResultsHashBinding,
      evidenceHashBinding,
    }));

  return {
    headShaBinding,
    waveInputHashBinding,
    tokenResultsHashBinding,
    evidenceHashBinding,
  };
}

function parseArgs(argv) {
  const out = {
    json: false,
    taskId: '',
    verifyPath: '',
    status: 'pass',
    detail: '',
    headShaBinding: '',
    waveInputHashBinding: '',
    tokenResultsHashBinding: '',
    evidenceHashBinding: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    if (arg === '--task' && i + 1 < argv.length) {
      out.taskId = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--verify-path' && i + 1 < argv.length) {
      out.verifyPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--status' && i + 1 < argv.length) {
      out.status = String(argv[i + 1] || '').trim().toLowerCase();
      i += 1;
    }
    if (arg === '--detail' && i + 1 < argv.length) {
      out.detail = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--head-sha-binding' && i + 1 < argv.length) {
      out.headShaBinding = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--wave-input-hash-binding' && i + 1 < argv.length) {
      out.waveInputHashBinding = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--token-results-hash-binding' && i + 1 < argv.length) {
      out.tokenResultsHashBinding = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--evidence-hash-binding' && i + 1 < argv.length) {
      out.evidenceHashBinding = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }

  return out;
}

export function evaluatePostMergeVerifyAttestationState(input = {}) {
  const taskId = String(input.taskId || '').trim();
  const verifyPath = String(input.verifyPath || '').trim();
  const status = String(input.status || 'pass').trim().toLowerCase();
  const detail = String(input.detail || '').trim();
  const ok = status !== 'fail';
  const binding = resolvePostMergeVerifyBindingContext(input);

  return {
    ok,
    [TOKEN_NAME]: 1,
    attestationKind: 'POST_MERGE_VERIFY',
    taskId,
    verifyPath,
    verifyOk: ok ? 1 : 0,
    detail: detail || (ok ? 'post_merge_verify_ok' : 'post_merge_verify_fail'),
    headShaBinding: binding.headShaBinding,
    waveInputHashBinding: binding.waveInputHashBinding,
    tokenResultsHashBinding: binding.tokenResultsHashBinding,
    evidenceHashBinding: binding.evidenceHashBinding,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`POST_MERGE_VERIFY_ATTESTATION_KIND=${state.attestationKind}`);
  console.log(`POST_MERGE_VERIFY_ATTESTATION_TASK_ID=${state.taskId}`);
  console.log(`POST_MERGE_VERIFY_ATTESTATION_PATH=${state.verifyPath}`);
  console.log(`POST_MERGE_VERIFY_ATTESTATION_OK=${state.verifyOk}`);
  console.log(`POST_MERGE_VERIFY_ATTESTATION_DETAIL=${state.detail}`);
  console.log(`POST_MERGE_VERIFY_HEAD_SHA_BINDING=${state.headShaBinding}`);
  console.log(`POST_MERGE_VERIFY_WAVE_INPUT_HASH_BINDING=${state.waveInputHashBinding}`);
  console.log(`POST_MERGE_VERIFY_TOKEN_RESULTS_HASH_BINDING=${state.tokenResultsHashBinding}`);
  console.log(`POST_MERGE_VERIFY_EVIDENCE_HASH_BINDING=${state.evidenceHashBinding}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePostMergeVerifyAttestationState({
    taskId: args.taskId,
    verifyPath: args.verifyPath,
    status: args.status,
    detail: args.detail,
    headShaBinding: args.headShaBinding,
    waveInputHashBinding: args.waveInputHashBinding,
    tokenResultsHashBinding: args.tokenResultsHashBinding,
    evidenceHashBinding: args.evidenceHashBinding,
  });
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(0);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

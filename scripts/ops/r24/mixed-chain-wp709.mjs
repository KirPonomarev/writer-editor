#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  WP709_MISSION_DIGEST,
  WP709_STAGE_ID,
  canonicalMixedChainJson,
  compileMixedChainEvidence,
} from '../../../src/interchange/mixed-chain-fidelity-v1.mjs';

const MAX_INPUT_BYTES = 512 * 1024;

function fail(code, detail = '') {
  const suffix = detail ? `:${detail}` : '';
  process.stderr.write(`${code}${suffix}\n`);
  process.exitCode = 1;
}

function args(argv) {
  const allowed = new Set(['input', 'verify', 'require-done']);
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--') || !allowed.has(item.slice(2))) throw new Error('WP709_CLI_ARGUMENT_INVALID');
    const key = item.slice(2);
    if (key === 'require-done') {
      result[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error('WP709_CLI_ARGUMENT_VALUE_REQUIRED');
    result[key] = next;
    index += 1;
  }
  return result;
}

function readJsonBounded(file, label) {
  const resolved = path.resolve(file);
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_INPUT_BYTES) throw new Error(`WP709_${label}_BUDGET_INVALID`);
  const bytes = fs.readFileSync(resolved);
  if (bytes.includes(0) || bytes.at(-1) !== 0x0a) throw new Error(`WP709_${label}_CANONICAL_LF_REQUIRED`);
  return JSON.parse(bytes.toString('utf8'));
}

function staticReceipt() {
  return {
    effectExecution: false,
    externalPhysicalStatus: 'REQUIRED_NOT_PRECLAIMED',
    missionDigest: WP709_MISSION_DIGEST,
    productRuntimeNetwork: false,
    schemaVersion: 'YALKEN_R24_WP709_LOCAL_CHECKER_RECEIPT_V1',
    stageDone: false,
    stageId: WP709_STAGE_ID,
    status: 'PENDING_EXTERNAL_PHYSICAL',
    supportedModes: ['COMPILE_OBSERVATIONS_TO_STDOUT', 'VERIFY_RECEIPT_READ_ONLY'],
    writesFiles: false,
  };
}

try {
  const options = args(process.argv.slice(2));
  if (!options.input) {
    if (options.verify || options['require-done']) throw new Error('WP709_INPUT_REQUIRED');
    process.stdout.write(`${canonicalMixedChainJson(staticReceipt())}\n`);
  } else {
    const observation = readJsonBounded(options.input, 'OBSERVATION');
    const compiled = compileMixedChainEvidence(observation);
    if (!compiled.ok) {
      fail(compiled.code, compiled.path);
    } else if (options.verify) {
      const receipt = readJsonBounded(options.verify, 'RECEIPT');
      if (canonicalMixedChainJson(receipt) !== canonicalMixedChainJson(compiled.result)) fail('WP709_RECEIPT_REPLAY_MISMATCH');
      else if (options['require-done'] && compiled.result.stageDone !== true) fail('WP709_EXTERNAL_PHYSICAL_REQUIRED');
      else process.stdout.write(`${canonicalMixedChainJson({ resultDigest: compiled.result.resultDigest, stageDone: compiled.result.stageDone, status: 'VERIFIED' })}\n`);
    } else if (options['require-done'] && compiled.result.stageDone !== true) {
      fail('WP709_EXTERNAL_PHYSICAL_REQUIRED');
    } else {
      process.stdout.write(`${canonicalMixedChainJson(compiled.result)}\n`);
    }
  }
} catch (error) {
  fail(error?.message || 'WP709_LOCAL_CHECK_FAILED');
}

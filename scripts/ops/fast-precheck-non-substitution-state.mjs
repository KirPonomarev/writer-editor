#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'FAST_PRECHECK_NOT_RELEASE_GATE_ASSERTION_TRUE';
const FAIL_CODE = 'E_FAST_PRECHECK_SUBSTITUTION';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const DEFAULT_PRECHECK_PACK_PATH = 'docs/OPS/STATUS/X21_RELEASE_CANDIDATE_PRECHECK_PACK_v1.json';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toUniqueSortedStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((it) => normalizeString(it)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    requiredSetPath: '',
    precheckPackPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length));
      continue;
    }

    if (arg === '--precheck-pack-path' && i + 1 < argv.length) {
      out.precheckPackPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--precheck-pack-path=')) {
      out.precheckPackPath = normalizeString(arg.slice('--precheck-pack-path='.length));
      continue;
    }
  }

  return out;
}

export function evaluateFastPrecheckNonSubstitutionState(input = {}) {
  const requiredSetPath = normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH) || DEFAULT_REQUIRED_SET_PATH;
  const precheckPackPath = normalizeString(input.precheckPackPath || DEFAULT_PRECHECK_PACK_PATH) || DEFAULT_PRECHECK_PACK_PATH;
  const requiredDoc = readJsonObject(requiredSetPath);
  const packDoc = readJsonObject(precheckPackPath);

  const releaseSet = toUniqueSortedStrings(requiredDoc?.requiredSets?.release || []);
  const canonicalSet = toUniqueSortedStrings(packDoc?.requiredReleaseBlockingSet || []);
  const missingInRelease = canonicalSet.filter((token) => !releaseSet.includes(token));
  const extraInRelease = releaseSet.filter((token) => !canonicalSet.includes(token));

  const precheckAdvisory = normalizeString(packDoc?.nonBlockingClassification) === 'advisory_until_machine_bound';
  const blockingSurfaceExpansion = packDoc?.blockingSurfaceExpansion === true;

  const ok = Boolean(requiredDoc)
    && Boolean(packDoc)
    && precheckAdvisory
    && !blockingSurfaceExpansion
    && missingInRelease.length === 0
    && extraInRelease.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    details: {
      requiredSetPath,
      precheckPackPath,
      precheckAdvisory,
      blockingSurfaceExpansion,
      missingInRelease,
      extraInRelease,
      releaseSetSize: releaseSet.length,
      canonicalSetSize: canonicalSet.length,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`FAST_PRECHECK_ADVISORY=${state.details.precheckAdvisory ? 1 : 0}`);
  console.log(`FAST_PRECHECK_BLOCKING_SURFACE_EXPANSION=${state.details.blockingSurfaceExpansion ? 1 : 0}`);
  console.log(`FAST_PRECHECK_MISSING_IN_RELEASE_COUNT=${state.details.missingInRelease.length}`);
  console.log(`FAST_PRECHECK_EXTRA_IN_RELEASE_COUNT=${state.details.extraInRelease.length}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateFastPrecheckNonSubstitutionState(args);

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state[TOKEN_NAME] === 1 ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

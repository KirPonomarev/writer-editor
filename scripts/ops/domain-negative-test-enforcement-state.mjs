#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK';
const FAIL_SIGNAL_CODE = 'E_FAILSIGNAL_NEGATIVE_TEST_MISSING';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const GENERIC_SCHEMA_NEGATIVE_TEST_REF = 'test/contracts/failsignal-registry.contract.test.js#schema-invalid';
const NEGATIVE_TEST_REF_RE = /^test\/contracts\/[a-z0-9._-]+\.contract\.test\.js#[a-z0-9._-]+$/u;

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }

  return out;
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDomainFailSignal(row) {
  const code = normalizeString(row.code);
  const sourceBinding = normalizeString(row.sourceBinding);
  if (!code) return false;
  if (code.startsWith('E_FAILSIGNAL_')) return false;
  if (sourceBinding === 'reconcile_p0_02') return false;
  return true;
}

function parseNegativeTestRef(ref) {
  const normalized = normalizeString(ref);
  const hashIndex = normalized.indexOf('#');
  if (hashIndex <= 0) {
    return {
      path: normalized,
      testId: '',
    };
  }
  return {
    path: normalized.slice(0, hashIndex),
    testId: normalized.slice(hashIndex + 1),
  };
}

function evaluateDomainNegativeTestEnforcement(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || process.env.FAILSIGNAL_REGISTRY_PATH || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      [TOKEN_NAME]: 0,
      failSignalCode: FAIL_SIGNAL_CODE,
      failReason: 'FAILSIGNAL_REGISTRY_UNREADABLE',
      failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
      domainFailSignalsCount: 0,
      mappedDomainFailSignalsCount: 0,
      domainMappingCoveragePct: 0,
      domainMappingCoverageOk: false,
      genericSchemaRejectionOk: false,
      consistencyOk: false,
      domainFailSignals: [],
      genericSchemaRejectionCases: [],
      mappingIssues: [],
    };
  }

  const domainFailSignals = [];
  const mappingIssues = [];
  const genericSchemaRejectionCases = [];

  for (const row of registryDoc.failSignals) {
    if (!isObjectRecord(row) || !isDomainFailSignal(row)) continue;

    const code = normalizeString(row.code);
    const negativeTestRef = normalizeString(row.negativeTestRef);
    const refParsed = parseNegativeTestRef(negativeTestRef);
    const issues = [];

    if (!negativeTestRef) {
      issues.push({ code: 'NEGATIVE_TEST_REF_MISSING' });
    } else {
      if (!NEGATIVE_TEST_REF_RE.test(negativeTestRef)) {
        issues.push({ code: 'NEGATIVE_TEST_REF_INVALID_FORMAT', negativeTestRef });
      }
      if (negativeTestRef === GENERIC_SCHEMA_NEGATIVE_TEST_REF) {
        const issue = { code: 'GENERIC_SCHEMA_NEGATIVE_REF_FORBIDDEN', negativeTestRef };
        issues.push(issue);
        genericSchemaRejectionCases.push({ failSignalCode: code, ...issue });
      }
      if (refParsed.path) {
        const absTestPath = path.resolve(repoRoot, refParsed.path);
        if (!fs.existsSync(absTestPath)) {
          issues.push({ code: 'NEGATIVE_TEST_FILE_MISSING', negativeTestRef, filePath: refParsed.path });
        }
      }
    }

    const mapped = issues.length === 0;
    domainFailSignals.push({
      code,
      negativeTestRef,
      mapped,
      issues,
    });

    for (const issue of issues) {
      mappingIssues.push({ failSignalCode: code, ...issue });
    }
  }

  domainFailSignals.sort((a, b) => a.code.localeCompare(b.code));
  mappingIssues.sort((a, b) => {
    if (a.failSignalCode !== b.failSignalCode) return a.failSignalCode.localeCompare(b.failSignalCode);
    return String(a.code || '').localeCompare(String(b.code || ''));
  });
  genericSchemaRejectionCases.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));

  const domainFailSignalsCount = domainFailSignals.length;
  const mappedDomainFailSignalsCount = domainFailSignals.filter((entry) => entry.mapped).length;
  const domainMappingCoveragePct = domainFailSignalsCount === 0
    ? 0
    : Number(((mappedDomainFailSignalsCount / domainFailSignalsCount) * 100).toFixed(2));

  const domainMappingCoverageOk = domainFailSignalsCount > 0 && mappedDomainFailSignalsCount === domainFailSignalsCount;
  const genericSchemaRejectionOk = genericSchemaRejectionCases.length === 0;
  const consistencyOk = domainMappingCoverageOk;
  const ok = domainMappingCoverageOk && genericSchemaRejectionOk && consistencyOk;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : 'DOMAIN_NEGATIVE_TEST_ENFORCEMENT_FAILED',
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    domainFailSignalsCount,
    mappedDomainFailSignalsCount,
    domainMappingCoveragePct,
    domainMappingCoverageOk,
    genericSchemaRejectionOk,
    consistencyOk,
    domainFailSignals,
    genericSchemaRejectionCases,
    mappingIssues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`DOMAIN_FAILSIGNAL_COUNT=${state.domainFailSignalsCount}`);
  console.log(`DOMAIN_FAILSIGNAL_MAPPED_COUNT=${state.mappedDomainFailSignalsCount}`);
  console.log(`DOMAIN_FAILSIGNAL_MAPPING_COVERAGE_PCT=${state.domainMappingCoveragePct}`);
  console.log(`DOMAIN_FAILSIGNAL_MAPPING_COVERAGE_OK=${state.domainMappingCoverageOk ? 1 : 0}`);
  console.log(`DOMAIN_GENERIC_SCHEMA_REJECTION_OK=${state.genericSchemaRejectionOk ? 1 : 0}`);
  console.log(`DOMAIN_NEGATIVE_TEST_CONSISTENCY_OK=${state.consistencyOk ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateDomainNegativeTestEnforcement({
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export {
  evaluateDomainNegativeTestEnforcement,
  GENERIC_SCHEMA_NEGATIVE_TEST_REF,
};

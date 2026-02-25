#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  evaluateDomainNegativeTestEnforcement,
  GENERIC_SCHEMA_NEGATIVE_TEST_REF,
} from './domain-negative-test-enforcement-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_03';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

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
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: '',
    ticketId: '',
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isDomainFailSignal(row) {
  const code = normalizeString(row?.code);
  const sourceBinding = normalizeString(row?.sourceBinding);
  if (!code) return false;
  if (code.startsWith('E_FAILSIGNAL_')) return false;
  if (sourceBinding === 'reconcile_p0_02') return false;
  return true;
}

function runBinaryTestA(baselineState) {
  const ok = baselineState.domainMappingCoveragePct === 100
    && baselineState.domainMappingCoverageOk === true
    && baselineState.consistencyOk === true
    && baselineState.domainFailSignalsCount === baselineState.mappedDomainFailSignalsCount;

  return {
    ok,
    domainFailSignalsCount: baselineState.domainFailSignalsCount,
    mappedDomainFailSignalsCount: baselineState.mappedDomainFailSignalsCount,
    domainMappingCoveragePct: baselineState.domainMappingCoveragePct,
    domainMappingCoverageOk: baselineState.domainMappingCoverageOk,
    consistencyOk: baselineState.consistencyOk,
  };
}

function runBinaryTestB(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJson(path.resolve(repoRoot, failsignalRegistryPath));
  const failSignals = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const target = failSignals.find((row) => isObjectRecord(row) && isDomainFailSignal(row));

  if (!target || !normalizeString(target.code)) {
    return {
      ok: false,
      failReason: 'NO_DOMAIN_FAILSIGNAL_TARGET',
      targetFailSignalCode: '',
      genericSchemaRejectionCasesCount: 0,
      genericSchemaRejected: false,
    };
  }

  const targetFailSignalCode = normalizeString(target.code);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-03-binary-b-'));
  const mutatedRegistryPath = path.join(tmpDir, 'FAILSIGNAL_REGISTRY.mutated.json');

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    if (normalizeString(row.code) === targetFailSignalCode) {
      row.negativeTestRef = GENERIC_SCHEMA_NEGATIVE_TEST_REF;
      break;
    }
  }

  fs.writeFileSync(mutatedRegistryPath, `${JSON.stringify(registryDoc, null, 2)}\n`, 'utf8');

  const mutatedState = evaluateDomainNegativeTestEnforcement({
    repoRoot,
    failsignalRegistryPath: mutatedRegistryPath,
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const genericSchemaRejected = mutatedState.genericSchemaRejectionCases.some(
    (entry) => normalizeString(entry.failSignalCode) === targetFailSignalCode,
  );

  const ok = mutatedState.ok === false
    && mutatedState.genericSchemaRejectionOk === false
    && mutatedState.failSignalCode === 'E_FAILSIGNAL_NEGATIVE_TEST_MISSING'
    && genericSchemaRejected;

  return {
    ok,
    targetFailSignalCode,
    genericSchemaRejectionCasesCount: mutatedState.genericSchemaRejectionCases.length,
    genericSchemaRejected,
    mutatedState: {
      ok: mutatedState.ok,
      failReason: mutatedState.failReason,
      failSignalCode: mutatedState.failSignalCode,
      genericSchemaRejectionOk: mutatedState.genericSchemaRejectionOk,
      domainMappingCoverageOk: mutatedState.domainMappingCoverageOk,
      consistencyOk: mutatedState.consistencyOk,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const failsignalRegistryPath = path.resolve(repoRoot, args.failsignalRegistryPath);

  const baselineState = evaluateDomainNegativeTestEnforcement({
    repoRoot,
    failsignalRegistryPath,
  });

  const binaryA = runBinaryTestA(baselineState);
  const binaryB = runBinaryTestB(repoRoot, args.failsignalRegistryPath);

  const gates = {
    p0_03_domain_binding_check: binaryA.ok ? 'PASS' : 'FAIL',
    p0_03_generic_test_rejection_check: binaryB.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    domainFailSignalsCount: baselineState.domainFailSignalsCount,
    mappedDomainFailSignalsCount: baselineState.mappedDomainFailSignalsCount,
    domainMappingCoveragePct: baselineState.domainMappingCoveragePct,
    genericSchemaRejectionCasesCount: baselineState.genericSchemaRejectionCases.length,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const report = {
    reportId: 'P0_03_DOMAIN_NEGATIVE_TEST_ENFORCEMENT_REPORT_V1',
    ...summary,
    domainMappingCoverageOk: baselineState.domainMappingCoverageOk,
    genericSchemaRejectionOk: baselineState.genericSchemaRejectionOk,
    consistencyOk: baselineState.consistencyOk,
    failReason: baselineState.failReason,
    binaryTestA: binaryA,
    binaryTestB: binaryB,
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'domain-failsignal-negative-test-map.json'), {
    domainFailSignalsCount: baselineState.domainFailSignalsCount,
    mappedDomainFailSignalsCount: baselineState.mappedDomainFailSignalsCount,
    domainMappingCoveragePct: baselineState.domainMappingCoveragePct,
    domainMappingCoverageOk: baselineState.domainMappingCoverageOk,
    domainFailSignals: baselineState.domainFailSignals,
  });

  writeJson(path.join(outputDir, 'generic-schema-rejection-cases.json'), {
    genericSchemaNegativeTestRef: GENERIC_SCHEMA_NEGATIVE_TEST_REF,
    genericSchemaRejectionCasesCount: baselineState.genericSchemaRejectionCases.length,
    genericSchemaRejectionCases: baselineState.genericSchemaRejectionCases,
    binaryTestB: binaryB,
  });

  writeJson(path.join(outputDir, 'p0-03-domain-enforcement-report.json'), report);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

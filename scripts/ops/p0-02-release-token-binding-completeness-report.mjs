#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateReleaseTokenBindingCompleteness } from './release-token-binding-completeness-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_02';
const DEFAULT_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

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
    catalogPath: DEFAULT_CATALOG_PATH,
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
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

    if (arg === '--catalog-path' && i + 1 < argv.length) {
      out.catalogPath = normalizeString(argv[i + 1]) || DEFAULT_CATALOG_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--catalog-path=')) {
      out.catalogPath = normalizeString(arg.slice('--catalog-path='.length)) || DEFAULT_CATALOG_PATH;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
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

function runBinaryTestA(catalogPath, requiredSetPath) {
  const state = evaluateReleaseTokenBindingCompleteness({ catalogPath, requiredSetPath });
  const ok = state.completenessOk === true && state.missingRequiredBindingFieldsCount === 0;
  return {
    ok,
    completenessOk: state.completenessOk,
    missingRequiredBindingFieldsCount: state.missingRequiredBindingFieldsCount,
    releaseRequiredTokensCount: state.releaseRequiredTokensCount,
  };
}

function runBinaryTestB(repoRoot, catalogPath, requiredSetPath) {
  const catalogDoc = readJson(path.resolve(repoRoot, catalogPath));
  const requiredSetDoc = readJson(path.resolve(repoRoot, requiredSetPath));
  const releaseRequired = ((requiredSetDoc.requiredSets || {}).release || []).map((entry) => normalizeString(entry)).filter(Boolean);

  const targetTokenId = releaseRequired[0] || '';
  if (!targetTokenId) {
    return {
      ok: false,
      failReason: 'NO_RELEASE_REQUIRED_TOKENS',
      completenessOk: false,
      missingRequiredBindingFieldsCount: 0,
      removedField: 'proofHook',
      targetTokenId: '',
    };
  }

  const token = (catalogDoc.tokens || []).find((row) => row && row.tokenId === targetTokenId);
  if (!token) {
    return {
      ok: false,
      failReason: 'TARGET_TOKEN_NOT_FOUND',
      completenessOk: false,
      missingRequiredBindingFieldsCount: 0,
      removedField: 'proofHook',
      targetTokenId,
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-02-binary-b-'));
  const mutatedCatalogPath = path.join(tmpDir, 'TOKEN_CATALOG.mutated.json');
  const removedField = 'proofHook';
  delete token[removedField];
  fs.writeFileSync(mutatedCatalogPath, `${JSON.stringify(catalogDoc, null, 2)}\n`, 'utf8');

  const state = evaluateReleaseTokenBindingCompleteness({
    catalogPath: mutatedCatalogPath,
    requiredSetPath: path.resolve(repoRoot, requiredSetPath),
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const removedDetected = state.missingRequiredBindingFields.some((entry) => entry.tokenId === targetTokenId && entry.field === removedField);
  const ok = state.completenessOk === false
    && state.missingRequiredBindingFieldsCount > 0
    && removedDetected;

  return {
    ok,
    completenessOk: state.completenessOk,
    missingRequiredBindingFieldsCount: state.missingRequiredBindingFieldsCount,
    removedField,
    targetTokenId,
    removedDetected,
  };
}

function runRepeatablePass3(catalogPath, requiredSetPath) {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateReleaseTokenBindingCompleteness({ catalogPath, requiredSetPath });
    runs.push({
      run: i + 1,
      completenessOk: state.completenessOk,
      missingRequiredBindingFieldsCount: state.missingRequiredBindingFieldsCount,
      releaseRequiredTokensCount: state.releaseRequiredTokensCount,
      failReason: state.failReason,
    });
  }

  const baseline = JSON.stringify({
    completenessOk: runs[0].completenessOk,
    missingRequiredBindingFieldsCount: runs[0].missingRequiredBindingFieldsCount,
    releaseRequiredTokensCount: runs[0].releaseRequiredTokensCount,
    failReason: runs[0].failReason,
  });

  const identical = runs.every((entry) => JSON.stringify({
    completenessOk: entry.completenessOk,
    missingRequiredBindingFieldsCount: entry.missingRequiredBindingFieldsCount,
    releaseRequiredTokensCount: entry.releaseRequiredTokensCount,
    failReason: entry.failReason,
  }) === baseline);

  const ok = identical && runs.every((entry) => entry.completenessOk === true && entry.missingRequiredBindingFieldsCount === 0);

  return {
    ok,
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const catalogPath = path.resolve(repoRoot, args.catalogPath);
  const requiredSetPath = path.resolve(repoRoot, args.requiredSetPath);

  const baselineState = evaluateReleaseTokenBindingCompleteness({
    catalogPath,
    requiredSetPath,
  });

  const binaryA = runBinaryTestA(catalogPath, requiredSetPath);
  const binaryB = runBinaryTestB(repoRoot, args.catalogPath, args.requiredSetPath);
  const repeatable = runRepeatablePass3(catalogPath, requiredSetPath);

  const gates = {
    p0_02_binary_test_a: binaryA.ok ? 'PASS' : 'FAIL',
    p0_02_binary_test_b: binaryB.ok ? 'PASS' : 'FAIL',
    p0_02_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: (baselineState.missingRequiredBindingFieldsCount === 0
      && Object.values(gates).every((value) => value === 'PASS'))
      ? 'PASS'
      : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    missingRequiredBindingFieldsCount: baselineState.missingRequiredBindingFieldsCount,
    releaseRequiredTokensCount: baselineState.releaseRequiredTokensCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const report = {
    reportId: 'RELEASE_TOKEN_BINDING_COMPLETENESS_REPORT_V1',
    ...summary,
    completenessOk: baselineState.completenessOk,
    failReason: baselineState.failReason,
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'release-token-binding-completeness-report.json'), report);
  writeJson(path.join(outputDir, 'missing-required-binding-fields.json'), {
    missingRequiredBindingFieldsCount: baselineState.missingRequiredBindingFieldsCount,
    missingRequiredBindingFields: baselineState.missingRequiredBindingFields,
  });
  writeJson(path.join(outputDir, 'binary-test-a-complete-set.json'), binaryA);
  writeJson(path.join(outputDir, 'binary-test-b-remove-field.json'), binaryB);
  writeJson(path.join(outputDir, 'repeatable-pass-3runs.json'), repeatable);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

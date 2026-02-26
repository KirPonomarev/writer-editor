#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'RELEASE_TOKEN_BINDING_COMPLETENESS_OK';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/RELEASE_TOKEN_BINDING_COMPLETENESS_v3.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_PHASE_SET_1_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_1_V1.json';
const DEFAULT_PHASE_SET_2_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_2_V1.json';
const DEFAULT_PHASE_SET_3_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';
const DEFAULT_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const REQUIRED_FIELDS = [
  'TOKEN_ID',
  'PROOFHOOK_REF',
  'POSITIVE_CONTRACT_REF',
  'NEGATIVE_CONTRACT_REF',
  'FAILSIGNAL_CODE',
  'MODE_DISPOSITION',
  'SOURCE_BINDING_REF',
  'REQUIRED_SCOPE',
  'OWNER',
  'ROLLBACK_REF',
  'EVIDENCE_REF',
  'UPDATED_AT_UTC',
];
const ALLOWED_PHASES = new Set(['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD']);

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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    statusPath: '',
    bindingSchemaPath: '',
    phaseSwitchPath: '',
    phaseSet1Path: '',
    phaseSet2Path: '',
    phaseSet3Path: '',
    catalogPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
      continue;
    }
    if (arg === '--binding-schema-path' && i + 1 < argv.length) {
      out.bindingSchemaPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--binding-schema-path=')) {
      out.bindingSchemaPath = normalizeString(arg.slice('--binding-schema-path='.length));
      continue;
    }
    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
      continue;
    }
    if (arg === '--phase-set-1-path' && i + 1 < argv.length) {
      out.phaseSet1Path = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-set-1-path=')) {
      out.phaseSet1Path = normalizeString(arg.slice('--phase-set-1-path='.length));
      continue;
    }
    if (arg === '--phase-set-2-path' && i + 1 < argv.length) {
      out.phaseSet2Path = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-set-2-path=')) {
      out.phaseSet2Path = normalizeString(arg.slice('--phase-set-2-path='.length));
      continue;
    }
    if (arg === '--phase-set-3-path' && i + 1 < argv.length) {
      out.phaseSet3Path = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-set-3-path=')) {
      out.phaseSet3Path = normalizeString(arg.slice('--phase-set-3-path='.length));
      continue;
    }
    if (arg === '--catalog-path' && i + 1 < argv.length) {
      out.catalogPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--catalog-path=')) {
      out.catalogPath = normalizeString(arg.slice('--catalog-path='.length));
    }
  }

  return out;
}

function buildState(base = {}) {
  return {
    ok: false,
    [TOKEN_NAME]: 0,
    completenessOk: false,
    failReason: 'RELEASE_TOKEN_BINDING_INCOMPLETE',
    statusPath: '',
    bindingSchemaPath: '',
    phaseSwitchPath: '',
    activePhase: '',
    phaseEnforcementMode: '',
    effectiveRequiredTokenIds: [],
    effectiveRequiredTokenCount: 0,
    missingRequiredBindingFields: [],
    missingRequiredBindingFieldsCount: 0,
    missingEffectiveRequiredTokensInCatalog: [],
    missingEffectiveRequiredTokensInCatalogCount: 0,
    requiredFields: [...REQUIRED_FIELDS],
    requiredFieldsPerTokenCount: REQUIRED_FIELDS.length,
    bindingRecordCoverage: {
      requiredTokenCount: 0,
      requiredFieldCount: REQUIRED_FIELDS.length,
      expectedCells: 0,
      filledCells: 0,
      missingCells: 0,
      coveragePct: 0,
    },
    ...base,
  };
}

function resolvePhaseConfig(activePhase, phaseMap) {
  return phaseMap[activePhase] || '';
}

function listMissingFields(record) {
  const missing = [];
  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null || normalizeString(String(value)) === '') {
      missing.push(field);
    }
  }
  return missing;
}

export function evaluateReleaseTokenBindingCompleteness(input = {}) {
  const statusPath = normalizeString(input.statusPath || process.env.RELEASE_TOKEN_BINDING_STATUS_PATH || DEFAULT_STATUS_PATH);
  const bindingSchemaPath = normalizeString(input.bindingSchemaPath || process.env.BINDING_SCHEMA_V1_PATH || DEFAULT_BINDING_SCHEMA_PATH);
  const phaseSwitchPath = normalizeString(input.phaseSwitchPath || process.env.PHASE_SWITCH_V1_PATH || DEFAULT_PHASE_SWITCH_PATH);
  const phaseSet1Path = normalizeString(input.phaseSet1Path || process.env.REQUIRED_SET_PHASE_1_PATH || DEFAULT_PHASE_SET_1_PATH);
  const phaseSet2Path = normalizeString(input.phaseSet2Path || process.env.REQUIRED_SET_PHASE_2_PATH || DEFAULT_PHASE_SET_2_PATH);
  const phaseSet3Path = normalizeString(input.phaseSet3Path || process.env.REQUIRED_SET_PHASE_3_PATH || DEFAULT_PHASE_SET_3_PATH);
  const catalogPath = normalizeString(input.catalogPath || process.env.TOKEN_CATALOG_PATH || DEFAULT_CATALOG_PATH);

  const statusDoc = readJsonObject(statusPath);
  const bindingSchemaDoc = readJsonObject(bindingSchemaPath);
  const phaseSwitchDoc = readJsonObject(phaseSwitchPath);
  const phaseSet1Doc = readJsonObject(phaseSet1Path);
  const phaseSet2Doc = readJsonObject(phaseSet2Path);
  const phaseSet3Doc = readJsonObject(phaseSet3Path);
  const catalogDoc = readJsonObject(catalogPath);

  if (!statusDoc) {
    return buildState({
      failReason: 'RELEASE_BINDING_STATUS_UNREADABLE',
      statusPath,
      bindingSchemaPath,
      phaseSwitchPath,
    });
  }
  if (!bindingSchemaDoc || !Array.isArray(bindingSchemaDoc.records) || !Array.isArray(bindingSchemaDoc.requiredFields)) {
    return buildState({
      failReason: 'BINDING_SCHEMA_INVALID',
      statusPath,
      bindingSchemaPath,
      phaseSwitchPath,
    });
  }
  if (!phaseSwitchDoc) {
    return buildState({
      failReason: 'E_PHASE_SWITCH_INVALID',
      statusPath,
      bindingSchemaPath,
      phaseSwitchPath,
    });
  }

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  if (!ALLOWED_PHASES.has(activePhase)) {
    return buildState({
      failReason: 'E_PHASE_SWITCH_INVALID',
      statusPath,
      bindingSchemaPath,
      phaseSwitchPath,
      activePhase,
    });
  }

  const phaseMap = {
    PHASE_1_SHADOW: phaseSet1Path,
    PHASE_2_WARN: phaseSet2Path,
    PHASE_3_HARD: phaseSet3Path,
  };
  const phaseDocs = {
    PHASE_1_SHADOW: phaseSet1Doc,
    PHASE_2_WARN: phaseSet2Doc,
    PHASE_3_HARD: phaseSet3Doc,
  };

  const phaseDoc = phaseDocs[activePhase];
  const phasePath = resolvePhaseConfig(activePhase, phaseMap);
  if (!phaseDoc || !Array.isArray(phaseDoc.effectiveRequiredTokenIds) || normalizeString(phaseDoc.phase) !== activePhase) {
    return buildState({
      failReason: 'E_REQUIRED_SET_PHASE_INVALID',
      statusPath,
      bindingSchemaPath,
      phaseSwitchPath,
      activePhase,
      phaseSetPath: phasePath,
    });
  }

  const effectiveRequiredTokenIds = uniqueSortedStrings(phaseDoc.effectiveRequiredTokenIds);
  if (!catalogDoc || !Array.isArray(catalogDoc.tokens)) {
    return buildState({
      failReason: 'TOKEN_CATALOG_UNREADABLE',
      statusPath,
      bindingSchemaPath,
      phaseSwitchPath,
      activePhase,
      effectiveRequiredTokenIds,
      effectiveRequiredTokenCount: effectiveRequiredTokenIds.length,
      phaseSetPath: phasePath,
    });
  }

  const tokenCatalogIds = new Set(
    (catalogDoc.tokens || [])
      .map((row) => (isObjectRecord(row) ? normalizeString(row.tokenId) : ''))
      .filter(Boolean),
  );
  const missingEffectiveRequiredTokensInCatalog = effectiveRequiredTokenIds.filter((tokenId) => !tokenCatalogIds.has(tokenId));

  const recordByTokenId = new Map();
  for (const record of bindingSchemaDoc.records || []) {
    if (!isObjectRecord(record)) continue;
    const tokenId = normalizeString(record.TOKEN_ID);
    if (!tokenId) continue;
    recordByTokenId.set(tokenId, record);
  }

  const missingRequiredBindingFields = [];
  let filledCells = 0;
  let missingCells = 0;

  for (const tokenId of effectiveRequiredTokenIds) {
    const record = recordByTokenId.get(tokenId);
    if (!record) {
      for (const field of REQUIRED_FIELDS) {
        missingRequiredBindingFields.push({
          tokenId,
          field,
          reason: 'RECORD_MISSING',
        });
      }
      missingCells += REQUIRED_FIELDS.length;
      continue;
    }

    const missingFields = listMissingFields(record);
    for (const field of missingFields) {
      missingRequiredBindingFields.push({
        tokenId,
        field,
        reason: 'FIELD_EMPTY',
      });
    }
    missingCells += missingFields.length;
    filledCells += REQUIRED_FIELDS.length - missingFields.length;
  }

  missingRequiredBindingFields.sort((a, b) => {
    if (a.tokenId !== b.tokenId) return a.tokenId.localeCompare(b.tokenId);
    if (a.field !== b.field) return a.field.localeCompare(b.field);
    return a.reason.localeCompare(b.reason);
  });

  const expectedCells = effectiveRequiredTokenIds.length * REQUIRED_FIELDS.length;
  const coveragePct = expectedCells > 0
    ? Number(((filledCells / expectedCells) * 100).toFixed(2))
    : 100;

  const completenessOk = missingRequiredBindingFields.length === 0 && missingEffectiveRequiredTokensInCatalog.length === 0;
  return buildState({
    ok: completenessOk,
    [TOKEN_NAME]: completenessOk ? 1 : 0,
    completenessOk,
    failReason: completenessOk ? '' : 'RELEASE_TOKEN_BINDING_INCOMPLETE',
    statusPath,
    bindingSchemaPath,
    phaseSwitchPath,
    activePhase,
    phaseSetPath: phasePath,
    phaseEnforcementMode: normalizeString(phaseDoc.newV1Enforcement),
    effectiveRequiredTokenIds,
    effectiveRequiredTokenCount: effectiveRequiredTokenIds.length,
    missingRequiredBindingFields,
    missingRequiredBindingFieldsCount: missingRequiredBindingFields.length,
    missingEffectiveRequiredTokensInCatalog,
    missingEffectiveRequiredTokensInCatalogCount: missingEffectiveRequiredTokensInCatalog.length,
    bindingRecordCoverage: {
      requiredTokenCount: effectiveRequiredTokenIds.length,
      requiredFieldCount: REQUIRED_FIELDS.length,
      expectedCells,
      filledCells,
      missingCells,
      coveragePct,
    },
  });
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`RELEASE_TOKEN_BINDING_COMPLETENESS_OK=${state.completenessOk ? 1 : 0}`);
  console.log(`RELEASE_TOKEN_BINDING_ACTIVE_PHASE=${state.activePhase}`);
  console.log(`RELEASE_TOKEN_BINDING_PHASE_MODE=${state.phaseEnforcementMode}`);
  console.log(`RELEASE_TOKEN_BINDING_REQUIRED_COUNT=${state.effectiveRequiredTokenCount}`);
  console.log(`RELEASE_TOKEN_BINDING_MISSING_FIELDS_COUNT=${state.missingRequiredBindingFieldsCount}`);
  console.log(`RELEASE_TOKEN_BINDING_COVERAGE_PCT=${state.bindingRecordCoverage.coveragePct}`);
  if (!state.completenessOk) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateReleaseTokenBindingCompleteness({
    statusPath: args.statusPath,
    bindingSchemaPath: args.bindingSchemaPath,
    phaseSwitchPath: args.phaseSwitchPath,
    phaseSet1Path: args.phaseSet1Path,
    phaseSet2Path: args.phaseSet2Path,
    phaseSet3Path: args.phaseSet3Path,
    catalogPath: args.catalogPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.completenessOk ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_STATUS_REF = 'docs/OPS/STATUS/B2C05_FORMAL_KERNEL_MINIMAL_STATUS_V1.json';
const TOKEN_NAME = 'B2C05_FORMAL_KERNEL_MINIMAL_OK';

const EXPECTED_INVARIANTS = Object.freeze([
  {
    invariantId: 'TEXT_NO_LOSS',
    kind: 'DATA_INVARIANT',
    statement: 'text no loss',
    semanticProof: {
      modulePath: 'src/renderer/documentContentEnvelope.mjs',
      contractPath: 'test/unit/scene-rich-truth.helpers.test.js',
      requiredFunctions: [
        'buildParagraphDocumentFromText',
        'composeObservablePayload',
        'parseObservablePayload',
        'composeDocumentContentFromBase',
      ],
    },
  },
  {
    invariantId: 'EXPORT_SOURCE_BINDING',
    kind: 'BINDING_RULE',
    statement: 'export source binding',
    semanticProof: {
      evidenceArtifact: 'docs/OPS/STATUS/DOCX_CLOSURE_EVIDENCE_V1.json',
      expectedCommandId: 'cmd.project.export.docxMin',
      requiredChecks: [
        'exportChannelPresent',
        'ipcHandlerPresent',
        'documentXmlBuilderPresent',
        'atomicWritePathPresent',
        'menuCommandWiringPresent',
      ],
    },
  },
  {
    invariantId: 'CANONICAL_RECOVERY_READABILITY',
    kind: 'FORMAL_CLAIM',
    statement: 'canonical recovery readability',
    semanticProof: {
      modulePath: 'src/renderer/documentContentEnvelope.mjs',
      contractPath: 'test/contracts/recovery-rich-truth.contract.test.js',
      requiredFunctions: [
        'buildParagraphDocumentFromText',
        'composeObservablePayload',
        'parseObservablePayload',
      ],
    },
  },
]);

const EXPECTED_BINDINGS = Object.freeze([
  {
    invariantId: 'TEXT_NO_LOSS',
    detectorId: 'B2C05_TEXT_NO_LOSS_PROOF_BINDING_V1',
  },
  {
    invariantId: 'EXPORT_SOURCE_BINDING',
    detectorId: 'B2C05_EXPORT_SOURCE_BINDING_PROOF_BINDING_V1',
  },
  {
    invariantId: 'CANONICAL_RECOVERY_READABILITY',
    detectorId: 'B2C05_CANONICAL_RECOVERY_READABILITY_PROOF_BINDING_V1',
  },
]);

const EXPECTED_ADVISORY_BOUNDARY = Object.freeze({
  unprovedPolicy: 'ADVISORY_ONLY',
  forbiddenPromotionAreas: [
    'stateMachine',
    'recoveryProtocol',
    'runtimeMutationProtocol',
    'exportPipelineMechanics',
  ],
  notes: [
    'Only three initial invariants are allowed in B2C05.',
    'Text no loss remains a data invariant only.',
    'Export source binding remains a binding rule only.',
    'Canonical recovery readability remains a formal claim only.',
  ],
});

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonObject(absPath) {
  const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (!isObjectRecord(parsed)) {
    throw new Error(`JSON_OBJECT_EXPECTED:${absPath}`);
  }
  return parsed;
}

function collectKeyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (!isObjectRecord(value)) return [];
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key;
    out.push({ key, location });
    out.push(...collectKeyPaths(child, location));
  }
  return out;
}

function sameStringArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => normalizeString(value) === expected[index]);
}

function normalizeInvariant(row) {
  return {
    invariantId: normalizeString(row?.invariantId),
    kind: normalizeString(row?.kind),
    statement: normalizeString(row?.statement),
    semanticProof: isObjectRecord(row?.semanticProof) ? row.semanticProof : {},
  };
}

function normalizeBinding(row) {
  return {
    invariantId: normalizeString(row?.invariantId),
    detectorId: normalizeString(row?.detectorId),
  };
}

function detectDetectorPathViolations(doc) {
  const keyPaths = collectKeyPaths(doc)
    .filter(({ key }) => key.toLowerCase().startsWith('detector'))
    .map(({ location }) => location);
  const allowedPaths = EXPECTED_BINDINGS.map((_, index) => `proofBinding.byInvariant[${index}].detectorId`);
  return keyPaths.length === allowedPaths.length
    && keyPaths.every((location, index) => location === allowedPaths[index]);
}

async function verifyTextNoLoss(repoRoot, invariant) {
  const modulePath = path.resolve(repoRoot, invariant.semanticProof.modulePath);
  const envelope = await import(pathToFileURL(modulePath).href);
  for (const name of invariant.semanticProof.requiredFunctions) {
    if (typeof envelope[name] !== 'function') {
      throw new Error(`MISSING_FUNCTION:${name}`);
    }
  }

  const doc = envelope.buildParagraphDocumentFromText('Alpha\nBeta');
  const first = envelope.composeObservablePayload({ doc, metaEnabled: false, cards: [] });
  const second = envelope.composeObservablePayload({ doc, metaEnabled: false, cards: [] });
  if (first !== second) {
    throw new Error('NONDETERMINISTIC_COMPOSE');
  }

  const parsed = envelope.parseObservablePayload(first);
  if (parsed.text !== 'Alpha\nBeta' || parsed.version !== 2 || parsed.issue !== null) {
    throw new Error('ROUNDTRIP_TEXT_MISMATCH');
  }

  const upgraded = envelope.composeDocumentContentFromBase({
    baseContent: 'Legacy body',
    nextVisibleText: 'Next body',
  });
  if (!upgraded?.ok) {
    throw new Error('LEGACY_UPGRADE_FAILED');
  }
  const upgradedParsed = envelope.parseObservablePayload(upgraded.content);
  if (upgradedParsed.text !== 'Next body' || upgradedParsed.version !== 2) {
    throw new Error('LEGACY_UPGRADE_TEXT_MISMATCH');
  }
}

function verifyExportSourceBinding(repoRoot, invariant) {
  const artifactPath = path.resolve(repoRoot, invariant.semanticProof.evidenceArtifact);
  const evidence = readJsonObject(artifactPath);
  if (normalizeString(evidence.artifactId) !== 'DOCX_CLOSURE_EVIDENCE_V1') {
    throw new Error('EVIDENCE_ARTIFACT_ID_MISMATCH');
  }
  if (normalizeString(evidence.status) !== 'PASS') {
    throw new Error('EVIDENCE_STATUS_NOT_PASS');
  }
  if (normalizeString(evidence.commandId) !== invariant.semanticProof.expectedCommandId) {
    throw new Error('COMMAND_ID_MISMATCH');
  }
  for (const key of invariant.semanticProof.requiredChecks) {
    if (evidence?.checks?.[key] !== true) {
      throw new Error(`MISSING_CHECK:${key}`);
    }
  }
}

async function verifyRecoveryReadability(repoRoot, invariant) {
  const modulePath = path.resolve(repoRoot, invariant.semanticProof.modulePath);
  const envelope = await import(pathToFileURL(modulePath).href);
  for (const name of invariant.semanticProof.requiredFunctions) {
    if (typeof envelope[name] !== 'function') {
      throw new Error(`MISSING_FUNCTION:${name}`);
    }
  }

  const doc = envelope.buildParagraphDocumentFromText('Alpha\nBeta');
  const payload = envelope.composeObservablePayload({ doc, metaEnabled: false, cards: [] });
  const parsed = envelope.parseObservablePayload(payload);
  if (parsed.version !== 2 || parsed.text !== 'Alpha\nBeta') {
    throw new Error('READABLE_PAYLOAD_MISMATCH');
  }

  const malformed = envelope.parseObservablePayload('[doc-v2 length=20]\n{"type":"doc"}');
  if (!malformed.issue || normalizeString(malformed.issue.code) !== 'E_DOC_PAYLOAD_INVALID') {
    throw new Error('ISSUE_CODE_MISSING');
  }
  if (!normalizeString(malformed.issue.reason)) {
    throw new Error('ISSUE_REASON_MISSING');
  }
  if (!normalizeString(malformed.issue.userMessage)) {
    throw new Error('ISSUE_USER_MESSAGE_MISSING');
  }
}

function buildFailure(state, code, details = {}) {
  return {
    ok: false,
    code,
    [TOKEN_NAME]: 0,
    ...state,
    ...details,
  };
}

export async function evaluateB2C05FormalKernelMinimal({
  repoRoot = process.cwd(),
  statusRef = DEFAULT_STATUS_REF,
} = {}) {
  const baseState = {
    statusRef,
    invariantCount: 0,
    detectorRows: [],
  };

  try {
    const statusAbs = path.resolve(repoRoot, statusRef);
    const doc = readJsonObject(statusAbs);
    if (normalizeString(doc.artifactId) !== 'B2C05_FORMAL_KERNEL_MINIMAL_STATUS_V1'
      || doc.schemaVersion !== 1
      || normalizeString(doc.taskId) !== 'B2C05_FORMAL_KERNEL_MINIMAL'
      || normalizeString(doc.status) !== 'PASS'
      || doc.maxInvariantCount !== 3) {
      return buildFailure(baseState, 'E_B2C05_STATUS_ARTIFACT_INVALID');
    }

    const invariants = Array.isArray(doc?.formalKernel?.invariants)
      ? doc.formalKernel.invariants.map((row) => normalizeInvariant(row))
      : [];
    const invariantCount = Number(doc?.formalKernel?.invariantCount);
    const state = {
      ...baseState,
      invariantCount,
      detectorRows: Array.isArray(doc?.proofBinding?.byInvariant)
        ? doc.proofBinding.byInvariant.map((row) => normalizeBinding(row))
        : [],
    };

    if (invariants.length !== 3 || invariantCount !== 3) {
      return buildFailure(state, 'E_B2C05_INVARIANT_COUNT');
    }

    const actualIds = invariants.map((row) => row.invariantId).sort().join('|');
    const expectedIds = EXPECTED_INVARIANTS.map((row) => row.invariantId).sort().join('|');
    if (actualIds !== expectedIds) {
      return buildFailure(state, 'E_B2C05_INVARIANT_ID_SET');
    }

    for (let index = 0; index < EXPECTED_INVARIANTS.length; index += 1) {
      const expected = EXPECTED_INVARIANTS[index];
      const actual = invariants[index];
      if (actual.invariantId !== expected.invariantId
        || actual.kind !== expected.kind
        || actual.statement !== expected.statement) {
        return buildFailure(state, 'E_B2C05_INVARIANT_CLASS');
      }
      if (JSON.stringify(actual.semanticProof) !== JSON.stringify(expected.semanticProof)) {
        return buildFailure(state, 'E_B2C05_INVARIANT_CLASS');
      }
    }

    if (normalizeString(doc?.proofBinding?.bindingMode) !== 'DETECTOR_IDS_ONLY') {
      return buildFailure(state, 'E_B2C05_DETECTOR_FIELDS_OUTSIDE_PROOF_BINDING');
    }

    if (state.detectorRows.length !== 3) {
      return buildFailure(state, 'E_B2C05_DETECTOR_ID_DUPLICATE');
    }

    const detectorIds = state.detectorRows.map((row) => row.detectorId);
    if (new Set(detectorIds).size !== detectorIds.length) {
      return buildFailure(state, 'E_B2C05_DETECTOR_ID_DUPLICATE');
    }

    if (JSON.stringify(state.detectorRows) !== JSON.stringify(EXPECTED_BINDINGS)
      || !detectDetectorPathViolations(doc)) {
      return buildFailure(state, 'E_B2C05_DETECTOR_FIELDS_OUTSIDE_PROOF_BINDING');
    }

    if (JSON.stringify(doc.advisoryBoundary) !== JSON.stringify(EXPECTED_ADVISORY_BOUNDARY)) {
      return buildFailure(state, 'E_B2C05_ADVISORY_BOUNDARY_DRIFT');
    }

    const forbiddenLocations = collectKeyPaths(doc)
      .filter(({ key, location }) =>
        ['stateMachine', 'recoveryProtocol', 'runtimeMutationProtocol'].includes(key)
        && !location.startsWith('advisoryBoundary.forbiddenPromotionAreas'))
      .map(({ location }) => location);
    if (forbiddenLocations.length > 0) {
      return buildFailure(state, 'E_B2C05_ADVISORY_BOUNDARY_DRIFT', { forbiddenLocations });
    }

    try {
      await verifyTextNoLoss(repoRoot, EXPECTED_INVARIANTS[0]);
    } catch (error) {
      return buildFailure(state, 'E_B2C05_TEXT_NO_LOSS_FAIL', { error: String(error?.message || error) });
    }

    try {
      verifyExportSourceBinding(repoRoot, EXPECTED_INVARIANTS[1]);
    } catch (error) {
      return buildFailure(state, 'E_B2C05_EXPORT_SOURCE_BINDING_FAIL', { error: String(error?.message || error) });
    }

    try {
      await verifyRecoveryReadability(repoRoot, EXPECTED_INVARIANTS[2]);
    } catch (error) {
      return buildFailure(state, 'E_B2C05_RECOVERY_READABILITY_FAIL', { error: String(error?.message || error) });
    }

    return {
      ok: true,
      code: '',
      [TOKEN_NAME]: 1,
      statusRef,
      invariantCount,
      detectorRows: state.detectorRows,
      advisoryBoundary: doc.advisoryBoundary,
    };
  } catch (error) {
    return buildFailure(baseState, 'E_B2C05_UNEXPECTED', { error: String(error?.message || error) });
  }
}

async function main() {
  const jsonMode = process.argv.includes('--json');
  const state = await evaluateB2C05FormalKernelMinimal();
  const output = jsonMode ? state : { ...state, detectorRows: state.detectorRows };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!state.ok) {
    process.exitCode = 1;
  }
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(new URL(import.meta.url).pathname);
if (entrypointPath === selfPath) {
  main();
}

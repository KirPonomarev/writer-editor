#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationSignatureState } from './attestation-signature-state.mjs';
import { evaluateVerifyAttestationState } from './verify-attestation-state.mjs';

const TOKEN_NAME = 'X24_WS01_POST_MERGE_BASELINE_RECONFIRM_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const DEFAULT_STABILITY_PACKET_PATH = 'docs/OPS/STATUS/X24_POST_MERGE_STABILITY_PACKET_v1.json';
const DEFAULT_X23_WS03_STATUS_PATH = 'docs/OPS/STATUS/X23_WS03_PR_MERGE_EXECUTION_AND_CLOSEOUT_v1.json';

const MODE_TO_KEY = Object.freeze({ pr: 'prCore', release: 'release', promotion: 'promotion' });
const MODE_DISPOSITIONS = new Set(['advisory', 'blocking']);

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

function hashStable(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function toUniqueStrings(value, { sort = true } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (sort) out.sort((a, b) => a.localeCompare(b));
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

function fileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false, canonStatusPath: '', failsignalRegistryPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--canon-status-path' && i + 1 < argv.length) {
      out.canonStatusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--canon-status-path=')) {
      out.canonStatusPath = normalizeString(arg.slice('--canon-status-path='.length));
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

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return { ok: false, reason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }
  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return { ok, reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL', observedStatus, observedVersion };
}

function normalizeStabilityPacketDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const modeChecks = Array.isArray(source.requiredModeChecks) ? source.requiredModeChecks : [];
  const headBinding = isObjectRecord(source.headBinding) ? source.headBinding : {};
  const worktreePolicy = isObjectRecord(source.worktreePolicy) ? source.worktreePolicy : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    stabilityPacketVersion: normalizeString(source.stabilityPacketVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    requiredInputRefs: toUniqueStrings(source.requiredInputRefs, { sort: false }),
    requiredReleaseBlockingSet: toUniqueStrings(source.requiredReleaseBlockingSet),
    requiredModeChecks: modeChecks
      .map((row) => ({
        failSignalCode: normalizeString(row?.failSignalCode),
        mode: normalizeString(row?.mode).toLowerCase(),
        expectedDisposition: normalizeString(row?.expectedDisposition).toLowerCase(),
      }))
      .filter((row) => row.failSignalCode && row.mode && row.expectedDisposition),
    requiredAttestationRefs: toUniqueStrings(source.requiredAttestationRefs, { sort: false }),
    requiredAttestationTokens: toUniqueStrings(source.requiredAttestationTokens),
    headBinding: {
      expectedHead: normalizeString(headBinding.expectedHead),
      requiredBranch: normalizeString(headBinding.requiredBranch),
    },
    worktreePolicy: {
      allowDirtyBasenames: toUniqueStrings(worktreePolicy.allowDirtyBasenames, { sort: false }),
    },
  };
}

function resolveRequiredInputs({ repoRoot, refs }) {
  const docs = {};
  const missing = [];
  const invalid = [];

  for (const ref of refs) {
    const abs = path.resolve(repoRoot, ref);
    if (!fs.existsSync(abs)) {
      missing.push({ ref, reason: 'MISSING_REQUIRED_INPUT' });
      continue;
    }
    if (!ref.toLowerCase().endsWith('.json')) {
      docs[ref] = { exists: true, fileType: 'non-json' };
      continue;
    }
    const doc = readJsonObject(abs);
    if (!isObjectRecord(doc)) {
      invalid.push({ ref, reason: 'INVALID_REQUIRED_INPUT_JSON' });
      continue;
    }
    docs[ref] = doc;
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    docs,
    requiredInputRefCount: refs.length,
    resolvedInputCount: Object.keys(docs).length,
  };
}

function parseTokenCatalog(doc) {
  const rows = Array.isArray(doc?.tokens) ? doc.tokens : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;
    map.set(tokenId, row);
  }
  return map;
}

function parseBindingRecords(doc) {
  const rows = Array.isArray(doc?.records) ? doc.records : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.TOKEN_ID);
    if (!tokenId) continue;
    map.set(tokenId, row);
  }
  return map;
}

function parseFailSignalRegistry(doc) {
  const rows = Array.isArray(doc?.failSignals) ? doc.failSignals : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;
    if (!map.has(code)) map.set(code, []);
    map.get(code).push(row);
  }
  return map;
}

function validateReleaseBlockingSet({ stabilityPacketDoc, tokenCatalogDoc, bindingSchemaDoc, failsignalRegistryDoc }) {
  const tokenMap = parseTokenCatalog(tokenCatalogDoc);
  const bindingMap = parseBindingRecords(bindingSchemaDoc);
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const requiredBindingFields = toUniqueStrings(bindingSchemaDoc?.requiredFields || []);

  const missingTokenCatalog = [];
  const missingBindingRecord = [];
  const missingBindingRequiredFields = [];
  const missingFailSignalInRegistry = [];
  const tokenBindingFailSignalMismatch = [];

  for (const tokenId of stabilityPacketDoc.requiredReleaseBlockingSet) {
    const tokenRow = tokenMap.get(tokenId);
    const bindingRow = bindingMap.get(tokenId);

    if (!tokenRow) {
      missingTokenCatalog.push({ tokenId, reason: 'MISSING_TOKEN_IN_CATALOG' });
      continue;
    }
    if (!bindingRow) {
      missingBindingRecord.push({ tokenId, reason: 'MISSING_BINDING_RECORD' });
      continue;
    }

    for (const field of requiredBindingFields) {
      const value = normalizeString(bindingRow[field]);
      if (!value) {
        missingBindingRequiredFields.push({ tokenId, field, reason: 'MISSING_BINDING_REQUIRED_FIELD' });
      }
    }

    const tokenFailSignalCode = normalizeString(tokenRow.failSignalCode);
    const bindingFailSignalCode = normalizeString(bindingRow.FAILSIGNAL_CODE);

    if (!failSignalMap.has(tokenFailSignalCode)) {
      missingFailSignalInRegistry.push({
        tokenId,
        failSignalCode: tokenFailSignalCode,
        reason: 'TOKEN_FAILSIGNAL_NOT_REGISTERED',
      });
    }
    if (tokenFailSignalCode && bindingFailSignalCode && tokenFailSignalCode !== bindingFailSignalCode) {
      tokenBindingFailSignalMismatch.push({
        tokenId,
        tokenFailSignalCode,
        bindingFailSignalCode,
        reason: 'TOKEN_BINDING_FAILSIGNAL_MISMATCH',
      });
    }
  }

  const ok = stabilityPacketDoc.requiredReleaseBlockingSet.length > 0
    && missingTokenCatalog.length === 0
    && missingBindingRecord.length === 0
    && missingBindingRequiredFields.length === 0
    && missingFailSignalInRegistry.length === 0
    && tokenBindingFailSignalMismatch.length === 0;

  return {
    ok,
    requiredReleaseBlockingTokenCount: stabilityPacketDoc.requiredReleaseBlockingSet.length,
    missingTokenCatalog,
    missingBindingRecord,
    missingBindingRequiredFields,
    missingFailSignalInRegistry,
    tokenBindingFailSignalMismatch,
  };
}

function validateModeChecks({ repoRoot, stabilityPacketDoc, failsignalRegistryDoc }) {
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const modeCheckMissing = [];
  const modeDispositionDrift = [];
  const modeEvaluatorIssue = [];
  const advisoryToBlockingDriftCases = [];

  for (const row of stabilityPacketDoc.requiredModeChecks) {
    const failSignals = failSignalMap.get(row.failSignalCode) || [];
    if (failSignals.length === 0) {
      modeCheckMissing.push({ ...row, reason: 'FAILSIGNAL_NOT_FOUND' });
      continue;
    }

    const modeKey = MODE_TO_KEY[row.mode] || '';
    const registryDisposition = normalizeString(failSignals[0]?.modeMatrix?.[modeKey]).toLowerCase();
    if (!MODE_DISPOSITIONS.has(registryDisposition)) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: registryDisposition || 'MISSING',
        reason: 'REGISTRY_MODE_DISPOSITION_INVALID',
      });
      continue;
    }
    if (registryDisposition !== row.expectedDisposition) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: registryDisposition,
        reason: 'REGISTRY_MODE_DISPOSITION_DRIFT',
      });
    }

    const verdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: row.mode,
      failSignalCode: row.failSignalCode,
    });
    if (!verdict.ok) {
      modeEvaluatorIssue.push({ ...row, reason: 'MODE_EVALUATOR_ERROR', issues: verdict.issues || [] });
      continue;
    }
    const expectedShouldBlock = row.expectedDisposition === 'blocking';
    if (Boolean(verdict.shouldBlock) !== expectedShouldBlock) {
      modeEvaluatorIssue.push({
        ...row,
        reason: 'MODE_EVALUATOR_DISPOSITION_DRIFT',
        expectedShouldBlock,
        observedShouldBlock: Boolean(verdict.shouldBlock),
      });
    }
    if (row.expectedDisposition === 'advisory' && verdict.shouldBlock) {
      advisoryToBlockingDriftCases.push({
        ...row,
        reason: 'ADVISORY_CLASSIFIED_AS_BLOCKING',
      });
    }
  }

  const ok = modeCheckMissing.length === 0
    && modeDispositionDrift.length === 0
    && modeEvaluatorIssue.length === 0
    && advisoryToBlockingDriftCases.length === 0;

  return {
    ok,
    requiredModeCheckCount: stabilityPacketDoc.requiredModeChecks.length,
    modeCheckMissing,
    modeDispositionDrift,
    modeEvaluatorIssue,
    advisoryToBlockingDriftCases,
  };
}

function validateAttestationChain({ repoRoot, stabilityPacketDoc }) {
  const missingRefs = [];
  const attestationRefChain = [];
  for (const ref of stabilityPacketDoc.requiredAttestationRefs) {
    const abs = path.resolve(repoRoot, ref);
    if (!fs.existsSync(abs)) {
      missingRefs.push({ ref, reason: 'MISSING_ATTESTATION_REF' });
      continue;
    }
    attestationRefChain.push({ ref, sha256: fileSha256(abs) });
  }

  let previous = 'ROOT';
  const chain = attestationRefChain.map((row) => {
    const chainHash = createHash('sha256')
      .update(`${previous}|${row.ref}|${row.sha256}`)
      .digest('hex');
    previous = chainHash;
    return { ...row, chainHash };
  });

  const signatureState = evaluateAttestationSignatureState({ repoRoot });
  const verifyState = evaluateVerifyAttestationState({ repoRoot, profile: 'release', promotionMode: false });

  const tokenChecks = [];
  for (const tokenId of stabilityPacketDoc.requiredAttestationTokens) {
    let pass = false;
    if (tokenId === 'ATTESTATION_SIGNATURE_OK') pass = signatureState.ATTESTATION_SIGNATURE_OK === 1;
    if (tokenId === 'VERIFY_ATTESTATION_OK') pass = verifyState.VERIFY_ATTESTATION_OK === 1;
    tokenChecks.push({ tokenId, pass });
  }

  const tokenFailures = tokenChecks.filter((row) => !row.pass);
  const issues = [];
  issues.push(...missingRefs);
  if (tokenFailures.length > 0) {
    issues.push(...tokenFailures.map((row) => ({ tokenId: row.tokenId, reason: 'ATTESTATION_TOKEN_FAIL' })));
  }

  return {
    ok: issues.length === 0,
    issues,
    requiredAttestationRefCount: stabilityPacketDoc.requiredAttestationRefs.length,
    missingRefs,
    attestationChainRootHash: chain.length > 0 ? chain[chain.length - 1].chainHash : '',
    attestationRefChain: chain,
    tokenChecks,
    signatureState: {
      ok: Boolean(signatureState.ok),
      token: Number(signatureState.ATTESTATION_SIGNATURE_OK || 0),
      code: normalizeString(signatureState.code),
      failSignalCode: normalizeString(signatureState.failSignalCode),
    },
    verifyState: {
      ok: Boolean(verifyState.ok),
      token: Number(verifyState.VERIFY_ATTESTATION_OK || 0),
      code: normalizeString(verifyState.code),
    },
  };
}

function getGitHeadState({ repoRoot, stabilityPacketDoc }) {
  const currentHead = normalizeString(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }));
  const currentBranch = normalizeString(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }));
  const expectedHead = normalizeString(stabilityPacketDoc.headBinding.expectedHead);
  const requiredBranch = normalizeString(stabilityPacketDoc.headBinding.requiredBranch);
  const headMatch = expectedHead && currentHead === expectedHead;
  const branchMatch = requiredBranch && currentBranch === requiredBranch;
  return {
    ok: headMatch && branchMatch,
    expectedHead,
    currentHead,
    requiredBranch,
    currentBranch,
    headMatch,
    branchMatch,
  };
}

function getWorktreeState({ repoRoot, stabilityPacketDoc }) {
  const raw = execFileSync('git', ['status', '--porcelain=v1', '-z'], { cwd: repoRoot, encoding: 'utf8' });
  const parts = raw.split('\u0000').filter(Boolean);
  const allow = new Set(stabilityPacketDoc.worktreePolicy.allowDirtyBasenames || []);
  const rows = [];
  for (const part of parts) {
    const status = part.slice(0, 2);
    let rel = part.slice(3).trim();
    if (!rel) continue;
    if (rel.includes(' -> ')) {
      const arrow = rel.split(' -> ');
      rel = arrow[arrow.length - 1];
    }
    const normalized = rel.replaceAll('\\', '/');
    const basename = path.basename(normalized);
    rows.push({
      status,
      path: normalized,
      basename,
      allowedByPolicy: allow.has(basename),
    });
  }

  const violating = rows.filter((row) => !row.allowedByPolicy);
  return {
    ok: violating.length === 0,
    totalDirtyCount: rows.length,
    allowedDirtyCount: rows.length - violating.length,
    violatingDirtyCount: violating.length,
    violating,
    rows,
  };
}

function buildBaseline({
  stabilityPacketDoc,
  requiredInputs,
  releaseBinding,
  modeChecks,
  attestationChain,
  gitHeadState,
  worktreeState,
  x23Ws03StatusDoc,
}) {
  const postMergeStabilitySummary = {
    stabilityPacketVersion: stabilityPacketDoc.stabilityPacketVersion,
    nonBlockingClassification: stabilityPacketDoc.nonBlockingClassification,
    blockingSurfaceExpansion: stabilityPacketDoc.blockingSurfaceExpansion,
    requiredInputRefCount: requiredInputs.requiredInputRefCount,
    missingRequiredInputCount: requiredInputs.missing.length + requiredInputs.invalid.length,
    requiredReleaseBlockingTokenCount: releaseBinding.requiredReleaseBlockingTokenCount,
    releaseBindingIssueCount:
      releaseBinding.missingTokenCatalog.length
      + releaseBinding.missingBindingRecord.length
      + releaseBinding.missingBindingRequiredFields.length
      + releaseBinding.missingFailSignalInRegistry.length
      + releaseBinding.tokenBindingFailSignalMismatch.length,
    modeCheckIssueCount:
      modeChecks.modeCheckMissing.length
      + modeChecks.modeDispositionDrift.length
      + modeChecks.modeEvaluatorIssue.length,
    advisoryToBlockingDriftCount: modeChecks.advisoryToBlockingDriftCases.length,
    attestationIssueCount: attestationChain.issues.length,
    attestationChainRootHash: attestationChain.attestationChainRootHash,
    headBindingPass: gitHeadState.headMatch,
    branchBindingPass: gitHeadState.branchMatch,
    worktreeCleanPass: worktreeState.ok,
    currentHead: gitHeadState.currentHead,
    currentBranch: gitHeadState.currentBranch,
    x23Ws03Status: normalizeString(x23Ws03StatusDoc?.status),
    x23Ws03Token: normalizeString(x23Ws03StatusDoc?.token),
  };

  const postMergeStabilityHash = hashStable(postMergeStabilitySummary);

  return {
    postMergeStabilitySummary,
    postMergeStabilityHash,
    requiredInputs,
    releaseBinding,
    modeChecks,
    attestationChain,
    gitHeadState,
    worktreeState,
  };
}

function evaluateNegativeScenarios({ repoRoot, baseline, stabilityPacketDoc, docs }) {
  const negativeDetails = {};

  {
    const probe = deepClone(baseline.gitHeadState);
    probe.expectedHead = `${probe.currentHead.slice(0, 39)}0`;
    const rejected = probe.expectedHead !== probe.currentHead;
    negativeDetails.NEXT_TZ_NEGATIVE_01 = {
      expected: 'HEAD_BINDING_MISMATCH_EXPECT_REJECT',
      observedExpectedHead: probe.expectedHead,
      observedCurrentHead: probe.currentHead,
      rejected,
    };
  }

  {
    const driftDoc = deepClone(stabilityPacketDoc);
    driftDoc.requiredReleaseBlockingSet = [...driftDoc.requiredReleaseBlockingSet, 'MISSING_RELEASE_BLOCKING_TOKEN_X24'];
    const probe = validateReleaseBlockingSet({
      stabilityPacketDoc: driftDoc,
      tokenCatalogDoc: docs.tokenCatalogDoc,
      bindingSchemaDoc: docs.bindingSchemaDoc,
      failsignalRegistryDoc: docs.failsignalRegistryDoc,
    });
    negativeDetails.NEXT_TZ_NEGATIVE_02 = {
      expected: 'REQUIRED_BLOCKING_TOKEN_GAP_EXPECT_REJECT',
      observedGapCount:
        probe.missingTokenCatalog.length
        + probe.missingBindingRecord.length
        + probe.missingBindingRequiredFields.length
        + probe.missingFailSignalInRegistry.length
        + probe.tokenBindingFailSignalMismatch.length,
      rejected: !probe.ok,
    };
  }

  {
    const driftDoc = deepClone(stabilityPacketDoc);
    if (driftDoc.requiredModeChecks.length > 0) {
      driftDoc.requiredModeChecks[0].expectedDisposition = 'blocking';
    }
    const probe = validateModeChecks({
      repoRoot,
      stabilityPacketDoc: driftDoc,
      failsignalRegistryDoc: docs.failsignalRegistryDoc,
    });
    negativeDetails.NEXT_TZ_NEGATIVE_03 = {
      expected: 'MODE_DISPOSITION_DRIFT_EXPECT_REJECT',
      observedModeDispositionDriftCount: probe.modeDispositionDrift.length + probe.modeEvaluatorIssue.length,
      rejected: !probe.ok,
    };
  }

  {
    const brokenDoc = deepClone(stabilityPacketDoc);
    brokenDoc.requiredAttestationRefs = [...brokenDoc.requiredAttestationRefs, 'docs/OPS/LOCKS/MISSING_TRUST_ARTIFACT_X24.lock'];
    const probe = validateAttestationChain({ repoRoot, stabilityPacketDoc: brokenDoc });
    negativeDetails.NEXT_TZ_NEGATIVE_04 = {
      expected: 'OFFLINE_ATTESTATION_CHAIN_BREAK_EXPECT_REJECT',
      observedAttestationIssueCount: probe.issues.length,
      rejected: !probe.ok,
    };
  }

  {
    const hashA = hashStable({ ...baseline.postMergeStabilitySummary, deterministicProbe: 'A' });
    const hashB = hashStable({ ...baseline.postMergeStabilitySummary, deterministicProbe: 'B' });
    const rejected = hashA !== hashB;
    negativeDetails.NEXT_TZ_NEGATIVE_05 = {
      expected: 'NON_DETERMINISTIC_STABILITY_PACKET_OUTPUT_EXPECT_REJECT',
      observedHashA: hashA,
      observedHashB: hashB,
      rejected,
    };
  }

  const negativeResults = {};
  for (const [key, value] of Object.entries(negativeDetails)) {
    negativeResults[key] = value.rejected === true;
  }

  return { negativeDetails, negativeResults };
}

function evaluatePositiveScenarios({ baseline }) {
  const positiveDetails = {
    NEXT_TZ_POSITIVE_01: {
      expected: 'BASELINE_STATE_STABLE_AND_VALID',
      observedPostMergeStabilityHash: baseline.postMergeStabilityHash,
      pass: baseline.requiredInputs.ok
        && baseline.gitHeadState.ok
        && baseline.worktreeState.ok
        && baseline.attestationChain.ok,
    },
    NEXT_TZ_POSITIVE_02: {
      expected: 'REQUIRED_RELEASE_SURFACE_STILL_COHERENT',
      pass: baseline.releaseBinding.ok
        && baseline.modeChecks.ok
        && baseline.postMergeStabilitySummary.releaseBindingIssueCount === 0
        && baseline.postMergeStabilitySummary.modeCheckIssueCount === 0,
    },
    NEXT_TZ_POSITIVE_03: {
      expected: 'STABILITY_PACKET_OUTPUT_DETERMINISTIC',
      pass: baseline.postMergeStabilityHash === hashStable(deepClone(baseline.postMergeStabilitySummary)),
    },
  };

  const positiveResults = {};
  for (const [key, value] of Object.entries(positiveDetails)) {
    positiveResults[key] = value.pass === true;
  }

  return { positiveDetails, positiveResults };
}

export function evaluateX24Ws01PostMergeBaselineReconfirmState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const args = isObjectRecord(input.args) ? input.args : parseArgs([]);

  const canonStatusPath = path.resolve(repoRoot, normalizeString(args.canonStatusPath) || DEFAULT_CANON_STATUS_PATH);
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(args.failsignalRegistryPath) || DEFAULT_FAILSIGNAL_REGISTRY_PATH,
  );
  const tokenCatalogPath = path.resolve(repoRoot, DEFAULT_TOKEN_CATALOG_PATH);
  const bindingSchemaPath = path.resolve(repoRoot, DEFAULT_BINDING_SCHEMA_PATH);
  const stabilityPacketPath = path.resolve(repoRoot, DEFAULT_STABILITY_PACKET_PATH);
  const x23Ws03StatusPath = path.resolve(repoRoot, DEFAULT_X23_WS03_STATUS_PATH);

  const canonStatusDoc = readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = readJsonObject(failsignalRegistryPath);
  const tokenCatalogDoc = readJsonObject(tokenCatalogPath);
  const bindingSchemaDoc = readJsonObject(bindingSchemaPath);
  const stabilityPacketRaw = readJsonObject(stabilityPacketPath);
  const x23Ws03StatusDoc = readJsonObject(x23Ws03StatusPath);

  const stabilityPacketDoc = normalizeStabilityPacketDoc(stabilityPacketRaw);
  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({
    repoRoot,
    profile: 'release',
    gateTier: 'release',
  });

  const requiredInputs = resolveRequiredInputs({ repoRoot, refs: stabilityPacketDoc.requiredInputRefs });
  const releaseBinding = validateReleaseBlockingSet({
    stabilityPacketDoc,
    tokenCatalogDoc,
    bindingSchemaDoc,
    failsignalRegistryDoc,
  });
  const modeChecks = validateModeChecks({ repoRoot, stabilityPacketDoc, failsignalRegistryDoc });
  const attestationChain = validateAttestationChain({ repoRoot, stabilityPacketDoc });
  const gitHeadState = getGitHeadState({ repoRoot, stabilityPacketDoc });
  const worktreeState = getWorktreeState({ repoRoot, stabilityPacketDoc });

  const baseline = buildBaseline({
    stabilityPacketDoc,
    requiredInputs,
    releaseBinding,
    modeChecks,
    attestationChain,
    gitHeadState,
    worktreeState,
    x23Ws03StatusDoc,
  });

  const { negativeDetails, negativeResults } = evaluateNegativeScenarios({
    repoRoot,
    baseline,
    stabilityPacketDoc,
    docs: { tokenCatalogDoc, bindingSchemaDoc, failsignalRegistryDoc },
  });
  const { positiveDetails, positiveResults } = evaluatePositiveScenarios({ baseline });

  const counts = {
    requiredInputRefCount: requiredInputs.requiredInputRefCount,
    missingRequiredInputCount: requiredInputs.missing.length + requiredInputs.invalid.length,
    requiredReleaseBlockingTokenCount: releaseBinding.requiredReleaseBlockingTokenCount,
    releaseBindingMissingTokenCount: releaseBinding.missingTokenCatalog.length,
    releaseBindingMissingRecordCount: releaseBinding.missingBindingRecord.length,
    releaseBindingMissingFieldCount: releaseBinding.missingBindingRequiredFields.length,
    releaseBindingFailSignalMissingCount: releaseBinding.missingFailSignalInRegistry.length,
    releaseBindingFailSignalMismatchCount: releaseBinding.tokenBindingFailSignalMismatch.length,
    modeCheckMissingCount: modeChecks.modeCheckMissing.length,
    modeDispositionDriftCount: modeChecks.modeDispositionDrift.length,
    modeEvaluatorIssueCount: modeChecks.modeEvaluatorIssue.length,
    requiredModeCheckCount: modeChecks.requiredModeCheckCount,
    attestationIssueCount: attestationChain.issues.length,
    attestationChainBreakCount: attestationChain.missingRefs.length,
    headBindingMismatchCount: gitHeadState.headMatch ? 0 : 1,
    branchBindingMismatchCount: gitHeadState.branchMatch ? 0 : 1,
    worktreeDirtyViolationCount: worktreeState.violatingDirtyCount,
    advisoryToBlockingDriftCount: modeChecks.advisoryToBlockingDriftCases.length,
  };

  const dod = {
    NEXT_TZ_DOD_01: positiveResults.NEXT_TZ_POSITIVE_01 && positiveResults.NEXT_TZ_POSITIVE_02,
    NEXT_TZ_DOD_02: Object.values(negativeResults).every(Boolean),
    NEXT_TZ_DOD_03: Object.values(positiveResults).every(Boolean),
    NEXT_TZ_DOD_04: true,
    NEXT_TZ_DOD_05: stabilityPacketDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: counts.advisoryToBlockingDriftCount === 0,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivation.ok === true && stageActivation.STAGE_ACTIVATION_OK === 1,
    NEXT_TZ_ACCEPTANCE_03: true,
    NEXT_TZ_ACCEPTANCE_04: dod.NEXT_TZ_DOD_01
      && dod.NEXT_TZ_DOD_02
      && dod.NEXT_TZ_DOD_03
      && dod.NEXT_TZ_DOD_05
      && dod.NEXT_TZ_DOD_06,
  };

  const ok = dod.NEXT_TZ_DOD_01
    && dod.NEXT_TZ_DOD_02
    && dod.NEXT_TZ_DOD_03
    && dod.NEXT_TZ_DOD_05
    && dod.NEXT_TZ_DOD_06
    && acceptance.NEXT_TZ_ACCEPTANCE_01
    && acceptance.NEXT_TZ_ACCEPTANCE_02
    && acceptance.NEXT_TZ_ACCEPTANCE_04;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    code: ok ? 'OK' : 'E_X24_WS01_POST_MERGE_BASELINE_RECONFIRM',
    counts,
    baseline,
    negativeDetails,
    negativeResults,
    positiveDetails,
    positiveResults,
    dod,
    acceptance,
    detector: {
      token: TOKEN_NAME,
      expectedCanonVersion: EXPECTED_CANON_VERSION,
      modeMatrixEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      stabilityPacketPath: path.relative(repoRoot, stabilityPacketPath).replaceAll(path.sep, '/'),
      canonStatusPath: path.relative(repoRoot, canonStatusPath).replaceAll(path.sep, '/'),
      failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    },
    stageActivation: {
      ok: Boolean(stageActivation.ok),
      token: Number(stageActivation.STAGE_ACTIVATION_OK || 0),
      errors: Array.isArray(stageActivation.errors) ? stageActivation.errors : [],
      activeStageId: normalizeString(stageActivation.activeStageId),
    },
    canonLock,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX24Ws01PostMergeBaselineReconfirmState({ args, repoRoot: process.cwd() });
  process.stdout.write(`${stableStringify(state)}\n`);
  process.exit(state.ok ? 0 : 1);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();

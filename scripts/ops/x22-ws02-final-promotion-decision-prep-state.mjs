#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';

const TOKEN_NAME = 'X22_WS02_FINAL_PROMOTION_DECISION_PREP_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_PACKET_PATH = 'docs/OPS/STATUS/X22_FINAL_PROMOTION_DECISION_PACKET_v1.json';

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function normalizePacketDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const requiredGateVerdicts = Array.isArray(source.requiredGateVerdicts) ? source.requiredGateVerdicts : [];
  const requiredModeChecks = Array.isArray(source.requiredModeChecks) ? source.requiredModeChecks : [];
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    finalDecisionVersion: normalizeString(source.finalDecisionVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    expectedReleaseClassChanged: source.expectedReleaseClassChanged === true,
    defaultDecision: normalizeString(source.defaultDecision || 'GO').toUpperCase(),
    requiredDecisionInputs: toUniqueStrings(source.requiredDecisionInputs, { sort: false }),
    requiredEvidenceRefs: toUniqueStrings(source.requiredEvidenceRefs, { sort: false }),
    requiredGateVerdicts: requiredGateVerdicts
      .map((row) => ({
        gateId: normalizeString(row?.gateId),
        ref: normalizeString(row?.ref),
        expectedStatus: normalizeString(row?.expectedStatus),
        expectedToken: normalizeString(row?.expectedToken),
        expectedGateDecision: normalizeString(row?.expectedGateDecision),
        expectedGateOpen: row?.expectedGateOpen,
      }))
      .filter((row) => row.gateId && row.ref),
    requiredModeChecks: requiredModeChecks
      .map((row) => ({
        failSignalCode: normalizeString(row?.failSignalCode),
        mode: normalizeString(row?.mode).toLowerCase(),
        expectedDisposition: normalizeString(row?.expectedDisposition).toLowerCase(),
      }))
      .filter((row) => row.failSignalCode && row.mode && row.expectedDisposition),
  };
}

function resolveDecisionInputs({ repoRoot, requiredDecisionInputs }) {
  const docs = {};
  const missingDecisionInputs = [];
  const invalidDecisionInputs = [];

  for (const ref of requiredDecisionInputs) {
    const abs = path.resolve(repoRoot, ref);
    if (!fs.existsSync(abs)) {
      missingDecisionInputs.push({ ref, reason: 'MISSING_FINAL_DECISION_INPUT' });
      continue;
    }
    const doc = readJsonObject(abs);
    if (!isObjectRecord(doc)) {
      invalidDecisionInputs.push({ ref, reason: 'INVALID_FINAL_DECISION_INPUT' });
      continue;
    }
    docs[ref] = doc;
  }

  const issues = [...missingDecisionInputs, ...invalidDecisionInputs];
  return {
    ok: issues.length === 0,
    issues,
    missingDecisionInputs,
    invalidDecisionInputs,
    docs,
    requiredDecisionInputCount: requiredDecisionInputs.length,
    resolvedDecisionInputCount: Object.keys(docs).length,
  };
}

function validateGateVerdicts({ packetDoc, decisionInputs, overrideDocs }) {
  const gateVerdictConflicts = [];
  const failedRequiredGates = [];

  for (const gate of packetDoc.requiredGateVerdicts) {
    const baseDoc = overrideDocs && isObjectRecord(overrideDocs[gate.ref])
      ? overrideDocs[gate.ref]
      : decisionInputs.docs[gate.ref];

    if (!isObjectRecord(baseDoc)) {
      failedRequiredGates.push({ gateId: gate.gateId, ref: gate.ref, reason: 'GATE_INPUT_NOT_AVAILABLE' });
      continue;
    }

    const observedStatus = normalizeString(baseDoc.status);
    if (gate.expectedStatus && observedStatus !== gate.expectedStatus) {
      failedRequiredGates.push({
        gateId: gate.gateId,
        ref: gate.ref,
        expectedStatus: gate.expectedStatus,
        observedStatus,
        reason: 'FAILED_REQUIRED_GATE',
      });
    }

    if (gate.expectedToken) {
      const observedToken = normalizeString(baseDoc.token);
      if (observedToken !== gate.expectedToken) {
        gateVerdictConflicts.push({
          gateId: gate.gateId,
          ref: gate.ref,
          expectedToken: gate.expectedToken,
          observedToken,
          reason: 'CONFLICTING_GATE_VERDICT',
        });
      }
    }

    if (gate.expectedGateDecision) {
      const observedGateDecision = normalizeString(baseDoc.gateDecision);
      if (observedGateDecision !== gate.expectedGateDecision) {
        gateVerdictConflicts.push({
          gateId: gate.gateId,
          ref: gate.ref,
          expectedGateDecision: gate.expectedGateDecision,
          observedGateDecision,
          reason: 'CONFLICTING_GATE_VERDICT',
        });
      }
    }

    if (typeof gate.expectedGateOpen === 'boolean') {
      const observedGateOpen = baseDoc?.gate?.isOpen === true;
      if (observedGateOpen !== gate.expectedGateOpen) {
        gateVerdictConflicts.push({
          gateId: gate.gateId,
          ref: gate.ref,
          expectedGateOpen: gate.expectedGateOpen,
          observedGateOpen,
          reason: 'CONFLICTING_GATE_VERDICT',
        });
      }
    }
  }

  const issues = [...gateVerdictConflicts, ...failedRequiredGates];
  return {
    ok: issues.length === 0,
    issues,
    gateVerdictConflicts,
    failedRequiredGates,
    requiredGateVerdictCount: packetDoc.requiredGateVerdicts.length,
  };
}

function validateEvidenceLockChain({ repoRoot, packetDoc, x21SignedDoc }) {
  const missingEvidenceLinks = [];
  const chainEntries = [];

  for (const ref of packetDoc.requiredEvidenceRefs) {
    const abs = path.resolve(repoRoot, ref);
    if (!fs.existsSync(abs)) {
      missingEvidenceLinks.push({ ref, reason: 'EVIDENCE_CHAIN_LINK_MISSING' });
      continue;
    }
    chainEntries.push({ ref, sha256: fileSha256(abs) });
  }

  const signedEvidenceRef = normalizeString(x21SignedDoc?.evidencePacketRef);
  let evidenceHashMismatch = false;

  if (!signedEvidenceRef || !packetDoc.requiredEvidenceRefs.includes(signedEvidenceRef)) {
    missingEvidenceLinks.push({ ref: signedEvidenceRef || 'MISSING', reason: 'SIGNED_EVIDENCE_REF_NOT_IN_CHAIN' });
    evidenceHashMismatch = true;
  } else {
    const abs = path.resolve(repoRoot, signedEvidenceRef);
    if (!fs.existsSync(abs)) {
      missingEvidenceLinks.push({ ref: signedEvidenceRef, reason: 'SIGNED_EVIDENCE_REF_MISSING' });
      evidenceHashMismatch = true;
    } else {
      const observedSha = normalizeString(x21SignedDoc?.evidencePacketSha256).replace(/^sha256:/, '');
      const actualSha = fileSha256(abs);
      evidenceHashMismatch = observedSha !== actualSha;
    }
  }

  let previous = 'ROOT';
  const computedChain = chainEntries.map((entry) => {
    const chainHash = createHash('sha256').update(`${previous}|${entry.ref}|${entry.sha256}`).digest('hex');
    previous = chainHash;
    return { ...entry, chainHash };
  });
  const chainRootHash = computedChain.length > 0 ? computedChain[computedChain.length - 1].chainHash : '';

  const issues = [];
  if (missingEvidenceLinks.length > 0) issues.push(...missingEvidenceLinks);
  if (evidenceHashMismatch) issues.push({ reason: 'EVIDENCE_LOCK_CHAIN_BREAK' });

  return {
    ok: issues.length === 0,
    issues,
    requiredEvidenceRefCount: packetDoc.requiredEvidenceRefs.length,
    resolvedEvidenceRefCount: chainEntries.length,
    missingEvidenceLinks,
    evidenceHashMismatch,
    chainEntries: computedChain,
    chainRootHash,
  };
}

function parseFailSignalRegistry(doc) {
  const rows = Array.isArray(doc?.failSignals) ? doc.failSignals : [];
  const out = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;
    if (!out.has(code)) out.set(code, []);
    out.get(code).push(row);
  }
  return out;
}

function validateModeDispositions({ repoRoot, packetDoc, failsignalRegistryDoc }) {
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const modeDispositionDrift = [];
  const modeEvaluatorIssues = [];
  const missingModeChecks = [];

  for (const row of packetDoc.requiredModeChecks) {
    const failSignals = failSignalMap.get(row.failSignalCode) || [];
    if (failSignals.length === 0) {
      missingModeChecks.push({ ...row, reason: 'FAILSIGNAL_NOT_FOUND' });
      continue;
    }

    const first = failSignals[0];
    const modeKey = MODE_TO_KEY[row.mode] || '';
    const registryDisposition = normalizeString(first?.modeMatrix?.[modeKey]).toLowerCase();
    if (!MODE_DISPOSITIONS.has(registryDisposition) || registryDisposition !== row.expectedDisposition) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: registryDisposition || 'MISSING',
        reason: 'MODE_DISPOSITION_DRIFT',
      });
    }

    const verdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: row.mode,
      failSignalCode: row.failSignalCode,
    });
    if (!verdict.ok) {
      modeEvaluatorIssues.push({ ...row, reason: 'MODE_EVALUATOR_ERROR', issues: verdict.issues || [] });
      continue;
    }
    const expectedShouldBlock = row.expectedDisposition === 'blocking';
    if (Boolean(verdict.shouldBlock) !== expectedShouldBlock) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: normalizeString(verdict.modeDisposition),
        reason: 'MODE_EVALUATOR_DISPOSITION_DRIFT',
      });
    }
  }

  const issues = [...missingModeChecks, ...modeDispositionDrift, ...modeEvaluatorIssues];
  return {
    ok: issues.length === 0,
    issues,
    missingModeChecks,
    modeDispositionDrift,
    modeEvaluatorIssues,
  };
}

function evaluateGoNoGoPolicy({ packetDoc, gateVerdicts, evidenceLock, modeChecks, forceDecision }) {
  const issues = [];
  const requiredGatesPass = gateVerdicts.failedRequiredGates.length === 0 && gateVerdicts.gateVerdictConflicts.length === 0;
  const evidencePass = evidenceLock.ok;
  const modePass = modeChecks.ok;
  const requirementsPass = requiredGatesPass && evidencePass && modePass;

  const decision = normalizeString(forceDecision || packetDoc.defaultDecision || 'GO').toUpperCase();
  const recommendedDecision = requirementsPass ? 'GO' : 'NO_GO';

  if (decision === 'GO' && !requirementsPass) {
    issues.push({ reason: 'GO_DECISION_WITH_FAILED_REQUIRED_GATE' });
  }

  return {
    ok: issues.length === 0,
    issues,
    requiredGatesPass,
    evidencePass,
    modePass,
    recommendedDecision,
    decision,
  };
}

function evaluateDeterminism(evaluateFn) {
  const runA = evaluateFn();
  const runB = evaluateFn();
  const runC = evaluateFn();
  const hashA = createHash('sha256').update(stableStringify(runA)).digest('hex');
  const hashB = createHash('sha256').update(stableStringify(runB)).digest('hex');
  const hashC = createHash('sha256').update(stableStringify(runC)).digest('hex');
  return { ok: hashA === hashB && hashB === hashC, hashes: [hashA, hashB, hashC] };
}

function evaluateX22Ws02FinalPromotionDecisionPrepState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const packetRaw = isObjectRecord(input.packetDoc)
    ? input.packetDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_PACKET_PATH));

  const packetDoc = normalizePacketDoc(packetRaw);
  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const evaluateBaseline = ({ overridePacketDoc, overrideDecisionDocs, overrideSignedDoc, overrideDecision } = {}) => {
    const effectivePacketDoc = isObjectRecord(overridePacketDoc) ? overridePacketDoc : packetDoc;

    const decisionInputs = resolveDecisionInputs({
      repoRoot,
      requiredDecisionInputs: effectivePacketDoc.requiredDecisionInputs,
    });

    const signedRef = effectivePacketDoc.requiredGateVerdicts.find((row) => row.gateId === 'X21_CONTOUR_SIGNED')?.ref || '';
    const x21SignedDoc = isObjectRecord(overrideSignedDoc)
      ? overrideSignedDoc
      : (isObjectRecord(overrideDecisionDocs?.[signedRef])
        ? overrideDecisionDocs[signedRef]
        : decisionInputs.docs[signedRef]);

    const gateVerdicts = validateGateVerdicts({
      packetDoc: effectivePacketDoc,
      decisionInputs,
      overrideDocs: overrideDecisionDocs,
    });

    const evidenceLock = validateEvidenceLockChain({
      repoRoot,
      packetDoc: effectivePacketDoc,
      x21SignedDoc,
    });

    const modeChecks = validateModeDispositions({
      repoRoot,
      packetDoc: effectivePacketDoc,
      failsignalRegistryDoc,
    });

    const goNoGo = evaluateGoNoGoPolicy({
      packetDoc: effectivePacketDoc,
      gateVerdicts,
      evidenceLock,
      modeChecks,
      forceDecision: overrideDecision,
    });

    return {
      ok: decisionInputs.ok && gateVerdicts.ok && evidenceLock.ok && modeChecks.ok && goNoGo.ok,
      decisionInputs,
      gateVerdicts,
      evidenceLock,
      modeChecks,
      goNoGo,
    };
  };

  const baseline = evaluateBaseline({});
  const determinism = evaluateDeterminism(() => evaluateBaseline({}));

  const negative01Packet = deepClone(packetDoc);
  negative01Packet.requiredDecisionInputs = [
    ...negative01Packet.requiredDecisionInputs,
    'docs/OPS/STATUS/DOES_NOT_EXIST_FINAL_DECISION_INPUT.json',
  ];
  const negative01 = evaluateBaseline({ overridePacketDoc: negative01Packet });

  const negative02Docs = deepClone(baseline.decisionInputs.docs || {});
  const ws02Ref = packetDoc.requiredGateVerdicts.find((row) => row.gateId === 'X21_WS02')?.ref || '';
  if (isObjectRecord(negative02Docs[ws02Ref])) negative02Docs[ws02Ref].status = 'FAIL';
  const negative02 = evaluateBaseline({ overrideDecisionDocs: negative02Docs });

  const signedRef = packetDoc.requiredGateVerdicts.find((row) => row.gateId === 'X21_CONTOUR_SIGNED')?.ref || '';
  const negative03Signed = deepClone(baseline.decisionInputs.docs[signedRef] || {});
  negative03Signed.evidencePacketSha256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const negative03 = evaluateBaseline({ overrideSignedDoc: negative03Signed });

  const negative04Docs = deepClone(baseline.decisionInputs.docs || {});
  const ws01Ref = packetDoc.requiredGateVerdicts.find((row) => row.gateId === 'X21_WS01')?.ref || '';
  if (isObjectRecord(negative04Docs[ws01Ref])) negative04Docs[ws01Ref].status = 'FAIL';
  const negative04 = evaluateBaseline({ overrideDecisionDocs: negative04Docs, overrideDecision: 'GO' });

  let nonDeterministicRunIndex = 0;
  const negative05Determinism = evaluateDeterminism(() => {
    const result = evaluateBaseline({});
    nonDeterministicRunIndex += 1;
    if (nonDeterministicRunIndex === 2) {
      result.evidenceLock.chainRootHash = createHash('sha256')
        .update(`${result.evidenceLock.chainRootHash}:forced`)
        .digest('hex');
    }
    return result;
  });

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.decisionInputs.ok === false && negative01.decisionInputs.missingDecisionInputs.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.gateVerdicts.ok === false && negative02.gateVerdicts.issues.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.evidenceLock.ok === false && negative03.evidenceLock.issues.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.goNoGo.ok === false && negative04.goNoGo.issues.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05Determinism.ok === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.decisionInputs.ok && baseline.gateVerdicts.ok && baseline.evidenceLock.ok,
    NEXT_TZ_POSITIVE_02: baseline.gateVerdicts.failedRequiredGates.length === 0 && baseline.goNoGo.recommendedDecision === 'GO',
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: packetDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: baseline.modeChecks.modeDispositionDrift.length === 0,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivationGuardCheck,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const ok = baseline.ok
    && allNegativesPass
    && allPositivesPass
    && canonLock.ok
    && stageActivationGuardCheck
    && baseline.modeChecks.modeDispositionDrift.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    canonLock,
    stageActivation: {
      ...stageActivation,
      STAGE_ACTIVATION_GUARD_CHECK: stageActivationGuardCheck ? 1 : 0,
    },
    blockingSurfaceExpansion: packetDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      requiredDecisionInputCount: baseline.decisionInputs.requiredDecisionInputCount,
      missingDecisionInputCount: baseline.decisionInputs.missingDecisionInputs.length,
      invalidDecisionInputCount: baseline.decisionInputs.invalidDecisionInputs.length,
      requiredGateVerdictCount: baseline.gateVerdicts.requiredGateVerdictCount,
      gateVerdictConflictCount: baseline.gateVerdicts.gateVerdictConflicts.length,
      failedRequiredGateCount: baseline.gateVerdicts.failedRequiredGates.length,
      requiredEvidenceRefCount: baseline.evidenceLock.requiredEvidenceRefCount,
      evidenceChainBreakCount: (baseline.evidenceLock.missingEvidenceLinks.length > 0 || baseline.evidenceLock.evidenceHashMismatch) ? 1 : 0,
      goDecisionPolicyViolationCount: baseline.goNoGo.issues.length,
      advisoryToBlockingDriftCount: baseline.modeChecks.modeDispositionDrift.length,
      requiredModeCheckCount: packetDoc.requiredModeChecks.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    detector: {
      detectorId: 'X22_WS02_FINAL_PROMOTION_DECISION_PACKET_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        decisionInputsOk: baseline.decisionInputs.ok,
        gateVerdictsOk: baseline.gateVerdicts.ok,
        evidenceLockOk: baseline.evidenceLock.ok,
        goNoGoOk: baseline.goNoGo.ok,
        modeChecksOk: baseline.modeChecks.ok,
        chainRootHash: baseline.evidenceLock.chainRootHash,
      })).digest('hex'),
    },
    negativeDetails: {
      NEXT_TZ_NEGATIVE_01: negative01.decisionInputs,
      NEXT_TZ_NEGATIVE_02: negative02.gateVerdicts,
      NEXT_TZ_NEGATIVE_03: negative03.evidenceLock,
      NEXT_TZ_NEGATIVE_04: negative04.goNoGo,
      NEXT_TZ_NEGATIVE_05: { determinism: negative05Determinism },
    },
    sourceBinding: {
      packetDocPath: DEFAULT_PACKET_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX22Ws02FinalPromotionDecisionPrepState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
    process.exit(state.ok ? 0 : 1);
  }

  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CANON_LOCK_CHECK=${state.canonLock.ok ? 'PASS' : 'FAIL'}`);
  console.log(`STAGE_ACTIVATION_GUARD_CHECK=${state.stageActivation.STAGE_ACTIVATION_GUARD_CHECK === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`MISSING_DECISION_INPUT_COUNT=${state.counts.missingDecisionInputCount}`);
  console.log(`GATE_VERDICT_CONFLICT_COUNT=${state.counts.gateVerdictConflictCount}`);
  console.log(`EVIDENCE_CHAIN_BREAK_COUNT=${state.counts.evidenceChainBreakCount}`);
  console.log(`GO_DECISION_POLICY_VIOLATION_COUNT=${state.counts.goDecisionPolicyViolationCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX22Ws02FinalPromotionDecisionPrepState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}

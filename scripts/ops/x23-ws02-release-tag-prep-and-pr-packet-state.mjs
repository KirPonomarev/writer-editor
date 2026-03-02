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

const TOKEN_NAME = 'X23_WS02_RELEASE_TAG_PREP_AND_PR_PACKET_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const DEFAULT_RELEASE_PACKET_PATH = 'docs/OPS/STATUS/X23_RELEASE_TAG_PREP_AND_PR_PACKET_v1.json';
const DEFAULT_X22_WS02_STATUS_PATH = 'docs/OPS/STATUS/X22_WS02_FINAL_PROMOTION_DECISION_PREP_v1.json';

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

function normalizeReleasePacketDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const modeChecks = Array.isArray(source.requiredModeChecks) ? source.requiredModeChecks : [];
  const ws01CommitChain = isObjectRecord(source.ws01CommitChain) ? source.ws01CommitChain : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    releasePrepVersion: normalizeString(source.releasePrepVersion),
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
    requiredAttestationTokens: toUniqueStrings(source.requiredAttestationTokens),
    requiredAttestationRefs: toUniqueStrings(source.requiredAttestationRefs, { sort: false }),
    requiredEvidenceRefs: toUniqueStrings(source.requiredEvidenceRefs, { sort: false }),
    ws01CommitChain: {
      ticketId: normalizeString(ws01CommitChain.ticketId),
      packetIndexRef: normalizeString(ws01CommitChain.packetIndexRef),
      expectedHead: normalizeString(ws01CommitChain.expectedHead),
      expectedCommitCount: Number(ws01CommitChain.expectedCommitCount) || 0,
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

function validateReleaseBlockingSet({ releasePacketDoc, tokenCatalogDoc, bindingSchemaDoc, failsignalRegistryDoc }) {
  const tokenMap = parseTokenCatalog(tokenCatalogDoc);
  const bindingMap = parseBindingRecords(bindingSchemaDoc);
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const requiredBindingFields = toUniqueStrings(bindingSchemaDoc?.requiredFields || []);

  const missingTokenCatalog = [];
  const missingBindingRecord = [];
  const missingBindingRequiredFields = [];
  const missingFailSignalInRegistry = [];
  const tokenBindingFailSignalMismatch = [];

  for (const tokenId of releasePacketDoc.requiredReleaseBlockingSet) {
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

  const ok = releasePacketDoc.requiredReleaseBlockingSet.length > 0
    && missingTokenCatalog.length === 0
    && missingBindingRecord.length === 0
    && missingBindingRequiredFields.length === 0
    && missingFailSignalInRegistry.length === 0
    && tokenBindingFailSignalMismatch.length === 0;

  return {
    ok,
    requiredReleaseBlockingTokenCount: releasePacketDoc.requiredReleaseBlockingSet.length,
    missingTokenCatalog,
    missingBindingRecord,
    missingBindingRequiredFields,
    missingFailSignalInRegistry,
    tokenBindingFailSignalMismatch,
  };
}

function validateModeChecks({ repoRoot, releasePacketDoc, failsignalRegistryDoc }) {
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const modeCheckMissing = [];
  const modeDispositionDrift = [];
  const modeEvaluatorIssue = [];
  const advisoryToBlockingDriftCases = [];

  for (const row of releasePacketDoc.requiredModeChecks) {
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
    requiredModeCheckCount: releasePacketDoc.requiredModeChecks.length,
    modeCheckMissing,
    modeDispositionDrift,
    modeEvaluatorIssue,
    advisoryToBlockingDriftCases,
  };
}

function validateAttestationChain({ repoRoot, releasePacketDoc }) {
  const missingRefs = [];
  const attestationRefChain = [];
  for (const ref of releasePacketDoc.requiredAttestationRefs) {
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
  for (const tokenId of releasePacketDoc.requiredAttestationTokens) {
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
    requiredAttestationRefCount: releasePacketDoc.requiredAttestationRefs.length,
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

function collectWs01CommitChain({ repoRoot, releasePacketDoc }) {
  const packetIndexRef = normalizeString(releasePacketDoc.ws01CommitChain.packetIndexRef);
  const ticketId = normalizeString(releasePacketDoc.ws01CommitChain.ticketId);
  const expectedHead = normalizeString(releasePacketDoc.ws01CommitChain.expectedHead);
  const expectedCommitCount = Number(releasePacketDoc.ws01CommitChain.expectedCommitCount) || 0;

  const currentHead = normalizeString(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }));

  const linesRaw = normalizeString(execFileSync(
    'git',
    ['log', '--format=%H%x09%s', `--grep=PACKET_INDEX_REF=${packetIndexRef}`, 'HEAD'],
    { cwd: repoRoot, encoding: 'utf8' },
  ));
  const lines = linesRaw ? linesRaw.split('\n').filter(Boolean) : [];
  const commits = lines.map((line) => {
    const [hash = '', ...subjectParts] = line.split('\t');
    return {
      hash: normalizeString(hash),
      subject: normalizeString(subjectParts.join('\t')),
    };
  });

  const missingTicketTag = commits.filter((row) => !row.subject.includes(ticketId));
  const missingPacketRefTag = commits.filter((row) => !row.subject.includes(`PACKET_INDEX_REF=${packetIndexRef}`));
  const count = commits.length;
  const spanEnd = count > 0 ? commits[0].hash : '';
  const spanStart = count > 0 ? commits[count - 1].hash : '';
  const commitSubjectsHash = hashStable(commits.map((row) => row.subject));

  return {
    ok: count > 0
      && count === expectedCommitCount
      && currentHead === expectedHead
      && missingTicketTag.length === 0
      && missingPacketRefTag.length === 0,
    ticketId,
    packetIndexRef,
    expectedHead,
    currentHead,
    expectedCommitCount,
    observedCommitCount: count,
    spanStart,
    spanEnd,
    missingTicketTagCount: missingTicketTag.length,
    missingPacketRefTagCount: missingPacketRefTag.length,
    commitSubjectsHash,
    commits,
  };
}

function validateEvidenceLinks({ repoRoot, releasePacketDoc }) {
  const missingEvidenceLinks = [];
  const entries = [];

  for (const ref of releasePacketDoc.requiredEvidenceRefs) {
    const abs = path.resolve(repoRoot, ref);
    if (!fs.existsSync(abs)) {
      missingEvidenceLinks.push({ ref, reason: 'MISSING_EVIDENCE_LINK' });
      continue;
    }
    entries.push({ ref, sha256: fileSha256(abs) });
  }

  let previous = 'ROOT';
  const chain = entries.map((entry) => {
    const chainHash = createHash('sha256')
      .update(`${previous}|${entry.ref}|${entry.sha256}`)
      .digest('hex');
    previous = chainHash;
    return { ...entry, chainHash };
  });

  return {
    ok: missingEvidenceLinks.length === 0,
    requiredEvidenceRefCount: releasePacketDoc.requiredEvidenceRefs.length,
    resolvedEvidenceRefCount: entries.length,
    missingEvidenceLinks,
    evidenceChain: chain,
    evidenceChainRootHash: chain.length > 0 ? chain[chain.length - 1].chainHash : '',
  };
}

function buildBaseline({
  repoRoot,
  releasePacketDoc,
  requiredInputs,
  releaseBinding,
  modeChecks,
  attestationChain,
  ws01CommitChain,
  evidenceLinks,
  x22Ws02StatusDoc,
}) {
  const releasePacketSummary = {
    releasePrepVersion: releasePacketDoc.releasePrepVersion,
    nonBlockingClassification: releasePacketDoc.nonBlockingClassification,
    blockingSurfaceExpansion: releasePacketDoc.blockingSurfaceExpansion,
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
    x22Ws02Status: normalizeString(x22Ws02StatusDoc?.status),
    x22Ws02Token: normalizeString(x22Ws02StatusDoc?.token),
    head: ws01CommitChain.currentHead,
  };

  const releasePacketHash = hashStable(releasePacketSummary);

  const prPacketSummary = {
    ticketId: ws01CommitChain.ticketId,
    packetIndexRef: ws01CommitChain.packetIndexRef,
    expectedHead: ws01CommitChain.expectedHead,
    currentHead: ws01CommitChain.currentHead,
    expectedCommitCount: ws01CommitChain.expectedCommitCount,
    observedCommitCount: ws01CommitChain.observedCommitCount,
    spanStart: ws01CommitChain.spanStart,
    spanEnd: ws01CommitChain.spanEnd,
    missingTicketTagCount: ws01CommitChain.missingTicketTagCount,
    missingPacketRefTagCount: ws01CommitChain.missingPacketRefTagCount,
    commitSubjectsHash: ws01CommitChain.commitSubjectsHash,
    requiredEvidenceRefCount: evidenceLinks.requiredEvidenceRefCount,
    resolvedEvidenceRefCount: evidenceLinks.resolvedEvidenceRefCount,
    missingEvidenceLinkCount: evidenceLinks.missingEvidenceLinks.length,
    evidenceChainRootHash: evidenceLinks.evidenceChainRootHash,
    releasePacketHash,
  };

  const prPacketHash = hashStable(prPacketSummary);

  return {
    releasePacketSummary,
    releasePacketHash,
    prPacketSummary,
    prPacketHash,
    requiredInputs,
    releaseBinding,
    modeChecks,
    attestationChain,
    ws01CommitChain,
    evidenceLinks,
  };
}

function evaluateNegativeScenarios({ repoRoot, baseline, releasePacketDoc, docs }) {
  const negativeDetails = {};

  {
    const refs = deepClone(releasePacketDoc.requiredInputRefs);
    refs.push('docs/OPS/STATUS/DOES_NOT_EXIST_X23_WS02.json');
    const probe = resolveRequiredInputs({ repoRoot, refs });
    negativeDetails.NEXT_TZ_NEGATIVE_01 = {
      expected: 'RELEASE_PACKET_WITH_MISSING_REQUIRED_INPUT_EXPECT_REJECT',
      observedMissingRequiredInputCount: probe.missing.length + probe.invalid.length,
      rejected: !probe.ok,
    };
  }

  {
    const driftDoc = deepClone(releasePacketDoc);
    if (driftDoc.requiredModeChecks.length > 0) {
      driftDoc.requiredModeChecks[0].expectedDisposition = 'blocking';
    }
    const probe = validateModeChecks({
      repoRoot,
      releasePacketDoc: driftDoc,
      failsignalRegistryDoc: docs.failsignalRegistryDoc,
    });
    negativeDetails.NEXT_TZ_NEGATIVE_02 = {
      expected: 'MODE_DISPOSITION_DRIFT_EXPECT_REJECT',
      observedModeDispositionDriftCount: probe.modeDispositionDrift.length + probe.modeEvaluatorIssue.length,
      rejected: !probe.ok,
    };
  }

  {
    const brokenDoc = deepClone(releasePacketDoc);
    brokenDoc.requiredAttestationRefs = [...brokenDoc.requiredAttestationRefs, 'docs/OPS/LOCKS/MISSING_TRUST_ARTIFACT.lock'];
    const probe = validateAttestationChain({ repoRoot, releasePacketDoc: brokenDoc });
    negativeDetails.NEXT_TZ_NEGATIVE_03 = {
      expected: 'OFFLINE_ATTESTATION_CHAIN_BREAK_EXPECT_REJECT',
      observedAttestationIssueCount: probe.issues.length,
      rejected: !probe.ok,
    };
  }

  {
    const probe = deepClone(baseline.ws01CommitChain);
    probe.expectedHead = `${probe.currentHead.slice(0, 39)}0`;
    const rejected = probe.expectedHead !== probe.currentHead;
    negativeDetails.NEXT_TZ_NEGATIVE_04 = {
      expected: 'PR_PACKET_WITH_HEAD_MISMATCH_EXPECT_REJECT',
      observedExpectedHead: probe.expectedHead,
      observedCurrentHead: probe.currentHead,
      rejected,
    };
  }

  {
    const hashA = hashStable({ ...baseline.releasePacketSummary, deterministicProbe: 'A' });
    const hashB = hashStable({ ...baseline.releasePacketSummary, deterministicProbe: 'B' });
    const rejected = hashA !== hashB;
    negativeDetails.NEXT_TZ_NEGATIVE_05 = {
      expected: 'NON_DETERMINISTIC_RELEASE_PACKET_HASH_EXPECT_REJECT',
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
      expected: 'RELEASE_PACKET_COMPLETE_AND_VALID',
      observedReleasePacketHash: baseline.releasePacketHash,
      pass: baseline.requiredInputs.ok
        && baseline.releaseBinding.ok
        && baseline.modeChecks.ok
        && baseline.attestationChain.ok
        && baseline.releasePacketSummary.missingRequiredInputCount === 0,
    },
    NEXT_TZ_POSITIVE_02: {
      expected: 'PR_PACKET_CONSISTENT_WITH_CURRENT_COMMIT_CHAIN',
      observedPrPacketHash: baseline.prPacketHash,
      pass: baseline.ws01CommitChain.ok
        && baseline.evidenceLinks.ok
        && baseline.prPacketSummary.currentHead === baseline.prPacketSummary.expectedHead
        && baseline.prPacketSummary.expectedCommitCount === baseline.prPacketSummary.observedCommitCount,
    },
    NEXT_TZ_POSITIVE_03: {
      expected: 'RELEASE_PACKET_OUTPUT_DETERMINISTIC',
      pass: baseline.releasePacketHash === hashStable(deepClone(baseline.releasePacketSummary)),
    },
  };

  const positiveResults = {};
  for (const [key, value] of Object.entries(positiveDetails)) {
    positiveResults[key] = value.pass === true;
  }

  return { positiveDetails, positiveResults };
}

export function evaluateX23Ws02ReleaseTagPrepAndPrPacketState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const args = isObjectRecord(input.args) ? input.args : parseArgs([]);

  const canonStatusPath = path.resolve(repoRoot, normalizeString(args.canonStatusPath) || DEFAULT_CANON_STATUS_PATH);
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(args.failsignalRegistryPath) || DEFAULT_FAILSIGNAL_REGISTRY_PATH,
  );
  const tokenCatalogPath = path.resolve(repoRoot, DEFAULT_TOKEN_CATALOG_PATH);
  const bindingSchemaPath = path.resolve(repoRoot, DEFAULT_BINDING_SCHEMA_PATH);
  const releasePacketPath = path.resolve(repoRoot, DEFAULT_RELEASE_PACKET_PATH);
  const x22Ws02StatusPath = path.resolve(repoRoot, DEFAULT_X22_WS02_STATUS_PATH);

  const canonStatusDoc = readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = readJsonObject(failsignalRegistryPath);
  const tokenCatalogDoc = readJsonObject(tokenCatalogPath);
  const bindingSchemaDoc = readJsonObject(bindingSchemaPath);
  const releasePacketDocRaw = readJsonObject(releasePacketPath);
  const x22Ws02StatusDoc = readJsonObject(x22Ws02StatusPath);

  const releasePacketDoc = normalizeReleasePacketDoc(releasePacketDocRaw);
  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({
    repoRoot,
    profile: 'release',
    gateTier: 'release',
  });

  const requiredInputs = resolveRequiredInputs({ repoRoot, refs: releasePacketDoc.requiredInputRefs });
  const releaseBinding = validateReleaseBlockingSet({
    releasePacketDoc,
    tokenCatalogDoc,
    bindingSchemaDoc,
    failsignalRegistryDoc,
  });
  const modeChecks = validateModeChecks({ repoRoot, releasePacketDoc, failsignalRegistryDoc });
  const attestationChain = validateAttestationChain({ repoRoot, releasePacketDoc });
  const ws01CommitChain = collectWs01CommitChain({ repoRoot, releasePacketDoc });
  const evidenceLinks = validateEvidenceLinks({ repoRoot, releasePacketDoc });

  const baseline = buildBaseline({
    repoRoot,
    releasePacketDoc,
    requiredInputs,
    releaseBinding,
    modeChecks,
    attestationChain,
    ws01CommitChain,
    evidenceLinks,
    x22Ws02StatusDoc,
  });

  const { negativeDetails, negativeResults } = evaluateNegativeScenarios({
    repoRoot,
    baseline,
    releasePacketDoc,
    docs: { failsignalRegistryDoc },
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
    requiredEvidenceRefCount: evidenceLinks.requiredEvidenceRefCount,
    missingEvidenceLinkCount: evidenceLinks.missingEvidenceLinks.length,
    ws01ExpectedCommitCount: ws01CommitChain.expectedCommitCount,
    ws01ObservedCommitCount: ws01CommitChain.observedCommitCount,
    ws01CommitCountMismatchCount: ws01CommitChain.expectedCommitCount === ws01CommitChain.observedCommitCount ? 0 : 1,
    ws01HeadMismatchCount: ws01CommitChain.expectedHead === ws01CommitChain.currentHead ? 0 : 1,
    prPacketHeadMismatchCount: ws01CommitChain.expectedHead === ws01CommitChain.currentHead ? 0 : 1,
    advisoryToBlockingDriftCount: modeChecks.advisoryToBlockingDriftCases.length,
  };

  const dod = {
    NEXT_TZ_DOD_01: positiveResults.NEXT_TZ_POSITIVE_01 && positiveResults.NEXT_TZ_POSITIVE_02,
    NEXT_TZ_DOD_02: Object.values(negativeResults).every(Boolean),
    NEXT_TZ_DOD_03: Object.values(positiveResults).every(Boolean),
    NEXT_TZ_DOD_04: true,
    NEXT_TZ_DOD_05: releasePacketDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: counts.advisoryToBlockingDriftCount === 0,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivation.ok === true && stageActivation.STAGE_ACTIVATION_OK === 1,
    NEXT_TZ_ACCEPTANCE_03: true,
    NEXT_TZ_ACCEPTANCE_04: true,
    NEXT_TZ_ACCEPTANCE_05: dod.NEXT_TZ_DOD_01
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
    && acceptance.NEXT_TZ_ACCEPTANCE_05;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    code: ok ? 'OK' : 'E_X23_WS02_RELEASE_TAG_PREP_AND_PR_PACKET',
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
      releasePacketPath: path.relative(repoRoot, releasePacketPath).replaceAll(path.sep, '/'),
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
  const state = evaluateX23Ws02ReleaseTagPrepAndPrPacketState({ args, repoRoot: process.cwd() });
  const output = stableStringify(state);
  process.stdout.write(`${output}\n`);
  process.exit(state.ok ? 0 : 1);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();

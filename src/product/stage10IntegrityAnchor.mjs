import { hashCanonicalValue } from '../core/browser-safe-hash.mjs';

export const STAGE10_INTEGRITY_ANCHOR_SCHEMA = 'yalken.stage10.mainIntegrityAnchor.v1';
export const STAGE10_INTEGRITY_ANCHOR_VERSION = 1;
export const STAGE10_RECOVERED_ANCHOR_SCHEMA = 'yalken.stage10.mainIntegrityAnchor.v2';
export const STAGE10_LOCAL_INTEGRITY_THREAT_MODEL = Object.freeze({
  schemaVersion: 'yalken.stage10.localIntegrityThreatModel.v1',
  protectsAgainst: Object.freeze([
    'mutable-session-authority-pair-rollback',
    'coherent-session-authority-rebuild-with-canonical-anchor-preserved',
    'partial-or-interrupted-local-transaction-write',
  ]),
  doesNotClaimProtectionAgainst: Object.freeze([
    'malicious-rewrite-of-main-owned-anchor-and-recovery-chain',
    'operating-system-or-storage-admin-compromise',
    'physical-device-compromise',
  ]),
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(normalizeString(value));
}

function typedError(code, reason, details) {
  const error = { code, op: 'stage10.mainIntegrityAnchor', reason };
  if (isPlainObject(details)) error.details = cloneJson(details);
  return error;
}

export function stage10SessionDigest(session) {
  return hashCanonicalValue(session);
}

export function stage10AuthorityStoreDigest(authorityStore) {
  return hashCanonicalValue(authorityStore);
}

export function stage10IntegrityAnchorDigest(anchorCore) {
  return hashCanonicalValue({
    schemaVersion: anchorCore.schemaVersion,
    anchorVersion: anchorCore.anchorVersion,
    projectId: anchorCore.projectId,
    authorityGeneration: anchorCore.authorityGeneration,
    receiptCount: anchorCore.receiptCount,
    receiptRootDigest: anchorCore.receiptRootDigest,
    eventLogDigest: anchorCore.eventLogDigest,
    authorityHeadDigest: anchorCore.authorityHeadDigest,
    authorityStoreDigest: anchorCore.authorityStoreDigest,
    sessionDigest: anchorCore.sessionDigest,
    previousIntegrityAnchorDigest: normalizeString(anchorCore.previousIntegrityAnchorDigest),
    ...(anchorCore.anchorVersion === 2 ? { recoveryRoot: anchorCore.recoveryRoot } : {}),
  });
}

export function createStage10IntegrityAnchor({
  projectId,
  session,
  authorityStore,
  previousAnchor = null,
  recoveryRoot = previousAnchor?.recoveryRoot || null,
}) {
  const head = authorityStore?.currentHead;
  const normalizedProjectId = normalizeString(projectId);
  if (!normalizedProjectId || !isPlainObject(session) || !isPlainObject(authorityStore) || !isPlainObject(head)) {
    throw typedError('E_STAGE10_INTEGRITY_ANCHOR_INPUT_INVALID', 'INTEGRITY_ANCHOR_INPUT_REQUIRED');
  }
  const generation = Number(head.authorityGeneration);
  const previousDigest = isPlainObject(previousAnchor) ? normalizeString(previousAnchor.integrityAnchorDigest) : '';
  if (!Number.isSafeInteger(generation) || generation < 0
    || (generation > 0 && !isSha256(previousDigest) && !recoveryRoot)) {
    throw typedError('E_STAGE10_INTEGRITY_ANCHOR_GENERATION_INVALID', 'INTEGRITY_ANCHOR_MONOTONIC_GENERATION_REQUIRED');
  }
  const core = {
    schemaVersion: recoveryRoot ? STAGE10_RECOVERED_ANCHOR_SCHEMA : STAGE10_INTEGRITY_ANCHOR_SCHEMA,
    anchorVersion: recoveryRoot ? 2 : STAGE10_INTEGRITY_ANCHOR_VERSION,
    projectId: normalizedProjectId,
    authorityGeneration: generation,
    receiptCount: Number(head.receiptCount),
    receiptRootDigest: normalizeString(head.receiptRootDigest),
    eventLogDigest: normalizeString(head.eventLogDigest),
    authorityHeadDigest: normalizeString(head.authorityHeadDigest),
    authorityStoreDigest: stage10AuthorityStoreDigest(authorityStore),
    sessionDigest: stage10SessionDigest(session),
    previousIntegrityAnchorDigest: previousDigest,
    ...(recoveryRoot ? { recoveryRoot: cloneJson(recoveryRoot) } : {}),
  };
  return deepFreeze({
    ...core,
    integrityAnchorDigest: stage10IntegrityAnchorDigest(core),
  });
}

function validRecoveryRoot(root) {
  const fields = ['schemaVersion','trustBasis','recoveryId','createdAtUtc','authorityGeneration',
    'authorityHeadDigest','sessionDigest','authorityStoreDigest','rawSessionDigest',
    'rawAuthorityStoreDigest','projectRootDigest','projectSnapshotDigest'];
  return isPlainObject(root) && Object.keys(root).length === fields.length
    && fields.every(key => Object.hasOwn(root,key))
    && root.schemaVersion === 'yalken.stage10.recoveryRoot.v1'
    && root.trustBasis === 'EXPLICIT_LOCAL_OWNER_REVALIDATION'
    && /^[a-f0-9-]{36}$/u.test(root.recoveryId)
    && typeof root.createdAtUtc === 'string' && Number.isFinite(Date.parse(root.createdAtUtc))
    && Number.isSafeInteger(root.authorityGeneration) && root.authorityGeneration > 0
    && fields.filter(key => key.endsWith('Digest')).every(key => isSha256(root[key]));
}

export function validateStage10IntegrityAnchor(anchorInput, {
  projectId,
  session,
  authorityStore,
  previousAnchor = null,
} = {}) {
  if (!isPlainObject(anchorInput)) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_MISSING', 'INTEGRITY_ANCHOR_REQUIRED') };
  }
  const anchor = cloneJson(anchorInput);
  const recovered = anchor.schemaVersion === STAGE10_RECOVERED_ANCHOR_SCHEMA && anchor.anchorVersion === 2;
  if (
    !recovered && (anchor.schemaVersion !== STAGE10_INTEGRITY_ANCHOR_SCHEMA
    || anchor.anchorVersion !== STAGE10_INTEGRITY_ANCHOR_VERSION)
  ) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_VERSION_INVALID', 'INTEGRITY_ANCHOR_VERSION_INVALID') };
  }
  if ((recovered && (!validRecoveryRoot(anchor.recoveryRoot)
      || anchor.authorityGeneration < anchor.recoveryRoot.authorityGeneration))
    || (!recovered && Object.hasOwn(anchor,'recoveryRoot'))) {
    return { ok: false, error: typedError('E_STAGE10_RECOVERY_ROOT_INVALID', 'RECOVERY_ROOT_PROVENANCE_INVALID') };
  }
  if (normalizeString(anchor.projectId) !== normalizeString(projectId)) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_PROJECT_MISMATCH', 'INTEGRITY_ANCHOR_PROJECT_MISMATCH') };
  }
  const head = authorityStore?.currentHead;
  if (!isPlainObject(session) || !isPlainObject(authorityStore) || !isPlainObject(head)) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_PAIR_MISSING', 'INTEGRITY_ANCHOR_PAIR_REQUIRED') };
  }
  if (
    anchor.authorityGeneration !== head.authorityGeneration
    || anchor.receiptCount !== head.receiptCount
    || normalizeString(anchor.receiptRootDigest) !== normalizeString(head.receiptRootDigest)
    || normalizeString(anchor.eventLogDigest) !== normalizeString(head.eventLogDigest)
    || normalizeString(anchor.authorityHeadDigest) !== normalizeString(head.authorityHeadDigest)
  ) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_STALE', 'INTEGRITY_ANCHOR_STALE_OR_ROLLED_BACK') };
  }
  if (normalizeString(anchor.authorityStoreDigest) !== stage10AuthorityStoreDigest(authorityStore)) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_AUTHORITY_MISMATCH', 'INTEGRITY_ANCHOR_AUTHORITY_STORE_MISMATCH') };
  }
  if (normalizeString(anchor.sessionDigest) !== stage10SessionDigest(session)) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_SESSION_MISMATCH', 'INTEGRITY_ANCHOR_SESSION_MISMATCH') };
  }
  const expectedDigest = stage10IntegrityAnchorDigest(anchor);
  if (!isSha256(anchor.integrityAnchorDigest) || normalizeString(anchor.integrityAnchorDigest) !== expectedDigest) {
    return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_DIGEST_INVALID', 'INTEGRITY_ANCHOR_DIGEST_INVALID') };
  }
  const atRecoveryRoot = recovered && anchor.authorityGeneration === anchor.recoveryRoot.authorityGeneration;
  if (atRecoveryRoot && (previousAnchor !== null
    || anchor.sessionDigest !== anchor.recoveryRoot.sessionDigest
    || anchor.authorityStoreDigest !== anchor.recoveryRoot.authorityStoreDigest
    || anchor.authorityHeadDigest !== anchor.recoveryRoot.authorityHeadDigest)) {
    return { ok: false, error: typedError('E_STAGE10_RECOVERY_ROOT_INVALID', 'RECOVERY_ROOT_BINDING_INVALID') };
  }
  if (anchor.authorityGeneration === 0 || atRecoveryRoot) {
    if (normalizeString(anchor.previousIntegrityAnchorDigest)) {
      return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_FORKED', 'INTEGRITY_ANCHOR_PREVIOUS_DIGEST_FORKED') };
    }
  } else {
    if (!isPlainObject(previousAnchor)) {
      return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_PREVIOUS_MISSING', 'INTEGRITY_ANCHOR_PREVIOUS_REQUIRED') };
    }
    if (
      previousAnchor.schemaVersion !== anchor.schemaVersion
      || previousAnchor.anchorVersion !== anchor.anchorVersion
      || (recovered && (!validRecoveryRoot(previousAnchor.recoveryRoot)
        || hashCanonicalValue(previousAnchor.recoveryRoot) !== hashCanonicalValue(anchor.recoveryRoot)))
      || normalizeString(previousAnchor.projectId) !== normalizeString(projectId)
      || previousAnchor.authorityGeneration !== anchor.authorityGeneration - 1
      || normalizeString(previousAnchor.integrityAnchorDigest) !== normalizeString(anchor.previousIntegrityAnchorDigest)
      || stage10IntegrityAnchorDigest(previousAnchor) !== normalizeString(previousAnchor.integrityAnchorDigest)
    ) {
      return { ok: false, error: typedError('E_STAGE10_INTEGRITY_ANCHOR_FORKED', 'INTEGRITY_ANCHOR_PREVIOUS_DIGEST_FORKED') };
    }
  }
  return { ok: true, anchor: deepFreeze(anchor) };
}

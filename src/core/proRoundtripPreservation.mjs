export const PRO_ROUNDTRIP_INVALIDATION_SCHEMA_VERSION = 'pro-data-invalidation.v1';

const DEPENDENCY_KEYS = new Set([
  'sceneId',
  'sceneIds',
  'sourceSceneId',
  'targetSceneId',
  'dependsOnSceneId',
  'dependsOnSceneIds',
  'dependencySceneId',
  'dependencySceneIds',
]);

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonTree(value) {
  if (Array.isArray(value)) return value.map(cloneJsonTree);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneJsonTree(entry)]));
  }
  return value;
}

function normalizeSceneIds(input) {
  const source = Array.isArray(input) ? input : [input];
  return [...new Set(
    source
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )].sort();
}

function collectDirectSceneReferences(record) {
  const references = [];
  for (const [key, value] of Object.entries(record)) {
    if (!DEPENDENCY_KEYS.has(key)) continue;
    if (typeof value === 'string') {
      references.push(value);
    } else if (Array.isArray(value)) {
      references.push(...value.filter((entry) => typeof entry === 'string'));
    }
  }
  return normalizeSceneIds(references);
}

function markDependentRecords(value, changedSceneIdSet, reason) {
  if (Array.isArray(value)) {
    return value.map((entry) => markDependentRecords(entry, changedSceneIdSet, reason));
  }
  if (!isPlainObject(value)) return value;

  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = markDependentRecords(entry, changedSceneIdSet, reason);
  }

  const referencedSceneIds = collectDirectSceneReferences(value);
  const staleSceneIds = referencedSceneIds.filter((sceneId) => changedSceneIdSet.has(sceneId));
  if (staleSceneIds.length === 0) return next;

  return {
    ...next,
    stale: true,
    staleReason: reason,
    staleSceneIds,
    requiresProRefresh: true,
  };
}

function mergeSceneTombstones(existingTombstones, deletedSceneIds, nowIso) {
  const existing = Array.isArray(existingTombstones) ? existingTombstones.map(cloneJsonTree) : [];
  const seen = new Set(
    existing
      .map((entry) => (isPlainObject(entry) && typeof entry.sceneId === 'string' ? entry.sceneId.trim() : ''))
      .filter(Boolean),
  );
  for (const sceneId of deletedSceneIds) {
    if (seen.has(sceneId)) continue;
    existing.push({
      sceneId,
      recoverable: true,
      reason: 'FREE_SCENE_DELETED',
      createdAtUtc: nowIso,
    });
    seen.add(sceneId);
  }
  return existing;
}

export function applyFreeEditProDataInvalidation(manifest, options = {}) {
  const source = isPlainObject(manifest) ? manifest : {};
  const changedSceneIds = normalizeSceneIds(options.changedSceneIds);
  const deletedSceneIds = normalizeSceneIds(options.deletedSceneIds);
  const nowIso = typeof options.nowIso === 'string' && options.nowIso.trim()
    ? options.nowIso.trim()
    : new Date().toISOString();
  const staleReason = typeof options.staleReason === 'string' && options.staleReason.trim()
    ? options.staleReason.trim()
    : 'FREE_SCENE_TEXT_CHANGED';

  const changedSceneIdSet = new Set(changedSceneIds);
  const nextManifest = markDependentRecords(cloneJsonTree(source), changedSceneIdSet, staleReason);
  const existingInvalidation = isPlainObject(nextManifest.proDataInvalidation)
    ? nextManifest.proDataInvalidation
    : {};
  const previousChanged = normalizeSceneIds(existingInvalidation.changedSceneIds);
  const previousDeleted = normalizeSceneIds(existingInvalidation.deletedSceneIds);

  nextManifest.proDataInvalidation = {
    ...existingInvalidation,
    schemaVersion: PRO_ROUNDTRIP_INVALIDATION_SCHEMA_VERSION,
    reason: 'FREE_EDIT_REQUIRES_PRO_REFRESH',
    changedSceneIds: normalizeSceneIds([...previousChanged, ...changedSceneIds]),
    deletedSceneIds: normalizeSceneIds([...previousDeleted, ...deletedSceneIds]),
    sceneTombstones: mergeSceneTombstones(existingInvalidation.sceneTombstones, deletedSceneIds, nowIso),
    updatedAtUtc: nowIso,
  };

  return Object.freeze({
    ok: true,
    manifest: nextManifest,
    receipt: Object.freeze({
      schemaVersion: PRO_ROUNDTRIP_INVALIDATION_SCHEMA_VERSION,
      changedSceneIds,
      deletedSceneIds,
      staleReason,
      projectFormatShared: true,
      unknownFieldsPreserved: true,
      recomputedProAnalytics: false,
    }),
  });
}

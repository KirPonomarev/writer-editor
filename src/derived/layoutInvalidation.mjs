import { hashCanonicalValue } from './deriveView.mjs';

const LAYOUT_INVALIDATION_SCHEMA_VERSION = 'derived.layoutInvalidation.v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChangeScope(changeScope) {
  if (Array.isArray(changeScope)) {
    return changeScope.map((item) => normalizeString(item)).filter(Boolean).sort();
  }
  if (isPlainObject(changeScope)) {
    const sorted = {};
    for (const key of Object.keys(changeScope).sort()) {
      const value = changeScope[key];
      sorted[key] = Array.isArray(value)
        ? value.map((item) => normalizeString(item)).filter(Boolean).sort()
        : isPlainObject(value)
          ? normalizeChangeScope(value)
          : value;
    }
    return sorted;
  }
  return normalizeString(changeScope);
}

export function buildLayoutInvalidationKey(input = {}) {
  const profileHash = normalizeString(input.profileHash);
  const flowHash = normalizeString(input.flowHash);
  const styleHash = normalizeString(input.styleHash);
  const changeScope = normalizeChangeScope(input.changeScope);

  if (!profileHash || !flowHash || !styleHash) {
    throw new Error('E_LAYOUT_INVALIDATION_HASH_REQUIRED');
  }

  const payload = {
    profileHash,
    flowHash,
    styleHash,
    changeScope,
  };

  return {
    schemaVersion: LAYOUT_INVALIDATION_SCHEMA_VERSION,
    profileHash,
    flowHash,
    styleHash,
    changeScope,
    invalidationKey: hashCanonicalValue(payload),
  };
}

export { LAYOUT_INVALIDATION_SCHEMA_VERSION };

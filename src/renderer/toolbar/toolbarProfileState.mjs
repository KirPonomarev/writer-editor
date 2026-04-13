import {
  TOOLBAR_CANONICAL_LIVE_ORDER,
  TOOLBAR_LEGACY_DROP_LABELS,
  resolveLegacyToolbarFunctionItemId,
  isLiveToolbarFunctionId,
} from './toolbarFunctionCatalog.mjs';

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function freezeMinimalState(minimal) {
  const minimalIds = Object.freeze([...minimal]);
  const toolbarProfiles = Object.freeze({
    minimal: minimalIds,
  });
  return Object.freeze({
    version: 2,
    toolbarProfiles,
  });
}

function normalizeMinimalIdsFromAny(values) {
  const available = new Set(Array.isArray(values) ? values.map(normalizeString).filter(Boolean) : []);
  return TOOLBAR_CANONICAL_LIVE_ORDER.filter((itemId) => available.has(itemId));
}

function normalizeLegacyBucketLabels(value) {
  if (!isPlainObject(value)) {
    return { master: [], minimal: [] };
  }

  return {
    master: Array.isArray(value.master)
      ? value.master.map(normalizeString).filter(Boolean)
      : [],
    minimal: Array.isArray(value.minimal)
      ? value.minimal.map(normalizeString).filter(Boolean)
      : [],
  };
}

export const TOOLBAR_PROFILE_STATE_VERSION = 2;
export const TOOLBAR_PROFILE_STORAGE_PREFIX = 'toolbarProfiles:';
export const TOOLBAR_PROFILE_LEGACY_STORAGE_KEY = 'yalkenConfiguratorBuckets';

export function normalizeProjectId(projectId) {
  return normalizeString(projectId);
}

export function getToolbarProfileStorageKey(projectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  return normalizedProjectId ? `${TOOLBAR_PROFILE_STORAGE_PREFIX}${normalizedProjectId}` : '';
}

export function createToolbarProfileState(minimalIds = []) {
  return freezeMinimalState(normalizeMinimalIdsFromAny(minimalIds));
}

export function createCanonicalMinimalToolbarProfileState() {
  return freezeMinimalState(TOOLBAR_CANONICAL_LIVE_ORDER);
}

export function createEphemeralBaselineToolbarProfileState() {
  return createCanonicalMinimalToolbarProfileState();
}

export function normalizeToolbarProfileState(raw) {
  if (!isPlainObject(raw) || raw.version !== TOOLBAR_PROFILE_STATE_VERSION) {
    return null;
  }

  const toolbarProfiles = isPlainObject(raw.toolbarProfiles) ? raw.toolbarProfiles : null;
  if (!toolbarProfiles) {
    return null;
  }

  if (!Array.isArray(toolbarProfiles.minimal)) {
    return null;
  }

  return freezeMinimalState(normalizeMinimalIdsFromAny(toolbarProfiles.minimal));
}

export function serializeToolbarProfileState(state) {
  const normalized = normalizeToolbarProfileState(state);
  return normalized ? JSON.stringify(normalized) : '';
}

export function readToolbarProfileState(storage, projectId) {
  const storageKey = getToolbarProfileStorageKey(projectId);
  if (!storageKey || !storage || typeof storage.getItem !== 'function') return null;

  let raw = null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return null;
  }
  if (raw == null || raw === '') return null;

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeToolbarProfileState(parsed);
  } catch {
    return null;
  }
}

export function writeToolbarProfileState(storage, projectId, state) {
  const storageKey = getToolbarProfileStorageKey(projectId);
  if (!storageKey || !storage || typeof storage.setItem !== 'function') {
    return false;
  }

  const normalized = normalizeToolbarProfileState(state);
  if (!normalized) {
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function readLegacyConfiguratorBuckets(storage, legacyStorageKey = TOOLBAR_PROFILE_LEGACY_STORAGE_KEY) {
  const storageKey = typeof legacyStorageKey === 'string' ? legacyStorageKey.trim() : '';
  if (!storageKey || !storage || typeof storage.getItem !== 'function') {
    return {
      exists: false,
      buckets: { master: [], minimal: [] },
      raw: null,
    };
  }

  let raw = null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return {
      exists: false,
      buckets: { master: [], minimal: [] },
      raw: null,
    };
  }

  if (raw == null || raw === '') {
    return {
      exists: false,
      buckets: { master: [], minimal: [] },
      raw: null,
    };
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      exists: true,
      buckets: normalizeLegacyBucketLabels(parsed),
      raw: parsed,
    };
  } catch {
    return {
      exists: true,
      buckets: { master: [], minimal: [] },
      raw,
    };
  }
}

export function consumeLegacyConfiguratorBuckets(storage, legacyStorageKey = TOOLBAR_PROFILE_LEGACY_STORAGE_KEY) {
  const storageKey = typeof legacyStorageKey === 'string' ? legacyStorageKey.trim() : '';
  if (!storageKey || !storage || typeof storage.removeItem !== 'function') {
    return false;
  }

  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function migrateLegacyConfiguratorBuckets(rawLegacyBuckets) {
  const legacyBuckets = normalizeLegacyBucketLabels(rawLegacyBuckets);
  const legacyLabels = [...legacyBuckets.master, ...legacyBuckets.minimal];
  const matchedIds = [];
  const seenIds = new Set();
  const droppedLabels = [];
  let exactMatch = true;

  for (const legacyLabel of legacyLabels) {
    if (TOOLBAR_LEGACY_DROP_LABELS.includes(legacyLabel)) {
      droppedLabels.push(legacyLabel);
      exactMatch = false;
      continue;
    }

    const itemId = resolveLegacyToolbarFunctionItemId(legacyLabel);
    if (!itemId) {
      droppedLabels.push(legacyLabel);
      exactMatch = false;
      continue;
    }

    if (seenIds.has(itemId)) {
      exactMatch = false;
      continue;
    }

    seenIds.add(itemId);
    matchedIds.push(itemId);
  }

  const normalizedMinimal = normalizeMinimalIdsFromAny(matchedIds);
  const canonicalMatchedIds = matchedIds.filter((itemId) => isLiveToolbarFunctionId(itemId));
  const isCanonicalOrder = canonicalMatchedIds.length === normalizedMinimal.length
    && canonicalMatchedIds.every((itemId, index) => normalizedMinimal[index] === itemId);
  const hasSource = legacyLabels.length > 0;
  const isLossy = hasSource
    && (
      droppedLabels.length > 0
    || normalizedMinimal.length !== matchedIds.length
    || !isCanonicalOrder
    );
  const isExact = hasSource && !isLossy && normalizedMinimal.length > 0;

  return {
    hasSource,
    exactMatch: isExact,
    isLossy,
    droppedLabels,
    matchedIds: Object.freeze([...matchedIds]),
    state: freezeMinimalState(normalizedMinimal),
  };
}

export function resolveToolbarProfileStateForProjectSwitch(storage, projectId, options = {}) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const legacyStorageKey = typeof options.legacyStorageKey === 'string'
    ? options.legacyStorageKey
    : TOOLBAR_PROFILE_LEGACY_STORAGE_KEY;

  if (!normalizedProjectId) {
    return {
      source: 'ephemeral',
      shouldPersist: false,
      shouldConsumeLegacySource: false,
      state: createEphemeralBaselineToolbarProfileState(),
      migration: null,
    };
  }

  const storedState = readToolbarProfileState(storage, normalizedProjectId);
  if (storedState) {
    const legacyRead = readLegacyConfiguratorBuckets(storage, legacyStorageKey);
    return {
      source: 'persisted',
      shouldPersist: false,
      shouldConsumeLegacySource: legacyRead.exists,
      state: storedState,
      migration: null,
    };
  }

  const legacyRead = readLegacyConfiguratorBuckets(storage, legacyStorageKey);
  if (legacyRead.exists) {
    const migration = migrateLegacyConfiguratorBuckets(legacyRead.buckets);
    if (migration.exactMatch) {
      return {
        source: 'legacy',
        shouldPersist: true,
        shouldConsumeLegacySource: true,
        state: migration.state,
        migration,
      };
    }
    return {
      source: 'seed',
      shouldPersist: true,
      shouldConsumeLegacySource: true,
      state: createCanonicalMinimalToolbarProfileState(),
      migration,
    };
  }

  return {
    source: 'seed',
    shouldPersist: true,
    shouldConsumeLegacySource: false,
    state: createCanonicalMinimalToolbarProfileState(),
    migration: null,
  };
}

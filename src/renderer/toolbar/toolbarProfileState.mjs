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

function freezeToolbarProfiles(minimal, master) {
  const toolbarProfiles = Object.freeze({
    minimal: Object.freeze([...minimal]),
    master: Object.freeze([...master]),
  });
  return Object.freeze({
    version: 3,
    activeToolbarProfile: 'minimal',
    toolbarProfiles,
  });
}

function freezeToolbarProfileState(activeToolbarProfile, minimal, master) {
  const normalizedActiveToolbarProfile = activeToolbarProfile === 'master' ? 'master' : 'minimal';
  return Object.freeze({
    version: 3,
    activeToolbarProfile: normalizedActiveToolbarProfile,
    toolbarProfiles: Object.freeze({
      minimal: Object.freeze([...minimal]),
      master: Object.freeze([...master]),
    }),
  });
}

function normalizeToolbarProfileIds(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const itemId = normalizeString(value);
    if (!itemId || !isLiveToolbarFunctionId(itemId) || seen.has(itemId)) continue;
    seen.add(itemId);
    result.push(itemId);
  }
  return result;
}

function normalizeToolbarProfileStateV3(raw) {
  if (!isPlainObject(raw) || raw.version !== 3) return null;
  const toolbarProfiles = isPlainObject(raw.toolbarProfiles) ? raw.toolbarProfiles : null;
  if (!toolbarProfiles || !Array.isArray(toolbarProfiles.minimal) || !Array.isArray(toolbarProfiles.master)) {
    return null;
  }
  return freezeToolbarProfileState(
    normalizeString(raw.activeToolbarProfile) === 'master' ? 'master' : 'minimal',
    normalizeToolbarProfileIds(toolbarProfiles.minimal),
    normalizeToolbarProfileIds(toolbarProfiles.master),
  );
}

function normalizeToolbarProfileStateV2(raw) {
  if (!isPlainObject(raw) || raw.version !== 2) return null;
  const toolbarProfiles = isPlainObject(raw.toolbarProfiles) ? raw.toolbarProfiles : null;
  if (!toolbarProfiles || !Array.isArray(toolbarProfiles.minimal)) {
    return null;
  }
  return freezeToolbarProfileState(
    'minimal',
    normalizeToolbarProfileIds(toolbarProfiles.minimal),
    TOOLBAR_CANONICAL_LIVE_ORDER,
  );
}

function normalizePersistedToolbarProfileState(raw) {
  return normalizeToolbarProfileStateV3(raw) || normalizeToolbarProfileStateV2(raw);
}

function normalizeLegacyBucketLabels(value) {
  if (!isPlainObject(value)) {
    return { master: [], minimal: [] };
  }

  return {
    master: Array.isArray(value.master) ? value.master.map(normalizeString).filter(Boolean) : [],
    minimal: Array.isArray(value.minimal) ? value.minimal.map(normalizeString).filter(Boolean) : [],
  };
}

function readToolbarProfileStateRecord(storage, projectId) {
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
    const version = isPlainObject(parsed) && typeof parsed.version === 'number' ? parsed.version : null;
    const state = normalizePersistedToolbarProfileState(parsed);
    return {
      exists: true,
      raw,
      version,
      state,
    };
  } catch {
    return {
      exists: true,
      raw,
      version: null,
      state: null,
    };
  }
}

function readLegacyConfiguratorBucketRecord(storage, legacyStorageKey = TOOLBAR_PROFILE_LEGACY_STORAGE_KEY) {
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

function createCanonicalToolbarProfileState() {
  return freezeToolbarProfiles(TOOLBAR_CANONICAL_LIVE_ORDER, TOOLBAR_CANONICAL_LIVE_ORDER);
}

function createToolbarProfileStateRecord({
  activeToolbarProfile = 'minimal',
  minimalIds = [],
  masterIds = [],
} = {}) {
  return freezeToolbarProfileState(
    activeToolbarProfile,
    normalizeToolbarProfileIds(minimalIds),
    normalizeToolbarProfileIds(masterIds),
  );
}

export const TOOLBAR_PROFILE_STATE_VERSION = 3;
export const TOOLBAR_PROFILE_STORAGE_PREFIX = 'toolbarProfiles:';
export const TOOLBAR_PROFILE_LEGACY_STORAGE_KEY = 'yalkenConfiguratorBuckets';

export function normalizeProjectId(projectId) {
  return normalizeString(projectId);
}

export function getToolbarProfileStorageKey(projectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  return normalizedProjectId ? `${TOOLBAR_PROFILE_STORAGE_PREFIX}${normalizedProjectId}` : '';
}

export function createToolbarProfileStateSnapshot({
  activeToolbarProfile = 'minimal',
  minimalIds = [],
  masterIds = [],
} = {}) {
  return createToolbarProfileStateRecord({
    activeToolbarProfile,
    minimalIds,
    masterIds,
  });
}

export function createToolbarProfileState(input = []) {
  if (Array.isArray(input)) {
    return createToolbarProfileStateSnapshot({ minimalIds: input });
  }
  if (isPlainObject(input)) {
    return createToolbarProfileStateSnapshot({
      activeToolbarProfile: input.activeToolbarProfile,
      minimalIds: Array.isArray(input.minimalIds)
        ? input.minimalIds
        : Array.isArray(input.toolbarProfiles?.minimal)
          ? input.toolbarProfiles.minimal
          : [],
      masterIds: Array.isArray(input.masterIds)
        ? input.masterIds
        : Array.isArray(input.toolbarProfiles?.master)
          ? input.toolbarProfiles.master
          : [],
    });
  }
  return createToolbarProfileStateSnapshot({ minimalIds: [] });
}

export function createCanonicalMinimalToolbarProfileState() {
  return createCanonicalToolbarProfileState();
}

export function createEphemeralBaselineToolbarProfileState() {
  return createCanonicalToolbarProfileState();
}

export function normalizeToolbarProfileState(raw) {
  return normalizePersistedToolbarProfileState(raw);
}

export function serializeToolbarProfileState(state) {
  const normalized = normalizeToolbarProfileState(state);
  return normalized ? JSON.stringify(normalized) : '';
}

export function readToolbarProfileState(storage, projectId) {
  const record = readToolbarProfileStateRecord(storage, projectId);
  return record && record.state ? record.state : null;
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
  return readLegacyConfiguratorBucketRecord(storage, legacyStorageKey);
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
  let hadDuplicateMatches = false;

  for (const legacyLabel of legacyLabels) {
    if (TOOLBAR_LEGACY_DROP_LABELS.includes(legacyLabel)) {
      droppedLabels.push(legacyLabel);
      continue;
    }

    const itemId = resolveLegacyToolbarFunctionItemId(legacyLabel);
    if (!itemId) {
      droppedLabels.push(legacyLabel);
      continue;
    }

    if (seenIds.has(itemId)) {
      hadDuplicateMatches = true;
      continue;
    }

    seenIds.add(itemId);
    matchedIds.push(itemId);
  }

  const minimal = normalizeToolbarProfileIds(matchedIds);
  const hasSource = legacyLabels.length > 0;
  const canonicalMinimal = createCanonicalToolbarProfileState();
  const isExact = hasSource
    && matchedIds.length > 0
    && droppedLabels.length === 0
    && !hadDuplicateMatches
    && minimal.length === matchedIds.length
    && minimal.every((itemId, index) => matchedIds[index] === itemId);
  const isLossy = hasSource
    && (
      droppedLabels.length > 0
      || minimal.length !== matchedIds.length
      || minimal.length === 0
      || !isExact
    );

  return {
    hasSource,
    exactMatch: isExact,
    isLossy,
    droppedLabels,
    matchedIds: Object.freeze([...minimal]),
    state: isExact
      ? freezeToolbarProfileState('minimal', minimal, TOOLBAR_CANONICAL_LIVE_ORDER)
      : canonicalMinimal,
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

  const storedRecord = readToolbarProfileStateRecord(storage, normalizedProjectId);
  if (storedRecord && storedRecord.state) {
    const legacyRead = readLegacyConfiguratorBuckets(storage, legacyStorageKey);
    const serializedState = JSON.stringify(storedRecord.state);
    const rawJson = typeof storedRecord.raw === 'string' ? storedRecord.raw : JSON.stringify(storedRecord.raw);
    const shouldPersist = storedRecord.version !== 3 || rawJson !== serializedState;
    return {
      source: 'persisted',
      shouldPersist,
      shouldConsumeLegacySource: legacyRead.exists,
      state: storedRecord.state,
      migration: storedRecord.version === 3 ? null : {
        fromVersion: storedRecord.version ?? null,
        toVersion: 3,
      },
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
      state: createCanonicalToolbarProfileState(),
      migration,
    };
  }

  return {
    source: 'seed',
    shouldPersist: true,
    shouldConsumeLegacySource: false,
    state: createCanonicalToolbarProfileState(),
    migration: null,
  };
}

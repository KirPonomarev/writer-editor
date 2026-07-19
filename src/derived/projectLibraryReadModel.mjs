import crypto from 'node:crypto';

export const PROJECT_LIBRARY_READ_MODEL_SCHEMA_VERSION = 'project-library-read-model.v1';

const VALID_STATUSES = new Set(['available', 'archived', 'trashed', 'missing']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, maxLength = 512) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeIsoString(value) {
  const text = normalizeString(value, 64);
  if (!text) return '';
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function normalizeStatus(value) {
  const text = normalizeString(value, 32).toLowerCase();
  return VALID_STATUSES.has(text) ? text : 'available';
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function normalizeProjectRecord(record = {}, index = 0) {
  const source = isPlainObject(record) ? record : {};
  const projectId = normalizeString(source.projectId, 128);
  const projectName = normalizeString(source.projectName || source.title, 256) || 'Untitled';
  const locationKey = normalizeString(source.locationKey, 128) || `location-${index}`;
  const status = normalizeStatus(source.status);
  const lastOpenedAtUtc = normalizeIsoString(source.lastOpenedAtUtc);
  const lastSeenAtUtc = normalizeIsoString(source.lastSeenAtUtc);
  const createdAtUtc = normalizeIsoString(source.createdAtUtc);
  const manifestHash = normalizeString(source.manifestHash, 128);
  const sourceKind = normalizeString(source.source, 64) || 'scan';
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.map((value) => normalizeString(value, 96)).filter(Boolean).slice(0, 8)
    : [];
  return {
    id: `project-entry-${stableHash([projectId, locationKey, status]).slice(0, 32)}`,
    projectId,
    projectName,
    title: projectName,
    status,
    source: sourceKind,
    createdAtUtc,
    lastOpenedAtUtc,
    lastSeenAtUtc,
    manifestHash,
    duplicateProjectId: false,
    warnings,
  };
}

function compareProjectEntries(a, b) {
  const timeA = Date.parse(a.lastOpenedAtUtc || a.lastSeenAtUtc || a.createdAtUtc || '') || 0;
  const timeB = Date.parse(b.lastOpenedAtUtc || b.lastSeenAtUtc || b.createdAtUtc || '') || 0;
  if (timeA !== timeB) return timeB - timeA;
  return String(a.projectName).localeCompare(String(b.projectName), 'ru');
}

export function buildProjectLibraryReadModel(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const unavailableReason = normalizeString(source.unavailableReason, 128);
  const scannedAtUtc = normalizeIsoString(source.scannedAtUtc) || new Date(0).toISOString();
  const rawProjects = Array.isArray(source.projects) ? source.projects : [];
  const entries = rawProjects
    .map(normalizeProjectRecord)
    .filter((entry) => entry.projectId)
    .sort(compareProjectEntries);
  const projectIdCounts = new Map();
  for (const entry of entries) {
    projectIdCounts.set(entry.projectId, (projectIdCounts.get(entry.projectId) || 0) + 1);
  }
  const normalizedEntries = entries.map((entry) => {
    const duplicateProjectId = (projectIdCounts.get(entry.projectId) || 0) > 1;
    return {
      ...entry,
      duplicateProjectId,
      warnings: duplicateProjectId
        ? [...new Set([...entry.warnings, 'DUPLICATE_PROJECT_ID'])]
        : entry.warnings,
    };
  });
  const idsByStatus = (status) => normalizedEntries
    .filter((entry) => entry.status === status)
    .map((entry) => entry.id);
  const recent = normalizedEntries
    .filter((entry) => entry.status !== 'missing' && entry.lastOpenedAtUtc)
    .sort(compareProjectEntries)
    .map((entry) => entry.id);

  return {
    ok: true,
    schemaVersion: PROJECT_LIBRARY_READ_MODEL_SCHEMA_VERSION,
    state: unavailableReason ? 'unavailable' : 'ready',
    scannedAtUtc,
    unavailableReason,
    entries: normalizedEntries,
    views: {
      recent,
      all: normalizedEntries.map((entry) => entry.id),
      archived: idsByStatus('archived'),
      missing: idsByStatus('missing'),
      trashed: idsByStatus('trashed'),
    },
    counts: {
      total: normalizedEntries.length,
      recent: recent.length,
      available: idsByStatus('available').length,
      archived: idsByStatus('archived').length,
      missing: idsByStatus('missing').length,
      trashed: idsByStatus('trashed').length,
      duplicateProjectIds: [...projectIdCounts.values()].filter((count) => count > 1).length,
    },
    authority: {
      pathsExposed: false,
      sourceOfTruth: 'project-manifest',
      indexIsRebuildable: true,
      accountRequired: false,
      networkRequired: false,
    },
  };
}

import crypto from 'node:crypto';

export const PROJECT_SEARCH_READ_MODEL_SCHEMA_VERSION = 'project-search-read-model.v1';
export const PROJECT_SEARCH_MAX_QUERY_LENGTH = 256;
export const PROJECT_SEARCH_MAX_RESULTS = 100;
export const PROJECT_SEARCH_MAX_PREVIEW_CONTEXT = 56;

const VALID_SCOPES = new Set([
  'project',
  'manuscript',
  'current',
  'selected',
  'structure',
  'notes',
  'annotations',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value, maxLength = 16384) {
  if (typeof value !== 'string') return '';
  const text = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeOptionalString(value, maxLength = 512) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeResultLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(1, Math.min(PROJECT_SEARCH_MAX_RESULTS, Math.floor(number)));
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function resultIdFor(parts) {
  return `search-result-${stableHash(parts).slice(0, 32)}`;
}

export function normalizeProjectSearchOptions(options = {}) {
  const source = isPlainObject(options) ? options : {};
  const query = normalizeOptionalString(source.query, PROJECT_SEARCH_MAX_QUERY_LENGTH);
  const scopeInput = normalizeOptionalString(source.scope, 64).toLowerCase();
  const scope = VALID_SCOPES.has(scopeInput) ? scopeInput : 'project';
  return {
    query,
    scope,
    caseSensitive: normalizeBoolean(source.caseSensitive),
    wholeWord: normalizeBoolean(source.wholeWord),
    limit: normalizeResultLimit(source.limit),
    activeNodeId: normalizeOptionalString(source.activeNodeId, 128),
    scopeNodeId: normalizeOptionalString(source.scopeNodeId, 128),
    selectedNodeIds: Array.isArray(source.selectedNodeIds)
      ? source.selectedNodeIds
        .map((value) => normalizeOptionalString(value, 128))
        .filter(Boolean)
        .slice(0, 100)
      : [],
  };
}

function normalizeSearchSource(source = {}, index = 0) {
  const value = isPlainObject(source) ? source : {};
  const type = normalizeOptionalString(value.type, 64) || 'document';
  const sourceId = normalizeOptionalString(value.sourceId || value.nodeId || value.noteId || value.annotationId, 128)
    || `source-${index}`;
  return {
    type,
    sourceId,
    nodeId: normalizeOptionalString(value.nodeId, 128),
    noteId: normalizeOptionalString(value.noteId, 128),
    annotationId: normalizeOptionalString(value.annotationId, 128),
    kind: normalizeOptionalString(value.kind, 64),
    title: normalizeOptionalString(value.title, 256) || 'Без названия',
    scope: normalizeOptionalString(value.scope, 64) || type,
    contentHash: normalizeOptionalString(value.contentHash, 128),
    field: normalizeOptionalString(value.field, 64) || 'body',
    text: normalizeText(value.text, 262144),
  };
}

function isWordChar(character) {
  return /[\p{L}\p{N}_]/u.test(character || '');
}

function wholeWordMatches(text, from, to) {
  return !isWordChar(text[from - 1]) && !isWordChar(text[to]);
}

function findMatches(text, query, options) {
  if (!query) return [];
  const haystack = options.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
  const matches = [];
  let cursor = 0;
  while (cursor <= haystack.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index === -1) break;
    const to = index + needle.length;
    if (!options.wholeWord || wholeWordMatches(haystack, index, to)) {
      matches.push({ from: index, to });
    }
    cursor = Math.max(to, index + 1);
    if (matches.length >= PROJECT_SEARCH_MAX_RESULTS) break;
  }
  return matches;
}

function collapseWhitespace(text) {
  return String(text || '').replace(/\s+/gu, ' ').trim();
}

function buildPreview(text, match) {
  const from = Math.max(0, match.from - PROJECT_SEARCH_MAX_PREVIEW_CONTEXT);
  const to = Math.min(text.length, match.to + PROJECT_SEARCH_MAX_PREVIEW_CONTEXT);
  const prefix = from > 0 ? '...' : '';
  const suffix = to < text.length ? '...' : '';
  const before = text.slice(from, match.from);
  const hit = text.slice(match.from, match.to);
  const after = text.slice(match.to, to);
  return {
    text: `${prefix}${collapseWhitespace(before)}${before ? ' ' : ''}${hit}${after ? ' ' : ''}${collapseWhitespace(after)}${suffix}`,
    matchText: hit,
    from: match.from,
    to: match.to,
  };
}

function resultFromMatch(projectId, source, match, index) {
  const sourcePayload = {
    type: source.type,
    sourceId: source.sourceId,
    nodeId: source.nodeId,
    noteId: source.noteId,
    annotationId: source.annotationId,
    kind: source.kind,
    title: source.title,
    scope: source.scope,
    field: source.field,
    contentHash: source.contentHash,
  };
  return {
    id: resultIdFor([projectId, source.sourceId, source.field, match.from, match.to, index]),
    source: sourcePayload,
    title: source.title,
    kind: source.kind || source.type,
    preview: buildPreview(source.text, match),
    score: Math.max(1, 1000 - index),
  };
}

export function buildProjectSearchReadModel(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const options = normalizeProjectSearchOptions(source.options);
  const projectId = normalizeOptionalString(source.projectId, 128);
  if (!options.query) {
    return {
      ok: true,
      schemaVersion: PROJECT_SEARCH_READ_MODEL_SCHEMA_VERSION,
      projectId,
      state: 'empty',
      options,
      results: [],
      counts: { total: 0, returned: 0, sources: 0 },
      stale: false,
      cancelled: false,
    };
  }

  const documents = Array.isArray(source.sources) ? source.sources : [];
  const results = [];
  let scannedSources = 0;
  for (const rawSource of documents) {
    if (source.signal?.aborted === true) {
      return {
        ok: true,
        schemaVersion: PROJECT_SEARCH_READ_MODEL_SCHEMA_VERSION,
        projectId,
        state: 'cancelled',
        options,
        results,
        counts: { total: results.length, returned: results.length, sources: scannedSources },
        stale: true,
        cancelled: true,
      };
    }
    const searchSource = normalizeSearchSource(rawSource, scannedSources);
    scannedSources += 1;
    if (!searchSource.text) continue;
    const matches = findMatches(searchSource.text, options.query, options);
    for (const match of matches) {
      results.push(resultFromMatch(projectId, searchSource, match, results.length));
      if (results.length >= options.limit) {
        return {
          ok: true,
          schemaVersion: PROJECT_SEARCH_READ_MODEL_SCHEMA_VERSION,
          projectId,
          state: 'ready',
          options,
          results,
          counts: { total: results.length, returned: results.length, sources: scannedSources },
          truncated: true,
          stale: false,
          cancelled: false,
        };
      }
    }
  }

  return {
    ok: true,
    schemaVersion: PROJECT_SEARCH_READ_MODEL_SCHEMA_VERSION,
    projectId,
    state: results.length > 0 ? 'ready' : 'no-results',
    options,
    results,
    counts: { total: results.length, returned: results.length, sources: scannedSources },
    truncated: false,
    stale: false,
    cancelled: false,
  };
}

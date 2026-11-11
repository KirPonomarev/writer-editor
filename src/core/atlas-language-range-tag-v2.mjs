import { hashCanonicalValue } from './browser-safe-hash.mjs';

export const ATLAS_LANGUAGE_RANGE_TAG_SCHEMA = 'atlas.languageRangeTag.v2';
const DECISION_SCHEMA = 'atlas.languageRangeDecision.v1';
const OFFSET_DOMAIN = 'UTF16_JS_CODE_UNIT';
const MAX_QUOTE = 20000;
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const revision = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
const copy = value => JSON.parse(JSON.stringify(value));
const unicode = value => typeof value === 'string' && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const id = value => unicode(value) && value.length > 0 && value.length <= 1000
  && value === value.trim() && !/[\u0000-\u001f]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const keys = (value, expected) => plain(value) && Object.keys(value).length === expected.length
  && expected.every(key => own(value, key));
const refuse = code => { throw Object.assign(new Error(code), { code }); };

export function validateAtlasRangeLanguageIntent(commandId, payload) {
  const set = commandId === 'atlas.languageTag.set';
  if (!set && commandId !== 'atlas.languageTag.clear') refuse('E_ATLAS_RANGE_LANGUAGE_PAYLOAD_INVALID');
  const required = ['projectId', 'sceneId', 'scopeKind', 'rangeIntentVersion', 'sceneRevision', 'sceneTextHash'];
  const allowed = [...required, 'tagId', 'expectedTagHash', ...(set ? ['startOffset', 'endOffset', 'quoteText', 'languageCode'] : [])];
  if (!plain(payload) || Object.keys(payload).some(key => !allowed.includes(key)) || required.some(key => !own(payload, key))
    || payload.rangeIntentVersion !== 2 || payload.scopeKind !== 'range' || !id(payload.projectId) || !id(payload.sceneId)
    || !revision(payload.sceneRevision) || !hex(payload.sceneTextHash)
    || own(payload, 'tagId') !== own(payload, 'expectedTagHash')
    || (own(payload, 'tagId') && (!id(payload.tagId) || !hex(payload.expectedTagHash)))
    || (!set && !own(payload, 'tagId'))) refuse('E_ATLAS_RANGE_LANGUAGE_PAYLOAD_INVALID');
  if (set && (!Number.isSafeInteger(payload.startOffset) || payload.startOffset < 0
    || !Number.isSafeInteger(payload.endOffset) || payload.endOffset <= payload.startOffset
    || !unicode(payload.quoteText) || !payload.quoteText.length || payload.quoteText.length > MAX_QUOTE
    || payload.quoteText.length !== payload.endOffset - payload.startOffset
    || !unicode(payload.languageCode) || !payload.languageCode.trim() || payload.languageCode.length > 1000)) {
    refuse('E_ATLAS_RANGE_LANGUAGE_PAYLOAD_INVALID');
  }
}

function validSource(source) {
  return keys(source, ['sceneRevision', 'sceneTextHash', 'startOffset', 'endOffset', 'quoteText', 'adapterOffsetDomain'])
    && revision(source.sceneRevision) && hex(source.sceneTextHash) && source.adapterOffsetDomain === OFFSET_DOMAIN
    && Number.isSafeInteger(source.startOffset) && source.startOffset >= 0
    && Number.isSafeInteger(source.endOffset) && source.endOffset > source.startOffset
    && unicode(source.quoteText) && source.quoteText.length > 0 && source.quoteText.length <= MAX_QUOTE
    && source.quoteText.length === source.endOffset - source.startOffset;
}

function validLegacy(record, normalizeLanguage) {
  return plain(record) && record.schemaVersion === 'atlas.languageTag.v1' && record.scopeKind === 'range'
    && id(record.id) && id(record.projectId) && id(record.sceneId) && record.source === 'author'
    && record.manuscriptMutation === false && Number.isSafeInteger(record.startOffset) && record.startOffset >= 0
    && Number.isSafeInteger(record.endOffset) && record.endOffset > record.startOffset && hex(record.sourceHash)
    && typeof record.languageCode === 'string' && normalizeLanguage(record.languageCode).ok
    && record.sourceHash === hashCanonicalValue(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'sourceHash')));
}

// The existing Core language admission is supplied by each trusted consumer.
// It remains the sole BCP47 authority, including grandfathered/private tags.
export function readAtlasRangeLanguageRecord(record, { normalizeLanguage, isGraphemeBoundaryAligned, scene = null } = {}) {
  if (typeof normalizeLanguage !== 'function') return { ok: false, reason: 'E_ATLAS_RANGE_LANGUAGE_LANGUAGE_POLICY_REQUIRED' };
  if (validLegacy(record, normalizeLanguage)) return { ok: true, version: 1, state: 'legacy-unbound',
    id: record.id, projectId: record.projectId, sceneId: record.sceneId,
    head: { operation: 'set', languageCode: record.languageCode, source: {
      startOffset: record.startOffset, endOffset: record.endOffset } } };
  if (!keys(record, ['schemaVersion', 'id', 'projectId', 'originProjectId', 'sceneId', 'scopeKind', 'history', 'sourceHash'])
    || record.schemaVersion !== ATLAS_LANGUAGE_RANGE_TAG_SCHEMA || record.scopeKind !== 'range'
    || !id(record.id) || !id(record.projectId) || !id(record.originProjectId) || !id(record.sceneId) || !hex(record.sourceHash)
    || !Array.isArray(record.history) || !record.history.length) return { ok: false, reason: 'E_ATLAS_RANGE_LANGUAGE_RECORD_INVALID' };
  let previousHash = '', sequence = 0, previous = null;
  for (const [index, entry] of record.history.entries()) {
    if (!keys(entry, ['schemaVersion', 'projectId', 'sequence', 'operation', 'previousHash', 'languageCode', 'source', 'legacyRecord', 'hash'])
      || entry.schemaVersion !== DECISION_SCHEMA || !Number.isSafeInteger(entry.sequence) || entry.sequence <= sequence
      || !id(entry.projectId) || (index === 0 && entry.projectId !== record.originProjectId)
      || !['set', 'clear'].includes(entry.operation) || (index === 0 && entry.operation !== 'set')
      || entry.previousHash !== previousHash || !hex(entry.hash) || !validSource(entry.source)
      || typeof entry.languageCode !== 'string' || !normalizeLanguage(entry.languageCode).ok
      || (entry.legacyRecord !== null && (index !== 0 || !validLegacy(entry.legacyRecord, normalizeLanguage)
        || entry.legacyRecord.id !== record.id || entry.legacyRecord.projectId !== record.originProjectId || entry.legacyRecord.sceneId !== record.sceneId))) {
      return { ok: false, reason: 'E_ATLAS_RANGE_LANGUAGE_HISTORY_INVALID' };
    }
    const { hash, ...body } = entry;
    if (hashCanonicalValue(body) !== hash || (entry.operation === 'clear' && (previous?.operation !== 'set'
      || entry.languageCode !== previous.languageCode || hashCanonicalValue(entry.source) !== hashCanonicalValue(previous.source)))) {
      return { ok: false, reason: 'E_ATLAS_RANGE_LANGUAGE_HISTORY_INVALID' };
    }
    previousHash = hash; sequence = entry.sequence; previous = entry;
  }
  const { sourceHash, ...body } = record;
  if (hashCanonicalValue(body) !== sourceHash) return { ok: false, reason: 'E_ATLAS_RANGE_LANGUAGE_RECORD_INVALID' };
  const head = copy(previous);
  let state = head.operation === 'clear' ? 'cleared' : 'source-unavailable';
  if (head.operation === 'set' && scene && typeof scene.text === 'string') {
    const exact = scene.sceneRevision === head.source.sceneRevision && hashCanonicalValue(scene.text) === head.source.sceneTextHash;
    state = !exact ? 'stale' : typeof isGraphemeBoundaryAligned !== 'function' ? 'source-unavailable'
      : scene.text.slice(head.source.startOffset, head.source.endOffset) === head.source.quoteText
        && isGraphemeBoundaryAligned(scene.text, head.source.startOffset, head.source.endOffset) === true ? 'current' : 'invalid-source';
  }
  return { ok: true, version: 2, state, id: record.id, projectId: record.projectId, sceneId: record.sceneId,
    head, historyLength: record.history.length, recordHash: hashCanonicalValue(record) };
}

export function prepareAtlasRangeLanguageRecord({ commandId, payload, scene, records, sequence,
  languageCode, normalizeLanguage, isGraphemeBoundaryAligned }) {
  validateAtlasRangeLanguageIntent(commandId, payload);
  if (!plain(scene) || typeof scene.text !== 'string' || scene.sceneRevision !== payload.sceneRevision
    || hashCanonicalValue(scene.text) !== payload.sceneTextHash) refuse('E_ATLAS_RANGE_LANGUAGE_SOURCE_STALE');
  if (!plain(records) || !Number.isSafeInteger(sequence) || sequence < 1) refuse('E_ATLAS_RANGE_LANGUAGE_RECORD_INVALID');
  const set = commandId === 'atlas.languageTag.set';
  if (set && (scene.text.slice(payload.startOffset, payload.endOffset) !== payload.quoteText || payload.endOffset > scene.text.length
    || typeof isGraphemeBoundaryAligned !== 'function'
    || isGraphemeBoundaryAligned(scene.text, payload.startOffset, payload.endOffset) !== true)) refuse('E_ATLAS_RANGE_LANGUAGE_SOURCE_STALE');
  const tagId = payload.tagId || 'atlas-language-tag:range:' + hashCanonicalValue({ projectId: payload.projectId,
    sceneId: payload.sceneId, startOffset: payload.startOffset, endOffset: payload.endOffset });
  const existing = own(records, tagId) ? records[tagId] : null;
  if (existing ? !own(payload, 'tagId') || hashCanonicalValue(existing) !== payload.expectedTagHash
    : !set || own(payload, 'tagId')) refuse('E_ATLAS_LANGUAGE_TAG_STALE');
  let selected = null;
  for (const [key, row] of Object.entries(records)) {
    const read = readAtlasRangeLanguageRecord(row, { normalizeLanguage, isGraphemeBoundaryAligned,
      scene: row?.sceneId === payload.sceneId ? scene : null });
    if (!read.ok || key !== read.id || read.projectId !== payload.projectId || read.state === 'invalid-source') refuse('E_ATLAS_RANGE_LANGUAGE_RECORD_INVALID');
    if (key === tagId) {
      if (read.sceneId !== payload.sceneId || (read.version === 2 && read.head.sequence >= sequence)) refuse('E_ATLAS_LANGUAGE_TAG_STALE');
      selected = read;
    } else if (set && read.sceneId === payload.sceneId && (read.version === 1 || read.state === 'current')
      && read.head.operation === 'set' && read.head.source.startOffset < payload.endOffset && read.head.source.endOffset > payload.startOffset) {
      refuse('E_ATLAS_LANGUAGE_TAG_RANGE_OVERLAP');
    }
  }
  if (!set && selected?.head.operation !== 'set') refuse('E_ATLAS_LANGUAGE_TAG_STALE');
  const source = set ? { sceneRevision: payload.sceneRevision, sceneTextHash: payload.sceneTextHash,
    startOffset: payload.startOffset, endOffset: payload.endOffset, quoteText: payload.quoteText, adapterOffsetDomain: OFFSET_DOMAIN }
    : selected?.version === 2 ? copy(selected.head.source) : null;
  // An unbound legacy mark must first be explicitly rebound before retraction
  // can claim retention of its original quote. Never manufacture that quote.
  if (!source) refuse('E_ATLAS_RANGE_LANGUAGE_LEGACY_SOURCE_UNBOUND');
  const history = selected?.version === 2 ? copy(existing.history) : [];
  const entry = { schemaVersion: DECISION_SCHEMA, projectId: payload.projectId, sequence, operation: set ? 'set' : 'clear',
    previousHash: history.at(-1)?.hash || '', languageCode: set ? languageCode : selected.head.languageCode,
    source, legacyRecord: selected?.version === 1 ? copy(existing) : null };
  history.push({ ...entry, hash: hashCanonicalValue(entry) });
  const record = { schemaVersion: ATLAS_LANGUAGE_RANGE_TAG_SCHEMA, id: tagId, projectId: payload.projectId,
    originProjectId: selected?.version === 2 ? existing.originProjectId : payload.projectId,
    sceneId: payload.sceneId, scopeKind: 'range', history };
  return { ...record, sourceHash: hashCanonicalValue(record) };
}

// COPY rebinds only current ownership. Original decisions, quotes, source
// revisions and their historical owners remain unchanged; restore is opaque.
export function rebindAtlasRangeLanguageTagsForProjectCopy(atlas, sourceProjectId, projectId, normalizeLanguage) {
  if (!plain(atlas) || !plain(atlas.languageTags) || !plain(atlas.languageTags.ranges)) return atlas;
  if (!Object.keys(atlas.languageTags.ranges).length) return atlas;
  const next = copy(atlas);
  for (const [key, record] of Object.entries(atlas.languageTags.ranges)) {
    const read = readAtlasRangeLanguageRecord(record, { normalizeLanguage });
    if (!id(sourceProjectId) || !id(projectId) || projectId === sourceProjectId || atlas.schemaVersion !== 'atlas.author.v1'
      || !read.ok || key !== read.id || read.projectId !== sourceProjectId) refuse('E_ATLAS_RANGE_LANGUAGE_COPY_INVALID');
    const { sourceHash, ...body } = record;
    if (sourceHash !== hashCanonicalValue(body)) refuse('E_ATLAS_RANGE_LANGUAGE_COPY_INVALID');
    const rebound = { ...copy(body), projectId };
    next.languageTags.ranges[key] = { ...rebound, sourceHash: hashCanonicalValue(rebound) };
  }
  return next;
}

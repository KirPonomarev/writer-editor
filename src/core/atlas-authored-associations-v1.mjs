import { hashCanonicalValue } from './browser-safe-hash.mjs';

export const ATLAS_AUTHORED_ASSOCIATION_SCHEMA = 'atlas.authoredAssociation.v1';
export const ATLAS_AUTHORED_ASSOCIATION_LIMITS = Object.freeze({ records: 10_000, revisions: 128, bytes: 8 * 1024 * 1024, quote: 4096 });
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const digest = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const clone = value => JSON.parse(JSON.stringify(value));
function fail(reason) { throw Object.assign(new Error(reason), { code: 'E_ATLAS_ASSOCIATION_' + reason }); }
function dataObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(value).every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && !forbidden.has(key) && d.enumerable && own(d, 'value');
  });
}
function exact(value, keys) { return dataObject(value) && Reflect.ownKeys(value).length === keys.length && keys.every(key => own(value, key)); }
function id(value, max = 200) { return typeof value === 'string' && value.length > 0 && value.length <= max
  && value === value.trim() && value === value.normalize('NFC') && !forbidden.has(value) && !/[\u0000-\u001f\u007f]/u.test(value); }
function label(value) { return typeof value === 'string' && Boolean(value.trim()) && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value); }
function offset(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000; }
const scopes = ['BOOK', 'SCENE', 'FRAGMENT'], directions = ['DIRECTED', 'UNDIRECTED'];

// This validator also runs on raw Main input, before JSON cloning or reading
// IDs/source coordinates. Transport editorMode is validated/removed by Main.
export function validateAtlasAssociationPayload(payload) {
  const common = ['operation', 'projectId', 'associationId', 'expectedManifestRevision', 'expectedAssociationHash'];
  if (!dataObject(payload)) fail('PAYLOAD_INVALID');
  const record = payload.operation === 'record', retract = payload.operation === 'retract';
  const keys = record ? [...common, 'associationKind', 'direction', 'sourceEntityId', 'targetEntityId', 'scopeKind', 'source', 'expectedSceneRevision'] : common;
  if ((!record && !retract) || !exact(payload, keys) || !id(payload.projectId) || !id(payload.associationId)
    || !digest(payload.expectedManifestRevision) || (payload.expectedAssociationHash !== '' && !hex(payload.expectedAssociationHash))) fail('PAYLOAD_INVALID');
  if (record && (!label(payload.associationKind) || !directions.includes(payload.direction) || !scopes.includes(payload.scopeKind)
    || !id(payload.sourceEntityId) || !id(payload.targetEntityId) || !digest(payload.expectedSceneRevision)
    || !exact(payload.source, ['sceneId', 'startOffset', 'endOffset', 'sceneTextHash']) || !id(payload.source.sceneId)
    || !offset(payload.source.startOffset) || !offset(payload.source.endOffset) || !hex(payload.source.sceneTextHash))) fail('PAYLOAD_INVALID');
}

function sourceValid(source) {
  return dataObject(source) && source.schemaVersion === 'atlas.authoredAssociationSource.v1' && id(source.anchorId, 300) && id(source.sceneId)
    && offset(source.startOffset) && offset(source.endOffset) && source.endOffset > source.startOffset
    && typeof source.quote === 'string' && source.quote.length > 0 && source.quote.length <= ATLAS_AUTHORED_ASSOCIATION_LIMITS.quote
    && source.quote.length === source.endOffset - source.startOffset && hex(source.sceneTextHash) && hex(source.quoteHash)
    && source.quoteHash === hashCanonicalValue(source.quote) && digest(source.sceneRevision) && digest(source.manifestRevision);
}
export function atlasAuthoredAssociationSemanticKey(revision) {
  let source = revision.sourceEntityId, target = revision.targetEntityId;
  if (revision.direction === 'UNDIRECTED' && source > target) [source, target] = [target, source];
  return hashCanonicalValue({ kind: revision.associationKind.trim().normalize('NFC'), direction: revision.direction, source, target,
    scope: revision.scopeKind, ...(revision.scopeKind !== 'BOOK' ? { sceneId: revision.source.sceneId } : {}),
    ...(revision.scopeKind === 'FRAGMENT' ? { startOffset: revision.source.startOffset, endOffset: revision.source.endOffset } : {}) });
}
function budget(records) {
  if (new TextEncoder().encode(JSON.stringify(records)).byteLength > ATLAS_AUTHORED_ASSOCIATION_LIMITS.bytes) fail('CAPACITY');
}
export function readAtlasAuthoredAssociationRecords(atlas, projectId) {
  if (!dataObject(atlas) || atlas.schemaVersion !== 'atlas.author.v1' || !dataObject(atlas.entities)) fail('SCHEMA_UNSUPPORTED');
  if (!own(atlas, 'authoredAssociations')) return {};
  const records = atlas.authoredAssociations;
  if (!dataObject(records)) fail('SCHEMA_UNSUPPORTED');
  if (Object.keys(records).length > ATLAS_AUTHORED_ASSOCIATION_LIMITS.records) fail('CAPACITY');
  budget(records); const semantics = new Set();
  for (const [key, record] of Object.entries(records)) {
    if (!id(key) || !dataObject(record) || record.schemaVersion !== ATLAS_AUTHORED_ASSOCIATION_SCHEMA || record.id !== key
      || record.projectId !== projectId || record.source !== 'author' || !Array.isArray(record.revisions)
      || !record.revisions.length || record.revisions.length > ATLAS_AUTHORED_ASSOCIATION_LIMITS.revisions
      || Reflect.ownKeys(record.revisions).length !== record.revisions.length + 1) fail('SCHEMA_UNSUPPORTED');
    let previous = 0;
    for (let index = 0; index < record.revisions.length; index++) {
      const r = record.revisions[index];
      if (!dataObject(r) || r.revision !== index + 1 || !Number.isSafeInteger(r.commandSeq) || r.commandSeq <= previous
        || !['active', 'retracted'].includes(r.status) || !label(r.associationKind) || !directions.includes(r.direction)
        || !id(r.sourceEntityId) || !id(r.targetEntityId) || r.sourceEntityId === r.targetEntityId || !scopes.includes(r.scopeKind)
        || !sourceValid(r.source)) fail('SCHEMA_UNSUPPORTED');
      previous = r.commandSeq;
    }
    const latest = record.revisions.at(-1), semantic = atlasAuthoredAssociationSemanticKey(latest);
    if (latest.status === 'active' && semantics.has(semantic)) fail('SCHEMA_UNSUPPORTED');
    if (latest.status === 'active') semantics.add(semantic);
  }
  return records;
}

export function isAtlasAuthoredAssociationEvidenceCurrent(source, scene, graphemeBoundary) {
  if (!sourceValid(source) || !scene || typeof scene.text !== 'string') return false;
  return source.endOffset <= scene.text.length && typeof graphemeBoundary === 'function'
    && graphemeBoundary(scene.text, source.startOffset, source.endOffset) === true && hashCanonicalValue(scene.text) === source.sceneTextHash
    && scene.text.slice(source.startOffset, source.endOffset) === source.quote;
}

export function areAtlasAssociationEntitiesCurrent(entities, revision) {
  return dataObject(entities) && [revision.sourceEntityId, revision.targetEntityId].every(id => own(entities, id)
    && dataObject(entities[id]) && entities[id].id === id && entities[id].mergeState !== 'MERGED');
}

export function recordAtlasAuthoredAssociation(project, payload, commandSeq, graphemeBoundary) {
  validateAtlasAssociationPayload(payload);
  if (!project || project.id !== payload.projectId) fail('PROJECT_UNAVAILABLE');
  if (project.manifestRevision !== payload.expectedManifestRevision) fail('MANIFEST_STALE');
  const records = readAtlasAuthoredAssociationRecords(project.atlas, project.id), existing = records[payload.associationId];
  if (existing ? payload.expectedAssociationHash !== hashCanonicalValue(existing) : payload.expectedAssociationHash !== '') fail('RECORD_STALE');
  if (payload.operation === 'retract' && !existing) fail('NOT_FOUND');
  if ((existing?.revisions.length || 0) >= ATLAS_AUTHORED_ASSOCIATION_LIMITS.revisions
    || !existing && Object.keys(records).length >= ATLAS_AUTHORED_ASSOCIATION_LIMITS.records) fail('CAPACITY');
  if (!Number.isSafeInteger(commandSeq) || commandSeq <= (existing?.revisions.at(-1).commandSeq || 0)) fail('RECORD_STALE');
  const revision = (existing?.revisions.length || 0) + 1; let nextRevision;
  if (payload.operation === 'retract') {
    nextRevision = { ...clone(existing.revisions.at(-1)), revision, commandSeq, status: 'retracted' };
  } else {
    const entities = project.atlas.entities;
    if (payload.sourceEntityId === payload.targetEntityId || !areAtlasAssociationEntitiesCurrent(entities, payload)) fail('ENTITY_UNAVAILABLE');
    const input = payload.source, scene = project.scenes?.[input.sceneId];
    if (!scene || typeof scene.text !== 'string' || scene.sceneRevision !== payload.expectedSceneRevision) fail('SCENE_STALE');
    if (hashCanonicalValue(scene.text) !== input.sceneTextHash) fail('SOURCE_STALE');
    if (input.endOffset <= input.startOffset || input.endOffset > scene.text.length || input.endOffset - input.startOffset > ATLAS_AUTHORED_ASSOCIATION_LIMITS.quote
      || typeof graphemeBoundary !== 'function' || graphemeBoundary(scene.text, input.startOffset, input.endOffset) !== true) fail('RANGE_INVALID');
    const quote = scene.text.slice(input.startOffset, input.endOffset);
    nextRevision = { revision, commandSeq, status: 'active', associationKind: payload.associationKind, direction: payload.direction,
      sourceEntityId: payload.sourceEntityId, targetEntityId: payload.targetEntityId, scopeKind: payload.scopeKind,
      source: { schemaVersion: 'atlas.authoredAssociationSource.v1', anchorId: `atlas-association-source:${payload.associationId}:${revision}`,
        ...clone(input), quote, quoteHash: hashCanonicalValue(quote), sceneRevision: payload.expectedSceneRevision, manifestRevision: payload.expectedManifestRevision } };
    const semantic = atlasAuthoredAssociationSemanticKey(nextRevision);
    for (const [id, record] of Object.entries(records)) {
      if (id !== payload.associationId && record.revisions.at(-1).status === 'active'
        && atlasAuthoredAssociationSemanticKey(record.revisions.at(-1)) === semantic) fail('DUPLICATE');
    }
  }
  const next = clone(records);
  next[payload.associationId] = existing ? { ...clone(existing), revisions: [...clone(existing.revisions), nextRevision] }
    : { schemaVersion: ATLAS_AUTHORED_ASSOCIATION_SCHEMA, id: payload.associationId, projectId: project.id, source: 'author', revisions: [nextRevision] };
  budget(next); return next;
}

export function rebindAtlasAuthoredAssociationsForProjectCopy(atlas, sourceProjectId, projectId) {
  if (!atlas || typeof atlas !== 'object' || !own(atlas, 'authoredAssociations')) return atlas;
  if (!id(sourceProjectId) || !id(projectId) || sourceProjectId === projectId) fail('SCHEMA_UNSUPPORTED');
  const records = readAtlasAuthoredAssociationRecords(atlas, sourceProjectId), next = clone(atlas);
  // IDs, provenance and the complete ordered revision bodies are project-local
  // and immutable. COPY changes only the enclosing owning project identity.
  for (const id of Object.keys(records)) next.authoredAssociations[id].projectId = projectId;
  return next;
}

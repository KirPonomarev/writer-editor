import { hashCanonicalValue } from '../../core/browser-safe-hash.mjs';
import { isGraphemeBoundaryAligned } from '../../core/runtime.mjs';
import { readAtlasAuthoredAssociationRecords, isAtlasAuthoredAssociationEvidenceCurrent, areAtlasAssociationEntitiesCurrent } from '../../core/atlas-authored-associations-v1.mjs';
import { createAtlasBookSnapshot } from '../../core/atlas-book-snapshot-v1.mjs';
import { compileAtlasAssociations, queryAtlasAssociations } from '../../core/atlas-associations-v1.mjs';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const clone = value => JSON.parse(JSON.stringify(value));
const schemaVersion = 'derived.atlas.authoredAssociations.v1';
const authority = Object.freeze({ readOnly: true, productMutation: false, storageMutation: false, automaticRelationCreation: false });

function readAuthoredAssociationProject(coreState, projectId) {
  const project = coreState?.data?.projects?.[projectId];
  if (!project || project.id !== projectId || project.revisionScope !== 'WHOLE_PROJECT') {
    throw new Error('E_ATLAS_ASSOCIATION_PROJECT_UNAVAILABLE');
  }
  return project;
}

function readAuthoredAssociationSnapshot(project, projectId) {
  const records = readAtlasAuthoredAssociationRecords(project.atlas, projectId), sceneOrder = project.sceneOrder;
  const snapshot = createAtlasBookSnapshot({ projectId, projectRevisionId: project.projectRevisionId, manifestRevision: project.manifestRevision,
    sceneOrder, sceneRevisionsById: Object.fromEntries(sceneOrder.map(id => [id, project.scenes[id]?.sceneRevision])),
    dependenciesBySceneId: Object.fromEntries(sceneOrder.map(id => [id, [project.scenes[id]?.sceneRevision]])) });
  const input = [], rows = Object.values(records).sort((a, b) => a.id.localeCompare(b.id, 'en')).map(record => {
    const latest = record.revisions.at(-1), source = latest.source, scene = project.scenes[source.sceneId];
    const current = isAtlasAuthoredAssociationEvidenceCurrent(source, scene, isGraphemeBoundaryAligned);
    const entityCurrent = areAtlasAssociationEntitiesCurrent(project.atlas.entities, latest);
    if (current && entityCurrent && latest.status === 'active') {
      const scope = { kind: latest.scopeKind, projectId, projectRevisionId: project.projectRevisionId,
        ...(latest.scopeKind !== 'BOOK' ? { sceneId: source.sceneId, sceneRevision: scene.sceneRevision } : {}),
        ...(latest.scopeKind === 'FRAGMENT' ? { anchorLineageId: source.anchorId, startOffset: source.startOffset, endOffset: source.endOffset } : {}) };
      input.push({ associationId: record.id, associationKind: latest.associationKind.trim().normalize('NFC'), direction: latest.direction,
        sourceEntityId: latest.sourceEntityId, targetEntityId: latest.targetEntityId, scope, evidenceAnchorIds: [source.anchorId] });
    }
    return { associationId: record.id, recordHash: hashCanonicalValue(record), revisionCount: record.revisions.length, latest: clone(latest),
      sourceState: current ? 'current' : scene ? 'stale' : 'missing', entityState: entityCurrent ? 'current' : 'unavailable', sourceName: project.atlas.entities[latest.sourceEntityId]?.name || latest.sourceEntityId,
      targetName: project.atlas.entities[latest.targetEntityId]?.name || latest.targetEntityId, sceneTitle: scene?.title || source.sceneId };
  });
  const currentSnapshotIdentity = Object.fromEntries(['projectId','projectRevisionId','manifestRevision','orderDigest','dependencyDigest'].map(key => [key, snapshot[key]]));
  const compiled = compileAtlasAssociations({ snapshot, currentSnapshotIdentity, associations: input });
  return { snapshot, currentSnapshotIdentity, compiled, rows, currentAssociationCount: input.length };
}

// The dossier retains the history universe. Only independently current,
// active author records enter the unchanged WP500 compiler.
export function deriveAtlasAuthoredAssociations({ coreState, params = {} }) {
  const projectId = params.projectId;
  try {
    const project = readAuthoredAssociationProject(coreState, projectId);
    const { snapshot, compiled, rows, currentAssociationCount } = readAuthoredAssociationSnapshot(project, projectId);
    const sceneOrder = project.sceneOrder;
    const offset = params.offset === undefined ? 0 : params.offset, limit = params.limit === undefined ? 32 : params.limit;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 32
      || params.selectedAssociationId !== undefined && typeof params.selectedAssociationId !== 'string') throw new Error('E_ATLAS_ASSOCIATION_QUERY_INVALID');
    const page = rows.slice(offset, offset + limit), selected = params.selectedAssociationId ? rows.find(row => row.associationId === params.selectedAssociationId) || null : null;
    const value = { schemaVersion, state: rows.length ? 'ready' : 'empty', projectId, manifestRevision: project.manifestRevision,
      projectRevisionId: project.projectRevisionId, total: rows.length, offset, limit, complete: offset === 0 && page.length === rows.length,
      rows: page, selected, entities: Object.entries(project.atlas.entities).filter(([id, entity]) => entity?.id === id && entity.mergeState !== 'MERGED')
        .map(([entityId, entity]) => ({ entityId, name: typeof entity.name === 'string' ? entity.name : entityId })).sort((a, b) => a.entityId.localeCompare(b.entityId, 'en')),
      sourceScenes: sceneOrder.map(sceneId => ({ sceneId, sceneRevision: project.scenes[sceneId].sceneRevision, sceneTextHash: hashCanonicalValue(project.scenes[sceneId].text) })),
      currentAssociationCount, compiledProjectionDigest: compiled.projectionDigest, snapshotId: snapshot.snapshotId,
      authority, sourceUniverseIsNotApplicabilityQuery: true };
    return freeze({ ...value, projectionHash: hashCanonicalValue(value) });
  } catch (error) {
    return freeze({ schemaVersion, state: 'unavailable', projectId, reason: error.code || error.message || 'E_ATLAS_ASSOCIATION_UNAVAILABLE',
      rows: [], selected: null, entities: [], sourceScenes: [], total: 0, offset: 0, limit: 32, complete: false, authority });
  }
}

const applicabilitySchema = 'derived.atlas.authoredAssociationApplicability.v1';

export function deriveAtlasAuthoredAssociationApplicability({ coreState, projectId, sourceScope, limit }) {
  try {
    const project = readAuthoredAssociationProject(coreState, projectId);
    const { kind, sceneId, sceneTextHash, startOffset, endOffset } = sourceScope;
    const scene = Object.hasOwn(project.scenes, sceneId) ? project.scenes[sceneId] : null;
    if (kind !== 'BOOK' && (!scene || hashCanonicalValue(scene.text) !== sceneTextHash)) {
      throw new Error('ATLAS_AUTHORED_ASSOCIATION_SCOPE_SOURCE_CHANGED');
    }
    if (kind === 'FRAGMENT' && !isGraphemeBoundaryAligned(scene.text, startOffset, endOffset)) {
      throw new Error('ATLAS_AUTHORED_ASSOCIATION_SCOPE_RANGE_INVALID');
    }

    const { snapshot, currentSnapshotIdentity, compiled, rows } = readAuthoredAssociationSnapshot(project, projectId);
    const focusScope = {
      kind: kind === 'BOOK' ? 'BOOK' : 'SCENE',
      projectId,
      projectRevisionId: project.projectRevisionId,
      ...(kind === 'BOOK' ? {} : { sceneId, sceneRevision: scene.sceneRevision }),
    };
    const inherited = queryAtlasAssociations({ snapshot, currentSnapshotIdentity, projection: compiled, focusScope });
    const applicable = new Set(inherited.applicableAssociations.map(row => row.associationId));
    if (kind === 'FRAGMENT') {
      // An explicit saved selection can be inside more than one verified
      // author anchor. Each matching record keeps its own lineage and origin.
      for (const { associationId, scope } of compiled.associations) {
        if (scope.kind === 'FRAGMENT' && scope.sceneId === sceneId && scope.sceneRevision === scene.sceneRevision
          && scope.startOffset <= startOffset && endOffset <= scope.endOffset) applicable.add(associationId);
      }
    }

    const page = rows.filter(row => applicable.has(row.associationId)).slice(0, limit)
      .map(row => ({ ...row, sceneRevision: project.scenes[row.latest.source.sceneId].sceneRevision }));
    const omittedCount = applicable.size - page.length;
    const value = {
      schemaVersion: applicabilitySchema, state: applicable.size ? 'ready' : 'empty',
      projectId, projectRevisionId: project.projectRevisionId, manifestRevision: project.manifestRevision,
      snapshotId: snapshot.snapshotId, sourceScope, total: applicable.size, omittedCount,
      complete: omittedCount === 0, rows: page, authority,
    };
    return freeze({ ...value, projectionHash: hashCanonicalValue(value) });
  } catch (error) {
    return freeze({
      schemaVersion: applicabilitySchema, state: 'unavailable', projectId, sourceScope,
      reason: error.code || error.message || 'ATLAS_AUTHORED_ASSOCIATION_UNAVAILABLE',
      rows: [], total: 0, omittedCount: 0, complete: false, authority,
    });
  }
}

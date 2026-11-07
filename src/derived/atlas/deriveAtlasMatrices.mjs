import { createDerivedError, deriveView, hashCanonicalValue } from '../deriveView.mjs';
import { deriveAtlasAuthoredAssociationApplicability } from './deriveAtlasAuthoredAssociations.mjs';
import { deriveAtlasObservationAggregate } from './deriveAtlasObservationAggregate.mjs';
import { buildAtlasTemporalContinuityFromObservationAggregate, deriveAtlasTemporalContinuity } from './deriveAtlasTemporalContinuity.mjs';
import {
  ATLAS_ENTITY_SCENE_MATRIX_SCHEMA_VERSION,
  ATLAS_MATRICES_SCHEMA_VERSION,
  ATLAS_MATRICES_SURFACE_MANIFEST_VERSION,
  ATLAS_MATRIX_ACCESSIBILITY_CONTRACT_SCHEMA_VERSION,
  ATLAS_RELATION_MATRIX_SCHEMA_VERSION,
  sortAtlasEntitySceneListRows,
  sortAtlasMatrixEntities,
  sortAtlasRelationListRows,
} from './atlasMatricesTypes.mjs';

const VIEW_ID = 'derived.atlas.matrices.v1';
const PROVIDER_ID = 'query.atlasMatrices';
const SURFACE_ID = 'surface.atlas.matrices';
const RIGHT_RAIL_SLOT_ID = 'rightRail.context.atlas.matrices';
const DEFAULT_AXIS_LIMIT = 8;
const MAX_AXIS_LIMIT = 12;
const DEFAULT_LIST_LIMIT = 24;
const MAX_LIST_LIMIT = 48;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function plainString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLimit(value, fallback, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }));
}

function isAtlasMatricesCapabilityEnabled(snapshot) {
  if (!isPlainObject(snapshot)) return true;
  if (snapshot['atlas.matrices'] === false) return false;
  const capabilities = isPlainObject(snapshot.capabilities) ? snapshot.capabilities : {};
  if (capabilities['atlas.matrices'] === false) return false;
  if (capabilities.atlasMatrices === false) return false;
  if (isPlainObject(capabilities.atlas) && capabilities.atlas.matrices === false) return false;
  return true;
}

function buildSurfaceManifest() {
  return {
    schemaVersion: ATLAS_MATRICES_SURFACE_MANIFEST_VERSION,
    surfaceId: SURFACE_ID,
    providerId: PROVIDER_ID,
    host: 'rightRail',
    slotId: RIGHT_RAIL_SLOT_ID,
    contributionKind: 'readOnlyProjection',
    allowedStateClasses: ['PROJECT_STATE', 'DERIVED_STATE', 'TRANSIENT_STATE'],
    commandAuthority: 'none',
    productMutation: false,
    storageAuthority: false,
    fallback: {
      empty: 'ATLAS_MATRICES_EMPTY',
      unavailable: 'ATLAS_MATRICES_UNAVAILABLE',
    },
  };
}

function buildAuthority() {
  return {
    sourceOfTruth: [
      'derived.atlas.observationAggregate.v1',
      'derived.atlas.temporalContinuity.v1',
    ],
    readModelOnly: true,
    commandAuthority: 'none',
    projectTruthMutation: false,
    storageMutation: false,
    networkMutation: false,
    rendererMutation: false,
    heavySurface: false,
    heatmapColorSystem: false,
  };
}

function buildAccessibilityContract() {
  return {
    schemaVersion: ATLAS_MATRIX_ACCESSIBILITY_CONTRACT_SCHEMA_VERSION,
    tableFirst: true,
    equivalentListParity: true,
    keyboardNavigation: {
      focusModel: 'roving-gridcell-tabindex',
      supportedKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'],
      wrap: false,
    },
    semantics: {
      matrixRole: 'grid',
      rowRole: 'row',
      columnHeaderRole: 'columnheader',
      rowHeaderElement: 'th',
      cellRole: 'gridcell',
    },
    largeDataClipping: {
      announced: true,
      neverVirtualizedSilently: true,
    },
  };
}

function emptyMatrixState(projectId, reason = '') {
  return {
    schemaVersion: ATLAS_MATRICES_SCHEMA_VERSION,
    state: reason ? 'unavailable' : 'empty',
    unavailableReason: reason,
    surfaceManifest: buildSurfaceManifest(),
    authority: buildAuthority(),
    projectId,
    summary: {
      entityCount: 0,
      sceneCount: 0,
      entitySceneCellCount: 0,
      relationCellCount: 0,
      entitySceneListRowCount: 0,
      relationListRowCount: 0,
      omittedEntityCount: 0,
      omittedSceneCount: 0,
      omittedEntitySceneCellCount: 0,
      omittedRelationCellCount: 0,
      matrixHash: '',
      invalidationKey: '',
    },
    entitySceneMatrix: emptyEntitySceneMatrix(),
    relationMatrix: emptyRelationMatrix(),
    listParity: {
      entitySceneRows: [],
      relationRows: [],
      omittedEntitySceneRowCount: 0,
      omittedRelationRowCount: 0,
    },
    accessibilityContract: buildAccessibilityContract(),
    largeProjectBudgetProof: buildLargeProjectBudgetProof({}),
    evidence: buildEvidence({ matrixHash: '', sourceHashes: {}, fullReport: reason ? 'unavailable' : 'notRequired' }),
  };
}

function emptyEntitySceneMatrix() {
  return {
    schemaVersion: ATLAS_ENTITY_SCENE_MATRIX_SCHEMA_VERSION,
    state: 'empty',
    rowAxis: emptyAxis('entity'),
    columnAxis: emptyAxis('scene'),
    rows: [],
  };
}

function emptyRelationMatrix() {
  return {
    schemaVersion: ATLAS_RELATION_MATRIX_SCHEMA_VERSION,
    state: 'empty',
    rowAxis: emptyAxis('entity'),
    columnAxis: emptyAxis('entity'),
    rows: [],
  };
}

function emptyAxis(kind) {
  return {
    kind,
    totalCount: 0,
    visibleCount: 0,
    omittedCount: 0,
    clipped: false,
  };
}

function buildEvidence({ matrixHash, sourceHashes, fullReport }) {
  return {
    schemaVersion: 'derived.atlas.matrices.evidence.v1',
    sourceHashes,
    matrixHash,
    designAdvisory: {
      applied: true,
      source: 'design-receipts',
      runtimeMetadataIncluded: false,
      readinessToken: false,
      externalReportAvailable: fullReport !== 'unavailable',
    },
  };
}

function buildLargeProjectBudgetProof({
  entityCount = 0,
  sceneCount = 0,
  rowLimit = DEFAULT_AXIS_LIMIT,
  columnLimit = DEFAULT_AXIS_LIMIT,
  listLimit = DEFAULT_LIST_LIMIT,
  relationListTotal = 0,
  entitySceneListTotal = 0,
} = {}) {
  const visibleEntityRows = Math.min(entityCount, rowLimit);
  const visibleSceneColumns = Math.min(sceneCount, columnLimit);
  const visibleRelationCells = visibleEntityRows * visibleEntityRows;
  const totalRelationCells = entityCount * entityCount;
  const visibleEntitySceneCells = visibleEntityRows * visibleSceneColumns;
  const totalEntitySceneCells = entityCount * sceneCount;
  return {
    schemaVersion: 'derived.atlas.matrixLargeProjectBudgetProof.v1',
    rowLimit,
    columnLimit,
    listLimit,
    totalEntityRows: entityCount,
    totalSceneColumns: sceneCount,
    visibleEntityRows,
    visibleSceneColumns,
    totalEntitySceneCells,
    visibleEntitySceneCells,
    omittedEntitySceneCells: Math.max(0, totalEntitySceneCells - visibleEntitySceneCells),
    totalRelationCells,
    visibleRelationCells,
    omittedRelationCells: Math.max(0, totalRelationCells - visibleRelationCells),
    totalEntitySceneListRows: entitySceneListTotal,
    visibleEntitySceneListRows: Math.min(entitySceneListTotal, listLimit),
    omittedEntitySceneListRows: Math.max(0, entitySceneListTotal - listLimit),
    totalRelationListRows: relationListTotal,
    visibleRelationListRows: Math.min(relationListTotal, listLimit),
    omittedRelationListRows: Math.max(0, relationListTotal - listLimit),
    clippingHonest: entityCount > rowLimit || sceneCount > columnLimit || entitySceneListTotal > listLimit || relationListTotal > listLimit,
  };
}

function entityNameMap(temporal) {
  return new Map((Array.isArray(temporal?.entityAppearances) ? temporal.entityAppearances : [])
    .map((entity) => [plainString(entity.entityId), plainString(entity.name) || plainString(entity.entityId)]));
}

function sceneTitleMap(temporal) {
  return new Map((Array.isArray(temporal?.sceneOrder) ? temporal.sceneOrder : [])
    .map((scene) => [plainString(scene.sceneId), plainString(scene.sceneTitle) || plainString(scene.sceneId)]));
}

function buildEntityScenePacket({ temporal, rowLimit, columnLimit, listLimit }) {
  const entities = sortAtlasMatrixEntities((Array.isArray(temporal?.entityAppearances) ? temporal.entityAppearances : [])
    .map((entity) => ({
      entityId: plainString(entity.entityId),
      name: plainString(entity.name) || plainString(entity.entityId),
      entityKind: plainString(entity.entityKind) || 'entity',
      appearanceCount: Number(entity.appearanceCount || 0),
      sceneCount: Number(entity.sceneCount || 0),
      appearances: Array.isArray(entity.appearances) ? entity.appearances : [],
    })));
  const scenes = (Array.isArray(temporal?.sceneOrder) ? temporal.sceneOrder : []).map((scene) => ({
    sceneId: plainString(scene.sceneId),
    sceneOrdinal: Number(scene.sceneOrdinal || 0),
    sceneTitle: plainString(scene.sceneTitle) || plainString(scene.sceneId),
  }));
  const visibleEntities = entities.slice(0, rowLimit);
  const visibleScenes = scenes.slice(0, columnLimit);
  const visibleSceneIds = new Set(visibleScenes.map((scene) => scene.sceneId));
  const listRows = [];
  const rows = visibleEntities.map((entity, rowIndex) => {
    const byScene = new Map();
    for (const appearance of entity.appearances) {
      const sceneId = plainString(appearance.sceneId);
      if (!sceneId) continue;
      if (!byScene.has(sceneId)) byScene.set(sceneId, []);
      byScene.get(sceneId).push(appearance);
    }
    const cells = visibleScenes.map((scene, columnIndex) => {
      const refs = Array.isArray(byScene.get(scene.sceneId)) ? byScene.get(scene.sceneId) : [];
      const evidenceAnchorIds = uniqueSorted(refs.map((ref) => plainString(ref.evidenceAnchorId)));
      const observationIds = uniqueSorted(refs.map((ref) => plainString(ref.observationId)));
      return {
        entityId: entity.entityId,
        sceneId: scene.sceneId,
        sceneOrdinal: scene.sceneOrdinal,
        rowIndex,
        columnIndex,
        appearanceCount: refs.length,
        evidenceAnchorIds,
        observationIds,
        hasEvidence: evidenceAnchorIds.length > 0,
        ariaLabel: `${entity.name} in ${scene.sceneTitle}: ${refs.length} observations`,
      };
    });
    for (const [sceneId, refs] of byScene.entries()) {
      const scene = scenes.find((item) => item.sceneId === sceneId);
      if (!scene || refs.length < 1) continue;
      listRows.push({
        entityId: entity.entityId,
        entityName: entity.name,
        sceneId,
        sceneTitle: scene.sceneTitle,
        sceneOrdinal: scene.sceneOrdinal,
        appearanceCount: refs.length,
        evidenceAnchorIds: uniqueSorted(refs.map((ref) => plainString(ref.evidenceAnchorId))),
        visibleInMatrix: visibleSceneIds.has(sceneId) && rowIndex < visibleEntities.length,
      });
    }
    return {
      entityId: entity.entityId,
      name: entity.name,
      entityKind: entity.entityKind,
      appearanceCount: entity.appearanceCount,
      sceneCount: entity.sceneCount,
      rowIndex,
      cells,
    };
  });
  const sortedListRows = sortAtlasEntitySceneListRows(listRows);
  return {
    matrix: {
      schemaVersion: ATLAS_ENTITY_SCENE_MATRIX_SCHEMA_VERSION,
      state: entities.length > 0 && scenes.length > 0 ? 'ready' : 'empty',
      rowAxis: axis('entity', entities.length, visibleEntities.length),
      columnAxis: axis('scene', scenes.length, visibleScenes.length),
      columns: visibleScenes,
      rows,
    },
    listRows: sortedListRows.slice(0, listLimit),
    totalListRowCount: sortedListRows.length,
  };
}

function buildRelationPacket({ temporal, rowLimit, listLimit }) {
  const entities = sortAtlasMatrixEntities((Array.isArray(temporal?.entityAppearances) ? temporal.entityAppearances : [])
    .map((entity) => ({
      entityId: plainString(entity.entityId),
      name: plainString(entity.name) || plainString(entity.entityId),
      entityKind: plainString(entity.entityKind) || 'entity',
      appearanceCount: Number(entity.appearanceCount || 0),
      sceneCount: Number(entity.sceneCount || 0),
    })));
  const visibleEntities = entities.slice(0, rowLimit);
  const names = entityNameMap(temporal);
  const sceneTitles = sceneTitleMap(temporal);
  const pairs = new Map();
  const listRows = sortAtlasRelationListRows((Array.isArray(temporal?.cooccurrences) ? temporal.cooccurrences : [])
    .map((relation) => {
      const leftEntityId = plainString(relation.leftEntityId);
      const rightEntityId = plainString(relation.rightEntityId);
      const key = pairKey(leftEntityId, rightEntityId);
      const row = {
        pairId: plainString(relation.pairId),
        leftEntityId,
        rightEntityId,
        leftName: names.get(leftEntityId) || leftEntityId,
        rightName: names.get(rightEntityId) || rightEntityId,
        sceneCount: Number(relation.sceneCount || 0),
        occurrenceCount: Number(relation.occurrenceCount || 0),
        sceneIds: uniqueSorted(Array.isArray(relation.sceneIds) ? relation.sceneIds : []),
        sceneTitles: uniqueSorted((Array.isArray(relation.sceneIds) ? relation.sceneIds : []).map((sceneId) => sceneTitles.get(sceneId) || sceneId)),
        evidenceAnchorIds: uniqueSorted(Array.isArray(relation.evidenceAnchorIds) ? relation.evidenceAnchorIds : []),
      };
      pairs.set(key, row);
      return row;
    }));
  const rows = visibleEntities.map((entity, rowIndex) => ({
    entityId: entity.entityId,
    name: entity.name,
    entityKind: entity.entityKind,
    rowIndex,
    cells: visibleEntities.map((columnEntity, columnIndex) => {
      const pair = entity.entityId === columnEntity.entityId ? null : pairs.get(pairKey(entity.entityId, columnEntity.entityId));
      return {
        rowEntityId: entity.entityId,
        columnEntityId: columnEntity.entityId,
        rowIndex,
        columnIndex,
        pairId: pair?.pairId || '',
        occurrenceCount: pair?.occurrenceCount || 0,
        sceneCount: pair?.sceneCount || 0,
        evidenceAnchorIds: Array.isArray(pair?.evidenceAnchorIds) ? pair.evidenceAnchorIds : [],
        ariaLabel: entity.entityId === columnEntity.entityId
          ? `${entity.name} self relation: not applicable`
          : `${entity.name} and ${columnEntity.name}: ${pair?.occurrenceCount || 0} co-occurrences in ${pair?.sceneCount || 0} scenes`,
      };
    }),
  }));
  return {
    matrix: {
      schemaVersion: ATLAS_RELATION_MATRIX_SCHEMA_VERSION,
      state: entities.length > 1 ? 'ready' : 'empty',
      rowAxis: axis('entity', entities.length, visibleEntities.length),
      columnAxis: axis('entity', entities.length, visibleEntities.length),
      columns: visibleEntities,
      rows,
    },
    listRows: listRows.slice(0, listLimit),
    totalListRowCount: listRows.length,
  };
}

function axis(kind, totalCount, visibleCount) {
  return {
    kind,
    totalCount,
    visibleCount,
    omittedCount: Math.max(0, totalCount - visibleCount),
    clipped: totalCount > visibleCount,
  };
}

function pairKey(leftEntityId, rightEntityId) {
  return [leftEntityId, rightEntityId].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' })).join('\u0000');
}

function buildMatrices({ aggregate, temporal, rowLimit, columnLimit, listLimit, invalidationKey }) {
  const entityScene = buildEntityScenePacket({ temporal, rowLimit, columnLimit, listLimit });
  const relation = buildRelationPacket({ temporal, rowLimit, listLimit });
  const entityCount = temporal.summary?.entityCount || entityScene.matrix.rowAxis.totalCount;
  const sceneCount = temporal.summary?.sceneCount || entityScene.matrix.columnAxis.totalCount;
  const budgetProof = buildLargeProjectBudgetProof({
    entityCount,
    sceneCount,
    rowLimit,
    columnLimit,
    listLimit,
    entitySceneListTotal: entityScene.totalListRowCount,
    relationListTotal: relation.totalListRowCount,
  });
  const matrixHash = hashCanonicalValue({
    projectId: aggregate.projectId,
    aggregateHash: aggregate.summary?.aggregateHash || '',
    temporalHash: temporal.summary?.temporalHash || '',
    entitySceneMatrix: entityScene.matrix,
    relationMatrix: relation.matrix,
    listParity: {
      entitySceneRows: entityScene.listRows,
      relationRows: relation.listRows,
    },
    budgetProof,
  });
  return {
    schemaVersion: ATLAS_MATRICES_SCHEMA_VERSION,
    state: entityCount > 0 ? 'ready' : 'empty',
    unavailableReason: '',
    surfaceManifest: buildSurfaceManifest(),
    authority: buildAuthority(),
    projectId: aggregate.projectId,
    summary: {
      entityCount,
      sceneCount,
      entitySceneCellCount: budgetProof.visibleEntitySceneCells,
      relationCellCount: budgetProof.visibleRelationCells,
      entitySceneListRowCount: entityScene.totalListRowCount,
      relationListRowCount: relation.totalListRowCount,
      omittedEntityCount: entityScene.matrix.rowAxis.omittedCount,
      omittedSceneCount: entityScene.matrix.columnAxis.omittedCount,
      omittedEntitySceneCellCount: budgetProof.omittedEntitySceneCells,
      omittedRelationCellCount: budgetProof.omittedRelationCells,
      matrixHash,
      invalidationKey,
    },
    entitySceneMatrix: entityScene.matrix,
    relationMatrix: relation.matrix,
    listParity: {
      entitySceneRows: entityScene.listRows,
      relationRows: relation.listRows,
      omittedEntitySceneRowCount: Math.max(0, entityScene.totalListRowCount - entityScene.listRows.length),
      omittedRelationRowCount: Math.max(0, relation.totalListRowCount - relation.listRows.length),
    },
    accessibilityContract: buildAccessibilityContract(),
    largeProjectBudgetProof: budgetProof,
    evidence: buildEvidence({
      matrixHash,
      sourceHashes: {
        aggregateHash: aggregate.summary?.aggregateHash || '',
        temporalHash: temporal.summary?.temporalHash || '',
      },
      fullReport: 'unavailable',
    }),
  };
}

export function normalizeAtlasMatricesSourceScope(value) {
  if (value === undefined) return { ok: true, value: { kind: 'BOOK' } };
  const invalid = () => ({ ok: false, error: {
    code: 'E_ATLAS_MATRICES_SCOPE_INVALID', reason: 'ATLAS_MATRICES_SCOPE_INVALID', op: VIEW_ID,
  } });
  if (!isPlainObject(value) || !['BOOK', 'SCENE', 'FRAGMENT'].includes(value.kind)) return invalid();
  const keys = value.kind === 'BOOK' ? ['kind'] : ['kind', 'sceneId', 'sceneTextHash',
    ...(value.kind === 'FRAGMENT' ? ['startOffset', 'endOffset'] : [])];
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) return invalid();
  if (value.kind === 'BOOK') return { ok: true, value: { kind: 'BOOK' } };
  if (typeof value.sceneId !== 'string' || !value.sceneId || value.sceneId.length > 256 || value.sceneId.trim() !== value.sceneId
    || typeof value.sceneTextHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sceneTextHash)) return invalid();
  const scope = { kind: value.kind, sceneId: value.sceneId, sceneTextHash: value.sceneTextHash };
  if (scope.kind === 'FRAGMENT') {
    if (!Number.isSafeInteger(value.startOffset) || !Number.isSafeInteger(value.endOffset)
      || value.startOffset < 0 || value.endOffset <= value.startOffset) return invalid();
    scope.startOffset = value.startOffset;
    scope.endOffset = value.endOffset;
  }
  return { ok: true, value: scope };
}

function scopeMatrixSources({ coreState, aggregate, temporal, sourceScope, invalidationKey }) {
  const scenes = coreState?.data?.projects?.[aggregate.projectId]?.scenes;
  if (!isPlainObject(scenes) || !Object.hasOwn(scenes, sourceScope.sceneId)
    || !isPlainObject(scenes[sourceScope.sceneId]) || typeof scenes[sourceScope.sceneId].text !== 'string') {
    throw createDerivedError('E_ATLAS_MATRICES_SCOPE_SCENE_NOT_FOUND', VIEW_ID, 'ATLAS_MATRICES_SCOPE_SCENE_NOT_FOUND');
  }
  const text = scenes[sourceScope.sceneId].text;
  if (hashCanonicalValue(text) !== sourceScope.sceneTextHash) {
    throw createDerivedError('E_ATLAS_MATRICES_SCOPE_SOURCE_CHANGED', VIEW_ID, 'ATLAS_MATRICES_SCOPE_SOURCE_CHANGED');
  }
  if (sourceScope.kind === 'FRAGMENT') {
    const splitsSurrogate = offset => offset > 0 && offset < text.length
      && text.charCodeAt(offset - 1) >= 0xd800 && text.charCodeAt(offset - 1) <= 0xdbff
      && text.charCodeAt(offset) >= 0xdc00 && text.charCodeAt(offset) <= 0xdfff;
    if (sourceScope.endOffset > text.length || splitsSurrogate(sourceScope.startOffset) || splitsSurrogate(sourceScope.endOffset)) {
      throw createDerivedError('E_ATLAS_MATRICES_SCOPE_RANGE_INVALID', VIEW_ID, 'ATLAS_MATRICES_SCOPE_RANGE_INVALID');
    }
  }
  const sceneOrder = temporal.sceneOrder.filter(scene => scene.sceneId === sourceScope.sceneId);
  if (sceneOrder.length !== 1) {
    throw createDerivedError('E_ATLAS_MATRICES_SCOPE_SCENE_NOT_FOUND', VIEW_ID, 'ATLAS_MATRICES_SCOPE_SCENE_NOT_FOUND');
  }
  const observations = aggregate.observations.filter(observation => observation.sceneId === sourceScope.sceneId
    && (sourceScope.kind !== 'FRAGMENT'
      || (observation.startOffset >= sourceScope.startOffset && observation.endOffset <= sourceScope.endOffset)));
  // This is a derived subset, never a rewritten Core project or author record.
  const scopedAggregate = { projectId: aggregate.projectId, entities: aggregate.entities, observations,
    summary: { aggregateHash: hashCanonicalValue({ parentAggregateHash: aggregate.summary.aggregateHash,
      sourceScope, observationIds: observations.map(observation => observation.observationId) }) } };
  return { aggregate: scopedAggregate, temporal: buildAtlasTemporalContinuityFromObservationAggregate({
    aggregate: scopedAggregate, sceneOrder, invalidationKey,
  }) };
}

export function deriveAtlasMatrices(input = {}) {
  const projectId = normalizeString(input?.params?.projectId);
  const languageCode = normalizeString(input?.params?.languageCode);
  const rowLimit = normalizeLimit(input?.params?.rowLimit, DEFAULT_AXIS_LIMIT, MAX_AXIS_LIMIT);
  const columnLimit = normalizeLimit(input?.params?.columnLimit, DEFAULT_AXIS_LIMIT, MAX_AXIS_LIMIT);
  const listLimit = normalizeLimit(input?.params?.listLimit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  if (!projectId) {
    return {
      ok: false,
      error: {
        code: 'E_ATLAS_PROJECT_ID_REQUIRED',
        op: VIEW_ID,
        reason: 'PROJECT_ID_REQUIRED',
      },
    };
  }
  const { includeAuthoredAssociations, ...matrixParams } = input.params || {};
  const explicitScope = Object.hasOwn(matrixParams, 'sourceScope');
  const scopeResult = normalizeAtlasMatricesSourceScope(input?.params?.sourceScope);
  if (!scopeResult.ok) return scopeResult;

  const result = deriveView({
    viewId: VIEW_ID,
    coreState: input.coreState,
    params: {
      ...matrixParams,
      projectId,
      languageCode,
      rowLimit,
      columnLimit,
      listLimit,
      ...(explicitScope ? { sourceScope: scopeResult.value } : {}),
    },
    capabilitySnapshot: input.capabilitySnapshot,
    derive: ({ coreState, params, capabilitySnapshot, meta }) => {
      if (!isAtlasMatricesCapabilityEnabled(capabilitySnapshot)) {
        throw createDerivedError(
          'E_CAPABILITY_DISABLED_FOR_COMMAND',
          VIEW_ID,
          'ATLAS_MATRICES_DISABLED',
          { capabilityId: 'atlas.matrices' },
        );
      }
      const aggregate = deriveAtlasObservationAggregate({
        coreState,
        params: { projectId: params.projectId, languageCode: params.languageCode },
        capabilitySnapshot,
      });
      if (!aggregate.ok) {
        throw createDerivedError(
          aggregate.error?.code || 'E_ATLAS_OBSERVATION_AGGREGATE_UNAVAILABLE',
          VIEW_ID,
          aggregate.error?.reason || 'ATLAS_OBSERVATION_AGGREGATE_UNAVAILABLE',
          aggregate.error?.details || {},
        );
      }
      const temporal = deriveAtlasTemporalContinuity({
        coreState,
        params: { projectId: params.projectId, languageCode: params.languageCode },
        capabilitySnapshot,
      });
      if (!temporal.ok) {
        throw createDerivedError(
          temporal.error?.code || 'E_ATLAS_TEMPORAL_CONTINUITY_UNAVAILABLE',
          VIEW_ID,
          temporal.error?.reason || 'ATLAS_TEMPORAL_CONTINUITY_UNAVAILABLE',
          temporal.error?.details || {},
        );
      }
      const sourceScope = params.sourceScope || { kind: 'BOOK' };
      const sources = sourceScope.kind === 'BOOK' ? { aggregate: aggregate.value, temporal: temporal.value }
        : scopeMatrixSources({ coreState, aggregate: aggregate.value, temporal: temporal.value,
          sourceScope, invalidationKey: meta.invalidationKey });
      const value = sourceScope.kind === 'BOOK' && sources.temporal.summary.entityCount < 1
        ? emptyMatrixState(params.projectId) : buildMatrices({
        aggregate: sources.aggregate,
        temporal: sources.temporal,
        rowLimit: params.rowLimit,
        columnLimit: params.columnLimit,
        listLimit: params.listLimit,
        invalidationKey: meta.invalidationKey,
      });
      return explicitScope ? { ...value, sourceScope } : value;
    },
  });
  if (!result.ok || !explicitScope || includeAuthoredAssociations !== true) return result;

  const authoredAssociationApplicability = deriveAtlasAuthoredAssociationApplicability({
    coreState: input.coreState, projectId, sourceScope: { ...result.value.sourceScope }, limit: listLimit,
  });
  const value = { ...result.value, authoredAssociationApplicability };
  return { ...result, value, meta: { ...result.meta, outputHash: hashCanonicalValue(value) } };
}

export { VIEW_ID as ATLAS_MATRICES_VIEW_ID };

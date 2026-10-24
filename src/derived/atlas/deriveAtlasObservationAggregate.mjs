import { createDerivedError, deriveView, hashCanonicalValue } from '../deriveView.mjs';
import { deriveAtlasMentionIndex } from './deriveAtlasMentionIndex.mjs';
import {
  ATLAS_OBSERVATION_AGGREGATE_SCHEMA_VERSION,
  ATLAS_OBSERVATION_ANALYZER_ID,
  ATLAS_OBSERVATION_CANDIDATE_SCHEMA_VERSION,
  ATLAS_OBSERVATION_SCHEMA_VERSION,
  normalizeAtlasObservationLanguagePolicy,
  sortAtlasObservationCandidates,
  sortAtlasObservationEntityAggregates,
  sortAtlasObservations,
} from './atlasObservationTypes.mjs';

const VIEW_ID = 'derived.atlas.observationAggregate.v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function plainString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }));
}

function getProject(coreState, projectId) {
  const projects = isPlainObject(coreState?.data?.projects) ? coreState.data.projects : {};
  return isPlainObject(projects[projectId]) ? projects[projectId] : null;
}

function getEntity(project, entityId) {
  const entities = isPlainObject(project?.atlas?.entities) ? project.atlas.entities : {};
  return isPlainObject(entities[entityId]) ? entities[entityId] : {};
}

function isAtlasObservationAggregateCapabilityEnabled(snapshot) {
  if (!isPlainObject(snapshot)) return true;
  if (snapshot['atlas.observationAggregate'] === false) return false;
  const capabilities = isPlainObject(snapshot.capabilities) ? snapshot.capabilities : {};
  if (capabilities['atlas.observationAggregate'] === false) return false;
  if (capabilities.atlasObservationAggregate === false) return false;
  if (isPlainObject(capabilities.atlas) && capabilities.atlas.observationAggregate === false) return false;
  return true;
}

function evidenceAnchorId(anchor) {
  return isPlainObject(anchor) ? plainString(anchor.anchorId) : '';
}

function normalizeCandidate({ mention, languagePolicy }) {
  const evidenceAnchor = isPlainObject(mention.evidenceAnchor) ? mention.evidenceAnchor : null;
  const anchorId = evidenceAnchorId(evidenceAnchor);
  const candidateId = `atlas-candidate:${hashCanonicalValue({
    analyzerId: ATLAS_OBSERVATION_ANALYZER_ID,
    mentionId: plainString(mention.mentionId),
    anchorId,
  })}`;
  return {
    schemaVersion: ATLAS_OBSERVATION_CANDIDATE_SCHEMA_VERSION,
    candidateId,
    candidateKind: 'exactMention',
    analyzerId: ATLAS_OBSERVATION_ANALYZER_ID,
    mentionId: plainString(mention.mentionId),
    projectId: plainString(mention.projectId),
    sceneId: plainString(mention.sceneId),
    entityId: plainString(mention.entityId),
    termId: plainString(mention.termId),
    termKind: plainString(mention.termKind),
    aliasId: plainString(mention.aliasId),
    matchedText: plainString(mention.matchedText),
    startOffset: Number(mention.startOffset),
    endOffset: Number(mention.endOffset),
    evidenceRequired: true,
    evidenceAnchor,
    evidenceAnchorId: anchorId,
    languagePolicy,
  };
}

function normalizeObservation(candidate, suppressionLookup, reassignmentLookup) {
  const observationId = `atlas-observation:${hashCanonicalValue({
    candidateId: candidate.candidateId,
    evidenceAnchorId: candidate.evidenceAnchorId,
    entityId: candidate.entityId,
    sceneId: candidate.sceneId,
  })}`;
  const reassignment = reassignmentLookup.byObservationId.get(observationId)
    || reassignmentLookup.byMentionId.get(candidate.mentionId)
    || reassignmentLookup.byEvidenceAnchorId.get(candidate.evidenceAnchorId)
    || null;
  const suppression = suppressionLookup.byWitness.get(suppressionWitnessKey(candidate.evidenceAnchor)) || null;
  const originalEntityId = candidate.entityId;
  const entityId = reassignment ? reassignment.targetEntityId : originalEntityId;
  return {
    schemaVersion: ATLAS_OBSERVATION_SCHEMA_VERSION,
    observationId,
    candidateId: candidate.candidateId,
    mentionId: candidate.mentionId,
    observationKind: 'entityMention',
    analyzerId: candidate.analyzerId,
    projectId: candidate.projectId,
    sceneId: candidate.sceneId,
    entityId,
    originalEntityId,
    termId: candidate.termId,
    termKind: candidate.termKind,
    aliasId: candidate.aliasId,
    matchedText: candidate.matchedText,
    startOffset: candidate.startOffset,
    endOffset: candidate.endOffset,
    evidenceAnchor: candidate.evidenceAnchor,
    evidenceAnchorId: candidate.evidenceAnchorId,
    evidenceRequired: true,
    suppressionState: suppression ? 'SUPPRESSED' : 'ACTIVE',
    suppressionId: suppression ? suppression.id : '',
    suppressionReason: suppression ? suppression.reason : '',
    reassignmentState: reassignment ? 'REASSIGNED' : 'ORIGINAL',
    reassignmentId: reassignment ? reassignment.id : '',
    reassignmentReason: reassignment ? reassignment.reason : '',
    sourceEntityId: reassignment ? reassignment.sourceEntityId : originalEntityId,
    targetEntityId: reassignment ? reassignment.targetEntityId : entityId,
  };
}

function assertObservationEvidence(observations) {
  const missing = observations
    .filter((observation) => !isPlainObject(observation.evidenceAnchor) || !plainString(observation.evidenceAnchorId))
    .map((observation) => observation.observationId);
  if (missing.length > 0) {
    throw createDerivedError(
      'E_ATLAS_OBSERVATION_EVIDENCE_REQUIRED',
      VIEW_ID,
      'OBSERVATION_EVIDENCE_REQUIRED',
      { missingObservationIds: missing },
    );
  }
}

function aggregateEntities(project, observations) {
  const byEntity = new Map();
  for (const observation of observations) {
    if (!byEntity.has(observation.entityId)) byEntity.set(observation.entityId, []);
    byEntity.get(observation.entityId).push(observation);
  }
  return sortAtlasObservationEntityAggregates([...byEntity.entries()].map(([entityId, entityObservations]) => {
    const entity = getEntity(project, entityId);
    return {
      entityId,
      name: plainString(entity.name) || entityId,
      entityKind: plainString(entity.entityKind) || 'entity',
      candidateCount: entityObservations.length,
      observationCount: entityObservations.length,
      activeObservationCount: entityObservations.filter((observation) => observation.suppressionState !== 'SUPPRESSED').length,
      suppressedObservationCount: entityObservations.filter((observation) => observation.suppressionState === 'SUPPRESSED').length,
      sceneIds: uniqueSorted(entityObservations.map((observation) => observation.sceneId)),
      evidenceAnchorIds: uniqueSorted(entityObservations.map((observation) => observation.evidenceAnchorId)),
    };
  }));
}

function normalizeSuppression(value) {
  if (!isPlainObject(value)) return null;
  const id = plainString(value.id);
  const evidenceAnchor = isPlainObject(value.evidenceAnchor) ? value.evidenceAnchor : null;
  if (!id || value.suppressionKind !== 'observation.suppress' || !evidenceAnchor) return null;
  return {
    id,
    projectId: plainString(value.projectId),
    sceneId: plainString(value.sceneId),
    entityId: plainString(value.entityId),
    observationId: plainString(value.observationId),
    mentionId: plainString(value.mentionId),
    reason: plainString(value.reason),
    evidenceAnchor,
    evidenceAnchorId: evidenceAnchorId(evidenceAnchor),
  };
}

function boundSuppressionWitness(anchor, projectId, sceneId, entityId) {
  if (!isPlainObject(anchor) || anchor.schemaVersion !== 'atlas.evidenceAnchor.v1' || !plainString(anchor.anchorId)
    || !sceneId || !entityId || !Number.isSafeInteger(anchor.startOffset) || anchor.startOffset < 0
    || !Number.isSafeInteger(anchor.endOffset) || anchor.endOffset <= anchor.startOffset
    || typeof anchor.quote !== 'string' || anchor.quote.length !== anchor.endOffset - anchor.startOffset
    || anchor.quoteHash !== hashCanonicalValue(anchor.quote) || !/^[a-f0-9]{64}$/u.test(plainString(anchor.sceneTextHash))) return null;
  for (const [key, expected] of Object.entries({ projectId, sceneId, entityId })) {
    if (Object.hasOwn(anchor, key) && typeof anchor[key] !== 'string') return null;
    if (plainString(anchor[key]) && anchor[key] !== expected) return null;
  }
  return { ...anchor, projectId, sceneId, entityId };
}

function suppressionWitnessKey(anchor) {
  return anchor ? hashCanonicalValue(['projectId', 'sceneId', 'entityId', 'startOffset', 'endOffset', 'quote', 'quoteHash', 'sceneTextHash']
    .map(key => anchor[key])) : '';
}

function effectiveSuppressionWitness(project, projectId, source, records) {
  if (source.projectId !== projectId || !isPlainObject(project?.atlas?.entities?.[source.entityId]) || !project?.scenes?.[source.sceneId]) return null;
  const original = boundSuppressionWitness(source.evidenceAnchor, projectId, source.sceneId, source.entityId);
  if (!original) return null;
  let witness = original;
  if (records.length) {
    if (records.some(r => !Number.isSafeInteger(r.createdByCommandSeq) || !(r.createdByCommandSeq > source.createdByCommandSeq))) return null;
    const sequence = Math.max(...records.map(r => r.createdByCommandSeq)), latest = records.filter(r => r.createdByCommandSeq === sequence);
    if (latest.length !== 1) return null;
    const r = latest[0], stale = boundSuppressionWitness(r.staleEvidenceAnchor, projectId, source.sceneId, source.entityId);
    witness = boundSuppressionWitness(r.newEvidenceAnchor, projectId, plainString(r.newEvidenceAnchor?.sceneId), source.entityId);
    if (!stale || !witness || r.operationKind !== 'evidence.reattach' || r.projectId !== projectId
      || r.sourceRecordKind !== 'suppression' || r.sourceRecordId !== source.id || r.automaticReattachment !== false
      || r.sourceRecordHash !== hashCanonicalValue(source) || stale.anchorId !== original.anchorId
      || suppressionWitnessKey(stale) !== suppressionWitnessKey(original)) return null;
  }
  const scene = project?.scenes?.[witness.sceneId];
  if (!scene || typeof scene.text !== 'string' || scene.text.slice(witness.startOffset, witness.endOffset) !== witness.quote
    || hashCanonicalValue(scene.text) !== witness.sceneTextHash) return null;
  return witness;
}

function buildSuppressionLookup(project, projectId) {
  const suppressions = isPlainObject(project?.atlas?.suppressions) ? project.atlas.suppressions : {};
  const reattachments = Object.values(isPlainObject(project?.atlas?.evidenceReattachments) ? project.atlas.evidenceReattachments : {});
  const normalized = [], byWitness = new Map();
  for (const id of Object.keys(suppressions).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))) {
    const source = suppressions[id], suppression = normalizeSuppression(source);
    if (!suppression || source.id !== id) continue;
    normalized.push(suppression);
    // Keep every relevant record in chronology; an invalid latest record cannot revive older trust.
    const records = reattachments.filter(r => normalizeString(r?.sourceRecordKind) === 'suppression' && normalizeString(r?.sourceRecordId) === id);
    const witness = effectiveSuppressionWitness(project, projectId, source, records);
    if (witness) byWitness.set(suppressionWitnessKey(witness), suppression);
  }
  return { suppressions: normalized, byWitness };
}

function normalizeReassignment(value) {
  if (!isPlainObject(value)) return null;
  const id = plainString(value.id);
  const evidenceAnchor = isPlainObject(value.evidenceAnchor) ? value.evidenceAnchor : null;
  if (!id || value.operationKind !== 'observation.reassign' || !evidenceAnchor) return null;
  return {
    id,
    projectId: plainString(value.projectId),
    sceneId: plainString(value.sceneId),
    sourceEntityId: plainString(value.sourceEntityId),
    targetEntityId: plainString(value.targetEntityId),
    observationId: plainString(value.observationId),
    mentionId: plainString(value.mentionId),
    reason: plainString(value.reason),
    evidenceAnchor,
    evidenceAnchorId: evidenceAnchorId(evidenceAnchor),
  };
}

function buildReassignmentLookup(project) {
  const reassignments = isPlainObject(project?.atlas?.reassignments) ? project.atlas.reassignments : {};
  const normalized = Object.keys(reassignments)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    .map((reassignmentId) => normalizeReassignment(reassignments[reassignmentId]))
    .filter(Boolean);
  const byObservationId = new Map();
  const byMentionId = new Map();
  const byEvidenceAnchorId = new Map();
  for (const reassignment of normalized) {
    if (reassignment.observationId) byObservationId.set(reassignment.observationId, reassignment);
    if (reassignment.mentionId) byMentionId.set(reassignment.mentionId, reassignment);
    if (reassignment.evidenceAnchorId) byEvidenceAnchorId.set(reassignment.evidenceAnchorId, reassignment);
  }
  return { reassignments: normalized, byObservationId, byMentionId, byEvidenceAnchorId };
}

function buildAggregate({ coreState, projectId, indexResult, languageCode, meta }) {
  const project = getProject(coreState, projectId);
  if (!project) {
    throw createDerivedError(
      'E_ATLAS_PROJECT_NOT_FOUND',
      VIEW_ID,
      'PROJECT_NOT_FOUND',
      { projectId },
    );
  }
  const languagePolicy = normalizeAtlasObservationLanguagePolicy(languageCode || project.languageCode || project.language || 'und');
  const suppressionLookup = buildSuppressionLookup(project, projectId);
  const reassignmentLookup = buildReassignmentLookup(project);
  const candidates = sortAtlasObservationCandidates((Array.isArray(indexResult.value.mentions) ? indexResult.value.mentions : [])
    .map((mention) => normalizeCandidate({ mention, languagePolicy })));
  const observations = sortAtlasObservations(candidates.map((candidate) => normalizeObservation(candidate, suppressionLookup, reassignmentLookup)));
  assertObservationEvidence(observations);
  const entities = aggregateEntities(project, observations);
  const sceneIds = uniqueSorted(observations.map((observation) => observation.sceneId));
  const evidenceAnchorIds = uniqueSorted(observations.map((observation) => observation.evidenceAnchorId));
  const aggregateHash = hashCanonicalValue({
    candidates,
    observations,
    entities,
    sceneIds,
    evidenceAnchorIds,
    languagePolicy,
    suppressions: suppressionLookup.suppressions,
    reassignments: reassignmentLookup.reassignments,
  });

  return {
    schemaVersion: ATLAS_OBSERVATION_AGGREGATE_SCHEMA_VERSION,
    state: observations.length > 0 ? 'ready' : 'empty',
    projectId,
    analyzer: {
      analyzerId: ATLAS_OBSERVATION_ANALYZER_ID,
      analyzerKind: 'BASIC',
      inputViewId: 'derived.atlas.mentionIndex.v1',
      candidateSchemaVersion: ATLAS_OBSERVATION_CANDIDATE_SCHEMA_VERSION,
      observationSchemaVersion: ATLAS_OBSERVATION_SCHEMA_VERSION,
      languagePolicy,
      automaticEntityCreation: false,
      fuzzyMatching: false,
    },
    authority: {
      sourceOfTruth: 'project.core.atlas.entities + project.core.scenes',
      readModelOnly: true,
      commandAuthority: 'none',
      projectTruthMutation: false,
      storageMutation: false,
      networkMutation: false,
      authorApprovalRequiredForTruthMutation: true,
    },
    summary: {
      candidateCount: candidates.length,
      observationCount: observations.length,
      activeObservationCount: observations.filter((observation) => observation.suppressionState !== 'SUPPRESSED').length,
      suppressedObservationCount: observations.filter((observation) => observation.suppressionState === 'SUPPRESSED').length,
      reassignedObservationCount: observations.filter((observation) => observation.reassignmentState === 'REASSIGNED').length,
      entityCount: entities.length,
      sceneCount: sceneIds.length,
      evidenceAnchorCount: evidenceAnchorIds.length,
      everyObservationHasEvidence: observations.every((observation) => Boolean(observation.evidenceAnchor && observation.evidenceAnchorId)),
      hiddenFilterApplied: false,
      indexHash: indexResult.value.meta?.indexHash || '',
      aggregateHash,
      invalidationKey: meta.invalidationKey,
    },
    entities,
    candidates,
    observations,
  };
}

export function deriveAtlasObservationAggregate(input = {}) {
  const projectId = normalizeString(input?.params?.projectId);
  const languageCode = normalizeString(input?.params?.languageCode);
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

  return deriveView({
    viewId: VIEW_ID,
    coreState: input.coreState,
    params: {
      ...input.params,
      projectId,
      languageCode,
    },
    capabilitySnapshot: input.capabilitySnapshot,
    derive: ({ coreState, params, capabilitySnapshot, meta }) => {
      if (!isAtlasObservationAggregateCapabilityEnabled(capabilitySnapshot)) {
        throw createDerivedError(
          'E_CAPABILITY_DISABLED_FOR_COMMAND',
          VIEW_ID,
          'ATLAS_OBSERVATION_AGGREGATE_DISABLED',
          { capabilityId: 'atlas.observationAggregate' },
        );
      }
      const indexResult = deriveAtlasMentionIndex({
        coreState,
        params: { projectId: params.projectId },
        capabilitySnapshot,
      });
      if (!indexResult.ok) {
        throw createDerivedError(
          indexResult.error?.code || 'E_ATLAS_MENTION_INDEX_UNAVAILABLE',
          VIEW_ID,
          indexResult.error?.reason || 'ATLAS_MENTION_INDEX_UNAVAILABLE',
          indexResult.error?.details || {},
        );
      }
      return buildAggregate({
        coreState,
        projectId: params.projectId,
        indexResult,
        languageCode: params.languageCode,
        meta,
      });
    },
  });
}

export { VIEW_ID as ATLAS_OBSERVATION_AGGREGATE_VIEW_ID };

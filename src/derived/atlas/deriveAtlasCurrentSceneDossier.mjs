import { createDerivedError, deriveView, hashCanonicalValue } from '../deriveView.mjs';
import { deriveAtlasMentionIndex } from './deriveAtlasMentionIndex.mjs';
import {
  ATLAS_CURRENT_SCENE_DOSSIER_SCHEMA_VERSION,
  ATLAS_CURRENT_SCENE_SURFACE_MANIFEST_VERSION,
  ATLAS_TRUST_STATES,
  sortAtlasMentions,
} from './atlasMentionTypes.mjs';

const VIEW_ID = 'derived.atlas.currentSceneDossier.v1';
const PROVIDER_ID = 'query.atlasCurrentScene';
const SURFACE_ID = 'surface.atlas.currentSceneDossier';
const RIGHT_RAIL_SLOT_ID = 'rightRail.context.atlas';
const CONTEXT_CHARS = 42;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function plainString(value) {
  return typeof value === 'string' ? value : '';
}

function getProject(coreState, projectId) {
  const projects = isPlainObject(coreState?.data?.projects) ? coreState.data.projects : {};
  return isPlainObject(projects[projectId]) ? projects[projectId] : null;
}

function getScene(project, sceneId) {
  const scenes = isPlainObject(project?.scenes) ? project.scenes : {};
  return isPlainObject(scenes[sceneId]) ? scenes[sceneId] : null;
}

function buildSurfaceManifest() {
  return {
    schemaVersion: ATLAS_CURRENT_SCENE_SURFACE_MANIFEST_VERSION,
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
      empty: 'ATLAS_DOSSIER_EMPTY',
      unavailable: 'ATLAS_DOSSIER_UNAVAILABLE',
    },
  };
}

function getEntity(project, entityId) {
  const entities = isPlainObject(project?.atlas?.entities) ? project.atlas.entities : {};
  return isPlainObject(entities[entityId]) ? entities[entityId] : {};
}

function listAliases(entity) {
  const aliases = isPlainObject(entity.aliases) ? entity.aliases : {};
  return Object.keys(aliases)
    .sort()
    .map((aliasId) => {
      const alias = isPlainObject(aliases[aliasId]) ? aliases[aliasId] : {};
      return {
        aliasId,
        value: plainString(alias.value),
        scope: plainString(alias.scope) || 'project',
        sceneId: plainString(alias.sceneId),
      };
    });
}

function listDecisions(project) {
  const decisions = isPlainObject(project?.atlas?.decisions) ? project.atlas.decisions : {};
  return Object.keys(decisions)
    .sort()
    .map((decisionId) => {
      const decision = isPlainObject(decisions[decisionId]) ? decisions[decisionId] : {};
      return { ...decision, decisionId };
    });
}

function boundWitness(anchor, projectId, sceneId, entityId) {
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

function sameWitness(left, right) {
  return Boolean(left && right) && ['projectId', 'sceneId', 'entityId', 'startOffset', 'endOffset', 'quote', 'quoteHash', 'sceneTextHash']
    .every((key) => left[key] === right[key]);
}

function buildDecisionLookup(project, projectId) {
  const byEntityId = new Map();
  const reattachments = Object.values(isPlainObject(project?.atlas?.evidenceReattachments) ? project.atlas.evidenceReattachments : {});
  for (const decision of listDecisions(project)) {
    if (decision.decisionKind !== 'mention.confirm' || decision.trustState !== ATLAS_TRUST_STATES.AUTHOR_CONFIRMED) continue;
    if (decision.projectId !== projectId || decision.id !== decision.decisionId) continue;
    const original = boundWitness(decision.evidenceAnchor, projectId, decision.sceneId, decision.entityId);
    if (!original) continue;
    const records = reattachments.filter((record) => isPlainObject(record)
      && record.sourceRecordKind === 'decision' && record.sourceRecordId === decision.decisionId);
    let anchor = original;
    if (records.length) {
      // Sequence is canonical chronology; bucket-key order cannot select author intent.
      if (records.some((record) => !Number.isSafeInteger(record.createdByCommandSeq)
        || record.createdByCommandSeq <= decision.createdByCommandSeq)) continue;
      const sequence = Math.max(...records.map((record) => record.createdByCommandSeq));
      const latest = records.filter((record) => record.createdByCommandSeq === sequence);
      if (latest.length !== 1) continue;
      const record = latest[0], rawDecision = project.atlas.decisions[decision.decisionId];
      const stale = boundWitness(record.staleEvidenceAnchor, projectId, decision.sceneId, decision.entityId);
      anchor = boundWitness(record.newEvidenceAnchor, projectId, plainString(record.newEvidenceAnchor?.sceneId), decision.entityId);
      if (record.operationKind !== 'evidence.reattach' || record.projectId !== projectId
        || record.automaticReattachment !== false || record.sourceRecordHash !== hashCanonicalValue(rawDecision)
        || !sameWitness(stale, original) || stale.anchorId !== original.anchorId || !anchor) continue;
    }
    if (!byEntityId.has(decision.entityId)) byEntityId.set(decision.entityId, []);
    byEntityId.get(decision.entityId).push({ decision, anchor, reattached: records.length > 0 });
  }
  return byEntityId;
}

function buildContext(text, startOffset, endOffset) {
  const beforeStart = Math.max(0, startOffset - CONTEXT_CHARS);
  const afterEnd = Math.min(text.length, endOffset + CONTEXT_CHARS);
  const prefix = beforeStart > 0 ? '...' : '';
  const suffix = afterEnd < text.length ? '...' : '';
  return {
    before: `${prefix}${text.slice(beforeStart, startOffset).replace(/\s+/gu, ' ').trim()}`,
    quote: text.slice(startOffset, endOffset),
    after: `${text.slice(endOffset, afterEnd).replace(/\s+/gu, ' ').trim()}${suffix}`,
  };
}

function normalizeMentionForDossier(mention, sceneText, decisionLookup) {
  const startOffset = Number.isFinite(Number(mention.startOffset)) ? Number(mention.startOffset) : 0;
  const endOffset = Number.isFinite(Number(mention.endOffset)) ? Number(mention.endOffset) : startOffset;
  const witness = mention.evidenceAnchor;
  const match = (decisionLookup.get(mention.entityId) || []).findLast(({ decision, anchor, reattached }) => sameWitness(anchor, witness)
    && (reattached || decision.mentionId === mention.mentionId || anchor.anchorId === witness?.anchorId));
  const decision = match?.decision || null;
  return {
    mentionId: plainString(mention.mentionId),
    sceneId: plainString(mention.sceneId),
    entityId: plainString(mention.entityId),
    termId: plainString(mention.termId),
    termKind: plainString(mention.termKind),
    aliasId: plainString(mention.aliasId),
    matchedText: plainString(mention.matchedText),
    startOffset,
    endOffset,
    trustState: decision ? ATLAS_TRUST_STATES.AUTHOR_CONFIRMED : ATLAS_TRUST_STATES.ALGORITHMIC_OBSERVATION,
    decisionId: decision ? plainString(decision.id || decision.decisionId) : '',
    context: buildContext(sceneText, startOffset, endOffset),
    evidenceAnchor: isPlainObject(mention.evidenceAnchor) ? mention.evidenceAnchor : null,
    focusIntent: {
      kind: 'localTextSelection',
      sceneId: plainString(mention.sceneId),
      startOffset,
      endOffset,
    },
  };
}

function groupByEntity(project, mentions) {
  const groups = new Map();
  for (const mention of mentions) {
    if (!groups.has(mention.entityId)) groups.set(mention.entityId, []);
    groups.get(mention.entityId).push(mention);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    .map(([entityId, entityMentions]) => {
      const entity = getEntity(project, entityId);
      return {
        entityId,
        name: plainString(entity.name) || entityId,
        entityKind: plainString(entity.entityKind) || 'entity',
        aliases: listAliases(entity),
        mentionCount: entityMentions.length,
        confirmedMentionCount: entityMentions.filter((mention) => mention.trustState === ATLAS_TRUST_STATES.AUTHOR_CONFIRMED).length,
        mentions: entityMentions,
      };
    });
}

function buildDossierFromIndex({ coreState, projectId, sceneId, sceneTitle, indexResult }) {
  const project = getProject(coreState, projectId);
  if (!project) {
    throw createDerivedError(
      'E_ATLAS_PROJECT_NOT_FOUND',
      VIEW_ID,
      'PROJECT_NOT_FOUND',
      { projectId },
    );
  }
  const scene = getScene(project, sceneId);
  if (!scene) {
    throw createDerivedError(
      'E_ATLAS_SCENE_NOT_FOUND',
      VIEW_ID,
      'SCENE_NOT_FOUND',
      { projectId, sceneId },
    );
  }
  const sceneText = plainString(scene.text);
  const decisionLookup = buildDecisionLookup(project, projectId);
  const mentions = sortAtlasMentions(indexResult.value.mentions)
    .filter((mention) => mention.sceneId === sceneId)
    .map((mention) => normalizeMentionForDossier(mention, sceneText, decisionLookup));
  const sceneShard = (Array.isArray(indexResult.value.sceneShards) ? indexResult.value.sceneShards : [])
    .find((shard) => shard.sceneId === sceneId) || null;
  const entities = groupByEntity(project, mentions);
  const state = mentions.length > 0 ? 'ready' : 'empty';
  const sceneTextHash = sceneShard?.sceneTextHash || hashCanonicalValue(sceneText);
  return {
    schemaVersion: ATLAS_CURRENT_SCENE_DOSSIER_SCHEMA_VERSION,
    state,
    unavailableReason: '',
    surfaceManifest: buildSurfaceManifest(),
    projectId,
    sceneId,
    sceneTitle: sceneTitle || plainString(scene.title) || sceneId,
    summary: {
      entityCount: entities.length,
      mentionCount: mentions.length,
      confirmedMentionCount: mentions.filter((mention) => mention.trustState === ATLAS_TRUST_STATES.AUTHOR_CONFIRMED).length,
      sceneTextHash,
      indexHash: indexResult.value.meta?.indexHash || '',
      invalidationKey: indexResult.meta?.invalidationKey || '',
    },
    entities,
    mentions,
  };
}

function unavailable(projectId, sceneId, sceneTitle, reason, error = null) {
  return {
    schemaVersion: ATLAS_CURRENT_SCENE_DOSSIER_SCHEMA_VERSION,
    state: 'unavailable',
    unavailableReason: reason,
    surfaceManifest: buildSurfaceManifest(),
    projectId,
    sceneId,
    sceneTitle,
    summary: {
      entityCount: 0,
      mentionCount: 0,
      confirmedMentionCount: 0,
      sceneTextHash: '',
      indexHash: '',
      invalidationKey: '',
    },
    entities: [],
    mentions: [],
    error,
  };
}

export function deriveAtlasCurrentSceneDossier(input = {}) {
  const projectId = normalizeString(input?.params?.projectId);
  const sceneId = normalizeString(input?.params?.sceneId);
  const sceneTitle = normalizeString(input?.params?.sceneTitle);
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
  if (!sceneId) {
    return {
      ok: false,
      error: {
        code: 'E_ATLAS_SCENE_ID_REQUIRED',
        op: VIEW_ID,
        reason: 'SCENE_ID_REQUIRED',
      },
    };
  }

  return deriveView({
    viewId: VIEW_ID,
    coreState: input.coreState,
    params: {
      ...input.params,
      projectId,
      sceneId,
      sceneTitle,
    },
    capabilitySnapshot: input.capabilitySnapshot,
    derive: ({ coreState, params, capabilitySnapshot }) => {
      const indexResult = deriveAtlasMentionIndex({
        coreState,
        params: { projectId: params.projectId },
        capabilitySnapshot,
      });
      if (!indexResult.ok) {
        return unavailable(params.projectId, params.sceneId, params.sceneTitle, indexResult.error?.reason || 'ATLAS_INDEX_UNAVAILABLE', indexResult.error || null);
      }
      return buildDossierFromIndex({
        coreState,
        projectId: params.projectId,
        sceneId: params.sceneId,
        sceneTitle: params.sceneTitle,
        indexResult,
      });
    },
  });
}

export { VIEW_ID as ATLAS_CURRENT_SCENE_DOSSIER_VIEW_ID };

'use strict';

const WRITER_LOCAL_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v1';
const WRITER_LOCAL_PROFILE_ID = 'WRITER_LOCAL_V1';
const WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED = 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED';
const WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS = Object.freeze([
  'cmd.project.review.openComments',
  'cmd.project.review.openDocxReviewPreviewSession',
  'cmd.project.review.exportDocxReviewPacket',
  'cmd.project.review.exportFullManuscriptDocxReviewPacket',
  'cmd.project.review.editComment',
  'cmd.project.review.decidePendingRevision',
  'cmd.project.review.recordTextRevisions',
  'cmd.project.review.activateDocxReviewPreviewSession',
  'cmd.project.review.applyExactTextChangesBatch',
  'cmd.project.review.applyFormattingReturn',
  'cmd.project.review.applyStructuralReturn',
  'cmd.project.review.inspectFormattingReturnReplay',
  'cmd.project.review.inspectStructuralReturnReplay',
  'cmd.project.review.reloadReconciledScene',
]);
const WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_ID_SET = new Set(WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS);

const OPTIONAL_PRODUCT_DOMAINS = Object.freeze([
  'atlas',
  'blackBox',
  'idea',
  'manualMap',
  'meaning',
  'stage10',
]);
const OPTIONAL_PRODUCT_DOMAIN_SET = new Set(OPTIONAL_PRODUCT_DOMAINS);
const OPTIONAL_COMMAND_PREFIXES = Object.freeze([
  'cmd.project.plan.',
  'cmd.project.review.',
]);
const OPTIONAL_QUERY_IDS = Object.freeze([
  'query.collabScopeLocal',
  'query.stage10ProductState',
  'query.atlasOverview',
  'query.atlasEntityDossier',
  'query.atlasRelationDossier',
  'query.atlasMatrices',
  'query.atlasHeatmap',
  'query.atlasTemporalLayout',
  'query.atlasContinuityLedgerSurface',
  'query.atlasReportsSavedQueries',
  'query.atlasDiagnosticsStageAcceptance',
  'query.atlasCurrentScene',
  'query.manualMapWorkbench',
  'query.projectionInspector',
]);
const OPTIONAL_QUERY_ID_SET = new Set(OPTIONAL_QUERY_IDS);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeIdentity(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createWriterLocalProfileProjection({ isPackaged = false, platform = '' } = {}) {
  const normalizedPlatform = normalizeIdentity(platform);
  const active = isPackaged === true && normalizedPlatform === 'darwin';
  return Object.freeze({
    schemaVersion: WRITER_LOCAL_PROFILE_SCHEMA_VERSION,
    profileId: active ? WRITER_LOCAL_PROFILE_ID : '',
    active,
    platform: normalizedPlatform,
    packaged: isPackaged === true,
    localPackagingAndCertificationOnly: active,
    optionalSystemsEnabled: !active,
    signing: false,
    notarization: false,
    publicDistribution: false,
    dependencyAdoption: false,
    cloudAuthority: false,
    userDataMutation: false,
  });
}

function isActiveWriterLocalProfile(profile) {
  return isPlainObject(profile)
    && profile.schemaVersion === WRITER_LOCAL_PROFILE_SCHEMA_VERSION
    && profile.profileId === WRITER_LOCAL_PROFILE_ID
    && profile.active === true
    && profile.packaged === true
    && profile.platform === 'darwin'
    && profile.optionalSystemsEnabled === false;
}

function isOptionalWriterLocalCommand(commandId, productCommandRecord = null) {
  const normalizedCommandId = normalizeIdentity(commandId);
  if (!normalizedCommandId) return false;
  if (WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_ID_SET.has(normalizedCommandId)) {
    return false;
  }
  if (OPTIONAL_COMMAND_PREFIXES.some((prefix) => normalizedCommandId.startsWith(prefix))) {
    return true;
  }
  if (!isPlainObject(productCommandRecord) || productCommandRecord.id !== normalizedCommandId) {
    return false;
  }
  return OPTIONAL_PRODUCT_DOMAIN_SET.has(normalizeIdentity(productCommandRecord.domain));
}

// A separate packaging projection, not a broader capability or entitlement.
const WRITER_ATLAS_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v2';
const WRITER_ATLAS_PROFILE_ID = 'WRITER_LOCAL_ATLAS_V2';
const WRITER_ATLAS_COMMAND_IDS = Object.freeze(['manualMap.create', 'manualMap.node.add']);
const WRITER_ATLAS_QUERY_IDS = Object.freeze(['query.atlasCurrentScene', 'query.manualMapWorkbench']);
const WRITER_ATLAS_COMMAND_SET = new Set(WRITER_ATLAS_COMMAND_IDS);
const WRITER_ATLAS_QUERY_SET = new Set(WRITER_ATLAS_QUERY_IDS);

function createWriterAtlasProfileProjection(options = {}) {
  const legacy = createWriterLocalProfileProjection(options);
  if (!legacy.active) return legacy;
  return Object.freeze({ ...legacy,
    schemaVersion: WRITER_ATLAS_PROFILE_SCHEMA_VERSION,
    profileId: WRITER_ATLAS_PROFILE_ID,
    admittedCommandIds: WRITER_ATLAS_COMMAND_IDS,
    admittedQueryIds: WRITER_ATLAS_QUERY_IDS,
  });
}

function isWriterAtlasProfileCandidate(profile) {
  return isPlainObject(profile) && (profile.profileId === WRITER_ATLAS_PROFILE_ID
    || profile.schemaVersion === WRITER_ATLAS_PROFILE_SCHEMA_VERSION);
}

function isActiveWriterAtlasProfile(profile) {
  if (!isWriterAtlasProfileCandidate(profile)) return false;
  const expected = createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' });
  const keys = Object.keys(expected);
  return Object.keys(profile).length === keys.length && keys.every(key => Array.isArray(expected[key])
    ? Array.isArray(profile[key]) && profile[key].length === expected[key].length
      && expected[key].every((id, index) => profile[key][index] === id)
    : profile[key] === expected[key]);
}

function atlasProfileAccess(allowed) {
  return Object.freeze({ allowed, reason: allowed ? '' : WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
    profileId: WRITER_ATLAS_PROFILE_ID });
}

function evaluateWriterLocalCommandAccess({ profile, commandId, productCommandRecord = null } = {}) {
  if (isWriterAtlasProfileCandidate(profile)) {
    const id = normalizeIdentity(commandId);
    const selected = WRITER_ATLAS_COMMAND_SET.has(commandId) && isPlainObject(productCommandRecord)
      && productCommandRecord.id === commandId && productCommandRecord.domain === 'manualMap';
    const optional = isOptionalWriterLocalCommand(commandId, productCommandRecord)
      || OPTIONAL_PRODUCT_DOMAINS.some(domain => id.startsWith(domain + '.'));
    return atlasProfileAccess(isActiveWriterAtlasProfile(profile) && (!optional || selected));
  }
  const denied = isActiveWriterLocalProfile(profile)
    && isOptionalWriterLocalCommand(commandId, productCommandRecord);
  return Object.freeze({
    allowed: !denied,
    reason: denied ? WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED : '',
    profileId: isActiveWriterLocalProfile(profile) ? WRITER_LOCAL_PROFILE_ID : '',
  });
}

function evaluateWriterLocalQueryAccess({ profile, queryId } = {}) {
  if (isWriterAtlasProfileCandidate(profile)) {
    const id = normalizeIdentity(queryId);
    const optional = OPTIONAL_QUERY_IDS.some(query => id === query || id.startsWith(query + '.'));
    return atlasProfileAccess(isActiveWriterAtlasProfile(profile) && (!optional || WRITER_ATLAS_QUERY_SET.has(queryId)));
  }
  const denied = isActiveWriterLocalProfile(profile)
    && OPTIONAL_QUERY_ID_SET.has(normalizeIdentity(queryId));
  return Object.freeze({
    allowed: !denied,
    reason: denied ? WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED : '',
    profileId: isActiveWriterLocalProfile(profile) ? WRITER_LOCAL_PROFILE_ID : '',
  });
}

module.exports = Object.freeze({
  WRITER_LOCAL_PROFILE_SCHEMA_VERSION,
  WRITER_LOCAL_PROFILE_ID,
  WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
  WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS,
  OPTIONAL_PRODUCT_DOMAINS,
  OPTIONAL_COMMAND_PREFIXES,
  OPTIONAL_QUERY_IDS,
  createWriterLocalProfileProjection,
  isActiveWriterLocalProfile,
  isOptionalWriterLocalCommand,
  evaluateWriterLocalCommandAccess,
  evaluateWriterLocalQueryAccess,
  WRITER_ATLAS_PROFILE_SCHEMA_VERSION,
  WRITER_ATLAS_PROFILE_ID,
  WRITER_ATLAS_COMMAND_IDS,
  WRITER_ATLAS_QUERY_IDS,
  createWriterAtlasProfileProjection,
  isActiveWriterAtlasProfile,
});

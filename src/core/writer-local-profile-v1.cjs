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

// V1 and V2 remain stable. V3 opens only the existing manual-map workbench.
const WRITER_MANUAL_MAP_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v3';
const WRITER_MANUAL_MAP_PROFILE_ID = 'WRITER_LOCAL_MANUAL_MAP_V3';
const WRITER_MANUAL_MAP_COMMAND_IDS = Object.freeze([
  'manualMap.create', 'manualMap.node.add', 'manualMap.node.update', 'manualMap.node.delete',
  'manualMap.edge.add', 'manualMap.edge.update', 'manualMap.edge.delete',
  'manualMap.group.create', 'manualMap.group.update', 'manualMap.group.delete',
  'manualMap.attachment.add', 'manualMap.portal.add', 'manualMap.template.apply',
  'manualMap.export.json', 'manualMap.export.imagePdf', 'manualMap.import.jsonRepeat',
]);
function createWriterManualMapProfileProjection(options = {}) {
  const legacy = createWriterLocalProfileProjection(options);
  return legacy.active ? Object.freeze({ ...legacy,
    schemaVersion: WRITER_MANUAL_MAP_PROFILE_SCHEMA_VERSION, profileId: WRITER_MANUAL_MAP_PROFILE_ID,
    admittedCommandIds: WRITER_MANUAL_MAP_COMMAND_IDS, admittedQueryIds: WRITER_ATLAS_QUERY_IDS,
  }) : legacy;
}
function isWriterManualMapProfileCandidate(profile) {
  return isPlainObject(profile) && (profile.profileId === WRITER_MANUAL_MAP_PROFILE_ID
    || profile.schemaVersion === WRITER_MANUAL_MAP_PROFILE_SCHEMA_VERSION);
}
function isActiveWriterManualMapProfile(profile) {
  if (!isWriterManualMapProfileCandidate(profile)) return false;
  const expected = createWriterManualMapProfileProjection({ isPackaged: true, platform: 'darwin' });
  return Object.keys(profile).length === Object.keys(expected).length && Object.keys(expected).every(key =>
    Array.isArray(expected[key]) ? Array.isArray(profile[key]) && profile[key].length === expected[key].length
      && expected[key].every((id, index) => profile[key][index] === id) : profile[key] === expected[key]);
}
function manualMapProfileAccess(profile, selected, optional) {
  const allowed = isActiveWriterManualMapProfile(profile) && (optional ? selected : true);
  return Object.freeze({ allowed, reason: allowed ? '' : WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
    profileId: WRITER_MANUAL_MAP_PROFILE_ID });
}

function evaluateWriterLocalCommandAccess({ profile, commandId, productCommandRecord = null } = {}) {
  if (isWriterAtlasExplicitSuppressionProfileCandidate(profile)) return evaluateSuppressionCommandAccess(profile, commandId, productCommandRecord);
  if (isWriterAtlasEvidenceReattachmentProfileCandidate(profile)) return evaluateReattachmentCommandAccess(profile, commandId, productCommandRecord);
  if (isWriterExactAtlasProfileCandidate(profile)) return evaluateExactAtlasCommandAccess(profile, commandId, productCommandRecord);
  if (isWriterManualMapMarkdownProfileCandidate(profile)) return evaluateMarkdownCommandAccess(profile, commandId, productCommandRecord);
  if (isWriterManualMapProfileCandidate(profile)) {
    const id = normalizeIdentity(commandId);
    return manualMapProfileAccess(profile, WRITER_MANUAL_MAP_COMMAND_IDS.includes(commandId)
      && isPlainObject(productCommandRecord) && productCommandRecord.id === commandId
      && productCommandRecord.domain === 'manualMap',
    isOptionalWriterLocalCommand(commandId, productCommandRecord)
      || OPTIONAL_PRODUCT_DOMAINS.some(domain => id.startsWith(domain + '.')));
  }
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
  if (isWriterAtlasExplicitSuppressionProfileCandidate(profile)) return evaluateSuppressionQueryAccess(profile, queryId);
  if (isWriterAtlasEvidenceReattachmentProfileCandidate(profile)) return evaluateReattachmentQueryAccess(profile, queryId);
  if (isWriterExactAtlasProfileCandidate(profile)) return evaluateExactAtlasQueryAccess(profile, queryId);
  if (isWriterManualMapMarkdownProfileCandidate(profile)) return evaluateMarkdownQueryAccess(profile, queryId);
  if (isWriterManualMapProfileCandidate(profile)) {
    const id = normalizeIdentity(queryId);
    return manualMapProfileAccess(profile, WRITER_ATLAS_QUERY_IDS.includes(queryId),
      OPTIONAL_QUERY_IDS.some(query => id === query || id.startsWith(query + '.')));
  }
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

// V4 adds only saved-map Markdown; historical projections remain closed.
const WRITER_MANUAL_MAP_MARKDOWN_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v4';
const WRITER_MANUAL_MAP_MARKDOWN_PROFILE_ID = 'WRITER_LOCAL_MANUAL_MAP_V4';
const WRITER_MANUAL_MAP_MARKDOWN_COMMAND_IDS = Object.freeze([...WRITER_MANUAL_MAP_COMMAND_IDS, 'manualMap.export.markdown']);
function createWriterManualMapMarkdownProfileProjection(options = {}) {
  const legacy = createWriterLocalProfileProjection(options);
  return legacy.active ? Object.freeze({ ...legacy,
    schemaVersion: WRITER_MANUAL_MAP_MARKDOWN_PROFILE_SCHEMA_VERSION, profileId: WRITER_MANUAL_MAP_MARKDOWN_PROFILE_ID,
    admittedCommandIds: WRITER_MANUAL_MAP_MARKDOWN_COMMAND_IDS, admittedQueryIds: WRITER_ATLAS_QUERY_IDS,
  }) : legacy;
}
function isWriterManualMapMarkdownProfileCandidate(profile) {
  return isPlainObject(profile) && (profile.profileId === WRITER_MANUAL_MAP_MARKDOWN_PROFILE_ID
    || profile.schemaVersion === WRITER_MANUAL_MAP_MARKDOWN_PROFILE_SCHEMA_VERSION);
}
function isActiveWriterManualMapMarkdownProfile(profile) {
  if (!isWriterManualMapMarkdownProfileCandidate(profile)) return false;
  const expected = createWriterManualMapMarkdownProfileProjection({ isPackaged: true, platform: 'darwin' });
  return Object.keys(profile).length === Object.keys(expected).length && Object.keys(expected).every(key =>
    Array.isArray(expected[key]) ? Array.isArray(profile[key]) && profile[key].length === expected[key].length
      && expected[key].every((id, index) => profile[key][index] === id) : profile[key] === expected[key]);
}
function markdownProfileAccess(profile, selected, optional) {
  const allowed = isActiveWriterManualMapMarkdownProfile(profile) && (!optional || selected);
  return Object.freeze({ allowed, reason: allowed ? '' : WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
    profileId: WRITER_MANUAL_MAP_MARKDOWN_PROFILE_ID });
}
function evaluateMarkdownCommandAccess(profile, commandId, productCommandRecord) {
  const id = normalizeIdentity(commandId);
  const selected = WRITER_MANUAL_MAP_MARKDOWN_COMMAND_IDS.includes(commandId) && isPlainObject(productCommandRecord)
    && productCommandRecord.id === commandId && productCommandRecord.domain === 'manualMap';
  return markdownProfileAccess(profile, selected, isOptionalWriterLocalCommand(commandId, productCommandRecord)
    || OPTIONAL_PRODUCT_DOMAINS.some(domain => id.startsWith(domain + '.')));
}
function evaluateMarkdownQueryAccess(profile, queryId) {
  const id = normalizeIdentity(queryId);
  return markdownProfileAccess(profile, WRITER_ATLAS_QUERY_IDS.includes(queryId),
    OPTIONAL_QUERY_IDS.some(query => id === query || id.startsWith(query + '.')));
}

// V5 admits only the existing exact Atlas authoring journey.
const WRITER_EXACT_ATLAS_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v5';
const WRITER_EXACT_ATLAS_PROFILE_ID = 'WRITER_LOCAL_EXACT_ATLAS_V5';
const WRITER_EXACT_ATLAS_AUTHOR_COMMAND_IDS = Object.freeze(['atlas.entity.create', 'atlas.alias.add', 'atlas.mention.confirm']);
const WRITER_EXACT_ATLAS_COMMAND_IDS = Object.freeze([...WRITER_MANUAL_MAP_MARKDOWN_COMMAND_IDS, ...WRITER_EXACT_ATLAS_AUTHOR_COMMAND_IDS]);
const WRITER_EXACT_ATLAS_QUERY_IDS = Object.freeze([...WRITER_ATLAS_QUERY_IDS, 'query.atlasEntityDossier']);
function createWriterExactAtlasProfileProjection(options = {}) {
  const legacy = createWriterLocalProfileProjection(options);
  return legacy.active ? Object.freeze({ ...legacy,
    schemaVersion: WRITER_EXACT_ATLAS_PROFILE_SCHEMA_VERSION, profileId: WRITER_EXACT_ATLAS_PROFILE_ID,
    admittedCommandIds: WRITER_EXACT_ATLAS_COMMAND_IDS, admittedQueryIds: WRITER_EXACT_ATLAS_QUERY_IDS,
  }) : legacy;
}
function isWriterExactAtlasProfileCandidate(profile) {
  return isPlainObject(profile) && (normalizeIdentity(profile.profileId).startsWith(WRITER_EXACT_ATLAS_PROFILE_ID)
    || normalizeIdentity(profile.schemaVersion).startsWith(WRITER_EXACT_ATLAS_PROFILE_SCHEMA_VERSION)
    || Array.isArray(profile.admittedCommandIds) && WRITER_EXACT_ATLAS_AUTHOR_COMMAND_IDS.some(id => profile.admittedCommandIds.includes(id))
    || Array.isArray(profile.admittedQueryIds) && profile.admittedQueryIds.includes('query.atlasEntityDossier'));
}
function isActiveWriterExactAtlasProfile(profile) {
  if (!isWriterExactAtlasProfileCandidate(profile)) return false;
  const expected = createWriterExactAtlasProfileProjection({ isPackaged: true, platform: 'darwin' });
  const keys = Reflect.ownKeys(expected);
  return Reflect.ownKeys(profile).length === keys.length && keys.every(key => Object.hasOwn(profile, key) && (Array.isArray(expected[key])
    ? Array.isArray(profile[key]) && profile[key].length === expected[key].length
      && Reflect.ownKeys(profile[key]).length === expected[key].length + 1
      && expected[key].every((id, index) => Object.hasOwn(profile[key], index))
      && expected[key].every((id, index) => profile[key][index] === id)
    : profile[key] === expected[key]));
}
function exactAtlasProfileAccess(profile, selected, optional) {
  const allowed = isActiveWriterExactAtlasProfile(profile) && (!optional || selected);
  return Object.freeze({ allowed, reason: allowed ? '' : WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
    profileId: WRITER_EXACT_ATLAS_PROFILE_ID });
}
function evaluateExactAtlasCommandAccess(profile, commandId, productCommandRecord) {
  const id = normalizeIdentity(commandId);
  const selected = WRITER_EXACT_ATLAS_COMMAND_IDS.includes(commandId) && isPlainObject(productCommandRecord)
    && productCommandRecord.id === commandId &&
    productCommandRecord.domain === (WRITER_EXACT_ATLAS_AUTHOR_COMMAND_IDS.includes(commandId) ? 'atlas' : 'manualMap');
  return exactAtlasProfileAccess(profile, selected, isOptionalWriterLocalCommand(commandId, productCommandRecord)
    || OPTIONAL_PRODUCT_DOMAINS.some(domain => id.startsWith(domain + '.')));
}
function evaluateExactAtlasQueryAccess(profile, queryId) {
  const id = normalizeIdentity(queryId);
  return exactAtlasProfileAccess(profile, WRITER_EXACT_ATLAS_QUERY_IDS.includes(queryId),
    OPTIONAL_QUERY_IDS.some(query => id === query || id.startsWith(query + '.')));
}

// V6 admits only explicit saved Atlas evidence reattachment.
const WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v6';
const WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_ID = 'WRITER_LOCAL_ATLAS_EVIDENCE_REATTACHMENT_V6';
const WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS = Object.freeze([...WRITER_EXACT_ATLAS_COMMAND_IDS, 'atlas.evidence.reattach']);
function createWriterAtlasEvidenceReattachmentProfileProjection(options = {}) {
  const legacy = createWriterLocalProfileProjection(options);
  return legacy.active ? Object.freeze({ ...legacy,
    schemaVersion: WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_SCHEMA_VERSION, profileId: WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_ID,
    admittedCommandIds: WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS, admittedQueryIds: WRITER_EXACT_ATLAS_QUERY_IDS,
  }) : legacy;
}
function isWriterAtlasEvidenceReattachmentProfileCandidate(profile) {
  return Boolean(profile) && typeof profile === 'object' && (normalizeIdentity(profile.profileId).startsWith(WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_ID)
    || normalizeIdentity(profile.schemaVersion).startsWith(WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_SCHEMA_VERSION)
    || Array.isArray(profile.admittedCommandIds) && profile.admittedCommandIds.includes('atlas.evidence.reattach'));
}
function isActiveWriterAtlasEvidenceReattachmentProfile(profile) {
  if (!isPlainObject(profile)) return false;
  if (!isWriterAtlasEvidenceReattachmentProfileCandidate(profile)) return false;
  const expected = createWriterAtlasEvidenceReattachmentProfileProjection({ isPackaged: true, platform: 'darwin' });
  const keys = Reflect.ownKeys(expected);
  return Reflect.ownKeys(profile).length === keys.length && keys.every(key => Object.hasOwn(profile, key) && (Array.isArray(expected[key])
    ? Array.isArray(profile[key]) && profile[key].length === expected[key].length
      && Reflect.ownKeys(profile[key]).length === expected[key].length + 1
      && expected[key].every((id, index) => Object.hasOwn(profile[key], index))
      && expected[key].every((id, index) => profile[key][index] === id)
    : profile[key] === expected[key]));
}
function reattachmentProfileAccess(profile, selected, optional) {
  const allowed = isActiveWriterAtlasEvidenceReattachmentProfile(profile) && (!optional || selected);
  return Object.freeze({ allowed, reason: allowed ? '' : WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
    profileId: WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_ID });
}
function evaluateReattachmentCommandAccess(profile, commandId, productCommandRecord) {
  const id = normalizeIdentity(commandId);
  const selected = WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS.includes(commandId) && isPlainObject(productCommandRecord)
    && productCommandRecord.id === commandId && productCommandRecord.domain === (commandId.startsWith('atlas.') ? 'atlas' : 'manualMap');
  return reattachmentProfileAccess(profile, selected, isOptionalWriterLocalCommand(commandId, productCommandRecord)
    || OPTIONAL_PRODUCT_DOMAINS.some(domain => id.startsWith(domain + '.')));
}
function evaluateReattachmentQueryAccess(profile, queryId) {
  const id = normalizeIdentity(queryId);
  return reattachmentProfileAccess(profile, WRITER_EXACT_ATLAS_QUERY_IDS.includes(queryId),
    OPTIONAL_QUERY_IDS.some(query => id === query || id.startsWith(query + '.')));
}

// V7 admits only explicit Atlas occurrence suppression.
const WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_SCHEMA_VERSION = 'writer-local-profile.v7';
const WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_ID = 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7';
const WRITER_ATLAS_EXPLICIT_SUPPRESSION_COMMAND_IDS = Object.freeze([...WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS, 'atlas.observation.suppress']);
function createWriterAtlasExplicitSuppressionProfileProjection(options = {}) {
  const legacy = createWriterLocalProfileProjection(options);
  return legacy.active ? Object.freeze({ ...legacy,
    schemaVersion: WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_SCHEMA_VERSION, profileId: WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_ID,
    admittedCommandIds: WRITER_ATLAS_EXPLICIT_SUPPRESSION_COMMAND_IDS, admittedQueryIds: WRITER_EXACT_ATLAS_QUERY_IDS,
  }) : legacy;
}
function isWriterAtlasExplicitSuppressionProfileCandidate(profile) {
  return Boolean(profile) && typeof profile === 'object' && (normalizeIdentity(profile.profileId).startsWith(WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_ID)
    || normalizeIdentity(profile.schemaVersion).startsWith(WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_SCHEMA_VERSION)
    || Array.isArray(profile.admittedCommandIds) && profile.admittedCommandIds.includes('atlas.observation.suppress'));
}
function isActiveWriterAtlasExplicitSuppressionProfile(profile) {
  if (!isPlainObject(profile)) return false;
  if (!isWriterAtlasExplicitSuppressionProfileCandidate(profile)) return false;
  const expected = createWriterAtlasExplicitSuppressionProfileProjection({ isPackaged: true, platform: 'darwin' });
  const keys = Reflect.ownKeys(expected);
  return Reflect.ownKeys(profile).length === keys.length && keys.every(key => Object.hasOwn(profile, key) && (Array.isArray(expected[key])
    ? Array.isArray(profile[key]) && profile[key].length === expected[key].length
      && Reflect.ownKeys(profile[key]).length === expected[key].length + 1
      && expected[key].every((id, index) => Object.hasOwn(profile[key], index))
      && expected[key].every((id, index) => profile[key][index] === id)
    : profile[key] === expected[key]));
}
function suppressionProfileAccess(profile, selected, optional) {
  const allowed = isActiveWriterAtlasExplicitSuppressionProfile(profile) && (!optional || selected);
  return Object.freeze({ allowed, reason: allowed ? '' : WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
    profileId: WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_ID });
}
function evaluateSuppressionCommandAccess(profile, commandId, productCommandRecord) {
  const id = normalizeIdentity(commandId);
  const selected = WRITER_ATLAS_EXPLICIT_SUPPRESSION_COMMAND_IDS.includes(commandId) && isPlainObject(productCommandRecord)
    && productCommandRecord.id === commandId && productCommandRecord.domain === (commandId.startsWith('atlas.') ? 'atlas' : 'manualMap');
  return suppressionProfileAccess(profile, selected, isOptionalWriterLocalCommand(commandId, productCommandRecord)
    || OPTIONAL_PRODUCT_DOMAINS.some(domain => id.startsWith(domain + '.')));
}
function evaluateSuppressionQueryAccess(profile, queryId) {
  const id = normalizeIdentity(queryId);
  return suppressionProfileAccess(profile, WRITER_EXACT_ATLAS_QUERY_IDS.includes(queryId),
    OPTIONAL_QUERY_IDS.some(query => id === query || id.startsWith(query + '.')));
}

module.exports = Object.freeze({
  WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_SCHEMA_VERSION,
  WRITER_ATLAS_EXPLICIT_SUPPRESSION_PROFILE_ID,
  WRITER_ATLAS_EXPLICIT_SUPPRESSION_COMMAND_IDS,
  createWriterAtlasExplicitSuppressionProfileProjection,
  isActiveWriterAtlasExplicitSuppressionProfile,
  WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_SCHEMA_VERSION,
  WRITER_ATLAS_EVIDENCE_REATTACHMENT_PROFILE_ID,
  WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS,
  createWriterAtlasEvidenceReattachmentProfileProjection,
  isActiveWriterAtlasEvidenceReattachmentProfile,
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
  WRITER_MANUAL_MAP_PROFILE_SCHEMA_VERSION,
  WRITER_MANUAL_MAP_PROFILE_ID,
  WRITER_MANUAL_MAP_COMMAND_IDS,
  createWriterManualMapProfileProjection,
  isActiveWriterManualMapProfile,
  WRITER_MANUAL_MAP_MARKDOWN_PROFILE_SCHEMA_VERSION,
  WRITER_MANUAL_MAP_MARKDOWN_PROFILE_ID,
  WRITER_MANUAL_MAP_MARKDOWN_COMMAND_IDS,
  createWriterManualMapMarkdownProfileProjection,
  isActiveWriterManualMapMarkdownProfile,
  WRITER_EXACT_ATLAS_PROFILE_SCHEMA_VERSION,
  WRITER_EXACT_ATLAS_PROFILE_ID,
  WRITER_EXACT_ATLAS_COMMAND_IDS,
  WRITER_EXACT_ATLAS_QUERY_IDS,
  createWriterExactAtlasProfileProjection,
  isActiveWriterExactAtlasProfile,
});

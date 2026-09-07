import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';

export const WP709_MIXED_CHAIN_SCHEMA_VERSION = 'YALKEN_R24_WP709_MIXED_CHAIN_OBSERVATIONS_V1';
export const WP709_MIXED_CHAIN_RESULT_SCHEMA_VERSION = 'YALKEN_R24_WP709_MIXED_CHAIN_RESULT_V1';
export const WP709_STAGE_ID = 'WP-709_MIXED_CHAINS';
export const WP709_MISSION_DIGEST = '2d188140211c4e2a65f0f1bf1bef5bac53e396e3c3887cb3563fa253a10b0c80';
export const WP709_ZERO_SHA256 = '0'.repeat(64);

const MAX_JSON_BYTES = 512 * 1024;
const MAX_STRING_BYTES = 8 * 1024;
const MAX_FIELDS = 64;
const MAX_LEDGER_ENTRIES = 64;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const ID_RE = /^[A-Z0-9][A-Z0-9_.:-]{0,127}$/u;
const CHAIN_STATUSES = new Set(['PASS', 'PENDING_EXTERNAL_PHYSICAL', 'ABSTAIN_TYPED', 'BLOCKED_TYPED']);
const LOSS_TYPES = new Set(['UNSUPPORTED', 'DOWNGRADED', 'NORMALIZED', 'OMITTED_WITH_DISCLOSURE']);
const PROVIDER_ROLES = new Set(['WORD_LOCAL_PHYSICAL', 'GOOGLE_NATIVE', 'GOOGLE_OFFICE_COMPAT', 'GOOGLE_BRIDGE']);

const rawDefinitions = [
  ['MC1_YALKEN_DOCX_YALKEN', ['YALKEN', 'DOCX', 'YALKEN'], [
    ['YALKEN_TO_DOCX', 'YALKEN_INTERCHANGE_IR_V1', 'DOCX_EXPORT_BOUNDED_V1', 'YALKEN_DOCX_LOCAL_V1'],
    ['DOCX_TO_YALKEN', 'DOCX_PROFILE_V1', 'DOCX_IMPORT_QUARANTINED_V1', 'YALKEN_DOCX_LOCAL_V1'],
  ]],
  ['MC2_YALKEN_DOCX_WORD_DOCX_YALKEN', ['YALKEN', 'DOCX', 'WORD', 'DOCX', 'YALKEN'], [
    ['YALKEN_TO_DOCX', 'YALKEN_INTERCHANGE_IR_V1', 'DOCX_EXPORT_BOUNDED_V1', 'YALKEN_DOCX_LOCAL_V1'],
    ['DOCX_TO_WORD', 'DOCX_PROFILE_V1', 'WORD_LOCAL_PHYSICAL_OPEN_V1', 'WORD_LOCAL_PHYSICAL_WP709_V1'],
    ['WORD_TO_DOCX', 'WORD_DOCX_PHYSICAL_V1', 'WORD_LOCAL_PHYSICAL_SAVE_V1', 'WORD_LOCAL_PHYSICAL_WP709_V1'],
    ['DOCX_TO_YALKEN', 'DOCX_PROFILE_V1', 'DOCX_IMPORT_QUARANTINED_V1', 'YALKEN_DOCX_LOCAL_V1'],
  ]],
  ['MC3_YALKEN_DOCX_GOOGLE_OFFICE_DOCX_YALKEN', ['YALKEN', 'DOCX', 'GOOGLE_OFFICE', 'DOCX', 'YALKEN'], [
    ['YALKEN_TO_DOCX', 'YALKEN_INTERCHANGE_IR_V1', 'DOCX_EXPORT_BOUNDED_V1', 'YALKEN_DOCX_LOCAL_V1'],
    ['DOCX_TO_GOOGLE_OFFICE', 'DOCX_PROFILE_V1', 'GOOGLE_OFFICE_COMPAT_IMPORT_WP709_V1', 'GOOGLE_OFFICE_COMPAT_WP709_V1'],
    ['GOOGLE_OFFICE_TO_DOCX', 'GOOGLE_OFFICE_COMPAT_WP709_V1', 'GOOGLE_OFFICE_COMPAT_EXPORT_WP709_V1', 'GOOGLE_OFFICE_COMPAT_WP709_V1'],
    ['DOCX_TO_YALKEN', 'DOCX_PROFILE_V1', 'DOCX_IMPORT_QUARANTINED_V1', 'YALKEN_DOCX_LOCAL_V1'],
  ]],
  ['MC4_YALKEN_GOOGLE_NATIVE_DOCX_YALKEN', ['YALKEN', 'GOOGLE_NATIVE', 'DOCX', 'YALKEN'], [
    ['YALKEN_TO_GOOGLE_NATIVE', 'YALKEN_INTERCHANGE_IR_V1', 'GOOGLE_NATIVE_CONVERSION_BOUNDED_V1', 'GOOGLE_NATIVE_WP709_V1'],
    ['GOOGLE_NATIVE_TO_DOCX', 'GOOGLE_NATIVE_DOCUMENT_V1', 'GOOGLE_NATIVE_DOCX_EXPORT_WP709_V1', 'GOOGLE_NATIVE_WP709_V1'],
    ['DOCX_TO_YALKEN', 'DOCX_PROFILE_V1', 'DOCX_IMPORT_QUARANTINED_V1', 'YALKEN_DOCX_LOCAL_V1'],
  ]],
  ['MC5_YALKEN_MARKDOWN_YALKEN_DOCX_YALKEN', ['YALKEN', 'MARKDOWN', 'YALKEN', 'DOCX', 'YALKEN'], [
    ['YALKEN_TO_MARKDOWN', 'YALKEN_INTERCHANGE_IR_V1', 'MARKDOWN_EXPORT_LOSS_ACCOUNTED_V1', 'YALKEN_MARKDOWN_LOCAL_V1'],
    ['MARKDOWN_TO_YALKEN', 'MARKDOWN_PROFILE_V1', 'MARKDOWN_IMPORT_QUARANTINED_V1', 'YALKEN_MARKDOWN_LOCAL_V1'],
    ['YALKEN_TO_DOCX', 'YALKEN_INTERCHANGE_IR_V1', 'DOCX_EXPORT_BOUNDED_V1', 'YALKEN_DOCX_LOCAL_V1'],
    ['DOCX_TO_YALKEN', 'DOCX_PROFILE_V1', 'DOCX_IMPORT_QUARANTINED_V1', 'YALKEN_DOCX_LOCAL_V1'],
  ]],
  ['MC6_YALKEN_ARCHIVE_RESTORED_YALKEN_PDF', ['YALKEN', 'PROJECT_ARCHIVE', 'RESTORED_YALKEN', 'PDF'], [
    ['YALKEN_TO_PROJECT_ARCHIVE', 'YALKEN_PROJECT_SCHEMA_V1', 'PROJECT_ARCHIVE_EXPORT_V1', 'YALKEN_ARCHIVE_LOCAL_V1'],
    ['PROJECT_ARCHIVE_TO_RESTORED_YALKEN', 'YALKEN_PROJECT_ARCHIVE_V1', 'PROJECT_ARCHIVE_RESTORE_V1', 'YALKEN_ARCHIVE_LOCAL_V1'],
    ['RESTORED_YALKEN_TO_PDF', 'YALKEN_PROJECT_SCHEMA_V1', 'PDF_RENDER_OFFLINE_V1', 'YALKEN_PDF_LOCAL_V1'],
  ]],
  ['MC7_YALKEN_REVIEW_PACKET_DECISION_IMPORT_YALKEN', ['YALKEN', 'REVIEW_PACKET', 'DECISION_IMPORT', 'YALKEN'], [
    ['YALKEN_TO_REVIEW_PACKET', 'YALKEN_INTERCHANGE_IR_V1', 'REVIEW_PACKET_EXPORT_V1', 'YALKEN_REVIEW_LOCAL_V1'],
    ['REVIEW_PACKET_TO_DECISION_IMPORT', 'YALKEN_REVIEW_PACKET_V1', 'DECISION_IMPORT_EXPLICIT_V1', 'YALKEN_REVIEW_LOCAL_V1'],
    ['DECISION_IMPORT_TO_YALKEN', 'YALKEN_DECISION_SET_V1', 'SINGLE_SCENE_EXPLICIT_APPLY_V1', 'YALKEN_REVIEW_LOCAL_V1'],
  ]],
];

export const WP709_MIXED_CHAIN_DEFINITIONS = Object.freeze(rawDefinitions.map(([chainId, route, hops]) => Object.freeze({
  chainId,
  route: Object.freeze(route),
  hops: Object.freeze(hops.map(([hopId, schemaId, capabilityId, profileId], hopIndex) => Object.freeze({
    hopId,
    hopIndex,
    sourceFormat: route[hopIndex],
    targetFormat: route[hopIndex + 1],
    schemaId,
    capabilityId,
    profileId,
  }))),
})));

function failure(code, path = '') {
  const error = new Error(code);
  error.code = code;
  error.path = path;
  throw error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (utilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, keys, path) {
  if (!isPlainObject(value)) failure('WP709_OBJECT_REQUIRED', path);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || descriptors[key].get || descriptors[key].set)) {
    failure('WP709_DATA_PROPERTIES_ONLY', path);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) failure('WP709_EXACT_SHAPE', path);
  return value;
}

function string(value, path, { id = false } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.normalize('NFC') !== value || Buffer.byteLength(value, 'utf8') > MAX_STRING_BYTES) {
    failure('WP709_STRING_INVALID', path);
  }
  if (id && !ID_RE.test(value)) failure('WP709_ID_INVALID', path);
  return value;
}

function sha(value, path) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) failure('WP709_SHA256_INVALID', path);
  return value;
}

function integer(value, path, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) failure('WP709_INTEGER_INVALID', path);
  return value;
}

function bool(value, path) {
  if (typeof value !== 'boolean') failure('WP709_BOOLEAN_REQUIRED', path);
  return value;
}

function array(value, path, max = 256) {
  if (!Array.isArray(value) || value.length > max) failure('WP709_ARRAY_INVALID', path);
  return value;
}

function clean(value, path = '$', seen = new Set()) {
  if (typeof value === 'string') return string(value, path);
  if (typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'number') return integer(value, path, { min: Number.MIN_SAFE_INTEGER });
  if (Array.isArray(value)) {
    if (value.length > 1024) failure('WP709_BUDGET_EXCEEDED', path);
    if (seen.has(value)) failure('WP709_CYCLE_DENIED', path);
    seen.add(value);
    const result = value.map((entry, index) => clean(entry, `${path}[${index}]`, seen));
    seen.delete(value);
    return result;
  }
  if (!isPlainObject(value)) failure('WP709_PLAIN_JSON_ONLY', path);
  if (seen.has(value)) failure('WP709_CYCLE_DENIED', path);
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || descriptors[key].get || descriptors[key].set || descriptors[key].value === undefined)) {
    failure('WP709_DATA_PROPERTIES_ONLY', path);
  }
  const keys = Object.keys(value).sort();
  if (keys.length > 128) failure('WP709_BUDGET_EXCEEDED', path);
  const result = {};
  for (const key of keys) {
    string(key, `${path}.key`);
    result[key] = clean(value[key], `${path}.${key}`, seen);
  }
  seen.delete(value);
  return result;
}

export function canonicalMixedChainJson(value) {
  return JSON.stringify(clean(value));
}

export function sha256MixedChainValue(value) {
  return createHash('sha256').update(canonicalMixedChainJson(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function identity(value, path) {
  exactObject(value, ['entityId', 'generation', 'profileId', 'projectId', 'sourceRevision'], path);
  return {
    entityId: string(value.entityId, `${path}.entityId`),
    generation: integer(value.generation, `${path}.generation`, { min: 1 }),
    profileId: string(value.profileId, `${path}.profileId`, { id: true }),
    projectId: string(value.projectId, `${path}.projectId`),
    sourceRevision: string(value.sourceRevision, `${path}.sourceRevision`),
  };
}

function sameIdentity(left, right) {
  return left.entityId === right.entityId
    && left.generation === right.generation
    && left.projectId === right.projectId
    && left.sourceRevision === right.sourceRevision;
}

function evidenceBody(value, path) {
  exactObject(value, ['artifactSha256', 'atomId', 'chainId', 'generation', 'hopId', 'observationKind', 'observerId', 'provenanceStageId', 'sourceRevision'], path);
  return {
    artifactSha256: sha(value.artifactSha256, `${path}.artifactSha256`),
    atomId: string(value.atomId, `${path}.atomId`, { id: true }),
    chainId: string(value.chainId, `${path}.chainId`, { id: true }),
    generation: integer(value.generation, `${path}.generation`, { min: 1 }),
    hopId: string(value.hopId, `${path}.hopId`, { id: true }),
    observationKind: string(value.observationKind, `${path}.observationKind`, { id: true }),
    observerId: string(value.observerId, `${path}.observerId`, { id: true }),
    provenanceStageId: string(value.provenanceStageId, `${path}.provenanceStageId`, { id: true }),
    sourceRevision: string(value.sourceRevision, `${path}.sourceRevision`),
  };
}

export function sealMixedChainEvidenceAtom(value) {
  const body = evidenceBody(value, 'evidence');
  return deepFreeze({ ...body, atomSha256: sha256MixedChainValue(body) });
}

function validateEvidence(value, path, expected) {
  exactObject(value, ['artifactSha256', 'atomId', 'atomSha256', 'chainId', 'generation', 'hopId', 'observationKind', 'observerId', 'provenanceStageId', 'sourceRevision'], path);
  const atomSha256 = sha(value.atomSha256, `${path}.atomSha256`);
  const { atomSha256: _atomSha256, ...unsealed } = value;
  const body = evidenceBody(unsealed, path);
  if (sha256MixedChainValue(body) !== atomSha256) failure('WP709_EVIDENCE_HASH_MISMATCH', path);
  if (body.chainId !== expected.chainId || body.hopId !== expected.hopId || body.provenanceStageId !== WP709_STAGE_ID) failure('WP709_EVIDENCE_IDENTITY_MISMATCH', path);
  if (body.artifactSha256 !== expected.targetArtifactSha256 || body.sourceRevision !== expected.identity.sourceRevision || body.generation !== expected.identity.generation) {
    failure('WP709_EVIDENCE_REVISION_MISMATCH', path);
  }
  return { ...body, atomSha256 };
}

function loss(value, path) {
  exactObject(value, ['explanation', 'fieldId', 'lossType', 'previewable'], path);
  const lossType = string(value.lossType, `${path}.lossType`, { id: true });
  if (!LOSS_TYPES.has(lossType)) failure('WP709_LOSS_TYPE_INVALID', path);
  if (bool(value.previewable, `${path}.previewable`) !== true) failure('WP709_LOSS_NOT_PREVIEWABLE', path);
  return {
    explanation: string(value.explanation, `${path}.explanation`),
    fieldId: string(value.fieldId, `${path}.fieldId`, { id: true }),
    lossType,
    previewable: true,
  };
}

function fieldOutcome(value, path) {
  if (!isPlainObject(value)) failure('WP709_OBJECT_REQUIRED', path);
  if (value.outcome === 'PRESERVED') {
    exactObject(value, ['fieldId', 'outcome'], path);
    return { fieldId: string(value.fieldId, `${path}.fieldId`, { id: true }), outcome: 'PRESERVED' };
  }
  if (value.outcome === 'LOSS') {
    exactObject(value, ['explanation', 'fieldId', 'lossType', 'outcome', 'previewable'], path);
    const { outcome: _outcome, ...untyped } = value;
    return { ...loss(untyped, path), outcome: 'LOSS' };
  }
  failure('WP709_FIELD_OUTCOME_INVALID', path);
}

function ledgerEntryFromOutcome(outcome) {
  return {
    explanation: outcome.explanation,
    fieldId: outcome.fieldId,
    lossType: outcome.lossType,
    previewable: outcome.previewable,
  };
}

export function sealMixedChainLossLedger({ chainId, hopId, previousDigest, entries }) {
  string(chainId, 'ledger.chainId', { id: true });
  string(hopId, 'ledger.hopId', { id: true });
  sha(previousDigest, 'ledger.previousDigest');
  const normalizedEntries = array(entries, 'ledger.entries', MAX_LEDGER_ENTRIES).map((entry, index) => loss(entry, `ledger.entries[${index}]`));
  const ordered = [...normalizedEntries].sort((left, right) => left.fieldId.localeCompare(right.fieldId));
  if (new Set(ordered.map(entry => entry.fieldId)).size !== ordered.length || canonicalMixedChainJson(normalizedEntries) !== canonicalMixedChainJson(ordered)) {
    failure('WP709_LEDGER_ORDER_OR_DUPLICATE', 'ledger.entries');
  }
  const body = { chainId, entries: ordered, hopId, previousDigest };
  return deepFreeze({ ...body, digest: sha256MixedChainValue(body) });
}

function validateLedger(value, path, expected, previousEntries, newlyLost) {
  exactObject(value, ['chainId', 'digest', 'entries', 'hopId', 'previousDigest'], path);
  if (value.chainId !== expected.chainId || value.hopId !== expected.hopId || value.previousDigest !== expected.previousDigest) failure('WP709_LEDGER_LINK_MISMATCH', path);
  const sealed = sealMixedChainLossLedger({ chainId: value.chainId, entries: value.entries, hopId: value.hopId, previousDigest: value.previousDigest });
  if (sealed.digest !== value.digest) failure('WP709_LEDGER_HASH_MISMATCH', path);
  const prior = new Map(previousEntries.map(entry => [entry.fieldId, entry]));
  const current = new Map(sealed.entries.map(entry => [entry.fieldId, entry]));
  for (const [fieldId, entry] of prior) {
    if (!current.has(fieldId) || canonicalMixedChainJson(current.get(fieldId)) !== canonicalMixedChainJson(entry)) failure('WP709_LEDGER_NON_MONOTONE', path);
  }
  for (const entry of newlyLost) {
    if (!current.has(entry.fieldId) || canonicalMixedChainJson(current.get(entry.fieldId)) !== canonicalMixedChainJson(entry)) failure('WP709_SILENT_FIELD_DROP', path);
  }
  if (current.size !== new Set([...prior.keys(), ...newlyLost.map(entry => entry.fieldId)]).size) failure('WP709_LEDGER_UNEXPLAINED_ENTRY', path);
  return sealed;
}

function validateReparse(value, path, expected, producerIds) {
  exactObject(value, ['artifactSha256', 'independentFromProducer', 'parserId', 'semanticSha256'], path);
  const parserId = string(value.parserId, `${path}.parserId`, { id: true });
  if (producerIds.has(parserId) || bool(value.independentFromProducer, `${path}.independentFromProducer`) !== true) failure('WP709_REPARSE_NOT_INDEPENDENT', path);
  if (sha(value.artifactSha256, `${path}.artifactSha256`) !== expected.targetArtifactSha256) failure('WP709_REPARSE_TARGET_MISMATCH', path);
  return { artifactSha256: value.artifactSha256, independentFromProducer: true, parserId, semanticSha256: sha(value.semanticSha256, `${path}.semanticSha256`) };
}

function validateHop(value, path, definition, chain, previous) {
  exactObject(value, ['capabilityId', 'evidence', 'fieldOutcomes', 'hopId', 'hopIndex', 'identity', 'lossLedger', 'producerId', 'profileId', 'reparse', 'schemaId', 'sourceArtifactSha256', 'sourceFormat', 'status', 'targetArtifactSha256', 'targetFormat'], path);
  const status = string(value.status, `${path}.status`, { id: true });
  if (!CHAIN_STATUSES.has(status)) failure('WP709_STATUS_INVALID', path);
  if (value.hopId !== definition.hopId || value.hopIndex !== definition.hopIndex || value.sourceFormat !== definition.sourceFormat || value.targetFormat !== definition.targetFormat
    || value.schemaId !== definition.schemaId || value.capabilityId !== definition.capabilityId || value.profileId !== definition.profileId) failure('WP709_HOP_ORDER_OR_PROFILE_MISMATCH', path);
  const normalizedIdentity = identity(value.identity, `${path}.identity`);
  if (!sameIdentity(normalizedIdentity, chain.identity) || normalizedIdentity.profileId !== definition.profileId) failure('WP709_HOP_IDENTITY_MISMATCH', path);
  const sourceArtifactSha256 = sha(value.sourceArtifactSha256, `${path}.sourceArtifactSha256`);
  const targetArtifactSha256 = sha(value.targetArtifactSha256, `${path}.targetArtifactSha256`);
  if (sourceArtifactSha256 !== previous.artifactSha256) failure('WP709_ARTIFACT_CHAIN_BROKEN', path);
  const producerId = string(value.producerId, `${path}.producerId`, { id: true });
  if (status !== 'PASS') {
    if (value.evidence !== null || value.reparse !== null || value.lossLedger !== null || array(value.fieldOutcomes, `${path}.fieldOutcomes`, MAX_FIELDS).length !== 0) failure('WP709_PENDING_PRECLAIM', path);
    return { hop: clean(value, path), pending: true, artifactSha256: previous.artifactSha256, previousDigest: previous.previousDigest, entries: previous.entries, producerId };
  }
  const outcomes = array(value.fieldOutcomes, `${path}.fieldOutcomes`, MAX_FIELDS).map((entry, index) => fieldOutcome(entry, `${path}.fieldOutcomes[${index}]`));
  if (outcomes.length !== chain.declaredFields.length || canonicalMixedChainJson(outcomes.map(entry => entry.fieldId)) !== canonicalMixedChainJson(chain.declaredFields)) failure('WP709_FIELD_DENOMINATOR_MISMATCH', path);
  const currentLosses = outcomes.filter(entry => entry.outcome === 'LOSS').map(ledgerEntryFromOutcome);
  const priorLossIds = new Set(previous.entries.map(entry => entry.fieldId));
  for (const outcome of outcomes) if (priorLossIds.has(outcome.fieldId) && outcome.outcome !== 'LOSS') failure('WP709_DOWNSTREAM_ERASED_UPSTREAM_LOSS', path);
  const ledger = validateLedger(value.lossLedger, `${path}.lossLedger`, { chainId: chain.chainId, hopId: definition.hopId, previousDigest: previous.previousDigest }, previous.entries, currentLosses);
  const evidence = validateEvidence(value.evidence, `${path}.evidence`, { chainId: chain.chainId, hopId: definition.hopId, identity: chain.identity, targetArtifactSha256 });
  const reparse = validateReparse(value.reparse, `${path}.reparse`, { targetArtifactSha256 }, new Set([producerId]));
  return {
    hop: { ...clean(value, path), evidence, fieldOutcomes: outcomes, identity: normalizedIdentity, lossLedger: ledger, reparse },
    pending: false,
    artifactSha256: targetArtifactSha256,
    previousDigest: ledger.digest,
    entries: ledger.entries,
    producerId,
  };
}

function validateFinalOracle(value, path, chain, last, producerIds) {
  exactObject(value, ['authorityId', 'chainId', 'fieldOutcomes', 'generation', 'independent', 'oracleAtomSha256', 'oracleId', 'producerIds', 'semanticSha256', 'sourceRevision', 'targetArtifactSha256'], path);
  const oracleId = string(value.oracleId, `${path}.oracleId`, { id: true });
  const authorityId = string(value.authorityId, `${path}.authorityId`, { id: true });
  const listedProducers = array(value.producerIds, `${path}.producerIds`, 16).map((entry, index) => string(entry, `${path}.producerIds[${index}]`, { id: true }));
  if (bool(value.independent, `${path}.independent`) !== true || producerIds.has(oracleId) || producerIds.has(authorityId) || listedProducers.includes(oracleId) || listedProducers.includes(authorityId)) failure('WP709_FINAL_ORACLE_NOT_INDEPENDENT', path);
  if (canonicalMixedChainJson(listedProducers) !== canonicalMixedChainJson([...producerIds])) failure('WP709_FINAL_ORACLE_PRODUCER_DENOMINATOR', path);
  if (value.chainId !== chain.chainId || value.targetArtifactSha256 !== last.artifactSha256 || value.sourceRevision !== chain.identity.sourceRevision || value.generation !== chain.identity.generation) failure('WP709_FINAL_ORACLE_IDENTITY_MISMATCH', path);
  const outcomes = array(value.fieldOutcomes, `${path}.fieldOutcomes`, MAX_FIELDS).map((entry, index) => fieldOutcome(entry, `${path}.fieldOutcomes[${index}]`));
  if (outcomes.length !== chain.declaredFields.length || canonicalMixedChainJson(outcomes.map(entry => entry.fieldId)) !== canonicalMixedChainJson(chain.declaredFields)) failure('WP709_FINAL_ORACLE_DENOMINATOR', path);
  for (const entry of last.entries) {
    const outcome = outcomes.find(item => item.fieldId === entry.fieldId);
    if (!outcome || outcome.outcome !== 'LOSS' || canonicalMixedChainJson(ledgerEntryFromOutcome(outcome)) !== canonicalMixedChainJson(entry)) failure('WP709_FINAL_ORACLE_ERASED_LOSS', path);
  }
  const body = {
    authorityId,
    chainId: value.chainId,
    fieldOutcomes: outcomes,
    generation: value.generation,
    independent: true,
    oracleId,
    producerIds: listedProducers,
    semanticSha256: sha(value.semanticSha256, `${path}.semanticSha256`),
    sourceRevision: value.sourceRevision,
    targetArtifactSha256: sha(value.targetArtifactSha256, `${path}.targetArtifactSha256`),
  };
  if (sha(value.oracleAtomSha256, `${path}.oracleAtomSha256`) !== sha256MixedChainValue(body)) failure('WP709_FINAL_ORACLE_HASH_MISMATCH', path);
  return { ...body, oracleAtomSha256: value.oracleAtomSha256 };
}

export function sealMixedChainFinalOracle(value) {
  const normalized = clean(value, 'oracle');
  exactObject(normalized, ['authorityId', 'chainId', 'fieldOutcomes', 'generation', 'independent', 'oracleId', 'producerIds', 'semanticSha256', 'sourceRevision', 'targetArtifactSha256'], 'oracle');
  return deepFreeze({ ...normalized, oracleAtomSha256: sha256MixedChainValue(normalized) });
}

function validateChain(value, path, definition, topIdentity, evidenceIds, evidenceHashes, oracleHashes) {
  exactObject(value, ['chainId', 'cleanup', 'declaredFields', 'finalOracle', 'hops', 'identity', 'reportOnlySource', 'route', 'sourceSnapshotSha256', 'status'], path);
  if (value.chainId !== definition.chainId || canonicalMixedChainJson(value.route) !== canonicalMixedChainJson(definition.route)) failure('WP709_CHAIN_ORDER_MISMATCH', path);
  const status = string(value.status, `${path}.status`, { id: true });
  if (!CHAIN_STATUSES.has(status)) failure('WP709_STATUS_INVALID', path);
  const normalizedIdentity = identity(value.identity, `${path}.identity`);
  if (!sameIdentity(normalizedIdentity, topIdentity)) failure('WP709_CHAIN_IDENTITY_MISMATCH', path);
  const declaredFields = array(value.declaredFields, `${path}.declaredFields`, MAX_FIELDS).map((entry, index) => string(entry, `${path}.declaredFields[${index}]`, { id: true }));
  if (declaredFields.length === 0 || new Set(declaredFields).size !== declaredFields.length || canonicalMixedChainJson(declaredFields) !== canonicalMixedChainJson([...declaredFields].sort())) failure('WP709_FIELD_ORDER_OR_DUPLICATE', path);
  const sourceSnapshotSha256 = sha(value.sourceSnapshotSha256, `${path}.sourceSnapshotSha256`);
  exactObject(value.reportOnlySource, ['afterSha256', 'beforeSha256', 'unchanged'], `${path}.reportOnlySource`);
  if (value.reportOnlySource.beforeSha256 !== sourceSnapshotSha256 || value.reportOnlySource.afterSha256 !== sourceSnapshotSha256 || value.reportOnlySource.unchanged !== true) failure('WP709_REPORT_SOURCE_MUTATED', path);
  const hops = array(value.hops, `${path}.hops`, 6);
  if (hops.length !== definition.hops.length) failure('WP709_HOP_DENOMINATOR', path);
  const chain = { chainId: definition.chainId, declaredFields, identity: normalizedIdentity };
  let previous = { artifactSha256: sourceSnapshotSha256, entries: [], previousDigest: WP709_ZERO_SHA256 };
  let pendingSeen = false;
  const normalizedHops = [];
  const producerIds = new Set();
  for (let index = 0; index < hops.length; index += 1) {
    const result = validateHop(hops[index], `${path}.hops[${index}]`, definition.hops[index], chain, previous);
    if (pendingSeen && !result.pending) failure('WP709_EVIDENCE_AFTER_PENDING_GAP', path);
    pendingSeen ||= result.pending;
    if (!result.pending) {
      if (evidenceIds.has(result.hop.evidence.atomId) || evidenceHashes.has(result.hop.evidence.atomSha256)) failure('WP709_EVIDENCE_REUSED', path);
      evidenceIds.add(result.hop.evidence.atomId);
      evidenceHashes.add(result.hop.evidence.atomSha256);
    }
    if (producerIds.has(result.producerId)) failure('WP709_PRODUCER_REUSED_IN_CHAIN', path);
    producerIds.add(result.producerId);
    normalizedHops.push(result.hop);
    previous = result;
  }
  exactObject(value.cleanup, ['completed', 'remainingArtifacts', 'required'], `${path}.cleanup`);
  if (value.cleanup.required !== true || !Number.isSafeInteger(value.cleanup.remainingArtifacts) || value.cleanup.remainingArtifacts < 0) failure('WP709_CLEANUP_INVALID', path);
  if (status === 'PASS') {
    if (pendingSeen || value.finalOracle === null || value.cleanup.completed !== true || value.cleanup.remainingArtifacts !== 0) failure('WP709_PASS_WITHOUT_COMPLETE_EVIDENCE', path);
    const finalOracle = validateFinalOracle(value.finalOracle, `${path}.finalOracle`, chain, previous, producerIds);
    if (evidenceHashes.has(finalOracle.oracleAtomSha256) || oracleHashes.has(finalOracle.oracleAtomSha256)) failure('WP709_EVIDENCE_REUSED', path);
    oracleHashes.add(finalOracle.oracleAtomSha256);
    return { ...clean(value, path), cleanup: clean(value.cleanup), declaredFields, finalOracle, hops: normalizedHops, identity: normalizedIdentity, reportOnlySource: clean(value.reportOnlySource), route: [...definition.route], sourceSnapshotSha256, status };
  }
  if (!pendingSeen || value.finalOracle !== null || value.cleanup.completed !== false || value.cleanup.remainingArtifacts !== 0) failure('WP709_TYPED_PENDING_SHAPE', path);
  if (definition.chainId === 'MC3_YALKEN_DOCX_GOOGLE_OFFICE_DOCX_YALKEN' && !['ABSTAIN_TYPED', 'BLOCKED_TYPED'].includes(status)) failure('WP709_GOOGLE_OFFICE_MUST_ABSTAIN_OR_BLOCK', path);
  return { ...clean(value, path), cleanup: clean(value.cleanup), declaredFields, finalOracle: null, hops: normalizedHops, identity: normalizedIdentity, reportOnlySource: clean(value.reportOnlySource), route: [...definition.route], sourceSnapshotSha256, status };
}

function policy(value) {
  exactObject(value, ['automaticApply', 'multiSceneApply', 'productRuntimeNetwork', 'reportOnly', 'secondWriter', 'userDocuments'], 'policy');
  if (value.automaticApply !== false || value.multiSceneApply !== false || value.productRuntimeNetwork !== false || value.reportOnly !== true || value.secondWriter !== false || value.userDocuments !== 0) failure('WP709_POLICY_DENIED', 'policy');
  return clean(value, 'policy');
}

export function compileMixedChainEvidence(input = {}) {
  try {
    if (Buffer.byteLength(canonicalMixedChainJson(input), 'utf8') > MAX_JSON_BYTES) failure('WP709_BUDGET_EXCEEDED', '$');
    exactObject(input, ['chains', 'identity', 'missionDigest', 'policy', 'schemaVersion', 'stageId'], '$');
    if (input.schemaVersion !== WP709_MIXED_CHAIN_SCHEMA_VERSION || input.stageId !== WP709_STAGE_ID || input.missionDigest !== WP709_MISSION_DIGEST) failure('WP709_ENVELOPE_IDENTITY_MISMATCH', '$');
    const topIdentity = identity(input.identity, '$.identity');
    const chains = array(input.chains, '$.chains', 7);
    if (chains.length !== 7) failure('WP709_CHAIN_DENOMINATOR', '$.chains');
    const evidenceIds = new Set(), evidenceHashes = new Set(), oracleHashes = new Set();
    const normalizedChains = chains.map((chain, index) => validateChain(chain, `$.chains[${index}]`, WP709_MIXED_CHAIN_DEFINITIONS[index], topIdentity, evidenceIds, evidenceHashes, oracleHashes));
    const exactPassCount = normalizedChains.filter(chain => chain.status === 'PASS').length;
    const office = normalizedChains[2];
    const googleOfficeCompatQualified = office.status === 'PASS'
      && office.hops.slice(1, 3).every(hop => hop.profileId === 'GOOGLE_OFFICE_COMPAT_WP709_V1' && hop.evidence.provenanceStageId === WP709_STAGE_ID);
    const stageDone = exactPassCount === 7 && googleOfficeCompatQualified;
    const hasBlockedChain = normalizedChains.some(chain => chain.status === 'BLOCKED_TYPED');
    const body = {
      chainDenominator: 7,
      chains: normalizedChains,
      distinctEvidenceAtomDenominator: evidenceHashes.size + oracleHashes.size,
      exactPassCount,
      googleOfficeCompatQualified,
      identity: topIdentity,
      missionDigest: WP709_MISSION_DIGEST,
      policy: policy(input.policy),
      programDone: false,
      schemaVersion: WP709_MIXED_CHAIN_RESULT_SCHEMA_VERSION,
      stageDone,
      stageId: WP709_STAGE_ID,
      status: stageDone ? 'PASS' : hasBlockedChain ? 'BLOCKED_TYPED' : 'PENDING_EXTERNAL_PHYSICAL',
    };
    return deepFreeze({ ok: true, result: { ...body, resultDigest: sha256MixedChainValue(body) } });
  } catch (error) {
    return deepFreeze({ ok: false, code: error?.code || 'WP709_VALIDATION_FAILED', path: error?.path || '' });
  }
}

function admissionDenied(code) {
  return deepFreeze({ ok: false, code, decision: 'DENY', effectEligible: false, providerEffectAuthority: false });
}

export function evaluateMixedChainEffectAdmission(input = {}) {
  try {
    exactObject(input, ['capability', 'current', 'intent'], '$');
    exactObject(input.intent, ['artifactCount', 'automaticApply', 'entityId', 'generation', 'missionDigest', 'multiSceneApply', 'profileId', 'projectId', 'providerRole', 'sourceRevision', 'stageId', 'targetOwnership', 'userDocument'], '$.intent');
    exactObject(input.capability, ['allowedProfileId', 'allowedProviderRole', 'decisionDigest', 'expiresAtUtc', 'missionDigest', 'nonceSha256', 'stageId', 'status'], '$.capability');
    exactObject(input.current, ['artifactCount', 'entityId', 'generation', 'nowUtc', 'profileId', 'projectId', 'providerRole', 'sourceRevision', 'targetOwnership'], '$.current');
    const intent = input.intent, capability = input.capability, current = input.current;
    if (intent.stageId !== WP709_STAGE_ID || capability.stageId !== WP709_STAGE_ID || intent.missionDigest !== WP709_MISSION_DIGEST || capability.missionDigest !== WP709_MISSION_DIGEST) return admissionDenied('WP709_EFFECT_WRONG_STAGE');
    if (!PROVIDER_ROLES.has(intent.providerRole) || intent.providerRole !== capability.allowedProviderRole || intent.providerRole !== current.providerRole) return admissionDenied('WP709_EFFECT_PROVIDER_DENIED');
    if (intent.profileId !== capability.allowedProfileId || intent.profileId !== current.profileId) return admissionDenied('WP709_EFFECT_PROFILE_DENIED');
    if (capability.status !== 'APPROVED_SINGLE_DISPOSABLE_TARGET' || intent.targetOwnership !== 'TASK_CREATED_DISPOSABLE' || current.targetOwnership !== intent.targetOwnership) return admissionDenied('WP709_EFFECT_DEFAULT_DENY');
    if (intent.artifactCount !== 1 || current.artifactCount !== 1 || intent.automaticApply !== false || intent.multiSceneApply !== false || intent.userDocument !== false) return admissionDenied('WP709_EFFECT_TARGET_SET_DENIED');
    for (const key of ['entityId', 'generation', 'projectId', 'sourceRevision']) if (intent[key] !== current[key]) return admissionDenied('WP709_EFFECT_STALE_IDENTITY');
    const expires = Date.parse(string(capability.expiresAtUtc, '$.capability.expiresAtUtc'));
    const now = Date.parse(string(current.nowUtc, '$.current.nowUtc'));
    if (!Number.isFinite(expires) || !Number.isFinite(now) || expires < now) return admissionDenied('WP709_EFFECT_EXPIRED');
    sha(capability.decisionDigest, '$.capability.decisionDigest');
    sha(capability.nonceSha256, '$.capability.nonceSha256');
    const body = clean({ decisionDigest: capability.decisionDigest, intent, nonceSha256: capability.nonceSha256 });
    return deepFreeze({
      ok: true,
      code: 'WP709_EFFECT_ELIGIBLE_REQUIRES_ORCHESTRATOR_AND_COMMAND_KERNEL_REVALIDATION',
      decision: 'ELIGIBLE_REQUIRES_EXTERNAL_EXECUTOR',
      decisionDigest: sha256MixedChainValue(body),
      effectEligible: true,
      performsIo: false,
      productMutationAuthority: false,
      providerEffectAuthority: false,
      requiresCommandKernelRevalidation: true,
      requiresOrchestratorExecution: true,
    });
  } catch (error) {
    return admissionDenied(error?.code || 'WP709_EFFECT_DEFAULT_DENY');
  }
}

'use strict';

const { createHash } = require('node:crypto');

const WP709_STAGE_ID = 'WP-709_MIXED_CHAINS';
const WP709_MISSION_DIGEST = '2d188140211c4e2a65f0f1bf1bef5bac53e396e3c3887cb3563fa253a10b0c80';
const load = () => import('../../src/interchange/mixed-chain-fidelity-v1.mjs');

const WP709_FIELDS = Object.freeze(['BODY', 'COMMENT_ANCHORS', 'EMPHASIS', 'TITLE']);

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneWp709Fixture(value) {
  return JSON.parse(JSON.stringify(value));
}

const lossByChain = Object.freeze({
  MC3_YALKEN_DOCX_GOOGLE_OFFICE_DOCX_YALKEN: Object.freeze({ fieldId: 'EMPHASIS', at: 1, lossType: 'NORMALIZED', explanation: 'Office-compatible import normalizes the declared emphasis representation.' }),
  MC4_YALKEN_GOOGLE_NATIVE_DOCX_YALKEN: Object.freeze({ fieldId: 'COMMENT_ANCHORS', at: 0, lossType: 'DOWNGRADED', explanation: 'Native conversion exposes comment anchors as a previewable text note.' }),
  MC5_YALKEN_MARKDOWN_YALKEN_DOCX_YALKEN: Object.freeze({ fieldId: 'COMMENT_ANCHORS', at: 0, lossType: 'DOWNGRADED', explanation: 'Markdown carries comment anchors as an explicit previewable note.' }),
  MC6_YALKEN_ARCHIVE_RESTORED_YALKEN_PDF: Object.freeze({ fieldId: 'COMMENT_ANCHORS', at: 2, lossType: 'OMITTED_WITH_DISCLOSURE', explanation: 'The PDF target discloses comment anchors in the loss preview instead of interactive form.' }),
});

function outcomeFor(fieldId, losses) {
  const entry = losses.get(fieldId);
  return entry
    ? { explanation: entry.explanation, fieldId, lossType: entry.lossType, outcome: 'LOSS', previewable: true }
    : { fieldId, outcome: 'PRESERVED' };
}

function makeChain(api, definition, chainIndex, physical) {
  const sourceRevision = 'rev-wp709-fixture-001';
  const baseIdentity = {
    entityId: 'scene-wp709-fixture-001',
    generation: 7,
    profileId: 'WP709_MIXED_CHAIN_SOURCE_V1',
    projectId: 'project-wp709-fixture-001',
    sourceRevision,
  };
  const pendingFrom = physical === 'pass' || (physical === 'blocked-native' && chainIndex !== 3)
    ? Number.POSITIVE_INFINITY
    : physical === 'blocked-native' && chainIndex === 3 ? 2
      : chainIndex === 1 || chainIndex === 2 ? 1 : chainIndex === 3 ? 0 : Number.POSITIVE_INFINITY;
  const typedStatus = physical === 'blocked-native' && chainIndex === 3
    ? 'BLOCKED_TYPED'
    : chainIndex === 2 ? 'ABSTAIN_TYPED' : 'PENDING_EXTERNAL_PHYSICAL';
  const sourceSnapshotSha256 = sha256Text(`${definition.chainId}:source`);
  let sourceArtifactSha256 = sourceSnapshotSha256;
  let previousDigest = api.WP709_ZERO_SHA256;
  let entries = [];
  const losses = new Map();
  const producerIds = [];
  const hops = definition.hops.map((hopDefinition, hopIndex) => {
    const producerId = `WP709_PRODUCER_${chainIndex + 1}_${hopIndex + 1}`;
    producerIds.push(producerId);
    const pending = hopIndex >= pendingFrom;
    const targetArtifactSha256 = sha256Text(`${definition.chainId}:${hopDefinition.hopId}:target`);
    const common = {
      capabilityId: hopDefinition.capabilityId,
      evidence: null,
      fieldOutcomes: [],
      hopId: hopDefinition.hopId,
      hopIndex,
      identity: { ...baseIdentity, profileId: hopDefinition.profileId },
      lossLedger: null,
      producerId,
      profileId: hopDefinition.profileId,
      reparse: null,
      schemaId: hopDefinition.schemaId,
      sourceArtifactSha256,
      sourceFormat: hopDefinition.sourceFormat,
      status: pending ? typedStatus : 'PASS',
      targetArtifactSha256,
      targetFormat: hopDefinition.targetFormat,
    };
    if (pending) return common;
    const configuredLoss = lossByChain[definition.chainId];
    if (configuredLoss?.at === hopIndex) losses.set(configuredLoss.fieldId, configuredLoss);
    const fieldOutcomes = WP709_FIELDS.map(fieldId => outcomeFor(fieldId, losses));
    entries = [...losses.values()]
      .map(({ fieldId, lossType, explanation }) => ({ explanation, fieldId, lossType, previewable: true }))
      .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
    const lossLedger = api.sealMixedChainLossLedger({ chainId: definition.chainId, entries, hopId: hopDefinition.hopId, previousDigest });
    const evidence = api.sealMixedChainEvidenceAtom({
      artifactSha256: targetArtifactSha256,
      atomId: `WP709_ATOM_${chainIndex + 1}_${hopIndex + 1}`,
      chainId: definition.chainId,
      generation: baseIdentity.generation,
      hopId: hopDefinition.hopId,
      observationKind: pendingFrom === Number.POSITIVE_INFINITY && chainIndex >= 1 && chainIndex <= 3 ? 'WP709_SYNTHETIC_PHYSICAL_TEST_OBSERVATION' : 'WP709_LOCAL_REPARSE_OBSERVATION',
      observerId: `WP709_OBSERVER_${chainIndex + 1}_${hopIndex + 1}`,
      provenanceStageId: WP709_STAGE_ID,
      sourceRevision,
    });
    previousDigest = lossLedger.digest;
    sourceArtifactSha256 = targetArtifactSha256;
    return {
      ...common,
      evidence,
      fieldOutcomes,
      lossLedger,
      reparse: {
        artifactSha256: targetArtifactSha256,
        independentFromProducer: true,
        parserId: `WP709_REPARSER_${chainIndex + 1}_${hopIndex + 1}`,
        semanticSha256: sha256Text(`${definition.chainId}:${hopDefinition.hopId}:semantic`),
      },
      status: 'PASS',
    };
  });
  const pending = Number.isFinite(pendingFrom);
  const finalOutcomes = WP709_FIELDS.map(fieldId => outcomeFor(fieldId, losses));
  const finalOracle = pending ? null : api.sealMixedChainFinalOracle({
    authorityId: `WP709_ORACLE_AUTHORITY_${chainIndex + 1}`,
    chainId: definition.chainId,
    fieldOutcomes: finalOutcomes,
    generation: baseIdentity.generation,
    independent: true,
    oracleId: `WP709_FINAL_ORACLE_${chainIndex + 1}`,
    producerIds,
    semanticSha256: sha256Text(`${definition.chainId}:final-semantic-oracle`),
    sourceRevision,
    targetArtifactSha256: sourceArtifactSha256,
  });
  return {
    chainId: definition.chainId,
    cleanup: { completed: !pending, remainingArtifacts: 0, required: true },
    declaredFields: [...WP709_FIELDS],
    finalOracle,
    hops,
    identity: baseIdentity,
    reportOnlySource: { afterSha256: sourceSnapshotSha256, beforeSha256: sourceSnapshotSha256, unchanged: true },
    route: [...definition.route],
    sourceSnapshotSha256,
    status: pending ? typedStatus : 'PASS',
  };
}

async function makeWp709Fixture({ physical = 'pending' } = {}) {
  if (!['blocked-native', 'pending', 'pass'].includes(physical)) throw new Error('WP709_FIXTURE_MODE_INVALID');
  const api = await load();
  const chains = api.WP709_MIXED_CHAIN_DEFINITIONS.map((definition, chainIndex) => makeChain(api, definition, chainIndex, physical));
  return {
    chains,
    identity: {
      entityId: 'scene-wp709-fixture-001',
      generation: 7,
      profileId: 'WP709_MIXED_CHAIN_SOURCE_V1',
      projectId: 'project-wp709-fixture-001',
      sourceRevision: 'rev-wp709-fixture-001',
    },
    missionDigest: WP709_MISSION_DIGEST,
    policy: {
      automaticApply: false,
      multiSceneApply: false,
      productRuntimeNetwork: false,
      reportOnly: true,
      secondWriter: false,
      userDocuments: 0,
    },
    schemaVersion: api.WP709_MIXED_CHAIN_SCHEMA_VERSION,
    stageId: WP709_STAGE_ID,
  };
}

function makeWp709EffectAdmissionFixture({ providerRole = 'GOOGLE_OFFICE_COMPAT', profileId = 'GOOGLE_OFFICE_COMPAT_WP709_V1' } = {}) {
  const identity = {
    artifactCount: 1,
    entityId: 'scene-wp709-fixture-001',
    generation: 7,
    profileId,
    projectId: 'project-wp709-fixture-001',
    providerRole,
    sourceRevision: 'rev-wp709-fixture-001',
    targetOwnership: 'TASK_CREATED_DISPOSABLE',
  };
  return {
    capability: {
      allowedProfileId: profileId,
      allowedProviderRole: providerRole,
      decisionDigest: sha256Text('wp709-owner-decision'),
      expiresAtUtc: '2026-09-06T12:00:00.000Z',
      missionDigest: WP709_MISSION_DIGEST,
      nonceSha256: sha256Text('wp709-nonce'),
      stageId: WP709_STAGE_ID,
      status: 'APPROVED_SINGLE_DISPOSABLE_TARGET',
    },
    current: {
      ...identity,
      nowUtc: '2026-09-06T11:59:00.000Z',
    },
    intent: {
      ...identity,
      automaticApply: false,
      missionDigest: WP709_MISSION_DIGEST,
      multiSceneApply: false,
      stageId: WP709_STAGE_ID,
      userDocument: false,
    },
  };
}

module.exports = {
  WP709_FIELDS,
  cloneWp709Fixture,
  makeWp709EffectAdmissionFixture,
  makeWp709Fixture,
  sha256Text,
};

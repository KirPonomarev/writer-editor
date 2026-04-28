#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C15_RESTORE_DRILL_AND_QUARANTINE_OK';

const TASK_ID = 'B2C15_RESTORE_DRILL_AND_QUARANTINE';
const STATUS_BASENAME = 'B2C15_RESTORE_DRILL_AND_QUARANTINE_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const FIXED_TIMESTAMP = '2026-04-28T10:15:00.000Z';
const DONOR = Object.freeze({
  primaryBasename: 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip',
  primarySha256: '7189d8357f340d89112b02a57eb9315f9af4695ac00e3a2707801e4d97320791',
  consultedEntries: [
    'recovery-pack.js',
    'recovery-readable-quarantine.test.js',
  ],
  acceptedUse: 'B2C14_STYLE_AND_NEGATIVE_CASE_NAMING_ONLY',
  rejectedUse: 'NO_DONOR_RUNTIME_IMPORT_NO_BROAD_OVERLAY_NO_BLOCK2_EXIT_NO_B2C16_B2C17_B2C18',
});
const FALSE_SCOPE_CLAIMS = Object.freeze({
  b2c16MigrationClaim: false,
  b2c17KillpointClaim: false,
  b2c18PerfClaim: false,
  block2ExitClaim: false,
  uiTouched: false,
  dependencyChanged: false,
  exportChanged: false,
  networkOrCloud: false,
  schemaChanged: false,
  storageFormatChanged: false,
  generalImportExportClaim: false,
});

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function normalizeText(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function sceneVisibleText(scene) {
  return scene.blocks.map((block) => normalizeText(block.text)).join('\n');
}

function canonicalScene(scene) {
  return {
    schemaVersion: scene.schemaVersion,
    sceneId: scene.sceneId,
    title: scene.title,
    order: scene.order,
    blocks: scene.blocks.map((block) => ({
      blockId: block.blockId,
      sceneId: block.sceneId,
      text: normalizeText(block.text),
      type: block.type,
    })),
  };
}

function hashScene(scene) {
  return sha256Text(stableStringify(canonicalScene(scene)));
}

function canonicalManifestHashInput(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    formatVersion: manifest.formatVersion,
    projectId: manifest.projectId,
    title: manifest.title,
    sceneOrder: [...manifest.sceneOrder],
    scenes: cloneJson(manifest.scenes),
  };
}

function hashManifest(manifest) {
  return sha256Text(stableStringify(canonicalManifestHashInput(manifest)));
}

function buildSceneSummary(scene) {
  return {
    sceneId: scene.sceneId,
    title: scene.title,
    order: scene.order,
    blockIds: scene.blocks.map((block) => block.blockId),
    blockCount: scene.blocks.length,
    sceneHash: hashScene(scene),
    textHash: sha256Text(sceneVisibleText(scene)),
    visibleText: sceneVisibleText(scene),
    payload: cloneJson(scene),
  };
}

function buildFixtureSources() {
  return Object.freeze({
    single: {
      projectId: 'b2c15-single-scene-project',
      title: 'B2C15 Single Scene Fixture',
      scenes: [
        {
          schemaVersion: 1,
          sceneId: 'scene-single-001',
          title: 'Single Scene',
          order: 0,
          blocks: [
            {
              blockId: 'scene-single-001-block-001',
              sceneId: 'scene-single-001',
              type: 'heading',
              text: 'Single heading',
            },
            {
              blockId: 'scene-single-001-block-002',
              sceneId: 'scene-single-001',
              type: 'paragraph',
              text: 'Single scene body exact text.  ',
            },
          ],
        },
      ],
    },
    multi: {
      projectId: 'b2c15-multi-scene-project',
      title: 'B2C15 Multi Scene Fixture',
      scenes: [
        {
          schemaVersion: 1,
          sceneId: 'scene-multi-001',
          title: 'Opening',
          order: 0,
          blocks: [
            {
              blockId: 'scene-multi-001-block-001',
              sceneId: 'scene-multi-001',
              type: 'paragraph',
              text: 'Opening line alpha.',
            },
            {
              blockId: 'scene-multi-001-block-002',
              sceneId: 'scene-multi-001',
              type: 'paragraph',
              text: 'Opening line beta.',
            },
          ],
        },
        {
          schemaVersion: 1,
          sceneId: 'scene-multi-002',
          title: 'Counterpoint',
          order: 1,
          blocks: [
            {
              blockId: 'scene-multi-002-block-001',
              sceneId: 'scene-multi-002',
              type: 'heading',
              text: 'Counterpoint marker',
            },
            {
              blockId: 'scene-multi-002-block-002',
              sceneId: 'scene-multi-002',
              type: 'paragraph',
              text: 'Counterpoint exact text survives.',
            },
            {
              blockId: 'scene-multi-002-block-003',
              sceneId: 'scene-multi-002',
              type: 'paragraph',
              text: 'Trailing spaces survive here too.  ',
            },
          ],
        },
      ],
    },
  });
}

function buildFixtureProject(source) {
  const sceneSummaries = source.scenes.map((scene) => buildSceneSummary(scene));
  const manifestScenes = {};
  for (const scene of sceneSummaries) {
    manifestScenes[scene.sceneId] = {
      blockIds: [...scene.blockIds],
      deleted: false,
      hash: scene.sceneHash,
      id: scene.sceneId,
      textHash: scene.textHash,
      title: scene.title,
    };
  }
  const manifest = {
    schemaVersion: 1,
    formatVersion: 'writer-project-v1',
    projectId: source.projectId,
    title: source.title,
    sceneOrder: sceneSummaries.map((scene) => scene.sceneId),
    scenes: manifestScenes,
    manifestHash: '',
  };
  manifest.manifestHash = hashManifest(manifest);

  const recoverySnapshot = {
    schemaVersion: 1,
    recoveryFormat: 'writer-recovery-drill-v1',
    snapshotId: `${source.projectId}-snapshot-v1`,
    createdAtIso: FIXED_TIMESTAMP,
    projectId: source.projectId,
    projectTitle: source.title,
    sourceManifestHash: manifest.manifestHash,
    sceneCount: sceneSummaries.length,
    orderedScenes: sceneSummaries.map((scene) => ({
      sceneId: scene.sceneId,
      title: scene.title,
      order: scene.order,
      sceneHash: scene.sceneHash,
      textHash: scene.textHash,
      blockIds: [...scene.blockIds],
      payload: cloneJson(scene.payload),
    })),
    recoveryHash: '',
  };
  recoverySnapshot.recoveryHash = sha256Text(stableStringify({
    snapshotId: recoverySnapshot.snapshotId,
    projectId: recoverySnapshot.projectId,
    sourceManifestHash: recoverySnapshot.sourceManifestHash,
    orderedScenes: recoverySnapshot.orderedScenes.map((scene) => ({
      sceneId: scene.sceneId,
      order: scene.order,
      sceneHash: scene.sceneHash,
      textHash: scene.textHash,
      blockIds: scene.blockIds,
    })),
  }));

  return {
    fixtureId: `${source.projectId}-fixture-v1`,
    manifest,
    recoverySnapshot,
    sceneSummaries,
  };
}

function validateScenePayload(scene) {
  if (!isObjectRecord(scene)) {
    return {
      ok: false,
      code: 'E_B2C15_CORRUPT_SCENE',
      disposition: 'quarantine',
      reason: 'Scene payload must be an object.',
    };
  }
  if (scene.schemaVersion !== 1) {
    return {
      ok: false,
      code: 'E_B2C15_UNKNOWN_VERSION',
      disposition: 'stop',
      reason: 'Scene schema version is not admitted for clean restore.',
    };
  }
  if (typeof scene.sceneId !== 'string' || scene.sceneId.length === 0) {
    return {
      ok: false,
      code: 'E_B2C15_CORRUPT_SCENE',
      disposition: 'quarantine',
      reason: 'Scene id is missing.',
    };
  }
  if (!Number.isInteger(scene.order) || scene.order < 0) {
    return {
      ok: false,
      code: 'E_B2C15_CORRUPT_SCENE',
      disposition: 'quarantine',
      reason: 'Scene order must be a non-negative integer.',
    };
  }
  if (!Array.isArray(scene.blocks) || scene.blocks.length === 0) {
    return {
      ok: false,
      code: 'E_B2C15_MISSING_BLOCK',
      disposition: 'stop',
      reason: 'Scene blocks are missing.',
    };
  }

  const seenBlockIds = new Set();
  for (const block of scene.blocks) {
    if (!isObjectRecord(block)) {
      return {
        ok: false,
        code: 'E_B2C15_CORRUPT_SCENE',
        disposition: 'quarantine',
        reason: 'Block payload must be an object.',
      };
    }
    if (typeof block.blockId !== 'string' || block.blockId.length === 0) {
      return {
        ok: false,
        code: 'E_B2C15_MISSING_BLOCK',
        disposition: 'stop',
        reason: 'Block id is missing.',
      };
    }
    if (seenBlockIds.has(block.blockId)) {
      return {
        ok: false,
        code: 'E_B2C15_CORRUPT_SCENE',
        disposition: 'quarantine',
        reason: 'Duplicate block id detected.',
      };
    }
    seenBlockIds.add(block.blockId);
    if (block.sceneId !== scene.sceneId) {
      return {
        ok: false,
        code: 'E_B2C15_CORRUPT_SCENE',
        disposition: 'quarantine',
        reason: 'Block parent scene id does not match scene id.',
      };
    }
    if (typeof block.type !== 'string' || block.type.length === 0) {
      return {
        ok: false,
        code: 'E_B2C15_CORRUPT_SCENE',
        disposition: 'quarantine',
        reason: 'Block type is missing.',
      };
    }
    if (typeof block.text !== 'string') {
      return {
        ok: false,
        code: 'E_B2C15_CORRUPT_SCENE',
        disposition: 'quarantine',
        reason: 'Block text must be a string.',
      };
    }
  }

  return {
    ok: true,
    summary: buildSceneSummary(scene),
  };
}

function buildQuarantineArtifact(input) {
  const readableSummary = `Scene ${input.sceneId} moved to quarantine: ${input.reason}.`;
  const quarantineHash = sha256Text(stableStringify({
    originalTextHash: input.originalTextHash,
    readableSummary,
    reason: input.reason,
    sceneId: input.sceneId,
  }));
  return {
    schemaVersion: 1,
    artifactType: 'b2c15.quarantine.artifact.v1',
    taskId: TASK_ID,
    createdAtIso: FIXED_TIMESTAMP,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    sceneId: input.sceneId,
    title: input.title,
    sceneOrder: input.sceneOrder,
    reason: input.reason,
    readableSummary,
    originalTextHash: input.originalTextHash,
    quarantineHash,
    openClean: false,
    uiFlow: false,
    supportBundle: false,
  };
}

function validateQuarantineArtifact(artifact) {
  const failRows = [];
  if (!isObjectRecord(artifact)) failRows.push('ARTIFACT_OBJECT_REQUIRED');
  if (!isObjectRecord(artifact) || artifact.schemaVersion !== 1) failRows.push('ARTIFACT_SCHEMA_VERSION_INVALID');
  if (!isObjectRecord(artifact) || artifact.artifactType !== 'b2c15.quarantine.artifact.v1') failRows.push('ARTIFACT_TYPE_INVALID');
  if (!isObjectRecord(artifact) || typeof artifact.sceneId !== 'string' || artifact.sceneId.length === 0) failRows.push('ARTIFACT_SCENE_ID_REQUIRED');
  if (!isObjectRecord(artifact) || typeof artifact.reason !== 'string' || artifact.reason.length === 0) failRows.push('ARTIFACT_REASON_REQUIRED');
  if (!isObjectRecord(artifact) || typeof artifact.readableSummary !== 'string' || artifact.readableSummary.length === 0) failRows.push('ARTIFACT_SUMMARY_REQUIRED');
  if (!isObjectRecord(artifact) || typeof artifact.originalTextHash !== 'string' || artifact.originalTextHash.length === 0) failRows.push('ARTIFACT_ORIGINAL_TEXT_HASH_REQUIRED');
  if (!isObjectRecord(artifact) || typeof artifact.quarantineHash !== 'string' || artifact.quarantineHash.length === 0) failRows.push('ARTIFACT_QUARANTINE_HASH_REQUIRED');
  if (!isObjectRecord(artifact) || artifact.openClean !== false) failRows.push('ARTIFACT_OPEN_CLEAN_FALSE_REQUIRED');
  if (!isObjectRecord(artifact) || artifact.uiFlow !== false) failRows.push('ARTIFACT_UI_FLOW_FALSE_REQUIRED');
  if (!isObjectRecord(artifact) || artifact.supportBundle !== false) failRows.push('ARTIFACT_SUPPORT_BUNDLE_FALSE_REQUIRED');

  if (failRows.length === 0) {
    const expectedHash = sha256Text(stableStringify({
      originalTextHash: artifact.originalTextHash,
      readableSummary: artifact.readableSummary,
      reason: artifact.reason,
      sceneId: artifact.sceneId,
    }));
    if (artifact.quarantineHash !== expectedHash) failRows.push('ARTIFACT_QUARANTINE_HASH_INVALID');
  }

  return {
    ok: failRows.length === 0,
    code: failRows.length === 0 ? '' : 'E_B2C15_QUARANTINE_ARTIFACT_INVALID',
    failRows,
  };
}

function replayRecoverySnapshot(snapshot, options = {}) {
  const expectedManifestHash = String(options.expectedManifestHash || '');
  const expectedSceneIds = Array.isArray(options.expectedSceneIds) ? [...options.expectedSceneIds] : [];
  const failRows = [];
  const acceptedScenes = [];
  const quarantinedArtifacts = [];
  const stopReasons = new Set();

  if (!isObjectRecord(snapshot) || !Array.isArray(snapshot.orderedScenes)) {
    return {
      ok: false,
      mode: 'STOP',
      code: 'E_B2C15_SNAPSHOT_UNREADABLE',
      failRows: ['RECOVERY_SNAPSHOT_UNREADABLE'],
      acceptedScenes,
      quarantinedArtifacts,
      restoredProject: null,
    };
  }

  if (expectedManifestHash && snapshot.sourceManifestHash !== expectedManifestHash) {
    stopReasons.add('STALE_SNAPSHOT');
    failRows.push('SOURCE_MANIFEST_HASH_MISMATCH');
  }

  if (!Number.isInteger(snapshot.sceneCount) || snapshot.sceneCount !== snapshot.orderedScenes.length) {
    stopReasons.add('SILENT_MERGE_REJECTED');
    failRows.push('RECOVERY_SCENE_SET_INCOMPLETE');
  }

  if (expectedSceneIds.length > 0) {
    const actualSceneIds = snapshot.orderedScenes.map((entry) => entry.sceneId);
    if (stableStringify(actualSceneIds) !== stableStringify(expectedSceneIds)) {
      stopReasons.add('SILENT_MERGE_REJECTED');
      failRows.push('RECOVERY_SCENE_ID_SET_MISMATCH');
    }
  }

  for (const entry of snapshot.orderedScenes) {
    const validation = validateScenePayload(entry.payload);
    if (!validation.ok) {
      if (validation.disposition === 'quarantine') {
        quarantinedArtifacts.push(buildQuarantineArtifact({
          projectId: snapshot.projectId,
          snapshotId: snapshot.snapshotId,
          sceneId: String(entry.sceneId || ''),
          title: String(entry.title || ''),
          sceneOrder: Number.isInteger(entry.order) ? entry.order : null,
          reason: validation.reason,
          originalTextHash: String(entry.textHash || ''),
        }));
        failRows.push(`SCENE_QUARANTINED_${String(entry.sceneId || 'unknown')}`);
      } else {
        stopReasons.add(validation.code === 'E_B2C15_UNKNOWN_VERSION' ? 'UNKNOWN_VERSION' : 'MISSING_BLOCK');
        failRows.push(
          validation.code === 'E_B2C15_UNKNOWN_VERSION'
            ? `SCENE_VERSION_UNSUPPORTED_${String(entry.sceneId || 'unknown')}`
            : `SCENE_BLOCK_SET_INVALID_${String(entry.sceneId || 'unknown')}`,
        );
      }
      continue;
    }

    const summary = validation.summary;
    if (summary.sceneHash !== entry.sceneHash || summary.textHash !== entry.textHash) {
      stopReasons.add('HASH_MISMATCH');
      failRows.push(`SCENE_HASH_OR_TEXT_HASH_MISMATCH_${summary.sceneId}`);
      continue;
    }
    if (stableStringify(summary.blockIds) !== stableStringify(entry.blockIds)) {
      stopReasons.add('MISSING_BLOCK');
      failRows.push(`BLOCK_ID_SET_MISMATCH_${summary.sceneId}`);
      continue;
    }
    acceptedScenes.push(summary);
  }

  if (quarantinedArtifacts.length > 0) {
    return {
      ok: false,
      mode: 'QUARANTINE',
      code: 'E_B2C15_QUARANTINE_REQUIRED',
      failRows: [...failRows, 'OPEN_CLEAN_DENIED'],
      acceptedScenes,
      quarantinedArtifacts,
      restoredProject: null,
    };
  }

  if (stopReasons.size > 0) {
    const code = stopReasons.has('STALE_SNAPSHOT')
      ? 'E_B2C15_STALE_SNAPSHOT'
      : stopReasons.has('UNKNOWN_VERSION')
        ? 'E_B2C15_UNKNOWN_VERSION'
        : stopReasons.has('HASH_MISMATCH')
          ? 'E_B2C15_HASH_MISMATCH'
          : stopReasons.has('MISSING_BLOCK')
            ? 'E_B2C15_MISSING_BLOCK'
            : 'E_B2C15_SILENT_MERGE_REJECTED';
    return {
      ok: false,
      mode: 'STOP',
      code,
      failRows,
      acceptedScenes,
      quarantinedArtifacts,
      restoredProject: null,
    };
  }

  const manifestScenes = {};
  for (const scene of acceptedScenes) {
    manifestScenes[scene.sceneId] = {
      blockIds: [...scene.blockIds],
      deleted: false,
      hash: scene.sceneHash,
      id: scene.sceneId,
      textHash: scene.textHash,
      title: scene.title,
    };
  }
  const restoredManifest = {
    schemaVersion: 1,
    formatVersion: 'writer-project-v1',
    projectId: snapshot.projectId,
    title: snapshot.projectTitle,
    sceneOrder: acceptedScenes.map((scene) => scene.sceneId),
    scenes: manifestScenes,
    manifestHash: '',
  };
  restoredManifest.manifestHash = hashManifest(restoredManifest);

  return {
    ok: true,
    mode: 'OPEN_CLEAN',
    code: '',
    failRows,
    acceptedScenes,
    quarantinedArtifacts,
    restoredProject: {
      manifest: restoredManifest,
      sceneSummaries: acceptedScenes,
    },
  };
}

function compareProjects(originalProject, restoredProject) {
  const originalSceneIds = originalProject.manifest.sceneOrder;
  const restoredSceneIds = restoredProject.manifest.sceneOrder;
  return {
    textHashEquality: originalProject.sceneSummaries.every((scene, index) => scene.textHash === restoredProject.sceneSummaries[index].textHash),
    sceneOrderEquality: stableStringify(originalSceneIds) === stableStringify(restoredSceneIds),
    blockOrderEquality: originalProject.sceneSummaries.every((scene, index) => stableStringify(scene.blockIds) === stableStringify(restoredProject.sceneSummaries[index].blockIds)),
  };
}

function evaluateRestoreCases(fixtures) {
  const singleReplay = replayRecoverySnapshot(fixtures.single.recoverySnapshot, {
    expectedManifestHash: fixtures.single.manifest.manifestHash,
    expectedSceneIds: fixtures.single.manifest.sceneOrder,
  });
  const multiReplay = replayRecoverySnapshot(fixtures.multi.recoverySnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });
  const singleEquality = compareProjects(fixtures.single, singleReplay.restoredProject);
  const multiEquality = compareProjects(fixtures.multi, multiReplay.restoredProject);

  const hashMismatchSnapshot = cloneJson(fixtures.multi.recoverySnapshot);
  hashMismatchSnapshot.orderedScenes[0].textHash = sha256Text('tampered-text-hash');
  const hashMismatchReplay = replayRecoverySnapshot(hashMismatchSnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });

  const unknownVersionSnapshot = cloneJson(fixtures.multi.recoverySnapshot);
  unknownVersionSnapshot.orderedScenes[0].payload.schemaVersion = 2;
  const unknownVersionReplay = replayRecoverySnapshot(unknownVersionSnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });

  const missingBlockSnapshot = cloneJson(fixtures.multi.recoverySnapshot);
  missingBlockSnapshot.orderedScenes[1].blockIds = [
    'scene-multi-002-block-001',
    'scene-multi-002-block-002',
  ];
  const missingBlockReplay = replayRecoverySnapshot(missingBlockSnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });

  const staleSnapshot = cloneJson(fixtures.multi.recoverySnapshot);
  staleSnapshot.sourceManifestHash = sha256Text('stale-manifest');
  const staleReplay = replayRecoverySnapshot(staleSnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });

  const silentMergeSnapshot = cloneJson(fixtures.multi.recoverySnapshot);
  silentMergeSnapshot.orderedScenes = [silentMergeSnapshot.orderedScenes[0]];
  silentMergeSnapshot.sceneCount = 2;
  const silentMergeReplay = replayRecoverySnapshot(silentMergeSnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });

  return {
    positiveCases: [
      {
        caseId: 'POSITIVE_SINGLE_SCENE_RESTORE',
        ok: singleReplay.ok === true && singleReplay.mode === 'OPEN_CLEAN',
        replayMode: singleReplay.mode,
        sourceManifestHash: fixtures.single.manifest.manifestHash,
        restoredManifestHash: singleReplay.restoredProject.manifest.manifestHash,
        recoveryHash: fixtures.single.recoverySnapshot.recoveryHash,
        textHashEquality: singleEquality.textHashEquality,
        sceneOrderEquality: singleEquality.sceneOrderEquality,
        blockOrderEquality: singleEquality.blockOrderEquality,
        sceneCount: singleReplay.restoredProject.manifest.sceneOrder.length,
      },
      {
        caseId: 'POSITIVE_MULTI_SCENE_RESTORE',
        ok: multiReplay.ok === true && multiReplay.mode === 'OPEN_CLEAN',
        replayMode: multiReplay.mode,
        sourceManifestHash: fixtures.multi.manifest.manifestHash,
        restoredManifestHash: multiReplay.restoredProject.manifest.manifestHash,
        recoveryHash: fixtures.multi.recoverySnapshot.recoveryHash,
        textHashEquality: multiEquality.textHashEquality,
        sceneOrderEquality: multiEquality.sceneOrderEquality,
        blockOrderEquality: multiEquality.blockOrderEquality,
        sceneCount: multiReplay.restoredProject.manifest.sceneOrder.length,
      },
    ],
    negativeCases: [
      {
        caseId: 'NEGATIVE_HASH_MISMATCH_STOPS',
        ok: hashMismatchReplay.ok === false && hashMismatchReplay.mode === 'STOP' && hashMismatchReplay.code === 'E_B2C15_HASH_MISMATCH',
        observedCode: hashMismatchReplay.code,
        observedMode: hashMismatchReplay.mode,
        failRows: hashMismatchReplay.failRows,
      },
      {
        caseId: 'NEGATIVE_UNKNOWN_VERSION_NOT_CLEAN',
        ok: unknownVersionReplay.ok === false && unknownVersionReplay.mode === 'STOP' && unknownVersionReplay.code === 'E_B2C15_UNKNOWN_VERSION',
        observedCode: unknownVersionReplay.code,
        observedMode: unknownVersionReplay.mode,
        failRows: unknownVersionReplay.failRows,
      },
      {
        caseId: 'NEGATIVE_MISSING_BLOCK_STOPS',
        ok: missingBlockReplay.ok === false && missingBlockReplay.mode === 'STOP' && missingBlockReplay.code === 'E_B2C15_MISSING_BLOCK',
        observedCode: missingBlockReplay.code,
        observedMode: missingBlockReplay.mode,
        failRows: missingBlockReplay.failRows,
      },
      {
        caseId: 'NEGATIVE_STALE_SNAPSHOT_REJECTED',
        ok: staleReplay.ok === false && staleReplay.mode === 'STOP' && staleReplay.code === 'E_B2C15_STALE_SNAPSHOT',
        observedCode: staleReplay.code,
        observedMode: staleReplay.mode,
        failRows: staleReplay.failRows,
      },
      {
        caseId: 'NEGATIVE_SILENT_MERGE_REJECTED',
        ok: silentMergeReplay.ok === false && silentMergeReplay.mode === 'STOP' && silentMergeReplay.code === 'E_B2C15_SILENT_MERGE_REJECTED',
        observedCode: silentMergeReplay.code,
        observedMode: silentMergeReplay.mode,
        failRows: silentMergeReplay.failRows,
      },
    ],
    equality: {
      textHashEqualityOk: singleEquality.textHashEquality && multiEquality.textHashEquality,
      sceneOrderEqualityOk: singleEquality.sceneOrderEquality && multiEquality.sceneOrderEquality,
      blockOrderEqualityOk: singleEquality.blockOrderEquality && multiEquality.blockOrderEquality,
    },
  };
}

function evaluateQuarantineCase(fixtures) {
  const corruptSceneSnapshot = cloneJson(fixtures.multi.recoverySnapshot);
  corruptSceneSnapshot.orderedScenes[1].payload.blocks[0].sceneId = 'scene-other-parent';
  const corruptReplay = replayRecoverySnapshot(corruptSceneSnapshot, {
    expectedManifestHash: fixtures.multi.manifest.manifestHash,
    expectedSceneIds: fixtures.multi.manifest.sceneOrder,
  });
  const artifact = corruptReplay.quarantinedArtifacts[0] || null;
  const artifactValidation = validateQuarantineArtifact(artifact);

  return {
    case: {
      caseId: 'NEGATIVE_CORRUPT_SCENE_QUARANTINED',
      ok: corruptReplay.ok === false && corruptReplay.mode === 'QUARANTINE' && corruptReplay.code === 'E_B2C15_QUARANTINE_REQUIRED' && artifactValidation.ok,
      observedCode: corruptReplay.code,
      observedMode: corruptReplay.mode,
      failRows: corruptReplay.failRows,
      acceptedSceneCount: corruptReplay.acceptedScenes.length,
      quarantinedSceneCount: corruptReplay.quarantinedArtifacts.length,
    },
    artifact,
    artifactValidation,
  };
}

function buildInitialCommandResults() {
  return {
    taskId: TASK_ID,
    status: 'PENDING_EXECUTION_LOG_UPDATE',
    allPassed: null,
    commands: [
      {
        command: 'node scripts/ops/b2c15-restore-drill-and-quarantine-state.mjs --write --json',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
      {
        command: 'node --test test/contracts/b2c15-restore-drill-and-quarantine.contract.test.js',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
      {
        command: 'node --test test/contracts/b2c14-recovery-readable-proof.contract.test.js',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
      {
        command: 'node --test test/contracts/b2c13-save-reopen-text-no-loss.contract.test.js',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
      {
        command: 'node scripts/ops/b2c12-persist-effects-atomic-write-state.mjs --json',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
      {
        command: 'npm run oss:policy',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
      {
        command: 'git diff --name-only -- package.json package-lock.json src/renderer/index.html src/renderer/styles.css',
        exitCode: null,
        result: 'PENDING',
        summary: 'Awaiting required execution log update.',
      },
    ],
  };
}

export async function evaluateB2C15RestoreDrillAndQuarantineState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const fixtureSources = buildFixtureSources();
  const fixtures = {
    single: buildFixtureProject(fixtureSources.single),
    multi: buildFixtureProject(fixtureSources.multi),
  };
  const restoreCases = evaluateRestoreCases(fixtures);
  const quarantineCase = evaluateQuarantineCase(fixtures);
  const scope = cloneJson(FALSE_SCOPE_CLAIMS);
  const failRows = [];

  if (!restoreCases.positiveCases.every((entry) => entry.ok === true)) failRows.push('POSITIVE_RESTORE_CASE_RED');
  if (!restoreCases.negativeCases.every((entry) => entry.ok === true)) failRows.push('NEGATIVE_RESTORE_CASE_RED');
  if (!restoreCases.equality.textHashEqualityOk) failRows.push('TEXT_HASH_EQUALITY_RED');
  if (!restoreCases.equality.sceneOrderEqualityOk) failRows.push('SCENE_ORDER_EQUALITY_RED');
  if (!restoreCases.equality.blockOrderEqualityOk) failRows.push('BLOCK_ORDER_EQUALITY_RED');
  if (!quarantineCase.case.ok) failRows.push('CORRUPT_SCENE_QUARANTINE_RED');
  if (!quarantineCase.artifactValidation.ok) failRows.push('QUARANTINE_ARTIFACT_RED');

  return {
    artifactId: 'B2C15_RESTORE_DRILL_AND_QUARANTINE_STATUS_V1',
    schemaVersion: 1,
    taskId: TASK_ID,
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C15_RESTORE_DRILL_AND_QUARANTINE_RED',
    failRows,
    donor: DONOR,
    scope,
    proof: {
      repoBound: true,
      deterministicFixtureReplayOnly: true,
      hashAlgorithm: 'sha256',
      scopeClaims: cloneJson(scope),
      singleSceneRestoreOk: restoreCases.positiveCases[0].ok,
      multiSceneRestoreOk: restoreCases.positiveCases[1].ok,
      textHashEqualityOk: restoreCases.equality.textHashEqualityOk,
      sceneOrderEqualityOk: restoreCases.equality.sceneOrderEqualityOk,
      blockOrderEqualityOk: restoreCases.equality.blockOrderEqualityOk,
      corruptSceneQuarantinedOk: quarantineCase.case.ok,
      hashMismatchStoppedOk: restoreCases.negativeCases.some((entry) => entry.caseId === 'NEGATIVE_HASH_MISMATCH_STOPS' && entry.ok),
      unknownVersionNotCleanOk: restoreCases.negativeCases.some((entry) => entry.caseId === 'NEGATIVE_UNKNOWN_VERSION_NOT_CLEAN' && entry.ok),
      missingBlockStoppedOk: restoreCases.negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_BLOCK_STOPS' && entry.ok),
      staleSnapshotRejectedOk: restoreCases.negativeCases.some((entry) => entry.caseId === 'NEGATIVE_STALE_SNAPSHOT_REJECTED' && entry.ok),
      silentMergeRejectedOk: restoreCases.negativeCases.some((entry) => entry.caseId === 'NEGATIVE_SILENT_MERGE_REJECTED' && entry.ok),
      machineWrittenReadableArtifactOk: quarantineCase.artifactValidation.ok,
    },
    runtime: {
      fixtures: {
        single: {
          fixtureId: fixtures.single.fixtureId,
          manifestHash: fixtures.single.manifest.manifestHash,
          recoveryHash: fixtures.single.recoverySnapshot.recoveryHash,
          sceneOrder: fixtures.single.manifest.sceneOrder,
        },
        multi: {
          fixtureId: fixtures.multi.fixtureId,
          manifestHash: fixtures.multi.manifest.manifestHash,
          recoveryHash: fixtures.multi.recoverySnapshot.recoveryHash,
          sceneOrder: fixtures.multi.manifest.sceneOrder,
        },
      },
      positiveCases: restoreCases.positiveCases,
      negativeCases: restoreCases.negativeCases,
      quarantineCase: quarantineCase.case,
      quarantineArtifact: quarantineCase.artifact,
      quarantineArtifactValidation: quarantineCase.artifactValidation,
    },
  };
}

async function writeJsonAtomic(targetPath, value) {
  const tempPath = `${targetPath}.tmp`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(tempPath, `${stableStringify(value)}\n`, 'utf8');
  await fsp.rename(tempPath, targetPath);
}

async function writeStateArtifacts(repoRoot, state) {
  const statusPath = path.join(repoRoot, 'docs', 'OPS', 'STATUS', STATUS_BASENAME);
  const evidencePath = path.join(repoRoot, EVIDENCE_DIR);
  await fsp.mkdir(evidencePath, { recursive: true });

  await writeJsonAtomic(statusPath, state);
  await writeJsonAtomic(path.join(evidencePath, 'restore-drill-proof.json'), {
    proof: {
      singleSceneRestoreOk: state.proof.singleSceneRestoreOk,
      multiSceneRestoreOk: state.proof.multiSceneRestoreOk,
      textHashEqualityOk: state.proof.textHashEqualityOk,
      sceneOrderEqualityOk: state.proof.sceneOrderEqualityOk,
      blockOrderEqualityOk: state.proof.blockOrderEqualityOk,
      hashMismatchStoppedOk: state.proof.hashMismatchStoppedOk,
      unknownVersionNotCleanOk: state.proof.unknownVersionNotCleanOk,
      missingBlockStoppedOk: state.proof.missingBlockStoppedOk,
      staleSnapshotRejectedOk: state.proof.staleSnapshotRejectedOk,
      silentMergeRejectedOk: state.proof.silentMergeRejectedOk,
    },
    runtime: {
      fixtures: state.runtime.fixtures,
      positiveCases: state.runtime.positiveCases,
      negativeCases: state.runtime.negativeCases,
    },
  });
  await writeJsonAtomic(path.join(evidencePath, 'quarantine-proof.json'), {
    proof: {
      corruptSceneQuarantinedOk: state.proof.corruptSceneQuarantinedOk,
      machineWrittenReadableArtifactOk: state.proof.machineWrittenReadableArtifactOk,
    },
    artifact: state.runtime.quarantineArtifact,
    runtime: {
      quarantineCase: state.runtime.quarantineCase,
      quarantineArtifactValidation: state.runtime.quarantineArtifactValidation,
    },
  });
  await writeJsonAtomic(path.join(evidencePath, 'donor-mapping.json'), {
    donor: state.donor,
    mappedContour: TASK_ID,
    acceptedUse: state.donor.acceptedUse,
    rejectedUse: state.donor.rejectedUse,
    referenceArchivesConsulted: [state.donor.primaryBasename],
    consultedEntries: state.donor.consultedEntries,
  });
  await writeJsonAtomic(path.join(evidencePath, 'command-results.json'), buildInitialCommandResults());
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C15RestoreDrillAndQuarantineState({ repoRoot });
  if (args.write) {
    await writeStateArtifacts(repoRoot, state);
  }
  process.stdout.write(`${stableStringify(state)}\n`);
  if (!args.json) {
    process.stdout.write('');
  }
}

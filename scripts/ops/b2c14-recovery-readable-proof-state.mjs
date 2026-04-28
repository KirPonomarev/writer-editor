#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C14_RECOVERY_READABLE_PROOF_OK';

const TASK_ID = 'B2C14_RECOVERY_READABLE_PROOF';
const STATUS_BASENAME = 'B2C14_RECOVERY_READABLE_PROOF_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const READABLE_CONTENT_DELIMITER = '--- RECOVERY CONTENT START ---';
const FIXED_TIMESTAMP = '2026-04-28T09:44:00.000Z';
const DONOR = Object.freeze({
  primaryBasename: 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip',
  primarySha256: '7189d8357f340d89112b02a57eb9315f9af4695ac00e3a2707801e4d97320791',
  consultedEntries: [
    'recovery-pack.js',
    'recovery-readable-quarantine.test.js',
  ],
  acceptedUse: 'SECTION_SHAPE_AND_NEGATIVE_TEST_IDEAS_ONLY',
  rejectedUse: 'NO_BLIND_OVERLAY_NO_RESTORE_SUCCESS_NO_QUARANTINE_CLOSURE_NO_BLOCK2_EXIT',
});

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function normalizeText(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function wordCount(value) {
  const words = normalizeText(value).trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function buildSceneRawSnapshot(scene, index) {
  return [
    `# ${scene.title}`,
    '',
    `Scene id: ${scene.sceneId}`,
    `Scene order: ${index}`,
    `Block order: ${scene.blockIds.join(', ')}`,
    `Text hash: ${sha256Text(scene.text)}`,
    '',
    'Readable recovery snapshot. Copy only content below the delimiter.',
    READABLE_CONTENT_DELIMITER,
    normalizeText(scene.text),
  ].join('\n');
}

function extractReadableContent(rawSnapshot, delimiter = READABLE_CONTENT_DELIMITER) {
  const raw = String(rawSnapshot ?? '');
  const first = raw.indexOf(delimiter);
  const last = raw.lastIndexOf(delimiter);
  if (first < 0 || first !== last) {
    throw Object.assign(new Error('content boundary violation'), {
      code: 'E_B2C14_CONTENT_BOUNDARY_VIOLATION',
    });
  }
  let text = raw.slice(first + delimiter.length);
  if (text.startsWith('\r\n')) text = text.slice(2);
  else if (text.startsWith('\n')) text = text.slice(1);
  return text;
}

function buildDeterministicReadableProofPacket() {
  const scenes = [
    {
      sceneId: 'scene-001',
      title: 'Opening',
      text: '  Opening paragraph.\nSecond line remains readable.\n',
      blockIds: ['scene-001-block-001', 'scene-001-block-002'],
    },
    {
      sceneId: 'scene-002',
      title: 'Counterpoint',
      text: 'Counterpoint starts here.\nTrailing spaces stay visible.  \n',
      blockIds: ['scene-002-block-001', 'scene-002-block-002'],
    },
  ];

  const sceneTextSnapshot = scenes.map((scene, index) => {
    const rawSnapshot = buildSceneRawSnapshot(scene, index + 1);
    return {
      sceneId: scene.sceneId,
      title: scene.title,
      order: index + 1,
      blockIds: [...scene.blockIds],
      textHash: sha256Text(scene.text),
      rawSnapshot,
    };
  });

  const projectSummary = {
    projectId: 'b2c14-readable-proof-project',
    projectTitle: 'B2C14 Readable Proof Fixture',
    sceneCount: scenes.length,
    totalBlockCount: scenes.reduce((sum, scene) => sum + scene.blockIds.length, 0),
    readablePurpose: 'READABILITY_ONLY_PROOF',
  };
  const sceneList = scenes.map((scene, index) => ({
    sceneId: scene.sceneId,
    title: scene.title,
    order: index + 1,
    blockCount: scene.blockIds.length,
    wordCount: wordCount(scene.text),
  }));
  const blockOrder = scenes.map((scene, index) => ({
    sceneId: scene.sceneId,
    sceneOrder: index + 1,
    blockIds: [...scene.blockIds],
  }));
  const reason = 'READABILITY_PROOF_ONLY_RECOVERY_GUIDE';
  const errorSummary = {
    reasonCode: 'RECOVERY_READABILITY_REVIEW_REQUIRED',
    summary: 'Readable artifact is admitted as a human review boundary only.',
  };
  const humanReadableRestoreGuidanceText = [
    'Open the readable snapshots in scene order.',
    'Copy only the content below the readable content delimiter.',
    'Verify scene text hashes before any manual restore action.',
    'Use the machine replay companion reference for order and hash replay only.',
  ];
  const readableContentBoundary = {
    delimiter: READABLE_CONTENT_DELIMITER,
    copyRule: 'COPY_ONLY_TEXT_BELOW_DELIMITER',
    boundaryProtected: true,
  };
  const contentHash = sha256Text(stableStringify(sceneTextSnapshot.map((entry) => ({
    sceneId: entry.sceneId,
    order: entry.order,
    textHash: entry.textHash,
  }))));
  const manifestHash = sha256Text(stableStringify({
    projectSummary,
    sceneList,
    blockOrder,
    reason,
    errorSummary,
    readableContentBoundary,
  }));
  const timestampSection = {
    generatedAtIso: FIXED_TIMESTAMP,
    bindingMode: 'TIMESTAMP_PLUS_CONTENT_HASH',
    bindingHash: sha256Text(`${FIXED_TIMESTAMP}:${contentHash}`),
  };
  const hashSection = {
    algorithm: 'sha256',
    contentHash,
    manifestHash,
    sceneHashes: sceneTextSnapshot.map((entry) => ({
      sceneId: entry.sceneId,
      textHash: entry.textHash,
    })),
    timestampBindingHash: timestampSection.bindingHash,
  };
  const machineReplayCompanionReference = {
    refId: 'machine-replay-companion-v1',
    fileBasename: 'manifest.recovery.json',
    orderedSceneIds: sceneList.map((entry) => entry.sceneId),
    manifestHash,
    replayMode: 'ORDER_AND_HASH_ONLY',
  };

  return {
    packetId: 'B2C14_READABLE_RECOVERY_PROOF_PACKET_V1',
    schemaVersion: 1,
    sections: {
      projectSummary,
      sceneList,
      sceneTextSnapshot,
      blockOrder,
      errorSummary,
      reason,
      humanReadableRestoreGuidanceText,
      hashSection,
      timestampSection,
      machineReplayCompanionReference,
      readableContentBoundary,
    },
    scopeClaims: {
      restoreDrillClaim: false,
      restoredProjectEqualityClaim: false,
      quarantineCloseClaim: false,
      b2c15Claim: false,
      block2ExitClaim: false,
      uiTouched: false,
      dependencyChanged: false,
      networkOrCloud: false,
    },
  };
}

function validateScopeClaims(scopeClaims) {
  if (!isObjectRecord(scopeClaims)) {
    return { ok: false, code: 'E_B2C14_SCOPE_CLAIM_DRIFT', failRows: ['SCOPE_CLAIMS_MISSING'] };
  }
  const requiredFalseKeys = [
    'restoreDrillClaim',
    'restoredProjectEqualityClaim',
    'quarantineCloseClaim',
    'b2c15Claim',
    'block2ExitClaim',
    'uiTouched',
    'dependencyChanged',
    'networkOrCloud',
  ];
  const driftKeys = requiredFalseKeys.filter((key) => scopeClaims[key] !== false);
  return driftKeys.length === 0
    ? { ok: true, code: '', failRows: [] }
    : {
      ok: false,
      code: 'E_B2C14_SCOPE_CLAIM_DRIFT',
      failRows: driftKeys.map((key) => `${key.toUpperCase()}_MUST_BE_FALSE`),
    };
}

export function validateReadableRecoveryProofPacket(packet) {
  if (!isObjectRecord(packet) || !isObjectRecord(packet.sections)) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['SECTIONS_UNREADABLE'],
    };
  }

  const {
    projectSummary,
    sceneList,
    sceneTextSnapshot,
    blockOrder,
    errorSummary,
    reason,
    humanReadableRestoreGuidanceText,
    hashSection,
    timestampSection,
    machineReplayCompanionReference,
    readableContentBoundary,
  } = packet.sections;

  if (!isObjectRecord(projectSummary) || !projectSummary.projectId || !projectSummary.projectTitle) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['PROJECT_SUMMARY_MISSING'],
    };
  }

  if (!Array.isArray(sceneList) || sceneList.length === 0) {
    return {
      ok: false,
      code: 'E_B2C14_SCENE_LIST_MISSING',
      failRows: ['SCENE_LIST_MISSING'],
    };
  }

  if (!Array.isArray(sceneTextSnapshot) || sceneTextSnapshot.length === 0) {
    return {
      ok: false,
      code: 'E_B2C14_TEXT_SNAPSHOT_MISSING',
      failRows: ['SCENE_TEXT_SNAPSHOT_MISSING'],
    };
  }

  if (!Array.isArray(blockOrder) || blockOrder.length !== sceneList.length) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['BLOCK_ORDER_MISSING_OR_MISMATCH'],
    };
  }

  if (!isObjectRecord(errorSummary) && !reason) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['ERROR_SUMMARY_OR_REASON_MISSING'],
    };
  }

  if (!Array.isArray(humanReadableRestoreGuidanceText) || humanReadableRestoreGuidanceText.length < 3) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['RESTORE_GUIDANCE_MISSING'],
    };
  }

  if (!isObjectRecord(hashSection)) {
    return {
      ok: false,
      code: 'E_B2C14_HASH_SECTION_MISSING',
      failRows: ['HASH_SECTION_MISSING'],
    };
  }

  if (!isObjectRecord(timestampSection) || !timestampSection.generatedAtIso || !timestampSection.bindingHash) {
    return {
      ok: false,
      code: 'E_B2C14_TIMESTAMP_BINDING_STALE',
      failRows: ['TIMESTAMP_SECTION_MISSING'],
    };
  }

  if (!isObjectRecord(machineReplayCompanionReference) || !machineReplayCompanionReference.fileBasename) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['MACHINE_REPLAY_COMPANION_REFERENCE_MISSING'],
    };
  }

  if (!isObjectRecord(readableContentBoundary) || readableContentBoundary.delimiter !== READABLE_CONTENT_DELIMITER) {
    return {
      ok: false,
      code: 'E_B2C14_CONTENT_BOUNDARY_VIOLATION',
      failRows: ['READABLE_CONTENT_BOUNDARY_MISSING'],
    };
  }

  if (projectSummary.sceneCount !== sceneList.length || sceneList.length !== sceneTextSnapshot.length) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['SCENE_COUNT_MISMATCH'],
    };
  }

  const normalizedSnapshots = [];
  for (const snapshot of sceneTextSnapshot) {
    try {
      const extractedText = extractReadableContent(snapshot.rawSnapshot, readableContentBoundary.delimiter);
      const extractedHash = sha256Text(extractedText);
      if (extractedHash !== snapshot.textHash) {
        return {
          ok: false,
          code: 'E_B2C14_HASH_SECTION_MISSING',
          failRows: [`TEXT_HASH_MISMATCH_${snapshot.sceneId}`],
        };
      }
      normalizedSnapshots.push({
        sceneId: snapshot.sceneId,
        order: snapshot.order,
        textHash: snapshot.textHash,
      });
    } catch (error) {
      return {
        ok: false,
        code: error && error.code ? error.code : 'E_B2C14_CONTENT_BOUNDARY_VIOLATION',
        failRows: [`CONTENT_BOUNDARY_INVALID_${snapshot.sceneId}`],
      };
    }
  }

  const expectedContentHash = sha256Text(stableStringify(normalizedSnapshots));
  if (hashSection.algorithm !== 'sha256' || hashSection.contentHash !== expectedContentHash) {
    return {
      ok: false,
      code: 'E_B2C14_HASH_SECTION_MISSING',
      failRows: ['CONTENT_HASH_INVALID'],
    };
  }

  const expectedManifestHash = sha256Text(stableStringify({
    projectSummary,
    sceneList,
    blockOrder,
    reason,
    errorSummary,
    readableContentBoundary,
  }));
  if (hashSection.manifestHash !== expectedManifestHash) {
    return {
      ok: false,
      code: 'E_B2C14_HASH_SECTION_MISSING',
      failRows: ['MANIFEST_HASH_INVALID'],
    };
  }

  const expectedTimestampBindingHash = sha256Text(`${timestampSection.generatedAtIso}:${hashSection.contentHash}`);
  if (timestampSection.bindingHash !== expectedTimestampBindingHash || hashSection.timestampBindingHash !== expectedTimestampBindingHash) {
    return {
      ok: false,
      code: 'E_B2C14_TIMESTAMP_BINDING_STALE',
      failRows: ['TIMESTAMP_BINDING_HASH_INVALID'],
    };
  }

  if (machineReplayCompanionReference.manifestHash !== hashSection.manifestHash) {
    return {
      ok: false,
      code: 'E_B2C14_UNREADABLE_PACK',
      failRows: ['MACHINE_REPLAY_COMPANION_HASH_MISMATCH'],
    };
  }

  const scopeClaimsResult = validateScopeClaims(packet.scopeClaims);
  if (!scopeClaimsResult.ok) return scopeClaimsResult;

  return {
    ok: true,
    code: '',
    failRows: [],
    derived: {
      expectedContentHash,
      expectedManifestHash,
      expectedTimestampBindingHash,
    },
  };
}

function runNegativeCases(packet) {
  const cases = [
    {
      caseId: 'NEGATIVE_UNREADABLE_PACK',
      expectedCode: 'E_B2C14_UNREADABLE_PACK',
      mutate: (draft) => {
        delete draft.sections;
      },
    },
    {
      caseId: 'NEGATIVE_MISSING_SCENE_LIST',
      expectedCode: 'E_B2C14_SCENE_LIST_MISSING',
      mutate: (draft) => {
        delete draft.sections.sceneList;
      },
    },
    {
      caseId: 'NEGATIVE_MISSING_TEXT_SNAPSHOT',
      expectedCode: 'E_B2C14_TEXT_SNAPSHOT_MISSING',
      mutate: (draft) => {
        draft.sections.sceneTextSnapshot = [];
      },
    },
    {
      caseId: 'NEGATIVE_MISSING_HASH_SECTION',
      expectedCode: 'E_B2C14_HASH_SECTION_MISSING',
      mutate: (draft) => {
        delete draft.sections.hashSection;
      },
    },
    {
      caseId: 'NEGATIVE_STALE_TIMESTAMP_BINDING',
      expectedCode: 'E_B2C14_TIMESTAMP_BINDING_STALE',
      mutate: (draft) => {
        draft.sections.timestampSection.bindingHash = sha256Text('stale-binding');
      },
    },
    {
      caseId: 'NEGATIVE_CONTENT_BOUNDARY_VIOLATION',
      expectedCode: 'E_B2C14_CONTENT_BOUNDARY_VIOLATION',
      mutate: (draft) => {
        draft.sections.sceneTextSnapshot[0].rawSnapshot = draft.sections.sceneTextSnapshot[0].rawSnapshot.replace(
          READABLE_CONTENT_DELIMITER,
          `${READABLE_CONTENT_DELIMITER}\n${READABLE_CONTENT_DELIMITER}`,
        );
      },
    },
  ];

  return cases.map((entry) => {
    const draft = clone(packet);
    entry.mutate(draft);
    const validation = validateReadableRecoveryProofPacket(draft);
    return {
      caseId: entry.caseId,
      expectedCode: entry.expectedCode,
      ok: validation.ok === false && validation.code === entry.expectedCode,
      observedCode: validation.code,
      failRows: validation.failRows,
    };
  });
}

function buildReadabilityRubric(packet, positiveValidation, negativeCases) {
  return {
    rubricVersion: 1,
    taskId: TASK_ID,
    requiredSections: Object.keys(packet.sections),
    requiredFalseClaims: Object.keys(packet.scopeClaims),
    readabilityChecks: [
      'projectSummary',
      'sceneList',
      'sceneTextSnapshot',
      'blockOrder',
      'errorSummary_or_reason',
      'humanReadableRestoreGuidanceText',
      'hashSection',
      'timestampSection',
      'machineReplayCompanionReference',
      'readableContentBoundary',
    ],
    positiveValidation: {
      ok: positiveValidation.ok,
      code: positiveValidation.code,
      failRows: positiveValidation.failRows,
    },
    negativeCases,
  };
}

export async function evaluateB2C14RecoveryReadableProofState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const packet = buildDeterministicReadableProofPacket();
  const positiveValidation = validateReadableRecoveryProofPacket(packet);
  const negativeCases = runNegativeCases(packet);
  const requiredSections = [
    'projectSummary',
    'sceneList',
    'sceneTextSnapshot',
    'blockOrder',
    'errorSummary',
    'reason',
    'humanReadableRestoreGuidanceText',
    'hashSection',
    'timestampSection',
    'machineReplayCompanionReference',
    'readableContentBoundary',
  ];
  const failRows = [];

  if (!positiveValidation.ok) failRows.push('POSITIVE_READABLE_PACK_RED');
  for (const negativeCase of negativeCases) {
    if (!negativeCase.ok) failRows.push(`${negativeCase.caseId}_RED`);
  }

  const readabilityRubric = buildReadabilityRubric(packet, positiveValidation, negativeCases);

  return {
    artifactId: 'B2C14_RECOVERY_READABLE_PROOF_STATUS_V1',
    schemaVersion: 1,
    taskId: TASK_ID,
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C14_RECOVERY_READABLE_PROOF_RED',
    failRows,
    donor: DONOR,
    scope: {
      contour: 'B2C14_ONLY',
      restoreDrillClaim: false,
      restoredProjectEqualityClaim: false,
      quarantineCloseClaim: false,
      b2c15Claim: false,
      block2ExitClaim: false,
      uiTouched: false,
      dependencyChanged: false,
      networkOrCloud: false,
    },
    proof: {
      repoBound: true,
      deterministicFixtureId: 'B2C14_READABILITY_FIXTURE_V1',
      readableSectionsPresent: requiredSections.every((key) => Object.hasOwn(packet.sections, key)),
      positiveReadablePackOk: positiveValidation.ok,
      negativeUnreadablePackRejectOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_UNREADABLE_PACK' && entry.ok),
      negativeMissingSceneListRejectOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_SCENE_LIST' && entry.ok),
      negativeMissingTextSnapshotRejectOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_TEXT_SNAPSHOT' && entry.ok),
      negativeMissingHashSectionRejectOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_HASH_SECTION' && entry.ok),
      negativeStaleHashTimestampBindingRejectOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_STALE_TIMESTAMP_BINDING' && entry.ok),
      negativeContentBoundaryViolationRejectOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_CONTENT_BOUNDARY_VIOLATION' && entry.ok),
      hashAlgorithm: 'sha256',
      timestampMode: packet.sections.timestampSection.bindingMode,
      sections: packet.sections,
      scopeClaims: packet.scopeClaims,
    },
    runtime: {
      positiveValidation,
      negativeCases,
      readableGuideHash: sha256Text(packet.sections.humanReadableRestoreGuidanceText.join('\n')),
      machineReplayCompanionHash: sha256Text(stableStringify(packet.sections.machineReplayCompanionReference)),
      readabilityRubric,
    },
  };
}

async function writeStateArtifacts(repoRoot, state) {
  const statusPath = path.join(repoRoot, 'docs', 'OPS', 'STATUS', STATUS_BASENAME);
  const evidencePath = path.join(repoRoot, EVIDENCE_DIR);
  await fsp.mkdir(path.dirname(statusPath), { recursive: true });
  await fsp.mkdir(evidencePath, { recursive: true });
  await fsp.writeFile(statusPath, `${stableStringify(state)}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'recovery-readable-proof.json'), `${stableStringify({
    proof: state.proof,
    runtime: {
      positiveValidation: state.runtime.positiveValidation,
      negativeCases: state.runtime.negativeCases,
      readableGuideHash: state.runtime.readableGuideHash,
      machineReplayCompanionHash: state.runtime.machineReplayCompanionHash,
    },
  })}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'readability-rubric.json'), `${stableStringify(state.runtime.readabilityRubric)}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'donor-mapping.json'), `${stableStringify({
    donor: state.donor,
    mappedContour: TASK_ID,
    acceptedUse: state.donor.acceptedUse,
    rejectedUse: state.donor.rejectedUse,
    referenceArchivesConsulted: [state.donor.primaryBasename],
    consultedEntries: state.donor.consultedEntries,
  })}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'command-results.json'), `${stableStringify({
    allPassed: null,
    commands: [
      {
        command: 'node scripts/ops/b2c14-recovery-readable-proof-state.mjs --write --json',
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
    status: 'PENDING_EXECUTION_LOG_UPDATE',
    taskId: TASK_ID,
  })}\n`, 'utf8');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C14RecoveryReadableProofState({ repoRoot });
  if (args.write) {
    await writeStateArtifacts(repoRoot, state);
  }
  const payload = `${stableStringify(state)}\n`;
  if (args.json) {
    process.stdout.write(payload);
  } else {
    process.stdout.write(payload);
  }
}

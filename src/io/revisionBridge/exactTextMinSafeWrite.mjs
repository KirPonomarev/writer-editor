import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { writeMarkdownWithTransactionRecovery } from '../markdown/index.mjs';
import { buildExactTextApplyPlanNoDiskPreview } from './index.mjs';

export const REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_SCHEMA =
  'revision-bridge.exact-text-min-safe-write.v1';
export const REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_RECEIPT_SCHEMA =
  'revision-bridge.exact-text-min-safe-write.receipt.v1';

const READY_CODE = 'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_APPLIED';
const BLOCKED_CODE = 'E_REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_BLOCKED';
const FAILED_CODE = 'E_REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_FAILED';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function rawString(value) {
  return typeof value === 'string' ? value : '';
}

function resolvePath(value) {
  const raw = rawString(value);
  return raw ? path.resolve(raw) : '';
}

function isPathInside(rootPath, candidatePath) {
  const root = resolvePath(rootPath);
  const candidate = resolvePath(candidatePath);
  if (!root || !candidate) return false;
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function buildReason(code, field, message, details = {}) {
  return {
    code,
    field,
    message,
    ...details,
  };
}

function block(reason, details = {}) {
  const reasons = [reason];
  return {
    ok: false,
    type: 'revisionBridge.exactTextMinSafeWrite',
    status: 'blocked',
    code: BLOCKED_CODE,
    reason: reason.code,
    reasons,
    receipt: null,
    applied: false,
    ...details,
  };
}

function fail(reason, details = {}) {
  return {
    ok: false,
    type: 'revisionBridge.exactTextMinSafeWrite',
    status: 'failed',
    code: FAILED_CODE,
    reason: reason.code,
    reasons: [reason],
    receipt: null,
    applied: false,
    ...details,
  };
}

function extractProvidedPlan(input) {
  const candidate = input.contour03Plan || input.planPreview || input.plan;
  if (!isPlainObject(candidate)) return null;
  if (isPlainObject(candidate.plan)) return candidate.plan;
  return candidate;
}

function extractSingleOp(plan) {
  return Array.isArray(plan?.applyOps) && plan.applyOps.length === 1 ? plan.applyOps[0] : null;
}

function comparablePlan(plan) {
  const op = extractSingleOp(plan);
  return {
    schemaVersion: rawString(plan?.schemaVersion),
    projectId: rawString(plan?.projectId),
    sessionId: rawString(plan?.sessionId),
    baselineHash: rawString(plan?.baselineHash),
    sceneId: rawString(plan?.sceneId),
    op: op ? {
      kind: rawString(op.kind),
      sceneId: rawString(op.sceneId),
      changeId: rawString(op.changeId),
      from: op.from,
      to: op.to,
      expectedText: rawString(op.expectedText),
      replacementText: rawString(op.replacementText),
    } : null,
  };
}

function plansMatchOnSafetyFields(providedPlan, rebuiltPlan) {
  return stableJson(comparablePlan(providedPlan)) === stableJson(comparablePlan(rebuiltPlan));
}

function findSceneText(projectSnapshot, sceneId) {
  if (!isPlainObject(projectSnapshot)) return '';
  if (Array.isArray(projectSnapshot.scenes)) {
    const scene = projectSnapshot.scenes.find((item, index) => {
      if (!isPlainObject(item)) return false;
      return normalizeString(item.sceneId || item.id) === sceneId || (!sceneId && index === 0);
    });
    return rawString(scene?.text);
  }
  if (isPlainObject(projectSnapshot.scenes)) {
    const scene = projectSnapshot.scenes[sceneId];
    if (typeof scene === 'string') return scene;
    return rawString(scene?.text);
  }
  if (isPlainObject(projectSnapshot.scene)) return rawString(projectSnapshot.scene.text);
  return rawString(projectSnapshot.text);
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length) {
    const found = text.indexOf(needle, cursor);
    if (found === -1) break;
    count += 1;
    cursor = found + needle.length;
  }
  return count;
}

function buildInputHash(input, plan) {
  return sha256Text(stableJson({
    projectSnapshot: input.projectSnapshot || null,
    revisionSession: input.revisionSession || null,
    reviewItem: input.reviewItem || null,
    scenePath: input.scenePath || '',
    plan: comparablePlan(plan),
  }));
}

function buildSnapshotEvidence(writeResult, capturedRecoveryEvidence = null) {
  return {
    snapshotCreated: Boolean(writeResult?.snapshotCreated || capturedRecoveryEvidence?.snapshotCreated),
    snapshotPath: rawString(writeResult?.snapshotPath || capturedRecoveryEvidence?.snapshotPath),
    purgedSnapshots: Array.isArray(writeResult?.purgedSnapshots) ? writeResult.purgedSnapshots : [],
    recoveryAction: 'OPEN_SNAPSHOT_OR_ABORT',
  };
}

export async function applyExactTextMinSafeWrite(input = {}, options = {}) {
  if (!isPlainObject(input)) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_INPUT_INVALID',
      'input',
      'input must be an object',
    ));
  }

  const scenePath = rawString(input.scenePath);
  if (!scenePath) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_SCENE_PATH_REQUIRED',
      'scenePath',
      'scenePath is required',
    ));
  }

  const projectRoot = rawString(input.projectRoot);
  if (!projectRoot) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PROJECT_ROOT_REQUIRED',
      'projectRoot',
      'projectRoot is required for scene path binding',
    ));
  }

  if (!isPathInside(projectRoot, scenePath)) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_SCENE_PATH_OUTSIDE_PROJECT',
      'scenePath',
      'scenePath must be inside projectRoot',
    ));
  }

  const providedPlan = extractProvidedPlan(input);
  if (!providedPlan) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_REQUIRED',
      'contour03Plan|planPreview',
      'provided C03 plan is required',
    ));
  }

  const rebuiltPreview = buildExactTextApplyPlanNoDiskPreview({
    projectSnapshot: input.projectSnapshot,
    revisionSession: input.revisionSession,
    reviewItem: input.reviewItem,
  });

  if (rebuiltPreview.status !== 'ready' || !rebuiltPreview.plan) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_NOT_READY',
      'rebuiltPlan',
      'rebuilt C03 plan is not ready',
      {
        rebuiltCode: rawString(rebuiltPreview.code),
        rebuiltReason: rawString(rebuiltPreview.reason),
        rebuiltReasons: Array.isArray(rebuiltPreview.reasons) ? cloneJsonSafe(rebuiltPreview.reasons) : [],
      },
    ));
  }

  if (providedPlan.canApply !== false || providedPlan.noDisk !== true || providedPlan.safeWriteCandidate !== false) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_NOT_READY',
      'providedPlan',
      'provided plan is not a C03 no-disk preview plan',
    ));
  }

  if (!plansMatchOnSafetyFields(providedPlan, rebuiltPreview.plan)) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_MISMATCH',
      'providedPlan',
      'provided C03 plan does not match rebuilt C03 plan safety fields',
    ));
  }

  const op = extractSingleOp(providedPlan);
  if (!op || op.kind !== 'replaceExactText') {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_PLAN_NOT_READY',
      'providedPlan.applyOps',
      'provided plan must contain one replaceExactText op',
    ));
  }

  const scenePathBySceneId = isPlainObject(input.scenePathBySceneId) ? input.scenePathBySceneId : {};
  const boundScenePath = resolvePath(scenePathBySceneId[rawString(op.sceneId)]);
  if (!boundScenePath || boundScenePath !== resolvePath(scenePath)) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_SCENE_PATH_BINDING_MISMATCH',
      'scenePathBySceneId',
      'scenePath must match the canonical scene path binding for the target scene',
    ));
  }

  const expectedText = rawString(op.expectedText);
  const replacementText = rawString(op.replacementText);
  const sceneText = findSceneText(input.projectSnapshot, rawString(op.sceneId));
  let currentText = '';

  try {
    currentText = await fs.readFile(scenePath, 'utf8');
  } catch (error) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_READ_FAILED',
      'scenePath',
      'current scene file could not be read',
      {
        errorCode: rawString(error?.code),
      },
    ));
  }

  if (currentText !== sceneText) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_DRIFT',
      'scenePath',
      'current scene file differs from projectSnapshot scene text',
      {
        currentHash: sha256Text(currentText),
        snapshotHash: sha256Text(sceneText),
      },
    ));
  }

  const occurrenceCount = countOccurrences(currentText, expectedText);
  if (occurrenceCount === 0) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_NO_MATCH',
      'expectedText',
      'expectedText is not present in current scene file',
    ));
  }
  if (occurrenceCount > 1) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_DUPLICATE_MATCH',
      'expectedText',
      'expectedText occurs multiple times in current scene file',
      {
        matchCount: occurrenceCount,
      },
    ));
  }

  const from = Number.isSafeInteger(op.from) ? op.from : -1;
  const to = Number.isSafeInteger(op.to) ? op.to : -1;
  if (from < 0 || to < from || currentText.slice(from, to) !== expectedText) {
    return block(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_CURRENT_OFFSET_MISMATCH',
      'providedPlan.applyOps.0',
      'current scene text does not match the exact C03 op offset',
      {
        from,
        to,
      },
    ));
  }
  const nextText = `${currentText.slice(0, from)}${replacementText}${currentText.slice(to)}`;
  const inputHash = buildInputHash(input, providedPlan);
  const outputHash = sha256Text(nextText);
  const capturedRecoveryEvidence = {};
  const userAfterStage = typeof options.afterStage === 'function' ? options.afterStage : null;

  try {
    const writeResult = await writeMarkdownWithTransactionRecovery(scenePath, nextText, {
      safetyMode: options.safetyMode,
      maxSnapshots: options.maxSnapshots,
      now: options.now,
      beforeRename: options.beforeRename,
      afterTempWrite: options.afterTempWrite,
      afterStage: async (event) => {
        if (event?.stage === 'SNAPSHOT_CREATED') {
          capturedRecoveryEvidence.snapshotCreated = Boolean(event.snapshotCreated);
          capturedRecoveryEvidence.snapshotPath = rawString(event.snapshotPath);
        }
        if (userAfterStage) await userAfterStage(event);
      },
    });

    const receipt = {
      schemaVersion: REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_RECEIPT_SCHEMA,
      projectId: rawString(providedPlan.projectId),
      sessionId: rawString(providedPlan.sessionId),
      sceneId: rawString(op.sceneId),
      changeId: rawString(op.changeId),
      inputHash,
      outputHash,
      bytesWritten: writeResult.bytesWritten,
      transactionId: rawString(writeResult.transactionId),
      recovery: buildSnapshotEvidence(writeResult, capturedRecoveryEvidence),
      reason: READY_CODE,
    };

    return {
      ok: true,
      type: 'revisionBridge.exactTextMinSafeWrite',
      status: 'applied',
      code: READY_CODE,
      reason: READY_CODE,
      reasons: [],
      applied: true,
      receipt,
    };
  } catch (error) {
    return fail(buildReason(
      'REVISION_BRIDGE_EXACT_TEXT_MIN_SAFE_WRITE_WRITE_FAILED',
      'scenePath',
      'transactional markdown write failed',
      {
        errorCode: rawString(error?.code),
        errorReason: rawString(error?.reason),
        recovery: buildSnapshotEvidence(null, capturedRecoveryEvidence),
      },
    ));
  }
}

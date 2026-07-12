import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  atomicWriteFile,
  clearTransactionIntent,
  readTransactionIntent,
} from '../markdown/index.mjs';

export const REVISION_BRIDGE_EXACT_TEXT_APPLY_JOURNAL_SCHEMA =
  'revision-bridge.exact-text-apply-journal.v1';
export const REVISION_BRIDGE_EXACT_TEXT_APPLY_RECONCILIATION_SCHEMA =
  'revision-bridge.exact-text-apply-reconciliation.v1';

const JOURNAL_DIRECTORY_SEGMENTS = ['backups', 'revision-bridge-apply-journal'];
const JOURNAL_MAX_BYTES = 256 * 1024;
const JOURNAL_SCAN_LIMIT = 512;
const JOURNAL_RETAIN_RECONCILED = 64;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const OPERATION_ID_PATTERN = /^op_[a-z0-9][a-z0-9_-]{0,95}$/iu;
const PENDING_STATUSES = new Set(['prepared', 'applied', 'receipt_written']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function rawString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeString(value) {
  return rawString(value).trim();
}

function resolveNowMs(nowFn = Date.now) {
  const stamp = Number(typeof nowFn === 'function' ? nowFn() : Date.now());
  return Number.isFinite(stamp) && stamp >= 0 ? Math.trunc(stamp) : Date.now();
}

function toIsoString(nowFn = Date.now) {
  return new Date(resolveNowMs(nowFn)).toISOString();
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function journalError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.reason = code;
  error.details = details;
  return error;
}

function assertHash(value, field) {
  const normalized = normalizeString(value).toLowerCase();
  if (!HASH_PATTERN.test(normalized)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_HASH_INVALID', `${field} must be a sha256 hash`, {
      field,
    });
  }
  return normalized;
}

function buildOperationId(nowFn = Date.now) {
  return `op_${resolveNowMs(nowFn)}_${crypto.randomBytes(6).toString('hex')}`;
}

function assertOperationId(value) {
  const operationId = normalizeString(value);
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw journalError(
      'E_REVISION_BRIDGE_APPLY_JOURNAL_OPERATION_ID_INVALID',
      'operationId is invalid',
    );
  }
  return operationId;
}

function normalizeOperationId(value, nowFn = Date.now) {
  return assertOperationId(normalizeString(value) || buildOperationId(nowFn));
}

function isPathInside(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toPortableRelativePath(rootPath, candidatePath, field) {
  const relative = path.relative(rootPath, candidatePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_PATH_OUTSIDE_PROJECT', `${field} is outside project`, {
      field,
    });
  }
  return relative.split(path.sep).join('/');
}

function normalizePortableRelativePath(value, field) {
  const normalized = normalizeString(value);
  if (
    !normalized
    || normalized.includes('\\')
    || path.posix.isAbsolute(normalized)
    || path.posix.normalize(normalized) !== normalized
    || normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_RELATIVE_PATH_INVALID', `${field} is invalid`, {
      field,
    });
  }
  return normalized;
}

async function resolveProjectContext(projectRootRaw, { createJournalDirectory = false } = {}) {
  const projectRoot = path.resolve(normalizeString(projectRootRaw));
  if (!normalizeString(projectRootRaw)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_PROJECT_ROOT_REQUIRED', 'projectRoot is required');
  }

  const rootStat = await fs.stat(projectRoot);
  if (!rootStat.isDirectory()) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_PROJECT_ROOT_INVALID', 'projectRoot is not a directory');
  }
  const projectRealRoot = await fs.realpath(projectRoot);

  let cursor = projectRoot;
  if (createJournalDirectory) {
    for (const segment of JOURNAL_DIRECTORY_SEGMENTS) {
      cursor = path.join(cursor, segment);
      try {
        const stat = await fs.lstat(cursor);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
          throw journalError(
            'E_REVISION_BRIDGE_APPLY_JOURNAL_DIRECTORY_UNSAFE',
            'journal directory must be a real directory',
          );
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        await fs.mkdir(cursor);
      }
    }
  }

  const journalDirectory = path.join(projectRoot, ...JOURNAL_DIRECTORY_SEGMENTS);
  if (createJournalDirectory) {
    const journalRealPath = await fs.realpath(journalDirectory);
    if (!isPathInside(projectRealRoot, journalRealPath)) {
      throw journalError(
        'E_REVISION_BRIDGE_APPLY_JOURNAL_DIRECTORY_OUTSIDE_PROJECT',
        'journal directory resolves outside project',
      );
    }
  }

  return { projectRoot, projectRealRoot, journalDirectory };
}

async function resolveExistingProjectFile(context, candidateRaw, field) {
  const candidatePath = path.resolve(normalizeString(candidateRaw));
  if (!normalizeString(candidateRaw) || !isPathInside(context.projectRoot, candidatePath)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_PATH_OUTSIDE_PROJECT', `${field} is outside project`, {
      field,
    });
  }
  const stat = await fs.lstat(candidatePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_FILE_UNSAFE', `${field} must be a real file`, {
      field,
    });
  }
  const realPath = await fs.realpath(candidatePath);
  if (!isPathInside(context.projectRealRoot, realPath)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_PATH_OUTSIDE_PROJECT', `${field} resolves outside project`, {
      field,
    });
  }
  return candidatePath;
}

async function resolveStoredProjectFile(context, relativePathRaw, field) {
  const relativePath = normalizePortableRelativePath(relativePathRaw, field);
  const candidatePath = path.join(context.projectRoot, ...relativePath.split('/'));
  return resolveExistingProjectFile(context, candidatePath, field);
}

function journalPathFor(context, operationId) {
  return path.join(context.journalDirectory, `${assertOperationId(operationId)}.json`);
}

function validateJournalEntry(entry, expectedOperationId = '') {
  if (!isPlainObject(entry) || entry.schemaVersion !== REVISION_BRIDGE_EXACT_TEXT_APPLY_JOURNAL_SCHEMA) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_SCHEMA_INVALID', 'journal schema is invalid');
  }
  const operationId = assertOperationId(entry.operationId);
  if (expectedOperationId && operationId !== expectedOperationId) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_OPERATION_ID_MISMATCH', 'journal operationId mismatch');
  }
  if (![...PENDING_STATUSES, 'reconciled'].includes(entry.status)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_STATUS_INVALID', 'journal status is invalid');
  }
  normalizePortableRelativePath(entry.sceneRelativePath, 'sceneRelativePath');
  assertHash(entry.beforeHash, 'beforeHash');
  assertHash(entry.afterHash, 'afterHash');
  return entry;
}

async function readJournalEntryFromContext(context, operationIdRaw) {
  const operationId = assertOperationId(operationIdRaw);
  const journalPath = journalPathFor(context, operationId);
  const stat = await fs.lstat(journalPath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > JOURNAL_MAX_BYTES) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_FILE_UNSAFE', 'journal file is unsafe');
  }
  const parsed = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  return validateJournalEntry(parsed, operationId);
}

async function writeJournalEntry(context, entry) {
  const validated = validateJournalEntry(entry, entry.operationId);
  const journalPath = journalPathFor(context, validated.operationId);
  const result = await atomicWriteFile(journalPath, `${JSON.stringify(validated, null, 2)}\n`, {
    safetyMode: 'strict',
  });
  return { entry: cloneJsonSafe(validated), journalPath, bytesWritten: result.bytesWritten };
}

function appendStatus(entry, status, nowFn) {
  const at = toIsoString(nowFn);
  const history = Array.isArray(entry.history) ? entry.history : [];
  return {
    ...entry,
    status,
    updatedAt: at,
    history: [...history, { status, at }],
  };
}

async function updateJournalEntry(projectRoot, operationId, updater, options = {}) {
  const context = await resolveProjectContext(projectRoot, { createJournalDirectory: true });
  const current = await readJournalEntryFromContext(context, operationId);
  const next = await updater(cloneJsonSafe(current), context);
  return writeJournalEntry(context, next);
}

export async function prepareExactTextApplyJournal(input = {}, options = {}) {
  const context = await resolveProjectContext(input.projectRoot, { createJournalDirectory: true });
  const scenePath = await resolveExistingProjectFile(context, input.scenePath, 'scenePath');
  const operationId = normalizeOperationId(options.operationId, options.now);
  const beforeHash = assertHash(input.beforeHash, 'beforeHash');
  const afterHash = assertHash(input.afterHash, 'afterHash');
  if (beforeHash === afterHash) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_NO_OP', 'beforeHash and afterHash must differ');
  }
  const preparedAt = toIsoString(options.now);
  const changeIds = Array.isArray(input.changeIds)
    ? input.changeIds.map((value) => normalizeString(value)).filter(Boolean)
    : [];
  if (changeIds.length === 0) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_CHANGE_ID_REQUIRED', 'changeIds are required');
  }

  const entry = {
    schemaVersion: REVISION_BRIDGE_EXACT_TEXT_APPLY_JOURNAL_SCHEMA,
    operationId,
    status: 'prepared',
    operationKind: normalizeString(input.operationKind),
    projectId: normalizeString(input.projectId),
    sessionId: normalizeString(input.sessionId),
    sceneId: normalizeString(input.sceneId),
    changeIds: [...new Set(changeIds)],
    sceneRelativePath: toPortableRelativePath(context.projectRoot, scenePath, 'scenePath'),
    beforeHash,
    afterHash,
    inputHash: assertHash(input.inputHash, 'inputHash'),
    preparedAt,
    updatedAt: preparedAt,
    transactionId: '',
    recovery: {
      snapshotCreated: false,
      snapshotRelativePath: '',
      snapshotHash: '',
    },
    receipt: null,
    reconciliation: null,
    history: [{ status: 'prepared', at: preparedAt }],
  };
  return writeJournalEntry(context, entry);
}

export async function recordExactTextApplyJournalSnapshot(projectRoot, operationId, snapshot = {}, options = {}) {
  return updateJournalEntry(projectRoot, operationId, async (entry, context) => {
    if (entry.status !== 'prepared') {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_TRANSITION_INVALID', 'snapshot requires prepared status');
    }
    const snapshotPath = await resolveExistingProjectFile(context, snapshot.snapshotPath, 'snapshotPath');
    const snapshotText = await fs.readFile(snapshotPath, 'utf8');
    const snapshotHash = sha256Text(snapshotText);
    if (snapshotHash !== entry.beforeHash) {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_SNAPSHOT_MISMATCH', 'snapshot does not match beforeHash');
    }
    return {
      ...entry,
      transactionId: normalizeString(snapshot.transactionId) || entry.transactionId,
      updatedAt: toIsoString(options.now),
      recovery: {
        snapshotCreated: true,
        snapshotRelativePath: toPortableRelativePath(context.projectRoot, snapshotPath, 'snapshotPath'),
        snapshotHash,
      },
    };
  }, options);
}

export async function recordExactTextApplyJournalApplied(projectRoot, operationId, details = {}, options = {}) {
  return updateJournalEntry(projectRoot, operationId, async (entry, context) => {
    if (entry.status !== 'prepared' || entry.recovery?.snapshotHash !== entry.beforeHash) {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_TRANSITION_INVALID', 'applied requires verified recovery');
    }
    const scenePath = await resolveStoredProjectFile(context, entry.sceneRelativePath, 'sceneRelativePath');
    const observedHash = sha256Text(await fs.readFile(scenePath, 'utf8'));
    if (observedHash !== entry.afterHash) {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_AFTER_HASH_MISMATCH', 'target does not match afterHash');
    }
    const next = appendStatus(entry, 'applied', options.now);
    next.transactionId = normalizeString(details.transactionId) || entry.transactionId;
    return next;
  }, options);
}

export async function recordExactTextApplyJournalReceipt(projectRoot, operationId, receipt, options = {}) {
  return updateJournalEntry(projectRoot, operationId, async (entry, context) => {
    if (entry.status !== 'applied' || !isPlainObject(receipt)) {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_TRANSITION_INVALID', 'receipt requires applied status');
    }
    const scenePath = await resolveStoredProjectFile(context, entry.sceneRelativePath, 'sceneRelativePath');
    const observedHash = sha256Text(await fs.readFile(scenePath, 'utf8'));
    if (
      observedHash !== entry.afterHash
      || receipt.operationId !== entry.operationId
      || receipt.outputHash !== entry.afterHash
      || receipt.writeStatus !== 'applied'
    ) {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_RECEIPT_INVALID', 'receipt does not match journal');
    }
    const next = appendStatus(entry, 'receipt_written', options.now);
    next.receipt = cloneJsonSafe(receipt);
    next.transactionId = normalizeString(receipt.transactionId) || entry.transactionId;
    return next;
  }, options);
}

function publicReconciliation(entry) {
  const reconciliation = isPlainObject(entry.reconciliation) ? entry.reconciliation : {};
  return {
    schemaVersion: REVISION_BRIDGE_EXACT_TEXT_APPLY_RECONCILIATION_SCHEMA,
    operationId: entry.operationId,
    status: entry.status,
    previousStatus: normalizeString(reconciliation.previousStatus),
    outcome: normalizeString(reconciliation.outcome),
    ambiguous: reconciliation.ambiguous === true,
    projectId: entry.projectId,
    sessionId: entry.sessionId,
    sceneId: entry.sceneId,
    changeIds: Array.isArray(entry.changeIds) ? [...entry.changeIds] : [],
    sceneRelativePath: entry.sceneRelativePath,
    beforeHash: entry.beforeHash,
    afterHash: entry.afterHash,
    observedHash: normalizeString(reconciliation.observedHash),
    recoveryVerified: reconciliation.recoveryVerified === true,
    snapshotAvailable: reconciliation.snapshotAvailable === true,
    transactionIntentState: normalizeString(reconciliation.transactionIntentState),
    safeActions: Array.isArray(reconciliation.safeActions) ? [...reconciliation.safeActions] : [],
    reconciledAt: normalizeString(reconciliation.reconciledAt),
    receipt: reconciliation.outcome === 'applied_receipt_present' && isPlainObject(entry.receipt)
      ? cloneJsonSafe(entry.receipt)
      : null,
  };
}

export async function reconcileExactTextApplyJournal(projectRoot, operationId, options = {}) {
  const context = await resolveProjectContext(projectRoot, { createJournalDirectory: true });
  const entry = await readJournalEntryFromContext(context, operationId);
  if (entry.status === 'reconciled') return publicReconciliation(entry);

  const scenePath = await resolveStoredProjectFile(context, entry.sceneRelativePath, 'sceneRelativePath');
  const observedHash = sha256Text(await fs.readFile(scenePath, 'utf8'));
  let snapshotAvailable = false;
  let recoveryVerified = false;
  if (normalizeString(entry.recovery?.snapshotRelativePath)) {
    try {
      const snapshotPath = await resolveStoredProjectFile(
        context,
        entry.recovery.snapshotRelativePath,
        'snapshotRelativePath',
      );
      snapshotAvailable = true;
      recoveryVerified = sha256Text(await fs.readFile(snapshotPath, 'utf8')) === entry.beforeHash;
    } catch {}
  }

  const pendingIntent = await readTransactionIntent(scenePath).catch(() => null);
  const intentConflicts = Boolean(
    pendingIntent
    && (
      pendingIntent.corrupt === true
      || (normalizeString(pendingIntent.targetPath) && path.resolve(pendingIntent.targetPath) !== scenePath)
      || (normalizeString(pendingIntent.nextTextHash) && pendingIntent.nextTextHash !== entry.afterHash)
    )
  );
  const receiptValid = entry.status === 'receipt_written'
    && isPlainObject(entry.receipt)
    && entry.receipt.operationId === entry.operationId
    && entry.receipt.outputHash === entry.afterHash
    && entry.receipt.writeStatus === 'applied';

  let outcome = 'conflict';
  if (!intentConflicts && observedHash === entry.beforeHash) {
    outcome = 'not_applied';
  } else if (!intentConflicts && observedHash === entry.afterHash && recoveryVerified && receiptValid) {
    outcome = 'applied_receipt_present';
  } else if (!intentConflicts && observedHash === entry.afterHash && recoveryVerified) {
    outcome = 'applied_receipt_missing';
  }

  const reconciledAt = toIsoString(options.now);
  const reconciledEntry = appendStatus(entry, 'reconciled', options.now);
  reconciledEntry.reconciliation = {
    schemaVersion: REVISION_BRIDGE_EXACT_TEXT_APPLY_RECONCILIATION_SCHEMA,
    previousStatus: entry.status,
    outcome,
    ambiguous: outcome === 'applied_receipt_missing' || outcome === 'conflict',
    observedHash,
    recoveryVerified,
    snapshotAvailable,
    transactionIntentState: normalizeString(pendingIntent?.state),
    safeActions: ['RELOAD_CANONICAL'],
    reconciledAt,
  };
  await writeJournalEntry(context, reconciledEntry);

  if (outcome !== 'conflict' && pendingIntent) {
    await clearTransactionIntent(scenePath).catch(() => {});
  }
  return publicReconciliation(reconciledEntry);
}

async function listJournalOperationIds(context) {
  let entries = [];
  try {
    entries = await fs.readdir(context.journalDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -5))
    .filter((operationId) => OPERATION_ID_PATTERN.test(operationId))
    .sort()
    .reverse();
}

async function pruneReconciledJournals(context, operationIds) {
  const reconciled = [];
  for (const operationId of operationIds.slice(0, JOURNAL_SCAN_LIMIT)) {
    try {
      const entry = await readJournalEntryFromContext(context, operationId);
      if (entry.status === 'reconciled') reconciled.push(operationId);
    } catch {}
  }
  for (const operationId of reconciled.slice(JOURNAL_RETAIN_RECONCILED)) {
    await fs.unlink(journalPathFor(context, operationId)).catch(() => {});
  }
}

export async function reconcilePendingExactTextApplyJournals(projectRoot, options = {}) {
  const context = await resolveProjectContext(projectRoot, { createJournalDirectory: true });
  const operationIds = await listJournalOperationIds(context);
  const reconciliations = [];
  const errors = [];
  for (const operationId of operationIds.slice(0, JOURNAL_SCAN_LIMIT)) {
    try {
      const entry = await readJournalEntryFromContext(context, operationId);
      if (!PENDING_STATUSES.has(entry.status)) continue;
      reconciliations.push(await reconcileExactTextApplyJournal(projectRoot, operationId, options));
    } catch (error) {
      errors.push({
        operationId,
        code: normalizeString(error?.code) || 'E_REVISION_BRIDGE_APPLY_JOURNAL_RECONCILE_FAILED',
      });
    }
  }
  if (operationIds.length > JOURNAL_SCAN_LIMIT) {
    errors.push({
      operationId: '',
      code: 'E_REVISION_BRIDGE_APPLY_JOURNAL_SCAN_LIMIT_EXCEEDED',
    });
  }
  await pruneReconciledJournals(context, operationIds);
  return {
    ok: errors.length === 0,
    reconciliations,
    userRelevant: reconciliations.filter((item) => item.outcome !== 'applied_receipt_present'),
    errors,
  };
}

export async function readCanonicalSceneForExactTextApplyReconciliation(projectRoot, operationId) {
  const context = await resolveProjectContext(projectRoot, { createJournalDirectory: true });
  const entry = await readJournalEntryFromContext(context, operationId);
  if (entry.status !== 'reconciled' || !isPlainObject(entry.reconciliation)) {
    throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_NOT_RECONCILED', 'journal is not reconciled');
  }
  const scenePath = await resolveStoredProjectFile(context, entry.sceneRelativePath, 'sceneRelativePath');
  const content = await fs.readFile(scenePath, 'utf8');
  return {
    operationId: entry.operationId,
    scenePath,
    content,
    contentHash: sha256Text(content),
    reconciliation: publicReconciliation(entry),
  };
}

export async function acknowledgeExactTextApplyReconciliation(projectRoot, operationId, action, options = {}) {
  return updateJournalEntry(projectRoot, operationId, async (entry) => {
    if (entry.status !== 'reconciled' || !isPlainObject(entry.reconciliation)) {
      throw journalError('E_REVISION_BRIDGE_APPLY_JOURNAL_NOT_RECONCILED', 'journal is not reconciled');
    }
    return {
      ...entry,
      updatedAt: toIsoString(options.now),
      reconciliation: {
        ...entry.reconciliation,
        acknowledgedAction: normalizeString(action),
        acknowledgedAt: toIsoString(options.now),
      },
    };
  }, options);
}

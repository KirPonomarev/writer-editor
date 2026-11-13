// R2.4 WP-200_DURABLE_SAVE - bind dirty-state acknowledgement to the exact
// durable receipt returned for the captured editor generation and bytes.
'use strict';

const crypto = require('node:crypto');

const { decideAutosaveAck } = require('./autosave-generation-v1.cjs');
const { classifySaveAck } = require('./dirty-admission-v1.cjs');
const { SAVE_PHASES } = require('./save-coordinator-v1.cjs');
const { COMMIT_PHASES } = require('./project-commit-v1.cjs');
const { TRANSACTION_PHASE_CHAIN } = require('./project-transaction-v1.cjs');

class SaveReceiptAckError extends Error {
  constructor(code, detail = '') {
    super(detail ? code + ': ' + detail : code);
    this.code = code;
  }
}

const DURABLE_SAVE_PHASE_CHAIN = Object.freeze([
  SAVE_PHASES.ADMIT,
  SAVE_PHASES.TEMP_WRITE,
  SAVE_PHASES.TEMP_FSYNC,
  SAVE_PHASES.ATOMIC_PUBLISH,
  SAVE_PHASES.PARENT_FSYNC,
  SAVE_PHASES.READBACK,
  SAVE_PHASES.ACK,
]);

const PROJECT_COMMIT_PHASE_CHAIN = Object.freeze([
  COMMIT_PHASES.ADMIT,
  COMMIT_PHASES.PREPARE,
  COMMIT_PHASES.MANIFEST_PERSIST,
  COMMIT_PHASES.SCENE_PUBLISH,
  COMMIT_PHASES.MARKER,
  COMMIT_PHASES.ACK,
]);

// Only the opt-in batch adapter may issue this phase-bound receipt. The
// caller supplies its independently admitted source roster to the ACK binder.
const FLOW_BATCH_RECEIPT_SCHEMA = 'yalken.flow-batch.save-receipt.v2';
const FLOW_BATCH_PHASE_CHAIN = Object.freeze(['ADMIT', 'INTENT_DURABLE', 'TEMP_FSYNC',
  'ATOMIC_PUBLISH', 'PARENT_FSYNC', 'READBACK', 'COMMIT_DURABLE', 'CLEANUP_DURABLE', 'ACK']);
function flowBatchEntryTuples(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new SaveReceiptAckError('E_FLOW_SAVE_RECEIPT_ENTRIES_INVALID');
  const scenes = new Set(), nodes = new Set();
  return entries.map(entry => {
    const keys = ['sceneId', 'nodeId', 'baselineHashBefore', 'contentHashAfter', 'bytesWritten'];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).length !== keys.length || keys.some(key => !Object.hasOwn(entry, key))
      || typeof entry.sceneId !== 'string' || !entry.sceneId || entry.sceneId.startsWith('/')
      || entry.sceneId.split('/').includes('..') || /[\\\u0000-\u001f\u007f]/u.test(entry.sceneId)
      || !/^tree-node-[a-f0-9]{32}$/u.test(entry.nodeId || '')
      || !/^[a-f0-9]{64}$/u.test(entry.baselineHashBefore || '')
      || !/^[a-f0-9]{64}$/u.test(entry.contentHashAfter || '')
      || !Number.isSafeInteger(entry.bytesWritten) || entry.bytesWritten < 0
      || scenes.has(entry.sceneId) || nodes.has(entry.nodeId)) throw new SaveReceiptAckError('E_FLOW_SAVE_RECEIPT_ENTRIES_INVALID');
    scenes.add(entry.sceneId); nodes.add(entry.nodeId);
    return keys.map(key => entry[key]);
  });
}

const sha256hex = (content) => crypto.createHash('sha256').update(content).digest('hex');

function phaseChainEquals(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((phase, index) => phase === expected[index]);
}

function identifyReceiptKind(receipt) {
  if (receipt.operation === 'flow.batch.save.v1' || String(receipt.schemaVersion || '').startsWith('yalken.flow-batch.')) {
    if (receipt.schemaVersion !== FLOW_BATCH_RECEIPT_SCHEMA) throw new SaveReceiptAckError('E_FLOW_SAVE_RECEIPT_VERSION_INVALID');
    if (!phaseChainEquals(receipt.phases, FLOW_BATCH_PHASE_CHAIN)) throw new SaveReceiptAckError('E_SAVE_RECEIPT_PHASE_CHAIN_INVALID');
    return 'FLOW_BATCH_DURABLE_V2';
  }
  if (phaseChainEquals(receipt.phases, DURABLE_SAVE_PHASE_CHAIN)) return 'DURABLE_SAVE_V1';
  if (phaseChainEquals(receipt.phases, PROJECT_COMMIT_PHASE_CHAIN)) return 'PROJECT_COMMIT_V1';
  if (phaseChainEquals(receipt.phases, TRANSACTION_PHASE_CHAIN)) return 'PROJECT_TRANSACTION_V1';
  throw new SaveReceiptAckError('E_SAVE_RECEIPT_PHASE_CHAIN_INVALID');
}

function validateSaveReceipt({ receipt, capturedContent, capturedGeneration, expectedBatchEntries }) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new SaveReceiptAckError('E_SAVE_RECEIPT_REQUIRED');
  }
  if (receipt.success !== true) {
    throw new SaveReceiptAckError('E_SAVE_RECEIPT_SUCCESS_REQUIRED');
  }
  if (!Number.isInteger(capturedGeneration) || capturedGeneration < 0) {
    throw new SaveReceiptAckError('E_SAVE_RECEIPT_GENERATION_INVALID', String(capturedGeneration));
  }
  if (receipt.revision !== capturedGeneration) {
    throw new SaveReceiptAckError(
      'E_SAVE_RECEIPT_REVISION_MISMATCH',
      'receipt=' + String(receipt.revision) + ' captured=' + capturedGeneration,
    );
  }
  if (typeof capturedContent !== 'string' && !Buffer.isBuffer(capturedContent)) {
    throw new SaveReceiptAckError('E_SAVE_RECEIPT_CONTENT_SHAPE');
  }

  const receiptKind = identifyReceiptKind(receipt);
  const expectedDigest = sha256hex(capturedContent);
  const receiptDigest = ['DURABLE_SAVE_V1', 'FLOW_BATCH_DURABLE_V2'].includes(receiptKind) ? receipt.digest : receipt.sceneDigest;
  if (receiptDigest !== expectedDigest) {
    throw new SaveReceiptAckError('E_SAVE_RECEIPT_DIGEST_MISMATCH');
  }

  const expectedBytes = Buffer.isBuffer(capturedContent)
    ? capturedContent.length
    : Buffer.byteLength(capturedContent, 'utf8');
  if (['DURABLE_SAVE_V1', 'FLOW_BATCH_DURABLE_V2'].includes(receiptKind) && receipt.bytes !== expectedBytes) {
    throw new SaveReceiptAckError(
      'E_SAVE_RECEIPT_BYTES_MISMATCH',
      'receipt=' + String(receipt.bytes) + ' captured=' + expectedBytes,
    );
  }

  if (receiptKind === 'FLOW_BATCH_DURABLE_V2') {
    const actual = flowBatchEntryTuples(receipt.entries), expected = flowBatchEntryTuples(expectedBatchEntries);
    if (receipt.committed !== true || receipt.markerCleared !== true || receipt.sceneCount !== actual.length
      || !/^flow-batch-[0-9]+-[a-f0-9]{8}$/u.test(receipt.batchId || '')
      || JSON.stringify(actual) !== JSON.stringify(expected)) throw new SaveReceiptAckError('E_FLOW_SAVE_RECEIPT_ENTRIES_MISMATCH');
  }

  return Object.freeze({
    receiptKind,
    revision: capturedGeneration,
    digest: expectedDigest,
    bytes: expectedBytes,
  });
}

function bindSaveReceiptToAck({
  receipt,
  capturedContent,
  capturedGeneration,
  latestEditGeneration,
  expectedBatchEntries,
}) {
  const validatedReceipt = validateSaveReceipt({ receipt, capturedContent, capturedGeneration, expectedBatchEntries });
  const decision = decideAutosaveAck({ capturedGeneration, latestEditGeneration });
  const ack = classifySaveAck({
    writeSucceeded: true,
    ackOutcome: decision.outcome,
    savedGeneration: capturedGeneration,
    latestEditGeneration,
  });
  return Object.freeze({ receipt: validatedReceipt, ack });
}

module.exports = Object.freeze({
  DURABLE_SAVE_PHASE_CHAIN,
  PROJECT_COMMIT_PHASE_CHAIN,
  FLOW_BATCH_RECEIPT_SCHEMA,
  FLOW_BATCH_PHASE_CHAIN,
  validateFlowBatchEntryRoster: flowBatchEntryTuples,
  SaveReceiptAckError,
  bindSaveReceiptToAck,
  validateSaveReceipt,
});

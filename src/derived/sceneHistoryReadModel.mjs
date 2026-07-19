import crypto from 'node:crypto';
import path from 'node:path';

const SCENE_HISTORY_SCHEMA = 'scene-history-read-model.v1';
const DEFAULT_MAX_SNAPSHOTS = 20;
const DIFF_CONTEXT_CHARS = 160;

function sha256(text = '') {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeStamp(value) {
  const stamp = Number(value);
  return Number.isFinite(stamp) && stamp >= 0 ? Math.trunc(stamp) : 0;
}

function parseSnapshotStamp(snapshotPath) {
  const baseName = path.basename(typeof snapshotPath === 'string' ? snapshotPath : '');
  const match = /\.bak\.(\d{13})$/u.exec(baseName);
  return match ? Number(match[1]) : 0;
}

function normalizeSnapshotRecord(record = {}, index = 0) {
  const snapshotPath = typeof record.snapshotPath === 'string'
    ? record.snapshotPath
    : (typeof record.fullPath === 'string' ? record.fullPath : '');
  const stamp = normalizeStamp(record.stamp || parseSnapshotStamp(snapshotPath));
  const snapshotId = stamp
    ? `recovery-snapshot-${stamp}`
    : `recovery-snapshot-${index + 1}`;
  const readable = record.readable !== false && typeof record.text === 'string';
  const text = readable ? record.text : '';
  const error = typeof record.error === 'string' ? record.error : '';
  return {
    snapshotId,
    stamp,
    createdAtUtc: stamp ? new Date(stamp).toISOString() : '',
    source: 'recovery-snapshot',
    label: stamp ? `Snapshot ${new Date(stamp).toISOString()}` : `Snapshot ${index + 1}`,
    readable,
    byteLength: Buffer.byteLength(text, 'utf8'),
    contentHash: readable ? sha256(text) : '',
    error,
    text,
  };
}

function findCommonPrefixLength(before, after) {
  const limit = Math.min(before.length, after.length);
  let offset = 0;
  while (offset < limit && before[offset] === after[offset]) offset += 1;
  return offset;
}

function findCommonSuffixLength(before, after, prefixLength) {
  const maxBefore = before.length - prefixLength;
  const maxAfter = after.length - prefixLength;
  const limit = Math.min(maxBefore, maxAfter);
  let offset = 0;
  while (
    offset < limit
    && before[before.length - 1 - offset] === after[after.length - 1 - offset]
  ) {
    offset += 1;
  }
  if (offset > 0) {
    const beforeBoundaryIndex = before.length - offset;
    const afterBoundaryIndex = after.length - offset;
    const beforeBoundary = beforeBoundaryIndex <= prefixLength || /\s/u.test(before[beforeBoundaryIndex] || '');
    const afterBoundary = afterBoundaryIndex <= prefixLength || /\s/u.test(after[afterBoundaryIndex] || '');
    if (!beforeBoundary || !afterBoundary) return 0;
  }
  return offset;
}

function countWords(text) {
  const matches = normalizeText(text).trim().match(/[^\s]+/gu);
  return matches ? matches.length : 0;
}

function sliceContext(text, start, end) {
  const safeStart = Math.max(0, start - DIFF_CONTEXT_CHARS);
  const safeEnd = Math.min(text.length, end + DIFF_CONTEXT_CHARS);
  return text.slice(safeStart, safeEnd);
}

export function buildSimpleTextDiff(beforeInput = '', afterInput = '') {
  const before = normalizeText(beforeInput);
  const after = normalizeText(afterInput);
  const beforeHash = sha256(before);
  const afterHash = sha256(after);
  if (beforeHash === afterHash) {
    return {
      schemaVersion: 'scene-text-diff.v1',
      changed: false,
      beforeHash,
      afterHash,
      prefixLength: before.length,
      suffixLength: 0,
      removedText: '',
      insertedText: '',
      removedPreview: '',
      insertedPreview: '',
      removedLength: 0,
      insertedLength: 0,
      beforeWordCount: countWords(before),
      afterWordCount: countWords(after),
      deltaWords: 0,
    };
  }

  const prefixLength = findCommonPrefixLength(before, after);
  const suffixLength = findCommonSuffixLength(before, after, prefixLength);
  const beforeEnd = before.length - suffixLength;
  const afterEnd = after.length - suffixLength;
  const removedText = before.slice(prefixLength, beforeEnd);
  const insertedText = after.slice(prefixLength, afterEnd);
  const beforeWordCount = countWords(before);
  const afterWordCount = countWords(after);

  return {
    schemaVersion: 'scene-text-diff.v1',
    changed: true,
    beforeHash,
    afterHash,
    prefixLength,
    suffixLength,
    removedText,
    insertedText,
    removedPreview: sliceContext(before, prefixLength, beforeEnd),
    insertedPreview: sliceContext(after, prefixLength, afterEnd),
    removedLength: removedText.length,
    insertedLength: insertedText.length,
    beforeWordCount,
    afterWordCount,
    deltaWords: afterWordCount - beforeWordCount,
  };
}

export function buildSceneHistoryReadModel(input = {}) {
  const projectId = typeof input.projectId === 'string' ? input.projectId : '';
  const nodeId = typeof input.nodeId === 'string' ? input.nodeId : '';
  const title = typeof input.title === 'string' ? input.title : '';
  const currentText = normalizeText(input.currentText);
  const selectedSnapshotId = typeof input.selectedSnapshotId === 'string' ? input.selectedSnapshotId : '';
  const unavailableReason = typeof input.unavailableReason === 'string' ? input.unavailableReason : '';
  const rawSnapshots = Array.isArray(input.snapshots) ? input.snapshots : [];
  const snapshots = rawSnapshots
    .map(normalizeSnapshotRecord)
    .sort((a, b) => b.stamp - a.stamp)
    .slice(0, DEFAULT_MAX_SNAPSHOTS);
  const selected = snapshots.find((snapshot) => snapshot.snapshotId === selectedSnapshotId)
    || snapshots.find((snapshot) => snapshot.readable)
    || snapshots[0]
    || null;
  const state = unavailableReason
    ? 'unavailable'
    : (nodeId ? 'ready' : 'empty');
  const currentHash = sha256(currentText);

  return {
    ok: true,
    schemaVersion: SCENE_HISTORY_SCHEMA,
    projectId,
    nodeId,
    title,
    state,
    unavailableReason,
    current: {
      contentHash: currentHash,
      byteLength: Buffer.byteLength(currentText, 'utf8'),
      wordCount: countWords(currentText),
    },
    snapshots: snapshots.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      stamp: snapshot.stamp,
      createdAtUtc: snapshot.createdAtUtc,
      source: snapshot.source,
      label: snapshot.label,
      readable: snapshot.readable,
      byteLength: snapshot.byteLength,
      contentHash: snapshot.contentHash,
      error: snapshot.error,
      currentHash,
      changedFromCurrent: snapshot.readable ? snapshot.contentHash !== currentHash : false,
    })),
    selectedSnapshot: selected
      ? {
          snapshotId: selected.snapshotId,
          stamp: selected.stamp,
          createdAtUtc: selected.createdAtUtc,
          source: selected.source,
          readable: selected.readable,
          contentHash: selected.contentHash,
          error: selected.error,
          diff: selected.readable ? buildSimpleTextDiff(selected.text, currentText) : null,
        }
      : null,
    retention: {
      maxSnapshots: DEFAULT_MAX_SNAPSHOTS,
      bounded: true,
      sourceOfTruth: 'recovery-evidence',
    },
    distinguishes: {
      reviewSession: false,
      shellState: false,
      textHistory: true,
    },
  };
}

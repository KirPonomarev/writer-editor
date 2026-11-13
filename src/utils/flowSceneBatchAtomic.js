const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { FLOW_BATCH_RECEIPT_SCHEMA, FLOW_BATCH_PHASE_CHAIN, validateFlowBatchEntryRoster } = require('../core/save-receipt-ack-v1.cjs');

function buildError(code, reason, details = {}) {
  return { ok: false, error: { code, reason, details } };
}

function computeContentHash(content) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(content) ? content : String(content ?? ''), 'utf8').digest('hex');
}

function normalizeBatchEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_invalid' } };
  }

  const seen = new Set();
  const normalized = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_invalid_item' } };
    }
    const targetPath = typeof entry.path === 'string' ? entry.path : '';
    // This is an internal persistence port, not a renderer payload decoder.
    // Snapshot real binary buffers before the first await; JSON-shaped buffers
    // or other objects must never silently become successful empty files.
    if (entry.content != null && typeof entry.content !== 'string' && !Buffer.isBuffer(entry.content)) {
      return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_content_invalid' } };
    }
    const content = Buffer.isBuffer(entry.content) ? Buffer.from(entry.content)
      : typeof entry.content === 'string' ? entry.content : '';
    if (!targetPath) {
      return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_path_required' } };
    }
    if (seen.has(targetPath)) {
      return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_duplicate_path', details: { path: targetPath } } };
    }
    seen.add(targetPath);
    normalized.push({
      ...entry,
      path: targetPath,
      content,
      contentHash: computeContentHash(content),
    });
  }

  return { ok: true, value: normalized };
}

function buildBatchRoot(projectRoot) {
  return path.join(projectRoot, '.flow-batch');
}

function buildBatchMarkerPath(batchRoot, batchId) {
  return path.join(batchRoot, `${batchId}.json`);
}

function buildTempPath(targetPath, batchId) {
  const directory = path.dirname(targetPath);
  const baseName = path.basename(targetPath);
  return path.join(directory, `.${baseName}.flow-batch.${batchId}.tmp`);
}

function buildBackupPath(targetPath, batchId) {
  const directory = path.dirname(targetPath);
  const baseName = path.basename(targetPath);
  return path.join(directory, `.${baseName}.flow-batch.${batchId}.bak`);
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeTextFileStrict(targetPath, content, options = {}) {
  let handle = null;
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    handle = await fs.open(targetPath, options.exclusive ? 'wx' : 'w');
    if (options.onAcquired) options.onAcquired(targetPath);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}

async function syncDirectory(directory) {
  const handle = await fs.open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function syncBatchDirectories(projectRoot, batchRoot, entries) {
  for (const directory of new Set([projectRoot, batchRoot, ...entries.map(entry => path.dirname(entry.path))])) await syncDirectory(directory);
}
async function writeJsonAtomic(targetPath, value, durable = false) {
  const tempPath = `${targetPath}.tmp`; let acquired = false;
  try {
    await writeTextFileStrict(tempPath, JSON.stringify(value, null, 2), { exclusive: durable, onAcquired: () => { acquired = true; } });
    await fs.rename(tempPath, targetPath);
    if (durable) await syncDirectory(path.dirname(targetPath));
  } catch (error) {
    if (durable && acquired) {
      try { await fs.unlink(tempPath); } catch (cleanup) { if (cleanup.code !== 'ENOENT') error.message += `; cleanup: ${cleanup.message}`; }
    }
    throw error;
  }
}

async function cleanupFiles(paths, strict = false) {
  for (const targetPath of paths) {
    try { await fs.unlink(targetPath); } catch (error) { if (strict && error.code !== 'ENOENT') throw error; }
  }
}

async function rollbackActivatedEntries(entries) {
  for (const entry of [...entries].reverse()) {
    if (entry.targetActivated === true) {
      await fs.unlink(entry.path).catch(() => {});
    }
    if (entry.backupActivated === true) {
      const backupExists = await exists(entry.backupPath);
      if (backupExists) {
        await fs.rename(entry.backupPath, entry.path).catch(() => {});
      }
    }
  }
}

async function removeBackups(entries, strict = false) {
  for (const entry of entries) {
    try { await fs.unlink(entry.backupPath); } catch (error) { if (strict && error.code !== 'ENOENT') throw error; }
  }
}

async function listStaleMarkers(batchRoot, strict = false) {
  try {
    const entries = await fs.readdir(batchRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(batchRoot, entry.name))
      .sort();
  } catch (error) {
    if (strict && error.code !== 'ENOENT') throw error;
    return [];
  }
}

async function readFlowSceneBatchMarkers(projectRoot) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
    return [];
  }
  return listStaleMarkers(buildBatchRoot(projectRoot));
}

async function ensureCommitMarkerPresent(markerPath) {
  if (!(await exists(markerPath))) {
    throw new Error('FLOW_BATCH_COMMIT_MARKER_MISSING');
  }
}

async function updateMarker(markerPath, state, durable = false) {
  await ensureCommitMarkerPresent(markerPath);
  await writeJsonAtomic(markerPath, state, durable);
}

async function writeFlowSceneBatchAtomic(input = {}, options = {}) {
  const projectRoot = typeof input.projectRoot === 'string' ? input.projectRoot : '';
  const normalizedEntriesResult = normalizeBatchEntries(input.entries);
  if (!projectRoot) {
    return buildError('M7_FLOW_BATCH_INVALID', 'flow_save_project_root_required');
  }
  if (!normalizedEntriesResult.ok) {
    return normalizedEntriesResult;
  }
  const durable = options.durableReceipt !== undefined, admission = options.durableReceipt;
  let receiptEntries = null;
  if (durable) {
    try {
      if (!admission || typeof admission !== 'object' || Array.isArray(admission)
        || !Number.isSafeInteger(admission.revision) || admission.revision < 0 || typeof admission.authoringContent !== 'string'
        || !path.isAbsolute(projectRoot)) throw Error('DURABLE_AUTHORING_ADMISSION_INVALID');
      receiptEntries = normalizedEntriesResult.value.map(entry => {
        const relative = path.relative(projectRoot, entry.path);
        if (typeof entry.content !== 'string' || !path.isAbsolute(entry.path) || !relative || relative === '..'
          || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error('DURABLE_SOURCE_BOUNDARY_INVALID');
        return { sceneId: entry.sceneId, nodeId: entry.nodeId, baselineHashBefore: entry.baselineHash,
          contentHashAfter: entry.contentHash, bytesWritten: Buffer.byteLength(entry.content) };
      });
      validateFlowBatchEntryRoster(receiptEntries);
      if (await fs.realpath(projectRoot) !== projectRoot) throw Error('DURABLE_SOURCE_ROOT_ALIAS');
      for (const entry of normalizedEntriesResult.value) {
        const stat = await fs.lstat(entry.path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
          || await fs.realpath(path.dirname(entry.path)) !== path.dirname(entry.path)) throw Error('DURABLE_SOURCE_IDENTITY_INVALID');
      }
    } catch (error) { return buildError('M7_FLOW_DURABLE_ADMISSION_INVALID', 'flow_durable_admission_invalid', { message: error.message }); }
  }
  const batchId = `flow-batch-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const batchRoot = buildBatchRoot(projectRoot);
  const markerPath = buildBatchMarkerPath(batchRoot, batchId);
  const entries = normalizedEntriesResult.value.map((entry) => ({
    ...entry,
    tempPath: buildTempPath(entry.path, batchId),
    backupPath: buildBackupPath(entry.path, batchId),
    backupActivated: false,
    targetActivated: false,
  }));

  const staleMarkers = await listStaleMarkers(batchRoot, durable);
  if (staleMarkers.length > 0) {
    return buildError('M7_FLOW_BATCH_STALE', 'flow_save_batch_stale', {
      staleMarkers,
    });
  }

  await fs.mkdir(batchRoot, { recursive: true });
  const markerState = {
    batchId,
    projectRoot,
    state: 'INTENT_RECORDED',
    sceneCount: entries.length,
    entries: entries.map((entry) => ({
      path: entry.path,
      tempPath: entry.tempPath,
      backupPath: entry.backupPath,
    })),
  };

  const phases = durable ? [FLOW_BATCH_PHASE_CHAIN[0]] : [], ownedTemps = new Set();
  try {
    if (durable) await syncDirectory(projectRoot);
    await writeJsonAtomic(markerPath, markerState, durable);
    if (durable) phases.push(FLOW_BATCH_PHASE_CHAIN[1]);
  } catch (error) {
    return buildError('M7_FLOW_BATCH_RECOVERY_EVIDENCE_FAIL', 'flow_save_batch_recovery_evidence_fail', {
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }

  const tempPaths = entries.map((entry) => entry.tempPath);
  let durableCommit = false;
  try {
    if (typeof options.afterIntentRecorded === 'function') {
      await options.afterIntentRecorded({ batchId, markerPath, entries });
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      await writeTextFileStrict(entry.tempPath, entry.content, { exclusive: durable, onAcquired: target => ownedTemps.add(target) });
      if (typeof options.afterTempWrite === 'function') {
        await options.afterTempWrite({ batchId, markerPath, entry, index });
      }
    }

    if (durable) await syncBatchDirectories(projectRoot, batchRoot, entries);
    await updateMarker(markerPath, {
      ...markerState,
      state: 'TEMP_WRITTEN',
    }, durable);
    if (durable) phases.push(FLOW_BATCH_PHASE_CHAIN[2]);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (typeof options.beforeActivate === 'function') {
        await options.beforeActivate({ batchId, markerPath, entry, index });
      }
      if (durable) {
        entry.beforeBytes = await fs.readFile(entry.path);
        if (!Buffer.from(entry.beforeBytes.toString('utf8')).equals(entry.beforeBytes)
          || computeContentHash(entry.beforeBytes.toString('utf8').replaceAll('\r\n', '\n').replaceAll('\r', '\n')) !== entry.baselineHash)
          throw Error('FLOW_BATCH_SOURCE_BASELINE_CHANGED');
      }
      if (await exists(entry.path)) {
        await fs.rename(entry.path, entry.backupPath);
        entry.backupActivated = true;
      }
      if (durable) {
        const backup = await fs.readFile(entry.backupPath);
        if (!backup.equals(entry.beforeBytes)) throw Error('FLOW_BATCH_SOURCE_BASELINE_CHANGED');
        if (typeof options.beforeActivate === 'function') await options.beforeActivate({ batchId, markerPath, entry, index });
      }
      await fs.rename(entry.tempPath, entry.path);
      entry.targetActivated = true;

      if (typeof options.afterActivate === 'function') {
        await options.afterActivate({ batchId, markerPath, entry, index });
      }
    }
    if (durable) {
      phases.push(FLOW_BATCH_PHASE_CHAIN[3]);
      await syncBatchDirectories(projectRoot, batchRoot, entries); phases.push(FLOW_BATCH_PHASE_CHAIN[4]);
      for (const entry of entries) if (computeContentHash(await fs.readFile(entry.path)) !== entry.contentHash) throw Error('FLOW_BATCH_READBACK_MISMATCH');
      phases.push(FLOW_BATCH_PHASE_CHAIN[5]);
    }
    await updateMarker(markerPath, {
      ...markerState,
      state: 'COMMIT_MARKED',
    }, durable);
    if (durable) { durableCommit = true; phases.push(FLOW_BATCH_PHASE_CHAIN[6]); }
    await removeBackups(entries, durable);
    if (durable) await fs.unlink(markerPath); else await fs.unlink(markerPath).catch(() => {});
    if (durable) await syncBatchDirectories(projectRoot, batchRoot, entries);
    const markerCleared = !(await exists(markerPath));
    if (durable && !markerCleared) throw Error('FLOW_BATCH_CLEANUP_UNCONFIRMED');
    if (durable) phases.push(FLOW_BATCH_PHASE_CHAIN[7], FLOW_BATCH_PHASE_CHAIN[8]);
    return {
      ok: true,
      value: {
        batchId,
        sceneCount: entries.length,
        markerPath,
        receipt: {
          operation: 'flow.batch.save.v1',
          batchId,
          sceneCount: entries.length,
          committed: true,
          markerCleared,
          entries: durable ? receiptEntries : entries.map((entry) => ({
            path: entry.path,
            contentHash: entry.contentHash,
            bytesWritten: Buffer.byteLength(entry.content, 'utf8'),
          })),
          ...(durable ? { schemaVersion: FLOW_BATCH_RECEIPT_SCHEMA, success: true, revision: admission.revision,
            digest: computeContentHash(admission.authoringContent), bytes: Buffer.byteLength(admission.authoringContent), phases: [...phases] } : {}),
        },
      },
    };
  } catch (error) {
    const failReason = error && typeof error.message === 'string' ? error.message : 'UNKNOWN';
    if (durableCommit) {
      let recoveryEvidenceConfirmed = true;
      try { await writeJsonAtomic(markerPath, { ...markerState, state: 'COMMIT_MARKED', failReason }, true); }
      catch { recoveryEvidenceConfirmed = false; }
      return buildError('M7_FLOW_BATCH_CLEANUP_UNCONFIRMED', 'flow_save_batch_cleanup_unconfirmed', { batchId, markerPath, committed: true, recoveryEvidenceConfirmed });
    }
    await rollbackActivatedEntries(entries);
    let rollbackConfirmed = true, cleanupConfirmed = true;
    if (durable) {
      for (const entry of entries) if (entry.backupActivated) {
        try { if (!(await fs.readFile(entry.path)).equals(entry.beforeBytes)) rollbackConfirmed = false; }
        catch { rollbackConfirmed = false; }
      }
    }
    try { await cleanupFiles(durable ? [...ownedTemps] : tempPaths, durable); }
    catch { cleanupConfirmed = false; }
    let recoveryEvidenceConfirmed = true;
    try {
      await writeJsonAtomic(markerPath, { ...markerState, state: 'FAILED', failReason }, durable);
      if (durable) await syncBatchDirectories(projectRoot, batchRoot, entries);
    } catch { recoveryEvidenceConfirmed = false; }
    return buildError(
      error && error.message === 'FLOW_BATCH_COMMIT_MARKER_MISSING'
        ? 'M7_FLOW_BATCH_COMMIT_MARKER_MISSING'
        : 'M7_FLOW_BATCH_WRITE_FAIL',
      error && error.message === 'FLOW_BATCH_COMMIT_MARKER_MISSING'
        ? 'flow_save_batch_commit_marker_missing'
        : 'flow_save_batch_write_failed',
      {
        batchId,
        markerPath,
        ...(durable ? { rollbackConfirmed, cleanupConfirmed, recoveryEvidenceConfirmed, failReason } : {}),
      },
    );
  }
}

module.exports = {
  buildBatchRoot,
  buildBatchMarkerPath,
  readFlowSceneBatchMarkers,
  writeFlowSceneBatchAtomic,
};

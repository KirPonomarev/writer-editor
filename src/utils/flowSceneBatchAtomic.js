const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

function buildError(code, reason, details = {}) {
  return { ok: false, error: { code, reason, details } };
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
    const content = typeof entry.content === 'string' ? entry.content : '';
    if (!targetPath) {
      return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_path_required' } };
    }
    if (seen.has(targetPath)) {
      return { ok: false, error: { code: 'M7_FLOW_BATCH_INVALID', reason: 'flow_save_batch_duplicate_path', details: { path: targetPath } } };
    }
    seen.add(targetPath);
    normalized.push({ path: targetPath, content });
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

async function writeTextFileStrict(targetPath, content) {
  let handle = null;
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    handle = await fs.open(targetPath, 'w');
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

async function writeJsonAtomic(targetPath, value) {
  const tempPath = `${targetPath}.tmp`;
  await writeTextFileStrict(tempPath, JSON.stringify(value, null, 2));
  await fs.rename(tempPath, targetPath);
}

async function cleanupFiles(paths) {
  for (const targetPath of paths) {
    await fs.unlink(targetPath).catch(() => {});
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

async function removeBackups(entries) {
  for (const entry of entries) {
    await fs.unlink(entry.backupPath).catch(() => {});
  }
}

async function listStaleMarkers(batchRoot) {
  try {
    const entries = await fs.readdir(batchRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(batchRoot, entry.name))
      .sort();
  } catch {
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

async function updateMarker(markerPath, state) {
  await ensureCommitMarkerPresent(markerPath);
  await writeJsonAtomic(markerPath, state);
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

  const staleMarkers = await listStaleMarkers(batchRoot);
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

  try {
    await writeJsonAtomic(markerPath, markerState);
  } catch (error) {
    return buildError('M7_FLOW_BATCH_RECOVERY_EVIDENCE_FAIL', 'flow_save_batch_recovery_evidence_fail', {
      message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }

  const tempPaths = entries.map((entry) => entry.tempPath);
  try {
    if (typeof options.afterIntentRecorded === 'function') {
      await options.afterIntentRecorded({ batchId, markerPath, entries });
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      await writeTextFileStrict(entry.tempPath, entry.content);
      if (typeof options.afterTempWrite === 'function') {
        await options.afterTempWrite({ batchId, markerPath, entry, index });
      }
    }

    await updateMarker(markerPath, {
      ...markerState,
      state: 'TEMP_WRITTEN',
    });

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (typeof options.beforeActivate === 'function') {
        await options.beforeActivate({ batchId, markerPath, entry, index });
      }

      if (await exists(entry.path)) {
        await fs.rename(entry.path, entry.backupPath);
        entry.backupActivated = true;
      }
      await fs.rename(entry.tempPath, entry.path);
      entry.targetActivated = true;

      if (typeof options.afterActivate === 'function') {
        await options.afterActivate({ batchId, markerPath, entry, index });
      }
    }

    await updateMarker(markerPath, {
      ...markerState,
      state: 'COMMIT_MARKED',
    });

    await removeBackups(entries);
    await fs.unlink(markerPath).catch(() => {});
    return {
      ok: true,
      value: {
        batchId,
        sceneCount: entries.length,
        markerPath,
      },
    };
  } catch (error) {
    await rollbackActivatedEntries(entries);
    await cleanupFiles(tempPaths);
    const failState = {
      ...markerState,
      state: 'FAILED',
      failReason: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
    await writeJsonAtomic(markerPath, failState).catch(() => {});
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

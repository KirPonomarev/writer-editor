'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { readVerifiedProjectTreeMutation } = require('../core/project-transaction-v1.cjs');
const { validateRequest, validateProjection, readFence, sameFence, createReadOnlyFileAdapter } = require('./projectTreeReadPort.cjs');
const readOnly = createReadOnlyFileAdapter();
(async () => {
  const request = validateRequest(workerData.request);
  const before = await readFence(request.manifestPath);
  if (!sameFence(before, workerData.fence)) throw Object.assign(Error('E_TREE_READ_STALE'), { code: 'E_TREE_READ_STALE' });
  const state = await readVerifiedProjectTreeMutation({ manifestPath: request.manifestPath, projectId: request.projectId, fsAdapter: readOnly });
  const packet = state.retainedPacket, apply = packet?.plan.input.history?.applyPacket || packet;
  const entry = request.sceneId === undefined ? null : apply?.plan.entries?.find(row => row.role === 'scene' && row.relativePath === request.sceneId);
  const seed = request.sceneId === undefined || !Array.isArray(packet?.plan?.scenePartitions) ? null
    : packet.entries.find(row => row.role === 'scene' && row.relativePath === request.sceneId && row.afterBase64 !== null);
  const history = state.lastMutation?.wordReturnHistory;
  const value = validateProjection({ treeRevision: state.treeRevision, lastMutation: state.lastMutation,
    original: entry && history && (history.canUndo || history.canRedo) ? Buffer.from(entry.beforeBase64, 'base64').toString('utf8') : null,
    structuralSeed: seed ? Buffer.from(seed.afterBase64, 'base64').toString('utf8') : null });
  if (!sameFence(before, await readFence(request.manifestPath))) throw Object.assign(Error('E_TREE_READ_STALE'), { code: 'E_TREE_READ_STALE' });
  parentPort.postMessage({ ok: true, fence: before, value });
})().catch(error => parentPort.postMessage({ ok: false, code: error.code || 'E_TREE_READ_WORKER' }));

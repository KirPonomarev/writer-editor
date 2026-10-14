'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const MAX_TEXT_BYTES = 32 * 1024 * 1024;
const WORKER_PATH = path.join(__dirname, 'projectTreeReadWorker.cjs');
function failure(code) { return Object.assign(new Error(code), { code }); }
function validateRequest(input) {
  if (!input || (Object.getPrototypeOf(input) !== null && Object.getPrototypeOf(Object.getPrototypeOf(input)) !== null)) throw failure('E_TREE_READ_INPUT');
  const fields = Object.getOwnPropertyDescriptors(input);
  if (Object.getOwnPropertySymbols(input).length) throw failure('E_TREE_READ_INPUT');
  if (Object.keys(fields).some(k => !['manifestPath','projectId','sceneId'].includes(k) || !Object.hasOwn(fields[k], 'value'))
    || typeof fields.manifestPath?.value !== 'string' || input.manifestPath.length > 4096 || !path.isAbsolute(input.manifestPath)
    || typeof fields.projectId?.value !== 'string' || !input.projectId || input.projectId.length > 1024
    || input.sceneId !== undefined && (typeof input.sceneId !== 'string' || !input.sceneId || input.sceneId.length > 4096
      || path.isAbsolute(input.sceneId) || input.sceneId.split(/[\\/]/u).some(p => !p || p === '..' || p === '.'))) throw failure('E_TREE_READ_INPUT');
  return { manifestPath: input.manifestPath, projectId: input.projectId, ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId }) };
}
async function readFence(manifestPath) {
  const read = async target => {
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_TEXT_BYTES) throw failure('E_TREE_READ_FENCE');
      const bytes = await fs.readFile(target);
      if (bytes.length > MAX_TEXT_BYTES) throw failure('E_TREE_READ_FENCE');
      return crypto.createHash('sha256').update(bytes).digest('hex');
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  return Promise.all([manifestPath, `${manifestPath}.wp201-tree-commit.json`, `${manifestPath}.wp201-transaction.json`].map(read));
}
function createReadOnlyFileAdapter() {
  return new Proxy(fs, { get(target, key) {
    if (['readFile','lstat','stat','realpath','readdir','access','readlink'].includes(key)) return target[key].bind(target);
    throw failure('E_TREE_READ_WRITE_REFUSED');
  } });
}
function sameFence(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function validateProjection(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'lastMutation,original,structuralSeed,treeRevision'
    || !Number.isSafeInteger(value.treeRevision) || value.treeRevision < 0) throw failure('E_TREE_READ_RESULT');
  for (const k of ['original','structuralSeed']) if (value[k] !== null && (typeof value[k] !== 'string' || Buffer.byteLength(value[k]) > MAX_TEXT_BYTES)) throw failure('E_TREE_READ_RESULT');
  const m = value.lastMutation;
  if (m !== null) {
    if (!m || typeof m !== 'object' || Array.isArray(m) || Object.keys(m).some(k => !['id','kind','canUndo','unavailableReason','wordReturnHistory'].includes(k))
      || typeof m.id !== 'string' || !/^[a-f0-9]{64}$/u.test(m.id) || typeof m.kind !== 'string' || m.kind.length > 128
      || typeof m.canUndo !== 'boolean' || m.unavailableReason !== null && (typeof m.unavailableReason !== 'string' || m.unavailableReason.length > 1024)) throw failure('E_TREE_READ_RESULT');
    if (m.wordReturnHistory !== undefined) {
      const h = m.wordReturnHistory;
      if (!h || Object.keys(h).some(k => !['canUndo','canRedo','reason'].includes(k)) || typeof h.canUndo !== 'boolean'
        || typeof h.canRedo !== 'boolean' || h.reason !== undefined && (typeof h.reason !== 'string' || h.reason.length > 1024)) throw failure('E_TREE_READ_RESULT');
      Object.freeze(h);
    }
    Object.freeze(m);
  }
  return Object.freeze(value);
}
function createProjectTreeReadPort({ WorkerClass = Worker, workerPath = WORKER_PATH, timeoutMs = 120000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw failure('E_TREE_READ_DEADLINE');
  // Call-local concurrent reads only; no result survives completion or becomes truth.
  const pending = new Map();
  return async input => {
    const request = validateRequest(input), fence = await readFence(request.manifestPath);
    if (!fence[0]) throw failure('E_TREE_READ_FENCE');
    const key = JSON.stringify([request, fence]);
    if (!pending.has(key)) {
      if (pending.size >= 8) throw failure('E_TREE_READ_BUSY');
      const job = new Promise((resolve, reject) => {
        let worker, timer, settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (worker) { worker.removeAllListeners(); worker.terminate().catch(() => {}); }
          if (error) reject(error); else resolve(value);
        };
        try { worker = new WorkerClass(workerPath, { workerData: { request, fence } }); }
        catch { finish(failure('E_TREE_READ_WORKER_START')); return; }
        timer = setTimeout(() => finish(failure('E_TREE_READ_TIMEOUT')), timeoutMs);
        worker.once('message', message => {
          try {
            if (!message || typeof message.ok !== 'boolean' || Object.keys(message).sort().join(',') !== (message.ok ? 'fence,ok,value' : 'code,ok')) throw failure('E_TREE_READ_RESULT');
            if (!message.ok) throw failure(typeof message.code === 'string' && /^[A-Z0-9_]{1,128}$/u.test(message.code) ? message.code : 'E_TREE_READ_WORKER');
            if (!sameFence(message.fence, fence)) throw failure('E_TREE_READ_STALE');
            finish(null, validateProjection(message.value));
          } catch (error) { finish(error); }
        });
        worker.once('error', () => finish(failure('E_TREE_READ_WORKER')));
        worker.once('exit', () => finish(failure('E_TREE_READ_WORKER_EXIT')));
      });
      pending.set(key, job);
      job.finally(() => { if (pending.get(key) === job) pending.delete(key); }).catch(() => {});
    }
    const value = await pending.get(key);
    if (!sameFence(fence, await readFence(request.manifestPath))) throw failure('E_TREE_READ_STALE');
    return value;
  };
}
const readVerifiedProjectTreeProjection = createProjectTreeReadPort();
module.exports = { readVerifiedProjectTreeProjection, createProjectTreeReadPort, validateRequest, validateProjection, readFence, sameFence, createReadOnlyFileAdapter };

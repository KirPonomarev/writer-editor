'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { Worker } = require('node:worker_threads');
const { EventEmitter } = require('node:events');
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
  // Failure does not retire the other reads that already own file buffers.
  const settled = await Promise.allSettled([manifestPath, `${manifestPath}.wp201-tree-commit.json`, `${manifestPath}.wp201-transaction.json`, path.join(path.dirname(manifestPath), '.yalken-location.v1.json')].map(read));
  const failed = settled.find(row => row.status === 'rejected');
  if (failed) throw failed.reason;
  return settled.map(row => row.value);
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
function createUtilityProcessReaderClass(utilityProcess) {
  return class UtilityProcessReader extends EventEmitter {
    constructor(modulePath, { workerData }) {
      super();
      this.spawned = false; this.exited = false; this.stopping = false; this.stopCalled = false; this.exitCode = null;
      this.stopped = new Promise((resolve, reject) => { this.resolveStopped = resolve; this.rejectStopped = reject; });
      this.child = utilityProcess.fork(modulePath, [], { serviceName: 'Yalken project tree reader' });
      this.child.once('spawn', () => {
        this.spawned = true;
        if (this.stopping) { this.stop(); return; }
        try { this.child.postMessage(workerData); }
        catch { this.emit('error', failure('E_TREE_READ_WORKER_START')); }
      });
      this.child.on('message', value => { if (!this.exited && !this.stopping) this.emit('message', value); });
      // Retirement already has its terminal outcome; a late fatal notification
      // must not become an unhandled second error in Main. Exit still owns stop.
      this.child.once('error', () => { if (!this.exited && !this.stopping) this.emit('error', failure('E_TREE_READ_WORKER')); });
      this.child.once('exit', code => {
        this.exited = true; this.exitCode = code; this.resolveStopped(code); this.emit('exit', code);
      });
    }
    stop() {
      if (this.exited || this.stopCalled) return;
      this.stopCalled = true;
      try { if (!this.child.kill()) this.rejectStopped(failure('E_TREE_READ_WORKER')); }
      catch { this.rejectStopped(failure('E_TREE_READ_WORKER')); }
    }
    terminate() {
      if (this.exited) return Promise.resolve(this.exitCode);
      this.stopping = true;
      if (this.spawned) this.stop();
      return this.stopped;
    }
  };
}
function runtimeReaderClass() {
  // Electron Main must not share its process with the heavy reader. Missing
  // process support fails at construction, never falls back to a Node Worker.
  return process.versions.electron && process.type === 'browser'
    ? createUtilityProcessReaderClass(require('electron').utilityProcess) : Worker;
}
function createProjectTreeReadPort({ WorkerClass = runtimeReaderClass(), workerPath = WORKER_PATH, timeoutMs = 120000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw failure('E_TREE_READ_DEADLINE');
  // Identical pending descriptors share one freshly checked snapshot, never a cache.
  // Admission covers fence I/O as well as the working AND stopping Worker.
  const pending = new Map(), queue = [];
  let active = null, unavailable = false;
  const settle = (job, error, value) => {
    if (job.settled) return;
    job.settled = true; clearTimeout(job.timer);
    if (pending.get(job.key) === job) pending.delete(job.key);
    if (error) job.reject(error); else job.resolve(value);
  };
  const checkDeadline = job => {
    if (job.settled || performance.now() >= job.deadline) throw failure('E_TREE_READ_TIMEOUT');
  };
  const runWorker = (job, fence) => new Promise((resolve, reject) => {
    let worker, finishing = false, exited = false;
    const finish = (error, value) => {
      if (finishing) return;
      finishing = true; job.cancel = null;
      const complete = () => {
        if (worker) worker.removeAllListeners();
        if (error) reject(error); else resolve(value);
      };
      const stopFailed = () => {
        if (exited) { complete(); return; }
        // An unconfirmed stop cannot free the resource for another heavy read.
        unavailable = true;
        for (const waiting of queue.splice(0)) settle(waiting, failure('E_TREE_READ_WORKER'));
        reject(failure('E_TREE_READ_WORKER'));
      };
      if (!worker) { complete(); return; }
      try { Promise.resolve(worker.terminate()).then(complete, stopFailed); }
      catch { stopFailed(); }
    };
    try { worker = new WorkerClass(workerPath, { workerData: { request: job.request, fence } }); }
    catch { finish(failure('E_TREE_READ_WORKER_START')); return; }
    job.cancel = error => finish(error);
    worker.once('message', message => {
      try {
        if (!message || typeof message.ok !== 'boolean' || Object.keys(message).sort().join(',') !== (message.ok ? 'fence,ok,value' : 'code,ok')) throw failure('E_TREE_READ_RESULT');
        if (!message.ok) throw failure(typeof message.code === 'string' && /^[A-Z0-9_]{1,128}$/u.test(message.code) ? message.code : 'E_TREE_READ_WORKER');
        if (!sameFence(message.fence, fence)) throw failure('E_TREE_READ_STALE');
        finish(null, validateProjection(message.value));
      } catch (error) { finish(error); }
    });
    worker.once('error', () => finish(failure('E_TREE_READ_WORKER')));
    worker.once('exit', () => { exited = true; finish(failure('E_TREE_READ_WORKER_EXIT')); });
  });
  const pump = () => {
    if (active || unavailable || !queue.length) return;
    const job = active = queue.shift();
    (async () => {
      try {
        checkDeadline(job);
        const fence = await readFence(job.request.manifestPath);
        checkDeadline(job);
        if (!fence[0]) throw failure('E_TREE_READ_FENCE');
        const value = await runWorker(job, fence);
        checkDeadline(job);
        if (!sameFence(fence, await readFence(job.request.manifestPath))) throw failure('E_TREE_READ_STALE');
        checkDeadline(job);
        settle(job, null, value);
      } catch (error) { settle(job, error); }
      finally { active = null; pump(); }
    })();
  };
  return async input => {
    const request = validateRequest(input), key = JSON.stringify(request);
    if (unavailable) throw failure('E_TREE_READ_WORKER');
    let job = pending.get(key);
    if (!job) {
      if (queue.length + Number(active !== null) >= 8) throw failure('E_TREE_READ_BUSY');
      job = { request, key, deadline: performance.now() + timeoutMs, settled: false, cancel: null };
      job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
      pending.set(key, job); queue.push(job);
      job.timer = setTimeout(() => {
        const error = failure('E_TREE_READ_TIMEOUT');
        settle(job, error);
        if (job.cancel) job.cancel(error);
        const index = queue.indexOf(job);
        if (index !== -1) queue.splice(index, 1);
      }, timeoutMs);
      pump();
    }
    return job.promise;
  };
}
const readVerifiedProjectTreeProjection = createProjectTreeReadPort();
module.exports = { readVerifiedProjectTreeProjection, createProjectTreeReadPort, createUtilityProcessReaderClass, validateRequest, validateProjection, readFence, sameFence, createReadOnlyFileAdapter };

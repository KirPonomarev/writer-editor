'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const { EventEmitter } = require('node:events');
const MAX_BYTES = 64 * 1024 * 1024;
const OPERATIONS = new Set(['local-preview', 'import-plan', 'project-summary']);
const fail = code => Object.assign(Error(code), { code });
const digest = text => crypto.createHash('sha256').update(text).digest('hex');

function runtimeWorker() {
  if (!(process.versions.electron && process.type === 'browser')) return Worker;
  return class extends EventEmitter {
    constructor(entry, { workerData }) {
      super(); this.stopping = false; this.exited = false; this.spawned = false;
      this.stopped = new Promise((resolve, reject) => { this.resolveStop = resolve; this.rejectStop = reject; });
      this.child = require('electron').utilityProcess.fork(entry, [], { serviceName: 'Yalken DOCX preparation' });
      this.child.once('spawn', () => {
        this.spawned = true;
        if (this.stopping) { this.stop(); return; }
        try { this.child.postMessage(workerData); } catch { this.emit('error', fail('DOCX_IMPORT_COMPUTE_START')); }
      });
      this.child.on('message', message => { if (!this.stopping && !this.exited) this.emit('message', message); });
      this.child.on('error', () => { if (!this.stopping && !this.exited) this.emit('error', fail('DOCX_IMPORT_COMPUTE_FAILED')); });
      this.child.once('exit', code => { this.exited = true; this.resolveStop(code); this.emit('exit', code); });
    }
    stop() {
      if (this.exited || this.killCalled) return;
      this.killCalled = true;
      try { if (!this.child.kill()) this.rejectStop(fail('DOCX_IMPORT_COMPUTE_STOP')); }
      catch { this.rejectStop(fail('DOCX_IMPORT_COMPUTE_STOP')); }
    }
    terminate() { this.stopping = true; if (this.spawned) this.stop(); return this.stopped; }
  };
}

// Pure computation only. Admission covers the whole worker lifecycle, including
// confirmed retirement; a failed stop must never permit a second heavy worker.
function createDocxImportComputePort({ WorkerClass = runtimeWorker(), timeoutMs = 120000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw fail('DOCX_IMPORT_COMPUTE_DEADLINE');
  let active = false, unavailable = false;
  return async (operation, input, { signal } = {}) => {
    if (unavailable) throw fail('DOCX_IMPORT_COMPUTE_STOP');
    if (active) throw fail('DOCX_IMPORT_COMPUTE_BUSY');
    if (!OPERATIONS.has(operation)) throw fail('DOCX_IMPORT_COMPUTE_INPUT');
    if (signal?.aborted) throw fail('DOCX_IMPORT_COMPUTE_CANCELLED');
    const inputJson = JSON.stringify(input);
    if (typeof inputJson !== 'string' || Buffer.byteLength(inputJson) > MAX_BYTES) throw fail('DOCX_IMPORT_COMPUTE_INPUT');
    const nonce = crypto.randomBytes(32).toString('hex'), inputDigest = digest(inputJson);
    active = true;
    try {
      return await new Promise((resolve, reject) => {
        let worker, finishing = false, timer;
        const abort = () => finish(fail('DOCX_IMPORT_COMPUTE_CANCELLED'));
        const finish = (error, value) => {
          if (finishing) return;
          finishing = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
          let stopTimer;
          const stopFailed = () => { clearTimeout(stopTimer); unavailable = true; reject(fail('DOCX_IMPORT_COMPUTE_STOP')); };
          const complete = () => {
            clearTimeout(stopTimer);
            worker?.removeAllListeners(); worker?.on('error', () => {});
            if (!error && signal?.aborted) error = fail('DOCX_IMPORT_COMPUTE_CANCELLED');
            if (error) reject(error); else resolve(value);
          };
          if (!worker) { complete(); return; }
          stopTimer = setTimeout(stopFailed, 1000);
          try { Promise.resolve(worker.terminate()).then(complete, stopFailed); }
          catch { stopFailed(); }
        };
        try {
          worker = new WorkerClass(path.join(__dirname, 'docxImportComputeWorker.cjs'), {
            workerData: { operation, nonce, inputDigest, inputJson },
          });
        } catch { finish(fail('DOCX_IMPORT_COMPUTE_START')); return; }
        worker.once('message', message => {
          if (finishing) return;
          try {
            if (!message || Object.keys(message).sort().join(',') !== 'inputDigest,nonce,operation,resultJson'
              || message.operation !== operation || message.nonce !== nonce || message.inputDigest !== inputDigest
              || typeof message.resultJson !== 'string' || Buffer.byteLength(message.resultJson) > MAX_BYTES) throw fail('DOCX_IMPORT_COMPUTE_RESULT');
            const result = JSON.parse(message.resultJson);
            if (!result || typeof result.ok !== 'boolean' || Object.keys(result).sort().join(',') !== (result.ok ? 'ok,value' : 'code,ok')) throw fail('DOCX_IMPORT_COMPUTE_RESULT');
            if (!result.ok) throw fail(typeof result.code === 'string' && /^[A-Z][A-Z0-9_]{1,95}$/u.test(result.code) ? result.code : 'DOCX_IMPORT_COMPUTE_FAILED');
            if (signal?.aborted) throw fail('DOCX_IMPORT_COMPUTE_CANCELLED');
            finish(null, result.value);
          } catch (error) { finish(error); }
        });
        worker.once('error', () => finish(fail('DOCX_IMPORT_COMPUTE_FAILED')));
        worker.once('exit', () => finish(fail('DOCX_IMPORT_COMPUTE_EXIT')));
        signal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => finish(fail('DOCX_IMPORT_COMPUTE_TIMEOUT')), timeoutMs);
        if (signal?.aborted) abort();
      });
    } finally { active = false; }
  };
}
const runDocxImportComputation = createDocxImportComputePort();
module.exports = { createDocxImportComputePort, runDocxImportComputation };

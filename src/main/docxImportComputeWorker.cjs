'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 64 * 1024 * 1024;
const fail = code => Object.assign(Error(code), { code });

async function run(message) {
  if (!message || Object.keys(message).sort().join(',') !== 'inputDigest,inputJson,nonce,operation'
    || !['local-preview','import-plan','project-summary'].includes(message.operation)
    || !/^[a-f0-9]{64}$/u.test(message.nonce) || !/^[a-f0-9]{64}$/u.test(message.inputDigest)
    || typeof message.inputJson !== 'string' || Buffer.byteLength(message.inputJson) > MAX_BYTES
    || crypto.createHash('sha256').update(message.inputJson).digest('hex') !== message.inputDigest) throw fail('DOCX_IMPORT_COMPUTE_INPUT');
  const input = JSON.parse(message.inputJson);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('DOCX_IMPORT_COMPUTE_INPUT');
  const keys = Object.keys(input).sort().join(',');
  if (message.operation === 'local-preview') {
    if (keys !== 'bytesBase64,requestId' || typeof input.bytesBase64 !== 'string'
      || input.bytesBase64.length > Math.ceil(16*1024*1024/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(input.bytesBase64)
      || typeof input.requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/u.test(input.requestId)) throw fail('DOCX_IMPORT_COMPUTE_INPUT');
    return require('../utils/docxImportLocalFilePreview.js').createDocxImportLocalFilePreview({ requestId: input.requestId }, {
      pickLocalFile: async () => ({ fileName: 'selected.docx' }),
      readLocalFileBytes: async () => Buffer.from(input.bytesBase64, 'base64'),
      novelImport: true, oneWayManuscript: true,
      contentPreviewBudgets: { maxBlocks: 50000, maxWorkerOutputBytes: MAX_BYTES },
    });
  }
  if (message.operation === 'import-plan') {
    if (keys !== 'contentPreviewReport') throw fail('DOCX_IMPORT_COMPUTE_INPUT');
    const bridge = await import(pathToFileURL(path.join(__dirname, '../io/revisionBridge/index.mjs')).href);
    return bridge.buildDocxNovelImportPreviewPlanFromContentPreview(input.contentPreviewReport);
  }
  if (keys !== 'identity,plan') throw fail('DOCX_IMPORT_COMPUTE_INPUT');
  const { prepareDocxNewProject } = await import(pathToFileURL(path.join(__dirname, '../core/docx-new-project-v1.mjs')).href);
  return prepareDocxNewProject({ plan: input.plan, ...input.identity }).summary;
}

function execute(message, channel) {
  (async () => {
    let result;
    try { result = { ok: true, value: await run(message) }; }
    catch (error) { result = { ok: false, code: /^[A-Z][A-Z0-9_]{1,95}$/u.test(error?.code || '') ? error.code : 'DOCX_IMPORT_COMPUTE_FAILED' }; }
    let resultJson = JSON.stringify(result);
    if (Buffer.byteLength(resultJson) > MAX_BYTES) resultJson = JSON.stringify({ ok: false, code: 'DOCX_IMPORT_COMPUTE_OUTPUT_BUDGET' });
    channel.postMessage({ operation: message?.operation, nonce: message?.nonce, inputDigest: message?.inputDigest, resultJson });
  })().catch(() => process.exitCode = 1);
}
if (parentPort) execute(workerData, parentPort);
else if (process.parentPort) process.parentPort.once('message', event => execute(event.data, process.parentPort));
else throw fail('DOCX_IMPORT_COMPUTE_START');

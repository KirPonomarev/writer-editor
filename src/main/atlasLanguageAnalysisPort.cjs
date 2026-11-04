'use strict';

const fs = require('node:fs/promises');
const constants = require('node:fs').constants;
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { TextDecoder } = require('node:util');

const SCHEMA = 'derived.atlas.localLanguageAnalysis.v1';
const MAX_OUTPUT = 4 * 1024 * 1024;
const MAX_RSS = 1024 * 1024 * 1024;
const INPUT_KEYS = ['projectId', 'sceneId', 'sourceRevision', 'sourceTextHash', 'generation', 'languageCode', 'text'];
const IDENTITY_KEYS = INPUT_KEYS.filter(key => key !== 'text');
const ADVANCED = ['constrainedCoreference', 'dialogue', 'eventExtraction', 'roles', 'relationProposals'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => Object.assign(new Error(code), { code });
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => plain(value) && Object.keys(value).length === expected.length
  && Object.keys(value).every(key => expected.includes(key));
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

function validUnicode(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function validateAtlasLanguageAnalysisInput(input) {
  if (!keys(input, INPUT_KEYS)) throw fail('E_ATLAS_LANGUAGE_INPUT_INVALID');
  for (const key of ['projectId', 'sceneId', 'generation']) {
    if (typeof input[key] !== 'string' || !input[key] || input[key] !== input[key].trim()
      || input[key].length > 1000 || /[\u0000-\u001f]/u.test(input[key]) || !validUnicode(input[key])) throw fail('E_ATLAS_LANGUAGE_INPUT_INVALID');
  }
  if (typeof input.sourceRevision !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(input.sourceRevision)
    || !digest(input.sourceTextHash) || typeof input.text !== 'string' || !input.text.length
    || input.text.length > 20000 || !validUnicode(input.text) || hash(input.text) !== input.sourceTextHash) throw fail('E_ATLAS_LANGUAGE_SOURCE_INVALID');
  if (!['ru', 'en'].includes(input.languageCode)) throw fail('E_ATLAS_LANGUAGE_UNSUPPORTED');
  return { ...input };
}

function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024
    && value === value.normalize('NFC') && !/[\\\u0000-\u001f]/u.test(value)
    && !value.startsWith('/') && path.posix.normalize(value) === value
    && value.split('/').every(part => part && part !== '.' && part !== '..' && part === part.trim());
}

async function readRegular(file, limit, expectedMode = null) {
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.size > limit || (expectedMode !== null && (before.mode & 0o777) !== expectedMode)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_INVALID');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.length !== before.size || before.dev !== after.dev || before.ino !== after.ino
      || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw fail('E_ATLAS_LANGUAGE_RESOURCE_CHANGED');
    return bytes;
  } finally { await handle?.close(); }
}

async function verifyAtlasLanguageResourceCatalog({ resourceRoot, expectedCatalogSha256, expectedWorkerSha256 }) {
  try {
    if (typeof resourceRoot !== 'string' || !path.isAbsolute(resourceRoot)
      || !digest(expectedCatalogSha256) || !digest(expectedWorkerSha256)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_CONFIGURATION');
    const root = path.resolve(resourceRoot), stat = await fs.lstat(root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(root) !== root) throw fail('E_ATLAS_LANGUAGE_RESOURCE_ROOT');
    const raw = await readRegular(path.join(root, 'catalog.json'), 2 * 1024 * 1024);
    if (hash(raw) !== expectedCatalogSha256) throw fail('E_ATLAS_LANGUAGE_RESOURCE_CATALOG_HASH');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(raw), catalog = JSON.parse(text);
    if (JSON.stringify(catalog, null, 2) + '\n' !== text
      || !keys(catalog, ['schemaVersion', 'platform', 'arch', 'pythonVersion', 'engineVersion', 'modelVersions', 'entries'])
      || catalog.schemaVersion !== 'atlas.languageResourceCatalog.v1' || catalog.platform !== 'darwin' || catalog.arch !== 'arm64'
      || catalog.pythonVersion !== '3.14.10' || catalog.engineVersion !== '3.8.18'
      || !keys(catalog.modelVersions, ['en', 'ru']) || catalog.modelVersions.en !== '3.8.0' || catalog.modelVersions.ru !== '3.8.0'
      || !Array.isArray(catalog.entries) || !catalog.entries.length || catalog.entries.length > 10000) throw fail('E_ATLAS_LANGUAGE_RESOURCE_CATALOG_INVALID');
    const entries = new Map(), folded = new Set(), parents = new Set(); let total = 0;
    for (const row of catalog.entries) {
      if (!plain(row) || !safeRelative(row.path) || entries.has(row.path) || folded.has(row.path.toLowerCase())
        || ['catalog.json', 'worker.py'].includes(row.path)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_PATH');
      if (row.kind === 'file') {
        if (!keys(row, ['path', 'kind', 'byteLength', 'sha256', 'mode']) || !digest(row.sha256)
          || !Number.isSafeInteger(row.byteLength) || row.byteLength < 0 || row.byteLength > 64 * 1024 * 1024
          || !Number.isInteger(row.mode) || ![0o444, 0o555].includes(row.mode)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_ENTRY');
        total += row.byteLength;
      } else if (row.kind === 'symlink') {
        if (!keys(row, ['path', 'kind', 'target']) || typeof row.target !== 'string' || !safeRelative(row.target)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_LINK');
      } else throw fail('E_ATLAS_LANGUAGE_RESOURCE_ENTRY');
      entries.set(row.path, row); folded.add(row.path.toLowerCase());
      let parent = path.posix.dirname(row.path);
      while (parent !== '.') { parents.add(parent); parent = path.posix.dirname(parent); }
    }
    if (total > 512 * 1024 * 1024 || !entries.has('python/bin/python3.14')) throw fail('E_ATLAS_LANGUAGE_RESOURCE_BUDGET');
    for (const parent of parents) if (entries.has(parent)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_PATH');
    const seen = new Set();
    async function walk(relative = '') {
      for (const dirent of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
        const name = relative ? relative + '/' + dirent.name : dirent.name;
        if (!safeRelative(name) || seen.has(name)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_PATH');
        seen.add(name);
        if (dirent.isDirectory()) {
          if (!parents.has(name)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_UNLISTED');
          await walk(name);
        } else if (!entries.has(name) && name !== 'catalog.json' && name !== 'worker.py') throw fail('E_ATLAS_LANGUAGE_RESOURCE_UNLISTED');
      }
    }
    await walk();
    for (const [relative, row] of entries) {
      if (!seen.has(relative)) throw fail('E_ATLAS_LANGUAGE_RESOURCE_MISSING');
      const file = path.join(root, relative), item = await fs.lstat(file);
      if (row.kind === 'file') {
        if (!item.isFile() || item.isSymbolicLink()) throw fail('E_ATLAS_LANGUAGE_RESOURCE_TYPE');
        const bytes = await readRegular(file, row.byteLength, row.mode);
        if (bytes.length !== row.byteLength || hash(bytes) !== row.sha256) throw fail('E_ATLAS_LANGUAGE_RESOURCE_BYTES');
      } else {
        if (!item.isSymbolicLink() || await fs.readlink(file) !== row.target) throw fail('E_ATLAS_LANGUAGE_RESOURCE_LINK');
        const resolved = await fs.realpath(file);
        if (!resolved.startsWith(root + path.sep) || !entries.has(path.relative(root, resolved).split(path.sep).join('/'))) throw fail('E_ATLAS_LANGUAGE_RESOURCE_LINK_ESCAPE');
      }
    }
    if (hash(await readRegular(path.join(root, 'worker.py'), 65536, 0o444)) !== expectedWorkerSha256) throw fail('E_ATLAS_LANGUAGE_RESOURCE_WORKER');
    return { root, catalogSha256: expectedCatalogSha256, python: path.join(root, 'python/bin/python3.14'), worker: path.join(root, 'worker.py') };
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('E_ATLAS_LANGUAGE_RESOURCE')) throw error;
    throw fail('E_ATLAS_LANGUAGE_RESOURCE_UNAVAILABLE');
  }
}

function sandboxProfile(root, python) {
  const literal = value => JSON.stringify(value);
  return '(version 1)(allow default)(deny network*)(deny file-write*)(deny file-read*)'
    // dyld ignition reads the root directory on current macOS. This literal
    // permits directory enumeration only; it grants no descendant file read.
    + '(allow file-read-metadata)(allow file-read* (literal "/") '
    + [root, '/System', '/usr/lib', '/usr/share', '/Library/Apple/System', '/private/var/db/dyld', '/private/var/db/timezone'].map(value => `(subpath ${literal(value)})`).join(' ')
    + ' (literal "/dev/null")(literal "/dev/urandom")(literal "/dev/random")(literal "/private/etc/localtime"))'
    + `(deny process-fork)(deny process-exec)(allow process-exec (literal ${literal(python)}))`;
}

function validateResult(raw, packet) {
  let value;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(raw).trim(); value = JSON.parse(text);
    if (JSON.stringify(value) !== text) throw fail('E_ATLAS_LANGUAGE_RESULT_INVALID');
  } catch { throw fail('E_ATLAS_LANGUAGE_RESULT_INVALID'); }
  if (!keys(value, ['protocolVersion', 'nonce', 'resourceCatalogSha256', 'identity', 'tokens', 'entities', 'elapsedMs', 'maxRssBytes'])
    || value.protocolVersion !== 1 || value.nonce !== packet.nonce || value.resourceCatalogSha256 !== packet.resourceCatalogSha256
    || !keys(value.identity, IDENTITY_KEYS) || IDENTITY_KEYS.some(key => value.identity[key] !== packet[key])
    || !Array.isArray(value.tokens) || value.tokens.length > 16384 || !Array.isArray(value.entities) || value.entities.length > 4096
    || !Number.isSafeInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > 15000
    || !Number.isSafeInteger(value.maxRssBytes) || value.maxRssBytes < 1 || value.maxRssBytes > MAX_RSS) throw fail('E_ATLAS_LANGUAGE_RESULT_INVALID');
  const boundary = offset => offset === 0 || offset === packet.text.length
    || !(packet.text.charCodeAt(offset) >= 0xdc00 && packet.text.charCodeAt(offset) <= 0xdfff);
  function span(row, previous) {
    if (!Number.isSafeInteger(row.utf16Start) || !Number.isSafeInteger(row.utf16End)
      || row.utf16Start < previous || row.utf16End <= row.utf16Start || row.utf16End > packet.text.length
      || !boundary(row.utf16Start) || !boundary(row.utf16End) || typeof row.text !== 'string'
      || packet.text.slice(row.utf16Start, row.utf16End) !== row.text) throw fail('E_ATLAS_LANGUAGE_RESULT_COORDINATES');
    return row.utf16End;
  }
  let end = 0;
  for (const token of value.tokens) {
    if (!keys(token, ['text', 'lemma', 'pos', 'morph', 'dependency', 'headIndex', 'utf16Start', 'utf16End'])
      || typeof token.lemma !== 'string' || token.lemma.length > 20000 || !validUnicode(token.lemma)
      || typeof token.pos !== 'string' || !/^[A-Z_]{0,32}$/u.test(token.pos)
      || typeof token.morph !== 'string' || token.morph.length > 1000 || typeof token.dependency !== 'string' || token.dependency.length > 100
      || !Number.isSafeInteger(token.headIndex) || token.headIndex < 0 || token.headIndex >= value.tokens.length) throw fail('E_ATLAS_LANGUAGE_RESULT_TOKEN');
    end = span(token, end);
  }
  end = 0;
  for (const entity of value.entities) {
    if (!keys(entity, ['text', 'label', 'utf16Start', 'utf16End']) || typeof entity.label !== 'string'
      || !/^[A-Z_]{1,40}$/u.test(entity.label)) throw fail('E_ATLAS_LANGUAGE_RESULT_ENTITY');
    end = span(entity, end);
  }
  const projection = { schemaVersion: SCHEMA, state: 'experimental', ...value.identity,
    experimental: true, certified: false, releaseTrust: false, resourceCatalogSha256: packet.resourceCatalogSha256,
    tokens: value.tokens, entities: value.entities, unavailableSignals: [...ADVANCED],
    metrics: { elapsedMs: value.elapsedMs, maxRssBytes: value.maxRssBytes } };
  for (const row of [...projection.tokens, ...projection.entities]) Object.freeze(row);
  for (const value of [projection.tokens, projection.entities, projection.unavailableSignals, projection.metrics]) Object.freeze(value);
  return Object.freeze(projection);
}

function createAtlasLanguageAnalysisPort({ resourceRoot, expectedCatalogSha256, expectedWorkerSha256,
  platform = process.platform, arch = process.arch, spawnProcess = spawn, timeoutMs = 15000, retirementMs = 1000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000
    || !Number.isInteger(retirementMs) || retirementMs < 1 || retirementMs > 1000) throw fail('E_ATLAS_LANGUAGE_CONFIGURATION');
  let active = false, poisoned = false, closed = false, cancelActive = null, pending = null;
  async function analyze(source, { signal, assertCurrent = () => {} } = {}) {
    if (poisoned) throw fail('E_ATLAS_LANGUAGE_RETIREMENT_FAILED');
    if (closed) throw fail('E_ATLAS_LANGUAGE_CLOSED');
    if (active) throw fail('E_ATLAS_LANGUAGE_BUSY');
    const input = validateAtlasLanguageAnalysisInput(source);
    if (platform !== 'darwin' || arch !== 'arm64') throw fail('E_ATLAS_LANGUAGE_PLATFORM_UNAVAILABLE');
    if (signal?.aborted) throw fail('E_ATLAS_LANGUAGE_CANCELLED');
    active = true;
    try {
      await assertCurrent();
      const resources = await verifyAtlasLanguageResourceCatalog({ resourceRoot, expectedCatalogSha256, expectedWorkerSha256 });
      await assertCurrent();
      if (signal?.aborted || closed) throw fail('E_ATLAS_LANGUAGE_CANCELLED');
      const packet = { ...input, nonce: crypto.randomBytes(16).toString('hex'), resourceCatalogSha256: resources.catalogSha256 };
      const raw = await new Promise((resolve, reject) => {
        let child, timer, retirement, finalRetirement, finished = false, exitObserved = false, requestedError = null, size = 0;
        const chunks = [];
        function complete(error, output) {
          if (finished) return; finished = true;
          clearTimeout(timer); clearTimeout(retirement); clearTimeout(finalRetirement);
          signal?.removeEventListener('abort', abort); cancelActive = null;
          if (error) reject(error); else resolve(output);
        }
        function stop(error) {
          if (finished || requestedError) return; requestedError = error;
          clearTimeout(timer);
          try { child?.kill('SIGTERM'); } catch { /* Confirmed exit, not kill's return, controls admission. */ }
          retirement = setTimeout(() => {
            if (exitObserved) return;
            try { child?.kill('SIGKILL'); } catch { /* Still require observed close. */ }
            finalRetirement = setTimeout(() => {
              if (!exitObserved) { poisoned = true; complete(fail('E_ATLAS_LANGUAGE_RETIREMENT_FAILED')); }
            }, retirementMs);
          }, retirementMs);
        }
        const abort = () => stop(fail('E_ATLAS_LANGUAGE_CANCELLED'));
        const env = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C.UTF-8',
          OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', VECLIB_MAXIMUM_THREADS: '1', MKL_NUM_THREADS: '1', NUMEXPR_NUM_THREADS: '1' };
        try {
          child = spawnProcess('/usr/bin/sandbox-exec', ['-p', sandboxProfile(resources.root, resources.python),
            resources.python, '-I', '-S', '-B', '-X', 'utf8', resources.worker],
          { cwd: resources.root, env, shell: false, detached: false, stdio: ['pipe', 'pipe', 'pipe'] });
        } catch { complete(fail('E_ATLAS_LANGUAGE_WORKER_START')); return; }
        cancelActive = abort;
        child.stdout.on('data', chunk => {
          if (finished || requestedError) return;
          size += chunk.length;
          if (size > MAX_OUTPUT) stop(fail('E_ATLAS_LANGUAGE_OUTPUT_BUDGET')); else chunks.push(Buffer.from(chunk));
        });
        let stderrBytes = 0;
        child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (stderrBytes > 8192) stop(fail('E_ATLAS_LANGUAGE_OUTPUT_BUDGET')); });
        child.once('error', () => {
          // Failed spawn has no running child to retire; other errors still need close.
          if (!child.pid) complete(fail('E_ATLAS_LANGUAGE_WORKER_START'));
          else stop(fail('E_ATLAS_LANGUAGE_WORKER_FAILED'));
        });
        child.once('close', (code, exitSignal) => {
          exitObserved = true;
          if (requestedError) complete(requestedError);
          else if (code !== 0 || exitSignal) complete(fail('E_ATLAS_LANGUAGE_WORKER_FAILED'));
          else complete(null, Buffer.concat(chunks));
        });
        child.stdin.on('error', () => stop(fail('E_ATLAS_LANGUAGE_WORKER_INPUT')));
        signal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => stop(fail('E_ATLAS_LANGUAGE_TIMEOUT')), timeoutMs);
        if (signal?.aborted || closed) abort();
        else child.stdin.end(JSON.stringify(packet));
      });
      await assertCurrent();
      if (signal?.aborted || closed) throw fail('E_ATLAS_LANGUAGE_CANCELLED');
      return validateResult(raw, packet);
    } finally { active = false; }
  }
  return {
    analyze(input, options) {
      const alreadyActive = active, job = analyze(input, options);
      if (!alreadyActive && active) pending = job;
      return job;
    },
    async close() {
      closed = true; cancelActive?.();
      try { await pending; } catch (error) { if (error.code === 'E_ATLAS_LANGUAGE_RETIREMENT_FAILED') throw error; }
      if (poisoned) throw fail('E_ATLAS_LANGUAGE_RETIREMENT_FAILED');
    },
  };
}

module.exports = { createAtlasLanguageAnalysisPort, verifyAtlasLanguageResourceCatalog, validateAtlasLanguageAnalysisInput };

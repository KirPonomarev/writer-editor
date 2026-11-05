'use strict';
// Build-time only: four original archives and one fixed native-notice archive.
const fs = require('node:fs/promises');
const constants = require('node:fs').constants;
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { TextDecoder } = require('node:util');
const tar = require('tar');
const manifest = require('../src/main/atlasLanguageResourcesV1.json');
const { verifyAtlasLanguageResourceCatalog } = require('../src/main/atlasLanguageAnalysisPort.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const error = code => new Error('E_ATLAS_RESOURCE_' + code);
const safe = value => typeof value === 'string' && value.length > 0 && value.length <= 1024
  && value === value.normalize('NFC') && !/[\\\u0000-\u001f]/u.test(value) && !value.startsWith('/')
  && path.posix.normalize(value) === value && value.split('/').every(part => part && part !== '.' && part !== '..' && part === part.trim());
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0;
}

function readZip(bytes) {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > 96 * 1024 * 1024) throw error('ZIP_BUDGET');
    const end = bytes.length - 22;
    if (bytes.readUInt32LE(end) !== 0x06054b50 || bytes.readUInt16LE(end + 20) !== 0
      || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0
      || bytes.readUInt16LE(end + 8) !== bytes.readUInt16LE(end + 10)) throw error('ZIP_END');
    const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralStart = bytes.readUInt32LE(end + 16);
    if (!count || count > 10000 || centralStart + centralSize !== end) throw error('ZIP_DIRECTORY');
    const result = [], names = new Set(), ranges = []; let offset = centralStart, total = 0;
    const text = raw => new TextDecoder('utf-8', { fatal: true }).decode(raw);
    for (let index = 0; index < count; index++) {
      if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw error('ZIP_DIRECTORY');
      const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), crc = bytes.readUInt32LE(offset + 16);
      const compressed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24), length = bytes.readUInt16LE(offset + 28);
      const next = offset + 46 + length + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
      const local = bytes.readUInt32LE(offset + 42), mode = bytes.readUInt32LE(offset + 38) >>> 16;
      if (next > end || flags & ~0x808 || ![0, 8].includes(method) || size > 64 * 1024 * 1024
        || bytes.readUInt16LE(offset + 34) !== 0 || local + 30 > centralStart) throw error('ZIP_ENTRY');
      const name = text(bytes.subarray(offset + 46, offset + 46 + length)), directory = name.endsWith('/');
      const relative = directory ? name.slice(0, -1) : name;
      if (!safe(relative) || names.has(relative.toLowerCase()) || ![0, 0o100000, 0o040000].includes(mode & 0o170000)) throw error('ZIP_PATH');
      names.add(relative.toLowerCase()); total += size;
      if (total > 320 * 1024 * 1024 || bytes.readUInt32LE(local) !== 0x04034b50
        || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method
        || bytes.readUInt16LE(local + 26) !== length) throw error('ZIP_LOCAL');
      const data = local + 30 + length + bytes.readUInt16LE(local + 28);
      if (data + compressed > centralStart || text(bytes.subarray(local + 30, local + 30 + length)) !== name) throw error('ZIP_LOCAL');
      if (!(flags & 8) && (bytes.readUInt32LE(local + 14) !== crc
        || bytes.readUInt32LE(local + 18) !== compressed || bytes.readUInt32LE(local + 22) !== size)) throw error('ZIP_LOCAL');
      let localEnd = data + compressed;
      if (flags & 8) {
        const descriptor = bytes.readUInt32LE(localEnd) === 0x08074b50 ? localEnd + 4 : localEnd;
        if (descriptor + 12 > centralStart || bytes.readUInt32LE(descriptor) !== crc
          || bytes.readUInt32LE(descriptor + 4) !== compressed || bytes.readUInt32LE(descriptor + 8) !== size) throw error('ZIP_DESCRIPTOR');
        localEnd = descriptor + 12;
      }
      const payload = bytes.subarray(data, data + compressed);
      const decoded = method === 0 ? payload : zlib.inflateRawSync(payload, { maxOutputLength: size + 1 });
      if (decoded.length !== size || crc32(decoded) !== crc || (directory && size !== 0)) throw error('ZIP_BYTES');
      ranges.push([local, localEnd]);
      if (!directory) result.push({ path: name, bytes: decoded, mode });
      offset = next;
    }
    ranges.sort((a, b) => a[0] - b[0]); let cursor = 0;
    for (const [start, stop] of ranges) { if (start !== cursor) throw error('ZIP_ROSTER'); cursor = stop; }
    if (cursor !== centralStart || offset !== end) throw error('ZIP_ROSTER');
    return result;
  } catch (cause) {
    if (cause.message?.startsWith('E_ATLAS_RESOURCE_')) throw cause;
    throw error('ZIP_INVALID');
  }
}

async function regular(file, expectedBytes, expectedSha) {
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.size !== expectedBytes) throw error('SOURCE_HASH');
    const bytes = await handle.readFile(), after = await handle.stat();
    if (sha(bytes) !== expectedSha || before.ino !== after.ino || before.dev !== after.dev
      || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw error('SOURCE_HASH');
    return bytes;
  } finally { await handle?.close(); }
}

async function assertTarget(source, target) {
  if (!path.isAbsolute(source || '') || !path.isAbsolute(target || '') || path.resolve(source) !== source || path.resolve(target) !== target
    || source === target || target.startsWith(source + path.sep)) throw error('TARGET');
  try { await fs.lstat(target); throw error('TARGET_EXISTS'); } catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  if (await fs.realpath(source) !== source || await fs.realpath(path.dirname(target)) !== path.dirname(target)) throw error('TARGET_IDENTITY');
}

async function buildAtlasLanguageResources({ sourceDirectory, outputDirectory, nativeNoticesArchive }) {
  await assertTarget(sourceDirectory, outputDirectory);
  // Validate all five complete input digests before parsing any archive or
  // creating the target. Keep the original four-input manifest contract.
  const sources = new Map();
  for (const input of manifest.inputs) sources.set(input.role,
    await regular(path.join(sourceDirectory, input.filename), input.byteLength, input.sha256));
  const noticeInput = manifest.nativeNotices;
  if (typeof nativeNoticesArchive !== 'string' || !path.isAbsolute(nativeNoticesArchive)
    || path.resolve(nativeNoticesArchive) !== nativeNoticesArchive
    || path.basename(nativeNoticesArchive) !== noticeInput.filename) throw error('NATIVE_NOTICE_INPUT');
  try {
    if (await fs.realpath(nativeNoticesArchive) !== nativeNoticesArchive) throw error('NATIVE_NOTICE_INPUT');
  } catch { throw error('NATIVE_NOTICE_INPUT'); }
  const nativeNoticeBytes = await regular(nativeNoticesArchive, noticeInput.byteLength, noticeInput.sha256);
  const nativeNotices = readZip(nativeNoticeBytes);
  if (nativeNotices.length !== noticeInput.entryCount
    || !nativeNotices.some(row => row.path === 'index.json')) throw error('NOTICE_ROSTER');
  const files = new Map(), links = new Map(), folded = new Set();
  function add(relative, bytes, mode, target) {
    if (!safe(relative) || folded.has(relative.toLowerCase()) || relative === 'worker.py' || relative === 'catalog.json') throw error('OUTPUT_PATH');
    folded.add(relative.toLowerCase());
    if (target !== undefined) {
      if (!safe(target)) throw error('OUTPUT_LINK'); links.set(relative, target);
    } else files.set(relative, { bytes, mode: mode & 0o111 ? 0o555 : 0o444 });
  }
  await new Promise((resolve, reject) => {
    let total = 0;
    const parser = tar.t({ onReadEntry(entry) {
      try {
        const relative = entry.path.replace(/\/$/u, '');
        if (!safe(relative) || (relative !== 'python' && !relative.startsWith('python/'))) throw error('TAR_PATH');
        if (entry.type === 'Directory') { entry.resume(); return; }
        if (entry.type === 'SymbolicLink') { add(relative, null, 0, entry.linkpath); entry.resume(); return; }
        if (entry.type !== 'File' || entry.size > 64 * 1024 * 1024) throw error('TAR_TYPE');
        total += entry.size; if (total > 100 * 1024 * 1024) throw error('TAR_BUDGET');
        const chunks = []; let size = 0;
        entry.on('data', chunk => { size += chunk.length; chunks.push(chunk); });
        entry.on('end', () => {
          try { if (size !== entry.size) throw error('TAR_BYTES'); add(relative, Buffer.concat(chunks), entry.mode); }
          catch (cause) { parser.abort(cause); reject(cause); }
        });
      } catch (cause) { parser.abort(cause); reject(cause); }
    } });
    parser.once('error', reject); parser.once('end', resolve); parser.end(sources.get('python'));
  });
  const wheelhouse = readZip(sources.get('wheelhouse'));
  if (wheelhouse.length !== 53) throw error('WHEEL_ROSTER');
  const indexEntry = wheelhouse.find(row => row.path === 'index.json');
  const wheelIndex = JSON.parse(indexEntry.bytes.toString('utf8'));
  if (!Array.isArray(wheelIndex.rows) || wheelIndex.rows.length !== 49) throw error('WHEEL_ROSTER');
  for (const row of wheelIndex.rows) {
    if (!safe(row.filename)) throw error('WHEEL_PATH');
    const wheel = wheelhouse.find(item => item.path === 'wheels/' + row.filename);
    if (!wheel || wheel.bytes.length !== row.bytes || sha(wheel.bytes) !== row.sha256) throw error('WHEEL_HASH');
    if (row.filename.startsWith('numpy-')) continue;
    for (const member of readZip(wheel.bytes)) add('site/' + member.path, member.bytes, member.mode);
  }
  for (const member of readZip(sources.get('numpy'))) add('site/' + member.path, member.bytes, member.mode);
  const notices = wheelhouse.filter(row => row.path.startsWith('licenses/pymorphy3-dicts-ru/'));
  if (notices.length !== 3) throw error('NOTICE_ROSTER');
  for (const row of notices) add('notices/' + row.path.slice('licenses/'.length), row.bytes, 0o444);
  const supplier = readZip(sources.get('supplierNotices'));
  if (supplier.length !== 22) throw error('NOTICE_ROSTER');
  for (const row of supplier) if (row.path !== 'index.json') add('notices/supplier/' + row.path, row.bytes, 0o444);
  for (const row of nativeNotices) if (row.path !== 'index.json') add('notices/native/' + row.path, row.bytes, 0o444);
  const entries = [
    ...[...files].map(([name, value]) => ({ path: name, kind: 'file', byteLength: value.bytes.length, sha256: sha(value.bytes), mode: value.mode })),
    ...[...links].map(([name, target]) => ({ path: name, kind: 'symlink', target })),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const parents = new Set();
  for (const row of entries) {
    let parent = path.posix.dirname(row.path);
    while (parent !== '.') {
      if (folded.has(parent.toLowerCase())) throw error('OUTPUT_PATH'); parents.add(parent); parent = path.posix.dirname(parent);
    }
    if (row.kind === 'symlink') {
      const target = path.posix.join(path.posix.dirname(row.path), row.target);
      if (!files.has(target)) throw error('OUTPUT_LINK');
    }
  }
  const catalog = { schemaVersion: 'atlas.languageResourceCatalog.v1', platform: manifest.platform, arch: manifest.arch,
    pythonVersion: manifest.pythonVersion, engineVersion: manifest.engineVersion, modelVersions: manifest.modelVersions, entries };
  const bytes = Buffer.from(JSON.stringify(catalog, null, 2) + '\n');
  if (sha(bytes) !== manifest.catalogSha256 || entries.length !== manifest.entryCount
    || entries.reduce((total, row) => total + (row.byteLength || 0), 0) !== manifest.uncompressedBytes) throw error('CATALOG_PIN');
  const worker = await fs.readFile(path.join(__dirname, '../src/main/atlasLanguageAnalysisWorker.py'));
  await fs.mkdir(outputDirectory, { mode: 0o700 });
  for (const parent of [...parents].sort()) await fs.mkdir(path.join(outputDirectory, parent), { recursive: true, mode: 0o700 });
  for (const [name, value] of files) {
    const output = path.join(outputDirectory, name); await fs.writeFile(output, value.bytes, { flag: 'wx', mode: value.mode }); await fs.chmod(output, value.mode);
  }
  for (const [name, target] of links) await fs.symlink(target, path.join(outputDirectory, name));
  for (const [name, value] of [['catalog.json', bytes], ['worker.py', worker]]) {
    await fs.writeFile(path.join(outputDirectory, name), value, { flag: 'wx', mode: 0o444 }); await fs.chmod(path.join(outputDirectory, name), 0o444);
  }
  await verifyAtlasLanguageResourceCatalog({ resourceRoot: outputDirectory, expectedCatalogSha256: manifest.catalogSha256, expectedWorkerSha256: sha(worker) });
  for (const parent of [...parents].sort().reverse()) await fs.chmod(path.join(outputDirectory, parent), 0o555);
  await fs.chmod(outputDirectory, 0o555);
  return { catalogSha256: manifest.catalogSha256, entries: entries.length, byteLength: manifest.uncompressedBytes, workerSha256: sha(worker) };
}

async function copyVerifiedAtlasLanguageResources({ sourceDirectory, outputDirectory }) {
  await assertTarget(sourceDirectory, outputDirectory);
  const worker = await fs.readFile(path.join(__dirname, '../src/main/atlasLanguageAnalysisWorker.py'));
  const identity = { expectedCatalogSha256: manifest.catalogSha256, expectedWorkerSha256: sha(worker) };
  await verifyAtlasLanguageResourceCatalog({ resourceRoot: sourceDirectory, ...identity });
  await fs.cp(sourceDirectory, outputDirectory, { recursive: true, dereference: false, verbatimSymlinks: true, force: false, errorOnExist: true });
  await verifyAtlasLanguageResourceCatalog({ resourceRoot: outputDirectory, ...identity });
}

module.exports = { buildAtlasLanguageResources, copyVerifiedAtlasLanguageResources, readZip, crc32 };
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.length !== 6 || argv[0] !== '--source-directory' || argv[2] !== '--native-notices-archive' || argv[4] !== '--out') {
    process.stderr.write('E_ATLAS_RESOURCE_ARGUMENTS\n'); process.exitCode = 1;
  } else buildAtlasLanguageResources({ sourceDirectory: argv[1], nativeNoticesArchive: argv[3], outputDirectory: argv[5] })
    .then(result => process.stdout.write(JSON.stringify(result) + '\n'))
    .catch(cause => { process.stderr.write((cause.message?.startsWith('E_ATLAS_RESOURCE_') ? cause.message : 'E_ATLAS_RESOURCE_BUILD_FAILED') + '\n'); process.exitCode = 1; });
}

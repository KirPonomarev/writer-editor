import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const stableValue = (value) => {
  if (value === undefined) return null;
  if (Buffer.isBuffer(value)) return { type: 'Buffer', sha256: sha256(value), byteLength: value.length };
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
};
const stableStringify = (value) => JSON.stringify(stableValue(value));
const targetPath = (filePath) => path.resolve(String(filePath));
const normalizeMode = (mode) => {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) throw new Error(`E_FIXTURE_PUBLICATION_MODE:${String(mode)}`);
  return mode;
};

function fsyncDirectory(fsModule, dir, stats) {
  const handle = fsModule.openSync(dir, 'r');
  try {
    stats.fsyncCalls += 1;
    fsModule.fsyncSync(handle);
  } finally {
    fsModule.closeSync(handle);
  }
}

export function createFixturePublicationCache({ fsModule = fs, identity = 'default', requiredMode = 0o600 } = {}) {
  const published = new Set();
  const stats = {
    deduped: 0,
    failures: 0,
    fsyncCalls: 0,
    published: 0,
    readbackCalls: 0,
    renameCalls: 0,
    uniquePathByteHashes: new Set(),
    uniquePaths: new Set(),
    writeCalls: 0,
  };
  const identityKey = stableStringify(identity);
  const validateExistingTarget = ({ target, digest, mode }) => {
    let stat;
    try {
      stat = fsModule.lstatSync(target);
    } catch {
      return false;
    }
    if (typeof stat.isFile !== 'function' || !stat.isFile()) return false;
    if ((stat.mode & 0o777) !== mode) return false;
    stats.readbackCalls += 1;
    return sha256(fsModule.readFileSync(target)) === digest;
  };
  const publish = (filePath, bytes, options = {}) => {
    const payload = Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(bytes);
    const target = targetPath(filePath);
    const digest = sha256(payload);
    const mode = normalizeMode(options.requiredMode ?? options.mode ?? requiredMode);
    const key = stableStringify({ identity: identityKey, mode, path: target, sha256: digest });
    if (published.has(key)) {
      if (validateExistingTarget({ target, digest, mode })) {
        stats.deduped += 1;
        return { deduped: true, mode, path: target, sha256: digest };
      }
      published.delete(key);
    }
    const dir = path.dirname(target);
    const temporary = path.join(dir, `.${path.basename(target)}.r24-fixture-tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
    let handle = null;
    let renamed = false;
    fsModule.mkdirSync(dir, { recursive: true });
    try {
      handle = fsModule.openSync(temporary, 'wx', mode);
      stats.writeCalls += 1;
      fsModule.writeFileSync(handle, payload);
      stats.fsyncCalls += 1;
      fsModule.fsyncSync(handle);
      fsModule.closeSync(handle);
      handle = null;
      stats.renameCalls += 1;
      fsModule.renameSync(temporary, target);
      renamed = true;
      fsyncDirectory(fsModule, dir, stats);
      stats.readbackCalls += 1;
      if (sha256(fsModule.readFileSync(target)) !== digest) throw new Error(`E_FIXTURE_PUBLICATION_READBACK:${target}`);
      const stat = fsModule.lstatSync(target);
      if (typeof stat.isFile !== 'function' || !stat.isFile() || (stat.mode & 0o777) !== mode) throw new Error(`E_FIXTURE_PUBLICATION_MODE_READBACK:${target}`);
      published.add(key);
      stats.published += 1;
      stats.uniquePaths.add(target);
      stats.uniquePathByteHashes.add(key);
      return { deduped: false, mode, path: target, sha256: digest };
    } catch (error) {
      stats.failures += 1;
      throw error;
    } finally {
      if (handle !== null) {
        try { fsModule.closeSync(handle); } catch {}
      }
      if (!renamed) {
        try { if (fsModule.existsSync(temporary)) fsModule.unlinkSync(temporary); } catch {}
      }
    }
  };
  const clear = () => {
    published.clear();
    stats.deduped = 0;
    stats.failures = 0;
    stats.fsyncCalls = 0;
    stats.published = 0;
    stats.readbackCalls = 0;
    stats.renameCalls = 0;
    stats.uniquePathByteHashes.clear();
    stats.uniquePaths.clear();
    stats.writeCalls = 0;
  };
  const summary = () => ({
    deduped: stats.deduped,
    failures: stats.failures,
    fsyncCalls: stats.fsyncCalls,
    published: stats.published,
    readbackCalls: stats.readbackCalls,
    renameCalls: stats.renameCalls,
    uniquePathByteHashCount: stats.uniquePathByteHashes.size,
    uniquePathCount: stats.uniquePaths.size,
    writeCalls: stats.writeCalls,
  });
  return { clear, publish, stats, summary };
}

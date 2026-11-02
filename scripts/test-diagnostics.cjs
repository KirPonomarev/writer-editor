'use strict';

// Development test evidence only. Payloads never supply paths or authority.
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const TEST_BUFFER_BYTES = 64 * 1024 * 1024;
const families = new Set([
  'ACTUAL_CORRECTION_PERSISTENCE',
  'ACTUAL_IDEA_MEANING_PERSISTENCE',
  'ACTUAL_SCENE_LANGUAGE_PERSISTENCE',
]);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function kind(value) {
  if (!object(value)) return null;
  if (families.has(value.causalReach)) return value.causalReach;
  return typeof value.nativeSaveSystem === 'string' && value.nativeSaveSystem
    ? value.nativeSaveSystem : null;
}
function utf8(bytes) {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('DIAGNOSTIC_UTF8_INVALID');
  return text;
}
function packDiagnostic(payload) {
  if (!families.has(payload?.causalReach)) throw new Error('DIAGNOSTIC_KIND_UNSUPPORTED');
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  return JSON.stringify({ causalReach: payload.causalReach, id: payload.id, fullEvidence: {
    encoding: 'gzip-base64-json-v1', uncompressedUtf8Bytes: bytes.length,
    sha256: sha256(bytes), data: zlib.gzipSync(bytes).toString('base64'),
  } });
}
function readDiagnostic(text) {
  const outer = JSON.parse(text);
  if (!kind(outer)) throw new Error('DIAGNOSTIC_KIND_UNSUPPORTED');
  if (!Object.hasOwn(outer, 'fullEvidence')) {
    return { payload: outer, bytes: Buffer.from(text, 'utf8') };
  }
  const full = outer.fullEvidence;
  if (!object(full) || full.encoding !== 'gzip-base64-json-v1'
      || Object.keys(full).sort().join(',') !== 'data,encoding,sha256,uncompressedUtf8Bytes'
      || !Number.isSafeInteger(full.uncompressedUtf8Bytes) || full.uncompressedUtf8Bytes < 2
      || full.uncompressedUtf8Bytes > TEST_BUFFER_BYTES
      || !/^[a-f0-9]{64}$/u.test(full.sha256)
      || typeof full.data !== 'string' || full.data.length === 0
      || full.data.length > 2 * TEST_BUFFER_BYTES) throw new Error('DIAGNOSTIC_ENVELOPE_INVALID');
  const compressed = Buffer.from(full.data, 'base64');
  if (compressed.toString('base64') !== full.data) throw new Error('DIAGNOSTIC_BASE64_INVALID');
  const bytes = zlib.gunzipSync(compressed, { maxOutputLength: full.uncompressedUtf8Bytes });
  if (bytes.length !== full.uncompressedUtf8Bytes || sha256(bytes) !== full.sha256) {
    throw new Error('DIAGNOSTIC_BYTES_MISMATCH');
  }
  const payload = JSON.parse(utf8(bytes));
  if (kind(payload) !== kind(outer) || payload.causalReach !== outer.causalReach
      || payload.nativeSaveSystem !== outer.nativeSaveSystem
      || (Object.hasOwn(outer, 'id') && payload.id !== outer.id)) {
    throw new Error('DIAGNOSTIC_IDENTITY_MISMATCH');
  }
  return { payload, bytes };
}
function tapEscape(text) {
  return text.replace(/\\/gu, '\\\\').replace(/#/gu, '\\#');
}
function readTapDiagnostic(line) {
  const match = /^(\s*)# (\{.*\})$/u.exec(line);
  if (!match || !/"(?:causalReach|nativeSaveSystem)"/u.test(match[2])) return null;
  const text = match[2].replace(/\\([\\#])/gu, '$1');
  // These are exactly JSON.stringify diagnostics emitted by Node's TAP reporter.
  if (tapEscape(text) !== match[2]) throw new Error('DIAGNOSTIC_TAP_ESCAPE_INVALID');
  const value = JSON.parse(text);
  if (!kind(value)) return null; // Other complete diagnostic bytes stay untouched.
  return { ...readDiagnostic(text), indent: match[1] };
}
function summarizeTap(stdout) {
  let diagnostics = 0, opaqueDiagnostics = 0;
  const text = stdout.split('\n').map(line => {
    const decoded = readTapDiagnostic(line);
    if (!decoded) {
      const opaque = /^(\s*)# (\{.*\})$/u.exec(line);
      if (!opaque) return line;
      // Preserve unrecognized diagnostics as exact opaque TAP bytes, never
      // as verified payload semantics or acceptance evidence.
      const bytes = Buffer.from(opaque[2], 'utf8');
      opaqueDiagnostics += 1;
      return opaque[1] + '# retained opaque diagnostic tap-json-bytes=' + bytes.length + ' sha256=' + sha256(bytes);
    }
    diagnostics += 1;
    return decoded.indent + '# retained diagnostic ' + kind(decoded.payload)
      + ' bytes=' + decoded.bytes.length + ' sha256=' + sha256(decoded.bytes);
  }).join('\n');
  return { text, diagnostics, opaqueDiagnostics };
}
function readTapTotals(stdout, stderr) {
  const combined = String(stdout || '') + '\n' + String(stderr || '');
  const values = {};
  let marker = '';
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...combined.matchAll(new RegExp('^([#ℹ])\\s+' + key + ' (\\d+)$', 'gm'))];
    const last = matches.at(-1);
    values[key] = last ? Number(last[2]) : null;
    if (last) {
      if (marker && marker !== last[1]) return { ...values, executed: null, valid: false };
      marker = last[1];
    }
  }
  const complete = Object.values(values).every(value => Number.isSafeInteger(value) && value >= 0);
  const sum = complete ? values.pass + values.fail + values.cancelled + values.skipped + values.todo : null;
  return {
    ...values,
    executed: values.pass === null || values.fail === null ? null : values.pass + values.fail,
    valid: complete && values.tests === sum,
  };
}

function packUnitArtifact(result) {
  const stdout = Buffer.from(result.stdout || '', 'utf8'), stderr = Buffer.from(result.stderr || '', 'utf8');
  const metadata = Buffer.from(JSON.stringify({
    schema: 'yalken-unit-tap-v1', status: result.status, signal: result.signal ?? null,
    error: result.error ? { code: String(result.error.code || ''), message: String(result.error.message || result.error) } : null,
    stdoutBytes: stdout.length, stdoutSha256: sha256(stdout),
    stderrBytes: stderr.length, stderrSha256: sha256(stderr),
  }) + '\n', 'utf8');
  return zlib.gzipSync(Buffer.concat([metadata, stdout, stderr]));
}
function readUnitArtifact(compressed) {
  // Two unchanged spawn buffers plus a finite container metadata header.
  const bytes = zlib.gunzipSync(compressed, { maxOutputLength: 2 * TEST_BUFFER_BYTES + 65536 });
  const end = bytes.indexOf(10);
  if (end < 0 || end > 65536) throw new Error('UNIT_ARTIFACT_HEADER_INVALID');
  const metadata = JSON.parse(utf8(bytes.subarray(0, end)));
  if (!object(metadata) || metadata.schema !== 'yalken-unit-tap-v1'
      || !(metadata.status === null || Number.isSafeInteger(metadata.status) && metadata.status >= 0)
      || !(metadata.signal === null || typeof metadata.signal === 'string' && metadata.signal.length > 0)
      || !(metadata.error === null || object(metadata.error) && typeof metadata.error.code === 'string' && typeof metadata.error.message === 'string')) {
    throw new Error('UNIT_ARTIFACT_METADATA_INVALID');
  }
  for (const channel of ['stdout', 'stderr']) {
    if (!Number.isSafeInteger(metadata[channel + 'Bytes']) || metadata[channel + 'Bytes'] < 0
        || metadata[channel + 'Bytes'] > TEST_BUFFER_BYTES
        || !/^[a-f0-9]{64}$/u.test(metadata[channel + 'Sha256'])) throw new Error('UNIT_ARTIFACT_LENGTH_INVALID');
  }
  const offset = end + 1, split = offset + metadata.stdoutBytes;
  if (bytes.length !== split + metadata.stderrBytes) throw new Error('UNIT_ARTIFACT_LENGTH_MISMATCH');
  const stdout = bytes.subarray(offset, split), stderr = bytes.subarray(split);
  if (sha256(stdout) !== metadata.stdoutSha256 || sha256(stderr) !== metadata.stderrSha256) {
    throw new Error('UNIT_ARTIFACT_HASH_MISMATCH');
  }
  const result = { ...metadata, stdout: utf8(stdout), stderr: utf8(stderr) };
  const totals = readTapTotals(result.stdout, result.stderr);
  const summary = summarizeTap(result.stdout);
  const exitCode = result.status !== 0 ? result.status ?? 1
    : result.error || result.signal || !totals.valid || totals.executed === 0 || totals.fail > 0 || totals.cancelled > 0 ? 1 : 0;
  return { result, totals, diagnostics: summary.diagnostics, opaqueDiagnostics: summary.opaqueDiagnostics, consoleStdout: summary.text, exitCode };
}
module.exports = { packDiagnostic, readDiagnostic, readTapDiagnostic, summarizeTap, readTapTotals,
  packUnitArtifact, readUnitArtifact, sha256 };

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/test-diagnostics.cjs <unit-artifact.tap.gz>');
    const fs = require('node:fs');
    const compressed = fs.readFileSync(process.argv[2]);
    const decoded = readUnitArtifact(compressed);
    console.log(JSON.stringify({ artifactSha256: sha256(compressed), actualStatus: decoded.result.status,
      signal: decoded.result.signal, error: decoded.result.error, totals: decoded.totals,
      diagnosticPayloadsVerified: decoded.diagnostics, opaqueDiagnosticLinesRetained: decoded.opaqueDiagnostics, exitCode: decoded.exitCode }));
    process.exitCode = decoded.exitCode;
  } catch (error) {
    console.error('UNIT_ARTIFACT_REFUSED=' + String(error.message || error));
    process.exitCode = 1;
  }
}

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
  const fields = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
  const invalid = () => ({ ...Object.fromEntries(fields.map(key => [key, null])), executed: null, valid: false });
  const refusal = Symbol('incomplete or contradictory native test output');
  const requireValid = value => { if (!value) throw refusal; };
  const documents = [];
  let doc = null, yamlIndent = null, lastOutcome = null;
  const sealed = () => doc && fields.every(key => Object.hasOwn(doc.stats, key));
  const closeScopes = indent => {
    while (doc.scopes.length && doc.scopes.at(-1).indent > indent) {
      const scope = doc.scopes.pop();
      requireValid(scope.plan !== null && scope.plan === scope.count);
    }
  };
  const scopeAt = indent => {
    closeScopes(indent);
    if (!doc.scopes.length || doc.scopes.at(-1).indent < indent) {
      doc.scopes.push({ indent, count: 0, plan: null });
    }
    return doc.scopes.at(-1);
  };
  const finish = () => {
    if (!doc) return;
    requireValid(yamlIndent === null && sealed());
    const s = doc.stats, suites = s.suites ?? 0;
    requireValid(s.tests === s.pass + s.fail + s.cancelled + s.skipped + s.todo);
    requireValid(doc.raw.bad === 0 || s.fail + s.cancelled > 0);
    const expected = { pass: s.pass, bad: s.fail + s.cancelled, skip: s.skipped, todo: s.todo };
    if (doc.format === 'tap') {
      closeScopes(-1);
      requireValid(Object.values(doc.suite).reduce((a, b) => a + b, 0) === suites);
      for (const key of Object.keys(expected)) requireValid(doc.raw[key] - doc.suite[key] === expected[key]);
    } else {
      requireValid(doc.open.length === 0);
      let suiteOutcomes = 0;
      for (const key of Object.keys(expected)) {
        requireValid(doc.raw[key] >= expected[key]);
        suiteOutcomes += doc.raw[key] - expected[key];
      }
      requireValid(suiteOutcomes === suites);
    }
    documents.push(s);
    doc = null;
    lastOutcome = null;
  };
  const begin = format => {
    if (sealed()) finish();
    if (!doc) doc = { format, stats: {}, raw: { pass: 0, bad: 0, skip: 0, todo: 0 },
      suite: { pass: 0, bad: 0, skip: 0, todo: 0 }, scopes: [], open: [] };
    requireValid(doc.format === format);
  };
  try {
    for (const rawLine of (String(stdout || '') + '\n' + String(stderr || '')).split('\n')) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (yamlIndent !== null) {
        if (line === ' '.repeat(yamlIndent) + '...') yamlIndent = null;
        else if (line === ' '.repeat(yamlIndent) + "type: 'suite'") {
          requireValid(lastOutcome && !lastOutcome.suite);
          lastOutcome.suite = true;
          doc.suite[lastOutcome.category] += 1;
        }
        continue;
      }
      if (/^TAP version /u.test(line)) {
        requireValid(line === 'TAP version 13');
        if (doc) finish();
        begin('tap');
        continue;
      }
      requireValid(!/^\s*Bail out!/iu.test(line));
      const yaml = /^( +)---$/u.exec(line);
      if (yaml) {
        requireValid(doc?.format === 'tap' && !sealed() && lastOutcome
          && yaml[1].length === lastOutcome.indent + 2);
        yamlIndent = yaml[1].length;
        continue;
      }
      const counter = /^([#ℹ])\s+(tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/u.exec(line);
      if (counter) {
        const format = counter[1] === '#' ? 'tap' : 'spec';
        if (!doc) begin(format);
        requireValid(doc.format === format && !Object.hasOwn(doc.stats, counter[2]));
        if (format === 'tap') {
          requireValid(doc.scopes.every(scope => scope.indent === 0));
          closeScopes(-1);
        }
        const value = Number(counter[3]);
        requireValid(Number.isSafeInteger(value) && value >= 0);
        doc.stats[counter[2]] = value;
        continue;
      }
      requireValid(!/^[#ℹ]\s+(?:tests|suites|pass|fail|cancelled|skipped|todo)\b/u.test(line));
      if (/^# Subtest:/u.test(line) && sealed()) finish();
      const outcome = /^( *)(not ok|ok) (\d+)(?: - .*)?$/u.exec(line);
      if (outcome) {
        begin('tap');
        const indent = outcome[1].length, pending = doc.scopes.at(-1);
        requireValid(!pending || pending.indent <= indent || pending.indent === indent + 4);
        const scope = scopeAt(indent), id = Number(outcome[3]);
        requireValid(Number.isSafeInteger(id) && id === scope.count + 1);
        scope.count += 1;
        requireValid(scope.plan === null || scope.count <= scope.plan);
        const directive = /(?<!\\)#\s+(SKIP|TODO)\b/iu.exec(line)?.[1].toUpperCase();
        const category = directive === 'TODO' ? 'todo' : directive === 'SKIP' ? 'skip'
          : outcome[2] === 'not ok' ? 'bad' : 'pass';
        doc.raw[category] += 1;
        lastOutcome = { indent, category, suite: false };
        continue;
      }
      requireValid(!/^\s*(?:not ok|ok)\b/u.test(line));
      const plan = /^( *)1\.\.(\d+)(?: # SKIP(?: .*)?)?$/iu.exec(line);
      if (plan) {
        begin('tap');
        const indent = plan[1].length;
        requireValid(!doc.scopes.length || doc.scopes.at(-1).indent <= indent);
        const scope = scopeAt(indent), count = Number(plan[2]);
        requireValid(Number.isSafeInteger(count) && scope.plan === null && count >= scope.count);
        scope.plan = count;
        continue;
      }
      requireValid(!/^\s*\d+\.\./u.test(line));
      const opening = /^( *)▶ (.+)$/u.exec(line);
      if (opening) {
        begin('spec');
        const indent = opening[1].length;
        requireValid(!doc.open.length || doc.open.at(-1).indent < indent);
        doc.open.push({ indent, name: opening[2] });
        continue;
      }
      const spec = /^( *)([✔✖﹣]) (.*) \(([-+\d.eE]+)ms\)(?: # (SKIP|TODO)(?: .*)?)?$/u.exec(line);
      if (spec) {
        begin('spec');
        const indent = spec[1].length, pending = doc.open.at(-1);
        requireValid(!pending || pending.indent <= indent);
        if (pending?.indent === indent) {
          requireValid(pending.name === spec[3]);
          doc.open.pop();
        }
        const category = spec[5] === 'TODO' ? 'todo' : spec[5] === 'SKIP' || spec[2] === '﹣' ? 'skip'
          : spec[2] === '✖' ? 'bad' : 'pass';
        doc.raw[category] += 1;
        continue;
      }
      requireValid(!/^\s*[✔✖﹣]\s/u.test(line));
    }
    finish();
    requireValid(documents.length > 0);
    const values = Object.fromEntries(fields.map(key => [key, documents.reduce((sum, s) => sum + s[key], 0)]));
    requireValid(Object.values(values).every(Number.isSafeInteger));
    return { ...values, executed: values.pass + values.fail, valid: true };
  } catch (error) {
    if (error !== refusal) throw error;
    return invalid();
  }
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

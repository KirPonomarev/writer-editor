#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildInventory, listTestFiles, validateInventory } from '../test-inventory.mjs';
import { canonicalBytes, sha256 } from './canonical-json.mjs';
import { buildApprovals, PATHS as C2A } from './c2a-effective-certification.mjs';
import { buildManifest, buildClaimBindings, PATHS as RCV } from './rcv01a-normative-claim-test-lane-manifest.mjs';

export const TARGETS = Object.freeze([
  C2A.inventory, C2A.approvals, RCV.manifest, RCV.claimBindings,
  'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json',
  'scripts/ops/rtk-interop-data-c1.mjs',
  'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
]);
const [INV, APPROVALS, MANIFEST, CLAIMS, POLICY, DATA, CERT] = TARGETS;
const REQUEST_VERSION = 'YALKEN_CURRENT_BINDINGS_REQUEST_V1';
const MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 128 * 1024 * 1024;
const fail = (code, detail = '') => { throw new Error(`${code}${detail ? ':' + detail : ''}`); };
const demand = (ok, code, detail) => { if (!ok) fail(code, detail); };
const same = (a, b) => canonicalBytes(a).equals(canonicalBytes(b));
const pretty = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const hex = (v, n) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`, 'u').test(v);
function keys(value, expected, code = 'E_CURRENT_BINDINGS_FORMAT') {
  demand(value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...expected].sort()), code);
}
function relative(value) {
  demand(typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 512
    && value === value.normalize('NFC') && !/[\\\u0000-\u001f\u007f:]/u.test(value)
    && !path.posix.isAbsolute(value) && value.split('/').every(x => x && x !== '.' && x !== '..' && x === x.trim()), 'E_CURRENT_BINDINGS_PATH');
  return value;
}
function paths(values, max = 128) {
  demand(Array.isArray(values) && values.length <= max && new Set(values).size === values.length, 'E_CURRENT_BINDINGS_PATH_SET');
  return values.map(relative);
}
function validateRequest(request) {
  keys(request, ['schemaVersion', 'taskId', 'expectedHead', 'bindingBaseSha', 'bindingBaseTree', 'scopeIn', 'expectedOld', 'additionalAdmittedPaths', 'additionalSourcePaths']);
  demand(request.schemaVersion === REQUEST_VERSION && /^[A-Z][A-Z0-9_]{2,127}$/u.test(request.taskId), 'E_CURRENT_BINDINGS_REQUEST_VERSION');
  demand(hex(request.expectedHead, 40) && hex(request.bindingBaseSha, 40) && hex(request.bindingBaseTree, 40), 'E_CURRENT_BINDINGS_GIT_IDENTITY');
  const scope = new Set(paths(request.scopeIn));
  keys(request.expectedOld, TARGETS);
  for (const p of TARGETS) demand(scope.has(p) && hex(request.expectedOld[p], 64), 'E_CURRENT_BINDINGS_TARGET_SET', p);
  for (const p of [...paths(request.additionalAdmittedPaths, 32), ...paths(request.additionalSourcePaths, 32)]) {
    demand(scope.has(p), 'E_CURRENT_BINDINGS_UNDECLARED_ADDITION', p);
  }
  return request;
}
function git(root, args) {
  return execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
}
function identity(root, request) {
  const result = git(root, ['rev-parse', '--show-toplevel', 'HEAD', 'HEAD^{tree}', '--abbrev-ref', 'HEAD']).trim().split('\n');
  demand(result.length === 4 && result[0] === root && result[1] === request.expectedHead, 'E_CURRENT_BINDINGS_HEAD');
  demand(git(root, ['rev-parse', request.bindingBaseSha + '^{tree}']).trim() === request.bindingBaseTree, 'E_CURRENT_BINDINGS_BASE_TREE');
  git(root, ['merge-base', '--is-ancestor', request.bindingBaseSha, request.expectedHead]);
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0').filter(Boolean);
  const scope = new Set(request.scopeIn);
  for (const name of git(root, ['diff', '--name-only', '--no-renames', '-z', request.bindingBaseSha, request.expectedHead, '--']).split('\0').filter(Boolean)) {
    demand(scope.has(name), 'E_CURRENT_BINDINGS_COMMITTED_SCOPE', name);
  }
  for (let i = 0; i < status.length; i += 1) {
    const row = status[i]; demand(row.length > 3 && scope.has(row.slice(3)), 'E_CURRENT_BINDINGS_DIRTY_SCOPE', row.slice(3));
    if (/[RC]/u.test(row.slice(0, 2))) demand(scope.has(status[++i]), 'E_CURRENT_BINDINGS_DIRTY_RENAME');
  }
  return { root, head: result[1], tree: result[2], branch: result[3] };
}
function safeFile(root, name) {
  relative(name);
  let target = root;
  const parts = name.split('/');
  for (let i = 0; i < parts.length; i += 1) {
    // Darwin realpath can preserve the supplied case. Resolve exactly one
    // physical spelling, allowing only filesystem NFC/NFD equivalence.
    const matches = fs.readdirSync(target).filter(entry => entry.normalize('NFC') === parts[i]);
    demand(matches.length === 1, 'E_CURRENT_BINDINGS_PATH_ALIAS', name);
    target = path.join(target, matches[0]);
    const s = fs.lstatSync(target);
    demand(!s.isSymbolicLink(), 'E_CURRENT_BINDINGS_SYMLINK', name);
    demand(i === parts.length - 1 ? s.isFile() && s.nlink === 1 : s.isDirectory(), 'E_CURRENT_BINDINGS_FILE_TYPE', name);
  }
  demand(fs.realpathSync(target) === target, 'E_CURRENT_BINDINGS_PATH_ALIAS', name);
  const stat = fs.statSync(target, { bigint: true });
  demand(stat.size <= BigInt(MAX_FILE), 'E_CURRENT_BINDINGS_FILE_BYTES', name);
  const bytes = fs.readFileSync(target);
  const after = fs.statSync(target, { bigint: true });
  const fingerprint = s => [s.dev, s.ino, s.mode, s.uid, s.gid, s.size, s.mtimeNs, s.ctimeNs].map(String);
  demand(same(fingerprint(stat), fingerprint(after)) && BigInt(bytes.length) === stat.size, 'E_CURRENT_BINDINGS_UNSTABLE_READ', name);
  return { bytes, record: { path: name, sha256: sha256(bytes), identity: fingerprint(after) } };
}
function withoutApprovalDigests(value) {
  return { ...value, approvals: value.approvals.map(row => ({ ...row, sha256: 'CURRENT_DIGEST' })) };
}
function withoutManifestDigests(value) {
  const v = structuredClone(value);
  v.sourceBindings.inventory.sha256 = 'CURRENT_DIGEST'; v.sourceBindings.inventory.byteLength = 'CURRENT_LENGTH';
  for (const row of v.claims) for (const test of row.exactTests) test.sha256 = 'CURRENT_DIGEST';
  return v;
}
function withoutClaimDigests(value) {
  const v = structuredClone(value); v.candidateIdentity.boundFileSetDigest = 'CURRENT_DIGEST';
  for (const row of [...v.claimBindings, ...v.implementationArtifactDigests]) row.sha256 = 'CURRENT_DIGEST';
  return v;
}
function selectedDelta(source, request = null) {
  const aliases = [...source.matchAll(/^const R24_INTEROP_CURRENT_INPUTS_DELTA = (R24_INTEROP_[A-Z0-9_]+_DELTA);$/gmu)];
  demand(aliases.length === 1, 'E_CURRENT_BINDINGS_DELTA_FORMAT');
  const name = aliases[0][1], start = `const ${name} = Object.freeze(`;
  demand(source.split(start).length === 2, 'E_CURRENT_BINDINGS_DELTA_FORMAT');
  const at = source.indexOf(start) + start.length, end = source.indexOf('\n});', at);
  demand(end > at, 'E_CURRENT_BINDINGS_DELTA_FORMAT');
  const raw = source.slice(at, end + 2), value = JSON.parse(raw);
  demand(JSON.stringify(value, null, 2) === raw, 'E_CURRENT_BINDINGS_DELTA_FORMAT');
  keys(value, ['id', 'successorBaseSha', 'successorBaseTree', 'bindings', 'guards']);
  demand(typeof value.id === 'string' && hex(value.successorBaseSha, 40) && hex(value.successorBaseTree, 40), 'E_CURRENT_BINDINGS_DELTA_IDENTITY');
  if (request) demand(value.id === request.taskId && value.successorBaseSha === request.bindingBaseSha && value.successorBaseTree === request.bindingBaseTree, 'E_CURRENT_BINDINGS_DELTA_IDENTITY');
  demand(Array.isArray(value.bindings) && value.bindings.length > 0 && value.bindings.length <= 2048, 'E_CURRENT_BINDINGS_DELTA_BINDINGS');
  const seen = new Set();
  for (const row of [...value.bindings, ...value.guards]) {
    keys(row, ['path', 'sha256']); relative(row.path);
    demand(hex(row.sha256, 64) && !seen.has(row.path) && row.path !== CERT, 'E_CURRENT_BINDINGS_DELTA_BINDINGS'); seen.add(row.path);
  }
  demand(same(value.guards.map(row => row.path), [POLICY]), 'E_CURRENT_BINDINGS_DELTA_GUARD');
  return { value, replace: next => source.slice(0, at) + JSON.stringify(next, null, 2) + source.slice(end + 2) };
}

// No write API is reachable from this function. Producers consume one future-byte
// view; all target and protected-format checks finish before an apply can start.
function plan(rootDir, rawRequest) {
  const request = validateRequest(rawRequest), root = path.resolve(rootDir);
  demand(fs.realpathSync(root) === root && fs.lstatSync(root).isDirectory(), 'E_CURRENT_BINDINGS_ROOT');
  const initialIdentity = identity(root, request), snapshots = new Map(), outputs = new Map(); let total = 0;
  const read = name => {
    relative(name);
    if (outputs.has(name)) return outputs.get(name);
    if (!snapshots.has(name)) {
      const item = safeFile(root, name); total += item.bytes.length;
      demand(total <= MAX_TOTAL && snapshots.size < 4096, 'E_CURRENT_BINDINGS_INPUT_BUDGET'); snapshots.set(name, item);
    }
    return snapshots.get(name).bytes;
  };
  const json = (name, style = 'canonical') => {
    const bytes = read(name), value = JSON.parse(bytes.toString('utf8'));
    demand(bytes.equals(style === 'pretty' ? pretty(value) : canonicalBytes(value)), 'E_CURRENT_BINDINGS_JSON_FORMAT', name); return value;
  };
  for (const name of TARGETS) demand(sha256(read(name)) === request.expectedOld[name], 'E_CURRENT_BINDINGS_EXPECTED_OLD', name);
  const oldInventory = json(INV); demand(oldInventory.schemaVersion === 'R24_C1B_TEST_INVENTORY_V1', 'E_CURRENT_BINDINGS_INVENTORY_VERSION');
  for (const name of listTestFiles(root)) read(name);
  const inventory = buildInventory(root), validation = validateInventory(root, inventory);
  demand(validation.ok, 'E_CURRENT_BINDINGS_INVENTORY_INVALID', validation.failures.join(','));
  keys(oldInventory, Object.keys(inventory)); keys(oldInventory.totals, Object.keys(inventory.totals));
  demand(same(oldInventory.discovery, inventory.discovery) && oldInventory.inventoryId === inventory.inventoryId
    && oldInventory.classificationStage === inventory.classificationStage, 'E_CURRENT_BINDINGS_INVENTORY_FORMAT');
  const nextByPath = new Map(inventory.entries.map(row => [row.path, row]));
  for (const row of oldInventory.entries) {
    const next = nextByPath.get(row.path); demand(next, 'E_CURRENT_BINDINGS_INVENTORY_REMOVAL', row.path);
    demand(same({ ...row, sha256: '', skipSites: 0 }, { ...next, sha256: '', skipSites: 0 }), 'E_CURRENT_BINDINGS_INVENTORY_POLICY', row.path);
  }
  for (const row of inventory.entries) demand(sha256(read(row.path)) === row.sha256, 'E_CURRENT_BINDINGS_TEST_CHANGED', row.path);
  outputs.set(INV, canonicalBytes(inventory));
  const oldApprovals = json(APPROVALS), approvals = buildApprovals(root, { readBytes: read });
  demand(same(withoutApprovalDigests(oldApprovals), withoutApprovalDigests(approvals)), 'E_CURRENT_BINDINGS_APPROVAL_HISTORY');
  outputs.set(APPROVALS, canonicalBytes(approvals));
  const oldManifest = json(MANIFEST), manifest = buildManifest({ repoRoot: root, readBytes: read });
  demand(oldManifest.claims.length > 0 && same(withoutManifestDigests(oldManifest), withoutManifestDigests(manifest)), 'E_CURRENT_BINDINGS_MANIFEST_HISTORY');
  outputs.set(MANIFEST, canonicalBytes(manifest));
  const oldClaims = json(CLAIMS), claims = buildClaimBindings({ repoRoot: root, manifest, readBytes: read });
  demand(same(withoutClaimDigests(oldClaims), withoutClaimDigests(claims)), 'E_CURRENT_BINDINGS_CLAIM_HISTORY');
  outputs.set(CLAIMS, canonicalBytes(claims));
  const policy = json(POLICY, 'pretty'); demand(policy.schemaVersion === 'YALKEN_INTEROP_DATA_C1_POLICY_V1', 'E_CURRENT_BINDINGS_POLICY_VERSION');
  demand(Array.isArray(policy.admittedPaths) && Array.isArray(policy.protectedFiles) && Array.isArray(policy.qualifiedRuntimeRepair?.sourceBindings), 'E_CURRENT_BINDINGS_POLICY_FORMAT');
  const basePolicy = JSON.parse(git(root, ['show', request.bindingBaseSha + ':' + POLICY]));
  const policyHistory = value => { const v = structuredClone(value); v.admittedPaths = []; v.qualifiedRuntimeRepair.sourceBindings = []; return v; };
  demand(same(policyHistory(policy), policyHistory(basePolicy)), 'E_CURRENT_BINDINGS_POLICY_HISTORY');
  demand(basePolicy.admittedPaths.every(name => policy.admittedPaths.includes(name))
    && basePolicy.qualifiedRuntimeRepair.sourceBindings.every(row => policy.qualifiedRuntimeRepair.sourceBindings.some(next => next.path === row.path)), 'E_CURRENT_BINDINGS_POLICY_REMOVAL');
  demand(sha256(read('scripts/ops/rtk-interop-data-c1-readback.py')) === policy.rawCheckerSha256, 'E_CURRENT_BINDINGS_RAW_CHECKER_PIN');
  paths(policy.admittedPaths, 2048);
  for (const row of policy.protectedFiles) {
    demand(hex(row.sha256, 64) && sha256(read(row.path)) === row.sha256, 'E_CURRENT_BINDINGS_PROTECTED_FILE');
  }
  const protectedPaths = new Set(policy.protectedFiles.map(row => row.path));
  const sources = policy.qualifiedRuntimeRepair.sourceBindings;
  demand(new Set(sources.map(row => row.path)).size === sources.length, 'E_CURRENT_BINDINGS_SOURCE_DUPLICATE');
  for (const name of request.additionalAdmittedPaths) if (!policy.admittedPaths.includes(name)) { read(name); policy.admittedPaths.push(name); }
  for (const name of request.additionalSourcePaths) {
    demand(!protectedPaths.has(name) && ![POLICY, DATA, CERT].includes(name), 'E_CURRENT_BINDINGS_SOURCE_CYCLE', name);
    if (!sources.some(row => row.path === name)) sources.push({ path: name, sha256: '0'.repeat(64) });
  }
  for (const row of sources) {
    keys(row, ['path', 'sha256']); demand(hex(row.sha256, 64) && ![POLICY, DATA, CERT].includes(row.path), 'E_CURRENT_BINDINGS_SOURCE_CYCLE', row.path);
    row.sha256 = sha256(read(row.path));
  }
  outputs.set(POLICY, pretty(policy));
  const data = read(DATA).toString('utf8');
  const pins = [...data.matchAll(/^export const DATA_POLICY_SHA256='([a-f0-9]{64})';$/gmu)];
  const arrays = [...data.matchAll(/^const DATA_ADMITTED_PATHS=(\[.*\]);$/gmu)];
  demand(pins.length === 1 && arrays.length === 1 && pins[0][1] === request.expectedOld[POLICY]
    && same(JSON.parse(arrays[0][1]), JSON.parse(snapshots.get(POLICY).bytes).admittedPaths), 'E_CURRENT_BINDINGS_DATA_FORMAT');
  outputs.set(DATA, Buffer.from(data.replace(pins[0][0], `export const DATA_POLICY_SHA256='${sha256(outputs.get(POLICY))}';`)
    .replace(arrays[0][0], `const DATA_ADMITTED_PATHS=${JSON.stringify(policy.admittedPaths)};`)));
  const selected = selectedDelta(read(CERT).toString('utf8'), request);
  const baseCert = git(root, ['show', request.bindingBaseSha + ':' + CERT]), inherited = selectedDelta(baseCert).value;
  const currentPaths = new Set(selected.value.bindings.map(row => row.path));
  for (const row of inherited.bindings) demand(currentPaths.has(row.path), 'E_CURRENT_BINDINGS_INHERITED_BINDING_MISSING', row.path);
  for (const name of [...request.additionalAdmittedPaths, ...request.additionalSourcePaths]) {
    demand(currentPaths.has(name), 'E_CURRENT_BINDINGS_ADDITION_UNBOUND', name);
  }
  for (const row of [...selected.value.bindings, ...selected.value.guards]) row.sha256 = sha256(read(row.path));
  outputs.set(CERT, Buffer.from(selected.replace(selected.value)));
  demand(same(identity(root, request), initialIdentity), 'E_CURRENT_BINDINGS_IDENTITY_CHANGED');
  for (const [name, old] of snapshots) demand(same(safeFile(root, name).record, old.record), 'E_CURRENT_BINDINGS_INPUT_CHANGED', name);
  const inputBindings = [...snapshots.values()].map(row => row.record).sort((a, b) => a.path.localeCompare(b.path, 'en-US'));
  const changes = TARGETS.map(name => ({ path: name, beforeSha256: request.expectedOld[name], afterSha256: sha256(outputs.get(name)), bytes: outputs.get(name).length, changed: !outputs.get(name).equals(snapshots.get(name).bytes) }));
  const proposal = { schemaVersion: 'YALKEN_CURRENT_BINDINGS_PROPOSAL_V1', authority: 'NONE_DERIVED_METADATA_ONLY', taskId: request.taskId,
    identity: initialIdentity, bindingBaseSha: request.bindingBaseSha, bindingBaseTree: request.bindingBaseTree,
    requestSha256: sha256(canonicalBytes(request)), inheritedCertificationSourceSha256: sha256(Buffer.from(baseCert)),
    inputBindings, inputBindingsSha256: sha256(canonicalBytes(inputBindings)), changes,
    wholeSetAtomic: false, nonCooperatingWriterCas: false, releaseAcceptance: false };
  return { request, root, snapshots, outputs, proposal, proposalSha256: sha256(canonicalBytes(proposal)) };
}

export function prepareCurrentBindings(root, request) {
  const result = plan(root, request); return { proposal: result.proposal, proposalSha256: result.proposalSha256 };
}
function plainDirectory(absolute) {
  demand(path.isAbsolute(absolute) && !/[\u0000-\u001f\u007f]/u.test(absolute), 'E_CURRENT_BINDINGS_EXTERNAL_PATH');
  const parsed = path.parse(absolute); let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    demand(part !== '.' && part !== '..', 'E_CURRENT_BINDINGS_EXTERNAL_PATH');
    current = path.join(current, part); const s = fs.lstatSync(current);
    demand(s.isDirectory() && !s.isSymbolicLink(), 'E_CURRENT_BINDINGS_SYMLINK', absolute);
  }
  return fs.realpathSync(current);
}
export function applyCurrentBindings(root, request, proposalSha256, { journalPath } = {}) {
  demand(process.platform !== 'win32', 'E_CURRENT_BINDINGS_PLATFORM_DURABILITY_UNSUPPORTED');
  demand(hex(proposalSha256, 64), 'E_CURRENT_BINDINGS_PROPOSAL_PIN');
  const p = plan(root, request); demand(p.proposalSha256 === proposalSha256, 'E_CURRENT_BINDINGS_PROPOSAL_CHANGED');
  demand(typeof journalPath === 'string' && path.isAbsolute(journalPath), 'E_CURRENT_BINDINGS_JOURNAL_PATH');
  const parent = plainDirectory(path.dirname(journalPath));
  demand(parent !== p.root && !parent.startsWith(p.root + path.sep) && fs.lstatSync(parent).isDirectory(), 'E_CURRENT_BINDINGS_JOURNAL_OUTSIDE_REPO');
  const journal = path.join(parent, path.basename(journalPath));
  demand(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(path.basename(journal)), 'E_CURRENT_BINDINGS_JOURNAL_PATH');
  const fd = fs.openSync(journal, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW, 0o600);
  const emit = row => { fs.writeFileSync(fd, JSON.stringify(row) + '\n'); fs.fsyncSync(fd); };
  const lock = path.resolve(p.root, git(p.root, ['rev-parse', '--git-path', 'current-bindings-finalizer.lock']).trim());
  let lockFd, lockStat, lockBytes, activePath = null, state = 'NO_TARGET_WRITTEN'; const completed = [];
  try {
    emit({ event: 'BEGIN', proposal: p.proposal, proposalSha256, wholeSetAtomic: false, nonCooperatingWriterCas: false });
    lockFd = fs.openSync(lock, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    lockStat = fs.fstatSync(lockFd); lockBytes = canonicalBytes({ taskId: request.taskId, proposalSha256, pid: process.pid });
    fs.writeFileSync(lockFd, lockBytes); fs.fsyncSync(lockFd);
    for (const change of p.proposal.changes) {
      activePath = change.path; state = 'BEFORE_TARGET_WRITE';
      demand(same(identity(p.root, request), p.proposal.identity), 'E_CURRENT_BINDINGS_IDENTITY_CHANGED');
      for (const [name, old] of p.snapshots) demand(same(safeFile(p.root, name).record, old.record), 'E_CURRENT_BINDINGS_INPUT_CHANGED', name);
      if (!change.changed) { emit({ event: 'UNCHANGED', ...change }); continue; }
      const target = path.join(p.root, change.path), previous = p.snapshots.get(change.path);
      const temporary = path.join(path.dirname(target), '.' + path.basename(target) + '.' + randomUUID() + '.tmp');
      const tempFd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try { fs.writeFileSync(tempFd, p.outputs.get(change.path)); fs.fchmodSync(tempFd, Number(previous.record.identity[2]) & 0o7777); fs.fsyncSync(tempFd); }
      finally { fs.closeSync(tempFd); }
      demand(same(safeFile(p.root, change.path).record, previous.record), 'E_CURRENT_BINDINGS_EXPECTED_OLD', change.path);
      emit({ event: 'REPLACE_INTENT', ...change, temporary });
      fs.renameSync(temporary, target); state = 'RENAMED_DURABILITY_UNKNOWN';
      emit({ event: 'RENAMED', ...change, durability: 'UNKNOWN_UNTIL_DIRECTORY_FSYNC_AND_READBACK' });
      const directory = fs.openSync(path.dirname(target), fs.constants.O_RDONLY);
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
      const now = safeFile(p.root, change.path);
      demand(now.record.sha256 === change.afterSha256 && now.record.identity[2] === previous.record.identity[2], 'E_CURRENT_BINDINGS_WRITE_READBACK', change.path);
      p.snapshots.set(change.path, now); state = 'DURABLE_AND_READ_BACK'; completed.push(change.path);
      emit({ event: 'DURABLE', ...change });
    }
    emit({ event: 'COMPLETE', proposalSha256, completed, releaseAcceptance: false });
    return { status: 'APPLIED_METADATA_ONLY', proposalSha256, completed, journal, releaseAcceptance: false };
  } catch (error) {
    try { emit({ event: 'FAILED', path: activePath, actualState: state, completed, error: String(error.message), rollbackPerformed: false }); }
    catch (journalError) { error.message += ';JOURNAL_WRITE_UNAVAILABLE:' + journalError.message; }
    throw error;
  } finally {
    try {
      if (lockFd !== undefined) {
        fs.closeSync(lockFd);
        const actual = fs.lstatSync(lock);
        demand(actual.dev === lockStat.dev && actual.ino === lockStat.ino && actual.nlink === 1 && !actual.isSymbolicLink()
          && fs.readFileSync(lock).equals(lockBytes), 'E_CURRENT_BINDINGS_LOCK_OWNER_CHANGED');
        fs.unlinkSync(lock); // Only this invocation's newly created cooperative lock.
      }
    } catch (error) {
      try { emit({ event: 'LOCK_RELEASE_FAILED', completed, error: String(error.message) }); }
      catch (journalError) { error.message += ';JOURNAL_WRITE_UNAVAILABLE:' + journalError.message; }
      throw error;
    } finally { fs.closeSync(fd); }
  }
}

export function readFinalizerRequest(filename, expectedSha256) {
  demand(path.isAbsolute(filename) && hex(expectedSha256, 64), 'E_CURRENT_BINDINGS_REQUEST_PIN');
  const parent = plainDirectory(path.dirname(filename)), target = path.join(parent, path.basename(filename)), stat = fs.lstatSync(target);
  demand(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 65536, 'E_CURRENT_BINDINGS_REQUEST_FILE');
  const bytes = fs.readFileSync(target); demand(sha256(bytes) === expectedSha256, 'E_CURRENT_BINDINGS_REQUEST_PIN');
  const request = JSON.parse(bytes.toString('utf8'));
  demand(bytes.equals(canonicalBytes(request)), 'E_CURRENT_BINDINGS_REQUEST_CANONICAL');
  return validateRequest(request);
}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    const [mode, ...args] = process.argv.slice(2); demand(['prepare', 'apply'].includes(mode) && args.length % 2 === 0, 'E_CURRENT_BINDINGS_USAGE');
    const options = Object.create(null);
    for (let i = 0; i < args.length; i += 2) {
      demand(['--request', '--request-sha256', '--proposal-sha256', '--journal'].includes(args[i]) && !Object.hasOwn(options, args[i]), 'E_CURRENT_BINDINGS_USAGE'); options[args[i]] = args[i + 1];
    }
    demand(typeof options['--request'] === 'string' && typeof options['--request-sha256'] === 'string'
      && (mode === 'apply' || (!options['--proposal-sha256'] && !options['--journal'])), 'E_CURRENT_BINDINGS_USAGE');
    const request = readFinalizerRequest(options['--request'], options['--request-sha256']);
    const result = mode === 'prepare' ? prepareCurrentBindings(process.cwd(), request)
      : applyCurrentBindings(process.cwd(), request, options['--proposal-sha256'], { journalPath: options['--journal'] });
    process.stdout.write(canonicalBytes(result));
  } catch (error) { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; }
}

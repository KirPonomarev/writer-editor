'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { durableSaveTransaction } = require('../core/save-coordinator-v1.cjs');
const { executeAtomicSingleFileGatewayCutover, ATOMIC_SINGLE_FILE_TARGET_ROLES, OBSERVER_IDS,
  SAVE_AUTHORITY_ROUTES, createAuthorityObservation } = require('../core/legacy-strangler-v1.cjs');

const FILE_NAME = 'design-os-environment-epochs-v2.json';
const LEGACY_FILE_NAME = 'design-os-environment-epochs.json';
const MAX_BYTES = 2097152;
const fail = code => { throw Object.assign(Error(code), { code }); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let modelPromise;
const model = () => modelPromise ||= import(pathToFileURL(path.join(__dirname, '../renderer/design-os/designOsEnvironmentEpochs.mjs')).href);

function exact(input, expected) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
  return keys.length === expected.length && keys.every(key => typeof key === 'string' && expected.includes(key)
    && descriptors[key].enumerable && Object.hasOwn(descriptors[key], 'value'));
}
function validateRequest(command, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))) fail('E_FULL_ENV_PAYLOAD_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !descriptors[key].enumerable
    || !Object.hasOwn(descriptors[key], 'value'))) fail('E_FULL_ENV_PAYLOAD_INVALID');
  const common = ['version', 'expectedRevision', 'expectedStateDigest', 'expectedConfigurationGeneration', 'expectedFormGeneration'];
  let extra;
  if (command === 'CAPTURE') extra = payload?.kind === 'EPOCH' ? ['kind'] : payload?.kind === 'PRESET' ? ['kind', 'name'] : null;
  else if (command === 'RESTORE') extra = ['source'];
  else if (command === 'COMMIT') extra = ['SYNC_CURRENT', 'HYDRATE'].includes(payload?.kind) ? ['kind']
    : ['CONFIRM_APPLY', 'ABANDON_APPLY'].includes(payload?.kind) ? ['kind', 'operationId'] : null;
  if (!extra || !exact(payload, [...common, ...extra]) || payload.version !== 2
    || !['expectedRevision', 'expectedConfigurationGeneration', 'expectedFormGeneration'].every(key => Number.isSafeInteger(payload[key]) && payload[key] >= 0)
    || typeof payload.expectedStateDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(payload.expectedStateDigest)) fail('E_FULL_ENV_PAYLOAD_INVALID');
  if (command === 'RESTORE' && (!exact(payload.source, ['kind', 'id'])
    || !['EPOCH', 'PRESET', 'LEGACY', 'RESET', 'LAST_STABLE', 'PROFILE'].includes(payload.source.kind)
    || (payload.source.kind === 'PROFILE' ? !['BASELINE', 'FOCUS', 'COMPACT'].includes(payload.source.id)
      : ['RESET', 'LAST_STABLE'].includes(payload.source.kind) ? payload.source.id !== null
      : typeof payload.source.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(payload.source.id)))) fail('E_FULL_ENV_PAYLOAD_INVALID');
  if (payload.kind === 'PRESET' && (typeof payload.name !== 'string' || !payload.name || payload.name.length > 80
    || payload.name !== payload.name.trim() || payload.name !== payload.name.normalize('NFC') || /[\u0000-\u001f\u007f]/u.test(payload.name))) fail('E_FULL_ENV_PAYLOAD_INVALID');
  if (extra.includes('operationId') && (typeof payload.operationId !== 'string'
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(payload.operationId))) fail('E_FULL_ENV_PAYLOAD_INVALID');
}

// Specific successor of EnvironmentEpochPort. The caller supplies trusted Main
// lifecycle/capability and native adapters; no external payload chooses a path.
function createFullEnvironmentEpochPort(options) {
  const { directory, projectId, assertCurrent, readLive, validateAvailability, applyWindow } = options;
  if (!path.isAbsolute(directory) || typeof projectId !== 'string' || !projectId
    || ![assertCurrent, readLive, validateAvailability, applyWindow].every(value => typeof value === 'function')) fail('E_FULL_ENV_PORT_INVALID');
  const io = options.fsAdapter || fsp, filePath = path.join(directory, FILE_NAME);
  const originalDirectory = directoryIdentity();
  let source = null, ownBytes = null, publishedIdentity = null, published = false, publicationAttempted = false, requiresClean = false;
  function directoryIdentity() {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('E_FULL_ENV_DIRECTORY_INVALID');
    return { dev: stat.dev, ino: stat.ino, real: fs.realpathSync(directory) };
  }
  const equalIdentity = (a, b) => a === null ? b === null : b !== null && a.dev === b.dev && a.ino === b.ino;
  function readBytes(target = filePath, maxBytes = MAX_BYTES) {
    let named;
    try { named = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return { raw: null, identity: null }; throw error; }
    if (!named.isFile() || named.isSymbolicLink() || named.nlink !== 1 || named.size > maxBytes) fail('E_FULL_ENV_FILE_INVALID');
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const before = fs.fstatSync(fd, { bigint: true });
      if (!before.isFile() || before.nlink !== 1n || before.dev !== BigInt(named.dev) || before.ino !== BigInt(named.ino)) fail('E_FULL_ENV_FILE_STALE');
      const bytes = Buffer.alloc(Math.min(maxBytes, named.size) + 1); let count, size = 0;
      do { count = fs.readSync(fd, bytes, size, bytes.length - size, null); size += count; } while (count && size < bytes.length);
      const after = fs.fstatSync(fd, { bigint: true }), current = fs.lstatSync(target);
      if (size > maxBytes || size !== Number(after.size) || before.size !== after.size || before.mtimeNs !== after.mtimeNs
        || before.ctimeNs !== after.ctimeNs || before.dev !== after.dev || before.ino !== after.ino
        || current.isSymbolicLink() || current.dev !== named.dev || current.ino !== named.ino) fail('E_FULL_ENV_FILE_STALE');
      return { raw: bytes.subarray(0, size), identity: { dev: named.dev, ino: named.ino } };
    } finally { fs.closeSync(fd); }
  }
  const digest = raw => hash(raw === null ? 'ABSENT_FULL_ENVIRONMENT_V2' : raw);
  function guard() {
    assertCurrent({ requiresClean });
    const directoryNow = directoryIdentity();
    if (!same(directoryNow, originalDirectory)) fail('E_FULL_ENV_DIRECTORY_STALE');
    if (source) {
      const actual = readBytes();
      const ownPublished = publicationAttempted && ownBytes && actual.raw?.equals(ownBytes) && equalIdentity(actual.identity, publishedIdentity);
      if (!ownPublished && (digest(actual.raw) !== source.stateDigest || !equalIdentity(actual.identity, source.identity))) fail('E_FULL_ENV_SOURCE_STALE');
      if (source.legacyOriginal) {
        const legacy = readBytes(path.join(directory, LEGACY_FILE_NAME), 65536);
        if (digest(legacy.raw) !== source.legacyOriginal.digest || !equalIdentity(legacy.identity, source.legacyOriginal.identity)) fail('E_FULL_ENV_LEGACY_SOURCE_STALE');
      }
    }
  }
  function snapshot(m) {
    const actual = readBytes(); let state, legacyOriginal = null;
    if (actual.raw === null) {
      const old = readBytes(path.join(directory, LEGACY_FILE_NAME), 65536);
      legacyOriginal = { digest: digest(old.raw), identity: old.identity };
      state = m.createFullEnvironmentState(old.raw === null ? {} : { legacyRaw: old.raw.toString('utf8'), legacySha256: hash(old.raw) });
    } else state = m.decodeFullEnvironmentState(actual.raw);
    if (state.legacy && hash(Buffer.from(state.legacy.raw)) !== state.legacy.sha256) fail('E_FULL_ENV_LEGACY_DIGEST');
    return { ...actual, state, stateDigest: digest(actual.raw), legacyOriginal };
  }
  async function live(m) {
    guard(); const value = await readLive(); guard();
    if (!exact(value, ['configuration', 'formGeneration', 'composing', 'authoringPending'])
      || !Number.isSafeInteger(value.formGeneration) || value.formGeneration < 0
      || typeof value.composing !== 'boolean' || typeof value.authoringPending !== 'boolean') fail('E_FULL_ENV_LIVE_INVALID');
    if (requiresClean && (value.composing || value.authoringPending)) fail('E_FULL_ENV_AUTHORING_BARRIER');
    const configuration = m.validateFullEnvironmentConfiguration(value.configuration);
    return { ...value, configuration };
  }
  function project(state) { return state.projects.find(row => row.projectId === projectId); }
  function projection(m, current, view) {
    const p = project(current.state);
    const available = typeof options.availability === 'function' ? options.availability() : {};
    return Object.freeze({ schemaVersion: m.FULL_ENV_SCHEMA, revision: current.state.revision, stateDigest: current.stateDigest,
      projectId, configurationGeneration: p?.generation || 0, formGeneration: view.formGeneration,
      liveConfiguration: view.configuration, current: p?.current || null, lastStable: p?.lastStable || null, pending: p?.pending || null,
      epochs: Object.freeze(current.state.epochs.filter(row => row.projectId === projectId)),
      presets: Object.freeze(current.state.presets.filter(row => row.projectId === projectId)),
      legacy: current.state.legacy,
      capacity: Object.freeze({ epochs: current.state.epochs.length, epochLimit: m.FULL_ENV_LIMITS.epochs,
        presets: current.state.presets.length, presetLimit: m.FULL_ENV_LIMITS.presets }),
      availability: Object.freeze({ capture: !p?.pending && available.capture !== false,
        restore: !p?.pending && !view.composing && !view.authoringPending && available.restore !== false,
        configure: !view.composing && !view.authoringPending && available.configure !== false }) });
  }
  function next(m, state, kind, patch = {}) {
    return m.transitionFullEnvironment(state, { kind, projectId, expectedRevision: state.revision,
      expectedGeneration: project(state)?.generation || 0, ...patch });
  }
  async function persist(m, state) {
    ownBytes = Buffer.from(m.encodeFullEnvironmentState(state)); const ownedTemps = new Map();
    const adapter = {
      open: async (target, flags) => {
        if (flags !== 'wx' || path.dirname(target) !== directory || !path.basename(target).startsWith(FILE_NAME + '.p2-') || !target.endsWith('.tmp')) fail('E_FULL_ENV_TEMP_INVALID');
        guard(); const handle = await io.open(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.nlink !== 1) fail('E_FULL_ENV_TEMP_INVALID');
          ownedTemps.set(target, { dev: stat.dev, ino: stat.ino }); guard();
        } catch (error) {
          await handle.close().catch(() => {});
          const owned = ownedTemps.get(target), actual = fs.existsSync(target) ? fs.lstatSync(target) : null;
          if (owned && actual?.isFile() && !actual.isSymbolicLink() && equalIdentity(owned, actual)) await io.unlink(target);
          throw error;
        }
        return new Proxy(handle, { get(object, key) {
          const method = object[key]; if (typeof method !== 'function') return method;
          if (key === 'close') return method.bind(object);
          return async (...args) => { try { guard(); const result = await method.apply(object, args); guard(); return result; }
            catch (error) { await object.close().catch(() => {}); throw error; } };
        } });
      },
      rename: async (from, to) => {
        if (!ownedTemps.has(from) || to !== filePath) fail('E_FULL_ENV_TARGET_INVALID');
        guard(); const prepared = readBytes(from);
        if (!equalIdentity(prepared.identity, ownedTemps.get(from)) || !prepared.raw?.equals(ownBytes)) fail('E_FULL_ENV_TEMP_STALE');
        guard(); publishedIdentity = prepared.identity; publicationAttempted = true;
        await io.rename(from, to); published = true; guard();
      },
      syncDirectory: async target => {
        if (target !== directory) fail('E_FULL_ENV_TARGET_INVALID');
        guard(); const handle = await io.open(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_DIRECTORY);
        try { guard(); const stat = await handle.stat(); guard();
          if (stat.dev !== originalDirectory.dev || stat.ino !== originalDirectory.ino) fail('E_FULL_ENV_DIRECTORY_STALE');
          await handle.sync(); guard(); } finally { await handle.close(); }
      },
      readFile: async target => { if (target !== filePath) fail('E_FULL_ENV_TARGET_INVALID'); guard(); const actual = readBytes(); guard(); return actual.raw; },
    };
    const observe = observerId => async identity => { guard(); return createAuthorityObservation({ observerId,
      requestDigest: identity.identityDigest, route: SAVE_AUTHORITY_ROUTES.ATOMIC_FILE_V1 }); };
    guard();
    return executeAtomicSingleFileGatewayCutover({ request: { filePath, content: ownBytes,
      targetRole: ATOMIC_SINGLE_FILE_TARGET_ROLES.SETTINGS_PRIMARY, projectId: null },
    observeLegacy: observe(OBSERVER_IDS.LEGACY), observeGateway: observe(OBSERVER_IDS.GATEWAY),
    executeGateway: async ({ authorityIdentity }) => { guard(); const result = await durableSaveTransaction({ filePath, content: ownBytes,
      revision: state.revision, fsAdapter: adapter }); guard();
      return { ...result, targetRole: authorityIdentity.targetRole, contentDigest: authorityIdentity.contentDigest }; } });
  }
  return Object.freeze({
    async read() { guard(); const m = await model(); guard(); source = snapshot(m); const view = await live(m); guard(); return projection(m, source, view); },
    async change(command, payload) {
      let m;
      try {
        // Validate closed intent before reading caller values or selecting effects.
        validateRequest(command, payload);
        requiresClean = command === 'RESTORE' || ['HYDRATE', 'CONFIRM_APPLY', 'ABANDON_APPLY'].includes(payload.kind);
        guard(); m = await model(); guard(); source = snapshot(m); const view = await live(m); guard();
        if (payload.expectedRevision !== source.state.revision || payload.expectedStateDigest !== source.stateDigest
          || payload.expectedConfigurationGeneration !== (project(source.state)?.generation || 0)
          || payload.expectedFormGeneration !== view.formGeneration) fail('E_FULL_ENV_STALE_REVISION');
        let state = source.state, target = null, operationId = null;
        if (command !== 'COMMIT' || payload.kind === 'SYNC_CURRENT') state = next(m, state, 'OBSERVE_CURRENT', { configuration: view.configuration });
        if (command === 'CAPTURE') state = payload.kind === 'EPOCH'
          ? next(m, state, 'CAPTURE', { epochId: crypto.randomUUID(), recordedAtUtc: new Date().toISOString() })
          : next(m, state, 'SAVE_PRESET', { presetId: crypto.randomUUID(), name: payload.name, recordedAtUtc: new Date().toISOString() });
        else if (command === 'RESTORE' || payload.kind === 'HYDRATE') {
          operationId = crypto.randomUUID();
          if (payload.kind === 'HYDRATE') state = next(m, state, 'STAGE_HYDRATE', { operationId });
          else state = next(m, state, 'STAGE_APPLY', { operationId, epochId: crypto.randomUUID(), recordedAtUtc: new Date().toISOString(), source: payload.source });
          target = project(state).pending.configuration; await validateAvailability(target); guard();
        } else if (payload.kind === 'CONFIRM_APPLY') {
          await validateAvailability(view.configuration); guard();
          state = next(m, state, 'CONFIRM_APPLY', { operationId: payload.operationId, observedConfiguration: view.configuration });
        }
        else if (payload.kind === 'ABANDON_APPLY') {
          state = next(m, state, 'ABANDON_APPLY', { operationId: payload.operationId });
          operationId = payload.operationId; target = project(state).current; await validateAvailability(target); guard();
        }
        if (state.revision === source.state.revision) return { ok: true, performed: false, settingsEnvironmentEpochs: projection(m, source, view) };
        const beforePublish = await live(m); guard();
        if (beforePublish.formGeneration !== view.formGeneration || !same(beforePublish.configuration, view.configuration)) fail('E_FULL_ENV_CONFIGURATION_STALE');
        const receipt = await persist(m, state); guard();
        const current = snapshot(m); guard();
        if (!current.raw?.equals(ownBytes)) fail('E_FULL_ENV_READBACK');
        if (target) { await applyWindow(target, operationId); guard(); }
        return { ok: true, performed: true, operationId, configuration: target,
          settingsEnvironmentEpochs: projection(m, current, view), receipt };
      } catch (error) {
        let current = null, unknown = false;
        if (ownBytes && m) { try { const actual = snapshot(m); if (actual.raw?.equals(ownBytes)) current = actual; } catch { unknown = true; } }
        const partial = published || current || publicationAttempted && unknown;
        return { ok: false, error: { code: partial ? 'E_FULL_ENV_PARTIAL' : error.code?.startsWith('E_FULL_ENV_') ? error.code : 'E_FULL_ENV_UNAVAILABLE',
          reason: typeof error?.code === 'string' ? error.code : 'E_FULL_ENV_UNAVAILABLE',
          ...(partial ? { details: { storageWritten: published || current ? true : null, applyAllowed: false,
            ...(current ? { revision: current.state.revision, stateDigest: current.stateDigest } : {}) } } : {}) } };
      }
    },
  });
}
module.exports = Object.freeze({ FILE_NAME, LEGACY_FILE_NAME, createFullEnvironmentEpochPort, validateRequest });

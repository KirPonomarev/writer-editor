export const DESIGN_OS_FORM_CONFIGURATION_SCHEMA_VERSION = 'yalken.designOsFormConfiguration.v1';
export const DESIGN_OS_FORM_CONFIGURATION_SNAPSHOT_SCHEMA_VERSION = 'yalken.designOsFormConfigurationSnapshot.v1';
export const DESIGN_OS_FORM_CONFIGURATION_LIFECYCLES = Object.freeze(['PENDING', 'STABLE']);
export const DESIGN_OS_FORM_CONFIGURATION_MAX_REVISION = Number.MAX_SAFE_INTEGER;
export const DESIGN_OS_FORM_CONFIGURATION_MAX_DEPTH = 16;
export const DESIGN_OS_FORM_CONFIGURATION_MAX_ENTRIES = 2048;
export const DESIGN_OS_FORM_CONFIGURATION_MAX_BYTES = 65536;

const CONFIGURATION_KEYS = Object.freeze([
  'commitPoint',
  'context',
  'designState',
  'layout',
  'lifecycle',
  'revision',
  'schemaVersion',
]);
const FORM_KEYS = Object.freeze(['context', 'designState', 'layout']);
const STAGE_KEYS = Object.freeze(['commitPoint', 'context', 'designState', 'expectedRevision', 'layout']);
const SNAPSHOT_KEYS = Object.freeze(['baseline', 'current', 'lastStable', 'schemaVersion']);
const CONTEXT_KEYS = Object.freeze(['accessibility', 'platform', 'profile', 'shell_mode', 'workspace']);
const LAYOUT_KEYS = Object.freeze([
  'bottom_height',
  'editor_root',
  'left_width',
  'right_collapsed',
  'right_expanded_width',
  'right_width',
  'shell_mode',
  'viewport_height',
  'viewport_width',
]);
const COMMIT_POINTS = Object.freeze([
  'apply',
  'drag_end',
  'resize_end',
  'workspace_save',
  'mode_switch',
  'safe_reset',
  'restore_last_stable',
  'app_close_debounced',
]);
const DANGEROUS_KEYS = Object.freeze(['__proto__', 'prototype', 'constructor']);

export class DesignOsFormConfigurationError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expectedKeys.length
    && keys.every((key, index) => key === expectedKeys[index]);
}

function assertValidUnicode(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new DesignOsFormConfigurationError('E_DESIGN_FORM_UNICODE', path);
      }
      index += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_UNICODE', path);
    }
  }
}

function normalizeString(value, path, { nonEmpty = false } = {}) {
  if (typeof value !== 'string') {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_STRING', path);
  }
  assertValidUnicode(value, path);
  const normalized = value.normalize('NFC');
  if (nonEmpty && !normalized.trim()) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_STRING_EMPTY', path);
  }
  return normalized;
}

function normalizeTree(value, path, budget, depth = 0) {
  if (depth > DESIGN_OS_FORM_CONFIGURATION_MAX_DEPTH) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_DEPTH', path);
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_NUMBER', path);
    }
    return value;
  }
  if (typeof value === 'string') return normalizeString(value, path);
  if (Array.isArray(value)) {
    budget.entries += value.length;
    if (budget.entries > DESIGN_OS_FORM_CONFIGURATION_MAX_ENTRIES) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_ENTRIES', path);
    }
    return value.map((entry, index) => normalizeTree(entry, `${path}[${index}]`, budget, depth + 1));
  }
  if (!isPlainObject(value)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_VALUE', path);
  }

  const out = {};
  const normalizedKeys = new Set();
  const keys = Object.keys(value).sort();
  budget.entries += keys.length;
  if (budget.entries > DESIGN_OS_FORM_CONFIGURATION_MAX_ENTRIES) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_ENTRIES', path);
  }
  for (const key of keys) {
    if (DANGEROUS_KEYS.includes(key)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_UNSAFE_KEY', path ? `${path}.${key}` : key);
    }
    const normalizedKey = normalizeString(key, path ? `${path}.${key}` : key, { nonEmpty: true });
    if (DANGEROUS_KEYS.includes(normalizedKey) || normalizedKeys.has(normalizedKey)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_KEY_COLLISION', normalizedKey);
    }
    normalizedKeys.add(normalizedKey);
    out[normalizedKey] = normalizeTree(
      value[key],
      path ? `${path}.${normalizedKey}` : normalizedKey,
      budget,
      depth + 1,
    );
  }
  return out;
}

function deepFreezeTree(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreezeTree(child);
  return Object.freeze(value);
}

function deepCopyTree(value) {
  if (Array.isArray(value)) return value.map((entry) => deepCopyTree(entry));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) out[key] = deepCopyTree(value[key]);
  return out;
}

function assertSerializedBudget(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > DESIGN_OS_FORM_CONFIGURATION_MAX_BYTES) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_BYTES', String(bytes));
  }
}

function normalizeRevision(value, { allowZero = false } = {}) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum || value > DESIGN_OS_FORM_CONFIGURATION_MAX_REVISION) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_REVISION');
  }
  return value;
}

function nextRevision(value) {
  const revision = normalizeRevision(value, { allowZero: true });
  if (revision >= DESIGN_OS_FORM_CONFIGURATION_MAX_REVISION) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_REVISION_EXHAUSTED');
  }
  return revision + 1;
}

function normalizeContext(value) {
  if (!hasExactKeys(value, CONTEXT_KEYS)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_CONTEXT_SHAPE');
  }
  return Object.freeze({
    shell_mode: normalizeString(value.shell_mode, 'context.shell_mode', { nonEmpty: true }),
    profile: normalizeString(value.profile, 'context.profile', { nonEmpty: true }),
    workspace: normalizeString(value.workspace, 'context.workspace', { nonEmpty: true }),
    platform: normalizeString(value.platform, 'context.platform', { nonEmpty: true }),
    accessibility: normalizeString(value.accessibility, 'context.accessibility', { nonEmpty: true }),
  });
}

function normalizeBoundedInteger(value, key, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_LAYOUT_VALUE', key);
  }
  return value;
}

function normalizeLayout(value) {
  if (!hasExactKeys(value, LAYOUT_KEYS)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_LAYOUT_SHAPE');
  }
  if (typeof value.right_collapsed !== 'boolean') {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_LAYOUT_VALUE', 'right_collapsed');
  }
  return Object.freeze({
    left_width: normalizeBoundedInteger(value.left_width, 'left_width', 0, 8192),
    right_width: normalizeBoundedInteger(value.right_width, 'right_width', 0, 8192),
    bottom_height: normalizeBoundedInteger(value.bottom_height, 'bottom_height', 0, 8192),
    editor_root: normalizeString(value.editor_root, 'layout.editor_root', { nonEmpty: true }),
    viewport_width: normalizeBoundedInteger(value.viewport_width, 'viewport_width', 320, 16384),
    viewport_height: normalizeBoundedInteger(value.viewport_height, 'viewport_height', 320, 16384),
    shell_mode: normalizeString(value.shell_mode, 'layout.shell_mode', { nonEmpty: true }),
    right_collapsed: value.right_collapsed,
    right_expanded_width: normalizeBoundedInteger(value.right_expanded_width, 'right_expanded_width', 0, 8192),
  });
}

function normalizeForm(value) {
  if (!hasExactKeys(value, FORM_KEYS)) throw new DesignOsFormConfigurationError('E_DESIGN_FORM_INPUT');
  const context = normalizeContext(value.context);
  const layout = normalizeLayout(value.layout);
  const budget = { entries: 0 };
  const designState = normalizeTree(value.designState, 'designState', budget);
  if (!isPlainObject(designState)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_STATE_SHAPE');
  }
  const form = { context, designState, layout };
  assertSerializedBudget(form);
  return form;
}

function createConfiguration({ revision, lifecycle, commitPoint, context, designState, layout }) {
  const normalizedRevision = normalizeRevision(revision, { allowZero: true });
  if (!DESIGN_OS_FORM_CONFIGURATION_LIFECYCLES.includes(lifecycle)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_LIFECYCLE');
  }
  if (!COMMIT_POINTS.includes(commitPoint)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_COMMIT_POINT');
  }
  const form = normalizeForm({ context, designState, layout });
  return deepFreezeTree({
    schemaVersion: DESIGN_OS_FORM_CONFIGURATION_SCHEMA_VERSION,
    revision: normalizedRevision,
    lifecycle,
    commitPoint,
    context: form.context,
    designState: form.designState,
    layout: form.layout,
  });
}

function assertConfiguration(value) {
  if (!hasExactKeys(value, CONFIGURATION_KEYS)) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_CONFIGURATION_SHAPE');
  }
  if (value.schemaVersion !== DESIGN_OS_FORM_CONFIGURATION_SCHEMA_VERSION) {
    throw new DesignOsFormConfigurationError('E_DESIGN_FORM_SCHEMA');
  }
  return createConfiguration(value);
}

function sameForm(left, right) {
  return JSON.stringify({ context: left.context, designState: left.designState, layout: left.layout })
    === JSON.stringify({ context: right.context, designState: right.designState, layout: right.layout });
}

function cloneConfiguration(value) {
  return createConfiguration(deepCopyTree(value));
}

function recoveryReceipt(performed, reason = 'NONE', sourceRevision = null, recoveredRevision = null) {
  return Object.freeze({ performed, reason, sourceRevision, recoveredRevision });
}

export function validateDesignOsFormConfiguration(value) {
  try {
    return Object.freeze({ ok: true, code: 'DESIGN_FORM_CONFIGURATION_VALID', configuration: assertConfiguration(value) });
  } catch (error) {
    return Object.freeze({
      ok: false,
      code: error instanceof DesignOsFormConfigurationError ? error.code : 'E_DESIGN_FORM_UNEXPECTED',
      configuration: null,
    });
  }
}

export class DesignOsFormConfigurationController {
  constructor(input = {}) {
    const baselineForm = normalizeForm(input.baseline);
    this.baseline = createConfiguration({
      revision: 0,
      lifecycle: 'STABLE',
      commitPoint: 'safe_reset',
      ...baselineForm,
    });
    this.current = this.baseline;
    this.lastStable = this.baseline;
    this.recovery = recoveryReceipt(false);

    if (input.snapshot !== undefined) {
      this.hydrateSnapshot(input.snapshot);
      return;
    }
    if (input.initial !== undefined) {
      const initialForm = normalizeForm(input.initial);
      if (!sameForm(this.baseline, initialForm)) {
        this.current = createConfiguration({
          revision: 1,
          lifecycle: 'STABLE',
          commitPoint: 'apply',
          ...initialForm,
        });
        this.lastStable = this.current;
      }
    }
  }

  hydrateSnapshot(snapshot) {
    if (!hasExactKeys(snapshot, SNAPSHOT_KEYS)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_SNAPSHOT_SHAPE');
    }
    if (snapshot.schemaVersion !== DESIGN_OS_FORM_CONFIGURATION_SNAPSHOT_SCHEMA_VERSION) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_SNAPSHOT_SCHEMA');
    }
    const baseline = assertConfiguration(snapshot.baseline);
    const lastStable = assertConfiguration(snapshot.lastStable);
    if (
      baseline.revision !== 0
      || baseline.lifecycle !== 'STABLE'
      || baseline.commitPoint !== 'safe_reset'
      || !sameForm(this.baseline, baseline)
    ) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_BASELINE');
    }
    if (lastStable.lifecycle !== 'STABLE') {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_LAST_STABLE');
    }
    if (lastStable.revision === 0 && !sameForm(lastStable, baseline)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_LAST_STABLE');
    }
    this.baseline = baseline;
    this.lastStable = lastStable;

    let current;
    try {
      current = assertConfiguration(snapshot.current);
    } catch (error) {
      const observedRevision = Number.isSafeInteger(snapshot.current?.revision)
        ? snapshot.current.revision
        : lastStable.revision;
      this.recoverToLastStable('CURRENT_INVALID', observedRevision);
      return;
    }
    if (current.revision < lastStable.revision) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_REVISION_ORDER');
    }
    if (current.lifecycle === 'PENDING') {
      this.current = current;
      this.recoverToLastStable('PENDING_AFTER_CRASH', current.revision);
      return;
    }
    if (current.revision !== lastStable.revision || !sameForm(current, lastStable)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_STABLE_SPLIT_BRAIN');
    }
    this.current = current;
  }

  assertExpectedRevision(expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== this.current.revision) {
      throw new DesignOsFormConfigurationError(
        'E_DESIGN_FORM_STALE_REVISION',
        `expected=${expectedRevision};actual=${this.current.revision}`,
      );
    }
  }

  stage(input = {}) {
    if (!hasExactKeys(input, STAGE_KEYS)) {
      throw new DesignOsFormConfigurationError('E_DESIGN_FORM_STAGE_SHAPE');
    }
    this.assertExpectedRevision(input.expectedRevision);
    const form = normalizeForm({
      context: input.context,
      designState: input.designState,
      layout: input.layout,
    });
    this.current = createConfiguration({
      revision: nextRevision(this.current.revision),
      lifecycle: 'PENDING',
      commitPoint: input.commitPoint,
      ...form,
    });
    return this.getCurrentConfiguration();
  }

  promoteStable(expectedRevision) {
    this.assertExpectedRevision(expectedRevision);
    if (this.current.lifecycle !== 'PENDING') return this.getCurrentConfiguration();
    this.current = createConfiguration({
      ...this.current,
      lifecycle: 'STABLE',
    });
    this.lastStable = this.current;
    return this.getCurrentConfiguration();
  }

  commit(input = {}) {
    const staged = this.stage(input);
    return this.promoteStable(staged.revision);
  }

  recoverToLastStable(reason, sourceRevision) {
    const recoveryBase = Math.max(
      this.lastStable.revision,
      Number.isSafeInteger(sourceRevision) && sourceRevision >= 0 ? sourceRevision : 0,
    );
    this.current = createConfiguration({
      revision: nextRevision(recoveryBase),
      lifecycle: 'STABLE',
      commitPoint: 'restore_last_stable',
      context: this.lastStable.context,
      designState: this.lastStable.designState,
      layout: this.lastStable.layout,
    });
    this.lastStable = this.current;
    this.recovery = recoveryReceipt(true, reason, sourceRevision, this.current.revision);
    return this.getCurrentConfiguration();
  }

  rollback(expectedRevision) {
    this.assertExpectedRevision(expectedRevision);
    if (this.current.lifecycle === 'STABLE') return this.getCurrentConfiguration();
    return this.recoverToLastStable('EXPLICIT_ROLLBACK', this.current.revision);
  }

  safeReset(expectedRevision) {
    this.assertExpectedRevision(expectedRevision);
    if (this.current.lifecycle === 'STABLE' && sameForm(this.current, this.baseline)) {
      return this.getCurrentConfiguration();
    }
    this.current = createConfiguration({
      revision: nextRevision(this.current.revision),
      lifecycle: 'STABLE',
      commitPoint: 'safe_reset',
      context: this.baseline.context,
      designState: this.baseline.designState,
      layout: this.baseline.layout,
    });
    this.lastStable = this.current;
    return this.getCurrentConfiguration();
  }

  getCurrentConfiguration() {
    return cloneConfiguration(this.current);
  }

  getLastStableConfiguration() {
    return cloneConfiguration(this.lastStable);
  }

  getRecoveryReceipt() {
    return Object.freeze({ ...this.recovery });
  }

  getSnapshot() {
    return deepFreezeTree({
      schemaVersion: DESIGN_OS_FORM_CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
      baseline: cloneConfiguration(this.baseline),
      current: cloneConfiguration(this.current),
      lastStable: cloneConfiguration(this.lastStable),
    });
  }
}

export function createDesignOsFormConfigurationController(input = {}) {
  return new DesignOsFormConfigurationController(input);
}

// Saved versions are a separate WP303 contract, not current/last-stable form.
export const ENVIRONMENT_EPOCH_HISTORY_SCHEMA_VERSION = 'yalken.designOsEnvironmentEpochHistory.v1';
export const ENVIRONMENT_EPOCH_CONFIGURATION_SCHEMA = 'THEME_WRAP_V1';
export const ENVIRONMENT_EPOCH_MAX_RECORDS = 128;
export const ENVIRONMENT_EPOCH_MAX_BYTES = 65536;
const ENVIRONMENT_EPOCH_HISTORY_KEYS = Object.freeze(['configurationSchema', 'epochs', 'revision', 'schemaVersion']);
const ENVIRONMENT_EPOCH_RECORD_KEYS = Object.freeze(['epochId', 'platform', 'preferences', 'reason', 'recordedAtUtc', 'revision', 'sourceEpochId']);
const ENVIRONMENT_EPOCH_APPEND_KEYS = Object.freeze(['epochId', 'expectedRevision', 'platform', 'preferences', 'reason', 'recordedAtUtc', 'sourceEpochId']);
const ENVIRONMENT_EPOCH_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

function environmentEpochRefuse(reason) {
  throw new DesignOsFormConfigurationError('E_ENVIRONMENT_EPOCH_' + reason);
}

function environmentEpochPreferences(value) {
  if (!hasExactKeys(value, ['theme', 'wordWrap']) || !['light', 'dark'].includes(value.theme)
    || typeof value.wordWrap !== 'boolean') environmentEpochRefuse('PREFERENCES_INVALID');
  return { theme: value.theme, wordWrap: value.wordWrap };
}

function environmentEpochHistory(value) {
  if (!hasExactKeys(value, ENVIRONMENT_EPOCH_HISTORY_KEYS)
    || value.schemaVersion !== ENVIRONMENT_EPOCH_HISTORY_SCHEMA_VERSION
    || value.configurationSchema !== ENVIRONMENT_EPOCH_CONFIGURATION_SCHEMA
    || !Array.isArray(value.epochs) || value.epochs.length > ENVIRONMENT_EPOCH_MAX_RECORDS
    || !Number.isSafeInteger(value.revision) || value.revision < 0
    || value.revision !== value.epochs.length) environmentEpochRefuse('HISTORY_INVALID');
  const prior = new Map();
  const epochs = value.epochs.map((row, index) => {
    if (!hasExactKeys(row, ENVIRONMENT_EPOCH_RECORD_KEYS) || row.revision !== index + 1
      || typeof row.epochId !== 'string' || !ENVIRONMENT_EPOCH_UUID.test(row.epochId) || prior.has(row.epochId)
      || row.platform !== 'macos' || !['CAPTURE', 'RESTORE'].includes(row.reason)
      || typeof row.recordedAtUtc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(row.recordedAtUtc)
      || !Number.isFinite(Date.parse(row.recordedAtUtc))
      || new Date(row.recordedAtUtc).toISOString() !== row.recordedAtUtc) environmentEpochRefuse('RECORD_INVALID');
    const preferences = environmentEpochPreferences(row.preferences);
    if (row.reason === 'CAPTURE' ? row.sourceEpochId !== null
      : typeof row.sourceEpochId !== 'string' || !prior.has(row.sourceEpochId)
        || JSON.stringify(preferences) !== JSON.stringify(prior.get(row.sourceEpochId).preferences)) environmentEpochRefuse('SOURCE_INVALID');
    const record = { epochId: row.epochId, revision: row.revision, recordedAtUtc: row.recordedAtUtc,
      platform: row.platform, reason: row.reason, sourceEpochId: row.sourceEpochId, preferences };
    prior.set(record.epochId, record); return record;
  });
  const history = { schemaVersion: ENVIRONMENT_EPOCH_HISTORY_SCHEMA_VERSION, configurationSchema: ENVIRONMENT_EPOCH_CONFIGURATION_SCHEMA,
    revision: value.revision, epochs };
  if (new TextEncoder().encode(JSON.stringify(history)).byteLength > ENVIRONMENT_EPOCH_MAX_BYTES) environmentEpochRefuse('BYTES');
  return deepFreezeTree(history);
}

// JSON.parse loses duplicate members. Walk the bounded JSON grammar first and
// compare decoded keys, including escaped spellings, before constructing state.
function environmentEpochValidateJson(text) {
  let cursor = 0, entries = 0;
  const space = () => { while (/[\t\n\r ]/u.test(text[cursor] || '\0')) cursor += 1; };
  const string = () => {
    const start = cursor; if (text[cursor++] !== '"') environmentEpochRefuse('JSON');
    while (cursor < text.length) {
      const character = text[cursor++];
      if (character === '\\') cursor += 1;
      else if (character === '"') return JSON.parse(text.slice(start, cursor));
    }
    environmentEpochRefuse('JSON');
  };
  const value = depth => {
    if (depth > DESIGN_OS_FORM_CONFIGURATION_MAX_DEPTH) environmentEpochRefuse('DEPTH');
    space(); const character = text[cursor];
    if (character === '{') {
      cursor += 1; space(); const keys = new Set();
      if (text[cursor] === '}') { cursor += 1; return; }
      while (cursor < text.length) {
        space(); const key = string();
        if (keys.has(key) || DANGEROUS_KEYS.includes(key)) environmentEpochRefuse('DUPLICATE_OR_UNSAFE_KEY');
        keys.add(key); entries += 1; if (entries > DESIGN_OS_FORM_CONFIGURATION_MAX_ENTRIES) environmentEpochRefuse('ENTRIES');
        space(); if (text[cursor++] !== ':') environmentEpochRefuse('JSON'); value(depth + 1); space();
        if (text[cursor] === '}') { cursor += 1; return; }
        if (text[cursor++] !== ',') environmentEpochRefuse('JSON');
      }
      environmentEpochRefuse('JSON');
    }
    if (character === '[') {
      cursor += 1; space(); if (text[cursor] === ']') { cursor += 1; return; }
      while (cursor < text.length) {
        entries += 1; if (entries > DESIGN_OS_FORM_CONFIGURATION_MAX_ENTRIES) environmentEpochRefuse('ENTRIES');
        value(depth + 1); space(); if (text[cursor] === ']') { cursor += 1; return; }
        if (text[cursor++] !== ',') environmentEpochRefuse('JSON');
      }
      environmentEpochRefuse('JSON');
    }
    if (character === '"') { string(); return; }
    const start = cursor;
    while (cursor < text.length && !/[\t\n\r ,\]}]/u.test(text[cursor])) cursor += 1;
    if (cursor === start) environmentEpochRefuse('JSON'); JSON.parse(text.slice(start, cursor));
  };
  value(0); space(); if (cursor !== text.length) environmentEpochRefuse('JSON');
}

export function createEnvironmentEpochHistory() {
  return environmentEpochHistory({ schemaVersion: ENVIRONMENT_EPOCH_HISTORY_SCHEMA_VERSION,
    configurationSchema: ENVIRONMENT_EPOCH_CONFIGURATION_SCHEMA, revision: 0, epochs: [] });
}

export function decodeEnvironmentEpochHistory(raw) {
  try {
    if (typeof raw !== 'string' && !(raw instanceof Uint8Array)) environmentEpochRefuse('RAW_INVALID');
    if (raw instanceof Uint8Array && raw.byteLength > ENVIRONMENT_EPOCH_MAX_BYTES) environmentEpochRefuse('BYTES');
    if (raw instanceof Uint8Array && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) environmentEpochRefuse('NONCANONICAL');
    const text = typeof raw === 'string' ? raw : new TextDecoder('utf-8', { fatal: true }).decode(raw);
    if (new TextEncoder().encode(text).byteLength > ENVIRONMENT_EPOCH_MAX_BYTES) environmentEpochRefuse('BYTES');
    assertValidUnicode(text, 'saved-settings'); environmentEpochValidateJson(text);
    const history = environmentEpochHistory(JSON.parse(text)), canonical = JSON.stringify(history);
    if (text !== canonical && text !== canonical + '\n') environmentEpochRefuse('NONCANONICAL');
    return history;
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('E_ENVIRONMENT_EPOCH_')) throw error;
    environmentEpochRefuse('DECODE_INVALID');
  }
}

export function appendEnvironmentEpoch(history, input) {
  const current = environmentEpochHistory(history);
  if (!hasExactKeys(input, ENVIRONMENT_EPOCH_APPEND_KEYS)) environmentEpochRefuse('APPEND_INVALID');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== current.revision) environmentEpochRefuse('STALE_REVISION');
  if (current.epochs.length >= ENVIRONMENT_EPOCH_MAX_RECORDS) environmentEpochRefuse('CAPACITY_NO_TRIM');
  return environmentEpochHistory({ ...current, revision: current.revision + 1, epochs: [...current.epochs, {
    epochId: input.epochId, revision: current.revision + 1, recordedAtUtc: input.recordedAtUtc,
    platform: input.platform, reason: input.reason, sourceEpochId: input.sourceEpochId, preferences: input.preferences,
  }] });
}

export function previewEnvironmentEpoch(history, epochId) {
  const current = environmentEpochHistory(history);
  const selected = current.epochs.find(row => row.epochId === epochId);
  if (!selected) environmentEpochRefuse('SOURCE_UNKNOWN');
  return selected;
}

import { decodeEnvironmentEpochHistory } from './designOsFormConfiguration.mjs';
import { deriveSidebarViewportMode } from './designOsShellController.mjs';
import projectIdDomain from '../../product/projectIdDomain.cjs';

export const FULL_CONFIG_SCHEMA = 'yalken.environmentConfiguration.v2';
export const FULL_ENV_SCHEMA = 'yalken.environmentEpochHistory.v2';
// Versioned storage vocabulary. Live availability is rechecked separately by
// Main, so removing a contribution cannot make its historical bytes unreadable.
export const FULL_ENV_V2_TOOLBAR_IDS = Object.freeze(['toolbar.font.family', 'toolbar.font.weight', 'toolbar.font.size', 'toolbar.text.lineHeight',
  'toolbar.format.bold', 'toolbar.format.italic', 'toolbar.format.underline', 'toolbar.paragraph.alignment', 'toolbar.list.type',
  'toolbar.insert.link', 'toolbar.insert.image', 'toolbar.color.text', 'toolbar.color.highlight', 'toolbar.review.comment',
  'toolbar.style.paragraph', 'toolbar.style.character', 'toolbar.history.undo', 'toolbar.history.redo']);
export const FULL_ENV_LIMITS = Object.freeze({ epochs: 128, presets: 32, projects: 32,
  configurationBytes: 16384, bytes: 2097152, depth: 16, entries: 262144 });
export const FULL_ENV_FONT_FAMILIES = Object.freeze([
  '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  '"Circe", -apple-system, system-ui, sans-serif', '"American Typewriter", Georgia, serif',
  "Palatino, 'Palatino Linotype', 'Book Antiqua', serif", 'Georgia, serif', "'Times New Roman', Times, serif",
  'Helvetica, Arial, sans-serif', 'Arial, sans-serif', '-apple-system, system-ui, sans-serif', "'Courier New', Courier, monospace",
]);
export const FULL_ENV_TOOLBAR_OFFSET_KEYS = Object.freeze(['font-select', 'weight-select', 'size-select', 'line-height-select',
  'format-bold', 'format-italic', 'format-underline', 'paragraph-trigger', 'list-type', 'insert-link', 'insert-image',
  'color-text', 'color-highlight', 'review-comment', 'style-paragraph', 'style-character', 'history-undo', 'history-redo']);
export const FULL_ENV_LEFT_OFFSET_KEYS = Object.freeze(['left-search-main', 'left-search-menu', 'left-new-main', 'left-open-doc', 'left-grid']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const encoder = new TextEncoder();
const fail = reason => { throw Object.assign(Error('E_FULL_ENV_' + reason), { code: 'E_FULL_ENV_' + reason }); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function unicode(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const n = text.charCodeAt(++i); if (!(n >= 0xdc00 && n <= 0xdfff)) fail('UNICODE'); }
    else if (c >= 0xdc00 && c <= 0xdfff) fail('UNICODE');
  }
  return text;
}
// Inspect descriptors before reading values; no getter, coercion or arbitrary
// tree from a caller becomes configuration or persistence authority.
function data(value, budget = { entries: 0, seen: new Set() }, depth = 0) {
  if (depth > FULL_ENV_LIMITS.depth) fail('DEPTH');
  if (typeof value === 'string') return unicode(value);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('NUMBER'); return value; }
  if (!value || typeof value !== 'object' || budget.seen.has(value)) fail('DATA');
  const array = Array.isArray(value);
  if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('OBJECT');
  budget.seen.add(value); const result = array ? [] : {}, descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (array && key === 'length') continue;
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)
      || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('UNSAFE_PROPERTY');
    if (++budget.entries > FULL_ENV_LIMITS.entries) fail('ENTRIES');
    if (array && (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) !== result.length)) fail('ARRAY');
    result[key] = data(descriptor.value, budget, depth + 1);
  }
  budget.seen.delete(value); if (array && result.length !== value.length) fail('ARRAY'); return result;
}
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SHAPE');
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some(key => !expected.includes(key))) fail('KEYS');
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
function enumeration(value, values, reason) { if (!values.includes(value)) fail(reason); return value; }
function bool(value) { if (typeof value !== 'boolean') fail('BOOLEAN'); return value; }
function numeric(value, min, max) { if (!number(value, min, max)) fail('NUMBER'); return value; }
function identity(value) { if (typeof value !== 'string' || !UUID.test(value)) fail('IDENTITY'); return value; }
function projectIdentity(value) {
  if (typeof value !== 'string' || !value || value.length > projectIdDomain.PROJECT_ID_MAX_CODE_UNITS
    || value !== value.trim() || /[\\/\u0000-\u001f]/u.test(value)) fail('PROJECT_ID');
  if (projectIdDomain.normalizeProjectId(value) !== value) fail('PROJECT_ID'); return value;
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('TIME'); return value;
}
function offsetList(value, allowed) {
  if (!Array.isArray(value) || value.length > allowed.length) fail('OFFSETS'); const seen = new Set();
  return value.map(row => { keys(row, ['key', 'value']);
    if (!allowed.includes(row.key) || seen.has(row.key)) fail('OFFSETS'); seen.add(row.key);
    return { key: row.key, value: numeric(row.value, -4096, 4096) }; });
}
function floating(value, left = false) {
  const shape = ['x', 'y', 'isVertical', 'isDetached', 'widthScale', ...(left ? [] : ['scale', 'dockedWidthScale', 'freeWidthScale', 'toolbarHeight'])];
  keys(value, shape);
  const result = { x: numeric(value.x, -32768, 32768), y: numeric(value.y, -32768, 32768),
    isVertical: bool(value.isVertical), isDetached: bool(value.isDetached) };
  if (!left) result.scale = numeric(value.scale, .5, 2);
  result.widthScale = numeric(value.widthScale, .1, 2);
  if (!left) Object.assign(result, { dockedWidthScale: numeric(value.dockedWidthScale, .1, 2),
    freeWidthScale: numeric(value.freeWidthScale, .1, 2), toolbarHeight: numeric(value.toolbarHeight, 0, 512) });
  return result;
}

export function validateFullEnvironmentConfiguration(input) {
  const x = data(input); keys(x, ['schemaVersion', 'workspace', 'shellMode', 'profile', 'keymap', 'composition', 'layout', 'presentation', 'window']);
  if (x.schemaVersion !== FULL_CONFIG_SCHEMA) fail('CONFIGURATION_VERSION');
  keys(x.composition, ['profile', 'toolbarIds', 'surfaces']); const ids = x.composition.toolbarIds, surfaces = x.composition.surfaces;
  if (!Array.isArray(ids) || ids.length > FULL_ENV_V2_TOOLBAR_IDS.length || new Set(ids).size !== ids.length
    || ids.some(id => !FULL_ENV_V2_TOOLBAR_IDS.includes(id))) fail('MISSING_CONTRIBUTION');
  if (!Array.isArray(surfaces) || new Set(surfaces).size !== surfaces.length || surfaces.length !== 3
    || surfaces.some(id => !['navigator', 'editor', 'inspector'].includes(id))) fail('MISSING_SURFACE');
  const l = x.layout; keys(l, ['leftWidth', 'rightWidth', 'leftCollapsed', 'rightCollapsed', 'leftTab', 'rightTab', 'toolbar', 'leftToolbar', 'toolbarOffsets', 'leftToolbarOffsets']);
  const p = x.presentation; keys(p, ['theme', 'wordWrap', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'viewMode', 'zoom', 'compact', 'previewEnabled', 'previewFrame']);
  const w = x.window; keys(w, ['displayId', 'x', 'y', 'width', 'height', 'viewportWidth', 'viewportHeight']);
  if (typeof w.displayId !== 'string' || !/^-?[0-9]{1,20}$/u.test(w.displayId)) fail('DISPLAY');
  const result = { schemaVersion: FULL_CONFIG_SCHEMA,
    workspace: enumeration(x.workspace, ['WRITE', 'PLAN', 'REVIEW'], 'WORKSPACE'),
    shellMode: enumeration(x.shellMode, ['CALM_DOCKED', 'COMPACT_DOCKED', 'SPATIAL_ADVANCED', 'SAFE_RECOVERY'], 'SHELL_MODE'),
    profile: enumeration(x.profile, ['BASELINE', 'SAFE', 'FOCUS', 'COMPACT'], 'PROFILE'), keymap: enumeration(x.keymap, ['NATIVE_V1'], 'KEYMAP'),
    composition: { profile: enumeration(x.composition.profile, ['minimal', 'master'], 'TOOLBAR_PROFILE'), toolbarIds: [...ids], surfaces: [...surfaces] },
    layout: { leftWidth: numeric(l.leftWidth, 120, 1200), rightWidth: numeric(l.rightWidth, 120, 1200),
      leftCollapsed: bool(l.leftCollapsed), rightCollapsed: bool(l.rightCollapsed),
      leftTab: enumeration(l.leftTab, ['project', 'outline', 'notes', 'search'], 'LEFT_TAB'),
      rightTab: enumeration(l.rightTab, ['inspector', 'history', 'comments', 'atlas'], 'RIGHT_TAB'),
      toolbar: floating(l.toolbar), leftToolbar: floating(l.leftToolbar, true),
      toolbarOffsets: offsetList(l.toolbarOffsets, FULL_ENV_TOOLBAR_OFFSET_KEYS), leftToolbarOffsets: offsetList(l.leftToolbarOffsets, FULL_ENV_LEFT_OFFSET_KEYS) },
    presentation: { theme: enumeration(p.theme, ['light', 'dark'], 'THEME'), wordWrap: bool(p.wordWrap),
      fontFamily: enumeration(p.fontFamily, FULL_ENV_FONT_FAMILIES, 'FONT'),
      fontWeight: enumeration(p.fontWeight, ['regular', 'light', 'semibold', 'bold', 'condensed', 'condensed-light', 'condensed-bold'], 'WEIGHT'),
      fontSize: numeric(p.fontSize, 9, 72), lineHeight: numeric(p.lineHeight, .5, 4),
      viewMode: enumeration(p.viewMode, ['default', 'focus'], 'VIEW_MODE'), zoom: numeric(p.zoom, .5, 2),
      compact: bool(p.compact), previewEnabled: bool(p.previewEnabled), previewFrame: bool(p.previewFrame) },
    window: { displayId: w.displayId, x: numeric(w.x, -32768, 32768), y: numeric(w.y, -32768, 32768),
      width: numeric(w.width, 320, 16384), height: numeric(w.height, 240, 16384),
      viewportWidth: numeric(w.viewportWidth, 240, 16384), viewportHeight: numeric(w.viewportHeight, 120, 16384) } };
  if (encoder.encode(JSON.stringify(result)).byteLength > FULL_ENV_LIMITS.configurationBytes) fail('CONFIGURATION_BYTES');
  return freeze(result);
}

export function createFullEnvironmentBaseline(configuration) {
  const x = data(validateFullEnvironmentConfiguration(configuration)), compact = x.window.viewportWidth < 1280;
  x.workspace = 'WRITE'; x.shellMode = compact ? 'COMPACT_DOCKED' : 'CALM_DOCKED'; x.profile = 'BASELINE';
  x.composition = { profile: 'minimal', toolbarIds: ['toolbar.font.family', 'toolbar.font.weight', 'toolbar.font.size',
    'toolbar.text.lineHeight', 'toolbar.paragraph.alignment', 'toolbar.history.undo', 'toolbar.history.redo'], surfaces: ['navigator', 'editor', 'inspector'] };
  x.layout = { leftWidth: compact ? 260 : 290, rightWidth: compact ? 260 : 290, leftCollapsed: false, rightCollapsed: false,
    leftTab: 'project', rightTab: 'inspector', toolbar: { x: 24, y: 92, isVertical: false, isDetached: false, scale: 1,
      widthScale: 1, dockedWidthScale: 1, freeWidthScale: 1, toolbarHeight: 40 },
    leftToolbar: { x: 24, y: 24, isVertical: false, isDetached: false, widthScale: 1 }, toolbarOffsets: [], leftToolbarOffsets: [] };
  x.presentation = { theme: 'light', wordWrap: true, fontFamily: FULL_ENV_FONT_FAMILIES[0], fontWeight: 'light', fontSize: 12,
    lineHeight: 1, viewMode: 'default', zoom: 1, compact: false, previewEnabled: false, previewFrame: false };
  return validateFullEnvironmentConfiguration(x);
}

export function createFullEnvironmentProfile(input, profile) {
  enumeration(profile, ['BASELINE', 'FOCUS', 'COMPACT'], 'PROFILE');
  const x = data(validateFullEnvironmentConfiguration(input));
  x.profile = profile; x.presentation.viewMode = profile === 'FOCUS' ? 'focus' : 'default';
  x.presentation.compact = profile === 'COMPACT';
  x.shellMode = x.layout.toolbar.isDetached || x.layout.leftToolbar.isDetached ? 'SPATIAL_ADVANCED'
    : x.presentation.compact || deriveSidebarViewportMode(x.window.viewportWidth) !== 'desktop' ? 'COMPACT_DOCKED' : 'CALM_DOCKED';
  return validateFullEnvironmentConfiguration(x);
}

function source(input, capture = false) {
  keys(input, ['kind', 'id']); const kind = enumeration(input.kind,
    ['EPOCH', 'LEGACY', 'PRESET', 'RESET', 'LAST_STABLE', 'PROFILE', ...(capture ? ['CAPTURE', 'CURRENT'] : [])], 'SOURCE');
  if (['RESET', 'LAST_STABLE', 'CAPTURE', 'CURRENT'].includes(kind)) { if (input.id !== null) fail('SOURCE'); }
  else if (kind === 'PROFILE') enumeration(input.id, ['BASELINE', 'FOCUS', 'COMPACT'], 'SOURCE');
  else identity(input.id);
  return { kind, id: input.id };
}
function legacySource(value) {
  if (value === null) return null; keys(value, ['schemaVersion', 'sha256', 'raw']);
  if (value.schemaVersion !== 'yalken.designOsEnvironmentEpochHistory.v1' || typeof value.sha256 !== 'string' || !HASH.test(value.sha256)
    || typeof value.raw !== 'string') fail('LEGACY');
  try { decodeEnvironmentEpochHistory(value.raw); } catch { fail('LEGACY'); }
  return { schemaVersion: value.schemaVersion, sha256: value.sha256, raw: value.raw };
}
function state(input) {
  const x = data(input); keys(x, ['schemaVersion', 'revision', 'projects', 'epochs', 'presets', 'legacy']);
  if (x.schemaVersion !== FULL_ENV_SCHEMA || !integer(x.revision)) fail('STATE_VERSION');
  for (const [key, limit] of [['projects', FULL_ENV_LIMITS.projects], ['epochs', FULL_ENV_LIMITS.epochs], ['presets', FULL_ENV_LIMITS.presets]])
    if (!Array.isArray(x[key]) || x[key].length > limit) fail('CAPACITY_NO_TRIM');
  const legacy = legacySource(x.legacy), projectIds = new Set(), presetIds = new Set(), names = new Set();
  const projects = x.projects.map(row => {
    keys(row, ['projectId', 'generation', 'current', 'lastStable', 'pending']); projectIdentity(row.projectId);
    if (projectIds.has(row.projectId) || !integer(row.generation, 1)) fail('PROJECT'); projectIds.add(row.projectId);
    let pending = null;
    if (row.pending !== null) { const p = row.pending; keys(p, ['operationId', 'epochId', 'generation', 'source', 'configuration']);
      identity(p.operationId); if (p.epochId !== null) identity(p.epochId);
      if (p.generation !== row.generation) fail('PENDING_GENERATION');
      pending = { operationId: p.operationId, epochId: p.epochId, generation: p.generation, source: source(p.source, true),
        configuration: validateFullEnvironmentConfiguration(p.configuration) };
    }
    return { projectId: row.projectId, generation: row.generation, current: validateFullEnvironmentConfiguration(row.current),
      lastStable: validateFullEnvironmentConfiguration(row.lastStable), pending };
  });
  const presets = x.presets.map(row => {
    keys(row, ['presetId', 'projectId', 'name', 'recordedAtUtc', 'configuration']); identity(row.presetId); projectIdentity(row.projectId);
    const key = row.projectId + ':' + row.name;
    if (!projectIds.has(row.projectId) || presetIds.has(row.presetId) || names.has(key) || typeof row.name !== 'string'
      || row.name !== row.name.trim() || row.name !== row.name.normalize('NFC') || !row.name || row.name.length > 80
      || /[\u0000-\u001f\u007f]/u.test(row.name) || encoder.encode(row.name).byteLength > 256) fail('PRESET');
    presetIds.add(row.presetId); names.add(key);
    return { presetId: row.presetId, projectId: row.projectId, name: row.name, recordedAtUtc: timestamp(row.recordedAtUtc),
      configuration: validateFullEnvironmentConfiguration(row.configuration) };
  });
  const prior = new Map(), last = new Map();
  const epochs = x.epochs.map((row, index) => {
    keys(row, ['epochId', 'sequence', 'recordedAtUtc', 'projectId', 'configurationGeneration', 'parentEpochId', 'operationId', 'source', 'configuration']);
    identity(row.epochId); projectIdentity(row.projectId);
    const project = projects.find(p => p.projectId === row.projectId);
    if (!project || prior.has(row.epochId) || row.sequence !== index + 1 || !integer(row.configurationGeneration, 1, project.generation)
      || row.parentEpochId !== (last.get(row.projectId) || null)) fail('EPOCH');
    const configuration = validateFullEnvironmentConfiguration(row.configuration), origin = source(row.source, true);
    if (origin.kind === 'CURRENT' || origin.kind === 'CAPTURE' && row.operationId !== null) fail('SOURCE');
    if (origin.kind !== 'CAPTURE') identity(row.operationId);
    if (origin.kind === 'PROFILE' && !same(createFullEnvironmentProfile(configuration, origin.id), configuration)) fail('SOURCE');
    if (origin.kind === 'EPOCH' && (!prior.has(origin.id) || prior.get(origin.id).projectId !== row.projectId
      || !same(prior.get(origin.id).configuration, configuration))) fail('SOURCE');
    if (origin.kind === 'PRESET' && !presets.some(p => p.presetId === origin.id && p.projectId === row.projectId && same(p.configuration, configuration))) fail('SOURCE');
    if (origin.kind === 'LEGACY') {
      const old = legacy && decodeEnvironmentEpochHistory(legacy.raw).epochs.find(p => p.epochId === origin.id);
      if (!old || old.preferences.theme !== configuration.presentation.theme || old.preferences.wordWrap !== configuration.presentation.wordWrap) fail('LEGACY_SOURCE');
    }
    const result = { epochId: row.epochId, sequence: row.sequence, recordedAtUtc: timestamp(row.recordedAtUtc), projectId: row.projectId,
      configurationGeneration: row.configurationGeneration, parentEpochId: row.parentEpochId, operationId: row.operationId, source: origin, configuration };
    prior.set(row.epochId, result); last.set(row.projectId, row.epochId); return result;
  });
  for (const p of projects) if (p.pending?.epochId !== null && p.pending
    && !epochs.some(e => e.epochId === p.pending.epochId && e.projectId === p.projectId && e.operationId === p.pending.operationId
      && same(e.configuration, p.pending.configuration))) fail('PENDING_SOURCE');
  const result = { schemaVersion: FULL_ENV_SCHEMA, revision: x.revision, projects, epochs, presets, legacy };
  if (encoder.encode(JSON.stringify(result)).byteLength + 1 > FULL_ENV_LIMITS.bytes) fail('BYTES'); return freeze(result);
}

export function createFullEnvironmentState(input = {}) {
  const x = data(input); if (Object.keys(x).length) keys(x, ['legacyRaw', 'legacySha256']);
  const legacy = x.legacyRaw == null ? null : { schemaVersion: 'yalken.designOsEnvironmentEpochHistory.v1', sha256: x.legacySha256, raw: x.legacyRaw };
  return state({ schemaVersion: FULL_ENV_SCHEMA, revision: 0, projects: [], epochs: [], presets: [], legacy });
}
export function encodeFullEnvironmentState(value) { return JSON.stringify(state(value)) + '\n'; }
export function decodeFullEnvironmentState(raw) {
  try {
    if (typeof raw !== 'string' && !(raw instanceof Uint8Array)) fail('RAW');
    if (raw instanceof Uint8Array && raw.byteLength > FULL_ENV_LIMITS.bytes) fail('BYTES');
    const text = typeof raw === 'string' ? unicode(raw) : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
    if (encoder.encode(text).byteLength > FULL_ENV_LIMITS.bytes || text.charCodeAt(0) === 0xfeff) fail('BYTES_OR_BOM');
    const result = state(JSON.parse(text)), canonical = JSON.stringify(result);
    if (text !== canonical && text !== canonical + '\n') fail('NONCANONICAL'); return result;
  } catch (error) { if (error?.code?.startsWith('E_FULL_ENV_')) throw error; fail('DECODE'); }
}
function differences(before, after, path = '') {
  if (same(before, after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after))
    return Object.keys(after).flatMap(key => differences(before[key], after[key], path ? path + '.' + key : key));
  return [{ path, before, after }];
}
export function diffFullEnvironmentConfigurations(before, after) {
  return freeze(differences(validateFullEnvironmentConfiguration(before), validateFullEnvironmentConfiguration(after)));
}
export function previewFullEnvironmentSource(input, projectId, selected) {
  const s = state(input); projectIdentity(projectId); const origin = source(data(selected));
  const p = s.projects.find(row => row.projectId === projectId); if (!p) fail('PROJECT_UNKNOWN');
  let configuration, warnings = [];
  if (origin.kind === 'RESET') configuration = createFullEnvironmentBaseline(p.current);
  else if (origin.kind === 'PROFILE') configuration = createFullEnvironmentProfile(p.current, origin.id);
  else if (origin.kind === 'LAST_STABLE') configuration = p.lastStable;
  else if (origin.kind === 'EPOCH') configuration = s.epochs.find(row => row.projectId === projectId && row.epochId === origin.id)?.configuration;
  else if (origin.kind === 'PRESET') configuration = s.presets.find(row => row.projectId === projectId && row.presetId === origin.id)?.configuration;
  else if (origin.kind === 'LEGACY') {
    const old = s.legacy && decodeEnvironmentEpochHistory(s.legacy.raw).epochs.find(row => row.epochId === origin.id);
    if (old) { const current = data(p.current); Object.assign(current.presentation, old.preferences);
      configuration = validateFullEnvironmentConfiguration(current); warnings = ['LEGACY_THEME_WRAP_ONLY_OTHER_CURRENT_FIELDS_RETAINED']; }
  }
  if (!configuration) fail('SOURCE_UNKNOWN');
  return freeze({ source: origin, configuration, changes: differences(p.current, configuration), warnings });
}

export function transitionFullEnvironment(input, request) {
  const s = state(input), r = data(request), base = ['kind', 'projectId', 'expectedRevision', 'expectedGeneration'];
  const extras = { OBSERVE_CURRENT: ['configuration'], CAPTURE: ['epochId', 'recordedAtUtc'], SAVE_PRESET: ['presetId', 'name', 'recordedAtUtc'],
    STAGE_APPLY: ['operationId', 'epochId', 'recordedAtUtc', 'source'], STAGE_HYDRATE: ['operationId'],
    CONFIRM_APPLY: ['operationId', 'observedConfiguration'], ABANDON_APPLY: ['operationId'] };
  if (!Object.hasOwn(extras, r.kind)) fail('OPERATION'); keys(r, [...base, ...extras[r.kind]]); projectIdentity(r.projectId);
  const index = s.projects.findIndex(p => p.projectId === r.projectId), p = s.projects[index];
  if (!integer(r.expectedRevision) || r.expectedRevision !== s.revision || !integer(r.expectedGeneration)
    || r.expectedGeneration !== (p?.generation || 0)) fail('STALE_REVISION');
  const next = data(s); let project = next.projects[index];
  if (r.kind === 'OBSERVE_CURRENT') {
    const configuration = validateFullEnvironmentConfiguration(r.configuration);
    if (p?.pending) fail('APPLY_PENDING');
    if (p && same(p.current, configuration)) return s;
    if (!p) { if (next.projects.length >= FULL_ENV_LIMITS.projects) fail('CAPACITY_NO_TRIM');
      next.projects.push({ projectId: r.projectId, generation: 1, current: configuration, lastStable: configuration, pending: null });
    } else Object.assign(project, { generation: p.generation + 1, current: configuration, lastStable: p.current });
  } else {
    if (!p) fail('PROJECT_UNKNOWN');
    if (p.pending && !['CONFIRM_APPLY', 'ABANDON_APPLY', 'STAGE_HYDRATE'].includes(r.kind)) fail('APPLY_PENDING');
    if (r.kind === 'SAVE_PRESET') {
      if (next.presets.length >= FULL_ENV_LIMITS.presets) fail('CAPACITY_NO_TRIM');
      next.presets.push({ presetId: r.presetId, projectId: r.projectId, name: r.name, recordedAtUtc: r.recordedAtUtc, configuration: p.current });
    } else if (['CAPTURE', 'STAGE_APPLY', 'STAGE_HYDRATE'].includes(r.kind)) {
      let configuration = p.current, origin = { kind: 'CAPTURE', id: null };
      if (r.kind === 'STAGE_APPLY') { const preview = previewFullEnvironmentSource(s, r.projectId, r.source); configuration = preview.configuration; origin = preview.source; }
      if (r.kind === 'STAGE_HYDRATE') origin = { kind: 'CURRENT', id: null };
      if (r.kind !== 'CAPTURE') { identity(r.operationId); project.generation++;
        project.pending = { operationId: r.operationId, epochId: r.kind === 'STAGE_HYDRATE' ? null : r.epochId,
          generation: project.generation, source: origin, configuration }; }
      if (r.kind !== 'STAGE_HYDRATE') {
        if (next.epochs.length >= FULL_ENV_LIMITS.epochs) fail('CAPACITY_NO_TRIM');
        next.epochs.push({ epochId: r.epochId, sequence: next.epochs.length + 1, recordedAtUtc: r.recordedAtUtc, projectId: r.projectId,
          configurationGeneration: project.generation, parentEpochId: [...s.epochs].reverse().find(e => e.projectId === r.projectId)?.epochId || null,
          operationId: r.kind === 'CAPTURE' ? null : r.operationId, source: origin, configuration });
      }
    } else {
      identity(r.operationId); if (!p.pending || p.pending.operationId !== r.operationId) fail('OPERATION_STALE');
      if (r.kind === 'CONFIRM_APPLY') {
        const observed = validateFullEnvironmentConfiguration(r.observedConfiguration);
        if (!same(observed, p.pending.configuration)) fail('HEALTH_MISMATCH');
        project.lastStable = p.current; project.current = p.pending.configuration;
      } else project.generation++;
      project.pending = null;
    }
  }
  next.revision++; return state(next);
}

export function canPublishFullEnvironment(expected, actual) {
  if (!expected || !actual || actual.capabilityAvailable !== true || actual.dirty !== false
    || actual.composing !== false || actual.authoringPending !== false) return false;
  return ['projectId', 'documentId', 'publicationId', 'editGeneration', 'formGeneration', 'requestId']
    .every(key => Object.hasOwn(expected, key) && expected[key] === actual[key]);
}

import { createHash } from 'node:crypto';

export const SCENE_BLOCK_OP = 'scene.block.admission';
export const SCENE_BLOCK_ALLOWED_TYPES = Object.freeze([
  'paragraph',
  'heading',
  'blockquote',
  'thematicBreak',
]);
export const SCENE_BLOCK_ALLOWED_FIELDS = Object.freeze([
  'id',
  'sceneId',
  'type',
  'text',
  'markRefs',
]);
export const SCENE_BLOCK_HASH_FIELDS = Object.freeze([
  'id',
  'sceneId',
  'type',
  'text',
  'markRefs',
]);
export const SCENE_BLOCK_HASH_EXCLUDED_FIELDS = Object.freeze([
  'unknownFields',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalSerialize(value) {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (valueType === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(',')}]`;
  }
  if (valueType === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(',')}}`;
  }
  return 'null';
}

function hashCanonical(value) {
  return createHash('sha256')
    .update(Buffer.from(canonicalSerialize(value), 'utf8'))
    .digest('hex');
}

function makeTypedError(code, reason, details) {
  const error = {
    code: String(code || 'E_SCENE_BLOCK_INVALID'),
    op: SCENE_BLOCK_OP,
    reason: String(reason || 'SCENE_BLOCK_INVALID'),
  };
  if (isPlainObject(details)) {
    error.details = cloneJson(details);
  }
  return error;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value) {
  return typeof value === 'string'
    ? value.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    : '';
}

function normalizeMarkRefs(value) {
  if (value === undefined) {
    return {
      ok: true,
      markRefs: [],
    };
  }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: makeTypedError(
        'E_SCENE_BLOCK_MARK_REFS_INVALID',
        'SCENE_BLOCK_MARK_REFS_INVALID',
      ),
    };
  }

  const normalized = [];
  for (const item of value) {
    const markRef = normalizeString(item);
    if (!markRef) {
      return {
        ok: false,
        error: makeTypedError(
          'E_SCENE_BLOCK_MARK_REFS_INVALID',
          'SCENE_BLOCK_MARK_REFS_INVALID',
        ),
      };
    }
    if (!normalized.includes(markRef)) {
      normalized.push(markRef);
    }
  }

  return {
    ok: true,
    markRefs: normalized,
  };
}

export function buildSceneBlockHashInput(source = {}) {
  const raw = isPlainObject(source) ? source : {};
  const type = normalizeString(raw.type);
  const hashInput = {
    id: normalizeString(raw.id),
    sceneId: normalizeString(raw.sceneId),
    type,
    markRefs: Array.isArray(raw.markRefs)
      ? raw.markRefs
        .map((markRef) => normalizeString(markRef))
        .filter(Boolean)
      : [],
  };
  if (type !== 'thematicBreak') {
    hashInput.text = normalizeText(raw.text);
  }
  return hashInput;
}

export function hashSceneBlockAdmissionInput(source = {}) {
  return hashCanonical(buildSceneBlockHashInput(source));
}

function rejectSceneBlock(source, code, reason, details) {
  return {
    ok: false,
    admitted: false,
    block: null,
    source: isPlainObject(source) ? cloneJson(source) : null,
    hashInput: buildSceneBlockHashInput(source),
    admissionHashSha256: hashSceneBlockAdmissionInput(source),
    normalizedHashSha256: '',
    error: makeTypedError(code, reason, details),
  };
}

export function admitSceneBlock(source = {}, options = {}) {
  const index = Number.isInteger(options.index) ? options.index : null;
  const parentSceneId = normalizeString(options.sceneId);

  if (!isPlainObject(source)) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_OBJECT_REQUIRED',
      'SCENE_BLOCK_OBJECT_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  const unknownFields = Object.keys(source)
    .filter((fieldName) => !SCENE_BLOCK_ALLOWED_FIELDS.includes(fieldName))
    .sort();
  if (unknownFields.length > 0) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_UNKNOWN_FIELD',
      'SCENE_BLOCK_UNKNOWN_FIELD',
      index === null ? { unknownFields } : { index, unknownFields },
    );
  }

  if (!parentSceneId) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_PARENT_SCENE_REQUIRED',
      'SCENE_BLOCK_PARENT_SCENE_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  const id = normalizeString(source.id);
  if (!id) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_ID_REQUIRED',
      'SCENE_BLOCK_ID_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  const sceneId = normalizeString(source.sceneId);
  if (!sceneId) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_SCENE_ID_REQUIRED',
      'SCENE_BLOCK_SCENE_ID_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  if (sceneId !== parentSceneId) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_PARENT_SCENE_MISMATCH',
      'SCENE_BLOCK_PARENT_SCENE_MISMATCH',
      index === null
        ? { sceneId, parentSceneId }
        : { index, sceneId, parentSceneId },
    );
  }

  const type = normalizeString(source.type);
  if (!SCENE_BLOCK_ALLOWED_TYPES.includes(type)) {
    return rejectSceneBlock(
      source,
      'E_SCENE_BLOCK_TYPE_INVALID',
      'SCENE_BLOCK_TYPE_INVALID',
      index === null ? { type } : { index, type },
    );
  }

  const normalizedMarkRefs = normalizeMarkRefs(source.markRefs);
  if (!normalizedMarkRefs.ok) {
    return rejectSceneBlock(
      source,
      normalizedMarkRefs.error.code,
      normalizedMarkRefs.error.reason,
      index === null
        ? normalizedMarkRefs.error.details
        : { index, ...(normalizedMarkRefs.error.details || {}) },
    );
  }

  const block = {
    id,
    sceneId,
    type,
  };

  if (type === 'thematicBreak') {
    if (source.text !== undefined && normalizeText(source.text).length > 0) {
      return rejectSceneBlock(
        source,
        'E_SCENE_BLOCK_TEXT_FORBIDDEN',
        'SCENE_BLOCK_TEXT_FORBIDDEN',
        index === null ? { type } : { index, type },
      );
    }
  } else {
    if (typeof source.text !== 'string') {
      return rejectSceneBlock(
        source,
        'E_SCENE_BLOCK_TEXT_INVALID',
        'SCENE_BLOCK_TEXT_INVALID',
        index === null ? { type } : { index, type },
      );
    }
    block.text = normalizeText(source.text);
  }

  if (normalizedMarkRefs.markRefs.length > 0) {
    block.markRefs = normalizedMarkRefs.markRefs;
  }

  return {
    ok: true,
    admitted: true,
    block,
    source: cloneJson(source),
    hashInput: buildSceneBlockHashInput(block),
    admissionHashSha256: hashSceneBlockAdmissionInput(block),
    normalizedHashSha256: hashSceneBlockAdmissionInput(block),
    error: null,
  };
}

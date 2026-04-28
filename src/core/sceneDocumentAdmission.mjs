import { createHash } from 'node:crypto';

export const SCENE_DOCUMENT_SCHEMA_VERSION = 1;
export const SCENE_DOCUMENT_OP = 'scene.document.admission';
export const SCENE_DOCUMENT_ALLOWED_FIELDS = Object.freeze([
  'schemaVersion',
  'id',
  'title',
  'order',
  'blocks',
  'metadata',
]);
export const SCENE_DOCUMENT_BLOCK_ALLOWED_FIELDS = Object.freeze([
  'type',
  'text',
]);
export const SCENE_DOCUMENT_HASH_FIELDS = Object.freeze([
  'schemaVersion',
  'id',
  'title',
  'order',
  'blocks',
]);
export const SCENE_DOCUMENT_HASH_EXCLUDED_FIELDS = Object.freeze([
  'metadata',
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
    code: String(code || 'E_SCENE_DOCUMENT_INVALID'),
    op: SCENE_DOCUMENT_OP,
    reason: String(reason || 'SCENE_DOCUMENT_INVALID'),
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
  return typeof value === 'string' ? value : '';
}

function buildBlockHashInput(block) {
  if (!isPlainObject(block)) return null;
  return {
    type: normalizeString(block.type),
    text: normalizeText(block.text),
  };
}

export function buildSceneDocumentHashInput(source = {}) {
  const raw = isPlainObject(source) ? source : {};
  return {
    schemaVersion: raw.schemaVersion,
    id: normalizeString(raw.id),
    title: normalizeString(raw.title),
    order: Number.isInteger(raw.order) ? raw.order : null,
    blocks: Array.isArray(raw.blocks)
      ? raw.blocks.map((block) => buildBlockHashInput(block))
      : null,
  };
}

export function hashSceneDocumentAdmissionInput(source = {}) {
  return hashCanonical(buildSceneDocumentHashInput(source));
}

function rejectSceneDocument(source, code, reason, details) {
  return {
    ok: false,
    status: 'rejected',
    readOnly: false,
    admitted: false,
    scene: null,
    source: isPlainObject(source) ? cloneJson(source) : null,
    hashInput: buildSceneDocumentHashInput(source),
    admissionHashSha256: hashSceneDocumentAdmissionInput(source),
    normalizedHashSha256: '',
    error: makeTypedError(code, reason, details),
  };
}

function admitReadOnlySceneDocument(source, details) {
  return {
    ok: true,
    status: 'read-only',
    readOnly: true,
    admitted: false,
    scene: null,
    source: cloneJson(source),
    hashInput: buildSceneDocumentHashInput(source),
    admissionHashSha256: hashSceneDocumentAdmissionInput(source),
    normalizedHashSha256: '',
    error: makeTypedError(
      'E_SCENE_DOCUMENT_SCHEMA_VERSION_UNSUPPORTED',
      'SCENE_DOCUMENT_SCHEMA_VERSION_UNSUPPORTED',
      details,
    ),
  };
}

function normalizeMetadata(source) {
  if (source === undefined) {
    return {};
  }
  if (!isPlainObject(source)) {
    return null;
  }
  const cloned = cloneJson(source);
  return isPlainObject(cloned) ? cloned : {};
}

function normalizeSceneBlock(source, index) {
  if (!isPlainObject(source)) {
    return {
      ok: false,
      error: makeTypedError(
        'E_SCENE_DOCUMENT_BLOCK_INVALID',
        'SCENE_DOCUMENT_BLOCK_INVALID',
        { index },
      ),
    };
  }

  const unknownFields = Object.keys(source)
    .filter((fieldName) => !SCENE_DOCUMENT_BLOCK_ALLOWED_FIELDS.includes(fieldName))
    .sort();
  if (unknownFields.length > 0) {
    return {
      ok: false,
      error: makeTypedError(
        'E_SCENE_DOCUMENT_BLOCK_UNKNOWN_FIELD',
        'SCENE_DOCUMENT_BLOCK_UNKNOWN_FIELD',
        { index, unknownFields },
      ),
    };
  }

  const type = normalizeString(source.type);
  if (!type) {
    return {
      ok: false,
      error: makeTypedError(
        'E_SCENE_DOCUMENT_BLOCK_TYPE_REQUIRED',
        'SCENE_DOCUMENT_BLOCK_TYPE_REQUIRED',
        { index },
      ),
    };
  }

  if (typeof source.text !== 'string') {
    return {
      ok: false,
      error: makeTypedError(
        'E_SCENE_DOCUMENT_BLOCK_TEXT_INVALID',
        'SCENE_DOCUMENT_BLOCK_TEXT_INVALID',
        { index },
      ),
    };
  }

  return {
    ok: true,
    block: {
      type,
      text: source.text,
    },
  };
}

export function admitSceneDocument(source = {}) {
  if (!isPlainObject(source)) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_OBJECT_REQUIRED',
      'SCENE_DOCUMENT_OBJECT_REQUIRED',
    );
  }

  if (!Number.isInteger(source.schemaVersion)) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_SCHEMA_VERSION_INVALID',
      'SCENE_DOCUMENT_SCHEMA_VERSION_INVALID',
      { schemaVersion: source.schemaVersion },
    );
  }

  if (source.schemaVersion !== SCENE_DOCUMENT_SCHEMA_VERSION) {
    return admitReadOnlySceneDocument(source, {
      schemaVersion: source.schemaVersion,
      supportedSchemaVersion: SCENE_DOCUMENT_SCHEMA_VERSION,
    });
  }

  const unknownFields = Object.keys(source)
    .filter((fieldName) => !SCENE_DOCUMENT_ALLOWED_FIELDS.includes(fieldName))
    .sort();
  if (unknownFields.length > 0) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_UNKNOWN_FIELD',
      'SCENE_DOCUMENT_UNKNOWN_FIELD',
      { unknownFields },
    );
  }

  const id = normalizeString(source.id);
  if (!id) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_ID_REQUIRED',
      'SCENE_DOCUMENT_ID_REQUIRED',
    );
  }

  if (typeof source.title !== 'string') {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_TITLE_INVALID',
      'SCENE_DOCUMENT_TITLE_INVALID',
    );
  }
  const title = normalizeString(source.title);

  if (!Number.isInteger(source.order) || source.order < 0) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_ORDER_INVALID',
      'SCENE_DOCUMENT_ORDER_INVALID',
      { order: source.order },
    );
  }

  if (!Array.isArray(source.blocks)) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_BLOCKS_INVALID',
      'SCENE_DOCUMENT_BLOCKS_INVALID',
    );
  }

  const metadata = normalizeMetadata(source.metadata);
  if (metadata === null) {
    return rejectSceneDocument(
      source,
      'E_SCENE_DOCUMENT_METADATA_INVALID',
      'SCENE_DOCUMENT_METADATA_INVALID',
    );
  }

  const blocks = [];
  for (let index = 0; index < source.blocks.length; index += 1) {
    const normalizedBlock = normalizeSceneBlock(source.blocks[index], index);
    if (!normalizedBlock.ok) {
      return {
        ...rejectSceneDocument(
          source,
          normalizedBlock.error.code,
          normalizedBlock.error.reason,
          normalizedBlock.error.details,
        ),
      };
    }
    blocks.push(normalizedBlock.block);
  }

  const scene = {
    schemaVersion: SCENE_DOCUMENT_SCHEMA_VERSION,
    id,
    title,
    order: source.order,
    blocks,
  };

  if (source.metadata !== undefined) {
    scene.metadata = metadata;
  }

  return {
    ok: true,
    status: 'accepted',
    readOnly: false,
    admitted: true,
    scene,
    source: cloneJson(source),
    hashInput: buildSceneDocumentHashInput(scene),
    admissionHashSha256: hashSceneDocumentAdmissionInput(scene),
    normalizedHashSha256: hashSceneDocumentAdmissionInput(scene),
    error: null,
  };
}

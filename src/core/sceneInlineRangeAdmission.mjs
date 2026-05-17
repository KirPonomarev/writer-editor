import { createHash } from 'node:crypto';

export const SCENE_INLINE_RANGE_OP = 'scene.inlineRange.admission';
export const SCENE_INLINE_RANGE_OFFSET_UNIT = 'utf16_code_unit';
export const SCENE_INLINE_RANGE_ALLOWED_MARK_TYPES = Object.freeze([
  'bold',
  'italic',
]);
export const SCENE_INLINE_RANGE_ALLOWED_FIELDS = Object.freeze([
  'id',
  'blockId',
  'startOffset',
  'endOffset',
  'markType',
  'payload',
]);
export const SCENE_INLINE_RANGE_HASH_FIELDS = Object.freeze([
  'id',
  'blockId',
  'startOffset',
  'endOffset',
  'markType',
  'payload',
]);
export const SCENE_INLINE_RANGE_HASH_EXCLUDED_FIELDS = Object.freeze([
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
    code: String(code || 'E_SCENE_INLINE_RANGE_INVALID'),
    op: SCENE_INLINE_RANGE_OP,
    reason: String(reason || 'SCENE_INLINE_RANGE_INVALID'),
  };
  if (isPlainObject(details)) {
    error.details = cloneJson(details);
  }
  return error;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePayload(value) {
  if (value === undefined) {
    return {
      ok: true,
      payload: undefined,
    };
  }
  if (!isPlainObject(value) || Object.keys(value).length > 0) {
    return {
      ok: false,
      error: makeTypedError(
        'E_SCENE_INLINE_RANGE_PAYLOAD_INVALID',
        'SCENE_INLINE_RANGE_PAYLOAD_INVALID',
      ),
    };
  }
  return {
    ok: true,
    payload: {},
  };
}

function collectGraphemeBoundaries(text = '') {
  if (typeof Intl !== 'object' || typeof Intl.Segmenter !== 'function') {
    return null;
  }
  const boundaries = new Set([0]);
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const segment of segmenter.segment(text)) {
    boundaries.add(segment.index);
    boundaries.add(segment.index + segment.segment.length);
  }
  boundaries.add(String(text).length);
  return boundaries;
}

function normalizeBlockText(value) {
  return typeof value === 'string' ? value : '';
}

export function buildSceneInlineRangeHashInput(source = {}) {
  const raw = isPlainObject(source) ? source : {};
  return {
    id: normalizeString(raw.id),
    blockId: normalizeString(raw.blockId),
    startOffset: Number.isInteger(raw.startOffset) ? raw.startOffset : null,
    endOffset: Number.isInteger(raw.endOffset) ? raw.endOffset : null,
    markType: normalizeString(raw.markType),
  };
}

export function hashSceneInlineRangeAdmissionInput(source = {}) {
  return hashCanonical(buildSceneInlineRangeHashInput(source));
}

function rejectSceneInlineRange(source, code, reason, details) {
  return {
    ok: false,
    admitted: false,
    offsetUnit: SCENE_INLINE_RANGE_OFFSET_UNIT,
    advisoryLimit: '',
    range: null,
    source: isPlainObject(source) ? cloneJson(source) : null,
    hashInput: buildSceneInlineRangeHashInput(source),
    admissionHashSha256: hashSceneInlineRangeAdmissionInput(source),
    normalizedHashSha256: '',
    error: makeTypedError(code, reason, details),
  };
}

export function admitSceneInlineRange(source = {}, options = {}) {
  const expectedBlockId = normalizeString(options.blockId);
  const blockText = normalizeBlockText(options.blockText);
  const index = Number.isInteger(options.index) ? options.index : null;

  if (!isPlainObject(source)) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_OBJECT_REQUIRED',
      'SCENE_INLINE_RANGE_OBJECT_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  const unknownFields = Object.keys(source)
    .filter((fieldName) => !SCENE_INLINE_RANGE_ALLOWED_FIELDS.includes(fieldName))
    .sort();
  if (unknownFields.length > 0) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_UNKNOWN_FIELD',
      'SCENE_INLINE_RANGE_UNKNOWN_FIELD',
      index === null ? { unknownFields } : { index, unknownFields },
    );
  }

  const id = normalizeString(source.id);
  if (!id) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_ID_REQUIRED',
      'SCENE_INLINE_RANGE_ID_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  const blockId = normalizeString(source.blockId);
  if (!blockId) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_BLOCK_ID_REQUIRED',
      'SCENE_INLINE_RANGE_BLOCK_ID_REQUIRED',
      index === null ? undefined : { index },
    );
  }

  if (expectedBlockId && blockId !== expectedBlockId) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_BLOCK_ID_MISMATCH',
      'SCENE_INLINE_RANGE_BLOCK_ID_MISMATCH',
      index === null ? { blockId, expectedBlockId } : { index, blockId, expectedBlockId },
    );
  }

  if (!Number.isInteger(source.startOffset) || source.startOffset < 0) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_START_INVALID',
      'SCENE_INLINE_RANGE_START_INVALID',
      index === null ? { startOffset: source.startOffset } : { index, startOffset: source.startOffset },
    );
  }

  if (!Number.isInteger(source.endOffset) || source.endOffset < 0) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_END_INVALID',
      'SCENE_INLINE_RANGE_END_INVALID',
      index === null ? { endOffset: source.endOffset } : { index, endOffset: source.endOffset },
    );
  }

  if (source.endOffset <= source.startOffset) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_EMPTY_OR_REVERSED',
      'SCENE_INLINE_RANGE_EMPTY_OR_REVERSED',
      index === null
        ? { startOffset: source.startOffset, endOffset: source.endOffset }
        : { index, startOffset: source.startOffset, endOffset: source.endOffset },
    );
  }

  if (blockText && source.endOffset > blockText.length) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_OUT_OF_BLOCK',
      'SCENE_INLINE_RANGE_OUT_OF_BLOCK',
      index === null
        ? { endOffset: source.endOffset, blockLength: blockText.length }
        : { index, endOffset: source.endOffset, blockLength: blockText.length },
    );
  }

  const markType = normalizeString(source.markType);
  if (!SCENE_INLINE_RANGE_ALLOWED_MARK_TYPES.includes(markType)) {
    return rejectSceneInlineRange(
      source,
      'E_SCENE_INLINE_RANGE_MARK_TYPE_INVALID',
      'SCENE_INLINE_RANGE_MARK_TYPE_INVALID',
      index === null ? { markType } : { index, markType },
    );
  }

  const normalizedPayload = normalizePayload(source.payload);
  if (!normalizedPayload.ok) {
    return rejectSceneInlineRange(
      source,
      normalizedPayload.error.code,
      normalizedPayload.error.reason,
      index === null
        ? normalizedPayload.error.details
        : { index, ...(normalizedPayload.error.details || {}) },
    );
  }

  let advisoryLimit = '';
  if (blockText) {
    const boundaries = collectGraphemeBoundaries(blockText);
    if (!boundaries) {
      advisoryLimit = 'GRAPHEME_SEGMENTER_UNAVAILABLE';
    } else if (!boundaries.has(source.startOffset) || !boundaries.has(source.endOffset)) {
      return rejectSceneInlineRange(
        source,
        'E_SCENE_INLINE_RANGE_GRAPHEME_SPLIT',
        'SCENE_INLINE_RANGE_GRAPHEME_SPLIT',
        index === null
          ? { startOffset: source.startOffset, endOffset: source.endOffset }
          : { index, startOffset: source.startOffset, endOffset: source.endOffset },
      );
    }
  }

  const range = {
    id,
    blockId,
    startOffset: source.startOffset,
    endOffset: source.endOffset,
    markType,
  };

  return {
    ok: true,
    admitted: true,
    offsetUnit: SCENE_INLINE_RANGE_OFFSET_UNIT,
    advisoryLimit,
    range,
    source: cloneJson(source),
    hashInput: buildSceneInlineRangeHashInput(range),
    admissionHashSha256: hashSceneInlineRangeAdmissionInput(range),
    normalizedHashSha256: hashSceneInlineRangeAdmissionInput(range),
    error: null,
  };
}

export function sortSceneInlineRanges(ranges = []) {
  return [...ranges].sort((left, right) => (
    left.startOffset - right.startOffset
    || left.endOffset - right.endOffset
    || String(left.markType).localeCompare(String(right.markType))
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function admitSceneInlineRangeSet(ranges = [], options = {}) {
  if (!Array.isArray(ranges)) {
    return {
      ok: false,
      admitted: false,
      offsetUnit: SCENE_INLINE_RANGE_OFFSET_UNIT,
      advisoryLimit: '',
      ranges: [],
      hashInput: [],
      admissionHashSha256: hashSceneInlineRangeAdmissionInput([]),
      normalizedHashSha256: '',
      error: makeTypedError(
        'E_SCENE_INLINE_RANGE_SET_INVALID',
        'SCENE_INLINE_RANGE_SET_INVALID',
      ),
    };
  }

  const admitted = [];
  let advisoryLimit = '';
  for (let index = 0; index < ranges.length; index += 1) {
    const result = admitSceneInlineRange(ranges[index], { ...options, index });
    if (!result.ok) {
      return {
        ok: false,
        admitted: false,
        offsetUnit: SCENE_INLINE_RANGE_OFFSET_UNIT,
        advisoryLimit: '',
        ranges: [],
        hashInput: [],
        admissionHashSha256: hashSceneInlineRangeAdmissionInput(ranges),
        normalizedHashSha256: '',
        error: result.error,
      };
    }
    if (result.advisoryLimit && !advisoryLimit) {
      advisoryLimit = result.advisoryLimit;
    }
    admitted.push(result.range);
  }

  const sortedRanges = sortSceneInlineRanges(admitted);
  return {
    ok: true,
    admitted: true,
    offsetUnit: SCENE_INLINE_RANGE_OFFSET_UNIT,
    advisoryLimit,
    ranges: sortedRanges,
    hashInput: sortedRanges.map((range) => buildSceneInlineRangeHashInput(range)),
    admissionHashSha256: hashCanonical(sortedRanges.map((range) => buildSceneInlineRangeHashInput(range))),
    normalizedHashSha256: hashCanonical(sortedRanges.map((range) => buildSceneInlineRangeHashInput(range))),
    error: null,
  };
}

export function shiftSceneInlineRange(range, edit = {}) {
  const startOffset = Number(range?.startOffset);
  const endOffset = Number(range?.endOffset);
  const editOffset = Number.isInteger(edit.offset) ? edit.offset : 0;
  const deleteCount = Number.isInteger(edit.deleteCount) ? edit.deleteCount : 0;
  const insertText = typeof edit.insertText === 'string' ? edit.insertText : '';
  const delta = insertText.length - deleteCount;

  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) {
    throw new Error('E_SCENE_INLINE_RANGE_SHIFT_INPUT_INVALID');
  }

  if (editOffset >= endOffset) {
    return { ...range };
  }
  if (editOffset <= startOffset) {
    return {
      ...range,
      startOffset: startOffset + delta,
      endOffset: endOffset + delta,
    };
  }
  return {
    ...range,
    endOffset: Math.max(editOffset, endOffset + delta),
  };
}

export function classifySceneInlineRangeSplit(range, splitOffset) {
  const startOffset = Number(range?.startOffset);
  const endOffset = Number(range?.endOffset);
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || !Number.isInteger(splitOffset)) {
    throw new Error('E_SCENE_INLINE_RANGE_SPLIT_INPUT_INVALID');
  }
  if (endOffset <= splitOffset) return 'left';
  if (startOffset >= splitOffset) return 'right';
  return 'crosses';
}

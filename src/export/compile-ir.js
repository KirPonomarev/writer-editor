'use strict';

const crypto = require('node:crypto');

const COMPILE_IR_SCHEMA_VERSION = 1;
const COMPILE_IR_FORMAT_VERSION = 'compile-ir-v1';
const SOURCE_BINDING = 'canonical-project-scenes';
const VOLATILE_FIELDS = Object.freeze(['createdAt']);

const FORBIDDEN_COMPILE_IR_INPUT_KEYS = Object.freeze([
  'bufferSource',
  'dom',
  'editorSnapshot',
  'html',
  'liveEditorState',
  'liveText',
  'plainText',
  'previewModel',
  'rendererState',
  'screenText',
]);

class CompileIRError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CompileIRError';
    this.code = code;
    this.details = details;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(normalizeText(value), 'utf8').digest('hex');
}

function hashObject(value) {
  return sha256Text(stableStringify(value));
}

function omitKeys(value, keys) {
  if (Array.isArray(value)) return value.map((entry) => omitKeys(entry, keys));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) out[key] = omitKeys(value[key], keys);
  }
  return out;
}

function assertNoForbiddenSourceKeys(value, path = 'input') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenSourceKeys(entry, `${path}.${index}`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_COMPILE_IR_INPUT_KEYS.includes(key)) {
      throw new CompileIRError(
        'E_COMPILE_IR_SOURCE_NOT_CANONICAL',
        `CompileIR cannot read forbidden source key ${key}`,
        { key, path },
      );
    }
    assertNoForbiddenSourceKeys(value[key], `${path}.${key}`);
  }
}

function assertCanonicalProjectInput(project, options = {}) {
  assertNoForbiddenSourceKeys(options, 'options');
  if (!isPlainObject(project) || !isPlainObject(project.manifest) || !isPlainObject(project.scenes)) {
    throw new CompileIRError(
      'E_COMPILE_IR_PROJECT_SHAPE_INVALID',
      'CompileIR requires a canonical project with manifest and scenes',
    );
  }
  if (project.__editorSnapshot || project.__screenState || project.__rendererState) {
    throw new CompileIRError(
      'E_COMPILE_IR_SOURCE_NOT_CANONICAL',
      'CompileIR cannot use editor, screen, or renderer state as source truth',
    );
  }
  if (!Array.isArray(project.manifest.sceneOrder)) {
    throw new CompileIRError(
      'E_COMPILE_IR_SCENE_ORDER_INVALID',
      'CompileIR requires manifest.sceneOrder',
    );
  }
  return true;
}

function sceneText(scene) {
  return (Array.isArray(scene.blocks) ? scene.blocks : [])
    .map((block) => normalizeText(block.text))
    .join('\n');
}

function normalizeInlineRange(range) {
  return Object.freeze({
    id: String(range.id),
    kind: String(range.kind),
    from: Number(range.from),
    to: Number(range.to),
    offsetUnit: String(range.offsetUnit || 'codeUnit'),
    attrs: stableSort(range.attrs || {}),
  });
}

function normalizeBlock(block, sequence) {
  return Object.freeze({
    blockId: String(block.id),
    sequence,
    type: String(block.type),
    text: normalizeText(block.text),
    inlineRanges: Object.freeze((block.inlineRanges || []).map(normalizeInlineRange)),
    attrs: stableSort(block.attrs || {}),
  });
}

function normalizeScene(scene, sceneId, sequence) {
  const blocks = Object.freeze((scene.blocks || []).map((block, index) => normalizeBlock(block, index)));
  const text = sceneText({ ...scene, blocks });
  return Object.freeze({
    sceneId,
    sequence,
    title: String(scene.title || ''),
    status: String(scene.status || ''),
    synopsis: String(scene.synopsis || ''),
    exportIntent: String(scene.exportIntent || 'include'),
    blocks,
    textHash: sha256Text(text),
    wordCount: text.trim() ? text.trim().split(/\s+/u).length : 0,
  });
}

function canonicalSourceHash(project, scenes) {
  return hashObject({
    sourceBinding: SOURCE_BINDING,
    projectId: project.manifest.projectId,
    manifestHash: project.manifest.manifestHash,
    sceneOrder: scenes.map((scene) => scene.sceneId),
    sceneTextHashes: Object.fromEntries(scenes.map((scene) => [scene.sceneId, scene.textHash])),
    styleMap: project.manifest.styleMap || {},
    bookProfile: project.manifest.bookProfile || {},
    compileProfile: project.manifest.compileProfile || {},
  });
}

function compileIRHashInput(ir) {
  return omitKeys(ir, [...VOLATILE_FIELDS, 'compileIRHash']);
}

function computeCompileIRHash(ir) {
  return hashObject(compileIRHashInput(ir));
}

function compileProjectToIR(project, options = {}) {
  assertCanonicalProjectInput(project, options);
  const scenes = [];
  const seenBlockIds = new Set();

  for (const sceneId of project.manifest.sceneOrder) {
    const scene = project.scenes[sceneId];
    const manifestEntry = project.manifest.scenes?.[sceneId] || {};
    if (!scene || manifestEntry.deleted === true || scene.exportIntent === 'exclude') continue;
    const normalized = normalizeScene(scene, sceneId, scenes.length);
    for (const block of normalized.blocks) {
      if (seenBlockIds.has(block.blockId)) {
        throw new CompileIRError(
          'E_COMPILE_IR_DUPLICATE_BLOCK_ID',
          `Duplicate CompileIR block id ${block.blockId}`,
          { blockId: block.blockId },
        );
      }
      seenBlockIds.add(block.blockId);
    }
    scenes.push(normalized);
  }

  const base = {
    schemaVersion: COMPILE_IR_SCHEMA_VERSION,
    formatVersion: COMPILE_IR_FORMAT_VERSION,
    sourceBinding: SOURCE_BINDING,
    projectId: String(project.manifest.projectId || ''),
    projectTitle: String(project.manifest.title || ''),
    createdAt: String(options.createdAt || '1970-01-01T00:00:00.000Z'),
    volatileFields: [...VOLATILE_FIELDS],
    bookProfile: stableSort(project.manifest.bookProfile || {}),
    styleMap: stableSort(project.manifest.styleMap || {}),
    compileProfile: stableSort({
      ...(project.manifest.compileProfile || {}),
      ...(options.compileProfile || {}),
    }),
    scenes: Object.freeze(scenes),
    source: {
      manifestHash: String(project.manifest.manifestHash || ''),
      sourceHash: canonicalSourceHash(project, scenes),
      sceneHashes: Object.fromEntries(scenes.map((scene) => [scene.sceneId, scene.textHash])),
    },
    laterTargets: Object.freeze(['markdown', 'txt', 'html', 'epub']),
  };

  return Object.freeze({
    ...base,
    compileIRHash: computeCompileIRHash(base),
  });
}

function validateCompileIR(ir, expected = {}) {
  const errors = [];
  if (!isPlainObject(ir)) errors.push({ code: 'E_COMPILE_IR_NOT_OBJECT' });
  if (isPlainObject(ir)) {
    if (ir.schemaVersion !== COMPILE_IR_SCHEMA_VERSION) errors.push({ code: 'E_COMPILE_IR_SCHEMA_VERSION' });
    if (ir.formatVersion !== COMPILE_IR_FORMAT_VERSION) errors.push({ code: 'E_COMPILE_IR_FORMAT_VERSION' });
    if (ir.sourceBinding !== SOURCE_BINDING) errors.push({ code: 'E_COMPILE_IR_SOURCE_BINDING' });
    if (!Array.isArray(ir.scenes)) errors.push({ code: 'E_COMPILE_IR_SCENES_NOT_ARRAY' });
    if (!isPlainObject(ir.source)) errors.push({ code: 'E_COMPILE_IR_SOURCE_MISSING' });
    if (isPlainObject(ir.source) && expected.manifestHash && ir.source.manifestHash !== expected.manifestHash) {
      errors.push({ code: 'E_COMPILE_IR_SOURCE_HASH_MISMATCH' });
    }
    if (expected.projectId && ir.projectId !== expected.projectId) {
      errors.push({ code: 'E_COMPILE_IR_PROJECT_ID_MISMATCH' });
    }
    if (Array.isArray(expected.sceneOrder)) {
      const actualSceneOrder = (ir.scenes || []).map((scene) => scene.sceneId);
      if (stableStringify(actualSceneOrder) !== stableStringify(expected.sceneOrder)) {
        errors.push({ code: 'E_COMPILE_IR_SCENE_ORDER_MISMATCH' });
      }
    }
    if (Array.isArray(ir.scenes)) {
      ir.scenes.forEach((scene, sceneIndex) => {
        if (scene.sequence !== sceneIndex) errors.push({ code: 'E_COMPILE_IR_SCENE_SEQUENCE_MISMATCH', sceneId: scene.sceneId });
        if (!Array.isArray(scene.blocks)) errors.push({ code: 'E_COMPILE_IR_BLOCKS_NOT_ARRAY', sceneId: scene.sceneId });
        (scene.blocks || []).forEach((block, blockIndex) => {
          if (block.sequence !== blockIndex) {
            errors.push({ code: 'E_COMPILE_IR_BLOCK_SEQUENCE_MISMATCH', sceneId: scene.sceneId, blockId: block.blockId });
          }
        });
      });
    }
    if (ir.compileIRHash !== computeCompileIRHash(ir)) errors.push({ code: 'E_COMPILE_IR_HASH_MISMATCH' });
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}

module.exports = {
  COMPILE_IR_FORMAT_VERSION,
  COMPILE_IR_SCHEMA_VERSION,
  FORBIDDEN_COMPILE_IR_INPUT_KEYS,
  SOURCE_BINDING,
  VOLATILE_FIELDS,
  CompileIRError,
  assertCanonicalProjectInput,
  compileProjectToIR,
  computeCompileIRHash,
  validateCompileIR,
};

#!/usr/bin/env node
import crypto from 'node:crypto';

export const C5V2_SEMANTIC_ORACLE_SCHEMA = 'yalken.rtk.word.c5v2.semantic-oracle.v1';
export const C5V2_MULTILINGUAL_QA_SCHEMA = 'yalken.rtk.word.c5v2.multilingual-qa-layer.v1';

const MULTILINGUAL_CATEGORIES = Object.freeze([
  {
    category: 'combining-marks',
    text: 'C5V2 QA combining cafe\u0301 nai\u0308ve re\u0301sume\u0301 natural range.',
  },
  {
    category: 'emoji-zwj',
    text: 'C5V2 QA emoji family 👨‍👩‍👧‍👦 editor 🧑‍💻 manuscript path.',
  },
  {
    category: 'rtl-arabic',
    text: 'C5V2 QA Arabic مرحبا بالعالم داخل فقرة تحريرية.',
  },
  {
    category: 'rtl-hebrew',
    text: 'C5V2 QA Hebrew שלום עולם בתוך הערת עריכה.',
  },
  {
    category: 'cjk',
    text: 'C5V2 QA CJK 編集者は静かな文章を確認します。中文段落保持语义。',
  },
  {
    category: 'indic-devanagari',
    text: 'C5V2 QA Devanagari नमस्ते दुनिया संपादन परीक्षण.',
  },
  {
    category: 'thai',
    text: 'C5V2 QA Thai สวัสดีโลก การตรวจแก้ต้นฉบับ.',
  },
]);

const REQUIRED_WORD_SOURCE_KINDS = new Set(['raw-ooxml', 'word-object-model']);
const COMMENT_FAMILIES = new Set(['root_comment', 'reply', 'comment_state']);
const FORMAT_FAMILIES = new Set(['formatting']);
const STRUCTURAL_FAMILIES = new Set(['structural']);
const TEXT_FAMILIES = new Set(['tracked_text_edit']);

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')}`;
}

function stableJson(value) {
  const sortValue = (input) => {
    if (Array.isArray(input)) return input.map(sortValue);
    if (input && typeof input === 'object') {
      const sorted = {};
      for (const key of Object.keys(input).sort()) {
        sorted[key] = sortValue(input[key]);
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(sortValue(value));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function graphemeCount(value) {
  const text = String(value || '');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length;
  }
  return Array.from(text).length;
}

function makeAnchor(sceneId, text, passageOrdinal) {
  const start = Math.min(12, Math.max(0, graphemeCount(text) - 8));
  const end = Math.min(graphemeCount(text), start + Math.max(4, Math.min(18, graphemeCount(text) - start)));
  return {
    sceneId,
    paragraphId: `c5v2-multilingual-p-${String(passageOrdinal + 1).padStart(3, '0')}`,
    graphemeStart: start,
    graphemeEnd: end,
    selectedText: text,
    contextBefore: text.slice(0, 16),
    contextAfter: text.slice(-16),
    baselineHash: sha256Text(text),
  };
}

export function buildC5V2MultilingualQaLayer({ scenes = [], roundCount = 5 } = {}) {
  const normalizedScenes = list(scenes)
    .map((scene, index) => ({
      sceneId: normalizeString(scene?.sceneId) || `scene-${String(index + 1).padStart(2, '0')}`,
      title: normalizeString(scene?.title),
    }))
    .filter((scene) => scene.sceneId);
  if (normalizedScenes.length === 0) {
    throw new Error('C5V2_MULTILINGUAL_SCENES_REQUIRED');
  }
  const passages = [];
  const operations = [];
  const targetCount = Math.max(normalizedScenes.length, MULTILINGUAL_CATEGORIES.length);
  for (let index = 0; index < targetCount; index += 1) {
    const scene = normalizedScenes[index % normalizedScenes.length];
    const category = MULTILINGUAL_CATEGORIES[index % MULTILINGUAL_CATEGORIES.length];
    const text = `${category.text} Scene ${scene.sceneId} passage ${index + 1}.`;
    const anchor = makeAnchor(scene.sceneId, text, index);
    const passage = {
      passageId: `c5v2-multilingual-${String(index + 1).padStart(3, '0')}`,
      sceneId: scene.sceneId,
      category: category.category,
      text,
      anchor,
      baselineHash: sha256Text(text),
      oracleRole: 'supporting-grapheme-qa-not-sole-routing-authority',
    };
    passages.push(passage);
    const families = ['tracked_text_edit', 'root_comment', 'formatting'];
    for (const family of families) {
      operations.push({
        id: `${passage.passageId}-${family}`,
        family,
        round: (index % Math.max(1, roundCount)) + 1,
        sceneId: scene.sceneId,
        anchor,
        multilingualCategory: category.category,
        semanticIntent: family === 'tracked_text_edit'
          ? { kind: 'replace', replacementText: `${category.category} replacement ${index + 1}` }
          : family === 'root_comment'
            ? {
                kind: 'root-comment',
                commentText: `${category.category} comment ${index + 1}`,
                authorDisplayName: 'C5V2 QA Author',
              }
            : { kind: index % 2 === 0 ? 'bold' : 'highlight', spanType: 'inline' },
        expectedOutcome: 'SAFE_APPLY',
      });
    }
  }
  const categories = [...new Set(passages.map((passage) => passage.category))].sort();
  const sceneCoverage = [...new Set(passages.map((passage) => passage.sceneId))].sort();
  return {
    schemaVersion: C5V2_MULTILINGUAL_QA_SCHEMA,
    categories,
    sceneCoverage,
    passages,
    operations,
    gates: {
      ok: categories.length === MULTILINGUAL_CATEGORIES.length && sceneCoverage.length === normalizedScenes.length,
      categoryCoverage: categories.length,
      requiredCategoryCoverage: MULTILINGUAL_CATEGORIES.length,
      sceneCoverage: sceneCoverage.length,
      requiredSceneCoverage: normalizedScenes.length,
    },
  };
}

function requireOracleMap(source, field, failures) {
  const map = isPlainObject(source?.operationsById) ? source.operationsById : null;
  if (!map) {
    failures.push({ code: 'C5V2_ORACLE_OPERATION_MAP_REQUIRED', field });
    return {};
  }
  return map;
}

function compareOperationIdSet(sourceMap, sourceName, expectedOperationIds, failures) {
  const actualIds = new Set(Object.keys(sourceMap || {}).map((id) => normalizeString(id)).filter(Boolean));
  for (const actualId of actualIds) {
    if (!expectedOperationIds.has(actualId)) {
      failures.push({
        code: 'C5V2_ORACLE_UNEXPECTED_OPERATION',
        source: sourceName,
        operationId: actualId,
      });
    }
  }
}

function compareAnchor(operation, record, sourceName, failures) {
  const expected = operation.anchor || {};
  const actual = record.anchor || {};
  for (const field of ['sceneId', 'paragraphId', 'selectedText', 'contextBefore', 'contextAfter', 'baselineHash']) {
    if (normalizeString(expected[field]) !== normalizeString(actual[field])) {
      failures.push({
        code: 'C5V2_ORACLE_ANCHOR_MISMATCH',
        operationId: operation.id,
        source: sourceName,
        field,
      });
    }
  }
  for (const field of ['graphemeStart', 'graphemeEnd']) {
    if (Number.isInteger(expected[field]) && expected[field] !== actual[field]) {
      failures.push({
        code: 'C5V2_ORACLE_GRAPHEME_RANGE_MISMATCH',
        operationId: operation.id,
        source: sourceName,
        field,
      });
    }
  }
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value || {}, field);
}

function canonicalSemanticValue(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function normalizeDocumentBlocks(value) {
  if (!Array.isArray(value)) return null;
  return value.map((block, index) => ({
    ordinal: Number.isInteger(block?.ordinal) ? block.ordinal : index + 1,
    sceneId: normalizeString(block?.sceneId),
    blockId: normalizeString(block?.blockId),
    kind: normalizeString(block?.kind || block?.type),
    text: typeof block?.text === 'string' ? block.text : '',
  }));
}

function compareDocumentBlocks(input, wordReadback, yalkenTruth, failures) {
  const expectedBlocks = normalizeDocumentBlocks(input.expectedDocumentBlocks);
  const wordBlocks = normalizeDocumentBlocks(wordReadback.documentBlocks);
  const yalkenBlocks = normalizeDocumentBlocks(yalkenTruth.documentBlocks);
  if (!expectedBlocks && !wordBlocks && !yalkenBlocks) return;
  if (!expectedBlocks) {
    failures.push({ code: 'C5V2_ORACLE_DOCUMENT_BLOCK_EXPECTATION_REQUIRED' });
    return;
  }
  for (const [source, blocks] of [['word', wordBlocks], ['yalken', yalkenBlocks]]) {
    if (!blocks) {
      failures.push({ code: 'C5V2_ORACLE_DOCUMENT_BLOCKS_REQUIRED', source });
      continue;
    }
    if (JSON.stringify(blocks) !== JSON.stringify(expectedBlocks)) {
      failures.push({ code: 'C5V2_ORACLE_DOCUMENT_BLOCK_MISMATCH', source });
    }
  }
}

function compareSemanticField(operation, wordSemantics, yalkenSemantics, field, expectedValue, failureCode, failures) {
  const expectedPresent = expectedValue !== undefined;
  const wordPresent = hasOwn(wordSemantics, field);
  const yalkenPresent = hasOwn(yalkenSemantics, field);
  if (!expectedPresent && !wordPresent && !yalkenPresent) return;

  const expected = expectedPresent ? canonicalSemanticValue(expectedValue) : canonicalSemanticValue(wordSemantics[field]);
  if (!wordPresent || canonicalSemanticValue(wordSemantics[field]) !== expected) {
    failures.push({
      code: failureCode,
      operationId: operation.id,
      source: 'word',
      field,
    });
  }
  if (!yalkenPresent || canonicalSemanticValue(yalkenSemantics[field]) !== expected) {
    failures.push({
      code: failureCode,
      operationId: operation.id,
      source: 'yalken',
      field,
    });
  }
}

function verifyFamilySemantics(operation, wordRecord, yalkenRecord, failures) {
  const family = normalizeString(operation.family);
  if (TEXT_FAMILIES.has(family)) {
    if (!isPlainObject(wordRecord.textSemantics) || !isPlainObject(yalkenRecord.textSemantics)) {
      failures.push({ code: 'C5V2_ORACLE_TEXT_SEMANTICS_REQUIRED', operationId: operation.id });
      return;
    }
    const expectedKind = normalizeString(operation.semanticIntent?.kind);
    if (normalizeString(wordRecord.textSemantics.kind) !== expectedKind || normalizeString(yalkenRecord.textSemantics.kind) !== expectedKind) {
      failures.push({ code: 'C5V2_ORACLE_TEXT_KIND_MISMATCH', operationId: operation.id });
    }
    const replacement = normalizeString(operation.semanticIntent?.replacementText);
    if (replacement && (
      normalizeString(wordRecord.textSemantics.replacementText) !== replacement
      || normalizeString(yalkenRecord.textSemantics.replacementText) !== replacement
    )) {
      failures.push({ code: 'C5V2_ORACLE_TEXT_REPLACEMENT_MISMATCH', operationId: operation.id });
    }
  } else if (COMMENT_FAMILIES.has(family)) {
    if (!isPlainObject(wordRecord.commentSemantics) || !isPlainObject(yalkenRecord.commentSemantics)) {
      failures.push({ code: 'C5V2_ORACLE_COMMENT_SEMANTICS_REQUIRED', operationId: operation.id });
      return;
    }
    for (const field of ['threadId', 'state']) {
      if (normalizeString(wordRecord.commentSemantics[field]) !== normalizeString(yalkenRecord.commentSemantics[field])) {
        failures.push({ code: 'C5V2_ORACLE_COMMENT_GRAPH_MISMATCH', operationId: operation.id, field });
      }
    }
    compareSemanticField(operation, wordRecord.commentSemantics, yalkenRecord.commentSemantics, 'commentText', operation.semanticIntent?.commentText, 'C5V2_ORACLE_COMMENT_BODY_MISMATCH', failures);
    compareSemanticField(operation, wordRecord.commentSemantics, yalkenRecord.commentSemantics, 'authorDisplayName', operation.semanticIntent?.authorDisplayName, 'C5V2_ORACLE_COMMENT_AUTHOR_MISMATCH', failures);
    compareSemanticField(operation, wordRecord.commentSemantics, yalkenRecord.commentSemantics, 'resolved', operation.semanticIntent?.resolved, 'C5V2_ORACLE_COMMENT_RESOLVED_MISMATCH', failures);
  } else if (FORMAT_FAMILIES.has(family)) {
    if (!isPlainObject(wordRecord.formattingSemantics) || !isPlainObject(yalkenRecord.formattingSemantics)) {
      failures.push({ code: 'C5V2_ORACLE_FORMATTING_SEMANTICS_REQUIRED', operationId: operation.id });
      return;
    }
    compareSemanticField(operation, wordRecord.formattingSemantics, yalkenRecord.formattingSemantics, 'kind', operation.semanticIntent?.kind, 'C5V2_ORACLE_FORMATTING_KIND_MISMATCH', failures);
    compareSemanticField(operation, wordRecord.formattingSemantics, yalkenRecord.formattingSemantics, 'spanType', operation.semanticIntent?.spanType, 'C5V2_ORACLE_FORMATTING_SPAN_MISMATCH', failures);
    compareSemanticField(operation, wordRecord.formattingSemantics, yalkenRecord.formattingSemantics, 'effective', operation.semanticIntent?.effective, 'C5V2_ORACLE_FORMATTING_EFFECTIVE_MISMATCH', failures);
  } else if (STRUCTURAL_FAMILIES.has(family)) {
    if (!isPlainObject(wordRecord.structuralSemantics) || !isPlainObject(yalkenRecord.structuralSemantics)) {
      failures.push({ code: 'C5V2_ORACLE_STRUCTURAL_SEMANTICS_REQUIRED', operationId: operation.id });
      return;
    }
    compareSemanticField(operation, wordRecord.structuralSemantics, yalkenRecord.structuralSemantics, 'kind', operation.semanticIntent?.kind, 'C5V2_ORACLE_STRUCTURAL_KIND_MISMATCH', failures);
    compareSemanticField(operation, wordRecord.structuralSemantics, yalkenRecord.structuralSemantics, 'heading', operation.semanticIntent?.heading, 'C5V2_ORACLE_STRUCTURAL_HEADING_MISMATCH', failures);
    compareSemanticField(operation, wordRecord.structuralSemantics, yalkenRecord.structuralSemantics, 'ordinal', operation.semanticIntent?.ordinal, 'C5V2_ORACLE_STRUCTURAL_ORDINAL_MISMATCH', failures);
  }
}

function normalizedOutcomeList(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];
  const seen = new Set();
  const outcomes = [];
  for (const item of values) {
    const normalized = normalizeString(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    outcomes.push(normalized);
  }
  return outcomes;
}

function expectedOutcomesFor(operation, sourceName) {
  const sourcePlural = sourceName === 'word'
    ? operation.wordExpectedOutcomes
    : operation.yalkenExpectedOutcomes;
  const sourceSingular = sourceName === 'word'
    ? operation.wordExpectedOutcome
    : operation.yalkenExpectedOutcome;
  const pluralOutcomes = normalizedOutcomeList(sourcePlural);
  if (pluralOutcomes.length > 0) return pluralOutcomes;
  const singularOutcomes = normalizedOutcomeList(sourceSingular);
  if (singularOutcomes.length > 0) return singularOutcomes;
  return normalizedOutcomeList(operation.expectedOutcome || 'SAFE_APPLY');
}

export function validateC5V2SemanticOracle(input = {}) {
  const operations = list(input.operations);
  const failures = [];
  const expectedOperationIds = new Set();
  if (operations.length === 0) {
    failures.push({ code: 'C5V2_ORACLE_OPERATIONS_REQUIRED' });
  }
  for (const operation of operations) {
    const opId = normalizeString(operation?.id);
    if (!opId) continue;
    if (expectedOperationIds.has(opId)) {
      failures.push({ code: 'C5V2_ORACLE_OPERATION_ID_DUPLICATE', operationId: opId });
    }
    expectedOperationIds.add(opId);
  }
  const wordReadback = isPlainObject(input.wordReadback) ? input.wordReadback : {};
  const yalkenTruth = isPlainObject(input.yalkenTruth) ? input.yalkenTruth : {};
  if (!REQUIRED_WORD_SOURCE_KINDS.has(wordReadback.sourceKind)) {
    failures.push({ code: 'C5V2_ORACLE_WORD_SOURCE_KIND_REQUIRED', sourceKind: wordReadback.sourceKind || '' });
  }
  if (yalkenTruth.sourceKind !== 'reopened-yalken-project') {
    failures.push({ code: 'C5V2_ORACLE_YALKEN_REOPENED_TRUTH_REQUIRED', sourceKind: yalkenTruth.sourceKind || '' });
  }
  if (wordReadback.countsOnly === true || yalkenTruth.countsOnly === true) {
    failures.push({ code: 'C5V2_ORACLE_COUNTS_ONLY_FORBIDDEN' });
  }
  const wordOps = requireOracleMap(wordReadback, 'wordReadback.operationsById', failures);
  const yalkenOps = requireOracleMap(yalkenTruth, 'yalkenTruth.operationsById', failures);
  compareOperationIdSet(wordOps, 'word', expectedOperationIds, failures);
  compareOperationIdSet(yalkenOps, 'yalken', expectedOperationIds, failures);
  compareDocumentBlocks(input, wordReadback, yalkenTruth, failures);
  for (const operation of operations) {
    const opId = normalizeString(operation?.id);
    if (!opId) {
      failures.push({ code: 'C5V2_ORACLE_OPERATION_ID_REQUIRED' });
      continue;
    }
    const wordRecord = wordOps[opId];
    const yalkenRecord = yalkenOps[opId];
    if (!isPlainObject(wordRecord)) {
      failures.push({ code: 'C5V2_ORACLE_WORD_OPERATION_MISSING', operationId: opId });
      continue;
    }
    if (!isPlainObject(yalkenRecord)) {
      failures.push({ code: 'C5V2_ORACLE_YALKEN_OPERATION_MISSING', operationId: opId });
      continue;
    }
    const wordExpectedOutcomes = expectedOutcomesFor(operation, 'word');
    const yalkenExpectedOutcomes = expectedOutcomesFor(operation, 'yalken');
    // Word's exact-match-then-replace correctly classifies a MANUAL-expected tracked
    // operation as BLOCKED when the quote is not unique in the scene. BLOCKED is the
    // correct outcome for a manual candidate with a non-unique quote and must not
    // count as an outcome mismatch in the semantic oracle.
    const wordOutcomeBlockedAsDesigned = wordExpectedOutcomes.includes('MANUAL')
      && normalizeString(wordRecord.outcome || '') === 'BLOCKED';
    if (!wordOutcomeBlockedAsDesigned && !wordExpectedOutcomes.includes(normalizeString(wordRecord.outcome))) {
      failures.push({
        code: 'C5V2_ORACLE_WORD_OUTCOME_MISMATCH',
        operationId: opId,
        expectedOutcomes: wordExpectedOutcomes,
      });
    }
    if (!yalkenExpectedOutcomes.includes(normalizeString(yalkenRecord.outcome))) {
      failures.push({
        code: 'C5V2_ORACLE_YALKEN_OUTCOME_MISMATCH',
        operationId: opId,
        expectedOutcomes: yalkenExpectedOutcomes,
      });
    }
    compareAnchor(operation, wordRecord, 'word', failures);
    compareAnchor(operation, yalkenRecord, 'yalken', failures);
    verifyFamilySemantics(operation, wordRecord, yalkenRecord, failures);
  }
  return {
    schemaVersion: C5V2_SEMANTIC_ORACLE_SCHEMA,
    ok: failures.length === 0,
    failures,
    operationCount: operations.length,
    oracleDigest: sha256Text(stableJson({
      operations: operations.map((operation) => operation.id),
      wordSourceKind: wordReadback.sourceKind || '',
      yalkenSourceKind: yalkenTruth.sourceKind || '',
      failures,
    })),
  };
}

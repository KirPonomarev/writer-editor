'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function makeScenes() {
  return Array.from({ length: 4 }, (_, index) => ({
    sceneId: `scene-${String(index + 1).padStart(2, '0')}`,
    title: `Scene ${index + 1}`,
  }));
}

function recordFor(operation, familyExtra = {}) {
  return {
    outcome: operation.expectedOutcome || 'SAFE_APPLY',
    anchor: structuredClone(operation.anchor),
    ...familyExtra,
  };
}

test('C5V2 multilingual QA layer distributes grapheme categories across scenes without becoming sole oracle', async () => {
  const {
    buildC5V2MultilingualQaLayer,
  } = await import(path.join(REPO_ROOT, 'scripts', 'ops', 'rtk-word-c5v2-semantic-oracle.mjs'));
  const layer = buildC5V2MultilingualQaLayer({ scenes: makeScenes() });

  assert.equal(layer.schemaVersion, 'yalken.rtk.word.c5v2.multilingual-qa-layer.v1');
  assert.equal(layer.gates.ok, true);
  assert.equal(layer.categories.length, 7);
  assert.equal(layer.sceneCoverage.length, 4);
  assert.equal(layer.passages.every((passage) => passage.oracleRole === 'supporting-grapheme-qa-not-sole-routing-authority'), true);
  assert.equal(layer.operations.some((operation) => operation.family === 'tracked_text_edit'), true);
  assert.equal(layer.operations.some((operation) => operation.family === 'root_comment'), true);
  assert.equal(layer.operations.some((operation) => operation.family === 'formatting'), true);
});

test('C5V2 semantic oracle requires per-operation Word and reopened Yalken semantics, not counts', async () => {
  const {
    buildC5V2MultilingualQaLayer,
    validateC5V2SemanticOracle,
  } = await import(path.join(REPO_ROOT, 'scripts', 'ops', 'rtk-word-c5v2-semantic-oracle.mjs'));
  const layer = buildC5V2MultilingualQaLayer({ scenes: makeScenes() });
  const operations = layer.operations.slice(0, 3);
  const wordOperationsById = {};
  const yalkenOperationsById = {};
  for (const operation of operations) {
    const extra = operation.family === 'tracked_text_edit'
      ? { textSemantics: { kind: operation.semanticIntent.kind, replacementText: operation.semanticIntent.replacementText } }
      : operation.family === 'root_comment'
        ? {
            commentSemantics: {
              threadId: `thread-${operation.id}`,
              state: 'open',
              commentText: operation.semanticIntent.commentText,
              authorDisplayName: operation.semanticIntent.authorDisplayName,
            },
          }
        : { formattingSemantics: { kind: operation.semanticIntent.kind, spanType: operation.semanticIntent.spanType, effective: true } };
    wordOperationsById[operation.id] = recordFor(operation, extra);
    yalkenOperationsById[operation.id] = recordFor(operation, extra);
  }

  const good = validateC5V2SemanticOracle({
    operations,
    wordReadback: {
      sourceKind: 'raw-ooxml',
      operationsById: wordOperationsById,
    },
    yalkenTruth: {
      sourceKind: 'reopened-yalken-project',
      operationsById: yalkenOperationsById,
    },
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.failures, []);
  assert.equal(good.oracleDigest.startsWith('sha256:'), true);

  const countsOnly = validateC5V2SemanticOracle({
    operations,
    wordReadback: {
      sourceKind: 'raw-ooxml',
      countsOnly: true,
      counts: { comments: 1, revisions: 1 },
    },
    yalkenTruth: {
      sourceKind: 'reopened-yalken-project',
      countsOnly: true,
      counts: { comments: 1, revisions: 1 },
    },
  });
  assert.equal(countsOnly.ok, false);
  assert.equal(countsOnly.failures.some((failure) => failure.code === 'C5V2_ORACLE_COUNTS_ONLY_FORBIDDEN'), true);
  assert.equal(countsOnly.failures.some((failure) => failure.code === 'C5V2_ORACLE_OPERATION_MAP_REQUIRED'), true);

  const wrongSceneWord = structuredClone(wordOperationsById);
  wrongSceneWord[operations[0].id].anchor.sceneId = 'wrong-scene';
  const wrongScene = validateC5V2SemanticOracle({
    operations,
    wordReadback: {
      sourceKind: 'word-object-model',
      operationsById: wrongSceneWord,
    },
    yalkenTruth: {
      sourceKind: 'reopened-yalken-project',
      operationsById: yalkenOperationsById,
    },
  });
  assert.equal(wrongScene.ok, false);
  assert.equal(wrongScene.failures.some((failure) => failure.code === 'C5V2_ORACLE_ANCHOR_MISMATCH' && failure.field === 'sceneId'), true);

  const wrongParagraphWord = structuredClone(wordOperationsById);
  wrongParagraphWord[operations[0].id].anchor.paragraphId = 'wrong-paragraph';
  const wrongParagraph = validateC5V2SemanticOracle({
    operations,
    wordReadback: {
      sourceKind: 'word-object-model',
      operationsById: wrongParagraphWord,
    },
    yalkenTruth: {
      sourceKind: 'reopened-yalken-project',
      operationsById: yalkenOperationsById,
    },
  });
  assert.equal(wrongParagraph.ok, false);
  assert.notEqual(wrongParagraph.oracleDigest, wrongScene.oracleDigest);
});

test('C5V2 semantic oracle rejects recorded O01-O04 false-green mutants', async () => {
  const {
    buildC5V2MultilingualQaLayer,
    validateC5V2SemanticOracle,
  } = await import(path.join(REPO_ROOT, 'scripts', 'ops', 'rtk-word-c5v2-semantic-oracle.mjs'));
  const layer = buildC5V2MultilingualQaLayer({ scenes: makeScenes() });
  const structuralOperation = {
    id: 'c5v2-structural-chapter-split-001',
    family: 'structural',
    sceneId: 'scene-02',
    anchor: structuredClone(layer.passages[1].anchor),
    semanticIntent: { kind: 'chapter-split', heading: 'Chapter 2 - Anchor', ordinal: 2 },
    expectedOutcome: 'SAFE_APPLY',
  };
  const operations = [...layer.operations.slice(0, 3), structuralOperation];
  const textOperation = operations.find((operation) => operation.family === 'tracked_text_edit');
  const commentOperation = operations.find((operation) => operation.family === 'root_comment');
  const formattingOperation = operations.find((operation) => operation.family === 'formatting');

  function strictRecordFor(operation) {
    if (operation.family === 'tracked_text_edit') {
      return recordFor(operation, {
        textSemantics: {
          kind: operation.semanticIntent.kind,
          replacementText: operation.semanticIntent.replacementText,
        },
      });
    }
    if (operation.family === 'root_comment') {
      return recordFor(operation, {
        commentSemantics: {
          threadId: `thread-${operation.id}`,
          state: 'open',
          commentText: operation.semanticIntent.commentText,
          authorDisplayName: operation.semanticIntent.authorDisplayName,
        },
      });
    }
    if (operation.family === 'formatting') {
      return recordFor(operation, {
        formattingSemantics: {
          kind: operation.semanticIntent.kind,
          spanType: operation.semanticIntent.spanType,
          effective: true,
        },
      });
    }
    return recordFor(operation, {
      structuralSemantics: {
        kind: operation.semanticIntent.kind,
        heading: operation.semanticIntent.heading,
        ordinal: operation.semanticIntent.ordinal,
      },
    });
  }

  function makeInput() {
    const wordOperationsById = {};
    const yalkenOperationsById = {};
    for (const operation of operations) {
      wordOperationsById[operation.id] = strictRecordFor(operation);
      yalkenOperationsById[operation.id] = strictRecordFor(operation);
    }
    return {
      operations,
      wordReadback: {
        sourceKind: 'raw-ooxml',
        operationsById: wordOperationsById,
      },
      yalkenTruth: {
        sourceKind: 'reopened-yalken-project',
        operationsById: yalkenOperationsById,
      },
    };
  }

  const control = validateC5V2SemanticOracle(makeInput());
  assert.equal(control.ok, true);

  function assertRejects(mutator, expectedCode) {
    const input = makeInput();
    mutator(input);
    const result = validateC5V2SemanticOracle(input);
    assert.equal(result.ok, false);
    assert.equal(result.failures.some((failure) => failure.code === expectedCode), true);
  }

  assertRejects((input) => {
    const extraRecord = structuredClone(input.wordReadback.operationsById[textOperation.id]);
    extraRecord.anchor.paragraphId = 'foreign-extra-paragraph-999';
    input.wordReadback.operationsById['foreign-extra-operation-999'] = extraRecord;
    input.yalkenTruth.operationsById['foreign-extra-operation-999'] = structuredClone(extraRecord);
  }, 'C5V2_ORACLE_UNEXPECTED_OPERATION');

  assertRejects((input) => {
    delete input.wordReadback.operationsById[commentOperation.id].commentSemantics.commentText;
    delete input.yalkenTruth.operationsById[commentOperation.id].commentSemantics.commentText;
  }, 'C5V2_ORACLE_COMMENT_BODY_MISMATCH');

  assertRejects((input) => {
    delete input.wordReadback.operationsById[commentOperation.id].commentSemantics.authorDisplayName;
    delete input.yalkenTruth.operationsById[commentOperation.id].commentSemantics.authorDisplayName;
  }, 'C5V2_ORACLE_COMMENT_AUTHOR_MISMATCH');

  assertRejects((input) => {
    input.yalkenTruth.operationsById[formattingOperation.id].formattingSemantics.kind = 'underline-not-bold';
  }, 'C5V2_ORACLE_FORMATTING_KIND_MISMATCH');

  assertRejects((input) => {
    input.yalkenTruth.operationsById[structuralOperation.id].structuralSemantics.heading = 'Wrong chapter heading';
  }, 'C5V2_ORACLE_STRUCTURAL_HEADING_MISMATCH');
});

test('C5V2 semantic oracle fails closed on ordered document block evidence without exact expectation', async () => {
  const {
    buildC5V2MultilingualQaLayer,
    validateC5V2SemanticOracle,
  } = await import(path.join(REPO_ROOT, 'scripts', 'ops', 'rtk-word-c5v2-semantic-oracle.mjs'));
  const layer = buildC5V2MultilingualQaLayer({ scenes: makeScenes() });
  const operations = layer.operations.slice(0, 1);
  const record = recordFor(operations[0], {
    textSemantics: {
      kind: operations[0].semanticIntent.kind,
      replacementText: operations[0].semanticIntent.replacementText,
    },
  });

  const missingExpectation = validateC5V2SemanticOracle({
    operations,
    wordReadback: {
      sourceKind: 'raw-ooxml',
      operationsById: { [operations[0].id]: structuredClone(record) },
      documentBlocks: [{ ordinal: 1, sceneId: 'scene-01', text: 'Foreign extra text' }],
    },
    yalkenTruth: {
      sourceKind: 'reopened-yalken-project',
      operationsById: { [operations[0].id]: structuredClone(record) },
      documentBlocks: [{ ordinal: 1, sceneId: 'scene-01', text: 'Foreign extra text' }],
    },
  });
  assert.equal(missingExpectation.ok, false);
  assert.equal(missingExpectation.failures.some((failure) => failure.code === 'C5V2_ORACLE_DOCUMENT_BLOCK_EXPECTATION_REQUIRED'), true);

  const exactBlocks = [{ ordinal: 1, sceneId: 'scene-01', blockId: 'p1', kind: 'paragraph', text: 'Exact paragraph text' }];
  const mismatch = validateC5V2SemanticOracle({
    operations,
    expectedDocumentBlocks: exactBlocks,
    wordReadback: {
      sourceKind: 'raw-ooxml',
      operationsById: { [operations[0].id]: structuredClone(record) },
      documentBlocks: exactBlocks,
    },
    yalkenTruth: {
      sourceKind: 'reopened-yalken-project',
      operationsById: { [operations[0].id]: structuredClone(record) },
      documentBlocks: [{ ...exactBlocks[0], text: 'Exact paragraph text plus foreign' }],
    },
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.failures.some((failure) => failure.code === 'C5V2_ORACLE_DOCUMENT_BLOCK_MISMATCH' && failure.source === 'yalken'), true);
});

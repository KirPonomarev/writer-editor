const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-docx-part-policy.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function entry(overrides = {}) {
  const candidate = {
    id: 'word/document.xml',
    kind: 'knownPart',
    byteSize: 100,
    compressedSize: 50,
    story: 'main',
    markers: ['documentPart'],
    ...overrides,
  };
  for (const key of Object.keys(candidate)) {
    if (candidate[key] === undefined) delete candidate[key];
  }
  return candidate;
}

function inventory(entries = [entry()]) {
  return { entries };
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function changedFilesOutsideAllowlist(changedFiles) {
  const allowedPaths = new Set(ALLOWLIST);
  return changedFiles.filter((filePath) => !allowedPaths.has(filePath));
}

function findKeys(value, deniedKeys, pathSegments = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findKeys(item, deniedKeys, pathSegments.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];

  return Object.keys(value).flatMap((key) => {
    const keyPath = pathSegments.concat(key);
    const nested = findKeys(value[key], deniedKeys, keyPath);
    return deniedKeys.includes(key) ? [keyPath.join('.'), ...nested] : nested;
  });
}

function assertOutputShape(result) {
  assert.deepEqual(Object.keys(result), [
    'schemaVersion',
    'type',
    'status',
    'code',
    'reason',
    'decision',
    'categories',
    'diagnostics',
    'evidence',
    'eligibility',
  ]);
  assert.equal(result.schemaVersion, 'revision-bridge.docx-part-policy.v1');
  assert.equal(result.type, 'docxPartPolicyClassification');
  assert.deepEqual(Object.keys(result.categories), [
    'mainDocumentPart',
    'knownSupportPart',
    'mediaPart',
    'relationshipPart',
    'unsupportedStoryPart',
    'unknownPart',
    'directoryPart',
  ]);
  for (const category of Object.values(result.categories)) {
    assert.deepEqual(Object.keys(category), ['count', 'entryIds']);
  }
  assert.deepEqual(Object.keys(result.eligibility), [
    'safe',
    'parserCandidateOnly',
    'canCreateReviewPacket',
    'canPreviewApply',
    'canImportMutate',
    'canWriteStorage',
  ]);
}

function assertNoWriteEligibility(result, parserCandidateOnly) {
  assert.equal(result.eligibility.safe, true);
  assert.equal(result.eligibility.parserCandidateOnly, parserCandidateOnly);
  assert.equal(result.eligibility.canCreateReviewPacket, false);
  assert.equal(result.eligibility.canPreviewApply, false);
  assert.equal(result.eligibility.canImportMutate, false);
  assert.equal(result.eligibility.canWriteStorage, false);
}

test('RB-08 exports DOCX part policy API and exact output shape', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.DOCX_PART_POLICY_SCHEMA, 'revision-bridge.docx-part-policy.v1');
  assert.deepEqual(bridge.DOCX_PART_POLICY_DECISIONS, {
    ACCEPTED: 'accepted',
    DEGRADED: 'degraded',
    REJECTED: 'rejected',
  });
  assert.equal(
    bridge.DOCX_PART_POLICY_DIAGNOSTIC_CODES.RELATIONSHIP_REQUIRES_FUTURE_PARSER,
    'DOCX_PART_POLICY_RELATIONSHIP_REQUIRES_FUTURE_PARSER',
  );
  assert.equal(typeof bridge.classifyDocxPartPolicy, 'function');

  assertOutputShape(bridge.classifyDocxPartPolicy(inventory()));
});

test('RB-08 accepts clean minimal inventory as parser candidate only', async () => {
  const bridge = await loadBridge();
  const result = bridge.classifyDocxPartPolicy(inventory([
    entry(),
    entry({
      id: 'word/styles.xml',
      story: undefined,
      markers: undefined,
    }),
  ]));

  assertOutputShape(result);
  assert.equal(result.status, 'accepted');
  assert.equal(result.decision, 'accepted');
  assert.equal(result.code, 'DOCX_PART_POLICY_ACCEPTED');
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.categories.mainDocumentPart, {
    count: 1,
    entryIds: ['word/document.xml'],
  });
  assert.deepEqual(result.categories.knownSupportPart, {
    count: 1,
    entryIds: ['word/styles.xml'],
  });
  assertNoWriteEligibility(result, true);
});

test('RB-08 degrades when main document is missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.classifyDocxPartPolicy(inventory([
    entry({
      id: 'word/styles.xml',
      story: undefined,
      markers: undefined,
    }),
  ]));

  assert.equal(result.decision, 'degraded');
  assert.equal(result.code, 'DOCX_PART_POLICY_MAIN_DOCUMENT_MISSING');
  assert.deepEqual(diagnosticCodes(result), ['DOCX_PART_POLICY_MAIN_DOCUMENT_MISSING']);
  assertNoWriteEligibility(result, false);
});

test('RB-08 degrades duplicate main documents', async () => {
  const bridge = await loadBridge();
  const result = bridge.classifyDocxPartPolicy(inventory([
    entry({ id: 'word/document.xml' }),
    entry({ id: 'word/document-copy.xml' }),
  ]));

  assert.equal(result.decision, 'degraded');
  assert.equal(result.code, 'DOCX_PART_POLICY_MAIN_DOCUMENT_DUPLICATE');
  assert.deepEqual(diagnosticCodes(result), [
    'DOCX_PART_POLICY_MAIN_DOCUMENT_DUPLICATE',
    'DOCX_PART_POLICY_MAIN_DOCUMENT_DUPLICATE',
  ]);
  assert.deepEqual(result.categories.mainDocumentPart.entryIds, [
    'word/document-copy.xml',
    'word/document.xml',
  ]);
});

test('RB-08 relationship parts require a future parser and never authorize import', async () => {
  const bridge = await loadBridge();
  const result = bridge.classifyDocxPartPolicy(inventory([
    entry(),
    entry({
      id: 'word/_rels/document.xml.rels',
      kind: 'relationshipPart',
      story: undefined,
      markers: ['relationship'],
    }),
  ]));

  assert.equal(result.decision, 'degraded');
  assert.equal(result.code, 'DOCX_PART_POLICY_RELATIONSHIP_REQUIRES_FUTURE_PARSER');
  assert.deepEqual(diagnosticCodes(result), ['DOCX_PART_POLICY_RELATIONSHIP_REQUIRES_FUTURE_PARSER']);
  assertNoWriteEligibility(result, false);
});

test('RB-08 unsupported story, unknown, directory, and media are diagnostics-only degraded categories', async () => {
  const bridge = await loadBridge();
  const cases = [
    [
      entry({ id: 'word/header1.xml', story: 'unsupported', markers: ['unsupportedStory'] }),
      'unsupportedStoryPart',
      'DOCX_PART_POLICY_UNSUPPORTED_STORY_DIAGNOSTICS_ONLY',
    ],
    [
      entry({ id: 'custom/item.bin', kind: 'unknownPart', story: undefined, markers: undefined }),
      'unknownPart',
      'DOCX_PART_POLICY_UNKNOWN_PART_DIAGNOSTICS_ONLY',
    ],
    [
      entry({ id: 'folder/', kind: 'directory', story: undefined, markers: undefined }),
      'directoryPart',
      'DOCX_PART_POLICY_DIRECTORY_DIAGNOSTICS_ONLY',
    ],
    [
      entry({ id: 'word/media/image1.png', story: undefined, markers: ['mediaPart'] }),
      'mediaPart',
      'DOCX_PART_POLICY_MEDIA_DIAGNOSTICS_ONLY',
    ],
  ];

  for (const [candidate, category, code] of cases) {
    const result = bridge.classifyDocxPartPolicy(inventory([entry(), candidate]));
    assert.equal(result.decision, 'degraded');
    assert.equal(result.code, code);
    assert.equal(result.categories[category].count, 1);
    assert.deepEqual(diagnosticCodes(result), [code]);
    assertNoWriteEligibility(result, false);
  }
});

test('RB-08 rejects malformed and quarantined RB-05 inspection', async () => {
  const bridge = await loadBridge();
  const malformed = bridge.classifyDocxPartPolicy({ entries: [entry({ id: '' })] });
  const quarantined = bridge.classifyDocxPartPolicy(inventory([
    entry({
      id: 'huge',
      byteSize: bridge.DOCX_PACKAGE_BOUNDARY_BUDGETS.maxEntryBytes + 1,
    }),
  ]));

  for (const result of [malformed, quarantined]) {
    assert.equal(result.decision, 'rejected');
    assert.equal(result.status, 'rejected');
    assert.equal(result.code, 'DOCX_PART_POLICY_PACKAGE_REJECTED');
    assert.deepEqual(diagnosticCodes(result), ['DOCX_PART_POLICY_PACKAGE_REJECTED']);
    assertNoWriteEligibility(result, false);
  }
  assert.equal(malformed.evidence[0].classification, 'malformed');
  assert.equal(quarantined.evidence[0].classification, 'quarantined');
});

test('RB-08 accepts RB-06 materialization result and degrades mixed known plus unsupported evidence', async () => {
  const bridge = await loadBridge();
  const materialized = {
    ok: true,
    type: 'docxZipInventoryMaterialization',
    status: 'materialized',
    code: 'DOCX_ZIP_INVENTORY_MATERIALIZED',
    reason: 'DOCX_ZIP_INVENTORY_MATERIALIZED',
    inventory: inventory([
      entry(),
      entry({
        id: 'word/numbering.xml',
        story: undefined,
        markers: undefined,
      }),
      entry({
        id: 'word/comments.xml',
        story: 'unsupported',
        markers: ['unsupportedStory'],
      }),
    ]),
  };
  materialized.inspection = bridge.inspectDocxPackageInventory(materialized.inventory);

  const result = bridge.classifyDocxPartPolicy(materialized);

  assert.equal(result.decision, 'degraded');
  assert.equal(result.categories.mainDocumentPart.count, 1);
  assert.equal(result.categories.knownSupportPart.count, 1);
  assert.equal(result.categories.unsupportedStoryPart.count, 1);
  assert.deepEqual(diagnosticCodes(result), ['DOCX_PART_POLICY_UNSUPPORTED_STORY_DIAGNOSTICS_ONLY']);
});

test('RB-08 evidence ordering is deterministic and input is not mutated', async () => {
  const bridge = await loadBridge();
  const input = inventory([
    entry({ id: 'word/document.xml' }),
    entry({ id: 'z-unknown', kind: 'unknownPart', story: undefined, markers: undefined }),
    entry({ id: 'a-media', story: undefined, markers: ['mediaPart'] }),
  ]);
  const before = deepClone(input);

  const first = bridge.classifyDocxPartPolicy(input);
  const second = bridge.classifyDocxPartPolicy(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.deepEqual(first.evidence.map((item) => [item.category, item.entryId || item.code]), [
    ['mainDocumentPart', 'word/document.xml'],
    ['mediaPart', 'a-media'],
    ['packageInspection', 'DOCX_UNKNOWN_PART_PRESENT'],
    ['unknownPart', 'z-unknown'],
  ]);
});

test('RB-08 rejects paths, binary-like handles, streams, XML strings, and parsed trees', async () => {
  const bridge = await loadBridge();
  const binaryKey = 'b' + 'ytes';
  const binaryStoreKey = 'b' + 'uffer';
  const pathKey = 'p' + 'ath';
  const cases = [
    'review.docx',
    '<w:document />',
    { [pathKey]: 'review.docx', entries: [] },
    { [binaryKey]: [1], entries: [] },
    { [binaryStoreKey]: [1], entries: [] },
    { byteLength: 1, slice() {} },
    { stream() {} },
    { pipe() {} },
    { getReader() {} },
    { arrayBuffer() {}, name: 'review.docx' },
    { nodeType: 1, nodeName: 'w:document' },
    { documentElement: { nodeName: 'w:document' } },
  ];

  for (const input of cases) {
    const result = bridge.classifyDocxPartPolicy(input);
    assert.equal(result.decision, 'rejected');
    assert.equal(result.code, 'DOCX_PART_POLICY_INPUT_REJECTED');
    assert.deepEqual(diagnosticCodes(result), ['DOCX_PART_POLICY_INPUT_REJECTED']);
  }
});

test('RB-08 recursively omits forbidden import, packet, and authorization keys', async () => {
  const bridge = await loadBridge();
  const result = bridge.classifyDocxPartPolicy({
    inventory: inventory(),
    reviewPacket: { apply: true },
    previewInput: { authorized: true },
    revisionBridgePreviewResult: { applyPlan: [] },
    canApply: true,
    applyPlan: [],
    apply: true,
    authorized: true,
  });

  assert.deepEqual(findKeys(result, [
    'reviewPacket',
    'previewInput',
    'revisionBridgePreviewResult',
    'canApply',
    'applyPlan',
    'apply',
    'authorized',
  ]), []);
});

test('RB-08 implementation section has no forbidden side-effect or parser tokens', () => {
  const text = fs.readFileSync(MODULE_PATH, 'utf8');
  const sectionStart = text.indexOf('RB_08_DOCX_PART_POLICY_CLASSIFIER_START');
  const sectionEnd = text.indexOf('RB_08_DOCX_PART_POLICY_CLASSIFIER_END');
  const section = text.slice(sectionStart, sectionEnd);
  const forbiddenPatterns = [
    /\bfs\b/u,
    /\breadFile\b/u,
    /\bwriteFile\b/u,
    /\bpath\b/u,
    /\bipc\b/u,
    /\belectron\b/u,
    /\bfetch\b/u,
    /\bhttp\b/u,
    /\bhttps\b/u,
    /\bJSZip\b/u,
    /\byauzl\b/u,
    /\badmzip\b/u,
    /\bunzip\b/u,
    /\binflate\b/u,
    /\bdeflate\b/u,
    /\bDOMParser\b/u,
    /\bXMLParser\b/u,
    /\bxmldom\b/u,
    /\bsax\b/u,
    /\bfast-xml-parser\b/u,
    /\breviewPacket\b/u,
    /\bpreviewInput\b/u,
    /\brevisionBridgePreviewResult\b/u,
    /\bcanApply\b/u,
    /\bapplyPlan\b/u,
  ];

  assert.notEqual(sectionStart, -1);
  assert.notEqual(sectionEnd, -1);
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(section), false, `forbidden RB-08 pattern: ${pattern.source}`);
  }
});

test('RB-08 changed files stay inside the exact task allowlist and package manifests are untouched', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
  assert.equal(changedFiles.includes('package.json'), false);
  assert.equal(changedFiles.includes('package-lock.json'), false);
});

test('RB-08 changed-file allowlist still rejects outside paths', () => {
  assert.deepEqual(changedFilesOutsideAllowlist([]), []);
  assert.deepEqual(changedFilesOutsideAllowlist([TEST_PATH]), []);
  assert.deepEqual(changedFilesOutsideAllowlist(ALLOWLIST), []);
  assert.deepEqual(
    changedFilesOutsideAllowlist([
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb08-probe-unique.js',
    ]),
    [
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb08-probe-unique.js',
    ],
  );
});

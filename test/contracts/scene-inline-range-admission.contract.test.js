const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();
const FIXTURES_DIR = path.join(ROOT, 'test', 'fixtures', 'scene-inline-range-admission');
const MODULE_PATH = path.join(ROOT, 'src', 'core', 'sceneInlineRangeAdmission.mjs');

function readJsonFixture(basename) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, basename), 'utf8'));
}

async function loadInlineAdmission() {
  return import(pathToFileURL(MODULE_PATH).href);
}

test('scene inline range admission: simple bold and italic ranges are accepted canonically', async () => {
  const admission = await loadInlineAdmission();
  const cases = [
    ['inline-simple-range.valid.json', 'Alpha'],
    ['inline-multimark-range.valid.json', 'Alpha Beta'],
  ];

  for (const [basename, blockText] of cases) {
    const source = readJsonFixture(basename);
    const result = admission.admitSceneInlineRange(source, {
      blockId: source.blockId,
      blockText,
    });
    assert.equal(result.ok, true, basename);
    assert.equal(result.admitted, true, basename);
    assert.equal(result.offsetUnit, 'utf16_code_unit', basename);
    assert.match(result.normalizedHashSha256, /^[0-9a-f]{64}$/u, basename);
  }
});

test('scene inline range admission: grapheme combining mark and emoji boundaries are accepted only on full boundaries', async () => {
  const admission = await loadInlineAdmission();
  const grapheme = readJsonFixture('inline-grapheme.valid.json');
  const combining = readJsonFixture('inline-combining-mark.valid.json');
  const emoji = readJsonFixture('inline-emoji-sequence.valid.json');

  assert.equal(
    admission.admitSceneInlineRange(grapheme, {
      blockId: grapheme.blockId,
      blockText: 'Cafe\u0301',
    }).ok,
    true,
  );
  assert.equal(
    admission.admitSceneInlineRange(combining, {
      blockId: combining.blockId,
      blockText: 'Cafe\u0301',
    }).ok,
    true,
  );
  assert.equal(
    admission.admitSceneInlineRange(emoji, {
      blockId: emoji.blockId,
      blockText: 'A👨‍👩‍👧‍👦B',
    }).ok,
    true,
  );
});

test('scene inline range admission: CRLF and LF variants keep truthful inline boundaries in the same declared offset model', async () => {
  const admission = await loadInlineAdmission();

  const crlf = admission.admitSceneInlineRange({
    id: 'range-crlf',
    blockId: 'block-1',
    startOffset: 3,
    endOffset: 4,
    markType: 'bold',
  }, {
    blockId: 'block-1',
    blockText: 'A\r\nB',
  });
  const lf = admission.admitSceneInlineRange({
    id: 'range-lf',
    blockId: 'block-1',
    startOffset: 2,
    endOffset: 3,
    markType: 'bold',
  }, {
    blockId: 'block-1',
    blockText: 'A\nB',
  });

  assert.equal(crlf.ok, true);
  assert.equal(lf.ok, true);
  assert.equal(crlf.range.startOffset, 3);
  assert.equal(crlf.range.endOffset, 4);
  assert.equal(lf.range.startOffset, 2);
  assert.equal(lf.range.endOffset, 3);
});

test('scene inline range admission: reversed out-of-block grapheme-split and unknown-mark fixtures are rejected', async () => {
  const admission = await loadInlineAdmission();
  const expectations = new Map([
    ['inline-reversed-range.invalid.json', ['Alpha', 'E_SCENE_INLINE_RANGE_EMPTY_OR_REVERSED']],
    ['inline-out-of-block.invalid.json', ['Alpha', 'E_SCENE_INLINE_RANGE_OUT_OF_BLOCK']],
    ['inline-split-grapheme.invalid.json', ['Cafe\u0301', 'E_SCENE_INLINE_RANGE_GRAPHEME_SPLIT']],
    ['inline-unknown-mark.invalid.json', ['Alpha', 'E_SCENE_INLINE_RANGE_MARK_TYPE_INVALID']],
  ]);

  for (const [basename, [blockText, code]] of expectations.entries()) {
    const source = readJsonFixture(basename);
    const result = admission.admitSceneInlineRange(source, {
      blockId: source.blockId,
      blockText,
    });
    assert.equal(result.ok, false, basename);
    assert.equal(result.error.code, code, basename);
  }
});

test('scene inline range admission: set admission keeps canonical sort stability for overlapping and nested ranges', async () => {
  const admission = await loadInlineAdmission();
  const ranges = [
    {
      id: 'range-b',
      blockId: 'block-1',
      startOffset: 2,
      endOffset: 5,
      markType: 'italic',
    },
    {
      id: 'range-a',
      blockId: 'block-1',
      startOffset: 0,
      endOffset: 5,
      markType: 'bold',
    },
  ];

  const result = admission.admitSceneInlineRangeSet(ranges, {
    blockId: 'block-1',
    blockText: 'Alpha',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.ranges.map((range) => range.id), ['range-a', 'range-b']);
});

test('scene inline range admission: range hash stays stable for equivalent empty payload', async () => {
  const admission = await loadInlineAdmission();
  const first = admission.admitSceneInlineRange({
    id: 'range-1',
    blockId: 'block-1',
    startOffset: 0,
    endOffset: 5,
    markType: 'bold',
  }, {
    blockId: 'block-1',
    blockText: 'Alpha',
  });
  const second = admission.admitSceneInlineRange({
    id: 'range-1',
    blockId: 'block-1',
    startOffset: 0,
    endOffset: 5,
    markType: 'bold',
    payload: {},
  }, {
    blockId: 'block-1',
    blockText: 'Alpha',
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.normalizedHashSha256, second.normalizedHashSha256);
});

test('scene inline range admission: text edit shift and block split policies stay pure stability rules', async () => {
  const admission = await loadInlineAdmission();
  const shifted = admission.shiftSceneInlineRange({
    id: 'range-1',
    blockId: 'block-1',
    startOffset: 1,
    endOffset: 4,
    markType: 'bold',
  }, {
    offset: 0,
    deleteCount: 0,
    insertText: 'Z',
  });

  assert.deepEqual(
    shifted,
    {
      id: 'range-1',
      blockId: 'block-1',
      startOffset: 2,
      endOffset: 5,
      markType: 'bold',
    },
  );

  assert.equal(
    admission.classifySceneInlineRangeSplit({
      id: 'range-2',
      blockId: 'block-1',
      startOffset: 1,
      endOffset: 3,
      markType: 'italic',
    }, 2),
    'crosses',
  );
});

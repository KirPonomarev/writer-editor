const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const SECTION_START = '// CONTOUR_01A_REVIEW_MUTATE_PORT_START';
const SECTION_END = '// CONTOUR_01A_REVIEW_MUTATE_PORT_END';

function readMainSource() {
  return fs.readFileSync(MAIN_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasReviewSurfacePayload(value) {
  return isPlainObjectValue(value) && Object.keys(value).length > 0;
}

function computeHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function instantiateReviewMutatePort() {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const sandbox = {
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
    cloneJsonSafe,
    computeHash,
    hasReviewSurfacePayload,
    isPlainObjectValue,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}
module.exports = {
  resetActiveReviewSessionStore,
  normalizeReviewSessionImportRecord,
  cloneActiveReviewSessionStore,
  readActiveReviewSessionReviewSurface,
  handleReviewSurfaceImportPacketCommandSurface,
  handleReviewSurfaceClearSessionCommandSurface,
  handleReviewSurfaceApplyExactTextChangeCommandSurface,
  getState() {
    return {
      activeReviewSessionStore,
      activeReviewSessionLifecycle,
      currentReviewSurfacePayload,
      currentReviewSurfacePayloadSource,
      currentReviewSurfacePayloadContentHash,
    };
  },
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
}

function normalizeVmValue(value) {
  return cloneJsonSafe(value);
}

test('review mutate port contract: review commands are exposed through ui command bridge and menu handlers', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.review\.importPacket'[\s\S]*'cmd\.project\.review\.clearSession'[\s\S]*'cmd\.project\.review\.applyExactTextChange'/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.importPacket':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleReviewSurfaceImportPacketCommandSurface\(payload\);/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.clearSession':\s*async\s*\(\)\s*=>\s*\{\s*return handleReviewSurfaceClearSessionCommandSurface\(\);/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.applyExactTextChange':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleReviewSurfaceApplyExactTextChangeCommandSurface\(payload\);/,
  );
});

test('review mutate port contract: import stores canonical in-memory session shape', () => {
  const port = instantiateReviewMutatePort();

  const payload = {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: {
      summary: { total: 1 },
      changes: [{ changeId: 'change-1' }],
    },
    revisionSession: {
      status: 'preview',
    },
    sourcePacketHash: 'packet-hash-1',
    createdAt: '2026-05-24T12:00:00.000Z',
  };

  const result = port.handleReviewSurfaceImportPacketCommandSurface(payload);
  const state = port.getState();

  assert.equal(result.ok, true);
  assert.deepEqual(normalizeVmValue(result.reviewSurface), payload.reviewSurface);
  assert.deepEqual(normalizeVmValue(result.session), {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: payload.reviewSurface,
    revisionSession: { status: 'preview' },
    sourcePacketHash: 'packet-hash-1',
    createdAt: '2026-05-24T12:00:00.000Z',
  });
  assert.equal(state.activeReviewSessionLifecycle, 'active');
  assert.deepEqual(normalizeVmValue(state.activeReviewSessionStore), normalizeVmValue(result.session));
  assert.deepEqual(normalizeVmValue(state.currentReviewSurfacePayload), payload.reviewSurface);
  assert.equal(state.currentReviewSurfacePayloadSource, 'session');
  assert.equal(state.currentReviewSurfacePayloadContentHash, '');
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), payload.reviewSurface);
});

test('review mutate port contract: import rejects payload without required metadata', () => {
  const port = instantiateReviewMutatePort();

  const result = port.handleReviewSurfaceImportPacketCommandSurface({
    reviewSurface: {
      summary: { total: 1 },
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(normalizeVmValue(result.error), {
    code: 'E_REVIEW_SESSION_IMPORT_INVALID',
    op: 'cmd.project.review.importPacket',
    reason: 'REVIEW_SESSION_METADATA_REQUIRED',
  });
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), {});
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('review mutate port contract: clear closes active session and read returns empty surface', () => {
  const port = instantiateReviewMutatePort();

  port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: {
      summary: { total: 1 },
    },
  });

  const result = port.handleReviewSurfaceClearSessionCommandSurface();
  const state = port.getState();

  assert.deepEqual(normalizeVmValue(result), {
    ok: true,
    cleared: true,
    hadActiveSession: true,
  });
  assert.equal(state.activeReviewSessionLifecycle, 'cleared');
  assert.equal(state.activeReviewSessionStore, null);
  assert.deepEqual(normalizeVmValue(state.currentReviewSurfacePayload), {});
  assert.equal(state.currentReviewSurfacePayloadSource, 'none');
  assert.equal(state.currentReviewSurfacePayloadContentHash, '');
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), {});
});

test('review mutate port contract: reserved apply stays typed disabled until contour 04', () => {
  const port = instantiateReviewMutatePort();

  const result = port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    projectId: 'project-1',
  });

  assert.deepEqual(normalizeVmValue(result), {
    ok: false,
    error: {
      code: 'E_REVIEW_EXACT_TEXT_CHANGE_NOT_ENABLED',
      op: 'cmd.project.review.applyExactTextChange',
      reason: 'REVIEW_EXACT_TEXT_CHANGE_NOT_ENABLED',
      details: {
        status: 'RESERVED_UNTIL_CONTOUR_04',
      },
    },
  });
});

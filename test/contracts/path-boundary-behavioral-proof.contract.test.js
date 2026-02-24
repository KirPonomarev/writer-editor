const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pathBoundary = require('../../src/core/io/path-boundary.js');

function readText(filePath) {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

test('path-boundary behavioral proof: positive within-root path is accepted', () => {
  const projectRoot = path.join(process.cwd(), 'docs');
  const state = pathBoundary.validatePathWithinRoot(
    'OPS/STATUS/XPLAT_ROLLOUT_PLAN_v3_12.json',
    projectRoot,
    { mode: 'relative', resolveSymlinks: true },
  );

  assert.equal(state.ok, true);
  assert.equal(state.failSignal, '');
  assert.equal(state.failReason, '');
  assert.ok(state.resolvedPath.startsWith(projectRoot));
});

test('path-boundary negative bypass: parent traversal is rejected with failSignal', () => {
  const projectRoot = path.join(process.cwd(), 'docs');
  const state = pathBoundary.validatePathWithinRoot('../etc/passwd', projectRoot, {
    mode: 'any',
    resolveSymlinks: true,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failSignal, 'E_PATH_BOUNDARY_VIOLATION');
  assert.equal(state.failReason, 'PATH_SEGMENT_FORBIDDEN');
});

test('path-boundary negative bypass: absolute path is rejected with failSignal', () => {
  const projectRoot = path.join(process.cwd(), 'docs');
  const state = pathBoundary.validatePathWithinRoot('/tmp/unsafe.txt', projectRoot, {
    mode: 'relative',
    resolveSymlinks: true,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failSignal, 'E_PATH_BOUNDARY_VIOLATION');
  assert.equal(state.failReason, 'PATH_ABSOLUTE_FORBIDDEN');
});

test('path-boundary negative bypass: sanitizePathFieldsWithinRoot rejects file scheme', () => {
  const projectRoot = path.join(process.cwd(), 'docs');
  const state = pathBoundary.sanitizePathFieldsWithinRoot(
    { path: 'file:///tmp/unsafe.txt' },
    ['path'],
    projectRoot,
    { mode: 'any', resolveSymlinks: true },
  );

  assert.equal(state.ok, false);
  assert.equal(state.failSignal, 'E_PATH_BOUNDARY_VIOLATION');
  assert.equal(state.field, 'path');
  assert.equal(state.failReason, 'PATH_PREFIX_FORBIDDEN');
});

test('path-boundary failSignal wiring proof: runtime handlers emit E_PATH_BOUNDARY_VIOLATION', () => {
  const mainText = readText('src/main.js');

  assert.match(mainText, /function makePathBoundaryViolationResult\(/u);
  assert.match(mainText, /code:\s*'E_PATH_BOUNDARY_VIOLATION'/u);
  assert.match(mainText, /failSignal:\s*'E_PATH_BOUNDARY_VIOLATION'/u);
  assert.match(mainText, /flow_save_path_boundary_violation/u);
});

test('path-boundary source-binding proof: runtime uses centralized guard bound to core path-boundary module', () => {
  const mainText = readText('src/main.js');
  const guardText = readText('src/core/io/path-boundary.js');

  assert.match(mainText, /require\('\.\/core\/io\/path-boundary'\)/u);
  assert.match(mainText, /function sanitizePayloadWithinProjectRoot\(/u);

  const guardCallCount = (mainText.match(/sanitizePayloadWithinProjectRoot\(/gu) || []).length;
  assert.ok(guardCallCount >= 6);

  assert.match(guardText, /const FAIL_SIGNAL = 'E_PATH_BOUNDARY_VIOLATION'/u);
  assert.match(guardText, /function sanitizePathFieldsWithinRoot\(/u);
});

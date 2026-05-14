const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('page boundary input smoke: type enter undo redo stay stable on first sheet boundary', () => {
  const result = spawnSync(process.execPath, ['test/unit/page-boundary-input-smoke.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  assert.equal(
    result.status,
    0,
    `expected page boundary input smoke pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /PAGE_BOUNDARY_INPUT_SMOKE_SUMMARY:/u);
});

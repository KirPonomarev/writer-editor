import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  REQUIRED_DEPENDENCIES,
  verifyDependencyResults,
  verifyWorkflowText,
} from '../../scripts/ops/r24/corrective/post-audit-merge-gate.mjs';

const workflow = fs.readFileSync('.github/workflows/oss-policy.yml', 'utf8');
// The complete sequential job at d97340e6, before routing-only additions.
const BASE_JOB_SHA256 = '03bd8b06feedda4ea4393687d1abdc03afeb36d79c580742c0851041c0955972';
const MATRIX = '    strategy:\n      fail-fast: false\n      matrix:\n        lane: [post-audit, rtk]\n';
const GUARD = '      - name: Verify post-build lane coverage and failure gates\n        run: node --test test/contracts/r24-postbuild-lanes.contract.test.mjs\n';
const PHASES = [
  ['Run focused post-audit negative contracts after real build', 'post-audit'],
  ['Run full maintained RTK after real build', 'rtk'],
];

function replaceOnce(text, before, after, label) {
  assert.equal(text.split(before).length - 1, 1, label);
  return text.replace(before, after);
}

function verifyLanes(text) {
  const anchors = [...text.matchAll(/^  actual-renderer-build-rtk:\n/gm)];
  assert.equal(anchors.length, 1, 'Exactly one post-build job');
  const tail = text.slice(anchors[0].index);
  const nextJob = tail.slice(anchors[0][0].length).search(/^  [\w-]+:\n/m);
  let block = (nextJob < 0 ? tail : tail.slice(0, anchors[0][0].length + nextJob)).trimEnd() + '\n';
  block = replaceOnce(block, MATRIX, '', 'Both lanes run with fail-fast disabled');
  block = replaceOnce(block, GUARD, '', 'Each lane executes the coverage guard');
  for (const [name, lane] of PHASES) {
    const step = `      - name: ${name}\n`;
    block = replaceOnce(block, step + `        if: \${{ matrix.lane == '${lane}' }}\n`, step, `Exact route: ${lane}`);
  }
  assert.equal(crypto.createHash('sha256').update(block).digest('hex'), BASE_JOB_SHA256,
    'Every original command, build, clean-tree check and failure policy is preserved');
  assert.equal(verifyWorkflowText(text).status, 'PASS');
}

test('post-build lanes preserve every original command and required merge dependency', () => {
  verifyLanes(workflow);
});

const mutations = [
  ['missing post-audit lane', 'lane: [post-audit, rtk]', 'lane: [rtk]'],
  ['missing RTK lane', 'lane: [post-audit, rtk]', 'lane: [post-audit]'],
  ['duplicate lane', 'lane: [post-audit, rtk]', 'lane: [post-audit, post-audit, rtk]'],
  ['unknown lane', 'lane: [post-audit, rtk]', 'lane: [post-audit, rtk, other]'],
  ['cancelled diagnostics', 'fail-fast: false', 'fail-fast: true'],
  ['allowed failure', '  actual-renderer-build-rtk:\n', '  actual-renderer-build-rtk:\n    continue-on-error: true\n'],
  ['skipped job', '  actual-renderer-build-rtk:\n', '  actual-renderer-build-rtk:\n    if: false\n'],
  ['removed guard', GUARD, ''],
  ['removed actual build', '        run: npm run build:renderer\n', '        run: true\n'],
  ['skipped actual build', '      - name: Build the actual shipped renderer and preload artifacts\n', '      - name: Build the actual shipped renderer and preload artifacts\n        if: false\n'],
  ['removed clean-tree check', '        run: git diff --exit-code -- src/renderer/editor.bundle.js src/preload.bundle.cjs\n', '        run: true\n'],
  ['removed post-audit command', '          npm run test:r24-post-audit\n', '          true\n'],
  ['removed maintained RTK', '        run: npm run test:rtk\n', '        run: true\n'],
  ['wrong post-audit route', "        if: ${{ matrix.lane == 'post-audit' }}\n", "        if: ${{ matrix.lane == 'rtk' }}\n"],
  ['skipped RTK route', "        if: ${{ matrix.lane == 'rtk' }}\n", '        if: false\n'],
  ['removed aggregate dependency', '      - actual-renderer-build-rtk\n', ''],
];

for (const [label, before, after] of mutations) {
  test(`post-build coverage rejects ${label}`, () => {
    const mutant = replaceOnce(workflow, before, after, `Mutation target exists: ${label}`);
    assert.throws(() => verifyLanes(mutant));
  });
}

test('post-build coverage rejects a duplicate job', () => {
  assert.throws(() => verifyLanes(workflow + '\n  actual-renderer-build-rtk:\n    runs-on: ubuntu-latest\n'));
});

for (const status of ['failure', 'cancelled', 'skipped', 'unknown']) {
  test(`existing merge oracle rejects aggregate ${status}`, () => {
    const results = Object.fromEntries(REQUIRED_DEPENDENCIES.map((name) => [name, 'success']));
    results['actual-renderer-build-rtk'] = status;
    assert.throws(() => verifyDependencyResults(results), /E_DEPENDENCY_NOT_SUCCESS/);
  });
}

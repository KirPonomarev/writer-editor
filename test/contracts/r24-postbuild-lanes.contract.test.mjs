import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  REQUIRED_DEPENDENCIES,
  verifyDependencyResults,
  verifyWorkflowText,
} from '../../scripts/ops/r24/corrective/post-audit-merge-gate.mjs';

const workflow = fs.readFileSync('.github/workflows/oss-policy.yml', 'utf8');
const requiredWorkflow = fs.readFileSync('.github/workflows/rtk-required.yml', 'utf8');
// Retain the original complete command bodies, rather than accepting a smaller
// set because the new topology happens to report success.
const BASE_JOB_SHA256 = '03bd8b06feedda4ea4393687d1abdc03afeb36d79c580742c0851041c0955972';
const BASE_REQUIRED_SHA256 = '5ec3beaa3589bed1d5d940800be538eaac051095808abaee1b4eac7570237b5c';
const MATRIX = '    strategy:\n      fail-fast: false\n      matrix:\n        lane: [post-audit]\n';
const GUARD = '      - name: Verify post-build lane coverage and failure gates\n        run: node --test test/contracts/r24-postbuild-lanes.contract.test.mjs\n';
const BUILD = '      - name: Build the actual shipped renderer and preload artifacts\n        run: npm run build:renderer\n      - name: Require build-to-clean-tree policy\n        run: git diff --exit-code -- src/renderer/editor.bundle.js src/preload.bundle.cjs\n';
const LEGACY_RTK_STEP = '      - name: Run full maintained RTK after real build\n        run: npm run test:rtk\n';
const GRAPH_STEP = '      - name: Run maintained RTK graph\n';
const EXTRA_STEP = '      - name: Run R2.4 E0 runner safety quarantine gate\n';
const AGGREGATE = `  rtk-required:
    if: \${{ always() }}
    needs: [rtk-graph, r24-gates]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Require complete post-build RTK and every additional R2.4 gate
        env:
          RTK_GRAPH_RESULT: \${{ needs.rtk-graph.result }}
          R24_GATES_RESULT: \${{ needs.r24-gates.result }}
        run: |
          test "$RTK_GRAPH_RESULT" = success
          test "$R24_GATES_RESULT" = success
`;

function replaceOnce(text, before, after, label) {
  assert.equal(text.split(before).length - 1, 1, label);
  return text.replace(before, after);
}

function jobBlock(text, name) {
  const marker = `  ${name}:\n`;
  const anchors = [...text.matchAll(new RegExp(`^  ${name}:\\n`, 'gm'))];
  assert.equal(anchors.length, 1, `Exactly one ${name} job`);
  const tail = text.slice(anchors[0].index);
  const next = tail.slice(marker.length).search(/^  [\w-]+:\n/m);
  return (next < 0 ? tail : tail.slice(0, marker.length + next)).trimEnd() + '\n';
}

const digest = text => crypto.createHash('sha256').update(text).digest('hex');

function verifyLanes(root, required) {
  assert.equal(required.split('\njobs:\n').length, 2, 'One workflow jobs mapping');
  const jobs = required.split('\njobs:\n')[1];
  assert.deepEqual([...jobs.matchAll(/^  ([\w-]+):\n/gm)].map(m => m[1]),
    ['rtk-graph', 'r24-gates', 'rtk-required'], 'Exactly the two executing jobs and their aggregate');
  assert.equal((root + '\n' + required).match(/^\s+run: npm run(?: -s)? test:rtk\s*$/gm)?.length, 1,
    'Exactly one complete maintained graph per OSS run');
  let post = jobBlock(root, 'actual-renderer-build-rtk');
  post = replaceOnce(post, MATRIX, '', 'Post-audit runs once without matrix cancellation');
  post = replaceOnce(post, GUARD, '', 'Post-audit executes the topology guard');
  const phase = '      - name: Run focused post-audit negative contracts after real build\n';
  post = replaceOnce(post, phase + "        if: ${{ matrix.lane == 'post-audit' }}\n", phase,
    'Post-audit route remains exact');
  assert.equal(digest(post + LEGACY_RTK_STEP), BASE_JOB_SHA256,
    'Every original post-build command and failure policy is retained; only RTK moved');

  let graph = jobBlock(required, 'rtk-graph');
  assert.ok(graph.indexOf(BUILD) < graph.indexOf(GRAPH_STEP), 'The full graph follows the real build and clean-tree check');
  graph = replaceOnce(graph, GUARD, '', 'RTK executes the same topology guard');
  graph = replaceOnce(graph, BUILD, '', 'RTK owns the exact actual build and clean-tree commands');
  graph = replaceOnce(graph, '        run: npm ci --engine-strict\n', '        run: npm ci\n',
    'Post-build engine-strict installation is retained');
  graph = replaceOnce(graph, '  rtk-graph:\n', '  rtk-required:\n', 'Original required execution body');
  const graphPrefix = graph.slice(0, graph.indexOf(GRAPH_STEP));
  const extra = replaceOnce(jobBlock(required, 'r24-gates'), '  r24-gates:\n', '  rtk-required:\n',
    'Independent extra job remains present');
  assert.ok(extra.startsWith(graphPrefix + EXTRA_STEP), 'Additional checks retain independent original setup');
  const top = required.slice(0, required.indexOf('jobs:\n'));
  const reconstructed = top + 'jobs:\n' + graph.trimEnd() + '\n\n' + extra.slice(graphPrefix.length);
  assert.equal(digest(reconstructed), BASE_REQUIRED_SHA256,
    'All original extra commands, historical checkouts, assertions, toolchain and limits remain exact');
  assert.equal(jobBlock(required, 'rtk-required'), AGGREGATE, 'The legacy required context fails closed on both jobs');
  assert.equal(jobBlock(root, 'rtk-required'),
    '  rtk-required:\n    uses: ./.github/workflows/rtk-required.yml\n', 'OSS calls the full reusable workflow');
  assert.equal(verifyWorkflowText(root).status, 'PASS');
  const merge = jobBlock(root, 'merge-gate');
  for (const name of REQUIRED_DEPENDENCIES) {
    assert.ok(merge.split('\n').includes(`      - ${name}`), `Exact required dependency: ${name}`);
  }
}

test('post-build lanes preserve every original command and required merge dependency', () => {
  verifyLanes(workflow, requiredWorkflow);
});

const rootMutations = [
  ['missing post-audit lane', 'lane: [post-audit]', 'lane: []'],
  ['duplicate lane', 'lane: [post-audit]', 'lane: [post-audit, post-audit]'],
  ['unknown lane', 'lane: [post-audit]', 'lane: [post-audit, other]'],
  ['cancelled diagnostics', 'fail-fast: false', 'fail-fast: true'],
  ['allowed failure', '  actual-renderer-build-rtk:\n', '  actual-renderer-build-rtk:\n    continue-on-error: true\n'],
  ['skipped job', '  actual-renderer-build-rtk:\n', '  actual-renderer-build-rtk:\n    if: false\n'],
  ['removed guard', GUARD, ''],
  ['removed actual build', '        run: npm run build:renderer\n', '        run: true\n'],
  ['skipped actual build', '      - name: Build the actual shipped renderer and preload artifacts\n', '      - name: Build the actual shipped renderer and preload artifacts\n        if: false\n'],
  ['removed clean-tree check', '        run: git diff --exit-code -- src/renderer/editor.bundle.js src/preload.bundle.cjs\n', '        run: true\n'],
  ['removed post-audit command', '          npm run test:r24-post-audit\n', '          true\n'],
  ['wrong post-audit route', "        if: ${{ matrix.lane == 'post-audit' }}\n", "        if: ${{ matrix.lane == 'rtk' }}\n"],
  ['removed aggregate dependency', '      - actual-renderer-build-rtk\n', ''],
  ['removed required reusable workflow', '    uses: ./.github/workflows/rtk-required.yml\n', '    uses: ./.github/workflows/other.yml\n'],
];
for (const [label, before, after] of rootMutations) {
  test(`post-build coverage rejects ${label}`, () => {
    const mutant = replaceOnce(workflow, before, after, label);
    assert.throws(() => verifyLanes(mutant, requiredWorkflow));
  });
}
const requiredMutations = [
  ['missing RTK lane', '  rtk-graph:\n', '  other-graph:\n'],
  ['removed maintained RTK', '        run: npm run -s test:rtk\n', '        run: true\n'],
  ['skipped RTK route', GRAPH_STEP, GRAPH_STEP + '        if: false\n'],
  ['removed RTK guard', GUARD, ''],
  ['removed RTK build', '        run: npm run build:renderer\n', '        run: true\n'],
  ['removed RTK clean-tree check', '        run: git diff --exit-code -- src/renderer/editor.bundle.js src/preload.bundle.cjs\n', '        run: true\n'],
  ['skipped RTK build', '      - name: Build the actual shipped renderer and preload artifacts\n', '      - name: Build the actual shipped renderer and preload artifacts\n        if: false\n'],
  ['allowed RTK failure', '  rtk-graph:\n', '  rtk-graph:\n    continue-on-error: true\n'],
  ['skipped additional checks', '  r24-gates:\n', '  r24-gates:\n    if: false\n'],
  ['serialized additional checks', '  r24-gates:\n', '  r24-gates:\n    needs: rtk-graph\n'],
  ['removed additional check', '        run: npm run -s test:r24-e0\n', '        run: true\n'],
  ['missing aggregate dependency', '    needs: [rtk-graph, r24-gates]\n', '    needs: [rtk-graph]\n'],
  ['skipped aggregate', '    if: ${{ always() }}\n', '    if: false\n'],
  ['missing aggregate check', '          test "$R24_GATES_RESULT" = success\n', ''],
];
for (const [label, before, after] of requiredMutations) {
  test(`post-build coverage rejects ${label}`, () => {
    const mutant = replaceOnce(requiredWorkflow, before, after, label);
    assert.throws(() => verifyLanes(workflow, mutant));
  });
}

test('post-build coverage rejects a duplicate job', () => {
  assert.throws(() => verifyLanes(workflow + '\n  actual-renderer-build-rtk:\n    runs-on: ubuntu-latest\n', requiredWorkflow));
  assert.throws(() => verifyLanes(workflow, requiredWorkflow + '\n  rtk-graph:\n    runs-on: ubuntu-latest\n'));
});

test('post-build coverage rejects a second full graph and build after tests', () => {
  assert.throws(() => verifyLanes(workflow, requiredWorkflow + '\n  second:\n    run: npm run test:rtk\n'));
  const moved = replaceOnce(requiredWorkflow, BUILD, '', 'Move original build').replace(GRAPH_STEP + '        run: npm run -s test:rtk\n', GRAPH_STEP + '        run: npm run -s test:rtk\n' + BUILD);
  assert.throws(() => verifyLanes(workflow, moved));
});

for (const status of ['failure', 'cancelled', 'skipped', 'unknown']) {
  test(`existing merge oracle rejects aggregate ${status}`, () => {
    for (const dependency of ['actual-renderer-build-rtk', 'rtk-required']) {
      const results = Object.fromEntries(REQUIRED_DEPENDENCIES.map(name => [name, 'success']));
      results[dependency] = status;
      assert.throws(() => verifyDependencyResults(results), /E_DEPENDENCY_NOT_SUCCESS/);
    }
  });
}

test('required context executes its actual fail-closed shell for every prerequisite outcome', () => {
  const block = jobBlock(requiredWorkflow, 'rtk-required');
  const script = block.split('        run: |\n')[1].split('\n').filter(Boolean).map(line => line.slice(10)).join('\n');
  for (const graph of ['success', 'failure', 'cancelled', 'skipped', 'unknown', '']) {
    for (const extra of ['success', 'failure', 'cancelled', 'skipped', 'unknown', '']) {
      const run = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
        env: { ...process.env, RTK_GRAPH_RESULT: graph, R24_GATES_RESULT: extra }, encoding: 'utf8', timeout: 5000,
      });
      assert.equal(run.error, undefined);
      assert.equal(run.status === 0, graph === 'success' && extra === 'success', `${graph}/${extra}`);
    }
  }
});

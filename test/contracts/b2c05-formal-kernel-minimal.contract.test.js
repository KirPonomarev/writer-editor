const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c05-formal-kernel-minimal-proof.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C05_FORMAL_KERNEL_MINIMAL_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function withMutatedStatus(mutator) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c05-'));
  const statusCopy = path.join(tmpDir, 'B2C05_FORMAL_KERNEL_MINIMAL_STATUS_V1.json');
  const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  mutator(parsed);
  fs.writeFileSync(statusCopy, JSON.stringify(parsed, null, 2));
  return statusCopy;
}

test('b2c05 formal kernel minimal: canonical packet is green', async () => {
  const { evaluateB2C05FormalKernelMinimal } = await loadModule();
  const state = await evaluateB2C05FormalKernelMinimal({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B2C05_FORMAL_KERNEL_MINIMAL_OK, 1);
  assert.equal(state.code, '');
  assert.equal(state.invariantCount, 3);
  assert.equal(state.detectorRows.length, 3);
});

test('b2c05 formal kernel minimal: fourth invariant fails deterministically', async () => {
  const { evaluateB2C05FormalKernelMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.formalKernel.invariants.push({
      invariantId: 'FOURTH',
      kind: 'FORMAL_CLAIM',
      statement: 'forbidden fourth invariant',
      semanticProof: {},
    });
    parsed.formalKernel.invariantCount = 4;
  });

  const state = await evaluateB2C05FormalKernelMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C05_INVARIANT_COUNT');
});

test('b2c05 formal kernel minimal: duplicate detector id fails deterministically', async () => {
  const { evaluateB2C05FormalKernelMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.proofBinding.byInvariant[1].detectorId = parsed.proofBinding.byInvariant[0].detectorId;
  });

  const state = await evaluateB2C05FormalKernelMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C05_DETECTOR_ID_DUPLICATE');
});

test('b2c05 formal kernel minimal: forbidden boundary expansion fails deterministically', async () => {
  const { evaluateB2C05FormalKernelMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.stateMachine = { lifecycle: 'forbidden' };
  });

  const state = await evaluateB2C05FormalKernelMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C05_ADVISORY_BOUNDARY_DRIFT');
});

test('b2c05 formal kernel minimal: export source drift fails deterministically', async () => {
  const { evaluateB2C05FormalKernelMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.formalKernel.invariants[1].semanticProof.expectedCommandId = 'cmd.project.export.docxOther';
  });

  const state = await evaluateB2C05FormalKernelMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C05_INVARIANT_CLASS');
});

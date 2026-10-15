const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c09-command-surface-kernel.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C09_COMMAND_SURFACE_KERNEL_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function withMutatedStatus(mutator) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c09-'));
  const statusCopy = path.join(tmpDir, 'B2C09_COMMAND_SURFACE_KERNEL_V1.json');
  const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  mutator(parsed);
  fs.writeFileSync(statusCopy, JSON.stringify(parsed, null, 2));
  return statusCopy;
}

test('b2c09 command surface kernel: canonical packet is green', async () => {
  const { evaluateB2C09CommandSurfaceKernel } = await loadModule();
  const state = await evaluateB2C09CommandSurfaceKernel({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B2C09_COMMAND_SURFACE_KERNEL_OK, 1);
  assert.equal(state.code, '');
  assert.equal(state.commandSurfaceId, 'ZERO_BYPASS_COMMAND_KERNEL');
  assert.equal(state.admittedBoundaryRowCount, 3);
  assert.equal(state.advisoryBoundaryRowCount, 2);
});

test('b2c09 command surface kernel: multi-entry promotion to admitted fails', async () => {
  const { evaluateB2C09CommandSurfaceKernel } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.boundary.admittedBoundaryRows.push({
      rowId: 'MULTI_ENTRY_COMMAND_SURFACE',
      proofLevel: 'FALSE_PROMOTION',
    });
  });

  const state = await evaluateB2C09CommandSurfaceKernel({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C09_BOUNDARY_SET');
});

test('b2c09 command surface kernel: forbidden release gating key fails', async () => {
  const { evaluateB2C09CommandSurfaceKernel } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.releaseGating = { mode: 'forbidden' };
  });

  const state = await evaluateB2C09CommandSurfaceKernel({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C09_FORBIDDEN_SCOPE');
});

test('b2c09 command surface kernel: duplicate detector binding fails', async () => {
  const { evaluateB2C09CommandSurfaceKernel } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.proofBinding.boundaryRows[2].detectorId = parsed.proofBinding.boundaryRows[0].detectorId;
  });

  const state = await evaluateB2C09CommandSurfaceKernel({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C09_DETECTOR_BINDING');
});

test('b2c09 command surface kernel: boundary id drift fails', async () => {
  const { evaluateB2C09CommandSurfaceKernel } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.boundary.commandSurfaceId = 'FULL_RUNTIME_ORCHESTRATION';
  });

  const state = await evaluateB2C09CommandSurfaceKernel({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C09_BOUNDARY_SET');
});

test('b2c09 command surface kernel: extra command cluster fails', async () => {
  const { evaluateB2C09CommandSurfaceKernel } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.boundary.advisoryBoundaryRows.push({
      rowId: 'EXTRA_COMMAND_CLUSTER',
      proofLevel: 'OUT_OF_SCOPE_BREACH',
    });
  });

  const state = await evaluateB2C09CommandSurfaceKernel({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C09_BOUNDARY_SET');
});

test('b2c09 command routing truth: actual guarded IPC validates envelope before payload interpretation and rejects removed guards', () => {
  const source=fs.readFileSync(MODULE_PATH,'utf8'),start=source.indexOf('function verifyRoutingTruth('),end=source.indexOf('\n}',start);
  assert.ok(start>=0&&end>start);
  const actual=fs.readFileSync(path.join(REPO_ROOT,'src/main.js'),'utf8');
  const verify=main=>new Function('fs','path','repoRoot',source.slice(start,end+2)+'\nverifyRoutingTruth(repoRoot);')({
    readFileSync:file=>path.resolve(file)===path.join(REPO_ROOT,'src/main.js')?main:fs.readFileSync(file,'utf8'),
  },path,REPO_ROOT);
  assert.doesNotThrow(()=>verify(actual));
  for(const [before,after] of [
    ["guardedProtocolHandle('ui:command-bridge',","ipcMain.handle('ui:command-bridge',"],
    ["validateIpcEnvelope(request, 'ui:command-bridge')",'fakeEnvelopeVerdict(request)'],
    ['if (!envelopeVerdict.ok)','if (false)'],
    ['route !== COMMAND_BUS_ROUTE','false /* route bypass */'],
    ['!UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS.has(commandId)','false /* ID bypass */'],
  ]){assert.ok(actual.includes(before));assert.throws(()=>verify(actual.replace(before,after)),/COMMAND_ROUTING_TRUTH_DRIFT/);}
  const reordered=actual.replace("  const envelopeVerdict = validateIpcEnvelope(request, 'ui:command-bridge');",'')
    .replace("  const route = typeof safeRequest.route", "  const envelopeVerdict = validateIpcEnvelope(request, 'ui:command-bridge');\n  const route = typeof safeRequest.route");
  assert.throws(()=>verify(reordered),/COMMAND_ROUTING_TRUTH_DRIFT/);
});

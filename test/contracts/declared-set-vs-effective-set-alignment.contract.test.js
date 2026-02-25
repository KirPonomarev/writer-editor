const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'declared-set-vs-effective-set-alignment-state.mjs');
const PROFILE_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'EXECUTION_PROFILE.example.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('declared set vs effective set alignment: declared minus effective is empty', async () => {
  const { evaluateDeclaredSetVsEffectiveSetAlignment } = await loadModule();
  const state = evaluateDeclaredSetVsEffectiveSetAlignment({
    repoRoot: REPO_ROOT,
    profilePath: PROFILE_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_OK, 1);
  assert.equal(state.alignmentOk, true);
  assert.equal(state.declaredReleaseSetMinusEffectiveMachineSetCount, 0);
  assert.equal(state.effectiveMachineSetMinusDeclaredReleaseSetCount, 0);
});

test('declared set vs effective set alignment: dropping one declared release token fails alignment', async () => {
  const { evaluateDeclaredSetVsEffectiveSetAlignment } = await loadModule();

  const requiredSetDoc = readJson(REQUIRED_SET_PATH);
  const releaseTokens = Array.isArray(requiredSetDoc?.requiredSets?.release)
    ? requiredSetDoc.requiredSets.release.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];

  assert.ok(releaseTokens.length > 0, 'release declared set must not be empty');
  const droppedToken = releaseTokens[0];

  requiredSetDoc.requiredSets.release = releaseTokens.filter((token) => token !== droppedToken);
  if (Array.isArray(requiredSetDoc?.requiredSets?.active)) {
    requiredSetDoc.requiredSets.active = requiredSetDoc.requiredSets.active
      .map((entry) => String(entry || '').trim())
      .filter((token) => token && token !== droppedToken);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'declared-effective-alignment-negative-'));
  const mutatedRequiredSetPath = path.join(tmpDir, 'REQUIRED_TOKEN_SET.mutated.json');
  fs.writeFileSync(mutatedRequiredSetPath, `${JSON.stringify(requiredSetDoc, null, 2)}\n`, 'utf8');

  try {
    const state = evaluateDeclaredSetVsEffectiveSetAlignment({
      repoRoot: REPO_ROOT,
      profilePath: PROFILE_PATH,
      requiredSetPath: mutatedRequiredSetPath,
      failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    });

    assert.equal(state.ok, false);
    assert.equal(state.DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_OK, 0);
    assert.equal(state.alignmentOk, false);
    assert.ok(
      state.effectiveMachineSetMinusDeclaredReleaseSet.includes(droppedToken)
      || state.declaredReleaseSetMinusEffectiveMachineSet.includes(droppedToken),
      'dropped token must be detected by alignment diff',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('declared set vs effective set alignment: repeatable pass and advisory drift count remains zero', async () => {
  const { evaluateDeclaredSetVsEffectiveSetAlignment } = await loadModule();

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateDeclaredSetVsEffectiveSetAlignment({
      repoRoot: REPO_ROOT,
      profilePath: PROFILE_PATH,
      requiredSetPath: REQUIRED_SET_PATH,
      failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    });

    runs.push({
      ok: state.ok,
      alignmentOk: state.alignmentOk,
      declaredReleaseSetMinusEffectiveMachineSetCount: state.declaredReleaseSetMinusEffectiveMachineSetCount,
      effectiveMachineSetMinusDeclaredReleaseSetCount: state.effectiveMachineSetMinusDeclaredReleaseSetCount,
      advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
      failReason: state.failReason,
    });
  }

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
  assert.equal(runs[0].alignmentOk, true);
  assert.equal(runs[0].advisoryToBlockingDriftCount, 0);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = process.cwd();
const moduleFile = process.env.RCV00E_TEST_MODULE || path.join(root, 'scripts/ops/r24/corrective/rcv00e-plan-predecessor-closure.mjs');
const { verifyRcv00ePlanPredecessorClosure: verify, rcv00eGitEvidence,
  readRcv00ePlanPredecessorCarrier: readCarrier, RCV00E_PLAN_PREDECESSOR_PATH,
  RCV00E_PLAN_PATH, RCV00E_SOURCE_PATHS } = await import(pathToFileURL(moduleFile).href);
const native = await import(pathToFileURL(path.join(root, 'scripts/ops/r24/corrective/rcv00d-graph-derived-selector.mjs')).href);
const integrationModule = process.env.RCV00E_TEST_INTEGRATION_MODULE
  ? await import(pathToFileURL(process.env.RCV00E_TEST_INTEGRATION_MODULE).href) : native;
const integration = integrationModule.buildCurrentCorrectivePlanOutcome;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const carrierFile = process.env.RCV00E_TEST_CARRIER || path.join(root, RCV00E_PLAN_PREDECESSOR_PATH);
const raw = fs.readFileSync(carrierFile), carrier = JSON.parse(raw);
const attestation = JSON.parse(Buffer.from(carrier.attestationRawBase64, 'base64'));
const historical = attestation.identity;
const BASE = historical.current, TREE = historical.currentTree;
const NEXT = '1'.repeat(40), NEXT_TREE = '2'.repeat(40), WRONG = '3'.repeat(40);
const git = rcv00eGitEvidence(root), head = git.head();
const identity = { headSha: head, originMainSha: git.originMain(), treeSha: git.tree(head) };
const plan = git.object(BASE, RCV00E_PLAN_PATH);
const sources = new Map(RCV00E_SOURCE_PATHS.map(relative => [relative, git.object(BASE, relative)]));
const actualOptions = () => ({ repoRoot: root, identity: { ...identity },
  planText: plan.toString('utf8'), planDigest: hash(plan), readCarrier: () => Buffer.from(raw) });

// A synthetic unchanged successor isolates each binding from real Git history.
function fixture() {
  const treeMap = new Map([[BASE, TREE], [NEXT, NEXT_TREE],
    [historical.candidate, historical.mergedTree], [historical.merged, historical.mergedTree]]);
  const ancestry = new Set([[historical.base, historical.candidate],
    [historical.candidate, historical.merged], [historical.merged, BASE], [BASE, NEXT]]
    .map(pair => pair.join(':')));
  return { ...actualOptions(), identity: { headSha: NEXT, originMainSha: NEXT, treeSha: NEXT_TREE },
    readSource: relative => Buffer.from(sources.get(relative)),
    gitEvidence: {
      head: () => NEXT, originMain: () => NEXT, tree: sha => treeMap.get(sha),
      parents: sha => { assert.equal(sha, historical.merged); return [historical.base, historical.candidate]; },
      isAncestor: (left, right) => ancestry.has(`${left}:${right}`),
      object(sha, relative) {
        assert([BASE, NEXT].includes(sha));
        assert(relative === RCV00E_PLAN_PATH || sources.has(relative));
        return Buffer.from(relative === RCV00E_PLAN_PATH ? plan : sources.get(relative));
      },
    } };
}
const rejects = (options, code) => assert.throws(() => verify(options), error => error.code === code);

test('RCV00E plan predecessor: pinned accepted input identities', () => {
  assert.equal(hash(raw), 'f07505fde02102b39e7aa04ba7f33480f25833ff0967d1e72b88206c28de32a1');
  assert.equal(BASE, '442bdbef6a153b14fec5c2d354bccd8f97a62809');
  assert.equal(TREE, 'fb6e903cd6b25088a4fb49dad32737ed25d86fa6');
  assert.equal(RCV00E_SOURCE_PATHS.length, 9);
});
test('RCV00E plan predecessor: actual Git binds current head and accepted history', () => {
  const result = verify(actualOptions());
  assert.equal(result.status, 'VERIFIED_BOUNDED_PLAN_PREDECESSOR_CLOSURE');
  assert.deepEqual(result.identity, identity);
  assert.deepEqual(result.historicalIdentity, historical);
  assert.equal(result.sourceArtifacts.length, 9);
  assert.deepEqual(result.provenanceLimits, attestation.residualLimits);
});
test('RCV00E plan predecessor: unchanged successor has explicit limited scope', () => {
  const result = verify(fixture());
  assert.equal(result.contourId, 'R24-RCV-00E');
  assert.equal(result.subjectKind, 'PLAN_PREDECESSOR');
  for (const key of ['mutationAllowed', 'programDone', 'productionReleaseReady']) assert.equal(result[key], false);
  assert.equal(result.graphIncrement, 0);
  assert.equal(result.evidenceScope, 'ACCEPTED_RECOVERED_DELIVERY_AND_ATTESTED_CURRENT_SOURCE_EQUIVALENCE_NOT_FRESH_RUNTIME_PROOF');
});
test('RCV00E plan predecessor: deterministic query', () => {
  assert.equal(JSON.stringify(verify(fixture())), JSON.stringify(verify(fixture())));
});
test('RCV00E plan predecessor: E credit never closes F or produces a finding', () => {
  const result = verify(fixture());
  assert.deepEqual(['R24-RCV-00E', 'R24-RCV-00F'].filter(id => id !== result.contourId), ['R24-RCV-00F']);
  assert.equal(Object.hasOwn(result, 'selected'), false);
  assert.equal(Object.hasOwn(result, 'findingId'), false);
});
test('RCV00E plan predecessor: invalid identity rejected before evidence read', () => {
  rejects({ identity: null, readCarrier() { assert.fail('unvalidated read'); } }, 'E_RCV00E_PLAN_CURRENT_IDENTITY');
});
for (const field of ['headSha', 'originMainSha', 'treeSha']) {
  test(`RCV00E plan predecessor: wrong current ${field}`, () => {
    const options = fixture(); options.identity[field] = WRONG;
    rejects(options, 'E_RCV00E_PLAN_CURRENT_IDENTITY');
  });
}
test('RCV00E plan predecessor: invalid plan context shape', () => {
  const options = fixture(); options.planText = null;
  rejects(options, 'E_RCV00E_PLAN_CONTEXT_SHAPE');
});
test('RCV00E plan predecessor: mutated carrier bytes', () => {
  const options = fixture(); options.readCarrier = () => Buffer.concat([raw, Buffer.from('\n')]);
  rejects(options, 'E_RCV00E_PLAN_CARRIER_DIGEST');
});
test('RCV00E plan predecessor: wrong attestation receipt', () => {
  const changed = structuredClone(carrier);
  changed.attestationRawBase64 = Buffer.from(JSON.stringify({ ...attestation,
    identity: { ...historical, merged: WRONG } })).toString('base64');
  const options = fixture(); options.readCarrier = () => Buffer.from(JSON.stringify(changed));
  rejects(options, 'E_RCV00E_PLAN_CARRIER_DIGEST');
});
test('RCV00E plan predecessor: different-head replay evidence', () => {
  const changed = structuredClone(carrier), replay = JSON.parse(Buffer.from(changed.replayRawBase64, 'base64'));
  replay.current.head = WRONG;
  changed.replayRawBase64 = Buffer.from(JSON.stringify(replay)).toString('base64');
  const options = fixture(); options.readCarrier = () => Buffer.from(JSON.stringify(changed));
  rejects(options, 'E_RCV00E_PLAN_CARRIER_DIGEST');
});
test('RCV00E plan predecessor: bare CLOSED and injected F are not evidence', () => {
  const options = fixture();
  options.readCarrier = () => Buffer.from(JSON.stringify({ status: 'CLOSED', contourId: 'R24-RCV-00F' }));
  rejects(options, 'E_RCV00E_PLAN_CARRIER_DIGEST');
});
test('RCV00E plan predecessor: oversized carrier rejected before parse', () => {
  const options = fixture(); options.readCarrier = () => Buffer.alloc(65537);
  rejects(options, 'E_RCV00E_PLAN_CARRIER_BOUNDS');
});
test('RCV00E plan predecessor: carrier must be bytes', () => {
  const options = fixture(); options.readCarrier = () => raw.toString();
  rejects(options, 'E_RCV00E_PLAN_CARRIER_BOUNDS');
});
for (const subject of ['candidate', 'merged']) {
  test(`RCV00E plan predecessor: mutated historical ${subject} tree`, () => {
    const options = fixture(), original = options.gitEvidence.tree;
    options.gitEvidence.tree = sha => sha === historical[subject] ? WRONG : original(sha);
    rejects(options, 'E_RCV00E_PLAN_HISTORICAL_TREE');
  });
}
test('RCV00E plan predecessor: wrong normal merge parents', () => {
  const options = fixture(); options.gitEvidence.parents = () => [historical.candidate, historical.base];
  rejects(options, 'E_RCV00E_PLAN_NORMAL_MERGE_PARENTS');
});
for (const [left, right] of [[historical.base, historical.candidate],
  [historical.candidate, historical.merged], [historical.merged, BASE]]) {
  test(`RCV00E plan predecessor: broken historical ancestry ${left}`, () => {
    const options = fixture(), original = options.gitEvidence.isAncestor;
    options.gitEvidence.isAncestor = (a, b) => a === left && b === right ? false : original(a, b);
    rejects(options, 'E_RCV00E_PLAN_HISTORICAL_ANCESTRY');
  });
}
test('RCV00E plan predecessor: wrong attested current tree', () => {
  const options = fixture(), original = options.gitEvidence.tree;
  options.gitEvidence.tree = sha => sha === BASE ? WRONG : original(sha);
  rejects(options, 'E_RCV00E_PLAN_REPLAY_ANCESTRY');
});
test('RCV00E plan predecessor: unrelated successor', () => {
  const options = fixture(), original = options.gitEvidence.isAncestor;
  options.gitEvidence.isAncestor = (a, b) => a === BASE && b === NEXT ? false : original(a, b);
  rejects(options, 'E_RCV00E_PLAN_REPLAY_ANCESTRY');
});
test('RCV00E plan predecessor: supplied plan text drift', () => {
  const options = fixture(); options.planText += '\n'; rejects(options, 'E_RCV00E_PLAN_DIGEST');
});
test('RCV00E plan predecessor: supplied plan digest drift', () => {
  const options = fixture(); options.planDigest = 'a'.repeat(64); rejects(options, 'E_RCV00E_PLAN_DIGEST');
});
for (const [name, target] of [['current', NEXT], ['attested', BASE]]) {
  test(`RCV00E plan predecessor: ${name} committed plan drift`, () => {
    const options = fixture(), original = options.gitEvidence.object;
    options.gitEvidence.object = (sha, relative) => sha === target && relative === RCV00E_PLAN_PATH ? Buffer.from('wrong-plan') : original(sha, relative);
    rejects(options, 'E_RCV00E_PLAN_DIGEST');
  });
}
test('RCV00E plan predecessor: consistently reordered E F plan', () => {
  const options = fixture(), original = options.gitEvidence.object;
  options.planText = options.planText.replace('00D -> 00E -> 00F', '00D -> 00F -> 00E');
  assert.notEqual(options.planText, plan.toString()); options.planDigest = hash(options.planText);
  options.gitEvidence.object = (sha, relative) => relative === RCV00E_PLAN_PATH ? Buffer.from(options.planText) : original(sha, relative);
  rejects(options, 'E_RCV00E_PLAN_PREDECESSOR_IDENTITY');
});
for (const [name, target, code] of [['attested', BASE, 'E_RCV00E_PLAN_ATTESTED_SOURCE'], ['current', NEXT, 'E_RCV00E_PLAN_CURRENT_SOURCE']]) {
  test(`RCV00E plan predecessor: ${name} first source drift`, () => {
    const options = fixture(), original = options.gitEvidence.object;
    options.gitEvidence.object = (sha, relative) => sha === target && relative === RCV00E_SOURCE_PATHS[0] ? Buffer.from('changed') : original(sha, relative);
    rejects(options, code);
  });
}
test('RCV00E plan predecessor: dirty worktree source', () => {
  const options = fixture(); options.readSource = () => Buffer.from('dirty'); rejects(options, 'E_RCV00E_PLAN_WORKTREE_SOURCE');
});
test('RCV00E plan predecessor: embedded evidence paths remain opaque', () => {
  const options = fixture(), reads = [], original = options.gitEvidence.object;
  options.gitEvidence.object = (sha, relative) => { reads.push(relative); return original(sha, relative); };
  options.readSource = relative => { reads.push(relative); assert(sources.has(relative)); return sources.get(relative); };
  verify(options);
  assert.deepEqual([...new Set(reads)].sort(), [RCV00E_PLAN_PATH, ...RCV00E_SOURCE_PATHS].sort());
});
test('RCV00E plan predecessor: Git infrastructure error is not swallowed', () => {
  const options = fixture(), fault = new Error('fixture-only-git-read-failure');
  options.gitEvidence.isAncestor = () => { throw fault; };
  assert.throws(() => verify(options), error => error === fault);
});
function carrierFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-e-plan-carrier-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, RCV00E_PLAN_PREDECESSOR_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return { directory, file };
}
test('RCV00E plan predecessor: fixed file positive', t => {
  const { directory, file } = carrierFixture(t); fs.writeFileSync(file, raw, { flag: 'wx' });
  assert.deepEqual(readCarrier(directory), raw);
});
test('RCV00E plan predecessor: fixed file missing', t => {
  const { directory } = carrierFixture(t);
  assert.throws(() => readCarrier(directory), { code: 'E_RCV00E_PLAN_CARRIER_MISSING' });
});
test('RCV00E plan predecessor: carrier directory rejected', t => {
  const { directory, file } = carrierFixture(t); fs.mkdirSync(file);
  assert.throws(() => readCarrier(directory), { code: 'E_RCV00E_PLAN_CARRIER_BOUNDS' });
});
test('RCV00E plan predecessor: carrier link rejected', t => {
  const { directory, file } = carrierFixture(t), target = path.join(directory, 'link-target');
  if (process.platform === 'win32') {
    fs.mkdirSync(target);
    fs.symlinkSync(target, file, 'junction');
  } else {
    fs.writeFileSync(target, raw, { flag: 'wx' });
    fs.symlinkSync(target, file);
  }
  assert(fs.lstatSync(file).isSymbolicLink());
  assert.throws(() => readCarrier(directory), { code: 'E_RCV00E_PLAN_CARRIER_BOUNDS' });
});
test('RCV00E plan predecessor: lstat metadata gates target reads on every platform', t => {
  const { directory, file } = carrierFixture(t); fs.writeFileSync(file, raw, { flag: 'wx' });
  const original = fs.lstatSync;
  let checked = false;
  fs.lstatSync = function (item, ...args) {
    if (String(item) !== file) return original.call(this, item, ...args);
    checked = true;
    return { isFile: () => false, size: raw.length };
  };
  try { assert.throws(() => readCarrier(directory), { code: 'E_RCV00E_PLAN_CARRIER_BOUNDS' }); }
  finally { fs.lstatSync = original; }
  assert.equal(checked, true);
});
test('RCV00E plan predecessor: fixed file bound', t => {
  const { directory, file } = carrierFixture(t); fs.writeFileSync(file, Buffer.alloc(65537), { flag: 'wx' });
  assert.throws(() => readCarrier(directory), { code: 'E_RCV00E_PLAN_CARRIER_BOUNDS' });
});
test('RCV00E source bindings: exact nine-source positive', () => {
  assert.deepEqual(verify(fixture()).sourceArtifacts.map(row => row.path).sort(), [...sources.keys()].sort());
});
for (const relative of RCV00E_SOURCE_PATHS) {
  for (const [name, target, code] of [['attested', BASE, 'E_RCV00E_PLAN_ATTESTED_SOURCE'], ['current', NEXT, 'E_RCV00E_PLAN_CURRENT_SOURCE']]) {
    test(`RCV00E source bindings: ${name} ${relative}`, () => {
      const options = fixture(), original = options.gitEvidence.object;
      options.gitEvidence.object = (sha, item) => sha === target && item === relative ? Buffer.concat([sources.get(item), Buffer.from('\n')]) : original(sha, item);
      rejects(options, code);
    });
  }
  test(`RCV00E source bindings: worktree ${relative}`, () => {
    const options = fixture(), original = options.readSource;
    options.readSource = item => item === relative ? Buffer.concat([original(item), Buffer.from('\n')]) : original(item);
    rejects(options, 'E_RCV00E_PLAN_WORKTREE_SOURCE');
  });
}

const now = '2026-09-12T13:58:51.000Z';
const context = native.buildRcv00dSelectorContext({ repoRoot: root, now });
const store = native.loadCurrentCorrectiveClosureStore({ repoRoot: root });
const options = patch => ({ context, ...store, gitEvidence: git,
  readPlanPredecessorCarrier: () => Buffer.from(raw), ...patch });
function withMissingNativeCarrier(run) {
  const original = fs.lstatSync, target = path.join(root, RCV00E_PLAN_PREDECESSOR_PATH);
  fs.lstatSync = function (item, ...args) {
    if (String(item) === target) throw Object.assign(new Error('Missing fixture carrier'), { code: 'ENOENT' });
    return original.call(this, item, ...args);
  };
  try { return run(); } finally { fs.lstatSync = original; }
}
test('RCV00E integration: current context binds the actual head and tree', () => {
  assert.deepEqual(context.identity, identity);
  assert.equal(integration(options()).verifiedPlanPredecessors[0].identity.headSha, head);
});
test('RCV00E integration: accepted E leaves only F and grants no next contour', () => {
  const result = integration(options());
  assert.deepEqual(result.unresolvedPredecessors, ['R24-RCV-00F']);
  assert.equal(result.verdict, 'NO_ELIGIBLE'); assert.equal(result.selected, null);
  assert.equal(result.rankedCandidateId, 'OPS-03'); assert.equal(result.mutationAllowed, false);
  assert.equal(result.reason, 'PLAN_PREDECESSOR_CLOSURE_UNRESOLVED');
});
test('RCV00E integration: plan proof is separate from findings and observations', () => {
  const baseline = native.deriveCurrentCorrectiveSelection(options()), result = integration(options());
  for (const key of ['candidates', 'verifiedClosures', 'candidateSetDigest', 'closureSetDigest']) assert.deepEqual(result[key], baseline[key]);
  assert.equal(result.verifiedPlanPredecessors.length, 1);
  assert.equal(result.verifiedPlanPredecessors[0].contourId, 'R24-RCV-00E');
  assert.equal(result.verifiedPlanPredecessors[0].subjectKind, 'PLAN_PREDECESSOR');
});
test('RCV00E integration: historical delivered baseline stays unchanged', () => {
  for (const id of ['R24-RCV-00E', 'R24-RCV-00F']) assert.equal(native.RCV00D_DELIVERED_CONTOUR_IDS.includes(id), false);
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-RECEIPT.json')));
  assert.equal(native.validateRcv00dSelectorReceipt(receipt).status, 'PASS');
});
test('RCV00E integration: missing carrier cannot claim closure', () => {
  withMissingNativeCarrier(() => assert.throws(() => integration(options({ readPlanPredecessorCarrier: undefined })), { code: 'E_RCV00E_PLAN_CARRIER_MISSING' }));
});
test('RCV00E integration: bare closed label is not proof', () => {
  assert.throws(() => integration(options({ readPlanPredecessorCarrier: () => Buffer.from('{"status":"CLOSED"}') })), { code: 'E_RCV00E_PLAN_CARRIER_DIGEST' });
});
test('RCV00E integration: supplied closure flags cannot inject F', () => {
  withMissingNativeCarrier(() => assert.throws(() => integration(options({ readPlanPredecessorCarrier: undefined,
    planPredecessorClosed: true, verifiedPlanPredecessors: [{ contourId: 'R24-RCV-00F', status: 'CLOSED' }] })), { code: 'E_RCV00E_PLAN_CARRIER_MISSING' }));
});
test('RCV00E integration: mutated E bytes never reach predecessor credit', () => {
  assert.throws(() => integration(options({ readPlanPredecessorCarrier: () => Buffer.concat([raw, Buffer.from(' ')]) })), { code: 'E_RCV00E_PLAN_CARRIER_DIGEST' });
});
test('RCV00E integration: changed plan rejected before E read', () => {
  const changed = structuredClone(context); changed.planText += '\n'; changed.inputDigests.planTextFile = hash(changed.planText);
  assert.throws(() => integration(options({ context: changed,
    readPlanPredecessorCarrier() { assert.fail('changed plan cannot read E evidence'); } })), { code: 'E_CURRENT_SELECTION_PLAN_DIGEST' });
});
test('RCV00E integration: deterministic bounded output', () => {
  assert.equal(JSON.stringify(integration(options())), JSON.stringify(integration(options())));
});

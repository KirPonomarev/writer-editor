const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const RC_LOCK_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'RELEASE_CANDIDATE_LOCK.json');
const RC_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'release-candidate.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function flattenStrings(input, out = []) {
  if (Array.isArray(input)) {
    input.forEach((value) => flattenStrings(value, out));
    return out;
  }
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string') out.push(input);
    return out;
  }
  Object.values(input).forEach((value) => flattenStrings(value, out));
  return out;
}

function runReleaseCandidate(args, cwd = REPO_ROOT) {
  return spawnSync(process.execPath, [RC_SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function parseJsonOutput(result) {
  let payload = null;
  assert.doesNotThrow(() => {
    payload = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return payload;
}

function makeFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-candidate-contract-'));
  writeJson(path.join(root, 'docs', 'OPS', 'ARTIFACTS', 'menu', 'menu.normalized.json'), {
    schemaVersion: 1,
    snapshotId: 'menu-default-desktop-minimal',
  });
  writeJson(path.join(root, 'docs', 'OPS', 'STATUS', 'MENU_SNAPSHOT_REGISTRY.json'), {
    schemaVersion: 1,
    snapshots: [
      {
        id: 'menu-default-desktop-minimal',
        normalizedHashSha256: 'a'.repeat(64),
      },
    ],
  });
  writeJson(path.join(root, 'docs', 'OPS', 'PERF', 'PERF_LITE_BASELINE.json'), {
    fixture: 'test/fixtures/perf/long-scene.txt',
    metrics: {},
    tolerances: {},
  });
  writeJson(path.join(root, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json'), {
    schemaVersion: 1,
    tokens: [],
  });
  writeJson(path.join(root, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json'), {
    schemaVersion: 1,
    failSignals: [],
  });
  writeJson(path.join(root, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json'), {
    schemaVersion: 1,
    requiredSets: {
      release: [],
    },
  });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'doctor.mjs'), "console.log('DOCTOR_STRICT_FIXTURE_OK=1');\n", 'utf8');
  return root;
}

test('release candidate lock and cli exist', () => {
  assert.equal(fs.existsSync(RC_LOCK_PATH), true, 'missing RELEASE_CANDIDATE_LOCK.json');
  assert.equal(fs.existsSync(RC_SCRIPT_PATH), true, 'missing scripts/ops/release-candidate.mjs');

  const lock = readJson(RC_LOCK_PATH);
  assert.ok(typeof lock.rcId === 'string' && lock.rcId.length > 0);
  assert.ok(typeof lock.baseCommitSha === 'string' && lock.baseCommitSha.length > 0);
  assert.match(String(lock.menuArtifactHash || ''), /^[0-9a-f]{64}$/u);
  assert.match(String(lock.menuSnapshotHash || ''), /^[0-9a-f]{64}$/u);
  assert.match(String(lock.perfBaselineHash || ''), /^[0-9a-f]{64}$/u);
  assert.match(String(lock.tokenCatalogHash || ''), /^[0-9a-f]{64}$/u);
  assert.match(String(lock.failsignalRegistryHash || ''), /^[0-9a-f]{64}$/u);
  assert.match(String(lock.requiredTokenSetHash || ''), /^[0-9a-f]{64}$/u);
  assert.ok(Number.isFinite(Date.parse(String(lock.createdAt || ''))));
  assert.ok(['release', 'promotion'].includes(String(lock.createdByMode || '')));
});

test('release candidate failSignal and token are registered while required-set stays unchanged', () => {
  const failRegistry = readJson(FAILSIGNAL_REGISTRY_PATH);
  const failSignal = (failRegistry.failSignals || []).find((row) => row && row.code === 'E_RELEASE_CANDIDATE_DRIFT');
  assert.ok(failSignal, 'E_RELEASE_CANDIDATE_DRIFT must exist in failSignal registry');
  assert.ok(failSignal.modeMatrix && typeof failSignal.modeMatrix === 'object');
  assert.equal(failSignal.modeMatrix.prCore, 'advisory');
  assert.equal(failSignal.modeMatrix.release, 'advisory');
  assert.equal(failSignal.modeMatrix.promotion, 'blocking');

  const tokenCatalog = readJson(TOKEN_CATALOG_PATH);
  const token = (tokenCatalog.tokens || []).find((row) => row && row.tokenId === 'RELEASE_CANDIDATE_LOCK_MATCH_OK');
  assert.ok(token, 'RELEASE_CANDIDATE_LOCK_MATCH_OK must exist in token catalog');
  assert.equal(token.failSignalCode, 'E_RELEASE_CANDIDATE_DRIFT');

  const requiredSet = readJson(REQUIRED_SET_PATH);
  const flattened = flattenStrings(requiredSet).map((value) => String(value || '').trim());
  assert.equal(flattened.includes('RELEASE_CANDIDATE_LOCK_MATCH_OK'), false);
});

test('promotion mode mismatch fails while release mode mismatch warns', () => {
  const fixtureRoot = makeFixtureRepo();
  try {
    const create = runReleaseCandidate(['--create', '--repo-root', fixtureRoot, '--mode=release', '--json']);
    assert.equal(create.status, 0, `${create.stdout}\n${create.stderr}`);
    const createPayload = parseJsonOutput(create);
    assert.equal(createPayload.result, 'PASS');

    fs.appendFileSync(
      path.join(fixtureRoot, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json'),
      '\n',
      'utf8',
    );

    const releaseVerify = runReleaseCandidate(['--verify', '--repo-root', fixtureRoot, '--mode=release', '--json']);
    assert.equal(releaseVerify.status, 0, `${releaseVerify.stdout}\n${releaseVerify.stderr}`);
    const releasePayload = parseJsonOutput(releaseVerify);
    assert.equal(releasePayload.result, 'WARN');
    assert.equal(releasePayload.failSignalCode, 'E_RELEASE_CANDIDATE_DRIFT');

    const promotionVerify = runReleaseCandidate(['--verify', '--repo-root', fixtureRoot, '--mode=promotion', '--json']);
    assert.notEqual(promotionVerify.status, 0, 'promotion mode must fail on RC mismatch');
    const promotionPayload = parseJsonOutput(promotionVerify);
    assert.equal(promotionPayload.result, 'FAIL');
    assert.equal(promotionPayload.failSignalCode, 'E_RELEASE_CANDIDATE_DRIFT');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('promotion verify generates evidence pack and keeps deterministic files stable', () => {
  const fixtureRoot = makeFixtureRepo();
  try {
    const create = runReleaseCandidate(['--create', '--repo-root', fixtureRoot, '--mode=release', '--json']);
    assert.equal(create.status, 0, `${create.stdout}\n${create.stderr}`);

    const verifyFirst = runReleaseCandidate(['--verify', '--repo-root', fixtureRoot, '--mode=promotion', '--json']);
    assert.equal(verifyFirst.status, 0, `${verifyFirst.stdout}\n${verifyFirst.stderr}`);
    const firstPayload = parseJsonOutput(verifyFirst);
    assert.equal(firstPayload.result, 'PASS');
    assert.ok(typeof firstPayload.evidencePackPath === 'string' && firstPayload.evidencePackPath.length > 0);

    const evidenceDir = path.join(fixtureRoot, firstPayload.evidencePackPath);
    const expectedFiles = [
      'promotion-summary.json',
      'menuArtifactHash.txt',
      'perfBaseline.json',
      'doctor-strict.log',
      'heavy-lane-summary.json',
      'token-required-set.json',
      'failsignal-registry-snapshot.json',
    ];
    const before = new Map();
    for (const fileName of expectedFiles) {
      const absPath = path.join(evidenceDir, fileName);
      assert.equal(fs.existsSync(absPath), true, `missing evidence file: ${fileName}`);
      before.set(fileName, fs.readFileSync(absPath, 'utf8'));
    }

    const verifySecond = runReleaseCandidate(['--verify', '--repo-root', fixtureRoot, '--mode=promotion', '--json']);
    assert.equal(verifySecond.status, 0, `${verifySecond.stdout}\n${verifySecond.stderr}`);
    const secondPayload = parseJsonOutput(verifySecond);
    assert.equal(secondPayload.result, 'PASS');
    assert.equal(secondPayload.evidencePackPath, firstPayload.evidencePackPath);

    for (const fileName of expectedFiles) {
      const absPath = path.join(evidenceDir, fileName);
      const after = fs.readFileSync(absPath, 'utf8');
      assert.equal(after, before.get(fileName), `evidence file drifted: ${fileName}`);
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('promotion verify honors external evidence root and avoids repo-scope doctor log contamination', () => {
  const fixtureRoot = makeFixtureRepo();
  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-candidate-external-evidence-'));
  try {
    const create = runReleaseCandidate(['--create', '--repo-root', fixtureRoot, '--mode=release', '--json']);
    assert.equal(create.status, 0, `${create.stdout}\n${create.stderr}`);

    const verify = runReleaseCandidate([
      '--verify',
      '--repo-root',
      fixtureRoot,
      '--mode=promotion',
      '--evidence-root',
      evidenceRoot,
      '--json',
    ]);
    assert.equal(verify.status, 0, `${verify.stdout}\n${verify.stderr}`);
    const payload = parseJsonOutput(verify);
    assert.equal(payload.result, 'PASS');
    assert.equal(fs.existsSync(path.join(fixtureRoot, 'docs', 'OPS', 'EVIDENCE', 'promotion')), false);
    assert.equal(fs.existsSync(path.join(evidenceRoot, payload.rcId, 'doctor-strict.log')), true);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(evidenceRoot, { recursive: true, force: true });
  }
});

test('promotion verify does not write evidence when doctor strict fails', () => {
  const fixtureRoot = makeFixtureRepo();
  try {
    const create = runReleaseCandidate(['--create', '--repo-root', fixtureRoot, '--mode=release', '--json']);
    assert.equal(create.status, 0, `${create.stdout}\n${create.stderr}`);

    fs.writeFileSync(
      path.join(fixtureRoot, 'scripts', 'doctor.mjs'),
      "console.error('DOCTOR_STRICT_FIXTURE_FAIL=1');\nprocess.exit(1);\n",
      'utf8',
    );

    const verify = runReleaseCandidate(['--verify', '--repo-root', fixtureRoot, '--mode=promotion', '--json']);
    assert.notEqual(verify.status, 0, 'promotion mode must fail when doctor strict fails');
    const payload = parseJsonOutput(verify);
    assert.equal(payload.result, 'FAIL');
    assert.match(String(payload.failReason || ''), /^DOCTOR_STRICT_FAILED:/u);
    assert.equal(payload.evidencePackPath, undefined);

    const evidenceRoot = path.join(fixtureRoot, 'docs', 'OPS', 'EVIDENCE', 'promotion');
    assert.equal(fs.existsSync(evidenceRoot), false, 'failing doctor must not leave promotion evidence');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

// First Mac release cut v1: synthetic read-only scope proofs, never native/release qualification.
const { createHash, randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const MAC_CUT_PATH = path.join(REPO_ROOT, 'docs/OPS/R24/FIRST_MAC_RELEASE_CUT_V1.json');
const macModule = import(pathToFileURL(RC_SCRIPT_PATH).href);
const macHash = bytes => createHash('sha256').update(bytes).digest('hex');
const macCopy = value => JSON.parse(JSON.stringify(value));
async function macInputs() {
  const api = await macModule;
  return { api, cut: readJson(MAC_CUT_PATH), sources: Object.fromEntries(Object.keys(api.FIRST_MAC_RELEASE_SOURCE_PINS)
    .map(source => [source, fs.readFileSync(path.join(REPO_ROOT, source))])) };
}
function macVerify(input, cut = input.cut, sources = input.sources) {
  const cutBytes = Buffer.from(input.api.canonicalFirstMacReleaseCutV1(cut));
  return input.api.verifyFirstMacReleaseCutV1({ cutBytes, expectedCutSha256: macHash(cutBytes), sources });
}
function macRefused(t, input, label, mutate, code, sources = input.sources) {
  const cut = macCopy(input.cut); mutate(cut); const result = macVerify(input, cut, sources);
  assert.equal(result.scopeValidity, 'INVALID', label);
  assert.equal(result.readiness, 'NOT_READY', label);
  for (const key of ['programDone', 'signingAuthority', 'notarizationAuthority', 'publicationAuthority', 'releaseAuthorityGranted']) assert.equal(result[key], false, label);
  if (code) assert.match(result.error, code, label);
  t.diagnostic(JSON.stringify({ mutation: label, scopeValidity: result.scopeValidity, readiness: result.readiness, error: result.error }));
}
function macFixture(input) {
  const parent = process.platform === 'darwin' ? '/private/tmp' : fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'yalken-first-mac-cut-'));
  const marker = randomUUID(), markerPath = path.join(root, '.yalken-first-mac-cut-owner');
  fs.writeFileSync(markerPath, marker, { flag: 'wx' }); const identity = fs.lstatSync(root);
  for (const [source, bytes] of Object.entries(input.sources)) {
    const target = path.join(root, source); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  const cutPath = path.join(root, 'cut.json'); fs.writeFileSync(cutPath, input.api.canonicalFirstMacReleaseCutV1(input.cut), { flag: 'wx' });
  return { root, cutPath, pin: macHash(fs.readFileSync(cutPath)), cleanup() {
    const now = fs.lstatSync(root); assert.equal(now.dev, identity.dev); assert.equal(now.ino, identity.ino);
    assert.equal(fs.readFileSync(markerPath, 'utf8'), marker); fs.rmSync(root, { recursive: true });
  } };
}
function macRoster(root) {
  const rows = []; function visit(directory) { for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name), s = fs.lstatSync(file, { bigint: true });
    rows.push([path.relative(root, file), String(s.ino), String(s.mode), String(s.mtimeNs), s.isFile() ? macHash(fs.readFileSync(file)) : 'directory']);
    if (s.isDirectory()) visit(file);
  } } visit(root); return rows;
}
const MAC_DIRECTIONS = ['TXT_IMPORT', 'TXT_EXPORT', 'MARKDOWN_IMPORT', 'MARKDOWN_EXPORT', 'PROJECT_ARCHIVE_IMPORT', 'PROJECT_ARCHIVE_EXPORT', 'DOCX_IMPORT', 'DOCX_EXPORT'];
const MAC_REVIEW = [
  'cmd.project.review.openComments', 'cmd.project.review.openDocxReviewPreviewSession', 'cmd.project.review.exportDocxReviewPacket',
  'cmd.project.review.exportFullManuscriptDocxReviewPacket', 'cmd.project.review.editComment', 'cmd.project.review.decidePendingRevision',
  'cmd.project.review.recordTextRevisions', 'cmd.project.review.activateDocxReviewPreviewSession', 'cmd.project.review.applyExactTextChangesBatch',
  'cmd.project.review.applyFormattingReturn', 'cmd.project.review.applyStructuralReturn', 'cmd.project.review.inspectFormattingReturnReplay',
  'cmd.project.review.inspectStructuralReturnReplay', 'cmd.project.review.reloadReconciledScene',
];

test('first Mac scope is dependency-complete and distinct from candidate readiness', async () => {
  const input = await macInputs(), { cut } = input;
  const own = fs.readFileSync(__filename), marker = Buffer.from('\n// First Mac release cut v1:');
  assert.equal(macHash(own.subarray(0, own.indexOf(marker))), 'd8bcd61042a8a5e4ea9dd1162177f3de5a5353acf47e18fa32e0797e590f9679', 'all six legacy bodies and helpers remain byte-exact');
  const program = JSON.parse(input.sources['docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json']);
  assert.equal(program.nodes.length, 109); assert.equal(program.nodes.reduce((sum, n) => sum + n.dependsOn.length, 0), 171);
  const roots = ['WP-305_MINIMUM_INTERCHANGE', 'WP-709_MIXED_CHAINS', 'WP-902_ENTITLEMENT_PRODUCT', 'WP-906_RELEASE_VERDICT'];
  const byId = new Map(program.nodes.map(n => [n.id, n])), closure = new Set();
  const queue = [...roots]; while (queue.length) { const id = queue.shift(); if (!closure.has(id)) { closure.add(id); queue.push(...byId.get(id).dependsOn); } }
  const tuples = [...closure].sort().flatMap(dependent => byId.get(dependent).dependsOn.map(prerequisite => `${dependent}\0${prerequisite}`));
  assert.equal(closure.size, 68); assert.equal(tuples.length, 120);
  assert.deepEqual(cut.traceability.roots, roots); assert.deepEqual(cut.traceability.nodeIds, [...closure].sort());
  assert.deepEqual(cut.traceability.edges.map(e => `${e.dependent}\0${e.prerequisite}`), tuples);
  assert.deepEqual([...new Set(cut.traceability.edges.map(e => e.disposition))].sort(), ['deferred', 'inherited', 'narrowly-replaced']);
  assert.deepEqual(cut.minimumInterchange.routes.map(r => r.direction), MAC_DIRECTIONS);
  assert.deepEqual(cut.profiles.reviewCommandExceptions, MAC_REVIEW);
  const before = Object.fromEntries(Object.entries(input.sources).map(([p, b]) => [p, macHash(b)]));
  const result = macVerify(input);
  assert.equal(result.scopeValidity, 'VALID'); assert.equal(result.readiness, 'NOT_READY'); assert.equal(result.error, '');
  assert.equal(result.missingQualification.length, 12); assert.equal(result.qualificationPerformed, false);
  assert.equal(result.releaseAuthorityGranted, false); assert.equal(result.candidate.status, 'UNFROZEN'); assert.equal(result.token, undefined);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.missingQualification)); assert.ok(Object.isFrozen(result.missingQualification[0]));
  assert.deepEqual(Object.fromEntries(Object.entries(input.sources).map(([p, b]) => [p, macHash(b)])), before);
});

test('first Mac pure reader and actual opt-in CLI are read-only and return NOT_READY', async () => {
  const input = await macInputs(), fixture = macFixture(input);
  try {
    const before = macRoster(fixture.root);
    const result = input.api.readFirstMacReleaseCutV1({ repoRoot: fixture.root, cutPath: fixture.cutPath, expectedCutSha256: fixture.pin });
    assert.equal(result.scopeValidity, 'VALID'); assert.equal(result.readiness, 'NOT_READY');
    const run = runReleaseCandidate(['--verify-first-mac-cut', '--cut', fixture.cutPath, '--cut-sha256', fixture.pin, '--repo-root', fixture.root, '--json'], fixture.root);
    assert.equal(run.status, 0, run.stdout + run.stderr); assert.deepEqual(parseJsonOutput(run), result); assert.equal(run.stderr, '');
    assert.deepEqual(macRoster(fixture.root), before, 'no lock, doctor, proof, token, evidence or fixture write');
    assert.equal(fs.existsSync(path.join(fixture.root, 'docs/OPS/EVIDENCE')), false);
    assert.equal(fs.existsSync(path.join(fixture.root, 'docs/OPS/STATUS/RELEASE_CANDIDATE_LOCK.json')), false);
  } finally { fixture.cleanup(); }
});

test('first Mac scope refuses every individually omitted original dependency even after resealing', async t => {
  const input = await macInputs(); assert.equal(input.cut.traceability.edges.length, 120);
  for (let i = 0; i < 120; i += 1) {
    const edge = input.cut.traceability.edges[i], label = `edge ${i + 1}: ${edge.dependent} requires ${edge.prerequisite}`;
    await t.test(label, child => macRefused(child, input, label, cut => cut.traceability.edges.splice(i, 1), /^E_FIRST_MAC_TRACEABILITY$/));
  }
});

test('first Mac rejects same-count edge substitutions, policy and full-graph drift', async t => {
  const input = await macInputs();
  const changes = [
    ['duplicate tuple', c => { c.traceability.edges[0] = macCopy(c.traceability.edges[1]); }],
    ['unknown prerequisite', c => { c.traceability.edges[0].prerequisite = 'FORGED_NODE'; }],
    ['changed disposition', c => { c.traceability.edges[0].disposition = 'deferred'; }],
    ['lost applicable proof', c => { c.traceability.edges[0].proofObligations.pop(); }],
    ['foreign owner choice', c => { c.traceability.edges[0].ownerChoiceRef = 'ownerApproved'; }],
    ['prose-only replacement', c => { c.traceability.edges[0].reason = 'All prerequisites waived'; }],
    ['substituted closure node', c => { c.traceability.nodeIds[0] = 'FORGED_NODE'; }],
    ['filtered original program', c => { c.traceability.originalNodeCount = 68; c.traceability.originalEdgeCount = 120; }],
    ['lost original root', c => { c.traceability.roots.pop(); }],
  ];
  for (const [name, mutate] of changes) await t.test(name, child => macRefused(child, input, name, mutate, /^E_FIRST_MAC_TRACEABILITY$/));
  for (let i = 0; i < 9; i += 1) await t.test(`applicability S0${i + 1}`, child => macRefused(child, input, `applicability S0${i + 1}`, c => c.applicability.splice(i, 1), /^E_FIRST_MAC_APPLICABILITY$/));
});

test('first Mac protects each minimum-interchange direction and every current DOCX review exception', async t => {
  const input = await macInputs();
  for (let i = 0; i < 8; i += 1) await t.test(MAC_DIRECTIONS[i], child => macRefused(child, input, MAC_DIRECTIONS[i], c => c.minimumInterchange.routes.splice(i, 1), /^E_FIRST_MAC_INTERCHANGE$/));
  for (let i = 0; i < 14; i += 1) await t.test(MAC_REVIEW[i], child => macRefused(child, input, MAC_REVIEW[i], c => c.profiles.reviewCommandExceptions.splice(i, 1), /^E_FIRST_MAC_PROFILES$/));
  macRefused(t, input, 'same-count replaced route command', c => { c.minimumInterchange.routes[0].commandIds[0] = 'cmd.forged'; }, /^E_FIRST_MAC_INTERCHANGE$/);
  macRefused(t, input, 'silently atomic ExFAT claim', c => { c.minimumInterchange.archiveOutputPolicy.profiles[2].atomicPublication = true; }, /^E_FIRST_MAC_INTERCHANGE$/);
  macRefused(t, input, 'merged runtime and OPS profile', c => { c.profiles.runtime.profileId = 'WRITER_CORE'; }, /^E_FIRST_MAC_PROFILES$/);
  macRefused(t, input, 'old profile PASS promotion', c => { c.profiles.packageOps = 'PACKAGED_RELEASE_SECURITY_PASS'; }, /^E_FIRST_MAC_PROFILES$/);
});

test('first Mac cannot defer ordinary data safety, entitlement or qualification duties', async t => {
  const input = await macInputs();
  assert.equal(input.cut.protectedRequirements.length, 13);
  for (let i = 0; i < 13; i += 1) {
    const name = input.cut.protectedRequirements[i];
    await t.test(name, child => macRefused(child, input, name, c => c.protectedRequirements.splice(i, 1), /^E_FIRST_MAC_REQUIREMENTS$/));
  }
  for (const key of Object.keys(input.cut.qualificationPolicy)) await t.test(`qualification ${key}`, child => macRefused(child, input, key, c => { delete c.qualificationPolicy[key]; }, /^E_FIRST_MAC_QUALIFICATION_POLICY$/));
  macRefused(t, input, 'ordinary recovery moved post-release', c => { c.applicability[6].disposition = 'deferred'; }, /^E_FIRST_MAC_APPLICABILITY$/);
  macRefused(t, input, 'entitlement depends on encrypted feature', c => { c.applicability[2].proofObligations = []; }, /^E_FIRST_MAC_APPLICABILITY$/);
  macRefused(t, input, 'history truncated to fit output', c => { c.capabilityPolicy = 'VISIBLE_COMMANDS_ONLY'; }, /^E_FIRST_MAC_CAPABILITY_POLICY$/);
  macRefused(t, input, 'PRO silently enabled', c => { c.entitlement.policyId = 'PRO_ENABLED'; }, /^E_FIRST_MAC_ENTITLEMENT$/);
  macRefused(t, input, 'enabled encrypted feature deferred', c => { c.deferredCapabilities.newEncryptedProduct.enabled = true; }, /^E_FIRST_MAC_DEFERRED_CAPABILITIES$/);
});

test('first Mac qualification ledger keeps twelve unknown gaps and cannot self-approve readiness', async t => {
  const input = await macInputs();
  for (let i = 0; i < 12; i += 1) await t.test(`MAC-${String(i + 1).padStart(2, '0')}`, child => macRefused(child, input, `ledger row ${i + 1}`, c => c.qualification.splice(i, 1), /^E_FIRST_MAC_LEDGER$/));
  const mutations = [
    ['all-green ledger', c => c.qualification.forEach(r => { r.status = 'PASS'; })],
    ['changed current code source', c => { c.qualification[1].currentSources = ['forged.js']; }],
    ['missing independent oracle', c => { c.qualification[0].independentOracle = ''; }],
    ['no current gap', c => { c.qualification[0].missingCurrentProof = ''; }],
    ['historical proof now current', c => { c.qualification[0].historicalProof.currentCandidateAcceptance = true; }],
    ['ownerApproved true', c => { c.ownerApproved = true; }],
    ['independent true', c => { c.independent = true; }],
    ['fabricated physical proof', c => { c.physicalEvidence = { allGreen: true, independent: true }; }],
    ['legacy lock promotion', c => { c.token = { RELEASE_CANDIDATE_LOCK_MATCH_OK: 1 }; }],
    ['profile PASS promotion', c => { c.profileVerdict = 'PASS'; }],
  ];
  for (const [name, mutate] of mutations) await t.test(name, child => macRefused(child, input, name, mutate));
  for (const key of ['programDone', 'signingAuthority', 'notarizationAuthority', 'publicationAuthority']) await t.test(key, child => macRefused(child, input, key, c => { c.authority[key] = true; }, /^E_FIRST_MAC_AUTHORITY$/));
  for (const key of ['headSha', 'treeSha', 'buildId', 'artifactSha256']) await t.test(`stale candidate ${key}`, child => macRefused(child, input, key, c => { c.candidate[key] = 'a'.repeat(64); }, /^E_FIRST_MAC_CANDIDATE_UNFROZEN$/));
  macRefused(t, input, 'stale admission identity', c => { c.basis.admissionBaseSha = '0'.repeat(40); }, /^E_FIRST_MAC_BASIS$/);
  macRefused(t, input, 'different remote identity', c => { c.basis.repository = 'https://invalid.example/foreign'; }, /^E_FIRST_MAC_BASIS$/);
});

test('first Mac refuses changed, omitted and jointly resealed protected source bytes', async t => {
  const input = await macInputs(), paths = Object.keys(input.api.FIRST_MAC_RELEASE_SOURCE_PINS); assert.equal(paths.length, 38);
  for (const source of paths) await t.test(source, child => {
    const sources = { ...input.sources, [source]: Buffer.concat([input.sources[source], Buffer.from('\n// forged\n')]) };
    macRefused(child, input, `changed source ${source}`, () => {}, /^E_FIRST_MAC_SOURCE_DRIFT:/, sources);
    macRefused(child, input, `jointly resealed source ${source}`, c => { c.sourceBindings[source] = macHash(sources[source]); }, /^E_FIRST_MAC_SOURCE_BINDINGS$/, sources);
    const omitted = { ...input.sources }; delete omitted[source];
    macRefused(child, input, `omitted source ${source}`, () => {}, /^E_FIRST_MAC_SOURCES$/, omitted);
  });
  macRefused(t, input, 'candidate source path traversal', c => { c.sourceBindings['../../foreign'] = '0'.repeat(64); }, /^E_FIRST_MAC_SOURCE_BINDINGS$/);
});

test('first Mac rejects malformed, ambiguous, oversized and unpinned canonical input', async t => {
  const input = await macInputs(), good = Buffer.from(input.api.canonicalFirstMacReleaseCutV1(input.cut));
  const bad = [
    ['malformed', Buffer.from('{')], ['duplicate keys', Buffer.from(good.toString().replace('{', '{"cutId":"forged",'))],
    ['noncanonical whitespace', Buffer.concat([good, Buffer.from(' ')])], ['BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), good])],
    ['invalid UTF8', Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d])], ['oversized', Buffer.alloc(1024 * 1024 + 1, 0x20)],
    ['empty', Buffer.alloc(0)], ['wrong JSON type', Buffer.from('[]\n')],
  ];
  for (const [name, cutBytes] of bad) await t.test(name, child => {
    const result = input.api.verifyFirstMacReleaseCutV1({ cutBytes, expectedCutSha256: macHash(cutBytes), sources: input.sources });
    assert.equal(result.scopeValidity, 'INVALID', name); assert.equal(result.readiness, 'NOT_READY'); child.diagnostic(JSON.stringify(result));
  });
  for (const pin of [undefined, '', 'f'.repeat(64), 'A'.repeat(64)]) assert.equal(input.api.verifyFirstMacReleaseCutV1({ cutBytes: good, expectedCutSha256: pin, sources: input.sources }).error, 'E_FIRST_MAC_CUT_PIN');
  assert.equal(input.api.verifyFirstMacReleaseCutV1({ cutBytes: good.toString(), expectedCutSha256: macHash(good), sources: input.sources }).error, 'E_FIRST_MAC_CUT_SIZE_TYPE');
});

test('first Mac filesystem boundary refuses symlinks, wrong types, size and source drift before interpretation', async t => {
  const input = await macInputs(), fixture = macFixture(input);
  const read = (cutPath = fixture.cutPath) => input.api.readFirstMacReleaseCutV1({ repoRoot: fixture.root, cutPath, expectedCutSha256: fixture.pin });
  try {
    const link = path.join(fixture.root, 'linked-cut.json'); fs.symlinkSync(fixture.cutPath, link); assert.equal(read(link).scopeValidity, 'INVALID');
    const parent = path.join(fixture.root, 'linked-parent'); fs.symlinkSync(fixture.root, parent, 'dir'); assert.equal(read(path.join(parent, 'cut.json')).scopeValidity, 'INVALID');
    assert.equal(read(fixture.root).scopeValidity, 'INVALID');
    const huge = path.join(fixture.root, 'huge.json'); fs.writeFileSync(huge, Buffer.alloc(1024 * 1024 + 1)); assert.equal(read(huge).scopeValidity, 'INVALID');
    const source = Object.keys(input.sources)[0], target = path.join(fixture.root, source), original = fs.readFileSync(target);
    fs.unlinkSync(target); fs.symlinkSync(fixture.cutPath, target); assert.equal(read().scopeValidity, 'INVALID'); fs.unlinkSync(target); fs.writeFileSync(target, original);
    fs.appendFileSync(target, '\n'); assert.match(read().error, /^E_FIRST_MAC_SOURCE_DRIFT:/);
    // Forged candidate path is rejected before any missing repository source is opened.
    const forged = macCopy(input.cut); forged.sourceBindings['/does/not/exist/foreign'] = 'a'.repeat(64);
    const forgedBytes = Buffer.from(input.api.canonicalFirstMacReleaseCutV1(forged)); fs.writeFileSync(fixture.cutPath, forgedBytes);
    const result = input.api.readFirstMacReleaseCutV1({ repoRoot: path.join(fixture.root, 'missing'), cutPath: fixture.cutPath, expectedCutSha256: macHash(forgedBytes) });
    assert.equal(result.error, 'E_FIRST_MAC_SOURCE_BINDINGS'); t.diagnostic(JSON.stringify(result));
  } finally { fixture.cleanup(); }
});

test('first Mac explicit CLI refuses legacy effects, wrong mode and ambiguous flags', async t => {
  const input = await macInputs(), fixture = macFixture(input);
  try {
    const before = macRoster(fixture.root), args = ['--verify-first-mac-cut', '--cut', fixture.cutPath, '--cut-sha256', fixture.pin, '--repo-root', fixture.root, '--json'];
    for (const extra of [['--create'], ['--verify'], ['--mode', 'promotion'], ['--mode', 'release'], ['--evidence-root', fixture.root], ['--lock-path', fixture.cutPath], ['--unknown'], ['--json']]) {
      const run = runReleaseCandidate([...args, ...extra], fixture.root); assert.notEqual(run.status, 0); const p = parseJsonOutput(run);
      assert.equal(p.scopeValidity, 'INVALID'); assert.equal(p.readiness, 'NOT_READY'); assert.equal(p.token, undefined); assert.equal(p.releaseAuthorityGranted, false);
      t.diagnostic(JSON.stringify({ extra, result: p }));
    }
    const noPin = runReleaseCandidate(['--verify-first-mac-cut', '--cut', fixture.cutPath, '--json'], fixture.root);
    assert.notEqual(noPin.status, 0); assert.equal(parseJsonOutput(noPin).error, 'E_FIRST_MAC_CLI_USAGE');
    assert.deepEqual(macRoster(fixture.root), before);
  } finally { fixture.cleanup(); }
});


test('first Mac inherited evidence policy cannot replace original contracts with supplemental safety labels', async t => {
  const input = await macInputs();
  assert.equal(input.cut.traceability.inheritedEvidencePolicy, 'ORIGINAL_REQUIRED_EVIDENCE_CONTRACTS_REMAIN_REQUIRED_FOR_INCLUDED_OBLIGATIONS');
  await t.test('missing inherited contract policy', child => macRefused(child, input, 'missing inherited contract policy', c => { delete c.traceability.inheritedEvidencePolicy; }, /^E_FIRST_MAC_TRACEABILITY$/));
  await t.test('weakened inherited contract policy', child => macRefused(child, input, 'weakened inherited contract policy', c => { c.traceability.inheritedEvidencePolicy = 'S07_REPLACES_ALL_BASELINE_EVIDENCE'; }, /^E_FIRST_MAC_TRACEABILITY$/));
  assert.equal(input.api.readFirstMacReleaseCutV1({ repoRoot: REPO_ROOT + '/docs/..', cutPath: MAC_CUT_PATH, expectedCutSha256: macHash(fs.readFileSync(MAC_CUT_PATH)) }).error, 'E_FIRST_MAC_INPUT_PATH');
});

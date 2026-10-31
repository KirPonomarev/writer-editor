// Dynamic imports keep the behavior file usable in the maintained CommonJS unit
// lane after a separately admitted path move. Fixtures never run product code.
async function register() {
  const { default: test } = await import('node:test');
  const { default: assert } = await import('node:assert/strict');
  const { default: fs } = await import('node:fs');
  const { default: path } = await import('node:path');
  const { default: os } = await import('node:os');
  const { execFileSync, spawnSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const load = p => import(pathToFileURL(path.join(repo, p)));
  const api = await load('scripts/ops/r24/corrective/current-bindings-finalizer.mjs');
  const { canonicalBytes, sha256 } = await load('scripts/ops/r24/corrective/canonical-json.mjs');
  const { buildInventory } = await load('scripts/ops/r24/test-inventory.mjs');
  const c2a = await load('scripts/ops/r24/corrective/c2a-effective-certification.mjs');
  const rcv = await load('scripts/ops/r24/corrective/rcv01a-normative-claim-test-lane-manifest.mjs');
  const [INV, APPROVALS, MANIFEST, CLAIMS, POLICY, DATA, CERT] = api.TARGETS;
  const FOO = 'src/fixture-input.js', PROTECTED = 'docs/fixture-protected.json';
  const cli = path.join(repo, 'scripts/ops/r24/corrective/current-bindings-finalizer.mjs');
  const originalManifest = JSON.parse(fs.readFileSync(path.join(repo, MANIFEST)));
  const originalInventory = JSON.parse(fs.readFileSync(path.join(repo, INV)));
  const originalPolicy = JSON.parse(fs.readFileSync(path.join(repo, POLICY)));
  let number = 0;
  const write = (root, name, bytes) => {
    const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, bytes);
  };
  function fixture() {
    const parent = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'current-bindings-finalizer-'));
    const root = path.join(parent, 'repo'); fs.mkdirSync(root);
    const names = new Set([
      ...c2a.buildApprovals(repo).approvals.map(row => row.filePath),
      ...originalManifest.claims.flatMap(row => row.exactTests.map(item => item.testId)),
      ...originalInventory.lateMjsPaths,
      rcv.PATHS.claimRegistry, rcv.PATHS.testAssuranceMatrix, rcv.PATHS.verifier, rcv.PATHS.contractTest,
      'scripts/ops/rtk-interop-data-c1-readback.py',
    ]);
    for (const name of names) write(root, name, fs.readFileSync(path.join(repo, name)));
    write(root, FOO, 'export const fixtureValue = 1;\n'); write(root, PROTECTED, '{"original":true}\n');
    write(root, INV, canonicalBytes(buildInventory(root)));
    write(root, APPROVALS, canonicalBytes(c2a.buildApprovals(root)));
    const manifest = rcv.buildManifest({ repoRoot: root }); write(root, MANIFEST, canonicalBytes(manifest));
    write(root, CLAIMS, canonicalBytes(rcv.buildClaimBindings({ repoRoot: root, manifest })));
    // This is a small metadata fixture, not an executed DATA qualification. All
    // actual production protected members remain untouched in the source repo.
    const policy = structuredClone(originalPolicy);
    policy.admittedPaths = [...api.TARGETS, FOO];
    policy.protectedFiles = [{ path: PROTECTED, sha256: sha256(fs.readFileSync(path.join(root, PROTECTED))) }];
    policy.qualifiedRuntimeRepair.sourceBindings = [FOO, APPROVALS].map(name => ({ path: name, sha256: sha256(fs.readFileSync(path.join(root, name))) }));
    write(root, POLICY, JSON.stringify(policy, null, 2) + '\n');
    write(root, DATA, '// original DATA guard prefix\n' + `export const DATA_POLICY_SHA256='${sha256(fs.readFileSync(path.join(root, POLICY)))}';\n`
      + 'const DATA_ADMITTED_PATHS=' + JSON.stringify(policy.admittedPaths) + ';\n// original DATA guard suffix\n');
    const taskId = 'YALKEN_FINALIZER_FIXTURE';
    const delta = { id: taskId, successorBaseSha: '0'.repeat(40), successorBaseTree: '0'.repeat(40),
      bindings: [INV, APPROVALS, MANIFEST, CLAIMS, DATA, FOO].map(name => ({ path: name, sha256: sha256(fs.readFileSync(path.join(root, name))) })),
      guards: [{ path: POLICY, sha256: sha256(fs.readFileSync(path.join(root, POLICY))) }] };
    const cert = value => '/* immutable historical sentinel: old head, review and executedEvidence */\n'
      + 'const R24_INTEROP_FINALIZER_FIXTURE_DELTA = Object.freeze(' + JSON.stringify(value, null, 2) + ');\n'
      + 'const R24_INTEROP_CURRENT_INPUTS_DELTA = R24_INTEROP_FINALIZER_FIXTURE_DELTA;\n';
    write(root, CERT, cert(delta));
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git(['init', '-q', '-b', 'main']); git(['add', '.']);
    git(['-c', 'user.name=Codex Fixture', '-c', 'user.email=fixture@invalid.example', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'owned finalizer fixture']);
    const head = git(['rev-parse', 'HEAD']), tree = git(['rev-parse', 'HEAD^{tree}']);
    delta.successorBaseSha = head; delta.successorBaseTree = tree; write(root, CERT, cert(delta));
    const request = { schemaVersion: 'YALKEN_CURRENT_BINDINGS_REQUEST_V1', taskId, expectedHead: head, bindingBaseSha: head, bindingBaseTree: tree,
      scopeIn: [...new Set([...api.TARGETS, ...names, FOO, PROTECTED, 'docs/new-task.md'])],
      expectedOld: Object.fromEntries(api.TARGETS.map(name => [name, sha256(fs.readFileSync(path.join(root, name)))])),
      additionalAdmittedPaths: [], additionalSourcePaths: [] };
    const baseline = api.prepareCurrentBindings(root, request);
    assert.equal(baseline.proposal.changes.filter(row => row.changed).length, 0, 'unchanged real producer control must pass before any adversary');
    console.log('RETAINED_OWNED_FINALIZER_FIXTURE=' + parent);
    return { root, parent, request, git, delta, cert, selectedTest: originalManifest.claims.find(row => row.required).exactTests[0].testId,
      journal: () => path.join(parent, 'journal-' + (++number) + '.jsonl') };
  }
  const snapshot = f => Object.fromEntries(api.TARGETS.map(name => {
    const p = path.join(f.root, name), s = fs.statSync(p, { bigint: true });
    return [name, { bytesBase64: fs.readFileSync(p).toString('base64'), identity: [s.dev, s.ino, s.mode, s.uid, s.gid, s.size, s.mtimeNs, s.ctimeNs].map(String) }];
  }));
  const changedTest = f => fs.appendFileSync(path.join(f.root, f.selectedTest), '\n// real changed inventory input in owned fixture\n');
  const pin = (f, name) => { f.request.expectedOld[name] = sha256(fs.readFileSync(path.join(f.root, name))); };
  const editJson = (f, name, change) => {
    const v = JSON.parse(fs.readFileSync(path.join(f.root, name))); change(v);
    write(f.root, name, name === POLICY ? JSON.stringify(v, null, 2) + '\n' : canonicalBytes(v)); pin(f, name);
  };
  function refused(f, expression, pattern) {
    const before = snapshot(f); assert.throws(expression, pattern); assert.deepEqual(snapshot(f), before, 'refusal must preserve every target byte');
  }

  test('complete no-op proposal reuses the actual deterministic producer tuples without writes', () => {
    const f = fixture(), before = snapshot(f), result = api.prepareCurrentBindings(f.root, f.request);
    assert.deepEqual(snapshot(f), before); assert.equal(result.proposal.changes.length, 7);
    assert.ok(result.proposal.changes.every(row => !row.changed));
    assert.equal(result.proposal.releaseAcceptance, false); assert.equal(result.proposal.wholeSetAtomic, false);
    assert.equal(result.proposal.nonCooperatingWriterCas, false);
    assert.equal(result.proposalSha256, sha256(canonicalBytes(result.proposal)));
    assert.equal(result.proposal.changes.find(row => row.path === APPROVALS).afterSha256, sha256(canonicalBytes(c2a.buildApprovals(f.root))));
    assert.equal(result.proposal.changes.find(row => row.path === MANIFEST).afterSha256, sha256(canonicalBytes(rcv.buildManifest({ repoRoot: f.root }))));
  });
  test('one actual changed test propagates through all seven future digests before physical apply', () => {
    const f = fixture(); changedTest(f); const before = snapshot(f), prepared = api.prepareCurrentBindings(f.root, f.request);
    assert.ok(prepared.proposal.changes.every(row => row.changed)); assert.deepEqual(snapshot(f), before);
    const journal = f.journal(), result = api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: journal });
    assert.equal(result.status, 'APPLIED_METADATA_ONLY'); assert.deepEqual(result.completed, api.TARGETS);
    for (const row of prepared.proposal.changes) assert.equal(sha256(fs.readFileSync(path.join(f.root, row.path))), row.afterSha256);
    const records = fs.readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records[0].event, 'BEGIN'); assert.equal(records.at(-1).event, 'COMPLETE');
    assert.deepEqual(records.filter(row => row.event === 'DURABLE').map(row => row.path), api.TARGETS);
    const oldClaims = JSON.parse(Buffer.from(before[CLAIMS].bytesBase64, 'base64')), nextClaims = JSON.parse(fs.readFileSync(path.join(f.root, CLAIMS)));
    for (const key of ['verdict', 'identityMode', 'headSha', 'originMainSha', 'generatedAtUtc', 'independentReviewEvidence', 'executedEvidence']) assert.deepEqual(nextClaims[key], oldClaims[key]);
    const cert = fs.readFileSync(path.join(f.root, CERT), 'utf8'); assert.ok(cert.startsWith('/* immutable historical sentinel: old head, review and executedEvidence */\n'));
    for (const name of api.TARGETS) pin(f, name);
    const after = snapshot(f), noOp = api.prepareCurrentBindings(f.root, f.request);
    assert.ok(noOp.proposal.changes.every(row => !row.changed));
    const repeated = api.applyCurrentBindings(f.root, f.request, noOp.proposalSha256, { journalPath: f.journal() });
    assert.deepEqual(repeated.completed, []); assert.deepEqual(snapshot(f), after);
  });
  test('the CLI executes caller-pinned canonical preparation with no target writes', () => {
    const f = fixture(), filename = path.join(f.parent, 'request.json'); fs.writeFileSync(filename, canonicalBytes(f.request));
    const before = snapshot(f), raw = execFileSync(process.execPath, [cli, 'prepare', '--request', filename, '--request-sha256', sha256(fs.readFileSync(filename))], { cwd: f.root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const result = JSON.parse(raw); assert.equal(result.proposal.changes.length, 7); assert.deepEqual(snapshot(f), before);
  });
  test('preparation leaves the Git index intact even when its cached file stat is stale', () => {
    const f = fixture(), name = path.join(f.root, f.selectedTest), stat = fs.statSync(name);
    fs.utimesSync(name, stat.atime, new Date(stat.mtimeMs + 2000));
    const index = path.resolve(f.root, f.git(['rev-parse', '--git-path', 'index']));
    const state = () => { const s = fs.statSync(index, { bigint: true }); return {
      bytes: fs.readFileSync(index).toString('base64'), identity: [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String),
    }; };
    const before = state(); api.prepareCurrentBindings(f.root, f.request); assert.deepEqual(state(), before);
  });
  test('late unknown delta format refuses the whole prepared set without a first target write', () => {
    const f = fixture(); changedTest(f); const p = path.join(f.root, CERT);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Object.freeze(', 'Object.seal(')); pin(f, CERT);
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_DELTA_FORMAT/u);
  });
  test('an omitted inherited certification input is caught before any proposed target write', () => {
    const f = fixture(); changedTest(f); f.delta.bindings = f.delta.bindings.filter(row => row.path !== FOO);
    write(f.root, CERT, f.cert(f.delta)); pin(f, CERT);
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_INHERITED_BINDING_MISSING/u);
  });
  test('a new admitted path also needs an explicit current certification binding', () => {
    const f = fixture(); write(f.root, 'docs/new-task.md', 'owned fixture addition\n'); f.request.additionalAdmittedPaths = ['docs/new-task.md'];
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_ADDITION_UNBOUND/u);
    f.delta.bindings.push({ path: 'docs/new-task.md', sha256: sha256(fs.readFileSync(path.join(f.root, 'docs/new-task.md'))) });
    write(f.root, CERT, f.cert(f.delta)); pin(f, CERT);
    const before = snapshot(f), prepared = api.prepareCurrentBindings(f.root, f.request);
    assert.deepEqual(snapshot(f), before); assert.equal(prepared.proposal.changes.find(row => row.path === POLICY).changed, true);
  });
  test('unknown policy fields and removal of old members are not silently normalized', () => {
    const f = fixture(); editJson(f, POLICY, v => { v.unrecognizedFutureField = true; });
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_POLICY_HISTORY/u);
    const g = fixture(); editJson(g, POLICY, v => { v.admittedPaths.pop(); });
    refused(g, () => api.prepareCurrentBindings(g.root, g.request), /E_CURRENT_BINDINGS_POLICY_REMOVAL/u);
  });
  test('stale expected-old digest refuses before any target changes', () => {
    const f = fixture(); f.request.expectedOld[CLAIMS] = 'f'.repeat(64);
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_EXPECTED_OLD/u);
  });
  test('input changed after prepare invalidates the exact apply proposal before journal or targets', () => {
    const f = fixture(); changedTest(f); const prepared = api.prepareCurrentBindings(f.root, f.request), journal = f.journal();
    fs.appendFileSync(path.join(f.root, FOO), '// later source revision\n');
    refused(f, () => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: journal }), /E_CURRENT_BINDINGS_PROPOSAL_CHANGED/u);
    assert.equal(fs.existsSync(journal), false);
  });
  test('HEAD changes invalidate a frozen proposal instead of binding new source implicitly', () => {
    const f = fixture(), prepared = api.prepareCurrentBindings(f.root, f.request); f.git(['add', '.']);
    f.git(['-c', 'user.name=Codex Fixture', '-c', 'user.email=fixture@invalid.example', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'next owned fixture revision']);
    refused(f, () => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: f.journal() }), /E_CURRENT_BINDINGS_HEAD/u);
  });
  test('same-byte source replacement invalidates the read identity instead of hiding an ABA change', () => {
    const f = fixture(), prepared = api.prepareCurrentBindings(f.root, f.request), filename = path.join(f.root, FOO), bytes = fs.readFileSync(filename);
    fs.writeFileSync(filename, bytes);
    refused(f, () => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: f.journal() }), /E_CURRENT_BINDINGS_PROPOSAL_CHANGED/u);
  });
  test('an existing cooperative writer lock is retained and never stolen', () => {
    const f = fixture(); changedTest(f); const prepared = api.prepareCurrentBindings(f.root, f.request);
    const lock = path.resolve(f.root, f.git(['rev-parse', '--git-path', 'current-bindings-finalizer.lock']));
    fs.writeFileSync(lock, 'existing-other-owner\n');
    refused(f, () => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: f.journal() }), /EEXIST/u);
    assert.equal(fs.readFileSync(lock, 'utf8'), 'existing-other-owner\n');
  });
  test('old C2A standing approval metadata is protected even with a correct new old-file pin', () => {
    const f = fixture(); editJson(f, APPROVALS, v => { v.approvals[0].approvedBy = 'fabricated-new-human'; });
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_APPROVAL_HISTORY/u);
  });
  test('old RCV execution evidence cannot be promoted by a current digest refresh', () => {
    const f = fixture(); editJson(f, CLAIMS, v => { v.executedEvidence[0].tests.pass += 1; });
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_CLAIM_HISTORY/u);
  });
  test('old RCV identity fields cannot be retagged as current', () => {
    const f = fixture(); editJson(f, MANIFEST, v => { v.identity.headSha = f.request.expectedHead; });
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_MANIFEST_HISTORY/u);
  });
  test('unknown inventory version fails before generating target bytes', () => {
    const f = fixture(); editJson(f, INV, v => { v.schemaVersion = 'UNKNOWN_V2'; });
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_INVENTORY_VERSION/u);
  });
  test('protected source bytes are verified rather than silently resealed', () => {
    const f = fixture(); fs.appendFileSync(path.join(f.root, PROTECTED), 'changed');
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_PROTECTED_FILE/u);
  });
  test('arbitrary target keys and undeclared additions cannot acquire filesystem authority', () => {
    const f = fixture(); f.request.expectedOld['outside.txt'] = '0'.repeat(64);
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_FORMAT/u);
    delete f.request.expectedOld['outside.txt']; f.request.additionalAdmittedPaths = ['outside.txt'];
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_UNDECLARED_ADDITION/u);
  });
  test('traversal, absolute and noncanonical path payloads fail before dereference', () => {
    const f = fixture();
    for (const name of ['../outside.txt', '/etc/passwd', 'src//fixture-input.js', 'src/./fixture-input.js']) {
      const request = structuredClone(f.request); request.additionalSourcePaths = [name];
      refused(f, () => api.prepareCurrentBindings(f.root, request), /E_CURRENT_BINDINGS_PATH/u);
    }
  });
  test('case aliases cannot create a second source identity on case-insensitive filesystems', () => {
    const f = fixture(), alias = 'src/FIXTURE-INPUT.js'; f.request.scopeIn.push(alias); f.request.additionalSourcePaths = [alias];
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_PATH_ALIAS|ENOENT/u);
  });
  test('policy source cycles and duplicate bindings are refused before target changes', () => {
    const f = fixture(); f.request.additionalSourcePaths = [DATA];
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_SOURCE_CYCLE/u);
    f.request.additionalSourcePaths = []; editJson(f, POLICY, v => { v.qualifiedRuntimeRepair.sourceBindings.push(v.qualifiedRuntimeRepair.sourceBindings[0]); });
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_SOURCE_DUPLICATE/u);
  });
  test('symlinked input and hard-linked target are rejected without following aliases', () => {
    const f = fixture(), alias = 'src/alias.js'; fs.symlinkSync(path.join(f.root, FOO), path.join(f.root, alias));
    f.request.scopeIn.push(alias); f.request.additionalSourcePaths = [alias];
    refused(f, () => api.prepareCurrentBindings(f.root, f.request), /E_CURRENT_BINDINGS_SYMLINK/u);
    const g = fixture(); fs.linkSync(path.join(g.root, INV), path.join(g.parent, 'inventory-hardlink'));
    refused(g, () => api.prepareCurrentBindings(g.root, g.request), /E_CURRENT_BINDINGS_FILE_TYPE/u);
  });
  test('canonical request reader rejects duplicate fields and symbolic-link ancestors', () => {
    const f = fixture(), filename = path.join(f.parent, 'request.json'), bytes = canonicalBytes(f.request);
    fs.writeFileSync(filename, bytes); assert.deepEqual(api.readFinalizerRequest(filename, sha256(bytes)), f.request);
    const duplicate = Buffer.from(bytes.toString().replace('{', '{"taskId":"other",'));
    fs.writeFileSync(filename, duplicate); assert.throws(() => api.readFinalizerRequest(filename, sha256(duplicate)), /E_CURRENT_BINDINGS_REQUEST_CANONICAL/u);
    fs.writeFileSync(filename, bytes); const alias = path.join(f.parent, 'linked-parent'); fs.symlinkSync(f.parent, alias);
    assert.throws(() => api.readFinalizerRequest(path.join(alias, 'request.json'), sha256(bytes)), /E_CURRENT_BINDINGS_SYMLINK/u);
  });
  test('injected fourth-file rename I/O failure preserves actual earlier writes and accurate partial journal', () => {
    const f = fixture(); changedTest(f); const prepared = api.prepareCurrentBindings(f.root, f.request), before = snapshot(f), journal = f.journal();
    const rename = fs.renameSync; let faults = 0;
    try {
      fs.renameSync = (from, to) => { if (to === path.join(f.root, CLAIMS)) { faults += 1; throw new Error('FIXTURE_INJECTED_RENAME_EIO'); } return rename(from, to); };
      assert.throws(() => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: journal }), /FIXTURE_INJECTED_RENAME_EIO/u);
    } finally { fs.renameSync = rename; }
    assert.equal(faults, 1);
    const records = fs.readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse), failure = records.find(row => row.event === 'FAILED');
    assert.equal(records.some(row => row.event === 'COMPLETE'), false); assert.deepEqual(failure.completed, api.TARGETS.slice(0, 3));
    assert.equal(failure.actualState, 'BEFORE_TARGET_WRITE'); assert.equal(failure.rollbackPerformed, false);
    for (let i = 0; i < api.TARGETS.length; i += 1) {
      const name = api.TARGETS[i], now = fs.readFileSync(path.join(f.root, name));
      if (i < 3) assert.equal(sha256(now), prepared.proposal.changes[i].afterSha256);
      else assert.equal(now.toString('base64'), before[name].bytesBase64);
    }
  });
  test('rename followed by failed directory durability remains UNKNOWN rather than durable success', () => {
    const f = fixture(); changedTest(f); const prepared = api.prepareCurrentBindings(f.root, f.request), before = snapshot(f), journal = f.journal();
    const fsync = fs.fsyncSync; let faults = 0;
    try {
      fs.fsyncSync = fd => {
        if (fs.fstatSync(fd).isDirectory()) { faults += 1; throw new Error('FIXTURE_INJECTED_DIRECTORY_FSYNC_EIO'); }
        return fsync(fd);
      };
      assert.throws(() => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: journal }), /FIXTURE_INJECTED_DIRECTORY_FSYNC_EIO/u);
    } finally { fs.fsyncSync = fsync; }
    assert.equal(faults, 1);
    const records = fs.readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse), failure = records.find(row => row.event === 'FAILED');
    assert.equal(failure.actualState, 'RENAMED_DURABILITY_UNKNOWN'); assert.deepEqual(failure.completed, []);
    assert.equal(records.some(row => row.event === 'DURABLE' || row.event === 'COMPLETE'), false);
    assert.equal(sha256(fs.readFileSync(path.join(f.root, INV))), prepared.proposal.changes[0].afterSha256);
    for (const name of api.TARGETS.slice(1)) assert.equal(fs.readFileSync(path.join(f.root, name)).toString('base64'), before[name].bytesBase64);
  });
  test('a source change between two actual writes stops the next publication and preserves the truthful prefix', () => {
    const f = fixture(); changedTest(f); const prepared = api.prepareCurrentBindings(f.root, f.request), before = snapshot(f), journal = f.journal();
    const rename = fs.renameSync;
    try {
      fs.renameSync = (from, to) => {
        const result = rename(from, to);
        if (to === path.join(f.root, INV)) fs.appendFileSync(path.join(f.root, FOO), '// concurrent source change after first actual rename\n');
        return result;
      };
      assert.throws(() => api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: journal }), /E_CURRENT_BINDINGS_INPUT_CHANGED/u);
    } finally { fs.renameSync = rename; }
    const records = fs.readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse), failure = records.find(row => row.event === 'FAILED');
    assert.deepEqual(failure.completed, [INV]); assert.equal(records.some(row => row.event === 'COMPLETE'), false);
    assert.equal(sha256(fs.readFileSync(path.join(f.root, INV))), prepared.proposal.changes[0].afterSha256);
    for (const name of api.TARGETS.slice(1)) assert.equal(fs.readFileSync(path.join(f.root, name)).toString('base64'), before[name].bytesBase64);
  });
  function seedCurrentPolicyMembership(f, { admitted = false, source = false } = {}) {
    const outsider = rcv.PATHS.claimRegistry;
    assert.equal(fs.readFileSync(path.join(f.root, outsider), 'utf8').trim(), f.git(['show', f.request.bindingBaseSha + ':' + outsider]));
    editJson(f, POLICY, value => {
      assert.equal(value.admittedPaths.includes(outsider), false);
      assert.equal(value.qualifiedRuntimeRepair.sourceBindings.some(row => row.path === outsider), false);
      if (admitted) value.admittedPaths.push(outsider);
      if (source) value.qualifiedRuntimeRepair.sourceBindings.push({ path: outsider, sha256: sha256(fs.readFileSync(path.join(f.root, outsider))) });
    });
    const value = JSON.parse(fs.readFileSync(path.join(f.root, POLICY)));
    const currentData = fs.readFileSync(path.join(f.root, DATA), 'utf8');
    assert.equal([...currentData.matchAll(/^export const DATA_POLICY_SHA256='[a-f0-9]{64}';$/gmu)].length, 1);
    assert.equal([...currentData.matchAll(/^const DATA_ADMITTED_PATHS=\[.*\];$/gmu)].length, 1);
    write(f.root, DATA, currentData.replace(/^export const DATA_POLICY_SHA256='[a-f0-9]{64}';$/mu,
      `export const DATA_POLICY_SHA256='${sha256(fs.readFileSync(path.join(f.root, POLICY)))}';`)
      .replace(/^const DATA_ADMITTED_PATHS=\[.*\];$/mu, 'const DATA_ADMITTED_PATHS=' + JSON.stringify(value.admittedPaths) + ';'));
    pin(f, DATA);
    return outsider;
  }
  for (const membership of ['admitted', 'source']) {
    test('preseeded current ' + membership + ' membership outside caller scope refuses before prepare or apply writes', () => {
      const f = fixture(), outsider = rcv.PATHS.claimRegistry;
      f.request.scopeIn = f.request.scopeIn.filter(name => name !== outsider);
      assert.equal(f.request.scopeIn.includes(outsider), false);
      const controlBefore = snapshot(f), control = api.prepareCurrentBindings(f.root, f.request);
      assert.ok(control.proposal.changes.every(row => !row.changed));
      assert.deepEqual(snapshot(f), controlBefore, 'the same outside-scope read-only input works before the extra membership');
      seedCurrentPolicyMembership(f, { [membership]: true });
      assert.equal(f.request.additionalAdmittedPaths.includes(outsider), false);
      assert.equal(f.request.additionalSourcePaths.includes(outsider), false);
      const expected = membership === 'admitted' ? /E_CURRENT_BINDINGS_UNDECLARED_POLICY_ADMITTED_PATH/u : /E_CURRENT_BINDINGS_UNDECLARED_POLICY_SOURCE_PATH/u;
      refused(f, () => api.prepareCurrentBindings(f.root, f.request), expected);
      const journal = f.journal();
      refused(f, () => api.applyCurrentBindings(f.root, f.request, control.proposalSha256, { journalPath: journal }), expected);
      assert.equal(fs.existsSync(journal), false);
      assert.equal(fs.readFileSync(path.join(f.root, outsider), 'utf8').trim(), f.git(['show', f.request.bindingBaseSha + ':' + outsider]));
    });
  }
  test('matched preseeded memberships remain valid when both typed caller additions and scope declare them', () => {
    const f = fixture(), outsider = rcv.PATHS.claimRegistry;
    assert.equal(f.request.scopeIn.includes(outsider), true);
    seedCurrentPolicyMembership(f, { admitted: true, source: true });
    f.request.additionalAdmittedPaths = [outsider]; f.request.additionalSourcePaths = [outsider];
    f.delta.bindings.push({ path: outsider, sha256: sha256(fs.readFileSync(path.join(f.root, outsider))) });
    for (const row of f.delta.bindings) row.sha256 = sha256(fs.readFileSync(path.join(f.root, row.path)));
    f.delta.guards[0].sha256 = sha256(fs.readFileSync(path.join(f.root, POLICY)));
    write(f.root, CERT, f.cert(f.delta)); pin(f, CERT);
    const before = snapshot(f), prepared = api.prepareCurrentBindings(f.root, f.request);
    assert.ok(prepared.proposal.changes.every(row => !row.changed)); assert.deepEqual(snapshot(f), before);
    const applied = api.applyCurrentBindings(f.root, f.request, prepared.proposalSha256, { journalPath: f.journal() });
    assert.equal(applied.status, 'APPLIED_METADATA_ONLY'); assert.deepEqual(applied.completed, []); assert.deepEqual(snapshot(f), before);
  });
}
register().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });

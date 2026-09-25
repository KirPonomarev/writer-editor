const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const safe = require('../../src/utils/docxImportSafeCreate.js');
const { writeFlowSceneBatchAtomic } = require('../../src/utils/flowSceneBatchAtomic.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');

async function fixture(t, fault = '', doc = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-import-tx-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const projectRoot = path.join(root, 'project'), romanRoot = path.join(projectRoot, 'roman');
  fs.mkdirSync(romanRoot, { recursive: true });
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const manifest = { projectId: 'word-import-tx', treeIdentity: { schemaVersion: 1, nodes: {} }, lastCommandId: 0 };
  const originalManifest = JSON.stringify(manifest);
  fs.writeFileSync(manifestPath, originalManifest);
  const imp = p => import(pathToFileURL(path.join(ROOT, p)));
  const [bridge, docxPageSetupBindModule, semanticMappingModule, styleMapModule, authorityModule] = await Promise.all([
    imp('src/io/revisionBridge/index.mjs'), imp('src/docxPageSetupBind.mjs'), imp('src/derived/semanticMapping.mjs'),
    imp('src/derived/styleMap.mjs'), imp('src/product/mainProjectManifestAuthority.mjs'),
  ]);
  const bytes = await buildDocxMinBuffer({ doc: doc || { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Owned import 🧭' }] }] }, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(bytes));
  assert.equal(plan.ok, true);
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const real = authorityModule.createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'anchors'), useLeaseHeartbeatWorker: false });
  let enabled = true, commitCalls = 0, context = 1;
  const authority = { ...real, commitManifestText: async args => {
    commitCalls++;
    if (enabled && fault === 'manifest') throw Error('DOCX_AUDIT_MANIFEST_REJECTED');
    const result = await real.commitManifestText(args);
    if (enabled && fault === 'after-manifest') throw Error('DOCX_AUDIT_AFTER_MANIFEST');
    return result;
  } };
  const sandbox = {
    captureDocxImportPreviewContext: () => context,
    cloneJsonSafe: x => JSON.parse(JSON.stringify(x)),
    isPlainObjectValue: x => !!x && typeof x === 'object' && !Array.isArray(x),
    isDocxImportPreviewPlanAdmitted: safe.isDocxImportPreviewPlanAdmitted,
    applyDocxImportSafeCreate: safe.applyDocxImportSafeCreate,
    ensureProjectStructure: async () => {}, getProjectSectionPath: () => romanRoot,
    getProjectRootPath: () => projectRoot,
    resolveProjectBindingForFile: async () => ({ projectId: manifest.projectId, manifestPath, manifestRaw: fs.readFileSync(manifestPath, 'utf8') }),
    queueDiskOperation: async op => { if (enabled && fault === 'context') context++; return op(); }, writeFlowSceneBatchAtomic,
    getMainProjectManifestAuthority: async () => {
      if (enabled && fault === 'authority') throw Error('DOCX_AUDIT_AUTHORITY_UNAVAILABLE');
      return authority;
    }, module: { exports: {} }, exports: {},
  };
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const section = src.slice(src.indexOf('// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START'), src.indexOf('// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END'));
  vm.runInNewContext(section + '\nmodule.exports = handleDocxImportSafeCreateCommandSurface;', sandbox);
  const call = (requestId = 'owned-request') => sandbox.module.exports({ requestId, docxImportPreviewPlan: plan });
  const scenes = () => fs.readdirSync(romanRoot, { recursive: true }).filter(p => p.endsWith('.txt'));
  return { root, projectRoot, romanRoot, manifestPath, originalManifest, plan, bytes, authority, call, scenes, recover: () => { enabled = false; }, commits: () => commitCalls };
}

test('Word W1: authority failure rejects before canonical publication', async t => {
  const f = await fixture(t, 'authority');
  const result = await f.call();
  assert.equal(result.ok, false, 'missing authority must never return algorithmic success');
  assert.deepEqual(f.scenes(), []);
  assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), f.originalManifest);
  assert.equal(f.commits(), 0);
});

test('Word W1: manifest failure recovers and the same request can complete exactly once', async t => {
  const f = await fixture(t, 'manifest');
  assert.equal((await f.call()).ok, false);
  f.recover();
  const retried = await f.call();
  assert.equal(retried.ok, true, JSON.stringify(retried));
  assert.equal(f.scenes().length, 1);
  assert.equal((await f.call()).idempotent, true);
  assert.equal(f.scenes().length, 1);
});

test('Word W1: receipt ENOSPC remains recoverable with the same request', async t => {
  const f = await fixture(t);
  const originalOpen = fsp.open;
  fsp.open = async function (target, ...args) {
    if (String(target).startsWith(f.projectRoot) && String(target).includes(`${path.sep}receipts${path.sep}`)) {
      const e = Error('DOCX_AUDIT_ENOSPC'); e.code = 'ENOSPC'; throw e;
    }
    return originalOpen.call(this, target, ...args);
  };
  let first;
  try { first = await f.call(); } finally { fsp.open = originalOpen; }
  assert.equal(first.ok, false);
  const retry = await f.call();
  assert.equal(retry.ok, true, JSON.stringify(retry));
  assert.equal(f.scenes().length, 1);
  assert.equal((await f.call()).idempotent, true);
});

test('Word W1: healthy import and replay preserve one durable scene and identity', async t => {
  const f = await fixture(t);
  const first = await f.call();
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.receipt.manifestAuthority.durablePublication, true);
  assert.equal(f.scenes().length, 1);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(f.manifestPath, 'utf8')).treeIdentity.nodes).length, 1);
  const count = f.commits(), second = await f.call();
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.idempotent, true);
  assert.equal(f.commits(), count);
});

for (const fault of ['after-manifest', 'context']) {
  test(`Word W1: ${fault} cannot ACK partial/stale state and allows a safe retry`, async t => {
    const f = await fixture(t, fault);
    assert.equal((await f.call()).ok, false);
    assert.equal(f.scenes().length, 0);
    if (fault === 'context') assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), f.originalManifest);
    f.recover();
    assert.equal((await f.call()).ok, true);
    assert.equal((await f.call()).idempotent, true);
    assert.equal(f.scenes().length, 1);
  });
}
for (const method of ['writeFile', 'sync', 'link']) {
  test(`Word W1: receipt ${method} failure remains retryable without duplicate publication`, async t => {
    const f = await fixture(t), originalOpen = fsp.open, originalLink = fsp.link;
    const isReceipt = p => String(p).startsWith(f.projectRoot) && String(p).includes(`${path.sep}receipts${path.sep}`);
    const fail = () => { const error = Error('DOCX_RECEIPT_IO_FAILED'); error.code = 'ENOSPC'; throw error; };
    if (method === 'link') fsp.link = async (a, b) => isReceipt(b) ? fail() : originalLink(a, b);
    else fsp.open = async (p, ...args) => {
      const handle = await originalOpen(p, ...args);
      if (!isReceipt(p) || args[0] === 'r') return handle;
      return new Proxy(handle, { get(target, key) {
        if (key === method) return fail;
        return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
      } });
    };
    let first;
    try { first = await f.call(); } finally { fsp.open = originalOpen; fsp.link = originalLink; }
    assert.equal(first.ok, false);
    assert.equal(f.commits(), 0, 'receipt preparation failure must precede manifest publication');
    assert.equal((await f.call()).ok, true);
    assert.equal((await f.call()).idempotent, true);
    assert.equal(f.scenes().length, 1);
  });
}

test('Word W1: failed cleanup retains intent and replay confirms the same committed operation', async t => {
  const f = await fixture(t), unlink = fsp.unlink;
  const journal = `${f.manifestPath}.wp201-transaction.json`;
  fsp.unlink = async p => { if (p === journal) throw Object.assign(Error('cleanup'), { code: 'EIO' }); return unlink(p); };
  let first;
  try { first = await f.call(); } finally { fsp.unlink = unlink; }
  assert.equal(first.ok, false);
  assert.equal(fs.existsSync(journal), true);
  const count = f.commits(), retry = await f.call();
  assert.equal(retry.ok, true, JSON.stringify(retry));
  assert.equal(retry.idempotent, true);
  assert.equal(f.commits(), count);
  assert.equal(fs.existsSync(journal), false);
  assert.equal(f.scenes().length, 1);
});

test('Word W1: concurrent requests cannot duplicate an import or lose either distinct tree node', async t => {
  const f = await fixture(t);
  const results = await Promise.all([f.call(), f.call()]);
  assert.equal(results.filter(x => x.ok).length >= 1, true, JSON.stringify(results));
  assert.equal(f.scenes().length, 1);
  assert.equal((await f.call()).idempotent, true);
  const next = await f.call('second-owned-request');
  assert.equal(next.ok, true, JSON.stringify(next));
  assert.equal(f.scenes().length, 2);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(f.manifestPath)).treeIdentity.nodes).length, 2);
  assert.equal((await f.call()).idempotent, true, 'anchored manifest continuation preserves first receipt');
});

test('Word W1: revoked lease cannot publish canonical state', async t => {
  const f = await fixture(t), withLease = f.authority.withProjectLease;
  f.authority.withProjectLease = (id, operation) => withLease(id, async lease => {
    const fence = JSON.parse(fs.readFileSync(lease.paths.fence));
    fs.writeFileSync(lease.paths.fence, JSON.stringify({ ...fence, fencingGeneration: fence.fencingGeneration + 1 }));
    return operation(lease);
  });
  const result = await f.call();
  assert.equal(result.ok, false);
  assert.equal(f.commits(), 0);
  assert.equal(f.scenes().length, 0);
  assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), f.originalManifest);
});

test('Word W1: CRLF manifest bytes are bound exactly, while legacy receipts stay preserved and untrusted', async t => {
  const f = await fixture(t);
  fs.writeFileSync(f.manifestPath, JSON.stringify(JSON.parse(f.originalManifest), null, 2).replace(/\n/g, '\r\n'));
  const first = await f.call(); assert.equal(first.ok, true, JSON.stringify(first));
  const receiptPath = path.join(f.projectRoot, '.yalken/docx-import/receipts', `${first.receipt.importOperationId}.json`);
  const legacy = { ...first.receipt, schemaVersion: 'revision-bridge.docx-import-receipt.v2',
    manifestAuthority: { algorithmic: true, durablePublication: false } };
  fs.writeFileSync(receiptPath, JSON.stringify(legacy));
  const before = fs.readFileSync(receiptPath), count = f.commits();
  const replay = await f.call(); assert.equal(replay.ok, false);
  assert.equal(replay.error.code, 'DOCX_SAFE_CREATE_LEGACY_RECOVERY_REQUIRED');
  assert.deepEqual(fs.readFileSync(receiptPath), before);
  assert.equal(f.commits(), count);
  assert.equal(f.scenes().length, 1);
});

function ownedPng() {
  const { deflateSync } = require('node:zlib');
  const chunk = (tag, data) => {
    const body = Buffer.concat([Buffer.from(tag), data]); let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); body.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(1); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0,255,0,0,255]))), chunk('IEND', Buffer.alloc(0))]);
}
for (const shared of [false, true]) {
  test(`Word W1: ${shared ? 'shared' : 'new'} media survives manifest failure/retry with exact binary ownership`, async t => {
    const { createImageAttrs } = require('../../src/io/documentMedia.js');
    const image = ownedPng(), attrs = createImageAttrs(image, { alt: 'owned', displayName: 'owned.png' });
    const f = await fixture(t, 'after-manifest', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] });
    const asset = path.join(f.projectRoot, attrs.assetPath);
    if (shared) { fs.mkdirSync(path.dirname(asset), { recursive: true }); fs.writeFileSync(asset, image); }
    assert.equal((await f.call()).ok, false);
    f.recover();
    const result = await f.call(); assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(fs.readFileSync(asset), image);
    assert.equal((await f.call()).idempotent, true);
    const content = fs.readFileSync(path.join(f.romanRoot, f.scenes()[0]), 'utf8');
    const { parseObservablePayload } = await import('../../src/renderer/documentContentEnvelope.mjs');
    const stored = parseObservablePayload(content);
    assert.equal(stored.doc.content[0].content[0].attrs.sha256, attrs.sha256);
    fs.writeFileSync(asset, 'foreign bytes');
    assert.equal((await f.call()).ok, false);
    assert.equal(fs.readFileSync(asset, 'utf8'), 'foreign bytes');
  });
}

test('Word W1: fresh process regenerates admitted preview and replays actual main command from durable facts', async t => {
  const { spawnSync } = require('node:child_process');
  const f = await fixture(t), first = await f.call(); assert.equal(first.ok, true);
  const bytesPath = path.join(f.root, 'owned-source.docx'); fs.writeFileSync(bytesPath, f.bytes);
  const manifest = fs.readFileSync(f.manifestPath);
  const child = spawnSync(process.execPath, [path.join(__dirname, '../fixtures/word-import-replay-child.cjs'), f.root, bytesPath], { encoding: 'utf8', timeout: 15000 });
  assert.equal(child.status, 0, child.stderr);
  const replay = JSON.parse(child.stdout);
  assert.equal(replay.ok, true, child.stdout); assert.equal(replay.idempotent, true);
  assert.equal(replay.receipt.importOperationId, first.receipt.importOperationId);
  assert.deepEqual(fs.readFileSync(f.manifestPath), manifest);
  assert.equal(f.scenes().length, 1);
});

for (const targetKind of ['scene', 'receipt']) {
  test(`Word W1: foreign ${targetKind} wins exclusive-create race with equal bytes and is never adopted or removed`, async t => {
    const f = await fixture(t), link = fsp.link;
    let foreignPath, foreignInode;
    fsp.link = async (source, target) => {
      const match = targetKind === 'scene' ? String(target).endsWith('.txt') : String(target).includes('/receipts/');
      if (String(target).startsWith(f.projectRoot) && match) {
        fs.writeFileSync(target, fs.readFileSync(source), { flag: 'wx' });
        foreignPath = target; foreignInode = fs.statSync(target).ino;
      }
      return link(source, target);
    };
    let first;
    try { first = await f.call(); } finally { fsp.link = link; }
    assert.equal(first.ok, false); assert.ok(foreignPath);
    const bytes = fs.readFileSync(foreignPath), manifest = fs.readFileSync(f.manifestPath);
    const retry = await f.call(); assert.equal(retry.ok, false);
    assert.deepEqual(fs.readFileSync(foreignPath), bytes);
    assert.equal(fs.statSync(foreignPath).ino, foreignInode);
    assert.deepEqual(fs.readFileSync(f.manifestPath), manifest);
    assert.equal(fs.existsSync(`${f.manifestPath}.wp201-transaction.json`), true);
  });
}

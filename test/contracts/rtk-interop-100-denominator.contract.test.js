const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

test('fresh C1 uses fixed successor pins and preserves the archived three files', async () => {
  const fresh = await import('../../scripts/ops/rtk-interop-c1-fresh-evidence.mjs');
  const root = path.resolve(__dirname, '../..');
  const bytes = fs.readFileSync(path.join(root, fresh.C1_FRESH_PATH));
  const successor = fresh.readFreshC1Successor(bytes);
  assert.equal(successor.requiredCells, 1120);
  assert.equal(successor.maximumCurrentNumerator, 1);
  assert.equal(successor.historicalNumeratorDelta, 0);
  assert.equal(successor.cellId, successor.supersedesCellId);
  assert.equal(successor.broadPassClaim, false);
  for (const binding of successor.archivedFiles) {
    assert.equal(sha256File(path.join(root, binding.path)), binding.sha256);
  }
  for (const mutate of [s => { s.requiredCells = 1; }, s => { s.cellId = s.cellId.replace('C1', 'C2'); },
    s => { s.files.pop(); }, s => { s.review.reviewerIdentity = 'self'; }, s => { s.admittedPaths.push('src/main.js'); }]) {
    const changed = clone(successor); mutate(changed);
    assert.throws(() => fresh.readFreshC1Successor(Buffer.from(JSON.stringify(changed))), /C1_SUCCESSOR_PIN/);
  }
});

test('fresh C1 file boundary rejects coherent path and file attacks', async () => {
  const { readFreshC1File } = await import('../../scripts/ops/rtk-interop-c1-fresh-evidence.mjs');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'c1-file-boundary-')));
  try {
    fs.mkdirSync(path.join(root, 'raw'));
    const target = path.join(root, 'raw', 'text.txt');
    fs.writeFileSync(target, 'Café\n');
    const binding = { path: 'raw/text.txt', bytes: fs.statSync(target).size, sha256: sha256File(target) };
    assert.equal(readFreshC1File(root, binding).toString(), 'Café\n');
    fs.writeFileSync(target, 'Cafè\n');
    assert.throws(() => readFreshC1File(root, binding), /C1_PACKAGE_HASH/);
    fs.writeFileSync(target, 'Café\n');
    for (const relative of ['../text.txt', '/text.txt', 'raw/../raw/text.txt', 'raw//text.txt', 'raw\\text.txt']) {
      assert.throws(() => readFreshC1File(root, { ...binding, path: relative }), /C1_PACKAGE_PATH/);
    }
    assert.throws(() => readFreshC1File(root, { ...binding, bytes: 9 * 1024 * 1024 }), /C1_PACKAGE_SIZE/);
    assert.throws(() => readFreshC1File(root, { ...binding, path: 'missing' }), /ENOENT/);
    fs.symlinkSync('raw', path.join(root, 'alias'));
    assert.throws(() => readFreshC1File(root, { ...binding, path: 'alias/text.txt' }), /C1_PACKAGE_SYMLINK/);
    fs.symlinkSync('text.txt', path.join(root, 'raw', 'link'));
    assert.throws(() => readFreshC1File(root, { ...binding, path: 'raw/link' }), /C1_PACKAGE_SYMLINK/);
    fs.linkSync(target, path.join(root, 'hardlink'));
    assert.throws(() => readFreshC1File(root, binding), /C1_PACKAGE_FILE_KIND/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fresh mode rejects caller-supplied denominator and mixed legacy admission options', async () => {
  const validator = await loadValidator();
  for (const options of [
    { spec: validator.readInterop100Denominator() },
    { requireLocalPhysicalPackage: true },
    { requireExternalEvidencePackage: true },
  ]) {
    const report = validator.verifyInterop100(undefined, { freshC1EvidenceRoot: '/missing', ...options });
    expectInvalid(report, 'C1_FRESH_MODE_OPTIONS_CONFLICT');
    assert.equal(report.passedRequiredCells, 0);
    assert.equal(report.authoritativeAdmission, false);
  }
});

test('fresh C1 raw oracle rejects semantic mutations after coherent hash updates', () => {
  const oracle = path.resolve(__dirname, '../../scripts/ops/rtk-interop-c1-raw-readback.py');
  const program = String.raw`
import hashlib, importlib.util, io, json, pathlib, tempfile, zipfile
from xml.sax.saxutils import escape
spec = importlib.util.spec_from_file_location('c1raw', __import__('sys').argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
# This digest was independently computed from the physically reviewed literal
# twelve-paragraph fixture, not from the producer's expected/actual report.
assert m.digest(json.dumps(m.EXPECTED, ensure_ascii=False, separators=(',', ':')).encode()) == '693edfc41dd7963622bb9c5e6ea1a2766ea05245e8e390781e8c64988df278e1'
def archive(vector, extra=''):
    buf=io.BytesIO()
    xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    xml+=''.join('<w:p><w:r><w:t xml:space="preserve">'+escape(p)+'</w:t></w:r></w:p>' for p in vector)+extra+'</w:body></w:document>'
    with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z: z.writestr('word/document.xml',xml)
    return buf.getvalue()
def reject(fn, fragment):
    try: fn()
    except Exception as e:
        assert fragment in str(e), (fragment,str(e)); return
    raise AssertionError('mutant survived '+fragment)
m.paragraphs(m.docx_paragraphs(archive(m.EXPECTED)), 'CONTROL')
m.paragraphs(m.native_paragraphs(('\r'.join(m.EXPECTED)+'\r').encode()), 'CONTROL')
mutants=[
    [p.replace('Café','Cafè') for p in m.EXPECTED],
    m.EXPECTED[:1]+m.EXPECTED[2:],
    [m.EXPECTED[2],m.EXPECTED[1],m.EXPECTED[0],*m.EXPECTED[3:]],
    [p.strip() for p in m.EXPECTED],
    [p.replace('\u200d','') for p in m.EXPECTED],
]
with tempfile.TemporaryDirectory() as tmp:
    root=pathlib.Path(tmp).resolve()
    for vector in mutants:
        data=archive(vector); (root/'mutant.docx').write_bytes(data)
        coherent={'path':'mutant.docx','bytes':len(data),'sha256':m.digest(data)}
        reopened=m.checked_read(root,coherent)
        reject(lambda: m.paragraphs(m.docx_paragraphs(reopened),'DOCX'), 'DOCX_PARAGRAPHS')
        reject(lambda: m.paragraphs(m.native_paragraphs(('\r'.join(vector)+'\r').encode()),'NATIVE'), 'NATIVE_PARAGRAPHS')
reject(lambda:m.native_paragraphs(b'missing terminal'),'WORD_NATIVE_TERMINAL_CR')
for tag in ['br','tab','tbl','ins','del']:
    reject(lambda:m.docx_paragraphs(archive(m.EXPECTED,'<w:'+tag+'/>')),'DOCX_UNTESTED_STRUCTURE')
life={'runId':m.RUN,'process':{'status':0,'stdout':'WORD_STATUS=PASS\nDOCUMENTS_BEFORE=0\nDOCUMENTS_AFTER=0\nREVISION_COUNT=0\nCOMMENT_COUNT=0\nSCREENSHOT_STATUS=PASS\n'},'compileProcess':{'status':0},'cleanupOk':True}
m.lifecycle(life)
for old,new,key in [('DOCUMENTS_AFTER=0','DOCUMENTS_AFTER=1','DOCUMENTS_AFTER'),('DOCUMENTS_BEFORE=0\n','','DOCUMENTS_BEFORE'),('DOCUMENTS_AFTER=0','DOCUMENTS_AFTER=0\nDOCUMENTS_AFTER=0','DOCUMENTS_AFTER')]:
    mutant=json.loads(json.dumps(life));mutant['process']['stdout']=mutant['process']['stdout'].replace(old,new)
    reject(lambda:m.lifecycle(mutant),key)
report={'schemaVersion':'revision-bridge.docx-import-preview.loss-report.v1','mode':'plain-text-only','itemCount':1,'items':[{'code':'DOCX_IMPORT_PREVIEW_PLAIN_TEXT_ONLY','severity':'info','category':'formatting'}]}
m.loss(report)
report['items'][0]['code']='SILENT_TEXT_LOSS';reject(lambda:m.loss(report),'LOSS_UNACCOUNTED')
print(json.dumps({'positiveControls':4,'semanticMutantsKilled':20,'admissionCredit':0}))
`;
  const result = spawnSync('python3', ['-I', '-B', '-c', program, oracle], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { positiveControls: 4, semanticMutantsKilled: 20, admissionCredit: 0 });
});

const validatorPath = '../../scripts/ops/rtk-interop-100-denominator-v1.mjs';
const ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA = 'yalken.interop100.rootDurableCell001PackageAudit.v1';
const ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY = 'Preserves the physical and independent evidence basis for existing Cell001 only; numerator stays 1/1120.';
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA = 'yalken.interop100.rootDurableCell001PackageMutationAudit.v1';
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY = 'Mutants cover the durable Cell001 snapshot verifier only; they do not increase the portability numerator.';
const ROOT_DURABLE_PACKAGE_MUTATION_IDS = Object.freeze([
  'docx-byte-manifest-unchanged',
  'docx-byte-manifest-coherently-updated',
  'generation-ledger-manifest-coherently-updated',
  'receipt-seal-ledger-manifest-coherently-updated',
  'root-audit-manifest-coherently-updated',
  'manifested-file-replaced-by-symlink',
]);
const PRODUCER_MARKERS = Object.freeze(['CREATE_AND_VERIFY_EXECUTED', 'MUTATION_AUDIT_EXECUTED']);

async function loadValidator() {
  return import(validatorPath);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function runDenominatorCli(args, env = {}) {
  return spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts/ops/rtk-interop-100-denominator-v1.mjs'), ...args], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
}

function parseCliJson(result) {
  assert.equal(result.error, undefined);
  return JSON.parse(result.stdout);
}

function assertNoProducerMarkers(root) {
  for (const marker of PRODUCER_MARKERS) {
    assert.equal(fs.existsSync(path.join(root, marker)), false, marker);
  }
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function withGitDiffFixture(changedPaths, fn) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-promotion-'));
  try {
    git(repoRoot, ['init', '-q']);
    git(repoRoot, ['config', 'user.email', 'interop100@example.invalid']);
    git(repoRoot, ['config', 'user.name', 'Interop 100 Test']);
    fs.writeFileSync(path.join(repoRoot, 'base.txt'), 'base\n');
    git(repoRoot, ['add', 'base.txt']);
    git(repoRoot, ['commit', '-q', '-m', 'base']);
    const baseSha = git(repoRoot, ['rev-parse', 'HEAD']);

    for (const relativePath of changedPaths) {
      const absolutePath = path.join(repoRoot, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${relativePath}\n`);
    }
    git(repoRoot, ['add', '.']);
    git(repoRoot, ['commit', '-q', '-m', 'candidate']);
    const currentSha = git(repoRoot, ['rev-parse', 'HEAD']);

    return fn({ repoRoot, baseSha, currentSha });
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

function bindPassEntryToSourceRevision(ledger, envelope, sourceRevision, sourceTree) {
  ledger.entries[0].sourceRevision = sourceRevision;
  ledger.entries[0].exactHeadSha = sourceRevision;
  ledger.entries[0].sourceTree = sourceTree;
  for (const item of ledger.entries[0].providerEvidence || []) {
    item.exactHeadSha = sourceRevision;
  }
  if (ledger.entries[0].packagedBuildEvidence) {
    ledger.entries[0].packagedBuildEvidence.exactHeadSha = sourceRevision;
  }
  envelope.entries[0].sourceRevision = sourceRevision;
  envelope.entries[0].exactHeadSha = sourceRevision;
  envelope.entries[0].sourceTree = sourceTree;
  for (const item of envelope.entries[0].providerEvidence || []) {
    item.exactHeadSha = sourceRevision;
  }
  envelope.entries[0].canonicalPassEntrySha256 = sha256StableJson(ledger.entries[0]);
}

function expectInvalid(report, codeFragment) {
  assert.equal(report.ok, false);
  assert.ok(
    report.errors.some((error) => error.includes(codeFragment)),
    `expected ${codeFragment} in ${JSON.stringify(report.errors)}`,
  );
}

function validateWithEnvelope(validator, input) {
  return validator.validateInterop100({
    envelope: validator.readInterop100EvidenceEnvelope(),
    ...input,
  });
}

function fakeSha256(nibble = '1') {
  return `sha256:${String(nibble).repeat(64).slice(0, 64)}`;
}

function fakeCommit(nibble = '1') {
  return String(nibble).repeat(40).slice(0, 40);
}

function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

function sha256File(filePath) {
  return sha256Text(fs.readFileSync(filePath));
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]));
  }
  return value;
}

function stableJsonString(value) {
  return JSON.stringify(stableJsonValue(value));
}

function sha256StableJson(value) {
  return `sha256:${sha256Text(stableJsonString(value))}`;
}

function writeJsonFixture(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeHermeticExternalPackageAuditReport({ manifestSha256, verifierSha256 }) {
  return {
    checks: Array.from({ length: 100 }, (_, index) => ({
      actual: index === 0 ? ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA : null,
      expected: index === 0 ? ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA : null,
      name: `fixture.check.${String(index + 1).padStart(3, '0')}`,
      pass: true,
    })),
    checksFailed: 0,
    checksPassed: 100,
    claimBoundary: ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY,
    errors: [],
    manifestSha256,
    schemaVersion: ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA,
    status: 'PASS',
    verifierSha256,
  };
}

function makeHermeticExternalPackageMutationReport({ verifierSha256 }) {
  return {
    claimBoundary: ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY,
    killedCount: ROOT_DURABLE_PACKAGE_MUTATION_IDS.length,
    mutantCount: ROOT_DURABLE_PACKAGE_MUTATION_IDS.length,
    rows: ROOT_DURABLE_PACKAGE_MUTATION_IDS.map((id, index) => ({
      exitCode: 1,
      id,
      killed: true,
      stderrTail: [],
      stdoutTail: [JSON.stringify({
        checksFailed: 1,
        checksPassed: 99,
        manifestSha256: fakeSha256(String(index + 1)),
        reportSha256: fakeSha256(String(index + 2)),
        status: 'FAIL',
        verifierSha256,
      })],
    })),
    schemaVersion: ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA,
    status: 'PASS',
    survivors: [],
  };
}

function refreshHermeticExternalPackageEnvelope(repoRoot, envelopeEntry) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'MANIFEST.json'), 'utf8'));
  envelopeEntry.externalRehydrationPackage = {
    ...envelopeEntry.externalRehydrationPackage,
    packageId: path.basename(repoRoot),
    manifestSha256: `sha256:${sha256File(path.join(repoRoot, 'MANIFEST.json'))}`,
    verifierSha256: `sha256:${sha256File(path.join(repoRoot, 'create_and_verify.py'))}`,
    reportSha256: `sha256:${sha256File(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json'))}`,
    ledgerEntryRawSha256: `sha256:${sha256File(path.join(repoRoot, 'ledger-entry.json'))}`,
    mutationAuditorSha256: `sha256:${sha256File(path.join(repoRoot, 'mutation_audit.py'))}`,
    mutationReportSha256: `sha256:${sha256File(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json'))}`,
    fileCount: manifest.fileCount,
  };
}

function expectMutationRejected({ validator, spec, ledger, envelope, currentHeadSha, mutate, codeFragment }) {
  const mutatedLedger = clone(ledger);
  const mutatedEnvelope = clone(envelope);
  mutate(mutatedLedger, mutatedEnvelope);
  expectInvalid(validateWithEnvelope(validator, {
    spec: clone(spec),
    ledger: mutatedLedger,
    envelope: mutatedEnvelope,
    currentHead: currentHeadSha,
  }), codeFragment);
}

function writeHermeticExternalPackage(repoRoot, ledgerEntry, envelopeEntry) {
  const ledgerEntryJson = `${JSON.stringify(stableJsonValue(ledgerEntry), null, 2)}\n`;
  fs.writeFileSync(path.join(repoRoot, 'ledger-entry.json'), ledgerEntryJson);
  fs.writeFileSync(path.join(repoRoot, 'create_and_verify.py'), `#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIT_SCHEMA = '${ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA}'
CLAIM_BOUNDARY = '${ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY}'
MARKER = ROOT / 'CREATE_AND_VERIFY_EXECUTED'
MARKER.write_text('executed', encoding='utf-8')

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

report = json.loads((ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json').read_text(encoding='utf-8'))
errors = []
expected_names = [f'fixture.check.{index:03d}' for index in range(1, 101)]
checks = report.get('checks') if isinstance(report.get('checks'), list) else []
if report.get('schemaVersion') != AUDIT_SCHEMA:
    errors.append('schema')
if report.get('claimBoundary') != CLAIM_BOUNDARY:
    errors.append('claimBoundary')
if report.get('status') != 'PASS':
    errors.append('status')
if report.get('checksPassed') != 100 or report.get('checksFailed') != 0 or report.get('errors') != []:
    errors.append('counts')
if report.get('manifestSha256') != sha256(ROOT / 'MANIFEST.json'):
    errors.append('manifestSha256')
if report.get('verifierSha256') != sha256(Path(__file__).resolve()):
    errors.append('verifierSha256')
if [row.get('name') for row in checks] != expected_names:
    errors.append('checkNames')
for index, row in enumerate(checks):
    if row.get('pass') is not True:
        errors.append(f'checkPass:{index}')
    if index == 0:
        if row.get('actual') != AUDIT_SCHEMA or row.get('expected') != AUDIT_SCHEMA:
            errors.append('check0')
    elif row.get('actual') is not None or row.get('expected') is not None:
        errors.append(f'checkValue:{index}')
summary = {
    'status': 'PASS' if not errors else 'FAIL',
    'checksPassed': 100 - len(errors),
    'checksFailed': len(errors),
    'manifestSha256': sha256(ROOT / 'MANIFEST.json'),
    'verifierSha256': sha256(Path(__file__).resolve()),
    'reportSha256': sha256(ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json'),
}
print(json.dumps(summary, sort_keys=True))
sys.exit(0 if not errors else 1)
`);
  fs.writeFileSync(path.join(repoRoot, 'mutation_audit.py'), `#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MUTATION_SCHEMA = '${ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA}'
CLAIM_BOUNDARY = '${ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY}'
IDS = ${JSON.stringify(ROOT_DURABLE_PACKAGE_MUTATION_IDS)}
MARKER = ROOT / 'MUTATION_AUDIT_EXECUTED'
MARKER.write_text('executed', encoding='utf-8')

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def fake_sha(nibble):
    return 'sha256:' + (str(nibble) * 64)[:64]

report = json.loads((ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json').read_text(encoding='utf-8'))
verifier_sha = sha256(ROOT / 'create_and_verify.py')
errors = []
rows = report.get('rows') if isinstance(report.get('rows'), list) else []
if report.get('schemaVersion') != MUTATION_SCHEMA:
    errors.append('schema')
if report.get('claimBoundary') != CLAIM_BOUNDARY:
    errors.append('claimBoundary')
if report.get('status') != 'PASS' or report.get('mutantCount') != len(IDS) or report.get('killedCount') != len(IDS):
    errors.append('counts')
if report.get('survivors') != []:
    errors.append('survivors')
if [row.get('id') for row in rows] != IDS:
    errors.append('ids')
for index, row in enumerate(rows):
    if row.get('killed') is not True or row.get('exitCode') == 0:
        errors.append(f'rowKilled:{index}')
    tail = row.get('stdoutTail')
    if not isinstance(tail, list) or len(tail) != 1:
        errors.append(f'tailShape:{index}')
        continue
    try:
        summary = json.loads(tail[0])
    except Exception:
        errors.append(f'tailJson:{index}')
        continue
    if summary.get('status') != 'FAIL' or summary.get('checksFailed') != 1 or summary.get('checksPassed') != 99:
        errors.append(f'tailStatus:{index}')
    if summary.get('manifestSha256') != fake_sha(index + 1) or summary.get('reportSha256') != fake_sha(index + 2):
        errors.append(f'tailDigest:{index}')
    if summary.get('verifierSha256') != verifier_sha:
        errors.append(f'tailVerifier:{index}')
summary = {
    'status': 'PASS' if not errors else 'FAIL',
    'mutantCount': len(IDS),
    'killedCount': len(IDS) if not errors else max(0, len(IDS) - len(errors)),
    'reportSha256': sha256(ROOT / 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json'),
    'scriptSha256': sha256(Path(__file__).resolve()),
}
print(json.dumps(summary, sort_keys=True))
sys.exit(0 if not errors else 1)
`);
  const manifest = {
    schemaVersion: envelopeEntry.externalRehydrationPackage.schemaVersion,
    cellId: ledgerEntry.cellId,
    sourceExecutionHead: ledgerEntry.sourceRevision,
    sourceExecutionTree: ledgerEntry.sourceTree,
    fileCount: 1,
    files: [{
      path: 'ledger-entry.json',
      sha256: sha256Text(ledgerEntryJson),
      size: Buffer.byteLength(ledgerEntryJson),
    }],
  };
  writeJsonFixture(path.join(repoRoot, 'MANIFEST.json'), manifest);
  writeJsonFixture(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json'), makeHermeticExternalPackageAuditReport({
    manifestSha256: sha256File(path.join(repoRoot, 'MANIFEST.json')),
    verifierSha256: sha256File(path.join(repoRoot, 'create_and_verify.py')),
  }));
  writeJsonFixture(path.join(repoRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json'), makeHermeticExternalPackageMutationReport({
    verifierSha256: sha256File(path.join(repoRoot, 'create_and_verify.py')),
  }));
  refreshHermeticExternalPackageEnvelope(repoRoot, envelopeEntry);
}

test('interop 100 denominator preserves the archived 1120-cell baseline at the exact Cell001 evidence source revision', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const report = validateWithEnvelope(validator, {
    spec,
    ledger,
    currentHead: ledger.entries[0].sourceRevision,
  });

  assert.equal(report.ok, true);
  assert.equal(report.requiredCells, 1120);
  assert.equal(report.recordedCells, 1);
  assert.equal(report.passedRequiredCells, 0);
  assert.equal(report.diagnosticPassedRequiredCells, 1);
  assert.equal(report.percentage, 0);
  assert.equal(report.diagnosticPercentage, 0.089286);
  assert.equal(report.statusCounts.NOT_EXECUTED, 1119);
  assert.equal(report.claimVerdict, 'AUTHORITATIVE_REHYDRATION_REQUIRED');
  assert.equal(spec.currentGap.exactHeadPassedNumerator, 1);
  assert.equal(spec.currentGap.percentage, 0.089286);
  assert.equal(ledger.declaredRollup.broadPassClaim, false);
  assert.equal(ledger.entries[0].cellId, 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME');
  assert.match(ledger.entries[0].sourceRevision, /^[0-9a-f]{40}$/);
  assert.match(ledger.entries[0].sourceTree, /^[0-9a-f]{40}$/);
  assert.equal(ledger.entries[0].outsideContractLedger.silentDropCount, 0);
  assert.deepEqual(ledger.entries[0].outsideContractLedger.dispositions, [
    'EXPLICIT_LOSS',
    'EXPLICIT_LOSS',
    'EXPLICIT_LOSS',
  ]);
  assert.equal(ledger.entries[0].evidenceReceipt.broadPassClaim, false);
});

test('Google local DOCX native import is route-qualified only through an internal uploaded-file reference', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const routePolicy = spec.providerTransportPolicy.googleLocalDocxToNativeImport;
  const evidence = ledger.routeQualificationEvidence[0];

  assert.equal(routePolicy.directLocalPathImport.supported, false);
  assert.equal(routePolicy.directLocalPathImport.countsAsPass, false);
  assert.equal(routePolicy.directLocalPathImport.typedBlocker, validator.GOOGLE_DOCX_IMPORT_TYPED_BLOCKER);
  assert.deepEqual(routePolicy.requiredSteps, Array.from(validator.GOOGLE_DOCX_IMPORT_TRANSPORT_STEPS));
  assert.equal(routePolicy.routeQualificationCountsAsCellPass, false);

  assert.equal(evidence.countedAsRequiredCellPass, false);
  assert.equal(evidence.directLocalPathImportNegative.status, 'BLOCKED');
  assert.equal(evidence.directLocalPathImportNegative.countsAsPass, false);
  assert.equal(evidence.supportedRoute.internalUploadedFileReferenceObserved, true);
  assert.equal(evidence.supportedRoute.nativeImportConverted, true);
  assert.equal(evidence.supportedRoute.nativeReadbackMarkerObserved, true);
  assert.equal(evidence.cleanup.createdGoogleFilesDeleted, true);
  assert.equal(evidence.cleanup.localRunSubdirectoryRemoved, true);
});

test('safe external hyperlink preview contour evidence is non-cell and leaves rich losses open', async () => {
  const validator = await loadValidator();
  const ledger = validator.readInterop100EvidenceLedger();
  const evidence = ledger.implementationContourEvidence.find((item) => (
    item.id === 'SAFE_EXTERNAL_HYPERLINK_CONTENT_PREVIEW_CONTOUR_20260909'
  ));

  assert.ok(evidence);
  assert.equal(evidence.countedAsRequiredCellPass, false);
  assert.equal(evidence.denominatorImpact.passedRequiredCellsAdded, 0);
  assert.equal(evidence.physicalBeforeFix.yalkenPreviewCode, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
  assert.equal(evidence.physicalBeforeFix.yalkenPreviewReason, 'STAGE02_EXTERNAL_RELATIONSHIP_PRESENT');
  assert.equal(evidence.physicalAfterFix.yalkenContentPreviewCode, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(evidence.physicalAfterFix.yalkenImportPreviewCode, 'DOCX_IMPORT_PREVIEW_READY');
  assert.equal(evidence.physicalAfterFix.writeEffects, false);
  assert.equal(evidence.physicalAfterFix.markerPreserved, true);
  assert.equal(evidence.providerRoute.structuredUploadedFileObjectRequired, true);
  assert.equal(evidence.cleanup.createdGoogleFilesDeleted, true);
  assert.equal(evidence.cleanup.localRunSubdirectoriesRemoved, true);
  assert.equal(evidence.residualLossLedger.some((item) => (
    item.field === 'IDENTIFIERS_ANCHORS'
    && item.code === 'GOOGLE_NATIVE_EXPORT_BOOKMARKS_DROPPED'
    && item.status === 'OPEN_NOT_COUNTED'
  )), true);
});

test('validator rejects attempts to count route qualification, direct local path import, or unsafe Word roots as denominator PASS', async () => {
  const validator = await loadValidator();
  const baseSpec = validator.readInterop100Denominator();
  const baseLedger = validator.readInterop100EvidenceLedger();
  const head = currentHead();

  {
    const spec = clone(baseSpec);
    spec.providerTransportPolicy.googleLocalDocxToNativeImport.directLocalPathImport.countsAsPass = true;
    expectInvalid(validateWithEnvelope(validator, { spec, ledger: clone(baseLedger), currentHead: head }), 'GOOGLE_DIRECT_LOCAL_PATH_IMPORT_MUST_NOT_COUNT');
  }

  {
    const spec = clone(baseSpec);
    spec.wordPhysicalRuntimePolicy.persistentRoot = '/tmp/yalken-word';
    expectInvalid(validateWithEnvelope(validator, { spec, ledger: clone(baseLedger), currentHead: head }), 'WORD_PHYSICAL_RUNTIME_ROOT_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].countedAsRequiredCellPass = true;
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_MUST_NOT_COUNT');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].cleanup.createdGoogleFilesDeleted = false;
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_CLEANUP_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].supportedRoute.requiredSteps = ['DIRECT_LOCAL_PATH_IMPORT_NEGATIVE'];
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'SUPPORTED_GOOGLE_IMPORT_ROUTE_INVALID');
  }

  {
    const ledger = clone(baseLedger);
    ledger.routeQualificationEvidence[0].exactHeadSha = '0000000000000000000000000000000000000000';
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'ROUTE_QUALIFICATION_BINDING_HEAD_MISMATCH');
  }

  {
    const ledger = clone(baseLedger);
    ledger.entries[0].exactHeadSha = '0000000000000000000000000000000000000000';
    ledger.entries[0].sourceRevision = head;
    expectInvalid(validateWithEnvelope(validator, { spec: clone(baseSpec), ledger, currentHead: head }), 'CELL_EXECUTION_SOURCE_HEAD_MISMATCH');
  }

  {
    const spec = clone(baseSpec);
    spec.currentGap.exactHeadPassedNumerator = 2;
    expectInvalid(validateWithEnvelope(validator, { spec, ledger: clone(baseLedger), currentHead: head }), 'CURRENT_GAP_ROLLUP_MISMATCH');
  }
});

test('validator rejects coordinated evidence admission forgeries before any numerator promotion', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = ledger.entries[0].sourceRevision;
  const baseline = validateWithEnvelope(validator, {
    spec: clone(spec),
    ledger: clone(ledger),
    envelope: clone(envelope),
    currentHead: head,
  });

  assert.equal(baseline.ok, true);
  assert.equal(baseline.passedRequiredCells, 0);
  assert.equal(baseline.diagnosticPassedRequiredCells, 1);

  const cases = [
    {
      name: 'CELL_ARTIFACT_UNKNOWN_HASH',
      codeFragment: 'EVIDENCE_ENVELOPE_ARTIFACTSHA256_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].artifactSha256 = fakeSha256('1');
        mutatedLedger.entries[0].evidenceReceipt.receiptSha256 = fakeSha256('1');
      },
    },
    {
      name: 'TARGET_REVISION_NON_HASH',
      codeFragment: 'TARGET_REVISION_SHA_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].targetRevision = 'not-a-sha';
      },
    },
    {
      name: 'TARGET_REVISION_LEDGER_ONLY',
      codeFragment: 'TARGET_REVISION_NOT_IN_HOP_GRAPH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].targetRevision = fakeSha256('2');
      },
    },
    {
      name: 'SOURCE_TREE_FORGED',
      codeFragment: 'SOURCE_TREE_BINDING_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].sourceTree = fakeCommit('3');
      },
    },
    {
      name: 'LOSS_LEDGER_FORGED',
      codeFragment: 'HOP_LOSS_LEDGER_ORACLE_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].oracles.LOSS.artifactSha256 = fakeSha256('4');
      },
    },
    {
      name: 'PROVENANCE_FORGED',
      codeFragment: 'HOP_PROVENANCE_ORACLE_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].oracles.PROVENANCE.artifactSha256 = fakeSha256('5');
      },
    },
    {
      name: 'GENERATION_ID_FORGED',
      codeFragment: 'EVIDENCE_RECEIPT_RUN_ID_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].generationId = 'forged-generation-id';
      },
    },
    {
      name: 'FAKE_WORD_BUILD',
      codeFragment: 'PROVIDER_BUILDIDENTITY_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].providerEvidence[0].buildIdentity = 'Microsoft Word 99.999 com.microsoft.Word FAKEFAKE';
      },
    },
    {
      name: 'PROVIDER_REVISION_NON_HASH',
      codeFragment: 'PROVIDER_REVISION_SHA_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].providerEvidence[0].revisionIdentity = 'not-a-provider-sha';
      },
    },
    {
      name: 'CYCLE_ROUND_ID_FORGED',
      codeFragment: 'CYCLE_ROUND_ID_INVALID',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].cycles[0].roundId = 'round-999';
      },
    },
    {
      name: 'SEMANTIC_ORACLE_ARBITRARY_AUTHORITY',
      codeFragment: 'ORACLE_AUTHORITY_UNBOUND:SEMANTIC',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].oracles.SEMANTIC.authority = 'SAME_EXECUTION_WRITER';
      },
    },
    {
      name: 'MANIFEST_ONLY_TARGET_TAMPER',
      codeFragment: 'EVIDENCE_ENVELOPE_TARGETREVISION_MISMATCH',
      mutate(_mutatedLedger, mutatedEnvelope) {
        mutatedEnvelope.entries[0].targetRevision = fakeSha256('6');
      },
    },
    {
      name: 'LEDGER_AND_MANIFEST_TARGET_TAMPER',
      codeFragment: 'TARGET_REVISION_NOT_IN_HOP_GRAPH',
      mutate(mutatedLedger, mutatedEnvelope) {
        mutatedLedger.entries[0].targetRevision = fakeSha256('7');
        mutatedEnvelope.entries[0].targetRevision = fakeSha256('7');
      },
    },
    {
      name: 'NONRECEIPT_ARTIFACT_GRAPH',
      codeFragment: 'EVIDENCE_RECEIPT_HASH_MISMATCH',
      mutate(mutatedLedger) {
        mutatedLedger.entries[0].artifactSha256 = fakeSha256('8');
      },
    },
  ];

  for (const item of cases) {
    assert.doesNotThrow(() => {
      expectMutationRejected({
        validator,
        spec,
        ledger,
        envelope,
        currentHeadSha: head,
        mutate: item.mutate,
        codeFragment: item.codeFragment,
      });
    }, item.name);
  }
});

test('strict external package mode rejects unknown package identity without producer execution', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-external-package-'));
  try {
    const externalEnvelope = clone(envelope);
    writeHermeticExternalPackage(packageRoot, ledger.entries[0], externalEnvelope.entries[0]);
    const baseline = validateWithEnvelope(validator, {
      spec: clone(spec),
      ledger: clone(ledger),
      envelope: clone(externalEnvelope),
      currentHead: head,
      requireExternalEvidencePackage: true,
      externalEvidencePackageRoot: packageRoot,
    });
    expectInvalid(baseline, 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH');
    assert.equal(fs.existsSync(path.join(packageRoot, 'CREATE_AND_VERIFY_EXECUTED')), false);
    assert.equal(fs.existsSync(path.join(packageRoot, 'MUTATION_AUDIT_EXECUTED')), false);
  } finally {
    fs.rmSync(packageRoot, { recursive: true, force: true });
  }
});

test('CLI external package root authority requires explicit root flag and ignores legacy env', () => {
  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-cli-legacy-root-'));
  const missingRootParent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-cli-missing-root-'));
  const missingRoot = path.join(missingRootParent, 'missing-package-root');
  const legacyEnv = {
    YALKEN_INTEROP_100_EXTERNAL_EVIDENCE_PACKAGE_ROOT: legacyRoot,
  };
  try {
    const diagnostic = runDenominatorCli([], legacyEnv);
    const diagnosticReport = parseCliJson(diagnostic);
    assert.equal(diagnostic.status, diagnosticReport.ok ? 0 : 1);
    assert.equal(diagnosticReport.authoritativeAdmission, false);
    assert.equal(diagnosticReport.passedRequiredCells, 0);
    if (diagnosticReport.ok) {
      assert.equal(diagnosticReport.diagnosticPassedRequiredCells, 1);
      assert.deepEqual(diagnosticReport.errors, []);
    } else {
      assert.equal(diagnosticReport.diagnosticPassedRequiredCells, 0);
      assert.equal(diagnosticReport.errors.length, 4);
      assert.equal(diagnosticReport.errors.filter((error) => (
        /^TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME:CELL_EXECUTION_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:/u.test(error)
      )).length, 1);
      assert.equal(diagnosticReport.errors.filter((error) => (
        /^TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME:PROVIDER_WORD_DESKTOP_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:/u.test(error)
      )).length, 1);
      assert.equal(diagnosticReport.errors.filter((error) => error === 'DECLARED_ROLLUP_MISMATCH').length, 1);
      assert.equal(diagnosticReport.errors.filter((error) => error === 'CURRENT_GAP_ROLLUP_MISMATCH').length, 1);
    }
    assert.doesNotMatch(`${diagnostic.stdout}\n${diagnostic.stderr}`, /EXTERNAL_EVIDENCE_PACKAGE_ROOT_/u);
    assertNoProducerMarkers(legacyRoot);

    const requiredWithoutArg = runDenominatorCli(['--require-external-evidence-package'], legacyEnv);
    const requiredOutput = `${requiredWithoutArg.stdout}\n${requiredWithoutArg.stderr}`;
    assert.notEqual(requiredWithoutArg.status, 0);
    assert.match(requiredOutput, /EXTERNAL_EVIDENCE_PACKAGE_ROOT_REQUIRED/u);
    assert.doesNotMatch(requiredOutput, /EXTERNAL_EVIDENCE_PACKAGE_ROOT_MISSING/u);
    assertNoProducerMarkers(legacyRoot);

    const explicitMissingRoot = runDenominatorCli([
      '--require-external-evidence-package',
      '--external-evidence-package-root',
      missingRoot,
    ], legacyEnv);
    const missingOutput = `${explicitMissingRoot.stdout}\n${explicitMissingRoot.stderr}`;
    assert.notEqual(explicitMissingRoot.status, 0);
    assert.match(missingOutput, /EXTERNAL_EVIDENCE_PACKAGE_ROOT_MISSING/u);
    assert.doesNotMatch(missingOutput, /EXTERNAL_EVIDENCE_PACKAGE_ROOT_REQUIRED/u);
    assertNoProducerMarkers(legacyRoot);
    assert.equal(fs.existsSync(missingRoot), false);
  } finally {
    fs.rmSync(legacyRoot, { recursive: true, force: true });
    fs.rmSync(missingRootParent, { recursive: true, force: true });
  }
});

test('strict external package mode rejects pinned hash mismatch without producer execution', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const packageParent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-external-package-parent-'));
  const packageRoot = path.join(packageParent, 'cell001-source-package-v1');
  fs.mkdirSync(packageRoot);
  try {
    const externalEnvelope = clone(envelope);
    writeHermeticExternalPackage(packageRoot, ledger.entries[0], externalEnvelope.entries[0]);
    const report = validateWithEnvelope(validator, {
      spec: clone(spec),
      ledger: clone(ledger),
      envelope: clone(externalEnvelope),
      currentHead: head,
      requireExternalEvidencePackage: true,
      externalEvidencePackageRoot: packageRoot,
    });
    expectInvalid(report, 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_FILE_MISMATCH:manifestSha256');
    assert.equal(fs.existsSync(path.join(packageRoot, 'CREATE_AND_VERIFY_EXECUTED')), false);
    assert.equal(fs.existsSync(path.join(packageRoot, 'MUTATION_AUDIT_EXECUTED')), false);
  } finally {
    fs.rmSync(packageParent, { recursive: true, force: true });
  }
});

test('strict external package mode rejects semantic package forgery fixtures without producer execution', async () => {
  const validator = await loadValidator();
  const spec = validator.readInterop100Denominator();
  const ledger = validator.readInterop100EvidenceLedger();
  const envelope = validator.readInterop100EvidenceEnvelope();
  const head = currentHead();
  const cases = [
    {
      name: 'FAILED_AUDIT_REPORT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_STATUS_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.status = 'FAIL';
        report.checksPassed = 99;
        report.checksFailed = 1;
        report.errors = ['coordinated audit report forgery'];
        report.checks[0].pass = false;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'INFLATED_AUDIT_CLAIM_BOUNDARY',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CLAIM_BOUNDARY_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.claimBoundary = 'Full portability certified.';
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'DUPLICATED_AUDIT_CHECK_NAME',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CHECK_NAMES_DUPLICATE',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.checks[1].name = report.checks[0].name;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'CONTRADICTORY_AUDIT_CHECK_ACTUAL',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.checks[0].actual = fakeCommit('f');
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'INVENTED_AUDIT_CHECK_DENOMINATOR',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.checks = Array.from({ length: 100 }, (_, index) => ({
          actual: false,
          expected: true,
          name: `invented-${index}`,
          pass: true,
        }));
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'FAILED_MUTATION_REPORT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_STATUS_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.status = 'FAIL';
        report.killedCount = 5;
        report.survivors = ['root-audit-manifest-coherently-updated'];
        report.rows[4].killed = false;
        report.rows[4].exitCode = 0;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'INFLATED_MUTATION_CLAIM_BOUNDARY',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_CLAIM_BOUNDARY_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.claimBoundary = 'Mutation audit proves every future package mutation is impossible.';
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'DUPLICATED_MUTATION_ROW_ID',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_IDS_DUPLICATE',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows[1].id = report.rows[0].id;
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'UNSUBSTANTIATED_MUTATION_ROW_KILLS',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows = report.rows.map((row) => ({
          ...row,
          stdoutTail: ['{"status":"FAIL"}'],
        }));
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'DELETED_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows[0].stdoutTail = [];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'MALFORMED_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows[0].stdoutTail = ['not-json'];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'FALSE_PASS_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const parsed = JSON.parse(report.rows[0].stdoutTail[0]);
        parsed.status = 'PASS';
        parsed.checksFailed = 0;
        report.rows[0].stdoutTail = [JSON.stringify(parsed)];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'ZERO_FAILURE_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const parsed = JSON.parse(report.rows[0].stdoutTail[0]);
        parsed.checksFailed = 0;
        parsed.checksPassed = 100;
        report.rows[0].stdoutTail = [JSON.stringify(parsed)];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'UNBOUND_VERIFIER_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const parsed = JSON.parse(report.rows[0].stdoutTail[0]);
        parsed.verifierSha256 = fakeSha256('a');
        report.rows[0].stdoutTail = [JSON.stringify(parsed)];
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'FABRICATED_VALID_MUTATION_ROW_STDOUT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        report.rows = report.rows.map((row) => ({
          ...row,
          exitCode: 1,
          stderrTail: [],
          stdoutTail: [JSON.stringify({
            checksFailed: 1,
            checksPassed: 99,
            manifestSha256: 'a'.repeat(64),
            reportSha256: 'b'.repeat(64),
            status: 'FAIL',
            verifierSha256: externalEnvelope.entries[0].externalRehydrationPackage.verifierSha256,
          })],
        }));
        writeJsonFixture(reportPath, report);
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
    {
      name: 'REPLACED_VERIFIER_SCRIPT',
      codeFragment: 'EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_VERIFIER_HASH_MISMATCH',
      mutate(packageRoot, externalEnvelope) {
        fs.writeFileSync(path.join(packageRoot, 'create_and_verify.py'), 'print("forged no-op verifier")\n');
        refreshHermeticExternalPackageEnvelope(packageRoot, externalEnvelope.entries[0]);
      },
    },
  ];

  for (const item of cases) {
    const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-external-package-'));
    try {
      const externalEnvelope = clone(envelope);
      writeHermeticExternalPackage(packageRoot, ledger.entries[0], externalEnvelope.entries[0]);
      item.mutate(packageRoot, externalEnvelope);
      const report = validateWithEnvelope(validator, {
        spec: clone(spec),
        ledger: clone(ledger),
        envelope: externalEnvelope,
        currentHead: head,
        requireExternalEvidencePackage: true,
        externalEvidencePackageRoot: packageRoot,
      });
      expectInvalid(report, 'EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH');
      assert.equal(fs.existsSync(path.join(packageRoot, 'CREATE_AND_VERIFY_EXECUTED')), false, item.name);
      assert.equal(fs.existsSync(path.join(packageRoot, 'MUTATION_AUDIT_EXECUTED')), false, item.name);
    } finally {
      fs.rmSync(packageRoot, { recursive: true, force: true });
    }
  }
});

test('validator admits only exact interop metadata carriers for descendant evidence promotion', async () => {
  const validator = await loadValidator();
  const baseSpec = validator.readInterop100Denominator();
  const baseLedger = validator.readInterop100EvidenceLedger();
  const baseEnvelope = validator.readInterop100EvidenceEnvelope();
  const allowedPostAuditCarrier = 'test/contracts/r24-post-audit-certification-set.contract.test.mjs';
  const adjacentPostAuditCarrier = 'test/contracts/r24-post-audit-corrections.contract.test.mjs';

  withGitDiffFixture([allowedPostAuditCarrier], ({ repoRoot, baseSha, currentSha }) => {
    const ledger = clone(baseLedger);
    const envelope = clone(baseEnvelope);
    bindPassEntryToSourceRevision(ledger, envelope, baseSha, git(repoRoot, ['rev-parse', `${baseSha}^{tree}`]));
    const report = validateWithEnvelope(validator, {
      spec: clone(baseSpec),
      envelope,
      ledger,
      currentHead: currentSha,
      repoRoot,
    });

    assert.equal(report.ok, true);
    assert.equal(report.passedRequiredCells, 0);
    assert.equal(report.diagnosticPassedRequiredCells, 1);
  });

  withGitDiffFixture([allowedPostAuditCarrier, adjacentPostAuditCarrier], ({ repoRoot, baseSha, currentSha }) => {
    const ledger = clone(baseLedger);
    const envelope = clone(baseEnvelope);
    bindPassEntryToSourceRevision(ledger, envelope, baseSha, git(repoRoot, ['rev-parse', `${baseSha}^{tree}`]));
    const report = validateWithEnvelope(validator, {
      spec: clone(baseSpec),
      envelope,
      ledger,
      currentHead: currentSha,
      repoRoot,
    });
    const joinedErrors = report.errors.join('\n');

    expectInvalid(report, `CELL_EXECUTION_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:${adjacentPostAuditCarrier}`);
    assert.match(joinedErrors, new RegExp(`PROVIDER_WORD_DESKTOP_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:${adjacentPostAuditCarrier}`));
    assert.equal(joinedErrors.includes(`OUTSIDE_ALLOWLIST:${allowedPostAuditCarrier}`), false);
  });
});

test('governance approval state rejects approval digest tampering for admission carriers', async () => {
  const { evaluateGovernanceApprovalState } = await import('../../scripts/ops/governance-approval-state.mjs');
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-interop100-approval-'));
  try {
    const approvalsPath = 'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json';
    const carrierPath = 'scripts/ops/rtk-interop-100-denominator-v1.mjs';
    fs.mkdirSync(path.join(repoRoot, path.dirname(approvalsPath)), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, path.dirname(carrierPath)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, carrierPath), 'approved bytes\n');
    fs.writeFileSync(path.join(repoRoot, approvalsPath), JSON.stringify({
      version: 'v1.0',
      approvals: [
        {
          approved: true,
          approvedAtUtc: '2026-09-12T00:00:00Z',
          approvedBy: 'owner-directive:R24_INTEROP100_APPROVAL_DIGEST_TAMPER_REGRESSION',
          authority: 'SUPERVISOR_DIRECTIVE_R24_INTEROP100_DENOMINATOR_ADMISSION_HARDENING_V2',
          filePath: carrierPath,
          rationale: 'Regression fixture approval for exact admission carrier bytes.',
          sha256: sha256Text('approved bytes\n'),
        },
      ],
    }, null, 2));

    const valid = evaluateGovernanceApprovalState({ repoRoot, approvalsPath });
    assert.equal(valid.ok, true);

    fs.writeFileSync(path.join(repoRoot, carrierPath), 'tampered bytes\n');
    const tampered = evaluateGovernanceApprovalState({ repoRoot, approvalsPath });
    assert.equal(tampered.ok, false);
    assert.equal(tampered.failDetail, 'APPROVAL_FILE_HASH_MISMATCH_0');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

// Bounded ORDER C1 recipe; every check is a root TAP record for the maintained parser.
{
const {test:rootTest}=require('node:test');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {createHash}=require('node:crypto'), {spawnSync}=require('node:child_process');
let ORDER_CELL,ORDER_POLICY_PATH,ORDER_POLICY_SHA256,ORDER_ADMITTED_PATHS,ORDER_BASE,ORDER_BASE_TREE,
    validateOrderRunId,selectOrderObservation,validateOrderAcceptance,stableOrderJson,readOrderFile,
    readOrderPolicy,verifyOrderPostEvaluation,verifyOrderC1,hashOrderObservation,verifyInterop100,run;
const ready=Promise.all([import('../../scripts/ops/rtk-interop-order-c1.mjs'),
  import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs')]).then(([order,denominator])=>{
  ({ORDER_CELL,ORDER_POLICY_PATH,ORDER_POLICY_SHA256,ORDER_ADMITTED_PATHS,ORDER_BASE,ORDER_BASE_TREE,
    validateOrderRunId,selectOrderObservation,validateOrderAcceptance,stableOrderJson,readOrderFile,
    readOrderPolicy,verifyOrderPostEvaluation,verifyOrderC1,hashOrderObservation}=order);
  verifyInterop100=denominator.verifyInterop100;
  run=ORDER_CELL+'__2026-09-16T00-00-00-000Z';
});
const test=(name,fn)=>rootTest(name,async()=>{await ready;return fn();});
const root=path.resolve(__dirname,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const policyBytes=()=>fs.readFileSync(path.join(root,ORDER_POLICY_PATH));

test('Lab observation hash retains locale ordering while review indexes remain ordinal',()=>{
  const vector={_z:4,a:1,A:2,'a-':3,nested:{z:5,Z:6,a2:7,a10:8}};
  const expected='eae9d418eba96b26893e9904e9c0305395521d8e495e513b1eadef1c20fbc09f';
  assert.equal(hashOrderObservation(vector),expected);
  assert.notEqual(hash(stableOrderJson(vector)),expected);
  assert.notEqual(hashOrderObservation({...vector,a:2,A:1}),expected);
});

test('retired policy can verify historical governance but cannot authorize current raw inspection',()=>{
  const bytes=require('node:child_process').execFileSync('git',['show',
    '8ddc4fca57a6f6f14afb81de83dd277f5750bfd2:'+ORDER_POLICY_PATH],{cwd:root});
  assert.throws(()=>readOrderPolicy(bytes),/POLICY_PIN/);
  assert.equal(readOrderPolicy(bytes,{allowLegacy:true}).cellId,ORDER_CELL);
  const old=verifyOrderPostEvaluation({candidateSha:'8ddc4fca57a6f6f14afb81de83dd277f5750bfd2'});
  assert.equal(old.status,'PASS');assert.equal(old.cellAcceptanceAuthority,false);
});

test('recipe pins source, denominator, seven oracles and six ORDER conditions',()=>{
  const p=readOrderPolicy(policyBytes());
  assert.equal(p.requiredOracles.length,7); assert.equal(p.requiredSubcases.length,6);
  assert.equal(p.rawCheckerSha256,hash(fs.readFileSync(path.join(root,'scripts/ops/rtk-interop-order-c1-readback.py'))));
  assert.equal(p.literalCheckerSha256,hash(fs.readFileSync(path.join(root,'scripts/ops/rtk-interop-c1-raw-readback.py'))));
  assert.throws(()=>readOrderPolicy(Buffer.from(JSON.stringify({...p,cellId:'TEXT'}))),/POLICY_PIN/);
});

test('exact run selection rejects traversal, unknown recipe, duplicate observation and latest fallback',()=>{
  assert.equal(validateOrderRunId(run),run);
  for(const bad of [undefined,'',run+'/../x',run+'\\x','TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME__x']) assert.throws(()=>validateOrderRunId(bad),/RUN_ID/);
  const row={type:'PHYSICAL_OBSERVATION',runId:run,cellId:ORDER_CELL};
  assert.equal(selectOrderObservation([row,{...row,runId:run+'later'}],run),row);
  assert.throws(()=>selectOrderObservation([row,row],run),/EXACT_OBSERVATION/);
  assert.throws(()=>selectOrderObservation([{...row,runId:run+'later'}],run),/EXACT_OBSERVATION/);
});

test('acceptance is bound to independently recomputed index, run and product identity',()=>{
  const review={runId:run,observationArtifactHash:'source',productHead:'a'.repeat(40),productTree:'b'.repeat(40)};
  const entry={type:'CELL_ACCEPTED',admissionMode:'MACHINE_RECIPE_REVIEW_V1',status:'PASS',cellId:ORDER_CELL,
    sourceRunId:run,sourceObservationHash:'source',productHead:review.productHead,productTree:review.productTree,
    policySha256:ORDER_POLICY_SHA256,reviewIndexSha256:hash(Buffer.from(stableOrderJson(review)+'\n'))};
  assert.equal(validateOrderAcceptance(entry,review),true);
  for(const key of ['admissionMode','cellId','sourceRunId','sourceObservationHash','productHead','productTree','policySha256','reviewIndexSha256'])
    assert.throws(()=>validateOrderAcceptance({...entry,[key]:'different'},review),/ACCEPTANCE_BINDING/);
  assert.throws(()=>validateOrderAcceptance(entry,{...review,observationArtifactHash:'rehash'}),/ACCEPTANCE_BINDING/);
});

test('evidence filesystem reader rejects links, special traversal, changed bounds and hard links',()=>{
  const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'order-reader-'));
  try {
    fs.writeFileSync(path.join(dir,'raw'),'raw');
    assert.equal(readOrderFile(dir,'raw').binding.sha256,hash('raw'));
    for(const p of ['../raw','/raw','a/../raw','raw\\x']) assert.throws(()=>readOrderFile(dir,p),/ORDER_PATH/);
    assert.throws(()=>readOrderFile(dir,'raw',2),/SIZE/);
    fs.symlinkSync('raw',path.join(dir,'link')); assert.throws(()=>readOrderFile(dir,'link'),/SYMLINK/);
    fs.linkSync(path.join(dir,'raw'),path.join(dir,'hard')); assert.throws(()=>readOrderFile(dir,'raw'),/FILE_KIND/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('official consumer rejects mixed modes and caller-authored denominators without physical credit',()=>{
  const result=verifyInterop100(root,{orderC1LabRoot:'/missing',orderRunId:run,freshC1EvidenceRoot:'/missing'});
  assert.equal(result.ok,false); assert.equal(result.passedRequiredCells,0); assert.equal(result.authoritativeAdmission,false);
  assert.ok(result.errors.includes('ORDER_MODE_OPTIONS_CONFLICT'));
  assert.equal(verifyOrderC1({requiredCells:Array(1120).fill({cellId:ORDER_CELL})}).passedRequiredCells,0);
});

test('governance admission is bounded to the delivery and never grants cell credit',()=>{
  const p=readOrderPolicy(policyBytes()), delivery='b'.repeat(40), candidate='c'.repeat(40);
  let changed=ORDER_ADMITTED_PATHS.slice(), drift=[];
  const git=args=>{
    if(args[0]==='rev-parse') return args[1]===ORDER_BASE+'^{tree}'?ORDER_BASE_TREE:candidate;
    if(args[0]==='ls-tree') return ORDER_POLICY_PATH;
    if(args[0]==='log') return delivery;
    if(args[0]==='merge-base') return '';
    if(args[0]==='diff') return (args[3]===ORDER_BASE?changed:drift).join('\n');
    if(args[0]==='show') return fs.readFileSync(path.join(root,args[1].slice(args[1].indexOf(':')+1)));
    throw Error('unexpected git');
  };
  const good=verifyOrderPostEvaluation({candidateSha:candidate,git});
  assert.equal(good.cellAcceptanceAuthority,false); assert.equal(good.programDone,false);
  changed.push('src/core/data-writer.js'); assert.throws(()=>verifyOrderPostEvaluation({git}),/UNADMITTED/); changed.pop();
  drift=['scripts/ops/rtk-interop-order-c1-readback.py']; assert.throws(()=>verifyOrderPostEvaluation({git}),/DRIFT/);
  assert.ok(p.protectedFiles.length>=6);
});

test('independent raw parser accepts equivalent runs and rejects semantic, XML and filesystem attacks',()=>{
  const code=String.raw`
import importlib.util, io, json, os, pathlib, tempfile, zipfile, xml.etree.ElementTree as ET
s=importlib.util.spec_from_file_location('order', 'scripts/ops/rtk-interop-order-c1-readback.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
def package(doc, extra=None):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        z.writestr('word/document.xml',doc)
        if extra: z.writestr(*extra)
    return out.getvalue()
def rejected(fn, reason):
    try: fn()
    except (ValueError,OSError,KeyError) as e:
        if reason: assert reason in str(e), (reason,str(e))
    else: raise AssertionError('mutant survived')
doc=ET.Element(m.W+'document'); body=ET.SubElement(doc,m.W+'body')
for value in m.EXPECTED:
    p=ET.SubElement(body,m.W+'p')
    for text in [value[:len(value)//2],value[len(value)//2:]]:
        ET.SubElement(ET.SubElement(p,m.W+'r'),m.W+'t').text=text
raw=package(ET.tostring(doc)); m.paragraphs(m.docx_paragraphs(raw),'POSITIVE')
c=m.semantic_controls(raw); assert len(c['orderMutantsExecuted'])==24 and len(c['rawMutantsExecuted'])==3
assert c==m.semantic_controls(raw), 'raw control hashes must be deterministic'
rejected(lambda:m.docx_paragraphs(package(b'<!DOCTYPE x [<!ENTITY y "x">]><x/>')),'DTD')
rejected(lambda:m.docx_paragraphs(package(ET.tostring(doc),('../outside','bad'))),'DOCX_PATH')
ET.SubElement(body[0],m.W+'hyperlink'); rejected(lambda:m.docx_paragraphs(package(ET.tostring(doc))),'UNKNOWN_PARAGRAPH'); body[0].remove(body[0][-1])
ET.SubElement(body[0][0],m.W+'tab'); rejected(lambda:m.docx_paragraphs(package(ET.tostring(doc))),'UNKNOWN_RUN'); body[0][0].remove(body[0][0][-1])
body[0],body[2]=body[2],body[0]
tampered=package(ET.tostring(doc)); assert m.digest(tampered)!=m.digest(raw)
rejected(lambda:m.paragraphs(m.docx_paragraphs(tampered),'COHERENT_REHASH'),'ORDER_OR_CONTENT')
with tempfile.TemporaryDirectory() as d:
    root=pathlib.Path(d).resolve(); (root/'raw').write_bytes(b'raw')
    b={'path':'raw','bytes':3,'sha256':m.digest(b'raw')}; assert m.checked_read(root,b)==b'raw'
    rejected(lambda:m.checked_read(root,{**b,'sha256':'0'*64}),'HASH')
    rejected(lambda:m.checked_read(root,{**b,'path':'../raw'}),'PATH')
    (root/'link').symlink_to('raw'); rejected(lambda:m.checked_read(root,{**b,'path':'link'}),None)
    os.link(root/'raw',root/'hard'); rejected(lambda:m.checked_read(root,b),'FILE_KIND')
print(json.dumps({'positiveEquivalentRuns':True,'coherentTamperRejected':True,'controls':c}))
`;
  const result=spawnSync('python3',['-I','-B','-c',code],{cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(JSON.parse(result.stdout).coherentTamperRejected,true);
});

}

// Register root TAP records: the maintained inventory intentionally counts roots.
{
const rootTest=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
let shared,denominator;
const ready=Promise.all([import('../../scripts/ops/rtk-interop-text-order-c1.mjs'),
  import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs')]).then(([s,d])=>{shared=s;denominator=d;});
const it=(name,fn)=>rootTest(name,async()=>{await ready;return fn();});
const fixtureSha='693edfc41dd7963622bb9c5e6ea1a2766ea05245e8e390781e8c64988df278e1';

function fieldFixture() {
  const common={review:{runId:'run',productHead:'a'.repeat(40),productTree:'b'.repeat(40),
    observationSha256:'c'.repeat(64),sourceDocxSha256:'d'.repeat(64),returnedDocxSha256:'e'.repeat(64),
    persistedSceneSha256:'f'.repeat(64),files:[{},{}]}};
  const r=common.review;
  const raw={ok:true,schemaVersion:'TEXT_C1_RAW_READBACK_V1',admissionCredit:0,
    cellId:shared.TEXT_CELL,sourceCellId:shared.SHARED_CELLS[1],runId:r.runId,
    productHead:r.productHead,productTree:r.productTree,observationSha256:r.observationSha256,
    fixtureParagraphSha256:fixtureSha,sourceDocxSha256:r.sourceDocxSha256,
    returnedDocxSha256:r.returnedDocxSha256,persistedSceneSha256:r.persistedSceneSha256,
    filesVerified:2,subcases:[...shared.TEXT_SUBCASES],
    controls:{positiveControls:['identity','split-xml-runs'],rawMutantsExecuted:shared.TEXT_CONTROL_IDS.map((id,i)=>({
      id,sha256:String(i).padStart(64,'0'),rejected:true,failure:id==='embedded-line-break'
        ?'TEXT_CONTROL_LINE_BREAK_POLICY':'TEXT_CONTROL_CODEPOINTS_OR_BOUNDARIES'}))},
    presence:{paragraphs:12,emptyParagraphOrdinals:[1,10],whitespaceEdgeOrdinals:[9],localeProfiles:7},
    stageParagraphSha256:Object.fromEntries(['source','export-docx','word-native','returned-docx',
      'source-renderer','import-renderer','persisted','reopened'].map(k=>[k,fixtureSha])),
    lineBreakPolicy:'NO_EMBEDDED_BREAKS;SOURCE_DOUBLE_LF;PERSISTED_SINGLE_LF;WORD_NATIVE_CR'};
  return {raw,common};
}

it('shared policy binds two exact fields and preserves the delivered single-field readers',()=>{
  const p=shared.readSharedPolicy(fs.readFileSync(path.join(root,shared.SHARED_POLICY_PATH)));
  assert.deepEqual(p.targetCellIds,shared.SHARED_CELLS);
  assert.equal(p.textControlIds.length,10);
  assert.equal(p.textRawCheckerSha256,shared.sharedHash(fs.readFileSync(path.join(root,'scripts/ops/rtk-interop-text-c1-readback.py'))));
  for(const binding of p.protectedFiles)
    assert.equal(shared.sharedHash(fs.readFileSync(path.join(root,binding.path))),binding.sha256,binding.path);
  assert.throws(()=>shared.readSharedPolicy(Buffer.from(JSON.stringify({...p,targetCellIds:[p.sourceCellId]}))),/POLICY_PIN/);
});

it('independent TEXT controls reject ten raw mutations and allow equivalent XML run boundaries',()=>{
  const code=[
    "import importlib.util,io,json,zipfile,xml.etree.ElementTree as ET",
    "s=importlib.util.spec_from_file_location('text','scripts/ops/rtk-interop-text-c1-readback.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)",
    "doc=ET.Element(m.order.W+'document');body=ET.SubElement(doc,m.order.W+'body')",
    "for value in m.EXPECTED:",
    " p=ET.SubElement(body,m.order.W+'p');ET.SubElement(ET.SubElement(p,m.order.W+'r'),m.order.W+'t').text=value",
    "out=io.BytesIO()",
    "with zipfile.ZipFile(out,'w') as z:z.writestr('word/document.xml',ET.tostring(doc))",
    "raw=out.getvalue();result=m.text_controls(raw)",
    "assert tuple(x['id'] for x in result['rawMutantsExecuted'])==m.CONTROL_IDS",
    "assert len(set(x['sha256'] for x in result['rawMutantsExecuted']))==10",
    "assert result==m.text_controls(raw)",
    "assert result['positiveControls']==['identity','split-xml-runs']",
    "print(json.dumps(result))",
  ].join('\n');
  const p=spawnSync('python3',['-I','-B','-c',code],{cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(p.status,0,p.stdout+p.stderr);
  assert.equal(JSON.parse(p.stdout).rawMutantsExecuted.length,10);
});

it('TEXT proof requires all raw stages, nonempty coverage and actually rejected distinct controls',()=>{
  const {raw,common}=fieldFixture();
  assert.equal(shared.validateTextRawResult(raw,common),true);
  const clone=()=>JSON.parse(JSON.stringify(raw));
  for(const key of ['cellId','sourceCellId','runId','productHead','productTree','observationSha256',
    'sourceDocxSha256','returnedDocxSha256','persistedSceneSha256'])
    assert.throws(()=>shared.validateTextRawResult({...raw,[key]:'other'},common),/RAW_BINDING/);
  let bad=clone();bad.controls.rawMutantsExecuted[0].rejected=false;
  assert.throws(()=>shared.validateTextRawResult(bad,common),/CONTROLS/);
  bad=clone();bad.controls.rawMutantsExecuted[1].sha256=bad.controls.rawMutantsExecuted[0].sha256;
  assert.throws(()=>shared.validateTextRawResult(bad,common),/CONTROLS/);
  bad=clone();delete bad.stageParagraphSha256['word-native'];
  assert.throws(()=>shared.validateTextRawResult(bad,common),/NONVACUOUS/);
  bad=clone();bad.presence.emptyParagraphOrdinals=[0,1];
  assert.throws(()=>shared.validateTextRawResult(bad,common),/NONVACUOUS/);
  bad=clone();bad.subcases.pop();
  assert.throws(()=>shared.validateTextRawResult(bad,common),/RAW_BINDING/);
});

it('two accepted fields require a complete pair and their own bound proof, never one duplicated cell',()=>{
  const review={runId:'run',productHead:'a'.repeat(40),productTree:'b'.repeat(40),
    observationArtifactHash:'source',fieldProofs:shared.SHARED_CELLS.map((cellId,i)=>({
      cellId,field:i?'ORDER':'TEXT',outcome:'PRESERVED'}))};
  const entries=review.fieldProofs.map(proof=>({type:'CELL_ACCEPTED',admissionMode:shared.SHARED_MODE,
    status:'PASS',cellId:proof.cellId,field:proof.field,sourceRunId:'run',sourceCellId:shared.SHARED_CELLS[1],
    sourceObservationHash:'source',productHead:review.productHead,productTree:review.productTree,
    policySha256:shared.SHARED_POLICY_SHA256,
    reviewIndexSha256:shared.sharedHash(Buffer.from(shared.stableSharedJson(review)+'\n')),
    fieldProofSha256:shared.sharedHash(Buffer.from(shared.stableSharedJson(proof)))}));
  assert.equal(shared.validateTextOrderAcceptances(entries,review),true);
  for(const bad of [[entries[0]],[entries[0],entries[0]],[...entries,entries[0]]])
    assert.throws(()=>shared.validateTextOrderAcceptances(bad,review),/DECISION_SET/);
  for(const key of ['field','sourceRunId','sourceCellId','sourceObservationHash','policySha256',
    'reviewIndexSha256','fieldProofSha256','productHead','productTree'])
    assert.throws(()=>shared.validateTextOrderAcceptances([{...entries[0],[key]:'other'},entries[1]],review),/FIELD_ACCEPTANCE/);
  assert.throws(()=>shared.validateTextOrderAcceptances(entries,{...review,runId:'later'}),/FIELD_ACCEPTANCE/);
});

it('shared official mode rejects mode conflicts, custom authority and duplicate denominator IDs',()=>{
  for(const conflict of [{orderC1LabRoot:'/missing'},{freshC1EvidenceRoot:'/missing'},
    {ledger:{}},{envelope:{}},{spec:denominator.readInterop100Denominator(root)}]) {
    const result=denominator.verifyInterop100(root,{textOrderC1LabRoot:'/missing',textOrderRunId:'run',...conflict});
    assert.equal(result.authoritativeAdmission,false);assert.equal(result.passedRequiredCells,0);
    assert.ok(result.errors.includes('TEXT_ORDER_MODE_OPTIONS_CONFLICT'));
  }
  const report=shared.verifyTextOrderC1({requiredCells:Array(1120).fill({cellId:shared.TEXT_CELL})});
  assert.equal(report.ok,false);assert.equal(report.passedRequiredCells,0);assert.equal(report.broadPassClaim,false);
});

it('shared governance admits only the delivered successor scope and gives no runtime credit',()=>{
  const delivery='b'.repeat(40),candidate='c'.repeat(40);
  let changed=[...shared.SHARED_ADMITTED_PATHS],drift=[];
  const git=args=>{
    if(args[0]==='rev-parse')return args[1]===shared.SHARED_BASE+'^{tree}'?shared.SHARED_BASE_TREE:candidate;
    if(args[0]==='ls-tree')return shared.SHARED_POLICY_PATH;
    if(args[0]==='log')return delivery;
    if(args[0]==='merge-base')return '';
    if(args[0]==='diff')return (args[3]===shared.SHARED_BASE?changed:drift).join('\n');
    if(args[0]==='show')return fs.readFileSync(path.join(root,args[1].slice(args[1].indexOf(':')+1)));
    throw Error('unexpected git');
  };
  const good=shared.verifyTextOrderPostEvaluation({git});
  assert.equal(good.status,'PASS');assert.equal(good.cellAcceptanceAuthority,false);assert.equal(good.programDone,false);
  assert.deepEqual(shared.verifyTextOrderPostEvaluation({git:args=>Buffer.from(git(args))}),good,
    'the repository certification gate returns raw Git Buffers');
  changed.push('src/core/unrelated.js');assert.throws(()=>shared.verifyTextOrderPostEvaluation({git}),/UNADMITTED/);changed.pop();
  drift=['scripts/ops/rtk-interop-text-c1-readback.py'];
  assert.throws(()=>shared.verifyTextOrderPostEvaluation({git}),/IMPLEMENTATION_DRIFT/);
});
}

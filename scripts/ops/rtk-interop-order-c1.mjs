import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

export const ORDER_CELL = 'ORDER__SINGLE_SCENE__C1__SOURCE_RUNTIME';
export const ORDER_POLICY_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_ORDER_C1_RECIPE_POLICY_V1.json';
export const ORDER_BASE = 'a453fdf2b258f420242c917f52674d422e60d135';
export const ORDER_BASE_TREE = '505d1ba84a7422839db530a19b5a54e8b65bf702';
export const ORDER_POLICY_SHA256 = 'd7ecbbb579d37de7be706c059760eb36e5f6acde8c48a5dd4f0b05cb9fe347d4';
export const ORDER_ADMITTED_PATHS = Object.freeze([
  'docs/tasks/2026-09-16--interop-order-fast-cycle.md', ORDER_POLICY_PATH,
  'scripts/ops/rtk-interop-order-c1.mjs', 'scripts/ops/rtk-interop-order-c1-readback.py',
  'scripts/ops/rtk-interop-100-denominator-v1.mjs', 'test/contracts/rtk-interop-100-denominator.contract.test.js',
  'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json',
]);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
const SPEC_SHA = '5a4bc6e1d3946028ca4fa71fba622727a29d65d5a1c0cf7e5a76126504ddad93';
const RAW_PATH = 'scripts/ops/rtk-interop-order-c1-readback.py';
const MAX_FILE = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const demand = (ok, code) => { if (!ok) throw new Error(code); };
const gitAt = root => args => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
export const stableOrderJson = value => JSON.stringify(value, (_key, v) => v && !Array.isArray(v) && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const same = (a, b) => stableOrderJson(a) === stableOrderJson(b);
const sha40 = value => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const sha64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

export function validateOrderRunId(runId) {
  demand(typeof runId === 'string' && new RegExp(`^${ORDER_CELL}__[A-Za-z0-9_-]{1,80}$`, 'u').test(runId), 'ORDER_RUN_ID');
  return runId;
}

export function readOrderFile(root, relative, max = MAX_FILE) {
  demand(path.isAbsolute(root) && fs.realpathSync(root) === root, 'ORDER_ROOT');
  demand(typeof relative === 'string' && !relative.includes('\\') && relative.split('/').every(s => s && s !== '.' && s !== '..'), 'ORDER_PATH');
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    demand(!fs.lstatSync(target).isSymbolicLink(), 'ORDER_SYMLINK');
  }
  demand(fs.realpathSync(target) === target, 'ORDER_CONTAINMENT');
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd);
    demand(before.isFile() && before.nlink === 1, 'ORDER_FILE_KIND');
    demand(before.size <= max, 'ORDER_FILE_SIZE');
    const buffer = Buffer.alloc(before.size + 1);
    let size = 0;
    while (size < buffer.length) { const n = fs.readSync(fd, buffer, size, buffer.length - size, null); if (!n) break; size += n; }
    const after = fs.fstatSync(fd);
    demand(size === before.size && before.ino === after.ino && before.dev === after.dev && before.size === after.size
      && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'ORDER_FILE_CHANGED');
    const bytes = buffer.subarray(0, size);
    return { bytes, binding: { path: relative, bytes: size, sha256: hash(bytes) } };
  } finally { fs.closeSync(fd); }
}

const LEGACY_ORDER_POLICY_SHA256 = '6a93f52c7575f7d7d3848b2841b1c9678ab9984f756bb002d7f06c0159cc2024';
export function readOrderPolicy(bytes, { allowLegacy = false } = {}) {
  demand(hash(bytes) === ORDER_POLICY_SHA256 || (allowLegacy && hash(bytes) === LEGACY_ORDER_POLICY_SHA256), 'ORDER_POLICY_PIN');
  const p = JSON.parse(bytes);
  demand(p.schemaVersion === 'YALKEN_ORDER_C1_RECIPE_POLICY_V1' && p.cellId === ORDER_CELL
    && p.productSpecSha256 === SPEC_SHA && p.baseSha === ORDER_BASE && p.baseTree === ORDER_BASE_TREE
    && same(p.admittedPaths, ORDER_ADMITTED_PATHS), 'ORDER_POLICY_SCOPE');
  return p;
}

export function verifyOrderPostEvaluation({ candidateSha = 'HEAD', git = gitAt(ROOT) } = {}) {
  const resolved = String(git(['rev-parse', candidateSha])).trim();
  demand(sha40(resolved), 'ORDER_GIT_HEAD');
  if (!String(git(['ls-tree', '--name-only', resolved, '--', ORDER_POLICY_PATH])).trim()) return { status: 'NOT_APPLICABLE', admittedPaths: [] };
  const policyBytes = git(['show', `${resolved}:${ORDER_POLICY_PATH}`]);
  const policy = readOrderPolicy(policyBytes, { allowLegacy: true });
  const revisions = String(git(['log', '--format=%H', resolved, '--', ORDER_POLICY_PATH])).trim().split('\n').filter(Boolean);
  demand(revisions.length > 0 && revisions.length <= 32, 'ORDER_DELIVERY_IDENTITY');
  // Freeze the first delivery of these exact policy bytes. An explicit reviewed
  // policy revision may repair a checker; subsequent drift under that policy may not.
  const deliveries = revisions.filter(sha => hash(git(['show', `${sha}:${ORDER_POLICY_PATH}`])) === hash(policyBytes));
  demand(deliveries.length > 0, 'ORDER_DELIVERY_IDENTITY');
  const delivery = deliveries.at(-1);
  git(['merge-base', '--is-ancestor', ORDER_BASE, delivery]);
  demand(String(git(['rev-parse', `${ORDER_BASE}^{tree}`])).trim() === ORDER_BASE_TREE, 'ORDER_BASE_TREE');
  const changed = String(git(['diff', '--name-only', '--no-renames', ORDER_BASE, delivery, '--'])).trim().split('\n').filter(Boolean);
  demand(changed.every(p => ORDER_ADMITTED_PATHS.includes(p)), 'ORDER_UNADMITTED_DELTA');
  for (const b of policy.protectedFiles) demand(hash(git(['show', `${resolved}:${b.path}`])) === b.sha256, 'ORDER_PROTECTED_FILE');
  const immutable = [ORDER_POLICY_PATH, RAW_PATH, 'scripts/ops/rtk-interop-order-c1.mjs', 'docs/tasks/2026-09-16--interop-order-fast-cycle.md'];
  const drift = new Set(String(git(['diff', '--name-only', '--no-renames', delivery, resolved, '--', ...ORDER_ADMITTED_PATHS])).trim().split('\n').filter(Boolean));
  demand(immutable.every(p => !drift.has(p)), 'ORDER_IMPLEMENTATION_DRIFT');
  return { status: 'PASS', deliverySha: delivery, admittedPaths: ORDER_ADMITTED_PATHS.filter(p => !drift.has(p)), cellAcceptanceAuthority: false, programDone: false };
}

function cleanIdentity(root) {
  const git = gitAt(root);
  demand(String(git(['status', '--porcelain=v1', '--untracked-files=all'])).trim() === '', 'ORDER_DIRTY_CHECKOUT');
  const [head, tree] = String(git(['rev-parse', 'HEAD', 'HEAD^{tree}'])).trim().split('\n');
  demand(sha40(head) && sha40(tree), 'ORDER_GIT_IDENTITY');
  return { head, tree };
}

function verifyLabSource(labRoot, runtimeHead, currentHead, policy) {
  const git = gitAt(labRoot);
  for (const revision of new Set([runtimeHead, currentHead])) {
    demand(sha40(revision), 'ORDER_LAB_IDENTITY');
    git(['merge-base', '--is-ancestor', policy.labBaseHead, revision]);
    const changed = String(git(['diff', '--name-only', '--no-renames', policy.labBaseHead, revision, '--'])).trim().split('\n').filter(Boolean);
    demand(changed.every(p => policy.allowedLabDeltaPaths.includes(p)), 'ORDER_LAB_RUNTIME_DRIFT');
    for (const b of policy.labCodeBindings) demand(hash(git(['show', `${revision}:${b.path}`])) === b.sha256, 'ORDER_LAB_CODE_PIN');
  }
}

export function selectOrderObservation(ledger, runId) {
  validateOrderRunId(runId);
  const rows = ledger.filter(x => x.type === 'PHYSICAL_OBSERVATION' && x.runId === runId);
  demand(rows.length === 1 && rows[0].cellId === ORDER_CELL, 'ORDER_EXACT_OBSERVATION');
  return rows[0];
}

export function validateOrderAcceptance(entry, review) {
  demand(entry?.type === 'CELL_ACCEPTED' && entry.admissionMode === 'MACHINE_RECIPE_REVIEW_V1'
    && entry.status === 'PASS' && entry.cellId === ORDER_CELL && entry.sourceRunId === review.runId
    && entry.sourceObservationHash === review.observationArtifactHash
    && entry.productHead === review.productHead && entry.productTree === review.productTree
    && entry.policySha256 === ORDER_POLICY_SHA256
    && entry.reviewIndexSha256 === hash(Buffer.from(stableOrderJson(review)+'\n')), 'ORDER_LAB_ACCEPTANCE_BINDING');
  return true;
}

// Lab v2 sorts object keys with its Node locale, whereas our review index uses
// ordinal order. Reproduce the qualified producer format only for its hash.
export function hashOrderObservation(value) {
  const encoded=JSON.stringify(value, (_key,v)=>v && !Array.isArray(v) && typeof v==='object'
    ? Object.fromEntries(Object.keys(v).sort((a,b)=>a.localeCompare(b,'en-US')).map(k=>[k,v[k]])) : v);
  return hash(Buffer.from(encoded));
}

// Read-only replay of the complete artifact path. It never admits a cell. The
// official wrapper separately requires the real clean current main and Lab source.
export function inspectOrderArtifacts({labRoot,runId,productHead,productTree}={}) {
  const started=performance.now();
  validateOrderRunId(runId);
  demand(sha40(productHead) && sha40(productTree), 'ORDER_REPLAY_IDENTITY');
  const identity={head:productHead,tree:productTree};
  const policy=readOrderPolicy(readOrderFile(ROOT,ORDER_POLICY_PATH).bytes);
  demand(hash(readOrderFile(ROOT,RAW_PATH).bytes)===policy.rawCheckerSha256, 'ORDER_RAW_CHECKER_PIN');
  demand(hash(readOrderFile(ROOT,'scripts/ops/rtk-interop-c1-raw-readback.py').bytes)===policy.literalCheckerSha256, 'ORDER_LITERAL_CHECKER_PIN');
  const ledgerBytes=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes;
  const ledger=ledgerBytes.toString('utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
  const observation=selectOrderObservation(ledger,runId);
  demand(observation.yalkenShadowHead===productHead && observation.yalkenShadowTree===productTree,'ORDER_REPLAY_RUNTIME');
  const prefix = `runs/${runId}/`;
  const obsFile = readOrderFile(labRoot, prefix+'observation.json');
  const obs = JSON.parse(obsFile.bytes);
  demand(obs.runId === runId && obs.cellId === ORDER_CELL && obs.artifactHash === observation.artifactHash, 'ORDER_OBSERVATION_FILE_BINDING');
  demand(['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'].every(k => obs[k] === observation[k]), 'ORDER_OBSERVATION_METADATA_BINDING');
  const withoutHash = { ...obs }; delete withoutHash.artifactHash;
  demand(obs.artifactHashScope === 'observation_without_artifactHash', 'ORDER_OBSERVATION_HASH_SCOPE');
  demand(hashOrderObservation(withoutHash) === obs.artifactHash, 'ORDER_OBSERVATION_HASH');
  const snapshotFile = readOrderFile(labRoot, prefix+'runtime-project-snapshot.json');
  const snapshot = JSON.parse(snapshotFile.bytes);
  const records = [...obs.artifacts, ...snapshot.files].map(({path:p,bytes,sha256}) => ({path:p,bytes,sha256}));
  records.push(obsFile.binding);
  demand(records.length <= 128 && new Set(records.map(b => b.path)).size === records.length, 'ORDER_INVENTORY_DUPLICATE');
  demand(records.every(b => b.path.startsWith(prefix) && Number.isSafeInteger(b.bytes) && b.bytes >= 0 && b.bytes <= MAX_FILE && sha64(b.sha256)), 'ORDER_INVENTORY_SCOPE');
  const total = records.reduce((n,b) => n+b.bytes,0); demand(total <= 64*1024*1024, 'ORDER_INVENTORY_BYTES');
  for (const b of records) { const file=readOrderFile(labRoot,b.path); demand(same(file.binding,b), 'ORDER_ARTIFACT_CHANGED'); }
  const result = spawnSync('python3', ['-I','-B',path.join(ROOT,RAW_PATH)], { shell:false, timeout:10000, maxBuffer:1024*1024, encoding:'utf8',
    input:JSON.stringify({root:labRoot,runId,productHead:identity.head,productTree:identity.tree,files:records,qualifiedProvider:policy.qualifiedProvider}) });
  demand(!result.error && result.status === 0, `ORDER_RAW_FAILED:${result.error?.code || result.stdout?.trim() || result.signal || result.status}`);
  const raw=JSON.parse(result.stdout);
  demand(raw.ok===true && raw.schemaVersion==='ORDER_C1_RAW_READBACK_V1' && raw.admissionCredit===0 && raw.runId===runId
    && raw.cellId===ORDER_CELL && raw.productHead===identity.head && raw.productTree===identity.tree && raw.filesVerified===records.length
    && same(raw.oracles,policy.requiredOracles) && same(raw.subcases,policy.requiredSubcases)
    && raw.controls.orderMutantsExecuted.length===24 && raw.controls.rawMutantsExecuted.length===3, 'ORDER_RAW_REPORT_BINDING');
  const review={schemaVersion:'ORDER_C1_MACHINE_REVIEW_INDEX_V1',reviewMode:'INDEPENDENT_RECIPE_ORACLE',cellId:ORDER_CELL,runId,
    policySha256:ORDER_POLICY_SHA256,productHead:identity.head,productTree:identity.tree,
    labRuntimeHead:observation.labHead,labRuntimeTree:observation.labTree,
    observationArtifactHash:observation.artifactHash,observationSha256:obsFile.binding.sha256,
    artifactSetSha256:hash(Buffer.from(stableOrderJson(records))),files:records,
    rawCheckerSha256:policy.rawCheckerSha256,semanticParagraphSha256:raw.semanticParagraphSha256,
    sourceDocxSha256:raw.sourceDocxSha256,returnedDocxSha256:raw.returnedDocxSha256,persistedSceneSha256:raw.persistedSceneSha256,
    requiredOracles:raw.oracles,subcases:raw.subcases,controls:raw.controls,productAdmissionCredit:0};
  for (const b of records) demand(same(readOrderFile(labRoot,b.path).binding,b), 'ORDER_ARTIFACT_CHANGED_DURING_READ');
  demand(readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerBytes), 'ORDER_LEDGER_CHANGED_DURING_READ');
  return {ok:true,admissionCredit:0,review,raw,ledger,observation,seconds:(performance.now()-started)/1000};
}

export function inspectOrderEvidence({ repoRoot = ROOT, labRoot, runId, currentHead } = {}) {
  const started = performance.now();
  demand(fs.realpathSync(repoRoot) === ROOT, 'ORDER_VERIFIER_CHECKOUT');
  validateOrderRunId(runId);
  const identity = cleanIdentity(repoRoot), git = gitAt(repoRoot);
  demand(String(git(['rev-parse', 'origin/main'])).trim() === identity.head, 'ORDER_CURRENT_MAIN_REQUIRED');
  demand(!currentHead || currentHead === identity.head, 'ORDER_ACTUAL_HEAD_MISMATCH');
  const policy = readOrderPolicy(readOrderFile(repoRoot, ORDER_POLICY_PATH).bytes);
  demand(hash(readOrderFile(repoRoot, SPEC_PATH).bytes) === SPEC_SHA, 'ORDER_SPEC_DRIFT');
  demand(hash(readOrderFile(repoRoot, RAW_PATH).bytes) === policy.rawCheckerSha256, 'ORDER_RAW_CHECKER_PIN');
  demand(hash(readOrderFile(repoRoot, 'scripts/ops/rtk-interop-c1-raw-readback.py').bytes) === policy.literalCheckerSha256, 'ORDER_LITERAL_CHECKER_PIN');
  const labIdentity = cleanIdentity(labRoot);
  const manifest = JSON.parse(readOrderFile(labRoot, 'LAB_MANIFEST.json').bytes);
  demand(fs.realpathSync(manifest.shadow.yalken.root) === repoRoot && manifest.shadow.yalken.head === identity.head
    && manifest.shadow.yalken.tree === identity.tree && manifest.shadow.yalken.readOnly === true, 'ORDER_SHADOW_BINDING');
  demand(hash(readOrderFile(labRoot, 'data/registry/frozen-denominator-registry-v2.json').bytes) === policy.labRegistrySha256, 'ORDER_LAB_REGISTRY');
  const facts=inspectOrderArtifacts({labRoot,runId,productHead:identity.head,productTree:identity.tree});
  const {ledger,observation}=facts;
  demand(!ledger.some(e => (e.runId === runId && (e.stale === true || ['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(e.type)))
    || (e.type === 'EVIDENCE_SUPERSEDES' && e.supersedesRunId === runId)
    || (e.type === 'AUDIT_INVALIDATED_PHYSICAL_OBSERVATION' && e.artifactHash === observation.artifactHash)), 'ORDER_INVALIDATED');
  verifyLabSource(labRoot, observation.labHead, labIdentity.head, policy);
  demand(String(gitAt(labRoot)(['rev-parse', observation.labHead+'^{tree}'])).trim() === observation.labTree, 'ORDER_LAB_RUNTIME_TREE');
  demand(observation.yalkenShadowHead === identity.head && observation.yalkenShadowTree === identity.tree, 'ORDER_STALE_RUNTIME');
  demand(Date.parse(observation.createdAt) >= Date.parse(policy.notBeforeUtc) && Date.parse(observation.createdAt) <= Date.now(), 'ORDER_OBSERVATION_TIME');
  demand(same(cleanIdentity(repoRoot),identity) && same(cleanIdentity(labRoot),labIdentity), 'ORDER_IDENTITY_CHANGED_DURING_READ');
  return {...facts,labIdentity,seconds:(performance.now()-started)/1000};
}

export function verifyOrderC1(options = {}) {
  const started=performance.now(); const errors=[...(options.specErrors||[])]; let result=null;
  try {
    demand(!errors.length && options.requiredCells?.length===1120
      && new Set(options.requiredCells.map(c=>c.cellId)).size===1120
      && options.requiredCells.some(c=>c.cellId===ORDER_CELL), 'ORDER_DENOMINATOR_INVALID');
    result=inspectOrderEvidence(options);
    const accepted=result.ledger.filter(e=>e.type==='CELL_ACCEPTED' && e.admissionMode==='MACHINE_RECIPE_REVIEW_V1'
      && e.sourceRunId===options.runId && e.cellId===ORDER_CELL);
    demand(accepted.length===1, 'ORDER_LAB_ACCEPTANCE_REQUIRED');
    validateOrderAcceptance(accepted[0],result.review);
    const index=readOrderFile(options.labRoot,`runs/${options.runId}/machine-review-index.json`).bytes;
    demand(index.equals(Buffer.from(stableOrderJson(result.review)+'\n')), 'ORDER_REVIEW_INDEX_BINDING');
  } catch(error) { errors.push(String(error.message)); }
  const ok=errors.length===0;
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:'ORDER_C1_RECIPE_V1',
    authoritativeAdmission:ok,requiredCells:1120,recordedCells:ok?1:0,passedRequiredCells:ok?1:0,
    acceptedCellIds:ok?[ORDER_CELL]:[],diagnosticPassedRequiredCells:0,percentage:ok?0.089286:0,
    statusCounts:{PASS:ok?1:0,NOT_EXECUTED:ok?1119:1120},broadPassClaim:false,
    claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_ORDER_C1_EVIDENCE',currentHead:result?.review.productHead||null,
    currentTree:result?.review.productTree||null,runId:options.runId,policySha256:ORDER_POLICY_SHA256,
    rawReadback:result?.raw||null,reviewIndexSha256:result?hash(Buffer.from(stableOrderJson(result.review)+'\n')):null,
    seconds:(performance.now()-started)/1000,limitations:['One ORDER fixture and Product.C1 source runtime only. Historical TEXT is not counted a second time.']};
}

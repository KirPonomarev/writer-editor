import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { R24_E_PLAN_PREDECESSOR_EXPECTATION, verifyEPlanPredecessorPostEvaluationException } from '../../scripts/ops/r24/corrective/post-audit-certification-set.mjs';
import { R24_F_SUBSTRATE_EXPECTATION, verifyFSubstratePostEvaluationException } from '../../scripts/ops/r24/corrective/post-audit-certification-set.mjs';
import { canonicalBytes } from '../../scripts/ops/r24/corrective/canonical-json.mjs';
import { PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION } from '../../scripts/ops/r24/corrective/pre00f-current-head-plan-delivery-reconciliation.mjs';
import { RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION } from '../../scripts/ops/r24/corrective/rcv00a-current-head-exact-toolchain-entrypoint.mjs';
import { RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION } from '../../scripts/ops/r24/corrective/rcv00b-current-head-effective-state-compiler.mjs';
import { verifyRuleset } from '../../scripts/ops/r24/corrective/post-audit-merge-gate.mjs';
import {
  AUDIT_CYCLE_1_DURABLE_EXPECTATION,
  AUDIT_CYCLE_2_ADMISSION_EXPECTATION,
  WP401_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP402_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP403_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP404_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP500_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP501_AUDIT_R2_COMPATIBILITY_ADMISSION_EXPECTATION,
  WP501_GATE_INTEGRATION_ADMISSION_EXPECTATION,
  WP501_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP501_PERFORMANCE_INTEGRATION_ADMISSION_EXPECTATION,
  WP501_INVENTORY_FINALIZATION_ADMISSION_EXPECTATION,
  WP501_TERMINAL_EXCEPTION_ADMISSION_EXPECTATION,
  WP502_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP503_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP503_V6_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP503_V7_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP503_V8_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP702_CI_MERGE_REF_TEST_BINDING_ADMISSION_EXPECTATION,
  WP702_PK0_SECURITY_SUCCESSOR_ADMISSION_EXPECTATION,
  WP702_WP504_HISTORICAL_SURFACE_ADMISSION_EXPECTATION,
  PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  PRE00B_LIFECYCLE_RECONCILIATION_DELIVERY_SHA,
  PRE00B_LIFECYCLE_RECONCILIATION_DELIVERY_TREE,
  PRE00C_NEXT_CONTOUR_SELECTION_DELIVERY_SHA,
  PRE00C_NEXT_CONTOUR_SELECTION_DELIVERY_TREE,
  PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION,
  PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_EXPECTATION,
  PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION,
  PRE00F_PLAN_DELIVERY_EXPECTATION,
  R24_RCV00A_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION,
  R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION,
  R24_RCV00B_SUCCESSOR_ADMISSION_REGISTRY_EXPECTATION,
  R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION,
  R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION,
  RCV00D_CURRENT_IDENTITY_BINDING_EXPECTATION,
  R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION,
  R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION,
  R24_INTEROP_100_SAFE_DOCX_HYPERLINK_PREVIEW_EXPECTATION,
  R24_INTEROP_100_U000C_PAGEBREAK_REEXPORT_EXPECTATION,
  R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION,
  R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,
  R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION,
  R24_EMBEDDED_FONT_ADMISSION_EXPECTATION,
  R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION,
  R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION,
  R24_X01_IDEMPOTENT_CONTRACT_RECOVERY_EXPECTATION,
  R24_CURRENT_CLOSURE_SELECTOR_EXPECTATION,
  verifyCurrentClosureSelectorPostEvaluationException,
  verifyDocxNotificationOutcomePostEvaluationException,
  verifyR24X01IdempotentContractRecoveryPostEvaluationException,
  R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION,
  R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION,
  R24_P03_RELATIONSHIP_GRAPH_VALIDATION_EXPECTATION,
  R24_PR1888_DOCX_IMPORT_CURRENT_MAIN_RECONCILIATION_PATHS,
  R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION,
  R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,
  R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION,
  createAuditCycle2DurableCarrier,
  createAuditCycleDurableCarrier,
  resolvePre00eRecoveryCiExternalConfirmationCandidateSha,
  verifyAuditCycle2DurableCarrier,
  verifyAuditCycle2PostEvaluationException,
  verifyAuditCycle2TerminalArtifact,
  verifyAuditCycleDurableCarrier,
  verifyAuditCycleTerminalArtifact,
  verifyCertificationSet,
  verifyWp401MainProductPostEvaluationException,
  verifyWp402MainProductPostEvaluationException,
  verifyWp403MainProductPostEvaluationException,
  verifyWp404MainProductPostEvaluationException,
  verifyWp500MainProductPostEvaluationException,
  verifyWp501AuditR2CompatibilityPostEvaluationException,
  verifyWp501GateIntegrationPostEvaluationException,
  verifyWp501MainProductPostEvaluationException,
  verifyWp501PerformanceIntegrationPostEvaluationException,
  verifyWp501InventoryFinalizationPostEvaluationException,
  verifyWp501FinalTerminalCarriers,
  verifyWp501TerminalExceptionPostEvaluationException,
  verifyWp502MainProductPostEvaluationException,
  verifyWp503MainProductPostEvaluationException,
  verifyPk1r1MainProductPostEvaluationException,
  verifyPre00bLifecycleReconciliationPostEvaluationException,
  verifyPre00cNextContourSelectionPostEvaluationException,
  verifyPre00cClosedStageCandidateVerifierRepairPostEvaluationException,
  verifyPre00dFreshSuccessorAdmissionLeaseHandoffPostEvaluationException,
  verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException,
  verifyPre00fPlanDeliveryPostEvaluationException,
  verifyR24Rcv00aExactToolchainEntryPointPostEvaluationException,
  verifyR24Rcv00bEffectiveStateCompilerPostEvaluationException,
  verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException,
  verifyR24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException,
  verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException,
  verifyRcv00dCurrentIdentityBindingPostEvaluationException,
  verifyR24DocxLinebreakSourceExportPostEvaluationException,
  verifyR24Interop100GoogleDocxImportRoutePostEvaluationException,
  verifyR24Interop100SafeDocxHyperlinkPreviewPostEvaluationException,
  verifyR24Interop100U000cPagebreakReexportPostEvaluationException,
  verifyR24ImportPreviewBookmarkMetadataExplicitLossPostEvaluationException,
  verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException,
  verifyR24ReviewPreviewCommentTopologyPostEvaluationException,
  verifyR24EmbeddedFontAdmissionPostEvaluationException,
  verifyR24O01O08SemanticOracleHardeningPostEvaluationException,
  verifyR24Rcv00eLeaseFencingCasPostEvaluationException,
  verifyR24Rcv00fDeliveryReconciliationPostEvaluationException,
  verifyR24P03RelationshipGraphValidationPostEvaluationException,
  verifyR24Ops03SemanticE0ClassifierPostEvaluationException,
  verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException,
  verifyR24W0CurrentStateClosurePostEvaluationException,
  verifyWp702CiMergeRefTestBindingPostEvaluationException,
  verifyWp702Pk0SecuritySuccessorPostEvaluationException,
  verifyWp702Wp504HistoricalSurfacePostEvaluationException,
} from '../../scripts/ops/r24/corrective/post-audit-certification-set.mjs';

const FILE='docs/OPS/R24/CORRECTIVE/POST_AUDIT_CURRENT_CERTIFICATION_SET_V2.json';
const OLD='docs/OPS/R24/CORRECTIVE/POST_AUDIT_CURRENT_CERTIFICATION_SET_V1.json';
const h=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
const load=()=>{const bytes=fs.readFileSync(FILE);return{value:JSON.parse(bytes),fileDigest:h(bytes)}};
const clone=(value)=>structuredClone(value);
const verify=(value,fileDigest=load().fileDigest)=>verifyCertificationSet({value,fileDigest,candidateSha:'HEAD',allowAuditCycle2Admission:true,allowMainProductWp401Admission:true});
const raw=(file)=>{const bytes=fs.readFileSync(file);return{bytes,value:JSON.parse(bytes),digest:h(bytes)}};
const objectFromCommit=(sha,repoPath)=>execFileSync('git',['show',`${sha}:${repoPath}`],{maxBuffer:64*1024*1024});

function rcv00dCurrentIdentityGitFixture({ changedPaths, baseTree, denyBase = false, denyRepair = false, successor = false } = {}) {
  const e = RCV00D_CURRENT_IDENTITY_BINDING_EXPECTATION;
  const candidateSha = 'a'.repeat(40), candidateTree = 'b'.repeat(40), successorSha = 'c'.repeat(40);
  const files = new Map();
  const put = (file, value) => files.set(file, canonicalBytes(value));
  const read = (file) => JSON.parse(files.get(file));
  const codePaths = [e.selectorPath, e.selectorTestPath, e.verifierPath, e.verifierTestPath].sort();
  for (const file of [e.selectorPath, e.selectorTestPath]) files.set(file, objectFromCommit(e.repairSha, file));
  for (const file of [e.verifierPath, e.verifierTestPath]) files.set(file, fs.readFileSync(file));
  files.set(e.historicalReceiptPath, objectFromCommit(e.baseSha, e.historicalReceiptPath));
  put(e.inventoryPath, JSON.parse(objectFromCommit(e.baseSha, e.inventoryPath)));
  put(e.approvalsPath, JSON.parse(objectFromCommit(e.baseSha, e.approvalsPath)));
  const primaryStatus = JSON.parse(objectFromCommit(e.repairSha, e.statusPath));
  const status = clone(primaryStatus);
  status.programDone = false;
  status.productionReleaseReady = false;
  status.certificationSuccessor = {
    repairSha: e.repairSha, repairTree: e.repairTree, admittedPaths: [...e.admittedPaths],
    evaluationIdentity: { headSha: e.repairSha, originMainSha: e.baseSha, treeSha: e.repairTree },
    predecessorGateFailure: primaryStatus.openDeliveryFinding,
  };
  delete status.openDeliveryFinding;
  put(e.statusPath, status);
  put(e.evidencePath, JSON.parse(objectFromCommit(e.repairSha, e.evidencePath)));
  const seal = () => {
    const inventory = read(e.inventoryPath);
    for (const file of [e.selectorTestPath, e.verifierTestPath]) inventory.entries.find((entry) => entry.path === file).sha256 = h(files.get(file));
    put(e.inventoryPath, inventory);
    const status = read(e.statusPath);
    status.implementationArtifacts = codePaths.map((file) => ({ path: file, sha256: h(files.get(file)) }));
    put(e.statusPath, status);
    const evidence = read(e.evidencePath);
    evidence.implementationArtifactDigests = codePaths.map((file) => ({
      ...(evidence.implementationArtifactDigests.find((entry) => entry.path === file) ?? { path: file, terms: ['CERTIFICATION_SUCCESSOR_CANDIDATE_BYTES_NOT_EXECUTION_PROOF'] }),
      sha256: h(files.get(file)),
    }));
    evidence.claimBindings = evidence.claimBindings.map((entry) => ({ ...entry, sha256: h(files.get(entry.filePath)) }));
    put(e.evidencePath, evidence);
    const approvals = read(e.approvalsPath);
    approvals.approvals = approvals.approvals.filter((entry) => entry.approvedBy !== e.approvedBy);
    for (const file of e.admittedPaths.filter((file) => file !== e.approvalsPath)) approvals.approvals.push({ filePath: file, sha256: h(files.get(file)), approvedBy: e.approvedBy, approved: true, evidenceStampIds: [e.stampId] });
    put(e.approvalsPath, approvals);
  };
  seal();
  const git = (args, options = {}) => {
    let result;
    if (args[0] === 'rev-parse') {
      const ref = args[1];
      if (ref === `${e.baseSha}^{tree}`) result = baseTree ?? e.baseTree;
      else if (ref === `${e.repairSha}^{tree}`) result = e.repairTree;
      else if (ref.endsWith('^{tree}')) result = candidateTree;
      else result = ref === 'HEAD' ? (successor ? successorSha : candidateSha) : ref;
    } else if (args[0] === 'merge-base') {
      if ((args[2] === e.baseSha && denyBase) || (args[2] === e.repairSha && denyRepair)) throw new Error('fixture ancestry denied');
      result = '';
    } else if (args[0] === 'diff') {
      result = (args[2] === `${e.baseSha}..${successorSha}` ? [...e.admittedPaths, 'README.md'].sort() : changedPaths ?? e.admittedPaths).join('\n');
    } else if (args[0] === 'rev-list') {
      result = successor ? candidateSha : '';
    } else if (args[0] === 'show') {
      const separator = args[1].indexOf(':'), sha = args[1].slice(0, separator), file = args[1].slice(separator + 1);
      if (sha === candidateSha || sha === successorSha) {
        if (!files.has(file)) throw new Error('fixture missing object');
        result = files.get(file);
      } else result = objectFromCommit(sha, file);
    } else throw new Error(`Unexpected fixture Git command: ${args.join(' ')}`);
    return options.encoding === 'utf8' ? String(result) : Buffer.from(result);
  };
  return { e, files, read, put, seal, git, candidateSha, candidateTree, requestedSha: successor ? successorSha : candidateSha };
}

const verifyCurrentIdentityFixture = (fixture) => verifyRcv00dCurrentIdentityBindingPostEvaluationException({ candidateSha: fixture.requestedSha, git: fixture.git });

test('RCV00D current-identity certification accepts only the exact eight-path successor bindings', () => {
  const fixture = rcv00dCurrentIdentityGitFixture(), result = verifyCurrentIdentityFixture(fixture);
  assert.equal(result.status, 'PASS');
  assert.equal(result.candidateSha, fixture.candidateSha);
  assert.equal(result.candidateTree, fixture.candidateTree);
  assert.equal(result.admittedPathDenominator, 8);
  assert.deepEqual(result.changedPaths, fixture.e.admittedPaths);
  assert.equal(result.programDone, false);
  assert.equal(result.graphIncrement, 0);
  assert.equal(fixture.read(fixture.e.statusPath).executedProof.focused.pass, 57);
  assert.equal(fixture.read(fixture.e.evidencePath).verdict, 'PASS');
  assert.equal(fixture.read(fixture.e.evidencePath).evidenceClass, 'CONTRACT');
  assert(!R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.admittedPaths.includes(fixture.e.statusPath));
  assert(!R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.admittedPaths.includes(fixture.e.evidencePath));
});

test('RCV00D current-identity certification selects a closed exact candidate without admitting later paths', () => {
  const fixture = rcv00dCurrentIdentityGitFixture({ successor: true }), result = verifyCurrentIdentityFixture(fixture);
  assert.equal(result.candidateSha, fixture.candidateSha);
  assert.equal(result.currentCandidateSha, fixture.requestedSha);
  assert.equal(result.changedPathDenominator, 8);
  assert(!result.admittedPaths.includes('README.md'));
});

for (const [name, options, signal] of [
  ['wrong base tree', { baseTree: '0'.repeat(40) }, /E_RCVID_BASE_TREE/],
  ['wrong base ancestry', { denyBase: true }, /E_RCVID_BASE_NOT_ANCESTOR/],
  ['missing repaired ancestry', { denyRepair: true }, /E_RCVID_REPAIR_NOT_ANCESTOR/],
  ['missing path', { changedPaths: RCV00D_CURRENT_IDENTITY_BINDING_EXPECTATION.admittedPaths.slice(1) }, /E_RCVID_EXACT_ADMITTED_DELTA/],
  ['extra path', { changedPaths: [...RCV00D_CURRENT_IDENTITY_BINDING_EXPECTATION.admittedPaths, 'README.md'] }, /E_RCVID_EXACT_ADMITTED_DELTA/],
]) {
  test(`RCV00D current-identity certification rejects ${name}`, () => assert.throws(() => verifyCurrentIdentityFixture(rcv00dCurrentIdentityGitFixture(options)), signal));
}

const currentIdentityMutations = [
  ['wrong status base despite resealing', (f) => { const v = f.read(f.e.statusPath); v.baseSha = '0'.repeat(40); f.put(f.e.statusPath, v); f.seal(); }, /E_RCVID_STATUS_BASE/],
  ['different-head evidence despite resealing', (f) => { const v = f.read(f.e.evidencePath); v.headSha = '9'.repeat(40); f.put(f.e.evidencePath, v); f.seal(); }, /E_RCVID_EVIDENCE_HEAD/],
  ['different-head status despite resealing', (f) => { const v = f.read(f.e.statusPath); v.evaluationIdentity.headSha = '9'.repeat(40); f.put(f.e.statusPath, v); f.seal(); }, /E_RCVID_STATUS_HEAD/],
  ['missing status scope despite resealing', (f) => { const v = f.read(f.e.statusPath); delete v.certificationSuccessor; f.put(f.e.statusPath, v); f.seal(); }, /E_RCVID_STATUS_SCOPE/],
  ['mutated repaired source despite coordinated resealing', (f) => { f.files.set(f.e.selectorPath, Buffer.concat([f.files.get(f.e.selectorPath), Buffer.from('// changed\n')])); f.seal(); }, /E_RCVID_REPAIRED_BYTES/],
  ['mutated repaired test despite coordinated resealing', (f) => { f.files.set(f.e.selectorTestPath, Buffer.concat([f.files.get(f.e.selectorTestPath), Buffer.from('// changed\n')])); f.seal(); }, /E_RCVID_REPAIRED_BYTES/],
  ['mutated support artifact', (f) => { f.files.set(f.e.verifierPath, Buffer.concat([f.files.get(f.e.verifierPath), Buffer.from('// changed\n')])); }, /E_RCVID_STATUS_ARTIFACT_BINDING/],
  ['wrong artifact hash', (f) => { const v = f.read(f.e.evidencePath); v.implementationArtifactDigests[0].sha256 = '0'.repeat(64); f.put(f.e.evidencePath, v); }, /E_RCVID_EVIDENCE_ARTIFACT_BINDING/],
  ['wrong claim hash', (f) => { const v = f.read(f.e.evidencePath); v.claimBindings[0].sha256 = '0'.repeat(64); f.put(f.e.evidencePath, v); }, /E_RCVID_CLAIM_DIGEST/],
  ['missing artifact', (f) => { f.files.delete(f.e.statusPath); }, /E_RCVID_ARTIFACT_MISSING/],
  ['unrelated inventory mutation despite resealing', (f) => { const v = f.read(f.e.inventoryPath); v.entries[0].sha256 = '0'.repeat(64); f.put(f.e.inventoryPath, v); f.seal(); }, /E_RCVID_INVENTORY_DELTA/],
  ['mutated approval hash', (f) => { const v = f.read(f.e.approvalsPath); v.approvals.find((entry) => entry.approvedBy === f.e.approvedBy).sha256 = '0'.repeat(64); f.put(f.e.approvalsPath, v); }, /E_RCVID_APPROVAL_BINDING/],
  ['revoked approval', (f) => { const v = f.read(f.e.approvalsPath); v.approvals.find((entry) => entry.approvedBy === f.e.approvedBy).approved = false; f.put(f.e.approvalsPath, v); }, /E_RCVID_APPROVAL_AUTHORITY/],
  ['changed prior approval despite resealing', (f) => { const v = f.read(f.e.approvalsPath); v.approvals[0].sha256 = '0'.repeat(64); f.put(f.e.approvalsPath, v); f.seal(); }, /E_RCVID_APPROVAL_HISTORY/],
  ['mixed historical snapshot', (f) => { const v = f.read(f.e.historicalReceiptPath); const old = JSON.parse(objectFromCommit('0b2476fc6ab881202ccc2c0087a57fea85a54195', f.e.historicalReceiptPath)); v.graphSchedulerCandidate.stateDigest = old.graphSchedulerCandidate.stateDigest; f.put(f.e.historicalReceiptPath, v); f.seal(); }, /E_RCVID_HISTORICAL_BYTES/],
];
for (const [name, mutate, signal] of currentIdentityMutations) {
  test(`RCV00D current-identity certification rejects ${name}`, () => {
    const fixture = rcv00dCurrentIdentityGitFixture();
    mutate(fixture);
    assert.throws(() => verifyCurrentIdentityFixture(fixture), signal);
  });
}

const currentIdentityClaimMutations = [
  ['status program done', 'statusPath', (v) => { v.programDone = true; }],
  ['status release ready', 'statusPath', (v) => { v.productionReleaseReady = true; }],
  ['status claim class escalated', 'statusPath', (v) => { v.claimClass = 'PROGRAM_DONE_RELEASE_READY'; }],
  ['status failed proof', 'statusPath', (v) => { v.executedProof = { focused: { pass: 0, fail: 57 } }; }],
  ['evidence failed verdict', 'evidencePath', (v) => { v.verdict = 'FAIL'; }],
  ['evidence narrative class', 'evidencePath', (v) => { v.evidenceClass = 'NARRATIVE'; }],
  ['evidence program done', 'evidencePath', (v) => { v.programDone = true; }],
  ['evidence nonClaims erased', 'evidencePath', (v) => { v.nonClaims = []; }],
  ['status nonClaims erased', 'statusPath', (v) => { v.nonClaims = []; }],
  ['evidence oracle forged', 'evidencePath', (v) => { v.oracle = 'SELF_AUTHORED_SUCCESS'; }],
  ['executed evidence forged', 'evidencePath', (v) => { for (const row of v.executedEvidence) row.verdict = 'FAIL'; }],
  ['proof summary inconsistent', 'statusPath', (v) => { v.executedProof.focused.pass -= 1; }],
];
for (const [name, key, mutate] of currentIdentityClaimMutations) {
  test(`RCV00D current-identity certification rejects coherently resealed ${name}`, () => {
    const fixture = rcv00dCurrentIdentityGitFixture();
    const value = fixture.read(fixture.e[key]);
    mutate(value);
    fixture.put(fixture.e[key], value);
    fixture.seal();
    assert.throws(() => verifyCurrentIdentityFixture(fixture), key === 'statusPath' ? /E_RCVID_STATUS_SEMANTICS/ : /E_RCVID_EVIDENCE_SEMANTICS/);
  });
}

test('RCV00D current-identity certification rejects a fabricated StageAdmission grant', () => {
  const fixture = rcv00dCurrentIdentityGitFixture();
  const status = fixture.read(fixture.e.statusPath);
  status.stageAdmissionAndLease = 'GRANTED';
  fixture.put(fixture.e.statusPath, status);
  fixture.seal();
  assert.throws(() => verifyCurrentIdentityFixture(fixture), /E_RCVID_AUTHORITY_ROUTE/);
});

const CRC_TABLE=new Uint32Array(256).map((_,i)=>{let v=i;for(let b=0;b<8;b+=1)v=(v&1)?(0xedb88320^(v>>>1)):(v>>>1);return v>>>0;});
const crc32=(bytes)=>{let v=0xffffffff;for(const byte of bytes)v=CRC_TABLE[(v^byte)&0xff]^(v>>>8);return(v^0xffffffff)>>>0;};
function zip(entries){const locals=[],centrals=[];let offset=0;for(const entry of entries){const name=Buffer.from(entry.name),bytes=Buffer.from(entry.bytes),crc=crc32(bytes);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);locals.push(local,name,bytes);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE((3<<8)|20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(bytes.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE((0o100644<<16)>>>0,38);central.writeUInt32LE(offset,42);centrals.push(central,name);offset+=local.length+name.length+bytes.length;}const centralBytes=Buffer.concat(centrals),eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(entries.length,8);eocd.writeUInt16LE(entries.length,10);eocd.writeUInt32LE(centralBytes.length,12);eocd.writeUInt32LE(offset,16);return Buffer.concat([...locals,centralBytes,eocd]);}
function rulesetEnvelope({currentUserCanBypass}={}){return{_links:{html:{href:'https://github.com/KirPonomarev/writer-editor/rules/12270444'},self:{href:'https://api.github.com/repos/KirPonomarev/writer-editor/rulesets/12270444'}},bypass_actors:[],conditions:{ref_name:{exclude:[],include:['~DEFAULT_BRANCH']}},created_at:'2026-01-29T21:32:32.106+02:00',...(currentUserCanBypass===undefined?{}:{current_user_can_bypass:currentUserCanBypass}),enforcement:'active',id:12270444,name:'protect-main',node_id:'RRS_lACqUmVwb3NpdG9yec5DfP9IzgC7O2w',rules:[{type:'deletion'},{type:'non_fast_forward'},{type:'pull_request',parameters:{allowed_merge_methods:['merge','squash','rebase'],dismiss_stale_reviews_on_push:true,require_code_owner_review:false,require_extra_approval_for_unattributed_changes:true,require_last_push_approval:false,required_approving_review_count:0,required_review_thread_resolution:true,required_reviewers:[]}},{type:'required_status_checks',parameters:{do_not_enforce_on_create:false,required_status_checks:[{context:'merge-gate',integration_id:15368}],strict_required_status_checks_policy:false}}],source:'KirPonomarev/writer-editor',source_type:'Repository',target:'branch',updated_at:'2026-08-31T04:53:57.083+03:00'};}
function durableFile(carrier){const bytes=canonicalBytes(carrier);return{bytes,digest:h(bytes),value:carrier};}
function durableExpectation(file){const carrier=file.value;return{carrierDigest:file.digest,schemaVersion:carrier.schemaVersion,provider:carrier.provenance.provider,repository:carrier.provenance.repository,workflowPath:carrier.provenance.workflowPath,runId:carrier.provenance.runId,runAttempt:carrier.provenance.runAttempt,headSha:carrier.provenance.headSha,artifactId:carrier.provenance.artifactId,artifactName:carrier.provenance.artifactName,memberPath:carrier.member.path,archiveSha256:carrier.archive.sha256,archiveSizeBytes:carrier.archive.sizeBytes,memberSha256:carrier.member.sha256,memberSizeBytes:carrier.member.sizeBytes};}

function terminalFixture(mutator=()=>{}){
  const authorityFile=raw('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CORRECTIONS_OWNER_AMENDMENT_V15.json'),instanceFile=raw('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CORRECTIONS_STAGE_INSTANCE_V16.json'),admissionFile=raw('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CORRECTIONS_STAGE_ADMISSION_ATTESTATION_V16.json'),beforeFile=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_PROTECTED_WIP_BEFORE_V1.json');
  const candidate='1'.repeat(40),evaluation='2'.repeat(40),tree='3'.repeat(40),certificationEvaluation='4'.repeat(40),certificationTree='5'.repeat(40);
  const certificationValue={evaluationSha:certificationEvaluation,evaluationTreeSha:certificationTree,stageCount:33,artifactBindingDenominator:137},certificationBytes=canonicalBytes(certificationValue),certificationFile={bytes:certificationBytes,value:certificationValue,digest:h(certificationBytes)};
  const ruleset=rulesetEnvelope(),rulesetBytes=Buffer.from(`${JSON.stringify(ruleset)}\n`),rulesetEvidenceFile={bytes:rulesetBytes,value:ruleset,digest:h(rulesetBytes)},rulesetResult=verifyRuleset(ruleset);
  const candidateCi={id:81,status:'completed',conclusion:'success',head_sha:candidate},candidateCiBytes=Buffer.from(`${JSON.stringify(candidateCi)}\n`),candidateCiEvidenceFile={bytes:candidateCiBytes,value:candidateCi,digest:h(candidateCiBytes)};
  const postmergeCi={id:82,status:'completed',conclusion:'success',head_sha:evaluation},postmergeCiBytes=Buffer.from(`${JSON.stringify(postmergeCi)}\n`),postmergeCiEvidenceFile={bytes:postmergeCiBytes,value:postmergeCi,digest:h(postmergeCiBytes)};
  const member={schemaVersion:'AUDIT_CYCLE_1_TERMINAL_ATTESTATION_V1',attestationType:'EXTERNAL_IMMUTABLE_ACCEPTANCE_BOUND_TERMINAL_ATTESTATION',result:'PASS',stageId:'AUDIT_CYCLE_1_CORRECTIONS',externalSourcePlanDigest:'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a',compiledProgramFileDigest:'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a',authorityDigest:authorityFile.digest,stageInstanceDigest:instanceFile.digest,stageAdmissionDigest:admissionFile.digest,writeSetDigest:admissionFile.value.writeSetDigest,commandScopeDigest:admissionFile.value.commandScopeDigest,acceptanceSignalsDigest:admissionFile.value.acceptanceSignalsDigest,certificationSetDigest:certificationFile.digest,certificationEvaluationSha:certificationEvaluation,certificationEvaluationTreeSha:certificationTree,certificationStageCount:33,certificationArtifactBindingDenominator:137,protectedWipBeforeCarrierDigest:beforeFile.digest,protectedWipBeforeSnapshotDigest:beforeFile.value.snapshot.snapshotSha256,protectedWipBeforeCompleteDenominator:251,protectedWipBeforeDirtyDenominator:7,liveRuleset:{rulesetId:12270444,returnedBytesDigest:rulesetEvidenceFile.digest,returnedByteLength:rulesetBytes.length,normalizedRulesetDigest:rulesetResult.normalizedRulesetDigest,requiredContexts:rulesetResult.requiredContexts,protections:rulesetResult.protections},predecessorPullRequests:{pr1776:{candidateSha:'77354cfe994588dc1771f3eded29d1e7e68d703f',mergeSha:'af0bfb704c13b0195c12b0144415f2e769f99752'},pr1777:{candidateSha:'bf3d21072879d276ca3489b0bbead780fb39f596',mergeSha:'0a8837ae8b0724fa9c258d98281cae693ce0693e'}},correctionDelivery:{implementationCandidateSha:candidate,implementationMergeSha:evaluation,evaluationSha:evaluation,evaluationTreeSha:tree,candidateCiRunId:81,candidateCiBytesDigest:candidateCiEvidenceFile.digest,exactPostmergeCiRunId:82,exactPostmergeCiBytesDigest:postmergeCiEvidenceFile.digest},repository:'KirPonomarev/writer-editor',workflowPath:'.github/workflows/r24-audit-cycle1-terminal-attestation.yml',workflowRunId:83,runAttempt:1,event:'workflow_dispatch',ref:'refs/heads/main',artifactName:'r24-audit-cycle1-terminal-attestation',artifactFile:'audit-cycle1-terminal-attestation.json',nonRecursiveCarrierPattern:true,programDoneClaimed:false,mainProductGraphNodeStarted:false};
  const subject={member,authorityFile,instanceFile,admissionFile,certificationFile,beforeFile,rulesetEvidenceFile,candidateCiEvidenceFile,postmergeCiEvidenceFile,runEvidenceFile:{value:{id:83,run_attempt:1,status:'completed',conclusion:'success',event:'workflow_dispatch',head_sha:evaluation,head_branch:'main',path:'.github/workflows/r24-audit-cycle1-terminal-attestation.yml',repository:{full_name:'KirPonomarev/writer-editor'}}},artifactEvidence:{id:84,name:'r24-audit-cycle1-terminal-attestation',expired:false,digest:'',workflow_run:{id:83}},git:(args,options={})=>{let value='';if(args[0]==='rev-parse'&&args[1]===`${evaluation}^{tree}`)value=tree;else if(args[0]==='rev-parse'&&args[1]===`${evaluation}^2`)value=candidate;else if(args[0]==='merge-base')value='';else throw new Error(`UNEXPECTED_GIT:${args.join(':')}`);return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);}};
  subject.runEvidenceFile.bytes=canonicalBytes(subject.runEvidenceFile.value);subject.runEvidenceFile.digest=h(subject.runEvidenceFile.bytes);mutator(subject);const memberBytes=canonicalBytes(subject.member);subject.zipBytes=zip([{name:'audit-cycle1-terminal-attestation.json',bytes:memberBytes}]);subject.artifactEvidence.digest=`sha256:${h(subject.zipBytes)}`;return subject;
}

function cycle2TerminalFixture(mutator=()=>{}){
  const authorityFile=raw('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CORRECTIONS_OWNER_AMENDMENT_V17.json'),instanceFile=raw('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CORRECTIONS_STAGE_INSTANCE_V18.json'),admissionFile=raw('docs/OPS/R24/CORRECTIVE/POST_AUDIT_CORRECTIONS_STAGE_ADMISSION_ATTESTATION_V18.json'),beforeFile=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_2_PROTECTED_WIP_BEFORE_V1.json'),predecessorReleaseFile=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_CORRECTIONS_LEASE_RELEASE_V1.json'),predecessorReceiptFile=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_CORRECTIONS_TERMINAL_RECEIPT_V1.json'),predecessorDurableFile=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_TERMINAL_ATTESTATION_DURABLE_CARRIER_V1.json');
  const candidate='6'.repeat(40),evaluation='7'.repeat(40),tree='8'.repeat(40),certificationValue=load().value,certificationFile=load();certificationFile.digest=certificationFile.fileDigest;delete certificationFile.fileDigest;
  const ruleset=rulesetEnvelope(),rulesetBytes=Buffer.from(`${JSON.stringify(ruleset)}\n`),rulesetEvidenceFile={bytes:rulesetBytes,value:ruleset,digest:h(rulesetBytes)},rulesetResult=verifyRuleset(ruleset);
  const candidateCi={id:181,status:'completed',conclusion:'success',head_sha:candidate},candidateCiBytes=canonicalBytes(candidateCi),candidateCiEvidenceFile={bytes:candidateCiBytes,value:candidateCi,digest:h(candidateCiBytes)};
  const postmergeCi={id:182,status:'completed',conclusion:'success',head_sha:evaluation},postmergeCiBytes=canonicalBytes(postmergeCi),postmergeCiEvidenceFile={bytes:postmergeCiBytes,value:postmergeCi,digest:h(postmergeCiBytes)};
  const member={schemaVersion:'AUDIT_CYCLE_2_TERMINAL_ATTESTATION_V1',attestationType:'EXTERNAL_IMMUTABLE_ACCEPTANCE_BOUND_TERMINAL_ATTESTATION',result:'PASS',stageId:'AUDIT_CYCLE_2_CORRECTIONS',auditReceiptDigest:'babdb1ed4e37d9e8b3b8234ec4b3e86d72d43b3c2fe26a1511a5d3de1a92af70',externalSourcePlanDigest:'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a',compiledProgramFileDigest:'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a',authorityDigest:authorityFile.digest,stageInstanceDigest:instanceFile.digest,stageAdmissionDigest:admissionFile.digest,writeSetDigest:admissionFile.value.writeSetDigest,commandScopeDigest:admissionFile.value.commandScopeDigest,acceptanceSignalsDigest:admissionFile.value.acceptanceSignalsDigest,certificationSetDigest:certificationFile.digest,certificationEvaluationSha:certificationValue.evaluationSha,certificationEvaluationTreeSha:certificationValue.evaluationTreeSha,certificationStageCount:33,certificationArtifactBindingDenominator:137,protectedWipBeforeCarrierDigest:beforeFile.digest,protectedWipBeforeSnapshotDigest:beforeFile.value.snapshotSha256,protectedWipBeforeCompleteDenominator:252,protectedWipBeforeDirtyDenominator:7,predecessorCycleEvidence:{leaseReleaseDigest:predecessorReleaseFile.digest,terminalReceiptDigest:predecessorReceiptFile.digest,durableCarrierDigest:predecessorDurableFile.digest,durableCarrierValidationSchema:'AUDIT_CYCLE_1_DURABLE_CARRIER_VALIDATION_V2'},liveRuleset:{rulesetId:12270444,returnedBytesDigest:rulesetEvidenceFile.digest,returnedByteLength:rulesetBytes.length,normalizedRulesetDigest:rulesetResult.normalizedRulesetDigest,requiredContexts:rulesetResult.requiredContexts,protections:rulesetResult.protections},verifierRepairs:{durableCarrier:{canonicalCarrierDigest:AUDIT_CYCLE_1_DURABLE_EXPECTATION.carrierDigest,canonicalOuterBytesRequired:true,expectedCarrierDigestRequired:true,closedNestedKeysRequired:true,positiveSizesRequired:true,exactMemberPathRequired:true,pinnedProvenanceRequired:true,cliJsonRequired:true},liveRuleset:{ruleTypeDenominator:4,uniqueRuleTypesRequired:true,closedRoleEnvelopeRequired:true,explicitBypassActorsRequired:true,currentUserCanBypassIfPresent:'never'}},correctionDelivery:{implementationCandidateSha:candidate,implementationMergeSha:evaluation,evaluationSha:evaluation,evaluationTreeSha:tree,candidateCiRunId:181,candidateCiBytesDigest:candidateCiEvidenceFile.digest,exactPostmergeCiRunId:182,exactPostmergeCiBytesDigest:postmergeCiEvidenceFile.digest},repository:'KirPonomarev/writer-editor',workflowPath:'.github/workflows/r24-audit-cycle2-terminal-attestation.yml',workflowRunId:183,runAttempt:1,event:'workflow_dispatch',ref:'refs/heads/main',artifactName:'r24-audit-cycle2-terminal-attestation',artifactFile:'audit-cycle2-terminal-attestation.json',nonRecursiveCarrierPattern:true,programDoneClaimed:false,mainProductGraphNodeStarted:false};
  const subject={member,authorityFile,instanceFile,admissionFile,certificationFile,beforeFile,predecessorReleaseFile,predecessorReceiptFile,predecessorDurableFile,rulesetEvidenceFile,candidateCiEvidenceFile,postmergeCiEvidenceFile,runEvidenceFile:{value:{id:183,run_attempt:1,status:'completed',conclusion:'success',event:'workflow_dispatch',head_sha:evaluation,head_branch:'main',path:'.github/workflows/r24-audit-cycle2-terminal-attestation.yml',repository:{full_name:'KirPonomarev/writer-editor'}}},artifactEvidence:{id:184,name:'r24-audit-cycle2-terminal-attestation',expired:false,digest:'',workflow_run:{id:183}},git:(args,options={})=>{let value='';if(args[0]==='rev-parse'&&args[1]===`${evaluation}^{tree}`)value=tree;else if(args[0]==='rev-parse'&&args[1]===`${evaluation}^2`)value=candidate;else if(args[0]==='merge-base')value='';else throw new Error(`UNEXPECTED_GIT:${args.join(':')}`);return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);}};
  subject.runEvidenceFile.bytes=canonicalBytes(subject.runEvidenceFile.value);subject.runEvidenceFile.digest=h(subject.runEvidenceFile.bytes);mutator(subject);const memberBytes=canonicalBytes(subject.member);subject.zipBytes=zip([{name:'audit-cycle2-terminal-attestation.json',bytes:memberBytes}]);subject.artifactEvidence.digest=`sha256:${h(subject.zipBytes)}`;return subject;
}

test('successor hashes the complete 137-binding denominator from one exact evaluation identity',()=>{const file=load();const result=verify(file.value,file.fileDigest);assert.equal(result.status,'PASS');assert.equal(result.stageCount,33);assert.equal(result.artifactBindingDenominator,137);});
test('PRE00F current-head reconciliation is admitted as a post-evaluation exception',()=>{
  const file=load(),result=verify(file.value,file.fileDigest),current=result.pre00fCurrentHeadPlanDeliveryReconciliationPostEvaluationException;
  assert.equal(current.status,'PASS');
  assert.equal(current.admittedPathDenominator,PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.admittedPaths.length);
  assert.deepEqual(current.changedPaths,PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.admittedPaths);
  assert.equal(current.programDone,false);
  assert.equal(current.graphIncrement,0);
});
test('RCV00A current-head exact-toolchain entrypoint is admitted as a post-evaluation exception',()=>{
  const file=load(),result=verify(file.value,file.fileDigest),current=result.r24Rcv00aCurrentHeadExactToolchainEntryPointPostEvaluationException;
  assert.equal(current.status,'PASS');
  assert.equal(current.admittedPathDenominator,RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.admittedPaths.length);
  assert.deepEqual(current.changedPaths,RCV00A_CURRENT_HEAD_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.admittedPaths);
  assert.equal(current.exactNode,'22.12.0');
  assert.equal(current.exactNpm,'10.9.0');
  assert.equal(current.programDone,false);
  assert.equal(current.graphIncrement,0);
  assert.equal(current.historicalRcv00aAdmissionWidened,false);
});
test('RCV00B current-head effective-state compiler is admitted as a post-evaluation exception',()=>{
  const file=load(),result=verify(file.value,file.fileDigest),current=result.r24Rcv00bCurrentHeadEffectiveStateCompilerPostEvaluationException;
  assert.equal(current.status,'PASS');
  assert.equal(current.admittedPathDenominator,RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths.length);
  assert.deepEqual(current.changedPaths,RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths);
  assert.equal(current.selectionVerdict,'NO_ELIGIBLE_NODE');
  assert.equal(current.readySetCount,0);
  assert.equal(current.programDone,false);
  assert.equal(current.graphIncrement,0);
  assert.equal(current.historicalRcv00bAdmissionWidened,false);
});
test('historical false-green is reproduced as exactly nine Git-object mismatches',()=>{const value=JSON.parse(fs.readFileSync(OLD));let denominator=0,mismatches=0;for(const stage of value.stages)for(const binding of stage.artifactBindings){denominator+=1;const bytes=execFileSync('git',['show',`${value.evaluationSha}:${binding.path}`]);if(h(bytes)!==binding.sha256)mismatches+=1;}assert.equal(denominator,137);assert.equal(mismatches,9);});
test('declared artifact mismatch fails closed',()=>{const file=load(),mutant=clone(file.value);mutant.stages[0].artifactBindings[0].sha256='0'.repeat(64);assert.throws(()=>verify(mutant),/E_ARTIFACT_DIGEST_MISMATCH/);});
test('missing artifact fails closed',()=>{const file=load(),mutant=clone(file.value);mutant.stages[0].artifactBindings[0].path='missing/audit-cycle-one-artifact.json';assert.throws(()=>verify(mutant),/E_ARTIFACT_MISSING/);});
test('missing binding cannot shrink the complete denominator',()=>{const file=load(),mutant=clone(file.value);mutant.stages[0].artifactBindings.pop();assert.throws(()=>verify(mutant),/E_ARTIFACT_DENOMINATOR/);});
test('stale tree identity fails closed',()=>{const file=load(),mutant=clone(file.value);mutant.evaluationTreeSha='0'.repeat(40);assert.throws(()=>verify(mutant),/E_EVALUATION_TREE/);});
test('future top-level evaluation cannot retain stale per-stage identities',()=>{const file=load(),mutant=clone(file.value);mutant.evaluationSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();mutant.evaluationTreeSha=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();assert.throws(()=>verify(mutant),/E_STAGE_EVALUATION/);});
test('post-evaluation exception is exact and machine checked',()=>{const file=load(),mutant=clone(file.value);mutant.postEvaluationCarrierException.allowedPaths=[];assert.throws(()=>verify(mutant),/E_CARRIER_EXCEPTION_PATHS/);});
test('PR1888 DOCX import current-main reconciliation path set is exactly bounded',()=>{
  assert.deepEqual(R24_PR1888_DOCX_IMPORT_CURRENT_MAIN_RECONCILIATION_PATHS,[
    'docs/OPS/RTK/YALKEN_DOCX_IMPORT_IDEMPOTENT_RECEIPT_INTEGRITY_GOVERNANCE_APPROVALS_V1.json',
    'src/io/revisionBridge/index.mjs',
    'src/utils/docxImportSafeCreate.js',
    'test/contracts/revision-bridge-docx-content-preview-command-surface.contract.test.js',
    'test/contracts/revision-bridge-docx-content-preview.contract.test.js',
    'test/contracts/revision-bridge-docx-data-descriptor.contract.test.js',
    'test/contracts/revision-bridge-docx-hostile-file-gate.contract.test.js',
    'test/contracts/revision-bridge-docx-import-e2e-command-chain.contract.test.js',
    'test/contracts/revision-bridge-docx-import-local-file-preview.contract.test.js',
    'test/contracts/revision-bridge-docx-import-preview-plan.contract.test.js',
    'test/contracts/revision-bridge-docx-intake-preflight-report.contract.test.js',
    'test/contracts/revision-bridge-docx-zip-inventory-materializer.contract.test.js',
    'test/contracts/rtk-generic01-create-only-import.contract.test.js'
  ]);
});
test('PR1888 DOCX import current-main reconciliation admits command-surface preview test bytes only within the exact bounded path set',()=>{
  const file=load(),commandSurfacePath='test/contracts/revision-bridge-docx-content-preview-command-surface.contract.test.js';
  assert(R24_PR1888_DOCX_IMPORT_CURRENT_MAIN_RECONCILIATION_PATHS.includes(commandSurfacePath));
  assert(!R24_PR1888_DOCX_IMPORT_CURRENT_MAIN_RECONCILIATION_PATHS.includes('package.json'));
  const git=(args,options={})=>{
    if(args[0]==='diff'&&args[1]==='--name-only'&&String(args[2]).startsWith(`${file.value.evaluationSha}..`))return options.encoding==='utf8'?`${commandSurfacePath}\n`:Buffer.from(`${commandSurfacePath}\n`);
    return execFileSync('git',args,{encoding:options.encoding,maxBuffer:64*1024*1024});
  };
  const result=verifyCertificationSet({value:file.value,fileDigest:file.fileDigest,candidateSha:'HEAD',git,allowAuditCycle2Admission:true,allowMainProductWp401Admission:true});
  assert.equal(result.status,'PASS');
  assert.deepEqual(result.postEvaluationChangedPaths,[commandSurfacePath]);
});
test('PR1888 DOCX import current-main reconciliation rejects unrelated post-evaluation path mutants',()=>{
  const file=load(),mutantPath='unrelated/post-evaluation-mutant.txt';
  const git=(args,options={})=>{
    if(args[0]==='diff'&&args[1]==='--name-only'&&String(args[2]).startsWith(`${file.value.evaluationSha}..`))return options.encoding==='utf8'?`${mutantPath}\n`:Buffer.from(`${mutantPath}\n`);
    return execFileSync('git',args,{encoding:options.encoding,maxBuffer:64*1024*1024});
  };
  assert.throws(()=>verifyCertificationSet({value:file.value,fileDigest:file.fileDigest,candidateSha:'HEAD',git,allowAuditCycle2Admission:true,allowMainProductWp401Admission:true}),/E_POST_EVALUATION_PATH/);
});
test('post-evaluation bytes require the exact chained audit-cycle-two WP401 WP402 WP403 WP404 WP500 WP501 WP502 and WP503 admissions',()=>{
  const file=load();
  const cycle2=verifyAuditCycle2PostEvaluationException({candidateSha:WP401_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp401=verifyWp401MainProductPostEvaluationException({candidateSha:WP402_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp402=verifyWp402MainProductPostEvaluationException({candidateSha:WP403_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp403=verifyWp403MainProductPostEvaluationException({candidateSha:WP404_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp404=verifyWp404MainProductPostEvaluationException({candidateSha:WP500_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp500=verifyWp500MainProductPostEvaluationException({candidateSha:WP501_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp501=verifyWp501MainProductPostEvaluationException({candidateSha:WP501_GATE_INTEGRATION_ADMISSION_EXPECTATION.baseSha});
  const wp501Gate=verifyWp501GateIntegrationPostEvaluationException({candidateSha:WP501_PERFORMANCE_INTEGRATION_ADMISSION_EXPECTATION.baseSha});
  const wp501Performance=verifyWp501PerformanceIntegrationPostEvaluationException({candidateSha:WP501_AUDIT_R2_COMPATIBILITY_ADMISSION_EXPECTATION.baseSha});
  const wp501AuditR2=verifyWp501AuditR2CompatibilityPostEvaluationException({candidateSha:WP501_INVENTORY_FINALIZATION_ADMISSION_EXPECTATION.baseSha});
  const wp501Inventory=verifyWp501InventoryFinalizationPostEvaluationException({candidateSha:WP501_TERMINAL_EXCEPTION_ADMISSION_EXPECTATION.baseSha});
  const wp501Terminal=verifyWp501TerminalExceptionPostEvaluationException({candidateSha:WP502_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp502=verifyWp502MainProductPostEvaluationException({candidateSha:WP503_V6_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha});
  const wp503=verifyWp503MainProductPostEvaluationException({candidateSha:'HEAD'});
  const result=verify(file.value,file.fileDigest);
  assert.equal(cycle2.status,'PASS');
  assert.equal(cycle2.authorityDigest,AUDIT_CYCLE_2_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(cycle2.stageAdmissionDigest,AUDIT_CYCLE_2_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(cycle2.writeSetDigest,AUDIT_CYCLE_2_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp401.status,'PASS');
  assert.equal(wp401.authorityDigest,WP401_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp401.stageRegistryDigest,WP401_MAIN_PRODUCT_ADMISSION_EXPECTATION.registryDigest);
  assert.equal(wp401.stageAdmissionDigest,WP401_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp401.writeSetDigest,WP401_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp402.status,'PASS');
  assert.equal(wp402.authorityDigest,WP402_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp402.stageAdmissionDigest,WP402_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp402.writeSetDigest,WP402_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp403.status,'PASS');
  assert.equal(wp403.authorityDigest,WP403_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp403.stageAdmissionDigest,WP403_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp403.failedCandidateCiCarrierDigest,WP403_MAIN_PRODUCT_ADMISSION_EXPECTATION.failureDigest);
  assert.equal(wp403.writeSetDigest,WP403_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp403.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp403.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp404.status,'PASS');
  assert.equal(wp404.authorityDigest,WP404_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp404.stageAdmissionDigest,WP404_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp404.writeSetDigest,WP404_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp404.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp404.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp500.status,'PASS');
  assert.equal(wp500.authorityDigest,WP500_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp500.stageAdmissionDigest,WP500_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp500.writeSetDigest,WP500_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp500.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp500.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp501.status,'PASS');
  assert.equal(wp501.authorityDigest,WP501_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp501.stageAdmissionDigest,WP501_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp501.writeSetDigest,WP501_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp501.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp501.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp501Gate.status,'PASS');
  assert.equal(wp501Gate.authorityDigest,WP501_GATE_INTEGRATION_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp501Gate.stageAdmissionDigest,WP501_GATE_INTEGRATION_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp501Gate.writeSetDigest,WP501_GATE_INTEGRATION_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp501Gate.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp501Gate.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp501Performance.status,'PASS');
  assert.equal(wp501Performance.authorityDigest,WP501_PERFORMANCE_INTEGRATION_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp501Performance.stageAdmissionDigest,WP501_PERFORMANCE_INTEGRATION_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp501Performance.writeSetDigest,WP501_PERFORMANCE_INTEGRATION_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp501Performance.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp501Performance.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp501AuditR2.status,'PASS');
  assert.equal(wp501AuditR2.authorityDigest,WP501_AUDIT_R2_COMPATIBILITY_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp501AuditR2.stageAdmissionDigest,WP501_AUDIT_R2_COMPATIBILITY_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp501AuditR2.writeSetDigest,WP501_AUDIT_R2_COMPATIBILITY_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp501AuditR2.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp501AuditR2.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp501Inventory.status,'PASS');
  assert.equal(wp501Inventory.authorityDigest,WP501_INVENTORY_FINALIZATION_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp501Inventory.stageAdmissionDigest,WP501_INVENTORY_FINALIZATION_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp501Inventory.writeSetDigest,WP501_INVENTORY_FINALIZATION_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp501Inventory.sourcePlanRoles.externalSourcePlanDigest,'1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a');
  assert.equal(wp501Inventory.sourcePlanRoles.compiledProgramFileDigest,'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a');
  assert.equal(wp501Terminal.status,'PASS');
  assert.equal(wp501Terminal.authorityDigest,WP501_TERMINAL_EXCEPTION_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp501Terminal.stageAdmissionDigest,WP501_TERMINAL_EXCEPTION_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp501Terminal.writeSetDigest,WP501_TERMINAL_EXCEPTION_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp501Terminal.finalCarriers.acceptanceRows,22);
  assert.equal(wp501Terminal.finalCarriers.leaseStatus,'RELEASED');
  assert.equal(wp501Terminal.finalCarriers.wip,0);
  assert.equal(wp502.status,'PASS');
  assert.equal(wp502.authorityDigest,WP502_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp502.stageAdmissionDigest,WP502_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp502.failedCandidateCiCarrierDigest,WP502_MAIN_PRODUCT_ADMISSION_EXPECTATION.failureDigest);
  assert.equal(wp502.writeSetDigest,WP502_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp502.finalCarriers.localPassedRows,18);
  assert.equal(wp502.finalCarriers.externalPredicateRows,4);
  assert.equal(wp503.status,'PASS');
  assert.equal(wp503.authorityDigest,WP503_MAIN_PRODUCT_ADMISSION_EXPECTATION.authorityDigest);
  assert.equal(wp503.stageAdmissionDigest,WP503_MAIN_PRODUCT_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(wp503.failureDigest,WP503_MAIN_PRODUCT_ADMISSION_EXPECTATION.failureDigest);
  assert.equal(wp503.writeSetDigest,WP503_MAIN_PRODUCT_ADMISSION_EXPECTATION.writeSetDigest);
  assert.equal(wp503.deltaAdmittedPathDenominator,16);
  assert.equal(wp503.admittedPathDenominator,110);
  assert.equal(wp503.predecessor.admittedPathDenominator,102);
  assert.equal(result.auditCycle2PostEvaluationException.status,'PASS');
  assert.equal(result.wp401MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp402MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp403MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp403MainProductPostEvaluationException.changedPaths.every((entry)=>wp403.admittedPaths.includes(entry)),true);
  assert.equal(result.wp404MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp404MainProductPostEvaluationException.changedPaths.every((entry)=>wp404.admittedPaths.includes(entry)),true);
  assert.equal(result.wp500MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp500MainProductPostEvaluationException.changedPaths.every((entry)=>wp500.admittedPaths.includes(entry)),true);
  assert.equal(result.wp501MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp501MainProductPostEvaluationException.changedPaths.every((entry)=>wp501.admittedPaths.includes(entry)),true);
  assert.equal(result.wp501GateIntegrationPostEvaluationException.status,'PASS');
  assert.equal(result.wp501GateIntegrationPostEvaluationException.changedPaths.every((entry)=>wp501Gate.admittedPaths.includes(entry)),true);
  assert.equal(result.wp501PerformanceIntegrationPostEvaluationException.status,'PASS');
  assert.equal(result.wp501PerformanceIntegrationPostEvaluationException.changedPaths.every((entry)=>wp501Performance.admittedPaths.includes(entry)),true);
  assert.equal(result.wp501AuditR2CompatibilityPostEvaluationException.status,'PASS');
  assert.equal(result.wp501AuditR2CompatibilityPostEvaluationException.changedPaths.every((entry)=>wp501AuditR2.admittedPaths.includes(entry)),true);
  assert.equal(result.wp501InventoryFinalizationPostEvaluationException.status,'PASS');
  assert.equal(result.wp501InventoryFinalizationPostEvaluationException.changedPaths.every((entry)=>wp501Inventory.admittedPaths.includes(entry)),true);
  assert.equal(result.wp501TerminalExceptionPostEvaluationException.status,'PASS');
  assert.equal(result.wp501TerminalExceptionPostEvaluationException.changedPaths.every((entry)=>wp501Terminal.admittedPaths.includes(entry)),true);
  assert.equal(result.wp502MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp502MainProductPostEvaluationException.changedPaths.every((entry)=>wp502.admittedPaths.includes(entry)),true);
  assert.equal(result.wp503MainProductPostEvaluationException.status,'PASS');
  assert.equal(result.wp503MainProductPostEvaluationException.changedPaths.every((entry)=>wp503.admittedPaths.includes(entry)),true);
});
test('PK1R1 closed-stage verifier accepts the immutable 19-path candidate from successor HEAD',()=>{
  const result=verifyPk1r1MainProductPostEvaluationException({candidateSha:'HEAD'});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha);
  assert.equal(result.baseTree,PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseTree);
  assert.equal(result.candidateSha,PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.issuedCandidateSha);
  assert.equal(result.candidateTree,PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.issuedCandidateTree);
  assert.equal(result.successorCandidateSha,result.requestedCandidateSha);
  assert.equal(result.successorCandidateIsClosedCandidate,result.requestedCandidateSha===PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.issuedCandidateSha);
  assert.equal(result.changedPathDenominator,19);
  assert.equal(result.admittedPathDenominator,19);
  assert.deepEqual(result.changedPaths,result.admittedPaths);
  assert.equal(result.graphIncrement,0);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
});
test('PK1R1 closed-stage verifier rejects a mutated immutable candidate tree',()=>{
  const e=PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION;
  const hostileGit=(args,options={})=>{
    if(args[0]==='rev-parse'&&args[1]===`${e.issuedCandidateSha}^{tree}`)return options.encoding==='utf8'?`${'0'.repeat(40)}\n`:Buffer.from(`${'0'.repeat(40)}\n`);
    return execFileSync('git',args,options);
  };
  assert.throws(()=>verifyPk1r1MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_PK1R1_ISSUED_CANDIDATE_IDENTITY/);
});
test('PK1R1 closed-stage verifier rejects a wrong historical delta',()=>{
  const e=PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION;
  const hostileGit=(args,options={})=>{
    if(args[0]==='diff'&&args[2]===`${e.baseSha}..${e.issuedCandidateSha}`){
      const admitted=execFileSync('git',['diff','--name-only',`${e.baseSha}..${e.issuedCandidateSha}`],{encoding:'utf8'}).split('\n').filter(Boolean);
      const mutantChanged=[...admitted,'README.md'].sort().join('\n')+'\n';
      return options.encoding==='utf8'?mutantChanged:Buffer.from(mutantChanged);
    }
    return execFileSync('git',args,options);
  };
  assert.throws(()=>verifyPk1r1MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_PK1R1_EXACT_ADMITTED_DELTA/);
});
test('PK1R1 closed-stage verifier rejects a wrong terminal receipt',()=>{
  const e=PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION,terminalPath='docs/OPS/R24/CORRECTIVE/PK1R1_TERMINAL_RECEIPT_V1.json';
  const hostileGit=(args,options={})=>{
    if(args[0]==='show'&&args[1]===`${e.issuedCandidateSha}:${terminalPath}`){
      const terminal=JSON.parse(execFileSync('git',['show',`${e.issuedCandidateSha}:${terminalPath}`]));
      terminal.graphIncrement=1;
      const bytes=Buffer.from(JSON.stringify(terminal)+'\n');
      return options.encoding==='utf8'?bytes.toString('utf8'):bytes;
    }
    return execFileSync('git',args,options);
  };
  assert.throws(()=>verifyPk1r1MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_PK1R1_STATE_CARRIER_DIGEST/);
});
test('PK1R1 closed-stage verifier rejects a non-descendant evidence head',()=>{
  const e=PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION;
  assert.throws(()=>verifyPk1r1MainProductPostEvaluationException({candidateSha:e.baseSha}),/E_PK1R1_SUCCESSOR_NOT_DESCENDANT/);
});
test('PRE00B lifecycle reconciliation verifier is pinned to the delivered merge',()=>{
  const result=verifyPre00bLifecycleReconciliationPostEvaluationException({candidateSha:'HEAD'});
  assert.equal(result.status,'PASS');
  assert.equal(result.deliverySha,PRE00B_LIFECYCLE_RECONCILIATION_DELIVERY_SHA);
  assert.equal(result.deliveryTree,PRE00B_LIFECYCLE_RECONCILIATION_DELIVERY_TREE);
  assert.equal(result.changedPathDenominator,10);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
});
test('PRE00B lifecycle reconciliation verifier rejects a mutated delivered-stage delta',()=>{
  const hostileGit=(args,options={})=>{
    if(args[0]==='diff'&&args[2]===`${PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.issuedCandidateSha}..${PRE00B_LIFECYCLE_RECONCILIATION_DELIVERY_SHA}`){
      return options.encoding==='utf8'?'README.md\n':Buffer.from('README.md\n');
    }
    return execFileSync('git',args,options);
  };
  assert.throws(()=>verifyPre00bLifecycleReconciliationPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_PRE00B_EXACT_ADMITTED_DELTA/);
});
test('PRE00C next-contour selection verifier is pinned to its delivered merge',()=>{
  const result=verifyPre00cNextContourSelectionPostEvaluationException({candidateSha:'HEAD'});
  assert.equal(result.status,'PASS');
  assert.equal(result.deliverySha,PRE00C_NEXT_CONTOUR_SELECTION_DELIVERY_SHA);
  assert.equal(result.deliveryTree,PRE00C_NEXT_CONTOUR_SELECTION_DELIVERY_TREE);
  assert.equal(result.changedPathDenominator,4);
  assert.equal(result.graphIncrement,0);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
});
test('PRE00C closed-stage candidate verifier accepts the bounded repair delta',()=>{
  const result=verifyPre00cClosedStageCandidateVerifierRepairPostEvaluationException({candidateSha:PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.deliverySha});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.baseSha);
  assert.equal(result.baseTree,PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.baseTree);
  assert.equal(result.candidateSha,PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.deliverySha);
  assert.deepEqual(result.changedPaths,PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.admittedPaths);
  assert.equal(result.graphIncrement,0);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
});
test('PRE00C closed-stage candidate verifier rejects an unadmitted future path',()=>{
  const candidateSha='c'.repeat(40);
  const hostileGit=(args,options={})=>{
    if(args[0]==='rev-parse'&&args[1]===candidateSha)return options.encoding==='utf8'?`${candidateSha}\n`:Buffer.from(`${candidateSha}\n`);
    if(args[0]==='rev-parse'&&args[1]===`${PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.baseSha}^{tree}`)return options.encoding==='utf8'?`${PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.baseTree}\n`:Buffer.from(`${PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.baseTree}\n`);
    if(args[0]==='merge-base')return options.encoding==='utf8'?'':Buffer.from('');
    if(args[0]==='diff'&&args[2]===`${PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.baseSha}..${candidateSha}`){
      const mutantChanged=[...PRE00C_CLOSED_STAGE_CANDIDATE_VERIFIER_REPAIR_EXPECTATION.admittedPaths,'README.md'].sort().join('\n')+'\n';
      return options.encoding==='utf8'?mutantChanged:Buffer.from(mutantChanged);
    }
    return execFileSync('git',args,options);
  };
  assert.throws(()=>verifyPre00cClosedStageCandidateVerifierRepairPostEvaluationException({candidateSha,git:hostileGit}),/E_PRE00C_CLOSED_STAGE_EXACT_ADMITTED_DELTA/);
});
function pre00dGitFixture(changedPaths){
  const e=PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_EXPECTATION,candidateSha='c'.repeat(40),candidateTree='d'.repeat(40);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=`${changedPaths.join('\n')}\n`;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const objectSha=String(args[1]).startsWith(`${e.baseSha}:`)?e.baseSha:e.deliverySha;
      const bytes=execFileSync('git',['show',`${objectSha}:${repoPath}`]);
      return options.encoding==='utf8'?bytes.toString('utf8'):bytes;
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);
  }};
}
test('PRE00D fresh successor admission lease handoff accepts the bounded delta',()=>{
  const e=PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_EXPECTATION,fixture=pre00dGitFixture(e.admittedPaths);
  const result=verifyPre00dFreshSuccessorAdmissionLeaseHandoffPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,e.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,12);
  assert.equal(result.approvalDenominator,11);
  assert.equal(result.negativeProbeDenominator,9);
});
test('PRE00D fresh successor admission lease handoff rejects an unadmitted future path',()=>{
  const e=PRE00D_FRESH_SUCCESSOR_ADMISSION_LEASE_HANDOFF_EXPECTATION,fixture=pre00dGitFixture([...e.admittedPaths,'package.json'].sort());
  assert.throws(()=>verifyPre00dFreshSuccessorAdmissionLeaseHandoffPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00D_EXACT_ADMITTED_DELTA/);
});
function pre00eGitFixture(changedPaths,{baseTree,bytesByPath=new Map(),candidateSha='e'.repeat(40),candidateTree='f'.repeat(40)}={}){
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION,historicalSha=e.deliverySha;
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.deliverySha)value=e.deliverySha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${e.deliverySha}^{tree}`)value=e.deliveryTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=`${changedPaths.join('\n')}\n`;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const replacement=bytesByPath.get(repoPath);
      if(replacement)return options.encoding==='utf8'?replacement.toString('utf8'):Buffer.from(replacement);
      const bytes=objectFromCommit(historicalSha,repoPath);
      return options.encoding==='utf8'?bytes.toString('utf8'):bytes;
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);
  }};
}
test('PRE00E recovery CI external confirmation accepts the bounded delta',()=>{
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION,fixture=pre00eGitFixture(e.admittedPaths);
  const result=verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,e.baseSha);
  assert.equal(result.admittedPathDenominator,11);
  assert.equal(result.approvalDenominator,10);
  assert.equal(result.recoveryRequiredJobDenominator,17);
  assert.equal(result.formerlyFailingPrimaryLaneDenominator,5);
  assert.equal(result.aggregateLaneDenominator,2);
  assert.equal(result.interveningDeliveryDenominator,1);
  assert.equal(result.negativeProbeDenominator,9);
  assert.equal(PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION.deliverySha,'6e9be072a12ff3bd5cc1608da153caf13c5e94c2');
  assert.equal(PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION.deliveryTree,'e442f006f5c5b8229d51df9b8f1fff5c68803aab');
});
test('PRE00E recovery CI external confirmation rejects an unadmitted future path',()=>{
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION,fixture=pre00eGitFixture([...e.admittedPaths,'README.md'].sort());
  assert.throws(()=>verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00E_EXACT_ADMITTED_DELTA/);
});
test('PRE00E recovery CI external confirmation rejects a forged same-count bootstrap set',()=>{
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION;
  const forged=e.admittedPaths.filter((repoPath)=>repoPath!==e.taskPath).concat('package.json').sort();
  const fixture=pre00eGitFixture(forged);
  assert.equal(forged.length,e.admittedPaths.length);
  assert.throws(()=>verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00E_EXACT_ADMITTED_DELTA/);
});
test('PRE00E recovery CI external confirmation rejects a stale base tree',()=>{
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION,fixture=pre00eGitFixture(e.admittedPaths,{baseTree:'0'.repeat(40)});
  assert.throws(()=>verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00E_BASE_TREE_DRIFT/);
});
test('PRE00E recovery CI external confirmation rejects mutated historical bytes',()=>{
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION;
  const taskBytes=objectFromCommit(e.deliverySha,e.taskPath);
  const bytesByPath=new Map([[e.taskPath,Buffer.from(`${taskBytes.toString('utf8')}\nMUTATED_HISTORICAL_PRE00E_BYTES\n`)]]);
  const fixture=pre00eGitFixture(e.admittedPaths,{bytesByPath});
  assert.throws(()=>verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00E_EVIDENCE_ARTIFACT_DIGEST/);
});
test('PRE00E successor interop delta is routed to the pinned historical bootstrap candidate',()=>{
  const e=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION,futureCandidateSha='9'.repeat(40);
  const ordinaryInteropSuccessorPaths=[
    'src/core/docx-profile-v1.mjs',
    'src/export/docx/docxMinBuilder.js',
    'src/export/docx/docxReviewPacketBuilder.js',
    'src/export/docx/docxTextXml.js',
    'test/unit/r24-docx-text-xml-control-boundary.test.mjs',
  ].sort();
  const git=(args,options={})=>{
    let value='';
    if(args[0]==='merge-base'&&args[1]==='--is-ancestor'&&args[3]===futureCandidateSha){
      if(args[2]===e.deliverySha)value='';
      else throw new Error(`NOT_ANCESTOR:${args[2]}:${args[3]}`);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);
  };
  assert.equal(ordinaryInteropSuccessorPaths.length,5);
  const historicalCandidate=resolvePre00eRecoveryCiExternalConfirmationCandidateSha({resolvedCandidate:futureCandidateSha,git});
  assert.equal(historicalCandidate,e.deliverySha);
  const result=verifyPre00eRecoveryCiExternalConfirmationPostEvaluationException({candidateSha:historicalCandidate});
  assert.equal(result.status,'PASS');
  assert.equal(result.changedPathDenominator,11);
});
function pre00fGitFixture({changedPaths,planBytes,inventoryBytes,testBytes,verifierBytes,claimLintBytes,evidenceBytes,approvalsBytes,baseTree}={}){
  const e=PRE00F_PLAN_DELIVERY_EXPECTATION,candidateSha='1'.repeat(40),candidateTree='2'.repeat(40);
  const deliveryBytes=(repoPath)=>execFileSync('git',['show',`${e.deliverySha}:${repoPath}`]);
  const bytesByPath=new Map([
    [e.planPath,planBytes??deliveryBytes(e.planPath)],
    [e.inventoryPath,inventoryBytes??deliveryBytes(e.inventoryPath)],
    [e.postAuditTestPath,testBytes??deliveryBytes(e.postAuditTestPath)],
    [e.postAuditVerifierPath,verifierBytes??deliveryBytes(e.postAuditVerifierPath)],
    [e.claimLintPath,claimLintBytes??deliveryBytes(e.claimLintPath)],
    [e.evidencePath,evidenceBytes??deliveryBytes(e.evidencePath)],
    [e.approvalsPath,approvalsBytes??deliveryBytes(e.approvalsPath)],
  ]);
  const currentBytesByPath=new Map([
    [e.postAuditTestPath,Buffer.from(`${deliveryBytes(e.postAuditTestPath).toString('utf8')}\n// current candidate drift must not rebind historical PRE00F delivery bytes\n`)],
  ]);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.deliverySha)value=e.deliverySha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${e.deliverySha}^{tree}`)value=e.deliveryTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=`${(changedPaths??e.admittedPaths).join('\n')}\n`;
    else if(args[0]==='show'){
      const spec=String(args[1]),separator=spec.indexOf(':'),objectish=spec.slice(0,separator),repoPath=spec.slice(separator+1);
      const bytes=objectish===e.deliverySha?bytesByPath.get(repoPath):(currentBytesByPath.get(repoPath)??bytesByPath.get(repoPath));
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);
  }};
}
test('PRE00F plan delivery accepts the exact plan doc and verifier-support delta',()=>{
  const fixture=pre00fGitFixture(),result=verifyPre00fPlanDeliveryPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,PRE00F_PLAN_DELIVERY_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,PRE00F_PLAN_DELIVERY_EXPECTATION.deliverySha);
  assert.equal(result.currentCandidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,7);
  assert.equal(result.changedPathDenominator,7);
  assert.equal(result.targetDigest,PRE00F_PLAN_DELIVERY_EXPECTATION.targetDigest);
  assert.equal(result.sourceDigest,PRE00F_PLAN_DELIVERY_EXPECTATION.sourceDigest);
  assert.equal(result.ownerAmendedSourceDigest,PRE00F_PLAN_DELIVERY_EXPECTATION.ownerAmendedSourceDigest);
  assert.equal(result.portabilityGapRecorded,true);
  assert.equal(result.nextStep,'R24-RCV-00A');
});
test('PRE00F plan delivery rejects an unadmitted future path',()=>{
  const e=PRE00F_PLAN_DELIVERY_EXPECTATION,fixture=pre00fGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyPre00fPlanDeliveryPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_EXACT_ADMITTED_DELTA/);
});
test('PRE00F plan delivery rejects semantic content drift',()=>{
  const e=PRE00F_PLAN_DELIVERY_EXPECTATION;
  const planBytes=Buffer.from(fs.readFileSync(e.planPath,'utf8').replace('CURRENT_PROGRAM_DONE: false','CURRENT_PROGRAM_DONE: true'));
  const fixture=pre00fGitFixture({planBytes});
  assert.throws(()=>verifyPre00fPlanDeliveryPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_TARGET_DIGEST/);
});
test('PRE00F plan delivery rejects stale CI approval registry binding',()=>{
  const e=PRE00F_PLAN_DELIVERY_EXPECTATION,approvalRegistry=JSON.parse(fs.readFileSync(e.approvalsPath,'utf8'));
  approvalRegistry.approvals.find((entry)=>entry.filePath===e.evidencePath).sha256='0'.repeat(64);
  const approvalsBytes=Buffer.from(`${JSON.stringify(approvalRegistry,null,2)}\n`);
  const fixture=pre00fGitFixture({approvalsBytes});
  assert.throws(()=>verifyPre00fPlanDeliveryPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_APPROVAL_REGISTRY_DIGEST/);
});
function rcv00aGitFixture({changedPaths}={}){
  const e=R24_RCV00A_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION,deliverySha=e.deliverySha,candidateSha='4'.repeat(40),deliveryTree=e.deliveryTree,candidateTree='6'.repeat(40);
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[repoPath,objectFromCommit(deliverySha,repoPath)]));
  return{candidateSha,deliverySha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===deliverySha)value=deliverySha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===deliverySha+'^{tree}')value=deliveryTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
function interop100GitFixture({changedPaths,denominatorBytes,ledgerBytes,catalogBytes,inventoryBytes,claimBindingBytes,approvalsBytes,claimLintBytes,claimLintTestBytes,governanceDetectorBytes,governanceDetectorTestBytes,validatorBytes,contractTestBytes,postAuditVerifierBytes,postAuditTestBytes,baseTree}={}){
  const e=R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION,deliverySha=e.deliverySha,candidateSha='3'.repeat(40),deliveryTree=e.deliveryTree,candidateTree='4'.repeat(40);
  const bytesByPath=new Map([
    [e.denominatorPath,denominatorBytes??objectFromCommit(deliverySha,e.denominatorPath)],
    [e.ledgerPath,ledgerBytes??objectFromCommit(deliverySha,e.ledgerPath)],
    [e.catalogPath,catalogBytes??objectFromCommit(deliverySha,e.catalogPath)],
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliverySha,e.inventoryPath)],
    [e.claimBindingPath,claimBindingBytes??objectFromCommit(deliverySha,e.claimBindingPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(deliverySha,e.approvalsPath)],
    [e.claimLintPath,claimLintBytes??objectFromCommit(deliverySha,e.claimLintPath)],
    [e.claimLintTestPath,claimLintTestBytes??objectFromCommit(deliverySha,e.claimLintTestPath)],
    [e.governanceDetectorPath,governanceDetectorBytes??objectFromCommit(deliverySha,e.governanceDetectorPath)],
    [e.governanceDetectorTestPath,governanceDetectorTestBytes??objectFromCommit(deliverySha,e.governanceDetectorTestPath)],
    [e.validatorPath,validatorBytes??objectFromCommit(deliverySha,e.validatorPath)],
    [e.contractTestPath,contractTestBytes??objectFromCommit(deliverySha,e.contractTestPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliverySha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliverySha,e.postAuditTestPath)],
  ]);
  return{candidateSha,deliverySha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===deliverySha)value=deliverySha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===deliverySha+'^{tree}')value=deliveryTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('RCV00A exact-toolchain post-evaluation exception accepts the bounded delivery delta',()=>{
  const fixture=rcv00aGitFixture(),result=verifyR24Rcv00aExactToolchainEntryPointPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.deliverySha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,R24_RCV00A_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION.admittedPaths.length);
  assert.equal(result.inventoryDenominator,1458);
});
test('RCV00A exact-toolchain post-evaluation exception rejects an unadmitted delivery path',()=>{
  const e=R24_RCV00A_EXACT_TOOLCHAIN_ENTRYPOINT_EXPECTATION,fixture=rcv00aGitFixture({changedPaths:[...e.admittedPaths,'README.md'].sort()});
  assert.throws(()=>verifyR24Rcv00aExactToolchainEntryPointPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00A_EXACT_ADMITTED_DELTA/);
});
function rcv00bGitFixture({changedPaths,evidenceBytes,artifactBytesByPath=new Map(),deliveryTree,candidateSha='8'.repeat(40),candidateTree='9'.repeat(40)}={}){
  const e=R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[
    repoPath,
    artifactBytesByPath.get(repoPath)??(repoPath===e.evidencePath&&evidenceBytes?Buffer.from(evidenceBytes):objectFromCommit(e.deliverySha,repoPath)),
  ]));
  return{candidateSha,deliverySha:e.deliverySha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.deliverySha)value=e.deliverySha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===e.deliverySha+'^{tree}')value=deliveryTree??e.deliveryTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('RCV00B effective-state compiler exception accepts the exact compiler delta',()=>{
  const fixture=rcv00bGitFixture(),result=verifyR24Rcv00bEffectiveStateCompilerPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION.baseSha);
  assert.equal(result.deliverySha,fixture.deliverySha);
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION.admittedPaths.length);
  assert.equal(result.inventoryDenominator,1460);
  assert.equal(result.effectiveStateDigest,R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION.effectiveStateDigest);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
});
test('RCV00B effective-state compiler exception rejects an unadmitted future path',()=>{
  const e=R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION,fixture=rcv00bGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24Rcv00bEffectiveStateCompilerPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_EXACT_ADMITTED_DELTA/);
});
test('RCV00B effective-state compiler exception rejects stale inventory claim binding',()=>{
  const e=R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION,evidence=JSON.parse(fs.readFileSync(e.evidencePath,'utf8'));
  evidence.claimBindings.find((binding)=>binding.filePath===e.inventoryPath).sha256='0'.repeat(64);
  const fixture=rcv00bGitFixture({evidenceBytes:canonicalBytes(evidence)});
  assert.throws(()=>verifyR24Rcv00bEffectiveStateCompilerPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_EVIDENCE_INVENTORY_BINDING/);
});
test('RCV00B effective-state compiler exception rejects a mutated immutable delivery artifact',()=>{
  const e=R24_RCV00B_EFFECTIVE_STATE_COMPILER_EXPECTATION,mutated=new Map([[e.postAuditVerifierPath,Buffer.from(`${objectFromCommit(e.deliverySha,e.postAuditVerifierPath).toString('utf8')}\n// mutated immutable delivery artifact\n`)]]);
  const fixture=rcv00bGitFixture({artifactBytesByPath:mutated});
  assert.throws(()=>verifyR24Rcv00bEffectiveStateCompilerPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_EVIDENCE_ARTIFACT_DIGEST/);
});
test('RCV00B effective-state compiler exception rejects a wrong immutable delivery tree',()=>{
  const fixture=rcv00bGitFixture({deliveryTree:'0'.repeat(40)});
  assert.throws(()=>verifyR24Rcv00bEffectiveStateCompilerPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_DELIVERY_TREE_DRIFT/);
});
function rcv00bSuccessorGitFixture({changedPaths,registryBytes,artifactBytesByPath=new Map(),baseTree,candidateSha='a'.repeat(40),candidateTree='b'.repeat(40),missingRegistry=false}={}){
  const e=R24_RCV00B_SUCCESSOR_ADMISSION_REGISTRY_EXPECTATION;
  const historicalCandidateSha=R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION.baseSha;
  const currentBytes=(repoPath)=>artifactBytesByPath.get(repoPath)??objectFromCommit(historicalCandidateSha,repoPath);
  const bytesByPath=new Map([
    [e.registryPath,registryBytes??currentBytes(e.registryPath)],
    [e.approvalsPath,currentBytes(e.approvalsPath)],
    ['docs/ARCH_DIFF_LOG.md',currentBytes('docs/ARCH_DIFF_LOG.md')],
    ['docs/HANDOFF.md',currentBytes('docs/HANDOFF.md')],
    ['docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',currentBytes('docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json')],
    ['scripts/ops/r24/corrective/post-audit-certification-set.mjs',currentBytes('scripts/ops/r24/corrective/post-audit-certification-set.mjs')],
    ['scripts/ops/r24/docs-claim-lint.mjs',currentBytes('scripts/ops/r24/docs-claim-lint.mjs')],
    ['scripts/ops/r24/tests/docs-claim-lint.test.mjs',currentBytes('scripts/ops/r24/tests/docs-claim-lint.test.mjs')],
    ['src/io/revisionBridge/reviewTransportPackageParserV2.mjs',currentBytes('src/io/revisionBridge/reviewTransportPackageParserV2.mjs')],
    ['test/contracts/r24-post-audit-certification-set.contract.test.mjs',currentBytes('test/contracts/r24-post-audit-certification-set.contract.test.mjs')],
    ['test/contracts/rtk-word-latest-semantic-b02-package-parser.contract.test.js',currentBytes('test/contracts/rtk-word-latest-semantic-b02-package-parser.contract.test.js')],
    ['test/unit/security-privacy-writing-path-smoke.mjs',currentBytes('test/unit/security-privacy-writing-path-smoke.mjs')],
  ]);
  const registry=missingRegistry?null:JSON.parse((registryBytes??bytesByPath.get(e.registryPath)).toString('utf8'));
  const admittedPaths=registry?registry.entries.flatMap((entry)=>entry.admittedPaths):[];
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??[...new Set(admittedPaths)].sort()).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      if(missingRegistry&&repoPath===e.registryPath)throw Object.assign(new Error('missing registry'),{code:'ENOENT'});
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('RCV00B successor admission registry accepts the PR1862 repair delta and PR1861 ReviewIR boundary delta',()=>{
  const result=verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException(rcv00bSuccessorGitFixture());
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00B_SUCCESSOR_ADMISSION_REGISTRY_EXPECTATION.baseSha);
  assert.equal(result.entryDenominator,2);
  assert.equal(result.predecessorAdmittedPathDenominator,19);
  assert.equal(result.admittedPathDenominator,12);
  assert(result.admittedPaths.includes('docs/ARCH_DIFF_LOG.md'));
  assert(result.admittedPaths.includes('scripts/ops/r24/corrective/post-audit-certification-set.mjs'));
  assert(result.admittedPaths.includes('scripts/ops/r24/docs-claim-lint.mjs'));
  assert(result.admittedPaths.includes('src/io/revisionBridge/reviewTransportPackageParserV2.mjs'));
  assert(result.admittedPaths.includes('test/contracts/rtk-word-latest-semantic-b02-package-parser.contract.test.js'));
  assert(result.admittedPaths.includes('test/unit/security-privacy-writing-path-smoke.mjs'));
});
test('RCV00B successor admission registry rejects missing successor evidence',()=>{
  const fixture=rcv00bSuccessorGitFixture({missingRegistry:true});
  assert.throws(()=>verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_SUCCESSOR_REGISTRY_MISSING/);
});
test('RCV00B successor admission registry rejects stale successor base tree',()=>{
  const fixture=rcv00bSuccessorGitFixture({baseTree:'0'.repeat(40)});
  assert.throws(()=>verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_SUCCESSOR_BASE_TREE_DRIFT/);
});
test('RCV00B successor admission registry rejects an unadmitted future path',()=>{
  const fixture=rcv00bSuccessorGitFixture({changedPaths:['README.md']});
  assert.throws(()=>verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_SUCCESSOR_UNADMITTED_PATH/);
});
test('RCV00B successor admission registry rejects a same-count forged successor path',()=>{
  const e=R24_RCV00B_SUCCESSOR_ADMISSION_REGISTRY_EXPECTATION,registry=JSON.parse(fs.readFileSync(e.registryPath,'utf8'));
  const changed=registry.entries[0].admittedPaths.map((repoPath)=>repoPath==='docs/HANDOFF.md'?'package.json':repoPath).sort();
  const fixture=rcv00bSuccessorGitFixture({changedPaths:changed});
  assert.throws(()=>verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_SUCCESSOR_UNADMITTED_PATH/);
});
test('RCV00B successor admission registry rejects PR1861 parser source without boundary-index evidence',()=>{
  const parserPath='src/io/revisionBridge/reviewTransportPackageParserV2.mjs';
  const source=fs.readFileSync(parserPath,'utf8').replaceAll('createRevisionReplacementGroupBoundaryIndex','createRevisionReplacementGroupIndex');
  const fixture=rcv00bSuccessorGitFixture({artifactBytesByPath:new Map([[parserPath,Buffer.from(source)]])});
  assert.throws(()=>verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00B_SUCCESSOR_TOKEN/);
});
function rcv00cGitFixture({changedPaths,registerBytes,evidenceBytes,artifactBytesByPath=new Map(),baseTree,candidateSha='c'.repeat(40),candidateTree='d'.repeat(40),missingRegister=false}={}){
  const e=R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION;
  const currentBytes=(repoPath)=>{
    if(artifactBytesByPath.has(repoPath))return artifactBytesByPath.get(repoPath);
    if(repoPath===e.registerPath&&registerBytes)return Buffer.from(registerBytes);
    if(repoPath===e.evidencePath&&evidenceBytes)return Buffer.from(evidenceBytes);
    return objectFromCommit(e.deliverySha,repoPath);
  };
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[repoPath,currentBytes(repoPath)]));
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      if(missingRegister&&repoPath===e.registerPath)throw Object.assign(new Error('missing register'),{code:'ENOENT'});
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('RCV00C corrective register exception accepts the exact register delta',()=>{
  const fixture=rcv00cGitFixture(),result=verifyR24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION.admittedPaths.length);
  assert.equal(result.inventoryDenominator,1461);
  assert.equal(result.findingDenominator,45);
  assert.equal(result.currentObservationDenominator,1);
  assert.equal(result.activeConfirmed,3);
  assert.equal(result.activeConfirmedCurrentObservations,1);
  assert.equal(result.recordedGraphOpen,9);
  assert.equal(result.graphIncrement,0);
});
test('RCV00C corrective register exception rejects an unadmitted future path',()=>{
  const e=R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION,fixture=rcv00cGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00C_EXACT_ADMITTED_DELTA/);
});
test('RCV00C corrective register exception rejects a mutated graph-promotion register',()=>{
  const e=R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION,register=JSON.parse(fs.readFileSync(e.registerPath,'utf8'));
  register.graphBinding.createsGraphNode=true;
  const fixture=rcv00cGitFixture({registerBytes:canonicalBytes(register)});
  assert.throws(()=>verifyR24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00C_GRAPH_BINDING/);
});
test('RCV00C corrective register exception rejects stale register claim binding',()=>{
  const e=R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION,evidence=JSON.parse(fs.readFileSync(e.evidencePath,'utf8'));
  evidence.claimBindings.find((binding)=>binding.filePath===e.registerPath).sha256='0'.repeat(64);
  const fixture=rcv00cGitFixture({evidenceBytes:canonicalBytes(evidence)});
  assert.throws(()=>verifyR24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00C_EVIDENCE_REGISTER_BINDING/);
});
test('RCV00C corrective register exception rejects missing register artifact',()=>{
  const fixture=rcv00cGitFixture({missingRegister:true});
  assert.throws(()=>verifyR24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00C_ARTIFACT_MISSING/);
});
function rcv00dGitFixture({changedPaths,evidenceBytes,artifactBytesByPath=new Map(),baseTree,candidateSha='4'.repeat(40),candidateTree='5'.repeat(40),missingEvidence=false}={}){
  const e=R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION;
  const currentBytes=(repoPath)=>{
    if(artifactBytesByPath.has(repoPath))return artifactBytesByPath.get(repoPath);
    if(repoPath===e.evidencePath&&evidenceBytes)return Buffer.from(evidenceBytes);
    return objectFromCommit(e.deliverySha,repoPath);
  };
  const bytesByPath=new Map(e.admittedPaths.concat([e.registerPath,e.planPath,e.planStatePath,e.approvalCarrierPath,e.claimLintPath,e.claimLintTestPath]).map((repoPath)=>[repoPath,currentBytes(repoPath)]));
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      if(missingEvidence&&repoPath===e.evidencePath)throw Object.assign(new Error('missing evidence'),{code:'ENOENT'});
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('RCV00D graph-derived selector exception accepts the exact selector delta',()=>{
  const fixture=rcv00dGitFixture(),result=verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,8);
  assert.ok(!result.changedPaths.includes(R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.approvalCarrierPath));
  assert.equal(result.inventoryDenominator,1465);
  assert.equal(result.selectedId,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.selectedObservationId);
  assert.equal(result.selectedContour,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.selectedContour);
  assert.equal(result.graphSchedulerSelectedId,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.graphSchedulerCandidate);
  assert.equal(result.graphSchedulerSelectedKind,'NONE');
  assert.equal(result.graphSchedulerVerdict,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.graphSchedulerVerdict);
  assert.equal(result.narrativeNextStep,'R24-RCV-00A');
  assert.equal(result.graphIncrement,0);
});
test('RCV00D successor routing keeps the RCV00C exact delta historical while admitting the selector delta',()=>{
  const file=load(),result=verifyCertificationSet({value:file.value,fileDigest:file.fileDigest,candidateSha:'HEAD',allowAuditCycle2Admission:true});
  assert.equal(result.status,'PASS');
  assert.equal(result.r24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException.candidateSha,R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION.deliverySha);
  assert.equal(result.r24Rcv00cCorrectiveRegisterCrosswalkPostEvaluationException.changedPathDenominator,R24_RCV00C_CORRECTIVE_REGISTER_CROSSWALK_EXPECTATION.admittedPaths.length);
  assert.equal(result.r24Rcv00dGraphDerivedSelectorPostEvaluationException.candidateSha,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.deliverySha);
  assert.equal(result.r24DocxLinebreakSourceExportPostEvaluationException.candidateSha,R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION.deliverySha);
  assert.equal(result.r24Rcv00dGraphDerivedSelectorPostEvaluationException.changedPathDenominator,R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION.admittedPaths.length);
});
test('RCV00D graph-derived selector exception rejects an unadmitted future path',()=>{
  const e=R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION,fixture=rcv00dGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00D_EXACT_ADMITTED_DELTA/);
});
test('RCV00D graph-derived selector exception rejects a mutated selected observation',()=>{
  const e=R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION,receipt=JSON.parse(fs.readFileSync(e.selectorReceiptPath,'utf8'));
  receipt.selected.id='PK1_RELEASE_SECURITY_PHYSICAL';
  const fixture=rcv00dGitFixture({artifactBytesByPath:new Map([[e.selectorReceiptPath,canonicalBytes(receipt)]])});
  assert.throws(()=>verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00D_SELECTED_ITEM_BINDING|E_RCV00D_SELECTOR_RECEIPT/);
});
test('RCV00D graph-derived selector exception rejects a mutated graph scheduler receipt',()=>{
  const e=R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION,receipt=JSON.parse(fs.readFileSync(e.selectorReceiptPath,'utf8'));
  receipt.graphSchedulerCandidate.selectedKind='NODE';
  receipt.graphSchedulerCandidate.selectedId='PK1_RELEASE_SECURITY_PHYSICAL';
  receipt.graphSchedulerCandidate.verdict='SELECTED';
  const fixture=rcv00dGitFixture({artifactBytesByPath:new Map([[e.selectorReceiptPath,canonicalBytes(receipt)]])});
  assert.throws(()=>verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00D_GRAPH_CANDIDATE_BINDING|E_RCV00D_SELECTOR_RECEIPT/);
});
test('RCV00D graph-derived selector exception rejects a mutated selector artifact',()=>{
  const e=R24_RCV00D_GRAPH_DERIVED_SELECTOR_EXPECTATION,mutated=new Map([[e.selectorPath,Buffer.from(`${objectFromCommit(e.deliverySha,e.selectorPath).toString('utf8')}\n// mutated immutable selector artifact\n`)]]);
  const fixture=rcv00dGitFixture({artifactBytesByPath:mutated});
  assert.throws(()=>verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00D_EVIDENCE_ARTIFACT_DIGEST/);
});
test('RCV00D graph-derived selector exception rejects missing evidence artifact',()=>{
  const fixture=rcv00dGitFixture({missingEvidence:true});
  assert.throws(()=>verifyR24Rcv00dGraphDerivedSelectorPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_RCV00D_ARTIFACT_MISSING/);
});
function docxLinebreakGitFixture({changedPaths,artifactBytesByPath=new Map(),baseTree,candidateSha='e'.repeat(40),candidateTree='f'.repeat(40)}={}){
  const e=R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION;
  const currentBytes=(repoPath)=>artifactBytesByPath.get(repoPath)??objectFromCommit(e.deliverySha,repoPath);
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[repoPath,currentBytes(repoPath)]));
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 DOCX line-break source export exception accepts the exact branch delta',()=>{
  const fixture=docxLinebreakGitFixture(),result=verifyR24DocxLinebreakSourceExportPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION.admittedPaths.length);
  assert.equal(result.inventoryDenominator,1461);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
});
test('R24 DOCX line-break source export exception rejects an unadmitted future path',()=>{
  const e=R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION,fixture=docxLinebreakGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24DocxLinebreakSourceExportPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_DOCX_LINEBREAK_EXACT_ADMITTED_DELTA/);
});
test('R24 DOCX line-break source export exception rejects a missing Word break serializer',()=>{
  const e=R24_DOCX_LINEBREAK_SOURCE_EXPORT_EXPECTATION,source=fs.readFileSync(e.sourcePath,'utf8').replaceAll('buildDocxTextRunsXml','buildDocxTextXml').replaceAll('<w:br/>','');
  const fixture=docxLinebreakGitFixture({artifactBytesByPath:new Map([[e.sourcePath,Buffer.from(source)]])});
  assert.throws(()=>verifyR24DocxLinebreakSourceExportPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_DOCX_LINEBREAK_SOURCE_TOKEN/);
});
test('R24 interop 100 Google DOCX import route exception accepts exact denominator delivery delta',()=>{
  const fixture=interop100GitFixture(),result=verifyR24Interop100GoogleDocxImportRoutePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION.admittedPaths.length);
  assert.equal(result.requiredCellDenominator,1120);
  assert.equal(result.passedRequiredCells,0);
  assert.equal(result.percentage,0);
  assert.equal(result.claimVerdict,'NEEDS_MORE_EVIDENCE');
  assert.match(result.claimBindingDigest,/^[0-9a-f]{64}$/);
  assert.match(result.claimLintDigest,/^[0-9a-f]{64}$/);
  assert.match(result.claimLintTestDigest,/^[0-9a-f]{64}$/);
  assert.match(result.governanceDetectorDigest,/^[0-9a-f]{64}$/);
  assert.match(result.governanceDetectorTestDigest,/^[0-9a-f]{64}$/);
  assert.equal(result.googleLocalDocxImportRoute,'INTERNAL_UPLOADED_FILE_REFERENCE_PASS_NON_CELL');
  assert.equal(result.directLocalPathImportTypedBlocker,'GOOGLE_IMPORT_SOURCE_FILE_REFERENCE_REQUIRED');
});
test('R24 interop 100 Google DOCX import route exception rejects an unadmitted future path',()=>{
  const e=R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION,fixture=interop100GitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24Interop100GoogleDocxImportRoutePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_INTEROP100_EXACT_ADMITTED_DELTA/);
});
test('R24 interop 100 Google DOCX import route exception rejects route qualification promoted to cell pass',()=>{
  const e=R24_INTEROP_100_GOOGLE_DOCX_IMPORT_ROUTE_EXPECTATION,ledger=JSON.parse(fs.readFileSync(e.ledgerPath,'utf8'));
  ledger.routeQualificationEvidence[0].countedAsRequiredCellPass=true;
  const fixture=interop100GitFixture({ledgerBytes:canonicalBytes(ledger)});
  assert.throws(()=>verifyR24Interop100GoogleDocxImportRoutePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_INTEROP100_VALIDATION/);
});
function safeHyperlinkGitFixture({changedPaths,ledgerBytes}={}){
  const e=R24_INTEROP_100_SAFE_DOCX_HYPERLINK_PREVIEW_EXPECTATION,candidateSha=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION.baseSha,candidateTree=PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_EXPECTATION.baseTree;
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[
    repoPath,
    repoPath===e.ledgerPath&&ledgerBytes?Buffer.from(ledgerBytes):objectFromCommit(candidateSha,repoPath),
  ]));
  bytesByPath.set(e.denominatorPath,objectFromCommit(candidateSha,e.denominatorPath));
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 interop 100 safe external hyperlink preview exception accepts exact PR1852 delta',()=>{
  const fixture=safeHyperlinkGitFixture(),result=verifyR24Interop100SafeDocxHyperlinkPreviewPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_INTEROP_100_SAFE_DOCX_HYPERLINK_PREVIEW_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,18);
  assert.equal(result.changedPathDenominator,18);
  assert.equal(result.requiredCellDenominator,1120);
  assert.equal(result.passedRequiredCells,0);
  assert.equal(result.safeExternalHyperlinkPreview,'PASS_NON_CELL_WITH_EXPLICIT_LINK_RELATIONSHIP_LOSS');
});
test('R24 interop 100 safe external hyperlink preview exception rejects denominator promotion',()=>{
  const e=R24_INTEROP_100_SAFE_DOCX_HYPERLINK_PREVIEW_EXPECTATION,historicalFixture=safeHyperlinkGitFixture(),ledger=JSON.parse(objectFromCommit(historicalFixture.candidateSha,e.ledgerPath).toString('utf8'));
  const evidence=ledger.implementationContourEvidence.find((item)=>item.id===e.evidenceId);
  evidence.denominatorImpact.passedRequiredCellsAdded=1;
  const fixture=safeHyperlinkGitFixture({ledgerBytes:canonicalBytes(ledger)});
  assert.throws(()=>verifyR24Interop100SafeDocxHyperlinkPreviewPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_INTEROP100_SAFE_LINK_EVIDENCE_IDENTITY/);
});
function u000cPagebreakGitFixture({changedPaths}={}){
  const e=R24_INTEROP_100_U000C_PAGEBREAK_REEXPORT_EXPECTATION,candidateSha='7'.repeat(40),candidateTree='8'.repeat(40);
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[repoPath,objectFromCommit(e.deliverySha,repoPath)]));
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===e.baseSha+'^{tree}')value=e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha+'^{tree}')value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 interop 100 U+000C page-break re-export exception accepts exact PR1857 delta',()=>{
  const fixture=u000cPagebreakGitFixture(),result=verifyR24Interop100U000cPagebreakReexportPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_INTEROP_100_U000C_PAGEBREAK_REEXPORT_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,11);
  assert.equal(result.changedPathDenominator,11);
  assert.equal(result.pageBreakReexport,'STRUCTURAL_W_BR_PAGE_BOUNDARY_ONLY');
  assert.equal(result.supportedDenominatorPromotion,false);
  assert.equal(result.programDone,false);
});
test('R24 interop 100 U+000C page-break re-export exception rejects an unadmitted future path',()=>{
  const e=R24_INTEROP_100_U000C_PAGEBREAK_REEXPORT_EXPECTATION,fixture=u000cPagebreakGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24Interop100U000cPagebreakReexportPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_INTEROP100_U000C_EXACT_ADMITTED_DELTA/);
});
function obsExportDocxCommandBridgeGitFixture({changedPaths,sourceBytes,bundleBytes,unitTestBytes,inventoryBytes,approvalsBytes,postAuditVerifierBytes,postAuditTestBytes,wp708CompatibilityTestBytes,wp708TerminalCarrierTestBytes,wp806CompatibilityTestBytes,wp806TerminalCarrierTestBytes,claimLintBytes,claimLintTestBytes,baseTree,candidateSha='5'.repeat(40),candidateTree='6'.repeat(40)}={}){
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION;
  const deliverySha='3e3703511f0c87e49d7ff87315cae031a77737d6';
  const bytesByPath=new Map([
    [e.sourcePath,sourceBytes??objectFromCommit(deliverySha,e.sourcePath)],
    [e.bundlePath,bundleBytes??objectFromCommit(deliverySha,e.bundlePath)],
    [e.unitTestPath,unitTestBytes??objectFromCommit(deliverySha,e.unitTestPath)],
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliverySha,e.inventoryPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(deliverySha,e.approvalsPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliverySha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliverySha,e.postAuditTestPath)],
    [e.wp708CompatibilityTestPath,wp708CompatibilityTestBytes??objectFromCommit(deliverySha,e.wp708CompatibilityTestPath)],
    [e.wp708TerminalCarrierTestPath,wp708TerminalCarrierTestBytes??objectFromCommit(deliverySha,e.wp708TerminalCarrierTestPath)],
    [e.wp806CompatibilityTestPath,wp806CompatibilityTestBytes??objectFromCommit(deliverySha,e.wp806CompatibilityTestPath)],
    [e.wp806TerminalCarrierTestPath,wp806TerminalCarrierTestBytes??objectFromCommit(deliverySha,e.wp806TerminalCarrierTestPath)],
    [e.claimLintPath,claimLintBytes??objectFromCommit(deliverySha,e.claimLintPath)],
    [e.claimLintTestPath,claimLintTestBytes??objectFromCommit(deliverySha,e.claimLintTestPath)],
  ]);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='rev-list')value=candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 OBS export DOCX command bridge outer-failure exception accepts the exact repair delta',()=>{
  const fixture=obsExportDocxCommandBridgeGitFixture(),result=verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,13);
  assert.equal(result.changedPathDenominator,13);
  assert.equal(result.selectedObservationId,'OBS-EXPORT-DOCX-MIN-COMMAND-BRIDGE-OUTER-FAIL-20260909');
  assert.equal(result.commandBridgeOuterFailure,'FAIL_CLOSED_BEFORE_NESTED_SUCCESS_UNWRAP');
  assert.equal(result.sourceDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.sourceDigest);
  assert.equal(result.bundleDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.bundleDigest);
  assert.equal(result.unitTestDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.unitTestDigest);
  assert.equal(result.wp708CompatibilityTestDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.wp708CompatibilityTestDigest);
  assert.equal(result.wp708TerminalCarrierTestDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.wp708TerminalCarrierTestDigest);
  assert.equal(result.wp806CompatibilityTestDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.wp806CompatibilityTestDigest);
  assert.equal(result.wp806TerminalCarrierTestDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.wp806TerminalCarrierTestDigest);
  assert.equal(result.claimLintDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.claimLintDigest);
  assert.equal(result.claimLintTestDigest,R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION.claimLintTestDigest);
  assert.equal(result.programDone,false);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects an unadmitted future path',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,fixture=obsExportDocxCommandBridgeGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_DELIVERY_CANDIDATE_NOT_FOUND|E_R24_OBS_EXPORT_DOCX_BRIDGE_EXACT_ADMITTED_DELTA/);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects a missing outer bridge guard',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,source=fs.readFileSync(e.sourcePath,'utf8').replace('response.ok === false','response.ok !== true').replace('EXPORT_DOCXMIN_COMMAND_BRIDGE_FAILED','EXPORT_DOCXMIN_BRIDGE_ADVISORY');
  const fixture=obsExportDocxCommandBridgeGitFixture({sourceBytes:Buffer.from(source)});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_ARTIFACT_DIGEST/);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects missing WP806 fallback proof',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,wp806Test=fs.readFileSync(e.wp806CompatibilityTestPath,'utf8').replace('current-tree-fallback','current-tree-advisory');
  const fixture=obsExportDocxCommandBridgeGitFixture({wp806CompatibilityTestBytes:Buffer.from(wp806Test)});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_ARTIFACT_DIGEST/);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects missing WP806 terminal carrier proof',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,wp806TerminalTest=fs.readFileSync(e.wp806TerminalCarrierTestPath,'utf8').replace('mutable current-tree fallback','mutable checkout fallback');
  const fixture=obsExportDocxCommandBridgeGitFixture({wp806TerminalCarrierTestBytes:Buffer.from(wp806TerminalTest)});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_ARTIFACT_DIGEST/);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects missing WP708 fallback proof',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,wp708Test=fs.readFileSync(e.wp708CompatibilityTestPath,'utf8').replace('current-tree-fallback','current-tree-advisory');
  const fixture=obsExportDocxCommandBridgeGitFixture({wp708CompatibilityTestBytes:Buffer.from(wp708Test)});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_ARTIFACT_DIGEST/);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects missing WP708 terminal carrier proof',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,wp708TerminalTest=fs.readFileSync(e.wp708TerminalCarrierTestPath,'utf8').replace('SUCCESSOR_DEPENDENT_CARRIER_SHA_BY_PATH','SUCCESSOR_CARRIER_HINT_BY_PATH');
  const fixture=obsExportDocxCommandBridgeGitFixture({wp708TerminalCarrierTestBytes:Buffer.from(wp708TerminalTest)});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_ARTIFACT_DIGEST/);
});
test('R24 OBS export DOCX command bridge outer-failure exception rejects stale inventory digest',()=>{
  const e=R24_OBS_EXPORT_DOCX_COMMAND_BRIDGE_OUTER_FAIL_EXPECTATION,inventory=JSON.parse(objectFromCommit('3e3703511f0c87e49d7ff87315cae031a77737d6',e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.unitTestPath).sha256='0'.repeat(64);
  const fixture=obsExportDocxCommandBridgeGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24ObsExportDocxCommandBridgeOuterFailPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OBS_EXPORT_DOCX_BRIDGE_INVENTORY_DIGEST/);
});
function importPreviewBookmarkMetadataGitFixture({changedPaths,sourceBytes,contentPreviewTestBytes,importPreviewPlanTestBytes,inventoryBytes,approvalsBytes,postAuditVerifierBytes,postAuditTestBytes,baseTree,candidateSha='7'.repeat(40),candidateTree='8'.repeat(40)}={}){
  const e=R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION;
  const deliverySha=R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION.baseSha;
  const bytesByPath=new Map([
    [e.sourcePath,sourceBytes??objectFromCommit(deliverySha,e.sourcePath)],
    [e.contentPreviewTestPath,contentPreviewTestBytes??objectFromCommit(deliverySha,e.contentPreviewTestPath)],
    [e.importPreviewPlanTestPath,importPreviewPlanTestBytes??objectFromCommit(deliverySha,e.importPreviewPlanTestPath)],
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliverySha,e.inventoryPath)],
    [e.governanceApprovalsPath,approvalsBytes??objectFromCommit(deliverySha,e.governanceApprovalsPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliverySha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliverySha,e.postAuditTestPath)],
  ]);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 import preview bookmark/custom metadata explicit-loss exception accepts the exact PR1867 delta',()=>{
  const fixture=importPreviewBookmarkMetadataGitFixture(),result=verifyR24ImportPreviewBookmarkMetadataExplicitLossPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,8);
  assert.equal(result.changedPathDenominator,8);
  assert.equal(result.importPreviewBookmarkMetadataExplicitLoss,'LOSS_REPORT_ONLY_NO_SILENT_IMPORT');
  assert.equal(result.sourceDigest,R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION.sourceDigest);
  assert.equal(result.contentPreviewTestDigest,R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION.contentPreviewTestDigest);
  assert.equal(result.importPreviewPlanTestDigest,R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION.importPreviewPlanTestDigest);
  assert.equal(result.programDone,false);
});
test('R24 import preview bookmark/custom metadata explicit-loss exception rejects an unadmitted future path',()=>{
  const e=R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION,fixture=importPreviewBookmarkMetadataGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24ImportPreviewBookmarkMetadataExplicitLossPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXACT_ADMITTED_DELTA/);
});
test('R24 import preview bookmark/custom metadata explicit-loss exception rejects missing loss-report token',()=>{
  const e=R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION,importPreviewTest=objectFromCommit(R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION.baseSha,e.importPreviewPlanTestPath).toString('utf8').replace('DOCX_IMPORT_PREVIEW_CUSTOM_METADATA_NOT_IMPORTED','DOCX_IMPORT_PREVIEW_METADATA_ADVISORY');
  const fixture=importPreviewBookmarkMetadataGitFixture({importPreviewPlanTestBytes:Buffer.from(importPreviewTest)});
  assert.throws(()=>verifyR24ImportPreviewBookmarkMetadataExplicitLossPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_IMPORT_PREVIEW_BOOKMARK_METADATA_ARTIFACT_DIGEST/);
});
test('R24 import preview bookmark/custom metadata explicit-loss exception rejects stale inventory digest',()=>{
  const e=R24_IMPORT_PREVIEW_BOOKMARK_METADATA_EXPLICIT_LOSS_EXPECTATION,inventory=JSON.parse(objectFromCommit(R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION.baseSha,e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.importPreviewPlanTestPath).sha256='0'.repeat(64);
  const fixture=importPreviewBookmarkMetadataGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24ImportPreviewBookmarkMetadataExplicitLossPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_IMPORT_PREVIEW_BOOKMARK_METADATA_INVENTORY_SHAPE/);
});
function reviewPreviewCommentTopologyGitFixture({changedPaths,successorChangedPaths,sourceBytes,parserBytes,reviewPreviewTestBytes,modernCommentsTestBytes,inventoryBytes,approvalsBytes,postAuditVerifierBytes,postAuditTestBytes,claimLintBytes,claimLintTestBytes,baseTree,candidateSha='b'.repeat(40),candidateTree='c'.repeat(40),successorSha,successorAncestryShas,successorTree='d'.repeat(40)}={}){
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION;
  const deliverySha=R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION.baseSha;
  const successorChain=successorAncestryShas??(successorSha?[successorSha]:[]);
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const bytesByPath=new Map([
    [e.sourcePath,sourceBytes??objectFromCommit(deliverySha,e.sourcePath)],
    [e.parserPath,parserBytes??objectFromCommit(deliverySha,e.parserPath)],
    [e.reviewPreviewTestPath,reviewPreviewTestBytes??objectFromCommit(deliverySha,e.reviewPreviewTestPath)],
    [e.modernCommentsTestPath,modernCommentsTestBytes??objectFromCommit(deliverySha,e.modernCommentsTestPath)],
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliverySha,e.inventoryPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(deliverySha,e.approvalsPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliverySha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliverySha,e.postAuditTestPath)],
    [e.claimLintPath,claimLintBytes??objectFromCommit(deliverySha,e.claimLintPath)],
    [e.claimLintTestPath,claimLintTestBytes??objectFromCommit(deliverySha,e.claimLintTestPath)],
  ]);
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1));
      const endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 review preview comment topology exception accepts exact PR1869 delta',()=>{
  const fixture=reviewPreviewCommentTopologyGitFixture(),result=verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,10);
  assert.equal(result.changedPathDenominator,10);
  assert.equal(result.commentParentGraph,'PRESERVE_UNAMBIGUOUS_MODERN_PARENT_EDGES_OR_TYPED_UNSUPPORTED');
  assert.equal(result.reviewPreviewTopology,'EXPLICIT_FLAT_PREVIEW_LOSS_DIAGNOSTIC_ONLY');
  assert.equal(result.sourceDigest,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.sourceDigest);
  assert.equal(result.parserDigest,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.parserDigest);
  assert.equal(result.reviewPreviewTestDigest,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.reviewPreviewTestDigest);
  assert.equal(result.modernCommentsTestDigest,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.modernCommentsTestDigest);
  assert.equal(result.claimLintDigest,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.claimLintDigest);
  assert.equal(result.claimLintTestDigest,R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.claimLintTestDigest);
  assert.equal(result.supportedDenominatorPromotion,false);
  assert.equal(result.programDone,false);
});
test('R24 review preview comment topology exception accepts successor heads by selecting the immutable exact PR1869 candidate',()=>{
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION,successorSha='e'.repeat(40);
  const fixture=reviewPreviewCommentTopologyGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'package-lock.json','scripts/ops/r24/plan-state.mjs'].sort()});
  const result=verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
  assert.equal(result.admittedPathDenominator,10);
  assert.equal(result.changedPathDenominator,10);
});
test('R24 review preview comment topology exception scans beyond 64 successor heads',()=>{
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION;
  const successorAncestryShas=Array.from({length:65},(_,index)=>(index+1).toString(16).padStart(40,'0'));
  const fixture=reviewPreviewCommentTopologyGitFixture({successorAncestryShas,successorChangedPaths:[...e.admittedPaths,'package-lock.json','scripts/ops/r24/plan-state.mjs'].sort()});
  const result=verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorAncestryShas.at(-1));
});
test('R24 review preview comment topology exception rejects an unadmitted future path',()=>{
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION,fixture=reviewPreviewCommentTopologyGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_DELIVERY_CANDIDATE_NOT_FOUND|E_R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXACT_ADMITTED_DELTA/);
});
test('R24 review preview comment topology exception rejects missing explicit topology-loss token',()=>{
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION,source=objectFromCommit(R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION.baseSha,e.sourcePath).toString('utf8').replace('DOCX_REVIEW_PREVIEW_SESSION_COMMENT_REPLY_TOPOLOGY_UNSUPPORTED','DOCX_REVIEW_PREVIEW_SESSION_COMMENT_TOPOLOGY_ADVISORY');
  const fixture=reviewPreviewCommentTopologyGitFixture({sourceBytes:Buffer.from(source)});
  assert.throws(()=>verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_ARTIFACT_DIGEST/);
});
test('R24 review preview comment topology exception rejects missing RCV00E claim-lint historical pin',()=>{
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION,claimLint=objectFromCommit(R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION.baseSha,e.claimLintPath).toString('utf8').replace('HISTORICAL_INVENTORY_CLAIM_PINS_V34','HISTORICAL_INVENTORY_CLAIM_PINS_V33');
  const fixture=reviewPreviewCommentTopologyGitFixture({claimLintBytes:Buffer.from(claimLint)});
  assert.throws(()=>verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_ARTIFACT_DIGEST/);
});
test('R24 review preview comment topology exception rejects stale inventory digest',()=>{
  const e=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION,inventory=JSON.parse(objectFromCommit(R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION.baseSha,e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.reviewPreviewTestPath).sha256='0'.repeat(64);
  const fixture=reviewPreviewCommentTopologyGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24ReviewPreviewCommentTopologyPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_INVENTORY_DIGEST/);
});
function embeddedFontAdmissionGitFixture({changedPaths,successorChangedPaths,artifactBytesByPath=new Map(),sourceBytes,inventoryBytes,defaultApprovalsBytes,pk1r1ApprovalsBytes,interopApprovalsBytes,baseTree,candidateSha='cea6f557ddcb2f7f5161d7cf60d46ea841c3513a',candidateTree='d961d3041354d53794104b7e00bbeec8ef122d42',successorSha,successorAncestryShas,successorTree='2'.repeat(40)}={}){
  const e=R24_EMBEDDED_FONT_ADMISSION_EXPECTATION;
  const successorChain=successorAncestryShas??(successorSha?[successorSha]:[]);
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const currentBytes=(repoPath)=>{
    if(artifactBytesByPath.has(repoPath))return artifactBytesByPath.get(repoPath);
    if(repoPath===e.sourcePath&&sourceBytes)return Buffer.from(sourceBytes);
    if(repoPath===e.inventoryPath&&inventoryBytes)return Buffer.from(inventoryBytes);
    if(repoPath===e.defaultApprovalsPath&&defaultApprovalsBytes)return Buffer.from(defaultApprovalsBytes);
    if(repoPath===e.pk1r1ApprovalsPath&&pk1r1ApprovalsBytes)return Buffer.from(pk1r1ApprovalsBytes);
    if(repoPath===e.interopApprovalsPath&&interopApprovalsBytes)return Buffer.from(interopApprovalsBytes);
    return objectFromCommit(candidateSha,repoPath);
  };
  const bytesByPath=new Map(e.admittedPaths.map((repoPath)=>[repoPath,currentBytes(repoPath)]));
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1));
      const endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 embedded font admission exception accepts the exact current delta',()=>{
  const fixture=embeddedFontAdmissionGitFixture(),result=verifyR24EmbeddedFontAdmissionPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_EMBEDDED_FONT_ADMISSION_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,15);
  assert.equal(result.changedPathDenominator,15);
  assert.equal(result.embeddedFontDisposition,'DIAGNOSTICS_AND_EXPLICIT_LOSS_ONLY');
  assert.equal(result.rawFontBinaryQuarantine,true);
  assert.equal(result.fontRenderingPreservationClaim,false);
  assert.equal(result.supportedDenominatorPromotion,false);
  assert(result.nonClaims.includes('NO_FONT_RENDERING_OR_PRESERVATION_CLAIM'));
});
test('R24 embedded font admission exception accepts successor heads by selecting the immutable exact candidate',()=>{
  const e=R24_EMBEDDED_FONT_ADMISSION_EXPECTATION,successorSha='3'.repeat(40);
  const fixture=embeddedFontAdmissionGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'package-lock.json'].sort()});
  const result=verifyR24EmbeddedFontAdmissionPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
  assert.equal(result.admittedPathDenominator,15);
  assert.equal(result.changedPathDenominator,15);
});
test('R24 embedded font admission exception rejects an unadmitted future path',()=>{
  const e=R24_EMBEDDED_FONT_ADMISSION_EXPECTATION,fixture=embeddedFontAdmissionGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24EmbeddedFontAdmissionPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_EMBEDDED_FONT_CANDIDATE_NOT_FOUND|E_R24_EMBEDDED_FONT_EXACT_ADMITTED_DELTA/);
});
test('R24 embedded font admission exception rejects missing diagnostics-loss token',()=>{
  const e=R24_EMBEDDED_FONT_ADMISSION_EXPECTATION,source=objectFromCommit(PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.baseSha,e.sourcePath).toString('utf8').replace('DOCX_IMPORT_PREVIEW_EMBEDDED_FONTS_NOT_IMPORTED','DOCX_IMPORT_PREVIEW_FONT_ADVISORY');
  const fixture=embeddedFontAdmissionGitFixture({sourceBytes:Buffer.from(source)});
  assert.throws(()=>verifyR24EmbeddedFontAdmissionPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_EMBEDDED_FONT_ARTIFACT_DIGEST/);
});
function o01O08SemanticOracleHardeningGitFixture({changedPaths,oracleBytes,physicalCanaryBytes,oracleTestBytes,n4StructuralReturnTestBytes,claimLintBytes,claimLintTestBytes,inventoryBytes,approvalsBytes,postAuditVerifierBytes,postAuditTestBytes,baseTree,candidateSha='4'.repeat(40),candidateTree='5'.repeat(40)}={}){
  const e=R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION;
  const historical = relative => objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha, relative);
  const bytesByPath=new Map([
    [e.inventoryPath,inventoryBytes??historical(e.inventoryPath)],
    [e.approvalsPath,approvalsBytes??historical(e.approvalsPath)],
    [e.oraclePath,oracleBytes??historical(e.oraclePath)],
    [e.physicalCanaryPath,physicalCanaryBytes??historical(e.physicalCanaryPath)],
    [e.oracleTestPath,oracleTestBytes??historical(e.oracleTestPath)],
    [e.n4StructuralReturnTestPath,n4StructuralReturnTestBytes??historical(e.n4StructuralReturnTestPath)],
    [e.claimLintPath,claimLintBytes??historical(e.claimLintPath)],
    [e.claimLintTestPath,claimLintTestBytes??historical(e.claimLintTestPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??historical(e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??historical(e.postAuditTestPath)],
  ]);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='rev-list')value=candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 O01-O08 semantic oracle hardening exception accepts exact current delta',()=>{
  const fixture=o01O08SemanticOracleHardeningGitFixture(),result=verifyR24O01O08SemanticOracleHardeningPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,10);
  assert.equal(result.changedPathDenominator,10);
  assert.ok(result.admittedPaths.includes(R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION.claimLintPath));
  assert.ok(result.admittedPaths.includes(R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION.claimLintTestPath));
  assert.ok(result.admittedPaths.includes(R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION.physicalCanaryPath));
  assert.ok(result.admittedPaths.includes(R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION.n4StructuralReturnTestPath));
  assert.equal(result.semanticOracleHardening,'FAIL_CLOSED_ON_RECORDED_SOURCE_RUNTIME_FALSE_GREEN_MUTANTS');
  assert.equal(result.wordPhysicalRouteClaim,false);
  assert.equal(result.googleNativeRouteClaim,false);
  assert.equal(result.packagedUiRouteClaim,false);
  assert.equal(result.supportedDenominatorPromotion,false);
});
test('R24 O01-O08 semantic oracle hardening exception rejects an unadmitted future path',()=>{
  const e=R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION,fixture=o01O08SemanticOracleHardeningGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24O01O08SemanticOracleHardeningPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_O01_O08_CANDIDATE_NOT_FOUND|E_R24_O01_O08_EXACT_ADMITTED_DELTA/);
});
test('R24 O01-O08 semantic oracle hardening exception rejects missing oracle mismatch token',()=>{
  const e=R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION,oracle=objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha,e.oraclePath).toString('utf8').replace('C5V2_ORACLE_COMMENT_BODY_MISMATCH','C5V2_ORACLE_COMMENT_TEXT_MISSING');
  const approvals=JSON.parse(objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha,e.approvalsPath));
  const oracleDigest=h(Buffer.from(oracle));
  for(const entry of approvals.approvals)if(entry.filePath===e.oraclePath)entry.sha256=oracleDigest;
  const fixture=o01O08SemanticOracleHardeningGitFixture({oracleBytes:Buffer.from(oracle),approvalsBytes:Buffer.from(`${JSON.stringify(approvals,null,2)}\n`)});
  assert.throws(()=>verifyR24O01O08SemanticOracleHardeningPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_O01_O08_ORACLE_TOKEN/);
});
test('R24 O01-O08 semantic oracle hardening exception rejects missing physical canary semantic intent token',()=>{
  const e=R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION,physicalCanary=objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha,e.physicalCanaryPath).toString('utf8').replace('spanType: semanticIntent.spanType','spanType: semanticIntent.formatSpanType');
  const approvals=JSON.parse(objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha,e.approvalsPath));
  const physicalCanaryDigest=h(Buffer.from(physicalCanary));
  for(const entry of approvals.approvals)if(entry.filePath===e.physicalCanaryPath)entry.sha256=physicalCanaryDigest;
  const fixture=o01O08SemanticOracleHardeningGitFixture({physicalCanaryBytes:Buffer.from(physicalCanary),approvalsBytes:Buffer.from(`${JSON.stringify(approvals,null,2)}\n`)});
  assert.throws(()=>verifyR24O01O08SemanticOracleHardeningPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_O01_O08_PHYSICAL_CANARY_TOKEN/);
});
test('R24 O01-O08 semantic oracle hardening exception rejects missing N4 structural-return source contract token',()=>{
  const e=R24_O01_O08_SEMANTIC_ORACLE_HARDENING_EXPECTATION,n4StructuralReturnTest=objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha,e.n4StructuralReturnTestPath).toString('utf8').replace('structuralSemantics:\\s*\\{ kind:\\s*semanticIntent\\.kind','structuralSemantics:\\s*\\{ kind:\\s*operation\\.semanticIntent\\.kind');
  const approvals=JSON.parse(objectFromCommit(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.baseSha,e.approvalsPath));
  const n4StructuralReturnTestDigest=h(Buffer.from(n4StructuralReturnTest));
  for(const entry of approvals.approvals)if(entry.filePath===e.n4StructuralReturnTestPath)entry.sha256=n4StructuralReturnTestDigest;
  const fixture=o01O08SemanticOracleHardeningGitFixture({n4StructuralReturnTestBytes:Buffer.from(n4StructuralReturnTest),approvalsBytes:Buffer.from(`${JSON.stringify(approvals,null,2)}\n`)});
  assert.throws(()=>verifyR24O01O08SemanticOracleHardeningPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_O01_O08_N4_TEST_TOKEN/);
});
function docxNotificationFixture({ changedPaths, baseTree, unrelatedBase = false, successor = false, mutate = () => {} } = {}) {
  const e = R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION, candidate = 'a'.repeat(40), requested = successor ? 'b'.repeat(40) : candidate;
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const files = new Map(e.admittedPaths.map(relative => [relative, fs.readFileSync(relative)]));
  const inventory = JSON.parse(files.get(e.inventoryPath));
  inventory.totals.all = e.inventoryFileDenominator;
  for (const relative of [e.contractPath, 'test/unit/docx-export-notification-outcome.test.js']) {
    inventory.entries = inventory.entries.filter(entry => entry.path !== relative);
    inventory.entries.push({ path: relative, sha256: sha(files.get(relative)), required: true, executionStatus: 'DECLARED_EXECUTABLE' });
  }
  files.set(e.inventoryPath, canonicalBytes(inventory));
  files.set(e.approvalsPath, canonicalBytes({ version: 'v1.0', approvals: e.admittedPaths.filter(relative => relative !== e.approvalsPath).map(filePath => ({ filePath, sha256: sha(files.get(filePath)), approved: true, approvedBy: e.approvedBy })) }));
  mutate(files, e);
  const git = (args, options = {}) => {
    let value;
    if (args[0] === 'rev-parse') {
      const ref = args[1];
      value = ref === `${e.baseSha}^{tree}` ? baseTree ?? e.baseTree : ref.endsWith('^{tree}') ? (ref.startsWith(candidate) ? 'c' : 'd').repeat(40) : ref;
    } else if (args[0] === 'merge-base') { if (unrelatedBase) throw Error('not ancestor'); value = ''; }
    else if (args[0] === 'diff') value = (successor && args.at(-1).endsWith(requested) ? [...e.admittedPaths, 'future.txt'] : changedPaths ?? e.admittedPaths).join('\n');
    else if (args[0] === 'rev-list') value = successor ? candidate : '';
    else if (args[0] === 'show') {
      assert.equal(args[1].split(':')[0], candidate, 'Different-head bytes must never verify a closed candidate');
      const relative = args[1].slice(candidate.length + 1);
      if (!files.has(relative)) throw Error('missing artifact');
      return options.encoding === 'utf8' ? files.get(relative).toString('utf8') : files.get(relative);
    } else throw Error(`Unexpected fixture Git operation: ${args}`);
    return options.encoding === 'utf8' ? `${value}\n` : Buffer.from(`${value}\n`);
  };
  return { e, candidate, requested, git, files };
}
const verifyDocxFixture = (fixture, verify = verifyDocxNotificationOutcomePostEvaluationException) => verify({ candidateSha: fixture.requested, git: fixture.git });

test('DOCX notification admission binds the exact eight-path direct corrective without graph or lease authority', () => {
  const fixture = docxNotificationFixture(), result = verifyDocxFixture(fixture);
  assert.equal(result.status, 'PASS');
  assert.equal(result.admittedPathDenominator, 8);
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.candidateTree, 'c'.repeat(40));
  assert.equal(result.graphSchedulerSelectedId, null);
  assert.equal(result.stageAdmissionAndLease, 'NOT_APPLICABLE_TO_NO_GRAPH_DIRECT_CORRECTIVE');
  assert.equal(Object.keys(result.semanticDigests).length, 3);
  assert.equal(result.generatedOutput.sha256, fixture.e.bundleDigest);
  assert.equal(result.graphIncrement, 0);
  assert.equal(result.productionReleaseReady, false);
});
test('DOCX notification admission separates historical candidate bytes from different-head evidence', () => {
  const fixture = docxNotificationFixture({ successor: true }), result = verifyDocxFixture(fixture);
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.currentCandidateSha, fixture.requested);
  assert.equal(result.currentCandidateTree, 'd'.repeat(40));
  assert.equal(result.closedCandidateOnly, true);
  assert(!result.admittedPaths.includes('future.txt'));
});
for (const [name, options, signal] of [
  ['base tree drift', { baseTree: '0'.repeat(40) }, /E_DOCX_NOTIFICATION_BASE_TREE/],
  ['unrelated base', { unrelatedBase: true }, /E_DOCX_NOTIFICATION_BASE_ANCESTRY/],
  ['missing path', { changedPaths: R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.admittedPaths.slice(1) }, /E_DOCX_NOTIFICATION_EXACT_ADMITTED_DELTA/],
  ['extra path', { changedPaths: [...R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.admittedPaths, 'future.txt'] }, /E_DOCX_NOTIFICATION_EXACT_ADMITTED_DELTA/],
]) test(`DOCX notification admission rejects ${name}`, () => assert.throws(() => verifyDocxFixture(docxNotificationFixture(options)), signal));
for (const relative of [...Object.keys(R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.semanticDigests), R24_DOCX_NOTIFICATION_OUTCOME_EXPECTATION.bundlePath]) {
  test(`DOCX notification admission rejects mutated or stale ${relative}`, () => {
    const fixture = docxNotificationFixture({ mutate: files => files.set(relative, Buffer.concat([files.get(relative), Buffer.from('\n// mutated\n')])) });
    assert.throws(() => verifyDocxFixture(fixture), /E_DOCX_NOTIFICATION_ARTIFACT_DIGEST/);
  });
}
for (const [name, mutate, signal] of [
  ['missing artifact', (files, e) => files.delete(e.bundlePath), /E_DOCX_NOTIFICATION_ARTIFACT_MISSING/],
  ['wrong inventory', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.totals.all = 0; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_DOCX_NOTIFICATION_INVENTORY/],
  ['stale inventory test binding', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(entry => entry.path === e.contractPath).sha256 = '0'.repeat(64); files.set(e.inventoryPath, canonicalBytes(value)); }, /E_DOCX_NOTIFICATION_INVENTORY_DIGEST/],
  ['test requirement downgrade', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(entry => entry.path === e.contractPath).required = false; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_DOCX_NOTIFICATION_INVENTORY_DIGEST/],
  ['stale approvals', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals[0].sha256 = '0'.repeat(64); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_DOCX_NOTIFICATION_APPROVAL_DIGEST/],
  ['foreign authority', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals.forEach(entry => { entry.approvedBy = 'not-authority'; }); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_DOCX_NOTIFICATION_APPROVAL_DIGEST/],
]) test(`DOCX notification admission rejects ${name}`, () => assert.throws(() => verifyDocxFixture(docxNotificationFixture({ mutate })), signal));

function currentClosureSelectorFixture({ changedPaths, baseTree, unrelatedBase = false, successor = false, mutate = () => {} } = {}) {
  const e = R24_CURRENT_CLOSURE_SELECTOR_EXPECTATION;
  const candidate = 'c'.repeat(40), requested = successor ? 'd'.repeat(40) : candidate;
  const files = new Map(e.admittedPaths.map(relative => [relative, objectFromCommit('442bdbef6a153b14fec5c2d354bccd8f97a62809', relative)]));
  const inventory = JSON.parse(files.get(e.inventoryPath));
  for (const relative of [e.selectorTestPath, e.contractPath]) {
    const entry = inventory.entries.find(item => item.path === relative);
    Object.assign(entry, { sha256: h(files.get(relative)), required: true, executionStatus: 'DECLARED_EXECUTABLE' });
  }
  files.set(e.inventoryPath, canonicalBytes(inventory));
  const approvals = JSON.parse(files.get(e.approvalsPath));
  approvals.approvals = e.admittedPaths.filter(relative => relative !== e.approvalsPath).map(relative => ({
    filePath: relative, sha256: h(files.get(relative)), approved: true, approvedBy: e.approvedBy,
  }));
  files.set(e.approvalsPath, canonicalBytes(approvals));
  mutate(files, e);
  const git = (args, options = {}) => {
    let value = '';
    if (args[0] === 'rev-parse' && args[1] === `${e.baseSha}^{tree}`) value = baseTree ?? e.baseTree;
    else if (args[0] === 'rev-parse' && args[1] === `${candidate}^{tree}`) value = 'e'.repeat(40);
    else if (args[0] === 'rev-parse' && args[1] === `${requested}^{tree}`) value = 'f'.repeat(40);
    else if (args[0] === 'rev-parse') value = args[1];
    else if (args[0] === 'merge-base') { if (unrelatedBase) throw new Error('NOT_ANCESTOR'); }
    else if (args[0] === 'rev-list') value = candidate;
    else if (args[0] === 'diff') value = (successor && args.at(-1).endsWith(requested)
      ? [...e.admittedPaths, 'future.txt'] : changedPaths ?? e.admittedPaths).join('\n');
    else if (args[0] === 'show') {
      const bytes = files.get(args[1].slice(args[1].indexOf(':') + 1));
      if (!bytes) throw new Error('MISSING_FIXTURE_ARTIFACT');
      return options.encoding === 'utf8' ? bytes.toString('utf8') : Buffer.from(bytes);
    } else throw new Error(`UNEXPECTED_FIXTURE_GIT:${args[0]}`);
    return options.encoding === 'utf8' ? value + '\n' : Buffer.from(value + '\n');
  };
  return { candidate, requested, git };
}
const verifyCurrentSelectorFixture = fixture => verifyCurrentClosureSelectorPostEvaluationException({ candidateSha: fixture.requested, git: fixture.git });
test('Current closure selector admission accepts only the exact seven-path correction', () => {
  const fixture = currentClosureSelectorFixture(), result = verifyCurrentSelectorFixture(fixture);
  assert.equal(result.admittedPathDenominator, 7);
  assert.equal(result.candidateSha, fixture.requested);
  assert.equal(result.mutationAllowed, false);
  assert.equal(result.programDone, false);
});
test('Current closure selector admission preserves distinct closed candidate and different current head', () => {
  const fixture = currentClosureSelectorFixture({ successor: true }), result = verifyCurrentSelectorFixture(fixture);
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.currentCandidateSha, fixture.requested);
  assert.equal(result.closedCandidateOnly, true);
  assert(!result.admittedPaths.includes('future.txt'));
});
for (const [name, options, signal] of [
  ['base tree', { baseTree: '0'.repeat(40) }, /E_CURRENT_SELECTOR_BASE_TREE/],
  ['base ancestry', { unrelatedBase: true }, /E_CURRENT_SELECTOR_BASE_ANCESTRY/],
  ['missing path', { changedPaths: R24_CURRENT_CLOSURE_SELECTOR_EXPECTATION.admittedPaths.slice(1) }, /E_CURRENT_SELECTOR_EXACT_ADMITTED_DELTA/],
  ['extra path', { changedPaths: [...R24_CURRENT_CLOSURE_SELECTOR_EXPECTATION.admittedPaths, 'future.txt'] }, /E_CURRENT_SELECTOR_EXACT_ADMITTED_DELTA/],
]) test(`Current closure selector admission rejects ${name}`, () => assert.throws(() => verifyCurrentSelectorFixture(currentClosureSelectorFixture(options)), signal));
for (const relative of Object.keys(R24_CURRENT_CLOSURE_SELECTOR_EXPECTATION.semanticDigests)) {
  test(`Current closure selector admission rejects changed ${relative}`, () => {
    const fixture = currentClosureSelectorFixture({ mutate: files => files.set(relative, Buffer.concat([files.get(relative), Buffer.from('\n')])) });
    assert.throws(() => verifyCurrentSelectorFixture(fixture), /E_CURRENT_SELECTOR_ARTIFACT_DIGEST/);
  });
}
for (const [name, mutate, signal] of [
  ['missing artifact', (files, e) => files.delete(e.selectorTestPath), /E_CURRENT_SELECTOR_ARTIFACT_MISSING/],
  ['wrong denominator', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.totals.all = 0; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_CURRENT_SELECTOR_INVENTORY/],
  ['stale test binding', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(row => row.path === e.selectorTestPath).sha256 = '0'.repeat(64); files.set(e.inventoryPath, canonicalBytes(value)); }, /E_CURRENT_SELECTOR_INVENTORY_DIGEST/],
  ['optional test downgrade', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(row => row.path === e.selectorTestPath).required = false; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_CURRENT_SELECTOR_INVENTORY_DIGEST/],
  ['stale approval', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals[0].sha256 = '0'.repeat(64); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_CURRENT_SELECTOR_APPROVAL_DIGEST/],
  ['foreign authority', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals.forEach(row => { row.approvedBy = 'NOT_AUTHORITY'; }); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_CURRENT_SELECTOR_APPROVAL_DIGEST/],
]) test(`Current closure selector admission rejects ${name}`, () => assert.throws(() => verifyCurrentSelectorFixture(currentClosureSelectorFixture({ mutate })), signal));

function ePlanPredecessorFixture({ changedPaths, baseTree, unrelatedBase = false, successor = false, mutate = () => {} } = {}) {
  const e = R24_E_PLAN_PREDECESSOR_EXPECTATION;
  const candidate = 'c'.repeat(40), requested = successor ? 'd'.repeat(40) : candidate;
  const files = new Map(e.admittedPaths.map(relative => [relative, objectFromCommit('69dc3872cc4cc0f46bc450cc4f89ddf8da44ecb6', relative)]));
  const inventory = JSON.parse(files.get(e.inventoryPath));
  for (const relative of e.testPaths) {
    const entry = inventory.entries.find(item => item.path === relative);
    Object.assign(entry, { sha256: h(files.get(relative)), required: true, executionStatus: 'DECLARED_EXECUTABLE' });
  }
  files.set(e.inventoryPath, canonicalBytes(inventory));
  const approvals = JSON.parse(files.get(e.approvalsPath));
  approvals.approvals = e.admittedPaths.filter(relative => relative !== e.approvalsPath).map(relative => ({
    filePath: relative, sha256: h(files.get(relative)), approved: true, approvedBy: e.approvedBy,
  }));
  files.set(e.approvalsPath, canonicalBytes(approvals));
  mutate(files, e);
  const git = (args, options = {}) => {
    let value = '';
    if (args[0] === 'rev-parse' && args[1] === `${e.baseSha}^{tree}`) value = baseTree ?? e.baseTree;
    else if (args[0] === 'rev-parse' && args[1] === `${candidate}^{tree}`) value = 'e'.repeat(40);
    else if (args[0] === 'rev-parse' && args[1] === `${requested}^{tree}`) value = 'f'.repeat(40);
    else if (args[0] === 'rev-parse') value = args[1];
    else if (args[0] === 'merge-base') { if (unrelatedBase) throw new Error('NOT_ANCESTOR'); }
    else if (args[0] === 'rev-list') value = candidate;
    else if (args[0] === 'diff') value = (successor && args.at(-1).endsWith(requested)
      ? [...e.admittedPaths, 'future.txt'] : changedPaths ?? e.admittedPaths).join('\n');
    else if (args[0] === 'show') {
      const bytes = files.get(args[1].slice(args[1].indexOf(':') + 1));
      if (!bytes) throw new Error('MISSING_FIXTURE_ARTIFACT');
      return options.encoding === 'utf8' ? bytes.toString('utf8') : Buffer.from(bytes);
    } else throw new Error(`UNEXPECTED_FIXTURE_GIT:${args[0]}`);
    return options.encoding === 'utf8' ? value + '\n' : Buffer.from(value + '\n');
  };
  return { candidate, requested, git };
}
const verifyEPlanFixture = fixture => verifyEPlanPredecessorPostEvaluationException({ candidateSha: fixture.requested, git: fixture.git });
function fSubstrateFixture({ changedPaths, baseTree, unrelatedBase = false, successor = false, successorPaths = ['future.txt'], mutate = () => {}, mutateCurrent = () => {} } = {}) {
  const e = R24_F_SUBSTRATE_EXPECTATION, candidate = 'c'.repeat(40), requested = successor ? 'd'.repeat(40) : candidate;
  const files = new Map(e.admittedPaths.map(relative => [relative, objectFromCommit('b14e38bc83a05c1bb4e8e6a7c0c341e532fd0c9e', relative)]));
  const inventory = JSON.parse(files.get(e.inventoryPath));
  for (const relative of e.testPaths) Object.assign(inventory.entries.find(row => row.path === relative), {
    sha256: h(files.get(relative)), required: true, executionStatus: 'DECLARED_EXECUTABLE',
  });
  files.set(e.inventoryPath, canonicalBytes(inventory));
  const approvals = JSON.parse(files.get(e.approvalsPath));
  approvals.approvals = e.admittedPaths.filter(relative => relative !== e.approvalsPath).map(relative => ({
    filePath: relative, sha256: h(files.get(relative)), approved: true, approvedBy: e.approvedBy,
  }));
  files.set(e.approvalsPath, canonicalBytes(approvals));
  const secondary = JSON.parse(files.get(e.interopApprovalsPath));
  for (const row of secondary.approvals) if ([e.inventoryPath, 'scripts/ops/r24/corrective/post-audit-certification-set.mjs', 'test/contracts/r24-post-audit-certification-set.contract.test.mjs'].includes(row.filePath)) {
    Object.assign(row, { sha256: h(files.get(row.filePath)), approved: true, approvedBy: e.approvedBy });
  }
  files.set(e.interopApprovalsPath, canonicalBytes(secondary));
  mutate(files, e);
  const currentFiles = new Map([...files].map(([relative, bytes]) => [relative, Buffer.from(bytes)]));
  mutateCurrent(currentFiles, e);
  const git = (args, options = {}) => {
    let value = '';
    if (args[0] === 'rev-parse' && args[1] === `${e.baseSha}^{tree}`) value = baseTree ?? e.baseTree;
    else if (args[0] === 'rev-parse' && args[1] === `${candidate}^{tree}`) value = 'e'.repeat(40);
    else if (args[0] === 'rev-parse' && args[1] === `${requested}^{tree}`) value = 'f'.repeat(40);
    else if (args[0] === 'rev-parse') value = args[1];
    else if (args[0] === 'merge-base') { if (unrelatedBase) throw new Error('NOT_ANCESTOR'); }
    else if (args[0] === 'rev-list') value = candidate;
    else if (args[0] === 'diff') value = (successor && args.at(-1) === `${candidate}..${requested}` ? successorPaths
      : successor && args.at(-1).endsWith(requested) ? [...new Set([...e.admittedPaths, ...successorPaths])].sort()
      : changedPaths ?? e.admittedPaths).join('\n');
    else if (args[0] === 'show' && args[1] === `${e.baseSha}:${e.interopApprovalsPath}`) return objectFromCommit(e.baseSha, e.interopApprovalsPath);
    else if (args[0] === 'show') {
      const separator = args[1].indexOf(':'), ref = args[1].slice(0, separator);
      const bytes = (successor && ref === requested ? currentFiles : files).get(args[1].slice(separator + 1));
      if (!bytes) throw new Error('MISSING_FIXTURE_ARTIFACT');
      return options.encoding === 'utf8' ? bytes.toString('utf8') : Buffer.from(bytes);
    } else throw new Error(`UNEXPECTED_FIXTURE_GIT:${args[0]}`);
    return options.encoding === 'utf8' ? value + '\n' : Buffer.from(value + '\n');
  };
  return { candidate, requested, git };
}
const verifyFSubstrateFixture = fixture => verifyFSubstratePostEvaluationException({ candidateSha: fixture.requested, git: fixture.git });
test('F substrate admission verifies exact delta without F closure or mutation credit', () => {
  const fixture = fSubstrateFixture(), result = verifyFSubstrateFixture(fixture);
  assert.equal(result.admittedPathDenominator, 10);
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.planPredecessorCredit, false);
  assert.equal(result.mutationAllowed, false);
  assert.equal(result.programDone, false);
  assert.equal(result.missingAcceptance.length, 2);
});
test('F substrate admission separates immutable evidence from a different current head', () => {
  const fixture = fSubstrateFixture({ successor: true }), result = verifyFSubstrateFixture(fixture);
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.currentCandidateSha, fixture.requested);
  assert.equal(result.closedCandidateOnly, true);
  assert(!result.admittedPaths.includes('future.txt'));
});
test('F substrate admission keeps historical B when metadata C rebinds the current ledger registry', t => {
  const e = R24_F_SUBSTRATE_EXPECTATION;
  const ledgerPath = 'docs/OPS/RTK/YALKEN_INTEROP_100_EVIDENCE_LEDGER_V1.json';
  const successorPaths = [ledgerPath, e.interopApprovalsPath].sort();
  const currentRegistry = JSON.parse(objectFromCommit('b14e38bc83a05c1bb4e8e6a7c0c341e532fd0c9e', e.interopApprovalsPath));
  currentRegistry.approvals.find(row => row.filePath === ledgerPath).sha256 = '0'.repeat(64);
  const currentBytes = canonicalBytes(currentRegistry), originalRead = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', function (relative, ...args) {
    return relative === e.interopApprovalsPath ? currentBytes : originalRead.call(this, relative, ...args);
  });
  const fixture = fSubstrateFixture({ successor: true, successorPaths, mutateCurrent: files => files.set(e.interopApprovalsPath, currentBytes) });
  assert.deepEqual(fixture.git(['show', `${fixture.requested}:${e.interopApprovalsPath}`]), currentBytes);
  assert.notDeepEqual(fixture.git(['show', `${fixture.candidate}:${e.interopApprovalsPath}`]), currentBytes);
  assert.deepEqual(fixture.git(['diff', '--name-only', `${fixture.candidate}..${fixture.requested}`], { encoding: 'utf8' }).trim().split('\n'), successorPaths);
  const result = verifyFSubstrateFixture(fixture);
  assert.equal(result.status, 'PASS');
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.currentCandidateSha, fixture.requested);
  assert.equal(result.closedCandidateOnly, true);
  assert.equal(result.mutationAllowed, false);
  assert.equal(result.planPredecessorCredit, false);
  assert(!result.admittedPaths.includes(ledgerPath));
});
for (const [name, options, signal] of [
  ['base tree', { baseTree: '0'.repeat(40) }, /E_F_SUBSTRATE_BASE_TREE/],
  ['base ancestry', { unrelatedBase: true }, /E_F_SUBSTRATE_BASE_ANCESTRY/],
  ['missing path', { changedPaths: R24_F_SUBSTRATE_EXPECTATION.admittedPaths.slice(1) }, /E_F_SUBSTRATE_EXACT_ADMITTED_DELTA/],
  ['extra path', { changedPaths: [...R24_F_SUBSTRATE_EXPECTATION.admittedPaths, 'future.txt'] }, /E_F_SUBSTRATE_EXACT_ADMITTED_DELTA/],
]) test(`F substrate admission rejects ${name}`, () => assert.throws(() => verifyFSubstrateFixture(fSubstrateFixture(options)), signal));
for (const relative of Object.keys(R24_F_SUBSTRATE_EXPECTATION.semanticDigests)) {
  test(`F substrate admission rejects changed ${relative}`, () => assert.throws(() => verifyFSubstrateFixture(fSubstrateFixture({
    mutate: files => files.set(relative, Buffer.concat([files.get(relative), Buffer.from('\n')])),
  })), /E_F_SUBSTRATE_ARTIFACT_DIGEST/));
}
for (const [name, mutate, signal] of [
  ['missing artifact', (files, e) => files.delete(e.testPaths[0]), /E_F_SUBSTRATE_ARTIFACT_MISSING/],
  ['wrong inventory', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.totals.all = 0; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_F_SUBSTRATE_INVENTORY/],
  ['stale inventory binding', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(row => row.path === e.testPaths[0]).sha256 = '0'.repeat(64); files.set(e.inventoryPath, canonicalBytes(value)); }, /E_F_SUBSTRATE_INVENTORY_BINDING/],
  ['foreign approval', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals.forEach(row => { row.approvedBy = 'NOT_AUTHORITY'; }); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_F_SUBSTRATE_APPROVAL_BINDING/],
]) test(`F substrate admission rejects ${name}`, () => assert.throws(() => verifyFSubstrateFixture(fSubstrateFixture({ mutate })), signal));
for (const [name, change, signal] of [
  ['secondary stale hash', (registry, e) => { registry.approvals.find(row => row.filePath === e.inventoryPath).sha256 = '0'.repeat(64); }, /E_F_SUBSTRATE_SECONDARY_BINDING/],
  ['secondary historical ledger rewrite', registry => { registry.approvals.find(row => row.filePath.endsWith('YALKEN_INTEROP_100_EVIDENCE_LEDGER_V1.json')).sha256 = '0'.repeat(64); }, /E_F_SUBSTRATE_SECONDARY_PRESERVATION/],
]) test(`F substrate admission rejects ${name}`, () => assert.throws(() => verifyFSubstrateFixture(fSubstrateFixture({ mutate: (files, e) => {
  const registry = JSON.parse(files.get(e.interopApprovalsPath)); change(registry, e); files.set(e.interopApprovalsPath, canonicalBytes(registry));
} })), signal));
test('E plan predecessor admission accepts only the exact nine-path correction', () => {
  const fixture = ePlanPredecessorFixture(), result = verifyEPlanFixture(fixture);
  assert.equal(result.admittedPathDenominator, 9);
  assert.equal(result.candidateSha, fixture.requested);
  assert.equal(result.mutationAllowed, false);
  assert.equal(result.programDone, false);
});
test('E plan predecessor admission preserves distinct closed candidate and different current head', () => {
  const fixture = ePlanPredecessorFixture({ successor: true }), result = verifyEPlanFixture(fixture);
  assert.equal(result.candidateSha, fixture.candidate);
  assert.equal(result.currentCandidateSha, fixture.requested);
  assert.equal(result.closedCandidateOnly, true);
  assert(!result.admittedPaths.includes('future.txt'));
});
for (const [name, options, signal] of [
  ['base tree', { baseTree: '0'.repeat(40) }, /E_PLAN_PREDECESSOR_BASE_TREE/],
  ['base ancestry', { unrelatedBase: true }, /E_PLAN_PREDECESSOR_BASE_ANCESTRY/],
  ['missing path', { changedPaths: R24_E_PLAN_PREDECESSOR_EXPECTATION.admittedPaths.slice(1) }, /E_PLAN_PREDECESSOR_EXACT_ADMITTED_DELTA/],
  ['extra path', { changedPaths: [...R24_E_PLAN_PREDECESSOR_EXPECTATION.admittedPaths, 'future.txt'] }, /E_PLAN_PREDECESSOR_EXACT_ADMITTED_DELTA/],
]) test(`E plan predecessor admission rejects ${name}`, () => assert.throws(() => verifyEPlanFixture(ePlanPredecessorFixture(options)), signal));
for (const relative of Object.keys(R24_E_PLAN_PREDECESSOR_EXPECTATION.semanticDigests)) {
  test(`E plan predecessor admission rejects changed ${relative}`, () => {
    const fixture = ePlanPredecessorFixture({ mutate: files => files.set(relative, Buffer.concat([files.get(relative), Buffer.from('\n')])) });
    assert.throws(() => verifyEPlanFixture(fixture), /E_PLAN_PREDECESSOR_ARTIFACT_DIGEST/);
  });
}
for (const [name, mutate, signal] of [
  ['missing artifact', (files, e) => files.delete(e.selectorTestPath), /E_PLAN_PREDECESSOR_ARTIFACT_MISSING/],
  ['wrong denominator', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.totals.all = 0; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_PLAN_PREDECESSOR_INVENTORY/],
  ['stale test binding', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(row => row.path === e.selectorTestPath).sha256 = '0'.repeat(64); files.set(e.inventoryPath, canonicalBytes(value)); }, /E_PLAN_PREDECESSOR_INVENTORY_DIGEST/],
  ['optional test downgrade', (files, e) => { const value = JSON.parse(files.get(e.inventoryPath)); value.entries.find(row => row.path === e.selectorTestPath).required = false; files.set(e.inventoryPath, canonicalBytes(value)); }, /E_PLAN_PREDECESSOR_INVENTORY_DIGEST/],
  ['stale approval', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals[0].sha256 = '0'.repeat(64); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_PLAN_PREDECESSOR_APPROVAL_DIGEST/],
  ['foreign authority', (files, e) => { const value = JSON.parse(files.get(e.approvalsPath)); value.approvals.forEach(row => { row.approvedBy = 'NOT_AUTHORITY'; }); files.set(e.approvalsPath, canonicalBytes(value)); }, /E_PLAN_PREDECESSOR_APPROVAL_DIGEST/],
]) test(`E plan predecessor admission rejects ${name}`, () => assert.throws(() => verifyEPlanFixture(ePlanPredecessorFixture({ mutate })), signal));

function x01IdempotentFixture({ changedPaths, baseTree, mutate = () => {} } = {}) {
  const e = R24_X01_IDEMPOTENT_CONTRACT_RECOVERY_EXPECTATION, candidate = 'c'.repeat(40), candidateTree = 'd'.repeat(40);
  const files = new Map(e.admittedPaths.map(relative => [relative, objectFromCommit(R24_CURRENT_CLOSURE_SELECTOR_EXPECTATION.baseSha, relative)]));
  mutate(files, e);
  const inventory = JSON.parse(files.get(e.inventoryPath));
  for (const relative of [e.contractPath, e.postAuditTestPath]) {
    const entry = inventory.entries.find(item => item.path === relative);
    entry.sha256 = h(files.get(relative));
    entry.required = true;
    entry.executionStatus = 'DECLARED_EXECUTABLE';
  }
  files.set(e.inventoryPath, canonicalBytes(inventory));
  const approvals = JSON.parse(files.get(e.approvalsPath));
  for (const relative of e.admittedPaths.filter(item => item !== e.approvalsPath)) {
    const digest = h(files.get(relative));
    const existing = approvals.approvals.find(entry => entry.filePath === relative);
    const approval = {
      filePath: relative,
      sha256: digest,
      approvedBy: e.approvedBy,
      approvedAtUtc: '2026-09-12T08:55:00.000Z',
      approved: true,
      rationale: 'Bounded X01 idempotent contract recovery fixture admission; no product runtime, Word or Google route, denominator completion or program-done claim.',
    };
    if (existing) Object.assign(existing, approval);
    else approvals.approvals.push(approval);
  }
  files.set(e.approvalsPath, canonicalBytes(approvals));
  return { candidate, git: (args, options = {}) => {
    let value = '';
    if (args[0] === 'rev-parse' && args[1] === candidate) value = candidate;
    else if (args[0] === 'rev-parse' && args[1] === `${e.baseSha}^{tree}`) value = baseTree ?? e.baseTree;
    else if (args[0] === 'rev-parse' && args[1] === `${candidate}^{tree}`) value = candidateTree;
    else if (args[0] === 'merge-base') value = '';
    else if (args[0] === 'rev-list') value = `${candidate}\n`;
    else if (args[0] === 'diff') value = (changedPaths ?? e.admittedPaths).join('\n') + '\n';
    else if (args[0] === 'show') {
      const repoPath = String(args[1]).slice(String(args[1]).indexOf(':') + 1);
      const bytes = files.get(repoPath);
      if (bytes) return options.encoding === 'utf8' ? bytes.toString('utf8') : Buffer.from(bytes);
      return execFileSync('git', args, options);
    } else return execFileSync('git', args, options);
    return options.encoding === 'utf8' ? `${value}\n` : Buffer.from(`${value}\n`);
  } };
}
test('R24 X01 idempotent contract recovery exception accepts the exact recovery delta', () => {
  const fixture = x01IdempotentFixture(), result = verifyR24X01IdempotentContractRecoveryPostEvaluationException({ candidateSha: fixture.candidate, git: fixture.git });
  assert.equal(result.status, 'PASS');
  assert.equal(result.baseSha, R24_X01_IDEMPOTENT_CONTRACT_RECOVERY_EXPECTATION.baseSha);
  assert.equal(result.admittedPathDenominator, R24_X01_IDEMPOTENT_CONTRACT_RECOVERY_EXPECTATION.admittedPaths.length);
  assert.equal(result.productRuntimeChange, false);
  assert.equal(result.wordOrGoogleFidelityClaim, false);
});
test('R24 X01 idempotent contract recovery exception rejects an unadmitted future path', () => {
  const e = R24_X01_IDEMPOTENT_CONTRACT_RECOVERY_EXPECTATION, fixture = x01IdempotentFixture({ changedPaths: [...e.admittedPaths, 'README.md'].sort() });
  assert.throws(() => verifyR24X01IdempotentContractRecoveryPostEvaluationException({ candidateSha: fixture.candidate, git: fixture.git }), /E_R24_X01_IDEMPOTENT_EXACT_ADMITTED_DELTA/);
});
test('R24 X01 idempotent contract recovery exception rejects missing explicit eventId evidence', () => {
  const e = R24_X01_IDEMPOTENT_CONTRACT_RECOVERY_EXPECTATION, fixture = x01IdempotentFixture({ mutate: files => files.set(e.contractPath, Buffer.from(files.get(e.contractPath).toString('utf8').replace("eventId: 'event-1',", "eventKey: 'event-1',"))) });
  assert.throws(() => verifyR24X01IdempotentContractRecoveryPostEvaluationException({ candidateSha: fixture.candidate, git: fixture.git }), /E_R24_X01_IDEMPOTENT_CONTRACT_TOKEN/);
});

function rcv00eLeaseFencingCasGitFixture({changedPaths,inventoryBytes,approvalsBytes,evidenceBytes,verifierBytes,canonicalJsonBytes,leaseBytes,mutantBytes,canonicalJsonTestBytes,leaseTestBytes,planStateTestBytes,contractTestBytes,postAuditVerifierBytes,postAuditTestBytes,baseTree,candidateSha='9'.repeat(40),candidateTree='a'.repeat(40)}={}){
  const e=R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION;
  const deliverySha=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.baseSha;
  const bytesByPath=new Map([
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliverySha,e.inventoryPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(deliverySha,e.approvalsPath)],
    [e.evidencePath,evidenceBytes??objectFromCommit(deliverySha,e.evidencePath)],
    [e.verifierPath,verifierBytes??objectFromCommit(deliverySha,e.verifierPath)],
    [e.canonicalJsonPath,canonicalJsonBytes??objectFromCommit(deliverySha,e.canonicalJsonPath)],
    [e.leasePath,leaseBytes??objectFromCommit(deliverySha,e.leasePath)],
    [e.mutantPath,mutantBytes??objectFromCommit(deliverySha,e.mutantPath)],
    [e.canonicalJsonTestPath,canonicalJsonTestBytes??objectFromCommit(deliverySha,e.canonicalJsonTestPath)],
    [e.leaseTestPath,leaseTestBytes??objectFromCommit(deliverySha,e.leaseTestPath)],
    [e.planStateTestPath,planStateTestBytes??objectFromCommit(deliverySha,e.planStateTestPath)],
    [e.contractTestPath,contractTestBytes??objectFromCommit(deliverySha,e.contractTestPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliverySha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliverySha,e.postAuditTestPath)],
  ]);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff')value=(changedPaths??e.admittedPaths).join('\n')+'\n';
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 RCV00E lease fencing CAS exception accepts the exact repair delta',()=>{
  const fixture=rcv00eLeaseFencingCasGitFixture(),result=verifyR24Rcv00eLeaseFencingCasPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,13);
  assert.equal(result.changedPathDenominator,13);
  assert.equal(result.inventoryDigest.length,64);
  assert.equal(result.negativeProbeDenominator,10);
  assert.equal(result.mutantDenominator,40);
  assert.equal(result.leaseReleaseVerification,'DONE_TRANSITION_DIGEST_AND_HEAD_BOUND');
  assert.equal(result.casFencePolicy,'HEARTBEAT_AND_RELEASE_REQUIRE_GLOBAL_FENCE');
  assert.equal(result.windowsDirectoryFsyncPolicy,'UNSUPPORTED_EPERM_ONLY_FILE_FSYNC_REQUIRED');
  assert.equal(result.programDone,false);
});
test('R24 RCV00E lease fencing CAS exception rejects an unadmitted future path',()=>{
  const e=R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION,fixture=rcv00eLeaseFencingCasGitFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyR24Rcv00eLeaseFencingCasPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00E_EXACT_ADMITTED_DELTA/);
});
test('R24 RCV00E lease fencing CAS exception rejects missing release verification guard',()=>{
  const e=R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION,deliverySha=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.baseSha,leaseText=objectFromCommit(deliverySha,e.leasePath).toString('utf8').replace('E_DELIVERY_VERIFICATION_DIGEST_MISMATCH','E_DELIVERY_DIGEST_ADVISORY'),leaseBytes=Buffer.from(leaseText);
  const evidence=JSON.parse(objectFromCommit(deliverySha,e.evidencePath).toString('utf8'));
  evidence.implementationArtifactDigests.find((entry)=>entry.path===e.leasePath).sha256=h(leaseBytes);
  const evidenceBytes=canonicalBytes(evidence);
  const approvals=JSON.parse(objectFromCommit(deliverySha,e.approvalsPath).toString('utf8'));
  approvals.approvals.push({filePath:e.leasePath,sha256:h(leaseBytes),approvedBy:e.approvedBy,approvedAtUtc:'2026-09-10T00:00:00.000Z',rationale:'Synthetic hostile approval lets this contract reach source-token validation for the mutated lease artifact.',approved:true});
  approvals.approvals.push({filePath:e.evidencePath,sha256:h(evidenceBytes),approvedBy:e.approvedBy,approvedAtUtc:'2026-09-10T00:00:00.000Z',rationale:'Synthetic hostile approval lets this contract reach source-token validation for the mutated evidence artifact.',approved:true});
  const fixture=rcv00eLeaseFencingCasGitFixture({leaseBytes,evidenceBytes,approvalsBytes:canonicalBytes(approvals)});
  assert.throws(()=>verifyR24Rcv00eLeaseFencingCasPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00E_LEASE_TOKEN/);
});
test('R24 RCV00E lease fencing CAS exception rejects missing Windows directory fsync guard',()=>{
  const e=R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION,deliverySha=R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.baseSha,canonicalJsonText=objectFromCommit(deliverySha,e.canonicalJsonPath).toString('utf8').replace("platform === 'win32'","platform === 'darwin'"),canonicalJsonBytes=Buffer.from(canonicalJsonText);
  const evidence=JSON.parse(objectFromCommit(deliverySha,e.evidencePath).toString('utf8'));
  evidence.implementationArtifactDigests.find((entry)=>entry.path===e.canonicalJsonPath).sha256=h(canonicalJsonBytes);
  const evidenceBytes=canonicalBytes(evidence);
  const approvals=JSON.parse(objectFromCommit(deliverySha,e.approvalsPath).toString('utf8'));
  approvals.approvals.push({filePath:e.canonicalJsonPath,sha256:h(canonicalJsonBytes),approvedBy:e.approvedBy,approvedAtUtc:'2026-09-10T00:00:00.000Z',rationale:'Synthetic hostile approval lets this contract reach source-token validation for the mutated canonical JSON artifact.',approved:true});
  approvals.approvals.push({filePath:e.evidencePath,sha256:h(evidenceBytes),approvedBy:e.approvedBy,approvedAtUtc:'2026-09-10T00:00:00.000Z',rationale:'Synthetic hostile approval lets this contract reach source-token validation for the mutated evidence artifact.',approved:true});
  const fixture=rcv00eLeaseFencingCasGitFixture({canonicalJsonBytes,evidenceBytes,approvalsBytes:canonicalBytes(approvals)});
  assert.throws(()=>verifyR24Rcv00eLeaseFencingCasPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00E_CANONICAL_JSON_TOKEN/);
});
test('R24 RCV00E lease fencing CAS exception rejects stale inventory digest',()=>{
  const e=R24_RCV00E_LEASE_FENCING_CAS_EXPECTATION,inventory=JSON.parse(objectFromCommit(R24_REVIEW_PREVIEW_COMMENT_TOPOLOGY_EXPECTATION.baseSha,e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.contractTestPath).sha256='0'.repeat(64);
  const fixture=rcv00eLeaseFencingCasGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24Rcv00eLeaseFencingCasPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00E_INVENTORY_DIGEST/);
});
function rcv00fDeliveryReconciliationGitFixture({changedPaths,successorChangedPaths,inventoryBytes,approvalsBytes,packageLockBytes,planStateBytes,planStateTestBytes,postAuditVerifierBytes,postAuditTestBytes,rtkG0bBytes,rtkW1Bytes,rtkW2Bytes,rtkZip01Bytes,baseTree,candidateSha='1'.repeat(40),candidateTree='2'.repeat(40),successorSha,successorAncestryShas,successorTree='3'.repeat(40)}={}){
  const e=R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION;
  const deliveryObjectSha='7ea8f61dc45bdb3105f15be73d1c14424e20c4ca';
  const successorChain=successorAncestryShas??(successorSha?[successorSha]:[]);
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const bytesByPath=new Map([
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliveryObjectSha,e.inventoryPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(deliveryObjectSha,e.approvalsPath)],
    [e.packageLockPath,packageLockBytes??objectFromCommit(deliveryObjectSha,e.packageLockPath)],
    [e.planStatePath,planStateBytes??objectFromCommit(deliveryObjectSha,e.planStatePath)],
    [e.planStateTestPath,planStateTestBytes??objectFromCommit(deliveryObjectSha,e.planStateTestPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliveryObjectSha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliveryObjectSha,e.postAuditTestPath)],
    [e.rtkG0bPath,rtkG0bBytes??objectFromCommit(deliveryObjectSha,e.rtkG0bPath)],
    [e.rtkW1Path,rtkW1Bytes??objectFromCommit(deliveryObjectSha,e.rtkW1Path)],
    [e.rtkW2Path,rtkW2Bytes??objectFromCommit(deliveryObjectSha,e.rtkW2Path)],
    [e.rtkZip01Path,rtkZip01Bytes??objectFromCommit(deliveryObjectSha,e.rtkZip01Path)],
  ]);
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1)),endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 RCV00F delivery reconciliation exception accepts the exact current delta',()=>{
  const fixture=rcv00fDeliveryReconciliationGitFixture(),result=verifyR24Rcv00fDeliveryReconciliationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,11);
  assert.equal(result.changedPathDenominator,11);
  assert.equal(result.typedDeliveryReconciliation,'UNCERTAIN_DELIVERY_WAIT_RESUME_REVOKE_DURABLE_EVIDENCE');
  assert.equal(result.fakeVerificationRejected,true);
  assert.equal(result.lockfileAuditRemediation,'js-yaml@4.3.2');
  assert.equal(result.programDone,false);
});
test('R24 RCV00F delivery reconciliation exception accepts successor heads by selecting the immutable exact candidate',()=>{
  const e=R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION,successorSha='4'.repeat(40);
  const fixture=rcv00fDeliveryReconciliationGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'README.md'].sort()});
  const result=verifyR24Rcv00fDeliveryReconciliationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
  assert.equal(result.changedPathDenominator,11);
});
test('R24 RCV00F delivery reconciliation exception scans beyond 64 successor heads',()=>{
  const e=R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION;
  const successorAncestryShas=Array.from({length:65},(_,index)=>(index+101).toString(16).padStart(40,'0'));
  const fixture=rcv00fDeliveryReconciliationGitFixture({successorAncestryShas,successorChangedPaths:[...e.admittedPaths,'README.md'].sort()});
  const result=verifyR24Rcv00fDeliveryReconciliationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorAncestryShas.at(-1));
});
test('R24 RCV00F delivery reconciliation exception rejects an unadmitted future path',()=>{
  const e=R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION,fixture=rcv00fDeliveryReconciliationGitFixture({changedPaths:[...e.admittedPaths,'README.md'].sort()});
  assert.throws(()=>verifyR24Rcv00fDeliveryReconciliationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00F_DELIVERY_CANDIDATE_NOT_FOUND|E_R24_RCV00F_EXACT_ADMITTED_DELTA/);
});
test('R24 RCV00F delivery reconciliation exception rejects fake typed verification proof',()=>{
  const e=R24_RCV00F_DELIVERY_RECONCILIATION_EXPECTATION,planStateText=fs.readFileSync(e.planStatePath,'utf8').replace('E_TYPED_DELIVERY_FAKE_VERIFICATION','E_TYPED_DELIVERY_ADVISORY_VERIFICATION');
  const fixture=rcv00fDeliveryReconciliationGitFixture({planStateBytes:Buffer.from(planStateText)});
  assert.throws(()=>verifyR24Rcv00fDeliveryReconciliationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00F_PLAN_STATE_TOKEN/);
});
function p03RelationshipGraphValidationGitFixture({changedPaths,successorChangedPaths,inventoryBytes,defaultApprovalsBytes,pk1r1ApprovalsBytes,interopApprovalsBytes,postAuditVerifierBytes,postAuditTestBytes,generic01TestBytes,baseTree,candidateSha='1'.repeat(40),candidateTree='2'.repeat(40),successorSha,successorTree='3'.repeat(40)}={}){
  const e=R24_P03_RELATIONSHIP_GRAPH_VALIDATION_EXPECTATION;
  const deliveryObjectSha='bfa2f6c69374ae57d5be9ee0685c2110e1416095';
  const successorChain=successorSha?[successorSha]:[];
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const bytesByPath=new Map([
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliveryObjectSha,e.inventoryPath)],
    [e.defaultApprovalsPath,defaultApprovalsBytes??objectFromCommit(deliveryObjectSha,e.defaultApprovalsPath)],
    [e.pk1r1ApprovalsPath,pk1r1ApprovalsBytes??objectFromCommit(deliveryObjectSha,e.pk1r1ApprovalsPath)],
    [e.interopApprovalsPath,interopApprovalsBytes??objectFromCommit(deliveryObjectSha,e.interopApprovalsPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliveryObjectSha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliveryObjectSha,e.postAuditTestPath)],
    [e.generic01TestPath,generic01TestBytes??objectFromCommit(deliveryObjectSha,e.generic01TestPath)],
  ]);
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1)),endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 P03 relationship graph validation exception accepts the exact Generic01 repair delta',()=>{
  const fixture=p03RelationshipGraphValidationGitFixture(),result=verifyR24P03RelationshipGraphValidationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_P03_RELATIONSHIP_GRAPH_VALIDATION_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.admittedPathDenominator,7);
  assert.equal(result.changedPathDenominator,7);
  assert.equal(result.generic01RelationshipGraph,'VALID_INTERNAL_HYPERLINK_RELATIONSHIP_FOR_LOSS_FIXTURE');
  assert.equal(result.programDone,false);
});
test('R24 P03 relationship graph validation exception accepts successor heads by selecting the immutable exact candidate',()=>{
  const e=R24_P03_RELATIONSHIP_GRAPH_VALIDATION_EXPECTATION,successorSha='4'.repeat(40);
  const fixture=p03RelationshipGraphValidationGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'scripts/ops-gate.mjs'].sort()});
  const result=verifyR24P03RelationshipGraphValidationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
  assert.equal(result.changedPathDenominator,7);
});
test('R24 P03 relationship graph validation exception rejects an unadmitted future path',()=>{
  const e=R24_P03_RELATIONSHIP_GRAPH_VALIDATION_EXPECTATION,fixture=p03RelationshipGraphValidationGitFixture({changedPaths:[...e.admittedPaths,'README.md'].sort()});
  assert.throws(()=>verifyR24P03RelationshipGraphValidationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_P03_RELATIONSHIP_CANDIDATE_NOT_FOUND|E_R24_P03_RELATIONSHIP_EXACT_ADMITTED_DELTA/);
});
test('R24 P03 relationship graph validation exception rejects stale Generic01 inventory digest',()=>{
  const e=R24_P03_RELATIONSHIP_GRAPH_VALIDATION_EXPECTATION,inventory=JSON.parse(objectFromCommit('bfa2f6c69374ae57d5be9ee0685c2110e1416095',e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.generic01TestPath).sha256='0'.repeat(64);
  const fixture=p03RelationshipGraphValidationGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24P03RelationshipGraphValidationPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_P03_RELATIONSHIP_INVENTORY_DIGEST/);
});
function ops03SemanticE0ClassifierGitFixture({changedPaths,successorChangedPaths,scannerBytes,scannerTestBytes,inventoryBytes,approvalsBytes,postAuditVerifierBytes,postAuditTestBytes,baseTree,candidateSha='5'.repeat(40),candidateTree='6'.repeat(40),successorSha,successorTree='7'.repeat(40)}={}){
  const e=R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION;
  const deliverySha='872459208f6d8c7df8e9de1178a6c66a84f308cf';
  const successorChain=successorSha?[successorSha]:[];
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const bytesByPath=new Map([
    [e.scannerPath,scannerBytes??objectFromCommit(deliverySha,e.scannerPath)],
    [e.scannerTestPath,scannerTestBytes??objectFromCommit(deliverySha,e.scannerTestPath)],
    [e.inventoryPath,inventoryBytes??objectFromCommit(deliverySha,e.inventoryPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(deliverySha,e.approvalsPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(deliverySha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(deliverySha,e.postAuditTestPath)],
  ]);
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1)),endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 OPS03 semantic E0 classifier exception accepts the exact current delta',()=>{
  const fixture=ops03SemanticE0ClassifierGitFixture(),result=verifyR24Ops03SemanticE0ClassifierPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.admittedPathDenominator,6);
  assert.equal(result.changedPathDenominator,6);
  assert.equal(result.semanticScannerRepair,true);
  assert.equal(result.programDone,false);
});
test('R24 OPS03 semantic E0 classifier exception accepts successor heads by selecting the immutable exact candidate',()=>{
  const e=R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION,successorSha='8'.repeat(40);
  const fixture=ops03SemanticE0ClassifierGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'README.md'].sort()});
  const result=verifyR24Ops03SemanticE0ClassifierPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
  assert.equal(result.changedPathDenominator,6);
});
test('R24 OPS03 semantic E0 classifier exception rejects an unadmitted future path',()=>{
  const e=R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION,fixture=ops03SemanticE0ClassifierGitFixture({changedPaths:[...e.admittedPaths,'README.md'].sort()});
  assert.throws(()=>verifyR24Ops03SemanticE0ClassifierPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OPS03_CANDIDATE_NOT_FOUND|E_R24_OPS03_EXACT_ADMITTED_DELTA/);
});
test('R24 OPS03 semantic E0 classifier exception rejects a weakened scanner token',()=>{
  const e=R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION,scannerText=fs.readFileSync(e.scannerPath,'utf8').replaceAll('tokenizeJavaScriptLike','tokenizeLineLike');
  const fixture=ops03SemanticE0ClassifierGitFixture({scannerBytes:Buffer.from(scannerText)});
  assert.throws(()=>verifyR24Ops03SemanticE0ClassifierPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OPS03_SCANNER_TOKEN/);
});
test('R24 OPS03 semantic E0 classifier exception rejects stale inventory binding',()=>{
  const e=R24_OPS03_SEMANTIC_E0_CLASSIFIER_EXPECTATION,inventory=JSON.parse(objectFromCommit('872459208f6d8c7df8e9de1178a6c66a84f308cf',e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.postAuditTestPath).sha256='0'.repeat(64);
  const fixture=ops03SemanticE0ClassifierGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24Ops03SemanticE0ClassifierPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_OPS03_INVENTORY_DIGEST/);
});
function rcv00hMinimalE0ParserPurityGitFixture({changedPaths,successorChangedPaths,scannerBytes,scannerTestBytes,inventoryBytes,registerBytes,approvalsBytes,claimBytes,postAuditVerifierBytes,postAuditTestBytes,baseTree,candidateSha='9'.repeat(40),candidateTree='a'.repeat(40),successorSha,successorTree='b'.repeat(40)}={}){
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION;
  const historicalSha='def4754a189c8434014f08e9d4339b5a887ca7b5';
  const successorChain=successorSha?[successorSha]:[];
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const bytesByPath=new Map([
    [e.scannerPath,scannerBytes??objectFromCommit(historicalSha,e.scannerPath)],
    [e.scannerTestPath,scannerTestBytes??objectFromCommit(historicalSha,e.scannerTestPath)],
    [e.inventoryPath,inventoryBytes??objectFromCommit(historicalSha,e.inventoryPath)],
    [e.registerPath,registerBytes??objectFromCommit(historicalSha,e.registerPath)],
    [e.approvalsPath,approvalsBytes??objectFromCommit(historicalSha,e.approvalsPath)],
    [e.claimBindingPath,claimBytes??objectFromCommit(historicalSha,e.claimBindingPath)],
    [e.postAuditVerifierPath,postAuditVerifierBytes??objectFromCommit(historicalSha,e.postAuditVerifierPath)],
    [e.postAuditTestPath,postAuditTestBytes??objectFromCommit(historicalSha,e.postAuditTestPath)],
  ]);
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${e.predecessorRuntimeCandidateSha}^{tree}`)value=e.predecessorRuntimeCandidateTree;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1)),endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const repoPath=String(args[1]).slice(String(args[1]).indexOf(':')+1);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 RCV00H minimal E0 parser purity exception accepts the bounded successor proof',()=>{
  const fixture=rcv00hMinimalE0ParserPurityGitFixture(),result=verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.admittedPathDenominator,5);
  assert.equal(result.changedPathDenominator,5);
  assert.equal(result.completeInventoryDrivesGate,true);
  assert.equal(result.taskParserReachesV2Plan,true);
  assert.equal(result.realViolationsFailWithPathReason,true);
  assert.equal(result.lexicalFalsePositivesDoNotBlock,true);
  assert.equal(result.historicalCompatibilityExplicit,true);
  assert.equal(result.noSpeculativeModuleExtraction,true);
  assert.equal(result.programDone,false);
});
test('R24 RCV00H minimal E0 parser purity exception accepts successor heads by selecting the immutable exact candidate',()=>{
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,successorSha='c'.repeat(40);
  const fixture=rcv00hMinimalE0ParserPurityGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'README.md'].sort()});
  const result=verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
  assert.equal(result.changedPathDenominator,5);
});
test('R24 RCV00H minimal E0 parser purity exception rejects an unadmitted future path',()=>{
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,fixture=rcv00hMinimalE0ParserPurityGitFixture({changedPaths:[...e.admittedPaths,'README.md'].sort()});
  assert.throws(()=>verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00H_CANDIDATE_NOT_FOUND|E_R24_RCV00H_EXACT_ADMITTED_DELTA/);
});
test('R24 RCV00H minimal E0 parser purity exception rejects missing acceptance evidence',()=>{
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,claim=JSON.parse(fs.readFileSync(e.claimBindingPath,'utf8'));
  claim.acceptance=claim.acceptance.filter((entry)=>entry.id!=='TASK_PARSER_REACHES_V2_PLAN');
  const fixture=rcv00hMinimalE0ParserPurityGitFixture({claimBytes:canonicalBytes(claim)});
  assert.throws(()=>verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00H_ACCEPTANCE_DENOMINATOR/);
});
test('R24 RCV00H minimal E0 parser purity exception rejects hidden historical register mutation',()=>{
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,register=JSON.parse(fs.readFileSync(e.registerPath,'utf8'));
  const ops03=register.findings.find((finding)=>finding.findingId==='OPS-03');
  ops03.status='REVALIDATE_CURRENT';
  ops03.evidence=null;
  const fixture=rcv00hMinimalE0ParserPurityGitFixture({registerBytes:canonicalBytes(register)});
  assert.throws(()=>verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00H_HISTORICAL_REGISTER_BINDING/);
});
test('R24 RCV00H minimal E0 parser purity exception rejects stale inventory digest',()=>{
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,inventory=JSON.parse(objectFromCommit('def4754a189c8434014f08e9d4339b5a887ca7b5',e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.postAuditTestPath).sha256='0'.repeat(64);
  const fixture=rcv00hMinimalE0ParserPurityGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00H_INVENTORY_DIGEST/);
});
test('R24 RCV00H minimal E0 parser purity exception rejects weakened local proof',()=>{
  const e=R24_RCV00H_MINIMAL_E0_PARSER_PURITY_EXPECTATION,claim=JSON.parse(fs.readFileSync(e.claimBindingPath,'utf8'));
  claim.localProofs.e0Lane.mutants.killed=39;
  const fixture=rcv00hMinimalE0ParserPurityGitFixture({claimBytes:canonicalBytes(claim)});
  assert.throws(()=>verifyR24Rcv00hMinimalE0ParserPurityPostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_RCV00H_LOCAL_PROOF_SHAPE/);
});
const W0_CURRENT_STATE_HISTORICAL_DELIVERY_SHA='7a6ec5c1f6804e7184d61bb751d31dca012387fc';
function w0CurrentStateClosureGitFixture({changedPaths,successorChangedPaths,overlayBytes,claimBytes,inventoryBytes,approvalsBytes,pk1r1ApprovalsBytes,artifactBytesByPath=new Map(),baseTree,candidateSha='d'.repeat(40),candidateTree='e'.repeat(40),successorSha,successorTree='f'.repeat(40)}={}){
  const e=R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION;
  const historicalDeliverySha=W0_CURRENT_STATE_HISTORICAL_DELIVERY_SHA;
  const successorChain=successorSha?[successorSha]:[];
  const successorSet=new Set(successorChain);
  const requestedSha=successorChain.at(-1)??candidateSha;
  const currentFile=(repoPath)=>fs.readFileSync(repoPath);
  const currentDigest=(repoPath)=>h(currentFile(repoPath));
  const historicalFile=(repoPath)=>objectFromCommit(historicalDeliverySha,repoPath);
  const refreshedClaimBytes=()=>{
    const claim=JSON.parse(currentFile(e.claimBindingPath));
    for(const repoPath of [e.effectiveStateCompilerTestPath,e.postAuditVerifierPath,e.postAuditTestPath]){
      const binding=claim.implementationArtifactDigests?.find((entry)=>entry.path===repoPath);
      if(binding)binding.sha256=currentDigest(repoPath);
    }
    return canonicalBytes(claim);
  };
  const refreshedInventoryBytes=()=>{
    const inventory=JSON.parse(historicalFile(e.inventoryPath).toString('utf8'));
    for(const repoPath of [e.effectiveStateCompilerTestPath,e.postAuditTestPath]){
      const entry=inventory.entries?.find((item)=>item.path===repoPath);
      if(entry)entry.sha256=currentDigest(repoPath);
    }
    return canonicalBytes(inventory);
  };
  const refreshedApprovalsBytes=(repoPath)=>{
    const approvals=JSON.parse(currentFile(repoPath));
    const approvalRegistryPaths=new Set([e.approvalsPath,e.pk1r1ApprovalsPath]);
    approvals.approvals??=[];
    for(const filePath of e.admittedPaths.filter((item)=>!approvalRegistryPaths.has(item))){
      const bytes=filePath===e.claimBindingPath?refreshedClaimBytes():(filePath===e.inventoryPath?refreshedInventoryBytes():currentFile(filePath));
      const sha256=h(bytes);
      let entry=approvals.approvals.find((item)=>item.filePath===filePath&&item.sha256===sha256);
      if(!entry){
        entry={filePath,sha256,approved:true,approvedBy:e.approvedBy,approvedAtUtc:'2026-09-11T03:30:00Z',authority:'TEST_FIXTURE_ONLY',rationale:'Synthetic fixture rebinding current post-audit carrier bytes for W0 verifier compatibility.',evidenceStampIds:[e.approvalEvidenceStampId]};
        approvals.approvals.push(entry);
      }
      entry.approved=true;
      if(!String(entry.approvedBy||'').split('|').map((part)=>part.trim()).includes(e.approvedBy))entry.approvedBy=`${String(entry.approvedBy||'').trim()} | ${e.approvedBy}`.replace(/^ \| /u,'');
      entry.evidenceStampIds=Array.from(new Set([...(entry.evidenceStampIds??[]),e.approvalEvidenceStampId])).sort();
    }
    approvals.approvals.sort((a,b)=>String(a.filePath).localeCompare(String(b.filePath))||String(a.sha256).localeCompare(String(b.sha256))||String(a.approvedBy).localeCompare(String(b.approvedBy)));
    return canonicalBytes(approvals);
  };
  const currentBytes=(repoPath)=>{
    if(artifactBytesByPath.has(repoPath))return artifactBytesByPath.get(repoPath);
    if(repoPath===e.overlayPath&&overlayBytes)return Buffer.from(overlayBytes);
    if(repoPath===e.claimBindingPath&&claimBytes)return Buffer.from(claimBytes);
    if(repoPath===e.inventoryPath&&inventoryBytes)return Buffer.from(inventoryBytes);
    if(repoPath===e.approvalsPath&&approvalsBytes)return Buffer.from(approvalsBytes);
    if(repoPath===e.pk1r1ApprovalsPath&&pk1r1ApprovalsBytes)return Buffer.from(pk1r1ApprovalsBytes);
    if([e.executableProgramPath,e.executableProgramTestPath,e.contractTestPath].includes(repoPath))return historicalFile(repoPath);
    if(repoPath===e.claimBindingPath)return refreshedClaimBytes();
    if(repoPath===e.inventoryPath)return refreshedInventoryBytes();
    if(repoPath===e.approvalsPath)return refreshedApprovalsBytes(repoPath);
    if(repoPath===e.pk1r1ApprovalsPath)return refreshedApprovalsBytes(repoPath);
    return currentFile(repoPath);
  };
  const bytesByPath=new Map(e.admittedPaths.concat([e.receiptPath]).map((repoPath)=>[repoPath,currentBytes(repoPath)]));
  return{candidateSha:requestedSha,deliverySha:candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===requestedSha)value=requestedSha;
    else if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${e.immutableCandidateHeadSha}^{tree}`)value=e.immutableCandidateTreeSha;
    else if(args[0]==='rev-parse'&&successorSet.has(String(args[1]).replace(/\^\{tree\}$/u,'')))value=successorTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base')value='';
    else if(args[0]==='diff'){
      const range=String(args.at(-1)),endSha=range.slice(range.indexOf('..')+2);
      const paths=successorSet.has(endSha)?(successorChangedPaths??changedPaths??e.admittedPaths):(changedPaths??e.admittedPaths);
      value=paths.join('\n')+'\n';
    }
    else if(args[0]==='rev-list')value=successorChain.length?[candidateSha,...successorChain].join('\n'):candidateSha;
    else if(args[0]==='show'){
      const objectSpec=String(args[1]),repoPath=objectSpec.slice(objectSpec.indexOf(':')+1);
      if(objectSpec.startsWith(`${e.immutableCandidateHeadSha}:`))return execFileSync('git',args,options);
      const bytes=bytesByPath.get(repoPath);
      if(bytes)return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?value+'\n':Buffer.from(value+'\n');
  }};
}
test('R24 W0 current-state closure exception accepts the bounded overlay proof',()=>{
  const fixture=w0CurrentStateClosureGitFixture(),result=verifyR24W0CurrentStateClosurePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.immutableCandidateHeadSha,R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION.immutableCandidateHeadSha);
  assert.equal(result.admittedPathDenominator,R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION.admittedPaths.length);
  assert.equal(result.overlayDigest,R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION.overlayDigest);
  assert.equal(result.effectiveW0State,'DONE');
  assert.equal(result.rawW0StatePreserved,'BLOCKED_TYPED');
  assert.equal(result.programDone,false);
});
test('R24 W0 current-state closure exception accepts successor heads by selecting the immutable exact candidate',()=>{
  const e=R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION,successorSha='c'.repeat(40);
  const fixture=w0CurrentStateClosureGitFixture({successorSha,successorChangedPaths:[...e.admittedPaths,'README.md'].sort()});
  const result=verifyR24W0CurrentStateClosurePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,fixture.deliverySha);
  assert.equal(result.currentCandidateSha,successorSha);
});
test('R24 W0 current-state closure exception rejects an unadmitted future path',()=>{
  const e=R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION,fixture=w0CurrentStateClosureGitFixture({changedPaths:[...e.admittedPaths,'README.md'].sort()});
  assert.throws(()=>verifyR24W0CurrentStateClosurePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_W0_CURRENT_STATE_CANDIDATE_NOT_FOUND|E_R24_W0_CURRENT_STATE_EXACT_ADMITTED_DELTA/);
});
test('R24 W0 current-state closure exception rejects a stale overlay candidate tree',()=>{
  const e=R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION,overlay=JSON.parse(fs.readFileSync(e.overlayPath,'utf8'));
  overlay.immutableCandidateTreeSha='0'.repeat(40);
  const fixture=w0CurrentStateClosureGitFixture({overlayBytes:canonicalBytes(overlay)});
  assert.throws(()=>verifyR24W0CurrentStateClosurePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_W0_CURRENT_STATE_OVERLAY_IDENTITY|E_R24_W0_CURRENT_STATE_IMMUTABLE_CANDIDATE/);
});
test('R24 W0 current-state closure exception rejects stale claim implementation binding',()=>{
  const e=R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION,claim=JSON.parse(fs.readFileSync(e.claimBindingPath,'utf8'));
  claim.implementationArtifactDigests.find((entry)=>entry.path===e.contractTestPath).sha256='0'.repeat(64);
  const fixture=w0CurrentStateClosureGitFixture({claimBytes:canonicalBytes(claim)});
  assert.throws(()=>verifyR24W0CurrentStateClosurePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_W0_CURRENT_STATE_IMPLEMENTATION_DIGEST/);
});
test('R24 W0 current-state closure exception rejects stale post-audit inventory binding',()=>{
  const e=R24_W0_CURRENT_STATE_CLOSURE_EXPECTATION,inventory=JSON.parse(objectFromCommit(W0_CURRENT_STATE_HISTORICAL_DELIVERY_SHA,e.inventoryPath).toString('utf8'));
  inventory.entries.find((entry)=>entry.path===e.postAuditTestPath).sha256='0'.repeat(64);
  const fixture=w0CurrentStateClosureGitFixture({inventoryBytes:canonicalBytes(inventory)});
  assert.throws(()=>verifyR24W0CurrentStateClosurePostEvaluationException({candidateSha:fixture.candidateSha,git:fixture.git}),/E_R24_W0_CURRENT_STATE_INVENTORY_DIGEST/);
});
test('WP401 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp401MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP401_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP402 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp402MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP402_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP403 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp403MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP403_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP404 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp404MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP404_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP500 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp500MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP500_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP501 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp501MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP501_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP501 gate-integration exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp501GateIntegrationPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP501_GATE_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP501 performance exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp501PerformanceIntegrationPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP501_PERFORMANCE_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP501 audit-R2 compatibility exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp501AuditR2CompatibilityPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP501_AUDIT_R2_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP501 inventory-finalization exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp501InventoryFinalizationPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP501_INVENTORY_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP501 terminal exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'package.json\n':Buffer.from('package.json\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp501TerminalExceptionPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP501_TERMINAL_EXCEPTION_UNADMITTED_PATH:package\.json/);});
test('WP502 successor exception rejects an unadmitted future path',()=>{const hostileGit=(args,options={})=>args[0]==='diff'?(options.encoding==='utf8'?'README.md\n':Buffer.from('README.md\n')):execFileSync('git',args,options);assert.throws(()=>verifyWp502MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP502_EXCEPTION_UNADMITTED_PATH:README\.md/);});
test('WP503 selection-provenance successor exception rejects an unadmitted future path',()=>{
  const hostileGit=(args,options={})=>args[0]==='diff'&&String(args[2]).startsWith(`${WP503_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha}..`)
    ?(options.encoding==='utf8'?'README.md\n':Buffer.from('README.md\n'))
    :execFileSync('git',args,options);
  assert.throws(()=>verifyWp503MainProductPostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP503_SELECTION_PROVENANCE_UNADMITTED_PATH:README\.md/);
});
test('WP702 PK0 security successor binds the exact admitted delta and rejects an unadmitted future path',()=>{
  const candidateSha=WP702_PK0_SECURITY_SUCCESSOR_ADMISSION_EXPECTATION.issuedCandidateSha;
  const result=verifyWp702Pk0SecuritySuccessorPostEvaluationException({candidateSha});
  assert.equal(result.status,'PASS');
  assert.equal(result.admission.stageAdmissionDigest,WP702_PK0_SECURITY_SUCCESSOR_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(result.admittedPathDenominator,9);
  assert.equal(result.dependencyAdmissionDigest,'97afd3b295dec785d2ba1cb88f4e0e1685e7ca0ac2cedd8c1082f8840d27b685');
  const hostileGit=(args,options={})=>args[0]==='diff'&&String(args[2]).startsWith(`${WP702_PK0_SECURITY_SUCCESSOR_ADMISSION_EXPECTATION.baseSha}..`)
    ?(options.encoding==='utf8'?'README.md\n':Buffer.from('README.md\n'))
    :execFileSync('git',args,options);
  assert.throws(()=>verifyWp702Pk0SecuritySuccessorPostEvaluationException({candidateSha,git:hostileGit}),/E_WP702_PK0_SECURITY_EXACT_ADMITTED_DELTA/);
});
test('WP702 CI merge-ref successor binds the historical candidate oracle and rejects an unadmitted future path',()=>{
  const candidateSha=WP702_CI_MERGE_REF_TEST_BINDING_ADMISSION_EXPECTATION.issuedCandidateSha;
  const result=verifyWp702CiMergeRefTestBindingPostEvaluationException({candidateSha});
  assert.equal(result.status,'PASS');
  assert.equal(result.admission.stageAdmissionDigest,WP702_CI_MERGE_REF_TEST_BINDING_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(result.admittedPathDenominator,8);
  assert.equal(result.historicalPk0IssuedCandidateSha,WP702_PK0_SECURITY_SUCCESSOR_ADMISSION_EXPECTATION.issuedCandidateSha);
  const hostileGit=(args,options={})=>args[0]==='diff'&&String(args[2]).startsWith(`${WP702_CI_MERGE_REF_TEST_BINDING_ADMISSION_EXPECTATION.baseSha}..`)
    ?(options.encoding==='utf8'?'README.md\n':Buffer.from('README.md\n'))
    :execFileSync('git',args,options);
  assert.throws(()=>verifyWp702CiMergeRefTestBindingPostEvaluationException({candidateSha,git:hostileGit}),/E_WP702_CI_MERGE_REF_EXACT_ADMITTED_DELTA/);
});
test('WP702 WP504 historical-surface successor binds exact Git objects and rejects an unadmitted future path',()=>{
  const result=verifyWp702Wp504HistoricalSurfacePostEvaluationException({candidateSha:'HEAD'});
  assert.equal(result.status,'PASS');
  assert.equal(result.admission.stageAdmissionDigest,WP702_WP504_HISTORICAL_SURFACE_ADMISSION_EXPECTATION.admissionDigest);
  assert.equal(result.admittedPathDenominator,10);
  assert.equal(result.wordingSurfaceEvaluationSha,'faef2f0813e4c8eb4b8703682e417aea72e627de');
  assert.equal(result.wordingSurfaceEvaluationTree,'b223e12273e9e9c790241125cef9f883239cbb0e');
  const hostileGit=(args,options={})=>args[0]==='diff'&&String(args[2]).startsWith(`${WP702_WP504_HISTORICAL_SURFACE_ADMISSION_EXPECTATION.baseSha}..`)
    ?(options.encoding==='utf8'?'README.md\n':Buffer.from('README.md\n'))
    :execFileSync('git',args,options);
  assert.throws(()=>verifyWp702Wp504HistoricalSurfacePostEvaluationException({candidateSha:'HEAD',git:hostileGit}),/E_WP702_WP504_HISTORICAL_SURFACE_EXACT_ADMITTED_DELTA/);
});
test('WP501 final carriers reject future chronology pending rows nonzero WIP and provider substitution',()=>{
  const read=(name)=>JSON.parse(fs.readFileSync(`docs/OPS/R24/CORRECTIVE/${name}`));
  const matrix=read('WP501_FINAL_ACCEPTANCE_MATRIX_V1.json'),effective=read('WP501_FINAL_EFFECTIVE_STATE_V1.json'),release=read('WP501_FINAL_LEASE_RELEASE_V1.json'),receipt=read('WP501_FINAL_TERMINAL_RECEIPT_V1.json');
  let mutant=clone(matrix);mutant.observedAtUtc='2999-01-01T00:00:00Z';assert.throws(()=>verifyWp501FinalTerminalCarriers({overrides:{matrix:mutant}}),/E_WP501_FINAL_FUTURE_OBSERVED_AT/);
  mutant=clone(matrix);mutant.rows[0].status='PENDING';mutant.passedRowCount=21;mutant.pendingRowCount=1;assert.throws(()=>verifyWp501FinalTerminalCarriers({overrides:{matrix:mutant}}),/E_WP501_FINAL_MATRIX/);
  mutant=clone(effective);mutant.lease.status='ACTIVE';mutant.lease.wip=1;assert.throws(()=>verifyWp501FinalTerminalCarriers({overrides:{effective:mutant}}),/E_WP501_FINAL_EFFECTIVE_BINDING/);
  mutant=clone(release);mutant.lease.wip=1;assert.throws(()=>verifyWp501FinalTerminalCarriers({overrides:{release:mutant}}),/E_WP501_FINAL_RELEASE/);
  mutant=clone(receipt);mutant.providerEvidence.candidateCi.returnedBytesDigest='0'.repeat(64);assert.throws(()=>verifyWp501FinalTerminalCarriers({overrides:{receipt:mutant}}),/E_WP501_FINAL_RUN_PROVIDER/);
});
test('source-plan byte roles cannot be conflated',()=>{const file=load(),mutant=clone(file.value);mutant.compiledProgramFileDigest=mutant.externalSourcePlanDigest;assert.throws(()=>verify(mutant),/E_SOURCE_PLAN_ROLE_BINDING/);});
test('external audit-cycle terminal ZIP binds admission certification ruleset CI and protected WIP evidence',()=>{const subject=terminalFixture();const result=verifyAuditCycleTerminalArtifact(subject);assert.equal(result.verification.status,'VERIFIED');const carrier=createAuditCycleDurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification}),file=durableFile(carrier);assert.equal(verifyAuditCycleDurableCarrier(file,durableExpectation(file)).status,'VERIFIED');});
test('external verifier preserves role-relative raw ruleset bytes while requiring one normalized semantic view',()=>{const subject=terminalFixture();subject.rulesetEvidenceFile.value=rulesetEnvelope({currentUserCanBypass:'never'});subject.rulesetEvidenceFile.bytes=Buffer.from(`${JSON.stringify(subject.rulesetEvidenceFile.value)}\n`);subject.rulesetEvidenceFile.digest=h(subject.rulesetEvidenceFile.bytes);const result=verifyAuditCycleTerminalArtifact(subject);assert.equal(result.verification.status,'VERIFIED');assert.notEqual(result.verification.terminalRulesetReturnedBytesDigest,result.verification.verificationRulesetReturnedBytesDigest);assert.equal(result.verification.normalizedRulesetDigest,subject.member.liveRuleset.normalizedRulesetDigest);});
test('external verifier rejects a terminal ruleset semantic substitution despite valid raw-digest shape',()=>{assert.throws(()=>verifyAuditCycleTerminalArtifact(terminalFixture((subject)=>{subject.member.liveRuleset.normalizedRulesetDigest='0'.repeat(64);})),/E_LIVE_RULESET_BINDING/);});
test('external audit-cycle terminal verification rejects source-role and CI-byte substitution',()=>{assert.throws(()=>verifyAuditCycleTerminalArtifact(terminalFixture((subject)=>{subject.member.compiledProgramFileDigest=subject.member.externalSourcePlanDigest;})),/E_SOURCE_PLAN_ROLE_BINDING/);assert.throws(()=>verifyAuditCycleTerminalArtifact(terminalFixture((subject)=>{subject.member.correctionDelivery.candidateCiBytesDigest='0'.repeat(64);})),/E_CANDIDATE_CI_BINDING/);});
test('canonical cycle-one durable carrier binds real file digest and emits a concrete validation digest',()=>{const file=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_TERMINAL_ATTESTATION_DURABLE_CARRIER_V1.json'),result=verifyAuditCycleDurableCarrier(file);assert.equal(result.status,'VERIFIED');assert.equal(result.carrierDigest,AUDIT_CYCLE_1_DURABLE_EXPECTATION.carrierDigest);});
test('audit-cycle durable carrier rejects modified member bytes',()=>{const subject=terminalFixture(),result=verifyAuditCycleTerminalArtifact(subject),carrier=createAuditCycleDurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification}),original=durableFile(carrier),expectation=durableExpectation(original);carrier.member.canonicalBase64=Buffer.from('{}\n').toString('base64');assert.throws(()=>verifyAuditCycleDurableCarrier(durableFile(carrier),{...expectation,carrierDigest:h(canonicalBytes(carrier))}),/E_DURABLE_MEMBER_BINDING|E_DURABLE_MEMBER/);});
test('durable carrier rejects unknown outer fields and missing nested fields',()=>{const subject=terminalFixture(),result=verifyAuditCycleTerminalArtifact(subject),carrier=createAuditCycleDurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification});carrier.untrusted=true;let file=durableFile(carrier);assert.throws(()=>verifyAuditCycleDurableCarrier(file,durableExpectation(file)),/E_UNKNOWN_OR_MISSING_FIELD/);delete carrier.untrusted;delete carrier.member.path;file=durableFile(carrier);const expectation={...durableExpectation({...file,value:{...carrier,member:{...carrier.member,path:'audit-cycle1-terminal-attestation.json'}}}),carrierDigest:file.digest};assert.throws(()=>verifyAuditCycleDurableCarrier(file,expectation),/E_UNKNOWN_OR_MISSING_FIELD/);});
test('durable carrier rejects zero or missing archive size and substituted member path',()=>{const subject=terminalFixture(),result=verifyAuditCycleTerminalArtifact(subject),base=createAuditCycleDurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification});for(const mutate of [(c)=>{c.archive.sizeBytes=0;},(c)=>{delete c.archive.sizeBytes;},(c)=>{c.member.path='substituted.json';}]){const carrier=structuredClone(base),original=durableFile(carrier),expectation=durableExpectation(original);mutate(carrier);const file=durableFile(carrier);assert.throws(()=>verifyAuditCycleDurableCarrier(file,{...expectation,carrierDigest:file.digest}),/E_DURABLE_ARCHIVE_BINDING|E_UNKNOWN_OR_MISSING_FIELD|E_DURABLE_MEMBER_BINDING/);}});
test('durable carrier rejects provider repository and workflow substitutions',()=>{const subject=terminalFixture(),result=verifyAuditCycleTerminalArtifact(subject),base=createAuditCycleDurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification});for(const [field,value] of [['provider','LOCAL'],['repository','Other/repo'],['workflowPath','.github/workflows/other.yml']]){const carrier=structuredClone(base),expectation=durableExpectation(durableFile(carrier));carrier.provenance[field]=value;const file=durableFile(carrier);assert.throws(()=>verifyAuditCycleDurableCarrier(file,{...expectation,carrierDigest:file.digest}),/E_DURABLE_PROVENANCE/);}});
test('durable carrier rejects arbitrary reported digest even when bytes are canonical',()=>{const file=raw('docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_TERMINAL_ATTESTATION_DURABLE_CARRIER_V1.json');assert.throws(()=>verifyAuditCycleDurableCarrier({...file,digest:'0'.repeat(64)},{...AUDIT_CYCLE_1_DURABLE_EXPECTATION,carrierDigest:'0'.repeat(64)}),/E_DURABLE_CARRIER_DIGEST/);});
test('durable verifier CLI emits parseable canonical JSON with the pinned carrier digest',()=>{const stdout=execFileSync(process.execPath,['scripts/ops/r24/corrective/post-audit-certification-set.mjs','--verify-audit-cycle-durable','docs/OPS/R24/CORRECTIVE/AUDIT_CYCLE_1_TERMINAL_ATTESTATION_DURABLE_CARRIER_V1.json','--expected-carrier-digest',AUDIT_CYCLE_1_DURABLE_EXPECTATION.carrierDigest],{encoding:'utf8'});const value=JSON.parse(stdout);assert.equal(value.status,'VERIFIED');assert.equal(value.carrierDigest,AUDIT_CYCLE_1_DURABLE_EXPECTATION.carrierDigest);assert.equal(stdout,canonicalBytes(value).toString('utf8'));});
test('audit-cycle-two terminal ZIP and durable carrier bind the repaired verifier laws',()=>{const subject=cycle2TerminalFixture(),result=verifyAuditCycle2TerminalArtifact(subject);assert.equal(result.verification.status,'VERIFIED');assert.equal(result.verification.predecessorDurableCarrierValidationSchema,'AUDIT_CYCLE_1_DURABLE_CARRIER_VALIDATION_V2');const carrier=createAuditCycle2DurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification}),file=durableFile(carrier),validation=verifyAuditCycle2DurableCarrier(file,{expectedCarrierDigest:file.digest});assert.equal(validation.status,'VERIFIED');assert.equal(validation.carrierDigest,file.digest);});
test('audit-cycle-two verifier preserves role-relative raw ruleset bytes while requiring one normalized semantic view',()=>{const subject=cycle2TerminalFixture();subject.rulesetEvidenceFile.value=rulesetEnvelope({currentUserCanBypass:'never'});subject.rulesetEvidenceFile.bytes=Buffer.from(`${JSON.stringify(subject.rulesetEvidenceFile.value)}\n`);subject.rulesetEvidenceFile.digest=h(subject.rulesetEvidenceFile.bytes);const result=verifyAuditCycle2TerminalArtifact(subject);assert.equal(result.verification.status,'VERIFIED');assert.equal(result.verification.terminalRulesetReturnedBytesDigest,subject.member.liveRuleset.returnedBytesDigest);assert.equal(result.verification.verificationRulesetReturnedBytesDigest,subject.rulesetEvidenceFile.digest);assert.notEqual(result.verification.terminalRulesetReturnedBytesDigest,result.verification.verificationRulesetReturnedBytesDigest);assert.equal(result.verification.normalizedRulesetDigest,subject.member.liveRuleset.normalizedRulesetDigest);});
test('audit-cycle-two verifier rejects malformed terminal-observer raw ruleset evidence',()=>{assert.throws(()=>verifyAuditCycle2TerminalArtifact(cycle2TerminalFixture((subject)=>{subject.member.liveRuleset.returnedBytesDigest='0';})),/E_HEX/);assert.throws(()=>verifyAuditCycle2TerminalArtifact(cycle2TerminalFixture((subject)=>{subject.member.liveRuleset.returnedByteLength=0;})),/E_CYCLE2_LIVE_RULESET_BINDING/);});
test('audit-cycle-two durable carrier rejects unknown nested keys zero archive size and arbitrary expected digest',()=>{const subject=cycle2TerminalFixture(),result=verifyAuditCycle2TerminalArtifact(subject),base=createAuditCycle2DurableCarrier({zipBytes:subject.zipBytes,memberBytes:result.memberBytes,runEvidenceFile:subject.runEvidenceFile,artifactEvidence:subject.artifactEvidence,verification:result.verification});for(const mutate of [(carrier)=>{carrier.provenance.unknown=true;},(carrier)=>{carrier.archive.sizeBytes=0;}]){const carrier=structuredClone(base);mutate(carrier);const file=durableFile(carrier);assert.throws(()=>verifyAuditCycle2DurableCarrier(file,{expectedCarrierDigest:file.digest}),/E_UNKNOWN_OR_MISSING_FIELD|E_CYCLE2_DURABLE_ARCHIVE/);}const file=durableFile(base);assert.throws(()=>verifyAuditCycle2DurableCarrier(file,{expectedCarrierDigest:'0'.repeat(64)}),/E_CYCLE2_DURABLE_CARRIER_DIGEST/);});
test('audit-cycle-two terminal verifier rejects repair-law and live-ruleset substitutions',()=>{assert.throws(()=>verifyAuditCycle2TerminalArtifact(cycle2TerminalFixture((subject)=>{subject.member.verifierRepairs.durableCarrier.expectedCarrierDigestRequired=false;})),/E_CYCLE2_DURABLE_REPAIR/);assert.throws(()=>verifyAuditCycle2TerminalArtifact(cycle2TerminalFixture((subject)=>{subject.member.liveRuleset.protections.bypassActorCount=1;})),/E_CYCLE2_LIVE_RULESET_VIEW|E_CYCLE2_LIVE_RULESET_POLICY/);});

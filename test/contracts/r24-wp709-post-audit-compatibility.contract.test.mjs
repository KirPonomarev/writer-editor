import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION,
  WP709_MAIN_PRODUCT_ADMISSION_EXPECTATION as E,
  verifyWp709MainProductPostEvaluationException,
} from '../../scripts/ops/r24/corrective/post-audit-certification-set.mjs';

const FINAL_SHA = 'f709f709f709f709f709f709f709f709f709f709';
const FINAL_TREE = 'a709a709a709a709a709a709a709a709a709a709';
const HISTORICAL_CANDIDATE_SHA = PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION.baseSha;
const instance = JSON.parse(fs.readFileSync(E.instancePath));
const ADMITTED = [...instance.operations.modifyPaths, ...instance.operations.createPaths].sort();
const response = (value, encoding) => encoding === 'utf8' ? `${value}\n` : Buffer.from(`${value}\n`);

function fakeGit({ changedPaths = ADMITTED, baseTreeDrift = false, missingArtifact = null, byteDrift = null, ancestor = true, mutateJson = null } = {}) {
  return (args, { encoding = null } = {}) => {
    if (args[0] === 'rev-parse') {
      if (args[1] === 'HEAD') return response(FINAL_SHA, encoding);
      if (args[1] === `${E.baseSha}^{tree}`) return response(baseTreeDrift ? 'b'.repeat(40) : E.baseTree, encoding);
      if (args[1] === `${FINAL_SHA}^{tree}`) return response(FINAL_TREE, encoding);
      return response(args[1], encoding);
    }
    if (args[0] === 'merge-base') {
      if (!ancestor) throw new Error('NO_ANCESTRY');
      return Buffer.alloc(0);
    }
    if (args[0] === 'diff') return response(changedPaths.join('\n'), encoding);
    if (args[0] === 'show') {
      const split = args[1].indexOf(':');
      const sha = args[1].slice(0, split);
      const file = args[1].slice(split + 1);
      if (file === missingArtifact) throw new Error('MISSING');
      const objectSha = sha === E.baseSha ? E.baseSha : HISTORICAL_CANDIDATE_SHA;
      let bytes = execFileSync('git', ['show', `${objectSha}:${file}`], { encoding: null, maxBuffer: 32 * 1024 * 1024 });
      if (mutateJson?.path === file) {
        const value = JSON.parse(bytes);
        mutateJson.apply(value);
        bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
      }
      if (file === byteDrift) bytes = Buffer.concat([bytes, Buffer.from(' ')]);
      return encoding === 'utf8' ? bytes.toString() : bytes;
    }
    throw new Error(`UNEXPECTED_GIT:${args.join(' ')}`);
  };
}

test('WP709 candidate oracle binds the exact V2 scope and honest seven-route physical result', () => {
  const result = verifyWp709MainProductPostEvaluationException({ git: fakeGit() });
  assert.equal(result.status, 'PASS');
  assert.equal(result.candidateSha, FINAL_SHA);
  assert.equal(result.candidateTree, FINAL_TREE);
  assert.equal(result.admittedPathDenominator, 44);
  assert.deepEqual(result.changedPaths, ADMITTED);
  assert.equal(result.protectedWipDenominator, 304);
  assert.equal(result.protectedDirtyDenominator, 11);
  assert.equal(result.chainDenominator, 7);
  assert.equal(result.physicalStatus, 'PASS');
  assert.equal(result.exactRoutePasses, 7);
  assert.equal(result.blockedTyped, 0);
  assert.equal(result.googleOfficeCompatQualified, true);
  assert.equal(result.stageDone, true);
  assert.equal(result.programDone, false);
  assert.equal(result.admission.authorityDigest, '43108447e78f8c9b8e3ae106b13d9e2eb1c7b59a73334dffe32feba632e958b1');
  assert.equal(result.admission.stageInstanceDigest, 'fc1842ee254bf9f39cfc65e51f01fdc5ee2a727783397302a905681ac4eb1ad0');
  assert.equal(result.admission.stageAdmissionDigest, '39dca294fd633838e02f5b09dc5707cbf2d2754396fba754bda8fcdb7235c3dc');
  assert.equal(E.leaseCounter, 103);
  assert.equal(E.carrierDenominator, 36);
});

test('WP709 candidate oracle rejects scope, base, ancestry, missing artifact and byte drift', () => {
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ changedPaths: [...ADMITTED, 'src/forbidden-wp709.mjs'].sort() }) }), /E_WP709_EXACT_ADMITTED_DELTA/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ changedPaths: ADMITTED.slice(1) }) }), /E_WP709_EXACT_ADMITTED_DELTA/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ baseTreeDrift: true }) }), /E_WP709_ADMISSION_BASE/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ ancestor: false }) }), /E_WP709_BASE_NOT_ANCESTOR/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ missingArtifact: E.instancePath }) }), /E_WP709_CANDIDATE_ARTIFACT_MISSING/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ byteDrift: E.admissionPath }) }), /E_WP709_CANONICAL_LF/u);
});

test('WP709 candidate oracle rejects evidence erasure, delivery overclaim, release and registry drift', () => {
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_MIXED_CHAIN_PHYSICAL_RECEIPT_V1.json', apply: value => { value.observationFileInjected = false; } } }) }), /E_WP709_PHYSICAL_PASS_RECEIPT/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_MIXED_CHAIN_PHYSICAL_RECEIPT_V1.json', apply: value => { value.googleNative.semanticSha256 = '0'.repeat(64); } } }) }), /E_WP709_PHYSICAL_PASS_RECEIPT/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_EFFECTIVE_STATE_V1.json', apply: value => { value.status = 'DONE'; } } }) }), /E_WP709_CONDITIONAL_DELIVERY_STATE/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_TERMINAL_RECEIPT_V1.json', apply: value => { value.blocker = { code: 'OBSOLETE_BLOCKER' }; } } }) }), /E_WP709_CONDITIONAL_DELIVERY_STATE/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_LEASE_RELEASE_V1.json', apply: value => { value.currentLease.wip = 0; } } }) }), /E_WP709_CONDITIONAL_DELIVERY_STATE/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_LEASE_RELEASE_V1.json', apply: value => { value.currentLease.status = 'RELEASED'; } } }) }), /E_WP709_CONDITIONAL_DELIVERY_STATE/u);
  assert.throws(() => verifyWp709MainProductPostEvaluationException({ git: fakeGit({ mutateJson: { path: 'docs/OPS/R24/CORRECTIVE/WP709_CARRIER_REGISTRY_V1.json', apply: value => { value.currentTreeFallbackAllowed = true; } } }) }), /E_WP709_CARRIER_DENOMINATOR/u);
});

test('WP709 routing pins the WP707 oracle to the immutable WP709 base', () => {
  const source = fs.readFileSync('scripts/ops/r24/corrective/post-audit-certification-set.mjs', 'utf8');
  assert.match(source, /const wp709Enabled=allowMainProductWp709Admission/u);
  assert.match(source, /verifyWp707MainProductPostEvaluationException\(\{candidateSha:wp709Enabled\?WP709_MAIN_PRODUCT_ADMISSION_EXPECTATION\.baseSha:resolvedCandidate,git\}\)/u);
  assert.match(source, /verifyWp709MainProductPostEvaluationException\(\{candidateSha:pk1r1Enabled\?PK1R1_MAIN_PRODUCT_ADMISSION_EXPECTATION\.baseSha:resolvedCandidate,git\}\)/u);
  assert.match(source, /allowAuditCycle2Admission:options\['audit-cycle2-admission'\]===true,allowMainProductWp709Admission:true/u);
});

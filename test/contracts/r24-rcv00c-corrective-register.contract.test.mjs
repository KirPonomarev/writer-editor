import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RCV00C_BASE_SHA,
  RCV00C_BASE_TREE,
  RCV00C_CONTOUR_ID,
  RCV00C_EXPECTED_CURRENT_OBSERVATION_COUNT,
  RCV00C_EXPECTED_FINDING_COUNT,
  RCV00C_REGISTER_ID,
  RCV00C_REGISTER_PATH,
  RCV00C_REGISTER_SCHEMA_VERSION,
  buildCorrectiveRegister,
  validateCorrectiveRegister,
} from '../../scripts/ops/r24/corrective/rcv00c-corrective-register.mjs';
import { readJsonBounded } from '../../scripts/ops/r24/canonical-json.mjs';

const ACTIVE_FINDINGS = ['GOV-01', 'GOV-07', 'OPS-03'];

const clone = (value) => structuredClone(value);
const load = () => readJsonBounded(RCV00C_REGISTER_PATH);

test('RCV00C register regenerates the exact plan crosswalk without graph promotion', () => {
  const register = load();
  const generated = buildCorrectiveRegister({ generatedAtUtc: register.generatedAtUtc });
  const result = validateCorrectiveRegister(register);

  assert.deepEqual(register, generated);
  assert.equal(result.status, 'PASS');
  assert.equal(result.registerId, RCV00C_REGISTER_ID);
  assert.equal(result.contourId, RCV00C_CONTOUR_ID);
  assert.equal(register.schemaVersion, RCV00C_REGISTER_SCHEMA_VERSION);
  assert.equal(register.generatedFrom.baseSha, RCV00C_BASE_SHA);
  assert.equal(register.generatedFrom.baseTree, RCV00C_BASE_TREE);
  assert.equal(register.findings.length, RCV00C_EXPECTED_FINDING_COUNT);
  assert.equal(register.currentObservations.length, RCV00C_EXPECTED_CURRENT_OBSERVATION_COUNT);
  assert.equal(new Set(register.findings.map((finding) => finding.findingId)).size, RCV00C_EXPECTED_FINDING_COUNT);
  assert.equal(register.graphBinding.createsGraphNode, false);
  assert.equal(register.graphBinding.correctiveContoursAreGraphNodes, false);
  assert.equal(register.findings.every((finding) => typeof finding.primaryContourId === 'string' && finding.primaryContourId.length > 0), true);
  assert.equal(register.findings.every((finding) => finding.secondaryContourIds.length === 0), true);
  assert.deepEqual(register.findings.filter((finding) => finding.status === 'ACTIVE_CONFIRMED').map((finding) => finding.findingId).sort(), ACTIVE_FINDINGS);
});

test('RCV00C records the packaged export bridge defect as a current observation, not a graph node', () => {
  const register = load();
  const observation = register.currentObservations[0];

  assert.equal(observation.observationId, 'OBS-EXPORT-DOCX-MIN-COMMAND-BRIDGE-OUTER-FAIL-20260909');
  assert.equal(observation.primaryContourId, 'R24-RCV-00D');
  assert.equal(observation.mappedExistingGraphNode, 'NO_GRAPH_NODE');
  assert.equal(observation.graphPromotionAllowed, false);
  assert.match(observation.evidence.exactArtifactSha256, /^[0-9a-f]{64}$/);
  assert.equal(observation.evidence.actual.includes('outer UI Command Bridge reports ok false'), true);
  assert.deepEqual(observation.successorRequirement.requiredCoverage, [
    'FAILURE_AFTER_SIDE_EFFECT',
    'RETRY_AFTER_OUTER_COMMAND_FAILURE',
  ]);
  assert.equal(observation.successorRequirement.forbiddenFixes.includes('GLOBAL_TRUTHY_OK_WEAKENING'), true);
});

test('RCV00C active-confirmed findings carry full bounded evidence shape', () => {
  const register = load();
  for (const finding of register.findings.filter((entry) => entry.status === 'ACTIVE_CONFIRMED')) {
    assert.equal(finding.evidence.evidenceId, finding.sourceAuditId);
    assert.match(finding.evidence.exactSha, /^[0-9a-f]{40}$/);
    for (const key of ['source', 'reproducer', 'expected', 'actual', 'oracleClass', 'claimCeiling']) {
      assert.equal(typeof finding.evidence[key], 'string');
      assert.notEqual(finding.evidence[key], '');
    }
  }
});

test('RCV00C rejects duplicate finding identity', () => {
  const mutant = clone(load());
  mutant.findings[1].findingId = mutant.findings[0].findingId;
  assert.throws(() => validateCorrectiveRegister(mutant), /E_RCV00C_DUPLICATE_FINDING/);
});

test('RCV00C rejects reducer/register disagreement on the primary contour', () => {
  const mutant = clone(load());
  mutant.findings[0].primaryContourId = 'PK1_RELEASE_SECURITY_PHYSICAL';
  assert.throws(() => validateCorrectiveRegister(mutant), /E_RCV00C_PLAN_REGISTER_DISAGREEMENT/);
});

test('RCV00C rejects graph reducer/register disagreement without relying on plan text equality', () => {
  const mutant = clone(load());
  const recordedGraphOpen = mutant.findings.find((finding) => finding.status === 'RECORDED_GRAPH_OPEN');
  recordedGraphOpen.mappedExistingGraphNode = 'R24C0_SEMANTIC_PACKAGE_CLOSURE';
  assert.throws(() => validateCorrectiveRegister(mutant), /E_RCV00C_REDUCER_REGISTER_DISAGREEMENT/);
});

test('RCV00C rejects forged but nonempty active evidence fields', () => {
  const mutant = clone(load());
  const active = mutant.findings.find((finding) => finding.findingId === 'GOV-01');
  active.evidence = {
    evidenceId: active.sourceAuditId,
    exactSha: 'f'.repeat(40),
    source: 'FORGED',
    reproducer: 'FORGED',
    expected: 'FORGED',
    actual: 'FORGED',
    oracleClass: 'FORGED',
    claimCeiling: 'FORGED',
  };
  assert.throws(() => validateCorrectiveRegister(mutant), /E_RCV00C_ACTIVE_EVIDENCE_BINDING/);
});

test('RCV00C rejects forged closure receipt and deleted history while counts remain stable', () => {
  const closureMutant = clone(load());
  closureMutant.findings[0].closureReceiptDigest = 'f'.repeat(64);
  closureMutant.findings[0].mergedSha = 'f'.repeat(40);
  closureMutant.findings[0].lastTransition = 'CLOSED';
  closureMutant.findings[0].fencingCounter = 99;
  assert.equal(closureMutant.findings.length, RCV00C_EXPECTED_FINDING_COUNT);
  assert.throws(() => validateCorrectiveRegister(closureMutant), /E_RCV00C_PLAN_REGISTER_DISAGREEMENT/);

  const historyMutant = clone(load());
  delete historyMutant.findings[0].historicalPredecessor;
  assert.equal(historyMutant.findings.length, RCV00C_EXPECTED_FINDING_COUNT);
  assert.throws(() => validateCorrectiveRegister(historyMutant), /E_RCV00C_PLAN_REGISTER_DISAGREEMENT/);
});

test('RCV00C rejects status policy downgrade without changing finding counts', () => {
  const mutant = clone(load());
  mutant.statusPolicy.onePrimaryContourPerFinding = false;
  mutant.statusPolicy.noGraphPromotionFromNoGraphNode = false;
  assert.equal(mutant.findings.length, RCV00C_EXPECTED_FINDING_COUNT);
  assert.throws(() => validateCorrectiveRegister(mutant), /E_RCV00C_STATUS_POLICY/);
});

test('RCV00C rejects forged current observation evidence and graph promotion', () => {
  const forgedEvidence = clone(load());
  forgedEvidence.currentObservations[0].evidence = {
    evidenceId: forgedEvidence.currentObservations[0].sourceAuditId,
    exactArtifactSha256: 'f'.repeat(64),
    source: 'FORGED',
    reproducer: 'FORGED',
    expected: 'FORGED',
    actual: 'FORGED',
    oracleClass: 'FORGED',
    claimCeiling: 'FORGED',
  };
  assert.throws(() => validateCorrectiveRegister(forgedEvidence), /E_RCV00C_CURRENT_OBSERVATION_EVIDENCE_BINDING/);

  const promoted = clone(load());
  promoted.currentObservations[0].graphPromotionAllowed = true;
  assert.throws(() => validateCorrectiveRegister(promoted), /E_RCV00C_CURRENT_OBSERVATION_GRAPH_PROMOTION/);
});

test('RCV00C rejects graph-node creation by register metadata', () => {
  const mutant = clone(load());
  mutant.graphBinding.createsGraphNode = true;
  assert.throws(() => validateCorrectiveRegister(mutant), /E_RCV00C_GRAPH_BINDING/);
});

test('RCV00C rejects missing active evidence and non-active evidence smuggling', () => {
  const missing = clone(load());
  missing.findings.find((finding) => finding.findingId === 'GOV-01').evidence = null;
  assert.throws(() => validateCorrectiveRegister(missing), /E_RCV00C_ACTIVE_EVIDENCE/);

  const smuggled = clone(load());
  const inactive = smuggled.findings.find((finding) => finding.status !== 'ACTIVE_CONFIRMED');
  inactive.evidence = { evidenceId: inactive.sourceAuditId };
  assert.throws(() => validateCorrectiveRegister(smuggled), /E_RCV00C_NON_ACTIVE_EVIDENCE/);
});

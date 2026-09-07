import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { buildClaimBinding } from '../../scripts/ops/r24/claim-binding.mjs';
import { HISTORICAL_INVENTORY_CLAIM_PINS_V21 } from '../../scripts/ops/r24/docs-claim-lint.mjs';

const C = 'docs/OPS/R24/CORRECTIVE/';
const h = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const names = [
  'ACCEPTANCE_MATRIX', 'CARRIER_REGISTRY', 'EFFECTIVE_GRAPH_BASELINE', 'EFFECTIVE_STATE',
  'FEATURE_INTEGRATION_MANIFEST', 'FIXTURE_MANIFEST', 'GOVERNANCE_CHANGE_APPROVALS', 'LEASE_RELEASE',
  'MAIN_PRODUCT_SELECTION_RECEIPT', 'MIXED_CHAIN_CONTRACT', 'MIXED_CHAIN_PHYSICAL_RECEIPT',
  'STAGE_REGISTRY', 'TERMINAL_RECEIPT', 'WP707_TERMINAL_PREDECESSOR',
];
const load = () => Object.fromEntries(names.map(name => [name, read(`${C}WP709_${name}_V1.json`)]));

function verify(value) {
  const contract = value.MIXED_CHAIN_CONTRACT;
  const physical = value.MIXED_CHAIN_PHYSICAL_RECEIPT;
  const effective = value.EFFECTIVE_STATE;
  const release = value.LEASE_RELEASE;
  const terminal = value.TERMINAL_RECEIPT;
  assert.equal(contract.chainDenominator, 7);
  assert.equal(contract.chains.length, 7);
  assert.deepEqual(contract.chains.map(chain => chain.route.length), [3, 5, 5, 4, 5, 4, 4]);
  assert.equal(new Set(contract.chains.map(chain => chain.id)).size, 7);
  assert.equal(contract.invariants.routePassInheritanceAllowed, false);
  assert.equal(contract.invariants.cumulativeLossMonotoneAndHashLinked, true);
  assert.equal(contract.providerBoundary.googleOfficeCompatFreshQualificationRequired, true);
  assert.equal(contract.providerBoundary.wp707OrWp708PassInheritanceAllowed, false);
  assert.equal(contract.providerBoundary.automaticApply, false);
  assert.equal(contract.providerBoundary.multiSceneApply, false);
  assert.equal(contract.providerBoundary.productRuntimeNetwork, false);
  assert.equal(contract.status, 'PASS');
  assert.equal(physical.status, 'PASS');
  assert.equal(physical.observationFileInjected, true);
  assert.equal(physical.observationSha256, '12c3322d6e26050fe122679a722484cca8e1092e02b8c8851f8cbc61798939aa');
  assert.equal(physical.compiledResultDigest, 'aeb728c2a760eee0e9f52abc4d8a115e4513c9eb6c37443dc6f3d0fdfaebfaa3');
  assert.equal(physical.compiledReceiptSha256, '3794015edcb0130c8d88fa8a0bcf469eefc00c7cff3b55e1128d419a991cffdb');
  assert.equal(physical.exactPassCount, 7);
  assert.equal(physical.stageDone, true);
  assert.equal(physical.routes.length, 7);
  assert.deepEqual(physical.routes.map(route => route.chainId), contract.chains.map(chain => chain.id));
  assert(physical.routes.every(route => route.status === 'PASS'));
  assert(physical.routes.every(route => route.inheritedEvidence === false));
  assert.equal(physical.googleOfficeCompat.qualification, 'QUALIFIED_WP709_FRESH_PHYSICAL');
  assert.equal(physical.googleOfficeCompat.wp708Disposition, 'INPUT_CONTEXT_ONLY_NO_PASS_INHERITANCE');
  assert.equal(physical.googleOfficeCompat.blocksStageDone, false);
  assert.equal(physical.word.observation, 'PASS');
  assert.equal(physical.googleNative.yalkenImport, 'PASS');
  assert.equal(physical.googleNative.preflightCode, 'STAGE02_GATE_PASS');
  assert.equal(physical.googleNative.sourceCode, 'DOCX_ZIP_DATA_DESCRIPTOR_VALIDATED');
  assert.equal(physical.googleNative.offendingEntry, null);
  assert.equal(physical.googleNative.semanticSha256, 'ce230267f2de410d15a0c6b42ec1f574a44727a74eeefa1abc63ac9ba2df8da3');
  assert.equal(physical.googleNative.reparseOracleSha256, '4bb7629b71e78ed69cfd4f0bb0853001e88ccc913be3244db8396e4de7953194');
  assert.equal(physical.cleanup.providerArtifactsRemaining, 0);
  assert.equal(physical.cleanup.verification, 'COMPLETE_ZERO_REMAINING');
  assert.equal(value.FEATURE_INTEGRATION_MANIFEST.security.providerWritesInProductRuntime, false);
  assert.equal(value.FEATURE_INTEGRATION_MANIFEST.security.defaultEffectAdmission, 'DENY');
  assert.equal(value.FIXTURE_MANIFEST.modes.every(mode => mode.physicalEvidence === false), true);
  assert.equal(value.WP707_TERMINAL_PREDECESSOR.maySeedWp709RoutePass, false);
  assert.equal(value.WP707_TERMINAL_PREDECESSOR.wip, 0);
  assert.equal(effective.status, 'CONDITIONAL_DONE_PENDING_REQUIRED_DELIVERY');
  assert.equal(effective.stageDone, true);
  assert.equal(effective.googleOfficeCompatQualified, true);
  assert.deepEqual(effective.targetCounts, { BLOCKED_TYPED: 2, DONE: 90, INELIGIBLE_OPTIONAL: 10, PENDING: 7 });
  assert.deepEqual(effective.transition, {
    nodeId: 'WP-709_MIXED_CHAINS',
    from: 'PENDING',
    to: 'DONE',
    reason: 'SEVEN_EXACT_ROUTE_ORACLES_VERIFIED_WITH_GOOGLE_OFFICE_COMPAT_QUALIFIED_PENDING_REQUIRED_DELIVERY',
  });
  assert.deepEqual(effective.routeEvidence, { denominator: 7, exactRoutePasses: 7, blockedTyped: 0, externalPending: 0 });
  assert.equal(release.status, 'CONDITIONAL_RELEASE_PENDING_REQUIRED_DELIVERY');
  assert.equal(release.currentLease.fencingCounter, 103);
  assert.equal(release.currentLease.status, 'ACTIVE');
  assert.equal(release.currentLease.wip, 1);
  assert.equal(release.targetLease.fencingCounter, 103);
  assert.equal(release.targetLease.status, 'RELEASED');
  assert.equal(release.targetLease.wip, 0);
  assert.equal(release.releaseForbiddenUntilRequiredDeliveryVerified, true);
  assert.equal(terminal.status, 'CONDITIONAL_DONE_PENDING_REQUIRED_LOCAL_AND_EXTERNAL_DELIVERY_PREDICATES');
  assert.equal(terminal.stageDone, true);
  assert.deepEqual(terminal.routeEvidence, {
    denominator: 7,
    verifiedPass: 7,
    blockedTyped: 0,
    requiredNotPreclaimed: 0,
    googleOfficeCompatQualified: true,
  });
  assert.equal(terminal.blocker, null);
  const delivery = Object.fromEntries(terminal.requiredDeliveryPredicates.map(item => [item.id, item.status]));
  assert.deepEqual(delivery, {
    WORD_PHYSICAL: 'PASS',
    GOOGLE_NATIVE_PHYSICAL: 'PASS',
    GOOGLE_OFFICE_COMPAT_PHYSICAL: 'PASS',
    ALL_SEVEN_ROUTE_ORACLES: 'PASS_7_OF_7',
    COMMIT: 'PENDING',
    PUSH: 'PENDING',
    PULL_REQUEST: 'PENDING',
    CANDIDATE_CI: 'PENDING',
    PROTECTED_MERGE: 'PENDING',
    EXACT_POSTMERGE_CI: 'PENDING',
    EXTERNAL_TERMINAL_AND_LEASE_RELEASE: 'PENDING',
  });
  assert.equal(value.ACCEPTANCE_MATRIX.denominator, 24);
  assert.equal(value.ACCEPTANCE_MATRIX.rows.length, 24);
  assert(value.ACCEPTANCE_MATRIX.rows.some(row => row.id === 'GOOGLE_NATIVE_AND_GOOGLE_OFFICE_COMPAT_OWN_CHAIN_EVIDENCE' && row.status === 'SATISFIED_PHYSICAL'));
  assert(value.ACCEPTANCE_MATRIX.rows.some(row => row.id === 'NORMAL_PROTECTED_MERGE_EXACT_POSTMERGE_AND_TERMINAL_RELEASE' && row.status === 'REQUIRED_NOT_PRECLAIMED'));
  assert(value.ACCEPTANCE_MATRIX.rows.some(row => row.id === 'WP709_FENCE_103_RELEASED_WIP_0' && row.status === 'REQUIRED_NOT_PRECLAIMED'));
  for (const carrier of Object.values(value)) if (Object.hasOwn(carrier, 'programDone')) assert.equal(carrier.programDone, false);
}

test('WP709 carriers preserve the exact seven-chain denominator and conditional terminal state', () => {
  const value = load();
  verify(value);
  assert.equal(h(fs.readFileSync(`${C}WP709_MAIN_PRODUCT_OWNER_AUTHORITY_V1.json`)), 'e76042b149a8569877512c55a6cd925af9b614258bf13a6694704e236fde8c64');
  assert.equal(h(fs.readFileSync(`${C}WP709_MAIN_PRODUCT_STAGE_INSTANCE_V1.json`)), '26a87057fa50bb2bac47e16d41d8336704bd474ada90ec786e242e49794b635f');
  assert.equal(h(fs.readFileSync(`${C}WP709_MAIN_PRODUCT_STAGE_ADMISSION_ATTESTATION_V1.json`)), '031d3fe3b79067cd5faafd03e3ee617b097b9152ef1fc23e3ccb7af5e4826557');
  assert.equal(h(fs.readFileSync(`${C}WP709_QUALIFIED_PROVIDER_SET_OWNER_DECISION_V1.json`)), 'b46be7de3995e544a3e3081254cc4b28ac6a5af4da9fda59b506d6e01daaf220');
  assert.equal(h(fs.readFileSync(`${C}WP709_PROTECTED_WIP_BEFORE_V1.json`)), '6f543806e2e10eddbe093f880fb87c991b1af794307a7d45c0301a4be8d86e6b');
  assert.equal(h(fs.readFileSync(`${C}WP709_MAIN_PRODUCT_OWNER_AUTHORITY_AMENDMENT_V1.json`)), '43108447e78f8c9b8e3ae106b13d9e2eb1c7b59a73334dffe32feba632e958b1');
  assert.equal(h(fs.readFileSync(`${C}WP709_MAIN_PRODUCT_STAGE_INSTANCE_V2.json`)), 'fc1842ee254bf9f39cfc65e51f01fdc5ee2a727783397302a905681ac4eb1ad0');
  assert.equal(h(fs.readFileSync(`${C}WP709_MAIN_PRODUCT_STAGE_ADMISSION_ATTESTATION_V2.json`)), '39dca294fd633838e02f5b09dc5707cbf2d2754396fba754bda8fcdb7235c3dc');
});

test('WP709 registry covers every non-dependent admitted candidate byte without fallback', () => {
  const instance = read(`${C}WP709_MAIN_PRODUCT_STAGE_INSTANCE_V2.json`);
  const registry = read(`${C}WP709_CARRIER_REGISTRY_V1.json`);
  const admitted = [...instance.operations.modifyPaths, ...instance.operations.createPaths].sort();
  assert.equal(admitted.length, 44);
  assert.equal(registry.carrierDenominator, 36);
  assert.equal(registry.currentTreeFallbackAllowed, false);
  assert.deepEqual([...registry.carriers.map(binding => binding.path), ...registry.excludedDependentCarriers].sort(), admitted);
  for (const binding of registry.carriers) {
    const bytes = fs.readFileSync(binding.path);
    assert.equal(h(bytes), binding.sha256, binding.path);
    assert.equal(bytes.length, binding.byteLength, binding.path);
  }
});

test('WP709 claim binding is schema-valid and WP707 inventory bytes remain historically pinned', () => {
  const claim = buildClaimBinding(read('docs/OPS/R24/EVIDENCE/ES-R24-WP-709-MIXED-CHAINS-CLAIM-BINDINGS.json'));
  for (const binding of claim.claimBindings) assert.equal(h(fs.readFileSync(binding.filePath)), binding.sha256, binding.filePath);
  assert.deepEqual(HISTORICAL_INVENTORY_CLAIM_PINS_V21.at(-1), {
    stampId: 'ES-R24-WP-707-WORD-APPLY-CLAIM-BINDINGS',
    stampSha256: '445f8cc6f3f94f1566979c4d33c406d83da535573f6be9235bd98ee68faaf802',
    evaluationSha: '098c1d1ed7aa47277807f1719f6720e27f9b31eb',
    evaluationTree: '1a10ed79200f29c9bc6a9615b7d5a2827c426f33',
    targetSha256: 'f25bfb8ed27967794bded880cbdc569ff03dad9ae2b38d80353c9e9f9fd6c88b',
  });
});

test('WP709 carrier mutants cannot erase exact evidence or preclaim delivery and lease release', () => {
  const mutations = [
    value => { value.MIXED_CHAIN_PHYSICAL_RECEIPT.observationFileInjected = false; },
    value => { value.MIXED_CHAIN_PHYSICAL_RECEIPT.googleOfficeCompat.qualification = 'REQUIRED_NOT_PRECLAIMED'; },
    value => { value.MIXED_CHAIN_PHYSICAL_RECEIPT.googleNative.semanticSha256 = '0'.repeat(64); },
    value => { value.MIXED_CHAIN_PHYSICAL_RECEIPT.googleNative.reparseOracleSha256 = '0'.repeat(64); },
    value => { value.TERMINAL_RECEIPT.requiredDeliveryPredicates.find(item => item.id === 'COMMIT').status = 'PASS'; },
    value => { value.ACCEPTANCE_MATRIX.rows.find(row => row.id === 'NORMAL_PROTECTED_MERGE_EXACT_POSTMERGE_AND_TERMINAL_RELEASE').status = 'SATISFIED'; },
    value => { value.LEASE_RELEASE.currentLease.wip = 0; },
    value => { value.LEASE_RELEASE.currentLease.status = 'RELEASED'; },
    value => { value.LEASE_RELEASE.releaseForbiddenUntilRequiredDeliveryVerified = false; },
    value => { value.TERMINAL_RECEIPT.programDone = true; },
    value => { value.MIXED_CHAIN_CONTRACT.providerBoundary.wp707OrWp708PassInheritanceAllowed = true; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const value = structuredClone(load());
    mutate(value);
    assert.throws(() => verify(value), undefined, `carrier mutant ${index + 1}`);
  }
});

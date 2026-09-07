'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../fixtures/r24-wp709-mixed-chain-fixtures.js');
const load = () => import('../../src/interchange/mixed-chain-fidelity-v1.mjs');

test('WP709 seals the exact seven-chain denominator and remains conditional without physical observations', async () => {
  const api = await load();
  const input = await f.makeWp709Fixture({ physical: 'pending' });
  const before = JSON.stringify(input);
  const compiled = api.compileMixedChainEvidence(input);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  assert.equal(compiled.result.chainDenominator, 7);
  assert.equal(compiled.result.exactPassCount, 4);
  assert.equal(compiled.result.status, 'PENDING_EXTERNAL_PHYSICAL');
  assert.equal(compiled.result.stageDone, false);
  assert.equal(compiled.result.programDone, false);
  assert.equal(compiled.result.googleOfficeCompatQualified, false);
  assert.equal(compiled.result.chains[1].status, 'PENDING_EXTERNAL_PHYSICAL');
  assert.equal(compiled.result.chains[2].status, 'ABSTAIN_TYPED');
  assert.equal(compiled.result.chains[3].status, 'PENDING_EXTERNAL_PHYSICAL');
  assert.equal(JSON.stringify(input), before);
  assert(Object.isFrozen(compiled.result));
  assert(Object.isFrozen(compiled.result.chains[0].hops[0]));
});

test('WP709 accepts a fully independent synthetic test corpus without inheriting any prior route PASS', async () => {
  const api = await load();
  const input = await f.makeWp709Fixture({ physical: 'pass' });
  const compiled = api.compileMixedChainEvidence(input);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  assert.equal(compiled.result.exactPassCount, 7);
  assert.equal(compiled.result.googleOfficeCompatQualified, true);
  assert.equal(compiled.result.stageDone, true);
  assert.equal(compiled.result.status, 'PASS');
  const atoms = compiled.result.chains.flatMap(chain => [
    ...chain.hops.map(hop => hop.evidence.atomSha256),
    chain.finalOracle.oracleAtomSha256,
  ]);
  assert.equal(new Set(atoms).size, atoms.length);
  assert.equal(compiled.result.distinctEvidenceAtomDenominator, atoms.length);
  assert(compiled.result.chains.every(chain => chain.hops.every(hop => hop.evidence.provenanceStageId === api.WP709_STAGE_ID)));
  assert.equal(compiled.result.chains[2].hops[1].profileId, 'GOOGLE_OFFICE_COMPAT_WP709_V1');
});

test('WP709 rolls one typed Native blocker over six exact route passes', async () => {
  const api = await load();
  const compiled = api.compileMixedChainEvidence(await f.makeWp709Fixture({ physical: 'blocked-native' }));
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  assert.equal(compiled.result.exactPassCount, 6);
  assert.equal(compiled.result.chains[3].status, 'BLOCKED_TYPED');
  assert.deepEqual(compiled.result.chains[3].hops.map(hop => hop.status), ['PASS', 'PASS', 'BLOCKED_TYPED']);
  assert.equal(compiled.result.googleOfficeCompatQualified, true);
  assert.equal(compiled.result.status, 'BLOCKED_TYPED');
  assert.equal(compiled.result.stageDone, false);
  assert.equal(compiled.result.programDone, false);
});

test('WP709 cumulative losses are previewable, monotone and visible to the final independent oracle', async () => {
  const api = await load();
  const compiled = api.compileMixedChainEvidence(await f.makeWp709Fixture({ physical: 'pass' }));
  assert.equal(compiled.ok, true);
  const markdown = compiled.result.chains[4];
  const lossCounts = markdown.hops.map(hop => hop.lossLedger.entries.length);
  assert.deepEqual(lossCounts, [1, 1, 1, 1]);
  assert(markdown.hops.every(hop => hop.lossLedger.entries[0].previewable === true));
  assert(markdown.hops.slice(1).every((hop, index) => hop.lossLedger.previousDigest === markdown.hops[index].lossLedger.digest));
  assert.equal(markdown.finalOracle.fieldOutcomes.find(field => field.fieldId === 'COMMENT_ANCHORS').outcome, 'LOSS');
  assert.equal(markdown.finalOracle.independent, true);
  assert(!markdown.finalOracle.producerIds.includes(markdown.finalOracle.oracleId));
});

test('WP709 provider effect admission is pure, single-target and default-deny', async () => {
  const api = await load();
  const valid = f.makeWp709EffectAdmissionFixture();
  const before = JSON.stringify(valid);
  const eligible = api.evaluateMixedChainEffectAdmission(valid);
  assert.equal(eligible.ok, true);
  assert.equal(eligible.decision, 'ELIGIBLE_REQUIRES_EXTERNAL_EXECUTOR');
  assert.equal(eligible.performsIo, false);
  assert.equal(eligible.providerEffectAuthority, false);
  assert.equal(eligible.productMutationAuthority, false);
  assert.equal(eligible.requiresCommandKernelRevalidation, true);
  assert.equal(JSON.stringify(valid), before);

  const denied = [
    input => { input.capability.status = 'APPROVED_GLOBAL'; },
    input => { input.intent.artifactCount = 2; },
    input => { input.intent.automaticApply = true; },
    input => { input.intent.multiSceneApply = true; },
    input => { input.intent.userDocument = true; },
    input => { input.current.generation += 1; },
    input => { input.current.sourceRevision = 'stale'; },
    input => { input.current.targetOwnership = 'PREEXISTING'; },
    input => { input.current.nowUtc = '2026-09-06T12:00:01.000Z'; },
  ];
  for (const mutate of denied) {
    const input = f.cloneWp709Fixture(valid);
    mutate(input);
    const result = api.evaluateMixedChainEffectAdmission(input);
    assert.equal(result.ok, false);
    assert.equal(result.decision, 'DENY');
    assert.equal(result.effectEligible, false);
  }

  let proxyTrapCalls = 0;
  const hostileProxy = new Proxy(valid, {
    getPrototypeOf() {
      proxyTrapCalls += 1;
      throw new Error('proxy trap must not run');
    },
  });
  assert.equal(api.evaluateMixedChainEffectAdmission(hostileProxy).ok, false);
  assert.equal(proxyTrapCalls, 0);
});

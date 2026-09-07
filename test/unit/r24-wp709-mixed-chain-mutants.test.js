'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const f = require('../fixtures/r24-wp709-mixed-chain-fixtures.js');

const subjectPath = path.resolve(__dirname, '../../src/interchange/mixed-chain-fidelity-v1.mjs');
const load = () => import(pathToFileURL(subjectPath).href);

test('WP709 hostile observation mutants fail closed at the named invariant', async t => {
  const api = await load();
  const valid = await f.makeWp709Fixture({ physical: 'pass' });
  const cases = [
    ['extra envelope authority', input => { input.effectAuthority = true; }, 'WP709_EXACT_SHAPE'],
    ['non-NFC identity', input => { input.identity.entityId = 'e\u0301'; }, 'WP709_STRING_INVALID'],
    ['wrong chain order', input => { [input.chains[0], input.chains[1]] = [input.chains[1], input.chains[0]]; }, 'WP709_CHAIN_ORDER_MISMATCH'],
    ['wrong hop order', input => { input.chains[0].hops[0].hopIndex = 1; }, 'WP709_HOP_ORDER_OR_PROFILE_MISMATCH'],
    ['wrong schema', input => { input.chains[0].hops[0].schemaId = 'FOREIGN_SCHEMA'; }, 'WP709_HOP_ORDER_OR_PROFILE_MISMATCH'],
    ['wrong capability', input => { input.chains[0].hops[0].capabilityId = 'GLOBAL_WRITE'; }, 'WP709_HOP_ORDER_OR_PROFILE_MISMATCH'],
    ['stale generation', input => { input.chains[0].hops[0].identity.generation += 1; }, 'WP709_HOP_IDENTITY_MISMATCH'],
    ['artifact chain break', input => { input.chains[0].hops[1].sourceArtifactSha256 = '1'.repeat(64); }, 'WP709_ARTIFACT_CHAIN_BROKEN'],
    ['tampered evidence', input => { input.chains[0].hops[0].evidence.observerId = 'WP709_TAMPERED'; }, 'WP709_EVIDENCE_HASH_MISMATCH'],
    ['prior-stage evidence', input => { const hop = input.chains[0].hops[0]; const body = { ...hop.evidence, provenanceStageId: 'WP-708_GOOGLE_PROVIDER' }; delete body.atomSha256; hop.evidence = api.sealMixedChainEvidenceAtom(body); }, 'WP709_EVIDENCE_IDENTITY_MISMATCH'],
    ['producer reparse', input => { input.chains[0].hops[0].reparse.parserId = input.chains[0].hops[0].producerId; }, 'WP709_REPARSE_NOT_INDEPENDENT'],
    ['silent loss ledger', input => { input.chains[4].hops[0].lossLedger.entries = []; }, 'WP709_LEDGER_HASH_MISMATCH'],
    ['downstream loss erasure', input => { input.chains[4].hops[1].fieldOutcomes[1] = { fieldId: 'COMMENT_ANCHORS', outcome: 'PRESERVED' }; }, 'WP709_DOWNSTREAM_ERASED_UPSTREAM_LOSS'],
    ['broken ledger hash link', input => { input.chains[4].hops[1].lossLedger.previousDigest = '2'.repeat(64); }, 'WP709_LEDGER_LINK_MISMATCH'],
    ['mutated report source', input => { input.chains[0].reportOnlySource.afterSha256 = '3'.repeat(64); }, 'WP709_REPORT_SOURCE_MUTATED'],
    ['non-independent oracle', input => { input.chains[0].finalOracle.oracleId = input.chains[0].hops[0].producerId; }, 'WP709_FINAL_ORACLE_NOT_INDEPENDENT'],
    ['oracle hides cumulative loss', input => { input.chains[4].finalOracle.fieldOutcomes[1] = { fieldId: 'COMMENT_ANCHORS', outcome: 'PRESERVED' }; }, 'WP709_FINAL_ORACLE_ERASED_LOSS'],
    ['unclean pass', input => { input.chains[0].cleanup.remainingArtifacts = 1; }, 'WP709_PASS_WITHOUT_COMPLETE_EVIDENCE'],
    ['WP708 Office profile inheritance', input => { input.chains[2].hops[1].profileId = 'GOOGLE_OFFICE_MODE_ABSTAIN_V1'; }, 'WP709_HOP_ORDER_OR_PROFILE_MISMATCH'],
  ];
  for (const [name, mutate, expected] of cases) {
    const input = f.cloneWp709Fixture(valid);
    mutate(input);
    const result = api.compileMixedChainEvidence(input);
    assert.equal(result.ok, false, name);
    assert.equal(result.code, expected, name);
  }
  const officePending = await f.makeWp709Fixture({ physical: 'pending' });
  officePending.chains[2].status = 'PENDING_EXTERNAL_PHYSICAL';
  officePending.chains[2].hops.slice(1).forEach(hop => { hop.status = 'PENDING_EXTERNAL_PHYSICAL'; });
  assert.equal(api.compileMixedChainEvidence(officePending).code, 'WP709_GOOGLE_OFFICE_MUST_ABSTAIN_OR_BLOCK');
  t.diagnostic(JSON.stringify({ hostileMutants: cases.length + 1, killed: cases.length + 1, survivors: 0 }));
});

test('WP709 kills actual source mutants with behavioral oracles and no import-failure credit', async t => {
  const originalSource = fs.readFileSync(subjectPath, 'utf8');
  const pass = await f.makeWp709Fixture({ physical: 'pass' });
  const pending = await f.makeWp709Fixture({ physical: 'pending' });
  const blocked = await f.makeWp709Fixture({ physical: 'blocked-native' });
  const effect = f.makeWp709EffectAdmissionFixture();
  const original = await load();
  const cases = [
    ['if (utilTypes.isProxy(value)) return false;', '', api => { let calls = 0; const proxy = new Proxy(effect, { getPrototypeOf() { calls += 1; throw new Error('trap'); } }); api.evaluateMixedChainEffectAdmission(proxy); assert.equal(calls, 0); }],
    ["export const WP709_STAGE_ID = 'WP-709_MIXED_CHAINS';", "export const WP709_STAGE_ID = 'WP-709_MIXED_CHAINS_MUTANT';", api => assert.equal(api.compileMixedChainEvidence(pass).ok, true)],
    ['chains.length !== 7', 'chains.length !== 6', api => assert.equal(api.compileMixedChainEvidence(pass).ok, true)],
    ["body.provenanceStageId !== WP709_STAGE_ID", 'false', api => { const input = f.cloneWp709Fixture(pass); const hop = input.chains[0].hops[0]; const body = { ...hop.evidence, provenanceStageId: 'WP-708_GOOGLE_PROVIDER' }; delete body.atomSha256; hop.evidence = api.sealMixedChainEvidenceAtom(body); assert.equal(api.compileMixedChainEvidence(input).ok, false); }],
    ["for (const outcome of outcomes) if (priorLossIds.has(outcome.fieldId) && outcome.outcome !== 'LOSS') failure('WP709_DOWNSTREAM_ERASED_UPSTREAM_LOSS', path);", "for (const outcome of outcomes) if (priorLossIds.has(outcome.fieldId) && false) failure('WP709_DOWNSTREAM_ERASED_UPSTREAM_LOSS', path);", api => { const input = f.cloneWp709Fixture(pass); input.chains[4].hops[1].fieldOutcomes[1] = { fieldId: 'COMMENT_ANCHORS', outcome: 'PRESERVED' }; assert.equal(api.compileMixedChainEvidence(input).ok, false); }],
    ["value.reportOnlySource.unchanged !== true", 'false', api => { const input = f.cloneWp709Fixture(pass); input.chains[0].reportOnlySource.unchanged = false; assert.equal(api.compileMixedChainEvidence(input).ok, false); }],
    ["if (pendingSeen || value.finalOracle === null || value.cleanup.completed !== true || value.cleanup.remainingArtifacts !== 0) failure('WP709_PASS_WITHOUT_COMPLETE_EVIDENCE', path);", "if (pendingSeen || value.finalOracle === null || value.cleanup.completed !== true || false) failure('WP709_PASS_WITHOUT_COMPLETE_EVIDENCE', path);", api => { const input = f.cloneWp709Fixture(pass); input.chains[0].cleanup.remainingArtifacts = 1; assert.equal(api.compileMixedChainEvidence(input).ok, false); }],
    ["!['ABSTAIN_TYPED', 'BLOCKED_TYPED'].includes(status)", 'false', api => { const input = f.cloneWp709Fixture(pending); input.chains[2].status = 'PENDING_EXTERNAL_PHYSICAL'; input.chains[2].hops.slice(1).forEach(hop => { hop.status = 'PENDING_EXTERNAL_PHYSICAL'; }); assert.equal(api.compileMixedChainEvidence(input).ok, false); }],
    ['const stageDone = exactPassCount === 7 && googleOfficeCompatQualified;', 'const stageDone = exactPassCount >= 4;', api => assert.equal(api.compileMixedChainEvidence(pending).result.stageDone, false)],
    ["status: stageDone ? 'PASS' : hasBlockedChain ? 'BLOCKED_TYPED' : 'PENDING_EXTERNAL_PHYSICAL',", "status: stageDone ? 'PASS' : 'PENDING_EXTERNAL_PHYSICAL',", api => assert.equal(api.compileMixedChainEvidence(blocked).result.status, 'BLOCKED_TYPED')],
    ["intent.automaticApply !== false", 'false', api => { const input = f.cloneWp709Fixture(effect); input.intent.automaticApply = true; assert.equal(api.evaluateMixedChainEffectAdmission(input).ok, false); }],
    ["intent.multiSceneApply !== false", 'false', api => { const input = f.cloneWp709Fixture(effect); input.intent.multiSceneApply = true; assert.equal(api.evaluateMixedChainEffectAdmission(input).ok, false); }],
    ['requiresCommandKernelRevalidation: true', 'requiresCommandKernelRevalidation: false', api => assert.equal(api.evaluateMixedChainEffectAdmission(effect).requiresCommandKernelRevalidation, true)],
  ];
  let killed = 0;
  for (const [name, needle, replacement, behavior] of cases.map((entry, index) => [`mutant-${index + 1}`, ...entry])) {
    assert.equal(originalSource.split(needle).length - 1, 1, `${name}: unique mutation anchor`);
    await behavior(original);
    const mutated = originalSource.replace(needle, replacement);
    let api;
    await assert.doesNotReject(async () => { api = await import(`data:text/javascript;base64,${Buffer.from(mutated).toString('base64')}#${name}`); });
    let assertionFailure;
    try { await behavior(api); } catch (error) { assertionFailure = error; }
    assert.equal(assertionFailure?.code, 'ERR_ASSERTION', `${name}: survived`);
    killed += 1;
  }
  assert.equal(killed, cases.length);
  assert.equal(fs.readFileSync(subjectPath, 'utf8'), originalSource);
  t.diagnostic(JSON.stringify({ actualSourceMutants: cases.length, killed, survivors: 0, importFailuresCountedAsKills: false }));
});

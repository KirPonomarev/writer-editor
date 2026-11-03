#!/usr/bin/env node
// R2.4 E0 — implementation mutation suite over the r24 runtime modules.
// Every original semantic sabotage runs in an isolated child at the original
// module URL, preserving repo context without source writes. Only a complete
// matching cohort and genuine assertion failure kills a mutant. Score must be 1.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256hex } from './canonical-json.mjs';
import { createMutationPlan, mutationPreload, evaluateMutationRun, captureMutationEvidence, compactMutationCaseCatalog, restoreMutationCaseCatalog } from './mutation-context.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(MODULE_DIR, 'tests');

export const MUTANTS = Object.freeze([
  {
    id: 'mc-digest-binding-removed',
    file: 'mission-contract.mjs',
    find: 'if (receipt.approvedDigest !== digest) {',
    replace: 'if (false) {',
  },
  {
    id: 'mc-schema-validation-skipped',
    file: 'mission-contract.mjs',
    find: "  assertValidJson(contract, schema, 'E_MISSION_CONTRACT_SCHEMA');",
    replace: '  void schema;',
  },
  {
    id: 'ps-cas-conflict-ignored',
    file: 'plan-state.mjs',
    find: 'if (state.revision !== expectedRevision) {',
    replace: 'if (false) {',
  },
  {
    id: 'ps-transition-law-bypassed',
    file: 'plan-state.mjs',
    find: "if (!allowed.includes(to)) throw new R24Error('E_ILLEGAL_TRANSITION', `${from} -> ${to}`);",
    replace: "if (false) throw new R24Error('E_ILLEGAL_TRANSITION', `${from} -> ${to}`);",
  },
  {
    id: 'ps-terminal-guard-removed',
    file: 'plan-state.mjs',
    find: "if (allowed.length === 0) throw new R24Error('E_TERMINAL_STATE_HAS_NO_OUTGOING', from);",
    replace: "if (false) throw new R24Error('E_TERMINAL_STATE_HAS_NO_OUTGOING', from);",
  },
  {
    id: 'ps-contour-direct-write-allowed',
    file: 'plan-state.mjs',
    find: 'if (afterTransitionControlDigest !== beforeTransitionControlDigest && _contourMutationToken !== CONTOUR_MUTATION_TOKEN) {',
    replace: 'if (false) {',
  },
  {
    id: 'ps-replay-final-state-ignored',
    file: 'plan-state.mjs',
    find: 'if (reconstructed[record.contourId] !== record.to) {',
    replace: 'if (false) {',
  },
  {
    id: 'ps-transition-lease-ignored',
    file: 'plan-state.mjs',
    find: "if (!lease) throw new R24Error('E_TRANSITION_LEASE_REQUIRED', contourId);",
    replace: "if (false) throw new R24Error('E_TRANSITION_LEASE_REQUIRED', contourId);",
  },
  {
    id: 'ps-duplicate-not-suppressed',
    file: 'plan-state.mjs',
    find: '    if (prior) {',
    replace: '    if (false) {',
  },
  {
    id: 'lease-stale-fence-accepted',
    file: 'lease.mjs',
    find: 'if (!Number.isInteger(fencingToken) || fencingToken !== lease.fencingToken) {',
    replace: 'if (false) {',
  },
  {
    id: 'lease-heartbeat-cas-fence-ignored',
    file: 'lease.mjs',
    find: 'return casUpdate(filePath, {\n    expectedRevision,\n    expectedFencingCounter: fencingToken,\n    mutate: (draft) => {\n      const lease = assertLeaseCurrent(draft, { contourId, writerId, fencingToken, now });',
    replace: 'return casUpdate(filePath, {\n    expectedRevision,\n    mutate: (draft) => {\n      const lease = assertLeaseCurrent(draft, { contourId, writerId, fencingToken, now });',
  },
  {
    id: 'lease-release-cas-fence-ignored',
    file: 'lease.mjs',
    find: 'return casUpdate(filePath, {\n    expectedRevision,\n    expectedFencingCounter: fencingToken,\n    mutate: (draft) => {\n      assertLeaseCurrent(draft, { contourId, writerId, fencingToken, now });\n      assertVerifiedDeliveryForLeaseRelease(draft, { contourId, writerId, fencingToken, now, verifiedDelivery });',
    replace: 'return casUpdate(filePath, {\n    expectedRevision,\n    mutate: (draft) => {\n      assertLeaseCurrent(draft, { contourId, writerId, fencingToken, now });\n      assertVerifiedDeliveryForLeaseRelease(draft, { contourId, writerId, fencingToken, now, verifiedDelivery });',
  },
  {
    id: 'lease-release-verification-ignored',
    file: 'lease.mjs',
    find: 'assertVerifiedDeliveryForLeaseRelease(draft, { contourId, writerId, fencingToken, now, verifiedDelivery });',
    replace: 'void verifiedDelivery;',
  },
  {
    id: 'lease-delivered-state-accepted',
    file: 'lease.mjs',
    find: "if (verifiedDelivery.verifiedState !== 'DONE') throw new R24Error('E_DELIVERY_NOT_VERIFIED', contourId);",
    replace: "if (false) throw new R24Error('E_DELIVERY_NOT_VERIFIED', contourId);",
  },
  {
    id: 'lease-release-digest-ignored',
    file: 'lease.mjs',
    find: 'if (canonicalDigest(transition) !== verifiedDelivery.transitionReceiptDigest) {',
    replace: 'if (false) {',
  },
  {
    id: 'lease-blind-takeover-allowed',
    file: 'lease.mjs',
    find: "if (!reconcile || reconcile.leaseState !== 'EXPIRED' || !reconcile.lease || reconcile.lease.contourId !== contourId) {",
    replace: 'if (false) {',
  },
  {
    id: 'lease-fencing-not-monotonic',
    file: 'lease.mjs',
    find: 'draft.fencingCounter += 1;\n      const lease = {\n        contourId,\n        writerId,\n        missionId,\n        leaseRevision: (existing ? existing.leaseRevision : 0) + 1,',
    replace: 'const lease = {\n        contourId,\n        writerId,\n        missionId,\n        leaseRevision: (existing ? existing.leaseRevision : 0) + 1,',
  },
  {
    id: 'sched-guard-not-preempting',
    file: 'scheduler.mjs',
    find: "if (guard && guard.state !== 'CURRENT') {",
    replace: 'if (false) {',
  },
  {
    id: 'sched-approval-ignored',
    file: 'scheduler.mjs',
    find: '  if (!mission.approved) {',
    replace: '  if (false) {',
  },
  {
    id: 'sched-dependency-ignored',
    file: 'scheduler.mjs',
    find: 'return node.dependsOn.every((dep) => {',
    replace: 'return true || node.dependsOn.every((dep) => {',
  },
  {
    id: 'sched-state-binding-ignored',
    file: 'scheduler.mjs',
    find: "if (mission.contourStatesDigest !== canonicalDigest(contourStates || {})) throw new R24Error('E_SCHEDULER_STATE_BINDING_STALE');",
    replace: "if (false) throw new R24Error('E_SCHEDULER_STATE_BINDING_STALE');",
  },
  {
    id: 'effective-overlay-conflict-ignored',
    file: 'effective-state-compiler.mjs',
    find: "if (currentStates[targetNodeId] !== from) {",
    replace: 'if (false) {',
  },
  {
    id: 'effective-stale-sha-ignored',
    file: 'effective-state-compiler.mjs',
    find: "if (overlay.baseHeadSha !== exactIdentity.evaluationHeadSha) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_STALE_SHA', overlay.overlayId);",
    replace: "if (false) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_STALE_SHA', overlay.overlayId);",
  },
  {
    id: 'effective-self-promotion-ignored',
    file: 'effective-state-compiler.mjs',
    find: "if (overlay.selfPromotion === true || overlay.proofAuthority === 'SELF' || overlay.source === 'SELF_PROMOTION') {",
    replace: 'if (false) {',
  },
  {
    id: 'effective-completion-overclaimed',
    file: 'effective-state-compiler.mjs',
    find: 'programDone: requiredPendingNodeIds.length === 0,',
    replace: 'programDone: true,',
  },
  {
    id: 'tr-skip-law-removed',
    file: 'terminal-receipt.mjs',
    find: "if (skipped > 0 && REQUIRED_WHEN_PASS.includes(stamp.test.evidenceClass)) throw new R24Error('E_SKIPPED_REQUIRED_EVIDENCE', `${skipped} skipped in ${stamp.test.evidenceClass}`);",
    replace: "if (false) throw new R24Error('E_SKIPPED_REQUIRED_EVIDENCE', `${skipped} skipped in ${stamp.test.evidenceClass}`);",
  },
  {
    id: 'rt-skip-ignored',
    file: 'runner-truth.mjs',
    find: 'if (tapPresent && failOnSkip && (tap.skipped ?? 0) > 0) failures.push(`E_SKIPPED_EVIDENCE:${tap.skipped}`);',
    replace: 'if (false) failures.push(`E_SKIPPED_EVIDENCE:${tap.skipped}`);',
  },
  {
    id: 'rt-zero-executed-ignored',
    file: 'runner-truth.mjs',
    find: "if (tapPresent && executed === 0) failures.push('E_ZERO_DENOMINATOR');",
    replace: "if (false) failures.push('E_ZERO_DENOMINATOR');",
  },
  {
    id: 'env-unregistered-ignored',
    file: 'env-flag-registry.mjs',
    find: 'if (!registered.has(name)) failures.push(`E_ENV_FLAG_UNREGISTERED:${name}`);',
    replace: 'if (false && !registered.has(name)) failures.push(`E_ENV_FLAG_UNREGISTERED:${name}`);',
  },
  {
    id: 'claim-without-evidence-allowed',
    file: 'docs-claim-lint.mjs',
    find: 'if (resolved.size === 0) failures.push(`E_CLAIM_WITHOUT_EVIDENCE:${path.relative(rootDir, file)}`);',
    replace: 'if (false) failures.push(`E_CLAIM_WITHOUT_EVIDENCE:${path.relative(rootDir, file)}`);',
  },
  {
    id: 'claim-binding-digest-ignored',
    file: 'docs-claim-lint.mjs',
    find: 'if (actual !== binding.sha256) {\n      failures.push(`E_CLAIM_BINDING_DIGEST_MISMATCH:${relativePath}`);\n      continue;\n    }',
    replace: 'if (false) {\n      failures.push(`E_CLAIM_BINDING_DIGEST_MISMATCH:${relativePath}`);\n      continue;\n    }',
  },
  {
    id: 'claim-binding-schema-skipped',
    file: 'docs-claim-lint.mjs',
    find: 'const binding = buildClaimBinding(artifact);',
    replace: 'const binding = artifact;',
  },
  {
    id: 'canon-key-order-nondeterministic',
    file: 'canonical-json.mjs',
    find: 'Object.keys(value).sort().map((k)',
    replace: 'Object.keys(value).map((k)',
  },
  {
    id: 'tc-engines-drift-ignored',
    file: 'toolchain.mjs',
    find: 'if (pkg.engines.node !== contract.node.enginesRange) {',
    replace: 'if (false) {',
  },
  {
    id: 'tc-ci-node-incoherent-ignored',
    file: 'toolchain.mjs',
    find: 'if (version !== contract.workflows.singleNodeVersion) {',
    replace: 'if (false) {',
  },
  {
    id: 'tc-unregistered-action-ignored',
    file: 'toolchain.mjs',
    find: 'if (expected === undefined) failures.push(`E_TOOLCHAIN_ACTION_UNREGISTERED:${file}:${use}`);',
    replace: 'if (false) failures.push(`E_TOOLCHAIN_ACTION_UNREGISTERED:${file}:${use}`);',
  },
  {
    id: 'ro-tree-change-ignored',
    file: 'test-readonly-guard.mjs',
    find: 'if (before !== after) {',
    replace: 'if (false) {',
  },
  {
    id: 'ro-unregistered-temp-ignored',
    file: 'test-readonly-guard.mjs',
    find: 'if (!registered.has(literal)) failures.push(`E_TEMP_PATH_UNREGISTERED:${literal}`);',
    replace: 'if (false) failures.push(`E_TEMP_PATH_UNREGISTERED:${literal}`);',
  },
  {
    id: 'sb-digest-drift-ignored',
    file: 'source-binding.mjs',
    find: 'if (sha256hex(content) !== entry.sha256) failures.push(`E_SOURCE_BINDING_DIGEST_DRIFT:${rel}`);',
    replace: 'if (false) failures.push(`E_SOURCE_BINDING_DIGEST_DRIFT:${rel}`);',
  },
  {
    id: 'sb-extra-ignored',
    file: 'source-binding.mjs',
    find: 'if (!declared.has(rel)) failures.push(`E_SOURCE_BINDING_EXTRA:${rel}`);',
    replace: 'if (false) failures.push(`E_SOURCE_BINDING_EXTRA:${rel}`);',
  },
]);

const listTestFiles = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listTestFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.test.mjs')) out.push(full);
  }
  return out.sort();
};

function originalSuiteFiles() {
  const files = listTestFiles(TESTS_DIR);
  // Each measured long file starts in the existing first four native slots.
  for (const name of ['pre00f-current-head-plan-delivery-reconciliation.test.mjs', 'docs-claim-lint.test.mjs', 'wp603-recovery-post-audit.test.mjs']) {
    const priority = files.indexOf(path.join(TESTS_DIR, name));
    if (priority < 0) throw new Error('E_R24_ORIGINAL_PRIORITY_FILE_MISSING:' + name);
    if (priority > 0) files.unshift(...files.splice(priority, 1));
  }
  return files;
}

async function runOriginalSuite() {
  const [{ run }, { tap }, { availableParallelism }] = await Promise.all([
    import('node:test'), import('node:test/reporters'), import('node:os'),
  ]);
  const stream = run({
    files: originalSuiteFiles(),
    concurrency: Math.min(4, Math.max(1, availableParallelism() - 1)),
    isolation: 'process',
  });
  stream.on('test:fail', () => { process.exitCode = 1; });
  stream.compose(tap).pipe(process.stdout);
}

function runSuite(plan, baseline = null) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.YALKEN_TEST_EVIDENCE_DIR;
  const result = spawnSync(process.execPath, ['--import', mutationPreload(plan), fileURLToPath(import.meta.url), '--run-original-suite'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    cwd: MODULE_DIR,
    env,
  });
  return { ...evaluateMutationRun(result, plan, baseline),
    fullEvidence: captureMutationEvidence(result) };
}

export function main() {
  const started = Date.now();
  const controlPlan = createMutationPlan();
  const baseline = runSuite(controlPlan);
  const results = [];
  if (baseline.verdict === 'PASS') {
    for (const mutant of MUTANTS) {
      try {
        const plan = createMutationPlan(mutant);
        const run = runSuite(plan, baseline);
        results.push({ id: mutant.id, killed: run.verdict === 'KILLED',
          digest: plan.mutantSha256, plan, ...run });
        // Setup or changed coverage invalidates the lane; do not repeatedly
        // execute the same broken setup and never credit it as a kill.
        if (run.verdict === 'INVALID') break;
      } catch (error) {
        results.push({ id: mutant.id, killed: false, verdict: 'INVALID',
          error: error.message });
        break;
      }
    }
  }
  const killed = results.filter(row => row.killed).length;
  const survived = results.filter(row => !row.killed).map(row => row.id);
  const complete = baseline.verdict === 'PASS' && results.length === MUTANTS.length
    && killed === MUTANTS.length && survived.length === 0;
  const receipt = {
    schemaVersion: 'yalken.r24-mutation-receipt.v1',
    total: MUTANTS.length,
    killed,
    survived,
    score: killed / MUTANTS.length,
    baseline: baseline.verdict === 'PASS' ? 'PASS' : 'FAIL',
    durationMs: Date.now() - started,
    context: 'ORIGINAL_FILE_URLS_PINNED_IN_MEMORY_SINGLE_MUTATION',
    definitionsSha256: sha256hex(Buffer.from(JSON.stringify(MUTANTS))),
    baselineRun: { plan: controlPlan, ...baseline },
    results,
    notRun: MUTANTS.slice(results.length).map(row => row.id),
  };
  const wireReceipt = compactMutationCaseCatalog(receipt);
  if (JSON.stringify(restoreMutationCaseCatalog(wireReceipt)) !== JSON.stringify(receipt)) {
    throw new Error('E_MUTATION_CASE_CATALOG_ROUNDTRIP');
  }
  process.stdout.write('R24_MUTATION_RECEIPT=' + JSON.stringify(wireReceipt) + '\n');
  if (!complete) {
    process.stderr.write(baseline.verdict !== 'PASS'
      ? 'E_MUTANT_BASELINE_RED: unmutated original-context suite must pass first\n'
      : 'E_MUTANT_INVALID_OR_SURVIVOR:' + survived.concat(receipt.notRun).join(',') + '\n');
    process.exitCode = 1;
  }
  return receipt;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  if (process.argv[2] === '--run-original-suite') {
    if (process.argv.length !== 3) throw new Error('E_MUTATION_SUITE_ARGS');
    await runOriginalSuite();
  } else {
    main();
  }
}

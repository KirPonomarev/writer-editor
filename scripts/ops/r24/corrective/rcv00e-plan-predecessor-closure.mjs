import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HEX40_RE, HEX64_RE, R24Error, sha256hex } from '../canonical-json.mjs';

export const RCV00E_PLAN_PREDECESSOR_PATH = 'docs/OPS/R24/EVIDENCE/RCV00E_PLAN_PREDECESSOR_CLOSURE_V1.json';
export const RCV00E_PLAN_PATH = 'docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md';
export const RCV00E_CARRIER_DIGEST = 'f07505fde02102b39e7aa04ba7f33480f25833ff0967d1e72b88206c28de32a1';
export const RCV00E_ATTESTATION_DIGEST = '2d16c400d78120627a4469fdde86ba4675a32a0bbe03c036558da02f27f8bae9';
export const RCV00E_REPLAY_DIGEST = '484cf149db52b1daff690897c3f200fdf80b3f0a338f94198ddb06ffe436fd0f';
export const RCV00E_SOURCE_PATHS = Object.freeze([
  'scripts/ops/r24/corrective/rcv00e-lease-fencing-cas.mjs',
  'test/contracts/r24-rcv00e-lease-fencing-cas.contract.test.mjs',
  'scripts/ops/r24/canonical-json.mjs',
  'scripts/ops/r24/lease.mjs',
  'scripts/ops/r24/plan-state.mjs',
  'scripts/ops/r24/tests/canonical-json.test.mjs',
  'scripts/ops/r24/tests/lease.test.mjs',
  'scripts/ops/r24/tests/plan-state.test.mjs',
  'scripts/ops/r24/test-mutants.mjs',
]);
const ensure = (condition, code) => { if (!condition) throw new R24Error(code); };

export function rcv00eGitEvidence(repoRoot) {
  const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args]);
  const text = (...args) => git(...args).toString('utf8').trim();
  return {
    head: () => text('rev-parse', 'HEAD'),
    originMain: () => text('rev-parse', 'origin/main'),
    tree: sha => text('rev-parse', `${sha}^{tree}`),
    parents: sha => text('rev-list', '--parents', '-n', '1', sha).split(' ').slice(1),
    object: (sha, relative) => git('show', `${sha}:${relative}`),
    isAncestor(left, right) {
      try { git('merge-base', '--is-ancestor', left, right); return true; }
      catch (error) { if (error.status === 1) return false; throw error; }
    },
  };
}

export function readRcv00ePlanPredecessorCarrier(repoRoot) {
  const file = path.join(repoRoot, RCV00E_PLAN_PREDECESSOR_PATH);
  let stat;
  try { stat = fs.lstatSync(file); } catch { throw new R24Error('E_RCV00E_PLAN_CARRIER_MISSING'); }
  ensure(stat.isFile() && stat.size <= 65536, 'E_RCV00E_PLAN_CARRIER_BOUNDS');
  return fs.readFileSync(file);
}

function decodePinned(raw, expected, limit) {
  ensure(typeof raw === 'string' && /^[A-Za-z0-9+/]+={0,2}$/u.test(raw), 'E_RCV00E_PLAN_PROOF_ENCODING');
  const bytes = Buffer.from(raw, 'base64');
  ensure(bytes.length <= limit && bytes.toString('base64') === raw, 'E_RCV00E_PLAN_PROOF_BOUNDS');
  ensure(sha256hex(bytes) === expected, 'E_RCV00E_PLAN_PROOF_DIGEST');
  return JSON.parse(bytes.toString('utf8'));
}

// Only independently accepted bytes and static semantic paths reach this query.
// Historical provenance paths are never followed or executed.
export function verifyRcv00ePlanPredecessorClosure({ repoRoot, identity, planText, planDigest,
  gitEvidence = rcv00eGitEvidence(repoRoot),
  readCarrier = () => readRcv00ePlanPredecessorCarrier(repoRoot),
  readSource = relative => fs.readFileSync(path.join(repoRoot, relative)),
} = {}) {
  ensure(identity && ['headSha', 'originMainSha', 'treeSha'].every(key => HEX40_RE.test(String(identity[key]))), 'E_RCV00E_PLAN_CURRENT_IDENTITY');
  ensure(typeof planText === 'string' && HEX64_RE.test(String(planDigest)), 'E_RCV00E_PLAN_CONTEXT_SHAPE');
  const bytes = readCarrier();
  ensure(Buffer.isBuffer(bytes) && bytes.length <= 65536, 'E_RCV00E_PLAN_CARRIER_BOUNDS');
  ensure(sha256hex(bytes) === RCV00E_CARRIER_DIGEST, 'E_RCV00E_PLAN_CARRIER_DIGEST');
  const carrier = JSON.parse(bytes.toString('utf8'));
  ensure(carrier.schemaVersion === 'R24_RCV00E_PLAN_PREDECESSOR_CLOSURE_CARRIER_V1'
    && carrier.attestationDigest === RCV00E_ATTESTATION_DIGEST && carrier.replayDigest === RCV00E_REPLAY_DIGEST, 'E_RCV00E_PLAN_CARRIER_SCHEMA');
  const attestation = decodePinned(carrier.attestationRawBase64, RCV00E_ATTESTATION_DIGEST, 16384);
  const replay = decodePinned(carrier.replayRawBase64, RCV00E_REPLAY_DIGEST, 32768);
  ensure(attestation.status === 'ACCEPTED_BOUNDED_RCV00E_RECOVERED_DELIVERY_AND_CURRENT_CONTRACT_CLOSURE_EVIDENCE', 'E_RCV00E_PLAN_ATTESTATION_STATUS');
  const historical = attestation.identity;
  ensure(['base', 'candidate', 'merged', 'mergedTree', 'current', 'currentTree'].every(key => HEX40_RE.test(String(historical?.[key]))), 'E_RCV00E_PLAN_HISTORICAL_IDENTITY');
  ensure(replay.current.head === historical.current && replay.current.tree === historical.currentTree
    && attestation.independentCurrentReplay.head === historical.current
    && attestation.inputArtifacts.some(row => row.basename === 'reconciliation.json' && row.sha256 === RCV00E_REPLAY_DIGEST), 'E_RCV00E_PLAN_REPLAY_BINDING');
  ensure(gitEvidence.head() === identity.headSha && gitEvidence.originMain() === identity.originMainSha
    && gitEvidence.tree(identity.headSha) === identity.treeSha, 'E_RCV00E_PLAN_CURRENT_IDENTITY');
  ensure(gitEvidence.tree(historical.candidate) === historical.mergedTree
    && gitEvidence.tree(historical.merged) === historical.mergedTree, 'E_RCV00E_PLAN_HISTORICAL_TREE');
  ensure(JSON.stringify(gitEvidence.parents(historical.merged)) === JSON.stringify([historical.base, historical.candidate]), 'E_RCV00E_PLAN_NORMAL_MERGE_PARENTS');
  ensure(gitEvidence.isAncestor(historical.base, historical.candidate)
    && gitEvidence.isAncestor(historical.candidate, historical.merged)
    && gitEvidence.isAncestor(historical.merged, historical.current), 'E_RCV00E_PLAN_HISTORICAL_ANCESTRY');
  ensure(gitEvidence.tree(historical.current) === historical.currentTree
    && gitEvidence.isAncestor(historical.current, identity.headSha), 'E_RCV00E_PLAN_REPLAY_ANCESTRY');
  const committedPlan = gitEvidence.object(identity.headSha, RCV00E_PLAN_PATH);
  const attestedPlan = gitEvidence.object(historical.current, RCV00E_PLAN_PATH);
  ensure(sha256hex(Buffer.from(planText)) === planDigest && sha256hex(committedPlan) === planDigest
    && sha256hex(attestedPlan) === planDigest, 'E_RCV00E_PLAN_DIGEST');
  const strict = planText.match(/The strict path is:\s*([\s\S]*?)\n\n/u)?.[1];
  const phaseZero = strict?.split('->').map(id => id.trim()).filter(id => /^00[A-H]$/u.test(id));
  ensure(phaseZero?.length === 8 && new Set(phaseZero).size === 8
    && phaseZero.indexOf('00E') === phaseZero.indexOf('00D') + 1
    && phaseZero.indexOf('00F') === phaseZero.indexOf('00E') + 1, 'E_RCV00E_PLAN_PREDECESSOR_IDENTITY');
  const sourceArtifacts = replay.current.sourceArtifacts;
  ensure(Array.isArray(sourceArtifacts) && sourceArtifacts.length === RCV00E_SOURCE_PATHS.length
    && new Set(sourceArtifacts.map(row => row.path)).size === RCV00E_SOURCE_PATHS.length
    && sourceArtifacts.every(row => RCV00E_SOURCE_PATHS.includes(row.path) && HEX64_RE.test(String(row.sha256))), 'E_RCV00E_PLAN_SOURCE_SET');
  for (const relative of RCV00E_SOURCE_PATHS) {
    const expected = sourceArtifacts.find(row => row.path === relative).sha256;
    ensure(sha256hex(gitEvidence.object(historical.current, relative)) === expected, 'E_RCV00E_PLAN_ATTESTED_SOURCE');
    ensure(sha256hex(gitEvidence.object(identity.headSha, relative)) === expected, 'E_RCV00E_PLAN_CURRENT_SOURCE');
    ensure(sha256hex(readSource(relative)) === expected, 'E_RCV00E_PLAN_WORKTREE_SOURCE');
  }
  return {
    schemaVersion: 'R24_RCV00E_VERIFIED_PLAN_PREDECESSOR_CLOSURE_V1',
    status: 'VERIFIED_BOUNDED_PLAN_PREDECESSOR_CLOSURE', contourId: 'R24-RCV-00E',
    subjectKind: 'PLAN_PREDECESSOR', identity: { ...identity },
    historicalIdentity: { ...historical }, attestationDigest: RCV00E_ATTESTATION_DIGEST,
    replayDigest: RCV00E_REPLAY_DIGEST, carrierDigest: RCV00E_CARRIER_DIGEST, planDigest,
    sourceArtifacts: sourceArtifacts.map(({ path: relative, sha256 }) => ({ path: relative, sha256 })),
    provenanceLimits: [...attestation.residualLimits],
    evidenceScope: 'ACCEPTED_RECOVERED_DELIVERY_AND_ATTESTED_CURRENT_SOURCE_EQUIVALENCE_NOT_FRESH_RUNTIME_PROOF',
    mutationAllowed: false, programDone: false, productionReleaseReady: false, graphIncrement: 0,
  };
}

#!/usr/bin/env node
// R24-RCV-00C: corrective register and crosswalk validator.
// This is an ops-only projection over the V2 plan table. It cannot create
// graph nodes or promote recorded graph state.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  R24Error,
  HEX40_RE,
  HEX64_RE,
  canonicalDigest,
  readJsonBounded,
  sha256hex,
} from '../canonical-json.mjs';

export const RCV00C_REGISTER_SCHEMA_VERSION = 'R24_CORRECTIVE_REGISTER_V1';
export const RCV00C_REGISTER_ID = 'R24-RCV-00C-CORRECTIVE-REGISTER-CROSSWALK';
export const RCV00C_CONTOUR_ID = 'R24_RCV_00C_CORRECTIVE_REGISTER_CROSSWALK';
export const RCV00C_PLAN_PATH = 'docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md';
export const RCV00C_REGISTER_PATH = 'docs/OPS/R24/CORRECTIVE/R24_CORRECTIVE_REGISTER_V1.json';
export const RCV00C_PROGRAM_PATH = 'docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json';
export const RCV00C_BASE_SHA = 'ce5ea0f1a9e91d25b91dc361209c32b13b528640';
export const RCV00C_BASE_TREE = '24d44e9f49847a2e03c704fdbb0c56741ba38cd3';
export const RCV00C_PLAN_SECTION = 'Consolidated finding-to-contour crosswalk';
export const RCV00C_EXPECTED_FINDING_COUNT = 45;
export const RCV00C_EXPECTED_CURRENT_OBSERVATION_COUNT = 1;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const STATUS_SET = new Set(['ACTIVE_CONFIRMED', 'REVALIDATE_CURRENT', 'RECORDED_GRAPH_OPEN', 'DEFERRED_DEBT']);
const SEVERITY_SET = new Set(['P1', 'P2', 'P3', 'BLOCKER', 'REQUIRED']);

const ACTIVE_EVIDENCE = Object.freeze({
  'GOV-01': Object.freeze({
    evidenceId: 'EV-GOV-01-AF74',
    exactSha: 'af74b9542c17c24a7515ce9017d98ea7b2e4d55a',
    source: 'raw R2.4 PlanState/current checkpoint compared with PK1R1 effective state and terminal receipt',
    reproducer: 'resolve scheduler-selected node from raw state, then resolve earliest unmet mandatory dependency from PK1R1 effective state on the same SHA',
    expected: 'one current scheduler and one effective-state reducer agree',
    actual: 'raw/current narrative can select old W0 while later effective state records 90 DONE and PK1 as earliest unmet dependency',
    oracleClass: 'deterministic repository-state comparison',
    claimCeiling: 'control-plane split-brain only; no graph node is promoted',
  }),
  'GOV-07': Object.freeze({
    evidenceId: 'EV-GOV-07-PR1843',
    exactSha: 'c9bc88522327cb28be0690d89d6edc8259cc48c8',
    source: 'GitHub checks for PR 1843',
    reproducer: 'inspect all required checks and first failing assertion in each primary failed lane at the exact PR head',
    expected: 'a docs-only successor is evaluated through its own fresh admission',
    actual: 'five primary lanes stop with E_PK1R1_EXACT_ADMITTED_DELTA:20:19; two aggregate jobs fail downstream; ten of seventeen jobs pass',
    oracleClass: 'exact-head protected CI',
    claimCeiling: 'admission deadlock only; it does not prove any product defect',
  }),
  'OPS-03': Object.freeze({
    evidenceId: 'EV-OPS-03-C9BC',
    exactSha: 'c9bc88522327cb28be0690d89d6edc8259cc48c8',
    source: 'full repository E0 invocation plus static candidate inventory',
    reproducer: 'run the full ops gate and separately enumerate core files matching the gate effect-token vocabulary',
    expected: 'docs-only task reaches task validation or emits a complete semantically classified core-boundary result',
    actual: 'E0 stops on anchor-lineage-v1.cjs through CORE_PURITY_VIOLATION while current matcher recognizes four narrow exceptions and candidate scan returns 31 files requiring semantic classification',
    oracleClass: 'local exact-head process plus source inventory',
    claimCeiling: 'E0 is stale/incomplete; the 31 files are candidates, not 31 proven architecture violations',
  }),
});

const GRAPH_OPEN_NODE_BY_FINDING = Object.freeze({
  'REL-01': 'PK1_RELEASE_SECURITY_PHYSICAL',
  'REL-02': 'V3_PACKAGE_CLAIM_COMPILER',
  'REL-03': 'WP-900_BBR_POLICY',
  'REL-04': 'WP-901_BBR_RESTORE',
  'REL-05': 'WP-902_ENTITLEMENT_PRODUCT',
  'REL-06': 'WP-903_BRAND_RELEASE',
  'REL-07': 'WP-904_PACKAGE_CONTENT',
  'REL-08': 'WP-905_PACKAGE_PHYSICAL',
  'REL-09': 'WP-906_RELEASE_VERDICT',
});

const CURRENT_OBSERVATIONS = Object.freeze([
  Object.freeze({
    observationId: 'OBS-EXPORT-DOCX-MIN-COMMAND-BRIDGE-OUTER-FAIL-20260909',
    severity: 'P1',
    status: 'ACTIVE_CONFIRMED',
    sourceAuditId: 'EV-EXPORT-HONESTY-AUDIT-20260909T1927',
    primaryContourId: 'R24-RCV-00D',
    mappedExistingGraphNode: 'NO_GRAPH_NODE',
    graphPromotionAllowed: false,
    requiredProof: 'SCOPED_CONTRACT_FIX_WITH_FAILURE_AFTER_SIDE_EFFECT_AND_RETRY_COVERAGE',
    evidence: Object.freeze({
      evidenceId: 'EV-EXPORT-HONESTY-AUDIT-20260909T1927',
      exactArtifactSha256: 'e6d240ec7f4ed4547c41644dc4e34e384831cab325f9a18a1560188ef1e10409',
      source: 'independent packaged export honesty audit',
      reproducer: 'invoke cmd.project.export.docxMin against the packaged app.asar and compare the inner export write result with the outer UI Command Bridge response',
      expected: 'a confirmed DOCX side effect is surfaced by a successful command result or by a typed recoverable legacy-normalization boundary',
      actual: 'DOCX side effect exists with 1613 bytes and inner ok numeric 1, while outer UI Command Bridge reports ok false with COMMAND_EXECUTION_FAILED',
      oracleClass: 'packaged runtime artifact plus independent negative oracle',
      claimCeiling: 'actual packaged export bridge defect only; visible user route remains UNKNOWN and no source fix is delivered by RCV00C',
    }),
    successorRequirement: Object.freeze({
      afterContourId: 'R24_RCV_00C_CORRECTIVE_REGISTER_CROSSWALK',
      contourType: 'SCOPED_CONTRACT_FIX',
      preferredBoundary: 'normalize legacy numeric export result at the export-owning boundary',
      requiredCoverage: Object.freeze([
        'FAILURE_AFTER_SIDE_EFFECT',
        'RETRY_AFTER_OUTER_COMMAND_FAILURE',
      ]),
      forbiddenFixes: Object.freeze([
        'GLOBAL_TRUTHY_OK_WEAKENING',
        'VISIBLE_USER_ROUTE_CLAIM_WITHOUT_EVIDENCE',
      ]),
    }),
  }),
]);

function repoPath(repoRoot, relativePath) {
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, relativePath);
  const rel = path.relative(root, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new R24Error('E_RCV00C_PATH_OUTSIDE_ROOT', relativePath);
  return absolute;
}

function sha256File(repoRoot, relativePath) {
  return sha256hex(fs.readFileSync(repoPath(repoRoot, relativePath)));
}

function parsePlanCrosswalkRows(planText) {
  return planText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\| [A-Z]+-[0-9]{2} \|/u.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      if (cells.length !== 5) throw new R24Error('E_RCV00C_PLAN_ROW_SHAPE', line);
      const [findingId, severity, status, sourceAuditId, primaryContourId] = cells;
      return { findingId, severity, status, sourceAuditId, primaryContourId };
    });
}

function requiredProofFor(status) {
  if (status === 'ACTIVE_CONFIRMED') return 'FULL_EVIDENCE_SHAPE_AND_CONTOUR_CLOSURE_REQUIRED';
  if (status === 'REVALIDATE_CURRENT') return 'REPRODUCE_ON_FRESH_BASE_BEFORE_MUTATION';
  if (status === 'RECORDED_GRAPH_OPEN') return 'EXISTING_GRAPH_NODE_TERMINAL_DELIVERY_REQUIRED';
  if (status === 'DEFERRED_DEBT') return 'MEASURE_SEVERITY_BEFORE_RELEASE_CUTOFF';
  throw new R24Error('E_RCV00C_STATUS_UNKNOWN', status);
}

function mutantMinimumFor({ severity, status }) {
  if (status === 'DEFERRED_DEBT') return 0;
  return ['P1', 'BLOCKER', 'REQUIRED'].includes(severity) ? 1 : 0;
}

function buildFinding(row, index) {
  const mappedExistingGraphNode = GRAPH_OPEN_NODE_BY_FINDING[row.findingId] || 'NO_GRAPH_NODE';
  const activeEvidence = ACTIVE_EVIDENCE[row.findingId] || null;
  return {
    findingId: row.findingId,
    sequence: index,
    severity: row.severity,
    status: row.status,
    sourceAuditId: row.sourceAuditId,
    primaryContourId: row.primaryContourId,
    secondaryContourIds: [],
    mappedExistingGraphNode,
    graphPromotionAllowed: false,
    affectedClaimIds: [row.findingId],
    requiredProof: requiredProofFor(row.status),
    criticalMutantMinimum: mutantMinimumFor(row),
    closureReceiptDigest: null,
    mergedSha: null,
    historicalPredecessor: row.sourceAuditId,
    lastTransition: 'REGISTERED_BY_R24_RCV_00C',
    fencingCounter: null,
    evidence: activeEvidence,
  };
}

function countsBy(findings, key) {
  const counts = {};
  for (const finding of findings) counts[finding[key]] = (counts[finding[key]] || 0) + 1;
  return Object.fromEntries(Object.keys(counts).sort().map((name) => [name, counts[name]]));
}

export function buildCorrectiveRegister({ repoRoot = REPO_ROOT, generatedAtUtc = '2026-09-09T00:00:00.000Z' } = {}) {
  const planText = fs.readFileSync(repoPath(repoRoot, RCV00C_PLAN_PATH), 'utf8');
  const planRows = parsePlanCrosswalkRows(planText);
  const program = readJsonBounded(repoPath(repoRoot, RCV00C_PROGRAM_PATH));
  const findings = planRows.map(buildFinding);
  return {
    schemaVersion: RCV00C_REGISTER_SCHEMA_VERSION,
    registerId: RCV00C_REGISTER_ID,
    contourId: RCV00C_CONTOUR_ID,
    generatedAtUtc,
    generatedFrom: {
      planPath: RCV00C_PLAN_PATH,
      planSha256: sha256File(repoRoot, RCV00C_PLAN_PATH),
      baseSha: RCV00C_BASE_SHA,
      baseTree: RCV00C_BASE_TREE,
      sourceSection: RCV00C_PLAN_SECTION,
      sourceRowCount: planRows.length,
    },
    graphBinding: {
      executableProgramPath: RCV00C_PROGRAM_PATH,
      executableProgramSha256: sha256File(repoRoot, RCV00C_PROGRAM_PATH),
      executableGraphNodeCount: program.nodes.length,
      createsGraphNode: false,
      correctiveContoursAreGraphNodes: false,
    },
    statusPolicy: {
      allowedStatuses: [...STATUS_SET].sort(),
      activeConfirmedRequiresEvidenceShape: true,
      onePrimaryContourPerFinding: true,
      noGraphPromotionFromNoGraphNode: true,
      recordedGraphOpenMustMapExistingGraphNode: true,
      deferredDebtDoesNotBlockCriticalPathByItself: true,
    },
    findings,
    currentObservations: CURRENT_OBSERVATIONS.map((observation) => structuredClone(observation)),
    totals: {
      findings: findings.length,
      currentObservations: CURRENT_OBSERVATIONS.length,
      byStatus: countsBy(findings, 'status'),
      bySeverity: countsBy(findings, 'severity'),
      activeConfirmed: findings.filter((finding) => finding.status === 'ACTIVE_CONFIRMED').length,
      activeConfirmedCurrentObservations: CURRENT_OBSERVATIONS.filter((observation) => observation.status === 'ACTIVE_CONFIRMED').length,
      recordedGraphOpen: findings.filter((finding) => finding.status === 'RECORDED_GRAPH_OPEN').length,
      noGraphNodeMappings: findings.filter((finding) => finding.mappedExistingGraphNode === 'NO_GRAPH_NODE').length,
      existingGraphNodeMappings: findings.filter((finding) => finding.mappedExistingGraphNode !== 'NO_GRAPH_NODE').length,
    },
    nonClaims: [
      'NO_GRAPH_NODE_CREATION',
      'NO_GRAPH_STATE_TRANSITION',
      'NO_PRODUCT_RUNTIME_FEATURE',
      'NO_PROGRAM_DONE',
      'NO_RELEASE_READINESS',
      'NO_NEW_DEPENDENCY',
      'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
      'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
    ],
  };
}

function assertObject(value, code, detail = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new R24Error(code, detail);
  return value;
}

function assertNonEmptyString(value, code, detail = '') {
  if (typeof value !== 'string' || value.length === 0) throw new R24Error(code, detail);
  return value;
}

function assertSameJson(actual, expected, code, detail = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new R24Error(code, detail);
}

export function validateCorrectiveRegister(register, { repoRoot = REPO_ROOT } = {}) {
  assertObject(register, 'E_RCV00C_REGISTER_SHAPE');
  if (register.schemaVersion !== RCV00C_REGISTER_SCHEMA_VERSION) throw new R24Error('E_RCV00C_REGISTER_SCHEMA', String(register.schemaVersion));
  if (register.registerId !== RCV00C_REGISTER_ID || register.contourId !== RCV00C_CONTOUR_ID) {
    throw new R24Error('E_RCV00C_REGISTER_IDENTITY');
  }
  const generatedFrom = assertObject(register.generatedFrom, 'E_RCV00C_GENERATED_FROM');
  if (generatedFrom.planPath !== RCV00C_PLAN_PATH || generatedFrom.baseSha !== RCV00C_BASE_SHA || generatedFrom.baseTree !== RCV00C_BASE_TREE) {
    throw new R24Error('E_RCV00C_BASE_BINDING');
  }
  if (generatedFrom.planSha256 !== sha256File(repoRoot, RCV00C_PLAN_PATH)) throw new R24Error('E_RCV00C_PLAN_DIGEST');

  const graphBinding = assertObject(register.graphBinding, 'E_RCV00C_GRAPH_BINDING');
  const program = readJsonBounded(repoPath(repoRoot, RCV00C_PROGRAM_PATH));
  const graphNodeById = new Map(program.nodes.map((node) => [node.id, node]));
  if (graphBinding.executableProgramPath !== RCV00C_PROGRAM_PATH
    || graphBinding.executableProgramSha256 !== sha256File(repoRoot, RCV00C_PROGRAM_PATH)
    || graphBinding.executableGraphNodeCount !== program.nodes.length
    || graphBinding.createsGraphNode !== false
    || graphBinding.correctiveContoursAreGraphNodes !== false) {
    throw new R24Error('E_RCV00C_GRAPH_BINDING');
  }

  const planText = fs.readFileSync(repoPath(repoRoot, RCV00C_PLAN_PATH), 'utf8');
  const planRows = parsePlanCrosswalkRows(planText);
  if (planRows.length !== RCV00C_EXPECTED_FINDING_COUNT) throw new R24Error('E_RCV00C_PLAN_ROW_COUNT', String(planRows.length));
  const expectedFindings = planRows.map(buildFinding);
  const findings = Array.isArray(register.findings) ? register.findings : [];
  if (findings.length !== expectedFindings.length) throw new R24Error('E_RCV00C_FINDING_DENOMINATOR', `${findings.length}:${expectedFindings.length}`);
  if (generatedFrom.sourceRowCount !== planRows.length) throw new R24Error('E_RCV00C_SOURCE_ROW_COUNT', String(generatedFrom.sourceRowCount));
  const expectedRegister = buildCorrectiveRegister({ repoRoot, generatedAtUtc: register.generatedAtUtc });
  assertSameJson(register.statusPolicy, expectedRegister.statusPolicy, 'E_RCV00C_STATUS_POLICY');

  const seen = new Set();
  for (let index = 0; index < findings.length; index += 1) {
    const finding = assertObject(findings[index], 'E_RCV00C_FINDING_SHAPE', String(index));
    const expected = expectedFindings[index];
    if (seen.has(finding.findingId)) throw new R24Error('E_RCV00C_DUPLICATE_FINDING', finding.findingId);
    seen.add(finding.findingId);
    if (!SEVERITY_SET.has(finding.severity)) throw new R24Error('E_RCV00C_SEVERITY', finding.findingId);
    if (!STATUS_SET.has(finding.status)) throw new R24Error('E_RCV00C_STATUS', finding.findingId);
    if (!Array.isArray(finding.secondaryContourIds) || finding.secondaryContourIds.length !== 0) throw new R24Error('E_RCV00C_SECONDARY_CONTOUR', finding.findingId);
    if (!Array.isArray(finding.affectedClaimIds) || finding.affectedClaimIds.length !== 1 || finding.affectedClaimIds[0] !== finding.findingId) {
      throw new R24Error('E_RCV00C_AFFECTED_CLAIM', finding.findingId);
    }
    if (finding.graphPromotionAllowed !== false) throw new R24Error('E_RCV00C_GRAPH_PROMOTION', finding.findingId);
    const mappedGraphNode = finding.mappedExistingGraphNode === 'NO_GRAPH_NODE' ? null : graphNodeById.get(finding.mappedExistingGraphNode);
    if (finding.mappedExistingGraphNode === 'NO_GRAPH_NODE') {
      if (finding.status === 'RECORDED_GRAPH_OPEN') throw new R24Error('E_RCV00C_GRAPH_OPEN_UNMAPPED', finding.findingId);
    } else if (!mappedGraphNode) {
      throw new R24Error('E_RCV00C_GRAPH_NODE_UNKNOWN', finding.mappedExistingGraphNode);
    }
    if (finding.status === 'RECORDED_GRAPH_OPEN' && !['PENDING', 'BLOCKED_TYPED'].includes(mappedGraphNode.state)) {
      throw new R24Error('E_RCV00C_REDUCER_REGISTER_DISAGREEMENT', `${finding.findingId}:${finding.mappedExistingGraphNode}:${mappedGraphNode.state}`);
    }
    for (const key of ['findingId', 'sequence', 'severity', 'status', 'sourceAuditId', 'primaryContourId', 'mappedExistingGraphNode', 'graphPromotionAllowed', 'requiredProof', 'criticalMutantMinimum', 'closureReceiptDigest', 'mergedSha', 'historicalPredecessor', 'lastTransition', 'fencingCounter']) {
      assertSameJson(finding[key], expected[key], 'E_RCV00C_PLAN_REGISTER_DISAGREEMENT', `${finding.findingId}:${key}`);
    }
    if (finding.status === 'ACTIVE_CONFIRMED') {
      const evidence = assertObject(finding.evidence, 'E_RCV00C_ACTIVE_EVIDENCE', finding.findingId);
      if (evidence.evidenceId !== finding.sourceAuditId) throw new R24Error('E_RCV00C_ACTIVE_EVIDENCE_ID', finding.findingId);
      if (!HEX40_RE.test(String(evidence.exactSha))) throw new R24Error('E_RCV00C_ACTIVE_EVIDENCE_SHA', finding.findingId);
      for (const key of ['source', 'reproducer', 'expected', 'actual', 'oracleClass', 'claimCeiling']) {
        assertNonEmptyString(evidence[key], 'E_RCV00C_ACTIVE_EVIDENCE_FIELD', `${finding.findingId}:${key}`);
      }
      assertSameJson(evidence, expected.evidence, 'E_RCV00C_ACTIVE_EVIDENCE_BINDING', finding.findingId);
    } else if (finding.evidence !== null) {
      throw new R24Error('E_RCV00C_NON_ACTIVE_EVIDENCE', finding.findingId);
    }
  }
  const observations = Array.isArray(register.currentObservations) ? register.currentObservations : [];
  if (observations.length !== RCV00C_EXPECTED_CURRENT_OBSERVATION_COUNT) throw new R24Error('E_RCV00C_CURRENT_OBSERVATION_DENOMINATOR', String(observations.length));
  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index];
    const expectedObservation = expectedRegister.currentObservations[index];
    assertObject(observation, 'E_RCV00C_CURRENT_OBSERVATION_SHAPE');
    for (const key of ['observationId', 'severity', 'status', 'sourceAuditId', 'primaryContourId', 'mappedExistingGraphNode', 'requiredProof', 'successorRequirement']) {
      assertSameJson(observation[key], expectedObservation[key], 'E_RCV00C_CURRENT_OBSERVATION_BINDING', `${observation.observationId}:${key}`);
    }
    if (observation.graphPromotionAllowed !== false || observation.mappedExistingGraphNode !== 'NO_GRAPH_NODE') throw new R24Error('E_RCV00C_CURRENT_OBSERVATION_GRAPH_PROMOTION', observation.observationId);
    const evidence = assertObject(observation.evidence, 'E_RCV00C_CURRENT_OBSERVATION_EVIDENCE', observation.observationId);
    if (evidence.evidenceId !== observation.sourceAuditId) throw new R24Error('E_RCV00C_CURRENT_OBSERVATION_EVIDENCE_ID', observation.observationId);
    if (!HEX64_RE.test(String(evidence.exactArtifactSha256))) throw new R24Error('E_RCV00C_CURRENT_OBSERVATION_EVIDENCE_SHA256', observation.observationId);
    for (const key of ['source', 'reproducer', 'expected', 'actual', 'oracleClass', 'claimCeiling']) {
      assertNonEmptyString(evidence[key], 'E_RCV00C_CURRENT_OBSERVATION_EVIDENCE_FIELD', `${observation.observationId}:${key}`);
    }
    assertSameJson(evidence, expectedObservation.evidence, 'E_RCV00C_CURRENT_OBSERVATION_EVIDENCE_BINDING', observation.observationId);
  }
  assertSameJson(register.totals, expectedRegister.totals, 'E_RCV00C_TOTALS');
  const nonClaims = new Set(register.nonClaims || []);
  for (const token of ['NO_GRAPH_NODE_CREATION', 'NO_GRAPH_STATE_TRANSITION', 'NO_PRODUCT_RUNTIME_FEATURE', 'NO_PROGRAM_DONE', 'NO_RELEASE_READINESS']) {
    if (!nonClaims.has(token)) throw new R24Error('E_RCV00C_NONCLAIM', token);
  }
  return {
    status: 'PASS',
    registerId: register.registerId,
    contourId: register.contourId,
    findingCount: findings.length,
    currentObservationCount: observations.length,
    activeConfirmed: register.totals.activeConfirmed,
    activeConfirmedCurrentObservations: register.totals.activeConfirmedCurrentObservations,
    recordedGraphOpen: register.totals.recordedGraphOpen,
    graphNodeCount: program.nodes.length,
    registerDigest: canonicalDigest(register),
    planDigest: generatedFrom.planSha256,
    programDigest: graphBinding.executableProgramSha256,
  };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args.set(token, next);
      index += 1;
    } else {
      args.set(token, 'true');
    }
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repoRoot = path.resolve(args.get('--repo-root') || process.cwd());
  if (args.has('--write')) {
    const outputPath = repoPath(repoRoot, args.get('--write'));
    const register = buildCorrectiveRegister({ repoRoot, generatedAtUtc: args.get('--generated-at') || '2026-09-09T00:00:00.000Z' });
    fs.writeFileSync(outputPath, `${JSON.stringify(register, null, 2)}\n`, 'utf8');
    const result = validateCorrectiveRegister(register, { repoRoot });
    process.stdout.write(`R24_RCV00C_CORRECTIVE_REGISTER=${JSON.stringify(result)}\n`);
    return result;
  }
  const registerPath = args.get('--check') || RCV00C_REGISTER_PATH;
  const register = readJsonBounded(repoPath(repoRoot, registerPath));
  const result = validateCorrectiveRegister(register, { repoRoot });
  process.stdout.write(`R24_RCV00C_CORRECTIVE_REGISTER=${JSON.stringify(result)}\n`);
  return result;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  try {
    main();
  } catch (error) {
    const code = error instanceof R24Error ? error.code : 'E_UNKNOWN';
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exit(1);
  }
}

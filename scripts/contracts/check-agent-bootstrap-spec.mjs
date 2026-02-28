import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const policyPath = path.join(repoRoot, 'docs', 'OPERATIONS', 'STATUS', 'CODEX_AUTOMATION_POLICY.json');
const defaultSpecPath = path.join(repoRoot, 'docs', 'OPERATIONS', 'STATUS', 'AGENT_BOOTSTRAP_ONE_SHOT_SPEC_V1_0.json');

const requiredExecutionTicketFields = Object.freeze([
  'TICKET_ID',
  'ROLE_ROUTE',
  'GOAL',
  'BASE_SHA',
  'HEAD_SHA_AT_START',
  'TARGET_BRANCH',
  'PUSH_BRANCH',
  'PR_MODE',
  'ALLOWLIST_PATHS_MODE',
  'ALLOWLIST_PATHS',
  'DENYLIST_PATHS',
  'CHECK_PACK',
  'STOP_CONDITION',
  'REPORT_FORMAT',
  'RESUME_POLICY',
  'OWNER',
  'EXPIRY',
  'ROLLBACK_PLAN',
]);

const requiredStopReasons = Object.freeze([
  'INVALID_EXECUTION_TICKET',
  'SCOPE_VIOLATION',
  'CHECKS_FAIL',
  'PROMPT_DETECTED',
  'MIN_FAST_GATE_FAIL',
  'POLICY_OR_SECURITY_CONFLICT',
]);

const requiredRunProtocolSteps = Object.freeze([
  'READ_AUTHORITY_ORDER_AND_LOCK_ACTIVE_CANON',
  'IF_CODEX_EXEC_THREAD_VALIDATE_TICKET_BEFORE_ANY_ACTION',
  'ENFORCE_SCOPE_BOUNDARIES_BEFORE_EDIT',
  'RUN_REQUIRED_FAST_GATES',
  'EMIT_FINAL_REPORT_WITH_PASS_OR_STOP_AND_REASON',
]);

function fail(reason) {
  console.error(reason);
  process.exit(1);
}

function readJson(jsonPath, failReason) {
  if (!fs.existsSync(jsonPath)) {
    fail(`${failReason}:MISSING:${path.relative(repoRoot, jsonPath).replaceAll(path.sep, '/')}`);
  }
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    fail(`${failReason}:PARSE:${error.message}`);
  }
}

function ensureNonEmptyString(value, reason) {
  if (typeof value !== 'string' || value.trim() === '') fail(reason);
}

function ensureIncludesAll(list, required, reason) {
  if (!Array.isArray(list)) fail(reason);
  for (const item of required) {
    if (!list.includes(item)) fail(`${reason}:${item}`);
  }
}

const policy = readJson(policyPath, 'AGENT_BOOTSTRAP_SPEC_POLICY_INVALID');
ensureNonEmptyString(policy.bootstrapSpecRef, 'AGENT_BOOTSTRAP_SPEC_POLICY_INVALID:bootstrapSpecRef');

const specPath = path.join(repoRoot, String(policy.bootstrapSpecRef || '').replaceAll('/', path.sep));
const spec = readJson(fs.existsSync(specPath) ? specPath : defaultSpecPath, 'AGENT_BOOTSTRAP_SPEC_INVALID');

ensureNonEmptyString(spec.documentId, 'AGENT_BOOTSTRAP_SPEC_INVALID:documentId');
if (spec.documentId !== 'AGENT_BOOTSTRAP_ONE_SHOT_SPEC_V1_0') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:documentId_mismatch');
}

if (spec.documentStatus !== 'ACTIVE_BOOTSTRAP_FOR_NEW_AGENT') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:documentStatus');
}

if (!spec.threadModel || spec.threadModel.name !== 'TWO_THREAD_STRICT') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:threadModel');
}

if (!spec.executionTicket || spec.executionTicket.required !== true) {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:executionTicket.required');
}
ensureIncludesAll(
  spec.executionTicket.requiredFields,
  requiredExecutionTicketFields,
  'AGENT_BOOTSTRAP_SPEC_INVALID:executionTicket.requiredFields_missing',
);

if (!spec.executionTicket.defaults || spec.executionTicket.defaults.scopeMode !== 'EXACT') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:executionTicket.defaults.scopeMode');
}
if (!spec.executionTicket.defaults || spec.executionTicket.defaults.prMode !== 'URL_ONLY') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:executionTicket.defaults.prMode');
}

if (!spec.automationPolicy || spec.automationPolicy.mode !== 'STRICT') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:automationPolicy.mode');
}
if (!spec.automationPolicy || spec.automationPolicy.promptMode !== 'PROMPT_DISABLED') {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:automationPolicy.promptMode');
}
if (spec.automationPolicy.allowlistBoundaryEnforced !== true) {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:automationPolicy.allowlistBoundaryEnforced');
}
if (spec.automationPolicy.denylistBoundaryEnforced !== true) {
  fail('AGENT_BOOTSTRAP_SPEC_INVALID:automationPolicy.denylistBoundaryEnforced');
}

ensureIncludesAll(spec.stopRegistry, requiredStopReasons, 'AGENT_BOOTSTRAP_SPEC_INVALID:stopRegistry_missing');
ensureIncludesAll(spec.runProtocol, requiredRunProtocolSteps, 'AGENT_BOOTSTRAP_SPEC_INVALID:runProtocol_missing');

if (policy.promptMode !== 'prompt_disabled') {
  fail('AGENT_BOOTSTRAP_SPEC_POLICY_MISMATCH:promptMode');
}
if (policy.autoApplyWithinAllowlist !== true) {
  fail('AGENT_BOOTSTRAP_SPEC_POLICY_MISMATCH:autoApplyWithinAllowlist');
}
if (policy.denylistAbsolute !== true) {
  fail('AGENT_BOOTSTRAP_SPEC_POLICY_MISMATCH:denylistAbsolute');
}

const expectedCommand = 'node scripts/contracts/check-agent-bootstrap-spec.mjs';
if (!Array.isArray(policy.commandAllowlist) || !policy.commandAllowlist.includes(expectedCommand)) {
  fail('AGENT_BOOTSTRAP_SPEC_POLICY_MISMATCH:commandAllowlist_missing_checker');
}

const handoff = policy.AUTOMATION_HANDOFF_MINIMAL_CLICKS;
if (!handoff || handoff.handoffId !== spec.automationPolicy.handoffContractId) {
  fail('AGENT_BOOTSTRAP_SPEC_POLICY_MISMATCH:handoffContractId');
}
if (!Array.isArray(policy.failReasons) || !policy.failReasons.includes('PUSH_BLOCKED_MISSING_WORKFLOW_SCOPE')) {
  fail('AGENT_BOOTSTRAP_SPEC_POLICY_MISMATCH:failReasons');
}

console.log('CP-7 AGENT_BOOTSTRAP_SPEC_OK=1');
console.log('CP-8 EXECUTION_TICKET_SCHEMA_OK=1');
console.log('CP-9 AUTOMATION_POLICY_ALIGNMENT_OK=1');

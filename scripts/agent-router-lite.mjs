import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const POLICY_SCHEMA_VERSION = 'yalken.agent_cost_policy.v1';
export const REPO_MAP_SCHEMA_VERSION = 'yalken.agent_repo_map.v1';
export const STAGE_PACKET_SCHEMA_VERSION = 'yalken.stage_task_packet.v1';
export const CHEAP_AGENT_RUN_SCHEMA_VERSION = 'yalken.cheap_agent_run.v1';
export const CHEAP_AGENT_REQUEST_SCHEMA_VERSION = 'yalken.cheap_agent_request.v1';
export const COST_LEDGER_SCHEMA_VERSION = 'yalken.agent_cost_ledger.v1';

export const DEFAULT_POLICY_PATH = 'configs/agent_cost_policy.json';
export const DEFAULT_RUNTIME_CONTRACT_PATH = 'docs/agent_runtime_contract.md';
export const DEFAULT_REPO_MAP_PATH = '.tmp/agent-router-lite/repo_map.txt';
export const DEFAULT_REPO_MAP_MANIFEST_PATH = '.tmp/agent-router-lite/repo_map_manifest.json';
export const DEFAULT_PACKET_OUTPUT_DIR = 'reports/stage_task_packets/latest';
export const DEFAULT_RUN_OUTPUT_DIR = 'reports/agent_cost_ledger/latest';
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY';

const DEFAULT_INCLUDE_ROOTS = [
  'AGENTS.md',
  'CANON.md',
  'README.md',
  'configs',
  'docs',
  'scripts',
  'src',
  'test',
];

const DEFAULT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.txt',
]);

const IGNORED_PARTS = new Set([
  '.git',
  '.tmp',
  'artifacts',
  'build',
  'dist',
  'node_modules',
  'reports',
]);

const ROUTER_GENERATED_PREFIXES = [
  '.tmp/agent-router-lite/',
  'reports/agent_cost_ledger/',
  'reports/stage_task_packets/',
];

const PROTECTED_DIRTY_PREFIXES = [
  'docs/OPS/STATUS/',
  'docs/OPERATIONS/',
];

const PROTECTED_DIRTY_PATHS = new Set([
  DEFAULT_POLICY_PATH,
  'CANON.md',
  'CANON_STATUS.json',
]);

export function utcNowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

export function resolveProjectPath(projectRoot, candidate) {
  return path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);
}

export function relativeProjectPath(projectRoot, candidate) {
  const relative = path.relative(projectRoot, candidate);
  return relative && !relative.startsWith('..') ? toPosix(relative) : candidate;
}

export function readJsonFile(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`JSON_OBJECT_EXPECTED:${filePath}`);
  }
  return payload;
}

export function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

export function appendJsonLine(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
  return filePath;
}

function sha256Bytes(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function isIgnoredRelativePath(relativePath) {
  const parts = relativePath.split('/');
  return parts.some((part) => IGNORED_PARTS.has(part));
}

function isCandidateFile(projectRoot, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const relativePath = relativeProjectPath(projectRoot, filePath);
  if (isIgnoredRelativePath(relativePath)) return false;
  return DEFAULT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  if (!stat.isDirectory()) return [];
  const rows = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const nextPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_PARTS.has(entry.name)) rows.push(...walkFiles(nextPath));
    } else if (entry.isFile()) {
      rows.push(nextPath);
    }
  }
  return rows;
}

function candidateFiles(projectRoot, includeRoots = DEFAULT_INCLUDE_ROOTS, maxFiles = 400) {
  const files = [];
  for (const rootName of includeRoots) {
    const root = path.join(projectRoot, rootName);
    files.push(...walkFiles(root).filter((filePath) => isCandidateFile(projectRoot, filePath)));
  }
  return [...new Set(files)]
    .sort((left, right) => relativeProjectPath(projectRoot, left).localeCompare(relativeProjectPath(projectRoot, right)))
    .slice(0, maxFiles);
}

function fileState(projectRoot, files) {
  const rows = [];
  const hash = crypto.createHash('sha256');
  for (const filePath of files) {
    const relativePath = relativeProjectPath(projectRoot, filePath);
    const contentHash = sha256File(filePath);
    const size = fs.statSync(filePath).size;
    rows.push({ path: relativePath, sha256: contentHash, size });
    hash.update(relativePath);
    hash.update(contentHash);
    hash.update(String(size));
  }
  return { stateHash: hash.digest('hex'), rows };
}

function lineCount(text) {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
}

function symbolsFor(filePath, text, maxSymbols = 24) {
  const ext = path.extname(filePath).toLowerCase();
  const lines = text.split(/\r\n|\r|\n/u);
  const symbols = [];
  if (ext === '.md') {
    for (let index = 0; index < lines.length && symbols.length < maxSymbols; index += 1) {
      const trimmed = lines[index].trim();
      if (trimmed.startsWith('#')) symbols.push(`${trimmed.slice(0, 90)}:${index + 1}`);
    }
    return symbols;
  }
  if (ext === '.json') {
    try {
      const payload = JSON.parse(text);
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return Object.keys(payload).slice(0, maxSymbols).map((key) => `key ${key}`);
      }
    } catch {
      return ['json_parse_error'];
    }
  }
  if (['.js', '.mjs', '.ts'].includes(ext)) {
    for (let index = 0; index < lines.length && symbols.length < maxSymbols; index += 1) {
      const line = lines[index];
      const match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/u)
        || line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Z0-9_$]+)/u)
        || line.match(/^\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/u);
      if (match) symbols.push(`${match[0].trim().slice(0, 90)}:${index + 1}`);
    }
  }
  return symbols;
}

function renderRepoMap(projectRoot, files) {
  const lines = [
    `schema_version: ${REPO_MAP_SCHEMA_VERSION}`,
    'claim_boundary: observed_only | repo_map_only | no_external_model_call | dev_tooling_only',
    'purpose: compact repo map for scoped cheap-worker packets; not source of truth',
    '',
    'files:',
  ];
  for (const filePath of files) {
    const relativePath = relativeProjectPath(projectRoot, filePath);
    const text = fs.readFileSync(filePath, 'utf8');
    lines.push(`- ${relativePath} | lines=${lineCount(text)} | sha256=${sha256Bytes(Buffer.from(text)).slice(0, 12)}`);
    for (const symbol of symbolsFor(filePath, text)) {
      lines.push(`  - ${symbol}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function buildRepoMap(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const outputPath = resolveProjectPath(projectRoot, options.outputPath || DEFAULT_REPO_MAP_PATH);
  const manifestPath = resolveProjectPath(projectRoot, options.manifestPath || DEFAULT_REPO_MAP_MANIFEST_PATH);
  const files = candidateFiles(projectRoot, options.includeRoots || DEFAULT_INCLUDE_ROOTS, Number(options.maxFiles || 400));
  const state = fileState(projectRoot, files);
  const existingManifest = readJsonFile(manifestPath, {});
  if (
    fs.existsSync(outputPath)
    && existingManifest.schema_version === REPO_MAP_SCHEMA_VERSION
    && existingManifest.state_hash === state.stateHash
  ) {
    return {
      outputPath,
      manifestPath,
      reusedCache: true,
      fileCount: files.length,
      stateHash: state.stateHash,
      outputSha256: sha256File(outputPath),
    };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderRepoMap(projectRoot, files), 'utf8');
  const outputSha256 = sha256File(outputPath);
  writeJsonFile(manifestPath, {
    schema_version: REPO_MAP_SCHEMA_VERSION,
    generated_at: utcNowIso(),
    output_path: relativeProjectPath(projectRoot, outputPath),
    file_count: files.length,
    state_hash: state.stateHash,
    output_sha256: outputSha256,
    files: state.rows,
    claim_boundary: ['observed_only', 'repo_map_only', 'no_external_model_call', 'dev_tooling_only'],
  });
  return {
    outputPath,
    manifestPath,
    reusedCache: false,
    fileCount: files.length,
    stateHash: state.stateHash,
    outputSha256,
  };
}

function gitValue(projectRoot, args) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  });
  return result.status === 0 && result.stdout.trim()
    ? result.stdout.trim()
    : 'not_collected_git_unavailable';
}

function slug(value) {
  const normalized = String(value || 'continue')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/giu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_|_$/gu, '');
  return normalized.slice(0, 80) || 'continue';
}

function budgetForTask(policy, taskType) {
  const row = policy.task_budgets_usd?.[taskType];
  return Number.isFinite(Number(row?.max_usd)) ? Number(row.max_usd) : 0;
}

function requiredOutput(policy) {
  const contract = policy.task_packet_contract?.required_output || {};
  const result = {};
  for (const [key, type] of Object.entries(contract)) {
    result[key] = type === 'list' ? [] : '';
  }
  return result;
}

export function buildStageTaskPacket(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const policyPath = resolveProjectPath(projectRoot, options.policyPath || DEFAULT_POLICY_PATH);
  const runtimeContractPath = resolveProjectPath(projectRoot, options.runtimeContractPath || DEFAULT_RUNTIME_CONTRACT_PATH);
  const outputDir = resolveProjectPath(projectRoot, options.outputDir || DEFAULT_PACKET_OUTPUT_DIR);
  const policy = readJsonFile(policyPath);
  const repoMap = buildRepoMap({ projectRoot });
  const intent = options.intent || 'AGENT_CONTINUE_MIN';
  const taskType = options.taskType || 'scout_summary';
  const stageId = `${options.packetPrefix || 'dry_run_packet'}__${slug(intent)}`;
  const packetPath = path.join(outputDir, `${stageId}.json`);
  const manifestPath = path.join(outputDir, `${stageId}_manifest.json`);
  const scopeIn = options.scopeIn?.length
    ? options.scopeIn
    : [
        relativeProjectPath(projectRoot, policyPath),
        relativeProjectPath(projectRoot, runtimeContractPath),
        relativeProjectPath(projectRoot, repoMap.outputPath),
      ];
  const payload = {
    schema_version: STAGE_PACKET_SCHEMA_VERSION,
    task_id: stageId,
    packet_id: stageId,
    created_at: utcNowIso(),
    phase: 'phase0_dry_run_no_external_model_call',
    external_model_call_allowed: false,
    deepseek_execution_allowed: false,
    intent,
    role: options.role || 'global_orchestrator',
    workstream: options.workstream || 'agent_cost_router_lite',
    branch: gitValue(projectRoot, ['branch', '--show-current']),
    latest_commit: gitValue(projectRoot, ['rev-parse', 'HEAD']),
    task_type: taskType,
    objective: options.objective || 'Prepare a bounded cheap-worker task packet without external model calls.',
    scope_in: scopeIn,
    scope_out: policy.task_packet_contract?.scope_out_required || [],
    budget_usd: budgetForTask(policy, taskType),
    repo_map: {
      path: relativeProjectPath(projectRoot, repoMap.outputPath),
      manifest_path: relativeProjectPath(projectRoot, repoMap.manifestPath),
      sha256: repoMap.outputSha256,
      file_count: repoMap.fileCount,
      reused_cache: repoMap.reusedCache,
    },
    provided_context_policy: {
      whole_repo_context: 'forbidden',
      prefer_snippets_over_whole_files: true,
      max_files_or_snippets: policy.runtime_limits?.scope_in_max_files_or_snippets || 5,
    },
    required_output: requiredOutput(policy),
    validation_commands: options.validationCommands?.length
      ? options.validationCommands
      : [
          'node scripts/validate-agent-cost-policy.mjs --json',
          'node --test test/unit/agent-router-lite.test.mjs',
        ],
    quality_gate: policy.quality_gate?.accept_deepseek_output_only_after || [],
    kill_switch: policy.kill_switch?.disable_deepseek_lane_for_task_type_if || [],
    claim_boundary: ['observed_only', 'stage_task_packet_dry_run_only', 'no_external_model_call', 'dev_tooling_only'],
    next_gate: 'phase1_validate_packet_builder_before_enabling_read_only_scout',
  };
  writeJsonFile(packetPath, payload);
  const manifest = {
    schema_version: `${STAGE_PACKET_SCHEMA_VERSION}.manifest`,
    packet_path: relativeProjectPath(projectRoot, packetPath),
    packet_sha256: sha256File(packetPath),
    repo_map_sha256: repoMap.outputSha256,
    output_files: [
      relativeProjectPath(projectRoot, packetPath),
      relativeProjectPath(projectRoot, manifestPath),
      relativeProjectPath(projectRoot, repoMap.outputPath),
      relativeProjectPath(projectRoot, repoMap.manifestPath),
    ],
    claim_boundary: payload.claim_boundary,
  };
  writeJsonFile(manifestPath, manifest);
  return { packetPath, manifestPath, repoMap, payload, outputFiles: manifest.output_files };
}

export function validatePolicy(policy) {
  const errors = [];
  if (policy.schema_version !== POLICY_SCHEMA_VERSION) errors.push(`schema_version_must_be:${POLICY_SCHEMA_VERSION}`);
  const limits = policy.runtime_limits || {};
  if (Number(limits.default_gpt_subagents_per_stage) !== 0) errors.push('default_gpt_subagents_per_stage_must_be_0');
  if (Number(limits.max_gpt_subagents_per_stage) > 1) errors.push('max_gpt_subagents_per_stage_must_be_lte_1');
  if (limits.nested_delegation !== 'forbidden') errors.push('nested_delegation_must_be_forbidden');
  if (limits.full_history_delegation !== 'forbidden') errors.push('full_history_delegation_must_be_forbidden');
  if (Number(limits.scoped_task_packet_max_tokens) > 8000) errors.push('scoped_task_packet_max_tokens_must_be_lte_8000');

  const requiredScopeOut = new Set(policy.task_packet_contract?.scope_out_required || []);
  for (const key of [
    'no_app_runtime_network',
    'no_secrets',
    'no_final_canon_verdict',
    'no_release_decision',
    'no_authoritative_ledger_write',
    'no_worker_git_delivery',
    'no_operator_approval',
  ]) {
    if (!requiredScopeOut.has(key)) errors.push(`scope_out_missing:${key}`);
  }

  const requiredOutput = policy.task_packet_contract?.required_output || {};
  for (const key of ['claims', 'files_read', 'lines', 'patch_summary', 'tests_to_run', 'uncertainty', 'red_flags']) {
    if (!(key in requiredOutput)) errors.push(`required_output_missing:${key}`);
  }
  if (policy.task_packet_contract?.scope_in_policy?.whole_repo_context !== 'forbidden') {
    errors.push('whole_repo_context_must_be_forbidden');
  }

  const budgets = policy.task_budgets_usd || {};
  const maxBudgets = {
    scout_summary: 0.02,
    test_draft: 0.03,
    code_draft: 0.05,
    simple_audit: 0.03,
    adversarial_review: 0.1,
    full_stage: 1,
  };
  for (const [taskType, maxBudget] of Object.entries(maxBudgets)) {
    const actual = Number(budgets[taskType]?.max_usd);
    if (!Number.isFinite(actual)) errors.push(`budget_missing:${taskType}`);
    else if (actual > maxBudget) errors.push(`budget_exceeds_max:${taskType}:${actual}>${maxBudget}`);
  }

  const phase2 = policy.rollout_phases?.phase2?.status;
  const phase3 = policy.rollout_phases?.phase3?.status;
  const phase4 = policy.rollout_phases?.phase4?.status;
  const allowedPhaseStatuses = {
    phase2: new Set(['future', 'disabled', 'read_only_scout_enabled']),
    phase3: new Set(['future', 'disabled', 'test_code_draft_enabled']),
    phase4: new Set(['future', 'disabled', 'adversarial_review_enabled']),
  };
  for (const [phase, status] of Object.entries({ phase2, phase3, phase4 })) {
    if (!allowedPhaseStatuses[phase].has(status)) errors.push(`${phase}_status_invalid:${status}`);
  }
  return {
    status: errors.length ? 'error' : 'pass',
    errors,
    schema_version: policy.schema_version,
    policy_status: policy.status,
    phase2_status: phase2,
    phase3_status: phase3,
    phase4_status: phase4,
  };
}

function gitChangedFiles(projectRoot) {
  const changed = new Set();
  for (const args of [
    ['diff', '--name-only'],
    ['status', '--short', '--untracked-files=all'],
  ]) {
    const result = spawnSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    if (result.status !== 0) continue;
    for (const line of result.stdout.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const rawPath = args[0] === 'status' ? line.slice(3).trim() : line.trim();
      const nextPath = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop().trim() : rawPath;
      if (nextPath) changed.add(nextPath);
    }
  }
  return [...changed].sort();
}

function isRouterGeneratedPath(relativePath) {
  return ROUTER_GENERATED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function isProtectedDirtyPath(relativePath) {
  return PROTECTED_DIRTY_PATHS.has(relativePath)
    || PROTECTED_DIRTY_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function enabledTaskTypes(policy) {
  const enabled = new Set();
  if (policy.rollout_phases?.phase2?.status === 'read_only_scout_enabled') {
    enabled.add('scout_summary');
    enabled.add('report_summary');
    enabled.add('json_log_digest');
    enabled.add('simple_audit');
  }
  if (policy.rollout_phases?.phase3?.status === 'test_code_draft_enabled') {
    enabled.add('test_draft');
    enabled.add('code_draft');
  }
  if (policy.rollout_phases?.phase4?.status === 'adversarial_review_enabled') {
    enabled.add('adversarial_review');
    enabled.add('contradiction_review');
    enabled.add('high_risk_diff_review');
  }
  return enabled;
}

function tierForTask(policy, taskType) {
  const tierName = policy.task_budgets_usd?.[taskType]?.tier || '';
  const tier = policy.tiers?.[tierName] || {};
  return { tierName, tier };
}

function selectModel(policy, packet, requestedModel = 'auto') {
  if (requestedModel && !['auto', 'policy'].includes(requestedModel)) return requestedModel;
  const { tier } = tierForTask(policy, packet.task_type);
  return tier.model || 'deepseek-v4-flash';
}

function estimateCostUsd(policy, model, inputTokens, outputTokens) {
  const row = policy.provider_pricing?.deepseek?.models?.[model] || {};
  const inputCost = Number(inputTokens || 0) * Number(row.input_usd_per_1m_tokens || 0) / 1_000_000;
  const outputCost = Number(outputTokens || 0) * Number(row.output_usd_per_1m_tokens || 0) / 1_000_000;
  return Number((inputCost + outputCost).toFixed(8));
}

function validatePacket(policy, packet) {
  const errors = [];
  for (const field of policy.task_packet_contract?.required_fields || []) {
    if (field === 'task_id') {
      if (!packet.task_id && !packet.packet_id) errors.push('missing_task_id_or_packet_id');
    } else if (!(field in packet)) {
      errors.push(`missing_${field}`);
    }
  }
  if (!Array.isArray(packet.scope_in)) errors.push('scope_in_must_be_list');
  if (!Array.isArray(packet.scope_out)) errors.push('scope_out_must_be_list');
  if (!packet.required_output || typeof packet.required_output !== 'object' || Array.isArray(packet.required_output)) {
    errors.push('required_output_must_be_object');
  }
  if (packet.deepseek_execution_allowed === true && packet.external_model_call_allowed !== true) {
    errors.push('deepseek_execution_requires_external_model_call_allowed');
  }
  return errors;
}

function systemPrompt(packet) {
  return [
    'You are a scoped cheap worker for Yalken Writer development.',
    'Use only the provided task packet. Return exactly one JSON object and no prose.',
    'Do not make final canon verdicts, release decisions, operator approvals, git delivery, or secret requests.',
    `Required output keys: ${Object.keys(packet.required_output || {}).sort().join(', ')}`,
  ].join(' ');
}

function userPrompt(packet) {
  return JSON.stringify({
    task_id: packet.task_id || packet.packet_id,
    task_type: packet.task_type,
    objective: packet.objective,
    scope_in: packet.scope_in,
    scope_out: packet.scope_out,
    provided_context: packet.provided_context,
    provided_context_policy: packet.provided_context_policy,
    deterministic_evidence: packet.deterministic_evidence,
    required_output: packet.required_output,
    validation_commands: packet.validation_commands,
  });
}

function requestPayload(packet, model) {
  return {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt(packet) },
      { role: 'user', content: userPrompt(packet) },
    ],
    temperature: 0,
  };
}

function resolveApiKey({ envName = DEFAULT_API_KEY_ENV, keychainService, keychainAccount }) {
  if (process.env[envName]) return { value: process.env[envName], source: 'env' };
  if (keychainService && keychainAccount && process.platform === 'darwin') {
    const result = spawnSync('security', ['find-generic-password', '-s', keychainService, '-a', keychainAccount, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    if (result.status === 0 && result.stdout.trim()) return { value: result.stdout.trim(), source: 'keychain' };
  }
  return { value: '', source: 'missing' };
}

async function callDeepSeek({ baseUrl, apiKey, payload, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/u, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`deepseek_http_error:${response.status}:${text.slice(0, 500)}`);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('deepseek_response_not_object');
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function parseProviderOutput(providerResponse) {
  const content = providerResponse?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return { output: null, errors: ['provider_message_content_missing'] };
  }
  try {
    const output = JSON.parse(content);
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return { output: null, errors: ['provider_message_content_json_not_object'] };
    }
    return { output, errors: [] };
  } catch (error) {
    return { output: null, errors: [`provider_message_content_not_json:${error.message}`] };
  }
}

function validateProviderOutput(packet, output) {
  if (!output) return ['provider_output_missing'];
  const errors = [];
  for (const [key, defaultValue] of Object.entries(packet.required_output || {})) {
    if (!(key in output)) {
      errors.push(`missing_output_key:${key}`);
    } else if (Array.isArray(defaultValue) && !Array.isArray(output[key])) {
      errors.push(`output_key_must_be_list:${key}`);
    } else if (typeof defaultValue === 'string' && typeof output[key] !== 'string') {
      errors.push(`output_key_must_be_string:${key}`);
    }
  }
  return errors;
}

function redFlagCount(output) {
  return Array.isArray(output?.red_flags) ? output.red_flags.length : 0;
}

export async function runCheapAgent(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const policyPath = resolveProjectPath(projectRoot, options.policyPath || DEFAULT_POLICY_PATH);
  const packetPath = resolveProjectPath(projectRoot, options.packetPath || path.join(DEFAULT_PACKET_OUTPUT_DIR, 'dry_run_packet__agent_continue_min.json'));
  const outputDir = resolveProjectPath(projectRoot, options.outputDir || DEFAULT_RUN_OUTPUT_DIR);
  const policy = readJsonFile(policyPath);
  const packet = readJsonFile(packetPath);
  const model = selectModel(policy, packet, options.model || 'auto');
  const packetId = String(packet.task_id || packet.packet_id || 'packet');
  const runId = `cheap_agent__${slug(packetId)}`;
  const requestPreviewPath = path.join(outputDir, `${runId}_request_preview.json`);
  const reportPath = path.join(outputDir, `${runId}_report.json`);
  const costRecordPath = path.join(outputDir, 'agent_cost_ledger.jsonl');
  const request = requestPayload(packet, model);
  const createdAt = utcNowIso();
  const apiKey = resolveApiKey({
    envName: options.apiKeyEnv || policy.provider_secret_lookup?.deepseek?.env_first || DEFAULT_API_KEY_ENV,
    keychainService: options.keychainService || policy.provider_secret_lookup?.deepseek?.keychain_fallback?.service,
    keychainAccount: options.keychainAccount || policy.provider_secret_lookup?.deepseek?.keychain_fallback?.account,
  });
  writeJsonFile(requestPreviewPath, {
    schema_version: CHEAP_AGENT_REQUEST_SCHEMA_VERSION,
    created_at: createdAt,
    provider: 'deepseek',
    model,
    requested_model: options.model || 'auto',
    base_url: options.baseUrl || DEFAULT_BASE_URL,
    packet_path: relativeProjectPath(projectRoot, packetPath),
    packet_sha256: sha256File(packetPath),
    request_payload: request,
    api_key_included: false,
    claim_boundary: ['observed_only', 'request_preview_only', 'api_key_not_recorded'],
  });

  const blockers = validatePacket(policy, packet);
  const changedFiles = gitChangedFiles(projectRoot);
  const blockingChangedFiles = changedFiles.filter((filePath) => !isRouterGeneratedPath(filePath));
  if (
    packet.task_type === 'code_draft'
    && blockingChangedFiles.length > Number(policy.dirty_diff_rule?.if_diff_touches_more_than_files || 5)
  ) {
    blockers.push(`dirty_diff_rule_blocks_code_draft:changed_files>${policy.dirty_diff_rule.if_diff_touches_more_than_files}`);
  }
  if (packet.task_type === 'code_draft' && blockingChangedFiles.some(isProtectedDirtyPath)) {
    blockers.push('dirty_diff_rule_blocks_code_draft:protected_path');
  }
  if (options.execute !== true) blockers.push('execute_flag_not_set');
  if (!apiKey.value) blockers.push(`api_key_missing:${options.apiKeyEnv || DEFAULT_API_KEY_ENV}`);
  if (packet.external_model_call_allowed !== true || packet.deepseek_execution_allowed !== true) {
    blockers.push('packet_does_not_allow_external_deepseek_execution');
  }
  const enabled = enabledTaskTypes(policy);
  if (options.execute === true && !enabled.has(packet.task_type)) blockers.push(`cost_policy_task_not_enabled:${packet.task_type}`);
  const budgetLimit = budgetForTask(policy, packet.task_type);
  const budgetUsd = Number(packet.budget_usd || 0);
  if (options.execute === true && (!Number.isFinite(budgetUsd) || budgetUsd <= 0)) blockers.push('budget_usd_must_be_positive_for_execution');
  if (options.execute === true && budgetLimit && budgetUsd > budgetLimit) {
    blockers.push(`task_budget_exceeds_policy:${packet.task_type}:${budgetUsd}>${budgetLimit}`);
  }
  const { tierName, tier } = tierForTask(policy, packet.task_type);
  if (options.execute === true && Array.isArray(tier.allowed_task_types) && !tier.allowed_task_types.includes(packet.task_type)) {
    blockers.push(`tier_task_type_not_allowed:${tierName}:${packet.task_type}`);
  }

  let providerResponse = null;
  let executed = false;
  if (blockers.length === 0) {
    providerResponse = await callDeepSeek({
      baseUrl: options.baseUrl || DEFAULT_BASE_URL,
      apiKey: apiKey.value,
      payload: request,
      timeoutMs: Number(options.timeoutMs || 180000),
    });
    executed = true;
  }
  const usage = providerResponse?.usage || {};
  const inputTokens = Number(usage.prompt_tokens || 0);
  const outputTokens = Number(usage.completion_tokens || 0);
  const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens);
  const estimatedCostUsd = executed ? estimateCostUsd(policy, model, inputTokens, outputTokens) : 0;
  const { output: providerOutput, errors: parseErrors } = executed ? parseProviderOutput(providerResponse) : { output: null, errors: [] };
  const outputContractErrors = executed ? validateProviderOutput(packet, providerOutput) : [];
  const outputRedFlagCount = redFlagCount(providerOutput);
  const budgetExceeded = Boolean(executed && budgetUsd && estimatedCostUsd > budgetUsd);
  const killSwitchTriggers = [];
  if (parseErrors.length || outputContractErrors.length) killSwitchTriggers.push('output_breaks_json_contract');
  if (budgetExceeded) killSwitchTriggers.push('budget_exceeded');
  if (outputRedFlagCount > 2) killSwitchTriggers.push('more_than_two_red_flags');
  const costRecord = {
    schema_version: COST_LEDGER_SCHEMA_VERSION,
    created_at: createdAt,
    run_id: runId,
    packet_id: packetId,
    provider: 'deepseek',
    model,
    executed,
    blocked: !executed,
    blockers,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: estimatedCostUsd,
    budget_usd: budgetUsd,
    budget_exceeded: budgetExceeded,
    task_type: packet.task_type,
    dirty_changed_file_count: changedFiles.length,
    output_contract_status: executed && parseErrors.length === 0 && outputContractErrors.length === 0 ? 'pass' : (executed ? 'fail' : 'not_executed'),
    output_red_flag_count: outputRedFlagCount,
    kill_switch_triggers: killSwitchTriggers,
    claim_boundary: ['observed_only', 'agent_cost_ledger_only', 'api_key_not_recorded'],
  };
  appendJsonLine(costRecordPath, costRecord);
  const report = {
    schema_version: CHEAP_AGENT_RUN_SCHEMA_VERSION,
    created_at: createdAt,
    run_id: runId,
    packet_path: relativeProjectPath(projectRoot, packetPath),
    request_preview_path: relativeProjectPath(projectRoot, requestPreviewPath),
    cost_record_path: relativeProjectPath(projectRoot, costRecordPath),
    provider: 'deepseek',
    model,
    executed,
    blocked: !executed,
    blockers,
    external_model_call_allowed_by_packet: packet.external_model_call_allowed === true,
    deepseek_execution_allowed_by_packet: packet.deepseek_execution_allowed === true,
    cost_policy_enabled_task_types: [...enabled].sort(),
    cost_policy_task_enabled: enabled.has(packet.task_type),
    api_key_source: apiKey.source,
    api_key_present: Boolean(apiKey.value),
    api_key_value_recorded: false,
    provider_response: executed ? providerResponse : null,
    provider_output: executed ? providerOutput : null,
    provider_output_parse_errors: parseErrors,
    output_contract_errors: outputContractErrors,
    output_contract_status: costRecord.output_contract_status,
    output_red_flag_count: outputRedFlagCount,
    usage: executed ? usage : {},
    estimated_cost_usd: estimatedCostUsd,
    budget_usd: budgetUsd,
    budget_limit_usd: budgetLimit,
    budget_exceeded: budgetExceeded,
    dirty_changed_file_count: changedFiles.length,
    dirty_changed_file_sample: changedFiles.slice(0, 20),
    kill_switch_triggers: killSwitchTriggers,
    claim_boundary: ['observed_only', 'cheap_agent_runner_only', 'api_key_not_recorded'],
    next_gate: executed ? 'orchestrator_deterministic_validation_required' : 'keep_dry_run_or_enable_next_phase_with_owner_approved_policy',
  };
  writeJsonFile(reportPath, report);
  return {
    reportPath,
    requestPreviewPath,
    costRecordPath,
    payload: report,
    outputFiles: [
      relativeProjectPath(projectRoot, reportPath),
      relativeProjectPath(projectRoot, requestPreviewPath),
      relativeProjectPath(projectRoot, costRecordPath),
    ],
  };
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

export function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}${os.EOL}`);
}

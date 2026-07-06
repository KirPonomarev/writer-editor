import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildRepoMap,
  buildStageTaskPacket,
  readJsonFile,
  runCheapAgent,
  validatePolicy,
} from '../../scripts/agent-router-lite.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-agent-router-lite-'));
}

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function writeJson(filePath, payload) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function minimalPolicy() {
  return {
    schema_version: 'yalken.agent_cost_policy.v1',
    status: 'phase0_policy_and_dry_run_only',
    runtime_limits: {
      default_gpt_subagents_per_stage: 0,
      max_gpt_subagents_per_stage: 1,
      nested_delegation: 'forbidden',
      full_history_delegation: 'forbidden',
      scoped_task_packet_max_tokens: 8000,
      scope_in_max_files_or_snippets: 5,
    },
    provider_secret_lookup: {
      deepseek: {
        env_first: 'DEEPSEEK_API_KEY',
        keychain_fallback: { service: 'yalken-writer.deepseek', account: 'DEEPSEEK_API_KEY' },
      },
    },
    provider_pricing: {
      deepseek: {
        models: {
          'deepseek-v4-flash': { input_usd_per_1m_tokens: 0.14, output_usd_per_1m_tokens: 0.28 },
          'deepseek-v4-pro': { input_usd_per_1m_tokens: 0.435, output_usd_per_1m_tokens: 0.87 },
        },
      },
    },
    tiers: {
      tier1_deepseek_flash: { model: 'deepseek-v4-flash', allowed_task_types: ['scout_summary', 'code_draft'] },
      tier2_deepseek_pro: { model: 'deepseek-v4-pro', allowed_task_types: ['adversarial_review'] },
    },
    task_budgets_usd: {
      scout_summary: { tier: 'tier1_deepseek_flash', max_usd: 0.02 },
      test_draft: { tier: 'tier1_deepseek_flash', max_usd: 0.03 },
      code_draft: { tier: 'tier1_deepseek_flash', max_usd: 0.05 },
      simple_audit: { tier: 'tier1_deepseek_flash', max_usd: 0.03 },
      adversarial_review: { tier: 'tier2_deepseek_pro', max_usd: 0.1 },
      full_stage: { tier: 'mixed', max_usd: 1 },
    },
    task_packet_contract: {
      required_fields: ['task_id', 'task_type', 'objective', 'scope_in', 'scope_out', 'budget_usd', 'required_output'],
      scope_in_policy: { whole_repo_context: 'forbidden' },
      scope_out_required: [
        'no_app_runtime_network',
        'no_secrets',
        'no_final_canon_verdict',
        'no_release_decision',
        'no_authoritative_ledger_write',
        'no_worker_git_delivery',
        'no_operator_approval',
      ],
      required_output: {
        claims: 'list',
        files_read: 'list',
        lines: 'list',
        patch_summary: 'string',
        draft_files: 'list',
        apply_notes: 'list',
        tests_to_run: 'list',
        uncertainty: 'string',
        red_flags: 'list',
      },
    },
    quality_gate: { accept_deepseek_output_only_after: ['json_contract_validation'] },
    kill_switch: { disable_deepseek_lane_for_task_type_if: ['output_breaks_json_contract'] },
    dirty_diff_rule: { if_diff_touches_more_than_files: 5 },
    rollout_phases: {
      phase2: { status: 'future' },
      phase3: { status: 'future' },
      phase4: { status: 'future' },
    },
  };
}

function writeMinimalRepo(root) {
  writeFile(path.join(root, 'AGENTS.md'), '# Agents\n');
  writeFile(path.join(root, 'CANON.md'), '# Canon\n');
  writeFile(path.join(root, 'docs/agent_runtime_contract.md'), '# Agent Runtime Contract V1\n');
  writeJson(path.join(root, 'configs/agent_cost_policy.json'), minimalPolicy());
  writeFile(path.join(root, 'src/example.mjs'), 'export function alpha() { return 1; }\nexport const ROUTER_VALUE = 1;\n');
  writeFile(path.join(root, 'test/example.test.mjs'), 'import test from "node:test";\n');
}

test('agent cost policy validates strict cheap-worker boundaries', () => {
  const summary = validatePolicy(minimalPolicy());
  assert.equal(summary.status, 'pass');
  assert.equal(summary.phase2_status, 'future');
  assert.equal(summary.errors.length, 0);
});

test('repo map builds compact file map and reuses cache', () => {
  const root = tempRoot();
  writeMinimalRepo(root);

  const first = buildRepoMap({ projectRoot: root });
  const text = fs.readFileSync(first.outputPath, 'utf8');
  assert.equal(first.reusedCache, false);
  assert.match(text, /src\/example\.mjs/u);
  assert.match(text, /function alpha/u);

  const second = buildRepoMap({ projectRoot: root });
  assert.equal(second.reusedCache, true);
  assert.equal(second.stateHash, first.stateHash);
});

test('stage task packet is dry-run and bounded by policy', () => {
  const root = tempRoot();
  writeMinimalRepo(root);

  const result = buildStageTaskPacket({
    projectRoot: root,
    intent: 'AGENT_CONTINUE_MIN',
    taskType: 'scout_summary',
    objective: 'Summarize a bounded artifact.',
  });
  const packet = readJsonFile(result.packetPath);

  assert.equal(packet.external_model_call_allowed, false);
  assert.equal(packet.deepseek_execution_allowed, false);
  assert.equal(packet.budget_usd, 0.02);
  assert.equal(packet.scope_out.includes('no_worker_git_delivery'), true);
  assert.equal(packet.required_output.red_flags.length, 0);
  assert.equal(packet.repo_map.file_count >= 5, true);
});

test('cheap agent runner defaults to blocked preview and never records secrets', async () => {
  const root = tempRoot();
  writeMinimalRepo(root);
  const packetResult = buildStageTaskPacket({ projectRoot: root });
  const oldKey = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  try {
    const result = await runCheapAgent({
      projectRoot: root,
      packetPath: packetResult.packetPath,
      outputDir: path.join(root, 'reports/agent_cost_ledger/latest'),
      execute: false,
    });
    const report = result.payload;
    const preview = readJsonFile(result.requestPreviewPath);
    const ledgerLines = fs.readFileSync(result.costRecordPath, 'utf8').trim().split(/\r?\n/u);

    assert.equal(report.executed, false);
    assert.equal(report.blocked, true);
    assert.equal(report.api_key_value_recorded, false);
    assert.equal(preview.api_key_included, false);
    assert.equal(preview.request_payload.response_format.type, 'json_object');
    assert.equal(ledgerLines.length, 1);
    assert.equal(JSON.parse(ledgerLines[0]).estimated_cost_usd, 0);
    assert.equal(report.blockers.includes('execute_flag_not_set'), true);
    assert.equal(report.blockers.includes('packet_does_not_allow_external_deepseek_execution'), true);
  } finally {
    if (oldKey) process.env.DEEPSEEK_API_KEY = oldKey;
  }
});

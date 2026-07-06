#!/usr/bin/env node
import {
  parseArgs,
  printJson,
  runCheapAgent,
} from './agent-router-lite.mjs';

const args = parseArgs(process.argv.slice(2));

try {
  const result = await runCheapAgent({
    projectRoot: process.cwd(),
    packetPath: args.packet,
    policyPath: args.policy,
    outputDir: args.outputDir,
    model: args.model,
    baseUrl: args.baseUrl,
    apiKeyEnv: args.apiKeyEnv,
    keychainService: args.keychainService,
    keychainAccount: args.keychainAccount,
    execute: args.execute === true,
    timeoutMs: args.timeoutSeconds ? Number(args.timeoutSeconds) * 1000 : undefined,
  });
  const payload = {
    status: 'ok',
    script: 'run-cheap-agent.mjs',
    metrics: {
      run_id: result.payload.run_id,
      provider: result.payload.provider,
      model: result.payload.model,
      executed: result.payload.executed,
      blocked: result.payload.blocked,
      blocker_count: result.payload.blockers.length,
      api_key_present: result.payload.api_key_present,
      api_key_source: result.payload.api_key_source,
      estimated_cost_usd: result.payload.estimated_cost_usd,
      output_contract_status: result.payload.output_contract_status,
    },
    output_files: result.outputFiles,
    claim_boundary: result.payload.claim_boundary,
    next_action: result.payload.next_gate,
  };
  if (args.json) printJson(payload);
  else console.log(`cheap agent runner ok: executed=${result.payload.executed}, blocked=${result.payload.blocked}`);
} catch (error) {
  const payload = {
    status: 'error',
    script: 'run-cheap-agent.mjs',
    error: { name: error.name, message: error.message },
    next_action: 'repair_cheap_agent_runner_inputs',
  };
  if (args.json) printJson(payload);
  else console.error(`cheap agent runner failed: ${error.message}`);
  process.exitCode = 1;
}

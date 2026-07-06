#!/usr/bin/env node
import {
  buildStageTaskPacket,
  parseArgs,
  printJson,
  relativeProjectPath,
} from './agent-router-lite.mjs';

const args = parseArgs(process.argv.slice(2));
const projectRoot = process.cwd();
const scopeIn = Array.isArray(args.scopeIn) ? args.scopeIn : (args.scopeIn ? [args.scopeIn] : []);
const validationCommands = Array.isArray(args.validationCommand)
  ? args.validationCommand
  : (args.validationCommand ? [args.validationCommand] : []);

try {
  const result = buildStageTaskPacket({
    projectRoot,
    policyPath: args.policy,
    outputDir: args.outputDir,
    intent: args.intent || 'AGENT_CONTINUE_MIN',
    role: args.role,
    workstream: args.workstream,
    taskType: args.taskType || 'scout_summary',
    objective: args.objective,
    scopeIn,
    validationCommands,
  });
  const payload = {
    status: 'ok',
    script: 'build-stage-task-packet.mjs',
    metrics: {
      packet_id: result.payload.packet_id,
      task_type: result.payload.task_type,
      budget_usd: result.payload.budget_usd,
      external_model_call_allowed: result.payload.external_model_call_allowed,
      deepseek_execution_allowed: result.payload.deepseek_execution_allowed,
      repo_map_reused_cache: result.payload.repo_map.reused_cache,
      repo_map_file_count: result.payload.repo_map.file_count,
    },
    output_files: result.outputFiles,
    packet_path: relativeProjectPath(projectRoot, result.packetPath),
    claim_boundary: result.payload.claim_boundary,
    next_action: result.payload.next_gate,
  };
  if (args.json) printJson(payload);
  else console.log(`stage packet ok: ${result.payload.packet_id}, external_model_call_allowed=false`);
} catch (error) {
  const payload = {
    status: 'error',
    script: 'build-stage-task-packet.mjs',
    error: { name: error.name, message: error.message },
    next_action: 'repair_stage_packet_inputs',
  };
  if (args.json) printJson(payload);
  else console.error(`stage packet failed: ${error.message}`);
  process.exitCode = 1;
}

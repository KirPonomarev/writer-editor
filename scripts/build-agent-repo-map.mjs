#!/usr/bin/env node
import {
  buildRepoMap,
  parseArgs,
  printJson,
  relativeProjectPath,
} from './agent-router-lite.mjs';

const args = parseArgs(process.argv.slice(2));
const projectRoot = process.cwd();
try {
  const result = buildRepoMap({
    projectRoot,
    outputPath: args.outputPath,
    manifestPath: args.manifestPath,
    maxFiles: args.maxFiles ? Number(args.maxFiles) : undefined,
  });
  const payload = {
    status: 'ok',
    script: 'build-agent-repo-map.mjs',
    metrics: {
      repo_map_reused_cache: result.reusedCache,
      repo_map_file_count: result.fileCount,
      repo_map_state_hash: result.stateHash,
    },
    output_files: [
      relativeProjectPath(projectRoot, result.outputPath),
      relativeProjectPath(projectRoot, result.manifestPath),
    ],
    claim_boundary: ['observed_only', 'repo_map_only', 'no_external_model_call'],
    next_action: 'build-stage-task-packet.mjs',
  };
  if (args.json) printJson(payload);
  else console.log(`repo map ok: files=${result.fileCount}, reused_cache=${result.reusedCache}`);
} catch (error) {
  const payload = {
    status: 'error',
    script: 'build-agent-repo-map.mjs',
    error: { name: error.name, message: error.message },
    next_action: 'repair_repo_map_inputs',
  };
  if (args.json) printJson(payload);
  else console.error(`repo map failed: ${error.message}`);
  process.exitCode = 1;
}

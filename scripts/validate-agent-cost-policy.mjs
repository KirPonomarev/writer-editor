#!/usr/bin/env node
import {
  DEFAULT_POLICY_PATH,
  parseArgs,
  printJson,
  readJsonFile,
  resolveProjectPath,
  validatePolicy,
} from './agent-router-lite.mjs';

const args = parseArgs(process.argv.slice(2));
const policyPath = resolveProjectPath(process.cwd(), args.policy || DEFAULT_POLICY_PATH);

try {
  const summary = validatePolicy(readJsonFile(policyPath));
  if (args.json) printJson(summary);
  else if (summary.status === 'pass') console.log('agent cost policy validation passed');
  else console.error(`agent cost policy validation failed: ${summary.errors.join(', ')}`);
  if (summary.status !== 'pass') process.exitCode = 1;
} catch (error) {
  const payload = {
    status: 'error',
    error: `${error.name}: ${error.message}`,
  };
  if (args.json) printJson(payload);
  else console.error(`agent cost policy validation failed: ${error.message}`);
  process.exitCode = 1;
}

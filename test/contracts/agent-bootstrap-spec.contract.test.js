const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const REPO_ROOT = process.cwd();
const SPEC_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPERATIONS',
  'STATUS',
  'AGENT_BOOTSTRAP_ONE_SHOT_SPEC_V1_0.json',
);

test('agent bootstrap spec: required machine-bound fields are present', () => {
  const doc = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

  assert.equal(doc.documentId, 'AGENT_BOOTSTRAP_ONE_SHOT_SPEC_V1_0');
  assert.equal(doc.documentStatus, 'ACTIVE_BOOTSTRAP_FOR_NEW_AGENT');
  assert.equal(doc.threadModel.name, 'TWO_THREAD_STRICT');
  assert.equal(doc.executionTicket.required, true);
  assert.equal(doc.executionTicket.requiredFields.length >= 18, true);
  assert.equal(doc.automationPolicy.mode, 'STRICT');
  assert.equal(doc.automationPolicy.promptMode, 'PROMPT_DISABLED');
});

test('agent bootstrap spec checker: policy and spec alignment passes', () => {
  const checkerPath = path.join(REPO_ROOT, 'scripts', 'contracts', 'check-agent-bootstrap-spec.mjs');
  const result = spawnSync(process.execPath, [checkerPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.match(output, /CP-7 AGENT_BOOTSTRAP_SPEC_OK=1/);
  assert.match(output, /CP-8 EXECUTION_TICKET_SCHEMA_OK=1/);
  assert.match(output, /CP-9 AUTOMATION_POLICY_ALIGNMENT_OK=1/);
});

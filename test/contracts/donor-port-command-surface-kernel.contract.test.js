const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ALLOWED_COMMAND_IDS, createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');

test('donor port command surface kernel: allowlist is fixed to minimal non-ui command ids', () => {
  assert.deepEqual(ALLOWED_COMMAND_IDS, [
    'cmd.project.open',
    'cmd.project.save',
    'cmd.project.saveAs',
    'cmd.project.importMarkdownV1',
    'cmd.project.exportMarkdownV1',
    'cmd.project.releaseClaim.admit',
  ]);
});

test('donor port command surface kernel: rejects unknown command ids with typed envelope', async () => {
  const kernel = createCommandSurfaceKernel({});
  const result = await kernel.dispatch('cmd.project.unknown', {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_COMMAND_ID_NOT_ALLOWED');
  assert.equal(result.error.reason, 'COMMAND_ID_NOT_ALLOWED');
});

test('donor port command surface kernel: rejects non-object payloads with typed envelope', async () => {
  const kernel = createCommandSurfaceKernel({
    'cmd.project.open': async () => ({ ok: true }),
  });
  const result = await kernel.dispatch('cmd.project.open', null);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING');
  assert.equal(result.error.reason, 'ARGS_OBJECT_REQUIRED');
});

test('donor port command surface kernel: normalizes thrown handler errors', async () => {
  const kernel = createCommandSurfaceKernel({
    'cmd.project.save': async () => {
      throw Object.assign(new Error('save exploded'), {
        code: 'E_SAVE_FAIL',
        reason: 'SAVE_FAILED',
        details: { phase: 'write' },
      });
    },
  });
  const result = await kernel.dispatch('cmd.project.save', {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_SAVE_FAIL');
  assert.equal(result.error.op, 'cmd.project.save');
  assert.equal(result.error.reason, 'SAVE_FAILED');
  assert.deepEqual(result.error.details, { phase: 'write' });
});

test('donor port command surface kernel: main routes minimal command family through kernel', () => {
  const mainText = fs.readFileSync(path.join(process.cwd(), 'src', 'main.js'), 'utf8');
  assert.match(mainText, /createCommandSurfaceKernel/);
  assert.match(mainText, /open:\s*COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_OPEN/);
  assert.match(mainText, /save:\s*COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_SAVE/);
  assert.match(mainText, /saveAs:\s*COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_SAVE_AS/);
  assert.match(mainText, /dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_IMPORT_MARKDOWN_V1/);
  assert.match(mainText, /dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_EXPORT_MARKDOWN_V1/);
  assert.match(mainText, /'cmd\.project\.releaseClaim\.admit':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_RELEASE_CLAIM_ADMIT,\s*payload\);/);
  assert.match(mainText, /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.releaseClaim\.admit'/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('doctor emits exactly one canonical SECTOR_M_PHASE token', () => {
  const result = spawnSync(process.execPath, ['scripts/doctor.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CHECKS_BASELINE_VERSION: 'v1.3',
      EFFECTIVE_MODE: 'STRICT',
      SECTOR_U_FAST_DURATION_MS: '10',
    },
  });

  assert.equal(result.status, 0, `doctor failed:\n${result.stdout}\n${result.stderr}`);
  const lines = String(result.stdout || '').split(/\r?\n/);
  const phaseLines = lines.filter((line) => line.startsWith('SECTOR_M_PHASE='));
  assert.equal(phaseLines.length, 1, `expected exactly one SECTOR_M_PHASE token, got ${phaseLines.length}`);
});

// Exercise the actual doctor evaluator against actual source and missing guards.
test('doctor M3 recognizes the protocol adapter and rejects removed IPC guards', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync('scripts/doctor.mjs', 'utf8');
  const start = source.indexOf('function evaluateM3CommandWiringTokens(');
  const end = source.indexOf('\nfunction ', start + 1);
  const constants = source.match(/^const M3_[A-Z_]+_PATH = .+;$/gm).join('\n');
  const main = fs.readFileSync('src/main.js', 'utf8');
  function evaluate(text) {
    const context = { fs: { existsSync: fs.existsSync, readFileSync: (p, ...args) => p === 'src/main.js' ? text : fs.readFileSync(p, ...args) },
      sectorMPhaseIndex: () => 3, console: { log() {} }, result: null };
    vm.runInNewContext(constants + '\n' + source.slice(start, end) + "\nresult=evaluateM3CommandWiringTokens({phase:'M3'});", context);
    return context.result;
  }
  assert.equal(evaluate(main).commandWiringOk, 1);
  for (const marker of [
    "guardedProtocolHandle('ui:command-bridge', async (_, request) => {",
    'const guardedProtocolHandle = (channel, handler) => guardedHandle(channel, async (event, request) => {',
    "const envelopeVerdict = validateIpcEnvelope(request, 'ui:command-bridge');",
    'if (!envelopeVerdict.ok) {',
  ]) {
    assert.ok(main.includes(marker), marker);
    const handler = main.indexOf("guardedProtocolHandle('ui:command-bridge'");
    const at = marker === 'if (!envelopeVerdict.ok) {' ? main.indexOf(marker, handler) : main.indexOf(marker);
    assert.equal(evaluate(main.slice(0, at) + 'removed guard' + main.slice(at + marker.length)).commandWiringOk, 0, marker);
  }
});

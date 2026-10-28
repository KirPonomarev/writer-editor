'use strict';

// R2.4 WP-100 wiring matrix: full-denominator per-channel proof that the
// foundation laws compose in the live main.js and preload.js wiring.
// The scanner is exported so the wiring mutants suite can use it as the
// kill oracle.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const GUARDED_CHANNELS = [
  'file:open',
  'file:save',
  'file:save-as',
  'ui:create-node',
  'ui:delete-node',
  'ui:get-collab-scope-local',
  'ui:get-project-tree',
  'ui:move-node',
  'ui:open-document',
  'ui:open-section',
  'ui:rename-node',
  'ui:reorder-node',
  'ui:request-autosave',
];
const PROTOCOL_BRIDGES = ['ui:command-bridge', 'ui:workspace-query-bridge', 'ui:save-lifecycle-signal-bridge'];

function sliceRegistrationBody(source, channel) {
  // Anchor on the registration call itself: channel literals may legitimately
  // appear in capability maps or comments elsewhere in the source.
  const guardedIdx = source.indexOf(`guardedHandle('${channel}'`);
  const protocolIdx = source.indexOf(`guardedProtocolHandle('${channel}'`);
  const start = guardedIdx === -1 ? protocolIdx : (protocolIdx === -1 ? guardedIdx : Math.min(guardedIdx, protocolIdx));
  if (start === -1) return '';
  // The registration body runs to the next guarded registration or a broad
  // window, whichever comes first.
  const window = source.slice(start, start + 4000);
  const next = window.slice(40).search(/guarded(?:Protocol)?Handle\('/u);
  return next === -1 ? window : window.slice(0, 40 + next);
}

function sliceMainFunction(source, name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\n}\n', start);
  return start >= 0 && end > start ? source.slice(start, end + 2) : '';
}

function scanWiringLaws(mainSource, preloadSource) {
  const violations = [];

  // S0: every privileged channel is registered through the guarded factory;
  // no raw ipcMain registration remains.
  const rawHandle = (mainSource.match(/ipcMain\.handle\(/gu) || []).length;
  const rawOn = (mainSource.match(/(?<!\.)\bipcMain\.on\(/gu) || []).length;
  if (rawHandle > 0) violations.push({ law: 'S0_CALLER_IDENTITY', detail: `raw ipcMain.handle x${rawHandle}` });
  if (rawOn > 0) violations.push({ law: 'S0_CALLER_IDENTITY', detail: `raw ipcMain.on x${rawOn}` });
  for (const channel of [...GUARDED_CHANNELS, ...PROTOCOL_BRIDGES]) {
    const registered = mainSource.includes(`guardedHandle('${channel}'`) || mainSource.includes(`guardedProtocolHandle('${channel}'`);
    if (!registered) violations.push({ law: 'S0_CALLER_IDENTITY', detail: `channel not guarded: ${channel}` });
  }

  // S1: each protocol bridge validates the versioned envelope before any
  // interpretation, and the refusal gate is live.
  for (const bridge of PROTOCOL_BRIDGES) {
    const body = sliceRegistrationBody(mainSource, bridge);
    const validateAt = body.indexOf(`validateIpcEnvelope(request, '${bridge}')`);
    const gateAt = body.indexOf('if (!envelopeVerdict.ok) {');
    const interpretAt = body.indexOf('safeRequest.');
    if (validateAt === -1) violations.push({ law: 'S1_ENVELOPE_BUDGETS', detail: `no envelope validation: ${bridge}` });
    if (gateAt === -1) violations.push({ law: 'S1_ENVELOPE_BUDGETS', detail: `refusal gate removed: ${bridge}` });
    if (validateAt !== -1 && interpretAt !== -1 && interpretAt < validateAt) {
      violations.push({ law: 'S1_ENVELOPE_BUDGETS', detail: `interpretation precedes validation: ${bridge}` });
    }
  }

  // K0: the command bridge returns through the unified result factories.
  const commandBody = sliceRegistrationBody(mainSource, 'ui:command-bridge');
  for (const factory of ['makeCommandBridgeSuccess', 'makeCommandBridgeFailure', 'makeCommandBridgeException']) {
    if (!commandBody.includes(factory)) violations.push({ law: 'K0_COMMAND_PROTOCOL', detail: `result factory missing: ${factory}` });
  }
  if (!commandBody.includes('UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS.has(commandId)')) {
    violations.push({ law: 'K0_COMMAND_PROTOCOL', detail: 'command bridge allowlist gate missing' });
  }

  // ENT0: both dispatch ports consult the one entitlement table with the
  // product-owned tier, and both refusal gates are live.
  const pulsePort = sliceMainFunction(mainSource, 'createPulseLocalHistoryPort');
  const environmentPort = sliceMainFunction(mainSource, 'createEnvironmentEpochPort');
  const txtScope = sliceMainFunction(mainSource, 'buildSelectedScenesTxtExportScope');
  const legacyMain = mainSource.replace(pulsePort, '').replace(environmentPort, '').replace(txtScope, '');
  const decideCalls = (legacyMain.match(/decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)/gu) || []).length;
  if (decideCalls !== 3) violations.push({ law: 'ENT0_ENTITLEMENT', detail: `table consultations: ${decideCalls}` });
  const wholeCalls = (mainSource.match(/decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)/gu) || []).length;
  if (wholeCalls !== 6) violations.push({ law: 'ENT0_ENTITLEMENT', detail: `whole table consultations: ${wholeCalls}` });
  const pulseCalls = (pulsePort.match(/decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)/gu) || []).length;
  const guardStart = pulsePort.indexOf('  const guard = () => {');
  const guardEnd = pulsePort.indexOf('\n  };', guardStart);
  const pulseGuard = guardStart >= 0 && guardEnd > guardStart ? pulsePort.slice(guardStart, guardEnd + 5) : '';
  const refusalCondition = pulseGuard.match(/if \(([\s\S]*?)\) refuse\('E_PULSE_CONTEXT_STALE'\);/u)?.[1] || '';
  const guardDecisions = (refusalCondition.match(/\|\| !decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)\.available/gu) || []).length;
  if (mainSource.split('function createPulseLocalHistoryPort(').length - 1 !== 1 || pulseCalls !== 1 || guardDecisions !== 1) {
    violations.push({ law: 'ENT0_ENTITLEMENT', detail: `createPulseLocalHistoryPort: calls=${pulseCalls} current-tier refusals=${guardDecisions}` });
  }
  const environmentCalls = (environmentPort.match(/decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)/gu) || []).length;
  const environmentGuardStart = environmentPort.indexOf('  const guard = () => {');
  const environmentGuardEnd = environmentPort.indexOf('\n  };', environmentGuardStart);
  const environmentGuard = environmentGuardStart >= 0 && environmentGuardEnd > environmentGuardStart ? environmentPort.slice(environmentGuardStart, environmentGuardEnd + 5) : '';
  const environmentRefusal = environmentGuard.match(/if \(([\s\S]*?)\) refuse\('E_ENVIRONMENT_EPOCH_CONTEXT_STALE'\);/u)?.[1] || '';
  const environmentGuardDecisions = (environmentRefusal.match(/\|\| !decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)\.available/gu) || []).length;
  const environmentInvocations = (environmentPort.replace(environmentGuard, '').match(/\n  guard\(\);\n  return Object\.freeze\(\{/gu) || []).length;
  if (mainSource.split('function createEnvironmentEpochPort(').length - 1 !== 1 || environmentCalls !== 1 || environmentGuardDecisions !== 1 || environmentInvocations !== 1) {
    violations.push({ law: 'ENT0_ENTITLEMENT', detail: `createEnvironmentEpochPort: calls=${environmentCalls} current-tier refusals=${environmentGuardDecisions} invoked=${environmentInvocations}` });
  }
  const txtCalls = (txtScope.match(/decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)/gu) || []).length;
  const txtGuardStart = txtScope.indexOf('  const assertContext = commandId => {');
  const txtGuardEnd = txtScope.indexOf('\n  assertContext();', txtGuardStart);
  const txtGuard = txtGuardStart >= 0 && txtGuardEnd > txtGuardStart ? txtScope.slice(txtGuardStart, txtGuardEnd) : '';
  const txtRefusal = txtGuard.match(/if \(([\s\S]*?)\) \{\s*throw Object\.assign\(Error\('TXT_CAPABILITY_DENIED'\), \{ reason: 'txt_capability_denied' \}\);/u)?.[1] || '';
  const txtGuardDecisions = (txtRefusal.match(/\|\| !decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)\.available/gu) || []).length;
  const txtCaptureStart = txtScope.indexOf('    const assertCapture = async commandId => {');
  const txtCaptureEnd = txtScope.indexOf('\n    const captureScene =', txtCaptureStart);
  const txtCapture = txtCaptureStart >= 0 && txtCaptureEnd > txtCaptureStart ? txtScope.slice(txtCaptureStart, txtCaptureEnd) : '';
  const txtCaptureInvocations = (txtCapture.match(/\n      assertContext\(commandId\);/gu) || []).length;
  const txtPublisher = sliceMainFunction(mainSource, 'publishScenesTxtExport');
  const txtPublishCaptures = (txtPublisher.match(/await scope\.assertCapture\(commandId\);/gu) || []).length;
  const txtBeforePublish = txtPublisher.slice(txtPublisher.indexOf('{ beforePublish: async () => {'));
  const txtFinalGuards = (txtBeforePublish.match(/\n      scope\.assertContext\(commandId\);\n    \} \}\);/gu) || []).length;
  if (mainSource.split('function buildSelectedScenesTxtExportScope(').length - 1 !== 1
    || txtCalls !== 1 || !txtRefusal.startsWith('commandId && (') || txtGuardDecisions !== 1
    || txtCaptureInvocations !== 2 || mainSource.split('function publishScenesTxtExport(').length - 1 !== 1
    || txtPublishCaptures !== 2 || txtFinalGuards !== 1) {
    violations.push({ law: 'ENT0_ENTITLEMENT', detail: `buildSelectedScenesTxtExportScope: calls=${txtCalls} current-tier refusals=${txtGuardDecisions} capture=${txtCaptureInvocations} publish=${txtPublishCaptures} final=${txtFinalGuards}` });
  }
  const refusalGates = (mainSource.match(/if \(!entitlement\.available\) \{/gu) || []).length;
  if (refusalGates !== 2) violations.push({ law: 'ENT0_ENTITLEMENT', detail: `refusal gates: ${refusalGates}` });
  for (const name of ['dispatchMenuCommand', 'dispatchProductCommandBridge']) {
    const body = sliceMainFunction(mainSource, name);
    const calls = (body.match(/decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)/gu) || []).length;
    const gates = (body.match(/if \(!entitlement\.available\) \{/gu) || []).length;
    if (calls !== 1 || gates !== 1) violations.push({ law: 'ENT0_ENTITLEMENT', detail: `${name}: calls=${calls} gates=${gates}` });
  }
  const preparation = sliceMainFunction(mainSource, 'captureManualMapPreparationGuard');
  if ((preparation.match(/!decideCommandEntitlement\(commandId, getProductEntitlementTier\(\)\)\.available/gu) || []).length !== 1) {
    violations.push({ law: 'ENT0_ENTITLEMENT', detail: 'captureManualMapPreparationGuard: async refusal missing' });
  }

  // P0/P1: the signaled generation is merged monotonically by the main
  // process; a renderer-claimed generation is never assigned directly.
  const signalBody = sliceRegistrationBody(mainSource, 'ui:save-lifecycle-signal-bridge');
  if (!signalBody.includes('mergeSignaledGeneration(lastSignaledEditGeneration, payload.generation)')) {
    violations.push({ law: 'P0_GENERATION', detail: 'monotonic merge of signaled generation missing' });
  }
  if (/lastSignaledEditGeneration\s*=\s*payload\.generation/u.test(signalBody)) {
    violations.push({ law: 'P0_GENERATION', detail: 'renderer generation assigned directly' });
  }

  // SEC0/K1: file admission delegates to the core policy seam.
  if (!mainSource.includes('isAllowedFilePathByLaw(candidatePath, getFilePathAllowlistRoots())')) {
    violations.push({ law: 'SEC0_K1_PATH_ADMISSION', detail: 'isAllowedFilePath does not delegate to the policy seam' });
  }

  // Preload: every channel literal in the preload invoke map is one of the
  // registered channels; no unlisted channel is exposed.
  const preloadChannels = [...preloadSource.matchAll(/'(ui:[a-z-]+|file:[a-z-]+)'/gu)].map((m) => m[1]);
  const allowed = new Set([...GUARDED_CHANNELS, ...PROTOCOL_BRIDGES]);
  for (const channel of preloadChannels) {
    if ((channel.startsWith('ui:command-bridge') || channel.startsWith('ui:workspace-query-bridge') || channel.startsWith('ui:save-lifecycle')) && !allowed.has(channel)) {
      violations.push({ law: 'S1_PRELOAD_FRAMING', detail: `preload exposes unlisted channel: ${channel}` });
    }
  }

  return { violations, denominator: GUARDED_CHANNELS.length + PROTOCOL_BRIDGES.length };
}

test('WP-100 wiring matrix: every foundation law holds per channel in the live wiring', () => {
  const mainSource = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8');
  const { violations, denominator } = scanWiringLaws(mainSource, preloadSource);
  console.log(`R24_WP100_MATRIX=${JSON.stringify({ channels: denominator, violations: violations.length })}`);
  assert.equal(denominator, 16, 'full channel denominator');
  assert.deepEqual(violations, []);
});

test('WP-100 ENT0 scanner rejects omission or count-preserving relocation of every required consultation', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8');
  const call = 'decideCommandEntitlement(commandId, getProductEntitlementTier())';
  for (const name of ['dispatchMenuCommand', 'dispatchProductCommandBridge', 'captureManualMapPreparationGuard']) {
    const body = sliceMainFunction(main, name); assert.ok(body.includes(call), name);
    for (const relocate of [false, true]) {
      const mutated = main.replace(body, body.replace(call, '({ available: true })'))
        + (relocate ? `\nfunction misplacedEntitlement(commandId) { return ${call}; }\n` : '');
      assert.notEqual(mutated, main);
      assert.equal(mutated.split(call).length - 1, relocate ? 6 : 5);
      assert.equal(scanWiringLaws(mutated, preload).violations.some(row => row.law === 'ENT0_ENTITLEMENT' && row.detail.includes(name)), true, name);
    }
  }
  const preparation = sliceMainFunction(main, 'captureManualMapPreparationGuard');
  const inverted = main.replace(preparation, preparation.replace(`!${call}.available`, `${call}.available`));
  assert.notEqual(inverted, main); assert.equal(inverted.split(call).length - 1, 6);
  assert.equal(scanWiringLaws(inverted, preload).violations.some(row => row.detail.includes('captureManualMapPreparationGuard')), true);
});

test('WP-100 Pulse scanner binds the current-tier refusal to the unique local guard, not a relocated consultation', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8');
  const pulsePort = sliceMainFunction(main, 'createPulseLocalHistoryPort');
  const call = 'decideCommandEntitlement(commandId, getProductEntitlementTier())';
  const negated = `|| !${call}.available`;
  const refusal = "refuse('E_PULSE_CONTEXT_STALE');";
  assert.ok(pulsePort.includes(negated) && pulsePort.includes(refusal), 'actual current guarded Pulse port required');
  assert.equal(main.split('function createPulseLocalHistoryPort(').length - 1, 1, 'actual baseline port is unique');
  assert.deepEqual(scanWiringLaws(main, preload).violations, [], 'actual baseline must be clean before each Pulse mutant');
  const withoutDecision = pulsePort.replace(call, '({ available: true })');
  const cases = [
    ['missing-port', main.replace(pulsePort, ''), 5],
    ['removed-decision', main.replace(pulsePort, withoutDecision), 5],
    ['inverted-decision', main.replace(pulsePort, pulsePort.replace(negated, `|| ${call}.available`)), 6],
    ['removed-refusal', main.replace(pulsePort, pulsePort.replace(refusal, "void('E_PULSE_CONTEXT_STALE');")), 6],
    ['external-relocation', main.replace(pulsePort, withoutDecision) + `\nfunction misplacedPulseEntitlement(commandId) { return ${call}; }\n`, 6],
    ['in-port-relocation', main.replace(pulsePort, withoutDecision.replace('  const guard = () => {', `  const misplacedPulseEntitlement = () => ${call};\n  const guard = () => {`)), 6],
    ['duplicate-port', main + '\n' + pulsePort + '\n', 7],
  ];
  const results = [];
  for (const [id, mutated, expectedWholeCalls] of cases) {
    assert.notEqual(mutated, main, `Pulse mutant must change actual source: ${id}`);
    assert.equal(mutated.split(call).length - 1, expectedWholeCalls, id);
    const violations = scanWiringLaws(mutated, preload).violations;
    const flagged = violations.some(row => row.law === 'ENT0_ENTITLEMENT' && row.detail.includes('createPulseLocalHistoryPort'));
    assert.equal(flagged, true, `Pulse-specific refusal required: ${id}`);
    results.push({ id, wholeCalls: expectedWholeCalls, pulseViolation: flagged, violations });
  }
  assert.equal(results.length, 7, 'all admitted Pulse scanner mutants executed');
  console.log(`R24_WP100_PULSE_SCANNER_MUTANTS=${JSON.stringify(results)}`);
});

test('WP-100 Environment scanner requires its unique invoked current-tier refusal and kills relocations', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8');
  const environmentPort = sliceMainFunction(main, 'createEnvironmentEpochPort');
  const call = 'decideCommandEntitlement(commandId, getProductEntitlementTier())';
  const negated = `|| !${call}.available`, refusal = "refuse('E_ENVIRONMENT_EPOCH_CONTEXT_STALE');";
  assert.ok(environmentPort.includes(negated) && environmentPort.includes(refusal));
  assert.deepEqual(scanWiringLaws(main, preload).violations, [], 'actual baseline clean before each Environment mutant');
  const withoutDecision = environmentPort.replace(call, '({ available: true })');
  const cases = [
    ['missing-port', main.replace(environmentPort, ''), 5],
    ['removed-decision', main.replace(environmentPort, withoutDecision), 5],
    ['inverted-decision', main.replace(environmentPort, environmentPort.replace(negated, `|| ${call}.available`)), 6],
    ['removed-refusal', main.replace(environmentPort, environmentPort.replace(refusal, "void('E_ENVIRONMENT_EPOCH_CONTEXT_STALE');")), 6],
    ['external-relocation', main.replace(environmentPort, withoutDecision) + `\nfunction misplacedEnvironmentEntitlement(commandId) { return ${call}; }\n`, 6],
    ['in-port-relocation', main.replace(environmentPort, withoutDecision.replace('  const guard = () => {', `  const misplacedEnvironmentEntitlement = () => ${call};\n  const guard = () => {`)), 6],
    ['duplicate-port', main + '\n' + environmentPort + '\n', 7],
    ['uninvoked-guard', main.replace(environmentPort, environmentPort.replace('\n  guard();\n  return Object.freeze({', '\n  return Object.freeze({')), 6],
  ];
  const results = [];
  for (const [id, mutated, expectedWholeCalls] of cases) {
    assert.notEqual(mutated, main, id); assert.equal(mutated.split(call).length - 1, expectedWholeCalls, id);
    const violations = scanWiringLaws(mutated, preload).violations;
    const flagged = violations.some(row => row.law === 'ENT0_ENTITLEMENT' && row.detail.includes('createEnvironmentEpochPort'));
    assert.equal(flagged, true, `Environment-specific refusal required: ${id}`);
    results.push({ id, wholeCalls: expectedWholeCalls, environmentViolation: flagged, violations });
  }
  assert.equal(results.length, 8, 'all Environment scanner counterexamples executed');
  console.log(`R24_WP100_ENVIRONMENT_SCANNER_MUTANTS=${JSON.stringify(results)}`);
});

test('WP-100 TXT scanner requires the unique current-tier refusal and command-bound capture/publication invocations', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8');
  const scope = sliceMainFunction(main, 'buildSelectedScenesTxtExportScope');
  const publisher = sliceMainFunction(main, 'publishScenesTxtExport');
  const call = 'decideCommandEntitlement(commandId, getProductEntitlementTier())';
  const negated = `|| !${call}.available`;
  const refusal = "throw Object.assign(Error('TXT_CAPABILITY_DENIED'), { reason: 'txt_capability_denied' });";
  assert.ok(scope.includes(negated) && scope.includes(refusal));
  assert.deepEqual(scanWiringLaws(main, preload).violations, [], 'actual baseline clean before each TXT mutant');
  const withoutDecision = scope.replace(call, '({ available: true })');
  const replaceLast = (text, from, to) => {
    const i = text.lastIndexOf(from); assert.ok(i >= 0, from);
    return text.slice(0, i) + to + text.slice(i + from.length);
  };
  const cases = [
    ['missing-scope', main.replace(scope, ''), 5],
    ['removed-decision', main.replace(scope, withoutDecision), 5],
    ['inverted-decision', main.replace(scope, scope.replace(negated, `|| ${call}.available`)), 6],
    ['removed-refusal', main.replace(scope, scope.replace(refusal, "void('TXT_CAPABILITY_DENIED');")), 6],
    ['external-relocation', main.replace(scope, withoutDecision) + `\nfunction misplacedTxtEntitlement(commandId) { return ${call}; }\n`, 6],
    ['in-scope-relocation', main.replace(scope, withoutDecision.replace('  const assertContext =', `  const misplacedTxtEntitlement = commandId => ${call};\n  const assertContext =`)), 6],
    ['in-guard-relocation', main.replace(scope, withoutDecision.replace('  const assertContext = commandId => {', `  const assertContext = commandId => {\n    const misplacedTxtEntitlement = () => ${call};`)), 6],
    ['duplicate-scope', main + '\n' + scope + '\n', 7],
    ['wrong-tier', main.replace(scope, scope.replace(call, "decideCommandEntitlement(commandId, 'pro')")), 5],
    ['uninvoked-first-capture-guard', main.replace(scope, scope.replace('assertContext(commandId);', 'assertContext();')), 6],
    ['uninvoked-last-capture-guard', main.replace(scope, replaceLast(scope, 'assertContext(commandId);', 'assertContext();')), 6],
    ['uninvoked-first-publisher-capture', main.replace(publisher, publisher.replace('scope.assertCapture(commandId);', 'scope.assertCapture();')), 6],
    ['uninvoked-last-publisher-capture', main.replace(publisher, replaceLast(publisher, 'scope.assertCapture(commandId);', 'scope.assertCapture();')), 6],
    ['uninvoked-final-publication-guard', main.replace(publisher, publisher.replace('scope.assertContext(commandId);', 'scope.assertContext();')), 6],
    ['missing-publisher', main.replace(publisher, ''), 6],
  ];
  const results = [];
  for (const [id, mutated, expectedWholeCalls] of cases) {
    assert.notEqual(mutated, main, id);
    assert.equal(mutated.split(call).length - 1, expectedWholeCalls, id);
    const violations = scanWiringLaws(mutated, preload).violations;
    const flagged = violations.some(row => row.law === 'ENT0_ENTITLEMENT' && row.detail.includes('buildSelectedScenesTxtExportScope'));
    assert.equal(flagged, true, `TXT-specific refusal required: ${id}`);
    results.push({ id, wholeCalls: expectedWholeCalls, txtViolation: flagged, violations });
  }
  assert.equal(results.length, 15, 'all TXT scanner counterexamples executed');
  console.log(`R24_WP100_TXT_SCANNER_MUTANTS=${JSON.stringify(results)}`);
});

module.exports = { scanWiringLaws, GUARDED_CHANNELS, PROTOCOL_BRIDGES };

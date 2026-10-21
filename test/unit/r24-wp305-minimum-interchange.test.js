'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MINIMUM_INTERCHANGE_OWNERSHIP_V1,
  bindMinimumInterchangeRuntime,
  validateMinimumInterchangeOwnership,
} = require('../../src/core/minimum-interchange-v1.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

function cloneOwnership() {
  return JSON.parse(JSON.stringify(MINIMUM_INTERCHANGE_OWNERSHIP_V1));
}

function runtimeFor(ownership = MINIMUM_INTERCHANGE_OWNERSHIP_V1) {
  const bridgeCommandIds = new Set();
  const menuCommandHandlers = {};
  const ipcCapabilityClasses = {};
  for (const format of ownership.formats) {
    for (const command of format.commands) {
      if (command.bridgeRequired !== false) bridgeCommandIds.add(command.commandId);
      menuCommandHandlers[command.commandId] = () => ({ ok: true });
    }
    for (const channel of format.directChannels || []) {
      ipcCapabilityClasses[channel.channelId] = channel.capabilityClass;
    }
  }
  return { bridgeCommandIds, menuCommandHandlers, ipcCapabilityClasses };
}

test('WP305 minimum interchange declares exact local formats and DOCX-first ownership', () => {
  const verdict = validateMinimumInterchangeOwnership(
    MINIMUM_INTERCHANGE_OWNERSHIP_V1,
    runtimeFor(),
  );

  assert.deepEqual(verdict, {
    ok: true,
    schemaVersion: 'yalken.minimum-interchange-ownership.v1',
    primaryFormatId: 'DOCX',
    formatCount: 4,
    commandCount: 19,
    directChannelCount: 3,
    localOnly: true,
    networkRequired: false,
  });
  assert.equal(Object.isFrozen(MINIMUM_INTERCHANGE_OWNERSHIP_V1), true);
  assert.equal(Object.isFrozen(MINIMUM_INTERCHANGE_OWNERSHIP_V1.formats[0].commands), true);
});

test('WP305 runtime startup binds every interchange command, handler, and direct capability', () => {
  const binding = bindMinimumInterchangeRuntime(runtimeFor());
  assert.equal(binding.ok, true);
  assert.equal(binding.primaryFormatId, 'DOCX');
  assert.equal(Object.isFrozen(binding), true);
  assert.equal(runtimeFor().bridgeCommandIds.has('cmd.project.importTxtV1'), false);
  assert.equal(runtimeFor().bridgeCommandIds.has('cmd.project.importDocxV1'), false);

  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  assert.match(main, /bindMinimumInterchangeRuntime\(\{[\s\S]*bridgeCommandIds: UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS/u);
  assert.match(main, /menuCommandHandlers: MENU_COMMAND_HANDLERS/u);
  assert.match(main, /ipcCapabilityClasses: IPC_CHANNEL_CAPABILITY_CLASS/u);
  assert.match(main, /MINIMUM_INTERCHANGE_RUNTIME_BINDING/u);
});

test('WP305 mutants fail closed when DOCX-first identity or primary export drifts', () => {
  const missingPrimary = cloneOwnership();
  missingPrimary.primaryFormatId = 'MARKDOWN';
  assert.equal(
    validateMinimumInterchangeOwnership(missingPrimary, runtimeFor(missingPrimary)).code,
    'E_MINIMUM_INTERCHANGE_DOCX_FIRST_INVALID',
  );

  const wrongExport = cloneOwnership();
  wrongExport.formats.find((format) => format.formatId === 'DOCX').commands[0].commandId = 'cmd.project.export.pdf';
  assert.equal(
    validateMinimumInterchangeOwnership(wrongExport, runtimeFor(wrongExport)).code,
    'E_MINIMUM_INTERCHANGE_DOCX_PRIMARY_EXPORT_MISSING',
  );
});

test('WP305 mutants fail closed on duplicate command ownership and unsafe import policy', () => {
  const duplicateCommand = cloneOwnership();
  duplicateCommand.formats.find((format) => format.formatId === 'TXT').commands[0].commandId = 'cmd.project.importMarkdownV1';
  assert.equal(
    validateMinimumInterchangeOwnership(duplicateCommand, runtimeFor(duplicateCommand)).code,
    'E_MINIMUM_INTERCHANGE_COMMAND_OWNER_DUPLICATE',
  );

  const inPlaceImport = cloneOwnership();
  inPlaceImport.formats.find((format) => format.formatId === 'MARKDOWN').importMutation = 'MUTATE_CURRENT_PROJECT';
  assert.equal(
    validateMinimumInterchangeOwnership(inPlaceImport, runtimeFor(inPlaceImport)).code,
    'E_MINIMUM_INTERCHANGE_FORMAT_POLICY_INVALID',
  );
});

test('WP305 mutants fail closed on missing command and channel bindings', () => {
  const missingBridge = runtimeFor();
  missingBridge.bridgeCommandIds.delete('cmd.project.exportFullArchiveV1');
  assert.equal(
    validateMinimumInterchangeOwnership(MINIMUM_INTERCHANGE_OWNERSHIP_V1, missingBridge).code,
    'E_MINIMUM_INTERCHANGE_BRIDGE_BINDING_MISSING',
  );

  const missingHandler = runtimeFor();
  delete missingHandler.menuCommandHandlers['cmd.project.txt.importSafeCreate'];
  assert.equal(
    validateMinimumInterchangeOwnership(MINIMUM_INTERCHANGE_OWNERSHIP_V1, missingHandler).code,
    'E_MINIMUM_INTERCHANGE_HANDLER_BINDING_MISSING',
  );

  const wrongCapability = runtimeFor();
  wrongCapability.ipcCapabilityClasses['u:cmd:project:export:docxMin:v1'] = 'project.query';
  assert.equal(
    validateMinimumInterchangeOwnership(MINIMUM_INTERCHANGE_OWNERSHIP_V1, wrongCapability).code,
    'E_MINIMUM_INTERCHANGE_CHANNEL_CAPABILITY_MISMATCH',
  );
});

test('current V2 explicitly owns archive output profiles while strict V1 remains compatible', () => {
  const core = require('../../src/core/minimum-interchange-v1.cjs');
  assert.equal(core.MINIMUM_INTERCHANGE_OWNERSHIP_CURRENT, core.MINIMUM_INTERCHANGE_OWNERSHIP_V2);
  assert.equal(core.MINIMUM_INTERCHANGE_OWNERSHIP_V1.schemaVersion, 'yalken.minimum-interchange-ownership.v1');
  const current = core.MINIMUM_INTERCHANGE_OWNERSHIP_CURRENT;
  assert.equal(current.schemaVersion, 'yalken.minimum-interchange-ownership.v2');
  assert.equal(core.validateMinimumInterchangeOwnershipV2(current, runtimeFor()).ok, true);
  assert.equal(bindMinimumInterchangeRuntime(runtimeFor()).schemaVersion, current.schemaVersion);
  for (const formatId of ['TXT', 'MARKDOWN', 'DOCX']) {
    assert.deepEqual(current.formats.find(row => row.formatId === formatId), MINIMUM_INTERCHANGE_OWNERSHIP_V1.formats.find(row => row.formatId === formatId));
    const altered = structuredClone(current);
    altered.formats.find(row => row.formatId === formatId).atomicExportRequired = false;
    assert.equal(core.validateMinimumInterchangeOwnershipV2(altered, runtimeFor()).ok, false);
    const legacy = cloneOwnership(); legacy.formats.find(row => row.formatId === formatId).atomicExportRequired = false;
    assert.equal(validateMinimumInterchangeOwnership(legacy, runtimeFor()).ok, false);
  }
  const legacyArchive = cloneOwnership(); legacyArchive.formats.find(row => row.formatId === 'PROJECT_ARCHIVE').atomicExportRequired = false;
  assert.equal(validateMinimumInterchangeOwnership(legacyArchive, runtimeFor()).code, 'E_MINIMUM_INTERCHANGE_FORMAT_POLICY_INVALID');
  const archive = current.formats.find(row => row.formatId === 'PROJECT_ARCHIVE');
  assert.equal(archive.defaultAtomicExportRequired, true);
  assert.equal(Object.hasOwn(archive, 'atomicExportRequired'), false);
  assert.equal(Object.isFrozen(archive.outputPolicy.profiles), true);
  assert.deepEqual(archive.outputPolicy.profiles.map(row => [row.profileId, row.atomicPublication]), [
    ['ATOMIC_HARDLINK', true], ['ATOMIC_REPLACE', true], ['EXCLUSIVE_CREATE', false],
  ]);
});

test('V2 rejects mutation or deletion of every declared profile obligation', () => {
  const core = require('../../src/core/minimum-interchange-v1.cjs'), current = core.MINIMUM_INTERCHANGE_OWNERSHIP_CURRENT;
  const archive = current.formats.find(row => row.formatId === 'PROJECT_ARCHIVE');
  for (const operation of ['delete', 'mutate', 'generic']) {
    const altered = structuredClone(current), row = altered.formats.find(format => format.formatId === 'PROJECT_ARCHIVE');
    if (operation === 'delete') delete row.defaultAtomicExportRequired;
    else if (operation === 'mutate') row.defaultAtomicExportRequired = false;
    else row.atomicExportRequired = false;
    assert.equal(core.validateMinimumInterchangeOwnershipV2(altered, runtimeFor()).ok, false, 'default:' + operation);
  }
  for (const key of Object.keys(archive.outputPolicy)) {
    for (const operation of ['delete', 'mutate']) {
      const altered = structuredClone(current), policy = altered.formats.find(row => row.formatId === 'PROJECT_ARCHIVE').outputPolicy;
      if (operation === 'delete') delete policy[key]; else policy[key] = 'UNDECLARED';
      assert.equal(core.validateMinimumInterchangeOwnershipV2(altered, runtimeFor()).ok, false, operation + ':' + key);
    }
  }
  for (const [index, profile] of archive.outputPolicy.profiles.entries()) {
    for (const key of Object.keys(profile)) for (const operation of ['delete', 'mutate']) {
      const altered = structuredClone(current), row = altered.formats.find(row => row.formatId === 'PROJECT_ARCHIVE').outputPolicy.profiles[index];
      if (operation === 'delete') delete row[key]; else row[key] = typeof row[key] === 'boolean' ? !row[key] : 'UNDECLARED';
      assert.equal(core.validateMinimumInterchangeOwnershipV2(altered, runtimeFor()).ok, false, profile.profileId + ':' + operation + ':' + key);
    }
  }
  for (const formatId of ['TXT', 'MARKDOWN', 'DOCX']) {
    const altered = structuredClone(current); altered.formats.find(row => row.formatId === formatId).outputPolicy = structuredClone(archive.outputPolicy);
    assert.equal(core.validateMinimumInterchangeOwnershipV2(altered, runtimeFor()).ok, false, 'cross-format:' + formatId);
  }
});

test('Core selects only observed archive publication paths and rejects generic permission', () => {
  const { selectProjectArchiveOutputProfile: select } = require('../../src/core/minimum-interchange-v1.cjs');
  assert.equal(select({ targetExists: false }).profile.profileId, 'ATOMIC_HARDLINK');
  assert.equal(select({ targetExists: true }).profile.profileId, 'ATOMIC_REPLACE');
  const exclusive = select({ targetExists: false, hardlinkErrorCode: 'ENOTSUP', stagingVerified: true });
  assert.equal(exclusive.ok, true); assert.equal(exclusive.profile.profileId, 'EXCLUSIVE_CREATE');
  assert.equal(exclusive.profile.atomicPublication, false);
  for (const input of [
    { profileId: 'EXCLUSIVE_CREATE' }, { allowNonAtomic: true }, { targetExists: 'false' },
    { targetExists: true, hardlinkErrorCode: 'ENOTSUP', stagingVerified: true },
    { targetExists: false, hardlinkErrorCode: 'EIO', stagingVerified: true },
    { targetExists: false, hardlinkErrorCode: 'ENOTSUP' },
    { targetExists: false, hardlinkErrorCode: 'ENOTSUP', stagingVerified: false },
  ]) assert.equal(select(input).ok, false, JSON.stringify(input));
});

test('Core receipt contract rejects false atomicity and every missing success obligation', () => {
  const { selectProjectArchiveOutputProfile: select, validateProjectArchiveOutputReceipt: validate } = require('../../src/core/minimum-interchange-v1.cjs');
  for (const input of [{ targetExists: false }, { targetExists: true }, { targetExists: false, hardlinkErrorCode: 'ENOTSUP', stagingVerified: true }]) {
    const selected = select(input);
    const receipt = { outputPolicyVersion: selected.schemaVersion, outputProfile: selected.profile.profileId,
      atomicPublication: selected.profile.atomicPublication, bufferVerified: true, stagingVerified: true,
      namePublished: true, publicationOutcome: 'PUBLISHED', fileSynced: true, directorySynced: true,
      writeHandleClosed: true, finalIdentityVerified: true, readbackVerified: true,
      recoveryRequired: false, physicalPowerLossVerified: false, phase: 'VERIFIED', durabilityProfile: selected.profile.durabilityProfile };
    assert.equal(validate(selected.profile, receipt).ok, true);
    for (const key of Object.keys(receipt)) for (const operation of ['delete', 'mutate']) {
      const changed = structuredClone(receipt);
      if (operation === 'delete') delete changed[key]; else changed[key] = typeof changed[key] === 'boolean' ? !changed[key] : 'UNDECLARED';
      assert.equal(validate(selected.profile, changed).ok, false, selected.profile.profileId + ':' + operation + ':' + key);
    }
    const forged = structuredClone(selected.profile); forged.atomicPublication = !forged.atomicPublication;
    assert.equal(validate(forged, receipt).ok, false);
  }
});

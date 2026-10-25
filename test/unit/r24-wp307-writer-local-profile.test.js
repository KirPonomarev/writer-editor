const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WRITER_LOCAL_PROFILE_ID,
  WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED,
  WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS,
  OPTIONAL_PRODUCT_DOMAINS,
  OPTIONAL_QUERY_IDS,
  createWriterLocalProfileProjection,
  isActiveWriterLocalProfile,
  evaluateWriterLocalCommandAccess,
  evaluateWriterLocalQueryAccess,
} = require('../../src/core/writer-local-profile-v1.cjs');

test('WP307 activates WRITER_LOCAL_V1 only for an exact packaged macOS runtime', () => {
  const profile = createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(profile.profileId, WRITER_LOCAL_PROFILE_ID);
  assert.equal(profile.active, true);
  assert.equal(profile.optionalSystemsEnabled, false);
  assert.equal(profile.localPackagingAndCertificationOnly, true);
  assert.equal(profile.signing, false);
  assert.equal(profile.notarization, false);
  assert.equal(profile.publicDistribution, false);
  assert.equal(profile.dependencyAdoption, false);
  assert.equal(profile.cloudAuthority, false);
  assert.equal(profile.userDataMutation, false);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(isActiveWriterLocalProfile(profile), true);

  for (const inactive of [
    createWriterLocalProfileProjection({ isPackaged: false, platform: 'darwin' }),
    createWriterLocalProfileProjection({ isPackaged: true, platform: 'win32' }),
    createWriterLocalProfileProjection({ isPackaged: true, platform: 'linux' }),
  ]) {
    assert.equal(inactive.active, false);
    assert.equal(inactive.profileId, '');
    assert.equal(inactive.optionalSystemsEnabled, true);
    assert.equal(isActiveWriterLocalProfile(inactive), false);
  }
});

test('WP307 denies optional product domains and non-survivor Review commands at dispatch', () => {
  const profile = createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  for (const domain of OPTIONAL_PRODUCT_DOMAINS) {
    const commandId = `fixture.${domain}.command`;
    const decision = evaluateWriterLocalCommandAccess({
      profile,
      commandId,
      productCommandRecord: { id: commandId, domain },
    });
    assert.equal(decision.allowed, false, domain);
    assert.equal(decision.reason, WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED);
  }
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.review.applyExactTextChange',
  }).allowed, false);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.review.exportLocalPacket',
  }).allowed, false);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.review.openDocxReviewPreviewSession',
  }).allowed, true);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.review.applyFullManuscriptExactTextReturn',
  }).allowed, false);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.review.clearSession',
  }).allowed, false);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.plan.switchMode',
  }).allowed, false);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile,
    commandId: 'cmd.project.save',
  }).allowed, true);
  assert.equal(evaluateWriterLocalCommandAccess({
    profile: createWriterLocalProfileProjection({ isPackaged: false, platform: 'darwin' }),
    commandId: 'cmd.project.review.applyExactTextChange',
  }).allowed, true);
});

test('WP307 admits only owner-authorized DOCX review roundtrip survivors in packaged local profile', () => {
  const profile = createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.deepEqual(WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS, [
    'cmd.project.review.openComments',
    'cmd.project.review.openDocxReviewPreviewSession',
    'cmd.project.review.exportDocxReviewPacket',
    'cmd.project.review.exportFullManuscriptDocxReviewPacket',
    'cmd.project.review.editComment',
    'cmd.project.review.decidePendingRevision',
    'cmd.project.review.recordTextRevisions',
    'cmd.project.review.activateDocxReviewPreviewSession',
    'cmd.project.review.applyExactTextChangesBatch',
    'cmd.project.review.applyFormattingReturn',
    'cmd.project.review.applyStructuralReturn',
    'cmd.project.review.inspectFormattingReturnReplay',
    'cmd.project.review.inspectStructuralReturnReplay',
    'cmd.project.review.reloadReconciledScene',
  ]);
  for (const commandId of WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS) {
    const decision = evaluateWriterLocalCommandAccess({ profile, commandId });
    assert.equal(decision.allowed, true, commandId);
    assert.equal(decision.reason, '');
    assert.equal(decision.profileId, WRITER_LOCAL_PROFILE_ID);
  }
});

test('WP307 denies optional queries while Writer, local history and interchange survive', () => {
  const profile = createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  for (const queryId of OPTIONAL_QUERY_IDS) {
    const decision = evaluateWriterLocalQueryAccess({ profile, queryId });
    assert.equal(decision.allowed, false, queryId);
    assert.equal(decision.reason, WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED);
  }
  for (const queryId of [
    'query.projectTree',
    'query.projectLibrary',
    'query.selectedScenesTxtExportScope',
    'query.metadataInspector',
    'query.projectNotes',
    'query.projectSearch',
    'query.reviewSurface',
    'query.sceneHistory',
    'query.rtkNonTextReturnState',
  ]) {
    assert.equal(evaluateWriterLocalQueryAccess({ profile, queryId }).allowed, true, queryId);
  }
});

test('WP307 rejects forged profile objects and preserves Unicode/IME authoring as opaque state', () => {
  const forged = {
    schemaVersion: 'writer-local-profile.v1',
    profileId: WRITER_LOCAL_PROFILE_ID,
    active: true,
    packaged: false,
    platform: 'darwin',
    optionalSystemsEnabled: false,
  };
  assert.equal(isActiveWriterLocalProfile(forged), false);
  assert.equal(evaluateWriterLocalQueryAccess({ profile: forged, queryId: 'query.atlasOverview' }).allowed, true);

  const authorText = 'English אבג العربية İß e\u0301 👩🏽‍💻';
  const profile = createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(evaluateWriterLocalQueryAccess({ profile, queryId: 'query.sceneHistory' }).allowed, true);
  assert.equal(authorText, 'English אבג العربية İß e\u0301 👩🏽‍💻');
});

const atlasProfile = require('../../src/core/writer-local-profile-v1.cjs');
const productRecords = require('../../src/shared/productCommandRegistry.cjs').PRODUCT_COMMAND_RECORDS;

test('full Mac profile admits exactly two existing commands and two queries without enlarging V1', () => {
  const active = atlasProfile.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_V2'); assert.equal(active.schemaVersion, 'writer-local-profile.v2');
  assert.equal(atlasProfile.isActiveWriterAtlasProfile(active), true); assert.equal(Object.isFrozen(active), true);
  assert.equal(Object.isFrozen(active.admittedCommandIds), true); assert.equal(Object.isFrozen(active.admittedQueryIds), true);
  assert.deepEqual(active.admittedCommandIds, ['manualMap.create', 'manualMap.node.add']);
  assert.deepEqual(active.admittedQueryIds, ['query.atlasCurrentScene', 'query.manualMapWorkbench']);
  assert.equal(active.optionalSystemsEnabled, false);
  for (const key of ['signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
  const admitted = productRecords.filter(record => atlasProfile.evaluateWriterLocalCommandAccess({
    profile: active, commandId: record.id, productCommandRecord: record }).allowed).map(row => row.id);
  assert.deepEqual(admitted, ['manualMap.create', 'manualMap.node.add']);
  for (const queryId of OPTIONAL_QUERY_IDS) assert.equal(atlasProfile.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    active.admittedQueryIds.includes(queryId), queryId);
  const old = createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(old.profileId, 'WRITER_LOCAL_V1'); assert.equal(old.schemaVersion, 'writer-local-profile.v1');
  assert.equal('admittedCommandIds' in old, false);
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'win32' }, { isPackaged: true, platform: 'linux' }])
    assert.deepEqual(atlasProfile.createWriterAtlasProfileProjection(options), createWriterLocalProfileProjection(options));
});

test('full Mac profile refuses malformed policy, near IDs and fabricated optional domain records', () => {
  const active = atlasProfile.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' });
  for (const patch of [{ packaged: false }, { active: false }, { platform: 'linux' }, { schemaVersion: 'writer-local-profile.v1' },
    { profileId: 'WRITER_LOCAL_V1' }, { optionalSystemsEnabled: true }, { cloudAuthority: true },
    { admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.create'] }, { admittedQueryIds: [] }, { ownerApproved: true }]) {
    const forged = { ...active, ...patch };
    assert.equal(atlasProfile.isActiveWriterAtlasProfile(forged), false, JSON.stringify(patch));
    assert.equal(atlasProfile.evaluateWriterLocalCommandAccess({ profile: forged, commandId: 'manualMap.create',
      productCommandRecord: { id: 'manualMap.create', domain: 'manualMap' } }).allowed, false);
    assert.equal(atlasProfile.evaluateWriterLocalQueryAccess({ profile: forged, queryId: 'query.manualMapWorkbench' }).allowed, false);
  }
  for (const id of ['manualMap.create ', ' manualMap.node.add', 'manualMap.create.extra', 'manualMap.node.update', 'manualMap.export.json', 'atlas.entity.create'])
    assert.equal(atlasProfile.evaluateWriterLocalCommandAccess({ profile: active, commandId: id,
      productCommandRecord: { id, domain: id.startsWith('atlas') ? 'atlas' : 'manualMap' } }).allowed, false, id);
  for (const record of [null, { id: 'foreign', domain: 'manualMap' }, { id: 'manualMap.create', domain: 'atlas' }])
    assert.equal(atlasProfile.evaluateWriterLocalCommandAccess({ profile: active, commandId: 'manualMap.create', productCommandRecord: record }).allowed, false);
  for (const queryId of ['query.atlasCurrentScene ', ' query.manualMapWorkbench', 'query.manualMapWorkbench.extra', 'query.collabScopeLocal', 'query.stage10ProductState'])
    assert.equal(atlasProfile.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, false, queryId);
  for (const commandId of WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS)
    assert.equal(atlasProfile.evaluateWriterLocalCommandAccess({ profile: active, commandId }).allowed, true, commandId);
  for (const queryId of ['query.projectTree', 'query.sceneHistory', 'query.projectLibrary'])
    assert.equal(atlasProfile.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, true, queryId);
});

const historicalManualMapIds = [
  'manualMap.create', 'manualMap.node.add', 'manualMap.node.update', 'manualMap.node.delete',
  'manualMap.edge.add', 'manualMap.edge.update', 'manualMap.edge.delete',
  'manualMap.group.create', 'manualMap.group.update', 'manualMap.group.delete',
  'manualMap.attachment.add', 'manualMap.portal.add', 'manualMap.template.apply',
  'manualMap.export.json', 'manualMap.export.imagePdf', 'manualMap.import.jsonRepeat',
];

test('manual-map V3 is closed over all sixteen existing records while V1 and V2 stay unchanged', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  const records = require('../../src/shared/productCommandRegistry.cjs').PRODUCT_COMMAND_RECORDS;
  const active = m.createWriterManualMapProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(active.profileId, 'WRITER_LOCAL_MANUAL_MAP_V3');
  assert.equal(m.isActiveWriterManualMapProfile(active), true);
  assert.equal(active.optionalSystemsEnabled, false);
  assert.equal(Object.isFrozen(active.admittedCommandIds), true);
  assert.equal(active.admittedCommandIds.length, 16);
  assert.deepEqual([...active.admittedCommandIds].sort(), [...historicalManualMapIds].sort());
  for (const r of records) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: r.id, productCommandRecord: r }).allowed,
    historicalManualMapIds.includes(r.id), r.id);
  for (const queryId of OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    ['query.atlasCurrentScene', 'query.manualMapWorkbench'].includes(queryId), queryId);
  const record = records.find(r => r.id === 'manualMap.node.update');
  for (const old of [m.createWriterLocalProfileProjection, m.createWriterAtlasProfileProjection])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: old({ isPackaged: true, platform: 'darwin' }), commandId: record.id, productCommandRecord: record }).allowed, false);
  for (const options of [{}, { isPackaged: true, platform: 'linux' }, { isPackaged: false, platform: 'darwin' }])
    assert.deepEqual(m.createWriterManualMapProfileProjection(options), m.createWriterLocalProfileProjection(options));
  for (const patch of [{ optionalSystemsEnabled: true }, { extra: true }, { admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.create'] },
    { admittedQueryIds: [...active.admittedQueryIds].reverse() }, { platform: 'linux' }]) {
    const profile = { ...active, ...patch };
    assert.equal(m.isActiveWriterManualMapProfile(profile), false);
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: record.id, productCommandRecord: record }).allowed, false);
  }
  for (const commandId of ['manualMap.node.update ', 'manualMap.node.update.extra', ' manualMap.node.update'])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId, productCommandRecord: { ...record, id: commandId } }).allowed, false);
  for (const productCommandRecord of [null, { ...record, domain: 'atlas' }, { ...record, id: 'manualMap.create' }])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: record.id, productCommandRecord }).allowed, false);
});


test('manual-map V4 admits exactly historical sixteen plus Markdown and preserves all old profiles', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), records = require('../../src/shared/productCommandRegistry.cjs').PRODUCT_COMMAND_RECORDS;
  const options = { isPackaged: true, platform: 'darwin' }, active = m.createWriterManualMapMarkdownProfileProjection(options);
  const expected = [...historicalManualMapIds, 'manualMap.export.markdown'];
  assert.equal(active.profileId, 'WRITER_LOCAL_MANUAL_MAP_V4'); assert.equal(active.schemaVersion, 'writer-local-profile.v4');
  assert.equal(m.isActiveWriterManualMapMarkdownProfile(active), true); assert.equal(active.optionalSystemsEnabled, false);
  assert.equal(Object.isFrozen(active), true); assert.equal(Object.isFrozen(active.admittedCommandIds), true);
  assert.deepEqual([...active.admittedCommandIds], expected); assert.equal(expected.length, 17);
  assert.deepEqual([...active.admittedQueryIds], ['query.atlasCurrentScene', 'query.manualMapWorkbench']);
  for (const r of records) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: r.id, productCommandRecord: r }).allowed,
    expected.includes(r.id), r.id);
  for (const queryId of OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    ['query.atlasCurrentScene', 'query.manualMapWorkbench'].includes(queryId), queryId);
  for (const key of ['signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
  const record = records.find(r => r.id === 'manualMap.export.markdown'); assert.ok(record);
  for (const factory of [m.createWriterLocalProfileProjection, m.createWriterAtlasProfileProjection, m.createWriterManualMapProfileProjection])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: factory(options), commandId: record.id, productCommandRecord: record }).allowed, false);
  for (const inactive of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: true, platform: 'win32' }])
    assert.deepEqual(m.createWriterManualMapMarkdownProfileProjection(inactive), m.createWriterLocalProfileProjection(inactive));
  for (const patch of [{ active: false }, { packaged: false }, { optionalSystemsEnabled: true }, { extra: true }, { cloudAuthority: true },
    { profileId: 'WRITER_LOCAL_MANUAL_MAP_V3' }, { schemaVersion: 'writer-local-profile.v3' }, { platform: 'linux' },
    { admittedCommandIds: expected.slice(0, 16) }, { admittedCommandIds: expected.slice().reverse() },
    { admittedQueryIds: [...active.admittedQueryIds, 'query.collabScopeLocal'] }]) {
    const profile = { ...active, ...patch }; assert.equal(m.isActiveWriterManualMapMarkdownProfile(profile), false);
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: record.id, productCommandRecord: record }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.manualMapWorkbench' }).allowed, false);
  }
  for (const commandId of ['manualMap.export.markdown ', ' manualMap.export.markdown', 'manualMap.export.markdown.extra', 'manualMap.import.markdown'])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId, productCommandRecord: { ...record, id: commandId } }).allowed, false);
  for (const productCommandRecord of [null, { ...record, id: 'manualMap.export.json' }, { ...record, domain: 'atlas' }])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: record.id, productCommandRecord }).allowed, false);
  for (const queryId of ['query.manualMapWorkbench ', ' query.atlasCurrentScene', 'query.manualMapWorkbench.extra'])
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, false);
});


test('exact Atlas V5 admits precisely twenty existing records and three queries while retaining historical profiles', () => {
  const m = atlasProfile, options = { isPackaged: true, platform: 'darwin' };
  const active = m.createWriterExactAtlasProfileProjection(options);
  const commands = [...historicalManualMapIds, 'manualMap.export.markdown', 'atlas.entity.create', 'atlas.alias.add', 'atlas.mention.confirm'];
  const queries = ['query.atlasCurrentScene', 'query.manualMapWorkbench', 'query.atlasEntityDossier'];
  assert.equal(active.profileId, 'WRITER_LOCAL_EXACT_ATLAS_V5'); assert.equal(active.schemaVersion, 'writer-local-profile.v5');
  assert.equal(m.isActiveWriterExactAtlasProfile(active), true); assert.equal(active.optionalSystemsEnabled, false);
  assert.deepEqual(active.admittedCommandIds, commands); assert.deepEqual(active.admittedQueryIds, queries);
  assert.equal(Object.isFrozen(active), true); assert.equal(Object.isFrozen(active.admittedCommandIds), true);
  assert.equal(Object.isFrozen(active.admittedQueryIds), true);
  for (const key of ['signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
  for (const record of productRecords) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: record.id, productCommandRecord: record }).allowed,
    commands.includes(record.id), record.id);
  for (const queryId of OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, queries.includes(queryId), queryId);
  for (const commandId of WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId }).allowed, true);
  for (const commandId of ['cmd.project.save', 'cmd.project.open']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId }).allowed, true);
  for (const queryId of ['query.projectTree', 'query.sceneHistory', 'query.projectLibrary']) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, true);
  for (const inactive of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: true, platform: 'win32' }])
    assert.deepEqual(m.createWriterExactAtlasProfileProjection(inactive), m.createWriterLocalProfileProjection(inactive));
  for (const factory of [m.createWriterLocalProfileProjection, m.createWriterAtlasProfileProjection, m.createWriterManualMapProfileProjection, m.createWriterManualMapMarkdownProfileProjection]) {
    const profile = factory(options);
    for (const id of commands.slice(17)) assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: id, productCommandRecord: productRecords.find(r => r.id === id) }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.atlasEntityDossier' }).allowed, false);
  }
});

test('exact Atlas V5 refuses malformed complete policy, forged records and command/query near matches', () => {
  const m = atlasProfile, active = m.createWriterExactAtlasProfileProjection({ isPackaged: true, platform: 'darwin' });
  const variants = [{ active: false }, { packaged: false }, { platform: 'linux' }, { optionalSystemsEnabled: true }, { cloudAuthority: true },
    { schemaVersion: 'writer-local-profile.v4' }, { profileId: 'WRITER_LOCAL_MANUAL_MAP_V4' }, { ownerApproved: true },
    { admittedCommandIds: active.admittedCommandIds.slice(0, -1) }, { admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.merge'] },
    { admittedCommandIds: [...active.admittedCommandIds].reverse() }, { admittedQueryIds: [...active.admittedQueryIds].reverse() },
    { admittedQueryIds: [...active.admittedQueryIds, 'query.atlasOverview'] }, { admittedQueryIds: [] }].map(patch => ({ ...active, ...patch }));
  const missing = { ...active }; delete missing.signing; variants.push(missing);
  const hidden = { ...active }; Object.defineProperty(hidden, 'hiddenAuthority', { value: true }); variants.push(hidden);
  variants.push({ ...active, [Symbol('authority')]: true });
  const decorated = [...active.admittedCommandIds]; decorated.extra = true; variants.push({ ...active, admittedCommandIds: decorated });
  const inherited = [...active.admittedCommandIds]; delete inherited[17];
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { 17: active.admittedCommandIds[17] }));
  inherited.extra = true; variants.push({ ...active, admittedCommandIds: inherited });
  for (const profile of variants) {
    assert.equal(m.isActiveWriterExactAtlasProfile(profile), false);
    for (const id of ['atlas.entity.create', 'manualMap.create']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: id,
      productCommandRecord: productRecords.find(r => r.id === id) }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.atlasEntityDossier' }).allowed, false);
  }
  for (const id of active.admittedCommandIds) {
    const record = productRecords.find(r => r.id === id); assert.ok(record);
    for (const productCommandRecord of [null, { ...record, id: id + '.extra' }, { ...record, domain: record.domain === 'atlas' ? 'manualMap' : 'atlas' }])
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord }).allowed, false);
    for (const commandId of [id + ' ', ' ' + id, id + '.extra']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId,
      productCommandRecord: { ...record, id: commandId } }).allowed, false, commandId);
  }
  for (const id of active.admittedQueryIds) for (const queryId of [id + ' ', ' ' + id, id + '.extra'])
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, false, queryId);
});

test('V6 admits exactly one existing reattachment command without changing historical V5 policy', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  assert.equal(typeof m.createWriterAtlasEvidenceReattachmentProfileProjection, 'function');
  assert.equal(typeof m.isActiveWriterAtlasEvidenceReattachmentProfile, 'function');
  const options = { isPackaged: true, platform: 'darwin' }, old = m.createWriterExactAtlasProfileProjection(options);
  const active = m.createWriterAtlasEvidenceReattachmentProfileProjection(options);
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_EVIDENCE_REATTACHMENT_V6');
  assert.equal(active.schemaVersion, 'writer-local-profile.v6');
  assert.deepEqual(active.admittedCommandIds, [...old.admittedCommandIds, 'atlas.evidence.reattach']);
  assert.equal(active.admittedCommandIds.length, 21);
  assert.deepEqual(active.admittedQueryIds, ['query.atlasCurrentScene', 'query.manualMapWorkbench', 'query.atlasEntityDossier']);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(active[key], false, key);
  assert.equal(Object.isFrozen(active), true); assert.equal(m.isActiveWriterAtlasEvidenceReattachmentProfile(active), true);
  const registry = require('../../src/shared/productCommandRegistry.cjs');
  for (const id of active.admittedCommandIds) {
    const productCommandRecord = registry.getProductCommandRecord(id); assert.ok(productCommandRecord, id);
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord }).allowed, true, id);
  }
  for (const record of registry.PRODUCT_COMMAND_RECORDS.filter(r => m.OPTIONAL_PRODUCT_DOMAINS.includes(r.domain) && !active.admittedCommandIds.includes(r.id)))
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: record.id, productCommandRecord: record }).allowed, false, record.id);
  for (const queryId of m.OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    active.admittedQueryIds.includes(queryId), queryId);
  assert.equal(m.evaluateWriterLocalCommandAccess({ profile: old, commandId: 'atlas.evidence.reattach',
    productCommandRecord: registry.getProductCommandRecord('atlas.evidence.reattach') }).allowed, false);
  for (const options of [{ isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: true, platform: 'win32' }])
    assert.deepEqual(m.createWriterAtlasEvidenceReattachmentProfileProjection(options), m.createWriterLocalProfileProjection(options));
});

test('V6 exact policy rejects malformed own properties ordered arrays and forged record authority', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  assert.equal(typeof m.createWriterAtlasEvidenceReattachmentProfileProjection, 'function');
  const active = m.createWriterAtlasEvidenceReattachmentProfileProjection({ isPackaged: true, platform: 'darwin' });
  const commandId = 'atlas.evidence.reattach', record = { id: commandId, domain: 'atlas' };
  const check = (profile, productCommandRecord = record, id = commandId) => m.evaluateWriterLocalCommandAccess({ profile, commandId: id, productCommandRecord }).allowed;
  for (const patch of [{ extra: true }, { optionalSystemsEnabled: true }, { cloudAuthority: true }, { active: false },
    { profileId: active.profileId + '.forged' }, { schemaVersion: 'writer-local-profile.v6.extra' },
    { admittedCommandIds: active.admittedCommandIds.slice(0, -1) }, { admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.merge'] },
    { admittedCommandIds: [...active.admittedCommandIds].reverse() }, { admittedQueryIds: [...active.admittedQueryIds, 'query.atlasOverview'] }])
    assert.equal(check({ ...active, ...patch }), false, JSON.stringify(patch));
  for (const key of Reflect.ownKeys(active)) {
    const inherited = Object.assign(Object.create({ [key]: active[key] }), active); delete inherited[key]; inherited.extra = true;
    assert.equal(check(inherited), false, String(key));
  }
  for (const key of ['admittedCommandIds', 'admittedQueryIds']) {
    const values = [...active[key]], index = values.length - 1;
    delete values[index]; Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: active[key][index] }));
    values.extra = true; assert.equal(check({ ...active, [key]: values }), false, key + ' inherited hole plus extra');
  }
  for (const forged of [{ id: 'atlas.entity.merge', domain: 'atlas' }, { id: commandId, domain: 'manualMap' }, { id: commandId }, null])
    assert.equal(check(active, forged), false, JSON.stringify(forged));
  for (const id of [commandId + ' ', ' ' + commandId, commandId + '.extra']) assert.equal(check(active, { id, domain: 'atlas' }, id), false, id);
  for (const id of m.WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS) assert.equal(check(active, undefined, id), true, id);
  assert.equal(check(active, undefined, 'cmd.project.save'), true);
});

test('V6 identity markers on arrays cannot bypass strict rejection through inactive legacy fallback', async t => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  const profile = Object.assign([], m.createWriterAtlasEvidenceReattachmentProfileProjection({ isPackaged: true, platform: 'darwin' }));
  assert.equal(m.isActiveWriterAtlasEvidenceReattachmentProfile(profile), false);
  await t.test('command', () => assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: 'atlas.evidence.reattach',
    productCommandRecord: { id: 'atlas.evidence.reattach', domain: 'atlas' } }).allowed, false));
  await t.test('query', () => assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.atlasEntityDossier' }).allowed, false));
});

test('V7 adds only explicit suppression to the exact V6 policy and preserves inactive and historical profiles', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), registry = require('../../src/shared/productCommandRegistry.cjs');
  const options = { isPackaged: true, platform: 'darwin' }, old = m.createWriterAtlasEvidenceReattachmentProfileProjection(options);
  assert.equal(typeof m.createWriterAtlasExplicitSuppressionProfileProjection, 'function', 'declared V7 policy must exist');
  assert.equal(typeof m.isActiveWriterAtlasExplicitSuppressionProfile, 'function');
  const active = m.createWriterAtlasExplicitSuppressionProfileProjection(options);
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7'); assert.equal(active.schemaVersion, 'writer-local-profile.v7');
  assert.deepEqual(active.admittedCommandIds, [...old.admittedCommandIds, 'atlas.observation.suppress']); assert.equal(active.admittedCommandIds.length, 22);
  assert.deepEqual(active.admittedQueryIds, ['query.atlasCurrentScene', 'query.manualMapWorkbench', 'query.atlasEntityDossier']);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(active[key], false, key);
  assert.equal(Object.isFrozen(active), true); assert.equal(m.isActiveWriterAtlasExplicitSuppressionProfile(active), true);
  for (const record of registry.PRODUCT_COMMAND_RECORDS.filter(r => m.OPTIONAL_PRODUCT_DOMAINS.includes(r.domain)))
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: record.id, productCommandRecord: record }).allowed,
      active.admittedCommandIds.includes(record.id), record.id);
  for (const queryId of m.OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    active.admittedQueryIds.includes(queryId), queryId);
  assert.equal(m.evaluateWriterLocalCommandAccess({ profile: old, commandId: 'atlas.observation.suppress',
    productCommandRecord: registry.getProductCommandRecord('atlas.observation.suppress') }).allowed, false, 'historical V6 remains closed');
  for (const options of [{ isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: true, platform: 'win32' }])
    assert.deepEqual(m.createWriterAtlasExplicitSuppressionProfileProjection(options), m.createWriterLocalProfileProjection(options));
});

test('V7 rejects malformed policy identity own-key holes reordered arrays and forged product records', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  assert.equal(typeof m.createWriterAtlasExplicitSuppressionProfileProjection, 'function');
  const active = m.createWriterAtlasExplicitSuppressionProfileProjection({ isPackaged: true, platform: 'darwin' });
  const commandId = 'atlas.observation.suppress', record = { id: commandId, domain: 'atlas' };
  const command = (profile, productCommandRecord = record, id = commandId) => m.evaluateWriterLocalCommandAccess({ profile, commandId: id, productCommandRecord }).allowed;
  const variants = [{ ...active, extra: true }, { ...active, active: false }, { ...active, optionalSystemsEnabled: true }, { ...active, userDataMutation: true },
    { ...active, profileId: active.profileId + '.forged' }, { ...active, schemaVersion: active.schemaVersion + '.extra' },
    { ...active, admittedCommandIds: active.admittedCommandIds.slice(0, -1) }, { ...active, admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.merge'] },
    { ...active, admittedCommandIds: [...active.admittedCommandIds].reverse() }, { ...active, admittedQueryIds: [...active.admittedQueryIds].reverse() },
    { ...active, admittedQueryIds: [...active.admittedQueryIds, 'query.atlasOverview'] }, Object.assign([], active)];
  for (const key of Reflect.ownKeys(active)) { const v = Object.assign(Object.create({ [key]: active[key] }), active); delete v[key]; v.extra = true; variants.push(v); }
  for (const key of ['admittedCommandIds', 'admittedQueryIds']) {
    const values = [...active[key]], index = values.length - 1; delete values[index];
    Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: active[key][index] })); values.extra = true;
    variants.push({ ...active, [key]: values });
  }
  for (const profile of variants) {
    assert.equal(m.isActiveWriterAtlasExplicitSuppressionProfile(profile), false); assert.equal(command(profile), false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.atlasEntityDossier' }).allowed, false);
  }
  for (const forged of [null, { id: commandId }, { id: 'atlas.entity.merge', domain: 'atlas' }, { id: commandId, domain: 'manualMap' }])
    assert.equal(command(active, forged), false);
  for (const id of [commandId + ' ', ' ' + commandId, commandId + '.extra']) assert.equal(command(active, { id, domain: 'atlas' }, id), false);
  for (const id of m.WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS) assert.equal(command(active, undefined, id), true);
  assert.equal(command(active, undefined, 'cmd.project.save'), true);
});

test('V8 admits exactly twelve existing Atlas readers with the unchanged ordered V7 author commands', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), registry = require('../../src/shared/productCommandRegistry.cjs');
  const queries = require('../../src/shared/workspaceQueryRegistry.cjs').ATLAS_WORKSPACE_QUERY_IDS;
  assert.equal(typeof m.createWriterAtlasReadSurfacesProfileProjection, 'function', 'existing-reader successor is not implemented');
  assert.equal(typeof m.isActiveWriterAtlasReadSurfacesProfile, 'function');
  const options = { isPackaged: true, platform: 'darwin' }, old = m.createWriterAtlasExplicitSuppressionProfileProjection(options);
  const active = m.createWriterAtlasReadSurfacesProfileProjection(options);
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8'); assert.equal(active.schemaVersion, 'writer-local-profile.v8');
  assert.deepEqual(active.admittedCommandIds, old.admittedCommandIds); assert.equal(active.admittedCommandIds.length, 22);
  assert.deepEqual(active.admittedQueryIds, [...old.admittedQueryIds, 'query.atlasOverview', 'query.atlasRelationDossier',
    'query.atlasMatrices', 'query.atlasHeatmap', 'query.atlasTemporalLayout', 'query.atlasContinuityLedgerSurface',
    'query.atlasReportsSavedQueries', 'query.atlasDiagnosticsStageAcceptance', 'query.projectionInspector']);
  assert.deepEqual([...active.admittedQueryIds].sort(), [...queries].sort()); assert.equal(active.admittedQueryIds.length, 12);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(active[key], false, key);
  for (const value of [active, active.admittedCommandIds, active.admittedQueryIds]) assert.equal(Object.isFrozen(value), true);
  assert.equal(m.isActiveWriterAtlasReadSurfacesProfile(active), true);
  for (const record of registry.PRODUCT_COMMAND_RECORDS) assert.equal(m.evaluateWriterLocalCommandAccess({
    profile: active, commandId: record.id, productCommandRecord: record }).allowed, old.admittedCommandIds.includes(record.id), record.id);
  for (const queryId of m.OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    active.admittedQueryIds.includes(queryId), queryId);
  for (const queryId of active.admittedQueryIds) {
    for (const near of [' ' + queryId, queryId + ' ', queryId + '.extra'])
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId: near }).allowed, false, near);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: old, queryId }).allowed, old.admittedQueryIds.includes(queryId), 'historical V7 ' + queryId);
  }
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' },
    { isPackaged: true, platform: 'win32' }, { isPackaged: 'true', platform: 'darwin' }])
    assert.deepEqual(m.createWriterAtlasReadSurfacesProfileProjection(options), m.createWriterLocalProfileProjection(options));
});

test('V8 refuses malformed policy own keys arrays identities and forged command records without widening commands', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  assert.equal(typeof m.createWriterAtlasReadSurfacesProfileProjection, 'function');
  const active = m.createWriterAtlasReadSurfacesProfileProjection({ isPackaged: true, platform: 'darwin' });
  const commandId = 'atlas.observation.suppress', record = { id: commandId, domain: 'atlas' };
  const variants = [{ ...active, extra: true }, { ...active, active: false }, { ...active, packaged: false }, { ...active, platform: 'linux' },
    { ...active, optionalSystemsEnabled: true }, { ...active, userDataMutation: true }, { ...active, cloudAuthority: true },
    { ...active, profileId: active.profileId + '.forged' }, { ...active, schemaVersion: active.schemaVersion + '.extra' },
    { ...active, admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.merge'] },
    { ...active, admittedCommandIds: [...active.admittedCommandIds].reverse() }, { ...active, admittedCommandIds: active.admittedCommandIds.slice(1) },
    { ...active, admittedQueryIds: [...active.admittedQueryIds, 'query.stage10ProductState'] },
    { ...active, admittedQueryIds: [...active.admittedQueryIds].reverse() }, { ...active, admittedQueryIds: active.admittedQueryIds.slice(0, -1) },
    Object.assign([], active), Object.assign(Object.create({ forged: true }), active)];
  for (const key of Reflect.ownKeys(active)) { const v = Object.assign(Object.create({ [key]: active[key] }), active); delete v[key]; variants.push(v); }
  const symbol = Symbol('extra'); variants.push({ ...active, [symbol]: true });
  for (const key of ['admittedCommandIds', 'admittedQueryIds']) {
    const values = [...active[key]], index = values.length - 1; delete values[index];
    Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: active[key][index] }));
    variants.push({ ...active, [key]: values });
    const extra = [...active[key]]; extra.extra = true; variants.push({ ...active, [key]: extra });
    const symbolic = [...active[key]]; symbolic[symbol] = true; variants.push({ ...active, [key]: symbolic });
  }
  for (const profile of variants) {
    assert.equal(m.isActiveWriterAtlasReadSurfacesProfile(profile), false);
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId, productCommandRecord: record }).allowed, false);
    for (const queryId of active.admittedQueryIds) assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId }).allowed, false, queryId);
  }
  for (const forged of [null, { id: commandId }, { id: 'atlas.entity.merge', domain: 'atlas' }, { id: commandId, domain: 'manualMap' }])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId, productCommandRecord: forged }).allowed, false);
  for (const id of [commandId + ' ', ' ' + commandId, commandId + '.extra']) assert.equal(m.evaluateWriterLocalCommandAccess({
    profile: active, commandId: id, productCommandRecord: { id, domain: 'atlas' } }).allowed, false);
  for (const commandId of ['cmd.project.save', ...m.WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId }).allowed, true, commandId);
});

const TEMPORAL_AUTHORING_IDS = Object.freeze(['atlas.calendar.define', 'atlas.sceneTemporalAnchor.set',
  'atlas.continuityFact.record', 'atlas.savedQuery.save']);

test('V9 admits only four existing temporal authoring commands after the complete ordered V8 policy', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), registry = require('../../src/shared/productCommandRegistry.cjs');
  assert.equal(typeof m.createWriterAtlasTemporalAuthoringProfileProjection, 'function', 'missing V9 is an implementation gap');
  assert.equal(typeof m.isActiveWriterAtlasTemporalAuthoringProfile, 'function');
  const options = { isPackaged: true, platform: 'darwin' }, old = m.createWriterAtlasReadSurfacesProfileProjection(options);
  const active = m.createWriterAtlasTemporalAuthoringProfileProjection(options);
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9'); assert.equal(active.schemaVersion, 'writer-local-profile.v9');
  assert.deepEqual(active.admittedCommandIds, [...old.admittedCommandIds, ...TEMPORAL_AUTHORING_IDS]);
  assert.equal(active.admittedCommandIds.length, 26); assert.equal(new Set(active.admittedCommandIds).size, 26);
  assert.deepEqual(active.admittedQueryIds, old.admittedQueryIds); assert.equal(active.admittedQueryIds.length, 12);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(active[key], false, key);
  for (const value of [active, active.admittedCommandIds, active.admittedQueryIds]) assert.equal(Object.isFrozen(value), true);
  assert.equal(m.isActiveWriterAtlasTemporalAuthoringProfile(active), true);
  for (const record of registry.PRODUCT_COMMAND_RECORDS) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active,
    commandId: record.id, productCommandRecord: record }).allowed, active.admittedCommandIds.includes(record.id), record.id);
  for (const id of TEMPORAL_AUTHORING_IDS) {
    const record = registry.getProductCommandRecord(id); assert.ok(record); assert.equal(record.domain, 'atlas');
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: old, commandId: id, productCommandRecord: record }).allowed, false);
  }
  for (const queryId of m.OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed,
    active.admittedQueryIds.includes(queryId), queryId);
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' },
    { isPackaged: true, platform: 'win32' }, { isPackaged: 'true', platform: 'darwin' }])
    assert.deepEqual(m.createWriterAtlasTemporalAuthoringProfileProjection(options), m.createWriterLocalProfileProjection(options));
});

test('V9 rejects forged identities complete own-shape holes and exact command or query near matches', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  assert.equal(typeof m.createWriterAtlasTemporalAuthoringProfileProjection, 'function');
  const active = m.createWriterAtlasTemporalAuthoringProfileProjection({ isPackaged: true, platform: 'darwin' });
  const variants = [{ ...active, extra: true }, { ...active, [Symbol('authority')]: true }, { ...active, active: false },
    { ...active, packaged: false }, { ...active, platform: 'linux' }, { ...active, optionalSystemsEnabled: true },
    { ...active, cloudAuthority: true }, { ...active, userDataMutation: true }, { ...active, signing: true },
    { ...active, profileId: active.profileId + '.forged' }, { ...active, schemaVersion: active.schemaVersion + '.extra' },
    { ...active, admittedCommandIds: [...active.admittedCommandIds, 'atlas.entity.merge'] },
    { ...active, admittedCommandIds: [...active.admittedCommandIds].reverse() },
    { ...active, admittedCommandIds: active.admittedCommandIds.slice(1) },
    { ...active, admittedQueryIds: [...active.admittedQueryIds, 'query.stage10ProductState'] },
    { ...active, admittedQueryIds: [...active.admittedQueryIds].reverse() },
    Object.assign([], active), Object.assign(Object.create({ ...active }), { profileId: active.profileId })];
  for (const field of ['admittedCommandIds', 'admittedQueryIds']) {
    const values = [...active[field]], index = values.length - 1; delete values[index];
    Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: active[field][index] }));
    values.extra = true;
    variants.push({ ...active, [field]: values }, { ...active, [field]: Object.assign([...active[field]], { extra: true }) });
  }
  for (const invalid of variants) {
    assert.equal(m.isActiveWriterAtlasTemporalAuthoringProfile(invalid), false);
    for (const id of TEMPORAL_AUTHORING_IDS) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: invalid,
      commandId: id, productCommandRecord: { id, domain: 'atlas' } }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: invalid, queryId: 'query.atlasReportsSavedQueries' }).allowed, false);
  }
  for (const id of active.admittedCommandIds) {
    const domain = id.startsWith('atlas.') ? 'atlas' : 'manualMap', record = { id, domain };
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord: record }).allowed, true);
    for (const near of [' ' + id, id + ' ', id + '.extra']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active,
      commandId: near, productCommandRecord: { id: near, domain } }).allowed, false, near);
    for (const forged of [null, [], { id, domain: 'meaning' }, { id: id + '.extra', domain }, Object.create(record)])
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord: forged }).allowed, false);
  }
  for (const id of active.admittedQueryIds) for (const near of [' ' + id, id + ' ', id + '.extra'])
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId: near }).allowed, false, near);
});

test('V10 admits exactly three existing entity corrections and preserves the strict V9 contract', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), options = { isPackaged: true, platform: 'darwin' };
  assert.equal(typeof m.createWriterAtlasEntityCorrectionsProfileProjection, 'function', 'current V10 constructor must exist');
  const old = m.createWriterAtlasTemporalAuthoringProfileProjection(options), snapshot = JSON.stringify(old);
  const active = m.createWriterAtlasEntityCorrectionsProfileProjection(options);
  assert.equal(active.profileId, 'WRITER_LOCAL_ATLAS_ENTITY_CORRECTIONS_V10'); assert.equal(active.schemaVersion, 'writer-local-profile.v10');
  assert.equal(m.isActiveWriterAtlasEntityCorrectionsProfile(active), true); assert.equal(Object.isFrozen(active), true);
  assert.deepEqual(active.admittedCommandIds, [...old.admittedCommandIds,
    'atlas.observation.reassign', 'atlas.entity.merge', 'atlas.entity.splitRestore']);
  assert.equal(active.admittedCommandIds.length, 29); assert.deepEqual(active.admittedQueryIds, old.admittedQueryIds);
  assert.equal(active.admittedQueryIds.length, 12); assert.equal(JSON.stringify(old), snapshot);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(active[key], false, key);
  for (const id of active.admittedCommandIds) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id,
    productCommandRecord: { id, domain: id.startsWith('atlas.') ? 'atlas' : 'manualMap' } }).allowed, true, id);
  for (const id of active.admittedQueryIds) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId: id }).allowed, true);
  for (const factory of [m.createWriterLocalProfileProjection, m.createWriterAtlasProfileProjection, m.createWriterManualMapProfileProjection,
    m.createWriterManualMapMarkdownProfileProjection, m.createWriterExactAtlasProfileProjection, m.createWriterAtlasEvidenceReattachmentProfileProjection,
    m.createWriterAtlasExplicitSuppressionProfileProjection, m.createWriterAtlasReadSurfacesProfileProjection, m.createWriterAtlasTemporalAuthoringProfileProjection])
    for (const id of active.admittedCommandIds.slice(26)) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: factory(options), commandId: id,
      productCommandRecord: { id, domain: 'atlas' } }).allowed, false, id);
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: true, platform: 'win32' }])
    assert.deepEqual(m.createWriterAtlasEntityCorrectionsProfileProjection(options), m.createWriterLocalProfileProjection(options));
  for (const id of ['idea.create', 'atlas.languageTag.set', 'atlas.seriesPortability.apply']) assert.equal(m.evaluateWriterLocalCommandAccess({
    profile: active, commandId: id, productCommandRecord: { id, domain: id.startsWith('atlas.') ? 'atlas' : 'idea' } }).allowed, false);
});

test('V10 refuses malformed complete policy forged records and command or query near identities', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'); assert.equal(typeof m.createWriterAtlasEntityCorrectionsProfileProjection, 'function');
  const active = m.createWriterAtlasEntityCorrectionsProfileProjection({ isPackaged: true, platform: 'darwin' });
  const variants = [{ active: false }, { packaged: false }, { platform: 'linux' }, { optionalSystemsEnabled: true }, { signing: true },
    { profileId: active.profileId + '.extra' }, { profileId: ' ' + active.profileId }, { schemaVersion: active.schemaVersion + '.extra' },
    { extra: true }, { admittedCommandIds: active.admittedCommandIds.slice(0, -1) },
    { admittedCommandIds: [...active.admittedCommandIds, 'idea.create'] }, { admittedCommandIds: [...active.admittedCommandIds].reverse() },
    { admittedQueryIds: [...active.admittedQueryIds].reverse() }].map(patch => ({ ...active, ...patch }));
  const missing = { ...active }; delete missing.userDataMutation; variants.push(missing, { ...active, [Symbol('extra')]: true });
  const hidden = { ...active }; Object.defineProperty(hidden, 'hidden', { value: true }); variants.push(hidden);
  const decorated = [...active.admittedCommandIds]; decorated.extra = true; variants.push({ ...active, admittedCommandIds: decorated });
  const inherited = [...active.admittedCommandIds], index = inherited.length - 1; delete inherited[index];
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { [index]: active.admittedCommandIds[index] }));
  variants.push({ ...active, admittedCommandIds: inherited });
  for (const value of variants) {
    assert.equal(m.isActiveWriterAtlasEntityCorrectionsProfile(value), false);
    for (const id of active.admittedCommandIds.slice(26)) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: value, commandId: id,
      productCommandRecord: { id, domain: 'atlas' } }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: value, queryId: 'query.atlasEntityDossier' }).allowed, false);
  }
  for (const id of active.admittedCommandIds.slice(26)) {
    for (const commandId of [' ' + id, id + ' ', id + '.extra']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active,
      commandId, productCommandRecord: { id: commandId, domain: 'atlas' } }).allowed, false);
    for (const record of [null, [], { id, domain: 'manualMap' }, { id: id + '.extra', domain: 'atlas' }, Object.create({ id, domain: 'atlas' })])
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord: record }).allowed, false);
  }
  for (const queryId of active.admittedQueryIds.flatMap(id => [' ' + id, id + ' ', id + '.extra']))
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, false);
});
// V11 is a successor; the V1–V10 policy assertions above remain historical contracts.
test('V11 admits only the three registered Idea Meaning commands with actual domains after strict V10', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'), registry = require('../../src/shared/productCommandRegistry.cjs');
  assert.equal(typeof m.createWriterIdeaMeaningAuthoringProfileProjection, 'function', 'missing V11 is an implementation gap');
  assert.equal(typeof m.isActiveWriterIdeaMeaningAuthoringProfile, 'function');
  const options = { isPackaged: true, platform: 'darwin' }, old = m.createWriterAtlasEntityCorrectionsProfileProjection(options);
  const preserved = JSON.stringify(old), active = m.createWriterIdeaMeaningAuthoringProfileProjection(options);
  const extra = ['idea.create', 'idea.originLink.add', 'meaning.promote'];
  assert.equal(active.profileId, 'WRITER_LOCAL_IDEA_MEANING_AUTHORING_V11'); assert.equal(active.schemaVersion, 'writer-local-profile.v11');
  assert.equal(m.isActiveWriterIdeaMeaningAuthoringProfile(active), true);
  assert.deepEqual(active.admittedCommandIds, [...old.admittedCommandIds, ...extra]); assert.equal(active.admittedCommandIds.length, 32);
  assert.deepEqual(active.admittedQueryIds, old.admittedQueryIds); assert.equal(active.admittedQueryIds.length, 12);
  for (const item of [active, active.admittedCommandIds, active.admittedQueryIds]) assert.equal(Object.isFrozen(item), true);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
  for (const record of registry.PRODUCT_COMMAND_RECORDS) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active,
    commandId: record.id, productCommandRecord: record }).allowed, active.admittedCommandIds.includes(record.id), record.id);
  for (const id of extra) {
    const record = registry.getProductCommandRecord(id); assert.equal(record.domain, id.split('.')[0]);
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: old, commandId: id, productCommandRecord: record }).allowed, false);
    for (const domain of ['atlas', 'manualMap', id.startsWith('idea.') ? 'meaning' : 'idea']) assert.equal(m.evaluateWriterLocalCommandAccess({
      profile: active, commandId: id, productCommandRecord: { id, domain } }).allowed, false, id + '/' + domain);
  }
  for (const id of m.OPTIONAL_QUERY_IDS) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId: id }).allowed, active.admittedQueryIds.includes(id), id);
  assert.equal(JSON.stringify(old), preserved);
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: 'true', platform: 'darwin' }])
    assert.deepEqual(m.createWriterIdeaMeaningAuthoringProfileProjection(options), m.createWriterLocalProfileProjection(options));
});

test('V11 refuses malformed own policy shape near identities and forged domain or record authority', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'); assert.equal(typeof m.createWriterIdeaMeaningAuthoringProfileProjection, 'function');
  const active = m.createWriterIdeaMeaningAuthoringProfileProjection({ isPackaged: true, platform: 'darwin' });
  const variants = [{ ...active, extra: true }, { ...active, [Symbol('authority')]: true }, { ...active, cloudAuthority: true },
    { ...active, optionalSystemsEnabled: true }, { ...active, platform: 'linux' }, { ...active, packaged: false },
    { ...active, profileId: active.profileId + '.extra' }, { ...active, schemaVersion: active.schemaVersion + '.extra' },
    { ...active, admittedCommandIds: active.admittedCommandIds.slice(1) }, { ...active, admittedCommandIds: [...active.admittedCommandIds].reverse() },
    { ...active, admittedCommandIds: [...active.admittedCommandIds, 'idea.delete'] }, { ...active, admittedQueryIds: [...active.admittedQueryIds].reverse() }];
  for (const key of Reflect.ownKeys(active)) { const copy = { ...active }; delete copy[key]; variants.push(copy); }
  for (const field of ['admittedCommandIds', 'admittedQueryIds']) {
    const values = [...active[field]], last = values.length - 1; delete values[last];
    Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [last]: active[field][last] }));
    variants.push({ ...active, [field]: values }, { ...active, [field]: Object.assign([...active[field]], { extra: true }) });
  }
  for (const invalid of variants) {
    assert.equal(m.isActiveWriterIdeaMeaningAuthoringProfile(invalid), false);
    for (const id of ['idea.create', 'idea.originLink.add', 'meaning.promote']) assert.equal(m.evaluateWriterLocalCommandAccess({
      profile: invalid, commandId: id, productCommandRecord: { id, domain: id.split('.')[0] } }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: invalid, queryId: 'query.projectionInspector' }).allowed, false);
  }
  for (const id of active.admittedCommandIds) for (const near of [' ' + id, id + ' ', id + '.extra']) assert.equal(m.evaluateWriterLocalCommandAccess({
    profile: active, commandId: near, productCommandRecord: { id: near, domain: id.split('.')[0] } }).allowed, false);
  for (const id of ['idea.create', 'idea.originLink.add', 'meaning.promote']) for (const record of [null, [], Object.create({ id, domain: id.split('.')[0] }), { id: id + '.extra', domain: id.split('.')[0] }])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord: record }).allowed, false);
});

test('V12 admits exactly two manual scene language commands after all V11 identities without engine authority', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs');
  assert.equal(typeof m.createWriterSceneLanguageTagProfileProjection, 'function', 'missing successor is a profile gap');
  assert.equal(typeof m.isActiveWriterSceneLanguageTagProfile, 'function');
  const active = m.createWriterSceneLanguageTagProfileProjection({ isPackaged: true, platform: 'darwin' });
  const old = m.createWriterIdeaMeaningAuthoringProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(active.profileId, 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12'); assert.equal(active.schemaVersion, 'writer-local-profile.v12');
  assert.equal(m.isActiveWriterSceneLanguageTagProfile(active), true); assert.equal(Object.isFrozen(active), true);
  assert.deepEqual(active.admittedCommandIds, [...old.admittedCommandIds, 'atlas.languageTag.set', 'atlas.languageTag.clear']);
  assert.equal(active.admittedCommandIds.length, 34); assert.deepEqual(active.admittedQueryIds, old.admittedQueryIds);
  assert.equal(active.admittedQueryIds.length, 12);
  for (const key of Object.keys(old).filter(key => typeof old[key] === 'boolean')) assert.equal(active[key], old[key], key);
  for (const id of active.admittedCommandIds) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id,
    productCommandRecord: { id, domain: id.split('.')[0] } }).allowed, true, id);
  for (const queryId of active.admittedQueryIds) assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active, queryId }).allowed, true, queryId);
  for (const id of ['atlas.seriesPortability.apply', 'atlas.seriesPortability.rollback', 'atlas.languageTag.set.extra', 'idea.erase'])
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord: { id, domain: id.split('.')[0] } }).allowed, false);
  for (const id of ['atlas.languageTag.set', 'atlas.languageTag.clear']) assert.equal(m.evaluateWriterLocalCommandAccess({
    profile: old, commandId: id, productCommandRecord: { id, domain: 'atlas' } }).allowed, false, 'historical V11 stays denied');
  for (const options of [{}, { isPackaged: false, platform: 'darwin' }, { isPackaged: true, platform: 'linux' }, { isPackaged: 1, platform: 'darwin' }])
    assert.deepEqual(m.createWriterSceneLanguageTagProfileProjection(options), m.createWriterLocalProfileProjection(options));
});

test('V12 exact policy shape rejects forged arrays records domains and near identities', () => {
  const m = require('../../src/core/writer-local-profile-v1.cjs'); assert.equal(typeof m.createWriterSceneLanguageTagProfileProjection, 'function');
  const active = m.createWriterSceneLanguageTagProfileProjection({ isPackaged: true, platform: 'darwin' });
  const variants = [{ ...active, extra: true }, { ...active, active: false }, { ...active, optionalSystemsEnabled: true },
    { ...active, profileId: active.profileId + '.extra' }, { ...active, schemaVersion: active.schemaVersion + '.extra' },
    { ...active, admittedCommandIds: [...active.admittedCommandIds].reverse() }, { ...active, admittedQueryIds: active.admittedQueryIds.slice(1) }];
  for (const key of Reflect.ownKeys(active)) { const value = { ...active }; delete value[key]; variants.push(value); }
  for (const field of ['admittedCommandIds', 'admittedQueryIds']) {
    const values = [...active[field]], index = values.length - 1; delete values[index];
    Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: active[field][index] }));
    variants.push({ ...active, [field]: values }, { ...active, [field]: Object.assign([...active[field]], { extra: true }) });
  }
  for (const invalid of variants) {
    assert.equal(m.isActiveWriterSceneLanguageTagProfile(invalid), false);
    for (const id of ['atlas.languageTag.set', 'atlas.languageTag.clear']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: invalid,
      commandId: id, productCommandRecord: { id, domain: 'atlas' } }).allowed, false);
    assert.equal(m.evaluateWriterLocalQueryAccess({ profile: invalid, queryId: 'query.atlasCurrentScene' }).allowed, false);
  }
  for (const id of ['atlas.languageTag.set', 'atlas.languageTag.clear']) {
    for (const commandId of [' ' + id, id + ' ', id + '.extra']) assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active,
      commandId, productCommandRecord: { id: commandId, domain: 'atlas' } }).allowed, false);
    for (const record of [null, [], Object.create({ id, domain: 'atlas' }), { id: id + '.extra', domain: 'atlas' }, { id, domain: 'idea' }])
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: active, commandId: id, productCommandRecord: record }).allowed, false);
  }
});

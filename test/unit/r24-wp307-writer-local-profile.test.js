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

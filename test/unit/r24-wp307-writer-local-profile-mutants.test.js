const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MODULE_PATH = path.resolve(__dirname, '..', '..', 'src', 'core', 'writer-local-profile-v1.cjs');

function loadFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('WP307 independent oracles kill activation and optional-system mutants', (t) => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-wp307-mutants-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const mutants = [
    {
      id: 'full-manuscript-export-denied',
      transform: (value) => value.replace(
        "  'cmd.project.review.exportFullManuscriptDocxReviewPacket',",
        "  'cmd.project.review.exportFullManuscriptDocxReviewPacket.disabled',",
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalCommandAccess({
          profile,
          commandId: 'cmd.project.review.exportFullManuscriptDocxReviewPacket',
        }).allowed, true);
      },
    },
    {
      id: 'unpackaged-activation',
      transform: (value) => value.replace(
        "const active = isPackaged === true && normalizedPlatform === 'darwin';",
        "const active = normalizedPlatform === 'darwin';",
      ),
      oracle: (module) => assert.equal(
        module.createWriterLocalProfileProjection({ isPackaged: false, platform: 'darwin' }).active,
        false,
      ),
    },
    {
      id: 'non-mac-activation',
      transform: (value) => value.replace(
        "const active = isPackaged === true && normalizedPlatform === 'darwin';",
        'const active = isPackaged === true;',
      ),
      oracle: (module) => assert.equal(
        module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'win32' }).active,
        false,
      ),
    },
    {
      id: 'optional-command-admitted',
      transform: (value) => value.replace(
        '&& isOptionalWriterLocalCommand(commandId, productCommandRecord);',
        '&& false;',
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalCommandAccess({
          profile,
          commandId: 'atlas.entity.create',
          productCommandRecord: { id: 'atlas.entity.create', domain: 'atlas' },
        }).allowed, false);
      },
    },
    {
      id: 'optional-query-admitted',
      transform: (value) => value.replace(
        '&& OPTIONAL_QUERY_ID_SET.has(normalizeIdentity(queryId));',
        '&& false;',
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalQueryAccess({
          profile,
          queryId: 'query.atlasOverview',
        }).allowed, false);
      },
    },
    {
      id: 'review-prefix-admitted',
      transform: (value) => value.replace(
        '    return true;\n  }\n  if (!isPlainObject(productCommandRecord)',
        '    return false;\n  }\n  if (!isPlainObject(productCommandRecord)',
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalCommandAccess({
          profile,
          commandId: 'cmd.project.review.applyExactTextChange',
        }).allowed, false);
      },
    },
    {
      id: 'docx-review-roundtrip-survivor-denied',
      transform: (value) => value.replace(
        "  'cmd.project.review.exportDocxReviewPacket',",
        "  'cmd.project.review.exportDocxReviewPacket.disabled',",
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalCommandAccess({
          profile,
          commandId: 'cmd.project.review.exportDocxReviewPacket',
        }).allowed, true);
      },
    },
    {
      id: 'docx-review-roundtrip-wildcard-review-admitted',
      transform: (value) => value.replace(
        'WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_ID_SET.has(normalizedCommandId)',
        "normalizedCommandId.startsWith('cmd.project.review.')",
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalCommandAccess({
          profile,
          commandId: 'cmd.project.review.exportLocalPacket',
        }).allowed, false);
      },
    },
    {
      id: 'history-denied',
      transform: (value) => value.replace(
        "  'query.projectionInspector',\n]);",
        "  'query.projectionInspector',\n  'query.sceneHistory',\n]);",
      ),
      oracle: (module) => {
        const profile = module.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
        assert.equal(module.evaluateWriterLocalQueryAccess({
          profile,
          queryId: 'query.sceneHistory',
        }).allowed, true);
      },
    },
  ];

  let killed = 0;
  for (const mutant of mutants) {
    const transformed = mutant.transform(source);
    assert.notEqual(transformed, source, `missing mutation target: ${mutant.id}`);
    const mutantPath = path.join(tempRoot, `${mutant.id}.cjs`);
    fs.writeFileSync(mutantPath, transformed, 'utf8');
    const module = loadFresh(mutantPath);
    try {
      mutant.oracle(module);
    } catch {
      killed += 1;
    }
  }
  assert.equal(killed, mutants.length);
  console.log(`R24_WP307_IMPLEMENTATION_MUTANTS=${killed}/${mutants.length}`);
});

test('full Mac profile independent oracles kill broadened admission and lost denial mutants', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'full-mac-profile-mutants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mutants = [
    ['blanket manual maps', s => s.replace('(!optional || selected)', "(!optional || productCommandRecord?.domain === 'manualMap')"), m => {
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: m.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' }),
        commandId: 'manualMap.node.delete', productCommandRecord: { id: 'manualMap.node.delete', domain: 'manualMap' } }).allowed, false);
    }],
    ['any optional query', s => s.replace('(!optional || WRITER_ATLAS_QUERY_SET.has(queryId))', 'true'), m => {
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile: m.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' }), queryId: 'query.collabScopeLocal' }).allowed, false);
    }],
    ['invalid v2 profile', s => s.replace('if (!isWriterAtlasProfileCandidate(profile)) return false;', 'if (!isWriterAtlasProfileCandidate(profile)) return false; return true;'), m => {
      const profile = { ...m.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' }), optionalSystemsEnabled: true };
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.manualMapWorkbench' }).allowed, false);
    }],
    ['lost create', s => s.replace("Object.freeze(['manualMap.create', 'manualMap.node.add'])", "Object.freeze(['manualMap.create.disabled', 'manualMap.node.add'])"), m => {
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: m.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' }), commandId: 'manualMap.create',
        productCommandRecord: { id: 'manualMap.create', domain: 'manualMap' } }).allowed, true);
    }],
    ['wrong selected domain', s => s.replace("&& productCommandRecord.id === commandId && productCommandRecord.domain === 'manualMap'", '&& productCommandRecord.id === commandId'), m => {
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile: m.createWriterAtlasProfileProjection({ isPackaged: true, platform: 'darwin' }), commandId: 'manualMap.create',
        productCommandRecord: { id: 'manualMap.create', domain: 'blackBox' } }).allowed, false);
    }],
  ];
  for (const [name, transform, oracle] of mutants) {
    const changed = transform(source); assert.notEqual(changed, source, name);
    const file = path.join(root, name.replaceAll(' ', '-') + '.cjs'); fs.writeFileSync(file, changed);
    assert.throws(() => oracle(loadFresh(file)), { name: 'AssertionError' }, name);
  }
  t.diagnostic(`FULL_MAC_PROFILE_MUTANTS=${mutants.length}/${mutants.length}`);
});

test('manual-map V3 independent oracles kill capability overgrant, malformed policy and missing command mutants', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'manual-map-v3-mutants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mutants = [
    ['overgrant', s => s.replace('(optional ? selected : true)', 'true'), m => {
      const profile = m.createWriterManualMapProfileProjection({ isPackaged: true, platform: 'darwin' });
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: 'atlas.entity.create', productCommandRecord: { id: 'atlas.entity.create', domain: 'atlas' } }).allowed, false);
    }],
    ['malformed', s => s.replace('if (!isWriterManualMapProfileCandidate(profile)) return false;', 'if (!isWriterManualMapProfileCandidate(profile)) return false; return true;'), m => {
      const profile = { ...m.createWriterManualMapProfileProjection({ isPackaged: true, platform: 'darwin' }), optionalSystemsEnabled: true };
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.manualMapWorkbench' }).allowed, false);
    }],
    ['missing command', s => s.replace("'manualMap.edge.update', 'manualMap.edge.delete',", "'manualMap.edge.update.disabled', 'manualMap.edge.delete',"), m => {
      const profile = m.createWriterManualMapProfileProjection({ isPackaged: true, platform: 'darwin' });
      assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId: 'manualMap.edge.update', productCommandRecord: { id: 'manualMap.edge.update', domain: 'manualMap' } }).allowed, true);
    }],
  ];
  for (const [name, transform, oracle] of mutants) {
    const changed = transform(source); assert.notEqual(changed, source);
    const file = path.join(root, name + '.cjs'); fs.writeFileSync(file, changed);
    assert.throws(() => oracle(loadFresh(file)), { name: 'AssertionError' }, name);
  }
});


test('manual-map V4 independent oracles kill Markdown policy and query mutants without changing legacy mutants', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'manual-map-v4-mutants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const check = (m, commandId, allowed, patch = {}, record = { id: commandId, domain: commandId.startsWith('atlas.') ? 'atlas' : 'manualMap' }) => {
    const profile = { ...m.createWriterManualMapMarkdownProfileProjection({ isPackaged: true, platform: 'darwin' }), ...patch };
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId, productCommandRecord: record }).allowed, allowed);
  };
  const mutants = [
    ['overgrant', s => s.replace('isActiveWriterManualMapMarkdownProfile(profile) && (!optional || selected)', 'isActiveWriterManualMapMarkdownProfile(profile)'),
      m => check(m, 'atlas.entity.create', false)],
    ['malformed', s => s.replace('if (!isWriterManualMapMarkdownProfileCandidate(profile)) return false;', 'if (!isWriterManualMapMarkdownProfileCandidate(profile)) return false; return true;'),
      m => check(m, 'manualMap.export.markdown', false, { optionalSystemsEnabled: true })],
    ['missing Markdown', s => s.replace("...WRITER_MANUAL_MAP_COMMAND_IDS, 'manualMap.export.markdown'", "...WRITER_MANUAL_MAP_COMMAND_IDS, 'manualMap.export.markdown.disabled'"),
      m => check(m, 'manualMap.export.markdown', true)],
    ['wrong domain', s => s.replace("    && productCommandRecord.id === commandId && productCommandRecord.domain === 'manualMap';\n  return markdownProfileAccess", '    && productCommandRecord.id === commandId;\n  return markdownProfileAccess'),
      m => check(m, 'manualMap.export.markdown', false, {}, { id: 'manualMap.export.markdown', domain: 'atlas' })],
    ['query overgrant', s => s.replace('markdownProfileAccess(profile, WRITER_ATLAS_QUERY_IDS.includes(queryId),', 'markdownProfileAccess(profile, true,'), m => {
      const profile = m.createWriterManualMapMarkdownProfileProjection({ isPackaged: true, platform: 'darwin' });
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile, queryId: 'query.collabScopeLocal' }).allowed, false);
    }],
  ];
  for (const [name, transform, oracle] of mutants) {
    const changed = transform(source); assert.notEqual(changed, source, name);
    const file = path.join(root, name + '.cjs'); fs.writeFileSync(file, changed);
    assert.throws(() => oracle(loadFresh(file)), { name: 'AssertionError' }, name);
  }
  t.diagnostic(`MANUAL_MAP_V4_MUTANTS=${mutants.length}/${mutants.length}`);
});


test('exact Atlas V5 independent oracles kill closed membership record policy and query mutants', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8'), options = { isPackaged: true, platform: 'darwin' };
  assert.equal(typeof loadFresh(MODULE_PATH).createWriterExactAtlasProfileProjection, 'function');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'exact-atlas-v5-mutants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const command = (m, commandId, allowed, record = { id: commandId, domain: 'atlas' }, patch = {}) => {
    const profile = { ...m.createWriterExactAtlasProfileProjection(options), ...patch };
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile, commandId, productCommandRecord: record }).allowed, allowed);
  };
  const mutants = [
    ['lost entity', s => s.replace("'atlas.entity.create', 'atlas.alias.add', 'atlas.mention.confirm'", "'atlas.entity.create.disabled', 'atlas.alias.add', 'atlas.mention.confirm'"),
      m => command(m, 'atlas.entity.create', true)],
    ['blanket optional', s => s.replace('isActiveWriterExactAtlasProfile(profile) && (!optional || selected)', 'isActiveWriterExactAtlasProfile(profile)'),
      m => command(m, 'atlas.entity.merge', false)],
    ['wrong domain', s => s.replace("productCommandRecord.domain === (WRITER_EXACT_ATLAS_AUTHOR_COMMAND_IDS.includes(commandId) ? 'atlas' : 'manualMap')", 'true'),
      m => command(m, 'atlas.entity.create', false, { id: 'atlas.entity.create', domain: 'manualMap' })],
    ['forged ID', s => s.replace('productCommandRecord.id === commandId &&\n    productCommandRecord.domain', 'true &&\n    productCommandRecord.domain'),
      m => command(m, 'atlas.entity.create', false, { id: 'atlas.alias.add', domain: 'atlas' })],
    ['malformed policy', s => s.replace('if (!isWriterExactAtlasProfileCandidate(profile)) return false;', 'if (!isWriterExactAtlasProfileCandidate(profile)) return false; return true;'),
      m => command(m, 'atlas.entity.create', false, undefined, { optionalSystemsEnabled: true })],
    ['query overgrant', s => s.replace('exactAtlasProfileAccess(profile, WRITER_EXACT_ATLAS_QUERY_IDS.includes(queryId),', 'exactAtlasProfileAccess(profile, true,'), m => {
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile: m.createWriterExactAtlasProfileProjection(options), queryId: 'query.atlasOverview' }).allowed, false);
    }],
    ['lost dossier', s => s.replace("...WRITER_ATLAS_QUERY_IDS, 'query.atlasEntityDossier'", "...WRITER_ATLAS_QUERY_IDS, 'query.atlasEntityDossier.disabled'"), m => {
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile: m.createWriterExactAtlasProfileProjection(options), queryId: 'query.atlasEntityDossier' }).allowed, true);
    }],
    ['extra key', s => s.replace('Reflect.ownKeys(profile).length === keys.length', 'true'), m => command(m, 'atlas.entity.create', false, undefined, { extra: true })],
    ['ordered arrays', s => s.replace('expected[key].every((id, index) => profile[key][index] === id)', 'true'), m => {
      const profile = m.createWriterExactAtlasProfileProjection(options);
      command(m, 'atlas.entity.create', false, undefined, { admittedCommandIds: [...profile.admittedCommandIds].reverse() });
    }],
  ];
  for (const [name, transform, oracle] of mutants) {
    // Restrict replacements to V5 so legacy first-match mutation targets remain exact.
    const boundary = source.indexOf('// V5 admits only the existing exact Atlas authoring journey.'); assert.ok(boundary > 0);
    const changed = source.slice(0, boundary) + transform(source.slice(boundary)); assert.notEqual(changed, source, name);
    const file = path.join(root, name.replaceAll(' ', '-') + '.cjs'); fs.writeFileSync(file, changed);
    const mutant = loadFresh(file); assert.throws(() => oracle(mutant), { name: 'AssertionError' }, name);
  }
  t.diagnostic(`EXACT_ATLAS_V5_MUTANTS=${mutants.length}/${mutants.length}`);
});

test('V6 independent mutation oracles reject reattachment policy overgrant and inherited property holes', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8'), options = { isPackaged: true, platform: 'darwin' };
  const original = loadFresh(MODULE_PATH); assert.equal(typeof original.createWriterAtlasEvidenceReattachmentProfileProjection, 'function');
  const boundary = source.indexOf('// V6 admits only explicit saved Atlas evidence reattachment.'); assert.ok(boundary > 0);
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'atlas-reattach-v6-mutants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const active = m => m.createWriterAtlasEvidenceReattachmentProfileProjection(options);
  const check = (m, allowed, patch = {}, record = { id: 'atlas.evidence.reattach', domain: 'atlas' }, commandId = 'atlas.evidence.reattach') =>
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: { ...active(m), ...patch }, commandId, productCommandRecord: record }).allowed, allowed);
  const mutants = [
    ['lost command', s => s.replace("...WRITER_EXACT_ATLAS_COMMAND_IDS, 'atlas.evidence.reattach'", "...WRITER_EXACT_ATLAS_COMMAND_IDS, 'atlas.evidence.reattach.disabled'"), m => check(m, true)],
    ['blanket optional', s => s.replace('isActiveWriterAtlasEvidenceReattachmentProfile(profile) && (!optional || selected)', 'isActiveWriterAtlasEvidenceReattachmentProfile(profile)'),
      m => check(m, false, {}, { id: 'atlas.entity.merge', domain: 'atlas' }, 'atlas.entity.merge')],
    ['forged record', s => s.replace('productCommandRecord.id === commandId &&', 'true &&'),
      m => check(m, false, {}, { id: 'atlas.entity.merge', domain: 'atlas' })],
    ['wrong domain', s => s.replace("productCommandRecord.domain === (commandId.startsWith('atlas.') ? 'atlas' : 'manualMap')", 'true'),
      m => check(m, false, {}, { id: 'atlas.evidence.reattach', domain: 'manualMap' })],
    ['policy', s => s.replace('if (!isWriterAtlasEvidenceReattachmentProfileCandidate(profile)) return false;', 'if (!isWriterAtlasEvidenceReattachmentProfileCandidate(profile)) return false; return true;'),
      m => check(m, false, { optionalSystemsEnabled: true })],
    ['extra key', s => s.replace('Reflect.ownKeys(profile).length === keys.length', 'true'), m => check(m, false, { extra: true })],
    ['array order', s => s.replace('profile[key][index] === id', 'true'), m => check(m, false, { admittedCommandIds: [...active(m).admittedCommandIds].reverse() })],
    ['inherited index', s => s.replace('Object.hasOwn(profile[key], index)', 'true'), m => {
      const values = [...active(m).admittedCommandIds], index = values.length - 1; delete values[index];
      Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: 'atlas.evidence.reattach' })); values.extra = true;
      check(m, false, { admittedCommandIds: values });
    }],
    ['query overgrant', s => s.replace('reattachmentProfileAccess(profile, WRITER_EXACT_ATLAS_QUERY_IDS.includes(queryId),', 'reattachmentProfileAccess(profile, true,'), m => {
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active(m), queryId: 'query.atlasOverview' }).allowed, false);
    }],
  ];
  for (const [name, transform, oracle] of mutants) {
    const changed = source.slice(0, boundary) + transform(source.slice(boundary)); assert.notEqual(changed, source, name);
    const file = path.join(root, name.replaceAll(' ', '-') + '.cjs'); fs.writeFileSync(file, changed);
    const mutant = loadFresh(file); assert.throws(() => oracle(mutant), { name: 'AssertionError' }, name);
  }
  t.diagnostic(`ATLAS_REATTACHMENT_V6_MUTANTS=${mutants.length}/${mutants.length}`);
});

test('V7 independent mutation oracles kill suppression overgrant malformed arrays records and query authority', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8'), original = loadFresh(MODULE_PATH);
  assert.equal(typeof original.createWriterAtlasExplicitSuppressionProfileProjection, 'function', 'missing V7 is a policy gap, not a mutant kill');
  const boundary = source.indexOf('// V7 admits only explicit Atlas occurrence suppression.'); assert.ok(boundary > 0);
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'atlas-suppress-v7-mutants-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const active = m => m.createWriterAtlasExplicitSuppressionProfileProjection({ isPackaged: true, platform: 'darwin' });
  const check = (m, allowed, patch = {}, record = { id: 'atlas.observation.suppress', domain: 'atlas' }, id = 'atlas.observation.suppress') =>
    assert.equal(m.evaluateWriterLocalCommandAccess({ profile: { ...active(m), ...patch }, commandId: id, productCommandRecord: record }).allowed, allowed);
  const mutants = [
    ['lost suppression', s => s.replace("...WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS, 'atlas.observation.suppress'", "...WRITER_ATLAS_EVIDENCE_REATTACHMENT_COMMAND_IDS, 'atlas.observation.suppress.disabled'"), m => check(m, true)],
    ['blanket optional', s => s.replace('isActiveWriterAtlasExplicitSuppressionProfile(profile) && (!optional || selected)', 'isActiveWriterAtlasExplicitSuppressionProfile(profile)'),
      m => check(m, false, {}, { id: 'atlas.entity.merge', domain: 'atlas' }, 'atlas.entity.merge')],
    ['forged record', s => s.replace('productCommandRecord.id === commandId &&', 'true &&'), m => check(m, false, {}, { id: 'atlas.entity.merge', domain: 'atlas' })],
    ['wrong domain', s => s.replace("productCommandRecord.domain === (commandId.startsWith('atlas.') ? 'atlas' : 'manualMap')", 'true'), m => check(m, false, {}, { id: 'atlas.observation.suppress', domain: 'manualMap' })],
    ['policy', s => s.replace('if (!isWriterAtlasExplicitSuppressionProfileCandidate(profile)) return false;', 'if (!isWriterAtlasExplicitSuppressionProfileCandidate(profile)) return false; return true;'),
      m => check(m, false, { optionalSystemsEnabled: true })],
    ['extra key', s => s.replace('Reflect.ownKeys(profile).length === keys.length', 'true'), m => check(m, false, { extra: true })],
    ['array order', s => s.replace('profile[key][index] === id', 'true'), m => check(m, false, { admittedCommandIds: [...active(m).admittedCommandIds].reverse() })],
    ['inherited index', s => s.replace('Object.hasOwn(profile[key], index)', 'true'), m => {
      const values = [...active(m).admittedCommandIds], index = values.length - 1; delete values[index];
      Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: 'atlas.observation.suppress' })); values.extra = true;
      check(m, false, { admittedCommandIds: values });
    }],
    ['query overgrant', s => s.replace('suppressionProfileAccess(profile, WRITER_EXACT_ATLAS_QUERY_IDS.includes(queryId),', 'suppressionProfileAccess(profile, true,'), m =>
      assert.equal(m.evaluateWriterLocalQueryAccess({ profile: active(m), queryId: 'query.atlasOverview' }).allowed, false)],
  ];
  for (const [name, transform, oracle] of mutants) {
    const changed = source.slice(0, boundary) + transform(source.slice(boundary)); assert.notEqual(changed, source, name);
    const file = path.join(root, name.replaceAll(' ', '-') + '.cjs'); fs.writeFileSync(file, changed);
    const mutant = loadFresh(file); assert.throws(() => oracle(mutant), { name: 'AssertionError' }, name);
  }
  t.diagnostic(`ATLAS_EXPLICIT_SUPPRESSION_V7_MUTANTS=${mutants.length}/${mutants.length}`);
});

test('V8 independent oracles kill reader omission command overgrant and malformed policy authority', t => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8'), original = loadFresh(MODULE_PATH);
  assert.equal(typeof original.createWriterAtlasReadSurfacesProfileProjection, 'function', 'missing V8 is a policy gap, not a mutant kill');
  const boundary = source.indexOf('// V8 admits only the existing Atlas read surfaces.'); assert.ok(boundary > 0);
  const active = m => m.createWriterAtlasReadSurfacesProfileProjection({ isPackaged: true, platform: 'darwin' });
  const query = (m, id, patch = {}) => m.evaluateWriterLocalQueryAccess({ profile: { ...active(m), ...patch }, queryId: id }).allowed;
  const command = (m, id, patch = {}, record = { id, domain: 'atlas' }) => m.evaluateWriterLocalCommandAccess({
    profile: { ...active(m), ...patch }, commandId: id, productCommandRecord: record }).allowed;
  assert.equal(query(original, 'query.atlasOverview'), true); assert.equal(query(original, 'query.projectionInspector'), true);
  assert.equal(command(original, 'atlas.observation.suppress'), true); assert.equal(command(original, 'atlas.entity.merge'), false);
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'atlas-read-v8-mutants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mutants = [
    ['lost reader', s => s.replace("'query.atlasOverview'", "'query.atlasOverview.disabled'"), m => assert.equal(query(m, 'query.atlasOverview'), true)],
    ['all optional commands', s => s.replace('isActiveWriterAtlasReadSurfacesProfile(profile) && (!optional || selected)', 'isActiveWriterAtlasReadSurfacesProfile(profile)'),
      m => assert.equal(command(m, 'atlas.entity.merge'), false)],
    ['all optional queries', s => s.replace('readSurfacesProfileAccess(profile, WRITER_ATLAS_READ_SURFACES_QUERY_IDS.includes(queryId),', 'readSurfacesProfileAccess(profile, true,'),
      m => assert.equal(query(m, 'query.stage10ProductState'), false)],
    ['forged record', s => s.replace('productCommandRecord.id === commandId &&', 'true &&'),
      m => assert.equal(command(m, 'atlas.observation.suppress', {}, { id: 'atlas.entity.merge', domain: 'atlas' }), false)],
    ['wrong domain', s => s.replace("productCommandRecord.domain === (commandId.startsWith('atlas.') ? 'atlas' : 'manualMap')", 'true'),
      m => assert.equal(command(m, 'atlas.observation.suppress', {}, { id: 'atlas.observation.suppress', domain: 'manualMap' }), false)],
    ['policy active bypass', s => s.replace('if (!isWriterAtlasReadSurfacesProfileCandidate(profile)) return false;',
      'if (!isWriterAtlasReadSurfacesProfileCandidate(profile)) return false; return true;'),
      m => assert.equal(query(m, 'query.atlasOverview', { optionalSystemsEnabled: true }), false)],
    ['extra own key', s => s.replace('Reflect.ownKeys(profile).length === keys.length', 'true'),
      m => assert.equal(query(m, 'query.atlasOverview', { extra: true }), false)],
    ['query array order', s => s.replace('profile[key][index] === id', 'true'),
      m => assert.equal(query(m, 'query.atlasOverview', { admittedQueryIds: [...active(m).admittedQueryIds].reverse() }), false)],
    ['inherited query index', s => s.replace('Object.hasOwn(profile[key], index)', 'true'), m => {
      const values = [...active(m).admittedQueryIds], index = values.length - 1; delete values[index];
      Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype), { [index]: active(m).admittedQueryIds[index] }));
      values.extra = true; // Keep the own-key count equal so the own-index oracle is independent.
      assert.equal(query(m, 'query.atlasOverview', { admittedQueryIds: values }), false);
    }],
  ];
  for (const [name, transform, oracle] of mutants) {
    oracle(original); // Each refusal oracle first executes against the lawful original policy.
    const changed = source.slice(0, boundary) + transform(source.slice(boundary)); assert.notEqual(changed, source, name);
    const file = path.join(root, name.replaceAll(' ', '-') + '.cjs'); fs.writeFileSync(file, changed);
    assert.throws(() => oracle(loadFresh(file)), { name: 'AssertionError' }, name);
  }
  t.diagnostic(`ATLAS_READ_SURFACES_V8_MUTANTS=${mutants.length}/${mutants.length}`);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MODULE_PATH = path.join(__dirname, '..', '..', 'src', 'core', 'project-transaction-v1.cjs');
const DEPENDENCIES = [
  "browser-safe-hash.cjs",
  "word-manuscript-notes-v1.cjs",
  "word-note-reference-typography-v1.cjs",
  "word-language-v1.cjs",
  "word-rich-body-projection-v1.cjs",
  "word-comment-anchor-save-v1.cjs",
  "word-user-bookmarks-v1.cjs",
  "word-comment-edit-intents-v1.cjs",
  "word-comment-ranges-v1.cjs",
  "word-comment-return-delta-v1.cjs",
  "word-comment-authoring-v1.cjs",
  "word-comment-body-v1.cjs",
  "document-content-envelope-v1.cjs",
  "transactional-inbox-outbox-v1.cjs",
  "lifecycle-conflict-v1.cjs",
  "dirty-admission-v1.cjs",
  "autosave-generation-v1.cjs",
  "revision-algebra-v1.cjs",
  "migration-history-backup-gc-v1.cjs",
  "storage-selection-v1.cjs",
  "storage-bakeoff-v1.cjs",
  "recovery-ledger-v1.cjs",
  "save-coordinator-v1.cjs",
  "project-location-v1.cjs"
];
function loadIsolated(source, label) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r24-wp201-' + label + '-')));
  const core = path.join(root, 'core');
  fs.mkdirSync(core); fs.mkdirSync(path.join(root, 'io'));
  for (const name of DEPENDENCIES) fs.copyFileSync(path.join(path.dirname(MODULE_PATH), name), path.join(core, name));
  for (const name of ['docxHyperlinks.cjs', 'inlineTypography.cjs', 'documentTables.js', 'documentTableProperties.js', 'documentMedia.js', 'documentJpeg.js']) {
    fs.copyFileSync(path.join(path.dirname(MODULE_PATH), '..', 'io', name), path.join(root, 'io', name));
  }
  const target = path.join(core, 'project-transaction-v1.cjs');
  fs.writeFileSync(target, source);
  return { root, subject: require(target) };
}

const MUTANTS = [
  {
    id: 'scene-admission-cas-removed',
    find: 'if (observedScene !== expectedSceneContent) {',
    replace: 'if (false) {',
  },
  {
    id: 'manifest-admission-cas-removed',
    find: 'if (observedManifest !== expectedManifestContent) {',
    replace: 'if (false) {',
  },
  {
    id: 'journal-path-binding-removed',
    find: 'if (journal.scenePath !== scenePath || journal.manifestPath !== manifestPath) {',
    replace: 'if (false) {',
  },
  {
    id: 'commit-point-written-elsewhere',
    find: 'filePath: commitPathFor(scenePath),',
    replace: 'filePath: `${commitPathFor(scenePath)}.mutant`,',
  },
  {
    id: 'recovery-divergence-overwritten',
    find: "if (manifestClass === 'OTHER' || sceneClass === 'OTHER') {",
    replace: 'if (false) {',
  },
  {
    id: 'ack-phase-removed',
    find: 'const TRANSACTION_PHASE_CHAIN = Object.freeze(Object.values(TRANSACTION_PHASES));',
    replace: 'const TRANSACTION_PHASE_CHAIN = Object.freeze(Object.values(TRANSACTION_PHASES).slice(0, -1));',
  },
];

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-wp201-mutant-oracle-'));
  const scenePath = path.join(root, 'scenes', 'scene.txt');
  const manifestPath = path.join(root, 'project.json');
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, 'old scene');
  fs.writeFileSync(manifestPath, '{"revision":1}');
  return { scenePath, manifestPath };
}

function publisher() {
  return async ({ manifestPath, expectedText, nextText }) => {
    if (fs.readFileSync(manifestPath, 'utf8') !== expectedText) {
      const error = new Error('CAS');
      error.code = 'E_TEST_MANIFEST_CAS';
      throw error;
    }
    fs.writeFileSync(manifestPath, nextText);
  };
}

async function killOracle(module) {
  const first = sandbox();
  const receipt = await module.commitProjectTransaction({
    ...first,
    sceneContent: 'new scene',
    expectedSceneContent: 'old scene',
    manifestContent: '{"revision":2}',
    expectedManifestContent: '{"revision":1}',
    revision: 2,
    publishManifest: publisher(),
  });
  assert.equal(receipt.phases.at(-1), 'ACK');
  assert.equal(fs.existsSync(module.commitPathFor(first.scenePath)), true);
  assert.equal(fs.existsSync(module.journalPathFor(first.manifestPath)), false);

  const sceneDrift = sandbox();
  await assert.rejects(module.commitProjectTransaction({
    ...sceneDrift,
    sceneContent: 'new scene',
    expectedSceneContent: 'wrong scene',
    manifestContent: '{"revision":2}',
    expectedManifestContent: '{"revision":1}',
    revision: 2,
    publishManifest: publisher(),
  }), (error) => error.code === 'E_PROJECT_TRANSACTION_SCENE_CAS');
  assert.equal(fs.existsSync(module.journalPathFor(sceneDrift.manifestPath)), false);

  const manifestDrift = sandbox();
  await assert.rejects(module.commitProjectTransaction({
    ...manifestDrift,
    sceneContent: 'new scene',
    expectedSceneContent: 'old scene',
    manifestContent: '{"revision":2}',
    expectedManifestContent: '{"revision":0}',
    revision: 2,
    publishManifest: publisher(),
  }), (error) => error.code === 'E_PROJECT_TRANSACTION_MANIFEST_CAS');
  assert.equal(fs.existsSync(module.journalPathFor(manifestDrift.manifestPath)), false);

  const rebound = sandbox();
  fs.writeFileSync(module.journalPathFor(rebound.manifestPath), JSON.stringify({
    schemaVersion: module.JOURNAL_SCHEMA_VERSION,
    transactionId: '0'.repeat(64),
    revision: 2,
    scenePath: `${rebound.scenePath}.other`,
    manifestPath: rebound.manifestPath,
    before: { sceneBase64: null, manifestBase64: Buffer.from('{}').toString('base64') },
    after: { sceneBase64: Buffer.from('x').toString('base64'), manifestBase64: Buffer.from('{}').toString('base64') },
  }));
  await assert.rejects(
    module.recoverProjectTransaction({ ...rebound, publishManifest: publisher() }),
    (error) => error.code === 'E_PROJECT_TRANSACTION_JOURNAL_PATH_MISMATCH',
  );

  const divergent = sandbox();
  await assert.rejects(module.commitProjectTransaction({
    ...divergent,
    sceneContent: 'new scene',
    expectedSceneContent: 'old scene',
    manifestContent: '{"revision":2}',
    expectedManifestContent: '{"revision":1}',
    revision: 2,
    publishManifest: async ({ manifestPath, nextText }) => {
      fs.writeFileSync(manifestPath, nextText);
      throw new Error('crash stand-in');
    },
  }));
  fs.writeFileSync(divergent.scenePath, 'third-party bytes');
  await assert.rejects(
    module.recoverProjectTransaction({ ...divergent, publishManifest: publisher() }),
    (error) => error.code === 'E_PROJECT_TRANSACTION_RECOVERY_DIVERGENCE',
  );
  assert.equal(fs.readFileSync(divergent.scenePath, 'utf8'), 'third-party bytes');
}

test('WP201 executes and kills all named implementation mutants', async () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  const control = loadIsolated(source, 'unmodified-control');
  try { await killOracle(control.subject); } finally { fs.rmSync(control.root, { recursive: true, force: true }); }
  const results = [];
  for (const mutant of MUTANTS) {
    assert.equal(source.split(mutant.find).length - 1, 1, `unique anchor: ${mutant.id}`);
    const fixture = loadIsolated(source.replace(mutant.find, mutant.replace), mutant.id);
    let killed = false;
    let detail = '';
    try {
      await killOracle(fixture.subject);
      detail = 'survived';
    } catch (error) {
      if (['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(error?.code)) throw error;
      killed = true;
      detail = error.code || error.message;
    }
    results.push({ id: mutant.id, killed, detail });
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
  const survived = results.filter((result) => !result.killed);
  console.log(`R24_WP201_MUTATION_RECEIPT=${JSON.stringify({ total: results.length, killed: results.length - survived.length, survived: survived.map(({ id }) => id) })}`);
  assert.equal(results.length, 6);
  assert.deepEqual(survived, []);
});

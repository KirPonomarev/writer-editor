// R2.4 WP-201_PROJECT_TRANSACTION - one recoverable scene + manifest commit.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const { durableSaveTransaction } = require('./save-coordinator-v1.cjs');
const { MODE: COMMENT_REBASE_MODE, RETURN_MODE: COMMENT_TEXT_RETURN_MODE, planCommentAnchorSave, planCommentTextReturn } = require('./word-comment-anchor-save-v1.cjs');
const { validateNoteCohort, validateManuscriptDocument } = require('./word-manuscript-notes-v1.cjs');
const { readState: readCanonicalCommentState } = require('./word-comment-authoring-v1.cjs');
const MEDIA_JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v6';
const MEDIA_COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v6';
const TREE_JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v7';
const TREE_COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v7';
const TREE_RECEIPT_SCHEMA_VERSION = 'yalken.project-transaction.tree-receipt.v1';
const treeCommitPathFor = manifestPath => `${manifestPath}.wp201-tree-commit.json`;
const NOTE_JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v5';
const NOTE_COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v5';

const JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v1';
const COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v1';
const RESOURCE_JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v2';
const RESOURCE_COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v2';
const COMMENT_JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v3';
const COMMENT_COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v3';
const ANCHOR_JOURNAL_SCHEMA_VERSION = 'yalken.project-transaction.journal.v4';
const ANCHOR_COMMIT_SCHEMA_VERSION = 'yalken.project-transaction.commit.v4';
const commentJournalSchema = value => [COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(value?.mode) ? ANCHOR_JOURNAL_SCHEMA_VERSION : COMMENT_JOURNAL_SCHEMA_VERSION;
const commentCommitSchema = value => [COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(value?.mode) ? ANCHOR_COMMIT_SCHEMA_VERSION : COMMENT_COMMIT_SCHEMA_VERSION;
const MAX_RESOURCE_BYTES = 20 * 1024 * 1024; // existing 16 MiB media budget plus bounded receipt
const MAX_RESOURCES = 129;
const RECOVERY_PACKET_SCHEMA_VERSION = 'yalken.project-transaction.recovery-packet.v1';
const PROJECT_COMMIT_REPAIR_CAPABILITY_ID = 'CAP_R24_PROJECT_COMMIT_REPAIR';
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;

const TRANSACTION_PHASES = Object.freeze({
  ADMIT: 'ADMIT',
  RECOVER: 'RECOVER',
  PREPARE_JOURNAL: 'PREPARE_JOURNAL',
  MANIFEST_PUBLISH: 'MANIFEST_PUBLISH',
  SCENE_PUBLISH: 'SCENE_PUBLISH',
  COMMIT_POINT: 'COMMIT_POINT',
  READBACK: 'READBACK',
  CLEANUP: 'CLEANUP',
  ACK: 'ACK',
});

const TRANSACTION_PHASE_CHAIN = Object.freeze(Object.values(TRANSACTION_PHASES));

class ProjectTransactionError extends Error {
  constructor(code, phase, detail = '') {
    super(detail ? `${code}@${phase}: ${detail}` : `${code}@${phase}`);
    this.code = code;
    this.phase = phase;
  }
}

const sha256hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const journalPathFor = (manifestPath) => `${manifestPath}.wp201-transaction.json`;
const commitPathFor = (scenePath) => `${scenePath}.wp201-commit.json`;
const recoveryDirectoryFor = (manifestPath) => path.join(path.dirname(manifestPath), '.yalken-recovery');
const recoveryPacketPathFor = (manifestPath, transactionId) => path.join(
  recoveryDirectoryFor(manifestPath),
  `wp201-${transactionId}.json`,
);

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const canonicalBytes = (value) => `${canonicalize(value)}\n`;

function assertText(value, code, phase) {
  if (typeof value !== 'string') throw new ProjectTransactionError(code, phase);
  if (Buffer.byteLength(value, 'utf8') > MAX_ARTIFACT_BYTES) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_ARTIFACT_BUDGET', phase, code);
  }
}

function assertPathPair(scenePath, manifestPath) {
  if (typeof scenePath !== 'string' || scenePath.length === 0) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_SCENE_PATH_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_PATH_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }
  const relative = path.relative(path.dirname(manifestPath), scenePath);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_PATH_BOUNDARY', TRANSACTION_PHASES.ADMIT);
  }
}

function encodeOptionalText(value) {
  return value === null ? null : Buffer.from(value, 'utf8').toString('base64');
}

function decodeOptionalText(value, field) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_SHAPE', TRANSACTION_PHASES.RECOVER, field);
  }
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  if (Buffer.byteLength(decoded, 'utf8') > MAX_ARTIFACT_BYTES) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_ARTIFACT_BUDGET', TRANSACTION_PHASES.RECOVER, field);
  }
  return decoded;
}

async function readOptionalText(targetPath, fsAdapter = fsp) {
  try {
    return await fsAdapter.readFile(targetPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function fsyncDirectory(dirPath, fsAdapter = fsp) {
  const handle = await fsAdapter.open(dirPath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function removeDurably(targetPath, fsAdapter = fsp) {
  try {
    await fsAdapter.unlink(targetPath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  await fsyncDirectory(path.dirname(targetPath), fsAdapter);
}

function digestOptional(value) {
  return value === null ? null : sha256hex(value);
}

function classifyBytes(actual, before, after) {
  if (actual === before) return 'BEFORE';
  if (actual === after) return 'AFTER';
  return 'OTHER';
}

function resourceBindings(resources) {
  return resources.map(({ path: targetPath, content }) => ({ path: targetPath, digest: sha256hex(content), bytes: content.length }));
}

function normalizeRetainedResources(value, scenePath, manifestPath) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_RESOURCES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RETAINED_RESOURCES', TRANSACTION_PHASES.ADMIT);
  let bytes = 0; const seen = new Set();
  for (const entry of value) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'bytes,digest,path' || !isDigest(entry.digest)
      || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || seen.has(entry.path)) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RETAINED_RESOURCES', TRANSACTION_PHASES.ADMIT);
    normalizeResources([{ path: entry.path, content: Buffer.alloc(0) }], { scenePath, manifestPath });
    seen.add(entry.path); bytes += entry.bytes;
  }
  if (bytes > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.ADMIT);
  return value.map(entry => ({ ...entry }));
}
async function verifyRetainedResources(resources, scenePath, manifestPath, fsAdapter) {
  if (!resources.length) return;
  normalizeRetainedResources(resources, scenePath, manifestPath);
  for (const entry of resources) {
    const bytes = await readResource(entry, manifestPath, fsAdapter);
    if (bytes === null || bytes.length !== entry.bytes || sha256hex(bytes) !== entry.digest)
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_READBACK', TRANSACTION_PHASES.READBACK);
  }
}

const commentStatePath = manifestPath => path.join(path.dirname(manifestPath), '.yalken', 'word-review', 'non-text-return-state.v1.json');
const commentBinding = value => value ? { beforeDigest: sha256hex(value.beforeText), afterDigest: sha256hex(value.afterText), ...(value.mode ? { mode: value.mode } : {}) } : null;

// A single existing canonical comment file, not an arbitrary replacement port.
// Ordinary import may append new-scene threads; it cannot alter older threads.
function normalizeCommentState(value, scenePath, manifestPath, scenePair = null) {
  if (value === undefined || value === null) return null;
  const fail = () => { throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_STATE', TRANSACTION_PHASES.ADMIT); };
  if(value?.mode===COMMENT_TEXT_RETURN_MODE) {
    if(!scenePair || Object.keys(value).sort().join(',')!=='afterText,beforeText,mode,returnProofJson'
      || !['beforeText','afterText'].every(k=>typeof value[k]==='string' && Buffer.byteLength(value[k])<=65536)) fail();
    try {
      const projectId=JSON.parse(scenePair.before.manifest).projectId;
      const expected=planCommentTextReturn({beforeText:value.beforeText,projectId,
        sceneId:path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/'),
        beforeContent:scenePair.before.scene,afterContent:scenePair.after.scene,returnProofJson:value.returnProofJson});
      if(expected.afterText!==value.afterText) fail();
      return expected;
    } catch {fail();}
  }
  if (value?.mode === COMMENT_REBASE_MODE) {
    if (!scenePair || Object.keys(value).sort().join(',') !== (value.editIntents !== undefined ? 'afterText,beforeText,editIntents,mode,sessionId' : 'afterText,beforeText,mode')
      || !['beforeText', 'afterText'].every(k => typeof value[k] === 'string' && Buffer.byteLength(value[k]) <= 65536)) fail();
    let projectId, expected;
    try {
      projectId = JSON.parse(scenePair.before.manifest).projectId;
      if (typeof projectId !== 'string' || !projectId) fail();
      expected = planCommentAnchorSave({ beforeText: value.beforeText, projectId,
        sceneId: path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/'),
        beforeContent: scenePair.before.scene, afterContent: scenePair.after.scene, includeUnchanged: true,
        ...(value.editIntents !== undefined ? {editIntents:value.editIntents,sessionId:value.sessionId} : {}) });
    } catch { fail(); }
    if (!expected || expected.afterText !== value.afterText) fail();
    return expected;
  }
  if (typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'afterText,beforeText'
    || !['beforeText', 'afterText'].every(key => typeof value[key] === 'string'
      && Buffer.byteLength(value[key]) <= 65536)) fail();
  let before, after;
  try { before = JSON.parse(value.beforeText); after = JSON.parse(value.afterText); } catch { fail(); }
  const commentVersions = ['yalken.rtk.word.non-text-return-state.v1', 'yalken.rtk.word.non-text-return-state.v2', 'yalken.rtk.word.non-text-return-state.v3', 'yalken.rtk.word.non-text-return-state.v4', 'yalken.rtk.word.non-text-return-state.v5'];
  if (!before || !after || !commentVersions.includes(before.schemaVersion)
    || !commentVersions.includes(after.schemaVersion) || commentVersions.indexOf(after.schemaVersion) < commentVersions.indexOf(before.schemaVersion) || typeof before.projectId !== 'string' || !before.projectId
    || after.projectId !== before.projectId || !Number.isSafeInteger(before.revision) || before.revision < 0
    || !Number.isSafeInteger(after.revision) || after.revision !== before.revision + 1
    || !Array.isArray(before.threads) || !Array.isArray(after.threads) || !Array.isArray(before.events)
    || canonicalize(after.events) !== canonicalize(before.events)
    || after.threads.length <= before.threads.length
    || canonicalize(after.threads.slice(0, before.threads.length)) !== canonicalize(before.threads)
    || canonicalize({ ...after, schemaVersion: before.schemaVersion, revision: before.revision, threads: before.threads }) !== canonicalize(before)) fail();
  try {
    require('./word-comment-authoring-v1.cjs').readState(value.beforeText, before.projectId);
    require('./word-comment-authoring-v1.cjs').readState(value.afterText, before.projectId);
  } catch { fail(); }
  const newScene = path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/');
  if (after.threads.slice(before.threads.length).some(thread => thread?.sceneId !== newScene)) fail();
  return { beforeText: value.beforeText, afterText: value.afterText };
}

async function inspectCommentState(change, manifestPath, fsAdapter) {
  if (!change) return null;
  const target = commentStatePath(manifestPath);
  await assertResourceBoundary(target, manifestPath, fsAdapter);
  const current = await readResource({ path: target }, manifestPath, fsAdapter);
  const text = current?.toString('utf8');
  if (text !== change.beforeText && text !== change.afterText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_CAS', TRANSACTION_PHASES.RECOVER);
  }
  return text;
}

async function publishCommentState(change, manifestPath, nextText, revision, fsAdapter) {
  const current = await inspectCommentState(change, manifestPath, fsAdapter);
  if (current !== nextText) await durableSaveTransaction({ filePath: commentStatePath(manifestPath), content: nextText, revision, fsAdapter });
  if (await inspectCommentState(change, manifestPath, fsAdapter) !== nextText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_READBACK', TRANSACTION_PHASES.READBACK);
  }
}

const noteStatePath = manifestPath => path.join(path.dirname(manifestPath), 'notes.craftsman.json');
const noteBinding = value => value ? { beforeDigest: digestOptional(value.beforeText),
  afterDigest: sha256hex(value.afterText), mode: value.mode } : null;

function normalizeNoteState(value, scenePath, manifestPath, { before, after }) {
  if (value == null) return null;
  try {
    const projectId = JSON.parse(before.manifest).projectId;
    if (typeof projectId !== 'string' || !projectId || JSON.parse(after.manifest).projectId !== projectId) throw Error('PROJECT');
    return validateNoteCohort(value, { projectId,
      sceneId: path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/'),
      beforeContent: before.scene, afterContent: after.scene });
  } catch (error) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_STATE', TRANSACTION_PHASES.ADMIT, error.code || 'SCHEMA');
  }
}

async function inspectNoteState(change, manifestPath, fsAdapter) {
  if (!change) return null;
  const target = noteStatePath(manifestPath);
  await assertResourceBoundary(target, manifestPath, fsAdapter);
  const bytes = await readResource({ path: target }, manifestPath, fsAdapter);
  const current = bytes === null ? null : bytes.toString('utf8');
  if (current !== change.beforeText && current !== change.afterText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_CAS', TRANSACTION_PHASES.RECOVER);
  }
  return current;
}

async function publishNoteState(change, manifestPath, nextText, revision, fsAdapter) {
  const current = await inspectNoteState(change, manifestPath, fsAdapter);
  if (current !== nextText) {
    if (nextText === null) await removeDurably(noteStatePath(manifestPath), fsAdapter);
    else await durableSaveTransaction({ filePath: noteStatePath(manifestPath), content: nextText, revision, fsAdapter });
  }
  if (await inspectNoteState(change, manifestPath, fsAdapter) !== nextText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_READBACK', TRANSACTION_PHASES.READBACK);
  }
}

// These are create-only companions of the scene, never arbitrary replacements.
// Validate journal-derived paths and bytes before using them for recovery I/O.
function normalizeResources(resources, { scenePath, manifestPath }, wire = false) {
  if (!Array.isArray(resources) || resources.length === 0 || resources.length > MAX_RESOURCES) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_SHAPE', TRANSACTION_PHASES.ADMIT);
  }
  const root = path.dirname(manifestPath), seen = new Set();
  let total = 0;
  return resources.map(entry => {
    if (!entry || typeof entry.path !== 'string' || !path.isAbsolute(entry.path)
      || path.normalize(entry.path) !== entry.path) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_PATH', TRANSACTION_PHASES.ADMIT);
    }
    const relative = path.relative(root, entry.path);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
      || [scenePath, manifestPath, commitPathFor(scenePath), journalPathFor(manifestPath)].includes(entry.path)
      || relative.split(path.sep).some(part => part === '.yalken-recovery' || part.includes('.wp201-'))
      || seen.has(entry.path)) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_PATH', TRANSACTION_PHASES.ADMIT);
    }
    seen.add(entry.path);
    const value = wire ? entry.contentBase64 : entry.content;
    if (wire ? typeof value !== 'string' || value.length > Math.ceil(MAX_RESOURCE_BYTES / 3) * 4
      : !Buffer.isBuffer(value) && typeof value !== 'string') {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_SHAPE', TRANSACTION_PHASES.ADMIT);
    }
    const content = Buffer.from(value, wire ? 'base64' : undefined);
    if (wire && content.toString('base64') !== value) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_ENCODING', TRANSACTION_PHASES.ADMIT);
    }
    total += content.length;
    if (total > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.ADMIT);
    return { path: entry.path, content };
  });
}

function validateMediaUpdateResources(resources, { scenePath, manifestPath, before, after, noteState = null }) {
  if (typeof before !== 'string' || !resources.length) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MEDIA_UPDATE_SHAPE', TRANSACTION_PHASES.ADMIT);
  const envelope = require('./document-content-envelope-v1.cjs');
  const media = require('../io/documentMedia.js');
  const parsed = envelope.parseObservablePayload(after);
  if (parsed.issue || (!parsed.doc && !noteState)) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MEDIA_DOCUMENT', TRANSACTION_PHASES.ADMIT);
  // noteState has already passed the cohort validator; paths still derive only
  // from validated canonical bytes. Journal recovery repeats the same binding.
  const noteBlocks = noteState ? JSON.parse(noteState.afterText).notes.flatMap(note => note.manuscript?.body.content || []) : [];
  const storyBlocks = require('./word-stories-v1.cjs').read(parsed.doc)?.stories.flatMap(story => story.body.content) || [];
  const assets = media.documentMedia({ type: 'doc', content: [...(parsed.doc?.content || []), ...noteBlocks, ...storyBlocks] }).assets;
  for (const resource of resources) {
    const matches = assets.filter(asset => path.join(path.dirname(manifestPath), asset.attrs.assetPath) === resource.path);
    if (matches.length !== 1 || !matches[0].bytes.equals(resource.content)) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MEDIA_RESOURCE_BINDING', TRANSACTION_PHASES.ADMIT);
    }
  }
}

const resourceStagingPath = (entry, transactionId) => `${entry.path}.wp201-${transactionId}.tmp`;

async function assertResourceBoundary(targetPath, manifestPath, fsAdapter, ownedStaging = null) {
  const root = path.dirname(manifestPath);
  const paths = [root];
  for (const part of path.relative(root, targetPath).split(path.sep)) paths.push(path.join(paths.at(-1), part));
  for (const candidate of paths) {
    let stat;
    try { stat = await fsAdapter.lstat(candidate); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    let ownedLink = false;
    if (candidate === targetPath && stat.nlink === 2 && ownedStaging) {
      try {
        const staging = await fsAdapter.lstat(ownedStaging);
        ownedLink = staging.isFile() && !staging.isSymbolicLink() && staging.nlink === 2
          && staging.ino === stat.ino && staging.dev === stat.dev;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (stat.isSymbolicLink() || (candidate === targetPath ? !stat.isFile() || (stat.nlink !== 1 && !ownedLink) : !stat.isDirectory())) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BOUNDARY', TRANSACTION_PHASES.RECOVER);
    }
  }
}

async function readResource(entry, manifestPath, fsAdapter, transactionId = null) {
  await assertResourceBoundary(entry.path, manifestPath, fsAdapter, transactionId ? resourceStagingPath(entry, transactionId) : null);
  try {
    const stat = await fsAdapter.stat(entry.path);
    if (stat.size > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.RECOVER);
    return await fsAdapter.readFile(entry.path);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function publishResource(entry, manifestPath, revision, fsAdapter, transactionId) {
  await assertResourceBoundary(entry.path, manifestPath, fsAdapter);
  await ensureCompanionDirectory(entry.path, manifestPath, fsAdapter);
  // Exclusive link publishes complete bytes without overwriting an unrelated
  // file that appears after admission. A killed staging file is never truth.
  const stagingPath = resourceStagingPath(entry, transactionId);
  const staged = await readResource({ path: stagingPath }, manifestPath, fsAdapter);
  if (staged === null) {
    await durableSaveTransaction({ filePath: stagingPath, content: entry.content, revision, fsAdapter });
  } else if (!staged.equals(entry.content)) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_STAGING_DIVERGENCE', TRANSACTION_PHASES.RECOVER);
  await assertResourceBoundary(entry.path, manifestPath, fsAdapter);
  await fsAdapter.link(stagingPath, entry.path);
  // Retain the inode witness until commit/rollback cleanup. Equal bytes alone
  // must never authorize deleting a foreign file that won the create race.
  await fsyncDirectory(path.dirname(entry.path), fsAdapter);
}

async function ensureCompanionDirectory(targetPath, manifestPath, fsAdapter) {
  let parent = path.dirname(manifestPath);
  await assertResourceBoundary(targetPath, manifestPath, fsAdapter);
  for (const part of path.relative(parent, path.dirname(targetPath)).split(path.sep).filter(Boolean)) {
    const child = path.join(parent, part);
    try { await fsAdapter.mkdir(child); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await assertResourceBoundary(targetPath, manifestPath, fsAdapter);
    await fsyncDirectory(parent, fsAdapter);
    parent = child;
  }
}

async function inspectResources(resources, manifestPath, fsAdapter, transactionId = null, requireOwnership = false) {
  const observed = [];
  for (const entry of resources) {
    const bytes = await readResource(entry, manifestPath, fsAdapter, transactionId);
    if (bytes !== null && !bytes.equals(entry.content)) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_DIVERGENCE', TRANSACTION_PHASES.RECOVER);
    }
    observed.push(bytes);
    if (transactionId) {
      const stagingPath = resourceStagingPath(entry, transactionId);
      await assertResourceBoundary(stagingPath, manifestPath, fsAdapter, entry.path);
      try {
        if ((await fsAdapter.stat(stagingPath)).size > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.RECOVER);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const staged = await readOptionalText(stagingPath, { readFile: async p => fsAdapter.readFile(p) });
      if (staged !== null && !staged.equals(entry.content)) {
        throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_STAGING_DIVERGENCE', TRANSACTION_PHASES.RECOVER);
      }
      if (bytes !== null) {
        if (staged === null && requireOwnership) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_OWNERSHIP', TRANSACTION_PHASES.RECOVER);
        if (staged !== null) {
          const [target, witness] = await Promise.all([fsAdapter.lstat(entry.path), fsAdapter.lstat(stagingPath)]);
          if (target.ino !== witness.ino || target.dev !== witness.dev) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_OWNERSHIP', TRANSACTION_PHASES.RECOVER);
        }
      }
    }
  }
  return observed;
}

async function cleanupResourceStaging(resources, manifestPath, fsAdapter, transactionId) {
  await inspectResources(resources, manifestPath, fsAdapter, transactionId);
  for (const resource of resources) {
    const staging = resourceStagingPath(resource, transactionId);
    try { await fsAdapter.lstat(staging); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await removeDurably(staging, fsAdapter);
  }
}

function transactionIdFor({ scenePath, manifestPath, revision, before, after, resources = [], retainedResources = [], commentState = null, noteState = null }) {
  return sha256hex(JSON.stringify({
    scenePath,
    manifestPath,
    revision,
    before: { sceneDigest: digestOptional(before.scene), manifestDigest: sha256hex(before.manifest) },
    after: { sceneDigest: sha256hex(after.scene), manifestDigest: sha256hex(after.manifest) },
    ...(resources.length ? { resources: resourceBindings(resources) } : {}),
    ...(retainedResources.length ? { retainedResources } : {}),
    ...(commentState ? { commentState: commentBinding(commentState) } : {}),
    ...(noteState ? { noteState: noteBinding(noteState) } : {}),
  }));
}

function parseJournal(sourceText, { scenePath, manifestPath }) {
  let journal;
  try {
    journal = JSON.parse(sourceText);
  } catch {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_JSON', TRANSACTION_PHASES.RECOVER);
  }
  if (!journal || ![JOURNAL_SCHEMA_VERSION, RESOURCE_JOURNAL_SCHEMA_VERSION, COMMENT_JOURNAL_SCHEMA_VERSION, ANCHOR_JOURNAL_SCHEMA_VERSION, NOTE_JOURNAL_SCHEMA_VERSION, MEDIA_JOURNAL_SCHEMA_VERSION, TREE_JOURNAL_SCHEMA_VERSION].includes(journal.schemaVersion)) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_SCHEMA', TRANSACTION_PHASES.RECOVER);
  }
  if (journal.scenePath !== scenePath || journal.manifestPath !== manifestPath) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_PATH_MISMATCH', TRANSACTION_PHASES.RECOVER);
  }
  if (!Number.isSafeInteger(journal.revision) || journal.revision < 0) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_REVISION', TRANSACTION_PHASES.RECOVER);
  }
  const before = {
    scene: decodeOptionalText(journal.before?.sceneBase64, 'before.sceneBase64'),
    manifest: decodeOptionalText(journal.before?.manifestBase64, 'before.manifestBase64'),
  };
  const after = {
    scene: decodeOptionalText(journal.after?.sceneBase64, 'after.sceneBase64'),
    manifest: decodeOptionalText(journal.after?.manifestBase64, 'after.manifestBase64'),
  };
  if (before.manifest === null || after.scene === null || after.manifest === null) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_SHAPE', TRANSACTION_PHASES.RECOVER);
  }
  const continuation = journal.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && journal.mode === 'SCENE_RESOURCE_CONTINUATION_V1';
  if (journal.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && !continuation) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_SCHEMA', TRANSACTION_PHASES.RECOVER);
  const retainedResources = continuation ? normalizeRetainedResources(journal.retainedResources, scenePath, manifestPath) : [];
  const resources = ([RESOURCE_JOURNAL_SCHEMA_VERSION, COMMENT_JOURNAL_SCHEMA_VERSION, MEDIA_JOURNAL_SCHEMA_VERSION].includes(journal.schemaVersion)
    || (continuation && journal.resources !== undefined)
    || (journal.schemaVersion === NOTE_JOURNAL_SCHEMA_VERSION && journal.resources !== undefined))
    ? normalizeResources(journal.resources, { scenePath, manifestPath }, true) : [];
  if (journal.schemaVersion === JOURNAL_SCHEMA_VERSION && journal.resources !== undefined) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_SHAPE', TRANSACTION_PHASES.RECOVER);
  }
  if (journal.schemaVersion !== MEDIA_JOURNAL_SCHEMA_VERSION && !continuation && resources.length && before.scene !== null) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCES_CREATE_ONLY', TRANSACTION_PHASES.RECOVER);
  const hasComments = [COMMENT_JOURNAL_SCHEMA_VERSION, ANCHOR_JOURNAL_SCHEMA_VERSION].includes(journal.schemaVersion)
    || ([NOTE_JOURNAL_SCHEMA_VERSION, MEDIA_JOURNAL_SCHEMA_VERSION, TREE_JOURNAL_SCHEMA_VERSION].includes(journal.schemaVersion) && journal.commentState !== undefined);
  const commentState = hasComments
    ? normalizeCommentState(journal.commentState, scenePath, manifestPath, { before, after }) : null;
  if ((hasComments && (!commentState || (![NOTE_JOURNAL_SCHEMA_VERSION, MEDIA_JOURNAL_SCHEMA_VERSION, TREE_JOURNAL_SCHEMA_VERSION].includes(journal.schemaVersion) && commentJournalSchema(commentState) !== journal.schemaVersion)))
    || (!hasComments && journal.commentState !== undefined)
    || (journal.schemaVersion === ANCHOR_JOURNAL_SCHEMA_VERSION && journal.resources !== undefined)
    || (commentState && resources.some(entry => entry.path === commentStatePath(manifestPath)))) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_STATE', TRANSACTION_PHASES.RECOVER);
  }
  const noteState = normalizeNoteState(journal.noteState, scenePath, manifestPath, { before, after });
  if (journal.schemaVersion === MEDIA_JOURNAL_SCHEMA_VERSION || (continuation && resources.length)) validateMediaUpdateResources(resources, { scenePath, manifestPath, before: before.scene, after: after.scene, noteState });
  if (journal.schemaVersion !== MEDIA_JOURNAL_SCHEMA_VERSION && !continuation && (journal.schemaVersion === NOTE_JOURNAL_SCHEMA_VERSION) !== Boolean(noteState)
    || (noteState && resources.some(entry => entry.path === noteStatePath(manifestPath)))) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_STATE', TRANSACTION_PHASES.RECOVER);
  }
  const expectedId = transactionIdFor({ scenePath, manifestPath, revision: journal.revision, before, after, resources, retainedResources, commentState, noteState });
  if (journal.transactionId !== expectedId) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_DIGEST', TRANSACTION_PHASES.RECOVER);
  }
  return { ...journal, before, after, resources, retainedResources, commentState, noteState };
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function corruptCommitState(source, reason) {
  return Object.freeze({ status: 'CORRUPT', source, reason });
}

async function readCommitRecordState({
  scenePath,
  manifestPath,
  expectedJournal = null,
  observedScene,
  observedManifest,
  verifyManifestContinuation,
  fsAdapter = fsp,
}) {
  const source = await readOptionalText(commitPathFor(scenePath), fsAdapter);
  if (source === null) return Object.freeze({ status: 'ABSENT', source: null });
  let record;
  try {
    record = JSON.parse(source);
  } catch {
    return corruptCommitState(source, 'COMMIT_RECORD_JSON');
  }
  if (!record || ![COMMIT_SCHEMA_VERSION, RESOURCE_COMMIT_SCHEMA_VERSION, COMMENT_COMMIT_SCHEMA_VERSION, ANCHOR_COMMIT_SCHEMA_VERSION, NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION, TREE_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || !isDigest(record.transactionId)
    || !Number.isSafeInteger(record.revision) || record.revision < 0
    || !isDigest(record.sceneDigest) || !isDigest(record.manifestDigest)) {
    return corruptCommitState(source, 'COMMIT_RECORD_SCHEMA');
  }
  if (record.scenePath !== scenePath || record.manifestPath !== manifestPath) {
    return corruptCommitState(source, 'COMMIT_RECORD_BINDING');
  }
  if ([RESOURCE_COMMIT_SCHEMA_VERSION, COMMENT_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || (record.schemaVersion === TREE_COMMIT_SCHEMA_VERSION && record.resources !== undefined)
    || (record.schemaVersion === NOTE_COMMIT_SCHEMA_VERSION && record.resources !== undefined)) {
    if (!Array.isArray(record.resources) || !record.resources.length || record.resources.length > MAX_RESOURCES
      || record.resources.some(entry => !entry || typeof entry.path !== 'string' || !isDigest(entry.digest)
        || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > MAX_RESOURCE_BYTES)) {
      return corruptCommitState(source, 'COMMIT_RESOURCE_SCHEMA');
    }
  } else if (record.resources !== undefined) return corruptCommitState(source, 'COMMIT_RESOURCE_SCHEMA');
  if ([COMMENT_COMMIT_SCHEMA_VERSION, ANCHOR_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || ([NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION, TREE_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion) && record.commentState !== undefined)) {
    if (!record.commentState || !isDigest(record.commentState.beforeDigest) || !isDigest(record.commentState.afterDigest)
      || (record.schemaVersion === ANCHOR_COMMIT_SCHEMA_VERSION ? ![COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(record.commentState.mode)
        : record.schemaVersion === TREE_COMMIT_SCHEMA_VERSION ? ![undefined, COMMENT_REBASE_MODE, COMMENT_TEXT_RETURN_MODE, 'PROJECT_TREE_COHORT_V1'].includes(record.commentState.mode)
        : [NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion) ? ![undefined, COMMENT_REBASE_MODE, COMMENT_TEXT_RETURN_MODE].includes(record.commentState.mode) : record.commentState.mode !== undefined)) {
      return corruptCommitState(source, 'COMMIT_COMMENT_SCHEMA');
    }
  } else if (record.commentState !== undefined) return corruptCommitState(source, 'COMMIT_COMMENT_SCHEMA');
  if (record.schemaVersion === NOTE_COMMIT_SCHEMA_VERSION || ([MEDIA_COMMIT_SCHEMA_VERSION, TREE_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion) && record.noteState !== undefined)) {
    if (!record.noteState || (record.noteState.beforeDigest !== null && !isDigest(record.noteState.beforeDigest))
      || !isDigest(record.noteState.afterDigest)
      || !(record.schemaVersion === TREE_COMMIT_SCHEMA_VERSION ? ['MANUSCRIPT_POINT_REBASE_V1', 'MANUSCRIPT_IMPORT_V1', 'MANUSCRIPT_BODY_UPDATE_V1', 'PROJECT_TREE_COHORT_V1'].includes(record.noteState.mode)
        : ['MANUSCRIPT_POINT_REBASE_V1', 'MANUSCRIPT_IMPORT_V1', 'MANUSCRIPT_BODY_UPDATE_V1'].includes(record.noteState.mode))) return corruptCommitState(source, 'COMMIT_NOTE_SCHEMA');
  } else if (record.noteState !== undefined) return corruptCommitState(source, 'COMMIT_NOTE_SCHEMA');
  const manifestMatches = async (targetDigest) => {
    if (record.manifestDigest === targetDigest) return true;
    if (typeof verifyManifestContinuation !== 'function') return false;
    try {
      const proof = await verifyManifestContinuation({ manifestPath, fromDigest: record.manifestDigest, toDigest: targetDigest });
      return proof?.ok === true && proof.manifestPath === manifestPath
        && proof.fromDigest === record.manifestDigest && proof.toDigest === targetDigest;
    } catch { return false; }
  };
  if (expectedJournal) {
    const currentCommit = record.transactionId === expectedJournal.transactionId
      && record.revision === expectedJournal.revision
      && record.sceneDigest === sha256hex(expectedJournal.after.scene)
      && record.manifestDigest === sha256hex(expectedJournal.after.manifest)
      && canonicalize(record.resources || []) === canonicalize([...(expectedJournal.retainedResources || []), ...resourceBindings(expectedJournal.resources || [])])
      && canonicalize(record.commentState || null) === canonicalize(commentBinding(expectedJournal.commentState))
      && canonicalize(record.noteState || null) === canonicalize(noteBinding(expectedJournal.noteState));
    if (currentCommit) return Object.freeze({ status: 'VALID', relation: 'CURRENT', record, source });
    const priorCommit = record.sceneDigest === digestOptional(expectedJournal.before.scene)
      && await manifestMatches(sha256hex(expectedJournal.before.manifest));
    if (priorCommit) return Object.freeze({ status: 'VALID', relation: 'PRIOR', record, source });
    if (record.transactionId === expectedJournal.transactionId && record.revision !== expectedJournal.revision) {
      return corruptCommitState(source, 'COMMIT_RECORD_REVISION_MISMATCH');
    }
    if (record.transactionId !== expectedJournal.transactionId) {
      return corruptCommitState(source, 'COMMIT_RECORD_TRANSACTION_MISMATCH');
    }
    return corruptCommitState(source, 'COMMIT_RECORD_DIGEST_MISMATCH');
  }
  if (observedScene !== undefined && record.sceneDigest !== digestOptional(observedScene)) {
    return corruptCommitState(source, 'COMMIT_RECORD_SCENE_DIGEST_MISMATCH');
  }
  if (observedManifest !== undefined && !(await manifestMatches(digestOptional(observedManifest)))) {
    return corruptCommitState(source, 'COMMIT_RECORD_MANIFEST_DIGEST_MISMATCH');
  }
  return Object.freeze({ status: 'VALID', relation: 'OBSERVED', record, source });
}

function snapshotRole(role, value) {
  const present = value !== null;
  const bytes = present ? Buffer.from(value, 'utf8') : null;
  return {
    role,
    present,
    encoding: 'base64',
    sizeBytes: bytes ? bytes.length : 0,
    sha256: bytes ? sha256hex(bytes) : null,
    valueBase64: bytes ? bytes.toString('base64') : null,
  };
}

function buildRecoveryPacket({ journal, journalSource, commitState, currentScene, currentManifest }) {
  return {
    schemaVersion: RECOVERY_PACKET_SCHEMA_VERSION,
    capabilityId: PROJECT_COMMIT_REPAIR_CAPABILITY_ID,
    status: 'PRESERVED_AWAITING_INDEPENDENT_AUTHORITY',
    ...(journal.schemaVersion === MEDIA_JOURNAL_SCHEMA_VERSION ? { resourceMode: 'MEDIA_UPDATE_V1' } : {}),
    ...(journal.retainedResources?.length ? { resourceMode: 'SCENE_RESOURCE_CONTINUATION_V1', retainedResources: journal.retainedResources } : {}),
    ...(journal.commentState ? { commentState: journal.commentState } : {}),
    ...(journal.noteState ? { noteState: journal.noteState } : {}),
    ...(journal.resources?.length ? { companionResources: journal.resources.map(entry => ({ path: entry.path, contentBase64: entry.content.toString('base64') })) } : {}),
    binding: {
      transactionId: journal.transactionId,
      revision: journal.revision,
      reasonCode: commitState.reason,
    },
    artifacts: [
      snapshotRole('BEFORE_SCENE', journal.before.scene),
      snapshotRole('BEFORE_MANIFEST', journal.before.manifest),
      snapshotRole('AFTER_SCENE', journal.after.scene),
      snapshotRole('AFTER_MANIFEST', journal.after.manifest),
      snapshotRole('OBSERVED_SCENE', currentScene),
      snapshotRole('OBSERVED_MANIFEST', currentManifest),
      snapshotRole('CORRUPT_COMMIT_METADATA', commitState.source),
      snapshotRole('TRANSACTION_JOURNAL', journalSource),
    ],
    repairContract: {
      allowedDecisions: ['REPAIR_TO_AFTER', 'REPAIR_TO_BEFORE'],
      exactPacketDigestRequired: true,
      independentVerifierRequired: true,
      automaticRepairForbidden: true,
    },
  };
}

function publicRecoveryBinding(packetDigest, journal) {
  return Object.freeze({
    capabilityId: PROJECT_COMMIT_REPAIR_CAPABILITY_ID,
    packetDigest,
    transactionId: journal.transactionId,
    versionRoles: Object.freeze(['BEFORE', 'AFTER', 'CORRUPT_COMMIT_METADATA']),
    repairAuthorityRequired: true,
  });
}

async function preserveRecoveryPacket({
  manifestPath,
  journal,
  journalSource,
  commitState,
  currentScene,
  currentManifest,
  fsAdapter = fsp,
}) {
  const packet = buildRecoveryPacket({ journal, journalSource, commitState, currentScene, currentManifest });
  const bytes = canonicalBytes(packet);
  const packetDigest = sha256hex(bytes);
  const packetPath = recoveryPacketPathFor(manifestPath, journal.transactionId);
  const recoveryDirectory = path.dirname(packetPath);
  await fsAdapter.mkdir(recoveryDirectory, { recursive: true });
  await fsyncDirectory(path.dirname(recoveryDirectory), fsAdapter);
  const existing = await readOptionalText(packetPath, fsAdapter);
  if (existing === null) {
    await durableSaveTransaction({ filePath: packetPath, content: bytes, revision: journal.revision, fsAdapter });
  } else if (existing !== bytes) {
    throw new ProjectTransactionError(
      'E_PROJECT_COMMIT_RECOVERY_PACKET_CONFLICT',
      TRANSACTION_PHASES.RECOVER,
      journal.transactionId,
    );
  }
  const readback = await fsAdapter.readFile(packetPath);
  if (sha256hex(readback) !== packetDigest || !readback.equals(Buffer.from(bytes))) {
    throw new ProjectTransactionError(
      'E_PROJECT_COMMIT_RECOVERY_PACKET_READBACK',
      TRANSACTION_PHASES.RECOVER,
      journal.transactionId,
    );
  }
  return Object.freeze({ packet, packetDigest, packetPath });
}

async function failCorruptCommit({
  manifestPath,
  journal,
  journalSource,
  commitState,
  currentScene,
  currentManifest,
  fsAdapter = fsp,
}) {
  const preserved = await preserveRecoveryPacket({
    manifestPath,
    journal,
    journalSource,
    commitState,
    currentScene,
    currentManifest,
    fsAdapter,
  });
  const error = new ProjectTransactionError(
    'E_PROJECT_COMMIT_CORRUPT',
    TRANSACTION_PHASES.RECOVER,
    commitState.reason,
  );
  error.recovery = publicRecoveryBinding(preserved.packetDigest, journal);
  throw error;
}

async function readPendingProjectTransactionBinding({ manifestPath, fsAdapter = fsp }) {
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_PATH_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }
  const source = await readOptionalText(journalPathFor(manifestPath), fsAdapter);
  if (source === null) return Object.freeze({ pending: false });

  let candidate;
  try {
    candidate = JSON.parse(source);
  } catch {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_JSON', TRANSACTION_PHASES.RECOVER);
  }
  if (candidate?.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && candidate.mode !== 'SCENE_RESOURCE_CONTINUATION_V1') {
    const journal = await parseTreeJournal(source, manifestPath);
    return Object.freeze({ pending: true, mode: 'tree', manifestPath, transactionId: journal.transactionId });
  }
  if (!candidate || ![JOURNAL_SCHEMA_VERSION, RESOURCE_JOURNAL_SCHEMA_VERSION, COMMENT_JOURNAL_SCHEMA_VERSION, ANCHOR_JOURNAL_SCHEMA_VERSION, NOTE_JOURNAL_SCHEMA_VERSION, MEDIA_JOURNAL_SCHEMA_VERSION, TREE_JOURNAL_SCHEMA_VERSION].includes(candidate.schemaVersion)) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_SCHEMA', TRANSACTION_PHASES.RECOVER);
  }
  if (candidate.manifestPath !== manifestPath || typeof candidate.scenePath !== 'string') {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_JOURNAL_PATH_MISMATCH', TRANSACTION_PHASES.RECOVER);
  }
  assertPathPair(candidate.scenePath, manifestPath);
  const journal = parseJournal(source, { scenePath: candidate.scenePath, manifestPath });
  return Object.freeze({
    pending: true,
    scenePath: journal.scenePath,
    manifestPath: journal.manifestPath,
    transactionId: journal.transactionId,
  });
}

async function publishManifestExact({ publishManifest, manifestPath, expectedText, nextText, revision, reason }) {
  if (expectedText === nextText) return;
  try {
    await publishManifest({ manifestPath, expectedText, nextText, revision, reason });
  } catch (error) {
    const detail = error && (error.code || error.message) ? (error.code || error.message) : String(error);
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_PUBLISH', TRANSACTION_PHASES.MANIFEST_PUBLISH, detail);
  }
}

async function publishSceneExact({ scenePath, expectedText, nextText, revision, fsAdapter = fsp }) {
  const current = await readOptionalText(scenePath, fsAdapter);
  if (current !== expectedText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_SCENE_CAS', TRANSACTION_PHASES.SCENE_PUBLISH);
  }
  if (nextText === null) {
    await removeDurably(scenePath, fsAdapter);
    return;
  }
  await durableSaveTransaction({ filePath: scenePath, content: nextText, revision, fsAdapter });
}

async function recoverProjectTransaction({ scenePath, manifestPath, publishManifest, verifyManifestContinuation, treeCohort, revalidate, fsAdapter = fsp }) {
  const treeSource = await readOptionalText(journalPathFor(manifestPath), fsAdapter);
  // A tree admission may fail before staging its journal. Its caller still
  // discharges recovery under the lease; no scene path exists for this mode.
  if (treeSource === null && treeCohort !== undefined) {
    treeNeed(treeCohort?.mode === 'PROJECT_TREE_COHORT_V1' && typeof revalidate === 'function'
      && typeof publishManifest === 'function', 'E_TREE_COHORT_AUTHORITY');
    await revalidate();
    return Object.freeze({ recovered: false, outcome: 'NO_JOURNAL', mode: 'tree' });
  }
  if (treeSource !== null) {
    let head; try { head = JSON.parse(treeSource); } catch { /* Existing parser reports malformed journal. */ }
    if (head?.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && head.mode !== 'SCENE_RESOURCE_CONTINUATION_V1') return recoverTreeCohort({ manifestPath, publishManifest, revalidate, fsAdapter, source: treeSource });
  }
  assertPathPair(scenePath, manifestPath);
  if (typeof publishManifest !== 'function') {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_AUTHORITY_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }
  const journalPath = journalPathFor(manifestPath);
  const source = await readOptionalText(journalPath, fsAdapter);
  if (source === null) return Object.freeze({ recovered: false, outcome: 'NO_JOURNAL' });
  const journal = parseJournal(source, { scenePath, manifestPath });
  await verifyRetainedResources(journal.retainedResources || [], scenePath, manifestPath, fsAdapter);
  if (journal.resources.length) {
    await assertResourceBoundary(scenePath, manifestPath, fsAdapter, resourceStagingPath({ path: scenePath }, journal.transactionId));
    await assertResourceBoundary(manifestPath, manifestPath, fsAdapter);
    await assertResourceBoundary(commitPathFor(scenePath), manifestPath, fsAdapter);
  }
  const mediaUpdate = journal.schemaVersion === MEDIA_JOURNAL_SCHEMA_VERSION || journal.mode === 'SCENE_RESOURCE_CONTINUATION_V1';
  const stagedResources = journal.resources.length ? [...journal.resources, ...(!mediaUpdate ? [{ path: scenePath, content: Buffer.from(journal.after.scene) }] : [])] : [];
  const currentManifest = await readOptionalText(manifestPath, fsAdapter);
  const currentScene = await readOptionalText(scenePath, fsAdapter);
  const commitState = await readCommitRecordState({
    scenePath,
    manifestPath,
    expectedJournal: journal,
    verifyManifestContinuation,
    fsAdapter,
  });
  if (commitState.status === 'CORRUPT') {
    await failCorruptCommit({
      manifestPath,
      journal,
      journalSource: source,
      commitState,
      currentScene,
      currentManifest,
      fsAdapter,
    });
  }
  const committed = commitState.status === 'VALID' && commitState.relation === 'CURRENT';
  // Classify all companions and their ownership before any recovery mutation.
  const resourceStates = await inspectResources(stagedResources, manifestPath, fsAdapter, journal.transactionId, !committed);
  await inspectCommentState(journal.commentState, manifestPath, fsAdapter);
  await inspectNoteState(journal.noteState, manifestPath, fsAdapter);
  const target = committed ? journal.after : journal.before;
  const manifestClass = classifyBytes(currentManifest, journal.before.manifest, journal.after.manifest);
  const sceneClass = classifyBytes(currentScene, journal.before.scene, journal.after.scene);
  if (manifestClass === 'OTHER' || sceneClass === 'OTHER') {
    throw new ProjectTransactionError(
      'E_PROJECT_TRANSACTION_RECOVERY_DIVERGENCE',
      TRANSACTION_PHASES.RECOVER,
      `manifest=${manifestClass} scene=${sceneClass}`,
    );
  }
  if (currentManifest !== target.manifest) {
    await publishManifestExact({
      publishManifest,
      manifestPath,
      expectedText: currentManifest,
      nextText: target.manifest,
      revision: journal.revision,
      reason: committed ? 'recover-committed' : 'recover-uncommitted',
    });
  }
  // Restore missing committed bytes before publishing a scene that references
  // them. Uncommitted rollback removes owned assets only after restoring scene.
  if (committed) for (let index = 0; index < journal.resources.length; index++) {
    if (resourceStates[index] === null) await publishResource(journal.resources[index], manifestPath, journal.revision, fsAdapter, journal.transactionId);
  }
  if (currentScene !== target.scene) {
    if (journal.resources.length && target.scene !== null) await ensureCompanionDirectory(scenePath, manifestPath, fsAdapter);
    if (journal.resources.length && !mediaUpdate && target.scene !== null) {
      await publishResource({ path: scenePath, content: Buffer.from(target.scene) }, manifestPath, journal.revision, fsAdapter, journal.transactionId);
    } else await publishSceneExact({
      scenePath,
      expectedText: currentScene,
      nextText: target.scene,
      revision: journal.revision,
      fsAdapter,
    });
  }
  for (let index = 0; index < journal.resources.length; index++) {
    const resource = journal.resources[index];
    if (!committed && resourceStates[index] !== null) {
      const observed = await readResource(resource, manifestPath, fsAdapter, journal.transactionId);
      if (!observed?.equals(resource.content)) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_DIVERGENCE', TRANSACTION_PHASES.RECOVER);
      await removeDurably(resource.path, fsAdapter);
    }
  }
  if (journal.commentState) await publishCommentState(journal.commentState, manifestPath,
    committed ? journal.commentState.afterText : journal.commentState.beforeText, journal.revision, fsAdapter);
  if (journal.noteState) await publishNoteState(journal.noteState, manifestPath,
    committed ? journal.noteState.afterText : journal.noteState.beforeText, journal.revision, fsAdapter);
  const finalResources = await inspectResources(journal.resources, manifestPath, fsAdapter, journal.transactionId);
  if (finalResources.some(bytes => committed ? bytes === null : bytes !== null)) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_READBACK', TRANSACTION_PHASES.RECOVER);
  }
  const finalManifest = await readOptionalText(manifestPath, fsAdapter);
  const finalScene = await readOptionalText(scenePath, fsAdapter);
  if (finalManifest !== target.manifest || finalScene !== target.scene) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RECOVERY_READBACK', TRANSACTION_PHASES.RECOVER);
  }
  await cleanupResourceStaging(stagedResources, manifestPath, fsAdapter, journal.transactionId);
  await removeDurably(journalPath, fsAdapter);
  return Object.freeze({
    recovered: true,
    outcome: committed ? 'COMMITTED_CONVERGED' : 'UNCOMMITTED_ROLLED_BACK',
    transactionId: journal.transactionId,
  });
}

async function commitProjectTransaction({
  scenePath,
  sceneContent,
  expectedSceneContent,
  manifestPath,
  manifestContent,
  expectedManifestContent,
  revision,
  publishManifest,
  verifyManifestContinuation,
  createResources,
  mediaUpdateResources,
  commentState: inputCommentState,
  noteState: inputNoteState,
  treeCohort,
  revalidate,
  afterTreeFilesPublish,
  fsAdapter = fsp,
}) {
  if (treeCohort !== undefined) return commitTreeCohort({ manifestPath, revision, treeCohort, publishManifest, revalidate, afterTreeFilesPublish, fsAdapter });
  assertPathPair(scenePath, manifestPath);
  assertText(sceneContent, 'E_PROJECT_TRANSACTION_SCENE_CONTENT', TRANSACTION_PHASES.ADMIT);
  if (expectedSceneContent !== null) {
    assertText(expectedSceneContent, 'E_PROJECT_TRANSACTION_EXPECTED_SCENE_CONTENT', TRANSACTION_PHASES.ADMIT);
  }
  assertText(manifestContent, 'E_PROJECT_TRANSACTION_MANIFEST_CONTENT', TRANSACTION_PHASES.ADMIT);
  assertText(expectedManifestContent, 'E_PROJECT_TRANSACTION_EXPECTED_MANIFEST_CONTENT', TRANSACTION_PHASES.ADMIT);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_REVISION', TRANSACTION_PHASES.ADMIT, String(revision));
  }
  if (typeof publishManifest !== 'function') {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_AUTHORITY_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }

  const mediaUpdate = mediaUpdateResources !== undefined;
  if (mediaUpdate && createResources !== undefined) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_MODE', TRANSACTION_PHASES.ADMIT);
  const inputResources = mediaUpdate ? mediaUpdateResources : createResources;
  const resources = inputResources === undefined ? [] : normalizeResources(inputResources, { scenePath, manifestPath });
  const commentState = normalizeCommentState(inputCommentState, scenePath, manifestPath, {
    before: { scene: expectedSceneContent, manifest: expectedManifestContent },
    after: { scene: sceneContent, manifest: manifestContent },
  });
  const noteState = normalizeNoteState(inputNoteState, scenePath, manifestPath, {
    before: { scene: expectedSceneContent, manifest: expectedManifestContent },
    after: { scene: sceneContent, manifest: manifestContent },
  });
  if (mediaUpdate) validateMediaUpdateResources(resources, { scenePath, manifestPath, before: expectedSceneContent, after: sceneContent, noteState });
  if (noteState && resources.some(entry => entry.path === noteStatePath(manifestPath))) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_STATE', TRANSACTION_PHASES.ADMIT);
  }
  if (commentState && ([COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(commentState.mode)
    ? (!mediaUpdate && resources.length !== 0)
    : !resources.length || resources.some(entry => entry.path === commentStatePath(manifestPath)))) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_STATE', TRANSACTION_PHASES.ADMIT);
  }
  if (resources.length && !mediaUpdate && expectedSceneContent !== null) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCES_CREATE_ONLY', TRANSACTION_PHASES.ADMIT);
  if (resources.length || [COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(commentState?.mode) || noteState) {
    await assertResourceBoundary(scenePath, manifestPath, fsAdapter);
    await assertResourceBoundary(manifestPath, manifestPath, fsAdapter);
    await assertResourceBoundary(commitPathFor(scenePath), manifestPath, fsAdapter);
  }

  const recovery = await recoverProjectTransaction({ scenePath, manifestPath, publishManifest, verifyManifestContinuation, fsAdapter });
  const observedScene = await readOptionalText(scenePath, fsAdapter);
  const observedManifest = await readOptionalText(manifestPath, fsAdapter);
  if (observedScene !== expectedSceneContent) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_SCENE_CAS', TRANSACTION_PHASES.ADMIT);
  }
  if (observedManifest !== expectedManifestContent) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_CAS', TRANSACTION_PHASES.ADMIT);
  }

  const before = { scene: expectedSceneContent, manifest: expectedManifestContent };
  const after = { scene: sceneContent, manifest: manifestContent };
  const retainedCommit = await readCommitRecordState({ scenePath, manifestPath, observedScene, observedManifest, verifyManifestContinuation, fsAdapter });
  let retainedResources = !mediaUpdate && retainedCommit.status === 'VALID'
    && retainedCommit.record.resources?.length ? normalizeRetainedResources(retainedCommit.record.resources, scenePath, manifestPath) : [];
  retainedResources = await consumeRestoredTreeAnnotationResources(retainedResources, scenePath, manifestPath, before, fsAdapter);
  if ([COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(commentState?.mode)) {
    // The independently recomputed anchor plan takes ownership of this one
    // mutable canonical file. Its current bytes remain bound by the existing
    // comment CAS, journal and recovery protocol; other import pins stay exact.
    if (await inspectCommentState(commentState, manifestPath, fsAdapter) !== commentState.beforeText) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_CAS', TRANSACTION_PHASES.ADMIT);
    }
    retainedResources = retainedResources.filter(entry => entry.path !== commentStatePath(manifestPath));
  }
  await verifyRetainedResources(retainedResources, scenePath, manifestPath, fsAdapter);
  for (const entry of resources) {
    if (await readResource(entry, manifestPath, fsAdapter) !== null) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_EXISTS', TRANSACTION_PHASES.ADMIT);
    }
  }
  if (commentState && await inspectCommentState(commentState, manifestPath, fsAdapter) !== commentState.beforeText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_CAS', TRANSACTION_PHASES.ADMIT);
  }
  if (noteState && await inspectNoteState(noteState, manifestPath, fsAdapter) !== noteState.beforeText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_CAS', TRANSACTION_PHASES.ADMIT);
  }
  const transactionId = transactionIdFor({ scenePath, manifestPath, revision, before, after, resources, retainedResources, commentState, noteState });
  const stagedResources = resources.length ? [...resources, ...(!mediaUpdate ? [{ path: scenePath, content: Buffer.from(sceneContent) }] : [])] : [];
  for (const entry of stagedResources) {
    if (await readResource({ path: resourceStagingPath(entry, transactionId) }, manifestPath, fsAdapter) !== null) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_STAGING_EXISTS', TRANSACTION_PHASES.ADMIT);
    }
  }
  const journal = {
    schemaVersion: retainedResources.length ? TREE_JOURNAL_SCHEMA_VERSION : mediaUpdate ? MEDIA_JOURNAL_SCHEMA_VERSION : noteState ? NOTE_JOURNAL_SCHEMA_VERSION : commentState ? commentJournalSchema(commentState) : resources.length ? RESOURCE_JOURNAL_SCHEMA_VERSION : JOURNAL_SCHEMA_VERSION,
    ...(retainedResources.length ? { mode: 'SCENE_RESOURCE_CONTINUATION_V1', retainedResources } : {}),
    transactionId,
    revision,
    scenePath,
    manifestPath,
    ...(commentState ? { commentState } : {}),
    ...(noteState ? { noteState } : {}),
    ...(resources.length ? { resources: resources.map(entry => ({ path: entry.path, contentBase64: entry.content.toString('base64') })) } : {}),
    before: {
      sceneBase64: encodeOptionalText(before.scene),
      manifestBase64: encodeOptionalText(before.manifest),
    },
    after: {
      sceneBase64: encodeOptionalText(after.scene),
      manifestBase64: encodeOptionalText(after.manifest),
    },
  };
  const priorCommitState = await readCommitRecordState({
    scenePath,
    manifestPath,
    observedScene,
    observedManifest,
    verifyManifestContinuation,
    fsAdapter,
  });
  if (priorCommitState.status === 'CORRUPT') {
    await failCorruptCommit({
      manifestPath,
      journal: { ...journal, before, after, resources, commentState, noteState },
      journalSource: null,
      commitState: priorCommitState,
      currentScene: observedScene,
      currentManifest: observedManifest,
      fsAdapter,
    });
  }
  const priorCommit = priorCommitState.status === 'VALID' ? priorCommitState.record : null;
  if (!resources.length && priorCommit
    && priorCommit.revision === revision
    && priorCommit.sceneDigest === sha256hex(after.scene)
    && priorCommit.manifestDigest === sha256hex(after.manifest)
    && priorCommit.scenePath === scenePath
    && priorCommit.manifestPath === manifestPath) {
    return Object.freeze({
      success: true,
      phases: TRANSACTION_PHASE_CHAIN,
      revision,
      transactionId: priorCommit.transactionId,
      sceneDigest: sha256hex(sceneContent),
      manifestDigest: sha256hex(manifestContent),
      recovery,
      idempotent: true,
    });
  }

  const journalPath = journalPathFor(manifestPath);
  await durableSaveTransaction({
    filePath: journalPath,
    content: `${JSON.stringify(journal)}\n`,
    revision,
    fsAdapter,
  });

  for (const entry of resources) await publishResource(entry, manifestPath, revision, fsAdapter, transactionId);
  if (resources.length) await ensureCompanionDirectory(scenePath, manifestPath, fsAdapter);

  await publishManifestExact({
    publishManifest,
    manifestPath,
    expectedText: before.manifest,
    nextText: after.manifest,
    revision,
    reason: 'project-transaction-publish',
  });
  if (resources.length && !mediaUpdate) {
    await publishResource({ path: scenePath, content: Buffer.from(sceneContent) }, manifestPath, revision, fsAdapter, transactionId);
    await inspectResources(stagedResources, manifestPath, fsAdapter, transactionId, true);
  } else await publishSceneExact({
    scenePath,
    expectedText: before.scene,
    nextText: after.scene,
    revision,
    fsAdapter,
  });

  if (commentState) await publishCommentState(commentState, manifestPath, commentState.afterText, revision, fsAdapter);
  if (noteState) await publishNoteState(noteState, manifestPath, noteState.afterText, revision, fsAdapter);
  const commitRecord = {
    schemaVersion: retainedResources.length ? TREE_COMMIT_SCHEMA_VERSION : mediaUpdate ? MEDIA_COMMIT_SCHEMA_VERSION : noteState ? NOTE_COMMIT_SCHEMA_VERSION : commentState ? commentCommitSchema(commentState) : resources.length ? RESOURCE_COMMIT_SCHEMA_VERSION : COMMIT_SCHEMA_VERSION,
    ...(commentState ? { commentState: commentBinding(commentState) } : {}),
    ...(noteState ? { noteState: noteBinding(noteState) } : {}),
    transactionId,
    revision,
    scenePath,
    manifestPath,
    sceneDigest: sha256hex(after.scene),
    manifestDigest: sha256hex(after.manifest),
    ...(resources.length || retainedResources.length ? { resources: [...retainedResources, ...resourceBindings(resources)] } : {}),
  };
  await durableSaveTransaction({
    filePath: commitPathFor(scenePath),
    content: `${JSON.stringify(commitRecord)}\n`,
    revision,
    fsAdapter,
  });

  const finalScene = await readOptionalText(scenePath, fsAdapter);
  await verifyRetainedResources(retainedResources, scenePath, manifestPath, fsAdapter);
  const finalManifest = await readOptionalText(manifestPath, fsAdapter);
  if ((await inspectResources(stagedResources, manifestPath, fsAdapter, transactionId)).some(bytes => bytes === null)) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_READBACK', TRANSACTION_PHASES.READBACK);
  }
  if (commentState && await inspectCommentState(commentState, manifestPath, fsAdapter) !== commentState.afterText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_READBACK', TRANSACTION_PHASES.READBACK);
  }
  if (noteState && await inspectNoteState(noteState, manifestPath, fsAdapter) !== noteState.afterText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_READBACK', TRANSACTION_PHASES.READBACK);
  }
  if (finalScene !== after.scene || finalManifest !== after.manifest) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_READBACK', TRANSACTION_PHASES.READBACK);
  }
  await cleanupResourceStaging(stagedResources, manifestPath, fsAdapter, transactionId);
  await removeDurably(journalPath, fsAdapter);

  return Object.freeze({
    success: true,
    phases: TRANSACTION_PHASE_CHAIN,
    revision,
    transactionId,
    sceneDigest: sha256hex(sceneContent),
    manifestDigest: sha256hex(manifestContent),
    recovery,
    idempotent: false,
  });
}

function decodePacketRole(packet, role) {
  const matches = Array.isArray(packet?.artifacts)
    ? packet.artifacts.filter((artifact) => artifact?.role === role)
    : [];
  if (matches.length !== 1) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER, role);
  }
  const artifact = matches[0];
  if (artifact.encoding !== 'base64' || typeof artifact.present !== 'boolean') {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER, role);
  }
  if (!artifact.present) {
    if (artifact.valueBase64 !== null || artifact.sha256 !== null || artifact.sizeBytes !== 0) {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER, role);
    }
    return null;
  }
  if (typeof artifact.valueBase64 !== 'string' || !isDigest(artifact.sha256)
    || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 0) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER, role);
  }
  const bytes = Buffer.from(artifact.valueBase64, 'base64');
  if (bytes.toString('base64') !== artifact.valueBase64
    || bytes.length !== artifact.sizeBytes || sha256hex(bytes) !== artifact.sha256) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_DIGEST', TRANSACTION_PHASES.RECOVER, role);
  }
  return bytes.toString('utf8');
}

function journalWireRecord(journal) {
  return {
    ...(journal.retainedResources?.length ? { mode: 'SCENE_RESOURCE_CONTINUATION_V1', retainedResources: journal.retainedResources } : {}),
    schemaVersion: journal.retainedResources?.length ? TREE_JOURNAL_SCHEMA_VERSION : journal.schemaVersion === MEDIA_JOURNAL_SCHEMA_VERSION ? MEDIA_JOURNAL_SCHEMA_VERSION : journal.noteState ? NOTE_JOURNAL_SCHEMA_VERSION : journal.commentState ? commentJournalSchema(journal.commentState) : journal.resources?.length ? RESOURCE_JOURNAL_SCHEMA_VERSION : JOURNAL_SCHEMA_VERSION,
    ...(journal.commentState ? { commentState: journal.commentState } : {}),
    ...(journal.noteState ? { noteState: journal.noteState } : {}),
    transactionId: journal.transactionId,
    revision: journal.revision,
    scenePath: journal.scenePath,
    manifestPath: journal.manifestPath,
    ...(journal.resources?.length ? { resources: journal.resources.map(entry => ({ path: entry.path, contentBase64: entry.content.toString('base64') })) } : {}),
    before: {
      sceneBase64: encodeOptionalText(journal.before.scene),
      manifestBase64: encodeOptionalText(journal.before.manifest),
    },
    after: {
      sceneBase64: encodeOptionalText(journal.after.scene),
      manifestBase64: encodeOptionalText(journal.after.manifest),
    },
  };
}

async function repairCorruptProjectCommit({
  scenePath,
  manifestPath,
  publishManifest,
  decision,
  authorityProof,
  verifyAuthorityProof,
  recoveryTransactionId,
  recoveryPacketDigest,
  fsAdapter = fsp,
}) {
  assertPathPair(scenePath, manifestPath);
  if (typeof publishManifest !== 'function') {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_MANIFEST_AUTHORITY_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }
  if (!['REPAIR_TO_AFTER', 'REPAIR_TO_BEFORE'].includes(decision)) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_REPAIR_DECISION', TRANSACTION_PHASES.ADMIT);
  }
  if (typeof verifyAuthorityProof !== 'function') {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_REPAIR_AUTHORITY_REQUIRED', TRANSACTION_PHASES.ADMIT);
  }

  const journalPath = journalPathFor(manifestPath);
  let journalSource = await readOptionalText(journalPath, fsAdapter);
  let journal;
  let syntheticJournal = false;
  let packetPath;
  let packetSource;
  if (journalSource === null) {
    if (!isDigest(recoveryTransactionId) || !isDigest(recoveryPacketDigest)) {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_REPAIR_RECOVERY_BINDING_REQUIRED', TRANSACTION_PHASES.RECOVER);
    }
    packetPath = recoveryPacketPathFor(manifestPath, recoveryTransactionId);
    packetSource = await readOptionalText(packetPath, fsAdapter);
    if (packetSource === null || sha256hex(packetSource) !== recoveryPacketDigest) {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_UNVERIFIED', TRANSACTION_PHASES.RECOVER);
    }
    let packet;
    try {
      packet = JSON.parse(packetSource);
    } catch {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER);
    }
    if (packetSource !== canonicalBytes(packet)
      || packet.schemaVersion !== RECOVERY_PACKET_SCHEMA_VERSION
      || packet.capabilityId !== PROJECT_COMMIT_REPAIR_CAPABILITY_ID
      || packet.binding?.transactionId !== recoveryTransactionId
      || !Number.isSafeInteger(packet.binding?.revision) || packet.binding.revision < 0) {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER);
    }
    const before = {
      scene: decodePacketRole(packet, 'BEFORE_SCENE'),
      manifest: decodePacketRole(packet, 'BEFORE_MANIFEST'),
    };
    const after = {
      scene: decodePacketRole(packet, 'AFTER_SCENE'),
      manifest: decodePacketRole(packet, 'AFTER_MANIFEST'),
    };
    const commentState = normalizeCommentState(packet.commentState, scenePath, manifestPath, { before, after });
    const noteState = normalizeNoteState(packet.noteState, scenePath, manifestPath, { before, after });
    const resources = packet.companionResources === undefined ? [] : normalizeResources(packet.companionResources, { scenePath, manifestPath }, true);
    const continuation = packet.resourceMode === 'SCENE_RESOURCE_CONTINUATION_V1';
    const retainedResources = continuation ? normalizeRetainedResources(packet.retainedResources, scenePath, manifestPath) : [];
    if (!continuation && packet.retainedResources !== undefined) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_MODE', TRANSACTION_PHASES.RECOVER);
    const mediaUpdate = packet.resourceMode === 'MEDIA_UPDATE_V1' || continuation;
    if (packet.resourceMode !== undefined && !mediaUpdate) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_MODE', TRANSACTION_PHASES.RECOVER);
    if (mediaUpdate && resources.length) validateMediaUpdateResources(resources, { scenePath, manifestPath, before: before.scene, after: after.scene, noteState });
    if (!mediaUpdate && [COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(commentState?.mode) && packet.companionResources !== undefined) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_STATE', TRANSACTION_PHASES.RECOVER);
    }
    if (before.manifest === null || after.scene === null || after.manifest === null) {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_SHAPE', TRANSACTION_PHASES.RECOVER);
    }
    journal = {
      schemaVersion: continuation ? TREE_JOURNAL_SCHEMA_VERSION : mediaUpdate ? MEDIA_JOURNAL_SCHEMA_VERSION : noteState ? NOTE_JOURNAL_SCHEMA_VERSION : commentState ? commentJournalSchema(commentState) : resources.length ? RESOURCE_JOURNAL_SCHEMA_VERSION : JOURNAL_SCHEMA_VERSION,
      ...(continuation ? { mode: 'SCENE_RESOURCE_CONTINUATION_V1', retainedResources } : {}),
      transactionId: recoveryTransactionId,
      revision: packet.binding.revision,
      scenePath,
      manifestPath,
      before,
      after,
      resources,
      commentState,
      noteState,
    };
    if (transactionIdFor({ scenePath, manifestPath, revision: journal.revision, before, after, resources, retainedResources, commentState, noteState }) !== recoveryTransactionId) {
      throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_BINDING', TRANSACTION_PHASES.RECOVER);
    }
    syntheticJournal = true;
  } else {
    journal = parseJournal(journalSource, { scenePath, manifestPath });
    packetPath = recoveryPacketPathFor(manifestPath, journal.transactionId);
    packetSource = await readOptionalText(packetPath, fsAdapter);
  }
  const currentScene = await readOptionalText(scenePath, fsAdapter);
  const currentManifest = await readOptionalText(manifestPath, fsAdapter);
  const commitState = await readCommitRecordState({
    scenePath,
    manifestPath,
    expectedJournal: journal,
    fsAdapter,
  });
  if (commitState.status !== 'CORRUPT') {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_REPAIR_CONTEXT_CHANGED', TRANSACTION_PHASES.RECOVER);
  }

  const expectedPacket = buildRecoveryPacket({
    journal,
    journalSource,
    commitState,
    currentScene,
    currentManifest,
  });
  const expectedBytes = canonicalBytes(expectedPacket);
  const packetDigest = sha256hex(expectedBytes);
  if (packetSource === null || packetSource !== expectedBytes) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_UNVERIFIED', TRANSACTION_PHASES.RECOVER);
  }
  if (recoveryPacketDigest !== undefined && recoveryPacketDigest !== packetDigest) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_RECOVERY_PACKET_UNVERIFIED', TRANSACTION_PHASES.RECOVER);
  }

  let authorized = false;
  try {
    authorized = await verifyAuthorityProof(Object.freeze({
      capabilityId: PROJECT_COMMIT_REPAIR_CAPABILITY_ID,
      packetDigest,
      transactionId: journal.transactionId,
      decision,
      authorityProof,
    }));
  } catch {
    authorized = false;
  }
  if (authorized !== true) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_REPAIR_AUTHORITY_REQUIRED', TRANSACTION_PHASES.RECOVER);
  }
  await inspectResources(journal.resources, manifestPath, fsAdapter, journal.transactionId);
  await inspectCommentState(journal.commentState, manifestPath, fsAdapter);
  await inspectNoteState(journal.noteState, manifestPath, fsAdapter);

  const [journalReadback, commitReadback, sceneReadback, manifestReadback] = await Promise.all([
    readOptionalText(journalPath, fsAdapter),
    readOptionalText(commitPathFor(scenePath), fsAdapter),
    readOptionalText(scenePath, fsAdapter),
    readOptionalText(manifestPath, fsAdapter),
  ]);
  if (journalReadback !== journalSource || commitReadback !== commitState.source
    || sceneReadback !== currentScene || manifestReadback !== currentManifest) {
    throw new ProjectTransactionError('E_PROJECT_COMMIT_REPAIR_CONTEXT_CHANGED', TRANSACTION_PHASES.RECOVER);
  }

  await verifyRetainedResources(journal.retainedResources || [], scenePath, manifestPath, fsAdapter);
  if (syntheticJournal) {
    journalSource = `${JSON.stringify(journalWireRecord(journal))}\n`;
    await durableSaveTransaction({
      filePath: journalPath,
      content: journalSource,
      revision: journal.revision,
      fsAdapter,
    });
  }

  if (decision === 'REPAIR_TO_BEFORE') {
    await removeDurably(commitPathFor(scenePath), fsAdapter);
  } else {
    const commitPath = commitPathFor(scenePath);
    const commitRecord = {
      schemaVersion: journal.retainedResources?.length ? TREE_COMMIT_SCHEMA_VERSION : journal.schemaVersion === MEDIA_JOURNAL_SCHEMA_VERSION ? MEDIA_COMMIT_SCHEMA_VERSION : journal.noteState ? NOTE_COMMIT_SCHEMA_VERSION : journal.commentState ? commentCommitSchema(journal.commentState) : journal.resources.length ? RESOURCE_COMMIT_SCHEMA_VERSION : COMMIT_SCHEMA_VERSION,
      ...(journal.commentState ? { commentState: commentBinding(journal.commentState) } : {}),
      ...(journal.noteState ? { noteState: noteBinding(journal.noteState) } : {}),
      transactionId: journal.transactionId,
      revision: journal.revision,
      scenePath,
      manifestPath,
      sceneDigest: sha256hex(journal.after.scene),
      manifestDigest: sha256hex(journal.after.manifest),
      ...(journal.resources.length || journal.retainedResources?.length ? { resources: [...(journal.retainedResources || []), ...resourceBindings(journal.resources)] } : {}),
    };
    await durableSaveTransaction({
      filePath: commitPath,
      content: `${JSON.stringify(commitRecord)}\n`,
      revision: journal.revision,
      fsAdapter,
    });
  }
  const recovery = await recoverProjectTransaction({ scenePath, manifestPath, publishManifest, fsAdapter });
  return Object.freeze({
    repaired: true,
    decision,
    outcome: recovery.outcome,
    capabilityId: PROJECT_COMMIT_REPAIR_CAPABILITY_ID,
    packetDigest,
    transactionId: journal.transactionId,
    recoveryPacketRetained: true,
  });
}

// Readback of a committed create transaction is independent of the import
// receipt's own assertions. Every recorded companion must still match bytes.
async function readVerifiedProjectTransaction({ scenePath, manifestPath, verifyManifestContinuation, fsAdapter = fsp }) {
  assertPathPair(scenePath, manifestPath);
  if (await readOptionalText(journalPathFor(manifestPath), fsAdapter) !== null) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RECOVERY_REQUIRED', TRANSACTION_PHASES.READBACK);
  }
  const state = await readCommitRecordState({ scenePath, manifestPath,
    observedScene: await readOptionalText(scenePath, fsAdapter),
    observedManifest: await readOptionalText(manifestPath, fsAdapter), verifyManifestContinuation, fsAdapter });
  if (state.status !== 'VALID') throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMIT_READBACK', TRANSACTION_PHASES.READBACK);
  if (state.record.resources) {
    normalizeResources(state.record.resources.map(entry => ({ path: entry.path, content: '' })), { scenePath, manifestPath });
    let total = 0;
    for (const entry of state.record.resources) {
      total += entry.bytes;
      if (total > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.READBACK);
      const content = await readResource(entry, manifestPath, fsAdapter);
      if (content === null || content.length !== entry.bytes || sha256hex(content) !== entry.digest) {
        throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_READBACK', TRANSACTION_PHASES.READBACK);
      }
    }
  }
  if (state.record.commentState) {
    const value = await readResource({ path: commentStatePath(manifestPath) }, manifestPath, fsAdapter);
    if (value === null || sha256hex(value) !== state.record.commentState.afterDigest) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_READBACK', TRANSACTION_PHASES.READBACK);
    }
  }
  if (state.record.noteState) {
    const value = await readResource({ path: noteStatePath(manifestPath) }, manifestPath, fsAdapter);
    if (value === null || sha256hex(value) !== state.record.noteState.afterDigest) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_READBACK', TRANSACTION_PHASES.READBACK);
    }
  }
  return Object.freeze({ ...state.record });
}

function classifyProjectTransactionState({ scenePath, manifestPath }) {
  assertPathPair(scenePath, manifestPath);
  const commitPath = commitPathFor(scenePath);
  if (!fs.existsSync(commitPath)) return { classification: 'NO_COMMIT_RECORD' };
  let record;
  try {
    record = JSON.parse(fs.readFileSync(commitPath, 'utf8'));
  } catch {
    return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'COMMIT_RECORD_INVALID' };
  }
  if (!record || ![COMMIT_SCHEMA_VERSION, RESOURCE_COMMIT_SCHEMA_VERSION, COMMENT_COMMIT_SCHEMA_VERSION, ANCHOR_COMMIT_SCHEMA_VERSION, NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || record.scenePath !== scenePath || record.manifestPath !== manifestPath) {
    return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'COMMIT_RECORD_BINDING' };
  }
  if (!fs.existsSync(scenePath) || !fs.existsSync(manifestPath)) {
    return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'ARTIFACT_MISSING' };
  }
  const sceneDigest = sha256hex(fs.readFileSync(scenePath));
  const manifestDigest = sha256hex(fs.readFileSync(manifestPath));
  if (sceneDigest !== record.sceneDigest || manifestDigest !== record.manifestDigest) {
    return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'ARTIFACT_DIGEST_MISMATCH' };
  }
  if ([RESOURCE_COMMIT_SCHEMA_VERSION, COMMENT_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || (record.schemaVersion === NOTE_COMMIT_SCHEMA_VERSION && record.resources !== undefined)) {
    try {
      normalizeResources(record.resources.map(entry => ({ path: entry.path, content: '' })), { scenePath, manifestPath });
      let total = 0;
      for (const entry of record.resources) {
        if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !isDigest(entry.digest)) throw Error('RESOURCE_SHAPE');
        total += entry.bytes;
        if (total > MAX_RESOURCE_BYTES) throw Error('RESOURCE_BUDGET');
        let current = path.dirname(manifestPath);
        for (const part of path.relative(current, entry.path).split(path.sep)) {
          current = path.join(current, part);
          const stat = fs.lstatSync(current);
          if (stat.isSymbolicLink() || (current === entry.path
            ? !stat.isFile() || stat.nlink !== 1 || stat.size !== entry.bytes : !stat.isDirectory())) throw Error('RESOURCE_BOUNDARY');
        }
        if (sha256hex(fs.readFileSync(entry.path)) !== entry.digest) throw Error('RESOURCE_DIGEST');
      }
    } catch { return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'RESOURCE_BINDING_MISMATCH' }; }
  }
  if ([COMMENT_COMMIT_SCHEMA_VERSION, ANCHOR_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || ([NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion) && record.commentState !== undefined)) {
    try {
      const target = commentStatePath(manifestPath);
      let current = path.dirname(manifestPath);
      for (const part of path.relative(current, target).split(path.sep)) {
        current = path.join(current, part); const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || (current === target ? !stat.isFile() || stat.nlink !== 1 || stat.size > 65536 : !stat.isDirectory())) throw Error('BOUNDARY');
      }
      if (!isDigest(record.commentState?.beforeDigest) || !isDigest(record.commentState?.afterDigest)
        || sha256hex(fs.readFileSync(target)) !== record.commentState.afterDigest) throw Error('DIGEST');
    } catch { return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'COMMENT_BINDING_MISMATCH' }; }
  }
  if (record.schemaVersion === NOTE_COMMIT_SCHEMA_VERSION || (record.schemaVersion === MEDIA_COMMIT_SCHEMA_VERSION && record.noteState !== undefined)) {
    try {
      const target = noteStatePath(manifestPath), stat = fs.lstatSync(target);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > 4 * 1024 * 1024
        || !record.noteState || (record.noteState.beforeDigest !== null && !isDigest(record.noteState.beforeDigest))
        || !isDigest(record.noteState.afterDigest)
        || !['MANUSCRIPT_POINT_REBASE_V1', 'MANUSCRIPT_IMPORT_V1', 'MANUSCRIPT_BODY_UPDATE_V1'].includes(record.noteState.mode)
        || sha256hex(fs.readFileSync(target)) !== record.noteState.afterDigest) throw Error('NOTE_BINDING');
    } catch { return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'NOTE_BINDING_MISMATCH' }; }
  } else if (record.noteState !== undefined) {
    return { classification: 'PARTIAL_CORRUPTION_DETECTED', reason: 'NOTE_SCHEMA' };
  }
  return { classification: 'NEW_COMMITTED', record };
}

// Tree cohorts are a typed extension of this journal, not a second writer.
// All paths and semantic changes are regenerated by the pure Core planner.
const treeModel = () => import('./project-tree-cohort-v1.mjs');
const treeError = code => { throw new ProjectTransactionError(code, TRANSACTION_PHASES.ADMIT); };
const treeNeed = (ok, code) => { if (!ok) treeError(code); };
const treeB64 = value => value === null ? null : Buffer.from(value).toString('base64');
const treeText = value => value === null ? null : Buffer.from(value, 'base64').toString('utf8');
async function treeRead(target, manifestPath, fsAdapter) {
  await assertResourceBoundary(target, manifestPath, fsAdapter);
  try { return (await fsAdapter.readFile(target)).toString('base64'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function treeAbsolute(manifestPath, relative) {
  treeNeed(typeof relative === 'string' && !path.isAbsolute(relative) && !/[\\\x00-\x1f]/u.test(relative)
    && relative.split('/').every(p => p && p !== '.' && p !== '..'), 'E_TREE_COHORT_PATH');
  return path.join(path.dirname(manifestPath), relative);
}
async function treeDirectoryState(target, manifestPath, fsAdapter) {
  // A final directory cannot use the file-only companion boundary helper.
  await assertResourceBoundary(path.join(target, '.wp201-boundary-probe'), manifestPath, fsAdapter);
  try { const stat = await fsAdapter.lstat(target); treeNeed(stat.isDirectory() && !stat.isSymbolicLink(), 'E_TREE_COHORT_DIRECTORY'); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
// Only the new structural operation owns annotation rebinding. Historical
// move/copy packets must regenerate byte-for-byte with their original receipts.
function hasStructuralAnnotationCohort(plan) {
  return Array.isArray(plan.scenePartitions) || Boolean(plan.input?.recoveredCopy?.sourceNodeId)
    || plan.kind === 'undo' && Boolean(plan.input?.retainedPacket?.plan?.input?.recoveredCopy?.sourceNodeId);
}
function treeManagedAnnotationEntries(plan, manifestPath) {
  const managed = new Map();
  if (!hasStructuralAnnotationCohort(plan)) return managed;
  for (const [role, relativePath, target] of [
    ['notes', 'notes.craftsman.json', noteStatePath(manifestPath)],
    ['comments', '.yalken/word-review/non-text-return-state.v1.json', commentStatePath(manifestPath)],
  ]) {
    const matches = plan.entries.filter(entry => entry.role === role && entry.relativePath === relativePath);
    treeNeed(matches.length === 1, 'E_TREE_COHORT_ANNOTATION_BINDING');
    const entry = matches[0];
    // An absent canonical owner cannot discharge a historical resource proof.
    if (entry.beforeBase64 === null || entry.afterBase64 === null) continue;
    for (const encoded of new Set([entry.beforeBase64, entry.afterBase64])) {
      const raw = treeText(encoded);
      if (role === 'notes') validateManuscriptDocument(JSON.parse(raw), plan.projectId);
      else readCanonicalCommentState(raw, plan.projectId);
    }
    managed.set(target, entry);
  }
  return managed;
}
async function consumeRestoredTreeAnnotationResources(resources, scenePath, manifestPath, before, fsAdapter) {
  if (!resources.some(entry => [noteStatePath(manifestPath), commentStatePath(manifestPath)].includes(entry.path))) return resources;
  const state = await readVerifiedProjectTreeMutation({ manifestPath, fsAdapter });
  if (state.receipt?.kind !== 'undo' || !hasStructuralAnnotationCohort(state.retainedPacket.plan)) return resources;
  const packet = state.retainedPacket;
  treeNeed(packet.plan.manifestText === before.manifest, 'E_TREE_COHORT_ANNOTATION_BINDING');
  const relativePath = path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/');
  const scene = packet.entries.find(entry => entry.role === 'scene' && entry.relativePath === relativePath);
  treeNeed(scene?.afterBase64 === treeB64(before.scene), 'E_TREE_COHORT_ANNOTATION_BINDING');
  const managed = treeManagedAnnotationEntries(packet.plan, manifestPath);
  for (const [target, entry] of managed) treeNeed(await treeRead(target, manifestPath, fsAdapter) === entry.afterBase64, 'E_TREE_COHORT_ANNOTATION_CAS');
  return resources.filter(entry => !managed.has(entry.path));
}
async function inspectTreePacket(packet, manifestPath, fsAdapter, requireSide = null) {
  const managed = treeManagedAnnotationEntries(packet.plan, manifestPath);
  const stagedMedia = new Set(packet.plan.entries.filter(entry=>entry.role==='storyMedia').map(entry=>treeAbsolute(manifestPath,entry.relativePath)));
  for (const entry of packet.entries.filter(e => e.role === 'sceneCommit' && e.relativePath.endsWith('.wp201-commit.json'))) {
    for (const raw of new Set([entry.beforeBase64, entry.afterBase64].filter(Boolean))) {
      let record; try { record = JSON.parse(treeText(raw)); } catch { treeError('E_TREE_COHORT_COMMIT_INVALID'); }
      const resources = record.resources || [];
      if (resources.length) normalizeRetainedResources(resources, record.scenePath, manifestPath);
      await verifyRetainedResources(resources.filter(resource => !managed.has(resource.path) && !stagedMedia.has(resource.path)), record.scenePath, manifestPath, fsAdapter);
    }
  }
  const observed = [];
  for (const entry of packet.entries) {
    const actual = await treeRead(treeAbsolute(manifestPath, entry.relativePath), manifestPath, fsAdapter);
    treeNeed(actual === entry.beforeBase64 || actual === entry.afterBase64, 'E_TREE_COHORT_UNKNOWN_BYTES');
    if (requireSide) treeNeed(actual === entry[`${requireSide}Base64`], 'E_TREE_COHORT_CAS');
    observed.push(actual);
  }
  for (const directory of packet.plan.directories) {
    const absolute = treeAbsolute(manifestPath, directory.relativePath);
    const present = await treeDirectoryState(absolute, manifestPath, fsAdapter);
    treeNeed(present === directory.before || present === directory.after, 'E_TREE_COHORT_DIRECTORY_CAS');
    if (requireSide) treeNeed(present === directory[requireSide], 'E_TREE_COHORT_DIRECTORY_CAS');
    if (!present) continue;
    const allowed = new Set([...packet.entries.map(e => e.relativePath), ...packet.plan.directories.map(d => d.relativePath)]
      .filter(relative => path.posix.dirname(relative) === directory.relativePath).map(relative => path.posix.basename(relative)));
    // backups also contains project-wide manual/recovery histories outside
    // this cohort; only owned path-hash folders are enumerated and mutated.
    if (directory.relativePath !== 'backups') for (const name of await fsAdapter.readdir(absolute)) treeNeed(allowed.has(name), 'E_TREE_COHORT_FOREIGN_ENTRY');
  }
  const manifest = await readOptionalText(manifestPath, fsAdapter);
  treeNeed(manifest === packet.plan.beforeManifestText || manifest === packet.plan.manifestText, 'E_TREE_COHORT_MANIFEST_CAS');
  if (requireSide) treeNeed(manifest === (requireSide === 'before' ? packet.plan.beforeManifestText : packet.plan.manifestText), 'E_TREE_COHORT_MANIFEST_CAS');
  return observed;
}
function buildTreeEntries(plan, manifestPath, revision, transactionId) {
  const entries = plan.entries.map(entry => ({ ...entry }));
  if (plan.kind === 'undo') return entries;
  const byPath = new Map(entries.map(entry => [entry.relativePath, entry]));
  const managed = treeManagedAnnotationEntries(plan, manifestPath);
  // Every retained scene receipt must describe its new current manifest. This
  // also avoids invalidating an unrelated scene's global annotation digest.
  for (const scene of entries.filter(entry => entry.role === 'scene' && entry.afterBase64 !== null)) {
    const relative = scene.relativePath + '.wp201-commit.json';
    let commit = byPath.get(relative), previous = null;
    const originalPath = plan.affectedScenes.find(item => item.to === scene.relativePath)?.from || scene.relativePath;
    const recovery = plan.recoverySource && plan.affectedScenes.some(item => item.copy && item.to === scene.relativePath) ? plan.recoverySource : null;
    const sourcePaths = plan.sceneReceiptSources?.find(row => row.targetRelativePath === scene.relativePath)?.sourceRelativePaths || [originalPath];
    const resources = new Map(); let hasResourceProof = false;
    for (const sourcePath of sourcePaths) {
      const previousEntry = recovery ? { beforeBase64: recovery.commitBase64 } : byPath.get(sourcePath + '.wp201-commit.json');
      previous = null;
      if (previousEntry?.beforeBase64) {
        try { previous = JSON.parse(treeText(previousEntry.beforeBase64)); } catch { treeError('E_TREE_COHORT_COMMIT_INVALID'); }
        treeNeed([COMMIT_SCHEMA_VERSION, RESOURCE_COMMIT_SCHEMA_VERSION, COMMENT_COMMIT_SCHEMA_VERSION,
          ANCHOR_COMMIT_SCHEMA_VERSION, NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION, TREE_COMMIT_SCHEMA_VERSION].includes(previous.schemaVersion)
          && previous.scenePath === treeAbsolute(manifestPath, recovery ? recovery.relativePath : sourcePath)
          && previous.manifestPath === manifestPath && previous.sceneDigest === sha256hex(Buffer.from(recovery ? recovery.originalBase64 : byPath.get(sourcePath).beforeBase64, 'base64'))
          && isDigest(previous.transactionId), 'E_TREE_COHORT_COMMIT_INVALID');
        if (previous.resources) hasResourceProof = true;
        for (const resource of previous.resources || []) {
          if (managed.has(resource.path)) continue;
          treeNeed(!resources.has(resource.path) || canonicalize(resources.get(resource.path)) === canonicalize(resource), 'E_TREE_COHORT_RESOURCE_CONFLICT');
          resources.set(resource.path, resource);
        }
      }
    }
    if (plan.kind === 'story-bodies') {
      const parsed = require('./document-content-envelope-v1.cjs').parseObservablePayload(treeText(scene.afterBase64));
      const registry = require('./word-stories-v1.cjs').read(parsed.doc);
      const assets = require('../io/documentMedia.js').documentMedia({type:'doc',content:registry?.stories.flatMap(story=>story.body.content) || []}).assets;
      for(const asset of assets) {
        const target=treeAbsolute(manifestPath,asset.attrs.assetPath), staged=byPath.get(asset.attrs.assetPath);
        if(staged) treeNeed(staged.role==='storyMedia' && staged.afterBase64===asset.attrs.dataBase64,'E_TREE_COHORT_RESOURCE_CONFLICT');
        resources.set(target,{path:target,digest:sha256hex(asset.bytes),bytes:asset.bytes.length});
      }
    }
    const note = entries.find(entry => entry.role === 'notes'), comment = entries.find(entry => entry.role === 'comments');
    const record = { schemaVersion: TREE_COMMIT_SCHEMA_VERSION, transactionId, revision,
      scenePath: treeAbsolute(manifestPath, scene.relativePath), manifestPath,
      sceneDigest: sha256hex(Buffer.from(scene.afterBase64, 'base64')), manifestDigest: sha256hex(plan.manifestText),
      ...(resources.size || hasResourceProof && !managed.size ? { resources: [...resources.values()] } : {}),
      ...(note && note.afterBase64 !== null ? { noteState: { mode: 'PROJECT_TREE_COHORT_V1', beforeDigest: digestOptional(treeText(note.beforeBase64)), afterDigest: sha256hex(Buffer.from(note.afterBase64, 'base64')) } } : {}),
      ...(comment && comment.afterBase64 !== null ? { commentState: { mode: 'PROJECT_TREE_COHORT_V1', beforeDigest: sha256hex(treeText(comment.beforeBase64) || ''), afterDigest: sha256hex(Buffer.from(comment.afterBase64, 'base64')) } } : {}) };
    if (!commit) { commit = { relativePath: relative, role: 'sceneCommit', beforeBase64: null, afterBase64: null }; entries.push(commit); byPath.set(relative, commit); }
    commit.afterBase64 = treeB64(canonicalBytes(record));
  }
  return entries.sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
}
async function validateTreePacket(packet, manifestPath) {
  const model = await treeModel();
  treeNeed(packet?.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && packet.manifestPath === manifestPath
    && typeof packet.projectId === 'string' && packet.projectId === packet.plan?.projectId
    && Number.isSafeInteger(packet.revision) && packet.revision >= 0, 'E_TREE_COHORT_JOURNAL');
  model.validateProjectTreeCohort(packet.plan);
  const id = sha256hex(`${packet.projectId}\n${packet.plan.planDigest}\n${packet.revision}`);
  treeNeed(packet.transactionId === id && canonicalize(packet.entries) === canonicalize(buildTreeEntries(packet.plan, manifestPath, packet.revision, id)), 'E_TREE_COHORT_JOURNAL_BINDING');
  if (packet.plan.kind === 'undo') await validateTreePacket(packet.plan.input.retainedPacket, manifestPath);
  if (packet.plan.input.recoveredCopy) await validateTreePacket(packet.plan.input.recoveredCopy.retainedPacket, manifestPath);
  treeNeed(Buffer.byteLength(canonicalize(packet)) <= MAX_ARTIFACT_BYTES, 'E_TREE_COHORT_BUDGET');
  return packet;
}
async function parseTreeJournal(source, manifestPath) {
  treeNeed(typeof source === 'string' && Buffer.byteLength(source) <= MAX_ARTIFACT_BYTES, 'E_TREE_COHORT_BUDGET');
  let journal; try { journal = JSON.parse(source); } catch { treeError('E_TREE_COHORT_JOURNAL'); }
  await validateTreePacket(journal.packet, manifestPath);
  treeNeed(journal.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && journal.transactionId === journal.packet.transactionId
    && journal.manifestPath === manifestPath && (journal.previousReceiptText === null || typeof journal.previousReceiptText === 'string'), 'E_TREE_COHORT_JOURNAL');
  const receipt = JSON.parse(journal.receiptText);
  const model = await treeModel();
  treeNeed(receipt.schemaVersion === TREE_RECEIPT_SCHEMA_VERSION && receipt.projectId === journal.packet.projectId
    && receipt.transactionId === journal.transactionId && receipt.packetDigest === model.projectTreeCohortDigest(journal.packet)
    && receipt.treeRevision === journal.packet.plan.expectedTreeRevision + 1 && receipt.kind === journal.packet.plan.kind, 'E_TREE_COHORT_RECEIPT');
  return journal;
}
async function publishTreeSide(packet, side, { manifestPath, publishManifest, revalidate, fsAdapter }) {
  await revalidate();
  const orderedDirs = [...packet.plan.directories].sort((a,b)=>a.relativePath.split('/').length-b.relativePath.split('/').length);
  for (const dir of orderedDirs.filter(d=>d[side])) {
    const target = treeAbsolute(manifestPath, dir.relativePath);
    await treeDirectoryState(target, manifestPath, fsAdapter);
    await revalidate(); await fsAdapter.mkdir(target, { recursive: true }); await fsyncDirectory(path.dirname(target), fsAdapter);
  }
  const manifestCurrent = await readOptionalText(manifestPath, fsAdapter);
  const manifestTarget = side === 'before' ? packet.plan.beforeManifestText : packet.plan.manifestText;
  await revalidate();
  if (manifestCurrent !== manifestTarget) await publishManifestExact({ publishManifest, manifestPath, expectedText: manifestCurrent,
    nextText: manifestTarget, revision: packet.revision, reason: `project-tree-cohort-${side}` });
  // The journal holds every original byte, so overlapping rename targets are
  // written from the immutable cohort rather than from already moved paths.
  for (const entry of packet.entries) {
    const target = treeAbsolute(manifestPath, entry.relativePath), next = entry[`${side}Base64`];
    const current = await treeRead(target, manifestPath, fsAdapter);
    treeNeed(current === entry.beforeBase64 || current === entry.afterBase64, 'E_TREE_COHORT_UNKNOWN_BYTES');
    if (current === next) continue;
    await revalidate();
    if (next === null) await removeDurably(target, fsAdapter);
    else {
      await fsAdapter.mkdir(path.dirname(target), { recursive: true });
      await durableSaveTransaction({ filePath: target, content: Buffer.from(next, 'base64'), revision: packet.revision, fsAdapter });
    }
  }
  for (const dir of orderedDirs.reverse().filter(d=>!d[side])) {
    const target = treeAbsolute(manifestPath, dir.relativePath);
    if (!(await treeDirectoryState(target, manifestPath, fsAdapter))) continue;
    treeNeed((await fsAdapter.readdir(target)).length === 0, 'E_TREE_COHORT_FOREIGN_ENTRY');
    await revalidate(); await fsAdapter.rmdir(target); await fsyncDirectory(path.dirname(target), fsAdapter);
  }
  await inspectTreePacket(packet, manifestPath, fsAdapter, side);
}
async function persistTreePacket(packet, fsAdapter) {
  const target = recoveryPacketPathFor(packet.manifestPath, packet.transactionId);
  await assertResourceBoundary(target, packet.manifestPath, fsAdapter);
  const bytes = canonicalBytes(packet), current = await readOptionalText(target, fsAdapter);
  treeNeed(current === null || current === bytes, 'E_TREE_COHORT_PACKET_CONFLICT');
  if (current === null) {
    await fsAdapter.mkdir(path.dirname(target), { recursive: true }); await fsyncDirectory(path.dirname(path.dirname(target)), fsAdapter);
    await durableSaveTransaction({ filePath: target, content: bytes, revision: packet.revision, fsAdapter });
  }
}
async function preserveTreeConflict(journal, error, fsAdapter) {
  // Original packet remains immutable and readable even when foreign bytes
  // prevent automatic recovery. The live journal also remains in place.
  await persistTreePacket(journal.packet, fsAdapter);
  error.recoveryPacketPath = recoveryPacketPathFor(journal.manifestPath, journal.transactionId);
  error.automaticRepairForbidden = true;
  throw error;
}
async function recoverTreeCohort({ manifestPath, publishManifest, revalidate, fsAdapter, source }) {
  treeNeed(typeof revalidate === 'function' && typeof publishManifest === 'function', 'E_TREE_COHORT_AUTHORITY');
  const journal = await parseTreeJournal(source, manifestPath);
  await revalidate();
  const currentReceipt = await readOptionalText(treeCommitPathFor(manifestPath), fsAdapter);
  const committed = currentReceipt === journal.receiptText;
  try {
    treeNeed(committed || currentReceipt === journal.previousReceiptText, 'E_TREE_COHORT_COMMIT_CONFLICT');
    await inspectTreePacket(journal.packet, manifestPath, fsAdapter);
    await publishTreeSide(journal.packet, committed ? 'after' : 'before', { manifestPath, publishManifest, revalidate, fsAdapter });
    if (committed) await persistTreePacket(journal.packet, fsAdapter);
    await revalidate(); await removeDurably(journalPathFor(manifestPath), fsAdapter);
    return { recovered: true, outcome: committed ? 'COMMITTED_ROLLED_FORWARD' : 'UNCOMMITTED_ROLLED_BACK', transactionId: journal.transactionId, mode: 'tree' };
  } catch (error) { return preserveTreeConflict(journal, error, fsAdapter); }
}
async function readVerifiedProjectTreeMutation({ manifestPath, projectId, fsAdapter = fsp }) {
  treeNeed(typeof manifestPath === 'string' && path.isAbsolute(manifestPath), 'E_TREE_COHORT_PATH');
  await assertResourceBoundary(manifestPath, manifestPath, fsAdapter);
  const manifest = await readOptionalText(manifestPath, fsAdapter);
  let parsed; try { parsed = JSON.parse(manifest); } catch { treeError('E_TREE_COHORT_MANIFEST'); }
  treeNeed(typeof parsed.projectId === 'string' && (!projectId || parsed.projectId === projectId), 'E_TREE_COHORT_PROJECT');
  if (await readOptionalText(journalPathFor(manifestPath), fsAdapter) !== null) treeError('E_PROJECT_TRANSACTION_RECOVERY_REQUIRED');
  const source = await treeRead(treeCommitPathFor(manifestPath), manifestPath, fsAdapter);
  if (source === null) return { treeRevision: 0, lastMutation: null, receipt: null, retainedPacket: null };
  let receipt; try { receipt = JSON.parse(treeText(source)); } catch { treeError('E_TREE_COHORT_RECEIPT'); }
  treeNeed(receipt.schemaVersion === TREE_RECEIPT_SCHEMA_VERSION && receipt.projectId === parsed.projectId
    && isDigest(receipt.transactionId) && isDigest(receipt.packetDigest) && Number.isSafeInteger(receipt.treeRevision) && receipt.treeRevision > 0, 'E_TREE_COHORT_RECEIPT');
  const packetSource = await treeRead(recoveryPacketPathFor(manifestPath, receipt.transactionId), manifestPath, fsAdapter);
  treeNeed(packetSource !== null, 'E_TREE_COHORT_PACKET_MISSING');
  const packet = await validateTreePacket(JSON.parse(treeText(packetSource)), manifestPath), model = await treeModel();
  treeNeed(packet.projectId === parsed.projectId && packet.transactionId === receipt.transactionId
    && model.projectTreeCohortDigest(packet) === receipt.packetDigest && packet.plan.expectedTreeRevision + 1 === receipt.treeRevision
    && packet.plan.kind === receipt.kind, 'E_TREE_COHORT_RECEIPT_BINDING');
  let canUndo = receipt.kind !== 'undo', unavailableReason = canUndo ? null : 'TREE_UNDO_CONSUMED';
  if (canUndo) try { await inspectTreePacket(packet, manifestPath, fsAdapter, 'after'); }
  catch (error) { canUndo = false; unavailableReason = error.code || error.message; }
  return { treeRevision: receipt.treeRevision, lastMutation: { id: receipt.transactionId, kind: receipt.kind, canUndo, unavailableReason }, receipt, retainedPacket: packet };
}
async function commitTreeCohort({ manifestPath, revision, treeCohort: plan, publishManifest, revalidate, afterTreeFilesPublish, fsAdapter }) {
  treeNeed(typeof revalidate === 'function' && typeof publishManifest === 'function', 'E_TREE_COHORT_AUTHORITY');
  treeNeed(Number.isSafeInteger(revision) && revision >= 0 && plan?.input?.manifestPath === manifestPath ||
    (plan?.kind === 'undo' && plan?.input?.retainedPacket?.manifestPath === manifestPath && Number.isSafeInteger(revision) && revision >= 0), 'E_TREE_COHORT_IDENTITY');
  const model = await treeModel(); model.validateProjectTreeCohort(plan);
  await revalidate();
  if (await readOptionalText(journalPathFor(manifestPath), fsAdapter) !== null) treeError('E_PROJECT_TRANSACTION_RECOVERY_REQUIRED');
  const current = await readVerifiedProjectTreeMutation({ manifestPath, projectId: plan.projectId, fsAdapter });
  treeNeed(current.treeRevision === plan.expectedTreeRevision, 'E_TREE_REVISION_CAS');
  if (plan.kind === 'undo') treeNeed(current.lastMutation?.canUndo && current.lastMutation.id === plan.input.lastMutation
    && canonicalize(current.retainedPacket) === canonicalize(plan.input.retainedPacket), 'E_TREE_UNDO_UNAVAILABLE');
  if (plan.input.recoveredCopy) treeNeed(['undo', 'copy', 'split', 'merge'].includes(current.receipt?.kind)
    && canonicalize(current.receipt) === canonicalize(plan.input.recoveredCopy.receipt)
    && canonicalize(current.retainedPacket) === canonicalize(plan.input.recoveredCopy.retainedPacket), 'E_TREE_RECOVERY_BINDING');
  if (!plan.changed) return { success: true, changed: false, code: 'TREE_COHORT_UNCHANGED', treeRevision: current.treeRevision, lastMutation: current.lastMutation };
  const transactionId = sha256hex(`${plan.projectId}\n${plan.planDigest}\n${revision}`);
  const packet = { schemaVersion: TREE_JOURNAL_SCHEMA_VERSION, projectId: plan.projectId, manifestPath, transactionId,
    revision, plan, entries: buildTreeEntries(plan, manifestPath, revision, transactionId) };
  await validateTreePacket(packet, manifestPath);
  await inspectTreePacket(packet, manifestPath, fsAdapter, 'before');
  const previousReceiptText = await readOptionalText(treeCommitPathFor(manifestPath), fsAdapter);
  const receipt = { schemaVersion: TREE_RECEIPT_SCHEMA_VERSION, projectId: plan.projectId, transactionId,
    treeRevision: current.treeRevision + 1, kind: plan.kind, packetDigest: model.projectTreeCohortDigest(packet) };
  const receiptText = canonicalBytes(receipt), journal = { schemaVersion: TREE_JOURNAL_SCHEMA_VERSION,
    manifestPath, transactionId, previousReceiptText, receiptText, packet };
  const journalText = canonicalBytes(journal);
  await parseTreeJournal(journalText, manifestPath);
  await revalidate();
  await durableSaveTransaction({ filePath: journalPathFor(manifestPath), content: journalText, revision, fsAdapter });
  await publishTreeSide(packet, 'after', { manifestPath, publishManifest, revalidate, fsAdapter });
  if (afterTreeFilesPublish !== undefined) {
    treeNeed(typeof afterTreeFilesPublish === 'function', 'E_TREE_COHORT_OBSERVER');
    await afterTreeFilesPublish({ transactionId });
  }
  await persistTreePacket(packet, fsAdapter);
  await revalidate();
  treeNeed(await readOptionalText(treeCommitPathFor(manifestPath), fsAdapter) === previousReceiptText, 'E_TREE_COHORT_COMMIT_CONFLICT');
  await durableSaveTransaction({ filePath: treeCommitPathFor(manifestPath), content: receiptText, revision, fsAdapter });
  await inspectTreePacket(packet, manifestPath, fsAdapter, 'after');
  await removeDurably(journalPathFor(manifestPath), fsAdapter);
  return { success: true, changed: true, code: 'TREE_COHORT_COMMITTED', transactionId, treeRevision: receipt.treeRevision,
    lastMutation: { id: transactionId, kind: plan.kind, canUndo: plan.kind !== 'undo', unavailableReason: plan.kind === 'undo' ? 'TREE_UNDO_CONSUMED' : null },
    affectedScenes: plan.affectedScenes, pathBindings: plan.pathBindings, identityMap: plan.identityMap, revision,
    manifestDigest: sha256hex(plan.manifestText), recovery: { recovered: false, outcome: 'NO_JOURNAL' } };
}

module.exports = Object.freeze({
  COMMIT_SCHEMA_VERSION,
  JOURNAL_SCHEMA_VERSION,
  PROJECT_COMMIT_REPAIR_CAPABILITY_ID,
  RECOVERY_PACKET_SCHEMA_VERSION,
  ProjectTransactionError,
  TRANSACTION_PHASES,
  TRANSACTION_PHASE_CHAIN,
  classifyProjectTransactionState,
  commitPathFor,
  commitProjectTransaction,
  journalPathFor,
  readPendingProjectTransactionBinding,
  readVerifiedProjectTransaction,
  recoveryPacketPathFor,
  recoverProjectTransaction,
  repairCorruptProjectCommit,
  readVerifiedProjectTreeMutation,
  treeCommitPathFor,
});

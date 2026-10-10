// R2.4 WP-201_PROJECT_TRANSACTION - one recoverable scene + manifest commit.
'use strict';
const { COMMENT_CAPACITY } = require('./word-comment-body-v1.cjs');

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const { durableSaveTransaction } = require('./save-coordinator-v1.cjs');
const { MODE: COMMENT_REBASE_MODE, RETURN_MODE: COMMENT_TEXT_RETURN_MODE, planCommentAnchorSave, planCommentTextReturn } = require('./word-comment-anchor-save-v1.cjs');
const { validateNoteCohort, validateManuscriptDocument, planManuscriptNoteAnchorSave, MODE: NOTE_REBASE_MODE, LIMITS: NOTE_LIMITS } = require('./word-manuscript-notes-v1.cjs');
const { readState: readCanonicalCommentState, planCommentAuthoring } = require('./word-comment-authoring-v1.cjs');
const COMMENT_AUTHORING_MODE = 'COMMENT_AUTHORING_V1';
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
// One regenerated immutable novel origin is separate from ordinary media.
const MAX_NOVEL_ORIGIN_BYTES = 48 * 1024 * 1024;
const MAX_NOVEL_WORD_RETURN_BYTES = 256 * 1024 * 1024;

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

function retainedOriginId(target, manifestPath) {
  if (typeof target !== 'string') return null;
  const match = /^wp201-([a-f0-9]{64})\.json$/u.exec(path.basename(target));
  return match && target === recoveryPacketPathFor(manifestPath, match[1]) ? match[1] : null;
}

function normalizeRetainedResources(value, scenePath, manifestPath) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_RESOURCES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RETAINED_RESOURCES', TRANSACTION_PHASES.ADMIT);
  let bytes = 0, origins = 0; const seen = new Set();
  for (const entry of value) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'bytes,digest,path' || !isDigest(entry.digest)
      || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || seen.has(entry.path)) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RETAINED_RESOURCES', TRANSACTION_PHASES.ADMIT);
    // This syntax exception is read-only. Every use separately regenerates the
    // exact novel-origin packet, scene receipt and immutable import receipt.
    if (!retainedOriginId(entry.path, manifestPath)) normalizeResources([{ path: entry.path, content: Buffer.alloc(0) }], { scenePath, manifestPath });
    if (retainedOriginId(entry.path, manifestPath)) {
      if (++origins > 1 || entry.bytes > MAX_NOVEL_ORIGIN_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.ADMIT);
    } else bytes += entry.bytes;
    seen.add(entry.path);
  }
  if (bytes > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.ADMIT);
  return value.map(entry => ({ ...entry }));
}
async function verifyRetainedResources(resources, scenePath, manifestPath, fsAdapter, invocation = null) {
  if (!resources.length) return;
  normalizeRetainedResources(resources, scenePath, manifestPath);
  for (const entry of resources.filter(entry => !retainedOriginId(entry.path, manifestPath))) {
    const bytes = await readResource(entry, manifestPath, fsAdapter);
    if (bytes === null || bytes.length !== entry.bytes || sha256hex(bytes) !== entry.digest)
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_READBACK', TRANSACTION_PHASES.READBACK);
  }
  const origins = resources.filter(entry => retainedOriginId(entry.path, manifestPath));
  if (origins.length > 1) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOVEL_ORIGIN', TRANSACTION_PHASES.READBACK);
  return origins.length ? readNovelOriginResource(origins[0], resources, scenePath, manifestPath, fsAdapter, invocation) : null;
}

const commentStatePath = manifestPath => path.join(path.dirname(manifestPath), '.yalken', 'word-review', 'non-text-return-state.v1.json');
const commentBinding = value => value ? { beforeDigest: digestOptional(value.beforeText), afterDigest: sha256hex(value.afterText), ...(value.mode ? { mode: value.mode } : {}) } : null;

// A single existing canonical comment file, not an arbitrary replacement port.
// Ordinary import may append new-scene threads; it cannot alter older threads.
function normalizeCommentState(value, scenePath, manifestPath, scenePair = null) {
  if (value === undefined || value === null) return null;
  const fail = () => { throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_STATE', TRANSACTION_PHASES.ADMIT); };
  if (value?.mode === COMMENT_AUTHORING_MODE) {
    if (!scenePair || scenePair.before.scene !== scenePair.after.scene
      || Object.keys(value).sort().join(',') !== 'afterText,authoringProofJson,beforeText,mode'
      || !(value.beforeText === null || typeof value.beforeText === 'string') || typeof value.afterText !== 'string'
      || [value.beforeText || '',value.afterText].some(text=>Buffer.byteLength(text)>COMMENT_CAPACITY.stateBytes)
      || typeof value.authoringProofJson !== 'string' || Buffer.byteLength(value.authoringProofJson)>131072) fail();
    try {
      const proof=JSON.parse(value.authoringProofJson), projectId=JSON.parse(scenePair.before.manifest).projectId;
      if (!proof || Object.keys(proof).sort().join(',') !== 'input,now'
        || JSON.parse(scenePair.after.manifest).projectId !== projectId) fail();
      const expected=planCommentAuthoring({beforeText:value.beforeText,projectId,
        sceneId:path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/'),
        sceneSha256:sha256hex(scenePair.before.scene),paragraphs:require('./word-comment-anchor-save-v1.cjs').paragraphs(scenePair.before.scene),
        input:proof.input,now:proof.now});
      if (expected.afterText !== value.afterText) fail();
      return {mode:COMMENT_AUTHORING_MODE,beforeText:value.beforeText,afterText:value.afterText,authoringProofJson:value.authoringProofJson};
    } catch { fail(); }
  }
  if(value?.mode===COMMENT_TEXT_RETURN_MODE) {
    if(!scenePair || Object.keys(value).sort().join(',')!=='afterText,beforeText,mode,returnProofJson'
      || !['beforeText','afterText'].every(k=>(k==='beforeText' && value[k]===null) || typeof value[k]==='string' && Buffer.byteLength(value[k])<=COMMENT_CAPACITY.stateBytes)) fail();
    try {
      const projectId=JSON.parse(scenePair.before.manifest).projectId;
      const expected=planCommentTextReturn({beforeText:value.beforeText,projectId,
        sceneId:path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/'),
        beforeContent:scenePair.before.scene,afterContent:scenePair.after.scene,returnProofJson:value.returnProofJson});
      if(expected.afterText!==value.afterText) fail();
      return expected;
    } catch {fail();}
  }
  if (value?.mode === COMMENT_REBASE_MODE && value.recordingProofJson !== undefined) {
    if (!scenePair || Object.keys(value).sort().join(',') !== 'afterText,beforeText,mode,recordingProofJson'
      || !['beforeText', 'afterText'].every(k => typeof value[k] === 'string' && Buffer.byteLength(value[k]) <= COMMENT_CAPACITY.stateBytes)) fail();
    try {
      const expected = require('./word-pending-recording-comments-v1.cjs').planRecordingCommentSave({
        beforeText: value.beforeText, projectId: JSON.parse(scenePair.before.manifest).projectId,
        sceneId: path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/'),
        beforeContent: scenePair.before.scene, afterContent: scenePair.after.scene, recordingProofJson: value.recordingProofJson });
      if (!expected || expected.afterText !== value.afterText) fail();
      return expected;
    } catch { fail(); }
  }
  if (value?.mode === COMMENT_REBASE_MODE) {
    if (!scenePair || Object.keys(value).sort().join(',') !== (value.editIntents !== undefined ? 'afterText,beforeText,editIntents,mode,sessionId' : 'afterText,beforeText,mode')
      || !['beforeText', 'afterText'].every(k => typeof value[k] === 'string' && Buffer.byteLength(value[k]) <= COMMENT_CAPACITY.stateBytes)) fail();
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
      && Buffer.byteLength(value[key]) <= COMMENT_CAPACITY.stateBytes)) fail();
  let before, after;
  try { before = JSON.parse(value.beforeText); after = JSON.parse(value.afterText); } catch { fail(); }
  const commentVersions = ['yalken.rtk.word.non-text-return-state.v1', 'yalken.rtk.word.non-text-return-state.v2', 'yalken.rtk.word.non-text-return-state.v3', 'yalken.rtk.word.non-text-return-state.v4', 'yalken.rtk.word.non-text-return-state.v5', 'yalken.rtk.word.non-text-return-state.v6'];
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
  const text = current === null ? null : current.toString('utf8');
  if (text !== change.beforeText && text !== change.afterText) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_CAS', TRANSACTION_PHASES.RECOVER);
  }
  return text;
}

async function publishCommentState(change, manifestPath, nextText, revision, fsAdapter) {
  const current = await inspectCommentState(change, manifestPath, fsAdapter);
  if (current !== nextText) {
    if (nextText === null) await removeDurably(commentStatePath(manifestPath), fsAdapter);
    else await durableSaveTransaction({ filePath: commentStatePath(manifestPath), content: nextText, revision, fsAdapter });
  }
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

// Existing proofless v5 journals were admitted by the predecessor's closed
// anchor-cohort law. Decode only persisted bytes here; fresh admission retains
// complete independent transition replay in normalizeNoteState.
function normalizePersistedNoteState(value, scenePath, manifestPath, { before, after }) {
  if (value?.mode !== NOTE_REBASE_MODE || Object.hasOwn(value, 'recordingProofJson')
    || Object.hasOwn(value, 'pendingNoteReturnProofJson')) return normalizeNoteState(value, scenePath, manifestPath, { before, after });
  try {
    if (Array.isArray(value) || Object.keys(value).some(key => !['mode', 'beforeText', 'afterText'].includes(key))
      || typeof value.beforeText !== 'string' || typeof value.afterText !== 'string'
      || [value.beforeText, value.afterText].some(text => Buffer.byteLength(text) > 4 * NOTE_LIMITS.bytes)) throw Error('NOTE_COHORT_SHAPE');
    const projectId = JSON.parse(before.manifest).projectId;
    if (typeof projectId !== 'string' || !projectId || JSON.parse(after.manifest).projectId !== projectId) throw Error('PROJECT');
    const expected = planManuscriptNoteAnchorSave({ beforeText: value.beforeText, projectId,
      sceneId: path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/'),
      beforeContent: before.scene, afterContent: after.scene });
    if (!expected || expected.afterText !== value.afterText) throw Error('NOTE_COHORT_REBASE');
    return expected;
  } catch (error) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_STATE', TRANSACTION_PHASES.RECOVER, error.code || error.message);
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
    const limit = retainedOriginId(entry.path, manifestPath) ? MAX_NOVEL_ORIGIN_BYTES : MAX_RESOURCE_BYTES;
    if (stat.size > limit) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.RECOVER);
    const bytes = await fsAdapter.readFile(entry.path);
    if (bytes.length > limit) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.RECOVER);
    return bytes;
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
  if (commentState?.mode === COMMENT_AUTHORING_MODE && (!continuation || !retainedResources.some(entry=>retainedOriginId(entry.path,manifestPath))))
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOVEL_ORIGIN',TRANSACTION_PHASES.RECOVER);
  const noteState = continuation && retainedResources.some(entry => retainedOriginId(entry.path, manifestPath))
    ? normalizeNoteState(journal.noteState, scenePath, manifestPath, { before, after })
    : normalizePersistedNoteState(journal.noteState, scenePath, manifestPath, { before, after });
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
        || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > (record.schemaVersion === TREE_COMMIT_SCHEMA_VERSION && retainedOriginId(entry.path, manifestPath) ? MAX_NOVEL_ORIGIN_BYTES : MAX_RESOURCE_BYTES))) {
      return corruptCommitState(source, 'COMMIT_RESOURCE_SCHEMA');
    }
  } else if (record.resources !== undefined) return corruptCommitState(source, 'COMMIT_RESOURCE_SCHEMA');
  if ([COMMENT_COMMIT_SCHEMA_VERSION, ANCHOR_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion)
    || ([NOTE_COMMIT_SCHEMA_VERSION, MEDIA_COMMIT_SCHEMA_VERSION, TREE_COMMIT_SCHEMA_VERSION].includes(record.schemaVersion) && record.commentState !== undefined)) {
    if (!record.commentState || (!([COMMENT_TEXT_RETURN_MODE,...(record.schemaVersion===TREE_COMMIT_SCHEMA_VERSION?[COMMENT_AUTHORING_MODE]:[])].includes(record.commentState.mode) && record.commentState.beforeDigest === null) && !isDigest(record.commentState.beforeDigest)) || !isDigest(record.commentState.afterDigest)
      || (record.schemaVersion === ANCHOR_COMMIT_SCHEMA_VERSION ? ![COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE].includes(record.commentState.mode)
        : record.schemaVersion === TREE_COMMIT_SCHEMA_VERSION ? ![undefined, COMMENT_REBASE_MODE, COMMENT_TEXT_RETURN_MODE, COMMENT_AUTHORING_MODE, 'PROJECT_TREE_COHORT_V1'].includes(record.commentState.mode)
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
  const treeSource = await readTreeEnvelopeSource(journalPathFor(manifestPath), manifestPath, fsAdapter);
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
  const novelOrigin = await verifyRetainedResources(journal.retainedResources || [], scenePath, manifestPath, fsAdapter);
  if (journal.commentState?.mode === COMMENT_AUTHORING_MODE) novelNeed(novelOrigin,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  if (novelOrigin && journal.noteState?.mode === 'MANUSCRIPT_BODY_UPDATE_V1') validateNovelNoteAuthoring(journal.noteState,scenePath,manifestPath);
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
  let novelBaseline = null;
  if (novelOrigin) {
    novelNeed(commitState.status === 'VALID');
    novelBaseline = await readNovelSceneBaseline(commitState.record,scenePath,manifestPath,verifyManifestContinuation,fsAdapter,novelOrigin);
    if (committed) novelNeed((await readNovelSuccessPacket(commitState.record,scenePath,manifestPath,fsAdapter)).journal.transactionId === journal.transactionId);
    else await assertNovelAnnotations(novelBaseline,scenePath,manifestPath,fsAdapter,{
      notesText:journal.noteState?.beforeText ?? (await readResource({path:noteStatePath(manifestPath)},manifestPath,fsAdapter))?.toString('utf8') ?? null,
      commentsText:journal.commentState?.beforeText ?? (await readResource({path:commentStatePath(manifestPath)},manifestPath,fsAdapter))?.toString('utf8') ?? null});
  }
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
  if (novelBaseline) await assertNovelAnnotations(novelBaseline,scenePath,manifestPath,fsAdapter);
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
  let commentState = normalizeCommentState(inputCommentState, scenePath, manifestPath, {
    before: { scene: expectedSceneContent, manifest: expectedManifestContent },
    after: { scene: sceneContent, manifest: manifestContent },
  });
  let noteState = normalizeNoteState(inputNoteState, scenePath, manifestPath, {
    before: { scene: expectedSceneContent, manifest: expectedManifestContent },
    after: { scene: sceneContent, manifest: manifestContent },
  });
  if (mediaUpdate) validateMediaUpdateResources(resources, { scenePath, manifestPath, before: expectedSceneContent, after: sceneContent, noteState });
  if (noteState && resources.some(entry => entry.path === noteStatePath(manifestPath))) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_STATE', TRANSACTION_PHASES.ADMIT);
  }
  if (commentState && ([COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE,COMMENT_AUTHORING_MODE].includes(commentState.mode)
    ? (!mediaUpdate && resources.length !== 0)
    : !resources.length || resources.some(entry => entry.path === commentStatePath(manifestPath)))) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_STATE', TRANSACTION_PHASES.ADMIT);
  }
  if (resources.length && !mediaUpdate && expectedSceneContent !== null) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCES_CREATE_ONLY', TRANSACTION_PHASES.ADMIT);
  if (resources.length || [COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE,COMMENT_AUTHORING_MODE].includes(commentState?.mode) || noteState) {
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
  const novel = retainedCommit.status === 'VALID'
    ? await readNovelSceneBaseline(retainedCommit.record,scenePath,manifestPath,verifyManifestContinuation,fsAdapter) : null;
  if (!novel && (commentState?.mode === COMMENT_AUTHORING_MODE || await selectsNovelReceipt(scenePath,manifestPath,fsAdapter))) novelNeed(false,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  if (novel && noteState?.mode === 'MANUSCRIPT_BODY_UPDATE_V1') validateNovelNoteAuthoring(noteState,scenePath,manifestPath);
  const novelAuthoring=novel && (commentState?.mode===COMMENT_AUTHORING_MODE || noteState?.mode==='MANUSCRIPT_BODY_UPDATE_V1');
  if (novelAuthoring) novelNeed(typeof revalidate==='function','E_PROJECT_TRANSACTION_NOVEL_REVALIDATION_REQUIRED');
  let retainedResources = (!mediaUpdate || novel) && retainedCommit.status === 'VALID'
    && retainedCommit.record.resources?.length ? normalizeRetainedResources(retainedCommit.record.resources, scenePath, manifestPath) : [];
  if (novel) {
    const current = await assertNovelAnnotations(novel,scenePath,manifestPath,fsAdapter);
    if (!retainedResources.some(entry=>entry.path === novel.resource.path)) retainedResources.push(novel.resource);
    normalizeRetainedResources(retainedResources,scenePath,manifestPath);
    if (!noteState) {
      const unchanged = planManuscriptNoteAnchorSave({beforeText:current.notesText,projectId:current.projectId,sceneId:current.sceneId,
        beforeContent:before.scene,afterContent:after.scene,includeUnchanged:true});
      novelNeed(!unchanged || unchanged.afterText === unchanged.beforeText,'E_PROJECT_TRANSACTION_NOVEL_NOTE_COHORT_REQUIRED');
      if (unchanged) noteState = normalizeNoteState(unchanged,scenePath,manifestPath,{before,after});
      else novelNeed(ownedNovelNotes(current.notesText,current.projectId,current.sceneId).notes.length === 0,'E_PROJECT_TRANSACTION_NOVEL_NOTE_COHORT_REQUIRED');
    }
    if (!commentState) {
      const unchanged = planCommentAnchorSave({beforeText:current.commentsText,projectId:current.projectId,sceneId:current.sceneId,
        beforeContent:before.scene,afterContent:after.scene,includeUnchanged:true});
      novelNeed(!unchanged || unchanged.afterText === unchanged.beforeText,'E_PROJECT_TRANSACTION_NOVEL_COMMENT_COHORT_REQUIRED');
      if (unchanged) commentState = normalizeCommentState(unchanged,scenePath,manifestPath,{before,after});
    }
  }
  retainedResources = await consumeRestoredTreeAnnotationResources(retainedResources, scenePath, manifestPath, before, fsAdapter);
  if ([COMMENT_REBASE_MODE,COMMENT_TEXT_RETURN_MODE,COMMENT_AUTHORING_MODE].includes(commentState?.mode)) {
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
  if (novelAuthoring) await revalidate();
  if (!resources.length && priorCommit
    && priorCommit.revision === revision
    && priorCommit.sceneDigest === sha256hex(after.scene)
    && priorCommit.manifestDigest === sha256hex(after.manifest)
    && priorCommit.scenePath === scenePath
    && priorCommit.manifestPath === manifestPath
    && (!novel || ((!commentState || priorCommit.commentState?.afterDigest === sha256hex(commentState.afterText))
      && (!noteState || priorCommit.noteState?.afterDigest === sha256hex(noteState.afterText))))) {
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
  const journalSource = `${JSON.stringify(journal)}\n`;
  let baselineArgs = null, baselineBytes = null;
  if (novel) {
    const checkedJournal = parseJournal(journalSource,{scenePath,manifestPath});
    baselineArgs = {manifestPath,journal:checkedJournal,journalSource,
      commitState:{reason:'NOVEL_SCENE_BASELINE',source:priorCommitState.source},currentScene:before.scene,currentManifest:before.manifest,fsAdapter};
    baselineBytes = canonicalBytes(buildRecoveryPacket(baselineArgs));
    assertText(baselineBytes,'E_PROJECT_TRANSACTION_NOVEL_BASELINE',TRANSACTION_PHASES.PREPARE_JOURNAL);
    const target = recoveryPacketPathFor(manifestPath,transactionId);
    await assertResourceBoundary(target,manifestPath,fsAdapter);
    const existing = await readOptionalText(target,fsAdapter);
    novelNeed(existing === null || existing === baselineBytes,'E_PROJECT_COMMIT_RECOVERY_PACKET_CONFLICT');
  }
  if (novelAuthoring) await revalidate();
  await durableSaveTransaction({
    filePath: journalPath,
    content: journalSource,
    revision,
    fsAdapter,
  });
  // Retain truthful prewrite observations before any business byte changes.
  // Only the later exact CURRENT marker can make this baseline authoritative.
  if (baselineArgs) await preserveRecoveryPacket(baselineArgs);

  for (const entry of resources) await publishResource(entry, manifestPath, revision, fsAdapter, transactionId);
  if (resources.length) await ensureCompanionDirectory(scenePath, manifestPath, fsAdapter);

  if (novelAuthoring) await revalidate();
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

  if (novelAuthoring) await revalidate();
  if (commentState) await publishCommentState(commentState, manifestPath, commentState.afterText, revision, fsAdapter);
  if (novelAuthoring) await revalidate();
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
  if (novelAuthoring) await revalidate();
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
  if (baselineArgs) novelNeed((await readNovelSuccessPacket(commitRecord,scenePath,manifestPath,fsAdapter)).source === baselineBytes);
  if (novelAuthoring) await revalidate();
  await cleanupResourceStaging(stagedResources, manifestPath, fsAdapter, transactionId);
  await removeDurably(journalPath, fsAdapter);

  if (novelAuthoring) await revalidate();
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
    if (commentState?.mode === COMMENT_AUTHORING_MODE) {
      novelNeed(continuation,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
      novelNeed(await verifyRetainedResources(retainedResources,scenePath,manifestPath,fsAdapter),'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    }
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

  const repairOrigin=await verifyRetainedResources(journal.retainedResources || [], scenePath, manifestPath, fsAdapter);
  if (journal.commentState?.mode === COMMENT_AUTHORING_MODE) novelNeed(repairOrigin,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  if (repairOrigin && journal.noteState?.mode === 'MANUSCRIPT_BODY_UPDATE_V1') validateNovelNoteAuthoring(journal.noteState,scenePath,manifestPath);
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

function novelNeed(value, code = 'E_PROJECT_TRANSACTION_NOVEL_BASELINE') {
  if (!value) throw new ProjectTransactionError(code, TRANSACTION_PHASES.READBACK);
}
async function readNovelOriginResource(resource, resources, scenePath, manifestPath, fsAdapter, invocation = null) {
  const id = retainedOriginId(resource.path, manifestPath);
  novelNeed(id, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  normalizeRetainedResources(resources, scenePath, manifestPath);
  let shared = invocation?.origin;
  if (shared) novelNeed(canonicalize(shared.resource) === canonicalize(resource), 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  else {
    const bytes = await readResource(resource, manifestPath, fsAdapter);
    novelNeed(bytes && bytes.length === resource.bytes && sha256hex(bytes) === resource.digest, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    let packet; try { packet = JSON.parse(bytes); } catch { novelNeed(false, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN'); }
    await validateTreePacket(packet, manifestPath);
    novelNeed(packet.transactionId === id && isNovelTreePacket(packet)
      && bytes.equals(Buffer.from(canonicalBytes(packet))), 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    const receipt = packet.entries.find(entry => entry.role === 'importReceipt');
    novelNeed(receipt?.afterBase64 && (await treeRead(treeAbsolute(manifestPath, receipt.relativePath), manifestPath, fsAdapter)) === receipt.afterBase64,
      'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    const annotation = role => treeText(packet.entries.find(entry => entry.role === role)?.afterBase64 ?? null);
    shared = {packet, resource, notesText:annotation('notes'), commentsText:annotation('comments')};
    if (invocation) invocation.origin = shared;
  }
  const relative = path.relative(path.dirname(manifestPath), scenePath).split(path.sep).join('/');
  novelNeed(shared.packet.plan.importReceipt.createdScenes.some(scene => scene.relativeFile === relative), 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  const commit = shared.packet.entries.find(entry => entry.role === 'sceneCommit' && entry.relativePath === relative + '.wp201-commit.json');
  novelNeed(commit?.afterBase64, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  // This record belongs to this scene, never the first member of the query.
  const originalRecord = JSON.parse(treeText(commit.afterBase64));
  for (const expected of originalRecord.resources || []) {
    novelNeed(resources.some(entry => canonicalize(entry) === canonicalize(expected)), 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  }
  return {...shared, originalRecord};
}
async function readNovelSceneBaseline(record, scenePath, manifestPath, verifyManifestContinuation, fsAdapter, origin = null, invocation = null) {
  if (record?.schemaVersion !== TREE_COMMIT_SCHEMA_VERSION) return null;
  const origins = (record.resources || []).filter(entry => retainedOriginId(entry.path, manifestPath));
  novelNeed(origins.length <= 1, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  if (!origin && origins.length) origin = await readNovelOriginResource(origins[0], record.resources, scenePath, manifestPath, fsAdapter, invocation);
  if (!origin && invocation?.origin) {
    novelNeed(record.transactionId === invocation.origin.packet.transactionId, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    origin = await readNovelOriginResource(invocation.origin.resource,[...(record.resources || []),invocation.origin.resource],scenePath,manifestPath,fsAdapter,invocation);
  }
  if (!origin) {
    // A receipt is only a selector. Regeneration and the exact scene commit
    // below must prove that this is a new novel cohort rather than legacy v7.
    let selected = false;
    for (const resource of record.resources || []) {
      if (path.dirname(resource.path) !== path.join(path.dirname(manifestPath), '.yalken', 'docx-import', 'receipts')) continue;
      const bytes = await readResource(resource, manifestPath, fsAdapter); let receipt;
      try { receipt = JSON.parse(bytes); } catch { continue; }
      if (receipt?.schemaVersion === 'revision-bridge.docx-import-receipt.v3' && receipt.sceneStrategy === 'word-novel-root-partitions') selected = true;
    }
    if (!selected) return null;
    const target = recoveryPacketPathFor(manifestPath, record.transactionId);
    let resource = invocation?.origin?.resource;
    if (resource) novelNeed(resource.path === target, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    else {
      const bytes = await readResource({path:target}, manifestPath, fsAdapter);
      novelNeed(bytes, 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
      resource = {path:target,digest:sha256hex(bytes),bytes:bytes.length};
    }
    origin = await readNovelOriginResource(resource, [...record.resources,resource], scenePath, manifestPath, fsAdapter, invocation);
  }
  if (record.transactionId === origin.packet.transactionId) {
    novelNeed(canonicalize(record) === canonicalize(origin.originalRecord), 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
    return origin;
  }
  novelNeed(origins.length === 1 && canonicalize(origins[0]) === canonicalize(origin.resource), 'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  if (record.manifestDigest !== origin.originalRecord.manifestDigest) {
    const proof = typeof verifyManifestContinuation === 'function' && await verifyManifestContinuation({manifestPath,
      fromDigest:origin.originalRecord.manifestDigest,toDigest:record.manifestDigest});
    novelNeed(proof?.ok === true && proof.manifestPath === manifestPath && proof.fromDigest === origin.originalRecord.manifestDigest
      && proof.toDigest === record.manifestDigest, 'E_PROJECT_TRANSACTION_NOVEL_MANIFEST');
  }
  if(invocation){invocation.successPaths ||= new Set();invocation.successPaths.add(recoveryPacketPathFor(manifestPath,record.transactionId));}
  const packet = await readNovelSuccessPacket(record, scenePath, manifestPath, fsAdapter, invocation);
  return {...origin, latestPacket:packet.packet, notesText:packet.journal.noteState?.afterText ?? origin.notesText,
    commentsText:packet.journal.commentState?.afterText ?? origin.commentsText};
}
async function readNovelSuccessPacket(record, scenePath, manifestPath, fsAdapter, invocation = null) {
  const target = recoveryPacketPathFor(manifestPath, record.transactionId);
  const retained=invocation?.successPackets?.get(target);
  const source=retained?.source ?? await readTreeEnvelopeSource(target,manifestPath,fsAdapter);novelNeed(source!==null);
  let packet=retained?.packet; if(!packet)try { packet = JSON.parse(source); } catch { novelNeed(false); }
  if(packet?.schemaVersion===TREE_JOURNAL_SCHEMA_VERSION) {
    if(!retained) {
      await validateTreePacket(packet,manifestPath);
      let proof;try{proof=JSON.parse(packet.plan.input.returnProofJson);}catch{novelNeed(false);}
      novelNeed(packet.plan.kind==='word-mixed-return'&&[5,6].includes(proof.schemaVersion)
        &&packet.transactionId===record.transactionId&&source===canonicalBytes(packet));
      if(invocation) {
        // Private to this complete query. The observed packet is reread after
        // all members, while each member still proves its own scene and commit.
        invocation.successPackets ||= new Map();
        invocation.successPackets.clear();
        invocation.successPackets.set(target,freezeTreeValue({packet,source}));
      }
    }
    const relative=path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/');
    const entry=packet.entries.find(e=>e.relativePath===relative&&e.role==='scene');
    const committed=packet.entries.find(e=>e.relativePath===relative+'.wp201-commit.json'&&e.role==='sceneCommit');
    novelNeed(entry&&committed?.afterBase64&&canonicalize(JSON.parse(treeText(committed.afterBase64)))===canonicalize(record)
      &&entry.afterBase64===await treeRead(scenePath,manifestPath,fsAdapter));
    const annotation=role=>{const e=packet.entries.find(e=>e.role===role);return e?{beforeText:treeText(e.beforeBase64),afterText:treeText(e.afterBase64)}:undefined;};
    return {packet,journal:{noteState:annotation('notes'),commentState:annotation('comments')},source};
  }
  novelNeed(Buffer.byteLength(source)<=MAX_ARTIFACT_BYTES,'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
  const journalSource = decodePacketRole(packet,'TRANSACTION_JOURNAL'), journal = parseJournal(journalSource,{scenePath,manifestPath});
  const state = await readCommitRecordState({scenePath,manifestPath,expectedJournal:journal,fsAdapter});
  novelNeed(state.status === 'VALID' && state.relation === 'CURRENT' && canonicalize(state.record) === canonicalize(record));
  const prior = decodePacketRole(packet,'CORRUPT_COMMIT_METADATA');
  let previous; try { previous = JSON.parse(prior); } catch { novelNeed(false); }
  novelNeed(previous?.scenePath === scenePath && previous.manifestPath === manifestPath && isDigest(previous.transactionId)
    && previous.sceneDigest === sha256hex(journal.before.scene) && isDigest(previous.manifestDigest));
  const expected = buildRecoveryPacket({journal,journalSource,commitState:{reason:'NOVEL_SCENE_BASELINE',source:prior},
    currentScene:journal.before.scene,currentManifest:journal.before.manifest});
  novelNeed(packet.binding?.transactionId === record.transactionId && source === canonicalBytes(expected));
  return {packet,journal,source};
}
function ownedNovelNotes(text, projectId, sceneId, allIds = new Set(), ownIds = new Set()) {
  const doc = text === null ? {schemaVersion:1,projectId,notes:[]} : validateManuscriptDocument(JSON.parse(text),projectId);
  const relevant = row => {
    if (!row || Object.keys(row).sort().join(',')!=='artifactSha256,changes,inputDigest,operationId,resultDigest,roundId'
      || !['operationId','inputDigest','resultDigest','roundId','artifactSha256'].every(key=>typeof row[key]==='string')
      || !row.roundId.length || row.roundId.length>256 || !/^(?:sha256:)?[a-f0-9]{64}$/u.test(row.artifactSha256)
      || !isDigest(row.inputDigest) || !isDigest(row.resultDigest)
      || row.operationId!==`word-note-return-${sha256hex(row.roundId+'\n'+row.artifactSha256)}`
      || !Array.isArray(row.changes) || !row.changes.length || row.changes.length>256) return true;
    const foreign = change => {
      if (!change || Object.keys(change).sort().join(',')!=='after,before,noteId,operation'
        || !allIds.has(change.noteId) || ownIds.has(change.noteId)
        || !({create:change.before===null && !!change.after,update:!!change.before && !!change.after,delete:!!change.before && change.after===null})[change.operation]) return false;
      try {return [change.before,change.after].filter(Boolean).every(value=> {
        require('./word-manuscript-notes-v1.cjs').validateManuscriptPayload(value);
        return value.reference.sceneId!==sceneId;
      });} catch {return false;}
    };
    return !row.changes.every(foreign); // Unknown/unscoped and own/deleted receipts remain protected.
  };
  return {root:Object.fromEntries(Object.entries(doc).filter(([k])=>!['notes','updatedAtUtc','wordNoteReturnReceipts'].includes(k))),
    notes:doc.notes.filter(note=>note?.manuscript?.reference.sceneId === sceneId),
    receipts:doc.wordNoteReturnReceipts===undefined?[]:Array.isArray(doc.wordNoteReturnReceipts)?doc.wordNoteReturnReceipts.filter(relevant):doc.wordNoteReturnReceipts};
}
function validateNovelNoteAuthoring(change,scenePath,manifestPath) {
  const before=JSON.parse(change.beforeText),after=JSON.parse(change.afterText);
  const sceneId=path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/');
  const foreign=doc=>doc.notes.filter(note=>note?.manuscript?.reference.sceneId !== sceneId);
  novelNeed(canonicalize(foreign(before))===canonicalize(foreign(after))
    && canonicalize(before.wordNoteReturnReceipts)===canonicalize(after.wordNoteReturnReceipts),'E_PROJECT_TRANSACTION_NOTE_STATE');
}
function ownedNovelComments(text, projectId, sceneId, allIds, ownIds) {
  const state = readCanonicalCommentState(text,projectId);
  const relevant = event => {
    if (event?.type === 'WORD_COMMENT_AUTHORED' && Object.keys(event).sort().join(',')==='action,at,inputDigest,operationId,resultingRevision,threadId,type'
      && typeof event.operationId==='string' && /^[\w:.-]{1,160}$/u.test(event.operationId) && isDigest(event.inputDigest)
      && ['create','reply','edit','resolve','reopen','reanchor','delete'].includes(event.action)
      && Number.isSafeInteger(event.resultingRevision) && event.resultingRevision>=0 && typeof event.at==='string' && Number.isFinite(Date.parse(event.at))
      && allIds.has(event.threadId)) return ownIds.has(event.threadId);
    const recognizedChange=change=>change && allIds.has(change.threadId)
      && Object.keys(change).every(key=>['threadId','messageIds','anchorChanged','statusBefore','statusAfter','created','deletedMessageIds','deletionDecision'].includes(key))
      && Array.isArray(change.messageIds) && change.messageIds.every(id=>typeof id==='string') && typeof change.anchorChanged==='boolean'
      && [null,'open','resolved','deleted'].includes(change.statusBefore) && ['open','resolved','deleted'].includes(change.statusAfter)
      && (change.created===undefined || change.created===true) && (change.deletedMessageIds===undefined || Array.isArray(change.deletedMessageIds) && change.deletedMessageIds.every(id=>typeof id==='string'))
      && (change.deletionDecision===undefined || change.deletionDecision==='CONSISTENT_ABSENCE_REQUIRES_EXPLICIT_CONFIRMATION');
    if (event?.type === 'WORD_COMMENT_RETURN_APPLIED' && Object.keys(event).sort().join(',')==='artifactSha256,changes,inputDigest,operationId,resultingRevision,roundId,threadDigest,type'
      && typeof event.operationId==='string' && event.operationId.length<=160 && typeof event.roundId==='string' && event.roundId.length<=256
      && /^(?:sha256:)?[a-f0-9]{64}$/u.test(event.artifactSha256) && isDigest(event.inputDigest) && isDigest(event.threadDigest)
      && Number.isSafeInteger(event.resultingRevision) && event.resultingRevision>=0 && Array.isArray(event.changes) && event.changes.length
      && event.changes.every(recognizedChange)) return event.changes.some(change=>ownIds.has(change.threadId));
    return true; // Unscoped/unknown events are protected rather than discarded.
  };
  return {root:Object.fromEntries(Object.entries(state).filter(([k])=>!['schemaVersion','revision','threads','events'].includes(k))),
    threads:state.threads.filter(thread=>thread.sceneId === sceneId),events:state.events.filter(relevant)};
}
async function assertNovelAnnotations(baseline, scenePath, manifestPath, fsAdapter, texts = null) {
  const projectId = baseline.packet.projectId, sceneId = path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/');
  const notesText = texts ? texts.notesText : (await readResource({path:noteStatePath(manifestPath)},manifestPath,fsAdapter))?.toString('utf8') ?? null;
  const commentsText = texts ? texts.commentsText : (await readResource({path:commentStatePath(manifestPath)},manifestPath,fsAdapter))?.toString('utf8') ?? null;
  try {
    const noteDocs=[baseline.notesText,notesText].map(text=>text===null?{notes:[]}:validateManuscriptDocument(JSON.parse(text),projectId));
    const allNotes=new Set(noteDocs.flatMap(doc=>doc.notes.map(note=>note.id)));
    const ownNotes=new Set(noteDocs.flatMap(doc=>doc.notes.filter(note=>note?.manuscript?.reference.sceneId===sceneId).map(note=>note.id)));
    novelNeed(canonicalize(ownedNovelNotes(notesText,projectId,sceneId,allNotes,ownNotes)) === canonicalize(ownedNovelNotes(baseline.notesText,projectId,sceneId,allNotes,ownNotes)), 'E_PROJECT_TRANSACTION_NOTE_READBACK');
    const states = [readCanonicalCommentState(baseline.commentsText,projectId),readCanonicalCommentState(commentsText,projectId)];
    const all = new Set(states.flatMap(state=>state.threads.map(thread=>thread.threadId)));
    const own = new Set(states.flatMap(state=>state.threads.filter(thread=>thread.sceneId === sceneId).map(thread=>thread.threadId)));
    novelNeed(canonicalize(ownedNovelComments(commentsText,projectId,sceneId,all,own))
      === canonicalize(ownedNovelComments(baseline.commentsText,projectId,sceneId,all,own)), 'E_PROJECT_TRANSACTION_COMMENT_READBACK');
  } catch (error) {
    if (error instanceof ProjectTransactionError) throw error;
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOVEL_ANNOTATION',TRANSACTION_PHASES.READBACK,error.code || 'SCHEMA');
  }
  return {notesText,commentsText,projectId,sceneId};
}

// A receipt only selects a fail-closed lineage check, never mutation authority.
async function selectsNovelReceipt(scenePath,manifestPath,fsAdapter) {
  const directory=path.join(path.dirname(manifestPath),'.yalken','docx-import','receipts');
  let names; try {names=await fsAdapter.readdir(directory);} catch(error) {if(error.code==='ENOENT')return false;throw error;}
  novelNeed(names.length<=10000,'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
  const relative=path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/');
  const projectId=JSON.parse(await fsAdapter.readFile(manifestPath,'utf8')).projectId; let total=0;
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const bytes=await readResource({path:path.join(directory,name)},manifestPath,fsAdapter);
    if (!bytes) continue;
    total+=bytes.length;novelNeed(total<=MAX_RESOURCE_BYTES,'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
    let receipt;try {receipt=JSON.parse(bytes);}catch {continue;}
    if (receipt?.schemaVersion==='revision-bridge.docx-import-receipt.v3' && receipt.sceneStrategy==='word-novel-root-partitions'
      && receipt.projectId===projectId && Array.isArray(receipt.createdScenes) && receipt.createdScenes.some(scene=>scene?.relativeFile===relative)) return true;
  }
  return false;
}
async function readVerifiedNovelAnnotationLineage({scenePath,manifestPath,verifyManifestContinuation,fsAdapter=fsp}) {
  assertPathPair(scenePath,manifestPath);
  const {reader,invocation,assertFresh}=createNovelReadInvocation(manifestPath,fsAdapter);
  const state=await readCommitRecordState({scenePath,manifestPath,observedScene:await readOptionalText(scenePath,reader),
    observedManifest:await readOptionalText(manifestPath,reader),verifyManifestContinuation,fsAdapter:reader});
  const baseline=state.status==='VALID'?await readNovelSceneBaseline(state.record,scenePath,manifestPath,verifyManifestContinuation,reader,null,invocation):null;
  if (!baseline) {novelNeed(state.record?.commentState?.mode!==COMMENT_AUTHORING_MODE,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');novelNeed(!await selectsNovelReceipt(scenePath,manifestPath,reader),'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');await assertFresh();return null;}
  await readVerifiedProjectTransactionInInvocation({scenePath,manifestPath,verifyManifestContinuation,fsAdapter:reader},invocation);
  const treeMutation=await readVerifiedProjectTreeMutationInInvocation({manifestPath,projectId:baseline.packet.projectId,fsAdapter:reader},invocation);
  await assertFresh();
  return Object.freeze({projectId:baseline.packet.projectId,sceneId:path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/'),transactionId:state.record.transactionId,
    scenePaths:Object.freeze(baseline.packet.plan.importReceipt.createdScenes.map(scene=>path.join(path.dirname(manifestPath),scene.relativeFile))),
    treeMutation:freezeTreeValue(treeMutation),originResource:Object.freeze({...baseline.resource})});
}

// Readback of a committed create transaction is independent of the import
// receipt's own assertions. Every recorded companion must still match bytes.
async function readVerifiedProjectTransaction(options) {
  return readVerifiedProjectTransactionInInvocation(options);
}
async function readVerifiedProjectTransactionInInvocation({ scenePath, manifestPath, verifyManifestContinuation, fsAdapter = fsp }, invocation = null) {
  assertPathPair(scenePath, manifestPath);
  if (await readOptionalText(journalPathFor(manifestPath), fsAdapter) !== null) {
    throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RECOVERY_REQUIRED', TRANSACTION_PHASES.READBACK);
  }
  const state = await readCommitRecordState({ scenePath, manifestPath,
    observedScene: await readOptionalText(scenePath, fsAdapter),
    observedManifest: await readOptionalText(manifestPath, fsAdapter), verifyManifestContinuation, fsAdapter });
  if (state.status !== 'VALID') throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMIT_READBACK', TRANSACTION_PHASES.READBACK);
  let origin = null;
  if (state.record.resources) {
    if (state.record.resources.some(entry=>retainedOriginId(entry.path,manifestPath))) {
      origin = await verifyRetainedResources(state.record.resources,scenePath,manifestPath,fsAdapter,invocation);
    } else normalizeResources(state.record.resources.map(entry => ({ path: entry.path, content: '' })), { scenePath, manifestPath });
    let total = 0;
    for (const entry of state.record.resources) {
      if (retainedOriginId(entry.path, manifestPath)) continue;
      total += entry.bytes;
      if (total > MAX_RESOURCE_BYTES) throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_BUDGET', TRANSACTION_PHASES.READBACK);
      const content = await readResource(entry, manifestPath, fsAdapter);
      if (content === null || content.length !== entry.bytes || sha256hex(content) !== entry.digest) {
        throw new ProjectTransactionError('E_PROJECT_TRANSACTION_RESOURCE_READBACK', TRANSACTION_PHASES.READBACK);
      }
    }
  }
  const novel = await readNovelSceneBaseline(state.record,scenePath,manifestPath,verifyManifestContinuation,fsAdapter,origin,invocation);
  novelNeed(novel || state.record.commentState?.mode!==COMMENT_AUTHORING_MODE,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
  if (novel) await assertNovelAnnotations(novel,scenePath,manifestPath,fsAdapter);
  if (state.record.commentState) {
    const value = await readResource({ path: commentStatePath(manifestPath) }, manifestPath, fsAdapter);
    if ((value === null || sha256hex(value) !== state.record.commentState.afterDigest) && !novel) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_COMMENT_READBACK', TRANSACTION_PHASES.READBACK);
    }
  }
  if (state.record.noteState) {
    const value = await readResource({ path: noteStatePath(manifestPath) }, manifestPath, fsAdapter);
    if ((value === null || sha256hex(value) !== state.record.noteState.afterDigest) && !novel) {
      throw new ProjectTransactionError('E_PROJECT_TRANSACTION_NOTE_READBACK', TRANSACTION_PHASES.READBACK);
    }
  }
  return Object.freeze({ ...state.record });
}

// Owned by one query only. A caller cannot supply this observation context.
function createNovelReadInvocation(manifestPath, fsAdapter) {
  const observed = new Map(), invocation = {origin:null};
  const capture = (target, bytes) => {
    const binding = bytes === null ? null : {bytes:Buffer.byteLength(bytes),digest:sha256hex(bytes)};
    if (observed.has(target)) novelNeed(canonicalize(observed.get(target)) === canonicalize(binding), 'E_PROJECT_TRANSACTION_NOVEL_STALE');
    observed.set(target,binding);
  };
  const reader = {...fsAdapter,readFile:async(target,...args)=>{
    try {
      const limit=invocation.successPaths?.has(target)?MAX_NOVEL_WORD_RETURN_BYTES:retainedOriginId(target,manifestPath)?MAX_NOVEL_ORIGIN_BYTES:MAX_ARTIFACT_BYTES;
      const stat=await fsAdapter.stat(target);
      novelNeed(Number.isSafeInteger(stat.size) && stat.size>=0 && typeof stat.isFile==='function' && stat.isFile() && stat.size<=limit,
        'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
      const bytes=await fsAdapter.readFile(target,...args),length=Buffer.byteLength(bytes);
      novelNeed(length<=limit,'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
      novelNeed(length===stat.size,'E_PROJECT_TRANSACTION_NOVEL_STALE');
      capture(target,bytes);return bytes;
    }
    catch(error) {if(error.code==='ENOENT')capture(target,null);throw error;}
  }};
  const assertFresh=async()=>{
  // Every participating read, including absent journal and annotation files,
  // is checked again after the last member; the result is immutable.
  for(const [target,binding] of observed) {
    await assertResourceBoundary(target,manifestPath,fsAdapter);
    let stat;try {stat=await fsAdapter.stat(target);}catch(error){if(error.code!=='ENOENT')throw error;stat=null;}
    novelNeed(stat===null ? binding===null : binding!==null && stat.isFile() && stat.size===binding.bytes,
      'E_PROJECT_TRANSACTION_NOVEL_STALE');
    let value=null;if(stat!==null)try {value=await fsAdapter.readFile(target);}catch(error){if(error.code!=='ENOENT')throw error;}
    const actual=value===null?null:{bytes:Buffer.byteLength(value),digest:sha256hex(value)};
    novelNeed(canonicalize(actual)===canonicalize(binding), 'E_PROJECT_TRANSACTION_NOVEL_STALE');
  }
  };
  return {reader,invocation,assertFresh};
}

// Complete read-only query. Its reuse context and observed bytes are created
// here, never accepted from a caller or retained across invocations.
async function readVerifiedProjectDocxNovelCohort(options) {
  novelNeed(options && Object.keys(options).every(key => ['manifestPath','projectId','scenePaths','verifyManifestContinuation','fsAdapter'].includes(key)), 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  const {manifestPath,projectId,scenePaths,verifyManifestContinuation,fsAdapter=fsp} = options;
  novelNeed(typeof manifestPath === 'string' && path.isAbsolute(manifestPath) && typeof projectId === 'string'
    && Array.isArray(scenePaths) && scenePaths.length >= 1 && scenePaths.length <= 512
    && new Set(scenePaths).size === scenePaths.length, 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  const {reader,invocation,assertFresh}=createNovelReadInvocation(manifestPath,fsAdapter);
  const records=[];
  for (const scenePath of scenePaths) {
    novelNeed(typeof scenePath === 'string' && path.isAbsolute(scenePath), 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
    records.push(await readVerifiedProjectTransactionInInvocation({scenePath,manifestPath,verifyManifestContinuation,fsAdapter:reader},invocation));
  }
  const origin=invocation.origin;
  novelNeed(origin?.packet.projectId === projectId, 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  const scenes=origin.packet.plan.importReceipt.createdScenes;
  novelNeed(canonicalize(scenePaths) === canonicalize(scenes.map(scene=>treeAbsolute(manifestPath,scene.relativeFile))), 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  const manifestText=await readOptionalText(manifestPath,reader),manifest=JSON.parse(manifestText);
  novelNeed(manifest.projectId===projectId, 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  for(const scene of scenes) {
    const node=manifest.treeIdentity?.nodes?.[scene.treeNodeId];
    novelNeed(node?.bindingKey==='file:'+scene.relativeFile && node.kind==='scene' && node.present!==false, 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  }
  const attemptPath=treeAbsolute(manifestPath,'.yalken/docx-import/active-attempt.v1.json');
  const attemptBytes=await readResource({path:attemptPath},manifestPath,reader);
  novelNeed(attemptBytes===null || attemptBytes.length<=4096, 'E_PROJECT_TRANSACTION_NOVEL_COHORT');
  const treeMutation=await readVerifiedProjectTreeMutationInInvocation({manifestPath,projectId,fsAdapter:reader},invocation);
  await assertFresh();
  const freeze=value=>{if(value && typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
  return freeze({projectId,manifestDigest:sha256hex(manifestText),attemptDigest:attemptBytes===null?'':sha256hex(attemptBytes),records,treeMutation});
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
        if (stat.isSymbolicLink() || (current === target ? !stat.isFile() || stat.nlink !== 1 || stat.size > COMMENT_CAPACITY.stateBytes : !stat.isDirectory())) throw Error('BOUNDARY');
      }
      if ((!(record.commentState?.mode === COMMENT_TEXT_RETURN_MODE && record.commentState.beforeDigest === null) && !isDigest(record.commentState?.beforeDigest)) || !isDigest(record.commentState?.afterDigest)
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
  return plan.kind === 'word-mixed-return' || plan.kind === 'word-generic-import' || Array.isArray(plan.scenePartitions) || Boolean(plan.input?.recoveredCopy?.sourceNodeId)
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
    if (entry.afterBase64 === null || entry.beforeBase64 === null && plan.kind !== 'word-generic-import') continue;
    for (const encoded of new Set([entry.beforeBase64, entry.afterBase64].filter(x=>x!==null))) {
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
async function inspectTreePacket(packet, manifestPath, fsAdapter, requireSide = null, privateInvocation = null) {
  const managed = treeManagedAnnotationEntries(packet.plan, manifestPath);
  const novelOrigin=packet.plan.kind==='word-mixed-return'?packet.plan.input.novelOrigin:undefined;
  const invocation=novelOrigin?(privateInvocation||{origin:null}):null;
  const stagedMedia = new Set(packet.plan.entries.filter(entry=>entry.role==='storyMedia' || packet.plan.kind==='word-generic-import' && ['importReceipt','importMedia'].includes(entry.role)).map(entry=>treeAbsolute(manifestPath,entry.relativePath)));
  for (const entry of packet.entries.filter(e => e.role === 'sceneCommit' && e.relativePath.endsWith('.wp201-commit.json'))) {
    for (const raw of new Set([entry.beforeBase64, entry.afterBase64].filter(Boolean))) {
      let record; try { record = JSON.parse(treeText(raw)); } catch { treeError('E_TREE_COHORT_COMMIT_INVALID'); }
      const resources = record.resources || [];
      if (resources.length) normalizeRetainedResources(resources, record.scenePath, manifestPath);
      const checked=resources.filter(resource => !managed.has(resource.path) && !stagedMedia.has(resource.path));
      if(novelOrigin&&!checked.some(resource=>retainedOriginId(resource.path,manifestPath)))checked.push(novelOrigin);
      const origin=await verifyRetainedResources(checked, record.scenePath, manifestPath, fsAdapter,invocation);
      if(novelOrigin) {
        treeNeed(origin&&canonicalize(origin.resource)===canonicalize(novelOrigin),'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');
        if(raw===entry.beforeBase64&&requireSide==='before')await readNovelSceneBaseline(record,record.scenePath,manifestPath,undefined,fsAdapter,origin,invocation);
      }
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
    if (plan.kind === 'word-generic-import' && plan.affectedScenes.some(item=>item.to===scene.relativePath)) {
      for (const entry of entries.filter(e=>['importReceipt','importMedia'].includes(e.role))) {
        resources.set(treeAbsolute(manifestPath,entry.relativePath),{path:treeAbsolute(manifestPath,entry.relativePath),digest:sha256hex(Buffer.from(entry.afterBase64,'base64')),bytes:Buffer.from(entry.afterBase64,'base64').length});
      }
    }
    if(plan.kind==='word-mixed-return'&&plan.input.novelOrigin) {
      const origin=plan.input.novelOrigin;
      treeNeed(!resources.has(origin.path)||canonicalize(resources.get(origin.path))===canonicalize(origin),'E_TREE_COHORT_RESOURCE_CONFLICT');
      resources.set(origin.path,origin);
      normalizeRetainedResources([...resources.values()],treeAbsolute(manifestPath,scene.relativePath),manifestPath);
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
function isNovelTreePacket(packet) {
  return packet?.plan?.kind === 'word-generic-import' && packet.plan.importReceipt?.sceneStrategy === 'word-novel-root-partitions';
}
function isNovelWordReturnPacket(packet) {
  const input=packet?.plan?.input,origin=input?.novelOrigin;
  if(packet?.plan?.kind!=='word-mixed-return'||!origin||Object.keys(origin).sort().join(',')!=='bytes,digest,path'
    ||typeof origin.path!=='string'||!path.isAbsolute(origin.path)||!isDigest(origin.digest)
    ||!Number.isSafeInteger(origin.bytes)||origin.bytes<0||origin.bytes>MAX_NOVEL_ORIGIN_BYTES
    ||typeof input.returnProofJson!=='string'||Buffer.byteLength(input.returnProofJson)>MAX_ARTIFACT_BYTES)return false;
  let proof;try{proof=JSON.parse(input.returnProofJson);}catch{return false;}
  if(proof?.schemaVersion===5&&input.history===undefined)return true;
  const apply=input.history?.applyPacket;
  if(proof?.schemaVersion===6&&apply?.plan?.kind==='word-mixed-return'&&canonicalize(apply.plan.input?.novelOrigin)===canonicalize(origin)
    &&apply.plan.input.history===undefined&&typeof apply.plan.input.returnProofJson==='string'
    &&Buffer.byteLength(apply.plan.input.returnProofJson)<=MAX_ARTIFACT_BYTES) {
    try{return JSON.parse(apply.plan.input.returnProofJson).schemaVersion===5;}catch{return false;}
  }
  return false;
}
const treeEnvelopeLimit=packet=>isNovelWordReturnPacket(packet)?MAX_NOVEL_WORD_RETURN_BYTES:isNovelTreePacket(packet)?MAX_NOVEL_ORIGIN_BYTES:MAX_ARTIFACT_BYTES;
// Only owned journal/latest-packet callers use this coarse pre-read envelope.
// Parsed category, complete semantic regeneration and origin verification still
// enforce the narrower ordinary32/import48 limits and mutation authority.
async function readTreeEnvelopeSource(target,manifestPath,fsAdapter) {
  await assertResourceBoundary(target,manifestPath,fsAdapter);
  try {
    const stat=await fsAdapter.stat(target);
    treeNeed(Number.isSafeInteger(stat.size)&&stat.size>=0&&stat.isFile()&&stat.size<=MAX_NOVEL_WORD_RETURN_BYTES,'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
    const source=await fsAdapter.readFile(target,'utf8');
    treeNeed(Buffer.byteLength(source)<=MAX_NOVEL_WORD_RETURN_BYTES,'E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
    treeNeed(Buffer.byteLength(source)===stat.size,'E_PROJECT_TRANSACTION_NOVEL_STALE');return source;
  }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function validateTreePacketShape(packet, manifestPath) {
  treeNeed(packet?.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && packet.manifestPath === manifestPath
    && typeof packet.projectId === 'string' && packet.projectId === packet.plan?.projectId
    && Number.isSafeInteger(packet.revision) && packet.revision >= 0, 'E_TREE_COHORT_JOURNAL');
}
function validateTreePacketBinding(packet, manifestPath) {
  validateTreePacketShape(packet, manifestPath);
  const id = sha256hex(`${packet.projectId}\n${packet.plan.planDigest}\n${packet.revision}`);
  treeNeed(packet.transactionId === id && canonicalize(packet.entries) === canonicalize(buildTreeEntries(packet.plan, manifestPath, packet.revision, id)), 'E_TREE_COHORT_JOURNAL_BINDING');
  treeNeed(Buffer.byteLength(isNovelTreePacket(packet)||isNovelWordReturnPacket(packet) ? canonicalBytes(packet) : canonicalize(packet))
    <= treeEnvelopeLimit(packet), 'E_TREE_COHORT_BUDGET');
}
async function validateTreePacket(packet, manifestPath) {
  const model = await treeModel();
  validateTreePacketShape(packet, manifestPath);
  model.validateProjectTreeCohort(packet.plan);
  if (packet.plan.kind === 'undo') await validateTreePacket(packet.plan.input.retainedPacket, manifestPath);
  if(packet.plan.kind==='word-mixed-return'&&packet.plan.input.history) {
    // Schema 6's independently regenerated meaning already validates this
    // exact Apply plan. Its complete packet envelope still needs binding.
    if(JSON.parse(packet.plan.input.returnProofJson).schemaVersion===6)validateTreePacketBinding(packet.plan.input.history.applyPacket,manifestPath);
    else await validateTreePacket(packet.plan.input.history.applyPacket,manifestPath);
  }
  if (packet.plan.input.recoveredCopy) await validateTreePacket(packet.plan.input.recoveredCopy.retainedPacket, manifestPath);
  validateTreePacketBinding(packet, manifestPath);
  return packet;
}
function freezeTreeValue(value) {
  if(value && typeof value === 'object') {for(const child of Object.values(value))freezeTreeValue(child);Object.freeze(value);}
  return value;
}
async function buildVerifiedTreePacket(plan, manifestPath, revision) {
  // Own the complete bounded input before any await. A caller cannot change
  // admitted meaning while this invocation later revalidates filesystem state.
  const source=canonicalize(plan);
  treeNeed(Buffer.byteLength(source)<=(isNovelWordReturnPacket({plan})?MAX_NOVEL_WORD_RETURN_BYTES:MAX_ARTIFACT_BYTES),'E_TREE_COHORT_BUDGET');
  const privatePlan=JSON.parse(source),model=await treeModel();
  model.validateProjectTreeCohort(privatePlan); // Before extracting any packet paths.
  const transactionId=sha256hex(`${privatePlan.projectId}\n${privatePlan.planDigest}\n${revision}`);
  const packet={schemaVersion:TREE_JOURNAL_SCHEMA_VERSION,projectId:privatePlan.projectId,manifestPath,transactionId,
    revision,plan:privatePlan,entries:buildTreeEntries(privatePlan,manifestPath,revision,transactionId)};
  if(privatePlan.kind==='undo')await validateTreePacket(privatePlan.input.retainedPacket,manifestPath);
  if(privatePlan.kind==='word-mixed-return'&&privatePlan.input.history) {
    if(JSON.parse(privatePlan.input.returnProofJson).schemaVersion===6)validateTreePacketBinding(privatePlan.input.history.applyPacket,manifestPath);
    else await validateTreePacket(privatePlan.input.history.applyPacket,manifestPath);
  }
  if(privatePlan.input.recoveredCopy)await validateTreePacket(privatePlan.input.recoveredCopy.retainedPacket,manifestPath);
  validateTreePacketBinding(packet,manifestPath);
  return freezeTreeValue(packet);
}
function validateTreeJournalEnvelope(journal, source, manifestPath) {
  treeNeed(Buffer.byteLength(source) <= treeEnvelopeLimit(journal.packet), 'E_TREE_COHORT_BUDGET');
  treeNeed(journal.schemaVersion === TREE_JOURNAL_SCHEMA_VERSION && journal.transactionId === journal.packet.transactionId
    && journal.manifestPath === manifestPath && (journal.previousReceiptText === null || typeof journal.previousReceiptText === 'string'), 'E_TREE_COHORT_JOURNAL');
  const receipt = JSON.parse(journal.receiptText);
  treeNeed(receipt.schemaVersion === TREE_RECEIPT_SCHEMA_VERSION && receipt.projectId === journal.packet.projectId
    && receipt.transactionId === journal.transactionId && receipt.packetDigest === sha256hex(canonicalize(journal.packet))
    && receipt.treeRevision === journal.packet.plan.expectedTreeRevision + 1 && receipt.kind === journal.packet.plan.kind, 'E_TREE_COHORT_RECEIPT');
  return journal;
}
async function parseTreeJournal(source, manifestPath) {
  treeNeed(typeof source === 'string' && Buffer.byteLength(source) <= MAX_NOVEL_WORD_RETURN_BYTES, 'E_TREE_COHORT_BUDGET');
  let journal; try { journal = JSON.parse(source); } catch { treeError('E_TREE_COHORT_JOURNAL'); }
  await validateTreePacket(journal.packet, manifestPath);
  return validateTreeJournalEnvelope(journal,source,manifestPath);
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
async function readVerifiedProjectTreeMutation(options) {
  return readVerifiedProjectTreeMutationInInvocation(options);
}
async function readVerifiedProjectTreeMutationInInvocation({ manifestPath, projectId, fsAdapter = fsp }, invocation = null) {
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
  const target=recoveryPacketPathFor(manifestPath,receipt.transactionId);
  if(invocation){invocation.successPaths ||= new Set();invocation.successPaths.add(target);}
  const packetSource = await readTreeEnvelopeSource(target, manifestPath, fsAdapter);
  treeNeed(packetSource !== null, 'E_TREE_COHORT_PACKET_MISSING');
  const owned=invocation?.successPackets?.get(target)?.packet
    ||(invocation?.origin?.packet.transactionId===receipt.transactionId?invocation.origin.packet:null);
  const packet = owned || await validateTreePacket(JSON.parse(packetSource), manifestPath);
  if(owned)treeNeed(packetSource===canonicalBytes(packet),'E_TREE_COHORT_RECEIPT_BINDING');
  treeNeed(packet.projectId === parsed.projectId && packet.transactionId === receipt.transactionId
    && sha256hex(canonicalize(packet)) === receipt.packetDigest && packet.plan.expectedTreeRevision + 1 === receipt.treeRevision
    && packet.plan.kind === receipt.kind, 'E_TREE_COHORT_RECEIPT_BINDING');
  if(invocation && isNovelWordReturnPacket(packet)) {
    treeNeed(packetSource===canonicalBytes(packet),'E_TREE_COHORT_RECEIPT_BINDING');
    invocation.successPackets ||= new Map();
    invocation.successPackets.clear();
    invocation.successPackets.set(target,freezeTreeValue({packet,source:packetSource}));
  }
  let canUndo = !['undo','word-mixed-return','word-generic-import'].includes(receipt.kind), unavailableReason = canUndo ? null : receipt.kind === 'word-generic-import' ? 'IMPORT_COHORT_INVERSE_UNPROVEN' : receipt.kind === 'word-mixed-return' ? 'EDITORIAL_SCENE_HISTORY_ONLY' : 'TREE_UNDO_CONSUMED';
  let wordReturnHistory=null;
  if(packet.plan.kind==='word-mixed-return') {
    const proof=JSON.parse(packet.plan.input.returnProofJson);
    if([5,6].includes(proof.schemaVersion)) {
      try {
        await inspectTreePacket(packet,manifestPath,fsAdapter,'after',invocation);
        wordReturnHistory={canUndo:proof.schemaVersion===5||proof.action==='redo',canRedo:proof.action==='undo'};
      }catch(error){wordReturnHistory={canUndo:false,canRedo:false,reason:error.code||error.message};}
    }
  }
  if (canUndo) try { await inspectTreePacket(packet, manifestPath, fsAdapter, 'after',invocation); }
  catch (error) { canUndo = false; unavailableReason = error.code || error.message; }
  return { treeRevision: receipt.treeRevision, lastMutation: { id: receipt.transactionId, kind: receipt.kind, canUndo, unavailableReason,
    ...(wordReturnHistory?{wordReturnHistory}: {}) }, receipt, retainedPacket: packet };
}
async function commitTreeCohort({ manifestPath, revision, treeCohort: plan, publishManifest, revalidate, afterTreeFilesPublish, fsAdapter }) {
  treeNeed(typeof revalidate === 'function' && typeof publishManifest === 'function', 'E_TREE_COHORT_AUTHORITY');
  treeNeed(Number.isSafeInteger(revision) && revision >= 0 && plan?.input?.manifestPath === manifestPath ||
    (plan?.kind === 'undo' && plan?.input?.retainedPacket?.manifestPath === manifestPath && Number.isSafeInteger(revision) && revision >= 0), 'E_TREE_COHORT_IDENTITY');
  const localNovel=isNovelTreePacket({plan})||isNovelWordReturnPacket({plan});let packet=null;
  if(localNovel) {packet=await buildVerifiedTreePacket(plan,manifestPath,revision);plan=packet.plan;}
  const model = await treeModel();
  if(!localNovel)model.validateProjectTreeCohort(plan);
  let privateRead=localNovel?createNovelReadInvocation(manifestPath,fsAdapter):null;
  await revalidate();
  if (await readOptionalText(journalPathFor(manifestPath), privateRead?.reader||fsAdapter) !== null) treeError('E_PROJECT_TRANSACTION_RECOVERY_REQUIRED');
  const current = await readVerifiedProjectTreeMutationInInvocation({ manifestPath, projectId: plan.projectId, fsAdapter:privateRead?.reader||fsAdapter },privateRead?.invocation);
  treeNeed(current.treeRevision === plan.expectedTreeRevision, 'E_TREE_REVISION_CAS');
  if(plan.kind==='word-mixed-return'&&plan.input.history) {
    const proof=JSON.parse(plan.input.returnProofJson),apply=current.retainedPacket.plan.input.history?.applyPacket||current.retainedPacket;
    treeNeed(current.lastMutation?.wordReturnHistory?.[proof.action==='undo'?'canUndo':'canRedo']===true
      &&canonicalize(current.receipt)===canonicalize(plan.input.history.receipt)
      &&canonicalize(apply)===canonicalize(plan.input.history.applyPacket),'E_WORD_BOOK_HISTORY_UNAVAILABLE');
  }
  if (plan.kind === 'undo') treeNeed(current.lastMutation?.canUndo && current.lastMutation.id === plan.input.lastMutation
    && canonicalize(current.retainedPacket) === canonicalize(plan.input.retainedPacket), 'E_TREE_UNDO_UNAVAILABLE');
  if (plan.input.recoveredCopy) treeNeed(['undo', 'copy', 'split', 'merge'].includes(current.receipt?.kind)
    && canonicalize(current.receipt) === canonicalize(plan.input.recoveredCopy.receipt)
    && canonicalize(current.retainedPacket) === canonicalize(plan.input.recoveredCopy.retainedPacket), 'E_TREE_RECOVERY_BINDING');
  if (!plan.changed) {
    if(privateRead)await privateRead.assertFresh();
    return { success: true, changed: false, code: 'TREE_COHORT_UNCHANGED', treeRevision: current.treeRevision, lastMutation: current.lastMutation };
  }
  const transactionId=sha256hex(`${plan.projectId}\n${plan.planDigest}\n${revision}`);
  if(!packet) {
    packet={schemaVersion:TREE_JOURNAL_SCHEMA_VERSION,projectId:plan.projectId,manifestPath,transactionId,
      revision,plan,entries:buildTreeEntries(plan,manifestPath,revision,transactionId)};
    await validateTreePacket(packet,manifestPath);
  }
  await inspectTreePacket(packet, manifestPath, privateRead?.reader||fsAdapter, 'before',privateRead?.invocation);
  const previousReceiptText = await readOptionalText(treeCommitPathFor(manifestPath), privateRead?.reader||fsAdapter);
  const receipt = { schemaVersion: TREE_RECEIPT_SCHEMA_VERSION, projectId: plan.projectId, transactionId,
    treeRevision: current.treeRevision + 1, kind: plan.kind, packetDigest: sha256hex(canonicalize(packet)) };
  const receiptText = canonicalBytes(receipt), journal = { schemaVersion: TREE_JOURNAL_SCHEMA_VERSION,
    manifestPath, transactionId, previousReceiptText, receiptText, packet };
  const journalText = canonicalBytes(journal);
  // These canonical bytes come from this invocation's frozen, fully verified
  // packet. External and recovery journals still regenerate through the parser.
  if(localNovel)validateTreeJournalEnvelope(journal,journalText,manifestPath);
  else await parseTreeJournal(journalText,manifestPath);
  if (plan.kind === 'word-generic-import') {
    const packetText = canonicalBytes(packet), origin = {path:recoveryPacketPathFor(manifestPath,transactionId),digest:sha256hex(packetText),bytes:Buffer.byteLength(packetText)};
    for (const scene of packet.entries.filter(entry => entry.role === 'scene' && entry.beforeBase64 === null)) {
      const commit = packet.entries.find(entry => entry.role === 'sceneCommit' && entry.relativePath === scene.relativePath+'.wp201-commit.json');
      const record = JSON.parse(treeText(commit.afterBase64));
      normalizeRetainedResources([...(record.resources || []),origin],record.scenePath,manifestPath);
    }
  }
  await revalidate();
  if(privateRead)await privateRead.assertFresh();
  privateRead=null; // Reuse ends before the first durable write.
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
    lastMutation: { id: transactionId, kind: plan.kind, canUndo: !['undo','word-mixed-return','word-generic-import'].includes(plan.kind), unavailableReason: plan.kind === 'word-generic-import' ? 'IMPORT_COHORT_INVERSE_UNPROVEN' : plan.kind === 'word-mixed-return' ? 'EDITORIAL_SCENE_HISTORY_ONLY' : plan.kind === 'undo' ? 'TREE_UNDO_CONSUMED' : null },
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
  readVerifiedProjectDocxNovelCohort,
  readVerifiedNovelAnnotationLineage,
  recoveryPacketPathFor,
  recoverProjectTransaction,
  repairCorruptProjectCommit,
  readVerifiedProjectTreeMutation,
  treeCommitPathFor,
});

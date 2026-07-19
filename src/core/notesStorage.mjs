import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const NOTES_STORAGE_SCHEMA_VERSION = 1;
export const NOTES_STORAGE_FILENAME = 'notes.craftsman.json';
export const NOTES_RECOVERY_DIRNAME = 'notes-recovery';
export const NOTE_ID_PREFIX = 'note-';
export const NOTES_BODY_MAX_LENGTH = 200000;

const NOTE_SCOPES = new Set(['inbox', 'project', 'manuscript', 'scene', 'selection']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeString(value, maxLength = 8192) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeOptionalString(value, maxLength = 8192) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeLosslessBody(value) {
  if (typeof value !== 'string') return '';
  return value.length > NOTES_BODY_MAX_LENGTH ? value.slice(0, NOTES_BODY_MAX_LENGTH) : value;
}

function validateLosslessBody(value) {
  if (typeof value !== 'string') return { ok: true };
  if (value.length <= NOTES_BODY_MAX_LENGTH) return { ok: true };
  return {
    ok: false,
    code: 'E_NOTE_BODY_TOO_LARGE',
    reason: 'NOTE_BODY_TOO_LARGE',
    details: {
      maxLength: NOTES_BODY_MAX_LENGTH,
      actualLength: value.length,
    },
  };
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeNotesHash(value) {
  return crypto.createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
}

function normalizeNoteId(value) {
  const noteId = normalizeString(value, 128);
  if (!noteId || !/^[A-Za-z0-9._:-]+$/u.test(noteId)) return '';
  return noteId;
}

function createDeterministicNoteId(projectId, note, index) {
  const seed = [
    normalizeOptionalString(projectId, 128),
    normalizeOptionalString(note.scope, 64),
    normalizeOptionalString(note.title, 512),
    normalizeOptionalString(note.body, 8192),
    normalizeOptionalString(note.sceneId, 256),
    normalizeOptionalString(note.nodeId, 256),
    String(index),
  ].join('\u0000');
  const digest = crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${NOTE_ID_PREFIX}${digest.slice(0, 32)}`;
}

export function createNoteId(projectId, seed = '') {
  const normalizedSeed = normalizeOptionalString(seed, 4096) || crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex');
  const digest = crypto.createHash('sha256')
    .update(`${normalizeOptionalString(projectId, 128)}\u0000${normalizedSeed}`, 'utf8')
    .digest('hex');
  return `${NOTE_ID_PREFIX}${digest.slice(0, 32)}`;
}

function normalizeScope(value) {
  const scope = normalizeString(value, 64).toLowerCase();
  return NOTE_SCOPES.has(scope) ? scope : 'inbox';
}

function normalizeCreatedAt(value, fallback) {
  const text = normalizeString(value, 64);
  return text || fallback;
}

function normalizeAttachment(source, scope) {
  const value = isPlainObject(source) ? cloneJson(source) : {};
  value.scope = scope;

  if (scope === 'scene' || scope === 'selection') {
    value.sceneId = normalizeString(value.sceneId, 256);
    value.nodeId = normalizeString(value.nodeId, 256);
  } else {
    delete value.sceneId;
    delete value.nodeId;
  }

  if (scope === 'selection') {
    const anchor = isPlainObject(value.anchor) ? cloneJson(value.anchor) : {};
    value.anchor = {
      ...anchor,
      kind: normalizeString(anchor.kind, 64) || 'text-range',
      start: Number.isSafeInteger(anchor.start) && anchor.start >= 0 ? anchor.start : 0,
      end: Number.isSafeInteger(anchor.end) && anchor.end >= 0 ? anchor.end : 0,
      quoteHash: normalizeString(anchor.quoteHash, 128),
    };
    if (value.anchor.end < value.anchor.start) {
      value.anchor.end = value.anchor.start;
    }
  } else {
    delete value.anchor;
  }

  return value;
}

function normalizeNote(source, index, context) {
  if (!isPlainObject(source)) return null;
  const note = cloneJson(source);
  const scope = normalizeScope(note.scope || note.kind || note.attachment?.scope);
  note.schemaVersion = NOTES_STORAGE_SCHEMA_VERSION;
  note.scope = scope;
  note.id = normalizeNoteId(note.id) || createDeterministicNoteId(context.projectId, note, index);
  note.title = normalizeOptionalString(note.title, 512);
  note.body = normalizeLosslessBody(note.body);
  note.createdAtUtc = normalizeCreatedAt(note.createdAtUtc, context.nowIso);
  note.updatedAtUtc = normalizeCreatedAt(note.updatedAtUtc, note.createdAtUtc);
  note.deleted = note.deleted === true || note.tombstone === true;
  note.attachment = normalizeAttachment(note.attachment || note, scope);

  if (scope === 'scene' || scope === 'selection') {
    note.sceneId = note.attachment.sceneId;
    note.nodeId = note.attachment.nodeId;
  } else {
    delete note.sceneId;
    delete note.nodeId;
  }

  if (note.deleted) {
    note.deletedAtUtc = normalizeCreatedAt(note.deletedAtUtc, note.updatedAtUtc);
  } else {
    delete note.deletedAtUtc;
  }

  return note;
}

function normalizeNoteList(items, context) {
  const sourceItems = Array.isArray(items) ? items : [];
  const notes = [];
  const seen = new Set();
  for (let index = 0; index < sourceItems.length; index += 1) {
    const note = normalizeNote(sourceItems[index], index, context);
    if (!note) continue;
    let noteId = note.id;
    if (seen.has(noteId)) {
      noteId = createDeterministicNoteId(context.projectId, note, `${index}:duplicate`);
      note.id = noteId;
    }
    seen.add(noteId);
    notes.push(note);
  }
  return notes.sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeNotesDocument(source = {}, options = {}) {
  const nowIso = typeof options.now === 'function' ? options.now() : new Date().toISOString();
  const projectId = normalizeOptionalString(options.projectId || source.projectId, 128);
  const base = isPlainObject(source) ? cloneJson(source) : {};
  const notes = normalizeNoteList(base.notes, { projectId, nowIso });
  const normalized = {
    ...base,
    schemaVersion: NOTES_STORAGE_SCHEMA_VERSION,
    projectId,
    notes,
  };
  return {
    ok: true,
    value: normalized,
    changed: stableJson(source || {}) !== stableJson(normalized),
    hash: computeNotesHash(normalized),
  };
}

export function toPublicNote(note) {
  if (!isPlainObject(note)) return null;
  const publicNote = {
    id: normalizeNoteId(note.id),
    scope: normalizeScope(note.scope),
    title: normalizeOptionalString(note.title, 512),
    body: typeof note.body === 'string' ? note.body : '',
    createdAtUtc: normalizeOptionalString(note.createdAtUtc, 64),
    updatedAtUtc: normalizeOptionalString(note.updatedAtUtc, 64),
    deleted: note.deleted === true,
    attachment: normalizeAttachment(note.attachment || note, normalizeScope(note.scope)),
    contentHash: computeNotesHash({ body: typeof note.body === 'string' ? note.body : '' }),
  };
  if (publicNote.deleted) {
    publicNote.deletedAtUtc = normalizeOptionalString(note.deletedAtUtc, 64);
  }
  if (Array.isArray(note.conversions)) {
    publicNote.conversions = note.conversions
      .filter(isPlainObject)
      .map((conversion) => ({
        kind: normalizeOptionalString(conversion.kind, 64) || 'scene',
        sceneId: normalizeOptionalString(conversion.sceneId, 512),
        createdAtUtc: normalizeOptionalString(conversion.createdAtUtc, 64),
      }));
  }
  return publicNote;
}

export function buildNotesReadModel(document, options = {}) {
  const normalized = normalizeNotesDocument(document, options).value;
  const includeDeleted = options.includeDeleted === true;
  const scope = normalizeOptionalString(options.scope, 64).toLowerCase();
  const notes = normalized.notes
    .filter((note) => includeDeleted || note.deleted !== true)
    .filter((note) => !scope || note.scope === scope)
    .map(toPublicNote)
    .filter(Boolean);
  return {
    ok: true,
    schemaVersion: 'notes-read-model.v1',
    projectId: normalized.projectId,
    state: 'ready',
    scope: scope || 'all',
    notes,
    counts: {
      total: normalized.notes.filter((note) => note.deleted !== true).length,
      deleted: normalized.notes.filter((note) => note.deleted === true).length,
      inbox: normalized.notes.filter((note) => note.deleted !== true && note.scope === 'inbox').length,
    },
    documentHash: computeNotesHash(normalized),
  };
}

function findNoteIndex(document, noteId) {
  const normalizedId = normalizeNoteId(noteId);
  if (!normalizedId) return -1;
  return document.notes.findIndex((note) => note.id === normalizedId);
}

export function applyNotesMutation(document, mutation = {}, options = {}) {
  const nowIso = typeof options.now === 'function' ? options.now() : new Date().toISOString();
  const projectId = normalizeOptionalString(options.projectId || document?.projectId, 128);
  const base = normalizeNotesDocument(document, { projectId, now: () => nowIso }).value;
  const next = cloneJson(base);
  const op = normalizeOptionalString(mutation.op, 64);
  let noteId = normalizeNoteId(mutation.noteId);
  let changed = false;

  if (
    (op === 'create' || op === 'update')
    && Object.prototype.hasOwnProperty.call(mutation, 'body')
  ) {
    const bodyValidation = validateLosslessBody(mutation.body);
    if (!bodyValidation.ok) return bodyValidation;
  }

  if (op === 'create') {
    noteId = noteId || createNoteId(projectId, `${mutation.scope || 'inbox'}\u0000${mutation.title || ''}\u0000${mutation.body || ''}\u0000${nowIso}`);
    if (findNoteIndex(next, noteId) >= 0) {
      return { ok: false, code: 'E_NOTE_ALREADY_EXISTS', reason: 'NOTE_ALREADY_EXISTS' };
    }
    const note = normalizeNote({
      ...mutation,
      id: noteId,
      createdAtUtc: nowIso,
      updatedAtUtc: nowIso,
    }, next.notes.length, { projectId, nowIso });
    next.notes.push(note);
    changed = true;
  } else {
    const index = findNoteIndex(next, noteId);
    if (index < 0) {
      return { ok: false, code: 'E_NOTE_NOT_FOUND', reason: 'NOTE_NOT_FOUND' };
    }
    const current = next.notes[index];
    if (op === 'update') {
      if (current.deleted === true) {
        return { ok: false, code: 'E_NOTE_DELETED', reason: 'NOTE_DELETED' };
      }
      next.notes[index] = normalizeNote({
        ...current,
        title: Object.prototype.hasOwnProperty.call(mutation, 'title') ? mutation.title : current.title,
        body: Object.prototype.hasOwnProperty.call(mutation, 'body') ? mutation.body : current.body,
        updatedAtUtc: nowIso,
      }, index, { projectId, nowIso });
      changed = true;
    } else if (op === 'delete') {
      if (current.deleted !== true) {
        next.notes[index] = {
          ...current,
          deleted: true,
          deletedAtUtc: nowIso,
          updatedAtUtc: nowIso,
        };
        changed = true;
      }
    } else if (op === 'restore') {
      if (current.deleted === true) {
        const restored = { ...current, deleted: false, updatedAtUtc: nowIso };
        delete restored.deletedAtUtc;
        next.notes[index] = restored;
        changed = true;
      }
    } else if (op === 'attachToScene') {
      if (current.deleted === true) {
        return { ok: false, code: 'E_NOTE_DELETED', reason: 'NOTE_DELETED' };
      }
      next.notes[index] = normalizeNote({
        ...current,
        scope: 'scene',
        sceneId: mutation.sceneId,
        nodeId: mutation.nodeId,
        attachment: {
          ...(isPlainObject(current.attachment) ? current.attachment : {}),
          scope: 'scene',
          sceneId: mutation.sceneId,
          nodeId: mutation.nodeId,
        },
        updatedAtUtc: nowIso,
      }, index, { projectId, nowIso });
      changed = true;
    } else if (op === 'recordConversion') {
      if (current.deleted === true) {
        return { ok: false, code: 'E_NOTE_DELETED', reason: 'NOTE_DELETED' };
      }
      const sceneId = normalizeOptionalString(mutation.sceneId, 512);
      if (!sceneId) {
        return { ok: false, code: 'E_NOTE_CONVERSION_SCENE_REQUIRED', reason: 'NOTE_CONVERSION_SCENE_REQUIRED' };
      }
      next.notes[index] = {
        ...current,
        conversions: [
          ...(Array.isArray(current.conversions) ? current.conversions.filter(isPlainObject) : []),
          {
            kind: 'scene',
            sceneId,
            createdAtUtc: nowIso,
          },
        ],
        updatedAtUtc: nowIso,
      };
      changed = true;
    } else {
      return { ok: false, code: 'E_NOTES_MUTATION_UNSUPPORTED', reason: 'NOTES_MUTATION_UNSUPPORTED' };
    }
  }

  next.notes = normalizeNoteList(next.notes, { projectId, nowIso });
  return {
    ok: true,
    changed,
    noteId,
    document: next,
    note: toPublicNote(next.notes[findNoteIndex(next, noteId)]),
    hash: computeNotesHash(next),
  };
}

export function buildEmptyNotesDocument(projectId, options = {}) {
  return normalizeNotesDocument({ schemaVersion: NOTES_STORAGE_SCHEMA_VERSION, projectId, notes: [] }, options).value;
}

export function getNotesStoragePath(projectRoot) {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) {
    throw new Error('NOTES_PROJECT_ROOT_REQUIRED');
  }
  return path.join(projectRoot, NOTES_STORAGE_FILENAME);
}

function safeBasename(filePath) {
  return path.basename(String(filePath || 'notes'));
}

export async function createNotesRecoverySnapshot({ projectRoot, notesPath, sourceText, now = () => new Date().toISOString() } = {}) {
  const text = typeof sourceText === 'string' ? sourceText : '';
  const recoveryRoot = path.join(projectRoot, 'backups', NOTES_RECOVERY_DIRNAME);
  const timestamp = String(now()).replace(/[^0-9A-Za-z._-]/gu, '-');
  const snapshotName = `${safeBasename(notesPath)}.${timestamp}.recovery.json`;
  const snapshotPath = path.join(recoveryRoot, snapshotName);
  await fs.mkdir(recoveryRoot, { recursive: true });
  await fs.writeFile(snapshotPath, text, 'utf8');
  const recoveredText = await fs.readFile(snapshotPath, 'utf8');
  return {
    snapshotCreated: true,
    snapshotReadable: recoveredText === text,
    snapshotHashMatchesInput: crypto.createHash('sha256').update(recoveredText, 'utf8').digest('hex')
      === crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
    sourceHash: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
    recoveryAction: 'OPEN_SNAPSHOT_OR_ABORT',
  };
}

export async function readNotesStorage({ projectRoot, projectId, readFile = fs.readFile, now } = {}) {
  const notesPath = getNotesStoragePath(projectRoot);
  try {
    const raw = await readFile(notesPath, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeNotesDocument(parsed, { projectId, now });
    return {
      ok: true,
      state: normalized.changed ? 'needs_migration' : 'ready',
      notesPath,
      document: normalized.value,
      hash: normalized.hash,
      sourceText: raw,
      sourceExists: true,
      parseError: null,
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const empty = buildEmptyNotesDocument(projectId, { now });
      return {
        ok: true,
        state: 'missing',
        notesPath,
        document: empty,
        hash: computeNotesHash(empty),
        sourceText: '',
        sourceExists: false,
        parseError: null,
      };
    }
    return {
      ok: false,
      state: 'corrupt',
      notesPath,
      document: null,
      hash: '',
      sourceText: '',
      sourceExists: true,
      parseError: error && typeof error.message === 'string' ? error.message : 'NOTES_READ_FAILED',
    };
  }
}

export async function migrateNotesStorage({
  projectRoot,
  projectId,
  readFile = fs.readFile,
  writeFileAtomic,
  now,
} = {}) {
  if (typeof writeFileAtomic !== 'function') {
    throw new Error('NOTES_ATOMIC_WRITER_REQUIRED');
  }
  const current = await readNotesStorage({ projectRoot, projectId, readFile, now });
  if (current.ok && current.state === 'ready') {
    return {
      ok: true,
      migrated: false,
      state: 'ready',
      receipt: {
        schemaVersion: 'notes-storage-migration-receipt.v1',
        migrated: false,
        noteCount: current.document.notes.length,
        hash: current.hash,
        recovery: null,
      },
      document: current.document,
    };
  }
  const notesPath = getNotesStoragePath(projectRoot);
  let sourceText = current.sourceText || '';
  if (!current.ok && current.sourceExists) {
    try {
      sourceText = await readFile(notesPath, 'utf8');
    } catch {}
  }
  const recovery = sourceText
    ? await createNotesRecoverySnapshot({ projectRoot, notesPath, sourceText, now })
    : null;
  const document = current.ok ? current.document : buildEmptyNotesDocument(projectId, { now });
  const content = `${JSON.stringify(document, null, 2)}\n`;
  const writeResult = await writeFileAtomic(notesPath, content);
  if (!writeResult || writeResult.success !== true) {
    return {
      ok: false,
      code: 'E_NOTES_STORAGE_WRITE_FAILED',
      reason: 'NOTES_STORAGE_WRITE_FAILED',
      recovery,
    };
  }
  return {
    ok: true,
    migrated: true,
    state: current.state,
    receipt: {
      schemaVersion: 'notes-storage-migration-receipt.v1',
      migrated: true,
      noteCount: document.notes.length,
      hash: computeNotesHash(document),
      recovery,
    },
    document,
  };
}

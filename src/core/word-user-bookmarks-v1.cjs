'use strict';

// Scene-owned semantic identities. Word numeric IDs and equal selected text
// are deliberately absent: only governed commands or bounded import bind IDs.
const { sha256Hex, canonicalSerialize } = require('./browser-safe-hash.cjs');
const KEY = 'wordUserBookmarks';
const SCHEMA = 'yalken.word-user-bookmarks.v1';
const MAX_BOOKMARKS = 1024;
const MAX_TEXT = 8 * 1024 * 1024;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const clone = value => JSON.parse(JSON.stringify(value));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => canonicalSerialize(a) === canonicalSerialize(b);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exact(value, required, optional = []) {
  if (!plain(value)) fail('USER_BOOKMARK_SHAPE_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string'
    || !required.concat(optional).includes(key) || !own(descriptors[key], 'value'))
    || required.some(key => !own(value, key))) fail('USER_BOOKMARK_SHAPE_INVALID');
}
function array(value, cap) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length > cap || Reflect.ownKeys(value).some(key => key !== 'length'
      && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)
        || Number(key) >= value.length || !own(Object.getOwnPropertyDescriptor(value, key), 'value')))
    || Object.keys(value).length !== value.length) fail('USER_BOOKMARK_ARRAY_INVALID');
}
function validName(name) {
  if (typeof name !== 'string' || name.length > 40 || !/^\p{L}[\p{L}\p{N}_]*$/u.test(name)
    || /^YRTK_/i.test(name) || /^_GoBack$/i.test(name)) fail('USER_BOOKMARK_NAME_INVALID');
  return name;
}
const nameKey = name => validName(name).toLowerCase();
function validId(id) {
  if (typeof id !== 'string' || !/^ubm-[a-f0-9]{32}$/.test(id)) fail('USER_BOOKMARK_ID_INVALID');
  return id;
}
function walk(doc, visitor) {
  if (!plain(doc) || doc.type !== 'doc' || !Array.isArray(doc.content)) fail('USER_BOOKMARK_DOCUMENT_INVALID');
  const seen = new Set(); let count = 0, textSize = 0;
  const visit = (node, path, depth) => {
    if (!plain(node) || seen.has(node) || depth > 64 || ++count > 100000) fail('USER_BOOKMARK_DOCUMENT_BUDGET');
    if (Reflect.ownKeys(node).some(key => typeof key !== 'string'
      || !own(Object.getOwnPropertyDescriptor(node, key), 'value'))) fail('USER_BOOKMARK_DOCUMENT_INVALID');
    seen.add(node);
    if (typeof node.text === 'string') {
      textSize += node.text.length;
      if (textSize > MAX_TEXT || /[\u0000\r]/u.test(node.text)
        || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(node.text)) fail('USER_BOOKMARK_TEXT_INVALID');
    }
    visitor(node, path);
    if (node.content !== undefined) {
      array(node.content, 100000);
      node.content.forEach((child, i) => visit(child, path.concat(i), depth + 1));
    }
  };
  visit(doc, [], 0);
}
function paragraphs(doc) {
  const out = [];
  walk(doc, node => {
    if (['paragraph', 'heading', 'codeBlock'].includes(node.type)) out.push(node);
    else if (node.type === 'horizontalRule') fail('USER_BOOKMARK_STRUCTURE_UNSUPPORTED');
  });
  if (!out.length || out.length > 10000) fail('USER_BOOKMARK_STRUCTURE_UNSUPPORTED');
  return out;
}
function textOf(paragraph) {
  if (!plain(paragraph) || !['paragraph', 'heading', 'codeBlock'].includes(paragraph.type)) fail('USER_BOOKMARK_STRUCTURE_UNSUPPORTED');
  const content = paragraph.content || []; array(content, 100000);
  return content.map(node => {
    if (node.type === 'text' && typeof node.text === 'string') return node.text;
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'image') return ''; // Exporter media occupies no UTF16 text.
    fail('USER_BOOKMARK_INLINE_UNSUPPORTED');
  }).join('');
}
function boundaries(text) {
  const result = new Set([text.length]);
  for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) result.add(part.index);
  return result;
}
function endpointShape(endpoint) {
  exact(endpoint, ['paragraphIndex', 'offsetUtf16', 'edge']);
  if (!integer(endpoint.paragraphIndex) || endpoint.paragraphIndex >= 10000
    || !integer(endpoint.offsetUtf16) || endpoint.offsetUtf16 > MAX_TEXT
    || !['text', 'afterParagraph'].includes(endpoint.edge)) fail('USER_BOOKMARK_ENDPOINT_INVALID');
}
function endpointValue(blocks, endpoint, cache = new Map()) {
  endpointShape(endpoint);
  const node = blocks[endpoint.paragraphIndex];
  if (!node) fail('USER_BOOKMARK_ENDPOINT_BOUNDS');
  if (!cache.has(endpoint.paragraphIndex)) {
    const text = textOf(node); cache.set(endpoint.paragraphIndex, { text, edges: boundaries(text) });
  }
  const { text, edges } = cache.get(endpoint.paragraphIndex);
  if (!edges.has(endpoint.offsetUtf16)
    || (endpoint.edge === 'afterParagraph' && endpoint.offsetUtf16 !== text.length)) fail('USER_BOOKMARK_ENDPOINT_BOUNDARY');
  return endpoint.offsetUtf16 + (endpoint.edge === 'afterParagraph' ? 1 : 0);
}
function endpointOrder(a, b) {
  return a.paragraphIndex - b.paragraphIndex || a.offsetUtf16 - b.offsetUtf16
    || (a.edge === b.edge ? 0 : a.edge === 'afterParagraph' ? 1 : -1);
}
function endpointOffset(doc, endpoint) {
  const blocks = paragraphs(doc);
  let offset = endpointValue(blocks, endpoint);
  for (let i = 0; i < endpoint.paragraphIndex; i++) offset += textOf(blocks[i]).length + 1;
  return offset;
}
function endpointForOffset(doc, offset) {
  if (!integer(offset)) fail('USER_BOOKMARK_ENDPOINT_BOUNDS');
  const blocks = paragraphs(doc);
  for (let i = 0; i < blocks.length; i++) {
    const length = textOf(blocks[i]).length;
    if (offset <= length) {
      const endpoint = { paragraphIndex: i, offsetUtf16: offset, edge: 'text' };
      endpointValue(blocks, endpoint); return endpoint;
    }
    if (i === blocks.length - 1 && offset === length + 1) return { paragraphIndex: i, offsetUtf16: length, edge: 'afterParagraph' };
    offset -= length + 1;
  }
  fail('USER_BOOKMARK_ENDPOINT_BOUNDS');
}
function validateRegistry(value, doc, { checkBounds = true } = {}) {
  exact(value, ['schemaVersion', 'revision', 'bookmarks']);
  if (value.schemaVersion !== SCHEMA || !integer(value.revision)) fail('USER_BOOKMARK_REGISTRY_INVALID');
  array(value.bookmarks, MAX_BOOKMARKS);
  if (value.bookmarks.length) noPending(doc);
  const ids = new Set(), names = new Set(), blocks = checkBounds ? paragraphs(doc) : null, cache = new Map();
  for (const record of value.bookmarks) {
    if (!plain(record)) fail('USER_BOOKMARK_SHAPE_INVALID');
    exact(record, ['id', 'name', 'state'], ['start', 'end']);
    validId(record.id); validName(record.name);
    if (ids.has(record.id)) fail('USER_BOOKMARK_DUPLICATE_ID');
    ids.add(record.id);
    if (!['active', 'deleted'].includes(record.state)) fail('USER_BOOKMARK_STATE_INVALID');
    if (record.state === 'deleted' && (own(record, 'start') || own(record, 'end'))) fail('USER_BOOKMARK_SHAPE_INVALID');
    if (record.state === 'active') {
      if (names.has(nameKey(record.name))) fail('USER_BOOKMARK_DUPLICATE_NAME');
      names.add(nameKey(record.name)); endpointShape(record.start); endpointShape(record.end);
      if (endpointOrder(record.start, record.end) > 0) fail('USER_BOOKMARK_ENDPOINT_ORDER');
      if (blocks) { endpointValue(blocks, record.start, cache); endpointValue(blocks, record.end, cache); }
    }
  }
  if (checkBounds) protectLinkedDeletedNames(doc, value);
  return clone(value);
}
function readRegistry(doc, options) {
  if (!plain(doc)) fail('USER_BOOKMARK_DOCUMENT_INVALID');
  const attrDescriptor = Object.getOwnPropertyDescriptor(doc, 'attrs');
  if (attrDescriptor && !own(attrDescriptor, 'value')) fail('USER_BOOKMARK_SHAPE_INVALID');
  const attrs = attrDescriptor?.value;
  if (attrs != null && !plain(attrs)) fail('USER_BOOKMARK_SHAPE_INVALID');
  const descriptor = attrs && Object.getOwnPropertyDescriptor(attrs, KEY);
  if (descriptor && !own(descriptor, 'value')) fail('USER_BOOKMARK_SHAPE_INVALID');
  if (!attrs || !own(attrs, KEY) || attrs[KEY] === null) return null;
  return validateRegistry(attrs[KEY], doc, options);
}
function noPending(doc) {
  const attrsDescriptor = doc && Object.getOwnPropertyDescriptor(doc, 'attrs');
  if (attrsDescriptor && !own(attrsDescriptor, 'value')) fail('USER_BOOKMARK_SHAPE_INVALID');
  const attrs = attrsDescriptor?.value;
  if (attrs != null && !plain(attrs)) fail('USER_BOOKMARK_SHAPE_INVALID');
  const pending = attrs && Object.getOwnPropertyDescriptor(attrs, 'wordPendingRevisions');
  if (pending && !own(pending, 'value')) fail('USER_BOOKMARK_SHAPE_INVALID');
  if (pending?.value != null) fail('USER_BOOKMARK_PENDING_COMPOSITE_UNSUPPORTED');
}
function linkAttrs(record) {
  validId(record?.id); validName(record?.name);
  return { href: '#' + record.name, wordBookmarkId: record.id, wordBookmarkName: record.name };
}
function validatedInternalLinkAttrs(mark, { allowUnbound = false } = {}) {
  if (mark == null) return null;
  if (!plain(mark) || Reflect.ownKeys(mark).some(key => typeof key !== 'string'
    || !own(Object.getOwnPropertyDescriptor(mark, key), 'value'))) fail('USER_BOOKMARK_LINK_INVALID');
  if (mark.type !== 'link') return null;
  const attrs = mark.attrs || {};
  if (!plain(attrs) || Reflect.ownKeys(attrs).some(key => typeof key !== 'string'
    || !own(Object.getOwnPropertyDescriptor(attrs, key), 'value'))) fail('USER_BOOKMARK_LINK_INVALID');
  const typed = attrs.wordBookmarkId != null || attrs.wordBookmarkName != null;
  const internal = typeof attrs.href === 'string' && attrs.href.startsWith('#');
  if (!typed && !internal) return null;
  if (!plain(attrs) || !internal) fail('USER_BOOKMARK_LINK_INVALID');
  exact(attrs, ['href'], ['target', 'rel', 'class', 'title', 'wordBookmarkId', 'wordBookmarkName']);
  if (own(attrs, 'title') && attrs.title !== null) fail('USER_BOOKMARK_LINK_TITLE_UNSUPPORTED');
  if (['target', 'rel', 'class'].some(key => attrs[key] != null && typeof attrs[key] !== 'string')) fail('USER_BOOKMARK_LINK_INVALID');
  const name = validName(attrs.href.slice(1));
  if (allowUnbound && attrs.wordBookmarkId == null) {
    if (attrs.wordBookmarkName != null && attrs.wordBookmarkName !== name) fail('USER_BOOKMARK_LINK_NAME_MISMATCH');
    return null;
  }
  validId(attrs.wordBookmarkId);
  if (attrs.wordBookmarkName !== name) fail('USER_BOOKMARK_LINK_NAME_MISMATCH');
  return attrs;
}
function inspectInternalLink(mark, registry, options) {
  const attrs = validatedInternalLinkAttrs(mark, options);
  if (!attrs) return null;
  const record = registry?.bookmarks?.find(item => item.id === attrs.wordBookmarkId);
  if (!record || record.name !== attrs.wordBookmarkName) fail('USER_BOOKMARK_LINK_TARGET_INVALID');
  return clone(record);
}
function visitLinks(doc, visitor) {
  walk(doc, node => {
    if (node.marks !== undefined) {
      array(node.marks, 64);
      for (const mark of node.marks) {
        if (!plain(mark) || Reflect.ownKeys(mark).some(key => typeof key !== 'string'
          || !own(Object.getOwnPropertyDescriptor(mark, key), 'value'))) fail('USER_BOOKMARK_LINK_INVALID');
        if (mark.type === 'link') visitor(mark);
      }
    }
  });
}
function protectLinkedDeletedNames(doc, registry) {
  const activeNames = new Set(registry.bookmarks.filter(record => record.state === 'active').map(record => nameKey(record.name)));
  const deletedById = new Map(registry.bookmarks.filter(record => record.state === 'deleted').map(record => [record.id, record]));
  if (!deletedById.size || !activeNames.size) return;
  visitLinks(doc, mark => {
    if (mark.attrs != null && !plain(mark.attrs)) fail('USER_BOOKMARK_LINK_INVALID');
    const descriptor = mark.attrs && Object.getOwnPropertyDescriptor(mark.attrs, 'wordBookmarkId');
    if (descriptor && !own(descriptor, 'value')) fail('USER_BOOKMARK_LINK_INVALID');
    const record = deletedById.get(descriptor?.value);
    if (record && activeNames.has(nameKey(record.name))) fail('USER_BOOKMARK_LINKED_TOMBSTONE_NAME_RESERVED');
  });
}
function validateLinks(doc, registry) { visitLinks(doc, mark => inspectInternalLink(mark, registry)); }
// Comparison projection for the pinned editor schema, never registry authority.
// Explicit attributes retain their meaning; only absent inert defaults expand.
function materializeInternalLinkSchemaDefaults(doc) {
  const registry = readRegistry(doc);
  validateLinks(doc, registry);
  visitLinks(doc, mark => {
    if (inspectInternalLink(mark, registry)
      && Object.keys(mark.attrs).some(key => mark.attrs[key] === undefined)) fail('USER_BOOKMARK_LINK_INVALID');
  });
  const out = clone(doc);
  const defaults = { target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null };
  visitLinks(out, mark => {
    if (!inspectInternalLink(mark, registry)) return;
    for (const [key, value] of Object.entries(defaults)) {
      if (!own(mark.attrs, key)) mark.attrs[key] = value;
    }
  });
  return out;
}
function bindRegistry(doc, registry) {
  const out = clone(doc);
  if (registry) out.attrs = { ...(out.attrs || {}), [KEY]: clone(registry) };
  return out;
}
function nextRevision(registry) {
  if (registry.revision === Number.MAX_SAFE_INTEGER) fail('USER_BOOKMARK_REVISION_OVERFLOW');
  registry.revision++;
}
function seedId(seed, suffix) {
  if (typeof seed === 'string') {
    if (!seed || seed.length > 1024 || /[\u0000-\u001f]/u.test(seed)) fail('USER_BOOKMARK_SEED_INVALID');
    return 'ubm-' + sha256Hex(canonicalSerialize([SCHEMA, seed, suffix])).slice(0, 32);
  }
  exact(seed, ['requestId', 'projectId', 'sceneId']);
  if (Object.values(seed).some(value => typeof value !== 'string' || !value || value.length > 1024
    || /[\u0000-\u001f]/u.test(value))) fail('USER_BOOKMARK_SEED_INVALID');
  return 'ubm-' + sha256Hex(canonicalSerialize([SCHEMA, seed, suffix])).slice(0, 32);
}
// XML provenance is evidence only; validate its inert JSON shape, never copy
// it into the registry or use it as an ID, path or command authorization.
function validateProvenance(value) {
  let count = 0;
  const visit = (item, depth) => {
    if (++count > 256 || depth > 8) fail('USER_BOOKMARK_PROVENANCE_INVALID');
    if (item === null || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item === 'string' && item.length <= 2048) return;
    if (Array.isArray(item)) { array(item, 128); item.forEach(child => visit(child, depth + 1)); return; }
    if (!plain(item)) fail('USER_BOOKMARK_PROVENANCE_INVALID');
    for (const key of Reflect.ownKeys(item)) {
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)
        || !own(Object.getOwnPropertyDescriptor(item, key), 'value')) fail('USER_BOOKMARK_PROVENANCE_INVALID');
      visit(item[key], depth + 1);
    }
  };
  visit(value, 0);
}
function importInventory(doc, inventory, seed) {
  noPending(doc);
  seedId(seed, 'validation');
  if (readRegistry(doc) !== null) fail('USER_BOOKMARK_IMPORT_REGISTRY_PRESENT');
  exact(inventory, ['bookmarks'], ['schemaVersion', 'links']); array(inventory.bookmarks, MAX_BOOKMARKS);
  if (inventory.schemaVersion !== undefined && inventory.schemaVersion !== 'yalken.word-user-bookmark-inventory.v1') fail('USER_BOOKMARK_INVENTORY_INVALID');
  if (inventory.links !== undefined) {
    array(inventory.links, 10000);
    const blocks = paragraphs(doc), cache = new Map();
    for (const link of inventory.links) {
      exact(link, ['name', 'paragraphIndex', 'from', 'to'], ['sourceXmlProvenance']); validName(link.name);
      if (!integer(link.paragraphIndex) || !integer(link.from) || !integer(link.to) || link.from > link.to) fail('USER_BOOKMARK_INVENTORY_INVALID');
      endpointValue(blocks, { paragraphIndex: link.paragraphIndex, offsetUtf16: link.from, edge: 'text' }, cache);
      endpointValue(blocks, { paragraphIndex: link.paragraphIndex, offsetUtf16: link.to, edge: 'text' }, cache);
      if (link.sourceXmlProvenance !== undefined) validateProvenance(link.sourceXmlProvenance);
    }
  }
  const registry = { schemaVersion: SCHEMA, revision: 0, bookmarks: [] };
  for (const item of inventory.bookmarks) {
    exact(item, ['name', 'start', 'end'], ['sourceXmlProvenance']); validName(item.name);
    if (item.sourceXmlProvenance !== undefined) validateProvenance(item.sourceXmlProvenance);
    registry.bookmarks.push({ id: seedId(seed, 'import:' + item.name), name: item.name, state: 'active', start: clone(item.start), end: clone(item.end) });
  }
  validateRegistry(registry, doc);
  const out = clone(doc);
  visitLinks(out, mark => {
    if (!(typeof mark.attrs?.href === 'string' && mark.attrs.href.startsWith('#'))) {
      inspectInternalLink(mark, registry); return;
    }
    if (mark.attrs.wordBookmarkId != null) fail('USER_BOOKMARK_IMPORT_PREBOUND_LINK');
    inspectInternalLink(mark, registry, { allowUnbound: true });
    const name = validName(mark.attrs.href.slice(1));
    let record = registry.bookmarks.find(item => nameKey(item.name) === nameKey(name));
    if (!record) {
      record = { id: seedId(seed, 'import:' + name), name, state: 'deleted' };
      registry.bookmarks.push(record);
    }
    mark.attrs = { ...mark.attrs, ...linkAttrs(record) };
  });
  validateRegistry(registry, out); validateLinks(out, registry);
  return bindRegistry(out, registry);
}
function planMutation({ doc, action, requestId, projectId, sceneId, name, bookmarkId, start, end }) {
  noPending(doc);
  const before = readRegistry(doc), registry = before ? clone(before) : { schemaVersion: SCHEMA, revision: 0, bookmarks: [] };
  validateLinks(doc, before);
  let record;
  if (action === 'create') {
    validName(name); endpointShape(start); endpointShape(end);
    bookmarkId = seedId({ requestId, projectId, sceneId }, 'create');
    if (registry.bookmarks.some(item => item.id === bookmarkId)) fail('USER_BOOKMARK_REQUEST_REPLAY');
    record = { id: bookmarkId, name, state: 'active', start: clone(start), end: clone(end) };
    registry.bookmarks.push(record);
  } else {
    validId(bookmarkId);
    record = registry.bookmarks.find(item => item.id === bookmarkId);
    if (!record || record.state !== 'active') fail('USER_BOOKMARK_TARGET_UNAVAILABLE');
    if (action === 'rename') { validName(name); record.name = name; }
    else if (action === 'delete') { record.state = 'deleted'; delete record.start; delete record.end; }
    else fail('USER_BOOKMARK_ACTION_INVALID');
  }
  const changed = !same(before, registry);
  if (changed) nextRevision(registry);
  validateRegistry(registry, doc);
  const out = bindRegistry(doc, registry);
  visitLinks(out, mark => {
    if (mark.attrs?.wordBookmarkId === bookmarkId) mark.attrs = { ...mark.attrs, ...linkAttrs(record) };
  });
  validateLinks(out, registry);
  return { doc: out, registry: clone(registry), bookmarkId, changed };
}

// Every shortest single contiguous edit placement participates in the proof.
// Overlapping equal prefixes/suffixes must never choose the first equal quote.
function editCandidates(before, after) {
  if (before === after) return [];
  const oldEdges = boundaries(before), newEdges = boundaries(after);
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  while (suffix < Math.min(before.length, after.length)
    && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  while (prefix > 0 && (!oldEdges.has(prefix) || !newEdges.has(prefix))) prefix--;
  while (suffix > 0 && (!oldEdges.has(before.length - suffix) || !newEdges.has(after.length - suffix))) suffix--;
  const retained = Math.min(prefix + suffix, before.length, after.length);
  const removed = before.length - retained, inserted = after.length - retained, result = [];
  for (let start = Math.max(0, retained - suffix); start <= Math.min(prefix, retained); start++) {
    if (oldEdges.has(start) && newEdges.has(start) && oldEdges.has(start + removed) && newEdges.has(start + inserted)) {
      result.push({ start, end: start + removed, inserted, delta: inserted - removed });
      if (result.length > 10000) fail('USER_BOOKMARK_EDIT_AMBIGUOUS');
    }
  }
  if (!result.length) fail('USER_BOOKMARK_EDIT_BOUNDARY');
  return result;
}
function mapEndpoint(endpoint, edits, oldText, newText) {
  const oldOffset = endpoint.offsetUtf16 + (endpoint.edge === 'afterParagraph' ? 1 : 0);
  const values = new Set();
  for (const edit of edits) {
    let value;
    // Native Word gives both point and range endpoints left insertion affinity:
    // insertion at the start enters the range; insertion at its end stays out.
    if (edit.start === edit.end && oldOffset === edit.start) value = oldOffset;
    else if (oldOffset < edit.start) value = oldOffset;
    else if (oldOffset > edit.end) value = oldOffset + edit.delta;
    else fail('USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT');
    values.add(value);
  }
  if (values.size !== 1) fail('USER_BOOKMARK_EDIT_AMBIGUOUS');
  const value = values.values().next().value;
  if (endpoint.edge === 'afterParagraph' && (oldOffset !== oldText.length + 1 || value !== newText.length + 1)) fail('USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT');
  return { ...endpoint, offsetUtf16: value - (endpoint.edge === 'afterParagraph' ? 1 : 0) };
}
function structure(doc) {
  const result = [];
  walk(doc, (node, path) => {
    if (node.type !== 'text' && node.type !== 'hardBreak' && node.type !== 'image') result.push([path, node.type]);
  });
  return result;
}
function prepareRenameLineage(workingDoc, registry, renameLineage) {
  const aliases = new Map(), records = new Map((registry?.bookmarks || []).map(record => [record.id, record]));
  if (renameLineage !== undefined) {
    array(renameLineage, MAX_BOOKMARKS);
    for (const alias of renameLineage) {
      exact(alias, ['bookmarkId', 'oldName']); validId(alias.bookmarkId); validName(alias.oldName);
      if (!records.has(alias.bookmarkId)) fail('USER_BOOKMARK_RENAME_LINEAGE_INVALID');
      if (!aliases.has(alias.bookmarkId)) aliases.set(alias.bookmarkId, new Set());
      if (aliases.get(alias.bookmarkId).has(alias.oldName)) fail('USER_BOOKMARK_RENAME_LINEAGE_INVALID');
      aliases.get(alias.bookmarkId).add(alias.oldName);
    }
  }
  const restored = new Set();
  // Raw marks are inspected before cloning; a mismatched href/name pair or
  // unsupported attribute cannot disappear through a private-lineage repair.
  visitLinks(workingDoc, mark => {
    const attrs = validatedInternalLinkAttrs(mark);
    if (!attrs) return;
    const record = records.get(attrs.wordBookmarkId);
    if (!record) fail('USER_BOOKMARK_LINK_TARGET_INVALID');
    if (record.name !== attrs.wordBookmarkName) {
      if (!aliases.get(record.id)?.has(attrs.wordBookmarkName)) fail('USER_BOOKMARK_LINK_TARGET_INVALID');
      restored.add(record.id);
    }
  });
  if (!restored.size) return { doc: workingDoc, restoredLinkBookmarkIds: [] };
  const doc = clone(workingDoc);
  visitLinks(doc, mark => {
    const attrs = validatedInternalLinkAttrs(mark), record = attrs && records.get(attrs.wordBookmarkId);
    if (record && record.name !== attrs.wordBookmarkName) mark.attrs = { ...attrs, ...linkAttrs(record) };
  });
  // ProseMirror merges equal neighboring text when its repaired mark is added.
  // Match those actual durable bytes without dropping any rich field or atom.
  walk(doc, node => {
    if (!Array.isArray(node.content)) return;
    const merged = [];
    for (const child of node.content) {
      const previous = merged.at(-1);
      if (child.type === 'text' && previous?.type === 'text') {
        const { text: previousText, ...previousFields } = previous;
        const { text: childText, ...childFields } = child;
        if (same(previousFields, childFields)) { previous.text = previousText + childText; continue; }
      }
      merged.push(child);
    }
    node.content = merged;
  });
  return { doc, restoredLinkBookmarkIds: [...restored].sort() };
}
function planSave({ beforeDoc, workingDoc, renameLineage }) {
  // The raw incoming state is inspected before clone/canonical normalization.
  const before = readRegistry(beforeDoc), incoming = readRegistry(workingDoc, { checkBounds: false });
  if (!same(before, incoming)) fail('USER_BOOKMARK_SAVE_AUTHORITY');
  const prepared = prepareRenameLineage(workingDoc, before, renameLineage);
  const restoredLinkBookmarkIds = prepared.restoredLinkBookmarkIds;
  workingDoc = prepared.doc;
  if (!before) {
    validateLinks(workingDoc, null);
    return { doc: clone(workingDoc), registry: null, changed: false, restoredLinkBookmarkIds };
  }
  noPending(beforeDoc); noPending(workingDoc); validateLinks(beforeDoc, before); validateLinks(workingDoc, before);
  const oldBlocks = paragraphs(beforeDoc), newBlocks = paragraphs(workingDoc);
  if (!same(structure(beforeDoc), structure(workingDoc))) fail('USER_BOOKMARK_SAVE_STRUCTURE_CONFLICT');
  const mapped = clone(before), edits = new Map();
  for (let i = 0; i < oldBlocks.length; i++) {
    const oldText = textOf(oldBlocks[i]), newText = textOf(newBlocks[i]);
    if (oldText !== newText) edits.set(i, { oldText, newText, candidates: editCandidates(oldText, newText) });
  }
  for (const record of mapped.bookmarks) {
    if (record.state !== 'active') continue;
    for (const key of ['start', 'end']) {
      const endpoint = record[key], edit = edits.get(endpoint.paragraphIndex);
      if (edit) record[key] = mapEndpoint(endpoint, edit.candidates, edit.oldText, edit.newText);
    }
  }
  const changed = !same(before, mapped);
  if (changed) nextRevision(mapped);
  validateRegistry(mapped, workingDoc);
  const out = bindRegistry(workingDoc, mapped); validateLinks(out, mapped);
  return { doc: out, registry: clone(mapped), changed, restoredLinkBookmarkIds };
}

function nonLinkProjection(doc, keepLinks = false) {
  const out = clone(doc);
  if (out.attrs) { delete out.attrs[KEY]; if (!Object.keys(out.attrs).length) delete out.attrs; }
  const visit = node => {
    if (node.marks) {
      node.marks = node.marks.filter(mark => keepLinks || mark.type !== 'link').sort((a, b) => canonicalSerialize(a).localeCompare(canonicalSerialize(b)));
      if (!node.marks.length) delete node.marks;
    }
    if (node.content) {
      node.content.forEach(visit); const merged = [];
      for (const child of node.content) {
        const previous = merged.at(-1);
        if (child.type === 'text' && previous?.type === 'text'
          && same({ ...child, text: '' }, { ...previous, text: '' })) previous.text += child.text;
        else merged.push(child);
      }
      node.content = merged;
    }
  };
  visit(out); return out;
}
function linkLabelFootprints(paragraph) {
  const spans = []; let offset = 0;
  for (const node of paragraph.content || []) {
    const length = node.type === 'text' ? node.text.length : node.type === 'hardBreak' ? 1 : 0;
    const link = node.type === 'text' && node.marks?.find(mark => mark.type === 'link');
    if (link) {
      const template = clone(node); delete template.text;
      template.marks = (template.marks || []).filter(mark => mark.type !== 'link')
        .sort((a, b) => canonicalSerialize(a).localeCompare(canonicalSerialize(b)));
      if (!template.marks.length) delete template.marks;
      const previous = spans.at(-1);
      if (previous?.to === offset && same(previous.link, link) && same(previous.template, template)) previous.to += length;
      else spans.push({ from: offset, to: offset + length, link, template });
    }
    offset += length;
  }
  return spans;
}
function restoreLabel(paragraph, edit, oldText, footprint) {
  const end = edit.start + edit.inserted, out = []; let offset = 0, restored = false;
  const restore = () => {
    if (restored) return;
    const text = oldText.slice(edit.start, edit.end);
    if (text) out.push({ ...clone(footprint.template), text });
    restored = true;
  };
  for (const node of paragraph.content || []) {
    const length = node.type === 'text' ? node.text.length : node.type === 'hardBreak' ? 1 : 0;
    const next = offset + length;
    if (node.type === 'text' && next >= edit.start && offset <= end) {
      const from = Math.max(0, edit.start - offset), to = Math.min(length, end - offset);
      if (to > from && !same({ ...node, text: undefined }, { ...footprint.template, text: undefined })) fail('USER_BOOKMARK_RETURN_LABEL_STYLE');
      if (from > 0) out.push({ ...clone(node), text: node.text.slice(0, from) });
      restore();
      if (to < length) out.push({ ...clone(node), text: node.text.slice(Math.max(0, to)) });
    } else {
      if (length && offset < end && next > edit.start) fail('USER_BOOKMARK_RETURN_LABEL_STRUCTURE');
      if (!length && offset >= edit.start && offset <= end) fail('USER_BOOKMARK_RETURN_LABEL_STRUCTURE');
      out.push(clone(node));
    }
    offset = next;
  }
  if (!restored) fail('USER_BOOKMARK_RETURN_LABEL_STRUCTURE');
  paragraph.content = out;
}

// Main supplies an authenticated, privately bound analysis candidate and owns
// all CAS/publication guards. This pure admission never authenticates a file.
function planReturn({ beforeDoc, candidateDoc }) {
  const before = readRegistry(beforeDoc), candidate = readRegistry(candidateDoc);
  noPending(beforeDoc); noPending(candidateDoc);
  validateLinks(beforeDoc, before); validateLinks(candidateDoc, candidate);
  if (!same(structure(beforeDoc), structure(candidateDoc))) fail('USER_BOOKMARK_RETURN_STRUCTURE');
  for (const previous of before?.bookmarks || []) {
    const next = candidate?.bookmarks.find(record => record.id === previous.id);
    if (!next) fail('USER_BOOKMARK_RETURN_ID_REMOVED');
    if (previous.state === 'deleted' && !same(previous, next)) fail('USER_BOOKMARK_RETURN_TOMBSTONE_CHANGED');
    if (previous.state === 'active') {
      if (next.state === 'deleted' && previous.name !== next.name) fail('USER_BOOKMARK_RETURN_DELETED_NAME');
      if (next.state === 'active' && (!same(previous.start, next.start) || !same(previous.end, next.end))) fail('USER_BOOKMARK_RETURN_ENDPOINT_RELOCATED');
    }
  }
  const oldProjection = nonLinkProjection(beforeDoc), newProjection = nonLinkProjection(candidateDoc);
  const oldBlocks = paragraphs(oldProjection), newBlocks = paragraphs(newProjection), sourceBlocks = paragraphs(beforeDoc);
  for (let index = 0; index < oldBlocks.length; index++) {
    const oldText = textOf(oldBlocks[index]), nextText = textOf(newBlocks[index]);
    if (oldText === nextText) continue;
    const delta = nextText.length - oldText.length, footprints = linkLabelFootprints(sourceBlocks[index]);
    const owners = footprints.filter(span => span.to + delta > span.from
      && nextText.slice(0, span.from) === oldText.slice(0, span.from)
      && nextText.slice(span.to + delta) === oldText.slice(span.to));
    if (owners.length !== 1) fail('USER_BOOKMARK_RETURN_UNOWNED_TEXT');
    restoreLabel(newBlocks[index], { start: owners[0].from, end: owners[0].to,
      inserted: owners[0].to - owners[0].from + delta }, oldText, owners[0]);
  }
  if (!same(oldProjection, nonLinkProjection(newProjection))) fail('USER_BOOKMARK_RETURN_NONLINK_CHANGE');
  const withoutRevision = value => value ? { ...value, revision: 0 } : null;
  const changed = !same(nonLinkProjection(beforeDoc, true), nonLinkProjection(candidateDoc, true))
    || !same(withoutRevision(before), withoutRevision(candidate));
  const expectedRevision = (before?.revision || 0) + (changed ? 1 : 0);
  if (expectedRevision > Number.MAX_SAFE_INTEGER || (candidate && candidate.revision !== expectedRevision)) fail('USER_BOOKMARK_RETURN_REVISION');
  if (!candidate && before) fail('USER_BOOKMARK_RETURN_REGISTRY_REMOVED');
  return { doc: clone(candidateDoc), registry: candidate, changed };
}

// Only the existing authenticated scene-history seam may select this plan.
// Artifact/project/scene authentication and publication CAS remain in main;
// neither a snapshot's contents nor its older revision grant that authority.
function planHistoryRestore({ beforeDoc, snapshotDoc }) {
  const before = readRegistry(beforeDoc), registry = readRegistry(snapshotDoc);
  if (before || registry) {
    validateLinks(beforeDoc, before);
    validateLinks(snapshotDoc, registry);
  }
  return { doc: clone(snapshotDoc), registry, changed: !same(beforeDoc, snapshotDoc) };
}

module.exports = { KEY, SCHEMA, MAX_BOOKMARKS, readRegistry, validateRegistry,
  validateName: validName,
  nameKey,
  paragraphs, textOf, endpointOffset, endpointForOffset, linkAttrs,
  inspectInternalLink, materializeInternalLinkSchemaDefaults,
  importInventory, planMutation, planSave, planReturn, planHistoryRestore };

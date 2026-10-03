'use strict';

// Scene-local semantic counters. No I/O or mutation authority; callers apply
// resolved starts to their own private document/authoring transaction only.
const format = require('./word-list-format-v1.cjs');
const fail = () => { throw new Error('WORD_LIST_NUMBERING_INVALID'); };
const own = (value, key) => {
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (d && !Object.hasOwn(d, 'value')) fail();
  return d?.value;
};
function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some(key => typeof key !== 'string' || !keys.includes(key))) fail();
  for (const key of names) own(value, key);
  return value;
}
function validateLevels(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 9
    || Reflect.ownKeys(value).some(key => key !== 'length' && !/^[0-8]$/.test(String(key)))) fail();
  return Array.from({ length: value.length }, (_, index) => {
    const raw = record(own(value, String(index)), ['format', 'start', 'text', 'restartAfterLevel']);
    const type = own(raw, 'format'), start = own(raw, 'start'), text = own(raw, 'text');
    const restart = own(raw, 'restartAfterLevel');
    if (typeof type !== 'string' || !['1', 'I', 'i', 'A', 'a'].includes(type)) fail();
    const max = ['I', 'i'].includes(type) ? 3999 : 2147483647;
    if (!Number.isSafeInteger(start) || start < (type === '1' ? 0 : 1) || start > max) fail();
    if (typeof text !== 'string' || !text.length || text.length > 256
      || /[\u0000-\u001f\u007f]/u.test(text) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) fail();
    for (let n = 0; n < text.length; n++) if (text[n] === '%') {
      const digit = text[++n];
      if (!/^[1-9]$/.test(digit || '') || Number(digit) > index + 1 || /[0-9]/.test(text[n + 1] || '')) fail();
    }
    if (restart !== null && (!Number.isInteger(restart) || restart < 0 || restart >= index)) fail();
    return { format: type, start, text, restartAfterLevel: restart };
  });
}
function validateNumbering(value) {
  if (!value || typeof value !== 'object') fail();
  const optional = ['lineageId', 'startOverrides'].filter(key => Object.hasOwn(value, key));
  record(value, ['schemaVersion', 'instanceId', 'level', 'levels', ...optional]);
  const schemaVersion = own(value, 'schemaVersion'), instanceId = own(value, 'instanceId'), level = own(value, 'level');
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
  if (schemaVersion !== 1 || !validId(instanceId)) fail();
  const levels = validateLevels(own(value, 'levels'));
  if (!Number.isInteger(level) || level < 0 || level >= levels.length) fail();
  const result = { schemaVersion: 1, instanceId, level, levels };
  if (optional.includes('lineageId')) {
    const lineageId = own(value, 'lineageId'); if (!validId(lineageId)) fail(); result.lineageId = lineageId;
  }
  if (optional.includes('startOverrides')) {
    const raw = own(value, 'startOverrides');
    if (!Array.isArray(raw) || raw.length > levels.length || Reflect.ownKeys(raw).some(key => key !== 'length' && !/^[0-8]$/.test(String(key)))) fail();
    let prior = -1;
    result.startOverrides = Array.from({ length: raw.length }, (_, index) => {
      const item = record(own(raw, String(index)), ['level','start']), n = own(item,'level'), start = own(item,'start');
      if (!Number.isInteger(n) || n <= prior || n >= levels.length) fail(); prior = n;
      validateLevels([{ ...levels[n], text: '%1.', restartAfterLevel: null, start }]);
      return { level: n, start };
    });
  }
  return result;
}
function defaultLevels(count = 9) {
  if (!Number.isInteger(count) || count < 1 || count > 9) fail();
  return Array.from({ length: count }, (_, i) => ({ format: '1', start: 1, text: `%${i + 1}.`, restartAfterLevel: i ? i - 1 : null }));
}
function formatOrdinal(value, type) {
  validateLevels([{ format: type, start: value, text: '%1.', restartAfterLevel: null }]);
  if (type === '1') return String(value);
  let output = '';
  if (type === 'A' || type === 'a') {
    for (let n = value; n > 0; n = Math.floor((n - 1) / 26)) output = String.fromCharCode(65 + (n - 1) % 26) + output;
  } else {
    let n = value;
    for (const [amount, token] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
      while (n >= amount) { output += token; n -= amount; }
    }
  }
  return type === 'a' || type === 'i' ? output.toLowerCase() : output;
}
function attributes(attrs) {
  if (attrs == null) return null;
  if (typeof attrs !== 'object' || Array.isArray(attrs)) fail();
  const id = own(attrs, 'wordListId'), start = own(attrs, 'wordListStart');
  if (own(attrs, 'wordNumbering') != null && (id != null || start != null)) fail();
  if (id == null && start == null) return null;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)
    || !Number.isSafeInteger(start) || start < 0 || start > 2147483647) fail();
  return { id, start };
}
function resolveLegacy(doc) {
  const groups = new Map(), starts = new Map(), active = new Set();
  const pending = [{ node: doc, depth: 0 }]; let count = 0;
  while (pending.length) {
    const { node, exit, depth } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (exit) { active.delete(node); continue; }
    if (++count > 200000 || active.has(node)) fail();
    active.add(node); pending.push({ node, exit: true });
    const attrs = own(node, 'attrs'), identity = attributes(attrs);
    const content = own(node, 'content'), type = own(node, 'type');
    if (identity) {
      if (type !== 'orderedList' || !Array.isArray(content) || !content.length) fail();
      const listType = format.normalizeType(own(attrs, 'type'));
      let group = groups.get(identity.id);
      if (!group) {
        if (groups.size >= 2048) fail();
        group = { base: identity.start, next: identity.start, type: listType, depth };
        groups.set(identity.id, group);
      }
      if (group.base !== identity.start || group.type !== listType || group.depth !== depth
        || group.next + content.length - 1 > 2147483647) fail();
      starts.set(node, group.next); group.next += content.length;
    }
    if (Array.isArray(content)) for (let i = content.length - 1; i >= 0; i--) {
      pending.push({ node: own(content, String(i)), depth: depth + (['orderedList', 'bulletList'].includes(type) ? 1 : 0) });
    }
  }
  return starts;
}
// Clone only own data, before any JSON serialization or authoring decisions.
function cloneData(value, active = new Set(), budget = { count: 0 }, depth = 0) {
  if (++budget.count > 1000000 || depth > 128) fail();
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || active.has(value)) fail();
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  active.add(value);
  const out = Array.isArray(value) ? [] : {};
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) fail();
    const data = own(value, key);
    out[key] = cloneData(data, active, budget, depth + 1);
  }
  active.delete(value); return out;
}
function visitNodes(doc, callback) {
  const pending = [{ node: doc, path: [], parents: [] }], active = new Set(); let count = 0;
  while (pending.length) {
    const entry = pending.pop(), { node, path, parents } = entry;
    if (!node || typeof node !== 'object') fail();
    if (entry.exit) { active.delete(node); continue; }
    if (++count > 200000 || active.has(node) || path.length > 128) fail();
    active.add(node); pending.push({ ...entry, exit: true });
    callback(node, path, parents);
    const content = own(node, 'content');
    if (content !== undefined && !Array.isArray(content)) fail();
    if (content) for (let i = content.length - 1; i >= 0; i--) pending.push({ node: own(content, String(i)), path: [...path, i], parents: [...parents, node] });
  }
}
function resolveMarkers(doc) {
  const result = new Map(), instances = new Map(), lineages = new Map();
  visitNodes(doc, (node, path, parents) => {
    const attrs = own(node, 'attrs'), type = own(node, 'type');
    attributes(attrs);
    const raw = attrs && own(attrs, 'wordNumbering');
    if (raw != null) {
      if (type !== 'orderedList' || !Array.isArray(own(node, 'content')) || !node.content.length) fail();
      const pattern = validateNumbering(raw), { instanceId, level, levels } = pattern;
      if (attrs.type != null && attrs.type !== levels[level].format) fail();
      const definition = JSON.stringify({ ...pattern, level: 0 });
      let instance = instances.get(instanceId);
      if (!instance) {
        if (instances.size >= 2048) fail();
        instance = { definition, applied: new Set(), pattern }; instances.set(instanceId, instance);
      } else if (definition !== instance.definition) fail();
      const lineageId = pattern.lineageId || instanceId;
      if (!lineages.has(lineageId)) lineages.set(lineageId, []);
      result.set(node, { path, instanceId, level, start: null, items: [], pattern, instance, counters: lineages.get(lineageId) });
    }
    if (type !== 'listItem') return;
    const list = parents.at(-1), item = result.get(list);
    if (!item) return;
    const { level, pattern, counters, instance } = item, definition = pattern.levels[level];
    const override = (pattern.startOverrides || []).find(value => value.level === level);
    if (override && !instance.applied.has(level)) counters[level] = override.start;
    else counters[level] = counters[level] == null ? definition.start : counters[level] + 1;
    instance.applied.add(level);
    const ordinal = counters[level]; formatOrdinal(ordinal, definition.format);
    for (let lower = level + 1; lower < pattern.levels.length; lower++) {
      const restart = pattern.levels[lower].restartAfterLevel;
      if (restart !== null && level <= restart) counters[lower] = undefined;
    }
    const label = definition.text.replace(/%([1-9])/g, (_, digit) => {
      const referenced = Number(digit) - 1;
      return formatOrdinal(counters[referenced] ?? pattern.levels[referenced].start, pattern.levels[referenced].format);
    });
    if (item.start === null) item.start = ordinal;
    item.items.push({ ordinal, label });
  });
  for (const value of result.values()) {
    if (!value.items.length) fail();
    delete value.pattern; delete value.instance; delete value.counters;
  }
  return result;
}
function nodeAt(doc, path) {
  if (!Array.isArray(path) || path.length > 128 || path.some(n => !Number.isInteger(n) || n < 0)) fail();
  let node = doc;
  for (const index of path) { node = node?.content?.[index]; if (!node) fail(); }
  return node;
}
function planNumberingEdit(doc, intent) {
  record(intent, ['listPath','action', ...['levels','instanceId'].filter(key => Object.hasOwn(intent, key))]);
  const before = resolveMarkers(doc), next = cloneData(doc), path = own(intent, 'listPath'), action = own(intent,'action');
  let target = nodeAt(next, path);
  if (!['configure','restart','continue'].includes(action)) fail();
  const used = new Set([...before.values()].map(item => item.instanceId));
  let fresh = 1; while (used.has(`numbering-${fresh}`)) fresh++;
  const current = target.attrs?.wordNumbering ? validateNumbering(target.attrs.wordNumbering) : null;
  let levels = own(intent,'levels') === undefined ? current?.levels || defaultLevels() : validateLevels(own(intent,'levels'));
  let instanceId = current?.instanceId || `numbering-${fresh}`;
  let prototype = { schemaVersion: 1, instanceId, level: 0, levels };
  if (action === 'continue') {
    const requested = own(intent, 'instanceId');
    let found;
    for (const [node, item] of before) {
      if (JSON.stringify(item.path) === JSON.stringify(path)) break;
      if (item.instanceId === requested) found = validateNumbering(node.attrs.wordNumbering);
    }
    if (!found || current?.level > 0 || JSON.stringify(found.levels) !== JSON.stringify(levels)) fail();
    prototype = { ...found, level: 0 }; instanceId = found.instanceId;
  } else if (action === 'restart') {
    if (current?.level > 0) fail();
    instanceId = `numbering-${fresh}`;
    prototype = { schemaVersion: 1, instanceId, level: 0, levels };
  } else if (current) prototype = { ...current, levels };
  if (['paragraph','heading'].includes(target.type)) {
    if (action !== 'configure' || !path.length) fail();
    const wrapper = { type:'orderedList', attrs:{start:levels[0].start,type:levels[0].format,wordNumbering:prototype}, content:[{type:'listItem',content:[target]}] };
    nodeAt(next,path.slice(0,-1)).content[path.at(-1)] = wrapper; target = wrapper;
  }
  if (target.type !== 'orderedList') fail();
  const decorate = (node, level) => {
    if (node.type === 'orderedList') {
      if (level >= levels.length) fail();
      node.attrs = { ...(node.attrs || {}), type:levels[level].format, wordNumbering:{...cloneData(prototype),level} };
      delete node.attrs.wordListId; delete node.attrs.wordListStart;
      for (const child of node.content || []) for (const nested of child.content || []) if (nested.type === 'orderedList') decorate(nested, level + 1);
    }
  };
  if (current && action === 'configure') {
    visitNodes(next, node => {
      if (node.attrs?.wordNumbering?.instanceId === current.instanceId) {
        const level = node.attrs.wordNumbering.level;
        if (level >= levels.length) fail();
        node.attrs.wordNumbering.levels = cloneData(levels); node.attrs.type = levels[level].format;
      }
    });
  } else decorate(target, current?.level || 0);
  return normalize(next);
}
function normalizeAuthoring(doc, oldDoc) {
  const next = cloneData(doc);
  const oldPatterns = oldDoc ? resolveMarkers(oldDoc) : null;
  visitNodes(next, (node, path, parents) => {
    if (node.type !== 'orderedList') return;
    const parent = [...parents].reverse().find(value => value.type === 'orderedList' || value.type === 'bulletList');
    const inherited = parent?.attrs?.wordNumbering;
    let pattern = node.attrs?.wordNumbering;
    if (!pattern && inherited && oldPatterns) {
      // A pre-existing plain nested list is not a newly authored level.
      const unchanged = [...oldPatterns.keys()].some(old => (old.content || []).some(item => (item.content || []).some(child => child.type === 'orderedList' && !child.attrs?.wordNumbering && JSON.stringify(child) === JSON.stringify(node))));
      if (!unchanged && node.attrs?.wordListId == null) pattern = { ...cloneData(inherited), level: inherited.level + 1 };
    } else if (pattern && inherited && pattern.instanceId === inherited.instanceId && oldPatterns) {
      pattern = { ...pattern, level: inherited.level + 1 };
    }
    if (pattern) {
      pattern = validateNumbering(pattern);
      node.attrs = { ...(node.attrs || {}), wordNumbering: pattern, type:pattern.levels[pattern.level].format };
    }
  });
  return normalize(next);
}
function applyDefinitionChange(doc, change) {
  record(change, ['instanceId', 'expectedLevels', 'levels']);
  const expected = validateLevels(own(change, 'expectedLevels')), levels = validateLevels(own(change, 'levels'));
  const id = own(change, 'instanceId'), markers = resolveMarkers(doc);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) fail();
  let found = false;
  for (const [node, item] of markers) if (item.instanceId === id) {
    found = true;
    if (JSON.stringify(validateNumbering(node.attrs.wordNumbering).levels) !== JSON.stringify(expected)) fail();
  }
  if (!found) fail();
  const next = cloneData(doc);
  visitNodes(next, node => {
    if (node.attrs?.wordNumbering?.instanceId === id) {
      node.attrs.wordNumbering.levels = cloneData(levels);
      node.attrs.type = levels[node.attrs.wordNumbering.level]?.format;
    }
  });
  return normalize(next);
}
function resolve(doc) {
  const starts = resolveLegacy(doc);
  for (const [node, value] of resolveMarkers(doc)) starts.set(node, value.start);
  return starts;
}
function normalize(doc) {
  for (const [node, start] of resolve(doc)) node.attrs.start = start;
  return doc;
}
module.exports = { attributes, resolve, normalize, validateLevels, validateNumbering, normalizePattern: validateNumbering, defaultLevels, formatOrdinal, resolveMarkers, planNumberingEdit, normalizeAuthoring, applyDefinitionChange };

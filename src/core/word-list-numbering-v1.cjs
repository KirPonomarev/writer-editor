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
    const max = ['I', 'i'].includes(type) ? 3999 : ['A','a'].includes(type) ? 780 : 2147483647;
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
    output = String.fromCharCode(65 + (value - 1) % 26).repeat(Math.floor((value - 1) / 26) + 1);
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
      if (own(attrs, 'type') != null && own(attrs, 'type') !== levels[level].format) fail();
      const definition = JSON.stringify({ ...pattern, level: 0 });
      let instance = instances.get(instanceId);
      if (!instance) {
        if (instances.size >= 2048) fail();
        instance = { definition, applied: new Set(), pattern }; instances.set(instanceId, instance);
      } else if (definition !== instance.definition) fail();
      const lineageId = pattern.lineageId || instanceId;
      if (!lineages.has(lineageId)) lineages.set(lineageId, { counters: [], levels: JSON.stringify(levels) });
      const lineage = lineages.get(lineageId);
      if (lineage.levels !== JSON.stringify(levels)) fail();
      result.set(node, { path, instanceId, level, start: null, items: [], pattern, instance, counters: lineage.counters });
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
    if (label.length > 4096) fail();
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
  intent = cloneData(intent);
  record(intent, ['listPath','action', ...['levels','instanceId'].filter(key => Object.hasOwn(intent, key))]);
  const base = cloneData(doc), before = resolveMarkers(base), next = cloneData(base);
  const path = own(intent, 'listPath'), action = own(intent,'action');
  let target = nodeAt(next, path);
  if (!['configure','restart','continue'].includes(action)) fail();
  const ancestors = []; let cursor = next;
  for (const index of path) { if (['orderedList','bulletList'].includes(cursor.type)) ancestors.push(cursor); cursor = cursor.content[index]; }
  const parentPattern = ancestors.at(-1)?.attrs?.wordNumbering;
  const ownCurrent = target.attrs?.wordNumbering ? validateNumbering(target.attrs.wordNumbering) : null;
  const current = ownCurrent || (action === 'configure' && parentPattern ? validateNumbering(parentPattern) : null);
  const targetLevel = ownCurrent?.level ?? (parentPattern ? parentPattern.level + 1 : ancestors.length);
  if (targetLevel > 8 || (action !== 'configure' && targetLevel !== 0)) fail();
  const used = new Set([...before.keys()].flatMap(node => {
    const value = node.attrs.wordNumbering;
    return [value.instanceId, value.lineageId || value.instanceId];
  }));
  let fresh = 1; while (used.has(`numbering-${fresh}`)) fresh++;
  let levels = own(intent,'levels') === undefined ? current?.levels || defaultLevels() : validateLevels(own(intent,'levels'));
  let instanceId = current?.instanceId || `numbering-${fresh}`;
  let prototype = { schemaVersion: 1, instanceId, level: targetLevel, levels };
  if (action === 'continue') {
    const requested = own(intent, 'instanceId'); let found;
    for (const [node, item] of before) {
      if (JSON.stringify(item.path) === JSON.stringify(path)) break;
      if (item.instanceId === requested) found = validateNumbering(node.attrs.wordNumbering);
    }
    if (found && !current && own(intent, 'levels') === undefined) levels = found.levels;
    if (!found || JSON.stringify(found.levels) !== JSON.stringify(levels)) fail();
    if (current) {
      const oldLineage = current.lineageId || current.instanceId, newLineage = found.lineageId || found.instanceId;
      if (oldLineage === newLineage) {
        // Continue cancels a reset at this instance's first root occurrence.
        // A later representative already continues; removing its consumed
        // reset would rewrite the earlier, unselected part of the manuscript.
        let earlierRoot = false;
        for (const [node, item] of before) {
          if (JSON.stringify(item.path) === JSON.stringify(path)) break;
          if (item.instanceId === current.instanceId && item.level === 0) earlierRoot = true;
        }
        if (!earlierRoot && current.startOverrides?.some(value => value.level === 0)) {
          visitNodes(next, node => {
            const value = node.attrs?.wordNumbering;
            if (value?.instanceId !== current.instanceId) return;
            const remaining = (value.startOverrides || []).filter(override => override.level !== 0);
            if (remaining.length) value.startOverrides = remaining;
            else delete value.startOverrides;
          });
        }
        return normalize(next);
      }
      for (const [node, item] of before) {
        if (JSON.stringify(item.path) === JSON.stringify(path)) break;
        const value = node.attrs.wordNumbering;
        if ((value.lineageId || value.instanceId) === oldLineage) fail();
      }
      visitNodes(next, node => {
        const value = node.attrs?.wordNumbering;
        if (value && (value.lineageId || value.instanceId) === oldLineage) {
          value.lineageId = newLineage;
          if (value.instanceId === current.instanceId) delete value.startOverrides;
        }
      });
      return normalize(next);
    }
    prototype = { ...found, level: 0 }; instanceId = found.instanceId;
  } else if (action === 'restart') {
    instanceId = `numbering-${fresh}`;
    if (current) {
      if (JSON.stringify(levels.map((value,index)=>({...value,start:current.levels[index]?.start}))) !== JSON.stringify(current.levels)) fail();
      prototype = {...current, instanceId, lineageId:current.lineageId || current.instanceId, startOverrides:[{level:0,start:levels[0].start}]};
      levels = current.levels;
    } else prototype = { schemaVersion: 1, instanceId, level: 0, levels };
  } else if (current) prototype = { ...current, level:targetLevel, levels };
  if (['paragraph','heading'].includes(target.type)) {
    if (action !== 'configure' || !path.length || ancestors.length) fail();
    const wrapper = { type:'orderedList', attrs:{start:levels[targetLevel]?.start,type:levels[targetLevel]?.format,wordNumbering:prototype}, content:[{type:'listItem',content:[target]}] };
    nodeAt(next,path.slice(0,-1)).content[path.at(-1)] = wrapper; target = wrapper;
  }
  if (target.type !== 'orderedList') fail();
  const convertedLegacyIds = new Set();
  const decorate = (node, level) => {
    if (node.type === 'orderedList') {
      if (level >= levels.length) fail();
      if (node.attrs?.wordListId != null) convertedLegacyIds.add(node.attrs.wordListId);
      node.attrs = { ...(node.attrs || {}), type:levels[level].format, wordNumbering:{...cloneData(prototype),level} };
      delete node.attrs.wordListId; delete node.attrs.wordListStart;
      for (const child of node.content || []) for (const nested of child.content || []) if (nested.type === 'orderedList') decorate(nested, level + 1);
    }
  };
  if (current && action === 'configure') {
    visitNodes(next, node => {
      if (node.attrs?.wordNumbering && (node.attrs.wordNumbering.lineageId || node.attrs.wordNumbering.instanceId) === (current.lineageId || current.instanceId)) {
        const level = node.attrs.wordNumbering.level;
        if (level >= levels.length) fail();
        node.attrs.wordNumbering.levels = cloneData(levels); node.attrs.type = levels[level].format;
      }
    });
    if (!ownCurrent) decorate(target, targetLevel);
  } else if (action === 'configure' && target.attrs?.wordListId != null) {
    const legacyId = target.attrs.wordListId;
    visitNodes(next, node => { if (node.type === 'orderedList' && node.attrs?.wordListId === legacyId) decorate(node,targetLevel); });
  } else decorate(target, targetLevel);
  visitNodes(next, node => { if (convertedLegacyIds.has(node.attrs?.wordListId)) fail(); });
  return normalize(next);
}
function normalizeAuthoring(doc, oldDoc) {
  const next = cloneData(doc);
  oldDoc = oldDoc ? cloneData(oldDoc) : null;
  const oldPatterns = oldDoc ? resolveMarkers(oldDoc) : null;
  const priorContexts = new Set();
  const contextKey = (pattern, parent) => JSON.stringify([pattern.instanceId,pattern.level,parent?.attrs?.wordNumbering?.instanceId || null,parent?.attrs?.wordNumbering?.level ?? null]);
  if (oldDoc) visitNodes(oldDoc, (node, path, parents) => {
    if (!node.attrs?.wordNumbering) return;
    const parent = [...parents].reverse().find(value => value.type === 'orderedList' || value.type === 'bulletList');
    priorContexts.add(contextKey(node.attrs.wordNumbering,parent));
  });
  visitNodes(next, (node, path, parents) => {
    if (node.type !== 'orderedList') return;
    const parent = [...parents].reverse().find(value => value.type === 'orderedList' || value.type === 'bulletList');
    const inherited = parent?.attrs?.wordNumbering;
    let pattern = node.attrs?.wordNumbering;
    const sameAncestry = pattern && priorContexts.has(contextKey(pattern, parent));
    if (!pattern && inherited && oldPatterns) {
      // A pre-existing plain nested list is not a newly authored level.
      const unchanged = [...oldPatterns.keys()].some(old => (old.content || []).some(item => (item.content || []).some(child => child.type === 'orderedList' && !child.attrs?.wordNumbering && JSON.stringify(child) === JSON.stringify(node))));
      if (!unchanged && node.attrs?.wordListId == null) pattern = { ...cloneData(inherited), level: inherited.level + 1 };
    } else if (pattern && inherited && pattern.instanceId === inherited.instanceId && oldPatterns && !sameAncestry) {
      pattern = { ...pattern, level: inherited.level + 1 };
    }
    if (pattern && !parent && oldPatterns && !sameAncestry) pattern = {...pattern,level:0};
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
  const representative = [...markers.keys()].find(node => node.attrs.wordNumbering.instanceId === id);
  if (!representative) fail();
  const lineageId = representative.attrs.wordNumbering.lineageId || id;
  let found = false;
  for (const [node] of markers) if ((node.attrs.wordNumbering.lineageId || node.attrs.wordNumbering.instanceId) === lineageId) {
    found = true;
    if (JSON.stringify(validateNumbering(node.attrs.wordNumbering).levels) !== JSON.stringify(expected)) fail();
  }
  if (!found) fail();
  const next = cloneData(doc);
  visitNodes(next, node => {
    if (node.attrs?.wordNumbering && (node.attrs.wordNumbering.lineageId || node.attrs.wordNumbering.instanceId) === lineageId) {
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
const CLIPBOARD_SCHEMA = 'yalken.numbering-clipboard.v1';
function clipboardShape(doc) {
  const shape = node => [node.type, typeof node.text === 'string' ? node.text : null, (node.content || []).map(shape)];
  visitNodes(doc, () => {});
  return shape(doc);
}
function clipboardLists(doc) {
  const lists = [];
  visitNodes(doc, (node, path, parents) => {
    if (!node.attrs?.wordNumbering) return;
    const numbering = validateNumbering(node.attrs.wordNumbering);
    if (node.type !== 'orderedList' || !node.content?.length) fail();
    const ancestors = parents.filter(value => value.attrs?.wordNumbering).map(value => validateNumbering(value.attrs.wordNumbering));
    if (!ancestors.length && numbering.level !== 0) fail();
    for (const match of numbering.levels[numbering.level].text.matchAll(/%([1-9])/g)) {
      const referenced = Number(match[1])-1;
      if (referenced < numbering.level && !ancestors.some(value => value.level === referenced && (value.lineageId || value.instanceId) === (numbering.lineageId || numbering.instanceId))) fail();
    }
    const start = node.attrs.start;
    validateLevels([{...numbering.levels[numbering.level],start,text:'%1.',restartAfterLevel:null}]);
    lists.push({path,start,numbering});
    if (lists.length > 2048) fail();
  });
  return lists;
}
function createNumberingClipboard(fragmentDoc) {
  const fragment = cloneData(fragmentDoc), lists = clipboardLists(fragment);
  if (!lists.length) fail();
  const value = JSON.stringify({schemaVersion:CLIPBOARD_SCHEMA,shape:clipboardShape(fragment),lists});
  if (new TextEncoder().encode(value).length > 65536) fail();
  // Verify independent counter reconstruction before a caller can remove a cut.
  const plain=cloneData(fragment);visitNodes(plain,node=>{if(node.attrs)delete node.attrs.wordNumbering;});
  prepareNumberingPaste({type:'doc',content:[]},{fragment:plain,numberingCarrier:value});
  return value;
}
function prepareNumberingPaste(destinationDoc, intent) {
  record(intent,['fragment','numberingCarrier']);
  const carrier = own(intent,'numberingCarrier');
  if (typeof carrier !== 'string' || carrier.length > 65536 || new TextEncoder().encode(carrier).length > 65536) fail();
  let value; try { value = JSON.parse(carrier); } catch { fail(); }
  record(value,['schemaVersion','shape','lists']);
  const fragment = cloneData(own(intent,'fragment')), destination = cloneData(destinationDoc);
  if (value.schemaVersion !== CLIPBOARD_SCHEMA || JSON.stringify(value.shape) !== JSON.stringify(clipboardShape(fragment))
    || !Array.isArray(value.lists) || !value.lists.length || value.lists.length > 2048) fail();
  // Normal schema-parsed clipboard content owns text/marks; carrier owns only
  // validated numbering data and never retained project or transport identity.
  visitNodes(fragment,node=>{if(node.attrs?.wordNumbering != null) fail();});
  const seen = new Set();
  for (const raw of value.lists) {
    record(raw,['path','start','numbering']);
    const key=JSON.stringify(raw.path);if(seen.has(key))fail();seen.add(key);
    const node=nodeAt(fragment,raw.path),numbering=validateNumbering(raw.numbering);
    if(node?.type!=='orderedList')fail();
    validateLevels([{...numbering.levels[numbering.level],start:raw.start,text:'%1.',restartAfterLevel:null}]);
    node.attrs={...(node.attrs||{}),start:raw.start,type:numbering.levels[numbering.level].format,wordNumbering:numbering};
    delete node.attrs.wordListId;delete node.attrs.wordListStart;
  }
  const entries=clipboardLists(fragment), reserved=new Set(), ids=new Map(), seeds=new Map();
  resolveMarkers(destination);
  visitNodes(destination,node=>{const p=node.attrs?.wordNumbering;if(p){reserved.add(p.instanceId);reserved.add(p.lineageId||p.instanceId);}});
  let serial=1;
  const fresh=id=>{if(!ids.has(id)){while(reserved.has(`numbering-${serial}`))serial++;const next=`numbering-${serial++}`;reserved.add(next);ids.set(id,next);}return ids.get(id);};
  for(const entry of entries){const p=entry.numbering;let map=seeds.get(p.instanceId);if(!map){map=new Map((p.startOverrides||[]).map(x=>[x.level,x.start]));seeds.set(p.instanceId,map);}const key=`${p.instanceId}:${p.level}`;if(!seen.has(key)){seen.add(key);map.set(p.level,entry.start);}}
  // Validate source identity consistency before adding first-visible counters.
  const definitions=new Map();
  for(const entry of entries){const p=entry.numbering,key=JSON.stringify({...p,level:0});if(definitions.has(p.instanceId)&&definitions.get(p.instanceId)!==key)fail();definitions.set(p.instanceId,key);}
  for(const entry of entries){const node=nodeAt(fragment,entry.path),p=entry.numbering;node.attrs.wordNumbering=validateNumbering({...p,instanceId:fresh(p.instanceId),lineageId:fresh(p.lineageId||p.instanceId),startOverrides:[...seeds.get(p.instanceId)].sort((a,b)=>a[0]-b[0]).map(([level,start])=>({level,start}))});}
  const markers=resolveMarkers(fragment);
  for(const entry of entries)if(markers.get(nodeAt(fragment,entry.path))?.start!==entry.start)fail();
  if(destination.type!=='doc'||fragment.type!=='doc')fail();
  resolveMarkers({type:'doc',content:[...(destination.content||[]),...(fragment.content||[])]});
  return normalize(fragment);
}

module.exports = { createNumberingClipboard, prepareNumberingPaste, attributes, resolve, normalize, validateLevels, validateNumbering, normalizePattern: validateNumbering, defaultLevels, formatOrdinal, resolveMarkers, planNumberingEdit, normalizeAuthoring, applyDefinitionChange };

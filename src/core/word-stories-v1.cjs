'use strict';
const KEY = 'wordStories';
const ROLES = ['header', 'footer'], VARIANTS = ['default', 'first', 'even'];
const copy = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Error(code || 'WORD_STORIES_INVALID'); };
function data(value, depth = 0) {
  if (depth > 32) fail();
  if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return;
  if (!value || typeof value !== 'object' || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value) && (value.length > 10000 || keys.length !== value.length + 1)) fail();
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !Object.hasOwn(field, 'value')) fail();
    data(field.value, depth + 1);
  }
}
function keys(value, allowed) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail(); }
function validateInternal(value, sectionCount, projectionOnly) {
  data(value); keys(value, ['schemaVersion', 'evenAndOddHeaders', 'stories', 'sections']);
  if (value.schemaVersion !== 1 || typeof value.evenAndOddHeaders !== 'boolean' || !Array.isArray(value.stories) || value.stories.length > 128
    || !Array.isArray(value.sections) || value.sections.length !== sectionCount) fail();
  const ids = new Map(); let bytes = 0;
  for (const story of value.stories) {
    keys(story, ['id', 'role', 'body']);
    if (typeof story.id !== 'string' || !/^[A-Za-z0-9_-]{1,96}$/.test(story.id) || ids.has(story.id) || !ROLES.includes(story.role)) fail();
    require('./word-manuscript-notes-v1.cjs')[projectionOnly ? 'validateNoteBodyProjection' : 'validateNoteBody'](story.body);
    bytes += new TextEncoder().encode(JSON.stringify(story.body)).length;
    if (bytes > 1024 * 1024) fail('WORD_STORIES_BUDGET');
    ids.set(story.id, story.role);
  }
  const used = new Set();
  for (const section of value.sections) {
    keys(section, ['titlePage', 'header', 'footer']);
    if (typeof section.titlePage !== 'boolean') fail();
    for (const role of ROLES) {
      keys(section[role], VARIANTS);
      for (const id of Object.values(section[role])) { if (ids.get(id) !== role) fail(); used.add(id); }
    }
  }
  if (used.size !== ids.size) fail('WORD_STORIES_ORPHAN');
  return copy(value);
}
function readInternal(doc, projectionOnly) {
  const ad = Object.getOwnPropertyDescriptor(doc || {}, 'attrs');
  if (ad && !Object.hasOwn(ad, 'value')) fail();
  const field = ad?.value && Object.getOwnPropertyDescriptor(ad.value, KEY);
  if (field && !Object.hasOwn(field, 'value')) fail();
  if (field?.value == null) return null;
  const sections = require('./word-sections-v1.cjs').read(doc);
  if (!sections) fail('WORD_STORIES_SECTIONS_REQUIRED');
  return validateInternal(field.value, sections.boundaries.length + 1, projectionOnly);
}
function validate(value, sectionCount) { return validateInternal(value, sectionCount, false); }
function read(doc) { return readInternal(doc, false); }
function readProjection(doc) { return readInternal(doc, true); }
function bindProjection(doc, value) { const result=copy(doc);result.attrs={...result.attrs,[KEY]:copy(value)};readProjection(result);return result; }
function replaceBodyProjection(doc,id,body) { data(body); const value=readProjection(doc),story=value?.stories.find(s=>s.id===id);if(!story)fail('WORD_STORY_MISSING');story.body=require('./word-manuscript-notes-v1.cjs').validateNoteBodyProjection(body).body;return bindProjection(doc,value); }
function validateSaveProjection(before,after) { if(JSON.stringify(topology(readProjection(before)))!==JSON.stringify(topology(readProjection(after))))fail('WORD_STORIES_SAVE_AUTHORITY'); }
function bind(doc, value) { const result = copy(doc); result.attrs = { ...result.attrs, [KEY]: copy(value) }; read(result); return result; }
function topology(value) { return value && { schemaVersion: value.schemaVersion, evenAndOddHeaders: value.evenAndOddHeaders, sections: value.sections, stories: value.stories.map(({id, role}) => ({id, role})) }; }
function validateSave(before, after) {
  const a = read(before), b = read(after);
  if (JSON.stringify(topology(a)) !== JSON.stringify(topology(b))) fail('WORD_STORIES_SAVE_AUTHORITY');
}
function replaceBody(doc, id, body) {
  data(body);
  const value = read(doc), story = value?.stories.find(s => s.id === id);
  if (!story) fail('WORD_STORY_MISSING');
  story.body = require('./word-manuscript-notes-v1.cjs').validateNoteBody(body).body;
  return bind(doc, value);
}
function resolved(value) {
  let previous = { header: {}, footer: {} };
  return value.sections.map(section => {
    previous = { titlePage: section.titlePage, header: { ...previous.header, ...section.header }, footer: { ...previous.footer, ...section.footer } };
    return copy(previous);
  });
}

// Native command planner. Caller supplies the current authoritative document and
// (only when no imported sections exist) geometry derived from project settings.
function planStoryMutation(doc, intent, options = {}) {
  data(intent); keys(intent, ['op','sectionIndex','role','variant','source','titlePage','evenAndOddHeaders']);
  data(options); keys(options, ['trustedSections','idSeed']);
  if (options.idSeed !== undefined && (typeof options.idSeed !== 'string' || !options.idSeed || options.idSeed.length > 1024)) fail('WORD_STORY_ID_SEED');
  if (!['create','remove','linkPrevious','setSectionOptions'].includes(intent.op)) fail('WORD_STORY_INTENT');
  const sectionModel = require('./word-sections-v1.cjs');
  let next = copy(doc), sections = sectionModel.read(doc);
  if (!sections) {
    if (!options.trustedSections) fail('WORD_STORIES_TRUSTED_GEOMETRY_REQUIRED');
    next = sectionModel.bind(next, options.trustedSections); sections = sectionModel.read(next);
  }
  const count = sections.boundaries.length + 1;
  if (!Number.isSafeInteger(intent.sectionIndex) || intent.sectionIndex < 0 || intent.sectionIndex >= count) fail('WORD_STORY_SECTION');
  let value = read(next) || { schemaVersion:1, evenAndOddHeaders:false, stories:[],
    sections:Array.from({length:count},()=>({titlePage:false,header:{},footer:{}})) };
  const section = value.sections[intent.sectionIndex];
  let storyId = null;
  if (intent.op === 'setSectionOptions') {
    if (['role','variant','source'].some(k=>Object.hasOwn(intent,k))
      || !['titlePage','evenAndOddHeaders'].some(k=>Object.hasOwn(intent,k))) fail('WORD_STORY_INTENT');
    for (const key of ['titlePage','evenAndOddHeaders']) if (Object.hasOwn(intent,key)) {
      if (typeof intent[key] !== 'boolean') fail('WORD_STORY_INTENT');
      if (key === 'titlePage') section.titlePage = intent[key]; else value.evenAndOddHeaders = intent[key];
    }
  } else {
    if (!ROLES.includes(intent.role) || !VARIANTS.includes(intent.variant)
      || ['titlePage','evenAndOddHeaders'].some(k=>Object.hasOwn(intent,k))
      || intent.op !== 'create' && Object.hasOwn(intent,'source')) fail('WORD_STORY_INTENT');
    const slot = section[intent.role], effective = resolved(value)[intent.sectionIndex][intent.role][intent.variant];
    if (intent.op === 'linkPrevious') {
      if (!intent.sectionIndex) fail('WORD_STORY_NO_PREVIOUS_SECTION');
      delete slot[intent.variant];
      storyId = resolved(value)[intent.sectionIndex][intent.role][intent.variant] || null;
    } else {
      if (intent.source !== undefined && !['copy','empty'].includes(intent.source)) fail('WORD_STORY_INTENT');
      const old = effective && value.stories.find(s=>s.id===effective);
      const body = intent.op === 'create' && intent.source !== 'empty' && old
        ? copy(old.body) : {type:'doc',content:[{type:'paragraph'}]};
      const seed = options.idSeed || globalThis.crypto.randomUUID();
      storyId = `story-${require('./browser-safe-hash.cjs').hashCanonicalValue({seed,value})}`;
      if (value.stories.some(s=>s.id===storyId)) fail('WORD_STORY_ID_COLLISION');
      value.stories.push({id:storyId,role:intent.role,body}); slot[intent.variant] = storyId;
    }
  }
  const used = new Set(value.sections.flatMap(s=>ROLES.flatMap(role=>Object.values(s[role]))));
  value.stories = value.stories.filter(s=>used.has(s.id));
  next = bind(next,value);
  return {doc:next,storyId,changed:JSON.stringify(next)!==JSON.stringify(doc)};
}


// Private authenticated-return planner. Both endpoints are canonical slots in
// the current trusted document; transport or renderer IDs are never accepted.
function planStoryReference(doc, intent) {
  data(intent); keys(intent, ['sectionIndex','role','variant','sourceSectionIndex','sourceVariant']);
  const value = read(doc);
  if (!value || !ROLES.includes(intent.role) || !VARIANTS.includes(intent.variant)
    || !VARIANTS.includes(intent.sourceVariant)
    || !['sectionIndex','sourceSectionIndex'].every(key=>Number.isSafeInteger(intent[key]) && intent[key]>=0 && intent[key]<value.sections.length)) fail('WORD_STORY_REFERENCE_INTENT');
  const storyId = resolved(value)[intent.sourceSectionIndex][intent.role][intent.sourceVariant];
  if (!storyId || !value.stories.some(story=>story.id===storyId && story.role===intent.role)) fail('WORD_STORY_REFERENCE_SOURCE');
  value.sections[intent.sectionIndex][intent.role][intent.variant] = storyId;
  const used = new Set(value.sections.flatMap(section=>ROLES.flatMap(role=>Object.values(section[role]))));
  value.stories = value.stories.filter(story=>used.has(story.id));
  const next = bind(doc,value);
  return {doc:next,storyId,changed:JSON.stringify(next)!==JSON.stringify(doc)};
}

module.exports = { planStoryReference, planStoryMutation, readProjection, bindProjection, replaceBodyProjection, validateSaveProjection, KEY, ROLES, VARIANTS, validate, read, bind, topology, validateSave, replaceBody, resolved };

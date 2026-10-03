'use strict';
// Native authority wrapper; renderer imports the dependency-closed projection.
const projection = require('./word-stories-projection-v1.cjs');
const { KEY, ROLES, VARIANTS, assertData:data, assertKeys:keys, topology, resolved,
  readProjection, bindProjection, replaceBodyProjection, validateSaveProjection } = projection;
const copy = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Error(code || 'WORD_STORIES_INVALID'); };
function validate(value, sectionCount) {
  const result = projection.validateProjection(value, sectionCount);
  for (const story of result.stories) require('./word-manuscript-notes-v1.cjs').validateNoteBody(story.body);
  return result;
}
function read(doc) {
  const result = readProjection(doc);
  if (result) for (const story of result.stories) require('./word-manuscript-notes-v1.cjs').validateNoteBody(story.body);
  return result;
}
function bind(doc,value) { const result=copy(doc); result.attrs={...result.attrs,[KEY]:copy(value)};read(result);return result; }
function validateSave(before,after) { if(JSON.stringify(topology(read(before)))!==JSON.stringify(topology(read(after))))fail('WORD_STORIES_SAVE_AUTHORITY'); }
function replaceBody(doc,id,body) {
  data(body); const value=read(doc),story=value?.stories.find(s=>s.id===id);if(!story)fail('WORD_STORY_MISSING');
  story.body=require('./word-manuscript-notes-v1.cjs').validateNoteBody(body).body;return bind(doc,value);
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
      if (options.idSeed === undefined) fail('WORD_STORY_ID_SEED');
      const seed = options.idSeed;
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

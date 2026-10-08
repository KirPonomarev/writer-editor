import bodyTypography from '../../core/word-review-typography-v1.cjs';
import storiesModel from '../../core/word-stories-v1.cjs';
import noteModel from '../../core/word-manuscript-notes-v1.cjs';
import tables from '../documentTables.js';

const copy = value => JSON.parse(JSON.stringify(value));
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value && typeof value === 'object'
  ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
const equal = (a, b) => stable(a) === stable(b);
function equivalentBody(left, right, defaults) {
  const a = noteModel.validateNoteBody(left).paragraphs, b = noteModel.validateNoteBody(right).paragraphs;
  if (!tables.compareTableParagraphTopology(b, a.map(({table}) => ({formatIr:{table}}))).ok) return false;
  const meanings = rows => rows.map(({paragraph,list}) => {
    const runs=[];
    for (const node of paragraph.content || []) {
      if (node.type !== 'text') { runs.push(node); continue; }
      const style={...(defaults?.fontSize ? {fontSize:defaults.fontSize} : {})}, marks=[];
      for (const mark of node.marks || []) {
        if (mark.type === 'textStyle') Object.assign(style,Object.fromEntries(Object.entries(mark.attrs || {}).filter(([,v])=>v != null)));
        else if (mark.type === 'link') marks.push({type:'link',href:mark.attrs.href});
        else marks.push(mark.type === 'highlight' ? {type:mark.type,color:mark.attrs.color.toLowerCase()} : {type:mark.type});
      }
      if(style.color)style.color=style.color.toLowerCase();
      if(Object.keys(style).length)marks.push({type:'textStyle',attrs:style});
      marks.sort((x,y)=>x.type.localeCompare(y.type));
      const prior=runs.at(-1);
      if(prior?.type==='text' && equal(prior.marks,marks))prior.text+=node.text;
      else runs.push({type:'text',text:node.text,marks});
    }
    return {markTypography:paragraph.attrs?.wordParagraphMarkTypography??null,indent:paragraph.attrs?.wordParagraphIndent??null,tabs:paragraph.attrs?.wordParagraphTabs??null,align:paragraph.attrs?.textAlign || 'left',spacing:paragraph.attrs?.wordParagraphSpacing||null,language:paragraph.attrs?.wordParagraphMarkLanguage||null,runs,list};
  });
  return equal(meanings(a),meanings(b));
}
const reject = code => { throw Error(code); };

// Part names and relationship IDs are untrusted transport locators. Only a
// bijection induced by protected section/role references identifies a story.
export function analyzeDocumentStoriesReturn({ expected, returned, beforeDocs, exportTypography, allowTopology = false, idSeed }) {
  try {
    bodyTypography.validate(exportTypography,{allowUndefined:true});
    if (!expected) {
      if (returned) reject('WORD_STORIES_RETURN_UNEXPECTED');
      return { ok: true, changed: false, candidates: [] };
    }
    const baseline = storiesModel.validate(expected.registry, expected.registry.sections.length);
    if (!returned && !baseline.stories.length && !baseline.evenAndOddHeaders && !baseline.sections.some(section=>section.titlePage)) return {ok:true,changed:false,candidates:[]};
    if (!returned) reject('WORD_STORIES_RETURN_MISSING');
    const actual = storiesModel.validate(returned, baseline.sections.length);
    if (actual.evenAndOddHeaders !== baseline.evenAndOddHeaders) reject('WORD_STORIES_RETURN_TOPOLOGY');
    const empty = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    const isEmpty = body => body?.content?.every(node => node.type === 'paragraph' && !(node.content || []).length);
    const expectedSections = storiesModel.resolved(baseline), returnedSections = storiesModel.resolved(actual);
    if (allowTopology) {
      const genuine=new Set(expected.sourceBindings.filter(binding=>binding.reset!==true).map(binding=>binding.exportStoryId));
      const forward=new Map(),reverse=new Map();
      for(let i=0;i<expectedSections.length;i++)for(const role of storiesModel.ROLES)for(const variant of storiesModel.VARIANTS) {
        const oldId=expectedSections[i][role][variant],newId=returnedSections[i][role][variant];
        if(!genuine.has(oldId) || !newId)continue;
        if(!forward.has(oldId))forward.set(oldId,new Set());forward.get(oldId).add(newId);
        if(!reverse.has(newId))reverse.set(newId,new Set());reverse.get(newId).add(oldId);
      }
      if([...forward.values(),...reverse.values()].some(ids=>ids.size>1))reject('WORD_STORIES_RETURN_TOPOLOGY');
    }
    const bodies = new Map(), used = new Set();
    for (let index = 0; index < expectedSections.length; index++) {
      const a = expectedSections[index], b = returnedSections[index];
      if (a.titlePage !== b.titlePage) reject('WORD_STORIES_RETURN_TOPOLOGY');
      for (const role of storiesModel.ROLES) for (const variant of storiesModel.VARIANTS) {
        const oldId = a[role][variant], newId = b[role][variant];
        const newStory = actual.stories.find(item => item.id === newId);
        if (newId && (!newStory || newStory.role !== role)) reject('WORD_STORIES_RETURN_ROLE');
        const nextBody = newStory?.body || empty;
        if (newId) used.add(newId);
        // Word materializes absent first/even stories as explicit empty parts.
        // Their bytes and IDs do not create a new canonical entity.
        if (!oldId) {
          if (!isEmpty(nextBody)) reject('WORD_STORIES_RETURN_TOPOLOGY');
          continue;
        }
        const prior = bodies.get(oldId);
        if (prior && !equivalentBody(prior, nextBody, exportTypography) && !(isEmpty(prior) && isEmpty(nextBody))) reject('WORD_STORIES_RETURN_ALIAS');
        bodies.set(oldId, nextBody);
      }
    }
    if (bodies.size !== baseline.stories.length || used.size !== actual.stories.length) reject('WORD_STORIES_RETURN_TOPOLOGY');
    const docs = new Map(), changes = [];
    for (const oldStory of baseline.stories) {
      const returnedBody = bodies.get(oldStory.id);
      const next = { body: equivalentBody(oldStory.body, returnedBody, exportTypography) ? oldStory.body : returnedBody };
      const bindings = expected.sourceBindings.filter(item => item.exportStoryId === oldStory.id);
      if (bindings.length !== 1) reject('WORD_STORIES_RETURN_SOURCE_BINDING');
      const binding = bindings[0];
      if (binding.reset === true) {
        if (!equal(oldStory.body, next.body)) reject('WORD_STORIES_RETURN_RESET_CHANGED');
        continue;
      }
      const original = beforeDocs?.[binding.sceneId];
      const local = storiesModel.read(original)?.stories.find(item => item.id === binding.storyId);
      if (!local || local.role !== oldStory.role || !equal(local.body, oldStory.body)) reject('WORD_STORIES_RETURN_BASELINE');
      if (equal(oldStory.body, next.body)) continue;
      docs.set(binding.sceneId, storiesModel.replaceBody(docs.get(binding.sceneId) || original, binding.storyId, next.body));
      changes.push({ sceneId: binding.sceneId, storyId: binding.storyId, role: local.role,
        beforeBody: copy(local.body), afterBody: copy(next.body) });
    }
    const candidates = [...docs].map(([sceneId, doc]) => {
      storiesModel.validateSave(beforeDocs[sceneId], doc);
      return { sceneId, beforeDoc: copy(beforeDocs[sceneId]), plan: { changed: true, doc },
        changes: changes.filter(item => item.sceneId === sceneId) };
    });
    return { ok: true, changed: candidates.length > 0, candidates };
  } catch (error) {
    if (allowTopology && ['WORD_STORIES_RETURN_TOPOLOGY','WORD_STORIES_RETURN_ALIAS','WORD_STORIES_RETURN_RESET_CHANGED','WORD_STORIES_RETURN_MISSING'].includes(error.message)) {
      try { return analyzeTopologyReturn({expected,returned,beforeDocs,exportTypography,idSeed}); }
      catch (failure) { return {ok:false,changed:false,code:failure.code || failure.message}; }
    }
    return { ok: false, changed: false, code: error.code || error.message };
  }
}

export function revalidateDocumentStoryCandidate(candidate) {
  if (candidate.storyMutationReplay) {
    const doc = replayDocumentStoryMutationSteps(candidate.beforeDoc,candidate.storyMutationReplay);
    if (!equal(doc,candidate.plan.doc)) reject('WORD_STORIES_RETURN_CANDIDATE');
    return {changed:true,doc,storyMutationReplay:copy(candidate.storyMutationReplay)};
  }
  const before = storiesModel.read(candidate.beforeDoc);
  let doc = copy(candidate.beforeDoc);
  if (!before || !Array.isArray(candidate.changes) || !candidate.changes.length) reject('WORD_STORIES_RETURN_CANDIDATE');
  for (const change of candidate.changes) {
    const source = before.stories.find(item => item.id === change.storyId);
    if (!source || source.role !== change.role || !equal(source.body, change.beforeBody)) reject('WORD_STORIES_RETURN_CANDIDATE');
    doc = storiesModel.replaceBody(doc, change.storyId, change.afterBody);
  }
  storiesModel.validateSave(candidate.beforeDoc, doc);
  if (!equal(doc, candidate.plan.doc)) reject('WORD_STORIES_RETURN_CANDIDATE');
  return { changed: true, doc };
}

// The private authority stores typed operations, never the returned part IDs.
// Replaying them preserves Core geometry and allocates identities from a Main nonce.
export function replayDocumentStoryMutationSteps(beforeDoc, steps) {
  if (!Array.isArray(steps) || !steps.length || steps.length > 16384) reject('WORD_STORIES_RETURN_STEPS');
  let doc=copy(beforeDoc);
  for(const step of steps) {
    if(step.kind==='intent') doc=storiesModel.planStoryMutation(doc,step.intent,step.options).doc;
    else if(step.kind==='reference') doc=storiesModel.planStoryReference(doc,step.intent).doc;
    else if(step.kind==='body') {
      const id=storiesModel.resolved(storiesModel.read(doc))[step.sectionIndex]?.[step.role]?.[step.variant];
      if(!id)reject('WORD_STORIES_RETURN_STEPS');
      doc=storiesModel.replaceBody(doc,id,step.body);
    } else reject('WORD_STORIES_RETURN_STEPS');
  }
  return doc;
}
function analyzeTopologyReturn({expected,returned,beforeDocs,exportTypography,idSeed}) {
  if(typeof idSeed!=='string' || !idSeed || !expected?.sourceScenes?.length)reject('WORD_STORIES_RETURN_TOPOLOGY_AUTHORITY');
  const baseline=storiesModel.validate(expected.registry,expected.registry.sections.length);
  const actual=returned ? storiesModel.validate(returned,baseline.sections.length) : {schemaVersion:1,evenAndOddHeaders:false,stories:[],sections:baseline.sections.map(()=>({titlePage:false,header:{},footer:{}}))};
  const oldSlots=storiesModel.resolved(baseline), nextSlots=storiesModel.resolved(actual);
  const empty={type:'doc',content:[{type:'paragraph'}]}, candidates=[];
  const bodyAt=(registry,id)=>registry.stories.find(story=>story.id===id)?.body || empty;
  const covered=new Set();
  for(const source of expected.sourceScenes) {
    const before=beforeDocs[source.sceneId], registry=storiesModel.read(before);
    if(!before || !equal(registry,source.registry) || !Number.isSafeInteger(source.sectionStart)
      || source.sectionStart<0 || source.sectionStart+source.sectionCount>baseline.sections.length || !Number.isSafeInteger(source.sectionCount) || source.sectionCount<1)reject('WORD_STORIES_RETURN_SOURCE_BINDING');
    for(let i=0;i<source.sectionCount;i++)covered.add(source.sectionStart+i);
    let doc=copy(before);const steps=[],groups=new Map(),claimed=new Set(),changes=[];
    const apply=step=>{steps.push(step);doc=replayDocumentStoryMutationSteps(doc,[step]);};
    const intent=(value)=>apply({kind:'intent',intent:value,options:{idSeed:idSeed+':'+source.sceneId+':'+steps.length,...(!doc.attrs?.wordSections && source.trustedSections ? {trustedSections:source.trustedSections}:{})}});
    const localBaseline=registry || {evenAndOddHeaders:false,sections:Array.from({length:source.sectionCount},()=>({titlePage:false,header:{},footer:{}}))};
    let even=localBaseline.evenAndOddHeaders;
    if(actual.evenAndOddHeaders!==baseline.evenAndOddHeaders)even=actual.evenAndOddHeaders;
    else if(!even && actual.evenAndOddHeaders)for(let local=0;local<source.sectionCount;local++)for(const role of storiesModel.ROLES) {
      const idx=source.sectionStart+local;
      // A local single-variant scene exports its default on both odd and even
      // pages. Keep that mode only while the returned effective bodies agree.
      // Comparing only old/new even bodies misses a new odd-only header.
      if(!equivalentBody(bodyAt(actual,nextSlots[idx][role].default),bodyAt(actual,nextSlots[idx][role].even),exportTypography))even=true;
    }
    for(let local=0;local<source.sectionCount;local++) {
      const global=source.sectionStart+local, target=nextSlots[global];if(!target)reject('WORD_STORIES_RETURN_SOURCE_BINDING');
      if(local===0 && even!==localBaseline.evenAndOddHeaders)intent({op:'setSectionOptions',sectionIndex:0,evenAndOddHeaders:even});
      if(target.titlePage!==localBaseline.sections[local].titlePage)intent({op:'setSectionOptions',sectionIndex:local,titlePage:target.titlePage});
      for(const role of storiesModel.ROLES)for(const variant of storiesModel.VARIANTS) {
        if(variant==='even' && !even && actual.evenAndOddHeaders===baseline.evenAndOddHeaders)continue;
        const returnedId=target[role][variant], oldTransportId=oldSlots[global][role][variant];
        const returnedBody=bodyAt(actual,returnedId), oldTransportBody=bodyAt(baseline,oldTransportId);
        let current=doc.attrs?.wordStories ? storiesModel.resolved(storiesModel.read(doc))[local][role][variant] : undefined;
        // Native Word's synthetic empty declarations do not manufacture entities.
        if(!current && equivalentBody(empty,returnedBody,exportTypography))continue;
        const key=role+':'+(returnedId || 'empty:'+variant), group=groups.get(key);
        const stepCountBefore=steps.length;
        const originalId=registry ? storiesModel.resolved(registry)[local][role][variant] : undefined;
        const beforeBody=registry ? bodyAt(registry,originalId) : empty;
        if(group) {
          const targetId=storiesModel.resolved(storiesModel.read(doc))[group.sectionIndex][role][group.variant];
          if(current!==targetId)apply({kind:'reference',intent:{sectionIndex:local,role,variant,sourceSectionIndex:group.sectionIndex,sourceVariant:group.variant}});
        } else {
          if(!current || claimed.has(current)) {
            intent({op:'create',sectionIndex:local,role,variant,source:'empty'});
            current=storiesModel.resolved(storiesModel.read(doc))[local][role][variant];
          }
          claimed.add(current);groups.set(key,{sectionIndex:local,variant});
          const oldBody=bodyAt(storiesModel.read(doc),current);
          if(!equivalentBody(oldBody,returnedBody,exportTypography))apply({kind:'body',sectionIndex:local,role,variant,body:copy(returnedBody)});
        }
        const afterRegistry=storiesModel.read(doc), afterId=storiesModel.resolved(afterRegistry)[local][role][variant];
        const afterBody=bodyAt(afterRegistry,afterId);
        if(steps.length!==stepCountBefore || !equal(beforeBody,afterBody) || current!==afterId || !equivalentBody(oldTransportBody,returnedBody,exportTypography))
          changes.push({sceneId:source.sceneId,storyId:afterId,role,beforeBody:copy(beforeBody),afterBody:copy(afterBody)});
      }
    }
    if(!equal(doc,before)) {
      if(!changes.length)changes.push({sceneId:source.sceneId,storyId:null,role:'header',beforeBody:empty,afterBody:empty});
      candidates.push({sceneId:source.sceneId,beforeDoc:copy(before),plan:{changed:true,doc},storyMutationReplay:steps,changes});
    }
  }
  if(covered.size!==baseline.sections.length)reject('WORD_STORIES_RETURN_SOURCE_BINDING');
  return {ok:true,changed:!!candidates.length,candidates};
}

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
    return {align:paragraph.attrs?.textAlign || 'left',runs,list};
  });
  return equal(meanings(a),meanings(b));
}
const reject = code => { throw Error(code); };

// Part names and relationship IDs are untrusted transport locators. Only a
// bijection induced by protected section/role references identifies a story.
export function analyzeDocumentStoriesReturn({ expected, returned, beforeDocs, exportTypography }) {
  try {
    if (!expected) {
      if (returned) reject('WORD_STORIES_RETURN_UNEXPECTED');
      return { ok: true, changed: false, candidates: [] };
    }
    const baseline = storiesModel.validate(expected.registry, expected.registry.sections.length);
    if (!returned) reject('WORD_STORIES_RETURN_MISSING');
    const actual = storiesModel.validate(returned, baseline.sections.length);
    if (actual.evenAndOddHeaders !== baseline.evenAndOddHeaders) reject('WORD_STORIES_RETURN_TOPOLOGY');
    const empty = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    const isEmpty = body => body?.content?.every(node => node.type === 'paragraph' && !(node.content || []).length);
    const expectedSections = storiesModel.resolved(baseline), returnedSections = storiesModel.resolved(actual);
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
  } catch (error) { return { ok: false, changed: false, code: error.code || error.message }; }
}

export function revalidateDocumentStoryCandidate(candidate) {
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

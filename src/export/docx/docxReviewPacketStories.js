const { buildDocxWordParagraphLayoutXml, buildDocxWordParagraphSpacingXml } = require('./docxPendingRevisions.js');
const { buildDocxWordLanguageXml } = require('./docxInlineTypography.js');
'use strict';
const model = require('../../core/word-stories-v1.cjs');
const { validateNoteBody } = require('../../core/word-manuscript-notes-v1.cjs');
const { renderTableParagraphs } = require('../../io/documentTables.js');
const { buildMediaPackage, mergeMediaParts, mergeMediaTypes } = require('./docxMedia.js');
const { escapeXml } = require('./docxTextXml.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const copy = v => JSON.parse(JSON.stringify(v));
function sceneStoryGeometry(scene, sections, blocks) {
  const local = require('../../core/word-sections-v1.cjs').read(scene.doc);
  const ownBlocks = blocks?.filter(block=>block.sceneId===scene.sceneId);
  if (!ownBlocks?.length) throw Error('WORD_STORIES_EXPORT_SOURCE_BLOCKS');
  const start = ownBlocks[0].documentParagraphIndex, end = ownBlocks.at(-1).documentParagraphIndex;
  const covered = sections.filter(section=>section.startParagraphIndex<=end && section.endParagraphIndex>=start);
  if (!covered.length || covered[0].startParagraphIndex>start || covered.at(-1).endParagraphIndex<end) throw Error('WORD_STORIES_EXPORT_SOURCE_SECTIONS');
  const trustedSections = local || {schemaVersion:1,boundaries:covered.slice(0,-1).map(section=>{
    const index=ownBlocks.findIndex(block=>block.documentParagraphIndex===section.endParagraphIndex);
    if(index<0)throw Error('WORD_STORIES_EXPORT_SOURCE_BOUNDARY');
    return {endParagraphIndex:index,properties:copy(section.properties)};
  }),final:copy(covered.at(-1).properties)};
  return {sectionStart:covered[0].ordinal,sectionCount:covered.length,trustedSections};
}
function buildDocumentStoriesExport(scenes, documentSections = null, {includeEmpty=false,blocks=null}={}) {
  if (!scenes.some(scene => model.read(scene.doc))) {
    if (!includeEmpty) return null;
    const sections=documentSections?.protectedSections;
    if (!Array.isArray(sections) || !sections.length) throw Error('WORD_STORIES_EXPORT_SECTIONS_REQUIRED');
    const registry={schemaVersion:1,evenAndOddHeaders:false,stories:[],sections:sections.map(()=>({titlePage:false,header:{},footer:{}}))};
    const sourceScenes=scenes.map(scene=>({sceneId:scene.sceneId,registry:null,...sceneStoryGeometry(scene,sections,blocks)}));
    model.validate(registry,sections.length);
    const sourceBindings=[];
    const protectedDigest=require('node:crypto').createHash('sha256').update(JSON.stringify({registry,sourceBindings,sourceScenes})).digest('hex');
    return {schemaVersion:1,registry,sourceBindings,sourceScenes,protectedDigest};
  }
  const globalEven = scenes.some(scene => model.read(scene.doc)?.evenAndOddHeaders);
  const registry = {schemaVersion:1,evenAndOddHeaders:globalEven,stories:[],sections:[]}, sourceBindings = [], sourceScenes = [];
  for (const scene of scenes) {
    const original = model.read(scene.doc);
    const count = (require('../../core/word-sections-v1.cjs').read(scene.doc)?.boundaries.length || 0) + 1;
    const sectionStart = registry.sections.length;
    sourceScenes.push({sceneId:scene.sceneId,sectionStart,sectionCount:count,registry:original,
      ...(!original && documentSections && blocks ? {trustedSections:sceneStoryGeometry(scene,documentSections.protectedSections,blocks).trustedSections} : {})});
    const mapping = new Map();
    for (const story of original?.stories || []) {
      const id = `global-story-${registry.stories.length + 1}`; mapping.set(story.id,id);
      registry.stories.push({...story,id}); sourceBindings.push({sceneId:scene.sceneId,storyId:story.id,exportStoryId:id});
    }
    registry.evenAndOddHeaders ||= original?.evenAndOddHeaders || false;
    const effective = original ? model.resolved(original) : null;
    const sections = original?.sections || Array.from({length:count},()=>({titlePage:false,header:{},footer:{}}));
    sections.forEach((section,index) => {
      const out = {titlePage:section.titlePage,header:{},footer:{}};
      for (const role of model.ROLES) for (const variant of model.VARIANTS) {
        const localId = variant === 'even' && globalEven && !original?.evenAndOddHeaders ? effective?.[index]?.[role]?.default : section[role][variant];
        if (localId) out[role][variant] = mapping.get(localId);
        // Scene boundaries are independent authoring roots; never inherit the
        // previous scene's header/footer. Explicit empty parts reset absence.
        else if (index === 0 || variant === 'even' && globalEven && !original?.evenAndOddHeaders) {
          let reset = registry.stories.find(s => s.id === `empty-${role}`);
          if (!reset) { reset={id:`empty-${role}`,role,body:{type:'doc',content:[{type:'paragraph'}]}}; registry.stories.push(reset); sourceBindings.push({sceneId:null,storyId:null,exportStoryId:reset.id,reset:true}); }
          out[role][variant] = reset.id;
        }
      }
      registry.sections.push(out);
    });
  }
  if (documentSections && documentSections.protectedSections?.length !== registry.sections.length) throw Error('WORD_STORIES_EXPORT_SECTION_TOPOLOGY');
  const used = new Set(registry.sections.flatMap(section => model.ROLES.flatMap(role => Object.values(section[role]))));
  registry.stories = registry.stories.filter(story => used.has(story.id));
  const activeBindings = sourceBindings.filter(binding => used.has(binding.exportStoryId));
  model.validate(registry,registry.sections.length);
  const protectedDigest = require('node:crypto').createHash('sha256').update(JSON.stringify({registry,sourceBindings,sourceScenes})).digest('hex');
  return {schemaVersion:1,registry,sourceBindings:activeBindings,sourceScenes,protectedDigest};
}
function storySectionXml(registry, sectionIndex, ids) {
  if (!registry) return '';
  const section=registry.sections[sectionIndex]; if(!section) throw Error('WORD_STORY_SECTION_MISSING');
  return model.ROLES.flatMap(role => model.VARIANTS.filter(v => section[role][v]).map(v => `<w:${role}Reference w:type="${v}" r:id="${ids.get(section[role][v])}"/>`)).join('') + (section.titlePage ? '<w:titlePg/>' : '');
}
function storyPackageParts(projection, {firstNumId=1}={}) {
  if (!projection) return {entries:[],contentTypes:'',relationships:'',numberings:[],mediaParts:[],mediaTypes:'',sectionXml:()=>'',evenAndOddHeaders:false};
  const registry=projection.registry || projection; model.validate(registry,registry.sections.length);
  const entries=[],types=[],relationships=[],numberings=[],mediaParts=[],mediaTypes=[],ids=new Map();let nextNumId=firstNumId;
  registry.stories.forEach((story,index) => {
    const name=`${story.role}Yalken${index+1}.xml`, id=`rIdYalkenStory${index+1}`;ids.set(story.id,id);
    const rows=validateNoteBody(story.body).paragraphs, links=new Map(), numbers=new Map();
    const media=buildMediaPackage(story.body,{firstPlacementId:2400000+index*4096});mediaParts.push(...media.parts);mediaTypes.push(media.contentTypes);
    for(const {list} of rows) if(list && !numbers.has(list.numId)){numbers.set(list.numId,nextNumId);numberings.push({...list,numId:nextNumId++});}
    const body=renderTableParagraphs(rows, row=>row.table, ({paragraph,list})=>{
      const runs=(paragraph.content||[]).map(node=>{
        if(node.type==='image')return media.drawing(node.attrs);
        if(node.type==='hardBreak')return '<w:r><w:br/></w:r>';
        const xml=require('./docxMinBuilder.js').buildDocxMarkedRunXml(node,true,true),href=node.marks?.find(m=>m.type==='link')?.attrs?.href;
        if(!href)return xml;if(!links.has(href))links.set(href,`storyLink${links.size+1}`);
        return `<w:hyperlink r:id="${links.get(href)}">${xml}</w:hyperlink>`;
      }).join('');
      const align=paragraph.attrs?.textAlign;
      const spacing=buildDocxWordParagraphSpacingXml(paragraph.attrs?.wordParagraphSpacing)+buildDocxWordParagraphLayoutXml(paragraph.attrs),language=buildDocxWordLanguageXml(paragraph.attrs?.wordParagraphMarkLanguage);
      const pr=spacing+(language?`<w:rPr>${language}</w:rPr>`:'')+(list?`<w:numPr><w:ilvl w:val="${list.level}"/><w:numId w:val="${numbers.get(list.numId)}"/></w:numPr>`:'')+(align?`<w:jc w:val="${align==='justify'?'both':align}"/>`:'');
      return `<w:p>${pr?`<w:pPr>${pr}</w:pPr>`:''}${runs}</w:p>`;
    });
    const tag=story.role==='header'?'hdr':'ftr';
    entries.push({name:`word/${name}`,data:`<?xml version="1.0" encoding="UTF-8"?><w:${tag} xmlns:w="${W}" xmlns:r="${R}">${body}</w:${tag}>`});
    if(links.size||media.relationships)entries.push({name:`word/_rels/${name}.rels`,data:`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[...links].map(([href,id])=>`<Relationship Id="${id}" Type="${R}/hyperlink" Target="${escapeXml(href)}" TargetMode="External"/>`).join('')}${media.relationships}</Relationships>`});
    types.push(`<Override PartName="/word/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${story.role}+xml"/>`);
    relationships.push(`<Relationship Id="${id}" Type="${R}/${story.role}" Target="${name}"/>`);
  });
  return {entries,contentTypes:types.join(''),relationships:relationships.join(''),numberings,mediaParts:mergeMediaParts(mediaParts),mediaTypes:mergeMediaTypes(...mediaTypes),sectionXml:index=>storySectionXml(registry,index,ids),evenAndOddHeaders:registry.evenAndOddHeaders};
}
module.exports={buildDocumentStoriesExport,storyPackageParts,storySectionXml};

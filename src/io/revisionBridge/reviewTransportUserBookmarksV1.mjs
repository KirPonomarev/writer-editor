import wordLanguage from '../../core/word-language-v1.cjs';
import core from '../../core/word-user-bookmarks-v1.cjs';
import source from '../../export/docx/fullManuscriptDocxReviewPacketSource.js';
import { hashCanonicalValue, sha256Hex } from '../../core/browser-safe-hash.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const same = (a,b) => hashCanonicalValue(a) === hashCanonicalValue(b);
const reject = detail => ({ok:false,code:'RTK_USER_BOOKMARK_RETURN_CONFLICT',detail,analysisOnly:true,canWriteManuscript:false});
const key = name => core.validateName(name).toLowerCase();
function semanticParagraph(p){
  const out=clone(p), content=[];
  for(const node of out.content||[]){
    if(node.marks)node.marks.sort((a,b)=>hashCanonicalValue(a).localeCompare(hashCanonicalValue(b)));
    const last=content.at(-1);
    if(node.type==='text'&&last?.type==='text'&&same({...node,text:''},{...last,text:''}))last.text+=node.text;else content.push(node);
  }
  out.content=content;return out;
}
const stripRoot = doc => { const out=clone(doc); if(out.attrs) {delete out.attrs[core.KEY]; if(!Object.keys(out.attrs).length) delete out.attrs;} return out; };
const linksOf = doc => {
  const out=[];
  core.paragraphs(doc).forEach((p,paragraphIndex)=>{let offset=0; for(const node of p.content||[]) {
    const text=node.type==='hardBreak'?'\n':node.type==='text'?node.text:'';
    const links=(node.marks||[]).filter(mark=>mark.type==='link');
    if(links.length>1) throw Error('nested-link');
    if(links.length) out.push({paragraphIndex,from:offset,to:offset+text.length,mark:links[0]});
    offset+=text.length;
  }}); return out;
};
function style(state,defaultFontSize,languageMode=false) {
  const out={...state}; delete out.link; delete out.wordBookmarkName;
  if(languageMode) delete out.wordLanguage;
  if (defaultFontSize && !out.fontSize) out.fontSize=defaultFontSize;
  return out;
}
function runsForBase(block,defaultFontSize,languageMode=false) {
  return block.formatIr.runs.map(run=>{
    const links=(run.preservedMarks||[]).filter(mark=>mark.type==='link');
    if((run.preservedMarks||[]).some(mark=>!['link'].includes(mark.type)) || links.length>1) throw Error('rich-mark-unsupported');
    return {...run,link:links[0]?.attrs?.href||null,style:style(run.inline,defaultFontSize,languageMode)};
  });
}
function runsForReturn(paragraph,defaultFontSize,languageMode=false) {
  return paragraph.formattedRuns.map(run=>{
    if(run.invalidSupportedValue || run.wordLanguageInvalid || run.unsupportedNames?.some(name=>!(languageMode && name==='lang' && run.wordLanguage))) throw Error('rich-run-unsupported');
    return {...run,link:run.inlineState?.link||null,style:style(run.inlineState||{},defaultFontSize,languageMode)};
  });
}
function uniformAt(runs,from,to,signature) {
  return runs.filter(run=>run.from<to&&run.to>from).every(run=>same(run.style,signature));
}
function compareStyles(before,after,shift=0,start=0,end=Infinity) {
  const cuts=new Set([start,end]);
  before.forEach(run=>{if(run.from>start&&run.from<end)cuts.add(run.from);if(run.to>start&&run.to<end)cuts.add(run.to);});
  after.forEach(run=>{if(run.from-shift>start&&run.from-shift<end)cuts.add(run.from-shift);if(run.to-shift>start&&run.to-shift<end)cuts.add(run.to-shift);});
  const bounds=[...cuts].sort((a,b)=>a-b);
  for(let i=0;i<bounds.length-1;i++){
    if(bounds[i]===bounds[i+1])continue;
    const a=before.find(run=>run.from<=bounds[i]&&run.to>=bounds[i+1]);
    const b=after.find(run=>run.from<=bounds[i]+shift&&run.to>=bounds[i+1]+shift);
    const returnedStyle=b?.style&&{...b.style};
    if(a?.style.fontFamily&&!returnedStyle?.fontFamily&&b?.resolvedFontFamily===a.style.fontFamily)
      returnedStyle.fontFamily=b.resolvedFontFamily;
    if(!a||!b||!same(a.style,returnedStyle))throw Error('non-link-style-change');
  }
}
function replaceText(p,from,to,text) {
  let offset=0, emitted=false;const out=[];
  for(const node of p.content||[]) {
    if(!['text','hardBreak'].includes(node.type)) throw Error('rich-inline-unsupported');
    const value=node.type==='hardBreak'?'\n':node.text,end=offset+value.length;
    if(end<=from || offset>=to) out.push(clone(node));
    else {
      if(node.type!=='text' || text.includes('\n')) throw Error('label-linebreak-unsupported');
      if(offset<from)out.push({...clone(node),text:value.slice(0,from-offset)});
      if(!emitted){if(text)out.push({...clone(node),text});emitted=true;}
      if(end>to)out.push({...clone(node),text:value.slice(to-offset)});
    }
    offset=end;
  }
  if(!emitted)throw Error('label-footprint-missing');p.content=out;
}
function replaceLinks(p,runs,registry) {
  let offset=0;const out=[];
  for(const node of p.content||[]) {
    if(node.type==='text'&&typeof node.text!=='string')throw Error('rich-inline-invalid');
    if(!['text','hardBreak','manuscriptNoteReference'].includes(node.type))throw Error('rich-inline-unsupported');
    const value=node.type==='hardBreak'?'\n':node.type==='text'?node.text:'',end=offset+value.length;
    if(node.type!=='text'){out.push(node);offset=end;continue;}
    const cuts=[offset,...new Set(runs.flatMap(run=>[run.from,run.to]).filter(x=>x>offset&&x<end)),end].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++) {
      const from=cuts[i],to=cuts[i+1],run=runs.find(r=>r.from<=from&&r.to>=to);
      if(!run)throw Error('link-run-coverage');
      const marks=(node.marks||[]).filter(mark=>mark.type!=='link').map(clone);
      if(run.link){
        if(run.link.startsWith('#')){
          const record=registry.bookmarks.find(item=>key(item.name)===key(run.link.slice(1)));
          if(!record)throw Error('link-target-unbound');
          const old=(node.marks||[]).find(mark=>mark.type==='link'&&mark.attrs?.href?.startsWith('#'));
          marks.push({type:'link',attrs:{...(old?clone(old.attrs):{}),...core.linkAttrs(record)}});
        }else {
          const old=(node.marks||[]).find(mark=>mark.type==='link');
          if(old?.attrs?.href!==run.link)throw Error('external-target-change');marks.push(clone(old));
        }
      }
      const part={...clone(node),text:value.slice(from-offset,to-offset)};
      if(marks.length)part.marks=marks;else delete part.marks;out.push(part);
    }
    offset=end;
  }
  p.content=out;
}

// Caller owns authentication, private baseline acquisition and writer CAS.
// This module checks semantic bindings and produces no publication authority.
export function analyzeUserBookmarksReturn({baselineDoc,returnedDoc,baselineRegistry,exportMap,sceneId,reviewIr={},exportTypography,ordinaryTextMode=false}={}) {
  try {
    const registry=core.readRegistry(baselineDoc);
    if(baselineRegistry!==undefined&&!same(registry,baselineRegistry))return reject('baseline-registry');
    const scene=exportMap?.scenes?.find(item=>item.sceneId===sceneId);
    const allBlocks=exportMap?.scenes?.flatMap(item=>item.blocks||[]), observed=reviewIr.formattingParagraphs;
    if(!scene||!Array.isArray(scene.blocks)||!scene.blocks.length||!Array.isArray(observed)||observed.length!==allBlocks.length)return reject('block-cardinality');
    if(!same(scene.userBookmarks??null,registry))return reject('private-registry-binding');
    for(const name of ['textRevisions','moveRevisions','propertyRevisions'])if((reviewIr[name]||[]).length)return reject('tracked-composite');
    const technical=exportMap.userBookmarkTechnicalParts;
    if(reviewIr.technicalPartRelationships?.length
      && (technical?.schemaVersion!=='yalken.word-user-bookmark-technical-parts.v1'||!same(technical.relationships,reviewIr.technicalPartRelationships)))return reject('technical-relationships');
    const admitTechnical=item=>{
      if(!['customXml/item1.xml','customXml/itemProps1.xml'].includes(item.partName)||item.kind!=='unknown-part'||item.typedDiagnostic!=='RTK_OPAQUE_UNSUPPORTED_PART')return false;
      if(technical?.schemaVersion!=='yalken.word-user-bookmark-technical-parts.v1'||!Array.isArray(technical.parts)||technical.parts.length!==2||!same(technical.relationships,reviewIr.technicalPartRelationships))return false;
      const expected=technical.parts.filter(value=>value.partName===item.partName);
      const required='application/xml';
      return expected.length===1&&expected[0].contentType===required&&item.contentType===required&&/^sha256:[a-f0-9]{64}$/u.test(item.partSha256||'')&&expected[0].partSha256===item.partSha256;
    };
    const instructionKey=p=>p?.partName==='word/document.xml'&&p.elementName==='instrText'
      &&p.namespaceUri==='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
      &&Number.isSafeInteger(p.openStart)&&Number.isSafeInteger(p.closeEnd)&&p.openStart>=0&&p.closeEnd>p.openStart
      ?`${p.openStart}:${p.closeEnd}`:null;
    const fields=new Set();
    for(const paragraph of observed)for(const proof of paragraph.inertHyperlinkInstructions||[]) {
      if(!proof.href?.startsWith('#'))continue;
      const k=instructionKey(proof);
      if(!k||fields.has(k)||!paragraph.formattedRuns?.some(r=>r.inlineState?.link===proof.href))return reject('local-field-proof');
      key(proof.href.slice(1));
      const inventoryProofs=(reviewIr.userBookmarkInventory?.links||[]).filter(link=>link.name===proof.href.slice(1))
        .flatMap(link=>link.sourceXmlProvenance?.instructions||[]);
      if(inventoryProofs.filter(p=>instructionKey(p)===k).length!==1)return reject('local-field-inventory');
      fields.add(k);
    }
    if((reviewIr.structureChanges||[]).some(item=>item.writerAuthorityImpact!=='inventory-only'))return reject('unsupported-composite');
    for(const item of reviewIr.opaqueUnsupported||[]) {
      if(item.writerAuthorityImpact==='inventory-only'||admitTechnical(item))continue;
      const k=instructionKey(item.sourceXmlProvenance);
      if(item.kind!=='unsupported-element'||item.elementName!=='instrText'
        ||item.typedDiagnostic!=='RTK_STRUCTURAL_OR_FORMAT_ELEMENT_MANUAL'||!k||!fields.has(k))return reject('unsupported-composite');
      fields.delete(k);
    }
    if(fields.size)return reject('local-field-inventory-mismatch');
    const seen=new Set();
    for(const block of allBlocks) {
      const p=observed[block.documentParagraphIndex];
      const names=(block.wordSignals||[]).filter(item=>item.kind==='bookmarkName').map(item=>item.value?.name);
      if(!p||names.length!==1||!/^YRTK_[a-f0-9]{32}$/u.test(names[0])||seen.has(names[0])||(p.bookmarkNames||[]).filter(name=>name===names[0]).length!==1)return reject('transport-owner');
      seen.add(names[0]);
      if(observed.filter(item=>(item.bookmarkNames||[]).includes(names[0])).length!==1)return reject('transport-owner-duplicate');
    }
    const basePs=core.paragraphs(baselineDoc);
    if(basePs.length!==scene.blocks.length)return reject('scene-topology');
    const baseFormats=source.buildFormatIrParagraphs({sceneId,doc:baselineDoc,text:basePs.map(core.textOf).join('\n')});
    const offset=scene.blocks[0].documentParagraphIndex;
    if(scene.blocks.some((b,i)=>b.documentParagraphIndex!==offset+i))return reject('scene-order');
    if(returnedDoc===undefined){
      returnedDoc=stripRoot(baselineDoc);
      core.paragraphs(returnedDoc).forEach((p,index)=>{
        p.content=[];
        for(const run of observed[offset+index].formattedRuns||[]){
          const marks=[];const inline=run.inlineState||{};
          for(const name of ['bold','italic','underline','strike'])if(inline[name]===true)marks.push({type:name});
          const attrs=Object.fromEntries(['color','fontFamily','fontSize'].filter(name=>inline[name]!=null).map(name=>[name,inline[name]]));
          if(Object.keys(attrs).length)marks.push({type:'textStyle',attrs});
          if(inline.highlight)marks.push({type:'highlight',attrs:{color:inline.highlight}});
          if(inline.link)marks.push({type:'link',attrs:inline.link.startsWith('#')?{href:inline.link,wordBookmarkName:inline.link.slice(1)}:{href:inline.link}});
          run.text.split('\n').forEach((text,i)=>{if(i)p.content.push({type:'hardBreak'});if(text)p.content.push({type:'text',text,...(marks.length?{marks}: {})});});
        }
      });
    }
    const nextPs=core.paragraphs(returnedDoc);
    if(nextPs.length!==basePs.length)return reject('scene-topology');
    let defaultFontSize=null;
    if(exportTypography!==undefined){
      if(exportTypography?.schemaVersion!=='yalken.review-docx.typography-defaults.v1'||exportTypography.fontSize!=='12pt'||Object.keys(exportTypography).sort().join(',')!=='fontSize,schemaVersion')return reject('typography-binding');
      defaultFontSize='12pt';
    }
    const inventory=reviewIr.userBookmarkInventory;
    if(!inventory||inventory.schemaVersion!=='yalken.word-user-bookmark-inventory.v1')return reject('literal-inventory-missing');
    if(inventory.unresolvedEndpoints?.length)return reject('unresolved-bookmark-endpoints');
    const localInventory={schemaVersion:inventory.schemaVersion,bookmarks:[],links:[]};
    for(const item of inventory.bookmarks||[]) {
      const start=item.start.paragraphIndex-offset,end=item.end.paragraphIndex-offset;
      if(start>=0&&start<basePs.length||end>=0&&end<basePs.length){
        if(start<0||end<0||start>=basePs.length||end>=basePs.length)return reject('cross-scene-target');
        localInventory.bookmarks.push({...item,start:{...item.start,paragraphIndex:start},end:{...item.end,paragraphIndex:end}});
      }
    }
    for(const item of inventory.links||[])if(item.paragraphIndex>=offset&&item.paragraphIndex<offset+basePs.length)localInventory.links.push({...item,paragraphIndex:item.paragraphIndex-offset});
    // Generic imported IDs cannot identify authenticated return targets.
    const cleanReturned=stripRoot(returnedDoc);
    for(const item of linksOf(cleanReturned))if(item.mark.attrs?.href?.startsWith('#'))delete item.mark.attrs.wordBookmarkId;
    const imported=core.importInventory(cleanReturned,localInventory,`return:${sceneId}:${hashCanonicalValue(baselineDoc)}`);
    const returnedRegistry=core.readRegistry(imported), resultRegistry=clone(registry||{schemaVersion:core.SCHEMA,revision:0,bookmarks:[]}), effects=[];
    const retained=new Set();
    for(const record of returnedRegistry.bookmarks.filter(item=>item.state==='active')) {
      const old=resultRegistry.bookmarks.find(item=>key(item.name)===key(record.name));
      if(old){
        if(old.state!=='active')return reject('target-relocation-or-name-reuse');
        // Preserve private identity provisionally; Core independently proves every
        // endpoint against the validated label edit before this analysis succeeds.
        old.start=clone(record.start);old.end=clone(record.end);
        retained.add(old.id);
        if(old.name!==record.name){effects.push({kind:'rename',id:old.id,before:old.name,after:record.name});old.name=record.name;}
      }else{
        // Equal endpoints cannot distinguish rename from delete + create.
        // Preserve lineage only when its independent identity is available.
        const missing=(registry?.bookmarks||[]).filter(item=>item.state==='active'&&!returnedRegistry.bookmarks.some(next=>next.state==='active'&&key(next.name)===key(item.name)));
        if(missing.length)return reject('unknown-bookmark-lineage');
        resultRegistry.bookmarks.push(clone(record));retained.add(record.id);effects.push({kind:'create',id:record.id});
      }
    }
    for(const old of resultRegistry.bookmarks)if(old.state==='active'&&!retained.has(old.id)){effects.push({kind:'delete',id:old.id});old.state='deleted';delete old.start;delete old.end;}
    for(const record of returnedRegistry.bookmarks.filter(item=>item.state==='deleted'))if(!resultRegistry.bookmarks.some(item=>key(item.name)===key(record.name)))return reject('unknown-broken-target');
    const doc=clone(baselineDoc), resultPs=core.paragraphs(doc), ordinaryTextChanges=[];
    for(let i=0;i<basePs.length;i++) {
      const block={...scene.blocks[i],text:baseFormats[i].text},p=observed[offset+i];
      if(!same(block.formatIr,baseFormats[i].formatIr)||block.canonicalTextSha256!==`sha256:${sha256Hex(block.text)}`)return reject('private-format-binding');
      if(p.trackedRevision||p.table||block.formatIr.table||block.formatIr.media?.length||p.paragraphFormattingInvalid||p.wordLanguageInvalid||p.unsupportedParagraphNames?.some(name=>!(ordinaryTextMode && name==='rPr' && p.wordParagraphMarkLanguageOnly)))return reject('rich-paragraph-unsupported');
      const baseP=block.formatIr.paragraph;
      if(!['paragraph','heading'].includes(baseP.nodeType)||Object.keys(baseP).some(k=>!['nodeType','headingLevel','textAlign',...(ordinaryTextMode?['wordParagraphMarkLanguage']:[])].includes(k))||(baseP.textAlign||'left')!==(p.paragraphState?.textAlign||'left')||(p.paragraphStructure?.nodeType||'paragraph')!==baseP.nodeType||(baseP.headingLevel??null)!==(p.paragraphStructure?.headingLevel??null))return reject('paragraph-semantic-change');
      if(core.textOf(nextPs[i])!==p.paragraphText)return reject('returned-text-binding');
      const before=runsForBase(block,defaultFontSize,ordinaryTextMode),after=runsForReturn(p,defaultFontSize,ordinaryTextMode);
      const languageChange={schemaVersion:1,paragraphMark:p.wordParagraphMarkLanguage||null,
        runs:after.map(run=>({from:run.from,to:run.to,language:run.wordLanguage||null}))};
      const languages = runs => {
        const merged=[];
        for(const run of runs){const last=merged.at(-1);if(last&&same(last.language,run.language)&&last.to===run.from)last.to=run.to;else merged.push({...run});}
        return merged;
      };
      const languageChanged=!same(baseP.wordParagraphMarkLanguage||null,languageChange.paragraphMark)
        || !same(languages(before.map(run=>({from:run.from,to:run.to,language:run.inline?.wordLanguage||null}))),languages(languageChange.runs));
      const hasLanguage=languageChange.paragraphMark!==null || languageChange.runs.some(run=>run.language!==null)
        || baseP.wordParagraphMarkLanguage!=null || before.some(run=>run.inline?.wordLanguage!=null);
      if(!ordinaryTextMode && hasLanguage) return reject('language-composite-unsupported');
      let from=0,to=block.text.length,afterTo=p.paragraphText.length;
      if(block.text!==p.paragraphText || (ordinaryTextMode && hasLanguage && languageChanged)){
        const groups=[];
        for(const run of before){const last=groups.at(-1);if(last&&last.link===run.link&&same(last.style,run.style)&&last.to===run.from){last.to=run.to;}else groups.push({...run});}
        const possible=groups.filter(run=>run.link&&block.text.slice(0,run.from)===p.paragraphText.slice(0,run.from)&&block.text.slice(run.to)===p.paragraphText.slice(p.paragraphText.length-(block.text.length-run.to)));
        if(possible.length!==1){
          if(ordinaryTextMode!==true)return reject('label-footprint-ambiguous');
          // Ordinary text has no bookmark mutation authority. Keep original
          // rich nodes/marks and prove a single uniform text leaf footprint;
          // linked labels and opaque inline objects retain their own lanes.
          if(!block.text||!p.paragraphText||p.paragraphText.includes('\n')
            ||before.some(run=>run.link)||after.some(run=>run.link)
            ||resultPs[i].content.some(node=>node.type!=='text')
            ||!before.length||!after.length
            ||before.some(run=>!same(run.style,before[0].style))
            ||after.some(run=>!same(run.style,before[0].style)))return reject('ordinary-text-rich-footprint');
          replaceText(resultPs[i],0,block.text.length,p.paragraphText);
          if(hasLanguage){const changed=wordLanguage.applyParagraphLanguage(resultPs[i],languageChange);Object.keys(resultPs[i]).forEach(key=>delete resultPs[i][key]);Object.assign(resultPs[i],changed);}
          ordinaryTextChanges.push({sceneId,blockId:block.blockId,documentParagraphIndex:block.documentParagraphIndex,
            sceneParagraphIndex:i,expectedText:block.text,replacementText:p.paragraphText,blockTextSha256:block.canonicalTextSha256,...(hasLanguage?{wordLanguageChange:languageChange}:{})});
          continue;
        }
        if(hasLanguage && languageChanged)return reject('label-language-composite-unsupported');
        const owned=possible[0];from=owned.from;to=owned.to;afterTo=p.paragraphText.length-(block.text.length-to);
        if(afterTo<=from||!uniformAt(after,from,afterTo,owned.style))return reject('label-style-change');
        compareStyles(before,after,0,0,from);compareStyles(before,after,afterTo-to,to,block.text.length);
        replaceText(resultPs[i],from,to,p.paragraphText.slice(from,afterTo));
        effects.push({kind:'linkLabel',paragraphIndex:i,from,to,text:p.paragraphText.slice(from,afterTo)});
      }else compareStyles(before,after,0,0,block.text.length);
      replaceLinks(resultPs[i],after,resultRegistry);
      const merged=[];
      for(const node of resultPs[i].content||[]){const last=merged.at(-1);if(node.type==='text'&&last?.type==='text'&&same(node.marks||[],last.marks||[])){last.text+=node.text;}else merged.push(node);}
      resultPs[i].content=merged;
      if(same(semanticParagraph(resultPs[i]),semanticParagraph(basePs[i])))resultPs[i].content=clone(basePs[i].content||[]);
      else if(!effects.some(e=>e.kind==='linkLabel'&&e.paragraphIndex===i))effects.push({kind:'linkTarget',paragraphIndex:i});
    }
    if(ordinaryTextChanges.length){
      // No rename/create/delete/retarget composite can enter the ordinary
      // writer. Raw registry equality is required before the Core mapper;
      // the independently parsed Word endpoints must match its result.
      if(effects.length)return reject('ordinary-text-bookmark-composite');
      const mapped=core.planSave({beforeDoc:baselineDoc,workingDoc:doc});
      const literal=resultRegistry.bookmarks.filter(record=>record.state==='active').map(record=>({id:record.id,name:record.name,state:record.state,start:record.start,end:record.end}));
      const expected=(mapped.registry?.bookmarks||[]).filter(record=>record.state==='active').map(record=>({id:record.id,name:record.name,state:record.state,start:record.start,end:record.end}));
      if(literal.length!==expected.length||literal.some((record,index)=>{
        const target=expected[index];
        return record.id!==target.id||record.name!==target.name||record.state!==target.state
          ||['start','end'].some(edge=>core.endpointOffset(mapped.doc,record[edge])!==core.endpointOffset(mapped.doc,target[edge]));
      }))return reject('ordinary-text-bookmark-endpoint-mismatch');
      return {ok:true,code:'RTK_USER_BOOKMARK_ORDINARY_TEXT_ANALYZED',analysisOnly:true,canWriteManuscript:false,
        doc:mapped.doc,registry:mapped.registry,effects:[],ordinaryTextChanges,changed:true};
    }
    if(!registry&&!resultRegistry.bookmarks.length&&!effects.length)return {ok:true,code:'RTK_USER_BOOKMARK_RETURN_ANALYZED',analysisOnly:true,canWriteManuscript:false,doc:clone(baselineDoc),registry:null,effects:[],changed:false};
    resultRegistry.revision+=(effects.length?1:0);doc.attrs={...(doc.attrs||{}),[core.KEY]:resultRegistry};
    core.validateRegistry(resultRegistry,doc);core.readRegistry(doc);
    core.planReturn({beforeDoc:baselineDoc,candidateDoc:doc});
    return {ok:true,code:'RTK_USER_BOOKMARK_RETURN_ANALYZED',analysisOnly:true,canWriteManuscript:false,doc,registry:resultRegistry,effects,changed:!same(doc,baselineDoc)};
  }catch(error){return reject(error.code||error.message);}
}

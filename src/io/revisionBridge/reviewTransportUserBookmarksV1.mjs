import { bindDocxReviewTableTopology } from './index.mjs';
import paragraphLayout from '../../core/word-paragraph-layout-v1.cjs';
import paragraphSpacing from '../../core/word-paragraph-spacing-v1.cjs';
import wordSections from '../../core/word-sections-v1.cjs';
import listNumbering from '../../core/word-list-numbering-v1.cjs';
import wordBreaks from '../../core/word-typed-breaks-v1.cjs';
import wordLanguage from '../../core/word-language-v1.cjs';
import core from '../../core/word-user-bookmarks-v1.cjs';
import envelope from '../../core/document-content-envelope-v1.cjs';
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
// Keep unchanged source runs exactly as the authenticated text writer does.
// Whole-paragraph replacement would copy the first leaf's schema defaults over
// later leaves, producing a different private candidate after native editing.
function replaceOrdinaryText(p,before,after) {
  const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
  const boundaries=text=>new Set([0,text.length,...Array.from(segmenter.segment(text),part=>part.index)]);
  const oldBounds=boundaries(before),newBounds=boundaries(after);
  let prefix=0,suffix=0;
  while(prefix<Math.min(before.length,after.length)&&before[prefix]===after[prefix])prefix++;
  while(prefix>0&&(!oldBounds.has(prefix)||!newBounds.has(prefix)))prefix--;
  while(suffix<Math.min(before.length-prefix,after.length-prefix)
    &&before[before.length-suffix-1]===after[after.length-suffix-1])suffix++;
  while(suffix>0&&(!oldBounds.has(before.length-suffix)||!newBounds.has(after.length-suffix)))suffix--;
  if(prefix+suffix===before.length&&before!==after){
    // Anchor a pure insertion to adjacent source text. A preceding hardBreak
    // is unchanged structure, so retain the right grapheme instead of copying
    // that break into the replacement's text footprint.
    const rightText=prefix>0&&before[prefix-1]==='\n'&&suffix>0&&before[prefix]!=='\n';
    if(prefix>0&&!rightText){prefix--;while(prefix>0&&!oldBounds.has(prefix))prefix--;}
    else if(suffix>0){suffix--;while(suffix>0&&!oldBounds.has(before.length-suffix))suffix--;}
  }
  if(before!==after)replaceText(p,prefix,before.length-suffix,after.slice(prefix,after.length-suffix));
  p.content=semanticParagraph(p).content;
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

// Compare the complete effective definition, not just the current label. A
// single used level may carry the legacy exporter's unused uniform padding.
// No custom template, shared instance lineage, explicit override or distinct
// ancestor behavior is equivalent to the old per-level list representation.
export function legacyNumberingProofEquivalent(list, expected, peers = []) {
  try {
    const pattern = listNumbering.validateNumbering(list.wordNumbering);
    const type = expected.type || '1';
    if (pattern.level !== list.level || pattern.startOverrides?.length
      || pattern.levels.some((entry,index) => entry.format !== type || entry.start !== expected.start
        || entry.text !== `%${index+1}.` || entry.restartAfterLevel !== (index ? index-1 : null))) return false;
    const related = peers.filter(peer => peer?.numberingLineageId === list.numberingLineageId);
    if (!related.length || related.some(peer => peer.numId !== list.numId || peer.level !== list.level
      || peer.numberingStartOverrides?.length
      || !same(peer.numberingLevels, pattern.levels))) return false;
    // CSS legacy alpha and native Word agree only through Z/z. Main documents
    // keep typed alpha; this bounded equivalence is for existing legacy data.
    if (['A','a'].includes(type) && related.some(peer => peer.ordinal > 26)) return false;
    return true;
  } catch { return false; }
}

export function createLegacyNumberingProofComparator(lists) {
  const lineages = new Map(), cache = new Map();
  for (const list of lists) if (list?.numberingLineageId) {
    if (!lineages.has(list.numberingLineageId)) lineages.set(list.numberingLineageId, []);
    lineages.get(list.numberingLineageId).push(list);
  }
  return (list, expected) => {
    const key = hashCanonicalValue([list.numId,list.wordNumbering,expected.type || '1',expected.start]);
    if (!cache.has(key)) cache.set(key, legacyNumberingProofEquivalent(list,expected,lineages.get(list.numberingLineageId) || []));
    return cache.get(key);
  };
}

// A continuation is private canonical ownership, never an inference from an
// unnumbered Word paragraph. Nested children may intervene, but neither a scene
// boundary nor a different item at this level may supply its owner.
function continuationOwnerIsBound(rows, index) {
  const {scene,block} = rows[index], expected = block.formatIr?.paragraph?.list;
  if (expected?.continuation !== true) return false;
  const withoutFlag = value => { const result={...value}; delete result.continuation; return result; };
  for (let i=index-1;i>=0;i--) {
    if (rows[i].scene.sceneId !== scene.sceneId) return false;
    const previous=rows[i].block.formatIr?.paragraph?.list;
    if (!previous) return false;
    if (previous.level > expected.level) continue;
    if (previous.level !== expected.level || !same(withoutFlag(previous),withoutFlag(expected))) return false;
    if (previous.continuation !== true) return previous.continuation === undefined;
  }
  return false;
}

export function cleanFormattingConsumptionDigest(scene,reviewIr) {
  return `sha256:${hashCanonicalValue({paragraphs:scene.blocks.map(block=>reviewIr.formattingParagraphs[block.documentParagraphIndex]),
    numbering:scene.blocks.map(block=>reviewIr.listNumbering?.paragraphs?.[block.documentParagraphIndex] ?? null),
    documentProperties:reviewIr.documentProperties ?? null})}`;
}

export function documentPropertyReturnOperation(scene,documentProperties) {
  if(!documentProperties || !scene.documentFormatIr)return null;
  const baseline=scene.documentFormatIr;
  if(!baseline || typeof baseline!=='object' || Array.isArray(baseline)
    || ![Object.prototype,null].includes(Object.getPrototypeOf(baseline)) || !Number.isSafeInteger(baseline.wordDefaultTabStop)
    || typeof baseline.explicit!=='boolean' || !/^sha256:[a-f0-9]{64}$/u.test(scene.rawSha256)
    || !/^sha256:[a-f0-9]{64}$/u.test(scene.sceneRevision))throw Error('RTK_FORMATTING_DOCUMENT_SOURCE_INVALID');
  const value=paragraphLayout.normalizeWordDefaultTabStop(documentProperties.effective);
  paragraphLayout.normalizeWordDefaultTabStop(baseline.wordDefaultTabStop);
  if(value===baseline.wordDefaultTabStop)return null;
  const operation={kind:'document-properties',sceneId:scene.sceneId,sourceAuthority:'authenticated-full-manuscript-export-map-document-properties-v1',
    sourceSceneRevision:scene.sceneRevision,sourceRawSha256:scene.rawSha256,document:{wordDefaultTabStop:{action:'set',value}}};
  operation.operationId='rtk-document-format-'+hashCanonicalValue(operation);return operation;
}

// Caller owns authentication, private baseline acquisition and writer CAS.
// This module checks semantic bindings and produces no publication authority.
export function analyzeUserBookmarksReturn({baselineDoc,returnedDoc,baselineRegistry,exportMap,sceneId,reviewIr={},exportTypography,protectedSections,sectionProof,ordinaryTextMode=false}={}) {
  try {
    // Recompute against the locally authenticated map; a returned proof is not authority.
    const tableBinding=bindDocxReviewTableTopology(reviewIr,exportMap);
    if(!tableBinding.ok)return reject(tableBinding.code);
    reviewIr=tableBinding.reviewIr;
    const registry=core.readRegistry(baselineDoc);
    const sectionVerified = Boolean(protectedSections && sectionProof?.status === 'VERIFIED_PROTECTED_DOCUMENT_SECTIONS'
      && sectionProof.protectedDigest === protectedSections.protectedDigest
      && same(sectionProof.protectedSections, protectedSections.protectedSections));
    const additions = sectionProof?.inactiveGridAdditions;
    if (additions !== undefined && !sectionVerified) return reject('inactive-grid-proof');
    const inactiveGridPlan = additions !== undefined ? wordSections.planInactiveGridAdditions(baselineDoc,
      {sceneId,exportMap,protectedSections,additions}) : null;
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
    const numberingAnalysis=ordinaryTextMode ? analyzeListNumberingReturn({exportMap,reviewIr,allowTextChanges:true,
      resolveBlock:p=>{const row=exportMap.scenes.flatMap(owner=>owner.blocks.map(block=>({owner,block})))[p.paragraphIndex];
        return row?{ok:true,authority:{sceneId:row.owner.sceneId,blockId:row.block.blockId}}:{ok:false};}}) : {ok:true,operations:[]};
    if(!numberingAnalysis.ok)return reject(numberingAnalysis.detail);
    const numberingOperations=numberingAnalysis.operations.filter(operation=>operation.sceneId===sceneId);
    let numberingDoc=baselineDoc;
    for(const operation of numberingOperations)numberingDoc=listNumbering.applyDefinitionChange(numberingDoc,operation.numbering);
    const numberingFormats=source.buildFormatIrParagraphs({sceneId,doc:numberingDoc,text:envelope.deriveVisibleTextFromDocument(numberingDoc)});
    const hasLists = allBlocks.some(block => block.formatIr?.paragraph?.list)
      || observed.some(p => p.unsupportedParagraphNames?.includes('numPr'));
    if (hasLists) {
      const proof = reviewIr.listNumbering;
      if (!ordinaryTextMode || proof?.schemaVersion !== 'yalken.word-list-numbering-proof.v1'
        || !Array.isArray(proof.paragraphs) || proof.paragraphs.length !== allBlocks.length) return reject('list-numbering-proof-required');
      const forward = new Map(), reverse = new Map(), lineageForward = new Map(), lineageReverse = new Map();
      const legacyEquivalent = createLegacyNumberingProofComparator(proof.paragraphs.map(row=>row.list));
      const owners = exportMap.scenes.flatMap(scene => scene.blocks.map(() => scene.sceneId));
      const ownerRows = exportMap.scenes.flatMap(scene => scene.blocks.map(block => ({scene,block})));
      for (let j = 0; j < allBlocks.length; j++) {
        const originalExpected = allBlocks[j].formatIr?.paragraph?.list, actual = proof.paragraphs[j];
        const localIndex=scene.blocks.findIndex(block=>block.documentParagraphIndex===j);
        let expected=localIndex>=0?numberingFormats[localIndex]?.formatIr?.paragraph?.list:originalExpected;
        // Other scenes are counter-checked against their own private baseline by
        // their analyzer invocation; here retain global membership and bijections.
        const foreignChange=localIndex<0 && numberingAnalysis.operations.find(operation=>{
          if(operation.sceneId!==owners[j] || !originalExpected?.wordNumbering)return false;
          const owner=exportMap.scenes.find(item=>item.sceneId===owners[j]);
          const representative=owner.blocks.map(block=>block.formatIr?.paragraph?.list?.wordNumbering)
            .find(pattern=>pattern?.instanceId===operation.numbering.instanceId);
          return representative && (representative.lineageId || representative.instanceId)
            ===(originalExpected.wordNumbering.lineageId || originalExpected.wordNumbering.instanceId);
        });
        if(foreignChange){const change=foreignChange.numbering,old=originalExpected.wordNumbering;
          expected={...originalExpected,type:change.levels[old.level].format,wordNumbering:{...old,levels:change.levels,
            startOverrides:change.instanceOverrides?.find(item=>item.instanceId===old.instanceId)?.startOverrides || old.startOverrides || []}};}

        if (actual?.textSha256 !== sha256Hex(observed[j].paragraphText)) return reject('list-text-binding');
        const list = actual.list;
        if (!expected) { if (list !== null) return reject('list-added'); continue; }
        if (Object.hasOwn(expected,'continuation')) {
          if (!continuationOwnerIsBound(ownerRows,j) || list !== null) return reject('list-continuation-owner');
          continue;
        }
        if (!list || list.kind !== (expected.kind === 'ordered' ? 'orderedList' : 'bulletList')
          || list.level !== expected.level || (list.type || '1') !== (expected.type || '1')
          || (expected.kind === 'ordered' && !foreignChange && list.ordinal !== expected.start + expected.itemOrdinal)
          || typeof list.numId !== 'string' || !/^[1-9]\d{0,9}$/u.test(list.numId)) return reject('list-semantics-change');
        const identity = `${owners[j]}:${expected.numId}`;
        if ((forward.has(identity) && forward.get(identity) !== list.numId)
          || (reverse.has(list.numId) && reverse.get(list.numId) !== identity)) return reject('list-identity-change');
        forward.set(identity, list.numId); reverse.set(list.numId, identity);
        if (expected.wordNumbering) {
          const canonical = listNumbering.validateNumbering(expected.wordNumbering);
          if (!same(canonical.levels, list.numberingLevels)
            || !same(canonical.startOverrides || [], list.numberingStartOverrides || [])) return reject('list-definition-change');
          const lineage = `${owners[j]}:${canonical.lineageId || canonical.instanceId}`, actualLineage = list.numberingLineageId;
          if (typeof actualLineage !== 'string' || !actualLineage
            || lineageForward.has(lineage) && lineageForward.get(lineage) !== actualLineage
            || lineageReverse.has(actualLineage) && lineageReverse.get(actualLineage) !== lineage) return reject('list-lineage-change');
          lineageForward.set(lineage, actualLineage); lineageReverse.set(actualLineage, lineage);
        } else if (list.wordNumbering && !legacyEquivalent(list,expected)) return reject('list-definition-added');
      }
    }
    const basePs=core.paragraphs(baselineDoc);
    if(basePs.length!==scene.blocks.length)return reject('scene-topology');
    const baseFormats=source.buildFormatIrParagraphs({sceneId,doc:baselineDoc,text:envelope.deriveVisibleTextFromDocument(baselineDoc)});
    const offset=scene.blocks[0].documentParagraphIndex;
    if(scene.blocks.some((b,i)=>b.documentParagraphIndex!==offset+i))return reject('scene-order');
    if(returnedDoc===undefined){
      returnedDoc=stripRoot(baselineDoc);
      core.paragraphs(returnedDoc).forEach((p,index)=>{
        p.content=[];
        const typed = wordBreaks.validateOffsets(observed[offset+index].paragraphText, observed[offset+index].typedBreaks);
        const types = new Map(typed.map(item => [item.offset, item.type]));
        let position = 0;
        for(const run of observed[offset+index].formattedRuns||[]){
          const marks=[];const inline=run.inlineState||{};
          for(const name of ['bold','italic','underline','strike'])if(inline[name]===true)marks.push({type:name});
          const attrs=Object.fromEntries(['color','fontFamily','fontSize'].filter(name=>inline[name]!=null).map(name=>[name,inline[name]]));
          if(Object.keys(attrs).length)marks.push({type:'textStyle',attrs});
          if(inline.highlight)marks.push({type:'highlight',attrs:{color:inline.highlight}});
          if(inline.link)marks.push({type:'link',attrs:inline.link.startsWith('#')?{href:inline.link,wordBookmarkName:inline.link.slice(1)}:{href:inline.link}});
          run.text.split('\n').forEach((text,i)=>{
            if(i){const type=types.get(position);p.content.push({type:'hardBreak',...(type?{attrs:{wordBreakType:type}}:{})});position++;}
            if(text)p.content.push({type:'text',text,...(marks.length?{marks}: {})});position+=text.length;
          });
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
    const doc=clone(baselineDoc), resultPs=core.paragraphs(doc), ordinaryTextChanges=[], ordinaryFormattingOperations=[...numberingOperations];
    const documentOperation=ordinaryTextMode?documentPropertyReturnOperation(scene,reviewIr.documentProperties):null;
    if(documentOperation)ordinaryFormattingOperations.push(documentOperation);
    for(let i=0;i<basePs.length;i++) {
      const block={...scene.blocks[i],text:baseFormats[i].text},p=observed[offset+i];
      if(!same(block.formatIr,baseFormats[i].formatIr)||block.canonicalTextSha256!==`sha256:${sha256Hex(block.text)}`)return reject('private-format-binding');
      if(p.typedBreakInvalid)return reject('typed-break-invalid');
      const expectedBreaks=wordBreaks.paragraphBreaks(basePs[i]);
      const returnedBreaks=wordBreaks.textBreaks(p.paragraphText,p.typedBreaks);
      if(!same(expectedBreaks.map(b=>b.type),returnedBreaks.map(b=>b.type)))return reject('typed-break-semantic-change');
      if(p.trackedRevision||((p.table||block.formatIr.table) && (!ordinaryTextMode || tableBinding.applicable!==true))||block.formatIr.media?.length||p.paragraphFormattingInvalid||p.wordLanguageInvalid||p.unsupportedParagraphNames?.some(name=>!(ordinaryTextMode && ((name==='rPr' && p.wordParagraphMarkLanguageOnly) || (name==='numPr' && hasLists) || (name==='sectPr' && sectionVerified)))))return reject('rich-paragraph-unsupported');
      const baseP=block.formatIr.paragraph;
      if(!['paragraph','heading'].includes(baseP.nodeType)||Object.keys(baseP).some(k=>!['nodeType','headingLevel','textAlign','wordParagraphSpacing','wordParagraphMarkLanguage','wordParagraphMarkTypography','wordParagraphIndent','wordParagraphTabs',...(ordinaryTextMode?[...(hasLists?['list']:[])]:[])].includes(k))||(baseP.textAlign||'left')!==(p.paragraphState?.textAlign||'left')||(p.paragraphStructure?.nodeType||'paragraph')!==baseP.nodeType||(baseP.headingLevel??null)!==(p.paragraphStructure?.headingLevel??null))return reject('paragraph-semantic-change');
      if(['wordParagraphIndent','wordParagraphTabs'].some(k=>!same(baseP[k]??null,p.paragraphState?.[k]??null)))return reject('paragraph-layout-change');
      const markChanged=!same(baseP.wordParagraphMarkTypography??null,p.paragraphState?.wordParagraphMarkTypography??null);
      if(markChanged&&!ordinaryTextMode)return reject('paragraph-mark-typography-change');
      const spacingChanged=!same(baseP.wordParagraphSpacing||null,p.paragraphState?.wordParagraphSpacing||null);
      if(spacingChanged && !ordinaryTextMode)return reject('paragraph-spacing-change');
      const returnedSpacing=p.paragraphState?.wordParagraphSpacing == null ? null
        : paragraphSpacing.normalizeWordParagraphSpacing(p.paragraphState.wordParagraphSpacing);
      const formattingOperation=(from,to,inline,paragraph)=>({
        operationId:`clean-format-${sceneId}-${i}-${ordinaryFormattingOperations.length}`,
        sceneId,blockId:block.blockId,paragraphOrdinal:i,from,to,selectedText:p.paragraphText.slice(from,to),inline,paragraph,
        sourceAuthority:'authenticated-full-manuscript-export-map-format-ir-v1',sourceSceneRevision:scene.sceneRevision,sourceRawSha256:scene.rawSha256,
      });
      if(markChanged)ordinaryFormattingOperations.push(formattingOperation(0,p.paragraphText.length,{}, {wordParagraphMarkTypography:p.paragraphState?.wordParagraphMarkTypography==null?{action:'remove'}:{action:'set',value:p.paragraphState.wordParagraphMarkTypography}}));
      if(spacingChanged)ordinaryFormattingOperations.push(formattingOperation(0,p.paragraphText.length,{},
        {wordParagraphSpacing:returnedSpacing===null?{action:'remove'}:{action:'set',value:returnedSpacing}}));
      if(!ordinaryTextMode&&!same(baseP.wordParagraphMarkLanguage||null,p.paragraphState?.wordParagraphMarkLanguage||null))return reject('paragraph-language-change');
      if(core.textOf(nextPs[i])!==p.paragraphText)return reject('returned-text-binding');
      const before=runsForBase(block,defaultFontSize,ordinaryTextMode),after=runsForReturn(p,defaultFontSize,ordinaryTextMode);
      // Effective family is resolved by the same-byte parser's owned style and
      // theme catalog. Retain it as a real format effect, never waive equality
      // and discard inherited Word formatting during a text return.
      const familyOf=run=>run.inlineState?.fontFamily || run.resolvedFontFamily;
      const isFontlessBreak=run=>typeof run.text==='string' && /^\n+$/u.test(run.text)
        && !familyOf(run) && Number.isSafeInteger(run.from) && run.from>=0
        && run.to===run.from+run.text.length && p.paragraphText.slice(run.from,run.to)===run.text
        && Array.from(run.text,(_,index)=>run.from+index).every(offset=>{
          const ordinal=returnedBreaks.findIndex(item=>item.offset===offset);
          if(ordinal<0)return false;
          const oldOffset=expectedBreaks[ordinal]?.offset;
          const oldRun=before.find(item=>item.from<=oldOffset && item.to>oldOffset);
          let cursor=0,oldBreak;
          for(const node of basePs[i].content||[]){
            if(cursor===oldOffset && node.type==='hardBreak'){oldBreak=node;break;}
            cursor+=node.type==='hardBreak'?1:node.type==='text'?node.text.length:0;
          }
          return oldRun && !oldRun.style.fontFamily && oldBreak
            && !(oldBreak.marks||[]).some(mark=>mark.type==='textStyle' && mark.attrs?.fontFamily);
        });
      const fontlessBreaks=new Set(after.filter(isFontlessBreak));
      const fontlessBreak=run=>fontlessBreaks.has(run);
      const completeFontProfile=ordinaryTextMode && after.length>0
        && after.every(run=>fontlessBreak(run) || typeof familyOf(run)==='string' && familyOf(run).length>0);
      if(ordinaryTextMode && !completeFontProfile && after.some(run=>run.resolvedFontFamily || run.inlineState?.fontFamily))
        return reject('ordinary-text-font-profile-incomplete');
      let fontChanged=false;
      if(completeFontProfile){
        for(const run of after){
          // A bare hardBreak has no font-bearing text. Keep its absence exact;
          // explicitly formatted breaks still follow the normal font path.
          if(fontlessBreak(run))continue;
          const family=familyOf(run);
          const unchanged=block.text===p.paragraphText && before.filter(old=>old.from<run.to&&old.to>run.from)
            .every(old=>old.style.fontFamily===family);
          if(!unchanged){fontChanged=true;ordinaryFormattingOperations.push(formattingOperation(run.from,run.to,{fontFamily:{action:'set',value:family}},{}));}
        }
        for(const run of [...before,...after])delete run.style.fontFamily;
      }

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
      // Bookmark-only returns preserve language through exact style signatures
      // (including offset-adjusted label comparisons) and the paragraph-mark
      // equality guard above. Presence alone is not a language mutation.
      if(ordinaryTextMode && block.text==='' && p.paragraphText==='' && languageChanged){
        if(before.length || after.length || (resultPs[i].content||[]).some(node=>node.type!=='text'||node.text!==''))
          return reject('ordinary-empty-paragraph-language-footprint');
        ordinaryFormattingOperations.push(formattingOperation(0,0,{},
          {wordParagraphMarkLanguage:languageChange.paragraphMark===null?{action:'remove'}:{action:'set',value:languageChange.paragraphMark}}));
        continue;
      }
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
          if(!block.text||!p.paragraphText
            ||before.some(run=>run.link)||after.some(run=>run.link)
            ||resultPs[i].content.some(node=>!['text','hardBreak'].includes(node.type))
            ||!before.length||!after.length
            ||before.some(run=>!same(run.style,before[0].style))
            ||after.some(run=>!same(run.style,before[0].style)))return reject('ordinary-text-rich-footprint');
          replaceOrdinaryText(resultPs[i],block.text,p.paragraphText);
          if(!same(wordBreaks.paragraphBreaks(resultPs[i]),returnedBreaks))return reject('typed-break-position-change');
          if(hasLanguage){const changed=wordLanguage.applyParagraphLanguage(resultPs[i],languageChange);Object.keys(resultPs[i]).forEach(key=>delete resultPs[i][key]);Object.assign(resultPs[i],changed);}
          ordinaryTextChanges.push({sceneId,blockId:block.blockId,documentParagraphIndex:block.documentParagraphIndex,
            sceneParagraphIndex:i,expectedText:block.text,replacementText:p.paragraphText,blockTextSha256:block.canonicalTextSha256,...(hasLanguage?{wordLanguageChange:languageChange}:{})});
          continue;
        }
        if(ordinaryTextMode && (hasLanguage && languageChanged || spacingChanged || fontChanged))return reject('label-language-composite-unsupported');
        const owned=possible[0];from=owned.from;to=owned.to;afterTo=p.paragraphText.length-(block.text.length-to);
        if(afterTo<=from||!uniformAt(after,from,afterTo,owned.style))return reject('label-style-change');
        compareStyles(before,after,0,0,from);compareStyles(before,after,afterTo-to,to,block.text.length);
        replaceText(resultPs[i],from,to,p.paragraphText.slice(from,afterTo));
        effects.push({kind:'linkLabel',paragraphIndex:i,from,to,text:p.paragraphText.slice(from,afterTo)});
      }else compareStyles(before,after,0,0,block.text.length);
      if(!same(wordBreaks.paragraphBreaks(resultPs[i]),returnedBreaks))return reject('typed-break-position-change');
      replaceLinks(resultPs[i],after,resultRegistry);
      const merged=[];
      for(const node of resultPs[i].content||[]){const last=merged.at(-1);if(node.type==='text'&&last?.type==='text'&&same(node.marks||[],last.marks||[])){last.text+=node.text;}else merged.push(node);}
      resultPs[i].content=merged;
      if(same(semanticParagraph(resultPs[i]),semanticParagraph(basePs[i]))){
        if(Object.hasOwn(basePs[i],'content'))resultPs[i].content=clone(basePs[i].content);
        else delete resultPs[i].content;
      }
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
      // Compare against the actual text/language replacement, not the old
      // offsets or Word run segmentation. Reapplying an unchanged family can
      // split otherwise preserved canonical leaves at arbitrary XML borders.
      const mappedParagraphs=core.paragraphs(mapped.doc);
      const effectiveFormattingOperations=ordinaryFormattingOperations.filter(operation=>{
        const action=operation.inline?.fontFamily;
        if(action?.action!=='set' || Object.keys(operation.inline).length!==1 || Object.keys(operation.paragraph).length)return true;
        const paragraph=mappedParagraphs[operation.paragraphOrdinal];
        if(!paragraph || core.textOf(paragraph).slice(operation.from,operation.to)!==operation.selectedText)return true;
        let cursor=0, covered=0;
        for(const node of paragraph.content || []){
          const length=node.type==='text'?node.text.length:node.type==='hardBreak'?1:0;
          const overlap=Math.max(0,Math.min(cursor+length,operation.to)-Math.max(cursor,operation.from));
          if(overlap){
            const styles=(node.marks || []).filter(mark=>mark.type==='textStyle');
            if(node.type!=='text' || styles.length!==1 || styles[0].attrs?.fontFamily!==action.value)return true;
            covered+=overlap;
          }
          cursor+=length;
        }
        return covered!==operation.to-operation.from;
      });
      return {ok:true,inactiveGridPlan,code:'RTK_USER_BOOKMARK_ORDINARY_TEXT_ANALYZED',analysisOnly:true,canWriteManuscript:false,
        doc:mapped.doc,registry:mapped.registry,effects:[],ordinaryTextChanges,ordinaryFormattingOperations:effectiveFormattingOperations,
        ordinaryFormattingConsumption:{sceneId,paragraphsDigest:cleanFormattingConsumptionDigest(scene,reviewIr)},changed:true};
    }
    if(ordinaryFormattingOperations.length && effects.length)return reject('paragraph-format-bookmark-composite');
    if(!registry&&!resultRegistry.bookmarks.length&&!effects.length)return {ok:true,inactiveGridPlan,code:'RTK_USER_BOOKMARK_RETURN_ANALYZED',analysisOnly:true,canWriteManuscript:false,doc:clone(baselineDoc),registry:null,effects:[],changed:false};
    resultRegistry.revision+=(effects.length?1:0);doc.attrs={...(doc.attrs||{}),[core.KEY]:resultRegistry};
    core.validateRegistry(resultRegistry,doc);core.readRegistry(doc);
    core.planReturn({beforeDoc:baselineDoc,candidateDoc:doc});
    return {ok:true,inactiveGridPlan,code:'RTK_USER_BOOKMARK_RETURN_ANALYZED',analysisOnly:true,canWriteManuscript:false,doc,registry:resultRegistry,effects,changed:!same(doc,baselineDoc)};
  }catch(error){return reject(error.code||error.message);}
}

// Read-only numbering proof comparison. Canonical group identity and revision
// come exclusively from the authenticated private export map, never OOXML IDs.
export function analyzeListNumberingReturn({ exportMap, reviewIr = {}, resolveBlock, allowTextChanges = false } = {}) {
  const fail = detail => ({ ok:false, code:'RTK_LIST_NUMBERING_RETURN_CONFLICT', detail, operations:[] });
  try {
    const scenes = exportMap?.scenes;
    if (!Array.isArray(scenes)) return fail('private-map');
    const rows = scenes.flatMap(scene => (scene.blocks || []).map(block => ({scene,block})));
    const hasPatterns = rows.some(({block}) => block.formatIr?.paragraph?.list?.wordNumbering);
    if (!hasPatterns) return {ok:true,hasPatterns:false,operations:[]};
    const proof = reviewIr.listNumbering, observed = reviewIr.formattingParagraphs;
    if (proof?.schemaVersion !== 'yalken.word-list-numbering-proof.v1' || !Array.isArray(proof.paragraphs)
      || !Array.isArray(observed) || proof.paragraphs.length !== rows.length || observed.length !== rows.length
      || typeof resolveBlock !== 'function') return fail('same-byte-proof-required');
    const groups = new Map(), forward = new Map(), reverse = new Map(), lineageForward = new Map(), lineageReverse = new Map(), changedTextScenes = new Set();
    const legacyEquivalent = createLegacyNumberingProofComparator(proof.paragraphs.map(row=>row.list));
    for (let i=0;i<rows.length;i++) {
      const {scene,block} = rows[i], p = observed[i], actual = proof.paragraphs[i];
      const authority = resolveBlock({...p,paragraphIndex:i});
      if (!authority?.ok || authority.authority.sceneId !== scene.sceneId || authority.authority.blockId !== block.blockId
        || block.documentParagraphIndex !== i || actual?.textSha256 !== sha256Hex(p.paragraphText)
        || (!allowTextChanges && block.canonicalTextSha256 !== `sha256:${sha256Hex(p.paragraphText)}`)
        || block.canonicalMarksSha256 !== `sha256:${hashCanonicalValue(block.formatIr)}`
        || p.trackedRevision) return fail('source-owner-text-or-revision');
      if(block.canonicalTextSha256 !== `sha256:${sha256Hex(p.paragraphText)}`)changedTextScenes.add(scene.sceneId);
      const expected = block.formatIr?.paragraph?.list, returned = actual.list;
      if (!expected) { if (returned !== null) return fail('list-added'); continue; }
      if (Object.hasOwn(expected,'continuation')) {
        if (!continuationOwnerIsBound(rows,i) || returned !== null) return fail('list-continuation-owner');
        continue;
      }
      if (!returned || typeof returned.numId !== 'string' || !/^[1-9]\d{0,9}$/u.test(returned.numId)
        || returned.level !== expected.level || returned.kind !== (expected.kind === 'ordered' ? 'orderedList':'bulletList')) return fail('list-membership-or-level');
      const identity = `${scene.sceneId}:${expected.numId}`;
      if (forward.has(identity) && forward.get(identity)!==returned.numId || reverse.has(returned.numId) && reverse.get(returned.numId)!==identity) return fail('list-instance-bijection');
      forward.set(identity,returned.numId); reverse.set(returned.numId,identity);
      if (!expected.wordNumbering) {
        if (returned.wordNumbering && !legacyEquivalent(returned,expected) || (returned.type || '1') !== (expected.type || '1')
          || expected.kind==='ordered' && returned.ordinal !== expected.start + expected.itemOrdinal) return fail('legacy-list-change');
        continue;
      }
      const canonical = listNumbering.validateNumbering(expected.wordNumbering);
      const levels = listNumbering.validateLevels(returned.numberingLevels);
      if (canonical.level !== returned.level || (returned.type || '1') !== levels[returned.level]?.format) return fail('effective-definition');
      const lineage = `${scene.sceneId}:${canonical.lineageId || canonical.instanceId}`;
      const returnedLineage = returned.numberingLineageId;
      if (typeof returnedLineage !== 'string' || !returnedLineage) return fail('lineage-or-start-override');
      const returnedPattern=listNumbering.validateNumbering({schemaVersion:1,instanceId:canonical.instanceId,
        level:canonical.level,levels,startOverrides:returned.numberingStartOverrides ?? []});
      const instanceOverride={instanceId:canonical.instanceId,expectedStartOverrides:canonical.startOverrides || [],
        startOverrides:returnedPattern.startOverrides};
      if (lineageForward.has(lineage) && lineageForward.get(lineage) !== returnedLineage
        || lineageReverse.has(returnedLineage) && lineageReverse.get(returnedLineage) !== lineage) return fail('list-lineage-bijection');
      lineageForward.set(lineage, returnedLineage); lineageReverse.set(returnedLineage, lineage);
      const groupKey = lineage;
      const prior = groups.get(groupKey);
      if (prior && (!same(prior.expectedLevels,canonical.levels) || !same(prior.levels,levels))) return fail('group-definition-consistency');
      if (!prior) groups.set(groupKey,{scene,instanceId:canonical.instanceId,expectedLevels:canonical.levels,levels,instances:new Map()});
      const group=groups.get(groupKey),previousInstance=group.instances.get(canonical.instanceId);
      if(previousInstance && !same(previousInstance,instanceOverride))return fail('instance-override-consistency');
      group.instances.set(canonical.instanceId,instanceOverride);
    }
    const operations = [];
    for (const group of groups.values()) {
      const instanceOverrides=[...group.instances.values()].filter(item=>!same(item.expectedStartOverrides,item.startOverrides))
        .sort((a,b)=>a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0);
      if (same(group.expectedLevels,group.levels) && !instanceOverrides.length) continue;
      if (!/^sha256:[a-f0-9]{64}$/u.test(group.scene.sceneRevision) || !/^sha256:[a-f0-9]{64}$/u.test(group.scene.rawSha256)) return fail('source-revision');
      const operation={kind:'list-numbering',sceneId:group.scene.sceneId,
        sourceAuthority:'authenticated-full-manuscript-export-map-list-numbering-v1',sourceSceneRevision:group.scene.sceneRevision,
        sourceRawSha256:group.scene.rawSha256,numbering:{instanceId:group.instanceId,expectedLevels:group.expectedLevels,levels:group.levels,
          ...(instanceOverrides.length?{instanceOverrides}:{})}};
      operation.operationId=`rtk-list-numbering-${hashCanonicalValue(operation)}`;operations.push(operation);
    }
    return {ok:true,hasPatterns:true,operations,changedTextSceneIds:[...changedTextScenes]};
  } catch { return fail('numbering-proof-invalid'); }
}

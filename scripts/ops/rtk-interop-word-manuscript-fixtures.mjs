import {buildWordVolumeFixture,WORD_VOLUME_TEXT_PROBES} from './rtk-interop-word-volume-fixtures.mjs';

export const MANUSCRIPT_VOLUMES=Object.freeze(['SINGLE_SCENE','MULTI_SCENE','FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']);
export const MANUSCRIPT_ROUTES=Object.freeze(['C1','C2','C3','C5']);
export const MANUSCRIPT_PROFILES=Object.freeze(['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME']);
export const UNICODE_PROBES=Object.freeze([
 '[normalization] NFC é Å ö; NFD e\u0301 A\u030a o\u0308; Hangul 한 한.',
 '[bidi] LTR abc \u2067שלום 123\u2069 xyz العربية.',
 '[ime] 日本語.',
]);
const text=(value,marks=[])=>({type:'text',text:value,...(marks.length?{marks}:{})});
const paragraph=(value,attrs)=>({type:'paragraph',...(attrs?{attrs}:{}),...(value?{content:[text(value)]}:{})});
export function manuscriptStyleBlocks(){
 return [
  ...Array.from({length:6},(_,i)=>({type:'heading',attrs:{level:i+1},content:[text(`[heading-${i+1}] Authored heading.`)]})),
  ...['left','center','right','justify'].map(align=>paragraph(`[align-${align}] Authored paragraph alignment.`,{textAlign:align})),
  {type:'paragraph',content:[text('[inline] '),...['bold','italic','underline','strike'].flatMap(type=>[text(type,[{type}]),text(' ')]),text('color',[{type:'textStyle',attrs:{color:'#123456'}}]),text(' '),text('highlight',[{type:'highlight',attrs:{color:'#ffff00'}}]),text(' '),text('font',[{type:'textStyle',attrs:{fontFamily:'Arial',fontSize:'14pt'}}])]},
  {type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[paragraph('[ordered-3] First numbered item.')]},{type:'listItem',content:[paragraph('[ordered-4] Second numbered item.'),{type:'bulletList',content:[{type:'listItem',content:[paragraph('[nested-bullet] Nested bullet item.')]}]}]}]},
  {type:'bulletList',content:[{type:'listItem',content:[paragraph('[bullet-1] First bullet item.')]},{type:'listItem',content:[paragraph('[bullet-2] Second bullet item.')]}]},
  {type:'blockquote',content:[paragraph('[quote] Authored quotation.')]},
  {type:'codeBlock',attrs:{language:''},content:[text('[code] const answer = 42;')]},
  // Authored terminal paragraph required by the existing StarterKit TrailingNode.
  paragraph(''),
 ];
}
export function manuscriptParagraphs(doc){
 const out=[];const visit=node=>{if(['paragraph','heading','codeBlock'].includes(node.type)){out.push((node.content||[]).map(n=>n.text||'').join(''));return;}for(const child of node.content||[])visit(child);};visit(doc);return out;
}
export function manuscriptFields(volume,route){
 if(!MANUSCRIPT_VOLUMES.includes(volume)||!MANUSCRIPT_ROUTES.includes(route))throw new Error('MANUSCRIPT_SCOPE');
 if(route==='C5'){
  if(volume==='LARGE_DOCUMENT')throw new Error('GOOGLE_NATIVE_VOLUME_UNQUALIFIED');
  return ['TEXT','ORDER','UNICODE_IME_LOCALE'];
 }
 return ['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES',...(route==='C1'||volume==='SINGLE_SCENE'?[]:['NOVEL_SCENE_STRUCTURE']),...(route==='C1'?[]:['TRACKED_REVIEW_SEMANTICS'])];
}
export const MANUSCRIPT_CELLS=Object.freeze(MANUSCRIPT_VOLUMES.flatMap(volume=>MANUSCRIPT_ROUTES.filter(route=>route!=='C5'||volume!=='LARGE_DOCUMENT').flatMap(route=>MANUSCRIPT_PROFILES.flatMap(profile=>manuscriptFields(volume,route).map(field=>`${field}__${volume}__${route}__${profile}`)))));
export function buildWordManuscriptFixture(volume,route){
 manuscriptFields(volume,route);
 const base=volume==='SINGLE_SCENE'?{minimumWords:0,scenes:[{paragraphs:[...WORD_VOLUME_TEXT_PROBES]}]}:buildWordVolumeFixture(volume);
 const scenes=base.scenes.map((s,i)=>{const content=s.paragraphs.map(p=>paragraph(p));if(i===0)content.push(...UNICODE_PROBES.map(p=>paragraph(p)),...manuscriptStyleBlocks());const doc={type:'doc',content};return {ordinal:i,name:'scene-'+String(i+1).padStart(2,'0'),chapter:volume==='SINGLE_SCENE'?null:Math.floor(i/(volume==='MULTI_SCENE'?1:7)),doc,paragraphs:manuscriptParagraphs(doc)};});
 const forRound=round=>scenes.map(s=>s.paragraphs.map(p=>round?p.replace('sentinel alpha','sentinel round'+round):p));
 return {schemaVersion:'WORD_MANUSCRIPT_FIXTURE_V1',volume,route,minimumWords:base.minimumWords,requiredCycles:route==='C3'?5:1,scenes,forRound,paragraphsForRound:round=>forRound(round).flat(),sourceTokenForRound:round=>round===1?'sentinel alpha':'sentinel round'+(round-1),replacementTokenForRound:round=>'sentinel round'+round,imeText:'日本語.',imePrefix:'[ime] '};
}

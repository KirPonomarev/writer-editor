import {buildWordVolumeFixture,WORD_VOLUME_TEXT_PROBES} from './rtk-interop-word-volume-fixtures.mjs';
import {createHash} from 'node:crypto';

export const MANUSCRIPT_VOLUMES=Object.freeze(['SINGLE_SCENE','MULTI_SCENE','FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']);
export const MANUSCRIPT_ROUTES=Object.freeze(['C1','C2','C3','C5']);
export const MANUSCRIPT_PROFILES=Object.freeze(['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME']);
export const C1_REVIEW_RECIPE='C1_REVIEW_RETURN';
export const SINGLE_STRUCTURE_RECIPE='SINGLE_STRUCTURE_V2';
export const TABLES_RECIPE='TABLES_V1';
export function manuscriptRecipes(route){
 if(!MANUSCRIPT_ROUTES.includes(route))throw new Error('MANUSCRIPT_SCOPE');
 if(route==='C1')return ['DEFAULT',C1_REVIEW_RECIPE,SINGLE_STRUCTURE_RECIPE,TABLES_RECIPE];
 return route==='C2'||route==='C3'?['DEFAULT',SINGLE_STRUCTURE_RECIPE,TABLES_RECIPE]:['DEFAULT'];
}
export function manuscriptUsesSafeCreate(route,recipe='DEFAULT'){
 if(!manuscriptRecipes(route).includes(recipe))throw new Error('MANUSCRIPT_RECIPE');
 return route==='C5'||(route==='C1'&&['DEFAULT',TABLES_RECIPE].includes(recipe));
}
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
export const MANUSCRIPT_LINK_TARGETS=Object.freeze(['https://example.test/research?a=1&b=%D1%91#chapter-2','https://example.test/other?q=%F0%9F%A7%AD#note']);
export function manuscriptLinkBlock(){
 const link=href=>({type:'link',attrs:{href,target:'_blank',rel:'noopener noreferrer nofollow'}});
 return {type:'paragraph',content:[text('[links] '),text('reference',[link(MANUSCRIPT_LINK_TARGETS[0])]),text(' / '),text('reference',[link(MANUSCRIPT_LINK_TARGETS[1])]),text(' / '),text('reference',[link(MANUSCRIPT_LINK_TARGETS[0])]),text('.')]};
}
export function manuscriptFields(volume,route,recipe='DEFAULT'){
 if(!MANUSCRIPT_VOLUMES.includes(volume)||!MANUSCRIPT_ROUTES.includes(route))throw new Error('MANUSCRIPT_SCOPE');
 manuscriptUsesSafeCreate(route,recipe);
 if(recipe===TABLES_RECIPE)return ['TABLES'];
 if(recipe===SINGLE_STRUCTURE_RECIPE){
  if(volume!=='SINGLE_SCENE')throw new Error('MANUSCRIPT_RECIPE_VOLUME');
  return ['NOVEL_SCENE_STRUCTURE'];
 }
 // These fields have a different return command; ordinary C1 content import
 // keeps its existing four-field proof and never receives review-field credit.
 if(recipe===C1_REVIEW_RECIPE)return [...(volume==='SINGLE_SCENE'?[]:['NOVEL_SCENE_STRUCTURE']),'TRACKED_REVIEW_SEMANTICS','COMMENTS','IDENTIFIERS_ANCHORS','METADATA','SECTIONS','NOTES','FOOTNOTES_ENDNOTES'];
 if(route==='C5'){
  if(volume==='LARGE_DOCUMENT')throw new Error('GOOGLE_NATIVE_VOLUME_UNQUALIFIED');
  return ['TEXT','ORDER','UNICODE_IME_LOCALE'];
 }
 return ['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES',...(route==='C1'||volume==='SINGLE_SCENE'?[]:['NOVEL_SCENE_STRUCTURE']),...(route==='C1'?[]:['TRACKED_REVIEW_SEMANTICS','COMMENTS','IDENTIFIERS_ANCHORS','METADATA','SECTIONS','NOTES','FOOTNOTES_ENDNOTES'])];
}
export const MANUSCRIPT_CELLS=Object.freeze(MANUSCRIPT_VOLUMES.flatMap(volume=>MANUSCRIPT_ROUTES.filter(route=>route!=='C5'||volume!=='LARGE_DOCUMENT').flatMap(route=>MANUSCRIPT_PROFILES.flatMap(profile=>manuscriptRecipes(route).filter(recipe=>recipe!==SINGLE_STRUCTURE_RECIPE||volume==='SINGLE_SCENE').flatMap(recipe=>manuscriptFields(volume,route,recipe).map(field=>`${field}__${volume}__${route}__${profile}`))))));
export function manuscriptTableBlocks(){
 const cell=(value,colspan=1,rowspan=1)=>({type:'tableCell',attrs:{colspan,rowspan,colwidth:null},content:[paragraph(value)]});
 const row=(...content)=>({type:'tableRow',content}),table=(...content)=>({type:'table',content});
 const multiple=cell('[table-r2c1] multi');multiple.content.push(paragraph('[table-r2c1-p2] 日本語 e\u0301'));
 return [table(row(cell('[table-r1c1] first'),cell('repeated cell'),cell('')),
  row(multiple,cell('repeated cell'),cell('[table-r2c3] right')),
  row(cell('[table-r3c1] left'),cell('[table-r3c2] middle'),cell('[table-r3c3] last'))),
  paragraph('[between-tables]'),table(row(cell('[merged-horizontal]',2),cell('[merged-vertical]',1,2)),
   row(cell('[merged-r2c1]'),cell('[merged-r2c2]')),
   row(cell('[merged-r3c1]'),cell('[merged-r3c2]'),cell('[merged-r3c3]')))];
}
export function buildWordManuscriptFixture(volume,route,recipe='DEFAULT'){
 manuscriptFields(volume,route,recipe);
 const base=volume==='SINGLE_SCENE'?{minimumWords:0,scenes:[{paragraphs:[...WORD_VOLUME_TEXT_PROBES]}]}:buildWordVolumeFixture(volume);
 const scenes=base.scenes.map((s,i)=>{const content=s.paragraphs.map(p=>paragraph(p));if(i===0){content.push(...UNICODE_PROBES.map(p=>paragraph(p)),...manuscriptStyleBlocks());if(recipe===TABLES_RECIPE){const tables=manuscriptTableBlocks();if(route==='C1')content.splice(content.length-1,0,...tables);else{tables[0].content[0].content[0].content=[content.shift()];content.unshift(...tables);}}if(!manuscriptUsesSafeCreate(route,recipe))content.splice(content.length-1,0,manuscriptLinkBlock());}const doc={type:'doc',content};return {ordinal:i,name:'scene-'+String(i+1).padStart(2,'0'),chapter:volume==='SINGLE_SCENE'&&recipe!==SINGLE_STRUCTURE_RECIPE?null:Math.floor(i/(volume==='MULTI_SCENE'?1:7)),doc,paragraphs:manuscriptParagraphs(doc)};});
 const forRound=round=>scenes.map(s=>s.paragraphs.map(p=>round?p.replace('sentinel alpha','sentinel round'+round):p));
 return {schemaVersion:'WORD_MANUSCRIPT_FIXTURE_V1',volume,route,minimumWords:base.minimumWords,requiredCycles:route==='C3'?5:1,scenes,forRound,paragraphsForRound:round=>forRound(round).flat(),sourceTokenForRound:round=>round===1?'sentinel alpha':'sentinel round'+(round-1),replacementTokenForRound:round=>'sentinel round'+round,imeText:'日本語.',imePrefix:'[ime] '};
}

// Initial owned project data, like the authored scenes. It is never proof of a
// native edit or a canonical apply; those observations are recorded separately.
export function buildWordManuscriptCommentState({fixture,projectId,sceneId}){
 const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
 const specs=[['open','[quote] Authored quotation.'],['resolved','[code] const answer = 42;'],['deleted','[heading-1] Authored heading.']];
 const threads=specs.map(([status,blockText])=>{
  const index=fixture.scenes[0].paragraphs.indexOf(blockText);
  if(index<0)throw Error('COMMENT_FIXTURE_PARAGRAPH');
  const id='manuscript-comment-'+status;
  const messages=[{commentId:id+'-root',kind:'root',body:'  Root '+status+' & <замечание>\n\t尾 ',provenance:{author:'Alice & editor',initials:'AE',date:'2026-09-17T10:00:00Z',dateUtc:'2026-09-17T10:00:00Z'}},
   {commentId:id+'-reply',kind:'reply',body:'Reply '+status+' 🧭',provenance:{author:'Bob',initials:'B',date:'2026-09-17T10:01:00Z',dateUtc:'2026-09-17T10:01:00Z'}}];
  return {threadId:id,sceneId,rootCommentId:messages[0].commentId,status,...(status==='deleted'?{deleted:true}:{}),
   anchor:{sceneId,blockId:'',paragraphIndex:index,sceneParagraphIndex:index,blockTextSha256:sha(blockText),
    startUtf16:0,selectedText:blockText,selectedTextSha256:sha(blockText),authoritySource:'saved-project-exact-paragraph-range'},messages};
 });
 return {schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:1,threads,events:[]};
}

// Sidecar fixtures are explicit source data, never a provider observation.
export function buildWordManuscriptNoteState({fixture,projectId,scenes}){
 const stamp='2026-09-22T10:00:00.000Z',first=scenes[0],last=scenes.at(-1);
 const make=(id,scope,title,body,scene=first)=>({schemaVersion:1,id,scope,title,body,
  createdAtUtc:stamp,updatedAtUtc:stamp,deleted:false,
  attachment:{scope,...(['scene','selection'].includes(scope)?{sceneId:scene.sceneId,nodeId:scene.nodeId}:{})},
  ...(['scene','selection'].includes(scope)?{sceneId:scene.sceneId,nodeId:scene.nodeId}:{})});
 const notes=[make('note-foot-scene','scene','Foot & <title>','  Foot body\n\t尾 e\u0301 🧭  '),
  make('note-end-project','project','','Project endnote — שלום.'),
  make('note-foot-selection','selection','Selection','Literal _x0041_ & second footnote.'),
  make('note-end-last','scene','Last scene','Endnote Ω 日本語.',last),
  make('note-private','inbox','Private','PRIVATE_NOTE_MUST_NOT_LEAVE_PROJECT'),
  {...make('note-deleted','scene','Deleted','DELETED_NOTE_MUST_NOT_LEAVE_PROJECT'),deleted:true,deletedAtUtc:stamp}];
 notes[2].attachment.anchor={kind:'text-range',start:0,end:6,quoteHash:createHash('sha256').update(fixture.scenes[0].paragraphs[0].slice(0,6)).digest('hex')};
 const selections=[{noteId:'note-foot-scene',kind:'footnote'},{noteId:'note-end-project',kind:'endnote'},
  {noteId:'note-foot-selection',kind:'footnote'},{noteId:'note-end-last',kind:'endnote'}];
 const lastParagraph=fixture.scenes.slice(0,-1).reduce((n,s)=>n+s.paragraphs.length,0);
 const projection=selections.map((s,i)=>({kind:s.kind,paragraphIndex:i===3?lastParagraph:0,offsetUtf16:i===2?6:0,paragraphs:[notes[i].title,notes[i].body],ordinal:i}))
  .sort((a,b)=>a.paragraphIndex-b.paragraphIndex||a.offsetUtf16-b.offsetUtf16||a.ordinal-b.ordinal).map(({ordinal,...n})=>n);
 return {document:{schemaVersion:1,projectId,notes:notes.sort((a,b)=>a.id.localeCompare(b.id))},selections,projection};
}

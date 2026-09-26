'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules=Promise.all([import('../../src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs'),import('../../src/renderer/documentContentEnvelope.mjs'),import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs')]);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const oldHref='https://example.invalid/old#one',newHref='https://example.invalid/new#two',sceneId='roman/a.txt';
function fixture(repeated=false){
 const text=s=>({type:'text',text:s});
 const linked={type:'text',text:'same',marks:[{type:'bold'},{type:'link',attrs:{href:oldHref,target:'_blank',rel:'noopener',title:null}}]};
 const doc={type:'doc',content:[{type:'paragraph',content:[text('before '),linked,text(' after')]}]};
 if(repeated)doc.content.push({type:'paragraph',content:[text('other same context')]});
 const expected=structuredClone(doc);expected.content[0].content[1].text='Новая 😀';expected.content[0].content[1].marks[1].attrs.href=newHref;
 const baselineParagraphs=buildFormatIrParagraphs({sceneId,text:doc.content.map(p=>p.content.map(n=>n.text).join('')).join('\n'),doc});
 const next='Новая 😀';
 const returnedParagraphs=[{paragraphIndex:0,paragraphText:'before '+next+' after',paragraphState:{},paragraphStructure:{nodeType:'paragraph'},formattedRuns:[
  {from:0,to:7,text:'before ',inlineState:{}},
  {from:7,to:7+next.length,text:next,inlineState:{bold:true,link:newHref}},
  {from:7+next.length,to:13+next.length,text:' after',inlineState:{}}
 ]}];
 if(repeated)returnedParagraphs.push({paragraphIndex:1,paragraphText:'other same context',paragraphState:{},paragraphStructure:{nodeType:'paragraph'},formattedRuns:[{from:0,to:18,text:'other same context',inlineState:{}}]});
 return {doc,expected,sceneId,baselineParagraphs,returnedParagraphs,reviewIr:{},allowTargetChange:true};
}
async function setup(t,f,change){
 const [,e]=await modules,root=fs.mkdtempSync(path.join(os.tmpdir(),'word-combined-link-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const scenePath=path.join(root,sceneId);fs.mkdirSync(path.dirname(scenePath));const before=e.composeObservablePayload({doc:f.doc,metaEnabled:false});fs.writeFileSync(scenePath,before);
 const input={projectRoot:root,projectSnapshot:{projectId:'p',baselineHash:'b',scenes:[{sceneId,text:before}]},revisionSession:{projectId:'p',sessionId:'s',baselineHash:'b',status:'open',reviewGraph:{textChanges:[change]}},reviewItems:[change],scenePath,scenePathBySceneId:{[sceneId]:scenePath}};
 return {input,scenePath,before,permit:{trustedLinkReplacementDigest:hash(JSON.stringify(change))}};
}
for(const repeated of [false,true])test('combined link atomically preserves full graph and replay; repeated label='+repeated,async t=>{
 const [m,e,w]=await modules,f=fixture(repeated),r=m.analyzeCleanLinkLabelReturn(f);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.canWriteManuscript,false);
 assert.deepEqual(r.change.richReplacementLink,{expectedHref:oldHref,replacementHref:newHref});
 const {input,scenePath,permit}=await setup(t,f,r.change),options={...permit,operationId:'op_combined_link'};
 const result=await w.applyExactTextBatchMinSafeWrite(input,options);assert.equal(result.applied,true,JSON.stringify(result));
 const after=fs.readFileSync(scenePath,'utf8');assert.deepEqual(e.parseObservablePayload(after).doc,f.expected);
 const replay=await w.applyExactTextBatchMinSafeWrite(input,options);assert.equal(replay.status,'replay');assert.equal(fs.readFileSync(scenePath,'utf8'),after);
});
for(const fault of ['missing-permit','forged-permit','altered-label','altered-target','wrong-old-target','unsafe-target','extra-key','stale','publisher'])test('combined link no-write guard '+fault,async t=>{
 const [m,,w]=await modules,f=fixture(),r=m.analyzeCleanLinkLabelReturn(f),s=await setup(t,f,r.change);let options={...s.permit};
 if(fault==='missing-permit')options={};
 if(fault==='forged-permit')options.trustedLinkReplacementDigest='0'.repeat(64);
 if(fault==='altered-label')s.input.reviewItems[0].replacementText='unbound';
 if(fault==='altered-target')s.input.reviewItems[0].richReplacementLink.replacementHref='https://example.invalid/unbound';
 if(fault==='wrong-old-target')s.input.reviewItems[0].richReplacementLink.expectedHref='https://example.invalid/wrong';
 if(fault==='unsafe-target')s.input.reviewItems[0].richReplacementLink.replacementHref='javascript:alert(1)';
 if(fault==='extra-key')s.input.reviewItems[0].richReplacementLink.ignoreMarks=true;
 if(['wrong-old-target','unsafe-target','extra-key'].includes(fault))options.trustedLinkReplacementDigest=hash(JSON.stringify(s.input.reviewItems[0]));
 if(fault==='stale')fs.writeFileSync(s.scenePath,s.before+'local drift');
 if(fault==='publisher')options.publishScene=async()=>{throw Error('synthetic publish rejection');};
 const before=fs.readFileSync(s.scenePath,'utf8'),result=await w.applyExactTextBatchMinSafeWrite(s.input,options);assert.notEqual(result.applied,true,JSON.stringify(result));assert.equal(fs.readFileSync(s.scenePath,'utf8'),before);
});
for(const fault of ['default-off','unsafe-target','style','neighbor-target','comment'])test('combined analysis retains narrow effect boundary '+fault,async()=>{
 const [m]=await modules,f=fixture(),p=f.returnedParagraphs[0];
 if(fault==='default-off')delete f.allowTargetChange;
 if(fault==='unsafe-target')p.formattedRuns[1].inlineState.link='file:///private';
 if(fault==='style')p.formattedRuns[1].inlineState.italic=true;
 if(fault==='neighbor-target')p.formattedRuns[0].inlineState.link=newHref;
 if(fault==='comment')f.reviewIr.comments=[{id:'mixed'}];
 assert.equal(m.analyzeCleanLinkLabelReturn(f).ok,false);
});
function extracted(name){const source=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8'),start=source.indexOf('function '+name+'('),end=source.indexOf('\n}\n',start)+3;assert(start>=0&&end>start);return source.slice(source.slice(start-6,start)==='async '?start-6:start,end);}
for(const valid of [true,false])test('queued main mints compound permit only after private input revalidation '+valid,async()=>{
 const item={changeId:'docx-clean-link-label-test',richReplacementLink:{expectedHref:oldHref,replacementHref:newHref}},input={reviewItems:[item]};let calls=0,options;
 const sandbox={isDirty:false,autoSaveInProgress:false,queueDiskOperation:fn=>fn(),revalidateCleanLinkLabelApplyInput:async()=>({ok:valid,reason:'blocked'}),computeHash:hash,publishReviewSceneWithProjectTransaction:()=>{}};
 vm.createContext(sandbox);vm.runInContext(extracted('runReviewExactTextBatchSafeWriteFromMainState'),sandbox);
 await sandbox.runReviewExactTextBatchSafeWriteFromMainState(async(i,o)=>{calls++;options=o;},{...input},{trustedLinkReplacementDigest:'forged'});
 assert.equal(calls,valid?1:0);if(valid)assert.equal(options.trustedLinkReplacementDigest,hash(JSON.stringify(item)));
});

test('existing read-only review item exposes both targets before explicit Apply',async()=>{
 const item={changeId:'docx-clean-link-label-test',targetScope:{type:'scene',id:sceneId},richReplacementLink:{expectedHref:oldHref,replacementHref:newHref}};
 const sandbox={cloneJsonSafe:x=>JSON.parse(JSON.stringify(x))};vm.createContext(sandbox);vm.runInContext(extracted('buildCleanLinkLabelPreviewPacket'),sandbox);
 const packet=sandbox.buildCleanLinkLabelPreviewPacket(item);assert.equal(packet.diagnosticItems.length,1);
 const bridge=await import('../../src/io/revisionBridge/index.mjs');const diagnostic=bridge.normalizeDiagnosticItem(packet.diagnosticItems[0]);
 assert.equal(diagnostic.message,`Вместе с подписью изменится адрес ссылки: ${oldHref} → ${newHref}`);
 const renderer=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
 const a=renderer.indexOf('function reviewSurfaceBuildReviewItems('),b=renderer.indexOf('function reviewSurfaceBuildManualOnlyReasons(',a);assert(a>=0&&b>a);
 const ui={reviewSurfaceIsPlainObject:x=>!!x&&typeof x==='object'&&!Array.isArray(x),reviewSurfaceText:x=>typeof x==='string'?x:'',reviewSurfaceArray:x=>Array.isArray(x)?x:[]};vm.createContext(ui);vm.runInContext(renderer.slice(a,b),ui);
 const items=ui.reviewSurfaceBuildReviewItems({revisionSession:{reviewGraph:{diagnosticItems:[diagnostic]}}});
 assert.equal(items.length,1);assert.equal(items[0].body,diagnostic.message);assert.equal(items[0].tone,'readonly');
 delete item.richReplacementLink;assert.equal(sandbox.buildCleanLinkLabelPreviewPacket(item).diagnosticItems.length,0);
});

for(const clean of [true,false])test('actual single-item click preserves profile gates and routes only clean links; clean='+clean,async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
 const fn=name=>{const a=source.indexOf('function '+name+'('),b=source.indexOf('\n}\n',a)+3;assert(a>=0&&b>a);return source.slice(source.slice(a-6,a)==='async '?a-6:a,b);};
 class Element {} class HTMLElement extends Element {} class HTMLButtonElement extends HTMLElement {}
 const changeId=clean?'docx-clean-link-label-selected':'ordinary-change';
 const button=new HTMLButtonElement();button.dataset={changeId};button.disabled=false;
 button.closest=selector=>selector==='[data-review-apply-exact-change]'?button:null;
 const host=new HTMLElement();host.contains=x=>x===button;const calls=[];
 const ui={Element,HTMLElement,HTMLButtonElement,reviewSurfaceHost:host,
 REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID:'cmd.project.review.applyExactTextChange',
 REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID:'cmd.project.review.applyExactTextChangesBatch',
 reviewSurfaceText:x=>typeof x==='string'?x:'',reviewSurfaceArray:x=>Array.isArray(x)?x:[],
 reviewSurfaceCreateExactTextApplyRequestId:()=> 'explicit-click',setReviewSurfaceExactTextApplyTransientState:()=>{},
 invokePreloadUiCommandBridge:async(id,payload)=>{calls.push({id,payload});return {ok:true,value:{ok:true,applied:true,reviewSurface:{}}};},
 reviewSurfaceUnwrapCommandResult:x=>x.value,reviewSurfaceIsPlainObject:x=>!!x&&typeof x==='object',setReviewSurfaceState:()=>{}};
 vm.createContext(ui);for(const name of ['reviewSurfaceBuildExactTextApplyPayload','reviewSurfaceBuildExactTextApplyBatchPayload','handleReviewSurfaceExactTextApplyClick'])vm.runInContext(fn(name),ui);
 await ui.handleReviewSurfaceExactTextApplyClick({target:button});assert.equal(calls.length,1);
 assert.equal(calls[0].id,clean?ui.REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID:ui.REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)),clean?{requestId:'explicit-click',changeIds:[changeId]}:{requestId:'explicit-click',changeId});
 const law=require('../../src/core/entitlement-law-v1.cjs');assert.equal(law.isFreeAlwaysAvailableCommandId(calls[0].id),clean);
 const local=require('../../src/core/writer-local-profile-v1.cjs');assert.equal(local.evaluateWriterLocalCommandAccess({profile:local.createWriterLocalProfileProjection({isPackaged:true,platform:'darwin'}),commandId:calls[0].id}).allowed,clean);
 button.disabled=true;await ui.handleReviewSurfaceExactTextApplyClick({target:button});assert.equal(calls.length,1);
});

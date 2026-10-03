'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const model = require('../../src/core/word-comment-body-v1.cjs');
const author = require('../../src/core/word-comment-authoring-v1.cjs');
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const rich = (marks=[{type:'bold'}]) => ({schemaVersion:model.SCHEMA,document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Root\ttext',marks},{type:'hardBreak'},{type:'text',text:'break'}]},{type:'paragraph',content:[{type:'text',text:'Second'}]}]}});
const context = {projectId:'p',sceneId:'scene',sceneSha256:sha('anchor'),paragraphs:['anchor'],now:'2026-10-03T00:00:00Z'};
const intent = (before,action,extra={}) => ({requestId:crypto.randomUUID(),action,projectId:'p',sceneId:'scene',expectedSceneSha256:context.sceneSha256,expectedStateSha256:before ? sha(before) : '',...extra});
test('rich profile derives literal while preserving paragraph, tab, break, marks and layout',()=>{
 const value=rich([{type:'bold'},{type:'italic'},{type:'underline'},{type:'strike'},{type:'highlight',attrs:{color:'#ffff00'}},{type:'textStyle',attrs:{fontFamily:'"Arial"',fontSize:'16px',color:'#aa00ff',wordLanguage:{val:'ru-RU'}}},{type:'link',attrs:{href:'https://example.org/?q=a&b=c'}}]);
 value.document.content[0].attrs={wordParagraphIndent:{left:100},wordParagraphTabs:[{pos:600,val:'left'}]};
 const checked=model.validateCommentRichBody(value);
 assert.equal(checked.body,'Root\ttext\nbreak\nSecond');
 assert.equal(checked.richBody.document.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.fontSize,'12pt');
 assert.deepEqual(checked.richBody.document.content[0].attrs,value.document.content[0].attrs);
 assert.throws(()=>model.validateCommentMessageContent({body:'wrong',richBody:value}),/PROJECTION_MISMATCH/);
 assert.deepEqual(model.validateCommentMessageContent({richBody:value},{deriveBody:true}),checked);
});
test('unsupported structure and unsafe marks are refused, not flattened',()=>{
 for(const node of [{type:'table'},{type:'bulletList'},{type:'image',attrs:{}},{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:evil()'}}]}]){
  const value=rich(); if(['table','bulletList'].includes(node.type)) value.document.content=[node]; else value.document.content[0].content=[node];
  assert.throws(()=>model.validateCommentRichBody(value));
 }
 const huge=rich();huge.document.content[0].content=[{type:'text',text:'x'.repeat(16385)}];assert.throws(()=>model.validateCommentRichBody(huge),/BODY_INVALID/);
});
test('semantic equality normalizes only admitted defaults, runs, mark order and exact typography units',()=>{
 const a={richBody:rich([{type:'bold'},{type:'italic'}])};a.body=model.validateCommentRichBody(a.richBody).body;
 const b=structuredClone(a);b.richBody.document.content[0].content[0].marks.reverse();
 assert.equal(model.commentBodyEqual(a,b),true);
 b.richBody.document.content[0].content[0].marks.pop();assert.equal(model.commentBodyEqual(a,b),false);
 assert.equal(model.commentBodyEqual({body:'a\nb'},{body:'a\nb',richBody:{schemaVersion:model.SCHEMA,document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'a'},{type:'hardBreak'},{type:'text',text:'b'}]}]}}}),true);
});
test('first rich write upgrades outer schema; v1 refuses rich; clearing rich never downgrades',()=>{
 const input=intent(null,'create',{richBody:rich(),anchor:{paragraphIndex:0,startUtf16:0,selectedText:'anchor'}});
 const result=author.planCommentAuthoring({...context,beforeText:null,input});
 assert.equal(result.state.schemaVersion,model.STATE_V2);
 const cleared=author.planCommentAuthoring({...context,beforeText:result.afterText,input:intent(result.afterText,'edit',{threadId:result.threadId,commentId:result.state.threads[0].rootCommentId,body:'plain'})});
 assert.equal(cleared.state.schemaVersion,model.STATE_V2);assert.equal(cleared.state.threads[0].messages[0].richBody,undefined);
 const downgraded=structuredClone(result.state);downgraded.schemaVersion=model.STATE_V1;
 assert.throws(()=>author.readState(JSON.stringify(downgraded),'p'),/VERSION_REQUIRED/);
});

test('external object accessors, toJSON and cycles never execute before rejection',()=>{
 let calls=0;const getter={};Object.defineProperty(getter,'schemaVersion',{enumerable:true,get(){calls++;return model.SCHEMA;}});
 assert.throws(()=>model.validateCommentRichBody(getter),/BODY_DATA/);
 const hook=rich();hook.document.toJSON=()=>{calls++;return {};};assert.throws(()=>model.validateCommentRichBody(hook),/BODY_DATA/);
 const cycle=rich();cycle.document.content[0].content.push(cycle.document);assert.throws(()=>model.validateCommentRichBody(cycle),/BODY_DATA/);
 const message={};Object.defineProperty(message,'richBody',{get(){calls++;return rich();}});assert.throws(()=>model.validateCommentMessageContent(message),/BODY_DATA/);
 assert.equal(calls,0);
});
test('rich root/reply exporter and actual parser preserve structure, links, formatting and final paragraph identity',async()=>{
 const make = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource;
 const build = require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer;
 const bridge = await import('../../src/io/revisionBridge/index.mjs');
 const input=intent(null,'create',{richBody:rich([{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Arial',fontSize:'12pt',color:'#123456'}},{type:'link',attrs:{href:'https://example.org/?a=b&c=d'}}]),anchor:{paragraphIndex:0,startUtf16:0,selectedText:'anchor'}});
 const root=author.planCommentAuthoring({...context,beforeText:null,input});
 const reply=author.planCommentAuthoring({...context,beforeText:root.afterText,input:intent(root.afterText,'reply',{threadId:root.threadId,richBody:rich([{type:'italic'}])})});
 const source=make({projectId:'p',projectRoot:'/project',nonTextReturnState:reply.state,scenes:[{sceneId:'scene',scenePath:'/project/scene',order:0,text:'anchor',doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'anchor'}]}]}}]});
 const bytes=build(source);
 const result=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:sha,sha256Json:v=>'sha256:'+sha(JSON.stringify(v)),byteLength:v=>Buffer.byteLength(v)}});
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.reviewIr.commentBodyGrammar.status,'SUPPORTED',JSON.stringify(result.reviewIr.commentBodyGrammar));
 const returned=result.reviewIr.commentThreads[0];
 assert.equal(returned.replies.length,1);
 assert.equal(model.commentBodyEqual({...source.commentExport.threads[0].messages[0],richBody:source.commentExport.threads[0].messages[0].transportRichBody},returned),true,JSON.stringify(returned.richBody));
 assert.equal(model.commentBodyEqual({...source.commentExport.threads[0].messages[1],richBody:source.commentExport.threads[0].messages[1].transportRichBody},returned.replies[0]),true,JSON.stringify(returned.replies[0].richBody));
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
 assert.match(parts['word/_rels/comments.xml.rels'],/TargetMode="External"/);
 for(const m of source.commentExport.threads[0].messages) assert.match(parts['word/comments.xml'],new RegExp(`w14:paraId="${m.paraId}"[^]*?</w:p></w:comment>`));
});
test('rich format-only intent participates in replay identity and cannot bypass stale state CAS',()=>{
 const input=intent(null,'create',{richBody:rich(),anchor:{paragraphIndex:0,startUtf16:0,selectedText:'anchor'}});
 const made=author.planCommentAuthoring({...context,beforeText:null,input});
 const mutated=structuredClone(input);mutated.richBody.document.content[0].content[0].marks=[{type:'italic'}];
 assert.throws(()=>author.planCommentAuthoring({...context,beforeText:made.afterText,input:mutated}),/COMMENT_REPLAY_CONFLICT/);
 const edit=intent(null,'edit',{threadId:made.threadId,commentId:made.state.threads[0].rootCommentId,richBody:rich([{type:'underline'}])});
 assert.throws(()=>author.planCommentAuthoring({...context,beforeText:made.afterText,input:edit}),/COMMENT_STATE_CONFLICT/);
 assert.equal(JSON.parse(made.afterText).threads[0].messages[0].richBody.document.content[0].content[0].marks[0].type,'bold');
});
test('Review baseline derives its actual typography defaults while ordinary absence and explicit sizes stay intact',()=>{
 const {buildCanonicalCommentExport}=require('../../src/export/docx/docxReviewPacketComments.js');
 const {REVIEW_DOCX_TYPOGRAPHY_DEFAULTS}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const input=intent(null,'create',{body:'legacy',anchor:{paragraphIndex:0,startUtf16:0,selectedText:'anchor'}});
 const state=author.planCommentAuthoring({...context,beforeText:null,input}).state;
 const before=JSON.stringify(state),blocks=[{sceneId:'scene',blockId:'b',documentParagraphIndex:0,text:'anchor'}];
 const ordinary=buildCanonicalCommentExport(state,blocks,'p'),review=buildCanonicalCommentExport(state,blocks,'p',{exportTypography:REVIEW_DOCX_TYPOGRAPHY_DEFAULTS});
 assert.equal(ordinary.threads[0].messages[0].transportRichBody,undefined);
 assert.equal(ordinary.threads[0].messages[0].richBody,undefined);
 const effective=review.threads[0].messages[0].transportRichBody;
 assert.equal(effective.document.content[0].content[0].marks[0].attrs.fontSize,'12pt');
 assert.equal(JSON.stringify(state),before);
 const explicit={body:'legacy',richBody:{schemaVersion:model.SCHEMA,document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'legacy',marks:[{type:'textStyle',attrs:{fontSize:'12pt'}}]}]}]}}};
 assert.equal(model.commentBodyEqual({...review.threads[0].messages[0],richBody:effective},explicit),true);
 explicit.richBody.document.content[0].content[0].marks[0].attrs.fontSize='14pt';
 assert.equal(model.commentBodyEqual({...review.threads[0].messages[0],richBody:effective},explicit),false);
 state.schemaVersion=model.STATE_V2;Object.assign(state.threads[0].messages[0],explicit);
 const nondefault=buildCanonicalCommentExport(state,blocks,'p',{exportTypography:REVIEW_DOCX_TYPOGRAPHY_DEFAULTS});
 assert.equal(nondefault.threads[0].messages[0].transportRichBody.document.content[0].content[0].marks[0].attrs.fontSize,'14pt');
});

test('serialized rich authoring crosses the actual default IPC envelope without widening it',()=>{
 const {createEnvelope,validateIpcEnvelope}=require('../../src/core/ipc-envelope-v1.cjs');
 const value=rich([{type:'textStyle',attrs:{wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'},fontSize:'12pt'}}]);
 const raw=intent(null,'create',{richBody:value,anchor:{paragraphIndex:0,startUtf16:0,selectedText:'anchor'}});
 assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge',author.COMMAND_ID,raw),'ui:command-bridge').code,'E_ENVELOPE_DEPTH');
 const input={...raw,richBodyJson:JSON.stringify(raw.richBody)};delete input.richBody;
 assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge',author.COMMAND_ID,input),'ui:command-bridge').ok,true);
 const result=author.planCommentAuthoring({...context,beforeText:null,input});
 assert.deepEqual(result.state.threads[0].messages[0].richBody,model.validateCommentRichBody(value).richBody);
 assert.equal(result.state.threads[0].messages[0].richBodyJson,undefined);
 for(const change of [{richBodyJson:'x'.repeat(65537)},{richBodyJson:'{'},{body:'collision'},{richBody:value}])
  assert.throws(()=>author.planCommentAuthoring({...context,beforeText:null,input:{...input,...change}}),/COMMENT_RICH_WIRE/);
});
test('actual whole-selection underline preserves marked line breaks and rejects unsafe break marks',async()=>{
 const {getSchema}=await import('@tiptap/core');const {EditorState}=await import('@tiptap/pm/state');
 const {manuscriptBodyExtensions}=await import('../../src/renderer/tiptap/manuscriptNotes.mjs');
 const schema=getSchema(manuscriptBodyExtensions({profile:'comment'}));
 const original=rich(),state=EditorState.create({schema,doc:schema.nodeFromJSON(original.document)});
 const document=state.tr.addMark(0,state.doc.content.size,schema.marks.underline.create()).doc.toJSON();delete document.attrs;
 const checked=model.validateCommentRichBody({schemaVersion:model.SCHEMA,document});
 const line=checked.richBody.document.content[0].content.find(n=>n.type==='hardBreak');
 assert.deepEqual(line.marks,[{type:'underline'}]);assert.equal(checked.body,model.validateCommentRichBody(original).body);
 const changed=structuredClone(checked);changed.richBody.document.content[0].content.find(n=>n.type==='hardBreak').marks=[{type:'italic'}];
 assert.equal(model.commentBodyEqual(checked,changed),false);
 for(const mark of [{type:'executable'},{type:'link',attrs:{href:'javascript:evil()'}},{type:'textStyle',attrs:{fontSize:'bad'}}]){
  const unsafe=structuredClone(checked.richBody);unsafe.document.content[0].content.find(n=>n.type==='hardBreak').marks=[mark];assert.throws(()=>model.validateCommentRichBody(unsafe));
 }
 const shared=require('../../src/core/word-rich-body-projection-v1.cjs');assert.throws(()=>shared.validateRichBody(checked.richBody.document),/NOTE_BODY_BREAK/);
});

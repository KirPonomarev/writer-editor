'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildFullManuscriptDocxReviewPacketSource: makeSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { compareCommentExportReadback } = require('../../src/export/docx/docxReviewPacketComments.js');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
const cryptoPort = { sha256Text: sha, sha256Json: value => `sha256:${sha(stable(value))}`, byteLength: value => Buffer.byteLength(value) };
const provenance = { author: ' Редактор & <A> ', initials: 'РA', date: '2026-09-17T10:00:00Z', dateUtc: '2026-09-17T10:00:00Z' };

function inputs() {
  const input = { projectId: 'comments-test', projectRoot: '/project', scenes: [{ sceneId: 'roman/a.md', scenePath: '/project/roman/a.md', order: 0,
    text: 'Before 🧭 anchor and after.', doc: { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Before 🧭 an', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'chor and after.', marks: [{ type: 'italic' }] },
    ] }] } }] };
  const bare = makeSource(input);
  const root = { threadId: 'thread-1', sceneId: input.scenes[0].sceneId, rootCommentId: 'root-1', status: 'open',
    anchor: { sceneId: input.scenes[0].sceneId, blockId: bare.blocks[0].blockId, paragraphIndex: 0,
      selectedText: '🧭 anchor', selectedTextSha256: sha('🧭 anchor') },
    messages: [{ commentId: 'root-1', kind: 'root', body: '  Первое & <замечание>\n\t尾 ', provenance: { ...provenance } },
      { commentId: 'reply-1', kind: 'reply', body: 'Reply 🧭', provenance: { ...provenance, author: 'Reply author' } }] };
  return { ...input, nonTextReturnState: { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId: input.projectId,
    revision: 2, threads: [root], events: [] } };
}

async function parsed(buffer) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const result = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buffer }, { cryptoPort });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  return result.reviewIr.commentThreads;
}

// Independent minimal ZIP reader for assertions on actual emitted parts.
function parts(buffer) {
  const result = {};
  for (let cursor = 0; buffer.readUInt32LE(cursor) === 0x04034b50;) {
    assert.equal(buffer.readUInt16LE(cursor + 8), 0);
    const size = buffer.readUInt32LE(cursor + 18), length = buffer.readUInt16LE(cursor + 26), extra = buffer.readUInt16LE(cursor + 28);
    const start = cursor + 30 + length + extra;
    result[buffer.subarray(cursor + 30, cursor + 30 + length).toString()] = buffer.subarray(start, start + size).toString();
    cursor = start + size;
  }
  return result;
}

test('canonical roots and replies retain literal provenance through atomic save, reopen and replay', async () => {
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-comment-provenance-'));
  const root = { projectId: 'p', projectRoot, operationId: 'root-op', sceneId: 's', sceneText: 'one exact anchor', selectedText: 'exact anchor',
    threadId: 't', commentId: 'c', body: ' Root ', anchor: { sceneId: 's' }, provenance };
  const handler = runtime.createRtkRootCommentReturnCommandHandler();
  assert.equal((await handler(root)).status, 'applied');
  assert.equal((await handler(root)).status, 'replay');
  const changed = await handler({ ...root, provenance: { ...provenance, author: 'forged' } });
  assert.equal(changed.code, 'RTK_ROOT_COMMENT_REPLAY_PAYLOAD_MISMATCH');
  const reply = { projectId: 'p', projectRoot, operationId: 'reply-op', sceneId: 's', threadId: 't', action: 'reply',
    replyId: 'r', replyBody: ' Reply ', provenance: { ...provenance, author: 'Second' } };
  const lifecycle = runtime.createRtkCommentLifecycleReturnCommandHandler();
  assert.equal((await lifecycle(reply)).status, 'applied');
  assert.equal((await lifecycle(reply)).status, 'replay');
  assert.equal((await lifecycle({ ...reply, provenance: { ...provenance, author: 'spoof' } })).code, 'RTK_COMMENT_LIFECYCLE_REPLAY_PAYLOAD_MISMATCH');
  const state = await runtime.createRtkNonTextReturnFilePort().readCanonical(root);
  assert.deepEqual(state.threads[0].messages[0].provenance, provenance);
  assert.deepEqual(state.threads[0].messages[1].provenance, reply.provenance);
  assert.equal(fs.existsSync(path.join(projectRoot, '.yalken/recovery/non-text-return-state.v1.json')), true);
});

test('comment DOCX parts preserve exact styled anchors, reply order, authors, timestamps and whitespace', async () => {
  const source = makeSource(inputs());
  const bytes = buildDocxReviewPacketBuffer(source);
  const xml = parts(bytes);
  const threads = await parsed(bytes);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].quotedAnchorText, '🧭 anchor');
  assert.equal(threads[0].body, '  Первое & <замечание>\n\t尾 ');
  assert.equal(threads[0].replies[0].body, 'Reply 🧭');
  assert.equal(threads[0].authorPersonIdentity.author, provenance.author);
  assert.equal(threads[0].date, provenance.date);
  assert.equal(threads[0].dateUtc, provenance.dateUtc);
  assert.equal(threads[0].replies[0].dateUtc, provenance.dateUtc);
  assert.equal(compareCommentExportReadback(source.commentExport, threads).ok, true);
  assert.match(xml['word/document.xml'], /<w:b\/>/u);
  assert.match(xml['word/document.xml'], /<w:i\/>/u);
  assert.match(xml['word/document.xml'], /commentRangeStart[\s\S]*🧭 an[\s\S]*chor[\s\S]*commentRangeEnd/u);
  assert.match(xml['word/commentsExtended.xml'], /paraIdParent=/u);
  for (const name of ['comments.xml', 'commentsExtended.xml', 'commentsIds.xml', 'commentsExtensible.xml']) {
    assert.match(xml['[Content_Types].xml'], new RegExp(name.replaceAll('.', '\\.')));
    assert.match(xml['word/_rels/document.xml.rels'], new RegExp(name.replaceAll('.', '\\.')));
  }
  assert.deepEqual(await parsed(source.provisionalSelfParseArtifact.bytes), threads);
});

test('resolved threads remain resolved; deleted canonical threads stay tombstoned and absent from Word', async () => {
  const input = inputs(); input.nonTextReturnState.threads[0].status = 'resolved';
  const deleted = structuredClone(input.nonTextReturnState.threads[0]);
  deleted.threadId = 'deleted-thread'; deleted.rootCommentId = 'deleted-root'; deleted.status = 'deleted'; deleted.deleted = true;
  deleted.messages = [{ commentId: 'deleted-root', kind: 'root', body: 'Intentionally deleted' }];
  input.nonTextReturnState.threads.push(deleted);
  const source = makeSource(input), threads = await parsed(buildDocxReviewPacketBuffer(source));
  assert.equal(threads.length, 1); assert.equal(threads[0].status, 'RESOLVED');
  assert.equal(source.commentExport.tombstones[0].outcome, 'CANONICAL_DELETION_NOT_EXPORTED');
  assert.equal(compareCommentExportReadback(source.commentExport, threads).ok, true);
  const revived=structuredClone(threads[0]);revived.durableId=source.commentExport.tombstones[0].messageDurableIds[0];
  assert.equal(compareCommentExportReadback(source.commentExport,[...threads,revived]).ok,false);
});

test('stale, ambiguous, wrong-scene and malformed canonical comments fail before publication', () => {
  const cases = [
    input => { input.nonTextReturnState.projectId = 'foreign'; },
    input => { input.nonTextReturnState.threads[0].anchor.blockId = 'old-block'; },
    input => { input.nonTextReturnState.threads[0].anchor.sceneId = 'foreign'; },
    input => { input.nonTextReturnState.threads[0].anchor.selectedTextSha256 = '0'.repeat(64); },
    input => { input.nonTextReturnState.threads[0].messages[1].commentId = 'root-1'; },
    input => { input.nonTextReturnState.threads[0].messages[0].provenance.author = 'x'.repeat(1025); },
    input => { input.nonTextReturnState.threads[0].messages[0].body = 'bad\uD800'; },
    input => { input.nonTextReturnState.threads[0].status = 'unknown'; },
    input => { Object.assign(input.nonTextReturnState.threads[0].anchor, { selectedText:'\uDDED', selectedTextSha256:sha('\uDDED'), startUtf16:8 }); },
  ];
  for (const mutate of cases) { const input = inputs(); mutate(input); assert.throws(() => makeSource(input)); }
});

test('independent mutations of each comment property are rejected by semantic publication comparison', async () => {
  const source = makeSource(inputs()), original = await parsed(buildDocxReviewPacketBuffer(source));
  const mutations = [
    threads => threads.splice(0),
    threads => { threads[0].body += 'x'; },
    threads => { threads[0].quotedAnchorText = 'other'; },
    threads => { threads[0].paragraphIndex = 3; },
    threads => { threads[0].status = 'RESOLVED'; },
    threads => { threads[0].replies = []; },
    threads => { threads[0].replies[0].body += 'x'; },
    threads => { threads[0].dateUtc = '2026-01-01T00:00:00Z'; },
    threads => { threads[0].authorPersonIdentity.author = 'other'; },
    threads => { threads[0].durableId = '12345678'; },
    threads => threads.push(structuredClone(threads[0])),
  ];
  for (const mutate of mutations) { const threads = structuredClone(original); mutate(threads); assert.equal(compareCommentExportReadback(source.commentExport, threads).ok, false); }
});

test('authenticated unchanged reexport plans zero commands and never invents a new canonical thread', async () => {
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const source = makeSource(inputs()), threads = await parsed(buildDocxReviewPacketBuffer(source));
  for (const returnArtifactId of ['sha256:first-return', 'sha256:resaved-same-comments']) {
    const plan = runtime.buildAuthenticatedCommentReturnCommands({ authenticated: true, projectId: 'comments-test', projectRoot: '/project',
      returnArtifactId, localAuthorityCapsule: source.localAuthorityCapsule, reviewIr: { commentThreads: threads } });
    assert.equal(plan.ok, true, JSON.stringify(plan)); assert.deepEqual(plan.commands, []);
    assert.deepEqual(plan.baselineReadback.unchangedThreadIds, ['thread-1']);
  }
});


test('same quote at a different offset, missing reference and namespace-spoofed anchors are rejected', async () => {
  const input=inputs();
  const body='word word';
  input.scenes[0].text=body; input.scenes[0].doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:body}]}]};
  const bare=makeSource({...input,nonTextReturnState:undefined});
  Object.assign(input.nonTextReturnState.threads[0].anchor,{blockId:bare.blocks[0].blockId,selectedText:'word',
    selectedTextSha256:sha('word')});
  assert.throws(()=>makeSource(input),/ANCHOR_AMBIGUOUS/);
  input.nonTextReturnState.threads[0].anchor.startUtf16=5;
  const source=makeSource(input), bytes=buildDocxReviewPacketBuffer(source), before=await parsed(bytes);
  assert.equal(before[0].anchorRange.startUtf16,5);
  const moved=structuredClone(source.commentExport);
  moved.threads[0].anchor.startUtf16=0;moved.threads[0].anchor.endUtf16=4;
  const after=await parsed(buildDocxReviewPacketBuffer({...source,commentExport:moved}));
  assert.equal(after[0].quotedAnchorText,before[0].quotedAnchorText);
  assert.equal(compareCommentExportReadback(source.commentExport,after).ok,false);
  // Alter an actual OOXML part and repack with the production ZIP container;
  // the semantic parser must reject it even though CRCs and ZIP sizes agree.
  const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
  for (const mutate of [
    s=>s.replace(/<w:commentReference w:id="0"\/>/u,''),
    s=>s.replace('<w:commentRangeStart w:id="0"/>','<w:commentRangeStart xmlns:f="urn:foreign" f:id="0"/>'),
  ]) {
    const xml=parts(bytes);xml['word/document.xml']=mutate(xml['word/document.xml']);
    const changed=await parsed(buildStoredZip(Object.entries(xml).map(([name,data])=>({name,data}))));
    assert.equal(compareCommentExportReadback(source.commentExport,changed).ok,false);
  }
});

test('native Word package requirements include exact MIME types and a reference for every reply', () => {
  const source=makeSource(inputs()), xml=parts(buildDocxReviewPacketBuffer(source));
  for(const suffix of ['comments','commentsExtended','commentsIds','commentsExtensible']) {
    assert.ok(xml['[Content_Types].xml'].includes('application/vnd.openxmlformats-officedocument.wordprocessingml.'+suffix+'+xml'));
  }
  const ids=[...xml['word/document.xml'].matchAll(/<w:commentReference w:id="(\d+)"\/>/gu)].map(m=>m[1]);
  assert.deepEqual(ids,source.commentExport.threads[0].messages.map(m=>m.commentId));
});

test('authenticated new root and reply save, reopen and reexport without losing metadata or exact range', async () => {
  const runtime=await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const input=inputs();input.projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'yalken-comment-loop-'));
  const source=makeSource(input), threads=await parsed(buildDocxReviewPacketBuffer(source));
  const authority=makeSource({...input,nonTextReturnState:undefined}).localAuthorityCapsule;
  const block=authority.exportMap.scenes[0].blocks[0],thread=threads[0];
  const planInput={authenticated:true,projectId:input.projectId,projectRoot:input.projectRoot,
    returnArtifactId:'sha256:word-return',localAuthorityCapsule:authority,
    reviewIr:{commentThreads:threads,commentPlacements:[{threadId:thread.threadId,sourceCommentId:thread.commentId,targetScope:{id:input.scenes[0].sceneId},
      quote:thread.quotedAnchorText,sceneAuthority:{blockId:block.blockId,paragraphIndex:0}}]}};
  const plan=runtime.buildAuthenticatedCommentReturnCommands(planInput);
  assert.equal(plan.ok,true,JSON.stringify(plan));assert.equal(plan.commands.length,2);
  assert.equal(plan.commands[0].payload.anchor.canonicalRange.startUtf16,7);
  const rootHandler=runtime.createRtkRootCommentReturnCommandHandler();
  const replyHandler=runtime.createRtkCommentLifecycleReturnCommandHandler();
  for(const command of plan.commands) {
    const handler=command.family==='root_comment'?rootHandler:replyHandler;
    assert.equal((await handler(command.payload)).status,'applied');
    assert.equal((await handler(command.payload)).status,'replay');
  }
  const state=await runtime.createRtkNonTextReturnFilePort().readCanonical(input);
  assert.deepEqual(state.threads[0].messages.map(m=>m.provenance),input.nonTextReturnState.threads[0].messages.map(m=>m.provenance));
  const reexport=makeSource({...input,nonTextReturnState:state});
  const returned=await parsed(buildDocxReviewPacketBuffer(reexport));
  const noOp=runtime.buildAuthenticatedCommentReturnCommands({...planInput,localAuthorityCapsule:reexport.localAuthorityCapsule,
    reviewIr:{commentThreads:returned},returnArtifactId:'sha256:second-word-save'});
  assert.equal(noOp.ok,true);assert.deepEqual(noOp.commands,[]);
  const tampered=structuredClone(planInput);tampered.reviewIr.commentThreads[0].finalTextAnchorRange.startUtf16+=1;
  const denied=runtime.buildAuthenticatedCommentReturnCommands(tampered);
  assert.equal(denied.ok,false);assert.deepEqual(denied.commands,[]);
  assert.equal(denied.typedBlocked[0].code,'RTK_COMMENT_CANONICAL_RANGE_MISMATCH');
});

function mainHarness(names, globals={}) {
  const vm=require('node:vm');
  const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const helpers=['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort','normalizeRtkSignedSha256',
    'buildFullManuscriptProvisionalSelfParse','docxReviewReturnIntakeProductBudgets','decodeDocxCustomPropertyText',
    'extractDocxCustomPropertyValue','extractDocxReviewReturnYrtk2PropertiesFromCustomXml',
    'extractDocxReviewReturnYrtk2PropertiesFromParserResult','verifyDocxReviewReturnYrtk2Binding'];
  const declarations=[...new Set([...helpers,...names])].map(name=>{
    const match=main.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}(?=\\n|$)'));
    assert.ok(match,name);return match[0];
  });
  const ctx=vm.createContext({crypto,Buffer,path,
    isPlainObjectValue:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),
    docxReviewPreviewSessionDetailString:v=>typeof v==='string'?v:'',
    sha256DocxReviewPreviewSessionBytes:sha,cloneJsonSafe:v=>JSON.parse(JSON.stringify(v)),
    docxReviewReturnIntakeBlocked:code=>({ok:false,code}),
    ...require('../../src/export/docx/docxReviewPacketComments.js'),
    ...require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js'),
    ...globals});
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n\}\);/u)[0]
    +'\n'+declarations.join('\n'),ctx);
  return ctx;
}

test('production double self-parse gate rejects lost comments in provisional and final DOCX', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const ctx=mainHarness(['buildFullManuscriptPublicationGate']);
  const source=makeSource(inputs(),{revisionBridge:bridge,cryptoPort:ctx.createRtkReviewTransportCryptoPort()});
  const good=await ctx.buildFullManuscriptPublicationGate(source,buildDocxReviewPacketBuffer(source),bridge);
  assert.equal(good.publishAllowed,true,JSON.stringify(good));assert.equal(good.commentProofs.length,2);
  const changedProjection=structuredClone(source.commentExport);
  changedProjection.threads[0].messages.pop();
  const changedBytes=buildDocxReviewPacketBuffer({...source,commentExport:changedProjection});
  const final=await ctx.buildFullManuscriptPublicationGate(source,changedBytes,bridge);
  assert.equal(final.publishAllowed,false);assert.equal(final.code,'RTK_V4_PUBLICATION_COMMENT_FINAL_MISMATCH');
  const modified={...source,advisoryManifest:structuredClone(source.advisoryManifest),
    provisionalSelfParseArtifact:{...source.provisionalSelfParseArtifact,bytes:changedBytes}};
  modified.advisoryManifest.coreManifest.artifactIdentities.provisionalDocxSha256='sha256:'+sha(changedBytes);
  const provisional=await ctx.buildFullManuscriptPublicationGate(modified,buildDocxReviewPacketBuffer(source),bridge);
  assert.equal(provisional.publishAllowed,false);assert.equal(provisional.code,'RTK_V4_PUBLICATION_COMMENT_PROVISIONAL_MISMATCH');
});

test('production unchanged return revalidates canonical state and reports complete comment loss before commands', async () => {
  const runtime=await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const input=inputs(),source=makeSource(input),threads=await parsed(buildDocxReviewPacketBuffer(source));
  let state=structuredClone(input.nonTextReturnState),dispatches=0;
  const ctx=mainHarness(['applyAuthenticatedDocxCommentProductPath'],{
    activeStage10ApplicationBootstrap:{generation:1},getProjectRootPath:()=>input.projectRoot,
    dispatchCommandSurfaceKernel:()=>{dispatches++;throw Error('must not dispatch');},
  });
  const args={context:{projectId:input.projectId,projectRoot:input.projectRoot,
    reviewTransportReturnIntake:{authenticated:true,returnedArtifactSha256:'sha256:return'},
    reviewTransportAuthorityCapsule:source.localAuthorityCapsule},
    commentShadowPayload:{reviewIr:{commentThreads:threads},sceneAuthorityIdentityJoin:{ok:true,nativeCommentIdentityJoin:true,
      unjoinedPlacementCount:0,quoteHeuristicUsed:false,arbitraryThreadIdSuffixParsingUsed:false}},
    revisionBridge:{...runtime,createRtkNonTextReturnFilePort:()=>({readCanonical:async()=>state})}};
  const noOp=await ctx.applyAuthenticatedDocxCommentProductPath(args);
  assert.equal(noOp.status,'unchanged');assert.equal(noOp.writerCalled,false);assert.equal(dispatches,0);
  state.revision++;
  assert.equal((await ctx.applyAuthenticatedDocxCommentProductPath(args)).code,'RTK_COMMENT_REEXPORT_CANONICAL_STATE_STALE');
  state=structuredClone(input.nonTextReturnState);
  args.commentShadowPayload.reviewIr.commentThreads=[];
  args.commentShadowPayload.sceneAuthorityIdentityJoin={ok:false};
  const missing=await ctx.applyAuthenticatedDocxCommentProductPath(args);
  assert.equal(missing.ok,false);assert.equal(missing.typedBlocked[0].code,'COMMENT_ROOT_MISSING');assert.equal(dispatches,0);
});

test('actual export handler revalidates inside queue and refuses missing comment proof before any write', async () => {
  const {runDocxReviewPacketExport}=require('../../src/export/docx/docxReviewPacketExportHandler.js');
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),ctx=mainHarness(['buildFullManuscriptPublicationGate']);
  const source=makeSource(inputs(),{revisionBridge:bridge,cryptoPort:ctx.createRtkReviewTransportCryptoPort()});
  const bytes=buildDocxReviewPacketBuffer(source),gate=await ctx.buildFullManuscriptPublicationGate(source,bytes,bridge);
  for(const mode of ['stale-in-queue','missing-proof','empty-proof','failed-proof','missing-revalidator','normal']){
    let inQueue=false,writes=0,checks=0;const pg=structuredClone(gate);
    if(mode==='missing-proof')delete pg.commentProofs;
    if(mode==='empty-proof')pg.commentProofs=[];
    if(mode==='failed-proof')pg.commentProofs[0].ok=false;
    const deps={normalizeExportPayload:v=>v,makeTypedReviewDocxExportError:(code,reason,details)=>({ok:false,code,reason,details}),
      resolveDocxReviewPacketExportPath:async()=>'/owned/test.docx',validateDocxExportTarget:async()=>({ok:true}),
      readDocxReviewPacketExportSource:async()=>source,buildDocxReviewPacketBuffer:async()=>({documentBuffer:bytes,publicationGate:pg}),
      queueDiskOperation:async fn=>{inQueue=true;return fn();},writeBufferAtomic:async()=>{assert.equal(inQueue,true);writes++;},updateStatus:()=>{}};
    if(mode!=='missing-revalidator')deps.revalidateDocxReviewPacketExportSource=async value=>{
      assert.equal(inQueue,true);assert.equal(value,source);checks++;if(mode==='stale-in-queue')throw Error('DOCX_COMMENT_STATE_STALE');};
    const result=await runDocxReviewPacketExport({requestId:'unit'},deps);
    assert.equal(result.ok,mode==='normal',JSON.stringify(result));
    assert.equal(writes,mode==='normal'?1:0);
    if(mode==='normal')assert.deepEqual(result.exportCapsule.commentSummary,{stateRevision:2,exportedThreadCount:1,exportedMessageCount:2,intentionalDeletionCount:0});
    if(mode==='stale-in-queue'||mode==='normal')assert.equal(checks,1);
  }
});

test('production publication revalidation rejects changed scenes, canonical comments and project lifecycle', async () => {
  const input=inputs(),source=makeSource(input);
  const owner={generation:1};source.publicationOwner=owner;
  const expected=source.localAuthorityCapsule.exportMap.scenes[0];
  const expectedMetadata=source.localAuthorityCapsule.documentMetadata.protectedProperties;
  let state=input.nonTextReturnState,raw=input.scenes[0].text;
  // The input fixture used plain text as its saved observable bytes.
  assert.equal(expected.rawSha256,'sha256:'+sha(raw));
  const ctx=mainHarness(['revalidateFullManuscriptDocxReviewPacketExportSource'],{
    isDirty:false,autoSaveInProgress:false,activeStage10ApplicationBootstrap:owner,getProjectRootPath:()=>input.projectRoot,
    buildFullManuscriptDocxReviewExportScope:async()=>({projectId:input.projectId,projectRoot:input.projectRoot,
      projectName:expectedMetadata.title,projectCreatedAtUtc:expectedMetadata.createdAtUtc,
      sceneCandidates:[{sceneId:input.scenes[0].sceneId}]}),
    readFullManuscriptDocxReviewExportDocumentContent:async()=>({observableContent:raw}),
    verifyDocxMediaAssetFiles:require('../../src/utils/docxImportSafeCreate.js').verifyDocxMediaAssetFiles,
    loadRevisionBridgeModule:async()=>({createRtkNonTextReturnFilePort:()=>({readCanonical:async()=>state})}),
  });
  await ctx.revalidateFullManuscriptDocxReviewPacketExportSource(source);
  raw+=' changed';await assert.rejects(()=>ctx.revalidateFullManuscriptDocxReviewPacketExportSource(source),/SCENE_STALE/);
  raw=input.scenes[0].text;state={...state,revision:state.revision+1};
  await assert.rejects(()=>ctx.revalidateFullManuscriptDocxReviewPacketExportSource(source),/COMMENT_STATE_STALE/);
  ctx.activeStage10ApplicationBootstrap={generation:2};
  await assert.rejects(()=>ctx.revalidateFullManuscriptDocxReviewPacketExportSource(source),/SOURCE_STALE/);
});

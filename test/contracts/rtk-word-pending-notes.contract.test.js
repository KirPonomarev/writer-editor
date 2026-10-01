'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
const delta = require('../../src/core/word-note-return-delta-v1.cjs');
const builder = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const d = (...content) => ({ type: 'doc', content });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const sceneId = 'roman/scene.txt', projectId = 'project-test';
const revision = (from, to, operation = 'delete') => ({ id: 'revision-1', nativeId: '51', operation,
  author: 'Reviewer', date: '', dateUtc: '', paragraphIndex: 0, from, to, state: 'pending', groupId: null });
const ledger = (source, revisions) => ({ schemaVersion: 2, source, revisions, undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
function notesFor(doc, offsets) {
  const raw = envelope.composeObservablePayload({ doc });
  return { schemaVersion: 1, projectId, notes: offsets.map((offsetUtf16, i) => ({ id: 'note-' + i, title: '', scope: 'manuscript', body: 'Body 😀',
    manuscript: notes.bindManuscriptPayload({ kind: i % 2 ? 'endnote' : 'footnote', body: d(p('Body 😀')), sceneId, offsetUtf16, sceneContent: raw }) })) };
}
async function sourceHarness(raw, notesDocument, changes = {}) {
  const file = path.join(__dirname, 'rtk-word-c2-rich-scene-reexport.contract.test.js');
  const text = fs.readFileSync(file, 'utf8').split('\nfunction doc(paragraphs)')[0] + '\nmodule.exports={harness};';
  const mod = { exports: {} }; new Function('require', 'module', '__dirname', text)(createRequire(file), mod, __dirname);
  const h = await mod.exports.harness(raw, { notesDocument, ...changes });
  const mainPath = require.resolve('../../src/main.js'), main = fs.readFileSync(mainPath, 'utf8');
  h.context.require = createRequire(mainPath);
  for (const name of ['scenePendingExportSemantics', 'buildSceneNoteReviewPublicationGate', 'docxReviewReturnIntakeProductBudgets'])
    vm.runInContext(main.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n}(?=\\n|$)'))[0], h.context);
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0], h.context);
  return h;
}
async function decode(bytes, source, h) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes, hmacSecret: source.forbiddenSecret,
    expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort: h.context.createRtkReviewTransportCryptoPort() });
  assert.equal(analysis.ok, true, JSON.stringify(analysis.reasons));
  assert.equal(analysis.authorityCarrier.status, 'verified-baseline-bound');
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { bridge, analysis, preview, doc: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc };
}
test('source points distinguish both deletion boundaries across round undo, decisions, restart and Core note cohort', () => {
  const original = d(p('AxxB')), beforeNotes = notesFor(original, [1, 3]);
  const points = beforeNotes.notes.map((n, i) => ({ noteId: n.id, paragraphIndex: 0, offsetUtf16: [1, 3][i] }));
  const before = pending.bindNoteSourcePoints(original, points);
  const incoming = pending.bindNoteSourcePoints(pending.bindLedger(ledger(original, [revision(1, 3)])), points);
  let doc = pending.replaceFromReturn(before, incoming, { roundId: 'round-a', artifactSha256: 'a'.repeat(64) }).doc;
  let previous = original, state = beforeNotes;
  const observe = expected => {
    const beforeContent = envelope.composeObservablePayload({ doc: previous }), afterContent = envelope.composeObservablePayload({ doc });
    const cohort = notes.planManuscriptNoteAnchorSave({ beforeText: JSON.stringify(state), projectId, sceneId, beforeContent, afterContent });
    if (cohort) { notes.validateNoteCohort(cohort, { projectId, sceneId, beforeContent, afterContent }); state = JSON.parse(cohort.afterText); }
    assert.deepEqual(state.notes.map(n => n.manuscript.reference.offsetUtf16), expected);
    assert.deepEqual(state.notes.map(n => n.manuscript.body), beforeNotes.notes.map(n => n.manuscript.body));
    doc = envelope.parseObservablePayload(afterContent).doc; pending.readLedger(doc); previous = doc;
  };
  observe([1,1]);
  for (const [action, expected] of [['rejectAll',[1,3]],['undo',[1,1]],['acceptAll',[1,1]],['undo',[1,1]],['undo',[1,3]],['redo',[1,1]]]) {
    doc = pending.decide(doc, { action }).doc; observe(expected);
  }
  assert.throws(() => pending.bindNoteSourcePoints(incoming, [{ noteId:'bad', paragraphIndex:0, offsetUtf16:2 }]), /REFERENCE_CONSUMED/);
  assert.throws(() => require('../../src/core/word-pending-recording-v1.cjs').prepare(doc), /RECORDING_NOTE_BINDINGS_UNSUPPORTED/);
});

test('actual single-scene producer, signed Word parser, unchanged-note admission and publication preserve distinct collapsed references', async () => {
  const before = d(p('AxxB')), document = notesFor(before, [1,3]);
  const raw = envelope.composeObservablePayload({ doc: before }), h = await sourceHarness(raw, document), source = await h.run();
  const original = builder.buildDocxReviewPacketBuffer(source), bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: original }).parts;
  const match = /<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>xx<\/w:t><\/w:r>/u;
  assert.match(parts['word/document.xml'], match);
  parts['word/document.xml'] = parts['word/document.xml'].replace(match, '<w:del w:id="51" w:author="Reviewer"><w:r><w:delText>xx</w:delText></w:r></w:del>');
  const bytes = buildStoredZip(Object.entries(parts).map(([name,data]) => ({ name,data })));
  const parsed = await decode(bytes, source, h);
  assert.deepEqual(parsed.preview.contentPreview.pendingNoteReferences.map(n => n.offsetUtf16), [1,3]);
  const bound = delta.bindUnchangedPendingNotes({ document, projectId, sceneId, baseline: source.documentNotes,
    exportMap: source.localAuthorityCapsule.exportMap, beforeDoc: before, returnedDoc: parsed.doc,
    returnedNotes: bridge.parseDocumentNotesRichReturn(bytes, parsed.analysis.reviewIr.documentNotes),
    unionReferences: parsed.preview.contentPreview.pendingNoteReferences });
  const after = pending.replaceFromReturn(bound.beforeDoc, bound.returnedDoc, { roundId: source.exportCapsule.roundId, artifactSha256: hash(bytes) }).doc;
  const afterRaw = envelope.composeObservablePayload({ doc: after });
  const cohort = notes.planManuscriptNoteAnchorSave({ beforeText: JSON.stringify(document), projectId, sceneId, beforeContent: raw, afterContent: afterRaw });
  const updated = JSON.parse(cohort.afterText);
  assert.deepEqual(updated.notes.map(n => n.manuscript.reference.offsetUtf16), [1,1]);
  for (const action of [null, 'rejectAll', 'acceptAll']) {
    const current = action ? pending.decide(after, { action }).doc : after;
    const currentRaw = envelope.composeObservablePayload({ doc: current });
    const next = notes.planManuscriptNoteAnchorSave({ beforeText: JSON.stringify(updated), projectId, sceneId, beforeContent: afterRaw, afterContent: currentRaw });
    const n = next ? JSON.parse(next.afterText) : updated;
    const output = await sourceHarness(currentRaw, n), exported = await output.run(), outputBytes = builder.buildDocxReviewPacketBuffer(exported);
    const reread = await decode(outputBytes, exported, output);
    const gate = await output.context.buildSceneNoteReviewPublicationGate(exported, outputBytes, bridge);
    assert.equal(gate.publishAllowed, true);
    assert.equal((bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:outputBytes}).parts['word/document.xml'].match(/<w:del\b/gu)||[]).length, action ? 0 : 1);
    assert.equal(reread.preview.contentPreview.manuscriptNotes.length, 2);
  }
});

async function runtimeFixture(t, insertion = false) {
  const file = path.join(__dirname, 'rtk-word-pending-return-runtime.contract.test.js');
  const text = fs.readFileSync(file, 'utf8').split("\ntest('actual authenticated")[0] + '\nmodule.exports={harness};';
  const mod = { exports: {} }; new Function('require', 'module', '__dirname', text)(createRequire(file), mod, __dirname);
  const h = await mod.exports.harness(t, { clean:true }), root = path.dirname(path.dirname(h.file));
  const before = d(p('AxxB')), document = notesFor(before, [1,3]);
  document.notes.forEach(n => { n.manuscript.reference.sceneId = 'roman/a.txt'; });
  const raw = envelope.composeObservablePayload({doc:before}); fs.writeFileSync(h.file, raw);
  const notePath = path.join(root,'notes.craftsman.json'), manifestPath = path.join(root,'project.json');
  fs.writeFileSync(notePath, JSON.stringify(document)); fs.writeFileSync(manifestPath, JSON.stringify({ projectId, revision:0 }));
  const oldContext = h.context;
  h.context = () => ({...oldContext(), projectId});
  Object.assign(h.c, {
    require:createRequire(require.resolve('../../src/main.js')),
    notesStateDigest:require('../../src/export/docx/docxReviewPacketNotes.js').notesStateDigest,
    readCommentAuthoringContext:async()=>h.context(),
    loadNotesStorageModule:async()=>({readNotesStorage:async()=>({ok:true,document:JSON.parse(fs.readFileSync(notePath,'utf8')),sourceExists:true,sourceText:fs.readFileSync(notePath,'utf8')})}),
  });
  const producer=await sourceHarness(raw, document, {currentFilePath:h.file,
    getProjectRelativeFilePath:()=> 'roman/a.txt',
    readReviewExactTextApplyProjectBinding:async()=>({ok:true,projectId,projectRoot:root,manifestPath})});
  const source=await producer.run(), bridge=await import('../../src/io/revisionBridge/index.mjs');
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:builder.buildDocxReviewPacketBuffer(source)}).parts;
  if (insertion) parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>A<\/w:t><\/w:r>/u,
    run=>'<w:ins w:id="51" w:author="Reviewer"><w:r><w:t>😀</w:t></w:r></w:ins>'+run);
  else parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>xx<\/w:t><\/w:r>/u,
    '<w:del w:id="51" w:author="Reviewer"><w:r><w:delText>xx</w:delText></w:r></w:del>');
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))), decoded=await decode(bytes,source,producer);
  h.input={...h.input,docxBytes:bytes,context:{projectId,projectRoot:root,
    reviewTransportAuthorityCapsule:{...source.localAuthorityCapsule,projectRoot:root,
      exportMapAuthority:'main-owned-active-export-authority-store-after-return-authentication',returnedArtifactExportMapAccepted:false},
    reviewTransportReturnIntake:{authenticated:true,returnedArtifactSha256:'sha256:'+hash(bytes),parserResult:decoded.analysis}}};
  h.c.createRtkReviewTransportCryptoPort=producer.context.createRtkReviewTransportCryptoPort;
  const tx=require('../../src/core/project-transaction-v1.cjs'), save=require('../../src/core/save-coordinator-v1.cjs');
  const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{
    assert.equal(fs.readFileSync(manifestPath,'utf8'),expectedText);
    await save.durableSaveTransaction({filePath:manifestPath,content:nextText,revision});
  };
  h.c.commitWriterProjectSnapshot=async(target,content,generation,profile,label,options)=>{
    if(h.race)h.race(); await options.beforeScenePublish();
    const beforeText=fs.readFileSync(notePath,'utf8'), expectedManifestContent=fs.readFileSync(manifestPath,'utf8');
    const revision=JSON.parse(expectedManifestContent).revision+1;
    const noteState=notes.planManuscriptNoteAnchorSave({beforeText,projectId,sceneId:'roman/a.txt',beforeContent:options.expectedSceneContent,afterContent:content});
    const request={scenePath:target,manifestPath,sceneContent:content,expectedSceneContent:options.expectedSceneContent,
      expectedManifestContent,manifestContent:JSON.stringify({projectId,revision}),revision,noteState,publishManifest};
    h.lastRequest=request;
    const adapter=h.failNotePublish?{...fs.promises,rename:async(a,b)=>{if(b===notePath)throw Error('INJECTED_NOTE_PUBLICATION_FAILURE');return fs.promises.rename(a,b);}}:fs.promises;
    await tx.commitProjectTransaction({...request,fsAdapter:adapter});h.writes++;
    return {success:true,projectTransaction:true};
  };
  h.command=(action,override={})=>h.c.dispatchMenuCommand('cmd.project.review.decidePendingRevision',{projectId,sceneId:'roman/a.txt',subjectId:'life:session',
    expectedSceneSha256:h.context().sceneSha256,action,...override},{route:'command.bus'});
  return Object.assign(h,{root,notePath,manifestPath,document,source,bytes,decoded,publishManifest,
    offsets:()=>JSON.parse(fs.readFileSync(notePath,'utf8')).notes.map(n=>n.manuscript.reference.offsetUtf16)});
}
test('authenticated Main preparation, Kernel and actual atomic scene/notes writer apply, restart, decide and replay together',async t=>{
  const h=await runtimeFixture(t);
  assert.equal((await h.prepare()).status,'preview-ready');assert.equal(h.writes,0);
  assert.equal((await h.prepared.apply()).ok,true);assert.deepEqual(h.offsets(),[1,1]);
  for(const [action,expected]of [['rejectAll',[1,3]],['undo',[1,1]],['acceptAll',[1,1]],['undo',[1,1]],['undo',[1,3]],['redo',[1,1]]]){
    const result=await h.command(action);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(h.offsets(),expected);
    const raw=fs.readFileSync(h.file,'utf8');pending.readLedger(envelope.parseObservablePayload(raw).doc);
  }
  const writes=h.writes;assert.equal((await h.prepare()).status,'replayed');assert.equal(h.writes,writes);
});
test('actual atomic writer rollback and stale note CAS never publish a partial pending-note cohort',async t=>{
  for(const failure of ['notePublication','staleNotes']){
    const h=await runtimeFixture(t), before=[h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8'));
    assert.equal((await h.prepare()).status,'preview-ready');
    if(failure==='notePublication')h.failNotePublish=true;
    else h.race=()=>{const n=JSON.parse(fs.readFileSync(h.notePath,'utf8'));n.notes[0].title='concurrent';fs.writeFileSync(h.notePath,JSON.stringify(n));};
    await assert.rejects(h.prepared.apply());assert.equal(h.writes,0);
    if(failure==='notePublication'){
      await require('../../src/core/project-transaction-v1.cjs').recoverProjectTransaction({scenePath:h.file,manifestPath:h.manifestPath,publishManifest:h.publishManifest});
      assert.deepEqual([h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8')),before);
    }else{assert.equal(fs.readFileSync(h.file,'utf8'),before[0]);assert.equal(fs.readFileSync(h.manifestPath,'utf8'),before[2]);}
  }
});

test('source-point projection preserves disjoint edits across nested, repeated, empty and Unicode leaves for every decision combination',()=>{
  const c=(...content)=>({type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content});
  const table=(...content)=>({type:'table',content:[{type:'tableRow',content}]});
  const source=d(p('pre CUT tail'),table(c(p(''),table(c(p('A xx NOTE yy 😀Z')),c(p('same'))),p('')),c(p('same'))),p(''));
  const revisions=[{...revision(4,8),paragraphIndex:0},
    {...revision(2,5,'insert'),paragraphIndex:2,id:'revision-2',nativeId:'52'},
    {...revision(10,13,'insert'),paragraphIndex:2,id:'revision-3',nativeId:'53'}];
  const points=[{noteId:'inner',paragraphIndex:2,offsetUtf16:7},{noteId:'empty',paragraphIndex:4,offsetUtf16:0},
    {noteId:'repeated',paragraphIndex:5,offsetUtf16:2},{noteId:'terminal',paragraphIndex:6,offsetUtf16:0}];
  for(const a of ['pending','accepted','rejected'])for(const b of ['pending','accepted','rejected'])for(const c of ['pending','accepted','rejected']){
    const input=ledger(source,revisions.map((r,i)=>({...r,state:[a,b,c][i]})));
    const doc=pending.bindNoteSourcePoints(pending.bindLedger(input),points);
    const decoded=envelope.parseObservablePayload(envelope.composeObservablePayload({doc}));assert.equal(decoded.issue,null);
    const projected=pending.noteProjection(decoded.doc);
    const prefix=a==='rejected'?'pre CUT tail':'pre tail', inner='A '+(b==='rejected'?'':'xx ')+'NOTE '+(c==='rejected'?'':'yy ')+'😀Z';
    const texts=[prefix,'',inner,'same','','same',''];
    assert.deepEqual(projected.map(p=>p.globalOffsetUtf16),[
      prefix.length+2+inner.indexOf('NOTE')+2,
      texts.slice(0,4).reduce((n,s)=>n+s.length+1,0),
      texts.slice(0,5).reduce((n,s)=>n+s.length+1,0)+2,
      texts.slice(0,6).reduce((n,s)=>n+s.length+1,0)]);
  }
  assert.throws(()=>pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('😀')),[])),[{noteId:'n',paragraphIndex:0,offsetUtf16:1}]),/BOUNDARY/);
  const value=pending.bindNoteSourcePoints(pending.bindLedger(ledger(source,revisions)),points);
  for(const mutate of [l=>l.noteSourcePoints.push({...l.noteSourcePoints[0]}),l=>l.noteSourcePoints[0].offsetUtf16=-1,
    l=>l.noteSourcePoints[0].paragraphIndex=100,l=>l.noteSourcePoints[0].authority=true,l=>l.noteSourcePoints=[],
    l=>l.noteSourcePoints[0].noteId='../authority',l=>l.noteSourcePoints[0].offsetUtf16=3]){
    const l=structuredClone(pending.readLedger(value));mutate(l);assert.throws(()=>pending.bindLedger(l),/PENDING_NOTE/);
  }
});

// Frozen N-1 declaration boundary from 3cc58101, before pending note points.
// The real reader reaches this check before canonicalizing a declared document.
function nMinusOneDecode(serializedDoc) {
  const fail=code=>{throw Object.assign(Error(code),{code});};
  const isDeclaration=value=>value && typeof value==='object' && !Array.isArray(value)
    && ['format','version','requiredFeatures'].some(key=>Object.hasOwn(value,key));
  const newline=serializedDoc.indexOf('\n'),firstLine=newline<0?serializedDoc:serializedDoc.slice(0,newline);
  let declaration;try{declaration=JSON.parse(firstLine);}catch{declaration=null;}
  if(!isDeclaration(declaration)){return JSON.parse(serializedDoc);}
  if(Object.keys(declaration).sort().join(',')!=='format,requiredFeatures,version')fail('DOC_BLOCK_FORMAT_DECLARATION_INVALID');
  if(declaration.format!=='yalken.scene-document'||declaration.version!==3)fail('DOC_BLOCK_FORMAT_UNSUPPORTED');
  if(!Array.isArray(declaration.requiredFeatures)||declaration.requiredFeatures.length!==1
    ||declaration.requiredFeatures[0]!=='word-user-bookmarks.v1')fail('DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
  return JSON.parse(serializedDoc.slice(newline+1));
}
test('new semantic envelope refuses N-1 readers, missing declaration and unknown future state without flattening',()=>{
  const doc=pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('AxxB')),[revision(1,3)])),[{noteId:'n',paragraphIndex:0,offsetUtf16:1}]);
  const raw=envelope.composeObservablePayload({doc}), body=raw.slice(raw.indexOf('\n')+1);
  assert.match(body,/"requiredFeatures":\["word-pending-note-points.v1"\]/u);
  assert.throws(()=>nMinusOneDecode(body),/REQUIRED_FEATURES_UNSUPPORTED/);
  assert.throws(()=>JSON.parse(body),SyntaxError,'older single JSON decoder also refuses the two-record payload');
  const missing=JSON.stringify(doc), malformed=[`[doc-v2 length=${missing.length}]\n${missing}`,
    raw.replace('word-pending-note-points.v1','word-pending-note-points.v9'),raw.replace('"schemaVersion": 3','"schemaVersion": 9')];
  for(const value of malformed){const parsed=envelope.parseObservablePayload(value);assert.ok(parsed.issue);assert.equal(parsed.doc,null);}
  for(const schemaVersion of [1,2]){
    const l=ledger(d(p('AxB')),[revision(1,2,'insert')]);l.schemaVersion=schemaVersion;
    if(schemaVersion===1){delete l.roundUndo;delete l.roundRedo;delete l.returnReceipts;}
    const original=pending.bindLedger(l), parsed=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:original}));
    assert.equal(parsed.issue,null);assert.deepEqual(pending.readLedger(parsed.doc),l);
  }
});

for(const mutation of ['body','kind','identity','missing','duplicate','insideRevision','namespace','referenceMove']){
  test(`authenticated pending-note return rejects ${mutation} with unchanged canonical bytes`,async t=>{
    const h=await runtimeFixture(t),before=[h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8'));
    const bridge=h.input.revisionBridge,parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:h.bytes}).parts;
    if(mutation==='body')parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace('Body','Changed');
    if(mutation==='identity')parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace(/_YALKEN_NOTE_[a-f0-9]{24}/u,'_YALKEN_NOTE_'+'a'.repeat(24));
    const marker=parts['word/document.xml'].match(/<w:r><w:rPr><w:rStyle w:val="FootnoteReference"\/><\/w:rPr><w:footnoteReference[^]*?<\/w:r>/u)[0];
    if(mutation==='kind')parts['word/document.xml']=parts['word/document.xml'].replace('<w:footnoteReference','<w:endnoteReference');
    if(mutation==='missing')parts['word/document.xml']=parts['word/document.xml'].replace(marker,'');
    if(mutation==='duplicate')parts['word/document.xml']=parts['word/document.xml'].replace(marker,marker+marker);
    if(mutation==='insideRevision')parts['word/document.xml']=parts['word/document.xml'].replace(marker,'').replace('<w:del w:id="51" w:author="Reviewer">','<w:del w:id="51" w:author="Reviewer">'+marker);
    if(mutation==='namespace')parts['word/document.xml']=parts['word/document.xml'].replace('<w:footnoteReference','<foreign:footnoteReference xmlns:foreign="urn:foreign"');
    if(mutation==='referenceMove')parts['word/document.xml']=parts['word/document.xml'].replace(marker,'').replace('</w:del>','</w:del>'+marker);
    const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
    h.input.docxBytes=bytes;h.input.context.reviewTransportReturnIntake.returnedArtifactSha256='sha256:'+hash(bytes);
    h.input.context.reviewTransportReturnIntake.parserResult=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:h.source.forbiddenSecret,
      expectedAuthority:h.source.localAuthorityCapsule.expectedAuthority},{cryptoPort:h.c.createRtkReviewTransportCryptoPort()});
    const result=await h.prepare();assert.notEqual(result?.ok,true,JSON.stringify(result));assert.equal(h.prepared,undefined);assert.equal(h.writes,0);
    assert.deepEqual([h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8')),before);
  });
}

test('native XML insertion before both existing note kinds remains reversible through actual Main and atomic writer',async t=>{
  const h=await runtimeFixture(t,true);const prepared=await h.prepare();assert.equal(prepared.status,'preview-ready',JSON.stringify(prepared));
  await h.prepared.apply();assert.deepEqual(h.offsets(),[3,5]);
  for(const [action,expected]of [['rejectAll',[1,3]],['undo',[3,5]],['acceptAll',[3,5]],['undo',[3,5]],['undo',[1,3]],['redo',[3,5]]]){
    const result=await h.command(action);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(h.offsets(),expected);
  }
});

test('two native disjoint insertions surrounding an unchanged note avoid contiguous-diff ambiguity and preserve rich nested note body',async()=>{
  const before=d(p('A NOTE Z')),document=notesFor(before,[4]);
  const c=(...content)=>({type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content});
  const table=(...content)=>({type:'table',content:[{type:'tableRow',content}]});
  document.notes[0].manuscript.body=d(table(c(p('outer'),table(c(p('inner'))),p(''))));
  document.notes[0].body=notes.validateNoteBody(document.notes[0].manuscript.body).text;
  const raw=envelope.composeObservablePayload({doc:before}),h=await sourceHarness(raw,document),source=await h.run();
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:builder.buildDocxReviewPacketBuffer(source)}).parts;
  parts['word/document.xml']=parts['word/document.xml'].replace(/<w:t(?: [^>]*)?>A NO<\/w:t>/u,
    '<w:t xml:space="preserve">A </w:t></w:r><w:ins w:id="51" w:author="Reviewer"><w:r><w:t xml:space="preserve">xx </w:t></w:r></w:ins><w:r><w:t>NO</w:t>')
    .replace(/<w:t(?: [^>]*)?>TE Z<\/w:t>/u,'<w:t xml:space="preserve">TE </w:t></w:r><w:ins w:id="52" w:author="Reviewer"><w:r><w:t xml:space="preserve">yy </w:t></w:r></w:ins><w:r><w:t>Z</w:t>');
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),parsed=await decode(bytes,source,h);
  assert.equal(pending.projection(parsed.doc).current,'A xx NOTE yy Z');
  assert.throws(()=>notes.mapPoint('A NOTE Z','A xx NOTE yy Z',4),/NOTE_REFERENCE_EDIT_CONFLICT/);
  const bound=delta.bindUnchangedPendingNotes({document,projectId,sceneId,baseline:source.documentNotes,exportMap:source.localAuthorityCapsule.exportMap,
    beforeDoc:before,returnedDoc:parsed.doc,returnedNotes:bridge.parseDocumentNotesRichReturn(bytes,parsed.analysis.reviewIr.documentNotes),unionReferences:parsed.preview.contentPreview.pendingNoteReferences});
  const after=pending.replaceFromReturn(bound.beforeDoc,bound.returnedDoc,{roundId:source.exportCapsule.roundId,artifactSha256:hash(bytes)}).doc;
  const cohort=notes.planManuscriptNoteAnchorSave({beforeText:JSON.stringify(document),projectId,sceneId,beforeContent:raw,afterContent:envelope.composeObservablePayload({doc:after})});
  assert.equal(JSON.parse(cohort.afterText).notes[0].manuscript.reference.offsetUtf16,7);
  assert.deepEqual(JSON.parse(cohort.afterText).notes[0].manuscript.body,document.notes[0].manuscript.body);
});

test('equal visible text with changed source occurrence commits the note cohort through actual Main and atomic writer',async t=>{
  const h=await runtimeFixture(t),bridge=h.input.revisionBridge;
  const beforeRaw=fs.readFileSync(h.file,'utf8'), parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:h.bytes}).parts;
  const marker=parts['word/document.xml'].match(/<w:r><w:rPr><w:rStyle w:val="EndnoteReference"\/><\/w:rPr><w:endnoteReference[^]*?<\/w:r>/u)[0];
  parts['word/document.xml']=parts['word/document.xml'].replace(marker,marker+'<w:ins w:id="52" w:author="Reviewer"><w:r><w:t>xx</w:t></w:r></w:ins>');
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  h.input.docxBytes=bytes;h.input.context.reviewTransportReturnIntake.returnedArtifactSha256='sha256:'+hash(bytes);
  h.input.context.reviewTransportReturnIntake.parserResult=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:h.source.forbiddenSecret,
    expectedAuthority:h.source.localAuthorityCapsule.expectedAuthority},{cryptoPort:h.c.createRtkReviewTransportCryptoPort()});
  const prepared=await h.prepare();assert.equal(prepared.status,'preview-ready',JSON.stringify(prepared));
  assert.equal(notes.sceneText(envelope.composeObservablePayload({doc:h.prepared.changes.after})),notes.sceneText(beforeRaw));
  await h.prepared.apply();assert.deepEqual(h.offsets(),[1,1]);assert.ok(h.lastRequest.noteState);
  for(const [action,expected]of [['undo',[1,3]],['redo',[1,1]],['rejectAll',[1,3]],['undo',[1,1]]]){
    const result=await h.command(action);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(h.offsets(),expected);
    assert.equal(notes.sceneText(fs.readFileSync(h.file,'utf8')),'AxxB');
    assert.deepEqual(JSON.parse(fs.readFileSync(h.notePath,'utf8')).notes.map(n=>n.manuscript.body),h.document.notes.map(n=>n.manuscript.body));
  }
});

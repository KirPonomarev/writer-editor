'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules=Promise.all([import('../../src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs'),
  import('../../src/renderer/documentContentEnvelope.mjs'),import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs')]);
const sceneId='roman/context.txt', first='https://example.invalid/first', second='https://example.invalid/second';
const text=(value,marks=[])=>({type:'text',text:value,...(marks.length?{marks}:{})});
const link=(value,href)=>text(value,[{type:'bold'},{type:'link',attrs:{href}}]);
function fixture({heading=0,repeated=true,next='изменено 😀 é',old='same'}={}) {
  const block={type:heading?'heading':'paragraph',...(heading?{attrs:{level:heading}}:{}),content:[
    text('before ',[{type:'italic'}]),link(old,first),text(' / '),link(repeated?old:'other',second),text(' after',[{type:'underline'}]),
  ]};
  const doc={type:'doc',content:[block]}, expected=structuredClone(doc);expected.content[0].content[1].text=next;
  const paragraphs=d=>buildFormatIrParagraphs({sceneId,text:d.content.map(p=>p.content.map(n=>n.text).join('')).join('\n'),doc:d});
  const returnedParagraphs=paragraphs(expected).map((p,i)=>({paragraphIndex:i,paragraphText:p.text,
    paragraphState:{},paragraphStructure:p.formatIr.paragraph,
    formattedRuns:p.formatIr.runs.map(r=>({from:r.from,to:r.to,text:r.text,
      inlineState:{...r.inline,...(r.preservedMarks.find(m=>m.type==='link')?{link:r.preservedMarks.find(m=>m.type==='link').attrs.href}:{})},unsupportedNames:[],invalidSupportedValue:false}))}));
  return {sceneId,doc,expected,baselineParagraphs:paragraphs(doc),returnedParagraphs,reviewIr:{}};
}
async function setup(t,f,change) {
  const [,e]=await modules,root=fs.mkdtempSync(path.join(os.tmpdir(),'word-link-context-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const scenePath=path.join(root,sceneId);fs.mkdirSync(path.dirname(scenePath));
  const before=e.composeObservablePayload({doc:f.doc,metaEnabled:false});fs.writeFileSync(scenePath,before);
  const input={projectRoot:root,projectSnapshot:{projectId:'context-project',baselineHash:'bound-baseline',scenes:[{sceneId,text:before}]},
    revisionSession:{projectId:'context-project',sessionId:'context-session',baselineHash:'bound-baseline',status:'open',reviewGraph:{textChanges:[change]}},
    reviewItems:[change],scenePath,scenePathBySceneId:{[sceneId]:scenePath}};
  return {input,scenePath,before};
}

for(const heading of [0,1,2,3,4,5,6]) test('label context: repeated label preserves whole rich graph at heading level '+heading,async t=>{
  const [m,e,w]=await modules,f=fixture({heading}),r=m.analyzeCleanLinkLabelReturn(f);assert.equal(r.ok,true,JSON.stringify(r));
  assert.equal(r.canWriteManuscript,false);assert.equal(r.change.match.quote,f.baselineParagraphs[0].text);
  assert.deepEqual(r.change.match.richReplacementRange,{from:7,to:11,expectedText:'same',replacementText:'изменено 😀 é'});
  const {input,scenePath}=await setup(t,f,r.change),applied=await w.applyExactTextBatchMinSafeWrite(input,{operationId:'op_context_level_'+heading});
  assert.equal(applied.applied,true,JSON.stringify(applied));const raw=fs.readFileSync(scenePath,'utf8');
  assert.deepEqual(e.parseObservablePayload(raw).doc,f.expected);
  const replay=await w.applyExactTextBatchMinSafeWrite(input,{operationId:'op_context_level_'+heading});
  assert.equal(replay.replay,true);assert.equal(fs.readFileSync(scenePath,'utf8'),raw);
});

for(const next of ['Xs ame','Xsame','sameX','saXme','s','😀','é','same same']) test('label context: exact inner replacement '+next,async t=>{
  const [m,e,w]=await modules,f=fixture({next}),r=m.analyzeCleanLinkLabelReturn(f);assert.equal(r.ok,true,JSON.stringify(r));
  const {input,scenePath}=await setup(t,f,r.change);const applied=await w.applyExactTextBatchMinSafeWrite(input);
  assert.equal(applied.applied,true,JSON.stringify(applied));assert.deepEqual(e.parseObservablePayload(fs.readFileSync(scenePath,'utf8')).doc,f.expected);
});

for(const fault of ['negative','fraction','past-end','empty','wrong-old','wrong-new','extra','null','surrogate','combining','wrong-occurrence']) {
  test('label context rejects forged range without writing: '+fault,async t=>{
    const [m,,w]=await modules,f=fixture({old:fault==='surrogate'?'😀':fault==='combining'?'é':'same'}),r=m.analyzeCleanLinkLabelReturn(f);
    assert.equal(r.ok,true,JSON.stringify(r));const {input,scenePath,before}=await setup(t,f,r.change),a=r.change.match.richReplacementRange;
    if(fault==='negative')a.from=-1;
    if(fault==='fraction')a.to+=0.5;
    if(fault==='past-end')a.to=100000;
    if(fault==='empty')a.to=a.from;
    if(fault==='wrong-old')a.expectedText='forged';
    if(fault==='wrong-new')a.replacementText='forged';
    if(fault==='extra')a.path='/untrusted';
    if(fault==='null')r.change.match.richReplacementRange=null;
    if(fault==='surrogate'||fault==='combining') {
      a.from++;a.expectedText=a.expectedText.slice(1);
      r.change.replacementText=r.change.match.quote.slice(0,a.from)+a.replacementText+r.change.match.quote.slice(a.to);
    }
    if(fault==='wrong-occurrence'){a.from+=7;a.to+=7;}
    const result=await w.applyExactTextBatchMinSafeWrite(input);assert.notEqual(result.applied,true,JSON.stringify(result));
    assert.equal(fs.readFileSync(scenePath,'utf8'),before);
    assert.equal(result.reasons[0].code,'REVISION_BRIDGE_EXACT_TEXT_RICH_CONTEXT_RANGE_INVALID');
  });
}

for(const fault of ['level','kind','bad-level','paragraph-level','target','style','neighbor','identical-paragraphs']) {
  test('label context rejects unrelated semantics: '+fault,async()=>{
    const [m]=await modules,f=fixture({heading:fault==='paragraph-level'?0:2});const p=f.returnedParagraphs[0];
    if(fault==='level')p.paragraphStructure.headingLevel=3;
    if(fault==='kind')p.paragraphStructure={nodeType:'paragraph'};
    if(fault==='bad-level')f.baselineParagraphs[0].formatIr.paragraph.headingLevel=0;
    if(fault==='paragraph-level')p.paragraphStructure.headingLevel=2;
    if(fault==='target')p.formattedRuns[1].inlineState.link=second;
    if(fault==='style')p.formattedRuns[1].inlineState.italic=true;
    if(fault==='neighbor')p.formattedRuns[0].text='BEFORE ';
    if(fault==='identical-paragraphs'){
      const unchanged=fixture({heading:2,next:'same'});f.baselineParagraphs.push(unchanged.baselineParagraphs[0]);f.returnedParagraphs.push(unchanged.returnedParagraphs[0]);
    }
    assert.equal(m.analyzeCleanLinkLabelReturn(f).ok,false);
  });
}

test('label context binds a selected paragraph while equal labels in another paragraph remain untouched',async t=>{
  const [m,e,w]=await modules,f=fixture({repeated:false});const extra={type:'paragraph',content:[text('different '),link('same',second)]};
  f.doc.content.push(extra);f.expected.content.push(structuredClone(extra));
  const extraIr=buildFormatIrParagraphs({sceneId,text:'different same',doc:{type:'doc',content:[extra]}})[0];
  f.baselineParagraphs.push(extraIr);f.returnedParagraphs.push({paragraphIndex:1,paragraphText:extraIr.text,paragraphState:{},paragraphStructure:{nodeType:'paragraph'},formattedRuns:extraIr.formatIr.runs.map(r=>({from:r.from,to:r.to,text:r.text,inlineState:{...r.inline,...(r.preservedMarks.length?{link:second}:{})}}))});
  const result=m.analyzeCleanLinkLabelReturn(f);assert.equal(result.ok,true,JSON.stringify(result));const {input,scenePath}=await setup(t,f,result.change);
  const applied=await w.applyExactTextBatchMinSafeWrite(input);assert.equal(applied.applied,true,JSON.stringify(applied));assert.deepEqual(e.parseObservablePayload(fs.readFileSync(scenePath,'utf8')).doc,f.expected);
});

test('label context validates CAS and publisher failure before accepting persistence',async t=>{
  const [m,,w]=await modules,f=fixture(),r=m.analyzeCleanLinkLabelReturn(f);const {input,scenePath,before}=await setup(t,f,r.change);
  const rejected=await w.applyExactTextBatchMinSafeWrite(input,{publishScene:async()=>{throw Object.assign(Error('rejected'),{code:'E_TEST_PUBLISH_REJECTED'});}});
  assert.notEqual(rejected.applied,true);assert.equal(fs.readFileSync(scenePath,'utf8'),before);
  fs.writeFileSync(scenePath,before+'local drift');const stale=await w.applyExactTextBatchMinSafeWrite(input);
  assert.notEqual(stale.applied,true);assert.equal(fs.readFileSync(scenePath,'utf8'),before+'local drift');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const bridge = import('../../src/io/revisionBridge/index.mjs');
function fixture({ numbering, relationship, body } = {}) {
  numbering ??= '<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>';
  relationship ??= `<Relationship Id="num" Type="${R}/numbering" Target="numbering.xml"/>`;
  body ??= '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Item</w:t></w:r></w:p>';
  return buildStoredZip([
    {name:'[Content_Types].xml',data:`<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`},
    {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="doc" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}">${relationship}</Relationships>`},
    {name:'word/document.xml',data:`<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`},
    {name:'word/numbering.xml',data:`<w:numbering xmlns:w="${W}">${numbering}</w:numbering>`},
  ]);
}
test('list pattern intake refuses numbering without owned main-document relationship', async () => {
  const api=await bridge;
  assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture()).ok,true);
  for(const relationship of ['',`<Relationship Id="num" Type="${R}/styles" Target="numbering.xml"/>`,`<Relationship Id="num" Type="${R}/numbering" Target="numbering.xml">ignored text</Relationship>`]) {
    const result=api.buildDocxContentPreviewFromZipBytes(fixture({relationship}));
    assert.equal(result.ok,false,JSON.stringify(result));
  }
});
test('list pattern intake refuses nested scalar and misplaced level definitions', async () => {
  const api=await bridge;
  for(const bad of ['<w:numFmt w:val="decimal"><w:lvlText w:val="%1)"/></w:numFmt>','<w:numFmt w:val="decimal">unexpected</w:numFmt>','<w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>']) {
    const numbering=`<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="3"/>${bad}<w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>`;
    assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture({numbering})).ok,false);
  }
});
test('literal templates preserve canonical numbering definitions and labels without text prefixes', async () => {
  const api=await bridge, envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const model=require('../../src/core/word-list-numbering-v1.cjs');
  for(const [template,label] of [['%1)','3)'],['Article %1','Article 3']]) {
    const numbering=`<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="${template}"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>`;
    const report=api.buildDocxContentPreviewFromZipBytes(fixture({numbering}));
    assert.equal(report.ok,true,JSON.stringify(report));
    assert.equal(report.diagnostics.some(d=>d.code.includes('LIST_NUMBERING')),false);
    const plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
    const document=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
    assert.equal(document.content[0].attrs.wordNumbering.levels[0].text,template);
    assert.equal(document.content[0].content[0].content[0].content[0].text,'Item');
    const state=model.resolveMarkers(document);
    assert.equal([...state.values()][0].items[0].label,label);
  }
});
test('list pattern scalar order and marker-only properties do not silently lose semantics', async () => {
  const api=await bridge;
  const wrap=level=>`<w:abstractNum w:abstractNumId="4">${level}</w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>`;
  const badOrder=wrap('<w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1)"/><w:lvlRestart w:val="0"/></w:lvl>');
  assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture({numbering:badOrder})).ok,false);
  const marker=wrap('<w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1)"/><w:rPr><w:b/></w:rPr></w:lvl>');
  const report=api.buildDocxContentPreviewFromZipBytes(fixture({numbering:marker}));
  assert.equal(report.ok,true);assert.ok(report.diagnostics.some(d=>d.code.includes('LIST_NUMBERING')));
  const plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.ok(plan.lossReport.items.some(d=>d.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'));
});
test('shared abstract counter lineage and first-use overrides match independent native Word labels', async () => {
  const api=await bridge, envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const model=require('../../src/core/word-list-numbering-v1.cjs');
  const abstract=id=>`<w:abstractNum w:abstractNumId="${id}"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1)"/></w:lvl></w:abstractNum>`;
  for(const [distinct,override,labels] of [[false,true,['3)','4)','9)','10)','11)','12)']],[false,false,['3)','4)','5)','6)','7)','8)']],[true,true,['3)','4)','9)','5)','10)','6)']]]) {
    const numbering=abstract(4)+(distinct?abstract(5):'')+`<w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num><w:num w:numId="8"><w:abstractNumId w:val="${distinct?5:4}"/>${override?'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="9"/></w:lvlOverride>':''}</w:num>`;
    const body=[7,7,8,7,8,7].map((id,i)=>`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr></w:pPr><w:r><w:t>Item ${i}</w:t></w:r></w:p>`).join('');
    const report=api.buildDocxContentPreviewFromZipBytes(fixture({numbering,body}));
    assert.equal(report.ok,true,JSON.stringify(report));
    const plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
    const doc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
    assert.deepEqual([...model.resolveMarkers(doc).values()].flatMap(entry=>entry.items.map(item=>item.label)),labels);
  }
});
test('authenticated definition return groups lineage and refuses reset or lineage substitution', async () => {
  const {analyzeListNumberingReturn}=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const {sha256Hex,hashCanonicalValue}=await import('../../src/core/browser-safe-hash.mjs');
  const levels=[{format:'1',start:3,text:'%1)',restartAfterLevel:null}];
  const changed=[{...levels[0],text:'Article %1'}];
  const scene={sceneId:'scene',sceneRevision:`sha256:${'a'.repeat(64)}`,rawSha256:`sha256:${'b'.repeat(64)}`,blocks:[]};
  const formattingParagraphs=[],paragraphs=[];
  for(let i=0;i<2;i++) {
    const wordNumbering={schemaVersion:1,instanceId:`instance-${i}`,lineageId:'shared',level:0,levels,...(i?{startOverrides:[{level:0,start:9}]}:{})};
    const formatIr={paragraph:{list:{kind:'ordered',level:0,type:'1',numId:`canonical-${i}`,wordNumbering}}};
    scene.blocks.push({blockId:`b${i}`,documentParagraphIndex:i,formatIr,canonicalTextSha256:`sha256:${sha256Hex(`Item ${i}`)}`,canonicalMarksSha256:`sha256:${hashCanonicalValue(formatIr)}`});
    formattingParagraphs.push({paragraphText:`Item ${i}`});
    paragraphs.push({textSha256:sha256Hex(`Item ${i}`),list:{numId:String(i+10),kind:'orderedList',level:0,type:'1',numberingLevels:changed,numberingLineageId:'raw-abstract-80',numberingStartOverrides:wordNumbering.startOverrides||[]}});
  }
  const input={exportMap:{scenes:[scene]},reviewIr:{formattingParagraphs,listNumbering:{schemaVersion:'yalken.word-list-numbering-proof.v1',paragraphs}},resolveBlock:p=>({ok:true,authority:{sceneId:'scene',blockId:`b${p.paragraphIndex}`}})};
  const result=analyzeListNumberingReturn(input);assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.operations.length,1);assert.deepEqual(result.operations[0].numbering,{instanceId:'instance-0',expectedLevels:levels,levels:changed});
  const original=structuredClone(paragraphs);
  for(const mutate of [rows=>rows[1].list.numberingStartOverrides=[],rows=>rows[1].list.numberingLineageId='other',rows=>rows[1].list.numId='10',rows=>rows[1].list.numberingLevels=levels,rows=>rows[0].list=null]) {
    input.reviewIr.listNumbering.paragraphs=structuredClone(original);mutate(input.reviewIr.listNumbering.paragraphs);
    assert.equal(analyzeListNumberingReturn(input).ok,false);
  }
  input.reviewIr.listNumbering.paragraphs=structuredClone(original);for(const row of input.reviewIr.listNumbering.paragraphs)row.list.numberingLevels=levels;
  assert.deepEqual(analyzeListNumberingReturn(input).operations,[]);
});
test('multilevel default ancestor restart and never restart preserve native visible labels', async () => {
  const api=await bridge, envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const model=require('../../src/core/word-list-numbering-v1.cjs');
  for(const [restart,labels] of [['',['3.','3.a.','3.b.','9.','9.a.','9.b.','10.','10.a.','11.','11.a.']],['<w:lvlRestart w:val="0"/>',['3.','3.a.','3.b.','9.','9.c.','9.d.','10.','10.e.','11.','11.f.']]]) {
    const numbering=`<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/>${restart}<w:lvlText w:val="%1.%2."/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num><w:num w:numId="8"><w:abstractNumId w:val="4"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="9"/></w:lvlOverride></w:num>`;
    const body=[[7,0],[7,1],[7,1],[8,0],[8,1],[8,1],[7,0],[7,1],[8,0],[8,1]].map(([id,level],i)=>`<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${id}"/></w:numPr></w:pPr><w:r><w:t>Item ${i}</w:t></w:r></w:p>`).join('');
    const report=api.buildDocxContentPreviewFromZipBytes(fixture({numbering,body}));assert.equal(report.ok,true,JSON.stringify(report));
    const plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
    const doc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc, markers=model.resolveMarkers(doc),actual=[];
    const visit=node=>{if(node.type==='orderedList'){node.content.forEach((item,i)=>{actual.push(markers.get(node).items[i].label);for(const child of item.content||[])visit(child);});}else for(const child of node.content||[])visit(child);};visit(doc);
    assert.deepEqual(actual,labels);
    const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
    const {buildDocxMinBuffer}=require('../../src/export/docx/docxMinBuilder.js');
    const exported=buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
    const exportedReport=api.buildDocxContentPreviewFromZipBytes(exported);assert.equal(exportedReport.ok,true,JSON.stringify(exportedReport));
    const exportedPlan=api.buildDocxImportPreviewPlanFromContentPreview(exportedReport);assert.equal(exportedPlan.ok,true,JSON.stringify(exportedPlan));
    const reopened=envelope.parseObservablePayload(exportedPlan.candidateCreatePlan.entries[0].content).doc;
    assert.deepEqual([...model.resolveMarkers(reopened).values()].flatMap(entry=>entry.items.map(item=>item.label)),[...markers.values()].flatMap(entry=>entry.items.map(item=>item.label)));
  }
});

test('Word-authored nondefault ancestor restart survives with explicit marker-layout normalization', async () => {
  const api=await bridge, envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const model=require('../../src/core/word-list-numbering-v1.cjs');
  const level2='<w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlRestart w:val="1"/><w:lvlText w:val="%3"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr><w:rPr><w:rFonts w:hint="default"/></w:rPr></w:lvl>';
  const numbering=`<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1.%2."/></w:lvl>${level2}</w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>`;
  const body=[0,1,2,2,1,2,0,2].map((level,i)=>`<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Item ${i}</w:t></w:r></w:p>`).join('');
  const report=api.buildDocxContentPreviewFromZipBytes(fixture({numbering,body}));assert.equal(report.ok,true,JSON.stringify(report));
  const plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
  assert.ok(plan.lossReport.items.some(item=>item.code==='DOCX_IMPORT_PREVIEW_LIST_MARKER_LAYOUT_NORMALIZED'));
  assert.ok(!plan.lossReport.items.some(item=>item.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'));
  const doc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc,markers=model.resolveMarkers(doc),labels=[];
  const visit=node=>{if(node.type==='orderedList')node.content.forEach((item,i)=>{labels.push(markers.get(node).items[i].label);for(const child of item.content)visit(child);});else for(const child of node.content||[])visit(child);};visit(doc);
  assert.deepEqual(labels,['3.','3.a.','1','2','3.b.','3','4.','1']);
  const nested=numbering.replace('<w:rFonts w:hint="default"/>','<w:rFonts w:hint="default"><w:b/></w:rFonts>');
  assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture({numbering:nested,body})).ok,false);
});

test('numbering root requires abstract definitions before concrete instances', async () => {
  const api=await bridge;
  const abstract=id=>`<w:abstractNum w:abstractNumId="${id}"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1)"/></w:lvl></w:abstractNum>`;
  const instance=(id,base)=>`<w:num w:numId="${id}"><w:abstractNumId w:val="${base}"/></w:num>`;
  assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture({numbering:abstract(4)+instance(7,4)+abstract(5)+instance(8,5)})).ok,false);
  assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture({numbering:abstract(4)+abstract(5)+instance(7,4)+instance(8,5)})).ok,true);
});
test('standard markers retain typed reset, skipped-level, override and Word alphabetic semantics across export', async () => {
  const api=await bridge,envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const model=require('../../src/core/word-list-numbering-v1.cjs');
  const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
  const {buildDocxMinBuffer}=require('../../src/export/docx/docxMinBuilder.js');
  const lvl=(level,format='decimal',start=1,restart='')=>`<w:lvl w:ilvl="${level}"><w:start w:val="${start}"/><w:numFmt w:val="${format}"/>${restart}<w:lvlText w:val="%${level+1}."/></w:lvl>`;
  const cases=[
    {levels:lvl(0)+lvl(1,'decimal',1,'<w:lvlRestart w:val="0"/>'),sequence:[0,1,0,1],labels:['1.','1.','2.','2.'],check:doc=>assert.equal(doc.content[0].attrs.wordNumbering.levels[1].restartAfterLevel,null)},
    {levels:lvl(0)+lvl(1)+lvl(2),sequence:[0,2,0,2],labels:['1.','1.','2.','1.'],check:doc=>assert.equal(doc.content[0].content[0].content[1].attrs.wordNumbering.level,2)},
    {levels:lvl(0),override:'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="8"/></w:lvlOverride>',sequence:[0,0],labels:['8.','9.'],check:doc=>assert.deepEqual(doc.content[0].attrs.wordNumbering.startOverrides,[{level:0,start:8}])},
    {levels:lvl(0,'lowerLetter',26),sequence:[0,0,0,0],labels:['z.','aa.','bb.','cc.'],check:doc=>assert.equal(doc.content[0].attrs.wordNumbering.levels[0].format,'a')},
  ];
  for(const entry of cases){
    const numbering=`<w:abstractNum w:abstractNumId="4">${entry.levels}</w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/>${entry.override||''}</w:num>`;
    const body=entry.sequence.map((level,i)=>`<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Item ${i}</w:t></w:r></w:p>`).join('');
    let bytes=fixture({numbering,body});
    for(let cycle=0;cycle<2;cycle++){
      const report=api.buildDocxContentPreviewFromZipBytes(bytes),plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
      assert.ok(!plan.lossReport.items.some(item=>item.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'));
      const doc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc,markers=model.resolveMarkers(doc),labels=[];
      entry.check(doc);
      const visit=node=>{if(node.type==='orderedList')node.content.forEach((item,i)=>{labels.push(markers.get(node).items[i].label);for(const child of item.content)visit(child);});else for(const child of node.content||[])visit(child);};visit(doc);assert.deepEqual(labels,entry.labels);
      bytes=buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
    }
  }
});

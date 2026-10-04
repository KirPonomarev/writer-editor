'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const bridge = import('../../src/io/revisionBridge/index.mjs');
const gridBody = grid => `<w:p><w:r><w:t>Grid content</w:t></w:r></w:p><w:sectPr>${grid}</w:sectPr>`;
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
test('inactive document grid preserves dormant signed values and presence instead of dropping the final default section', async () => {
  const api=await bridge, envelope=require('../../src/core/document-content-envelope-v1.cjs');
  for (const [xml,expected] of [
    ['<w:docGrid/>',{type:'default'}],
    ['<w:docGrid w:linePitch="360"/>',{type:'default',linePitch:360}],
    ['<w:docGrid w:type="default" w:linePitch="-1" w:charSpace="+0"/>',{type:'default',linePitch:-1,charSpace:0}],
    ['<w:docGrid w:linePitch="9007199254740991" w:charSpace="-4096"></w:docGrid>',{type:'default',linePitch:Number.MAX_SAFE_INTEGER,charSpace:-4096}],
  ]) {
    const report=api.buildDocxContentPreviewFromZipBytes(fixture({body:gridBody(xml)}));assert.equal(report.ok,true,JSON.stringify(report));
    const plan=api.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
    const payload=plan.candidateCreatePlan.entries[0].content,parsed=envelope.parseObservablePayload(payload);
    assert.equal(parsed.issue,null);assert.deepEqual(parsed.doc.attrs.wordSections.final.docGrid,expected);
    assert.ok(payload.includes('word-section-doc-grid.v1'));
  }
});
test('document grid never accepts active behavior malformed scalars foreign attributes or hidden content', async () => {
  const api=await bridge;
  for (const xml of [
    '<w:docGrid w:type="lines"/>','<w:docGrid w:type="linesAndChars"/>','<w:docGrid w:type="snapToChars"/>',
    '<w:docGrid w:type=""/>','<w:docGrid w:linePitch="1.5"/>','<w:docGrid w:charSpace="9007199254740992"/>',
    '<w:docGrid linePitch="360"/>','<w:docGrid xmlns:x="urn:foreign" x:linePitch="360"/>',
    '<w:docGrid><w:linePitch w:val="360"/></w:docGrid>','<w:docGrid>hidden</w:docGrid>',
    '<w:docGrid/><w:docGrid/>','<x:docGrid xmlns:x="urn:foreign"/>',
  ]) assert.equal(api.buildDocxContentPreviewFromZipBytes(fixture({body:gridBody(xml)})).ok,false,xml);
});
test('RTK inactive grid participates in protected section digest and malformed or active grids block', async () => {
  const api=await bridge,{parseReviewTransportPackageV2}=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const {stableJson}=await import('../../src/io/revisionBridge/reviewTransportCore.mjs'),crypto=require('node:crypto');
  const cryptoPort={sha256Text:text=>crypto.createHash('sha256').update(String(text)).digest('hex'),sha256Json:value=>'sha256:'+crypto.createHash('sha256').update(stableJson(value)).digest('hex'),byteLength:text=>Buffer.byteLength(String(text))};
  const parse=grid=>parseReviewTransportPackageV2({parts:api.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:fixture({body:gridBody(grid)})}).parts},{cryptoPort});
  const a=parse('<w:docGrid w:linePitch="360"/>'),b=parse('<w:docGrid w:type="default" w:linePitch="361"/>'),absent=parse('');
  assert.equal(a.ok,true,JSON.stringify(a));assert.equal(b.ok,true,JSON.stringify(b));
  assert.deepEqual(a.reviewIr.documentSections.protectedSections[0].properties.docGrid,{type:'default',linePitch:360});
  assert.equal(a.reviewIr.documentSections.protectedSections[0].carriers.docGrid,true);
  assert.notEqual(a.reviewIr.documentSections.protectedDigest,b.reviewIr.documentSections.protectedDigest);
  assert.notEqual(a.reviewIr.documentSections.protectedDigest,absent.reviewIr.documentSections.protectedDigest);
  for(const grid of ['<w:docGrid w:type="lines"/>','<w:docGrid w:linePitch="1.5"/>','<w:docGrid w:type=""/>','<w:docGrid>hidden</w:docGrid>','<w:docGrid><w:type/></w:docGrid>','<w:docGrid/><w:docGrid/>','<x:docGrid xmlns:x="urn:foreign"/>']) {
    const report=parse(grid);assert.equal(report.ok,false,grid);assert.ok(report.reasons.some(reason=>reason.code==='RTK_WORD_SECTIONS_MALFORMED_BLOCKED'),JSON.stringify(report));
  }
});
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
test('authenticated definition return groups lineage and binds reset removal while refusing lineage substitution', async () => {
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
  input.reviewIr.listNumbering.paragraphs=structuredClone(original);input.reviewIr.listNumbering.paragraphs[1].list.numberingStartOverrides=[];
  const resetRemoval=analyzeListNumberingReturn(input);assert.equal(resetRemoval.ok,true,JSON.stringify(resetRemoval));
  assert.deepEqual(resetRemoval.operations[0].numbering.instanceOverrides,[{instanceId:'instance-1',expectedStartOverrides:[{level:0,start:9}],startOverrides:[]}]);
  for(const mutate of [rows=>rows[1].list.numberingStartOverrides=[{level:0,start:-1}],rows=>rows[1].list.numberingLineageId='other',rows=>rows[1].list.numId='10',rows=>rows[1].list.numberingLevels=levels,rows=>rows[0].list=null]) {
    input.reviewIr.listNumbering.paragraphs=structuredClone(original);mutate(input.reviewIr.listNumbering.paragraphs);
    assert.equal(analyzeListNumberingReturn(input).ok,false);
  }
  input.reviewIr.listNumbering.paragraphs=structuredClone(original);for(const row of input.reviewIr.listNumbering.paragraphs)row.list.numberingLevels=levels;
  assert.deepEqual(analyzeListNumberingReturn(input).operations,[]);
  // Canonical identities are case-sensitive; emitted ordering must match Core,
  // independently of locale ordering of lower/uppercase identifiers.
  for(let i=0;i<2;i++) {
    const block=scene.blocks[i];block.formatIr.paragraph.list.wordNumbering.instanceId=i?'A':'a';
    block.canonicalMarksSha256=`sha256:${hashCanonicalValue(block.formatIr)}`;
    input.reviewIr.listNumbering.paragraphs[i].list.numberingStartOverrides=[{level:0,start:7+i}];
  }
  const multi=analyzeListNumberingReturn(input);assert.equal(multi.ok,true,JSON.stringify(multi));
  assert.deepEqual(multi.operations[0].numbering.instanceOverrides.map(row=>row.instanceId),['A','a']);
  assert.doesNotThrow(()=>require('../../src/core/word-list-numbering-v1.cjs').validateDefinitionChange(multi.operations[0].numbering));
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
  const formatting=plan.lossReport.items.find(item=>item.code==='DOCX_IMPORT_PREVIEW_LISTS_HEADINGS_AND_INLINE_MARKS');
  assert.match(formatting.message,/Supported list numbering, start values, nesting/);
  assert.match(formatting.message,/Unsupported properties and import limitations are listed separately/);
  assert.doesNotMatch(formatting.message,/List marker appearance.*not imported|fonts, colors and other formatting are not imported/);
  assert.equal(plan.lossReport.items.find(item=>item.code==='DOCX_IMPORT_PREVIEW_LIST_MARKER_LAYOUT_NORMALIZED').severity,'warning');
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

test('native Word suppressed explicit redundant restart is disclosed instead of inventing child labels', async () => {
  const api=await bridge;
  // Same level grammar as calibration-parent-child-reset-ordered.docx:
  // native Word showed no child labels for explicit 1 or 2 on ilvl1.
  for(const restart of [1,2]) {
    const numbering=`<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlRestart w:val="${restart}"/><w:lvlText w:val="%1.%2."/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>`;
    const body=[0,1,1,0,1].map((level,i)=>`<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Item ${i}</w:t></w:r></w:p>`).join('');
    const preview=api.buildDocxContentPreviewFromZipBytes(fixture({numbering,body}));assert.equal(preview.ok,true);
    for(const index of [1,2,4])assert.equal(preview.contentPreview.paragraphs[index].list,undefined);
    const plan=api.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));
    assert.ok(plan.lossReport.items.some(item=>item.code==='DOCX_IMPORT_PREVIEW_LIST_EXPLICIT_RESTART_UNSUPPORTED'));
    assert.ok(plan.lossReport.items.some(item=>item.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'));
    assert.deepEqual(preview.contentPreview.paragraphs.map(p=>p.text),['Item 0','Item 1','Item 2','Item 3','Item 4']);
  }
});
test('unused uniform review-export padding preserves exact legacy shape without discarding meaningful definitions', async () => {
  const api=await bridge,envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const levels=Array.from({length:9},(_,i)=>`<w:lvl w:ilvl="${i}"><w:start w:val="7"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%${i+1}."/></w:lvl>`).join('');
  const numbering=`<w:abstractNum w:abstractNumId="4">${levels}</w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>`;
  const parse=numbering=>{const preview=api.buildDocxContentPreviewFromZipBytes(fixture({numbering}));const plan=api.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;};
  assert.deepEqual(parse(numbering),{type:'doc',content:[{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Item'}]}]}]}]});
  // An unused customized future level is data, not uniform legacy padding.
  assert.equal(parse(numbering.replace('%9.','Future %9')).content[0].attrs.wordNumbering.levels[8].text,'Future %9');
});
test('legacy signed numbering equivalence rejects custom definitions, alpha divergence and merged lineage', async () => {
  const {legacyNumberingProofEquivalent,createLegacyNumberingProofComparator}=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const levels=Array.from({length:9},(_,i)=>({format:'1',start:7,text:`%${i+1}.`,restartAfterLevel:i?i-1:null}));
  const make=()=>({numId:'5',level:0,ordinal:7,numberingLineageId:'lineage',numberingLevels:structuredClone(levels),numberingStartOverrides:[],wordNumbering:{schemaVersion:1,instanceId:'instance',lineageId:'lineage',level:0,levels:structuredClone(levels)}});
  let list=make();assert.equal(legacyNumberingProofEquivalent(list,{start:7},[list]),true);
  for(const mutate of [x=>x.wordNumbering.levels[8].text='future %9',x=>x.wordNumbering.levels[1].restartAfterLevel=null,x=>x.wordNumbering.startOverrides=[{level:0,start:7}],x=>x.wordNumbering.levels[8].start=1,x=>x.wordNumbering.levels[8].format='I']) {
    list=make();mutate(list);assert.equal(legacyNumberingProofEquivalent(list,{start:7},[list]),false);
  }
  list=make();assert.equal(legacyNumberingProofEquivalent(list,{start:7},[list,{...list,numId:'6'}]),false);
  assert.equal(legacyNumberingProofEquivalent(list,{start:7},[list,{...list,level:1}]),false);
  const alpha=make();for(const entry of alpha.numberingLevels)entry.format='a';alpha.wordNumbering.levels=structuredClone(alpha.numberingLevels);alpha.ordinal=26;
  assert.equal(legacyNumberingProofEquivalent(alpha,{start:7,type:'a'},[alpha]),true);
  const beyond={...structuredClone(alpha),ordinal:28};const compare=createLegacyNumberingProofComparator([alpha,beyond]);
  assert.equal(compare(alpha,{start:7,type:'a'}),false);assert.equal(compare(beyond,{start:7,type:'a'}),false);
});
test('literal note alpha stays legacy only inside proven common range; custom and alpha28 notes remain explicit refusal', async () => {
  const api=await bridge;
  const bytes=(format,start,template)=>buildStoredZip([
    {name:'[Content_Types].xml',data:`<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`},
    {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="d" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}"><Relationship Id="n" Type="${R}/footnotes" Target="footnotes.xml"/><Relationship Id="l" Type="${R}/numbering" Target="numbering.xml"/></Relationships>`},
    {name:'word/document.xml',data:`<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Body</w:t><w:footnoteReference w:id="1"/></w:r></w:p></w:body></w:document>`},
    {name:'word/numbering.xml',data:`<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="${start}"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${template}"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num></w:numbering>`},
    {name:'word/footnotes.xml',data:`<w:footnotes xmlns:w="${W}"><w:footnote w:id="1">${['First','Second'].map((text,i)=>`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r>${i?'':'<w:footnoteRef/>'}<w:t>${text}</w:t></w:r></w:p>`).join('')}</w:footnote></w:footnotes>`},
  ]);
  const report=api.buildDocxContentPreviewFromZipBytes(bytes('lowerLetter',4,'%1.'));assert.equal(report.ok,true,JSON.stringify(report));
  assert.deepEqual(report.contentPreview.manuscriptNotes[0].body.content[0].attrs,{start:4,type:'a'});
  for(const values of [['lowerLetter',28,'%1.'],['decimal',4,'Article %1']]) {
    const unsupported=api.buildDocxContentPreviewFromZipBytes(bytes(...values));assert.equal(unsupported.ok,false,JSON.stringify(unsupported));
  }
});

async function continuationReturnFixture({nativeStyled=false,initialOverride=false,twoScenes=false}={}) {
  const io=await bridge, analyzer=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const {buildDocxReviewPacketBuffer,REVIEW_DOCX_TYPOGRAPHY_DEFAULTS}=require('../../src/export/docx/docxReviewPacketBuilder.js');
  const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const p=text=>({type:'paragraph',content:[{type:'text',text}]});
  const levels=[{format:'1',start:4,text:'Item %1)',restartAfterLevel:null},{format:'1',start:1,text:'%2.',restartAfterLevel:0}];
  const numbering=level=>({schemaVersion:1,instanceId:'items',level,levels,...(initialOverride?{startOverrides:[{level:0,start:4}]}:{})});
  const baselineDoc={type:'doc',content:[{type:'orderedList',attrs:{start:4,wordNumbering:numbering(0)},content:[
    {type:'listItem',content:[p('Authored first')]},{type:'listItem',content:[p('Authored second')]},
    {type:'listItem',content:[p('Authored third'),p(' Structural fourth'),
      {type:'orderedList',attrs:{start:1,wordNumbering:numbering(1)},content:[{type:'listItem',content:[p('Nested child')]}]},p('After child')]},
  ]}]};
  const {stableJson}=await import('../../src/io/revisionBridge/reviewTransportCore.mjs');
  const hash=s=>require('node:crypto').createHash('sha256').update(String(s)).digest('hex');
  const cryptoPort={sha256Text:hash,sha256Json:v=>'sha256:'+hash(stableJson(v)),byteLength:s=>Buffer.byteLength(String(s)),hmacSha256Json:(v,key)=>'hmac-sha256:'+require('node:crypto').createHmac('sha256',key).update(stableJson(v)).digest('hex'),hmacSha256Text:(v,key)=>'hmac-sha256:'+require('node:crypto').createHmac('sha256',key).update(String(v)).digest('hex')};
  if(nativeStyled)baselineDoc.content[0].content[0].content[0].content=[
    {type:'text',text:'Authored',marks:[{type:'textStyle',attrs:{fontFamily:'Aptos',fontSize:'12pt',color:null}}]},
    {type:'text',text:' first',marks:[{type:'textStyle',attrs:{fontFamily:'Aptos',fontSize:'12pt',color:''}}]},
  ];
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'continuation',projectRoot:'/synthetic',scenes:(twoScenes?['a.txt','b.txt']:['a.txt']).map((sceneId,order)=>({sceneId,scenePath:'/synthetic/'+sceneId,order,doc:baselineDoc,text:envelope.deriveVisibleTextFromDocument(baselineDoc),observableContent:envelope.composeObservablePayload({doc:baselineDoc})}))},{cryptoPort,createdAtUtc:'2026-10-04T10:00:00.000Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'synthetic-test-key-only'});
  const original=buildDocxReviewPacketBuffer(source),exportMap=io.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap,original);
  const parts=io.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original}).parts;
  const parse=(xml,overrides={})=>{const result=io.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildStoredZip(Object.entries({...parts,...overrides,'word/document.xml':xml}).map(([name,data])=>({name,data})))},{cryptoPort});assert.equal(result.ok,true,JSON.stringify(result));return result.reviewIr;};
  const input=reviewIr=>({baselineDoc,sceneId:'a.txt',exportMap,reviewIr,ordinaryTextMode:true,exportTypography:REVIEW_DOCX_TYPOGRAPHY_DEFAULTS});
  return {analyzer,baselineDoc,exportMap,parts,parse,input,cryptoPort};
}
test('authenticated list continuation accepts a Word paragraph-tail edit after its transport bookmark without creating an item',async()=>{
  const f=await continuationReturnFixture();
  const rows=f.exportMap.scenes[0].blocks;
  assert.deepEqual(rows.map(b=>b.formatIr.paragraph.list.continuation===true),[false,false,false,true,false,true]);
  const xml=f.parts['word/document.xml'].replace(/(>After child<\/w:t><\/w:r><w:bookmarkEnd[^>]*\/>)/u,'$1<w:r><w:t xml:space="preserve"> native-grid-09</w:t></w:r>');
  assert.notEqual(xml,f.parts['word/document.xml']);
  const reviewIr=f.parse(xml);
  assert.deepEqual(reviewIr.listNumbering.paragraphs.map(p=>p.list?.ordinal??null),[4,5,6,null,1,null]);
  const result=f.analyzer.analyzeUserBookmarksReturn(f.input(reviewIr));
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.canWriteManuscript,false);
  assert.equal(result.ordinaryTextChanges.length,1);assert.equal(result.ordinaryTextChanges[0].sceneParagraphIndex,5);
  assert.equal(result.ordinaryTextChanges[0].replacementText,'After child native-grid-09');
  assert.equal(result.doc.content[0].content.length,3);
  assert.equal(result.doc.content[0].content[2].content[3].content[0].text,'After child native-grid-09');
  assert.deepEqual(result.doc.content[0].content[2].content[2],f.baselineDoc.content[0].content[2].content[2]);
});
test('authenticated continuation rejects ordinary marker removal new marker foreign ownership and forged private flags',async()=>{
  const f=await continuationReturnFixture(),original=f.parts['word/document.xml'];
  const removed=original.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/u,'');
  assert.notEqual(removed,original);
  assert.equal(f.analyzer.analyzeUserBookmarksReturn(f.input(f.parse(removed))).ok,false);
  const ir=f.parse(original), list=ir.listNumbering.paragraphs[2].list;
  for(const mutate of [
    value=>{value.reviewIr.listNumbering.paragraphs[3].list=structuredClone(list);},
    value=>{value.exportMap.scenes[0].blocks[0].formatIr.paragraph.list.continuation=true;},
    value=>{value.exportMap.scenes[0].blocks[3].formatIr.paragraph.list.itemOrdinal=0;},
    value=>{value.exportMap.scenes[0].blocks[3].formatIr.paragraph.list.continuation=false;},
    value=>{value.reviewIr.formattingParagraphs[3].bookmarkNames=[];},
  ]) {const value=structuredClone(f.input(ir));mutate(value);assert.equal(f.analyzer.analyzeUserBookmarksReturn(value).ok,false);}
});
test('authenticated numbering-definition route preserves continuation ownership and never treats it as marker removal permission',async()=>{
  const f=await continuationReturnFixture(),reviewIr=f.parse(f.parts['word/document.xml']);
  const input={exportMap:f.exportMap,reviewIr,resolveBlock:p=>({ok:true,authority:{sceneId:'a.txt',blockId:f.exportMap.scenes[0].blocks[p.paragraphIndex].blockId}})};
  const unchanged=f.analyzer.analyzeListNumberingReturn(input);assert.equal(unchanged.ok,true,JSON.stringify(unchanged));assert.deepEqual(unchanged.operations,[]);
  const clone=()=>({...input,exportMap:structuredClone(input.exportMap),reviewIr:structuredClone(input.reviewIr)});
  for(const mutate of [
    v=>{v.reviewIr.listNumbering.paragraphs[0].list=null;},
    v=>{v.reviewIr.listNumbering.paragraphs[3].list=structuredClone(v.reviewIr.listNumbering.paragraphs[2].list);},
    v=>{v.exportMap.scenes[0].blocks[3].formatIr.paragraph.list.itemOrdinal=0;},
  ]) {const value=clone();mutate(value);assert.equal(f.analyzer.analyzeListNumberingReturn(value).ok,false);}
  const changed=clone();for(const p of changed.reviewIr.listNumbering.paragraphs)if(p.list)p.list.numberingLevels[0].text='Chapter %1';
  const result=f.analyzer.analyzeListNumberingReturn(changed);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.operations.length,1);
});

function nativeWordDefaultStyles(parts,{language=true}={}) {
  // Literal defaults observed in Word-saved PACKAGED-10, not exporter output.
  const defaults='<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/>'
    +(language?'<w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/>':'')
    +'</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>';
  const styles=parts['word/styles.xml'].replace(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/u,defaults);
  assert.notEqual(styles,parts['word/styles.xml']);return {'word/styles.xml':styles};
}
test('native Word defaults plus a continuation tail produce private lossless spacing font and language composition',async()=>{
  const f=await continuationReturnFixture(),io=await bridge;
  const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs'),bookmarks=require('../../src/core/word-user-bookmarks-v1.cjs');
  const xml=f.parts['word/document.xml'].replace(/(>After child<\/w:t><\/w:r><w:bookmarkEnd[^>]*\/>)/u,'$1<w:r><w:t xml:space="preserve"> native-continuation-10</w:t></w:r>');
  const ir=f.parse(xml,nativeWordDefaultStyles(f.parts));
  const result=f.analyzer.analyzeUserBookmarksReturn(f.input(ir));assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.ordinaryTextChanges.length,6,'language is independently retained on unchanged paragraphs');
  assert.ok(result.ordinaryFormattingOperations.length>=12);
  const formatted=runtime.applyFormattingOperationsToObservableContent(envelope.composeObservablePayload({doc:result.doc}),result.ordinaryFormattingOperations);
  assert.equal(formatted.ok,true,JSON.stringify(formatted));
  for(const p of bookmarks.paragraphs(formatted.doc)){
    assert.deepEqual(p.attrs.wordParagraphSpacing,{after:160,line:278,lineRule:'auto'});
    assert.deepEqual(p.attrs.wordParagraphMarkLanguage,{val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'});
    for(const node of p.content)if(node.type==='text'){
      const style=node.marks.find(mark=>mark.type==='textStyle').attrs;
      assert.equal(style.fontFamily,'Times New Roman');assert.deepEqual(style.wordLanguage,{val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'});
    }
  }
  assert.equal(bookmarks.textOf(bookmarks.paragraphs(formatted.doc).at(-1)),'After child native-continuation-10');
  assert.equal(formatted.doc.content[0].content.length,3);
  const partial=structuredClone(ir);delete partial.formattingParagraphs[5].formattedRuns[0].resolvedFontFamily;
  assert.equal(f.analyzer.analyzeUserBookmarksReturn(f.input(partial)).detail,'ordinary-text-font-profile-incomplete');
  const invalid=structuredClone(ir);invalid.formattingParagraphs[0].paragraphState.wordParagraphSpacing.line=-1;
  assert.equal(f.analyzer.analyzeUserBookmarksReturn(f.input(invalid)).ok,false);
  const forged=structuredClone(ir);forged.formattingParagraphs[0].bookmarkNames=[];
  assert.equal(f.analyzer.analyzeUserBookmarksReturn(f.input(forged)).ok,false);
});
test('metadata-only Word inherited font materializes through the existing explicit formatting lane',async()=>{
  const f=await continuationReturnFixture(),io=await bridge;
  const ir=f.parse(f.parts['word/document.xml'],nativeWordDefaultStyles(f.parts,{language:false}));
  const clean=f.analyzer.analyzeUserBookmarksReturn(f.input(ir));assert.equal(clean.ok,true,JSON.stringify(clean));
  assert.equal(clean.ordinaryTextChanges,undefined,'no fabricated text or language edits');
  const result=io.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:ir},{fullManuscriptExportMap:f.exportMap,cryptoPort:f.cryptoPort});
  assert.equal(result.ok,true,JSON.stringify(result));
  const fonts=result.candidates.filter(op=>op.inline?.fontFamily?.value==='Times New Roman');
  assert.equal(new Set(fonts.map(op=>op.paragraphOrdinal)).size,6,JSON.stringify(result));
});
test('font no-op is proved on final replacement coverage without splitting preserved native textStyle leaves',async()=>{
  const f=await continuationReturnFixture({nativeStyled:true});
  const xml=f.parts['word/document.xml'].replace(/(> first<\/w:t><\/w:r>)(<w:bookmarkEnd)/u,'$1<w:r><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos" w:cs="Aptos"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve"> CLEAN_EDIT</w:t></w:r>$2');
  assert.notEqual(xml,f.parts['word/document.xml']);
  const result=f.analyzer.analyzeUserBookmarksReturn(f.input(f.parse(xml)));
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.ordinaryFormattingOperations.filter(op=>op.inline.fontFamily).length,0);
  const expected=structuredClone(f.baselineDoc);expected.content[0].content[0].content[0].content[1].text+=' CLEAN_EDIT';
  assert.deepEqual(result.doc,expected,'same font must not split distinct null/empty style leaves or coalesce them');
});

test('Word start edit preserves canonical instance authority while atomically changing level start and removing concrete override',async()=>{
  const f=await continuationReturnFixture({initialOverride:true}),io=await bridge;
  const original=f.parts['word/numbering.xml'];
  const numbering=original.replace('<w:start w:val="4"/>','<w:start w:val="7"/>')
    .replace('<w:lvlOverride w:ilvl="0"><w:startOverride w:val="4"/></w:lvlOverride>','');
  assert.notEqual(numbering,original);assert(!numbering.includes('<w:startOverride'));
  const ir=f.parse(f.parts['word/document.xml'],{'word/numbering.xml':numbering});
  const result=io.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:ir},{fullManuscriptExportMap:f.exportMap,cryptoPort:f.cryptoPort});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.diagnostics.length,0);
  const operation=result.candidates.find(op=>op.kind==='list-numbering');assert.ok(operation);
  assert.equal(operation.numbering.expectedLevels[0].start,4);assert.equal(operation.numbering.levels[0].start,7);
  assert.deepEqual(operation.numbering.instanceOverrides,[{instanceId:'items',expectedStartOverrides:[{level:0,start:4}],startOverrides:[]}]);
  const resolveBlock=p=>({ok:true,authority:{sceneId:'a.txt',blockId:f.exportMap.scenes[0].blocks[p.paragraphIndex].blockId}});
  for(const mutate of [
    rows=>{rows[1].list.numberingStartOverrides=[{level:0,start:9}];},
    rows=>{rows[1].list.numberingStartOverrides=[{level:0,start:7},{level:0,start:8}];},
    rows=>{rows[1].list.numberingStartOverrides=[{level:2,start:7}];},
    rows=>{rows[1].list.numberingLineageId='foreign';},
    rows=>{rows[1].list.numId='2147483647';},
  ]){const changed=structuredClone(ir);mutate(changed.listNumbering.paragraphs);
    assert.equal(f.analyzer.analyzeListNumberingReturn({exportMap:f.exportMap,reviewIr:changed,resolveBlock}).ok,false);}
});

test('authenticated text and numbering composition retains original source authority and classifies its exact consumed plan',async()=>{
  const f=await continuationReturnFixture({initialOverride:true}),io=await bridge;
  const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const xml=f.parts['word/document.xml'].replace(/(>After child<\/w:t><\/w:r><w:bookmarkEnd[^>]*\/>)/u,'$1<w:r><w:t xml:space="preserve"> native-composite14</w:t></w:r>');
  const numbering=f.parts['word/numbering.xml'].replace('<w:start w:val="4"/>','<w:start w:val="7"/>')
    .replace('<w:lvlOverride w:ilvl="0"><w:startOverride w:val="4"/></w:lvlOverride>','');
  const original=structuredClone(f.exportMap),baseline=structuredClone(f.baselineDoc);
  for(const changed of [false,true]){
    const ir=f.parse(xml,{...(changed?{'word/numbering.xml':numbering}:{}),
      'word/settings.xml':f.parts['word/settings.xml'].replace(/<w:defaultTabStop[^>]*\/>/u,'').replace('</w:settings>','<w:defaultTabStop w:val="708"/></w:settings>')});
    const analysis=f.analyzer.analyzeUserBookmarksReturn(f.input(ir));assert.equal(analysis.ok,true,JSON.stringify(analysis));
    assert.equal(analysis.ordinaryTextChanges.length,1);
    const operations=analysis.ordinaryFormattingOperations;
    assert.equal(operations.filter(op=>op.kind==='list-numbering').length,changed?1:0);
    let doc=analysis.doc;
    if(operations.length){const applied=runtime.applyFormattingOperationsToObservableContent(envelope.composeObservablePayload({doc}),operations);
      assert.equal(applied.ok,true,JSON.stringify(applied));doc=applied.doc;}
    assert.equal(doc.content[0].attrs.start,changed?7:4);
    assert.equal(doc.attrs.wordDefaultTabStop,708);
    assert.equal(operations.filter(op=>op.kind==='document-properties').length,1);
    assert.equal(doc.content[0].content[2].content.at(-1).content[0].text,'After child native-composite14');
    const consumed={'a.txt':{operations,paragraphsDigest:analysis.ordinaryFormattingConsumption.paragraphsDigest}};
    const classify=value=>io.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:ir},
      {fullManuscriptExportMap:f.exportMap,cryptoPort:f.cryptoPort,consumedCleanFormattingBySceneId:value});
    const classified=classify(consumed);assert.equal(classified.ok,true,JSON.stringify(classified));
    assert.deepEqual(classified.diagnostics,[]);assert.deepEqual(classified.candidates,[]);
    assert.equal(classified.code,'RTK_FORMATTING_RETURN_NO_SAFE_CANDIDATES');assert.equal(classified.summary.candidateCount,0);
    const map=structuredClone(f.exportMap);map.scenes[0].documentFormatIr=[];
    const invalid=io.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:ir},{fullManuscriptExportMap:map,cryptoPort:f.cryptoPort,consumedCleanFormattingBySceneId:consumed});
    assert.equal(invalid.ok,false);assert.equal(invalid.reason,'consumed-document-source-invalid');
    assert.equal(classify({'a.txt':{...consumed['a.txt'],paragraphsDigest:'sha256:'+'0'.repeat(64)}}).ok,false);
    assert.equal(classify({foreign:consumed['a.txt']}).ok,false);
    if(changed)assert.equal(classify({'a.txt':{...consumed['a.txt'],operations:[]}}).ok,false);
    for(const mutate of [r=>r.listNumbering.paragraphs[0].list=null,
      r=>r.listNumbering.paragraphs[1].list.numId='2147483647',
      r=>{[r.formattingParagraphs[0],r.formattingParagraphs[1]]=[r.formattingParagraphs[1],r.formattingParagraphs[0]];},
      r=>r.listNumbering.paragraphs[0].list.ordinal=99]){
      const hostile=structuredClone(ir);mutate(hostile);assert.equal(f.analyzer.analyzeUserBookmarksReturn(f.input(hostile)).ok,false);
    }
  }
  assert.deepEqual(f.exportMap,original);assert.deepEqual(f.baselineDoc,baseline);
});

test('composite numbering proofs remain scene-local and leave other scene formatting independently available',async()=>{
  const f=await continuationReturnFixture({twoScenes:true}),io=await bridge;
  const xml=f.parts['word/document.xml'].replace(/(>After child<\/w:t><\/w:r><w:bookmarkEnd[^>]*\/>)/u,'$1<w:r><w:t xml:space="preserve"> composite</w:t></w:r>');
  const numbering=f.parts['word/numbering.xml'].replaceAll('<w:numFmt w:val="decimal"/>','<w:numFmt w:val="upperRoman"/>');
  const ir=f.parse(xml,{'word/numbering.xml':numbering});
  const a=f.analyzer.analyzeUserBookmarksReturn(f.input(ir));assert.equal(a.ok,true,JSON.stringify(a));
  const b=f.analyzer.analyzeUserBookmarksReturn({...f.input(ir),sceneId:'b.txt'});assert.equal(b.ok,true,JSON.stringify(b));
  assert.equal(a.ordinaryFormattingOperations.filter(op=>op.kind==='list-numbering').length,1);
  assert.equal(b.ordinaryTextChanges,undefined);
  const result=io.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:ir},{fullManuscriptExportMap:f.exportMap,cryptoPort:f.cryptoPort,
    consumedCleanFormattingBySceneId:{'a.txt':{operations:a.ordinaryFormattingOperations,paragraphsDigest:a.ordinaryFormattingConsumption.paragraphsDigest}}});
  assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.diagnostics,[]);
  assert.deepEqual(result.candidates.filter(op=>op.kind==='list-numbering').map(op=>op.sceneId),['b.txt']);
  const wrong=structuredClone(ir);wrong.listNumbering.paragraphs[6].list.ordinal=999;
  assert.equal(f.analyzer.analyzeUserBookmarksReturn({...f.input(wrong),sceneId:'b.txt'}).ok,false);
  const swapped=structuredClone(ir);swapped.formattingParagraphs[0].bookmarkNames=ir.formattingParagraphs[6].bookmarkNames;
  assert.equal(f.analyzer.analyzeUserBookmarksReturn(f.input(swapped)).ok,false);
});

test('document-property comparison keeps private source plain-record boundary',async()=>{
  const {documentPropertyReturnOperation}=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const scene={sceneId:'s',rawSha256:'sha256:'+'a'.repeat(64),sceneRevision:'sha256:'+'b'.repeat(64)};
  const properties={wordDefaultTabStop:720,explicit:false};
  for(const value of [Object.assign([],properties),Object.assign(Object.create({foreign:true}),properties)])
    assert.throws(()=>documentPropertyReturnOperation({...scene,documentFormatIr:value},{effective:708}),/SOURCE_INVALID/);
});

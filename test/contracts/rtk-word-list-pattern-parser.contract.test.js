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

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
const bodyModel=require('../../src/core/word-comment-body-v1.cjs');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P='http://schemas.openxmlformats.org/package/2006/relationships';
const C='http://schemas.openxmlformats.org/package/2006/content-types';
const W14='http://schemas.microsoft.com/office/word/2010/wordml';
const W15='http://schemas.microsoft.com/office/word/2012/wordml';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const ports={cryptoPort:{sha256Text:sha,sha256Json:x=>'sha256:'+sha(JSON.stringify(x)),byteLength:x=>Buffer.byteLength(x)}};
const bridge=import('../../src/io/revisionBridge/index.mjs');
function fixture(){return {
 '[Content_Types].xml':`<Types xmlns="${C}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>`,
 '_rels/.rels':`<Relationships xmlns="${P}"><Relationship Id="document" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
 'word/_rels/document.xml.rels':`<Relationships xmlns="${P}"><Relationship Id="comments" Type="${R}/comments" Target="comments.xml"/></Relationships>`,
 'word/document.xml':`<w:document xmlns:w="${W}"><w:body><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>anchor</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p></w:body></w:document>`,
 'word/comments.xml':`<w:comments xmlns:w="${W}" xmlns:w14="${W14}" xmlns:r="${R}"><w:comment w:id="0" w:author="Root"><w:p w14:paraId="10000001"><w:pPr><w:ind w:left="120"/><w:tabs><w:tab w:pos="800" w:val="right"/></w:tabs></w:pPr><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:strike/><w:color w:val="123456"/><w:highlight w:val="yellow"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/><w:lang w:val="ru-RU"/></w:rPr><w:t>Rich</w:t><w:tab/><w:t>root</w:t><w:br/><w:t>line</w:t></w:r></w:p><w:p w14:paraId="10000002"><w:hyperlink r:id="link"><w:r><w:t>label</w:t></w:r></w:hyperlink></w:p></w:comment><w:comment w:id="1" w:author="Reply"><w:p w14:paraId="10000003"><w:r><w:rPr><w:i/></w:rPr><w:t>reply</w:t></w:r></w:p></w:comment></w:comments>`,
 'word/_rels/comments.xml.rels':`<Relationships xmlns="${P}"><Relationship Id="link" Type="${R}/hyperlink" Target="https://example.org/comment" TargetMode="External"/></Relationships>`,
 'word/commentsExtended.xml':`<w15:commentsEx xmlns:w15="${W15}"><w15:commentEx w15:paraId="10000002"/><w15:commentEx w15:paraId="10000003" w15:paraIdParent="10000002"/></w15:commentsEx>`,
};}
const zip=parts=>buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
async function analyze(parts){return (await bridge).buildDocxReviewTransportAnalysisFromZipBytes({bytes:zip(parts)},ports);}
test('root and reply preserve all admitted inline properties, paragraph layout and exact final identity',async()=>{
 const result=await analyze(fixture());assert.equal(result.reviewIr?.commentBodyGrammar.status,'SUPPORTED',JSON.stringify(result));
 const root=result.reviewIr.commentThreads[0];assert.equal(root.replies.length,1);assert.equal(root.body,'Rich\troot\nline\nlabel');
 const paragraphs=root.richBody.document.content;assert.equal(paragraphs.length,2);
 assert.deepEqual(paragraphs[0].attrs.wordParagraphIndent,{left:120});assert.deepEqual(paragraphs[0].attrs.wordParagraphTabs,[{pos:800,val:'right'}]);
 const marks=paragraphs[0].content[0].marks;for(const type of ['bold','italic','underline','strike','highlight'])assert(marks.some(m=>m.type===type));
 assert.deepEqual(marks.find(m=>m.type==='textStyle').attrs,{color:'#123456',fontFamily:'Arial',fontSize:'12pt',wordLanguage:{val:'ru-RU'}});
 assert.equal(paragraphs[0].content[1].type,'hardBreak');
 assert.deepEqual(paragraphs[0].content[1].marks,paragraphs[0].content[0].marks);
 assert.equal(paragraphs[1].content[0].marks.find(m=>m.type==='link').attrs.href,'https://example.org/comment');
 assert(root.replies[0].richBody.document.content[0].content[0].marks.some(m=>m.type==='italic'));
 assert.equal(bodyModel.validateCommentMessageContent(root).body,root.body);
 const next=fixture();next['word/comments.xml']=next['word/comments.xml'].replace('<w:i/></w:rPr><w:t>reply','<w:b/></w:rPr><w:t>reply');
 const changed=await analyze(next);assert.equal(changed.reviewIr.commentThreads[0].replies[0].body,root.replies[0].body);
 assert.notEqual(changed.reviewIr.commentThreads[0].replies[0].bodyDigest,root.replies[0].bodyDigest);
});
for(const [label,mutate] of [
 ['table',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:t>Rich</w:t>','<w:tbl/>')],
 ['nested paragraph',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:t>Rich</w:t>','<w:p><w:r><w:t>hidden</w:t></w:r></w:p>')],
 ['field',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:t>Rich</w:t>','<w:fldChar w:fldCharType="begin"/>')],
 ['unrepresented text',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:t>Rich</w:t>','garbage<w:t>Rich</w:t>')],
 ['page break',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:br/>','<w:br w:type="page"/>')],
 ['wrong relationship owner',p=>{p['word/_rels/document.xml.rels']=p['word/_rels/comments.xml.rels'];delete p['word/_rels/comments.xml.rels'];}],
 ['relationship nested',p=>p['word/_rels/comments.xml.rels']=p['word/_rels/comments.xml.rels'].replace('/></Relationships>','><Relationship Id="inner" Type="'+R+'/hyperlink" Target="https://example.org" TargetMode="External"/></Relationship></Relationships>')],
 ['relationship raw text',p=>p['word/_rels/comments.xml.rels']=p['word/_rels/comments.xml.rels'].replace('/></Relationships>','>payload</Relationship></Relationships>')],
 ['relationship unknown attr',p=>p['word/_rels/comments.xml.rels']=p['word/_rels/comments.xml.rels'].replace('Id="link"','Id="link" Unknown="x"')],
 ['missing final paragraph ID',p=>p['word/comments.xml']=p['word/comments.xml'].replace(' w14:paraId="10000002"','')],
 ['earlier paragraph ID authority',p=>p['word/commentsExtended.xml']=p['word/commentsExtended.xml'].replaceAll('10000002','10000001')],
 ['duplicate paragraph ID',p=>p['word/comments.xml']=p['word/comments.xml'].replace('10000001','10000002')],
 ['rsid command',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:r>','<w:r w:rsidRPr="command">')],
 ['invalid complex-script boolean',p=>p['word/comments.xml']=p['word/comments.xml'].replace('<w:b/>','<w:b/><w:bCs w:val="garbage"/>')],
 ['empty font',p=>p['word/comments.xml']=p['word/comments.xml'].replace('w:ascii="Arial" w:hAnsi="Arial"','')],
])test(`comment grammar refuses ${label} before rich publication`,async()=>{
 const parts=fixture();mutate(parts);const result=await analyze(parts);
 assert(result.ok===false||result.reviewIr?.commentBodyGrammar.status==='UNSUPPORTED',JSON.stringify(result));
});
test('comment-level namespace declarations retain their scope after wrapper removal',async()=>{
 const parts=fixture();parts['word/comments.xml']=parts['word/comments.xml'].replace(` xmlns:r="${R}"`,'').replace('w:id="0" w:author','xmlns:r="'+R+'" w:id="0" w:author');
 const result=await analyze(parts);assert.equal(result.reviewIr?.commentBodyGrammar.status,'SUPPORTED',JSON.stringify(result));
 assert.equal(result.reviewIr.commentThreads[0].richBody.document.content[1].content[0].marks.find(m=>m.type==='link').attrs.href,'https://example.org/comment');
});
for(const target of ['file:///private/file','https://user:password@example.org/','javascript:alert(1)'])test(`comment relationship refuses unsafe target ${target}`,async()=>{
 const parts=fixture();parts['word/_rels/comments.xml.rels']=parts['word/_rels/comments.xml.rels'].replace('https://example.org/comment',target);
 const result=await analyze(parts);assert(result.ok===false||result.reviewIr?.commentBodyGrammar.status==='UNSUPPORTED',JSON.stringify(result));
});

// Break run properties affect the authored break, not only adjacent text.
test('formatting-only hard-break changes survive production parsing without changing text or peers',async()=>{
 const original=fixture();original['word/comments.xml']=original['word/comments.xml'].replace('<w:br/>','</w:r><w:r><w:br/></w:r><w:r>');
 const changed=structuredClone(original);changed['word/comments.xml']=changed['word/comments.xml'].replace('<w:r><w:br/></w:r>','<w:r><w:rPr><w:u w:val="single"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="28"/><w:lang w:val="ru-RU"/></w:rPr><w:br/></w:r>');
 const [a,b]=await Promise.all([analyze(original),analyze(changed)]);
 for(const r of[a,b])assert.equal(r.reviewIr?.commentBodyGrammar.status,'SUPPORTED',JSON.stringify(r.reviewIr?.commentBodyGrammar));
 const before=a.reviewIr.commentThreads[0],after=b.reviewIr.commentThreads[0];assert.equal(before.body,after.body);
 const pa=before.richBody.document.content,pb=after.richBody.document.content;
 assert.deepEqual(pa[0].content[0],pb[0].content[0]);assert.deepEqual(pa[0].content[2],pb[0].content[2]);assert.deepEqual(pa[1],pb[1]);
 assert.notDeepEqual(pa[0].content[1],pb[0].content[1]);assert(!bodyModel.commentBodyEqual(before,after));
 assert(pb[0].content[1].marks.some(m=>m.type==='underline'));
 assert.deepEqual(pb[0].content[1].marks.find(m=>m.type==='textStyle').attrs,{fontFamily:'Arial',fontSize:'14pt',wordLanguage:{val:'ru-RU'}});
});

// Supported semantic identity covers comment formatting, not only its literal
// projection. Equivalent OOXML spelling must retain that identity.
test('root formatting and marked-break changes bind supportedSemanticDigest while equivalent spelling is stable',async()=>{
 const original=fixture();
 const boldOff=structuredClone(original);boldOff['word/comments.xml']=boldOff['word/comments.xml'].replace('<w:b/>','<w:b w:val="0"/>');
 const sameMeaning=structuredClone(original);sameMeaning['word/comments.xml']=sameMeaning['word/comments.xml'].replace('<w:b/>','<w:b w:val="1"/>');
 const breakOnly=structuredClone(original);breakOnly['word/comments.xml']=breakOnly['word/comments.xml'].replace('<w:br/>','</w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:br/></w:r><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:strike/><w:color w:val="123456"/><w:highlight w:val="yellow"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/><w:lang w:val="ru-RU"/></w:rPr>');
 const [base,bold,breaks,equivalent,again]=await Promise.all([original,boldOff,breakOnly,sameMeaning,original].map(analyze));
 for(const result of[base,bold,breaks,equivalent,again])assert.equal(result.reviewIr?.commentBodyGrammar.status,'SUPPORTED',JSON.stringify(result.reviewIr?.commentBodyGrammar));
 const root=base.reviewIr.commentThreads[0];
 const semanticReplies=thread=>thread.replies.map(({sourceXmlProvenance,...semantic})=>semantic);
 const expectedReplyXml=original['word/comments.xml'].slice(original['word/comments.xml'].indexOf('<w:comment w:id="1"'),original['word/comments.xml'].indexOf('</w:comments>'));
 for(const [result,parts] of [[base,original],[bold,boldOff],[breaks,breakOnly],[equivalent,sameMeaning],[again,original]]){
  const thread=result.reviewIr.commentThreads[0];
  assert.deepEqual(semanticReplies(thread),semanticReplies(root));
  for(const reply of thread.replies){
   const provenance=reply.sourceXmlProvenance;
   const {openStart,closeEnd,...metadata}=provenance;
   const {openStart:baseStart,closeEnd:baseEnd,...baseMetadata}=root.replies.find(r=>r.rawId===reply.rawId).sourceXmlProvenance;
   assert.deepEqual(metadata,baseMetadata);
   assert.equal(provenance.partName,'word/comments.xml');assert.equal(provenance.elementName,'comment');assert.equal(provenance.namespaceUri,W);
   assert(Number.isSafeInteger(openStart)&&Number.isSafeInteger(closeEnd)&&openStart>=0&&closeEnd>openStart);
   const xml=parts[provenance.partName];
   assert.equal(openStart,xml.indexOf('<w:comment w:id="1"'));
   assert.equal(closeEnd,openStart+expectedReplyXml.length);
   assert.equal(xml.slice(openStart,closeEnd),expectedReplyXml);
   assert.equal(provenance.attributes.find(a=>a.namespaceUri===W&&a.localName==='id').value,reply.rawId);
  }
 }
 for(const result of[bold,breaks]){
  const changed=result.reviewIr.commentThreads[0];assert.equal(changed.body,root.body);
  assert.deepEqual(semanticReplies(changed),semanticReplies(root));
  assert.notDeepEqual(changed.richBody,root.richBody);
  assert.notEqual(result.supportedSemanticDigest,base.supportedSemanticDigest);
 }
 const a=root.richBody.document.content[0].content,b=breaks.reviewIr.commentThreads[0].richBody.document.content[0].content;
 assert.deepEqual(a[0],b[0]);assert.deepEqual(a[2],b[2]);assert.notDeepEqual(a[1],b[1]);
 assert.deepEqual(equivalent.reviewIr.commentThreads[0].richBody,root.richBody);
 assert.equal(equivalent.supportedSemanticDigest,base.supportedSemanticDigest);
 assert.equal(again.supportedSemanticDigest,base.supportedSemanticDigest);
});

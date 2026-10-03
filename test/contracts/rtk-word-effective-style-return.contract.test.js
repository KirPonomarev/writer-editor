'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const cryptoPort={sha256Text:x=>crypto.createHash('sha256').update(String(x)).digest('hex'),sha256Json:x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),byteLength:x=>Buffer.byteLength(String(x))};
const scanner=import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
const style=(id,type,body,extra='')=>`<w:style w:type="${type}" w:styleId="${id}" ${extra}>${body}</w:style>`;
async function scan(styles,pPr='<w:pStyle w:val="Derived"/>',rPr=''){
 return (await scanner).extractReviewTransportFormattingRunsV2(`<w:document xmlns:w="${W}"><w:body><w:p><w:pPr>${pPr}</w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t>Exact text</w:t></w:r></w:p></w:body></w:document>`,{cryptoPort,stylesXml:`<w:styles xmlns:w="${W}">${styles}</w:styles>`});
}
test('effective paragraph/character cascade resolves inherited values, toggles and direct resets',async()=>{
 const styles=style('Base','paragraph','<w:pPr><w:jc w:val="right"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:i/><w:color w:val="112233"/></w:rPr>')
 +style('Derived','paragraph','<w:basedOn w:val="Base"/><w:rPr><w:b/><w:i w:val="0"/></w:rPr>')
 +style('Char','character','<w:rPr><w:i/><w:u w:val="single"/></w:rPr>');
 const result=await scan(styles,undefined,'<w:rStyle w:val="Char"/>');assert.equal(result.ok,true);
 const p=result.paragraphs[0],r=p.formattedRuns[0];assert.deepEqual(p.paragraphState,{textAlign:'right'});assert.deepEqual(p.paragraphStructure,{nodeType:'heading',headingLevel:3});assert.deepEqual(p.unsupportedParagraphNames,[]);
 assert.equal(r.inline.bold.action,'set');assert.equal(r.inline.italic.action,'set');assert.equal(r.inline.underline.action,'set');assert.equal(r.inline.color.value,'#112233');assert.deepEqual(r.unsupportedNames,[]);
 const direct=await scan(styles,'<w:pStyle w:val="Derived"/><w:jc w:val="left"/><w:outlineLvl w:val="9"/>','<w:rStyle w:val="Char"/><w:b/><w:u w:val="none"/><w:color w:val="auto"/>');
 assert.deepEqual(direct.paragraphs[0].paragraphState,{textAlign:'left'});assert.deepEqual(direct.paragraphs[0].paragraphStructure,{nodeType:'paragraph'});
 assert.equal(direct.paragraphs[0].formattedRuns[0].inline.bold.action,'set');assert.equal(direct.paragraphs[0].formattedRuns[0].inline.underline.action,'remove');assert.equal(direct.paragraphs[0].formattedRuns[0].inline.color.action,'remove');
});
test('default style is active without pStyle and explicit style does not invent an implicit basedOn',async()=>{
 const styles='<w:docDefaults><w:pPrDefault><w:pPr><w:jc w:val="center"/></w:pPr></w:pPrDefault></w:docDefaults>'
 +style('Default','paragraph','<w:pPr><w:jc w:val="right"/></w:pPr>','w:default="1"')+style('Derived','paragraph','');
 assert.equal((await scan(styles,'')).paragraphs[0].paragraphState.textAlign,'right');
 assert.equal((await scan(styles)).paragraphs[0].paragraphState.textAlign,'center');
});
for(const extra of ['<w:spacing w:after="400"/>','<w:ind w:left="720"/>','<w:tabs><w:tab w:pos="720" w:val="left"/></w:tabs>'])test('unsupported inherited paragraph property remains non-applicable '+extra,async()=>{
 const result=await scan(style('Derived','paragraph',`<w:pPr><w:jc w:val="right"/>${extra}</w:pPr>`));
 assert.ok(!result.ok||result.paragraphs[0].unsupportedParagraphNames.length>0);
});
for(const styles of [style('Derived','paragraph','<w:basedOn w:val="Derived"/>'),style('Derived','paragraph','<w:basedOn w:val="Missing"/>'),style('Derived','character',''),style('Derived','paragraph','')+style('Derived','paragraph','')])test('unresolved active style graph remains non-applicable '+styles,async()=>{
 const result=await scan(styles);assert.ok(!result.ok||result.paragraphs[0].unsupportedParagraphNames.length>0);
});

test('Word paragraph false assigns off and resolved character style toggles once',async()=>{
 const styles=style('Base','paragraph','<w:rPr><w:b/><w:i/></w:rPr>')
 +style('Derived','paragraph','<w:basedOn w:val="Base"/><w:rPr><w:b w:val="0"/></w:rPr>')
 +style('CharBase','character','<w:rPr><w:i/></w:rPr>')
 +style('Char','character','<w:basedOn w:val="CharBase"/><w:rPr><w:i/><w:b w:val="0"/></w:rPr>');
 const run=(await scan(styles,undefined,'<w:rStyle w:val="Char"/>')).paragraphs[0].formattedRuns[0];
 assert.equal(run.inline.bold.action,'remove');assert.equal(run.inline.italic.action,'remove');
});
test('property shape checks use correct XML part offsets, and reject nested/foreign property semantics',async()=>{
 const styles=style('Derived','paragraph','<w:pPr><w:jc w:val="right"/></w:pPr>')+' '.repeat(2000)+style('Unused','paragraph','<w:rPr><w:b/></w:rPr>');
 const valid=await scan(styles,'<w:pStyle w:val="Derived"/><w:jc w:val="center"/>','<w:b/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>');
 assert.deepEqual(valid.paragraphs[0].unsupportedParagraphNames,[]);assert.deepEqual(valid.paragraphs[0].formattedRuns[0].unsupportedNames,[]);
 for(const [p,r] of [['<w:pStyle w:val="Derived"/><w:jc w:val="right"><w:spacing/></w:jc>',''],['<w:pStyle w:val="Derived"><w:b/></w:pStyle>',''],['<w:pStyle w:val="Derived"/>','<w:b><w:i/></w:b>'],['<w:pStyle w:val="Derived"/>','<w:b xmlns:x="urn:foreign" x:val="0"/>']]){
  const result=await scan(styles,p,r);assert.ok(!result.ok||result.paragraphs[0].unsupportedParagraphNames.length||result.paragraphs[0].formattedRuns[0].unsupportedNames.length);
 }
});
test('supported document defaults retain literal inline properties without style references',async()=>{
 const result=await scan('<w:docDefaults><w:rPrDefault><w:rPr><w:b/><w:color w:val="224466"/></w:rPr></w:rPrDefault></w:docDefaults>','');
 assert.equal(result.paragraphs[0].formattedRuns[0].inlineState.bold,true);assert.equal(result.paragraphs[0].formattedRuns[0].inlineState.color,'#224466');
});

test('unresolved default typography is non-applicable rather than silently erased',async()=>{
 for(const pr of ['<w:rFonts w:asciiTheme="majorAscii" w:hAnsiTheme="majorHAnsi"/>','<w:rFonts w:ascii="Arial" w:hAnsi="Courier New"/>','<w:sz w:val="bogus"/>']){
  const result=await scan(`<w:docDefaults><w:rPrDefault><w:rPr>${pr}</w:rPr></w:rPrDefault></w:docDefaults>`,'');
  const p=result.paragraphs[0],r=p?.formattedRuns[0];assert.ok(!result.ok||p.unsupportedParagraphNames.length||r.unsupportedNames.length||r.invalidSupportedValue);
 }
});
test('resolved hyperlink theme decoration keeps effective document-default bold',async()=>{
 const xml=`<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:hyperlink r:id="h"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>Link</w:t></w:r></w:hyperlink></w:p></w:body></w:document>`;
 const result=(await scanner).extractReviewTransportFormattingRunsV2(xml,{cryptoPort,
 stylesXml:`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:b/></w:rPr></w:rPrDefault></w:docDefaults>${style('Hyperlink','character','<w:rPr><w:color w:val="0000FF" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr>')}</w:styles>`,
 relationshipsXml:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="h" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/" TargetMode="External"/></Relationships>',
 themeXml:'<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="x"><a:hlink><a:srgbClr val="0000FF"/></a:hlink></a:clrScheme></a:themeElements></a:theme>'});
 assert.equal(result.ok,true);const r=result.paragraphs[0].formattedRuns[0];assert.deepEqual(r.unsupportedNames,[]);assert.equal(r.inlineState.bold,true);assert.equal(r.inlineState.color,'#0000ff');assert.equal(r.inlineState.underline,true);
});

test('partial font slot overrides retain inherited script slots and refuse mixed effective fonts',async()=>{
 const base=style('Base','paragraph','<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>');
 for(const font of ['Arial','Courier New']) {
  const styles=base+style('Derived','paragraph',`<w:basedOn w:val="Base"/><w:rPr><w:rFonts w:ascii="${font}"/></w:rPr>`);
  const run=(await scan(styles)).paragraphs[0].formattedRuns[0];
  assert.equal(run.invalidSupportedValue,font!=='Arial');
  if(font==='Arial')assert.equal(run.inline.fontFamily.value,'Arial');
  else assert.equal(run.inline.fontFamily,undefined);
 }
});

test('native Word character basedOn eight-case truth table resolves then toggles once',async()=>{
 const cases=[
  {p:false,c:null,d:null,expected:false}, {p:false,c:true,d:null,expected:true},
  {p:false,c:true,d:true,expected:true}, {p:false,c:true,d:false,expected:false},
  {p:true,c:true,d:null,expected:false}, {p:true,c:false,d:null,expected:true},
  {p:true,c:true,d:true,expected:false}, {p:true,c:true,d:true,direct:false,expected:false},
 ];
 // Exact eight native Word toolbar observations, including direct false.
 for(const row of cases){
  const styles=style('Derived','paragraph',`<w:rPr><w:i w:val="${Number(row.p)}"/></w:rPr>`)
   +(row.c===null?'':style('CharBase','character',`<w:rPr><w:i w:val="${Number(row.c)}"/></w:rPr>`))
   +(row.d===null?'':style('Char','character',`<w:basedOn w:val="CharBase"/><w:rPr><w:i w:val="${Number(row.d)}"/></w:rPr>`));
  const direct=(row.c===null?'':`<w:rStyle w:val="${row.d===null?'CharBase':'Char'}"/>`)+(row.direct===false?'<w:i w:val="0"/>':'');
  const run=(await scan(styles,undefined,direct)).paragraphs[0].formattedRuns[0];
  assert.equal(run.inline.italic.action,row.expected?'set':'remove',JSON.stringify(row));
 }
});

test('default-font evidence cannot omit malformed font tokens before shape validation',async()=>{
 for(const pr of ['<w:sz w:val="24"><w:b/></w:sz>','<w:sz w:val="24" w:evil="x"/>','<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"><w:b/></w:rFonts>']){
  const result=await scan(`<w:docDefaults><w:rPrDefault><w:rPr>${pr}</w:rPr></w:rPrDefault></w:docDefaults>`,'');
  const p=result.paragraphs[0],r=p?.formattedRuns[0];
  assert.ok(!result.ok||p.unsupportedParagraphNames.length||r.unsupportedNames.length||r.invalidSupportedValue,pr);
 }
});

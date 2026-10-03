'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const heading = level => ({type:'heading',attrs:{level},content:[{type:'text',text:'Heading'}]});
const hash = text => createHash('sha256').update(text).digest('hex');
const cryptoPort = {sha256Text:hash,sha256Json:value=>'sha256:'+hash(JSON.stringify(value)),byteLength:Buffer.byteLength};
const modules = Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('@tiptap/pm/state'),
  import('@tiptap/pm/history'),import('../../src/renderer/tiptap/documentHeadings.mjs'),
  import('../../src/io/revisionBridge/index.mjs'),import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs')]);

for(const level of [7,8,9])test(`P3d heading ${level}: editor history, durable save and review XML preserve exact outline`,async()=>{
  const [{getSchema},{default:StarterKit},{EditorState},{history,undo,redo},{DocumentHeadings},bridge,parser]=await modules;
  const schema=getSchema([StarterKit.configure({heading:false,trailingNode:false}),DocumentHeadings]);
  let state=EditorState.create({schema,doc:schema.nodeFromJSON({type:'doc',content:[heading(level)]}),plugins:[history()]});
  const dom=schema.nodes.heading.spec.toDOM(state.doc.firstChild);
  assert.equal(dom[0],'h6');assert.equal(dom[1]['aria-level'],String(level));assert.equal(dom[1]['data-word-heading-level'],String(level));
  const dispatch=tr=>{state=state.apply(tr);};dispatch(state.tr.insertText('Edited ',1));
  assert.equal(state.doc.firstChild.attrs.level,level);assert.ok(undo(state,dispatch));assert.equal(state.doc.textContent,'Heading');
  assert.ok(redo(state,dispatch));assert.equal(state.doc.textContent,'Edited Heading');
  const saved=envelope.composeObservablePayload({doc:state.doc.toJSON(),metaEnabled:false});
  const reopened=envelope.parseObservablePayload(saved);assert.equal(reopened.issue,null);assert.equal(reopened.doc.content[0].attrs.level,level);
  const blocks=buildFormatIrParagraphs({sceneId:'roman/heading.txt',doc:reopened.doc,text:reopened.text})
    .map((p,i)=>({...p,blockId:'block'+i,paragraphId:'paragraph'+i}));
  const bytes=buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]});
  const xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
  assert.match(xml,new RegExp('<w:outlineLvl w:val="'+(level-1)+'"/>'));
  const parsed=parser.extractReviewTransportFormattingRunsV2(xml,{cryptoPort});assert.equal(parsed.ok,true,JSON.stringify(parsed));
  assert.deepEqual(parsed.paragraphs[0].paragraphStructure,{nodeType:'heading',headingLevel:level});
});

test('P3d heading renderer preserves existing low levels and refuses invalid node levels',async()=>{
  const [{getSchema},{default:StarterKit},,,{DocumentHeadings}]=await modules;
  const schema=getSchema([StarterKit.configure({heading:false}),DocumentHeadings]);
  for(const level of [1,2,3,4,5,6])assert.equal(schema.nodes.heading.spec.toDOM(schema.nodeFromJSON(heading(level)))[0],'h'+level);
  for(const level of [0,10,'7',1.5,null])assert.throws(()=>schema.nodes.heading.spec.toDOM(schema.nodeFromJSON(heading(level))),/WORD_HEADING_LEVEL_INVALID/);
});

test('P3d explicit Word body outline reset cannot become heading ten',async()=>{
  const parser=(await modules)[6];
  const wrap=value=>`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:outlineLvl w:val="${value}"/></w:pPr><w:r><w:t>body</w:t></w:r></w:p></w:body></w:document>`;
  const body=parser.extractReviewTransportFormattingRunsV2(wrap('9'),{cryptoPort});assert.equal(body.ok,true);
  assert.deepEqual(body.paragraphs[0].paragraphStructure,{nodeType:'paragraph'});
  for(const value of ['10','-1','1.5']){
    const bad=parser.extractReviewTransportFormattingRunsV2(wrap(value),{cryptoPort});
    assert.equal(bad.paragraphs[0].paragraphFormattingInvalid,true);
  }
  const duplicate=parser.extractReviewTransportFormattingRunsV2(wrap('8').replace('</w:pPr>','<w:outlineLvl w:val="7"/></w:pPr>'),{cryptoPort});
  assert.equal(duplicate.paragraphs[0].paragraphFormattingInvalid,true);
});

test('P3d pending text decision retains heading nine without flattening Original or Current',()=>{
  const source={type:'doc',content:[heading(9)]};
  const doc=pending.bindLedger({schemaVersion:1,source,revisions:[{id:'revision-1',nativeId:'1',operation:'insert',author:'Reviewer',
    date:'2026-10-03T00:00:00Z',dateUtc:'2026-10-03T00:00:00Z',groupId:null,paragraphIndex:0,from:0,to:1,state:'pending'}],undo:[],redo:[]});
  assert.equal(pending.materialize(pending.readLedger(doc),'original').content[0].attrs.level,9);
  const rejected=pending.decide(doc,{action:'reject',revisionId:'revision-1'}).doc;
  assert.equal(rejected.content[0].attrs.level,9);assert.equal(envelope.parseObservablePayload(envelope.composeObservablePayload({doc:rejected})).doc.content[0].attrs.level,9);
});

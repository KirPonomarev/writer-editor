const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const model=require('../../src/core/word-list-format-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});
const list=(type,text='item')=>({type:'orderedList',attrs:{start:3,type},content:[{type:'listItem',content:[paragraph(text)]}]});
const doc=(...content)=>({type:'doc',content});
function storedPart(bytes,name){let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+length+extra;const entry=bytes.subarray(offset+30,offset+30+length).toString();if(entry===name)return bytes.subarray(start,start+size).toString();offset=start+size;}throw Error('missing '+name);}
for(const [type,word] of [['I','upperRoman'],['i','lowerRoman'],['A','upperLetter'],['a','lowerLetter']]) {
 test(`P3d ${word}: retained predecessor refuses durable feature; current reader and editor preserve it`,async()=>{
  const input=doc(list(type)),raw=envelope.composeObservablePayload({doc:input,metaEnabled:false});
  assert.match(raw,/word-list-format.v1/);assert.deepEqual(envelope.parseObservablePayload(raw).doc,input);
  const module={exports:{}},old=require('node:child_process').execFileSync('git',['show','2af5c5f6352ef60696c288b15fcf80468fed8e8e:src/core/document-content-envelope-v1.cjs'],{encoding:'utf8'});
  require('node:vm').runInNewContext(old,{module,exports:module.exports,require:id=>require(path.resolve(__dirname,'../../src/core',id))});
  assert.equal(module.exports.parseObservablePayload(raw).issue?.reason,'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
  const [{getSchema},{default:StarterKit},{EditorState},{history,undo,redo}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('@tiptap/pm/state'),import('@tiptap/pm/history')]);
  const schema=getSchema([StarterKit.configure({trailingNode:false})]);let state=EditorState.create({schema,doc:schema.nodeFromJSON(input),plugins:[history()]});
  const dispatch=tr=>{state=state.apply(tr)};dispatch(state.tr.insertText('changed ',3));assert.equal(state.doc.toJSON().content[0].attrs.type,type);
  assert.ok(undo(state,dispatch));assert.equal(state.doc.textContent,'item');assert.ok(redo(state,dispatch));assert.equal(state.doc.textContent,'changed item');
  const saved=envelope.composeObservablePayload({doc:state.doc.toJSON(),metaEnabled:false});const reopened=envelope.parseObservablePayload(saved).doc;assert.equal(reopened.content[0].attrs.type,type);assert.equal(reopened.content[0].attrs.start,3);
  const blocks=buildFormatIrParagraphs({sceneId:'roman/list.txt',doc:reopened,text:'changed item'}).map((p,i)=>({...p,blockId:'b'+i,paragraphId:'p'+i}));
  const bytes=buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]});
  const xml=storedPart(bytes,'word/numbering.xml');assert.match(xml,new RegExp('w:numFmt w:val="'+word+'"'));assert.match(xml,/<w:start w:val="3"/);
 });
}
test('P3d no invalid later list is hidden after an extended first list',()=>{
 for(const type of ['__proto__',{},1,'',false,'roman'])assert.throws(()=>envelope.composeObservablePayload({doc:doc(list('I'),list(type))}),/WORD_LIST_FORMAT_INVALID/);
 assert.equal(model.fromWordFormat('chicago'),null);assert.equal(model.wordFormat(null),'decimal');
});
test('P3d table and note list projection retain exact format',()=>{
 const table={type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[list('a')]}]}]};
 const leaves=require('../../src/io/documentTables.js').tableParagraphs(table,'t');assert.equal(leaves[0].listStack[0].type,'a');
 const note=require('../../src/core/word-manuscript-notes-v1.cjs').validateNoteBody(doc(list('i')));assert.equal(note.paragraphs[0].list.type,'i');
 const blocks=buildFormatIrParagraphs({sceneId:'roman/table.txt',doc:doc(table),text:'item'});assert.equal(blocks[0].formatIr.paragraph.list.type,'a');
});
test('P3d list inspection rejects accessors and cycles without invoking code',()=>{
 let calls=0;const hostile=list('I');Object.defineProperty(hostile.attrs,'type',{get(){calls++;return 'I';}});
 assert.throws(()=>model.inspectDocument(doc(hostile)),/WORD_LIST_FORMAT_INVALID/);assert.equal(calls,0);
 const cyclic=doc();cyclic.content.push(cyclic);assert.throws(()=>model.inspectDocument(cyclic),/WORD_LIST_FORMAT_BUDGET/);
});

test('P3d pending revision paragraph traversal accepts supported list formats and rejects unknown types',()=>{
 const pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
 for(const type of ['I','i','A','a'])assert.equal(pending.paragraphs(doc(list(type))).length,1);
 assert.throws(()=>pending.paragraphs(doc(list('unknown'))),/PENDING_REVISIONS/);
});

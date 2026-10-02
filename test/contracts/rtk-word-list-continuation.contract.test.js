const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../../src/core/word-list-numbering-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const list=(start=1,id='chain',base=1)=>({type:'orderedList',attrs:{start,wordListId:id,wordListStart:base},content:[{type:'listItem',content:[p('item')]}]});
const doc=(...content)=>({type:'doc',content});
test('continuation validation refuses malformed IDs, inconsistent bases/formats/levels, overflow, cycles and accessors',()=>{
 for(const id of ['',1,{},'a/b','x'.repeat(65)])assert.throws(()=>model.resolve(doc(list(1,id))),/WORD_LIST_NUMBERING/);
 for(const base of [-1,1.5,2147483648,'1'])assert.throws(()=>model.resolve(doc(list(1,'a',base))),/WORD_LIST_NUMBERING/);
 assert.throws(()=>model.resolve(doc(list(),list(2,'chain',2))),/WORD_LIST_NUMBERING/);
 const other=list();other.attrs.type='A';assert.throws(()=>model.resolve(doc(list(),other)),/WORD_LIST_NUMBERING/);
 const nested=list();nested.content[0].content.push(list());assert.throws(()=>model.resolve(doc(nested)),/WORD_LIST_NUMBERING/);
 assert.throws(()=>model.resolve(doc(list(2147483647,'a',2147483647),list(2147483647,'a',2147483647))),/WORD_LIST_NUMBERING/);
 const cyclic=doc();cyclic.content.push(cyclic);assert.throws(()=>model.resolve(cyclic),/WORD_LIST_NUMBERING/);
 let invoked=false;const hostile=list();Object.defineProperty(hostile.attrs,'wordListId',{get(){invoked=true;return 'a';}});
 assert.throws(()=>model.resolve(doc(hostile)),/WORD_LIST_NUMBERING/);assert.equal(invoked,false);
});
test('Core resolves private copies, retains base after deletion and isolates documents',()=>{
 const input=doc(list(5,'a',5),p('gap'),list(6,'a',5));
 input.content[0].content.push({type:'listItem',content:[p('new')]});
 const resolved=envelope.canonicalizeDocumentJson(input);assert.equal(resolved.content[2].attrs.start,7);assert.equal(input.content[2].attrs.start,6);
 resolved.content.splice(0,2);assert.equal(envelope.canonicalizeDocumentJson(resolved).content[0].attrs.start,5);
 assert.equal([...model.resolve(doc(list(9,'a',9))).values()][0],9);
});
test('retained reader refuses new required feature instead of dropping continuation',()=>{
 const raw=envelope.composeObservablePayload({doc:doc(list(),p('gap'),list(2)),metaEnabled:false});
 const path=require('node:path'),module={exports:{}};
 const old=require('node:child_process').execFileSync('git',['show','143eb956fd6795657ba09a251c47336413256fd5:src/core/document-content-envelope-v1.cjs'],{encoding:'utf8'});
 require('node:vm').runInNewContext(old,{module,exports:module.exports,require:id=>require(path.resolve(__dirname,'../../src/core',id))});
 assert.equal(module.exports.parseObservablePayload(raw).issue?.reason,'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
});
test('table and note continuation keep shared export IDs and distinct document scope',()=>{
 const table={type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[list(),p('gap'),list(2)]}]}]};
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const blocks=source.buildFormatIrParagraphs({sceneId:'a',doc:doc(table),text:'item\ngap\nitem'});
 assert.equal(blocks[0].formatIr.paragraph.list.numId,blocks[2].formatIr.paragraph.list.numId);
 assert.equal(blocks[2].formatIr.paragraph.list.itemOrdinal,1);
 const notes=require('../../src/core/word-manuscript-notes-v1.cjs').validateNoteBody(doc(list(),p('gap'),list(2)));
 assert.equal(notes.paragraphs[0].list.numId,notes.paragraphs[2].list.numId);
});
test('editor hidden continuation fields cannot be imported from arbitrary HTML',async()=>{
 const {DocumentListNumbering}=await import('../../src/renderer/tiptap/documentListNumbering.mjs');
 const attrs=DocumentListNumbering.config.addGlobalAttributes()[0].attributes;
 for(const attr of Object.values(attrs)){assert.equal(attr.rendered,false);assert.equal(attr.parseHTML({getAttribute:()=> 'forged'}),null);}
});

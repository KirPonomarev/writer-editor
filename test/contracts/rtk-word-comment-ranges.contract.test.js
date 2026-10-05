'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {deriveCommentAnchor:derive,validateCommentAnchor:validate,rebaseCommentAnchorSplice:rebase}=require('../../src/core/word-comment-ranges-v1.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const input={kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:2,endParagraphIndex:2,endUtf16:2};
test('multi range derives full-leaf authority independently of projected quote',()=>{
 const paragraphs=['Alpha','middle\nline','Omega'];
 const a=derive({sceneId:'s',paragraphs,input});
 assert.equal(a.selectedText,'pha\nmiddle\nline\nOm');
 assert.equal(a.coveredParagraphsSha256,hash(JSON.stringify(paragraphs)));
 assert.deepEqual(validate({sceneId:'s',paragraphs,anchor:a}),a);
 for(const changed of [{...a,endUtf16:3},{...a,coveredParagraphsSha256:hash('wrong')},{...a,paragraphIndex:1}]) assert.throws(()=>validate({sceneId:'s',paragraphs,anchor:changed}));
 assert.throws(()=>validate({sceneId:'foreign',paragraphs,anchor:a}));
});
test('multi range validates all cell owners and grapheme endpoints',()=>{
 const table={tableId:'t',row:0,column:0};
 const paragraphs=['Alpha','Beta','Omega'].map(text=>({text,table}));
 assert.equal(derive({sceneId:'s',paragraphs,input}).selectedText,'pha\nBeta\nOm');
 paragraphs[1]={text:'Beta',table:{...table,column:1}};
 assert.throws(()=>derive({sceneId:'s',paragraphs,input}),{code:'COMMENT_ANCHOR_OWNER'});
 assert.throws(()=>derive({sceneId:'s',paragraphs:['Á','B'],input:{...input,startUtf16:1,endParagraphIndex:1,endUtf16:1}}),{code:'COMMENT_ANCHOR_GRAPHEME'});
});
test('fixed-topology splices apply start-right/end-left and update interior digest',()=>{
 let texts=['Alpha','Beta','Omega']; let a=derive({sceneId:'s',paragraphs:texts,input});
 for(const [paragraphIndex,fromUtf16,insertText,expected] of [[0,2,'X','pha\nBeta\nOm'],[1,2,'Y','pha\nBeYta\nOm'],[2,2,'Z','pha\nBeYta\nOm']]){
  const next=texts.slice();next[paragraphIndex]=texts[paragraphIndex].slice(0,fromUtf16)+insertText+texts[paragraphIndex].slice(fromUtf16);
  a=rebase({anchor:a,beforeParagraphs:texts,afterParagraphs:next,edit:{paragraphIndex,fromUtf16,toUtf16:fromUtf16,removedText:'',insertText}}).anchor;
  assert.equal(a.selectedText,expected);assert.equal(a.coveredParagraphsSha256,hash(JSON.stringify(next)));texts=next;
 }
 assert.throws(()=>rebase({anchor:a,beforeParagraphs:texts,afterParagraphs:[...texts,'extra'],edit:{paragraphIndex:0,fromUtf16:0,toUtf16:0,removedText:'',insertText:''}}),{code:'COMMENT_EDIT_REPLAY_MISMATCH'});
});

test('legacy authenticated global locator remains distinct from scene-local coordinates',()=>{
 const paragraphs=['Alpha'];
 const a=derive({sceneId:'second',paragraphs,input:{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'}});
 a.paragraphIndex=5;
 assert.equal(validate({sceneId:'second',paragraphs,anchor:a}).sceneParagraphIndex,0);
 assert.equal(a.paragraphIndex,5);
 const bad={...a,blockTextSha256:hash('foreign')};assert.throws(()=>validate({sceneId:'second',paragraphs,anchor:bad}));
});

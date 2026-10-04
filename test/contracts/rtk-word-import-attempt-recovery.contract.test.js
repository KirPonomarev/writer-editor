'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('accepted import correlation is strict bounded data and never interprets getters',()=>{
 const model=require('../../src/core/word-import-attempt-v1.cjs');
 const input={projectId:'p',requestId:'attempt-1',importOperationId:'docx-import-op-123456789abc',sourceArtifactSha256:'a'.repeat(64),candidateContentSha256:'b'.repeat(64),previewHash:'12345678',sourceSceneId:'docx-import-scene-aaaaaaaa'};
 const record=model.createImportAttempt(input),text=model.serializeImportAttempt(record);
 assert.deepEqual(model.parseImportAttempt(text,{projectId:'p'}),record);assert.equal(model.parseImportAttempt(null,{projectId:'p'}),null);
 assert.throws(()=>model.parseImportAttempt(text,{projectId:'other'}),/IMPORT_ATTEMPT/);
 assert.throws(()=>model.createImportAttempt({...input,path:'/foreign'}),/IMPORT_ATTEMPT/);
 let called=false;const evil={...input};Object.defineProperty(evil,'requestId',{get(){called=true;return 'evil';}});assert.throws(()=>model.createImportAttempt(evil),/IMPORT_ATTEMPT/);assert.equal(called,false);
 assert.throws(()=>model.parseImportAttempt(' '.repeat(4097),{projectId:'p'}),/IMPORT_ATTEMPT/);
 assert.throws(()=>model.assertImportAttemptMatches(record,{...input,requestId:'different'}),/IMPORT_ATTEMPT/);
});

test('attempt adapter rejects symlink, hardlink, oversize and malformed records without following or changing them',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),safe=require('../../src/utils/docxImportSafeCreate.js');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'import-attempt-hostile-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const projectRoot=path.join(root,'project'),target=path.join(projectRoot,'.yalken/docx-import/active-attempt.v1.json'),outside=path.join(root,'outside');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(outside,'unchanged');
 fs.symlinkSync(outside,target);await assert.rejects(safe.readDocxImportAttempt({projectRoot,projectId:'p'}),/ATTEMPT_PATH/);fs.unlinkSync(target);
 fs.linkSync(outside,target);await assert.rejects(safe.readDocxImportAttempt({projectRoot,projectId:'p'}),/ATTEMPT_PATH/);fs.unlinkSync(target);
 for(const contents of ['x'.repeat(4097),'malformed']){fs.writeFileSync(target,contents);await assert.rejects(safe.readDocxImportAttempt({projectRoot,projectId:'p'}),/IMPORT_ATTEMPT/);assert.equal(fs.readFileSync(target,'utf8'),contents);fs.unlinkSync(target);}
 fs.rmdirSync(path.dirname(target));fs.symlinkSync(root,path.dirname(target));await assert.rejects(safe.readDocxImportAttempt({projectRoot,projectId:'p'}),/ATTEMPT_PATH/);assert.equal(fs.readFileSync(outside,'utf8'),'unchanged');
});

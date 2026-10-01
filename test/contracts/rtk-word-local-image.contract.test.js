'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { Schema } = require('@tiptap/pm/model');
const { planLocalImage, insertionPoint } = require('../../src/core/word-local-image-v1.cjs');
const { readLocalImageFile } = require('../../src/io/localImageFile.cjs');
const media = require('../../src/io/documentMedia.js');
const { mediaPlacements } = require('../../src/core/word-media-return-v1.cjs');
const { deriveVisibleTextFromDocument } = require('../../src/core/document-content-envelope-v1.cjs');
const jpeg = require('../fixtures/document-jpeg-fixtures.cjs');
const img = label => ({ type: 'image', attrs: media.createImageAttrs(jpeg.rgb, { alt: label }) });
const text = value => ({ type: 'text', text: value });
const doc = (...content) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const schema = new Schema({ nodes: {
  doc: { content: 'paragraph+' }, paragraph: { content: 'inline*', group: 'block' },
  text: { group: 'inline' }, image: { group: 'inline', inline: true, atom: true },
  hardBreak: { group: 'inline', inline: true },
} });

test('exact cursor insertion orders repeated images without changing text or formatting', () => {
  const source = doc(text('A😀'), img('first'), img('second'), { type: 'text', text: 'B', marks: [{ type: 'bold' }] });
  for (const [position, expected] of [[4, ['new','first','second']], [5,['first','new','second']], [6,['first','second','new']]]) {
    const result = planLocalImage({ beforeDoc: source, position, attrs: img('new').attrs });
    assert.equal(result.changed, true);
    assert.deepEqual(mediaPlacements(result.doc).map(row => row.attrs.alt), expected);
    assert.equal(deriveVisibleTextFromDocument(result.doc), 'A😀B');
    assert.deepEqual(result.doc.content[0].content.at(-1), source.content[0].content.at(-1));
    assert.deepEqual(mediaPlacements(source).map(row => row.attrs.alt), ['first','second']);
  }
});
test('cursor is checked against structural and UTF16 boundaries; empty block and hard break work', () => {
  for (const position of [-1, 0, 99, 1.5, NaN]) assert.throws(() => insertionPoint(doc(text('A')), position), /LOCAL_IMAGE_CURSOR_INVALID/);
  assert.throws(() => planLocalImage({ beforeDoc: doc(text('😀')), position: 2, attrs: img('').attrs }), /UTF16_BOUNDARY/);
  assert.equal(mediaPlacements(planLocalImage({ beforeDoc: doc(), position: 1, attrs: img('').attrs }).doc)[0].offset, 0);
  const result = planLocalImage({ beforeDoc: doc(text('A'), { type:'hardBreak' }, text('B')), position: 3, attrs: img('').attrs });
  assert.equal(mediaPlacements(result.doc)[0].offset, 2);
  assert.equal(deriveVisibleTextFromDocument(result.doc), 'A\nB');
});
test('Core cursor and real ProseMirror coordinates agree with image atoms, emoji and paragraphs', async () => {
  const { textOffsetForPosition, positionForTextOffset } = await import('../../src/renderer/tiptap/textCoordinates.mjs');
  const source = { type:'doc', content:[doc(img('a'),text('A😀'),img('b'),img('c'),{type:'hardBreak'},text('B')).content[0], doc(img('d'),text('C'),img('e')).content[0]] };
  const pm = schema.nodeFromJSON(source);
  const visible = deriveVisibleTextFromDocument(source);
  assert.equal(visible, 'A😀\nB\nC');
  for (let offset = 0; offset <= visible.length; offset++) {
    const position = positionForTextOffset(pm, offset);
    assert.equal(textOffsetForPosition(pm, position), offset, `offset ${offset}, position ${position}`);
  }
  assert.equal(positionForTextOffset(pm, 0), 2);
  assert.equal(positionForTextOffset(pm, 3), 7);
  assert.deepEqual(insertionPoint(source, 6), { paragraphIndex:0,offset:3,precedingImages:1 });
});
test('native selected-file adapter validates bytes and refuses links, directories, oversized and corrupt files', async t => {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'local-image-')));
  t.after(() => fs.rm(temp,{recursive:true,force:true}));
  const file = path.join(temp,'picture.jpg'); await fs.writeFile(file,jpeg.rgb);
  const attrs = await readLocalImageFile(file);
  assert.equal(attrs.displayName,'picture.jpg'); assert.deepEqual(Buffer.from(attrs.dataBase64,'base64'),jpeg.rgb);
  const link = path.join(temp,'link.jpg'); await fs.symlink(file,link);
  await assert.rejects(readLocalImageFile(link), /LOCAL_IMAGE_FILE_UNSAFE/);
  await assert.rejects(readLocalImageFile(temp), /LOCAL_IMAGE_FILE_UNSAFE/);
  await assert.rejects(readLocalImageFile('relative.jpg'), /LOCAL_IMAGE_FILE_UNSAFE/);
  await fs.writeFile(file,Buffer.alloc(media.MEDIA_LIMITS.bytes+1)); await assert.rejects(readLocalImageFile(file), /LOCAL_IMAGE_FILE_UNSAFE/);
  await fs.writeFile(file,Buffer.from('not an image')); await assert.rejects(readLocalImageFile(file), /DOCUMENT_MEDIA_/);
});
test('incremental image publication keeps separate real ProseMirror Undo/Redo and rejects unrelated mutations', async () => {
  const { EditorState } = require('@tiptap/pm/state');
  const { history, undo, redo } = require('@tiptap/pm/history');
  const { applyLocalImagePublication } = await import('../../src/renderer/tiptap/localImage.mjs');
  const attrs = img('native').attrs;
  const richSchema = new Schema({ nodes: {
    doc:{content:'paragraph+'}, paragraph:{content:'inline*',group:'block'}, text:{group:'inline'},
    image:{group:'inline',inline:true,atom:true,attrs:Object.fromEntries(Object.keys(attrs).map(k=>[k,{default:null}]))},
    hardBreak:{group:'inline',inline:true},
  } });
  let state = EditorState.create({schema:richSchema,doc:richSchema.nodeFromJSON(doc(text('AB'))),plugins:[history()]});
  const editor = {schema:richSchema,get state(){return state;},view:{dispatch(tr){state=state.apply(tr);}}};
  editor.view.dispatch(state.tr.insertText('C',3));
  const before = state.doc, plan = planLocalImage({beforeDoc:before.toJSON(),position:2,attrs});
  assert.equal(applyLocalImagePublication(editor,plan.doc,2),true);
  const after = state.doc;
  assert.equal(undo(state,editor.view.dispatch),true); assert(state.doc.eq(before));
  assert.equal(undo(state,editor.view.dispatch),true); assert.equal(state.doc.textContent,'AB');
  assert.equal(redo(state,editor.view.dispatch),true); assert(state.doc.eq(before));
  assert.equal(redo(state,editor.view.dispatch),true); assert(state.doc.eq(after));
  const foreign = JSON.parse(JSON.stringify(plan.doc)); foreign.content[0].content.at(-1).text='foreign';
  assert.equal(applyLocalImagePublication(editor,foreign,2),false); assert(state.doc.eq(after));
});
test('image-only scene change preserves manuscript note coordinates and binding hash', () => {
  const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const beforeDoc=doc(text('A😀B')), before=envelope.composeObservablePayload({doc:beforeDoc});
  const manuscript=notes.bindManuscriptPayload({kind:'footnote',body:doc(text('note')),sceneId:'a.txt',offsetUtf16:3,sceneContent:before});
  const after=envelope.composeObservablePayload({doc:planLocalImage({beforeDoc,position:2,attrs:img('').attrs}).doc});
  const rebound=notes.bindManuscriptPayload({kind:'footnote',body:doc(text('note')),sceneId:'a.txt',offsetUtf16:3,sceneContent:after});
  assert.deepEqual(rebound,manuscript);
});
test('renderer command bus admits native image command with actual desktop capability and editor-mode payload', async () => {
  const { enforceCapabilityForCommand } = await import('../../src/renderer/commands/capabilityPolicy.mjs');
  const { runCommandThroughBus } = await import('../../src/renderer/commands/commandBusGuard.mjs');
  const id='cmd.project.media.insertLocal';
  const capability=enforceCapabilityForCommand(id,{editorMode:'tiptap'},{defaultPlatformId:'node'});
  assert.equal(capability.ok,true,JSON.stringify(capability));
  const result=await runCommandThroughBus(async (commandId,payload)=>({ok:true,commandId,payload}),id,{editorMode:'tiptap'},{route:'command.bus'});
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(result.commandId,id);
  const web=enforceCapabilityForCommand(id,{editorMode:'tiptap'},{defaultPlatformId:'web'}); assert.equal(web.ok,false);
});
test('actual renderer snapshot and Main normalization carry the cursor end-to-end', () => {
  const f=require('node:fs'),vm=require('node:vm');
  const renderer=f.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const section=renderer.slice(renderer.indexOf('function composeEditorSnapshot('),renderer.indexOf('function applyIncomingBookProfile('));
  const context=vm.createContext({composeDocumentContent:()=> 'text',getPlainText:()=> 'text',getActiveBookProfile:()=>null,
    getSelectionOffsets:()=>({start:1,end:1}),isTiptapMode:true,getTiptapImageInsertionPosition:()=>7,
    localEditGeneration:2,wordCommentDraft:null,wordCommentBusy:false,manuscriptDrafts:new Map(),notesMutationPending:false});
  vm.runInContext(section,context);
  const main=f.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  vm.runInContext(main.slice(main.indexOf('function normalizeEditorSnapshotPayload('),main.indexOf('function requestEditorSnapshot(')),context);
  context.isPlainObjectValue=x=>x&&typeof x==='object'&&!Array.isArray(x);
  context.normalizeSelectionRangeForSettings=x=>x;
  assert.equal(context.normalizeEditorSnapshotPayload(context.composeEditorSnapshot()).imageInsertionPosition,7);
  assert.equal(context.normalizeEditorSnapshotPayload({content:'x',imageInsertionPosition:-1}).imageInsertionPosition,null);
});

const test = require('node:test');
const assert = require('node:assert/strict');

test('Word media editor: inline atom preserves canonical attributes and exposes native alt without any path-based load', async () => {
  const { Node, getSchema } = require('@tiptap/core');
  const { DocumentMedia, mediaImageDom } = await import('../../src/renderer/tiptap/documentMedia.mjs');
  const schema = getSchema([Node.create({ name: 'doc', topNode: true, content: 'paragraph+' }), Node.create({ name: 'paragraph', content: 'inline*' }), Node.create({ name: 'text', group: 'inline' }), DocumentMedia]);
  const attrs = { assetId: 'hash-bound-by-main', assetPath: 'assets/media/owned.png', sha256: 'main-owned', mimeType: 'image/png', width: 2, height: 1, alt: 'Красный & alt', displayName: 'same.png', dataBase64: 'iVBORw==' };
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] };
  const node = schema.nodeFromJSON(doc); node.check();
  assert.deepEqual(JSON.parse(JSON.stringify(node.toJSON())), doc);
  assert.equal(schema.nodes.image.spec.inline, true);
  const html = mediaImageDom(attrs);
  assert.equal(html[0], 'img'); assert.equal(html[1].alt, attrs.alt);
  assert.equal(html[1].src, 'data:image/png;base64,iVBORw==');
  assert.equal(Object.values(html[1]).includes(attrs.assetPath), false);
  assert.deepEqual(DocumentMedia.config.parseHTML(), []);
});

test('Word media editor: malicious URI, wrong media type and excessive dimensions never reach img src', async () => {
  const { mediaImageDom } = await import('../../src/renderer/tiptap/documentMedia.mjs');
  const attrs = { mimeType: 'image/png', width: 2, height: 1, dataBase64: 'iVBORw==' };
  for (const change of [{ dataBase64: 'https://example.test/image' }, { mimeType: 'image/svg+xml' }, { width: 100000 }, { dataBase64: 'file:///private/data' }]) {
    const html = mediaImageDom({ ...attrs, ...change });
    assert.equal(html[0], 'span'); assert.equal(html[1].src, undefined);
  }
});


test('Word media editor: sheet refresh prevents clipping every image and restores text pagination after removal', () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const fn = source.slice(source.indexOf('function refreshCentralSheetStripProof('), source.indexOf('function scheduleCentralSheetStripProofRefreshOnScroll('));
  let hasImage = true, fallback = '', calls = 0;
  class Element { querySelector(selector) { return selector === 'table' ? null : selector === 'img' ? (hasImage ? {} : null) : new Element(); } }
  const context = { HTMLElement: Element, isTiptapMode: true, editor: new Element(),
    clearCentralSheetStripProof: value => { fallback = value?.overflowReason || ''; },
    centralSheetStripLargePayloadFastPathActive: false, centralSheetStripStructuralGuardActive: false,
    buildCentralSheetStripRuntimeState: () => ({ shouldRender: true }),
    applyCentralSheetStripRuntimeState: () => { calls++; return true; } };
  vm.createContext(context); vm.runInContext(fn, context);
  for (const fast of [false, true]) {
    context.centralSheetStripLargePayloadFastPathActive = fast;
    assert.equal(context.refreshCentralSheetStripProof(), false);
    assert.equal(fallback, 'media-layout-continuous'); assert.equal(calls, 0);
  }
  hasImage = false; context.centralSheetStripLargePayloadFastPathActive = false;
  assert.equal(context.refreshCentralSheetStripProof(), true); assert.equal(calls, 1);
});

test('W3: editor history, JSON persistence and schema copy retain exact display EMU; paste cannot invent media',async()=>{
  const {Node,getSchema}=require('@tiptap/core');const {EditorState,TextSelection}=require('@tiptap/pm/state');const {history,undo,redo}=require('@tiptap/pm/history');
  const {DocumentMedia,mediaImageDom}=await import('../../src/renderer/tiptap/documentMedia.mjs');const envelope=await import('../../src/renderer/documentContentEnvelope.mjs');
  const schema=getSchema([Node.create({name:'doc',topNode:true,content:'paragraph+'}),Node.create({name:'paragraph',content:'inline*'}),Node.create({name:'text',group:'inline'}),DocumentMedia]);
  const attrs={assetId:'main-owned',assetPath:'assets/media/owned.png',sha256:'main-owned',mimeType:'image/png',width:2,height:1,alt:'scaled',displayName:'same.png',dataBase64:'iVBORw==',displayWidthEmu:38101,displayHeightEmu:28577};
  const doc=schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'image',attrs}]}]});doc.check();
  let state=EditorState.create({doc,plugins:[history()]});const apply=tr=>{state=state.apply(tr);};
  apply(state.tr.setSelection(TextSelection.create(state.doc,1)).insertText('before '));assert.equal(state.doc.firstChild.lastChild.attrs.displayWidthEmu,38101);
  assert.equal(undo(state,apply),true);assert.equal(state.doc.firstChild.childCount,1);assert.equal(redo(state,apply),true);
  const stored=envelope.composeObservablePayload({doc:state.doc.toJSON()}),reopened=schema.nodeFromJSON(envelope.parseObservablePayload(stored).doc);reopened.check();
  assert.equal(reopened.firstChild.lastChild.attrs.displayHeightEmu,28577);
  const copied=schema.nodeFromJSON(JSON.parse(JSON.stringify(reopened.toJSON())));assert.equal(copied.firstChild.lastChild.attrs.displayWidthEmu,38101);
  const view=mediaImageDom(attrs);assert.match(view[1].style,/aspect-ratio:38101\/28577/u);assert.match(view[1].style,/object-fit:fill/u);assert.deepEqual(DocumentMedia.config.parseHTML(),[]);
  for(const patch of [{displayWidthEmu:0},{displayWidthEmu:1.2},{displayHeightEmu:undefined},{displayHeightEmu:78028801}])assert.equal(mediaImageDom({...attrs,...patch})[0],'span');
});

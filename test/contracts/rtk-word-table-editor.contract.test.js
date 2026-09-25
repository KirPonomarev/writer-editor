const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('table editor: actual sheet refresh keeps table content visible and restores ordinary pagination', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const fn = source.slice(source.indexOf('function refreshCentralSheetStripProof('), source.indexOf('function scheduleCentralSheetStripProofRefreshOnScroll('));
  class Element { querySelector(selector) { return selector === 'table' ? (hasTable ? {} : null) : selector === 'img' ? null : new Element(); } }
  let hasTable = true, fallback = '', paginationCalls = 0;
  const context = { HTMLElement: Element, isTiptapMode: true, editor: new Element(),
    clearCentralSheetStripProof: value => { fallback = value?.overflowReason || ''; },
    centralSheetStripLargePayloadFastPathActive: false, centralSheetStripStructuralGuardActive: false,
    buildCentralSheetStripRuntimeState: () => ({ shouldRender: true }),
    applyCentralSheetStripRuntimeState: () => { paginationCalls++; return true; } };
  vm.createContext(context); vm.runInContext(fn, context);
  assert.equal(context.refreshCentralSheetStripProof(), false);
  assert.equal(fallback, 'table-layout-continuous'); assert.equal(paginationCalls, 0);
  hasTable = false;
  assert.equal(context.refreshCentralSheetStripProof(), true);
  assert.equal(paginationCalls, 1);
});
test('table editor: actual ProseMirror schema retains merged cells and supports keyboard cell movement', async () => {
  const [{ getSchema }, { default: StarterKit }, { DocumentTables }, { TableMap, goToNextCell }, { EditorState, TextSelection }] = await Promise.all([
    import('@tiptap/core'), import('@tiptap/starter-kit'), import('../../src/renderer/tiptap/documentTables.mjs'),
    import('@tiptap/pm/tables'), import('@tiptap/pm/state'),
  ]);
  const schema = getSchema([StarterKit, DocumentTables]);
  const p = text => text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };
  const cell = (text, colspan = 1, rowspan = 1) => ({ type: 'tableCell', attrs: { colspan, rowspan, colwidth: null }, content: [p(text)] });
  const json = { type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [cell('merged', 2), cell('vertical', 1, 2)] },
    { type: 'tableRow', content: [cell('left'), cell('')] },
  ] }, p('after')] };
  const doc = schema.nodeFromJSON(json); doc.check();
  assert.deepEqual(JSON.parse(JSON.stringify(doc.toJSON())), json);
  const map = TableMap.get(doc.firstChild);
  assert.equal(map.width, 3); assert.equal(map.height, 2); assert.equal(map.problems, null);
  let state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4) });
  const before = state.selection.from;
  assert.equal(goToNextCell(1)(state, tr => { state = state.apply(tr); }), true);
  assert.ok(state.selection.from > before);
  assert.deepEqual(JSON.parse(JSON.stringify(schema.nodeFromJSON(state.doc.toJSON()).toJSON())), json);
});

const test = require('node:test');
const assert = require('node:assert/strict');
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

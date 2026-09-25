import { Extension, Node } from '@tiptap/core';
import { tableNodes, tableEditing, goToNextCell } from '@tiptap/pm/tables';

// Reuse the installed ProseMirror schema and keyboard/selection behavior.
// This adds document nodes, not a second persistence or command path.
const names = { table: 'table', table_row: 'tableRow', table_cell: 'tableCell', table_header: 'tableHeader' };
const specifications = tableNodes({ tableGroup: 'block', cellContent: '(paragraph | heading | codeBlock)+' });
const nodes = Object.entries(specifications).map(([key, spec]) => Node.create({
  name: names[key],
  content: spec.content.replace(/table_row|table_cell|table_header/gu, name => names[name]),
  group: spec.group,
  isolating: spec.isolating,
  addAttributes() {
    return Object.fromEntries(Object.entries(spec.attrs || {}).map(([name, attr]) => [name, {
      default: attr.default,
      rendered: false,
      parseHTML: element => spec.parseDOM[0].getAttrs(element)[name],
    }]));
  },
  parseHTML() { return spec.parseDOM; },
  renderHTML({ node }) { return spec.toDOM(node); },
}));

export const DocumentTables = Extension.create({
  name: 'documentTables',
  addExtensions() { return nodes; },
  extendNodeSchema(extension) {
    const key = Object.keys(names).find(key => names[key] === extension.name);
    return key ? { tableRole: specifications[key].tableRole } : {};
  },
  addProseMirrorPlugins() { return [tableEditing()]; },
  addKeyboardShortcuts() {
    return {
      Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      'Shift-Tab': () => goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    };
  },
});

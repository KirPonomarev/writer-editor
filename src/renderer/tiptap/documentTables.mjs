import { Extension, Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import tables from '../../io/documentTables.js';
import properties from '../../io/documentTableProperties.js';
import { tableNodes, tableEditing, goToNextCell } from '@tiptap/pm/tables';

// Display conversion consumes canonical document data; it never publishes truth.
const borderCss = border => !border || border.style === 'none' ? 'none'
  : `${border.size / 8}pt ${border.style === 'single' ? 'solid' : 'double'} ${border.color === 'auto' ? 'currentColor' : '#' + border.color}`;
export function tablePresentation(json) {
  const layout = tables.inspectTable(json), explicit = json.attrs?.wordTable;
  if (!explicit && !layout.cells.some(c => c.node.attrs?.wordCell)) return null;
  const props = explicit || properties.legacyTableProperties(layout.columns);
  const cells = layout.cells.map(cell => {
    const own = cell.node.attrs?.wordCell;
    const fill = own?.shading ?? props.shading;
    const borders = {
      top: cell.row === 0 ? 'top' : 'insideH', bottom: cell.row + cell.rowspan === layout.rows ? 'bottom' : 'insideH',
      left: cell.column === 0 ? 'left' : 'insideV', right: cell.column + cell.colspan === layout.columns ? 'right' : 'insideV',
    };
    const style = Object.entries(borders).map(([side, edge]) => `border-${side}:${borderCss(own?.borders[side] ?? props.borders[edge])}`);
    style.push(`background-color:${fill && fill !== 'none' ? '#' + fill : 'transparent'}`);
    return { style: style.join(';') };
  });
  const total = props.grid.every(w => w !== null) ? props.grid.reduce((a, b) => a + b, 0) : props.widthDxa;
  return { cells, grid: props.grid, style: `table-layout:${props.layout === 'fixed' ? 'fixed' : 'auto'};width:${total ? total / 15 + 'px' : 'auto'}` };
}
function tableDecorations(doc) {
  const decorations = [];
  doc.descendants((node, position) => {
    if (node.type.name !== 'table') return;
    const view = tablePresentation(node.toJSON());
    if (view) {
      let cellIndex = 0;
      node.descendants((child, offset) => {
        if (!['tableCell', 'tableHeader'].includes(child.type.name)) return;
        decorations.push(Decoration.node(position + 1 + offset, position + 1 + offset + child.nodeSize, view.cells[cellIndex++]));
        return false;
      });
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}
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
    const base = Object.fromEntries(Object.entries(spec.attrs || {}).map(([name, attr]) => [name, {
      default: attr.default,
      rendered: false,
      parseHTML: element => spec.parseDOM[0].getAttrs(element)[name],
    }]));
    if (key === 'table') base.wordTable = { default: undefined, rendered: false, parseHTML: () => undefined };
    if (['table_cell', 'table_header'].includes(key)) base.wordCell = { default: undefined, rendered: false, parseHTML: () => undefined };
    return base;
  },
  parseHTML() { return spec.parseDOM; },
  renderHTML({ node }) {
    if (key === 'table') {
      const view = tablePresentation(node.toJSON());
      if (view) return ['table', { style: view.style }, ['colgroup', ...view.grid.map(w => ['col', w === null ? {} : { style: `width:${w / 15}px` }])], ['tbody', 0]];
    }
    return spec.toDOM(node);
  },
}));

export const DocumentTables = Extension.create({
  name: 'documentTables',
  addExtensions() { return nodes; },
  extendNodeSchema(extension) {
    const key = Object.keys(names).find(key => names[key] === extension.name);
    return key ? { tableRole: specifications[key].tableRole } : {};
  },
  addProseMirrorPlugins() { return [tableEditing(), new Plugin({
    state: { init: (_, state) => tableDecorations(state.doc), apply: (tr, previous) => tr.docChanged ? tableDecorations(tr.doc) : previous },
    props: { decorations(state) { return this.getState(state); } },
  })]; },
  addKeyboardShortcuts() {
    return {
      Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      'Shift-Tab': () => goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    };
  },
});

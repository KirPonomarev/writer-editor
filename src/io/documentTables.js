'use strict';

// Pure document data: no DOM, I/O, provider or mutation authority.
const TABLE_LIMITS = Object.freeze({ rows: 512, columns: 128, slots: 65536, paragraphs: 50000 });
const META_KEYS = ['tableId', 'row', 'column', 'rowCount', 'columnCount', 'colspan', 'rowspan', 'header', 'paragraphIndex', 'paragraphCount'];
const fail = code => { throw new Error(`DOCX_TABLE_${code}`); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function attrsOnly(node, allowed) {
  if (node.attrs != null && !object(node.attrs)) fail('ATTR_INVALID');
  if (Object.entries(node.attrs || {}).some(([key, value]) => value != null && !allowed.includes(key))) fail('ATTR_UNSUPPORTED');
}
function integer(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }

function inspectTable(table) {
  if (!object(table) || table.type !== 'table' || !Array.isArray(table.content)
    || !integer(table.content.length, 1, TABLE_LIMITS.rows)) fail('SHAPE_INVALID');
  attrsOnly(table, []);
  const rows = table.content.length, grid = Array.from({ length: rows }, () => []), cells = [];
  let width = 0, paragraphs = 0;
  table.content.forEach((row, y) => {
    if (row?.type !== 'tableRow' || !Array.isArray(row.content)) fail('ROW_INVALID');
    attrsOnly(row, []);
    let x = 0;
    for (const node of row.content) {
      while (grid[y][x]) x++;
      if (!['tableCell', 'tableHeader'].includes(node?.type)) fail('CELL_INVALID');
      attrsOnly(node, ['colspan', 'rowspan', 'colwidth']);
      const colspan = node.attrs?.colspan ?? 1, rowspan = node.attrs?.rowspan ?? 1;
      if (!integer(colspan, 1, TABLE_LIMITS.columns) || !integer(rowspan, 1, TABLE_LIMITS.rows)
        || x + colspan > TABLE_LIMITS.columns || y + rowspan > rows) fail('SPAN_INVALID');
      // Column resizing is not in this transport profile. Never discard it.
      if (node.attrs?.colwidth != null) fail('COLUMN_WIDTH_UNSUPPORTED');
      if (!Array.isArray(node.content) || !node.content.length
        || node.content.some(p => !['paragraph', 'heading', 'codeBlock'].includes(p?.type))) fail('CELL_CONTENT_UNSUPPORTED');
      paragraphs += node.content.length;
      if (paragraphs > TABLE_LIMITS.paragraphs) fail('PARAGRAPH_LIMIT');
      const cell = { node, row: y, column: x, colspan, rowspan, header: node.type === 'tableHeader' };
      for (let yy = y; yy < y + rowspan; yy++) for (let xx = x; xx < x + colspan; xx++) {
        if (grid[yy][xx]) fail('OVERLAP');
        grid[yy][xx] = cell;
      }
      cells.push(cell); x += colspan; width = Math.max(width, x);
    }
  });
  if (!width || width * rows > TABLE_LIMITS.slots) fail('GRID_LIMIT');
  for (const row of grid) {
    if (row.length !== width || Array.from({ length: width }, (_, x) => row[x]).some(x => !x)) fail('RAGGED_GRID');
    if (row.some(c => c.header) && row.some(c => !c.header)) fail('MIXED_HEADER_ROW_UNSUPPORTED');
  }
  return { rows, columns: width, cells, grid };
}

function tableParagraphs(table, tableId) {
  const layout = inspectTable(table);
  return layout.cells.flatMap(cell => cell.node.content.map((node, paragraphIndex) => ({
    node,
    table: { tableId, row: cell.row, column: cell.column, rowCount: layout.rows, columnCount: layout.columns,
      colspan: cell.colspan, rowspan: cell.rowspan, header: cell.header,
      paragraphIndex, paragraphCount: cell.node.content.length },
  })));
}

function validateMetadata(m) {
  if (!object(m) || Object.keys(m).length !== META_KEYS.length || Object.keys(m).some(k => !META_KEYS.includes(k))
    || !(typeof m.tableId === 'string' && m.tableId.length > 0 && m.tableId.length <= 512)
    || !integer(m.rowCount, 1, TABLE_LIMITS.rows) || !integer(m.columnCount, 1, TABLE_LIMITS.columns)
    || !integer(m.row, 0, m.rowCount - 1) || !integer(m.column, 0, m.columnCount - 1)
    || !integer(m.colspan, 1, m.columnCount - m.column) || !integer(m.rowspan, 1, m.rowCount - m.row)
    || !integer(m.paragraphCount, 1, TABLE_LIMITS.paragraphs) || !integer(m.paragraphIndex, 0, m.paragraphCount - 1)
    || typeof m.header !== 'boolean') fail('PROJECTION_INVALID');
}

// Group by explicit ownership, never by text (empty/repeated text is legal).
function groupTableParagraphs(items, metadata = item => item.table) {
  const groups = [], seen = new Set();
  for (let i = 0; i < items.length;) {
    const m = metadata(items[i], i);
    if (m === undefined || m === null) { groups.push({ item: items[i], index: i++ }); continue; }
    validateMetadata(m);
    if (seen.has(m.tableId)) fail('NONCONTIGUOUS_TABLE');
    seen.add(m.tableId);
    const table = { type: 'table', content: Array.from({ length: m.rowCount }, () => ({ type: 'tableRow', content: [] })) };
    const entries = [];
    let previousPosition = -1;
    while (i < items.length && metadata(items[i], i)?.tableId === m.tableId) {
      const first = metadata(items[i], i); validateMetadata(first);
      if (first.rowCount !== m.rowCount || first.columnCount !== m.columnCount || first.paragraphIndex !== 0) fail('PROJECTION_ORDER');
      const position = first.row * m.columnCount + first.column;
      if (position <= previousPosition) fail('CELL_ORDER');
      previousPosition = position;
      const cell = { type: first.header ? 'tableHeader' : 'tableCell', attrs: { colspan: first.colspan, rowspan: first.rowspan, colwidth: null }, content: [] };
      const paragraphs = [];
      for (let n = 0; n < first.paragraphCount; n++, i++) {
        const current = metadata(items[i], i); validateMetadata(current);
        if (META_KEYS.some(k => k !== 'paragraphIndex' && current[k] !== first[k]) || current.paragraphIndex !== n) fail('CELL_PARAGRAPH_BINDING');
        paragraphs.push({ item: items[i], index: i }); cell.content.push({ type: 'paragraph' });
      }
      table.content[first.row].content.push(cell);
      entries.push({ meta: first, paragraphs, node: cell });
    }
    const layout = inspectTable(table);
    if (layout.columns !== m.columnCount || layout.cells.some((cell, n) => cell.column !== entries[n].meta.column)) fail('GRID_BINDING');
    groups.push({ table, layout, cells: entries });
  }
  return groups;
}

function compareTableParagraphTopology(actual, expected) {
  const projection = (items, metadata) => {
    const result = []; let tableOrdinal = 0;
    for (const group of groupTableParagraphs(items, metadata)) {
      if (!group.table) continue;
      for (const cell of group.cells) for (const paragraph of cell.paragraphs) {
        const { tableId, ...shape } = metadata(paragraph.item, paragraph.index);
        result.push({ documentParagraphIndex: paragraph.index, tableOrdinal, ...shape });
      }
      tableOrdinal++;
    }
    return result;
  };
  try {
    const left = projection(actual, item => item.table), right = projection(expected, item => item.formatIr?.table);
    return { ok: JSON.stringify(left) === JSON.stringify(right),
      code: JSON.stringify(left) === JSON.stringify(right) ? 'DOCX_TABLE_TOPOLOGY_EQUAL' : 'DOCX_TABLE_TOPOLOGY_MISMATCH' };
  } catch (error) { return { ok: false, code: 'DOCX_TABLE_TOPOLOGY_INVALID', reason: error.message }; }
}

function tableGroupXml(group, renderParagraph) {
  const byNode = new Map(group.cells.map(cell => [cell.node, cell]));
  const rows = group.layout.grid.map((row, y) => {
    const cells = [];
    for (let x = 0; x < group.layout.columns;) {
      const cell = row[x], entry = byNode.get(cell.node), continuation = cell.row < y;
      const properties = `${cell.colspan > 1 ? `<w:gridSpan w:val="${cell.colspan}"/>` : ''}`
        + (cell.rowspan > 1 ? `<w:vMerge w:val="${continuation ? 'continue' : 'restart'}"/>` : '');
      cells.push(`<w:tc><w:tcPr>${properties}</w:tcPr>${continuation ? '<w:p/>' : entry.paragraphs.map(p => renderParagraph(p.item, p.index)).join('')}</w:tc>`);
      x += cell.colspan;
    }
    return `<w:tr>${row[0].header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`;
  });
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(side => `<w:${side} w:val="single" w:sz="4" w:color="auto"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${'<w:gridCol w:w="1440"/>'.repeat(group.layout.columns)}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

function renderTableParagraphs(items, metadata, renderParagraph) {
  return groupTableParagraphs(items, metadata).map(group => group.table
    ? tableGroupXml(group, renderParagraph) : renderParagraph(group.item, group.index)).join('');
}

// Consumes only namespace-resolved events from the existing bounded XML parser.
// It does not tokenize XML or trust names/attributes before namespace validation.
function createTableReader(paragraphs) {
  let active = null, row = null, cell = null, nextId = 0;
  const finish = () => {
    if (!active.rows.length || !active.gridColumns) fail('GRID_REQUIRED');
    const table = { type: 'table', content: [] }, sources = [], previous = [];
    for (let y = 0; y < active.rows.length; y++) {
      const sourceRow = active.rows[y], targetRow = { type: 'tableRow', content: [] }, current = [];
      let x = 0;
      for (const source of sourceRow.cells) {
        if (x + source.colspan > active.gridColumns) fail('GRID_SPAN_OVERFLOW');
        let origin;
        if (source.merge === 'continue') {
          origin = previous[x];
          if (!origin || origin.column !== x || origin.span !== source.colspan || !origin.merge
            || Array.from({ length: source.colspan }, (_, n) => previous[x + n]).some(c => c !== origin)
            || origin.node.type !== (sourceRow.header ? 'tableHeader' : 'tableCell')) fail('ORPHAN_VERTICAL_MERGE');
          origin.node.attrs.rowspan++;
        } else {
          const node = { type: sourceRow.header ? 'tableHeader' : 'tableCell',
            attrs: { colspan: source.colspan, rowspan: 1, colwidth: null },
            content: source.paragraphs.map(() => ({ type: 'paragraph' })) };
          targetRow.content.push(node);
          origin = { node, column: x, span: source.colspan, merge: source.merge === 'restart' };
          sources.push(...source.paragraphs);
        }
        for (let n = 0; n < source.colspan; n++) current[x + n] = origin;
        x += source.colspan;
      }
      if (x !== active.gridColumns) fail('RAGGED_GRID');
      previous.splice(0, previous.length, ...current); table.content.push(targetRow);
    }
    const records = tableParagraphs(table, `table-${nextId++}`);
    if (records.length !== sources.length) fail('PARAGRAPH_BINDING');
    records.forEach((record, i) => { sources[i].table = record.table; });
  };
  return {
    tag(name, parent, closing, selfClosing, attribute) {
      if (name === 'w:tbl') {
        if (closing) { if (!active || row || cell) fail('NESTING_INVALID'); finish(); active = null; }
        else {
          if (active || parent !== 'w:body' || selfClosing) fail('NESTING_UNSUPPORTED');
          active = { rows: [], gridColumns: 0, gridSeen: false };
        }
        return;
      }
      if (!active) return;
      if (name === 'w:tblGrid' && !closing) {
        if (parent !== 'w:tbl' || active.gridSeen || row) fail('GRID_INVALID');
        active.gridSeen = true;
      } else if (name === 'w:gridCol' && !closing) {
        if (parent !== 'w:tblGrid' || ++active.gridColumns > TABLE_LIMITS.columns) fail('GRID_LIMIT');
      } else if (name === 'w:tr') {
        if (closing) { if (!row || cell) fail('ROW_INVALID'); row = null; }
        else {
          if (parent !== 'w:tbl' || row || selfClosing || active.rows.length >= TABLE_LIMITS.rows) fail('ROW_INVALID');
          row = { cells: [], header: false }; active.rows.push(row);
        }
      } else if (name === 'w:tblHeader' && !closing) {
        if (parent !== 'w:trPr' || !row || cell || row.headerSeen) fail('HEADER_INVALID');
        const value = attribute('val');
        if (!['', '1', '0', 'true', 'false', 'on', 'off'].includes(value)) fail('HEADER_INVALID');
        row.headerSeen = true; row.header = !['0', 'false', 'off'].includes(value);
      } else if (name === 'w:tc') {
        if (closing) {
          if (!cell) fail('CELL_INVALID');
          cell.paragraphs = paragraphs.slice(cell.start);
          if (!cell.paragraphs.length) fail('EMPTY_CELL_STRUCTURE');
          if (cell.merge === 'continue') {
            if (cell.paragraphs.length !== 1 || cell.paragraphs[0].text !== '' || cell.paragraphs[0].continuationEmpty === false) fail('MERGE_CONTINUATION_CONTENT');
            paragraphs.splice(cell.start); cell.paragraphs = [];
          }
          cell = null;
        } else {
          if (parent !== 'w:tr' || !row || cell || selfClosing || row.cells.length >= TABLE_LIMITS.columns) fail('CELL_INVALID');
          cell = { start: paragraphs.length, colspan: 1, merge: '', paragraphs: [] }; row.cells.push(cell);
        }
      } else if ((name === 'w:gridSpan' || name === 'w:vMerge') && !closing) {
        if (parent !== 'w:tcPr' || !cell || paragraphs.length !== cell.start) fail('PROPERTY_OWNER_INVALID');
        if (name === 'w:gridSpan') {
          const value = attribute('val');
          if (cell.spanSeen || !/^[1-9]\d{0,2}$/u.test(value) || Number(value) > TABLE_LIMITS.columns) fail('SPAN_INVALID');
          cell.spanSeen = true; cell.colspan = Number(value);
        } else {
          const value = attribute('val') || 'continue';
          if (cell.merge || !['restart', 'continue'].includes(value)) fail('MERGE_INVALID');
          cell.merge = value;
        }
      } else if (['w:hMerge', 'w:gridBefore', 'w:gridAfter', 'w:tblPrEx'].includes(name)) {
        fail('STRUCTURE_UNSUPPORTED');
      } else if (name === 'w:p' && !closing && (!cell || parent !== 'w:tc')) {
        fail('PARAGRAPH_OWNER_INVALID');
      }
    },
    complete() { if (active || row || cell) fail('UNCLOSED'); },
  };
}

module.exports = { compareTableParagraphTopology, TABLE_LIMITS, inspectTable, tableParagraphs, groupTableParagraphs, renderTableParagraphs, createTableReader };

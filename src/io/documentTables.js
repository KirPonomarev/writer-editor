'use strict';

// Pure document data: no DOM, I/O, provider or mutation authority.
const { EDGES, MAX_DXA, validateTableProperties, validateCellProperties, legacyTableProperties, propertiesEqual, borderXml, shadingXml } = require('./documentTableProperties.js');
const TABLE_LIMITS = Object.freeze({ rows: 512, columns: 128, slots: 65536, paragraphs: 50000, lists: 2048, listDepth: 8, tableDepth: 4, tables: 256 });
const META_KEYS = ['tableId', 'row', 'column', 'rowCount', 'columnCount', 'colspan', 'rowspan', 'header', 'paragraphIndex', 'paragraphCount'];
const fail = code => { throw new Error(`DOCX_TABLE_${code}`); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function attrsOnly(node, allowed) {
  if (node.attrs != null && !object(node.attrs)) fail('ATTR_INVALID');
  if (Object.entries(node.attrs || {}).some(([key, value]) => value != null && !allowed.includes(key))) fail('ATTR_UNSUPPORTED');
}
function integer(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }

// Leaf addresses retain list ownership as well as cell ownership. Empty and
// repeated paragraphs are real leaves, never inferred from their text.
function cellParagraphs(content, budget, depth) {
  if (!Array.isArray(content) || !content.length) fail('CELL_CONTENT_UNSUPPORTED');
  const result = [];
  const append = (node, listStack) => {
    if (++budget.paragraphs > TABLE_LIMITS.paragraphs) fail('PARAGRAPH_LIMIT');
    result.push({ node, listStack });
  };
  const visitList = (list, ancestors) => {
    if (ancestors.length > TABLE_LIMITS.listDepth || ++budget.lists > TABLE_LIMITS.lists) fail('LIST_LIMIT');
    attrsOnly(list, list.type === 'orderedList' ? ['start', 'type'] : []);
    const start = list.type === 'orderedList' ? (list.attrs?.start ?? 1) : 1;
    if (!Array.isArray(list.content) || !list.content.length
      || !integer(start, 0, 2147483647) || start + list.content.length - 1 > 2147483647
      || (list.attrs?.type != null && !['1', 'I', 'i', 'A', 'a'].includes(list.attrs.type))) fail('LIST_INVALID');
    const listId = budget.lists;
    list.content.forEach((item, itemOrdinal) => {
      if (item?.type !== 'listItem' || !Array.isArray(item.content) || item.content[0]?.type !== 'paragraph'
        || item.content.slice(1).some(n => !['bulletList', 'orderedList'].includes(n?.type))) fail('LIST_ITEM_UNSUPPORTED');
      attrsOnly(item, []);
      const listStack = [...ancestors, { listId, kind: list.type, start, itemOrdinal, ...(list.attrs?.type ? { type: list.attrs.type } : {}) }];
      append(item.content[0], listStack);
      for (const nested of item.content.slice(1)) visitList(nested, listStack);
    });
  };
  for (const node of content) {
    if (['paragraph', 'heading', 'codeBlock'].includes(node?.type)) append(node, []);
    else if (['bulletList', 'orderedList'].includes(node?.type)) visitList(node, []);
    else if (node?.type === 'table') {
      const layout = inspectTable(node, budget, depth + 1);
      result.push({ table: node, layout });
    } else fail('CELL_CONTENT_UNSUPPORTED');
  }
  if (content.some(node => node?.type === 'table') && content.at(-1)?.type !== 'paragraph') fail('CELL_TRAILING_PARAGRAPH_REQUIRED');
  return result;
}

function inspectTable(table, budget = { paragraphs: 0, lists: 0, tables: 0, slots: 0 }, depth = 0) {
  if (depth >= TABLE_LIMITS.tableDepth) fail('DEPTH_LIMIT');
  if (++budget.tables > TABLE_LIMITS.tables) fail('COUNT_LIMIT');
  if (!object(table) || table.type !== 'table' || !Array.isArray(table.content)
    || !integer(table.content.length, 1, TABLE_LIMITS.rows)) fail('SHAPE_INVALID');
  attrsOnly(table, ['wordTable']);
  const rows = table.content.length, grid = Array.from({ length: rows }, () => []), cells = [];
  let width = 0;
  table.content.forEach((row, y) => {
    if (row?.type !== 'tableRow' || !Array.isArray(row.content)) fail('ROW_INVALID');
    attrsOnly(row, []);
    let x = 0;
    for (const node of row.content) {
      while (grid[y][x]) x++;
      if (!['tableCell', 'tableHeader'].includes(node?.type)) fail('CELL_INVALID');
      attrsOnly(node, ['colspan', 'rowspan', 'colwidth', 'wordCell']);
      const colspan = node.attrs?.colspan ?? 1, rowspan = node.attrs?.rowspan ?? 1;
      if (!integer(colspan, 1, TABLE_LIMITS.columns) || !integer(rowspan, 1, TABLE_LIMITS.rows)
        || x + colspan > TABLE_LIMITS.columns || y + rowspan > rows) fail('SPAN_INVALID');
      // Column resizing is not in this transport profile. Never discard it.
      if (node.attrs?.colwidth != null) fail('COLUMN_WIDTH_UNSUPPORTED');
      const blocks = cellParagraphs(node.content, budget, depth);
      const paragraphs = blocks.flatMap(block => block.table ? block.layout.cells.flatMap(c => c.paragraphs) : [block]);
      validateCellProperties(node.attrs?.wordCell);
      const cell = { node, paragraphs, blocks, row: y, column: x, colspan, rowspan, header: node.type === 'tableHeader' };
      for (let yy = y; yy < y + rowspan; yy++) for (let xx = x; xx < x + colspan; xx++) {
        if (grid[yy][xx]) fail('OVERLAP');
        grid[yy][xx] = cell;
      }
      cells.push(cell); x += colspan; width = Math.max(width, x);
    }
  });
  if (!width || (budget.slots += width * rows) > TABLE_LIMITS.slots) fail('GRID_LIMIT');
  for (const row of grid) {
    if (row.length !== width || Array.from({ length: width }, (_, x) => row[x]).some(x => !x)) fail('RAGGED_GRID');
    if (row.some(c => c.header) && row.some(c => !c.header)) fail('MIXED_HEADER_ROW_UNSUPPORTED');
  }
  validateTableProperties(table.attrs?.wordTable, width);
  return { rows, columns: width, cells, grid };
}

function tableParagraphs(table, tableId) {
  const layout = inspectTable(table); let nextId = 0;
  const project = (node, grid, id) => grid.cells.flatMap(cell => {
    const leaves = cell.blocks.flatMap(block => block.table
      ? project(block.table, block.layout, `${tableId}:nested-${++nextId}`).map(leaf => ({ ...leaf, nested: leaf.table }))
      : [block]);
    return leaves.map(({ node: paragraph, listStack, nested }, paragraphIndex) => ({
      node: paragraph, listStack,
      table: { tableId: id, row: cell.row, column: cell.column, rowCount: grid.rows, columnCount: grid.columns,
        colspan: cell.colspan, rowspan: cell.rowspan, header: cell.header,
        paragraphIndex, paragraphCount: leaves.length,
        ...(node.attrs?.wordTable ? { wordTable: node.attrs.wordTable } : {}),
        ...(cell.node.attrs?.wordCell ? { wordCell: cell.node.attrs.wordCell } : {}),
        ...(nested ? { nested } : {}) },
    }));
  });
  return project(table, layout, tableId);
}

function validateMetadata(m, depth = 0) {
  if (depth >= TABLE_LIMITS.tableDepth) fail('DEPTH_LIMIT');
  if (!object(m) || META_KEYS.some(k => !Object.hasOwn(m, k)) || Object.keys(m).some(k => ![...META_KEYS, 'wordTable', 'wordCell', 'nested'].includes(k))
    || !(typeof m.tableId === 'string' && m.tableId.length > 0 && m.tableId.length <= 512)
    || !integer(m.rowCount, 1, TABLE_LIMITS.rows) || !integer(m.columnCount, 1, TABLE_LIMITS.columns)
    || !integer(m.row, 0, m.rowCount - 1) || !integer(m.column, 0, m.columnCount - 1)
    || !integer(m.colspan, 1, m.columnCount - m.column) || !integer(m.rowspan, 1, m.rowCount - m.row)
    || !integer(m.paragraphCount, 1, TABLE_LIMITS.paragraphs) || !integer(m.paragraphIndex, 0, m.paragraphCount - 1)
    || typeof m.header !== 'boolean') fail('PROJECTION_INVALID');
  validateTableProperties(m.wordTable, m.columnCount); validateCellProperties(m.wordCell);
  if (Object.hasOwn(m, 'nested')) validateMetadata(m.nested, depth + 1);
}

// Group by explicit ownership, never by text (empty/repeated text is legal).
function groupTableParagraphs(items, metadata = item => item.table) {
  const seen = new Set(); let slots = 0;
  const group = (rows, address, depth = 0) => {
    const groups = [];
    for (let i = 0; i < rows.length;) {
      const m = address(rows[i]);
      if (m === undefined || m === null) { groups.push(rows[i++]); continue; }
      validateMetadata(m, depth);
      if (seen.has(m.tableId)) fail('NONCONTIGUOUS_TABLE');
      seen.add(m.tableId);
      if (seen.size > TABLE_LIMITS.tables) fail('COUNT_LIMIT');
      if ((slots += m.rowCount * m.columnCount) > TABLE_LIMITS.slots) fail('GRID_LIMIT');
      const table = { type: 'table', content: Array.from({ length: m.rowCount }, () => ({ type: 'tableRow', content: [] })) };
      if (m.wordTable) table.attrs = { wordTable: m.wordTable };
      const entries = []; let previousPosition = -1;
      while (i < rows.length && address(rows[i])?.tableId === m.tableId) {
        const first = address(rows[i]); validateMetadata(first, depth);
        if (first.rowCount !== m.rowCount || first.columnCount !== m.columnCount || first.paragraphIndex !== 0 || !propertiesEqual(first.wordTable, m.wordTable)) fail('PROJECTION_ORDER');
        const position = first.row * m.columnCount + first.column;
        if (position <= previousPosition) fail('CELL_ORDER');
        previousPosition = position;
        const cell = { type: first.header ? 'tableHeader' : 'tableCell', attrs: { colspan: first.colspan, rowspan: first.rowspan, colwidth: null }, content: [] };
        if (first.wordCell) cell.attrs.wordCell = first.wordCell;
        const paragraphs = [];
        for (let n = 0; n < first.paragraphCount; n++, i++) {
          const current = address(rows[i]); validateMetadata(current, depth);
          if ([...META_KEYS, 'wordTable', 'wordCell'].some(k => k !== 'paragraphIndex' && !propertiesEqual(current[k], first[k])) || current.paragraphIndex !== n) fail('CELL_PARAGRAPH_BINDING');
          paragraphs.push(rows[i]);
        }
        const children = group(paragraphs, row => address(row)?.nested, depth + 1);
        cell.content = children.map(child => child.table || { type: 'paragraph' });
        table.content[first.row].content.push(cell);
        entries.push({ meta: first, paragraphs, groups: children, node: cell });
      }
      const layout = inspectTable(table);
      if (layout.columns !== m.columnCount || layout.cells.some((cell, n) => cell.column !== entries[n].meta.column)) fail('GRID_BINDING');
      groups.push({ table, layout, cells: entries });
    }
    return groups;
  };
  return group(items.map((item, index) => ({ item, index })), row => row && metadata(row.item, row.index));
}

function compareTableParagraphTopology(actual, expected) {
  const projection = (items, metadata) => {
    groupTableParagraphs(items, metadata);
    const ordinals = new Map();
    const shape = value => {
      const { tableId, nested, ...rest } = value;
      if (!ordinals.has(tableId)) ordinals.set(tableId, ordinals.size);
      return { tableOrdinal: ordinals.get(tableId), ...rest, ...(nested ? { nested: shape(nested) } : {}) };
    };
    return items.flatMap((item, index) => {
      const value = metadata(item, index);
      return value ? [{ documentParagraphIndex: index, ...shape(value) }] : [];
    });
  };
  try {
    const left = projection(actual, item => item.table), right = projection(expected, item => item.formatIr?.table);
    // A legacy table has no stored geometry: its exported auto-fit grid is a
    // layout hint which Word recomputes after edits. Only the authenticated
    // local map may establish this case. Explicit grids and every other table
    // or cell property remain part of the strict comparison below.
    const normalize = (returnedShape, expectedShape) => {
      const returned = returnedShape?.wordTable;
      if (expectedShape && expectedShape.wordTable === undefined && returned) {
        const implicit = legacyTableProperties(returnedShape.columnCount);
        if (returned.grid.every(w => Number.isSafeInteger(w) && w > 0)
          && propertiesEqual({ ...returned, grid: implicit.grid }, implicit)) delete returnedShape.wordTable;
      }
      if (returnedShape?.nested) normalize(returnedShape.nested, expectedShape?.nested);
    };
    left.forEach((value, i) => normalize(value, right[i]));
    return { ok: propertiesEqual(left, right),
      code: propertiesEqual(left, right) ? 'DOCX_TABLE_TOPOLOGY_EQUAL' : 'DOCX_TABLE_TOPOLOGY_MISMATCH' };
  } catch (error) { return { ok: false, code: 'DOCX_TABLE_TOPOLOGY_INVALID', reason: error.message }; }
}

function tableGroupXml(group, renderParagraph, renderRowProperties, nestedTree = false) {
  nestedTree ||= group.cells.some(cell => cell.groups.some(child => child.table));
  const byNode = new Map(group.cells.map(cell => [cell.node, cell]));
  const explicit = group.table.attrs?.wordTable;
  const rows = group.layout.grid.map((row, y) => {
    const cells = [];
    for (let x = 0; x < group.layout.columns;) {
      const cell = row[x], entry = byNode.get(cell.node), continuation = cell.row < y;
      const widths = explicit?.grid.slice(x, x + cell.colspan);
      const widthSum = widths?.every(w => Number.isSafeInteger(w) && w > 0)
        ? widths.reduce((sum, w) => sum + w, 0) : null;
      const preferredWidth = cell.node.attrs?.wordCell?.widthDxa ?? widthSum;
      const cellWidth = preferredWidth !== null && preferredWidth <= MAX_DXA
        ? `<w:tcW w:w="${preferredWidth}" w:type="dxa"/>` : '';
      const properties = cellWidth + `${cell.colspan > 1 ? `<w:gridSpan w:val="${cell.colspan}"/>` : ''}`
        + (cell.rowspan > 1 ? `<w:vMerge w:val="${continuation ? 'continue' : 'restart'}"/>` : '')
        + (cell.node.attrs?.wordCell ? borderXml(cell.node.attrs.wordCell.borders, 'tcBorders') + shadingXml(cell.node.attrs.wordCell.shading) : '');
      cells.push(`<w:tc><w:tcPr>${properties}</w:tcPr>${continuation ? '<w:p/>' : entry.groups.map(child => child.table ? tableGroupXml(child, renderParagraph, renderRowProperties, nestedTree) : renderParagraph(child.item, child.index)).join('')}</w:tc>`);
      x += cell.colspan;
    }
    const properties = (row[0].header ? '<w:tblHeader/>' : '')
      + (renderRowProperties?.(group.cells.filter(cell => cell.meta.row === y).flatMap(cell => cell.paragraphs)) || '');
    return `<w:tr>${properties ? `<w:trPr>${properties}</w:trPr>` : ''}${cells.join('')}</w:tr>`;
  });
  const props = explicit || legacyTableProperties(group.layout.columns);
  const width = props.widthDxa === null ? (explicit ? '' : '<w:tblW w:w="0" w:type="auto"/>') : `<w:tblW w:w="${props.widthDxa}" w:type="dxa"/>`;
  const layout = props.layout === 'fixed' ? '<w:tblLayout w:type="fixed"/>' : '';
  // The supported nested-table grammar has zero cell margins. Omitting them
  // lets Word inject defaults and shrink an inner auto-fit grid on save even
  // when only a footnote was edited. Keep the actual stored geometry strict.
  const margins = nestedTree ? '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' : '';
  const grid = props.grid.map(w => w === null ? '<w:gridCol/>' : `<w:gridCol w:w="${w}"/>`).join('');
  return `<w:tbl><w:tblPr>${width}${borderXml(props.borders, 'tblBorders')}${shadingXml(props.shading)}${layout}${margins}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

function renderTableParagraphs(items, metadata, renderParagraph, renderRowProperties) {
  return groupTableParagraphs(items, metadata).map(group => group.table
    ? tableGroupXml(group, renderParagraph, renderRowProperties) : renderParagraph(group.item, group.index)).join('');
}

// Consumes only namespace-resolved events from the existing bounded XML parser.
// It does not tokenize XML or trust names/attributes before namespace validation.
function createTableReader(paragraphs, onLoss = () => {}) {
  let active = null, row = null, cell = null, nextId = 0, zeroMargins = null;
  const parents = [];
  const property = value => {
    if (typeof value !== 'string' || value.length > 128 || /[\u0000-\u001f\u007f]/u.test(value)) fail('PROPERTY_INVALID');
    return value;
  };
  const loss = (feature, sourceProperty, transformation, columnIndex) => {
    const location = { tableIndex: active.id };
    if (row) location.rowIndex = active.rows.length - 1;
    if (columnIndex !== undefined) location.columnIndex = columnIndex;
    else if (cell) location.columnIndex = row.cells.slice(0, -1).reduce((sum, item) => sum + item.colspan, 0);
    const place = `Table ${active.id + 1}${location.rowIndex !== undefined ? ` row ${location.rowIndex + 1}` : ''}${location.columnIndex !== undefined ? ` column ${location.columnIndex + 1}` : ''}`;
    onLoss({ feature: `table.${feature}`, location, sourceProperty, transformation,
      message: `${place}: ${sourceProperty}; ${transformation}.` });
  };
  const finish = () => {
    if (!active.rows.length || !active.gridColumns) fail('GRID_REQUIRED');
    const table = { type: 'table', content: [] }, sources = [], previous = [];
    validateTableProperties(active.properties, active.gridColumns);
    if (!propertiesEqual(active.properties, legacyTableProperties(active.gridColumns))) table.attrs = { wordTable: active.properties };
    for (let y = 0; y < active.rows.length; y++) {
      const sourceRow = active.rows[y], targetRow = { type: 'tableRow', content: [] }, current = [];
      let x = 0;
      for (const source of sourceRow.cells) {
        if (x + source.colspan > active.gridColumns) fail('GRID_SPAN_OVERFLOW');
        let origin;
        const widths = active.properties.grid.slice(x, x + source.colspan);
        if (source.widthDxa !== undefined && (widths.some(w => w === null) || source.widthDxa !== widths.reduce((sum, w) => sum + w, 0))) {
          // Word's preferred cell width is independent of the computed grid.
          // Keep both; conflating them silently changes subsequent layout.
          source.properties.widthDxa = source.widthDxa;
        }
        if (source.merge === 'continue') {
          origin = previous[x];
          if (!origin || origin.column !== x || origin.span !== source.colspan || !origin.merge
            || Array.from({ length: source.colspan }, (_, n) => previous[x + n]).some(c => c !== origin)
            || origin.node.type !== (sourceRow.header ? 'tableHeader' : 'tableCell')) fail('ORPHAN_VERTICAL_MERGE');
          if (!propertiesEqual(source.properties, origin.properties)) fail('MERGED_CELL_PROPERTIES_CONFLICT');
          origin.node.attrs.rowspan++;
        } else {
          const node = { type: sourceRow.header ? 'tableHeader' : 'tableCell',
            attrs: { colspan: source.colspan, rowspan: 1, colwidth: null },
            content: source.blocks };
          if (source.properties.shading !== null || Object.keys(source.properties.borders).length || source.properties.widthDxa !== undefined) node.attrs.wordCell = source.properties;
          targetRow.content.push(node);
          origin = { node, properties: source.properties, column: x, span: source.colspan, merge: source.merge === 'restart' };
          sources.push(...source.paragraphs);
        }
        for (let n = 0; n < source.colspan; n++) current[x + n] = origin;
        x += source.colspan;
      }
      if (x !== active.gridColumns) fail('RAGGED_GRID');
      previous.splice(0, previous.length, ...current); table.content.push(targetRow);
    }
    const records = tableParagraphs(table, `table-${active.id}`);
    if (records.length !== sources.length) fail('PARAGRAPH_BINDING');
    if (!parents.length) {
      // Keep XML occurrence IDs, including nested table style ownership.
      // IDs are assigned in first leaf occurrence order by the projection.
      const seenIds = new Map();
      const rename = value => { if (!seenIds.has(value.tableId)) seenIds.set(value.tableId, `table-${active.id + seenIds.size}`); value.tableId = seenIds.get(value.tableId); if (value.nested) rename(value.nested); };
      records.forEach(record => rename(record.table));
      records.forEach((record, i) => { sources[i].table = record.table; });
    }
    return table;
  };
  return {
    tag(name, parent, closing, selfClosing, attribute) {
      // Word can materialize zero top/bottom row cell margins after review.
      // Accept exactly that neutral form; other row exceptions remain blocked.
      if (zeroMargins) {
        if (name === 'w:tblPrEx' && closing) {
          if (!zeroMargins.container || zeroMargins.sides.size !== 2) fail('ROW_EXCEPTION_UNSUPPORTED');
          zeroMargins = null;
        } else if (name === 'w:tblCellMar' && parent === 'w:tblPrEx') {
          if (!closing) {
            if (zeroMargins.container || selfClosing) fail('ROW_EXCEPTION_UNSUPPORTED');
            zeroMargins.container = true;
          }
        } else if (['w:top', 'w:bottom'].includes(name) && parent === 'w:tblCellMar') {
          if (!closing) {
            if (zeroMargins.sides.has(name) || attribute('w') !== '0' || attribute('type') !== 'dxa') fail('ROW_EXCEPTION_UNSUPPORTED');
            zeroMargins.sides.add(name);
          }
        } else fail('ROW_EXCEPTION_UNSUPPORTED');
        return;
      }
      if (name === 'w:tblPrEx') {
        if (closing || selfClosing || parent !== 'w:tr' || !row || cell || row.cells.length || row.exceptionSeen) fail('ROW_EXCEPTION_UNSUPPORTED');
        row.exceptionSeen = true; zeroMargins = { container: false, sides: new Set() };
        return;
      }
      if (name === 'w:tbl') {
        if (closing) {
          if (!active || row || cell) fail('NESTING_INVALID');
          const finished = finish();
          if (parents.length) {
            ({ active, row, cell, zeroMargins } = parents.pop());
            cell.blocks.push(finished); cell.cursor = paragraphs.length;
          } else active = null;
        }
        else {
          if (selfClosing || (active ? !cell || parent !== 'w:tc' : parent !== 'w:body')) fail('NESTING_UNSUPPORTED');
          if (parents.length + 1 >= TABLE_LIMITS.tableDepth && active) fail('DEPTH_LIMIT');
          if (nextId >= TABLE_LIMITS.tables) fail('COUNT_LIMIT');
          if (active) {
            cell.blocks.push(...paragraphs.slice(cell.cursor).map(() => ({ type: 'paragraph' })));
            parents.push({ active, row, cell, zeroMargins }); row = null; cell = null; zeroMargins = null;
          }
          active = { id: nextId++, rows: [], gridColumns: 0, gridSeen: false, seen: new Set(),
            properties: { version: 1, grid: [], layout: null, widthDxa: null, shading: null, borders: {} } };
        }
        return;
      }
      if (!active) return;
      if (name === 'w:tblGrid' && !closing) {
        if (parent !== 'w:tbl' || active.gridSeen || row) fail('GRID_INVALID');
        active.gridSeen = true;
      } else if (name === 'w:gridCol' && !closing) {
        if (parent !== 'w:tblGrid' || ++active.gridColumns > TABLE_LIMITS.columns) fail('GRID_LIMIT');
        const width = property(attribute('w'));
        if (width !== '' && (!/^[1-9]\d{0,4}$/u.test(width) || Number(width) > MAX_DXA)) fail('GRID_WIDTH_INVALID');
        active.properties.grid.push(width === '' ? null : Number(width));
      } else if (!closing && name === 'w:tblStyle' && parent === 'w:tblPr') {
        if (row || active.seen.has(name)) fail('PROPERTY_OWNER_INVALID');
        active.seen.add(name);
        const styleId = property(attribute('val'));
        loss('borders', `w:tblStyle=${styleId || 'unspecified'}`, 'table style inheritance is not retained; only explicit literal table/cell properties are retained');
      } else if (!closing && ['w:tblW', 'w:tcW', 'w:tblLayout', 'w:shd', 'w:tblBorders', 'w:tcBorders'].includes(name)
        && !(name === 'w:shd' && parent === 'w:rPr')) {
        // Run shading belongs to the inline grammar, including explicit resets
        // emitted with pending text. It cannot mutate table or cell properties.
        const isCell = ['w:tcW', 'w:tcBorders'].includes(name) || name === 'w:shd' && parent === 'w:tcPr';
        const owner = isCell ? cell : active;
        if (!owner || parent !== (isCell ? 'w:tcPr' : 'w:tblPr') || !isCell && row || isCell && paragraphs.length !== cell.start) fail('PROPERTY_OWNER_INVALID');
        if (owner.seen.has(name)) fail('PROPERTY_DUPLICATE');
        owner.seen.add(name);
        const props = owner.properties;
        if (name === 'w:tblLayout') {
          const type = property(attribute('type'));
          if (type === 'fixed') props.layout = 'fixed';
          else loss('widths', `w:tblLayout type=${type || 'unspecified'}`, 'automatic layout is not certified; explicit grid widths are retained');
        } else if (['w:tblW', 'w:tcW'].includes(name)) {
          const width = property(attribute('w')), type = property(attribute('type'));
          if (type === 'dxa' && /^[1-9]\d{0,4}$/u.test(width) && Number(width) <= MAX_DXA) {
            if (isCell) owner.widthDxa = Number(width); else props.widthDxa = Number(width);
          } else if (!(type === 'auto' && (width === '0' || width === ''))) {
            loss('widths', `${name} width=${width || 'unspecified'} type=${type || 'unspecified'}`, 'unsupported preferred width is not retained; explicit grid widths are retained');
          }
        } else if (name === 'w:shd') {
          const keys = ['val', 'color', 'fill', 'themeColor', 'themeFill', 'themeTint', 'themeShade', 'themeFillTint', 'themeFillShade'];
          const values = Object.fromEntries(keys.map(key => [key, property(attribute(key))]));
          if (['', 'clear', 'nil'].includes(values.val) && ['', 'auto'].includes(values.color)
            && (['', 'auto'].includes(values.fill) || /^[0-9a-fA-F]{6}$/u.test(values.fill)) && !keys.slice(3).some(k => values[k])) {
            props.shading = values.val === 'nil' || ['', 'auto'].includes(values.fill) ? 'none' : values.fill.toUpperCase();
          } else loss('shading', keys.filter(key => values[key]).map(key => `w:${key}=${values[key]}`).join(', ') || 'w:shd', 'unsupported shading is not retained');
        }
      } else if (!closing && ['w:tblBorders', 'w:tcBorders'].includes(parent)) {
        const owner = parent === 'w:tcBorders' ? cell : active, edge = name.slice(2);
        if (!owner || !owner.seen.has(parent) || parent === 'w:tblBorders' && row) fail('PROPERTY_OWNER_INVALID');
        if (owner.seen.has(`border:${name}`)) fail('PROPERTY_DUPLICATE');
        owner.seen.add(`border:${name}`);
        const keys = ['val', 'sz', 'color', 'space', 'shadow', 'frame', 'themeColor', 'themeTint', 'themeShade'];
        const v = Object.fromEntries(keys.map(key => [key, property(attribute(key))]));
        const simple = EDGES.includes(edge) && ['', '0'].includes(v.space) && ['', '0', 'false', 'off'].includes(v.shadow)
          && ['', '0', 'false', 'off'].includes(v.frame) && !v.themeColor && !v.themeTint && !v.themeShade;
        if (simple && ['none', 'nil'].includes(v.val)) owner.properties.borders[edge] = { style: v.val };
        else if (simple && ['single', 'double'].includes(v.val) && /^\d{1,2}$/u.test(v.sz) && Number(v.sz) >= 2 && Number(v.sz) <= 96
          && (['', 'auto'].includes(v.color) || /^[0-9a-fA-F]{6}$/u.test(v.color))) {
          owner.properties.borders[edge] = { style: v.val, size: Number(v.sz), color: v.color ? v.color.toUpperCase().replace('AUTO', 'auto') : 'auto' };
        } else loss('borders', `${parent}/${name}: ${keys.filter(key => v[key]).map(key => `${key}=${v[key]}`).join(', ')}`, 'unsupported border is not retained');
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
          cell.blocks.push(...paragraphs.slice(cell.cursor).map(() => ({ type: 'paragraph' })));
          if (cell.blocks.some(node => node.type === 'table') && cell.blocks.at(-1)?.type !== 'paragraph') fail('CELL_TRAILING_PARAGRAPH_REQUIRED');
          if (!cell.paragraphs.length) fail('EMPTY_CELL_STRUCTURE');
          if (cell.merge === 'continue') {
            if (cell.blocks.some(node => node.type === 'table') || cell.paragraphs.length !== 1 || cell.paragraphs[0].text !== '' || cell.paragraphs[0].continuationEmpty === false) fail('MERGE_CONTINUATION_CONTENT');
            paragraphs.splice(cell.start); cell.paragraphs = [];
          }
          cell = null;
        } else {
          if (parent !== 'w:tr' || !row || cell || selfClosing || row.cells.length >= TABLE_LIMITS.columns) fail('CELL_INVALID');
          cell = { start: paragraphs.length, cursor: paragraphs.length, blocks: [], colspan: 1, merge: '', paragraphs: [], seen: new Set(), properties: { version: 1, shading: null, borders: {} } }; row.cells.push(cell);
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
      } else if (['w:hMerge', 'w:gridBefore', 'w:gridAfter'].includes(name)) {
        fail('STRUCTURE_UNSUPPORTED');
      } else if (name === 'w:p' && !closing && (!cell || parent !== 'w:tc')) {
        fail('PARAGRAPH_OWNER_INVALID');
      }
    },
    complete() { if (active || row || cell || zeroMargins || parents.length) fail('UNCLOSED'); },
  };
}

module.exports = { compareTableParagraphTopology, TABLE_LIMITS, inspectTable, tableParagraphs, groupTableParagraphs, renderTableParagraphs, createTableReader };

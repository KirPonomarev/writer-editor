'use strict';
const { escapeXml } = require('./docxTextXml.js');
const { buildDocxWordLanguageXml } = require('./docxInlineTypography.js');
const { normalizeWordParagraphSpacing } = require('../../core/word-paragraph-spacing-v1.cjs');
function buildDocxWordParagraphSpacingXml(value) {
  if (value == null) return '';
  const spacing = normalizeWordParagraphSpacing(value);
  return '<w:spacing' + ['before','after','line','lineRule'].filter(key => Object.hasOwn(spacing,key)).map(key => ` w:${key}="${spacing[key]}"`).join('') + '/>';
}
function revisionAttributes(revision, counter) {
  return ` w:id="${counter.next++}" w:author="${escapeXml(revision.author)}"`
    + (revision.date ? ` w:date="${escapeXml(revision.date)}"` : '')
    + (revision.dateUtc ? ` xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" w16du:dateUtc="${escapeXml(revision.dateUtc)}"` : '');
}
function buildPendingParagraphPropertiesXml(propertiesXml, revision, counter) {
  if (!revision || revision.state !== 'pending') return propertiesXml;
  if (revision.operation !== 'format' || revision.format?.kind !== 'paragraph') throw Error('PENDING_FORMAT_EXPORT_INVALID');
  const before = revision.format.before;
  const body = propertiesXml.replace(/^<w:pPr>/u, '').replace(/<\/w:pPr>$/u, '');
  let protectedProperties = body.replace(/<w:(?:jc|pStyle|outlineLvl|spacing|lang)\b[^>]*\/>/gu, '');
  const oldLanguage = buildDocxWordLanguageXml(before.attrs?.wordParagraphMarkLanguage);
  if (protectedProperties.includes('</w:rPr>')) protectedProperties = protectedProperties.replace('</w:rPr>', oldLanguage + '</w:rPr>');
  else if (oldLanguage) protectedProperties += `<w:rPr>${oldLanguage}</w:rPr>`;
  protectedProperties = protectedProperties.replace(/<w:rPr><\/w:rPr>/gu, '');
  const old = `<w:pStyle w:val="${before.type === 'heading' ? `Heading${before.attrs.level}` : 'Normal'}"/>`
    + (before.type === 'heading' ? `<w:outlineLvl w:val="${before.attrs.level - 1}"/>` : '')
    + (before.attrs?.textAlign ? `<w:jc w:val="${escapeXml(before.attrs.textAlign === 'justify' ? 'both' : before.attrs.textAlign)}"/>` : '')
    + buildDocxWordParagraphSpacingXml(before.attrs?.wordParagraphSpacing)
    + protectedProperties;
  return `<w:pPr>${body}<w:pPrChange${revisionAttributes(revision, counter)}><w:pPr>${old}</w:pPr></w:pPrChange></w:pPr>`;
}
function buildPendingParagraphBoundaryXml(propertiesXml, revision, counter) {
  if (!revision) return propertiesXml;
  if (revision.boundary !== 'paragraph' || revision.state !== 'pending' || !['insert', 'delete'].includes(revision.operation))
    throw Error('PENDING_PARAGRAPH_BOUNDARY_INVALID');
  const body = propertiesXml.replace(/^<w:pPr>/u, '').replace(/<\/w:pPr>$/u, '');
  const mark = `<w:rPr><w:${revision.operation === 'insert' ? 'ins' : 'del'}${revisionAttributes(revision, counter)}/></w:rPr>`;
  return `<w:pPr>${body}${mark}</w:pPr>`;
}
function buildPendingRowPropertiesXml(revisions, counter) {
  const revision = revisions.find(Boolean);
  if (!revision) return '';
  if (revisions.some(r => !r || JSON.stringify(r) !== JSON.stringify(revision))
    || revision.structure?.kind !== 'tableRow' || revision.state !== 'pending'
    || !['insert', 'delete'].includes(revision.operation)) throw Error('PENDING_TABLE_ROW_EXPORT_INVALID');
  return `<w:${revision.operation === 'insert' ? 'ins' : 'del'}${revisionAttributes(revision, counter)}/>`;
}
function buildPendingRowParagraphXml(xml, revision, counter) {
  if (!revision) return xml;
  const mark = buildPendingRowPropertiesXml([revision], counter);
  return xml.includes('</w:pPr>') ? xml.replace('</w:pPr>', `<w:rPr>${mark}</w:rPr></w:pPr>`)
    : `<w:pPr><w:rPr>${mark}</w:rPr></w:pPr>${xml}`;
}
// Export segments have already been validated against canonical scene truth.
// One native wrapper per revision, even when its body has several rich runs.
function buildPendingRunsXml(segments, renderRun, counter, sceneScope = '', markers = new Map()) {
  let output = '', active = null, body = '', formatText = '';
  const flush = () => {
    if (!active) { output += body; body = ''; return; }
    if (active.operation === 'format') {
      if (active.format?.kind !== 'run') throw Error('PENDING_FORMAT_EXPORT_INVALID');
      // Recombine split canonical text/hard-break atoms into the one native run
      // owned by this property revision, rather than manufacturing new changes.
      const previous = renderRun({ type: 'text', text: 'x', marks: active.format.before });
      const oldProperties = previous.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/u)?.[1] || '';
      const change = `<w:rPrChange${revisionAttributes(active, counter)}><w:rPr>${oldProperties}</w:rPr></w:rPrChange>`;
      const current = renderRun({ type: 'text', text: formatText, marks: active.format.after });
      output += current.includes('</w:rPr>') ? current.replace('</w:rPr>', change + '</w:rPr>')
        : current.replace('<w:r>', `<w:r><w:rPr>${change}</w:rPr>`);
      body = ''; formatText = ''; return;
    }
    const tag = active.moveName ? (active.operation === 'insert' ? 'moveTo' : 'moveFrom')
      : active.operation === 'insert' ? 'ins' : 'del';
    let rangeId, moveName;
    if (active.moveName) {
      counter.moves ||= new Map();
      const key = JSON.stringify([sceneScope, active.groupId]);
      if (!counter.moves.has(key)) counter.moves.set(key, `YalkenMove${counter.next++}`);
      moveName = counter.moves.get(key); rangeId = counter.next++;
    }
    const attrs = revisionAttributes(active, counter);
    if (active.moveName) output += `<w:${tag}RangeStart w:id="${rangeId}" w:name="${moveName}" w:author="${escapeXml(active.author)}"${active.date ? ` w:date="${escapeXml(active.date)}"` : ''}/>`;
    output += `<w:${tag}${attrs}>${body}</w:${tag}>`;
    if (active.moveName) output += `<w:${tag}RangeEnd w:id="${rangeId}"/>`;
    body = '';
  };
  let offset = 0;
  const remaining = new Map(markers);
  const emit = point => {
    if (!remaining.has(point)) return;
    flush(); active = null; output += remaining.get(point); remaining.delete(point);
  };
  for (const segment of segments) {
    const value = segment.node.type === 'hardBreak' ? '\n' : segment.node.text, end = offset + value.length;
    const inner = [...remaining.keys()].filter(point => point > offset && point < end).sort((a, b) => a - b);
    if (segment.revision && inner.length) throw Error('PENDING_NOTE_REFERENCE_CONSUMED');
    const cuts = [offset, ...inner, end];
    for (let i = 0; i < cuts.length - 1; i++) {
      emit(cuts[i]);
      if ((active?.id || null) !== (segment.revision?.id || null)) { flush(); active = segment.revision; }
      const node = segment.node.type === 'hardBreak' ? segment.node : { ...segment.node, text: value.slice(cuts[i] - offset, cuts[i + 1] - offset) };
      if (active?.operation === 'format') { formatText += node.type === 'hardBreak' ? '\n' : node.text; continue; }
      let xml = renderRun(node);
      if (active?.operation === 'delete' && !active.moveName) xml = xml.replace(/<w:t(?=[ >])/gu, '<w:delText').replaceAll('</w:t>', '</w:delText>');
      body += xml;
    }
    offset = end;
  }
  emit(offset);
  if (remaining.size) throw Error('PENDING_NOTE_ANCHOR_UNEMITTED');
  flush(); return output;
}
function pendingNoteMarkersForBlock(projection, block) {
  const bindings = (projection?.sourceBindings || []).filter(binding => binding.blockId === block.blockId);
  if (!bindings.length) return new Map();
  if (!Array.isArray(block.pendingNoteSourcePoints) || bindings.length !== block.pendingNoteSourcePoints.length)
    throw Error('PENDING_NOTE_BINDINGS_REQUIRED');
  const result = new Map(), seen = new Set();
  for (const binding of bindings) {
    const points = block.pendingNoteSourcePoints.filter(point => point.noteId === binding.noteId);
    if (!binding.richBody || points.length !== 1 || seen.has(binding.noteId)) throw Error('PENDING_NOTE_BINDINGS_REQUIRED');
    seen.add(binding.noteId);
    const point = points[0].offsetUtf16;
    if (!Number.isSafeInteger(point) || point < 0) throw Error('PENDING_NOTE_POINT_BOUNDARY');
    const xml = [...require('./docxReviewPacketNotes.js').noteMarkersForBlock({ sourceBindings: [binding] }, block).values()].join('');
    result.set(point, (result.get(point) || '') + xml);
  }
  return result;
}
module.exports = { buildDocxWordParagraphSpacingXml, pendingNoteMarkersForBlock, buildPendingRowPropertiesXml, buildPendingRowParagraphXml, buildPendingRunsXml, buildPendingParagraphPropertiesXml, buildPendingParagraphBoundaryXml };

'use strict';
const { escapeXml } = require('./docxTextXml.js');
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
  const protectedProperties = body.replace(/<w:(?:jc|pStyle|outlineLvl)\b[^>]*\/>/gu, '');
  const old = `<w:pStyle w:val="${before.type === 'heading' ? `Heading${before.attrs.level}` : 'Normal'}"/>`
    + (before.type === 'heading' ? `<w:outlineLvl w:val="${before.attrs.level - 1}"/>` : '')
    + (before.attrs?.textAlign ? `<w:jc w:val="${escapeXml(before.attrs.textAlign === 'justify' ? 'both' : before.attrs.textAlign)}"/>` : '')
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
// Export segments have already been validated against canonical scene truth.
// One native wrapper per revision, even when its body has several rich runs.
function buildPendingRunsXml(segments, renderRun, counter, sceneScope = '') {
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
  for (const segment of segments) {
    if ((active?.id || null) !== (segment.revision?.id || null)) { flush(); active = segment.revision; }
    if (active?.operation === 'format') { formatText += segment.node.type === 'hardBreak' ? '\n' : segment.node.text; continue; }
    let xml = renderRun(segment.node);
    if (active?.operation === 'delete' && !active.moveName) xml = xml.replace(/<w:t(?=[ >])/gu, '<w:delText').replaceAll('</w:t>', '</w:delText>');
    body += xml;
  }
  flush(); return output;
}
module.exports = { buildPendingRunsXml, buildPendingParagraphPropertiesXml, buildPendingParagraphBoundaryXml };

'use strict';
const { escapeXml } = require('./docxTextXml.js');
const { buildDocxWordLanguageXml, buildDocxParagraphMarkTypographyXml } = require('./docxInlineTypography.js');
const layout = require('../../core/word-paragraph-layout-v1.cjs');
const { normalizeWordParagraphSpacing } = require('../../core/word-paragraph-spacing-v1.cjs');
function buildDocxWordParagraphSpacingXml(value) {
  if (value == null) return '';
  const spacing = normalizeWordParagraphSpacing(value);
  return '<w:spacing' + ['before','after','line','lineRule'].filter(key => Object.hasOwn(spacing,key)).map(key => ` w:${key}="${spacing[key]}"`).join('') + '/>';
}
function buildDocxWordParagraphLayoutXml(attrs = {}) {
  let xml='';
  if(attrs.wordParagraphIndent!=null){const value=layout.normalizeWordParagraphIndent(attrs.wordParagraphIndent);xml+='<w:ind'+Object.entries(value).map(([key,v])=>` w:${key}="${v}"`).join('')+'/>';}
  if(attrs.wordParagraphTabs!=null){const values=layout.normalizeWordParagraphTabs(attrs.wordParagraphTabs);xml+='<w:tabs>'+values.map(value=>'<w:tab'+Object.entries(value).map(([key,v])=>` w:${key}="${v}"`).join('')+'/>').join('')+'</w:tabs>';}
  return xml;
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
  const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  const mark = properties => ({ language: properties.attrs?.wordParagraphMarkLanguage,
    typography: properties.attrs?.wordParagraphMarkTypography });
  if (stable(mark(before)) !== stable(mark(revision.format.after))) {
    const paragraph = properties => {
      const value = JSON.parse(JSON.stringify(properties));
      if (value.attrs) {
        delete value.attrs.wordParagraphMarkLanguage; delete value.attrs.wordParagraphMarkTypography;
        if (!Object.keys(value.attrs).length) delete value.attrs;
      }
      return value;
    };
    if (stable(paragraph(before)) !== stable(paragraph(revision.format.after)))
      throw Error('PENDING_PARAGRAPH_MARK_COMPOSITE_EXPORT_UNSUPPORTED');
    // A paragraph mark is a run-property owner. Its previous properties belong
    // under rPr/rPrChange, never under the paragraph-only pPrChange snapshot.
    const previous = buildDocxParagraphMarkTypographyXml(before.attrs?.wordParagraphMarkTypography)
      + buildDocxWordLanguageXml(before.attrs?.wordParagraphMarkLanguage);
    const change = `<w:rPrChange${revisionAttributes(revision, counter)}><w:rPr>${previous}</w:rPr></w:rPrChange>`;
    const current = /<w:rPr>[\s\S]*?<\/w:rPr>/u;
    return `<w:pPr>${current.test(body) ? body.replace(current, value => value.replace('</w:rPr>', change + '</w:rPr>'))
      : body + `<w:rPr>${change}</w:rPr>`}</w:pPr>`;
  }
  let protectedProperties = body.replace(/<w:(?:jc|pStyle|outlineLvl|spacing|lang|ind)\b[^>]*\/>/gu, '');
  protectedProperties=protectedProperties.replace(/<w:tabs\b[^>]*>[\s\S]*?<\/w:tabs>|<w:tabs\b[^>]*\/>/gu,'');
  protectedProperties = protectedProperties.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/gu, '');
  const old = `<w:pStyle w:val="${before.type === 'heading' ? `Heading${before.attrs.level}` : 'Normal'}"/>`
    + (before.type === 'heading' ? `<w:outlineLvl w:val="${before.attrs.level - 1}"/>` : '')
    + (before.attrs?.textAlign ? `<w:jc w:val="${escapeXml(before.attrs.textAlign === 'justify' ? 'both' : before.attrs.textAlign)}"/>` : '')
    + buildDocxWordParagraphSpacingXml(before.attrs?.wordParagraphSpacing)
    + buildDocxWordParagraphLayoutXml(before.attrs)
    + protectedProperties;
  return `<w:pPr>${body}<w:pPrChange${revisionAttributes(revision, counter)}><w:pPr>${old}</w:pPr></w:pPrChange></w:pPr>`;
}
// Only the locally emitted property fragment is composed here. Match its
// direct owner with a balanced stack so old rPrChange snapshots stay intact.
function appendOwnedParagraphMarker(xml, marker, code) {
  const properties=xml||'<w:pPr></w:pPr>',stack=[];let owner=null,rootClose=-1,end=0;
  if(!properties.startsWith('<w:pPr>')||!properties.endsWith('</w:pPr>'))throw Error(code);
  for(const token of properties.matchAll(/<\/?([A-Za-z_][\w:.-]*)\b[^>]*>/gu)) {
    if(properties.slice(end,token.index).trim())throw Error(code);
    const name=token[1],closing=token[0].startsWith('</'),selfClosing=token[0].endsWith('/>');
    if(closing) {
      if(stack.pop()!==name)throw Error(code);
      if(name==='w:rPr'&&stack.length===1&&stack[0]==='w:pPr')owner.close=token.index;
      if(!stack.length){if(name!=='w:pPr'||rootClose!==-1)throw Error(code);rootClose=token.index;}
    }else{
      if(!stack.length&&token.index!==0)throw Error(code);
      if(stack.length===1&&name==='w:rPr'){
        if(owner||(selfClosing&&token[0]!=='<w:rPr/>'))throw Error(code);owner={start:token.index,end:token.index+token[0].length,selfClosing};
      }
      if(stack.length===2&&stack[1]==='w:rPr'&&['w:ins','w:del'].includes(name))throw Error(code);
      if(!selfClosing)stack.push(name);
    }
    end=token.index+token[0].length;
  }
  if(stack.length||end!==properties.length||rootClose<0)throw Error(code);
  if(owner?.selfClosing)return properties.slice(0,owner.start)+'<w:rPr>'+marker+'</w:rPr>'+properties.slice(owner.end);
  const at=owner?owner.close:rootClose;
  return properties.slice(0,at)+(owner?marker:'<w:rPr>'+marker+'</w:rPr>')+properties.slice(at);
}
function buildPendingParagraphBoundaryXml(propertiesXml, revision, counter) {
  if (!revision) return propertiesXml;
  if (revision.boundary !== 'paragraph' || revision.state !== 'pending' || !['insert', 'delete'].includes(revision.operation))
    throw Error('PENDING_PARAGRAPH_BOUNDARY_INVALID');
  const mark = `<w:${revision.operation === 'insert' ? 'ins' : 'del'}${revisionAttributes(revision, counter)}/>`;
  return appendOwnedParagraphMarker(propertiesXml,mark,'PENDING_PARAGRAPH_BOUNDARY_INVALID');
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
  return appendOwnedParagraphMarker(xml,mark,'PENDING_TABLE_ROW_EXPORT_INVALID');
}
// Export segments have already been validated against canonical scene truth.
// Keep rich runs together; live comment markers may split a deletion wrapper.
function buildPendingRunsXml(segments, renderRun, counter, sceneScope = '', markers = new Map(), commentMarkers = new Map()) {
  let output = '', active = null, body = '', formatText = '', nested=null,nestedText='';
  const formattedRun=(revision,value)=>{
    if(revision.format?.kind!=='run')throw Error('PENDING_FORMAT_EXPORT_INVALID');
    const previous=renderRun({type:'text',text:'x',marks:revision.format.before});
    const oldProperties=previous.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/u)?.[1]||'';
    const change=`<w:rPrChange${revisionAttributes(revision,counter)}><w:rPr>${oldProperties}</w:rPr></w:rPrChange>`;
    const current=renderRun({type:'text',text:value,marks:revision.format.after});
    return current.includes('</w:rPr>')?current.replace('</w:rPr>',change+'</w:rPr>'):current.replace('<w:r>',`<w:r><w:rPr>${change}</w:rPr>`);
  };
  const flushNested=()=>{if(nested){body+=formattedRun(nested,nestedText);nested=null;nestedText='';}};
  const flush = () => {
    flushNested();
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
  const remainingComments = new Map(commentMarkers);
  const emit = point => {
    if (remainingComments.has(point)) {
      flushNested();
      // Word discards comment references contained in deleted content when it
      // saves an edited document. Preserve the exact union endpoint, but close
      // the deletion first; the next segment resumes it if this point is inside.
      if (['delete','format'].includes(active?.operation)) { flush(); active = null; }
      body += remainingComments.get(point); remainingComments.delete(point);
    }
    if (!remaining.has(point)) return;
    flush(); active = null; output += remaining.get(point); remaining.delete(point);
  };
  for (const segment of segments) {
    const value = segment.node.type === 'hardBreak' ? '\n' : segment.node.text, end = offset + value.length;
    const inner = [...new Set([...remaining.keys(), ...remainingComments.keys()])].filter(point => point > offset && point < end).sort((a, b) => a - b);
    if (segment.revision && inner.some(point => remaining.has(point))) throw Error('PENDING_NOTE_REFERENCE_CONSUMED');
    const cuts = [offset, ...inner, end];
    for (let i = 0; i < cuts.length - 1; i++) {
      emit(cuts[i]);
      if ((active?.id || null) !== (segment.revision?.id || null)) { flush(); active = segment.revision; }
      const node = segment.node.type === 'hardBreak' ? segment.node : { ...segment.node, text: value.slice(cuts[i] - offset, cuts[i + 1] - offset) };
      if (active?.operation === 'format') { formatText += node.type === 'hardBreak' ? '\n' : node.text; continue; }
      if(segment.formatRevision){
        if(nested?.id!==segment.formatRevision.id){flushNested();nested=segment.formatRevision;}
        nestedText+=node.type==='hardBreak'?'\n':node.text;continue;
      }
      flushNested();
      let xml = renderRun(node);
      if (active?.operation === 'delete' && !active.moveName) xml = xml.replace(/<w:t(?=[ >])/gu, '<w:delText').replaceAll('</w:t>', '</w:delText>');
      body += xml;
    }
    offset = end;
  }
  emit(offset);
  if (remaining.size) throw Error('PENDING_NOTE_ANCHOR_UNEMITTED');
  if (remainingComments.size) throw Error('PENDING_COMMENT_ANCHOR_UNEMITTED');
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
module.exports = { buildDocxWordParagraphLayoutXml, buildDocxWordParagraphSpacingXml, pendingNoteMarkersForBlock, buildPendingRowPropertiesXml, buildPendingRowParagraphXml, buildPendingRunsXml, buildPendingParagraphPropertiesXml, buildPendingParagraphBoundaryXml };

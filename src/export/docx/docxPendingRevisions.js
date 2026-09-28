'use strict';
const { escapeXml } = require('./docxTextXml.js');
// Export segments have already been validated against canonical scene truth.
// One native wrapper per revision, even when its body has several rich runs.
function buildPendingRunsXml(segments, renderRun, counter) {
  let output = '', active = null, body = '';
  const flush = () => {
    if (!active) { output += body; body = ''; return; }
    const tag = active.operation === 'insert' ? 'ins' : 'del';
    let attrs = ` w:id="${counter.next++}" w:author="${escapeXml(active.author)}"`
      + (active.date ? ` w:date="${escapeXml(active.date)}"` : '');
    if (active.dateUtc) attrs += ` xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" w16du:dateUtc="${escapeXml(active.dateUtc)}"`;
    output += `<w:${tag}${attrs}>${body}</w:${tag}>`; body = '';
  };
  for (const segment of segments) {
    if ((active?.id || null) !== (segment.revision?.id || null)) { flush(); active = segment.revision; }
    let xml = renderRun(segment.node);
    if (active?.operation === 'delete') xml = xml.replace(/<w:t(?=[ >])/gu, '<w:delText').replaceAll('</w:t>', '</w:delText>');
    body += xml;
  }
  flush(); return output;
}
module.exports = { buildPendingRunsXml };

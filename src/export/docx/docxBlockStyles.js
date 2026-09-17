'use strict';

// These named paragraph styles are the bounded transport profile used by both
// existing exporters. Indentation or a user-visible style name is not a role.
function readDocxBlockStyleId(id) {
  if (id === 'YalkenCodeBlock') return { blockKind: 'codeBlock' };
  const quote = /^YalkenBlockquote([1-8])$/u.exec(id);
  if (quote) return { blockquoteDepth: Number(quote[1]) };
  const code = /^YalkenCodeBlockQuote([1-8])$/u.exec(id);
  if (code) return { blockKind: 'codeBlock', blockquoteDepth: Number(code[1]) };
  if (/^Yalken(?:CodeBlock|Blockquote)/u.test(id)) throw new Error('DOCX_BLOCK_STYLE_ID_UNSUPPORTED');
  return null;
}

function docxBlockStyleId(codeBlock, depth = 0) {
  if (!Number.isInteger(depth) || depth < 0 || depth > 8) throw new Error('DOCX_BLOCKQUOTE_DEPTH_UNSUPPORTED');
  return codeBlock ? `YalkenCodeBlock${depth ? `Quote${depth}` : ''}` : depth ? `YalkenBlockquote${depth}` : '';
}

function buildDocxBlockStyleDefinitions(ids) {
  return [...new Set(ids)].map(id => {
    const role = readDocxBlockStyleId(id);
    if (!role) throw new Error('DOCX_BLOCK_STYLE_ID_UNSUPPORTED');
    const indent = role.blockquoteDepth ? `<w:ind w:left="${role.blockquoteDepth * 720}"/>` : '';
    const code = role.blockKind === 'codeBlock';
    const paragraph = indent + (code ? '<w:spacing w:before="80" w:after="80"/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : '');
    const run = code ? '<w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo" w:eastAsia="Menlo" w:cs="Menlo"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>' : '';
    return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:qFormat/><w:pPr>${paragraph}</w:pPr>${run}</w:style>`;
  }).join('');
}

module.exports = { readDocxBlockStyleId, docxBlockStyleId, buildDocxBlockStyleDefinitions };

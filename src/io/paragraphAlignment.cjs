const ALIGNMENTS = Object.freeze(['left', 'center', 'right', 'justify']);
const WORD_ALIGNMENTS = Object.freeze({ left: 'left', center: 'center', right: 'right', both: 'justify' });
const UNSUPPORTED_WORD_ALIGNMENTS = new Set(['start', 'end', 'distribute', 'numTab', 'lowKashida', 'mediumKashida', 'highKashida', 'thaiDistribute']);

function normalizeParagraphAlignment(value) {
  if (value == null) return null;
  if (!ALIGNMENTS.includes(value)) throw new Error('DOCX_PARAGRAPH_ALIGNMENT_INVALID');
  return value;
}

function toWordParagraphAlignment(value) {
  const alignment = normalizeParagraphAlignment(value);
  return alignment === 'justify' ? 'both' : alignment;
}

function fromWordParagraphAlignment(value) {
  if (typeof value !== 'string') throw new Error('DOCX_PARAGRAPH_ALIGNMENT_INVALID');
  if (Object.hasOwn(WORD_ALIGNMENTS, value)) return WORD_ALIGNMENTS[value];
  if (UNSUPPORTED_WORD_ALIGNMENTS.has(value)) return null;
  throw new Error('DOCX_PARAGRAPH_ALIGNMENT_INVALID');
}

module.exports = { ALIGNMENTS, normalizeParagraphAlignment, toWordParagraphAlignment, fromWordParagraphAlignment };

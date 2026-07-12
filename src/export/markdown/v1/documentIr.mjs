import { appendLoss, createLossReport, finalizeLossReport } from './lossReport.mjs';
import { createMarkdownTransformError, normalizeMarkdownInput } from './types.mjs';

export const MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES = Object.freeze({
  INVALID_DOCUMENT_DOWNGRADED: 'MDV1_DOCUMENT_INVALID_DOWNGRADED',
  UNKNOWN_BLOCK_DOWNGRADED: 'MDV1_DOCUMENT_UNKNOWN_BLOCK_DOWNGRADED',
  UNKNOWN_INLINE_DOWNGRADED: 'MDV1_DOCUMENT_UNKNOWN_INLINE_DOWNGRADED',
  UNSUPPORTED_MARK_DOWNGRADED: 'MDV1_DOCUMENT_UNSUPPORTED_MARK_DOWNGRADED',
  UNSAFE_LINK_DOWNGRADED: 'MDV1_DOCUMENT_UNSAFE_LINK_DOWNGRADED',
  NESTED_LIST_DOWNGRADED: 'MDV1_DOCUMENT_NESTED_LIST_DOWNGRADED',
  MULTI_BLOCK_LIST_ITEM_DOWNGRADED: 'MDV1_DOCUMENT_MULTI_BLOCK_LIST_ITEM_DOWNGRADED',
  BLOCK_ATTRIBUTES_DOWNGRADED: 'MDV1_DOCUMENT_BLOCK_ATTRIBUTES_DOWNGRADED',
  INLINE_HARD_BREAK_DOWNGRADED: 'MDV1_DOCUMENT_INLINE_HARD_BREAK_DOWNGRADED',
  INLINE_TEXT_LINE_BREAK_NORMALIZED: 'MDV1_DOCUMENT_INLINE_TEXT_LINE_BREAK_NORMALIZED',
});

const INLINE_CONTROL_CHARACTERS = new Set(['\\', '*', '_', '`', '[', ']']);
const KNOWN_MARK_TYPES = new Set(['bold', 'strong', 'italic', 'em', 'code', 'link']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendDocumentLoss(report, reasonCode, path, note, evidence, action = 'DOWNGRADE') {
  appendLoss(report, {
    kind: 'DOCUMENT_IR_DOWNGRADE',
    reasonCode,
    code: reasonCode,
    severity: 'WARN',
    action,
    path,
    note,
    message: note,
    evidence,
  });
}

function normalizeAttrs(value) {
  return isPlainObject(value) ? value : {};
}

function hasMeaningfulAttrs(value, allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  return Object.keys(normalizeAttrs(value)).some((key) => {
    if (allowed.has(key)) return false;
    const candidate = value[key];
    return candidate !== null && candidate !== undefined && candidate !== '';
  });
}

function deriveNodeText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
  if (node.type === 'hardBreak') return '\n';
  if (!Array.isArray(node.content)) return '';
  const parts = node.content.map((child) => deriveNodeText(child));
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'listItem') {
    return parts.filter(Boolean).join(' / ');
  }
  if (node.type === 'tableRow') return parts.filter(Boolean).join(' | ');
  if (node.type === 'doc' || node.type === 'blockquote' || node.type === 'table') {
    return parts.filter(Boolean).join('\n');
  }
  return parts.join('');
}

function escapeInlineLiteral(value) {
  let out = '';
  for (const character of String(value ?? '')) {
    if (INLINE_CONTROL_CHARACTERS.has(character)) out += '\\';
    out += character;
  }
  return out;
}

function longestBacktickRun(value) {
  const matches = String(value ?? '').match(/`+/gu) || [];
  return matches.reduce((longest, item) => Math.max(longest, item.length), 0);
}

function serializeInlineCode(value) {
  const raw = String(value ?? '');
  const fence = '`'.repeat(Math.max(1, longestBacktickRun(raw) + 1));
  const padded = /^\s|\s$|^`|`$/u.test(raw) ? ` ${raw} ` : raw;
  return `${fence}${padded}${fence}`;
}

function isSafeLinkTarget(value) {
  const target = String(value ?? '').trim();
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/u.exec(target);
  if (!schemeMatch) return true;
  const scheme = schemeMatch[1].toLowerCase();
  return scheme !== 'javascript' && scheme !== 'data';
}

function escapeLinkTarget(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(')', '\\)');
}

function serializeTextNode(node, path, report) {
  const sourceText = typeof node?.text === 'string' ? node.text : String(node?.text ?? '');
  let rawText = normalizeMarkdownInput(sourceText);
  const marks = Array.isArray(node?.marks) ? node.marks.filter(isPlainObject) : [];
  const markTypes = new Set(marks.map((mark) => String(mark.type || '')));

  if (rawText.includes('\n')) {
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.INLINE_TEXT_LINE_BREAK_NORMALIZED,
      path,
      'Line break embedded in a text node was normalized to a space; use hardBreak nodes for exact breaks.',
      rawText,
    );
    rawText = rawText.replace(/\n+/gu, ' ');
  }

  for (const mark of marks) {
    const markType = String(mark.type || 'unknown');
    if (!KNOWN_MARK_TYPES.has(markType)) {
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNSUPPORTED_MARK_DOWNGRADED,
        path,
        `Unsupported text mark "${markType}" was removed while preserving text.`,
        markType,
      );
    }
  }

  if (markTypes.has('code')) {
    if ([...markTypes].some((markType) => markType !== 'code' && KNOWN_MARK_TYPES.has(markType))) {
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNSUPPORTED_MARK_DOWNGRADED,
        path,
        'Marks combined with inline code were reduced to inline code.',
        [...markTypes].sort().join(','),
      );
    }
    return serializeInlineCode(rawText);
  }

  let rendered = escapeInlineLiteral(rawText);
  const bold = markTypes.has('bold') || markTypes.has('strong');
  const italic = markTypes.has('italic') || markTypes.has('em');
  if (bold && italic) rendered = `***${rendered}***`;
  else if (bold) rendered = `**${rendered}**`;
  else if (italic) rendered = `*${rendered}*`;

  const linkMark = marks.find((mark) => mark.type === 'link');
  if (linkMark) {
    const href = String(normalizeAttrs(linkMark.attrs).href || '').trim();
    if (!href || !isSafeLinkTarget(href)) {
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNSAFE_LINK_DOWNGRADED,
        path,
        'Unsafe or empty link target was removed while preserving label text.',
        href,
      );
    } else {
      rendered = `[${rendered}](${escapeLinkTarget(href)})`;
    }
  }
  return rendered;
}

function serializeInlineContent(content, path, report, options = {}) {
  const nodes = Array.isArray(content) ? content : [];
  const hardBreakMode = options.hardBreakMode === 'space' ? 'space' : 'markdown';
  return nodes.map((node, index) => {
    const inlinePath = `${path}.inline:${index + 1}`;
    if (!node || typeof node !== 'object') {
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNKNOWN_INLINE_DOWNGRADED,
        inlinePath,
        'Invalid inline node was removed.',
        String(node),
      );
      return '';
    }
    if (node.type === 'text') return serializeTextNode(node, inlinePath, report);
    if (node.type === 'hardBreak') {
      if (hardBreakMode === 'space') {
        appendDocumentLoss(
          report,
          MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.INLINE_HARD_BREAK_DOWNGRADED,
          inlinePath,
          'Hard break was normalized to a space in a block that cannot preserve it in Markdown v1.',
          'hardBreak',
        );
        return ' ';
      }
      return '  \n';
    }

    const fallback = deriveNodeText(node);
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNKNOWN_INLINE_DOWNGRADED,
      inlinePath,
      `Unknown inline node "${String(node.type || 'unknown')}" was flattened to text.`,
      String(node.type || 'unknown'),
    );
    return escapeInlineLiteral(fallback);
  }).join('');
}

function serializeListItem(node, path, report) {
  const children = Array.isArray(node?.content) ? node.content : [];
  const textParts = [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childPath = `${path}.block:${index + 1}`;
    if (child?.type === 'paragraph' || child?.type === 'heading') {
      textParts.push(serializeInlineContent(child.content, childPath, report, { hardBreakMode: 'space' }));
      continue;
    }
    if (child?.type === 'bulletList' || child?.type === 'orderedList') {
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.NESTED_LIST_DOWNGRADED,
        childPath,
        'Nested list was flattened into the parent list item.',
        child.type,
      );
      textParts.push(escapeInlineLiteral(deriveNodeText(child)).replaceAll('\n', ' / '));
      continue;
    }
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.MULTI_BLOCK_LIST_ITEM_DOWNGRADED,
      childPath,
      'Unsupported list-item block was flattened to text.',
      String(child?.type || 'unknown'),
    );
    textParts.push(escapeInlineLiteral(deriveNodeText(child)));
  }
  if (textParts.length > 1) {
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.MULTI_BLOCK_LIST_ITEM_DOWNGRADED,
      path,
      'Multi-block list item was joined into one Markdown list item.',
      String(textParts.length),
    );
  }
  return textParts.filter(Boolean).join(' / ');
}

function documentBlockToSceneBlock(node, index, report) {
  const path = `block:${index + 1}`;
  if (!node || typeof node !== 'object') {
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNKNOWN_BLOCK_DOWNGRADED,
      path,
      'Invalid document block was downgraded to a placeholder paragraph.',
      String(node),
    );
    return { type: 'paragraph', text: '[unsupported block]' };
  }

  if (hasMeaningfulAttrs(node.attrs, node.type === 'heading' ? ['level'] : node.type === 'codeBlock' ? ['language'] : [])) {
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.BLOCK_ATTRIBUTES_DOWNGRADED,
      path,
      `Unsupported attributes on "${String(node.type || 'unknown')}" were omitted.`,
      JSON.stringify(normalizeAttrs(node.attrs)),
    );
  }

  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', text: serializeInlineContent(node.content, path, report) };
    case 'heading':
      return {
        type: 'heading',
        level: Number.isInteger(node?.attrs?.level) ? node.attrs.level : 1,
        text: serializeInlineContent(node.content, path, report, { hardBreakMode: 'space' }),
      };
    case 'horizontalRule':
      return { type: 'thematicBreak' };
    case 'blockquote': {
      const children = Array.isArray(node.content) ? node.content : [];
      const text = children.map((child, childIndex) => {
        const childPath = `${path}.block:${childIndex + 1}`;
        if (child?.type === 'paragraph') {
          return serializeInlineContent(child.content, childPath, report, { hardBreakMode: 'space' });
        }
        appendDocumentLoss(
          report,
          MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNKNOWN_BLOCK_DOWNGRADED,
          childPath,
          'Nested blockquote content was flattened to text.',
          String(child?.type || 'unknown'),
        );
        return escapeInlineLiteral(deriveNodeText(child));
      }).join('\n');
      return { type: 'blockquote', text };
    }
    case 'bulletList':
    case 'orderedList': {
      const items = (Array.isArray(node.content) ? node.content : []).map((item, itemIndex) => ({
        text: serializeListItem(item, `${path}.item:${itemIndex + 1}`, report),
      }));
      return { type: 'list', ordered: node.type === 'orderedList', items };
    }
    case 'codeBlock':
      return {
        type: 'codeFence',
        language: String(node?.attrs?.language || ''),
        code: deriveNodeText(node),
      };
    default: {
      const fallback = deriveNodeText(node);
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNKNOWN_BLOCK_DOWNGRADED,
        path,
        `Unknown document block "${String(node.type || 'unknown')}" was flattened to a paragraph.`,
        String(node.type || 'unknown'),
      );
      return {
        type: 'paragraph',
        text: fallback ? escapeInlineLiteral(fallback) : `[unsupported block:${String(node.type || 'unknown')}]`,
      };
    }
  }
}

export function documentToMarkdownSceneV1(documentModel) {
  if (!isPlainObject(documentModel) || documentModel.type !== 'doc' || !Array.isArray(documentModel.content)) {
    throw createMarkdownTransformError('E_MD_DOCUMENT_INVALID', 'canonical_document_invalid');
  }
  const lossReport = createLossReport();
  const blocks = documentModel.content.map((node, index) => documentBlockToSceneBlock(node, index, lossReport));
  return {
    kind: 'scene.v1',
    blocks,
    nodeCount: blocks.length,
    lossReport: finalizeLossReport(lossReport),
  };
}

function findClosingToken(text, token, startIndex) {
  let searchIndex = startIndex;
  while (searchIndex < text.length) {
    const index = text.indexOf(token, searchIndex);
    if (index === -1) return -1;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
      slashCount += 1;
    }
    if (index > startIndex && slashCount % 2 === 0) return index;
    searchIndex = index + 1;
  }
  return -1;
}

function decodeEscapedInlineLiteral(value) {
  const text = String(value ?? '');
  let out = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\' && index + 1 < text.length && '\\`*{}[]()#+-.!_>'.includes(text[index + 1])) {
      out += text[index + 1];
      index += 1;
      continue;
    }
    out += text[index];
  }
  return out;
}

function findUnescapedSequence(text, token, startIndex) {
  let searchIndex = startIndex;
  while (searchIndex < text.length) {
    const index = text.indexOf(token, searchIndex);
    if (index === -1) return -1;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) return index;
    searchIndex = index + 1;
  }
  return -1;
}

function appendInlineNode(nodes, node) {
  if (!node) return;
  if (node.type === 'text' && node.text === '') return;
  const previous = nodes[nodes.length - 1];
  if (
    previous?.type === 'text'
    && node.type === 'text'
    && JSON.stringify(previous.marks || []) === JSON.stringify(node.marks || [])
  ) {
    previous.text += node.text;
    return;
  }
  nodes.push(node);
}

function parseInlineMarkdownV1(value) {
  const text = normalizeMarkdownInput(value);
  const nodes = [];
  let index = 0;
  let plain = '';
  const flushPlain = () => {
    appendInlineNode(nodes, plain ? { type: 'text', text: plain } : null);
    plain = '';
  };

  while (index < text.length) {
    const character = text[index];
    if (character === '\\' && index + 1 < text.length) {
      const escaped = text[index + 1];
      if ('\\`*{}[]()#+-.!_>'.includes(escaped)) {
        plain += escaped;
        index += 2;
        continue;
      }
    }
    if (character === '\n') {
      plain = plain.replace(/ {2}$/u, '');
      flushPlain();
      appendInlineNode(nodes, { type: 'hardBreak' });
      index += 1;
      continue;
    }
    if (text.startsWith('***', index) || text.startsWith('___', index)) {
      const token = text.slice(index, index + 3);
      const end = findClosingToken(text, token, index + 3);
      if (end !== -1) {
        flushPlain();
        appendInlineNode(nodes, {
          type: 'text',
          text: decodeEscapedInlineLiteral(text.slice(index + 3, end)),
          marks: [{ type: 'bold' }, { type: 'italic' }],
        });
        index = end + 3;
        continue;
      }
    }
    if (text.startsWith('**', index) || text.startsWith('__', index)) {
      const token = text.slice(index, index + 2);
      const end = findClosingToken(text, token, index + 2);
      if (end !== -1) {
        flushPlain();
        appendInlineNode(nodes, {
          type: 'text',
          text: decodeEscapedInlineLiteral(text.slice(index + 2, end)),
          marks: [{ type: 'bold' }],
        });
        index = end + 2;
        continue;
      }
    }
    if (character === '*' || character === '_') {
      const end = findClosingToken(text, character, index + 1);
      if (end !== -1) {
        flushPlain();
        appendInlineNode(nodes, {
          type: 'text',
          text: decodeEscapedInlineLiteral(text.slice(index + 1, end)),
          marks: [{ type: 'italic' }],
        });
        index = end + 1;
        continue;
      }
    }
    if (character === '`') {
      let fenceLength = 1;
      while (text[index + fenceLength] === '`') fenceLength += 1;
      const fence = '`'.repeat(fenceLength);
      const end = findClosingToken(text, fence, index + fenceLength);
      if (end !== -1) {
        flushPlain();
        let code = text.slice(index + fenceLength, end);
        if (code.startsWith(' ') && code.endsWith(' ') && code.length >= 2) {
          code = code.slice(1, -1);
        }
        appendInlineNode(nodes, { type: 'text', text: code, marks: [{ type: 'code' }] });
        index = end + fenceLength;
        continue;
      }
    }
    if (character === '[') {
      const labelEnd = findUnescapedSequence(text, '](', index + 1);
      const targetEnd = labelEnd === -1 ? -1 : findUnescapedSequence(text, ')', labelEnd + 2);
      if (labelEnd > index + 1 && targetEnd > labelEnd + 2) {
        const label = text.slice(index + 1, labelEnd);
        const href = decodeEscapedInlineLiteral(text.slice(labelEnd + 2, targetEnd));
        if (isSafeLinkTarget(href)) {
          flushPlain();
          const labelNodes = parseInlineMarkdownV1(label);
          for (const labelNode of labelNodes) {
            if (labelNode?.type === 'text') {
              appendInlineNode(nodes, {
                ...labelNode,
                marks: [
                  ...(Array.isArray(labelNode.marks) ? labelNode.marks : []),
                  { type: 'link', attrs: { href } },
                ],
              });
            } else {
              appendInlineNode(nodes, labelNode);
            }
          }
          index = targetEnd + 1;
          continue;
        }
      }
    }
    plain += character;
    index += 1;
  }
  flushPlain();
  return nodes;
}

function paragraphNodeFromMarkdown(value) {
  const content = parseInlineMarkdownV1(value);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function sceneBlockToDocumentNode(block, index, report) {
  const path = `block:${index + 1}`;
  if (!block || typeof block !== 'object') {
    appendDocumentLoss(
      report,
      MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.INVALID_DOCUMENT_DOWNGRADED,
      path,
      'Invalid Markdown scene block was downgraded to an empty paragraph.',
      String(block),
    );
    return { type: 'paragraph' };
  }
  switch (block.type) {
    case 'paragraph':
      return paragraphNodeFromMarkdown(block.text);
    case 'heading': {
      const content = parseInlineMarkdownV1(block.text);
      return {
        type: 'heading',
        attrs: { level: Math.min(6, Math.max(1, Number.isInteger(block.level) ? block.level : 1)) },
        ...(content.length > 0 ? { content } : {}),
      };
    }
    case 'thematicBreak':
      return { type: 'horizontalRule' };
    case 'blockquote': {
      const content = normalizeMarkdownInput(block.text).split('\n').map(paragraphNodeFromMarkdown);
      return { type: 'blockquote', content };
    }
    case 'list': {
      const items = (Array.isArray(block.items) ? block.items : []).map((item) => ({
        type: 'listItem',
        content: [paragraphNodeFromMarkdown(item?.text)],
      }));
      return { type: block.ordered ? 'orderedList' : 'bulletList', content: items };
    }
    case 'codeFence': {
      const code = String(block.code ?? '');
      return {
        type: 'codeBlock',
        attrs: { language: String(block.language || '').trim().toLowerCase() || null },
        ...(code ? { content: [{ type: 'text', text: code }] } : {}),
      };
    }
    default: {
      appendDocumentLoss(
        report,
        MARKDOWN_DOCUMENT_IR_LOSS_REASON_CODES.UNKNOWN_BLOCK_DOWNGRADED,
        path,
        `Unknown Markdown scene block "${String(block.type || 'unknown')}" was flattened to a paragraph.`,
        String(block.type || 'unknown'),
      );
      return paragraphNodeFromMarkdown(
        typeof block.text === 'string' ? block.text : `[unsupported block:${String(block.type || 'unknown')}]`,
      );
    }
  }
}

export function markdownSceneV1ToDocument(sceneModel) {
  if (!isPlainObject(sceneModel) || !Array.isArray(sceneModel.blocks)) {
    throw createMarkdownTransformError('E_MD_DOCUMENT_SCENE_INVALID', 'markdown_scene_invalid');
  }
  const lossReport = createLossReport();
  const content = sceneModel.blocks.map((block, index) => sceneBlockToDocumentNode(block, index, lossReport));
  return {
    doc: {
      type: 'doc',
      content: content.length > 0 ? content : [{ type: 'paragraph' }],
    },
    lossReport: finalizeLossReport(lossReport),
  };
}

export function legacyTextToMarkdownSceneV1(textInput) {
  const normalized = normalizeMarkdownInput(textInput).replace(/^\n+|\n+$/gu, '');
  const groups = normalized ? normalized.split(/\n{2,}/gu) : [''];
  const blocks = groups.map((group) => ({
    type: 'paragraph',
    text: group.split('\n').map(escapeInlineLiteral).join('  \n'),
  }));
  return {
    kind: 'scene.v1',
    blocks,
    nodeCount: blocks.length,
    lossReport: finalizeLossReport(createLossReport()),
  };
}

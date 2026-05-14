import { appendLoss, createLossReport, finalizeLossReport } from './lossReport.mjs';
import { createMarkdownTransformError } from './types.mjs';

export const MARKDOWN_EXPORT_LOSS_REASON_CODES = Object.freeze({
  INVALID_BLOCK_SHAPE_DOWNGRADED: 'MDV1_INVALID_BLOCK_SHAPE_DOWNGRADED',
  UNKNOWN_BLOCK_TYPE_DOWNGRADED: 'MDV1_UNKNOWN_BLOCK_TYPE_DOWNGRADED',
  HEADING_TEXT_NORMALIZED: 'MDV1_HEADING_TEXT_NORMALIZED',
  LIST_ITEM_TEXT_NORMALIZED: 'MDV1_LIST_ITEM_TEXT_NORMALIZED',
  CODE_TEXT_NORMALIZED: 'MDV1_CODE_TEXT_NORMALIZED',
  TEXT_BLOCK_FORMAT_DOWNGRADED: 'TEXTV1_BLOCK_FORMAT_DOWNGRADED',
});

function toLF(text) {
  return String(text ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function normalizeFenceLanguage(language) {
  return String(language ?? '').trim().toLowerCase();
}

function normalizeText(text) {
  return toLF(text).replace(/[ \t]+$/gm, '');
}

function blockPath(blockIndex) {
  return `block:${blockIndex + 1}`;
}

function appendExportLoss(report, reasonCode, path, note, evidence, kind = 'EXPORT_DOWNGRADE') {
  appendLoss(report, {
    kind,
    reasonCode,
    path,
    note,
    evidence,
  });
}

function normalizeSceneForExport(sceneModel) {
  if (!sceneModel || typeof sceneModel !== 'object' || !Array.isArray(sceneModel.blocks)) {
    throw createMarkdownTransformError('E_MD_SERIALIZE_INVALID_SCENE', 'invalid_scene_model');
  }
}

function normalizeJoinedOutput(parts) {
  const normalized = parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  return `${normalized}\n`;
}

function extractBlockText(block) {
  if (!block || typeof block !== 'object') return '';
  if (typeof block.text === 'string') return normalizeText(block.text);
  if (typeof block.code === 'string') return normalizeText(block.code);
  if (Array.isArray(block.items)) {
    const joined = block.items
      .map((item) => normalizeText(item && typeof item === 'object' ? item.text : ''))
      .filter((value) => value.length > 0)
      .join('\n');
    if (joined.length > 0) return joined;
  }
  return '';
}

function serializeListMarkdown(block, blockIndex, report) {
  const items = Array.isArray(block.items) ? block.items : [];
  return items
    .map((item, index) => {
      const rawText = item && typeof item === 'object' ? item.text : '';
      const text = normalizeText(rawText);
      if (typeof rawText !== 'string') {
        appendExportLoss(
          report,
          MARKDOWN_EXPORT_LOSS_REASON_CODES.LIST_ITEM_TEXT_NORMALIZED,
          `${blockPath(blockIndex)}.item:${index + 1}`,
          'List item text was normalized to string.',
          String(rawText ?? ''),
        );
      }
      const prefix = block.ordered ? `${index + 1}. ` : '- ';
      return `${prefix}${text}`.trimEnd();
    })
    .join('\n');
}

function serializeCodeFenceMarkdown(block, blockIndex, report) {
  const language = normalizeFenceLanguage(block.language);
  const rawCode = block.code;
  const code = normalizeText(rawCode);
  if (typeof rawCode !== 'string') {
    appendExportLoss(
      report,
      MARKDOWN_EXPORT_LOSS_REASON_CODES.CODE_TEXT_NORMALIZED,
      blockPath(blockIndex),
      'Code fence payload was normalized to string.',
      String(rawCode ?? ''),
    );
  }
  const open = language.length > 0 ? `\`\`\`${language}` : '```';
  return `${open}\n${code}\n\`\`\``;
}

function serializeMarkdownBlock(block, blockIndex, report) {
  if (!block || typeof block !== 'object') {
    appendExportLoss(
      report,
      MARKDOWN_EXPORT_LOSS_REASON_CODES.INVALID_BLOCK_SHAPE_DOWNGRADED,
      blockPath(blockIndex),
      'Invalid block shape downgraded to placeholder paragraph.',
      String(block),
    );
    return '[unsupported block]';
  }

  switch (block.type) {
    case 'heading': {
      const level = Number.isInteger(block.level) ? block.level : 1;
      const bounded = Math.min(6, Math.max(1, level));
      const rawText = block.text;
      const normalized = normalizeText(rawText);
      if (typeof rawText !== 'string') {
        appendExportLoss(
          report,
          MARKDOWN_EXPORT_LOSS_REASON_CODES.HEADING_TEXT_NORMALIZED,
          blockPath(blockIndex),
          'Heading text was normalized to string.',
          String(rawText ?? ''),
        );
      }
      return `${'#'.repeat(bounded)} ${normalized}`.trimEnd();
    }
    case 'thematicBreak':
      return '---';
    case 'blockquote': {
      const lines = normalizeText(block.text).split('\n');
      return lines.map((line) => `> ${line}`.trimEnd()).join('\n');
    }
    case 'list':
      return serializeListMarkdown(block, blockIndex, report);
    case 'codeFence':
      return serializeCodeFenceMarkdown(block, blockIndex, report);
    case 'paragraph':
      return normalizeText(block.text);
    default: {
      const fallbackText = extractBlockText(block);
      appendExportLoss(
        report,
        MARKDOWN_EXPORT_LOSS_REASON_CODES.UNKNOWN_BLOCK_TYPE_DOWNGRADED,
        blockPath(blockIndex),
        'Unknown block downgraded to paragraph-safe text.',
        String(block.type || ''),
      );
      if (fallbackText.length > 0) return fallbackText;
      return `[unsupported block:${String(block.type || 'unknown')}]`;
    }
  }
}

function serializePlainTextBlock(block, blockIndex, report) {
  if (!block || typeof block !== 'object') {
    appendExportLoss(
      report,
      MARKDOWN_EXPORT_LOSS_REASON_CODES.INVALID_BLOCK_SHAPE_DOWNGRADED,
      blockPath(blockIndex),
      'Invalid block shape downgraded in plain text export.',
      String(block),
    );
    return '';
  }

  switch (block.type) {
    case 'paragraph':
      return normalizeText(block.text);
    case 'heading':
    case 'blockquote':
    case 'list':
    case 'codeFence':
    case 'thematicBreak': {
      appendExportLoss(
        report,
        MARKDOWN_EXPORT_LOSS_REASON_CODES.TEXT_BLOCK_FORMAT_DOWNGRADED,
        blockPath(blockIndex),
        `Block type "${String(block.type)}" downgraded to plain text.`,
        String(block.type || ''),
      );
      return extractBlockText(block);
    }
    default: {
      appendExportLoss(
        report,
        MARKDOWN_EXPORT_LOSS_REASON_CODES.UNKNOWN_BLOCK_TYPE_DOWNGRADED,
        blockPath(blockIndex),
        'Unknown block downgraded in plain text export.',
        String(block.type || ''),
      );
      return extractBlockText(block);
    }
  }
}

export function serializeMarkdownV1WithLossReport(sceneModel) {
  normalizeSceneForExport(sceneModel);
  const lossReport = createLossReport();

  const parts = [];
  for (let index = 0; index < sceneModel.blocks.length; index += 1) {
    const rendered = serializeMarkdownBlock(sceneModel.blocks[index], index, lossReport);
    if (rendered.trim().length === 0) continue;
    if (parts.length > 0) parts.push('');
    parts.push(rendered);
  }

  return {
    markdown: normalizeJoinedOutput(parts),
    lossReport: finalizeLossReport(lossReport),
  };
}

export function serializePlainTextV1WithLossReport(sceneModel) {
  normalizeSceneForExport(sceneModel);
  const lossReport = createLossReport();

  const parts = [];
  for (let index = 0; index < sceneModel.blocks.length; index += 1) {
    const rendered = serializePlainTextBlock(sceneModel.blocks[index], index, lossReport);
    if (rendered.trim().length === 0) continue;
    if (parts.length > 0) parts.push('');
    parts.push(rendered);
  }

  return {
    text: normalizeJoinedOutput(parts),
    lossReport: finalizeLossReport(lossReport),
  };
}

export function serializeMarkdownV1(sceneModel) {
  return serializeMarkdownV1WithLossReport(sceneModel).markdown;
}

export function serializePlainTextV1(sceneModel) {
  return serializePlainTextV1WithLossReport(sceneModel).text;
}

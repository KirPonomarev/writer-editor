import { appendLoss, createLossReport, finalizeLossReport } from './lossReport.mjs';
import { createMarkdownTransformError } from './types.mjs';

export const MARKDOWN_EXPORT_LOSS_REASON_CODES = Object.freeze({
  INVALID_BLOCK_SHAPE_DOWNGRADED: 'MDV1_INVALID_BLOCK_SHAPE_DOWNGRADED',
  UNKNOWN_BLOCK_TYPE_DOWNGRADED: 'MDV1_UNKNOWN_BLOCK_TYPE_DOWNGRADED',
  HEADING_TEXT_NORMALIZED: 'MDV1_HEADING_TEXT_NORMALIZED',
  HEADING_LEVEL_NORMALIZED: 'MDV1_HEADING_LEVEL_NORMALIZED',
  LIST_ITEM_TEXT_NORMALIZED: 'MDV1_LIST_ITEM_TEXT_NORMALIZED',
  CODE_TEXT_NORMALIZED: 'MDV1_CODE_TEXT_NORMALIZED',
  CODE_LANGUAGE_NORMALIZED: 'MDV1_CODE_LANGUAGE_NORMALIZED',
  EMPTY_BLOCK_DROPPED: 'MDV1_EMPTY_BLOCK_DROPPED',
  TEXT_BLOCK_FORMAT_DOWNGRADED: 'TEXTV1_BLOCK_FORMAT_DOWNGRADED',
});

function toLF(text) {
  return String(text ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function normalizeFenceLanguage(language) {
  return String(language ?? '').trim().toLowerCase();
}

function normalizeText(text) {
  return toLF(text);
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
  const normalized = parts
    .map((part) => toLF(part).replace(/\n+$/gu, ''))
    .filter((part) => part.length > 0)
    .join('\n\n');
  return `${normalized}\n`;
}

function appendInitialLosses(report, sceneModel) {
  const items = Array.isArray(sceneModel?.lossReport?.items) ? sceneModel.lossReport.items : [];
  for (const item of items) appendLoss(report, item);
}

function escapeParagraphBlockSyntax(value) {
  return normalizeText(value).split('\n').map((line) => {
    if (/^\\/u.test(line)) return line;
    if (/^\d+\.\s/u.test(line)) return line.replace(/^(\d+)\./u, '$1\\.');
    if (
      /^#{1,6}\s/u.test(line)
      || /^[-+*]\s/u.test(line)
      || /^>\s?/u.test(line)
      || /^`{3,}/u.test(line)
      || /^(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line)
    ) {
      return `\\${line}`;
    }
    return line;
  }).join('\n');
}

function longestBacktickRun(value) {
  const matches = String(value ?? '').match(/`+/gu) || [];
  return matches.reduce((longest, item) => Math.max(longest, item.length), 0);
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
  const normalizedLanguage = normalizeFenceLanguage(block.language);
  const language = /^[a-z0-9][a-z0-9_+.-]{0,63}$/u.test(normalizedLanguage)
    ? normalizedLanguage
    : '';
  if (normalizedLanguage && !language) {
    appendExportLoss(
      report,
      MARKDOWN_EXPORT_LOSS_REASON_CODES.CODE_LANGUAGE_NORMALIZED,
      blockPath(blockIndex),
      'Unsafe or unsupported code-fence language was omitted.',
      normalizedLanguage,
    );
  }
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
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(code) + 1));
  const open = language.length > 0 ? `${fence}${language}` : fence;
  return `${open}\n${code}\n${fence}`;
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
      if (level !== bounded) {
        appendExportLoss(
          report,
          MARKDOWN_EXPORT_LOSS_REASON_CODES.HEADING_LEVEL_NORMALIZED,
          blockPath(blockIndex),
          'Heading level was bounded to Markdown levels 1 through 6.',
          String(block.level),
        );
      }
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
      return escapeParagraphBlockSyntax(block.text);
    default: {
      const fallbackText = extractBlockText(block);
      appendExportLoss(
        report,
        MARKDOWN_EXPORT_LOSS_REASON_CODES.UNKNOWN_BLOCK_TYPE_DOWNGRADED,
        blockPath(blockIndex),
        'Unknown block downgraded to paragraph-safe text.',
        String(block.type || ''),
      );
      if (fallbackText.length > 0) return escapeParagraphBlockSyntax(fallbackText);
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
  appendInitialLosses(lossReport, sceneModel);

  const parts = [];
  for (let index = 0; index < sceneModel.blocks.length; index += 1) {
    const rendered = serializeMarkdownBlock(sceneModel.blocks[index], index, lossReport);
    if (rendered.trim().length === 0) {
      appendExportLoss(
        lossReport,
        MARKDOWN_EXPORT_LOSS_REASON_CODES.EMPTY_BLOCK_DROPPED,
        blockPath(index),
        'Empty block cannot be represented as a distinct Markdown block and was omitted.',
        String(sceneModel.blocks[index]?.type || 'unknown'),
      );
      continue;
    }
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
  appendInitialLosses(lossReport, sceneModel);

  const parts = [];
  for (let index = 0; index < sceneModel.blocks.length; index += 1) {
    const rendered = serializePlainTextBlock(sceneModel.blocks[index], index, lossReport);
    if (rendered.trim().length === 0) continue;
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

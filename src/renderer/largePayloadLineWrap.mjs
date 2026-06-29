const DEFAULT_CHAR_WIDTH_PX = 10;
const WORD_OR_SPACE_RUN_PATTERN = /\S+|\s+/gu;

function toPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function measureTextWidth(measureText, text) {
  if (typeof measureText === 'function') {
    return toPositiveNumber(measureText(String(text || '')), 0);
  }
  return String(text || '').length * DEFAULT_CHAR_WIDTH_PX;
}

function pushLine(lines, line, maxLines) {
  if (!line || lines.length >= maxLines) {
    return;
  }
  lines.push(line.replace(/\s+$/u, ''));
}

function appendOversizedTokenLines({
  lines,
  token,
  measureText,
  maxLineWidthPx,
  maxLines,
} = {}) {
  let current = '';
  for (const char of String(token || '')) {
    const candidate = `${current}${char}`;
    if (current && measureTextWidth(measureText, candidate) > maxLineWidthPx) {
      pushLine(lines, current, maxLines);
      current = char;
      if (lines.length >= maxLines) {
        return '';
      }
    } else {
      current = candidate;
    }
  }
  return current;
}

export function buildLargePayloadLineSafeRows({
  sourceText = '',
  pageNumber = 1,
  pageCharBudget = 520,
  visibleCharBudget = 1600,
  contentWidthPx = 1,
  contentHeightPx = 32,
  lineHeightPx = 32,
  topGuardPx = 0,
  bottomGuardPx = 0,
  lineWidthSafetyPx = 12,
  measureText,
} = {}) {
  const resolvedSourceText = String(sourceText ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const resolvedPageNumber = Math.max(1, Math.round(Number(pageNumber) || 1));
  const resolvedPageCharBudget = Math.max(1, Math.round(Number(pageCharBudget) || 1));
  const resolvedVisibleCharBudget = Math.max(
    resolvedPageCharBudget,
    Math.round(Number(visibleCharBudget) || resolvedPageCharBudget),
  );
  const start = Math.max(0, (resolvedPageNumber - 1) * resolvedPageCharBudget);
  if (start >= resolvedSourceText.length) {
    return [];
  }

  const resolvedLineHeightPx = toPositiveNumber(lineHeightPx, 32);
  const resolvedContentHeightPx = toPositiveNumber(contentHeightPx, resolvedLineHeightPx);
  const resolvedTopGuardPx = Math.max(0, Number(topGuardPx) || 0);
  const resolvedBottomGuardPx = Math.max(0, Number(bottomGuardPx) || 0);
  const maxLines = Math.max(
    1,
    Math.floor(Math.max(
      resolvedLineHeightPx,
      resolvedContentHeightPx - resolvedTopGuardPx - resolvedBottomGuardPx,
    ) / resolvedLineHeightPx),
  );
  const maxLineWidthPx = Math.max(
    1,
    toPositiveNumber(contentWidthPx, 1) - Math.max(0, Number(lineWidthSafetyPx) || 0),
  );

  const end = Math.min(resolvedSourceText.length, start + resolvedVisibleCharBudget);
  const raw = resolvedSourceText.slice(start, end);
  const tokens = raw.match(WORD_OR_SPACE_RUN_PATTERN) || [];
  const lines = [];
  let currentLine = '';

  for (const token of tokens) {
    if (lines.length >= maxLines) {
      break;
    }
    if (!currentLine && /^\s+$/u.test(token)) {
      continue;
    }
    const candidate = `${currentLine}${token}`;
    if (
      candidate.trim()
      && measureTextWidth(measureText, candidate.replace(/\s+$/u, '')) <= maxLineWidthPx
    ) {
      currentLine = candidate;
      continue;
    }
    pushLine(lines, currentLine, maxLines);
    if (lines.length >= maxLines) {
      currentLine = '';
      break;
    }
    if (/^\s+$/u.test(token)) {
      currentLine = '';
      continue;
    }
    if (measureTextWidth(measureText, token) <= maxLineWidthPx) {
      currentLine = token;
    } else {
      currentLine = appendOversizedTokenLines({
        lines,
        token,
        measureText,
        maxLineWidthPx,
        maxLines,
      });
    }
  }

  pushLine(lines, currentLine, maxLines);
  return lines;
}

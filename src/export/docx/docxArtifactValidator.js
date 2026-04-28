'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const REQUIRED_DOCX_ENTRIES = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'word/document.xml',
]);

const SUPPORTED_MINIMAL_MARKS = Object.freeze(['bold', 'italic', 'underline']);

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function xmlUnescape(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function issue(code, message, details = {}) {
  return Object.freeze({ code, message, details });
}

function readUInt32LESafe(buffer, offset) {
  return offset + 4 <= buffer.length ? buffer.readUInt32LE(offset) : null;
}

function extractStoredZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = readUInt32LESafe(buffer, offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) {
      entries.set('__ZIP_ERROR__', Buffer.from('ENTRY_OUT_OF_RANGE'));
      break;
    }
    const name = buffer.slice(nameStart, nameStart + fileNameLength).toString('utf8');
    if (method === 0) {
      entries.set(name, buffer.slice(dataStart, dataEnd));
    } else {
      entries.set(name, null);
      entries.set(`__UNSUPPORTED_METHOD__:${name}`, Buffer.from(String(method)));
    }
    offset = dataEnd;
  }
  return entries;
}

function extractParagraphs(documentXml) {
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s\S]*?<\/w:p>/g;
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(String(documentXml || '')))) {
    const paragraphXml = paragraphMatch[0];
    const styleMatch = paragraphXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const runs = [];
    const runRegex = /<w:r[\s\S]*?<\/w:r>/g;
    let runMatch;
    while ((runMatch = runRegex.exec(paragraphXml))) {
      const runXml = runMatch[0];
      const pieces = [];
      const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textMatch;
      while ((textMatch = textRegex.exec(runXml))) {
        pieces.push(xmlUnescape(textMatch[1]));
      }
      runs.push({
        text: pieces.join(''),
        bold: /<w:b(?:\/|\s|>)/.test(runXml),
        italic: /<w:i(?:\/|\s|>)/.test(runXml),
        underline: /<w:u\b/.test(runXml),
      });
    }
    paragraphs.push({
      style: styleMatch ? xmlUnescape(styleMatch[1]) : '',
      text: runs.map((run) => run.text).join(''),
      runs,
    });
  }
  return paragraphs;
}

function findOrderedText(paragraphs, expectedTexts) {
  const misses = [];
  let cursor = 0;
  for (const expectedText of expectedTexts) {
    const expected = normalizeText(expectedText).trim();
    if (!expected) continue;
    const foundIndex = paragraphs.findIndex((paragraph, index) => (
      index >= cursor && normalizeText(paragraph.text).includes(expected)
    ));
    if (foundIndex < 0) {
      misses.push(expected);
    } else {
      cursor = foundIndex + 1;
    }
  }
  return misses;
}

function expectedSceneTexts(ir) {
  return (ir.scenes || []).map((scene) => scene.title);
}

function expectedBlockTexts(ir) {
  return (ir.scenes || []).flatMap((scene) => (
    (scene.blocks || []).map((block) => block.text)
  ));
}

function findMissingInlineMarks(paragraphs, ir) {
  const missing = [];
  for (const scene of ir.scenes || []) {
    for (const block of scene.blocks || []) {
      const text = normalizeText(block.text);
      for (const range of block.inlineRanges || []) {
        if (!SUPPORTED_MINIMAL_MARKS.includes(range.kind)) continue;
        if (range.offsetUnit && range.offsetUnit !== 'codeUnit') continue;
        const from = Number(range.from);
        const to = Number(range.to);
        const markedText = text.slice(from, to);
        if (!markedText) continue;
        const found = paragraphs.some((paragraph) => (
          paragraph.runs.some((run) => run.text.includes(markedText) && run[range.kind] === true)
        ));
        if (!found) {
          missing.push(`${range.kind}:${markedText}`);
        }
      }
    }
  }
  return missing;
}

async function readArtifactBuffer(artifact) {
  if (Buffer.isBuffer(artifact)) return artifact;
  if (typeof artifact === 'string') return fs.readFile(artifact);
  throw new TypeError('DOCX_ARTIFACT_MUST_BE_BUFFER_OR_PATH');
}

async function validateDocxArtifactForCompileIR(artifact, ir, options = {}) {
  const issues = [];
  let buffer = Buffer.alloc(0);
  try {
    buffer = await readArtifactBuffer(artifact);
  } catch (error) {
    return {
      ok: false,
      issues: [issue('E_DOCX_ARTIFACT_UNREADABLE', 'DOCX artifact could not be read', { message: error.message })],
      artifact: null,
    };
  }

  const entries = extractStoredZipEntries(buffer);
  for (const entryName of REQUIRED_DOCX_ENTRIES) {
    if (!entries.has(entryName)) {
      issues.push(issue('E_DOCX_REQUIRED_ENTRY_MISSING', `${entryName} is missing`, { entryName }));
    }
  }
  for (const [name, value] of entries) {
    if (name.startsWith('__UNSUPPORTED_METHOD__:')) {
      issues.push(issue('E_DOCX_UNSUPPORTED_ZIP_METHOD', 'Only stored DOCX fixture entries are supported', { entryName: name.slice(23), method: value.toString('utf8') }));
    }
  }

  const documentXml = entries.get('word/document.xml')?.toString('utf8') || '';
  const paragraphs = extractParagraphs(documentXml);
  const extractedText = normalizeText(paragraphs.map((paragraph) => paragraph.text).join('\n')).trim();
  if (!documentXml) {
    issues.push(issue('E_DOCX_DOCUMENT_XML_MISSING', 'word/document.xml is missing or empty'));
  }
  if (paragraphs.length === 0) {
    issues.push(issue('E_DOCX_PARAGRAPHS_MISSING', 'No DOCX paragraphs could be extracted'));
  }
  if (!extractedText) {
    issues.push(issue('E_DOCX_TEXT_EMPTY', 'DOCX text is empty'));
  }

  const sceneOrderMisses = findOrderedText(paragraphs, expectedSceneTexts(ir || {}));
  if (sceneOrderMisses.length > 0) {
    issues.push(issue('E_DOCX_SCENE_ORDER_MISMATCH', 'Scene title excerpt order does not match CompileIR', { missingOrOutOfOrder: sceneOrderMisses }));
  }

  const blockOrderMisses = findOrderedText(paragraphs, expectedBlockTexts(ir || {}));
  if (blockOrderMisses.length > 0) {
    issues.push(issue('E_DOCX_BLOCK_ORDER_MISMATCH', 'Block text excerpt order does not match CompileIR', { missingOrOutOfOrder: blockOrderMisses }));
  }

  const missingMarks = findMissingInlineMarks(paragraphs, ir || {});
  if (missingMarks.length > 0) {
    issues.push(issue('E_DOCX_INLINE_MARK_MISSING', 'Minimal inline mark presence is missing', { missingMarks }));
  }

  const requireHeadingText = options.requireHeadingText !== false;
  if (requireHeadingText) {
    const missingHeadings = (ir?.scenes || [])
      .flatMap((scene) => scene.blocks || [])
      .filter((block) => block.type === 'heading')
      .map((block) => normalizeText(block.text).trim())
      .filter((heading) => heading && !paragraphs.some((paragraph) => normalizeText(paragraph.text).includes(heading)));
    if (missingHeadings.length > 0) {
      issues.push(issue('E_DOCX_HEADING_TEXT_MISSING', 'Heading text is missing from DOCX artifact', { missingHeadings }));
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    artifact: {
      rawArtifactHash: sha256Buffer(buffer),
      entryNames: [...entries.keys()].filter((entryName) => !entryName.startsWith('__')).sort(),
      paragraphCount: paragraphs.length,
      extractedTextPreview: extractedText.slice(0, 240),
      validationScope: 'CONTENT_ORDER_AND_MINIMAL_MARKS_ONLY',
      noStyleFidelityClaim: true,
      noLayoutFidelityClaim: true,
    },
  };
}

module.exports = {
  REQUIRED_DOCX_ENTRIES,
  SUPPORTED_MINIMAL_MARKS,
  extractParagraphs,
  extractStoredZipEntries,
  validateDocxArtifactForCompileIR,
};

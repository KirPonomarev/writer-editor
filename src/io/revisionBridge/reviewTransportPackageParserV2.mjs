import documentTables from '../documentTables.js';
import {
  RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
  RTK_REVIEW_IR_V2_SCHEMA,
  RTK_V6_BUDGETS,
  stableJson,
} from './reviewTransportCore.mjs';

import {
  crc32,
  resolveEffectiveBudgets,
  effectiveBudgetDigest,
  evaluateZipCrcEvidence,
  RTK_ZIP_PROFILE_DEFAULTS_V6,
  RTK_ZIP_CEILING_DECLARED,
} from './reviewTransportZipEvidenceV1.mjs';

export const RTK_REVIEW_TRANSPORT_PACKAGE_PARSER_V2_PROFILE =
  'yalken.rtk.package-aware-review-ir-parser.v2.b02';
export const RTK_REVIEW_TRANSPORT_PACKAGE_PARSER_V2_BUILD =
  'bounded-namespace-package-scanner-quote-aware-entities-budgets-c3';
export const RTK_REVIEW_TRANSPORT_AUTHORITY_CARRIER_V2_SCHEMA =
  'yalken.rtk.review-transport-authority-carrier.v2';
export const RTK_REVIEW_TRANSPORT_AUTHORITY_CUSTOM_PROPERTY_NAMES = Object.freeze([
  'YRTK_C01_AUTH',
]);

import { fromWordParagraphAlignment } from '../paragraphAlignment.mjs';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
const W15_NS = 'http://schemas.microsoft.com/office/word/2012/wordml';
const W16CID_NS = 'http://schemas.microsoft.com/office/word/2016/wordml/cid';
const W16CEX_NS = 'http://schemas.microsoft.com/office/word/2018/wordml/cex';
const W16DU_NS = 'http://schemas.microsoft.com/office/word/2023/wordml/word16du';
const CORE_PROPS_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
const DC_NS = 'http://purl.org/dc/elements/1.1/';
const DCTERMS_NS = 'http://purl.org/dc/terms/';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const CUSTOM_PROPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const CUSTOM_PROPS_VT_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
const WORD_DOCUMENT_METADATA_SCHEMA = 'yalken.rtk.word.document-metadata.v1';
const WORD_DOCUMENT_SECTIONS_SCHEMA = 'yalken.rtk.word.document-sections.v1';
const WORD_DOCUMENT_METADATA_PUBLIC_PROPERTIES = Object.freeze([
  'YALKEN_METADATA_SCHEMA',
  'YALKEN_METADATA_POLICY',
  'YALKEN_PROJECT_ID',
  'YALKEN_PROJECT_TITLE',
  'YALKEN_PROJECT_CREATED_AT_UTC',
  'YALKEN_APPLICATION_CREATOR',
  'YALKEN_METADATA_DIGEST',
]);
const WORD_DOCUMENT_METADATA_AUTHORITY_PROPERTIES = Object.freeze([
  'YRTK_C01_AUTH',
  'YRTK2_TOKEN',
  'YRTK_CORE_DIGEST',
]);
const SIGNED_SHA256_RE = /^sha256:[a-f0-9]{64}$/u;
const HMAC_RE = /^hmac-sha256:[a-f0-9]{64}$/u;

const REQUIRED_PARTS = Object.freeze(['word/document.xml']);
const CORE_PARTS = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'word/_rels/document.xml.rels',
  'word/document.xml',
  'word/comments.xml',
  'word/commentsExtended.xml',
  'word/commentsExtensible.xml',
  'word/commentsIds.xml',
  'word/people.xml',
  'word/footnotes.xml',
  'word/endnotes.xml',
  'docProps/custom.xml',
  'docProps/core.xml',
]);
const KNOWN_ADVISORY_PARTS = Object.freeze([
  'word/styles.xml',
  'word/numbering.xml',
  'word/settings.xml',
  'word/fontTable.xml',
  'word/webSettings.xml',
  'docProps/app.xml',
]);

function isEmbeddedFontPartName(partName) {
  return /^word\/fonts\/[A-Za-z0-9_.-]+\.odttf$/u.test(partName);
}

const ACTIVE_RELATIONSHIP_MARKERS = Object.freeze([
  'vbaProject',
  'oleObject',
  'activeX',
  'attachedTemplate',
]);
const ACTIVE_CONTENT_TYPE_MARKERS = Object.freeze([
  'vbaProject',
  'oleObject',
  'activeX',
]);
const DOCUMENT_UNSUPPORTED_ELEMENTS = Object.freeze([
  'altChunk',
  'AlternateContent',
  'object',
  'drawing',
  'pict',
  'tbl',
  'fldSimple',
  'instrText',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rawString(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function reason(code, field, message, details = {}) {
  return { code, field, message, ...details };
}

// Resolve the effective budget object via the shared min-clamp resolver
// (F-11/P1-02). profileDefaults are the V6 values; ceilings are the declared
// product max (50k for counts, 64 MiB worker output). Caller requests above a
// ceiling are clamped and recorded — never silently widened.
function normalizeBudgets(input = {}) {
  const { effective, clampedFields } = resolveEffectiveBudgets({
    requested: input,
    profileDefaults: RTK_ZIP_PROFILE_DEFAULTS_V6,
    ceiling: RTK_ZIP_CEILING_DECLARED,
  });
  return effective;
}

function resolveBudgetsWithClamps(input = {}) {
  return resolveEffectiveBudgets({
    requested: input,
    profileDefaults: RTK_ZIP_PROFILE_DEFAULTS_V6,
    ceiling: RTK_ZIP_CEILING_DECLARED,
  });
}

function resolveCryptoPort(port) {
  const missing = [];
  for (const key of ['sha256Text', 'sha256Json', 'byteLength']) {
    if (typeof port?.[key] !== 'function') missing.push(key);
  }
  return {
    ok: missing.length === 0,
    missing,
    sha256Text: port?.sha256Text?.bind(port),
    sha256Json: port?.sha256Json?.bind(port),
    byteLength: port?.byteLength?.bind(port),
    hmacSha256Json: typeof port?.hmacSha256Json === 'function' ? port.hmacSha256Json.bind(port) : null,
    crc32: typeof port?.crc32 === 'function' ? port.crc32.bind(port) : null,
  };
}

function charIsName(value) {
  const code = value.charCodeAt(0);
  return (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || (code >= 48 && code <= 57)
    || value === '_' || value === '-' || value === '.' || value === ':';
}

function readName(text, cursor) {
  let index = cursor;
  while (index < text.length && charIsName(text[index])) index += 1;
  return { value: text.slice(cursor, index), next: index };
}

function isValidXmlCharCode(codePoint) {
  return codePoint === 0x9
    || codePoint === 0xa
    || codePoint === 0xd
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function splitQName(qName) {
  const text = rawString(qName);
  const colon = text.indexOf(':');
  if (colon < 0) return { prefix: '', localName: text };
  return {
    prefix: text.slice(0, colon),
    localName: text.slice(colon + 1),
  };
}

function decodeEntityBody(entityBody) {
  if (entityBody === 'lt') return { ok: true, value: '<' };
  if (entityBody === 'gt') return { ok: true, value: '>' };
  if (entityBody === 'amp') return { ok: true, value: '&' };
  if (entityBody === 'quot') return { ok: true, value: '"' };
  if (entityBody === 'apos') return { ok: true, value: "'" };
  if (entityBody.startsWith('#x') || entityBody.startsWith('#X')) {
    const hex = entityBody.slice(2);
    if (!hex || ![...hex].every((char) => /[0-9a-fA-F]/u.test(char))) {
      return { ok: false, value: '' };
    }
    const codePoint = Number.parseInt(hex, 16);
    if (!Number.isSafeInteger(codePoint) || !isValidXmlCharCode(codePoint)) return { ok: false, value: '' };
    return { ok: true, value: String.fromCodePoint(codePoint) };
  }
  if (entityBody.startsWith('#')) {
    const decimal = entityBody.slice(1);
    if (!decimal || ![...decimal].every((char) => char >= '0' && char <= '9')) {
      return { ok: false, value: '' };
    }
    const codePoint = Number.parseInt(decimal, 10);
    if (!Number.isSafeInteger(codePoint) || !isValidXmlCharCode(codePoint)) return { ok: false, value: '' };
    return { ok: true, value: String.fromCodePoint(codePoint) };
  }
  return { ok: false, value: '' };
}

function decodeEntities(text, diagnostics = null, field = 'xml.text') {
  const source = rawString(text);
  let output = '';
  let cursor = 0;
  while (cursor < source.length) {
    const amp = source.indexOf('&', cursor);
    if (amp < 0) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, amp);
    const semi = source.indexOf(';', amp + 1);
    if (semi < 0) {
      diagnostics?.push(reason('RTK_XML_MALFORMED_BLOCKED', field, 'XML entity reference is not terminated.'));
      output += source.slice(amp);
      break;
    }
    const body = source.slice(amp + 1, semi);
    const decoded = decodeEntityBody(body);
    if (!decoded.ok) {
      diagnostics?.push(reason('RTK_XML_MALFORMED_BLOCKED', field, 'XML entity reference is invalid or unsupported.', {
        entity: `&${body};`,
      }));
      output += source.slice(amp, semi + 1);
    } else {
      output += decoded.value;
    }
    cursor = semi + 1;
  }
  return output;
}

function createParserBudgetState(budgets, cryptoPort) {
  return {
    budgets,
    cryptoPort,
    blocks: 0,
    revisions: 0,
    comments: 0,
    candidates: 0,
    workerOutputBytes: 0,
    exceededCodes: new Set(),
  };
}

function budgetExceededReason(field, message, details = {}) {
  return reason('RTK_BUDGET_EXCEEDED', field, message, details);
}

function recordBudgetExceeded(state, diagnostics, key, field, message, details = {}) {
  const token = `${key}:${field}`;
  if (!state.exceededCodes.has(token)) {
    diagnostics.push(budgetExceededReason(field, message, details));
    state.exceededCodes.add(token);
  }
}

function admitBudgetCount(state, diagnostics, key, limit, field, message) {
  state[key] += 1;
  if (state[key] > limit) {
    recordBudgetExceeded(state, diagnostics, key, field, message, {
      actual: state[key],
      limit,
    });
    return false;
  }
  return true;
}

function admitWorkerOutput(state, diagnostics, field, value) {
  const bytes = state.cryptoPort.byteLength(stableJson(value));
  if (state.workerOutputBytes + bytes > state.budgets.maxWorkerOutputBytes) {
    recordBudgetExceeded(
      state,
      diagnostics,
      'workerOutputBytes',
      field,
      'Parser worker output budget exceeded before semantic accumulation.',
      {
        actual: state.workerOutputBytes + bytes,
        limit: state.budgets.maxWorkerOutputBytes,
      },
    );
    return false;
  }
  state.workerOutputBytes += bytes;
  return true;
}

function parseRawAttributes(attrText, budgets, cryptoPort, partName) {
  const attributes = [];
  const diagnostics = [];
  let cursor = 0;
  while (cursor < attrText.length) {
    while (cursor < attrText.length && attrText[cursor].trim() === '') cursor += 1;
    if (cursor >= attrText.length || attrText[cursor] === '/') break;
    const name = readName(attrText, cursor);
    if (!name.value) {
      diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', `${partName}.attributes`, 'XML attribute name is malformed.'));
      break;
    }
    cursor = name.next;
    while (cursor < attrText.length && attrText[cursor].trim() === '') cursor += 1;
    if (attrText[cursor] !== '=') {
      diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', `${partName}.attributes.${name.value}`, 'XML attribute is missing equals sign.'));
      break;
    }
    cursor += 1;
    while (cursor < attrText.length && attrText[cursor].trim() === '') cursor += 1;
    const quote = attrText[cursor];
    if (quote !== '"' && quote !== "'") {
      diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', `${partName}.attributes.${name.value}`, 'XML attribute value must be quoted.'));
      break;
    }
    cursor += 1;
    const start = cursor;
    while (cursor < attrText.length && attrText[cursor] !== quote) cursor += 1;
    if (cursor >= attrText.length) {
      diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', `${partName}.attributes.${name.value}`, 'XML attribute quote is not closed.'));
      break;
    }
    const value = decodeEntities(attrText.slice(start, cursor), diagnostics, `${partName}.attributes.${name.value}`);
    cursor += 1;
    if (attributes.length >= budgets.maxAttributes) {
      diagnostics.push(reason('RTK_BUDGET_EXCEEDED', `${partName}.attributes`, 'XML attribute budget exceeded.'));
      continue;
    }
    if (cryptoPort.byteLength(value) > budgets.maxAttributeBytes) {
      diagnostics.push(reason(
        'RTK_BUDGET_EXCEEDED',
        `${partName}.attributes.${name.value}`,
        'XML attribute byte budget exceeded.',
      ));
      continue;
    }
    const split = splitQName(name.value);
    attributes.push({
      qName: name.value,
      prefix: split.prefix,
      localName: split.localName,
      value,
    });
  }
  return { attributes, diagnostics };
}

// PARSER-01 (P3): attribute binding detects a DUPLICATE expanded attribute —
// the same (namespaceUri, localName) pair appearing twice, whether via the same
// prefix (w:id="1" w:id="2") or via different prefixes bound to the same
// namespace (w:id="1" x:id="2" with x -> WordprocessingML). The duplicate is a
// typed RTK_XML_DUPLICATE_ATTRIBUTE rejection; it never silently overwrites.
// FIRST-WINS policy is used for the reader maps so a duplicate does not let the
// second value leak into a token's attributes (the rejection already makes the
// parse fail, but first-wins keeps the in-progress token shape deterministic).
function bindAttributes(attributes, nsMap) {
  const attrsByLocal = {};
  const attrsByQName = {};
  const attrsByNs = {};
  const diagnostics = [];
  const seenExpanded = new Set();
  const bound = attributes.map((attribute) => {
    const namespaceUri = attribute.prefix ? rawString(nsMap[attribute.prefix]) : '';
    const item = { ...attribute, namespaceUri };
    const expandedKey = `${item.namespaceUri}|${item.localName}`;
    if (seenExpanded.has(expandedKey)) {
      diagnostics.push(reason('RTK_XML_DUPLICATE_ATTRIBUTE', 'xml.attributes', 'XML duplicate expanded attribute is rejected.', {
        namespaceUri: item.namespaceUri,
        localName: item.localName,
      }));
    } else {
      seenExpanded.add(expandedKey);
    }
    if (!Object.prototype.hasOwnProperty.call(attrsByLocal, item.localName)) {
      attrsByLocal[item.localName] = item.value;
    }
    if (!Object.prototype.hasOwnProperty.call(attrsByQName, item.qName)) {
      attrsByQName[item.qName] = item.value;
    }
    if (!Object.prototype.hasOwnProperty.call(attrsByNs, expandedKey)) {
      attrsByNs[expandedKey] = item.value;
    }
    return item;
  }).sort((left, right) => (
    `${left.namespaceUri}|${left.localName}|${left.qName}`.localeCompare(
      `${right.namespaceUri}|${right.localName}|${right.qName}`,
    )
  ));
  return { attributes: bound, attrsByLocal, attrsByQName, attrsByNs, diagnostics };
}

function applyNamespaceDeclarations(parentMap, attributes) {
  const next = { ...parentMap };
  for (const attribute of attributes) {
    if (attribute.qName === 'xmlns') next[''] = attribute.value;
    if (attribute.prefix === 'xmlns') next[attribute.localName] = attribute.value;
  }
  return next;
}

function skipSpecialXml(text, open) {
  if (text.startsWith('<!--', open)) {
    const close = text.indexOf('-->', open + 4);
    return close < 0 ? -1 : close + 3;
  }
  if (text.startsWith('<![CDATA[', open)) {
    const close = text.indexOf(']]>', open + 9);
    return close < 0 ? -1 : close + 3;
  }
  return 0;
}

function readMarkupDeclarationName(text, open) {
  let cursor = open + 2;
  while (cursor < text.length && text[cursor].trim() === '') cursor += 1;
  const name = readName(text, cursor);
  return name.value.toUpperCase();
}

function findXmlTagClose(text, open, diagnostics = null, partName = 'xml') {
  let quote = '';
  for (let cursor = open + 1; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return cursor;
    if (char === '<') {
      diagnostics?.push(reason('RTK_XML_MALFORMED_BLOCKED', partName, 'XML tag contains an unescaped opening bracket.'));
      return -1;
    }
  }
  diagnostics?.push(reason(
    'RTK_XML_MALFORMED_BLOCKED',
    partName,
    quote ? 'XML tag quote is not closed.' : 'XML tag is not closed.',
  ));
  return -1;
}

function rawTagLocalName(raw) {
  const nameStart = raw.startsWith('/') ? 1 : 0;
  return splitQName(readName(raw, nameStart).value).localName;
}

function parseXmlPart(partName, xml, budgets, cryptoPort, budgetState = null) {
  const text = rawString(xml);
  const tokens = [];
  const diagnostics = [];
  const stack = [];
  let cursor = 0;
  let stopForBudget = false;
  while (cursor < text.length) {
    const open = text.indexOf('<', cursor);
    if (open < 0) {
      decodeEntities(text.slice(cursor), diagnostics, `${partName}.text`);
      break;
    }
    decodeEntities(text.slice(cursor, open), diagnostics, `${partName}.text`);
    const specialSkip = skipSpecialXml(text, open);
    if (specialSkip < 0) {
      diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', partName, 'XML special block is not closed.'));
      break;
    }
    if (specialSkip > 0) {
      cursor = specialSkip;
      continue;
    }
    const declarationName = readMarkupDeclarationName(text, open);
    if (declarationName === 'DOCTYPE' || declarationName === 'ENTITY') {
      diagnostics.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', partName, 'DTD or entity declaration is blocked.'));
      const declarationClose = text.indexOf('>', open + 2);
      cursor = declarationClose < 0 ? text.length : declarationClose + 1;
      continue;
    }
    const close = findXmlTagClose(text, open, diagnostics, partName);
    if (close < 0) {
      break;
    }
    const raw = text.slice(open + 1, close).trim();
    cursor = close + 1;
    if (!raw) continue;
    const rawUpper = raw.toUpperCase();
    if (rawUpper.startsWith('!DOCTYPE') || rawUpper.startsWith('!ENTITY')) {
      diagnostics.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', partName, 'DTD or entity declaration is blocked.'));
      continue;
    }
    if (raw.startsWith('!') || raw.startsWith('?')) continue;

    const closing = raw.startsWith('/');
    const selfClosing = raw.endsWith('/');
    const nameStart = closing ? 1 : 0;
    const parsedName = readName(raw, nameStart);
    if (!parsedName.value) {
      diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', partName, 'XML element name is missing.'));
      continue;
    }
    const qName = parsedName.value;
    const split = splitQName(qName);
    if (budgetState && !closing && partName === 'word/document.xml') {
      if (split.localName === 'p') {
        stopForBudget = stopForBudget || !admitBudgetCount(
          budgetState,
          diagnostics,
          'blocks',
          budgets.maxBlocks,
          `${partName}.blocks`,
          'Block budget exceeded while scanning document XML.',
        );
      }
      if (['ins', 'del', 'moveFrom', 'moveTo', 'rPrChange', 'pPrChange', 'numPrChange'].includes(split.localName)) {
        stopForBudget = stopForBudget || !admitBudgetCount(
          budgetState,
          diagnostics,
          'revisions',
          budgets.maxRevisions,
          `${partName}.revisions`,
          'Revision budget exceeded while scanning document XML.',
        );
      }
    }
    if (budgetState && !closing && partName === 'word/comments.xml' && split.localName === 'comment') {
      stopForBudget = stopForBudget || !admitBudgetCount(
        budgetState,
        diagnostics,
        'comments',
        budgets.maxComments,
        `${partName}.comments`,
        'Comment budget exceeded while scanning comments XML.',
      );
    }
    if (stopForBudget) break;
    const parentMap = stack.length > 0 ? stack[stack.length - 1].nsMap : {};
    if (closing) {
      const last = stack.pop();
      // PARSER-01 (P1): closing token MUST match the expanded opening name —
      // prefix AND namespaceUri AND localName all match. A DIFFERENT localName
      // (e.g. open <w:ins>, close </w:p>) is a malformed XML error
      // (RTK_XML_MALFORMED_BLOCKED). The SAME localName + namespace but a
      // DIFFERENT prefix (e.g. open <w:p>, close </x:p> where both bind the
      // same WordprocessingML namespace) is a typed RTK_XML_QNAME_MISMATCH —
      // the expanded name is identical but the lexical QName differs, so it is
      // a real mismatch that must not be silently accepted.
      if (!last) {
        diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', partName, 'XML close tag has no matching open tag.', {
          elementName: split.localName,
        }));
      } else if (last.localName !== split.localName) {
        diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', partName, 'XML close tag does not match open tag.', {
          elementName: split.localName,
        }));
      } else {
        const closeNamespaceUri = rawString(parentMap[split.prefix || '']);
        const prefixMatches = last.prefix === split.prefix;
        const namespaceMatches = last.namespaceUri === closeNamespaceUri;
        if (!prefixMatches || !namespaceMatches) {
          diagnostics.push(reason('RTK_XML_QNAME_MISMATCH', partName, 'XML close tag expanded name does not match open tag.', {
            openQName: last.qName,
            closeQName: split.prefix ? `${split.prefix}:${split.localName}` : split.localName,
            openNamespaceUri: last.namespaceUri,
            closeNamespaceUri,
            localName: split.localName,
          }));
        } else {
          last.closeStart = open;
          last.closeEnd = close + 1;
          tokens.push(last);
        }
      }
      continue;
    }

    const attrParse = parseRawAttributes(raw.slice(parsedName.next), budgets, cryptoPort, partName);
    diagnostics.push(...attrParse.diagnostics);
    const nsMap = applyNamespaceDeclarations(parentMap, attrParse.attributes);
    const boundAttrs = bindAttributes(attrParse.attributes, nsMap);
    diagnostics.push(...boundAttrs.diagnostics);
    // PARSER-01 (P2): an element prefix with no xmlns declaration in the
    // effective nsMap is a typed RTK_XML_NAMESPACE_UNBOUND rejection, never a
    // silent collapse to the empty namespace. The empty default-namespace case
    // ('') for an unprefixed element is legitimate (P4) and stays ''.
    let namespaceUri;
    if (split.prefix) {
      if (!Object.prototype.hasOwnProperty.call(nsMap, split.prefix)) {
        diagnostics.push(reason('RTK_XML_NAMESPACE_UNBOUND', partName, 'XML element prefix is not bound to a namespace.', {
          prefix: split.prefix,
          localName: split.localName,
        }));
        namespaceUri = `UNBOUND:${split.prefix}`;
      } else {
        namespaceUri = rawString(nsMap[split.prefix]);
      }
    } else {
      namespaceUri = rawString(nsMap['']);
    }
    const token = {
      partName,
      qName,
      prefix: split.prefix,
      localName: split.localName,
      namespaceUri,
      attributes: boundAttrs.attributes,
      attrsByLocal: boundAttrs.attrsByLocal,
      attrsByQName: boundAttrs.attrsByQName,
      attrsByNs: boundAttrs.attrsByNs,
      selfClosing,
      openStart: open,
      openEnd: close + 1,
      closeStart: close,
      closeEnd: close + 1,
      depth: stack.length,
      path: [...stack.map((item) => item.localName), split.localName],
      nsMap,
    };
    if (stack.length + 1 > budgets.maxXmlDepth) {
      diagnostics.push(reason('RTK_BUDGET_EXCEEDED', `${partName}.xmlDepth`, 'XML depth budget exceeded.'));
      break;
    }
    if (selfClosing) tokens.push(token);
    else stack.push(token);
  }
  if (stack.length > 0) {
    diagnostics.push(reason('RTK_XML_MALFORMED_BLOCKED', partName, 'XML has unclosed elements.'));
  }
  return { partName, tokens, diagnostics };
}

function elementBody(xml, token) {
  if (!token || token.selfClosing) return '';
  return rawString(xml).slice(token.openEnd, token.closeStart);
}

function stripTagsToText(xml) {
  const text = rawString(xml);
  let output = '';
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('<', cursor);
    if (open < 0) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, open);
    const specialSkip = skipSpecialXml(text, open);
    if (specialSkip < 0) break;
    if (specialSkip > 0) {
      cursor = specialSkip;
      continue;
    }
    const close = findXmlTagClose(text, open);
    if (close < 0) break;
    const local = rawTagLocalName(text.slice(open + 1, close).trim());
    if (local === 'tab') output += '\t';
    if (local === 'br' || local === 'cr') output += '\n';
    cursor = close + 1;
  }
  return decodeEntities(output);
}

function normalizeRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .filter((range) => (
      Number.isSafeInteger(range?.start)
      && Number.isSafeInteger(range?.end)
      && range.end > range.start
    ))
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function appendTextOutsideRanges(output, source, start, end, skipRanges) {
  let cursor = start;
  for (const range of skipRanges) {
    if (range.end <= cursor) continue;
    if (range.start >= end) break;
    if (range.start > cursor) output += source.slice(cursor, Math.min(range.start, end));
    cursor = Math.max(cursor, range.end);
    if (cursor >= end) break;
  }
  if (cursor < end) output += source.slice(cursor, end);
  return output;
}

function positionInsideRanges(position, ranges) {
  return ranges.some((range) => position >= range.start && position < range.end);
}

function stripTagsToTextOutsideRanges(xml, ranges) {
  const text = rawString(xml);
  const skipRanges = normalizeRanges(ranges);
  let output = '';
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('<', cursor);
    if (open < 0) {
      output = appendTextOutsideRanges(output, text, cursor, text.length, skipRanges);
      break;
    }
    output = appendTextOutsideRanges(output, text, cursor, open, skipRanges);
    const specialSkip = skipSpecialXml(text, open);
    if (specialSkip < 0) break;
    if (specialSkip > 0) {
      cursor = specialSkip;
      continue;
    }
    const close = findXmlTagClose(text, open);
    if (close < 0) break;
    const local = rawTagLocalName(text.slice(open + 1, close).trim());
    if (!positionInsideRanges(open, skipRanges)) {
      if (local === 'tab') output += '\t';
      if (local === 'br' || local === 'cr') output += '\n';
    }
    cursor = close + 1;
  }
  return decodeEntities(output);
}

function trackedRejectedText(documentXml, documentScan) {
  const insertedRanges = documentScan.tokens
    .filter((token) => isWordToken(token, 'ins'))
    .map((token) => ({ start: token.openStart, end: token.closeEnd }));
  return stripTagsToTextOutsideRanges(documentXml, insertedRanges);
}

function wordDocumentText(documentXml, documentScan, options = {}) {
  const insertedRanges = options.skipInsertedRevisions === true
    ? normalizeRanges(documentScan.tokens
      .filter((token) => isWordToken(token, 'ins'))
      .map((token) => ({ start: token.openStart, end: token.closeEnd })))
    : [];
  let output = '';
  const textTokens = documentScan.tokens
    .filter((token) => ['t', 'delText', 'tab', 'br', 'cr'].includes(token.localName))
    .sort((left, right) => left.openStart - right.openStart || left.closeEnd - right.closeEnd);
  for (const token of textTokens) {
    if (positionInsideRanges(token.openStart, insertedRanges)) continue;
    if (token.localName === 'tab') output += '\t';
    else if (token.localName === 'br' || token.localName === 'cr') output += '\n';
    else output += decodeEntities(elementBody(documentXml, token));
  }
  return output;
}

// PARSER-01 (P5): semantic text comes ONLY from explicit WordprocessingML
// tokens, never from pretty-print whitespace between XML elements. Each atom
// kind (TextAtom/TabAtom/LineBreakAtom/PageBreakAtom/ColumnBreakAtom/
// SoftHyphenAtom/NoBreakHyphenAtom/ParagraphBoundaryAtom) is distinct so a
// semantic digest can tell them apart. xml:space="preserve" keeps the run text
// VERBATIM (no trim); the default applies XML whitespace rules, which for a
// single decoded run body means the decoded text is used as-is — there is no
// trim() anywhere on the semantic path.
function isXmlSpacePreserve(token, documentScan) {
  // Self carries xml:space="preserve"?
  const selfPreserve = token.attributes.some((attribute) => (
    attribute.localName === 'space'
    && attribute.namespaceUri === 'http://www.w3.org/XML/1998/namespace'
    && attribute.value === 'preserve'
  ));
  if (selfPreserve) return true;
  // Otherwise inherit from the nearest ancestor declaring xml:space. The parser
  // does not currently record an explicit ancestor index, so walk tokens whose
  // range encloses this one and check their declared xml:space attribute.
  for (const candidate of documentScan ? documentScan.tokens : []) {
    if (candidate === token) continue;
    if (candidate.openStart < token.openStart && candidate.closeEnd >= token.closeEnd) {
      const has = candidate.attributes.some((attribute) => (
        attribute.localName === 'space'
        && attribute.namespaceUri === 'http://www.w3.org/XML/1998/namespace'
      ));
      if (has) {
        return candidate.attributes.some((attribute) => (
          attribute.localName === 'space'
          && attribute.namespaceUri === 'http://www.w3.org/XML/1998/namespace'
          && attribute.value === 'preserve'
        ));
      }
    }
  }
  return false;
}

// Extract the ordered semantic atoms that fall within a container token's body
// (e.g. a w:ins/w:del/hyperlink). The atoms are namespace-exact Word tokens;
// foreign/empty-namespace elements never contribute semantic text.
function extractSemanticAtoms(xml, documentScan, container) {
  const atoms = [];
  const start = container.openEnd;
  const end = container.closeStart;
  const inner = documentScan.tokens.filter((token) => (
    token.openStart >= start && token.closeEnd <= end
  )).sort((left, right) => left.openStart - right.openStart || right.closeEnd - left.closeEnd);
  for (const token of inner) {
    if (token.namespaceUri !== W_NS) continue;
    if (token.localName === 't' || token.localName === 'delText') {
      const preserve = isXmlSpacePreserve(token, documentScan);
      const raw = decodeEntities(elementBody(xml, token));
      const text = preserve ? raw : raw;
      atoms.push({ kind: token.localName === 'delText' ? 'DeletedText' : 'Text', payload: text, order: token.openStart });
    } else if (token.localName === 'tab') {
      atoms.push({ kind: 'Tab', payload: '\t', order: token.openStart });
    } else if (token.localName === 'br') {
      const type = attr(token, 'type');
      if (type === 'page') atoms.push({ kind: 'PageBreak', payload: '\f', order: token.openStart });
      else if (type === 'column') atoms.push({ kind: 'ColumnBreak', payload: '\u000B', order: token.openStart });
      else atoms.push({ kind: 'LineBreak', payload: '\n', order: token.openStart });
    } else if (token.localName === 'cr') {
      atoms.push({ kind: 'CarriageReturn', payload: '\r', order: token.openStart });
    } else if (token.localName === 'softHyphen') {
      atoms.push({ kind: 'SoftHyphen', payload: '\u00AD', order: token.openStart });
    } else if (token.localName === 'noBreakHyphen') {
      atoms.push({ kind: 'NoBreakHyphen', payload: '\u2011', order: token.openStart });
    } else if (token.localName === 'lastRenderedPageBreak') {
      atoms.push({ kind: 'LastRenderedPageBreak', payload: '', order: token.openStart });
    }
  }
  return atoms;
}

// Semantic text reconstruction for a revision body: concat payloads in order.
// NO trim() — whitespace is preserved per the atoms.
function semanticAtomsToText(atoms) {
  let text = '';
  for (const atom of atoms) text += atom.payload;
  return text;
}

// Semantic atom-sequence digest: kind + payload + order. Relocation or a change
// in whitespace atoms changes the digest; prefix rename does not (atoms are
// namespace-expanded, not prefix-bound).
function semanticAtomsDigest(cryptoPort, atoms) {
  return cryptoPort.sha256Json(atoms.map((atom) => ({ kind: atom.kind, payload: atom.payload })));
}

function tokenText(xml, token) {
  // PARSER-01 (P5): semantic text projection, NO trim(). Built from explicit
  // Word atoms only. When no documentScan is available (legacy callers), fall
  // back to stripTagsToText WITHOUT trim so whitespace is preserved.
  const body = elementBody(xml, token);
  return stripTagsToText(body);
}

// tokenText with semantic atoms (preferred entry point inside parseTextRevisions).
function tokenTextSemantic(xml, documentScan, token) {
  const atoms = extractSemanticAtoms(xml, documentScan, token);
  return semanticAtomsToText(atoms);
}

function attr(token, localName, namespaceUri = '') {
  if (!token) return '';
  if (namespaceUri) return rawString(token.attrsByNs?.[`${namespaceUri}|${localName}`]);
  return rawString(token.attrsByLocal?.[localName]);
}

function normalizePartMap(parts = {}) {
  if (parts instanceof Map) return Object.fromEntries(parts.entries());
  if (Array.isArray(parts)) {
    return Object.fromEntries(parts
      .filter((part) => part && typeof part === 'object' && !Array.isArray(part))
      .map((part) => [rawString(part.name), part.value]));
  }
  return isPlainObject(parts) ? parts : {};
}

function hasPathTraversal(partName) {
  const normalized = rawString(partName).split('\\').join('/');
  if (!normalized || normalized.startsWith('/')) return true;
  const pieces = normalized.split('/');
  return pieces.some((piece) => piece === '..' || piece === '');
}

function normalizePackageParts(parts, budgets, cryptoPort) {
  const admittedParts = {};
  const reasons = [];
  let totalBytes = 0;
  for (const [rawName, rawValue] of Object.entries(normalizePartMap(parts))) {
    const partName = rawString(rawName).split('\\').join('/');
    if (hasPathTraversal(partName)) {
      reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', `parts.${partName}`, 'Package part path is unsafe.', {
        partName,
      }));
      continue;
    }
    const text = rawString(rawValue);
    const bytes = cryptoPort.byteLength(text);
    totalBytes += bytes;
    if (bytes > budgets.maxInflatedPartBytes) {
      reasons.push(reason('RTK_BUDGET_EXCEEDED', `parts.${partName}`, 'Inflated part exceeds V6 budget.', {
        partName,
        actual: bytes,
        limit: budgets.maxInflatedPartBytes,
      }));
      continue;
    }
    admittedParts[partName] = text;
  }
  if (totalBytes > budgets.maxTotalInflatedBytes) {
    reasons.push(reason('RTK_BUDGET_EXCEEDED', 'parts', 'Total inflated package bytes exceed V6 budget.', {
      actual: totalBytes,
      limit: budgets.maxTotalInflatedBytes,
    }));
  }
  return { admittedParts, reasons, totalBytes };
}

function isKnownAdvisoryPart(partName) {
  if (CORE_PARTS.includes(partName) || KNOWN_ADVISORY_PARTS.includes(partName)) return true;
  if (partName.startsWith('word/header') && partName.endsWith('.xml')) return true;
  if (partName.startsWith('word/footer') && partName.endsWith('.xml')) return true;
  if (partName === 'word/footnotes.xml' || partName === 'word/endnotes.xml') return true;
  if (partName.startsWith('word/theme/') && partName.endsWith('.xml')) return true;
  if (isEmbeddedFontPartName(partName)) return true;
  return partName.endsWith('.rels') && (partName.startsWith('_rels/') || partName.includes('/_rels/'));
}

function collectOpaqueUnsupportedParts(partNames) {
  const unsupported = [];
  for (const partName of partNames) {
    if (!isKnownAdvisoryPart(partName)) {
      unsupported.push({
        kind: 'unknown-part',
        partName,
        elementName: '',
        relationshipId: '',
        typedDiagnostic: 'RTK_OPAQUE_UNSUPPORTED_PART',
        preservationPolicy: 'preserve-evidence-and-report-loss',
        writerAuthorityImpact: 'blocking',
      });
      continue;
    }
    if (!CORE_PARTS.includes(partName) && !partName.endsWith('.rels') && partName !== '[Content_Types].xml') {
      unsupported.push({
        kind: 'known-unsupported-part',
        partName,
        elementName: '',
        relationshipId: '',
        typedDiagnostic: 'RTK_OPAQUE_UNSUPPORTED_KNOWN_PART',
        preservationPolicy: 'inventory-only-manual-review',
        writerAuthorityImpact: 'inventory-only',
      });
    }
    if (partName === 'word/commentsExtensible.xml') {
      unsupported.push({
        kind: 'modern-comment-extensible-inventory',
        partName,
        elementName: 'commentsExtensible',
        relationshipId: '',
        typedDiagnostic: 'RTK_MODERN_COMMENT_EXTENSIBLE_NOT_CERTIFIED',
        preservationPolicy: 'inventory-only-until-physical-semantic-readback',
        writerAuthorityImpact: 'inventory-only',
      });
    }
  }
  return unsupported;
}

// PARSER-01 (P9): the exact-text product profile does NOT emit click-through
// External hyperlink relationships (the builder emits visible link text as
// plain runs, so no External rel is needed for the product's own packets). On
// the parser side, a bounded http/https hyperlink relationship INSIDE the
// declared profile is admitted as INERT preserved evidence — it is NEVER
// authority and NEVER a locator. Anything OUTSIDE the profile (attached
// template, OLE, activeX, executable, or any non-http(s) scheme) remains
// blocked. This kills the builder↔parser self-conflict where the product's own
// exported packet was rejected as hostile.
const HYPERLINK_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

function isInertHyperlinkRelationship(item) {
  if (item.targetMode.toLowerCase() !== 'external') return false;
  if (item.type !== HYPERLINK_REL_TYPE) return false;
  const lower = item.target.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

function isInertGoogleOfficeCustomXmlRelationship(item) {
  return item.partName === 'word/_rels/document.xml.rels'
    && item.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml'
    && item.target === '../customXML/item1.xml'
    && (item.targetMode === '' || item.targetMode.toLowerCase() === 'internal');
}

function parseRelationshipParts(parts, budgets, cryptoPort) {
  const relationships = [];
  const reasons = [];
  for (const [partName, xml] of Object.entries(parts)) {
    if (!partName.endsWith('.rels')) continue;
    const scan = parseXmlPart(partName, xml, budgets, cryptoPort);
    reasons.push(...scan.diagnostics);
    for (const token of scan.tokens.filter((item) => item.localName === 'Relationship')) {
      const item = {
        partName,
        id: attr(token, 'Id'),
        type: attr(token, 'Type'),
        target: attr(token, 'Target'),
        targetMode: attr(token, 'TargetMode'),
      };
      const isActive = ACTIVE_RELATIONSHIP_MARKERS.some((marker) => item.type.includes(marker) || item.target.includes(marker));
      if (isActive) {
        relationships.push(item);
        reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', `${partName}.${item.id}`, 'Active relationship is blocked.', item));
        continue;
      }
      // Stage02 has already resolved this exact internal target within the
      // package and checked that the part exists. This custom XML is advisory
      // only; it cannot provide a locator, HMAC verification, or write power.
      if (isInertGoogleOfficeCustomXmlRelationship(item)) {
        relationships.push({ ...item, inert: true });
        continue;
      }
      if (item.target.includes('..') || item.target.startsWith('/')) {
        relationships.push(item);
        reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', `${partName}.${item.id}`, 'Relationship target path is unsafe.', item));
        continue;
      }
      if (item.targetMode.toLowerCase() === 'external') {
        if (isInertHyperlinkRelationship(item)) {
          // PARSER-01 (P9): bounded http(s) hyperlink rel is INERT inside the
          // declared profile. It is recorded as preserved evidence but does NOT
          // grant authority, locator, or click target. No blocking reason.
          relationships.push({ ...item, inert: true });
        } else {
          relationships.push(item);
          reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', `${partName}.${item.id}`, 'External relationship outside the declared profile is blocked.', item));
        }
        continue;
      }
      relationships.push(item);
    }
  }
  return { relationships, reasons };
}

function parseContentTypes(partXml, budgets, cryptoPort) {
  const contentTypes = [];
  const reasons = [];
  if (!rawString(partXml)) return { contentTypes, reasons };
  const scan = parseXmlPart('[Content_Types].xml', partXml, budgets, cryptoPort);
  reasons.push(...scan.diagnostics);
  for (const token of scan.tokens.filter((item) => item.localName === 'Override' || item.localName === 'Default')) {
    const item = {
      elementName: token.localName,
      partName: attr(token, 'PartName'),
      extension: attr(token, 'Extension'),
      contentType: attr(token, 'ContentType'),
    };
    contentTypes.push(item);
    if (ACTIVE_CONTENT_TYPE_MARKERS.some((marker) => item.contentType.includes(marker))) {
      reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', '[Content_Types].xml', 'Active content type is blocked.', item));
    }
  }
  return { contentTypes, reasons };
}

function evaluateZipInventory(inventory = {}, parts = {}, cryptoPort, maxZipEntries) {
  const reasons = [];
  const entries = Array.isArray(inventory.entries) ? inventory.entries.filter(isPlainObject) : [];
  const effectiveMaxZipEntries = Number.isSafeInteger(maxZipEntries) && maxZipEntries > 0
    ? maxZipEntries
    : RTK_V6_BUDGETS.maxZipEntries;
  if (entries.length > effectiveMaxZipEntries) {
    reasons.push(reason('RTK_BUDGET_EXCEEDED', 'zip.entries', 'ZIP entry count exceeds effective budget.', {
      actual: entries.length,
      limit: effectiveMaxZipEntries,
    }));
  }
  if (Number(inventory.fakeEocdCount || 0) > 0 || Number(inventory.eocdCount || 1) > 1) {
    reasons.push(reason('RTK_ZIP_FAKE_EOCD', 'zip.eocd', 'Fake or duplicate EOCD marker is blocked.'));
  }
  const ranges = [];
  for (const entry of entries) {
    const partName = rawString(entry.name);
    // Shared CRC evidence evaluation: central-vs-local divergence, missing
    // evidence, and actual recompute via the bounded crc32 implementation
    // (NOT the sha-only cryptoPort). Actual recompute is REQUIRED (Z1) and
    // missing evidence is a rejection (Z3), never a silent skip.
    reasons.push(...evaluateZipCrcEvidence(entry, parts, crc32));
    const start = Number(entry.dataStart ?? entry.start);
    const end = Number(entry.dataEnd ?? entry.end);
    for (const previous of ranges) {
      if (
        Number.isFinite(start)
        && Number.isFinite(end)
        && Number.isFinite(previous.start)
        && Number.isFinite(previous.end)
        && Math.max(start, previous.start) < Math.min(end, previous.end)
      ) {
        reasons.push(reason('RTK_ZIP_REGION_OVERLAP', `zip.${partName}.range`, 'ZIP entry byte ranges overlap.', {
          partName,
          overlaps: previous.name,
        }));
      }
    }
    ranges.push({ name: partName, start, end });
  }
  return reasons;
}

function provenance(token) {
  return {
    partName: token.partName,
    elementName: token.localName,
    namespaceUri: token.namespaceUri,
    openStart: token.openStart,
    closeEnd: token.closeEnd,
    attributes: cloneJsonSafe(token.attributes),
  };
}

// CANON-01 P0-18: placement-aware semantic digest helpers. The semantic projection entries for
// textRevisions/commentThreads/formattingDeltas carry placement (story + paragraph index/ordinal,
// and for comments an anchor quote digest) so relocating a revision or comment between paragraphs
// changes supportedSemanticDigest (C6/C6b). Placement is derived from existing parser raw
// material and is namespace-invariant by construction: it uses only the paragraph count (which
// is prefix/attribute-order independent) and decoded text, never raw XML byte offsets. This
// preserves the b02 determinism pin (C7) and the W2 namespace-invariance control (C6c/C3-test).
function paragraphIndexForOffset(documentScan, offset) {
  if (typeof offset !== 'number') return null;
  let index = 0;
  const tokens = documentScan.logicalTableParagraphs?.map(record => record.token) || documentScan.tokens;
  for (const token of tokens) {
    if (!isWordToken(token, 'p') || (!documentScan.logicalTableParagraphs && (token.path.length !== 3 || token.path[1] !== 'body'))) continue;
    if (offset >= token.openStart && offset <= token.closeEnd) return index;
    index += 1;
  }
  // Fall back to the count of top-level body paragraphs before the offset so a revision that
  // starts before/after a paragraph boundary still maps to a stable positional index.
  let position = 0;
  for (const token of tokens) {
    if (!isWordToken(token, 'p') || (!documentScan.logicalTableParagraphs && (token.path.length !== 3 || token.path[1] !== 'body'))) continue;
    if (token.openStart > offset) break;
    position += 1;
  }
  return position;
}

function placementForRevision(documentScan, revision) {
  const openStart = revision?.sourceXmlProvenance?.openStart;
  const paragraphIndex = paragraphIndexForOffset(documentScan, typeof openStart === 'number' ? openStart : 0);
  return {
    story: 'document.xml',
    paragraphIndex,
    ordinal: paragraphIndex,
  };
}

function placementForCommentAnchor(documentScan, anchor, cryptoPort) {
  const anchorStart = anchor?.anchorStart;
  const quoted = rawString(anchor?.quotedAnchorText);
  const paragraphIndex = paragraphIndexForOffset(documentScan, typeof anchorStart === 'number' ? anchorStart : 0);
  return {
    story: 'document.xml',
    paragraphIndex,
    ordinal: paragraphIndex,
    // anchor quote digest is over the DECODED anchor text (namespace-invariant), not raw bytes.
    anchorQuoteDigest: quoted ? cryptoPort.sha256Text(quoted) : null,
  };
}

function placementForFormattingDelta(documentScan, delta) {
  const openStart = delta?.sourceXmlProvenance?.openStart;
  const paragraphIndex = paragraphIndexForOffset(documentScan, typeof openStart === 'number' ? openStart : 0);
  return {
    story: 'document.xml',
    paragraphIndex,
    ordinal: paragraphIndex,
  };
}

const REVISION_GROUP_TEXT_BOUNDARY_TOKENS = Object.freeze([
  't',
  'delText',
]);
const REVISION_GROUP_VISIBLE_NON_TEXT_BOUNDARY_TOKENS = Object.freeze([
  'tab',
  'br',
  'cr',
  'softHyphen',
  'noBreakHyphen',
  'sym',
  'ptab',
  'separator',
  'continuationSeparator',
  'footnoteRef',
  'endnoteRef',
  'annotationRef',
  'commentReference',
]);
const REVISION_GROUP_STRUCTURAL_BOUNDARY_TOKENS = Object.freeze([
  'p',
  'tbl',
  'tr',
  'tc',
  'drawing',
  'pict',
  'object',
  'altChunk',
  'footnoteReference',
  'endnoteReference',
  'fldSimple',
  'instrText',
]);

function isRevisionReplacementGroupBoundaryToken(documentXml, token) {
  if (token.namespaceUri !== W_NS) return false;
  if (REVISION_GROUP_TEXT_BOUNDARY_TOKENS.includes(token.localName)) {
    return decodeEntities(elementBody(documentXml, token)).length > 0;
  }
  if (REVISION_GROUP_VISIBLE_NON_TEXT_BOUNDARY_TOKENS.includes(token.localName)) return true;
  return REVISION_GROUP_STRUCTURAL_BOUNDARY_TOKENS.includes(token.localName);
}

function createRevisionReplacementGroupBoundaryIndex(documentXml, documentScan) {
  const boundaries = (Array.isArray(documentScan?.tokens) ? documentScan.tokens : [])
    .filter((token) => isRevisionReplacementGroupBoundaryToken(documentXml, token))
    .map((token) => ({
      openStart: token.openStart,
      closeEnd: token.closeEnd,
      localName: token.localName,
    }))
    .sort((left, right) => left.openStart - right.openStart || left.closeEnd - right.closeEnd);
  return {
    boundaries,
    hasBoundaryBetween(left, right) {
      const gapStart = left?.sourceXmlProvenance?.closeEnd;
      const gapEnd = right?.sourceXmlProvenance?.openStart;
      if (!Number.isFinite(gapStart) || !Number.isFinite(gapEnd) || gapEnd <= gapStart) return false;
      let low = 0;
      let high = boundaries.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (boundaries[middle].openStart < gapStart) low = middle + 1;
        else high = middle;
      }
      for (let index = low; index < boundaries.length; index += 1) {
        const boundary = boundaries[index];
        if (boundary.openStart >= gapEnd) return false;
        if (boundary.closeEnd <= gapEnd) return true;
      }
      return false;
    },
  };
}

// PARSER-01 (P4): only the EXACT WordprocessingML namespace (Transitional profile
// URI) is Word revision evidence. An empty namespace ('') or a foreign namespace
// is NOT Word — a no-namespace <ins> can never become a Word TextRevision.
function isWordToken(token, localName) {
  return token.localName === localName && token.namespaceUri === W_NS;
}

function tokenDigest(cryptoPort, payload) {
  return cryptoPort.sha256Json(payload);
}

function normalizeHmac(value) {
  const text = rawString(value).trim().toLowerCase();
  if (HMAC_RE.test(text)) return text;
  if (/^[a-f0-9]{64}$/u.test(text)) return `hmac-sha256:${text}`;
  return '';
}

function base64UrlDecodeText(value) {
  const text = rawString(value);
  if (!text.startsWith('YRTK1.')) {
    return { ok: false, code: 'RTK_AUTHORITY_CARRIER_BAD_PREFIX', value: '' };
  }
  if (typeof globalThis.atob !== 'function' || typeof globalThis.TextDecoder !== 'function') {
    return { ok: false, code: 'RTK_AUTHORITY_CARRIER_DECODE_UNAVAILABLE', value: '' };
  }
  try {
    const encoded = text.slice('YRTK1.'.length).split('-').join('+').split('_').join('/');
    const padded = `${encoded}${'='.repeat((4 - (encoded.length % 4)) % 4)}`;
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { ok: true, code: 'RTK_AUTHORITY_CARRIER_DECODED', value: new globalThis.TextDecoder().decode(bytes) };
  } catch {
    return { ok: false, code: 'RTK_AUTHORITY_CARRIER_DECODE_FAILED', value: '' };
  }
}

function customPropertyAuthorityCandidates(parts, budgets, cryptoPort, budgetState) {
  const decodeXstring = (value) => value.replace(/_x([0-9a-fA-F]{4})_/gu, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const xml = rawString(parts['docProps/custom.xml']);
  if (!xml) return { candidates: [], reasons: [] };
  const scan = parseXmlPart('docProps/custom.xml', xml, budgets, cryptoPort, budgetState);
  const candidates = [];
  for (const token of scan.tokens.filter((item) => item.localName === 'property')) {
    const propertyName = decodeXstring(attr(token, 'name'));
    if (!RTK_REVIEW_TRANSPORT_AUTHORITY_CUSTOM_PROPERTY_NAMES.includes(propertyName)) continue;
    const candidate = {
      carrier: 'customDocumentProperty',
      propertyName,
      encoded: decodeXstring(tokenText(xml, token)),
      sourceXmlProvenance: provenance(token),
    };
    if (
      admitBudgetCount(
        budgetState,
        scan.diagnostics,
        'candidates',
        budgets.maxCandidates,
        'authorityCarrier.candidates',
        'Authority candidate budget exceeded.',
      )
      && admitWorkerOutput(budgetState, scan.diagnostics, 'authorityCarrier.candidates', candidate)
    ) {
      candidates.push(candidate);
    }
  }
  return { candidates, reasons: scan.diagnostics };
}

function parseDocumentMetadata(parts, budgets, cryptoPort, budgetState) {
  const decodeXstring = (value) => rawString(value)
    .replace(/_x([0-9a-fA-F]{4})_/gu, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  const coreXml = rawString(parts['docProps/core.xml']);
  const customXml = rawString(parts['docProps/custom.xml']);
  const coreScan = parseXmlPart('docProps/core.xml', coreXml, budgets, cryptoPort, budgetState);
  const customScan = parseXmlPart('docProps/custom.xml', customXml, budgets, cryptoPort, budgetState);
  const reasons = [...coreScan.diagnostics, ...customScan.diagnostics];
  const coreRootValid = coreScan.tokens.some((token) => (
    token.localName === 'coreProperties' && token.namespaceUri === CORE_PROPS_NS
  ));
  const customRootValid = customScan.tokens.some((token) => (
    token.localName === 'Properties' && token.namespaceUri === CUSTOM_PROPS_NS
  ));
  const coreDefinitions = [
    ['title', DC_NS, 'title'],
    ['creator', DC_NS, 'creator'],
    ['lastModifiedBy', CORE_PROPS_NS, 'lastModifiedBy'],
    ['createdAtUtc', DCTERMS_NS, 'created'],
    ['modifiedAtUtc', DCTERMS_NS, 'modified'],
    ['revision', CORE_PROPS_NS, 'revision'],
    ['identifier', DC_NS, 'identifier'],
  ];
  const coreProperties = {};
  const duplicateCorePropertyNames = [];
  const coreTokensByName = new Map();
  for (const [name, namespaceUri, localName] of coreDefinitions) {
    const tokens = coreScan.tokens.filter((token) => (
      token.namespaceUri === namespaceUri && token.localName === localName
    )).sort((left, right) => left.openStart - right.openStart);
    coreTokensByName.set(name, tokens);
    coreProperties[name] = tokens.length === 1 ? tokenText(coreXml, tokens[0]) : '';
    if (tokens.length > 1) duplicateCorePropertyNames.push(name);
  }
  const customRows = [];
  for (const token of customScan.tokens.filter((item) => (
    item.localName === 'property' && item.namespaceUri === CUSTOM_PROPS_NS
  ))) {
    const name = decodeXstring(attr(token, 'name'));
    const values = customScan.tokens.filter((item) => (
      item.openStart > token.openStart
      && item.closeEnd <= token.closeStart
      && item.namespaceUri === CUSTOM_PROPS_VT_NS
      && item.localName === 'lpwstr'
    ));
    customRows.push({
      name,
      value: values.length === 1 ? decodeXstring(tokenText(customXml, values[0])) : '',
      valueType: values.length === 1 ? 'lpwstr' : '',
      sourceXmlProvenance: provenance(token),
    });
  }
  const customCounts = new Map();
  for (const row of customRows) customCounts.set(row.name, (customCounts.get(row.name) || 0) + 1);
  const duplicateCustomPropertyNames = [...customCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
  const publicCustomProperties = {};
  for (const name of WORD_DOCUMENT_METADATA_PUBLIC_PROPERTIES) {
    const rows = customRows.filter((row) => row.name === name);
    publicCustomProperties[name] = rows.length === 1 ? rows[0].value : '';
  }
  const transportBindingProperties = {
    yrtk2Token: customCounts.get('YRTK2_TOKEN') === 1
      ? customRows.find((row) => row.name === 'YRTK2_TOKEN')?.value || ''
      : '',
    coreManifestDigest: customCounts.get('YRTK_CORE_DIGEST') === 1
      ? customRows.find((row) => row.name === 'YRTK_CORE_DIGEST')?.value || ''
      : '',
  };
  const authorityPropertyNamesPresent = WORD_DOCUMENT_METADATA_AUTHORITY_PROPERTIES
    .filter((name) => customRows.some((row) => row.name === name));
  const knownNames = new Set([
    ...WORD_DOCUMENT_METADATA_PUBLIC_PROPERTIES,
    ...WORD_DOCUMENT_METADATA_AUTHORITY_PROPERTIES,
  ]);
  const unknownCustomPropertyNames = [...new Set(customRows.map((row) => row.name)
    .filter((name) => name && !knownNames.has(name)))].sort();
  const coreProtectedProperties = {
    projectId: coreProperties.identifier,
    title: coreProperties.title,
    createdAtUtc: coreProperties.createdAtUtc,
    creator: coreProperties.creator,
  };
  const protectedProperties = {
    schemaVersion: publicCustomProperties.YALKEN_METADATA_SCHEMA,
    projectId: publicCustomProperties.YALKEN_PROJECT_ID,
    title: publicCustomProperties.YALKEN_PROJECT_TITLE,
    createdAtUtc: publicCustomProperties.YALKEN_PROJECT_CREATED_AT_UTC,
    creator: publicCustomProperties.YALKEN_APPLICATION_CREATOR,
  };
  const protectedDigest = cryptoPort.sha256Json(protectedProperties);
  const createdToken = coreTokensByName.get('createdAtUtc')?.[0];
  const modifiedToken = coreTokensByName.get('modifiedAtUtc')?.[0];
  const missingProtectedProperties = Object.entries(protectedProperties)
    .filter(([, value]) => !rawString(value))
    .map(([name]) => name)
    .sort();
  const missingCoreProtectedProperties = Object.entries(coreProtectedProperties)
    .filter(([, value]) => !rawString(value))
    .map(([name]) => name)
    .sort();
  const expectedCreatedAtMilliseconds = Date.parse(rawString(protectedProperties.createdAtUtc));
  const coreCreatedAtMilliseconds = Date.parse(rawString(coreProtectedProperties.createdAtUtc));
  const providerNormalizedFields = Number.isFinite(expectedCreatedAtMilliseconds)
    && Number.isFinite(coreCreatedAtMilliseconds)
    && rawString(protectedProperties.createdAtUtc) !== rawString(coreProtectedProperties.createdAtUtc)
    && Math.floor(expectedCreatedAtMilliseconds / 60_000) === Math.floor(coreCreatedAtMilliseconds / 60_000)
    ? ['createdAtUtc.minutePrecision']
    : [];
  return {
    metadata: {
      schemaVersion: WORD_DOCUMENT_METADATA_SCHEMA,
      authority: 'ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE',
      corePropertiesPresent: Boolean(coreXml),
      corePropertiesRootValid: coreRootValid,
      customPropertiesPresent: Boolean(customXml),
      customPropertiesRootValid: customRootValid,
      protectedProperties,
      coreProtectedProperties,
      protectedDigest,
      publicCustomProperties,
      transportBindingProperties,
      authorityPropertyNamesPresent,
      createdTimestampType: attr(createdToken, 'type', XSI_NS),
      modifiedTimestampType: attr(modifiedToken, 'type', XSI_NS),
      volatileCoreProperties: {
        lastModifiedBy: coreProperties.lastModifiedBy,
        modifiedAtUtc: coreProperties.modifiedAtUtc,
        revision: coreProperties.revision,
      },
      duplicateCorePropertyNames,
      duplicateCustomPropertyNames,
      lossLedger: {
        missingProtectedProperties,
        missingCoreProtectedProperties,
        duplicateCorePropertyNames,
        duplicateCustomPropertyNames,
        unknownCustomPropertyNames,
        providerVolatileFields: ['lastModifiedBy', 'modifiedAtUtc', 'revision'],
        providerNormalizedFields,
        customPropertyValueTypesAccounted: customRows.map((row) => ({
          name: row.name,
          valueType: row.valueType,
        })),
      },
    },
    reasons,
  };
}

function isFullManuscriptAuthorityPayload(payload, expected = {}) {
  return rawString(payload?.scope) === 'full-manuscript'
    || rawString(expected?.scope) === 'full-manuscript';
}

function validateAuthorityPayload(payload, expected = {}) {
  const reasons = [];
  const fullManuscript = isFullManuscriptAuthorityPayload(payload, expected);
  const requiredKeys = fullManuscript
    ? ['caseId', 'scope', 'projectId', 'roundId', 'exportId', 'fullBookRawSha256', 'capabilityManifestDigest']
    : ['caseId', 'sceneId', 'sceneRevision', 'blockId', 'roundId', 'exportId'];
  for (const key of requiredKeys) {
    if (!rawString(payload?.[key])) {
      reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', `authorityCarrier.payload.${key}`, 'Authority carrier payload field is required.'));
    }
  }
  if (rawString(expected?.profileId) && !rawString(payload?.profileId)) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.payload.profileId', 'Authority carrier payload profileId is required when local authority is profile-bound.'));
  }
  if (fullManuscript) {
    if (rawString(payload?.scope) !== 'full-manuscript') {
      reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.payload.scope', 'Full-manuscript authority carrier scope is required.'));
    }
    if (!SIGNED_SHA256_RE.test(rawString(payload?.fullBookRawSha256))) {
      reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.payload.fullBookRawSha256', 'Full-manuscript raw hash must be a full lowercase sha256 digest.'));
    }
  } else if (!SIGNED_SHA256_RE.test(rawString(payload?.rawSha256))) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.payload.rawSha256', 'Authority carrier raw hash must be a full lowercase sha256 digest.'));
  }
  return reasons;
}

function expectedAuthorityBindingKeys(fullManuscript, expected = {}) {
  const keys = fullManuscript
    ? ['scope', 'fullBookRawSha256', 'roundId', 'exportId', 'capabilityManifestDigest']
    : ['sceneId', 'sceneRevision', 'rawSha256', 'blockId', 'roundId', 'exportId'];
  return rawString(expected?.profileId) ? ['profileId', ...keys] : keys;
}

function authorityBindingMismatchReasonCode(key) {
  if (key === 'profileId') return 'RTK_BLOCKED_PROFILE_MISMATCH';
  if (key === 'sceneRevision') return 'RTK_BLOCKED_STALE_REVISION';
  if (key === 'rawSha256') return 'RTK_BLOCKED_STALE_BYTES';
  return 'RTK_MANUAL_DEGRADED_LOCATOR';
}

function verifyAuthorityCandidate(candidate, input, cryptoPort, hmacSecret) {
  const reasons = [];
  const decoded = base64UrlDecodeText(candidate.encoded);
  if (!decoded.ok) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.encoded', 'Authority carrier could not be decoded.', {
      decodeCode: decoded.code,
    }));
    return {
      ...candidate,
      schemaVersion: RTK_REVIEW_TRANSPORT_AUTHORITY_CARRIER_V2_SCHEMA,
      visibleToAuthor: false,
      exactAuthorityCandidate: true,
      verified: false,
      validSignedLocator: false,
      encodedDigest: cryptoPort.sha256Text(candidate.encoded),
      payloadDigest: '',
      signatureDigest: '',
      payload: null,
      baselineBinding: {},
      reasons,
    };
  }
  let envelope = null;
  try {
    envelope = JSON.parse(decoded.value);
  } catch {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.envelope', 'Authority carrier JSON is malformed.'));
  }
  const payload = isPlainObject(envelope?.payload) ? envelope.payload : {};
  const expected = isPlainObject(input.expectedAuthority) ? input.expectedAuthority : {};
  const fullManuscript = isFullManuscriptAuthorityPayload(payload, expected);
  reasons.push(...validateAuthorityPayload(payload, expected));
  const expectedPayloadDigest = cryptoPort.sha256Json(payload);
  if (rawString(envelope?.payloadDigest) !== expectedPayloadDigest) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.payloadDigest', 'Authority carrier payload digest mismatch.'));
  }
  if (!HMAC_RE.test(rawString(envelope?.signature))) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.signature', 'Authority carrier signature must be a full hmac-sha256 digest.'));
  }
  if (envelope?.secretEmbeddedInDocx !== false) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.secretEmbeddedInDocx', 'Authority carrier secret must not be embedded.'));
  }
  if (!cryptoPort.hmacSha256Json || !rawString(hmacSecret)) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.hmacSecret', 'Local HMAC secret is required for authority carrier verification.'));
  } else {
    const expectedHmac = normalizeHmac(cryptoPort.hmacSha256Json(payload, hmacSecret));
    if (rawString(envelope?.signature) !== expectedHmac) {
      reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.signature', 'Authority carrier HMAC mismatch.'));
    }
  }
  const expectedKeys = expectedAuthorityBindingKeys(fullManuscript, expected);
  const baselineBinding = Object.fromEntries(expectedKeys.map((key) => {
    const expectedValue = rawString(expected[key]);
    return [`${key}Matches`, Boolean(expectedValue) && rawString(payload[key]) === expectedValue];
  }));
  for (const key of expectedKeys) {
    const expectedValue = rawString(expected[key]);
    if (expectedValue && rawString(payload[key]) !== expectedValue) {
      const code = authorityBindingMismatchReasonCode(key);
      reasons.push(reason(code, `authorityCarrier.expectedAuthority.${key}`, 'Authority carrier does not match the expected local baseline.', {
        expected: expectedValue,
        actual: rawString(payload[key]),
      }));
    }
  }
  const allExpectedPresent = expectedKeys.every((key) => rawString(expected[key]));
  const allExpectedMatched = allExpectedPresent && Object.values(baselineBinding).every(Boolean);
  const verified = reasons.length === 0;
  return {
    ...candidate,
    schemaVersion: RTK_REVIEW_TRANSPORT_AUTHORITY_CARRIER_V2_SCHEMA,
    visibleToAuthor: false,
    exactAuthorityCandidate: true,
    verified,
    validSignedLocator: verified && allExpectedMatched,
    encodedDigest: cryptoPort.sha256Text(candidate.encoded),
    payloadDigest: expectedPayloadDigest,
    signatureDigest: normalizeHmac(envelope?.signature),
    payload: cloneJsonSafe(payload),
    baselineBinding: {
      ...baselineBinding,
      allExpectedPresent,
      allExpectedMatched,
    },
    reasons,
  };
}

function analyzeAuthorityCarriers(input, parts, budgets, cryptoPort, budgetState) {
  const found = customPropertyAuthorityCandidates(parts, budgets, cryptoPort, budgetState);
  const reasons = [...found.reasons];
  const carriers = found.candidates.map((candidate) => verifyAuthorityCandidate(
    candidate,
    input,
    cryptoPort,
    input.hmacSecret,
  ));
  if (carriers.length > 1) {
    reasons.push(reason('RTK_BLOCKED_AMBIGUOUS_TEXT', 'authorityCarrier', 'Multiple authority carriers are ambiguous and cannot grant exact authority.'));
  }
  for (const carrier of carriers) reasons.push(...carrier.reasons);
  const selected = carriers.length === 1 ? carriers[0] : null;
  const exactAuthority = {
    validSignedLocator: selected?.validSignedLocator === true,
    sceneRevisionUnchanged: selected?.baselineBinding?.sceneRevisionMatches === true
      || selected?.baselineBinding?.fullBookRawSha256Matches === true,
    rawSha256Unchanged: selected?.baselineBinding?.rawSha256Matches === true
      || selected?.baselineBinding?.fullBookRawSha256Matches === true,
    uniqueTarget: false,
    nonOverlapping: false,
    allRelevantXmlSemanticsAccounted: false,
    ambiguousDuplicate: carriers.length > 1,
    crossScene: false,
    structuralTopologyChanged: false,
  };
  return {
    schemaVersion: RTK_REVIEW_TRANSPORT_AUTHORITY_CARRIER_V2_SCHEMA,
    status: selected?.validSignedLocator === true ? 'verified-baseline-bound' : (carriers.length > 0 ? 'present-not-authoritative' : 'missing'),
    selectedCarrier: selected,
    carriers,
    exactAuthority,
    reasons,
  };
}

function parseTextRevisions(documentXml, documentScan, cryptoPort, budgets, budgetState, reasons) {
  const revisions = [];
  const paragraphMarkReasonCodes = [];
  for (const token of documentScan.tokens) {
    if (!isWordToken(token, 'ins') && !isWordToken(token, 'del')) continue;
    // PARSER-01 (P6): an ins/del under an ancestor path of p/pPr/rPr is a
    // PARAGRAPH-MARK revision, not run text. It is structural evidence
    // (RTK_STRUCTURAL_PARAGRAPH_MARK_INSERTED/DELETED) and MUST NEVER become an
    // empty TextRevision.
    const pathString = token.path.join('/');
    const isParagraphMark = token.path.length >= 3
      && token.path[token.path.length - 1] === (token.localName)
      && token.path[token.path.length - 2] === 'rPr'
      && token.path[token.path.length - 3] === 'pPr';
    if (isParagraphMark) {
      const inserted = token.localName === 'ins';
      paragraphMarkReasonCodes.push(inserted ? 'RTK_STRUCTURAL_PARAGRAPH_MARK_INSERTED' : 'RTK_STRUCTURAL_PARAGRAPH_MARK_DELETED');
      reasons.push(reason(
        inserted ? 'RTK_STRUCTURAL_PARAGRAPH_MARK_INSERTED' : 'RTK_STRUCTURAL_PARAGRAPH_MARK_DELETED',
        `document.paragraphMarks.${attr(token, 'id') || token.openStart}`,
        'Paragraph-mark revision is structural and never an empty TextRevision.',
        { structureKind: inserted ? 'paragraphMarkInserted' : 'paragraphMarkDeleted', sourceXmlProvenance: provenance(token) },
      ));
      continue;
    }
    const operation = token.localName === 'ins' ? 'insert' : 'delete';
    // EVID-01 (spec §32.5/§12.2): a tracked ins/del that CONTAINS a block-level
    // w:p element is a tracked paragraph insertion/deletion — a structural,
    // paragraph-boundary change, never a run-text revision. It is classified by
    // parseStructureChanges as trackedParagraphInsert/trackedParagraphDelete and
    // must not also appear as a TextRevision (no double-counted text evidence).
    const containsParagraphElement = documentScan.tokens.some((inner) => inner !== token
      && isWordToken(inner, 'p')
      && inner.openStart > token.openStart
      && inner.closeEnd <= token.closeEnd);
    if (containsParagraphElement) continue;
    // Office-mode DOCX may place self-closing tracked markers around the
    // substantive revision inside w:sdt wrappers. They have no body or
    // semantic atoms, so emitting them as TextRevisions creates phantom
    // changes and can consume the neighboring replacement group. Keep their
    // provenance as an explicit diagnostic, never as an apply candidate.
    if (token.selfClosing) {
      reasons.push(reason(
        'RTK_EMPTY_TRACKED_REVISION_NOOP',
        `reviewIr.textRevisions.${attr(token, 'id', W_NS) || token.openStart}`,
        'Self-closing tracked marker has no text effect.',
        { operation: token.localName === 'ins' ? 'insert' : 'delete', sourceXmlProvenance: provenance(token) },
      ));
      continue;
    }
    const atoms = extractSemanticAtoms(documentXml, documentScan, token);
    const text = semanticAtomsToText(atoms);
    const revision = {
      kind: 'TextRevision',
      operation,
      nativeRevisionId: attr(token, 'id', W_NS),
      author: attr(token, 'author', W_NS),
      date: attr(token, 'date', W_NS),
      dateUtc: attr(token, 'dateUtc', W16DU_NS),
      text,
      textDigest: semanticAtomsDigest(cryptoPort, atoms),
      // PARSER-01 (P7): a revision that is NOT part of a replacement group
      // carries the boolean false sentinel (NOT a string) so that:
      //   - the classifier (rawString(false) === '') treats it as a SOLO
      //     single-operation item, preserving exact-applicable disposition;
      //   - the P7 cross-paragraph control (`a && b && c`) short-circuits to
      //     boolean false when a cross-paragraph pair is (correctly) NOT grouped,
      //     instead of returning '' which would fail the strict-equal(false)
      //     assertion.
      // A genuine replacement pair keeps a 64-hex string groupId (set below).
      replacementGroupId: false,
      sourceXmlProvenance: provenance(token),
      classification: 'TEXT_MANUAL',
      candidateDisposition: 'MANUAL',
      reasonCode: 'RTK_MANUAL_DEGRADED_LOCATOR',
      paragraphIndex: paragraphIndexForOffset(documentScan, token.openStart),
    };
    if (admitWorkerOutput(budgetState, reasons, 'reviewIr.textRevisions', revision)) {
      revisions.push(revision);
    }
  }
  const ordered = revisions.slice().sort((left, right) => (
    left.sourceXmlProvenance.openStart - right.sourceXmlProvenance.openStart
  ));
  // PARSER-01 (P7): a replacement group is formed ONLY when the deleting and
  // inserting footprints are in the SAME story + SAME paragraph (block), with
  // no intermediate visible/structural atom between them, compatible metadata
  // (same author OR missing metadata — conservative), and exactly one deleting
  // + one inserting footprint. The raw XML byte distance is NOT authority.
  const replacementBoundaryIndex = createRevisionReplacementGroupBoundaryIndex(documentXml, documentScan);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index];
    const right = ordered[index + 1];
    if (left.paragraphIndex === null || right.paragraphIndex === null) continue;
    if (left.paragraphIndex !== right.paragraphIndex) continue;
    const deleteFirst = left.operation === 'delete' && right.operation === 'insert';
    const insertFirst = left.operation === 'insert' && right.operation === 'delete';
    if (!deleteFirst && !insertFirst) continue;
    if (replacementBoundaryIndex.hasBoundaryBetween(left, right)) continue;
    // Conservative metadata policy: same author OR both missing author.
    const sameAuthor = left.author && right.author && left.author === right.author;
    const bothMissingAuthor = !left.author && !right.author;
    if (!sameAuthor && !bothMissingAuthor) continue;
    const deleteRevision = left.operation === 'delete' ? left : right;
    const insertRevision = left.operation === 'insert' ? left : right;
    const groupId = cryptoPort.sha256Text(stableJson({
      story: 'document.xml',
      paragraphIndex: left.paragraphIndex,
      deleteRevision: deleteRevision.nativeRevisionId,
      insertRevision: insertRevision.nativeRevisionId,
      deleted: deleteRevision.textDigest,
      inserted: insertRevision.textDigest,
    }));
    left.replacementGroupId = groupId;
    right.replacementGroupId = groupId;
  }
  return ordered;
}

function parseMoveRevisions(documentXml, documentScan, cryptoPort, budgetState, reasons) {
  const moves = [];
  const byId = new Map();
  for (const token of documentScan.tokens) {
    if (!isWordToken(token, 'moveFrom') && !isWordToken(token, 'moveTo')) continue;
    const nativeRevisionId = attr(token, 'id') || cryptoPort.sha256Text(stableJson(provenance(token)));
    const entry = byId.get(nativeRevisionId) || {
      kind: 'MoveRevision',
      nativeRevisionId,
      moveFrom: null,
      moveTo: null,
      pairedRanges: [],
      classification: 'STRUCTURAL_BLOCKED',
      reasonCode: 'RTK_BLOCKED_MOVE_REVISION',
    };
    const side = token.localName === 'moveFrom' ? 'moveFrom' : 'moveTo';
    entry[side] = {
      text: tokenText(documentXml, token),
      textDigest: tokenDigest(cryptoPort, { side, text: tokenText(documentXml, token) }),
      sourceXmlProvenance: provenance(token),
    };
    byId.set(nativeRevisionId, entry);
  }
  for (const item of byId.values()) {
    item.pairedRanges = [item.moveFrom, item.moveTo].filter(Boolean).map((side) => side.sourceXmlProvenance);
    if (admitWorkerOutput(budgetState, reasons, 'reviewIr.moveRevisions', item)) {
      moves.push(item);
    }
  }
  return moves;
}

function childTokensWithin(documentScan, parent) {
  return documentScan.tokens.filter((token) => (
    token.openStart >= parent.openEnd && token.closeEnd <= parent.closeStart
  ));
}

function parsePropertyRevisions(documentXml, documentScan, budgetState, reasons) {
  const revisions = [];
  for (const token of documentScan.tokens) {
    if (!['rPrChange', 'pPrChange', 'numPrChange'].includes(token.localName)) continue;
    const revision = {
      kind: 'PropertyRevision',
      propertyKind: token.localName,
      nativeRevisionId: attr(token, 'id', W_NS),
      author: attr(token, 'author', W_NS),
      date: attr(token, 'date', W_NS),
      dateUtc: attr(token, 'dateUtc', W16DU_NS),
      sourceXmlProvenance: provenance(token),
      rawTextExcerpt: tokenText(documentXml, token).slice(0, 96),
      classification: 'MANUAL_REVIEW',
      reasonCode: 'RTK_BLOCKED_STRUCTURAL',
    };
    if (admitWorkerOutput(budgetState, reasons, 'reviewIr.propertyRevisions', revision)) {
      revisions.push(revision);
    }
  }
  return revisions;
}

function parseStructureChanges(documentScan, budgetState, reasons) {
  const changes = [];
  for (const token of documentScan.tokens) {
    const declaredSectionProperties = token.localName === 'sectPr'
      && (
        (token.path.length === 3
          && token.path[0] === 'document'
          && token.path[1] === 'body')
        || (token.path.length === 5
          && token.path[0] === 'document'
          && token.path[1] === 'body'
          && token.path[2] === 'p'
          && token.path[3] === 'pPr')
      );
    if (declaredSectionProperties) continue;
    if (['pPrChange', 'tbl', 'sectPr', 'tblPrChange', 'tblGridChange',
      'trPrChange', 'tcPrChange', 'cellIns', 'cellDel', 'cellMerge'].includes(token.localName)) {
      const change = {
        kind: 'StructureChange',
        structureKind: token.localName,
        sourceXmlProvenance: provenance(token),
        classification: 'STRUCTURAL_BLOCKED',
        reasonCode: 'RTK_BLOCKED_STRUCTURAL',
        writerAuthorityImpact: 'blocking',
      };
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.structureChanges', change)) {
        changes.push(change);
      }
    }
    if (token.localName === 'moveFrom' || token.localName === 'moveTo') {
      const change = {
        kind: 'StructureChange',
        structureKind: 'moveRevision',
        sourceXmlProvenance: provenance(token),
        classification: 'STRUCTURAL_BLOCKED',
        reasonCode: 'RTK_BLOCKED_MOVE_REVISION',
        writerAuthorityImpact: 'blocking',
      };
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.structureChanges', change)) {
        changes.push(change);
      }
    }
    // PARSER-01 (P6): paragraph-mark ins/del under p/pPr/rPr is structural.
    const isWordInsOrDel = isWordToken(token, 'ins') || isWordToken(token, 'del');
    if (isWordInsOrDel && token.path[token.path.length - 2] === 'trPr') {
      const change = {
        kind: 'StructureChange',
        structureKind: token.localName === 'ins' ? 'tableRowInserted' : 'tableRowDeleted',
        sourceXmlProvenance: provenance(token),
        classification: 'STRUCTURAL_BLOCKED',
        reasonCode: 'RTK_BLOCKED_STRUCTURAL',
        writerAuthorityImpact: 'blocking',
      };
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.structureChanges', change)) changes.push(change);
    }
    const isParagraphMark = isWordInsOrDel
      && token.path.length >= 3
      && token.path[token.path.length - 2] === 'rPr'
      && token.path[token.path.length - 3] === 'pPr';
    if (isParagraphMark) {
      const inserted = token.localName === 'ins';
      const change = {
        kind: 'StructureChange',
        structureKind: inserted ? 'paragraphMarkInserted' : 'paragraphMarkDeleted',
        sourceXmlProvenance: provenance(token),
        classification: 'STRUCTURAL_BLOCKED',
        reasonCode: inserted ? 'RTK_STRUCTURAL_PARAGRAPH_MARK_INSERTED' : 'RTK_STRUCTURAL_PARAGRAPH_MARK_DELETED',
        writerAuthorityImpact: 'blocking',
      };
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.structureChanges', change)) {
        changes.push(change);
      }
    }
    // EVID-01 (spec §32.5/§12.2): a tracked ins/del that CONTAINS a block-level
    // w:p element is a tracked paragraph insertion/deletion — a structural,
    // paragraph-boundary change (whole-paragraph tracked change), classified
    // here as trackedParagraphInsert/trackedParagraphDelete and suppressed from
    // the TextRevision lane (see parseTextRevisions).
    const containsParagraphElement = isWordInsOrDel && !isParagraphMark
      && documentScan.tokens.some((inner) => inner !== token
        && isWordToken(inner, 'p')
        && inner.openStart > token.openStart
        && inner.closeEnd <= token.closeEnd);
    if (containsParagraphElement) {
      const inserted = token.localName === 'ins';
      const change = {
        kind: 'StructureChange',
        structureKind: inserted ? 'trackedParagraphInsert' : 'trackedParagraphDelete',
        sourceXmlProvenance: provenance(token),
        classification: 'STRUCTURAL_BLOCKED',
        reasonCode: 'RTK_BLOCKED_STRUCTURAL',
        writerAuthorityImpact: 'blocking',
      };
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.structureChanges', change)) {
        changes.push(change);
      }
    }
  }
  return changes;
}

function firstChildValue(children, localName, attrName = 'val') {
  const found = children.find((token) => token.localName === localName);
  return found ? attr(found, attrName) : '';
}

function textInsideToken(documentXml, documentScan, container) {
  const blockedRanges = documentScan.tokens
    .filter((token) => (
      ['del', 'moveFrom'].includes(token.localName)
      && token.openStart >= container.openEnd
      && token.closeEnd <= container.closeStart
    ))
    .map((token) => ({ start: token.openStart, end: token.closeEnd }));
  let output = '';
  const textTokens = documentScan.tokens
    .filter((token) => (
      ['t', 'tab', 'br', 'cr'].includes(token.localName)
      && token.openStart >= container.openEnd
      && token.closeEnd <= container.closeStart
      && !positionInsideRanges(token.openStart, blockedRanges)
    ))
    .sort((left, right) => left.openStart - right.openStart || left.closeEnd - right.closeEnd);
  for (const token of textTokens) {
    if (token.localName === 'tab') output += '\t';
    else if (token.localName === 'br' || token.localName === 'cr') output += '\n';
    else output += decodeEntities(elementBody(documentXml, token));
  }
  return output;
}

function formattingToggleAction(children, localName) {
  const token = children.find((item) => item.localName === localName);
  if (!token) return null;
  const value = attr(token, 'val').trim().toLowerCase();
  return ['0', 'false', 'off', 'none'].includes(value)
    ? { action: 'remove' }
    : { action: 'set', value: true };
}

function formattingUnderlineAction(children) {
  const token = children.find((item) => item.localName === 'u');
  if (!token) return null;
  const value = attr(token, 'val').trim().toLowerCase();
  if (['0', 'false', 'off', 'none'].includes(value)) return { action: 'remove' };
  if (!value || value === 'single') return { action: 'set', value: true };
  return null;
}

function formattingColorAction(children) {
  const token = children.find((item) => item.localName === 'color');
  if (!token) return null;
  const value = attr(token, 'val').trim();
  if (!value) return null;
  if (['auto', 'none'].includes(value.toLowerCase())) return { action: 'remove' };
  return /^[A-Fa-f0-9]{6}$/u.test(value)
    ? { action: 'set', value: `#${value.toLowerCase()}` }
    : null;
}

export const WORD_HIGHLIGHT_COLOR_BY_NAME = Object.freeze({
  black: '#000000',
  blue: '#0000ff',
  cyan: '#00ffff',
  darkblue: '#000080',
  darkcyan: '#008080',
  darkgray: '#808080',
  darkgreen: '#008000',
  darkmagenta: '#800080',
  darkred: '#800000',
  darkyellow: '#808000',
  green: '#00ff00',
  lightgray: '#c0c0c0',
  magenta: '#ff00ff',
  red: '#ff0000',
  white: '#ffffff',
  yellow: '#ffff00',
});

function formattingHighlightAction(children) {
  const token = children.find((item) => item.localName === 'highlight');
  if (!token) return null;
  const value = attr(token, 'val').trim().toLowerCase();
  if (!value || value === 'none') return { action: 'remove' };
  return WORD_HIGHLIGHT_COLOR_BY_NAME[value]
    ? { action: 'set', value: WORD_HIGHLIGHT_COLOR_BY_NAME[value] }
    : null;
}

function formattingShadingAction(children) {
  const token = children.find((item) => item.localName === 'shd');
  if (!token) return null;
  const fill = attr(token, 'fill').trim();
  if (!fill || ['auto', 'none', 'nil'].includes(fill.toLowerCase())) return { action: 'remove' };
  return /^[A-Fa-f0-9]{6}$/u.test(fill)
    ? { action: 'set', value: `#${fill.toLowerCase()}` }
    : null;
}

function formattingFontAction(children) {
  const token = children.find((item) => item.localName === 'rFonts');
  if (!token) return null;
  const values = ['ascii', 'hAnsi', 'eastAsia', 'cs'].map((name) => attr(token, name).trim()).filter(Boolean);
  if (values.length === 0) return null;
  const unique = [...new Set(values)];
  return unique.length === 1 && unique[0].length <= 128
    ? { action: 'set', value: unique[0] }
    : null;
}

function formattingSizeAction(children) {
  const values = ['sz', 'szCs']
    .map((name) => children.find((item) => item.localName === name))
    .filter(Boolean)
    .map((token) => attr(token, 'val').trim())
    .filter(Boolean);
  if (values.length === 0) return null;
  const unique = [...new Set(values)];
  if (unique.length !== 1 || !/^\d{1,4}$/u.test(unique[0])) return null;
  const halfPoints = Number(unique[0]);
  if (!Number.isSafeInteger(halfPoints) || halfPoints < 2 || halfPoints > 3276) return null;
  return { action: 'set', value: `${halfPoints / 2}pt` };
}

function formattingInlineActions(children) {
  const inline = {};
  for (const [key, localName] of [['bold', 'b'], ['italic', 'i'], ['strike', 'strike']]) {
    const action = formattingToggleAction(children, localName);
    if (action) inline[key] = action;
  }
  const underline = formattingUnderlineAction(children);
  if (underline) inline.underline = underline;
  const color = formattingColorAction(children);
  if (color) inline.color = color;
  const highlight = formattingHighlightAction(children);
  if (highlight) inline.highlight = highlight;
  const shading = formattingShadingAction(children);
  if (shading) {
    if (inline.highlight && JSON.stringify(inline.highlight) !== JSON.stringify(shading)) {
      inline.highlightConflict = true;
    } else {
      inline.highlight = shading;
    }
  }
  const fontFamily = formattingFontAction(children);
  if (fontFamily) inline.fontFamily = fontFamily;
  const fontSize = formattingSizeAction(children);
  if (fontSize) inline.fontSize = fontSize;
  return inline;
}

function formattingInlineState(actions) {
  const state = {};
  for (const [key, action] of Object.entries(actions)) {
    if (action?.action === 'set') state[key] = action.value;
  }
  return state;
}

function formattingParagraphState(children) {
  const state = {};
  const alignments = children.filter((item) => item.localName === 'jc');
  if (alignments.length === 1) {
    try {
      const value = fromWordParagraphAlignment(attr(alignments[0], 'val').trim());
      if (value !== null) state.textAlign = value;
    } catch { /* The scanner marks a jc without a supported value as invalid. */ }
  }
  return state;
}

function formattingParagraphActions(children) {
  const state = formattingParagraphState(children);
  return Object.hasOwn(state, 'textAlign')
    ? { textAlign: { action: 'set', value: state.textAlign } }
    : {};
}

function formattingParagraphStructure(children) {
  const outline = children.find((item) => item.localName === 'outlineLvl');
  if (!outline) return { nodeType: 'paragraph' };
  const value = attr(outline, 'val').trim();
  if (!/^\d$/u.test(value)) return null;
  const outlineLevel = Number(value);
  if (!Number.isSafeInteger(outlineLevel) || outlineLevel < 0 || outlineLevel > 5) return null;
  return { nodeType: 'heading', headingLevel: outlineLevel + 1 };
}

function indexFormattingDocumentTokens(tokens) {
  const ordered = [...tokens].sort((left, right) => (
    (left.openStart - right.openStart)
    || (right.closeEnd - left.closeEnd)
  ));
  const stack = [];
  const paragraphs = [];
  for (const token of ordered) {
    while (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (
        parent.token.openStart < token.openStart
        && parent.token.closeEnd >= token.closeEnd
      ) break;
      stack.pop();
    }
    const parent = stack.length > 0
      ? stack[stack.length - 1]
      : { paragraph: null, run: null };
    if (parent.paragraph) parent.paragraph.tokens.push(token);
    if (parent.run) parent.run.tokens.push(token);

    let paragraph = parent.paragraph;
    let run = parent.run;
    if (token.localName === 'p' && token.namespaceUri === W_NS) {
      paragraph = { token, tokens: [], runs: [] };
      run = null;
      paragraphs.push(paragraph);
    } else if (token.localName === 'r' && token.namespaceUri === W_NS && paragraph) {
      run = { token, tokens: [] };
      paragraph.runs.push(run);
    }
    if (!token.selfClosing) stack.push({ token, paragraph, run });
  }
  return paragraphs;
}

// Table paragraph ordinals exclude only validated empty vertical-merge
// continuations. The result is a read-only projection, never review authority.
function tableDocumentParagraphs(documentXml, documentScan) {
  if (!documentScan.tokens.some(t => isWordToken(t, 'tbl'))) return null;
  const records = indexFormattingDocumentTokens(documentScan.tokens);
  const byToken = new Map(records.map(record => [record.token, record]));
  const paragraphs = [], reader = documentTables.createTableReader(paragraphs);
  const events = documentScan.tokens.flatMap(token => [
    { token, close: false, offset: token.openStart },
    ...(!token.selfClosing ? [{ token, close: true, offset: token.closeStart }] : []),
  ]).sort((a, b) => a.offset - b.offset);
  const stack = [];
  const name = t => t ? `${t.namespaceUri === W_NS ? 'w' : 'other'}:${t.localName}` : '';
  for (const event of events) {
    const { token, close } = event;
    if (close) stack.pop();
    reader.tag(name(token), name(stack.at(-1)), close, token.selfClosing, key => attr(token, key, W_NS));
    if (isWordToken(token, 'p') && (!close && token.selfClosing || close)) {
      const record = byToken.get(token);
      if (!record) throw new Error('DOCX_TABLE_PARAGRAPH_RECORD_REQUIRED');
      record.text = textInsideToken(documentXml, { tokens: record.tokens }, token);
      record.continuationEmpty = !record.tokens.some(t => [
        'ins', 'del', 'moveFrom', 'moveTo', 'bookmarkStart', 'bookmarkEnd',
        'commentRangeStart', 'commentRangeEnd', 'commentReference',
        'footnoteReference', 'endnoteReference', 'drawing', 'object', 'pict',
        'fldSimple', 'instrText', 'tab', 'br', 'cr',
      ].includes(t.localName));
      paragraphs.push(record);
    }
    if (!close && !token.selfClosing) stack.push(token);
  }
  reader.complete();
  return paragraphs;
}

export function extractReviewTransportFormattingRunsV2(documentXml, options = {}) {
  const cryptoPort = resolveCryptoPort(options.cryptoPort);
  if (!cryptoPort.ok) {
    return {
      ok: false,
      code: 'RTK_FORMATTING_SCANNER_CRYPTO_PORT_REQUIRED',
      reasons: [reason('RTK_FORMATTING_SCANNER_CRYPTO_PORT_REQUIRED', 'cryptoPort', 'Formatting scanner requires the bounded parser CryptoPort.', { missing: cryptoPort.missing })],
      paragraphs: [],
    };
  }
  const budgets = normalizeBudgets(options.budgets);
  const budgetState = createParserBudgetState(budgets, cryptoPort);
  const suppliedDocumentScan = isPlainObject(options.documentScan)
    && Array.isArray(options.documentScan.tokens)
    ? options.documentScan
    : null;
  const documentScan = suppliedDocumentScan
    || parseXmlPart('word/document.xml', documentXml, budgets, cryptoPort, budgetState);
  const reasons = suppliedDocumentScan ? [] : [...documentScan.diagnostics];
  if (blockingReason(reasons)) {
    return { ok: false, code: 'RTK_FORMATTING_SCANNER_XML_BLOCKED', reasons, paragraphs: [] };
  }
  let paragraphs;
  try {
    paragraphs = documentScan.logicalTableParagraphs
      || tableDocumentParagraphs(documentXml, documentScan)
      || indexFormattingDocumentTokens(documentScan.tokens);
  } catch (error) {
    reasons.push(reason('RTK_WORD_TABLES_MALFORMED_BLOCKED', 'reviewIr.tableParagraphs', error.message));
    return { ok: false, code: 'RTK_WORD_TABLES_MALFORMED_BLOCKED', reasons, paragraphs: [] };
  }
  const results = [];
  for (const [paragraphIndex, paragraphRecord] of paragraphs.entries()) {
    const paragraph = paragraphRecord.token;
    const paragraphScan = { tokens: paragraphRecord.tokens };
    const paragraphText = textInsideToken(documentXml, paragraphScan, paragraph);
    const trackedRevision = paragraphRecord.tokens.some((token) => (
      ['ins', 'del', 'moveFrom', 'moveTo'].includes(token.localName)
    ));
    const bookmarks = paragraphRecord.tokens
      .filter((token) => (
        token.localName === 'bookmarkStart'
      ))
      .map((token) => attr(token, 'name'))
      .filter(Boolean);
    const paragraphProperties = paragraphRecord.tokens.find((token) => (
      token.localName === 'pPr'
      && token.namespaceUri === W_NS
    ));
    const paragraphPropertyChildren = paragraphProperties
      ? childTokensWithin(paragraphScan, paragraphProperties).filter((token) => token.namespaceUri === W_NS)
      : [];
    const paragraphSemanticNames = [...new Set(paragraphPropertyChildren.map((token) => token.localName))];
    const unsupportedParagraphNames = paragraphSemanticNames.filter((name) => !['jc', 'outlineLvl'].includes(name));
    const paragraphState = formattingParagraphState(paragraphPropertyChildren);
    const paragraphActions = formattingParagraphActions(paragraphPropertyChildren);
    const paragraphStructure = formattingParagraphStructure(paragraphPropertyChildren);
    const paragraphFormattingInvalid = paragraphSemanticNames.includes('jc')
      && !Object.hasOwn(paragraphState, 'textAlign');
    const paragraphStructureInvalid = paragraphSemanticNames.includes('outlineLvl') && paragraphStructure === null;
    let cursor = 0;
    const formattedRuns = [];
    for (const runRecord of paragraphRecord.runs) {
      const run = runRecord.token;
      const runScan = { tokens: runRecord.tokens };
      const text = textInsideToken(documentXml, runScan, run);
      const from = cursor;
      const to = from + text.length;
      cursor = to;
      const properties = runRecord.tokens.find((token) => (
        token.localName === 'rPr'
        && token.namespaceUri === W_NS
      ));
      if (!text) continue;
      const children = properties
        ? childTokensWithin(runScan, properties).filter((token) => token.namespaceUri === W_NS)
        : [];
      const semanticNames = [...new Set(children.map((token) => token.localName))];
      const supportedNames = new Set(['b', 'i', 'u', 'strike', 'color', 'highlight', 'shd', 'rFonts', 'sz', 'szCs']);
      const unsupportedNames = semanticNames.filter((name) => !supportedNames.has(name));
      const inline = formattingInlineActions(children);
      const expectedActionKeys = [
        ...[['b', 'bold'], ['i', 'italic'], ['u', 'underline'], ['strike', 'strike']]
          .filter(([name]) => semanticNames.includes(name))
          .map(([, key]) => key),
        ...(semanticNames.includes('color') ? ['color'] : []),
        ...(semanticNames.includes('highlight') || semanticNames.includes('shd') ? ['highlight'] : []),
        ...(semanticNames.includes('rFonts') ? ['fontFamily'] : []),
        ...(semanticNames.includes('sz') || semanticNames.includes('szCs') ? ['fontSize'] : []),
      ];
      const invalidSupportedValue = expectedActionKeys.some((key) => !Object.hasOwn(inline, key))
        || inline.highlightConflict === true;
      delete inline.highlightConflict;
      formattedRuns.push({
        from,
        to,
        text,
        inline,
        inlineState: formattingInlineState(inline),
        unsupportedNames,
        invalidSupportedValue,
        sourceXmlProvenance: provenance(properties || run),
      });
    }
    results.push({
      paragraphIndex,
      paragraphText,
      ...(paragraphRecord.table ? { table: paragraphRecord.table } : {}),
      trackedRevision,
      paraId: attr(paragraph, 'paraId'),
      textId: attr(paragraph, 'textId'),
      bookmarkNames: bookmarks,
      paragraphState,
      paragraphActions,
      paragraphStructure: paragraphStructure || {},
      unsupportedParagraphNames,
      paragraphFormattingInvalid: paragraphFormattingInvalid || paragraphStructureInvalid,
      formattedRuns,
    });
  }
  return { ok: true, code: 'RTK_FORMATTING_SCANNER_READY', reasons, paragraphs: results };
}

function formattingParagraphsSemanticProjection(paragraphs) {
  return paragraphs.map((paragraph) => ({
    paragraphIndex: paragraph.paragraphIndex,
    paragraphText: paragraph.paragraphText,
    ...(paragraph.table ? { table: paragraph.table } : {}),
    trackedRevision: paragraph.trackedRevision,
    paraId: paragraph.paraId,
    textId: paragraph.textId,
    bookmarkNames: paragraph.bookmarkNames,
    paragraphState: paragraph.paragraphState,
    paragraphActions: paragraph.paragraphActions,
    paragraphStructure: paragraph.paragraphStructure,
    unsupportedParagraphNames: paragraph.unsupportedParagraphNames,
    paragraphFormattingInvalid: paragraph.paragraphFormattingInvalid,
    formattedRuns: paragraph.formattedRuns.map((run) => ({
      from: run.from,
      to: run.to,
      text: run.text,
      inline: run.inline,
      inlineState: run.inlineState,
      unsupportedNames: run.unsupportedNames,
      invalidSupportedValue: run.invalidSupportedValue,
    })),
  }));
}

function parseFormattingDeltas(documentXml, documentScan, budgetState, reasons) {
  const deltas = [];
  for (const token of documentScan.tokens) {
    if (token.localName !== 'rPr' && token.localName !== 'pPr' && token.localName !== 'hyperlink') continue;
    const children = childTokensWithin(documentScan, token);
    if (token.localName === 'hyperlink') {
      const delta = {
        kind: 'FormattingDelta',
        formatKind: 'hyperlink',
        values: {
          relationshipId: attr(token, 'id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships') || attr(token, 'id'),
          anchor: attr(token, 'anchor'),
          text: tokenText(documentXml, token),
        },
        sourceXmlProvenance: provenance(token),
        classification: 'MANUAL_REVIEW',
      };
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.formattingDeltas', delta)) {
        deltas.push(delta);
      }
      continue;
    }
    const values = token.localName === 'rPr'
      ? {
        bold: children.some((item) => item.localName === 'b'),
        italic: children.some((item) => item.localName === 'i'),
        underline: firstChildValue(children, 'u') || (children.some((item) => item.localName === 'u') ? 'present' : ''),
        strike: children.some((item) => item.localName === 'strike'),
        color: firstChildValue(children, 'color'),
        highlight: firstChildValue(children, 'highlight'),
        font: firstChildValue(children, 'rFonts', 'ascii') || firstChildValue(children, 'rFonts', 'hAnsi'),
        size: firstChildValue(children, 'sz'),
      }
      : {
        paragraphStyle: firstChildValue(children, 'pStyle'),
        alignment: firstChildValue(children, 'jc'),
        indent: children.find((item) => item.localName === 'ind')?.attrsByLocal || {},
        listMetadata: children.some((item) => item.localName === 'numPr')
          ? {
            ilvl: firstChildValue(children, 'ilvl'),
            numId: firstChildValue(children, 'numId'),
          }
          : {},
      };
    const delta = {
      kind: 'FormattingDelta',
      formatKind: token.localName,
      values,
      sourceXmlProvenance: provenance(token),
      classification: 'MANUAL_REVIEW',
    };
    if (admitWorkerOutput(budgetState, reasons, 'reviewIr.formattingDeltas', delta)) {
      deltas.push(delta);
    }
  }
  return deltas;
}

function relatedRevisionForRange(documentScan, start, end) {
  for (const token of documentScan.tokens) {
    if (!['ins', 'del', 'moveFrom', 'moveTo'].includes(token.localName)) continue;
    if (token.openStart <= start && token.closeEnd >= end) {
      return {
        kind: token.localName === 'ins'
          ? 'insert'
          : (token.localName === 'del' ? 'delete' : token.localName),
        nativeRevisionId: attr(token, 'id'),
        sourceXmlProvenance: provenance(token),
      };
    }
  }
  return null;
}

function replacementGroupRelationRef(revision, cryptoPort) {
  return {
    operation: rawString(revision?.operation),
    nativeRevisionId: rawString(revision?.nativeRevisionId),
    replacementGroupId: rawString(revision?.replacementGroupId),
    sourceXmlProvenanceDigest: cryptoPort.sha256Json({
      partName: revision?.sourceXmlProvenance?.partName,
      elementName: revision?.sourceXmlProvenance?.elementName,
      namespaceUri: revision?.sourceXmlProvenance?.namespaceUri,
      openStart: revision?.sourceXmlProvenance?.openStart,
      closeEnd: revision?.sourceXmlProvenance?.closeEnd,
    }),
  };
}

function relatedReplacementGroupForCommentAnchor(anchor, textRevisions, cryptoPort) {
  const start = anchor?.anchorStart;
  const end = anchor?.anchorEnd;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) return null;
  const revisions = Array.isArray(textRevisions) ? textRevisions.filter(isPlainObject) : [];
  const groups = new Map();
  for (const revision of revisions) {
    const groupId = typeof revision.replacementGroupId === 'string' ? revision.replacementGroupId : '';
    if (!groupId) continue;
    const provenanceItem = revision.sourceXmlProvenance || {};
    if (rawString(provenanceItem.partName) !== 'word/document.xml') continue;
    if (!Number.isSafeInteger(provenanceItem.openStart) || !Number.isSafeInteger(provenanceItem.closeEnd)) continue;
    const list = groups.get(groupId) || [];
    list.push(revision);
    groups.set(groupId, list);
  }
  const candidates = [];
  for (const [groupId, groupRevisions] of groups) {
    const insertRevision = groupRevisions.find((revision) => revision.operation === 'insert');
    const deleteRevision = groupRevisions.find((revision) => revision.operation === 'delete');
    if (groupRevisions.length !== 2 || !insertRevision || !deleteRevision) continue;
    if (!Number.isSafeInteger(insertRevision.paragraphIndex) || insertRevision.paragraphIndex !== deleteRevision.paragraphIndex) continue;
    const insertRange = insertRevision.sourceXmlProvenance || {};
    const deleteRange = deleteRevision.sourceXmlProvenance || {};
    const startInInsert = start > insertRange.openStart && start < insertRange.closeEnd;
    const endInInsert = end > insertRange.openStart && end < insertRange.closeEnd;
    const startInDelete = start > deleteRange.openStart && start < deleteRange.closeEnd;
    const endInDelete = end > deleteRange.openStart && end < deleteRange.closeEnd;
    const crossesInsertToDelete = startInInsert && endInDelete;
    const crossesDeleteToInsert = startInDelete && endInInsert;
    const withinInsert = startInInsert && endInInsert;
    if (!crossesInsertToDelete && !crossesDeleteToInsert && !withinInsert) continue;
    const refs = [insertRevision, deleteRevision]
      .sort((left, right) => rawString(left.operation).localeCompare(rawString(right.operation)))
      .map((revision) => replacementGroupRelationRef(revision, cryptoPort));
    const relationMode = withinInsert ? 'WITHIN_INSERT' : 'CROSS_REPLACEMENT';
    candidates.push({
      relationMode,
      groupId,
      paragraphIndex: insertRevision.paragraphIndex,
      sourceRevisionRefs: refs,
      relationDigest: cryptoPort.sha256Json({
        relationMode,
        groupId,
        paragraphIndex: insertRevision.paragraphIndex,
        sourceRevisionRefs: refs,
      }),
    });
  }
  return candidates.length === 1
    ? candidates[0]
    : (candidates.length > 1
      ? { relationMode: 'AMBIGUOUS_REPLACEMENT_GROUP', candidateGroupIds: candidates.map((item) => item.groupId).sort() }
      : null);
}

// PARSER-01 (P8): comment anchor validation is typed, not exact/ANCHORED.
// Each violation (lone start, lone reference, duplicate id, crossing intervals,
// orphan reference, cross-story) becomes a typed RTK_COMMENT_ANCHOR_* diagnostic
// and the affected thread is NEVER reported as exact/ANCHORED.
// EVID-01: locate the top-level Word paragraph containing an offset and read
// its declared locator signals (paraId/textId plus bookmarkStart names inside
// the paragraph range). Used to bind comment anchors to declared paragraph
// identity for downstream scene-authority resolution.
function anchorLocatorForOffset(documentScan, offset) {
  if (!Number.isSafeInteger(offset)) return null;
  let containing = null;
  const paragraphs = documentScan.logicalTableParagraphs?.map(record => record.token) || documentScan.tokens;
  for (const token of paragraphs) {
    if (!isWordToken(token, 'p') || (!documentScan.logicalTableParagraphs && (token.path.length !== 3 || token.path[1] !== 'body'))) continue;
    if (offset >= token.openStart && offset <= token.closeEnd) {
      containing = token;
      break;
    }
  }
  if (!containing) return null;
  const bookmarkNames = [];
  for (const token of documentScan.tokens) {
    if (token.localName !== 'bookmarkStart') continue;
    if (token.openStart >= containing.openStart && token.closeEnd <= containing.closeEnd) {
      const name = attr(token, 'name');
      if (name) bookmarkNames.push(name);
    }
  }
  return {
    paraId: attr(containing, 'paraId'),
    textId: attr(containing, 'textId'),
    bookmarkNames,
  };
}

function commentAnchorMap(documentXml, documentScan, textRevisions, cryptoPort, reasons) {
  const map = new Map();
  const ranges = [];
  const startsById = new Map();
  const endsById = new Map();
  const refsById = new Map();
  const duplicateIds = new Set();
  const paragraphs = documentScan.logicalTableParagraphs?.map(record => record.token)
    || documentScan.tokens.filter((token) => isWordToken(token, 'p')
      && token.path.length === 3 && token.path[1] === 'body');
  const paragraphAtoms = new Map();
  const semanticRange = (startToken, endToken, finalText = false) => {
    if (!endToken || endToken.openStart < startToken.closeEnd) return null;
    const paragraph = paragraphs.find((token) => token.openEnd <= startToken.openStart
      && token.closeStart >= endToken.closeEnd);
    if (!paragraph) return null;
    if (!paragraphAtoms.has(paragraph.openStart)) {
      paragraphAtoms.set(paragraph.openStart, extractSemanticAtoms(documentXml, documentScan, paragraph));
    }
    const atoms = paragraphAtoms.get(paragraph.openStart).filter((atom) => !finalText || atom.kind !== 'DeletedText');
    const before = atoms.filter((atom) => atom.order < startToken.openStart);
    const within = atoms.filter((atom) => atom.order >= startToken.closeEnd && atom.order < endToken.openStart);
    const startUtf16 = semanticAtomsToText(before).length;
    const selectedText = semanticAtomsToText(within);
    return { startUtf16, endUtf16: startUtf16 + selectedText.length, selectedText,
      blockTextSha256: cryptoPort.sha256Text(semanticAtomsToText(atoms)) };
  };
  for (const token of documentScan.tokens) {
    if (token.namespaceUri !== W_NS) continue;
    const id = attr(token, 'id', W_NS);
    if (!id) continue;
    if (token.localName === 'commentRangeStart') {
      if (startsById.has(id)) duplicateIds.add(id);
      startsById.set(id, token);
      ranges.push({ id, start: token.openStart, end: token.closeEnd, startToken: token });
    } else if (token.localName === 'commentRangeEnd') {
      if (endsById.has(id)) duplicateIds.add(id);
      endsById.set(id, token);
    } else if (token.localName === 'commentReference') {
      if (refsById.has(id)) duplicateIds.add(id);
      refsById.set(id, token);
    }
  }
  // Typed duplicate diagnostic.
  for (const id of duplicateIds) {
    reasons.push(reason('RTK_COMMENT_ANCHOR_DUPLICATE', `comments.${id}`, 'Duplicate comment anchor id is typed, not exact.', { commentId: id }));
  }
  // Crossing-interval check across DIFFERENT ids (proper overlap of [start,end)).
  const completeRanges = [];
  const crossingIds = new Set();
  for (const [id, startToken] of startsById) {
    const endToken = endsById.get(id);
    if (!endToken) continue;
    completeRanges.push({ id, start: startToken.openStart, end: endToken.closeEnd, startToken, endToken,
      semantic: semanticRange(startToken, endToken), paragraphIndex: paragraphIndexForOffset(documentScan, startToken.openStart) });
  }
  for (let i = 0; i < completeRanges.length; i += 1) {
    for (let j = i + 1; j < completeRanges.length; j += 1) {
      const a = completeRanges[i];
      const b = completeRanges[j];
      if (a.id === b.id) continue;
      const overlaps = Math.max(a.start, b.start) < Math.min(a.end, b.end);
      const nested = (a.start <= b.start && a.end >= b.end) || (b.start <= a.start && b.end >= a.end);
      const sameTextRange = a.semantic && b.semantic && a.paragraphIndex === b.paragraphIndex
        && a.semantic.startUtf16 === b.semantic.startUtf16 && a.semantic.endUtf16 === b.semantic.endUtf16;
      if (overlaps && !nested && !sameTextRange) {
        crossingIds.add(a.id); crossingIds.add(b.id);
        reasons.push(reason('RTK_COMMENT_ANCHOR_CROSSING', `comments.${a.id}.${b.id}`, 'Crossing comment anchor intervals are typed, not exact.', { commentIdA: a.id, commentIdB: b.id }));
      }
    }
  }
  for (const [id, startToken] of startsById) {
    const endToken = endsById.get(id);
    const refToken = refsById.get(id);
    const hasStart = true;
    const hasEnd = Boolean(endToken);
    const hasRef = Boolean(refToken);
    const isDuplicate = duplicateIds.has(id);
    let anchored = false;
    let diagnostic = null;
    if (!hasEnd) {
      diagnostic = 'RTK_COMMENT_ANCHOR_LONE';
      reasons.push(reason('RTK_COMMENT_ANCHOR_LONE', `comments.${id}`, 'Lone commentRangeStart with no matching end is typed, not exact.', { commentId: id }));
    } else if (isDuplicate) {
      diagnostic = 'RTK_COMMENT_ANCHOR_DUPLICATE';
      anchored = false;
    } else if (crossingIds.has(id)) {
      // Cross-story/crossing — leave anchored false (crossing diagnostic already pushed above).
      diagnostic = 'RTK_COMMENT_ANCHOR_CROSSING';
    } else {
      anchored = true;
    }
    const anchorRange = semanticRange(startToken, endToken);
    const finalTextAnchorRange = semanticRange(startToken, endToken, true);
    const quotedAnchorText = anchorRange?.selectedText ?? (endToken
      ? semanticAtomsToText(extractSemanticAtoms(documentXml, documentScan,
          { openEnd: startToken.closeEnd, closeStart: endToken.openStart }))
      : '');
    if (anchored && (!hasRef || !anchorRange)) {
      anchored = false;
      diagnostic = 'RTK_COMMENT_ANCHOR_LONE';
      reasons.push(reason(diagnostic, `comments.${id}`, 'A complete single-paragraph range and reference are required.', { commentId: id }));
    }
    const relatedReplacementGroup = relatedReplacementGroupForCommentAnchor({
      anchorStart: startToken.openStart,
      anchorEnd: endToken ? endToken.closeEnd : startToken.closeEnd,
    }, textRevisions, cryptoPort);
    if (relatedReplacementGroup?.relationMode === 'AMBIGUOUS_REPLACEMENT_GROUP') {
      reasons.push(reason('RTK_COMMENT_REPLACEMENT_GROUP_RELATION_AMBIGUOUS', `comments.${id}.relatedReplacementGroup`, 'Comment anchor crosses multiple replacement groups and cannot authorize canonical replacement-text association.', {
        commentId: id,
        candidateGroupIds: relatedReplacementGroup.candidateGroupIds,
      }));
    }
    map.set(id, {
      anchorStart: startToken.openStart,
      anchorEnd: endToken ? endToken.closeEnd : startToken.closeEnd,
      quotedAnchorText,
      anchorRange,
      finalTextAnchorRange,
      anchored,
      anchorDiagnostic: diagnostic,
      hasStart,
      hasEnd,
      hasRef,
      // EVID-01: declared locator of the paragraph containing this anchor —
      // paraId/textId/bookmarkNames read from the enclosing top-level Word
      // paragraph. Downstream consumers resolve scene authority through the
      // authenticated export map's declared signals without reparsing.
      anchorLocator: anchorLocatorForOffset(documentScan, startToken.openStart),
      relatedRevision: relatedRevisionForRange(
        documentScan,
        startToken.openStart,
        endToken ? endToken.closeEnd : startToken.closeEnd,
      ),
      relatedReplacementGroup,
    });
  }
  // Orphan reference: commentReference present but no commentRangeStart.
  for (const [id, refToken] of refsById) {
    if (startsById.has(id)) continue;
    if (!map.has(id)) {
      map.set(id, {
        anchorStart: refToken.openStart,
        anchorEnd: refToken.closeEnd,
        quotedAnchorText: '',
        anchored: false,
        anchorDiagnostic: 'RTK_COMMENT_ANCHOR_ORPHAN_REFERENCE',
        hasStart: false,
        hasEnd: false,
        hasRef: true,
        relatedRevision: null,
      });
    }
    reasons.push(reason('RTK_COMMENT_ANCHOR_ORPHAN_REFERENCE', `comments.${id}`, 'commentReference without commentRangeStart is typed, not exact.', { commentId: id }));
  }
  return map;
}

function collectModernCommentMetadata(scans) {
  const metadataByParaId = new Map();
  const metadataById = new Map();
  const people = [];
  for (const token of scans.commentsExtended.tokens.filter((item) => item.namespaceUri === W15_NS && item.localName === 'commentEx')) {
    const item = {
      paraId: attr(token, 'paraId', W15_NS),
      paraIdParent: attr(token, 'paraIdParent', W15_NS),
      done: attr(token, 'done', W15_NS).toLowerCase() === 'true' || attr(token, 'done', W15_NS) === '1',
      attributes: cloneJsonSafe(token.attributes),
    };
    if (item.paraId) metadataByParaId.set(item.paraId, { ...item, duplicate: metadataByParaId.has(item.paraId) });
  }
  for (const token of scans.commentsIds.tokens) {
    if (token.namespaceUri !== W16CID_NS || token.localName !== 'commentId') continue;
    const item = {
      paraId: attr(token, 'paraId', W16CID_NS),
      durableId: attr(token, 'durableId', W16CID_NS),
      dateUtc: attr(token, 'dateUtc', W16CID_NS),
      attributes: cloneJsonSafe(token.attributes),
    };
    if (item.paraId) {
      const prior = metadataByParaId.get(item.paraId) || {};
      metadataByParaId.set(item.paraId, { ...prior, ...item, duplicate: prior.duplicate === true || Boolean(prior.durableId) || metadataById.has(item.durableId) });
    }
    if (item.durableId) metadataById.set(item.durableId, item);
  }
  for (const token of scans.commentsExtensible.tokens) {
    if (token.namespaceUri !== W16CEX_NS || token.localName !== 'commentExtensible') continue;
    const durableId = attr(token, 'durableId', W16CEX_NS);
    const idRecord = metadataById.get(durableId);
    const paraId = idRecord?.paraId || attr(token, 'paraId', W16CEX_NS);
    if (!paraId) continue;
    const item = {
      ...(metadataByParaId.get(paraId) || {}),
      paraId,
      durableId,
      dateUtc: attr(token, 'dateUtc', W16CEX_NS),
      reopened: attr(token, 'reopened', W16CEX_NS) === '1' || attr(token, 'reopened', W16CEX_NS).toLowerCase() === 'true',
      duplicate: metadataByParaId.get(paraId)?.duplicate === true || metadataByParaId.get(paraId)?.extensibleSeen === true,
      extensibleSeen: true,
      attributes: cloneJsonSafe(token.attributes),
    };
    metadataByParaId.set(paraId, item);
    if (item.durableId) metadataById.set(item.durableId, item);
  }
  for (const token of scans.people.tokens) {
    if (token.localName !== 'person') continue;
    people.push({
      author: attr(token, 'author'),
      providerId: attr(token, 'providerId'),
      userId: attr(token, 'userId'),
      attributes: cloneJsonSafe(token.attributes),
    });
  }
  return { metadataByParaId, metadataById, people };
}

function isValidModernCommentParaId(value) {
  const text = rawString(value);
  if (!/^[0-9A-Fa-f]{8}$/u.test(text)) return false;
  const numeric = Number.parseInt(text, 16);
  return numeric > 0 && numeric < 0x80000000;
}

function lastCommentParagraphParaId(scans, commentToken) {
  const candidates = scans.comments.tokens
    .filter((token) => isWordToken(token, 'p'))
    .filter((token) => token.openStart > commentToken.openStart && token.closeEnd <= commentToken.closeStart)
    .sort((left, right) => left.openStart - right.openStart || left.closeEnd - right.closeEnd);
  let lastParaId = '';
  for (const token of candidates) {
    const paraId = attr(token, 'paraId', W14_NS);
    if (isValidModernCommentParaId(paraId)) lastParaId = paraId;
  }
  return lastParaId;
}

function expectedCommentRecords(input) {
  const list = Array.isArray(input.expectedCommentThreads)
    ? input.expectedCommentThreads
    : (Array.isArray(input.baselineCommentThreads) ? input.baselineCommentThreads : []);
  return list.filter(isPlainObject).map((item) => ({
    commentId: rawString(item.commentId || item.rawId),
    durableId: rawString(item.durableId),
    bodyExcerpt: rawString(item.bodyExcerpt || item.body).slice(0, 160),
    doneResolvedReopenedState: rawString(item.doneResolvedReopenedState || item.state),
  }));
}

function parseCommentThreads(input, documentXml, documentScan, scans, cryptoPort, budgetState, textRevisions = []) {
  const anchorReasons = [];
  const anchors = commentAnchorMap(documentXml, documentScan, textRevisions, cryptoPort, anchorReasons);
  const metadata = collectModernCommentMetadata(scans);
  const reasons = [...scans.comments.diagnostics, ...scans.commentsExtended.diagnostics, ...scans.commentsIds.diagnostics, ...scans.commentsExtensible.diagnostics, ...scans.people.diagnostics];
  const expected = expectedCommentRecords(input);
  const expectedByKey = new Map();
  for (const item of expected) {
    for (const key of [item.commentId, item.durableId].filter(Boolean)) expectedByKey.set(key, item);
  }
  const records = [];
  const seenIds = new Set();
  let ordinal = 0;
  for (const token of scans.comments.tokens.filter((item) => isWordToken(item, 'comment'))) {
    const declaredRawId = attr(token, 'id', W_NS);
    const rawId = declaredRawId || String(ordinal);
    const explicitParaId = attr(token, 'paraId', W_NS) || attr(token, 'paraId');
    const fallbackParaId = explicitParaId ? '' : lastCommentParagraphParaId(scans, token);
    const paraId = explicitParaId || fallbackParaId || rawId;
    const paraIdSource = explicitParaId
      ? 'comment-attribute'
      : (fallbackParaId ? 'last-comment-paragraph-w14-paraId' : 'raw-comment-id');
    const meta = metadata.metadataByParaId.get(paraId) || metadata.metadataByParaId.get(rawId) || {};
    const expectedRecord = expectedByKey.get(rawId) || expectedByKey.get(rawString(meta.durableId)) || {};
    const duplicate = seenIds.has(rawId);
    seenIds.add(rawId);
    const anchor = anchors.get(rawId) || {};
    const paragraphs = scans.comments.tokens.filter(item => isWordToken(item, 'p')
      && item.openStart > token.openStart && item.closeEnd <= token.closeStart)
      .sort((left, right) => left.openStart - right.openStart);
    const body = paragraphs.map(paragraph => tokenTextSemantic(scans.comments.xml, scans.comments, paragraph)).join('\n');
    const parentKey = attr(token, 'parentId') || rawString(meta.paraIdParent);
    const author = attr(token, 'author', W_NS);
    const record = {
      rawId,
      paraId,
      paraIdSource,
      parentKey,
      duplicate,
      relationshipDiagnostic: !declaredRawId ? 'RTK_COMMENT_ID_MISSING'
        : meta.duplicate === true ? 'RTK_COMMENT_METADATA_AMBIGUOUS' : '',
      ordinal,
      body,
      author,
      initials: attr(token, 'initials', W_NS),
      date: attr(token, 'date', W_NS),
      dateUtc: attr(token, 'dateUtc', W16DU_NS) || rawString(meta.dateUtc),
      durableId: rawString(meta.durableId),
      done: meta.done === true,
      reopened: meta.reopened === true
        || (
          meta.done === false
          && rawString(expectedRecord.doneResolvedReopenedState).toLowerCase() === 'resolved'
        ),
      anchor,
      metadata: meta,
      sourceXmlProvenance: provenance(token),
    };
    records.push(record);
    ordinal += 1;
  }
  const paraIdCounts = new Map();
  for (const record of records) {
    if (record.paraIdSource === 'raw-comment-id') continue;
    paraIdCounts.set(record.paraId, (paraIdCounts.get(record.paraId) || 0) + 1);
  }
  const ambiguousParaIds = new Set([...paraIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key));
  for (const record of records) {
    if (ambiguousParaIds.has(record.paraId)) {
      record.relationshipDiagnostic = 'RTK_COMMENT_PARENT_AMBIGUOUS';
      reasons.push(reason('RTK_COMMENT_PARENT_AMBIGUOUS', `comments.${record.rawId}`, 'Comment paragraph identity is ambiguous and cannot be used to infer a reply graph.', {
        commentId: record.rawId,
        paraId: record.paraId,
      }));
    }
  }
  const byKey = new Map();
  for (const record of records) {
    byKey.set(record.rawId, record);
    if (!ambiguousParaIds.has(record.paraId)) byKey.set(record.paraId, record);
    if (record.durableId) byKey.set(record.durableId, record);
  }
  const proposedParentByRawId = new Map();
  for (const record of records) {
    if (!record.parentKey || record.relationshipDiagnostic) continue;
    if (ambiguousParaIds.has(record.parentKey)) {
      record.relationshipDiagnostic = 'RTK_COMMENT_PARENT_AMBIGUOUS';
      reasons.push(reason('RTK_COMMENT_PARENT_AMBIGUOUS', `comments.${record.rawId}`, 'Comment parent paragraph identity is ambiguous and cannot be used to infer a reply graph.', {
        commentId: record.rawId,
        parentKey: record.parentKey,
      }));
      continue;
    }
    const parent = byKey.get(record.parentKey);
    if (!parent) continue;
    if (parent.rawId === record.rawId) {
      record.relationshipDiagnostic = 'RTK_COMMENT_PARENT_SELF_REFERENCE';
      reasons.push(reason('RTK_COMMENT_PARENT_SELF_REFERENCE', `comments.${record.rawId}`, 'Comment parent relationship points at itself and is preserved as unsupported.', {
        commentId: record.rawId,
        parentKey: record.parentKey,
      }));
      continue;
    }
    proposedParentByRawId.set(record.rawId, parent.rawId);
  }
  const recordsByRawId = new Map(records.map((record) => [record.rawId, record]));
  const cycleReasonedRawIds = new Set();
  const parentVisitState = new Map();
  function markCommentParentCycle(rawId) {
    const item = recordsByRawId.get(rawId);
    if (!item || cycleReasonedRawIds.has(rawId)) return;
    item.relationshipDiagnostic = item.relationshipDiagnostic || 'RTK_COMMENT_PARENT_CYCLE';
    cycleReasonedRawIds.add(rawId);
    reasons.push(reason('RTK_COMMENT_PARENT_CYCLE', `comments.${item.rawId}`, 'Comment parent graph contains a cycle and is preserved as unsupported.', {
      commentId: item.rawId,
    }));
  }
  for (const record of records) {
    if (parentVisitState.get(record.rawId) === 'done') continue;
    const path = [];
    const pathIndexByRawId = new Map();
    let cursor = record.rawId;
    while (proposedParentByRawId.has(cursor)) {
      if (parentVisitState.get(cursor) === 'done') break;
      if (pathIndexByRawId.has(cursor)) {
        for (const rawId of path.slice(pathIndexByRawId.get(cursor))) markCommentParentCycle(rawId);
        break;
      }
      pathIndexByRawId.set(cursor, path.length);
      path.push(cursor);
      cursor = proposedParentByRawId.get(cursor);
    }
    for (const rawId of path) parentVisitState.set(rawId, 'done');
    parentVisitState.set(record.rawId, 'done');
  }
  const childrenByParent = new Map();
  for (const record of records) {
    const parentRawId = proposedParentByRawId.get(record.rawId);
    if (!parentRawId || record.relationshipDiagnostic) continue;
    const list = childrenByParent.get(parentRawId) || [];
    list.push(record);
    childrenByParent.set(parentRawId, list);
  }
  function directChildren(record) {
    const keyed = new Map();
    for (const key of [record.rawId].filter(Boolean)) {
      for (const child of childrenByParent.get(key) || []) keyed.set(child.rawId, child);
    }
    return [...keyed.values()].sort((left, right) => left.ordinal - right.ordinal);
  }
  function buildReplies(record, seen = new Set()) {
    if (seen.has(record.rawId)) return [];
    seen.add(record.rawId);
    const replies = [];
    for (const reply of directChildren(record)) {
      replies.push({
        itemId: `rtk-comment-reply-${reply.rawId}`,
        rawId: reply.rawId,
        parentRawId: record.rawId,
        body: reply.body,
        bodyDigest: cryptoPort.sha256Json({ rawId: reply.rawId, body: reply.body }),
        author: reply.author,
        initials: reply.initials,
        date: reply.date,
        dateUtc: reply.dateUtc,
        durableId: reply.durableId,
        sourceXmlProvenance: reply.sourceXmlProvenance,
      });
      replies.push(...buildReplies(reply, seen));
    }
    return replies;
  }
  const threads = [];
  for (const record of records) {
    if (proposedParentByRawId.has(record.rawId) && !record.relationshipDiagnostic) continue;
    const replies = buildReplies(record);
    const status = record.duplicate
      ? 'UNSUPPORTED_BLOCKED'
      : (record.relationshipDiagnostic ? 'UNSUPPORTED_BLOCKED' : (record.anchor.anchorDiagnostic ? 'UNSUPPORTED_BLOCKED' : (record.done ? 'RESOLVED' : (record.anchor.anchored ? 'ANCHORED' : 'ORPHAN'))));
    const doneResolvedReopenedState = record.done
      ? 'resolved'
      : (record.reopened ? 'reopened' : 'active');
    const code = status === 'RESOLVED'
      ? 'RTK_COMMENT_RESOLVED'
      : (status === 'ANCHORED'
        ? 'RTK_COMMENT_ANCHORED'
        : (status === 'ORPHAN'
          ? 'RTK_COMMENT_ORPHAN'
          : (record.relationshipDiagnostic || record.anchor.anchorDiagnostic || 'RTK_COMMENT_UNSUPPORTED')));
    const thread = {
      kind: 'CommentThread',
      threadId: `rtk-comment-${record.rawId}`,
      commentId: record.rawId,
      durableId: record.durableId,
      parentThreadId: '',
      replies,
      doneResolvedReopenedState,
      authorPersonIdentity: {
        author: record.author,
        initials: record.initials,
        people: metadata.people,
      },
      date: record.date,
      dateUtc: record.dateUtc,
      anchorStart: record.anchor.anchorStart ?? null,
      anchorEnd: record.anchor.anchorEnd ?? null,
      anchorRange: record.anchor.anchorRange || null,
      finalTextAnchorRange: record.anchor.finalTextAnchorRange || null,
      quotedAnchorText: record.anchor.quotedAnchorText || '',
      relatedRevision: record.anchor.relatedRevision || null,
      relatedReplacementGroup: isPlainObject(record.anchor.relatedReplacementGroup)
        && ['CROSS_REPLACEMENT', 'WITHIN_INSERT'].includes(record.anchor.relatedReplacementGroup.relationMode)
        ? record.anchor.relatedReplacementGroup
        : null,
      relatedReplacementGroupDiagnostic: isPlainObject(record.anchor.relatedReplacementGroup)
        && record.anchor.relatedReplacementGroup.relationMode === 'AMBIGUOUS_REPLACEMENT_GROUP'
        ? record.anchor.relatedReplacementGroup
        : null,
      body: record.body,
      bodyExcerpt: record.body.slice(0, 160),
      orderingKey: record.ordinal,
      status,
      // EVID-01: the anchor's document-order paragraph index lets downstream
      // consumers resolve scene authority through the authenticated export map
      // (ordered projection) without reparsing the DOCX. Null when the anchor
      // is missing (ORPHAN lane).
      paragraphIndex: Number.isSafeInteger(record.anchor.anchorStart)
        ? paragraphIndexForOffset(documentScan, record.anchor.anchorStart)
        : null,
      anchorLocator: record.anchor.anchorLocator || null,
      placement: {
        outcome: status,
        anchored: record.anchor.anchored === true,
        selectorStack: {
          exactQuote: record.anchor.quotedAnchorText || '',
          prefix: '',
          suffix: '',
          utf16Position: record.anchor.anchorStart ?? null,
        },
      },
      reasonCodes: [code],
      modernMetadata: cloneJsonSafe(record.metadata || {}),
      sourceXmlProvenance: record.sourceXmlProvenance,
    };
    const admitted = admitWorkerOutput(budgetState, reasons, 'reviewIr.commentThreads', thread);
    if (admitted) {
      threads.push(thread);
      // ADMIT-01 (B1): success-shaped per-comment reason is published ONLY for
      // admitted threads. A dropped thread must never carry ANCHORED/ORPHAN/...
      // success reasons while it is absent from reviewIr.commentThreads.
      if (!String(code).startsWith('RTK_COMMENT_PARENT_')) {
        reasons.push(reason(code, `comments.${record.rawId}`, 'Comment lane was parsed before text classification and kept independent.', {
          threadId: thread.threadId,
        }));
      }
    } else {
      // ADMIT-01 (B1): dropped threads get a typed budget reason instead of a
      // success-shaped outcome, so the comment lane is marked BLOCKED_RESOURCE.
      reasons.push(reason('RTK_BUDGET_EXCEEDED', `comments.${record.rawId}`, 'Comment thread exceeded the parser worker output budget and was dropped from the ReviewIR comment lane.', {
        threadId: thread.threadId,
      }));
    }
  }
  const observedKeys = new Set();
  for (const record of records) {
    for (const key of [record.rawId, record.paraId, record.durableId].filter(Boolean)) observedKeys.add(key);
  }
  for (const missing of expected) {
    if (!missing.commentId && !missing.durableId) continue;
    if (observedKeys.has(missing.commentId) || observedKeys.has(missing.durableId)) continue;
    const key = missing.commentId || missing.durableId;
    const thread = {
      kind: 'CommentThread',
      threadId: `rtk-comment-missing-${key}`,
      commentId: missing.commentId,
      durableId: missing.durableId,
      parentThreadId: '',
      replies: [],
      doneResolvedReopenedState: 'deleted-or-missing',
      authorPersonIdentity: { author: '', initials: '', people: metadata.people },
      date: '',
      anchorStart: null,
      anchorEnd: null,
      quotedAnchorText: '',
      relatedRevision: null,
      body: '',
      bodyExcerpt: missing.bodyExcerpt,
      orderingKey: records.length + threads.length,
      status: 'UNSUPPORTED_BLOCKED',
      placement: {
        outcome: 'UNSUPPORTED_BLOCKED',
        anchored: false,
        selectorStack: {
          exactQuote: '',
          prefix: '',
          suffix: '',
          utf16Position: null,
        },
      },
      reasonCodes: ['RTK_COMMENT_UNSUPPORTED'],
      modernMetadata: {},
      sourceXmlProvenance: null,
    };
    const missingAdmitted = admitWorkerOutput(budgetState, reasons, 'reviewIr.commentThreads', thread);
    if (missingAdmitted) {
      threads.push(thread);
    }
    // RTK_COMMENT_UNSUPPORTED for missing threads is an inventory diagnostic,
    // not a success-shaped per-comment outcome; keep it on both paths so the
    // dropped-vs-missing distinction stays typed and never silently drops.
    reasons.push(reason('RTK_COMMENT_UNSUPPORTED', `comments.${key}`, 'Expected comment thread is missing from the returned package and cannot be silently dropped.', {
      threadId: thread.threadId,
    }));
    if (!missingAdmitted) {
      reasons.push(reason('RTK_BUDGET_EXCEEDED', `comments.${key}`, 'Missing comment thread exceeded the parser worker output budget and was dropped from the ReviewIR comment lane.', {
        threadId: thread.threadId,
      }));
    }
  }
  return { commentThreads: threads, reasons: [...reasons, ...anchorReasons] };
}

function buildCommentGraphCapability(input, partNames, commentThreads) {
  const replyCount = commentThreads.reduce((total, thread) => total + thread.replies.length, 0);
  const statusCounts = {};
  for (const thread of commentThreads) {
    statusCounts[thread.status] = (statusCounts[thread.status] || 0) + 1;
  }
  return {
    schemaVersion: 'yalken.rtk.comment-graph-capability.v1',
    status: input.physicalWordReopenVisibility === true
      ? 'SEMANTIC_READBACK_READY_PHYSICAL_VISIBILITY_PROVIDED'
      : 'PARSER_ONLY_NOT_CERTIFIED',
    commentPassAllowed: input.physicalWordReopenVisibility === true
      && commentThreads.length > 0
      && !statusCounts.UNSUPPORTED_BLOCKED,
    noOpSaveCountsAsPass: false,
    physicalWordReopenVisibility: input.physicalWordReopenVisibility === true,
    packageParts: partNames.filter((partName) => partName.startsWith('word/comments') || partName === 'word/people.xml'),
    threadCount: commentThreads.length,
    replyCount,
    durableIdCount: commentThreads.filter((thread) => Boolean(thread.durableId)).length,
    statusCounts,
  };
}

function directChildTokensWithin(documentScan, parent) {
  return documentScan.tokens.filter((token) => (
    token.openStart >= parent.openEnd
    && token.closeEnd <= parent.closeStart
    && token.depth === parent.depth + 1
  )).sort((left, right) => left.openStart - right.openStart);
}


// Native IDs are a package-local bijection only. The signed semantic baseline
// binds body text and source positions; no note returned here grants write authority.
function parseDocumentNotes(parts, documentXml, documentScan, relationships, contentTypes, budgets, cryptoPort, budgetState) {
  const schemaVersion = 'yalken.rtk.word.document-notes.v1';
  const reasons = [], notes = [], references = [], formatting = [];
  const refs = documentScan.tokens.filter(token => ['footnoteReference', 'endnoteReference'].includes(token.localName))
    .sort((a, b) => a.openStart - b.openStart);
  if (!refs.length && !parts['word/footnotes.xml'] && !parts['word/endnotes.xml']) return { documentNotes: null, reasons };
  const requireNote = (ok, detail) => {
    if (!ok) throw new Error(detail);
  };
  try {
    requireNote(refs.length <= 256, 'REFERENCE_COUNT');
    const paragraphs = documentScan.logicalTableParagraphs?.map(record => record.token)
      || documentScan.tokens.filter(token => isWordToken(token, 'p')
        && token.path.join('/') === 'document/body/p').sort((a, b) => a.openStart - b.openStart);
    const insertedRanges = documentScan.tokens.filter(token => isWordToken(token, 'ins') || isWordToken(token, 'moveTo'));
    const noteByKey = new Map();
    let textBytes = 0;
    for (const kind of ['footnote', 'endnote']) {
      const partName = `word/${kind}s.xml`, xml = parts[partName];
      const matchingRefs = refs.filter(token => token.localName === `${kind}Reference`);
      const rels = relationships.filter(item => item.type === `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}s`);
      if (xml === undefined) {
        requireNote(matchingRefs.length === 0 && rels.length === 0, 'MISSING_PART_OR_REFERENCE');
        continue;
      }
      requireNote(rels.length === 1 && rels[0].partName === 'word/_rels/document.xml.rels'
        && rels[0].target === `${kind}s.xml` && ['', 'Internal'].includes(rels[0].targetMode), 'PART_RELATIONSHIP');
      requireNote(relationships.filter(item => item.partName === 'word/_rels/document.xml.rels' && item.id === rels[0].id).length === 1, 'DUPLICATE_RELATIONSHIP_ID');
      requireNote(!relationships.some(item => item.partName === `word/_rels/${kind}s.xml.rels`), 'NOTE_RELATIONSHIP_UNSUPPORTED');
      const types = contentTypes.filter(item => item.partName === `/${partName}`);
      requireNote(types.length === 1 && types[0].contentType === `application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml`, 'PART_CONTENT_TYPE');
      const scan = parseXmlPart(partName, xml, budgets, cryptoPort, budgetState);
      reasons.push(...scan.diagnostics);
      const roots = scan.tokens.filter(token => token.depth === 0);
      requireNote(roots.length === 1 && isWordToken(roots[0], `${kind}s`), 'PART_ROOT');
      const ids = new Set();
      for (const entry of directChildTokensWithin(scan, roots[0])) {
        requireNote(isWordToken(entry, kind), 'PART_CHILD');
        const id = attr(entry, 'id', W_NS), type = attr(entry, 'type', W_NS);
        requireNote(/^-?[0-9]{1,9}$/u.test(id) && !ids.has(id), 'DUPLICATE_OR_INVALID_ID');
        ids.add(id);
        if (type) {
          requireNote(['separator', 'continuationSeparator'].includes(type), 'SPECIAL_NOTE_UNSUPPORTED');
          const descendants = childTokensWithin(scan, entry);
          requireNote(descendants.filter(token => isWordToken(token, type)).length === 1
            && !descendants.some(token => ['t', 'delText', 'footnoteReference', 'endnoteReference'].includes(token.localName)), 'SPECIAL_NOTE_CONTENT');
          continue;
        }
        requireNote(Number(id) > 0, 'NORMAL_NOTE_ID');
        const ps = directChildTokensWithin(scan, entry);
        requireNote(ps.length > 0 && ps.length <= 128 && ps.every(token => isWordToken(token, 'p')), 'NOTE_PARAGRAPH_STRUCTURE');
        let markCount = 0;
        const body = ps.map(paragraph => {
          for (const token of childTokensWithin(scan, paragraph)) {
            const property = token.path.includes('pPr') || token.path.includes('rPr');
            if (['t', 'tab', 'br', 'cr', `${kind}Ref`].includes(token.localName)) {
              requireNote(token.namespaceUri === W_NS && token.path.at(-2) === 'r' && !property, 'NOTE_ATOM_LOCATION');
              if (token.localName === `${kind}Ref`) markCount++;
              if (token.localName === 'br') requireNote(['', 'textWrapping'].includes(attr(token, 'type', W_NS)), 'NOTE_BREAK_KIND');
              requireNote(token.localName !== 'cr', 'NOTE_NON_CANONICAL_NEWLINE');
            } else if (['r', 'rPr', 'pPr', 'proofErr', 'bookmarkStart', 'bookmarkEnd'].includes(token.localName)) {
              requireNote(token.namespaceUri === W_NS, 'NOTE_ELEMENT_NAMESPACE');
            } else if (property && token.namespaceUri === W_NS) {
              formatting.push({ kind, elementName: token.localName });
            } else {
              requireNote(false, 'NOTE_CONTENT_UNSUPPORTED');
            }
          }
          const value = tokenTextSemantic(xml, scan, paragraph);
          textBytes += cryptoPort.byteLength(value);
          requireNote(textBytes <= 1024 * 1024, 'NOTE_TEXT_BUDGET');
          return value;
        });
        requireNote(markCount === 1, 'NOTE_REFERENCE_MARK');
        noteByKey.set(`${kind}:${id}`, body);
        requireNote(noteByKey.size <= 256, 'NOTE_COUNT');
      }
    }
    const used = new Set();
    for (const reference of refs) {
      const kind = reference.localName === 'footnoteReference' ? 'footnote' : 'endnote';
      const owner = paragraphs.find(p => reference.openStart >= p.openEnd && reference.closeEnd <= p.closeStart);
      const ownerRun = owner && documentScan.tokens.find(token => isWordToken(token, 'r')
        && token.depth === owner.depth + 1
        && token.openStart >= owner.openEnd && token.closeEnd <= owner.closeStart
        && reference.openStart >= token.openEnd && reference.closeEnd <= token.closeStart);
      requireNote(ownerRun && reference.namespaceUri === W_NS
        && reference.path.join('/') === `${owner.path.join('/')}/r/${kind}Reference`
        && !attr(reference, 'customMarkFollows', W_NS), 'REFERENCE_LOCATION_OR_CUSTOM_MARK');
      const id = attr(reference, 'id', W_NS), key = `${kind}:${id}`;
      requireNote(noteByKey.has(key) && !used.has(key), 'DANGLING_OR_DUPLICATE_REFERENCE');
      used.add(key);
      const paragraphIndex = paragraphs.findIndex(p => reference.openStart >= p.openEnd && reference.closeEnd <= p.closeStart);
      requireNote(paragraphIndex >= 0, 'REFERENCE_PARAGRAPH');
      // Offsets use original text for a tracked return: inserted text confers no
      // new anchor authority. A later canonical export resolves its own revision.
      const before = { ...paragraphs[paragraphIndex], closeStart: reference.openStart };
      const atoms = extractSemanticAtoms(documentXml, documentScan, before).filter(atom =>
        !insertedRanges.some(range => atom.order >= range.openStart && atom.order < range.closeEnd));
      const offsetUtf16 = semanticAtomsToText(atoms).length;
      notes.push({ kind, paragraphIndex, offsetUtf16, paragraphs: noteByKey.get(key) });
      references.push({ kind, nativeId: id, paragraphIndex, offsetUtf16 });
    }
    requireNote(used.size === noteByKey.size, 'ORPHAN_NOTE');
  } catch (error) {
    reasons.push(reason('RTK_WORD_NOTES_MALFORMED_BLOCKED', 'reviewIr.documentNotes',
      'Native note parts and references require bounded, complete semantic correspondence.', { detail: error.message }));
  }
  return { documentNotes: { schemaVersion, notes, references,
    protectedDigest: cryptoPort.sha256Json({ schemaVersion, notes }),
    lossLedger: { formattingPolicy: 'NATIVE_NOTE_TEXT_AND_PLACEMENT_PROTECTED_FORMATTING_ADVISORY',
      providerFormattingElements: [...new Map(formatting.map(item => [`${item.kind}:${item.elementName}`, item])).values()] } }, reasons };
}

function sectionIntegerAttribute(token, localName) {
  const value = attr(token, localName, W_NS);
  if (!/^[0-9]{1,9}$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseDocumentSections(documentScan, cryptoPort) {
  const reasons = [];
  const allSectionTokens = documentScan.tokens
    .filter((token) => isWordToken(token, 'sectPr'))
    .sort((left, right) => left.openStart - right.openStart);
  if (allSectionTokens.length === 0) {
    return {
      sections: {
        schemaVersion: WORD_DOCUMENT_SECTIONS_SCHEMA,
        authority: 'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',
        applicable: false,
        protectedSections: [],
        protectedDigest: '',
        lossLedger: { providerExtensionElements: [] },
      },
      reasons,
    };
  }
  const bodyFinalTokens = allSectionTokens.filter((token) => (
    token.path.length === 3
    && token.path[0] === 'document'
    && token.path[1] === 'body'
    && token.path[2] === 'sectPr'
  ));
  const paragraphSectionTokens = allSectionTokens.filter((token) => (
    token.path.length === 5
    && token.path[0] === 'document'
    && token.path[1] === 'body'
    && token.path[2] === 'p'
    && token.path[3] === 'pPr'
    && token.path[4] === 'sectPr'
  ));
  const validLocations = new Set([...bodyFinalTokens, ...paragraphSectionTokens]);
  if (bodyFinalTokens.length !== 1 || validLocations.size !== allSectionTokens.length) {
    reasons.push(reason(
      'RTK_WORD_SECTIONS_MALFORMED_BLOCKED',
      'reviewIr.documentSections',
      'Word section properties require exactly one body-final section and only supported paragraph boundary locations.',
      {
        sectionCount: allSectionTokens.length,
        bodyFinalCount: bodyFinalTokens.length,
        unsupportedLocationCount: allSectionTokens.length - validLocations.size,
      },
    ));
  }
  const paragraphs = documentScan.logicalTableParagraphs
    ? documentScan.logicalTableParagraphs.map(record => record.token)
    : documentScan.tokens.filter((token) => (
      isWordToken(token, 'p') && token.path.length === 3
      && token.path[0] === 'document' && token.path[1] === 'body'
    )).sort((left, right) => left.openStart - right.openStart);
  const seenBoundaryParagraphs = new Set();
  const records = [];
  const providerExtensionElements = [];
  const ordered = [...paragraphSectionTokens, ...bodyFinalTokens]
    .sort((left, right) => left.openStart - right.openStart);
  for (const [ordinal, sectionToken] of ordered.entries()) {
    const bodyFinal = bodyFinalTokens.includes(sectionToken);
    const paragraphIndex = bodyFinal
      ? paragraphs.length - 1
      : paragraphs.findIndex((paragraph) => (
        sectionToken.openStart >= paragraph.openEnd
        && sectionToken.closeEnd <= paragraph.closeStart
      ));
    if (paragraphIndex < 0 || (!bodyFinal && seenBoundaryParagraphs.has(paragraphIndex))) {
      reasons.push(reason(
        'RTK_WORD_SECTIONS_MALFORMED_BLOCKED',
        'reviewIr.documentSections.boundaries',
        'Word section boundary does not resolve to one unique document paragraph.',
        { ordinal, paragraphIndex },
      ));
    }
    if (!bodyFinal) seenBoundaryParagraphs.add(paragraphIndex);
    const children = directChildTokensWithin(documentScan, sectionToken);
    const byName = (name) => children.filter((token) => isWordToken(token, name));
    const typeTokens = byName('type');
    const pageSizeTokens = byName('pgSz');
    const marginTokens = byName('pgMar');
    const columnTokens = byName('cols');
    for (const [name, tokens] of [
      ['type', typeTokens],
      ['pgSz', pageSizeTokens],
      ['pgMar', marginTokens],
      ['cols', columnTokens],
    ]) {
      if (tokens.length > 1) {
        reasons.push(reason(
          'RTK_WORD_SECTIONS_MALFORMED_BLOCKED',
          `reviewIr.documentSections.${ordinal}.${name}`,
          'Duplicate protected Word section property is ambiguous.',
          { ordinal, property: name, count: tokens.length },
        ));
      }
    }
    const protectedNames = new Set(['type', 'pgSz', 'pgMar', 'cols']);
    for (const child of children.filter((token) => !protectedNames.has(token.localName))) {
      providerExtensionElements.push({
        sectionOrdinal: ordinal,
        namespaceUri: child.namespaceUri,
        elementName: child.localName,
      });
    }
    const typeToken = typeTokens[0];
    const pageSizeToken = pageSizeTokens[0];
    const marginToken = marginTokens[0];
    const columnToken = columnTokens[0];
    const widthTwips = sectionIntegerAttribute(pageSizeToken, 'w');
    const heightTwips = sectionIntegerAttribute(pageSizeToken, 'h');
    const declaredOrientation = attr(pageSizeToken, 'orient', W_NS);
    const orientation = declaredOrientation || (
      Number.isSafeInteger(widthTwips) && Number.isSafeInteger(heightTwips)
        ? (widthTwips > heightTwips ? 'landscape' : 'portrait')
        : ''
    );
    const previousEnd = records.at(-1)?.endParagraphIndex;
    records.push({
      ordinal,
      startParagraphIndex: ordinal === 0 ? 0 : (Number.isSafeInteger(previousEnd) ? previousEnd + 1 : null),
      endParagraphIndex: paragraphIndex,
      breakPlacement: bodyFinal ? 'BODY_FINAL' : 'PARAGRAPH_PROPERTIES',
      carriers: {
        sectionProperties: true,
        pageSize: pageSizeTokens.length === 1,
        margins: marginTokens.length === 1,
        columns: columnTokens.length === 1,
      },
      properties: {
        type: attr(typeToken, 'val', W_NS) || 'nextPage',
        pageSize: {
          widthTwips,
          heightTwips,
          orientation,
        },
        margins: {
          topTwips: sectionIntegerAttribute(marginToken, 'top'),
          rightTwips: sectionIntegerAttribute(marginToken, 'right'),
          bottomTwips: sectionIntegerAttribute(marginToken, 'bottom'),
          leftTwips: sectionIntegerAttribute(marginToken, 'left'),
          headerTwips: sectionIntegerAttribute(marginToken, 'header'),
          footerTwips: sectionIntegerAttribute(marginToken, 'footer'),
          gutterTwips: sectionIntegerAttribute(marginToken, 'gutter'),
        },
        columns: {
          count: sectionIntegerAttribute(columnToken, 'num') ?? 1,
          spaceTwips: sectionIntegerAttribute(columnToken, 'space'),
        },
      },
    });
  }
  for (const [index, record] of records.entries()) {
    const final = index === records.length - 1;
    if (!Number.isSafeInteger(record.startParagraphIndex)
      || !Number.isSafeInteger(record.endParagraphIndex)
      || record.startParagraphIndex < 0
      || record.endParagraphIndex < record.startParagraphIndex
      || (final ? record.endParagraphIndex !== paragraphs.length - 1 : record.endParagraphIndex >= paragraphs.length - 1)) {
      reasons.push(reason(
        'RTK_WORD_SECTIONS_MALFORMED_BLOCKED',
        `reviewIr.documentSections.${index}.boundary`,
        'Word section boundaries must be contiguous, ordered, non-empty and end at the final document paragraph.',
        {
          startParagraphIndex: record.startParagraphIndex,
          endParagraphIndex: record.endParagraphIndex,
          paragraphCount: paragraphs.length,
        },
      ));
    }
  }
  const protectedProjection = {
    schemaVersion: WORD_DOCUMENT_SECTIONS_SCHEMA,
    protectedSections: records,
  };
  return {
    sections: {
      ...protectedProjection,
      authority: 'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',
      applicable: true,
      protectedDigest: cryptoPort.sha256Json(protectedProjection),
      lossLedger: {
        providerExtensionElements: providerExtensionElements.sort((left, right) => (
          `${left.sectionOrdinal}|${left.namespaceUri}|${left.elementName}`
            .localeCompare(`${right.sectionOrdinal}|${right.namespaceUri}|${right.elementName}`)
        )),
      },
    },
    reasons,
  };
}

function collectUnsupportedElements(documentScan, budgetState, reasons) {
  const unsupported = [];
  for (const token of documentScan.tokens) {
    if (!DOCUMENT_UNSUPPORTED_ELEMENTS.includes(token.localName)) continue;
    const bodyLevelSectionProperties = token.localName === 'sectPr'
      && token.path.length === 3
      && token.path[0] === 'document'
      && token.path[1] === 'body';
    const item = {
      kind: 'unsupported-element',
      partName: token.partName,
      elementName: token.localName,
      relationshipId: attr(token, 'id'),
      typedDiagnostic: bodyLevelSectionProperties
        ? 'RTK_WORD_BODY_SECTION_PROPERTIES_INVENTORY'
        : (token.localName === 'AlternateContent'
          ? 'RTK_MCE_ALTERNATE_CONTENT_MANUAL'
          : 'RTK_STRUCTURAL_OR_FORMAT_ELEMENT_MANUAL'),
      preservationPolicy: bodyLevelSectionProperties
        ? 'inventory-only-word-section-defaults'
        : 'preserve-evidence-and-report-loss',
      writerAuthorityImpact: bodyLevelSectionProperties ? 'inventory-only' : 'blocking',
      sourceXmlProvenance: provenance(token),
    };
    if (
      admitBudgetCount(
        budgetState,
        reasons,
        'candidates',
        budgetState.budgets.maxCandidates,
        'reviewIr.opaqueUnsupported',
        'Unsupported candidate budget exceeded.',
      )
      && admitWorkerOutput(budgetState, reasons, 'reviewIr.opaqueUnsupported', item)
    ) {
      unsupported.push(item);
    }
  }
  return unsupported;
}

function sourceModeFor(input, documentXml, documentScan, textRevisions, moveRevisions, propertyRevisions) {
  const hasRevisions = textRevisions.length > 0 || moveRevisions.length > 0 || propertyRevisions.length > 0;
  const observedText = hasRevisions
    ? rawString(input.rejectedTrackedText || wordDocumentText(documentXml, documentScan, { skipInsertedRevisions: true }) || trackedRejectedText(documentXml, documentScan))
    : rawString(input.finalText || wordDocumentText(documentXml, documentScan) || stripTagsToText(documentXml));
  const hasUntrackedDrift = input.untrackedDrift === true
    || (
      rawString(input.baselineFinalText)
      && observedText !== rawString(input.baselineFinalText)
    );
  if (hasRevisions && hasUntrackedDrift) return 'MIXED';
  if (hasRevisions) return 'TRACKED';
  return 'CLEAN';
}

function blockingReason(reasons) {
  return reasons.find((item) => [
    'RTK_BUDGET_EXCEEDED',
    'RTK_HOSTILE_PACKAGE_BLOCKED',
    'RTK_XML_MALFORMED_BLOCKED',
    'RTK_XML_QNAME_MISMATCH',
    'RTK_XML_NAMESPACE_UNBOUND',
    'RTK_XML_DUPLICATE_ATTRIBUTE',
    'RTK_XML_NAMESPACE_PROFILE_MISMATCH',
    'RTK_ZIP_CRC_MISMATCH',
    'RTK_ZIP_CRC_EVIDENCE_MISSING',
    'RTK_ZIP_LOCAL_CENTRAL_MISMATCH',
    'RTK_ZIP_REGION_OVERLAP',
    'RTK_ZIP_FAKE_EOCD',
    'RTK_WORD_SECTIONS_MALFORMED_BLOCKED',
    'RTK_WORD_NOTES_MALFORMED_BLOCKED',
    'RTK_WORD_TABLES_MALFORMED_BLOCKED',
  ].includes(item.code));
}

function validateWordSemanticTypes(documentScan, commentsScan, stylesScan, reasons) {
  // Validate expanded names and typed values before any revision can acquire
  // product authority. Nested ins/del and absent style type are legal OOXML;
  // annotation IDs, when present, use the XML Schema integer lexical space.
  const integer = /^[+-]?[0-9]+$/u;
  for (const [scan, names, field] of [
    [documentScan, ['ins', 'del', 'moveFrom', 'moveTo'], 'reviewIr.textRevisions'],
    [documentScan, ['bookmarkStart', 'bookmarkEnd'], 'reviewIr.structureChanges'],
    [commentsScan, ['comment'], 'reviewIr.commentThreads'],
  ]) {
    const invalid = scan.tokens.find(token => names.some(name => isWordToken(token, name))
      && Object.hasOwn(token.attrsByNs, `${W_NS}|id`)
      && !integer.test(attr(token, 'id', W_NS).trim()));
    if (invalid) reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', field,
      'Word annotation identifier is not an XML Schema integer.', { sourceXmlProvenance: provenance(invalid) }));
  }
  const styleTypes = ['paragraph', 'character', 'table', 'numbering'];
  const invalidStyle = stylesScan.tokens.find(token => isWordToken(token, 'style')
    && Object.hasOwn(token.attrsByNs, `${W_NS}|type`)
    && !styleTypes.includes(attr(token, 'type', W_NS)));
  if (invalidStyle) reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', 'reviewIr.formattingParagraphs',
    'Word style type is outside the supported OOXML enumeration.', { sourceXmlProvenance: provenance(invalidStyle) }));
}

// ADMIT-01 laneCompleteness for V2 ReviewIR. The marker covers both the
// short lane names (text/structure/comments) asserted by abort contracts and
// the V2 IR field names (textRevisions/structureChanges/commentThreads) so the
// additive field is usable by every caller. A lane is BLOCKED_RESOURCE when a
// blocking diagnostic references that lane's field namespace.
const RTK_V2_BLOCKING_CODES = Object.freeze(new Set([
  'RTK_BUDGET_EXCEEDED',
  'RTK_HOSTILE_PACKAGE_BLOCKED',
  'RTK_XML_MALFORMED_BLOCKED',
  'RTK_XML_QNAME_MISMATCH',
  'RTK_XML_NAMESPACE_UNBOUND',
  'RTK_XML_DUPLICATE_ATTRIBUTE',
  'RTK_XML_NAMESPACE_PROFILE_MISMATCH',
  'RTK_ZIP_CRC_MISMATCH',
  'RTK_ZIP_CRC_EVIDENCE_MISSING',
  'RTK_ZIP_LOCAL_CENTRAL_MISMATCH',
  'RTK_ZIP_REGION_OVERLAP',
  'RTK_ZIP_FAKE_EOCD',
  'RTK_WORD_SECTIONS_MALFORMED_BLOCKED',
  'RTK_WORD_NOTES_MALFORMED_BLOCKED',
]));

function v2LaneStatus(reasons, laneFields) {
  for (const item of reasons) {
    if (!RTK_V2_BLOCKING_CODES.has(item.code)) continue;
    const field = rawString(item.field);
    if (laneFields.some((prefix) => field === prefix || field.startsWith(`${prefix}.`) || field.startsWith(prefix))) {
      return 'BLOCKED_RESOURCE';
    }
  }
  return 'COMPLETE';
}

function buildLaneCompletenessV2(reasons) {
  const text = v2LaneStatus(reasons, ['textRevisions', 'reviewIr.textRevisions']);
  const structure = v2LaneStatus(reasons, ['structureChanges', 'reviewIr.structureChanges']);
  const comments = v2LaneStatus(reasons, ['commentThreads', 'reviewIr.commentThreads', 'comments']);
  return {
    text,
    structure,
    comments,
    textRevisions: text,
    structureChanges: structure,
    commentThreads: comments,
  };
}

function emptyReviewIr(diagnostics = []) {
  return {
    schemaVersion: RTK_REVIEW_IR_V2_SCHEMA,
    sourceMode: 'CLEAN',
    textRevisions: [],
    moveRevisions: [],
    propertyRevisions: [],
    structureChanges: [],
    commentThreads: [],
    comments: [],
    formattingDeltas: [],
    formattingParagraphs: [],
    documentMetadata: null,
    documentSections: null,
    opaqueUnsupported: [],
    changes: [],
    diagnostics,
    conservation: {
      immutableDerivedAnalysisOnly: true,
      canWriteManuscript: false,
      canApply: false,
      commentLaneIndependentFromTextLane: true,
      unknownElementsNeverSilentlyDropped: true,
    },
  };
}

export function parseReviewTransportPackageV2(input = {}, ports = {}) {
  const cryptoPort = resolveCryptoPort(ports.cryptoPort);
  const budgetResolution = resolveBudgetsWithClamps(input.budgets);
  const budgets = budgetResolution.effective;
  const budgetClamps = budgetResolution.clampedFields;
  const effectiveBudgetDigestValue = effectiveBudgetDigest(budgets);
  // Effective budget evidence attached to EVERY result path (blocked or ok) so
  // the exact min-clamped budget + digest + clamp record is observable
  // downstream regardless of the parse outcome (F-11/P1-02).
  const budgetEvidence = {
    effectiveBudgets: budgets,
    effectiveBudgetDigest: effectiveBudgetDigestValue,
    budgetClamps,
  };
  const initialReasons = [];
  if (!cryptoPort.ok) {
    initialReasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', 'cryptoPort', 'CryptoPort is required for package analysis digests.', {
      missing: cryptoPort.missing,
    }));
    return {
      ok: false,
      schemaVersion: RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
      status: 'blocked',
      code: 'RTK_HOSTILE_PACKAGE_BLOCKED',
      canWriteManuscript: false,
      canApply: false,
      sourceMode: 'CLEAN',
      reviewIr: emptyReviewIr(initialReasons),
      laneCompleteness: buildLaneCompletenessV2(initialReasons),
      reasons: initialReasons,
      ...budgetEvidence,
    };
  }

  const budgetState = createParserBudgetState(budgets, cryptoPort);
  const normalized = normalizePackageParts(input.parts, budgets, cryptoPort);
  const parts = normalized.admittedParts;
  const partNames = Object.keys(parts).sort();
  const reasons = [...normalized.reasons];
  for (const required of REQUIRED_PARTS) {
    if (!Object.hasOwn(parts, required)) {
      reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', `parts.${required}`, 'Required OOXML part is missing.', {
        partName: required,
      }));
    }
  }
  reasons.push(...evaluateZipInventory(input.zipInventory, parts, cryptoPort, budgets.maxZipEntries));
  const relationships = parseRelationshipParts(parts, budgets, cryptoPort);
  const contentTypes = parseContentTypes(parts['[Content_Types].xml'], budgets, cryptoPort);
  reasons.push(...relationships.reasons, ...contentTypes.reasons);
  const authorityCarrier = analyzeAuthorityCarriers(input, parts, budgets, cryptoPort, budgetState);
  reasons.push(...authorityCarrier.reasons);
  const documentMetadataResult = parseDocumentMetadata(parts, budgets, cryptoPort, budgetState);
  reasons.push(...documentMetadataResult.reasons);
  const documentMetadata = documentMetadataResult.metadata;

  const documentXml = rawString(parts['word/document.xml']);
  const documentScan = parseXmlPart('word/document.xml', documentXml, budgets, cryptoPort, budgetState);
  reasons.push(...documentScan.diagnostics);
  if (!blockingReason(reasons)) {
    try { documentScan.logicalTableParagraphs = tableDocumentParagraphs(documentXml, documentScan); }
    catch (error) { reasons.push(reason('RTK_WORD_TABLES_MALFORMED_BLOCKED', 'reviewIr.tableParagraphs', error.message)); }
  }
  const documentSectionsResult = parseDocumentSections(documentScan, cryptoPort);
  reasons.push(...documentSectionsResult.reasons);
  const documentSections = documentSectionsResult.sections;
  const documentNotesResult = parseDocumentNotes(parts, documentXml, documentScan,
    relationships.relationships, contentTypes.contentTypes, budgets, cryptoPort, budgetState);
  reasons.push(...documentNotesResult.reasons);
  const documentNotes = documentNotesResult.documentNotes;
  const scans = {
    comments: {
      xml: rawString(parts['word/comments.xml']),
      ...parseXmlPart('word/comments.xml', rawString(parts['word/comments.xml']), budgets, cryptoPort, budgetState),
    },
    commentsExtended: {
      xml: rawString(parts['word/commentsExtended.xml']),
      ...parseXmlPart('word/commentsExtended.xml', rawString(parts['word/commentsExtended.xml']), budgets, cryptoPort, budgetState),
    },
    commentsIds: {
      xml: rawString(parts['word/commentsIds.xml']),
      ...parseXmlPart('word/commentsIds.xml', rawString(parts['word/commentsIds.xml']), budgets, cryptoPort, budgetState),
    },
    commentsExtensible: {
      xml: rawString(parts['word/commentsExtensible.xml']),
      ...parseXmlPart('word/commentsExtensible.xml', rawString(parts['word/commentsExtensible.xml']), budgets, cryptoPort, budgetState),
    },
    people: {
      xml: rawString(parts['word/people.xml']),
      ...parseXmlPart('word/people.xml', rawString(parts['word/people.xml']), budgets, cryptoPort, budgetState),
    },
  };

  const stylesScan = parseXmlPart('word/styles.xml', rawString(parts['word/styles.xml']), budgets, cryptoPort, budgetState);
  reasons.push(...stylesScan.diagnostics, ...scans.comments.diagnostics);
  if (!blockingReason(reasons)) validateWordSemanticTypes(documentScan, scans.comments, stylesScan, reasons);

  const opaqueUnsupported = [
    ...collectOpaqueUnsupportedParts(partNames),
    ...collectUnsupportedElements(documentScan, budgetState, reasons),
  ];
  for (const item of opaqueUnsupported) {
    reasons.push(reason('RTK_COMMENT_UNSUPPORTED', `opaque.${item.partName}.${item.elementName || item.kind}`, 'Unsupported OOXML surface is preserved as typed diagnostics.', {
      typedDiagnostic: item.typedDiagnostic,
      preservationPolicy: item.preservationPolicy,
    }));
  }

  const blocked = blockingReason(reasons);
  if (blocked) {
    return {
      ok: false,
      schemaVersion: RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
      status: 'blocked',
      code: blocked.code,
      canWriteManuscript: false,
      canApply: false,
      sourceMode: 'CLEAN',
      packageInventory: {
        partNames,
        relationships: relationships.relationships,
        contentTypes: contentTypes.contentTypes,
        authorityCarriers: authorityCarrier.carriers,
        selectedAuthorityCarrier: authorityCarrier.selectedCarrier,
        opaqueUnsupported,
      },
      authorityCarrier,
      exactAuthority: authorityCarrier.exactAuthority,
      reviewIr: emptyReviewIr(reasons),
      laneCompleteness: buildLaneCompletenessV2(reasons),
      reasons,
      ...budgetEvidence,
    };
  }

  const textRevisions = parseTextRevisions(documentXml, documentScan, cryptoPort, budgets, budgetState, reasons);
  const moveRevisions = parseMoveRevisions(documentXml, documentScan, cryptoPort, budgetState, reasons);
  const propertyRevisions = parsePropertyRevisions(documentXml, documentScan, budgetState, reasons);
  const structureChanges = parseStructureChanges(documentScan, budgetState, reasons);
  const formattingDeltas = parseFormattingDeltas(documentXml, documentScan, budgetState, reasons);
  const formattingParagraphScan = extractReviewTransportFormattingRunsV2(documentXml, {
    cryptoPort,
    budgets,
    documentScan,
  });
  const formattingParagraphs = [];
  if (!formattingParagraphScan.ok) {
    reasons.push(...(Array.isArray(formattingParagraphScan.reasons) ? formattingParagraphScan.reasons : []));
  } else {
    for (const paragraph of formattingParagraphScan.paragraphs) {
      if (admitWorkerOutput(budgetState, reasons, 'reviewIr.formattingParagraphs', paragraph)) {
        formattingParagraphs.push(paragraph);
      }
    }
  }
  const comments = parseCommentThreads(input, documentXml, documentScan, scans, cryptoPort, budgetState, textRevisions);
  reasons.push(...comments.reasons);
  admitWorkerOutput(budgetState, reasons, 'reviewIr.documentMetadata', documentMetadata);
  admitWorkerOutput(budgetState, reasons, 'reviewIr.documentSections', documentSections);
  if (documentNotes) admitWorkerOutput(budgetState, reasons, 'reviewIr.documentNotes', documentNotes);
  const semanticBudgetBlocked = blockingReason(reasons);
  if (semanticBudgetBlocked) {
    return {
      ok: false,
      schemaVersion: RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
      status: 'blocked',
      code: semanticBudgetBlocked.code,
      canWriteManuscript: false,
      canApply: false,
      sourceMode: 'CLEAN',
      packageInventory: {
        partNames,
        relationships: relationships.relationships,
        contentTypes: contentTypes.contentTypes,
        authorityCarriers: authorityCarrier.carriers,
        selectedAuthorityCarrier: authorityCarrier.selectedCarrier,
        opaqueUnsupported,
      },
      authorityCarrier,
      exactAuthority: authorityCarrier.exactAuthority,
      reviewIr: emptyReviewIr(reasons),
      laneCompleteness: buildLaneCompletenessV2(reasons),
      reasons,
      ...budgetEvidence,
    };
  }
  if (moveRevisions.length > 0) {
    reasons.push(reason('RTK_BLOCKED_MOVE_REVISION', 'moveRevisions', 'Move revisions remain non-EXACT structural evidence.'));
  }
  if (propertyRevisions.length > 0 || structureChanges.length > 0) {
    reasons.push(reason('RTK_BLOCKED_STRUCTURAL', 'structureChanges', 'Structure and property changes require manual review.'));
  }
  const sourceMode = sourceModeFor(input, documentXml, documentScan, textRevisions, moveRevisions, propertyRevisions);
  if (sourceMode === 'CLEAN') reasons.push(reason('RTK_MANUAL_CLEAN_RETURN', 'sourceMode', 'CLEAN return remains manual review in B02.'));
  if (sourceMode === 'MIXED') reasons.push(reason('RTK_MANUAL_MIXED_RETURN', 'sourceMode', 'MIXED return remains manual review in B02.'));
  const commentGraphCapability = buildCommentGraphCapability(input, partNames, comments.commentThreads);

  const reviewIr = {
    schemaVersion: RTK_REVIEW_IR_V2_SCHEMA,
    sourceMode,
    textRevisions,
    moveRevisions,
    propertyRevisions,
    structureChanges,
    commentThreads: comments.commentThreads,
    comments: comments.commentThreads,
    formattingDeltas,
    formattingParagraphs,
    documentMetadata,
    documentSections,
    ...(documentNotes ? { documentNotes } : {}),
    opaqueUnsupported,
    authorityCarrier,
    commentGraphCapability,
    changes: textRevisions,
    diagnostics: reasons,
    conservation: {
      immutableDerivedAnalysisOnly: true,
      canWriteManuscript: false,
      canApply: false,
      commentLaneIndependentFromTextLane: true,
      revisionsFormattingStructureSeparateLanes: true,
      unknownElementsNeverSilentlyDropped: true,
      noFuzzyApplyAuthority: true,
    },
  };
  const packageInventory = {
    partNames,
    requiredPartsPresent: REQUIRED_PARTS.every((partName) => Object.hasOwn(parts, partName)),
    commentParts: partNames.filter((partName) => partName.startsWith('word/comments')),
    relationships: relationships.relationships,
    contentTypes: contentTypes.contentTypes,
    authorityCarriers: authorityCarrier.carriers,
    selectedAuthorityCarrier: authorityCarrier.selectedCarrier,
    opaqueUnsupported,
  };
  const parserProfile = {
    schemaVersion: 'yalken.rtk.parser-profile.v2',
    implementationId: RTK_REVIEW_TRANSPORT_PACKAGE_PARSER_V2_BUILD,
    profileId: RTK_REVIEW_TRANSPORT_PACKAGE_PARSER_V2_PROFILE,
    namespaceAware: true,
    packageRelationshipAware: true,
    regexXmlParser: false,
    generalXmlPlatform: false,
    contractVersion: 'ReviewIRV2',
    budgets,
    admittedParts: partNames,
    semanticFeatureFlags: [
      'text-revision-lane',
      'move-revision-lane',
      'property-revision-lane',
      'structure-lane',
      'comment-thread-graph',
      'formatting-delta-lane',
      'formatting-paragraph-projection-lane',
      'document-metadata-projection-lane',
      'document-sections-projection-lane',
      'opaque-unsupported-lane',
      'hostile-package-gate',
      'custom-document-property-authority-carrier',
    ],
  };
  const semanticProjection = {
    sourceMode,
    packageInventory,
    textRevisions: textRevisions.map((item) => ({
      operation: item.operation,
      nativeRevisionId: item.nativeRevisionId,
      textDigest: item.textDigest,
      replacementGroupId: item.replacementGroupId,
      // CANON-01 C6: placement participates so relocating a revision between paragraphs changes
      // supportedSemanticDigest.
      placement: placementForRevision(documentScan, item),
    })),
    moveRevisions: moveRevisions.map((item) => ({
      nativeRevisionId: item.nativeRevisionId,
      hasMoveFrom: Boolean(item.moveFrom),
      hasMoveTo: Boolean(item.moveTo),
    })),
    propertyRevisions: propertyRevisions.map((item) => item.propertyKind),
    structureChanges: structureChanges.map((item) => item.structureKind),
    commentThreads: comments.commentThreads.map((thread) => ({
      commentId: thread.commentId,
      durableId: thread.durableId,
      status: thread.status,
      doneResolvedReopenedState: thread.doneResolvedReopenedState,
      relatedRevision: thread.relatedRevision
        ? {
          kind: thread.relatedRevision.kind,
          nativeRevisionId: thread.relatedRevision.nativeRevisionId,
        }
        : null,
      relatedReplacementGroup: thread.relatedReplacementGroup
        ? {
          relationMode: thread.relatedReplacementGroup.relationMode,
          groupId: thread.relatedReplacementGroup.groupId,
          relationDigest: thread.relatedReplacementGroup.relationDigest,
          sourceRevisionRefs: thread.relatedReplacementGroup.sourceRevisionRefs,
        }
        : null,
      replyDigests: thread.replies.map((reply) => reply.bodyDigest),
      bodyDigest: cryptoPort.sha256Json({ commentId: thread.commentId, body: thread.body }),
      // CANON-01 C6b: anchor placement participates so relocating a comment between paragraphs
      // changes supportedSemanticDigest.
      placement: placementForCommentAnchor(documentScan, {
        anchorStart: thread.anchorStart,
        anchorEnd: thread.anchorEnd,
        quotedAnchorText: thread.quotedAnchorText,
      }, cryptoPort),
    })),
    commentGraphCapability,
    authorityCarrier: {
      status: authorityCarrier.status,
      selectedCarrier: authorityCarrier.selectedCarrier
        ? {
          carrier: authorityCarrier.selectedCarrier.carrier,
          propertyName: authorityCarrier.selectedCarrier.propertyName,
          verified: authorityCarrier.selectedCarrier.verified,
          validSignedLocator: authorityCarrier.selectedCarrier.validSignedLocator,
          payloadDigest: authorityCarrier.selectedCarrier.payloadDigest,
          signatureDigest: authorityCarrier.selectedCarrier.signatureDigest,
          baselineBinding: authorityCarrier.selectedCarrier.baselineBinding,
        }
        : null,
      exactAuthority: authorityCarrier.exactAuthority,
    },
    formattingDeltas: formattingDeltas.map((delta) => ({
      formatKind: delta.formatKind,
      values: delta.values,
      // CANON-01 P0-18: placement participates so relocated formatting deltas change the digest.
      placement: placementForFormattingDelta(documentScan, delta),
    })),
    formattingParagraphsDigest: cryptoPort.sha256Json(
      formattingParagraphsSemanticProjection(formattingParagraphs),
    ),
    documentMetadata: {
      schemaVersion: documentMetadata.schemaVersion,
      protectedProperties: documentMetadata.protectedProperties,
      coreProtectedProperties: documentMetadata.coreProtectedProperties,
      protectedDigest: documentMetadata.protectedDigest,
      publicCustomProperties: documentMetadata.publicCustomProperties,
      transportBindingProperties: documentMetadata.transportBindingProperties,
      volatileCoreProperties: documentMetadata.volatileCoreProperties,
      lossLedger: documentMetadata.lossLedger,
    },
    documentSections: {
      schemaVersion: documentSections.schemaVersion,
      applicable: documentSections.applicable,
      protectedSections: documentSections.protectedSections,
      protectedDigest: documentSections.protectedDigest,
      lossLedger: documentSections.lossLedger,
    },
    ...(documentNotes ? { documentNotes } : {}),
    opaqueUnsupported: opaqueUnsupported.map((item) => ({
      partName: item.partName,
      elementName: item.elementName,
      typedDiagnostic: item.typedDiagnostic,
    })),
  };
  admitWorkerOutput(budgetState, reasons, 'analysis.semanticProjection', semanticProjection);
  const outputBudgetBlocked = blockingReason(reasons);
  if (outputBudgetBlocked) {
    return {
      ok: false,
      schemaVersion: RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
      status: 'blocked',
      code: outputBudgetBlocked.code,
      canWriteManuscript: false,
      canApply: false,
      sourceMode,
      packageInventory,
      commentGraphCapability,
      authorityCarrier,
      exactAuthority: authorityCarrier.exactAuthority,
      reviewIr: emptyReviewIr(reasons),
      parserProfile,
      laneCompleteness: buildLaneCompletenessV2(reasons),
      reasons,
      ...budgetEvidence,
    };
  }
  const supportedSemanticDigest = cryptoPort.sha256Json(semanticProjection);
  const parserProfileDigest = cryptoPort.sha256Json(parserProfile);
  const analysisDigest = cryptoPort.sha256Json({
    schemaVersion: RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
    supportedSemanticDigest,
    parserProfileDigest,
    sourceMode,
  });
  return {
    ok: true,
    schemaVersion: RTK_RETURNED_REVIEW_ANALYSIS_V2_SCHEMA,
    status: 'review-ir-ready',
    code: 'RTK_NO_WRITE_ANALYSIS_READY',
    canWriteManuscript: false,
    canApply: false,
    sourceMode,
    packageInventory,
    commentGraphCapability,
    authorityCarrier,
    exactAuthority: authorityCarrier.exactAuthority,
    reviewIr,
    parserProfile,
    laneCompleteness: buildLaneCompletenessV2(reasons),
    supportedSemanticDigest,
    parserProfileDigest,
    analysisDigest,
    cacheKey: cryptoPort.sha256Json({
      returnedArtifactSha256: rawString(input.returnedArtifactSha256),
      parserProfileDigest,
      manifestDigest: rawString(input.manifestDigest),
    }),
    effectiveBudgets: budgets,
    effectiveBudgetDigest: effectiveBudgetDigestValue,
    budgetClamps,
    reasons: [
      reason('RTK_NO_WRITE_ANALYSIS_READY', 'reviewIr', 'Package-aware ReviewIRV2 parser produced immutable analysis without write authority.'),
      ...reasons,
    ],
  };
}

// EVID-01 (Pass 2): re-verify an authority carrier HMAC signature in main
// (which owns the local secret) against a carrier emitted by the secret-free
// worker. The worker carries unverifiedCarrierEvidence; main combines the
// verified YRTK2 binding with this HMAC check to upgrade the carrier to
// verified-baseline-bound WITHOUT a second worker spawn. Returns
// { ok, verified, validSignedLocator, baselineBinding, reasons }.
export function verifyAuthorityCarrierSignatureWithSecret(selectedCarrier, input = {}, cryptoPort) {
  const reasons = [];
  const candidate = isPlainObject(selectedCarrier) ? selectedCarrier : {};
  const hmacSecret = rawString(input?.hmacSecret);
  const expected = isPlainObject(input?.expectedAuthority) ? input.expectedAuthority : {};
  if (!hmacSecret) {
    return { ok: false, verified: false, validSignedLocator: false, baselineBinding: {}, reasons: [{ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.hmacSecret', message: 'Local HMAC secret is required for authority carrier verification.' }] };
  }
  const decoded = base64UrlDecodeText(candidate.encoded);
  if (!decoded.ok) {
    return { ok: false, verified: false, validSignedLocator: false, baselineBinding: {}, reasons: [{ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.encoded', message: 'Authority carrier could not be decoded.' }] };
  }
  let envelope = null;
  try {
    envelope = JSON.parse(decoded.value);
  } catch {
    return { ok: false, verified: false, validSignedLocator: false, baselineBinding: {}, reasons: [{ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.envelope', message: 'Authority carrier JSON is malformed.' }] };
  }
  const payload = isPlainObject(envelope?.payload) ? envelope.payload : {};
  const fullManuscript = isFullManuscriptAuthorityPayload(payload, expected);
  const expectedPayloadDigest = cryptoPort.sha256Json(payload);
  if (rawString(envelope?.payloadDigest) !== expectedPayloadDigest) {
    reasons.push({ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.payloadDigest', message: 'Authority carrier payload digest mismatch.' });
  }
  if (!HMAC_RE.test(rawString(envelope?.signature))) {
    reasons.push({ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.signature', message: 'Authority carrier signature must be a full hmac-sha256 digest.' });
  }
  if (envelope?.secretEmbeddedInDocx !== false) {
    reasons.push({ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.secretEmbeddedInDocx', message: 'Authority carrier secret must not be embedded.' });
  }
  const expectedHmac = normalizeHmac(cryptoPort.hmacSha256Json(payload, hmacSecret));
  if (rawString(envelope?.signature) !== expectedHmac) {
    reasons.push({ code: 'RTK_MANUAL_DEGRADED_LOCATOR', field: 'authorityCarrier.signature', message: 'Authority carrier HMAC mismatch.' });
  }
  const expectedKeys = expectedAuthorityBindingKeys(fullManuscript, expected);
  const baselineBinding = Object.fromEntries(expectedKeys.map((key) => {
    const expectedValue = rawString(expected[key]);
    return [`${key}Matches`, Boolean(expectedValue) && rawString(payload[key]) === expectedValue];
  }));
  for (const key of expectedKeys) {
    const expectedValue = rawString(expected[key]);
    if (expectedValue && rawString(payload[key]) !== expectedValue) {
      reasons.push({ code: authorityBindingMismatchReasonCode(key), field: `authorityCarrier.expectedAuthority.${key}`, message: 'Authority carrier does not match the expected local baseline.' });
    }
  }
  const allExpectedPresent = expectedKeys.every((key) => rawString(expected[key]));
  const allExpectedMatched = allExpectedPresent && Object.values(baselineBinding).every(Boolean);
  const verified = reasons.length === 0;
  return {
    ok: true,
    verified,
    validSignedLocator: verified && allExpectedMatched,
    payload: cloneJsonSafe(payload),
    baselineBinding: { ...baselineBinding, allExpectedPresent, allExpectedMatched },
    reasons,
  };
}


// A read-only projection of native inline picture references. It grants no
// filesystem or Apply authority. Binary PNG validation occurs against the
// corresponding bounded ZIP entry, not against a file named by the payload.
export function extractDocumentMediaReferencesV1(documentXml, options = {}) {
  const cryptoPort = resolveCryptoPort(options.cryptoPort), budgets = normalizeBudgets(options.budgets);
  const fail = code => { throw new Error(`DOCUMENT_MEDIA_${code}`); };
  if (!cryptoPort.ok) fail('CRYPTO_PORT');
  const state = createParserBudgetState(budgets, cryptoPort);
  const scan = (name, xml) => {
    const result = parseXmlPart(name, xml, budgets, cryptoPort, state);
    const roots = result.tokens.filter(t => t.depth === 0);
    const expectedRoot = name === 'word/document.xml' ? ['document', W_NS] : name.endsWith('.rels') ? ['Relationships', REL_NS] : ['Types', CONTENT_TYPES_NS];
    if (result.diagnostics.length || roots.length !== 1 || roots[0].localName !== expectedRoot[0] || roots[0].namespaceUri !== expectedRoot[1]) fail('XML');
    return result.tokens;
  };
  const tokens = scan('word/document.xml', documentXml);
  const drawings = tokens.filter(t => isWordToken(t, 'drawing'));
  if (!drawings.length) return [];
  if (drawings.length > 4096) fail('PLACEMENT_LIMIT');
  const relTokens = scan('word/_rels/document.xml.rels', options.relationshipsXml);
  const types = scan('[Content_Types].xml', options.contentTypesXml);
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const plain = (token, key) => rawString(token.attrsByNs?.[`|${key}`]);
  const inside = (child, parent) => child.openStart > parent.openStart && child.closeEnd <= parent.closeStart;
  const one = (list, name, ns) => {
    const matches = list.filter(t => t.localName === name && t.namespaceUri === ns);
    if (matches.length !== 1) fail('DRAWING_SHAPE');
    return matches[0];
  };
  const paragraphs = tableDocumentParagraphs(documentXml, { tokens })?.map(p => p.token)
    || indexFormattingDocumentTokens(tokens).map(p => p.token);
  const ids = new Set();
  return drawings.map(drawing => {
    const owners = paragraphs.map((p, i) => inside(drawing, p) ? i : -1).filter(i => i >= 0);
    if (owners.length !== 1) fail('PARAGRAPH_OWNERSHIP');
    const paragraphIndex = owners[0], paragraph = paragraphs[paragraphIndex];
    const descendants = tokens.filter(t => inside(t, drawing));
    const inline = one(descendants, 'inline', NS_WP);
    if (descendants.some(t => t.namespaceUri === NS_WP && t.localName === 'anchor')) fail('FLOATING_IMAGE_UNSUPPORTED');
    const blip = one(descendants, 'blip', NS_A), props = one(descendants, 'docPr', NS_WP);
    const extent = one(descendants.filter(t => inside(t, inline)), 'extent', NS_WP);
    const embed = attr(blip, 'embed', NS_R);
    if (!embed || attr(blip, 'link', NS_R)) fail('EXTERNAL_IMAGE');
    const id = plain(props, 'id');
    if (!/^[0-9]+$/u.test(id) || ids.has(id)) fail('DRAWING_ID');
    ids.add(id);
    const matches = relTokens.filter(t => t.namespaceUri === REL_NS && t.localName === 'Relationship' && plain(t, 'Id') === embed);
    if (matches.length !== 1) fail('RELATIONSHIP_LOOKUP');
    const rel = matches[0], target = plain(rel, 'Target');
    if (plain(rel, 'Type') !== `${NS_R}/image` || !['', 'Internal'].includes(plain(rel, 'TargetMode'))
      || !/^media\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.png$/u.test(target) || target.includes('..')) fail('RELATIONSHIP_TARGET');
    const partName = `word/${target}`;
    const overrides = types.filter(t => t.namespaceUri === CONTENT_TYPES_NS && t.localName === 'Override' && plain(t, 'PartName') === `/${partName}`);
    const defaults = types.filter(t => t.namespaceUri === CONTENT_TYPES_NS && t.localName === 'Default' && plain(t, 'Extension').toLowerCase() === 'png');
    const typeMatches = overrides.length ? overrides : defaults;
    if (typeMatches.length !== 1 || plain(typeMatches[0], 'ContentType') !== 'image/png') fail('CONTENT_TYPE');
    const dimension = key => { const value = plain(extent, key); if (!/^[1-9][0-9]*$/u.test(value) || Number(value) > 8192 * 9525) fail('EXTENT'); return Number(value); };
    const before = tokens.filter(t => inside(t, paragraph) && t.openStart < drawing.openStart);
    const offset = before.reduce((sum, t) => sum + (isWordToken(t, 't') ? tokenText(documentXml, t).length : ['tab', 'br', 'cr'].some(n => isWordToken(t, n)) ? 1 : 0), 0);
    return { paragraphIndex, offset, partName, embed, alt: plain(props, 'descr'), displayName: plain(props, 'name'), cx: dimension('cx'), cy: dimension('cy') };
  });
}

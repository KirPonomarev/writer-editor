'use strict';

const crypto = require('node:crypto');
const { extractStoredZipEntries } = require('./docxArtifactValidator.js');

const DETERMINISTIC_EXPORT_HASH_FORMAT_VERSION = 'b3c04-deterministic-export-hash-v1';

const DECLARED_VOLATILE_DOCX_FIELDS = Object.freeze([
  'docProps.core.creator',
  'docProps.core.lastModifiedBy',
  'docProps.core.created',
  'docProps.core.modified',
  'xml.attribute.pkg:id',
  'xml.attribute.packageId',
  'xml.attribute.documentId',
  'xml.attribute.docId',
]);

const XML_ENTRY_PATTERN = /\.xml$/i;
const VOLATILE_CORE_PROPERTY_ELEMENTS = Object.freeze([
  'dc:creator',
  'cp:lastModifiedBy',
  'dcterms:created',
  'dcterms:modified',
]);
const VOLATILE_ATTRIBUTE_NAMES = Object.freeze([
  'pkg:id',
  'packageId',
  'documentId',
  'docId',
]);

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function normalizeVolatileElement(xml, elementName) {
  const escaped = elementName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pairPattern = new RegExp(`<${escaped}([^>]*)>[\\s\\S]*?<\\/${escaped}>`, 'g');
  const emptyPattern = new RegExp(`<${escaped}([^>]*)\\/>`, 'g');
  return xml
    .replace(pairPattern, `<${elementName}$1>__VOLATILE__</${elementName}>`)
    .replace(emptyPattern, `<${elementName}$1>__VOLATILE__</${elementName}>`);
}

function normalizeVolatileAttributes(xml) {
  let output = xml;
  for (const attrName of VOLATILE_ATTRIBUTE_NAMES) {
    const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\s${escaped}="[^"]*"`, 'g'), ` ${attrName}="__VOLATILE__"`);
  }
  return output;
}

function normalizeXmlEntry(entryName, buffer) {
  let xml = normalizeText(buffer.toString('utf8'));
  if (entryName === 'docProps/core.xml') {
    for (const elementName of VOLATILE_CORE_PROPERTY_ELEMENTS) {
      xml = normalizeVolatileElement(xml, elementName);
    }
  }
  return normalizeVolatileAttributes(xml);
}

function normalizeDocxArtifactEntries(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('DOCX_ARTIFACT_BUFFER_REQUIRED');
  }
  const entries = extractStoredZipEntries(buffer);
  const issues = [];
  const normalizedEntries = [];

  for (const [entryName, entryValue] of entries) {
    if (entryName.startsWith('__UNSUPPORTED_METHOD__:')) {
      issues.push({
        code: 'E_B3C04_UNSUPPORTED_ZIP_METHOD',
        entryName: entryName.slice('__UNSUPPORTED_METHOD__:'.length),
      });
      continue;
    }
    if (entryName.startsWith('__')) {
      issues.push({ code: 'E_B3C04_ZIP_PARSE_ERROR', entryName });
      continue;
    }
    if (!Buffer.isBuffer(entryValue)) {
      issues.push({ code: 'E_B3C04_ENTRY_NOT_STORED', entryName });
      continue;
    }
    const normalizedPayload = XML_ENTRY_PATTERN.test(entryName)
      ? normalizeXmlEntry(entryName, entryValue)
      : entryValue.toString('base64');
    normalizedEntries.push({
      entryName,
      normalizedPayloadHash: sha256Text(normalizedPayload),
    });
  }

  normalizedEntries.sort((a, b) => a.entryName.localeCompare(b.entryName));
  return { issues, normalizedEntries };
}

function normalizedDocxDeterministicHash(buffer) {
  const { issues, normalizedEntries } = normalizeDocxArtifactEntries(buffer);
  const normalizedPayload = {
    formatVersion: DETERMINISTIC_EXPORT_HASH_FORMAT_VERSION,
    declaredVolatileFields: [...DECLARED_VOLATILE_DOCX_FIELDS],
    entries: normalizedEntries,
  };
  return Object.freeze({
    ok: issues.length === 0 && normalizedEntries.some((entry) => entry.entryName === 'word/document.xml'),
    issues,
    normalizedHash: sha256Text(JSON.stringify(normalizedPayload)),
    normalizedEntryCount: normalizedEntries.length,
    normalizedEntries,
    declaredVolatileFields: [...DECLARED_VOLATILE_DOCX_FIELDS],
    normalizationScope: 'DOCX_STORED_ZIP_ENTRIES_AND_DECLARED_VOLATILE_XML_FIELDS_ONLY',
    noReleaseGatePromotion: true,
    noStyleFidelityClaim: true,
    noLayoutFidelityClaim: true,
  });
}

module.exports = {
  DECLARED_VOLATILE_DOCX_FIELDS,
  DETERMINISTIC_EXPORT_HASH_FORMAT_VERSION,
  normalizeDocxArtifactEntries,
  normalizedDocxDeterministicHash,
};

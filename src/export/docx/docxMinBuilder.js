const ZIP_CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function isPlainObjectValue(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeEditorSnapshotPayload(payload) {
  if (typeof payload === 'string') {
    return {
      content: payload,
      plainText: payload,
      bookProfile: null,
    };
  }

  const source = isPlainObjectValue(payload) ? payload : {};
  const content = typeof source.content === 'string'
    ? source.content
    : typeof source.text === 'string'
      ? source.text
      : '';
  return {
    content,
    plainText: typeof source.plainText === 'string' ? source.plainText : content,
    bookProfile: isPlainObjectValue(source.bookProfile) ? source.bookProfile : null,
  };
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ ZIP_CRC32_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ''), 'utf8');
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function normalizeSemanticKind(value) {
  const kind = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!kind) return 'paragraph';
  if (kind === 'scene-heading' || kind === 'sceneheading' || kind === 'scene_heading') return 'sceneHeading';
  if (kind === 'page-break' || kind === 'pagebreak' || kind === 'page_break') return 'pageBreak';
  if (kind === 'list-item' || kind === 'listitem' || kind === 'list_item') return 'listItem';
  if (kind === 'code-block' || kind === 'codeblock' || kind === 'code_block') return 'codeBlock';
  return kind;
}

function resolveDocxParagraphStyleId(styleDescriptor, semanticKind) {
  const role = typeof styleDescriptor?.role === 'string' ? styleDescriptor.role.trim().toLowerCase() : '';
  if (role === 'heading' || semanticKind === 'heading') return 'Heading1';
  if (role === 'scene_heading' || role === 'sceneheading' || semanticKind === 'sceneHeading') return 'Heading2';
  return '';
}

function assertDocxBuilderDependencies(dependencies) {
  const deps = isPlainObjectValue(dependencies) ? dependencies : {};
  if (
    !deps.docxPageSetupBindModule
    || typeof deps.docxPageSetupBindModule.buildDocxSectionPropertiesXml !== 'function'
    || !deps.semanticMappingModule
    || typeof deps.semanticMappingModule.mapSemanticEntries !== 'function'
    || !deps.styleMapModule
    || typeof deps.styleMapModule.createStyleMap !== 'function'
  ) {
    throw new Error('DOCX_MIN_BUILDER_DEPENDENCIES_INVALID');
  }
  return deps;
}

function buildDocxMinBuffer(editorSnapshot, dependencies) {
  const deps = assertDocxBuilderDependencies(dependencies);
  const snapshot = normalizeEditorSnapshotPayload(editorSnapshot);
  const plainText = String(snapshot.plainText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const semanticMap = deps.semanticMappingModule.mapSemanticEntries({
    sourceId: 'docx-export',
    text: plainText,
  });
  const styleMap = deps.styleMapModule.createStyleMap();
  const pageBreakToken = deps.semanticMappingModule.PAGE_BREAK_TOKEN_V1;
  const sectionPropertiesXml = deps.docxPageSetupBindModule.buildDocxSectionPropertiesXml(snapshot.bookProfile);
  const entries = Array.isArray(semanticMap.entries) ? semanticMap.entries : [];
  const paragraphs = entries.length > 0
    ? entries.map((entry) => {
      const semanticKind = normalizeSemanticKind(entry && entry.kind);
      const styleDescriptor = styleMap.resolve(entry);
      const styleId = resolveDocxParagraphStyleId(styleDescriptor, semanticKind);
      if (semanticKind === 'pageBreak' || String(entry?.text || '').trim() === pageBreakToken) {
        return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }

      const text = typeof entry?.text === 'string' ? entry.text : '';
      const styleXml = styleId ? `<w:pPr><w:pStyle w:val="${escapeXml(styleId)}"/></w:pPr>` : '';
      if (!text) {
        return `<w:p>${styleXml}</w:p>`;
      }
      return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    }).join('')
    : '<w:p/>';

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    ${sectionPropertiesXml}
  </w:body>
</w:document>`;

  return buildStoredZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

module.exports = {
  buildDocxMinBuffer,
  buildStoredZip,
  escapeXml,
  normalizeEditorSnapshotPayload,
};

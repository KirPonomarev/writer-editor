import model from '../../core/word-media-return-v1.cjs';
import media from '../documentMedia.js';
import bookmarks from '../../core/word-user-bookmarks-v1.cjs';
import source from '../../export/docx/fullManuscriptDocxReviewPacketSource.js';
import { hashCanonicalValue, sha256Hex } from '../../core/browser-safe-hash.mjs';

const same = (a, b) => hashCanonicalValue(a) === hashCanonicalValue(b);
const reject = detail => ({ ok: false, code: 'RTK_MEDIA_RETURN_CONFLICT', detail, analysisOnly: true, canWriteManuscript: false });
const key = p => p?.partName === 'word/document.xml' && p.namespaceUri === 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  && Number.isSafeInteger(p.openStart) && Number.isSafeInteger(p.closeEnd) && p.openStart >= 0 && p.closeEnd > p.openStart
  ? `${p.elementName}:${p.openStart}:${p.closeEnd}` : null;
function baseRuns(block, defaultSize) {
  return block.formatIr.runs.map(run => {
    const links = (run.preservedMarks || []).filter(mark => mark.type === 'link');
    if (links.length > 1 || (run.preservedMarks || []).some(mark => mark.type !== 'link')) throw Error('unsupported-mark');
    return { from: run.from, to: run.to, text: run.text,
      style: { ...run.inline, ...(defaultSize && !run.inline.fontSize ? { fontSize: defaultSize } : {}), link: links[0]?.attrs?.href || null } };
  });
}
function returnRuns(p, defaultSize) {
  return p.formattedRuns.map(run => {
    if (run.invalidSupportedValue || run.unsupportedNames?.length) throw Error('unsupported-run');
    const style = { ...run.inlineState, link: run.inlineState?.link || null };
    delete style.wordBookmarkName;
    if (defaultSize && !style.fontSize) style.fontSize = defaultSize;
    return { from: run.from, to: run.to, text: run.text, style };
  });
}
function compareRuns(before, after, text) {
  if (before.map(r => r.text).join('') !== text || after.map(r => r.text).join('') !== text) throw Error('text-change');
  const cuts = [...new Set([0, text.length, ...before.flatMap(r => [r.from, r.to]), ...after.flatMap(r => [r.from, r.to])])].sort((a, b) => a - b);
  if (cuts[0] !== 0 || cuts.at(-1) !== text.length) throw Error('run-bounds');
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = before.filter(r => r.from <= cuts[i] && r.to >= cuts[i + 1]);
    const b = after.filter(r => r.from <= cuts[i] && r.to >= cuts[i + 1]);
    if (a.length !== 1 || b.length !== 1 || !same(a[0].style, b[0].style)) throw Error('nonmedia-style-or-link-change');
  }
}

// Pure analysis of already bounded parser output. Authentication and current
// source acquisition remain Main's responsibility; this result grants no write.
export function analyzeMediaReturn({ beforeDocs, exportMap, reviewIr, binaryParts }) {
  try {
    const scenes = exportMap?.scenes, ps = reviewIr?.formattingParagraphs;
    if (!Array.isArray(scenes) || !scenes.length || new Set(scenes.map(s => s.sceneId)).size !== scenes.length
      || !Array.isArray(ps) || ps.length > 4096) return reject('source-shape');
    const blocks = scenes.flatMap(s => s.blocks || []);
    if (blocks.length !== ps.length) return reject('paragraph-cardinality');
    if (['textRevisions', 'moveRevisions', 'propertyRevisions'].some(k => reviewIr[k]?.length)
      || reviewIr.structureChanges?.some(x => x.writerAuthorityImpact !== 'inventory-only')) return reject('tracked-or-structural-change');
    const placements = reviewIr.documentMedia?.placements || [];
    if (reviewIr.documentMedia && reviewIr.documentMedia.schemaVersion !== 'yalken.word.media-return.v1') return reject('media-shape');
    const drawings = (reviewIr.opaqueUnsupported || []).filter(x => x.elementName === 'drawing');
    const seen = new Set(), fields = new Set();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i], p = ps[i], names = (b.wordSignals || []).filter(x => x.kind === 'bookmarkName').map(x => x.value?.name);
      if (b.documentParagraphIndex !== i || p.paragraphIndex !== i || names.length !== 1
        || !/^YRTK_[a-f0-9]{32}$/u.test(names[0]) || seen.has(names[0])
        || (p.bookmarkNames || []).filter(n => n === names[0]).length !== 1
        || ps.filter(p => (p.bookmarkNames || []).includes(names[0])).length !== 1) return reject('paragraph-owner');
      seen.add(names[0]);
      for (const proof of p.inertHyperlinkInstructions || []) {
        const k = key(proof);
        if (!k || fields.has(k) || !p.formattedRuns.some(r => r.inlineState?.link === proof.href)) return reject('field-binding');
        fields.add(k);
      }
    }
    const drawingKeys = placements.map(x => key(x.sourceXmlProvenance));
    if (drawingKeys.some(k => !k) || new Set(drawingKeys).size !== placements.length
      || !same(drawingKeys.slice().sort(), drawings.map(x => key(x.sourceXmlProvenance)).sort())) return reject('drawing-inventory');
    const technical = exportMap.userBookmarkTechnicalParts;
    for (const item of reviewIr.opaqueUnsupported || []) {
      if (item.writerAuthorityImpact === 'inventory-only' || drawings.includes(item)) continue;
      const k = key(item.sourceXmlProvenance);
      if (item.kind === 'unsupported-element' && item.elementName === 'instrText' && fields.has(k)) { fields.delete(k); continue; }
      const expected = technical?.parts?.filter(p => p.partName === item.partName) || [];
      if (item.kind !== 'unknown-part' || item.typedDiagnostic !== 'RTK_OPAQUE_UNSUPPORTED_PART'
        || !['customXml/item1.xml', 'customXml/itemProps1.xml'].includes(item.partName)
        || technical?.schemaVersion !== 'yalken.word-user-bookmark-technical-parts.v1'
        || expected.length !== 1 || expected[0].partSha256 !== item.partSha256
        || expected[0].contentType !== item.contentType || !same(technical.relationships, reviewIr.technicalPartRelationships)) return reject('unsupported-content');
    }
    if (fields.size) return reject('field-inventory');
    let defaultSize = null;
    if (exportMap.exportTypography !== undefined) {
      if (!same(exportMap.exportTypography, { schemaVersion: 'yalken.review-docx.typography-defaults.v1', fontSize: '12pt' })) return reject('typography');
      defaultSize = '12pt';
    }
    const changes = [], expectedBookmarks = [], expectedLinks = [];
    for (const scene of scenes) {
      const beforeDoc = beforeDocs?.[scene.sceneId], basePs = bookmarks.paragraphs(beforeDoc);
      const baseFormats = source.buildFormatIrParagraphs({ sceneId: scene.sceneId, doc: beforeDoc, text: basePs.map(bookmarks.textOf).join('\n') });
      if (basePs.length !== scene.blocks.length) return reject('scene-topology');
      const offset = scene.blocks[0].documentParagraphIndex;
      const registry = bookmarks.readRegistry(beforeDoc);
      for (const record of registry?.bookmarks || []) if (record.state === 'active') {
        expectedBookmarks.push({ name: record.name,
          start: { ...record.start, paragraphIndex: record.start.paragraphIndex + offset },
          end: { ...record.end, paragraphIndex: record.end.paragraphIndex + offset } });
      }
      basePs.forEach((p, paragraphIndex) => {
        let from = 0;
        for (const node of p.content || []) {
          const length = node.type === 'text' ? node.text.length : node.type === 'hardBreak' ? 1 : 0;
          const link = (node.marks || []).find(m => m.type === 'link' && m.attrs?.wordBookmarkId);
          if (link) expectedLinks.push({ name: link.attrs.wordBookmarkName, paragraphIndex: paragraphIndex + offset, from, to: from + length });
          from += length;
        }
      });
      for (let i = 0; i < basePs.length; i++) {
        const b = scene.blocks[i], p = ps[offset + i], format = b.formatIr, paragraph = format.paragraph;
        if (b.documentParagraphIndex !== offset + i || !same(format, baseFormats[i].formatIr)
          || b.canonicalTextSha256 !== `sha256:${sha256Hex(baseFormats[i].text)}`) return reject('private-source-binding');
        if (p.trackedRevision || p.table || format.table || p.paragraphFormattingInvalid || p.unsupportedParagraphNames?.length
          || !['paragraph', 'heading'].includes(paragraph.nodeType)
          || Object.keys(paragraph).some(k => !['nodeType', 'headingLevel', 'textAlign'].includes(k))
          || (paragraph.textAlign || 'left') !== (p.paragraphState?.textAlign || 'left')
          || paragraph.nodeType !== (p.paragraphStructure?.nodeType || 'paragraph')
          || (paragraph.headingLevel ?? null) !== (p.paragraphStructure?.headingLevel ?? null)) return reject('paragraph-change');
        compareRuns(baseRuns(b, defaultSize), returnRuns(p, defaultSize), p.paragraphText);
      }
      const rows = placements.filter(p => p.paragraphIndex >= offset && p.paragraphIndex < offset + basePs.length).map(p => {
        const bytes = binaryParts?.[p.partName];
        if (!bytes || !Buffer.isBuffer(bytes)) throw Error('media-bytes-required');
        const attrs = media.createImageAttrs(bytes, { alt: p.alt, displayName: p.displayName, displayWidthEmu: p.cx, displayHeightEmu: p.cy,
          displayEffectExtent: p.effectExtent });
        if (attrs.sha256 !== p.sha256 || attrs.width !== p.width || attrs.height !== p.height || attrs.mimeType !== p.mimeType) throw Error('media-byte-binding');
        return { paragraphIndex: p.paragraphIndex - offset, offset: p.offset, attrs };
      });
      const plan = model.planMediaReturn({ beforeDoc, placements: rows });
      if (plan.changed) changes.push({ sceneId: scene.sceneId, beforeDoc, plan });
    }
    const inventory = reviewIr.userBookmarkInventory;
    if (!inventory || inventory.schemaVersion !== 'yalken.word-user-bookmark-inventory.v1' || inventory.unresolvedEndpoints?.length) return reject('bookmark-inventory');
    const names = rows => rows.map(({ name, start, end }) => ({ name, start, end })).sort((a, b) => a.name.localeCompare(b.name));
    const links = rows => {
      const out = [];
      for (const { name, paragraphIndex, from, to } of rows) {
        const last = out.at(-1);
        if (last && last.name === name && last.paragraphIndex === paragraphIndex && last.to === from) last.to = to;
        else out.push({ name, paragraphIndex, from, to });
      }
      return out;
    };
    if (!same(names(expectedBookmarks), names(inventory.bookmarks || [])) || !same(links(expectedLinks), links(inventory.links || []))) return reject('bookmark-or-internal-link-change');
    if (placements.some(p => !Number.isSafeInteger(p.paragraphIndex) || p.paragraphIndex < 0 || p.paragraphIndex >= blocks.length)) return reject('placement-owner');
    if (changes.length > 1) return reject('multiple-changed-scenes');
    return { ok: true, analysisOnly: true, canWriteManuscript: false, changed: changes.length === 1, candidate: changes[0] || null };
  } catch (error) { return reject(error.code || error.message); }
}

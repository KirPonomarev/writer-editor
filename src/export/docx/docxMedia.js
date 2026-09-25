'use strict';
const { documentMedia, validateImageAttrs, imageDisplaySize } = require('../../io/documentMedia.js');
const { escapeXml } = require('./docxTextXml.js');
const attribute = value => escapeXml(value).replaceAll('\n', '&#10;').replaceAll('\r', '&#13;').replaceAll('\t', '&#9;');

// Pure package construction. The caller supplies a validated, revision-bound
// document; these relationships are document-local identifiers, never paths
// accepted from renderer or imported relationship targets.
function buildMediaPackage(doc) {
  const graph = documentMedia(doc);
  const byId = new Map(graph.assets.map((asset, index) => [asset.attrs.assetId, { ...asset, relationshipId: `yalkenMedia${index + 1}` }]));
  let placementId = 0;
  return {
    parts: [...byId.values()].map(a => ({ name: `word/media/${a.attrs.sha256}.png`, data: a.bytes })),
    contentTypes: byId.size ? '<Default Extension="png" ContentType="image/png"/>' : '',
    relationships: [...byId.values()].map(a => `<Relationship Id="${a.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${a.attrs.sha256}.png"/>`).join(''),
    drawing(attrs) {
      const validated = validateImageAttrs(attrs).attrs, asset = byId.get(validated.assetId);
      if (!asset) throw Error('DOCX_MEDIA_UNBOUND_ASSET');
      const id = ++placementId, { cx, cy } = imageDisplaySize(validated);
      const name = attribute(validated.displayName), alt = attribute(validated.alt);
      return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${name}" descr="${alt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${asset.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    },
  };
}
module.exports = { buildMediaPackage };

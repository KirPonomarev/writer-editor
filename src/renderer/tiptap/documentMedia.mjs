import { Node } from '@tiptap/core';

const fields = ['assetId', 'assetPath', 'sha256', 'mimeType', 'width', 'height', 'alt', 'displayName', 'dataBase64'];
// Render a main-owned document projection. No filesystem lookup or remote URI
// is ever accepted here. Binary validation and asset identity belong to Core.
export function mediaImageDom(attrs = {}) {
  const safe = ['image/png', 'image/jpeg'].includes(attrs.mimeType) && typeof attrs.dataBase64 === 'string'
    && attrs.dataBase64.length > 0 && attrs.dataBase64.length <= 5592408
    && attrs.dataBase64.length % 4 === 0 && !/[^A-Za-z0-9+/=]/u.test(attrs.dataBase64)
    && Number.isSafeInteger(attrs.width) && attrs.width > 0 && attrs.width <= 8192
    && Number.isSafeInteger(attrs.height) && attrs.height > 0 && attrs.height <= 8192
    && attrs.width * attrs.height <= 16777216;
  const legacy = attrs.displayWidthEmu === undefined && attrs.displayHeightEmu === undefined;
  const sizeSafe = legacy || [attrs.displayWidthEmu, attrs.displayHeightEmu].every(n => Number.isSafeInteger(n) && n > 0 && n <= 78028800);
  const effect = attrs.displayEffectExtent;
  const effectSafe = effect === undefined || (effect && !Array.isArray(effect)
    && Object.keys(effect).sort().join(',') === 'b,l,r,t'
    && Object.values(effect).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 78028800)
    && (legacy ? attrs.width * 9525 : attrs.displayWidthEmu) + effect.l + effect.r <= 78028800
    && (legacy ? attrs.height * 9525 : attrs.displayHeightEmu) + effect.t + effect.b <= 78028800);
  if (!safe || !sizeSafe || !effectSafe || (attrs.wordUseLocalDpi !== undefined && typeof attrs.wordUseLocalDpi !== 'boolean')) return ['span', { role: 'img', 'aria-label': 'Изображение недоступно', 'data-media-unavailable': 'true' }, 'Изображение недоступно'];
  return ['img', {
    src: `data:${attrs.mimeType};base64,${attrs.dataBase64}`,
    alt: typeof attrs.alt === 'string' ? attrs.alt : '',
    title: typeof attrs.displayName === 'string' ? attrs.displayName : '',
    width: attrs.width, height: attrs.height,
    style: (legacy ? 'max-width:100%;height:auto' : `width:${attrs.displayWidthEmu / 9525}px;max-width:100%;height:auto;aspect-ratio:${attrs.displayWidthEmu}/${attrs.displayHeightEmu};object-fit:fill`) + (effect ? `;margin:${effect.t / 9525}px ${effect.r / 9525}px ${effect.b / 9525}px ${effect.l / 9525}px` : ''),
    'data-yalken-owned-image': 'true',
  }];
}
export const DocumentMedia = Node.create({
  name: 'image', inline: true, group: 'inline', atom: true,
  selectable: true, draggable: false,
  addAttributes() { return { ...Object.fromEntries(fields.map(name => [name, { default: null, rendered: false }])),
    wordUseLocalDpi: { default: undefined, rendered: false },
    displayEffectExtent: { default: undefined, rendered: false },
    displayWidthEmu: { default: undefined, rendered: false }, displayHeightEmu: { default: undefined, rendered: false } }; },
  // External HTML cannot invent project media. The typed DOCX intake supplies
  // the canonical JSON node; the existing plain-text paste policy is retained.
  parseHTML() { return []; },
  renderHTML({ node }) { return mediaImageDom(node.attrs); },
});

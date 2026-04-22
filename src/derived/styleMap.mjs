const STYLE_MAP_SCHEMA_VERSION = 'derived.styleMap.v1';

const SEMANTIC_STYLE_KEYS = Object.freeze({
  DEFAULT: 'semantic.default',
  PARAGRAPH: 'semantic.paragraph',
  HEADING: 'semantic.heading',
  SCENE_HEADING: 'semantic.sceneHeading',
  PAGE_BREAK: 'semantic.pageBreak',
  LIST_ITEM: 'semantic.listItem',
  QUOTE: 'semantic.quote',
  CODE_BLOCK: 'semantic.codeBlock',
  UNKNOWN: 'semantic.unknown',
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKind(value) {
  const kind = normalizeString(value).toLowerCase();
  if (!kind) return 'paragraph';
  if (kind === 'page-break' || kind === 'pagebreak' || kind === 'page_break') return 'pageBreak';
  if (kind === 'scene-heading' || kind === 'sceneheading' || kind === 'scene_heading') return 'sceneHeading';
  if (kind === 'list-item' || kind === 'listitem' || kind === 'list_item') return 'listItem';
  if (kind === 'code-block' || kind === 'codeblock' || kind === 'code_block') return 'codeBlock';
  return kind;
}

function normalizeStyleDescriptor(key, value) {
  const descriptor = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  descriptor.key = key;
  if (!descriptor.role) descriptor.role = key;
  if (typeof descriptor.pageBreakBefore !== 'boolean') descriptor.pageBreakBefore = key === SEMANTIC_STYLE_KEYS.PAGE_BREAK;
  if (typeof descriptor.pageBreakAfter !== 'boolean') descriptor.pageBreakAfter = false;
  if (typeof descriptor.exportNeutral !== 'boolean') descriptor.exportNeutral = true;
  return Object.freeze(descriptor);
}

function defaultResolveStyleKey(kind) {
  switch (normalizeKind(kind)) {
    case 'heading':
      return SEMANTIC_STYLE_KEYS.HEADING;
    case 'sceneHeading':
      return SEMANTIC_STYLE_KEYS.SCENE_HEADING;
    case 'pageBreak':
      return SEMANTIC_STYLE_KEYS.PAGE_BREAK;
    case 'listItem':
      return SEMANTIC_STYLE_KEYS.LIST_ITEM;
    case 'quote':
      return SEMANTIC_STYLE_KEYS.QUOTE;
    case 'codeBlock':
      return SEMANTIC_STYLE_KEYS.CODE_BLOCK;
    case 'paragraph':
      return SEMANTIC_STYLE_KEYS.PARAGRAPH;
    default:
      return SEMANTIC_STYLE_KEYS.UNKNOWN;
  }
}

function normalizeOverrides(overrides) {
  const styles = {};
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    for (const [key, value] of Object.entries(overrides)) {
      const normalizedKey = normalizeString(key);
      if (!normalizedKey) continue;
      styles[normalizedKey] = normalizeStyleDescriptor(normalizedKey, value);
    }
  }
  return styles;
}

export function createStyleMap(overrides = {}) {
  const styles = normalizeOverrides(overrides.styles);
  for (const [key, value] of Object.entries(SEMANTIC_STYLE_KEYS)) {
    if (!styles[value]) {
      styles[value] = normalizeStyleDescriptor(value, {
        role: key.toLowerCase(),
        pageBreakBefore: value === SEMANTIC_STYLE_KEYS.PAGE_BREAK,
      });
    }
  }

  const defaultStyleKey = normalizeString(overrides.defaultStyleKey) || SEMANTIC_STYLE_KEYS.DEFAULT;
  if (!styles[defaultStyleKey]) {
    styles[defaultStyleKey] = normalizeStyleDescriptor(defaultStyleKey, {
      role: 'default',
      exportNeutral: true,
    });
  }

  function resolveStyle(entryOrKind) {
    const kind = typeof entryOrKind === 'string'
      ? entryOrKind
      : entryOrKind && typeof entryOrKind === 'object'
        ? entryOrKind.kind || entryOrKind.semanticKind
        : '';
    const styleKey = defaultResolveStyleKey(kind);
    const descriptor = styles[styleKey] || styles[defaultStyleKey];
    return {
      key: descriptor.key,
      role: descriptor.role,
      pageBreakBefore: descriptor.pageBreakBefore,
      pageBreakAfter: descriptor.pageBreakAfter,
      exportNeutral: descriptor.exportNeutral,
    };
  }

  return Object.freeze({
    schemaVersion: STYLE_MAP_SCHEMA_VERSION,
    defaultStyleKey,
    styles: Object.freeze({ ...styles }),
    resolve: resolveStyle,
  });
}

export { SEMANTIC_STYLE_KEYS, STYLE_MAP_SCHEMA_VERSION };

function freezeLabels(labels) {
  const ru = Object.freeze({
    panelLabel: labels.ru.panelLabel,
    shortLabel: labels.ru.shortLabel,
    ariaLabel: labels.ru.ariaLabel,
  });
  const en = labels.en
    ? Object.freeze({
        panelLabel: labels.en.panelLabel,
        shortLabel: labels.en.shortLabel,
        ariaLabel: labels.en.ariaLabel,
      })
    : null;
  return Object.freeze({ ru, en });
}

function freezeCatalogEntry(entry) {
  return Object.freeze({
    id: entry.id,
    labels: freezeLabels(entry.labels),
    controlKind: entry.controlKind,
    bindKey: entry.bindKey,
    actionAlias: entry.actionAlias,
    commandId: entry.commandId,
    implementationState: entry.implementationState,
    uiGroup: entry.uiGroup,
    blockerReason: entry.blockerReason,
  });
}

function freezeLegacyLexiconEntry(entry) {
  return Object.freeze({
    legacyLabel: entry.legacyLabel,
    itemId: entry.itemId,
  });
}

const TOOLBAR_FUNCTION_CATALOG_ROWS = [
  {
    id: 'toolbar.font.family',
    labels: {
      ru: {
        panelLabel: 'Шрифт',
        shortLabel: 'Шрифт',
        ariaLabel: 'Выбрать шрифт',
      },
      en: {
        panelLabel: 'Font',
        shortLabel: 'Font',
        ariaLabel: 'Choose font',
      },
    },
    controlKind: 'selectControl',
    bindKey: 'font-select',
    actionAlias: null,
    commandId: null,
    implementationState: 'live',
    uiGroup: 'font',
    blockerReason: null,
  },
  {
    id: 'toolbar.font.weight',
    labels: {
      ru: {
        panelLabel: 'Начертание',
        shortLabel: 'Вес',
        ariaLabel: 'Выбрать начертание',
      },
      en: {
        panelLabel: 'Weight',
        shortLabel: 'Weight',
        ariaLabel: 'Choose font weight',
      },
    },
    controlKind: 'selectControl',
    bindKey: 'weight-select',
    actionAlias: null,
    commandId: null,
    implementationState: 'live',
    uiGroup: 'font',
    blockerReason: null,
  },
  {
    id: 'toolbar.font.size',
    labels: {
      ru: {
        panelLabel: 'Размер',
        shortLabel: 'Размер',
        ariaLabel: 'Выбрать размер шрифта',
      },
      en: {
        panelLabel: 'Size',
        shortLabel: 'Size',
        ariaLabel: 'Choose font size',
      },
    },
    controlKind: 'selectControl',
    bindKey: 'size-select',
    actionAlias: null,
    commandId: null,
    implementationState: 'live',
    uiGroup: 'font',
    blockerReason: null,
  },
  {
    id: 'toolbar.text.lineHeight',
    labels: {
      ru: {
        panelLabel: 'Интерлиньяж',
        shortLabel: 'Интерлиньяж',
        ariaLabel: 'Выбрать межстрочный интервал',
      },
      en: {
        panelLabel: 'Line height',
        shortLabel: 'Line height',
        ariaLabel: 'Choose line height',
      },
    },
    controlKind: 'selectControl',
    bindKey: 'line-height-select',
    actionAlias: null,
    commandId: null,
    implementationState: 'live',
    uiGroup: 'text',
    blockerReason: null,
  },
  {
    id: 'toolbar.paragraph.alignment',
    labels: {
      ru: {
        panelLabel: 'Абзац',
        shortLabel: 'Абзац',
        ariaLabel: 'Открыть настройки абзаца',
      },
      en: {
        panelLabel: 'Paragraph',
        shortLabel: 'Paragraph',
        ariaLabel: 'Open paragraph controls',
      },
    },
    controlKind: 'menuTrigger',
    bindKey: 'paragraph-trigger',
    actionAlias: 'toggle-paragraph-menu',
    commandId: null,
    implementationState: 'live',
    uiGroup: 'paragraph',
    blockerReason: null,
  },
  {
    id: 'toolbar.history.undo',
    labels: {
      ru: {
        panelLabel: 'Отменить',
        shortLabel: 'Undo',
        ariaLabel: 'Отменить действие',
      },
      en: {
        panelLabel: 'Undo',
        shortLabel: 'Undo',
        ariaLabel: 'Undo action',
      },
    },
    controlKind: 'actionButton',
    bindKey: 'history-undo',
    actionAlias: 'undo',
    commandId: 'cmd.project.edit.undo',
    implementationState: 'live',
    uiGroup: 'history',
    blockerReason: null,
  },
  {
    id: 'toolbar.history.redo',
    labels: {
      ru: {
        panelLabel: 'Повторить',
        shortLabel: 'Redo',
        ariaLabel: 'Повторить действие',
      },
      en: {
        panelLabel: 'Redo',
        shortLabel: 'Redo',
        ariaLabel: 'Redo action',
      },
    },
    controlKind: 'actionButton',
    bindKey: 'history-redo',
    actionAlias: 'redo',
    commandId: 'cmd.project.edit.redo',
    implementationState: 'live',
    uiGroup: 'history',
    blockerReason: null,
  },
  {
    id: 'toolbar.format.bold',
    labels: {
      ru: {
        panelLabel: 'Жирный',
        shortLabel: 'B',
        ariaLabel: 'Жирный',
      },
      en: {
        panelLabel: 'Bold',
        shortLabel: 'B',
        ariaLabel: 'Bold',
      },
    },
    controlKind: 'toggleButton',
    bindKey: 'format-bold',
    actionAlias: null,
    commandId: 'cmd.project.format.toggleBold',
    implementationState: 'live',
    uiGroup: 'format-inline',
    blockerReason: null,
  },
  {
    id: 'toolbar.format.italic',
    labels: {
      ru: {
        panelLabel: 'Курсив',
        shortLabel: 'I',
        ariaLabel: 'Курсив',
      },
      en: {
        panelLabel: 'Italic',
        shortLabel: 'I',
        ariaLabel: 'Italic',
      },
    },
    controlKind: 'toggleButton',
    bindKey: 'format-italic',
    actionAlias: null,
    commandId: 'cmd.project.format.toggleItalic',
    implementationState: 'live',
    uiGroup: 'format-inline',
    blockerReason: null,
  },
  {
    id: 'toolbar.format.underline',
    labels: {
      ru: {
        panelLabel: 'Подчеркнуть',
        shortLabel: 'U',
        ariaLabel: 'Подчеркнуть',
      },
      en: {
        panelLabel: 'Underline',
        shortLabel: 'U',
        ariaLabel: 'Underline',
      },
    },
    controlKind: 'toggleButton',
    bindKey: 'format-underline',
    actionAlias: null,
    commandId: 'cmd.project.format.toggleUnderline',
    implementationState: 'live',
    uiGroup: 'format-inline',
    blockerReason: null,
  },
  {
    id: 'toolbar.list.type',
    labels: {
      ru: {
        panelLabel: 'Список',
        shortLabel: 'Список',
        ariaLabel: 'Выбрать тип списка',
      },
      en: {
        panelLabel: 'List',
        shortLabel: 'List',
        ariaLabel: 'Choose list type',
      },
    },
    controlKind: 'menuTrigger',
    bindKey: 'list-type',
    actionAlias: 'toggle-list-menu',
    commandId: null,
    implementationState: 'live',
    uiGroup: 'paragraph',
    blockerReason: null,
  },
  {
    id: 'toolbar.insert.link',
    labels: {
      ru: {
        panelLabel: 'Ссылка',
        shortLabel: 'Ссылка',
        ariaLabel: 'Вставить ссылку',
      },
      en: {
        panelLabel: 'Link',
        shortLabel: 'Link',
        ariaLabel: 'Insert link',
      },
    },
    controlKind: 'dialogTrigger',
    bindKey: 'insert-link',
    actionAlias: null,
    commandId: 'cmd.project.insert.linkPrompt',
    implementationState: 'live',
    uiGroup: 'insert',
    blockerReason: null,
  },
  {
    id: 'toolbar.color.text',
    labels: {
      ru: {
        panelLabel: 'Цвет текста',
        shortLabel: 'Текст',
        ariaLabel: 'Выбрать цвет текста',
      },
      en: {
        panelLabel: 'Text color',
        shortLabel: 'Text',
        ariaLabel: 'Choose text color',
      },
    },
    controlKind: 'pickerTrigger',
    bindKey: 'color-text',
    actionAlias: null,
    commandId: 'cmd.project.format.textColorPicker',
    implementationState: 'live',
    uiGroup: 'color',
    blockerReason: null,
  },
  {
    id: 'toolbar.color.highlight',
    labels: {
      ru: {
        panelLabel: 'Выделение',
        shortLabel: 'Highlight',
        ariaLabel: 'Выбрать цвет выделения',
      },
      en: {
        panelLabel: 'Highlight',
        shortLabel: 'Highlight',
        ariaLabel: 'Choose highlight color',
      },
    },
    controlKind: 'pickerTrigger',
    bindKey: 'color-highlight',
    actionAlias: null,
    commandId: 'cmd.project.format.highlightColorPicker',
    implementationState: 'live',
    uiGroup: 'color',
    blockerReason: null,
  },
  {
    id: 'toolbar.review.comment',
    labels: {
      ru: {
        panelLabel: 'Комментарий',
        shortLabel: 'Комментарий',
        ariaLabel: 'Открыть комментарий',
      },
      en: {
        panelLabel: 'Comment',
        shortLabel: 'Comment',
        ariaLabel: 'Open comment',
      },
    },
    controlKind: 'actionButton',
    bindKey: 'review-comment',
    actionAlias: null,
    commandId: 'cmd.project.review.openComments',
    implementationState: 'live',
    uiGroup: 'review',
    blockerReason: null,
  },
  {
    id: 'toolbar.style.paragraph',
    labels: {
      ru: {
        panelLabel: 'Стиль абзаца',
        shortLabel: 'Абзац',
        ariaLabel: 'Выбрать стиль абзаца',
      },
      en: {
        panelLabel: 'Paragraph style',
        shortLabel: 'Paragraph',
        ariaLabel: 'Choose paragraph style',
      },
    },
    controlKind: 'menuTrigger',
    bindKey: 'style-paragraph',
    actionAlias: 'toggle-style-paragraph-menu',
    commandId: null,
    implementationState: 'live',
    uiGroup: 'styles',
    blockerReason: null,
  },
  {
    id: 'toolbar.style.character',
    labels: {
      ru: {
        panelLabel: 'Стиль символов',
        shortLabel: 'Символ',
        ariaLabel: 'Выбрать стиль символов',
      },
      en: {
        panelLabel: 'Character style',
        shortLabel: 'Character',
        ariaLabel: 'Choose character style',
      },
    },
    controlKind: 'menuTrigger',
    bindKey: 'style-character',
    actionAlias: 'toggle-style-character-menu',
    commandId: null,
    implementationState: 'live',
    uiGroup: 'styles',
    blockerReason: null,
  },
  {
    id: 'toolbar.insert.image',
    labels: {
      ru: {
        panelLabel: 'Изображение',
        shortLabel: 'Изображение',
        ariaLabel: 'Вставить изображение',
      },
      en: {
        panelLabel: 'Image',
        shortLabel: 'Image',
        ariaLabel: 'Insert image',
      },
    },
    controlKind: 'dialogTrigger',
    bindKey: 'insert-image',
    actionAlias: null,
    commandId: null,
    implementationState: 'blocked',
    uiGroup: 'insert',
    blockerReason: 'offline-first image asset pipeline not selected',
  },
  {
    id: 'toolbar.proofing.spellcheck',
    labels: {
      ru: {
        panelLabel: 'Орфография',
        shortLabel: 'Орфография',
        ariaLabel: 'Проверка орфографии',
      },
      en: {
        panelLabel: 'Spellcheck',
        shortLabel: 'Spellcheck',
        ariaLabel: 'Spellcheck',
      },
    },
    controlKind: 'toggleButton',
    bindKey: 'proofing-spellcheck',
    actionAlias: null,
    commandId: null,
    implementationState: 'blocked',
    uiGroup: 'proofing',
    blockerReason: 'offline-first spellcheck dictionary policy not selected',
  },
  {
    id: 'toolbar.proofing.grammar',
    labels: {
      ru: {
        panelLabel: 'Грамматика',
        shortLabel: 'Грамматика',
        ariaLabel: 'Проверка грамматики',
      },
      en: {
        panelLabel: 'Grammar',
        shortLabel: 'Grammar',
        ariaLabel: 'Grammar check',
      },
    },
    controlKind: 'toggleButton',
    bindKey: 'proofing-grammar',
    actionAlias: null,
    commandId: null,
    implementationState: 'blocked',
    uiGroup: 'proofing',
    blockerReason: 'offline-first grammar engine not selected',
  },
];

const TOOLBAR_LEGACY_MIGRATION_ROWS = [
  { legacyLabel: 'Font Family', itemId: 'toolbar.font.family' },
  { legacyLabel: 'Font Weight', itemId: 'toolbar.font.weight' },
  { legacyLabel: 'Font Size', itemId: 'toolbar.font.size' },
  { legacyLabel: 'Line Height', itemId: 'toolbar.text.lineHeight' },
  { legacyLabel: 'Paragraph Alignment', itemId: 'toolbar.paragraph.alignment' },
  { legacyLabel: 'Undo', itemId: 'toolbar.history.undo' },
  { legacyLabel: 'Redo', itemId: 'toolbar.history.redo' },
];

const TOOLBAR_LEGACY_DROP_LABELS_LIST = Object.freeze([
  'Color Background',
  'No Background',
  'Black & White',
  'New Slot',
]);

export const TOOLBAR_FUNCTION_CATALOG = Object.freeze(TOOLBAR_FUNCTION_CATALOG_ROWS.map(freezeCatalogEntry));

export const TOOLBAR_DEFAULT_MINIMAL_IDS = Object.freeze([
  'toolbar.font.family',
  'toolbar.font.weight',
  'toolbar.font.size',
  'toolbar.text.lineHeight',
  'toolbar.paragraph.alignment',
  'toolbar.history.undo',
  'toolbar.history.redo',
]);

const TOOLBAR_CANONICAL_LIVE_ORDER_IDS = Object.freeze([
  'toolbar.font.family',
  'toolbar.font.weight',
  'toolbar.font.size',
  'toolbar.text.lineHeight',
  'toolbar.format.bold',
  'toolbar.format.italic',
  'toolbar.format.underline',
  'toolbar.paragraph.alignment',
  'toolbar.list.type',
  'toolbar.insert.link',
  'toolbar.color.text',
  'toolbar.color.highlight',
  'toolbar.review.comment',
  'toolbar.style.paragraph',
  'toolbar.style.character',
  'toolbar.history.undo',
  'toolbar.history.redo',
]);

export const TOOLBAR_CANONICAL_LIVE_ORDER = Object.freeze(
  TOOLBAR_CANONICAL_LIVE_ORDER_IDS.filter((itemId) => {
    const entry = TOOLBAR_FUNCTION_CATALOG.find((catalogEntry) => catalogEntry.id === itemId);
    return entry?.implementationState === 'live';
  }),
);

export const TOOLBAR_LIVE_IDS = Object.freeze([...TOOLBAR_CANONICAL_LIVE_ORDER]);

export const TOOLBAR_PLANNED_IDS = Object.freeze(
  TOOLBAR_FUNCTION_CATALOG
    .filter((entry) => entry.implementationState === 'planned')
    .map((entry) => entry.id),
);

export const TOOLBAR_BLOCKED_IDS = Object.freeze(
  TOOLBAR_FUNCTION_CATALOG
    .filter((entry) => entry.implementationState === 'blocked')
    .map((entry) => entry.id),
);

export const TOOLBAR_LEGACY_MIGRATION_LEXICON = Object.freeze(
  TOOLBAR_LEGACY_MIGRATION_ROWS.map(freezeLegacyLexiconEntry),
);

export const TOOLBAR_LEGACY_DROP_LABELS = TOOLBAR_LEGACY_DROP_LABELS_LIST;

const TOOLBAR_FUNCTION_CATALOG_BY_ID = new Map(TOOLBAR_FUNCTION_CATALOG.map((entry) => [entry.id, entry]));
const TOOLBAR_FUNCTION_CATALOG_BY_STATE = new Map([
  ['live', TOOLBAR_CANONICAL_LIVE_ORDER.map((itemId) => TOOLBAR_FUNCTION_CATALOG_BY_ID.get(itemId)).filter(Boolean)],
  ['planned', TOOLBAR_FUNCTION_CATALOG.filter((entry) => entry.implementationState === 'planned')],
  ['blocked', TOOLBAR_FUNCTION_CATALOG.filter((entry) => entry.implementationState === 'blocked')],
]);
const TOOLBAR_LEGACY_MIGRATION_BY_LABEL = new Map(
  TOOLBAR_LEGACY_MIGRATION_LEXICON.map((entry) => [entry.legacyLabel, entry.itemId]),
);

export function listToolbarFunctionCatalogEntries() {
  return TOOLBAR_FUNCTION_CATALOG.map((entry) => entry);
}

export function getToolbarFunctionCatalogEntryById(id) {
  if (typeof id !== 'string') return null;
  return TOOLBAR_FUNCTION_CATALOG_BY_ID.get(id) || null;
}

export function listToolbarFunctionCatalogEntriesByImplementationState(state) {
  const normalizedState = typeof state === 'string' ? state.trim() : '';
  if (!normalizedState) {
    return listToolbarFunctionCatalogEntries();
  }
  const entries = TOOLBAR_FUNCTION_CATALOG_BY_STATE.get(normalizedState);
  return entries ? [...entries] : [];
}

export function listLiveToolbarFunctionCatalogEntries() {
  return listToolbarFunctionCatalogEntriesByImplementationState('live');
}

export function resolveLegacyToolbarFunctionItemId(legacyLabel) {
  if (typeof legacyLabel !== 'string') return null;
  return TOOLBAR_LEGACY_MIGRATION_BY_LABEL.get(legacyLabel) || null;
}

export function isLiveToolbarFunctionId(itemId) {
  return TOOLBAR_CANONICAL_LIVE_ORDER.includes(itemId);
}

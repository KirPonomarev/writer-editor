export const CAPABILITY_BINDING = Object.freeze({
  'project.create': 'cap.core.project.create',
  'project.applyTextEdit': 'cap.core.project.applyTextEdit',
  'cmd.project.new': 'cap.project.new',
  'cmd.project.document.open': 'cap.project.document.open',
  'cmd.project.open': 'cap.project.open',
  'cmd.project.save': 'cap.project.save',
  'cmd.project.saveAs': 'cap.project.saveAs',
  'cmd.project.view.openSettings': 'cap.project.view.openSettings',
  'cmd.project.view.safeReset': 'cap.project.view.safeReset',
  'cmd.project.view.restoreLastStable': 'cap.project.view.restoreLastStable',
  'cmd.project.tools.openDiagnostics': 'cap.project.tools.openDiagnostics',
  'cmd.project.review.openRecovery': 'cap.project.review.openRecovery',
  'cmd.project.plan.switchMode': 'cap.project.plan.switchMode',
  'cmd.project.review.switchMode': 'cap.project.review.switchMode',
  'cmd.project.window.switchModeWrite': 'cap.project.window.switchModeWrite',
  'cmd.project.tree.createNode': 'cap.project.tree.createNode',
  'cmd.project.tree.renameNode': 'cap.project.tree.renameNode',
  'cmd.project.tree.deleteNode': 'cap.project.tree.deleteNode',
  'cmd.project.tree.reorderNode': 'cap.project.tree.reorderNode',
  'cmd.project.edit.undo': 'cap.project.edit.undo',
  'cmd.project.edit.redo': 'cap.project.edit.redo',
  'cmd.project.edit.find': 'cap.project.edit.find',
  'cmd.project.edit.replace': 'cap.project.edit.replace',
  'cmd.project.view.zoomOut': 'cap.project.view.zoomOut',
  'cmd.project.view.zoomIn': 'cap.project.view.zoomIn',
  'cmd.project.view.toggleWrap': 'cap.project.view.toggleWrap',
  'cmd.project.view.previewFormatA4': 'cap.project.view.previewFormatA4',
  'cmd.project.view.previewFormatA5': 'cap.project.view.previewFormatA5',
  'cmd.project.view.previewFormatLetter': 'cap.project.view.previewFormatLetter',
  'cmd.project.view.togglePreview': 'cap.project.view.togglePreview',
  'cmd.project.view.togglePreviewFrame': 'cap.project.view.togglePreviewFrame',
  'cmd.project.insert.markdownPrompt': 'cap.project.insert.markdownPrompt',
  'cmd.project.insert.flowOpen': 'cap.project.insert.flowOpen',
  'cmd.project.insert.addCard': 'cap.project.insert.addCard',
  'cmd.project.format.toggleBold': 'cap.project.format.toggleBold',
  'cmd.project.format.toggleItalic': 'cap.project.format.toggleItalic',
  'cmd.project.format.toggleUnderline': 'cap.project.format.toggleUnderline',
  'cmd.project.format.textColorPicker': 'cap.project.format.textColorPicker',
  'cmd.project.format.highlightColorPicker': 'cap.project.format.highlightColorPicker',
  'cmd.project.format.alignLeft': 'cap.project.format.alignLeft',
  'cmd.project.format.alignCenter': 'cap.project.format.alignCenter',
  'cmd.project.format.alignRight': 'cap.project.format.alignRight',
  'cmd.project.format.alignJustify': 'cap.project.format.alignJustify',
  'cmd.project.list.toggleBullet': 'cap.project.list.toggleBullet',
  'cmd.project.list.toggleOrdered': 'cap.project.list.toggleOrdered',
  'cmd.project.list.clear': 'cap.project.list.clear',
  'cmd.project.insert.linkPrompt': 'cap.project.insert.linkPrompt',
  'cmd.project.review.openComments': 'cap.project.review.openComments',
  'cmd.project.plan.flowSave': 'cap.project.plan.flowSave',
  'cmd.project.review.exportMarkdown': 'cap.project.review.exportMarkdown',
  'cmd.project.export.docxMin': 'cap.project.export.docxMin',
  'cmd.project.importMarkdownV1': 'cap.project.import.markdownV1',
  'cmd.project.exportMarkdownV1': 'cap.project.export.markdownV1',
  'cmd.project.flowOpenV1': 'cap.project.flow.openV1',
  'cmd.project.flowSaveV1': 'cap.project.flow.saveV1',
  'cmd.ui.theme.set': 'cap.ui.theme.set',
  'cmd.ui.font.set': 'cap.ui.font.set',
  'cmd.ui.fontSize.set': 'cap.ui.fontSize.set',
});

export const CAPABILITY_MATRIX = Object.freeze({
  node: Object.freeze({
    'cap.core.project.create': true,
    'cap.core.project.applyTextEdit': true,
    'cap.project.new': true,
    'cap.project.document.open': true,
    'cap.project.open': true,
    'cap.project.save': true,
    'cap.project.saveAs': true,
    'cap.project.view.openSettings': true,
    'cap.project.view.safeReset': true,
    'cap.project.view.restoreLastStable': true,
    'cap.project.tools.openDiagnostics': true,
    'cap.project.review.openRecovery': true,
    'cap.project.plan.switchMode': true,
    'cap.project.review.switchMode': true,
    'cap.project.window.switchModeWrite': true,
    'cap.project.tree.createNode': true,
    'cap.project.tree.renameNode': true,
    'cap.project.tree.deleteNode': true,
    'cap.project.tree.reorderNode': true,
    'cap.project.edit.undo': true,
    'cap.project.edit.redo': true,
    'cap.project.edit.find': true,
    'cap.project.edit.replace': true,
    'cap.project.view.zoomOut': true,
    'cap.project.view.zoomIn': true,
    'cap.project.view.toggleWrap': true,
    'cap.project.view.previewFormatA4': true,
    'cap.project.view.previewFormatA5': true,
    'cap.project.view.previewFormatLetter': true,
    'cap.project.view.togglePreview': true,
    'cap.project.view.togglePreviewFrame': true,
    'cap.project.insert.markdownPrompt': true,
    'cap.project.insert.flowOpen': true,
    'cap.project.insert.addCard': true,
    'cap.project.format.toggleBold': true,
    'cap.project.format.toggleItalic': true,
    'cap.project.format.toggleUnderline': true,
    'cap.project.format.textColorPicker': true,
    'cap.project.format.highlightColorPicker': true,
    'cap.project.format.alignLeft': true,
    'cap.project.format.alignCenter': true,
    'cap.project.format.alignRight': true,
    'cap.project.format.alignJustify': true,
    'cap.project.list.toggleBullet': true,
    'cap.project.list.toggleOrdered': true,
    'cap.project.list.clear': true,
    'cap.project.insert.linkPrompt': true,
    'cap.project.review.openComments': true,
    'cap.project.plan.flowSave': true,
    'cap.project.review.exportMarkdown': true,
    'cap.project.export.docxMin': true,
    'cap.project.import.markdownV1': true,
    'cap.project.export.markdownV1': true,
    'cap.project.flow.openV1': true,
    'cap.project.flow.saveV1': true,
    'cap.ui.theme.set': true,
    'cap.ui.font.set': true,
    'cap.ui.fontSize.set': true,
  }),
  web: Object.freeze({
    'cap.core.project.create': true,
    'cap.core.project.applyTextEdit': true,
    'cap.project.new': false,
    'cap.project.document.open': false,
    'cap.project.open': false,
    'cap.project.save': false,
    'cap.project.saveAs': false,
    'cap.project.view.openSettings': false,
    'cap.project.view.safeReset': false,
    'cap.project.view.restoreLastStable': false,
    'cap.project.tools.openDiagnostics': false,
    'cap.project.review.openRecovery': false,
    'cap.project.plan.switchMode': false,
    'cap.project.review.switchMode': false,
    'cap.project.window.switchModeWrite': false,
    'cap.project.tree.createNode': false,
    'cap.project.tree.renameNode': false,
    'cap.project.tree.deleteNode': false,
    'cap.project.tree.reorderNode': false,
    'cap.project.edit.undo': true,
    'cap.project.edit.redo': true,
    'cap.project.edit.find': true,
    'cap.project.edit.replace': true,
    'cap.project.view.zoomOut': true,
    'cap.project.view.zoomIn': true,
    'cap.project.view.toggleWrap': true,
    'cap.project.view.previewFormatA4': true,
    'cap.project.view.previewFormatA5': true,
    'cap.project.view.previewFormatLetter': true,
    'cap.project.view.togglePreview': true,
    'cap.project.view.togglePreviewFrame': true,
    'cap.project.insert.markdownPrompt': false,
    'cap.project.insert.flowOpen': false,
    'cap.project.insert.addCard': true,
    'cap.project.format.toggleBold': true,
    'cap.project.format.toggleItalic': true,
    'cap.project.format.toggleUnderline': true,
    'cap.project.format.textColorPicker': true,
    'cap.project.format.highlightColorPicker': true,
    'cap.project.format.alignLeft': true,
    'cap.project.format.alignCenter': true,
    'cap.project.format.alignRight': true,
    'cap.project.format.alignJustify': true,
    'cap.project.list.toggleBullet': true,
    'cap.project.list.toggleOrdered': true,
    'cap.project.list.clear': true,
    'cap.project.insert.linkPrompt': true,
    'cap.project.review.openComments': true,
    'cap.project.plan.flowSave': false,
    'cap.project.review.exportMarkdown': false,
    'cap.project.export.docxMin': false,
    'cap.project.import.markdownV1': false,
    'cap.project.export.markdownV1': false,
    'cap.project.flow.openV1': false,
    'cap.project.flow.saveV1': false,
    'cap.ui.theme.set': false,
    'cap.ui.font.set': false,
    'cap.ui.fontSize.set': false,
  }),
  'mobile-wrapper': Object.freeze({
    'cap.core.project.create': true,
    'cap.core.project.applyTextEdit': true,
    'cap.project.new': false,
    'cap.project.document.open': false,
    'cap.project.open': false,
    'cap.project.save': false,
    'cap.project.saveAs': false,
    'cap.project.view.openSettings': false,
    'cap.project.view.safeReset': false,
    'cap.project.view.restoreLastStable': false,
    'cap.project.tools.openDiagnostics': false,
    'cap.project.review.openRecovery': false,
    'cap.project.plan.switchMode': false,
    'cap.project.review.switchMode': false,
    'cap.project.window.switchModeWrite': false,
    'cap.project.tree.createNode': false,
    'cap.project.tree.renameNode': false,
    'cap.project.tree.deleteNode': false,
    'cap.project.tree.reorderNode': false,
    'cap.project.edit.undo': true,
    'cap.project.edit.redo': true,
    'cap.project.edit.find': true,
    'cap.project.edit.replace': true,
    'cap.project.view.zoomOut': true,
    'cap.project.view.zoomIn': true,
    'cap.project.view.toggleWrap': true,
    'cap.project.view.previewFormatA4': true,
    'cap.project.view.previewFormatA5': true,
    'cap.project.view.previewFormatLetter': true,
    'cap.project.view.togglePreview': true,
    'cap.project.view.togglePreviewFrame': true,
    'cap.project.insert.markdownPrompt': false,
    'cap.project.insert.flowOpen': false,
    'cap.project.insert.addCard': true,
    'cap.project.format.toggleBold': true,
    'cap.project.format.toggleItalic': true,
    'cap.project.format.toggleUnderline': true,
    'cap.project.format.textColorPicker': true,
    'cap.project.format.highlightColorPicker': true,
    'cap.project.format.alignLeft': true,
    'cap.project.format.alignCenter': true,
    'cap.project.format.alignRight': true,
    'cap.project.format.alignJustify': true,
    'cap.project.list.toggleBullet': true,
    'cap.project.list.toggleOrdered': true,
    'cap.project.list.clear': true,
    'cap.project.insert.linkPrompt': true,
    'cap.project.review.openComments': true,
    'cap.project.plan.flowSave': false,
    'cap.project.review.exportMarkdown': false,
    'cap.project.export.docxMin': false,
    'cap.project.import.markdownV1': false,
    'cap.project.export.markdownV1': false,
    'cap.project.flow.openV1': false,
    'cap.project.flow.saveV1': false,
    'cap.ui.theme.set': false,
    'cap.ui.font.set': false,
    'cap.ui.fontSize.set': false,
  }),
});

function makeCapabilityError(code, op, reason, details) {
  const error = { code, op, reason };
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = details;
  }
  return error;
}

function normalizePlatformId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isDomainCommandId(commandId) {
  return commandId.startsWith('project.') || commandId.startsWith('cmd.project.');
}

const TIPTAP_RICH_COMMAND_IDS = new Set([
  'cmd.project.format.toggleBold',
  'cmd.project.format.toggleItalic',
  'cmd.project.format.toggleUnderline',
  'cmd.project.format.textColorPicker',
  'cmd.project.format.highlightColorPicker',
  'cmd.project.list.toggleBullet',
  'cmd.project.list.toggleOrdered',
  'cmd.project.list.clear',
  'cmd.project.insert.linkPrompt',
]);

function normalizeEditorMode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveEditorMode(input, options) {
  const fromInput = normalizeEditorMode(input && input.editorMode);
  if (fromInput) return fromInput;

  const fromOption = normalizeEditorMode(options && options.editorMode);
  if (fromOption) return fromOption;

  const defaultMode = normalizeEditorMode(options && options.defaultEditorMode);
  if (defaultMode) return defaultMode;

  return '';
}

function resolvePlatformId(input, options) {
  const fromInput = normalizePlatformId(input && input.platformId);
  if (fromInput) return fromInput;

  const fromOption = normalizePlatformId(options && options.platformId);
  if (fromOption) return fromOption;

  const defaultPlatform = normalizePlatformId(options && options.defaultPlatformId);
  if (defaultPlatform) return defaultPlatform;

  const fromEnv = normalizePlatformId(process && process.env ? process.env.CAPABILITY_PLATFORM_ID : '');
  if (fromEnv) return fromEnv;

  return 'node';
}

export function enforceCapabilityForCommand(commandId, input = {}, options = {}) {
  if (typeof commandId !== 'string' || commandId.length === 0) {
    return {
      ok: false,
      error: makeCapabilityError('E_CAPABILITY_ENFORCEMENT_MISSING', 'unknown', 'COMMAND_ID_INVALID'),
    };
  }

  const capabilityId = CAPABILITY_BINDING[commandId];
  if (!capabilityId) {
    if (isDomainCommandId(commandId)) {
      return {
        ok: false,
        error: makeCapabilityError(
          'E_CAPABILITY_ENFORCEMENT_MISSING',
          commandId,
          'CAPABILITY_ENFORCEMENT_MISSING',
          { commandId },
        ),
      };
    }
    return { ok: true };
  }

  const platformId = resolvePlatformId(input, options);
  if (!platformId) {
    return {
      ok: false,
      error: makeCapabilityError(
        'E_PLATFORM_ID_REQUIRED',
        commandId,
        'PLATFORM_ID_REQUIRED',
        { commandId, capabilityId },
      ),
    };
  }

  const platformCapabilities = CAPABILITY_MATRIX[platformId];
  if (!platformCapabilities || typeof platformCapabilities !== 'object') {
    return {
      ok: false,
      error: makeCapabilityError(
        'E_UNSUPPORTED_PLATFORM',
        commandId,
        'UNSUPPORTED_PLATFORM',
        { platformId, capabilityId, commandId },
      ),
    };
  }

  if (!(capabilityId in platformCapabilities)) {
    return {
      ok: false,
      error: makeCapabilityError(
        'E_CAPABILITY_MISSING',
        commandId,
        'CAPABILITY_MISSING',
        { platformId, capabilityId, commandId },
      ),
    };
  }

  if (platformCapabilities[capabilityId] !== true) {
    return {
      ok: false,
      error: makeCapabilityError(
        'E_CAPABILITY_DISABLED_FOR_COMMAND',
        commandId,
        'CAPABILITY_DISABLED_FOR_COMMAND',
        { platformId, capabilityId, commandId },
      ),
    };
  }

  if (TIPTAP_RICH_COMMAND_IDS.has(commandId) && resolveEditorMode(input, options) !== 'tiptap') {
    return {
      ok: false,
      error: makeCapabilityError(
        'E_CAPABILITY_DISABLED_FOR_COMMAND',
        commandId,
        'EDITOR_MODE_UNSUPPORTED',
        { platformId, capabilityId, commandId, editorMode: resolveEditorMode(input, options) || 'unknown' },
      ),
    };
  }

  return { ok: true };
}

function runEditorCommand(editor, commandName) {
  if (!editor || !editor.commands || typeof editor.commands[commandName] !== 'function') {
    return { performed: false, action: commandName, reason: 'EDITOR_COMMAND_UNAVAILABLE' }
  }

  return {
    performed: Boolean(editor.commands[commandName]()),
    action: commandName,
    reason: null,
  }
}

function runFocusedEditorCommand(editor, commandName, payload = undefined) {
  if (!editor || typeof editor.chain !== 'function') {
    return null
  }

  const chain = editor.chain().focus()
  if (!chain || typeof chain[commandName] !== 'function' || typeof chain.run !== 'function') {
    return null
  }

  const nextChain = payload === undefined ? chain[commandName]() : chain[commandName](payload)
  return {
    performed: Boolean(nextChain.run()),
    action: commandName,
    reason: null,
  }
}

function readEditorFormattingState(editor) {
  if (!editor || typeof editor.isActive !== 'function') {
    return {
      bold: false,
      italic: false,
      underline: false,
      linkActive: false,
      bulletList: false,
      orderedList: false,
    }
  }

  return {
    bold: Boolean(editor.isActive('bold')),
    italic: Boolean(editor.isActive('italic')),
    underline: Boolean(editor.isActive('underline')),
    linkActive: Boolean(editor.isActive('link')),
    bulletList: Boolean(editor.isActive('bulletList')),
    orderedList: Boolean(editor.isActive('orderedList')),
  }
}

function runEditorFormatCommand(editor, commandName) {
  if (!editor || !editor.commands) {
    return { performed: false, action: commandName, reason: 'EDITOR_COMMAND_UNAVAILABLE' }
  }

  if (commandName === 'clearList') {
    const state = readEditorFormattingState(editor)
    if (state.bulletList && typeof editor.commands.toggleBulletList === 'function') {
      const focusedResult = runFocusedEditorCommand(editor, 'toggleBulletList')
      if (focusedResult) {
        return {
          performed: focusedResult.performed,
          action: commandName,
          reason: focusedResult.reason,
        }
      }
      return {
        performed: Boolean(editor.commands.toggleBulletList()),
        action: commandName,
        reason: null,
      }
    }
    if (state.orderedList && typeof editor.commands.toggleOrderedList === 'function') {
      const focusedResult = runFocusedEditorCommand(editor, 'toggleOrderedList')
      if (focusedResult) {
        return {
          performed: focusedResult.performed,
          action: commandName,
          reason: focusedResult.reason,
        }
      }
      return {
        performed: Boolean(editor.commands.toggleOrderedList()),
        action: commandName,
        reason: null,
      }
    }
    return { performed: false, action: commandName, reason: 'LIST_NOT_ACTIVE' }
  }

  const focusedResult = runFocusedEditorCommand(editor, commandName)
  if (focusedResult) {
    return focusedResult
  }
  return runEditorCommand(editor, commandName)
}

function runBridgeCallback(callback, action, ...args) {
  if (typeof callback !== 'function') {
    return { performed: false, action, reason: 'BRIDGE_CALLBACK_UNAVAILABLE' }
  }

  const result = callback(...args)
  if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'performed')) {
    return result
  }
  return { performed: true, action, reason: null }
}

function handleCanonicalRuntimeCommandId(runtimeBridge, runtimeHandlers, commandId, commandPayload = null) {
  const payload = commandPayload && typeof commandPayload === 'object' && !Array.isArray(commandPayload)
    ? commandPayload
    : {}
  if (commandId === 'cmd.project.view.openSettings') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.openSettings, commandId) }
  }
  if (commandId === 'cmd.project.view.safeReset') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.safeResetShell, commandId) }
  }
  if (commandId === 'cmd.project.view.restoreLastStable') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.restoreLastStableShell, commandId) }
  }
  if (commandId === 'cmd.project.tools.openDiagnostics') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.openDiagnostics, commandId) }
  }
  if (commandId === 'cmd.project.review.openRecovery') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.openRecovery, commandId) }
  }
  if (commandId === 'cmd.project.insert.addCard') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.insertAddCard, commandId) }
  }
  if (commandId === 'cmd.project.format.alignLeft') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.formatAlignLeft, commandId) }
  }
  if (commandId === 'cmd.project.format.toggleUnderline') {
    return { handled: true, result: runEditorFormatCommand(runtimeBridge.editor, 'toggleUnderline') }
  }
  if (commandId === 'cmd.project.format.textColorPicker') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.formatTextColorPicker, commandId, commandId, payload) }
  }
  if (commandId === 'cmd.project.format.highlightColorPicker') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.formatHighlightColorPicker, commandId, commandId, payload) }
  }
  if (commandId === 'cmd.project.format.toggleBold') {
    return { handled: true, result: runEditorFormatCommand(runtimeBridge.editor, 'toggleBold') }
  }
  if (commandId === 'cmd.project.format.toggleItalic') {
    return { handled: true, result: runEditorFormatCommand(runtimeBridge.editor, 'toggleItalic') }
  }
  if (commandId === 'cmd.project.list.toggleBullet') {
    return { handled: true, result: runEditorFormatCommand(runtimeBridge.editor, 'toggleBulletList') }
  }
  if (commandId === 'cmd.project.list.toggleOrdered') {
    return { handled: true, result: runEditorFormatCommand(runtimeBridge.editor, 'toggleOrderedList') }
  }
  if (commandId === 'cmd.project.list.clear') {
    return { handled: true, result: runEditorFormatCommand(runtimeBridge.editor, 'clearList') }
  }
  if (commandId === 'cmd.project.edit.undo') {
    return { handled: true, result: runtimeBridge.undo() }
  }
  if (commandId === 'cmd.project.edit.redo') {
    return { handled: true, result: runtimeBridge.redo() }
  }
  if (commandId === 'cmd.project.edit.find') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.find, commandId) }
  }
  if (commandId === 'cmd.project.edit.replace') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.replace, commandId) }
  }
  if (commandId === 'cmd.project.view.togglePreview') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.togglePreview, commandId) }
  }
  if (commandId === 'cmd.project.view.togglePreviewFrame') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.togglePreviewFrame, commandId) }
  }
  if (commandId === 'cmd.project.view.previewFormatA4') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewFormat, commandId, 'A4') }
  }
  if (commandId === 'cmd.project.view.previewFormatA5') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewFormat, commandId, 'A5') }
  }
  if (commandId === 'cmd.project.view.previewFormatLetter') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewFormat, commandId, 'LETTER') }
  }
  if (commandId === 'cmd.project.view.previewOrientationPortrait') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewOrientation, commandId, 'portrait') }
  }
  if (commandId === 'cmd.project.view.previewOrientationLandscape') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewOrientation, commandId, 'landscape') }
  }
  if (commandId === 'cmd.project.insert.linkPrompt') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.insertLinkPrompt, commandId, commandId, payload) }
  }
  if (commandId === 'cmd.project.plan.switchMode') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, commandId, 'plan') }
  }
  if (commandId === 'cmd.project.review.switchMode') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, commandId, 'review') }
  }
  if (commandId === 'cmd.project.window.switchModeWrite') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, commandId, 'write') }
  }
  if (commandId === 'cmd.project.export.docxMin' && payload.preview === true) {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.openExportPreview, commandId) }
  }
  return { handled: false, result: null }
}

export function runTiptapUndo(editor) {
  return runEditorCommand(editor, 'undo')
}

export function runTiptapRedo(editor) {
  return runEditorCommand(editor, 'redo')
}

export function normalizeRecoveryPayload(payload) {
  const input = payload && typeof payload === 'object' ? payload : {}
  const message = typeof input.message === 'string' && input.message.trim().length > 0
    ? input.message
    : 'Recovered autosave on reopen path'
  const source = typeof input.source === 'string' && input.source.trim().length > 0
    ? input.source
    : 'unknown'

  return {
    handled: true,
    message,
    source,
  }
}

export function createTiptapRuntimeBridge(options = {}) {
  const editor = options.editor || null
  const onRecoveryRestored = typeof options.onRecoveryRestored === 'function'
    ? options.onRecoveryRestored
    : null
  let runtimeHandlers = options.runtimeHandlers && typeof options.runtimeHandlers === 'object'
    ? options.runtimeHandlers
    : {}

  const bridge = {
    editor,
    setRuntimeHandlers(nextHandlers = {}) {
      runtimeHandlers = nextHandlers && typeof nextHandlers === 'object' ? nextHandlers : {}
      return runtimeHandlers
    },
    undo() {
      return runTiptapUndo(editor)
    },
    redo() {
      return runTiptapRedo(editor)
    },
    handleRuntimeCommand(payload = {}) {
      const commandId = payload && typeof payload.commandId === 'string' ? payload.commandId : ''
      const commandPayload = payload && payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)
        ? payload.payload
        : {}
      const canonicalResult = handleCanonicalRuntimeCommandId(bridge, runtimeHandlers, commandId, commandPayload)
      if (canonicalResult.handled) {
        return {
          handled: true,
          result: canonicalResult.result,
          commandId,
        }
      }
      const command = payload && typeof payload.command === 'string' ? payload.command : ''

      if (command === 'undo' || command === 'edit-undo') {
        return { handled: true, result: bridge.undo(), command }
      }
      if (command === 'redo' || command === 'edit-redo') {
        return { handled: true, result: bridge.redo(), command }
      }
      if (command === 'open-settings') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.openSettings, command), command }
      }
      if (command === 'safe-reset-shell') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.safeResetShell, command), command }
      }
      if (command === 'restore-last-stable-shell') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.restoreLastStableShell, command), command }
      }
      if (command === 'open-diagnostics') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.openDiagnostics, command), command }
      }
      if (command === 'open-recovery') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.openRecovery, command), command }
      }
      if (command === 'open-export-preview') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.openExportPreview, command), command }
      }
      if (command === 'insert-add-card') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.insertAddCard, command), command }
      }
      if (command === 'format-align-left') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.formatAlignLeft, command), command }
      }
      if (command === 'toggle-preview') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.togglePreview, command), command }
      }
      if (command === 'toggle-preview-frame') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.togglePreviewFrame, command), command }
      }
      if (command === 'switch-preview-format-a4') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewFormat, command, 'A4'), command }
      }
      if (command === 'switch-preview-format-a5') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewFormat, command, 'A5'), command }
      }
      if (command === 'switch-preview-format-letter') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewFormat, command, 'LETTER'), command }
      }
      if (command === 'switch-preview-orientation-portrait') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewOrientation, command, 'portrait'), command }
      }
      if (command === 'switch-preview-orientation-landscape') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.setPreviewOrientation, command, 'landscape'), command }
      }
      if (command === 'switch-mode-plan') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, command, 'plan'), command }
      }
      if (command === 'switch-mode-review') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, command, 'review'), command }
      }
      if (command === 'switch-mode-write') {
        return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, command, 'write'), command }
      }

      return { handled: false, command }
    },
    handleRecoveryRestored(payload = {}) {
      const normalized = normalizeRecoveryPayload(payload)
      if (onRecoveryRestored) {
        onRecoveryRestored(normalized)
      }
      return normalized
    },
  }

  return bridge
}

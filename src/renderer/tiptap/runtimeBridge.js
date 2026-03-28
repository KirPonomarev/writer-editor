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

function runBridgeCallback(callback, action, ...args) {
  if (typeof callback !== 'function') {
    return { performed: false, action, reason: 'BRIDGE_CALLBACK_UNAVAILABLE' }
  }

  callback(...args)
  return { performed: true, action, reason: null }
}

function handleCanonicalRuntimeCommandId(runtimeHandlers, commandId) {
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
  if (commandId === 'cmd.project.plan.switchMode') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, commandId, 'plan') }
  }
  if (commandId === 'cmd.project.review.switchMode') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, commandId, 'review') }
  }
  if (commandId === 'cmd.project.window.switchModeWrite') {
    return { handled: true, result: runBridgeCallback(runtimeHandlers.switchMode, commandId, 'write') }
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
      const canonicalResult = handleCanonicalRuntimeCommandId(runtimeHandlers, commandId)
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

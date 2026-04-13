const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8')
}

test('sector-m toolbar expansion wave a1: main toolbar exposes A1 hooks in canonical DOM order', () => {
  const html = read(['src', 'renderer', 'index.html'])
  const controlsMatch = html.match(/<div class="floating-toolbar__controls">([\s\S]*?)<div class="floating-toolbar__paragraph-menu"/)
  assert.ok(controlsMatch, 'main floating toolbar controls block must exist')

  const bindKeys = [...controlsMatch[1].matchAll(/data-toolbar-item-key="([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(bindKeys, [
    'font-select',
    'weight-select',
    'size-select',
    'line-height-select',
    'format-bold',
    'format-italic',
    'format-underline',
    'paragraph-trigger',
    'list-type',
    'insert-link',
    'color-text',
    'color-highlight',
    'review-comment',
    'history-undo',
    'history-redo',
  ])
  assert.ok(html.includes('floating-toolbar__group--format-inline'))
  assert.ok(html.includes('floating-toolbar__group--insert'))
  assert.ok(html.includes('floating-toolbar__group--color'))
  assert.ok(html.includes('floating-toolbar__group--review'))
  assert.ok(html.includes('data-list-menu'))
  assert.ok(html.includes('data-list-action="no-list"'))
  assert.ok(html.includes('data-list-action="bullet"'))
  assert.ok(html.includes('data-list-action="ordered"'))
})

test('sector-m toolbar expansion wave a1: editor wiring keeps commands behind kernel and editorMode gate', () => {
  const source = read(['src', 'renderer', 'editor.js'])

  assert.ok(source.includes('getTiptapFormattingState,'))
  assert.ok(source.includes('runTiptapFormatCommand,'))
  assert.ok(source.includes('setTiptapFormattingStateHandler,'))
  assert.ok(source.includes("editorMode: isTiptapMode ? 'tiptap' : 'legacy'"))
  assert.ok(source.includes("formatToggleBold: () => handleTiptapFormatCommand('toggleBold')"))
  assert.ok(source.includes("formatToggleItalic: () => handleTiptapFormatCommand('toggleItalic')"))
  assert.ok(source.includes("listToggleBullet: () => handleTiptapFormatCommand('toggleBulletList')"))
  assert.ok(source.includes("listToggleOrdered: () => handleTiptapFormatCommand('toggleOrderedList')"))
  assert.ok(source.includes("listClear: () => handleTiptapFormatCommand('clearList')"))
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_BOLD);'))
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_ITALIC);'))
  assert.ok(source.includes('document.addEventListener(\'selectionchange\', syncToolbarFormattingState);'))
  assert.equal(source.includes('document.execCommand(\'bold\')'), false)
  assert.equal(source.includes('document.execCommand(\'italic\')'), false)
})

test('sector-m toolbar expansion wave a1: list, paragraph and spacing overlays mutually close', () => {
  const source = read(['src', 'renderer', 'editor.js'])

  const spacingStart = source.indexOf('function setToolbarSpacingMenuOpen(nextOpen)')
  const paragraphStart = source.indexOf('function setParagraphMenuOpen(nextOpen)')
  const listStart = source.indexOf('function setListMenuOpen(nextOpen)')
  const tuningStart = source.indexOf('function setToolbarSpacingTuningMode(nextActive)')
  assert.ok(spacingStart > -1 && paragraphStart > spacingStart && listStart > paragraphStart && tuningStart > listStart)

  const spacingSnippet = source.slice(spacingStart, paragraphStart)
  const paragraphSnippet = source.slice(paragraphStart, listStart)
  const listSnippet = source.slice(listStart, tuningStart)
  assert.ok(spacingSnippet.includes('setParagraphMenuOpen(false);'))
  assert.ok(spacingSnippet.includes('setListMenuOpen(false);'))
  assert.ok(paragraphSnippet.includes('setToolbarSpacingMenuOpen(false);'))
  assert.ok(paragraphSnippet.includes('setListMenuOpen(false);'))
  assert.ok(listSnippet.includes('setParagraphMenuOpen(false);'))
  assert.ok(listSnippet.includes('setToolbarSpacingMenuOpen(false);'))
  assert.ok(source.includes('function initializeFloatingToolbarListMenu()'))
  assert.ok(source.includes('setListMenuOpen(false);'))
  assert.ok(source.includes('listVisible'))
})

test('sector-m toolbar expansion wave a1: command ids and capability docs are explicit', () => {
  const projectCommands = read(['src', 'renderer', 'commands', 'projectCommands.mjs'])
  const capability = read(['src', 'renderer', 'commands', 'capabilityPolicy.mjs'])
  const binding = read(['docs', 'OPS', 'STATUS', 'COMMAND_CAPABILITY_BINDING.json'])
  const runtimeBridge = read(['src', 'renderer', 'tiptap', 'runtimeBridge.js'])
  const tiptap = read(['src', 'renderer', 'tiptap', 'index.js'])

  for (const commandId of [
    'cmd.project.format.toggleBold',
    'cmd.project.format.toggleItalic',
    'cmd.project.list.toggleBullet',
    'cmd.project.list.toggleOrdered',
    'cmd.project.list.clear',
  ]) {
    assert.ok(projectCommands.includes(commandId))
    assert.ok(capability.includes(commandId))
    assert.ok(binding.includes(commandId))
    assert.ok(runtimeBridge.includes(commandId))
  }

  assert.ok(tiptap.includes('export function getTiptapFormattingState()'))
  assert.ok(tiptap.includes('export function runTiptapFormatCommand(commandName, commandPayload = undefined)'))
  assert.ok(tiptap.includes("toggleBold: () => currentEditorInstance.commands.toggleBold()"))
  assert.ok(tiptap.includes("toggleItalic: () => currentEditorInstance.commands.toggleItalic()"))
  assert.ok(tiptap.includes("toggleBulletList: () => currentEditorInstance.commands.toggleBulletList()"))
  assert.ok(tiptap.includes("toggleOrderedList: () => currentEditorInstance.commands.toggleOrderedList()"))
})

test('sector-m toolbar expansion wave a1: underline and link are live in catalog and capability truth', () => {
  const catalog = read(['src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs'])
  const projectCommands = read(['src', 'renderer', 'commands', 'projectCommands.mjs'])
  const capability = read(['src', 'renderer', 'commands', 'capabilityPolicy.mjs'])
  const binding = read(['docs', 'OPS', 'STATUS', 'COMMAND_CAPABILITY_BINDING.json'])

  assert.ok(catalog.includes("id: 'toolbar.format.underline'"))
  assert.ok(catalog.includes("commandId: 'cmd.project.format.toggleUnderline'"))
  assert.ok(catalog.includes("implementationState: 'live'"))
  assert.ok(catalog.includes("id: 'toolbar.insert.link'"))
  assert.ok(catalog.includes("commandId: 'cmd.project.insert.linkPrompt'"))
  assert.ok(catalog.includes("toolbar.format.underline"))
  assert.ok(catalog.includes("toolbar.insert.link"))
  assert.ok(projectCommands.includes("FORMAT_TOGGLE_UNDERLINE: 'cmd.project.format.toggleUnderline'"))
  assert.ok(projectCommands.includes("INSERT_LINK_PROMPT: 'cmd.project.insert.linkPrompt'"))
  assert.ok(capability.includes("'cmd.project.format.toggleUnderline': 'cap.project.format.toggleUnderline'"))
  assert.ok(capability.includes("'cmd.project.insert.linkPrompt': 'cap.project.insert.linkPrompt'"))
  assert.ok(binding.includes('"commandId": "cmd.project.format.toggleUnderline"'))
  assert.ok(binding.includes('"commandId": "cmd.project.insert.linkPrompt"'))
})

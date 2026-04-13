const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8')
}

test('sector-m toolbar expansion wave a2: main toolbar exposes underline and link in canonical DOM order', () => {
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

  assert.ok(html.includes('floating-toolbar__group--insert'))
  assert.ok(html.includes('data-action="insert-link"'))
  assert.ok(html.includes('data-action="format-underline"'))
})

test('sector-m toolbar expansion wave a2: editor wiring keeps underline and link behind command kernel and bounded prompt flow', () => {
  const source = read(['src', 'renderer', 'editor.js'])

  assert.ok(source.includes("formatToggleUnderline: () => handleTiptapFormatCommand('toggleUnderline')"))
  assert.ok(source.includes("insertLinkPrompt: (payload = {}) => handleInsertLinkPrompt(payload)"))
  assert.ok(source.includes("void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TOGGLE_UNDERLINE);"))
  assert.ok(source.includes("void dispatchUiCommand(EXTRA_COMMAND_IDS.INSERT_LINK_PROMPT);"))
  assert.ok(source.includes("const LINK_PROMPT_TITLE = 'Insert link'"))
  assert.ok(source.includes("return { performed: false, action: 'insertLinkPrompt', reason: 'NO_SELECTION' }"))
  assert.ok(source.includes("return { performed: false, action: 'insertLinkPrompt', reason: 'USER_CANCELLED' }"))
  assert.ok(source.includes("return { performed: false, action: 'insertLinkPrompt', reason: normalized.reason }"))
  assert.ok(source.includes("return handleTiptapFormatCommand('unsetLink')"))
  assert.ok(source.includes("return handleTiptapFormatCommand('setLink', { href: normalized.href })"))
  assert.ok(source.includes("insertLinkPrompt: (_commandId, payload = {}) => handleInsertLinkPrompt(payload)"))
  assert.equal(source.includes('openOnClick: true'), false)
})

test('sector-m toolbar expansion wave a2: approved dependency delta and command truth are explicit', () => {
  const packageJson = read(['package.json'])
  const projectCommands = read(['src', 'renderer', 'commands', 'projectCommands.mjs'])
  const capability = read(['src', 'renderer', 'commands', 'capabilityPolicy.mjs'])
  const binding = read(['docs', 'OPS', 'STATUS', 'COMMAND_CAPABILITY_BINDING.json'])

  assert.ok(packageJson.includes('"@tiptap/extension-link"'))
  assert.ok(packageJson.includes('"@tiptap/extension-underline"'))
  assert.equal(packageJson.includes('@tiptap-pro/'), false)
  assert.equal(packageJson.includes('@tiptap-cloud/'), false)

  assert.ok(projectCommands.includes("FORMAT_TOGGLE_UNDERLINE: 'cmd.project.format.toggleUnderline'"))
  assert.ok(projectCommands.includes("INSERT_LINK_PROMPT: 'cmd.project.insert.linkPrompt'"))
  assert.ok(projectCommands.includes("id: EXTRA_COMMAND_IDS.FORMAT_TOGGLE_UNDERLINE"))
  assert.ok(projectCommands.includes("id: EXTRA_COMMAND_IDS.INSERT_LINK_PROMPT"))
  assert.ok(capability.includes("'cmd.project.format.toggleUnderline': 'cap.project.format.toggleUnderline'"))
  assert.ok(capability.includes("'cmd.project.insert.linkPrompt': 'cap.project.insert.linkPrompt'"))
  assert.ok(binding.includes('"commandId": "cmd.project.format.toggleUnderline"'))
  assert.ok(binding.includes('"commandId": "cmd.project.insert.linkPrompt"'))
})

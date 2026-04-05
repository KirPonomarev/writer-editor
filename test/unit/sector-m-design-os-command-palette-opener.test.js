const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

function readRendererHtml() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8')
}

function extractFunctionSource(source, name) {
  const signature = `function ${name}(`
  const start = source.indexOf(signature)
  assert.ok(start > -1, `${name} must exist`)
  const braceStart = source.indexOf('{', start)
  assert.ok(braceStart > start, `${name} body must exist`)
  let depth = 0
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) {
      return source.slice(start, index + 1)
    }
  }
  throw new Error(`Unclosed function body for ${name}`)
}

function instantiateFunctions(functionNames, context = {}) {
  const source = readEditorSource()
  const script = `${functionNames.map((name) => extractFunctionSource(source, name)).join('\n\n')}\nmodule.exports = { ${functionNames.join(', ')} };`
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Array,
    Set,
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-command-palette-opener.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('command palette opener: current renderer html exposes commands button and modal shell', () => {
  const html = readRendererHtml()
  assert.ok(html.includes('data-action="open-command-palette"'))
  assert.ok(html.includes('data-command-palette-modal'))
  assert.ok(html.includes('data-command-palette-search'))
  assert.ok(html.includes('data-command-palette-summary'))
  assert.ok(html.includes('data-command-palette-list'))
  assert.ok(html.includes('data-command-palette-close'))
})

test('command palette opener: editor wiring exposes action case and data-provider based rendering path', () => {
  const source = readEditorSource()
  assert.ok(source.includes('const commandPaletteModal = document.querySelector(\'[data-command-palette-modal]\');'))
  assert.ok(source.includes('const commandPaletteSearchInput = document.querySelector(\'[data-command-palette-search]\');'))
  assert.ok(source.includes('const commandPaletteList = document.querySelector(\'[data-command-palette-list]\');'))
  assert.ok(source.includes('function renderCommandPaletteList(rawQuery = \'\') {'))
  assert.ok(source.includes('const sourceEntries ='))
  assert.ok(source.includes('commandPaletteDataProvider.listAll()'))
  assert.ok(source.includes('case \'open-command-palette\':'))
  assert.ok(source.includes('openCommandPaletteModal();'))
  assert.ok(source.includes('return dispatchUiCommand(commandId.trim());'))
})

test('command palette opener: filter matches by label id and hotkey and trims query', () => {
  const { exported } = instantiateFunctions([
    'filterCommandPaletteEntries',
  ])
  const entries = [
    { id: 'cmd.project.open', label: 'Open Project', hotkey: 'Cmd+O' },
    { id: 'cmd.project.save', label: 'Save', hotkey: 'Cmd+S' },
    { id: 'cmd.editor.find', label: 'Find', hotkey: 'Cmd+F' },
  ]

  assert.deepEqual(
    toPlain(exported.filterCommandPaletteEntries(entries, '  open  ').map((entry) => entry.id)),
    ['cmd.project.open'],
  )
  assert.deepEqual(
    toPlain(exported.filterCommandPaletteEntries(entries, 'cmd+f').map((entry) => entry.id)),
    ['cmd.editor.find'],
  )
  assert.deepEqual(
    toPlain(exported.filterCommandPaletteEntries(entries, '').map((entry) => entry.id)),
    ['cmd.project.open', 'cmd.project.save', 'cmd.editor.find'],
  )
})

test('command palette opener: open modal resets query renders list and focuses input', () => {
  const events = []
  const commandPaletteSearchInput = {
    value: 'pre-existing',
    focus: () => events.push('focus'),
  }
  const commandPaletteModal = { hidden: true }
  const { exported } = instantiateFunctions([
    'openCommandPaletteModal',
  ], {
    commandPaletteSearchInput,
    commandPaletteModal,
    renderCommandPaletteList: (query) => events.push(['render', query]),
    openSimpleModal: (modal) => {
      modal.hidden = false
      events.push(['open', modal.hidden])
    },
  })

  exported.openCommandPaletteModal()
  assert.equal(commandPaletteSearchInput.value, '')
  assert.equal(commandPaletteModal.hidden, false)
  assert.deepEqual(toPlain(events), [
    ['render', ''],
    ['open', false],
    'focus',
  ])
})

test('command palette opener: selecting entry closes modal and dispatches command id', async () => {
  const events = []
  const commandPaletteModal = { hidden: false }
  const { exported } = instantiateFunctions([
    'runCommandPaletteAction',
  ], {
    commandPaletteModal,
    closeSimpleModal: (modal) => {
      modal.hidden = true
      events.push(['close', modal.hidden])
    },
    dispatchUiCommand: async (commandId) => {
      events.push(['dispatch', commandId])
      return { ok: true }
    },
  })

  await exported.runCommandPaletteAction(' cmd.project.open ')
  await exported.runCommandPaletteAction(' ')

  assert.deepEqual(toPlain(events), [
    ['close', true],
    ['dispatch', 'cmd.project.open'],
  ])
})

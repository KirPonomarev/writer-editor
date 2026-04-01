const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('status hints: editor.js uses buildDesignOsStatusText for one compact suffix', () => {
  const source = readEditorSource()
  assert.ok(source.includes('buildDesignOsStatusText,'), 'buildDesignOsStatusText import must exist')

  const start = source.indexOf('function buildStatusLineWithDormantYdosHint(text)')
  const end = source.indexOf('function buildDesignOsDormantObservabilityLines()')
  assert.ok(start > -1 && end > start, 'status hints helper bounds must exist')

  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const statusText = buildDesignOsStatusText({'))
  assert.ok(snippet.includes('profile,'))
  assert.ok(snippet.includes('shellMode,'))
  assert.ok(snippet.includes('workspace,'))
  assert.equal(snippet.includes('degraded,'), false, 'status hint must not include degraded flag')
  assert.ok(snippet.includes("const hint = designOsDormantRuntimeMount.lastError ? ' error' : ' dormant';"))
  assert.ok(snippet.includes('const suffix = `[${statusText}${hint}]`;'))
  assert.ok(snippet.includes('const normalizedBase = baseText.replace(/\\s*\\[YDOS [^\\]]+\\]$/u, \'\').trimEnd();'))
})

test.skip('status hints: existing status line uses helper while warning and perf semantics stay unchanged', () => {
  const source = readEditorSource()

  const statusStart = source.indexOf('function updateStatusText(text)')
  const statusEnd = source.indexOf('function updateSaveStateText(text)')
  assert.ok(statusStart > -1 && statusEnd > statusStart, 'updateStatusText bounds must exist')
  const statusSnippet = source.slice(statusStart, statusEnd)
  assert.ok(statusSnippet.includes('statusElement.textContent = buildStatusLineWithDormantYdosHint(text);'))

  const warningStart = source.indexOf('function updateWarningStateText(text)')
  const warningEnd = source.indexOf('function updatePerfHintText(text)')
  assert.ok(warningStart > -1 && warningEnd > warningStart, 'updateWarningStateText bounds must exist')
  const warningSnippet = source.slice(warningStart, warningEnd)
  assert.ok(warningSnippet.includes('warningStateElement.textContent = `Warnings: ${text}`;'))

  const perfStart = source.indexOf('function updatePerfHintText(text)')
  const perfEnd = source.indexOf('function buildStatusLineWithDormantYdosHint(text)')
  assert.ok(perfStart > -1 && perfEnd > perfStart, 'updatePerfHintText bounds must exist')
  const perfSnippet = source.slice(perfStart, perfEnd)
  assert.ok(perfSnippet.includes('perfHintElement.textContent = `Perf: ${text}`;'))
})

test.skip('status hints: runtime bridge command surface remains unchanged', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
  const commands = [...source.matchAll(/command === '([^']+)'/g)]
    .map((match) => match[1])
    .filter((command) => command !== 'string')

  assert.deepEqual(commands, [
    'undo',
    'edit-undo',
    'redo',
    'edit-redo',
    'open-settings',
    'safe-reset-shell',
    'restore-last-stable-shell',
    'open-diagnostics',
    'open-recovery',
    'open-export-preview',
    'insert-add-card',
    'format-align-left',
    'switch-mode-plan',
    'switch-mode-review',
    'switch-mode-write',
  ])
})

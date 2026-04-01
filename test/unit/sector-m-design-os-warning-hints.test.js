const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('warning hints: degraded flag is local and synced only from previewDesign', () => {
  const source = readEditorSource()
  assert.ok(source.includes('let designOsDormantDegradedToBaseline = false;'))

  const start = source.indexOf('function syncDesignOsDormantContext()')
  const end = source.indexOf('function syncDesignOsDormantTextInput()')
  assert.ok(start > -1 && end > start, 'syncDesignOsDormantContext bounds must exist')

  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const preview = designOsDormantRuntimeMount.ports.previewDesign({'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
})

test.skip('warning hints: updateWarningStateText body remains unchanged and call sites append compact suffix', () => {
  const source = readEditorSource()

  const fnStart = source.indexOf('function updateWarningStateText(text)')
  const fnEnd = source.indexOf('function updatePerfHintText(text)')
  assert.ok(fnStart > -1 && fnEnd > fnStart, 'updateWarningStateText bounds must exist')
  const fnBody = source.slice(fnStart, fnEnd)
  assert.ok(fnBody.includes('warningStateElement.textContent = `Warnings: ${text}`;'))

  const helperStart = source.indexOf('function buildDormantWarningHintText(text)')
  const helperEnd = source.indexOf('function buildDesignOsDormantObservabilityLines()')
  assert.ok(helperStart > -1 && helperEnd > helperStart, 'warning hint helper bounds must exist')
  const helperBody = source.slice(helperStart, helperEnd)
  assert.ok(helperBody.includes('Boolean(designOsDormantRuntimeMount.lastError) || designOsDormantDegradedToBaseline === true'))
  assert.ok(helperBody.includes("const hint = designOsDormantRuntimeMount.lastError ? 'error' : 'degraded';"))
  assert.ok(helperBody.includes('return `${normalizedBase} [YDOS dormant ${hint}]`;'))

  const requiredCalls = [
    "updateWarningStateText(buildDormantWarningHintText('none'));",
    "updateWarningStateText(buildDormantWarningHintText('recovery restored'));",
    "updateWarningStateText(buildDormantWarningHintText('network blocked before X4'));",
    "updateWarningStateText(buildDormantWarningHintText('recovery'));",
    "updateWarningStateText(buildDormantWarningHintText('error'));",
  ]

  for (const call of requiredCalls) {
    assert.ok(source.includes(call), `missing warning call-site hint wrapper: ${call}`)
  }
})

test.skip('warning hints: status and perf semantics stay unchanged and command surface is unchanged', () => {
  const source = readEditorSource()

  const statusStart = source.indexOf('function updateStatusText(text)')
  const statusEnd = source.indexOf('function updateSaveStateText(text)')
  assert.ok(statusStart > -1 && statusEnd > statusStart, 'updateStatusText bounds must exist')
  const statusBody = source.slice(statusStart, statusEnd)
  assert.ok(statusBody.includes('statusElement.textContent = buildStatusLineWithDormantYdosHint(text);'))

  const perfStart = source.indexOf('function updatePerfHintText(text)')
  const perfEnd = source.indexOf('function buildStatusLineWithDormantYdosHint(text)')
  assert.ok(perfStart > -1 && perfEnd > perfStart, 'updatePerfHintText bounds must exist')
  const perfBody = source.slice(perfStart, perfEnd)
  assert.ok(perfBody.includes('perfHintElement.textContent = `Perf: ${text}`;'))

  const bridgeSource = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
  const commands = [...bridgeSource.matchAll(/command === '([^']+)'/g)]
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

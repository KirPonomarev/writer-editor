const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()

function readEditorSource() {
  const filePath = path.join(ROOT, 'src', 'renderer', 'editor.js')
  return fs.readFileSync(filePath, 'utf8')
}

test.skip('design-os dormant observability helper exposes only allowed summary lines', () => {
  const source = readEditorSource()
  const start = source.indexOf('function buildDesignOsDormantObservabilityLines()')
  const end = source.indexOf('function updateInspectorSnapshot()')
  assert.ok(start > -1 && end > start, 'observability helper bounds must exist')

  const snippet = source.slice(start, end)
  const requiredLines = [
    'YDOS_DormantMounted=',
    'YDOS_DormantLastError=',
    'YDOS_Workspace=',
    'YDOS_Platform=',
    'YDOS_Accessibility=',
    'YDOS_ShellMode=',
    'YDOS_ResolverCalls=',
    'YDOS_PreviewCalls=',
    'YDOS_TextInputEvents=',
  ]

  for (const linePrefix of requiredLines) {
    assert.ok(snippet.includes(linePrefix), `missing summary line prefix ${linePrefix}`)
  }

  const forbiddenTokens = ['product_truth', 'design_state', 'scenes', 'active_scene_id']
  for (const token of forbiddenTokens) {
    assert.equal(snippet.includes(token), false, `forbidden token leaked into helper: ${token}`)
  }
})

test.skip('design-os dormant observability lines are appended to existing text surfaces', () => {
  const source = readEditorSource()
  const inspectorStart = source.indexOf('function updateInspectorSnapshot()')
  const inspectorEnd = source.indexOf('function renderOutlineList()')
  assert.ok(inspectorStart > -1 && inspectorEnd > inspectorStart, 'inspector function bounds must exist')
  const inspectorBody = source.slice(inspectorStart, inspectorEnd)
  assert.ok(inspectorBody.includes('...buildDesignOsDormantObservabilityLines()'))

  const diagnosticsStart = source.indexOf('function openDiagnosticsModal()')
  const diagnosticsEnd = source.indexOf('function openExportPreviewModal()')
  assert.ok(diagnosticsStart > -1 && diagnosticsEnd > diagnosticsStart, 'diagnostics function bounds must exist')
  const diagnosticsBody = source.slice(diagnosticsStart, diagnosticsEnd)
  assert.ok(diagnosticsBody.includes('...buildDesignOsDormantObservabilityLines()'))
})

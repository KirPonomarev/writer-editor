const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
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
    Math,
    Number,
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-toolbar-boundary-ownership.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

test('toolbar boundary ownership: snap bounds are derived from main content rect instead of top bar only', () => {
  const source = readEditorSource()
  assert.ok(source.includes('function getFloatingToolbarSnapBounds(shellRect = toolbarShell?.getBoundingClientRect()) {'))
  assert.ok(source.includes('const mainContentRect = mainContent?.getBoundingClientRect();'))
  assert.ok(source.includes('left = Math.max(left, mainContentRect.left);'))
  assert.ok(source.includes('right = Math.min(right, mainContentRect.right);'))
  assert.ok(source.includes('const baseX = left + ((right - left - shellWidth) / 2);'))
  assert.ok(source.includes('if ((right - left) <= shellWidth) {'))
  assert.ok(source.includes('const { topBarRect, left, right } = getFloatingToolbarSnapBounds(shellRect);'))
})

test('toolbar boundary ownership: snapped X position is clamped to content bounds and centered inside content', () => {
  const { exported } = instantiateFunctions([
    'getFloatingToolbarSnapBounds',
    'getSnappedFloatingToolbarPosition',
    'getSnappedFloatingToolbarX',
  ], {
    toolbarShell: {
      getBoundingClientRect: () => ({ width: 360, height: 24 }),
    },
    topWorkBar: {
      getBoundingClientRect: () => ({ left: 0, right: 1280, top: 40, height: 44 }),
    },
    mainContent: {
      getBoundingClientRect: () => ({ left: 300, right: 980, top: 120, height: 600 }),
    },
    clampFloatingToolbarPosition: (position) => position,
    floatingToolbarState: { y: 0 },
    FLOATING_TOOLBAR_CENTER_ANCHOR_PX: 12,
    window: { innerWidth: 1280 },
  })

  const snapped = exported.getSnappedFloatingToolbarPosition({ width: 360, height: 24 })
  assert.equal(snapped.x, 460)
  assert.equal(snapped.y, 50)
  assert.equal(exported.getSnappedFloatingToolbarX(120, { width: 360 }), 300)
  assert.equal(exported.getSnappedFloatingToolbarX(900, { width: 360 }), 620)
})

test('toolbar boundary ownership: snapped position stays centered when content span is narrower than toolbar width', () => {
  const { exported } = instantiateFunctions([
    'getFloatingToolbarSnapBounds',
    'getSnappedFloatingToolbarPosition',
    'getSnappedFloatingToolbarX',
  ], {
    toolbarShell: {
      getBoundingClientRect: () => ({ width: 360, height: 24 }),
    },
    topWorkBar: {
      getBoundingClientRect: () => ({ left: 0, right: 1280, top: 40, height: 44 }),
    },
    mainContent: {
      getBoundingClientRect: () => ({ left: 300, right: 620, top: 120, height: 600 }),
    },
    clampFloatingToolbarPosition: (position) => position,
    floatingToolbarState: { y: 0 },
    FLOATING_TOOLBAR_CENTER_ANCHOR_PX: 12,
    window: { innerWidth: 1280 },
  })

  const snapped = exported.getSnappedFloatingToolbarPosition({ width: 360, height: 24 })
  assert.equal(snapped.x, 280)
  assert.equal(exported.getSnappedFloatingToolbarX(420, { width: 360 }), 280)
})

test('toolbar boundary ownership: spatial resize path refreshes snapped toolbar placement', () => {
  const source = readEditorSource()
  const startSnippet = extractFunctionSource(source, 'startSpatialResize')
  const moveSnippet = extractFunctionSource(source, 'handleSpatialResizeMove')
  const stopSnippet = extractFunctionSource(source, 'stopSpatialResize')
  assert.ok(startSnippet.includes('normalizeSnappedToolbarDockedWidthScale(false);'))
  assert.ok(moveSnippet.includes('refreshSnappedFloatingToolbarPlacement(false, { preserveSideAnchor: true });'))
  assert.ok(stopSnippet.includes('refreshSnappedFloatingToolbarPlacement(true, { preserveSideAnchor: true });'))
})

test('toolbar boundary ownership: snapped mode normalizes docked width scale for stable group anchoring', () => {
  const source = readEditorSource()
  const normalizeSnippet = extractFunctionSource(source, 'normalizeSnappedToolbarDockedWidthScale')
  const refreshSnippet = extractFunctionSource(source, 'refreshSnappedFloatingToolbarPlacement')
  const clampSnippet = extractFunctionSource(source, 'getClampedFloatingToolbarXWithinBounds')
  const dragSnippet = extractFunctionSource(source, 'initializeFloatingToolbarDragFoundation')
  assert.ok(normalizeSnippet.includes('const stableDockedWidthScale = 1;'))
  assert.ok(normalizeSnippet.includes('const shouldNormalizeDockedWidth ='))
  assert.ok(normalizeSnippet.includes('widthScale: stableDockedWidthScale,'))
  assert.ok(normalizeSnippet.includes('dockedWidthScale: stableDockedWidthScale,'))
  assert.ok(refreshSnippet.includes('const preserveSideAnchor = Boolean(options?.preserveSideAnchor);'))
  assert.ok(refreshSnippet.includes('const sideAnchoredX = getClampedFloatingToolbarXWithinBounds(floatingToolbarState.x, shellRect);'))
  assert.ok(refreshSnippet.includes('widthScale: 1,'))
  assert.ok(refreshSnippet.includes('dockedWidthScale: 1,'))
  assert.ok(clampSnippet.includes('if (nextX < minX && (minX - nextX) <= FLOATING_TOOLBAR_COLLISION_HOLD_PX) {'))
  assert.ok(clampSnippet.includes('if (nextX > maxX && (nextX - maxX) <= FLOATING_TOOLBAR_COLLISION_HOLD_PX) {'))
  assert.ok(clampSnippet.includes('return Math.min(Math.max(nextX, minX), maxX);'))
  assert.ok(dragSnippet.includes('widthScale: 1,'))
  assert.ok(dragSnippet.includes('dockedWidthScale: 1,'))
})

test('toolbar boundary ownership: side clamp keeps position at collision threshold but clamps on larger overlap', () => {
  const { exported } = instantiateFunctions([
    'getClampedFloatingToolbarXWithinBounds',
  ], {
    getFloatingToolbarSnapBounds: () => ({ left: 300, right: 980 }),
    clampFloatingToolbarPosition: (position) => position,
    floatingToolbarState: { y: 0 },
    FLOATING_TOOLBAR_COLLISION_HOLD_PX: 8,
  })

  assert.equal(exported.getClampedFloatingToolbarXWithinBounds(295, { width: 360 }), 295)
  assert.equal(exported.getClampedFloatingToolbarXWithinBounds(610, { width: 360 }), 610)
  assert.equal(exported.getClampedFloatingToolbarXWithinBounds(290, { width: 360 }), 300)
  assert.equal(exported.getClampedFloatingToolbarXWithinBounds(630, { width: 360 }), 620)
})

test('toolbar boundary ownership: snapped refresh recenters toolbar on boundary changes', () => {
  const { exported, sandbox } = instantiateFunctions([
    'getClampedFloatingToolbarXWithinBounds',
    'refreshSnappedFloatingToolbarPlacement',
  ], {
    getFloatingToolbarSnapBounds: () => ({ left: 300, right: 980 }),
    clampFloatingToolbarPosition: (position) => position,
    FLOATING_TOOLBAR_COLLISION_HOLD_PX: 8,
    toolbarShell: {
      getBoundingClientRect: () => ({ width: 360, height: 24 }),
    },
    floatingToolbarState: {
      x: 777,
      y: 10,
      isDetached: false,
      widthScale: 1,
      dockedWidthScale: 1,
    },
    getSnappedFloatingToolbarPosition: () => ({ x: 460, y: 50 }),
    applyFloatingToolbarState: (nextState, persist) => {
      sandbox.nextState = nextState
      sandbox.persist = persist
    },
  })

  exported.refreshSnappedFloatingToolbarPlacement(true)
  assert.equal(sandbox.nextState.x, 460)
  assert.equal(sandbox.nextState.y, 50)
  assert.equal(sandbox.nextState.isDetached, false)
  assert.equal(sandbox.persist, true)
})

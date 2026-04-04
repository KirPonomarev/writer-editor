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

function extractOnSetDirtyCallbackBody(source) {
  const start = source.indexOf('window.electronAPI.onSetDirty((state) => {')
  assert.ok(start > -1, 'onSetDirty callback must exist')
  const braceStart = source.indexOf('{', start)
  let depth = 0
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) {
      return source.slice(braceStart + 1, index)
    }
  }
  throw new Error('Unclosed onSetDirty callback body')
}

function instantiateFunctions(functionNames, extraCode = '', context = {}) {
  const source = readEditorSource()
  const exportNames = [...functionNames]
  if (extraCode) {
    exportNames.push('onSetDirtyCallback')
  }
  const script = [
    ...functionNames.map((name) => extractFunctionSource(source, name)),
    extraCode,
    `module.exports = { ${exportNames.join(', ')} };`,
  ].join('\n\n')
  const sandbox = {
    module: { exports: {} },
    exports: {},
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-save-boundary-truth-sync.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('save boundary truth sync: source imports hash builder and tracks narrow synced hash state', () => {
  const source = readEditorSource()
  assert.ok(source.includes('buildProductTruthHash,'))
  assert.ok(source.includes('let lastSyncedDormantProductTruthHash ='))
  assert.ok(source.includes('let lastObservedDormantDirtyState = false;'))

  const helperSnippet = extractFunctionSource(source, 'syncDesignOsDormantProductTruthAtSaveBoundary')
  assert.ok(helperSnippet.includes('buildProductTruthHash(nextProductTruth)'))
  assert.equal(helperSnippet.includes('updateStatusText('), false)
  assert.equal(helperSnippet.includes('statusElement'), false)
})

test('save boundary truth sync: remount helper updates last synced dormant product truth hash after successful remount', () => {
  const { exported, sandbox } = instantiateFunctions([
    'remountDesignOsDormantRuntimeForCurrentDocumentContext',
  ], '', {
    designOsDormantRuntimeMount: null,
    spatialLayoutState: null,
    getSpatialLayoutBaselineForViewport: () => ({ source: 'baseline-layout' }),
    buildDesignOsDormantProductTruth: () => ({
      project_id: 'project-a',
      scenes: { a: 'Alpha' },
      active_scene_id: 'a',
    }),
    createRepoGroundedDesignOsBrowserRuntime: ({ productTruth }) => ({
      runtime: { runtimeTruth: productTruth },
      compatibility: { phase04: true },
    }),
    createDesignOsPorts: ({ runtime, defaultContext }) => ({ runtime, defaultContext }),
    buildDesignOsDormantContext: () => ({ workspace: 'WRITE' }),
    rememberDesignOsDormantLayoutState: () => {},
    refreshDesignOsDormantPreview: () => {},
    buildProductTruthHash: (truth) => `hash:${truth.active_scene_id}`,
    lastSyncedDormantProductTruthHash: '',
  })

  const mount = exported.remountDesignOsDormantRuntimeForCurrentDocumentContext()
  assert.equal(mount.runtime.runtimeTruth.active_scene_id, 'a')
  assert.equal(sandbox.lastSyncedDormantProductTruthHash, 'hash:a')
})

test('save boundary truth sync: save-boundary helper skips remount on hash match and remounts on hash drift', () => {
  const { exported, sandbox } = instantiateFunctions([
    'syncDesignOsDormantProductTruthAtSaveBoundary',
  ], '', {
    buildDesignOsDormantProductTruth: () => ({
      project_id: 'project-a',
      scenes: { a: 'Alpha' },
      active_scene_id: 'a',
    }),
    buildProductTruthHash: (truth) => `hash:${truth.active_scene_id}`,
    mountDesignOsDormantRuntime: ({ productTruth }) => {
      sandbox.remountCalls.push(toPlain(productTruth))
      sandbox.lastSyncedDormantProductTruthHash = `hash:${productTruth.active_scene_id}`
    },
    mountFailures: 0,
    lastSyncedDormantProductTruthHash: 'hash:a',
    remountCalls: [],
  })

  const skipped = exported.syncDesignOsDormantProductTruthAtSaveBoundary()
  assert.deepEqual(toPlain(skipped), {
    performed: false,
    skipped: true,
    reason: 'hash_match',
    productTruthHash: 'hash:a',
  })
  assert.deepEqual(toPlain(sandbox.remountCalls), [])

  sandbox.buildDesignOsDormantProductTruth = () => ({
    project_id: 'project-a',
    scenes: { b: 'Beta' },
    active_scene_id: 'b',
  })
  const remounted = exported.syncDesignOsDormantProductTruthAtSaveBoundary()
  assert.deepEqual(toPlain(remounted), {
    performed: true,
    skipped: false,
    reason: null,
    productTruthHash: 'hash:b',
  })
  assert.deepEqual(toPlain(sandbox.remountCalls), [{
    project_id: 'project-a',
    scenes: { b: 'Beta' },
    active_scene_id: 'b',
  }])
})

test('save boundary truth sync: helper reports remount failure when hash does not advance', () => {
  const { exported, sandbox } = instantiateFunctions([
    'syncDesignOsDormantProductTruthAtSaveBoundary',
  ], '', {
    buildDesignOsDormantProductTruth: () => ({
      project_id: 'project-a',
      scenes: { b: 'Beta' },
      active_scene_id: 'b',
    }),
    buildProductTruthHash: (truth) => `hash:${truth.active_scene_id}`,
    mountDesignOsDormantRuntime: ({ productTruth }) => {
      sandbox.remountCalls.push(toPlain(productTruth))
    },
    lastSyncedDormantProductTruthHash: 'hash:a',
    remountCalls: [],
  })

  const failed = exported.syncDesignOsDormantProductTruthAtSaveBoundary()
  assert.deepEqual(toPlain(failed), {
    performed: false,
    skipped: false,
    reason: 'remount_failed',
    productTruthHash: 'hash:b',
  })
  assert.deepEqual(toPlain(sandbox.remountCalls), [{
    project_id: 'project-a',
    scenes: { b: 'Beta' },
    active_scene_id: 'b',
  }])
})

test('save boundary truth sync: onSetDirty triggers helper only on true to false transition', () => {
  const callbackBody = extractOnSetDirtyCallbackBody(readEditorSource())
  const extraCode = `function onSetDirtyCallback(state) {${callbackBody}}`
  const { exported, sandbox } = instantiateFunctions([], extraCode, {
    localDirty: false,
    lastObservedDormantDirtyState: false,
    syncCalls: 0,
    saveStates: [],
    inspectorUpdates: 0,
    syncDesignOsDormantProductTruthAtSaveBoundary: () => {
      sandbox.syncCalls += 1
    },
    updateSaveStateText: (text) => {
      sandbox.saveStates.push(text)
    },
    updateInspectorSnapshot: () => {
      sandbox.inspectorUpdates += 1
    },
  })

  exported.onSetDirtyCallback(true)
  assert.equal(sandbox.syncCalls, 0)
  assert.equal(sandbox.localDirty, true)
  assert.equal(sandbox.lastObservedDormantDirtyState, true)

  exported.onSetDirtyCallback(true)
  assert.equal(sandbox.syncCalls, 0)

  exported.onSetDirtyCallback(false)
  assert.equal(sandbox.syncCalls, 1)
  assert.equal(sandbox.localDirty, false)
  assert.equal(sandbox.lastObservedDormantDirtyState, false)

  exported.onSetDirtyCallback(false)
  assert.equal(sandbox.syncCalls, 1)
  assert.deepEqual(toPlain(sandbox.saveStates), ['unsaved', 'unsaved', 'saved', 'saved'])
  assert.equal(sandbox.inspectorUpdates, 4)
})

test('save boundary truth sync: direct remount paths remain unchanged and no continuous remount is admitted', () => {
  const source = readEditorSource()
  const remountMatches = source.match(/remountDesignOsDormantRuntimeForCurrentDocumentContext\(/g) || []
  assert.equal(remountMatches.length, 5)

  const inputStart = source.indexOf("editor.addEventListener('input', () => {")
  const inputEnd = source.indexOf("editor.addEventListener('paste', (event) => {", inputStart)
  assert.ok(inputStart > -1 && inputEnd > inputStart, 'input listener bounds must exist')
  const inputSnippet = source.slice(inputStart, inputEnd)
  assert.equal(inputSnippet.includes('syncDesignOsDormantProductTruthAtSaveBoundary();'), false)
  assert.equal(inputSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)

  const resizeStart = source.lastIndexOf("window.addEventListener('resize', () => {")
  const resizeEnd = source.indexOf("if (window.electronAPI) {", resizeStart)
  assert.ok(resizeStart > -1 && resizeEnd > resizeStart, 'resize listener bounds must exist')
  const resizeSnippet = source.slice(resizeStart, resizeEnd)
  assert.equal(resizeSnippet.includes('syncDesignOsDormantProductTruthAtSaveBoundary();'), false)
  assert.equal(resizeSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

test('sector-m toolbar default surface visual return: hidden floating toolbar controls collapse at the css layer', () => {
  const styles = readFile(path.join('src', 'renderer', 'styles.css'))
  const runtimeProjection = readFile(path.join('src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs'))

  const hiddenRuleStart = styles.indexOf('.floating-toolbar__group[hidden],')
  assert.ok(hiddenRuleStart > -1, 'floating toolbar hidden collapse rule must exist')

  const hiddenRuleEnd = styles.indexOf('.floating-toolbar-spacing-menu {', hiddenRuleStart)
  assert.ok(hiddenRuleEnd > hiddenRuleStart, 'floating toolbar hidden collapse rule bounds must exist')

  const hiddenRuleSnippet = styles.slice(hiddenRuleStart, hiddenRuleEnd)

  assert.ok(hiddenRuleSnippet.includes('.floating-toolbar__group[hidden],'))
  assert.ok(hiddenRuleSnippet.includes('.floating-toolbar__button[hidden],'))
  assert.ok(hiddenRuleSnippet.includes('.floating-toolbar__select-wrap[hidden]'))
  assert.ok(hiddenRuleSnippet.includes('display: none !important;'))
  assert.ok(runtimeProjection.includes('descriptor.node.hidden = !visibleItemIdSet.has(descriptor.itemId);'))
  assert.ok(runtimeProjection.includes('groupDescriptor.element.hidden = !groupVisible;'))
})

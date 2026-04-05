const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readStylesSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles.css'), 'utf8')
}

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

function readRendererHtml() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8')
}

test('right inspector visibility: literal stage layout keeps three columns with right sidebar slot', () => {
  const css = readStylesSource()
  assert.ok(css.includes('.literal-stage-a .app-layout {'))
  assert.ok(css.includes('grid-template-columns: minmax(250px, var(--app-left-sidebar-width)) minmax(640px, 1fr) minmax(280px, var(--app-right-sidebar-width));'))
})

test('right inspector visibility: literal stage does not hide right sidebar and keeps right inspector host in markup', () => {
  const css = readStylesSource()
  const html = readRendererHtml()
  assert.ok(css.includes('.literal-stage-a .sidebar--right {'))
  assert.ok(css.includes('display: flex;'))
  assert.ok(html.includes('class="sidebar sidebar--right" data-right-sidebar'))
  assert.ok(html.includes('data-right-panel-inspector'))
})

test('right inspector visibility: runtime keeps right tab and panel wiring', () => {
  const source = readEditorSource()
  const css = readStylesSource()
  assert.ok(source.includes('const rightSidebar = document.querySelector(\'[data-right-sidebar]\');'))
  assert.ok(source.includes('const rightTabsHost = document.querySelector(\'[data-right-tabs]\');'))
  assert.ok(source.includes('const rightInspectorPanel = document.querySelector(\'[data-right-panel-inspector]\');'))
  assert.ok(source.includes('if (rightInspectorPanel) rightInspectorPanel.hidden = tab !== \'inspector\';'))
  assert.ok(css.includes('[data-right-tabs] .x101-tab-button,'))
  assert.ok(css.includes('[data-right-tabs] .x101-tab-button.toolbar__button--wide {'))
  assert.ok(css.includes('flex: 0 0 auto;'))
})

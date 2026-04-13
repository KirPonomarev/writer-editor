const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

test('toolbar profile ordering helper: editor wiring exposes draggable bucket items and bounded payload shape', () => {
  const source = readFile('src/renderer/editor.js')

  assert.ok(source.includes("item.draggable = true;"))
  assert.ok(source.includes("sourceType: isBucketItem ? 'bucket-item' : 'library-item'"))
  assert.ok(source.includes("bucketKey: isBucketItem"))
  assert.ok(source.includes("sourceIndex: isBucketItem ? sourceElement.dataset.bucketIndex || '' : undefined"))
  assert.ok(source.includes("event.dataTransfer.effectAllowed = isBucketItem ? 'move' : 'copy';"))
  assert.ok(source.includes('function getToolbarConfiguratorBucketInsertionIndex(bucket, event, hoveredItem = null)'))
  assert.ok(source.includes('function commitToolbarConfiguratorBucketDrop(payload, bucketKey, insertionIndex, hoveredItem = null)'))
  assert.ok(source.includes("setToolbarConfiguratorDropTarget(bucket, marker, hoveredItem instanceof HTMLElement && bucket.contains(hoveredItem) ? hoveredItem : null);"))
  assert.ok(source.includes("bucket.classList.remove('is-drop-target', 'is-drop-target-inside');"))
  assert.ok(source.includes('is-drop-target-before'))
  assert.ok(source.includes('is-drop-target-after'))
  assert.ok(source.includes('is-drop-target-inside'))
})

test('toolbar profile ordering helper: configurator styles include bounded reorder markers', () => {
  const styles = readFile('src/renderer/styles.css')

  assert.ok(styles.includes('.configurator-panel__bucket.is-drop-target-inside'))
  assert.ok(styles.includes('.configurator-panel__bucket-item.is-drop-target-before'))
  assert.ok(styles.includes('.configurator-panel__bucket-item.is-drop-target-after'))
  assert.ok(styles.includes('.configurator-panel__bucket-item.is-dragging'))
})

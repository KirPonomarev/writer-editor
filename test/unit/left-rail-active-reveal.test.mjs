import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLeftRailPresentationTree,
  resolveLeftRailActiveReveal,
} from '../../src/renderer/leftRailPresentationModel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function makeRawTree(sceneLabel = 'Сцена') {
  return {
    id: 'tree-node-root',
    kind: 'roman-tab-root',
    children: [{
      id: 'tree-node-roman',
      kind: 'roman-root',
      label: 'Roman',
      children: [{
        id: 'tree-node-part',
        kind: 'part',
        label: 'Часть I',
        children: [{
          id: 'tree-node-chapter',
          kind: 'chapter-folder',
          label: 'Глава 1',
          children: [{
            id: 'tree-node-scene',
            nodeId: 'tree-node-scene',
            kind: 'scene',
            label: sceneLabel,
            children: [],
          }],
        }],
      }, {
        id: 'tree-node-notes',
        kind: 'roman-section',
        label: 'карта идей',
        children: [],
      }],
    }],
  };
}

test('left rail presentation uses canonical Russian project labels', () => {
  const presentation = buildLeftRailPresentationTree(makeRawTree());

  assert.equal(presentation.label, 'Проект');
  assert.equal(presentation.children[0].label, 'Рукопись');
  assert.equal(presentation.children[1].label, 'Заметки');
});

test('active reveal opens every collapsed ancestor and remains stable after rename', () => {
  const initial = buildLeftRailPresentationTree(makeRawTree());
  const collapsed = new Set([
    'collapsed:left-rail:workspace',
    'collapsed:left-rail:manuscript',
    'collapsed:tree-node-part',
    'collapsed:tree-node-chapter',
  ]);
  const first = resolveLeftRailActiveReveal(initial, 'tree-node-scene', collapsed);

  assert.equal(first.found, true);
  assert.equal(first.changed, true);
  assert.deepEqual(first.ancestorKeys, [
    'left-rail:workspace',
    'left-rail:manuscript',
    'tree-node-part',
    'tree-node-chapter',
  ]);
  for (const key of first.ancestorKeys) {
    assert.equal(first.expandedKeys.has(key), true);
    assert.equal(first.expandedKeys.has(`collapsed:${key}`), false);
  }

  const renamed = buildLeftRailPresentationTree(makeRawTree('Сцена после переименования'));
  const second = resolveLeftRailActiveReveal(renamed, 'tree-node-scene', first.expandedKeys);
  assert.equal(second.found, true);
  assert.equal(second.changed, false);
  assert.deepEqual(second.ancestorKeys, first.ancestorKeys);
});

test('active reveal fails closed for an unknown identity and handles a large nested tree iteratively', () => {
  const root = { id: 'root', children: [] };
  let cursor = root;
  for (let index = 0; index < 1500; index += 1) {
    const child = { id: `node-${index}`, children: [] };
    cursor.children.push(child);
    cursor = child;
  }

  const missing = resolveLeftRailActiveReveal(root, 'missing', new Set(['keep']));
  assert.equal(missing.found, false);
  assert.deepEqual([...missing.expandedKeys], ['keep']);

  const found = resolveLeftRailActiveReveal(root, 'node-1499', new Set());
  assert.equal(found.found, true);
  assert.equal(found.ancestorKeys.length, 1500);
  assert.equal(found.expandedKeys.has('root'), true);
  assert.equal(found.expandedKeys.has('node-1498'), true);
});

test('navigator runtime scrolls the sole active row without focusing the navigator', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
  const revealStart = source.indexOf('function scheduleActiveTreeRowReveal(');
  const revealEnd = source.indexOf('function getEffectiveDocumentId(', revealStart);
  const revealSection = source.slice(revealStart, revealEnd);
  const renderStart = source.indexOf('function renderTreeNode(');
  const renderEnd = source.indexOf('function findRomanRootNode(', renderStart);
  const renderSection = source.slice(renderStart, renderEnd);

  assert.ok(revealStart >= 0 && revealEnd > revealStart);
  assert.match(revealSection, /data-active-document="true"/u);
  assert.match(revealSection, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/u);
  assert.equal(/activeRow\.focus\(/u.test(revealSection), false);
  assert.match(revealSection, /focusEditorSurface\('current'\)/u);
  assert.match(renderSection, /currentDocumentId === effectiveDocumentId/u);
  assert.match(renderSection, /row\.dataset\.activeDocument = 'true'/u);
  assert.match(renderSection, /row\.setAttribute\('aria-current', 'true'\)/u);
  assert.equal(/getTitleFromPath\(path\)/u.test(source), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDeterministicTreeNodeId,
  normalizeProjectTreeIdentity,
  reconcileProjectTreeIdentity,
  rebindProjectTreeIdentity,
} from '../../src/core/projectTreeIdentity.mjs';

test('project tree identity reconciles deterministically and idempotently', () => {
  const input = {
    projectId: 'project-one',
    registry: null,
    descriptors: [
      { bindingKey: 'virtual:roman-tab-root', kind: 'roman-tab-root' },
      { bindingKey: 'file:roman/01_part/01_scene.txt', kind: 'scene' },
    ],
  };
  const first = reconcileProjectTreeIdentity(input);
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(
    first.bindings['file:roman/01_part/01_scene.txt'],
    createDeterministicTreeNodeId('project-one', 'file:roman/01_part/01_scene.txt'),
  );

  const second = reconcileProjectTreeIdentity({ ...input, registry: first.value });
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
  assert.deepEqual(second.value, first.value);
  assert.deepEqual(second.bindings, first.bindings);
});

test('project tree identity preserves node and registry unknown fields', () => {
  const registry = {
    schemaVersion: 1,
    futureRegistryField: { keep: true },
    nodes: {
      'custom-node': {
        bindingKey: 'file:roman/scene.txt',
        kind: 'scene',
        present: true,
        futureNodeField: ['keep'],
      },
    },
  };
  const result = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry,
    descriptors: [{ bindingKey: 'file:roman/scene.txt', kind: 'scene' }],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.futureRegistryField, { keep: true });
  assert.deepEqual(result.value.nodes['custom-node'].futureNodeField, ['keep']);
});

test('project tree identity rebind preserves IDs for a renamed subtree', () => {
  const reconciled = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry: null,
    descriptors: [
      { bindingKey: 'file:roman/01_old', kind: 'part' },
      { bindingKey: 'file:roman/01_old/01_scene.txt', kind: 'scene' },
    ],
  });
  const parentId = reconciled.bindings['file:roman/01_old'];
  const sceneId = reconciled.bindings['file:roman/01_old/01_scene.txt'];

  const rebound = rebindProjectTreeIdentity({
    registry: reconciled.value,
    fromBindingKey: 'file:roman/01_old',
    toBindingKey: 'file:roman/01_new',
  });
  assert.equal(rebound.ok, true);
  assert.equal(rebound.value.nodes[parentId].bindingKey, 'file:roman/01_new');
  assert.equal(rebound.value.nodes[sceneId].bindingKey, 'file:roman/01_new/01_scene.txt');
});

test('project tree identity rejects duplicate bindings and unsafe keys', () => {
  const duplicate = normalizeProjectTreeIdentity({
    schemaVersion: 1,
    nodes: {
      one: { bindingKey: 'file:roman/scene.txt', kind: 'scene' },
      two: { bindingKey: 'file:roman/scene.txt', kind: 'scene' },
    },
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, 'E_TREE_IDENTITY_BINDING_DUPLICATE');

  const unsafe = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry: null,
    descriptors: [{ bindingKey: 'file:../outside.txt', kind: 'scene' }],
  });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.error.code, 'E_TREE_IDENTITY_DESCRIPTOR_INVALID');
});

test('project tree identity marks missing nodes without deleting identity', () => {
  const first = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry: null,
    descriptors: [{ bindingKey: 'file:roman/scene.txt', kind: 'scene' }],
  });
  const nodeId = first.bindings['file:roman/scene.txt'];
  const missing = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry: first.value,
    descriptors: [],
  });
  assert.equal(missing.ok, true);
  assert.equal(missing.value.nodes[nodeId].present, false);
});

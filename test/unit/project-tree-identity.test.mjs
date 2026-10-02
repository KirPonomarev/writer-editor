import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDeterministicTreeNodeId,
  planProjectTreeIdentityCohort,
  normalizeProjectTreeIdentity,
  reconcileProjectTreeIdentity,
  rebindProjectTreeIdentity,
  rebindProjectTreeIdentityBatch,
  upsertProjectTreeIdentityNode,
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

test('project tree identity upsert creates one stable live node without tombstoning peers', () => {
  const first = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry: null,
    descriptors: [{ bindingKey: 'file:roman/first.txt', kind: 'scene' }],
  });
  const upserted = upsertProjectTreeIdentityNode({
    projectId: 'project-one',
    registry: first.value,
    bindingKey: 'file:roman/second.txt',
    kind: 'scene',
  });
  assert.equal(upserted.ok, true);
  assert.equal(upserted.value.nodes[first.bindings['file:roman/first.txt']].present, true);
  assert.equal(upserted.value.nodes[upserted.nodeId].bindingKey, 'file:roman/second.txt');
  assert.equal(upserted.nodeId, createDeterministicTreeNodeId('project-one', 'file:roman/second.txt'));
});

test('project tree identity batch rebind preserves IDs across prefix swaps', () => {
  const first = reconcileProjectTreeIdentity({
    projectId: 'project-one',
    registry: null,
    descriptors: [
      { bindingKey: 'file:roman/01_first.txt', kind: 'scene' },
      { bindingKey: 'file:roman/02_second.txt', kind: 'scene' },
    ],
  });
  const firstId = first.bindings['file:roman/01_first.txt'];
  const secondId = first.bindings['file:roman/02_second.txt'];
  const rebound = rebindProjectTreeIdentityBatch({
    registry: first.value,
    moves: [
      { fromBindingKey: 'file:roman/01_first.txt', toBindingKey: 'file:roman/02_first.txt' },
      { fromBindingKey: 'file:roman/02_second.txt', toBindingKey: 'file:roman/01_second.txt' },
    ],
  });
  assert.equal(rebound.ok, true);
  assert.equal(rebound.value.nodes[firstId].bindingKey, 'file:roman/02_first.txt');
  assert.equal(rebound.value.nodes[secondId].bindingKey, 'file:roman/01_second.txt');
});


test('topology identity preserves left kind and retires merge-right before sibling permutation collision check', () => {
  const registry={schemaVersion:1,nodes:{a:{kind:'chapter-file',present:true,bindingKey:'file:roman/01_A.txt'},b:{kind:'chapter-file',present:true,bindingKey:'file:roman/02_B.txt'},c:{kind:'scene',present:true,bindingKey:'file:roman/03_C.txt'}}};
  const base={projectId:'p',operationId:'op',registry,bindings:[]};
  const split=planProjectTreeIdentityCohort({...base,operation:'split',topology:{sourceNodeId:'a',sourceRelativePath:'roman/01_A.txt',newRelativePath:'roman/01a_New.txt',boundaryRootIndex:1}});
  assert.equal(split.ok,true);assert.equal(split.createdNodeIds.length,1);assert.equal(split.value.nodes[split.createdNodeIds[0]].kind,'chapter-file');assert.deepEqual(split.value.nodes.a,registry.nodes.a);
  const merged=planProjectTreeIdentityCohort({...base,operation:'merge',topology:{leftNodeId:'a',leftRelativePath:'roman/01_A.txt',rightNodeId:'b',rightRelativePath:'roman/02_B.txt'},bindings:[{nodeId:'c',fromRelativePath:'roman/03_C.txt',toRelativePath:'roman/02_B.txt'}]});
  assert.equal(merged.ok,true);assert.equal(merged.value.nodes.b.present,false);assert.equal(merged.value.nodes.b.bindingKey,'virtual:retired:b');assert.equal(merged.value.nodes.c.bindingKey,'file:roman/02_B.txt');assert.deepEqual(merged.removedNodeIds,['b']);assert.equal(registry.nodes.b.present,true);
  const forged=planProjectTreeIdentityCohort({...base,operation:'split',topology:{sourceNodeId:'a',sourceRelativePath:'roman/02_B.txt',newRelativePath:'roman/04_New.txt'}});
  assert.equal(forged.ok,false);
});

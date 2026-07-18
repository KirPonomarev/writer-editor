import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NAVIGATOR_SELECTION_LIMIT,
  applyNavigatorSelection,
  buildNavigatorSelectionDescriptor,
  createNavigatorSelectionState,
  moveNavigatorFocus,
  reconcileNavigatorSelection,
} from '../../src/renderer/navigatorSelectionModel.mjs';

const ordered = ['scene-a', 'scene-b', 'scene-c', 'scene-d'];

test('navigator selection keeps active document outside transient selected state', () => {
  const selected = applyNavigatorSelection(createNavigatorSelectionState('project-a'), {
    nodeId: 'scene-b',
    orderedSelectableIds: ordered,
  });
  const descriptor = buildNavigatorSelectionDescriptor(selected, { activeDocumentId: 'scene-a' });

  assert.deepEqual(descriptor.selectedIds, ['scene-b']);
  assert.equal(descriptor.activeDocumentId, 'scene-a');
  assert.equal(descriptor.transient, true);
  assert.deepEqual(descriptor.scopes, ['flow', 'export']);
  assert.equal(JSON.stringify(descriptor).includes('/'), false);
});

test('pointer toggle and range selection are ordered and bounded', () => {
  let state = applyNavigatorSelection(createNavigatorSelectionState('project-a'), {
    nodeId: 'scene-b',
    orderedSelectableIds: ordered,
  });
  state = applyNavigatorSelection(state, {
    nodeId: 'scene-d',
    orderedSelectableIds: ordered,
    mode: 'range',
  });
  assert.deepEqual(state.selectedIds, ['scene-b', 'scene-c', 'scene-d']);

  state = applyNavigatorSelection(state, {
    nodeId: 'scene-c',
    orderedSelectableIds: ordered,
    mode: 'toggle',
  });
  assert.deepEqual(state.selectedIds, ['scene-b', 'scene-d']);

  const large = Array.from({ length: NAVIGATOR_SELECTION_LIMIT + 40 }, (_, index) => `scene-${index}`);
  let bounded = applyNavigatorSelection(createNavigatorSelectionState('project-a'), {
    nodeId: large[0],
    orderedSelectableIds: large,
  });
  bounded = applyNavigatorSelection(bounded, {
    nodeId: large.at(-1),
    orderedSelectableIds: large,
    mode: 'range',
  });
  assert.equal(bounded.selectedIds.length, NAVIGATOR_SELECTION_LIMIT);
  assert.deepEqual(bounded.selectedIds, large.slice(0, NAVIGATOR_SELECTION_LIMIT));
});

test('keyboard focus order is deterministic and does not mutate selection', () => {
  const initial = applyNavigatorSelection(createNavigatorSelectionState('project-a'), {
    nodeId: 'scene-b',
    orderedSelectableIds: ordered,
  });
  const previous = moveNavigatorFocus(initial, {
    orderedIds: ordered,
    currentId: 'scene-b',
    direction: 'previous',
  });
  const last = moveNavigatorFocus(previous, { orderedIds: ordered, direction: 'last' });

  assert.equal(previous.focusedId, 'scene-a');
  assert.equal(last.focusedId, 'scene-d');
  assert.deepEqual(last.selectedIds, ['scene-b']);
});

test('reconcile drops invalid ids and project switch clears transient state', () => {
  const state = {
    projectId: 'project-a',
    selectedIds: ['scene-a', 'scene-missing'],
    anchorId: 'scene-missing',
    focusedId: 'folder-missing',
  };
  const reconciled = reconcileNavigatorSelection(state, {
    projectId: 'project-a',
    availableIds: ['scene-a', 'folder-a'],
    selectableIds: ['scene-a'],
  });
  assert.deepEqual(reconciled, {
    projectId: 'project-a',
    selectedIds: ['scene-a'],
    anchorId: 'scene-a',
    focusedId: '',
  });

  assert.deepEqual(
    reconcileNavigatorSelection(reconciled, {
      projectId: 'project-b',
      availableIds: ['scene-a'],
      selectableIds: ['scene-a'],
    }),
    createNavigatorSelectionState('project-b'),
  );
});

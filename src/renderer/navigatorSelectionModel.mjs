export const NAVIGATOR_SELECTION_LIMIT = 100;

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIdList(values, limit = NAVIGATOR_SELECTION_LIMIT) {
  const ids = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }
  return ids;
}

export function createNavigatorSelectionState(projectId = '') {
  return {
    projectId: normalizeId(projectId),
    selectedIds: [],
    anchorId: '',
    focusedId: '',
  };
}

export function reconcileNavigatorSelection(state, {
  projectId = '',
  availableIds = [],
  selectableIds = [],
} = {}) {
  const nextProjectId = normalizeId(projectId);
  const source = state && typeof state === 'object'
    ? state
    : createNavigatorSelectionState(nextProjectId);
  if (normalizeId(source.projectId) !== nextProjectId) {
    return createNavigatorSelectionState(nextProjectId);
  }

  const available = new Set(normalizeIdList(availableIds, Number.MAX_SAFE_INTEGER));
  const selectable = new Set(
    normalizeIdList(selectableIds, Number.MAX_SAFE_INTEGER).filter((id) => available.has(id)),
  );
  const selectedIds = normalizeIdList(source.selectedIds)
    .filter((id) => selectable.has(id));
  const focusedId = available.has(normalizeId(source.focusedId))
    ? normalizeId(source.focusedId)
    : '';
  const anchorId = selectable.has(normalizeId(source.anchorId))
    ? normalizeId(source.anchorId)
    : (selectedIds.at(-1) || '');

  return { projectId: nextProjectId, selectedIds, anchorId, focusedId };
}

export function applyNavigatorSelection(state, {
  nodeId = '',
  orderedSelectableIds = [],
  mode = 'single',
  additive = false,
} = {}) {
  const source = state && typeof state === 'object'
    ? state
    : createNavigatorSelectionState();
  const ordered = normalizeIdList(orderedSelectableIds, Number.MAX_SAFE_INTEGER);
  const targetId = normalizeId(nodeId);
  if (!targetId || !ordered.includes(targetId)) {
    return { ...source, selectedIds: normalizeIdList(source.selectedIds) };
  }

  const current = normalizeIdList(source.selectedIds);
  if (mode === 'toggle') {
    const selected = new Set(current);
    if (selected.has(targetId)) selected.delete(targetId);
    else if (selected.size < NAVIGATOR_SELECTION_LIMIT) selected.add(targetId);
    return {
      ...source,
      selectedIds: ordered.filter((id) => selected.has(id)).slice(0, NAVIGATOR_SELECTION_LIMIT),
      anchorId: targetId,
      focusedId: targetId,
    };
  }

  if (mode === 'range') {
    const anchorId = ordered.includes(normalizeId(source.anchorId))
      ? normalizeId(source.anchorId)
      : targetId;
    const start = ordered.indexOf(anchorId);
    const end = ordered.indexOf(targetId);
    const range = ordered.slice(Math.min(start, end), Math.max(start, end) + 1);
    const selected = additive ? new Set(current) : new Set();
    for (const id of range) {
      if (selected.size >= NAVIGATOR_SELECTION_LIMIT) break;
      selected.add(id);
    }
    return {
      ...source,
      selectedIds: ordered.filter((id) => selected.has(id)).slice(0, NAVIGATOR_SELECTION_LIMIT),
      anchorId,
      focusedId: targetId,
    };
  }

  return {
    ...source,
    selectedIds: [targetId],
    anchorId: targetId,
    focusedId: targetId,
  };
}

export function moveNavigatorFocus(state, {
  orderedIds = [],
  currentId = '',
  direction = 'next',
} = {}) {
  const source = state && typeof state === 'object'
    ? state
    : createNavigatorSelectionState();
  const ordered = normalizeIdList(orderedIds, Number.MAX_SAFE_INTEGER);
  if (ordered.length === 0) return { ...source, focusedId: '' };

  const current = normalizeId(currentId) || normalizeId(source.focusedId);
  const currentIndex = ordered.indexOf(current);
  let nextIndex = currentIndex >= 0 ? currentIndex : 0;
  if (direction === 'first') nextIndex = 0;
  else if (direction === 'last') nextIndex = ordered.length - 1;
  else if (direction === 'previous') nextIndex = Math.max(0, nextIndex - 1);
  else nextIndex = Math.min(ordered.length - 1, nextIndex + (currentIndex >= 0 ? 1 : 0));

  return { ...source, focusedId: ordered[nextIndex] };
}

export function buildNavigatorSelectionDescriptor(state, {
  activeDocumentId = '',
} = {}) {
  const source = state && typeof state === 'object'
    ? state
    : createNavigatorSelectionState();
  return Object.freeze({
    schemaVersion: 1,
    projectId: normalizeId(source.projectId),
    selectedIds: Object.freeze(normalizeIdList(source.selectedIds)),
    focusedId: normalizeId(source.focusedId),
    activeDocumentId: normalizeId(activeDocumentId),
    scopes: Object.freeze(['flow', 'export']),
    transient: true,
  });
}

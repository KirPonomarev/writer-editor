const NOTES_SECTION_LABELS = new Set([
  'карта идей',
  'поток сознания',
  'сны',
  'статистика',
]);

function normalizeNodeLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function createPresentationGroup({
  id,
  label,
  kind,
  children = [],
  expandKey,
  defaultExpanded = true,
}) {
  return {
    id,
    name: label,
    label,
    kind,
    path: '',
    children,
    presentationKind: kind,
    presentationExpandKey: expandKey || id,
    presentationDefaultExpanded: defaultExpanded,
  };
}

function cloneRawNodeForPresentation(node, bucketKind = 'manuscript') {
  if (!node || typeof node !== 'object') return null;
  const children = Array.isArray(node.children)
    ? node.children
        .map((child) => cloneRawNodeForPresentation(child, bucketKind))
        .filter(Boolean)
    : [];

  return {
    ...node,
    children,
    effectivePath: typeof node.path === 'string' ? node.path : '',
    effectiveKind: typeof node.kind === 'string' ? node.kind : '',
    presentationKind:
      typeof node.kind === 'string' && node.kind.length > 0
        ? node.kind
        : `${bucketKind}-document`,
  };
}

function findRomanRootNode(root) {
  if (!root || typeof root !== 'object') return null;
  if (root.kind === 'roman-root') return root;
  if (!Array.isArray(root.children)) return null;
  return root.children.find((child) => child && child.kind === 'roman-root') || null;
}

function shouldRenderInNotesBucket(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.kind !== 'roman-section') return false;
  return NOTES_SECTION_LABELS.has(normalizeNodeLabel(node.label || node.name));
}

export function buildLeftRailPresentationTree(rawRoot) {
  const romanRoot = findRomanRootNode(rawRoot);
  if (!romanRoot) return rawRoot;

  const rawChildren = Array.isArray(romanRoot.children) ? romanRoot.children : [];
  const manuscriptChildren = [];
  const notesChildren = [];

  rawChildren.forEach((child) => {
    const bucketKind = shouldRenderInNotesBucket(child) ? 'notes' : 'manuscript';
    const cloned = cloneRawNodeForPresentation(child, bucketKind);
    if (!cloned) return;
    if (bucketKind === 'notes') {
      notesChildren.push(cloned);
      return;
    }
    manuscriptChildren.push(cloned);
  });

  const workspaceChildren = [];

  if (manuscriptChildren.length) {
    workspaceChildren.push(
      createPresentationGroup({
        id: 'left-rail-manuscript',
        label: 'Manuscript',
        kind: 'presentation-manuscript',
        children: manuscriptChildren,
        expandKey: 'left-rail:manuscript',
      }),
    );
  }

  if (notesChildren.length) {
    workspaceChildren.push(
      createPresentationGroup({
        id: 'left-rail-notes',
        label: 'Notes',
        kind: 'presentation-notes',
        children: notesChildren,
        expandKey: 'left-rail:notes',
      }),
    );
  }

  return createPresentationGroup({
    id: 'left-rail-workspace',
    label: 'Workspace',
    kind: 'presentation-workspace',
    children: workspaceChildren,
    expandKey: 'left-rail:workspace',
  });
}

export function getLeftRailPresentationExpandKey(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.presentationExpandKey === 'string' && node.presentationExpandKey) {
    return node.presentationExpandKey;
  }
  if (typeof node.path === 'string' && node.path) return node.path;
  return typeof node.id === 'string' ? node.id : '';
}

export function getLeftRailPresentationKind(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.presentationKind === 'string' && node.presentationKind) {
    return node.presentationKind;
  }
  return typeof node.kind === 'string' ? node.kind : '';
}

export function isLeftRailPresentationDefaultExpanded(node) {
  return Boolean(node && node.presentationDefaultExpanded);
}

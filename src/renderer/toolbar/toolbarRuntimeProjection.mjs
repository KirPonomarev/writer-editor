import { listLiveToolbarFunctionCatalogEntries } from './toolbarFunctionCatalog.mjs';

const DEFAULT_GROUP_SELECTOR = '.floating-toolbar__group';
const TOOLBAR_ITEM_SELECTOR = '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]';

function isNodeLike(value) {
  return Boolean(value) && typeof value === 'object';
}

function queryNode(root, selector) {
  if (!isNodeLike(root) || typeof root.querySelector !== 'function') {
    return null;
  }
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function queryAllNodes(root, selector) {
  if (!isNodeLike(root) || typeof root.querySelectorAll !== 'function') {
    return [];
  }
  try {
    const result = root.querySelectorAll(selector);
    return Array.isArray(result) ? result : Array.from(result || []);
  } catch {
    return [];
  }
}

function resolveClosestGroup(node, groupSelector) {
  if (!isNodeLike(node) || typeof node.closest !== 'function') {
    return null;
  }
  try {
    return node.closest(groupSelector);
  } catch {
    return null;
  }
}

function normalizeCatalogEntries(catalogEntries) {
  const entries = Array.isArray(catalogEntries) && catalogEntries.length > 0
    ? catalogEntries
    : listLiveToolbarFunctionCatalogEntries();
  return entries.filter((entry) => entry?.implementationState === 'live');
}

function normalizeVisibleItemIds(profileState, catalogEntries) {
  const normalizedCatalogEntries = normalizeCatalogEntries(catalogEntries);
  const availableIds = new Set(normalizedCatalogEntries.map((entry) => entry.id));
  const rawMinimal = profileState?.toolbarProfiles?.minimal;
  const rawIds = Array.isArray(rawMinimal) ? rawMinimal : [];
  const requestedIds = new Set();

  for (const rawId of rawIds) {
    const itemId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!itemId || !availableIds.has(itemId)) {
      continue;
    }
    requestedIds.add(itemId);
  }

  return normalizedCatalogEntries
    .map((entry) => entry.id)
    .filter((itemId) => requestedIds.has(itemId));
}

function normalizeRegistryInput(input) {
  if (isNodeLike(input) && !Array.isArray(input) && !Object.prototype.hasOwnProperty.call(input, 'toolbar')) {
    return { toolbar: input };
  }
  return isNodeLike(input) ? input : {};
}

function getDescriptorNodeBindKey(node) {
  if (!isNodeLike(node) || !isNodeLike(node.dataset)) {
    return '';
  }
  const rawBindKey = node.dataset.toolbarItemKey || node.dataset.bindKey || node.dataset.toolbarBindKey || '';
  return typeof rawBindKey === 'string' ? rawBindKey.trim() : '';
}

function getParagraphTriggerDescriptor(registry) {
  return Array.isArray(registry?.itemDescriptors)
    ? registry.itemDescriptors.find((descriptor) => descriptor.bindKey === 'paragraph-trigger') || null
    : null;
}

function closeParagraphOverlay(registry, paragraphTriggerVisible) {
  if (!registry?.paragraphMenu || registry.paragraphMenu.hidden === true || paragraphTriggerVisible) {
    return;
  }
  registry.paragraphMenu.hidden = true;
  const paragraphTriggerButton = registry.paragraphTriggerButton || getParagraphTriggerDescriptor(registry)?.node || null;
  if (paragraphTriggerButton && typeof paragraphTriggerButton.setAttribute === 'function') {
    paragraphTriggerButton.setAttribute('aria-expanded', 'false');
  }
}

function closeSpacingOverlay(registry) {
  if (!registry?.toolbarSpacingMenu || registry.toolbarSpacingMenu.hidden === true) {
    return;
  }
  registry.toolbarSpacingMenu.hidden = true;
}

function buildGroupDescriptors(groupElements, itemDescriptors) {
  return groupElements.map((groupElement) => Object.freeze({
    element: groupElement,
    itemDescriptors: Object.freeze(itemDescriptors.filter((descriptor) => descriptor.groupElement === groupElement)),
  }));
}

export function collectVisibleToolbarItemIdsFromState(profileState, catalogEntries) {
  return Object.freeze([...normalizeVisibleItemIds(profileState, catalogEntries)]);
}

export function createToolbarRuntimeRegistry(input = {}) {
  const options = normalizeRegistryInput(input);
  const toolbarRoot = isNodeLike(options.toolbar) ? options.toolbar : null;
  const toolbarShell = isNodeLike(options.toolbarShell)
    ? options.toolbarShell
    : (
      queryNode(toolbarRoot, '[data-toolbar-shell]')
      || queryNode(toolbarRoot, '.floating-toolbar__shell')
      || toolbarRoot
    );
  const groupSelector = typeof options.groupSelector === 'string' && options.groupSelector.trim()
    ? options.groupSelector.trim()
    : DEFAULT_GROUP_SELECTOR;
  const catalogEntries = normalizeCatalogEntries(options.catalogEntries);
  const orderedGroupElements = queryAllNodes(toolbarShell, groupSelector);
  const groupNodeByBindKey = new Map();
  const groupElementByBindKey = new Map();

  for (const groupElement of orderedGroupElements) {
    for (const node of queryAllNodes(groupElement, TOOLBAR_ITEM_SELECTOR)) {
      const bindKey = getDescriptorNodeBindKey(node);
      if (!bindKey || groupNodeByBindKey.has(bindKey)) {
        continue;
      }
      groupNodeByBindKey.set(bindKey, node);
      groupElementByBindKey.set(bindKey, groupElement);
    }
  }

  const itemDescriptors = [];
  const itemDescriptorById = new Map();
  const missingBindKeys = [];

  for (const entry of catalogEntries) {
    const bindKey = typeof entry.bindKey === 'string' ? entry.bindKey.trim() : '';
    const selector = bindKey ? `[data-toolbar-item-key="${bindKey}"]` : '';
    const node = selector
      ? (
        queryNode(toolbarRoot, selector)
        || queryNode(toolbarShell, selector)
        || groupNodeByBindKey.get(bindKey)
      )
      : null;
    const groupElement = resolveClosestGroup(node, groupSelector) || groupElementByBindKey.get(bindKey) || null;

    if (!node && bindKey) {
      missingBindKeys.push(bindKey);
    }

    const descriptor = Object.freeze({
      itemId: entry.id,
      bindKey,
      node,
      groupElement,
      catalogEntry: entry,
    });

    itemDescriptors.push(descriptor);
    itemDescriptorById.set(entry.id, descriptor);
  }

  const groupElements = orderedGroupElements.length > 0
    ? orderedGroupElements
    : Array.from(new Set(itemDescriptors.map((descriptor) => descriptor.groupElement).filter(Boolean)));
  const groupDescriptors = buildGroupDescriptors(groupElements, itemDescriptors);

  return Object.freeze({
    toolbarRoot,
    toolbarShell,
    groupSelector,
    catalogEntries: Object.freeze([...catalogEntries]),
    itemDescriptors: Object.freeze(itemDescriptors),
    itemDescriptorById,
    groupDescriptors: Object.freeze(groupDescriptors),
    missingBindKeys: Object.freeze([...missingBindKeys]),
    paragraphMenu: isNodeLike(options.paragraphMenu)
      ? options.paragraphMenu
      : queryNode(toolbarShell, '[data-paragraph-menu]'),
    toolbarSpacingMenu: isNodeLike(options.toolbarSpacingMenu)
      ? options.toolbarSpacingMenu
      : queryNode(toolbarShell, '[data-toolbar-spacing-menu]'),
    paragraphTriggerButton: isNodeLike(options.paragraphTriggerButton)
      ? options.paragraphTriggerButton
      : queryNode(toolbarShell, '[data-toolbar-item-key="paragraph-trigger"]'),
  });
}

export function resolveToolbarRuntimeSnapshot(registry) {
  const itemDescriptors = Array.isArray(registry?.itemDescriptors) ? registry.itemDescriptors : [];
  const groupDescriptors = Array.isArray(registry?.groupDescriptors) ? registry.groupDescriptors : [];
  const visibleItemIds = [];
  const hiddenItemIds = [];
  const visibleBindKeys = [];
  const hiddenBindKeys = [];
  const groupVisibleBindKeys = [];

  for (const descriptor of itemDescriptors) {
    const node = descriptor?.node;
    if (!node) {
      continue;
    }
    const isVisible = node.hidden !== true;
    if (isVisible) {
      visibleItemIds.push(descriptor.itemId);
      visibleBindKeys.push(descriptor.bindKey);
    } else {
      hiddenItemIds.push(descriptor.itemId);
      hiddenBindKeys.push(descriptor.bindKey);
    }
  }

  for (const groupDescriptor of groupDescriptors) {
    const visibleKeys = groupDescriptor.itemDescriptors
      .filter((descriptor) => descriptor.node && descriptor.node.hidden !== true)
      .map((descriptor) => descriptor.bindKey);
    groupVisibleBindKeys.push(Object.freeze(visibleKeys));
  }

  const paragraphTriggerDescriptor = getParagraphTriggerDescriptor(registry);
  const paragraphTriggerVisible = Boolean(paragraphTriggerDescriptor?.node) && paragraphTriggerDescriptor.node.hidden !== true;
  const spacingMenuVisible = Boolean(registry?.toolbarSpacingMenu) && registry.toolbarSpacingMenu.hidden !== true;

  return Object.freeze({
    visibleItemIds: Object.freeze(visibleItemIds),
    hiddenItemIds: Object.freeze(hiddenItemIds),
    visibleBindKeys: Object.freeze(visibleBindKeys),
    hiddenBindKeys: Object.freeze(hiddenBindKeys),
    missingBindKeys: Array.isArray(registry?.missingBindKeys) ? registry.missingBindKeys : Object.freeze([]),
    groupVisibleBindKeys: Object.freeze(groupVisibleBindKeys),
    paragraphTriggerVisible,
    spacingMenuVisible,
    hasVisibleItems: visibleItemIds.length > 0,
    anchorResyncRequired: true,
  });
}

export function applyToolbarProfileMinimal(registry, profileState) {
  const catalogEntries = Array.isArray(registry?.catalogEntries) ? registry.catalogEntries : [];
  const visibleItemIds = normalizeVisibleItemIds(profileState, catalogEntries);
  const visibleItemIdSet = new Set(visibleItemIds);
  const itemDescriptors = Array.isArray(registry?.itemDescriptors) ? registry.itemDescriptors : [];

  for (const descriptor of itemDescriptors) {
    if (!descriptor?.node) {
      continue;
    }
    descriptor.node.hidden = !visibleItemIdSet.has(descriptor.itemId);
  }

  const groupDescriptors = Array.isArray(registry?.groupDescriptors) ? registry.groupDescriptors : [];
  for (const groupDescriptor of groupDescriptors) {
    if (!groupDescriptor?.element) {
      continue;
    }
    const groupVisible = groupDescriptor.itemDescriptors.some((descriptor) => descriptor.node && descriptor.node.hidden !== true);
    groupDescriptor.element.hidden = !groupVisible;
  }

  const paragraphTriggerDescriptor = getParagraphTriggerDescriptor(registry);
  const paragraphTriggerVisible = Boolean(paragraphTriggerDescriptor?.node) && paragraphTriggerDescriptor.node.hidden !== true;
  closeParagraphOverlay(registry, paragraphTriggerVisible);
  closeSpacingOverlay(registry);

  return resolveToolbarRuntimeSnapshot(registry);
}

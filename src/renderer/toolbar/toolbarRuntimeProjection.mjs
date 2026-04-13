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

function normalizeProfileName(profileName) {
  return profileName === 'master' ? 'master' : 'minimal';
}

function getToolbarProfileIds(profileState, profileName) {
  const normalizedProfileName = normalizeProfileName(profileName);
  const toolbarProfiles = profileState?.toolbarProfiles;
  if (!toolbarProfiles || typeof toolbarProfiles !== 'object') {
    return [];
  }
  const profileIds = toolbarProfiles[normalizedProfileName];
  return Array.isArray(profileIds) ? profileIds : [];
}

function normalizeVisibleItemIds(profileState, catalogEntries, profileName = profileState?.activeToolbarProfile) {
  const normalizedCatalogEntries = normalizeCatalogEntries(catalogEntries);
  const availableIds = new Set(normalizedCatalogEntries.map((entry) => entry.id));
  const rawIds = getToolbarProfileIds(profileState, profileName);
  const requestedIds = new Set();
  const orderedIds = [];

  for (const rawId of rawIds) {
    const itemId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!itemId || !availableIds.has(itemId)) {
      continue;
    }
    if (requestedIds.has(itemId)) {
      continue;
    }
    requestedIds.add(itemId);
    orderedIds.push(itemId);
  }

  return orderedIds.filter((itemId) => requestedIds.has(itemId));
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

function getListTriggerDescriptor(registry) {
  return Array.isArray(registry?.itemDescriptors)
    ? registry.itemDescriptors.find((descriptor) => descriptor.bindKey === 'list-type') || null
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

function closeListOverlay(registry, listTriggerVisible) {
  if (!registry?.listMenu || registry.listMenu.hidden === true || listTriggerVisible) {
    return;
  }
  registry.listMenu.hidden = true;
  const listTriggerButton = registry.listTriggerButton || getListTriggerDescriptor(registry)?.node || null;
  if (listTriggerButton && typeof listTriggerButton.setAttribute === 'function') {
    listTriggerButton.setAttribute('aria-expanded', 'false');
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

function getToolbarControlsContainer(registry) {
  if (isNodeLike(registry?.controlsContainer)) {
    return registry.controlsContainer;
  }
  if (isNodeLike(registry?.toolbarShell)) {
    const controlsContainer = queryNode(registry.toolbarShell, '.floating-toolbar__controls');
    return isNodeLike(controlsContainer) ? controlsContainer : registry.toolbarShell;
  }
  return null;
}

function getOrderedGroupElements(registry) {
  const controlsContainer = getToolbarControlsContainer(registry);
  const groupSelector = typeof registry?.groupSelector === 'string' && registry.groupSelector.length > 0
    ? registry.groupSelector
    : DEFAULT_GROUP_SELECTOR;
  const orderedGroupElements = queryAllNodes(controlsContainer, groupSelector);
  if (orderedGroupElements.length > 0) {
    return orderedGroupElements;
  }
  return Array.isArray(registry?.groupDescriptors)
    ? registry.groupDescriptors.map((groupDescriptor) => groupDescriptor.element).filter(Boolean)
    : [];
}

function getItemDescriptorByNode(registry, node) {
  if (!isNodeLike(node) || !isNodeLike(registry?.itemDescriptorByNode)) {
    return null;
  }
  return registry.itemDescriptorByNode.get(node) || null;
}

function moveNodeBefore(parentNode, node, beforeNode) {
  if (!isNodeLike(parentNode) || !isNodeLike(node) || typeof parentNode.insertBefore !== 'function') {
    return;
  }
  if (node === beforeNode) {
    return;
  }
  try {
    parentNode.insertBefore(node, beforeNode || null);
  } catch {
    // Bounded reorder must fail safe without throwing into projection callers.
  }
}

function getVisibleItemIndexMap(visibleItemIds) {
  const indexByItemId = new Map();
  for (let index = 0; index < visibleItemIds.length; index += 1) {
    indexByItemId.set(visibleItemIds[index], index);
  }
  return indexByItemId;
}

function reorderVisibleItemsWithinGroup(groupDescriptor, visibleItemIndexById, visibleItemIdSet) {
  if (!groupDescriptor?.element || !Array.isArray(groupDescriptor.itemDescriptors)) {
    return;
  }

  const visibleDescriptors = groupDescriptor.itemDescriptors
    .filter((descriptor) => descriptor?.node && visibleItemIdSet.has(descriptor.itemId))
    .sort((left, right) => {
      const leftIndex = visibleItemIndexById.get(left.itemId) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = visibleItemIndexById.get(right.itemId) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });

  for (let index = visibleDescriptors.length - 1; index >= 0; index -= 1) {
    const descriptor = visibleDescriptors[index];
    const beforeNode = visibleDescriptors[index + 1]?.node || null;
    moveNodeBefore(groupDescriptor.element, descriptor.node, beforeNode);
  }
}

function reorderVisibleGroups(registry, visibleItemIndexById) {
  const controlsContainer = getToolbarControlsContainer(registry);
  if (!isNodeLike(controlsContainer) || typeof controlsContainer.insertBefore !== 'function') {
    return;
  }

  const groupDescriptors = Array.isArray(registry?.groupDescriptors) ? registry.groupDescriptors : [];
  const rankedGroupDescriptors = groupDescriptors
    .map((groupDescriptor, index) => {
      const visibleIndexes = Array.isArray(groupDescriptor?.itemDescriptors)
        ? groupDescriptor.itemDescriptors
          .filter((descriptor) => descriptor?.node && descriptor.node.hidden !== true)
          .map((descriptor) => visibleItemIndexById.get(descriptor.itemId))
          .filter((value) => Number.isFinite(value))
        : [];
      return {
        groupDescriptor,
        index,
        rank: visibleIndexes.length > 0 ? Math.min(...visibleIndexes) : Number.POSITIVE_INFINITY,
      };
    })
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.index - right.index;
    });

  for (let index = rankedGroupDescriptors.length - 1; index >= 0; index -= 1) {
    const descriptor = rankedGroupDescriptors[index].groupDescriptor;
    const beforeElement = rankedGroupDescriptors[index + 1]?.groupDescriptor.element || null;
    moveNodeBefore(controlsContainer, descriptor.element, beforeElement);
  }
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
  const controlsContainer = queryNode(toolbarShell, '.floating-toolbar__controls') || toolbarShell;
  const groupSelector = typeof options.groupSelector === 'string' && options.groupSelector.trim()
    ? options.groupSelector.trim()
    : DEFAULT_GROUP_SELECTOR;
  const catalogEntries = normalizeCatalogEntries(options.catalogEntries);
  const orderedGroupElements = queryAllNodes(controlsContainer, groupSelector);
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
  const itemDescriptorByNode = new Map();
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
    if (node) {
      itemDescriptorByNode.set(node, descriptor);
    }
  }

  const groupElements = orderedGroupElements.length > 0
    ? orderedGroupElements
    : Array.from(new Set(itemDescriptors.map((descriptor) => descriptor.groupElement).filter(Boolean)));
  const groupDescriptors = buildGroupDescriptors(groupElements, itemDescriptors);

  return Object.freeze({
    toolbarRoot,
    toolbarShell,
    controlsContainer,
    groupSelector,
    catalogEntries: Object.freeze([...catalogEntries]),
    itemDescriptors: Object.freeze(itemDescriptors),
    itemDescriptorById,
    itemDescriptorByNode,
    groupDescriptors: Object.freeze(groupDescriptors),
    missingBindKeys: Object.freeze([...missingBindKeys]),
    paragraphMenu: isNodeLike(options.paragraphMenu)
      ? options.paragraphMenu
      : queryNode(toolbarShell, '[data-paragraph-menu]'),
    toolbarSpacingMenu: isNodeLike(options.toolbarSpacingMenu)
      ? options.toolbarSpacingMenu
      : queryNode(toolbarShell, '[data-toolbar-spacing-menu]'),
    listMenu: isNodeLike(options.listMenu)
      ? options.listMenu
      : queryNode(toolbarShell, '[data-list-menu]'),
    paragraphTriggerButton: isNodeLike(options.paragraphTriggerButton)
      ? options.paragraphTriggerButton
      : queryNode(toolbarShell, '[data-toolbar-item-key="paragraph-trigger"]'),
    listTriggerButton: isNodeLike(options.listTriggerButton)
      ? options.listTriggerButton
      : queryNode(toolbarShell, '[data-toolbar-item-key="list-type"]'),
  });
}

export function resolveToolbarRuntimeSnapshot(registry) {
  const itemDescriptors = Array.isArray(registry?.itemDescriptors) ? registry.itemDescriptors : [];
  const groupDescriptors = Array.isArray(registry?.groupDescriptors) ? registry.groupDescriptors : [];
  const itemDescriptorByNode = isNodeLike(registry?.itemDescriptorByNode) ? registry.itemDescriptorByNode : new Map();
  const orderedGroupElements = getOrderedGroupElements(registry);
  const visibleItemIds = [];
  const hiddenItemIds = [];
  const visibleBindKeys = [];
  const hiddenBindKeys = [];
  const groupVisibleBindKeys = [];

  for (const groupElement of orderedGroupElements) {
    const visibleKeys = [];
    const groupNodes = queryAllNodes(groupElement, TOOLBAR_ITEM_SELECTOR);
    for (const node of groupNodes) {
      const descriptor = itemDescriptorByNode.get(node) || itemDescriptors.find((itemDescriptor) => itemDescriptor?.node === node) || null;
      if (!descriptor) {
        continue;
      }
      if (node.hidden !== true) {
        visibleItemIds.push(descriptor.itemId);
        visibleBindKeys.push(descriptor.bindKey);
        visibleKeys.push(descriptor.bindKey);
      } else {
        hiddenItemIds.push(descriptor.itemId);
        hiddenBindKeys.push(descriptor.bindKey);
      }
    }
    groupVisibleBindKeys.push(Object.freeze(visibleKeys));
  }

  const paragraphTriggerDescriptor = getParagraphTriggerDescriptor(registry);
  const paragraphTriggerVisible = Boolean(paragraphTriggerDescriptor?.node) && paragraphTriggerDescriptor.node.hidden !== true;
  const listTriggerDescriptor = getListTriggerDescriptor(registry);
  const listTriggerVisible = Boolean(listTriggerDescriptor?.node) && listTriggerDescriptor.node.hidden !== true;
  const spacingMenuVisible = Boolean(registry?.toolbarSpacingMenu) && registry.toolbarSpacingMenu.hidden !== true;
  const listMenuVisible = Boolean(registry?.listMenu) && registry.listMenu.hidden !== true;

  return Object.freeze({
    visibleItemIds: Object.freeze(visibleItemIds),
    hiddenItemIds: Object.freeze(hiddenItemIds),
    visibleBindKeys: Object.freeze(visibleBindKeys),
    hiddenBindKeys: Object.freeze(hiddenBindKeys),
    missingBindKeys: Array.isArray(registry?.missingBindKeys) ? registry.missingBindKeys : Object.freeze([]),
    groupVisibleBindKeys: Object.freeze(groupVisibleBindKeys),
    paragraphTriggerVisible,
    listTriggerVisible,
    spacingMenuVisible,
    listMenuVisible,
    hasVisibleItems: visibleItemIds.length > 0,
    anchorResyncRequired: true,
  });
}

export function applyToolbarActiveProfile(registry, profileState) {
  const catalogEntries = Array.isArray(registry?.catalogEntries) ? registry.catalogEntries : [];
  const visibleItemIds = normalizeVisibleItemIds(profileState, catalogEntries);
  const visibleItemIdSet = new Set(visibleItemIds);
  const itemDescriptors = Array.isArray(registry?.itemDescriptors) ? registry.itemDescriptors : [];
  const visibleItemIndexById = getVisibleItemIndexMap(visibleItemIds);

  for (const descriptor of itemDescriptors) {
    if (!descriptor?.node) {
      continue;
    }
    descriptor.node.hidden = !visibleItemIdSet.has(descriptor.itemId);
  }

  for (const groupDescriptor of Array.isArray(registry?.groupDescriptors) ? registry.groupDescriptors : []) {
    reorderVisibleItemsWithinGroup(groupDescriptor, visibleItemIndexById, visibleItemIdSet);
  }
  reorderVisibleGroups(registry, visibleItemIndexById);

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
  const listTriggerDescriptor = getListTriggerDescriptor(registry);
  const listTriggerVisible = Boolean(listTriggerDescriptor?.node) && listTriggerDescriptor.node.hidden !== true;
  closeParagraphOverlay(registry, paragraphTriggerVisible);
  closeListOverlay(registry, listTriggerVisible);
  closeSpacingOverlay(registry);

  return resolveToolbarRuntimeSnapshot(registry);
}

export function applyToolbarProfileMinimal(registry, profileState) {
  return applyToolbarActiveProfile(registry, {
    ...(profileState && typeof profileState === 'object' && !Array.isArray(profileState) ? profileState : {}),
    activeToolbarProfile: 'minimal',
  });
}

import { listCommandCatalog } from './command-catalog.v1.mjs';
import { annotateSurfaceEntriesForEntitlement } from './localCapabilityProvider.mjs';

function normalizeEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (typeof input.id !== 'string' || input.id.trim().length === 0) return null;
  const surface = Array.isArray(input.surface)
    ? [...new Set(input.surface.filter((item) => typeof item === 'string' && item.trim().length > 0))]
    : [];
  return {
    id: input.id.trim(),
    label: typeof input.label === 'string' && input.label.trim().length > 0
      ? input.label.trim()
      : input.id.trim(),
    group: typeof input.group === 'string' && input.group.trim().length > 0
      ? input.group.trim()
      : 'ungrouped',
    surface: surface.sort(),
    hotkey: typeof input.hotkey === 'string' && input.hotkey.trim().length > 0
      ? input.hotkey.trim()
      : '',
  };
}

function byLabelThenId(left, right) {
  const labelCompare = left.label.localeCompare(right.label);
  if (labelCompare !== 0) return labelCompare;
  return left.id.localeCompare(right.id);
}

function resolveEntries(source) {
  if (source && typeof source.listCommandMeta === 'function') {
    return source.listCommandMeta().map(normalizeEntry).filter(Boolean).sort(byLabelThenId);
  }
  if (Array.isArray(source)) {
    return source.map(normalizeEntry).filter(Boolean).sort(byLabelThenId);
  }
  return listCommandCatalog().map(normalizeEntry).filter(Boolean).sort(byLabelThenId);
}

export function listBySurface(source, surface = 'palette') {
  const entries = resolveEntries(source);
  const normalizedSurface = typeof surface === 'string' ? surface.trim() : '';
  if (!normalizedSurface) return entries;
  return entries.filter((entry) => entry.surface.includes(normalizedSurface));
}

export function listByGroup(source, surface = 'palette') {
  const entries = listBySurface(source, surface);
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.group)) {
      grouped.set(entry.group, []);
    }
    grouped.get(entry.group).push(entry);
  }
  return [...grouped.keys()]
    .sort()
    .map((group) => ({
      group,
      commands: grouped.get(group).slice().sort(byLabelThenId),
    }));
}

export function createPaletteDataProvider(source, options = {}) {
  const defaultSurface = typeof options.defaultSurface === 'string' && options.defaultSurface.trim().length > 0
    ? options.defaultSurface.trim()
    : 'palette';
  const entitlementInput = options.entitlementState || options.entitlementTier
    ? {
      entitlementState: options.entitlementState,
      entitlementTier: options.entitlementTier,
      toolbarProfile: options.toolbarProfile,
    }
    : null;
  const includeUnavailable = options.includeUnavailable === true;

  function applyEntitlement(entries) {
    if (!entitlementInput) return entries;
    const projected = annotateSurfaceEntriesForEntitlement(entries, entitlementInput);
    if (includeUnavailable) return projected;
    return projected.filter((entry) => entry.entitlement.visible === true);
  }

  return {
    listAll() {
      return applyEntitlement(listBySurface(source, defaultSurface));
    },
    listBySurface(surface = defaultSurface) {
      return applyEntitlement(listBySurface(source, surface));
    },
    listByGroup(surface = defaultSurface) {
      if (!entitlementInput) return listByGroup(source, surface);
      const grouped = new Map();
      for (const entry of applyEntitlement(listBySurface(source, surface))) {
        if (!grouped.has(entry.group)) {
          grouped.set(entry.group, []);
        }
        grouped.get(entry.group).push(entry);
      }
      return [...grouped.keys()]
        .sort()
        .map((group) => ({
          group,
          commands: grouped.get(group).slice().sort(byLabelThenId),
        }));
    },
  };
}

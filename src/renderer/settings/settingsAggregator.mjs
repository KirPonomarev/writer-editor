import { normalizeLocalCapabilityState } from '../commands/localCapabilityProvider.mjs';

const STATUS_ORDER = Object.freeze({
  live: 0,
  read_only: 1,
  unavailable: 2,
});

const SECTION_ORDER = Object.freeze([
  'appearance',
  'editor',
  'layout',
  'save_recovery',
  'import_export',
  'language_spelling',
  'shortcuts',
  'accessibility',
  'privacy',
]);

function normalizeString(value, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeStatus(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_ORDER, value) ? value : 'read_only';
}

function normalizeBooleanLabel(value) {
  return value === true ? 'On' : 'Off';
}

function normalizeToolbarProfileLabel(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'master' || normalized === 'pro' ? 'Полный' : 'Минимальный';
}

function normalizeSetting(setting) {
  const source = setting && typeof setting === 'object' && !Array.isArray(setting) ? setting : {};
  const id = normalizeString(source.id);
  const owner = normalizeString(source.owner);
  const persistenceClass = normalizeString(source.persistenceClass);
  if (!id || !owner || !persistenceClass) {
    throw new Error(`SETTINGS_AGGREGATOR_INVALID_SETTING:${id || 'missing-id'}`);
  }
  return Object.freeze({
    id,
    sectionId: normalizeString(source.sectionId, 'editor'),
    label: normalizeString(source.label, id),
    value: normalizeString(source.value, 'Unavailable'),
    owner,
    scope: normalizeString(source.scope, 'runtime'),
    persistenceClass,
    status: normalizeStatus(source.status),
    commandId: normalizeString(source.commandId),
    note: normalizeString(source.note),
  });
}

function sortSettings(left, right) {
  const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
  if (statusDelta !== 0) return statusDelta;
  return left.label.localeCompare(right.label, 'en');
}

function makeSection(id, label, settings) {
  return Object.freeze({
    id,
    label,
    settings: Object.freeze(settings.filter((entry) => entry.sectionId === id).sort(sortSettings)),
  });
}

export function buildSettingsAggregation(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const theme = normalizeString(source.theme, 'light') === 'dark' ? 'Dark' : 'Light';
  const fontFamily = normalizeString(source.fontFamily, 'Roboto Ms');
  const fontWeight = normalizeString(source.fontWeight, 'Light');
  const fontSizePx = Number.isFinite(Number(source.fontSizePx)) ? `${Math.round(Number(source.fontSizePx))} px` : 'Default';
  const lineHeight = normalizeString(source.lineHeight, '1.0');
  const wordWrap = normalizeBooleanLabel(source.wordWrap !== false);
  const viewMode = normalizeString(source.viewMode, 'Writing');
  const editorZoom = Number.isFinite(Number(source.editorZoom)) ? `${Math.round(Number(source.editorZoom) * 100)}%` : '100%';
  const projectId = normalizeString(source.projectId);
  const bookFormat = normalizeString(source.bookFormat, 'A4');
  const bookOrientation = normalizeString(source.bookOrientation, 'Portrait');
  const menuLocale = normalizeString(source.menuLocale, 'Base');
  const toolbarProfile = normalizeToolbarProfileLabel(source.toolbarProfile);
  const localCapabilityState = normalizeLocalCapabilityState({
    entitlementTier: source.entitlementTier,
    entitlementState: source.entitlementState,
    toolbarProfile: source.toolbarProfile,
  });

  const settings = [
    {
      id: 'appearance.theme',
      sectionId: 'appearance',
      label: 'Theme',
      value: theme,
      owner: 'Design OS theme port',
      scope: 'application',
      persistenceClass: 'localStorage:editorTheme',
      status: 'live',
      commandId: 'cmd.ui.theme.set',
    },
    {
      id: 'appearance.fontFamily',
      sectionId: 'appearance',
      label: 'Font',
      value: fontFamily,
      owner: 'Editor typography',
      scope: 'application',
      persistenceClass: 'localStorage:editorFont',
      status: 'live',
      commandId: 'cmd.ui.font.set',
    },
    {
      id: 'appearance.fontWeight',
      sectionId: 'appearance',
      label: 'Weight',
      value: fontWeight,
      owner: 'Editor typography',
      scope: 'application',
      persistenceClass: 'localStorage:editorFontWeight',
      status: 'live',
    },
    {
      id: 'appearance.fontSize',
      sectionId: 'appearance',
      label: 'Size',
      value: fontSizePx,
      owner: 'Editor typography and main settings bridge',
      scope: 'application',
      persistenceClass: 'settings.json:fontSize',
      status: 'live',
      commandId: 'cmd.ui.fontSize.set',
    },
    {
      id: 'appearance.lineHeight',
      sectionId: 'appearance',
      label: 'Line height',
      value: lineHeight,
      owner: 'Editor typography',
      scope: 'application',
      persistenceClass: 'localStorage:editorLineHeight',
      status: 'live',
    },
    {
      id: 'editor.wordWrap',
      sectionId: 'editor',
      label: 'Word wrap',
      value: wordWrap,
      owner: 'Editor runtime',
      scope: 'application',
      persistenceClass: 'localStorage:editorWordWrap',
      status: 'live',
      commandId: 'cmd.project.view.toggleWrap',
    },
    {
      id: 'editor.viewMode',
      sectionId: 'editor',
      label: 'Quiet mode',
      value: viewMode,
      owner: 'Editor runtime',
      scope: 'application',
      persistenceClass: 'localStorage:editorViewMode',
      status: 'live',
    },
    {
      id: 'editor.safePaste',
      sectionId: 'editor',
      label: 'Safe paste',
      value: 'Plain text boundary',
      owner: 'Editor paste policy',
      scope: 'runtime',
      persistenceClass: 'runtime-invariant',
      status: 'read_only',
      note: 'Paste safety is always enforced by the editor bridge.',
    },
    {
      id: 'layout.editorZoom',
      sectionId: 'layout',
      label: 'Editor zoom',
      value: editorZoom,
      owner: 'Editor chrome',
      scope: 'application',
      persistenceClass: 'localStorage:editorZoom',
      status: 'live',
    },
    {
      id: 'layout.sidebarWidths',
      sectionId: 'layout',
      label: 'Side panels',
      value: projectId ? 'Project scoped' : 'Project required',
      owner: 'Design OS spatial shell',
      scope: 'project',
      persistenceClass: 'localStorage:spatialLayout:projectId',
      status: projectId ? 'live' : 'read_only',
    },
    {
      id: 'layout.bookProfile',
      sectionId: 'layout',
      label: 'Page profile',
      value: `${bookFormat} ${bookOrientation}`,
      owner: 'BookProfile manifest',
      scope: 'project',
      persistenceClass: 'project-manifest:bookProfile',
      status: projectId ? 'live' : 'read_only',
    },
    {
      id: 'layout.toolbarProfile',
      sectionId: 'layout',
      label: 'Toolbar profile',
      value: toolbarProfile,
      owner: 'Toolbar profile state',
      scope: projectId ? 'project' : 'application',
      persistenceClass: 'localStorage:toolbarProfiles:projectId',
      status: 'live',
    },
    {
      id: 'saveRecovery.autosave',
      sectionId: 'save_recovery',
      label: 'Autosave',
      value: 'On',
      owner: 'Storage core',
      scope: 'project',
      persistenceClass: 'scene-files-and-manifest',
      status: 'read_only',
      note: 'Autosave is an invariant, not a separate toggle.',
    },
    {
      id: 'saveRecovery.atomicWrite',
      sectionId: 'save_recovery',
      label: 'Atomic write',
      value: 'On',
      owner: 'Storage core',
      scope: 'project',
      persistenceClass: 'atomic-file-writer',
      status: 'read_only',
    },
    {
      id: 'saveRecovery.recovery',
      sectionId: 'save_recovery',
      label: 'Recovery',
      value: 'Readable snapshots',
      owner: 'Recovery core',
      scope: 'project',
      persistenceClass: 'project-recovery-and-backups',
      status: 'read_only',
    },
    {
      id: 'importExport.content',
      sectionId: 'import_export',
      label: 'Content import/export',
      value: 'DOCX, TXT, Markdown, PDF, archive',
      owner: 'Import and export commands',
      scope: 'project',
      persistenceClass: 'external-artifact-intent',
      status: 'live',
    },
    {
      id: 'language.locale',
      sectionId: 'language_spelling',
      label: 'Interface language',
      value: menuLocale,
      owner: 'Application menu locale',
      scope: 'application',
      persistenceClass: 'settings.json:menuLocale',
      status: 'live',
    },
    {
      id: 'language.spelling',
      sectionId: 'language_spelling',
      label: 'Russian spelling',
      value: 'Unavailable',
      owner: 'Proofing engine',
      scope: 'application',
      persistenceClass: 'unsupported',
      status: 'unavailable',
      note: 'No local spell engine is shipped in this build.',
    },
    {
      id: 'shortcuts.keymap',
      sectionId: 'shortcuts',
      label: 'Shortcuts',
      value: 'Fixed command map',
      owner: 'Command kernel and menu keymap',
      scope: 'application',
      persistenceClass: 'static-command-catalog',
      status: 'read_only',
    },
    {
      id: 'accessibility.keyboard',
      sectionId: 'accessibility',
      label: 'Keyboard navigation',
      value: 'On',
      owner: 'Renderer focus contract',
      scope: 'runtime',
      persistenceClass: 'runtime-invariant',
      status: 'read_only',
    },
    {
      id: 'accessibility.reducedMotion',
      sectionId: 'accessibility',
      label: 'Reduced motion',
      value: 'Follows system',
      owner: 'Design OS accessibility layer',
      scope: 'runtime',
      persistenceClass: 'prefers-reduced-motion',
      status: 'read_only',
    },
    {
      id: 'accessibility.customOverrides',
      sectionId: 'accessibility',
      label: 'Accessibility overrides',
      value: 'Not configured',
      owner: 'Design OS accessibility layer',
      scope: 'application',
      persistenceClass: 'design-os-runtime-layer',
      status: 'unavailable',
      note: 'The layer exists, but no user override surface is claimed yet.',
    },
    {
      id: 'privacy.offline',
      sectionId: 'privacy',
      label: 'Offline project truth',
      value: 'Local only',
      owner: 'Application security policy',
      scope: 'application',
      persistenceClass: 'runtime-invariant',
      status: 'read_only',
    },
    {
      id: 'privacy.telemetry',
      sectionId: 'privacy',
      label: 'Telemetry',
      value: 'None',
      owner: 'Application security policy',
      scope: 'application',
      persistenceClass: 'not-collected',
      status: 'read_only',
    },
    {
      id: 'privacy.entitlement',
      sectionId: 'privacy',
      label: 'Plan',
      value: localCapabilityState.label,
      owner: 'Local capability provider',
      scope: 'application',
      persistenceClass: 'local-runtime-entitlement',
      status: 'read_only',
      note: 'Capability state is local and never owns project truth.',
    },
    {
      id: 'reset.safeReset',
      sectionId: 'privacy',
      label: 'Safe reset',
      value: 'Shell only',
      owner: 'Design OS safe reset port',
      scope: 'application-and-project-shell',
      persistenceClass: 'clears-ui-state-only',
      status: 'live',
      commandId: 'cmd.project.view.safeReset',
      note: 'Text, scenes, notes, backups, and recovery data are outside reset scope.',
    },
  ].map(normalizeSetting);

  const ids = new Set();
  settings.forEach((setting) => {
    if (ids.has(setting.id)) throw new Error(`SETTINGS_AGGREGATOR_DUPLICATE:${setting.id}`);
    ids.add(setting.id);
  });

  const sections = SECTION_ORDER.map((id) => {
    const labels = {
      appearance: 'Appearance',
      editor: 'Editor',
      layout: 'Layout',
      save_recovery: 'Save & Recovery',
      import_export: 'Import & Export',
      language_spelling: 'Language & Spelling',
      shortcuts: 'Shortcuts',
      accessibility: 'Accessibility',
      privacy: 'Privacy',
    };
    return makeSection(id, labels[id] || id, settings);
  });

  return Object.freeze({
    schemaVersion: 'settings-aggregation.v1',
    generatedFrom: 'owner-specific-runtime-state',
    createsStore: false,
    sections: Object.freeze(sections),
    settings: Object.freeze(settings),
  });
}

export function summarizeSettingsAggregation(aggregation) {
  const settings = Array.isArray(aggregation?.settings) ? aggregation.settings : [];
  return Object.freeze({
    total: settings.length,
    live: settings.filter((entry) => entry.status === 'live').length,
    readOnly: settings.filter((entry) => entry.status === 'read_only').length,
    unavailable: settings.filter((entry) => entry.status === 'unavailable').length,
    projectScoped: settings.filter((entry) => entry.scope === 'project').length,
    applicationScoped: settings.filter((entry) => entry.scope === 'application').length,
  });
}

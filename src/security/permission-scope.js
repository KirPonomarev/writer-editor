'use strict';

const { validatePathBoundary } = require('../core/io/path-boundary.js');

const FAIL_SIGNAL = 'E_PERMISSION_SCOPE_VIOLATION';

const PERMISSION_ACTIONS = Object.freeze({
  PROJECT_READ: 'project.read',
  PROJECT_WRITE: 'project.write',
  EXPORT_WRITE: 'export.write',
  BACKUP_WRITE: 'backup.write',
  RECOVERY_WRITE: 'recovery.write',
});

const FORBIDDEN_PERMISSIONS = Object.freeze([
  'filesystem.broad',
  'shell.command',
  'remote.code',
  'network.outbound',
]);

const DEFAULT_PERMISSION_MANIFEST = Object.freeze({
  manifestId: 'B3C05_PERMISSION_MANIFEST_V1',
  role: 'PROOF_HELPER_NOT_RUNTIME_ENFORCER',
  allowedActions: Object.freeze({
    [PERMISSION_ACTIONS.PROJECT_READ]: Object.freeze({
      channel: 'project:read',
      permission: PERMISSION_ACTIONS.PROJECT_READ,
      pathFields: Object.freeze(['projectPath']),
    }),
    [PERMISSION_ACTIONS.PROJECT_WRITE]: Object.freeze({
      channel: 'project:write',
      permission: PERMISSION_ACTIONS.PROJECT_WRITE,
      pathFields: Object.freeze(['projectPath']),
    }),
    [PERMISSION_ACTIONS.EXPORT_WRITE]: Object.freeze({
      channel: 'export:write',
      permission: PERMISSION_ACTIONS.EXPORT_WRITE,
      pathFields: Object.freeze(['outPath']),
    }),
    [PERMISSION_ACTIONS.BACKUP_WRITE]: Object.freeze({
      channel: 'backup:write',
      permission: PERMISSION_ACTIONS.BACKUP_WRITE,
      pathFields: Object.freeze(['backupPath']),
    }),
    [PERMISSION_ACTIONS.RECOVERY_WRITE]: Object.freeze({
      channel: 'recovery:write',
      permission: PERMISSION_ACTIONS.RECOVERY_WRITE,
      pathFields: Object.freeze(['recoveryPath']),
    }),
  }),
  forbiddenPermissions: FORBIDDEN_PERMISSIONS,
});

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deny(reason, request, details = {}) {
  return Object.freeze({
    ok: false,
    failSignal: FAIL_SIGNAL,
    reason,
    denyEvent: Object.freeze({
      action: typeof request?.action === 'string' ? request.action : '',
      channel: typeof request?.channel === 'string' ? request.channel : '',
      requestedPermission: typeof request?.requestedPermission === 'string' ? request.requestedPermission : '',
      reason,
      details,
    }),
  });
}

function allow(request, rule, normalizedPayload) {
  return Object.freeze({
    ok: true,
    failSignal: '',
    reason: '',
    decision: Object.freeze({
      action: rule.permission,
      channel: rule.channel,
      requestedPermission: request.requestedPermission,
      normalizedPayload,
      proofOnly: true,
      storageMutated: false,
      runtimeEnforcer: false,
      releaseClaim: false,
    }),
    denyEvent: null,
  });
}

function normalizePermissionRequest(request) {
  if (!isRecord(request)) return { ok: false, reason: 'REQUEST_INVALID' };
  const action = typeof request.action === 'string' ? request.action.trim() : '';
  const channel = typeof request.channel === 'string' ? request.channel.trim() : '';
  const requestedPermission = typeof request.requestedPermission === 'string'
    ? request.requestedPermission.trim()
    : '';
  const payload = isRecord(request.payload) ? request.payload : {};
  if (!action || !channel || !requestedPermission) {
    return { ok: false, reason: 'REQUEST_REQUIRED_FIELDS_MISSING' };
  }
  return {
    ok: true,
    request: { action, channel, requestedPermission, payload },
  };
}

function validatePathFields(payload, pathFields) {
  const normalizedPayload = { ...payload };
  for (const field of pathFields) {
    const rawValue = normalizedPayload[field];
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      return { ok: false, reason: 'PATH_FIELD_MISSING', field };
    }
    const pathState = validatePathBoundary(rawValue, { mode: 'relative' });
    if (!pathState.ok) {
      return {
        ok: false,
        reason: 'PATH_SCOPE_DENIED',
        field,
        failReason: pathState.failReason,
        normalizedPath: pathState.normalizedPath,
      };
    }
    normalizedPayload[field] = pathState.normalizedPath;
  }
  return { ok: true, normalizedPayload };
}

function decidePermissionScope(rawRequest, manifest = DEFAULT_PERMISSION_MANIFEST) {
  const normalized = normalizePermissionRequest(rawRequest);
  if (!normalized.ok) {
    return deny(normalized.reason, rawRequest);
  }

  const request = normalized.request;
  if (FORBIDDEN_PERMISSIONS.includes(request.requestedPermission)) {
    return deny('FORBIDDEN_PERMISSION_SCOPE', request);
  }
  if (request.payload.scope === '*' || request.payload.scope === 'all-files') {
    return deny('BROAD_SCOPE_DENIED', request);
  }

  const rule = manifest.allowedActions?.[request.action];
  if (!rule) {
    return deny('ACTION_NOT_ALLOWED', request);
  }
  if (rule.channel !== request.channel) {
    return deny('CHANNEL_NOT_ALLOWED', request, { expectedChannel: rule.channel });
  }
  if (rule.permission !== request.requestedPermission) {
    return deny('PERMISSION_NOT_ALLOWED', request, { expectedPermission: rule.permission });
  }

  const pathResult = validatePathFields(request.payload, Array.from(rule.pathFields || []));
  if (!pathResult.ok) {
    return deny(pathResult.reason, request, {
      field: pathResult.field,
      failReason: pathResult.failReason || '',
      normalizedPath: pathResult.normalizedPath || '',
    });
  }

  return allow(request, rule, pathResult.normalizedPayload);
}

module.exports = {
  DEFAULT_PERMISSION_MANIFEST,
  FAIL_SIGNAL,
  FORBIDDEN_PERMISSIONS,
  PERMISSION_ACTIONS,
  decidePermissionScope,
};

const COMMAND_BRIDGE_ROUTE = 'command.bus';

function fail(code, op, reason, details) {
  const error = { code, op, reason };
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = details;
  }
  return { ok: false, error };
}

function ok(value) {
  return { ok: true, value };
}

function listCallableNames(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  return Object.keys(source)
    .filter((key) => typeof source[key] === 'function')
    .sort((a, b) => a.localeCompare(b));
}

export function captureCommandEffectCapabilities(deps = {}) {
  const electronAPI = deps.electronAPI && typeof deps.electronAPI === 'object' && !Array.isArray(deps.electronAPI)
    ? deps.electronAPI
    : null;
  const uiActions = deps.uiActions && typeof deps.uiActions === 'object' && !Array.isArray(deps.uiActions)
    ? deps.uiActions
    : null;

  return Object.freeze({
    hasElectronAPIObject: Boolean(electronAPI),
    hasUiActionsObject: Boolean(uiActions),
    hasInvokeUiCommandBridge: Boolean(electronAPI && typeof electronAPI.invokeUiCommandBridge === 'function'),
    electronMethodNames: Object.freeze(listCallableNames(electronAPI)),
    uiActionNames: Object.freeze(listCallableNames(uiActions)),
  });
}

export function buildCommandOperationPlan(spec = {}, capabilities = {}) {
  const commandId = typeof spec.commandId === 'string' ? spec.commandId.trim() : '';
  const effectType = typeof spec.effectType === 'string' ? spec.effectType.trim() : '';

  if (!commandId || !effectType) {
    return fail('E_COMMAND_FAILED', commandId || 'unknown', 'COMMAND_EFFECT_SPEC_INVALID');
  }

  if (effectType === 'ui-action') {
    const actionName = typeof spec.actionName === 'string' ? spec.actionName.trim() : '';
    if (!capabilities.hasUiActionsObject) {
      return fail(
        typeof spec.unavailableCode === 'string' ? spec.unavailableCode : 'E_COMMAND_FAILED',
        commandId,
        typeof spec.unavailableReason === 'string' ? spec.unavailableReason : 'UI_ACTION_UNAVAILABLE',
      );
    }
    if (!actionName || !capabilities.uiActionNames.includes(actionName)) {
      return fail('E_COMMAND_FAILED', commandId, 'UI_ACTION_UNAVAILABLE', { action: actionName });
    }
    return ok({
      kind: 'ui-action',
      commandId,
      actionName,
      payload: spec.payload && typeof spec.payload === 'object' && !Array.isArray(spec.payload)
        ? spec.payload
        : {},
    });
  }

  if (!capabilities.hasElectronAPIObject) {
    return fail(
      typeof spec.unavailableCode === 'string' ? spec.unavailableCode : 'E_COMMAND_FAILED',
      commandId,
      typeof spec.unavailableReason === 'string' ? spec.unavailableReason : 'ELECTRON_API_UNAVAILABLE',
    );
  }

  const payload = spec.payload && typeof spec.payload === 'object' && !Array.isArray(spec.payload)
    ? spec.payload
    : {};

  if (effectType === 'electron-bridge-only') {
    if (!capabilities.hasInvokeUiCommandBridge) {
      return fail(
        typeof spec.unavailableCode === 'string' ? spec.unavailableCode : 'E_COMMAND_FAILED',
        commandId,
        typeof spec.unavailableReason === 'string' ? spec.unavailableReason : 'ELECTRON_API_UNAVAILABLE',
      );
    }
    return ok({
      kind: 'electron-bridge',
      commandId,
      route: COMMAND_BRIDGE_ROUTE,
      payload,
    });
  }

  if (effectType === 'electron-bridge-or-legacy') {
    if (capabilities.hasInvokeUiCommandBridge) {
      return ok({
        kind: 'electron-bridge',
        commandId,
        route: COMMAND_BRIDGE_ROUTE,
        payload,
      });
    }

    const fallbackMethodName = typeof spec.fallbackMethodName === 'string' ? spec.fallbackMethodName.trim() : '';
    if (fallbackMethodName && capabilities.electronMethodNames.includes(fallbackMethodName)) {
      return ok({
        kind: 'electron-legacy',
        commandId,
        methodName: fallbackMethodName,
        payload: spec.legacyPayload,
        omitPayload: spec.legacyPayload === undefined,
      });
    }

    return fail(
      typeof spec.unavailableCode === 'string' ? spec.unavailableCode : 'E_COMMAND_FAILED',
      commandId,
      typeof spec.unavailableReason === 'string' ? spec.unavailableReason : 'ELECTRON_API_UNAVAILABLE',
    );
  }

  return fail('E_COMMAND_FAILED', commandId, 'COMMAND_EFFECT_SPEC_INVALID');
}

export async function persistCommandOperationPlan(plan, deps = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('COMMAND_OPERATION_PLAN_INVALID');
  }

  if (plan.kind === 'ui-action') {
    const uiActions = deps.uiActions && typeof deps.uiActions === 'object' && !Array.isArray(deps.uiActions)
      ? deps.uiActions
      : null;
    if (!uiActions || typeof uiActions[plan.actionName] !== 'function') {
      throw new Error('UI_ACTION_UNAVAILABLE');
    }
    return uiActions[plan.actionName](plan.payload);
  }

  if (plan.kind === 'electron-bridge') {
    const electronAPI = deps.electronAPI && typeof deps.electronAPI === 'object' && !Array.isArray(deps.electronAPI)
      ? deps.electronAPI
      : null;
    if (!electronAPI || typeof electronAPI.invokeUiCommandBridge !== 'function') {
      throw new Error('ELECTRON_API_UNAVAILABLE');
    }
    return electronAPI.invokeUiCommandBridge({
      route: plan.route,
      commandId: plan.commandId,
      payload: plan.payload,
    });
  }

  if (plan.kind === 'electron-legacy') {
    const electronAPI = deps.electronAPI && typeof deps.electronAPI === 'object' && !Array.isArray(deps.electronAPI)
      ? deps.electronAPI
      : null;
    if (!electronAPI || typeof electronAPI[plan.methodName] !== 'function') {
      throw new Error('ELECTRON_API_UNAVAILABLE');
    }
    if (plan.omitPayload) {
      return electronAPI[plan.methodName]();
    }
    return electronAPI[plan.methodName](plan.payload);
  }

  throw new Error('COMMAND_OPERATION_PLAN_INVALID');
}

export function unwrapBridgeResponseValue(response) {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    response.value &&
    typeof response.value === 'object' &&
    !Array.isArray(response.value)
  ) {
    return response.value;
  }
  return response;
}

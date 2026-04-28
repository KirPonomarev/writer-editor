'use strict';

const http = require('node:http');
const https = require('node:https');

const FAIL_SIGNAL = 'E_B3C06_NETWORK_ATTEMPT';
const HELPER_ROLE = 'PROOF_HELPER_NOT_PRODUCT_NETWORK_STACK';

const NETWORK_ROUTES = Object.freeze({
  FETCH: 'fetch',
  WEBSOCKET: 'websocket',
  XML_HTTP_REQUEST: 'xml-http-request',
  HTTP_REQUEST: 'http.request',
  HTTPS_REQUEST: 'https.request',
  HTTP_GET: 'http.get',
  HTTPS_GET: 'https.get',
  REMOTE_IMAGE: 'remote.image',
  UPDATE_CHECK: 'update.check',
  ANALYTICS: 'analytics',
  CLOUD_SYNC: 'cloud.sync',
});

const WRITING_PATH_STEPS = Object.freeze(['open', 'edit', 'save', 'export']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createNetworkDenyError(route) {
  const error = new Error(`B3C06 outbound network denied: ${route}`);
  error.code = FAIL_SIGNAL;
  error.route = route;
  return error;
}

function normalizeDetails(details) {
  if (!isRecord(details)) return {};
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

function createNetworkDenyMonitor(input = {}) {
  const scope = normalizeString(input.scope) || 'open_edit_save_export';
  const events = [];

  function recordOutboundAttempt(route, details = {}) {
    const normalizedRoute = normalizeString(route) || 'unknown';
    const event = Object.freeze({
      route: normalizedRoute,
      failSignal: FAIL_SIGNAL,
      scope,
      denied: true,
      details: Object.freeze(normalizeDetails(details)),
    });
    events.push(event);
    return event;
  }

  function artifact(extra = {}) {
    return Object.freeze({
      helperRole: HELPER_ROLE,
      scope,
      failSignal: FAIL_SIGNAL,
      outboundAttemptCount: events.length,
      zeroOutboundAttempts: events.length === 0,
      events: events.map((event) => ({ ...event, details: { ...event.details } })),
      releaseClaim: false,
      productNetworkStackRewrite: false,
      ...normalizeDetails(extra),
    });
  }

  return Object.freeze({
    recordOutboundAttempt,
    artifact,
  });
}

async function runWithNetworkDenyMonitor(operation, input = {}) {
  if (typeof operation !== 'function') {
    throw new TypeError('operation must be a function');
  }

  const monitor = createNetworkDenyMonitor(input);
  const original = {
    fetch: globalThis.fetch,
    WebSocket: globalThis.WebSocket,
    XMLHttpRequest: globalThis.XMLHttpRequest,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
  };

  function deny(route, details = {}) {
    monitor.recordOutboundAttempt(route, details);
    throw createNetworkDenyError(route);
  }

  globalThis.fetch = function deniedFetch() {
    return Promise.reject(deny(NETWORK_ROUTES.FETCH));
  };
  globalThis.WebSocket = function DeniedWebSocket() {
    deny(NETWORK_ROUTES.WEBSOCKET);
  };
  globalThis.XMLHttpRequest = function DeniedXMLHttpRequest() {
    deny(NETWORK_ROUTES.XML_HTTP_REQUEST);
  };
  http.request = function deniedHttpRequest() {
    deny(NETWORK_ROUTES.HTTP_REQUEST);
  };
  http.get = function deniedHttpGet() {
    deny(NETWORK_ROUTES.HTTP_GET);
  };
  https.request = function deniedHttpsRequest() {
    deny(NETWORK_ROUTES.HTTPS_REQUEST);
  };
  https.get = function deniedHttpsGet() {
    deny(NETWORK_ROUTES.HTTPS_GET);
  };

  try {
    const result = await operation({
      monitor,
      denyProductNetworkRoute(route, details = {}) {
        monitor.recordOutboundAttempt(route, details);
        throw createNetworkDenyError(route);
      },
    });
    return {
      ok: monitor.artifact().zeroOutboundAttempts,
      result,
      artifact: monitor.artifact(),
    };
  } finally {
    if (original.fetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = original.fetch;
    if (original.WebSocket === undefined) delete globalThis.WebSocket;
    else globalThis.WebSocket = original.WebSocket;
    if (original.XMLHttpRequest === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = original.XMLHttpRequest;
    http.request = original.httpRequest;
    http.get = original.httpGet;
    https.request = original.httpsRequest;
    https.get = original.httpsGet;
  }
}

async function runWritingPathReplayUnderDenyMonitor(input = {}) {
  const steps = Array.isArray(input.steps) && input.steps.length > 0
    ? input.steps.map((step) => normalizeString(step)).filter(Boolean)
    : [...WRITING_PATH_STEPS];

  return runWithNetworkDenyMonitor(async () => ({
    replayKind: 'PROOF_REPLAY_ONLY',
    steps,
    stepCount: steps.length,
    usedExistingPublicSeamsOnly: input.usedExistingPublicSeamsOnly !== false,
    storageMutated: false,
    exportPipelineRewritten: false,
    uiTouched: false,
  }), { scope: 'open_edit_save_export' });
}

async function captureDeniedRoute(route, trigger) {
  try {
    await runWithNetworkDenyMonitor(trigger, { scope: `negative_${route}` });
    return { route, denied: false, failSignal: '', reason: 'NETWORK_ATTEMPT_NOT_TRIGGERED' };
  } catch (error) {
    return {
      route,
      denied: error && error.code === FAIL_SIGNAL,
      failSignal: error && error.code === FAIL_SIGNAL ? FAIL_SIGNAL : '',
      reason: error && error.code === FAIL_SIGNAL ? 'DENIED_BY_B3C06_MONITOR' : 'UNEXPECTED_ERROR',
    };
  }
}

async function runNetworkNegativeMatrix() {
  const rows = [];
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.FETCH, async () => {
    await globalThis.fetch('https://example.invalid/b3c06');
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.WEBSOCKET, async () => {
    // eslint-disable-next-line no-new
    new globalThis.WebSocket('wss://example.invalid/b3c06');
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.XML_HTTP_REQUEST, async () => {
    // eslint-disable-next-line no-new
    new globalThis.XMLHttpRequest();
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.HTTP_REQUEST, async () => {
    http.request('http://example.invalid/b3c06');
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.HTTPS_REQUEST, async () => {
    https.request('https://example.invalid/b3c06');
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.HTTP_GET, async () => {
    http.get('http://example.invalid/b3c06');
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.HTTPS_GET, async () => {
    https.get('https://example.invalid/b3c06');
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.REMOTE_IMAGE, async ({ denyProductNetworkRoute }) => {
    denyProductNetworkRoute(NETWORK_ROUTES.REMOTE_IMAGE, { url: 'https://example.invalid/image.png' });
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.UPDATE_CHECK, async ({ denyProductNetworkRoute }) => {
    denyProductNetworkRoute(NETWORK_ROUTES.UPDATE_CHECK, { channel: 'disabled-in-mvp' });
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.ANALYTICS, async ({ denyProductNetworkRoute }) => {
    denyProductNetworkRoute(NETWORK_ROUTES.ANALYTICS, { channel: 'disabled-in-mvp' });
  }));
  rows.push(await captureDeniedRoute(NETWORK_ROUTES.CLOUD_SYNC, async ({ denyProductNetworkRoute }) => {
    denyProductNetworkRoute(NETWORK_ROUTES.CLOUD_SYNC, { channel: 'disabled-in-mvp' });
  }));

  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

module.exports = {
  FAIL_SIGNAL,
  HELPER_ROLE,
  NETWORK_ROUTES,
  WRITING_PATH_STEPS,
  createNetworkDenyError,
  createNetworkDenyMonitor,
  runNetworkNegativeMatrix,
  runWithNetworkDenyMonitor,
  runWritingPathReplayUnderDenyMonitor,
};

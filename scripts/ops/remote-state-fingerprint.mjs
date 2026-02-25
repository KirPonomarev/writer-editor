#!/usr/bin/env node
import { createHash } from 'node:crypto';

const REQUIRED_FIELDS = Object.freeze([
  'BASE_SHA',
  'ORIGIN_ID',
  'DNS_RESOLVER_HASH',
  'PROXY_ENV_HASH',
  'GH_AUTH_STATE_HASH',
  'ERROR_CLASS',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeProxyEnv(input = {}) {
  const proxy = isObjectRecord(input.proxyEnv) ? input.proxyEnv : {};
  return {
    HTTP_PROXY: normalizeString(proxy.HTTP_PROXY || ''),
    HTTPS_PROXY: normalizeString(proxy.HTTPS_PROXY || ''),
    NO_PROXY: normalizeString(proxy.NO_PROXY || ''),
  };
}

function normalizeGhAuth(input = {}) {
  const gh = isObjectRecord(input.ghAuth) ? input.ghAuth : {};
  return {
    status: normalizeString(gh.status || ''),
    host: normalizeString(gh.host || 'github.com'),
    tokenConfigured: gh.tokenConfigured === true,
  };
}

function normalizeDnsResolvers(input = {}) {
  if (!Array.isArray(input.dnsResolvers)) return [];
  return input.dnsResolvers
    .map((entry) => normalizeString(String(entry || '')))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function buildRemoteStateFingerprint(input = {}) {
  const baseSha = normalizeString(input.baseSha || input.BASE_SHA);
  const originRaw = normalizeString(input.originUrl || input.originId || input.ORIGIN_ID || 'origin');
  const dnsResolvers = normalizeDnsResolvers(input);
  const proxyEnv = normalizeProxyEnv(input);
  const ghAuth = normalizeGhAuth(input);
  const errorClass = normalizeString(input.errorClass || input.ERROR_CLASS || 'NONE');

  const originId = sha256Hex(originRaw);
  const dnsResolverHash = sha256Hex(stableStringify(dnsResolvers));
  const proxyEnvHash = sha256Hex(stableStringify(proxyEnv));
  const ghAuthStateHash = sha256Hex(stableStringify(ghAuth));

  const fingerprint = {
    BASE_SHA: baseSha,
    ORIGIN_ID: originId,
    DNS_RESOLVER_HASH: dnsResolverHash,
    PROXY_ENV_HASH: proxyEnvHash,
    GH_AUTH_STATE_HASH: ghAuthStateHash,
    ERROR_CLASS: errorClass,
  };

  const canonical = stableStringify(fingerprint);
  return {
    fingerprint,
    fingerprintCanonical: canonical,
    fingerprintHash: sha256Hex(canonical),
  };
}

export function validateRemoteStateFingerprintSchema(input = {}) {
  const row = isObjectRecord(input) ? input : {};
  const missingFields = REQUIRED_FIELDS.filter((field) => !normalizeString(row[field]));
  return {
    ok: missingFields.length === 0,
    requiredFields: [...REQUIRED_FIELDS],
    missingFields,
  };
}

export {
  REQUIRED_FIELDS,
  stableStringify,
  sha256Hex,
};

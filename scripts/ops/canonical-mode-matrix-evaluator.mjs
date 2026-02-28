#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export const CANONICAL_MODE_MATRIX_EVALUATOR_ID = 'CANONICAL_MODE_MATRIX_EVALUATOR_V1';
const FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBooleanish(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return false;
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on';
}

export function resolveModeKey(rawMode = '') {
  const normalized = normalizeString(rawMode).toLowerCase();
  if (normalized === 'promotion') return 'promotion';
  if (
    normalized === 'pr'
    || normalized === 'prcore'
    || normalized === 'pr_core'
    || normalized === 'core'
    || normalized === 'dev'
  ) {
    return 'prCore';
  }
  return 'release';
}

export function resolveModeLabel(rawMode = '') {
  const modeKey = resolveModeKey(rawMode);
  if (modeKey === 'promotion') return 'promotion';
  if (modeKey === 'prCore') return 'pr';
  return 'release';
}

function resolveModeFromInput(rawMode = '') {
  const explicitMode = normalizeString(rawMode);
  if (explicitMode) {
    return {
      modeKey: resolveModeKey(explicitMode),
      mode: resolveModeLabel(explicitMode),
    };
  }

  if (
    parseBooleanish(process.env.promotionMode)
    || parseBooleanish(process.env.PROMOTION_MODE)
    || parseBooleanish(process.env.WAVE_PROMOTION_MODE)
  ) {
    return { modeKey: 'promotion', mode: 'promotion' };
  }

  return { modeKey: 'release', mode: 'release' };
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRepoRelative(rootDir, absPath) {
  return path.relative(rootDir, absPath).replaceAll(path.sep, '/');
}

function tryReadRegistry(registryAbsPath) {
  if (!fs.existsSync(registryAbsPath)) {
    return {
      ok: false,
      doc: null,
      failDetail: 'FAILSIGNAL_REGISTRY_MISSING',
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(registryAbsPath, 'utf8'));
  } catch {
    return {
      ok: false,
      doc: null,
      failDetail: 'FAILSIGNAL_REGISTRY_INVALID_JSON',
    };
  }

  if (!isObjectRecord(parsed) || !Array.isArray(parsed.failSignals)) {
    return {
      ok: false,
      doc: null,
      failDetail: 'FAILSIGNAL_REGISTRY_INVALID_SCHEMA',
    };
  }

  return {
    ok: true,
    doc: parsed,
    failDetail: '',
  };
}

function loadRegistry(repoRoot) {
  const primaryAbsPath = path.resolve(repoRoot, FAILSIGNAL_REGISTRY_PATH);
  const primaryRead = tryReadRegistry(primaryAbsPath);
  if (primaryRead.ok) {
    return {
      ok: true,
      doc: primaryRead.doc,
      registryPath: toRepoRelative(repoRoot, primaryAbsPath),
      source: 'repoRoot',
      failDetail: '',
    };
  }

  const cwdRoot = path.resolve(process.cwd());
  const fallbackAbsPath = path.resolve(cwdRoot, FAILSIGNAL_REGISTRY_PATH);
  if (fallbackAbsPath !== primaryAbsPath) {
    const fallbackRead = tryReadRegistry(fallbackAbsPath);
    if (fallbackRead.ok) {
      return {
        ok: true,
        doc: fallbackRead.doc,
        registryPath: toRepoRelative(cwdRoot, fallbackAbsPath),
        source: 'cwdFallback',
        failDetail: '',
      };
    }
  }

  return {
    ok: false,
    doc: null,
    registryPath: toRepoRelative(repoRoot, primaryAbsPath),
    source: 'repoRoot',
    failDetail: primaryRead.failDetail || 'FAILSIGNAL_REGISTRY_UNAVAILABLE',
  };
}

function resolveModeDisposition(modeMatrix, modeKey) {
  const rawValue = isObjectRecord(modeMatrix) ? normalizeString(modeMatrix[modeKey]).toLowerCase() : '';
  if (rawValue === 'blocking') return 'blocking';
  if (rawValue === 'advisory') return 'advisory';
  return '';
}

export function evaluateModeMatrixVerdict(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failSignalCode = normalizeString(input.failSignalCode);
  const modeState = resolveModeFromInput(input.mode);
  const issues = [];
  const registryState = loadRegistry(repoRoot);

  let modeDisposition = '';

  if (!registryState.ok || !registryState.doc) {
    issues.push({
      code: 'FAILSIGNAL_REGISTRY_UNAVAILABLE',
      message: `Cannot read failSignal registry: ${registryState.failDetail}`,
      registryPath: registryState.registryPath,
    });
  }

  if (!failSignalCode) {
    issues.push({
      code: 'FAILSIGNAL_CODE_REQUIRED',
      message: 'failSignalCode must be non-empty.',
    });
  }

  let failSignalRow = null;
  if (registryState.ok && registryState.doc && failSignalCode) {
    failSignalRow = (registryState.doc.failSignals || []).find((row) => row && row.code === failSignalCode) || null;
    if (!failSignalRow) {
      issues.push({
        code: 'FAILSIGNAL_NOT_FOUND',
        message: `FailSignal ${failSignalCode} is not registered.`,
      });
    }
  }

  if (failSignalRow) {
    modeDisposition = resolveModeDisposition(failSignalRow.modeMatrix, modeState.modeKey);
    if (!modeDisposition) {
      issues.push({
        code: 'FAILSIGNAL_MODE_MATRIX_INVALID',
        message: `FailSignal ${failSignalCode} has no valid disposition for mode ${modeState.modeKey}.`,
      });
    }
  }

  const ok = issues.length === 0;
  const effectiveDisposition = modeDisposition || 'advisory';
  const shouldBlock = ok && effectiveDisposition === 'blocking';

  return {
    evaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    ok,
    source: 'FAILSIGNAL_REGISTRY_MODE_MATRIX',
    failSignalCode,
    mode: modeState.mode,
    modeKey: modeState.modeKey,
    modeDisposition: effectiveDisposition,
    shouldBlock,
    policyFailure: !ok,
    registryPath: registryState.registryPath,
    registrySource: registryState.source,
    issues,
  };
}

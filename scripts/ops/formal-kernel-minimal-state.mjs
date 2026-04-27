#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL_VERSION = 'formal-kernel-minimal-state.v1';
const ARTIFACT_PATH = 'docs/OPS/STATUS/FORMAL_KERNEL_MINIMAL_V1.json';
const REQUIRED_INVARIANT_IDS = Object.freeze([
  'TEXT_NO_LOSS',
  'EXPORT_SOURCE_CANONICAL',
  'RECOVERY_HUMAN_READABLE',
]);

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readArtifact(repoRoot) {
  const artifactAbs = path.resolve(repoRoot, ARTIFACT_PATH);
  const raw = fs.readFileSync(artifactAbs, 'utf8');
  return JSON.parse(raw);
}

function runProofHook(command, repoRoot) {
  const trimmed = String(command || '').trim();
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) {
    return {
      ok: false,
      status: 1,
      stdout: '',
      stderr: 'EMPTY_PROOFHOOK',
    };
  }

  const runner = parts[0] === 'node' ? process.execPath : parts[0];
  const args = parts[0] === 'node' ? parts.slice(1) : parts.slice(1);
  const run = spawnSync(runner, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });

  return {
    ok: run.status === 0,
    status: typeof run.status === 'number' ? run.status : 1,
    stdout: String(run.stdout || ''),
    stderr: String(run.stderr || ''),
  };
}

function parseJson(stdout) {
  try {
    return JSON.parse(String(stdout || '{}'));
  } catch {
    return null;
  }
}

function evaluateFormalKernelMinimalState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || process.cwd());
  const artifact = readArtifact(repoRoot);
  const items = Array.isArray(artifact.items) ? artifact.items : [];
  const byId = new Map();

  for (const item of items) {
    if (!isObjectRecord(item) || typeof item.invariantId !== 'string') continue;
    byId.set(item.invariantId, item);
  }

  const missingInvariantIds = REQUIRED_INVARIANT_IDS.filter((id) => !byId.has(id));
  const unexpectedInvariantIds = [...byId.keys()]
    .filter((id) => !REQUIRED_INVARIANT_IDS.includes(id))
    .sort((a, b) => a.localeCompare(b));

  const invariantResults = {};
  const failReasons = [];

  for (const invariantId of REQUIRED_INVARIANT_IDS) {
    const row = byId.get(invariantId);
    if (!row) {
      invariantResults[invariantId] = { ok: false, status: 'MISSING' };
      failReasons.push(`${invariantId}:MISSING`);
      continue;
    }

    if (row.bindingClass === 'detector_bound') {
      const contractRef = String(row.positiveContractRef || '').trim();
      const proofHook = String(row.proofHook || '').trim();
      const detectorToken = String(row.detectorToken || '').trim();
      const contractExists = Boolean(contractRef) && fs.existsSync(path.resolve(repoRoot, contractRef));
      const hookRun = runProofHook(proofHook, repoRoot);
      const hookPayload = parseJson(hookRun.stdout);
      const tokenPresent = isObjectRecord(hookPayload)
        && Object.prototype.hasOwnProperty.call(hookPayload, detectorToken);

      const ok = row.status === 'BOUND'
        && Boolean(detectorToken)
        && Boolean(proofHook)
        && contractExists
        && hookRun.ok
        && tokenPresent;

      invariantResults[invariantId] = {
        ok,
        status: row.status,
        bindingClass: row.bindingClass,
        detectorToken,
        contractExists,
        proofHookStatus: hookRun.status,
        tokenPresent,
      };

      if (!ok) {
        failReasons.push(`${invariantId}:DETECTOR_BINDING_INVALID`);
      }
      continue;
    }

    if (row.bindingClass === 'advisory_downgrade') {
      const evidenceRefs = Array.isArray(row.evidenceRefs) ? row.evidenceRefs : [];
      const evidenceExists = evidenceRefs.every((ref) => fs.existsSync(path.resolve(repoRoot, ref)));
      const reasonCode = String(row.reasonCode || '').trim();
      const advisoryProbe = String(row.advisoryProbe || '').trim();
      let advisoryProbeStatus = null;
      let advisoryProbeSatisfied = true;

      if (reasonCode === 'CURRENT_DETECTOR_PATH_NOT_GREEN') {
        const probeRun = runProofHook(advisoryProbe, repoRoot);
        advisoryProbeStatus = probeRun.status;
        advisoryProbeSatisfied = probeRun.ok === false;
      }

      const ok = row.status === 'ADVISORY'
        && (reasonCode === 'NO_HONEST_DETECTOR_PATH' || reasonCode === 'CURRENT_DETECTOR_PATH_NOT_GREEN')
        && evidenceRefs.length >= 2
        && evidenceExists
        && advisoryProbeSatisfied;

      invariantResults[invariantId] = {
        ok,
        status: row.status,
        bindingClass: row.bindingClass,
        reasonCode,
        evidenceExists,
        advisoryProbeStatus,
        advisoryProbeSatisfied,
      };

      if (!ok) {
        failReasons.push(`${invariantId}:ADVISORY_DOWNGRADE_INVALID`);
      }
      continue;
    }

    invariantResults[invariantId] = {
      ok: false,
      status: 'UNSUPPORTED_BINDING_CLASS',
      bindingClass: row.bindingClass,
    };
    failReasons.push(`${invariantId}:UNSUPPORTED_BINDING_CLASS`);
  }

  if (missingInvariantIds.length > 0) {
    failReasons.push(`MISSING=${missingInvariantIds.join(',')}`);
  }
  if (unexpectedInvariantIds.length > 0) {
    failReasons.push(`UNEXPECTED=${unexpectedInvariantIds.join(',')}`);
  }

  const ok = artifact.schemaVersion === 1
    && artifact.artifactId === 'FORMAL_KERNEL_MINIMAL_V1'
    && artifact.authorityClass === 'OWNER_MAP_DIRECTION_UNDER_ACTIVE_CANON'
    && artifact.blockingLaw === false
    && missingInvariantIds.length === 0
    && unexpectedInvariantIds.length === 0
    && REQUIRED_INVARIANT_IDS.every((id) => invariantResults[id] && invariantResults[id].ok === true);

  return {
    toolVersion: TOOL_VERSION,
    FORMAL_KERNEL_MINIMAL_OK: ok ? 1 : 0,
    artifactId: artifact.artifactId || '',
    missingInvariantIds,
    unexpectedInvariantIds,
    invariantResults,
    failReasons,
  };
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateFormalKernelMinimalState();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } else {
    console.log(`FORMAL_KERNEL_MINIMAL_OK=${state.FORMAL_KERNEL_MINIMAL_OK}`);
    console.log(`FORMAL_KERNEL_MINIMAL_FAIL_REASONS=${state.failReasons.join(',')}`);
  }
  process.exit(state.FORMAL_KERNEL_MINIMAL_OK === 1 ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  main();
}

export { evaluateFormalKernelMinimalState };

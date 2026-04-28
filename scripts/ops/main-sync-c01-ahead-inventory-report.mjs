#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateMainSyncC01AheadInventory } from './main-sync-c01-ahead-inventory-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_MAIN_SYNC_C01_AHEAD_INVENTORY_001';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    runId: DEFAULT_RUN_ID,
    ticketId: DEFAULT_RUN_ID,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || out.outputDir;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || out.outputDir;
      continue;
    }
    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || out.statusPath;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || out.statusPath;
      continue;
    }
  }

  return out;
}

function comparableState(state) {
  return {
    ok: state.ok,
    token: state.token,
    boundRefs: state.boundRefs,
    counts: state.counts,
    checks: state.checks,
    includedSets: state.includedSets,
    excludedSets: state.excludedSets,
    riskRows: state.riskRows,
    issues: state.issues,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();

  const run1 = evaluateMainSyncC01AheadInventory({ repoRoot });
  const run2 = evaluateMainSyncC01AheadInventory({ repoRoot });
  const run3 = evaluateMainSyncC01AheadInventory({ repoRoot });

  const comp1 = comparableState(run1);
  const comp2 = comparableState(run2);
  const comp3 = comparableState(run3);
  const repeatabilityStable = stableStringify(comp1) === stableStringify(comp2)
    && stableStringify(comp2) === stableStringify(comp3);

  const generatedAtUtc = new Date().toISOString();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const inventoryMeta = {
    branchName: 'codex/main-sync-c01-ahead-inventory-001',
    generatedAtUtc,
    headEqualsBoundRoot: true,
    headSha: run1.boundRefs.rootSha,
    originMainSha: run1.boundRefs.mainSha,
    sourceDriftProven: run1.counts.totalAheadReachableCount > 0,
    sourceTicketId: args.ticketId,
    ticketId: args.ticketId,
  };

  writeJson(statusPath, {
    version: run1.version,
    status: run1.status,
    token: run1.token,
    scope: run1.scope,
    stateScript: run1.stateScript,
    reportScript: run1.reportScript,
    contractTest: run1.contractTest,
  });

  writeJson(path.join(outputDir, 'inventory-meta.json'), inventoryMeta);
  writeJson(path.join(outputDir, 'summary.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: run1.ok && repeatabilityStable,
    token: run1.token,
    boundRefs: run1.boundRefs,
    counts: run1.counts,
    checks: run1.checks,
    repeatabilityStable,
  });
  writeJson(path.join(outputDir, 'first-parent-window.json'), run1.firstParentEntries);
  writeJson(path.join(outputDir, 'merge-window.json'), run1.mergeEntries);
  writeJson(path.join(outputDir, 'included-set.json'), run1.includedSets);
  writeJson(path.join(outputDir, 'excluded-set.json'), run1.excludedSets);
  writeJson(path.join(outputDir, 'risk-rows.json'), run1.riskRows);

  process.stdout.write(`${stableStringify({
    runId: args.runId,
    ticketId: args.ticketId,
    generatedAtUtc,
    ok: run1.ok && repeatabilityStable,
    token: run1.token,
    repeatabilityStable,
    counts: run1.counts,
  })}\n`);
  process.exit(run1.ok && repeatabilityStable ? 0 : 1);
}

main();

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

import {
  adaptRepoThemeConfig,
  buildCommandKernel,
  buildRuntimeBootstrap,
  buildRuntimeProfiles,
  buildRuntimeState,
  buildWorkspaceManifests,
  derivePhase04Compatibility,
  derivePhase05Compatibility,
  mapRuntimePlatformToCapabilityPlatform,
  validatePresetSchemaAgainstCatalog,
} from './repoDesignOsCompat.mjs';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(THIS_DIR, '../../..');

export {
  adaptRepoThemeConfig,
  buildCommandKernel,
  buildRuntimeBootstrap,
  buildRuntimeProfiles,
  buildRuntimeState,
  buildWorkspaceManifests,
  derivePhase04Compatibility,
  derivePhase05Compatibility,
  mapRuntimePlatformToCapabilityPlatform,
  validatePresetSchemaAgainstCatalog,
};

export function resolveRepoRoot(options = {}) {
  const repoRoot = typeof options.repoRoot === 'string' && options.repoRoot.trim()
    ? path.resolve(options.repoRoot)
    : DEFAULT_REPO_ROOT;
  return repoRoot;
}

export function readRepoJson(relativePath, options = {}) {
  const repoRoot = resolveRepoRoot(options);
  const targetPath = path.join(repoRoot, relativePath);
  const raw = fs.readFileSync(targetPath, 'utf8');
  return JSON.parse(raw);
}

export async function readRepoCommandCatalog(options = {}) {
  const repoRoot = resolveRepoRoot(options);
  const targetPath = path.join(repoRoot, 'src', 'renderer', 'commands', 'command-catalog.v1.mjs');
  const module = await import(pathToFileURL(targetPath).href);
  if (typeof module.listCommandCatalog === 'function') {
    return module.listCommandCatalog();
  }
  throw new Error('Command catalog module does not export listCommandCatalog().');
}

export async function readRepoCapabilityPolicy(options = {}) {
  const repoRoot = resolveRepoRoot(options);
  const targetPath = path.join(repoRoot, 'src', 'renderer', 'commands', 'capabilityPolicy.mjs');
  return import(pathToFileURL(targetPath).href);
}

export async function loadRepoGroundedDesignOsRuntime(options = {}) {
  const repoRoot = resolveRepoRoot(options);
  const commandCatalogRows = await readRepoCommandCatalog({ repoRoot });
  const capabilityPolicy = await readRepoCapabilityPolicy({ repoRoot });
  const runtimeBundle = buildRuntimeBootstrap({
    repoTheme: readRepoJson('src/renderer/theme/theme-config.v1.json', { repoRoot }),
    presetSchema: readRepoJson('docs/OPS/STATUS/X15_PROFILE_PRESETS_SCHEMA_v1.json', { repoRoot }),
    shellPolicy: readRepoJson('docs/OPS/STATUS/X15_MODE_SHELL_POLICY_v1.json', { repoRoot }),
    phase04: readRepoJson('docs/OPS/STATUS/PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1.json', { repoRoot }),
    phase05: readRepoJson('docs/OPS/STATUS/PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1.json', { repoRoot }),
    safeResetArtifact: readRepoJson('docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_V1.json', { repoRoot }),
    commandCatalogRows,
    capabilityPolicy,
    capabilities: options.capabilities,
    platformCapabilityMap: options.platformCapabilityMap,
    productTruth: options.productTruth,
  });
  return runtimeBundle.runtime;
}

import themeConfig from '../theme/theme-config.v1.json' with { type: 'json' };
import phase04Packet from '../../../docs/OPS/STATUS/PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1.json' with { type: 'json' };
import phase05Packet from '../../../docs/OPS/STATUS/PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1.json' with { type: 'json' };
import safeResetArtifact from '../../../docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_V1.json' with { type: 'json' };
import presetSchema from '../../../docs/OPS/STATUS/X15_PROFILE_PRESETS_SCHEMA_v1.json' with { type: 'json' };
import shellPolicy from '../../../docs/OPS/STATUS/X15_MODE_SHELL_POLICY_v1.json' with { type: 'json' };
import { listCommandCatalog } from '../commands/command-catalog.v1.mjs';
import * as capabilityPolicy from '../commands/capabilityPolicy.mjs';
import { buildRuntimeBootstrap } from './repoDesignOsCompat.mjs';

export function createRepoGroundedDesignOsBrowserRuntime(options = {}) {
  const bootstrap = buildRuntimeBootstrap({
    repoTheme: themeConfig,
    presetSchema,
    shellPolicy,
    commandCatalogRows: listCommandCatalog(),
    capabilityPolicy,
    phase04: phase04Packet,
    phase05: phase05Packet,
    safeResetArtifact,
    capabilities: options.capabilities,
    platformCapabilityMap: options.platformCapabilityMap,
    productTruth: options.productTruth,
  });
  return bootstrap;
}

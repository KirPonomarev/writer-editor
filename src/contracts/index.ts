// Public re-export surface for contracts.
// No runtime logic. No platform imports.

export type { CoreCommand } from "./core-command.contract";
export type { CoreEvent } from "./core-event.contract";
export type { CoreStateSnapshot } from "./core-state.contract";
export type { FileSystemPort } from "./filesystem-port.contract";
export type { DialogPort } from "./dialog-port.contract";
export type { PlatformInfoPort } from "./platform-info-port.contract";
export type {
  LongformInlineRange,
  LongformInlineRangeKind,
  LongformInlineRangeOffsetUnit,
} from "./inline-range.contract";
export type {
  LongformBlock,
  LongformBlockType,
} from "./block.contract";
export type { LongformScene } from "./scene.contract";
export type {
  LongformBookProfile,
  LongformCompileProfile,
  LongformProjectManifest,
  LongformProjectManifestSceneEntry,
} from "./longform-project.contract";

export type {
  RuntimeExecutionContract,
  RuntimeEffectsContract,
  RuntimeQueueContract,
  RuntimeTraceContract,
} from "./runtime";

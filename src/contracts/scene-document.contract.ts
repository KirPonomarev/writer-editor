import type { SceneBlockContract } from "./scene-block.contract";

export type SceneDocumentSchemaVersion = 1;

export type SceneDocumentContract = {
  schemaVersion: SceneDocumentSchemaVersion;
  id: string;
  title: string;
  order: number;
  blocks: SceneBlockContract[];
  metadata?: Record<string, unknown>;
};

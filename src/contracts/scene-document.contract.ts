export type SceneDocumentSchemaVersion = 1;

export type SceneDocumentBlockContract = {
  type: string;
  text: string;
};

export type SceneDocumentContract = {
  schemaVersion: SceneDocumentSchemaVersion;
  id: string;
  title: string;
  order: number;
  blocks: SceneDocumentBlockContract[];
  metadata?: Record<string, unknown>;
};

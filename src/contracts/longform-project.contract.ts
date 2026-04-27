// Public contract: longform project manifest shape only.

export type LongformProjectManifestSceneEntry = {
  id: string
  title: string
  file: string
  hash: string
  deleted: boolean
}

export type LongformBookProfile = {
  page: string
  locale: string
}

export type LongformCompileProfile = {
  format: string
  includeSceneTitles: boolean
}

export type LongformProjectManifest = {
  schemaVersion: number
  formatVersion: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  sceneOrder: string[]
  scenes: Record<string, LongformProjectManifestSceneEntry>
  bookProfile: LongformBookProfile
  styleMap: Record<string, unknown>
  compileProfile: LongformCompileProfile
  manifestHash: string
}

// Public contract: longform scene shape only.

import type { LongformBlock } from "./block.contract"

export type LongformScene = {
  schemaVersion: number
  id: string
  title: string
  status: string
  synopsis: string
  notes: string
  exportIntent: string
  blocks: LongformBlock[]
  meta: Record<string, unknown>
  hash: string
}

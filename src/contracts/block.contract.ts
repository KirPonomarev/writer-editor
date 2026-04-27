// Public contract: longform block shape only.

import type { LongformInlineRange } from "./inline-range.contract"

export type LongformBlockType =
  | "paragraph"
  | "heading"
  | "quote"
  | "sceneBreak"
  | "note"

export type LongformBlock = {
  schemaVersion: number
  id: string
  type: LongformBlockType
  text: string
  inlineRanges: LongformInlineRange[]
  attrs: Record<string, unknown>
}

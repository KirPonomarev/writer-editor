// Public contract: longform inline range shape only.

export type LongformInlineRangeOffsetUnit =
  | "codeUnit"
  | "codePoint"
  | "grapheme"

export type LongformInlineRangeKind =
  | "bold"
  | "italic"
  | "underline"
  | "commentAnchor"
  | "link"
  | "style"

export type LongformInlineRange = {
  schemaVersion: number
  id: string
  kind: LongformInlineRangeKind
  from: number
  to: number
  offsetUnit: LongformInlineRangeOffsetUnit
  attrs: Record<string, unknown>
}

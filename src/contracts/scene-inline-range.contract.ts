export type SceneInlineMarkTypeContract = 'bold' | 'italic';

export type SceneInlineRangeContract = {
  id: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  markType: SceneInlineMarkTypeContract;
  payload?: Record<string, never>;
};

export type SceneBlockTypeContract = 'paragraph' | 'heading' | 'blockquote' | 'thematicBreak';

export type SceneBlockContract = {
  id: string;
  sceneId: string;
  type: SceneBlockTypeContract;
  text?: string;
  markRefs?: string[];
};

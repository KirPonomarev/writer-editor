import { Extension } from '@tiptap/core';
import { canonicalizeDocumentJson } from '../documentContentEnvelope.mjs';
import stories from '../../core/word-stories-projection-v1.cjs';

// Bodies remain in the scene envelope, outside the manuscript text stream.
export const DocumentStories = Extension.create({
  name: 'documentStories',
  addGlobalAttributes() {
    return [{ types: ['doc'], attributes: { wordStories: { default: null, rendered: false, parseHTML: () => null } } }];
  },
});

export function storyInventory(doc) {
  const registry = stories.readProjection(doc);
  if (!registry) return [];
  const resolved = stories.resolved(registry);
  const variants = { default: 'обычные страницы', first: 'первая страница', even: 'чётные страницы' };
  return registry.stories.map(story => {
    const uses = [];
    resolved.forEach((section, index) => {
      for (const variant of stories.VARIANTS) if (section[story.role][variant] === story.id) {
        const inactive = variant === 'first' && !section.titlePage || variant === 'even' && !registry.evenAndOddHeaders;
        uses.push(`раздел ${index + 1}, ${variants[variant]}${inactive ? ' (не используется)' : ''}`);
      }
    });
    return { ...story, label: `${story.role === 'header' ? 'Верхний' : 'Нижний'} колонтитул: ${uses.join('; ')}` };
  });
}

export function applyStoryBody(editor, expectedDoc, storyId, body) {
  if (!editor || editor.isDestroyed || !editor.isEditable
    || JSON.stringify(canonicalizeDocumentJson(editor.getJSON())) !== JSON.stringify(canonicalizeDocumentJson(expectedDoc))) return false;
  const next = stories.replaceBodyProjection(expectedDoc, storyId, body);
  if (JSON.stringify(stories.topology(stories.readProjection(expectedDoc)))
    !== JSON.stringify(stories.topology(stories.readProjection(next)))) return false;
  editor.view.dispatch(editor.state.tr.setDocAttribute('wordStories', next.attrs.wordStories));
  return JSON.stringify(editor.getJSON().attrs.wordStories) === JSON.stringify(next.attrs.wordStories);
}

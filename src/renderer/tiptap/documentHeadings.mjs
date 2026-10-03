import Heading from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';

// Word has nine semantic heading levels; HTML has six heading elements.
// Keep the document level exact and use the existing h6 presentation above six.
export const DocumentHeadings = Heading.extend({
  addOptions() {
    return { ...this.parent?.(), levels: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
  },
  parseHTML() {
    return [
      ...[7, 8, 9].map(level => ({
        tag: `h6[data-word-heading-level="${level}"]`, attrs: { level }, priority: 60,
      })),
      ...[1, 2, 3, 4, 5, 6].map(level => ({ tag: `h${level}`, attrs: { level } })),
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level;
    if (!Number.isInteger(level) || level < 1 || level > 9) throw Error('WORD_HEADING_LEVEL_INVALID');
    return [`h${Math.min(level, 6)}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes,
      level > 6 ? { 'data-word-heading-level': String(level), 'aria-level': String(level) } : {}), 0];
  },
});

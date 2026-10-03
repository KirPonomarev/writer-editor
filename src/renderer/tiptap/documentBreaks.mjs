import HardBreak from '@tiptap/extension-hard-break';
import { mergeAttributes } from '@tiptap/core';
import breaks from '../../core/word-typed-breaks-v1.cjs';

export const DocumentBreaks = HardBreak.extend({
  addAttributes() {
    return { wordBreakType: { default: null, rendered: false,
      parseHTML: element => {
        const type = element.getAttribute('data-word-break');
        if (type !== null && !['page', 'column'].includes(type)) throw Error('WORD_TYPED_BREAK_INVALID');
        return type;
      } } };
  },
  renderHTML({ node, HTMLAttributes }) {
    const type = breaks.kind({ type: 'hardBreak', attrs: node.attrs });
    return ['br', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes,
      type === 'line' ? {} : { 'data-word-break': type, title: type === 'page' ? 'Разрыв страницы' : 'Разрыв колонки' })];
  },
  addCommands() {
    return { ...this.parent?.(), setWordBreak: type => ({ state, commands }) => {
      if (!['page', 'column'].includes(type) || !['paragraph', 'heading'].includes(state.selection.$from.parent.type.name)
        || !state.selection.$from.sameParent(state.selection.$to)) return false;
      return commands.insertContent({ type: this.name, attrs: { wordBreakType: type } });
    } };
  },
  addKeyboardShortcuts() {
    return { ...this.parent?.(), 'Mod-Enter': () => this.editor.commands.setWordBreak('page'),
      'Mod-Shift-Enter': () => this.editor.commands.setWordBreak('column') };
  },
});

import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { DocumentTextStyle } from './documentTextStyle.mjs';
import { DocumentParagraphAlignment } from './documentParagraphAlignment.mjs';
import { sha256Hex } from '../../core/browser-safe-hash.mjs';
import { openLinkDialog } from '../linkDialog.mjs';

const referenceKey = new PluginKey('manuscriptNoteReferences');
export const ManuscriptNoteReferences = Extension.create({
  name: 'manuscriptNoteReferences',
  addProseMirrorPlugins() {
    return [new Plugin({ key: referenceKey,
      state: { init: () => DecorationSet.empty,
        apply: (tr, previous) => tr.getMeta(referenceKey) ?? (tr.docChanged ? previous.map(tr.mapping, tr.doc) : previous) },
      props: { decorations: state => referenceKey.getState(state) },
    })];
  },
});

export function applyManuscriptNoteProjection(editor, projection, positionForOffset) {
  if (!editor || editor.isDestroyed) return;
  const source = projection?.manuscriptAuthoring;
  const text = editor.getText({ blockSeparator: '\n' });
  const notes = source?.available && source.sourceTextSha256 === sha256Hex(text)
    ? (projection.notes || []).filter(note => !note.deleted && note.manuscript?.reference.sceneId === source.sceneId
      && note.manuscript.reference.sourceTextSha256 === source.sourceTextSha256) : [];
  const ordinals = { footnote: 0, endnote: 0 };
  const widgets = notes.sort((a, b) => a.manuscript.reference.offsetUtf16 - b.manuscript.reference.offsetUtf16 || a.id.localeCompare(b.id))
    .map(note => { const ordinal = ++ordinals[note.manuscript.kind]; return Decoration.widget(positionForOffset(editor, note.manuscript.reference.offsetUtf16), () => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'manuscript-note-reference'; button.textContent = String(ordinal);
      button.setAttribute('aria-label', `${note.manuscript.kind === 'endnote' ? 'Концевая сноска' : 'Сноска'} ${ordinal}: ${note.body.slice(0, 80)}`);
      button.addEventListener('click', event => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('yalken:manuscript-note-open', { detail: { noteId: note.id, projectId: projection.projectId } }));
      });
      return button;
    }, { side: 1, key: `${note.id}:${note.contentHash}:${ordinal}`, stopEvent: () => true }); });
  editor.view.dispatch(editor.state.tr.setMeta(referenceKey, DecorationSet.create(editor.state.doc, widgets)).setMeta('addToHistory', false));
}

export function createManuscriptBodyEditor(host, { onChange, onSave } = {}) {
  const controls = document.createElement('div'); controls.className = 'manuscript-note-toolbar';
  controls.setAttribute('role', 'toolbar'); controls.setAttribute('aria-label', 'Форматирование сноски');
  const surface = document.createElement('div'); surface.className = 'manuscript-note-body'; host.append(controls, surface);
  const editor = new Editor({ element: surface,
    extensions: [StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false,
      blockquote: false, codeBlock: false, code: false, horizontalRule: false, trailingNode: false, link: false, underline: false }),
    DocumentTextStyle, DocumentParagraphAlignment, Color,
    Highlight.configure({ multicolor: true }), Underline,
    Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false })],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Текст сноски', 'aria-multiline': 'true' },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (typeof text !== 'string') return false;
        event.preventDefault();
        editor.commands.insertContent(text.split(/\r\n?|\n/u).map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })));
        return true;
      } },
    onUpdate: () => onChange?.(editor.getJSON()),
  });
  for (const [label, command] of [['Полужирный', 'toggleBold'], ['Курсив', 'toggleItalic'], ['Подчёркивание', 'toggleUnderline'], ['Зачёркивание', 'toggleStrike']]) {
    const button = document.createElement('button');button.type = 'button';button.className = 'notes-button';button.textContent = label;
    button.addEventListener('click', () => editor.chain().focus()[command]().run());controls.append(button);
  }
  let documentGeneration = 0;
  const linkButton = document.createElement('button'); linkButton.type = 'button'; linkButton.className = 'notes-button'; linkButton.textContent = 'Ссылка';
  linkButton.addEventListener('click', async () => {
    const generation = documentGeneration, doc = editor.state.doc, selection = editor.state.selection;
    if (!editor.isEditable || (selection.empty && !editor.isActive('link'))) return;
    const normalize = value => { try { const url = new URL(value); return { ok: !value || ['http:', 'https:'].includes(url.protocol) }; } catch { return { ok: value === '' }; } };
    const response = await openLinkDialog({ title: 'Ссылка в сноске', initialValue: editor.getAttributes('link').href || '',
      canRemove: editor.isActive('link'), normalize, fieldLabel: 'Адрес ссылки', submitLabel: 'Применить', cancelLabel: 'Отмена', errorMessage: 'Введите адрес HTTP или HTTPS.' });
    if (response === null || generation !== documentGeneration || editor.isDestroyed || !editor.isEditable || editor.state.doc !== doc) return;
    const chain = editor.chain().focus().setTextSelection({ from: selection.from, to: selection.to }).extendMarkRange('link');
    if (response) chain.setLink({ href: response }).run(); else chain.unsetLink().run();
  });
  controls.append(linkButton);
  host.addEventListener('keydown', event => {
    event.stopPropagation();
    if ((event.metaKey || event.ctrlKey) && (event.key === 'Enter' || event.key.toLowerCase() === 's')) {
      event.preventDefault(); onSave?.();
    }
  });
  return { getJSON: () => editor.getJSON(), setDocument: doc => { documentGeneration++; editor.commands.setContent(doc, { emitUpdate: false }); },
    setEditable: value => { editor.setEditable(value); for (const button of controls.querySelectorAll('button')) button.disabled = !value; },
    focus: () => editor.commands.focus('end'), destroy: () => editor.destroy() };
}

import { normalizeFontFamily, normalizeFontSize } from '../../io/inlineTypography.mjs';
import commentBody from '../../core/word-comment-body-v1.cjs';
import { canonicalizeDocumentJson } from '../documentContentEnvelope.mjs';
import { DocumentListNumbering } from './documentListNumbering.mjs';
import { Editor, Extension, generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { DocumentTextStyle } from './documentTextStyle.mjs';
import { DocumentParagraphAlignment } from './documentParagraphAlignment.mjs';
import { DocumentMedia } from './documentMedia.mjs';
import { DocumentTables } from './documentTables.mjs';
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
      button.type = 'button'; button.className = 'manuscript-note-reference'; button.dataset.noteNumber = String(ordinal);
      button.contentEditable = 'false';
      button.setAttribute('aria-label', `${note.manuscript.kind === 'endnote' ? 'Концевая сноска' : 'Сноска'} ${ordinal}: ${note.body.slice(0, 80)}`);
      button.addEventListener('click', event => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('yalken:manuscript-note-open', { detail: { noteId: note.id, projectId: projection.projectId } }));
      });
      return button;
    }, { side: 1, key: `${note.id}:${note.contentHash}:${ordinal}`, stopEvent: () => true }); });
  editor.view.dispatch(editor.state.tr.setMeta(referenceKey, DecorationSet.create(editor.state.doc, widgets)).setMeta('addToHistory', false));
}

const bodyEditors = new WeakMap();
export function getFocusedManuscriptBodyEditor(doc = globalThis.document) {
  const host = doc?.activeElement?.closest?.('.manuscript-note-editor');
  return host ? bodyEditors.get(host) || null : null;
}

export function manuscriptBodyExtensions({ profile = 'manuscript' } = {}) {
  const comment = profile === 'comment';
  return [StarterKit.configure({ heading: false,
      ...(comment ? { bulletList: false, orderedList: false, listItem: false } : {}),
      blockquote: false, codeBlock: false, code: false, horizontalRule: false, trailingNode: false, link: false, underline: false }),
    ...(!comment ? [DocumentListNumbering] : []), DocumentTextStyle, DocumentParagraphAlignment, Color,
    ...(!comment ? [DocumentMedia, DocumentTables.configure({ cellContent: '(paragraph | bulletList | orderedList | table)+' })] : []),
    Highlight.configure({ multicolor: true }), Underline,
    Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false })];
}

export function commentBodyDocumentForEditor(message) {
  if (!message) return { type: 'doc', content: [{ type: 'paragraph' }] };
  return commentBody.commentBodyDocument(message);
}

export function renderCommentBodyHtml(message) {
  return generateHTML(commentBodyDocumentForEditor(message), manuscriptBodyExtensions({ profile: 'comment' }));
}

export function readManuscriptBodyDocument(editor) {
  const doc = canonicalizeDocumentJson(editor.getJSON());
  // Shared editor extensions emit null document defaults. Once canonicalized,
  // an empty attribute container is not part of the auxiliary rich-body model.
  if (doc.attrs && Object.keys(doc.attrs).length === 0) delete doc.attrs;
  return doc;
}

export function createManuscriptBodyEditor(host, { onChange, onSave, onEscape, bodyLabel = 'Текст сноски', toolbarLabel = 'Форматирование сноски', linkTitle = 'Ссылка в сноске', profile = 'manuscript' } = {}) {
  const controls = document.createElement('div'); controls.className = 'manuscript-note-toolbar';
  controls.setAttribute('role', 'toolbar'); controls.setAttribute('aria-label', toolbarLabel);
  const surface = document.createElement('div'); surface.className = 'manuscript-note-body'; host.append(controls, surface);
  const editor = new Editor({ element: surface,
    extensions: manuscriptBodyExtensions({ profile }),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: { attributes: { role: 'textbox', 'aria-label': bodyLabel, 'aria-multiline': 'true' },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (typeof text !== 'string') return false;
        event.preventDefault();
        const lines = text.split(/\r\n?|\n/u);
        if (lines.length === 1) { if (text) editor.commands.insertContent({ type: 'text', text }); }
        else editor.commands.insertContent(lines.map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })));
        return true;
      } },
    onUpdate: () => onChange?.(readManuscriptBodyDocument(editor)),
  });
  bodyEditors.set(host, editor);
  for (const [label, command] of [['Полужирный', 'toggleBold'], ['Курсив', 'toggleItalic'], ['Подчёркивание', 'toggleUnderline'], ['Зачёркивание', 'toggleStrike']]) {
    const button = document.createElement('button');button.type = 'button';button.className = 'notes-button';button.textContent = label;
    button.addEventListener('click', () => editor.chain().focus()[command]().run());controls.append(button);
  }
  for (const [label, command, args] of (profile === 'comment' ? [] : [
    ['Маркированный список', 'toggleBulletList', []], ['Нумерованный список', 'toggleOrderedList', []],
    ['Увеличить уровень списка', 'sinkListItem', ['listItem']], ['Уменьшить уровень списка', 'liftListItem', ['listItem']],
  ])) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'notes-button'; button.textContent = label;
    button.addEventListener('click', () => { if (editor.isEditable) editor.chain().focus()[command](...args).run(); }); controls.append(button);
  }
  if (profile === 'comment') {
    const field = (label, type, apply) => {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = document.createElement('input'); input.type = type; input.setAttribute('aria-label', label);
      input.className = 'notes-button'; wrapper.append(input); controls.append(wrapper);
      input.addEventListener('change', () => {
        if (!editor.isEditable) return;
        try { apply(input.value); input.removeAttribute('aria-invalid'); }
        catch { input.setAttribute('aria-invalid', 'true'); }
      });
      return input;
    };
    const font = field('Шрифт', 'text', value => editor.chain().focus().setMark('textStyle', { fontFamily: value ? normalizeFontFamily(value) : null }).run());
    font.placeholder = 'По умолчанию'; font.size = 12;
    const size = field('Кегль', 'number', value => editor.chain().focus().setMark('textStyle', { fontSize: value ? normalizeFontSize(value + 'pt') : null }).run());
    size.min = '1'; size.max = '400'; size.step = '0.5'; size.placeholder = 'пт';
    const color = field('Цвет текста', 'color', value => editor.chain().focus().setColor(value).run());
    const highlight = field('Выделение цветом', 'color', value => editor.chain().focus().setHighlight({ color: value }).run());
    for (const [label, command] of [['Убрать цвет текста', 'unsetColor'], ['Убрать выделение', 'unsetHighlight']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'notes-button'; button.textContent = label;
      button.addEventListener('click', () => { if (editor.isEditable) editor.chain().focus()[command]().run(); }); controls.append(button);
    }
    const sync = () => {
      const style = editor.getAttributes('textStyle');
      if (document.activeElement !== font) font.value = style.fontFamily || '';
      if (document.activeElement !== size) size.value = style.fontSize ? String(parseFloat(style.fontSize)) : '';
      if (/^#[0-9a-f]{6}$/iu.test(style.color || '')) color.value = style.color;
      const highlightColor = editor.getAttributes('highlight').color;
      if (/^#[0-9a-f]{6}$/iu.test(highlightColor || '')) highlight.value = highlightColor;
    };
    editor.on('selectionUpdate', sync); editor.on('update', sync);
  }
  let documentGeneration = 0;
  const linkButton = document.createElement('button'); linkButton.type = 'button'; linkButton.className = 'notes-button'; linkButton.textContent = 'Ссылка';
  linkButton.addEventListener('click', async () => {
    const generation = documentGeneration, doc = editor.state.doc, selection = editor.state.selection;
    if (!editor.isEditable || (selection.empty && !editor.isActive('link'))) return;
    const normalize = value => { try { const url = new URL(value); return { ok: !value || ['http:', 'https:'].includes(url.protocol) }; } catch { return { ok: value === '' }; } };
    const response = await openLinkDialog({ title: linkTitle, initialValue: editor.getAttributes('link').href || '',
      canRemove: editor.isActive('link'), normalize, fieldLabel: 'Адрес ссылки', submitLabel: 'Применить', cancelLabel: 'Отмена', errorMessage: 'Введите адрес HTTP или HTTPS.' });
    if (response === null || generation !== documentGeneration || editor.isDestroyed || !editor.isEditable || editor.state.doc !== doc) return;
    const chain = editor.chain().focus().setTextSelection({ from: selection.from, to: selection.to }).extendMarkRange('link');
    if (response) chain.setLink({ href: response }).run(); else chain.unsetLink().run();
  });
  controls.append(linkButton);
  host.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && onEscape) { event.preventDefault(); onEscape(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault(); onSave?.();
    }
  });
  return { getJSON: () => readManuscriptBodyDocument(editor), setDocument: doc => {
    documentGeneration++; editor.commands.setContent(doc, { emitUpdate: false });
    // Replacing a note/project is not an authoring edit. Its history must never
    // expose the previous entity's body through Undo.
    editor.view.updateState(EditorState.create({ schema: editor.schema, doc: editor.state.doc, plugins: editor.state.plugins }));
  },
    setEditable: value => { editor.setEditable(value, false); for (const button of controls.querySelectorAll('button, input, select')) button.disabled = !value; },
    focus: () => editor.commands.focus('end'), focusPreservingSelection: () => editor.view.focus(), destroy: () => { bodyEditors.delete(host); editor.destroy(); } };
}

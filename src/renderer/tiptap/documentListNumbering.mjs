import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Slice, Fragment } from '@tiptap/pm/model';
import { Mapping } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { closeHistory, isHistoryTransaction } from '@tiptap/pm/history';
import numbering from '../../core/word-list-numbering-v1.cjs';

// Omit only absent defaults declared by the trusted live schema. Core still
// rejects undefined data from external JSON and explicit malformed metadata.
export function numberingDocumentJSON(node) {
  const json = node.toJSON();
  const attrs = (value, spec) => {
    if (!value) return value;
    const copy = Object.create(Object.getPrototypeOf(value));
    for (const key of Reflect.ownKeys(value)) {
      const field = Object.getOwnPropertyDescriptor(value,key);
      const declaration = spec && Object.getOwnPropertyDescriptor(spec,key);
      const fallback = declaration && Object.hasOwn(declaration,'value')
        ? Object.getOwnPropertyDescriptor(declaration.value,'default') : null;
      if (field && Object.hasOwn(field,'value') && field.value === undefined
        && fallback && Object.hasOwn(fallback,'value') && fallback.value === undefined) continue;
      Object.defineProperty(copy,key,field);
    }
    return copy;
  };
  const visit = (live, out) => {
    if (out.attrs) out.attrs = attrs(out.attrs,live.type.spec.attrs);
    if (out.marks) out.marks.forEach((mark,index) => {
      if (mark.attrs) mark.attrs = attrs(mark.attrs,live.marks[index].type.spec.attrs);
    });
    live.forEach((child,_offset,index) => visit(child,out.content[index]));
  };
  visit(node,json);
  return json;
}

const numberingNormalization = new PluginKey('numberingNormalization');

// The Core counter owns semantics. This adapter only applies its projection to
// the current authoring transaction; persistence still uses canonical Save.
export const DocumentListNumbering = Extension.create({
  name: 'documentListNumbering',
  addOptions() { return { onClipboardStatus: () => {} }; },
  addGlobalAttributes() {
    return [{ types: ['orderedList'], attributes: {
      wordNumbering: { default: null, rendered: false, parseHTML: () => null },
      wordListId: { default: null, rendered: false, parseHTML: () => null },
      wordListStart: { default: null, rendered: false, parseHTML: () => null },
    } }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      state: {
        init: (_config, state) => numberingDecorations(state.doc),
        apply: (tr, decorations, oldState) => !tr.docChanged ? decorations
          : isInlineOnly([tr]) ? decorations.map(tr.mapping, tr.doc) : numberingDecorations(tr.doc, (tr.getMeta('wordPendingRevisionsExternal') === true || isHistoryTransaction(tr) || tr.getMeta(numberingNormalization) === true) ? null : oldState.doc, tr.mapping),
      },
      props: { ...createNumberingClipboardHandlers(this.options?.onClipboardStatus), decorations(state) { return this.getState(state); } },
      appendTransaction(transactions, _old, state) {
      if (!transactions.some(tr => tr.docChanged) || isInlineOnly(transactions)) return null;
      const authoritativeRestore = transactions.some(tr => tr.getMeta('wordPendingRevisionsExternal') === true || isHistoryTransaction(tr));
      const mapping = new Mapping();transactions.forEach(transaction => mapping.appendMapping(transaction.mapping));
      const json = numbering.normalizeAuthoring(numberingDocumentJSON(state.doc), authoritativeRestore ? undefined : numberingDocumentJSON(_old.doc),
        authoritativeRestore ? undefined : numberingParagraphProvenance(_old.doc,state.doc,mapping)), starts = numbering.resolve(json);
      if (!starts.size) return null;
      const tr = state.tr;
      const lists = []; walkLists(json, node => lists.push(node));
      let listIndex = 0;
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'orderedList') return;
        const planned = lists[listIndex++];
        if (planned.attrs?.wordListId == null && planned.attrs?.wordNumbering == null) return;
        const start = starts.get(planned);
        const attrs = { ...node.attrs, ...planned.attrs, start };
        if (JSON.stringify(node.attrs) !== JSON.stringify(attrs)) tr.setNodeMarkup(pos, undefined, attrs);
      });
      return tr.docChanged ? tr.setMeta(numberingNormalization,true) : null;
    } })];
  },
});

export const NUMBERING_CLIPBOARD_MIME = 'application/x-yalken-numbering-v1+json';
export function createNumberingClipboardHandlers(onStatus = () => {}) {
  const report = () => onStatus('Нумерация не скопирована или не вставлена. Выберите полный список с родительскими пунктами; текст документа сохранён.');
  const hasNumbering = slice => {
    let found = false; slice.content.descendants(node => { if (node.attrs.wordNumbering != null) found = true; }); return found;
  };
  const asDoc = slice => { const content=[];slice.content.forEach(node=>content.push(numberingDocumentJSON(node)));return {type:'doc',content}; };
  const copy = (view, event) => {
    const selection = view.state.selection;
    if (selection.empty) return false;
    const slice = selection.content();
    if (!hasNumbering(slice)) return false;
    event.preventDefault();
    try {
      if (slice.openStart || slice.openEnd || !event.clipboardData || event.type === 'cut' && !view.editable) throw Error('NUMBERING_CLIPBOARD_PARTIAL');
      const carrier = numbering.createNumberingClipboard(asDoc(slice));
      const {dom,text} = view.serializeForClipboard(slice);
      event.clipboardData.clearData();
      event.clipboardData.setData('text/html',dom.innerHTML);
      event.clipboardData.setData('text/plain',text);
      event.clipboardData.setData(NUMBERING_CLIPBOARD_MIME,carrier);
      if (event.clipboardData.getData(NUMBERING_CLIPBOARD_MIME) !== carrier) throw Error('NUMBERING_CLIPBOARD_WRITE_FAILED');
      if (event.type === 'cut') view.dispatch(closeHistory(view.state.tr.deleteSelection()).scrollIntoView().setMeta('uiEvent','cut'));
    } catch { report(); }
    return true;
  };
  return {
    handleDOMEvents: {copy,cut:copy},
    handlePaste(view,event,slice) {
      // ProseMirror data-pm-slice context can create attrs directly, bypassing
      // parseHTML. Only the bounded Core carrier may restore private identity.
      let hiddenIdentity = false;
      slice.content.descendants(node => {
        if (['wordNumbering','wordListId','wordListStart'].some(key => node.attrs[key] != null)) hiddenIdentity = true;
      });
      if (hiddenIdentity) { event.preventDefault(); report(); return true; }
      // An explicit Paste as Plain Text keeps the existing plain-text policy.
      if (event.shiftKey) return false;
      const carrier = event.clipboardData?.getData(NUMBERING_CLIPBOARD_MIME);
      if (!carrier) return false;
      event.preventDefault();
      try {
        if (!view.editable || slice.openStart || slice.openEnd) throw Error('NUMBERING_CLIPBOARD_PARTIAL');
        const planned = numbering.prepareNumberingPaste(numberingDocumentJSON(view.state.doc),{fragment:asDoc(slice),numberingCarrier:carrier});
        const content = Fragment.fromJSON(view.state.schema,planned.content);
        const tr = closeHistory(view.state.tr.replaceSelection(new Slice(content,0,0)));
        view.dispatch(tr.scrollIntoView().setMeta('paste',true).setMeta('uiEvent','paste'));
      } catch { report(); }
      return true;
    },
  };
}

function isInlineOnly(transactions) {
  return transactions.every(tr => tr.steps.every((step, index) => {
    if (!step.slice || !Number.isInteger(step.from) || !Number.isInteger(step.to)) return false;
    const from = tr.docs[index].resolve(step.from), to = tr.docs[index].resolve(step.to);
    return from.sameParent(to) && from.parent.isTextblock
      && step.slice.openStart === 0 && step.slice.openEnd === 0
      && Array.from({ length: step.slice.content.childCount }, (_, i) => step.slice.content.child(i)).every(node => node.isInline);
  }));
}

function walkLists(node, visit, path = []) {
  if (node.type === 'orderedList') visit(node, path);
  (node.content || []).forEach((child, index) => walkLists(child, visit, [...path, index]));
}

// Positions come only from actual ProseMirror transaction mappings. Core owns
// logical levels; this adapter reports surviving paragraph occurrences only.
export function numberingParagraphProvenance(before, after, mapping) {
  const paragraphs = [];
  const pathAt = position => Array.from({length:position.depth},(_,depth)=>position.index(depth));
  before.descendants((node,pos,parent,index) => {
    if (index !== 0 || parent?.type.name !== 'listItem' || !['paragraph','heading'].includes(node.type.name)) return;
    const prior = before.resolve(pos+1), mapped = mapping.mapResult(pos+1,1);
    if (mapped.deleted || mapped.pos < 0 || mapped.pos > after.content.size) return;
    const current = after.resolve(mapped.pos);
    if (!['paragraph','heading'].includes(current.parent.type.name)) return;
    if (paragraphs.length >= 64000) throw Error('WORD_LIST_NUMBERING_INVALID');
    paragraphs.push({beforePath:pathAt(prior),afterPath:pathAt(current)});
  });
  return {schemaVersion:1,paragraphs};
}

export function numberingDecorations(doc, before = null, mapping = null) {
  const json = numbering.normalizeAuthoring(numberingDocumentJSON(doc), before ? numberingDocumentJSON(before) : undefined, before && mapping ? numberingParagraphProvenance(before,doc,mapping) : undefined), markers = numbering.resolveMarkers(json), byPath = new Map();
  for (const projection of markers.values()) byPath.set(projection.path.join('/'), projection);
  const decorations = [];
  function visit(node, pos, path) {
    const projection = byPath.get(path.join('/'));
    let offset = 0;
    node.forEach((child, _offset, index) => {
      const childPos = pos + (node.type.name === 'doc' ? 0 : 1) + offset;
      if (projection && child.type.name === 'listItem') {
        const label = projection.items[index]?.label;
        if (typeof label === 'string') decorations.push(Decoration.node(childPos, childPos + child.nodeSize,
          { class: 'word-numbering-item', 'data-word-marker': label }));
      }
      visit(child, childPos, [...path, index]); offset += child.nodeSize;
    });
  }
  visit(doc, 0, []);
  return DecorationSet.create(doc, decorations);
}

// A captured authoring target is never rediscovered from focus after a dialog.
export function captureNumberingTarget(editor, isCurrent = () => true) {
  if (!editor || editor.isDestroyed || !editor.isEditable || !editor.state?.selection) return null;
  const doc = editor.state.doc, selection = editor.state.selection, resolved = selection.$from;
  let depth = resolved.depth;
  while (depth > 0 && resolved.node(depth).type.name !== 'orderedList') depth--;
  if (!depth) depth = resolved.depth;
  if (!['orderedList', 'paragraph', 'heading'].includes(resolved.node(depth).type.name)
    || selection.to > resolved.end(depth)) return null;
  const listPath = Array.from({ length: depth }, (_, i) => resolved.index(i));
  const original = numberingDocumentJSON(doc);
  let selected = original; for (const index of listPath) selected = selected.content[index];
  const pattern = selected.attrs?.wordNumbering;
  const levels = pattern ? structuredClone(pattern.levels) : numbering.defaultLevels();
  const candidates = [];
  for (const projection of numbering.resolveMarkers(original).values()) {
    if (projection.path.join('/') === listPath.join('/')) break;
    if (!candidates.some(item => item.instanceId === projection.instanceId)) candidates.push({ instanceId: projection.instanceId, label: projection.items[0]?.label || projection.instanceId });
  }
  const current = () => !editor.isDestroyed && editor.isEditable && editor.state.doc === doc && isCurrent();
  const plan = input => {
    if (!current()) throw Error('STALE_EDITOR_TARGET');
    return numbering.planNumberingEdit(original, { ...input, listPath });
  };
  return Object.freeze({ levels, level: pattern?.level || 0, candidates,
    preview(input) {
      const next = plan(input), output = [];
      for (const projection of numbering.resolveMarkers(next).values()) {
        if (projection.path.join('/') === listPath.join('/')) output.push(...projection.items.map(item => item.label));
      }
      return output;
    },
    apply(input) {
      const next = plan(input), tr = editor.state.tr;
      // Core changes list attrs, or wraps one paragraph. Text and unrelated
      // node identities are retained; this is one normal history transaction.
      function applyNode(before, after, pos) {
        if (before.type.name !== after.type) {
          tr.replaceWith(tr.mapping.map(pos), tr.mapping.map(pos + before.nodeSize), editor.schema.nodeFromJSON(after)); return;
        }
        const normalized = editor.schema.nodeFromJSON(after);
        if (before.type.name !== 'doc' && JSON.stringify(before.attrs) !== JSON.stringify(normalized.attrs)) tr.setNodeMarkup(tr.mapping.map(pos), undefined, normalized.attrs);
        if (before.childCount !== normalized.childCount) throw Error('NUMBERING_STRUCTURE_CHANGED');
        before.forEach((child, offset, index) => applyNode(child, after.content[index], pos + (before.type.name === 'doc' ? 0 : 1) + offset));
      }
      applyNode(doc, next, 0);
      if (!current()) throw Error('STALE_EDITOR_TARGET');
      tr.setSelection(selection.map(tr.doc, tr.mapping));
      editor.view.dispatch(closeHistory(tr)); editor.commands.focus();
      return { performed: tr.docChanged, action: 'configureNumbering', reason: tr.docChanged ? null : 'NO_OP' };
    },
  });
}

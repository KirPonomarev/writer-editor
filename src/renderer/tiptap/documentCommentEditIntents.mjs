import { Extension } from '@tiptap/core';
import { AllSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { sha256Hex } from '../../core/browser-safe-hash.mjs';

const ledgerKey = new PluginKey('commentEditIntents');
const checkpointKey = new PluginKey('commentEditCheckpoint');
const leafCounts = new WeakMap();
const leafPrefixes = new WeakMap();
const capturedSnapshots = new WeakMap();
const paragraphTypes = new Set(['paragraph', 'heading', 'codeBlock']);
const countLeaves = node => {
  if (leafCounts.has(node)) return leafCounts.get(node);
  let count = paragraphTypes.has(node.type.name) ? 1 : 0;
  if (!count) {
    const prefixes = [0];
    node.forEach(child => { count += countLeaves(child); prefixes.push(count); });
    leafPrefixes.set(node, prefixes);
  }
  leafCounts.set(node, count);
  return count;
};
function paragraphAt(doc, position, structure = doc) {
  const at = doc.resolve(position);
  if (!paragraphTypes.has(at.parent.type.name)) throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
  countLeaves(structure);
  let paragraphIndex = 0, owner = structure;
  for (let depth = 0; depth < at.depth; depth++) {
    const index = at.index(depth);
    paragraphIndex += leafPrefixes.get(owner)[index];
    owner = owner.child(index);
  }
  return { paragraphIndex, node: at.parent, offset: at.parentOffset };
}
function inlineText(node) {
  let text = '';
  node.forEach(child => {
    if (child.isText) text += child.text;
    else if (child.type.name === 'hardBreak') text += '\n';
    else throw new Error('COMMENT_EDIT_INLINE_UNSUPPORTED');
  });
  return text;
}
function paragraphs(doc) {
  const result = [];
  doc.descendants(node => {
    if (!paragraphTypes.has(node.type.name)) return true;
    result.push(inlineText(node)); return false;
  });
  if (result.length > 10000) throw new Error('COMMENT_EDIT_BUDGET');
  return result;
}
// Structural coordinates come from the actual replacement StepMap on both
// documents. Paragraph boundaries are array edges; hardBreak remains a LF.
function rootParagraphRange(doc, fromPosition, toPosition) {
  const endpoint = position => {
    const at = doc.resolve(position);
    let index, offset;
    if (at.depth === 1 && at.parent.type.name === 'paragraph') {
      index = at.index(0); offset = at.parentOffset;
    } else if (at.depth === 0) {
      index = at.index(0);
      if (index === doc.childCount) { index--; offset = doc.child(index).content.size; }
      else offset = 0;
    } else throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
    const node = doc.child(index);
    if (node.type.name !== 'paragraph') throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
    let paragraphIndex = 0;
    countLeaves(doc);
    paragraphIndex = leafPrefixes.get(doc)[index];
    return { index, paragraphIndex, offset };
  };
  const from = endpoint(fromPosition), to = endpoint(toPosition), parts = [];
  for (let index = from.index; index <= to.index; index++) {
    const node = doc.child(index);
    if (node.type.name !== 'paragraph') throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
    const text = inlineText(node);
    parts.push(text.slice(index === from.index ? from.offset : 0, index === to.index ? to.offset : text.length));
  }
  return { from, to, parts };
}
function eventBookmark(branch) {
  for (let index = branch?.items?.length - 1; index >= 0; index--) {
    const bookmark = branch.items.get(index).selection;
    if (bookmark) return bookmark;
  }
  return null;
}
function historyState(state) {
  const plugin = state.plugins.find(item => /^history\$/u.test(item.key));
  return plugin?.getState(state);
}
function initial(doc) {
  countLeaves(doc);
  return { baseline: doc, edits: [], groups: new Map(), incarnation: globalThis.crypto.randomUUID(), nextGroup: 1, nextEdit: 1, invalid: false };
}
function capture(tr, previous, oldState, newState) {
  if (tr.getMeta('wordPendingRevisionsExternal') === true) return initial(tr.doc);
  const checkpoint = tr.getMeta(checkpointKey);
  if (checkpoint) {
    const count = checkpoint.nextEdit - (previous.nextEdit - previous.edits.length);
    if (checkpoint.incarnation !== previous.incarnation || count < 0 || count > previous.edits.length || count > checkpoint.edits.length
      || JSON.stringify(previous.edits.slice(0, count)) !== JSON.stringify(checkpoint.edits.slice(checkpoint.edits.length - count))) return previous;
    countLeaves(checkpoint.doc);
    return { ...previous, baseline: checkpoint.doc, edits: previous.edits.slice(count) };
  }
  if (!tr.docChanged) return previous;
  if (previous.invalid) {
    // Only real history restoring the exact last proven document can recover
    // provenance. Keep its pending edits and any acknowledged save prefix.
    if (!isHistoryTransaction(tr) || !previous.invalidBeforeDoc?.eq(newState.doc)) return previous;
    const { invalidBeforeDoc, ...restored } = previous;
    return { ...restored, invalid: false };
  }
  try {
    const edits = [];
    for (let index = 0; index < tr.steps.length; index++) {
      const step = tr.steps[index], kind = step.toJSON().stepType;
      if (['addMark', 'removeMark', 'attr', 'docAttr'].includes(kind)) continue;
      if (kind !== 'replace') throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
      const before = tr.docs[index], after = tr.docs[index + 1] || tr.doc;
      const atFrom = before.resolve(step.from), atTo = before.resolve(step.to);
      let from, to, removedParagraphs, insertedParagraphs;
      if (!step.slice.openStart && !step.slice.openEnd && atFrom.sameParent(atTo)
        && paragraphTypes.has(atFrom.parent.type.name)
        && [...Array(step.slice.content.childCount).keys()].every(i => {
          const child = step.slice.content.child(i); return child.isText || child.type.name === 'hardBreak';
        })) {
        from = paragraphAt(before, step.from); to = paragraphAt(before, step.to);
        removedParagraphs = [inlineText(from.node).slice(from.offset, to.offset)];
        insertedParagraphs = [inlineText(step.slice.content)];
      } else {
        const ranges = [];
        step.getMap().forEach((oldFrom, oldTo, newFrom, newTo) => ranges.push({oldFrom,oldTo,newFrom,newTo}));
        if (ranges.length !== 1 || ranges[0].oldFrom !== step.from || ranges[0].oldTo !== step.to)
          throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
        const oldRange = rootParagraphRange(before, step.from, step.to);
        const newRange = rootParagraphRange(after, ranges[0].newFrom, ranges[0].newTo);
        from = oldRange.from; to = oldRange.to;
        removedParagraphs = oldRange.parts; insertedParagraphs = newRange.parts;
      }
      if (JSON.stringify(removedParagraphs) === JSON.stringify(insertedParagraphs)) continue;
      edits.push({ fromParagraphIndex: from.paragraphIndex, fromUtf16: from.offset,
        toParagraphIndex: to.paragraphIndex, toUtf16: to.offset, removedParagraphs, insertedParagraphs });
    }
    if (!edits.length) return previous;
    const before = historyState(oldState), after = historyState(newState);
    if (!before || !after) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
    const groups = new Map(previous.groups);
    let nextGroup = previous.nextGroup, direction = 'forward', historyId;
    if (isHistoryTransaction(tr)) {
      const redo = after.done.eventCount > before.done.eventCount;
      direction = redo ? 'redo' : 'undo';
      historyId = groups.get(eventBookmark(redo ? before.undone : before.done));
      if (!historyId) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
      const destination = eventBookmark(redo ? after.done : after.undone);
      if (destination) groups.set(destination, historyId);
    } else {
      if (tr.getMeta('addToHistory') === false) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
      const bookmark = eventBookmark(after.done);
      if (!bookmark) throw new Error('COMMENT_EDIT_HISTORY_UNAVAILABLE');
      historyId = groups.get(bookmark);
      if (!historyId) { historyId = `${previous.incarnation}-h${nextGroup++}`; groups.set(bookmark, historyId); }
    }
    if (groups.size > 256) {
      const retained = new Set();
      for (const branch of [after.done, after.undone]) {
        if (branch.items.length > 8192) throw new Error('COMMENT_EDIT_HISTORY_BUDGET');
        branch.items.forEach(item => { if (item.selection) retained.add(item.selection); });
      }
      for (const bookmark of groups.keys()) if (!retained.has(bookmark)) groups.delete(bookmark);
      if (groups.size > 512) throw new Error('COMMENT_EDIT_HISTORY_BUDGET');
    }
    let nextEdit = previous.nextEdit;
    const combined = [...previous.edits, ...edits.map(edit => ({ id: `${previous.incarnation}-e${nextEdit++}`, historyId, direction, ...edit }))];
    if (combined.length > 256 || new TextEncoder().encode(JSON.stringify(combined)).length > 64000)
      throw new Error('COMMENT_EDIT_BUDGET');
    return { ...previous, edits: combined, groups, nextGroup, nextEdit };
  } catch { return { ...previous, invalid: true, invalidBeforeDoc: oldState.doc }; }
}

// Only actual transactions create edit intent. Core owns validation and anchors.
// Run after the installed history plugin so its real grouping is observable.
export const DocumentCommentEditIntents = Extension.create({
  name: 'documentCommentEditIntents', priority: 50,
  addProseMirrorPlugins() { return [new Plugin({
    key: ledgerKey,
    state: { init: (_config, state) => initial(state.doc), apply: capture },
  })]; },
});
export function getCommentEditIntentsJson(editor) {
  if (!editor || editor.isDestroyed) return null;
  const ledger = ledgerKey.getState(editor.state);
  if (!ledger || ledger.invalid) return null;
  try {
    const wire = JSON.stringify({ schemaVersion: 2,
      baselineTextSha256: sha256Hex(JSON.stringify(paragraphs(ledger.baseline))), edits: ledger.edits });
    if (new TextEncoder().encode(wire).length > 65536) return null;
    let snapshots = capturedSnapshots.get(editor);
    if (!snapshots || snapshots.incarnation !== ledger.incarnation) {
      snapshots = { incarnation: ledger.incarnation, receipts: new Map() }; capturedSnapshots.set(editor, snapshots);
    }
    snapshots.receipts.set(sha256Hex(wire), { incarnation: ledger.incarnation, doc: editor.state.doc,
      edits: ledger.edits, nextEdit: ledger.nextEdit });
    if (snapshots.receipts.size > 8) snapshots.receipts.delete(snapshots.receipts.keys().next().value);
    return wire;
  } catch { return null; }
}
export function checkpointCommentEditIntents(editor, wireSha256) {
  if (!editor || editor.isDestroyed || typeof wireSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(wireSha256)) return false;
  const captured = capturedSnapshots.get(editor)?.receipts.get(wireSha256);
  const current = ledgerKey.getState(editor.state);
  if (!captured || !current || current.incarnation !== captured.incarnation) return false;
  editor.view.dispatch(editor.state.tr.setMeta(checkpointKey, captured).setMeta('addToHistory', false));
  return ledgerKey.getState(editor.state) !== current;
}
export function commentSelectionIntent(editor) {
  if (!editor || editor.isDestroyed) throw new Error('COMMENT_EDIT_EDITOR_UNAVAILABLE');
  const selection = editor.state.selection, doc = editor.state.doc;
  let { from, to } = selection;
  if (selection instanceof AllSelection) {
    const leaves = [];
    doc.descendants((node, position) => {
      if (paragraphTypes.has(node.type.name)) { leaves.push({ node, position }); return false; }
      if (!['bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableCell', 'tableHeader'].includes(node.type.name))
        throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
      return true;
    });
    if (!leaves.length) throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
    from = leaves[0].position + 1;
    to = leaves.at(-1).position + 1 + leaves.at(-1).node.content.size;
  }
  const start = paragraphAt(doc, from), end = paragraphAt(doc, to);
  const texts = [], owners = [];
  let index = 0;
  doc.descendants((node, position) => {
    if (!paragraphTypes.has(node.type.name)) return true;
    const current = index++;
    if (current < start.paragraphIndex || current > end.paragraphIndex) return false;
    const at = doc.resolve(position + 1), cells = [];
    for (let depth = 1; depth < at.depth; depth++) {
      const kind = at.node(depth).type.name;
      if (!['bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableCell', 'tableHeader'].includes(kind))
        throw new Error('COMMENT_EDIT_TOPOLOGY_UNSUPPORTED');
      if (['tableCell', 'tableHeader'].includes(kind)) cells.push(at.before(depth));
    }
    texts.push(inlineText(node)); owners.push(JSON.stringify(cells)); return false;
  });
  if (owners.some(owner => owner !== owners[0])) throw new Error('COMMENT_RANGE_OWNER_MISMATCH');
  const edges = text => new Set([text.length,
    ...Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), segment => segment.index)]);
  if (!edges(texts[0]).has(start.offset) || !edges(texts.at(-1)).has(end.offset))
    throw new Error('Выделите целые символы.');
  if (start.paragraphIndex === end.paragraphIndex) return {
    paragraphIndex: start.paragraphIndex, startUtf16: start.offset, selectedText: texts[0].slice(start.offset, end.offset),
    ...(from === to ? { kind: 'point', affinity: 'right' } : {}),
  };
  return { kind: 'multi-paragraph-range', paragraphIndex: start.paragraphIndex, startUtf16: start.offset,
    endParagraphIndex: end.paragraphIndex, endUtf16: end.offset,
    selectedText: [texts[0].slice(start.offset), ...texts.slice(1, -1), texts.at(-1).slice(0, end.offset)].join('\n') };
}

// Editor coordinates only. Image atoms occupy a ProseMirror position but no
// manuscript text; hard breaks and paragraph separators each occupy one UTF16 unit.
export function textOffsetForPosition(doc, position) {
  const bounded = Math.max(0, Math.min(Number(position) || 0, doc.content.size));
  return doc.textBetween(0, bounded, '\n', node => node.type.name === 'image' ? '' : '\n').length;
}
export function positionForTextOffset(doc, offset) {
  const target = Math.max(0, Math.floor(Number(offset) || 0));
  let plain = 0, seen = false, found = false, result = 1;
  doc.descendants((block, pos) => {
    if (found) return false;
    if (!block.isTextblock) return undefined;
    if (seen) plain++;
    seen = true;
    let cursor = pos + 1;
    for (let index = 0; index < block.childCount; index++) {
      const child = block.child(index);
      if (child.type.name === 'image') { cursor += child.nodeSize; continue; }
      const length = child.isText ? child.text.length : 1;
      if (target < plain + length) {
        result = cursor + Math.max(0, target - plain); found = true; return false;
      }
      plain += length; cursor += child.nodeSize;
    }
    result = cursor;
    if (target <= plain) found = true;
    return false;
  });
  return Math.min(result, doc.content.size);
}

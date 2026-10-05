'use strict';
const { validateRichBody } = require('./word-rich-body-projection-v1.cjs');
const { normalizeFontFamily, normalizeFontSize } = require('../io/inlineTypography.cjs');
const STATE_V1 = 'yalken.rtk.word.non-text-return-state.v1';
const STATE_V2 = 'yalken.rtk.word.non-text-return-state.v2';
const STATE_V3 = 'yalken.rtk.word.non-text-return-state.v3';
const STATE_V5 = 'yalken.rtk.word.non-text-return-state.v5';
const STATE_V4 = 'yalken.rtk.word.non-text-return-state.v4';
const SCHEMA = 'yalken.word.comment-body.v1';
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const bytes = v => new TextEncoder().encode(v).length;
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : plain(v)
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
// Inspect own data descriptors before interpreting an external object. JSON
// serialization must never invoke accessors or toJSON supplied by the caller.
function ownData(value) {
  let nodes = 0, characters = 0;
  const seen = new Set();
  const visit = (v, depth = 0) => {
    if (++nodes > 8192 || depth > 16) fail('COMMENT_RICH_BODY_BUDGET');
    if (typeof v === 'string') { characters += v.length; if (characters > 65536) fail('COMMENT_RICH_BODY_BUDGET'); return v; }
    if (v === null || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v !== 'object' || seen.has(v)) fail('COMMENT_RICH_BODY_DATA');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail('COMMENT_RICH_BODY_DATA');
    seen.add(v);
    const descriptors = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(descriptors);
    if (keys.some(k => typeof k !== 'string')) fail('COMMENT_RICH_BODY_DATA');
    const result = array ? [] : {};
    if (array && (v.length > 8192 || keys.length !== v.length + 1)) fail('COMMENT_RICH_BODY_BUDGET');
    for (const key of keys) {
      if (array && key === 'length') continue;
      const d = descriptors[key];
      if (!Object.hasOwn(d, 'value') || !d.enumerable || key === '__proto__' || key === 'toJSON'
        || array && !/^(0|[1-9][0-9]*)$/u.test(key)) fail('COMMENT_RICH_BODY_DATA');
      characters += key.length;
      if (characters > 65536) fail('COMMENT_RICH_BODY_BUDGET');
      result[key] = visit(d.value, depth + 1);
    }
    seen.delete(v);
    return result;
  };
  return visit(value);
}
function literal(body) {
  if (typeof body !== 'string' || !body.isWellFormed() || !body.trim() || bytes(body) > 16384
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\r]/u.test(body)) fail('COMMENT_BODY_INVALID');
  return body;
}
function canonical(node) {
  const result = { ...node };
  if (node.attrs) {
    result.attrs = Object.fromEntries(Object.entries(node.attrs).filter(([,v]) => v != null));
    if (node.type === 'link') {
      delete result.attrs.target; delete result.attrs.rel;
    }
    if (result.attrs.fontFamily) result.attrs.fontFamily = normalizeFontFamily(result.attrs.fontFamily);
    if (result.attrs.fontSize) result.attrs.fontSize = normalizeFontSize(result.attrs.fontSize);
    if (typeof result.attrs.color === 'string') result.attrs.color = result.attrs.color.toUpperCase();
    if (!Object.keys(result.attrs).length) delete result.attrs;
  }
  if (node.marks) {
    result.marks = node.marks.map(canonical).filter(m => m.type !== 'textStyle' || m.attrs)
      .sort((a,b) => a.type < b.type ? -1 : a.type > b.type ? 1 : 0);
    if (!result.marks.length) delete result.marks;
  }
  if (node.content) {
    result.content = [];
    for (const child of node.content.flatMap(child => child.type === 'text' && child.text.includes('\n')
      ? child.text.split('\n').flatMap((text,i) => [...(i ? [{type:'hardBreak', ...(child.marks ? {marks:child.marks} : {})}] : []), ...(text ? [{...child,text}] : [])]) : [child]).map(canonical)) {
      const prior = result.content.at(-1);
      if (child.type === 'text' && prior?.type === 'text' && stable(child.marks) === stable(prior.marks)) prior.text += child.text;
      else result.content.push(child);
    }
  }
  if (node.type === 'paragraph' && !result.content?.length) delete result.content;
  return result;
}
function validateCommentRichBody(value) {
  value = ownData(value);
  if (!plain(value) || Object.keys(value).some(k => !['schemaVersion','document'].includes(k))
    || value.schemaVersion !== SCHEMA || !plain(value.document) || !Array.isArray(value.document.content)
    || value.document.content.some(p => p?.type !== 'paragraph' || (p.content !== undefined && (!Array.isArray(p.content)
      || p.content.some(n => !['text','hardBreak'].includes(n?.type)))))) fail('COMMENT_RICH_BODY_PROFILE');
  // Bound external data before the shared validator recursively inspects it.
  if (bytes(JSON.stringify(value)) > 65536) fail('COMMENT_RICH_BODY_BUDGET');
  // Comments can format a line break, as the actual ProseMirror selection
  // transform does. Validate its marks through the existing text-run grammar,
  // then restore the structural break without discarding those marks.
  const document = {...value.document, content:value.document.content.map(p => ({...p,
    ...(p.content ? {content:p.content.map(node => {
      if (node.type !== 'hardBreak' || node.marks === undefined) return node;
      if (Object.keys(node).some(key => !['type','marks'].includes(key))) fail('COMMENT_RICH_BODY_PROFILE');
      return {type:'text',text:'\n',marks:node.marks};
    })} : {})}))};
  const checked = validateRichBody(document);
  const body = literal(checked.text);
  return { richBody: { schemaVersion: SCHEMA, document: canonical(checked.body) }, body };
}
function validateCommentMessageContent(message, { deriveBody = false } = {}) {
  if (!plain(message)) fail('COMMENT_BODY_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(message);
  for (const key of ['body', 'richBody']) if (descriptors[key] && !Object.hasOwn(descriptors[key], 'value')) fail('COMMENT_RICH_BODY_DATA');
  message = { body: descriptors.body?.value, richBody: descriptors.richBody?.value };
  if (message.richBody === undefined) return { body: literal(message.body) };
  if (!deriveBody || message.body !== undefined) literal(message.body);
  const checked = validateCommentRichBody(message.richBody);
  if ((!deriveBody || message.body !== undefined) && message.body !== checked.body) fail('COMMENT_BODY_PROJECTION_MISMATCH');
  return checked;
}
function commentBodyDocument(message) {
  const checked = validateCommentMessageContent(message);
  return checked.richBody?.document || canonical({ type:'doc', content:[{type:'paragraph',content:[{type:'text',text:checked.body}]}] });
}
// A derived transport view. Callers supply defaults authenticated by the
// actual export profile; this function never changes a canonical message.
function commentBodyWithTypography(message, typography) {
  if (!plain(typography) || Object.keys(typography).sort().join(',') !== 'fontSize,schemaVersion'
    || typography.schemaVersion !== 'yalken.review-docx.typography-defaults.v1'
    || normalizeFontSize(typography.fontSize) !== typography.fontSize) fail('COMMENT_EXPORT_TYPOGRAPHY_INVALID');
  const document = commentBodyDocument(message);
  for (const paragraph of document.content) for (const node of paragraph.content || []) {
    if (!['text','hardBreak'].includes(node.type)) continue;
    node.marks ||= [];
    let style = node.marks.find(mark => mark.type === 'textStyle');
    if (!style) { style = {type:'textStyle',attrs:{}}; node.marks.push(style); }
    style.attrs ||= {};
    if (style.attrs.fontSize == null) style.attrs.fontSize = typography.fontSize;
  }
  return validateCommentRichBody({schemaVersion:SCHEMA,document}).richBody;
}
function commentBodyEqual(left, right) {
  return stable(canonical(commentBodyDocument(left))) === stable(canonical(commentBodyDocument(right)));
}
// Serialize already validated canonical state without spending its byte budget
// on indentation. The graph and all history entries remain unchanged.
function serializeCommentState(state, budgetCode = 'COMMENT_STATE_BUDGET') {
  let text = JSON.stringify(state, null, 2) + '\n';
  if (bytes(text) > 65536) text = JSON.stringify(state) + '\n';
  if (bytes(text) > 65536) fail(budgetCode);
  return text;
}
function upgradeCommentState(state) {
  if (![STATE_V1, STATE_V2, STATE_V3, STATE_V4, STATE_V5].includes(state.schemaVersion)) fail('COMMENT_STATE_INVALID');
  if (state.schemaVersion === STATE_V5 || state.threads.some(t=>t.anchorEditHistory?.some(h=>h.schemaVersion===2))) state.schemaVersion=STATE_V5;
  else if (state.schemaVersion === STATE_V4 || state.threads.some(t => t.anchor?.kind === 'multi-paragraph-range')) state.schemaVersion = STATE_V4;
  else if (state.schemaVersion === STATE_V3 || state.threads.some(t => t.anchor?.kind === 'point' || t.anchorEditHistory !== undefined)) state.schemaVersion = STATE_V3;
  else if (state.threads.some(t => [...t.messages, ...(t.deletedMessages || [])].some(m => m.richBody !== undefined))) state.schemaVersion = STATE_V2;
  return state;
}
module.exports = { serializeCommentState, STATE_V1, STATE_V2, STATE_V3, STATE_V4, STATE_V5, upgradeCommentState, SCHEMA, validateCommentRichBody, validateCommentMessageContent, commentBodyDocument, commentBodyWithTypography, commentBodyEqual };

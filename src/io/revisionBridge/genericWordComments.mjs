import pendingTextRevisions from '../../core/word-pending-text-revisions-v1.cjs';
import commentRanges from '../../core/word-comment-ranges-v1.cjs';
import commentAuthoring from '../../core/word-comment-authoring-v1.cjs';
import commentBodyModel from '../../core/word-comment-body-v1.cjs';
import documentTables from '../documentTables.js';
import { sha256Hex } from '../../core/browser-safe-hash.mjs';

// Ordinary import has no return authority. Native IDs are retained only as
// provenance; every canonical identity is scoped to the new import operation.
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytes = value => new TextEncoder().encode(value).length;
const demand = (condition, suffix) => {
  if (!condition) throw new Error(`DOCX_GENERIC_COMMENT_${suffix}`);
};
const clone = value => JSON.parse(JSON.stringify(value));
const edges = text => new Set([text.length, ...Array.from(new Intl.Segmenter('und',
  { granularity: 'grapheme' }).segment(text), segment => segment.index)]);
function literal(value, limit, required = false) {
  demand(typeof value === 'string' && bytes(value) <= limit
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    && value.isWellFormed() && !value.includes('\r') && (!required || value.trim()), 'LITERAL');
  return value;
}
function message(source, reply = false) {
  demand(plain(source) && (reply || plain(source.authorPersonIdentity)), 'MESSAGE');
  const identity = reply ? source : source.authorPersonIdentity;
  const provenance = {};
  for (const [key, value, limit] of [
    ['author', identity.author ?? '', 1024],
    ['initials', identity.initials ?? '', 128],
    ['date', source.date ?? '', 128], ['dateUtc', source.dateUtc ?? '', 128],
  ]) {
    literal(value, limit);
    if (value) provenance[key] = value;
  }
  return { sourceCommentId: literal(reply ? source.rawId : source.commentId, 128, true),
    ...commentBodyModel.validateCommentMessageContent(source), provenance };
}

export function genericCommentCandidates(analysis, paragraphs, { metadataValidated = false, pendingDocument } = {}) {
  demand(analysis?.ok === true && (analysis.reviewIr?.sourceMode === 'CLEAN' || pendingDocument), 'ANALYSIS');
  const ir = analysis.reviewIr;
  demand(Array.isArray(ir.commentThreads) && ir.commentThreads.length <= 128
    && Array.isArray(paragraphs), 'BUDGET');
  const pendingLedger = pendingDocument ? pendingTextRevisions.readLedger(pendingDocument) : null;
  demand(!(ir.moveRevisions?.length || ir.propertyRevisions?.length)
    && (!ir.textRevisions?.length || pendingLedger), 'TRACKED_UNSUPPORTED');
  if(pendingLedger) {
    demand(pendingLedger.revisions.every(r=>['insert','delete'].includes(r.operation)&&!pendingTextRevisions.isStructural(r)&&!r.moveName),'TRACKED_UNSUPPORTED');
    const current=pendingTextRevisions.paragraphs(pendingTextRevisions.materialize(pendingLedger));
    demand(current.length===paragraphs.length && current.every((p,i)=>(p.content||[]).map(n=>n.type==='hardBreak'?'\n':n.text).join('')===paragraphs[i].text),'PENDING_CURRENT');
  }
  // Missing/orphan/truncated comments may not disappear behind an empty lane.
  const reasons = analysis.reasons || [];
  demand(!reasons.some(item => {
    if (/BUDGET|HOSTILE|MALFORMED/u.test(item.code || '')) return true;
    if (!/COMMENT/u.test(item.code || '')) return false;
    if (['RTK_COMMENT_ANCHORED', 'RTK_COMMENT_RESOLVED'].includes(item.code)) return false;
    if (item.typedDiagnostic === 'RTK_MODERN_COMMENT_EXTENSIBLE_NOT_CERTIFIED') return !metadataValidated;
    // The return parser labels unrelated advisory parts with COMMENT_UNSUPPORTED.
    // Ordinary import retains their existing typed losses; they confer no IDs.
    return !item.field?.startsWith('opaque.') || /^opaque\.word\/(comments|people)/u.test(item.field);
  }), 'INCOMPLETE');
  // The canonical import writer uses this same validated recursive leaf order.
  // Malformed ownership may not be rescued by a matching comment quote.
  try { documentTables.groupTableParagraphs(paragraphs); } catch { demand(false, 'TOPOLOGY'); }
  const unionRows=pendingLedger?pendingTextRevisions.paragraphs(pendingLedger.source).map((p,i)=>({...paragraphs[i],text:(p.content||[]).map(n=>n.type==='hardBreak'?'\n':n.text).join('')})):null;
  const currentPoint=(paragraphIndex,offset)=>{
    let result=offset;
    for(const revision of pendingLedger.revisions){
      if(revision.paragraphIndex!==paragraphIndex||revision.operation!=='delete')continue;
      demand(!(revision.from<offset&&offset<revision.to),'PENDING_DELETED_ENDPOINT');
      if(revision.to<=offset)result-=revision.to-revision.from;
    }
    return result;
  };
  const pendingProjection=pendingLedger?pendingTextRevisions.buildCommentExportBinding({document:pendingDocument}).projection:null;
  const nativeIds = new Set();
  const candidates = ir.commentThreads.map(thread => {
    demand(['ANCHORED', 'RESOLVED'].includes(thread.status)
      && ['active', 'resolved', 'reopened'].includes(thread.doneResolvedReopenedState)
      && !thread.parentThreadId && thread.placement?.anchored === true, 'PLACEMENT');
    const range = thread.finalTextAnchorRange || thread.anchorRange;
    if(pendingLedger) {
      const union=thread.anchorRange, start=thread.paragraphIndex, last=union?.endParagraphIndex??start;
      demand(plain(union)&&unionRows[start]&&unionRows[last],'PENDING_UNION');
      const quote=start===last?unionRows[start].text.slice(union.startUtf16,union.endUtf16):[unionRows[start].text.slice(union.startUtf16),...unionRows.slice(start+1,last).map(p=>p.text),unionRows[last].text.slice(0,union.endUtf16)].join('\n');
      demand(quote===thread.quotedAnchorText && quote===union.selectedText && union.blockTextSha256===sha256Hex(unionRows[start].text),'PENDING_UNION');
      demand(!(union.selectedText && range?.selectedText===''),'PENDING_DELETED_ANCHOR');
      demand(range.startUtf16===currentPoint(start,union.startUtf16) && range.endUtf16===currentPoint(last,union.endUtf16)
        && (range.endParagraphIndex??start)===last,'PENDING_ENDPOINT_BINDING');
    }
    const index = thread.paragraphIndex, paragraph = paragraphs[index];
    demand(Number.isSafeInteger(index) && index >= 0 && plain(range)
      && plain(paragraph) && typeof paragraph.text === 'string', 'ANCHOR');
    const multi = range.kind === 'multi-paragraph-range';
    const end = multi ? range.endParagraphIndex : index;
    demand(Number.isSafeInteger(end) && end >= index && end < paragraphs.length
      && paragraphs.slice(index, end + 1).every(p => !p.media?.length), 'TOPOLOGY');
    let derived;
    try { derived = commentRanges.deriveCommentAnchor({ sceneId: 'generic-preview', paragraphs,
      input: { paragraphIndex: index, startUtf16: range.startUtf16, selectedText: range.selectedText,
        ...(multi ? { kind: range.kind, endParagraphIndex: end, endUtf16: range.endUtf16 }
          : range.startUtf16 === range.endUtf16 ? {kind: 'point', affinity: 'right'} : {}) } }); }
    catch { demand(false, 'ANCHOR'); }
    demand((multi || range.endUtf16 === range.startUtf16 + range.selectedText.length)
      && derived.blockTextSha256 === range.blockTextSha256 && (pendingLedger || range.selectedText === thread.quotedAnchorText)
      && (!multi || derived.endBlockTextSha256 === range.endBlockTextSha256
        && derived.coveredParagraphsSha256 === range.coveredParagraphsSha256), 'ANCHOR');
    demand(Array.isArray(thread.replies) && thread.replies.length <= 128, 'REPLIES');
    demand(thread.replies.every(reply => reply.parentRawId === thread.commentId), 'NESTED_REPLY_UNSUPPORTED');
    const messages = [message(thread), ...thread.replies.map(reply => message(reply, true))];
    for (const item of messages) {
      demand(!nativeIds.has(item.sourceCommentId), 'DUPLICATE');
      nativeIds.add(item.sourceCommentId);
    }
    return { paragraphIndex: index, startUtf16: range.startUtf16,
      ...(multi ? {kind: range.kind, endParagraphIndex: range.endParagraphIndex, endUtf16: range.endUtf16,
        endBlockTextSha256: range.endBlockTextSha256, coveredParagraphsSha256: range.coveredParagraphsSha256}
        : range.startUtf16 === range.endUtf16 ? {kind: 'point', affinity: 'right'} : {}),
      ...(pendingLedger?(()=>{
        const u=thread.anchorRange,locator=pendingTextRevisions.createCommentUnionLocator({projection:pendingProjection,anchor:derived,
          unionStart:{paragraphIndex:index,offsetUtf16:u.startUtf16},unionEnd:{paragraphIndex:u.endParagraphIndex??index,offsetUtf16:u.endUtf16}});
        return locator?{pendingUnionLocator:locator}:{};
      })():{}),
      selectedText: range.selectedText, blockTextSha256: range.blockTextSha256,
      status: thread.status === 'RESOLVED' ? 'resolved' : 'open', messages };
  });
  demand(bytes(JSON.stringify(candidates)) <= 65536, 'BUDGET');
  return candidates;
}

export function materializeGenericComments({ candidates, paragraphs, pendingDocument, projectId, sceneId, importOperationId, beforeText }) {
  demand(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 128, 'BUDGET');
  for (const value of [projectId, sceneId, importOperationId]) literal(value, 1024, true);
  demand(beforeText === null || (typeof beforeText === 'string' && bytes(beforeText) <= 65536), 'STATE_BUDGET');
  const before = commentAuthoring.readState(beforeText, projectId);
  demand(plain(before) && [commentBodyModel.STATE_V1,commentBodyModel.STATE_V2,commentBodyModel.STATE_V3,commentBodyModel.STATE_V4, commentBodyModel.STATE_V5].includes(before.schemaVersion) && before.projectId === projectId
    && Number.isSafeInteger(before.revision) && before.revision >= 0 && before.revision < Number.MAX_SAFE_INTEGER
    && Array.isArray(before.threads) && Array.isArray(before.events), 'STATE');
  const existing = new Set();
  for (const thread of before.threads) {
    demand(plain(thread) && typeof thread.threadId === 'string' && Array.isArray(thread.messages), 'STATE');
    for (const id of [thread.threadId, ...thread.messages.map(item => item.commentId)]) {
      demand(typeof id === 'string' && !existing.has(id), 'STATE'); existing.add(id);
    }
  }
  const operation = sha256Hex(`${projectId}\n${sceneId}\n${importOperationId}`);
  const reserve = id => { demand(!existing.has(id), 'IDENTITY_CONFLICT'); existing.add(id); return id; };
  const locatorProjection=candidates.some(c=>c.pendingUnionLocator!==undefined)&&pendingDocument?pendingTextRevisions.buildCommentExportBinding({document:pendingDocument}).projection:null;
  const threads = candidates.map((candidate, ordinal) => {
    demand(plain(candidate) && Object.keys(candidate).every(key => ['paragraphIndex', 'startUtf16', 'selectedText', 'blockTextSha256', 'status', 'messages', 'kind', 'affinity', 'endParagraphIndex', 'endUtf16', 'endBlockTextSha256', 'coveredParagraphsSha256', 'pendingUnionLocator'].includes(key))
      && Number.isSafeInteger(candidate.paragraphIndex) && candidate.paragraphIndex >= 0
      && ['open', 'resolved'].includes(candidate.status)
      && Array.isArray(candidate.messages) && candidate.messages.length > 0 && candidate.messages.length <= 129, 'CANDIDATE');
    let anchor;
    try { anchor = commentRanges.deriveCommentAnchor({ sceneId, paragraphs, input: {
      paragraphIndex: candidate.paragraphIndex, startUtf16: candidate.startUtf16, selectedText: candidate.selectedText,
      ...(candidate.kind === 'multi-paragraph-range' ? { kind: candidate.kind,
        endParagraphIndex: candidate.endParagraphIndex, endUtf16: candidate.endUtf16 }
        : candidate.kind === 'point' ? {kind: 'point', affinity: candidate.affinity} : {}) } }); }
    catch { demand(false, 'ANCHOR'); }
    demand((candidate.kind === 'point' ? candidate.affinity === 'right' : candidate.affinity === undefined)
      && candidate.kind === anchor.kind && candidate.blockTextSha256 === anchor.blockTextSha256
      && (candidate.kind === 'multi-paragraph-range' ? candidate.endBlockTextSha256 === anchor.endBlockTextSha256
        && candidate.coveredParagraphsSha256 === anchor.coveredParagraphsSha256
        : candidate.endParagraphIndex === undefined && candidate.endUtf16 === undefined
          && candidate.endBlockTextSha256 === undefined && candidate.coveredParagraphsSha256 === undefined), 'ANCHOR');
    if(candidate.pendingUnionLocator!==undefined) {
      demand(pendingDocument,'PENDING_DOCUMENT_REQUIRED');
      pendingTextRevisions.validateCommentUnionLocator({projection:locatorProjection,anchor,locator:candidate.pendingUnionLocator});
      anchor.pendingUnionLocator=clone(candidate.pendingUnionLocator);
    }
    const threadId = reserve(`generic-comment-${operation}-${ordinal}`);
    const messages = candidate.messages.map((item, index) => {
      demand(plain(item) && Object.keys(item).every(key => ['sourceCommentId', 'body', 'richBody', 'provenance'].includes(key))
        && plain(item.provenance), 'MESSAGE');
      const content = commentBodyModel.validateCommentMessageContent(item);
      literal(content.body, 16384, true);
      for (const [key, value] of Object.entries(item.provenance)) {
        demand(['author', 'initials', 'date', 'dateUtc'].includes(key), 'PROVENANCE');
        literal(value, key === 'author' ? 1024 : 128);
      }
      literal(item.sourceCommentId, 128, true);
      return { commentId: reserve(`${threadId}:message-${index}`), kind: index === 0 ? 'root' : 'reply',
        ...content, provenance: clone(item.provenance) };
    });
    return { threadId, sceneId, rootCommentId: messages[0].commentId, status: candidate.status,
      anchor: { ...anchor, authoritySource: 'GENERIC_IMPORT_LOCAL_IDENTITY', sourceChangeId: importOperationId }, messages };
  });
  const after = { ...clone(before), revision: before.revision + 1, threads: [...clone(before.threads), ...threads] };
  demand(after.threads.length <= 128, 'STATE');
  commentBodyModel.upgradeCommentState(after);
  const afterText = commentBodyModel.serializeCommentState(after, 'DOCX_GENERIC_COMMENT_STATE_BUDGET');
  demand(bytes(afterText) <= 65536, 'STATE_BUDGET');
  return { beforeText, afterText, threadIds: threads.map(thread => thread.threadId) };
}

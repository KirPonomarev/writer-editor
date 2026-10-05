'use strict';
const review=require('./word-pending-text-revisions-v1.cjs');
const envelope=require('./document-content-envelope-v1.cjs');
const {readState}=require('./word-comment-authoring-v1.cjs');
const {RETURN_MODE}=require('./word-comment-anchor-save-v1.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const equal=(a,b)=>stable(a)===stable(b);
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const text=n=>n.type==='hardBreak'?'\n':n.text;
const provenance=r=>r?stable([r.operation,r.author,r.date,r.dateUtc]):null;
function tokens(segments,comparison) {
  const compare=[];
  for(const node of comparison.content||[]) for(const c of text(node))compare.push({...clone(node),...(node.type==='text'?{text:c}:{})});
  const out=[];let index=0,offset=0;
  for(const s of segments)for(const c of text(s.node)) {
    out.push({node:{...clone(s.node),...(s.node.type==='text'?{text:c}:{})},key:stable(compare[index++]),revision:s.revision,offset});offset+=c.length;
  }
  need(index===compare.length,'MIXED_RETURN_TOKEN_BINDING');return out;
}
function partitionMeaning(segments) {
  const result=[];let offset=0;
  for(const s of segments) {
    const size=text(s.node).length,meaning=provenance(s.revision),last=result.at(-1);
    if(last&&last.meaning===meaning)last.to+=size;
    else result.push({from:offset,to:offset+size,meaning});
    offset+=size;
  }
  return result;
}
// Only returned insertions may be unmatched. Returned deletions must consume
// exact prior clean atoms; old pending atoms keep operation and provenance.
// Count paths up to two, so repeated insertion text cannot select an occurrence.
function align(before,after) {
  let states=new Map([[0,{count:1,path:null}]]),work=0;
  for(let j=0;j<after.length;j++) {
    const next=new Map(),b=after[j];
    const add=(i,state,match)=>{
      if(++work>2000000)fail('MIXED_RETURN_MAPPING_BUDGET');
      const prior=next.get(i);
      if(prior)prior.count=Math.min(2,prior.count+state.count);
      else next.set(i,{count:state.count,path:{previous:state.path,match,j}});
    };
    for(const [i,state] of states) {
      const a=before[i];
      if(b.revision?.operation==='insert')add(i,state,null);
      if(a&&a.key===b.key&&(a.revision?provenance(a.revision)===provenance(b.revision):b.revision?.operation!=='insert'))add(i+1,state,i);
    }
    need(next.size,'MIXED_RETURN_SOURCE_CHANGED');states=next;
  }
  const result=states.get(before.length);need(result,'MIXED_RETURN_SOURCE_CHANGED');need(result.count===1,'MIXED_RETURN_MAPPING_AMBIGUOUS');
  const map=[];for(let p=result.path;p;p=p.previous)map[p.j]=p.match;return map;
}
function canonicalPendingBasis(document) {
  if(review.readLedger(document))return document;
  return review.bindLedger({schemaVersion:2,source:review.normalizeNode(document),revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
}
function deriveMixedPendingDocument({document,returnedDocument,binding,anchors,exportTypography,exportParagraphs}) {
  const existing=review.readLedger(document);
  need(!existing||binding,'MIXED_RETURN_SIGNED_BINDING_REQUIRED');
  document=canonicalPendingBasis(document);
  if(!binding)binding=review.buildCommentExportBinding({document,anchors,exportTypography,exportParagraphs,schemaVersion:2}).binding;
  const oldLedger=review.readLedger(document),incoming=review.readLedger(returnedDocument);
  need(oldLedger&&incoming&&oldLedger.revisions.every(r=>r.state==='pending')&&incoming.revisions.every(r=>r.state==='pending'),'MIXED_RETURN_PENDING_STATE_REQUIRED');
  const basis=review.mixedCommentBases({document,returnedDocument,binding,anchors,exportTypography,exportParagraphs});
  const oldComparison=review.paragraphs(basis.oldComparison),newComparison=review.paragraphs(basis.newComparison);
  const canonical=review.exportSegments(oldLedger),canonicalParagraphs=review.paragraphs(oldLedger.source);
  const source=clone(oldLedger.source),sourceParagraphs=review.paragraphs(source),revisions=[];let nextId=Math.max(0,...oldLedger.revisions.map(r=>Number(r.id.slice(9))))+1;
  let changes=0;
  basis.returned.segments.forEach((segments,p)=>{
    if(equal(oldComparison[p],newComparison[p])&&equal(partitionMeaning(basis.before.segments[p]),partitionMeaning(segments))) {
      revisions.push(...oldLedger.revisions.filter(r=>r.paragraphIndex===p).map(clone));return;
    }
    // Bound allocation before creating atoms/backpointers. Whole-book size is
    // independent: unchanged paragraphs never enter this matching algorithm.
    need(basis.before.segments[p].reduce((n,s)=>n+text(s.node).length,0)+segments.reduce((n,s)=>n+text(s.node).length,0)<=20000,
      'MIXED_RETURN_CHANGED_PARAGRAPH_BUDGET');
    const before=tokens(basis.before.segments[p],oldComparison[p]),row=tokens(segments,newComparison[p]),canonicalRow=tokens(canonical[p],canonicalParagraphs[p]);
    const mapping=align(before,row),nodes=[],groups=new Map();let offset=0;
    row.forEach((token,j)=>{
      const match=mapping[j],old=match===null?null:before[match];
      const retained=old?.revision;
      const fresh=token.revision&&!retained;
      if(fresh)changes++;
      const node=match===null?token.node:canonicalRow[match].node;
      nodes.push(clone(node));
      if(retained||fresh) {
        const key=retained?'old:'+retained.id:'new:'+token.revision.id;
        let r=groups.get(key);
        if(!r){r={...clone(retained?oldLedger.revisions.find(r=>r.id===retained.id):token.revision),paragraphIndex:p,from:offset,to:offset+text(node).length};
          if(!retained){r.id='revision-'+nextId++;r.groupId=null;}
          groups.set(key,r);revisions.push(r);
        }else {need(r.to===offset,'MIXED_RETURN_PARTITION_SPLIT');r.to=offset+text(node).length;}
      }
      offset+=text(node).length;
    });
    sourceParagraphs[p].content=nodes;
  });
  // Existing order/group identity remains owned by the canonical ledger.
  const ordered=[...oldLedger.revisions.map(old=>{const r=revisions.find(r=>r.id===old.id);need(r,'MIXED_RETURN_OLD_REVISION_LOST');return r;}),...revisions.filter(r=>!oldLedger.revisions.some(old=>old.id===r.id))];
  const doc=review.bindLedger({schemaVersion:1,source:review.normalizeNode(source),revisions:ordered,undo:[],redo:[]});
  return {document:doc,projection:basis.returned,changed:changes>0};
}
function planMixedPendingReturn({beforeText,projectId,sceneId,beforeContent,afterContent,returnProofJson}) {
  need(typeof returnProofJson==='string'&&Buffer.byteLength(returnProofJson)<=8*1024*1024,'MIXED_RETURN_PROOF_BUDGET');
  let proof;try{proof=JSON.parse(returnProofJson);}catch{fail('MIXED_RETURN_PROOF_INVALID');}
  need(proof&&Object.keys(proof).sort().join(',')==='artifactSha256,baseline,commentReturnInventory,exportMap,projectId,returnedDocument,returnedParagraphs,returnedThreads,roundId,schemaVersion'
    &&proof.schemaVersion===1&&proof.projectId===projectId,'MIXED_RETURN_PROOF_INVALID');
  const scene=proof.exportMap?.scenes?.[0];need(proof.exportMap?.scenes?.length===1&&scene.sceneId===sceneId,'MIXED_RETURN_SCENE_REQUIRED');
  const parsed=envelope.parseObservablePayload(beforeContent);need(!parsed.issue&&parsed.doc,'MIXED_RETURN_DOCUMENT_REQUIRED');
  const sha=require('./browser-safe-hash.cjs').sha256UpdateCompatible;
  need(scene.rawSha256==='sha256:'+sha(beforeContent),'MIXED_RETURN_BASELINE_STALE');
  const state=readState(beforeText,projectId),anchors=state.threads.filter(t=>t.sceneId===sceneId&&t.status!=='deleted').map(t=>({threadId:t.threadId,anchor:t.anchor}));
  const baselineRows=review.paragraphs(review.normalizeNode(parsed.doc));
  need(baselineRows.length===scene.blocks.length&&scene.blocks.every((b,i)=>b.formatIr?.runs?.map(r=>r.text).join('')===(baselineRows[i].content||[]).map(text).join('')),'MIXED_RETURN_EXPORT_TEXT_STALE');
  const derived=deriveMixedPendingDocument({document:parsed.doc,returnedDocument:proof.returnedDocument,binding:scene.pendingCommentBinding,anchors,
    exportTypography:proof.exportMap.exportTypography,exportParagraphs:scene.blocks.map(b=>b.formatIr?.paragraph)});
  const replacement=review.replaceFromReturn(canonicalPendingBasis(parsed.doc),derived.document,{roundId:proof.roundId,artifactSha256:proof.artifactSha256.replace(/^sha256:/u,'')});
  const content=envelope.composeObservablePayload({...parsed,doc:replacement.doc});
  if(afterContent!==undefined)need(content===afterContent,'MIXED_RETURN_TARGET_MISMATCH');
  const delta=require('./word-comment-return-delta-v1.cjs').planCommentReturnDelta({...proof,beforeText,
    mixedPendingScene:{sceneId,document:parsed.doc,returnedDocument:proof.returnedDocument}});
  need(equal(readState(delta.afterText,projectId).threads.filter(t=>t.sceneId!==sceneId),state.threads.filter(t=>t.sceneId!==sceneId)),'MIXED_RETURN_FOREIGN_SCENE');
  return {mode:RETURN_MODE,beforeText,afterText:delta.afterText,returnProofJson,content,replacement,changes:delta.changes};
}
module.exports={deriveMixedPendingDocument,planMixedPendingReturn};

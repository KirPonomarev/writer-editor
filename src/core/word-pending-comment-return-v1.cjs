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
const provenance=r=>r?stable([r.operation,r.author,r.date,r.dateUtc,
  ...(r.operation==='format'?[review.formatTransitionMeaning(r.format)]:[])]):null;
// Change only properties that differ between Word's checked previous/current
// snapshots. Emitted defaults must not rewrite unrelated canonical marks.
function applyRunFormat(node, format) {
  const result=clone(node),marks=clone(node.marks||[]);
  for(const type of new Set([...format.before,...format.after].map(mark=>mark.type))) {
    const before=format.before.find(mark=>mark.type===type),after=format.after.find(mark=>mark.type===type);
    if(equal(before,after))continue;
    const index=marks.findIndex(mark=>mark.type===type);
    if(type!=='textStyle') {
      if(index>=0)marks.splice(index,1);
      if(after)marks.push(clone(after));
      continue;
    }
    const attrs=clone(index>=0?marks[index].attrs||{}:{});
    for(const key of new Set([...Object.keys(before?.attrs||{}),...Object.keys(after?.attrs||{})])) {
      const a=before?.attrs?.[key],b=after?.attrs?.[key];
      if(equal(a,b))continue;
      if(key==='wordLanguage') {
        const language=clone(attrs[key]||{});
        for(const field of new Set([...Object.keys(a||{}),...Object.keys(b||{})])) {
          if(equal(a?.[field],b?.[field]))continue;
          if(b?.[field]===undefined)delete language[field];else language[field]=clone(b[field]);
        }
        if(Object.keys(language).length)attrs[key]=language;else delete attrs[key];
      } else if(b===undefined)delete attrs[key];else attrs[key]=clone(b);
    }
    if(index>=0)marks.splice(index,1);
    if(Object.keys(attrs).length)marks.push({type,attrs});
  }
  if(marks.length)result.marks=marks;else delete result.marks;
  return review.normalizeNode(result);
}
function importRunStyle(node, returnedMarks, expectedMarks, paragraphType, paragraphAttrs, bodyEmission) {
  const result=clone(node),marks=clone(node.marks||[]),incoming=(returnedMarks||[]).find(m=>m.type==='textStyle')?.attrs||{};
  const index=marks.findIndex(m=>m.type==='textStyle'),attrs=clone(index>=0?marks[index].attrs||{}:{});
  const expected=(expectedMarks||[]).find(m=>m.type==='textStyle')?.attrs||{};
  for(const key of ['fontFamily','fontSize','wordLanguage']){
    // The checked named code style emits Menlo 10pt. Its reader may elide
    // identical explicit run properties; retain authored canonical properties
    // when that effective style is unchanged, rather than inventing defaults.
    const codeDefault=paragraphType==='codeBlock'?(key==='fontFamily'?'Menlo':key==='fontSize'?'10pt':undefined):undefined;
    const emitted=bodyEmission&&paragraphType!=='codeBlock'&&key==='wordLanguage'
      ?{...bodyEmission.wordParagraphMarkLanguage,...paragraphAttrs?.wordParagraphMarkLanguage,...expected[key]}
      :expected[key] ?? (paragraphType==='codeBlock'?codeDefault:key==='fontFamily'?'Times New Roman':key==='fontSize'?'12pt':{val:'en-US',eastAsia:'en-US',bidi:'en-US'});
    const languageContextChanged=key==='wordLanguage' && incoming[key]!==undefined && attrs[key]===undefined
      &&!equal(incoming[key],{val:'en-US',eastAsia:'en-US',bidi:'en-US',...paragraphAttrs?.wordParagraphMarkLanguage});
    if(equal(incoming[key]??codeDefault,emitted)&&!languageContextChanged||incoming[key]===undefined&&attrs[key]===undefined)continue;
    if(incoming[key]===undefined)delete attrs[key];else attrs[key]=clone(incoming[key]);
  }
  if(index>=0)marks.splice(index,1);if(Object.keys(attrs).length)marks.push({type:'textStyle',attrs});
  if(marks.length)result.marks=marks;else delete result.marks;return review.normalizeNode(result);
}
function rebaseRetainedRunFormat(retained,incoming,node,sourceParagraph,exportTypography) {
  const typography=require('./word-review-typography-v1.cjs');
  const profile=typography.validate(exportTypography,{allowUndefined:true});
  const expected=profile?.schemaVersion===typography.V2
    ?typography.segments([{node:{type:'text',text:'x'},revision:{operation:'format',format:retained}}],
      {nodeType:sourceParagraph.type,...sourceParagraph.attrs},profile)[0].revision.format:retained;
  need(equal(review.formatTransitionMeaning(expected),review.formatTransitionMeaning(incoming)),
    'MIXED_RETURN_OLD_FORMAT_TRANSITION_CHANGED');
  const format=clone(retained),actual=(node.marks||[]).find(m=>m.type==='textStyle')?.attrs||{};
  for(const key of ['fontFamily','fontSize','wordLanguage']) {
    const before=incoming.before.find(m=>m.type==='textStyle')?.attrs?.[key],after=incoming.after.find(m=>m.type==='textStyle')?.attrs?.[key];
    if(!equal(before,after))continue;
    for(const side of ['before','after']) {
      let mark=format[side].find(m=>m.type==='textStyle');
      if(actual[key]!==undefined){if(!mark){mark={type:'textStyle',attrs:{}};format[side].push(mark);}mark.attrs[key]=clone(actual[key]);}
      else if(mark)delete mark.attrs[key];
      format[side]=format[side].filter(m=>m.type!=='textStyle'||Object.keys(m.attrs||{}).length);
      format[side]=review.normalizeNode({type:'text',text:'x',marks:format[side]}).marks||[];
    }
  }
  return format;
}
function tokens(segments,comparison) {
  const compare=[];
  for(const node of comparison.content||[]) for(const c of text(node))compare.push({...clone(node),...(node.type==='text'?{text:c}:{})});
  const out=[];let index=0,offset=0;
  for(const s of segments)for(const c of text(s.node)) {
    out.push({node:{...clone(s.node),...(s.node.type==='text'?{text:c}:{})},key:stable(compare[index++]),revision:s.revision,formatRevision:s.formatRevision,offset});offset+=c.length;
  }
  need(index===compare.length,'MIXED_RETURN_TOKEN_BINDING');return out;
}
function partitionMeaning(segments) {
  const result=[];let offset=0;
  for(const s of segments) {
    const size=text(s.node).length,meaning=stable([provenance(s.revision),provenance(s.formatRevision)]),last=result.at(-1);
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
function deriveMixedPendingDocument({document,returnedDocument,binding,anchors,exportTypography,exportParagraphs,cleanTransportSchemaVersion=2,allowUntrackedRichFormatting=false,noteBinding=null}) {
  need([1,2].includes(cleanTransportSchemaVersion),'MIXED_RETURN_PROOF_INVALID');
  const existing=review.readLedger(document);
  need(!existing||binding,'MIXED_RETURN_SIGNED_BINDING_REQUIRED');
  const authoredRows=review.paragraphs(existing?.source||document);
  document=canonicalPendingBasis(document);
  if(!binding)binding=review.buildCommentExportBinding({document,anchors,exportTypography,exportParagraphs,schemaVersion:cleanTransportSchemaVersion}).binding;
  let oldLedger=review.readLedger(document);let incoming=review.readLedger(returnedDocument);
  need(oldLedger&&incoming&&incoming.revisions.every(r=>r.state==='pending'),'MIXED_RETURN_PENDING_STATE_REQUIRED');
  const bodyTypography=require('./word-review-typography-v1.cjs');
  const bodyProfile=bodyTypography.validate(exportTypography,{allowUndefined:true});
  if(allowUntrackedRichFormatting&&bodyProfile?.schemaVersion===bodyTypography.V2) {
    const sourceRows=review.paragraphs(oldLedger.source),copy=clone(incoming),rows=review.paragraphs(copy.source);
    need(sourceRows.length===rows.length,'MIXED_RETURN_STRUCTURE_OR_FORMAT_CHANGED');
    sourceRows.forEach((source,index)=>{
      if(source.type!=='codeBlock')return;
      const actual=rows[index],language=source.attrs?.language;
      need(exportParagraphs?.[index]?.nodeType==='codeBlock'&&exportParagraphs[index].codeLanguage===(language||''),'MIXED_RETURN_CODE_STYLE_EMISSION_UNPROVEN');
      need(actual.type==='codeBlock'&&(actual.attrs?.language===''||equal(actual.attrs?.language,authoredRows[index].attrs?.language)),'MIXED_RETURN_CODE_LANGUAGE_CHANGED');
      // Independently replay the source-owned syntax field. Every other
      // attribute remains in the strict structural/format comparison below.
      actual.attrs={...actual.attrs};delete actual.attrs.language;
      if(Object.hasOwn(source.attrs||{},'language'))actual.attrs.language=clone(language);
      if(!Object.keys(actual.attrs).length)delete actual.attrs;
    });
    returnedDocument=review.bindLedger(copy);incoming=review.readLedger(returnedDocument);
  }
  if(oldLedger.revisions.some(r=>r.state!=='pending')){
    // A resolved parent remains local provenance. Only an unchanged authenticated
    // transport may retain it; changed resolved compositions need their own mapper.
    review.verifyCommentReturnBinding({document,returnedDocument,binding,anchors,exportTypography,exportParagraphs});
    const checked=review.buildCommentExportBinding({document,anchors,exportTypography,exportParagraphs,schemaVersion:binding.schemaVersion});
    return {document,projection:checked.projection,changed:false};
  }
  const basis=review.mixedCommentBases({document,returnedDocument,binding,anchors,exportTypography,exportParagraphs,allowUntrackedRichFormatting});
  // Authenticate the original signed ledger above, before adding any local
  // note IDs. Both bindings were independently reconstructed from the full
  // canonical note graph and the two parsed occurrence arrays.
  if(noteBinding)oldLedger=review.readLedger(canonicalPendingBasis(noteBinding.beforeDoc));
  const incomingPoints=noteBinding?review.readLedger(noteBinding.returnedDoc)?.noteSourcePoints:null,mappedPoints=[];
  const oldComparison=review.paragraphs(basis.oldComparison),newComparison=review.paragraphs(basis.newComparison);
  const canonical=review.exportSegments(oldLedger),canonicalParagraphs=review.paragraphs(oldLedger.source);
  const source=clone(oldLedger.source),sourceParagraphs=review.paragraphs(source),revisions=[];let nextId=Math.max(0,...oldLedger.revisions.map(r=>Number(r.id.slice(9))))+1;
  if(allowUntrackedRichFormatting)sourceParagraphs.forEach((paragraph,index)=>{
    if(paragraph.type==='codeBlock')need(exportParagraphs?.[index]?.nodeType==='codeBlock'
      &&exportParagraphs[index].codeLanguage===(paragraph.attrs?.language||''),'MIXED_RETURN_CODE_STYLE_EMISSION_UNPROVEN');
  });
  const bodyEmission=noteBinding?.bodyParagraphEmission;
  if(bodyEmission!==undefined)need(equal(bodyEmission,{
    wordParagraphSpacing:{before:0,after:0,line:240,lineRule:'auto'},
    wordParagraphMarkLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US'}}),'MIXED_RETURN_NOTE_BODY_EMISSION_INVALID');
  let changes=0;
  basis.returned.segments.forEach((segments,p)=>{
    const oldFormat=oldLedger.revisions.find(r=>r.paragraphIndex===p&&review.isParagraphFormat(r));
    const returnedFormat=basis.returned.paragraphFormats.find(r=>r.paragraphIndex===p);
    let styleChanged=false;
    if(allowUntrackedRichFormatting){const actual=review.paragraphs(basis.returned.union)[p];
      for(const key of ['wordParagraphSpacing','wordParagraphMarkLanguage']){
        const value=!oldFormat&&returnedFormat&&!equal(returnedFormat.format.before.attrs?.[key],returnedFormat.format.after.attrs?.[key])
          ?returnedFormat.format.before.attrs?.[key]:actual.attrs?.[key];
        if(bodyProfile?.schemaVersion===bodyTypography.V2&&sourceParagraphs[p].type!=='codeBlock'){
          const expected=bodyTypography.paragraph({nodeType:sourceParagraphs[p].type,...sourceParagraphs[p].attrs},bodyProfile)[key];
          const effective=key==='wordParagraphSpacing'&&value?{before:0,after:0,...value}:value;
          if(equal(expected,effective))continue;
          need(!noteBinding,'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
        }else if(bodyEmission&&sourceParagraphs[p].type!=='codeBlock'){
          const expected={...bodyEmission[key],...sourceParagraphs[p].attrs?.[key]};
          const effective=key==='wordParagraphSpacing'?{before:0,after:0,...value}:value;
          need(equal(expected,effective),'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
          continue; // Retain authored absence/partial fields, not transport fallbacks.
        }
        if(equal(sourceParagraphs[p].attrs?.[key],value))continue;styleChanged=true;
        sourceParagraphs[p].attrs={...sourceParagraphs[p].attrs};
        if(value===undefined)delete sourceParagraphs[p].attrs[key];else sourceParagraphs[p].attrs[key]=clone(value);
        if(!Object.keys(sourceParagraphs[p].attrs).length)delete sourceParagraphs[p].attrs;}
      need(!noteBinding||!styleChanged,'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
      if(styleChanged)changes++;
    }
    if(!oldFormat&&returnedFormat){
      need(!noteBinding,'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
      const before=review.paragraphProperties(sourceParagraphs[p]),after=clone(before);
      const previous=returnedFormat.format.before.attrs?.wordParagraphMarkTypography||{},next=returnedFormat.format.after.attrs?.wordParagraphMarkTypography||{},value=clone(before.attrs?.wordParagraphMarkTypography||{});
      for(const key of new Set([...Object.keys(previous),...Object.keys(next)])){
        const boolean=['bold','italic','underline','strike'].includes(key);
        if(equal(boolean?(previous[key]??false):previous[key],boolean?(next[key]??false):next[key]))continue;
        const slots=['ascii','hAnsi','eastAsia','cs'];
        if(key==='fontSlots'&&bodyProfile?.schemaVersion===bodyTypography.V2&&value.fontSlots
          &&Object.keys(previous.fontSlots||{}).length===4&&Object.keys(next.fontSlots||{}).length===4
          &&slots.every(slot=>typeof previous.fontSlots[slot]==='string'&&typeof next.fontSlots[slot]==='string')) {
          const authored=clone(value.fontSlots);
          for(const slot of slots)if(previous.fontSlots[slot]!==next.fontSlots[slot])authored[slot]=next.fontSlots[slot];
          value.fontSlots=authored;continue;
        }
        if(boolean)value[key]=next[key]??false;else if(next[key]===undefined)delete value[key];else value[key]=clone(next[key]);
      }
      if(Object.keys(value).length)after.attrs={...after.attrs,wordParagraphMarkTypography:value};
      else if(after.attrs){delete after.attrs.wordParagraphMarkTypography;if(!Object.keys(after.attrs).length)delete after.attrs;}
      const previousLanguage=returnedFormat.format.before.attrs?.wordParagraphMarkLanguage||{},nextLanguage=returnedFormat.format.after.attrs?.wordParagraphMarkLanguage||{},language=clone(before.attrs?.wordParagraphMarkLanguage||{});
      for(const key of new Set([...Object.keys(previousLanguage),...Object.keys(nextLanguage)]))if(!equal(previousLanguage[key],nextLanguage[key])){if(nextLanguage[key]===undefined)delete language[key];else language[key]=nextLanguage[key];}
      if(Object.keys(language).length)after.attrs={...after.attrs,wordParagraphMarkLanguage:language};else if(after.attrs){delete after.attrs.wordParagraphMarkLanguage;if(!Object.keys(after.attrs).length)delete after.attrs;}
      if(after.attrs)sourceParagraphs[p].attrs=clone(after.attrs);else delete sourceParagraphs[p].attrs;
      revisions.push({...clone(returnedFormat),id:'revision-'+nextId++,format:{kind:'paragraph',before,after}});changes++;
    }
    if(!allowUntrackedRichFormatting && equal(oldComparison[p],newComparison[p])&&equal(partitionMeaning(basis.before.segments[p]),partitionMeaning(segments))) {
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
      let canonicalNode=match===null?token.node:canonicalRow[match].node;
      if(allowUntrackedRichFormatting&&match!==null){
        const retainedCurrent=bodyProfile?.schemaVersion===bodyTypography.V2&&retained?.operation==='format';
        const ownedParagraph=retainedCurrent?canonicalParagraphs[p]:sourceParagraphs[p];
        const ownedFormat=retainedCurrent?oldLedger.revisions.find(r=>r.id===retained.id).format:null;
        const expectedMarks=retainedCurrent
          ?bodyTypography.segments([{node:{type:'text',text:'x'},revision:{operation:'format',format:ownedFormat}}],
            {nodeType:ownedParagraph.type,...ownedParagraph.attrs},bodyProfile)[0].revision.format.after
          :sourceParagraphs[p].type==='codeBlock'
            ?(old?.revision?.operation==='format'?old.revision.format.before:canonicalNode.marks):before[match].node.marks;
        const incomingMarks=token.revision?.operation==='format'
          ?token.revision.format[retainedCurrent?'after':'before']:token.node.marks;
        const imported=importRunStyle(canonicalNode,incomingMarks,expectedMarks,ownedParagraph.type,ownedParagraph.attrs,bodyEmission);
        need(!noteBinding||equal(imported,canonicalNode),'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
        if(!equal(imported,canonicalNode))changes++;canonicalNode=imported;
      }
      const incomingFormat=token.formatRevision;
      const retainedFormat=old?.formatRevision;
      const node=incomingFormat&&!retainedFormat&&match!==null?applyRunFormat(canonicalNode,incomingFormat.format):fresh && token.revision.operation==='format'?applyRunFormat(canonicalNode,token.revision.format):canonicalNode;
      need(!noteBinding||!fresh||['insert','delete'].includes(token.revision.operation),'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
      need(!noteBinding||!incomingFormat||retainedFormat,'MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED');
      // Rebuild the point in this actual new source, using UTF-16 token
      // boundaries. An incoming offset is evidence, never a copied authority.
      for(const point of incomingPoints||[])if(point.paragraphIndex===p&&point.offsetUtf16===token.offset)
        mappedPoints.push({...point,offsetUtf16:offset});
      nodes.push(clone(node));
      if(retained||fresh) {
        const key=retained?'old:'+retained.id:'new:'+token.revision.id;
        let r=groups.get(key);
        if(!r){r={...clone(retained?oldLedger.revisions.find(r=>r.id===retained.id):token.revision),paragraphIndex:p,from:offset,to:offset+text(node).length};
          if(retained && allowUntrackedRichFormatting && r.operation==='format')r.format=rebaseRetainedRunFormat(r.format,token.revision.format,node,canonicalParagraphs[p],exportTypography);
          if(!retained){r.id='revision-'+nextId++;r.groupId=null;
            if(r.operation==='format')r.format={kind:'run',before:clone(canonicalNode.marks||[]),after:clone(node.marks||[])};
          }
          groups.set(key,r);revisions.push(r);
        }else {need(r.to===offset,'MIXED_RETURN_PARTITION_SPLIT');
          if(fresh && r.operation==='format')need(equal(r.format.before,canonicalNode.marks||[])&&equal(r.format.after,node.marks||[]),'MIXED_RETURN_FORMAT_PARTITION_CHANGED');
          r.to=offset+text(node).length;}
      }
      if(incomingFormat){
        const parentKey=retained?'old:'+retained.id:'new:'+token.revision?.id,parent=groups.get(parentKey);
        need(parent&&parent.operation==='insert','MIXED_RETURN_FORMAT_PARENT_INVALID');
        const key=retainedFormat?'old-format:'+retainedFormat.id:'new-format:'+incomingFormat.id;
        let child=groups.get(key);
        if(!child){child={...clone(retainedFormat?oldLedger.revisions.find(r=>r.id===retainedFormat.id):incomingFormat),id:retainedFormat?.id||'revision-'+nextId++,
          parentRevisionId:parent.id,paragraphIndex:p,from:offset,to:offset+text(node).length};
          if(!retainedFormat)child.format={kind:'run',before:clone(match===null?incomingFormat.format.before:canonicalNode.marks||[]),after:clone(node.marks||[])};
          else if(allowUntrackedRichFormatting)child.format=rebaseRetainedRunFormat(child.format,incomingFormat.format,node,canonicalParagraphs[p],exportTypography);
          groups.set(key,child);revisions.push(child);if(!retainedFormat)changes++;
        }else{need(child.to===offset,'MIXED_RETURN_PARTITION_SPLIT');child.to=offset+text(node).length;}
      }
      offset+=text(node).length;
    });
    const incomingLength=row.reduce((size,token)=>size+text(token.node).length,0);
    for(const point of incomingPoints||[])if(point.paragraphIndex===p&&point.offsetUtf16===incomingLength)
      mappedPoints.push({...point,offsetUtf16:offset});
    sourceParagraphs[p].content=nodes;
    if(oldFormat){
      const retained={...clone(oldFormat),to:offset};
      if(allowUntrackedRichFormatting){
        const expected=bodyProfile?.schemaVersion===bodyTypography.V2?{...oldFormat.format,
          before:bodyTypography.snapshot(oldFormat.format.before,bodyProfile),after:bodyTypography.snapshot(oldFormat.format.after,bodyProfile)}:oldFormat.format;
        need(returnedFormat && equal(review.formatTransitionMeaning(expected),review.formatTransitionMeaning(returnedFormat.format)),
          'MIXED_RETURN_OLD_PARAGRAPH_FORMAT_CHANGED');
        // Only equal, non-authored style underlays may rebase an existing event.
        // Alignment and every actual tracked property transition remain owned
        // by the original revision, together with its ID and provenance.
        for(const key of ['wordParagraphSpacing','wordParagraphMarkLanguage']){
          const before=returnedFormat.format.before.attrs?.[key],after=returnedFormat.format.after.attrs?.[key];
          if(bodyProfile?.schemaVersion===bodyTypography.V2&&equal(before,expected.before.attrs?.[key])&&equal(after,expected.after.attrs?.[key]))continue;
          if(!equal(before,after))continue;
          for(const side of ['before','after']){
            const properties=retained.format[side];
            if(after===undefined){if(properties.attrs){delete properties.attrs[key];if(!Object.keys(properties.attrs).length)delete properties.attrs;}}
            else properties.attrs={...properties.attrs,[key]:clone(after)};
          }
        }
      }
      revisions.push(retained);
    }
    else if(returnedFormat)revisions.find(r=>r.paragraphIndex===p&&review.isParagraphFormat(r)).to=offset;
  });
  // Existing IDs and groups remain canonical; interval order follows the new source.
  const ordered=[...oldLedger.revisions.map(old=>{const r=revisions.find(r=>r.id===old.id);need(r,'MIXED_RETURN_OLD_REVISION_LOST');return r;}),...revisions.filter(r=>!oldLedger.revisions.some(old=>old.id===r.id))].sort((a,b)=>a.paragraphIndex-b.paragraphIndex||a.from-b.from);
  const nested=ordered.some(r=>r.parentRevisionId!==undefined),points=noteBinding?incomingPoints?mappedPoints:null:oldLedger.noteSourcePoints;
  need(!incomingPoints||mappedPoints.length===incomingPoints.length,'PENDING_NOTE_UNION_BINDING');
  const doc=review.bindLedger({schemaVersion:nested?5:points?3:ordered.length?1:2,source:review.normalizeNode(source),revisions:ordered,undo:[],redo:[],
    ...(points?{noteSourcePoints:clone(points)}:{}),...(!ordered.length||nested||points?{roundUndo:[],roundRedo:[],returnReceipts:[]}:{})});
  return {document:doc,projection:basis.returned,changed:changes>0,beforeDocument:canonicalPendingBasis(noteBinding?.beforeDoc||document)};
}
function planMixedPendingReturn({beforeText,projectId,sceneId,beforeContent,afterContent,returnProofJson}) {
  need(typeof returnProofJson==='string'&&Buffer.byteLength(returnProofJson)<=8*1024*1024,'MIXED_RETURN_PROOF_BUDGET');
  let proof;try{proof=JSON.parse(returnProofJson);}catch{fail('MIXED_RETURN_PROOF_INVALID');}
  need(proof&&[1,2].includes(proof.schemaVersion)&&Object.keys(proof).sort().join(',')===
    (proof.schemaVersion===2?'artifactSha256,baseline,commentReturnInventory,exportMap,projectId,returnedLedger,returnedParagraphs,returnedThreads,roundId,schemaVersion':'artifactSha256,baseline,commentReturnInventory,exportMap,projectId,returnedDocument,returnedParagraphs,returnedThreads,roundId,schemaVersion')
    &&proof.projectId===projectId,'MIXED_RETURN_PROOF_INVALID');
  // Version 2 stores one canonical source; its visible document is an exact
  // checked materialization, not a separately supplied transport projection.
  if(proof.schemaVersion===2)need(proof.exportMap&&!Object.hasOwn(proof.exportMap,'commentExport'),'MIXED_RETURN_PROOF_INVALID');
  const returnedDocument=proof.schemaVersion===2?review.bindLedger(proof.returnedLedger):proof.returnedDocument;
  const scene=proof.exportMap?.scenes?.[0];need(proof.exportMap?.scenes?.length===1&&scene.sceneId===sceneId,'MIXED_RETURN_SCENE_REQUIRED');
  const parsed=envelope.parseObservablePayload(beforeContent);need(!parsed.issue&&parsed.doc,'MIXED_RETURN_DOCUMENT_REQUIRED');
  const sha=require('./browser-safe-hash.cjs').sha256UpdateCompatible;
  need(scene.rawSha256==='sha256:'+sha(beforeContent),'MIXED_RETURN_BASELINE_STALE');
  const state=readState(beforeText,projectId),anchors=state.threads.filter(t=>t.sceneId===sceneId&&t.status!=='deleted').map(t=>({threadId:t.threadId,anchor:t.anchor}));
  const baselineRows=review.paragraphs(review.normalizeNode(parsed.doc));
  need(baselineRows.length===scene.blocks.length&&scene.blocks.every((b,i)=>b.formatIr?.runs?.map(r=>r.text).join('')===(baselineRows[i].content||[]).map(text).join('')),'MIXED_RETURN_EXPORT_TEXT_STALE');
  const derived=deriveMixedPendingDocument({document:parsed.doc,returnedDocument,binding:scene.pendingCommentBinding,anchors,
    exportTypography:proof.exportMap.exportTypography,exportParagraphs:scene.blocks.map(b=>b.formatIr?.paragraph)});
  const replacement=review.replaceFromReturn(canonicalPendingBasis(parsed.doc),derived.document,{roundId:proof.roundId,artifactSha256:proof.artifactSha256.replace(/^sha256:/u,'')});
  const content=envelope.composeObservablePayload({...parsed,metaEnabled:parsed.hasMetaBlock,doc:replacement.doc});
  if(afterContent!==undefined)need(content===afterContent,'MIXED_RETURN_TARGET_MISMATCH');
  const delta=require('./word-comment-return-delta-v1.cjs').planCommentReturnDelta({...proof,beforeText,
    mixedPendingScene:{sceneId,document:parsed.doc,returnedDocument}});
  need(equal(readState(delta.afterText,projectId).threads.filter(t=>t.sceneId!==sceneId),state.threads.filter(t=>t.sceneId!==sceneId)),'MIXED_RETURN_FOREIGN_SCENE');
  return {mode:RETURN_MODE,beforeText,afterText:delta.afterText,returnProofJson,content,replacement,changes:delta.changes};
}
// Complete book proof; callers cannot make unrelated scene replies disappear by
// applying separate partial graph deltas. Existing one-scene proof stays closed.
function planMixedBookReturn({beforeText,projectId,scenes,returnProofJson,notesText=null}) {
  need(typeof returnProofJson==='string'&&Buffer.byteLength(returnProofJson)<=8*1024*1024,'MIXED_RETURN_PROOF_BUDGET');
  let proof;try{proof=JSON.parse(returnProofJson);}catch{fail('MIXED_RETURN_PROOF_INVALID');}
  need([3,4].includes(proof?.schemaVersion)&&Object.keys(proof).sort().join(',')===
    (proof.schemaVersion===4?'artifactSha256,baseline,commentReturnInventory,exportMap,noteContext,projectId,returnedParagraphs,returnedScenes,returnedThreads,roundId,schemaVersion'
    :'artifactSha256,baseline,commentReturnInventory,exportMap,projectId,returnedParagraphs,returnedScenes,returnedThreads,roundId,schemaVersion')
    &&proof.projectId===projectId&&!Object.hasOwn(proof.exportMap||{},'commentExport'),'MIXED_RETURN_PROOF_INVALID');
  need(typeof proof.roundId==='string'&&proof.roundId.length>0&&typeof proof.artifactSha256==='string'&&/^sha256:[a-f0-9]{64}$/u.test(proof.artifactSha256),'MIXED_RETURN_PROOF_INVALID');
  const mapped=proof.exportMap?.scenes;
  need(Array.isArray(mapped)&&mapped.length>1&&mapped.length<=512&&Array.isArray(scenes)&&scenes.length===mapped.length
    &&Array.isArray(proof.returnedScenes)&&proof.returnedScenes.length===mapped.length
    &&new Set(mapped.map(s=>s.sceneId)).size===mapped.length,'MIXED_RETURN_SCENE_REQUIRED');
  const state=readState(beforeText,projectId),sha=require('./browser-safe-hash.cjs').sha256UpdateCompatible;
  // Authenticate every raw source before note binding; valid plain envelopes
  // have a read-only paragraph projection while their exact bytes remain owned.
  const parsedScenes=scenes.map((scene,i)=>{
    const binding=mapped[i],returned=proof.returnedScenes[i];
    need(scene?.sceneId===binding.sceneId&&returned?.sceneId===binding.sceneId
      &&Object.keys(returned).sort().join(',')==='ledger,sceneId'
      &&typeof scene.beforeContent==='string'&&binding.rawSha256==='sha256:'+sha(scene.beforeContent),'MIXED_RETURN_BASELINE_STALE');
    const parsed=envelope.parseObservablePayload(scene.beforeContent);
    need(!parsed.issue&&(parsed.doc||parsed.version===1),'MIXED_RETURN_DOCUMENT_REQUIRED');
    parsed.doc ||= envelope.buildParagraphDocumentFromText(parsed.text);return parsed;
  });
  const noteScenes=proof.schemaVersion===4?bookNoteBindings({notesText,projectId,exportMap:proof.exportMap,noteContext:proof.noteContext,
    scenes:scenes.map((scene,i)=>({sceneId:scene.sceneId,document:parsedScenes[i].doc,
      returnedDocument:review.bindLedger(proof.returnedScenes[i].ledger)}))}):null;
  const mixed=[],results=[];
  for(let i=0;i<mapped.length;i++) {
    const binding=mapped[i],scene=scenes[i],returned=proof.returnedScenes[i],parsed=parsedScenes[i];
    const returnedDocument=review.bindLedger(returned.ledger),anchors=state.threads.filter(t=>t.sceneId===scene.sceneId&&t.status!=='deleted').map(t=>({threadId:t.threadId,anchor:t.anchor}));
    const rows=review.paragraphs(review.normalizeNode(parsed.doc));
    need(rows.length===binding.blocks.length&&binding.blocks.every((b,j)=>b.formatIr?.runs?.map(r=>r.text).join('')===(rows[j].content||[]).map(text).join('')),'MIXED_RETURN_EXPORT_TEXT_STALE');
    const derived=deriveMixedPendingDocument({document:parsed.doc,returnedDocument,binding:binding.pendingCommentBinding,anchors,
      exportTypography:proof.exportMap.exportTypography,exportParagraphs:binding.blocks.map(b=>b.formatIr?.paragraph),cleanTransportSchemaVersion:1,allowUntrackedRichFormatting:true,
      noteBinding:noteScenes?.[i]||null});
    const replacement=derived.changed?review.replaceFromReturn(derived.beforeDocument||canonicalPendingBasis(parsed.doc),derived.document,
      {roundId:proof.roundId,artifactSha256:proof.artifactSha256.replace(/^sha256:/u,'')}):{doc:parsed.doc,changed:false};
    const content=derived.changed?envelope.composeObservablePayload({...parsed,metaEnabled:parsed.hasMetaBlock,doc:replacement.doc}):scene.beforeContent;
    mixed.push({sceneId:scene.sceneId,document:parsed.doc,returnedDocument});
    results.push({sceneId:scene.sceneId,beforeContent:scene.beforeContent,content,changed:content!==scene.beforeContent});
  }
  const delta=require('./word-comment-return-delta-v1.cjs').planCommentReturnDelta({...proof,beforeText,notesText,mixedPendingScenes:mixed});
  return {scenes:results,beforeText,afterText:delta.afterText,changes:delta.changes,replay:delta.replay===true};
}
function bookNoteBindings({notesText,projectId,exportMap,noteContext,scenes}) {
  need(typeof notesText==='string'&&Buffer.byteLength(notesText)<=4*1024*1024
    &&noteContext&&Object.keys(noteContext).sort().join(',')==='baseline,returnedNotes,returnedReferences,unionReferences'
    &&Array.isArray(noteContext.returnedNotes)&&Array.isArray(noteContext.returnedReferences)&&Array.isArray(noteContext.unionReferences),'PENDING_NOTE_BOOK_CONTEXT_INVALID');
  return require('./word-note-return-delta-v1.cjs').bindUnchangedBookPendingNotes({document:JSON.parse(notesText),projectId,exportMap,scenes,...noteContext});
}
module.exports={deriveMixedPendingDocument,planMixedPendingReturn,planMixedBookReturn,bookNoteBindings};

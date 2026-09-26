import { createHash } from 'node:crypto';
import links from '../docxHyperlinks.cjs';

// Analysis only: this result never supplies write or round authority. Main must
// bind it to its authenticated local export and revalidate at explicit Apply.
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stable = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))));
const reject = detail => ({ ok:false, code:'RTK_CLEAN_LINK_LABEL_NOT_EXACT', detail, canWriteManuscript:false });
const keys = new Set(['bold','italic','underline','strike','color','highlight','fontFamily','fontSize','link']);
const sha = value => createHash('sha256').update(value).digest('hex');
function shape(state) {
  if (!plain(state) || Object.keys(state).some(k => !keys.has(k))) throw Error('inline-shape');
  const out = {...state};
  for (const k of ['bold','italic','underline','strike']) {
    if (out[k] === false) delete out[k];
    else if (Object.hasOwn(out,k) && out[k] !== true) throw Error('boolean');
  }
  if (Object.hasOwn(out,'link')) out.link = links.normalizeDocxHttpHref(out.link);
  return out;
}
function runs(input, text, returned, defaultFontSize = null) {
  if (!Array.isArray(input) || input.length > 4096 || typeof text !== 'string' || text.length > 65536) throw Error('run-budget');
  const out = []; let offset=0;
  for (const r of input) {
    if (!plain(r) || typeof r.text !== 'string' || !r.text || r.from !== offset || r.to !== offset+r.text.length
      || text.slice(r.from,r.to)!==r.text) throw Error('run-bijection');
    if (returned && (r.invalidSupportedValue || r.unsupportedNames?.length)) throw Error('unsupported-run');
    let inline;
    if (returned) inline=shape({...r.inlineState,...(!r.inlineState?.fontSize && r.inheritedFontSize ? {fontSize:r.inheritedFontSize} : {})});
    else {
      inline={...r.inline};
      for (const mark of r.preservedMarks || []) {
        if (mark?.type !== 'link' || inline.link) throw Error('unsupported-mark');
        inline.link=mark.attrs?.href;
      }
      inline=shape(inline);
      if (defaultFontSize && !inline.fontSize) inline.fontSize=defaultFontSize;
    }
    const signature=stable(inline), previous=out.at(-1);
    if (previous?.signature===signature) { previous.text+=r.text; previous.to=r.to; }
    else out.push({from:r.from,to:r.to,text:r.text,inline,signature});
    offset=r.to;
  }
  if (offset!==text.length) throw Error('incomplete-runs');
  return out;
}
function boundaries(text) {
  return new Set([0,text.length,...Array.from(new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text),x=>x.index)]);
}

export function analyzeCleanLinkLabelReturn({ baselineParagraphs, returnedParagraphs, sceneId, reviewIr = {}, exportTypography } = {}) {
  try {
    // Only the main-owned authenticated export map supplies this descriptor.
    // A returned stylesheet or historical round cannot invent its own baseline.
    let defaultFontSize=null;
    if (exportTypography !== undefined) {
      if (!plain(exportTypography) || Object.keys(exportTypography).sort().join(',')!=='fontSize,schemaVersion'
        || exportTypography.schemaVersion!=='yalken.review-docx.typography-defaults.v1'
        || exportTypography.fontSize!=='12pt') return reject('export-typography-binding');
      defaultFontSize=exportTypography.fontSize;
    }
    if (!sceneId || !Array.isArray(baselineParagraphs) || !baselineParagraphs.length
      || baselineParagraphs.length>256 || !Array.isArray(returnedParagraphs)
      || baselineParagraphs.length!==returnedParagraphs.length) return reject('paragraph-budget-or-cardinality');
    for (const name of ['textRevisions','moveRevisions','propertyRevisions','commentThreads','comments']) {
      if ((reviewIr[name] || []).length) return reject('mixed-or-unsupported-effects');
    }
    const instructionKey = p => p?.partName==='word/document.xml' && p.elementName==='instrText'
      && p.namespaceUri==='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
      && Number.isSafeInteger(p.openStart) && Number.isSafeInteger(p.closeEnd) && p.openStart>=0 && p.closeEnd>p.openStart
      ? `${p.openStart}:${p.closeEnd}` : null;
    const accounted = new Set();
    for (const paragraph of returnedParagraphs) for (const p of paragraph.inertHyperlinkInstructions || []) {
      const key=instructionKey(p);
      if (!key || accounted.has(key) || links.normalizeDocxHttpHref(p.href)!==p.href
        || !paragraph.formattedRuns?.some(r=>r.inlineState?.link===p.href)) return reject('field-proof');
      accounted.add(key);
    }
    for (const item of reviewIr.opaqueUnsupported || []) {
      if (item.writerAuthorityImpact==='inventory-only') continue;
      const key=instructionKey(item.sourceXmlProvenance);
      if (item.kind!=='unsupported-element' || item.elementName!=='instrText'
        || item.typedDiagnostic!=='RTK_STRUCTURAL_OR_FORMAT_ELEMENT_MANUAL' || !key || !accounted.has(key)) return reject('unsupported-effects');
      accounted.delete(key);
    }
    if (accounted.size) return reject('field-inventory-mismatch');
    if ((reviewIr.structureChanges || []).some(x=>x.writerAuthorityImpact!=='inventory-only')) return reject('structure');
    let effect=null, total=0;
    for (let i=0;i<baselineParagraphs.length;i++) {
      const base=baselineParagraphs[i], next=returnedParagraphs[i], format=base?.formatIr;
      if (!plain(format) || !plain(next) || next.trackedRevision || next.table || format.table || format.media?.length
        || next.paragraphFormattingInvalid || next.unsupportedParagraphNames?.length) return reject('paragraph-semantics');
      const p=format.paragraph||{};
      if (Object.keys(p).some(k=>!['nodeType','textAlign','headingLevel'].includes(k))) return reject('unsupported-paragraph');
      if (!['paragraph','heading'].includes(p.nodeType)) return reject('paragraph-kind');
      const structure=next.paragraphStructure||{};
      if (Object.keys(structure).some(k=>!['nodeType','headingLevel'].includes(k))) return reject('returned-structure');
      if ((p.textAlign||'left')!==(next.paragraphState?.textAlign||'left')) return reject('paragraph-format-change');
      const nextType=Object.hasOwn(structure,'nodeType')?structure.nodeType:'paragraph';
      if (nextType!==p.nodeType) return reject('paragraph-kind-change');
      if (p.nodeType==='heading') {
        if (!Number.isSafeInteger(p.headingLevel) || p.headingLevel<1 || p.headingLevel>6
          || structure.headingLevel!==p.headingLevel) return reject('heading-level-change');
      } else if (Object.hasOwn(p,'headingLevel') || Object.hasOwn(structure,'headingLevel')) {
        return reject('unexpected-heading-level');
      }
      const oldRuns=runs(format.runs,base.text,false,defaultFontSize), newRuns=runs(next.formattedRuns,next.paragraphText,true);
      total+=base.text.length+next.paragraphText.length;
      if (total>262144 || oldRuns.length!==newRuns.length) return reject('shape-or-total-budget');
      for (let j=0;j<oldRuns.length;j++) {
        const a=oldRuns[j], b=newRuns[j];
        if (a.signature!==b.signature) return reject('marks-or-target-changed');
        if (a.text===b.text) continue;
        if (effect || !a.inline.link || /[\r\n\t\u0000-\u001f\u007f]/u.test(a.text+b.text)
          || a.text.length>4096 || b.text.length>4096) return reject('not-single-link-label');
        if (!boundaries(base.text).has(a.from) || !boundaries(base.text).has(a.to)
          || !boundaries(next.paragraphText).has(b.from) || !boundaries(next.paragraphText).has(b.to)) return reject('grapheme-boundary');
        effect={paragraphOrdinal:i,from:a.from,to:a.to,selectedText:a.text,replacementText:b.text,href:a.inline.link};
      }
    }
    if (!effect) return reject('no-label-change');
    const fullText=baselineParagraphs.map(p=>p.text).join('\n');
    let quote=effect.selectedText, replacementText=effect.replacementText, richReplacementRange;
    if (fullText.indexOf(quote)!==fullText.lastIndexOf(quote)) {
      // Keep global exact-quote uniqueness. A repeated label is admissible only
      // inside a unique, fully compared paragraph; the writer must verify the
      // inner substitution before touching any rich node or neighboring mark.
      quote=baselineParagraphs[effect.paragraphOrdinal].text;
      replacementText=returnedParagraphs[effect.paragraphOrdinal].paragraphText;
      if (!quote || /[\r\n]/u.test(quote+replacementText)
        || fullText.indexOf(quote)!==fullText.lastIndexOf(quote)) return reject('ambiguous-paragraph');
      richReplacementRange={from:effect.from,to:effect.to,
        expectedText:effect.selectedText,replacementText:effect.replacementText};
    }
    const digest=sha(JSON.stringify({sceneId,baselineParagraphs,returnedParagraphs,effect}));
    return {ok:true,code:'RTK_CLEAN_LINK_LABEL_ANALYZED',analysisOnly:true,canWriteManuscript:false,effect,
      change:{changeId:'docx-clean-link-label-'+digest.slice(0,24),targetScope:{type:'scene',id:sceneId},
        match:{kind:'exact',quote,prefix:'',suffix:'',...(richReplacementRange?{richReplacementRange}:{})},replacementText,
        sourceAuthority:'authenticated-clean-link-label-v1',rtkProductPath:'cleanLinkLabel',
        paragraphIndex:effect.paragraphOrdinal,documentParagraphIndex:effect.paragraphOrdinal},digest};
  } catch(error) { return reject(error.message); }
}

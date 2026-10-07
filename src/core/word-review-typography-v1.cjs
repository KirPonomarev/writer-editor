'use strict';
const { normalizeFontSize, normalizeParagraphMarkTypography } = require('../io/inlineTypography.cjs');
const V1 = 'yalken.review-docx.typography-defaults.v1';
const V2 = 'yalken.review-docx.typography-defaults.v2';
const LANGUAGE = Object.freeze({val:'en-US',eastAsia:'en-US',bidi:'en-US'});
const BODY = Object.freeze({schemaVersion:V2,fontSize:'12pt',
  bodyParagraphDefaults:Object.freeze({
    wordParagraphSpacing:Object.freeze({before:0,after:0,line:240,lineRule:'auto'}),
    wordParagraphMarkLanguage:LANGUAGE,
    wordParagraphMarkTypography:Object.freeze({fontFamily:'Times New Roman',fontSize:'12pt'})}),
  bodyRunDefaults:Object.freeze({fontFamily:'Times New Roman',fontSize:'12pt',wordLanguage:LANGUAGE})});
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => {throw Object.assign(Error(code),{code});};
// Read complete own data before interpreting a version or serializing a caller.
function data(value, depth=0) {
  if(depth>5)fail('WORD_REVIEW_TYPOGRAPHY_INVALID');
  if(typeof value==='string'||typeof value==='number')return value;
  if(!value||typeof value!=='object'||Array.isArray(value)
    || ![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('WORD_REVIEW_TYPOGRAPHY_INVALID');
  const result={};
  for(const key of Reflect.ownKeys(value)) {
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')
      || ['__proto__','toJSON'].includes(key))fail('WORD_REVIEW_TYPOGRAPHY_INVALID');
    result[key]=data(descriptor.value,depth+1);
  }
  return result;
}
function same(left,right) {
  if(typeof left!==typeof right)return false;
  if(!left||typeof left!=='object')return left===right;
  const keys=Object.keys(left).sort(),other=Object.keys(right||{}).sort();
  return keys.join(',')===other.join(',')&&keys.every(key=>same(left[key],right[key]));
}
function validate(value,{allowUndefined=false,legacyAnySize=false}={},code='WORD_REVIEW_TYPOGRAPHY_INVALID') {
  if(value===undefined&&allowUndefined)return null;
  try {
    const checked=data(value);
    if(checked.schemaVersion===V1) {
      if(Object.keys(checked).sort().join(',')!=='fontSize,schemaVersion'
        || (legacyAnySize?normalizeFontSize(checked.fontSize)!==checked.fontSize:checked.fontSize!=='12pt'))fail(code);
    } else if(!same(checked,BODY))fail(code);
    return checked;
  }catch{fail(code);}
}
function freshBodyTypography(){return clone(BODY);}
function paragraph(value,typography) {
  const checked=validate(typography,{allowUndefined:true});
  if(checked?.schemaVersion!==V2)return clone(value);
  const code=value.nodeType==='codeBlock',defaults=checked.bodyParagraphDefaults;
  const authored=value.wordParagraphMarkTypography==null?{}:normalizeParagraphMarkTypography(value.wordParagraphMarkTypography);
  const typographyMark={...defaults.wordParagraphMarkTypography,...authored};
  if(authored.fontSlots) {
    delete typographyMark.fontFamily;delete typographyMark.fontSlots;
    const slots=Object.fromEntries(['ascii','hAnsi','eastAsia','cs'].map(key=>[key,authored.fontSlots[key]||defaults.wordParagraphMarkTypography.fontFamily]));
    if(new Set(Object.values(slots)).size===1)typographyMark.fontFamily=slots.ascii;
    else typographyMark.fontSlots=slots;
  }
  if(code) {
    if(!authored.fontFamily&&!authored.fontSlots)typographyMark.fontFamily='Menlo';
    if(!authored.fontSize)typographyMark.fontSize='10pt';
  }
  return {...clone(value),
    ...(value.wordParagraphIndent==null&&Number.isSafeInteger(value.blockquoteDepth)&&value.blockquoteDepth>0&&value.blockquoteDepth<=8?{wordParagraphIndent:{left:value.blockquoteDepth*720}}:{}),
    wordParagraphSpacing:{...defaults.wordParagraphSpacing,...(code?{before:80,after:80}:{}),...value.wordParagraphSpacing},
    wordParagraphMarkLanguage:{...defaults.wordParagraphMarkLanguage,...value.wordParagraphMarkLanguage},
    wordParagraphMarkTypography:normalizeParagraphMarkTypography(typographyMark)};
}
function inline(value,sourceParagraph,typography) {
  const checked=validate(typography,{allowUndefined:true});
  if(checked?.schemaVersion!==V2)return clone(value||{});
  const code=sourceParagraph.nodeType==='codeBlock';
  return {...checked.bodyRunDefaults,...(code?{fontFamily:'Menlo',fontSize:'10pt'}:{}),...value,
    wordLanguage:{...checked.bodyRunDefaults.wordLanguage,...sourceParagraph.wordParagraphMarkLanguage,...value?.wordLanguage}};
}
function formatIr(value,typography) {
  const checked=validate(typography,{allowUndefined:true});
  if(checked?.schemaVersion!==V2)return clone(value);
  return {...clone(value),paragraph:paragraph(value.paragraph,checked),
    runs:(value.runs||[]).map(run=>({...clone(run),inline:inline(run.inline,value.paragraph,checked)}))};
}
function node(value,sourceParagraph,typography) {
  const result=clone(value);
  if(!['text','hardBreak'].includes(result.type))return result;
  const marks=result.marks||[],style=marks.find(mark=>mark.type==='textStyle');
  result.marks=[...marks.filter(mark=>mark.type!=='textStyle'),{type:'textStyle',attrs:inline(style?.attrs,sourceParagraph,typography)}];
  return result;
}
function snapshot(value,typography) {
  const result=clone(value),p=paragraph({nodeType:value.type,...value.attrs},typography);
  delete p.nodeType;
  result.attrs=p;
  if(result.content)result.content=result.content.map(child=>node(child,{nodeType:value.type,...value.attrs},typography));
  return result;
}
function document(value,typography) {
  const checked=validate(typography,{allowUndefined:true});
  if(checked?.schemaVersion!==V2)return clone(value);
  const visit=value=>{
    if(value.type==='codeBlock')return clone(value);
    if(['paragraph','heading'].includes(value.type))return snapshot(value,checked);
    return {...clone(value),...(value.content?{content:value.content.map(visit)}:{})};
  };
  return visit(value);
}
function segments(value,sourceParagraph,typography,{canonicalCode=false}={}) {
  const checked=validate(typography,{allowUndefined:true});
  if(checked?.schemaVersion!==V2)return clone(value);
  if(canonicalCode&&sourceParagraph.nodeType==='codeBlock')return clone(value);
  return value.map(segment=>({...clone(segment),node:node(segment.node,sourceParagraph,checked),
    ...(segment.formatRevision?{formatRevision:{...clone(segment.formatRevision),format:{
      ...clone(segment.formatRevision.format),
      before:node({type:'text',text:'x',marks:segment.formatRevision.format.before},sourceParagraph,checked).marks,
      after:node({type:'text',text:'x',marks:segment.formatRevision.format.after},sourceParagraph,checked).marks}}}:{}),
    ...(segment.revision?.operation==='format'?{revision:{...clone(segment.revision),format:{
      ...clone(segment.revision.format),
      before:node({type:'text',text:'x',marks:segment.revision.format.before},sourceParagraph,checked).marks,
      after:node({type:'text',text:'x',marks:segment.revision.format.after},sourceParagraph,checked).marks}}}:{})}));
}
function markerMeaning(value) {
  const result=require('../io/inlineTypography.cjs').comparableParagraphMarkTypography(value);
  if(result)for(const key of ['color','highlight'])if(result[key]===null)delete result[key];
  return result;
}
// Compare the parser's effective presentation against the independently
// emitted source. This does not fill missing returned fonts/language/line data.
function readback(raw,actual,typography,{allowTextChanges=false}={}) {
  const expected=formatIr(raw,typography);
  if(validate(typography).schemaVersion!==V2)fail('WORD_REVIEW_BODY_PROFILE_REQUIRED');
  if(!actual||actual.paragraphFormattingInvalid||actual.wordLanguageInvalid
    ||actual.formattedRuns?.some(run=>run.invalidSupportedValue||run.unsupportedNames?.length))return false;
  if(expected.paragraph.nodeType==='codeBlock'&&!same(actual.effectiveCodeStyle,{styleId:'YalkenCodeBlock',shading:{val:'clear',color:'auto',fill:'f3f4f6'}}))return false;
  const actualP=actual.paragraphState||{};
  for(const key of ['wordParagraphMarkLanguage','wordParagraphMarkTypography','wordParagraphSpacing']) {
    let a=key==='wordParagraphMarkTypography'?actual.effectiveParagraphMarkTypography:actualP[key],b=expected.paragraph[key];
    if(key==='wordParagraphSpacing'&&a)a={before:0,after:0,...a};
    if(key==='wordParagraphMarkTypography') {
      a=a==null?null:markerMeaning(a);b=b==null?null:markerMeaning(b);
    }
    if(!same(a,b))return false;
  }
  const returned=actual.formattedRuns||[],before=expected.runs;
  const text=before.map(run=>run.text).join('');
  if(!allowTextChanges&&returned.map(run=>run.text).join('')!==text)return false;
  const cuts=[...new Set([0,text.length,...before.flatMap(run=>[run.from,run.to]),...returned.flatMap(run=>[run.from,run.to])])].sort((a,b)=>a-b);
  const normalized=value=>{
    const result=clone(value);
    for(const key of ['bold','italic','underline','strike'])if(result[key]===false)delete result[key];
    for(const key of ['color','highlight'])if(typeof result[key]==='string')result[key]=result[key].toLowerCase();
    return result;
  };
  if(allowTextChanges) {
    if(expected.paragraph.nodeType!=='codeBlock'||before.some(run=>!same(run.inline,before[0]?.inline)))return false;
    return returned.every(run=>{const actual={...run.inlineState};if(!actual.fontFamily&&run.resolvedFontFamily)actual.fontFamily=run.resolvedFontFamily;if(!actual.fontSize&&run.inheritedFontSize)actual.fontSize=run.inheritedFontSize;return same(normalized(actual),normalized(before[0]?.inline||inline({},raw.paragraph,typography)));});
  }
  for(let index=0;index+1<cuts.length;index++) {
    const from=cuts[index],to=cuts[index+1];
    const old=before.filter(run=>run.from<=from&&run.to>=to),next=returned.filter(run=>run.from<=from&&run.to>=to);
    if(old.length!==1||next.length!==1)return false;
    const a={...next[0].inlineState},b={...old[0].inline};
    if(!a.fontFamily&&next[0].resolvedFontFamily)a.fontFamily=next[0].resolvedFontFamily;
    if(!a.fontSize&&next[0].inheritedFontSize)a.fontSize=next[0].inheritedFontSize;
    for(const mark of old[0].preservedMarks||[]) {
      if(mark.type!=='link')return false;
      b.link=mark.attrs.href;
    }
    if(!same(normalized(a),normalized(b)))return false;
  }
  return true;
}
module.exports={markerMeaning,V1,V2,validate,freshBodyTypography,paragraph,inline,formatIr,document,segments,snapshot,readback};

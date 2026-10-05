'use strict';
// Pure values shared by Node exporters and the bundled editor.
// No DOM, Node APIs, I/O or module dependencies.
const GENERIC_FONTS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer',
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']);

function normalizeFontFamily(value) {
  if (typeof value !== 'string' || value.length > 128 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('DOCX_FONT_FAMILY_INVALID');
  }
  let family = value.trim();
  if (/^("[^"]+"|'[^']+')$/u.test(family)) family = family.slice(1, -1).trim();
  if (!family || !/^[\p{L}\p{M}\p{N} _.'-]+$/u.test(family) || GENERIC_FONTS.has(family.toLowerCase())) {
    throw new Error('DOCX_FONT_FAMILY_INVALID');
  }
  return family;
}

function normalizeFontSize(value) {
  if (typeof value !== 'string' || value.length > 32) throw new Error('DOCX_FONT_SIZE_INVALID');
  const match = /^(\d{1,4}(?:\.\d{1,4})?)(pt|px)$/u.exec(value.trim().toLowerCase());
  const points = match ? Number(match[1]) * (match[2] === 'px' ? 0.75 : 1) : NaN;
  if (!Number.isFinite(points) || points < 1 || points > 1638) throw new Error('DOCX_FONT_SIZE_INVALID');
  const halfPoints = Math.round(points * 2);
  if (Math.abs(points * 2 - halfPoints) > 1e-8) throw new Error('DOCX_FONT_SIZE_NOT_HALF_POINT_EXACT');
  return `${halfPoints / 2}pt`;
}

// Paragraph-mark scope is separate from visible text marks. Explicit off/reset
// values are data: removing them would reveal an inherited Word style.
const PARAGRAPH_MARK_KEYS = Object.freeze(['bold','italic','underline','strike','fontFamily','fontSlots','fontSize','color','highlight']);
function normalizeParagraphMarkTypography(value) {
  const fail=()=>{throw Object.assign(Error('WORD_PARAGRAPH_MARK_TYPOGRAPHY_INVALID'),{code:'WORD_PARAGRAPH_MARK_TYPOGRAPHY_INVALID'});};
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
  const keys=Reflect.ownKeys(value);if(!keys.length||keys.length>PARAGRAPH_MARK_KEYS.length||keys.some(k=>!PARAGRAPH_MARK_KEYS.includes(k)))fail();
  if(Object.hasOwn(value,'fontFamily')&&Object.hasOwn(value,'fontSlots'))fail();
  const result={};
  for(const key of PARAGRAPH_MARK_KEYS){const d=Object.getOwnPropertyDescriptor(value,key);if(!d)continue;if(!d.enumerable||!Object.hasOwn(d,'value'))fail();const v=d.value;
    if(['bold','italic','underline','strike'].includes(key)){if(typeof v!=='boolean')fail();result[key]=v;}
    else if(key==='fontSlots'){
      if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();
      const names=Reflect.ownKeys(v),allowed=['ascii','hAnsi','eastAsia','cs'];
      if(!names.length||names.length>4||names.some(k=>!allowed.includes(k)))fail();
      const slots={};for(const name of allowed){const item=Object.getOwnPropertyDescriptor(v,name);if(!item)continue;if(!item.enumerable||!Object.hasOwn(item,'value'))fail();slots[name]=normalizeFontFamily(item.value);}
      // Four equal explicit slots have one canonical spelling: fontFamily.
      if(names.length===4&&new Set(Object.values(slots)).size===1)fail();result.fontSlots=slots;
    }
    else if(key==='fontFamily')result[key]=normalizeFontFamily(v);
    else if(key==='fontSize')result[key]=normalizeFontSize(v);
    else {if(v!==null&&(typeof v!=='string'||!/^#[a-f0-9]{6}$/iu.test(v)))fail();result[key]=v===null?null:v.toLowerCase();}
  }return result;
}
// Equality for already validated effective mark values. Boolean omission is
// Word's off value only after its paragraph style cascade has been resolved.
function comparableParagraphMarkTypography(value) {
  if(value==null)return null;
  const result=normalizeParagraphMarkTypography(value);
  for(const key of ['bold','italic','underline','strike'])if(result[key]===false)delete result[key];
  return Object.keys(result).length?result:null;
}
// Includes pending property snapshots and reversible history, not only Current.
// Inspect descriptors before dereferencing; no getter or cyclic graph is admitted.
function inspectParagraphMarkTypography(value) {
  const pending=[{value,depth:0}],ancestors=new Set();let present=false,count=0;
  const fail=()=>{throw Error('WORD_PARAGRAPH_MARK_TYPOGRAPHY_INVALID');};
  while(pending.length){const item=pending.pop(),node=item.value;if(!node||typeof node!=='object')continue;
    if(item.exit){ancestors.delete(node);continue;}
    if(++count>1000000||item.depth>128||ancestors.has(node))fail();ancestors.add(node);pending.push({value:node,exit:true});
    const descriptors=Object.getOwnPropertyDescriptors(node);
    for(const [key,d]of Object.entries(descriptors)){
      if(!Object.hasOwn(d,'value'))fail();
      if(key==='wordParagraphMarkTypography'&&d.value!=null){if(item.owner!=='attrs'||!['paragraph','heading'].includes(item.type))fail();normalizeParagraphMarkTypography(d.value);present=true;}
      if(d.value&&typeof d.value==='object')pending.push({value:d.value,depth:item.depth+1,owner:key,type:descriptors.type?.value});
    }
  }return present;
}
module.exports = { normalizeFontFamily, normalizeFontSize, PARAGRAPH_MARK_KEYS, normalizeParagraphMarkTypography, comparableParagraphMarkTypography, inspectParagraphMarkTypography };

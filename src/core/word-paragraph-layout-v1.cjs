'use strict';
// Bounded Word paragraph layout values. No platform, XML or write authority.
const FEATURE = 'word-paragraph-layout.v1';
const INDENT_KEYS = ['left','right','firstLine','hanging'];
const TAB_VALUES = ['left','center','right','decimal','bar','clear'];
const TAB_LEADERS = ['none','dot','hyphen','underscore','heavy','middleDot'];
const fail = () => { throw Object.assign(new Error('WORD_PARAGRAPH_LAYOUT_INVALID'), {code:'WORD_PARAGRAPH_LAYOUT_INVALID'}); };
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return true;
  // Main's isolated command harnesses can supply ordinary records from another
  // realm. Accept that realm's native Object prototype, never custom instances.
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  return Object.getPrototypeOf(prototype) === null && typeof constructor?.value === 'function'
    && Function.prototype.toString.call(constructor.value) === Function.prototype.toString.call(Object);
}
function own(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}

function normalizeWordDefaultTabStop(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 31680) fail();
  return value;
}
function normalizeWordParagraphIndent(value) {
  if (!plain(value)) fail();
  const keys=Reflect.ownKeys(value),out={};
  if (!keys.length || keys.some(key=>!INDENT_KEYS.includes(key))) fail();
  for (const key of INDENT_KEYS) if(Object.hasOwn(value,key)) {
    const item=own(value,key);
    if(!Number.isSafeInteger(item) || item < (['left','right'].includes(key)?-31680:0) || item > 31680) fail();
    out[key]=item;
  }
  return out;
}
function normalizeWordParagraphTabs(value) {
  if (!Array.isArray(value) || value.length > 64 || Reflect.ownKeys(value).some(k=>k!=='length' && !/^(0|[1-9][0-9]*)$/.test(k))) fail();
  const positions=new Set(),out=[];
  for(let index=0;index<value.length;index++) {
    const item=own(value,String(index));
    if(!plain(item) || Reflect.ownKeys(item).some(k=>!['pos','val','leader'].includes(k))) fail();
    const pos=own(item,'pos'),val=own(item,'val'),leader=own(item,'leader');
    if(!Number.isSafeInteger(pos)||pos < -31680||pos >31680||positions.has(pos)||!TAB_VALUES.includes(val)
      || leader!==undefined && !TAB_LEADERS.includes(leader) || val==='clear' && leader!==undefined) fail();
    positions.add(pos);out.push({pos,val,...(leader!==undefined?{leader}:{})});
  }
  return out.sort((a,b)=>a.pos-b.pos);
}
function mergeWordParagraphIndent(base,overrides) {
  const next={...(base?normalizeWordParagraphIndent(base):{})};
  if(overrides) {
    const checked=normalizeWordParagraphIndent(overrides);
    // Word Mac native inherited-pair canary: a direct opposite special indent
    // replaces the inherited one. Both in one layer are retained as raw fields;
    // Word renders hanging in precedence, independently of attribute order.
    if(Object.hasOwn(checked,'firstLine')&&!Object.hasOwn(checked,'hanging'))delete next.hanging;
    if(Object.hasOwn(checked,'hanging'))delete next.firstLine;
    Object.assign(next,checked);
  }
  return Object.keys(next).length?next:undefined;
}
function mergeWordParagraphTabs(base,overrides) {
  const map=new Map((base?normalizeWordParagraphTabs(base):[]).map(stop=>[stop.pos,stop]));
  for(const stop of overrides?normalizeWordParagraphTabs(overrides):[])map.set(stop.pos,stop);
  return normalizeWordParagraphTabs([...map.values()]);
}
function effectiveWordParagraphIndent(value) {
  const checked=value==null?{}:normalizeWordParagraphIndent(value);
  return {left:checked.left??0,right:checked.right??0,special:checked.hanging!==undefined?-checked.hanging:checked.firstLine??0};
}
function effectiveWordParagraphTabs(value) {
  return normalizeWordParagraphTabs(value??[]).filter(stop=>stop.val!=='clear').map(stop=>({...stop,leader:stop.leader??'none'}));
}
function inspectDocumentParagraphLayout(doc) {
  let present=false,count=0;
  const stack=[{node:doc,depth:0,root:true}],ancestors=new Set();
  while(stack.length) {
    const {node,depth,root,mark,exit}=stack.pop();
    if(exit){ancestors.delete(node);continue;}
    if(!plain(node)||depth>128||++count>200000||ancestors.has(node))fail();
    ancestors.add(node);stack.push({node,exit:true});
    const type=own(node,'type'),attrs=own(node,'attrs');
    if(attrs!=null) {
      if(!plain(attrs))fail();
      for(const [key,normalize] of [['wordParagraphIndent',normalizeWordParagraphIndent],['wordParagraphTabs',normalizeWordParagraphTabs],['wordDefaultTabStop',normalizeWordDefaultTabStop]]) {
        const value=own(attrs,key);if(value==null)continue;
        if(key==='wordDefaultTabStop'?(!root||type!=='doc'):mark||!['paragraph','heading'].includes(type))fail();
        normalize(value);present=true;
      }
    }
    for(const key of ['content','marks']) {
      const children=own(node,key);if(children===undefined)continue;
      if(!Array.isArray(children)||children.length>200000)fail();
      for(let index=children.length-1;index>=0;index--)stack.push({node:own(children,String(index)),depth:depth+1,root:false,mark:key==='marks'});
    }
  }
  return present;
}
module.exports={effectiveWordParagraphIndent,effectiveWordParagraphTabs,FEATURE,INDENT_KEYS,TAB_VALUES,TAB_LEADERS,normalizeWordDefaultTabStop,normalizeWordParagraphIndent,normalizeWordParagraphTabs,mergeWordParagraphIndent,mergeWordParagraphTabs,inspectDocumentParagraphLayout};

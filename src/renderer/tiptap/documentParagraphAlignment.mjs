import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import paragraphLayout from '../../core/word-paragraph-layout-v1.cjs';
import { Extension } from '@tiptap/core';
import { normalizeParagraphAlignment } from '../../io/paragraphAlignment.mjs';
import wordLanguage from '../../core/word-language-v1.cjs';
import wordSpacing from '../../core/word-paragraph-spacing-v1.cjs';

function selectedTextBlocks(state) {
  if (!state?.doc || !state.selection) return [];
  const { from, to, empty, $from } = state.selection;
  if (empty) return $from.parent.isTextblock ? [{ node: $from.parent, pos: $from.before() }] : [];
  const blocks = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && pos + 1 < to) blocks.push({ node, pos });
  });
  return blocks;
}

const supportsAlignment = node => ['paragraph', 'heading'].includes(node.type.name);

export function readParagraphAlignment(editor) {
  const blocks = selectedTextBlocks(editor?.state);
  if (!blocks.length || blocks.some(({ node }) => !supportsAlignment(node))) return '';
  const values = new Set(blocks.map(({ node }) => normalizeParagraphAlignment(node.attrs.textAlign) || 'left'));
  return values.size === 1 ? [...values][0] : '';
}

const tabDecorationKey = new PluginKey('wordParagraphTabLayout');
const TWIP_PX = 96 / 1440;
// Derived visual geometry only: never rewrites literal tab text or document attrs.
export function wordTabAdvance({position,stops=[],defaultInterval=720,segmentWidth=0,decimalWidth=segmentWidth,hangingPosition}) {
  const effective=paragraphLayout.normalizeWordParagraphTabs(stops).filter(stop=>!['clear','bar'].includes(stop.val));
  if(Number.isFinite(hangingPosition)&&!effective.some(stop=>stop.pos===hangingPosition))effective.push({pos:hangingPosition,val:'left'});
  effective.sort((a,b)=>a.pos-b.pos);
  const interval=paragraphLayout.normalizeWordDefaultTabStop(defaultInterval)*TWIP_PX;
  const candidates=effective.filter(stop=>stop.pos*TWIP_PX>position+0.05);
  const last=Math.max(0,...effective.map(stop=>stop.pos*TWIP_PX));
  for(const stop of candidates) {
    const offset=stop.val==='right'?segmentWidth:stop.val==='center'?segmentWidth/2:stop.val==='decimal'?decimalWidth:0;
    const width=stop.pos*TWIP_PX-position-offset;
    if(width>=0)return {width,leader:stop.leader||'none'};
  }
  let next=(Math.floor(Math.max(position,last)/interval)+1)*interval;
  const cleared=stops.filter(stop=>stop.val==='clear').map(stop=>stop.pos*TWIP_PX);
  while(cleared.some(value=>Math.abs(value-next)<0.05))next+=interval;
  return {width:Math.max(0,next-position),leader:'none'};
}
function tabLeaderCss(leader) {
  if(leader==='none')return '';
  if(leader==='dot'||leader==='middleDot')return `background-image:radial-gradient(currentColor 0.7px,transparent 0.9px);background-size:4px 2px;background-repeat:repeat-x;background-position:left ${leader==='dot'?'bottom':'center'};`;
  if(leader==='hyphen')return 'background-image:repeating-linear-gradient(to right,currentColor 0 4px,transparent 4px 7px);background-size:7px 1px;background-repeat:repeat-x;background-position:left center;';
  return `background-image:linear-gradient(currentColor,currentColor);background-size:100% ${leader==='heavy'?2:1}px;background-repeat:no-repeat;background-position:left bottom;`;
}
// Only typography/layout properties are copied. No URLs, image sources, links,
// IDs or editable content are introduced into this private measurement host.
const measurementProperties = ['font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-feature-settings','font-kerning','letter-spacing','word-spacing','line-height','white-space','word-break','overflow-wrap','direction','text-indent','text-align','vertical-align'];
function paragraphMeasurement(view, element) {
  const document = view.dom.ownerDocument, window = document.defaultView;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true'); host.inert = true;
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:layout style paint;';
  const mapped = new WeakMap();
  function copy(node, root = false) {
    if (node.nodeType === 3) {
      const container=document.createElement('span'),parts=[];let offset=0;
      for(const value of node.nodeValue.split(/(\t)/u).filter(Boolean)) {
        const text=document.createTextNode(value);parts.push({node:text,start:offset,end:offset+value.length});offset+=value.length;
        if(value==='\t'){const tab=document.createElement('span');tab.appendChild(text);container.appendChild(tab);}else container.appendChild(text);
      }
      if(!parts.length){const text=document.createTextNode('');container.appendChild(text);parts.push({node:text,start:0,end:0});}
      mapped.set(node,parts);return container;
    }
    if (node.nodeType !== 1) return document.createTextNode('');
    if (node.classList.contains('ProseMirror-widget')) return document.createTextNode('');
    const computed = window.getComputedStyle(node);
    const clone = document.createElement(root ? 'div' : node.tagName === 'BR' ? 'br' : 'span');
    mapped.set(node,clone);
    for (const property of measurementProperties) clone.style.setProperty(property,computed.getPropertyValue(property));
    if (node.tagName === 'IMG' || node.contentEditable === 'false') {
      const rect = node.getBoundingClientRect();
      clone.style.cssText += `;display:inline-block;width:${rect.width}px;height:${rect.height}px;`;
    } else {
      for (const child of node.childNodes) clone.appendChild(copy(child));
    }
    if (node.classList.contains('word-tab-layout')) {
      clone.style.fontSize = window.getComputedStyle(node.parentElement).fontSize;
      clone.style.display = 'inline';
    }
    return clone;
  }
  const paragraph = copy(element,true);
  paragraph.style.width = `${element.clientWidth || element.getBoundingClientRect().width}px`;
  paragraph.style.margin = '0'; paragraph.style.padding = '0';
  host.appendChild(paragraph); document.body.appendChild(host);
  function point(pos,bias) {
    const original = view.domAtPos(pos,bias), node = mapped.get(original.node);
    if (!node) throw new Error('WORD_TAB_MEASUREMENT_POINT');
    if(Array.isArray(node)) {
      const part=node.find(part=>original.offset>=part.start&&(original.offset<part.end||(bias<0&&original.offset===part.end)))||node[node.length-1];
      return {node:part.node,offset:original.offset-part.start};
    }
    return {node,offset:original.offset};
  }
  function range(from,to) {
    const a=point(from,1), b=point(to,-1), result=document.createRange();
    result.setStart(a.node,a.offset);result.setEnd(b.node,b.offset);return result;
  }
  return {paragraph,host,range,dispose(){host.remove();},width(from,to){
    if (to<=from) return 0;
    const probe=paragraph.cloneNode(false);probe.style.width='max-content';probe.style.whiteSpace='pre';
    probe.style.textIndent='0';probe.style.textAlign='left';
    probe.appendChild(range(from,to).cloneContents());
    // Rich inline leaves can explicitly inherit white-space: pre-wrap.
    for (const child of probe.querySelectorAll('*')) child.style.whiteSpace='pre';
    host.appendChild(probe);
    try {return probe.getBoundingClientRect().width;} finally {probe.remove();}
  }};
}
function wordTabDecorations(view, cache) {
  const decorations=[], signatures=[];const rootDefault=view.state.doc.attrs.wordDefaultTabStop??720;
  view.state.doc.descendants((node,pos)=>{
    if(!['paragraph','heading'].includes(node.type.name))return;
    const stops=node.attrs.wordParagraphTabs||[], bars=paragraphLayout.normalizeWordParagraphTabs(stops).filter(stop=>stop.val==='bar');
    const tabs=[];node.descendants((child,offset)=>{if(child.isText)for(let i=0;i<child.text.length;i++)if(child.text[i]==='\t')tabs.push({offset:offset+i,absolute:pos+1+offset+i});});
    if(!tabs.length&&!bars.length)return false;
    const element=view.nodeDOM(pos);if(!element?.getBoundingClientRect)return false;
    const computed=view.dom.ownerDocument.defaultView.getComputedStyle(element),rect=element.getBoundingClientRect();
    const key=JSON.stringify([element.clientWidth||rect.width,rootDefault,...measurementProperties.map(p=>computed.getPropertyValue(p))]);
    let geometry=cache.get(node);
    if(!geometry||geometry.key!==key) {
      const measure=paragraphMeasurement(view,element),indent=node.attrs.wordParagraphIndent||{};
      try {
        const text=node.textBetween(0,node.content.size,'\n','\ufffc');
        const widths=[];
        for(let i=0;i<tabs.length;i++) {
          const tab=tabs[i],hardBreak=text.indexOf('\n',tab.offset+1);
          const endOffset=Math.min(tabs[i+1]?.offset??text.length,hardBreak<0?text.length:hardBreak);
          const end=pos+1+endOffset,segment=text.slice(tab.offset+1,endOffset),decimal=segment.search(/[.,]/u);
          const segmentWidth=measure.width(tab.absolute+1,end);
          const decimalWidth=decimal<0?segmentWidth:measure.width(tab.absolute+1,tab.absolute+1+decimal);
          const range=measure.range(tab.absolute,tab.absolute+1);
          const tabRect=range.getBoundingClientRect();
          const origin=measure.paragraph.getBoundingClientRect().left-(indent.left||0)*TWIP_PX;
          const advance=wordTabAdvance({position:tabRect.left-origin,stops,defaultInterval:rootDefault,segmentWidth,decimalWidth,
            ...(indent.hanging!==undefined?{hangingPosition:indent.left||0}:{})});
          const style=`display:inline-block;white-space:pre;font-size:0;width:${Math.round(advance.width*100)/100}px;line-height:inherit;${tabLeaderCss(advance.leader)}`;
          // The measuring tree has one dedicated span per literal tab. Updating
          // its style preserves every mapped text node and all model offsets.
          const tabText=range.startContainer;
          if(tabText.nodeType!==3||tabText.nodeValue!=='\t')throw new Error('WORD_TAB_MEASUREMENT_TAB');
          tabText.parentElement.style.cssText=style;
          widths.push({offset:tab.offset,style});
        }
        geometry={key,widths,height:measure.paragraph.getBoundingClientRect().height};cache.set(node,geometry);
      } finally {measure.dispose();}
    }
    for(const tab of geometry.widths)decorations.push(Decoration.inline(pos+1+tab.offset,pos+2+tab.offset,{class:'word-tab-layout',style:tab.style},{inclusiveStart:false,inclusiveEnd:false}));
    if(bars.length)decorations.push(Decoration.node(pos,pos+node.nodeSize,{style:'position:relative;'}));
    for(const stop of bars) {
      const left=(stop.pos-(node.attrs.wordParagraphIndent?.left||0))*TWIP_PX;
      decorations.push(Decoration.widget(pos+1,()=>{
        const rule=view.dom.ownerDocument.createElement('span');rule.contentEditable='false';rule.setAttribute('aria-hidden','true');
        rule.style.cssText=`position:absolute;left:${left}px;top:0;pointer-events:none;border-left:1px solid currentColor;height:${geometry.height}px;`;
        return rule;
      },{side:-1,key:`word-bar-${pos}-${left}-${geometry.height}`}));
    }
    signatures.push([pos,geometry.widths,bars,geometry.height]);return false;
  });
  return {decorations:DecorationSet.create(view.state.doc,decorations),signature:JSON.stringify(signatures)};
}
function wordTabPlugin() {
  return new Plugin({key:tabDecorationKey,state:{init:()=>DecorationSet.empty,apply(tr,previous){return tr.getMeta(tabDecorationKey)||previous.map(tr.mapping,tr.doc);}},props:{decorations:state=>tabDecorationKey.getState(state)},view(view){
    const window=view.dom.ownerDocument.defaultView;
    let disposed=false,frame=0,lastDoc=null,lastSignature='',reportedFailure=false,cache=new WeakMap();
    const schedule=()=>{if(disposed||frame)return;frame=window.requestAnimationFrame(()=>{
      frame=0;if(disposed||view.composing)return;const doc=view.state.doc;let result;
      try{result=wordTabDecorations(view,cache);}catch{
        if(!reportedFailure){console.warn('WORD_TAB_LAYOUT_MEASUREMENT_FAILED');reportedFailure=true;}return;
      }
      if(disposed||view.state.doc!==doc||view.composing)return;
      lastDoc=doc;reportedFailure=false;if(result.signature===lastSignature)return;lastSignature=result.signature;
      view.dispatch(view.state.tr.setMeta(tabDecorationKey,result.decorations).setMeta('addToHistory',false).setMeta('preventUpdate',true));
    });};
    const invalidate=()=>{cache=new WeakMap();schedule();};
    const observer=typeof window.ResizeObserver==='function'?new window.ResizeObserver(invalidate):null;observer?.observe(view.dom);
    const onCompositionEnd=()=>schedule();view.dom.addEventListener('compositionend',onCompositionEnd);
    const fonts=view.dom.ownerDocument.fonts;fonts?.ready.then(()=>{if(!disposed)invalidate();});fonts?.addEventListener?.('loadingdone',invalidate);
    schedule();return {update(next,previous){view=next;if(previous.doc!==view.state.doc||lastDoc!==view.state.doc)schedule();},destroy(){disposed=true;if(frame)window.cancelAnimationFrame(frame);observer?.disconnect();view.dom.removeEventListener('compositionend',onCompositionEnd);fonts?.removeEventListener?.('loadingdone',invalidate);}};
  }});
}

export const DocumentParagraphAlignment = Extension.create({
  name: 'documentParagraphAlignment',
  addProseMirrorPlugins(){return [wordTabPlugin()];},
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        ...Object.fromEntries([['wordParagraphIndent',paragraphLayout.normalizeWordParagraphIndent],['wordParagraphTabs',paragraphLayout.normalizeWordParagraphTabs]].map(([key,normalize])=>[key,{default:null,parseHTML:()=>null,renderHTML:attrs=>{if(attrs[key]==null)return {};const value=normalize(attrs[key]);const data={['data-'+key]:JSON.stringify(value)};if(key==='wordParagraphIndent'){const css=[];if(value.left!==undefined)css.push(`margin-left: ${value.left/20}pt`);if(value.right!==undefined)css.push(`margin-right: ${value.right/20}pt`);if(value.hanging!==undefined)css.push(`text-indent: ${-value.hanging/20}pt`);else if(value.firstLine!==undefined)css.push(`text-indent: ${value.firstLine/20}pt`);if(css.length)data.style=css.join('; ');}return data;}}])),
        wordParagraphSpacing: {
          default: null,
          parseHTML: element => {
            const raw = element.getAttribute('data-word-paragraph-spacing');
            if (raw == null) return null;
            try { return wordSpacing.normalizeWordParagraphSpacing(JSON.parse(raw)); } catch { return null; }
          },
          renderHTML: attributes => {
            if (attributes.wordParagraphSpacing == null) return {};
            const spacing = wordSpacing.normalizeWordParagraphSpacing(attributes.wordParagraphSpacing);
            const css = [];
            if (spacing.before !== undefined) css.push(`margin-top: ${spacing.before / 20}pt`);
            if (spacing.after !== undefined) css.push(`margin-bottom: ${spacing.after / 20}pt`);
            if (spacing.line !== undefined) {
              if (!spacing.lineRule || spacing.lineRule === 'auto') css.push(`line-height: ${spacing.line / 240}`);
              else if (spacing.lineRule === 'exact') css.push(`line-height: ${spacing.line / 20}pt`);
              else css.push(`line-height: max(1em, ${spacing.line / 20}pt)`);
            }
            return { 'data-word-paragraph-spacing': JSON.stringify(spacing), ...(css.length ? { style: css.join('; ') } : {}) };
          },
        },
        wordParagraphMarkLanguage: {
          default: null,
          parseHTML: element => {
            const raw = element.getAttribute('data-word-paragraph-mark-language');
            if (raw == null) return null;
            try { return wordLanguage.normalizeWordLanguage(JSON.parse(raw)); } catch { return null; }
          },
          renderHTML: attributes => attributes.wordParagraphMarkLanguage == null ? {} : {
            'data-word-paragraph-mark-language': JSON.stringify(wordLanguage.normalizeWordLanguage(attributes.wordParagraphMarkLanguage)),
          },
        },
        textAlign: {
          default: null,
          parseHTML: element => {
            try { return normalizeParagraphAlignment(element.style.textAlign || null); } catch { return null; }
          },
          renderHTML: attributes => attributes.textAlign == null ? {} : {
            style: `text-align: ${normalizeParagraphAlignment(attributes.textAlign)}`,
          },
        },
      },
    },{types:['doc'],attributes:{wordDefaultTabStop:{default:null,rendered:false,parseHTML:()=>null}}}];
  },
  addCommands() {
    return {
      setParagraphAlignment: value => ({ tr, dispatch }) => {
        let textAlign;
        try { textAlign = normalizeParagraphAlignment(value); } catch { return false; }
        if (!textAlign) return false;
        const changed = selectedTextBlocks(tr).filter(({ node }) => supportsAlignment(node) && node.attrs.textAlign !== textAlign);
        if (!changed.length) return false;
        if (dispatch) for (const { node, pos } of changed) tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign });
        return true;
      },
    };
  },
});

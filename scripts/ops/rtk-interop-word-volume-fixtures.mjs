import {buildC5V2PortfolioCorpus} from './rtk-word-c5v2-portfolio-corpus.mjs';
export const WORD_VOLUME_IDS=Object.freeze(['MULTI_SCENE','FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']);
export const WORD_VOLUME_TEXT_PROBES=Object.freeze([
 '[plainTextPreserved] Body text sentinel alpha.',
 '',
 '[latin-basic] Plain ASCII text survives Word and Yalken return.',
 '[latin-diacritic] Café naïve façade coöperate jalapeño résumé.',
 '[cyrillic] Привет мир. Текст сцены сохраняется.',
 '[greek] Καλημέρα κόσμε. Το κείμενο παραμένει.',
 '[cjk] 中文文本保留。日本語の本文も保持。한국어 문장도 유지.',
 '[rtl-hebrew] שלום עולם. טקסט בעברית נשמר.',
 '[emoji-zwj] Family 👨‍👩‍👧‍👦 and technologist 🧑‍💻 stay intact.',
 '  [whitespaceEdgesPreserved] leading and trailing spaces stay here  ',
 '',
 '[paragraphBoundariesPreserved] Final paragraph after an intentional empty paragraph.',
]);
export function buildWordVolumeFixture(volume){
 if(!WORD_VOLUME_IDS.includes(volume))throw new Error('WORD_VOLUME_UNSUPPORTED');
 const minimumWords=volume==='FULL_SYNTHETIC_NOVEL'?100000:volume==='LARGE_DOCUMENT'?500000:0;
 const sourceToken='sentinel alpha',replacementToken='sentinel omega';
 const scenes=minimumWords?buildC5V2PortfolioCorpus('near-supported-limit',{targetWords:minimumWords}).scenes.map((scene,index)=>({
  ordinal:index,name:'volume-'+String(index+1).padStart(2,'0'),
  paragraphs:[...(index===0?WORD_VOLUME_TEXT_PROBES:[]),`[scene-start-${String(index+1).padStart(2,'0')}]`,...scene.rawContent.split('\n'),`[scene-end-${String(index+1).padStart(2,'0')}]`],
 })):Array.from({length:3},(_,index)=>({ordinal:index,name:'volume-'+String(index+1).padStart(2,'0'),paragraphs:WORD_VOLUME_TEXT_PROBES.slice(index*4,index*4+4)}));
 const sourceParagraphs=scenes.flatMap(s=>s.paragraphs);
 return {schemaVersion:'WORD_VOLUME_FIXTURE_V1',volume,minimumWords,scenes,sourceParagraphs,reviewedParagraphs:sourceParagraphs.map(p=>p.replace(sourceToken,replacementToken)),sourceToken,replacementToken,replacementStart:sourceParagraphs[0].indexOf(sourceToken),sourceText:sourceParagraphs.join('\n')};
}

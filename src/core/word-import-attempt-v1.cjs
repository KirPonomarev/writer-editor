'use strict';
const SCHEMA='yalken.word.import-attempt.v1', MAX_BYTES=4096;
const KEYS=['projectId','requestId','importOperationId','sourceArtifactSha256','candidateContentSha256','previewHash','sourceSceneId'];
const fail=()=>{throw Object.assign(Error('DOCX_IMPORT_ATTEMPT_INVALID'),{code:'DOCX_IMPORT_ATTEMPT_INVALID'});};
function data(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==keys.length||keys.some(k=>!descriptors[k]||!Object.hasOwn(descriptors[k],'value')))fail();
 const result={};for(const k of keys)result[k]=descriptors[k].value;return result;
}
function createImportAttempt(value){
 const v=data(value,KEYS);
 for(const key of ['projectId','requestId','sourceSceneId'])if(typeof v[key]!=='string'||!v[key].trim()||v[key]!==v[key].trim()||v[key].length>(key==='requestId'?120:512)||/[\u0000-\u001f\u007f]/u.test(v[key])||!v[key].isWellFormed())fail();
 if(!/^docx-import-op-[a-f0-9]{12}$/u.test(v.importOperationId)||!/^[a-f0-9]{8}$/u.test(v.previewHash))fail();
 for(const key of ['sourceArtifactSha256','candidateContentSha256'])if(v[key]!==null&&(typeof v[key]!=='string'||!/^[a-f0-9]{64}$/u.test(v[key])))fail();
 return {schemaVersion:SCHEMA,...v};
}
function checked(value){const v=data(value,['schemaVersion',...KEYS]);if(v.schemaVersion!==SCHEMA)fail();delete v.schemaVersion;return createImportAttempt(v);}
function serializeImportAttempt(record){const text=JSON.stringify(checked(record))+'\n';if(Buffer.byteLength(text)>MAX_BYTES)fail();return text;}
function parseImportAttempt(text,{projectId}){if(text===null)return null;if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES)fail();let v;try{v=JSON.parse(text);}catch{fail();}const record=checked(v);if(record.projectId!==projectId)fail();return record;}
function assertImportAttemptMatches(record,expected){const actual=checked(record),wanted=createImportAttempt(expected);if(JSON.stringify(actual)!==JSON.stringify(wanted))throw Object.assign(Error('DOCX_IMPORT_ATTEMPT_MISMATCH'),{code:'DOCX_IMPORT_ATTEMPT_MISMATCH'});return actual;}
module.exports={SCHEMA,MAX_BYTES,createImportAttempt,parseImportAttempt,serializeImportAttempt,assertImportAttemptMatches};

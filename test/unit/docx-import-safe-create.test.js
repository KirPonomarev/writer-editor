const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  DOCX_IMPORT_RECEIPT_V3_SCHEMA,
  DOCX_IMPORT_SAFE_CREATE_READY_REASON,
  applyDocxImportSafeCreate,
  rememberDocxImportPreviewPlanAdmission,
  validateDocxImportPreviewPlan,
} = require('../fixtures/docx-import-real-authority.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function docxCanonicalJson(value) {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => docxCanonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${docxCanonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return 'null';
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map((item) => stableSort(item));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(normalizeText(value), 'utf8').digest('hex');
}

function rehashPreviewPlan(plan) {
  const body = clone(plan);
  delete body.previewHash;
  plan.previewHash = stableHash(docxCanonicalJson(body));
  return plan;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function paragraph(order, rawText) {
  const text = normalizeText(rawText);
  return {
    order,
    sourcePart: 'word/document.xml',
    text,
    textHash: stableHash(text),
    charCount: text.length,
  };
}

function contentPreviewReport(paragraphTexts) {
  const paragraphs = paragraphTexts.map((text, index) => paragraph(index, text));
  const joinedText = paragraphs.map((item) => item.text).join('\n');
  return {
    ok: true,
    schemaVersion: 'revision-bridge.docx-content-preview.v1',
    type: 'docxContentPreviewReport',
    status: 'preview',
    code: 'DOCX_CONTENT_PREVIEW_READY',
    reason: 'DOCX_CONTENT_PREVIEW_READY',
    decision: 'preview',
    diagnostics: [],
    evidence: [
      {
        kind: 'contentPreview',
        paragraphCount: paragraphs.length,
        textLength: joinedText.length,
        textHash: stableHash(joinedText),
      },
    ],
    budgets: {
      maxParagraphs: 5000,
      maxTextChars: 1000000,
      maxDiagnostics: 200,
    },
    preflightSummary: {
      status: 'accepted',
      decision: 'accept',
      code: 'DOCX_INTAKE_PREFLIGHT_ACCEPTED',
      gatePass: true,
      parserCandidateOnly: true,
    },
    contentPreview: {
      sourcePart: 'word/document.xml',
      paragraphCount: paragraphs.length,
      textLength: joinedText.length,
      textHash: stableHash(joinedText),
      paragraphs,
    },
    parse: {
      attempted: true,
      completed: true,
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function buildPreviewPlan(paragraphTexts = ['Alpha', 'Bravo']) {
  const bridge = await loadBridge();
  return bridge.buildDocxImportPreviewPlanFromContentPreview(contentPreviewReport(paragraphTexts));
}

function admitPreviewPlan(plan) {
  const admissionHash = rememberDocxImportPreviewPlanAdmission(plan);
  assert.match(admissionHash, /^[a-f0-9]{64}$/u);
  return plan;
}

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function expectedImportOperationId(plan, projectId = 'docx-import-test-project') {
  const entry = plan.candidateCreatePlan.entries[0];
  const operationCanonical = {
    projectId,
    sourceArtifactSha256: typeof plan.source.sourceArtifactSha256 === 'string'
      ? plan.source.sourceArtifactSha256 : '',
    candidateContentSha256: typeof entry.candidateContentSha256 === 'string'
      ? entry.candidateContentSha256 : '',
    previewHash: typeof plan.previewHash === 'string' ? plan.previewHash : '',
    sceneId: typeof entry.sceneId === 'string' ? entry.sceneId : '',
  };
  const operationHash = sha256Text(stableStringify(operationCanonical));
  return `docx-import-op-${operationHash.slice(0, 12)}`;
}

function expectedScenePath(romanRoot, plan, projectId = 'docx-import-test-project') {
  const entry = plan.candidateCreatePlan.entries[0];
  const importOperationId = expectedImportOperationId(plan, projectId);
  return path.join(
    romanRoot,
    'Imported',
    `${entry.title} ${importOperationId.replace(/^docx-import-op-/u, '').slice(0, 8)}.txt`,
  );
}

function expectedPublicSceneLocator(projectRoot, scenePath, projectId, sceneId) {
  const relativeFile = path.relative(projectRoot, scenePath).split(path.sep).join('/');
  const bindingKey = `file:${relativeFile}`;
  const digest = crypto.createHash('sha256')
    .update(`${projectId}\u0000${bindingKey}`, 'utf8')
    .digest('hex');
  return {
    sceneId,
    nodeId: `tree-node-${digest.slice(0, 32)}`,
    label: path.posix.basename(relativeFile, '.txt'),
    kind: 'scene',
  };
}

function listFilesRecursive(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const fullPath = path.join(root, name);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      out.push(...listFilesRecursive(fullPath));
    } else {
      out.push(fullPath);
    }
  }
  return out.sort();
}

function collectKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, pathParts.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).flatMap((key) => (
    [pathParts.concat(key).join('.')].concat(collectKeys(value[key], pathParts.concat(key)))
  ));
}

test('DOCX import safe create: missing or malformed preview performs zero writes', async () => {
  const projectRoot = path.join(os.tmpdir(), `docx-import-safe-create-invalid-${Date.now()}`);
  const romanRoot = path.join(projectRoot, 'roman');
  const missing = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: null },
    { projectRoot, romanRoot },
  );

  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, 'DOCX_SAFE_CREATE_PREVIEW_REQUIRED');
  assert.equal(fs.existsSync(projectRoot), false);

  const malformed = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: { schemaVersion: 'revision-bridge.docx-import-preview.v1' } },
    { projectRoot, romanRoot },
  );
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, 'DOCX_SAFE_CREATE_PREVIEW_INVALID');
  assert.equal(fs.existsSync(projectRoot), false);
});

test('DOCX import safe create: valid preview creates one new scene and returns pathless receipt', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-ok-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Alpha', 'Bravo']));
  const scenePath = expectedScenePath(romanRoot, plan, 'project-docx-safe-create');

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    {
      projectRoot,
      romanRoot,
      projectId: 'project-docx-safe-create',
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Alpha\nBravo');
  assert.equal(fs.existsSync(path.join(projectRoot, 'project.craftsman.json.wp201-transaction.json')), false);
  assert.equal(fs.existsSync(`${scenePath}.wp201-commit.json`), true);

  const receipt = result.value.receipt;
  const publicSceneLocator = expectedPublicSceneLocator(
    projectRoot,
    scenePath,
    'project-docx-safe-create',
    plan.candidateCreatePlan.entries[0].sceneId,
  );
  assert.equal(receipt.schemaVersion, DOCX_IMPORT_RECEIPT_V3_SCHEMA);
  assert.equal(receipt.reason, DOCX_IMPORT_SAFE_CREATE_READY_REASON);
  assert.equal(receipt.projectId, 'project-docx-safe-create');
  assert.equal(receipt.importOperationId, expectedImportOperationId(plan, 'project-docx-safe-create'));
  assert.equal(receipt.sourcePreviewHash, plan.previewHash);
  assert.match(receipt.inputHash, /^[a-f0-9]{64}$/u);
  assert.match(receipt.outputHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(receipt.createdSceneIds, [plan.candidateCreatePlan.entries[0].sceneId]);
  assert.equal(receipt.createdScenes.length, 1);
  assert.equal(receipt.createdScenes[0].bytesWritten, Buffer.byteLength('Alpha\nBravo', 'utf8'));
  assert.match(receipt.createdScenes[0].outputHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.value.publicSceneLocator, publicSceneLocator);
  assert.deepEqual(result.value.publicSceneLocators, [publicSceneLocator]);
  assert.deepEqual(receipt.publicSceneLocator, publicSceneLocator);
  assert.deepEqual(receipt.publicSceneLocators, [publicSceneLocator]);
  assert.deepEqual(receipt.createdScenes[0].publicSceneLocator, publicSceneLocator);
  assert.equal(receipt.sceneTreeIdentities[0].treeNodeId, publicSceneLocator.nodeId);
  assert.equal(receipt.createdScenes[0].treeNodeId, publicSceneLocator.nodeId);
  assert.equal(JSON.stringify(result.value.publicSceneLocator).includes(projectRoot), false);
  assert.equal(JSON.stringify(receipt.publicSceneLocator).includes(projectRoot), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicSceneLocator, 'bindingKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicSceneLocator, 'relativeFile'), false);
  assert.equal(receipt.lossReportSummary.itemCount, plan.lossReport.itemCount);

  const receiptKeys = collectKeys(receipt);
  for (const forbidden of ['path', 'filePath', 'projectRoot', 'rawBytes', 'bufferSource', 'bindingKey', 'relativeFile', 'importReceipt', 'exportReceipt']) {
    assert.equal(receiptKeys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
});

test('DOCX import safe create: reapply returns durable idempotent receipt without mutation', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-reapply-');
  const romanRoot = path.join(projectRoot, 'roman');
  const projectId = 'project-docx-safe-create-reapply';
  const plan = admitPreviewPlan(await buildPreviewPlan(['First']));
  const scenePath = expectedScenePath(romanRoot, plan, projectId);

  const first = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot, projectId },
  );
  assert.equal(first.ok, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'First');

  const second = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot, projectId },
  );
  assert.equal(second.ok, true);
  assert.equal(second.value.created, false);
  assert.equal(second.value.idempotent, true);
  assert.equal(second.value.importOperationId, first.value.importOperationId);
  assert.deepEqual(second.value.publicSceneLocator, first.value.publicSceneLocator);
  assert.deepEqual(second.value.publicSceneLocators, first.value.publicSceneLocators);
  assert.deepEqual(second.value.receipt, first.value.receipt);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'First');
});

test('DOCX import safe create: existing target without durable receipt is blocked without mutation', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-existing-target-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Existing target']));
  const scenePath = expectedScenePath(romanRoot, plan);
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, 'Original', 'utf8');

  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { projectRoot, romanRoot });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_EXISTING_SCENE_BLOCKED');
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Original');
});

test('DOCX import safe create: self-consistent but unadmitted preview is rejected before writes', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-unadmitted-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = await buildPreviewPlan([`Unadmitted ${Date.now()} ${Math.random()}`]);

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.deepEqual(listFilesRecursive(path.join(romanRoot, 'Imported')), []);
});

test('DOCX import safe create: symlinked roman root cannot escape project authority', async (t) => {
  if (process.platform === 'win32') {
    t.skip('directory symlink authority check is covered on POSIX runners');
    return;
  }

  const projectRoot = makeProjectRoot('docx-import-safe-create-symlink-project-');
  const externalRoot = makeProjectRoot('docx-import-safe-create-symlink-outside-');
  const romanRoot = path.join(projectRoot, 'roman');
  fs.symlinkSync(externalRoot, romanRoot, 'dir');
  const plan = admitPreviewPlan(await buildPreviewPlan(['No escape']));
  const externalScenePath = expectedScenePath(externalRoot, plan);

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_ROOT_INVALID');
  assert.equal(fs.existsSync(externalScenePath), false);
  assert.deepEqual(listFilesRecursive(path.join(externalRoot, 'Imported')), []);
});

test('DOCX import safe create: stale marker failure keeps public error details pathless', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-stale-');
  const romanRoot = path.join(projectRoot, 'roman');
  const markerRoot = path.join(projectRoot, '.flow-batch');
  fs.mkdirSync(markerRoot, { recursive: true });
  fs.writeFileSync(path.join(markerRoot, 'stale.json'), '{}', 'utf8');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Stale marker']));

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_LEGACY_RECOVERY_REQUIRED');
  assert.equal(result.error.reason, 'docx_import_legacy_batch_requires_recovery');
  assert.equal(Object.prototype.hasOwnProperty.call(result.error.details, 'staleMarkers'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.error.details, 'markerPath'), false);
  assert.deepEqual(listFilesRecursive(path.join(romanRoot, 'Imported')), []);
});

test('DOCX import safe create: tampered hashes and forged candidate shapes fail closed', async () => {
  const clean = await buildPreviewPlan(['Alpha', 'Bravo']);
  const cases = [
    {
      name: 'previewHash',
      mutate: (plan) => {
        plan.previewHash = '00000000';
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'contentTextHash',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].contentTextHash = '00000000';
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'wrong mode',
      mutate: (plan) => {
        plan.candidateCreatePlan.mode = 'mutate-existing';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_INVALID',
    },
    {
      name: 'multi entry',
      mutate: (plan) => {
        plan.candidateCreatePlan.entryCount = 2;
        plan.candidateCreatePlan.entries.push(clone(plan.candidateCreatePlan.entries[0]));
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_INVALID',
    },
    {
      name: 'source mismatch',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].source.textHash = '11111111';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'scene id mismatch',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].sceneId = 'docx-import-scene-deadbeef';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'source count type',
      mutate: (plan) => {
        plan.source.paragraphCount = '2';
        plan.candidateCreatePlan.entries[0].source.paragraphCount = '2';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_INVALID',
    },
    {
      name: 'forbidden path',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].path = '/tmp/forbidden.txt';
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_FORBIDDEN_FIELD',
    },
  ];

  for (const item of cases) {
    const plan = clone(clean);
    item.mutate(plan);
    const validation = validateDocxImportPreviewPlan(plan);
    assert.equal(validation.ok, false, item.name);
    assert.equal(validation.error.code, item.code, item.name);
  }
});

test('DOCX import safe create: missing real authority is rejected before publication', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-write-fail-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Alpha']));
  const result = await require('../../src/utils/docxImportSafeCreate.js').applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan }, { projectRoot, romanRoot, transactionAuthority: {} });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_AUTHORITY_REQUIRED');
  assert.deepEqual(listFilesRecursive(projectRoot), []);
});

test('DOCX import safe create: thrown write error messageCode cannot carry an absolute path', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-throw-path-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Throw path']));
  const leakedPath = path.join(projectRoot, '.flow-batch', 'marker.json');

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    {
      projectRoot,
      romanRoot,
      queueDiskOperation: async () => {
        throw new Error(`FLOW_BATCH_FAILED ${leakedPath}`);
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_WRITE_FAIL');
  assert.equal(result.error.details.messageCode, 'WRITE_EXCEPTION');
  assert.equal(JSON.stringify(result.error.details).includes(leakedPath), false);
  assert.deepEqual(listFilesRecursive(path.join(romanRoot, 'Imported')), []);
});


test('DOCX safe-create preserves exact table continuation hardBreak and blockquote comment coordinates with existing V3 threads',async t=>{
  const projectRoot=makeProjectRoot('docx-table-comment-breaks-'),romanRoot=path.join(projectRoot,'roman'),projectId='table-comments';
  t.after(()=>fs.rmSync(projectRoot,{recursive:true,force:true}));
  const core=require('../../src/core/word-comment-authoring-v1.cjs'),env=require('../../src/core/document-content-envelope-v1.cjs');
  const sourceScene='roman/source.txt',texts=['Alpha cell item','\ncontinued cell anchor\n','Second cell item'];
  const p=text=>({type:'paragraph',content:[{type:'text',text}]}),doc={type:'doc',content:[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p(texts[0]),{type:'paragraph',content:[{type:'hardBreak'},{type:'text',text:'continued cell anchor'},{type:'hardBreak'}]}]},{type:'listItem',content:[p(texts[2])]}]}]}]}]}]};
  texts.push('Quote anchor');doc.content.push({type:'blockquote',content:[p(texts[3])]});
  const thread=(id,index,start,quote,point=false)=>({threadId:id,rootCommentId:id+'-root',sceneId:sourceScene,status:'open',anchor:core.exactAnchor({paragraphIndex:index,startUtf16:start,selectedText:quote,...(point?{kind:'point',affinity:'right'}:{})},sourceScene,texts),messages:[{commentId:id+'-root',kind:'root',body:id+' body',provenance:{author:'Alice'}}]});
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v3',projectId,revision:0,events:[],threads:[thread('range',0,0,'Alpha'),thread('continuation',1,1,'continued'),thread('point',1,10,'',true),thread('quote',3,0,'Quote')]};
  state.threads[1].messages.push({commentId:'reply',kind:'reply',body:'Reply body',provenance:{author:'Bob'}});
  const raw=env.composeObservablePayload({doc}),source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource({projectId,projectRoot:'/synthetic',nonTextReturnState:state,scenes:[{sceneId:sourceScene,scenePath:'/synthetic/'+sourceScene,observableContent:raw,text:texts.join('\n'),doc,order:0}]});
  const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
  const bytes=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule,commentExport:source.commentExport,commentBlocks:source.blocks});
  const bridge=await loadBridge(),plan=admitPreviewPlan(bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(bytes)));
  assert.equal(plan.ok,true,JSON.stringify(plan));assert.equal(plan.candidateCreatePlan.entries[0].comments.length,4);
  const prior={...state,threads:[{...thread('prior',0,0,'Alpha'),sceneId:'roman/prior.txt',anchor:{...thread('prior',0,0,'Alpha').anchor,sceneId:'roman/prior.txt'}}]};
  const commentPath=path.join(projectRoot,'.yalken/word-review/non-text-return-state.v1.json');fs.mkdirSync(path.dirname(commentPath),{recursive:true});fs.writeFileSync(commentPath,JSON.stringify(prior));
  const options={projectRoot,romanRoot,projectId};
  const result=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(result.ok,true,JSON.stringify(result));
  const after=JSON.parse(fs.readFileSync(commentPath,'utf8'));assert.equal(after.schemaVersion,prior.schemaVersion);assert.deepEqual(after.threads[0],prior.threads[0]);
  const imported=env.parseObservablePayload(fs.readFileSync(expectedScenePath(romanRoot,plan,projectId),'utf8'));assert.ok(imported.doc.content.some(node=>node.type==='blockquote'),'accepted blockquote structure survives actual safe-create');
  assert.deepEqual(after.threads.slice(1).map(x=>[x.anchor.sceneParagraphIndex,x.anchor.startUtf16,x.anchor.selectedText,x.anchor.blockTextSha256]),state.threads.map(x=>[x.anchor.sceneParagraphIndex,x.anchor.startUtf16,x.anchor.selectedText,x.anchor.blockTextSha256]));
  assert.equal(after.threads.slice(1).reduce((n,x)=>n+x.messages.length,0),5);
  const snapshot=()=>Object.fromEntries(listFilesRecursive(projectRoot).filter(p=>!p.includes('.test-authority')).map(p=>[path.relative(projectRoot,p),fs.readFileSync(p).toString('base64')]));
  const beforeRepeat=snapshot(),again=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(again.ok,true,JSON.stringify(again));assert.deepEqual(snapshot(),beforeRepeat);
  let malformedAttempt=0;
  for(const mutate of [c=>{c.startUtf16=0;},c=>{c.blockTextSha256='0'.repeat(64);}]){
    const forged=clone(plan);mutate(forged.candidateCreatePlan.entries[0].comments[1]);rehashPreviewPlan(forged);admitPreviewPlan(forged);
    assert.equal(validateDocxImportPreviewPlan(forged).ok,true);
    const sameAttempt=await applyDocxImportSafeCreate({docxImportPreviewPlan:forged},options);
    assert.equal(sameAttempt.ok,false);assert.equal(sameAttempt.error.code,'DOCX_SAFE_CREATE_WRITE_FAIL');
    assert.equal(sameAttempt.error.details.messageCode,'DOCX_IMPORT_ATTEMPT_MISMATCH');assert.deepEqual(snapshot(),beforeRepeat);
    // A distinct accepted attempt reaches anchor validation instead of retry identity validation.
    const rejected=await applyDocxImportSafeCreate({docxImportPreviewPlan:forged},{...options,importRequestNonce:'malformed-anchor-'+(++malformedAttempt)});assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'DOCX_SAFE_CREATE_COMMENTS_INVALID');assert.equal(rejected.error.details.code,'DOCX_GENERIC_COMMENT_ANCHOR');assert.deepEqual(snapshot(),beforeRepeat);
  }
});

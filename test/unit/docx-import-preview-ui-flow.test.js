const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadDocxImportResolverHelpers() {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('function normalizeDocxImportCreatedSceneIds(value)');
  const end = editor.indexOf('function summarizeDocxImportPreview(value)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);
  return vm.runInNewContext(`${section}
({
  getDocxImportPublicSceneLocatorsFromValue,
  getDocxImportSceneLocatorsFromPlan,
  findDocxImportSceneNode,
})`, {
    getEffectiveDocumentKind: (node) => node?.effectiveKind || node?.kind || '',
    getEffectiveDocumentPath: (node) => node?.effectivePath || node?.path || '',
  });
}

test('DOCX import preview UI flow: existing modal surface exposes preview and accept hooks', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'data-docx-import-preview-modal',
    'data-docx-import-preview-message',
    'data-docx-import-preview-loss',
    'data-docx-import-preview-cancel',
    'data-docx-import-preview-confirm',
  ]) {
    assert.ok(html.includes(marker), marker);
    assert.ok(editor.includes(marker), marker);
  }

  assert.ok(editor.includes('function openDocxImportPreviewFlow()'));
  assert.ok(editor.includes('function confirmDocxImportPreviewAndRun()'));
  assert.ok(editor.includes("const importDocxCommandId = 'cmd.project.importDocxV1';"));
  assert.ok(editor.includes('normalizedCommandId === importDocxCommandId'));
  assert.ok(editor.includes('dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {'));
  assert.ok(editor.includes('accept: true,'));
  assert.ok(editor.includes('localFilePreview: previewValue?.localFilePreview || null,'));
  assert.ok(editor.includes('docxContentPreviewReport: previewValue?.docxContentPreviewReport'));
  assert.ok(editor.includes('docxImportPreviewPlan: plan,'));
  assert.ok(editor.includes('await loadTree();'));
  assert.ok(editor.includes('await openImportedDocxSceneAfterAccept(plan, createdSceneIds, resultValue);'));
});

test('DOCX import preview UI flow: no editor-surface mutation is introduced by import accept', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function confirmDocxImportPreviewAndRun()');
  const end = editor.indexOf('function applyCollabGate()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);

  for (const forbidden of [
    'setPlainText(',
    'setContent(',
    'window.electronAPI.invokeUiCommandBridge',
    'currentDocumentPath =',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
  }
});

test('DOCX import preview UI flow: accepted import opens only a plan-matched scene node', () => {
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'function normalizeDocxImportPublicSceneLocator(value)',
    'function getDocxImportPublicSceneLocatorsFromValue(value)',
    'function getDocxImportSceneLocatorsFromPlan(plan, createdSceneIds)',
    'function findDocxImportSceneNode(root, locators)',
    'async function openImportedDocxSceneAfterAccept(plan, createdSceneIds, acceptedValue = null)',
    'const createdSet = new Set(createdIds);',
    "source: 'public-scene-locator'",
    'expectedLabel: `${sanitizeDocxImportSceneLabelPart(title)} ${contentTextHash}`',
    "return { opened: false, reason: 'imported-scene-not-found' };",
    'const opened = await openDocumentNode(node);',
    'renderTree();',
  ]) {
    assert.ok(editor.includes(marker), marker);
  }

  const helperStart = editor.indexOf('async function openImportedDocxSceneAfterAccept(plan, createdSceneIds, acceptedValue = null)');
  const helperEnd = editor.indexOf('function summarizeDocxImportPreview(value)', helperStart);
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);
  const helperSection = editor.slice(helperStart, helperEnd);
  assert.equal(helperSection.includes('currentDocumentPath ='), false);
  assert.equal(helperSection.includes('window.electronAPI.invokeUiCommandBridge'), false);
});

test('DOCX import preview UI flow: scene resolver executes exact match and fail-closed ambiguity', () => {
  const {
    getDocxImportPublicSceneLocatorsFromValue,
    getDocxImportSceneLocatorsFromPlan,
    findDocxImportSceneNode,
  } = loadDocxImportResolverHelpers();
  const plan = {
    candidateCreatePlan: {
      entries: [
        {
          sceneId: 'docx-import-scene-abcd1234',
          title: 'Imported DOCX',
          contentTextHash: '11111111',
        },
        {
          sceneId: 'docx-import-scene-deadbeef',
          title: 'Ignored',
          contentTextHash: '22222222',
        },
      ],
    },
  };

  const locators = getDocxImportSceneLocatorsFromPlan(plan, [' docx-import-scene-abcd1234 ']);
  assert.deepEqual(JSON.parse(JSON.stringify(locators)), [
    {
      sceneId: 'docx-import-scene-abcd1234',
      expectedLabel: 'Imported DOCX 11111111',
    },
  ]);

  const publicLocator = {
    sceneId: 'docx-import-scene-abcd1234',
    nodeId: 'tree-node-11111111111111111111111111111111',
    label: 'Imported DOCX 11111111',
    kind: 'scene',
  };
  const publicLocators = getDocxImportPublicSceneLocatorsFromValue({
    publicSceneLocators: [publicLocator, publicLocator],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(publicLocators)), [
    {
      sceneId: 'docx-import-scene-abcd1234',
      nodeId: 'tree-node-11111111111111111111111111111111',
      expectedLabel: 'Imported DOCX 11111111',
      source: 'public-scene-locator',
    },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(getDocxImportPublicSceneLocatorsFromValue({
    publicSceneLocator: {
      sceneId: 'docx-import-scene-abcd1234',
      nodeId: 'tree-node-22222222222222222222222222222222',
      label: 'Imported DOCX 22222222',
      relativeFile: 'roman/Imported/Imported DOCX 22222222.txt',
      kind: 'scene',
    },
  }))), []);

  const exactNode = {
    kind: 'scene',
    label: 'Imported DOCX 11111111',
    nodeId: 'tree-node-11111111111111111111111111111111',
  };
  assert.equal(findDocxImportSceneNode({ children: [exactNode] }, publicLocators), exactNode);
  const treeNodeOnly = {
    kind: 'scene',
    label: 'Imported DOCX 11111111',
    treeNodeId: 'tree-node-11111111111111111111111111111111',
  };
  assert.equal(findDocxImportSceneNode({ children: [treeNodeOnly] }, publicLocators), treeNodeOnly);
  assert.equal(
    findDocxImportSceneNode({
      children: [{ ...exactNode, label: 'Imported DOCX stale label' }],
    }, publicLocators),
    null,
  );
  assert.equal(
    findDocxImportSceneNode({
      children: [
        {
          ...exactNode,
          nodeId: 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      ],
    }, publicLocators),
    null,
  );
  assert.equal(findDocxImportSceneNode({ children: [exactNode] }, locators), exactNode);
  assert.equal(
    findDocxImportSceneNode({
      children: [
        { ...exactNode, nodeId: 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { ...exactNode, nodeId: 'tree-node-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ],
    }, locators),
    null,
  );
  assert.equal(
    findDocxImportSceneNode({
      children: [{ ...exactNode, kind: 'chapter-file' }],
    }, locators),
    null,
  );
});

test('DOCX import preview UI flow: project tree exposes Imported txt files as scene nodes', () => {
  const main = read('src/main.js');

  for (const marker of [
    'async function buildImportedRomanTree(romanPath)',
    "joinPathSegmentsWithinRoot(romanPath, ['Imported'],",
    "entry.isFile && entry.name.toLowerCase().endsWith('.txt')",
    "kind: 'scene',",
    "kind: 'chapter-folder',",
    'const importedNode = await buildImportedRomanTree(romanPath);',
    'childNodes.push(importedNode);',
    '...metadata,',
    "parts[1].toLowerCase() === 'imported'",
    "return { title: baseTitle, kind: 'scene', metaEnabled: true };",
  ]) {
    assert.ok(main.includes(marker), marker);
  }
  const readOnlyStart = main.indexOf('async function buildProjectTreeRootsWithIdentitiesReadOnly()');
  assert.notEqual(readOnlyStart, -1);
  const readOnlyEnd = main.indexOf('async function resolveProjectTreeNodeIdentity', readOnlyStart);
  assert.notEqual(readOnlyEnd, -1);
  const readOnlySection = main.slice(readOnlyStart, readOnlyEnd);
  for (const marker of [
    'const activeProjectName = currentProjectName || DEFAULT_PROJECT_NAME;',
    'await buildRomanTree(activeProjectName)',
    'await buildMindMapTree(activeProjectName)',
    'await buildPrintTree(activeProjectName)',
    'nodePath: getProjectRootPath(activeProjectName)',
    'await buildMaterialsTree(activeProjectName)',
    'await buildReferenceTree(activeProjectName)',
    'await annotateProjectTreeDerivedCounters(Object.values(roots), activeProjectName)',
  ]) {
    assert.ok(readOnlySection.includes(marker), marker);
  }
  const resolverEnd = main.indexOf('function normalizeProjectRelativeSceneId', readOnlyEnd);
  assert.notEqual(resolverEnd, -1);
  const resolverSection = main.slice(readOnlyEnd, resolverEnd);
  assert.ok(
    resolverSection.includes('await ensureProjectManifest(currentProjectName || DEFAULT_PROJECT_NAME)'),
    'resolveProjectTreeNodeIdentity uses active project manifest',
  );
});

test('DOCX import preview UI flow: shell reset and restore clear pending accept state', () => {
  const editor = read('src/renderer/editor.js');
  for (const functionName of ['performSafeResetShell', 'performRestoreLastStableShell']) {
    const start = editor.indexOf(`function ${functionName}()`);
    assert.notEqual(start, -1, functionName);
    const end = editor.indexOf('updateWordCount();', start);
    assert.notEqual(end, -1, functionName);
    const section = editor.slice(start, end);
    assert.ok(section.includes('closeDocxImportPreviewModal();'), functionName);
  }
});

test('DOCX import preview UI flow: generated bundle carries the shipped DOCX accept path', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  for (const marker of [
    'cmd.project.docx.previewImportPlan',
    'cmd.project.docx.importSafeCreate',
    'cmd.project.importDocxV1',
    'docxContentPreviewReport',
    'localFilePreview',
    'opened imported scene',
    'imported-scene-not-found',
    'no-created-scene-locator',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }
});

function attemptHarness() {
  const editor=read('src/renderer/editor.js'), calls=[], statuses=[], pending=[];
  const c={currentProjectId:'project-a',crypto:require('node:crypto'),COMMAND_IDS:{PROJECT_IMPORT_DOCX_V1:'import'},
    pendingDocxImportPreviewValue:null,pendingDocxImportPreviewPlan:null,pendingDocxImportAttempt:null,
    docxImportPreviewModal:{},docxImportPreviewMessage:{},docxImportPreviewLoss:{},docxImportPreviewConfirmButtons:[{}],
    getDocxImportPreviewPlanFromValue:value=>value?.docxImportPreviewPlan||null,
    summarizeDocxImportPreview:()=> 'source.docx',summarizeDocxImportLoss:()=> 'retained loss',
    updateStatusText:value=>statuses.push(value),openSimpleModal:()=>{c.visible=true;},closeSimpleModal:()=>{c.visible=false;},
    dispatchUiCommand:(_id,payload)=>{calls.push(payload);return new Promise((resolve,reject)=>pending.push({resolve,reject}));},
    loadTree:async()=>{},openImportedDocxSceneAfterAccept:async()=>({opened:true})};
  vm.createContext(c);vm.runInContext(editor.slice(editor.indexOf('function closeDocxImportPreviewModal()'),editor.indexOf('function summarizeTxtImportPreview(')),c);
  const preview={ok:true,value:{docxImportPreviewPlan:{ok:true},localFilePreview:{status:'preview'}}};
  return {c,calls,statuses,pending,preview};
}

test('actual DOCX UI keeps one attempt through failure and retry, then allocates a fresh explicit import',async()=>{
 const h=attemptHarness(),{c}=h;
 const opening=c.openDocxImportPreviewFlow();assert.equal(h.calls.length,1);assert.ok(h.calls[0]?.requestId);
 h.pending.shift().resolve(h.preview);await opening;const id=h.calls[0].requestId;
 const accept=c.confirmDocxImportPreviewAndRun();await c.confirmDocxImportPreviewAndRun();await c.openDocxImportPreviewFlow();assert.equal(h.calls.length,2);
 h.pending.shift().resolve({ok:false});await accept;assert.equal(c.visible,true);assert.equal(c.docxImportPreviewConfirmButtons[0].textContent,'Retry import');
 assert.equal(c.docxImportPreviewLoss.value,'retained loss');
 assert.equal(c.docxImportPreviewMessage.textContent,'source.docx\n\nThe import could not be confirmed. Retry to check or finish this attempt.');
 const retry=c.confirmDocxImportPreviewAndRun();assert.equal(h.calls[2].requestId,id);assert.equal(h.calls[1].requestId,id);
 h.pending.shift().resolve({ok:true,value:{createdSceneIds:['scene']}});await retry;
 assert.equal(c.pendingDocxImportAttempt,null);const next=c.openDocxImportPreviewFlow();assert.notEqual(h.calls[3].requestId,id);
 h.pending.shift().resolve({ok:true,value:{localFilePreview:{status:'cancelled'}}});await next;assert.equal(c.visible,false);assert.equal(c.pendingDocxImportAttempt,null);
});

test('actual DOCX UI rejects cancelled, stale and throwing completions without duplicate import',async()=>{
 const h=attemptHarness(),{c}=h;const opening=c.openDocxImportPreviewFlow();await c.openDocxImportPreviewFlow();assert.equal(h.calls.length,1);
 c.closeDocxImportPreviewModal();h.pending.shift().resolve(h.preview);await opening;assert.equal(c.visible,false);
 const again=c.openDocxImportPreviewFlow();h.pending.shift().resolve(h.preview);await again;
 const accepting=c.confirmDocxImportPreviewAndRun();h.pending.shift().reject(Error('transport'));await accepting;assert.equal(c.visible,true);
 c.closeDocxImportPreviewModal();assert.equal(c.pendingDocxImportAttempt,null);
 const stale=c.openDocxImportPreviewFlow();c.currentProjectId='project-b';h.pending.shift().resolve(h.preview);await stale;assert.equal(c.visible,false);
});

test('actual DOCX UI never repeats committed import when navigation fails or project changes during reload',async()=>{
 for(const failure of ['open','reload','project']){
  const h=attemptHarness(),{c}=h;const opening=c.openDocxImportPreviewFlow();h.pending.shift().resolve(h.preview);await opening;
  let opens=0;c.openImportedDocxSceneAfterAccept=async()=>{opens++;throw Error('navigation');};
  if(failure==='reload')c.loadTree=async()=>{throw Error('reload');};
  if(failure==='project')c.loadTree=async()=>{c.currentProjectId='project-b';};
  const accept=c.confirmDocxImportPreviewAndRun();h.pending.shift().resolve({ok:true,value:{createdSceneIds:['scene']}});await accept;
  await c.confirmDocxImportPreviewAndRun();assert.equal(h.calls.length,2);assert.equal(c.pendingDocxImportAttempt,null);assert.equal(opens,failure==='open'?1:0);
 }
});

test('actual DOCX UI invalidates project ABA at both real assignment sites and does not cancel a dispatched write',async()=>{
 const editor=read('src/renderer/editor.js');
 const assignments=[...editor.matchAll(/invalidateDocxImportAttempt\(\);\s*currentProjectId = nextProjectId;/gu)];assert.equal(assignments.length,2);
 const h=attemptHarness(),{c}=h;const old=c.openDocxImportPreviewFlow();
 for(const nextProjectId of ['project-b','project-a']){c.nextProjectId=nextProjectId;vm.runInContext(assignments[0][0],c);}
 const fresh=c.openDocxImportPreviewFlow();h.pending.shift().resolve(h.preview);await old;assert.equal(c.visible,false);
 h.pending.shift().resolve(h.preview);await fresh;const accepting=c.confirmDocxImportPreviewAndRun();
 c.closeDocxImportPreviewModal();assert.equal(c.pendingDocxImportAttempt.phase,'accepting');
 h.pending.shift().resolve({ok:true,value:{createdSceneIds:['scene']}});await accepting;assert.equal(h.calls.length,3);assert.equal(c.pendingDocxImportAttempt,null);
});

test('actual DOCX UI treats expired reference as fresh selection and handles chooser exceptions',async()=>{
 const h=attemptHarness(),{c}=h;const opening=c.openDocxImportPreviewFlow();h.pending.shift().resolve(h.preview);await opening;
 const firstId=h.calls[0].requestId,accept=c.confirmDocxImportPreviewAndRun();h.pending.shift().resolve({ok:false,error:{code:'E_DOCX_IMPORT_REFERENCE_INVALID'}});await accept;
 assert.equal(c.docxImportPreviewConfirmButtons[0].textContent,'Select file again');assert.equal(c.visible,true);
 const selecting=c.confirmDocxImportPreviewAndRun();assert.notEqual(h.calls[2].requestId,firstId);assert.equal(h.calls[2].accept,undefined);
 h.pending.shift().reject(Error('chooser failed'));await selecting;assert.equal(c.pendingDocxImportAttempt,null);assert.equal(c.visible,false);
});

for(const reason of ['DOCX_IMPORT_PLAN_REFERENCE_EXPIRED','DOCX_IMPORT_REFERENCE_CONTEXT_CHANGED','DOCX_IMPORT_CONTENT_REFERENCE_INVALID','DOCX_IMPORT_PLAN_REFERENCE_INVALID'])
 for(const field of ['reason','message'])test(`actual DOCX UI explains known stale ${field} ${reason} in its retained dialog`,async()=>{
  const h=attemptHarness(),{c}=h,opening=c.openDocxImportPreviewFlow();h.pending.shift().resolve(h.preview);await opening;
  const accept=c.confirmDocxImportPreviewAndRun();const error={code:'E_DOCX_IMPORT_SAFE_CREATE_FAILED',...(field==='reason'?{reason}:{details:{message:reason}})};
  h.pending.shift().resolve({ok:false,error});await accept;
  assert.equal(c.docxImportPreviewConfirmButtons[0].textContent,'Select file again');
  assert.equal(c.docxImportPreviewMessage.textContent,'source.docx\n\nThe preview expired or its project changed. Select the source file again.');
  assert.equal(c.docxImportPreviewLoss.value,'retained loss');
 });

test('actual DOCX UI never classifies arbitrary failure text as a stale reference or exposes it',async()=>{
 const h=attemptHarness(),{c}=h,opening=c.openDocxImportPreviewFlow();h.pending.shift().resolve(h.preview);await opening;
 const accept=c.confirmDocxImportPreviewAndRun();h.pending.shift().resolve({ok:false,error:{code:'E_DOCX_IMPORT_SAFE_CREATE_FAILED',details:{message:'/private/path DOCX_IMPORT_PLAN_REFERENCE_EXPIRED suffix'}}});await accept;
 assert.equal(c.docxImportPreviewConfirmButtons[0].textContent,'Retry import');
 assert.equal(c.docxImportPreviewMessage.textContent,'source.docx\n\nThe import could not be confirmed. Retry to check or finish this attempt.');
});
